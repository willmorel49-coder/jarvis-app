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

// ── « Visite » (24/11/2026) : une officine vue tel jour, cliente ou prospect, et la suite à donner ──
// Données FICTIVES : l'officine du fichier vient de monter() (id 111), le prospect de l'annuaire est inventé (id ZZ900).
function visitePrete({ annuaire = true, noteOk = true, ligneOk = true } = {}) {
  const base = fausseBase({});
  const ctx = monter([MOIS], agendaPret(base));
  ctx.V2RECO = { apparier: () => ({}) };
  const notes = [], lignes = [], toasts = [];
  ctx.V2.notes = { addAuto: (st, sid, body, q) => { notes.push({ st, sid, body, q }); return Promise.resolve(noteOk); } };
  ctx.V2.todo.ajouterLigne = (l) => { lignes.push(l); return Promise.resolve(ligneOk); };
  ctx.V2.toast = (m, t) => toasts.push({ m, t });
  if (annuaire) ctx.PHARMA_FR = { p: [[0, 0, '', '', '', '', 'PHARMACIE DU PROSPECT FICTIF', 'ROUEN', '76000', '', '', '', 0, 'ZZ900']] };
  const champs = {};
  ctx.document.getElementById = (id) => champs[id] || null;
  const saisir = (o) => Object.keys(o).forEach((k) => { champs[k] = { value: o[k] }; });
  return { ctx, V2: ctx.V2, notes, lignes, toasts, saisir };
}
const ymd = (s, n) => { const p = s.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2] + n, 12); return isoLocal(d); };

test('visite : une cliente du fichier, sans suite → une note « Visite », aucune ligne To do', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  assert.match(t.V2.todoMois.html(), /Noter une visite/, 'marqueur : le formulaire Visite est affiché');
  t.V2.todoMois.visiteChoisir('111');
  t.saisir({ 'tm-date': AUJ, 'tm-txt': 'Passé au comptoir' });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 1);
  assert.deepEqual([t.notes[0].st, t.notes[0].sid, t.notes[0].q], ['client', '111', null]);
  assert.equal(t.notes[0].body, 'Visite : Passé au comptoir');
  assert.equal(t.lignes.length, 0);
  assert.match(t.toasts.at(-1).m, /^Visite notée au /);
});

test('visite : un prospect de l’annuaire, à relancer dans 2 semaines → note sur son id + ligne To do datée', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.saisir({ 'tm-q': 'prospect fictif' });
  t.V2.todoMois.visiteChercher();
  t.V2.todoMois.visiteChoisir('ZZ900');
  assert.equal(t.V2.todoMois.etat.form.off.id, 'ZZ900', 'marqueur : le prospect de l’annuaire est retenu');
  t.V2.todoMois.visiteSuite('relance');
  t.saisir({ 'tm-date': AUJ, 'tm-txt': '' });
  t.V2.todoMois.visiteDans(14);
  const attendu = ymd(AUJ, 14);
  assert.equal(t.V2.todoMois.etat.form.dsuite, attendu, 'le raccourci compte depuis la date de visite');
  t.saisir({ 'tm-dsuite': attendu });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes[0].sid, 'ZZ900');
  assert.match(t.notes[0].body, /^Visite — PHARMACIE DU PROSPECT FICTIF · relance prévue le \d\d\/\d\d\/\d{4}$/, 'un prospect : la note porte son nom');
  assert.equal(t.lignes.length, 1);
  assert.deepEqual([t.lignes[0].k, t.lignes[0].pid, t.lignes[0].note, t.lignes[0].pour], ['libre', 'ZZ900', 'Relancer', attendu]);
  assert.match(t.toasts.at(-1).m, /^Visite notée au .* · relance le /);
});

test('visite : la recherche ne sort que des résultats du fichier tant que l’annuaire n’est pas chargé', async () => {
  const t = visitePrete({ annuaire: false });
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.saisir({ 'tm-q': 'prospect' });
  t.V2.todoMois.visiteChercher();
  const h = t.V2.todoMois.html();
  assert.match(h, /Chercher aussi dans l’annuaire national/);
  assert.equal(t.V2.todoMois.etat.form.off, null);
});

test('visite : une date passée part en created_at du bon jour', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.V2.todoMois.visiteChoisir('111');
  const passe = ymd(AUJ, -40);
  t.saisir({ 'tm-date': passe, 'tm-txt': '' });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 1, 'marqueur : la note est partie');
  assert.notEqual(t.notes[0].q, null);
  assert.equal(isoLocal(new Date(t.notes[0].q)), passe);
});

