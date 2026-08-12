// position-marche.test.mjs — la vue macro « Besoins & offre » dit-elle vrai ?
//
// Extrait les VRAIES fonctions du fichier livré (pas une copie) et les fait tourner sur
// les VRAIES données du dépôt. Deux pièges déjà payés sur ce projet sont testés ici :
//   · confondre part du MARCHÉ (boîtes) et part du PARC (officines) — le rapport des deux
//     est le seul chiffre qui dise « 1 boîte sur N », et il varie du simple au quadruple
//     selon le dénominateur choisi ;
//   · un plafond d'AFFICHAGE qui devient un plafond de COMPTAGE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const V2 = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(V2, f), 'utf8');

// ── charge les données réelles dans un faux `window` ────────────────────────
const win = {};
function charge(fichier) {
  const src = lire(fichier);
  new Function('window', src)(win);
}
charge('prod-stats-data.js');
charge('pharma-fr-data.js');
const NAT = JSON.parse(lire('national.json'));

// ── extrait positionMarche() du fichier livré ───────────────────────────────
const appro = lire('v2-appro.js');
function extraire(nom) {
  const i = appro.indexOf(`function ${nom}(`);
  assert.ok(i > 0, `fonction ${nom} introuvable dans v2-appro.js`);
  let p = 0, j = appro.indexOf('{', i);
  const debut = j;
  for (; j < appro.length; j++) {
    if (appro[j] === '{') p++;
    else if (appro[j] === '}') { p--; if (p === 0) break; }
  }
  return appro.slice(i, j + 1);
}

// cipIndex est lourd (stock, ventes, saison) : on le remplace par un index construit
// des mêmes PROD_STATS, avec la même clé (cip13) et le même champ (vM = vente/mois).
const PS = win.PROD_STATS;
const idx = {};
for (const p of PS) {
  const an = (p.rota || 0) * (p.n || 0);
  if (p.c && an > 0) idx[String(p.c)] = { c: String(p.c), d: p.d, vM: an / 12, st: 0 };
}

// ⚠️ Embarquer AUSSI les constantes déclarées hors fonction. Sans ça un seuil vaut
// `undefined`, et selon la comparaison le test explose — ou pire, passe pour la mauvaise
// raison. Piège déjà payé sur ce dépôt (test t4, 01/08/2026). On les EXTRAIT du fichier
// livré : recopier la valeur ici ferait mentir le test le jour où elle change.
function constante(nom) {
  const m = appro.match(new RegExp('var\\s+' + nom + '\\s*=\\s*([^;]+);'));
  assert.ok(m, `constante ${nom} introuvable dans v2-appro.js`);
  return `var ${nom} = ${m[1]};`;
}
const SEUIL_MARCHE = Number(constante('MARCHE_MINI').match(/=\s*(\d+)/)[1]);

// Les dépendances de positionMarche() vivent au même niveau : on les embarque toutes,
// extraites du fichier livré. Ajouter un helper sans l'ajouter ici fait échouer le test
// bruyamment (c'est voulu) plutôt que de le laisser passer sur du code partiel.
const CONTEXTE = constante('MARCHE_MINI') + extraire('cleDci');

const PARC = JSON.parse(lire('parc-officines.json'));
const positionMarche = new Function('_natData', 'cipIndex', 'window', '_parcData',
  CONTEXTE + extraire('positionMarche') + '; return positionMarche;')(NAT, () => idx, win, PARC);

test('le périmètre commun est réel, pas le catalogue entier', () => {
  const p = positionMarche();
  assert.ok(p, 'positionMarche() ne doit pas rendre null sur les vraies données');
  assert.ok(p.nCommun > 3000, `périmètre trop petit : ${p.nCommun}`);
  assert.ok(p.nCommun < p.nCatalogue, 'le périmètre commun doit être PLUS PETIT que le catalogue');
});

test('la part de marché est cohérente avec la mesure du 12/08/2026 (~0,26 %)', () => {
  const p = positionMarche();
  assert.ok(p.part > 0.001 && p.part < 0.01, `part hors bornes plausibles : ${(p.part * 100).toFixed(3)} %`);
});

test('part du MARCHÉ et part du PARC ne sont pas le même chiffre', () => {
  const p = positionMarche();
  assert.ok(p.parc, 'le parc officinal doit être lu depuis PHARMA_FR');
  assert.ok(p.parc.clients > 0 && p.parc.fr > p.parc.clients);
  // le piège : si les deux étaient confondus, le taux de couverture vaudrait 1
  const taux = p.part / p.parc.partParc;
  assert.ok(taux > 0.005 && taux < 0.5,
    `taux de couverture invraisemblable (${taux}) — signe d'une confusion des deux parts`);
});

test('« fort » et « faible » se jugent par rapport à NOTRE moyenne', () => {
  const p = positionMarche();
  for (const f of p.forts) assert.ok(f.part >= p.part * 3, `${f.dci} classé fort à tort`);
  for (const f of p.faibles) assert.ok(f.part <= p.part / 3, `${f.dci} classé faible à tort`);
});

test('un fort pourcentage sur un marché minuscule ne compte pas comme une position', () => {
  const p = positionMarche();
  // 56 % d'un marché de 3 000 boîtes/an (atovaquone) n'apprend rien et chassait les
  // vraies positions de la liste : on exige une taille de marché réelle.
  for (const f of p.forts) {
    assert.ok(f.marche >= SEUIL_MARCHE, `${f.dci} : marché de ${f.marche} b/an, sous le seuil de ${SEUIL_MARCHE}`);
  }
  // et le tri se fait sur ce qu'on y vend vraiment, pas sur le pourcentage
  for (let i = 1; i < p.forts.length; i++) {
    assert.ok(p.forts[i - 1].nous >= p.forts[i].nous, 'tri par notre volume attendu');
  }
});

test('les gros marchés où on est absent sont triés par ENJEU, pas par faiblesse', () => {
  const p = positionMarche();
  for (let i = 1; i < p.faibles.length; i++) {
    assert.ok(p.faibles[i - 1].marche >= p.faibles[i].marche, 'tri par volume France attendu');
  }
});

test('aucun plafond de comptage : les listes ne sont pas tronquées à la source', () => {
  const p = positionMarche();
  // l'affichage coupe à 6 ; le calcul, lui, doit tout garder
  assert.ok(p.forts.length + p.faibles.length > 12,
    'les listes semblent déjà tronquées dans positionMarche() — la troncature doit rester à l’affichage');
  assert.ok(p.nFam > 500, `trop peu de molécules analysées : ${p.nFam}`);
});

test('un produit hors modèle national ne compte ni au numérateur ni au dénominateur', () => {
  const p = positionMarche();
  const inconnus = Object.keys(idx).filter((c) => !NAT.data[c]).length;
  assert.ok(inconnus > 0, 'le test perdrait son sens sans produit hors modèle');
  assert.equal(p.nCommun + inconnus <= p.nCatalogue, true);
});
