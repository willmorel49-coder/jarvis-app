// Mode « Prospection » de La carte (26/10/2026) : calcul de distance au tracé + verrou « Will seul ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.V2 = {};
const V2 = globalThis.V2;
const C = require('../crm/v2/v2-carte-prospection.js');

// Tournée de test : trait droit de 0,5° de longitude le long de 47,5° N
const T = { T1: { trace: [[47.5, -1.5], [47.5, -1.0]] }, T2: { trace: [[48.5, 0.0], [48.5, 0.5]] } };
const proj = C.projeter(T);
const KM_LAT = 110.574;

test('un point posé sur le tracé est à 0 km', () => {
  assert.equal(C.plusProche(47.5, -1.25, proj).km, 0);
  assert.equal(C.plusProche(47.5, -1.5, proj).km, 0);   // sur un arrêt
});
test('10 km plein nord du tracé = 10 km, et la bonne tournée', () => {
  const r = C.plusProche(47.5 + 10 / KM_LAT, -1.25, proj);
  assert.equal(r.km, 10); assert.equal(r.code, 'T1');
});
test('au-delà du bout du tracé : distance au dernier arrêt, pas à la droite prolongée', () => {
  const lng = -1.0 + 5 / (111.320 * Math.cos(47.5 * Math.PI / 180));
  assert.ok(Math.abs(C.plusProche(47.5, lng, proj).km - 5) < 0.01);
});
test('une officine très loin reste très loin (Brest)', () => assert.ok(C.plusProche(48.39, -4.48, proj).km > 150));
test('tracé d\'un seul point : distance au point ; tracé vide : jamais « 0 km »', () => {
  assert.ok(Math.abs(C.dTrace(C.xy(47.5 + 3 / KM_LAT, -1.5), [C.xy(47.5, -1.5)]) - 3) < 1e-6);
  assert.equal(C.dTrace([0, 0], []), Infinity);
});

test('prospects : 8 départements, jamais une cliente de personne, sans position à part, triés par distance', () => {
  const L = (cip, cp, lat, lng) => [lat, lng, 0, 0, 0, 0, 'N' + cip, 'V', cp, '', '', '', 0, cip];
  const pts = [
    L('1', '49000', 47.5 + 8 / KM_LAT, -1.25),   // 8 km
    L('2', '49000', 47.5 + 2 / KM_LAT, -1.25),   // 2 km
    L('3', '49000', 47.5 + 1 / KM_LAT, -1.25),   // cliente (d'un autre commercial) : exclue
    L('4', '29200', 47.5, -1.25),                // Finistère : hors secteur
    L('5', '49000', 0, 0),                       // sans position
    L('6', '', 47.5, -1.25),                     // sans code postal
  ];
  const r = C.prospects(pts, { '3': [] }, proj);
  assert.deepEqual(r.liste.map(x => x.cip), ['2', '1']);
  assert.equal(r.sansPosition, 1);
  assert.equal(C.dans(r.liste, 5), 1); assert.equal(C.dans(r.liste, 8), 2); assert.equal(C.dans(r.liste, 1), 0);
});

test('couleurs : rouge > vert > gris > bleu, « attente » tant que le suivi n\'est pas lu', () => {
  const S = { pret: true, rouge: { a: 1 }, rdv: { a: '2026-11-01', b: '2026-11-01' }, vu: k => (k === 'a' || k === 'b' || k === 'c') ? '2026-09-01' : null };
  assert.equal(C.etat('a', S), 'rouge'); assert.equal(C.etat('b', S), 'vert');
  assert.equal(C.etat('c', S), 'gris'); assert.equal(C.etat('d', S), 'bleu');
  assert.equal(C.etat('d', { pret: false }), 'attente');
  assert.equal(C.etat('d', { pret: true, rouge: null, rdv: null, vu: () => null }), 'bleu');
});

test('dates : jour local, format français', () => {
  assert.equal(C.aujourdhui(new Date(2026, 9, 5, 0, 30)), '2026-10-05');
  assert.equal(C.fr('2026-10-05'), '05/10/2026'); assert.equal(C.fr(''), '');
  assert.equal(C.jours(['lundi', 'jeudi']), 'lun, jeu');
});

