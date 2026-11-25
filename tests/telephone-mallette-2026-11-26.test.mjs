// 26/11/2026 — Mallette (audit du 25/11, MAL-2 ; accord de Will du 25/11 : le titre change aussi à l'ordinateur).
// Avant : la vignette d'un fichier déposé par l'équipe portait son nom brut, coupé au milieu des mots :
// « PRESENTATIO / N-FOCUS- / AIGUILLES.pp / tx_20251016_ / 221700_0000. / pdf ».
// Ce que ce test garde, par le vrai chemin (eqDoc, qui fabrique la fiche d'un fichier de l'équipe) :
//   - un nom brut devient lisible (reste d'extension et horodatage retirés, tirets du dépôt redevenus des espaces) ;
//   - un nom déjà parlant n'est pas abîmé (espaces, tiret voulu, période « 2025-2026 », numéro de version « V1.2 ») ;
//   - le fichier joint garde son vrai nom : seul le titre affiché change.
// Noms de fichiers INVENTÉS ou repris de l'audit (aucun nom de personne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-mallette.js', import.meta.url), 'utf8');

// une fonction du fichier, sur une ligne ou sur plusieurs
function charge(nom) {
  const i = js.indexOf('\n  function ' + nom + '(');
  assert.ok(i >= 0, nom + ' introuvable');
  const ligne = js.slice(i + 1, js.indexOf('\n', i + 1));
  if (/\}\s*$/.test(ligne)) return ligne;
  const fin = js.indexOf('\n  }\n', i);
  assert.ok(fin > i, nom + ' : fin introuvable');
  return js.slice(i + 1, fin + 4);
}
const fiche = new Function('S', ['pretty', 'isXls', 'titreLisible', 'eqDoc'].map(charge).join('\n') + '\nreturn eqDoc;')({ eqDocs: {} });
const titre = (nom) => fiche({ name: nom, size: 2048 }).titre;

test('Mallette : un nom de fichier brut devient un titre lisible', () => {
  // le cas de l'audit (photo mallette-390-bas.jpg), tel que le dépôt le range : horodatage, « __ », nom nettoyé par sanit()
  assert.equal(titre('1760645820000-412__PRESENTATION-FOCUS-AIGUILLES.pptx_20251016_221700_0000.pdf'), 'PRESENTATION FOCUS AIGUILLES');
  // le même avec une double extension (la photo montre « .pdf » encore visible dans le titre)
  assert.equal(titre('1760645820000-412__PRESENTATION-FOCUS-AIGUILLES.pptx_20251016_221700_0000.pdf.pdf'), 'PRESENTATION FOCUS AIGUILLES');
  assert.equal(titre('1760645820001-7__OUVERTURE-DE-COMPTE-OFFILOG-2026.pdf'), 'OUVERTURE DE COMPTE OFFILOG 2026');
  assert.equal(titre('1760645820002-88__Meilleures-ventes-Integral-PROSPECT.xlsx'), 'Meilleures ventes Integral PROSPECT');
  assert.equal(titre('1760645820003-5__Bon_de_commande_2026.docx_3.pdf'), 'Bon de commande 2026');
});

test('Mallette : un nom déjà parlant n\'est pas abîmé', () => {
  assert.equal(titre('Catalogue Offilog 2026.pdf'), 'Catalogue Offilog 2026', 'déjà propre : inchangé');
  assert.equal(titre('Offre Sanofi - UPSA 2026.pdf'), 'Offre Sanofi - UPSA 2026', 'nom écrit à la main : son tiret est voulu');
  assert.equal(titre('Fiche anti-douleur hiver.pdf'), 'Fiche anti-douleur hiver', 'un nom avec des espaces garde ses traits d\'union');
  assert.equal(titre('1760645820004-9__Tarifs-2025-2026.pdf'), 'Tarifs 2025-2026', 'le tiret entre deux nombres reste');
  assert.equal(titre('1760645820005-1__V1.2-OFFRE-IP-Diabete.pdf'), 'V1.2 OFFRE IP Diabete', 'le point d\'un numéro de version n\'est pas pris pour une extension');
  assert.equal(titre('1760645820006-3__Tarifs_2026.xlsx'), 'Tarifs 2026', 'une année seule n\'est pas un horodatage');
  assert.equal(titre('2026.pdf'), '2026');
});

test('Mallette : un nom qui ne serait plus rien une fois nettoyé garde son titre d\'avant', () => {
  assert.equal(titre('1760645820007-2__---.pdf'), '---');
});

test('Mallette : seul le titre affiché change, le fichier joint garde son vrai nom', () => {
  const d = fiche({ name: '1760645820008-4__PLAQUETTE-FICTIVE.pptx_20251016_221700_0000.pdf', size: 4096 });
  assert.equal(d.titre, 'PLAQUETTE FICTIVE');
  assert.equal(d.nomFichier, 'PLAQUETTE-FICTIVE.pptx_20251016_221700_0000.pdf', 'nom du fichier joint inchangé');
  assert.equal(d.bucket, '1760645820008-4__PLAQUETTE-FICTIVE.pptx_20251016_221700_0000.pdf', 'adresse du fichier dans l\'espace inchangée');
  assert.equal(d.id, 'eq:1760645820008-4__PLAQUETTE-FICTIVE.pptx_20251016_221700_0000.pdf', 'identifiant inchangé : les sélections gardées tiennent');
  assert.equal(d.type, 'pdf');
  // le titre des fichiers de l'équipe passe par titreLisible, et le fichier ajouté à l'instant (nom tapé par l'utilisateur) n'est pas touché
  assert.match(js, /kind: 'equipe', famille: 'equipe', titre: titreLisible\(f\.name\),/);
  assert.match(js, /kind: 'local', famille: 'equipe', titre: f\.name\.replace\(\/\\\.\[\^\.\]\+\$\/, ''\),/);
  assert.doesNotMatch(js, /\(\?<[=!]/, 'pas de « lookbehind » : les anciens Safari ne le lisent pas');
});
