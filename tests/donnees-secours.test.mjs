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
   'plein'   = le fichier pose bien ses données sur window (cas de wml, qui finit
               par `try{window.WML_OFFICINES=WML_OFFICINES;…}`)
   'lexical' = le fichier déclare `const SAGITTA_SHORTLIST = …` et RIEN d'autre :
               une liaison lexicale, qui n'est PAS une propriété de window. C'est
               `bridge()` qui l'y recopie. Cas réel de sagitta, bench, clients…
   'vide'    = la réponse était vide : le script s'exécute, mais ne pose RIEN
               (c'est le cas de Will) */
function monter(contenu) {
  const journal = { scripts: 0 };
  // 03/09/2026 (commit dda303b0, « la grande passe ») : les fichiers proteges
  // ne sont plus signes un par un partout — les 11 tranches de ventes (et tout
  // autre lot) passent par UNE signature groupee, `createSignedUrls` (pluriel).
  // Sans ce second stub, la vraie fonction de l'app (adressesProtegees) plante
  // sur `.createSignedUrls is not a function`, marque tout en echec apres 3
  // essais, et AUCUN des tests ci-dessous ne peut plus atteindre son propre
  // scenario ('plein'/'vide'/'lexical') : le faux decor a vieilli, pas l'app.
  // Les deux stubs rendent l'adresse signee EN EMBARQUANT le nom du fichier
  // demande (path/fichiers) : c'est ce nom que `fetch` relit plus bas pour
  // savoir CE QU'IL simule, fichier par fichier.
  const client = {
    storage: { from: () => ({
      createSignedUrl: (path) => Promise.resolve({ data: { signedUrl: 'https://exemple/signe/' + path } }),
      createSignedUrls: (fichiers) => Promise.resolve({
        data: fichiers.map((f) => ({ path: f, signedUrl: 'https://exemple/signe/' + f })),
      }),
    }) },
    auth: { refreshSession: () => Promise.resolve({ data: {} }) }
  };

  // Meme date (dda303b0) : un fichier protege n'est plus pose par une balise
  // <script src> pointant sur l'adresse signee — son TEXTE est recupere par
  // fetch() puis execute via une URL de Blob (poserTexte). `fetch` doit donc
  // reussir et rendre un corps non vide (sinon texteProtege le prend pour une
  // troncature reseau, AUTRE panne que celle testee ici) ; le nom du fichier
  // demande est embarque dans le texte rendu (marqueur FILE=...), pour que le
  // faux <script> sache plus loin QUEL fichier il est en train d'« executer ».
  const fetchProtege = (url) => {
    const nom = String(url).split('/').pop();
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve('/*FILE=' + nom + '*/ contenu protege simule, assez long pour ne pas paraitre tronque.'),
      json: () => Promise.resolve({}),
    });
  };

  // Blob/URL propres au bac a sable : on ne s'appuie pas sur le vrai Blob de
  // Node (qui refuse depuis peu tout objet qui n'est pas une vraie instance
  // Blob passee a URL.createObjectURL) — on route juste le TEXTE d'origine
  // jusqu'au faux <script> qui l'« execute », via un registre prive.
  const texteParUrl = new Map();
  let blobSeq = 0;
  function FakeBlob(parts) { this._texte = (parts || []).join(''); }
  const FakeURL = {
    createObjectURL: (blob) => { const u = 'blob:sim-' + (blobSeq++); texteParUrl.set(u, blob._texte); return u; },
    revokeObjectURL: (u) => { texteParUrl.delete(u); },
  };

  const win = {
    fetch: fetchProtege,
    setTimeout, clearTimeout, console, Promise, Date, Math, JSON, URL: FakeURL, Blob: FakeBlob,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: 'https://exemple/crm/v2/', replace() {} },
    navigator: { onLine: true },
    addEventListener() {}, alert() {}, open: () => null
  };
  win.window = win;

  // Applique le scenario sous test ('plein'/'vide'/'lexical') — c'est ce que
  // fait « executer » un fichier de donnees sur window, une fois charge.
  function appliquerScenario() {
    if (contenu === 'plein') { win.WML_OFFICINES = [{ id: '1' }]; win.WML_SALES = [['1', 6, 'Will', 'x', 1, 1, 1]]; }
    // Liaison lexicale : visible du code du même contexte (donc de `bridge()`),
    // mais absente de `window` — exactement ce que fait le vrai fichier sagitta.
    if (contenu === 'lexical') { vm.runInContext('const SAGITTA_SHORTLIST = [1, 2, 3];', win); }
    // 'vide' : ne pose rien, volontairement — c'est le cas de Will.
  }

  const head = {
    appendChild: (s) => {
      journal.scripts++;
      const texte = s._src && texteParUrl.get(s._src);
      if (texte === undefined) {
        // Script direct (adresse du dépôt, pas une URL de Blob) : c'est le
        // fichier sous test lui-même (wml, quand il n'est plus protégé).
        appliquerScenario();
      } else if (/FILE=wml-officines-ca\.js/.test(texte)) {
        // Fichier soeur auto-ajouté depuis le 03/09/2026 (wmlca) : il n'est
        // JAMAIS le sujet du test, il se charge toujours correctement. Forme
        // MINIMALE mais réelle (`.m`, la table utilisée par fusionsProtegees()
        // dans bridge()) : un simple `{}` fait planter cette fusion — {}.m est
        // undefined, `mo[String(of.id)]` lève alors « Cannot read properties
        // of undefined » à l'intérieur de finir(), silencieusement avalée par
        // le .catch() du téléchargement de la dernière tranche, qui bloque
        // loadFiles() pour de bon (aucun test ne pouvait plus jamais finir).
        win.WML_OFF_CA = { m: {} };
      } else if (/FILE=clients-actifs\.js/.test(texte)) {
        // Idem pour clientsactifs, soeur auto-ajoutée de 'wml' depuis la même date.
        win.CLIENTS_ACTIFS = {};
      } else {
        // Fichier protégé sous test (sagitta, establishments, une tranche de
        // ventes wml-ventes-NN.js…) : le scénario du test s'applique à lui.
        appliquerScenario();
      }
      s.onload && s.onload();          // onload se déclenche dans TOUS les cas
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
  // 03/09/2026 : demander 'wml' entraine aussi 'wmlca' et 'clientsactifs'
  // (auto-ajoutes, hors sujet de ce test — ils se chargent toujours), donc la
  // liste peut contenir plus que 'wml' seul. Ce qui compte reste inchange :
  // 'wml' lui-meme doit y figurer, l'ecran doit pouvoir le dire.
  const ko = [...V2.donneesProtegeesKO()];
  assert.ok(ko.includes('wml'), `l ecran doit pouvoir le dire — echecs : ${ko.join(' · ')}`);
});

test('un fichier qui declare `const X` sans le poser sur window est bien CHARGE', async () => {
  // ⚠️ Regression du 14/08/2026 : la verification du temoin passait AVANT
  // `bridge()`, qui est justement l'etape qui recopie ces `const` sur window.
  // Resultat : sagitta etait declare en echec et se reteledchargeait a chaque
  // ouverture, alors qu'il etait parfaitement charge.
  const { V2 } = monter('lexical');
  await V2.loadFiles(['sagitta']);
  assert.equal(V2.dataLoaded('sagitta'), true,
    'une liaison lexicale recopiee par bridge() compte comme chargee');
  assert.deepEqual([...V2.donneesProtegeesKO()], []);
});

test('le temoin couvre aussi les autres fichiers proteges', async () => {
  for (const cle of ['establishments', 'sagitta']) {
    const { V2 } = monter('vide');
    await V2.loadFiles([cle]);
    assert.equal(V2.dataLoaded(cle), false, cle + ' ne doit pas passer pour charge');
  }
});
