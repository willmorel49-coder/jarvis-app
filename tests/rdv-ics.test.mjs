import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ICS = require('../crm/v2/v2-rdv-ics.js');

const BASE = {
  uid: 'abc-123',
  date: '2026-08-18',
  heure: '10:30',
  duree_min: 45,
  titre: 'Rendez-vous Integral Pharma',
  lieu: '64 rue de la Rabaterie, 37700 ST PIERRE DES CORPS',
  description: 'Visite commerciale',
  organisateur: 'William Morel'
};

test('structure minimale d un .ics', () => {
  const s = ICS.build(BASE);
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(s.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(s.includes('BEGIN:VEVENT'));
  assert.ok(s.includes('UID:abc-123'));
});

test('debut et fin calcules a partir de la duree', () => {
  const s = ICS.build(BASE);
  assert.ok(s.includes('DTSTART:20260818T103000'), 'debut attendu 10:30');
  assert.ok(s.includes('DTEND:20260818T111500'), 'fin attendue 11:15');
});

test('passage a l heure suivante gere', () => {
  const s = ICS.build({ ...BASE, heure: '11:45', duree_min: 45 });
  assert.ok(s.includes('DTEND:20260818T123000'));
});

test('les virgules et points-virgules sont echappes', () => {
  const s = ICS.build({ ...BASE, lieu: '64 rue A, 37700 TOURS; bat B' });
  assert.ok(s.includes('LOCATION:64 rue A\\, 37700 TOURS\\; bat B'));
});

test('les retours a la ligne de la description sont echappes', () => {
  const s = ICS.build({ ...BASE, description: 'ligne 1\nligne 2' });
  assert.ok(s.includes('ligne 1\\nligne 2'));
});

test('aucune ligne ne depasse 75 octets', () => {
  const s = ICS.build({ ...BASE, description: 'x'.repeat(400) });
  s.split('\r\n').forEach(l => {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `ligne trop longue : ${l.length}`);
  });
});

test('les lignes repliees commencent par une espace', () => {
  const s = ICS.build({ ...BASE, description: 'y'.repeat(400) });
  const lignes = s.split('\r\n');
  const suite = lignes.find(l => l.startsWith(' '));
  assert.notEqual(suite, undefined, 'aucune ligne de continuation trouvee');
});

test('les accents ne font pas deborder la limite de 75 octets', () => {
  const s = ICS.build({ ...BASE, description: 'éàçù'.repeat(100) });
  s.split('\r\n').forEach(l => {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `ligne trop longue : ${Buffer.byteLength(l, 'utf8')} octets`);
  });
});

test('dataUrl produit un lien telechargeable', () => {
  const u = ICS.dataUrl(ICS.build(BASE));
  assert.ok(u.startsWith('data:text/calendar;charset=utf-8,'));
});
