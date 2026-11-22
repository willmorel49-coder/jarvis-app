// 21/11/2026 (Will) — fiche « Le dossier » : le chapitre « Côté Intégral » = l'alerte de baisse + notre marge par tranche de prix
// (en euros, taux, face au national, écart en points) + la comparaison à nos clients ; le reste devient 6 boutons visibles dans
// les deux vues, chaque contenu dans un <dialog> ; rotations du groupement retirées ; couleurs de l'accueil, aucun ton chaud.
// Le vrai code (v2-pharma.js) est exécuté dans une fausse fenêtre, sur des officines et des montants FICTIFS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const js = lire('crm/v2/v2-pharma.js'), css = lire('crm/v2/v2.css');
const tranche = (a, b) => { const i = js.indexOf(a); assert.ok(i > 0, a + ' introuvable'); const j = js.indexOf(b, i); assert.ok(j > i, b + ' introuvable'); return js.slice(i, j + b.length); };
const BLOC = tranche('  var FDR_TR = [', "if (ta) { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } }\n    }\n  };\n");
const BOUTONS = tranche('  function fdrGrandsBoutons(pid, voitVentes) {', "\n  }\n");
const corps = (nom) => { const i = js.indexOf('function ' + nom + '('); assert.ok(i > 0, nom); return js.slice(i, js.indexOf('\n  }\n', i)); };

const MOIS = ['2026-01', '2026-02', '2026-03'];
const VIDE = () => ({ p: 0, p1: 0, p2: 0, i: 0, c: 0, fr: 0, nr: 0 });
// officine fictive F1 (montants inventés) : petits prix 843,60 € de marge pour 9 520 € de CA (8,861 %) ; 4,33-468 € 3 000 € pour 100 000 € (3 %) ; rien d'autre
const F1 = { n: 3, tot: 3843.6, fam: { ...VIDE(), p: 843.6, i: 3000 }, caFam: { ...VIDE(), p: 9520, i: 100000 }, moisCouverts: MOIS };
// toutes les officines chargées (repli de qui voit tout) : petits prix 6 %, 4,33-468 € 2 %
const TOUS = { n: 9, tot: 10000, fam: { ...VIDE(), p: 6000, i: 4000 }, caFam: { ...VIDE(), p: 100000, i: 200000 }, moisCouverts: MOIS };

