// 26/11/2026 — Will : « il manque un bouton pdf pour avoir directement le pdf qui s'enregistre ou envoyer ne fonctionne pas
// sur les documents commerciaux et aussi quand on va sur offilog les catalogues ».
// Cause mesurée sous WebKit : la feuille de partage ouverte 6 s après le clic est REFUSÉE (NotAllowedError) ; ouverte dans le
// clic, elle passe ; un téléchargement passe dans les deux cas. Le refus était avalé sans rien dire.
// Le VRAI code est extrait des fichiers et exécuté avec un navigateur factice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const vit = lire('crm/v2/v2-offilog-vitrine.js'), dcm = lire('crm/v2/v2-doccom.js');

function bloc(src, debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, debut + ' introuvable');
  const j = src.indexOf(fin, i); assert.ok(j > i, fin + ' introuvable après ' + debut);
  return src.slice(i, j + fin.length);
}
// un navigateur factice : compte les téléchargements (clic sur un lien « download ») et les partages
function navigateur(share) {
  const vus = { telechargements: [], partages: 0, toasts: [] };
  const document = {
    createElement: () => ({ click() { vus.telechargements.push(this.download); }, parentNode: { removeChild() {} } }),
    body: { appendChild() {} }, getElementById: () => null,
  };
  const navigator = share === null ? {} : { canShare: () => true, share: () => { vus.partages++; return share(); } };
  const URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  const V2 = { toast: m => vus.toasts.push(m) };
  return { vus, document, navigator, URL, V2, setTimeout: () => 0, console: { error() {} } };
}
const refus = nom => () => Promise.reject(Object.assign(new Error(nom), { name: nom }));
const fichier = { name: 'Catalogue-Offilog-100-references.pdf' };

// ── Offilog : « Télécharger le PDF » et « Envoyer » ──
const vitPartage = [bloc(vit, '  function enregistrer(file) {', '\n  }\n'), bloc(vit, '  function partager(file) {', '\n  }\n'),
  bloc(vit, '  function fermerPret() {', '}\n')].join('');
function partagerVit(share) {
  const n = navigateur(share);
  const esc = s => String(s);
  const p = new Function('document', 'navigator', 'URL', 'V2', 'setTimeout', 'console', 'esc', vitPartage + '\nreturn partager;')(
    n.document, n.navigator, n.URL, n.V2, n.setTimeout, n.console, esc)(fichier);
  return Promise.resolve(p).then(() => n.vus);
}

