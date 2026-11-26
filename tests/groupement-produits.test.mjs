// 26/11/2026 — option B, étape 7 : page « Vos produits et nos prix nets » des apps de groupement (groupements/v2/groupement-produits.js).
// Le banc exécute les modules RÉELS (écran Documents puis page des produits) avec un faux client Supabase et des lignes FACTICES
// (ce fichier est public : aucune vraie ligne, aucun vrai prix) :
//   - les totaux affichés sont RECALCULÉS sur les lignes (pas recopiés du fichier) ;
//   - génériques = prix libre : PPHT et prix net écrits en clair, « — » pour l'abandon, aucun % ;
//   - un produit ajouté sans achat relevé : « — » pour les boîtes, jamais 0 ;
//   - compte refusé : « Produits indisponibles pour ce compte », ni liste, ni bouton « Partager », fichier non lu ;
//   - « Partager » remet le catalogue adhérents (essAdhPdf) à V2.shareOrSaveBlob, nom daté par le fichier ;
//   - OPSO (réglage sans `produits`) : aucune page ; opso/v2 ne charge pas le module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const DOCS = lire('groupements/v2/groupement-documents.js');
const MODULE = lire('groupements/v2/groupement-produits.js');
const CONF_ESS = lire('groupements/config/essentiels.js');
const CONF_OPSO = lire('groupements/config/opso.js');

const L = (o) => Object.assign({ remarque: '', ajout: false, labo: 'LABO TEST', cip: '3400000000000' }, o);
const FAUX = {
  date_prix: '03/02/2031', valide_jusqua: '04/05/2032', date_tarif_releve: '06/07/2030',
  categories: [{ cle: 'chers', titre: 'Produits chers' }, { cle: 'generiques', titre: 'Génériques' }, { cle: 'biosim', titre: 'Biosimilaires' }],
  lignes: [
    L({ cat: 'chers', designation: 'ALPHA 10MG CPR 30', boites: 10, ppht: 500, net: 480.5, abandon_boite: 19.5, abandon_pct: 0.039, abandon_12m: 195 }),
    L({ cat: 'chers', designation: 'ZETA 5MG CPR 28', boites: 3, ppht: 100.1, net: 96.21, abandon_boite: 3.89, abandon_pct: 0.0389, abandon_12m: 11.67 }),
    L({ cat: 'generiques', designation: 'BETA GENERIQUE 1', boites: 1000, ppht: 1.21, net: 1.21, abandon_boite: null, abandon_pct: null, abandon_12m: null, remarque: 'Générique : prix libre' }),
    L({ cat: 'biosim', designation: 'GAMMA BIOSIM 1', boites: null, ppht: 363.4, net: 349.26, abandon_boite: 14.14, abandon_pct: 0.0389, abandon_12m: null, remarque: 'Ajouté à votre demande', ajout: true })
  ]
};
// Totaux écrits dans le fichier : les mêmes que le recalcul (le fichier réel est recoupé de la même façon).
FAUX.totaux = { produits: 4, produits_achetes: 3, boites: 1013, abandon_12m: 206.67, montant_ppht: 6510.3 };

function monter(conf, { acces = true, produits = FAUX } = {}) {
  const appels = { rpc: [], download: [], fichier: [], partage: [] };
  const racineEcran = { innerHTML: '' };
  const ctx = { console, document: { getElementById: id => (id === 'v2-root' ? racineEcran : null), activeElement: null }, ICO: () => '<svg></svg>', Intl, setTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(conf, ctx);
  const client = {
    rpc: nom => { appels.rpc.push(nom); return Promise.resolve({ data: acces }); },
    storage: { from: seau => ({ download: chemin => { appels.download.push(seau + '/' + chemin); return Promise.resolve({ data: { text: () => Promise.resolve(JSON.stringify(produits)) } }); } }) }
  };
  ctx.V2 = {
    pages: {}, docsProteges: {}, sb: () => client, topbar: () => '<header></header>', route: { name: 'produitsgroupement' },
    docProtegeFichier: cle => { appels.fichier.push(cle); return Promise.resolve({ name: 'x.pdf', size: 3 }); },
    shareOrSaveBlob: (blob, nom, titre) => { appels.partage.push([nom, titre]); return Promise.resolve(); },
    toast: () => {}
  };
  vm.runInContext(DOCS, ctx);
  vm.runInContext(MODULE, ctx);
  return { V2: ctx.V2, appels, racineEcran };
}
const attendre = () => new Promise(r => setTimeout(r, 30));
const texte = h => h.replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/[ \n\t]+/g, ' ');   // garde les espaces insécables du format français

test('totaux recalculés sur les lignes, et écart signalé quand le fichier dit autre chose', () => {
  const { V2 } = monter(CONF_ESS);
  const P = V2.groupementProduits;
  const t = P._totaux(FAUX.lignes);
  assert.deepEqual({ ...t }, { produits: 4, achetes: 3, boites: 1013, abandon: 206.67, ppht: 6510.3 });
  assert.deepEqual([...P._ecarts(t, FAUX.totaux)], []);
  assert.deepEqual([...P._ecarts(t, { ...FAUX.totaux, boites: 1014, montant_ppht: 1 })], ['boîtes', 'PPHT']);
});

