// Officines fermées (27/11/2026, choix de Will « Retirer de la carte ») : absentes de TOUTES les cartes, fiche et recherche gardées.
// Le juge commun est V2.pfFermee (v2-app.js) ; chaque carte l'appelle avant de poser un point.
// Ce test rouge = une carte a perdu son appel au juge, ou le juge a changé de règle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lire = f => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

// Le juge, lu dans le source de l'appli (jamais recopié à la main).
const app = lire('v2-app.js');
const debut = app.indexOf('V2.pfFermee = function');
const fin = app.indexOf('\n  };', debut) + 5;
assert.ok(debut > 0 && fin > debut, 'juge V2.pfFermee introuvable dans v2-app.js');
const jugeSrc = app.slice(debut, fin);
function juge(D) { const V2 = {}; new Function('V2', 'window', jugeSrc)(V2, { PHARMA_FR: D }); return V2.pfFermee; }

// Faux PHARMA_FR : 3 points [lat,lng,uga,grp,seg,comm,nom,ville,cp,tel,titulaire,email,ca,id] ; seg 0 = Prospect, 1 = Client A.
const pt = (lat, lng, seg, id) => [lat, lng, 0, 0, seg, 0, 'n' + id, 'v', '49000', '', '', '', 0, id];
const faux = (fermees) => ({ meta: fermees ? { fermees } : {}, uga: ['49'], grp: ['—'], seg: ['Prospect', 'Client A'], comm: ['X'],
  p: [pt(47.0, 0.0, 0, 'A1'), pt(47.01, 0.01, 0, 'F1'), pt(47.02, 0.02, 0, 'A2')] });

test('le juge : vrai pour une fermée non cliente, faux pour une cliente et pour un id absent', () => {
  const D = faux(['F1', 'C1']);
  D.p.push(pt(47.03, 0.03, 1, 'C1'));   // fermée à l'annuaire MAIS cliente : jamais retirée
  const f = juge(D);
  assert.equal(f(D.p[1], D), true);
  assert.equal(f(D.p[3], D), false);
  assert.equal(f(D.p[0], D), false);
  assert.equal(f(pt(1, 1, 0, 'ZZ'), D), false);
  assert.equal(juge(faux(null))(D.p[1], faux(null)), false, 'sans meta.fermees : personne n\'est retiré');
});

// Chaque carte appelle bien le juge (contrôle de texte).
const modules = ['v2-carte.js', 'v2-carte-secteur.js', 'v2-carte-secteur-pur.js', 'v2-carte-groupements.js', 'v2-potentiel-secteur.js',
  'v2-tournee-select.js', 'v2-tournees-carte.js', 'v2-tournees.js', 'v2-tournees-essentiels.js'];
for (const m of modules) test('le module ' + m + ' appelle le juge des fermées', () => {
  assert.match(lire(m), /pfFermee|\.fermee\(|fermeeCip\(/, m);
});
test('La carte : pass(), llOK() et computeProspects() appellent le juge', () => {
  const s = lire('v2-carte.js');
  const corps = nom => s.slice(s.indexOf(nom), s.indexOf(nom) + 400);
  assert.match(corps('function pass(p) {'), /pfFermee\(p, D\)\) return false/);
  assert.match(corps('function llOK(p)'), /pfFermee/);
  assert.match(corps('function computeProspects()'), /pfFermee/);
});
test('la reprise d\'une tournée enregistrée par identifiants n\'est pas filtrée', () => {
  const s = lire('v2-carte.js'), i = s.indexOf('voulus[String(p[13])]');
  assert.ok(i > 0); assert.doesNotMatch(s.slice(i - 300, i + 200), /pfFermee/);
});

// ── Essais réels sur trois modules ──
function ctxPotentiel(D, avecJuge) {
  const dLat = km => km / 111.19, c = {}; c.window = c; vm.createContext(c);
  const sq = (id, a, b, l0, l1) => ({ type: 'Feature', properties: { code_iris: id }, geometry: { type: 'Polygon', coordinates: [[[l0, a], [l1, a], [l1, b], [l0, b], [l0, a]]] } });
  c.POTENTIEL_SECTEUR = { meta: { depts: ['49'] }, iris: [['A', 'a', 'x', '49', 47, 0, 1000, 100, 600, 200, 100, 50000]], geo: { type: 'FeatureCollection', features: [sq('A', 46.98, 47.03, -0.03, 0.03)] } };
  c.PHARMA_FR = D;
  if (avecJuge) { c.V2 = {}; vm.runInContext(jugeSrc, c); }
  vm.runInContext(lire('v2-potentiel-secteur.js'), c);
  return c;
}
test('Potentiel secteur : la fermée ne compte plus dans la zone ; sans juge, les 3 comptent', () => {
  const D = faux(['F1']);
  const a = ctxPotentiel(D, true).V2.potentielSecteur.zone(47, 0, 5);
  assert.equal(a.nbOff, 2); assert.ok(!a.officines.includes('F1')); assert.ok(a.officines.includes('A1') && a.officines.includes('A2'));
  const b = ctxPotentiel(faux(['F1']), false).V2.potentielSecteur.zone(47, 0, 5);
  assert.equal(b.nbOff, 3);
});

function ctxSelect(D, avecJuge) {
  const c = {}; c.window = c; vm.createContext(c); c.PHARMA_FR = D; c.V2 = {};
  if (avecJuge) vm.runInContext(jugeSrc, c);
  vm.runInContext(lire('v2-tournee-select.js'), c);
  return c.V2.tourneeSelect({ destLat: 47.01, destLng: 0.01, radiusKm: 50, maxStops: 8 });
}
test('Tournée automatique : la fermée n\'est pas proposée ; sans juge, les 3 le sont', () => {
  assert.deepEqual(Array.from(ctxSelect(faux(['F1']), true)).sort(), [0, 2]);
  assert.deepEqual(Array.from(ctxSelect(faux(['F1']), false)).sort(), [0, 1, 2]);
});

test('Ma carte (calcul pur) : indicesDuSecteur et indicesDeUga sautent la fermée ; sans juge, les 3', () => {
  const P = require('../crm/v2/v2-carte-secteur-pur.js'), D = faux(['F1']), f = juge(D);
  const ctx = (fermee) => ({ pts: D.p, uga: D.uga, grp: D.grp, commsOf: () => [], isClient: () => false, fermee });
  const S = { nom: 'X', ugas: { 0: true } };
  assert.deepEqual(P.indicesDuSecteur(S, ctx(p => f(p, D))), [0, 2]);
  assert.deepEqual(P.indicesDuSecteur(S, ctx(undefined)), [0, 1, 2]);
  assert.deepEqual(P.indicesDeUga(0, ctx(p => f(p, D))), [0, 2]);
  assert.deepEqual(P.indicesDeUga(0, ctx(undefined)), [0, 1, 2]);
});
