// 26/11/2026 — To do au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix », sujet 2, version 3
// (« Comme la 2, agenda en une ligne »).
// Avant : en touchant « To do », on voyait le mois ; les tâches en retard étaient au 2e écran, sous le calendrier, et la
// carte « Branchez votre agenda » (une phrase + trois boutons) prenait un tiers d'écran à chaque visite.
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-todo-mois.js) dans node:vm :
//   · au téléphone, dans la To do : En retard → barre du mois → l'agenda en UNE ligne → le calendrier → Sans date ;
//   · rien ne disparaît (le bloc En retard n'est écrit qu'une fois, la ligne ouvre le même branchement) ;
//   · à l'ordinateur, et dans l'écran Rendez-vous (qui montre ce même mois), l'ordre d'avant est intact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const R = new URL('../crm/v2/', import.meta.url);
const MOIS = readFileSync(new URL('v2-todo-mois.js', R), 'utf8');
const TODO = readFileSync(new URL('v2-todo.js', R), 'utf8');
const RDV = readFileSync(new URL('v2-rdv.js', R), 'utf8');

const attendre = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

const TACHES = [
  { id: 't1', k: 'libre', note: 'Après le rendez-vous · PHARMACIE DE LA GARE', pour: '2020-10-21' },
  { id: 't2', k: 'libre', note: 'Relancer la pharmacie du Plantaurel', pour: '2020-10-23' },
  { id: 't3', k: 'libre', note: 'Demande de rendez-vous · PHARMACIE DE LA MAIRIE', pour: '' }
];

// Une table vide qui répond comme le client Supabase (on l'attend avec then).
function fausseTable() {
  const o = {
    select: () => o, order: () => o, eq: () => o, gte: () => o, lte: () => o, lt: () => o,
    // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec then
    then: (ok, ko) => Promise.resolve({ data: [], error: null }).then(ok, ko)
  };
  return o;
}

// Le module monté dans une fausse fenêtre. `tel` : la fenêtre fait-elle 640 px ou moins ? `branche` : un agenda est-il branché ?
async function monter({ tel, branche = false, taches = TACHES }) {
  const demandes = [], choisis = [];
  const doc = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(t) {}, appendChild() {} }), head: { appendChild() {} }, addEventListener() {}
  };
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, RegExp, document: doc,
    matchMedia: (q) => { demandes.push(q); return { matches: /max-width:\s*640px/.test(q) ? tel : false }; },
    ICO: (n, s) => '<svg data-ico="' + n + '" width="' + s + '"></svg>'
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = {
    user: { id: 'u-moi', name: 'Moi' }, pharmacies: [],
    sb: () => ({ from: fausseTable }),   // une base qui répond « rien ce mois-ci » : sans elle, le mois dit « n'ont pas pu être lus » à la place de la ligne d'agenda
    todo: { tous: () => taches, libelle: (t) => t.note, tombeLe: () => false },
    rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve(branche ? { actif: true, hote: 'calendar.google.com' } : null), choisir: (c) => choisis.push(c) },
    rdvAlias: { charger: () => Promise.resolve({}) },
    planningAppelerAgenda: () => Promise.resolve({ ok: false, raison: 'pas_d_agenda' })
  };
  vm.createContext(ctx);
  vm.runInContext(MOIS, ctx);
  ctx.V2.todoMois.html({ todo: true }); await attendre();   // première passe : les lectures partent ; la seconde les a reçues
  return { V2: ctx.V2, demandes, choisis, ctx };
}
const pos = (h, s) => h.indexOf(s);
const nb = (h, s) => h.split(s).length - 1;

test('marqueur : le module rend bien le mois, avec ses tâches en retard et la carte d’agenda à brancher', async () => {
  const { V2 } = await monter({ tel: false });
  const h = V2.todoMois.html({ todo: true });
  assert.match(h, /^<div class="tm tm-v2">/);
  assert.match(h, /<h3 class="tm-sh">En retard <b>2<\/b><\/h3>/, 'deux tâches en retard dans le jeu d’essai');
  assert.match(h, /<h3 class="tm-sh">Sans date <b>1<\/b><\/h3>/);
  assert.match(h, /<b>Branchez votre agenda<\/b>/, 'agenda non branché : la carte s’affiche');
});