// ── Verrou : le mode n'existe que sur un OUI de jarvis_acces_connexions() (RPC existante, Will + compte de preuve) ──
const ACCES = 'jarvis_acces_connexions';
function faux(reponses, journal) {
  return { rpc: (nom) => { journal.push('rpc:' + nom); const r = reponses[nom]; return r instanceof Error ? Promise.reject(r) : Promise.resolve(r); }, from: () => { throw new Error('pas de table ici'); } };
}
async function essai(reponses, fichier) {
  const j = []; const S = C.etatInterne;
  S.ok = null; S.verif = null;
  delete globalThis.PROSPECTION_TOURNEES;
  V2.user = { id: 'u' }; V2.sb = () => faux(reponses, j);
  V2.loadFiles = (cles) => { j.push('fichier:' + cles.join(',')); if (fichier) globalThis.PROSPECTION_TOURNEES = fichier; return Promise.resolve(); };
  const ok = await C.verifier(true);
  return { ok, j, bouton: C.bouton() };
}
test('verrou : réponse « non » → pas de bouton, le fichier des tournées n\'est jamais demandé', async () => {
  const r = await essai({ [ACCES]: { data: false } }, { tournees: { T1: {} } });
  assert.equal(r.ok, false); assert.equal(C.ok(), false); assert.equal(r.bouton, '');
  await assert.rejects(C.demanderDonnees());
  assert.deepEqual(r.j, ['rpc:' + ACCES]);
});
test('verrou : erreur de la base ou rejet → NON (jamais « oui » par défaut)', async () => {
  assert.equal((await essai({ [ACCES]: { data: null, error: { message: 'x' } } })).ok, false);
  assert.equal((await essai({ [ACCES]: new Error('réseau') })).ok, false);
  assert.equal((await essai({ [ACCES]: { data: 'true' } })).ok, false);
});
test('verrou : pas de session → non, aucun appel', async () => {
  C.etatInterne.verif = null; delete V2.user; const j = []; V2.sb = () => faux({}, j);
  assert.equal(await C.verifier(true), false); assert.deepEqual(j, []);
});
test('verrou : « oui » → bouton ; les tournées ne se demandent qu\'ensuite ; fichier absent ou vide = erreur', async () => {
  let r = await essai({ [ACCES]: { data: true } }, { tournees: { T1: {} }, clientes: [] });
  assert.equal(r.ok, true); assert.match(r.bouton, /Prospection/);
  assert.deepEqual(r.j, ['rpc:' + ACCES]);   // rien d'autre tant qu'on n'ouvre pas le mode
  assert.deepEqual((await C.demanderDonnees()).tournees, { T1: {} });
  assert.deepEqual(r.j, ['rpc:' + ACCES, 'fichier:prospection']);
  await essai({ [ACCES]: { data: true } }, null);
  await assert.rejects(C.demanderDonnees());
});

// ── Suivi : une ligne `profils` par utilisateur (modèle u2ScopeId), relue avant d'être réécrite ──
function fauxProfils(depart) {
  const base = { ligne: depart || null, ecritures: [] };
  const q = (filtres) => ({
    select() { return this; }, eq(k, v) { filtres[k] = v; return this; },
    maybeSingle() { return Promise.resolve({ data: base.ligne ? { data: base.ligne } : null, error: null }); },
    upsert(l, o) { base.ecritures.push([l, o, filtres]); base.ligne = l.data; return Promise.resolve({ error: null }); },
  });
  base.client = { from: (t) => { assert.equal(t, 'profils'); return q({}); } };
  return base;
}
test('suivi : rangé dans profils (groupement, __prospection_<id>__), colonnes séparées, effacer = retirer', async () => {
  const b = fauxProfils(null); V2.user = { id: 'u1', name: 'Will' }; V2.sb = () => b.client;
  assert.equal(await C.ecrireSuiviPrive('111', 'mail_envoye_le', '2026-10-26'), true);
  assert.equal(await C.ecrireSuiviPrive('111', 'relance_le', '2026-11-09'), true);
  const [l, o] = b.ecritures[1];
  assert.equal(l.scope_type, 'groupement'); assert.equal(l.scope_id, '__prospection_u1__'); assert.equal(l.updated_by, 'u1');
  assert.equal(o.onConflict, 'scope_type,scope_id');
  assert.deepEqual(l.data.s['111'], { m: '2026-10-26', r: '2026-11-09' });
  assert.deepEqual(await C.lireSuiviPrive(), { '111': { mail: '2026-10-26', relance: '2026-11-09', liste: '' } });
  await C.ecrireSuiviPrive('111', 'mail_envoye_le', '');
  assert.deepEqual(b.ligne.s['111'], { r: '2026-11-09' });
  await C.ecrireSuiviPrive('111', 'relance_le', '');
  assert.deepEqual(b.ligne.s, {});
  assert.equal(await C.ecrireSuiviPrive('111', 'autre', 'x'), false);
});
test('suivi : lecture ratée = null (jamais « vide »)', async () => {
  V2.user = { id: 'u1' }; V2.sb = () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) });
  assert.equal(await C.lireSuiviPrive(), null);
});

