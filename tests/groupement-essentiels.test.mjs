// 26/11/2026 — option B, étape 4 : Essentiels Pharma = deuxième habillage du même code JARVIS.
// Ce banc charge le code RÉEL de crm/v2/v2-boot.js (périmètre, garde d'accès) avec de faux jeux de données :
//   - périmètre « alias » : 31 CIP de GRP_DEPART, 7 clientes, 24 non clientes lues dans PHARMA_FR ;
//   - sans PHARMA_FR : « CIP … » puis complété quand la base arrive, jamais de nom inventé ;
//   - OPSO inchangé : même sortie que le code d'avant l'étape 4 (commit 6965a3c98) sur le même listing ;
//   - accesGroupement() lit la bonne liste (Emmanuel absent d'Essentiels, claude-test présent) ;
//   - les textes « OPSO » des modules communs restent identiques chez OPSO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import vm from 'node:vm';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const BOOT = lire('crm/v2/v2-boot.js');

function tranche(src, debut, fin) {
  const a = src.indexOf(debut), b = src.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'structure de v2-boot.js inattendue : ' + debut);
  return src.slice(a, b);
}
// Périmètre (nouveau code) : de l'en-tête de V2.appliquerPerimetreGroupement jusqu'à V2.mapOfficines.
const PERIM = tranche(BOOT, '  V2.appliquerPerimetreGroupement = function', '  // 11/09/2026 (phase 5)');

const CIP31 = Object.keys(vm.runInNewContext('var window = {}; ' + lire('crm/v2/groupement-alias.js').split('\n').filter(l => l.startsWith('window.GRP_DEPART')).join('\n') + '; window.GRP_DEPART'));
const AUTRES = ['9000001', '9000002'];

function monde({ pfr = true, ann = false, ensure = true } = {}) {
  const ctx = { console: { warn() {}, log() {} } }; ctx.window = ctx; vm.createContext(ctx);
  ctx.V2 = { pharmacies: [], sales: [], render() { ctx.rendus = (ctx.rendus || 0) + 1; } };
  const dep = {}; CIP31.forEach(c => { dep[c] = 'Essentiels Pharma'; }); AUTRES.forEach(c => { dep[c] = 'Un autre groupement'; });
  ctx.GRP_DEPART = dep;
  ctx.GRP_OVR = { [CIP31[0]]: 'Un autre groupement' };   // ne doit PAS être lu (liste officielle du 27/11 : 31)
  ctx.V2_GROUPEMENT = JSON.parse(JSON.stringify({ id: 'essentiels', libelle: 'ESSENTIELS PHARMA', perimetre: { source: 'alias', valeur: 'Essentiels Pharma' } }));
  // 7 clientes du groupement (ids CRM sans rapport avec le CIP) + 3 clientes d'autres groupements
  ctx.V2.pharmacies = CIP31.slice(0, 7).map((c, i) => ({ id: 'C' + i, name: 'CLIENTE ' + i, code: c, ville: 'V' + i, cp: '1000' + i, tel: '01', color: '#123456', potentiel: 5 }))
    .concat(['8000001', '8000002', '8000003'].map((c, i) => ({ id: 'X' + i, name: 'AUTRE ' + i, code: c })));
  ctx.V2.sales = [].concat(...CIP31.slice(0, 7).map((c, i) => [{ pharmacyId: 'C' + i, mntNetHt: 10 }, { pharmacyId: 'C' + i, mntNetHt: 5 }]),
    ['X0', 'X1', 'X2'].map(id => ({ pharmacyId: id, mntNetHt: 99 })));
  const pfrData = () => ({ p: CIP31.map((c, i) => {
    const p = []; p[6] = 'PHARMACIE DU PORT ' + i; p[7] = 'SAINT MALO'; p[8] = '350' + i; p[9] = '020000000' + i;
    if (ann) { p[13] = 'ID-CRM-' + i; p._ann = c; } else p[13] = c;
    return p;
  }) });
  if (pfr) ctx.PHARMA_FR = pfrData();
  if (ensure) ctx.V2.ensurePharmaFr = cb => { ctx.PHARMA_FR = pfrData(); cb(); };
  vm.runInContext(PERIM, ctx);
  return ctx;
}
// Sortie du contexte vm recopiée dans le monde de l'hôte (sinon deepEqual voit des prototypes différents).
const dehors = (ctx, expr) => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', ctx));
const lignes = ctx => dehors(ctx, 'V2.pharmacies');