test('téléphone, To do : En retard remonte sous les onglets, avant la barre du mois ; le reste garde son ordre', async () => {
  const { V2, demandes } = await monter({ tel: true });
  const h = V2.todoMois.html({ todo: true });
  assert.ok(demandes.some((q) => /max-width:640px/.test(q)), 'la largeur est bien demandée à 640 px');
  const iHaut = pos(h, '<div class="tm-libres tm-haut">'), iBarre = pos(h, '<div class="tm-barre">'), iAg = pos(h, 'tm-ag1'),
    iMois = pos(h, '<div class="tm-mois-g">'), iLeg = pos(h, '<p class="tm-leg">'), iSans = pos(h, 'Sans date <b>'), iJour = pos(h, 'tm-carte tm-jour');
  assert.equal(iHaut, '<div class="tm tm-v2">'.length, 'le bloc En retard est le tout premier du mois (juste sous l’en-tête et ses onglets)');
  assert.ok(iHaut < iBarre && iBarre < iAg && iAg < iMois && iMois < iLeg && iLeg < iSans && iSans < iJour, 'ordre : En retard, mois, agenda, calendrier, légende, Sans date, le jour');
  // le bloc remonté contient les deux tâches, avec leur case à cocher et leur date
  const haut = h.slice(iHaut, iBarre);
  assert.match(haut, /<h3 class="tm-sh">En retard <b>2<\/b><\/h3>/);
  assert.equal(nb(haut, 'onchange="V2.todoMois.cocher('), 2, 'les deux cases se cochent toujours');
  assert.match(haut, /PHARMACIE DE LA GARE[\s\S]*<small>prévue /);
  assert.doesNotMatch(haut, /Sans date/, 'Sans date ne remonte pas : seule la version 1 de la planche le faisait');
});

test('téléphone, To do : rien ne disparaît ni ne se répète', async () => {
  const { V2 } = await monter({ tel: true });
  const h = V2.todoMois.html({ todo: true });
  assert.equal(nb(h, 'En retard <b>'), 1, 'En retard écrit une seule fois (remonté, pas recopié)');
  assert.equal(nb(h, 'Sans date <b>'), 1);
  assert.equal(nb(h, 'V2.todoMois.cocher(\'t1\''), 1);
  assert.equal(nb(h, 'V2.todoMois.cocher(\'t3\''), 1, 'la tâche sans date garde sa case, à sa place');
  for (const m of ['tm-barre', 'tm-mois-g', 'tm-leg', 'tm-carte tm-jour', 'V2.todoMois.pas(-1)', 'V2.todoMois.aujourdhui()']) assert.ok(h.includes(m), m + ' toujours là');
});

test('téléphone, To do : « Branchez votre agenda » tient en une ligne, qui ouvre le même branchement', async () => {
  const { V2, choisis, ctx } = await monter({ tel: true });
  const h = V2.todoMois.html({ todo: true });
  const m = /<button type="button" class="tm-etat tm-ag1" onclick="([^"]+)">([\s\S]*?)<\/button>/.exec(h);
  assert.ok(m, 'la ligne est un vrai bouton');
  assert.match(m[2], /<b>Brancher mon agenda<\/b><small>Google Agenda, Outlook ou iPhone<\/small>/, 'libellés de la planche');
  assert.match(m[2], /data-ico="cal"[\s\S]*data-ico="chev"/, 'l’agenda à gauche, le chevron à droite');
  assert.doesNotMatch(h, /Branchez votre agenda<\/b> :/, 'la carte longue n’est plus affichée');
  assert.equal(nb(h, 'V2.rdvAgenda.choisir('), 1, 'une seule cible au lieu de trois boutons');
  // le toucher : la même fonction que les trois boutons de la carte, sans outil imposé (le choix se fait sur l’écran ouvert)
  vm.runInContext(m[1], ctx);
  assert.deepEqual(choisis, [''], 'V2.rdvAgenda.choisir(\'\') : ouvre le branchement, comme « Changer d’agenda »');
});

test('téléphone, To do : un agenda déjà branché garde sa ligne d’état ; sans tâche en retard, aucun bloc vide', async () => {
  const a = await monter({ tel: true, branche: true });
  const h = a.V2.todoMois.html({ todo: true });
  assert.match(h, /class="tm-etat tm-ag-on"/, 'ligne « Google Agenda branché »');
  assert.match(h, /Google Agenda branché/);
  assert.doesNotMatch(h, /tm-ag1/);
  const b = await monter({ tel: true, taches: [TACHES[2]] });
  const h2 = b.V2.todoMois.html({ todo: true });
  assert.doesNotMatch(h2, /tm-haut/, 'pas de tâche en retard : rien au-dessus de la barre du mois');
  assert.equal(pos(h2, '<div class="tm-barre">'), '<div class="tm tm-v2">'.length);
  assert.equal(nb(h2, 'Sans date <b>1</b>'), 1);
});

