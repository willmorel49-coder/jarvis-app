// Rendez-vous = le mois de la To do (24/11/2026) : « Vos clients », le choix de l'agenda, le redessin sans relecture.
// Les vrais fichiers (crm/v2/v2-todo-mois.js, crm/v2/v2-rdv-agenda.js) tournent dans node:vm sur une FAUSSE base
// qui note chaque requête. Toutes les officines sont fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const R = new URL('../crm/v2/', import.meta.url);
const MOIS = readFileSync(new URL('v2-todo-mois.js', R), 'utf8');
const AGENDA = readFileSync(new URL('v2-rdv-agenda.js', R), 'utf8');

function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
const AUJ = isoLocal(new Date());
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const attendre = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

function fausseBase(lignes, { erreur = false, opposes = [] } = {}) {
  const lus = [];
  const from = (t) => {
    const q = { t, f: [] };
    const o = {
      select() { return o; }, order() { return o; }, limit() { return o; }, maybeSingle() { return o; },
      eq(k, v) { q.f.push(k + '=' + v); return o; }, gte(k, v) { q.f.push(k + '>=' + v); return o; },
      lte(k, v) { q.f.push(k + '<=' + v); return o; }, lt(k, v) { q.f.push(k + '<' + v); return o; },
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
      then(ok, ko) { lus.push(q); return Promise.resolve(erreur && t === 'rdv' ? { data: null, error: { message: 'panne' } } : { data: lignes[t] || [], error: null }).then(ok, ko); }
    };
    return o;
  };
  // oxlint-disable-next-line unicorn/no-thenable -- idem pour rpc
  const rpc = (n) => ({ then(ok, ko) { return Promise.resolve({ data: n === 'rdv_opposes' ? opposes : [], error: null }).then(ok, ko); } });
  return { sb: { from, rpc }, lus };
}

function monter(fichiers, V2extra = {}, elements = {}) {
  const doc = {
    getElementById: (id) => elements[id] || null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(t) {}, appendChild() {} }), head: { appendChild() {} },
    addEventListener() {}
  };
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, clearTimeout, RegExp,
    document: doc, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = Object.assign({ user: { id: 'u-moi', name: 'Moi', commercial: 'AAA' } }, V2extra);
  vm.createContext(ctx);
  fichiers.forEach((f) => vm.runInContext(f, ctx));
  return ctx;
}

