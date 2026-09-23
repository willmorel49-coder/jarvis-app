/* Garde : ce test rend l'écran Produits à partir des VRAIES ventes.
   Même situation que produits-reel.test.mjs — voir l'explication détaillée
   en tête de ce fichier-là. En résumé : `wml-officines-data.js` a quitté le
   dépôt le 13/08/2026, la CI ne peut donc plus le jouer. Sauté et DIT. */
import { test } from 'node:test';
import { existsSync } from 'node:fs';

// ⚠️ 23/09/2026 : wml-officines-data.js est revenu dans le dépôt (sans les ventes) ;
// les ventes vivent dans wml-ventes-NN.js, hors dépôt depuis le 03/09. C'est lui qu'on guette.
const DONNEES = new URL('../crm/v2/wml-ventes-01.js', import.meta.url);

if (existsSync(DONNEES)) {
  await import('./corps-produits-rendu.mjs');
} else {
  test('rendu de l ecran Produits sur ventes reelles', { skip: 'ventes protegees (wml-ventes-NN.js) absentes du depot — joue ce test en local' }, () => {});
}
