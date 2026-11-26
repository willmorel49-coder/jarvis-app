// 26/11/2026 — planche « JARVIS au téléphone : 11 choix », sujet 3 « Fiche officine », version 1 « Cinq chapitres, cinq lignes » (choix de Will).
// Au téléphone, chaque chapitre de la fiche CLIENTE devient une ligne (numéro, titre, chiffre clé, chevron), repliée à l'arrivée ;
// un toucher l'ouvre sur son contenu d'avant. Les fiches de prospect ne sont pas repliées (formulaire, notes et actions restent sous les yeux).
// Ce test lance le VRAI code de v2-pharma.js (officine et montants fictifs) et garde :
//  1. à l'ordinateur, le HTML des chapitres est celui d'avant, au caractère près ;
//  2. au téléphone, cinq lignes repliées, le contenu de chaque chapitre inchangé derrière, les chiffres clés repris de ce que la fiche écrit déjà ;
//  3. rien ne se perd : « Détail » et le lien « Ce qu'elle ne commande plus » ouvrent d'abord le chapitre visé ; un nouveau dessin garde les lignes ouvertes ;
//  4. tout le style ajouté vit sous 640 px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, sousTelephone } from './aide-css-telephone.mjs';

const src = lire('v2-pharma.js');
const fn = (nom) => { const i = src.indexOf('  function ' + nom + '('); assert.ok(i > 0, nom + ' introuvable'); return src.slice(i, src.indexOf('\n  }\n', i) + 5); };
function tranche(debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i); assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j + fin.length);
}
const CH = (() => { const m = src.match(/var FDR_CH = \[\[.*?\]\];/); assert.ok(m, 'FDR_CH introuvable'); return m[0]; })();
const SOM = (() => { const m = src.match(/var FDR_SOM = \[.*?\];/); assert.ok(m, 'FDR_SOM introuvable'); return m[0]; })();
const ETAT_ET_GESTES = tranche('  var fdrPliEtat = { pid: null, o: {} };', "    D.nePlus.fdrPli = true;\n  }\n");
const ALLER = tranche('  V2.fdrAller = function (n) {', '\n  };\n');

// Une fausse page : les sections des chapitres, avec leurs classes et le bouton de leur ligne.
function page(lignes = [1, 2, 3, 4, 5], repliables = true) {
  const sec = {};
  for (const n of lignes) {
    const classes = new Set(['fdr-ch', 'fdr-rv'].concat(repliables ? ['fdr-pli'] : []));
    const bouton = { attrs: { 'aria-expanded': 'false' }, setAttribute(k, v) { this.attrs[k] = v; } };
    sec[n] = {
      id: 'fdr-c' + n, bouton, classes,
      classList: { contains: (c) => classes.has(c), toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); } },
      querySelector: (s) => (s === '.fdr-pli-b' && repliables ? bouton : null),
      getBoundingClientRect: () => ({ top: 400 })
    };
  }
  const doc = { blocNp: null, getElementById: (id) => { const m = /^fdr-c(\d)$/.exec(id); return m ? sec[m[1]] || null : null; }, querySelector: (s) => (s === '.fdr-pli .pha-np' ? doc.blocNp : null) };
  return { sec, doc };
}

