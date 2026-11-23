// 23/11/2026 — « Mes officines » = le secteur du compte (Will : « chaque commercial voit son secteur et ses pharma »).
// Code réel de v2-pharma.js (ofNoms, ofDansSecteur, commSelect, pharmaSetComm), prénoms et officines fictifs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
function tranche(debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i); assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j);
}
const regle = tranche('function ofNoms()', 'function renderList(root)');
const menu = tranche('function commSelect(moi)', '// 25/09/2026 — la table d');
const choix = tranche('V2.pharmaSetComm = function (val) {', 'function buildPrepaHtml');

function monde(user, ventesDe = ['Alice', 'Bruno', 'Chloé']) {
  const V2 = { commFilter: '', user, commercials: () => ventesDe };
  V2.ventesRestreintes = () => !!(user && user.commercial && !user.voitTous);
  V2.mesComms = () => (user && user.commercial ? [user.commercial].concat(user.voitAussi || []) : []);
  V2.render = () => {};
  const ofl = { moi: true };
  const uga = { U1: ['Alice'], U2: ['Bruno'] };
  const f = new Function('V2', 'ofl', 'ugaCommMap', 'esc', 'document',
    regle + menu + choix + '; return { ofNoms, ofDansSecteur, commSelect };')(V2, ofl, () => uga, (s) => s, { getElementById: () => null });
  return { V2, ofl, ...f };
}
const L = [
  { p: { id: 'a', comms: ['Alice'] } },
  { p: { id: 'b', comms: ['Bruno'] } },
  { p: { id: 'ab', comms: ['Alice', 'Bruno'] } },
  { p: { id: 'sv', comms: [], _sansVente: true } },
  { p: { id: 'pa', comms: [], _promu: true, _uga: 'U1' } },
  { p: { id: 'pb', comms: [], _promu: true, _uga: 'U2' } },
];
const vus = (m) => { const n = m.ofNoms(); return L.filter((x) => m.ofDansSecteur(x, n)).map((x) => x.p.id); };

test('commercial limité, sans menu : ses officines seules (plus tout le réseau)', () => {
  assert.deepEqual(vus(monde({ commercial: 'Alice', voitTous: false })), ['a', 'ab', 'sv', 'pa']);
});

test('commercial limité avec un collègue ouvert : lui et ce collègue', () => {
  assert.deepEqual(vus(monde({ commercial: 'Alice', voitAussi: ['Bruno'], voitTous: false })), ['a', 'b', 'ab', 'sv', 'pa', 'pb']);
});

test('accès complet avec un prénom : « Mon secteur » d’office, « Tous » sur demande, un collègue sur demande', () => {
  const m = monde({ commercial: 'Alice', voitTous: true });
  assert.deepEqual(vus(m), ['a', 'ab', 'sv', 'pa'], 'atterrit sur son secteur');
  assert.match(m.commSelect(true), /value="__moi__" selected>Mon secteur/);
  m.V2.pharmaSetComm('');
  assert.equal(m.ofl.moi, false); assert.equal(m.V2.commFilter, '');
  assert.deepEqual(vus(m), L.map((x) => x.p.id), '« Tous » = tout le réseau');
  assert.match(m.commSelect(true), /<option value="" selected>Commercial : Tous/);
  m.V2.pharmaSetComm('Bruno');
  assert.deepEqual(vus(m), ['b', 'ab', 'sv', 'pb'], 'un collègue choisi');
  m.V2.pharmaSetComm('__moi__');
  assert.equal(m.V2.commFilter, '', 'Mon secteur ne touche pas au filtre commun du Pilotage');
  assert.deepEqual(vus(m), ['a', 'ab', 'sv', 'pa']);
});

test('direction sans prénom : tout le réseau, pas d’option « Mon secteur »', () => {
  const m = monde({ commercial: '', voitTous: true });
  assert.deepEqual(vus(m), L.map((x) => x.p.id));
  assert.doesNotMatch(m.commSelect(true), /Mon secteur/);
});

test('les autres vues (carte) n’ont pas l’option « Mon secteur »', () => {
  assert.doesNotMatch(monde({ commercial: 'Alice', voitTous: true }).commSelect(), /Mon secteur/);
});

test('l’export « Mes clients » et les clients sans vente suivent la même règle', () => {
  assert.match(tranche('V2.pharmaClientsXlsx = function () {', 'var c = V2.sb'), /var noms = ofNoms\(\);/);
  assert.match(tranche('function sansVenteRows(deja) {', 'var vu = {}'), /var noms = ofNoms\(\);/);
  assert.equal((src.match(/V2\.commFilter && !x\.p\._promu/g) || []).length, 0, 'plus aucune copie de l’ancienne règle');
});
