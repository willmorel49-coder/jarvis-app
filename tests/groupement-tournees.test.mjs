// 26/11/2026 — option B, étape 8b : carte « Nos tournées et les adhérentes » des apps de groupement (groupements/v2/groupement-tournees.js).
// Données FACTICES uniquement (ce fichier est public : aucune vraie tournée, aucune vraie officine, aucun vrai nombre).
// Ce qui est tenu :
//   - statuts : déjà livrée (arrêt du fichier), proche (tournée qui la livrerait + détour : celui du fichier, sinon calculé), loin
//     (au-delà du seuil du bloc T10 : tournée la plus proche, établissements « à recevoir », 3 clientes Intégral les plus proches), sans position ;
//   - les clientes voisines sont placées par la base nationale (pas par la position souvent « centre de ville » du fichier des clientes) ;
//   - une position partagée par plusieurs officines est dite « approximative » ;
//   - numéros : tournée par tournée, dans l'ordre de la tournée, puis les lointaines ; aucun chiffre de vente dans les textes ;
//   - la période est LUE dans le fichier ; le seuil vient du bloc T10 (réutilisé, pas recopié) ;
//   - écran, tuile et ⌘K ABSENTS pour le rôle opso ; les deux apps chargent le module ; Leaflet par V2_DATA_BASE ; jamais CARTO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const require = createRequire(import.meta.url);
const Ess = require('../crm/v2/v2-tournees-essentiels.js');
const C = require('../groupements/v2/groupement-tournees.js');
const MODULE = lire('groupements/v2/groupement-tournees.js');
const texte = h => String(h).replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/[ \n\t]+/g, ' ');

// ── Jeu factice ──
const pf = (cip, lat, lng, nom, ville, cp) => { const p = new Array(14).fill(''); p[0] = lat; p[1] = lng; p[6] = nom; p[7] = ville; p[8] = cp; p[13] = cip; return p; };
const T = {
  periode: 'période fictive', depot: { nom: 'Dépôt fictif', ville: 'Ville-Dépôt', lat: 47.0, lng: -1.0 },
  etablissements: [{ s: 'AAA', nom: 'Établissement actif', ville: 'Ici', tournees: true }, { s: 'BBB', nom: 'Établissement en attente', ville: 'Ailleurs', tournees: false }],
  tournees: {
    T2: { code: 'T2', nom: 'Nord fictif', trace: [[47.5, -1.0], [47.5, -0.5]], arrets: [{ n: 1, id: '2000001', nom: 'ARRET NORD', ville: 'NORD', lat: 47.5, lng: -0.7 }], prospects: [] },
    T1: { code: 'T1', nom: 'Sud fictif', trace: [[47.0, -1.0], [47.0, -0.5]],
      arrets: [{ n: 1, id: '1000001', nom: 'ARRET UN', ville: 'SUD', lat: 47.0, lng: -0.8 }, { n: 2, id: '1000002', nom: 'ARRET DEUX', ville: 'SUD', lat: 47.0, lng: -0.6 }],
      prospects: [['3000001', 47.02, -0.75, 2.2, 1, 2, 2.5, 1]] }
  }
};
const PF = { p: [
  pf('1000001', 47.0, -0.8, 'PHARMACIE UN', 'SUD', '44000'), pf('1000002', 47.0, -0.6, 'PHARMACIE DEUX', 'SUD', '44000'),
  pf('3000001', 47.02, -0.75, 'PHARMACIE DE LA ROUTE', 'SUD', '44100'), pf('3000002', 47.48, -0.9, 'PHARMACIE DU NORD', 'NORD', '49000'),
  pf('3000005', 47.3, -0.7, 'PHARMACIE DU MILIEU', 'MILIEU', '49100'), pf('3000006', 47.85, -0.7, 'PHARMACIE DU SEUIL', 'SEUIL', '53000'),
  pf('3000003', 48.0, -0.7, 'PHARMACIE LOINTAINE', 'LOIN', '61000'),
  pf('5000001', 47.9, -0.7, 'PHARMACIE DU CENTRE', 'CENTRE', '61100'), pf('5000002', 47.9, -0.7, 'PHARMACIE VOISINE DU CENTRE', 'CENTRE', '61100'),
  pf('4000001', 48.05, -0.7, 'PHARMACIE CLIENTE PROCHE', 'VOISINE', '61200'), pf('4000002', 48.2, -0.7, 'PHARMACIE CLIENTE MOINS PROCHE', 'PLUS LOIN', '61300')
] };
const WML = [
  { id: '4000001', name: 'PHARMACIE CLIENTE PROCHE', ville: 'VOISINE', lat: 47.0, lng: -1.0 },   // position du fichier des clientes = « centre » faux : la base nationale doit l'emporter
  { id: '4000002', name: 'PHARMACIE CLIENTE MOINS PROCHE', ville: 'PLUS LOIN', lat: 48.2, lng: -0.7 },
  { id: '4000003', name: 'PHARMACIE HORS BASE', ville: 'QUELQUE PART', lat: 48.1, lng: -0.6 },      // absente de la base nationale : position approximative
  { id: '3000003', name: 'PHARMACIE LOINTAINE', ville: 'LOIN', lat: 48.0, lng: -0.7 },            // l'adhérente elle-même : jamais sa propre voisine
  { id: '1000001', name: 'PHARMACIE UN', ville: 'SUD', lat: 47.0, lng: -0.8 }
];
const ADH = [
  { code: '1000002', name: 'x', inDb: true }, { code: '3000001', name: 'x', inDb: false }, { code: '3000002', name: 'x', inDb: false },
  { code: '3000005', name: 'x', inDb: false }, { code: '3000006', name: 'x', inDb: true }, { code: '3000003', name: 'x', inDb: true },
  { code: '5000001', name: 'x', inDb: false }, { code: '3000004', name: 'PHARMACIE SANS POSITION', ville: 'NULLE PART', inDb: false },
  { code: '03000001', name: 'doublon du même CIP', inDb: false }
];
const D = C.calculer(T, PF, ADH, WML);
const par = cip => D.adh.filter(e => e.cip === cip)[0];

