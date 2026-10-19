// ESSAI VOLONTAIRE du 19/10/2026 : ce test échoue exprès pour prouver qu'un test
// rouge BLOQUE la mise en ligne (ci.yml). Retiré au commit suivant.
import test from 'node:test';
import assert from 'node:assert';
test('preuve du verrou : doit échouer', () => { assert.strictEqual(1, 2); });
