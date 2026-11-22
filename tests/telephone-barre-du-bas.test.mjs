// 22/11/2026 — navigation au téléphone : barre du bas (Accueil + 3 rubriques + Menu), feuilles Prix / Envoyer de la fiche, liste « Autres outils » factorisée.
// Comme tests/fiche-telephone-barre-pouce.test.mjs : le VRAI code est extrait des fichiers et exécuté sur des données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = f => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const app = lire('v2-app.js'), pha = lire('v2-pharma.js'), css = lire('v2-tel.css');

function bloc(src, debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, debut + ' introuvable');
  const j = src.indexOf(fin, i); assert.ok(j > i, fin + ' introuvable après ' + debut);
  return src.slice(i, j + fin.length);
}

// ── les feuilles de la fiche (v2-pharma.js) ──
function feuille(k, { integral, mail = 'a@b.fr', pages = { produits: 1, offilog: 1 }, d2p = true, rdv = true } = {}) {
  const code = bloc(pha, '  V2.rv2Feuille = function (k, el) {', '\n  };\n');
  const posees = [], allers = [];
  const V2 = { pages, d2pRender: d2p ? function () {} : null, rdv: rdv ? {} : null, rv2Va: a => allers.push(a) };
  const fn = new Function('V2', 'fbC', 'rv2Vue', 'rv2Mail', 'isOpso', 'isEscale', 'fbIc', 'esc', 'fbPose',
    code + '\nreturn V2.rv2Feuille;')(V2, { pid: 'X' }, () => (integral ? 'integral' : 'pharmacien'), mail, () => false, () => false,
    n => '[' + n + ']', s => s, f => posees.push(f));
  fn(k, null);
  return { posees, allers, titres: posees.length ? [...posees[0].h.matchAll(/class="rv2-li-t">([^<]+)<small>([^<]*)/g)].map(m => [m[1], m[2]]) : [] };
}

test('feuille Prix : Catalogue, Offilog, Comparer — plus de « Transmettre »', () => {
  const r = feuille('prix', { integral: true });
  assert.deepEqual(r.titres.map(t => t[0]), ['Catalogue', 'Offilog', 'Comparer']);
  assert.doesNotMatch(r.posees[0].h, /Transmettre|va\('tx'\)|rv2Va\('tx'\)/);
});

test('feuille Prix en vue pharmacien : Comparer reste réservé à la vue Intégral', () => {
  const r = feuille('prix', { integral: false });
  assert.deepEqual(r.titres.map(t => t[0]), ['Catalogue', 'Offilog']);
});

test('feuille Envoyer (vue Intégral) : Documents, E-mail, Proposer un rendez-vous', () => {
  const r = feuille('envoi', { integral: true });
  assert.deepEqual(r.titres, [
    ['Documents', 'Listings et catalogue pour son logiciel'],
    ['E-mail', 'a@b.fr'],
    ['Proposer un rendez-vous', 'Lui envoyer vos créneaux']]);
});

test('Envoyer en vue pharmacien : ouvre directement Transmettre, aucune feuille', () => {
  const r = feuille('envoi', { integral: false });
  assert.deepEqual(r.allers, ['tx']); assert.equal(r.posees.length, 0);
});

test('Envoyer sans e-mail : pas de ligne E-mail ni de rendez-vous', () => {
  const r = feuille('envoi', { integral: true, mail: '' });
  assert.deepEqual(r.titres.map(t => t[0]), ['Documents']);
});

