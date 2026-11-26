// 26/11/2026 — option B, étape 8 : fiche « Le groupement » des apps de groupement (groupements/v2/groupement-fiche.js).
// Le banc exécute le module RÉEL avec le vrai réglage Essentiels et des officines FACTICES (ce fichier est public : aucun vrai nombre) :
//   - le nombre d'officines et de clientes est CALCULÉ sur V2.pharmacies, jamais lu dans le réglage ;
//   - officines rangées par département, nom du département en toutes lettres, pastille sur les clientes ;
//   - activités : seulement celles du réglage, JAMAIS de centrale d'achat, pas de cotisation ;
//   - chiffres annoncés par le groupement avec leur mention de source ;
//   - la fiche ne dépend pas de l'accès serveur (aucun appel réseau) ;
//   - OPSO (réglage sans `fiche`) : aucune page ; opso/v2 ne charge pas le module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const MODULE = lire('groupements/v2/groupement-fiche.js');
const CONF_ESS = lire('groupements/config/essentiels.js');
const CONF_OPSO = lire('groupements/config/opso.js');

const P = (name, cp, ville, inDb) => ({ id: name, name, cp, ville, inDb });
const FAUX = [
  P('PHARMACIE ZED', '49080', 'BOUCHEMAINE', true),
  P('PHARMACIE ALPHA', '49000', 'ANGERS', false),
  P('PHARMACIE BETA', '75011', 'PARIS', true),
  P('PHARMACIE GAMMA', '72000', 'LE MANS', false),
  P('CIP 1234567', '', '', false)
];

function monter(conf, pharmacies = FAUX) {
  const racineEcran = { innerHTML: '' };
  const reseau = [];
  const ctx = { console, document: { getElementById: () => racineEcran }, Intl, fetch: () => { reseau.push('fetch'); return Promise.reject(new Error('non')); } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(conf, ctx);
  ctx.V2 = { pages: {}, pharmacies, topbar: () => '<header></header>', sb: () => { reseau.push('sb'); return null; } };
  vm.runInContext(MODULE, ctx);
  return { V2: ctx.V2, racineEcran, reseau, G: ctx.V2_GROUPEMENT };
}
const texte = h => h.replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/[ \n\t]+/g, ' ');

test('officines et clientes CALCULÉES sur le périmètre de l\'app, pas lues dans le réglage', () => {
  const { V2, racineEcran, G } = monter(CONF_ESS);
  V2.pages.fichegroupement.render(racineEcran);
  const h = racineEcran.innerHTML;
  assert.deepEqual({ ...V2.groupementFiche._compter(FAUX) }, { officines: 5, clientes: 2 });
  assert.match(h, /<b class="gfic-kv">5<\/b><span class="gfic-kl">officines suivies/);
  assert.match(h, /<b class="gfic-kv">2<\/b><span class="gfic-kl">clientes Intégral Pharma/);
  assert.equal(JSON.stringify(G.fiche).includes('officines":'), false, 'aucun compte d\'officines écrit dans le réglage');
  // un autre périmètre = un autre chiffre
  const m2 = monter(CONF_ESS, FAUX.slice(0, 1));
  m2.V2.pages.fichegroupement.render(m2.racineEcran);
  assert.match(m2.racineEcran.innerHTML, /<b class="gfic-kv">1<\/b><span class="gfic-kl">officine suivie/);
});

test('officines groupées par département, nom en toutes lettres, pastille sur les clientes, groupe « à confirmer » en dernier', () => {
  const { V2, racineEcran } = monter(CONF_ESS);
  V2.pages.fichegroupement.render(racineEcran);
  const h = racineEcran.innerHTML, t = texte(h);
  for (const d of ['49 Maine-et-Loire', '72 Sarthe', '75 Paris', 'Département à confirmer']) assert.ok(t.includes(d), d);
  assert.ok(h.indexOf('49 Maine-et-Loire') < h.indexOf('72 Sarthe') && h.indexOf('72 Sarthe') < h.indexOf('75 Paris') && h.indexOf('75 Paris') < h.indexOf('Département à confirmer'));
  const groupes = V2.groupementFiche._parDepartement(FAUX, {});
  assert.deepEqual([...groupes.map(g => g.dep)], ['49', '72', '75', '?']);
  assert.deepEqual([...groupes[0].officines.map(o => o.name)], ['PHARMACIE ALPHA', 'PHARMACIE ZED']);   // ordre alphabétique
  assert.equal((h.match(/gfic-pastille/g) || []).length, 2);
  const zed = h.split('<li class="gfic-off">').find(x => x.includes('PHARMACIE ZED'));
  assert.match(zed, /Cliente Intégral Pharma/);
  const alpha = h.split('<li class="gfic-off">').find(x => x.includes('PHARMACIE ALPHA'));
  assert.doesNotMatch(alpha, /Cliente Intégral/);
});

