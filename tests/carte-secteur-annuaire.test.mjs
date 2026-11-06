// Petite carte du secteur (écran Pharmacies, onglet Carte) alignée sur la grande (06/11/2026, décision de Will) :
// V2.pointAnnuaire rend le point de l'annuaire (même code, sinon jumelle), sauf deux codes postaux CONNUS de départements
// différents (Persan 95 / Chambly 60). Rejoue la VRAIE règle (extraite de v2-app.js), sur les vraies données versionnées
// puis sur des lignes fabriquées pour chaque cas du garde-fou. Aucun total en dur : ils bougent à chaque mise à jour des stats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = new URL('../crm/v2/', import.meta.url);
const lire = f => fs.readFileSync(new URL(f, R), 'utf8');
const app = lire('v2-app.js');
const code = app.slice(app.indexOf('  V2.JUMEAUX = {'), app.indexOf('  V2.pfPoser = function'));
const dig = x => String(x == null ? '' : x).replace(/[^0-9]/g, '');
function regle(win) {
  const V2 = { seuilsPalier: () => ({ a: 40000, b: 12000, mois: 8 }), canonGrp: n => n, pfPoser: (p, c, v) => { p[c] = v; } };
  new Function('V2', 'window', code)(V2, win);
  return V2;
}
function vraies() {
  const w = {}; w.window = w;
  new Function('window', lire('pharma-fr-data.js') + ';' + lire('wml-officines-data.js') + ';window.WML_OFFICINES=WML_OFFICINES;')(w);
  return { w, V2: regle(w), W: w.WML_OFFICINES, D: w.PHARMA_FR };
}
function fabriquee(lignes) {
  const w = { PHARMA_FR: { p: lignes, seg: ['Prospect'], grp: ['—'] }, WML_OFFICINES: [] }; w.window = w;
  return { w, V2: regle(w), D: w.PHARMA_FR };
}
// ligne d'annuaire : [lat, lng, uga, grp, seg, …, nom (6), ville (7), cp (8), …, code (13)]
const L = (code, lat, lng, cp) => [lat, lng, 0, 0, 0, 0, 'P ' + code, 'VILLE', cp, '', '', '', 0, code];