test('Offilog : le catalogue a un bouton « Télécharger le PDF » dans la fenêtre ET sur l\'onglet', () => {
  assert.match(vit, /V2\.offVitrinePdf = function \(n\) \{ return produire\(n, 'pdf'\); \};/);
  const barre = bloc(vit, '  function barre() {', '\n  }\n'), panneau = bloc(vit, '  V2.offVitrinePanneau = function () {', '\n  };\n');
  for (const [nom, h] of [['fenêtre', barre], ['onglet', panneau]]) {
    assert.ok(h.includes('onclick="V2.offVitrinePdf()"'), 'bouton PDF absent : ' + nom);
    assert.ok(h.includes('onclick="V2.offVitrineMail()"'), 'bouton Envoyer absent : ' + nom);
    assert.equal((h.match(/ICO\('download'/g) || []).length, 1, 'une seule icône de téléchargement : ' + nom);
  }
});

test('Offilog : après la fabrication du PDF (attente), le partage n\'est JAMAIS lancé — il attend le clic sur « Le PDF est prêt »', () => {
  const corps = bloc(vit, '  function produire(n, mode) {', '\n  }\n');
  const apres = corps.slice(corps.indexOf('fabriquerPdf('));
  assert.ok(apres.length > 50);
  assert.ok(!/partager\(|navigator\.share|shareOrSaveBlob/.test(apres), 'partage lancé après l\'attente : Safari le refuse');
  assert.ok(/proposer\(/.test(apres), 'l\'encadré « Le PDF est prêt » n\'est pas montré');
  // le clic sur « Envoyer » de l'encadré lance le partage dans le geste
  assert.match(bloc(vit, '  function proposer(p) {', '\n  }\n'), /else partager\(p\.file\);/);
});

test('Offilog : partage refusé par le navigateur = PDF téléchargé ; feuille fermée par l\'utilisateur = rien', async () => {
  let v = await partagerVit(refus('NotAllowedError'));
  assert.equal(v.partages, 1); assert.deepEqual(v.telechargements, [fichier.name]);
  v = await partagerVit(refus('AbortError'));
  assert.equal(v.partages, 1); assert.deepEqual(v.telechargements, []);
  v = await partagerVit(() => Promise.resolve());
  assert.deepEqual(v.telechargements, []);
  v = await partagerVit(null);   // navigateur sans partage de fichiers
  assert.equal(v.partages, 0); assert.deepEqual(v.telechargements, [fichier.name]);
});

// ── Documents commerciaux : la visionneuse ──
const dcmEnvoi = [bloc(dcm, '  function enregistrer(f, btn, lib) {', '\n  }\n'), bloc(dcm, '  function telecharger(btn) {', '\n  }\n'),
  bloc(dcm, '  function envoyer(d, btn) {', '\n  }\n')].join('');
function visionneuse(share) {
  const n = navigateur(share);
  const vis = { fichier: { name: 'Contrat.pdf' } };
  const f = new Function('document', 'navigator', 'URL', 'V2', 'setTimeout', 'console', 'esc', 'vis', dcmEnvoi + '\nreturn { telecharger, envoyer };')(
    n.document, n.navigator, n.URL, n.V2, n.setTimeout, n.console, s => String(s), vis);
  return { f, vus: n.vus };
}

test('Documents commerciaux : la visionneuse a « Télécharger », activé en même temps que « Envoyer »', () => {
  const v = bloc(dcm, '  function voir(sha, depuis) {', '\n  }\n');
  assert.ok(v.includes('data-telecharger="1"') && v.includes('aria-label="Télécharger ce document" disabled'));
  assert.ok(v.includes("if (t.closest('[data-telecharger]')) telecharger("));
  assert.ok(v.includes("ov.querySelectorAll('[data-envoyer],[data-telecharger]')"));
  const { f, vus } = visionneuse(() => Promise.resolve());
  f.telecharger(null);
  assert.deepEqual(vus.telechargements, ['Contrat.pdf']); assert.equal(vus.partages, 0);
});

test('Documents commerciaux : partage refusé = PDF téléchargé ; feuille fermée = rien', async () => {
  let x = visionneuse(refus('NotAllowedError')); x.f.envoyer({ titre: 'Contrat' }, null); await new Promise(r => setImmediate(r));
  assert.equal(x.vus.partages, 1); assert.deepEqual(x.vus.telechargements, ['Contrat.pdf']);
  x = visionneuse(refus('AbortError')); x.f.envoyer({ titre: 'Contrat' }, null); await new Promise(r => setImmediate(r));
  assert.equal(x.vus.partages, 1); assert.deepEqual(x.vus.telechargements, []);
});

// ── Partage commun (V2.shareOrSaveBlob, v2-app.js) : « Partager » des listings et du PDF prospect, Outlook sur iPhone ──
const app = lire('crm/v2/v2-app.js');
function partageCommun(share) {
  const n = navigateur(share), pret = [];
  n.V2.pdfPret = (f, t) => pret.push(f.name);
  const corps = bloc(app, '  V2.shareOrSaveBlob = function (blob, filename, title) {', '\n  };\n');
  class File { constructor(b, nom) { this.name = nom; } }
  const p = new Function('V2', 'document', 'navigator', 'URL', 'setTimeout', 'File', corps + '\nreturn V2.shareOrSaveBlob;')(
    n.V2, n.document, n.navigator, n.URL, n.setTimeout, File)({}, 'Liste-essai.pdf', 'Liste');
  return Promise.resolve(p).then(() => ({ vus: n.vus, pret }));
}

test('Partage commun : refusé par le navigateur (PDF fabriqué trop longtemps après le clic) = encadré « Le PDF est prêt »', async () => {
  let r = await partageCommun(refus('NotAllowedError'));
  assert.equal(r.vus.partages, 1); assert.deepEqual(r.pret, ['Liste-essai.pdf']);
  r = await partageCommun(refus('AbortError'));
  assert.deepEqual(r.pret, []);
  r = await partageCommun(() => Promise.resolve());
  assert.deepEqual(r.pret, []);
  // l'encadré relance le partage dans le clic, et se replie sur le téléchargement si le partage est encore refusé
  const enc = bloc(app, '  V2.pdfPret = function (file, title) {', '\n  };\n');
  assert.match(enc, /else navigator\.share\(\{ files: \[file\]/);
  assert.match(enc, /if \(e2 && e2\.name === 'AbortError'\) return;[\s\S]*enregistrer\(\);/);
  assert.match(enc, /textContent = file\.name/);
});