test('une donnée manquante rend null, jamais un calcul partiel', () => {
  assert.equal(C.calculer(null, PF, ADH, WML), null);
  assert.equal(C.calculer(T, null, ADH, WML), null);
  assert.equal(C.calculer(T, PF, ADH, null), null);
  assert.equal(C.calculer({ tournees: {} }, PF, ADH, WML), null);
});

test('statuts : livrée, proche (détour du fichier ou calculé), loin, sans position ; un CIP compté une fois', () => {
  assert.equal(D.adh.length, 8, 'le doublon 03000001 = 3000001 n’est compté qu’une fois');
  const a = par('1000002'); assert.equal(a.statut, 'livree'); assert.equal(a.code, 'T1'); assert.equal(a.n, 2);
  const b = par('3000001'); assert.equal(b.statut, 'proche'); assert.equal(b.code, 'T1'); assert.equal(b.detour, 2.5); assert.equal(b.source, 'fichier');
  const c = par('3000002'); assert.equal(c.statut, 'proche'); assert.equal(c.code, 'T2'); assert.equal(c.source, 'calcul');
  assert.equal(c.detour, C.detourInsertion(47.48, -0.9, T.tournees.T2, T.depot));
  assert.equal(par('3000005').code, 'T2', 'la tournée la plus proche, pas la première du fichier');
  assert.equal(par('3000004').statut, 'sanspos');
  assert.deepEqual([D.livrees.length, D.proches.length, D.loin.length, D.sanspos.length], [1, 4, 2, 1]);
});

test('le seuil « loin » est celui du bloc T10 (réutilisé) : juste en deçà = proche, au-delà = loin', () => {
  assert.equal(typeof Ess.SEUIL_LOIN, 'number');
  const g = par('3000006'); assert.ok(g.dQui < Ess.SEUIL_LOIN && g.dQui > Ess.SEUIL_LOIN - 3, 'point de contrôle juste sous le seuil'); assert.equal(g.statut, 'proche');
  const d = par('3000003'); assert.ok(d.dQui > Ess.SEUIL_LOIN); assert.equal(d.statut, 'loin'); assert.equal(d.qui, 'T2');
  assert.doesNotMatch(MODULE, /SEUIL_LOIN\s*=\s*\d/, 'le seuil n’est pas recopié ici');
});

test('détour calculé = meilleure insertion × 1,3 entre deux points de passage, dépôt compris', () => {
  const h = (a, b) => C.hav(a, b), p = [47.48, -0.9], dep = [47.0, -1.0], a1 = [47.5, -0.7];
  const attendu = Math.round(Math.max(0, Math.min(1.3 * (h(dep, p) + h(p, a1) - h(dep, a1)), 1.3 * (h(a1, p) + h(p, dep) - h(a1, dep)))) * 10) / 10;
  assert.equal(C.detourInsertion(47.48, -0.9, T.tournees.T2, T.depot), attendu);
  assert.equal(C.detourInsertion(47.0, -0.7, T.tournees.T1, T.depot), 0, 'sur la route : aucun détour');
  assert.ok(Math.abs(C.hav([47, -1], [48, -1]) - 111.19) < 0.05, 'outil de mesure éprouvé sur un cas connu (1° de latitude)');
});

