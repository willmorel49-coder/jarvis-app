/* Le fichier de données arrive VIDE — ce n'est pas un chargement réussi.

   ⚠️ 14/08/2026 — Will, sur son iPhone : « 22 officines actives » au lieu de 690,
   en Safari comme depuis l'app installée. Chaîne reconstituée :

     1. la réponse du fichier de ventes arrive vide ou tronquée, mais en HTTP 200 ;
     2. `onload` se déclenche quand même — le navigateur dit seulement qu'il a fini
        de lire, pas que la réponse contenait quelque chose ;
     3. le fichier est marqué « chargé » ;
     4. `loadData()` ne trouve pas `WML_OFFICINES` et retombe sur les anciennes
        tables Supabase (dernier import 19/05/2026), plafonnées à 1 000 lignes
        par l'API — soit exactement **22 officines** ;
     5. l'app affiche ces chiffres périmés comme si c'était la vérité du jour.

   Rien, nulle part, ne disait qu'une substitution avait eu lieu.
   Ces tests verrouillent le point 3 : une réponse vide n'est PAS un chargement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(ICI, '..', 'crm', 'v2', 'v2-boot.js'), 'utf8');

/* `contenu` décide de ce que « exécuter le fichier » produit :
   'plein'  = le fichier pose bien ses données sur window (cas normal)
   'vide'   = la réponse était vide : le script s'exécute, mais ne pose RIEN
              (c'est le cas de Will) */
function monter(contenu) {
  const journal = { scripts: 0 };
  const client = {
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://exemple/signe' } }) }) },
    auth: { refreshSession: () => Promise.resolve({ data: {} }) }
  };

  const win = {
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    setTimeout, clearTimeout, console, Promise, Date, Math, JSON, URL, Blob: function () {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: 'https://exemple/crm/v2/', replace() {} },
    navigator: { onLine: true },
    addEventListener() {}, alert() {}, open: () => null
  };
  win.window = win;

  const head = {
    appendChild: (s) => {
      journal.scripts++;
      // Le fichier « s'exécute ». Plein → il pose ses données. Vide → il ne pose rien.
      if (contenu === 'plein') { win.WML_OFFICINES = [{ id: '1' }]; win.WML_SALES = [['1', 6, 'Will', 'x', 1, 1, 1]]; }
      s.onload && s.onload();          // onload se déclenche dans LES DEUX cas
    }
  };
  win.document = {
    head,
    createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
    addEventListener() {}, querySelector: () => null, documentElement: { style: { setProperty() {} } }
  };

  vm.createContext(win);
  vm.runInContext(SOURCE, win);
  win.V2.sb = () => client;
  return { V2: win.V2, win, journal };
}

test('cas normal : le fichier pose ses donnees, il est bien marque charge', async () => {
  const { V2 } = monter('plein');
  await V2.loadFiles(['wml']);
  assert.equal(V2.dataLoaded('wml'), true);
  assert.deepEqual([...V2.donneesProtegeesKO()], []);
});

test('reponse VIDE en HTTP 200 : onload se declenche, mais ce n est PAS un chargement', async () => {
  const { V2, journal } = monter('vide');
  await V2.loadFiles(['wml']);
  assert.equal(journal.scripts > 0, true, 'le script a bien ete pose');
  assert.equal(V2.dataLoaded('wml'), false,
    'un fichier qui ne pose aucune donnee ne doit JAMAIS compter comme charge — ' +
    'sinon loadData() retombe sur les anciennes tables et affiche 22 officines');
});

test('une reponse vide est signalee comme un echec, pas avalee', async () => {
  const { V2 } = monter('vide');
  await V2.loadFiles(['wml']);
  assert.deepEqual([...V2.donneesProtegeesKO()], ['wml'],
    'l ecran doit pouvoir le dire');
});

test('le temoin couvre aussi les autres fichiers proteges', async () => {
  for (const cle of ['establishments', 'sagitta']) {
    const { V2 } = monter('vide');
    await V2.loadFiles([cle]);
    assert.equal(V2.dataLoaded(cle), false, cle + ' ne doit pas passer pour charge');
  }
});
