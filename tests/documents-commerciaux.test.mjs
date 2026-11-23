// 23/11/2026 — onglet « Documents commerciaux » (crm/v2/v2-doccom.js) : porte, Menu du téléphone, Transmettre, fermetures, faille pdf.js.
// Comme tests/telephone-barre-du-bas.test.mjs : le VRAI code est extrait des fichiers et exécuté sur des données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('crm/v2/v2-app.js'), pha = lire('crm/v2/v2-pharma.js'), dcm = lire('crm/v2/v2-doccom.js');
const cinq = lire('crm/v2/v2-accueil-cinq.js'), idx = lire('crm/v2/index.html');

function bloc(src, debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, debut + ' introuvable');
  const j = src.indexOf(fin, i); assert.ok(j > i, fin + ' introuvable après ' + debut);
  return src.slice(i, j + fin.length);
}

// ── la porte (u2Cles de v2-app.js) ──
function cles({ brand = {}, pages = { doccom: 1, documents: 1, pharma: 1, offilog: 1, lgo: 1 } } = {}) {
  const corps = [bloc(app, '  var G4_REPLI', '\n'), bloc(app, '  var G4_PORTES = {', '\n  };\n'), bloc(app, '  function u2Cles() {', '\n  }\n')].join('\n');
  const window = { V2_BRAND: brand };
  const V2 = { pages, user: { id: 'x', role: 'user' } };
  return new Function('V2', 'window', 'u2Escale', 'tournInterdit', 'docOk', 'g4Classer', corps + '\nreturn u2Cles();')(
    V2, window, () => !!brand.escale, () => !!brand.opso, () => true, l => l);
}

test('la porte « Documents commerciaux » existe pour JARVIS, jamais en Escale ni côté OPSO', () => {
  assert.ok(cles().includes('doccom'));
  assert.ok(!cles({ brand: { escale: true } }).includes('doccom'));
  assert.ok(!cles({ brand: { opso: true } }).includes('doccom'));
});

test('la porte disparaît quand l\'écran n\'est pas chargé (Phirst ne charge pas v2-doccom.js)', () => {
  assert.ok(!cles({ pages: { pharma: 1 } }).includes('doccom'));
  assert.doesNotMatch(lire('phirst/v2/index.html'), /v2-doccom\.js/);
  assert.doesNotMatch(lire('opso/v2/index.html'), /v2-doccom\.js/);
  assert.match(idx, /'v2-documents\.js', 'v2-doccom\.js'/, 'chargé en différé par le CRM, juste après v2-documents.js');
});

test('menu principal : « Documents commerciaux » juste après Offilog', () => {
  assert.match(cinq, /\['pharma', 'todo', 'infos', 'groupements', 'offilog', 'doccom'\]\.forEach/);
});

// ── le « Menu » du téléphone (autresListe + V2.tbMenu de v2-app.js) ──
const RUB = ['pharma', 'todo', 'infos', 'groupements', 'offilog', 'doccom', 'produits'].map(k => ({ k, nom: 'Nom ' + k, act: 'go:' + k, href: '#' + k }));
function autres(...args) {
  const corps = [bloc(app, '  function aoLien', '\n  }\n'), bloc(app, '  function autresListe', '\n  }\n')].join('\n');
  const V2 = { accueilCinq: { barre: () => RUB }, accueilWidgets: null };
  const fn = new Function('V2', 'esc', 'u2Etat', 'u2Outil', 'u2Ic', corps + '\nreturn autresListe;')(
    V2, s => String(s), () => ({ fams: [], tous: [] }), k => ({ k }), n => '<svg data-ic="' + n + '"/>');
  return [...fn(...args).matchAll(/data-tool="([^"]+)"/g)].map(m => m[1]);
}

test('Menu du téléphone : « Documents commerciaux » remonte EN TÊTE, le reste garde son ordre', () => {
  assert.deepEqual(autres(3, null, null, 'doccom'), ['doccom', 'groupements', 'offilog', 'produits']);
  assert.deepEqual(autres(3), ['groupements', 'offilog', 'doccom', 'produits'], 'sans tête : ordre de la barre');
  assert.deepEqual(autres(3, null, RUB.filter(t => t.k !== 'doccom'), 'doccom'), ['groupements', 'offilog', 'produits'], 'absent (Escale, OPSO) : rien ne bouge');
  assert.deepEqual(autres(6, null, null, 'doccom'), ['produits'], 'une liste qui commence après la rubrique : rien ne bouge');
});

test('V2.tbMenu demande la tête « doccom » sur la liste de la marque (V2.tbRubriques)', () => {
  assert.match(app, /autresListe\(3, function \(t, k\) \{[^\n]*\}, V2\.tbRubriques\(\), 'doccom'\);/);
});

// ── l'écran se ferme tout seul hors JARVIS (ferme() de v2-doccom.js) ──
function ferme(brand, user) {
  const code = bloc(dcm, '  function ferme() {', '\n');
  return new Function('V2', 'window', code + '\nreturn ferme();')({ user }, { V2_BRAND: brand });
}
test('V2.doccom fermé côté OPSO, Escale, Phirst et pour un compte opso ; ouvert pour JARVIS', () => {
  assert.equal(ferme({ name: 'JARVIS Pharma' }, { role: 'user' }), false);
  assert.equal(ferme({ opso: true }, { role: 'user' }), true);
  assert.equal(ferme({ escale: true }, { role: 'user' }), true);
  assert.equal(ferme({ phirst: true, portes: {} }, { role: 'user' }), true);
  assert.equal(ferme({}, { role: 'opso' }), true);
  assert.equal(ferme({}, { opsoOnly: true }), true);
});

