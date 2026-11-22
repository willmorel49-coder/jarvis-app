// CERP et Paraph sur l'écran Offilog (29/10/2026) :
// 1) règle de récence CERP, calculée depuis la date du fichier (jamais une date en dur) ;
// 2) bloc « Prix d'achat » trié du moins cher au plus cher, Offilog en référence ;
// 3) côté OPSO : rien affiché ET les deux fichiers protégés ne sont même pas demandés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');
const BOOT = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-boot.js'), 'utf8');
const COLS_C = ['code13', 'libelle', 'ppht', 'net', 'remise', 'qtes', 'paliers', 'periode', 'page', 'famille', 'document'];
const COLS_G = ['code', 'libelle', 'groupement', 'annee', 'prix', 'remise', 'net', 'qte', 'periode', 'document'];
const ligneC = (code, ppht, net, qtes, periode) => [code, '210 869 3 LIBELLE SECRET', ppht, net, 0, qtes, '', periode, '1', 'Central Prom', 'x.pdf'];
const CAT = 'paraph/CATALOGUE-CENTRALE-PARAPH-1ERE-EDITION-2025.pdf';
const ligneG = (code, prix, net, doc = CAT, g = 'Paraph') => [code, '', g, 2025, prix, 10, net, null, '', doc];

function rendre({ opso = false, cerp, groupements, prixOffilog = 10, extra = {}, selection = true, avance = false, apres = null }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const doc = { currentScript: null, head: fauxEl(), body: fauxEl(), createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const demandes = [];
  const V2 = new Proxy({
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: (k) => { demandes.push(...k); return Promise.resolve(); }, render: noop, pages: {},
  }, { get: (t, k) => (k in t ? t[k] : () => ''), set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    V2_BRAND: opso ? { opso: true } : undefined,
    OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '3000000000001', img: '', cat: 'sante', url: '', price: prixOffilog }],
    CONCURRENTS_CERP: cerp, CONCURRENTS_GROUPEMENTS: groupements,
    OFFILOG: [], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
    ...extra,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  // 22/11/2026, v3 : les dates de la fiche se lisent en mots (« 4 juin ») avec la vraie V2.dateEnMots de v2-boot.js, pas avec un faux.
  vm.runInContext(BOOT.slice(BOOT.indexOf('V2.dateEnMots = function'), BOOT.indexOf('  V2.bestPrice = function')), ctx);
  vm.runInContext(SRC, ctx);
  // 06/11/2026 : l'arrivée montre les trois portes ; les cartes se lisent dans la liste, ouverte ici par le tri par défaut.
  win.V2.offSort('ventes');
  if (selection) win.V2.offSelect('1');
  if (avance) win.V2.offToggleAdv();
  if (apres) apres(win.V2);
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return { html: root.innerHTML, demandes };
}
const E1 = '3000000000001';
// 22/11/2026, v3 « Les trois onglets » : la carte n'a qu'UNE ligne concurrent ; le détail de tous les concurrents vit dans la fiche du produit (volet).
const fiche = (html) => { const i = html.indexOf('id="off-achat"'); return i < 0 ? '' : html.slice(i); };
const ligne = (html, nom) => (fiche(html).match(new RegExp('<div class="olm-f-r[^"]*" data-achat="' + nom + '">.*?</div>')) || [''])[0];
const ordreFiche = (html) => [...fiche(html).matchAll(/data-achat="([^"]+)"/g)].map((m) => m[1]);
const ligneCarte = (html, k) => (html.match(new RegExp('<div class="olm-c-conc[^"]*" data-cmp="' + k + '".*?</div>')) || [''])[0];
const nbPhrase = (html) => Number((html.match(/olm-cmp-p[^>]*><b><span class="olm-num">(\d+)</) || [])[1]);   // le compte écrit dans la phrase de l'onglet Comparer
const cnt = (html, k) => Number((html.match(new RegExp('data-cmp-src="' + k + '"[^>]*><span>[^<]*</span><span class="cnt mono">(\\d+)<')) || [])[1]);
const comparer = (V2, sens) => { V2.offPorte('comparer'); V2.offCmpSens(sens || 'tous'); };
const cerpDe = (maj, lignes) => ({ maj, cols: COLS_C, rows: lignes });
const grpDe = (lignes) => ({ maj: '2026-09-28', cols: COLS_G, rows: lignes });

test('CERP : la plus récente gagne, à période égale le net le plus bas avec sa quantité', () => {
  // 22/11/2026, v3 : le prix CERP se lit dans la fiche (ligne « CERP », repère neutre), plus sur la carte. Même règle : la plus récente, puis le net le plus bas.
  const { html } = rendre({ cerp: cerpDe('2026-10-01', [
    ligneC(E1, 12, 8, 'dès 6', 'août 2026'),
    ligneC(E1, 12, 7, 'dès 6 · dès 12', 'octobre 2026'),
    ligneC(E1, 12, 6, 'dès 24', 'octobre 2026'),
    ligneC(E1, 12, 3, 'dès 1', 'août 2025'),
  ]) });
  const l = ligne(html, 'CERP');
  assert.match(l, /EUR6\.00/);
  assert.match(l, /offre octobre 2026 dès 24 unités/);
  assert.doesNotMatch(html, /CERP EUR|EUR[378]\.00/);
  assert.doesNotMatch(html, /LIBELLE SECRET|210 869 3/, 'le libellé CERP ne s\'affiche jamais');
});

test('CERP : seule une offre récente compte (août 2026 et après, ou tarif 2026) ; le seuil suit la date du fichier', () => {
  const cerpLigne = (maj, qte, periode) => ligne(rendre({ cerp: cerpDe(maj, [ligneC(E1, 12, 8, qte, periode)]) }).html, 'CERP');
  assert.equal(cerpLigne('2026-10-01', 'dès 2', 'juillet 2026'), '', 'juillet 2026 < août 2026 : trop ancien');
  assert.equal(cerpLigne('2026-10-01', 'dès 2', 'juillet-août 2026'), '', 'une période qui COMMENCE en juillet est trop ancienne');
  assert.match(cerpLigne('2026-10-01', 'dès 2', 'août 2026'), /offre août 2026 dès 2 unités/);
  assert.match(cerpLigne('2026-10-01', 'dès 2', 'août 2026'), /EUR8\.00/);
  assert.match(cerpLigne('2026-10-01', 'dès 1', 'tarif 2026'), /EUR8\.00/);
  // même ligne, fichier daté plus tard : août 2026 n'est plus récent (pas de date écrite en dur)
  assert.equal(cerpLigne('2027-02-01', 'dès 2', 'août 2026'), '');
  assert.match(cerpLigne('2027-02-01', 'dès 2', 'décembre 2026'), /EUR8\.00/);
});

test('Paraph : l\'année est dans l\'étiquette ; zéros de tête restitués ; seul le catalogue 2025 compte', () => {
  const { html } = rendre({ groupements: grpDe([ligneG('3000000000001', 15, 13.02), ligneG(E1, 9, 1, 'autre.pdf'), ligneG(E1, 9, 1, CAT, 'Aptiphar')]) });
  // 22/11/2026, v3 : l'année du catalogue est dans la ligne « Paraph » de la fiche (« catalogue 2025 »)
  assert.match(ligne(html, 'Paraph'), /catalogue 2025 · net HT.*EUR13\.02/);
  assert.doesNotMatch(html, /NaN|undefined/);
  const court = rendre({ groupements: grpDe([ligneG('3000000001', 15, 5)]), extra: { OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '0003000000001', img: '', cat: 'sante', url: '', price: 10 }] } });
  assert.match(ligne(court.html, 'Paraph'), /catalogue 2025.*EUR5\.00/, 'code à 10 chiffres restitué sur 13');
});

