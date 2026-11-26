// 26/11/2026 — planche « JARVIS au téléphone : 11 choix », sujet 1 « Mes officines : les filtres », version 1 « Filtres repliés » (choix de Will).
// Au téléphone, la rangée au-dessus de la liste ne garde que la bascule Clients / Prospects, un bouton « Filtres » et « Créer un prospect » ;
// Commercial, Tournée, À rappeler, Tri et Excel passent dans la feuille du bas « Filtres », avec « Voir les N officines ».
// Ce test lance le VRAI code de v2-pharma.js (prénoms, tournées et officines fictifs) et garde quatre choses :
//  1. à l'ordinateur, le HTML de la rangée est celui d'avant, au caractère près, et rien de la feuille n'existe ;
//  2. au téléphone, les cinq commandes sont dans la feuille avec leurs fonctions d'avant (même effet, même état) ;
//  3. le bouton dit combien de filtres de la feuille ne sont pas à leur valeur de départ (« Filtres · 2 ») ;
//  4. tout le style ajouté vit sous 640 px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, sousTelephone } from './aide-css-telephone.mjs';

const src = lire('v2-pharma.js');
function tranche(debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i); assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j);
}
const CODE_MENU = tranche('function commSelect(moi)', '// 25/09/2026 — la table d');
const CODE_RANGEE = tranche("    var chev = '<svg viewBox=\"0 0 24 24\"", '    // En-tête du tableau :');
const CODE_FEUILLE = tranche('  var oflfCorps = null;', '  V2.oflTourn = function');
const CODE_TEL = tranche('  function telEcran()', '\n  // Tournée de livraison');

const TOURNEES = { tournees: { T10: { code: 'T10', nom: 'Est', jours: ['lundi'], arrets: [] }, T12: { code: 'T12', nom: 'Ouest', jours: ['mardi'], arrets: [] } } };
const BASCULE = '<div class="v2-segs"><span class="v2-past-l">Afficher :</span><button type="button" class="v2-seg on" aria-pressed="true">Clients<span class="of-cnt">3</span></button>' +
  '<button type="button" class="v2-seg" aria-pressed="false">Prospects de mon secteur<span class="of-cnt">7</span></button></div>';

