/* phirst-defauts-anciens.test.mjs — deux défauts anciens relevés par les preuves des lots L3 et L4 (25/11/2026)
 *
 * 1. Dossiers, carte « Cette semaine » : le petit titre « Prochaine chose à faire · … » faisait 12,5 px (< 13 px),
 *    règle `.dz .dz-proch .dz-kicker` de phirst-dossiers.css (mesuré sous WebKit à 1 440 et 390).
 * 2. Accueil : le bouton « Aller aux outils » (lien d'évitement du socle, `.u2-skip`) faisait 35 px de haut à 1 440 :
 *    phirst-finitions.css ne lui donnait 44 px que dans le @media (pointer:coarse),(max-width:700px).
 * La taille au pixel se mesure sous WebKit : ici, la règle et sa portée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'phirst', 'v2');
const dossiers = readFileSync(join(DIR, 'phirst-dossiers.css'), 'utf8');
const finitions = readFileSync(join(DIR, 'phirst-finitions.css'), 'utf8');

test('Dossiers : le petit titre « Prochaine chose à faire » fait au moins 13 px', () => {
  const regles = [...dossiers.matchAll(/([^{}]*\.dz-proch \.dz-kicker[^{}]*)\{([^{}]*)\}/g)];
  assert.ok(regles.length >= 1, 'la règle du petit titre existe (marqueur positif)');
  let vus = 0;
  for (const [, sel, corps] of regles) {
    for (const m of corps.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) { vus++; assert.ok(+m[1] >= 13, '« ' + sel.trim() + ' » donne ' + m[1] + ' px (13 au moins)'); }
  }
  assert.ok(vus >= 1, 'la taille est bien lue (au moins une valeur en px)');
});

/* Retire les commentaires, puis les blocs @media (un niveau d'accolades imbriquées) : il ne reste que les règles valables à toutes les tailles. */
function horsMedia(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
}

test('Accueil : « Aller aux outils » fait 44 px de haut à toutes les tailles, pas seulement au doigt', () => {
  assert.ok(/@media \(pointer:coarse\),\(max-width:700px\)\{/.test(finitions), 'le bloc des cibles tactiles existe toujours (marqueur positif)');
  const base = horsMedia(finitions);
  assert.ok(!/@media/.test(base) && /\.lg-liste li button/.test(finitions) && !/\.lg-liste li button/.test(base), 'les @media sont bien retirés (la règle « au doigt » des listes en sort)');
  assert.match(base, /\.u2-skip,\.u2-skip:focus\{min-height:44px\}/, 'la règle 44 px du lien d’évitement est hors de tout @media');
});
