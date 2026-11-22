/* todo-hors-base.test.mjs — To do connectée mais base muette (22/11/2026)
 *
 * Constat du 22/11/2026 : l'essai au doigt de Will sur son iPhone n'est jamais arrivé en base (ligne `profils` inchangée
 * depuis la veille). Dans le code : connecté mais liste non lue (session expirée, base muette), la To do passait en mode
 * « appareil seul » pour toute la vie de la page, écrivait le déplacement sur l'appareil, et affichait « Déplacée : … »
 * comme un succès ; le prochain chargement réussi effaçait le changement. Choix cliqué de Will : « Corriger puis refaire ».
 * Ce test garde :
 *  1. connecté + base muette → l'en-tête dit « Pas enregistré » en clair, avec « Réessayer » et « Se reconnecter » ;
 *  2. connecté + base muette → déplacer ne dit PAS « Déplacée » : l'avertissement « Gardé sur cet appareil seulement » reste ;
 *  3. la base revient → le geste suivant est ENREGISTRÉ en base (upsert avec la nouvelle date) et l'alerte part ;
 *  4. « Réessayer » relit la base : si elle répond, l'alerte part ;
 *  5. sans réseau → pas de « Se reconnecter » (on ne pourrait pas se reconnecter) ;
 *  6. sans compte (banc local) → inchangé : la pastille « Gardée sur cet appareil seulement. » et « Déplacée ».
 * Le vrai fichier v2-todo.js tourne dans un bac à sable `vm`, avec un faux client Supabase.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const SRC = readFileSync(join(DIR, 'v2-todo.js'), 'utf8');

const iso = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
const tache = (id, pour) => ({ id, k: 'libre', pid: '', nom: 'Pharmacie ' + id, mail: '', note: 'Note ' + id, pour, fait: false, faitLe: '', cree: '2026-11-01T08:00:00.000Z', rep: '', ancre: '', prec: '', dernier: '' });
const JEU = () => [tache('retard', iso(-3)), tache('sansdate', '')];

// Faux client : `base.muette` = la base refuse tout (comme une session expirée : « permission denied »)
function client(base) {
  const rep = () => Promise.resolve(base.muette ? { data: null, error: { message: 'permission denied for table profils' } }
    : { data: base.items ? { data: { items: JSON.parse(JSON.stringify(base.items)) } } : null, error: null });
  const ch = { select: () => ch, eq: () => ch, maybeSingle: rep, single: rep };
  return { from: () => ({
    select: () => ch,
    upsert: (row) => { if (base.muette) return Promise.resolve({ error: { message: 'permission denied for table profils' } }); base.ecrits.push(row); if (row.data && row.data.items) base.items = row.data.items; return Promise.resolve({ error: null }); }
  }) };
}

function monter(o) {
  const sb = { console, setTimeout, clearTimeout, Date, Promise, JSON, Math };
  const noop = () => {};
  sb.window = sb; sb.globalThis = sb;
  const cle = 'jarvis_todo_v1:' + (o.compte ? 'u1' : 'local');
  const LS = new Map([[cle, JSON.stringify(JEU())]]);
  sb.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k) };
  sb.__LS = LS; sb.__cle = cle; sb.__toasts = []; sb.__base = o.base || null;
  sb.document = {
    currentScript: { src: 'v2/v2-todo.js?v=jeton123' },
    getElementById: () => null, createElement: (balise) => ({ balise, style: {}, classList: { add: noop, remove: noop }, setAttribute: noop }),
    head: { appendChild: noop }, body: { classList: { add: noop, remove: noop }, appendChild: noop },
    addEventListener: noop, querySelector: () => null, querySelectorAll: () => []
  };
  sb.addEventListener = noop; sb.location = { hash: '#todo' };
  vm.createContext(sb);
  vm.runInContext(`window.V2 = { route:{ name:'todo' }, esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    topbar: () => '', go(){}, toast(m, v){ window.__toasts.push((v || 'ok') + ' ' + m); }, pharmacies: [], user: null,
    render(){ window.V2.pages.todo.render(window.__racine); } };
    window.ICO = () => '';`, sb);
  if (o.compte) { sb.V2.user = { id: 'u1', name: 'Essai' }; sb.V2.sb = () => client(o.base); }
  if (o.sansReseau) sb.V2.hl = { sansReseau: () => true };
  sb.__racine = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector: () => null };
  vm.runInContext(SRC, sb);
  return sb;
}
const attendre = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
async function dessiner(sb) {
  sb.V2.pages.todo.render(sb.__racine);
  await attendre();
  const h = sb.__racine.html;
  assert.match(h, /<h1 class="td-h1">To do list<\/h1>/, 'la page est bien la To do (marqueur positif)');
  assert.doesNotMatch(h, /Chargement…/, 'le chargement est fini');
  return h;
}
const pourDe = (items, id) => items.find((x) => x.id === id).pour;

test('connecté + base muette : l\'en-tête dit « Pas enregistré », avec « Réessayer » et « Se reconnecter »', async () => {
  const h = await dessiner(monter({ compte: true, base: { muette: true, items: JEU(), ecrits: [] } }));
  assert.match(h, /<b class="td-local">Pas enregistré<\/b>[^<]*sera effacé au prochain chargement/);
  assert.match(h, /onclick="V2\.todo\.reessayer\(\)">Réessayer<\/button>/);
  assert.match(h, /onclick="V2\.signOut\(\)">Se reconnecter<\/button>/);
  assert.doesNotMatch(h, /Gardée sur cet appareil seulement\./, 'plus la pastille seule, qui ne disait pas quoi faire');
});

test('connecté + base muette : déplacer ne dit pas « Déplacée », l\'avertissement reste ; la date change sur l\'appareil', async () => {
  const base = { muette: true, items: JEU(), ecrits: [] };
  const sb = monter({ compte: true, base });
  await dessiner(sb);
  sb.__toasts.length = 0;
  sb.V2.todo.deplacer('retard', 'sem');
  await attendre();
  assert.ok(sb.__toasts.some((t) => /^warn Gardé sur cet appareil seulement/.test(t)), 'avertissement montré : ' + sb.__toasts.join(' | '));
  assert.ok(!sb.__toasts.some((t) => /Déplacée/.test(t)), 'aucun « Déplacée » qui ferait croire à un succès : ' + sb.__toasts.join(' | '));
  assert.equal(base.ecrits.length, 0);
  assert.equal(pourDe(JSON.parse(sb.__LS.get(sb.__cle)), 'retard'), iso(1), 'gardé sur l\'appareil, comme le dit l\'avertissement');
});

test('la base revient : le geste suivant est ENREGISTRÉ en base et l\'alerte part', async () => {
  const base = { muette: true, items: JEU(), ecrits: [] };
  const sb = monter({ compte: true, base });
  await dessiner(sb);
  base.muette = false;                                // session revenue (reconnexion dans un autre onglet, réseau revenu)
  sb.__toasts.length = 0;
  sb.V2.todo.deplacer('retard', 'sem');
  await attendre();
  assert.equal(base.ecrits.length, 1, 'une écriture en base');
  assert.equal(base.ecrits[0].scope_id, '__todo_u1__');
  assert.equal(pourDe(base.ecrits[0].data.items, 'retard'), iso(1), 'la nouvelle date est en base');
  assert.ok(base.ecrits[0].updated_at, 'la ligne porte son heure de mise à jour');
  assert.ok(sb.__toasts.some((t) => /^ok Déplacée/.test(t)), 'succès dit seulement quand c\'est enregistré');
  const h = await dessiner(sb);
  assert.doesNotMatch(h, /Pas enregistré/);
});

test('« Réessayer » relit la base : si elle répond, l\'alerte part', async () => {
  const base = { muette: true, items: JEU(), ecrits: [] };
  const sb = monter({ compte: true, base });
  assert.match(await dessiner(sb), /Pas enregistré/);
  base.muette = false;
  sb.V2.todo.reessayer();
  await attendre();
  assert.doesNotMatch(sb.__racine.html, /Pas enregistré/);
  assert.match(sb.__racine.html, /<h1 class="td-h1">To do list<\/h1>/);
});

test('sans réseau : l\'alerte reste, sans « Se reconnecter »', async () => {
  const h = await dessiner(monter({ compte: true, sansReseau: true, base: { muette: true, items: JEU(), ecrits: [] } }));
  assert.match(h, /Pas enregistré/);
  assert.match(h, />Réessayer<\/button>/);
  assert.doesNotMatch(h, /V2\.signOut\(\)/);
});

test('sans compte (banc local) : inchangé — pastille « Gardée sur cet appareil seulement. » et « Déplacée »', async () => {
  const sb = monter({ compte: false });
  const h = await dessiner(sb);
  assert.match(h, /<b class="td-local">Gardée sur cet appareil seulement\.<\/b>/);
  assert.doesNotMatch(h, /Pas enregistré/);
  sb.__toasts.length = 0;
  sb.V2.todo.deplacer('retard', 'sem');
  await attendre();
  assert.ok(sb.__toasts.some((t) => /^ok Déplacée/.test(t)), sb.__toasts.join(' | '));
  assert.equal(pourDe(JSON.parse(sb.__LS.get(sb.__cle)), 'retard'), iso(1));
});
