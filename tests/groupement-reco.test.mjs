// 26/11/2026 — option B, étape 8 : page « Reco produits » des apps de groupement (groupements/v2/groupement-reco.js).
// Le banc exécute les modules RÉELS (écran Documents puis reco) avec un faux client Supabase et des lignes FACTICES
// (ce fichier est public : aucune vraie ligne, aucun vrai prix, aucun nombre de 3 chiffres) :
//   - un onglet par liste, dans l'ordre du fichier, libellé court + nombre de lignes ;
//   - colonne « Abandon de marge » SEULEMENT si la liste a pourcent:true, « — » quand la valeur est nulle ;
//   - génériques et non remboursés : prix net seul, jamais de % ;
//   - impression : fenêtre ouverte AVANT tout appel asynchrone, SANS colonne ni % d'abandon de marge ;
//   - compte refusé : « Reco indisponible pour ce compte. », ni liste, ni bouton, fichier non lu ;
//   - fichier absent ou illisible : message clair, jamais une page vide ;
//   - clé de liste hostile filtrée avant tout onclick ; OPSO (pas de bloc `reco`) : aucune page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const DOCS = lire('groupements/v2/groupement-documents.js');
const MODULE = lire('groupements/v2/groupement-reco.js');
const CONF_ESS = lire('groupements/config/essentiels.js');
const CONF_OPSO = lire('groupements/config/opso.js');

const L = (o) => Object.assign({ cip: '3400000000000', labo: 'LABO TEST', nature: 'princeps', abandon_pct: null }, o);
const FAUX = {
  version: 1, date_prix: '03/02/2031', valide_jusqua: '04/05/2032', date_tarif_releve: '06/07/2030',
  ventes: { depot: '08/09/2031', mois: 'janvier à mars 2031', nb_pharmacies: 12 },
  listes: [
    { cle: 'glp1', titre: 'Titre liste un', court: 'Court un', note: 'Note liste un', pourcent: true, lignes: [
      L({ designation: 'ALPHA 10MG', n: 9, ppht: 50.5, net: 48.5, abandon_pct: 3.9 }),
      L({ designation: 'ZETA 5MG', n: 4, ppht: 20, net: 19.5, abandon_pct: null })] },
    { cle: 'gen_nr', titre: 'Titre liste deux', court: 'Court deux', note: '', pourcent: false, lignes: [
      L({ designation: 'BETA GENERIQUE', nature: 'generique', n: 7, ppht: 1.21, net: 1.21 })] }
  ]
};

function monter(conf, { acces = true, fichier = FAUX, ouverture = true } = {}) {
  const appels = { rpc: [], download: [], ouvertures: [], ecrit: [], toasts: [], ordre: [] };
  const racineEcran = { innerHTML: '' };
  const fenetre = { document: { write: h => { appels.ordre.push('write'); appels.ecrit.push(h); }, close: () => {} } };
  const ctx = { console, document: { getElementById: id => (id === 'v2-root' ? racineEcran : null), activeElement: null }, ICO: () => '<svg></svg>', Intl, setTimeout,
    open: (...a) => { appels.ordre.push('open'); appels.ouvertures.push(a); return ouverture ? fenetre : null; } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(conf, ctx);
  const client = {
    rpc: nom => { appels.rpc.push(nom); return Promise.resolve({ data: acces }); },
    storage: { from: seau => ({ download: chemin => {
      appels.download.push(seau + '/' + chemin);
      if (fichier == null) return Promise.resolve({ data: null, error: { message: 'absent' } });
      return Promise.resolve({ data: { text: () => Promise.resolve(JSON.stringify(fichier)) } });
    } }) }
  };
  ctx.V2 = { pages: {}, docsProteges: {}, sb: () => client, topbar: () => '<header></header>', route: { name: 'recogroupement' }, toast: t => appels.toasts.push(t) };
  vm.runInContext(DOCS, ctx);
  vm.runInContext(MODULE, ctx);
  return { V2: ctx.V2, appels, racineEcran };
}
const attendre = () => new Promise(r => setTimeout(r, 30));
const texte = h => h.replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/[ \n\t]+/g, ' ');
const nbLignes = h => (h.match(/class="greco-li(?: has-aban)?" role="row"/g) || []).length;

