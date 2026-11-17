/* fiche-detail-produits-pharmacien.test.mjs — le tableau « détail produit par produit » est de retour en vue pharmacien (17/11/2026).
 * Contrôle de SOURCE sur renderDetail (v2-pharma.js) : pas de navigateur. La preuve à l'écran se fait à part. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = src.indexOf('var rotRows = shownRot.map('), b = src.indexOf('// CA par génériqueur (Biogaran');
assert.ok(a > 0 && b > a, 'construction du tableau introuvable');
const bloc = src.slice(a, b);

test('fiche d4 : le tableau est posé en vue pharmacien (vi-ph), juste après la colonne « chiffresBas » (donc après « À proposer »), seulement si on voit les ventes', () => {
  assert.ok(src.includes("chiffresBas + (voitVentes ? viW(listing, 'vi-ph') : '')"));
  assert.ok(src.includes("var chiffresBas = fi ? viW(analyseTop5(A), 'vi-ph') + proposer :"), 'À proposer reste en dernier de chiffresBas');
  assert.ok(!/viW\([^)]*listing[^)]*'vi-int'\)\s*\+\s*viW\(generiqueurSec, ''\)/.test(src) || src.includes("chiffres + chiffresBas + viW(briefOff + listing, 'vi-int')"), 'hors fi : inchangé');
});
test('les textes montrés au pharmacien (fi) lui parlent : « vous », « pas encore commandé », jamais « pousser »', () => {
  for (const t of ['Pas encore commandé', 'Déjà commandé', 'de votre groupement', 'votre groupement', 'ce que vous commandez déjà et ce que vous ne commandez pas encore', 'pas encore commandé', "Vous commandez"]) assert.ok(bloc.includes(t), t);
  // chaque occurrence de « pousser » ou d'un « Commande » interne est dans la branche non-fi d'un ternaire
  for (const m of bloc.matchAll(/pousser/g)) {
    const ligne = bloc.slice(bloc.lastIndexOf('\n', m.index), bloc.indexOf('\n', m.index));
    assert.ok(/fi \?/.test(ligne) || /: '/.test(ligne), 'pousser hors branche non-fi : ' + ligne.trim().slice(0, 120));
  }
});
test('le mot affiché reste « Abandon » (jamais « remise »), colonnes Prix net IP / Abandon / % des pharmacies gardées', () => {
  assert.ok(bloc.includes('Prix net IP') && bloc.includes('>Abandon<') && bloc.includes('% des pharmacies'));
  assert.ok(!/remise/i.test(bloc.replace(/r\.remise/g, '')), 'le mot remise n’est pas affiché');
});
test('les boutons redessinent la fiche sans quitter la vue : la vue vient du stockage, pas d’un état perdu au rendu', () => {
  assert.ok(src.includes("V2.pharmaGrpFilter = function (f) { grpListFilter = f; V2.render(); };"));
  assert.ok(src.includes("V2.pharmaRotExpand = function () { grpRotExpanded = true; V2.render(); };"));
  assert.ok(src.includes("var vue = menu ? L1.vue : viLire();"), 'la vue se relit à chaque rendu');
  assert.ok(src.includes("['detail-produits', '.pha-main .ph-bestrot', '.v2-sh-t', true]"), 'le bloc garde son bouton Masquer / Afficher');
});
