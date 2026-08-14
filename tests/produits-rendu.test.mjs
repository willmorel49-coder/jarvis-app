/* Garde : ce test rend l'écran Produits à partir des VRAIES ventes.
   Même situation que produits-reel.test.mjs — voir l'explication détaillée
   en tête de ce fichier-là. En résumé : `wml-officines-data.js` a quitté le
   dépôt le 13/08/2026, la CI ne peut donc plus le jouer. Sauté et DIT. */
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const DONNEES = new URL('../crm/v2/wml-officines-data.js', import.meta.url);

if (existsSync(DONNEES)) {
  await import('./corps-produits-rendu.mjs');
} else {
  test('rendu de l ecran Produits sur ventes reelles', { skip: 'wml-officines-data.js absent du depot depuis le 13/08/2026 — joue ce test en local' }, () => {});
}