test('compte admis : fichier privé du même dossier que les documents, dates lues dans le fichier, onglets dans l\'ordre', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS);
  V2.pages.recogroupement.render(racineEcran);
  assert.match(racineEcran.innerHTML, /Lecture de la reco/);
  await attendre();
  const h = racineEcran.innerHTML, t = texte(h);
  assert.deepEqual([...appels.rpc], ['jarvis_acces_essentiels']);
  assert.ok(appels.download.includes('donnees-protegees/essentiels/2026-11-26/reco-produits.json'));
  assert.match(t, /Ce que les pharmacies Intégral Pharma commandent déjà, classé par nombre de pharmacies, à nos prix nets/);
  assert.match(h, /Prix au <b class="greco-d">03\/02\/2031<\/b>, valables jusqu'au <b class="greco-d">04\/05\/2032<\/b> · tarif relevé le 06\/07\/2030 · ventes : janvier à mars 2031, 12 pharmacies, déposées le 08\/09\/2031/);
  const onglets = [...h.matchAll(/<button type="button" class="v2-tab[^"]*" onclick="V2\.grecoListe\('([^']+)'\)">([^<]*)<em>(\d+)<\/em>/g)].map(m => m.slice(1).join('|'));
  assert.deepEqual(onglets, ['glp1|Court un|2', 'gen_nr|Court deux|1']);
  assert.equal(nbLignes(h), 2);              // première liste affichée
  assert.doesNotMatch(h, /OPSO|Normandie|Offilog|centrale/i);
  assert.doesNotMatch(t, /remise/i);
});

test('colonne « Abandon de marge » seulement si pourcent:true ; « — » sur null ; aucun % sur génériques et non remboursés', async () => {
  const { V2, racineEcran } = monter(CONF_ESS);
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  let h = racineEcran.innerHTML;
  assert.match(h, /role="columnheader">Abandon de marge</);
  const lignes = h.split('class="greco-li has-aban" role="row"').slice(1);
  assert.match(lignes[0], /3,9 %/);                       // abandon_pct écrit en pourcents
  assert.match(lignes[1].split('data-l="Abandon de marge"')[1], /—/);
  V2.grecoListe('gen_nr');
  h = racineEcran.innerHTML;
  assert.doesNotMatch(h, /Abandon de marge|has-aban|%/);
  assert.match(h, /1,21 €/);
  assert.match(h, /BETA GENERIQUE/);
});

test('pourcentage lu EN POURCENTS, même sous 1 % (produits chers) : jamais ×100 deviné', async () => {
  const f = JSON.parse(JSON.stringify(FAUX)); f.listes[0].lignes[0].abandon_pct = 0.8;
  const { V2, racineEcran } = monter(CONF_ESS, { fichier: f });
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  assert.match(racineEcran.innerHTML, /0,8 %/);
  assert.doesNotMatch(racineEcran.innerHTML, /80 %/);
});

test('impression aux polices et couleurs du thème (lues à l\'exécution), jamais Arial ni gris écrits en dur', () => {
  const src = lire('groupements/v2/groupement-reco.js');
  const imp = src.slice(src.indexOf('function themeImpression'), src.indexOf('V2.grecoImprimer = function'));
  assert.doesNotMatch(imp, /Arial|Helvetica|#222|#444|#555|#eee|#ddd/);
  assert.match(imp, /--grp-accent/);
  assert.match(imp, /document\.fonts\.ready/);
});

test('impression : fenêtre ouverte AVANT toute écriture, liste affichée, SANS colonne ni % d\'abandon de marge, avec dates et phrase prix net seul', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS);
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  V2.grecoImprimer();
  assert.deepEqual([...appels.ordre], ['open', 'write']);
  const doc = appels.ecrit[0], t = texte(doc);
  assert.match(doc, /size:A4/);
  assert.match(t, /ALPHA 10MG/); assert.doesNotMatch(t, /BETA GENERIQUE/);   // la liste affichée, pas l'autre
  assert.doesNotMatch(doc.slice(doc.indexOf("<body>")), /Abandon|abandon|%|remise/);   // le corps du document (le CSS contient « width:100% »)
  assert.match(t, /Prix au 03\/02\/2031, valables jusqu'au 04\/05\/2032 · tarif relevé le 06\/07\/2030/);
  assert.match(t, /Génériques et non remboursés : prix net seul/);
  V2.grecoListe('gen_nr'); V2.grecoImprimer();
  assert.match(texte(appels.ecrit[1]), /BETA GENERIQUE/);
});

