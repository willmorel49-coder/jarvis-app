/* Audit V3 du 22/11/2026, lot 3 « socle des données » — D10, D11, F2.
   D10 : 32 fichiers .json des robots étaient lus par un fetch direct, hors du chargeur : absents ou tronqués,
         l'écran affichait « aucune baisse », « aucune actualité »… sans bandeau. Garde commune dans v2-boot.js.
   D11 : le bandeau écrivait « (pharmafrca) », « (margeclients) »… pour 46 des 49 fichiers protégés.
   F2  : ruptures-data.js (289 Ko, lu par aucun écran depuis le 09/11) chargé à chaque ouverture.
   Le code exécuté est celui des fichiers livrés, découpé entre deux repères — jamais recopié. Pas de navigateur.
   Lancer : node --test tests/bandeau-donnees-mots-simples.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, B), 'utf8');
const BOOT = lire('v2-boot.js'), APP = lire('v2-app.js');

function bloc(src, debut, fin) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'repère introuvable : ' + debut);
  const j = src.indexOf(fin, i);
  assert.ok(j > i, 'repère de fin introuvable : ' + fin);
  return src.slice(i, j);
}

// ── la garde commune, montée seule avec un faux réseau ──
function monterGarde(reseau) {
  const sb = { console, Promise, URL, String, RegExp, Object, Array, JSON, appels: [], bandeaux: 0 };
  sb.setTimeout = (f) => { f(); return 0; };   // la reprise après 1 s, sans attendre
  sb.location = { href: 'https://crm-jarvis.vercel.app/crm/v2/index.html', origin: 'https://crm-jarvis.vercel.app' };
  sb.window = sb;
  sb.fetch = function (u, init) { sb.appels.push(String(u)); return reseau(String(u), init, sb.appels.length); };
  vm.createContext(sb);
  vm.runInContext('var V2 = window.V2 = { bandeauDonneesManquantes: function () { window.bandeaux++; } };\n(function(){\n' +
    bloc(BOOT, '// ── Garde commune des fichiers .json', '// Officines en « reprise récente »') + '\n})();', sb);
  return sb;
}
const rep = (ok, corps, status) => ({ ok, status: status || (ok ? 200 : 404), json: () => (corps instanceof Error ? Promise.reject(corps) : Promise.resolve(corps)) });

test('D10 · fichier absent (404) : l\'écran reçoit la même réponse qu\'avant, mais l\'échec est noté et dit', async () => {
  const sb = monterGarde(() => Promise.resolve(rep(false, null)));
  const r = await sb.fetch('prix.json?d=2026-11-22', { cache: 'no-store' });
  assert.equal(r.ok, false, 'l\'écran garde son comportement : r.ok faux, comme avant');
  assert.deepEqual(Object.keys(sb.V2.protegeEchec), ['prix.json']);
  assert.ok(sb.bandeaux >= 1, 'le bandeau est redessiné tout de suite (l\'échec arrive après le rendu)');
});

test('D10 · réponse tronquée (JSON illisible, HTTP 200) : signalée — un « onload » ne prouve rien', async () => {
  const sb = monterGarde(() => Promise.resolve(rep(true, new SyntaxError('JSON tronqué'))));
  const r = await sb.fetch('grossistes-actu.json?d=2026-11-22');
  await assert.rejects(() => r.json(), SyntaxError);
  assert.equal(sb.V2.protegeEchec['grossistes-actu.json'], true);
});

test('D10 · coupure : une reprise silencieuse ; si elle passe, aucune alerte et la donnée arrive', async () => {
  const sb = monterGarde((u, init, n) => (n === 1 ? Promise.reject(new TypeError('Load failed')) : Promise.resolve(rep(true, { drops: [1] }))));
  const j = await (await sb.fetch('ansm-dispo.json?d=x')).json();
  assert.deepEqual(j, { drops: [1] });
  assert.equal(sb.appels.length, 2);
  assert.deepEqual(Object.keys(sb.V2.protegeEchec), []);
});

test('D10 · coupure qui dure : signalée après la reprise, l\'erreur remonte à l\'écran comme avant', async () => {
  const sb = monterGarde(() => Promise.reject(new TypeError('Load failed')));
  await assert.rejects(() => sb.fetch('national.json?d=x'), TypeError);
  assert.equal(sb.appels.length, 2);
  assert.equal(sb.V2.protegeEchec['national.json'], true);
});

test('D10 · une lecture réussie efface l\'échec du même fichier', async () => {
  let panne = true;
  const sb = monterGarde(() => Promise.resolve(panne ? rep(false, null) : rep(true, {})));
  await sb.fetch('odisse.json?d=1');
  assert.equal(sb.V2.protegeEchec['odisse.json'], true);
  panne = false;
  await (await sb.fetch('odisse.json?d=2')).json();
  assert.equal(sb.V2.protegeEchec['odisse.json'], undefined);
});

test('D10 · rien d\'autre n\'est touché : Supabase, autre site, fichier .js, écriture, autre dossier', async () => {
  const sb = monterGarde(() => Promise.resolve(rep(false, null)));
  await sb.fetch('https://iyvavhnlhxksokkerkos.supabase.co/rest/v1/notes?select=*');
  await sb.fetch('https://data.geopf.fr/geocodage/search?q=x.json');
  await sb.fetch('prix-data.js?v=1');
  await sb.fetch('prix.json', { method: 'POST' });
  await sb.fetch('https://crm-jarvis.vercel.app/opso/v2/prix.json');
  assert.deepEqual(Object.keys(sb.V2.protegeEchec), []);
  assert.equal(sb.appels.length, 5, 'aucune reprise pour ce qui n\'est pas gardé');
});

// ── le bandeau, monté seul ──
function monterBandeau() {
  const el = { id: '', className: '', innerHTML: '', classList: { add() { el.vu = true; }, remove() { el.vu = false; } } };
  let pose = null;
  const sb = { console, Object, Array, Math, String, RegExp };
  sb.document = { getElementById: () => pose, createElement: () => el, body: { appendChild: (x) => { pose = x; } } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext('var V2 = window.V2 = { protegeEchec: {}, donneesProtegeesKO: function () { return Object.keys(V2.protegeEchec); } };\nfunction ensureAppbarCss() {}\n' +
    bloc(APP, '  var LIB_PROTEGE = {', '  V2.rechargerDonneesProtegees = function'), sb);
  return { V2: sb.V2, el };
}
const texte = (h) => h.replace(/<[^>]+>/g, ' ');

// toutes les clés que le bandeau peut recevoir : chargeur (DATA_FILES, PROTEGES) + fichiers .json lus par les écrans
function clesConnues() {
  const cles = new Set();
  for (const nom of ['var DATA_FILES = {', 'var PROTEGES = {']) {
    const b = bloc(BOOT, nom, '\n  };');
    for (const m of b.matchAll(/^\s+([a-zA-Z0-9_]+): *'/gm)) cles.add(m[1]);
  }
  for (const f of ['v2-boot.js', 'v2-app.js', 'v2-appro.js', 'v2-comptoir.js', 'v2-grossistes.js', 'v2-concurrents-carte.js',
    'v2-concurrents-liens.js', 'v2-groupements.js', 'v2-infos.js', 'v2-infos-concurrents.js', 'v2-marche-fr.js', 'v2-produits.js',
    'v2-offilog-vitrine.js', 'v2-brief-officine.js']) {
    for (const m of lire(f).matchAll(/'((?:[a-z0-9_-]+\/)?[a-z0-9_-]+\.json)/g)) {
      if (!/^index\//.test(m[1])) cles.add(m[1].replace(/^v2\//, ''));
    }
  }
  return [...cles];
}

test('D11 · chaque fichier connu a un nom en mots simples, et le bandeau n\'écrit jamais un nom technique', () => {
  const { V2, el } = monterBandeau();
  const cles = clesConnues();
  assert.ok(cles.length > 90, 'la liste des clés est bien lue (' + cles.length + ')');
  const sansNom = cles.filter((k) => !V2.LIB_DONNEES[k]);
  assert.deepEqual(sansNom, [], 'fichiers sans nom lisible');
  for (const k of cles) {
    V2.protegeEchec = { [k]: true };
    V2.bandeauDonneesManquantes();
    const t = texte(el.innerHTML);
    assert.ok(t.includes(V2.LIB_DONNEES[k]), k + ' : son nom lisible est affiché');
    assert.ok(!t.includes('(' + k + ')') && !t.includes(' ' + k + ' '), k + ' : le nom technique n\'apparaît pas');
  }
});

test('D11 · cas connus : « pharmafrca », « margeclients », « prix.json » en clair ; un inconnu ne fuit pas', () => {
  const { V2, el } = monterBandeau();
  V2.protegeEchec = { pharmafrca: true, margeclients: true };
  V2.bandeauDonneesManquantes();
  assert.match(texte(el.innerHTML), /le chiffre d’affaires des officines de France et notre marge par client/);
  assert.match(el.innerHTML, /Réessayer/, 'un fichier du chargeur se relance');
  V2.protegeEchec = { 'prix.json': true };
  V2.bandeauDonneesManquantes();
  assert.match(texte(el.innerHTML), /les baisses de prix/);
  assert.doesNotMatch(el.innerHTML, /Réessayer/, 'un .json lu en direct ne se relance pas d\'ici : pas de bouton qui ne fait rien');
  V2.protegeEchec = { 'wml-ventes-07': true };
  V2.bandeauDonneesManquantes();
  assert.doesNotMatch(el.innerHTML, /wml-ventes/);
  assert.match(texte(el.innerHTML), /une partie des informations/);
  V2.protegeEchec = { ppht: true, prodstats: true, bench: true, 'prix.json': true, 'national.json': true };
  V2.bandeauDonneesManquantes();
  assert.match(texte(el.innerHTML), /et d’autres informations/, 'au plus 3 noms, la phrase reste lisible');
  V2.protegeEchec = {};
  V2.bandeauDonneesManquantes();
  assert.equal(el.vu, false, 'plus d\'échec : le bandeau s\'efface');
});

test('F2 · ruptures-data.js ne se charge plus au démarrage', () => {
  const html = readFileSync(new URL('index.html', B), 'utf8');
  assert.ok(!html.includes('ruptures-data.js'), 'index.html charge encore ruptures-data.js');
});
