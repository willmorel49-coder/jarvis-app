/* mkt-doc.test.mjs — « Créer un document » (v2-mkt-doc.js), 26/10/2026
 *
 * La logique pure de l'écran (bases, mode des prix → réglages de la fiche, prix saisi, CIP13) et le VRAI rendu : le code
 * de crm/v2/v2-mkt-modeles.js, v2-mkt.js et v2-mkt-doc.js est exécuté tel quel dans un contexte isolé (navigateur simulé),
 * sur les vraies données publiques (offres Sanofi/UPSA, catalogue du groupe). Les prix nets protégés ne sont PAS dans le
 * dépôt : le test pose des nets d'essai, qui n'ont rien de réel.
 * Ce qui ne s'imprime jamais : aucun « % » (hors dosage dans un nom), aucune règle de calcul, pas de PFHT, pas d'abandon de marge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const lireCrm = (f) => fs.readFileSync(new URL('../crm/' + f, import.meta.url), 'utf8');
const noop = () => {};

function monde() {
  const fenetre = { addEventListener: noop, requestAnimationFrame: noop, location: { hash: '' }, navigator: { platform: '', userAgent: '' }, MKT_IMG: {} };
  const V2 = { esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    fmtEur: (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €', fmtNum: String, pages: {}, produits: {} };
  const doc = { getElementById: () => null, createElement: () => ({ style: {}, setAttribute: noop }), head: { appendChild: noop },
    body: { classList: { add: noop, remove: noop } }, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = vm.createContext({ window: fenetre, document: doc, V2, console, navigator: fenetre.navigator,
    localStorage: { getItem: () => null, setItem: noop }, setTimeout, clearTimeout, setInterval, Date, Promise, JSON, Math });
  fenetre.V2 = V2; fenetre.window = fenetre;
  for (const f of ['v2-mkt-modeles.js', 'v2-mkt.js', 'v2-mkt-doc.js']) vm.runInContext(lire(f), ctx, { filename: f });
  // données publiques réelles
  vm.runInContext(lireCrm('marketing-offers.js'), ctx, { filename: 'marketing-offers.js' });
  vm.runInContext(lire('catalogue-groupe-data.js') + ';window.CATALOGUE_GROUPE = CATALOGUE_GROUPE;', ctx, { filename: 'catalogue-groupe-data.js' });
  return { fenetre, V2, ctx, P: V2.mktDoc._pur };
}
// Nets d'ESSAI (pas les vrais) : 0,28 de moins que le PPHT, pour que le test voie ce que le rendu laisserait échapper.
function poserNetsEssai(m) {
  for (const o of m.fenetre.MARKETING_IP_OFFERS) for (const p of o.products || []) if (p.ppht) p.prix_ip = Math.round((p.ppht - 0.28) * 100) / 100;
}
function etat(m, base, mode, produits) {
  return { base, titre: m.P.baseDe(base).titre, mode, produits };
}
function produitsOffre(m, id) { return m.fenetre.MARKETING_IP_OFFERS.find((o) => o.id === id).products.map((p) => m.P.produitOffre(p)); }
const texte = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ');
const compter = (s, re) => (s.match(re) || []).length;

test('mode des prix → réglages de la fiche, et retour', () => {
  const { P } = monde();
  assert.deepEqual({ ...P.reglagesPrix('ppht') }, { showPrice: true, showPpht: true });
  assert.deepEqual({ ...P.reglagesPrix('net') }, { showPrice: true, showPpht: false });
  assert.deepEqual({ ...P.reglagesPrix('aucun') }, { showPrice: false, showPpht: false });
  for (const m of ['ppht', 'net', 'aucun']) assert.equal(P.modeDe(P.reglagesPrix(m)), m, 'aller-retour ' + m);
  assert.equal(P.modeDe({}), 'ppht', 'une fiche ancienne (sans showPpht) = PPHT + net, comme avant');
});

test('prix saisi : virgule française acceptée, valeur invalide refusée', () => {
  const { P } = monde();
  assert.equal(P.lirePrix('1,07'), 1.07);
  assert.equal(P.lirePrix('1.07'), 1.07);
  assert.equal(P.lirePrix(' 12 € '), 12);
  assert.equal(P.lirePrix('9,99 €'), 9.99);
  for (const x of ['', 'abc', '0', '0,00', '-3', '1,2,3', '1,234', '12e3', '100000', null]) assert.equal(P.lirePrix(x), null, 'refusé : ' + x);
});

test('CIP13 : 34009 + CIP7 + clé ; le « cip13 » à 12 chiffres du fichier des offres est écarté', () => {
  const m = monde(), { P } = m;
  assert.equal(P.cip13('3595583'), '3400935955838', 'DOLIPRANE 1000MG 8CPR (code lu dans le catalogue du groupe)');
  for (const id of ['ip_sanofi', 'ip_upsa']) {
    const offre = m.fenetre.MARKETING_IP_OFFERS.find((o) => o.id === id);
    const G = m.fenetre.CATALOGUE_GROUPE, connus = new Set(G.rows.map((r) => String(r[0])));
    for (const p of offre.products) {
      assert.equal(p.cip13.length, 12, 'le fichier des offres écrit 12 chiffres : ' + p.designation);
      const c = P.produitOffre(p).cip;
      assert.equal(c.length, 13);
      assert.ok(connus.has(c), id + ' : ' + p.designation + ' ' + c + ' retrouvé dans le catalogue du groupe');
    }
  }
});

test('bases : Sanofi 25 produits, UPSA 23, valeurs lues = celles des offres ; Essentiels d\'hiver : 13 codes tous au catalogue', () => {
  const m = monde(); poserNetsEssai(m);
  const san = produitsOffre(m, 'ip_sanofi'), ups = produitsOffre(m, 'ip_upsa');
  assert.equal(san.length, 25); assert.equal(ups.length, 23);
  assert.equal(san[0].name, 'ASPEGIC 100 ENF NOUR X 20 SACHETS');
  assert.equal(san[0].ppht, 1.35); assert.equal(san[0].price, 1.07);
  assert.ok(san.every((p) => p.brand === '' && p.ppht > 0));
  assert.equal(m.P.HIVER.length, 13);
  const par = {}; m.fenetre.CATALOGUE_GROUPE.rows.forEach((r) => { par[String(r[0])] = r; });
  const absents = m.P.HIVER.filter((c) => !par[c]);
  assert.equal(absents.length, 0, 'codes introuvables : ' + absents.join(','));
  assert.ok(m.P.HIVER.every((c) => par[c][4] === 'nr'), 'tous « nr » : pas de PPHT, prix libre');
  assert.equal(m.P.baseDe('hiver').nr, true);
  assert.equal(m.P.baseDe('hiver').mode, 'net');
  assert.equal(m.P.baseDe('sanofi').mode, 'ppht');
});

test('offre Sanofi rendue : jamais de « % », de « 0,28 », de PFHT, d\'abandon ni de remise — avec témoin positif', () => {
  const m = monde(); poserNetsEssai(m);
  const S = etat(m, 'sanofi', 'ppht', produitsOffre(m, 'ip_sanofi'));
  for (const pdf of [false, true]) {
    const html = m.V2.mkt.feuilleHtml(m.P.fiche(S), pdf), t = texte(html);
    assert.ok(t.includes('Offre Sanofi'), 'marqueur : le titre de l\'offre est dans le rendu (pdf=' + pdf + ')');
    assert.ok(t.includes('ASPEGIC 100 ENF NOUR X 20 SACHETS'));
    // seul « % » admis : le dosage d'un nom réel
    const dosages = S.produits.reduce((n, p) => n + compter(p.name, /%/g), 0);
    assert.equal(dosages, 1, 'un seul nom réel porte un % (DOLIPRANE 2,4%)');
    assert.equal(compter(t, /%/g), dosages, 'aucun % hors dosage (pdf=' + pdf + ')');
    assert.equal(compter(html, /0,28|0\.28/g), 0, 'aucune règle de calcul');
    assert.equal(compter(html, /PFHT/gi), 0);
    assert.equal(compter(html, /abandon/gi), 0);
    assert.equal(compter(html, /remise/gi), 0);
    assert.ok(/1,35/.test(t) && /1,07/.test(t), 'PPHT 1,35 et net 1,07 de la première ligne');
  }
  // TÉMOIN : le compteur sait trouver un « % » et un « 0,28 » quand on en injecte un.
  const S2 = etat(m, 'sanofi', 'ppht', produitsOffre(m, 'ip_sanofi').concat([{ ...produitsOffre(m, 'ip_sanofi')[0], key: 'pT', cip: '3400000000001', name: 'ESSAI -19 % ET 0,28' }]));
  const h2 = m.V2.mkt.feuilleHtml(m.P.fiche(S2), true), t2 = texte(h2);
  assert.equal(compter(t2, /%/g), 2, 'témoin : le « % » injecté est bien compté');
  assert.equal(compter(h2, /0,28/g), 1, 'témoin : le « 0,28 » injecté est bien compté');
});

test('PPHT : « PPHT + net » barre le tarif et le dit en légende ; « Net seul » n\'en montre aucun ; « Aucun » n\'a aucun prix', () => {
  const m = monde(); poserNetsEssai(m);
  const prods = produitsOffre(m, 'ip_sanofi');
  const rendu = (mode) => m.V2.mkt.feuilleHtml(m.P.fiche(etat(m, 'sanofi', mode, prods)), true);
  const a = rendu('ppht'), b = rendu('net'), c = rendu('aucun');
  assert.ok(/line-through/.test(a) && /Tarif grossiste \(PPHT\)/.test(a), 'PPHT + net : tarif barré et légende');
  assert.ok(!/line-through/.test(b) && !/Tarif grossiste/.test(b), 'Net seul : ni tarif barré ni légende PPHT');
  assert.ok(/1,07/.test(texte(b)) && !/1,35/.test(texte(b)), 'Net seul : le net 1,07 reste, le PPHT 1,35 disparaît');
  assert.ok(!/€/.test(texte(c)), 'Aucun : pas un seul prix');
  assert.ok(!/Prix net HT/.test(c) && !/Prix nets HT indicatifs/.test(c));
});

test('une fiche sans showPpht rend exactement comme avec showPpht = true (défaut = affiché)', () => {
  const m = monde(); poserNetsEssai(m);
  const f = m.P.fiche(etat(m, 'sanofi', 'ppht', produitsOffre(m, 'ip_sanofi')));
  delete f.theme.showPpht;
  const g = JSON.parse(JSON.stringify(f)); g.theme.showPpht = true;
  for (const tpl of ['promo', 'nouveaute', 'selection', 'fiche', 'vedette', 'vitrine', 'rayons']) {
    f.theme.tpl = g.theme.tpl = tpl;
    for (const pdf of [false, true]) assert.equal(m.V2.mkt.feuilleHtml(f, pdf), m.V2.mkt.feuilleHtml(g, pdf), tpl + ' pdf=' + pdf);
  }
});

test('Essentiels d\'hiver rendu (Net seul) : 13 produits, 0 PPHT, pas de nom de laboratoire', () => {
  const m = monde(), C = m.V2.mkt.docCatalogue;
  assert.equal(C.prete(), true);
  const prods = m.P.HIVER.map((c) => m.V2.mkt.docProduit(C.par(c)));
  assert.equal(prods.length, 13);
  assert.ok(prods.every((p) => p.brand === '' && p.ppht === 0 && p.price > 0), 'net lu dans le catalogue, jamais de PPHT, jamais de labo');
  const html = m.V2.mkt.feuilleHtml(m.P.fiche(etat(m, 'hiver', 'net', prods)), true), t = texte(html);
  assert.ok(t.includes('Essentiels d’hiver'));
  assert.equal(compter(t, /PPHT/g), 0);
  assert.ok(!/line-through/.test(html));
  assert.ok(/TEST URINAIRE CYSTITE/.test(t));
  const dosages = prods.reduce((n, p) => n + compter(p.name, /%/g), 0);
  assert.equal(compter(t, /%/g), dosages, 'aucun % hors dosage');
  for (const labo of ['MIKLAB', 'L2N', 'OFFILOG']) assert.equal(compter(t, new RegExp(labo, 'g')), prods.reduce((n, p) => n + compter(p.name, new RegExp(labo, 'g')), 0), 'le labo n\'est écrit que s\'il est DANS le nom du produit : ' + labo);
});

test('recherche d\'un produit à ajouter : nom, CIP, deux lettres minimum', () => {
  const m = monde(), C = m.V2.mkt.docCatalogue;
  const dol = C.chercher('doliprane', 10);
  assert.ok(dol.length === 10 && dol.every((o) => /doliprane/i.test(o.d)));
  const cip = m.P.HIVER[4], r = C.chercher(cip, 5);
  assert.equal(r.length, 1); assert.equal(r[0].cip, cip);
  assert.equal(C.chercher('a', 5).length, 0);
  assert.equal(C.chercher('zzzzqqqq', 5).length, 0);
  assert.equal(C.chercher('flowflex', 5).some((o) => o.cip === '6921756492274'), true);
});

test('le document se range comme une fiche Marketing marquée (type support, theme.doc)', () => {
  const m = monde(), f = m.P.fiche(etat(m, 'upsa', 'net', produitsOffre(m, 'ip_upsa')), 'm123');
  assert.equal(f.type, 'support'); assert.equal(f.id, 'm123'); assert.equal(f.status, 'a_envoyer');
  assert.deepEqual({ ...f.theme.doc }, { base: 'upsa' });
  assert.equal(f.theme.showPrice, true); assert.equal(f.theme.showPpht, false); assert.equal(f.theme.showRemise, false);
  assert.equal(f.footer, '', 'aucune mention de l\'officine sur le document');
  assert.ok(!JSON.stringify(f).match(/officine|pharmacie du carrefour/i));
});