// ── la liste « Autres outils » et la barre du bas (v2-app.js) ──
const RUBRIQUES = ['pharma', 'todo', 'infos', 'groupements', 'offilog', 'produits', 'pilotage', 'marketing', 'rdv'].map(k => ({ k, nom: 'Nom ' + k, act: 'go:' + k, href: '#' + k }));
function monde({ user = { id: 1 }, opso = false, route = { name: 'home' }, barre = RUBRIQUES, feuilleTel = true } = {}) {
  const V2 = { user, route, accueilCinq: { barre: () => barre }, accueilWidgets: null };
  const fams = [{ k: 'direct', nom: 'Outils', cles: ['lgo', 'carte'] }, { k: 'dev', nom: 'En développement', cles: ['biosimilaires'] }];
  const outil = k => ({ k, nom: 'Outil ' + k, act: 'go:' + k, href: '#' + k });
  const ic = (n, s) => '<svg data-ic="' + n + '" data-s="' + s + '"/>';
  const corps = [bloc(app, '  var TB_COURT', '\n'), bloc(app, '  function tbCase', '\n  }\n'), bloc(app, '  function tbHtml', '\n  }\n'),
    bloc(app, '  function aoLien', '\n  }\n'), bloc(app, '  function autresListe', '\n  }\n'), bloc(app, '  V2.tbMaj = function () {', '\n  };\n')].join('\n');
  const enfants = []; const body = { classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); } }, appendChild(n) { enfants.push(n); n.parentNode = body; }, removeChild(n) { enfants.splice(enfants.indexOf(n), 1); } };
  const document = { body, getElementById: id => enfants.find(n => n.id === id) || null,
    querySelector: sel => (sel === 'link[href*="v2-tel.css"]' && feuilleTel ? {} : null),   // la page a-t-elle la feuille du téléphone ?
    createElement: () => ({ setAttribute(a, v) { this['@' + a] = v; }, getAttribute(a) { return this['@' + a] || null; } }) };
  const window = { V2_BRAND: opso ? { opso: true } : {} };
  const sortie = new Function('V2', 'esc', 'u2Etat', 'u2Outil', 'u2Ic', 'document', 'window', corps + '\nreturn { tbHtml: tbHtml, autresListe: autresListe, aoLien: aoLien };')(V2, s => String(s), () => ({ fams, tous: fams }), outil, ic, document, window);
  return { V2, body, enfants, ...sortie };
}
const liens = h => [...h.matchAll(/data-tool="([^"]+)"/g)].map(m => m[1]);

