// « Ma carte » par commercial (26/11/2026) : calcul pur (crm/v2/v2-carte-secteur-pur.js).
// Les réponses attendues sont calculées À LA MAIN sur un petit jeu fabriqué (voir le plan de chaque cas), pas relues dans le code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../crm/v2/v2-carte-secteur-pur.js');
const NB = ' ';

// ligne d'annuaire : [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
const L = (id, lat, lng, uga, grp, nom, ville) => [lat, lng, uga, grp, 0, 0, nom, ville || 'ANGERS', '49000', '', '', '', 0, id];
const uga = ['', 'U1', 'U2', 'U3'];
const grp = ['—', 'GA', 'GB'];
// 0 cliente Will A (1000 / 800) · 1 cliente Will B (500 / 500) · 2 cliente de Karine · 3 prospect GA près d'une tournée
// 4 prospect GB loin · 5 prospect sans groupement · 6 cliente Will sans palier, CA non lu · 7 prospect GB, titulaire seul de 62+ ans
// 8 prospect de l'UGA 3 (à Karine seule)
const pts = [
  L('c0', 47.00, -0.90, 1, 1, 'A'), L('c1', 47.00, -0.80, 1, 1, 'B'), L('c2', 47.00, -0.70, 1, 1, 'C'),
  L('p3', 47.02, -0.50, 1, 1, 'D'), L('p4', 47.30, -0.50, 1, 2, 'E'), L('p5', 47.05, -0.40, 1, 0, 'F'),
  L('c6', 46.80, -0.60, 2, 2, 'G'), L('p7', 47.50, -0.60, 2, 2, 'H'), L('p8', 48.00, 2.00, 3, 1, 'I')
];
const clientDe = { 0: ['Will'], 1: ['Will'], 2: ['Karine'], 6: ['Will'] };
const clientes = new Set([0, 1, 2, 6]);
const palier = { 0: 'A', 1: 'B', 6: '' };
const ugaComms = { 1: ['Will', 'Karine'], 2: ['Will'], 3: ['Karine'] };
const ca = { 0: { d: 1000, p: 800 }, 1: { d: 500, p: 500 }, 6: null };
const idx = new Map(pts.map((p, i) => [p, i]));
function ctx(over) {
  return Object.assign({
    pts, uga, grp,
    commsOf: p => { const i = idx.get(p); return clientes.has(i) ? clientDe[i] : (ugaComms[p[2]] || []); },
    isClient: p => clientes.has(idx.get(p)),
    palierDe: p => palier[idx.get(p)] || '',
    voitCa: () => true,
    caMois: p => ca[idx.get(p)] || null,
    kmTournee: null, info: null
  }, over || {});
}
// une tournée : droite horizontale à la latitude 47.00, de -1.0 à 0.0
const prep = P.preparerTournees({ tournees: { T10: { jours: ['lundi'], trace: [[47.0, -1.0], [47.0, 0.0]] } } });
const km = p => P.plusProcheTournee(p[0], p[1], prep);

