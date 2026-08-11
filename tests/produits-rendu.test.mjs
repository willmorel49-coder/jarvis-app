/* Rend l'ecran Produits dans un faux DOM et verifie le HTML PRODUIT.
   Pas de navigateur, pas de npm : un objet `document` minimal suffit, la page
   ne touche que getElementById / createElement / head.appendChild / innerHTML.
   Interet : la regle metier « aucun abandon de marge sur un generique ou un NR »
   se verifie sur ce que le commercial VOIT, pas sur les donnees en amont. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, B), 'utf8');

const styles = [];
// Le faux DOM doit se souvenir des elements poses : sinon getElementById rend
// toujours null et la page reinjecte sa feuille de style a chaque rendu — un
// faux echec qui n'existe pas dans un navigateur.
const parId = {};
const doc = {
  getElementById: (id) => parId[id] || null,
  createElement: () => ({ id: '', textContent: '' }),
  head: {
    appendChild: (el) => {
      if (el.id) parId[el.id] = el;
      styles.push(el.textContent || '');
    },
  },
};
// Dans un navigateur, `window` EST l'objet global : on le reproduit, sinon
// `window.V2 = ...` ne cree pas la variable globale V2 que le code utilise.
const sb = { document: doc, console, setTimeout, clearTimeout, URL, Blob, Date };
sb.window = sb;
sb.globalThis = sb;
vm.createContext(sb);

vm.runInContext(
  ['wml-officines-data.js', 'stock-data.js', 'prod-stats-data.js', 'ruptures-data.js']
    .map(lire).join('\n;\n') +
  '\n;window.WML_OFFICINES = typeof WML_OFFICINES !== "undefined" ? WML_OFFICINES : window.WML_OFFICINES;' +
  'window.WML_SALES = typeof WML_SALES !== "undefined" ? WML_SALES : window.WML_SALES;', sb);

// Stubs V2 : memes contrats que v2-app.js.
vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[],
  esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
  fmtEur: n => Math.round(+n||0).toLocaleString('fr-FR') + ' €',
  fmtNum: n => Math.round(+n||0).toLocaleString('fr-FR'),
  topbar: () => '<header></header>', go: () => {}, toast: () => {}, render: () => {} };
  window.ICO = () => '';`, sb);

vm.runInContext(lire('v2-produits-moteur.js'), sb);
vm.runInContext(lire('v2-produits.js'), sb);
vm.runInContext(`V2.pharmacies = window.WML_OFFICINES.map(p => ({ id:String(p.id), name:p.name, groupement:p.groupement, cp:p.cp, ca:p.ca }));
  V2.sales = window.WML_SALES.map(s => ({ pharmacyId:String(s[0]), artCode:s[3], qte:s[4]||0, mntNetHt:s[6]||0 }));`, sb);

const officine = sb.V2.pharmacies.find((p) => /CARREFOUR/i.test(p.name || '')) || sb.V2.pharmacies[0];
const root = { innerHTML: '' };
sb.V2.produits.S.ph = String(officine.id);
sb.V2.pages.produits.render(root, String(officine.id));
const h = root.innerHTML;
const blocs = h.split('<div class="pr-row">').slice(1);

test('rendu : la page produit du HTML et des lignes', () => {
  assert.ok(h.length > 5000, `HTML trop court : ${h.length} caracteres`);
  assert.ok(blocs.length > 0, 'aucune ligne produit rendue');
});

test('rendu : l officine et son groupe de comparaison sont nommes', () => {
  assert.ok(h.includes(officine.name), 'nom de l officine absent');
  assert.ok(/confr[eè]res|officines comparables|officines de taille comparable/.test(h),
    'le groupe de comparaison n est pas nomme');
});

test('rendu : la fraicheur des donnees est mentionnee, une seule fois', () => {
  const n = (h.match(/ventes réseau jan\.–juin 2026/g) || []).length;
  assert.equal(n, 1, `mention de date presente ${n} fois`);
});

test('rendu : les quatre chiffres de chaque ligne sont la', () => {
  for (const lib of ['potentiel', 'prix net', 'abandon de marge', 'en stock']) {
    assert.ok(h.includes('<em>' + lib + '</em>'), `colonne « ${lib} » absente`);
  }
});

test('REGLE METIER : aucune ligne non-princeps n affiche d abandon chiffre', () => {
  let nonPrinceps = 0;
  const fautifs = [];
  for (const b of blocs) {
    const fam = (b.match(/class="pr-fam"[^>]*>([^<]+)</) || [])[1] || '';
    if (/Princeps/.test(fam)) continue;
    nonPrinceps++;
    const ab = (b.match(/<span>([^<]*)<\/span><em>abandon de marge<\/em>/) || [])[1];
    if (ab !== '—') fautifs.push(`${fam} → ${ab}`);
  }
  assert.ok(nonPrinceps > 0, 'aucune ligne non-princeps dans l echantillon');
  assert.deepEqual(fautifs, [], `lignes fautives : ${fautifs.join(' | ')}`);
});

test('VOCABULAIRE : le mot proscrit n apparait pas dans le rendu', () => {
  assert.ok(!/remise/i.test(h), 'le rendu contient le mot proscrit');
});

test('mobile : la grille de chiffres se replie sous 430 px', () => {
  assert.equal(styles.length, 1, 'la feuille de style doit etre injectee une seule fois');
  assert.ok(styles[0].includes('max-width:430px'), 'pas de repli mobile');
  assert.ok(!/backdrop-filter|background-clip: *text/.test(styles[0]),
    'effet interdit sur Safari present dans les styles');
});

test('mobile : les cibles tactiles font au moins 44 px', () => {
  for (const sel of ['.pr-mode', '.pr-select', '.pr-search', '.pr-plus']) {
    const bloc = styles[0].split(sel + '{')[1] || '';
    assert.ok(/min-height:44px/.test(bloc.slice(0, 200)), `${sel} sous 44 px`);
  }
});

test('iOS : les champs de saisie font au moins 16 px', () => {
  const bloc = styles[0].split('.pr-search input{')[1] || '';
  assert.ok(/font-size:16px/.test(bloc.slice(0, 200)), 'champ sous 16 px : iOS zoomera');
});

// ── Mode Achats ────────────────────────────────────────────────────
sb.V2.produits.S.mode = 'achats';
const rootA = { innerHTML: '' };
sb.V2.pages.produits.render(rootA, null);
const hA = rootA.innerHTML;
const blocsA = hA.split('<div class="pr-row">').slice(1);

test('achats : la vue par produit rend des lignes', () => {
  assert.ok(blocsA.length > 0, 'aucune ligne rendue en mode Achats');
  assert.ok(/ne nous le prennent pas/.test(hA), 'l argument achats est absent');
});

test('achats : le selecteur liste les groupements, le plus gros en tete', () => {
  const noms = [...hA.matchAll(/<option value="[^"]*"[^>]*>([^·<]+) · (\d+) officines</g)]
    .map((m) => ({ nom: m[1].trim(), n: +m[2] }));
  assert.ok(noms.length > 50, `seulement ${noms.length} groupements listes`);
  for (let i = 1; i < noms.length; i++) {
    assert.ok(noms[i - 1].n >= noms[i].n,
      `${noms[i - 1].nom} (${noms[i - 1].n}) avant ${noms[i].nom} (${noms[i].n})`);
  }
  assert.equal(noms[0].nom, 'UPP', `attendu UPP en tete, obtenu ${noms[0].nom}`);
});

test('achats : la couverture est en mois ou « — », jamais infinie', () => {
  for (const b of blocsA) {
    const c = (b.match(/<span>([^<]*)<\/span><em>couverture<\/em>/) || [])[1];
    assert.ok(c === '—' || /^(> 24 mois|[\d ,]+ mois)$/.test(c),
      `couverture illisible : « ${c} »`);
  }
});

test('achats : « ce qu on n a pas » ne montre que du stock a zero', () => {
  sb.V2.produits.S.horsStock = true;
  const r = { innerHTML: '' };
  sb.V2.pages.produits.render(r, null);
  const bl = r.innerHTML.split('<div class="pr-row">').slice(1);
  assert.ok(bl.length > 0, 'aucun produit hors stock remonte');
  for (const b of bl) {
    const st = (b.match(/<span>([^<]*)<\/span><em>en stock<\/em>/) || [])[1];
    assert.equal(st, '0', `produit avec un stock de ${st} dans « ce qu on n a pas »`);
  }
  sb.V2.produits.S.horsStock = false;
});