test('alias : 31 lignes, 7 clientes, noms des 24 autres lus dans PHARMA_FR, ventes hors périmètre retirées', () => {
  assert.equal(CIP31.length, 31);
  const ctx = monde();
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx);
  const L = lignes(ctx);
  assert.equal(L.length, 31);
  assert.equal(L.filter(l => l.inDb).length, 7);
  const nonCl = L.filter(l => !l.inDb);
  assert.equal(nonCl.length, 24);
  for (const l of nonCl) { assert.match(l.name, /^Pharmacie du Port \d+$/); assert.equal(l.ville, 'Saint Malo'); assert.ok(l.cp && l.tel); assert.ok(l.id.startsWith('LST-')); assert.notEqual(l.nomProvisoire, true); }
  for (const l of L) { assert.equal(l.groupement, 'ESSENTIELS PHARMA'); assert.equal(l.hasStats, false); assert.equal(l.debut, ''); assert.equal(l.perimetre, ''); }
  assert.deepEqual(L.slice(0, 7).map(l => l.id), ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']);   // id CRM gardé
  const ventes = dehors(ctx, 'V2.sales');
  assert.equal(ventes.length, 14);   // les 3 clientes d'autres groupements n'y sont plus
  assert.ok(ventes.every(s => /^C\d$/.test(s.pharmacyId)));
  assert.equal(CIP31[0] in ctx.GRP_DEPART, true);   // GRP_OVR (qui retire un CIP) n'est pas lu : toujours 31
});

test('alias : V2.applyOpsoPerimeter est le même objet que V2.appliquerPerimetreGroupement', () => {
  const ctx = monde();
  assert.equal(vm.runInContext('V2.applyOpsoPerimeter === V2.appliquerPerimetreGroupement', ctx), true);
});

test('alias : la base nationale peut avoir remplacé p[13] par l\'id du CRM (ancien dans p._ann)', () => {
  const ctx = monde({ ann: true });
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx);
  assert.equal(lignes(ctx).filter(l => /^Pharmacie du Port/.test(l.name)).length, 24);
});

test('alias sans PHARMA_FR : « CIP … » provisoire, puis complété et redessiné ; jamais de nom inventé', () => {
  const ctx = monde({ pfr: false, ensure: false });
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx);
  let L = lignes(ctx);
  const nonCl = L.filter(l => !l.inDb);
  assert.equal(nonCl.length, 24);
  assert.ok(nonCl.every(l => l.name === 'CIP ' + l.code && l.nomProvisoire === true));
  // la base arrive plus tard
  const ctx2 = monde({ pfr: false });
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx2);
  L = lignes(ctx2);
  assert.equal(L.filter(l => !l.inDb && /^Pharmacie du Port/.test(l.name)).length, 24);
  assert.equal(ctx2.rendus, 1);
  // un CIP absent de la base reste « CIP … »
  const ctx3 = monde({ pfr: false, ensure: false });
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx3);
  ctx3.PHARMA_FR = { p: [] };
  assert.equal(vm.runInContext('V2.perimetreCompleterNoms()', ctx3), 0);
  assert.ok(lignes(ctx3).filter(l => !l.inDb).every(l => l.name === 'CIP ' + l.code));
});