// La fiche (fdrChapitre, fdrPage, fdrProspect, fdrPliCles, état et gestes), les fonctions voisines remplacées par des repères.
function fiche({ tel = false, doc = page().doc, np = { n: 48, total: 1824, top: [] }, decro = null } = {}) {
  const b = (nom) => (...a) => '[' + nom + ':' + a.map((x) => (x && typeof x === 'object' ? 'obj' : String(x))).join(',') + ']';
  const noms = ['viBouton', 'fdrActions', 'fdrOutils', 'phaNavHtml', 'fdoCoord', 'fdrListings', 'rv2Bandes', 'fdrOutilsBoutons', 'rv2Barre', 'fdrMontants', 'fdrOffilog', 'fdrCourbe', 'm5Replie', 'analyseParts', 'fdrInterne', 'fdrRond', 'fbIc'];
  const defile = [];
  const V2 = { fmtEur: (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €', fmtNum: (n) => String(n), notes: {}, decrochageUI: decro };
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const code = CH + SOM + fn('fdrChapitre') + fn('fdrPage') + fn('fdrProspect') + fn('fdrPliCles') + ETAT_ET_GESTES + ALLER +
    '; return { fdrPage: fdrPage, fdrProspect: fdrProspect, fdrChapitre: fdrChapitre, fdrPliCles: fdrPliCles, fdrPliLiens: fdrPliLiens, etat: function () { return fdrPliEtat; } };';
  const f = new Function('V2', 'esc', 'isEscale', 'telEcran', 'rv2NePlus', 'cl1MoisK', 'document', 'window', 'phaTelHaut', ...noms, code)(
    V2, (s) => String(s).replace(/</g, '&lt;'), () => false, () => tel, () => np, (k) => MOIS[k % 12] + ' ' + Math.floor(k / 12), doc,
    { scrollY: 100, scrollTo: (o) => defile.push(o.top), matchMedia: () => ({ matches: true }) }, () => 0, ...noms.map(b));
  return { ...f, V2, defile };
}
const C = (x = {}) => ({ pid: 'F1', pidSafe: 'F1', pharma: { code: 1234567 }, nom: 'PHARMACIE FICTIVE', badges: '', comms: 'alice', loc: '00000 VILLE', grp: 'Groupe fictif', titulaire: 'M. Test',
  tel: '0102030405', mail: 'a@b.fr', voitVentes: true, A: { last: { mk: 2026 * 12 + 9, ca: 12095 } }, nbRefs: 598,
  nePlus: '<div class="pha-np">NP</div>', tranches: '<div>TR</div>', top5: 'T5', generiqueurs: '<div>GEN</div>', reserve: '<p>RESERVE</p>', ...x });
const sections = (h) => [...h.matchAll(/<section class="([^"]*)" id="fdr-c(\d)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => ({ cls: m[1], n: +m[2], h: m[3] }));
const contenu = (s) => s.h.slice(s.h.indexOf('<div class="fdr-ch-c"')).replace(/^<div class="fdr-ch-c"[^>]*>/, '');

test('ordinateur : un chapitre s\'écrit comme avant, au caractère près', () => {
  const m = fiche({ tel: false });
  assert.equal(m.fdrChapitre(5, '<p>X</p>', 'Phrase', 'vi-int fdr-int'),
    '<section class="fdr-ch fdr-rv vi-int fdr-int" id="fdr-c5" aria-labelledby="fdr-h5"><header class="fdr-ch-h"><span class="fdr-num" aria-hidden="true">5</span>' +
    '<div class="fdr-ch-t"><h2 id="fdr-h5">Côté Intégral</h2><p class="fdr-ch-s">Phrase</p></div></header><div class="fdr-ch-c"><p>X</p></div></section>');
  const h = m.fdrPage(C());
  assert.ok(!/fdr-pli|fdr-plis|fdr-ouvert|V2\.fdrPli/.test(h), 'aucune ligne repliable à l\'ordinateur');
  assert.match(h, /^<div class="fdr fdr-d fdo-g"><aside class="fdo-side">/);
  assert.deepEqual(sections(h).map((s) => s.cls), ['fdr-ch fdr-rv', 'fdr-ch fdr-rv', 'fdr-ch fdr-rv', 'fdr-ch fdr-rv', 'fdr-ch fdr-rv vi-int fdr-int']);
});

test('téléphone : cinq lignes repliées, dans l\'ordre, et le contenu de chaque chapitre inchangé derrière', () => {
  const ordi = sections(fiche({ tel: false }).fdrPage(C())), tel = sections(fiche({ tel: true }).fdrPage(C()));
  assert.deepEqual(tel.map((s) => s.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(tel.map((s) => s.cls), ['fdr-ch fdr-rv fdr-pli', 'fdr-ch fdr-rv fdr-pli', 'fdr-ch fdr-rv fdr-pli', 'fdr-ch fdr-rv fdr-pli', 'fdr-ch fdr-rv fdr-pli vi-int fdr-int'],
    'repliées à l\'arrivée (pas de fdr-ouvert) ; le chapitre interne reste réservé à la vue Intégral');
  tel.forEach((s, i) => {
    assert.equal(contenu(s), contenu(ordi[i]), 'contenu du chapitre ' + s.n + ' identique à celui de l\'ordinateur');
    assert.match(s.h, new RegExp('<button type="button" class="fdr-pli-b" aria-expanded="false" aria-controls="fdr-cc' + s.n + '" aria-labelledby="fdr-h' + s.n + '[^"]*" onclick="V2\\.fdrPli\\(' + s.n + '\\)"></button></header><div class="fdr-ch-c" id="fdr-cc' + s.n + '">'));
    assert.match(s.h, /<span class="fdr-pli-fl" aria-hidden="true">\[fbIc:lien,20\]<\/span>/, 'le chevron de la ligne');
  });
  assert.match(fiche({ tel: true }).fdrPage(C()), /^<div class="fdr fdr-d fdo-g fdr-plis"><aside class="fdo-side">/);
});

test('téléphone : les titres sont ceux de la planche, la phrase du chapitre interne reste (lue une fois la ligne ouverte)', () => {
  const tel = sections(fiche({ tel: true }).fdrPage(C()));
  assert.deepEqual(tel.map((s) => (s.h.match(/<h2 id="fdr-h\d">([^<]*)<\/h2>/) || [])[1]),
    ['Chiffres', 'Produits qui ne sont plus commandés', 'Par catégorie et tranche de prix', 'Génériqueurs et biosimilaires', 'Côté Intégral']);
  assert.match(tel[4].h, /<p class="fdr-ch-s">Ce que le pharmacien ne voit pas/);
});

test('chiffres clés : 1 = le chiffre d\'affaires du dernier mois reçu, 2 = le total « Ne commande plus » ; 3, 4 et 5 sans chiffre', () => {
  const tel = sections(fiche({ tel: true }).fdrPage(C()));
  assert.match(tel[0].h, /<p class="fdr-pli-s" id="fdr-ps1">en octobre 2026<\/p><\/div><span class="fdr-pli-v cl1-num" id="fdr-pv1">12 095 €<\/span>/);
  assert.match(tel[1].h, /<p class="fdr-pli-s" id="fdr-ps2">48 produits<\/p><\/div><span class="fdr-pli-v cl1-num" id="fdr-pv2">1 824 €<small> par mois<\/small><\/span>/);
  assert.match(tel[0].h, /aria-labelledby="fdr-h1 fdr-ps1 fdr-pv1"/, 'le bouton se lit « Chiffres, en octobre 2026, 12 095 € »');
  for (const s of tel.slice(2)) assert.ok(!/fdr-pli-v|fdr-pli-s/.test(s.h), 'chapitre ' + s.n + ' : pas de chiffre clé (à choisir avec Will)');
  // les mêmes sources que la fiche : fdrMontants (A.last) et le bandeau « Ne commande plus » (rv2NePlus) ; jamais un nouveau calcul
  const cles = fn('fdrPliCles');
  assert.match(cles, /V2\.fmtEur\(A\.last\.ca\)/); assert.match(cles, /rv2NePlus\(c\.pid\)/);
  assert.ok(!/[-*\/]\s*\d|\d\s*[-*\/]|\.reduce\(|Math\./.test(cles.replace(/\/\/.*$/gm, '')), 'aucune opération sur les montants dans fdrPliCles');
});

test('chiffres clés : donnée absente = ligne sans chiffre, jamais un zéro inventé', () => {
  const sans = (x, np) => sections(fiche({ tel: true, np }).fdrPage(C(x)));
  assert.ok(!/fdr-pli-v/.test(sans({ A: { last: null } }, { n: 3, total: 10, top: [] })[0].h), 'pas de dernier mois : pas de chiffre au chapitre 1');
  assert.ok(!/fdr-pli-v|fdr-pli-s/.test(sans({}, null)[1].h), '« ne commande plus » pas calculable : rien');
  assert.ok(!/fdr-pli-v|fdr-pli-s/.test(sans({}, { n: 0, total: 0, top: [] })[1].h), 'aucun produit abandonné : rien');
  assert.match(sans({}, { n: 1, total: 12.4, top: [] })[1].h, /id="fdr-ps2">1 produit<\/p>/, 'singulier');
});

test('V2.fdrPli : un toucher ouvre, un second referme ; le bouton dit son état ; sans ligne repliable, rien', () => {
  const p = page(), m = fiche({ tel: true, doc: p.doc });
  assert.equal(m.V2.fdrPli(3), true);
  assert.ok(p.sec[3].classes.has('fdr-ouvert')); assert.equal(p.sec[3].bouton.attrs['aria-expanded'], 'true');
  assert.ok(!p.sec[2].classes.has('fdr-ouvert'), 'les autres lignes ne bougent pas');
  m.V2.fdrPli(3);
  assert.ok(!p.sec[3].classes.has('fdr-ouvert')); assert.equal(p.sec[3].bouton.attrs['aria-expanded'], 'false');
  m.V2.fdrPli(3, true); m.V2.fdrPli(3, true);
  assert.ok(p.sec[3].classes.has('fdr-ouvert'), 'ouvrir deux fois de suite ne referme pas');
  // ordinateur ou fiche de prospect : les chapitres n'ont pas la classe, le geste ne fait rien
  const o = page([1, 2, 3], false), mo = fiche({ doc: o.doc });
  assert.equal(mo.V2.fdrPli(2), false); assert.ok(!o.sec[2].classes.has('fdr-ouvert'));
  assert.equal(mo.V2.fdrPli(9), false, 'chapitre absent');
});

test('un nouveau dessin de la même fiche garde les lignes ouvertes ; une autre officine arrive repliée', () => {
  const p = page(), m = fiche({ tel: true, doc: p.doc });
  m.fdrPage(C());
  m.V2.fdrPli(2);   // l'utilisateur ouvre le chapitre 2, puis touche une famille de produits : la fiche se redessine
  const encore = sections(m.fdrPage(C()));
  assert.deepEqual(encore.map((s) => /fdr-ouvert/.test(s.cls)), [false, true, false, false, false]);
  assert.match(encore[1].h, /aria-expanded="true"/);
  const autre = sections(m.fdrPage(C({ pid: 'F2' })));
  assert.ok(autre.every((s) => !/fdr-ouvert/.test(s.cls)), 'autre officine : tout est replié');
  assert.equal(m.etat().pid, 'F2');
});

test('« Détail » des bandeaux (V2.fdrAller) : le chapitre visé s\'ouvre, puis la page y défile', () => {
  const p = page(), m = fiche({ tel: true, doc: p.doc });
  m.V2.fdrAller(2);
  assert.ok(p.sec[2].classes.has('fdr-ouvert'));
  assert.deepEqual(m.defile, [400 + 100 - 12], 'défilement jusqu\'au chapitre (12 px sous le haut)');
  // ordinateur : même défilement, rien ne s'ouvre (il n'y a rien à ouvrir)
  const o = page([1, 2], false), mo = fiche({ doc: o.doc });
  mo.V2.fdrAller(2);
  assert.deepEqual(mo.defile, [488]); assert.ok(!o.sec[2].classes.has('fdr-ouvert'));
});

test('lien « Ce qu\'elle ne commande plus » du bandeau « À rappeler » : le chapitre qui porte le bloc s\'ouvre avant le défilement', () => {
  const p = page(), appels = [];
  const decro = { nePlus: function () { appels.push(p.sec[2].classes.has('fdr-ouvert')); return 'fait'; } };
  const m = fiche({ tel: true, doc: p.doc, decro });
  p.doc.blocNp = { closest: (s) => (s === '.fdr-pli' ? p.sec[2] : null) };
  m.fdrPliLiens(); m.fdrPliLiens();   // posé une seule fois, même après plusieurs dessins
  assert.equal(decro.nePlus(), 'fait');
  assert.deepEqual(appels, [true], 'la fonction d\'origine est appelée une fois, chapitre déjà ouvert');
  // sans bloc dans une ligne repliable (ordinateur) : la fonction d'origine, sans rien d'autre
  p.sec[2].classes.delete('fdr-ouvert'); p.doc.blocNp = null;
  decro.nePlus();
  assert.deepEqual(appels, [true, false]);
  assert.match(src, /if \(root\.querySelector\('\.fdr-pli'\)\) fdrPliLiens\(\);/, 'branché depuis fdrInit, seulement si la fiche a des lignes repliables');
});

test('fiches de prospect : laissées telles quelles (chapitres ouverts, même au téléphone)', () => {
  const P = { eye: 'PROSPECT', nom: 'PHARMACIE P', tel: '', mail: '', sous: ['00000 VILLE'], ch: [['Coordonnées et informations', 'Coordonnées', '<div>FORMULAIRE</div>', 'Tout est enregistré.'], ['Actions', 'Actions', '<div>ACTIONS</div>']] };
  const tel = fiche({ tel: true }).fdrProspect(P);
  assert.equal(tel, fiche({ tel: false }).fdrProspect(P), 'le même HTML au téléphone et à l\'ordinateur');
  assert.ok(!/fdr-pli/.test(tel));
  assert.match(fn('fdrProspect'), /fdrChapitre\(i \+ 1, c\[2\], c\[3\] \|\| '', '', c\[0\]\)/, 'fdrProspect n\'envoie pas de pli');
});

test('fiche d\'un collègue (chiffres réservés) : pas de chapitres, donc rien à replier', () => {
  const h = fiche({ tel: true }).fdrPage(C({ voitVentes: false }));
  assert.ok(!/fdr-pli/.test(h)); assert.match(h, /RESERVE/);
});

test('noms : chaque geste est défini une fois ; la condition est celle du téléphone', () => {
  for (const n of ['fdrPli', 'fdrAller']) assert.equal((src.match(new RegExp('V2\\.' + n + '\\s*=', 'g')) || []).length, 1, 'V2.' + n);
  for (const n of ['fdrPliCles', 'fdrPliLiens', 'telEcran']) assert.equal((src.match(new RegExp('function ' + n + '\\s*\\(', 'g')) || []).length, 1, n);
  assert.match(fn('fdrPage'), /var pli = telEcran\(\) \? fdrPliCles\(c\) : null;/);
});

test('style : les lignes vivent sous 640 px, sans effet interdit ; repliée = contenu non affiché ; la ligne fait 60 px', () => {
  const css = lire('v2-fiche-tel.css');
  const tout = regles(css), rs = tout.filter((r) => /fdr-pli/.test(r.sel));
  assert.ok(rs.length >= 15, 'règles des lignes présentes (' + rs.length + ')');
  for (const r of rs) {
    assert.ok(sousTelephone(r), 'hors téléphone : ' + r.sel);
    assert.doesNotMatch(r.decl, /backdrop-filter|blur\(|(^|;|\s)opacity\s*:|mask/, 'effet interdit : ' + r.sel);
  }
  assert.equal(tout.filter((r) => !sousTelephone(r) && /fdr-pli/.test(r.sel + r.decl)).length, 0, 'l\'ordinateur ne reçoit aucune règle');
  const regle = (sel) => { const r = rs.filter((x) => x.sel.split(',').map((s) => s.trim()).includes(sel)); assert.equal(r.length, 1, sel); return r[0].decl; };
  assert.match(regle('.pha-wrap.fdr-on .fdr .fdr-pli:not(.fdr-ouvert) > .fdr-ch-c'), /display:none/);
  assert.match(regle('.pha-wrap.fdr-on .fdr .fdr-pli > .fdr-ch-h'), /min-height:60px/);
  assert.match(regle('.pha-wrap.fdr-on .fdr .fdr-pli .fdr-pli-b'), /position:absolute;left:0;top:0;width:100%;height:100%/, 'le bouton couvre la ligne entière');
  assert.match(regle('.pha-wrap.fdr-on .fdr-plis .fdo-b'), /order:5/, 'les coordonnées passent après les cinq lignes');
  assert.match(regle('.pha-wrap.fdr-on .fdr-plis .fdr-pli'), /transform:none/, 'l\'arrivée douce (16 px de décalage) ne sépare pas les lignes de la carte');
  // textes : 13 px au moins
  for (const r of rs) for (const m of r.decl.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 13, r.sel + ' : ' + m[1] + ' px');
  // la dernière ligne visible dépend de la vue (le chapitre 5 est réservé à la vue Intégral)
  assert.match(regle('.pha-wrap.fdr-on[data-vue="pharmacien"] .fdr-plis #fdr-c4.fdr-pli'), /--pli-b:20px/);
  assert.match(regle('.pha-wrap.fdr-on[data-vue="integral"] .fdr-plis #fdr-c5.fdr-pli'), /--pli-b:20px/);
});
