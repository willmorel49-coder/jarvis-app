/* phirst-tel-agenda-2026-11-25.test.mjs — Agenda au téléphone (maquette « Agenda 1 · aujourd'hui d'abord », choisie par Will le 25/11/2026).
 * Lit le code servi (phirst/v2/phirst-agenda.js et la fin de phirst-preparer.css). Le contenu des rendez-vous vient toujours de la base. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL('../phirst/v2/' + f, import.meta.url), 'utf8');
const js = lire('phirst-agenda.js'), css = lire('phirst-preparer.css');
const i0 = css.indexOf('/* ═══ Agenda au téléphone');
const bloc = i0 >= 0 ? css.slice(i0) : '';
const iM = bloc.indexOf('@media (max-width:700px){');
const base = iM >= 0 ? bloc.slice(0, iM) : bloc, tel = iM >= 0 ? bloc.slice(iM) : '';

test('0 · le bloc de règles existe, en fin de fichier, et tout est préfixé .pa.ag', () => {
  assert.ok(i0 > 0 && iM > 0, 'bloc « Agenda au téléphone » + @media téléphone');
  const sels = bloc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  for (const s of sels) for (const un of s.split(',')) assert.match(un.trim(), /^\.pa\.ag\b/, 'non préfixé : ' + un);
  assert.ok(!/backdrop-filter|filter\s*:|opacity/.test(bloc), 'aucun effet interdit sous Safari');
});
test('1 · ordre : jours, jour choisi et rendez-vous, Demain replié, À confirmer, Avant/Après, annulés', () => {
  const o = (s) => +new RegExp(s.replace(/[.>]/g, '\\$&') + '\\{order:(\\d+)').exec(tel)?.[1];
  assert.match(tel, /\.pa\.ag \.pa-corps\{display:flex;flex-direction:column\}/);
  const seq = ['.pa.ag .pa-corps>.ag-jours', '.pa.ag .pa-corps>.ag-jt', '.pa.ag .pa-corps>.pa-liste', '.pa.ag .pa-corps>.pv-veille', '.pa.ag .pa-corps>.ag-conf', '.pa.ag .pa-corps>.ag-periode', '.pa.ag .pa-corps>.ag-annules'].map(o);
  assert.ok(seq.every((n) => n > 0), 'ordres présents : ' + seq);
  assert.deepEqual([...seq].sort((a, b) => a - b), seq, 'ordre croissant');
});
test('2 · Demain replié : bouton qui déplie (état lu), texte du bandeau inchangé', () => {
  assert.match(js, /data-ag="demain" aria-expanded="' \+ S\.demain/);
  assert.match(js, /if \(a === 'demain'\) \{ S\.demain = !S\.demain; dessiner\(\)/);
  assert.match(js, /esc\(bd\.titre\)[\s\S]*esc\(bd\.sous\)/, 'titre et sous du bandeau toujours lus dans PR.bandeau');
  assert.match(tel, /\.pv-veille \.pv-veille-l\{display:none\}/);
  assert.match(tel, /\.pv-veille\.ag-ouvert \.pv-veille-l\{display:flex\}/);
  assert.match(base, /\.ag-plie-b[^{]*\{display:none\}/, 'bouton caché à l’ordinateur');
});
test('3 · une seule alerte de chevauchement (téléphone), l’alerte par carte reste à l’ordinateur', () => {
  assert.match(js, /function alerteUnique\(chev\)/);
  assert.match(js, /e\.rdv\.id === prem \? alerteUnique\(chev\)/, 'une seule, avant le premier rendez-vous concerné');
  assert.match(js, /class="ag-alerte" role="alert">Attention : deux rendez-vous se chevauchent à cette heure-là/, 'alerte par carte conservée');
  assert.match(base, /\.ag-alerte-u[^{]*\{display:none\}/);
  assert.match(tel, /\.ag-rdv \.ag-alerte\{display:none\}/);
  assert.match(tel, /\.ag-alerte-u\{display:block/);
});
test('4 · un seul bouton plein par carte, les autres en contour', () => {
  assert.match(tel, /\.ag-rdv>\.pa-bs \.pa-ok~\.pa-ok\{[^}]*background-color:#fff/);
  assert.match(tel, /\.ag-rdv>\.pa-bs \.pv-prep\{flex:1 1 100%/);
  assert.match(tel, /\.ag-rdv>\.pa-bs \.pa-b\{flex:1 1 calc\(50% - 8px\);min-height:44px/);
});
test('5 · le jour choisi est en vert clair, plus de bloc sombre ; rangée qui défile', () => {
  const r = /\.pa\.ag \.ag-jour\[aria-pressed="true"\]\{([^}]*)\}/.exec(tel)?.[1] || '';
  assert.match(r, /background-color:#E4F1E8/); assert.doesNotMatch(r, /#1A3A2E;color:#fff|background-color:var\(--au-accent/);
  assert.match(tel, /\.pa\.ag \.ag-jours\{display:flex[^}]*overflow-x:auto/);
});
test('6 · « Ensuite » : bloc sombre caché, étiquette claire sur le rendez-vous', () => {
  assert.match(tel, /\.ag-ens:not\(\.ag-ens-vide\)\{display:none\}/);
  assert.match(js, /class="lg-et ag-ensuite">' \+ esc\(ens\.mot\)/);
  assert.match(js, /ag-ens' \+ \(c\.vide \? ' ag-ens-vide'/);
  assert.match(base, /\.ag-ensuite[^{]*\{display:none\}/);
  assert.match(tel, /\.ag-ensuite\{display:inline-block;background-color:#DDF0EE/);
  assert.match(js, /P\.carteEnsuite\(/, 'le bloc d’origine est toujours produit (ordinateur)');
});
test('7 · la ligne qui répète le nom de la pharmacie est retirée au téléphone seulement', () => {
  assert.match(js, /<span class="ag-lieu">' \+ esc\(lieu\) \+ ' · <\/span>' \+ esc\(r\.objet\)/);
  assert.match(tel, /\.ag-rdv \.ag-lieu\{display:none\}/);
  assert.ok(!/\.ag-lieu/.test(base));
  // seul un lieu qui REPREND le nom de la pharmacie est caché ; une vraie adresse reste lisible au téléphone
  assert.match(js, /repete = !!lieu && !!nomBas && String\(lieu\)\.trim\(\)\.toLowerCase\(\)\.indexOf\(nomBas\) === 0/);
  assert.match(js, /repete && r\.objet \? '<span class="ag-lieu">'/);
});
test('8 · À confirmer : nombre à droite ; Annulés en carte repliée ; textes réels non touchés', () => {
  assert.match(js, /class="ag-conf-n">' \+ conf\.length/);
  assert.match(base, /\.ag-conf-n\{display:none\}/);
  assert.match(tel, /\.ag-annules>summary\.ag-sh\{display:flex/);
  assert.match(js, /Annulés ce jour \(' \+ annules\.length/);
  assert.match(js, /'Les rendez-vous de Yann, jour par jour\.'/, 'téléprospectrice');
  assert.match(js, /En attente de Yann/);
});
test('9 · à l’ordinateur rien ne change : toutes les règles de mise en page sont dans le @media téléphone', () => {
  assert.match(tel, /^@media \(max-width:700px\)\{/);
  assert.doesNotMatch(base, /order:|flex-direction|overflow-x/);
  assert.ok(!/\bpa-corps\b/.test(base));
});
