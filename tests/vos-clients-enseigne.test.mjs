// 26/11/2026 — « Vos clients » disait 1 rendez-vous à venir sur 64 chez Will ; mesuré sur son agenda, il y en avait 6.
// Il écrit le nom d'ENSEIGNE (Google Maps) quand le fichier porte celui du titulaire, fait des fautes de frappe
// (« Pharmcie »), écrit la ville en clair (« long champs Rennes ») ou un nom propre (« Gouabau Pillet »).
// Puis le bouton d'envoi groupé des disponibilités aux clients sans rendez-vous. Officines et villes fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const ligne = (nom, ville, cp, id) => [0, 0, 0, 0, 0, 0, nom, ville, cp, '', '', '', '', id];

const FICHIER = [
  { id: '9300001', name: 'Pharmacie DUPONTEL', ville: 'VILLE-A', cp: '49001', comms: ['AAA'] },
  { id: '9300002', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-B', cp: '49002', comms: ['AAA'] },
  { id: '9300003', name: 'Pharmacie ZORGLUB - TRUCMUCHE SNC', ville: 'VILLE-C', cp: '49003', comms: ['AAA'] },
  { id: '9300004', name: 'PHARMACIE DES CHAMPS', ville: 'VILLE-D', cp: '49004', comms: ['AAA'] },
  { id: '9300005', name: 'Pharmacie ONILLAC', ville: 'VILLE-E', cp: '49005', comms: ['AAA'] },
  { id: '9300006', name: 'PHARMACIE SAINT ESSAI DE LA PLACE', ville: 'VILLE-F', cp: '49006', comms: ['AAA'] },
  { id: '9300007', name: 'Pharmacie BIDULE', ville: 'VILLE-G', cp: '49007', comms: ['AAA'] },
  { id: '9300008', name: 'PHARMACIE DU COLLEGUE', ville: 'VILLEBIS', cp: '35001', comms: ['BBB'] },
  { id: '9300009', name: 'PHARMACIE SAINT PAUL', ville: 'VILLE-H', cp: '49009', comms: ['BBB'] },
  { id: '9300010', name: 'PHARMACIE SAINT JEAN', ville: 'VILLE-I', cp: '49010', comms: ['BBB'] },
];
const ANNUAIRE = { p: [
  ligne('PHARMACIE DU COEUR DE BOURG', 'VILLE A', '49001', 9300001),
  ligne('PHARMACIE DU COEUR DE BOURG', 'VILLE LOINTAINE', '14999', 9399003),   // homonyme loin du secteur
  ligne('PHARMACIE DU LYS', 'VILLE E', '49005', 9300005),
  ligne('PHARMACIE LA GRANDE PRAIRIE', 'VILLE G', '49007', 9300007),
  ligne('PHARMACIE CENTRALE', 'GRAND', '88999', 9399001),                      // « GRAND » est aussi une commune
  ligne('PHARMACIE DES LONGS CHAMPS', 'VILLEBIS', '35002', 9399002),
  ligne('PHARMACIE DE LA PRAIRIE', 'VILLE LOINTAINE', '02999', 9399004),          // homonyme partiel, hors secteur
  ligne('PHARMACIE DES RIVES DU LOIR', 'VILLE LOIR', '49998', 9399005),
] };

function charger() {
  const ctx = { console, Date, Math, JSON, String, Number, Array, Object, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = { user: { id: 'u', commercial: 'AAA' }, pharmacies: FICHIER };
  ctx.PHARMA_FR = ANNUAIRE;
  vm.createContext(ctx);
  vm.runInContext(lire('v2-rdv-reco.js'), ctx);
  vm.runInContext(lire('v2-rdv-planning.js'), ctx);
  const idx = ctx.V2.planningIndex();
  return (titre) => ctx.V2RECO.apparier(titre, idx.porte, idx.nat, {}, idx.villes);
}

test('le nom d’enseigne d’un client (annuaire, même code) le désigne, même si un homonyme existe ailleurs', () => {
  const m = charger()('Phie cœur de bourg');
  assert.equal(m.etat, 'reconnu');
  assert.equal(String(m.officine.id), '9300001', 'son client, pas l’homonyme de l’annuaire');
});

test('une enseigne courte (« du lys ») suivie de la ville de l’officine', () => {
  const m = charger()('Pharmacie du lys Ville-E');
  assert.equal(m.etat, 'reconnu');
  assert.equal(String(m.officine.id), '9300005');
});

test('« Pharmcie » (faute de frappe) reste le mot pharmacie ; « pharmacien » non', () => {
  const app = charger();
  const m = app('Pharmcie des essais');
  assert.equal(m.etat, 'reconnu');
  assert.equal(String(m.officine.id), '9300002');
  assert.equal(app('Réunion pharmacien essais').officine, null, 'pharmacien n’est pas un marqueur (et réunion écarte le titre)');
});

test('une ville écrite en clair qui n’est pas la sienne écarte l’officine', () => {
  const m = charger()('Pharmacie long champs Villebis (prise de rdv physique)');
  assert.notEqual(String(m.officine && m.officine.id), '9300004', 'PHARMACIE DES CHAMPS est à VILLE-D, pas à Villebis');
});

test('une commune qui est aussi le début d’un mot du nom (« grand » / GRANDE) n’écarte rien', () => {
  const m = charger()('Pharmacie la grand prairie');
  assert.equal(String(m.officine && m.officine.id), '9300007');
});

test('un nom propre de son client vaut « à confirmer » ; un mot courant (SAINT) non', () => {
  const app = charger();
  const m = app('Pharmacie Zorglub Pillet');
  assert.equal(m.etat, 'confirmer');
  assert.equal(String(m.officine.id), '9300003');
  assert.equal(app('Phie Saint vigor').officine, null);
});

// ── l'écran : attendre l'annuaire avant de compter, puis le bouton d'envoi groupé ──
function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const attendre = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

function ecran() {
  const from = () => {
    const o = { select() { return o; }, order() { return o; }, limit() { return o; }, maybeSingle() { return o; }, eq() { return o; }, gte() { return o; }, lte() { return o; }, lt() { return o; },
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await
      then(ok, ko) { return Promise.resolve({ data: [], error: null }).then(ok, ko); } };
    return o;
  };
  // oxlint-disable-next-line unicorn/no-thenable -- idem pour rpc
  const rpc = () => ({ then(ok, ko) { return Promise.resolve({ data: [], error: null }).then(ok, ko); } });
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ appendChild() {} }), head: { appendChild() {} }, addEventListener() {} };
  const ctx = { console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, clearTimeout, RegExp, document: doc,
    navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  const vu = { annuaire: null, go: [] };
  ctx.V2 = {
    user: { id: 'u', commercial: 'AAA' }, sb: () => ({ from, rpc }),
    pharmacies: [
      { id: '9400001', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-A', comms: ['AAA'] },   // rendez-vous dans l'agenda
      { id: '9400002', name: 'PHARMACIE DU BANC', ville: 'VILLE-B', comms: ['AAA'] },      // sans rendez-vous, a un mail
      { id: '9400003', name: 'PHARMACIE DE LA SONDE', ville: 'VILLE-C', comms: ['AAA'] },  // sans rendez-vous, a un mail
      { id: '9400004', name: 'PHARMACIE DU TEMOIN', ville: 'VILLE-D', comms: ['AAA'] },    // sans rendez-vous, téléphone seul
    ],
    todo: { tous: () => [], libelle: (t) => t.note, tombeLe: () => false }, rdv: { proposer() {} },
    rdvInfo: (k) => (k === '9400002' || k === '9400003') ? { email: k + '@exemple.invalid' } : k === '9400004' ? { tel: '00 00 00 00 00' } : {},
    rdvVuLe: () => null,
    rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve({ actif: true, hote: 'calendar.google.com', dernier_ok: new Date().toISOString() }) },
    rdvAlias: { charger: () => Promise.resolve({}) },
    planningIndex: () => ({ porte: [], nat: [] }),
    planningAppelerAgenda: () => Promise.resolve({ ok: true, evenements: [{ date: plus(3), debut: '09:30:00', fin: '10:30:00', jour_entier: false, titre: 'Pharmacie des essais' }] }),
    ensurePharmaFr: (cb) => { vu.annuaire = cb; },
    go: (r) => { vu.go.push(r); },
  };
  vm.createContext(ctx);
  ctx.V2RECO = { apparier: (t) => /essais/i.test(t) ? { officine: { id: '9400001', name: 'PHARMACIE DES ESSAIS' }, etat: 'reconnu' } : {} };
  vm.runInContext(lire('v2-todo-mois.js'), ctx);
  return { V2: ctx.V2, vu, ctx };
}