test('ordinateur : la To do garde l’ordre d’avant, la carte d’agenda et ses trois boutons', async () => {
  const { V2 } = await monter({ tel: false });
  const h = V2.todoMois.html({ todo: true });
  assert.doesNotMatch(h, /tm-haut|tm-ag1/, 'aucune des deux pièces du téléphone');
  const iBarre = pos(h, '<div class="tm-barre">'), iAg = pos(h, '<div class="tm-etat tm-ag" role="group" aria-label="Brancher mon agenda">'),
    iMois = pos(h, '<div class="tm-mois-g">'), iRet = pos(h, 'En retard <b>'), iSans = pos(h, 'Sans date <b>');
  assert.equal(iBarre, '<div class="tm tm-v2">'.length, 'la barre du mois vient en premier');
  assert.ok(iBarre < iAg && iAg < iMois && iMois < iRet && iRet < iSans, 'ordre d’avant : mois, agenda, calendrier, En retard, Sans date');
  assert.match(h, /<div class="tm-libres"><section class="tm-lb"><h3 class="tm-sh">En retard/, 'En retard et Sans date dans le même bloc, sous le calendrier');
  for (const o of ['google', 'outlook', 'apple']) assert.ok(h.includes('V2.rdvAgenda.choisir(\'' + o + '\')'), 'bouton ' + o);
});

test('écran Rendez-vous (même mois, sans « todo ») : inchangé, même au téléphone', async () => {
  const { V2 } = await monter({ tel: true });
  const h = V2.todoMois.html();
  assert.doesNotMatch(h, /tm-haut|tm-ag1/);
  assert.ok(pos(h, '<div class="tm-barre">') < pos(h, 'En retard <b>'), 'En retard reste sous le calendrier');
  assert.match(h, /<b>Branchez votre agenda<\/b> :/);
  // les deux appelants : la To do se nomme, Rendez-vous non
  assert.equal(nb(TODO, 'V2.todoMois.html({ todo: true })'), 1, 'v2-todo.js demande l’ordre de la To do');
  assert.equal(nb(TODO, 'V2.todoMois.html('), 1);
  assert.match(RDV, /V2\.todoMois \? V2\.todoMois\.html\(\) : ''/, 'v2-rdv.js appelle le mois sans option');
  assert.match(MOIS, /if \(h\) \{ h\.innerHTML = V2\.todoMois\.html\(\); return; \}/, 'le redessin de Rendez-vous aussi');
});

test('le style des deux pièces n’existe que dans le bloc téléphone (640 px) de la feuille du mois, cible et textes lisibles', () => {
  const i640 = MOIS.indexOf("'@media (max-width:640px){',\n      '  .tm-mois{"), fin = MOIS.indexOf("\n      '}'\n    ].join(", i640);
  assert.ok(i640 > 0 && fin > i640, 'bloc « téléphone » de la feuille injectée retrouvé');
  const bloc = MOIS.slice(i640, fin), css = MOIS.slice(MOIS.indexOf("s.id = 'tm-css'"));
  for (const sel of ['.tm-libres.tm-haut{', '.tm-haut .tm-lb{', '.tm-ag1{', '.tm-ag1t{', '.tm-ag1t b{', '.tm-ag1t small{', '.tm-ag1:focus-visible{']) {
    assert.equal(nb(bloc, "'  " + sel), 1, sel + ' dans le bloc 640 px');
    assert.equal(nb(css, sel), 1, sel + ' nulle part ailleurs dans la feuille');
  }
  const ligne = /'  \.tm-ag1\{([^}]*)\}'/.exec(bloc)[1];
  assert.ok(+/min-height:(\d+)px/.exec(ligne)[1] >= 44, 'cible d’au moins 44 px');
  assert.match(ligne, /width:100%/);
  const tailles = [.../font:\d+ ([\d.]+)px/g[Symbol.matchAll](bloc.slice(bloc.indexOf('.tm-ag1t b{')))].map((x) => +x[1]);
  assert.deepEqual(tailles, [15.5, 13], 'titre 15,5 px et précision 13 px, comme la planche');
  assert.doesNotMatch(bloc.slice(bloc.indexOf('.tm-libres.tm-haut{')), /backdrop-filter|filter:\s*blur/, 'aucun effet interdit sous Safari');
});
