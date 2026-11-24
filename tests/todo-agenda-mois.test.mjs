// To do › « Agenda du mois » (crm/v2/v2-todo-mois.js) et la note datée à la main (crm/v2/v2-notes.js),
// chargés tels quels dans node:vm sur une FAUSSE base qui note chaque requête.
// Ce qu'on éprouve est le CHEMIN réel : le module lit-il vraiment rdv / rdv_occupe / notes avec les bons filtres,
// et une note datée part-elle vraiment avec son created_at ? Marqueur positif d'abord à chaque fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const R = new URL('../crm/v2/', import.meta.url);
const MOIS = readFileSync(new URL('v2-todo-mois.js', R), 'utf8');
const NOTES = readFileSync(new URL('v2-notes.js', R), 'utf8');

function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
const AUJ = isoLocal(new Date());
const midi = (j) => { const p = j.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12).toISOString(); };
const attendre = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

function fausseBase(lignes) {
  const lus = [], ecrits = [];
  const from = (t) => {
    const q = { t, f: [] };
    const o = {
      select() { return o; }, order() { return o; }, limit() { return o; }, single() { return o; },
      eq(k, v) { q.f.push(k + '=' + v); return o; }, gte(k, v) { q.f.push(k + '>=' + v); return o; },
      lte(k, v) { q.f.push(k + '<=' + v); return o; }, lt(k, v) { q.f.push(k + '<' + v); return o; },
      insert(l) { ecrits.push({ t, ligne: l }); q.ins = true; return o; },
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
      then(ok, ko) { if (!q.ins) lus.push(q); return Promise.resolve({ data: q.ins ? { id: 'x1' } : (lignes[t] || []), error: null }).then(ok, ko); }
    };
    return o;
  };
  return { sb: { from }, lus, ecrits };
}

function monter(fichiers, V2extra = {}) {
  const doc = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(t) {}, appendChild() {} }), head: { appendChild() {} },
    addEventListener() {}
  };
  const stock = {};
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, RegExp,
    document: doc, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
    localStorage: { getItem: (k) => stock[k] ?? null, setItem: (k, v) => { stock[k] = String(v); } },
    matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = Object.assign({ user: { id: 'u-moi', name: 'Moi' }, pharmacies: [{ id: '111', name: 'PHARMACIE DES TILLEULS', ville: 'CAEN' }] }, V2extra);
  vm.createContext(ctx);
  fichiers.forEach((f) => vm.runInContext(f, ctx));
  return ctx;
}

function agendaPret(base) {
  return {
    sb: () => base.sb,
    todo: { tous: () => [], libelle: (t) => t.note, tombeLe: () => false },
    rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve({ actif: true }) },
    rdvAlias: { charger: () => Promise.resolve({}) },
    planningIndex: () => ({ porte: [], nat: [] }),
    planningAppelerAgenda: () => Promise.resolve({ ok: true, evenements: [
      { date: AUJ, debut: '14:00:00', fin: '14:45:00', jour_entier: false, titre: 'RDV Pharmacie des Tilleuls' },
      { date: AUJ, debut: '18:00:00', fin: '19:00:00', jour_entier: false, titre: 'Dentiste' }
    ] })
  };
}

test('l’agenda du mois lit SES rendez-vous, SES heures occupées et SES notes du mois affiché', async () => {
  const base = fausseBase({
    rdv: [{ date: AUJ, heure: '10:00:00', duree_min: 45, nom: 'PHARMACIE DU PORT', ville: 'CAEN' }],
    rdv_occupe: [
      { date: AUJ, debut: '10:00:00', fin: '10:45:00', jour_entier: false },   // le rendez-vous JARVIS recopié dans Google
      { date: AUJ, debut: '14:00:00', fin: '14:45:00', jour_entier: false },   // reconnu : les Tilleuls
      { date: AUJ, debut: '16:00:00', fin: '17:00:00', jour_entier: false }    // un occupé sans nom
    ],
    notes: [{ id: 'n1', scope_type: 'client', scope_id: '111', body: 'Commande de Noël à relancer', created_at: midi(AUJ) }]
  });
  const ctx = monter([MOIS], agendaPret(base));
  ctx.V2RECO = { apparier: (titre) => /tilleuls/i.test(titre) ? { officine: { name: 'PHARMACIE DES TILLEULS', ville: 'CAEN' }, etat: 'sur' } : {} };
  const V2 = ctx.V2;
  assert.equal(typeof V2.todoMois, 'object', 'marqueur : le module est chargé');
  V2.todoMois.html(); await attendre();
  const h = V2.todoMois.html();

  const ym = AUJ.slice(0, 7), y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  const q = (t) => base.lus.filter((x) => x.t === t).map((x) => x.f.join(','));
  assert.ok(q('rdv').some((f) => f.includes('user_id=u-moi') && f.includes('statut=confirme') && f.includes('date>=' + ym + '-01')), 'rdv : les siens, confirmés, depuis le 1er du mois');
  assert.ok(q('rdv_occupe').some((f) => f.includes('user_id=u-moi') && f.includes('date>=' + ym + '-01')), 'rdv_occupe : les siennes');
  assert.ok(q('notes').some((f) => f.includes('author_id=u-moi') && f.includes('created_at>=' + new Date(y, m - 1, 1).toISOString()) && f.includes('created_at<' + new Date(y, m, 1).toISOString())), 'notes : les siennes, du mois');

  assert.match(h, /Pharmacie Du Port/, 'le rendez-vous JARVIS');
  assert.match(h, /Pharmacie Des Tilleuls/, 'l’officine reconnue dans l’agenda personnel, avec son nom');
  assert.match(h, /16h00<\/span><span class="tm-lt"><b>Occupé<\/b>/, 'l’occupé sans nom');
  assert.doesNotMatch(h, /10h00<\/span><span class="tm-lt"><b>Occupé/, 'l’occupé qui recopie le rendez-vous JARVIS est retiré');
  assert.doesNotMatch(h, /Dentiste/, 'un titre non reconnu ne s’affiche jamais');
  assert.match(h, /Commande de Noël à relancer/, 'la note du jour');
  assert.match(V2.todoMois.phrase(), /<b class="td-num">2<\/b> rendez-vous et <b class="td-num">1<\/b> note/, 'la phrase compte ce qui est affiché');
});