test('Vos clients attend l’annuaire (noms d’enseigne) avant de compter, puis compte', async () => {
  const { V2, vu } = ecran();
  V2.todoMois.html(); await attendre();
  const h = V2.todoMois.html();
  assert.match(h, /<h2 class="tm-cht">Vos clients<\/h2>/, 'marqueur : la section est là');
  assert.equal(typeof vu.annuaire, 'function', 'l’annuaire est demandé');
  assert.doesNotMatch(h, /ont un rendez-vous à venir/, 'pas de compte tant que l’annuaire n’est pas là');
  assert.match(h, /Lecture de votre agenda personnel…/);
  vu.annuaire(); await attendre();
  assert.match(V2.todoMois.html(), /<b>1<\/b> sur 4 ont un rendez-vous à venir · <b>3<\/b> sans rendez-vous/);
});

test('le bouton envoie les disponibilités aux clients sans rendez-vous qui ont un mail, en mode groupé', async () => {
  const { V2, vu, ctx } = ecran();
  V2.todoMois.html(); await attendre(); vu.annuaire(); await attendre();
  const h = V2.todoMois.html();
  assert.match(h, /onclick="V2\.todoMois\.envoyerDispos\(\)">Envoyer mes disponibilités aux 2 clients sans rendez-vous<\/button>/);
  assert.match(h, /Un client sans adresse mail est à appeler/);
  V2.todoMois.envoyerDispos();
  assert.deepEqual(Array.from(ctx.V2.campagnePreselection).sort(), ['9400002', '9400003'], 'ni celle qui a un rendez-vous, ni celle sans mail');
  assert.equal(ctx.V2.campagneModeVoulu, 'groupe');
  assert.deepEqual(vu.go, ['campagne']);
});

