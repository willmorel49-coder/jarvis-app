// Officines fermées hors des cartes (27/11/2026, choix de Will « Retirer de la carte ») : la liste relue et versionnée
// fermetures_carte.json est recopiée dans pharma-fr-data.js (meta.fermees), que chaque carte lit par V2.pfFermee.
// Ce test rouge = une régénération du fichier a perdu la liste, et les pharmacies fermées reviennent sur les cartes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const g = {};
new Function('window', lire('crm/v2/pharma-fr-data.js'))(g);
const D = g.PHARMA_FR;
const liste = Object.keys(JSON.parse(lire('fermetures_carte.json')).officines).sort();

test('les 22 fermetures prouvées sont dans le fichier de la carte, ni plus ni moins', () => {
  assert.equal(liste.length, 22);
  assert.deepEqual([...D.meta.fermees].map(String).sort(), liste);
});

test('les fiches sont gardées : chaque officine fermée est toujours dans la base (recherche et fiche)', () => {
  const ids = new Set(D.p.map(p => String(p[13])));
  assert.deepEqual(liste.filter(id => !ids.has(id)), []);
});

test('aucune officine fermée n\'est cliente (ni au fichier de la carte, ni au CRM)', () => {
  const clientes = D.p.filter(p => liste.includes(String(p[13])) && String(D.seg[p[4]] || '').startsWith('Client'));
  assert.deepEqual(clientes.map(p => p[13]), []);
});

test('les trois programmes qui écrivent le fichier relisent fermetures_carte.json', () => {
  assert.match(lire('build_pharma_fr.py'), /'fermees': fermetures_carte\(\)/);
  assert.match(lire('enrichir_pharma_fr.py'), /data\['meta'\]\['fermees'\] = sorted\(json\.load\(open\(_fc/);
  assert.match(lire('positions_reelles.py'), /data\['meta'\]\['fermees'\] = sorted\(json\.load\(io\.open\(os\.path\.join\(ROOT, 'fermetures_carte\.json'\)/);
});

test('Pharmacie Victor Hugo (Saint-Quentin), fermée fin 2025, est dans la liste', () => {
  const p = D.p.find(x => String(x[13]) === '2004363');
  assert.equal(p[6], 'PHARMACIE VICTOR HUGO');
  assert.ok(D.meta.fermees.map(String).includes('2004363'));
});
