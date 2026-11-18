/* « Tournées » : « Quelle tournée travailler en premier ? » : classement des tournées de livraison en tableau (libellés gris, valeurs en encre,
   « × N la moyenne » sous le chiffre), quatre cartes à grand chiffre, la réponse à la question (carte « À travailler en premier »), puis une
   tournée ouverte (#tournees-detail) : carte d'identité, « La tournée mois par mois » (colonnes sans axes), « Répartition par famille », « Où part la
   rentabilité », « Commandes par mois × marge par commande » (nuage de points, une couleur), « Sur la route », « Les clientes de la tournée » (tableau → fiche).
   Données : window.DONNEES_V5.tournees (fictives, dites à l'écran) + DONNEES.officines pour les clientes (répartition fictive par indice). Tout interne.
   Les totaux vivent dans la phrase du bandeau et les cartes du haut, le tableau ne porte que les valeurs par ligne. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, S = J.S, X = J.X, D = J.D, OFF = J.OFF;
var TD = X && X.tournees; if (!TD) return;
var E = S.tournees = S.tournees || { tri: 'ca', q: '', code: '' }; if (E.tri === 'rang') E.tri = 'ca';
var L = TD.liste, FAM = TD.familles, MOIS = D.mois, N = MOIS.length, MOYC = J.MOY;
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
function total(t) { return t.caParMois.reduce(function (a, b) { return a + b; }, 0); }
function evoDernier(cm) { var a = cm[cm.length - 1], b = cm[cm.length - 2]; return b ? Math.round((a - b) / b * 100) : 0; }
function margeMois(t) { return t.margeParCommande * t.commandesParMois; }
function margeKm(t) { return t.km ? margeMois(t) / t.km : 0; }
function partProspects(t) { return (t.clientes + t.prospects) ? t.prospects / (t.clientes + t.prospects) * 100 : 0; }
function somme(f) { return L.reduce(function (s, t) { return s + f(t); }, 0); }
var CA_TOT = somme(total), CMD_TOT = somme(function (t) { return t.commandesParMois; }), KM_TOT = somme(function (t) { return t.km; }), CL_TOT = somme(function (t) { return t.clientes; }), PR_TOT = somme(function (t) { return t.prospects; });
var SOMME_MOIS = MOIS.map(function (_, i) { return L.reduce(function (s, t) { return s + t.caParMois[i]; }, 0); });
var MOY = { ca: CA_TOT / L.length, marge: CMD_TOT ? somme(function (t) { return t.margeParCommande * t.commandesParMois; }) / CMD_TOT : 0, cmd: CMD_TOT / L.length, km: KM_TOT / L.length };
function mediane(arr) { var a = arr.slice().sort(function (x, y) { return x - y; }), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
var MED = { cmd: mediane(L.map(function (t) { return t.commandesParMois; })), marge: mediane(L.map(function (t) { return t.margeParCommande; })) };
/* le rang affiché découle d'une mesure visible et nommée : le chiffre d'affaires (le champ « rang » des données, 1 → 9 dans l'ordre des codes, ne découle d'aucun chiffre : il n'est pas montré) */
var PAR_RANG = L.slice().sort(function (a, b) { return total(b) - total(a); });
function rangCa(t) { return PAR_RANG.indexOf(t) + 1; }
var RECO = L.slice().sort(function (a, b) { return partProspects(b) - partProspects(a) || a.km - b.km; })[0];
function parCode(c) { for (var i = 0; i < L.length; i++) if (L[i].code === c) return L[i]; return null; }
/* lecture du nuage : où se place la tournée face aux médianes des 9. La réponse à « laquelle travailler en premier ? » est la carte « Notre lecture » (part de prospects) :
   un seul mot pour une seule tournée sur tout l'écran, donc le quadrant bas-gauche dit « Fragile », jamais « à travailler ». */
function quadrant(t) {
  var c = t.commandesParMois >= MED.cmd, m = t.margeParCommande >= MED.marge;
  return c && m ? ['check', 'var(--e-bien)', 'À protéger', 'Beaucoup de commandes et une bonne marge par commande : la tournée à protéger'] :
    c ? ['bell', 'var(--e-attention)', 'À renégocier', 'Beaucoup de commandes, peu de marge par commande : des conditions à revoir'] :
    m ? ['haut', 'var(--e-bien)', 'À développer', 'Peu de commandes mais une bonne marge par commande : chaque commande de plus compte'] :
    ['bas', 'var(--e-alerte)', 'Fragile', 'Peu de commandes et peu de marge par commande : une tournée fragile, à reconstruire'];
}
/* répartition FICTIVE par famille (les données n'en ont pas) : déterministe à partir du code, somme 100 */
function familles(t) {
  var g = parseInt(String(t.code).replace(/\D/g, ''), 10) || 7, w = FAM.map(function (_, i) { return 8 + ((g * (i + 3) * 7 + i * 11) % 23); }), s = w.reduce(function (a, b) { return a + b; }, 0), acc = 0;
  return FAM.map(function (nom, i) { var p = i === FAM.length - 1 ? 100 - acc : Math.round(w[i] / s * 100); acc += p; return { nom: nom, part: p }; }).sort(function (a, b) { return b.part - a.part; });
}
/* clientes du relevé rattachées à la tournée par la GÉOGRAPHIE, jamais par l'indice seul : d'abord la ville qui commence par un mot du nom de la tournée (« Aix – Salon » →
   Aix-en-Provence, Salon-de-Provence), puis le département de ces villes (première tournée du département dans l'ordre de la liste), puis les départements voisins du
   secteur sans tournée (Gard et Hérault → la tournée d'Arles, Drôme → celle d'Avignon). Les clientes plus lointaines (Isère, Savoie) ne sont rattachées à aucune
   tournée : la carte les compte déjà hors des départements du secteur. Répartition de démonstration (les données n'ont pas ce lien), dite à l'écran ; fiche réelle à l'ouverture. */
