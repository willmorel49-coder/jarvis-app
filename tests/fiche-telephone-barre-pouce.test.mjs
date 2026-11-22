// 22/11/2026 — fiche officine au téléphone, maquette v2 « Le fil et la barre du pouce » (choix de Will).
// Ce que ce test garde : la feuille du téléphone chargée en DERNIER et tout sous 640 px (la fiche à 1 280 px ne bouge pas),
// la tendance = 3 derniers mois face aux 3 d'avant (jamais « l'an dernier » : une seule année de ventes), et pas de
// « Sous la moyenne de nos clients » au premier écran (S.fam est notre marge par famille, pas ses achats).
// Données FICTIVES uniquement (dépôt public).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = f => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const src = lire('v2-pharma.js'), css = lire('v2-fiche-tel.css'), html = lire('index.html'), sw = lire('sw.js');

test('téléphone : v2-fiche-tel.css est la dernière feuille de la page et le service worker la garde', () => {
  const feuilles = [...html.split('</head>')[0].matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]).filter(h => !/^https?:/.test(h));
  assert.equal(feuilles[feuilles.length - 1], 'v2-fiche-tel.css', 'ordre : ' + feuilles.slice(-3).join(' → '));
  const vHab = (html.match(/v2-hab\.css\?v=([0-9a-z]+)/) || [])[1], vTel = (html.match(/v2-fiche-tel\.css\?v=([0-9a-z]+)/) || [])[1];
  assert.ok(vTel && vTel === vHab, 'même jeton ?v= que les autres feuilles');
  assert.match(sw, /'v2-hab\.css', 'v2-fiche-tel\.css'/);
});

