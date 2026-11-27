// 27/11/2026 — Will : « remettre les à pousser qu'on avait sur la fiche officine », « l'appeler à pousser et juste derrière les 2 propo pdf avant les chiffres »,
// puis « un popup bleu de produits à pousser, genre 20 produits hyper pertinents parmi les meilleures ventes ».
// Ce test garde : la tuile sous les deux listings (avant l'Excel, donc avant les chiffres), dans les deux vues ; sa feuille bleue ;
// et le choix des produits (vrai code d'aPousser, entouré de fausses données) : déjà commandés et génériques écartés, sans prix écarté, 20 au plus,
// classés par la moyenne groupement + réseau, puis montrés du plus grand pourcentage du groupement au plus petit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8');
const corps = (nom) => {
  const i = js.indexOf('function ' + nom + '(');
  assert.ok(i > 0, nom + ' introuvable');
  return js.slice(i, js.indexOf('\n  }\n', i) + 4);
};

test('à pousser : la tuile vient juste après les deux listings et avant l Excel, dans les deux vues', () => {
  const b = corps('fdrListings');
  assert.match(b, /tuile\('pousser', 'pousser', 'À pousser'/);
  const iRow = b.indexOf("'<div class=\"flg-row' + (deux"), iAp = b.indexOf("+ ap + x + '</section>'");
  assert.ok(iRow > 0 && iAp > iRow, 'la tuile doit suivre la rangée des deux listings');
  assert.ok(!b.includes('vi-int'), 'la tuile ne doit pas être cachée en vue pharmacien');
  assert.match(corps('fdrPage'), /<div class="fdo-main">' \+ fdrListings\(c\) \+ rv2Bandes\(c\)/, 'le bloc doit rester en tête, avant les chiffres');
});

test('à pousser : la tuile ouvre SA feuille, bleue, avec les produits', () => {
  assert.match(js, /else if \(k === 'pousser'\) f = fbFeuillePousser\(\);/);
  const f = corps('fbFeuillePousser');
  assert.match(f, /cls: 'fbs-bleu'/);
  assert.match(f, /t: 'À pousser'/);
  assert.match(js, /o\.className = 'fbs' \+ \(f\.cls \? ' ' \+ f\.cls : ''\);/);
  assert.match(css, /\.fbs\.fbs-bleu \.fbs-p\{[^}]*background-color:#0050E6/);
  assert.match(css, /\.pha-wrap\.fdr-on \.fdr \.flg-ap \.flg-b\{[^}]*background-color:#0050E6/);
});

// Vrai code d'aPousser dans une fausse fenêtre : 3 officines dans son groupement (elle comprise), 10 dans le réseau
function lancer(opts) {
  const net = new Map(), grp = new Map();
  const ajoute = (m, cip, n, qte) => m.set(cip, { ph: { size: n }, qte: qte || n * 10 });
  opts.net.forEach((r) => ajoute(net, r[0], r[1], r[3]));
  opts.grp.forEach((r) => ajoute(grp, r[0], r[1]));
  const bench = new Map(opts.bench.map((b) => [b.cip13, b]));
  const ctx = {
    cipStats() {},
    groupementPids: () => ({ name: 'GRP', set: opts.sansGrp ? null : new Set(['P', 'Q', 'R']) }),
    computeStats: (k) => (k === '__net__' ? { map: net, total: 10 } : { map: grp, total: 3 }),
    benchIndex: () => bench,
    pharmaSales: () => opts.achats.map((c) => ({ artCode: c })),
    classify: (b) => b.cat,
    V2: { bestPrice: (b) => ({ ip: b.ip }) }
  };
  const f = new Function(...Object.keys(ctx), corps('aPousser') + '\nreturn aPousser;')(...Object.values(ctx));
  return f('P', opts.n);
}
const B = (cip, cat, ip) => ({ cip13: cip, designation: 'PRODUIT ' + cip, cat, ip: ip == null ? 5 : ip });

test('à pousser : écarte déjà commandés, génériques, sans prix ; classe par moyenne groupement + réseau', () => {
  const r = lancer({
    net: [['1000001', 9], ['1000002', 8], ['1000003', 5], ['1000004', 9], ['1000005', 9], ['1000006', 9], ['1000007', 2]],
    grp: [['1000003', 3], ['1000007', 3]],
    bench: [B('1000001', 'mi'), B('1000002', 'gen'), B('1000003', 'pp'), B('1000004', 'genp'), B('1000005', 'mi', 0), B('1000006', 'nr'), B('1000007', 'froid')],
    achats: ['1000006']
  });
  // 1000003 : (3/3 + 5/10)/2 = 0,75 ; 1000007 : (1 + 0,2)/2 = 0,6 ; 1000001 : (0 + 0,9)/2 = 0,45
  assert.deepEqual(r.rows.map((x) => x.cip), ['1000003', '1000007', '1000001']);
  assert.equal(r.grp, 'GRP');
  assert.equal(r.nGrp, 3);
  assert.equal(r.nNet, 10);
});

test('à pousser : sans groupement, le réseau seul ; 20 produits au plus', () => {
  const net = [], bench = [];
  for (let i = 0; i < 30; i++) { const c = String(2000000 + i); net.push([c, 1 + (i % 10)]); bench.push(B(c, 'mi')); }
  const r = lancer({ net, grp: [], bench, achats: [], sansGrp: true, n: 20 });
  assert.equal(r.rows.length, 20);
  assert.equal(r.grp, '');
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i - 1].score >= r.rows[i].score, 'mal classé');
  assert.equal(r.rows[0].score, 1);
});

// 27/11/2026 — Will, choix cliqué « Remettre dans l'ordre » : mêmes produits choisis (moyenne groupement + réseau),
// mais montrés du plus grand pourcentage affiché (part de son groupement) au plus petit.
test('à pousser : mêmes produits retenus, montrés du plus grand pourcentage du groupement au plus petit', () => {
  const r = lancer({
    net: [['3000001', 9], ['3000002', 4], ['3000003', 1], ['3000004', 10]],
    grp: [['3000001', 2], ['3000002', 3], ['3000003', 3]],
    bench: [B('3000001', 'mi'), B('3000002', 'pp'), B('3000003', 'nr'), B('3000004', 'mi')],
    achats: [], n: 3
  });
  // moyennes : 3000001 = (2/3 + 0,9)/2 ≈ 0,78 ; 3000002 = (1 + 0,4)/2 = 0,7 ; 3000003 = (1 + 0,1)/2 = 0,55 ; 3000004 = (0 + 1)/2 = 0,5 → écarté (4e)
  // affichage : 3000002 (100 %) et 3000003 (100 %, départagés par la moyenne), puis 3000001 (67 %)
  assert.deepEqual(r.rows.map((x) => x.cip), ['3000002', '3000003', '3000001']);
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i - 1].pg >= r.rows[i].pg, 'pourcentages pas dans l’ordre');
});