test('impression bloquée par le navigateur : message, aucune écriture', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS, { ouverture: false });
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  V2.grecoImprimer();
  assert.equal(appels.ecrit.length, 0);
  assert.equal(appels.toasts.length, 1);
});

test('compte refusé par le serveur : « Reco indisponible pour ce compte. », ni liste, ni Imprimer, fichier non lu', async () => {
  const { V2, appels, racineEcran } = monter(CONF_ESS, { acces: false });
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  const h = racineEcran.innerHTML;
  assert.match(h, /Reco indisponible pour ce compte\./);
  assert.doesNotMatch(h, /greco-li|greco-imprimer|v2-tab/);
  assert.equal(appels.download.some(d => d.includes('reco-produits')), false);
});

test('fichier absent ou de format inconnu : message clair avec « Réessayer », jamais une page vide', async () => {
  for (const fichier of [null, { version: 2, listes: FAUX.listes }, { version: 1, listes: [] }]) {
    const { V2, racineEcran } = monter(CONF_ESS, { fichier });
    V2.pages.recogroupement.render(racineEcran);
    await attendre();
    const h = racineEcran.innerHTML;
    assert.match(h, /La reco n'a pas pu être lue pour le moment/);
    assert.match(h, /V2\.grecoRelire\(\)/);
    assert.doesNotMatch(h, /greco-imprimer|greco-li/);
  }
});

test('clé de liste hostile : écartée, jamais insérée dans un onclick', async () => {
  const f = JSON.parse(JSON.stringify(FAUX));
  f.listes.push({ cle: "x');alert(1);('", titre: 'Piège', court: 'Piège', note: '', pourcent: false, lignes: [] });
  const { V2, racineEcran } = monter(CONF_ESS, { fichier: f });
  V2.pages.recogroupement.render(racineEcran);
  await attendre();
  assert.doesNotMatch(racineEcran.innerHTML, /alert\(1\)|Piège/);
  assert.match(racineEcran.innerHTML, /V2\.grecoListe\('glp1'\)/);
  V2.grecoListe("x');alert(1);('");     // un appel hostile retombe sur la première liste
  assert.match(racineEcran.innerHTML, /ALPHA 10MG/);
});

test('rien de daté ni de chiffré dans le dépôt : réglage et module', () => {
  const bloc = CONF_ESS.slice(CONF_ESS.indexOf('reco:'), CONF_ESS.indexOf('// Page « Vos produits'));
  assert.doesNotMatch(bloc, /\d{3,}|\d+,\d{2}|\d{2}\/\d{2}\/\d{4}/);
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b\d{2}\/\d{2}\/20\d{2}\b/);
  assert.doesNotMatch(code, /remise/i);
});

test('OPSO : pas de bloc `reco` → aucune page ; opso/v2 ne charge pas le module ; Essentiels le charge après Documents et avant groupement-bord.js ; tuile et ⌘K gardés', () => {
  const { V2 } = monter(CONF_OPSO);
  assert.equal(V2.pages.recogroupement, undefined);
  assert.equal(V2.groupementReco, undefined);
  assert.doesNotMatch(lire('opso/v2/index.html'), /groupement-reco\.js/);
  const ess = lire('essentiels/v2/index.html');
  const i = ess.indexOf('groupements/v2/groupement-reco.js'), d = ess.indexOf('groupements/v2/groupement-documents.js'), b = ess.indexOf('groupements/v2/groupement-bord.js');
  assert.ok(d > 0 && i > d && b > i);
  const app = lire('crm/v2/v2-app.js');
  assert.match(app, /if \(V2\.groupementReco && V2\.pages\[V2\.groupementReco\.route\]\) \{\s*P\.push/);
  assert.match(app, /V2\.enGroupement\(\) && V2\.groupementReco && V2\.pages\[V2\.groupementReco\.route\]\) PAGES\.push/);
  assert.match(lire('groupements/v2/groupement-bord.js'), /V2\.groupementReco\.tuileCourte/);
});
