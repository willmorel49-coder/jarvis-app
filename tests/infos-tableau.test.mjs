/* infos-tableau.test.mjs — lot 5 V3 « Le tableau » (22/11/2026) : Infos du matin en DEUX colonnes
 *
 * Choix de Will (22/11/2026, 16 h 10) : Infos = « Le tableau ». Ce test garde, sur le VRAI v2-infos.js (bac à sable, données fabriquées) :
 *  1. deux colonnes côte à côte « Dans votre secteur » | « En France » (.inf-t-cols), plus de feuille unique, bandeau commun au-dessus ;
 *  2. un compte SANS secteur n'a plus de bloc vide : une seule colonne (« En France ») et la classe is-seul ;
 *  3. « Ventes et rachats en France » seulement pour la direction qui a un secteur (S.deps && S.dir), jamais pour un commercial ;
 *  4. le bouton de chaque tâche dit « Marquer comme fait » (libellé, plus une simple case), « Remettre à faire » une fois cochée ;
 *  5. la phrase sous le titre donne toujours l'heure de l'ÉDITION, et rien n'est inventé sans annonce.
 * Lancer : node --test tests/infos-tableau.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../crm/v2/v2-infos.js', import.meta.url), 'utf8');
const REGLES = readFileSync(new URL('../crm/v2/v2-infos-taches.js', import.meta.url), 'utf8');
const iso = (decalage) => { const d = new Date(Date.now() + decalage * 864e5); return d.toISOString().slice(0, 10); };
const AUJ = iso(0), HIER = iso(-1);

function fixtures(o = {}) {
  const ev = (id, nom, ville, jours, f, cp = '49000', dep = '49') => ({ id, nom, ville, cp, dep, d: iso(-jours), f, detail: '', url: 'https://www.bodacc.fr/' + id, depNom: 'Maine-et-Loire' });
  const jour = o.jour || AUJ;
  return {
    'brief-jour.json': {
      jour, genere: (o.genere || jour) + 'T07:12:00+00:00',
      une: { t: 'Le sujet du jour', r: 'Résumé de la une', theme: 'marge', theme_l: 'Marges', d: AUJ, srcs: ['Source A'] },
      cinq: [1, 2, 3, 4, 5].map((n) => ({ t: 'Sujet numéro ' + n + ' de l’essentiel', r: 'Résumé ' + n, d: HIER, srcs: ['Presse ' + n] })),
      epingles: [
        { t: 'Arrêté du 5 novembre relatif aux officines de pharmacie', s: 'Journal officiel', srcs: ['Journal officiel'], motif: 'signal', d: HIER },
        { t: 'Arrêté modifiant la marge de distribution en gros', s: 'Journal officiel', r: 'La marge des grossistes-répartiteurs passe à 6,93 % minimum', effet: iso(30), motif: 'echeance', theme: 'marge', d: HIER, u: 'https://www.legifrance.gouv.fr/jorf/id/X' },
        { t: 'Autre échéance du mois', effet: iso(20), motif: 'echeance', theme: 'marge', d: HIER }
      ],
      ruptures_neuves: [{ spec: 'Amoxicilline Biogaran 500 mg, gélule', dci: 'amoxicilline', st: 'Rupture de stock', since: HIER, subst: 0 }],
      rappels_lots: [{ t: 'Rappel du lot X1234 de Exemplol', lab: 'Labo', d: HIER, motif: 'Défaut', niv: 'Pharmacies d’officine', lots: [{ n: 'X1234' }], url: 'https://ansm.sante.fr/x' }],
      rappels_para: [],
      fil: [1, 2, 3].map((n) => ({ t: 'Article du fil ' + n, d: HIER, theme: 'officine', neuf: n === 1, srcs: ['Presse'] })),
      radar: [{ k: 'ruptures', v: 292, l: 'ruptures', src: 'ANSM' }, { k: 'demande', v: 4, l: 'hausse', src: 'X' }],
      compte: { sources_lues: ['a.json', 'b.json', 'c.json'] }
    },
    'brief-archive.json': { jours: [{ jour: HIER, titre: 'Hier' }, { jour: iso(-2), titre: 'Avant-hier' }] },
    'bodacc-secteur.json': { maj: HIER, ev: [
      ev('b1', 'SELARL PHARMACIE DU MAIL', 'ANGERS', 1, 'cession'),
      ev('b2', 'PHARMACIE DE LA GARE', 'SAUMUR', 2, 'fermeture', '49400'),
      ev('b3', 'SELARL PHARMACIE DES HALLES', 'CHOLET', 3, 'dirigeant', '49300'),
      ev('b4', 'PHARMACIE DU PORT', 'ANGERS', 4, 'creation'),
      ev('b5', 'PHARMACIE DE LA POSTE', 'ANGERS', 6, 'procedure'),
      ev('b6', 'PHARMACIE TROP ANCIENNE', 'ANGERS', 40, 'cession'),            // plus de 14 jours : jamais une tâche, comptée dans les 3 mois
      ev('b7', 'PHARMACIE DE LILLE', 'LILLE', 2, 'cession', '59000', '59')      // hors secteur
    ] },
    'departements-contours.json': null
  };
}

function monter(fx, o = {}) {
  const sb = { console, setTimeout, clearTimeout, URL, Date, Promise, JSON, Math };
  const noop = () => {};
  sb.window = sb; sb.globalThis = sb;
  sb.document = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, appendChild: noop, setAttribute: noop }), head: { appendChild: noop }, body: { appendChild: noop, contains: () => false }, addEventListener: noop, documentElement: { classList: { add: noop, remove: noop } }, querySelector: () => null, querySelectorAll: () => [] };
  sb.addEventListener = noop;
  const LS = new Map(Object.entries(o.stock || {}));
  sb.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k) };
  sb.__LS = LS;
  sb.navigator = {};
  sb.location = { hash: '#infos' };
  sb.fetch = (url) => {
    const nom = String(url).split('?')[0];
    const rep = fx[nom];
    return Promise.resolve(rep == null ? { ok: false } : { ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(rep))) });
  };
  sb.__pharmacies = o.sansSecteur ? [] : [1,2,3,4].map((i) => ({ cp: '4900' + i, comms: ['C1'], nom: 'Pharmacie ' + i }));
  vm.createContext(sb);
  vm.runInContext(`window.V2 = { pages:{}, route:{ name:'infos' },
    esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    topbar: () => '', go(){}, toast(){}, user: { voitTousReel: false },
    mesComms: () => ['C1'],
    pharmacies: window.__pharmacies,
    render(){ window.V2.pages.infos.render(window.__racine); } };
    window.ICO = () => '';`, sb);
  if (o.sb) sb.V2.sb = o.sb;
  vm.runInContext(REGLES, sb);
  vm.runInContext(SRC, sb);
  sb.__racine = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector: () => null, contains: () => false };
  return sb;
}

const attendre = () => new Promise((r) => setTimeout(r, 0));
async function rendreSb(sb) {
  sb.V2.pages.infos.render(sb.__racine);
  for (let i = 0; i < 8; i++) await attendre();
  const html = sb.__racine.html;
  assert.match(html, /<div class="w-page inf-t">/, 'la page est bien Infos du matin (marqueur positif)');
  assert.match(html, /<h1 id="inf-t-titre" class="v2-page-title">Infos du matin<\/h1>/);
  assert.doesNotMatch(html, /Composition de l'édition|n'a pas pu s'afficher|Pas encore d'édition/, 'ni attente ni page d\'erreur');
  return html;
}
const texte = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const colonnes = (html) => html.split('<div class="inf-t-col">').slice(1);
const ev = (id, nom, ville, jours, f, dep) => ({ id, nom, ville, cp: dep + '000', dep, d: iso(-jours), f, detail: '', url: 'https://www.bodacc.fr/' + id, depNom: '' });

test('deux colonnes côte à côte : « Dans votre secteur » puis « En France », bandeau commun au-dessus, plus de feuille unique', async () => {
  const html = await rendreSb(monter(fixtures()));
  assert.match(html, /<\/header><div class="inf-t-cols" role="group" aria-labelledby="inf-t-titre">/, 'les colonnes viennent juste après le bandeau, sans is-seul');
  const C = colonnes(html);
  assert.equal(C.length, 2, 'exactement deux colonnes');
  assert.match(C[0], /<h2 id="inf-t-h-secteur">Dans votre secteur<\/h2>/);
  assert.match(C[1], /<h2 id="inf-t-h-france">En France<\/h2>/);
  assert.ok(!/inf-t-h-france/.test(C[0]) && !/inf-t-h-secteur/.test(C[1]), 'chaque titre dans SA colonne');
  assert.match(C[0], /inf-t-h-ann/, 'les annonces du secteur sont sous les tâches, dans la colonne du secteur');
  assert.doesNotMatch(html, /inf-t-feuille/, 'plus de feuille unique');
});

test('un compte SANS secteur : pas de bloc secteur vide, une seule colonne « En France »', async () => {
  const html = await rendreSb(monter(fixtures(), { sansSecteur: true }));
  assert.match(html, /<div class="inf-t-cols is-seul" role="group"/, 'la colonne seule prend toute la place (is-seul)');
  const C = colonnes(html);
  assert.equal(C.length, 1, 'une seule colonne');
  assert.doesNotMatch(html, /inf-t-h-secteur|inf-t-g-secteur|Dans votre secteur|Votre secteur n’est pas encore connu|inf-t-h-ann"/, 'ni titre, ni liste, ni message « secteur inconnu », ni annonces de secteur');
  assert.match(C[0], /<h2 id="inf-t-h-france">En France<\/h2>/);
  assert.doesNotMatch(html, /inf-t-h-annfr/, 'et pas de « Ventes et rachats en France » pour un commercial');
});

test('« Ventes et rachats en France » : la direction AVEC secteur seulement (S.deps && S.dir)', async () => {
  const fx = () => { const f = fixtures(); f['bodacc-secteur.json'].ev.push(ev('f1', 'PHARMACIE UN', 'LYON', 3, 'cession', '69')); return f; };
  // commercial avec secteur : non
  const com = await rendreSb(monter(fx()));
  assert.doesNotMatch(com, /Ventes et rachats en France|inf-t-h-annfr/, 'un commercial : jamais');
  assert.doesNotMatch(texte(com), /Pharmacie Un|Lyon/, 'et aucune annonce hors de son secteur');
  // direction avec secteur : oui, dans la colonne France
  const sb = monter(fx()); sb.V2.user.voitTousReel = true;
  const dir = await rendreSb(sb);
  const C = colonnes(dir);
  assert.match(C[1], /<h2 id="inf-t-h-annfr">Ventes et rachats en France/, 'direction : la liste est dans la colonne « En France »');
  assert.match(texte(C[1]), /Pharmacie Un/);
  assert.ok(!/inf-t-h-annfr/.test(C[0]), 'pas dans la colonne du secteur');
  // direction SANS secteur (vue toute la France) : pas de doublon, la liste France n'existe pas
  const sb2 = monter(fx(), { sansSecteur: true }); sb2.V2.user.voitTousReel = true;
  const dir2 = await rendreSb(sb2);
  assert.doesNotMatch(dir2, /inf-t-h-annfr/, 'sans secteur, « Ventes et rachats en France » ferait doublon avec « Annonces des officines, toute la France »');
  assert.match(dir2, /<h2 id="inf-t-h-secteur">Les officines, toute la France<\/h2>/);
});

test('chaque tâche se coche par sa seule case ronde (« Marquer comme fait » en double retiré le 26/11/2026, accord de Will)', async () => {
  const html = await rendreSb(monter(fixtures()));
  const L = html.split('<li class="inf-t-tache').slice(1);
  assert.ok(L.length >= 3, 'des tâches sont dessinées (marqueur positif)');
  L.forEach((l) => {
    assert.doesNotMatch(l, /class="inf-t-fait-l"|<span>Marquer comme fait<\/span>/, 'plus de bouton en double de la case');
    assert.match(l, /<button class="inf-t-case" type="button" role="checkbox" aria-checked="false" aria-label="Marquer comme fait : /, 'la case garde son nom accessible');
  });
  const fait = { v: 1, g: {}, m: {}, f: { 'b-b2': { le: 100, off: 0 } } };
  const sb = monter(fixtures(), { stock: { 'jarvis_infos_choix_v1:local': JSON.stringify(fait) } });
  const h2 = await rendreSb(sb);
  const rangee = /<ul class="inf-t-liste" id="inf-t-fait-l" hidden>([\s\S]*?)<\/ul><\/section>/.exec(h2)[1];
  assert.match(rangee, /<button class="inf-t-case" type="button" role="checkbox" aria-checked="true"/, 'cochée : la case est cochée, rangée dans Fait');
});

test('la phrase sous le titre dit l\'heure de l\'ÉDITION ; sans annonce récente, rien n\'est inventé', async () => {
  const html = await rendreSb(monter(fixtures({ genere: iso(0) })));
  const sous = texte(/<p class="inf-t-sous[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html)[1]);
  assert.match(sous, /mis à jour aujourd’hui à (8|9) h 12/, 'l\'heure de l\'ÉDITION (07 h 12 UTC dans les données = 8 h 12 à Paris l\'hiver, 9 h 12 l\'été), pas l\'horloge');
  const f = fixtures(); f['bodacc-secteur.json'].ev = [];
  const vide = await rendreSb(monter(f));
  assert.match(texte(vide), /Rien de neuf ces 14 derniers jours dans votre secteur/, 'le secteur dit qu\'il n\'y a rien');
  assert.doesNotMatch(vide, /inf-t-h-ann"/, 'aucune section d\'annonces inventée');
});
