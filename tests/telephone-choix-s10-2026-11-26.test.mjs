// 26/11/2026 — barre du haut des petits téléphones : choix de Will sur la planche « JARVIS au téléphone : 11 choix », sujet 10,
// VERSION 3 « 8 px, le nom court » : à 380 px de large et moins, les quatre boutons de droite passent de 2 à 8 px d'écart.
// La place est reprise au bouton Retour (100 → 85 px) et au nom de la marque, qui n'est PAS masqué (version 1, retirée le 25/11) :
// seul son premier mot se voit, « JARVIS » au lieu de « JARVIS Pharma ».
// Ce que ce test garde :
//   · les cinq règles existent, sous 380 px, à l'intérieur du bloc 640 px de v2.css ;
//   · le nom n'est ni masqué ni réécrit en dur : il vient toujours de V2_BRAND.name, entier dans la page ;
//   · le compte tombe juste à 360 et 375 px (positions attendues des boutons, rien de rogné) ;
//   · au-dessus de 380 px et à l'ordinateur, rien ; Phirst et OPSO ne reçoivent rien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lire, regles, trouve, sousTelephone, largeurMax, poids, compare } from './aide-css-telephone.mjs';

const base = regles(lire('v2.css')), pieces = regles(lire('v2-pieces.css')), app = lire('v2-app.js'), page = lire('index.html');
const ailleurs = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const P = 'html:not([data-teinte]) body.bnav-on ';
const S = {
  droite: P + '.tp-d', gauche: P + '.tp-g', retour: P + '.v2-top .v2-back',
  nom: P + '.v2-top .v2-brand-t', cadre: P + '.v2-top .v2-brand:not(.v2-brand-compact)>span:not(.v2-logo)'
};
const sous380 = r => r.medias.some(m => largeurMax(m) <= 380);
const une = sel => { const r = trouve(base, sel); assert.equal(r.length, 1, 'une seule règle « ' + sel + ' » dans v2.css'); return r[0]; };
const px = (decl, prop) => { const m = new RegExp('(?:^|;)' + prop + ':(\\d+(?:\\.\\d+)?)px').exec(decl); assert.ok(m, prop + ' en px dans « ' + decl + ' »'); return +m[1]; };

test('étalonnage : la lecture des feuilles rend des valeurs connues', () => {
  assert.deepEqual(poids('.tp-d'), [0, 1, 0]);
  assert.deepEqual(poids(S.droite), [0, 3, 2]);
  assert.equal(largeurMax('(max-width:380px)'), 380);
  assert.ok(base.length > 1000 && pieces.length > 100, 'marqueur : feuilles bien lues (' + base.length + ' et ' + pieces.length + ' règles)');
});

test('sous 380 px : 8 px entre les boutons de droite, 4 px à gauche, bouton Retour resserré', () => {
  assert.equal(une(S.droite).decl, 'gap:8px');
  assert.equal(une(S.gauche).decl, 'gap:4px');
  assert.equal(une(S.retour).decl, 'gap:4px;padding:0 8px 0 5px');
  for (const k of Object.keys(S)) {
    const r = une(S[k]);
    assert.deepEqual(r.medias.map(largeurMax), [640, 380], S[k] + ' : sous 380 px, dans le bloc 640 px');
    assert.ok(sousTelephone(r) && sous380(r));
  }
});

test('le nom de la marque n\'est pas masqué : il se replie sur son espace et son cadre ne montre que la première ligne', () => {
  assert.equal(une(S.nom).decl, 'white-space:normal', 'le nom peut se replier (il était en « nowrap » sous 640 px)');
  const d = une(S.cadre).decl;
  assert.match(d, /(^|;)width:min-content/, 'le cadre prend la largeur du mot le plus long : le nom se replie mot par mot');
  assert.equal(px(d, 'height'), px(d, 'line-height'), 'cadre haut d\'une seule ligne');
  assert.match(d, /(^|;)overflow:hidden/, 'les lignes suivantes ne se voient pas');
  assert.doesNotMatch(d, /display:none|visibility|font-size:0|text-indent/, 'le nom n\'est pas retiré de la page');
  // rien, sous 380 px, ne masque le bloc du nom (c'était la version 1, retirée le 25/11)
  const masque = base.filter(r => sous380(r) && /v2-brand/.test(r.sel) && /display:none/.test(r.decl));
  assert.equal(masque.length, 0, 'aucune règle « display:none » sur la marque sous 380 px');
});