// La rangée et la feuille, telles qu'écrites dans renderList. `e` = l'état de l'écran (fictif).
function ecran(e = {}) {
  const ofl = { tourn: '', rap: false, tri: 'ca', sens: -1, moi: true, ...(e.ofl || {}) };
  const user = e.user || { commercial: 'Alice', voitTous: true };
  const V2 = {
    commFilter: e.commFilter || '', esc: (s) => String(s), fmtNum: (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    commercials: () => e.comms || ['Alice', 'Bruno', 'Chloé'],
    mesComms: () => (user.commercial ? [user.commercial] : []),
    ventesRestreintes: () => !user.voitTous,
    notreMarge: { dispo: () => true },
    decrochageUI: { compte: () => (e.sansReleve ? null : 2) }
  };
  const commSelect = new Function('V2', 'ofl', 'esc', CODE_MENU + '; return commSelect;')(V2, ofl, (s) => String(s));
  const phs = [{ p: { id: 'a' } }, { p: { id: 'b' } }, { p: { id: 'c' } }];
  const f = new Function('V2', 'window', 'ofl', 'secteurTab', 'secteurBar', 'commBar', 'oflTel', 'oflNb', 'oflMot', 'phs', '_rap', 'ofDansSecteur', 'nomsOf', 'ICO', 'fbIc',
    CODE_RANGEE + '; return { oflFiltres: oflFiltres, oflfHtml: oflfHtml, oflTournSelect: oflTournSelect, oflTriSelect: oflTriSelect };');
  const commBar = commSelect(true);
  const r = f(V2, { TOURNEES_ECRAN: TOURNEES }, ofl, e.onglet || 'clients', BASCULE, commBar, !!e.tel, 'nb' in e ? e.nb : 2446, e.mot || 'officine',
    phs, { a: 1, b: 1 }, () => true, [], (n, s) => '<i data-ico="' + n + '-' + s + '"></i>', (n, s) => '<i data-fb="' + n + '-' + s + '"></i>');
  return { ...r, commBar, ofl, V2 };
}
const BASC = BASCULE.replace('<span class="v2-past-l">Afficher :</span>', '').replace(/<span class="of-cnt">[^<]*<\/span>/g, '').replace(/v2-segs/g, 'ofl-segs').replace(/v2-seg\b/g, 'ofl-seg');
const CREER = '<button type="button" class="ofl-btn" id="of-creer" title="Créer un prospect" aria-label="Créer un prospect" onclick="V2.pharmaCreerProspect()"><i data-ico="plus-16"></i><span>Créer un prospect</span></button>';
const EXCEL = '<button type="button" class="ofl-btn ofl-btn-x" title="Exporter mes clients en Excel" aria-label="Exporter mes clients en Excel" onclick="V2.pharmaClientsXlsx()"><i data-ico="download-16"></i><span>Excel</span></button>';

test('étalonnage : la condition « téléphone » est fausse sans écran, et suit la largeur de 640 px', () => {
  const tel = (window) => new Function('window', CODE_TEL + '; return telEcran();')(window);
  assert.equal(tel({}), false, 'sans matchMedia (tests, vieux navigateur) : ordinateur');
  const demandes = [];
  assert.equal(tel({ matchMedia: (q) => { demandes.push(q); return { matches: true }; } }), true);
  assert.equal(tel({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(tel({ matchMedia: () => { throw new Error('refus'); } }), false, 'une erreur ne casse pas l\'écran');
  assert.deepEqual(demandes, ['(max-width:640px)']);
});

test('ordinateur : la rangée de filtres est celle d\'avant, au caractère près (onglet Clients)', () => {
  const m = ecran({ tel: false });
  const attendu = BASC + m.commBar + m.oflTournSelect() +
    '<button type="button" class="ofl-chip" aria-pressed="false" onclick="V2.oflRap()">À rappeler (2)</button>' +
    m.oflTriSelect() + '<span class="ofl-act">' + EXCEL + CREER + '</span>';
  assert.equal(m.oflFiltres(), attendu);
  assert.ok(!/oflf|Filtres/.test(m.oflFiltres()), 'ni bouton « Filtres » ni feuille à l\'ordinateur');
});

test('ordinateur : onglet Prospects (ni « À rappeler » ni Excel), filtre en cours, relevé absent : inchangés', () => {
  const p = ecran({ tel: false, onglet: 'prospects' });
  assert.equal(p.oflFiltres(), BASC + p.commBar + p.oflTournSelect() + p.oflTriSelect() + '<span class="ofl-act">' + CREER + '</span>');
  const r = ecran({ tel: false, ofl: { rap: true, tourn: 'T10' }, sansReleve: true });
  assert.equal(r.oflFiltres(), BASC + r.commBar + r.oflTournSelect() +
    '<button type="button" class="ofl-chip ofl-on" aria-pressed="true" onclick="V2.oflRap()">À rappeler</button>' +
    r.oflTriSelect() + '<span class="ofl-act">' + EXCEL + CREER + '</span>');
  assert.ok(!/oflf/.test(p.oflFiltres() + r.oflFiltres()));
});

test('téléphone : la rangée ne garde que la bascule, « Filtres » et « Créer un prospect »', () => {
  const m = ecran({ tel: true });
  const h = m.oflFiltres();
  assert.equal(h, BASC + '<span class="ofl-act"><button type="button" class="ofl-btn oflf-b" id="oflf-b" aria-haspopup="dialog" aria-label="Filtres" onclick="V2.oflFeuille(this)">' +
    '<i data-fb="filtres-16"></i><span>Filtres</span></button>' + CREER + '</span>');
  assert.ok(!/<select|ofl-chip|pharmaClientsXlsx/.test(h), 'les cinq commandes ont quitté la rangée');
  assert.match(src, /filtres: '<path d="M4 21v-7"\/>/, 'le pictogramme « filtres » existe dans FB_IC (sinon la feuille s\'ouvre sans icône)');
});

test('téléphone : le bouton compte les filtres de la feuille qui ne sont pas à leur valeur de départ', () => {
  const lib = (e) => (ecran({ tel: true, ...e }).oflFiltres().match(/<span>(Filtres[^<]*)<\/span>/) || [])[1];
  assert.equal(lib({}), 'Filtres', 'arrivée : « Mon secteur », toutes les tournées, pas de « À rappeler »');
  assert.equal(lib({ ofl: { tourn: 'T10' } }), 'Filtres · 1');
  assert.equal(lib({ ofl: { tourn: 'T10', rap: true } }), 'Filtres · 2');
  assert.equal(lib({ ofl: { tourn: 'T10', rap: true }, commFilter: 'Bruno' }), 'Filtres · 3');
  assert.equal(lib({ ofl: { moi: false } }), 'Filtres · 1', '« Tous » choisi par quelqu\'un qui arrive sur « Mon secteur »');
  assert.equal(lib({ user: { commercial: '', voitTous: true } }), 'Filtres', 'compte sans prénom : « Tous » est sa valeur de départ');
  assert.equal(lib({ user: { commercial: '', voitTous: true }, commFilter: 'Chloé' }), 'Filtres · 1');
  assert.equal(lib({ comms: ['Alice'], user: { commercial: 'Alice', voitTous: false } }), 'Filtres', 'un seul commercial : pas de menu, rien à compter');
  assert.equal(lib({ ofl: { tri: 'nom', sens: 1 } }), 'Filtres', 'le tri n\'est pas compté : il est écrit au-dessus de la liste (« trié par… »)');
  assert.equal(lib({ onglet: 'prospects', ofl: { rap: true } }), 'Filtres', '« À rappeler » ne joue pas sur les prospects');
  const actif = ecran({ tel: true, ofl: { tourn: 'T10', rap: true } }).oflFiltres();
  assert.match(actif, /class="ofl-btn oflf-b oflf-on" id="oflf-b" aria-haspopup="dialog" aria-label="Filtres : 2 en cours"/);
});

test('téléphone : la feuille porte les cinq commandes, avec leurs fonctions d\'avant', () => {
  const m = ecran({ tel: true, ofl: { tourn: 'T12' } });
  const h = m.oflfHtml();
  assert.equal(h, m.commBar + '<div class="oflf-l">' + m.oflTournSelect() +
    '<button type="button" class="ofl-chip" aria-pressed="false" onclick="V2.oflRap()">À rappeler (2)</button></div>' + m.oflTriSelect() +
    '<div class="oflf-fin">' + EXCEL.replace('onclick="V2.pharmaClientsXlsx()"', 'onclick="V2.fbFerme();V2.pharmaClientsXlsx()"') +
    '<button type="button" class="oflf-voir" onclick="V2.fbFerme()">Voir les 2 446 officines</button></div>');
  for (const geste of ['V2.pharmaSetComm(this.value)', 'V2.oflTourn(this.value)', 'V2.oflRap()', 'V2.oflTri(this.value)', 'V2.pharmaClientsXlsx()'])
    assert.ok(h.includes(geste), 'la feuille appelle ' + geste);
  assert.match(h, /<option value="T12" selected>/, 'la tournée choisie est celle de l\'état mémorisé');
  assert.match(h, /<option value="__moi__" selected>Commercial : mon secteur/);
});

test('téléphone : « Voir les N officines » dit le compte réel de la liste, dans le mot de l\'onglet', () => {
  const voir = (e) => (ecran({ tel: true, ...e }).oflfHtml().match(/class="oflf-voir"[^>]*>([^<]*)</) || [])[1];
  assert.equal(voir({ nb: 2446 }), 'Voir les 2 446 officines');
  assert.equal(voir({ nb: 12 }), 'Voir les 12 officines');
  assert.equal(voir({ nb: 1 }), 'Voir l’officine');
  assert.equal(voir({ nb: 0 }), 'Aucune officine');
  assert.equal(voir({ nb: null }), 'Voir la liste', 'pas de compte (chargement, fiches archivées) : pas de chiffre inventé');
  assert.equal(voir({ nb: 38, mot: 'prospect', onglet: 'prospects' }), 'Voir les 38 prospects');
  assert.equal(voir({ nb: 1, mot: 'prospect', onglet: 'prospects' }), 'Voir le prospect');
  assert.equal(voir({ nb: 0, mot: 'prospect', onglet: 'prospects' }), 'Aucun prospect');
  const pros = ecran({ tel: true, onglet: 'prospects', nb: 38, mot: 'prospect' }).oflfHtml();
  assert.ok(!/ofl-chip|pharmaClientsXlsx/.test(pros), 'onglet Prospects : ni « À rappeler » ni Excel, comme dans la rangée d\'avant');
});

test('le compte de la feuille est celui que la liste écrit (oflCompte), remis à « pas de compte » à chaque dessin', () => {
  const compte = tranche('    function oflCompte(n, mot) {', '    function cardHtml(filtered) {');
  assert.match(compte, /oflNb = n; oflMot = mot;/);
  assert.match(src, /function listBody\(\) \{\n      oflNb = null;/);
  assert.match(src, /var oflTel = m1 && telEcran\(\);/, 'la condition téléphone ne vaut que pour l\'écran JARVIS (hors OPSO)');
  assert.match(src, /oflfCorps = oflTel \? oflfHtml : null;\n    oflfMaj\(\);/, 'la feuille n\'a de contenu qu\'au téléphone');
});

// V2.oflFeuille et oflfMaj, tels qu'écrits dans le fichier, avec une fausse page.
function feuille() {
  const posees = [], fermees = [], ecoutes = {};
  const zone = { innerHTML: '', boutons: [], querySelectorAll: () => zone.boutons };
  const doc = { ouverte: false, activeElement: null, getElementById: (id) => (id === 'oflf' ? (doc.ouverte ? zone : null) : id === 'oflf-b' ? doc.bouton || null : null) };
  const V2 = {};
  const f = new Function('V2', 'document', 'window', 'fbPose', 'fbFerme', 'secteurTab', 'fbOp',
    CODE_FEUILLE + '; return { V2: V2, maj: oflfMaj, pose: function (c) { oflfCorps = c; }, op: function () { return fbOp; } };')(
    V2, doc, { addEventListener: (n, g) => { ecoutes[n] = g; }, removeEventListener: (n) => { delete ecoutes[n]; } },
    (x, el) => { posees.push({ x, el }); doc.ouverte = true; }, (s) => { fermees.push(s); doc.ouverte = false; }, 'clients', 'avant');
  return { ...f, posees, fermees, ecoutes, zone, doc };
}

test('V2.oflFeuille : rien à l\'ordinateur ; au téléphone, la feuille du bas existante (fbPose) avec le contenu de l\'écran', () => {
  const m = feuille();
  m.V2.oflFeuille('BOUTON');
  assert.equal(m.posees.length, 0, 'sans contenu (ordinateur), aucune feuille');
  m.pose(() => 'COMMANDES');
  m.V2.oflFeuille('BOUTON');
  assert.equal(m.posees.length, 1);
  assert.deepEqual(m.posees[0].x, { t: 'Filtres', s: 'Clients', ic: 'filtres', h: '<div class="oflf" id="oflf">COMMANDES</div>' });
  assert.equal(m.posees[0].el, 'BOUTON', 'le bouton d\'origine reprend le curseur à la fermeture');
  // retour du navigateur, feuille ouverte : elle se ferme avec l'écran
  assert.equal(typeof m.ecoutes.hashchange, 'function');
  m.ecoutes.hashchange();
  assert.deepEqual(m.fermees, [true]);
  assert.equal(m.ecoutes.hashchange, undefined, 'l\'écoute ne sert qu\'une fois');
});

test('oflfMaj : la feuille ouverte reprend l\'état après chaque geste ; fermée, rien ne bouge ; repassé à l\'ordinateur, elle se ferme', () => {
  const m = feuille();
  let n = 0;
  m.pose(() => 'ETAT ' + (++n));
  m.maj();
  assert.equal(m.zone.innerHTML, '', 'feuille fermée : aucun dessin');
  m.V2.oflFeuille('B');
  m.doc.bouton = 'NOUVEAU BOUTON';
  m.maj();
  assert.equal(m.zone.innerHTML, 'ETAT 2');
  assert.equal(m.op(), 'NOUVEAU BOUTON', 'le bouton « Filtres » redessiné devient celui qui reprend le curseur');
  // « À rappeler » (un bouton) garde le curseur après le redessin ; un menu garde son comportement d'avant (aucun focus forcé)
  let focus = 0;
  const chip = { tagName: 'BUTTON', focus: () => focus++ };
  m.zone.boutons = [chip]; m.doc.activeElement = chip;
  m.maj(); assert.equal(focus, 1);
  m.doc.activeElement = { tagName: 'SELECT', focus: () => focus++ };
  m.maj(); assert.equal(focus, 1);
  m.pose(null);
  m.maj();
  assert.deepEqual(m.fermees, [true], 'plus de contenu (écran repassé à l\'ordinateur) : la feuille se ferme');
});

test('les gestes des filtres gardent leur effet et préviennent la feuille', () => {
  for (const n of ['oflTourn', 'oflRap', 'oflTri', 'oflFeuille']) assert.equal((src.match(new RegExp('V2\\.' + n + '\\s*=', 'g')) || []).length, 1, 'V2.' + n);
  assert.match(src, /V2\.oflTourn = function \(code\) \{ ofl\.tourn = code \|\| ''; if \(oflMaj\) oflMaj\(\); \};/);
  assert.match(src, /V2\.oflRap = function \(\) \{ ofl\.rap = !ofl\.rap; if \(oflMaj\) oflMaj\(\); \};/);
  const maj = tranche('    oflMaj = function () {', '    // 26/11/2026 — téléphone : la feuille « Filtres » lit');
  assert.match(maj, /ofRedessine\(\);\n      oflfMaj\(\);/, 'après la liste (qui recompte), la feuille ouverte est mise à jour');
});

test('messages de la liste : au téléphone ils renvoient à « Filtres » (le menu Commercial n\'est plus au-dessus) ; à l\'ordinateur, le texte d\'avant', () => {
  assert.match(src, /quiRap \? 'Les officines à rappeler sont en cours de calcul\.' : oflTel \? 'Choisissez un commercial dans « Filtres » pour voir ses officines à rappeler\.' : 'Choisissez un commercial dans le menu ci-dessus pour voir ses officines à rappeler\.'\)/);
  assert.match(src, /\(oflTel \? 'Touchez « Filtres », puis choisissez un commercial pour voir les prospects de son secteur \(UGA\)\.' : 'Sélectionnez un commercial dans le menu au-dessus pour voir les prospects de son secteur \(UGA\)\.'\)/);
});

test('style : tout ce qui touche la feuille « Filtres » vit sous 640 px, sans effet interdit sous Safari', () => {
  const css = lire('v2-officines-m1.css');
  const rs = regles(css).filter((r) => /oflf/.test(r.sel));
  assert.ok(rs.length >= 12, 'règles de la feuille présentes (' + rs.length + ')');
  for (const r of rs) {
    assert.ok(sousTelephone(r), 'hors téléphone : ' + r.sel);
    assert.doesNotMatch(r.decl, /backdrop-filter|blur\(|(^|;|\s)opacity\s*:|mask/, 'effet interdit : ' + r.sel);
  }
  // l'ordinateur ne reçoit aucune règle : hors des @media de 640 px, le mot n'apparaît pas
  assert.equal(regles(css).filter((r) => !sousTelephone(r) && /oflf/.test(r.sel + r.decl)).length, 0);
  const regle = (sel) => { const r = rs.filter((x) => x.sel.split(',').map((s) => s.trim()).includes(sel)); assert.equal(r.length, 1, sel); return r[0].decl; };
  assert.match(regle('.oflf .ofl-sel'), /height:48px/, 'menus : 48 px au doigt');
  assert.match(regle('.oflf .ofl-sel select'), /font:700 16px/, 'menus en 16 px : Safari ne zoome pas à l\'ouverture');
  assert.match(regle('.oflf .ofl-chip'), /height:48px/);
  assert.match(regle('.oflf .ofl-btn'), /height:48px/);
  assert.match(regle('.oflf-voir'), /min-height:48px/);
  assert.match(regle('.oflf #v2-pharma-comm'), /background-image:none/, 'une seule flèche sur le menu Commercial');
});
