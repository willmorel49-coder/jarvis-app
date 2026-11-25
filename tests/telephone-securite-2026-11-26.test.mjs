// 26/11/2026 — Écran « Sécurité » refusé (audit du 25/11, SEC-1 ; accord de Will du 25/11 : change aussi à l'ordinateur).
// Avant : un compte qui n'y a pas droit voyait une COCHE (« validé ») à côté de « Écran réservé. », sans un mot d'explication.
// Ce que ce test garde, sur le vrai code : l'icône « lock » existe dans la liste des icônes (une icône inconnue retombe
// sur un chevron, sans erreur : le défaut ne se verrait pas), le message de refus la montre, et dit pourquoi en une phrase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const icons = lire('v2-icons.js'), sec = lire('v2-securite.js');

// le vrai fichier des icônes, chargé comme dans la page
const sb = { window: {} }; vm.createContext(sb); vm.runInContext(icons, sb);
const ICO = sb.window.ICO;

test('icônes : « lock » est un cadenas, défini une seule fois, et pas le chevron de repli', () => {
  assert.equal((icons.match(/^\s*'lock':/gm) || []).length, 1, 'une seule entrée « lock »');
  const cadenas = ICO('lock', 26, 1.8);
  assert.notEqual(cadenas, ICO('icone-qui-n-existe-pas', 26, 1.8), '« lock » ne retombe pas sur l\'icône de repli');
  assert.match(cadenas, /<rect [^>]*rx="2"\/><path d="M8\.5 10\.5V8a3\.5 3\.5 0 0 1 7 0v2\.5"\/>/, 'un corps et une anse');
  assert.match(cadenas, /^<svg width="26" height="26" viewBox="0 0 24 24"[^>]*stroke-width="1\.8"/);
  assert.equal(ICO('check', 26, 1.8), '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17.5 19 6.5"/></svg>', 'la coche existante n\'est pas touchée');
});

// le vrai message() de l'écran et le vrai appel du refus, avec les vraies icônes
function refus() {
  const fn = (sec.match(/\n  function message\(root, titre, texte, bouton\) \{[\s\S]*?\n  \}\n/) || [])[0];
  const appel = (sec.match(/if \(acces === false\) \{ (message\(root, [^;]+\);) return; \}/) || [])[1];
  assert.ok(fn, 'message() introuvable'); assert.ok(appel, 'appel du refus introuvable');
  const root = {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  new Function('root', 'ICO', 'esc', 'css', 'top', fn + '\n' + appel)(root, ICO, esc, () => {}, () => '');
  return root.innerHTML;
}

test('Sécurité refusée : un cadenas (plus de coche), le titre, et une phrase qui dit pourquoi', () => {
  const html = refus();
  assert.match(html, /<div class="mp-lock"><svg [^>]*><rect [^>]*\/><path d="M8\.5 10\.5V8a3\.5[^"]*"\/><\/svg><\/div>/, 'le carré montre le cadenas : ' + html);
  assert.ok(!html.includes('M5 12.5 10 17.5 19 6.5'), 'plus de coche dans le message');
  assert.match(html, /<h1 class="mp-et">Écran réservé\.<\/h1><p>Cet écran n’est pas ouvert pour votre compte\.<\/p>/, html);
  assert.doesNotMatch(sec, /<div class="mp-lock">' \+ ICO\('check'/, 'la coche n\'est plus appelée dans le carré du message');
});
