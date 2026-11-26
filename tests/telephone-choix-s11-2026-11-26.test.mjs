// 26/11/2026 — fiche produit du Catalogue, carte « La France, mois par mois » : choix de Will sur la planche « JARVIS au téléphone : 11 choix », sujet 11,
// VERSION 1 « La courbe redessinée ». Le dessin de l'ordinateur fait 640 px de large ; dans la fiche d'un téléphone (cadre de 316 px à 390 px d'écran)
// il était réduit de moitié et ses textes d'axe, déclarés à 12 px, étaient VUS à 5,9 px. Au téléphone, la courbe est maintenant dessinée à la largeur
// réelle de son cadre : un dessin de 316 px dans un cadre de 316 px, donc 12 px vus.
// Ce que ce test garde, en faisant tourner les vrais fichiers (v2-comptoir.js, v2-etude.js, v2-etude-ecran.js) dans node:vm sur un produit inventé :
//   · au téléphone : dessin à la largeur du cadre, les trois repères, toutes les années, la bande de prévision, les fourchettes, la légende sous le dessin ;
//   · la largeur prévue (écran − 74 px) se relit dans les marges réelles de la fiche et de la carte ;
//   · une fois la fiche posée, le cadre est mesuré (jamais le <svg>) et la courbe redessinée si la largeur diffère, y compris quand l'écran tourne ;
//   · à l'ordinateur : le même dessin qu'avant, à l'octet près, et aucune mesure lancée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { regles, trouve, sousTelephone } from './aide-css-telephone.mjs';

const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const CIP = '3400900000099', L = { cip: CIP, d: 'PRODUIT INVENTE 1MG' };
// 68 mois inventés, de janvier 2021 à août 2026, qui montent de 46 000 à 372 000 boîtes : l'allure de la planche, aucune vraie vente
const serie = () => Array.from({ length: 68 }, (_, k) => Math.round(46000 + 326000 * Math.pow(k / 67, 1.6) + (k % 5 === 0 ? 9000 : -4000)));
const TRANCHES = { ['etude-france/' + CIP.slice(-2) + '.json']: { m0: '2021-01', n: 68, d: { [CIP]: [serie(), serie(), Array(68).fill(0)] } } };
const PREV = { fiable: true, m3: 98, b3: 84, h3: 111, m6: 99, b6: 83, h6: 113, m12: 102, b12: 84, h12: 118 };

// La fiche dans une fausse fenêtre. largeur = largeur de l'écran (0 : une fenêtre sans matchMedia, comme les autres tests de l'étude).
async function monter({ largeur = 390, prevision = true, observateur = true } = {}) {
  const cadres = [], minuteurs = [], obs = [];
  let charge = false;   // pendant le chargement des données, les minuteurs tournent pour de bon ; ensuite le test les déclenche lui-même
  const sb = {
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} }, documentElement: { clientWidth: largeur }, querySelectorAll: (q) => (q === '.et-crb' ? cadres : []) },
    console, clearTimeout, Promise,
    setTimeout: (f, d) => { minuteurs.push(f); return charge ? 0 : setTimeout(f, d); }
  };
  sb.window = sb; sb.globalThis = sb;
  if (largeur) { sb.innerWidth = largeur; sb.matchMedia = (q) => { const m = /max-width:\s*(\d+)px/.exec(q); return { matches: !!m && sb.document.documentElement.clientWidth <= +m[1] }; }; }
  if (observateur) sb.ResizeObserver = function (rappel) { const o = { rappel, vus: [], coupe: 0, observe(el) { o.vus.push(el); }, disconnect() { o.coupe++; o.vus = []; } }; obs.push(o); return o; };
  sb.clearTimeout = () => {};
  sb.fetch = (url) => {
    const f = String(url).split('?')[0];
    return f in TRANCHES ? Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(TRANCHES[f]))) }) : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  };
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  ['v2-comptoir.js', 'v2-etude.js', 'v2-etude-ecran.js'].forEach((f) => vm.runInContext(lire(f), sb));
  sb.V2.comptoir.repose = () => {};
  sb.V2.comptoir._calc.donnees = () => ({ parCip: { [CIP]: L }, mois: [] });
  sb.V2.comptoir.stats = () => ({ tendance: { previsions: prevision ? PREV : null } });
  sb.V2.etude.donnees(CIP); await new Promise((r) => setTimeout(r, 20));
  minuteurs.length = 0; charge = true;
  const html = sb.V2.etude.bloc(L, {}, false);
  assert.match(html, /La France, mois par mois/, 'marqueur : la carte de la courbe est bien rendue');
  return { sb, html, cadres, minuteurs, obs, carte: /<section class="et-c et-w"><h4>La France, mois par mois<\/h4>([\s\S]*?)<\/section>/.exec(html)[1] };
}
const dessin = (h) => /<svg class="et-svg" viewBox="0 0 (\d+) (\d+)"[\s\S]*?<\/svg>/.exec(h);
const textes = (svg) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)" class="([^"]+)">([^<]*)<\/text>/g)].map((m) => ({ x: +m[1], y: +m[2], ancre: m[3], cls: m[4], t: m[5] }));
// Un faux cadre posé dans la page : ce que la fiche a écrit, avec une largeur réelle à mesurer.
const cadre = (html, largeur) => {
  const m = /<div class="et-crb" data-w="(\d+)">([\s\S]*?<\/svg>)<\/div>/.exec(html);
  const el = { clientWidth: largeur, innerHTML: m[2], attrs: { 'data-w': m[1] }, getAttribute: (k) => el.attrs[k], setAttribute: (k, v) => { el.attrs[k] = String(v); } };
  return el;
};