test('loin : les 3 clientes Intégral les plus proches, placées par la base nationale, jamais elle-même', () => {
  const d = par('3000003');
  assert.equal(d.voisines.length, 3);
  assert.deepEqual(d.voisines.map(v => v.nom), ['Pharmacie Cliente Proche', 'Pharmacie Hors Base', 'Pharmacie Cliente Moins Proche']);
  assert.ok(d.voisines[0].km < 10, 'position de la base nationale, pas le « centre » du fichier des clientes');
  assert.equal(d.voisines[0].approx, false); assert.equal(d.voisines[1].approx, true, 'hors base nationale = approximative');
  const t = texte(C.prevision(d, D));
  assert.match(t, /la plus proche de nos tournées/); assert.match(t, /Établissement en attente/); assert.match(t, /Pharmacie Cliente Proche \(Voisine, /);
  assert.doesNotMatch(t, /Établissement actif/, 'un établissement dont les tournées sont reçues n’est pas « à recevoir »');
});

test('position partagée par plusieurs officines de la base nationale = « approximative »', () => {
  const h = par('5000001'); assert.equal(h.approx, true); assert.match(texte(C.prevision(h, D)), /position approximative/);
  assert.equal(par('3000003').approx, false); assert.doesNotMatch(texte(C.prevision(par('3000003'), D)), /· position approximative$/);
  assert.equal(par('1000002').approx, false, 'un arrêt est à l’adresse livrée');
});

test('numéros : tournée par tournée dans l’ordre de la tournée, puis les lointaines ; pas de numéro sans position', () => {
  const P = C.numeroter(D);
  assert.deepEqual(P.tous.map(e => e.cip), ['3000001', '1000002', '3000002', '3000005', '3000006', '5000001', '3000003']);
  assert.deepEqual(P.tous.map(e => e.no), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(P.par['3000004'], undefined);
  assert.equal(D.adh[0].no, undefined, 'D n’est pas modifié');
  assert.equal(P.par['3000001'].court, 'Route', 'nom court du bloc T10');
});

test('textes : tournée + détour seulement, aucun chiffre de vente ; période lue dans le fichier', () => {
  assert.equal(texte(C.prevision(par('1000002'), D)), 'Déjà livrée par la T1 · Sud fictif, arrêt 2');
  assert.match(texte(C.prevision(par('3000001'), D)), /^Serait livrée par la T1 · Sud fictif · détour estimé 2,5 km$/);
  assert.match(texte(C.prevision(par('3000004'), D)), /Position introuvable/);
  const tout = D.adh.map(e => texte(C.prevision(e, D))).join(' ') + texte(C.sousTitre(D, 'auj')) + texte(C.sousTitre(D, 'quot'));
  assert.doesNotMatch(tout, /€|chiffre d|marge|commande|rentab/i);
  assert.match(texte(C.sousTitre(D, 'auj')), /période fictive/);
  assert.match(texte(C.sousTitre(D, 'quot')), /1 déjà livrées, 4 à 40 km ou moins/);
  assert.doesNotMatch(MODULE, /janvier à octobre/, 'aucune période écrite en dur');
});

// ── Écran ──
function monter(conf, user) {
  const el = { innerHTML: '' }, appels = [];
  const ctx = { console, Intl, Promise, setTimeout, matchMedia: () => ({ matches: false }), innerWidth: 1280,
    document: { getElementById: () => el, querySelectorAll: () => [], body: { contains: () => true }, documentElement: {} } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(lire(conf), ctx);
  vm.runInContext(lire('crm/v2/v2-tournees-essentiels.js'), ctx);
  ctx.V2.pages = {}; ctx.V2.user = user; ctx.V2.pharmacies = []; ctx.V2.topbar = () => '<header></header>';
  ctx.V2.loadFiles = k => { appels.push(k.join(',')); return Promise.resolve(); };
  vm.runInContext(MODULE, ctx);
  return { V2: ctx.V2, el, appels };
}
for (const conf of ['groupements/config/essentiels.js', 'groupements/config/opso.js']) {
  test(conf + ' : écran présent ; absent (tuile, ⌘K, écran) pour le rôle opso, sans rien demander au serveur', () => {
    const admin = monter(conf, { role: 'admin', email: 'a@exemple.fr' });
    assert.ok(admin.V2.pages.tourneesgroupement); assert.equal(admin.V2.groupementTournees.visible(), true);
    for (const u of [{ role: 'opso' }, { role: 'commercial', opsoOnly: true }]) {
      const m = monter(conf, u);
      assert.equal(m.V2.groupementTournees.visible(), false);
      m.V2.pages.tourneesgroupement.render({ innerHTML: '' });
      assert.match(m.el.innerHTML, /pas disponible pour ce compte/); assert.deepEqual(m.appels, []);
    }
  });
}

test('réglages publics : un bloc `tournees` dans les deux apps, sans aucun chiffre', () => {
  for (const f of ['groupements/config/essentiels.js', 'groupements/config/opso.js']) {
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire(f), ctx);
    const b = ctx.V2_GROUPEMENT.tournees; assert.ok(b && b.titre && b.tuile && b.tuileCourte && b.palette, f);
    assert.doesNotMatch(JSON.stringify(b), /\d/, f + ' : aucun nombre');
  }
});

test('les deux apps chargent le calcul T10 puis l’écran, avant le tableau de bord (ligne de tuile)', () => {
  for (const f of ['essentiels/v2/index.html', 'opso/v2/index.html']) {
    const h = lire(f), i = s => h.indexOf(s);
    assert.ok(i('crm/v2/v2-tournees-essentiels.js?v=') > 0 && i('groupements/v2/groupement-tournees.js?v=') > i('crm/v2/v2-tournees-essentiels.js?v='), f);
    assert.ok(i('groupements/v2/groupement-bord.js?v=') > i('groupements/v2/groupement-tournees.js?v='), f);
  }
  assert.doesNotMatch(lire('crm/v2/index.html'), /groupement-tournees\.js/, 'JARVIS garde son écran Tournées');
});

test('Leaflet par V2_DATA_BASE (../../crm/v2/vendor/leaflet/ depuis une app de groupement), fond commun, jamais CARTO', () => {
  assert.match(MODULE, /\(glob\.V2_DATA_BASE \|\| '\.\.\/'\) \+ 'v2\/vendor\/leaflet\/'/);
  assert.match(MODULE, /V2\.fondCarte\(carte\)/);
  assert.doesNotMatch(MODULE, /carto(cdn)?\.|basemaps/i);
  assert.doesNotMatch(MODULE, /V2\.grp[A-Z]/, 'jamais de nom V2.grpXxx (écran Groupements de JARVIS)');
});

test('accueil et ⌘K : la tuile et l’entrée passent par visible()', () => {
  const app = lire('crm/v2/v2-app.js');
  assert.match(app, /V2\.groupementTournees && V2\.pages\[V2\.groupementTournees\.route\] && V2\.groupementTournees\.visible\(\)\) \{\s*P\.push/);
  assert.match(app, /V2\.groupementTournees\.visible\(\)\) PAGES\.push/);
});

test('style : toutes les règles gtrn- sont bornées à #v2-root, sans effet interdit sous Safari', () => {
  const css = lire('groupements/v2/groupement-ux.css'), bloc = css.slice(css.indexOf('Carte « Nos tournées et les adhérentes »'));
  const regles = bloc.split('\n').filter(l => /\.gtrn/.test(l) && /\{/.test(l));
  assert.ok(regles.length > 30);
  regles.forEach(l => assert.match(l.trim(), /^(@media[^{]*\{\s*)?#v2-root /, l));
  assert.doesNotMatch(bloc, /backdrop-filter|filter:\s*blur/);
});

test('passe WebKit du 26/11 : badge recouvert = petit point (numéro rendu à la sélection) ; établissements à recevoir comptés, pas énumérés', () => {
  assert.match(MODULE, /classList\.toggle\('gtrn-petit', !!it\.dessous\)/);
  const css = lire('groupements/v2/groupement-ux.css');
  assert.match(css, /#v2-root \.gtrn-petit \.gtrn-mk \.gtrn-b \{[^}]*font-size: 0;/);
  assert.match(css, /#v2-root \.gtrn-petit\.gtrn-on \.gtrn-mk \.gtrn-b \{[^}]*font-size: 12px;/);
  const T2 = JSON.parse(JSON.stringify(T)); T2.etablissements.push({ s: 'CCC', nom: 'Autre en attente', ville: 'Là', tournees: false });
  const D2 = C.calculer(T2, PF, ADH, WML), t = texte(C.prevision(D2.adh.filter(e => e.cip === '3000003')[0], D2));
  assert.match(t, /tournées des 2 autres établissements du groupe pas encore reçues/);
  assert.doesNotMatch(t, /Autre en attente/);
});

test('chevauchement OPSO du 26/11 : un badge posé sur son voisin passe en petit point ; boîte mesurée, pas fixe (seuil resserré au contact : test suivant)', () => {
  const sz = { x: 800, y: 600 };
  // Boîtes mesurées : un badge à trois chiffres de 50 × 26, son voisin de 42 × 26 un peu plus bas ; ils se recouvrent sur 18 × 19 = 342 px²,
  // soit plus de 30 % de la petite boîte (328) mais moins de 30 % de la grande (390) : l'ancienne règle laissait le grand posé dessus.
  const large = { x: 100, y: 100, w: 50, h: 26, no: 106 }, voisin = { x: 132, y: 107, w: 42, h: 26, no: 98 };
  const r = C.recouverts([large, voisin], [], sz);
  assert.deepEqual(r, [true, false], 'le badge du dessus est réduit en point, le voisin garde son numéro');
  // Éloignés : aucun n'est réduit.
  assert.deepEqual(C.recouverts([large, { ...voisin, x: 300 }], [], sz), [false, false]);
  // Hors cadre et sous un bouton : réduit.
  assert.deepEqual(C.recouverts([{ x: -3, y: 50, w: 36, h: 26, no: 1 }], [], sz), [true]);
  assert.deepEqual(C.recouverts([{ x: 10, y: 10, w: 36, h: 26, no: 1 }], [{ x: 0, y: 0, w: 60, h: 40 }], sz), [true]);
  // Le placement mesure le badge réel et passe par cette règle.
  assert.match(MODULE, /it\.hb = Math\.max\(HB, bb \? bb\.offsetWidth \/ 2 : 0\)/);
  assert.match(MODULE, /var rec = C\.recouverts\(items\.map\(function \(it\) \{ return it\.b; \}\), ovl, sz\);/);
});

test('numéros rognés du 26/11 (carte OPSO à 1280 px) : un badge qui touche un numéro ou un petit point posé par-dessus devient un point', () => {
  const sz = { x: 800, y: 600 };
  // 1. Moins de 30 % mais plus de 2 px : l'ancienne règle laissait le chiffre du dessous à moitié caché (O1 sous O2). Badges de 42 × 26 ;
  //    le voisin, 4 px plus bas, est peint par-dessus et couvre 6 × 22 px (132 px², sous les 30 % de 1 092).
  const dessous = { x: 100, y: 100, w: 42, h: 26, no: 17 }, dessus = { x: 136, y: 104, w: 42, h: 26, no: 36 };
  assert.deepEqual(C.recouverts([dessous, dessus], [], sz), [true, false], 'le badge du dessous devient un point, celui du dessus garde son numéro');
  // 2. Tolérance de 2 px (l'anneau blanc) : 2 px de contact laissent les deux numéros ; 3 px non.
  assert.deepEqual(C.recouverts([dessous, { ...dessus, x: 140 }], [], sz), [false, false]);
  assert.deepEqual(C.recouverts([dessous, { ...dessus, x: 139 }], [], sz), [true, false]);
  // 3. Un petit point posé par-dessus cache aussi un chiffre : c, le plus bas, recouvre b (b devient un point au centre de b) ;
  //    a ne touche pas c (1 px) mais touche le point de b (5 px) : a devient un point. Ne regarder que les numéros en laissait 53 chez OPSO.
  const a = { x: 100, y: 115, w: 42, h: 26, no: 1 }, b = { x: 100, y: 130, w: 42, h: 26, no: 2 }, c = { x: 100, y: 140, w: 42, h: 26, no: 3 };
  assert.deepEqual(C.recouverts([a, b, c], [], sz), [true, true, false]);
  assert.equal(2 * C.DEMI_POINT, 14);
  assert.match(lire('groupements/v2/groupement-ux.css'), /#v2-root \.gtrn-petit \.gtrn-mk \.gtrn-b \{[^}]*width: 14px; height: 14px;/, 'le point dessiné fait la taille de la règle');
  // 4. Le contact se juge sur le badge DESSINÉ, pas sur la boîte de placement (44 × 44 au téléphone) : deux badges de 33 × 24
  //    à 36 px l'un de l'autre ont des boîtes qui se recouvrent de 8 px, mais 3 px d'air entre eux : les deux gardent leur numéro.
  const t1 = { x: 100, y: 100, w: 44, h: 44, no: 5, vw: 33, vh: 24 }, t2 = { x: 136, y: 100, w: 44, h: 44, no: 4, vw: 33, vh: 24 };
  assert.deepEqual(C.recouverts([t1, t2], [], sz), [false, false]);
  // 5. Égalité de hauteur : le plus petit numéro est peint dessus (ajouté en dernier), c'est l'autre qui devient un point.
  assert.deepEqual(C.recouverts([{ ...t1, no: 9 }, { ...t2, x: 120, no: 8 }], [], sz), [true, false]);
  // 6. Le placement passe le badge dessiné à la règle.
  assert.match(MODULE, /no: it\.e\.no, vw: bb \? bb\.offsetWidth : 0, vh: bb \? bb\.offsetHeight : 0 \}/);
});

test('390 px, 26/11 : le bandeau ne cache jamais l’officine choisie (marge basse = bandeau réel, carte remontée si touchée dessous)', () => {
  // Mesuré dans le Safari de Will à 390 px : carte 420 px, bandeau 268 px ; l'ancienne marge basse fixe (110) laissait l'officine dessous.
  assert.equal(C.margeBas(268, 420, 70), 304, 'bandeau + 36 px');
  assert.equal(C.margeBas(0, 420, 70), 110, 'sans bandeau : la marge d’avant');
  assert.equal(C.margeBas(60, 800, 70), 110, 'petit bandeau (ordinateur) : jamais moins de 110');
  assert.equal(C.margeBas(340, 420, 70), 310, 'bandeau très haut : bornée, 40 px de carte gardés sous la marge haute');
  assert.ok(420 - 70 - C.margeBas(1000, 420, 70) >= 40, 'jamais de place négative (zoom impossible chez Leaflet)');
  // Touchée sur la carte : la carte remonte juste assez pour que le badge reste au-dessus du bandeau.
  assert.equal(C.decalage(300, 420, 213), 129, 'sous le bandeau : remonte de y − (420 − 213 − 36)');
  assert.equal(C.decalage(120, 420, 213), 0, 'déjà au-dessus : rien ne bouge');
  assert.equal(C.decalage(300, 420, 0), 0, 'bandeau fermé : rien ne bouge');
  assert.equal(C.decalage(300, 420, 400), 230, 'bandeau énorme : l’officine reste sous les boutons du haut (70 px)');
  // Le recadrage et la touche sur la carte passent par ces règles, avec la hauteur RÉELLE du bandeau.
  assert.match(MODULE, /paddingBottomRight: \[30, C\.margeBas\(hBandeau\(\), carte\.getSize\(\)\.y, 70\)\]/);
  assert.match(MODULE, /C\.decalage\(carte\.latLngToContainerPoint\(\[e\.lat, e\.lng\]\)\.y, carte\.getSize\(\)\.y, hBandeau\(\)\)/);
  assert.match(MODULE, /function hBandeau\(\) \{ var b = document\.getElementById\('gtrn-band'\); return b && b\.classList\.contains\('on'\) \? b\.offsetHeight : 0; \}/);
});

// ── 27/11/2026 : TOUS les établissements (fichier version 3) — 2e établissement FICTIF « ZZZ », mêmes numéros de tournée que l'autre ──
const T3 = {
  periode: 'période fictive', depot: T.depot,
  depots: { AAA: T.depot, ZZZ: { nom: 'Dépôt ZZZ fictif', ville: 'Ville-Z', lat: 45.0, lng: 4.0 } },
  etablissements: [{ s: 'AAA', nom: 'Établissement actif', ville: 'Ici', tournees: true }, { s: 'ZZZ', nom: 'Établissement Z', ville: 'Là', tournees: true }, { s: 'BBB', nom: 'Établissement en attente', ville: 'Ailleurs', tournees: false }],
  tournees: Object.assign({}, T.tournees, {
    'ZZZ-T1': { code: 'ZZZ-T1', etab: 'ZZZ', nom: 'Zone Z fictive', trace: [[45.0, 4.0], [45.0, 4.5]], arrets: [{ n: 1, id: '6000001', nom: 'ARRET Z', ville: 'Z', lat: 45.0, lng: 4.2 }], prospects: [] }
  })
};
const T3b = JSON.parse(JSON.stringify(T3)); for (const k of ['T1', 'T2']) T3b.tournees[k].etab = 'AAA';
const PF3 = { p: PF.p.concat([pf('6000001', 45.0, 4.2, 'PHARMACIE Z', 'Z', '69000'), pf('6000002', 45.01, 4.3, 'PHARMACIE Z PROCHE', 'Z', '69100')]) };
const D3 = C.calculer(T3b, PF3, ADH.concat([{ code: '6000001', name: 'x', inDb: false }, { code: '6000002', name: 'x', inDb: false }]), WML);

test('v3 : toutes les tournées de tous les établissements, OPS d’abord, chacune avec son établissement', () => {
  assert.deepEqual(D3.tournees.map(t => t.code), ['T1', 'T2', 'ZZZ-T1']);
  assert.deepEqual(D3.tournees.map(t => t.etab), ['AAA', 'AAA', 'ZZZ']);
  assert.equal(D3.actifs.length, 2); assert.deepEqual(D3.aRecevoir.map(s => s.s), ['BBB'], 'l’établissement dont les tournées sont reçues n’est plus « à recevoir »');
});

test('v3 : un dépôt par établissement qui a des tournées ; le détour se calcule avec le dépôt de LA tournée', () => {
  assert.deepEqual(D3.depots.map(d => d.s), ['AAA', 'ZZZ']);
  assert.equal(D3.depots[1].ville, 'Ville-Z');
  assert.equal(C.depotDe(T3b, T3b.tournees['ZZZ-T1']).ville, 'Ville-Z'); assert.equal(C.depotDe(T3b, T3b.tournees.T1).ville, 'Ville-Dépôt');
  const z = D3.adh.filter(e => e.cip === '6000002')[0];
  assert.equal(z.statut, 'proche'); assert.equal(z.code, 'ZZZ-T1');
  assert.equal(z.detour, C.detourInsertion(45.01, 4.3, T3b.tournees['ZZZ-T1'], T3b.depots.ZZZ), 'détour avec le dépôt de l’établissement');
  assert.notEqual(z.detour, C.detourInsertion(45.01, 4.3, T3b.tournees['ZZZ-T1'], T3b.depot), 'et pas avec celui d’un autre établissement');
});

test('v3 : sans `etab` = OPS ; fichier v2 (un seul dépôt) inchangé', () => {
  const v2 = C.calculer(T, PF, ADH, WML);
  assert.deepEqual(v2.tournees.map(t => t.etab), ['OPS', 'OPS']);
  assert.equal(v2.depots.length, 1); assert.equal(v2.depots[0].ville, 'Ville-Dépôt');
  assert.deepEqual(v2.adh.map(e => [e.cip, e.statut, e.code, e.detour]), D.adh.map(e => [e.cip, e.statut, e.code, e.detour]));
});

test('v3 : « ZZZ-T1 » et « T1 » ne se confondent jamais (codes, textes, numéros)', () => {
  const P3 = C.numeroter(D3);
  assert.equal(P3.par['6000001'].code, 'ZZZ-T1'); assert.equal(P3.par['1000002'].code, 'T1');
  assert.match(C.prevision(D3.adh.filter(e => e.cip === '6000001')[0], D3), /ZZZ-T1/);
  assert.match(C.sousTitre(D3, 'auj'), /3 tournées/); assert.match(C.sousTitre(D3, 'auj'), /Établissement actif et Établissement Z/);
});

test('v3 : l’écran dessine un marqueur de dépôt par établissement et la légende les nomme', () => {
  assert.match(MODULE, /D\.depots\.forEach/); assert.match(MODULE, /D\.depots\.map/);
});

// ── 27/11/2026 — couleur et interactivité (maquette M2 « Par tournée », choix de Will) + établissements sans tournées reçues (SOP) ──
const Part = require('../crm/v2/v2-tournees-partage.js');

test('couleurs : une par tournée CONCERNÉE (dans l’ordre d’affichage), aucune pour une tournée sans adhérente ; chaque adhérente porte celle de sa tournée', () => {
  assert.deepEqual(D.couleurs, { T1: Part.PALETTE[0], T2: Part.PALETTE[1] });
  assert.equal(par('1000002').couleur, Part.PALETTE[0]);
  assert.equal(par('3000002').couleur, Part.PALETTE[1]);
  assert.equal(par('3000003').couleur, '', 'loin et livrable par personne : pas de couleur de tournée');
  const T3 = JSON.parse(JSON.stringify(T)); T3.tournees.T3 = { code: 'T3', nom: 'Est fictif', trace: [[45.0, 3.0], [45.1, 3.1]], arrets: [], prospects: [] };
  const D3 = C.calculer(T3, PF, ADH, WML);
  assert.equal(D3.couleurs.T3, undefined, 'une tournée qui ne touche aucune adhérente reste grise');
  assert.equal(Object.keys(D3.couleurs).length, 2);
});

test('sections M2 : une par tournée concernée (adhérentes dans l’ordre des numéros), puis loin, puis sans position ; aucun établissement sans tournées si aucun livrable dans le périmètre', () => {
  const P = C.numeroter(D), S = C.sections(D, P, 'quot');
  assert.deepEqual(S.map(s => s.type + ':' + s.code), ['tournee:T1', 'tournee:T2', 'loin:LOIN', 'sanspos:SANSPOS']);
  assert.equal(S[0].couleur, Part.PALETTE[0]);
  S.filter(s => s.type === 'tournee').forEach(s => { const n = s.adh.map(e => e.no); assert.deepEqual(n, n.slice().sort((a, b) => a - b)); });
  assert.equal(S.reduce((t, s) => t + s.adh.length, 0), D.adh.length, 'chaque adhérente dans une seule section');
  assert.deepEqual(D.sansTournees, [], 'les CIP livrables par Sud Ouest Pharma ne sont pas dans ce périmètre : rien ne s’affiche');
  const A = C.sections(D, P, 'auj');
  assert.ok(A.every(s => s.type === 'tournee' && s.adh.every(e => e.statut === 'livree')), 'Aujourd’hui : seulement les déjà livrées, par tournée');
});

test('établissement sans tournées : SEULS les CIP décidés sont livrables (jamais « le dépôt le plus proche »), section avant « Loin », trait à vol d’oiseau', () => {
  Part.DEPOTS_SANS_TOURNEES.ZZZ = { s: 'ZZZ', nom: 'Dépôt sans tournées fictif', ville: 'Ville-Z', lat: 47.9, lng: -0.7 };
  Part.LIVRABLES.ZZZ = ['3000003'];
  try {
    const D4 = C.calculer(T, PF, ADH, WML), p4 = cip => D4.adh.filter(e => e.cip === cip)[0];
    assert.equal(D4.sansTournees.length, 1);
    assert.deepEqual(D4.sansTournees[0].adh.map(e => e.cip), ['3000003']);
    assert.equal(p4('3000003').livrable, 'ZZZ'); assert.equal(p4('3000003').couleur, Part.SANS);
    assert.equal(p4('3000003').dDepot, C.hav([47.9, -0.7], [48.0, -0.7]));
    assert.equal(p4('5000001').statut, 'loin'); assert.equal(p4('5000001').livrable, undefined, 'posée SUR le dépôt mais non décidée : pas livrable');
    const S = C.sections(D4, C.numeroter(D4), 'quot');
    assert.deepEqual(S.map(s => s.type + ':' + s.code), ['tournee:T1', 'tournee:T2', 'sans:ZZZ', 'loin:LOIN', 'sanspos:SANSPOS']);
    assert.ok(!S.filter(s => s.type === 'loin')[0].adh.some(e => e.cip === '3000003'), 'pas listée deux fois');
    const pv = texte(C.prevision(p4('3000003'), D4));
    assert.match(pv, /Livrable par Dépôt sans tournées fictif \(Ville-Z\)/); assert.match(pv, /à vol d’oiseau/); assert.match(pv, /pas encore reçues/);
    assert.match(texte(C.sousTitre(D4, 'quot')), /1 livrable par Dépôt sans tournées fictif \(tournées à recevoir\)/);
    // ses tournées arrivent dans le fichier : il ne passe plus par « sans tournées »
    const T5 = JSON.parse(JSON.stringify(T)); T5.tournees.Z1 = { code: 'Z1', etab: 'ZZZ', nom: 'Z fictif', trace: [[48.0, -0.8], [48.0, -0.6]], arrets: [], prospects: [] };
    assert.deepEqual(C.calculer(T5, PF, ADH, WML).sansTournees, []);
  } finally { delete Part.DEPOTS_SANS_TOURNEES.ZZZ; delete Part.LIVRABLES.ZZZ; }
});

test('les deux apps chargent le module commun AVANT la carte ; le module ne code aucune règle « dépôt le plus proche »', () => {
  for (const f of ['essentiels/v2/index.html', 'opso/v2/index.html']) {
    const h = lire(f), a = h.indexOf('crm/v2/v2-tournees-partage.js'), b = h.indexOf('groupements/v2/groupement-tournees.js');
    assert.ok(a > 0 && a < b, f);
  }
  assert.ok(!/plus proche d[eé]p[oô]t|depotLePlusProche/i.test(MODULE));
});
