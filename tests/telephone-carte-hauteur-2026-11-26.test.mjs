// 26/11/2026 — téléphone : la carte dépassait de 64 px sous la barre du bas (audit du 25/11, B·CARTE-1 et B·CARTE-2).
// Mesuré en production à 390 × 844 : page de 908 px pour un écran de 844. L'écran pose `height:calc(100dvh - barre du haut)` (v2-carte.js) et v2-tel.css
// réserve en plus la place de la barre du bas sous #v2-root : la légende, « Ma tournée » et le pied de la fiche d'une officine passaient dessous.
// Ce test refait le calcul avec les valeurs lues dans les deux fichiers : 908 avant, 844 après.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, trouve, sousTelephone, poids, compare, reglesInjectees, selecteurs } from './aide-css-telephone.mjs';

const tel = regles(lire('v2-tel.css')), base = regles(lire('v2.css')), carte = lire('v2-carte.js');
// toutes les valeurs « height: » d'un bloc de déclarations, dans l'ordre (la dernière comprise par le navigateur gagne)
const hauteurs = decl => [...decl.matchAll(/(?:^|;)\s*height:([^;]+)/g)].map(m => m[1].trim());
// calc(100dvh - var(--topbar-h,60px) - var(--bnav-h)) → hauteur en px pour un écran H, une barre du haut T (son repli écrit dans la règle) et une barre du bas B
function evalue(v, H, B) {
  const m = /^calc\(100d?vh((?:\s-\s(?:var\([^()]*\)))+)\)$/.exec(v);
  assert.ok(m, 'forme attendue « calc(100vh - var(…) [- var(…)]) » : ' + v);
  let h = H;
  for (const t of m[1].matchAll(/var\((--[\w-]+)(?:,(\d+)px)?\)/g)) {
    if (t[1] === '--topbar-h') { assert.equal(t[2], '60', 'repli de la barre du haut : 60 px'); h -= 60; }
    else if (t[1] === '--bnav-h') h -= B;
    else assert.fail('variable inattendue : ' + t[1]);
  }
  return h;
}

test('étalonnage : le calcul rend les hauteurs connues', () => {
  assert.equal(evalue('calc(100dvh - var(--topbar-h,60px))', 844, 64), 784);
  assert.equal(evalue('calc(100vh - var(--topbar-h,60px) - var(--bnav-h))', 844, 64), 720);
  assert.deepEqual(hauteurs('display:flex;height:1px;min-height:480px;height:2px'), ['1px', '2px']);   // min-height n'est pas une hauteur
});

test('la carte : 908 px de page avant (mesuré), 844 après — elle s\'arrête au-dessus de la barre du bas', () => {
  const H = 844, T = 60, B = 64;
  // ce que pose l'écran
  const src = reglesInjectees(carte, '.cn-shell');
  assert.equal(src.length, 1, 'une seule règle .cn-shell{…} dans v2-carte.js');
  const hSrc = hauteurs(src[0]);
  assert.ok(hSrc.length && hSrc.every(v => !/--bnav-h/.test(v)), 'l\'écran ne retire pas la barre du bas : c\'est v2-tel.css qui le fait');
  // la réserve sous le contenu, cause des 64 px en trop
  const reserve = trouve(tel, 'body.bnav-on #v2-root');
  assert.ok(reserve.length === 1 && /padding-bottom:var\(--bnav-h\)/.test(reserve[0].decl));
  assert.equal(T + evalue(hSrc[hSrc.length - 1], H, B) + B, 908, 'avant : barre du haut + carte + réserve = la page de 908 px mesurée le 25/11');
  // ce que pose le téléphone
  const r = trouve(tel, 'body.bnav-on .cn-shell');
  assert.equal(r.length, 1); assert.ok(sousTelephone(r[0]), 'sous 640 px');
  const hTel = hauteurs(r[0].decl);
  assert.equal(hTel.length, 2, '100vh d\'abord (navigateurs sans dvh), 100dvh ensuite');
  assert.match(hTel[0], /^calc\(100vh /); assert.match(hTel[1], /^calc\(100dvh /);
  for (const v of hTel) assert.equal(T + evalue(v, H, B) + B, H, 'après : la page fait la hauteur de l\'écran, plus de défilement (' + v + ')');
  assert.doesNotMatch(r[0].decl, /min-height/, 'le plancher de 480 px de l\'écran reste (téléphone couché)');
  assert.ok(compare(poids('body.bnav-on .cn-shell'), poids('.cn-shell')) > 0, 'l\'emporte sur le style injecté par l\'écran');
});

test('sans barre du bas (sa place vaut 0), la carte retrouve exactement sa hauteur d\'origine', () => {
  const r = trouve(tel, 'body.bnav-on .cn-shell')[0], src = hauteurs(reglesInjectees(carte, '.cn-shell')[0]);
  assert.equal(evalue(hauteurs(r.decl)[1], 844, 0), evalue(src[src.length - 1], 844, 0));
});

test('ronds de regroupement : zone à toucher de 44 px, centrée sur le même point, rond dessiné inchangé', () => {
  const taille = /iconSize: \[(\d+), (\d+)\]/.exec(carte);
  assert.ok(taille && taille[1] === '34' && taille[2] === '34', 'Leaflet pose 34 × 34 en style direct');
  assert.match(carte, /className: 'cn-clw'/);
  const r = trouve(tel, 'body.bnav-on .leaflet-marker-icon.cn-clw');
  assert.equal(r.length, 1); assert.ok(sousTelephone(r[0]));
  // !important : seul moyen de passer devant un style direct ; marges = moitié de la zone, pour rester centré sur le point de la carte
  assert.match(r[0].decl, /width:44px!important;height:44px!important;margin:-22px 0 0 -22px!important/);
  assert.match(r[0].decl, /display:flex;align-items:center;justify-content:center/, 'le rond de 34 px reste au centre de la zone');
  assert.equal(reglesInjectees(carte, '.cn-cl').filter(d => /width:34px;height:34px/.test(d)).length, 1, 'le rond dessiné garde ses 34 px');
});

test('boutons + et − des cartes : UNE seule règle pour toutes, sous 640 px, à 44 px', () => {
  const zoom = [...tel.map(r => ['v2-tel.css', r]), ...base.map(r => ['v2.css', r])]
    .filter(([, r]) => selecteurs(r.sel).some(s => /leaflet-bar|leaflet-control-zoom/.test(s)));
  assert.equal(zoom.length, 1, 'une seule formulation : ' + zoom.map(([f, r]) => f + ' ' + r.sel).join(' | '));
  const [f, r] = zoom[0];
  assert.equal(f, 'v2.css'); assert.equal(r.sel, 'html .leaflet-touch .leaflet-bar a'); assert.ok(sousTelephone(r));
  assert.equal(r.decl, 'width:44px;height:44px;line-height:44px');
  assert.ok(compare(poids(r.sel), poids('.leaflet-touch .leaflet-bar a')) > 0, 'l\'emporte sur la feuille de Leaflet (30 px)');
});