var VOISINS = { '30': 'Arles', '34': 'Arles', '26': 'Avignon' };
function motsDe(t) { return String(t.nom).split(/\s[–-]\s/).map(function (m) { return m.split(/\s+/)[0]; }).filter(function (m) { return m.length > 2; }); }
function rattache() {
  var cl = OFF.filter(function (o) { return o.statut !== 'prospect'; }), par = {}, dept = {}, reste = [], encore = [];
  L.forEach(function (t) { par[t.code] = []; });
  cl.forEach(function (o) { var v = String(o.ville || ''), d = String(o.cp || '').slice(0, 2), t = L.filter(function (x) { return motsDe(x).some(function (m) { return v.indexOf(m) === 0; }); })[0];
    if (!t) { reste.push(o); return; } par[t.code].push(o); dept[d] = dept[d] || []; if (dept[d].indexOf(t) < 0) dept[d].push(t); });
  reste.forEach(function (o) { var d = String(o.cp || '').slice(0, 2), c = dept[d] ? L.filter(function (x) { return dept[d].indexOf(x) >= 0; }) : VOISINS[d] ? L.filter(function (x) { return motsDe(x).indexOf(VOISINS[d]) >= 0; }) : [];
    if (c.length) par[c[0].code].push(o); else encore.push(o); });
  return par;
}
var CLIENTES = rattache();
function clientesDe(t) { return (CLIENTES[t.code] || []).slice().sort(function (a, b) { return b.ca - a.ca; }); }
function depot(t) { var A = X.appro && X.appro.etablissements; if (!A || !A.length) return ''; var sud = A.filter(function (e) { return ['MSP', 'SEP', 'SOP'].indexOf(e.code) >= 0; }); if (!sud.length) sud = A; var e = sud[L.indexOf(t) % sud.length]; return e.nom + ' (' + e.code + ')'; }
function avisVp() { return '<p class="vp tn-vp">Cet outil est réservé à l’équipe Intégral : rien n’y est montré au pharmacien. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>'; }
function codeAv(t) { return '<span class="tn-av" aria-hidden="true">' + esc(t.code) + '</span>'; }
/* flèche d'évolution d'une carte : le SVG vit dans un .ico (la seule règle du socle qui lui donne une taille et fill:none) ; nu, WebKit le réduit à 0 px et la flèche disparaît */
function evoCarte(e, txt) { return '<span class="evo"><b><span class="ico">' + J.icoSvg(e < 0 ? 'bas' : 'haut', e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span>' + J.signe(e) + '</b>' + esc(txt || 'oct. sur sept.') + '</span>'; }
/* ---------- le classement (TABLEAU) ---------- */
var TRIS = { ca: ['Chiffre d’affaires', function (a, b) { return total(b) - total(a); }], marge: ['Marge par commande', function (a, b) { return b.margeParCommande - a.margeParCommande; }], cmd: ['Commandes par mois', function (a, b) { return b.commandesParMois - a.commandesParMois; }], km: ['Kilomètres', function (a, b) { return a.km - b.km; }], potentiel: ['Part de prospects', function (a, b) { return partProspects(b) - partProspects(a); }] };
function ligne(t, rang, i) {
  var ca = total(t), q = quadrant(t);
  return '<tr class="tn-l" data-tournee="' + esc(t.code) + '" tabindex="0" role="link" aria-label="Ouvrir la tournée ' + esc(t.nom) + '" style="--i:' + i + '">' +
    '<td class="num tn-rang" data-l="Rang"><b>' + rang + '</b></td>' +
    '<td data-l="Tournée"><div class="tn-id">' + codeAv(t) + '<div class="tn-txt"><b class="tn-nom">' + esc(t.nom) + '</b><span class="tn-meta"><span class="etat">' + J.ico(q[0], q[1]) + q[2] + '</span><span>' + nf.format(t.clientes) + ' clientes · ' + nf.format(t.prospects) + ' prospects</span></span></div></div></td>' +
    '<td class="num" data-l="Chiffre d’affaires"><b>' + eur(ca) + '</b>' + J.fois(ca, MOY.ca) + '</td>' +
    '<td data-l="10 mois"><div class="tn-dix">' + J.spark(t.caParMois, 0, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois de la tournée' }) + J.evoHtml(evoDernier(t.caParMois)) + '</div></td>' +
    '<td class="num" data-l="Marge par commande"><b>' + J.eur2(t.margeParCommande) + '</b>' + J.fois(t.margeParCommande, MOY.marge) + '</td>' +
    '<td class="num" data-l="Commandes par mois"><b>' + nf.format(t.commandesParMois) + '</b>' + J.fois(t.commandesParMois, MOY.cmd) + '</td>' +
    '<td class="num tn-kmc" data-l="Kilomètres par passage"><b>' + nf.format(t.km) + '</b>' + J.fois(t.km, MOY.km) + '</td>' +
    '<td class="tn-chev">' + J.ico('chev') + '</td></tr>';
}
function tableau() {
  var q = E.q.trim().toLowerCase(), tri = TRIS[E.tri] || TRIS.ca, ordre = L.slice().sort(tri[1]);
  /* le rang = la place dans le tri choisi, sur les 9 (une recherche ne renumérote pas) */
  var rows = ordre.filter(function (t) { return !q || (t.code + ' ' + t.nom + ' ' + depot(t)).toLowerCase().indexOf(q) >= 0; }).map(function (t, i) { return ligne(t, ordre.indexOf(t) + 1, i); }).join('');
  return '<section class="carte tn-tab" aria-label="Classement des tournées"><div class="tete"><div><h2>Le classement des tournées</h2><p class="st">classées par ' + tri[0].toLowerCase() + ' · « × N la moyenne » compare à la tournée moyenne (les cartes du haut, divisées par le nombre de tournées) · un clic ouvre la tournée</p></div></div>' +
    '<table class="tabl"><thead><tr><th class="num">Rang<span class="st">dans le tri choisi</span></th><th>Tournée<span class="st">lecture · clientes · prospects</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num">Marge par commande<span class="st">notre marge, estimation</span></th><th class="num">Commandes<span class="st">par mois, un mois type</span></th><th class="num">Kilomètres<span class="st">par passage</span></th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="8" class="tn-vide">Aucune tournée ne répond à « ' + esc(E.q) + ' ».</td></tr>') + '</tbody></table></section>';
}
/* ---------- la réponse : « À travailler en premier » (part de prospects par tournée, la retenue en couleur, les autres en gris) ---------- */
/* barres horizontales (part de prospects ici, marge au kilomètre dans le détail) : au téléphone (< 520 px) l'étiquette a SA ligne au-dessus de la barre ; sinon elle est bornée
   à la place réellement disponible (≈ 6,6 px par caractère à 13 px) ; le texte est toujours dessiné APRÈS les barres, avec un liseré blanc : une barre ne peut plus le recouvrir */
function barresH(w, items, o) {
  var tel = w < 520, lab = tel ? 0 : Math.min(190, Math.round(w * .34)), x0 = tel ? 0 : lab + 10, vw = o.vw || 60, iw = Math.max(40, w - x0 - vw), rh = tel ? 48 : 34, h = items.length * rh + (tel ? 4 : 8);
  var max = Math.max.apply(null, items.map(function (it) { return it.val; }).concat([1e-9])), maxCar = tel ? 99 : Math.max(8, Math.floor((lab - 6) / 6.6));
  var s = '<svg class="tn-barres" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.aria) + '">';
  items.forEach(function (it, i) { var y = (tel ? 2 : 4) + i * rh, yb = tel ? y + 26 : y + 9, yt = tel ? y + 15 : y + 21, bw = Math.max(4, it.val / max * iw), txt = it.code + ' · ' + it.nom;
    if (txt.length > maxCar) txt = txt.slice(0, maxCar - 1) + '…';
    s += '<rect x="' + x0 + '" y="' + yb + '" width="' + iw.toFixed(1) + '" height="12" rx="6" fill="#E8ECF4"/><rect class="tn-bar-x" x="' + x0 + '" y="' + yb + '" width="' + bw.toFixed(1) + '" height="12" rx="6" fill="' + (it.sel ? o.couleur : 'var(--enc-5)') + '" style="transform-origin:' + x0 + 'px 0;animation-delay:' + (i * 40) + 'ms"/>';
    s += '<text x="0" y="' + yt + '" font-size="13" font-weight="' + (it.sel ? 700 : 500) + '" fill="' + (it.sel ? 'var(--enc-1)' : 'var(--enc-2)') + '" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(txt) + '</text>';
    s += '<text x="' + (x0 + iw + 10) + '" y="' + (tel ? yb + 11 : yt) + '" font-size="13" font-weight="700" fill="var(--enc-1)">' + it.txt + '</text>'; });
  return s + '</svg>';
}
function barresPotentiel(w) {
  var tri = L.slice().sort(function (a, b) { return partProspects(b) - partProspects(a); });
  return barresH(w, tri.map(function (t) { var p = partProspects(t); return { code: t.code, nom: t.nom, val: p, sel: t === RECO, txt: nf.format(Math.round(p)) + ' %' }; }), { couleur: 'var(--c-ca)', vw: 60, aria: 'Part de prospects dans chaque tournée' });
}
function carteReco() {
  var rapport = RECO.clientes ? RECO.prospects / RECO.clientes : 0, kmMin = Math.min.apply(null, L.map(function (t) { return t.km; }));
  /* la parenthèse et « la route la plus courte » se lisent dans les chiffres, jamais en dur : deux prospects pour une cliente à 1,95-2,05, « plus de deux » au-delà, « près de deux » de 1,8 à 1,95 */
  var paren = rapport >= 2.05 ? ' (plus de deux prospects pour une cliente)' : rapport >= 1.95 ? ' (deux prospects pour une cliente)' : rapport >= 1.8 ? ' (près de deux prospects pour une cliente)' : '';
  return '<section class="carte tn-reco" aria-label="À travailler en premier"><div class="tn-reco-txt"><p class="eyebrow">Notre lecture</p><h2>À travailler en premier : ' + esc(RECO.nom) + '</h2>' +
    '<p class="note">Tournée ' + esc(RECO.code) + ' : c’est là que les prospects pèsent le plus face aux clientes' + paren + (RECO.km === kmMin ? ', pour la route la plus courte' : '') + '. Chaque ouverture de compte y pèse davantage que partout ailleurs.</p>' +
    '<div class="tn-reco-act"><button type="button" class="pil plein" data-tournee="' + esc(RECO.code) + '">' + J.ico('route') + 'Ouvrir la tournée</button><a class="pil" href="#carte">' + J.ico('pin') + 'La voir sur la carte</a></div></div>' +
    '<div class="tn-reco-chart"><h3>Part de prospects dans chaque tournée</h3><p class="st">prospects rapportés à l’ensemble des officines de la tournée · la retenue en couleur</p><div class="tn-chart" id="tn-pot"></div></div></section>';
}
/* ---------- l'écran principal ---------- */
function lier(el) {
  $$('[data-tournee]', el).forEach(function (x) { var go = function () { E.code = x.getAttribute('data-tournee'); J.aller('tournees-detail'); }; x.addEventListener('click', go); if (x.tagName === 'TR') x.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  J.poseIcones(el);
}
function principal(el) {
  var evo = evoDernier(SOMME_MOIS), pers = X.personne || {};
  /* le secteur vit dans la phrase, pas dans le sur-titre (qui passait sur deux lignes à 1280 et poussait le titre) */
  var lede = '<span data-interne><b>Quelle tournée travailler en premier ?</b> Les <b>' + L.length + ' tournées</b> de livraison de ' + esc(pers.secteur || 'votre secteur') + ', leurs <b>' + nf.format(CL_TOT) + ' clientes</b> et <b>' + nf.format(PR_TOT) + ' prospects</b>, de janvier à octobre 2026. Un clic ouvre la tournée.</span><span class="vp">Outil réservé à l’équipe Intégral.</span>';
  el.innerHTML = '<div class="page">' + J.bandeau({
    croix: true, eyebrow: 'Tournées de livraison', titre: 'Tournées', lede: lede,
    actions: '<button class="pil" type="button" data-interne data-stub="' + STUB('Exporter les tournées en Excel') + '">' + J.ico('down') + 'Exporter en Excel</button><a class="pil" href="#carte" data-interne>' + J.ico('pin') + 'Ma tournée sur la carte</a>',
    recherche: { id: 'tn-q', placeholder: window.innerWidth < 760 ? 'Une tournée, une ville…' : 'Une tournée, une ville, un code, un dépôt…', aria: 'Rechercher une tournée', valeur: E.q },
    bas: '<label class="filtre">Classer par :<select id="tn-tri" aria-label="Classer par">' + Object.keys(TRIS).map(function (k) { return '<option value="' + k + '"' + (E.tri === k ? ' selected' : '') + '>' + TRIS[k][0] + '</option>'; }).join('') + '</select></label>'
  }) + '<div class="tn-corps" data-interne><div class="tn-synth entre">' +
    J.stat({ i: 1, puce: 'var(--c-ca)', lib: 'Chiffre d’affaires des tournées', val: eur(CA_TOT), note: 'cumul janv.–oct. 2026, toutes tournées', spark: J.spark(SOMME_MOIS, 0, 150, 40, 'var(--c-ca)', { aria: 'Chiffre d’affaires des tournées, 10 mois' }), evo: evoCarte(evo) }) +
    J.stat({ i: 2, puce: 'var(--c-cmd)', lib: 'Commandes par mois', val: nf.format(CMD_TOT), note: 'un mois type, toutes tournées' }) +
    J.stat({ i: 3, puce: 'var(--c-nous)', lib: 'Marge par commande', val: J.eur2(MOY.marge), note: 'moyenne pondérée par les commandes · estimation' }) +
    J.stat({ i: 4, puce: 'var(--enc-3)', lib: 'Route par passage', val: nf.format(KM_TOT), unite: 'kilomètres', note: 'longueur cumulée des circuits de livraison' }) +
    '</div>' + carteReco() + tableau() + '</div>' + avisVp() + '</div>';
  lier(el);
  /* vue pharmacien : les outils du bandeau (actions, recherche, tri) sont internes, comme sur l'écran To do */
  $$('.ban-act,.rech-g,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  J.dessine($('#tn-pot', el), barresPotentiel);
  $('#tn-tri', el).onchange = function (ev) { E.tri = ev.target.value; var box = $('.tn-tab', el); if (box) { box.outerHTML = tableau(); lier($('.tn-tab', el)); } };
  $('#tn-q', el).oninput = function (ev) { E.q = ev.target.value; var box = $('.tn-tab', el); if (box) { box.outerHTML = tableau(); lier($('.tn-tab', el)); } };
}
J.tourneesCommun = { E: E, L: L, FAM: FAM, MOIS: MOIS, N: N, MOY: MOY, MED: MED, MOYC: MOYC, PAR_RANG: PAR_RANG, STUB: STUB, total: total, evoDernier: evoDernier, margeMois: margeMois, margeKm: margeKm, partProspects: partProspects, parCode: parCode, rangCa: rangCa, quadrant: quadrant, familles: familles, clientesDe: clientesDe, depot: depot, avisVp: avisVp, codeAv: codeAv, evoCarte: evoCarte, barresH: barresH, principal: principal };
})();
/* ====================================================================================================================
   UNE TOURNÉE OUVERTE (#tournees-detail) : carte d'identité (nom, chiffre d'affaires en grand, clé-valeur, actions), « La tournée mois par mois »,
   « Répartition par famille » · « Où part la rentabilité », « Commandes par mois × marge par commande » · « Sur la route », « Les clientes de la tournée ».
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, S = J.S, C = J.tourneesCommun; if (!C) return;
var E = C.E, L = C.L, MOIS = C.MOIS, N = C.N, MOY = C.MOY, MED = C.MED, MOYC = C.MOYC, PAR_RANG = C.PAR_RANG, STUB = C.STUB, ml = J.ml;
/* nuage de points : une couleur (--c-cmd), médianes en gris pointillé, la tournée ouverte en avant */
function nuage(t, w) {
  var h = w < 520 ? 250 : 290, Lm = 56, R = 20, T = 22, B = 46, iw = w - Lm - R, ih = h - T - B;
  var maxX = Math.max.apply(null, L.map(function (o) { return o.commandesParMois; })) * 1.14, maxY = Math.max.apply(null, L.map(function (o) { return o.margeParCommande; })) * 1.18;
  var X = function (v) { return Lm + v / maxX * iw; }, Y = function (v) { return T + ih - v / maxY * ih; }, pasY = J.niceStep(maxY), pasX = J.niceStep(maxX);
  var s = '<svg class="courbe tn-nuage" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Commandes par mois et marge par commande des tournées">';
  for (var g = 0; g <= maxY; g += pasY) s += '<line x1="' + Lm + '" x2="' + (w - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="var(--filet)" stroke-width="1"/><text x="' + (Lm - 8) + '" y="' + (Y(g) + 4.5).toFixed(1) + '" font-size="13" text-anchor="end" fill="var(--enc-3)">' + nf.format(g) + ' €</text>';
  for (var x = 0; x <= maxX; x += pasX) s += '<text x="' + X(x).toFixed(1) + '" y="' + (h - 26) + '" font-size="13" text-anchor="middle" fill="var(--enc-3)">' + nf.format(x) + '</text>';
  s += '<text x="' + (w - R) + '" y="' + (h - 4) + '" font-size="13" text-anchor="end" fill="var(--enc-2)" font-weight="600">commandes par mois →</text><text x="' + Lm + '" y="' + (T - 9) + '" font-size="13" fill="var(--enc-2)" font-weight="600">↑ marge par commande</text>';
  s += '<line x1="' + X(MED.cmd).toFixed(1) + '" x2="' + X(MED.cmd).toFixed(1) + '" y1="' + T + '" y2="' + (T + ih) + '" stroke="var(--c-moyenne)" stroke-width="1.4" stroke-dasharray="5 4"/><line x1="' + Lm + '" x2="' + (w - R) + '" y1="' + Y(MED.marge).toFixed(1) + '" y2="' + Y(MED.marge).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.4" stroke-dasharray="5 4"/>';
  var sx = X(t.commandesParMois), sy = Y(t.margeParCommande);
  /* étiquettes des autres points : à droite quand le point touche la tournée ouverte, sinon au-dessus / au-dessous en alternant le long de l'axe ;
     une étiquette qui rencontrerait un trait de médiane ou un autre point prend la première place libre (au-dessus, au-dessous, à droite, à gauche) */
  var xm = X(MED.cmd), ym = Y(MED.marge), LW = 30, PTS = L.map(function (o) { return { o: o, x: X(o.commandesParMois), y: Y(o.margeParCommande), r: o === t ? 12 : 8 }; });
  var libre = function (p, own) { var x0 = p[2] === 'start' ? p[0] : p[2] === 'end' ? p[0] - LW : p[0] - LW / 2, x1 = x0 + LW, y0 = p[1] - 13, y1 = p[1] + 4;
    if (x0 < 2 || x1 > w - 2 || (xm > x0 - 3 && xm < x1 + 3) || (ym > y0 && ym < y1)) return false;
    return !PTS.some(function (q) { return q.o !== own && q.x + q.r > x0 && q.x - q.r < x1 && q.y + q.r > y0 && q.y - q.r < y1; }); };
  L.filter(function (o) { return o !== t; }).sort(function (a, b) { return a.commandesParMois - b.commandesParMois; }).forEach(function (o, i) { var cx = X(o.commandesParMois), cy = Y(o.margeParCommande), pres = Math.hypot(cx - sx, cy - sy) < 34, haut = i % 2 === 0,
      cand = pres ? [[cx + 12, cy + 4.5, 'start']] : (haut ? [[cx, cy - 11, 'middle'], [cx, cy + 20, 'middle']] : [[cx, cy + 20, 'middle'], [cx, cy - 11, 'middle']]).concat([[cx + 12, cy + 4.5, 'start'], [cx - 12, cy + 4.5, 'end']]),
      pos = cand.filter(function (p) { return libre(p, o); })[0] || cand[0];
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="6" fill="#fff" stroke="var(--c-cmd)" stroke-width="2"/><text x="' + pos[0].toFixed(1) + '" y="' + pos[1].toFixed(1) + '" font-size="13" text-anchor="' + pos[2] + '" fill="var(--enc-3)" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(o.code) + '</text>'; });
  s += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="17" fill="var(--c-cmd-voile)"/><circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="9" fill="var(--c-cmd)" stroke="#fff" stroke-width="3"/>';
  /* au téléphone, le code seul (le nom est dans la carte d'identité) ; l'étiquette passe SOUS le point quand un voisin proche est au-dessus (son étiquette, posée à droite, occuperait la même ligne) */
  var voisinHaut = L.some(function (o) { return o !== t && Math.hypot(X(o.commandesParMois) - sx, Y(o.margeParCommande) - sy) < 40 && Y(o.margeParCommande) <= sy + 4; }), dessous = voisinHaut && sy + 36 < T + ih;
  s += '<text x="' + sx.toFixed(1) + '" y="' + (dessous ? sy + 36 : sy - 22).toFixed(1) + '" font-size="13" font-weight="800" text-anchor="middle" fill="var(--enc-1)" stroke="#fff" stroke-width="4" paint-order="stroke">' + esc(t.code) + (w < 520 ? '' : ' · ' + esc(t.nom)) + '</text>';
  return s + '</svg>';
}
/* marge par kilomètre : toutes les tournées côte à côte, celle ouverte en couleur (--c-nous), les autres en gris */
function barresKm(t, w) {
  var tri = L.slice().sort(function (a, b) { return C.margeKm(b) - C.margeKm(a); });
  return C.barresH(w, tri.map(function (o) { var v = C.margeKm(o); return { code: o.code, nom: o.nom, val: v, sel: o === t, txt: nf1.format(v) + ' €' }; }), { couleur: 'var(--c-nous)', vw: 64, aria: 'Marge par kilomètre de chaque tournée' });
}
/* sur la route : dépôt → un arrêt par cliente du relevé → dépôt */
function route(cl, w) {
  var h = 96, x0 = 26, x1 = w - 26, y = 40, n = cl.length, s = '<svg class="tn-route" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Schéma de la tournée : dépôt, arrêts, retour au dépôt">';
  s += '<path class="trace" pathLength="1" d="M' + x0 + ' ' + y + 'H' + x1 + '" fill="none" stroke="var(--c-ca)" stroke-width="3" stroke-linecap="round"/>';
  [x0, x1].forEach(function (x) { s += '<rect x="' + (x - 11) + '" y="' + (y - 11) + '" width="22" height="22" rx="7" fill="#fff" stroke="var(--enc-2)" stroke-width="2"/><text x="' + x + '" y="' + (y + 32) + '" font-size="13" text-anchor="middle" fill="var(--enc-3)">dépôt</text>'; });
  cl.forEach(function (o, i) { var x = x0 + (i + 1) * (x1 - x0) / (n + 1), nom = J.joli(o.nom).replace(/^Pharmacie (de la |du |des |de l’|de |d’)?/i, ''); if (nom.length > 16) nom = nom.slice(0, 15) + '…';
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="7" fill="#fff" stroke="var(--c-ca)" stroke-width="2.5"/>' + (n <= 6 ? '<text x="' + x.toFixed(1) + '" y="' + (i % 2 ? y + 32 : y - 20) + '" font-size="13" text-anchor="middle" fill="var(--enc-2)">' + esc(nom) + '</text>' : ''); });
  return s + '</svg>';
}
function detail(el) {
  var t = C.parCode(E.code) || PAR_RANG[0]; E.code = t.code;
  var idx = PAR_RANG.indexOf(t), cm = t.caParMois, ca = C.total(t), best = cm.indexOf(Math.max.apply(null, cm)), evo = C.evoDernier(cm), q = C.quadrant(t), fam = C.familles(t), cl = C.clientesDe(t), dep = C.depot(t);
  var mm = C.margeMois(t), mk = C.margeKm(t), rangKm = L.slice().sort(function (a, b) { return C.margeKm(b) - C.margeKm(a); }).indexOf(t) + 1;
  /* vue pharmacien : seul le bouton Retour reste ; flèches et menu des tournées sont internes */
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Tournées</button><div class="tn-outils-i" data-interne><div class="tn-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Tournée précédente">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Tournée suivante">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre tn-autre">' + J.ico('search') + '<select id="tn-autre" aria-label="Autre tournée"><option value="">Autre tournée…</option>' + PAR_RANG.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.code) + ' · ' + esc(x.nom) + '</option>'; }).join('') + '</select></label></div>';
  var actions = '<div class="ronds"><a class="rond-act" href="#carte"><span class="rond"><span class="ico">' + J.icoSvg('pin') + '</span></span>Carte</a>' + J.rond('down', 'Excel', STUB('Exporter la tournée en Excel')) + J.rond('share', 'Partager', STUB('Partager la tournée')) + '</div>' +
    '<button class="pil plein" type="button" data-stub="' + STUB('Préparer la tournée') + '">' + J.ico('route') + 'Préparer la tournée</button><a class="pil contour" href="#tournees-detail" data-ancre="tn-clientes">' + J.ico('pharma') + 'Voir ses clientes</a>';
  var ident = J.identite({ classe: 'tn-ident', nom: esc(t.nom), meta: '<span class="etat">' + J.ico(q[0], q[1]) + q[2] + '</span><span>' + esc(t.code) + ' · ' + J.ordre(C.rangCa(t)) + ' sur ' + L.length + ' au chiffre d’affaires</span>',
    mois: { lib: 'Chiffre d’affaires · janv.–oct. 2026', val: eur(ca), evo: J.evoHtml(evo, 'oct. sur sept.') },
    lignes: [['Code', esc(t.code)], ['Clientes', nf.format(t.clientes)], ['Prospects', nf.format(t.prospects)], ['Marge par commande', J.eur2(t.margeParCommande) + ' ' + J.fois(t.margeParCommande, MOY.marge)], ['Commandes par mois', nf.format(t.commandesParMois) + ' ' + J.fois(t.commandesParMois, MOY.cmd)], ['Dépôt de départ', dep ? esc(dep) : '']], actions: actions });
  var moisCarte = '<section class="carte tn-mois-c" aria-label="La tournée mois par mois"><div class="tete"><div><h2>Record en ' + esc(ml(MOIS[best])) + ' : ' + eur(cm[best]) + '</h2><p class="st">La tournée mois par mois · chiffre d’affaires livré, janvier à octobre 2026 · touchez une colonne pour la lire · le cumul est dans la carte d’identité</p></div></div>' +
    '<div class="chart-box tn-chart" id="tn-mois"></div><p class="lecteur" id="tn-mois-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg"><span><i class="puce" style="background:var(--c-ca)"></i>Mois record</span><span><i class="puce" style="background:#C9D3E6"></i>Les autres mois</span></div>' +
    '<details class="tabm"><summary>Voir le tableau</summary><table class="tabl"><thead><tr><th>Mois</th><th class="num">Chiffre d’affaires</th><th class="num">Évolution sur un mois</th></tr></thead><tbody>' + cm.map(function (v, i) { var p = i ? cm[i - 1] : 0; return '<tr><td>' + esc(ml(MOIS[i])) + '</td><td class="num">' + eur(v) + '</td><td class="num">' + (i && p ? J.signe((v - p) / p * 100) : '—') + '</td></tr>'; }).join('') + '<tr class="cumul"><td>Cumul janv.–oct. 2026</td><td class="num">' + eur(ca) + '</td><td></td></tr></tbody></table></details></section>';
  var famCarte = '<section class="carte" aria-label="Répartition par famille"><div class="tete"><div><h2>Répartition par famille</h2><p class="st">part de chaque famille de produits dans le chiffre d’affaires de la tournée · répartition fictive (démonstration)</p></div></div><div class="tn-cbs">' +
    fam.map(function (f) { return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:var(--c-ca)"></span><b>' + esc(f.nom) + '</b></span><span class="cb-v num">' + eur(ca * f.part / 100) + '</span></div><div class="cb-pist"><i class="cb-b" style="width:' + f.part + '%;background:var(--c-ca)"></i></div><div class="cb-p"><span>part du chiffre d’affaires</span><b class="num">' + f.part + ' %</b></div></div>'; }).join('') + '</div></section>';
  var rentaCarte = '<section class="carte" aria-label="Où part la rentabilité"><div class="tete"><div><h2>' + (rangKm <= 3 ? 'Une des routes qui rapportent le plus au kilomètre' : rangKm >= L.length - 2 ? 'Une route qui rapporte peu au kilomètre' : 'Une route dans la moyenne au kilomètre') + '</h2><p class="st">Où part la rentabilité · marge mensuelle = marge par commande × commandes par mois (estimation), rapportée à la cliente et au kilomètre · toutes les tournées côte à côte</p></div></div>' +
    '<div class="tn-trio"><div><span class="co-l">Marge par mois</span><div class="tn-grand num">' + eur(mm) + '</div></div><div><span class="co-l">Par cliente et par mois</span><div class="tn-grand num">' + eur(t.clientes ? mm / t.clientes : 0) + '</div></div><div><span class="co-l">Au kilomètre</span><div class="tn-grand num">' + J.ordre(rangKm) + '</div><span class="co-l">rang des tournées</span></div></div>' +
    '<h3>Marge par kilomètre parcouru</h3><div class="tn-chart tn-chart-b" id="tn-km"></div></section>';
  var nuageCarte = '<section class="carte" aria-label="Commandes par mois × marge par commande"><div class="tete"><div><h2>' + q[3] + '</h2><p class="st">Commandes par mois × marge par commande · chaque point est une tournée, celle-ci en avant · les traits pointillés sont les médianes · plus un point est haut et à droite, plus la tournée rapporte</p></div></div><div class="chart-box tn-chart" id="tn-nuage"></div>' +
    '<div class="leg"><span><i class="puce" style="background:var(--c-cmd)"></i>Une tournée</span><span><i class="trait"></i>Médiane des tournées</span></div></section>';
  var routeCarte = '<section class="carte" aria-label="Sur la route"><div class="tete"><div><h2>Sur la route</h2><p class="st">un passage de livraison · départ et retour au dépôt · une cliente du relevé = un arrêt · l’ordre réel des arrêts se règle dans La carte</p></div></div>' +
    '<div class="tn-km"><b class="num">' + nf.format(t.km) + '</b><span>kilomètres par passage ' + J.fois(t.km, MOY.km) + '</span></div><div class="tn-chart tn-chart-r" id="tn-route"></div><a class="pil" href="#carte">' + J.ico('pin') + 'Ouvrir la carte</a></section>';
  var clCarte = '<section class="carte tn-tab tn-cl" id="tn-clientes" aria-label="Les clientes de la tournée"><div class="tete"><div><h2>Les clientes de la tournée</h2><p class="st">' + cl.length + ' cliente' + (cl.length > 1 ? 's' : '') + ' du relevé rattachée' + (cl.length > 1 ? 's' : '') + ' à cette tournée par leur ville (répartition de démonstration) · classées par chiffre d’affaires janv.–oct. 2026 · un clic ouvre la fiche</p></div></div>' +
    '<table class="tabl"><thead><tr><th>Officine<span class="st">ville</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th></th></tr></thead><tbody>' +
    cl.map(function (o, i) { return '<tr class="tn-l" data-officine="' + o.id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(J.joli(o.nom)) + '" style="--i:' + i + '"><td data-l="Officine"><div class="tn-id"><span class="tn-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><div class="tn-txt"><b class="tn-nom">' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + o.cp + '</span></div></div></td><td class="num" data-l="Chiffre d’affaires"><b>' + eur(o.ca) + '</b>' + J.fois(o.ca, MOYC.caMois * N) + '</td><td data-l="10 mois"><div class="tn-dix">' + J.spark(o.caParMois, MOYC.caMois, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois' }) + J.evoHtml(C.evoDernier(o.caParMois)) + '</div></td><td class="tn-chev">' + J.ico('chev') + '</td></tr>'; }).join('') + '</tbody></table></section>';
  el.innerHTML = '<div class="page">' + J.bandeau({ classe: 'tn-ban-det', deborde: true, eyebrow: '<span data-interne>Tournée de livraison ' + esc(t.code) + ' · ventes à jour au 31 octobre 2026</span><span class="vp">Tournées</span>', recherche: '<div class="tn-outils">' + outils + '</div>' }) +
    '<div class="sous-bandeau stack entre" data-interne>' + ident + moisCarte + '<div class="gdeux stack">' + famCarte + rentaCarte + '</div><div class="gdeux stack">' + nuageCarte + routeCarte + '</div>' + clCarte + '</div>' + C.avisVp() + '</div>';
  J.poseIcones(el);
  J.dessine($('#tn-mois', el), function (w) { return J.colonnes({ vals: cm, labels: MOIS, couleur: 'var(--c-ca)', sel: [best], h: w < 520 ? 180 : 220, aria: 'Chiffre d’affaires de la tournée par mois' }, w); }, function (box) { J.lie(box, cm.map(function (v, i) { return '<b>' + esc(ml(MOIS[i])) + ' 2026</b> : ' + eur(v) + (i ? ', ' + J.signe((v - cm[i - 1]) / cm[i - 1] * 100) + ' sur ' + esc(ml(MOIS[i - 1])) : ''); }), $('#tn-mois-lect', el)); });
  J.dessine($('#tn-km', el), function (w) { return barresKm(t, w); });
  J.dessine($('#tn-nuage', el), function (w) { return nuage(t, w); });
  J.dessine($('#tn-route', el), function (w) { return route(cl, w); });
  $$('tr[data-officine]', el).forEach(function (tr) { var go = function () { J.ouvrirFiche(tr.getAttribute('data-officine')); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var n = idx + (+b.getAttribute('data-pn')); if (n < 0) n = PAR_RANG.length - 1; if (n >= PAR_RANG.length) n = 0; E.code = PAR_RANG[n].code; J.route(); window.scrollTo(0, 0); }; });
  $('#tn-autre', el).onchange = function (ev) { if (ev.target.value) { E.code = ev.target.value; J.route(); window.scrollTo(0, 0); } };
  $$('[data-ancre]', el).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); var c = $('#' + a.getAttribute('data-ancre'), el); if (c) { var y = c.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } }; });
}
J.ecrans.tournees = { rendre: function (el, etat) { if (etat.suite === 'detail') detail(el); else C.principal(el); } };
})();
