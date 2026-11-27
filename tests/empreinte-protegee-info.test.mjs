/* empreinte-protegee-info.test.mjs — empreinte d'un fichier protégé lue fichier par fichier (27/11/2026)
 *
 * Mesuré ce soir-là dans le Safari de Will : la LISTE du seau donnees-protegees échouait au bout de 32 s
 * (25 242 fichiers dans le seau), et l'écran Tournées attendait deux listes ratées (~63 s).
 * empreinteProtegee (v2-boot.js) lit désormais l'empreinte par `info(fichier)` (0,1 s), jamais par `list`,
 * et se replie sur le jeton de version si la réponse traîne. On exécute le code livré (pas une copie).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOT = readFileSync(join(RACINE, 'crm', 'v2', 'v2-boot.js'), 'utf8');

function extraire(debut, fin) {
  const i = BOOT.indexOf(debut); assert.ok(i > 0, debut);
  const j = BOOT.indexOf(fin, i); assert.ok(j > i, fin);
  return BOOT.slice(i, j + fin.length);
}
// de la constante de délai jusqu'à la fin de la fonction (« return p;\n  } »)
const SRC = extraire('var DELAI_EMPREINTE = ', '    return p;\n  }');

function monter(seau, delai) {
  const appels = { info: [], list: 0 };
  const client = { storage: { from: (nom) => { appels.seau = nom; return seau(appels); } } };
  const V2 = { sb: () => client };
  const src = SRC.replace(/var DELAI_EMPREINTE = \d+;/, 'var DELAI_EMPREINTE = ' + (delai || 4000) + ';');
  const empreinte = new Function('V2', 'SEAU_PROTEGE', src + '\nreturn empreinteProtegee;')(V2, 'donnees-protegees');
  return { empreinte, appels };
}
const seauInfo = (rendu) => (appels) => ({
  info: (f) => { appels.info.push(f); return rendu(f); },
  list: () => { appels.list++; return new Promise(() => {}); },   // la liste ne répond jamais (comme en prod le 27/11)
});

test('l’empreinte vient de info(fichier), guillemets retirés, sans aucune liste', async () => {
  const { empreinte, appels } = monter(seauInfo(() => Promise.resolve({ data: { etag: '"0a1b2c3d4e5f6071"' }, error: null })));
  assert.equal(await empreinte('tournees-etablissements.js'), '0a1b2c3d4e5f6071');
  assert.equal(await empreinte('ventes/aaaa1111bbbb2222/wml-ventes-index.js'), '0a1b2c3d4e5f6071');
  assert.deepEqual(appels.info, ['tournees-etablissements.js', 'ventes/aaaa1111bbbb2222/wml-ventes-index.js']);
  assert.equal(appels.list, 0);
  assert.equal(appels.seau, 'donnees-protegees');
});

test('un même fichier n’est demandé qu’une fois par séance', async () => {
  const { empreinte, appels } = monter(seauInfo(() => Promise.resolve({ data: { etag: '"aa11"' } })));
  await Promise.all([empreinte('a.js'), empreinte('a.js')]);
  assert.equal(await empreinte('a.js'), 'aa11');
  assert.equal(appels.info.length, 1);
});

test('réponse qui traîne : repli (null) au bout du délai, sans attendre la base', async () => {
  const { empreinte } = monter(seauInfo(() => new Promise(() => {})), 30);
  const t0 = Date.now();
  assert.equal(await empreinte('tournees-etablissements.js'), null);
  assert.ok(Date.now() - t0 < 1000, 'repli rapide');
});

test('erreur ou réponse sans empreinte : null, puis nouvel essai à la demande suivante', async () => {
  let n = 0;
  const { empreinte, appels } = monter(seauInfo(() => (++n === 1
    ? Promise.reject(new Error('544'))
    : Promise.resolve({ data: { etag: '"bb22"' } }))));
  assert.equal(await empreinte('x.js'), null);
  assert.equal(await empreinte('x.js'), 'bb22');
  assert.equal(appels.info.length, 2);
  const vide = monter(seauInfo(() => Promise.resolve({ data: null, error: { message: 'Object not found' } })));
  assert.equal(await vide.empreinte('absent.js'), null);
});

test('client sans info() : null (repli sur le jeton), jamais d’exception', async () => {
  const { empreinte } = monter(() => ({ list: () => Promise.resolve({ data: [] }) }));
  assert.equal(await empreinte('a.js'), null);
});