test('téléphone, 390 px : la courbe est dessinée à la largeur de son cadre (316 px), donc ses textes de 12 px sont vus à 12 px', async () => {
  const p = await monter({ largeur: 390 }), d = dessin(p.carte);
  assert.match(p.carte, /<div class="et-crb" data-w="316"><svg class="et-svg" viewBox="0 0 316 190"/, 'un cadre mesurable, et un dessin de sa largeur');
  assert.equal(+d[1], 390 - 74);
  // taille vue = taille déclarée × largeur du cadre ÷ largeur du dessin ; avant : 12 × 316 ÷ 640 = 5,9 px
  assert.equal((12 * 316 / 640).toFixed(1), '5.9', 'étalonnage : le calcul retrouve la mesure de l\'audit sur l\'ancien dessin');
  assert.equal(12 * 316 / +d[1], 12);
  const css = regles(p.sb.V2.etude.CSS), axe = trouve(css, '.et-ax');
  assert.ok(axe.some((r) => sousTelephone(r) && /font-size:12px/.test(r.decl)), 'textes d\'axe déclarés à 12 px sous 640 px');
});

test('téléphone : toutes les informations restent (trois repères, six années, bande et trait de prévision, fourchettes, légende)', async () => {
  const p = await monter({ largeur: 390 }), svg = dessin(p.carte)[0], W = 316, tx = textes(svg);
  assert.deepEqual(tx.filter((x) => x.ancre === 'end').map((x) => x.t), ['0', '250 k', '500 k'], 'les trois repères de l\'axe');
  assert.deepEqual(tx.filter((x) => x.ancre === 'middle').map((x) => x.t), ['2021', '2022', '2023', '2024', '2025', '2026'], 'les six années');
  assert.equal(tx.length, 9, 'aucun autre texte dans le dessin');
  for (const x of tx) assert.equal(x.cls, 'et-ax', 'tous à la taille des textes d\'axe');
  // rien ne sort du dessin : un repère fait 30 px au plus (« 250 k »), une année 27 px (Archivo 500, 12 px)
  for (const x of tx) {
    if (x.ancre === 'end') assert.ok(x.x - 30 >= 0, x.t); else assert.ok(x.x - 14 >= 0 && x.x + 14 <= W, x.t + ' à x = ' + x.x);
    assert.ok(x.y <= 190 - 6 && x.y >= 16, x.t + ' à y = ' + x.y);
  }
  // les années ne se touchent pas : 34 px au moins entre deux
  const an = tx.filter((x) => x.ancre === 'middle').map((x) => x.x);
  for (let i = 1; i < an.length; i++) assert.ok(an[i] - an[i - 1] >= 34, 'écart ' + (an[i] - an[i - 1]).toFixed(1));
  // la prévision : la bande verte va jusqu'au bord droit du tracé, le trait pointillé la traverse
  const bande = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" fill="#1E9E6A" fill-opacity=".16"\/>/.exec(svg);
  assert.ok(bande, 'la bande de prévision');
  assert.ok(Math.abs(+bande[1] + +bande[2] - (W - 2)) < 0.2, 'elle finit à 2 px du bord');
  assert.match(svg, /stroke="#0F7A52" stroke-width="1.6" stroke-dasharray="4 3"\/>/, 'le trait de la prévision à 12 mois');
  assert.match(svg, /<polyline points="[^"]+" fill="none" stroke="#0050E6" stroke-width="2" stroke-linejoin="round"\/>/, 'la courbe');
  assert.equal(svg.match(/<polyline points="([^"]+)"/)[1].split(' ').length, 68, 'les 68 mois');
  // l'étiquette de la prévision a quitté le dessin pour une ligne dessous, avec les mots de la planche
  assert.doesNotMatch(svg, /prévision 12 mois/);
  assert.match(p.carte, /<\/svg><\/div><p class="et-ech">bande verte : prévision à 12 mois<\/p><div class="et-pv">/);
  // les fourchettes
  assert.match(p.carte, /<small>3 mois<\/small><b>98\s%<\/b><i>84 à 111<\/i>/);
  assert.match(p.carte, /<small>12 mois<\/small><b>102\s%<\/b><i>84 à 118<\/i>/);
  assert.match(p.carte, /la bande verte est la fourchette à 12 mois/);
});

