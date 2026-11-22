/* todo-tableau.test.mjs — lot 5 V3 « Le tableau » (22/11/2026) : To do en trois colonnes, glisser = la date seule change
 *
 * Choix de Will (22/11/2026, 16 h 10) : To do = « Le tableau » avec SortableJS. Ce test garde :
 *  1. trois colonnes « Aujourd'hui / Cette semaine / Plus tard », chaque tâche dans la colonne de sa date, retards DANS « Aujourd'hui », note ENTIÈRE ;
 *  2. déplacer (bouton « Déplacer », glisser) = la date `pour` change, RIEN d'autre (même format, même clé de stockage `jarvis_todo_v1`) ;
 *  3. SortableJS absent (script qui ne charge pas, ou `window.Sortable` jamais défini) → l'écran se dessine quand même et « Déplacer » change la date ;
 *  4. la brique est chargée à la demande depuis vendor/sortablejs/ avec le jeton ?v= lu sur le <script> de v2-todo.js, et le fichier existe (MIT).
 * Le vrai fichier v2-todo.js tourne dans un bac à sable `vm` (stockage local, pas de Supabase). Le geste du doigt ou de la souris au pixel
 * près se prouve sous WebKit (banc), pas ici : on simule l'évènement `onEnd` que Sortable envoie, avec le vrai code de rattachement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const SRC = readFileSync(join(DIR, 'v2-todo.js'), 'utf8');
const CLE = 'jarvis_todo_v1:local';

const iso = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
const NOTE_LONGUE = 'Rappeler le titulaire pour confirmer le rendez-vous de jeudi, apporter le tarif des génériques et le formulaire d’ouverture de compte, puis vérifier avec l’adjointe la date de la prochaine livraison.';
const tache = (id, pour, extra = {}) => ({ id, k: 'libre', pid: '', nom: 'Pharmacie ' + id, mail: '', note: 'Note ' + id, pour, fait: false, faitLe: '', cree: '2026-11-01T08:00:00.000Z', rep: '', ancre: '', prec: '', dernier: '', ...extra });
const JEU = () => [
  tache('retard', iso(-3)), tache('auj', iso(0)), tache('demain', iso(1), { note: NOTE_LONGUE }), tache('lointaine', iso(30)), tache('sansdate', ''),
  tache('rdv1', iso(4), { k: 'rdv' })
];

function monter(taches, o = {}) {
  const sb = { console, setTimeout, clearTimeout, Date, Promise, JSON, Math };
  const noop = () => {};
  sb.window = sb; sb.globalThis = sb;
  const ajoutes = [];                                 // les <script> posés dans <head> (chargement de Sortable)
  const LS = new Map([[CLE, JSON.stringify(taches)]]);
  sb.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k) };
  sb.__LS = LS; sb.__scripts = ajoutes;
  sb.document = {
    currentScript: { src: 'v2/v2-todo.js' + (o.jeton === undefined ? '?v=jeton123' : o.jeton) },   // lu une seule fois, à l'exécution du fichier
    getElementById: () => null, createElement: (balise) => ({ balise, style: {}, classList: { add: noop, remove: noop }, setAttribute: noop }),
    // la feuille de style de la page passe aussi par <head> : on ne garde que les scripts
    head: { appendChild: (el) => { if (el.balise === 'script') ajoutes.push(el); } }, body: { classList: { add: noop, remove: noop }, appendChild: noop },
    addEventListener: noop, querySelector: () => null, querySelectorAll: () => (o.listes || [])
  };
  sb.addEventListener = noop; sb.location = { hash: '#todo' };
  vm.createContext(sb);
  vm.runInContext(`window.V2 = { route:{ name:'todo' }, esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    topbar: () => '', go(){}, toast(){}, pharmacies: [], user: null,
    render(){ window.V2.pages.todo.render(window.__racine); } };
    window.ICO = () => '';`, sb);
  sb.__racine = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector(q) { return q === '.tb-liste' && this.html.includes('tb-liste') ? {} : null; } };
  vm.runInContext(SRC, sb);
  return sb;
}
const attendre = () => new Promise((r) => setTimeout(r, 0));
async function dessiner(sb) {
  sb.V2.pages.todo.render(sb.__racine);
  for (let i = 0; i < 6; i++) await attendre();
  const h = sb.__racine.html;
  assert.match(h, /<h1 class="td-h1">To do list<\/h1>/, 'la page est bien la To do (marqueur positif)');
  assert.doesNotMatch(h, /Chargement…/, 'le chargement est fini');
  return h;
}
const colonne = (h, c) => { const m = new RegExp('<div class="tb-liste" data-col="' + c + '">([\\s\\S]*?)</div></section>').exec(h); assert.ok(m, 'colonne ' + c + ' présente'); return m[1]; };
const ids = (h) => [...h.matchAll(/<article class="v2-todo-it[^"]*" data-id="([^"]+)"/g)].map((m) => m[1]);
const stock = (sb) => JSON.parse(sb.__LS.get(CLE));

test('trois colonnes, chaque tâche dans la colonne de sa date, retards dans « Aujourd\'hui », note entière', async () => {
  const h = await dessiner(monter(JEU()));
  assert.match(h, /<h2 id="tb-h-auj">Aujourd’hui<\/h2>/);
  assert.match(h, /<h2 id="tb-h-sem">Cette semaine<\/h2>/);
  assert.match(h, /<h2 id="tb-h-tard">Plus tard<\/h2>/);
  assert.equal([...h.matchAll(/class="tb-liste" data-col="/g)].length, 3, 'trois colonnes, pas une de plus');
  assert.deepEqual(ids(colonne(h, 'auj')), ['retard', 'auj'], 'le retard est DANS la colonne du jour (plus de bloc « En retard » à part)');
  assert.deepEqual(ids(colonne(h, 'sem')), ['demain', 'rdv1']);
  assert.deepEqual(ids(colonne(h, 'tard')), ['lointaine', 'sansdate'], 'plus de 7 jours ou sans date : « Plus tard »');
  assert.ok(h.includes(NOTE_LONGUE.replace(/’/g, '’')), 'la note est affichée en entier, sans coupure');
  assert.doesNotMatch(h, /…<\/p>|line-clamp/, 'aucune note coupée par des points de suspension');
  // v3 : tuiles de chiffres et bouton « Afficher » retirés (le total est dans l'onglet)
  assert.doesNotMatch(h, /Afficher|v2-todo-stat|tb-tuile/, 'ni tuiles ni « Afficher »');
  assert.equal([...h.matchAll(/aria-label="Déplacer cette tâche"/g)].length, 6, 'chaque carte a son bouton « Déplacer » (le clavier et le doigt n\'ont pas besoin du glisser)');
});

test('« Déplacer » : la date change, rien d\'autre — même format, même clé de stockage', async () => {
  for (const [col, jours] of [['sem', 1], ['tard', 14], ['auj', 0]]) {
    const sb = monter(JEU());
    await dessiner(sb);
    const avant = stock(sb), id = col === 'auj' ? 'demain' : 'auj';
    sb.V2.todo.deplacer(id, col);
    for (let i = 0; i < 6; i++) await attendre();
    const apres = stock(sb);
    assert.equal(apres.find((t) => t.id === id).pour, iso(jours), col + ' : la date vaut aujourd\'hui + ' + jours + ' j, au format AAAA-MM-JJ');
    assert.match(apres.find((t) => t.id === id).pour, /^\d{4}-\d{2}-\d{2}$/);
    const sans = (l) => l.map((t) => ({ ...t, pour: t.id === id ? '' : t.pour }));
    assert.deepEqual(sans(apres), sans(avant), 'aucune autre tâche, aucun autre champ ne bouge (note, type, officine, cases)');
    assert.deepEqual(Object.keys(apres[0]).sort(), Object.keys(avant[0]).sort(), 'même forme de tâche');
    assert.ok(sb.__LS.has(CLE) && sb.__LS.size === 1, 'toujours la seule clé jarvis_todo_v1:local');
  }
  const sb = monter(JEU()); await dessiner(sb);
  sb.V2.todo.deplacer('auj', 'nimporte-quoi'); for (let i = 0; i < 4; i++) await attendre();
  assert.equal(stock(sb).find((t) => t.id === 'auj').pour, iso(0), 'une colonne inconnue ne change rien');
});

test('glisser (Sortable présent) : déposer dans une AUTRE colonne change la date seule ; reposer dans la même ne change rien', async () => {
  const cols = ['auj', 'sem', 'tard'].map((c) => ({ c, getAttribute: (a) => (a === 'data-col' ? c : null) }));
  const sb = monter(JEU(), { listes: cols });
  const creees = [];
  sb.Sortable = { create: (el, opt) => { creees.push({ el, opt }); return { destroy() {} }; } };
  await dessiner(sb);                                      // le dessin appelle initTri → window.Sortable déjà là : appel immédiat
  assert.equal(creees.length, 3, 'une zone de dépôt par colonne');
  creees.forEach(({ opt }) => { assert.equal(opt.group, 'tb-todo', 'même groupe : on peut passer de l\'une à l\'autre'); assert.equal(typeof opt.onEnd, 'function'); });
  const avant = stock(sb), sansDate = (l) => l.map((t) => ({ ...t, pour: '' }));
  // « rdv1 » est dans « Cette semaine » (dans 4 jours) : la reposer dans la même colonne ne doit PAS la ramener à demain
  const rdv = { getAttribute: (a) => (a === 'data-id' ? 'rdv1' : null) }, item = { getAttribute: (a) => (a === 'data-id' ? 'auj' : null) };
  creees[1].opt.onEnd({ from: cols[1], to: cols[1], item: rdv });      // reposée où elle était
  for (let i = 0; i < 4; i++) await attendre();
  assert.deepEqual(stock(sb), avant, 'même colonne : rien ne change');
  creees[1].opt.onEnd({ from: cols[0], to: cols[2], item });           // glissée de « Aujourd'hui » vers « Plus tard »
  for (let i = 0; i < 6; i++) await attendre();
  const apres = stock(sb);
  assert.equal(apres.find((t) => t.id === 'auj').pour, iso(14), 'glissée vers « Plus tard » = dans 14 jours');
  assert.deepEqual(sansDate(apres), sansDate(avant), 'seule la date a changé');
});

test('Sortable ABSENT (la brique ne charge pas) : l\'écran se dessine et « Déplacer » change quand même la date', async () => {
  const sb = monter(JEU());
  assert.equal(sb.Sortable, undefined, 'départ : pas de window.Sortable');
  const h = await dessiner(sb);                           // pas d'exception, les trois colonnes sont là
  assert.equal([...h.matchAll(/class="tb-liste" data-col="/g)].length, 3);
  assert.equal(sb.__scripts.length, 1, 'un seul <script> de brique demandé (pas un par dessin)');
  await dessiner(sb);
  assert.equal(sb.__scripts.length, 1, 'un second dessin n\'en redemande pas pendant le chargement');
  sb.__scripts[0].onerror();                              // le réseau a refusé le fichier
  const h2 = await dessiner(sb);
  assert.equal([...h2.matchAll(/aria-label="Déplacer cette tâche"/g)].length, 6, 'les boutons « Déplacer » sont toujours là');
  assert.match(h2, /class="tb-dep-b"[^>]*onclick="V2\.todo\.deplacer\('retard','sem'\)"/, 'le menu propose les colonnes');
  sb.V2.todo.deplacer('retard', 'sem');
  for (let i = 0; i < 6; i++) await attendre();
  assert.equal(stock(sb).find((t) => t.id === 'retard').pour, iso(1), 'sans Sortable, « Déplacer » met la tâche à demain');
  assert.ok(ids(colonne(sb.__racine.html, 'sem')).includes('retard'), 'et elle apparaît dans « Cette semaine »');
});

test('la brique est chargée à la demande : chemin vendor/sortablejs/, jeton ?v= du script de la To do, fichier MIT présent', async () => {
  const sb = monter(JEU());
  assert.equal(sb.__scripts.length, 0, 'rien n\'est chargé avant la première arrivée sur la To do');
  await dessiner(sb);
  assert.equal(sb.__scripts.length, 1);
  assert.equal(sb.__scripts[0].src, 'vendor/sortablejs/Sortable-1.15.6.min.js?v=jeton123', 'même jeton que v2-todo.js : une mise en ligne ne laisse pas l\'ancienne brique en cache');
  const sb2 = monter(JEU(), { jeton: '' }); await dessiner(sb2);
  assert.equal(sb2.__scripts[0].src, 'vendor/sortablejs/Sortable-1.15.6.min.js', 'sans jeton, pas de « ? » orphelin');
  const f = join(DIR, 'vendor', 'sortablejs', 'Sortable-1.15.6.min.js');
  assert.ok(existsSync(f), 'le fichier de la brique est dans le dépôt');
  assert.match(readFileSync(f, 'utf8').slice(0, 120), /^\/\*! Sortable 1\.15\.6 - MIT/, 'en-tête de licence MIT gardé');
});