function monde({ restreint = true, tauxFam = null, couverts = MOIS, caFam = true } = {}) {
  const appels = [], dialogs = {};
  const NM = {
    livraison: () => ({ cout: 20, moy: tauxFam ? { n: 9, tauxFam, tauxTot: 4.6 } : { n: 9 } }),
    mois: () => MOIS.slice(), somme: () => TOUS, libelleDate: () => 'estimation', reserve: () => '', nomMoisLong: (m) => m, noteGen: () => ''
  };
  const ctx = {
    Math, String, JSON, Array, Object,
    V2: {
      esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
      fmtNum: (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
      notreMarge: NM, ventesRestreintes: () => restreint, todo: { menu: 1 },
      pharmaNav: { noter: () => appels.push('noter') }
    },
    notreMargeDe: () => ({ ...F1, caFam: caFam ? F1.caFam : null, moisCouverts: couverts }),
    moisVentes: () => ({ du: couverts[0], au: couverts[couverts.length - 1] }),
    analyseNotreMarge: () => '<div class="ancien-bloc"></div>',
    fdrComparaison: () => '<div class="fdr-bloc fdr-cmp">COMPARAISON</div>',
    fbC: {}, isEscale: () => false, isOpso: () => false, txLgoDetect: () => 'lgo', fbIc: () => '', fiLgoTitre: () => 'Catalogue pour son logiciel',
    rv2Glisse: () => {},   // geste « glisser pour fermer » du téléphone (testé dans fiche-telephone-barre-pouce.test.mjs)
    document: { getElementById: (id) => dialogs[id] || null }
  };
  ctx.esc = ctx.V2.esc; ctx.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  vm.runInNewContext(BOUTONS + BLOC, ctx);
  return { ctx, appels, dialogs };
}
const lignes = (h) => [...h.matchAll(/<div class="fdr-mt-r" role="row">([\s\S]*?)<\/span><\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, ''));

const NAT = { p: 7.449, p1: null, p2: null, i: 3.6, c: 1.1, fr: 4.4, nr: 6.1 };   // taux nationaux FICTIFS
const E = (n) => n + ' €';   // montant tel que la fiche l'écrit (fmtNum fictif : espace fine entre milliers)

test('marge par tranche : euros entiers, taux, national du générateur, écart calculé sur les taux AFFICHÉS', () => {
  const { ctx } = monde({ tauxFam: NAT });
  const h = ctx.fdrMargeTranches('F1');
  assert.match(h, /<h3>Notre marge par tranche de prix<\/h3>/);
  // 8,861 % s'affiche 8,9 % ; national 7,449 → 7,4 % ; écart LU = 8,9 − 7,4 = +1,5 pt (l'écart brut, +1,412, aurait donné +1,4)
  assert.deepEqual(lignes(h), ['Moins de 4,33 €|' + E('844') + '|8,9 %|7,4 %|+1,5 pt', 'De 4,33 à 468 €|' + E('3 000') + '|3,0 %|3,6 %|−0,6 pt']);
  assert.match(h, /fdr-mt-dn">−0,6 pt/); assert.match(h, /fdr-mt-up">\+1,5 pt/);
  // total : 3 844 € (entier), 3 843,6 / 109 520 = 3,5 %, national toutes tranches 4,6 % (fictif)
  assert.ok(h.includes('<b class="cl1-num">' + E('3 844') + '</b><span>3,5 % · national 4,6 %</span>'), 'total');
  assert.ok(!/\d,\d\d? €/.test(h), 'un montant en euros porte des centimes');
  assert.match(h, /national : toutes nos officines clientes, mêmes mois/);
});

test('marge par tranche : une tranche sans chiffre d\'affaires ni marge n\'a pas de ligne ; fichier d\'avant le 17/11 = l\'ancien bloc', () => {
  const h = monde({ tauxFam: NAT }).ctx.fdrMargeTranches('F1');
  for (const t of ['Moins de 3,17 €', 'De 3,17 à 4,33 €', 'Plus de 468 €', 'Chaîne du froid', 'Non remboursés']) assert.ok(!h.includes('>' + t + '<'), t + ' affichée à vide');
  assert.equal(monde({ caFam: false }).ctx.fdrMargeTranches('F1'), '<div class="ancien-bloc"></div>');
});

test('national : un commercial (qui ne charge que SES officines) sans taux du générateur voit « — », jamais la moyenne de ses clients', () => {
  const h = monde({ restreint: true }).ctx.fdrMargeTranches('F1');
  assert.deepEqual(lignes(h), ['Moins de 4,33 €|' + E('844') + '|8,9 %|—|—', 'De 4,33 à 468 €|' + E('3 000') + '|3,0 %|—|—']);
  assert.ok(!/national :|· national [0-9]/.test(h), 'ni légende ni total « national » sans taux national (seul l\'en-tête de colonne reste, avec « — »)');
  // fenêtre de la fiche plus courte que le fichier : le taux du générateur (tous les mois) ne vaut pas, « — » aussi
  assert.ok(!/national :|· national [0-9]/.test(monde({ restreint: true, tauxFam: NAT, couverts: MOIS.slice(1) }).ctx.fdrMargeTranches('F1')));
});

test('national : qui voit TOUTES les officines le recalcule sur les lignes chargées quand le générateur ne l\'a pas écrit', () => {
  const L = lignes(monde({ restreint: false }).ctx.fdrMargeTranches('F1'));
  assert.deepEqual(L, ['Moins de 4,33 €|' + E('844') + '|8,9 %|6,0 %|+2,9 pt', 'De 4,33 à 468 €|' + E('3 000') + '|3,0 %|2,0 %|+1 pt']);
});

test('chapitre interne : alerte de baisse, puis notre marge, puis la comparaison — aucune rotation du groupement', () => {
  const { ctx } = monde({ tauxFam: NAT });
  const h = ctx.fdrInterne({ pid: 'F1', decrochage: '<div class="alerte">BAISSE</div>', listing: '<div>ROTATIONS</div>' });
  const a = h.indexOf('BAISSE'), b = h.indexOf('Notre marge par tranche'), c = h.indexOf('COMPARAISON');
  assert.ok(a > 0 && b > a && c > b, 'ordre : baisse, marge, comparaison');
  assert.ok(!h.includes('ROTATIONS'));
  assert.ok(!/c\.listing|[Rr]otations/.test(corps('fdrPage')), 'les rotations reviennent dans la page');
});

test('6 boutons visibles dans les deux vues ; Informations, Notes et Brief dans des <dialog>', () => {
  const { ctx } = monde();
  const h = ctx.fdrOutils({ pid: 'F1', voitVentes: true, kvHtml: '<div>CIP</div>', fe: { panneau: '' }, infos: '', notes: '<div class="v2-notes-box"></div>', briefOff: '<p>brief</p>' });
  const groupe = h.slice(0, h.indexOf('<dialog'));
  const noms = [...groupe.matchAll(/<button[^>]*>(?:<span[^>]*>)?([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(noms, ['Informations', 'Notes et rendez-vous', 'Brief du jour', 'Choisir quoi lui transmettre', 'Ouvrir la liste de tâches', 'Catalogue pour son logiciel']);
  assert.ok(!/vi-int|vi-ph/.test(groupe), 'la rangée de boutons doit rester visible dans les deux vues');
  assert.deepEqual([...h.matchAll(/<dialog class="fdr-dlg" id="(fdr-d-[a-z]+)" aria-labelledby="\1-t">/g)].map((m) => m[1]), ['fdr-d-infos', 'fdr-d-notes', 'fdr-d-brief']);
  assert.match(h, /id="fdr-modif"[^>]*aria-controls="fdr-edit"/); assert.match(h, /id="fdr-edit" hidden/);
  // sans notes ni brief (droits, prospect), leurs boutons ET leurs fenêtres disparaissent ensemble
  const h2 = ctx.fdrOutils({ pid: 'F1', voitVentes: true, kvHtml: '', fe: { panneau: '' }, infos: '', notes: '', briefOff: '' });
  assert.ok(!/Notes et rendez-vous|Brief du jour|fdr-d-notes|fdr-d-brief/.test(h2));
  assert.match(corps('fdrPage'), /fdrActions\([^)]*\) \+ fdrOutils\(c\)/, 'les boutons suivent les actions rondes, dans la carte d\'identité');
});

test('V2.fdrOuvrir : ouvre la fenêtre et place le curseur dans la note ; sur un prospect (pas de fenêtre), repli sur la note de la page', () => {
  const { ctx, appels, dialogs } = monde();
  let modal = 0, focus = 0;
  dialogs['fdr-d-notes'] = { open: false, showModal() { modal++; this.open = true; }, querySelector: () => ({ focus: () => focus++ }) };
  ctx.V2.fdrOuvrir('notes');
  assert.equal(modal, 1); assert.equal(focus, 1); assert.deepEqual(appels, []);
  ctx.V2.fdrOuvrir('notes');
  assert.equal(modal, 1, 'une fenêtre déjà ouverte ne se rouvre pas');
  delete dialogs['fdr-d-notes'];
  ctx.V2.fdrOuvrir('notes');
  assert.deepEqual(appels, ['noter']);
  ctx.V2.fdrOuvrir('brief');
  assert.deepEqual(appels, ['noter'], 'une autre fenêtre absente ne déclenche rien');
  assert.match(corps('fdrProspect'), /V2\.fdrOuvrir\(\\'notes\\'\)/, 'le rond « Note » d\'un prospect passe par fdrOuvrir');
});

test('feuille : couleurs de l\'accueil (aucun ton chaud), mises en page payées le 21/11, rien qui fige Safari', () => {
  const i = css.indexOf('Fiche officine — version « Le rendez-vous »');
  assert.ok(i > 0);
  const f = css.slice(i);
  const chauds = f.match(/#(FFE9C2|FFEBC9|F7E4C4|FFF7E3|FFEBC6|FFE0AE|FFE3B5)/gi);
  assert.equal(chauds, null, 'ton chaud dans la fiche : ' + chauds);
  assert.match(f, /\.fdr-on \.fdr-astre\{[^}]*#FFFFFF 0,#F0F5FF 52%,#D5E2FF 100%\);border:1px solid #BDD0F8/, 'astre blanc-bleu de l\'accueil');
  assert.match(f, /\.fdr-on \.fdo-a::before\{[^}]*background:#B7C9EF/, 'ligne d\'horizon');
  const d = f.slice(f.indexOf('Fiche officine « Le dossier »'));
  assert.ok(d.length > 1000, 'bloc « Le dossier » introuvable');
  assert.match(d, /@media \(min-width:641px\)\{\s*\.fdr-on \.fdr-id:has\(> \.fdr-outils\)\{flex-wrap:wrap\}/, 'les boutons passent à la ligne au-dessus de 640 px seulement');
  assert.match(d, /\.fdr-int2\{grid-template-columns:minmax\(0,1fr\)\}/, 'sans minmax la page s\'élargit au téléphone');
  assert.match(d, /\.fdr-on \.fdo-side > \*\{flex-shrink:0\}/, 'la colonne collante ne tasse pas ses cartes');
  const sans = d.replace(/\/\*[\s\S]*?\*\//g, '');
  const interdits = ['opa' + 'city\\s*:', 'backdrop' + '-filter', 'filter\\s*:\\s*bl' + 'ur', 'background-clip\\s*:\\s*te' + 'xt'];
  for (const x of interdits) assert.ok(!new RegExp(x).test(sans), 'propriété interdite dans « Le dossier » : ' + x);
});

test('générateur : livraison.moy.tauxFam porte exactement les tranches que lit la page', () => {
  const py = lire('generate_marge_clients.py');
  const fams = py.match(/FAMS_MOY = \(([^)]*)\)/)[1].split(',').map((x) => x.trim().replace(/'/g, ''));
  const tr = JSON.parse(js.match(/var FDR_TR = (\[\[.*?\]\]);/)[1].replace(/'/g, '"')).map((t) => t[0]);
  assert.deepEqual(tr, fams);
  assert.match(py, /'tauxFam': \{FAMS_MOY\[f\]:/); assert.match(py, /'tauxTot':/);
  assert.match(py, /tn = taux_national\(d\)\n\s+if tn:\n\s+moy\.update\(tn\)/, 'le taux national doit entrer dans livraison.moy');
});