test('visite : sans officine retenue, rien ne part et le refus est dit', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.saisir({ 'tm-date': AUJ });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 0); assert.equal(t.lignes.length, 0);
  assert.equal(t.toasts.at(-1).m, 'Choisissez l’officine dans la liste.');
});

test('visite : une suite sans date valide est refusée avant tout envoi', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.V2.todoMois.visiteChoisir('111'); t.V2.todoMois.visiteSuite('revisite');
  t.saisir({ 'tm-date': AUJ, 'tm-dsuite': '' });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 0); assert.equal(t.lignes.length, 0);
  assert.match(t.toasts.at(-1).m, /Indiquez la date/);
});

test('visite : note passée mais ligne To do refusée → échec partiel dit, jamais « Visite notée » seul, et le réessai ne double pas la note', async () => {
  const t = visitePrete({ ligneOk: false });
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.V2.todoMois.visiteChoisir('111'); t.V2.todoMois.visiteSuite('revisite');
  const d = ymd(AUJ, 7);
  t.saisir({ 'tm-date': AUJ, 'tm-txt': 'À revoir', 'tm-dsuite': d });
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 1, 'marqueur : la note est partie');
  assert.equal(t.lignes.length, 1);
  assert.equal(t.toasts.at(-1).m, 'Visite notée, mais la nouvelle visite n’a pas été enregistrée, réessayez.');
  assert.ok(!t.toasts.some((x) => /^Visite notée au/.test(x.m)), 'aucun faux succès');
  assert.equal(t.V2.todoMois.etat.form.txt, 'À revoir', 'ce qui a été tapé est gardé');
  t.V2.todoMois.enregistrer(); await attendre();
  assert.equal(t.notes.length, 1, 'le réessai ne recrée pas la note');
  assert.equal(t.lignes.length, 2);
});

test('visite : sans annuaire chargé, le mois montre le NOM du prospect (porté par la note), jamais « Officine ZZ900 »', async () => {
  const base = fausseBase({
    notes: [
      { id: 'n9', scope_type: 'client', scope_id: 'ZZ900', body: 'Visite — PHARMACIE DU PROSPECT FICTIF : vu la titulaire · relance prévue le 08/12/2026', created_at: midi(AUJ) },
      { id: 'n8', scope_type: 'client', scope_id: 'ZZ901', body: 'Note libre sans nom', created_at: midi(AUJ) }
    ]
  });
  const ctx = monter([MOIS], agendaPret(base));
  ctx.V2RECO = { apparier: () => ({}) };
  ctx.V2.todoMois.html(); await attendre();
  const h = ctx.V2.todoMois.html();
  assert.match(h, /Note libre sans nom/, 'marqueur : les notes du jour sont affichées');
  assert.match(h, /Prospect Fictif/, 'le nom relu dans la note de visite');
  assert.doesNotMatch(h, /Officine ZZ900/i);
  assert.match(h, /Officine ZZ901/i, 'une note ordinaire sans nom connu garde le repli d’avant');
});

test('visite : un raccourci ou un jour touché gagne sur la case encore affichée (vu au banc WebKit le 24/11 : la date restait vide)', async () => {
  const t = visitePrete();
  t.V2.todoMois.html(); await attendre();
  t.V2.todoMois.ouvrir('visite', AUJ);
  t.V2.todoMois.visiteChoisir('111');
  t.V2.todoMois.visiteSuite('relance');
  t.saisir({ 'tm-date': AUJ, 'tm-dsuite': '' });   // l'écran montre la case de relance, encore vide
  t.V2.todoMois.visiteDans(7);
  assert.equal(t.V2.todoMois.etat.form.dsuite, ymd(AUJ, 7), 'la date du raccourci n’est pas écrasée par la case vide');
  assert.match(t.V2.todoMois.html(), new RegExp('id="tm-dsuite" type="date" value="' + ymd(AUJ, 7) + '"'), 'et elle s’affiche');
  const autre = ymd(AUJ, -3);
  t.V2.todoMois.choisir(autre);                    // la case « Date de la visite » montre encore AUJ
  assert.equal(t.V2.todoMois.etat.form.date, autre, 'le jour touché devient la date de visite');
});
