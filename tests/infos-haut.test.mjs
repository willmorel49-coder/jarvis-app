/* Haut de l'écran « Infos du jour » en « trois portes » (09/11/2026, direction C).
   Données FABRIQUÉES, réponses connues d'avance, pas de navigateur : on fait tourner le VRAI v2-infos.js dans un bac à sable
   et on lit le HTML que page.render() écrit.
   Ce que ce test garantit :
     - le secteur ne montre QUE des annonces d'officines (un arrêté du Journal officiel qui parle d'officines n'y est plus), 3 au plus, moins de 14 jours ;
     - sous CHAQUE annonce du secteur, la phrase « À dire en rendez-vous » (celle du vrai code) ;
     - « En France » : 3 infos au plus ;
     - la phrase du bandeau compte EXACTEMENT les lignes affichées ;
     - les 11 panneaux (secteur + dix rubriques) restent atteignables, chacun par une seule entrée ;
     - la date du bandeau est celle de l'ÉDITION, dite en clair quand ce n'est pas celle du jour ;
     - plus de capsules, plus de bouton « Toutes les infos du jour ».
   Lancer : node --test tests/infos-haut.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../crm/v2/v2-infos.js', import.meta.url), 'utf8');
const iso = (decalage) => { const d = new Date(Date.now() + decalage * 864e5); return d.toISOString().slice(0, 10); };
const AUJ = iso(0), HIER = iso(-1);

function fixtures(o = {}) {
  const ev = (id, nom, ville, jours, f, cp = '49000', dep = '49') => ({ id, nom, ville, cp, dep, d: iso(-jours), f, detail: '', url: 'https://www.bodacc.fr/' + id, depNom: 'Maine-et-Loire' });
  return {
    'brief-jour.json': {
      jour: o.jour || AUJ, genere: (o.jour || AUJ) + 'T07:12:00+00:00',
      une: { t: 'Le sujet du jour', r: 'Résumé de la une', theme: 'marge', theme_l: 'Marges', d: AUJ, srcs: ['Source A'] },
      cinq: [1, 2, 3, 4, 5].map((n) => ({ t: 'Sujet numéro ' + n + ' de l’essentiel', r: 'Résumé ' + n, d: HIER, srcs: ['Presse ' + n] })),
      epingles: [
        // un arrêté du Journal officiel qui parle d'officines : jadis glissé dans « Votre secteur »
        { t: 'Arrêté du 5 novembre relatif aux officines de pharmacie', s: 'Journal officiel', srcs: ['Journal officiel'], motif: 'signal', d: HIER },
        { t: 'Baisse de prix des antibiotiques', effet: iso(5), motif: 'echeance', theme: 'marge', d: HIER },
        { t: 'Autre échéance du mois', effet: iso(20), motif: 'echeance', theme: 'marge', d: HIER }
      ],
      ruptures_neuves: [{ spec: 'Amoxicilline – 500 mg', dci: 'amoxicilline', since: HIER }],
      rappels_lots: [{ t: 'Rappel du lot X1234', lab: 'Labo', d: HIER, motif: 'Défaut', niv: 'Classe II', url: 'https://ansm.sante.fr/x' }],
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
      ev('b6', 'PHARMACIE TROP ANCIENNE', 'ANGERS', 40, 'cession'),            // plus de 14 jours : jamais dans les lignes, comptée dans les 3 mois
      ev('b7', 'PHARMACIE DE LILLE', 'LILLE', 2, 'cession', '59000', '59')      // hors secteur
    ] },
    'departements-contours.json': null
  };
}

function monter(fx) {
  const sb = { console, setTimeout, clearTimeout, URL, Date, Promise, JSON, Math };
  const noop = () => {};
  sb.window = sb; sb.globalThis = sb;
  sb.document = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, appendChild: noop, setAttribute: noop }), head: { appendChild: noop }, body: { appendChild: noop, contains: () => false }, addEventListener: noop, documentElement: { classList: { add: noop, remove: noop } }, querySelector: () => null, querySelectorAll: () => [] };
  sb.addEventListener = noop;
  sb.localStorage = { getItem: () => null, setItem: noop };
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
  vm.runInContext(SRC, sb);
  sb.__racine = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector: () => null, contains: () => false };
  return sb;
}
const attendre = () => new Promise((r) => setTimeout(r, 0));
async function rendre(fx = fixtures()) {
  const sb = monter(fx);
  sb.V2.pages.infos.render(sb.__racine);   // 1er passage : « Composition de l'édition… », puis load() redessine
  for (let i = 0; i < 8; i++) await attendre();
  const html = sb.__racine.html;
  assert.match(html, /Infos du jour/, 'la page est bien celle des Infos du jour (marqueur positif)');
  assert.doesNotMatch(html, /Composition de l'édition|n'a pas pu s'afficher|Pas encore d'édition/, 'ni attente ni page d\'erreur');
  return html;
}
const porte = (html, nom) => { const m = new RegExp('<article class="inf-c-porte" data-porte="' + nom + '">([\\s\\S]*?)</article>').exec(html); assert.ok(m, 'porte ' + nom + ' présente'); return m[1]; };
const lignes = (h) => h.split('<li class="inf-c-li">').slice(1);
const texte = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('trois portes, plus de capsules ni de bouton « Toutes les infos du jour »', async () => {
  const html = await rendre();
  assert.equal((html.match(/<article class="inf-c-porte"/g) || []).length, 3);
  assert.doesNotMatch(html, /inf-cap|inf-caps|Toutes les infos du jour|data-x13-rub|x13-bl-sec/);
  assert.match(html, /data-copier|onclick="V2\.infosCopyBrief\(this\)"/, '« Copier le brief » reste dans le bandeau');
});

test('le secteur : annonces d\'officines seulement, 3 au plus, moins de 14 jours, sans l\'arrêté du JO', async () => {
  const html = await rendre();
  const p1 = porte(html, 'secteur'), L = lignes(p1);
  assert.equal(L.length, 3, 'trois lignes au plus');
  const t = texte(p1);
  assert.doesNotMatch(t, /Arrêté du 5 novembre|Journal officiel/, 'l\'arrêté JO ne se glisse plus dans le secteur');
  assert.doesNotMatch(t, /Trop Ancienne/, 'plus de 14 jours : pas dans les lignes');
  assert.doesNotMatch(t, /Lille/, 'hors du secteur : pas dans les lignes');
  assert.match(t, /Pharmacie du Mail/);
  // le pied dit combien d'annonces sur 3 mois : b1..b6 sont dans le secteur (b6 à 40 jours), pas b7
  assert.match(t, /Voir les 6 annonces des 3 derniers mois, et la carte/);
});

test('sous CHAQUE annonce du secteur, la phrase « À dire en rendez-vous » du vrai code', async () => {
  const html = await rendre();
  const L = lignes(porte(html, 'secteur'));
  assert.equal(L.length, 3);
  const GESTES = [/Nouveau titulaire|Votre client change de mains/, /Ses patients vont se répartir/, /Nouvel interlocuteur/, /Nouvelle société d’officine|holding/, /Officine fragilisée|Prudence sur l’encours/];
  L.forEach((l) => {
    assert.match(l, /<b>À dire en rendez-vous<\/b>/);
    assert.ok(GESTES.some((g) => g.test(texte(l))), 'phrase du vrai code : ' + texte(l));
  });
});

test('« En France » : 3 infos au plus, jamais d\'annonce d\'officine', async () => {
  const html = await rendre();
  const p2 = porte(html, 'france'), L = lignes(p2);
  assert.ok(L.length >= 1 && L.length <= 3, 'entre une et trois lignes : ' + L.length);
  assert.doesNotMatch(p2, /À dire en rendez-vous/);
  assert.match(p2, /data-porte-ouvre="france"/);
});

test('la phrase du bandeau compte exactement les lignes affichées', async () => {
  const html = await rendre();
  const nSec = lignes(porte(html, 'secteur')).length, nFr = lignes(porte(html, 'france')).length;
  const phrase = texte(/<p class="inf-phrase">([\s\S]*?)<\/p>/.exec(html)[1]);
  assert.match(phrase, new RegExp('^' + nSec + ' annonces? dans votre secteur'));
  // la France : la somme des nombres cités avant « en France » (ou « N infos en France ») = lignes affichées
  const fr = /,\s(.*?)\sen France/.exec(phrase)[1];
  const somme = [...fr.matchAll(/(\d+)\s/g)].reduce((s, m) => s + Number(m[1]), 0);
  assert.equal(somme, nFr, 'phrase « ' + phrase + ' » pour ' + nFr + ' lignes de France');
  // sans annonce : la phrase le dit, elle n'invente pas de nombre
  const fx = fixtures(); fx['bodacc-secteur.json'].ev = [];
  const vide = texte(/<p class="inf-phrase">([\s\S]*?)<\/p>/.exec(await rendre(fx))[1]);
  assert.match(vide, /^Rien de neuf cette semaine dans votre secteur/);
});

test('les 11 panneaux restent atteignables, chacun par une seule entrée', async () => {
  const html = await rendre();
  const cles = [...html.matchAll(/data-ouvre="([a-z]+)"/g)].map((m) => m[1]);
  const attendues = ['secteur', 'echeances', 'ruptures', 'rappels', 'concurrents', 'radar', 'une', 'cinq', 'mur', 'archive', 'sources'];
  assert.deepEqual([...cles].sort(), [...attendues].sort(), 'onze entrées, aucune en double');
  assert.ok(porte(html, 'secteur').includes('data-ouvre="secteur"'), 'le secteur par la porte 1');
  attendues.filter((c) => c !== 'secteur').forEach((c) => assert.ok(porte(html, 'reste').includes('data-ouvre="' + c + '"'), c + ' par la porte 3'));
  // les compteurs de la porte 3 sont ceux des données fabriquées
  const reste = texte(porte(html, 'reste'));
  assert.match(reste, /Échéances 3/); assert.match(reste, /Les cinq 5/); assert.match(reste, /Sources 3/); assert.match(reste, /Les matins d’avant 2/);
  assert.match(reste, /Rappels de lot 1/);
});

test('sans sujet « La une », la rubrique n\'est pas proposée (elle n\'ouvrirait rien)', async () => {
  const fx = fixtures(); delete fx['brief-jour.json'].une;
  const html = await rendre(fx);
  assert.doesNotMatch(html, /data-ouvre="une"/);
});

test('la date du bandeau est celle de l\'ÉDITION, dite en clair quand ce n\'est pas celle du jour', async () => {
  const dujour = await rendre(fixtures({ jour: AUJ }));
  assert.doesNotMatch(dujour, /n’est pas encore composée/);
  assert.match(texte(/<p class="inf-ed">([\s\S]*?)<\/p>/.exec(dujour)[1]), /^Édition de \d{2} h \d{2} · 3 sources$/);
  const veille = await rendre(fixtures({ jour: iso(-1) }));
  assert.match(texte(/<p class="inf-eye">([\s\S]*?)<\/p>/.exec(veille)[1]), /^Édition du (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2}(er)? [a-zéû]+$/);
  assert.match(texte(/<p class="inf-ed">([\s\S]*?)<\/p>/.exec(veille)[1]), /celle d’aujourd’hui n’est pas encore composée/);
});

test('vue direction : « Les officines · toute la France » et accès à la bascule de secteur', async () => {
  const sb = monter(fixtures());
  sb.V2.user.voitTousReel = true; sb.V2.mesComms = () => [];   // la direction n'a pas de secteur propre
  sb.V2.pages.infos.render(sb.__racine);
  for (let i = 0; i < 8; i++) await attendre();
  const p1 = porte(sb.__racine.html, 'secteur'), t = texte(p1);
  assert.match(t, /Les officines · toute la France/);
  assert.match(t, /changer de secteur/);
  assert.ok(lignes(p1).length <= 3);
  assert.doesNotMatch(t, /Arrêté du 5 novembre/);
});
