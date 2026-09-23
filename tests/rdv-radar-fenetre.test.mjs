/* Garde : ces tests lisent les VRAIES ventes (wml-ventes-NN.js).
   Même situation que produits-reel.test.mjs : les ventes ont quitté le dépôt
   public le 03/09/2026, la CI ne peut donc pas les jouer. Sauté et DIT ;
   en local, avec les ventes déposées dans crm/v2/, le test tourne en entier. */
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const DONNEES = new URL('../crm/v2/wml-ventes-01.js', import.meta.url);

if (existsSync(DONNEES)) {
  await import('./corps-rdv-radar-fenetre.mjs');
} else {
  test('radar « Qui inviter » sur ventes reelles', { skip: 'ventes protegees (wml-ventes-NN.js) absentes du depot — joue ce test en local' }, () => {});
}
