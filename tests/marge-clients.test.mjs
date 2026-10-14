/* marge-clients.test.mjs — « Notre marge » par client (14/10/2026)
 *
 * Le module commun V2.notreMarge (v2-boot.js) additionne le fichier protégé MARGE_CLIENTS par officine,
 * par période et par commercial ; le Pilotage s'en sert pour sa carte « Notre marge ».
 * Toutes les données ci-dessous sont INVENTÉES (aucun chiffre réel, aucun prix d'achat).
 * On exécute le code livré (v2-boot.js, v2-pilotage.js) sur une fausse fenêtre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

// ── Le module livré, extrait de v2-boot.js (pas une copie) ─────────────────
function extraire(boot, debut, fin) {
  const i = boot.indexOf(debut); assert.ok(i > 0, debut);
  const j = boot.indexOf(fin, i); assert.ok(j > i, fin);
  return boot.slice(i, j + fin.length);
}
const BOOT = lire('v2-boot.js');
const SRC_MODULE = extraire(BOOT, 'V2.notreMarge = (function () {', '})();');
const SRC_EUR = (() => {
  const i = BOOT.indexOf('V2.fmtEur = function'); assert.ok(i > 0);
  let p = 0, j = BOOT.indexOf('{', i), fin = j;
  for (; j < BOOT.length; j++) { if (BOOT[j] === '{') p++; else if (BOOT[j] === '}') { p--; if (p === 0) { fin = j; break; } } }
  return BOOT.slice(i, fin + 1) + ';';
})();
function nouveauV2(donnees) {
  const win = { MARGE_CLIENTS: donnees };
  const V2 = {};
  new Function('V2', 'window', SRC_MODULE + SRC_EUR)(V2, win);
  return { V2, win };
}

// ── Fichier inventé : 2 commerciaux, 3 officines, mai à juillet 2026 ───────
// ligne : [ci, oi, AAAAMM, ca, tot, p, p1, p2, i, c, fr, nr, caGen]
const FAM = ['p', 'p1', 'p2', 'i', 'c', 'fr', 'nr'];
const FICHIER = () => ({
  v: 1, fait: '2026-10-14', jusqua: '2026-07', mois: ['2026-05', '2026-06', '2026-07'],
  reserves: { '2026-06': 'texte de réserve inventé' }, fam: FAM,
  c: ['Alice', 'Bruno'], o: ['2000001', '2000002', '2000003'],
  r: [
    [0, 0, 202605, 1000, 40, 10, 0, 0, 20, 0, 5, 5, 100],   // Alice · officine 1 · mai
    [0, 0, 202606, 2000, 90, 30, 0, 0, 40, 10, 10, 0, 0],   // Alice · officine 1 · juin
    [0, 0, 202607, 3000, 60, 20, 0, 0, 30, 0, 0, 10, 50],   // Alice · officine 1 · juillet
    [1, 0, 202607, 500, 15, 5, 0, 0, 10, 0, 0, 0, 0],       // Bruno · officine 1 · juillet
    [1, 1, 202606, 700, 25, 0, 0, 0, 25, 0, 0, 0, 0],       // Bruno · officine 2 · juin
    [0, 2, 202607, 400, 8, 8, 0, 0, 0, 0, 0, 0, 0],         // Alice · officine 3 · juillet
  ],
});
const somme = (n) => Math.round(n * 100) / 100;

test('somme par officine : toutes périodes, tous commerciaux', () => {
  const { V2 } = nouveauV2(FICHIER());
  const r = V2.notreMarge.somme({ pid: '2000001' });
  assert.equal(r.tot, 40 + 90 + 60 + 15);
  assert.equal(r.ca, 1000 + 2000 + 3000 + 500);
  assert.equal(r.n, 4);
  assert.equal(r.fam.i, 20 + 40 + 30 + 10);
  assert.equal(r.fam.p, 10 + 30 + 20 + 5);
  assert.equal(r.caGen, 150);
  assert.equal(somme(Object.values(r.fam).reduce((a, b) => a + b, 0)), r.tot, 'la somme des familles fait le total');
});

test('bornes de période : mois inclus, mois couverts rendus', () => {
  const { V2 } = nouveauV2(FICHIER());
  const r = V2.notreMarge.somme({ pid: '2000001', du: '2026-06', au: '2026-06' });
  assert.equal(r.tot, 90);
  assert.deepEqual(r.moisCouverts, ['2026-06']);
  const deux = V2.notreMarge.somme({ pid: '2000001', du: '2026-06', au: '2026-12' });
  assert.equal(deux.tot, 90 + 60 + 15);
  assert.deepEqual(deux.moisCouverts, ['2026-06', '2026-07'], 'seuls les mois que le fichier couvre');
  assert.equal(V2.notreMarge.somme({ pid: '2000001', du: '2026-08', au: '2026-09' }).tot, 0, 'période hors fichier : zéro, sans erreur');
  assert.deepEqual(V2.notreMarge.somme({ pid: '2000001', du: '2026-08', au: '2026-09' }).moisCouverts, []);
});

test('filtre par commerciaux : un prénom, une liste, tous (null)', () => {
  const { V2 } = nouveauV2(FICHIER());
  assert.equal(V2.notreMarge.somme({ pid: '2000001', comms: ['Alice'] }).tot, 190);
  assert.equal(V2.notreMarge.somme({ pid: '2000001', comms: ['Bruno'] }).tot, 15);
  assert.equal(V2.notreMarge.somme({ pid: '2000001', comms: null }).tot, 205);
  assert.equal(V2.notreMarge.somme({ pid: '2000001', comms: ['Inconnu'] }).tot, 0, 'prénom absent du fichier : zéro');
  // sans officine : tout le fichier, ou les lignes des commerciaux demandés
  assert.equal(V2.notreMarge.somme({}).tot, 40 + 90 + 60 + 15 + 25 + 8);
  assert.equal(V2.notreMarge.somme({ comms: ['Alice'] }).tot, 40 + 90 + 60 + 8);
  assert.equal(V2.notreMarge.somme({ comms: ['Alice', 'Bruno'], du: '2026-07', au: '2026-07' }).tot, 60 + 15 + 8);
});

test('ensemble d’officines (Set) : la somme des officines', () => {
  const { V2 } = nouveauV2(FICHIER());
  const r = V2.notreMarge.somme({ pid: new Set(['2000002', '2000003']) });
  assert.equal(r.tot, 25 + 8);
  assert.equal(V2.notreMarge.somme({ pid: new Set() }).tot, 0);
});

test('compte restreint : l’officine d’un collègue est absente du fichier réduit → zéro, sans erreur', () => {
  const restreint = FICHIER();
  restreint.c = ['Alice']; restreint.o = ['2000001', '2000003'];
  restreint.r = restreint.r.filter((l) => l[0] === 0).map((l) => [0, l[1] === 2 ? 1 : 0].concat(l.slice(2)));
  const { V2 } = nouveauV2(restreint);
  assert.equal(V2.notreMarge.somme({ pid: '2000002' }).tot, 0, 'officine de Bruno : rien');
  assert.equal(V2.notreMarge.somme({ pid: '2000002' }).n, 0);
  assert.equal(V2.notreMarge.somme({ pid: '2000001', comms: ['Bruno'] }).tot, 0, 'Bruno est absent du jeu d’Alice');
  assert.equal(V2.notreMarge.somme({ pid: '2000001' }).tot, 190, 'ses propres officines : lues');
});

test('fichier absent ou illisible : indisponible, aucune exception', () => {
  for (const d of [undefined, null, {}, { r: [] }]) {
    const { V2 } = nouveauV2(d);
    assert.equal(V2.notreMarge.dispo(), false);
    assert.equal(V2.notreMarge.jusqua(), '');
    assert.deepEqual(V2.notreMarge.mois(), []);
    const r = V2.notreMarge.somme({ pid: '2000001' });
    assert.equal(r.tot, 0); assert.equal(r.n, 0);
    assert.equal(V2.notreMarge.libelleDate(), '');
  }
});

test('familles à 0 € masquées, libellés exacts, note des génériques', () => {
  const { V2 } = nouveauV2(FICHIER());
  const r = V2.notreMarge.somme({ pid: '2000003' });   // 8 € de petits prix et rien d’autre
  const f = V2.notreMarge.familles(r);
  assert.deepEqual(f.map((x) => x.k), ['p']);
  assert.equal(f[0].l, 'Petits prix (moins de 4,33 €)');
  assert.equal(V2.notreMarge.noteGen(r), '', 'pas de CA générique : pas de note');
  const r1 = V2.notreMarge.somme({ pid: '2000001' });
  assert.deepEqual(V2.notreMarge.familles(r1).map((x) => x.k), ['p', 'i', 'c', 'fr', 'nr']);
  assert.equal(V2.notreMarge.noteGen(r1), 'Génériques : comptés à zéro');
  const L = V2.notreMarge.LIBELLES;
  assert.equal(L.p1, 'Petits prix (moins de 3,17 €)'); assert.equal(L.p2, 'De 3,17 à 4,33 €');
  assert.equal(L.i, 'De 4,33 à 468 €'); assert.equal(L.c, 'Plus de 468 €');
  assert.equal(L.fr, 'Chaîne du froid'); assert.equal(L.nr, 'Non remboursés');
});

test('date et réserve : libellé en toutes lettres', () => {
  const { V2 } = nouveauV2(FICHIER());
  assert.equal(V2.notreMarge.libelleDate(), 'estimation, à jour jusqu’à juillet 2026');
  assert.equal(V2.notreMarge.reserve('2026-06'), 'texte de réserve inventé');
  assert.equal(V2.notreMarge.reserve('2026-05'), '');
  assert.equal(V2.notreMarge.nomMoisLong('2026-08'), 'août 2026');
});

test('l’index est construit une fois : un second appel ne reparcourt pas les lignes', () => {
  const d = FICHIER();
  const { V2 } = nouveauV2(d);
  V2.notreMarge.somme({ pid: '2000001' });
  let lectures = 0;
  const brut = d.r.slice();
  d.r = new Proxy(brut, { get(t, k, rc) { if (k === 'forEach' || k === 'length' || /^\d+$/.test(String(k))) lectures++; return Reflect.get(t, k, rc); } });
  // le jeu est le même objet (window.MARGE_CLIENTS = d) : l’index mémorisé sert, les lignes ne sont pas relues
  V2.notreMarge.somme({ pid: '2000001' });
  assert.equal(lectures, 0);
});

// ── La carte du Pilotage branchée sur le module ─────────────────────────────
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
const V = (pharmacyId, commercial, month, qte, puNet) => ({ pharmacyId, year: 2026, month, commercial, artCode: 'x', qte, puNet, mntNetHt: qte * puNet });
const texte = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const carte = (h) => { const i = h.indexOf('pilo-marge"'); const j = h.indexOf('pilo-marge-body', i); const k = h.indexOf('<details', j); return h.slice(i, k); };

function pilotage(fichier, ventes) {
  const win = faireFenetre();
  win.BENCHMARK = []; win.SAGITTA_SHORTLIST = []; win.FROID_CIPS = []; win.MARGE_REGLES = { generiques: [] };
  if (fichier) win.MARGE_CLIENTS = fichier;
  const V2 = win.V2 = {
    pages: {}, user: null, pharmacies: [{ id: '2000001', name: 'P1' }, { id: '2000002', name: 'P2' }], sales: ventes, commFilter: '', ESCALE_COMMS: [],
    commSales() { return V2.commFilter ? V2.sales.filter((s) => s.commercial === V2.commFilter) : V2.sales; },
    commercials() { const s = {}; V2.sales.forEach((x) => { if (x.commercial) s[x.commercial] = 1; }); return Object.keys(s).sort(); },
    esc: (s) => String(s == null ? '' : s), sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
    fmtNum: (n) => (Math.round(n) || 0).toLocaleString('fr-FR'), margeMDLboite: () => 0, tint: () => 'var(--muted)', topbar: () => '', go() {}, render() {},
  };
  V2.fmtK = V2.fmtNum;
  new Function('V2', 'window', SRC_EUR + SRC_MODULE)(V2, win);
  executer(lire('v2-pilotage.js'), win);
  const annee = () => {   // bouton « Année » : l'état de période est privé au module
    const bouton = { dataset: { p: 'year' }, classList: { contains: () => false }, onclick: null };
    const root = { innerHTML: '', querySelector: () => null, querySelectorAll: (sel) => (sel === '.pilo-segbtn' ? [bouton] : []) };
    V2.commFilter = ''; V2.user = { commercial: '', voitTous: true };
    V2.pages.pilotage.render(root); bouton.onclick();
  };
  annee();
  const rendre = (commercial, user) => {
    V2.commFilter = commercial || ''; V2.user = user || { commercial: '', voitTous: true }; V2._piloScopedInit = false;
    const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
    V2.pages.pilotage.render(root); return root.innerHTML;
  };
  return { V2, rendre };
}
// ventes : juin et juillet, les deux commerciaux (CA = ceux du fichier ; la marge de la règle serait différente)
const VENTES = () => [
  V('2000001', 'Alice', 6, 100, 20), V('2000001', 'Alice', 7, 150, 20),   // 2000 € juin, 3000 € juillet
  V('2000001', 'Bruno', 7, 50, 10),                                      // 500 € juillet
  V('2000002', 'Bruno', 6, 70, 10),                                      // 700 € juin
  V('2000003', 'Alice', 7, 40, 10),                                      // 400 € juillet
];

test('Pilotage « Tous » : le total vient du fichier, la carte = la somme du classement', () => {
  const { rendre } = pilotage(FICHIER(), VENTES());
  const h = rendre('');
  const c = carte(h), t = texte(c);
  // juin + juillet : Alice 90 + 60 + 8 = 158 ; Bruno 15 + 25 = 40 ; total 198 €
  assert.ok(c.includes('Notre marge — ce que les ventes rapportent à Intégral'), t.slice(0, 200));
  assert.ok(t.includes('198,00 €'), t.slice(0, 400));
  assert.ok(t.includes('estimation, à jour jusqu’à juillet 2026'), 'mention de date');
  assert.ok(t.includes('Juin 2026 : texte de réserve inventé'), 'réserve du mois de juin');
  assert.ok(!t.includes('règle de secours'), 'rien à rattraper : pas de mention de la règle');
  const iA = c.indexOf('data-c="Alice"'), iB = c.indexOf('data-c="Bruno"');
  assert.ok(iA > 0 && iB > iA, 'Alice devant Bruno');
  assert.ok(c.slice(iA, iB).includes('158,00 €') && c.slice(iB).includes('40,00 €'));
  assert.ok(158 + 40 === 198, 'la somme du classement fait le total de la carte');
  // familles : les non nulles seulement, libellés du module
  assert.ok(t.includes('Petits prix (moins de 4,33 €)') && t.includes('De 4,33 à 468 €') && t.includes('Chaîne du froid'));
  assert.ok(!t.includes('Petits prix (moins de 3,17 €)'), 'famille à 0 € masquée');
  assert.ok(t.includes('Génériques : comptés à zéro'), 'CA générique de juillet (50 €) → la note s’affiche');
});

test('Pilotage : un commercial affiché → son chiffre seul, même périmètre que son CA', () => {
  const { rendre } = pilotage(FICHIER(), VENTES());
  const t = texte(carte(rendre('Bruno')));
  assert.ok(t.includes('40,00 €') && !t.includes('198,00 €'), t.slice(0, 300));
  assert.ok(!t.includes('Alice'));
});

test('Pilotage : compte restreint, fichier réduit à ses prénoms → son chiffre, jamais celui d’un collègue', () => {
  const d = FICHIER();
  d.c = ['Bruno']; d.o = ['2000001', '2000002'];
  d.r = d.r.filter((l) => l[0] === 1);   // ci/oi inchangés : Bruno est l’index 1 dans l’original ; on remet à plat
  d.r = d.r.map((l) => [0, l[1]].concat(l.slice(2)));
  const { rendre } = pilotage(d, VENTES());
  const c = carte(rendre('', { commercial: 'Bruno', voitTous: false }));
  assert.ok(texte(c).includes('40,00 €'), texte(c).slice(0, 300));
  assert.ok(!c.includes('data-c="Alice"') && !c.includes('158,00'), 'rien d’Alice');
});

test('Pilotage : mois mixtes (août hors fichier) → fichier pour juin-juillet + règle pour août, dit en clair', () => {
  const v = VENTES().concat([V('2000001', 'Alice', 8, 1000, 2), V('2000002', 'Bruno', 8, 1000, 2)]);   // août (les deux commerciaux, mois assez fourni pour être « complet ») : 2 × 1000 boîtes à 2 € → règle : 2 × 120 €
  const { rendre } = pilotage(FICHIER(), v);
  const c = carte(rendre('')), t = texte(c);
  assert.ok(t.includes('438,00 €'), '198 € du fichier + 240 € de la règle : ' + t.slice(0, 400));
  assert.ok(t.includes('Août 2026 : règle de secours'), t.slice(0, 500));
  assert.ok(t.includes('Mois sans fichier') && t.includes('240,00 €'), 'la ligne de la règle, séparée des familles du fichier');
});

test('Pilotage : aucun mois couvert (ou fichier absent) → l’ancienne carte, titre « règle de secours »', () => {
  const hors = FICHIER(); hors.mois = ['2025-01']; hors.r = [];
  for (const d of [null, hors]) {
    const { rendre } = pilotage(d, VENTES());
    const c = carte(rendre('')), t = texte(c);
    assert.ok(c.includes('Notre marge — règle de secours'), t.slice(0, 200));
    assert.ok(!t.includes('estimation, à jour jusqu’à'), 'pas de mention de date sans fichier');
    assert.ok(t.includes('petits prix · 0,12 € la boîte'), 'la règle d’origine');
  }
});

test('Pilotage : « Notre marge » et « Marge pharm. » restent deux libellés distincts dans le Top 10', () => {
  const { rendre } = pilotage(FICHIER(), VENTES());
  const t = texte(rendre(''));
  assert.ok(t.includes('Marge pharm.') && t.includes('Notre marge'), 'les deux libellés existent');
  assert.ok(!/Marge nette\s*[0-9]/.test(t), 'jamais « Marge nette » pour notre marge');
});

test('règle de secours 2027 : quatre tranches (détail dans pilotage-marge-commerciaux.test.mjs)', () => {
  const { V2 } = pilotage(null, VENTES());
  const m = V2.piloMargeVente;
  assert.equal(+m({ year: 2027, qte: 10, puNet: 2, mntNetHt: 20 }).toFixed(4), 0.88);
  assert.equal(+m({ year: 2027, qte: 5, puNet: 4, mntNetHt: 20 }).toFixed(4), +(20 * 0.02772).toFixed(4));
  assert.equal(+m({ year: 2027, qte: 5, puNet: 100, mntNetHt: 500 }).toFixed(2), 15.20);
  assert.equal(+m({ year: 2026, qte: 10, puNet: 2, mntNetHt: 20 }).toFixed(2), 1.20, '2026 inchangé');
});
