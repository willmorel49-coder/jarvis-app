/* Une seule saisonnalité sur la fiche produit (24/11/2026, choix cliqué de Will : « Celle de l'étude »).
   Le bloc 6 affiche la saisonnalité de l'étude (bloc 7 : Medic'AM, années civiles complètes), période écrite ;
   il attend son chargement plutôt que d'afficher deux mois de suite ; repli sur national.json si l'étude n'a pas de série.
   Données 100 % inventées, réponse connue d'avance. Vrai code : v2-etude.js, v2-etude-ecran.js et v2-comptoir.js entiers.
   Lancer : node --test tests/etude-saison-bloc6.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const nu = (x) => JSON.parse(JSON.stringify(x));
const sansBalise = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

function bac(tranches) {
  const sb = { document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise };
  sb.window = sb; sb.globalThis = sb;
  sb.fetch = (url) => {
    const f = String(url).split('?')[0];
    return f in tranches ? Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(tranches[f]))) })
      : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  };
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  ['v2-comptoir.js', 'v2-etude.js', 'v2-etude-ecran.js'].forEach((f) => vm.runInContext(lire(f), sb));
  sb.V2.comptoir.repose = () => {};   // le redessin de la fiche entière (catalogue absent ici) est vérifié dans le navigateur
  return sb;
}

// Un produit inventé : 2021-01 à 2026-08 (68 mois), creux en novembre chaque année, pic en mars.
const CIP = '3400900000099';
function serie() {
  const out = [];
  for (let k = 0; k < 68; k++) { const m = k % 12; out.push(m === 10 ? 50 : m === 2 ? 160 : 100); }
  return out;
}
const TRANCHES = { ['etude-france/' + CIP.slice(-2) + '.json']: { m0: '2021-01', n: 68, d: { [CIP]: [serie(), serie(), Array(68).fill(0)] } } };

test('période en clair : années complètes seulement, suite continue ou non', () => {
  const sb = bac({}), K = sb.V2.etude._calc;
  const mois = K.moisListe('2021-01', 68), tous = serie();
  assert.deepEqual(nu(K.saisonAnnees(tous, mois)), ['2021', '2022', '2023', '2024', '2025']);   // 2026 n'a que 8 mois
  assert.equal(K.periodeAnnees(K.saisonAnnees(tous, mois)), 'de janvier 2021 à décembre 2025');
  assert.equal(K.periodeAnnees(['2025']), 'de janvier à décembre 2025');
  assert.equal(K.periodeAnnees(['2021', '2023', '2024']), 'années 2021, 2023 et 2024');
  assert.equal(K.periodeAnnees([]), null);
  // une année à zéro est écartée, comme dans saisonIndices
  const trou = tous.slice(); for (let k = 12; k < 24; k++) trou[k] = 0;
  assert.deepEqual(nu(K.saisonAnnees(trou, mois)), ['2021', '2023', '2024', '2025']);
});

test('bloc 6 : « Chargement » tant que l\'étude n\'est pas là, puis le mois fort et le mois faible de l\'étude, période écrite', async () => {
  const sb = bac(TRANCHES), C = sb.V2.comptoir._calc, E = sb.V2.etude;
  const l = { cip: CIP, d: 'PRODUIT INVENTE 10MG' };
  // national.json dirait l'inverse (fort en sept., faible en janv.) : il ne doit plus apparaître
  const ancien = C.saisonDe([0.5, 1, 1, 1, 1, 1, 1, 1, 1.5, 1, 1, 1]);
  const s = { autres: { froid: false }, generique: null, tendance: { saison: ancien } };
  assert.equal(E.franceSaison(CIP), undefined);
  let h = sansBalise(C.blocProduit(s, l, ''));
  assert.match(h, /Chargement de la saisonnalité…/);
  assert.doesNotMatch(h, /Fort en/);
  // le bloc 7 charge la tranche (même chemin qu'à l'écran) : on fournit la ligne du catalogue et des stats vides
  C.donnees = () => ({ parCip: { [CIP]: l }, mois: [] });
  sb.V2.comptoir.stats = () => ({});
  assert.equal(E.donnees(CIP), null);
  await new Promise((r) => setTimeout(r, 20));
  const es = E.franceSaison(CIP);
  assert.equal(es.moisFort, 3); assert.equal(es.moisFaible, 11);
  assert.equal(es.periode, 'de janvier 2021 à décembre 2025');
  h = sansBalise(C.blocProduit(s, l, ''));
  assert.match(h, /Fort en mars, faible en nov\./);
  assert.match(h, /boîtes remboursées en France \(Medic'AM\), de janvier 2021 à décembre 2025/);
  assert.doesNotMatch(h, /sept\./);
  assert.doesNotMatch(h, /Chargement/);
  // bloc 7 : même mois, même période
  const D = E.donnees(CIP);
  assert.equal(D.saisonPeriode, 'de janvier 2021 à décembre 2025');
  assert.equal(D.saison.indexOf(Math.max.apply(null, D.saison)) + 1, es.moisFort);
  assert.equal(D.saison.indexOf(Math.min.apply(null, D.saison)) + 1, es.moisFaible);
});

test('bloc 6 : sans série France dans l\'étude, repli sur l\'ancienne saisonnalité ; fiche sans statistiques : rien à attendre', async () => {
  const AUTRE = '3400900000199';   // même tranche (99), absent de la tranche
  const sb = bac(TRANCHES), C = sb.V2.comptoir._calc, E = sb.V2.etude;
  const l = { cip: AUTRE, d: 'SANS SERIE' };
  C.donnees = () => ({ parCip: { [AUTRE]: l }, mois: [] });
  sb.V2.comptoir.stats = () => ({});
  const s = { autres: { froid: false }, generique: null, tendance: { saison: C.saisonDe([0.5, 1, 1, 1, 1, 1, 1, 1, 1.5, 1, 1, 1]) } };
  E.donnees(AUTRE); await new Promise((r) => setTimeout(r, 20));
  assert.equal(E.franceSaison(AUTRE), null);
  const h = sansBalise(C.blocProduit(s, l, ''));
  assert.match(h, /Fort en sept\., faible en janv\./);
  assert.match(h, /ventes France, indices du produit/);
  // la fiche de secours (statistiques absentes) ne construit pas le bloc 7 : pas de « Chargement » qui ne finirait jamais
  const sb2 = bac(TRANCHES);
  const h2 = sansBalise(sb2.V2.comptoir._calc.blocProduit({ autres: { froid: false }, generique: null, tendance: null, sansEtude: true }, { cip: CIP, d: 'X' }, ''));
  assert.doesNotMatch(h2, /Chargement|Saisonnalité/);
});