test('alias sans GRP_DEPART : périmètre vide, jamais les 691 clientes', () => {
  const ctx = monde(); ctx.GRP_DEPART = undefined;
  vm.runInContext('V2.appliquerPerimetreGroupement();', ctx);
  assert.equal(lignes(ctx).length, 0);
});

// OPSO : même sortie que le code d'avant l'étape 4.
function sortieOpso(codeFonction) {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  ctx.V2 = { AN0: 2026, pharmacies: [{ id: 'A1', name: 'PHARMA UN', code: '0012345', ville: 'ROUEN', cp: '76000', tel: '1', color: '#abcdef', potentiel: 3 }, { id: 'A2', name: 'AUTRE', code: '777' }],
    sales: [{ pharmacyId: 'A1', month: 3, year: 2026, mntNetHt: 5 }, { pharmacyId: 'A2', month: 3, year: 2026, mntNetHt: 7 }, { pharmacyId: 'LST-555', month: 1, year: 2026, mntNetHt: 1 }] };
  ctx.OPSO_LISTING_2026 = [{ cip: '12345', nom: 'Pharma Un', ville: 'Rouen', cp: '76000', tel: '02', perimetre: 'NP', debut: '2026-02' }, { cip: '555', nom: 'Nouvelle', ville: 'Caen', cp: '14000', perimetre: 'BP', debut: '2026-02' }, { cip: '999', nom: 'Sans achat', ville: 'Lille' }];
  ctx.OPSO_STATS_SALES = [{ cip: '555', artDesignation: 'X', artCode: '1', qte: 4, puBrut: 1, puNet: 1, mntNetHt: 8 }];
  ctx.V2_GROUPEMENT = { id: 'opso', nom: 'OPSO Santé', court: 'OPSO', acces: 'opso', jeuVentes: 'OPSO', conditionsVisibles: false };
  vm.runInContext(codeFonction + '\nV2.applyOpsoPerimeter();', ctx);
  return vm.runInContext('JSON.stringify({p:V2.pharmacies,s:V2.sales})', ctx);
}
test('OPSO inchangé : même listing → même sortie que le code d\'avant (6965a3c98)', t => {
  let avant;
  try { avant = execSync('git show 6965a3c98:crm/v2/v2-boot.js', { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 }); }
  catch (e) { t.skip('commit 6965a3c98 absent de ce clone'); return; }
  const ancien = tranche(avant, '  V2.applyOpsoPerimeter = function', '  // 11/09/2026 (phase 5)');
  const a = sortieOpso(ancien), n = sortieOpso(PERIM);
  assert.equal(n, a);
  assert.equal(JSON.parse(n).p.length, 3);
});

// Garde d'accès.
function acces(reglage, email) {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext('var V2 = {};', ctx);
  vm.runInContext(lire('crm/v2/v2-comptes.js'), ctx);
  vm.runInContext(lire('groupements/config/' + reglage + '.js'), ctx);
  vm.runInContext(tranche(BOOT, '  var COMPTES = window.V2_COMPTES', '  V2.estCommEscale'), ctx);
  ctx.email = email;
  return vm.runInContext('V2.accesGroupement().indexOf(email) >= 0', ctx);
}
test('accesGroupement : Essentiels = 3 comptes + Arthur (27/11) + claude-test, Emmanuel absent ; OPSO inverse', () => {
  for (const m of ['william.morel@me.com', 'pascale.prieto@integralpharma.fr', 'alexandre.morel@me.com', 'arthur.lehouerou@integralpharma.fr', 'claude-test@integralpharma.fr']) assert.equal(acces('essentiels', m), true, m);
  for (const m of ['emmanuel.noblanc@normandiepharma.fr', 'guy.bourdon@integralpharma.fr', 'pauline.guillaumin@integralpharma.fr']) assert.equal(acces('essentiels', m), false, m);
  assert.equal(acces('opso', 'emmanuel.noblanc@normandiepharma.fr'), true);
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('crm/v2/v2-comptes.js'), ctx);
  // Alexandre consulte seulement (correction de Will du 26/11) : accès à l'app, mais pas dans les contacts groupement.
  // 27/11/2026 : Pauline Guillaumin suit OPSO depuis JARVIS (même accès qu'Arthur et Guy) : dans les contacts et dans la liste OPSO, pas dans celle d'Essentiels.
  // 27/11/2026 (suite) : Arthur Le Houerou suit OPSO et Essentiels Pharma depuis son JARVIS.
  assert.deepEqual(dehors(ctx, 'V2_COMPTES.contactsGroupement'), ['william.morel@me.com', 'pascale.prieto@integralpharma.fr', 'pauline.guillaumin@integralpharma.fr', 'arthur.lehouerou@integralpharma.fr']);
});