test('les officines arrivées APRÈS la première lecture sont reconnues quand même (vu le 23/11 dans le Safari de Will)', async () => {
  const base = fausseBase({ rdv: [], rdv_occupe: [{ date: AUJ, debut: '14:00:00', fin: '14:45:00', jour_entier: false }], notes: [] });
  const ctx = monter([MOIS], agendaPret(base));
  const V2 = ctx.V2, toutes = V2.pharmacies;
  V2.pharmacies = [];   // l'app vient de s'ouvrir : le portefeuille n'est pas encore là
  V2.planningIndex = () => ({ porte: V2.pharmacies.slice(), nat: [] });
  ctx.V2RECO = { apparier: (titre, porte) => porte.length && /tilleuls/i.test(titre) ? { officine: { name: 'PHARMACIE DES TILLEULS', ville: 'CAEN' }, etat: 'sur' } : {} };
  V2.todoMois.html(); await attendre();
  assert.doesNotMatch(V2.todoMois.html(), /Pharmacie Des Tilleuls/, 'marqueur : sans portefeuille, rien de reconnu');
  V2.pharmacies = toutes;
  assert.match(V2.todoMois.html(), /Pharmacie Des Tilleuls/, 'le portefeuille arrivé, l’officine est reconnue sans rouvrir l’onglet');
});

test('une lecture ratée le dit, au lieu d’un mois qui aurait l’air vide', async () => {
  const base = fausseBase({});
  // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
  base.sb.from = () => { const o = { select: () => o, eq: () => o, gte: () => o, lte: () => o, lt: () => o, order: () => o, then: (ok, ko) => Promise.resolve({ data: null, error: { message: 'x' } }).then(ok, ko) }; return o; };
  const ctx = monter([MOIS], agendaPret(base));
  ctx.V2RECO = { apparier: () => ({}) };
  ctx.V2.todoMois.html(); await attendre();
  assert.match(ctx.V2.todoMois.html(), /n’ont pas pu être lus/);
});

test('une note datée à la main part avec son created_at ; sans date, la base pose la sienne', async () => {
  const base = fausseBase({});
  const ctx = monter([NOTES], { sb: () => base.sb });
  const V2 = ctx.V2;
  assert.equal(typeof V2.notes.addAuto, 'function', 'marqueur : le module des notes est chargé');
  const quand = new Date(2026, 9, 14, 9, 30).toISOString();
  assert.equal(await V2.notes.addAuto('client', '111', 'Vu le titulaire', quand), true);
  assert.equal(await V2.notes.addAuto('client', '111', 'Note du jour'), true);
  assert.equal(base.ecrits.length, 2);
  assert.equal(base.ecrits[0].ligne.created_at, quand, 'la date choisie est écrite');
  assert.equal('created_at' in base.ecrits[1].ligne, false, 'sans date : rien d’imposé à la base');
  assert.equal(base.ecrits[0].ligne.author_id, 'u-moi');
});

test('l’agenda du mois enregistre une note datée dans le passé par la vraie fonction des notes', async () => {
  const base = fausseBase({});
  const ctx = monter([MOIS], agendaPret(base));
  ctx.V2RECO = { apparier: () => ({}) };
  const appels = [];
  ctx.V2.notes = { addAuto: (st, sid, body, q) => { appels.push({ st, sid, body, q }); return Promise.resolve(true); } };
  ctx.V2.toast = () => {};
  const passe = isoLocal(new Date(Date.now() - 40 * 864e5));
  const champs = { 'tm-off': { value: 'Pharmacie des Tilleuls' }, 'tm-date': { value: passe }, 'tm-txt': { value: 'Compte rendu' } };
  ctx.document.getElementById = (id) => champs[id] || null;
  ctx.V2.todoMois.html(); await attendre();
  ctx.V2.todoMois.ouvrir('note', AUJ);
  ctx.V2.todoMois.enregistrer(); await attendre();
  assert.equal(appels.length, 1, 'marqueur : la note est partie');
  assert.deepEqual([appels[0].st, appels[0].sid, appels[0].body], ['client', '111', 'Compte rendu']);
  assert.equal(isoLocal(new Date(appels[0].q)), passe, 'created_at tombe le jour choisi');
});
