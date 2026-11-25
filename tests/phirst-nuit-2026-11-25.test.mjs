/* phirst-nuit-2026-11-25.test.mjs — 17 défauts visibles relevés par l'audit de nuit du 25/11/2026 (14 écrans, 1440 et 390, production)
 *
 * Audit : ~/PHIRST/finalisation-2026-11-22/Z6-nuit/audit/defauts-A.md et defauts-B.md. Chaque test porte le numéro du défaut.
 * Doublons retirés, typographie (espaces insécables, apostrophe courbe), texte de développeur, mise en page cassée au téléphone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const P = req('../phirst/v2/phirst-pur.js');
const T = req('../phirst/v2/phirst-textes-pur.js');
const D = req('../phirst/v2/phirst-dossiers-pur.js');
const V = req('../phirst/v2/phirst-vitrine-pur.js');
const lire = (f) => readFileSync(new URL('../phirst/v2/' + f, import.meta.url), 'utf8');
const NB = '\u00A0';

test('B32 · journal des appels : pas de point avant « — par … »', () => {
  assert.equal(P.avecAuteur('Appel passé — à rappeler.', 'Essai Télépro'), 'Appel passé — à rappeler — par Essai Télépro');
  assert.equal(P.avecAuteur('Rendez-vous confirmé', 'Essai Socle'), 'Rendez-vous confirmé — par Essai Socle');
  assert.equal(P.avecAuteur('Appel passé.', ''), 'Appel passé.', 'sans auteur, la phrase reste telle quelle');
});

test('B22 · Yann lit « vous » ; la téléprospectrice lit « Yann »', () => {
  assert.equal(T.mentionPhrase('depart', true).texte, 'Proposition de départ · vous ne l’avez pas encore écrite');
  assert.equal(T.mentionPhrase('depart', false).texte, 'Proposition de départ · Yann ne l’a pas encore écrite');
  assert.equal(T.mentionPhrase('yann', true).texte, 'Phrase écrite par Yann');
});

test('B8 · carte : la couche des cessions porte le même nom dans la bulle « Dans cette vue »', () => {
  const s = lire('phirst-officines.js');
  assert.match(s, /transferts: 'cessions et créations', signaux:/);
  assert.doesNotMatch(s, /transferts: 'transferts'/);
});

test('A11 · Dossiers : plus de phrase de développeur « Recalculé à chaque ouverture »', () => {
  const s = lire('phirst-dossiers.js');
  assert.doesNotMatch(s, /Recalculé à chaque ouverture/);
  assert.equal(s.split('Rien à saisir en plus : tout part des étapes déjà cochées.').length - 1, 2);
});

test('A12 · Dossiers : la phrase du bloc « Cette semaine » est directe', () => {
  assert.equal(D.titreSemaine(1, 1, 2).texte, 'Sur vos 2 dossiers, 1 est retenu par une étape. La voici, avec qui peut la débloquer.');
  assert.equal(D.titreSemaine(3, 2, 6).texte, 'Sur vos 6 dossiers, 2 sont retenus par une étape. Les voici, avec qui peut les débloquer.');
  assert.doesNotMatch(D.titreSemaine(3, 2, 6).texte, /faire bouger|retient le reste/);
});

test('A27 · accueil : apostrophe courbe dans les textes venus du robot', () => {
  assert.match(lire('phirst-ligne.js'), /function esc\(t\) \{[^\n]*\.replace\(\/'\/g, '’'\)/);
});

test('B12 · Veille : « il y a 17 jours (8 novembre) » ne se coupe plus', () => {
  const s = lire('phirst-veille.js');
  assert.match(s, /function insec\(s\) \{ return String\(s == null \? '' : s\)\.replace\(\/ \/g, '\\u00A0'\); \}/);
  assert.match(s, /esc\(insec\(P\.age\(v\.date, P\.aujourdhui\(\)\)\)\) \+ ' \(' \+ esc\(insec\(P\.jourAvecAnnee\(/);
});

test('A34 · Dossiers : la date courte ne se coupe plus (et l’année reste retirée dans les Chantiers)', () => {
  assert.equal(D.court('2026-12-15'), '15' + NB + 'déc.' + NB + '2026');
  const C = req('../phirst/v2/phirst-chantiers-pur.js');
  assert.equal(C.quand({ fait: '2026-11-10' }, '2026-11-25').texte, 'Faite le 10' + NB + 'nov.', 'année en cours : toujours retirée');
});

test('B17 · Vitrine : le « · » du titre d’une demande ne finit plus une ligne', () => {
  assert.equal(V.titreDemande({ pharmacie: 'Pharmacie de la Châtaigneraie', ville: 'Lanester' }), 'Pharmacie de la Châtaigneraie' + NB + '·' + NB + 'Lanester', 'insécables des DEUX côtés : avant seul, le « · » finissait encore la ligne (vu le 25/11 à 390)');
});

test('A36 · Chantiers : « vous-même » ne se coupe plus dans le mot', () => {
  assert.match(lire('phirst-chantiers.js'), /faire <span style="white-space:nowrap">vous-même<\/span>\./);
});

test('Encaisser : les guillemets de « Malgré mon précédent message » ne restent plus seuls en fin de ligne', () => {
  assert.match(lire('phirst-encaisser.js'), /«\\u00A0Malgré mon précédent message\\u00A0» seulement si/);
});

test('B24 · phrases de départ : jamais d’espace ordinaire avant « ? ! : ; »', () => {
  for (const r of T.RAISONS) assert.doesNotMatch(String(r.propo || ''), / [?!:;]/, r.cle);
  assert.ok(T.RAISONS.find((r) => r.cle === 'relance').propo.includes('réfléchir' + NB + '?'), 'marqueur positif : « Relance promise »');
});

test('B5 · Appels : dans la ligne ouverte, la lettre n’est dite qu’une fois', () => {
  assert.match(lire('phirst-finitions.css'), /\.pa-l\.pa-ouvert:has\(\.pa-envoye\) \.pa-etat\{display:none\}/);
});

test('B16 · Vitrine : le numéro n’est écrit qu’une fois (sur le bouton « Appeler le … »)', () => {
  const s = lire('phirst-vitrine.js');
  assert.match(s, /if \(!lien\) h \+= '<p class="vt-qui">'/);
  assert.match(s, /else if \(d\.nom\) h \+= '<p class="vt-qui"><b>' \+ esc\(d\.nom\) \+ '<\/b><\/p>';/);
});

test('A6 · Agenda : pas de pastille « À confirmer » dans la section « À confirmer »', () => {
  assert.match(lire('phirst-agenda.js'), /\(S\.telepro \|\| e\.rdv\.statut === 'propose' \? '' : etatBadge\(e\.rdv\)\)/);
});

test('A16 · Chantiers : pas de pastille « En cours » dans le groupe « En cours »', () => {
  assert.match(lire('phirst-chantiers.js'), /st\.texte === 'En cours' \? '' : pastille\(st\)/);
});

test('A5 · Agenda : le sous-titre d’un rendez-vous ne répète pas le nom de la pharmacie', () => {
  assert.match(lire('phirst-agenda.js'), /lieu = r\.lieu && String\(r\.lieu\)\.trim\(\)\.toLowerCase\(\) !== String\(f\.nom \|\| ''\)\.trim\(\)\.toLowerCase\(\) \? r\.lieu : ''/);
});

test('B3 · Vitrine et Dossiers : le compte d’un groupe passe sous le titre au téléphone', () => {
  assert.match(lire('phirst-dossiers.css'), /\.dz \.dz-groupe-t\{display:flex;flex-wrap:wrap;/);
});

test('B12 · Veille au téléphone, A10 · Agenda : de l’air au-dessus des boutons', () => {
  const css = lire('phirst-finitions.css');
  assert.match(css, /@media \(max-width:1023px\)\{\.pa\.pv \.pa-l>\.pa-bs\{margin-top:12px\}\}/);
  assert.match(css, /\.ag-conf \.pa-bs\{margin-top:12px\}/);
  assert.match(css, /\.ag-conf \.pa-ht small,\.ag-rdv \.pa-ht small\{margin-top:4px\}/);
});

test('B15 · Vitrine : les cartes ne s’étirent plus à la hauteur de la plus haute', () => {
  assert.match(lire('phirst-vitrine.css'), /\.vt \.vt-liste,\.vt \.vt-grille\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:start;/);
});

test('A4 · Officines : « Reprendre » n’a plus le même bouton plein que « Ajouter à mes pistes »', () => {
  const s = lire('phirst-officines.js');
  assert.match(s, /<button type="button" class="pa-b" data-reprendre=/);
  assert.match(s, /<button type="button" class="pa-b pa-ok" data-ajout="1"/, 'marqueur positif : « Ajouter à mes pistes » reste plein');
});