test('menu « Suivi des groupements » : chaque lien porte sa liste d’accès ; Pauline G. ne voit que OPSO, Will et Pascale les deux', () => {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('crm/v2/v2-comptes.js'), ctx);
  const C = dehors(ctx, 'V2_COMPTES'), app = lire('crm/v2/v2-app.js');
  const apps = [['essentiels', 'Essentiels Pharma'], ['opso', 'OPSO']];
  for (const [acces, nom] of apps) assert.match(app, new RegExp("nom: '" + nom + "', url: '[^']+', acces: '" + acces + "'"));
  assert.match(app, /var apps = groupementsVisibles\(mail\);/); assert.match(app, /!apps\.length/);
  const vus = m => apps.filter(([a]) => C[a].includes(m)).map(([, n]) => n);
  assert.deepEqual(vus('pauline.guillaumin@integralpharma.fr'), ['OPSO']);
  assert.deepEqual(vus('arthur.lehouerou@integralpharma.fr'), ['Essentiels Pharma', 'OPSO']);
  assert.ok(C.contactsGroupement.includes('arthur.lehouerou@integralpharma.fr'), 'Arthur a l’entrée de menu');
  assert.deepEqual(vus('william.morel@me.com'), ['Essentiels Pharma', 'OPSO']); assert.deepEqual(vus('pascale.prieto@integralpharma.fr'), ['Essentiels Pharma', 'OPSO']);
  assert.deepEqual(vus('manon.dussurgey@integralpharma.fr'), [], 'pas dans les contacts groupement : aucune entrée de menu');
});

test('équipe CPR : 5 comptes, tous dans « tournees » (case d’accueil) et « tourneesCpr » (établissement par défaut)', () => {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('crm/v2/v2-comptes.js'), ctx);
  const C = dehors(ctx, 'V2_COMPTES');
  assert.equal(C.tourneesCpr.length, 5);
  for (const m of C.tourneesCpr) assert.ok(C.tournees.includes(m), m);
  assert.ok(!C.tourneesCpr.includes('william.morel@me.com'), 'Will reste sur OPS par défaut');
  assert.ok(C.opso.includes('pauline.guillaumin@integralpharma.fr'));
});

test('réglage Essentiels : jeu de ventes ESSENTIELS (comptes restreints seulement), conditions visibles, aucun drapeau OPSO', () => {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('groupements/config/essentiels.js'), ctx);
  const g = dehors(ctx, 'V2_GROUPEMENT');
  assert.deepEqual([g.id, g.nom, g.court, g.libelle, g.acces, g.jeuVentes, g.conditionsVisibles], ['essentiels', 'Essentiels Pharma', 'Essentiels', 'ESSENTIELS PHARMA', 'essentiels', 'ESSENTIELS', true]);
  assert.deepEqual(g.perimetre, { source: 'alias', valeur: 'Essentiels Pharma' });
  assert.doesNotMatch(lire('essentiels/v2/index.html').split('\n').filter(l => l.includes('window.V2_BRAND =')).join(''), /opso\s*:/);
});