test('la barre du bas : 5 cases dans l\'ordre Accueil, les 3 premières rubriques, Menu', () => {
  const m = monde();
  const h = m.tbHtml({ name: 'home' }, false, RUBRIQUES.slice(0, 3));
  const noms = [...h.matchAll(/class="bnav-n">([^<]+)</g)].map(x => x[1]);
  assert.deepEqual(noms, ['Accueil', 'Nom pharma', 'To do', 'Infos', 'Menu']);
  assert.equal((h.match(/<(a|button) class="bnav-c/g) || []).length, 5);
  assert.match(h, /^<a class="bnav-c on bnav-acc" aria-current="page"/);   // accueil actif sur la route home
});

test('la barre du bas : une seule case active, et « Menu » quand l\'écran n\'est ni l\'accueil ni une des 3 rubriques', () => {
  const m = monde();
  const actives = (rt, grp = false) => [...m.tbHtml(rt, grp, RUBRIQUES.slice(0, 3)).matchAll(/class="bnav-c on[^"]*"[^>]*>.*?class="bnav-n">([^<]+)</g)].map(x => x[1]);
  assert.deepEqual(actives({ name: 'todo' }), ['To do']);
  assert.deepEqual(actives({ name: 'pharma' }), ['Nom pharma']);
  assert.deepEqual(actives({ name: 'pilotage' }), ['Menu']);
  assert.deepEqual(actives({ name: 'home' }), ['Accueil']);
});

test('la barre du bas : sur Groupements, c\'est Groupements qui est allumé, pas Officines', () => {
  const m = monde();
  const trois = [RUBRIQUES[0], RUBRIQUES[3], RUBRIQUES[1]];
  const h = m.tbHtml({ name: 'pharma', param: 'groupements' }, true, trois);
  const on = [...h.matchAll(/class="bnav-c on[^"]*"[^>]*>.*?class="bnav-n">([^<]+)</g)].map(x => x[1]);
  assert.deepEqual(on, ['Nom groupements']);
  assert.match(h, /data-ic="carteGrp"/);
});

test('la liste de « Menu » = barre().slice(3) + outils directs + « En développement » ; celle de l\'ordinateur commence à 7', () => {
  const m = monde();
  assert.deepEqual(liens(m.autresListe(3)), ['groupements', 'offilog', 'produits', 'pilotage', 'marketing', 'rdv', 'lgo', 'carte', 'biosimilaires']);
  assert.deepEqual(liens(m.autresListe(7)), ['marketing', 'rdv', 'lgo', 'carte', 'biosimilaires']);
  assert.match(m.autresListe(3), /data-ao-dev[^>]*>.*En développement.*<span class="n">1<\/span>/);
  assert.match(m.autresListe(3), /<div class="tp-ao-l" hidden>/);
});

test('l\'ordinateur rend EXACTEMENT le même HTML qu\'avant (liste à partir de 7, lien sans classe en plus)', () => {
  const m = monde();
  const aoAvant = (t, k) => '<a class="v2-um-item tp-ao-it" role="menuitem" href="' + t.href + '" data-tp-act="' + t.act + '" data-tool="' + k + '" onclick="return V2.autresAller(event,this)"><svg data-ic="' + k + '" data-s="18"/><span>' + t.nom + '</span></a>';
  let att = '';
  RUBRIQUES.slice(7).forEach(t => { att += aoAvant({ href: t.href, act: t.act, nom: t.nom }, t.k); });
  att += ['lgo', 'carte'].map(k => aoAvant({ href: '#' + k, act: 'go:' + k, nom: 'Outil ' + k }, k)).join('');
  att += '<button type="button" class="v2-um-item tp-ao-dev" aria-expanded="false" data-ao-dev><svg data-ic="chev" data-s="16"/><span>En développement</span><span class="n">1</span></button>' +
    '<div class="tp-ao-l" hidden><p class="tp-ao-s">Ces outils marchent, mais ils ne sont pas encore au point.</p>' + aoAvant({ href: '#biosimilaires', act: 'go:biosimilaires', nom: 'Outil biosimilaires' }, 'biosimilaires') + '</div>';
  assert.equal(m.autresListe(7), att.replace(/<svg data-ic="chev" data-s="16"\/>/, '<svg data-ic="chev" data-s="16"/>'));
});

test('V2.tbMaj : la barre est posée une fois pour un utilisateur connecté', () => {
  const m = monde();
  m.V2.tbMaj(); m.V2.tbMaj();
  assert.equal(m.enfants.length, 1); assert.equal(m.enfants[0].id, 'tb-bas');
  assert.ok(m.body.classList.set.has('bnav-on'));
  assert.match(m.enfants[0].innerHTML, /Navigation|bnav-c/);
});

test('V2.tbMaj : rien sans session, rien côté OPSO', () => {
  for (const cas of [{ user: null }, { opso: true }]) {
    const m = monde(cas);
    m.V2.tbMaj();
    assert.equal(m.enfants.length, 0); assert.ok(!m.body.classList.set.has('bnav-on'));
  }
});

test('V2.tbMaj : rien sur une page qui n\'a pas la feuille v2-tel.css (Phirst charge v2-app.js sans elle)', () => {
  const m = monde({ feuilleTel: false });
  m.V2.tbMaj();
  assert.equal(m.enfants.length, 0); assert.ok(!m.body.classList.set.has('bnav-on'));
});

test('V2.tbMaj : la barre posée est retirée quand la session se ferme', () => {
  const m = monde();
  m.V2.tbMaj(); assert.equal(m.enfants.length, 1);
  m.V2.user = null; m.V2.tbMaj();
  assert.equal(m.enfants.length, 0); assert.ok(!m.body.classList.set.has('bnav-on'));
});

test('la feuille « Menu » : V2.feuille exposée par v2-pharma.js, branchée sur fbPose', () => {
  assert.match(pha, /V2\.feuille = function \(f, el\) \{ fbPose\(f, el\); \};/);
  assert.match(app, /V2\.feuille\(\{ t: 'Menu', s: 'Tous les outils'/);
  assert.match(app, /if \(V2\.tbMaj\) V2\.tbMaj\(\);/);
});

test('CSS : tout sous 640 px, rien d\'interdit sous Safari, la barre s\'efface sur la fiche et dans l\'éditeur Marketing', () => {
  const sans = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sans, /backdrop-filter|blur\(|opacity\s*:/);
  const i = sans.indexOf('@media (max-width:640px){');
  assert.match(sans.slice(0, i).trim(), /^\.bnav\{display:none\}$/, 'hors 640 px : la barre est cachée, rien d\'autre');
  assert.match(sans, /body\.bnav-on\.mk-editeur \.bnav,body\.bnav-on:has\(\.pha-wrap\.fdr-on\) \.bnav\{display:none\}/);
  assert.match(sans, /env\(safe-area-inset-bottom/);
  assert.match(sans, /\.v2-fab\{display:none\}/);
});
