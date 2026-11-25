// 26/11/2026 — Appro au téléphone (audit du 25/11, APPRO-1).
// Avant : chaque rubrique repliée disait deux fois la même chose, sur 7 lignes d'affilée :
// « mer. 25 · 130 commandes à passer · 406 critiques » puis, dessous, « 130 commandes à passer ».
// Ce que ce test garde, sur le VRAI code (titre → chiffre clé → ligne repliée), avec des blocs inventés :
//   - une ligne dont le titre contient déjà le chiffre clé le perd en seconde ligne ;
//   - une ligne dont le titre ne le contient pas le garde ;
//   - le tout reste derrière la condition « téléphone » du module (rien ne bouge à l'ordinateur).
// Données FICTIVES uniquement (dépôt public).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-appro.js', import.meta.url), 'utf8');
const module_ = src.slice(src.indexOf('V.pages.appro.__apv) return;'));   // le module « une ligne par rubrique »

// une fonction du module, sur une ligne ou sur plusieurs
function charge(nom) {
  const i = module_.indexOf('\n  function ' + nom + '(');
  assert.ok(i >= 0, nom + ' introuvable');
  const finLigne = module_.indexOf('\n', i + 1), ligne = module_.slice(i + 1, finLigne);
  if (/\}\s*$/.test(ligne)) return ligne;
  const fin = module_.indexOf('\n  }\n', i);
  assert.ok(fin > i, nom + ' : fin introuvable');
  return module_.slice(i + 1, fin + 4);
}

// un faux élément de page : une classe, un texte, et ce que rend querySelector
class Faux {
  constructor(cls, texte, enfants) { this.className = cls; this.textContent = texte || ''; this.q = enfants || {}; this.attrs = {}; this.classes = []; }
  querySelector(sel) { return this.q[sel] || null; }
  querySelectorAll() { return []; }
  setAttribute(k, v) { this.attrs[k] = v; }
  get classList() { const c = this.classes; return { add: (x) => c.push(x) }; }
}

const poses = [];
const fauxDoc = { createElement: () => new Faux('', '') };
const M = new Function('document', 'ouvertes', 'CHEV',
  ['txt', 'esc', 'onglet', 'avant', 'titre', 'figure', 'dejaDansTitre', 'replier'].map(charge).join('\n') +
  '\nreturn { titre: titre, figure: figure, dejaDansTitre: dejaDansTitre, replier: replier };')(fauxDoc, {}, '');

// le chemin réel d'une rubrique : titre() et figure() lisent le bloc, replier() fabrique la ligne
function ligneRepliee(bloc) {
  bloc.parentNode = { insertBefore: (b) => poses.push(b) };
  const u = { els: [bloc], main: bloc, sec: '', k: 0 };
  u.titre = M.titre(u); u.fig = M.figure(u);
  M.replier([u], new Faux('v2-wrap', '', { '.ap-navb.on': new Faux('', 'Aujourd’hui') }));
  return { titre: u.titre, fig: u.fig, html: u.row.innerHTML };
}

test('Appro, téléphone : un jour du carnet d\'achat ne répète plus « 130 commandes à passer » sous son titre', () => {
  const jour = new Faux('cl-today', '', { '.cl-th': new Faux('', 'mer. 25'), '.cl-big': new Faux('', '130 commandes à passer · 406 critiques') });
  const r = ligneRepliee(jour);
  assert.equal(r.titre, 'mer. 25 · 130 commandes à passer · 406 critiques');
  assert.equal(r.fig, '<b>130</b> commandes à passer', 'le chiffre clé est toujours calculé (il sert ailleurs)');
  assert.doesNotMatch(r.html, /apv-fg/, 'pas de seconde ligne : ' + r.html);
  assert.match(r.html, /<span class="apv-tt">mer\. 25 · 130 commandes à passer · 406 critiques<\/span>/);

  const suivant = new Faux('cl-nx', '', { '.d': new Faux('', 'jeu. 26'), '.i': new Faux('', '19 commandes · LABO FICTIF A, LABO FICTIF B') });
  const s = ligneRepliee(suivant);
  assert.equal(s.fig, '<b>19</b> commandes');
  assert.doesNotMatch(s.html, /apv-fg/, 'pas de seconde ligne : ' + s.html);
});

test('Appro, téléphone : une rubrique dont le titre ne dit pas le chiffre garde sa seconde ligne', () => {
  const fil = new Faux('fa-card', '', { '.fa-pill b': new Faux('', '12') });
  const r = ligneRepliee(fil);
  assert.equal(r.titre, 'Le fil d’anticipation');
  assert.match(r.html, /<span class="apv-fg"><b>12<\/b> événements à venir<\/span>/, r.html);

  const compteurs = new Faux('ap-kpis', '', { '.ap-kpi': new Faux('', '', { '.ap-kv': new Faux('', '97 %'), '.ap-kl': new Faux('', 'taux de service') }) });
  const c = ligneRepliee(compteurs);
  assert.equal(c.titre, 'Les compteurs de service');
  assert.match(c.html, /<span class="apv-fg"><b>97 %<\/b> taux de service<\/span>/, c.html);
});

test('Appro : « déjà dans le titre » ne se trompe pas de nombre', () => {
  const d = M.dejaDansTitre;
  assert.equal(d('mer. 25 · 130 commandes à passer · 406 critiques', '<b>130</b> commandes à passer'), true);
  assert.equal(d('jeu. 26 · 13 commandes', '<b>3</b> commandes'), false, '« 3 commandes » n\'est pas « 13 commandes »');
  assert.equal(d('jeu. 26 · 1 130 commandes', '<b>130</b> commandes'), false, '« 130 commandes » n\'est pas « 1 130 commandes »');
  assert.equal(d('Stock & sites', '<b>71</b> jours'), false);
  assert.equal(d('Recherche & négociation · 4 dossiers', '<b>4</b> dossiers'), true, 'un « & » dans le titre ne gêne pas la comparaison');
  assert.equal(d('Un titre', ''), false);
  assert.equal(d('Un titre', null), false);
});

test('Appro : le repli reste derrière la condition « téléphone » du module', () => {
  assert.match(module_, /function mobile\(\) \{ return !!\(window\.matchMedia && window\.matchMedia\('\(max-width:760px\)'\)\.matches\); \}/);
  assert.match(module_, /function avancer\(root\) \{\n    if \(!mobile\(\)\) return;/, 'à l\'ordinateur, avancer() sort tout de suite');
  assert.equal((module_.match(/replier\(/g) || []).length, 2, 'replier() : sa définition et son seul appel, dans avancer()');
  assert.equal((src.match(/dejaDansTitre\(/g) || []).length, 2, 'dejaDansTitre() : sa définition et son seul appel, dans replier()');
});