test('contenu du groupement : dirigeants, contact, chiffres annoncés avec leur mention, site en lien', () => {
  const { V2, racineEcran, G } = monter(CONF_ESS);
  V2.pages.fichegroupement.render(racineEcran);
  const h = racineEcran.innerHTML, t = texte(h), F = G.fiche;
  assert.ok(F.dirigeants.length >= 3);
  for (const d of F.dirigeants) { assert.ok(t.includes(d.nom), d.nom); assert.ok(t.includes(d.fn), d.fn); }
  assert.ok(t.includes(F.contact.tel) && t.includes(F.contact.email));
  assert.ok(t.includes(F.ancien) && t.includes(F.baseline) && t.includes(F.siege));
  assert.match(h, /href="https:\/\/essentiels-pharma\.fr" target="_blank" rel="noopener"/);
  for (const l of F.annonces.lignes) { assert.ok(t.includes(l.l), l.l); assert.ok(t.includes(l.v), l.v); }
  assert.match(t, /Selon Essentiels Pharma, relevé de juillet/);
  assert.equal(F.annonces.lignes.length, 3);
});

test('activités : les trois du réglage seulement, titre « Les activités », jamais de centrale d\'achat ni de cotisation', () => {
  const { V2, racineEcran } = monter(CONF_ESS);
  V2.pages.fichegroupement.render(racineEcran);
  const h = racineEcran.innerHTML, t = texte(h);
  assert.match(t, /Les activités/);
  assert.equal((h.match(/class="gfic-act"/g) || []).length, 3);
  for (const a of ['Enseignes fédérées', 'Indépendants groupés', 'Prestataire laboratoires']) assert.ok(t.includes(a), a);
  assert.doesNotMatch(t, /centrale|cotisation|CAP /i);
  assert.doesNotMatch(CONF_ESS.slice(CONF_ESS.indexOf('fiche:'), CONF_ESS.indexOf('reco:')), /centrale|cotisation/i);
  assert.doesNotMatch(h, /OPSO|Normandie|Offilog|remise/i);
});

test('la fiche ne dépend pas de l\'accès serveur : aucun appel réseau, aucune condition commerciale', () => {
  const { V2, racineEcran, reseau } = monter(CONF_ESS);
  V2.pages.fichegroupement.render(racineEcran);
  assert.deepEqual(reseau, []);
  assert.doesNotMatch(MODULE, /\.rpc\(|storage|download|groupementDocs/);
  assert.doesNotMatch(racineEcran.innerHTML, /prix net|PPHT|abandon/i);
});

test('périmètre vide : message clair, pas de page blanche', () => {
  const { V2, racineEcran } = monter(CONF_ESS, []);
  V2.pages.fichegroupement.render(racineEcran);
  assert.match(racineEcran.innerHTML, /Aucune officine à afficher/);
});

test('nom d\'officine hostile : échappé', () => {
  const { V2, racineEcran } = monter(CONF_ESS, [P('<img src=x onerror=alert(1)>', '49000', 'ANGERS', false)]);
  V2.pages.fichegroupement.render(racineEcran);
  assert.doesNotMatch(racineEcran.innerHTML, /<img src=x/);
});

test('OPSO : pas de bloc `fiche` → aucune page ; opso/v2 ne charge pas le module ; Essentiels le charge avant groupement-bord.js', () => {
  const { V2 } = monter(CONF_OPSO);
  assert.equal(V2.pages.fichegroupement, undefined);
  assert.equal(V2.groupementFiche, undefined);
  assert.doesNotMatch(lire('opso/v2/index.html'), /groupement-fiche\.js/);
  const ess = lire('essentiels/v2/index.html');
  const i = ess.indexOf('groupements/v2/groupement-fiche.js'), b = ess.indexOf('groupements/v2/groupement-bord.js');
  assert.ok(i > 0 && b > i);
});

test('tuile d\'accueil et ⌘K branchés sur le module, gardés par sa présence (donc absents chez OPSO)', () => {
  const app = lire('crm/v2/v2-app.js');
  assert.match(app, /if \(V2\.groupementFiche && V2\.pages\[V2\.groupementFiche\.route\]\) \{\s*P\.push/);
  assert.match(app, /V2\.enGroupement\(\) && V2\.groupementFiche && V2\.pages\[V2\.groupementFiche\.route\]\) PAGES\.push/);
  assert.match(lire('groupements/v2/groupement-bord.js'), /V2\.groupementFiche\.tuileCourte/);
});

test('rien de daté ni de chiffré dans le module', () => {
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\d{3,}/);
});