test('téléphone, sans prévision publiée : pas de bande, pas de légende, la dernière année reste entière', async () => {
  const p = await monter({ largeur: 390, prevision: false }), svg = dessin(p.carte)[0];
  assert.doesNotMatch(svg, /#1E9E6A/);
  assert.doesNotMatch(p.carte, /et-ech/);
  const an = textes(svg).filter((x) => x.ancre === 'middle');
  assert.equal(an.length, 6);
  assert.ok(an[5].x + 14 <= 316);
  // le tracé s'arrête à 14 px du bord : une année écrite sous le dernier mois ne serait pas coupée
  assert.match(svg, /<line x1="46" x2="302" /);
});

test('téléphone étroit : à 360 px les six années tiennent ; à 320 px une année sur deux, plutôt que des années qui se chevauchent', async () => {
  const a = await monter({ largeur: 360 }), b = await monter({ largeur: 320 });
  assert.equal(+dessin(a.carte)[1], 286);
  assert.deepEqual(textes(dessin(a.carte)[0]).filter((x) => x.ancre === 'middle').map((x) => x.t), ['2021', '2022', '2023', '2024', '2025', '2026']);
  assert.equal(+dessin(b.carte)[1], 246);
  assert.deepEqual(textes(dessin(b.carte)[0]).filter((x) => x.ancre === 'middle').map((x) => x.t), ['2021', '2023', '2025']);
});

test('la largeur prévue (écran − 74 px) se relit dans les marges réelles de la fiche et de la carte', async () => {
  const p = await monter({ largeur: 390 });
  const fiche = /'\.cp-pan-c\{padding:0 (\d+)px\}'/.exec(lire('v2-comptoir.js'));
  assert.ok(fiche, 'marqueur : la marge de la fiche produit dans v2-comptoir.js');
  const carte = trouve(regles(p.sb.V2.etude.CSS), '.et-c')[0], m = /padding:16px (\d+)px 14px;.*border:(\d+)px solid/.exec(carte.decl);
  assert.ok(m, 'marqueur : la marge et le filet de la carte .et-c');
  assert.equal(2 * +fiche[1] + 2 * (+m[1] + +m[2]), 74);
  assert.match(lire('v2-etude-ecran.js'), /\|\| window\.innerWidth \|\| 390\) - 74\)/);
});

test('une fois la fiche posée : le CADRE est mesuré (pas le svg), et la courbe redessinée seulement si la largeur n\'est pas celle prévue', async () => {
  const src = lire('v2-etude-ecran.js');
  assert.match(src, /w = els\[i\]\.clientWidth \|\| 0;/, 'la largeur lue est celle du cadre .et-crb');
  assert.doesNotMatch(src, /et-svg[^;\n]*\.(clientWidth|getBoundingClientRect)|querySelector(All)?\('[^']*svg/, 'aucune largeur lue sur un <svg>');
  // 1. le cadre a la largeur prévue : rien n'est redessiné
  const p = await monter({ largeur: 390 });
  assert.equal(p.minuteurs.length, 1, 'le bloc demande une mesure après la pose');
  const el = cadre(p.html, 316); p.cadres.push(el);
  const avant = el.innerHTML;
  p.minuteurs[0]();
  assert.equal(el.innerHTML, avant);
  assert.equal(p.obs.length, 1, 'un observateur de taille');
  assert.deepEqual(p.obs[0].vus, [el], 'il observe le cadre .et-crb');
  // 2. le cadre est plus étroit que prévu (marges changées, autre appareil) : dessin refait à cette largeur dès la pose
  const q = await monter({ largeur: 390 }), el2 = cadre(q.html, 300); q.cadres.push(el2);
  q.minuteurs[0]();
  assert.match(el2.innerHTML, /^<svg class="et-svg" viewBox="0 0 300 190"/);
  assert.equal(el2.getAttribute('data-w'), '300');
  assert.equal(textes(el2.innerHTML).length, 9, 'toujours les neuf textes');
  // 3. l'écran tourne dans les largeurs du téléphone : l'observateur ne redessine pas lui-même, il demande une mesure juste après
  const rappel = (largeurEcran, largeurCadre) => {
    p.sb.document.documentElement.clientWidth = largeurEcran; el.clientWidth = largeurCadre;
    const n = p.minuteurs.length, fige = el.innerHTML;
    p.obs[0].rappel();
    assert.equal(p.minuteurs.length, n + 1, 'une mesure demandée');
    assert.equal(el.innerHTML, fige, 'rien redessiné dans le rappel de l\'observateur');
    p.minuteurs[n]();
    return fige;
  };
  rappel(600, 526);
  assert.match(el.innerHTML, /viewBox="0 0 526 190"/);
  assert.equal(el.getAttribute('data-w'), '526');
  // 4. cadre retiré de la page (largeur 0), ou écran passé au-dessus de 640 px : on ne touche à rien (la fiche se redessine alors elle-même)
  assert.equal(rappel(600, 0), el.innerHTML);
  assert.equal(rappel(844, 770), el.innerHTML);
  // 5. un second rendu de la fiche : l'observateur est resservi, et il lâche les cadres du rendu d'avant
  p.sb.document.documentElement.clientWidth = 390;
  const n = p.minuteurs.length;
  p.sb.V2.etude.bloc(L, {}, false);
  assert.equal(p.minuteurs.length, n + 1);
  p.minuteurs[n]();
  assert.equal(p.obs.length, 1, 'le même observateur');
  assert.equal(p.obs[0].coupe, 1, 'coupé avant d\'observer les cadres du nouveau rendu');
});

