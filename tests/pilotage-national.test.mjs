/* pilotage-national.test.mjs — le Pilotage dit-il vrai sur le national ?
 *
 * Rend l'ÉCRAN RÉEL (v2-pilotage.js, pas une copie) sur les VRAIES ventes du
 * dépôt. Trois pièges déjà payés sur ce projet sont verrouillés ici :
 *
 *  · LE MOIS TRONQUÉ. Le fichier de ventes s'arrête en cours de mois : le
 *    19/08/2026, juillet pesait 13 % d'un mois normal. Toute fenêtre qui
 *    l'englobe fabrique une baisse chez TOUT LE MONDE. Un signal faux est pire
 *    qu'un signal absent — on le croit.
 *  · DEUX « NATIONAL » DIFFÉRENTS. Le réseau Intégral (tranches de prix,
 *    abandon de marge) et le marché France (Medic'AM, boîtes remboursées) ne
 *    doivent jamais se retrouver dans le même chiffre.
 *  · UNE BORNE PRISE POUR UNE MESURE. generate_tendance.py plafonne à +300 et
 *    −95 : les afficher comme des mesures exactes serait mentir.
 *
 * Et l'outil de mesure se teste d'abord sur un cas dont on connaît déjà la
 * réponse : le dernier bloc injecte des valeurs choisies à la main.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

// Les modules de l'app parlent à `document`, `requestAnimationFrame` et
// `IntersectionObserver` SANS les préfixer de `window.` : il faut donc les leur
// passer nommément, sinon le fichier livré s'exécute dans un monde où ils
// n'existent pas — et le test échoue pour une raison qui n'est pas la sienne.
function executer(src, win) {
  new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', src)(
    win, win.document, win.requestAnimationFrame, win.IntersectionObserver, win.matchMedia, win.ICO || (() => '')
  );
}

// ── Un faux navigateur, juste assez pour que l'écran se rende ──────────────
function faireFenetre() {
  const styles = {};
  const noeud = () => ({
    style: { setProperty() {}, width: '' }, dataset: {}, classList: { add() {}, contains: () => false },
    innerHTML: '', textContent: '', id: '',
    querySelectorAll: () => [], querySelector: () => null, appendChild() {},
  });
  const win = {
    console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; },
    clearTimeout() {},
    requestAnimationFrame() { return 0; },          // pas d'animation : on teste le HTML
    matchMedia: () => ({ matches: true }),          // « mouvement réduit » = chemin sans observer
    document: {
      getElementById: (id) => styles[id] || null,
      createElement: () => { const n = noeud(); return n; },
      head: { appendChild(el) { if (el && el.id) styles[el.id] = el; } },
      body: { appendChild() {} },
      addEventListener() {},
    },
  };
  win.window = win;
  win.globalThis = win;
  return win;
}

const win = faireFenetre();
win.ICO = () => '';
// données réelles du dépôt
for (const f of ['prod-stats-data.js', 'ameli-avg-data.js', 'ppht-data.js', 'tendance-data.js', 'stock-data.js',
                 'wml-officines-data.js',
                 ...Array.from({ length: 10 }, (_, i) => `wml-ventes-${String(i + 1).padStart(2, '0')}.js`)]) {
  executer(lire(f), win);
}

// ── Les ventes, remises dans la forme que l'app leur donne au démarrage ────
// (même décodage que V2.loadData dans v2-boot.js : rangs → valeurs)
const dOff = win.WML_D_OFFICINES, dCom = win.WML_D_COMMERCIAUX, dPro = win.WML_D_PRODUITS;
const VENTES = win.WML_SALES.map((s) => ({
  pharmacyId: String(dOff[s[0]]), month: s[1], year: 2026, commercial: dCom[s[2]] || '',
  artCode: String(dPro[s[3]]), artFamille: null, qte: s[4] || 0, puNet: s[5] || 0, mntNetHt: s[6] || 0,
}));
const OFFICINES = win.WML_OFFICINES.map((p) => ({ id: String(p.id), name: p.name, groupement: p.groupement }));

// ── Le V2 minimal dont l'écran a besoin ───────────────────────────────────
const fmtNum = (n) => String(Math.round(n) || 0);
const V2 = win.V2 = {
  pages: {}, user: null, pharmacies: OFFICINES, sales: VENTES, commFilter: '',
  commSales() { return V2.commFilter ? V2.sales.filter((s) => s.commercial === V2.commFilter) : V2.sales; },
  commercials() { const s = {}; V2.sales.forEach((x) => { if (x.commercial) s[x.commercial] = 1; }); return Object.keys(s).sort(); },
  esc: (s) => String(s == null ? '' : s),
  sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
  fmtEur: (n) => (isFinite(n) ? fmtNum(n) + ' €' : '—'),
  fmtNum, fmtK: fmtNum,
  margeMDLboite: (p) => (p > 0 ? p * 0.05 : 0),
  tint: () => 'var(--muted)',
  topbar: () => '', go() {}, render() {},
};
executer(lire('v2-pilotage.js'), win);

function rendre(commercial) {
  V2.commFilter = commercial || '';
  V2._piloScopedInit = false;
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  V2.pages.pilotage.render(root);
  return root.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Quels mois sont vraiment comparables ?
// ═══════════════════════════════════════════════════════════════════════════
const parMois = {}, sectParMois = {};
for (const v of VENTES) {
  parMois[v.month] = (parMois[v.month] || 0) + v.mntNetHt;
  (sectParMois[v.month] = sectParMois[v.month] || new Set()).add(v.commercial);
}
const moisTries = Object.keys(parMois).map(Number).sort((a, b) => a - b);
// Le secteur testé se DÉDUIT des ventes : celui dont le fichier va le plus loin.
// Le nommer en dur casserait ce test au prochain export — et écrirait un nom
// de personne dans un dépôt public.
const dernierMoisDe = {};
for (const v of VENTES) {
  dernierMoisDe[v.commercial] = Math.max(dernierMoisDe[v.commercial] || 0, v.month);
}
const SECTEUR = Object.keys(dernierMoisDe).sort((a, b) => dernierMoisDe[b] - dernierMoisDe[a])[0];
const nbSectMax = Math.max(...moisTries.map((m) => sectParMois[m].size));
// dernier mois ou TOUS les secteurs sont presents
const moisReseau = moisTries.slice();
while (moisReseau.length > 1 && sectParMois[moisReseau[moisReseau.length - 1]].size < nbSectMax) moisReseau.pop();
const ancreReseau = moisReseau[moisReseau.length - 1];

test('les fichiers de ventes s arretent bien a des mois DIFFERENTS selon le commercial', () => {
  // Sans cette asymetrie dans les donnees, tout ce fichier ne prouve rien.
  const tailles = moisTries.map((m) => sectParMois[m].size);
  assert.ok(new Set(tailles).size > 1,
    `tous les mois portent ${tailles[0]} secteurs : plus d asymetrie, ce garde-fou n est plus eprouve`);
  assert.ok(ancreReseau < moisTries[moisTries.length - 1],
    'le dernier mois du fichier porte deja tous les secteurs');
});

test('vue reseau : les mois amputes sont ecartes, et l ecran DIT pourquoi', () => {
  const h = rendre('');
  assert.ok(/pilo-ecarte/.test(h), 'aucune mention des mois ecartes');
  assert.ok(/tous les secteurs n.y sont pas encore/.test(h), 'la raison de l ecart n est pas dite');
  // les mois ecartes doivent etre nommes
  for (const m of moisTries.filter((m) => m > ancreReseau)) {
    const nom = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][m - 1];
    assert.ok(h.includes(nom + ' 2026'), `le mois ${nom} n est pas nomme dans la phrase d ecart`);
  }
});

test('vue commercial : son dernier mois n est PAS confisque', () => {
  // Juillet est un mois PLEIN pour Will (son meilleur). Un garde-fou reseau
  // le lui aurait cache : c est le piege que ce test verrouille.
  const moisWill = [...new Set(VENTES.filter((v) => v.commercial === SECTEUR).map((v) => v.month))].sort((a, b) => a - b);
  const sonDernier = moisWill[moisWill.length - 1];
  assert.ok(sonDernier > ancreReseau, 'aucun secteur ne va plus loin que le reseau : le cas n est pas represente');
  const h = rendre(SECTEUR);
  const nom = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'][sonDernier - 1];
  const sousTitre = (h.match(/class="v2-page-sub"[^>]*>([^<]*)</) || [])[1] || '';
  assert.ok(sousTitre.startsWith(nom + ' 2026'),
    `periode affichee « ${sousTitre} » : son dernier mois (${nom}) lui a ete confisque`);
  assert.ok(!/pilo-ecarte/.test(h), 'un mois lui est écarté alors que son fichier est complet');
});

test('une periode de comparaison incomplete ne produit AUCUN pourcentage', () => {
  // Le fichier demarre en janvier : la fenetre « 3 mois precedents » deborde
  // avant. Comparer 3 mois a 2 fabriquerait un ecart qui n existe pas.
  const src = lire('v2-pilotage.js');
  assert.ok(/prevComplet: couvert\(pStart, pEnd\)/.test(src),
    'la fenetre precedente n est plus verifiee');
  assert.ok(/if \(complet === false\)/.test(src),
    'deltaHtml ne refuse plus de calculer sur une periode incomplete');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Se comparer au reseau — le repere est-il le VRAI reseau ?
// ═══════════════════════════════════════════════════════════════════════════
const tranche = (pu) => (pu < 4.33 ? 0 : pu < 468 ? 1 : pu < 2000 ? 2 : 3);

test('sans filtre commercial, aucun repere reseau — il n y a rien a comparer', () => {
  const h = rendre('');
  assert.ok(!/pilo-ref/.test(h), 'un repere reseau s affiche alors qu on REGARDE deja le reseau');
});

test('avec un commercial, chaque tranche porte le repere du reseau', () => {
  const h = rendre(SECTEUR);
  const reperes = (h.match(/class="pilo-ref"/g) || []).length;
  assert.ok(reperes >= 4, `seulement ${reperes} reperes : les 4 tranches ne sont pas couvertes`);
});

test('le repere vaut bien la repartition RESEAU, recalculee a part', () => {
  const h = rendre(SECTEUR);
  // Le repere porte sur les mois ou le reseau est AU COMPLET, pas sur la
  // periode affichee : en juillet, deux secteurs sur huit seulement ont des
  // ventes, s y comparer reviendrait a se comparer a soi-meme.
  const res = [0, 0, 0, 0];
  for (const v of VENTES) if (v.month <= ancreReseau) res[tranche(v.puNet)] += v.mntNetHt;
  const tot = res.reduce((a, b) => a + b, 0);
  const attendus = res.map((v) => (v / tot * 100).toFixed(1));
  const poses = [...h.matchAll(/class="pilo-ref" style="left:([\d.]+)%"/g)].map((m) => m[1]);
  for (const a of attendus) {
    assert.ok(poses.includes(a), `repere ${a} % absent — poses : ${poses.join(', ')}`);
  }
  // et l ecran dit sur quoi porte ce repere
  assert.ok(new RegExp('les ' + nbSectMax + ' secteurs réunis').test(h),
    'l ecran ne dit pas combien de secteurs le repere couvre');
});

test('l ecart en euros se lit bien comme une repartition, pas comme une promesse', () => {
  const h = rendre(SECTEUR);
  assert.ok(/à chiffre d.affaires identique/.test(h),
    'la legende ne dit pas que le montant est un ecart de repartition a CA constant');
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Le marche France
// ═══════════════════════════════════════════════════════════════════════════
const PS = win.PROD_STATS, TEND = win.TENDANCE.data, POIDS = win.AMELI_AVG.data;
const estPrinceps = (f) => f === 'pr_low' || f === 'pr_mid' || f === 'pr_high';

test('le bloc marche France est bien la, et se dit Medic AM', () => {
  const h = rendre(SECTEUR);
  assert.ok(/pilo-mf-grid/.test(h), 'le bloc marche France ne se rend pas');
  assert.ok(/Medic'AM/.test(h), 'la source n est pas nommee');
  assert.ok(/Boîtes remboursées en ville/.test(h), 'la nature de la donnee n est pas dite');
});

test('aucun generique dans la liste : un ±95 % y est un changement de generiqueur', () => {
  const h = rendre(SECTEUR);
  const noms = [...h.matchAll(/class="pilo-mf-nom">([^<]+)</g)].map((m) => m[1]);
  assert.ok(noms.length >= 8, `seulement ${noms.length} produits listes`);
  const parNom = {};
  for (const r of PS) parNom[r.d] = r.f;
  for (const n of noms) {
    assert.ok(estPrinceps(parNom[n]), `« ${n} » n est pas un princeps (famille ${parNom[n]})`);
  }
});

test('aucun « petit truc » : tout produit liste pese au-dessus du plancher', () => {
  const h = rendre(SECTEUR);
  const noms = [...h.matchAll(/class="pilo-mf-nom">([^<]+)</g)].map((m) => m[1]);
  const cipParNom = {};
  for (const r of PS) cipParNom[r.d] = String(r.c);
  for (const n of noms) {
    const p = POIDS[cipParNom[n]];
    assert.ok(p >= 150, `« ${n} » ne pese que ${p} boites/pharmacie/an`);
  }
});

test('le classement suit le POIDS x l AMPLEUR, pas le pourcentage', () => {
  const h = rendre(SECTEUR);
  // Premiere colonne = hausses. Le premier de la liste doit maximiser poids x |%|.
  const bloc = h.slice(h.indexOf('pilo-mf-grid'));
  const noms = [...bloc.matchAll(/class="pilo-mf-nom">([^<]+)</g)].map((m) => m[1]);
  const cipParNom = {}; for (const r of PS) cipParNom[r.d] = String(r.c);
  const score = (n) => POIDS[cipParNom[n]] * Math.abs(TEND[cipParNom[n]]);
  // les 8 premiers noms = colonne hausse, dans l ordre
  const huit = noms.slice(0, 8).map(score);
  for (let i = 1; i < huit.length; i++) {
    assert.ok(huit[i] <= huit[i - 1], `classement casse a la position ${i + 1}`);
  }
});

test('« toi : tu n en vends pas » ne s ecrit que si c est vrai', () => {
  const h = rendre(SECTEUR);
  const lignes = [...h.matchAll(/pilo-mf-nom">([^<]+)<[\s\S]*?pilo-mf-moi mono">([\s\S]*?)<\/span>/g)];
  const cipParNom = {}; for (const r of PS) cipParNom[r.d] = String(r.c);
  const vendu = {};
  const moisWill = [...new Set(VENTES.filter((v) => v.commercial === SECTEUR).map((v) => v.month))].sort((a, b) => a - b);
  const sonDernier = moisWill[moisWill.length - 1];
  for (const v of VENTES) if (v.commercial === SECTEUR && v.month === sonDernier) vendu[v.artCode] = true;
  let verifiees = 0;
  for (const [, nom, bloc] of lignes) {
    const dit = /tu n.en vends pas/.test(bloc);
    assert.equal(dit, !vendu[cipParNom[nom]], `« ${nom} » : l ecran dit le contraire des ventes`);
    verifiees++;
  }
  assert.ok(verifiees >= 8, `seulement ${verifiees} lignes verifiees`);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. L outil de mesure, sur un cas dont on connait deja la reponse
// ═══════════════════════════════════════════════════════════════════════════
test('une valeur BORNEE par le generateur ne s affiche jamais comme une mesure', () => {
  // generate_tendance.py plafonne a +300 et -95. On fabrique les deux cas.
  const bac = faireFenetre();
  bac.PROD_STATS = [
    { c: '1111111111111', d: 'TEST PLAFOND HAUT', n: 100, f: 'pr_mid', ppht: 10, net: 9 },
    { c: '2222222222222', d: 'TEST PLAFOND BAS', n: 100, f: 'pr_mid', ppht: 10, net: 9 },
    { c: '3333333333333', d: 'TEST MESURE EXACTE', n: 100, f: 'pr_mid', ppht: 10, net: 9 },
    { c: '4444444444444', d: 'TEST TROP LEGER', n: 100, f: 'pr_mid', ppht: 10, net: 9 },
    { c: '5555555555555', d: 'TEST GENERIQUE', n: 100, f: 'gen', ppht: 10, net: 9 },
  ];
  bac.TENDANCE = { meta: { mois: '01/02' }, data: { 1111111111111: 300, 2222222222222: -95, 3333333333333: 42, 4444444444444: 300, 5555555555555: -95 } };
  bac.AMELI_AVG = { meta: { periode: '2025-06→2026-05' }, data: { 1111111111111: 1000, 2222222222222: 1000, 3333333333333: 1000, 4444444444444: 149, 5555555555555: 9000 } };
  bac.STOCK_IP = { meta: {}, data: {} };
  bac.ICO = () => '';
  const v2 = bac.V2 = {
    pages: {}, user: null, commFilter: '',
    pharmacies: [{ id: 'p1', name: 'Test', groupement: 'X' }],
    sales: [{ pharmacyId: 'p1', month: 1, year: 2026, commercial: 'Moi', artCode: '3333333333333', qte: 1, puNet: 10, mntNetHt: 10 }],
    commSales() { return v2.sales; }, commercials() { return ['Moi']; },
    esc: (s) => String(s == null ? '' : s),
    sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
    fmtEur: (n) => String(Math.round(n)) + ' €', fmtNum: (n) => String(Math.round(n)), fmtK: (n) => String(n),
    margeMDLboite: () => 0, tint: () => '', topbar: () => '', go() {}, render() {},
  };
  executer(lire('v2-pilotage.js'), bac);
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  v2.pages.pilotage.render(root);
  const h = root.innerHTML;

  assert.ok(/≥ \+300 %/.test(h), 'le plafond haut s affiche comme une mesure exacte');
  assert.ok(/≤ −95 %/.test(h), 'le plancher bas s affiche comme une mesure exacte');
  assert.ok(/\+42 %/.test(h), 'une vraie mesure a ete transformee en borne');
  assert.ok(!/TEST TROP LEGER/.test(h), 'un produit sous le plancher de poids est passe');
  assert.ok(!/TEST GENERIQUE/.test(h), 'un generique est passe malgre la regle princeps');
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Mes produits — la matrice secteur × catégorie de prix
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ Lecteur de nombres à la française. `fmtEur` sépare les milliers par une
// espace fine insécable (U+202F). Une première version de ce contrôle lisait
// « 6 994,38 € » comme 994 et dénonçait 29 fausses incohérences : l'outil de
// mesure se teste AVANT de mesurer, sur des cas dont on connaît la réponse.
const lireEuro = (t) => parseFloat(String(t).replace(/[\s   ]/g, '').replace(',', '.'));

test('le lecteur de nombres du test lit juste — sinon tout ce qui suit ment', () => {
  for (const [txt, attendu] of [['6 994,38', 6994.38], ['1 065', 1065], ['0,78', 0.78], ['65 129', 65129]]) {
    assert.ok(Math.abs(lireEuro(txt) - attendu) < 0.001, `« ${txt} » lu ${lireEuro(txt)} au lieu de ${attendu}`);
  }
});

test('le comparatif porte bien TROIS lignes : moi, les autres, la France', () => {
  const h = rendre(SECTEUR);
  const noms = [...h.matchAll(/class="pilo-cmp-hn">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(noms, ['Mon secteur', 'Les autres secteurs', 'La France'],
    `lignes du comparatif : ${noms.join(' · ')}`);
});

test('vue reseau : le reseau face a la France, sans ligne « les autres »', () => {
  const h = rendre('');
  const noms = [...h.matchAll(/class="pilo-cmp-hn">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(noms, ['Le réseau Intégral', 'La France'],
    `lignes du comparatif : ${noms.join(' · ')}`);
});

test('les trois lignes comptent le MEME univers de produits', () => {
  // C est le coeur de l honnetete du bloc : Medic AM ne connait que le
  // remboursable. Comparer tout mon chiffre a un marche qui ignore les NR
  // fabriquerait un ecart entierement du a la difference de perimetre.
  const h = rendre(SECTEUR);
  assert.ok(/comptent les <b>mêmes produits<\/b>/.test(h), 'la note ne dit pas que l univers est commun');
  assert.ok(/Medic'AM suit/.test(h), 'la definition de l univers n est pas donnee');
  assert.ok(/% du chiffre|% de ton chiffre/.test(h), 'la part du CA couverte n est pas chiffree');
});

test('la ligne France DISPARAIT des qu on repasse en vue complete', () => {
  // Elle ne serait plus comparable : on la retire au lieu de la laisser mentir.
  const src = lire('v2-pilotage.js');
  assert.ok(/if \(comparable\) \{\s*lignes\.push\(\{\s*cle: 'france'/.test(src.replace(/\n\s*/g, ' ')),
    'la ligne France n est plus conditionnee a la base comparable');
  assert.ok(/La ligne France disparaît/.test(src), 'rien n explique la disparition de la ligne France');
});

