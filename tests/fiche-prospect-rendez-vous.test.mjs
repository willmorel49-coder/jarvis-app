// 20/11/2026 — défaut 13 de l'audit de la fiche : les deux fiches de prospect (créée à la main, base nationale)
// prennent l'habillage de la fiche « Le rendez-vous » (fdrProspect). Ce test garde : le nouvel habillage (plus de carte .pha-id),
// RIEN de perdu (chaque formulaire et bouton d'avant est encore dessiné), les formulaires derrière « Modifier les informations »,
// la classe v2-prospect (v2-todo.js et v2-pdf-prospect.js lisent les champs dessous), et aucun bloc de vue (un prospect n'a pas de bascule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const corps = (nom) => {
  const i = js.indexOf('function ' + nom + '(');
  assert.ok(i > 0, nom + ' introuvable');
  return js.slice(i, js.indexOf('\n  }\n', i));
};
const FICHES = { renderCreatedProspect: 'créée à la main', renderProspectFiche: 'base nationale' };

test('prospects : habillage de la fiche « Le rendez-vous », sommaire collant actif', () => {
  for (const [f, q] of Object.entries(FICHES)) {
    const c = corps(f);
    assert.match(c, /fdrProspect\(\{/, q + ' : fdrProspect absent');
    assert.match(c, /'<div class="v2-wrap v2-prospect pha-wrap fdr-on">'/, q + ' : enveloppe sans fdr-on ou sans v2-prospect');
    assert.match(c, /fdrInit\(root\);/, q + ' : fdrInit non appelé (sommaire mort)');
    assert.ok(!/class="pha-id"/.test(c), q + ' : ancienne carte bleu nuit encore dessinée');
  }
});

test('prospects : aucun formulaire ni bouton d avant perdu', () => {
  const avant = {
    renderCreatedProspect: ['fe.panneau', 'V2.profil.newProspectSection(pid, seed)', "V2.profil.section('client', pid)", 'V2.rdvPrepa.section(pid)', "V2.notes.section('client', pid)", 'txProspectBtn(pid)', 'V2.pharmaArchiverProspect('],
    renderProspectFiche: ['fe.panneau', 'nameEditor(pid', 'V2.profil.coordSection(pid, seed)', "V2.profil.section('client', pid)", 'V2.rdvPrepa.section(pid)', "V2.notes.section('client', pid)", 'txProspectBtn(pid)', 'V2.promoteToClient(', 'google.com/maps', 'v2-prospect-badges', 'probableLignes'],
  };
  for (const [f, l] of Object.entries(avant)) { const c = corps(f); for (const x of l) assert.ok(c.includes(x), FICHES[f] + ' : « ' + x + ' » a disparu'); }
});

test('prospects : formulaires derrière « Modifier les informations », ouverts d office sur une fiche vide', () => {
  const b = corps('fdrProInfos');
  assert.match(b, /id="fdr-edit"' \+ \(ouvert \? '' : ' hidden'\)/);
  assert.match(b, /onclick="V2\.fdrModifier\(\)"/);
  assert.match(corps('renderCreatedProspect'), /fdrProInfos\(kvC, fe\.panneau \+ .*, !nomA\)/);
  assert.match(corps('renderProspectFiche'), /fdrProInfos\(kvP, formsP, false\)/);
});

test('prospects : pas de bascule de vue (aucun bloc vi-int ni vi-ph)', () => {
  const p = corps('fdrProspect') + corps('fdrProInfos');
  assert.ok(!/vi-(int|ph)(?![a-z-])/.test(p), 'un bloc de vue dans la fiche prospect');
  assert.ok(!/vv-sel|viBouton/.test(p), 'une bascule de vue dans la fiche prospect');
});