// ── Liste de diffusion (26/10/2026 soir) : souhait `l` dans le suivi, état Outlook dans une seconde ligne ──
const OUT = { maj: '2026-10-26T18:00:00', o: { p: 'b', h: 'a', e: 'e:2026-10-20' } };
const pv = (cip, liste) => ({ [cip]: { mail: '', relance: '', liste } });
test('diffusion : brouillon prêt → dans la liste ; « non » = retrait en attente', () => {
  assert.deepEqual(C.diffusion('p', {}, OUT), { etat: 'pret', dans: true, attente: '', le: '' });
  assert.deepEqual(C.diffusion('p', pv('p', 'non'), OUT), { etat: 'pret', dans: false, attente: 'retrait', le: '' });
  assert.deepEqual(C.diffusion('p', pv('p', 'oui'), OUT), { etat: 'pret', dans: true, attente: '', le: '' });   // souhait égal à Outlook : rien à reporter
});
test('diffusion : adresse sans brouillon → hors ; « oui » = ajout en attente', () => {
  assert.deepEqual(C.diffusion('h', {}, OUT), { etat: 'hors', dans: false, attente: '', le: '' });
  assert.deepEqual(C.diffusion('h', pv('h', 'oui'), OUT), { etat: 'hors', dans: true, attente: 'ajout', le: '' });
  assert.deepEqual(C.diffusion('h', pv('h', 'non'), OUT), { etat: 'hors', dans: false, attente: '', le: '' });
});
test('diffusion : mail parti, sans adresse, Outlook non lu', () => {
  assert.deepEqual(C.diffusion('e', pv('e', 'oui'), OUT), { etat: 'envoye', dans: false, attente: '', le: '2026-10-20' });
  assert.deepEqual(C.diffusion('zz', {}, OUT), { etat: 'sansmail', dans: false, attente: '', le: '' });
  assert.equal(C.diffusion('p', {}, null).etat, 'inconnu');
  assert.equal(C.diffusion('p', {}, undefined).etat, 'inconnu');
  assert.equal(C.diffusion('p', pv('p', 'non'), { maj: '', o: null }).etat, 'inconnu');
  assert.equal(C.diffusion('p', pv('p', 'non'), null).attente, '');   // inconnu : pas de bouton, pas de « retrait » inventé
  assert.equal(C.diffusion('toString', {}, OUT).etat, 'sansmail');     // pas de piège de prototype
  assert.equal(C.diffusion('x', {}, { o: { x: 'e:hier' } }).etat, 'sansmail');   // code mal formé : jamais « envoyé »
});
test('valeurSouhait : ne s\'écrit que si le souhait diffère d\'Outlook', () => {
  assert.equal(C.valeurSouhait('pret', false), 'non'); assert.equal(C.valeurSouhait('pret', true), '');
  assert.equal(C.valeurSouhait('hors', true), 'oui'); assert.equal(C.valeurSouhait('hors', false), '');
  assert.equal(C.valeurSouhait('envoye', true), null); assert.equal(C.valeurSouhait('sansmail', false), null); assert.equal(C.valeurSouhait('inconnu', true), null);
});
test('compteDiffusion : N et K calculés', () => {
  const o = { maj: '', o: { a: 'b', b: 'b', c: 'b', d: 'a', e: 'a', f: 'e:2026-10-01' } };
  const prive = { b: { liste: 'non' }, d: { liste: 'oui' }, c: { liste: 'oui' }, e: { liste: 'non' } };
  assert.deepEqual(C.compteDiffusion(prive, o), { n: 3, k: 2, lu: true });   // a, c, d dans la liste ; b (retrait) et d (ajout) en attente
  assert.deepEqual(C.compteDiffusion({}, o), { n: 3, k: 0, lu: true });      // a, b, c
  assert.equal(C.compteDiffusion({}, null).lu, false);
});

