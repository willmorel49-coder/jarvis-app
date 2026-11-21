/* Haut de l'écran « Infos du jour » en liste « À faire avec les infos » (21/11/2026, maquette C choisie par Will,
   comme la vue « Aujourd'hui » de Things 3). Remplace le test des « trois portes » du 09/11/2026.
   Données FABRIQUÉES, réponses connues d'avance, pas de navigateur : on fait tourner le VRAI v2-infos-taches.js
   puis le VRAI v2-infos.js dans un bac à sable et on lit le HTML que page.render() écrit.
   Ce que ce test garantit :
     - plus de bandeau bleu, plus de trois portes, plus de fil Discover ni de Gardées (choix de Will du 21/11) ;
     - « Dans votre secteur » : 3 tâches au plus, annonces Bodacc de moins de 14 jours du secteur, textes écrits par les règles ;
     - « En France » : 3 tâches au plus, une par type, dans l'ordre arrêté (rappel de lot, règle, médicament qui manque) ;
     - chaque ligne a « À dire en rendez-vous », « Mettre dans ma To do » et « Voir tout » vers SON panneau ;
     - la phrase sous le titre compte exactement les tâches qui restent, et dit l'heure de l'édition, jamais l'horloge ;
     - « Tout le reste » : 4 lignes vers les panneaux existants, avec les nombres des données ;
     - « Fait » (zone f des choix x15) : une tâche cochée se range dans « Fait · n », une décochée (off) revient ;
       la fusion avec la ligne `profils` garde le geste le plus récent, clé par clé, sans toucher aux zones g et m.
   Lancer : node --test tests/infos-haut.test.mjs */
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
  vm.createContext(sb);
  vm.runInContext(`window.V2 = { pages:{}, route:{ name:'infos' },
    esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    topbar: () => '', go(){}, toast(){}, user: { voitTousReel: false },
    mesComms: () => ['C1'],
    pharmacies: [1,2,3,4].map(i => ({ cp: '4900' + i, comms: ['C1'], nom: 'Pharmacie ' + i })),
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
  sb.V2.pages.infos.render(sb.__racine);   // 1er passage : « Composition de l'édition… », puis load() redessine
  for (let i = 0; i < 8; i++) await attendre();
  const html = sb.__racine.html;
  assert.match(html, /<div class="w-page inf-t">/, 'la page est bien la liste C (marqueur positif)');
  assert.match(html, /<h1 id="inf-t-titre">Aujourd’hui<\/h1>/, 'le titre de la maquette');
  assert.doesNotMatch(html, /Composition de l'édition|n'a pas pu s'afficher|Pas encore d'édition/, 'ni attente ni page d\'erreur');
  return html;
}
const rendre = (fx = fixtures(), o) => rendreSb(monter(fx, o));
const texte = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const groupe = (html, g) => { const m = new RegExp('<ul class="inf-t-liste" id="inf-t-g-' + g + '">([\\s\\S]*?)</ul><p class="inf-t-vide"').exec(html); assert.ok(m, 'groupe ' + g + ' présent'); return m[1]; };
const taches = (h) => h.split('<li class="inf-t-tache').slice(1);
const action = (l) => texte(/<span class="inf-t-action">([\s\S]*?)<\/span><span class="inf-t-meta">/.exec(l)[1]);
const sous = (html) => texte(/<p class="inf-t-sous"[^>]*>([\s\S]*?)<\/p>/.exec(html)[1]);
const faitListe = (html) => /<ul class="inf-t-liste" id="inf-t-fait-l" hidden>([\s\S]*?)<\/ul><\/section>/.exec(html)[1];
const CLE = 'jarvis_infos_choix_v1:local';

test('la liste C remplace le bandeau, les trois portes, le fil et les Gardées', async () => {
  const html = await rendre();
  assert.match(html, /<h2 id="inf-t-h-secteur">Dans votre secteur<\/h2>/);
  assert.match(html, /<h2 id="inf-t-h-france">En France<\/h2>/);
  assert.doesNotMatch(html, /inf-c-porte|inf-hd|f3-fil|data-f3=|Gardées|Le fil du jour/, 'aucune trace des portes, du bandeau, du fil ni des Gardées');
  assert.doesNotMatch(html, /Copier le brief|infosCopyBrief/, '« Copier le brief » n\'est plus sur la page (choix assumé, dit à Will)');
});

test('« Dans votre secteur » : 3 tâches au plus, moins de 14 jours, textes des règles et phrase « À dire » du vrai code', async () => {
  const html = await rendre();
  const L = taches(groupe(html, 'secteur'));
  assert.equal(L.length, 3, 'trois tâches au plus');
  assert.deepEqual(L.map(action), [
    'Prendre rendez-vous avec la Pharmacie du Mail',
    'Appeler les officines voisines de la Pharmacie de la Gare',
    'Se présenter au nouveau dirigeant de la Pharmacie des Halles'
  ]);
  const t = texte(groupe(html, 'secteur'));
  assert.doesNotMatch(t, /Trop Ancienne|Lille|Arrêté du 5 novembre/, 'ni plus de 14 jours, ni hors secteur, ni arrêté du JO');
  assert.match(t, /Nouveau titulaire : prendre rendez-vous dans le mois/, '« À dire » = sctGeste, la phrase du vrai code');
  L.forEach((l) => {
    assert.match(l, /<h3>À dire en rendez-vous<\/h3>/);
    assert.match(l, /<button class="inf-t-todo" type="button" aria-pressed="false">/);
    assert.match(l, /data-it-vue="secteur"/, '« Voir tout » ouvre le panneau du secteur');
  });
});

test('« En France » : 3 tâches au plus, une par type, dans l\'ordre arrêté, chacune vers SON panneau', async () => {
  const html = await rendre();
  const L = taches(groupe(html, 'france'));
  assert.equal(L.length, 3);
  assert.deepEqual(L.map(action), [
    'Prévenir vos officines de vérifier le lot X1234',
    'Relire le nouveau barème avant les rendez-vous de ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][+iso(30).slice(5, 7) - 1],
    'Aider vos officines à sécuriser leur stock de Amoxicilline'
  ]);
  assert.deepEqual(L.map((l) => /data-it-vue="([a-z]+)"/.exec(l)[1]), ['rappels', 'echeances', 'ruptures']);
  assert.doesNotMatch(texte(groupe(html, 'france')), /Pharmacie du Mail/, 'jamais une annonce d\'officine en France');
});

test('la phrase sous le titre compte les tâches qui restent et dit l\'heure de l\'ÉDITION', async () => {
  const s = sous(await rendre());
  assert.match(s, /^6 choses à faire après les infos du matin · mis à jour aujourd’hui à \d{1,2} h \d{2}$/);
  const veille = sous(await rendre(fixtures({ jour: HIER, genere: HIER })));
  assert.match(veille, /· mis à jour hier à \d{1,2} h \d{2}$/);
});

test('« Tout le reste » : UN lien, 4 lignes vers les panneaux existants, avec les nombres des données', async () => {
  const html = await rendre();
  assert.equal((html.match(/id="inf-t-reste-b"/g) || []).length, 1, 'un seul lien');
  const R = /<ul class="inf-t-rls" id="inf-t-reste-l" hidden>([\s\S]*?)<\/ul>/.exec(html)[1];
  const lignes = R.split('<li>').slice(1).map((l) => ({ v: /data-it-vue="([a-z]+)"/.exec(l)[1], t: texte(l) }));
  assert.deepEqual(lignes.map((l) => l.v), ['ruptures', 'rappels', 'secteur', 'mur']);
  assert.equal(lignes[0].t, 'Médicaments qui manquent 1 nouveau depuis hier 292');
  assert.equal(lignes[1].t, 'Produits rappelés médicaments et parapharmacie 1');
  assert.equal(lignes[2].t, 'Annonces de votre secteur sur 3 mois, avec la carte 6', 'b1 à b6 dans le secteur (b6 à 40 jours), pas b7');
  assert.equal(lignes[3].t, 'Autres actualités presse professionnelle 3');
});

test('« Fait » (zone f) : cochée → rangée dans « Fait · 1 », décochée (off) → revient à sa place', async () => {
  const fait = { v: 1, g: {}, m: {}, f: { 'b-b2': { le: 100, off: 0 }, 'b-b3': { le: 100, off: 1 } } };
  const html = await rendre(fixtures(), { stock: { [CLE]: JSON.stringify(fait) } });
  assert.deepEqual(taches(groupe(html, 'secteur')).map(action), ['Prendre rendez-vous avec la Pharmacie du Mail', 'Se présenter au nouveau dirigeant de la Pharmacie des Halles']);
  assert.match(html, /<section class="inf-t-fait" id="inf-t-fait">/, 'la section Fait se montre');
  assert.match(html, /<span id="inf-t-fait-t">Fait · 1<\/span>/);
  const F = taches(faitListe(html));
  assert.equal(F.length, 1);
  assert.match(F[0], /^ fait" data-it="b-b2"/, 'barrée (classe fait)');
  assert.match(F[0], /aria-checked="true"/);
  assert.match(sous(html), /^5 choses à faire/);
  // rien de coché : la section reste cachée
  assert.match(await rendre(), /<section class="inf-t-fait" id="inf-t-fait" hidden>/);
});

test('fusion avec la ligne `profils` : le geste le plus récent gagne, clé par clé ; zones g et m intactes', async () => {
  const local = { v: 1, g: {}, m: { 'Presse A': { le: 5, off: 0 } }, f: { 'b-b1': { le: 100, off: 0 }, 'b-b2': { le: 300, off: 0 } } };
  const distant = { v: 1, g: { 'u:https://x': { le: 10, off: 0, e: { t: 'Une info gardée' } } }, m: {}, f: { 'b-b1': { le: 200, off: 1 }, 'b-b2': { le: 50, off: 1 }, 'm-autre': { le: 70, off: 0 } } };
  const ligne = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { data: JSON.parse(JSON.stringify(distant)) } }) }) }) }), upsert: () => Promise.resolve({}) });
  const sb = monter(fixtures(), { stock: { [CLE]: JSON.stringify(local) }, sb: () => ({ from: ligne }) });
  await rendreSb(sb);
  for (let i = 0; i < 8; i++) await attendre();
  const S = JSON.parse(sb.__LS.get(CLE));
  assert.deepEqual(S.f, { 'b-b1': { le: 200, off: 1 }, 'b-b2': { le: 300, off: 0 }, 'm-autre': { le: 70, off: 0 } }, 'b1 décochée ailleurs plus tard, b2 cochée ici plus tard');
  assert.deepEqual(S.m, local.m, 'zone m intacte');
  assert.deepEqual(S.g, distant.g, 'zone g intacte (les Gardées d\'avant ne s\'effacent pas)');
  // la page redessinée suit l'état fusionné
  const html = await rendreSb(sb);
  assert.deepEqual(taches(faitListe(html)).map(action), ['Appeler les officines voisines de la Pharmacie de la Gare']);
});

test('vue direction : « Les officines, toute la France », 3 tâches au plus, sans l\'arrêté du JO', async () => {
  const sb = monter(fixtures());
  sb.V2.user.voitTousReel = true; sb.V2.mesComms = () => [];   // la direction n'a pas de secteur propre
  const html = await rendreSb(sb);
  assert.match(html, /<h2 id="inf-t-h-secteur">Les officines, toute la France<\/h2>/);
  const L = taches(groupe(html, 'secteur'));
  assert.ok(L.length >= 1 && L.length <= 3);
  assert.doesNotMatch(texte(groupe(html, 'secteur')), /Arrêté du 5 novembre/);
  assert.match(html, /Annonces des officines, toute la France/);
});

test('sans annonce de moins de 14 jours : la liste le dit, elle n\'invente rien', async () => {
  const fx = fixtures(); fx['bodacc-secteur.json'].ev = fx['bodacc-secteur.json'].ev.filter((e) => e.id === 'b6');
  const html = await rendre(fx);
  assert.equal(taches(groupe(html, 'secteur')).length, 0);
  assert.match(html, /<p class="inf-t-vide" id="inf-t-v-secteur" data-vide="[^"]*">Rien de neuf ces 14 derniers jours dans votre secteur\.<\/p>/);
});