test('le nom court n\'est pas écrit en dur : il vient du réglage de la page, dont le texte entier reste dans la barre', () => {
  // aucune règle de v2.css ne fabrique un texte de marque (content:"JARVIS"…)
  assert.equal(base.filter(r => /content:\s*["'][^"']*(JARVIS|Pharma)/i.test(r.decl)).length, 0);
  const m = /window\.V2_BRAND = \{ name: '([^']+)', sub: 'Espace commercial' \};/.exec(page);
  assert.ok(m, 'marqueur : le nom de la marque est posé par index.html');
  assert.equal(m[1], 'JARVIS Pharma');
  assert.deepEqual(m[1].split(' '), ['JARVIS', 'Pharma'], 'deux mots séparés par une espace ordinaire : le premier se voit, le second passe à la ligne cachée');
  // la barre écrit ce nom tel quel, dans le bloc que visent les règles (a.v2-brand > span > span.v2-brand-t)
  assert.ok(app.includes('\'<span><span class="v2-brand-t">\' + ((window.V2_BRAND && window.V2_BRAND.name) || \'Intégral Pharma\')'), 'v2-app.js écrit V2_BRAND.name dans .v2-brand-t');
  assert.match(app, /<a class="v2-brand' \+ \(back \? ' v2-brand-compact' : ''\) \+ '" onclick="V2\.go\(\\'home\\'\)" title="Accueil" aria-label="Accueil">/, 'le lien de la marque s\'annonce toujours « Accueil »');
});

test('ces règles pèsent plus lourd que celles qu\'elles remplacent', () => {
  const serre = trouve(pieces, '.tp-d').find(r => sous380(r));
  assert.ok(serre && /gap:2px/.test(serre.decl), 'v2-pieces.css serre toujours les boutons à 2 px sous 380 px (la règle remplacée)');
  assert.ok(compare(poids(S.droite), poids('.tp-d')) > 0);
  assert.ok(compare(poids(S.gauche), poids('.tp-g')) > 0);
  assert.ok(compare(poids(S.retour), poids('.v2-back')) > 0);
  const nowrap = trouve(base, 'html .v2-brand-t').find(r => /white-space:nowrap/.test(r.decl));
  assert.ok(nowrap && sousTelephone(nowrap), 'sous 640 px le nom reste sur une ligne (au-dessus de 380 px, rien ne change)');
  assert.ok(compare(poids(S.nom), poids('html .v2-brand-t')) > 0);
});

test('le compte tombe juste à 360 et à 375 px : boutons à 8 px d\'écart, rien de rogné à gauche', () => {
  // ce que posent les feuilles sous 380 px
  const barre = trouve(pieces, '.v2-top').find(r => sous380(r)), zone = trouve(pieces, '.tp-g').find(r => !r.medias.length);
  assert.ok(barre && zone, 'marqueur : règles de la barre dans v2-pieces.css');
  const marge = +/padding:0 (\d+)px/.exec(barre.decl)[1], entre = px(barre.decl, 'gap'), bord = px(zone.decl, 'padding');
  assert.deepEqual([marge, entre, bord], [8, 4, 2]);
  const ecart = px(une(S.droite).decl, 'gap'), B = 44;
  assert.ok(ecart >= 8, 'écart entre deux boutons : ' + ecart + ' px');
  const boutons = L => [3, 2, 1, 0].map(k => L - marge - B - k * (B + ecart));
  assert.deepEqual(boutons(360), [152, 204, 256, 308], 'Rechercher, ampoule, « + », Mon compte à 360 px');
  assert.deepEqual(boutons(375), [167, 219, 271, 323], 'à 375 px');
  for (const L of [360, 375]) {
    const debut = marge + bord, fin = boutons(L)[0] - entre - bord;   // la zone de gauche, hors de son bord de 2 px (elle coupe ce qui dépasse)
    assert.equal(debut, 10);
    // écran interne : Retour + maison. « Retour » = 46 px mesurés sous WebKit (audit du 25/11 : 100 px − 2 de filet − 26 de marges − 20 d'icône − 6 d'écart)
    const r = une(S.retour).decl, pad = /padding:0 (\d+)px 0 (\d+)px/.exec(r);
    const retour = 2 + (+pad[1]) + (+pad[2]) + 20 + px(r, 'gap') + 46;
    assert.equal(retour, 85, 'bouton Retour : 85 px (100 avant)');
    const maison = debut + retour + px(une(S.gauche).decl, 'gap');
    assert.equal(maison, 99, 'la maison commence à x = 99');
    assert.ok(maison + B <= fin, L + ' px : la maison finit à ' + (maison + B) + ', la zone à ' + fin);
    // accueil : logo de 44 px, 8 px, puis le premier mot. « JARVIS » = 52,7 px et « Pharma » (le mot le plus long, donc la largeur du cadre) = 53,0 px,
    // en Archivo 14 px graisse 800 (mesure sur le fichier de police, outil étalonné sur « Intégral Pharma » = 108 px sous WebKit)
    const ecartMarque = px(trouve(base, 'html .v2-brand').find(x => sousTelephone(x)).decl, 'gap');
    const nom = debut + B + ecartMarque;
    assert.equal(nom, 62, 'le nom commence à x = 62');
    assert.ok(nom + 53 <= fin, L + ' px : le nom court finit à ' + (nom + 53) + ', la zone à ' + fin);
    assert.ok(nom + 108 > fin, L + ' px : le nom entier (108 px) ne tenait pas, d\'où le nom court');
  }
});

test('au-dessus de 380 px et à l\'ordinateur, rien ; Phirst et OPSO ne reçoivent rien', () => {
  // toute règle de v2.css qui commence par ce préfixe et touche la barre du haut vit sous 380 px
  const miennes = base.filter(r => r.sel.includes(P.trim()) && /\.tp-d|\.tp-g|\.v2-back|\.v2-brand/.test(r.sel));
  assert.equal(miennes.length, 5);
  for (const r of miennes) assert.ok(sous380(r) && sousTelephone(r), r.sel);
  // Phirst : sa page porte data-teinte, que le préfixe exclut
  assert.match(ailleurs('phirst/v2/index.html'), /<html lang="fr" data-teinte="phirst">/);
  assert.match(P, /^html:not\(\[data-teinte\]\) /);
  // OPSO : body.bnav-on n'y est jamais posée (V2.tbMaj sort avant), et sa page ne charge pas v2-tel.css
  // (26/11/2026 : la garde lit le réglage de groupement commun, V2.enGroupement(), qui couvre OPSO — commit 9499b7053)
  assert.match(app, /if \(!V2\.user \|\| V2\.enGroupement\(\) \|\| [^{]*!document\.querySelector\('link\[href\*="v2-tel\.css"\]'\)\) \{\s*if \(n && n\.parentNode\) n\.parentNode\.removeChild\(n\);\s*b\.classList\.remove\('bnav-on'\); return;/);
  assert.doesNotMatch(ailleurs('opso/v2/index.html'), /v2-tel\.css/);
});