// Faux client à DEUX lignes profils, distinguées par scope_id
function fauxDeux(lignes, panne) {
  const ecr = [];
  const q = (f) => ({
    select() { return this; }, eq(k, v) { f[k] = v; return this; },
    maybeSingle() {
      if (panne && panne.includes(f.scope_id)) return Promise.resolve({ data: null, error: { message: 'x' } });
      return Promise.resolve({ data: lignes[f.scope_id] ? { data: lignes[f.scope_id] } : null, error: null });
    },
    upsert(l) { ecr.push(l); lignes[l.scope_id] = l.data; return Promise.resolve({ error: null }); },
  });
  return { ecr, client: { from: (t) => { assert.equal(t, 'profils'); return q({}); } } };
}
test('ecrireSuiviPrive : garde `l`, ne touche pas aux autres officines, retire la ligne quand plus rien', async () => {
  const f = fauxDeux({ '__prospection_u1__': { s: { 222: { m: '2026-10-01', r: '2026-11-01', l: 'oui' }, 333: { l: 'non' } } } });
  V2.user = { id: 'u1', name: 'Will' }; V2.sb = () => f.client;
  assert.equal(await C.ecrireSuiviPrive('111', 'liste_souhait', 'non'), true);
  assert.deepEqual(f.ecr[0].data.s, { 111: { l: 'non' }, 222: { m: '2026-10-01', r: '2026-11-01', l: 'oui' }, 333: { l: 'non' } });
  assert.equal(await C.ecrireSuiviPrive('222', 'mail_envoye_le', ''), true);   // effacer m : r et l restent
  assert.deepEqual(f.ecr[1].data.s['222'], { r: '2026-11-01', l: 'oui' });
  assert.equal(await C.ecrireSuiviPrive('111', 'liste_souhait', ''), true);    // souhait redevenu égal : `l` retiré, entrée supprimée
  assert.equal(f.ecr[2].data.s['111'], undefined); assert.ok(f.ecr[2].data.s['333']);
  assert.equal(await C.ecrireSuiviPrive('111', 'liste_souhait', 'peut-être'), false);   // valeur inconnue refusée
  assert.equal(f.ecr.length, 3);
  assert.equal(f.ecr[0].scope_type, 'groupement'); assert.equal(f.ecr[0].scope_id, '__prospection_u1__');
  assert.deepEqual((await C.lireSuiviPrive())['222'], { mail: '', relance: '2026-11-01', liste: 'oui' });
});
test('ecrireSuiviPrive : lecture ratée avant écriture = false, rien écrit', async () => {
  const f = fauxDeux({}, ['__prospection_u1__']); V2.user = { id: 'u1' }; V2.sb = () => f.client;
  assert.equal(await C.ecrireSuiviPrive('111', 'liste_souhait', 'non'), false); assert.equal(f.ecr.length, 0);
});
test('état Outlook : lu dans __prospection_outlook_<id>__ ; lecture ratée, ligne absente ou mal formée = null (→ inconnu)', async () => {
  V2.user = { id: 'u1' };
  let f = fauxDeux({ '__prospection_outlook_u1__': { maj: '2026-10-26T18:00:00', o: { 111: 'b', 222: 'a', 333: 'e:2026-10-20' } } });
  V2.sb = () => f.client;
  const o = await C.lireEtatOutlook();
  assert.deepEqual(o, { maj: '2026-10-26T18:00:00', o: { 111: 'b', 222: 'a', 333: 'e:2026-10-20' } });
  assert.equal(C.diffusion('111', {}, o).etat, 'pret');
  f = fauxDeux({ '__prospection_outlook_u1__': { maj: 'x', o: {} } }, ['__prospection_outlook_u1__']); V2.sb = () => f.client;
  assert.equal(await C.lireEtatOutlook(), null);
  f = fauxDeux({}); V2.sb = () => f.client; assert.equal(await C.lireEtatOutlook(), null);
  f = fauxDeux({ '__prospection_outlook_u1__': { maj: 'x', o: [1] } }); V2.sb = () => f.client; assert.equal(await C.lireEtatOutlook(), null);
  V2.sb = () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: () => Promise.reject(new Error('réseau')) }) });
  assert.equal(await C.lireEtatOutlook(), null);
  delete V2.user; assert.equal(await C.lireEtatOutlook(), null);
});