test('le mois ne montre pas une simple ressemblance avec une officine hors du fichier (annuaire chargé)', async () => {
  const { V2, vu, ctx } = ecran();
  V2.planningIndex = () => ({ porte: [], nat: [], idsPorte: { '9400001': 1, '9400002': 1, '9400003': 1, '9400004': 1 } });
  V2.planningAppelerAgenda = () => Promise.resolve({ ok: true, evenements: [
    { date: plus(0), debut: '11:30:00', fin: '12:30:00', jour_entier: false, titre: 'Appeler phie du chapitre' },
    { date: plus(0), debut: '14:30:00', fin: '15:30:00', jour_entier: false, titre: 'Pharmacie de la chasse' },
  ] });
  ctx.V2RECO = { apparier: (t) => /chapitre/i.test(t) ? { officine: { id: '9999001', name: 'PHARMACIE DU CHAPITRE', ville: 'VILLE-LOIN' }, etat: 'confirmer' }
    : /chasse/i.test(t) ? { officine: { id: '9999002', name: 'PHARMACIE DE LA CHASSE', ville: 'VILLE-PROSPECT' }, etat: 'reconnu' } : {} };
  V2.todoMois.html(); await attendre(); vu.annuaire(); await attendre();
  const h = V2.todoMois.html();
  assert.match(h, /Chasse/, 'marqueur : une officine reconnue hors du fichier (prospect) reste montrée');
  assert.doesNotMatch(h, /Chapitre/, 'une ressemblance hors du fichier n’est pas montrée');
});

test('« grand » vaut GRANDE : sa cliente passe devant une homonyme partielle de l’annuaire ; LOIRE n’est pas LOIR', () => {
  const app = charger();
  const m = app('Pharmacie la grand prairie');
  assert.equal(String(m.officine.id), '9300007', 'PHARMACIE LA GRANDE PRAIRIE, pas PHARMACIE DE LA PRAIRIE');
  assert.equal(m.etat, 'reconnu');
  // LOIRE ne devient pas LOIR : « rives » seul ne fait qu'une ressemblance, jamais une certitude
  assert.notEqual(app('Appeler phie des rives de Loire').etat, 'reconnu');
});