test('secteurDe : les UGA de Will sont U1 (sa cliente c0) et U2 (sa cliente c6) — pas U3 ; l\'UGA sans nom ne compte pas', () => {
  const S = P.secteurDe('Will', ctx());
  assert.deepEqual(S.codes, ['U1', 'U2']);
  assert.deepEqual(P.secteurDe('Karine', ctx()).codes, ['U1', 'U3']);
});
test('contre-épreuve : un commercial sans portefeuille a 0 UGA et 0 officine, alors que Will en a 8', () => {
  const S0 = P.secteurDe('Inconnu', ctx());
  assert.deepEqual(S0.codes, []);
  assert.equal(P.chiffresSecteur(S0, ctx()).officines, 0);
  assert.equal(P.chiffresSecteur(P.secteurDe('Will', ctx()), ctx()).officines, 8);
});
test('chiffres du secteur de Will, calculés à la main : 8 officines, 3 clientes (A1 B1 sans palier 1), 1 chez Karine, 4 prospects, 50,0 %', () => {
  const r = P.chiffresSecteur(P.secteurDe('Will', ctx()), ctx());
  assert.equal(r.officines, 8);
  assert.equal(r.clientes, 3);
  assert.equal(r.collegues, 1);
  assert.equal(r.clientesTous, 4);
  assert.equal(r.prospects, 4);
  assert.deepEqual(r.paliers, { A: 1, B: 1, C: 0, sans: 1 });
  assert.equal(r.partClientes, 50);   // 4 clientes (toutes équipes) sur 8 officines
});
test('CA du dernier mois : 1 500 € sur 1 300 € = +15,4 % ; la cliente dont le CA n\'est pas lu n\'ajoute ni euro ni zéro', () => {
  const r = P.chiffresSecteur(P.secteurDe('Will', ctx()), ctx());
  assert.equal(r.ca.dernier, 1500); assert.equal(r.ca.precedent, 1300); assert.equal(r.ca.lues, 2); assert.equal(r.ca.visibles, 3);
  assert.equal(r.caLu, true); assert.equal(r.evolution, 15.4);
});
test('confidentialité : une cliente dont le CA n\'est pas visible n\'est JAMAIS sommée (le chiffre tombe à 1 000 €), mais elle reste comptée', () => {
  const c = ctx({ voitCa: p => idx.get(p) !== 1 });
  const r = P.chiffresSecteur(P.secteurDe('Will', c), c);
  assert.equal(r.ca.dernier, 1000); assert.equal(r.ca.lues, 1); assert.equal(r.clientes, 3);
  const aucune = ctx({ voitCa: () => false });
  const z = P.chiffresSecteur(P.secteurDe('Will', aucune), aucune);
  assert.equal(z.ca.dernier, 0); assert.equal(z.caLu, false); assert.equal(z.evolution, null);   // « pas lu », pas un faux 0 affiché
});
test('évolution : aucun pourcentage si le mois d\'avant manque ou si le dernier mois est nettement incomplet', () => {
  assert.equal(P.evolution({ dernier: 100, precedent: 0, lues: 3, luesPrec: 3 }), null);
  assert.equal(P.evolution({ dernier: 100, precedent: 200, lues: 1, luesPrec: 3 }), null);   // 1 lue sur 3 : mois incomplet
  assert.equal(P.evolution({ dernier: 100, precedent: 200, lues: 3, luesPrec: 3 }), -50);
  assert.equal(P.evolution({ dernier: 0, precedent: 0, lues: 0, luesPrec: 0 }), null);
});
test('groupements présents : GA = 2 clientes · 1 prospect, GB = 1 cliente · 2 prospects ; les officines sans groupement ne comptent pas', () => {
  const r = P.chiffresSecteur(P.secteurDe('Will', ctx()), ctx());
  assert.deepEqual(r.groupements, { GA: { c: 2, p: 1 }, GB: { c: 1, p: 2 } });
  const g = P.lignesGroupements(r.groupements, 6);
  assert.deepEqual(g.lignes.map(x => [x.nom, x.c, x.p, x.barre]), [['GA', 2, 1, 100], ['GB', 1, 2, 100]]);
  assert.equal(P.lignesGroupements({ A: { c: 1, p: 0 }, B: { c: 0, p: 3 }, C: { c: 0, p: 1 } }, 2).autres, 1);
});
test('distance au tracé d\'une tournée : 47,02° à 0,02° de la droite 47,00° = 2,2 km ; 47,30° = 33,4 km ; sans tournée = null', () => {
  assert.ok(Math.abs(km(pts[3]).km - 2.224) < 0.02, String(km(pts[3]).km));
  assert.ok(Math.abs(km(pts[4]).km - 33.36) < 0.1);
  assert.equal(km(pts[3]).code, 'T10');
  assert.equal(P.plusProcheTournee(47, 0, []), null);
  assert.equal(P.plusProcheTournee(NaN, 0, prep), null);
  assert.equal(P.plusProcheTournee(47, -2.0, prep).km > 60, true);   // au-delà du bout du tracé : distance au dernier point, pas 0
});
test('prospects à 10 km ou moins d\'une tournée : p3 (2,2 km) et p5 (5,6 km) = 2 ; sans le fichier des tournées, aucun (et ils sont dits « inconnus »)', () => {
  const c = ctx({ kmTournee: km });
  const r = P.chiffresSecteur(P.secteurDe('Will', c), c);
  assert.equal(r.prospects10, 2);
  const sans = ctx({ kmTournee: () => null });
  const r2 = P.chiffresSecteur(P.secteurDe('Will', sans), sans);
  assert.equal(r2.prospects10, 0); assert.equal(r2.prospectsKmInconnu, 4);
});
test('reprise possible : repère « 62 ans ou plus » ET titulaire seul', () => {
  const R = P.repriseDe;
  assert.equal(R(['', '', '', '', '', 'Jean Dupont', '', '', '', 'R']), true);
  assert.equal(R(['', '', '', '', '', 'Jean Dupont / Anne Martin', '', '', '', 'R']), false);   // deux dirigeants : pas seul
  assert.equal(R(['', '', '', '', '', 'Jean Dupont', '', '', '', '']), false);                  // pas de repère d'âge
  assert.equal(R(['', '', '', '', '', 'Jean Dupont', '', '', '', 'R', '', '', '', '2|1']), false);  // deux titulaires au répertoire
  assert.equal(R(['', '', '', '', '', 'Jean Dupont', '', '', '', 'R', '', '', '', '1|2']), true);
  assert.equal(R(null), false);
});
test('pistes : classées p3 (tournée 3 + GA 2 = 5), p7 (GB 2 + reprise 2 = 4), p5 (tournée 3), p4 (GB 2) ; chacune dit POURQUOI', () => {
  const infos = { 7: ['', '', '', '', '', 'Jean Dupont', '', '', '', 'R'] };
  const c = ctx({ kmTournee: km, info: p => infos[idx.get(p)] || null });
  const S = P.secteurDe('Will', c), ind = P.indicesDuSecteur(S, c), gc = P.clientesParGroupement(ind, 'Will', c);
  assert.deepEqual(gc, { GA: 2, GB: 1 });
  const l = P.pistes(ind, 'Will', c, gc, 5);
  assert.deepEqual(l.map(x => [x.i, x.score]), [[3, 5], [7, 4], [5, 3], [4, 2]]);
  assert.match(l[0].raisons.map(r => r.t).join(' '), /Sur la tournée T10 : à 2,2/);
  assert.match(l[0].raisons.map(r => r.t).join(' '), /GA compte déjà 2 clientes/);
  assert.match(l[1].raisons.map(r => r.t).join(' '), /reprise est possible \(repère, pas une certitude\)/);
  assert.equal(P.pistes(ind, 'Will', c, gc, 2).length, 2);
});
test('pistes : sans aucun signal (ni tournée, ni groupement, ni reprise) aucun prospect n\'est une piste — contre-épreuve du cas précédent', () => {
  const c = ctx({ kmTournee: () => null, info: () => null });
  const S = P.secteurDe('Will', c), ind = P.indicesDuSecteur(S, c);
  assert.deepEqual(P.pistes(ind, 'Will', c, {}, 5), []);
});
test('portrait d\'une UGA : U1 = 6 officines, 3 clientes toutes équipes (2 chez Will, 1 chez Karine), 3 prospects, 50,0 % ; son CA = 1 500 €', () => {
  const r = P.portraitUga(1, 'Will', ctx());
  assert.equal(r.code, 'U1'); assert.equal(r.officines, 6); assert.equal(r.clientesTous, 3); assert.equal(r.clientes, 2); assert.equal(r.collegues, 1);
  assert.equal(r.prospects, 3); assert.equal(r.partClientes, 50); assert.equal(r.ca.dernier, 1500); assert.equal(r.villePrincipale, 'ANGERS');
  assert.equal(P.portraitUga(3, 'Will', ctx()).clientes, 0);   // l'UGA 3 n'a aucune cliente de Will : 0 — et 1 officine, pas 0
  assert.equal(P.portraitUga(3, 'Will', ctx()).officines, 1);
});
test('une cliente de Will sans UGA connue reste dans son secteur (dansSecteur)', () => {
  const extra = L('c9', 45.0, 1.0, 0, 0, 'Z');   // UGA 0 = '' (sans nom)
  const pp = pts.concat([extra]); clientes.add(9); clientDe[9] = ['Will']; idx.set(extra, 9);
  const c = ctx({ pts: pp });
  const S = P.secteurDe('Will', c);
  assert.equal(P.dansSecteur(extra, S, c), true);
  assert.deepEqual(S.codes, ['U1', 'U2']);   // l'UGA sans nom n'est pas une UGA
  assert.equal(P.chiffresSecteur(S, c).officines, 9);
  clientes.delete(9); idx.delete(extra);
});
test('classes d\'aplat : bornes 5 / 10 / 15 (la borne appartient à la classe du dessus) ; part inconnue = pas de classe', () => {
  assert.deepEqual([0, 4.99, 5, 9.99, 10, 14.9, 15, 100].map(P.classeAplat), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([null, NaN, undefined, -1, 'x'].map(P.classeAplat), [-1, -1, -1, -1, -1]);
  assert.equal(P.APLATS.length, 4);
});
test('mise en forme : espaces fines, virgule, mois lu dans WML_MOIS', () => {
  assert.equal(P.nombre(262079), '262' + NB + '079');
  assert.equal(P.nombre(9.8, 1), '9,8'); assert.equal(P.nombre(null), '—'); assert.equal(P.nombre(NaN), '—');
  assert.equal(P.moisNom('2026-10'), 'octobre 2026'); assert.equal(P.moisNom('2026-01'), 'janvier 2026');
  assert.equal(P.moisNom('2026-13'), ''); assert.equal(P.moisNom(undefined), '');
});
test('géométrie : point dans un contour, trous exclus, enveloppe approchée qui contient ses officines', () => {
  const carre = (a, b) => [[a, a], [b, a], [b, b], [a, b]];   // [lon, lat]
  assert.equal(P.dansAnneau(0.5, 0.5, carre(0, 1)), true);
  assert.equal(P.dansAnneau(1.5, 0.5, carre(0, 1)), false);
  const troue = [carre(0, 10), carre(4, 6)];
  assert.equal(P.dansPolygone(5, 5, troue), false); assert.equal(P.dansPolygone(2, 2, troue), true);
  assert.equal(P.dansContour(2, 2, [troue]), true); assert.equal(P.dansContour(20, 20, [troue]), false);
  const pts4 = [[47.0, -1.0], [47.0, -0.9], [47.1, -0.9], [47.1, -1.0], [47.05, -0.95]];
  const env = P.enveloppe(pts4, 3);
  const ring = env.map(q => [q[1], q[0]]);
  pts4.forEach(q => assert.equal(P.dansAnneau(q[0], q[1], ring), true, JSON.stringify(q)));
  assert.equal(P.dansAnneau(47.5, -0.95, ring), false);   // à 55 km : dehors
  const seule = P.enveloppe([[47.0, -1.0]], 3);
  assert.equal(seule.length, 8); assert.equal(P.dansAnneau(47.0, -1.0, seule.map(q => [q[1], q[0]])), true);
  assert.deepEqual(P.enveloppe([], 3), []);
});
test('étude de zone : nos clientes rangées dans la plus petite zone qui les contient, comptées à 5 / 10 / 15 min, sans faux zéro', () => {
  const box = d => [[-1 - d, 47 - d], [-1 + d, 47 - d], [-1 + d, 47 + d], [-1 - d, 47 + d]];   // [lon, lat]
  const D = { pharmacie: { lat: 47, lon: -1 }, zones: { 5: { contour: box(0.05) }, 10: { contour: box(0.1) }, 15: { contour: box(0.2) } } };
  const cl = [
    { id: 'a', lat: 47.02, lng: -1.02, ca: 1000 }, { id: 'b', lat: 47.08, lng: -1.0, ca: 2000 }, { id: 'c', lat: 47.15, lng: -1.0, ca: null },
    { id: 'd', lat: 47.5, lng: -1.0, ca: 9999 }, { id: 'moi', lat: 47.0, lng: -1.0, ca: 5 }, { id: 'e', lat: 47.01, lng: -1.01, ca: null }
  ];
  const r = P.clientesDansZones(D, cl, 'moi');
  assert.deepEqual(r.nb, { 5: 2, 10: 3, 15: 4 });          // a,e | + b | + c ; d est dehors, « moi » est exclue
  assert.deepEqual(r.ca, { 5: 1000, 10: 3000, 15: 3000 });  // c et e : CA non lu, pas ajouté
  assert.equal(r.sansCa, 2);
  assert.deepEqual(r.liste.map(x => x.c.id), ['e', 'a', 'b', 'c']);   // les plus proches d'abord
  assert.equal(r.liste[0].zone, 5); assert.equal(r.liste[2].zone, 10); assert.equal(r.liste[3].zone, 15);
  const seulSansCa = P.clientesDansZones(D, [cl[5]], 'moi');   // une seule cliente, CA non lu : null, jamais 0
  assert.equal(seulSansCa.nb[5], 1); assert.equal(seulSansCa.ca[5], null);
  assert.deepEqual(P.clientesDansZones({ pharmacie: { lat: 47, lon: -1 }, zones: {} }, cl, 'moi').nb, { 5: 0, 10: 0, 15: 0 });   // étude sans contour : 0 cliente
  assert.equal(P.clientesDansZones({ pharmacie: { lat: 47, lon: -1 }, zones: {} }, cl, 'moi').contoursPresents, 0);
});

// ── Le fichier public des contours d'UGA (fabriqué par scripts/fabriquer_uga_contours.py) ──
const racine = new URL('../crm/v2/', import.meta.url);
test('contours d\'UGA : fichier léger, sans aucune donnée commerciale, une entrée pour CHAQUE UGA de la base nationale', () => {
  const src = fs.readFileSync(new URL('uga-contours-data.js', racine), 'utf8');
  assert.ok(src.length < 900000, 'poids ' + src.length);
  assert.match(src, /^\/\/[^\n]*\nvar UGA_CONTOURS=/);   // « var », jamais « const » (fichier chargé à la demande)
  assert.doesNotMatch(src, /owner|"color"|n_clients|n_prospects|breakdown|"secteur"/);
  const w = {}; w.window = w;
  new Function('window', src.replace('var UGA_CONTOURS', 'window.UGA_CONTOURS'))(w);
  new Function('window', fs.readFileSync(new URL('pharma-fr-data.js', racine), 'utf8'))(w);
  const C = w.UGA_CONTOURS, codes = w.PHARMA_FR.uga.filter(Boolean);
  const manquantes = codes.filter(c => !C[c]);
  assert.deepEqual(manquantes, []);
  // chaque contour : au moins un polygone, anneaux de 3 points ou plus, coordonnées en France (métropole, Corse et DOM exclus du test)
  for (const c of Object.keys(C)) {
    assert.ok(Array.isArray(C[c].p) && C[c].p.length >= 1, c);
    for (const poly of C[c].p) for (const ring of poly) { assert.ok(ring.length >= 3, c); for (const q of ring) assert.ok(Number.isFinite(q[0]) && Number.isFinite(q[1]), c); }
  }
  // un cas connu : le contour d'une UGA contient bien ses propres officines (contre-épreuve du « tout vrai »)
  const D = w.PHARMA_FR, u = D.uga.indexOf('49LPO');
  if (u >= 0) {
    const dans = D.p.filter(p => p[2] === u && P.dansContour(p[0], p[1], C['49LPO'].p)).length, tot = D.p.filter(p => p[2] === u).length;
    assert.ok(tot > 0 && dans / tot > 0.7, dans + ' / ' + tot);   // simplification à ~600 m : quelques officines de bord peuvent sortir
  }
});

// ── Les branchements dans l'app (lus dans les sources : ils tiennent ou l'écran « Ma carte » n'arrive jamais) ──
test('branchements : les deux fichiers sont chargés après v2-carte.js, le fichier de contours est déclaré, v2-carte.js ne dépend du module que par des gardes', () => {
  const html = fs.readFileSync(new URL('index.html', racine), 'utf8');
  const l = html.match(/window\.V2_MODULES = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(x => x.slice(1, -1));
  const a = l.indexOf('v2-carte.js'), b = l.indexOf('v2-carte-secteur-pur.js'), c = l.indexOf('v2-carte-secteur.js');
  assert.ok(a >= 0 && b > a && c > b, JSON.stringify([a, b, c]));   // le calcul pur avant l'écran, les deux après La carte
  ['v2-carte-secteur-pur.js', 'v2-carte-secteur.js', 'v2-carte-etude.css', 'uga-contours-data.js'].forEach(f => assert.ok(fs.existsSync(new URL(f, racine)), f));
  assert.match(fs.readFileSync(new URL('v2-boot.js', racine), 'utf8'), /ugacontours: 'v2\/uga-contours-data\.js'/);
  assert.match(fs.readFileSync(new URL('v2-app.js', racine), 'utf8'), /ugacontours: 'les contours des UGA'/);
  const carte = fs.readFileSync(new URL('v2-carte.js', racine), 'utf8');
  const appels = carte.match(/V2\.carteSecteur\.[a-zA-Z]+/g) || [];
  assert.ok(appels.length >= 8, 'branchements : ' + appels.length);
  // chaque appel est précédé de sa garde `if (V2.carteSecteur)` ou d'un `V2.carteSecteur ?` sur la même ligne
  carte.split('\n').forEach(ligne => { if (/V2\.carteSecteur\.[a-zA-Z]+/.test(ligne)) assert.match(ligne, /V2\.carteSecteur\s*(\?|\)|&&)/, ligne.trim().slice(0, 120)); });
  assert.match(carte, /if \(secteurPass && !secteurPass\(p\)\) return false;/);
});
test('« Toute la France » = La carte d\'avant : sans filtre de secteur, pass() ne change rien (la garde est la première ligne, null par défaut)', () => {
  const carte = fs.readFileSync(new URL('v2-carte.js', racine), 'utf8');
  assert.match(carte, /var secteurPass = null;/);
  assert.match(carte, /poserFiltre: function \(fn\) \{ secteurPass = fn \|\| null; \}/);
});