const PORTEFEUILLE = [
  { id: '9000001', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-A', comms: ['AAA'] },   // reconnue dans l'agenda, à J+3
  { id: '9000002', name: 'PHARMACIE DU BANC', ville: 'VILLE-B', comms: ['AAA'] },      // rendez-vous JARVIS, à J+5
  { id: '9000003', name: 'PHARMACIE DE LA SONDE', ville: 'VILLE-C', comms: ['AAA'] },  // vue il y a longtemps, a un mail
  { id: '9000004', name: 'PHARMACIE DU TEMOIN', ville: 'VILLE-D', comms: ['AAA'] },    // jamais vue, téléphone seul
  { id: '9000005', name: 'PHARMACIE DU REFUS', ville: 'VILLE-E', comms: ['AAA'] },     // a demandé à ne plus être sollicitée
  { id: '9000009', name: 'PHARMACIE DU COLLEGUE', ville: 'VILLE-F', comms: ['BBB'] }   // pas à lui
];

function pret(base, extra = {}) {
  return Object.assign({
    sb: () => base.sb,
    pharmacies: PORTEFEUILLE,
    todo: { tous: () => [], libelle: (t) => t.note, tombeLe: () => false },
    rdv: { proposer() {} },
    rdvInfo: (k) => k === '9000003' ? { email: 'essai@exemple.invalid' } : k === '9000004' ? { tel: '00 00 00 00 00' } : {},
    rdvVuLe: (k) => k === '9000003' ? '2025-01-15' : null,
    rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve({ actif: true, hote: 'calendar.google.com', dernier_ok: new Date().toISOString() }) },
    rdvAlias: { charger: () => Promise.resolve({}) },
    planningIndex: () => ({ porte: [], nat: [] }),
    planningAppelerAgenda: () => Promise.resolve({ ok: true, evenements: [
      { date: plus(3), debut: '09:30:00', fin: '10:30:00', jour_entier: false, titre: 'RDV Pharmacie des Essais' }
    ] })
  }, extra);
}
const RECO = { apparier: (t) => /essais/i.test(t) ? { officine: { id: '9000001', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-A' }, etat: 'reconnu' } : {} };

test('Vos clients : celles qui ont un rendez-vous à venir, quand, et les autres à qui le proposer', async () => {
  const base = fausseBase({ rdv: [{ cip: '9000002', nom: 'PHARMACIE DU BANC', date: plus(5), heure: '14:00:00' }] }, { opposes: [{ cip: '9000005' }] });
  const ctx = monter([MOIS], pret(base));
  ctx.V2RECO = RECO;
  const V2 = ctx.V2;
  V2.todoMois.html(); await attendre();
  const h = V2.todoMois.html();
  assert.match(h, /<h2 class="tm-cht">Vos clients<\/h2>/, 'marqueur : la section est là');

  const venir = base.lus.filter((q) => q.t === 'rdv').map((q) => q.f.join(','));
  assert.ok(venir.some((f) => f.includes('user_id=u-moi') && f.includes('statut=confirme') && f.includes('date>=' + AUJ) && !f.includes('date<=')), 'ses rendez-vous confirmés à partir d’aujourd’hui, sans borne de fin');

  assert.match(h, /<b>2<\/b> sur 5 ont un rendez-vous à venir · <b>2<\/b> sans rendez-vous · <b>1<\/b> ne veut plus être sollicitée/, 'les comptes tombent juste : 5 à lui = 2 posées + 2 à proposer + 1 qui a dit stop');
  assert.doesNotMatch(h, /Collegue/, 'une officine d’un collègue n’apparaît pas');
  assert.doesNotMatch(h, /Vous avez aussi/, 'aucun rendez-vous hors portefeuille : pas de phrase');
  assert.doesNotMatch(h, /Refus/, 'celle qui a dit stop n’est pas dans les listes');

  const [sans, poses] = h.split('Rendez-vous posé <b>');
  assert.ok(poses, 'marqueur : la colonne des rendez-vous posés existe');
  assert.ok(sans.indexOf('<b>Temoin</b>') > 0 && sans.indexOf('<b>Temoin</b>') < sans.indexOf('<b>Sonde</b>'), 'jamais vue d’abord, puis la plus ancienne visite');
  assert.match(sans, /V2\.rdv\.proposer\('9000003'\)">Proposer un RDV/, 'avec un mail : « Proposer un RDV »');
  assert.match(sans, /href="tel:0000000000">Appeler/, 'sans mail : « Appeler »');
  assert.match(sans, /aucune visite notée/, 'jamais vue, dit en clair');
  assert.match(sans, /vue il y a (\d+ mois|plus d’un an)/, 'la dernière visite connue');

  assert.ok(poses.indexOf('<b>Essais</b>') >= 0 && poses.indexOf('<b>Essais</b>') < poses.indexOf('<b>Banc</b>'), 'les rendez-vous posés, le plus proche d’abord');
  assert.match(poses, /dans 3 jours · agenda personnel/, 'celui reconnu dans l’agenda est dit comme tel');
  assert.match(poses, new RegExp("allerA\\('" + plus(5) + "'\\)"), 'toucher un rendez-vous posé ouvre son jour dans le mois');
  assert.match(poses, /09h30/, 'l’heure');
});

test('Vos clients : un rendez-vous chez l’officine d’un collègue est dit, pas listé', async () => {
  const base = fausseBase({ rdv: [{ cip: '9000009', nom: 'PHARMACIE DU COLLEGUE', date: plus(4), heure: '11:00:00' }] });
  const ctx = monter([MOIS], pret(base));
  ctx.V2RECO = RECO;
  ctx.V2.todoMois.html(); await attendre();
  const h = ctx.V2.todoMois.html();
  assert.match(h, /<b>1<\/b> sur 5 ont un rendez-vous à venir/, 'marqueur : la section est calculée (Essais, reconnue dans l’agenda)');
  assert.match(h, /Vous avez aussi 1 rendez-vous à venir chez une officine qui n’est pas dans vos clients/, 'l’écart entre la grille et la liste est dit');
  assert.doesNotMatch(h.split('Vos clients')[1], /Collegue/, 'et l’officine n’est pas dans les listes');
});

test('Vos clients : la phrase compte des RENDEZ-VOUS ; un « à confirmer » chez un collègue ne compte pas, chez soi il est dit (24/11)', async () => {
  // deux rendez-vous JARVIS chez la même officine d'un collègue, plus la copie du second dans l'agenda (même jour)
  const base = fausseBase({ rdv: [
    { cip: '9000009', nom: 'PHARMACIE DU COLLEGUE', date: plus(4), heure: '11:00:00' },
    { cip: '9000009', nom: 'PHARMACIE DU COLLEGUE', date: plus(9), heure: '15:00:00' }
  ] });
  const ctx = monter([MOIS], pret(base, {
    planningAppelerAgenda: () => Promise.resolve({ ok: true, evenements: [
      { date: plus(9), debut: '15:00:00', fin: '16:00:00', jour_entier: false, titre: 'Phie du collegue' },
      { date: plus(6), debut: '10:00:00', fin: '11:00:00', jour_entier: false, titre: 'Phie qui ressemble au collegue' },
      { date: plus(7), debut: '09:00:00', fin: '10:00:00', jour_entier: false, titre: 'Phie qui ressemble au temoin' }
    ] })
  }));
  const C = { id: '9000009', name: 'PHARMACIE DU COLLEGUE', ville: 'VILLE-F' }, T = { id: '9000004', name: 'PHARMACIE DU TEMOIN', ville: 'VILLE-D' };
  ctx.V2RECO = { apparier: (t) => /ressemble au collegue/i.test(t) ? { officine: C, etat: 'confirmer' }
    : /ressemble au temoin/i.test(t) ? { officine: T, etat: 'confirmer' } : /du collegue/i.test(t) ? { officine: C, etat: 'reconnu' } : {} };
  ctx.V2.todoMois.html(); await attendre();
  const h = ctx.V2.todoMois.html();
  assert.match(h, /<h2 class="tm-cht">Vos clients<\/h2>/, 'marqueur : la section est là');
  assert.match(h, /Vous avez aussi 2 rendez-vous à venir chez une officine qui n’est pas dans vos clients/, '2 rendez-vous (la copie agenda comptée une fois, le « à confirmer » pas du tout), 1 officine');
  const poses = h.split('Rendez-vous posé <b>')[1];
  assert.ok(poses && poses.indexOf('<b>Temoin</b>') >= 0, 'chez soi, la ressemblance reste visible…');
  assert.match(poses, /agenda personnel · à confirmer/, '… avec la mention « à confirmer »');
});

test('Vos clients : une lecture ratée ne fait jamais croire que tous sont sans rendez-vous', async () => {
  const base = fausseBase({}, { erreur: true });
  const ctx = monter([MOIS], pret(base));
  ctx.V2RECO = RECO;
  ctx.V2.todoMois.html(); await attendre();
  const h = ctx.V2.todoMois.html();
  assert.match(h, /<h2 class="tm-cht">Vos clients<\/h2>/, 'marqueur : la section est là');
  assert.match(h, /Vos rendez-vous à venir n’ont pas pu être lus/, 'l’échec est dit');
  assert.doesNotMatch(h, /Sans rendez-vous à venir/, 'aucune liste fausse');
});

test('Le mois propose de brancher SON agenda : Google, Outlook ou iPhone, au choix', async () => {
  const base = fausseBase({});
  const ctx = monter([MOIS], pret(base, { rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve(null) } }));
  ctx.V2.todoMois.html(); await attendre();
  const h = ctx.V2.todoMois.html();
  assert.match(h, /Branchez votre agenda/, 'marqueur : pas d’agenda branché');
  for (const [cle, nom] of [['google', 'Google Agenda'], ['outlook', 'Outlook'], ['apple', 'iPhone \\/ iCloud']]) {
    assert.match(h, new RegExp("V2\\.rdvAgenda\\.choisir\\('" + cle + "'\\)\">" + nom + '</button>'), nom);
  }
  assert.match(h, /seuls les rendez-vous notés dans JARVIS comptent/, 'Vos clients dit sur quoi il s’appuie');

  const ctx2 = monter([MOIS], pret(fausseBase({})));
  ctx2.V2.todoMois.html(); await attendre();
  const h2 = ctx2.V2.todoMois.html();
  assert.match(h2, /Google Agenda branché · relu à l’instant/, 'branché : l’outil et la fraîcheur');
  assert.match(h2, /choisir\(''\)">Changer d’agenda/, 'et de quoi en changer');
});

test('Choisir son agenda depuis le mois ouvre le branchement de CET outil, même si un autre est branché', () => {
  const vus = [];
  const ctx = monter([AGENDA], { user: { id: 'u-moi', email: 'moi@integralpharma.fr' }, go: (r) => vus.push(r), pages: {} });
  const V2 = ctx.V2, outlook = { hote: 'outlook.office365.com', dernier_ok: new Date().toISOString(), plages_gardees: 3 };
  assert.match(V2.rdvAgenda.bloc(outlook), /Outlook branché/, 'marqueur : sans choix, l’agenda branché s’affiche');
  V2.rdvAgenda.choisir('google');
  assert.deepEqual(vus, ['rdvdispo'], 'l’écran Mes disponibilités s’ouvre');
  const h = V2.rdvAgenda.bloc(outlook);
  assert.match(h, /Branchez votre agenda Google/, 'l’outil choisi passe avant l’outil branché ou deviné (@integralpharma.fr = Outlook)');
  assert.match(h, /data-m="google" class="on"/, 'Google est l’outil coché');
  assert.match(V2.rdvAgenda.bloc(outlook), /Outlook branché/, 'le choix ne sert qu’une fois');
  V2.rdvAgenda.choisir('');
  assert.match(V2.rdvAgenda.bloc(outlook), /Branchez votre agenda Outlook/, '« Changer d’agenda » : le branchement s’ouvre sur l’outil actuel');
});

test('Sur l’écran Rendez-vous, toucher un jour redessine le mois sur place, sans relire l’écran', async () => {
  const hote = { innerHTML: '' };
  let rendus = 0;
  const ctx = monter([MOIS], pret(fausseBase({}), { render: () => { rendus++; } }), { 'tm-hote': hote });
  ctx.V2RECO = RECO;
  ctx.V2.todoMois.html(); await attendre();
  rendus = 0;
  ctx.V2.todoMois.choisir(plus(3));
  assert.match(hote.innerHTML, /class="tm tm-v2"/, 'le mois est redessiné dans #tm-hote');
  assert.equal(rendus, 0, 'V2.render (qui relancerait toutes les lectures de l’écran) n’est pas appelé');
});

test('La To do s’ouvre sur le mois à chaque arrivée, et garde l’onglet choisi tant qu’on y reste (choix de Will, 24/11)', async () => {
  const TODO = readFileSync(new URL('v2-todo.js', R), 'utf8');
  const noop = () => {};
  const sb = { console, setTimeout, clearTimeout, Date, Promise, JSON, Math, RegExp, String, Number, Array, Object };
  sb.window = sb; sb.globalThis = sb;
  const LS = new Map([['jarvis_todo_v1', JSON.stringify([{ id: 't1', k: 'libre', nom: '', note: 'Tâche fictive', pour: AUJ, fait: false }])]]);
  sb.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k) };
  sb.document = {
    currentScript: { src: 'v2/v2-todo.js?v=x' }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, setAttribute: noop }),
    head: { appendChild: noop }, body: { classList: { add: noop, remove: noop }, appendChild: noop }, addEventListener: noop
  };
  sb.addEventListener = noop; sb.location = { hash: '#todo' };
  vm.createContext(sb);
  vm.runInContext(`window.V2 = { route: { name: 'todo' }, esc: s => String(s == null ? '' : s), topbar: () => '', go(){}, toast(){}, pharmacies: [], user: null,
    render(){ window.V2.pages.todo.render(window.__racine); },
    relances: { nbARelancer: () => 0, nbChauds: () => 0, html: () => '<p>RELANCES</p>', rafraichir(){} },
    todoMois: { html: () => '<div class="tm">LE MOIS</div>', phrase: () => 'Novembre', rafraichir(){} } };
    window.ICO = () => '';`, sb);
  sb.__racine = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector: () => null };
  vm.runInContext(TODO, sb);
  const V2 = sb.V2, rendre = async () => { V2.pages.todo.render(sb.__racine); for (let i = 0; i < 6; i++) await attendre(1); return sb.__racine.html; };
  let h = await rendre();
  assert.match(h, /td-h1/, 'marqueur : c’est bien la To do');
  assert.match(h, /LE MOIS/, 'à l’arrivée : le mois');
  V2.todo.onglet('taches'); await attendre();
  h = sb.__racine.html;
  assert.match(h, /aria-selected="true" class="td-cap is-on" onclick="V2\.todo\.onglet\('taches'\)"/, 'marqueur : l’onglet Tâches est ouvert');
  assert.doesNotMatch(h, /LE MOIS/, 'un redessin sur place garde l’onglet choisi');
  V2.route = { name: 'todo' };   // nouvelle arrivée sur l'écran (menu, accueil)
  assert.match(await rendre(), /LE MOIS/, 'revenir sur la To do rouvre le mois');
});
