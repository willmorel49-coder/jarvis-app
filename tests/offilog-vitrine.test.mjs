// « Le catalogue Offilog » (module v2-offilog-vitrine.js) : sur des données FACTICES.
// 100 / 200 / 300 produits exactement, 8 nouveautés à 100 et 12 à 200/300 comprises dans N, rangs affichés 1..N contigus,
// aucune date écrite en dur (elles viennent des données), tarif labo absent = rien d'affiché,
// nouveautés jamais citées avec un rang brut de l'historique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog-vitrine.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog-vitrine.css'), 'utf8');
const ean = (i) => String(4000000000000 + i);
const RELEVES = ['2031-01-05', '2031-02-09', '2031-03-14'];

// 1 800 produits, le rang du marché suit le numéro. Un produit sur dix n'a pas de prix (hors catalogue) : la position dans
// la liste n'est donc jamais le rang brut. Un produit sur 37 (reste 5) est une nouveauté : absent du premier relevé.
function monter(opts = {}) {
  const rel = opts.releves || RELEVES;
  const items = [];
  for (let i = 1; i <= 1800; i++) {
    const nouveau = i % 37 === 5;
    const serie = nouveau ? [null, i + 1000, i] : [i, i, i];
    const tarifOk = i % 3 === 0;
    const verif = i % 12 === 0;   // douteux : jamais de tarif affiché
    items.push({
      id: String(i), name: 'MARQ' + (i % 9) + ' – Produit ' + i, brand: 'MARQ' + (i % 9), ean: ean(i),
      price: i % 10 === 0 ? 0 : 5 + (i % 7), sousRayon: ['Santé', 'Soins du visage', 'Bébé', 'Hygiène', 'Rayon inconnu'][i % 5],
      mkt: { rang: i, prec: i, serie, dates: rel, sorti: i === 17 },
      pcat: tarifOk ? { prix: 12 } : null, pcatVerif: verif, pcatRatio: tarifOk ? 0.25 : null,
    });
  }
  if (opts.modif) opts.modif(items);
  const V2 = { offilogItems: () => items, toast() {} };
  const win = { V2, console, setTimeout, clearTimeout, document: { currentScript: { src: 'https://exemple.test/crm/v2/v2-offilog-vitrine.js?v=1' } }, OFFILOG_MARCHE: { releves: rel }, OFFILOG_CATALOGUE: { maj: 'prix' in opts ? opts.prix : '2031-03-20' } };
  // liste des marques à retirer : par défaut une marque inventée qui ne touche aucun produit du jeu d'essai ; 'absent' = pas de liste
  if (opts.exclus !== 'absent') win.OFFILOG_EXCLUS = opts.exclus || { maj: '2031-03-01', marques: ['zzmarque'], eans: [], prefixes: [] };
  if (opts.cut) win.OFFILOG_CUT = opts.cut;
  if (opts.img) win.OFFILOG_IMG = opts.img;
  if (opts.nouv) win.OFFILOG_NOUVEAUTES = opts.nouv;
  if (opts.cats) win.OFFILOG_CATS = opts.cats;
  win.window = win;
  vm.runInContext(SRC, vm.createContext(win));
  return win.V2;
}
const tab = (a) => Array.from(a);

test('100, 200, 300 produits exactement ; 8 nouveautés à 100, 12 à 200 et 300, comprises dans N', () => {
  const V2 = monter();
  const vus = {};
  for (const [n, k] of [[100, 8], [200, 12], [300, 12]]) {
    const D = V2.offVitrineDonnees(n);
    assert.equal(D.produits.length, n);
    assert.equal(D.nouveautes.length, k);
    const eans = tab(D.produits.map((p) => p.ean));
    assert.equal(new Set(eans).size, n, 'aucun produit en double');
    for (const nv of D.nouveautes) assert.ok(eans.includes(nv.ean), 'la nouveauté est dans les N produits');
    assert.ok(D.nouveautes.every((p) => p.pos <= 1500), 'nouveauté classée dans les 1 500 premiers de la liste');
    vus[n] = tab(D.nouveautes.map((p) => p.ean));
  }
  assert.deepEqual(vus[100], vus[200].slice(0, 8), 'les 8 de 100 sont les 8 premières des 12');
  assert.deepEqual(vus[200], vus[300]);
  // contre-épreuve : un produit absent du dernier relevé (sorti) n'est jamais dans le catalogue
  assert.ok(!tab(V2.offVitrineDonnees(300).produits.map((p) => p.ean)).includes(ean(17)));
});

