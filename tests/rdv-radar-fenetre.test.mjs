/* rdv-radar-fenetre.test.mjs — sur quelle fenêtre le radar « Qui inviter »
 * mesure-t-il une baisse d'achats ?
 *
 * ⚠️ LE DÉFAUT CORRIGÉ LE 24/08/2026. Cet écran ne montre QUE les officines du
 * commercial connecté, mais il prenait sa fenêtre de comparaison sur le total
 * RÉSEAU. Or les fichiers de ventes ne s'arrêtent pas au même mois selon le
 * commercial : ceux dont le fichier s'arrête plus tôt n'avaient aucune vente
 * dans la fenêtre « récente », et leurs officines ressortaient toutes en chute.
 * Mesuré avant correction : 60 % et 54 % des officines de deux secteurs
 * annoncées « en forte baisse », contre 18 à 26 % ailleurs.
 *
 * Un signal faux est pire qu'un signal absent, parce qu'on le croit.
 *
 * Ce fichier extrait `achats()` du fichier livré — pas une copie — et le fait
 * tourner sur les vraies ventes du dépôt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

// ── Les vraies ventes ──────────────────────────────────────────────────────
const bac = { window: {}, console };
vm.createContext(bac);
const charger = (f) => vm.runInContext(lire(f), bac, { filename: f });
charger('wml-officines-data.js');
for (let i = 1; i <= 10; i++) charger(`wml-ventes-${String(i).padStart(2, '0')}.js`);
const W = bac.window, dO = W.WML_D_OFFICINES, dC = W.WML_D_COMMERCIAUX;
const VENTES = W.WML_SALES.map((s) => ({
  pharmacyId: String(dO[s[0]]), month: s[1], year: 2026,
  commercial: dC[s[2]] || '', mntNetHt: s[6] || 0,
}));
const OFFICINES = W.WML_OFFICINES;

// ── `achats()` extrait du fichier livré ────────────────────────────────────
const SRC = lire('v2-rdv-radar.js');
function extraire(nom) {
  const i = SRC.indexOf(`function ${nom}(`);
  assert.ok(i > 0, `fonction ${nom} introuvable dans v2-rdv-radar.js`);
  let p = 0, j = SRC.indexOf('{', i);
  for (; j < SRC.length; j++) {
    if (SRC[j] === '{') p++;
    else if (SRC[j] === '}') { p--; if (p === 0) break; }
  }
  return SRC.slice(i, j + 1);
}
const CODE = extraire('achats');

function achatsPour(commercial) {
  const bac2 = {
    V2: { sales: VENTES, user: { commercial } },
    moi: () => commercial || '',
    nomMois: (k) => 'M' + k,
    console,
  };
  vm.createContext(bac2);
  vm.runInContext(CODE + '\nachats();', bac2);
  return vm.runInContext('achats()', bac2);
}

const COMMERCIAUX = [...new Set(VENTES.map((v) => v.commercial))].filter(Boolean).sort();
const moisDe = {};
for (const v of VENTES) {
  moisDe[v.commercial] = moisDe[v.commercial] || new Set();
  moisDe[v.commercial].add(v.month);
}

test('les donnees portent bien des fichiers de longueurs DIFFERENTES', () => {
  const tailles = new Set(COMMERCIAUX.map((c) => moisDe[c].size));
  assert.ok(tailles.size > 1,
    `tous les secteurs couvrent ${[...tailles][0]} mois : ce test ne prouve plus rien`);
});

test('la fenetre suit le fichier DU COMMERCIAL, pas celui du reseau', () => {
  // Le code doit lire les ventes de `moi()`, pas V2.sales en entier.
  assert.ok(/var moiC = moi\(\)/.test(SRC), 'achats() n interroge plus le commercial connecte');
  assert.ok(/toutes\.filter\(function \(v\) \{ return v\.commercial === moiC/.test(SRC),
    'la fenetre se calcule encore sur le reseau entier');
});

test('un secteur dont le fichier est trop court ne recoit AUCUN signal de baisse', () => {
  const courts = COMMERCIAUX.filter((c) => moisDe[c].size < 6);
  assert.ok(courts.length, 'aucun secteur au fichier court : le cas n est pas represente');
  for (const c of courts) {
    const r = achatsPour(c);
    assert.equal(r.comparable, false,
      `${c} n a que ${moisDe[c].size} mois et recoit pourtant un signal de baisse`);
  }
});

test('un secteur dont le fichier est complet garde son signal', () => {
  const longs = COMMERCIAUX.filter((c) => moisDe[c].size >= 6);
  assert.ok(longs.length, 'aucun secteur au fichier complet');
  for (const c of longs) {
    const r = achatsPour(c);
    assert.equal(r.comparable, true, `${c} couvre ${moisDe[c].size} mois et perd son signal`);
  }
});

test('la fenetre recente est bien COUVERTE par le fichier du commercial', () => {
  // C est le coeur du defaut : la fenetre « recente » tombait sur des mois ou
  // le commercial n avait plus aucune ligne.
  for (const c of COMMERCIAUX) {
    const r = achatsPour(c);
    if (!r.comparable) continue;
    const siennes = new Set(OFFICINES.filter((p) => (p.comms || []).indexOf(c) >= 0).map((p) => String(p.id)));
    let avecRecent = 0, avecAvant = 0;
    for (const id of siennes) {
      const a = r.par[id]; if (!a) continue;
      if (a.recent > 0) avecRecent++;
      if (a.avant > 0) avecAvant++;
    }
    assert.ok(avecAvant > 0, `${c} : aucune officine n a de ventes dans la fenetre precedente`);
    assert.ok(avecRecent / avecAvant > 0.5,
      `${c} : seulement ${avecRecent} officines sur ${avecAvant} ont des ventes dans la fenetre RECENTE — `
      + 'la fenetre tombe hors de son fichier, toutes ressortiraient en baisse');
  }
});

test('plus de secteur ou la moitie des officines « decroche » d un coup', () => {
  // Un taux de baisse qui explose sur un secteur et pas les autres, c est un
  // artefact de fichier, jamais un fait commercial.
  const taux = [];
  for (const c of COMMERCIAUX) {
    const r = achatsPour(c);
    if (!r.comparable) continue;
    const siennes = OFFICINES.filter((p) => (p.comms || []).indexOf(c) >= 0).map((p) => String(p.id));
    let n = 0, tot = 0;
    for (const id of siennes) {
      const a = r.par[id]; if (!a || a.avant < 500) continue;
      tot++; if ((a.avant - a.recent) / a.avant >= 0.25) n++;
    }
    if (tot >= 20) taux.push({ c, pct: n / tot });
  }
  assert.ok(taux.length >= 3, 'trop peu de secteurs mesurables');
  for (const t of taux) {
    assert.ok(t.pct < 0.45,
      `${t.c} : ${Math.round(t.pct * 100)} % de ses officines annoncees en baisse — `
      + 'au-dela de 45 %, c est le fichier qui parle, pas le terrain');
  }
});

test('le chiffre d affaires affiche reste celui de l officine, tous commerciaux confondus', () => {
  // La fenetre se restreint au commercial ; le total, lui, ne doit pas changer
  // de sens — 5 officines sur 702 sont couvertes par deux commerciaux.
  const partages = OFFICINES.filter((p) => (p.comms || []).length > 1);
  assert.ok(partages.length, 'aucune officine partagee : le cas n est pas represente');
  const p = partages[0], c = p.comms[0];
  const r = achatsPour(c);
  let attendu = 0;
  for (const v of VENTES) if (v.pharmacyId === String(p.id)) attendu += v.mntNetHt;
  assert.ok(Math.abs(r.par[String(p.id)].total - attendu) < 0.01,
    `le total de ${p.name} vaut ${r.par[String(p.id)].total} au lieu de ${attendu} : `
    + 'il ne compte plus que la part du commercial connecte');
});