test('téléphone : hors des feuilles Prix / Envoyer, tout le CSS ajouté vit sous 640 px', () => {
  const sansCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = sansCom.indexOf('@media (max-width:640px){');
  assert.ok(i > 0, 'bloc 640 px présent');
  // chaque bloc 640 px est retiré (accolades équilibrées) ; ce qui reste est le CSS « hors téléphone »
  let reste = sansCom, j;
  while ((j = reste.indexOf('@media (max-width:640px){')) >= 0) {
    let p = 0, fin = -1;
    for (let k = j; k < reste.length; k++) { if (reste[k] === '{') p++; else if (reste[k] === '}') { p--; if (!p) { fin = k; break; } } }
    assert.ok(fin > j, 'bloc 640 px refermé');
    reste = reste.slice(0, j) + reste.slice(fin + 1);
  }
  const dehors = reste.match(/[^{}]+(?=\{)/g).map(s => s.trim());
  for (const sel of dehors) assert.match(sel, /^(\.rv2-bandes,\.rv2-outils,\.rv2-barre|\.rv2-l[si][\w\s>:-]*|\.rv2-li-[it][\w\s]*|\.rv2-li > svg:last-child)$/, 'règle hors 640 px : ' + sel);
  assert.match(sansCom.slice(0, i), /\.rv2-bandes,\.rv2-outils,\.rv2-barre\{display:none\}/, 'au-dessus de 640 px, le HTML ajouté est caché');
  assert.doesNotMatch(css, /banc-pastille/, 'la pastille du banc de test ne part pas en ligne');
  assert.match(css, /env\(safe-area-inset-bottom\)/, 'la barre tient compte du bas de l\'iPhone');
});

test('téléphone : le sommaire numéroté collant est retiré sous 640 px, pas au-dessus (Will, 22/11/2026)', () => {
  const sansCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = sansCom.indexOf('@media (max-width:640px){');
  const j = sansCom.indexOf('.pha-wrap.fdr-on .fdr-som{display:none}');
  assert.ok(i > 0 && j > i, 'la règle qui cache le sommaire est dans le bloc 640 px');
  assert.doesNotMatch(sansCom.slice(0, i), /fdr-som/, 'à l\'ordinateur, le sommaire n\'est pas touché');
  assert.match(src, /V2\.fdrAller = function \(n\) \{[\s\S]{0,200}som \? som\.offsetHeight : 0/, 'les liens « Détail » se calent même sans sommaire visible');
});

test('téléphone : chaque nouveau nom V2.rv2… n est défini qu une fois', () => {
  for (const n of ['rv2Feuille', 'rv2Va']) assert.equal((src.match(new RegExp('V2\\.' + n + '\\s*=', 'g')) || []).length, 1, n);
  for (const n of ['rv2Tendance', 'rv2Courbe', 'rv2NePlus', 'rv2Bandes', 'rv2Barre', 'fbPose', 'nePlusParCat', 'fdrOutilsBoutons'])
    assert.equal((src.match(new RegExp('function ' + n + '\\s*\\(', 'g')) || []).length, 1, n);
});

test('téléphone : pas de « Sous la moyenne de nos clients » au premier écran', () => {
  assert.doesNotMatch(src, /rv2SousMoyenne|class="rv2-sm/);
});

// la vraie fonction, extraite du fichier, sur des mois fictifs
function charge(nom) {
  const m = src.match(new RegExp('function ' + nom + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n'));
  assert.ok(m, nom + ' introuvable');
  return m[0];
}
const pctOf = (src.match(/function pctOf\(a, b\) \{[^\n]*\}/) || [])[0];
const rv2Tendance = new Function(pctOf + '\n' + charge('rv2Tendance') + '\nreturn rv2Tendance;')();
const mois = cas => cas.map((ca, i) => ({ ca, mk: i, year: 2099 }));

test('tendance : somme des 3 derniers mois, écart face aux 3 mois d avant', () => {
  const A = { pts: mois([0, 0, 100, 100, 100, 100, 200, 300, 400]), i0: 2, last: 1 };
  const T = rv2Tendance(A);
  assert.equal(T.tot, 900);
  assert.equal(T.evo, 200);   // 900 face à 300 → +200 %
  assert.equal(T.de.mk, 6); assert.equal(T.a.mk, 8);
});

test('tendance : pas d écart tant qu il n y a pas 6 mois depuis la première commande', () => {
  const A = { pts: mois([0, 0, 0, 0, 512.34, 100, 100, 100]), i0: 4, last: 1 };
  const T = rv2Tendance(A);
  assert.equal(T.tot, 300);
  assert.equal(T.evo, null);
  assert.equal(rv2Tendance({ pts: [], i0: 0, last: null }), null);
});

// 22/11/2026 — Will, sur son iPhone : au téléphone, la fiche doit s'OUVRIR en vue Intégral (« c'est le plus important »).
const viCode = (() => { const a = src.indexOf("  var VI_CLE = 'jarvis.fiche.vue';"), b = src.indexOf('  function viW('); return src.slice(a, b); })();
function appareil(largeur, depart) {
  const mem = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
  const window = { localStorage: mem(depart), sessionStorage: mem(), matchMedia: q => ({ matches: /max-width:640px/.test(q) && largeur <= 640 }) };
  const api = new Function('window', viCode + '\nreturn { arrivee: viArrivee, lire: viLire, choisir: function (v) { viCourante = v; window.localStorage.setItem(VI_CLE, v); } };')(window);
  return { window, ...api };
}
test('téléphone : chaque fiche s ouvre en vue Intégral, même si le pharmacien était la dernière vue', () => {
  assert.ok(viCode.includes('function viArrivee(pid)'), 'viArrivee extraite du code');
  assert.match(src, /var vue = menu \? L1\.vue : viArrivee\(pid\);/, 'la fiche passe bien par viArrivee');
  const t = appareil(390, { 'jarvis.fiche.vue': 'pharmacien' });
  assert.equal(t.arrivee('2000251'), 'integral', 'arrivée sur une fiche : Intégral');
  t.choisir('pharmacien');
  assert.equal(t.arrivee('2000251'), 'pharmacien', 'même fiche redessinée : la vue montrée au pharmacien est gardée');
  assert.equal(t.arrivee('2000299'), 'integral', 'autre officine : retour à Intégral');
});
test('téléphone : un rechargement de Safari sur la même fiche garde la vue pharmacien', () => {
  const t = appareil(390, {});
  assert.equal(t.arrivee('2000251'), 'integral');
  t.choisir('pharmacien');
  // rechargement : nouvelle page, même mémoire de l'onglet (sessionStorage) et de l'appareil (localStorage)
  const ls = Object.fromEntries(t.window.localStorage.m), ss = t.window.sessionStorage.m;
  const r = appareil(390, ls); for (const [k, v] of ss) r.window.sessionStorage.setItem(k, v);
  assert.equal(r.arrivee('2000251'), 'pharmacien');
});
test('ordinateur : rien ne change, vue pharmacien par défaut et dernier choix retenu', () => {
  assert.equal(appareil(1280, {}).arrivee('2000251'), 'pharmacien');
  assert.equal(appareil(1280, { 'jarvis.fiche.vue': 'integral' }).arrivee('2000251'), 'integral');
});

// 22/11/2026 soir — « fais le meilleur UI UX sur tel » : les cinq gestes de la barre s'ouvrent dans la MÊME feuille du bas
// (Noter et À faire étaient une fenêtre presque plein écran et une carte au milieu), et chaque feuille se ferme en la glissant vers le bas.
const glisseCode = (() => { const a = src.indexOf('  function rv2Glisse('), b = src.indexOf('\n  }\n', a); return src.slice(a, b + 4); })();
function feuille(largeur) {
  const ec = {}, style = {};
  const p = { style, addEventListener: (t, f) => { ec[t] = f; }, getBoundingClientRect: () => ({ top: 400 }) };
  const window = { matchMedia: q => ({ matches: /max-width:640px/.test(q) && largeur <= 640 }) };
  let fermee = 0, horloge = 0;
  const Date = { now: () => horloge };
  const setTimeout = (f) => f();   // la fermeture attend la fin du glissé : immédiate ici
  const rv2Glisse = new Function('window', 'Date', 'setTimeout', glisseCode + '\nreturn rv2Glisse;')(window, Date, setTimeout);
  const geste = (depuis, dy, ms, cible) => {
    const t = cible || { closest: s => (s === '.fbs-h' ? {} : null) };
    horloge = 0; ec.touchstart({ touches: [{ clientY: depuis }], target: t });
    if (ec.touchmove) { horloge = ms; ec.touchmove({ touches: [{ clientY: depuis + dy }] }); }
    ec.touchend && ec.touchend();
  };
  return { p, ec, style, poser: () => new Function('rv2Glisse', 'p', 'setTimeout', 'f', 'rv2Glisse(p, ".fbs-h", f);')(rv2Glisse, p, setTimeout, () => fermee++), geste, fermees: () => fermee };
}
test('téléphone : glisser une feuille vers le bas la ferme ; un petit geste lent la laisse revenir', () => {
  assert.ok(glisseCode.startsWith('  function rv2Glisse(p, zone, fermer)') && glisseCode.trim().endsWith('}'), 'rv2Glisse extraite du code');
  const f = feuille(390); f.poser();
  f.geste(420, 40, 400);
  assert.equal(f.fermees(), 0, 'petit geste lent : la feuille reste');
  assert.equal(f.style.transform, '', 'et revient à sa place');
  f.geste(420, 140, 300);
  assert.equal(f.fermees(), 1, 'au-delà de 90 px : fermée');
  assert.equal(f.style.transform + f.style.animation, '', 'remise en état pour la prochaine ouverture (la fenêtre Noter est réutilisée)');
  f.geste(420, 50, 40);
  assert.equal(f.fermees(), 2, 'geste vif : fermée');
  f.geste(420, 200, 300, { closest: s => (/button/.test(s) ? {} : null) });
  assert.equal(f.fermees(), 2, 'un geste parti d\'un bouton ne ferme rien');
  f.geste(700, 200, 300, { closest: () => null });
  assert.equal(f.fermees(), 2, 'un geste dans le contenu le fait défiler, il ne ferme pas la feuille');
  const o = feuille(1280); o.poser();
  assert.equal(Object.keys(o.ec).length, 0, 'à l\'ordinateur : aucun geste posé');
});
test('téléphone : Prix, Envoyer, Noter et À faire branchent le même geste ; Noter s ouvre par son haut', () => {
  assert.match(src, /p\.focus\(\); rv2Glisse\(p, '\.fbs-h', function \(\) \{ fbFerme\(\); \}\);/, 'feuilles Prix / Envoyer');
  assert.match(src, /d\.scrollTop = 0;[^\n]*\n\s*rv2Glisse\(d, '\.fdr-dlg-h', function \(\) \{ d\.close\(\); \}\);/, 'Noter : ouvert par son haut, glissé pour fermer');
  assert.match(src, /tp\.classList\.add\('rv2-feuille'\); rv2Glisse\(tp\.querySelector\('\.v2-todo-pop'\), '\.v2-todo-pop-h'/, 'À faire depuis la fiche');
  const tel = css.slice(css.indexOf('fais le meilleur UI UX sur tel'));
  for (const sel of ['.pha-wrap.fdr-on .fdr-dlg{', '.v2-todo-ov.rv2-feuille .v2-todo-pop{'])
    assert.match(tel, new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^}]*border-radius:26px 26px 0 0'), 'même feuille du bas : ' + sel);
  assert.match(tel, /\.fdr-dlg-x\{flex:none;[^}]*width:44px;height:44px/, 'la croix de Noter ne s\'écrase plus (44 px)');
  assert.match(tel, /\.v2-todo-pop-h span\{[^}]*white-space:normal/, 'le nom de l\'officine n\'est plus coupé');
  assert.match(tel, /\.pha-notes > \.v2-notes-box\[data-st\]\{order:-1\}/, 'Noter : la note rapide en premier (pas la préparation, qui porte aussi v2-notes-box)');
  assert.doesNotMatch(tel, /backdrop-filter|filter:\s*blur/, 'aucun flou (Safari)');
});
