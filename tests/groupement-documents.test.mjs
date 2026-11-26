// 26/11/2026 — option B, étape 6 : écran « Documents » des apps de groupement (groupements/v2/groupement-documents.js).
// Le banc exécute le module RÉEL avec un faux client Supabase :
//   - les 5 documents du réglage Essentiels sont inscrits dans V2.docsProteges avec leur chemin du seau privé ;
//   - les dates affichées sont LUES dans le fichier protégé (jamais écrites dans le dépôt) ;
//   - un compte refusé par le serveur voit « Documents indisponibles pour ce compte », sans bouton, et rien n'est téléchargé ;
//   - serveur muet : les boutons restent (un contrôle qui échoue ne condamne rien) ;
//   - OPSO (réglage sans `documents`) : aucun écran, aucune tuile ; opso/v2 ne charge pas le module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const MODULE = lire('groupements/v2/groupement-documents.js');
const CONF_ESS = lire('groupements/config/essentiels.js');
const CONF_OPSO = lire('groupements/config/opso.js');

const FICHIERS_DU_SEAU = ['prix-nets-integral.xlsx', 'catalogue-reseau.pdf', 'catalogue-reseau.html', 'catalogue-adherents.pdf', 'catalogue-adherents.html'];
// Dates factices, différentes des vraies : si elles s'affichent, c'est qu'elles ont été lues.
const FAUX_PRODUITS = { date_prix: '03/02/2031', valide_jusqua: '04/05/2032', date_tarif_releve: '06/07/2030', lignes: [] };

function monter(conf, { acces = true, rpcErreur = false, produits = FAUX_PRODUITS } = {}) {
  const appels = { rpc: [], download: [] };
  const racineEcran = { innerHTML: '' };
  const ctx = {
    console,
    window: {},
    document: { getElementById: id => (id === 'v2-root' ? racineEcran : null) },
    ICO: () => '<svg></svg>'
  };
  ctx.window = ctx;
  ctx.window.ICO = ctx.ICO;
  vm.createContext(ctx);
  vm.runInContext(conf, ctx);
  const client = {
    rpc: nom => { appels.rpc.push(nom); return Promise.resolve(rpcErreur ? { error: { message: 'réseau' } } : { data: acces }); },
    storage: { from: seau => ({ download: chemin => { appels.download.push(seau + '/' + chemin); return Promise.resolve({ data: { text: () => Promise.resolve(JSON.stringify(produits)) } }); } }) }
  };
  ctx.V2 = { pages: {}, docsProteges: {}, sb: () => client, topbar: () => '<header></header>', route: { name: 'docsgroupement' } };
  vm.runInContext(MODULE, ctx);
  return { ctx, V2: ctx.V2, appels, racineEcran };
}
const attendre = () => new Promise(r => setTimeout(r, 20));
const boutons = html => (html.match(/class="gdoc-btn"/g) || []).length;

test('réglage Essentiels : 5 documents, noms = fichiers du seau, types fichier/pdf/html, dossier essentiels/', () => {
  const { V2 } = monter(CONF_ESS);
  const docs = Object.values(V2.docsProteges);
  assert.equal(docs.length, 5);
  assert.deepEqual(docs.map(d => d.fichier.replace('essentiels/2026-11-26/', '')).sort(), [...FICHIERS_DU_SEAU].sort());
  docs.forEach(d => assert.ok(d.fichier.startsWith('essentiels/2026-11-26/'), d.fichier));
  const type = Object.fromEntries(docs.map(d => [d.fichier.split('/').pop(), d.type]));
  assert.equal(type['prix-nets-integral.xlsx'], 'fichier');
  assert.equal(type['catalogue-reseau.pdf'], 'pdf');
  assert.equal(type['catalogue-adherents.html'], 'html');
  assert.equal(V2.groupementDocs.nb, 5);
});

test('aucune date écrite en dur : ni dans le réglage, ni dans le module', () => {
  const bloc = CONF_ESS.slice(CONF_ESS.indexOf('documents:'));
  assert.doesNotMatch(bloc, /\b\d{2}\/\d{2}\/\d{4}\b/);
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // commentaires retirés (dates d'historique)
  assert.doesNotMatch(code, /\b\d{2}\/\d{2}\/20\d{2}\b/);
});

