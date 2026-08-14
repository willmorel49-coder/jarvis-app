/* Garde : ces tests s'appuient sur les VRAIES ventes.

   ⚠️ `wml-officines-data.js` a quitté le dépôt public le 13/08/2026 (il portait
   691 officines avec leur CA et 437 848 lignes de ventes). Depuis, ces tests
   échouent sur CHAQUE commit dans la CI — un rouge permanent, donc plus aucun
   signal : une vraie régression passerait inaperçue au milieu.

   Ils ne sont pas supprimés — ils vérifient une règle métier qui compte (aucun
   abandon de marge sur un générique ou un NR). Ils tournent en local, où le
   fichier existe (~/jarvis-deploy/crm/v2/). En CI, ils sont déclarés SAUTÉS,
   avec la raison affichée : sauté et dit, jamais sauté en douce.

   À faire ensuite : un petit jeu d'essai anonymisé, versionné, pour que la
   règle soit vérifiée en CI aussi. */
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const DONNEES = new URL('../crm/v2/wml-officines-data.js', import.meta.url);

if (existsSync(DONNEES)) {
  await import('./corps-produits-reel.mjs');
} else {
  test('produits sur ventes reelles', { skip: 'wml-officines-data.js absent du depot depuis le 13/08/2026 — joue ce test en local' }, () => {});
}
