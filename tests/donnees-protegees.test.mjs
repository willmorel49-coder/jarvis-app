/* Chargement des fichiers de données PROTÉGÉS (Supabase Storage).
   ⚠️ 14/08/2026 — Will : « ya plus aucune données sur jarvis ».
   Depuis le 13/08, les officines, le CA et le pilotage viennent d'un espace
   fermé : l'app demande une adresse signée, qui n'est délivrée qu'à une
   session valable. L'ancien code ne réessayait pas et avalait toute erreur.
   Un seul refus — jeton pas encore renouvelé au réveil de l'app installée —
   et l'app s'affichait ENTIÈRE ET VIDE, sans le moindre message.

   Ces tests verrouillent les deux garanties : on réessaie (en renouvelant la
   session), et un échec définitif est DIT, jamais avalé. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(ICI, '..', 'crm', 'v2', 'v2-boot.js'), 'utf8');

/* Monte v2-boot.js dans un faux navigateur.
   `storage` decrit la suite des reponses de createSignedUrl : chaque appel
   consomme la suivante. 'ok' = adresse delivree, 'refus' = data vide,
   'erreur' = promesse rejetee (ce que fait Supabase sur un jeton refuse). */
function monter(reponses) {
  const journal = { signes: 0, refresh: 0, scripts: [] };
  const suite = reponses.slice();

  const client = {
    storage: {
      from: () => ({
        createSignedUrl: () => {
          journal.signes++;
          const r = suite.shift();
          if (r === 'erreur') return Promise.reject(new Error('jeton refuse'));
          if (r === 'refus') return Promise.resolve({ data: null });
          return Promise.resolve({ data: { signedUrl: 'https://exemple/signe-' + journal.signes } });
        }
      })
    },
    auth: {
      refreshSession: () => { journal.refresh++; return Promise.resolve({ data: {} }); }
    }
  };

  const head = { appendChild: (s) => { journal.scripts.push(s.src); s.onload && s.onload(); } };
  const win = {
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    setTimeout, clearTimeout, console, Promise, Date, Math, JSON, URL, Blob: function () {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: 'https://exemple/crm/v2/', replace() {} },
    navigator: { onLine: true },
    addEventListener() {}, alert() {}, open: () => null
  };
  win.window = win;
  win.document = {
    head,
    createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
    addEventListener() {}, querySelector: () => null, documentElement: { style: { setProperty() {} } }
  };

  vm.createContext(win);
  vm.runInContext(SOURCE, win);

  const V2 = win.V2;
  V2.sb = () => client;
  return { V2, journal, win };
}

test('un refus passager ne perd pas les donnees : on reessaie', async () => {
  const { V2, journal } = monter(['refus', 'ok']);
  await V2.loadFiles(['wml']);
  assert.equal(journal.signes, 2, 'un 2e essai doit avoir lieu apres un refus');
  assert.equal(V2.dataLoaded('wml'), true, 'le fichier doit finir par se charger');
  assert.deepEqual([...V2.donneesProtegeesKO()], [], 'aucun echec ne doit rester note');
});

test('la session est renouvelee entre deux essais', async () => {
  const { V2, journal } = monter(['erreur', 'ok']);
  await V2.loadFiles(['wml']);
  assert.equal(journal.refresh, 1, 'sans renouvellement, le 2e essai echoue pour la meme raison');
  assert.equal(V2.dataLoaded('wml'), true);
});

test('trois refus : l echec est DIT, jamais avale en silence', async () => {
  const { V2, journal } = monter(['refus', 'refus', 'refus']);
  await V2.loadFiles(['wml']);
  assert.equal(journal.signes, 3, 'trois essais attendus');
  assert.equal(V2.dataLoaded('wml'), false);
  assert.deepEqual([...V2.donneesProtegeesKO()], ['wml'],
    'un echec definitif doit etre note — sinon l app s affiche vide sans rien dire');
});

test('une erreur rejetee est traitee comme un refus, pas comme un succes', async () => {
  const { V2 } = monter(['erreur', 'erreur', 'erreur']);
  await V2.loadFiles(['wml']);
  assert.equal(V2.dataLoaded('wml'), false);
  assert.deepEqual([...V2.donneesProtegeesKO()], ['wml']);
});

test('un chargement reussi efface un echec precedent', async () => {
  const { V2 } = monter(['refus', 'refus', 'refus']);
  await V2.loadFiles(['wml']);
  assert.deepEqual([...V2.donneesProtegeesKO()], ['wml']);

  const suivant = monter(['ok']);
  await suivant.V2.loadFiles(['establishments']);
  assert.deepEqual([...suivant.V2.donneesProtegeesKO()], []);
});

test('les trois fichiers proteges sont couverts, pas seulement wml', async () => {
  for (const cle of ['wml', 'establishments', 'sagitta']) {
    const { V2 } = monter(['refus', 'refus', 'refus']);
    await V2.loadFiles([cle]);
    assert.deepEqual([...V2.donneesProtegeesKO()], [cle], cle + ' doit signaler son echec');
  }
});