test('compte admis : dates LUES dans le fichier protégé, 5 boutons vers V2.ouvrirDocProtege', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS);
  V2.pages.docsgroupement.render(racineEcran);
  assert.match(racineEcran.innerHTML, /Lecture des dates des prix/);
  await attendre();
  const h = racineEcran.innerHTML;
  assert.deepEqual(appels.rpc, ['jarvis_acces_essentiels']);
  assert.deepEqual(appels.download, ['donnees-protegees/essentiels/2026-11-26/produits-app.json']);
  assert.match(h, /Prix au <b class="gdoc-d">03\/02\/2031<\/b>, valables jusqu'au <b class="gdoc-d">04\/05\/2032<\/b> · tarif Intégral Pharma relevé le 06\/07\/2030\./);
  assert.equal(boutons(h), 5);
  ['essPrixExcel', 'essResPdf', 'essResHtml', 'essAdhPdf', 'essAdhHtml'].forEach(c => assert.ok(h.includes("V2.ouvrirDocProtege('" + c + "')"), c));
  assert.doesNotMatch(h, /OPSO|Normandie/i);
});

test('compte refusé par le serveur : message propre, aucun bouton, rien téléchargé', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS, { acces: false });
  V2.pages.docsgroupement.render(racineEcran);
  await attendre();
  const h = racineEcran.innerHTML;
  assert.match(h, /Documents indisponibles pour ce compte\./);
  assert.match(h, /réservés aux comptes du groupement Essentiels Pharma/);
  assert.equal(boutons(h), 0);
  assert.equal(appels.download.length, 0);
  assert.doesNotMatch(h, /Prix au/);
});

test('serveur muet (erreur de la fonction d\'accès) : les boutons restent', async () => {
  const { V2, racineEcran } = monter(CONF_ESS, { rpcErreur: true });
  V2.pages.docsgroupement.render(racineEcran);
  await attendre();
  assert.equal(boutons(racineEcran.innerHTML), 5);
  assert.doesNotMatch(racineEcran.innerHTML, /indisponibles pour ce compte/);
});

test('fichier des dates absent : pas de date inventée, boutons présents', async () => {
  const { V2, racineEcran } = monter(CONF_ESS, { produits: null });
  V2.pages.docsgroupement.render(racineEcran);
  await attendre();
  assert.doesNotMatch(racineEcran.innerHTML, /Prix au/);
  assert.equal(boutons(racineEcran.innerHTML), 5);
});

test('OPSO : réglage sans documents → ni écran, ni V2.groupementDocs', () => {
  assert.doesNotMatch(CONF_OPSO, /documents\s*:/);
  const { V2 } = monter(CONF_OPSO);
  assert.equal(V2.pages.docsgroupement, undefined);
  assert.equal(V2.groupementDocs, undefined);
  assert.equal(Object.keys(V2.docsProteges).length, 0);
});

test('chargement : Essentiels charge le module après v2-boot et AVANT groupement-bord ; OPSO ne le charge pas', () => {
  const ess = lire('essentiels/v2/index.html'), opso = lire('opso/v2/index.html');
  const i = s => { const k = ess.indexOf('src="' + s); assert.ok(k >= 0, s); return k; };
  assert.ok(i('../../groupements/v2/groupement-documents.js') > i('../../crm/v2/v2-boot.js'));
  assert.ok(i('../../groupements/v2/groupement-documents.js') < i('../../groupements/v2/groupement-bord.js'));
  assert.ok(!opso.includes('groupement-documents.js'));
});

test('accueil et ⌘K : la tuile et l\'entrée ne dépendent que de V2.groupementDocs (rien d\'Essentiels en dur dans le socle)', () => {
  const app = lire('crm/v2/v2-app.js');
  assert.match(app, /if \(V2\.groupementDocs && V2\.pages\[V2\.groupementDocs\.route\]\) \{\s*P\.push\(\{ k: V2\.groupementDocs\.route/);
  assert.match(app, /PAGES\.push\(\[V2\.groupementDocs\.route, V2\.groupementDocs\.palette, 'fiche'\]\)/);
  assert.ok(!/prix-nets-integral|catalogue-adherents|essentiels\/2026/.test(app));
  const bord = lire('groupements/v2/groupement-bord.js');
  assert.match(bord, /ESPACES\[V2\.groupementDocs\.route\] = V2\.groupementDocs\.tuileCourte/);
});