test('rangs affichés 1..N contigus, jamais le rang brut de l\'historique', () => {
  const V2 = monter();
  for (const n of [100, 200, 300]) {
    const D = V2.offVitrineDonnees(n);
    assert.deepEqual(tab(D.produits.map((p) => p.rang)), Array.from({ length: n }, (_, i) => i + 1));
    // la liste est dans l'ordre du classement
    assert.ok(D.produits.every((p, i) => i === 0 || p.pos > D.produits[i - 1].pos));
  }
  const D = V2.offVitrineDonnees(100), html = V2.offVitrineHtml(100);
  const brut = (p) => Number(p.ean) - 4000000000000;   // le rang du marché = le numéro
  assert.ok(D.produits.some((p) => p.rang !== brut(p)), 'le jeu d\'essai distingue bien rang affiché et rang brut');
  for (const p of D.produits) {
    const art = new RegExp('<article class="(?:fiche|scene)[^"]*" data-ean="' + p.ean + '"[\\s\\S]*?</article>').exec(html);
    assert.ok(art, 'fiche de ' + p.ean);
    // une carte « Nouveauté » ne porte aucun numéro (choix de Will) ; les autres portent leur place 1..N
    if (D.nouveautes.some((x) => x.ean === p.ean)) { assert.ok(!/n°\s?\d/.test(art[0]), 'nouveauté sans numéro : ' + p.ean); continue; }
    assert.ok(art[0].includes('n° ' + p.rang + ' des ventes') || art[0].includes('n° ' + p.rang + ' des ventes') || art[0].includes('n° ' + p.rang.toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' des ventes'), 'rang affiché de ' + p.ean);
  }
  assert.equal((html.match(/data-ean="/g) || []).length, 100, 'un produit = une fiche');
});

test('nouveautés : « apparu au relevé du … · N places gagnées », aucun rang brut cité', () => {
  const V2 = monter();
  const html = V2.offVitrineHtml(200), D = V2.offVitrineDonnees(200);
  for (const p of D.nouveautes) {
    const num = Number(p.ean) - 4000000000000;                  // rang brut au dernier relevé
    const premier = num + 1000;                                  // rang brut à l'entrée
    assert.equal(p.gain, 1000);
    assert.equal(p.entree, RELEVES[1]);
    const art = new RegExp('<article class="scene[^"]*" data-ean="' + p.ean + '"[\\s\\S]*?</article>').exec(html)[0];
    const ph = /<div class="ph">([^<]*)<\/div>/.exec(art)[1];
    assert.equal(ph, 'Apparu au relevé du 9 février · 1 000 places gagnées depuis.');
    assert.ok(!ph.includes(String(premier)) && !ph.includes(String(num)), 'pas de rang brut dans la phrase');
    assert.ok(!art.includes(String(premier)), 'le rang brut d\'entrée n\'est écrit nulle part dans la scène');
  }
  assert.doesNotMatch(html, /rangs?\s*[:=]\s*\[/);
});

test('tarif labo absent : rien d\'affiché (jamais deviné) ; présent : écart arrondi', () => {
  const V2 = monter();
  const D = V2.offVitrineDonnees(300), html = V2.offVitrineHtml(300);
  const sans = D.produits.filter((p) => p.tarif == null), avec = D.produits.filter((p) => p.tarif != null);
  assert.ok(sans.length > 50 && avec.length > 50, 'les deux cas existent dans le jeu d\'essai');
  assert.ok(sans.every((p) => p.pct == null));
  assert.ok(avec.every((p) => p.tarif === 12 && p.pct === 25));
  // les douteux (pcatVerif) sont sans tarif, même si le fichier en a un
  assert.ok(D.produits.filter((p) => Number(p.ean) % 12 === 4000000000000 % 12 && (Number(p.ean) - 4000000000000) % 12 === 0).every((p) => p.tarif == null));
  for (const p of sans) {
    const art = new RegExp('<article class="(?:fiche|scene)[^"]*" data-ean="' + p.ean + '"[\\s\\S]*?</article>').exec(html)[0];
    assert.doesNotMatch(art, /tarif labo|class="ecart"/, 'rien sur le tarif pour ' + p.ean);
  }
  for (const p of avec) {
    const art = new RegExp('<article class="(?:fiche|scene)[^"]*" data-ean="' + p.ean + '"[\\s\\S]*?</article>').exec(html)[0];
    assert.match(art, /class="ecart"/);
    assert.ok(art.includes('\u221225 %') && art.includes('tarif labo 12,00\u00a0€'));
  }
  assert.equal(D.avec_tarif, avec.length, 'la couverture comptée est celle affichée');
});

test('aucune date écrite en dur : elles viennent des données', () => {
  // le code ne contient aucune année ni aucun nom de mois (hors commentaires)
  const sansCommentaires = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(sansCommentaires, /\b(19|20)\d\d\b/, 'pas d\'année dans le code');
  assert.doesNotMatch(sansCommentaires, /janvier|février|mars|avril|\bmai\b|\bjuin\b|juillet|août|septembre|octobre|novembre|décembre/i);
  assert.doesNotMatch(CSS.replace(/www\.w3\.org\/2000\/svg/g, ''), /\b(19|20)\d\d\b/, 'pas de date dans la feuille (hors espace de noms SVG)');
  const V2 = monter();
  const D = V2.offVitrineDonnees(100), html = V2.offVitrineHtml(100);
  assert.equal(D.prix_du, '2031-03-20');
  assert.equal(D.classement_du, RELEVES[2]);
  assert.match(html, /Prix HT au 20 mars 2031/);
  assert.match(html, /Classement des ventes du 14 mars 2031/);
  assert.match(html, /relevé du 5 janvier/);
  assert.doesNotMatch(html, /2026|2027/);
  // les mêmes données avec d'autres dates : tout change, rien ne reste
  const autre = monter({ releves: ['2044-06-01', '2044-07-02', '2044-08-03'], prix: '2044-08-10' }).offVitrineHtml(100);
  assert.match(autre, /Prix HT au 10 août 2044/);
  assert.match(autre, /Classement des ventes du 3 août 2044/);
  assert.doesNotMatch(autre, /2031/);
  // sans date de prix connue : on n'invente rien
  const sans = monter({ prix: '' }).offVitrineHtml(100);
  assert.doesNotMatch(sans, /Prix HT au/);
  assert.match(sans, /Prix HT/);
});

test('nombre de références et de marques calculés ; pages comptées ; aucun mot de réduction commerciale', () => {
  const V2 = monter();
  const D = V2.offVitrineDonnees(100), html = V2.offVitrineHtml(100);
  assert.equal(D.nb_marques, new Set(tab(D.produits.map((p) => p.marque))).size);
  assert.match(html, new RegExp('<b>100</b>références</div><div><b>' + D.nb_marques + '</b>marques'));
  const pages = (html.match(/<section class="page/g) || []).length;
  assert.ok(pages >= 8 && pages < 40);
  assert.match(html, /<section class="page dos">/);
  assert.doesNotMatch(html, /remis|rémis/i);
  assert.doesNotMatch(SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), /remis|rémis/i);
});

test('sans données chargées : aucune fiche (le catalogue n\'invente rien)', () => {
  const V2 = monter();
  const ctx = { V2: { offilogItems: () => [], toast() {} }, console };
  ctx.window = ctx;
  vm.runInContext(SRC, vm.createContext(ctx));
  assert.equal(ctx.V2.offVitrineDonnees(100).produits.length, 0);
  assert.ok(V2);
});

// ── Marques exclues (liste privée, noms INVENTÉS ici) ─────────────────────
const attendusPos = (items, ban) => {
  // position attendue = 1 + nombre de produits gardés de rang plus petit (calculé à part, sans le module)
  const ok = items.filter((it) => !ban(it) && !it.mkt.sorti && it.price > 0).sort((a, b) => a.mkt.rang - b.mkt.rang);
  return new Map(ok.map((it, i) => [it.ean, i + 1]));
};
test('retrait par EAN, par préfixe, par marque contenue et par marque égale ; positions recalculées sans trou', () => {
  const modif = (items) => {
    // le produit n° 1 est exclu par son EAN (liste eans), sans toucher à son libellé
    const it = (i) => items[i - 1];
    it(2).name = 'Inventeur – Gel doux ' + 2; it(2).brand = 'AUTRE';       // préfixe de libellé exclu, marque différente
    it(3).brand = 'Zorbo Labs'; it(3).name = 'Zorbo – Crème 3';            // marque contenue (et préfixe)
    it(4).brand = 'AUTRE'; it(4).name = 'Crème ZORBO douce 4';             // nom contenant la marque exclue
    it(6).brand = 'zorbo'; it(6).name = 'Savon 6';                         // marque égale
    it(7).brand = 'AUTRE'; it(7).name = 'Savon  –  Sans préfixe exclu 7';  // préfixe « savon » : PAS exclu
  };
  const exclus = { maj: '2031-03-01', marques: ['Zorbo'], eans: [ean(1)], prefixes: ['inventeur'] };
  const V2 = monter({ modif, exclus });
  const D = V2.offVitrineDonnees(300);
  const eans = tab(D.produits.map((p) => p.ean));
  for (const i of [1, 2, 3, 4, 6]) assert.ok(!eans.includes(ean(i)), 'retiré : ' + i);
  assert.ok(eans.includes(ean(7)) && eans.includes(ean(8)), 'les autres restent');
  assert.equal(D.exclus_absent, false);
  // positions : recalculées après retrait, aucun trou
  const items = [];
  for (let i = 1; i <= 1800; i++) items.push({ ean: ean(i), mkt: { rang: i, sorti: i === 17 }, price: i % 10 === 0 ? 0 : 5 + (i % 7), n: i });
  const ban = (it) => [1, 2, 3, 4, 6].includes(it.n);
  const att = attendusPos(items, ban);
  assert.ok(D.produits.every((p) => p.pos === att.get(p.ean)), 'position = rang dans la liste après retrait');
  const ordre = tab(D.produits.map((p) => p.pos));
  assert.deepEqual(ordre, tab(D.produits.map((p) => p.pos)).sort((a, b) => a - b));
  assert.deepEqual(tab(D.produits.map((p) => p.rang)), Array.from({ length: 300 }, (_, i) => i + 1));
  // sans retrait, le premier produit gardé est le n° 1 ; avec retrait, c'est le n° 5 (1 à 4 retirés), en position 1
  const sans = monter().offVitrineDonnees(100).produits[0], avec = D.produits[0];
  assert.equal(sans.ean, ean(1)); assert.equal(avec.ean, ean(5)); assert.equal(avec.pos, 1);
});

test('liste des marques absente ou invalide : catalogue FERMÉ, 0 produit, indicateur levé', () => {
  for (const exclus of ['absent', { marques: 'zorbo', eans: [], prefixes: [] }, { marques: [], eans: [], prefixes: [] }, { marques: ['a'], eans: 'x', prefixes: [] }, { marques: ['a'], eans: [] }]) {
    const V2 = monter({ exclus });
    for (const n of [100, 200, 300]) {
      const D = V2.offVitrineDonnees(n);
      assert.equal(D.produits.length, 0);
      assert.equal(D.nouveautes.length, 0);
      assert.equal(D.exclus_absent, true);
    }
    assert.doesNotMatch(V2.offVitrineHtml(100), /data-ean=/, 'aucune fiche sans la liste');
  }
  assert.equal(monter().offVitrineDonnees(100).exclus_absent, false);
});

// ── Photos : détourage WebP > JPEG > vignette ─────────────────────────────
test('priorité photo : WebP détouré si l\'EAN est à l\'index, sinon JPEG, sinon vignette ; jamais de WebP hors index', () => {
  const cut = [ean(1), ean(2)];
  const img = {}; for (const i of [2, 3, 5, 6, 8]) img[String(i)] = 'data:image/jpeg;base64,' + i;
  const V2 = monter({ cut, img });
  const D = V2.offVitrineDonnees(100), par = (i) => D.produits.find((p) => p.ean === ean(i));
  assert.equal(par(1).photo_type, 'webp');                     // index seul : détourage
  assert.equal(par(1).photo, 'https://exemple.test/crm/v2/oimg-cut/' + ean(1) + '.webp');
  assert.equal(par(2).photo_type, 'webp');                     // index ET jpeg : le détourage gagne
  assert.equal(par(3).photo_type, 'jpg'); assert.equal(par(3).photo, 'data:image/jpeg;base64,3');
  assert.equal(par(4).photo_type, ''); assert.equal(par(4).photo, '');
  const html = V2.offVitrineHtml(100);
  const art = (i) => new RegExp('<article class="(?:fiche|scene)[^"]*" data-ean="' + ean(i) + '"[\\s\\S]*?</article>').exec(html)[0];
  assert.match(art(1), /<img class="dc" src="https:\/\/exemple\.test\/crm\/v2\/oimg-cut\/\d+\.webp"/);
  assert.match(art(3), /<img class="jp" src="data:image\/jpeg/);
  assert.match(art(4), /class="vig"/); assert.doesNotMatch(art(4), /<img/);
  assert.equal(D.avec_webp, 2);
  assert.equal(D.avec_webp + D.avec_jpg + D.sans_photo, 100);
});

test('aucun chemin oimg-cut demandé pour un EAN hors index (index absent = aucun chemin)', () => {
  const cut = [ean(1), ean(3), ean(5)];
  for (const n of [100, 300]) {
    const html = monter({ cut, img: {} }).offVitrineHtml(n);
    const demandes = [...html.matchAll(/oimg-cut\/(\d+)\.webp/g)].map((m) => m[1]);
    assert.ok(demandes.length > 0);
    assert.ok(demandes.every((e) => cut.includes(e)), 'seuls les EAN annoncés par l\'index');
  }
  assert.doesNotMatch(monter({ img: {} }).offVitrineHtml(300), /oimg-cut/);
  assert.doesNotMatch(monter({ cut: [], img: {} }).offVitrineHtml(300), /oimg-cut/);
});

// ── Nouveautés transmises par le robot des prix (fichier protégé OFFILOG_NOUVEAUTES) ──────────────
// Comme en vrai : la liste de l'écran date du premier relevé, elle ne contient AUCUNE nouveauté ; seules celles du robot entrent.
const sansNouvEcran = (items) => items.forEach((it) => { it.mkt.serie = [it.mkt.rang, it.mkt.rang, it.mkt.rang]; });
const eanR = (j) => String(5000000000000 + j);
function ficheR(j, rang, extra = {}) {
  return { id: 'r' + j, ean: eanR(j), nom: 'MARQR – Nouveau ' + j, marque: 'MARQR', prix: 6.5, rang, rangs: [null, rang + 500, rang], ...extra };
}
function fichierR(items, premier = RELEVES[0]) { return { maj: RELEVES[2], premier, dates: [premier, RELEVES[1], RELEVES[2]], items }; }

test('nouveautés du robot : lues, rangées à leur rang, comprises dans N, liste des marques appliquée à elles', () => {
  const bonnes = [];
  for (let j = 1; j <= 15; j++) bonnes.push(ficheR(j, 10 * j + 5));
  const pieges = [
    ficheR(91, 3, { marque: 'zzmarque', nom: 'zzmarque – produit' }),   // marque retirée
    ficheR(92, 4),                                                    // EAN retiré (ci-dessous)
    ficheR(93, 6, { nom: 'Pfxbanni – produit', marque: '' }),          // préfixe retiré
    ficheR(94, 8, { ean: ean(7) }),                                   // même EAN qu'un produit de l'écran : l'écran passe le premier
    ficheR(95, 9, { prix: 0 }),                                       // sans prix
    ficheR(96, 11, { ean: '12345' }),                                 // EAN invalide
  ];
  const exclus = { maj: '2031-03-01', marques: ['zzmarque'], eans: [eanR(92)], prefixes: ['pfxbanni'] };
  const V2 = monter({ modif: sansNouvEcran, exclus, nouv: fichierR(pieges.concat(bonnes)), cats: { r3: 'Bébé' } });
  for (const [n, k] of [[100, 8], [200, 12], [300, 12]]) {
    const D = V2.offVitrineDonnees(n);
    assert.equal(D.produits.length, n);
    assert.equal(D.nouveautes.length, k, 'nouveautés à ' + n);
    assert.deepEqual(tab(D.nouveautes.map((p) => p.ean)), bonnes.slice(0, k).map((f) => f.ean), 'les k premières fiches du robot, dans l\'ordre du rang');
    assert.deepEqual(tab(D.produits.map((p) => p.rang)), Array.from({ length: n }, (_, i) => i + 1), 'rangs 1..N contigus');
    const eans = new Set(D.produits.map((p) => p.ean));
    for (const j of [91, 92, 93, 95]) assert.ok(!eans.has(eanR(j)), 'fiche piège ' + j + ' absente');
    assert.equal(D.produits.filter((p) => p.ean === ean(7)).length, 1, 'un seul produit pour l\'EAN partagé');
    for (const p of D.nouveautes) {
      assert.equal(p.entree, RELEVES[1]);
      assert.equal(p.gain, 500);
      assert.equal(p.tarif, null, 'pas de tarif labo pour une fiche hors écran');
      assert.equal(p.prix, 6.5);
    }
    // position recalculée = place parmi les produits du catalogue (jamais le rang du robot)
    const ordre = D.produits.slice().sort((a, b) => a.pos - b.pos).map((p) => p.ean);
    assert.deepEqual(tab(D.produits.map((p) => p.ean)), tab(ordre));
  }
  assert.equal(V2.offVitrineDonnees(100).nouveautes.find((p) => p.ean === eanR(3)).rayon, 'Bébé', 'rayon lu dans OFFILOG_CATS par l\'id');
  const html = V2.offVitrineHtml(100);
  assert.ok(!/zzmarque/i.test(html) && !/pfxbanni/i.test(html), 'aucune fiche retirée dans les pages');
  // choix de Will (16/11/2026) : une carte « Nouveauté » ne porte aucun numéro (sa place dans le catalogue n'est pas son rang de vente)
  const pagesNouv = html.split('<section ').filter((s) => s.startsWith('class="page nouv'));
  assert.ok(pagesNouv.length >= 2, 'pages des nouveautés trouvées');
  for (const s of pagesNouv) assert.ok(!/des ventes/.test(s.replace(/Classement des ventes[^<]*/g, '')) && !/n°\s?\d/.test(s), 'aucun numéro sur les cartes Nouveauté');
  // choix de Will (16/11/2026) : « vente. » ne reste jamais seul à la ligne → coupure voulue après le nombre de marques
  const entetes = html.match(/<div class="cpt">.*?<\/div>/g) || [];
  assert.ok(entetes.length >= 1 && entetes.every((e) => /marques?,<br>classées par rang de vente\.<\/div>$/.test(e)), 'en-têtes de rayon coupés après les marques');
});

test('nouveautés du robot ignorées si leur premier relevé n\'est pas celui du marché chargé', () => {
  const V2 = monter({ modif: sansNouvEcran, nouv: fichierR([ficheR(1, 15), ficheR(2, 25)], '2030-12-01') });
  const D = V2.offVitrineDonnees(100);
  assert.equal(D.produits.length, 100);
  assert.equal(D.nouveautes.length, 0);
  assert.ok(!D.produits.some((p) => p.ean.startsWith('5000')));
});

test('fichier des nouveautés absent ou mal formé : catalogue complet sans nouveautés, jamais fermé', () => {
  for (const nouv of [undefined, {}, { items: 'x' }, { premier: RELEVES[0], dates: [], items: [] }, { premier: RELEVES[0], dates: RELEVES, items: [ficheR(1, 15, { rangs: [null, 1] })] }]) {
    const V2 = monter({ modif: sansNouvEcran, nouv });
    const D = V2.offVitrineDonnees(100);
    assert.equal(D.exclus_absent, false);
    assert.equal(D.produits.length, 100);
    assert.equal(D.nouveautes.length, 0, JSON.stringify(nouv));
  }
});

// 16/11/2026 : le PDF échouait sous WebKit (« Unsupported image type ») : le html2canvas de html2pdf 0.10.2 lit la couche
// « none » qu'un fond multicouche terminé par une simple couleur laisse dans background-image. La couleur va dans background-color.
test('aucun fond multicouche terminé par une simple couleur (sinon le PDF plante)', () => {
  const fautifs = [];
  for (const m of CSS.matchAll(/background\s*:\s*([^;}]*)/g)) {
    let d = 0; const couches = [''];
    for (const ch of m[1]) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) couches.push(''); else couches[couches.length - 1] += ch; }
    if (couches.length > 1 && !/gradient\(|url\(/.test(couches[couches.length - 1])) fautifs.push(m[0].slice(0, 60));
  }
  assert.deepEqual(fautifs, []);
});

test('dernière page : les cinq lignes de Will, seuil de livraison lu dans le réglage unique', () => {
  const V2 = monter(), html = V2.offVitrineHtml(100);
  const dos = html.slice(html.lastIndexOf('<section class="page dos"'));
  for (const l of ['Prix net, à l’unité', 'Le panier se conserve sur le poste de la commande', 'Réception de la facture dès l’envoi de la commande',
    'Si problème lors de la réception, contactez le SAV sur la plateforme']) assert.ok(dos.includes(l), l);
  const seuil = Number((SRC.match(/var LIVRAISON_DES_EUROS = (\d+);/) || [])[1]);
  assert.ok(seuil > 0, 'réglage présent');
  assert.ok(dos.includes('Livraison dès ' + seuil + ' € de commande'), 'seuil tiré du réglage');
  assert.equal((SRC.match(/Livraison dès \d/g) || []).length, 0, 'aucun seuil écrit en dur dans la phrase');
  assert.equal((dos.match(/<li>/g) || []).length, 5);
});

test('pastille « Médiane » de l\'écran Offilog : pas de .dkl-note (son gris écrasait le blanc, 1,1:1 mesuré)', () => {
  const src = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');
  const l = src.split('\n').find((x) => x.includes('olm-med'));
  assert.ok(l, 'pastille trouvée');
  assert.doesNotMatch(l, /dkl-note/);
});

test('index des détourages : chaque EAN de oimg-cut/liste.json a son WebP, et chaque WebP est dans l\'index', () => {
  // Une entrée sans fichier = image cassée dans le catalogue et le PDF (le module prend le WebP dès que l'EAN est à l'index).
  const dir = path.join(RACINE, 'crm/v2/oimg-cut');
  const liste = JSON.parse(fs.readFileSync(path.join(dir, 'liste.json'), 'utf8'));
  const fichiers = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));
  assert.equal(new Set(liste).size, liste.length, 'aucun doublon');
  assert.deepEqual([...liste].sort(), [...fichiers].sort());
  for (const e of liste) {
    assert.match(e, /^\d{13}$/);
    const b = fs.readFileSync(path.join(dir, e + '.webp'));
    assert.equal(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12), 'RIFFWEBP', e + ' est un vrai WebP');
  }
});

test('PDF : chaque photo garde ses proportions (html2canvas ignore object-fit et étire la photo sur sa boîte)', () => {
  const { cadrage, cadrerPhotos } = monter()._offVitrinePdf;
  const proche = (a, b) => assert.ok(Math.abs(a - b) < 0.01, a + ' ≠ ' + b);
  // Fixodent 46395 (299 × 115) dans la grande carte de nouveauté (52 × 54 mm), posé en bas, centré : tout le vide au-dessus.
  const W = 52 * 96 / 25.4, H = 54 * 96 / 25.4, c = cadrage(W, H, 299, 115, 0.5, 1);
  proche(c.l, 0); proche(c.r, 0); proche(c.b, 0); proche(H - c.t, W * 115 / 299);
  // Flacon haut (200 × 600) dans une case de grille (42 × 27 mm) : vide partagé à gauche et à droite, rien en haut ni en bas.
  const g = cadrage(158.74, 102.05, 200, 600, 0.5, 1);
  proche(g.t, 0); proche(g.b, 0); proche(g.l, g.r); proche(158.74 - g.l - g.r, 102.05 / 3);
  assert.equal(cadrage(100, 50, 400, 200, 0.5, 1), null, 'déjà aux bonnes proportions : rien à faire');
  assert.equal(cadrage(100, 50, 0, 0, 0.5, 1), null, 'photo pas chargée : rien à faire');
  // Sur la page : seule la photo « contain » est retouchée, et son style d'origine revient à l'identique après la page.
  const img = (fit, st) => { let s = st; const style = {};
    return { complete: true, naturalWidth: 299, naturalHeight: 115, _fit: fit, style,
      getAttribute: () => s, setAttribute: (_, v) => { s = v; }, removeAttribute: () => { s = null; }, lire: () => s }; };
  const a = img('contain', null), b = img('contain', 'left:3px'), logo = img('fill', null);
  const fw = { getComputedStyle: (im) => ({ objectFit: im._fit, width: W + 'px', height: H + 'px', objectPosition: '50% 100%' }) };
  const remettre = cadrerPhotos({ querySelectorAll: () => [a, b, logo] }, fw);
  assert.equal(a.style.boxSizing, 'border-box'); assert.match(a.style.padding, /^[\d.]+px 0px 0px 0px$/);
  assert.equal(logo.style.padding, undefined, 'image sans object-fit contain : laissée telle quelle');
  remettre();
  assert.equal(a.lire(), null); assert.equal(b.lire(), 'left:3px');
});

test('PDF : une photo non chargée arrête le PDF (aperçu cassé, ou rechargement raté par html2canvas)', () => {
  const { photosCassees, ecouterPhotosPerdues, errPhotos } = monter()._offVitrinePdf;
  assert.deepEqual([...errPhotos(['a.webp', 'a.webp', 'b.webp', 'a.webp']).photos], ['a.webp', 'b.webp'], 'une photo vue 3 fois (scène + carte) compte pour une');
  const im = (src, complete, nw) => ({ complete, naturalWidth: nw, getAttribute: () => src });
  const page = { querySelectorAll: () => [im('a.webp', true, 230), im('b.webp', true, 0), im('c.jpg', false, 0), im('', true, 0), im(null, true, 0)] };
  assert.deepEqual([...photosCassees(page)], ['b.webp', 'c.jpg'], 'seules les photos avec une adresse et rien de chargé comptent');
  assert.equal(photosCassees({ querySelectorAll: () => [im('a.webp', true, 230)] }).length, 0);
  // html2canvas 1.0.0 : console.error(id, '12ms', 'Error loading image <adresse>') quand il saute une photo.
  const vus = [], fw = { console: { error: function () { vus.push([].slice.call(arguments)); } } }, avant = fw.console.error;
  const e = ecouterPhotosPerdues(fw);
  fw.console.error('#1', '12ms', 'Error loading image https://crm-jarvis.vercel.app/crm/v2/oimg-cut/3401563131779.webp');
  fw.console.error('autre erreur');
  assert.deepEqual([...e.perdues], ['https://crm-jarvis.vercel.app/crm/v2/oimg-cut/3401563131779.webp']);
  assert.equal(vus.length, 2, 'la console reçoit toujours les messages');
  e.fin();
  assert.equal(fw.console.error, avant, 'la console est rendue telle quelle après la page');
});

test('PDF : le rechargement des photos par html2canvas reste écouté (logging: true) et le message dit le nombre de photos', () => {
  const src = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog-vitrine.js'), 'utf8');
  const f = src.slice(src.indexOf('function rendrePage('), src.indexOf('V2.offVitrineMail = function'));
  assert.match(f, /html2canvas: \{[^}]*logging: true/);
  assert.match(f, /photosPretes\(fw\.document, 0\)/);
  assert.match(f, /ecouterPhotosPerdues\(fw\)/);
  assert.match(f, /rendrePage\(fw, sec, 0\)/);
  assert.match(src, /photos n\\'ont pas pu être chargées/);
});

// 17/11/2026 : en prod, UNE photo sur 323 a raté une fois puis a été servie normalement juste après.
// Un raté passager est redemandé (2 essais au plus) ; une photo toujours absente refuse toujours le PDF.
test('PDF : une photo passagèrement non chargée dans l\'aperçu est redemandée ; toujours absente, le PDF reste refusé', async () => {
  const P = monter()._offVitrinePdf;
  assert.deepEqual([...P.PAUSES_REESSAI], [2, 6], 'deux nouveaux essais, après 2 s puis 6 s');
  const pauses = [...P.PAUSES_REESSAI]; P.PAUSES_REESSAI.splice(0, 2, 0, 0);
  try {
    // une photo qui se charge au k-ième nouvel essai (Infinity = jamais)
    const photo = (src, charge) => {
      const ls = { load: [], error: [] }, im = { essais: 0, complete: true, naturalWidth: charge === 0 ? 230 : 0, getAttribute: () => src,
        addEventListener: (t, f) => ls[t].push(f), removeEventListener: (t, f) => { ls[t] = ls[t].filter((g) => g !== f); } };
      im.adresses = [];
      Object.defineProperty(im, 'src', { set(v) { im.adresses.push(v); im.essais++; const ok = im.essais >= charge; im.naturalWidth = ok ? 230 : 0; setTimeout(() => ls[ok ? 'load' : 'error'].slice().forEach((f) => f())); } });
      return im;
    };
    const a = photo('a.webp', 0), b = photo('b.webp', 1), page = { querySelectorAll: () => [a, b] };
    await P.photosPretes(page, 0);
    assert.equal(b.essais, 1, 'la photo cassée est redemandée une fois, puis le PDF continue');
    assert.equal(a.essais, 0, 'une photo chargée n\'est jamais redemandée');
    const c = photo('c.webp', Infinity), page2 = { querySelectorAll: () => [a, c] };
    await assert.rejects(P.photosPretes(page2, 0), (e) => e.photos && e.photos.length === 1 && e.photos[0] === 'c.webp');
    assert.equal(c.essais, 2, 'deux nouveaux essais, pas un de plus');
    // WebKit ressert l'échec d'une adresse reposée telle quelle (sonde du 17/11/2026) : chaque essai vise une adresse neuve, même fichier
    assert.match(b.adresses[0], /^b\.webp\?reessai=\d+$/, 'redemandée à une adresse neuve');
    assert.ok(c.adresses.every((s) => /^c\.webp\?reessai=\d+$/.test(s)) && c.adresses[0] !== c.adresses[1], 'chaque essai a sa propre adresse');
    const d1 = photo('d.webp?reessai=4', 1), d2 = photo('d.webp?reessai=4', 1);
    await P.photosPretes({ querySelectorAll: () => [d1, d2] }, 0);
    assert.match(d1.adresses[0], /^d\.webp\?reessai=\d+$/, 'l\'ancien suffixe est remplacé, pas empilé');
    assert.equal(d1.adresses[0], d2.adresses[0], 'les apparitions d\'une même photo partagent l\'adresse : une seule demande');
  } finally { P.PAUSES_REESSAI.splice(0, 2, ...pauses); }
});

test('PDF : une page dont html2canvas a perdu une photo est refaite ; perdue à chaque essai, le PDF s\'arrête', async () => {
  const P = monter()._offVitrinePdf;
  const pauses = [...P.PAUSES_REESSAI]; P.PAUSES_REESSAI.splice(0, 2, 0, 0);
  try {
    // faux html2pdf : les `rates` premiers rendus de la page écrivent « Error loading image » comme html2canvas 1.0.0
    const fenetre = (rates) => {
      const fw = { rendus: 0, console: { error() {} }, getComputedStyle: () => ({ objectFit: 'fill' }) };
      fw.html2pdf = () => ({ set: () => ({ from: () => ({ toCanvas: () => ({ get: () => {
        fw.rendus++;
        if (fw.rendus <= rates) fw.console.error('#1', '12ms', 'Error loading image https://exemple.test/oimg-cut/1.webp');
        return Promise.resolve({ width: 10, height: 10 });
      } }) }) }) });
      return fw;
    };
    const sec = { querySelectorAll: () => [] };
    const f1 = fenetre(1), cv = await P.rendrePage(f1, sec, 0);
    assert.equal(f1.rendus, 2, 'page refaite une fois');
    assert.equal(cv.width, 10, 'la page refaite est rendue');
    const f0 = fenetre(0); await P.rendrePage(f0, sec, 0);
    assert.equal(f0.rendus, 1, 'page sans photo perdue : rendue une seule fois');
    const f9 = fenetre(9);
    await assert.rejects(P.rendrePage(f9, sec, 0), (e) => e.photos && e.photos.length === 1);
    assert.equal(f9.rendus, 3, 'un rendu + deux nouveaux essais, puis arrêt');
  } finally { P.PAUSES_REESSAI.splice(0, 2, ...pauses); }
});