test('vraies données : chaque cliente prend le point de la GRANDE carte (sa ligne après réconciliation), sauf département contraire', () => {
  const s = vraies(); s.V2.reconcilePharma(true);
  const ligne = {}; s.D.p.forEach(p => { const k = dig(p[13]); if (k && !ligne[k] && !p._wml) ligne[k] = p; });
  let avec = 0, ecartees = [];
  for (const o of s.W) {
    const c = dig(o.id), l = ligne[c], pt = s.V2.pointAnnuaire(o.id, o.cp);
    if (!l) { assert.equal(pt, null, c); continue; }
    const a = dig(l[8]).padStart(5, '0').slice(0, 2), b = dig(o.cp).padStart(5, '0').slice(0, 2);
    if (dig(o.cp) && a !== b && !(a === '20' && b === '20')) { assert.equal(pt, null, c); ecartees.push(c); continue; }
    if (pt === null) { ecartees.push(c); continue; }   // Corse 2A / 2B ou DOM : contrôlé plus bas sur des lignes fabriquées
    assert.deepEqual(pt, [l[0], l[1]], c); avec++;
  }
  assert.ok(avec > 1900, 'clientes au point de l\'annuaire : ' + avec);
  assert.ok(ecartees.length < 10, 'écartées : ' + ecartees.join(' '));
});
test('vraies données : plus de 1 000 clientes quittent le point qu\'elles partageaient au centre de leur commune', () => {
  const s = vraies(); s.V2.reconcilePharma(true);
  const k = (a, b) => a.toFixed(5) + '/' + b.toFixed(5), pile = {};
  s.W.forEach(o => { if (typeof o.lat === 'number') pile[k(o.lat, o.lng)] = (pile[k(o.lat, o.lng)] || 0) + 1; });
  const parties = s.W.filter(o => typeof o.lat === 'number' && pile[k(o.lat, o.lng)] >= 2 && s.V2.pointAnnuaire(o.id, o.cp));
  assert.ok(parties.length > 1000, String(parties.length));
});
test('l\'ordre ne compte pas : index fait avant la réconciliation = index fait après', () => {
  const t = vraies(), avant = t.W.map(o => JSON.stringify(t.V2.pointAnnuaire(o.id, o.cp)));
  t.V2.reconcilePharma(true);
  const apres = t.W.map(o => JSON.stringify(t.V2.pointAnnuaire(o.id, o.cp)));
  const u = vraies(); u.V2.reconcilePharma(true);
  assert.deepEqual(apres, avant); assert.deepEqual(u.W.map(o => JSON.stringify(u.V2.pointAnnuaire(o.id, o.cp))), avant);
});
test('cas connus : Beaulieu (jumelle 440014009) à Nantes, Porte d\'Azur (jumelle 830004446) à Bandol même sans code postal', () => {
  const s = vraies();
  assert.deepEqual(s.V2.pointAnnuaire('2011018', '44200'), [47.20448, -1.53506]);
  assert.deepEqual(s.V2.pointAnnuaire('2211215', ''), [43.14193, 5.74847]);
  assert.deepEqual(s.V2.pointAnnuaire('2211215', '83150'), [43.14193, 5.74847]);
  assert.equal(s.V2.pointAnnuaire('2261821', '95340'), null);   // Persan / Chambly : mis de côté par Will
});
test('garde-fou du département sur des lignes fabriquées', () => {
  const s = fabriquee([L('9000001', 45.1, 5.1, '38000'), L('9000002', 41.9, 8.7, '20000'), L('9000003', 16.2, -61.5, '97110'),
    L('9000004', 46.2, 5.2, '1000'), L('9000005', 0, 0, '75001')]);
  assert.equal(s.V2.pointAnnuaire('9000001', '73000'), null);            // Isère / Savoie
  assert.deepEqual(s.V2.pointAnnuaire('9000001', '38100'), [45.1, 5.1]);
  assert.deepEqual(s.V2.pointAnnuaire('9000001', ''), [45.1, 5.1]);     // code postal de la cliente inconnu : rien ne contredit
  assert.deepEqual(s.V2.pointAnnuaire('9000001', null), [45.1, 5.1]);
  assert.equal(s.V2.pointAnnuaire('9000002', '20200'), null);            // Corse-du-Sud / Haute-Corse
  assert.equal(s.V2.pointAnnuaire('9000003', '97200'), null);            // Guadeloupe / Martinique
  assert.deepEqual(s.V2.pointAnnuaire('9000004', '01500'), [46.2, 5.2]); // « 1000 » = 01000, Ain
  assert.equal(s.V2.pointAnnuaire('9000005', '75001'), null);            // ligne sans position
  assert.equal(s.V2.pointAnnuaire('9999999', '38000'), null);            // pas de ligne
  assert.equal(s.V2.pointAnnuaire('', '38000'), null);
});
test('ligne ajoutée par la grande carte avec le point WML ignorée ; doublon de code = la première ; index refait quand la base grandit', () => {
  const w = L('9000010', 47.2, -1.55, '44000'); w._wml = true;
  const s = fabriquee([w, L('9000011', 47.1, -1.5, '44000'), L('9000011', 47.9, -1.9, '44000')]);
  assert.equal(s.V2.pointAnnuaire('9000010', '44000'), null);
  assert.deepEqual(s.V2.pointAnnuaire('9000011', '44000'), [47.1, -1.5]);
  s.D.p.push(L('9000012', 47.3, -1.6, '44000'));
  assert.deepEqual(s.V2.pointAnnuaire('9000012', '44000'), [47.3, -1.6]);
});
test('jumelle : trouvée sous son code annuaire avant la réconciliation, sous le code cliente après', () => {
  const s = fabriquee([L('440014009', 47.20448, -1.53506, '44200')]);
  assert.deepEqual(s.V2.pointAnnuaire('2011018', '44200'), [47.20448, -1.53506]);
  s.w.WML_OFFICINES = [{ id: '2011018', ca: 1, cp: '44200' }]; s.V2.reconcilePharma(true);
  assert.equal(s.D.p[0][13], '2011018');
  assert.deepEqual(s.V2.pointAnnuaire('2011018', '44200'), [47.20448, -1.53506]);
});
test('sans annuaire chargé : pas de point (la carte garde le point WML)', () => {
  const w = {}; w.window = w; const V2 = regle(w);
  assert.equal(V2.pointAnnuaire('2011018', '44200'), null);
});
