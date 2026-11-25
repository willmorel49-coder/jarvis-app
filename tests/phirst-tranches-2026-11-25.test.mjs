/* phirst-tranches-2026-11-25.test.mjs — les 15 corrections tranchées par Will le 25/11/2026 (audit Z6-nuit, defauts-A.md et defauts-B.md).
 * Un cas par correction (n° 1 à 15), lu dans le code ou par appel d'une fonction pure. Les textes affichés et les règles CSS sont lus
 * dans les fichiers servis (phirst/v2 et crm/v2), jamais recopiés ici.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const P = req('../phirst/v2/phirst-pur.js');
const R = req('../phirst/v2/phirst-preparer-pur.js');
const lire = (f) => readFileSync(new URL('../phirst/v2/' + f, import.meta.url), 'utf8');
const socle = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const NB = ' ';

/* contraste WCAG */
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/* le corps d'une règle CSS : « sélecteur{…} » */
const regle = (css, sel) => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, 'règle absente : ' + sel); return css.slice(i + sel.length + 1, css.indexOf('}', i)); };

/* ═══ Encaisser ═══ */
test('1 · « dont X € en retard » : texte seul, sans fond ni arrondi, lisible sur le vert foncé', () => {
  const css = lire('phirst-encaisser.css');
  for (const sel of ['.en .en-retard', '.en .en-retard.ok']) {
    const r = regle(css, sel);
    assert.doesNotMatch(r, /background|border-radius|padding/, sel);
    const col = /color:(#[0-9A-Fa-f]{6})/.exec(r);
    assert.ok(col, sel + ' : une couleur de texte');
    assert.ok(contraste(col[1], '#24503F') >= 4.5, sel + ' : contraste ≥ 4,5 sur #24503F (le point le plus clair du dégradé de fond de la bande)');
  }
  assert.notEqual(/color:(#[0-9A-Fa-f]{6})/.exec(regle(css, '.en .en-retard'))[1], /color:(#[0-9A-Fa-f]{6})/.exec(regle(css, '.en .en-retard.ok'))[1], 'rouge clair / vert clair');
});

test('2 · les jours (« En retard · 19 jours », « Sans réponse · 15 jours ») : texte coloré sans fond, dans Encaisser seulement', () => {
  const js = lire('phirst-encaisser.js'), css = lire('phirst-encaisser.css');
  assert.match(js, /function pastille\(a\) \{[^}]*en-jours/);
  const r = regle(css, '.en.dz .dz-et.en-jours');
  assert.match(r, /background-color:transparent/); assert.match(r, /padding:0/);
  assert.doesNotMatch(lire('phirst-dossiers.css'), /en-jours/, 'Dossiers garde ses pastilles');
  assert.match(js, /'<span class="dz-et">' \+ esc\(v\.nom\)/, 'les pastilles de nom de volet restent des pastilles');
});

test('3 · le titre « Encaisser » de la bande a la taille des autres écrans ; Réglages n’est pas touché', () => {
  const taille = /clamp\(32px,9vw,40px\)/;
  assert.match(regle(lire('phirst-encaisser.css'), '.en .en-bande h1'), taille);
  assert.match(lire('phirst-finitions.css'), /\.pa \.pa-tete h1\{[^}]*clamp\(32px,9vw,40px\)/);
  assert.match(lire('phirst-reglages.css'), /font:800 24px/, 'Réglages garde son titre (point non tranché)');
});

test('4 · les 3 cartes du bas ont la même hauteur', () => {
  assert.match(regle(lire('phirst-encaisser.css'), '.en .en-trois'), /align-items:stretch/);
});

test('5 · la note « Le ton suit le retard… » sous le message est retirée', () => {
  const js = lire('phirst-encaisser.js');
  assert.doesNotMatch(js, /Le ton suit le retard/);
  assert.match(js, /Déjà relancé|phraseRelance/, 'marqueur positif : la phrase « ce message est plus net » reste dans phraseRelance');
  assert.match(lire('phirst-encaisser-pur.js'), /ce message est plus net/);
});

/* ═══ Veille ═══ */
test('6 · Veille à l’ordinateur : la pastille de famille suit le nom (colonne 2, juste après la colonne du nom)', () => {
  const css = lire('phirst-finitions.css'), i = css.indexOf('3. Veille');
  const veille = css.slice(i, css.indexOf('4. Agenda'));
  assert.match(veille, /\.pv \.pa-l\{display:grid;grid-template-columns:minmax\(0,max-content\) max-content minmax\(0,1fr\) 330px/);
  assert.match(veille, /\.pv \.pa-ht \.lg-et\{grid-column:2;/);
  assert.match(veille, /\.pv \.pa-bs\{grid-column:4;/);
  assert.doesNotMatch(veille, /grid-template-columns:minmax\(0,1fr\) 200px 330px/, 'l’ancienne colonne fixe de 200 px');
  assert.match(lire('phirst-appels.css'), /@media[^{]*\{[^@]*\.pa-ht\{flex-direction:column;gap:8px\}/, 'au téléphone : pastille sous le nom, à 8 px');
});

/* ═══ Socle JARVIS (Bloc-notes, To do list) ═══ */
test('7 · Bloc-notes : tout au vouvoiement', () => {
  const js = socle('v2-bloc-notes.js');
  assert.match(js, /Écrivez ou dictez la première ci-dessus/);
  assert.match(js, /Écrivez ou dictez quelque chose d’abord/);
  assert.match(js, /Utilisez le micro de dictée/);
  assert.doesNotMatch(js, /Écris ou dicte|Utilise le micro/);
});

test('8 · Bloc-notes : le micro de dictée porte le mot « Dicter »', () => {
  assert.match(socle('v2-bloc-notes.js'), /class="bn-mic"[^>]*>' \+ ic\('mic'\) \+ 'Dicter<\/button>/);
  assert.doesNotMatch(regle(socle('v2-bloc-notes.js').replace(/'\s*,\s*\n\s*'/g, ''), '.bn-mic') || '', /(^|;)width:44px/, 'plus un carré de 44 px fixe');
});

test('9 · To do list vide : une seule phrase, celle du bandeau, avec l’apostrophe courbe', () => {
  const js = socle('v2-todo.js');
  assert.doesNotMatch(js, /La liste est vide/);
  assert.match(js, /Rien à faire pour l’instant\. Ajoutez votre première tâche\./);
  assert.doesNotMatch(js, /Rien à faire pour l\\'instant[ :.] ?(Ajoutez|tout est)/, 'apostrophe droite retirée des deux phrases du bandeau');
});

test('10 · To do list au téléphone : le span vide de la barre ne décale plus le bouton « Ajouter une tâche »', () => {
  const css = socle('v2-todo-m1.css'), tel = css.slice(css.indexOf('@media (max-width:760px)'));
  assert.match(tel, /\.td-m1 \.tb-barre>span:empty\{display:none\}/);
});

test('11 · To do list au téléphone : le bandeau laisse la place à l’horizon sous la phrase (il retombait dans la phrase)', () => {
  // v2-aube.js pose l'horizon à « bas de la phrase + 12 px » seulement s'il reste 4 px avant le bas du bandeau ; sinon il retombe à 78 %.
  // Mesuré en prod le 25/11 : phrase sur 2 lignes 86-134, bandeau 149 px (14 px de marge) → trait à 116, dans la phrase. Il faut au moins 12 + 4 + 1 (bord) = 17 px.
  const css = socle('v2-todo-m1.css'), d = css.indexOf('@media (max-width:760px)'), f = css.indexOf("L'arrivée", d);
  const bloc = css.slice(d, f), m = bloc.match(/\.td-m1 \.td-hd\{padding-bottom:(\d+)px\}/);
  assert.ok(m && +m[1] >= 17, 'marge du bas du bandeau au téléphone : ' + (m ? m[1] : 'absente') + ' px');
  assert.ok(!/aube-horizon[^{]*\)\{display:none/.test(css), 'le décor éclairé (horizon, sol) reste au téléphone');
});
test('socle : les deux pages (JARVIS et Phirst) chargent les mêmes fichiers modifiés', () => {
  const phirst = lire('index.html'), jarvis = socle('index.html');
  assert.match(phirst, /crm\/v2\/v2-todo-m1\.css/); assert.match(phirst, /crm\/v2\/v2-todo\.js/); assert.match(phirst, /crm\/v2\/v2-bloc-notes\.js/);
  assert.match(jarvis, /v2-todo-m1\.css/); assert.match(jarvis, /'v2-todo\.js'/); assert.match(jarvis, /'v2-bloc-notes\.js'/);
});

/* ═══ Doublons ═══ */
test('12 · Appels : « De la part de X » ne redit pas « Recommandée par X (ville), client de Yann » ; la raison n’est plus coupée', () => {
  const r = { motif: 'recommande', nom: 'Pharmacie de la Mer', ville: 'Noirmoutier', etiquette: 'De la part de Pharmacie du Pré Lormeau',
    raisons: ['Recommandée par Pharmacie du Pré Lormeau (Pornic), client de Yann', 'Robot Riedl d’ici mai 2027'] };
  assert.deepEqual(P.raisonsAffichees(r), ['Robot Riedl d’ici mai 2027']);
  assert.equal(r.raisons.length, 2, 'le tableau d’origine n’est pas modifié');
  const seule = { ...r, raisons: [r.raisons[0]] };
  assert.deepEqual(P.raisonsAffichees(seule), []);
  /* une recommandation d’un AUTRE confrère reste dite, et sans pastille « De la part de » rien ne part */
  assert.deepEqual(P.raisonsAffichees({ ...r, raisons: ['Recommandée par Pharmacie des Dunes (Pornic), client de Yann'] }), ['Recommandée par Pharmacie des Dunes (Pornic), client de Yann']);
  assert.deepEqual(P.raisonsAffichees({ motif: 'cession', etiquette: '', raisons: ['Recommandée par X'] }), ['Recommandée par X']);
  assert.match(lire('phirst-appels.js'), /rs = P\.raisonsAffichees\(r\)/);
  const css = lire('phirst-finitions.css');
  assert.doesNotMatch(css, /line-clamp:\s*[12]\b/, 'plus de « … » au milieu d’une raison (ordinateur et téléphone)');
  assert.doesNotMatch(regle(css, '.pa-l .pa-r1'), /overflow:hidden|-webkit-box/);
});

test('13 · Dossiers : l’étape qui bloque est dite une fois ; un dossier en retard ne se range plus sous « Ils avancent »', () => {
  const js = lire('phirst-dossiers.js');
  assert.doesNotMatch(js, /retenuCarte|dz-retenu/, 'la pastille grise « Cette semaine · … » est retirée');
  assert.doesNotMatch(lire('phirst-dossiers.css'), /dz-retenu/);
  assert.match(js, /function citeeDansBandeau\(ph, u\)/);
  assert.match(js, /if \(citeeDansBandeau\(ph, u\)\) \{[^}]*\} else if \(u\) \{/, 'la carte d’une pharmacie citée ne répète pas l’étape');
  assert.match(js, /groupe\('En retard'/);
  assert.match(js, /groupe\('Ils avancent', D\.pl\(avance\.length/);
  assert.match(js, /D\.enRetard\(ph\.volets, auj\(\)\)/);
});

test('14 · Accueil : la pharmacie de la grande carte n’est pas redite dans la liste ; « à venir » est un chiffre-rail de même taille', () => {
  const js = lire('phirst-ligne.js'), css = lire('phirst-ligne.css');
  assert.match(js, /function estLaChose\(c, p\)/);
  assert.match(js, /lignes\(c \? s\.pharmacies\.filter\(function \(p\) \{ return !estLaChose\(c, p\); \}\) : s\.pharmacies\)/);
  assert.doesNotMatch(css, /lg-avenir/, 'plus de règle qui rapetisse ni ne descend le mot « à venir »');
  assert.match(js, /\(av \? '—' : n\)/);
  assert.match(js, /aria-label="' \+ esc\(s\.mot\) \+ ' : ' \+ \(av \? 'à venir'/, 'le lecteur d’écran dit toujours « à venir »');
});

test('15 · Agenda, bandeau « Demain » : chaque pastille dit la pharmacie (et la ville si la place le permet)', () => {
  const el = (id, debut, nom, ville) => ({ rdv: { id, statut: 'confirme', debut, fin: debut }, fiche: { nom, ville } });
  const b = R.bandeau([el('a', '2026-11-25T11:00', 'Pharmacie Essai A', 'Essai-sur-Mer'), el('b', '2026-11-25T11:00', 'Pharmacie Essai B', 'Essai-sur-Mer'),
    el('c', '2026-11-25T15:00', 'Pharmacie de la Grande Rue du Vieux Port', 'Saint-Gilles-Croix-de-Vie')], '2026-11-24');
  const t = b.boutons.map((x) => x.texte);
  assert.equal(new Set(t).size, 3, 'plus deux pastilles identiques');
  assert.equal(t[0], '11 h' + NB + '·' + NB + 'Pharmacie Essai A' + NB + '·' + NB + 'Essai-sur-Mer');
  assert.ok(t[2].includes('Pharmacie de la Grande Rue du Vieux Port') && !t[2].includes('Saint-Gilles'), 'ville laissée de côté quand le texte devient long');
  for (const x of t) assert.doesNotMatch(x, /[^ ]·|·[^ ]/, 'chaque « · » est tenu par des insécables des deux côtés');
});
