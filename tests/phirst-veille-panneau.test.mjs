/* phirst-veille-panneau.test.mjs — l'écran Veille et le panneau « la veille du rendez-vous » ne partagent plus de nom (25/11/2026)
 *
 * L'écran Veille (phirst-veille.js, lot 1 du 20/11) a pour racine <section class="pa pv">. Le panneau de la veille du rendez-vous
 * (phirst-preparer.js, lot L3 du 24/11) a pris le même nom de classe, `.pv`, pour son panneau flottant (position:fixed, à droite,
 * 1 000 px, décalé de 48 px). Résultat vu dans le Safari de Will le 25/11 à 2 h 34 : l'écran Veille flottait à droite, par-dessus
 * le menu, coupé à droite et en bas. Le panneau s'appelle désormais `.pv-panneau`.
 * La garde générale : aucune classe racine d'un écran (<section class="pa …">) ne reçoit position:fixed dans une feuille de Phirst.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'phirst', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('Le panneau de la veille du rendez-vous a son propre nom, distinct de l’écran Veille', () => {
  const veille = lire('phirst-veille.js'), js = lire('phirst-preparer.js'), css = sansCommentaires(lire('phirst-preparer.css'));
  assert.match(veille, /<section class="pa pv"/, 'l’écran Veille garde sa racine « pa pv » (marqueur positif)');
  assert.match(js, /pv\.className = 'pv-panneau'; pv\.id = 'pv';/, 'le panneau est créé avec la classe pv-panneau');
  assert.match(css, /\.pv-panneau\{position:fixed;/, 'la règle du panneau flottant vise pv-panneau');
  const nus = [...css.matchAll(/\.pv(?![-\w])/g)].length;
  assert.equal(nus, 0, 'aucun sélecteur « .pv » nu dans phirst-preparer.css (il viserait l’écran Veille)');
});

test('Aucune classe racine d’un écran ne reçoit position:fixed dans une feuille de Phirst', () => {
  const racines = new Set();
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.js'))) {
    for (const m of lire(f).matchAll(/<section class="pa ([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && racines.add(c));
  }
  assert.ok(racines.has('pv') && racines.has('ag') && racines.has('dz'), 'les racines des écrans sont bien lues (Veille, Agenda, Dossiers)');
  const fautes = [];
  let reglesFixes = 0;
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.css'))) {
    for (const [, sel, corps] of sansCommentaires(lire(f)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/position\s*:\s*fixed/.test(corps)) continue;
      reglesFixes++;
      for (const s of sel.split(',')) {
        const dernier = s.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() || '';
        for (const c of racines) if (new RegExp('\\.' + c + '(?![-\\w])').test(dernier)) fautes.push(f + ' : « ' + s.trim() + ' » (racine de l’écran « ' + c + ' »)');
      }
    }
  }
  assert.ok(reglesFixes >= 1, 'les règles position:fixed sont bien lues (au moins le panneau de la veille)');
  assert.deepEqual(fautes, [], 'une racine d’écran ne doit jamais flotter');
});
