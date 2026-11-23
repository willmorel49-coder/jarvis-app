/* offre-labo-inscription.test.mjs — le prix d'offre Sanofi / UPSA ne part que chez les officines inscrites.
 *
 * Remontée d'Inès (18/11/2026) : « il met l'offre Sanofi sur toutes les fiches même s'ils ne sont pas
 * encodés ». V2.bestPrice ignorait l'officine : le prix d'offre et l'étiquette « OFFRE » partaient
 * chez toutes, dans les listes de la fiche et le PDF / Excel de « Transmettre ».
 * Règle choisie par Will (23/11/2026) : l'offre ne s'écarte QUE pour une officine cliente présente au
 * fichier d'inscription et non inscrite à ce labo ; absente du fichier, prospect, ou sans officine :
 * l'offre reste.
 *
 * Le bloc testé est celui de v2-boot.js, tel qu'il est livré. Données entièrement fictives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOT = readFileSync(join(RACINE, 'crm', 'v2', 'v2-boot.js'), 'utf8');
const PHARMA = readFileSync(join(RACINE, 'crm', 'v2', 'v2-pharma.js'), 'utf8');

// Produits fictifs : CIP13 réel = « 34009 » + CIP7 + clé ; la liste des offres porte le CIP13 approché « 3400 » + CIP7 + « 0 ».
const SAN = { cip13: '3400911111118', designation: 'PRODUIT S', prix_ht: 2, prix_ip: 1.9, offre_ip: 1.6 };
const UPS = { cip13: '3400922222226', designation: 'PRODUIT U', prix_ht: 2, prix_ip: 1.9, offre_ip: 1.5 };
const AUTRE = { cip13: '3400933333334', designation: 'PRODUIT A', prix_ht: 2, prix_ip: 1.9, offre_ip: 1.7 };

function monde({ offres = true, inscriptions = true } = {}) {
  const sb = {};
  sb.window = sb; vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  if (offres) {
    sb.MARKETING_IP_OFFERS = [
      { id: 'ip_sanofi', products: [{ cip13: '340011111110' }] },
      { id: 'ip_upsa', products: [{ cip13: '340022222220', ean: '340022222220' }] },
      { id: 'ip_vaccins', products: [{ cip13: '340033333330' }] },
    ];
  }
  if (inscriptions) sb.WML_OFF_CA = { off: { b: { 10: [0, 0], 11: [1, 0], 12: [2, 0], 13: [3, 0], 99: [0, 0] } } };
  sb.V2.pharmacies = [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }];   // 99 : au fichier mais pas cliente (prospect)
  const a = BOOT.indexOf("  // ── L'offre d'un labo vaut-elle pour CETTE officine ?");
  const b = BOOT.indexOf('  // ── Couleur « bon / à surveiller / faible »');
  assert.ok(a > 0 && b > a, 'bloc offreAdmise + bestPrice introuvable dans v2-boot.js');
  vm.runInContext(BOOT.slice(a, b), sb);
  return sb.V2;
}

test("officine non inscrite (code 0) : ni prix d'offre ni « OFFRE » sur Sanofi et UPSA", () => {
  const V2 = monde();
  for (const p of [SAN, UPS]) {
    const r = V2.bestPrice(p, '10');
    assert.equal(r.offre, false, p.designation);
    assert.equal(r.ip, 1.9, p.designation + ' : prix net habituel');
  }
});

test('inscrite Sanofi seul (1) : Sanofi garde son offre, UPSA non', () => {
  const V2 = monde();
  assert.deepEqual([V2.bestPrice(SAN, 11).offre, V2.bestPrice(SAN, 11).ip], [true, 1.6]);
  assert.deepEqual([V2.bestPrice(UPS, 11).offre, V2.bestPrice(UPS, 11).ip], [false, 1.9]);
});

test('inscrite UPSA seul (2) : UPSA garde son offre, Sanofi non', () => {
  const V2 = monde();
  assert.equal(V2.bestPrice(UPS, '12').offre, true);
  assert.equal(V2.bestPrice(SAN, '12').offre, false);
});

test('inscrite aux deux (3) : les deux offres restent', () => {
  const V2 = monde();
  assert.equal(V2.bestPrice(SAN, '13').offre, true);
  assert.equal(V2.bestPrice(UPS, '13').offre, true);
});

test("cliente absente du fichier, prospect, sans officine : l'offre reste (choix de Will)", () => {
  const V2 = monde();
  assert.equal(V2.bestPrice(SAN, '14').offre, true, 'cliente absente du fichier');
  assert.equal(V2.bestPrice(SAN, '99').offre, true, 'au fichier mais pas cliente : prospect');
  assert.equal(V2.bestPrice(SAN, '777').offre, true, 'prospect inconnu');
  assert.equal(V2.bestPrice(SAN).offre, true, 'sans officine : prix du catalogue');
  assert.equal(V2.bestPrice(SAN, '').offre, true, 'officine vide');
});

test("produit d'une autre offre (vaccins) : jamais touché par l'inscription Sanofi / UPSA", () => {
  const V2 = monde();
  assert.equal(V2.bestPrice(AUTRE, '10').offre, true);
});

test("fichiers absents (offres ou inscriptions pas encore chargées) : comportement d'avant", () => {
  assert.equal(monde({ offres: false }).bestPrice(SAN, '10').offre, true);
  assert.equal(monde({ inscriptions: false }).bestPrice(SAN, '10').offre, true);
});

test('les garde-fous de l\'offre restent : au-dessus du PPHT ou sous la moitié, offre ignorée', () => {
  const V2 = monde();
  assert.equal(V2.bestPrice({ ...SAN, offre_ip: 2.5 }, '13').offre, false);
  assert.equal(V2.bestPrice({ ...SAN, offre_ip: 0.5 }, '13').offre, false);
  assert.equal(V2.bestPrice({ ...SAN, offre_ip: 1.95 }, '13').offre, false, 'ne bat pas le net habituel');
});

test("v2-pharma.js : les listes de la fiche et du PDF / Excel passent l'officine au prix", () => {
  const corps = (nom) => { const i = PHARMA.indexOf('function ' + nom + '('); assert.ok(i > 0, nom); return PHARMA.slice(i, PHARMA.indexOf('\n  }\n', i)); };
  for (const f of ['buildOpportunities', 'buildNetworkReco', 'grpBestRotations', 'gainYear']) {
    assert.match(corps(f), /V2\.bestPrice\(b, pid\)/, f);
    assert.doesNotMatch(corps(f), /V2\.bestPrice\(b\)/, f);
  }
  assert.match(corps('buildNetworkReco'), /gainYear\(b, pid\)/);
  // buildRecoCats : le prix suit l'officine destinataire quand elle est donnée, sinon `pid`
  assert.match(corps('buildRecoCats'), /V2\.bestPrice\(b, pidOffre != null && pidOffre !== '' \? pidOffre : pid\)/);
  assert.doesNotMatch(corps('buildRecoCats'), /V2\.bestPrice\(b\)/);
});

test('mallette : les listings « réseau » et « groupement » envoyés à une officine suivent SON inscription', () => {
  const corps = (nom) => { const i = PHARMA.indexOf('function ' + nom + '('); assert.ok(i > 0, nom); return PHARMA.slice(i, PHARMA.indexOf('\n  }\n', i)); };
  assert.match(corps('groupementProducts'), /productsForIds\(ids, 'GRP:' \+ grpName, pidOffre, deuxPrix\)/);
  assert.match(corps('productsForIds'), /V2\.bestPrice\(b, pidOffre\)/);
  const i = PHARMA.indexOf('listing: function (kind, o)'); assert.ok(i > 0, 'pont.listing');
  const pont = PHARMA.slice(i, PHARMA.indexOf('V2.pharmaPont.charger()', i));
  assert.match(pont, /groupementProducts\(o\.grp, o\.pid\)/);
  assert.match(pont, /buildRecoCats\('__mallette__', 'reseau', o\.pid\)/);
  assert.doesNotMatch(pont, /groupementProducts\(o\.grp\)|buildRecoCats\('__mallette__', 'reseau'\)/);
});

// ── Listes faites SANS officine (page d'un groupement, liste enregistrée, leurs PDF et Excel) ──
// Choix de Will (23/11/2026, question cliquée « Les deux prix ») : le prix normal pour tous, et à côté
// « 0,78 € avec l'offre Sanofi (officines inscrites) ». Les prospects gardent l'offre.

test('prix normal sur demande (sansOffre) et nom du labo de l\'offre', () => {
  const V2 = monde();
  assert.deepEqual([V2.bestPrice(SAN, null, true).offre, V2.bestPrice(SAN, null, true).ip], [false, 1.9]);
  assert.deepEqual([V2.bestPrice(UPS, undefined, true).offre, V2.bestPrice(UPS, undefined, true).ip], [false, 1.9]);
  assert.equal(V2.bestPrice(SAN, null, true).remise, 5, 'abandon de marge calculé sur le prix normal');
  assert.equal(V2.bestPrice(SAN).ip, 1.6, 'sans le 3e argument : rien ne change');
  assert.equal(V2.laboOffre(SAN), 'Sanofi');
  assert.equal(V2.laboOffre(UPS), 'UPSA');
  assert.equal(V2.laboOffre(AUTRE), '', 'autre offre : pas d\'inscription, pas de mention');
  assert.equal(monde({ offres: false }).laboOffre(SAN), '', 'liste des offres pas chargée : pas de mention');
});

test('la phrase de la mention est celle choisie par Will', () => {
  const i = PHARMA.indexOf('function mentionOffre('); assert.ok(i > 0, 'mentionOffre');
  const sb = {}; vm.createContext(sb); vm.runInContext(PHARMA.slice(i, PHARMA.indexOf('\n', i)), sb);
  const eur = (v) => v.toFixed(2).replace('.', ',') + ' €';
  assert.equal(sb.mentionOffre({ offre_prix: 0.78, offre_labo: 'Sanofi' }, eur), '0,78 € avec l’offre Sanofi (officines inscrites)');
  assert.equal(sb.mentionOffre({ offre_prix: 1.19, offre_labo: 'UPSA' }, eur), '1,19 € avec l’offre UPSA (officines inscrites)');
});

test('v2-pharma.js : les listes sans officine demandent les deux prix, les prospects non', () => {
  const corps = (nom) => { const i = PHARMA.indexOf('function ' + nom + '('); assert.ok(i > 0, nom); return PHARMA.slice(i, PHARMA.indexOf('\n  }\n', i)); };
  const pfi = corps('productsForIds');
  assert.match(pfi, /if \(deuxPrix && bp\.offre && \(lab = V2\.laboOffre\(b\)\)\) \{ pOffre = bp\.ip; bp = V2\.bestPrice\(b, pidOffre, true\); \}/);
  assert.match(pfi, /offre_prix: pOffre, offre_labo: pOffre \? lab : ''/);
  assert.match(corps('renderGroupementDetail'), /groupementProducts\(grpName, null, true\)/);
  assert.match(corps('renderListeDetail'), /productsForIds\(ids, 'LST:' \+ id, null, true\)/);
  const fn = (nom) => { const i = PHARMA.indexOf(nom + ' = function'); assert.ok(i > 0, nom); return PHARMA.slice(i, PHARMA.indexOf('\n  };\n', i)); };
  assert.match(fn('V2.grpDownloadPdf'), /achatsPdf\(grpName, groupementProducts\(grpName, null, true\)/);
  assert.match(fn('V2.listDownloadPdf'), /productsForIds\(listIdsObj\(l\), 'LST:' \+ id, null, true\)/);
  assert.match(fn('V2.grpDownloadXlsx'), /achatsXlsx\(grpName, groupementProducts\(grpName, null, true\)/);
  assert.match(fn('V2.listDownloadXlsx'), /productsForIds\(listIdsObj\(l\), 'LST:' \+ id, null, true\)/);
  // prospects (Transmettre) : l'offre reste — aucun « deux prix »
  for (const f of ['V2.pharmaListPdf', 'V2.pharmaListXlsx']) {
    assert.match(fn(f), /groupementProducts\(tx\.grp\)/, f);
    assert.doesNotMatch(fn(f), /groupementProducts\(tx\.grp, null, true\)/, f);
  }
  // l'écran, le PDF et l'Excel montrent la mention ; le sélecteur « Ajouter un produit » aussi
  assert.match(corps('renderGrpCatCard'), /r\.offre_prix \? '<span class="ph-offre-avec">' \+ esc\(mentionOffre\(r, V2\.fmtEur\)\)/);
  assert.match(corps('achatsPdf'), /r\.offre_prix \? '<div [^>]*>' \+ esc\(mentionOffre\(r, e2\)\)/);
  assert.match(corps('achatsXlsx'), /head\.push\('Offre labo'\)/);
  assert.match(corps('refreshProdList'), /bp = V2\.bestPrice\(b, null, true\)/);
});
