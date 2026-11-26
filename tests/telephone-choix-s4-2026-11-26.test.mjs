// 26/11/2026 — Campagne au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix », sujet 4, version 2
// (« L'aperçu du mail replié »).
// Avant : l'aperçu du mail faisait plus d'un écran à lui seul, entre le message et le choix des officines.
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-campagne.js) dans node:vm :
//   · au téléphone, l'aperçu est derrière une ligne « Voir le mail tel qu'il partira », au même endroit de la page ;
//   · le repli n'est qu'une enveloppe : #cmpg-apercu est toujours écrit, l'aperçu est demandé exactement comme avant,
//     ni bloqué ni relancé ; la 2e ligne redit l'objet que l'aperçu affiche ;
//   · à l'ordinateur, la page est celle d'avant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../crm/v2/v2-campagne.js', import.meta.url), 'utf8');
const nb = (h, s) => h.split(s).length - 1;

// La page montée dans une fausse fenêtre. `tel` : la fenêtre fait-elle 640 px ou moins ?
function monter({ tel }) {
  const apercus = [], observes = [], elements = {};
  const doc = {
    getElementById: (id) => elements[id] || null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(t) {} }), head: { appendChild() {} }
  };
  class MutationObserver {
    constructor(f) { this.f = f; }
    observe(n, o) { observes.push({ noeud: n, options: o, rappel: this.f }); }
    disconnect() { observes.push('coupé'); }
  }
  const ctx = {
    console, JSON, String, Object, Array, Promise, RegExp, document: doc, MutationObserver,
    matchMedia: (q) => ({ matches: /max-width:\s*640px/.test(q) ? tel : false }),
    ICO: (n, s) => '<svg data-ico="' + n + '" width="' + s + '"></svg>',
    V2MOD: { liste: () => [{ cle: 'routine', nom: 'La proposition de rendez-vous' }] }
  };
  ctx.window = ctx;
  ctx.V2 = {
    user: { id: 'u', commercial: 'Karine' }, pages: {},
    topbar: () => '<header data-haut></header>',
    rdvApercu: { montrer: (...a) => apercus.push(a) }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const racine = { innerHTML: '' };
  return { ctx, V2: ctx.V2, racine, apercus, observes, elements, rendre: () => { ctx.V2.pages.campagne.render(racine); return racine.innerHTML; } };
}
// Un faux nœud d'aperçu, tel que V2.rdvApercu le remplit (v2-rdv-apercu.js) : `objet` = le mail est prêt ; sinon `corps` seul.
function faitApercu({ objet, corps }) {
  return {
    querySelector: (s) => s === '.v2-ap-obj' ? (objet == null ? null : { lastChild: { nodeType: 3, textContent: objet } })
      : s === '.v2-ap-corps' ? { textContent: corps } : null
  };
}

test('marqueur : la page Campagne se rend, avec ses cinq parties dans l’ordre', () => {
  const h = monter({ tel: false }).rendre();
  const ordre = ['Comment vous envoyez', 'Le message', 'Aperçu du mail', 'Qui vous visez', 'La liste', 'id="cmpg-envoi"'].map((x) => h.indexOf(x));
  assert.ok(ordre.every((x) => x > 0), 'les cinq titres et le bouton d’envoi sont là');
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), 'dans l’ordre de la page');
});

test('téléphone : l’aperçu est replié derrière « Voir le mail tel qu’il partira », au même endroit', () => {
  const h = monter({ tel: true }).rendre();
  const m = /<div class="v2-camp-sec">Aperçu du mail<\/div><details class="cmpg-pli" id="cmpg-pli"><summary>([\s\S]*?)<\/summary><div id="cmpg-apercu"><\/div><\/details><div class="v2-camp-sec">Qui vous visez<\/div>/.exec(h);
  assert.ok(m, 'le repli est entre le titre « Aperçu du mail » et « Qui vous visez », et contient #cmpg-apercu');
  assert.match(m[1], /<b>Voir le mail tel qu’il partira<\/b><small id="cmpg-pli-etat"><\/small>/, 'libellé de la planche, 2e ligne prête à recevoir l’objet');
  assert.match(m[1], /data-ico="fiche"[\s\S]*data-ico="chev"/, 'la feuille à gauche, le chevron à droite');
  assert.doesNotMatch(h, /<details[^>]* open/, 'replié en arrivant');
  assert.equal(nb(h, 'id="cmpg-apercu"'), 1, 'un seul #cmpg-apercu');
  // l'ordre de la page ne change pas, rien d'autre n'est replié
  const ordre = ['Comment vous envoyez', 'Le message', 'Aperçu du mail', 'Qui vous visez', 'La liste', 'id="cmpg-envoi"'].map((x) => h.indexOf(x));
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b));
  assert.equal(nb(h, '<details'), 1);
});