test('bloc « Prix d\'achat » : trié par écart, Offilog en référence, écart en € et en %', () => {
  // 22/11/2026, v3 : le bloc devient « Les concurrents » dans la fiche. Prix Offilog en tête (référence), puis les concurrents du plus favorable à nous (écart le plus bas)
  // au moins favorable ; CERP (repère neutre, sans écart) toujours en dernier.
  const { html } = rendre({
    cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]),
    groupements: grpDe([ligneG(E1, 15, 12.5)]),
    extra: { SAGITTA_PRIX: { [E1]: [9, 11, 20] }, SAGITTA_PRIX_MAJ: '2026-06-04' },
  });
  const bloc = fiche(html);
  assert.deepEqual(ordreFiche(html), ['Sagitta', 'Paraph', 'CERP']);
  assert.ok(bloc.indexOf('olm-f-r ref') > 0 && bloc.indexOf('olm-f-r ref') < bloc.indexOf('data-achat="Sagitta"'), 'Prix Offilog (référence) avant les concurrents');
  assert.match(bloc, /olm-f-r ref"><span class="olm-f-n"><b>Prix Offilog<\/b>.*?EUR10\.00/);
  // CERP (7,50 contre 10) : prix visible, mais aucun écart, aucune couleur « moins cher »
  const ligneCerp = ligne(html, 'CERP');
  assert.match(ligneCerp, /EUR7\.50/);
  assert.match(ligneCerp, /olm-f-r neutre/);
  assert.match(ligneCerp, /<span class="olm-f-e"><\/span><\/div>$/, 'la case d\'écart reste vide');
  assert.doesNotMatch(ligneCerp, /bas|−|\d %/);
  assert.match(ligne(html, 'Sagitta'), /−10 % · −EUR1\.00/);   // Sagitta 9 contre 10 : l'écart reste calculé pour les autres
  assert.match(ligne(html, 'Paraph'), /\+25 % · \+EUR2\.50/); // Paraph 12,50 contre 10
  assert.match(ligne(html, 'Sagitta'), /relevé du 4 juin/);
  // outil de mesure : sans aucune plateforme, pas de ligne concurrent
  const vide = rendre({});
  assert.deepEqual(ordreFiche(vide.html), []);
  assert.match(fiche(vide.html), /Aucun prix concurrent relevé/);
});