test('compte admis : dates et totaux LUS dans le fichier protégé, affichés recalculés', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS);
  V2.pages.produitsgroupement.render(racineEcran);
  assert.match(racineEcran.innerHTML, /Lecture de vos produits/);
  await attendre();
  const h = racineEcran.innerHTML, t = texte(h);
  assert.deepEqual(appels.rpc, ['jarvis_acces_essentiels']);
  assert.deepEqual(appels.download, ['donnees-protegees/essentiels/2026-11-26/produits-app.json']);
  assert.match(h, /Prix au <b class="gprod-d">03\/02\/2031<\/b>, valables jusqu'au <b class="gprod-d">04\/05\/2032<\/b>/);
  for (const v of ['4 produits', '3 achetés sur 12 mois', '1 013 boîtes sur 12 mois', '6 510,30 € achats au PPHT', '206,67 € d\'abandon de marge sur 12 mois']) assert.ok(t.includes(v), v);
  assert.equal((h.match(/class="gprod-li" role="row"/g) || []).length, 4);
  assert.match(h, /id="gprod-partage"/);
  assert.doesNotMatch(t, /remise/i);
  assert.doesNotMatch(h, /OPSO|Normandie|Offilog/i);
});

test('générique : PPHT et prix net en clair, « — » pour l\'abandon, aucun % ; ajout sans achat : « — » pour les boîtes', async () => {
  const { V2, racineEcran } = monter(CONF_ESS);
  V2.pages.produitsgroupement.render(racineEcran);
  await attendre();
  const lignes = racineEcran.innerHTML.split('class="gprod-li" role="row"').slice(1);
  const gen = lignes.find(x => x.includes('BETA GENERIQUE'));
  const cellules = gen.split('role="cell"').slice(1);
  assert.match(cellules[2], /1,21 €/);            // PPHT
  assert.match(cellules[3], /1,21 €/);            // prix net
  assert.match(cellules[4], /—/); assert.match(cellules[5], /—/);
  assert.doesNotMatch(gen, /%/);
  const bio = lignes.find(x => x.includes('GAMMA BIOSIM')).split('role="cell"').slice(1);
  assert.match(bio[1], /—/); assert.doesNotMatch(bio[1], /\b0\b/);
  assert.match(bio[4], /14,14 €/);                // abandon par boîte du barème, montré
  assert.match(bio[5], /—/);                           // pas d'achat relevé : pas d'abandon sur 12 mois
});

test('catégorie, recherche et tri', async () => {
  const { V2, racineEcran } = monter(CONF_ESS);
  V2.pages.produitsgroupement.render(racineEcran);
  await attendre();
  V2.gprodCat('generiques');
  assert.equal((racineEcran.innerHTML.match(/class="gprod-li" role="row"/g) || []).length, 1);
  V2.gprodCat('all'); V2.gprodCherche('zeta');
  assert.match(racineEcran.innerHTML, /1 résultat/); assert.match(racineEcran.innerHTML, /ZETA 5MG/);
  V2.gprodCherche(''); V2.gprodTri('alpha');
  const h = racineEcran.innerHTML;
  assert.ok(h.indexOf('ALPHA 10MG') < h.indexOf('ZETA 5MG'));
  V2.gprodTri('abandon');
  assert.ok(racineEcran.innerHTML.indexOf('ALPHA 10MG') < racineEcran.innerHTML.indexOf('ZETA 5MG'));
});

test('« Partager » : catalogue adhérents du seau, remis à V2.shareOrSaveBlob, nom daté par le fichier', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS);
  V2.pages.produitsgroupement.render(racineEcran);
  await attendre();
  V2.gprodPartager();
  assert.match(racineEcran.innerHTML, /Préparation du PDF/);
  await attendre();
  assert.deepEqual(appels.fichier, ['essAdhPdf']);
  assert.equal(appels.partage.length, 1);
  assert.equal(appels.partage[0][0], 'Catalogue adhérents - Intégral Pharma by Essentiels Pharma - 03-02-2031.pdf');
  assert.match(racineEcran.innerHTML, /Partager le catalogue adhérents/);
});

test('compte refusé par le serveur : message, ni liste, ni « Partager », fichier non lu', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS, { acces: false });
  V2.pages.produitsgroupement.render(racineEcran);
  await attendre();
  const h = racineEcran.innerHTML;
  assert.match(h, /Produits indisponibles pour ce compte\./);
  assert.doesNotMatch(h, /gprod-li|gprod-partage/);
  assert.deepEqual(appels.download, []);
});

test('rien de chiffré ni de daté dans le dépôt : réglage et module', () => {
  const bloc = CONF_ESS.slice(CONF_ESS.indexOf('produits:'), CONF_ESS.indexOf('// Écran « Documents »'));
  assert.doesNotMatch(bloc, /\d{3,}|\d+,\d{2}|\d{2}\/\d{2}\/\d{4}/);   // aucun montant, aucune date, aucun nombre de 3 chiffres ou plus
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b\d{2}\/\d{2}\/20\d{2}\b/);
  assert.doesNotMatch(code, /remise/i);
});

test('OPSO : pas de bloc `produits` → aucune page ; opso/v2 ne charge pas le module ; Essentiels le charge avant groupement-bord.js', () => {
  const { V2 } = monter(CONF_OPSO);
  assert.equal(V2.pages.produitsgroupement, undefined);
  assert.equal(V2.groupementProduits, undefined);
  assert.doesNotMatch(lire('opso/v2/index.html'), /groupement-produits\.js/);
  const ess = lire('essentiels/v2/index.html');
  const i = ess.indexOf('groupements/v2/groupement-produits.js'), d = ess.indexOf('groupements/v2/groupement-documents.js'), b = ess.indexOf('groupements/v2/groupement-bord.js');
  assert.ok(d > 0 && i > d && b > i, 'ordre documents → produits → bord');
});
