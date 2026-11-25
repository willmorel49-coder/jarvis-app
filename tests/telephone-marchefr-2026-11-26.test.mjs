// 26/11/2026 — Demande France (audit du 25/11, MARCHEFR-1 ; accord de Will du 25/11 : le texte change aussi à l'ordinateur).
// Avant : sous « Comment lire ces taux », le commercial lisait « Le champ `pct` donne directement ce pourcentage. »,
// une phrase écrite pour un développeur. Elle vient du champ « note » d'odisse.json, écrit par generate_odisse.py.
// Ce que ce test garde : l'écran la retire d'un fichier DÉJÀ écrit (celui du dépôt la porte jusqu'au prochain passage du
// robot), sans rien retirer d'autre, et le générateur ne l'écrit plus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-marche-fr.js', import.meta.url), 'utf8');
const py = readFileSync(new URL('../generate_odisse.py', import.meta.url), 'utf8');
const TECH = 'Le champ `pct` donne directement ce pourcentage.';

// le vrai nettoyage, lu dans le fichier de l'écran
const m = js.match(/esc\(String\(ODI\.note\)\.replace\(\/(.+?)\/, ''\)\)/);
const nettoie = (note) => String(note).replace(new RegExp(m ? m[1] : '$^'), '');

test('Demande France : la note affichée passe par le nettoyage, et nulle part ailleurs sans lui', () => {
  assert.ok(m, 'nettoyage présent là où la note est affichée');
  assert.doesNotMatch(js, /esc\(ODI\.note\)/, 'la note ne s\'affiche plus brute');
  assert.equal((js.match(/ODI\.note/g) || []).length, 2, 'ODI.note : le test de présence et l\'affichage nettoyé');
});

test('Demande France : la phrase technique disparaît d\'une note déjà écrite, le reste est gardé mot pour mot', () => {
  const ancienne = 'Les taux sont pour 100 000 passages aux urgences, PAS pour 100 000 habitants : un taux de 16 667 = 16,7 % des passages. ' + TECH;
  assert.equal(nettoie(ancienne), 'Les taux sont pour 100 000 passages aux urgences, PAS pour 100 000 habitants : un taux de 16 667 = 16,7 % des passages.');
  // le fichier du dépôt, tel que le robot l'a écrit (avec ou sans la phrase selon la date)
  const note = JSON.parse(readFileSync(new URL('../crm/v2/odisse.json', import.meta.url), 'utf8')).note;
  const vue = nettoie(note);
  assert.doesNotMatch(vue, /`|champ|pct/, 'rien de technique à l\'écran : ' + vue);
  assert.match(vue, /PAS pour 100 000 habitants : un taux de 16 667 = 16,7 % des passages\.$/, 'l\'explication utile reste entière');
});

test('Demande France : une note sans la phrase technique n\'est pas touchée', () => {
  const neuve = 'Les taux sont pour 100 000 passages aux urgences, PAS pour 100 000 habitants : un taux de 16 667 = 16,7 % des passages.';
  assert.equal(nettoie(neuve), neuve);
  assert.equal(nettoie('Une autre note. Le champ pct est cité autrement.'), 'Une autre note. Le champ pct est cité autrement.', 'seule la phrase exacte est retirée');
});

test('Demande France : le générateur n\'écrit plus la phrase technique', () => {
  assert.ok(!py.includes('`pct`'), 'generate_odisse.py ne cite plus le champ pct dans la note');
  assert.ok(!py.includes('donne directement ce pourcentage'), 'phrase retirée du générateur');
  assert.match(py, /"note": \("Les taux sont %s, PAS pour 100 000 habitants : un taux de 16 667 = 16,7 %% "\n\s+"des passages\." % UNITE\),/, 'la note utile est gardée, et son %% reste doublé');
});