test('sans ResizeObserver (vieux navigateur) : une mesure directe de la largeur du cadre, une fois la fiche posée', async () => {
  const p = await monter({ largeur: 390, observateur: false });
  const el = cadre(p.html, 310); p.cadres.push(el);
  p.minuteurs[0]();
  assert.match(el.innerHTML, /viewBox="0 0 310 190"/);
  assert.equal(p.obs.length, 0);
  // l'écran qui tourne est alors pris en charge par la fiche, qui se redessine seule quand la fenêtre change
  assert.match(lire('v2-comptoir.js'), /window\.addEventListener\('resize', function \(\) \{\s*if \(tr\) clearTimeout\(tr\);\s*tr = setTimeout\(function \(\) \{ if \(C\.cip\) V2\.comptoir\.unite\(C\.unite\); \}, 200\);/);
});

test('ordinateur : le même dessin qu\'avant, à l\'octet près ; ni cadre, ni légende, ni mesure', async () => {
  for (const largeur of [1280, 641, 0]) {
    const p = await monter({ largeur }), d = dessin(p.carte);
    assert.deepEqual([+d[1], +d[2]], [640, 230], largeur + ' px : dessin de 640 × 230');
    assert.doesNotMatch(p.html, /et-crb|et-ech/, largeur + ' px');
    assert.equal(p.minuteurs.length, 0, largeur + ' px : aucune mesure demandée');
    assert.match(d[0], /class="et-ax et-prev">prévision 12 mois<\/text>/, 'l\'étiquette de la prévision reste dans le dessin');
    assert.match(d[0], /stroke-width="2.2" stroke-linejoin="round"/);
    assert.match(d[0], /stroke="#0F7A52" stroke-width="2.2" stroke-dasharray="5 4"\/>/);
    // empreinte du dessin produit par le fichier d'AVANT le 26/11 (HEAD 26f265162) sur ce même produit inventé
    assert.equal(createHash('sha256').update(d[0]).digest('hex').slice(0, 16), EMPREINTE_ORDINATEUR, largeur + ' px');
  }
});
const EMPREINTE_ORDINATEUR = '275a51d56ea19dd2';

test('les règles ajoutées à la feuille de l\'étude ne valent que sous 640 px', async () => {
  const p = await monter({ largeur: 390 }), css = regles(p.sb.V2.etude.CSS);
  for (const sel of ['.et-crb', '.et-ech']) {
    const r = trouve(css, sel);
    assert.equal(r.length, 1, sel);
    assert.ok(sousTelephone(r[0]), sel + ' sous 640 px');
  }
  assert.match(trouve(css, '.et-ech')[0].decl, /font:600 12\.5px/, 'légende à 12,5 px');
  const horsTel = trouve(css, '.et-ax').filter((r) => !sousTelephone(r));
  assert.equal(horsTel.length, 1);
  assert.match(horsTel[0].decl, /font:500 10\.5px var\(--font\)/, 'à l\'ordinateur, les textes d\'axe gardent 10,5 px');
});