test('textes « OPSO » des modules communs : identiques chez OPSO, au nom du groupement chez Essentiels', () => {
  const app = lire('crm/v2/v2-app.js'), pil = lire('crm/v2/v2-pilotage.js');
  const exp = reglage => {
    const V2 = {}; if (reglage) { const c = {}; c.window = c; vm.createContext(c); vm.runInContext(lire('groupements/config/' + reglage + '.js'), c); V2.groupement = c.V2_GROUPEMENT; }
    return V2;
  };
  const nom = V2 => (V2.groupement && V2.groupement.nom) || 'OPSO Santé';
  assert.equal(nom(exp(null)), 'OPSO Santé');     // banc sans v2-boot.js : repli = texte d'avant
  assert.equal(nom(exp('opso')), 'OPSO Santé');   // OPSO : même chaîne à l'octet
  assert.equal(nom(exp('essentiels')), 'Essentiels Pharma');
  // les expressions de repli sont bien dans le code
  assert.ok(app.includes("(V2.groupement && V2.groupement.nom) || 'OPSO Santé'"));
  assert.ok(app.includes("(V2.groupement && V2.groupement.court) || 'OPSO'"));
  assert.ok(pil.includes("(V2.groupement && V2.groupement.nom) || 'OPSO Santé'"));
  // et les anciens littéraux visibles ont disparu des deux fichiers
  assert.ok(!app.includes("'Le tableau de bord OPSO Santé :"));
  assert.ok(!pil.includes("'Groupement OPSO Santé</div>'"));
});

// Accueil dessiné avant les ventes : V2.mapOfficines ne rend que le périmètre en mode alias ; inchangé ailleurs.
test('mapOfficines : bornée au périmètre chez Essentiels, intacte chez JARVIS et OPSO', () => {
  const code = tranche(BOOT, '  V2.mapOfficines = function', '  // ── Périmètre ESCALE PHARMA');
  const ofs = CIP31.slice(0, 7).map((c, i) => ({ id: c, name: 'E' + i, code: c })).concat(['8000001', '8000002', '8000003'].map((c, i) => ({ id: c, name: 'X' + i, code: c })));
  const nb = reglage => {
    const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
    ctx.V2 = {}; ctx.WML_OFFICINES = ofs; ctx.GRP_DEPART = { [CIP31[0]]: 'Essentiels Pharma' };
    CIP31.slice(1).forEach(c => { ctx.GRP_DEPART[c] = 'Essentiels Pharma'; });
    if (reglage) ctx.V2_GROUPEMENT = reglage;
    vm.runInContext(code, ctx);
    return vm.runInContext('V2.mapOfficines().length', ctx);
  };
  assert.equal(nb({ id: 'essentiels', perimetre: { source: 'alias', valeur: 'Essentiels Pharma' } }), 7);
  assert.equal(nb(null), 10);                                   // JARVIS
  assert.equal(nb({ id: 'opso', jeuVentes: 'OPSO' }), 10);      // OPSO (périmètre posé plus tard par le listing)
});

// 26/11/2026 — revue de sécurité : Supabase vient de la copie figée du dépôt (comme crm/v2 et phirst/v2), jamais d'un site externe sans version fixe.
// Même règle pour OPSO depuis le 26/11/2026 (choix cliqué de Will, à la mise en ligne de l'étape 6).
for (const app of ['essentiels', 'opso']) {
  test(app + ' charge Supabase depuis la copie figée du dépôt, et elle existe', () => {
    const html = lire(app + '/v2/index.html');
    assert.ok(!/cdn\.jsdelivr\.net\/npm\/@supabase/.test(html), 'Supabase chargé depuis un site externe');
    const m = /<script src="(\.\.\/\.\.\/crm\/v2\/vendor\/supabase\/supabase-[\d.]+\.min\.js)\?v=/.exec(html);
    assert.ok(m, 'copie figée de Supabase absente');
    readFileSync(new URL('../' + app + '/v2/' + m[1], import.meta.url));
  });
}