test('téléphone : l’aperçu est demandé comme avant — une fois, dans #cmpg-apercu, sans attendre l’ouverture du repli', () => {
  for (const tel of [true, false]) {
    const p = monter({ tel }); p.rendre();
    assert.equal(p.apercus.length, 1, (tel ? 'téléphone' : 'ordinateur') + ' : un seul appel à l’aperçu au rendu');
    assert.deepEqual(Array.from(p.apercus[0]), ['cmpg-apercu', 'routine', '', null, false], 'mêmes arguments des deux côtés');
  }
  // ni « ontoggle » ni écouteur : ouvrir la ligne ne déclenche aucun code, donc aucun rechargement
  assert.doesNotMatch(SRC, /ontoggle|addEventListener\('toggle'/);
});

test('téléphone : la 2e ligne suit l’aperçu (attente, objet du mail) sans rien calculer', () => {
  const p = monter({ tel: true });
  const ligne = { textContent: '' }, repli = { open: false };
  p.elements['cmpg-pli'] = repli; p.elements['cmpg-pli-etat'] = ligne;
  p.elements['cmpg-apercu'] = faitApercu({ corps: 'Préparation de l’aperçu…' });
  p.rendre();
  const o = p.observes.filter((x) => x !== 'coupé');
  assert.equal(o.length, 1, 'un observateur posé sur l’aperçu');
  assert.equal(o[0].noeud, p.elements['cmpg-apercu']);
  assert.equal(o[0].options.childList, true);
  o[0].rappel();
  assert.equal(ligne.textContent, 'Préparation de l’aperçu…', 'pendant le chargement, la ligne le dit avec les mots de l’aperçu');
  assert.equal(repli.open, false);
  p.elements['cmpg-apercu'].querySelector = faitApercu({ objet: 'Passage dans votre secteur', corps: 'Bonjour,…' }).querySelector;
  o[0].rappel();
  assert.equal(ligne.textContent, 'Objet : Passage dans votre secteur', 'mail prêt : son objet, lu dans l’aperçu');
  assert.equal(repli.open, false, 'le repli reste fermé : l’arrivée du mail ne l’ouvre pas');
  // l'objet n'est fabriqué nulle part dans ce fichier : il vient du nœud .v2-ap-obj de l'aperçu
  assert.match(SRC, /z\.querySelector\('\.v2-ap-obj'\)/);
  assert.doesNotMatch(SRC.slice(SRC.indexOf('function pliEtat'), SRC.indexOf('function pliSuivre')), /V2MOD|rdvModele|rendre\(/, 'aucun rendu de modèle dans la ligne');
});

test('téléphone : un message à lire à la place du mail (modèle refusé en envoi groupé) s’affiche ouvert, comme avant', () => {
  const p = monter({ tel: true });
  const ligne = { textContent: 'x' }, repli = { open: false };
  p.elements['cmpg-pli'] = repli; p.elements['cmpg-pli-etat'] = ligne;
  p.elements['cmpg-apercu'] = faitApercu({ corps: 'Ce modèle nomme ou chiffre l’officine ({{nom_officine}}). En envoi groupé, un seul texte part vers 25 officines : il serait faux pour 24 d’entre elles.' });
  p.rendre();
  p.observes.filter((x) => x !== 'coupé')[0].rappel();
  assert.equal(repli.open, true);
  assert.equal(ligne.textContent, '');
  // « Aperçu indisponible. » tient dans la ligne : pas besoin d'ouvrir
  const q = monter({ tel: true }), l2 = { textContent: '' }, r2 = { open: false };
  q.elements['cmpg-pli'] = r2; q.elements['cmpg-pli-etat'] = l2; q.elements['cmpg-apercu'] = faitApercu({ corps: 'Aperçu indisponible.' });
  q.rendre(); q.observes.filter((x) => x !== 'coupé')[0].rappel();
  assert.equal(l2.textContent, 'Aperçu indisponible.');
  assert.equal(r2.open, false);
});

test('ordinateur : ni repli ni observateur, l’aperçu est à nu comme avant', () => {
  const p = monter({ tel: false }), h = p.rendre();
  assert.doesNotMatch(h, /<details|cmpg-pli|Voir le mail tel qu/);
  assert.match(h, /<div class="v2-camp-sec">Aperçu du mail<\/div><div id="cmpg-apercu"><\/div><div class="v2-camp-sec">Qui vous visez<\/div>/, 'les trois morceaux se suivent comme avant');
  assert.equal(p.observes.length, 0, 'aucun observateur posé à l’ordinateur');
});

test('le style du repli n’existe que dans un bloc 640 px, avec une cible et des textes lisibles', () => {
  const css = SRC.slice(SRC.indexOf("s.id = 'v2-camp-css'"), SRC.indexOf("].join('');"));
  const i = css.indexOf("'@media (max-width:640px){',"), j = css.indexOf("\n      '}'", i);
  assert.ok(i > 0 && j > i, 'bloc 640 px présent dans la feuille de Campagne');
  assert.equal(nb(css, '@media'), 1, 'c’est le seul bloc @media de cette feuille');
  const bloc = css.slice(i, j);
  assert.equal(nb(css, 'cmpg-pli'), nb(bloc, 'cmpg-pli'), 'toutes les règles .cmpg-pli sont dans ce bloc');
  assert.ok(nb(bloc, 'cmpg-pli') >= 8);
  assert.ok(+/\.cmpg-pli>summary\{[^}]*min-height:(\d+)px/.exec(bloc.replace(/',\s*'\s*/g, ''))[1] >= 44, 'ligne d’au moins 44 px');
  assert.match(bloc, /\.cmpg-pli>summary::-webkit-details-marker\{display:none\}/, 'le triangle natif de Safari est masqué');
  const tailles = [...bloc.matchAll(/font-size:([\d.]+)px/g)].map((x) => +x[1]);
  assert.ok(tailles.length >= 2 && tailles.every((t) => t >= 12), 'textes de 12 px ou plus : ' + tailles);
  assert.doesNotMatch(bloc, /backdrop-filter|filter:\s*blur/, 'aucun effet interdit sous Safari');
});