test('la France se calcule sur Medic AM valorise au tarif grossiste', () => {
  const h = rendre(SECTEUR);
  const parts = [...h.matchAll(/class="pilo-cmp-r fr"[\s\S]*?$/g)];
  assert.ok(/marché remboursable · Medic'AM/.test(h), 'la source de la ligne France n est pas dite');
  // recalcul independant de la repartition France
  const A = win.AMELI_AVG.data, P = win.PPHT;
  assert.ok(P && Object.keys(P).length, 'window.PPHT absent : la ligne France ne peut pas etre verifiee');
  const base = (win.AMELI_AVG.meta && win.AMELI_AVG.meta.base) || 20000;
  const t = [0, 0, 0, 0];
  const tr = (pu) => (pu < 4.33 ? 0 : pu < 468 ? 1 : pu < 2000 ? 2 : 3);
  for (const c in A) { const pp = P[c]; if (pp > 0) t[tr(pp)] += A[c] * base * pp; }
  const tot = t.reduce((a, b) => a + b, 0);
  const attendus = t.map((v) => (v / tot * 100).toFixed(1).replace('.', ','));
  const bloc = h.slice(h.indexOf('pilo-cmp-r fr'));
  for (const a of attendus) {
    assert.ok(bloc.includes(a + ' %'), `part France ${a} % absente de la ligne — attendues : ${attendus.join(' / ')}`);
  }
});

test('mes lignes comptent le MEME univers que la France — recalcul independant', () => {
  // ⚠️ Le piege que ce test verrouille : laisser les lignes Integral compter
  // TOUT le chiffre d affaires (NR et parapharmacie comprises) face a un
  // marche France qui ne connait que le remboursable. L ecart affiche serait
  // alors entierement fabrique par la difference de perimetre.
  const h = rendre(SECTEUR);
  const A = win.AMELI_AVG.data;
  const tr = (pu) => (pu < 4.33 ? 0 : pu < 468 ? 1 : pu < 2000 ? 2 : 3);
  const fenetre = new Set(moisReseau);
  const t = [0, 0, 0, 0];
  for (const v of VENTES) {
    if (v.commercial !== SECTEUR) continue;
    if (!fenetre.has(v.month)) continue;
    if (!(A[v.artCode] > 0)) continue;            // univers Medic AM
    t[tr(v.puNet)] += v.mntNetHt;
  }
  const tot = t.reduce((a, b) => a + b, 0);
  assert.ok(tot > 0, 'aucune vente retenue : le test ne prouve rien');
  const attendus = t.map((v) => (v / tot * 100).toFixed(1).replace('.', ','));
  // on ne lit QUE la ligne « Mon secteur »
  const debut = h.indexOf('Mon secteur');
  const bloc = h.slice(debut, h.indexOf('Les autres secteurs'));
  for (const a of attendus) {
    assert.ok(bloc.includes('>' + a + ' %<'),
      `part ${a} % absente de « Mon secteur » — attendues : ${attendus.join(' / ')} ; `
      + 'les lignes Integral ne comptent pas le meme univers que la France');
  }
});

test('les categories de prix sont cliquables, et elles seules', () => {
  const h = rendre(SECTEUR);
  const cols = [...h.matchAll(/class="pilo-cmp-ch[^"]*" data-t="(\d)"/g)];
  assert.equal(cols.length, 4, `${cols.length} categories cliquables au lieu de 4`);
  // ⚠️ Les LIGNES ne doivent pas etre cliquables : filtrer sur « les autres
  // secteurs » afficherait le detail produit des collegues.
  assert.ok(!/<button[^>]*class="pilo-cmp-h/.test(h),
    'les lignes du comparatif sont cliquables : on exposerait le portefeuille des collegues');
});

test('l ecart avec la France est affiche en points, sur les lignes Integral seulement', () => {
  const h = rendre(SECTEUR);
  const ecarts = [...h.matchAll(/class="pilo-cmp-e mono (up|dn)">([^<]+)</g)];
  assert.ok(ecarts.length >= 4, `seulement ${ecarts.length} ecarts affiches`);
  for (const [, sens, txt] of ecarts) {
    assert.match(txt.trim(), /^[+−][\d,]+ pts$/, `ecart mal forme : « ${txt} »`);
    assert.equal(sens, txt.trim()[0] === '+' ? 'up' : 'dn', `couleur incoherente pour « ${txt} »`);
  }
  // la ligne France ne se compare pas a elle-meme
  const blocFr = h.slice(h.indexOf('pilo-cmp-r fr'));
  assert.ok(!/pilo-cmp-e/.test(blocFr), 'la ligne France porte un ecart avec elle-meme');
});

test('aucune troncature silencieuse : ce qui n est pas liste est DIT', () => {
  const h = rendre('');
  const nRef = (h.match(/([\d\s  ]+) références ·/) || [])[1];
  assert.ok(nRef && lireEuro(nRef) > 200, `seulement ${nRef} references : le cas de la troncature n est pas represente`);
  assert.ok(/autres références ne sont pas listées/.test(h),
    'l ecran laisse croire que la liste est complete');
  assert.ok(/% du chiffre d.affaires de cette sélection/.test(h),
    'le poids de ce qui EST liste n est pas dit');
});

test('un produit sans designation affiche son CIP, jamais un blanc', () => {
  const h = rendre('');
  // ⚠️ On capture le CONTENU du repere, pas un CIP bien forme : sinon, le jour
  // ou le code cesse d ecrire le CIP, la regex ne trouve plus rien, le test se
  // desactive tout seul et passe au vert sur le defaut qu il devait attraper.
  const spans = [...h.matchAll(/class="pilo-pr-anon mono">([^<]*)</g)];
  if (!spans.length) return;   // toutes les references sont nommees : rien a prouver
  // Le code affiche est celui du fichier de ventes, tel quel. Mesure le
  // 24/08/2026 : 12 references sur 7 950 y portent 12 chiffres au lieu de 13,
  // et AUCUNE ne se retrouve en completant par des zeros — ce ne sont pas des
  // codes tronques, ce sont des references absentes de tous les referentiels
  // (1,27 % du chiffre d affaires). On verifie donc qu on affiche bien un code,
  // pas qu il fasse une longueur qu on aurait decidee.
  for (const [, txt] of spans) {
    assert.match(txt.trim(), /^\d+$/, `repere de reference vide ou malforme : « ${txt} »`);
  }
  assert.ok(/référence non répertoriée/.test(h), 'le CIP nu n est pas signale comme tel');
});

test('tranche DOMINANTE et prix PONDERE — sur un cas dont on connait la reponse', () => {
  // Un produit vendu 2 fois : 1 boîte à 5 000 € et 100 boîtes à 10 €.
  //   → chiffre d'affaires 6 000 €, dont 5 000 € en « > 2 000 € » : tranche dominante
  //   → prix moyen pondéré = 6 000 / 101 = 59,41 €
  // Prendre la DERNIÈRE ligne au lieu du poids donnerait « 4,33 – 468 € », faux.
  const bac = faireFenetre();
  bac.PROD_STATS = [{ c: '7777777777777', d: 'PRODUIT A DEUX PRIX', n: 2, f: 'pr_mid', ppht: 10, net: 9 }];
  bac.TENDANCE = { meta: { mois: '01' }, data: {} };
  // Le produit doit entrer dans l univers Medic AM, sinon le bloc l ecarte.
  bac.AMELI_AVG = { meta: { base: 20000 }, data: { 7777777777777: 10 } };
  bac.PPHT = { 7777777777777: 60 };
  bac.STOCK_IP = { meta: {}, data: {} };
  bac.ICO = () => '';
  const v2 = bac.V2 = {
    pages: {}, user: null, commFilter: 'Moi',
    pharmacies: [{ id: 'p1', name: 'Off', cp: '49000', groupement: 'X' }],
    sales: [
      { pharmacyId: 'p1', month: 1, year: 2026, commercial: 'Moi', artCode: '7777777777777', qte: 1, puNet: 5000, mntNetHt: 5000 },
      { pharmacyId: 'p1', month: 1, year: 2026, commercial: 'Moi', artCode: '7777777777777', qte: 100, puNet: 10, mntNetHt: 1000 },
      { pharmacyId: 'p1', month: 2, year: 2026, commercial: 'Autre', artCode: '7777777777777', qte: 1, puNet: 10, mntNetHt: 10 },
    ],
    commSales() { return v2.sales.filter((x) => x.commercial === 'Moi'); }, commercials() { return ['Moi', 'Autre']; },
    esc: (s) => String(s == null ? '' : s), sumCA: (a) => a.reduce((s, x) => s + x.mntNetHt, 0),
    fmtEur: (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('fr-FR') : n.toFixed(2).replace('.', ',')) + ' €',
    fmtNum: (n) => String(Math.round(n)), fmtK: (n) => String(Math.round(n)),
    margeMDLboite: () => 0, tint: () => '', topbar: () => '', go() {}, render() {},
  };
  executer(lire('v2-pilotage.js'), bac);
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  v2.pages.pilotage.render(root);
  const h = root.innerHTML;
  const ligne = h.slice(h.indexOf('PRODUIT A DEUX PRIX'));
  const tag = (ligne.match(/class="pilo-pr-tag"[^>]*>.*?<\/span>\s*([^<]+)</) || [])[1] || '';
  assert.ok(/> 2 000/.test(ligne.slice(0, 700)),
    'la tranche affichee n est pas celle qui porte le chiffre d affaires');
  const pu = (ligne.match(/>([\d\s ,\.]+)\s*€\/boîte</) || [])[1];
  assert.ok(pu, 'aucun prix unitaire affiche');
  assert.ok(Math.abs(lireEuro(pu) - 6000 / 101) < 0.02,
    `prix unitaire ${pu} au lieu de ${(6000 / 101).toFixed(2)} : il n est pas pondere par les quantites`);
});