// ── la fenêtre Transmettre de la fiche (v2-pharma.js) ──
function tx(doccom) {
  const corps = [bloc(pha, '  V2.pharmaTxLabel = function (k) {', '\n  };\n'), bloc(pha, '  function txDoccom()', '\n'), bloc(pha, '  function txFetch(pid, k) {', '\n  }\n')].join('\n');
  const V2 = { doccom };
  return new Function('V2', 'TX_APP_DOCS', 'txPretty', 'txProtegeTitre', corps + '\nreturn { label: V2.pharmaTxLabel, fetch: txFetch };')(V2, [], s => s, s => s);
}
test('Transmettre : une pièce K:<empreinte> porte le titre du document et se lit par V2.doccom.fichier', async () => {
  const demandes = [];
  const t = tx({ ouvert: () => true, titre: s => (s === 'abc' ? 'Livret clients' : ''), fichier: s => { demandes.push(s); return Promise.resolve('blob:' + s); } });
  assert.equal(t.label('K:abc'), 'Livret clients');
  assert.equal(t.label('K:inconnu'), 'Document commercial');
  assert.equal(await t.fetch('P1', 'K:abc'), 'blob:abc'); assert.deepEqual(demandes, ['abc']);
  const f = tx({ ouvert: () => false, titre: () => '', fichier: () => { throw new Error('ne doit pas être appelé'); } });
  assert.equal(await f.fetch('P1', 'K:abc'), null, 'écran fermé (OPSO, Escale) : rien n\'est lu');
});

test('Transmettre : « Documents commerciaux » REMPLACE « Documents Intégral Pharma » (repli seulement si le module manque)', () => {
  assert.match(pha, /txDoccom\(\) \? group\('Documents commerciaux'/);
  assert.match(pha, /: group\('Documents Intégral Pharma', '', of\('app'\)\)\)/);
  assert.match(pha, /if \(dcl === false\) TX_APP_DOCS\.forEach/);
  assert.match(pha, /its\.push\(\{ k: 'K:' \+ d\.sha1, grp: 'app'/);
});

// ── sécurité ──
test('pdf.js : CHAQUE ouverture de PDF du CRM porte isEvalSupported:false (faille CVE-2024-4367)', () => {
  const dir = new URL('../crm/v2/', import.meta.url);
  let n = 0;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/getDocument\(\{[^}]*\}/g)) { n++; assert.match(m[0], /isEvalSupported: false/, f + ' : ' + m[0]); }
  }
  assert.ok(n >= 3, 'au moins les 3 ouvertures connues (Documents commerciaux ×2, Marketing › Documents partagés) : ' + n);
});

test('l\'écran lit un espace FERMÉ par adresses signées, jamais une adresse publique', () => {
  assert.match(dcm, /var BUCKET = 'documents-commerciaux', TABLE = 'documents_commerciaux';/);
  assert.match(dcm, /createSignedUrls\(/); assert.match(dcm, /createSignedUrl\('pdf\/'/);
  assert.doesNotMatch(dcm, /getPublicUrl|\/object\/public\//);
});

test('CI : le parcours connecté ouvre l\'écran et attend son titre', () => {
  assert.match(lire('.github/scripts/parcours-connecte.mjs'), /\{ route: 'doccom', +nom: 'Documents commerciaux', selecteur: 'h1\.v2-titre', +texte: 'Documents commerciaux' \}/);
  assert.match(dcm, /<h1 class="v2-titre">Documents commerciaux<\/h1>/);
});

// 23/11/2026 après-midi — « Livret clients » retiré (Will) : « Présenter » n'a plus de document, son filtre ne doit pas mener à un mur vide.
function filtresSur(D) {
  const corps = [bloc(dcm, '  function visibles()', '\n'), bloc(dcm, '  function famVide(k)', '\n'), bloc(dcm, '  function filtres() {', '\n  }\n')].join('\n');
  const boutons = ['', 'presenter', 'compte', 'offres', 'fiches'].map(k => ({ k, hidden: false, ap: null, getAttribute: () => k, setAttribute(n, v) { this.ap = v; } }));
  new Function('D', 'document', corps + '\nfiltres();')(D, { querySelectorAll: () => boutons });
  return Object.fromEntries(boutons.map(b => [b.k || 'tout', b]));
}

test('une famille sans document affiché n\'a pas de filtre ; un filtre posé sur elle revient à « Tout »', () => {
  const D = { etat: 'pret', fam: 'presenter', tous: [{ famille: 'presenter', retire_le: '2026-11-23T12:21:19Z' }, { famille: 'compte' }, { famille: 'offres' }, { famille: 'fiches' }] };
  const b = filtresSur(D);
  assert.equal(D.fam, '', 'le filtre « Présenter » vidé revient à « Tout »');
  assert.equal(b.presenter.hidden, true);
  assert.deepEqual([b.compte.hidden, b.offres.hidden, b.fiches.hidden, b.tout.hidden], [false, false, false, false]);
  assert.equal(b.tout.ap, 'true');
  assert.equal(b.presenter.ap, 'false');
  // un document remis (ou ajouté) dans « Présenter » fait revenir son filtre
  D.tous[0].retire_le = null;
  assert.equal(filtresSur(D).presenter.hidden, false);
});

test('avant la liste lue, seul « Tout » est montré (aucun filtre qui disparaît sous le doigt)', () => {
  const b = filtresSur({ etat: 'charge', fam: '', tous: [] });
  assert.deepEqual([b.presenter.hidden, b.compte.hidden, b.offres.hidden, b.fiches.hidden, b.tout.hidden], [true, true, true, true, false]);
  assert.match(dcm, /\(famVide\(f\.k\) \? ' hidden' : ''\)/, 'le gabarit pose aussi « hidden » dès le premier rendu');
  assert.match(dcm, /\.dcm-fam\[hidden\]\{display:none\}/);
});
