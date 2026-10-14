/* aide-decodage-ventes.mjs — le VRAI décodage d'une ligne de ventes, extrait de v2-boot.js.
 *
 * Les tests ne recopient plus `month: s[1], year: 2026` : ils passent par le code livré
 * (V2.decoderVente et les trois petites fonctions du compteur de mois, 14/10/2026).
 * Rien n'est réécrit ici : on découpe le bloc dans le fichier et on l'exécute tel quel.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));

export function chargerDecodage(racine = RACINE, V2 = {}) {
  const boot = readFileSync(join(racine, 'crm', 'v2', 'v2-boot.js'), 'utf8');
  const debut = boot.indexOf('V2.AN0 = ');
  if (debut < 0) throw new Error('V2.AN0 introuvable dans v2-boot.js');
  const f = boot.indexOf('V2.decoderVente = function', debut);
  if (f < 0) throw new Error('V2.decoderVente introuvable dans v2-boot.js');
  let p = 0, j = boot.indexOf('{', f), fin = j;
  for (; j < boot.length; j++) {
    if (boot[j] === '{') p++;
    else if (boot[j] === '}') { p--; if (p === 0) { fin = j; break; } }
  }
  new Function('V2', boot.slice(debut, fin + 1) + ';')(V2);
  return V2;
}
