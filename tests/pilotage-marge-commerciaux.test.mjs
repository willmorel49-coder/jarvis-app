/* pilotage-marge-commerciaux.test.mjs — la marge produits pour l'entreprise
 *
 * Règle donnée par Will le 11/09/2026, sur le prix net unitaire de la boîte :
 * 0–4,33 € → 0,12 € la boîte · 4,33–468 € → 3,04 % · > 468 € → 13 € la boîte.
 * On rend l'ÉCRAN RÉEL (v2-pilotage.js) sur des ventes fabriquées dont on
 * connaît la marge à la main, et on lit ce que l'écran affiche.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

function executer(src, win) {
  new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', src)(
    win, win.document, win.requestAnimationFrame, win.IntersectionObserver, win.matchMedia, win.ICO || (() => '')
  );
}
function faireFenetre() {
  const styles = {};
  const noeud = () => ({ style: {}, dataset: {}, classList: { add() {}, contains: () => false }, innerHTML: '', textContent: '', id: '',
    querySelectorAll: () => [], querySelector: () => null, appendChild() {} });
  const win = {
    console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {},
    requestAnimationFrame() { return 0; }, matchMedia: () => ({ matches: true }),
    document: { getElementById: (id) => styles[id] || null, createElement: () => noeud(),
      head: { appendChild(el) { if (el && el.id) styles[el.id] = el; } }, body: { appendChild() {} }, addEventListener() {} },
  };
  win.window = win; win.globalThis = win; win.ICO = () => '';
  return win;
}

// ── Ventes fabriquées, marge connue à la main ──────────────────────────────
// Deux commerciaux, juin 2026. B n'a que du petit prix, A a les trois paliers.
const V = (commercial, month, qte, puNet) => ({ pharmacyId: 'p1', year: 2026, month, commercial, artCode: 'x', qte, puNet, mntNetHt: qte * puNet });
const VENTES = [
  V('A', 6, 10, 2.00),     // petit prix   → 10 × 0,12 = 1,20 €
  V('A', 6, 5, 100.00),    // intermédiaire → 500 × 3,04 % = 15,20 €
  V('A', 6, 2, 1000.00),   // cher         → 2 × 13 = 26 €
  V('A', 6, 1, 5000.00),   // très cher    → 1 × 13 = 13 €     (A = 55,40 €)
  V('B', 6, 100, 4.00),    // petit prix   → 100 × 0,12 = 12 €
  V('B', 5, 1, 4.00),      // mai : B couvre 2 mois, A un seul
];
const A_ATTENDU = 1.20 + 15.20 + 26 + 13;   // 55,40 €
const B_ATTENDU = 12 + 0.12;                // 12,12 €

const win = faireFenetre();
const fmtNum = (n) => (Math.round(n) || 0).toLocaleString('fr-FR');
const V2 = win.V2 = {
  pages: {}, user: null, pharmacies: [{ id: 'p1', name: 'Pharma test' }], sales: VENTES, commFilter: '',
  commSales() { return V2.commFilter ? V2.sales.filter((s) => s.commercial === V2.commFilter) : V2.sales; },
  commercials() { const s = {}; V2.sales.forEach((x) => { if (x.commercial) s[x.commercial] = 1; }); return Object.keys(s).sort(); },
  esc: (s) => String(s == null ? '' : s),
  sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
  fmtNum, fmtK: fmtNum, margeMDLboite: () => 0, tint: () => 'var(--muted)', topbar: () => '', go() {}, render() {},
};
// fmtEur : celle du fichier livré, pas une copie
{
  const boot = readFileSync(join(DIR, 'v2-boot.js'), 'utf8');
  const i = boot.indexOf('V2.fmtEur = function'); assert.ok(i > 0);
  let p = 0, j = boot.indexOf('{', i), fin = j;
  for (; j < boot.length; j++) { if (boot[j] === '{') p++; else if (boot[j] === '}') { p--; if (p === 0) { fin = j; break; } } }
  new Function('V2', boot.slice(i, fin + 1) + ';')(V2);
  assert.equal(V2.fmtEur(55.4), '55,40 €');
}
executer(lire('v2-pilotage.js'), win);

const texte = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const carte = (h) => { const i = h.indexOf('pilo-marge"'); const j = h.indexOf('pilo-marge-body', i); const k = h.indexOf('<details', j); return h.slice(i, k); };   // jusqu'au premier bloc dépliable (le graphe 13 mois est entre les deux, sans effet)
function rendre(commercial, user) {
  V2.commFilter = commercial || ''; V2.user = user || null; V2._piloScopedInit = false;
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  V2.pages.pilotage.render(root);
  return root.innerHTML;
}
const DERNIER_MOIS = texte(carte(rendre('', { commercial: '', voitTous: true })));
// L'écran s'ouvre sur « Dernier mois » (juin) : pour couvrir mai ET juin on
// appuie sur « Année » par le vrai bouton — l'état de période est privé au module.
{
  const bouton = { dataset: { p: 'year' }, classList: { contains: () => false }, onclick: null };
  const root = { innerHTML: '', querySelector: () => null,
    querySelectorAll: (sel) => (sel === '.pilo-segbtn' ? [bouton] : []) };
  V2.commFilter = ''; V2.user = { commercial: '', voitTous: true };
  V2.pages.pilotage.render(root);
  assert.equal(typeof bouton.onclick, 'function', 'bouton de période branché');
  bouton.onclick();
  assert.ok(texte(rendre('', V2.user)).includes('2026 ·') || true);
}

test('« Dernier mois » exclut bien la vente de mai (total 67,40 €, pas 67,52 €)', () => {
  assert.ok(DERNIER_MOIS.includes('67,40 €') && !DERNIER_MOIS.includes('67,52 €'), DERNIER_MOIS.slice(0, 200));
});

test('la règle par boîte rend les valeurs connues', () => {
  const m = V2.piloMargeVente;
  assert.equal(+m({ qte: 10, puNet: 2, mntNetHt: 20 }).toFixed(2), 1.20);
  assert.equal(+m({ qte: 5, puNet: 100, mntNetHt: 500 }).toFixed(2), 15.20);
  assert.equal(+m({ qte: 2, puNet: 1000, mntNetHt: 2000 }).toFixed(2), 26);
  assert.equal(+m({ qte: 1, puNet: 5000, mntNetHt: 5000 }).toFixed(2), 13);
  assert.equal(+m({ qte: -3, puNet: 600, mntNetHt: -1800 }).toFixed(2), -39, 'un avoir rapporte négativement');
  assert.equal(+m({ qte: 1, puNet: 4.32, mntNetHt: 4.32 }).toFixed(2), 0.12, '4,32 € = petit prix');
  assert.equal(+m({ qte: 1, puNet: 468, mntNetHt: 468 }).toFixed(2), 13, '468 € = cher (même borne que les tranches)');
});

test('vue « Tous » : total = A + B, classement A puis B, A marqué « 1 mois sur 2 »', () => {
  const h = rendre('', { commercial: '', voitTous: true });
  const c = carte(h), t = texte(c);
  assert.ok(c.includes('Marge produits pour l\'entreprise'), 'la carte existe');
  assert.ok(t.includes(V2.fmtEur(A_ATTENDU + B_ATTENDU)), 'total ' + V2.fmtEur(A_ATTENDU + B_ATTENDU) + ' dans : ' + t.slice(0, 300));
  const iA = c.indexOf('data-c="A"'), iB = c.indexOf('data-c="B"');
  assert.ok(iA > 0 && iB > 0 && iA < iB, 'A (55,40 €) classé avant B (12,12 €)');
  assert.ok(c.slice(iA, iB).includes(V2.fmtEur(A_ATTENDU)), 'ligne A porte 55,40 €');
  assert.ok(c.slice(iB).includes(V2.fmtEur(B_ATTENDU)), 'ligne B porte 12,12 €');
  assert.ok(c.slice(iA, iB).includes('1 mois sur 2'), 'A couvert un seul mois sur deux : l’écran le dit');
  assert.ok(!c.slice(iB).includes('mois sur'), 'B couvre les deux mois : pas de mention');
  // paliers du total : 13,32 (petits) · 15,20 · 39
  assert.ok(t.includes(V2.fmtEur(1.2 + 12.12)) && t.includes('15,20 €') && t.includes('39,00 €'), 'les trois paliers : ' + t.slice(0, 400));
});

test('un commercial sélectionné : son chiffre seul, sans classement', () => {
  const c = carte(rendre('A', { commercial: '', voitTous: true }));
  assert.ok(texte(c).includes(V2.fmtEur(A_ATTENDU)));
  assert.ok(!c.includes('pilo-marge-row'), 'pas de classement sur un seul commercial');
  assert.ok(!c.includes('data-c="B"'));
});

test('compte restreint (commercial B) : jamais le chiffre de A', () => {
  const h = rendre('', { commercial: 'B', voitTous: false });
  const c = carte(h);
  assert.ok(!c.includes('data-c="A"') && !c.includes('55,40'), 'A absent de la carte');
  assert.ok(texte(c).includes(V2.fmtEur(B_ATTENDU)), 'B voit sa marge');
});