test('CERP : prix visible dans la fiche, mais aucun marquage « moins cher », aucun filtre, aucun compteur', () => {
  // 22/11/2026, v3 : la carte (une ligne concurrent) ne montre jamais CERP ; son prix vit dans la fiche. La règle : CERP ne marque rien « moins cher », n'est pas un concurrent comparable.
  const cerp = cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]);
  const f = rendre({ cerp }).html;
  assert.match(ligne(f, 'CERP'), /EUR7\.50/, 'le prix CERP reste affiché dans la fiche');
  const { html } = rendre({ cerp, selection: false });
  assert.doesNotMatch(html, /olm-c-conc[^"]*"[^>]*data-cmp="cerp"|olm-c-conc mono bas/, 'CERP est moins cher que 10 mais ne marque aucune carte');
  assert.match(html, /olm-c-aucun">Aucun prix concurrent relevé/, 'sans autre concurrent, la carte ne cite pas CERP');
  assert.doesNotMatch(html, /Moins cher chez|cerpcheaper/);
  const c = rendre({ cerp, selection: false, apres: (V2) => comparer(V2, 'moins') }).html;
  assert.doesNotMatch(c, /data-cmp-src="cerp"/, 'CERP ne figure pas dans « Comparer à »');
  assert.equal(nbPhrase(c), 0, 'CERP ne compte dans aucun « moins cher »');
  // contrôle de l'outil : Paraph, lui, reste un concurrent comparable, et sa ligne carte est marquée « moins cher que nous »
  const p = rendre({ groupements: grpDe([ligneG(E1, 8, 7)]), selection: false });
  assert.match(p.html, /olm-c-conc mono bas" data-cmp="paraph"/);
});

test('Comparer à : concurrents d\'achat et publics, comptes, sens et écart recalculés à la main', () => {
  const src = { groupements: grpDe([ligneG(E1, 15, 12.5)]), extra: { FARMALINE_PUB: { [E1]: 8 }, FARMALINE_PUB_MAJ: '2026-09-10', CITYPHARMA_PUB: { [E1]: 11.5 }, CITYPHARMA_PUB_MAJ: '2026-10-30', OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: E1, img: '', cat: 'sante', url: '', price: 10 }], OFFILOG: [{ ean: E1, prix_offilog: 9 }] }, selection: false };
  // 22/11/2026, v3 : « Comparer à » = onglet « Comparer nos prix » ; les comptes se lisent sur la rangée de concurrents et dans la phrase, pour le sens choisi.
  const base = rendre({ ...src, apres: (V2) => comparer(V2, 'tous') }).html;
  assert.equal(cnt(base, 'paraph'), 1);
  assert.equal(cnt(base, 'citypharma'), 1);
  const moinsBase = rendre({ ...src, apres: (V2) => comparer(V2, 'moins') }).html;
  assert.equal(nbPhrase(moinsBase), 1, 'au moins un concurrent moins cher : Farmaline 8 < achat IP 9');
  assert.equal(cnt(moinsBase, 'farmaline'), 1);
  assert.equal(cnt(moinsBase, 'citypharma'), 0);
  // concurrent choisi : Citypharma public TTC 11,50 face à notre achat IP 9,00 -> +2,50 € et +28 % (2,5/9 = 27,8)
  const choisi = rendre({ ...src, apres: (V2) => { comparer(V2, 'tous'); V2.offCmpSrc('citypharma'); } }).html;
  assert.match(ligneCarte(choisi, 'citypharma'), /prix public TTC EUR11\.50, face à EUR9\.00 \(notre prix d'achat\)/);
  assert.match(ligneCarte(choisi, 'citypharma'), /olm-c-cv">EUR11\.50<\/span>.*\+28 % · \+EUR2\.50</);
  const plus = rendre({ ...src, apres: (V2) => { comparer(V2, 'plus'); V2.offCmpSrc('citypharma'); } }).html;
  assert.equal(nbPhrase(plus), 1);
  const moins0 = rendre({ ...src, apres: (V2) => { comparer(V2, 'moins'); V2.offCmpSrc('citypharma'); } }).html;
  assert.equal(nbPhrase(moins0), 0);
  // un prix d'ACHAT se compare au prix Offilog : Paraph 12,50 contre 10 -> +2,50 € et +25 %
  const achat = rendre({ ...src, apres: (V2) => { comparer(V2, 'tous'); V2.offCmpSrc('paraph'); } }).html;
  assert.match(ligneCarte(achat, 'paraph'), /prix d'achat HT EUR12\.50, face à EUR10\.00 \(prix Offilog\)/);
  assert.match(ligneCarte(achat, 'paraph'), /olm-c-cv">EUR12\.50<\/span>.*\+25 % · \+EUR2\.50</);
  // sens « moins » avec Farmaline : seul le produit qui porte le prix passe, écart -1,00 € et -11 %
  const moins = rendre({ ...src, apres: (V2) => { comparer(V2, 'moins'); V2.offCmpSrc('farmaline'); } }).html;
  assert.match(ligneCarte(moins, 'farmaline'), /prix public TTC EUR8\.00, face à EUR9\.00/);
  assert.match(ligneCarte(moins, 'farmaline'), /olm-c-cv">EUR8\.00<\/span>.*−11 % · −EUR1\.00</);
  assert.equal((moins.match(/class="off-card /g) || []).length, 1, 'une seule carte reste');
});

test('Comparer à, OPSO : jamais « moins cher que nous », aucune source masquée, aucun prix sous le prix Offilog', () => {
  const extra = { FARMALINE_PUB: { [E1]: 8 }, CITYPHARMA_PUB: { [E1]: 12 }, CITYPHARMA_PUB_MAJ: '2026-10-30', FARMALINE_PUB_MAJ: '2026-09-10',
    SAGITTA_PRIX: { [E1]: [5, 6, 7] }, OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: E1, img: '', cat: 'sante', url: '', price: 10 }] };
  const o = rendre({ opso: true, extra, selection: false, groupements: grpDe([ligneG(E1, 8, 7)]), cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]) });
  assert.doesNotMatch(o.html, /data-cmp-sens="moins"|Moins cher que nous/);
  assert.match(o.html, /data-cmp-sens="plus"[^>]*>Plus cher que nous<span class="cnt">1</);
  assert.doesNotMatch(o.html, /data-cmp-src="(pz|sg|ocp|paraph|cerp)"/, 'sources masquées sur OPSO');
  assert.match(o.html, /data-cmp-src="citypharma"/);
  assert.doesNotMatch(o.html, /data-cmp-src="farmaline"/, 'Farmaline à 8 < 10 : masqué, donc source absente');
  // même en forçant le sens « moins » par le code, OPSO retombe sur « Tous » et n'affiche rien sous le prix Offilog
  const f = rendre({ opso: true, extra, selection: false, apres: (V2) => { V2.offCmpSrc('citypharma'); V2.offCmpSens('moins'); } });
  assert.doesNotMatch(f.html, /Farmaline EUR8/);
  assert.match(f.html, /Citypharma public TTC EUR12\.00<\/span><span class="off-pcat-pill">\+EUR2\.00 · \+20 %</);
});

test('OPSO : ni CERP ni Paraph affichés, et les deux fichiers ne sont pas demandés', () => {
  const cerp = cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]);
  const groupements = grpDe([ligneG(E1, 15, 12.5)]);
  const o = rendre({ opso: true, cerp, groupements, prixOffilog: 20, selection: true });
  assert.doesNotMatch(o.html, /CERP|Paraph|off-achat/);
  assert.ok(!o.demandes.includes('conccerp') && !o.demandes.includes('concgroupements'), 'demandés : ' + o.demandes);
  const o2 = rendre({ opso: true, cerp: undefined, groupements: undefined, selection: false });
  assert.ok(!o2.demandes.includes('conccerp') && !o2.demandes.includes('concgroupements'));
  // contrôle de l'outil : côté CRM les mêmes données s'affichent et les fichiers sont demandés
  const c = rendre({ cerp: undefined, groupements: undefined, selection: false });
  assert.ok(c.demandes.includes('conccerp') && c.demandes.includes('concgroupements'), 'CRM : ' + c.demandes);
  const c2 = rendre({ cerp, groupements, prixOffilog: 20 });
  assert.match(ligne(c2.html, 'CERP'), /EUR7\.50/, 'CRM : le prix CERP est dans la fiche');
});

test('Comparer à, sans concurrent choisi : « plus / moins cher » = au moins un concurrent dans ce sens', () => {
  const E2 = '3000000000002', E3 = '3000000000003';
  const extra = {
    OFFILOG_BEST: [E1, E2, E3].map((e, i) => ({ rank: i + 1, id: String(i + 1), name: 'P' + i, brand: 'M', ean: e, img: '', cat: 'sante', url: '', price: 10 })),
    OFFILOG: [E1, E2, E3].map((e) => ({ ean: e, prix_offilog: 9 })),
    FARMALINE_PUB: { [E1]: 12 },        // plus cher que notre achat (9)
    CITYPHARMA_PUB: { [E2]: 8 },        // moins cher
    MAXIPARA_PUB: { [E2]: 15 },         // E2 : un moins cher ET un plus cher
  };
  // 22/11/2026, v3 : le compte de chaque sens s'écrit dans la phrase de l'onglet « Comparer nos prix » (plus de pastilles comptées par sens).
  const lu = (sens) => rendre({ extra, selection: false, apres: (V2) => comparer(V2, sens) }).html;
  const n = (sens) => { const h = lu(sens); assert.equal(cnt(h, 'tous'), nbPhrase(h), 'le compte du bouton « Tous les concurrents » et celui de la phrase sont les mêmes'); return nbPhrase(h); };
  assert.equal(n('moins'), 1);
  assert.equal(n('plus'), 2);    // E1 (Farmaline) et E2 (Maxi Para)
  // « Tous » = les produits qui ont au moins un prix concurrent : E3, sans aucun prix, n'y est plus (volontaire v3 : « N produits avec un prix relevé chez au moins un concurrent »)
  assert.equal(n('tous'), 2);
});

test('Sagitta : un produit connu seulement par son CIP13 a son prix sur tout l\'écran ; l\'EAN passe avant ; rien côté OPSO (18/11/2026)', () => {
  // 22/11/2026, v3 : la ligne concurrent de la carte (nom, prix, écart) et la fiche remplacent « Sagitta EUR9.00 » + pastille « win ».
  const cip = rendre({ selection: false, extra: { SAGITTA_PRIX: {}, SAGITTA_PRIX_CIP: { [E1]: 9 } } }).html;
  assert.match(ligneCarte(cip, 'sg'), /olm-c-cn">Sagitta<\/span><span class="olm-c-cv">EUR9\.00</, 'trouvé par le CIP13');
  assert.match(cip, /olm-c-conc mono bas" data-cmp="sg"/, '9 contre 10 : marqué moins cher que notre prix');
  const fi = rendre({ extra: { SAGITTA_PRIX: {}, SAGITTA_PRIX_CIP: { [E1]: 9 } } }).html;
  assert.match(ligne(fi, 'Sagitta'), /EUR9\.00/, 'présent aussi dans la fiche du produit');
  const lesDeux = rendre({ selection: false, extra: { SAGITTA_PRIX: { [E1]: [8, 10, 20] }, SAGITTA_PRIX_CIP: { [E1]: 9 } } }).html;
  assert.match(ligneCarte(lesDeux, 'sg'), /olm-c-cv">EUR8\.00</);
  assert.doesNotMatch(lesDeux, /EUR9\.00/, 'le prix par EAN (avec tarif et remise) passe avant');
  // contrôle de l'outil : sans entrée CIP, aucun prix Sagitta
  assert.doesNotMatch(rendre({ selection: false, extra: { SAGITTA_PRIX: {}, SAGITTA_PRIX_CIP: {} } }).html, /data-cmp="sg"/);
  assert.doesNotMatch(rendre({ opso: true, selection: false, extra: { SAGITTA_PRIX: {}, SAGITTA_PRIX_CIP: { [E1]: 9 } } }).html, /Sagitta EUR/, 'jamais côté OPSO');
});

test('Pharmazon : un produit relevé par son EAN est aussi trouvé par son CIP13 ; l\'EAN passe avant ; rien côté OPSO (18/11/2026)', () => {
  const pz = (lignes) => ({ PHARMAZON: lignes.map(([ean, cip, prix]) => ({ ean, cip, prix_final: prix, prix_catalogue: 0, labo: 'L', name: 'n' })) });
  // 22/11/2026, v3 : ligne concurrent de la carte (nom, prix, écart) à la place de « Pharmazon EUR9.00 » + pastille « win ».
  const parCip = rendre({ selection: false, extra: pz([['3700343900292', E1, 9]]) }).html;
  assert.match(ligneCarte(parCip, 'pz'), /olm-c-cn">Pharmazon<\/span><span class="olm-c-cv">EUR9\.00</, 'trouvé par le CIP13 de la fiche Pharmazon');
  assert.match(parCip, /olm-c-conc mono bas" data-cmp="pz"/, '9 contre 10 : marqué moins cher que notre prix');
  const lesDeux = rendre({ selection: false, extra: pz([['3700343900292', E1, 9], [E1, '', 8]]) }).html;
  assert.match(ligneCarte(lesDeux, 'pz'), /olm-c-cv">EUR8\.00</); assert.doesNotMatch(lesDeux, /EUR9\.00/, 'le produit relevé sous cet EAN passe avant');
  // contrôle de l'outil : sans CIP13 relevé, aucun prix Pharmazon
  assert.doesNotMatch(rendre({ selection: false, extra: pz([['3700343900292', '', 9]]) }).html, /data-cmp="pz"/);
  assert.doesNotMatch(rendre({ opso: true, selection: false, extra: pz([['3700343900292', E1, 9]]) }).html, /Pharmazon EUR/, 'jamais côté OPSO');
});
