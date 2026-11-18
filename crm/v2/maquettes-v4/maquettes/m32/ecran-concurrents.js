/* Concurrents (#concurrents) et la fiche d'un acteur ou d'une source (#concurrents-detail).
   Un titre et une barre à cinq onglets (Carte · Annuaire · Prix · Actualité · Liens, la carte s'ouvre en premier), carte des implantations sur le fond
   local (une couleur par groupe, filtre par groupe, fiche au clic), annuaire (groupes, acteurs, parts de marché), comparateur de prix en tableau (un produit
   par ligne, une colonne par concurrent, le moins cher marqué d'un point), fiches par source avec « Le catalogue X » replié, listings face à un concurrent
   et D2P (gestes), actualité, liens « qui détient qui ». Données : J.X.concurrents, prix fictifs dits à l'écran.
   Tout est interne (data-interne) : « Conditions de tiers : réservé à l'interne ». */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, nf2 = J.nf2, S = J.S, X = J.X && J.X.concurrents;
if (!X || !window.FOND_PACA) return;
var C = S.concurrents = S.concurrents || { onglet: 'carte', groupe: '', q: '', fam: 'toutes', acteur: 'Grossiste 1' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var CONC = ['Grossiste 1', 'Grossiste 2', 'Grossiste 3', 'Grossiste 4', 'Grossiste 5', 'Grossiste 6', 'Plateforme 1'];
/* famille d'un produit : lue dans la fiche (top 10, listes « À proposer ») par son nom, jamais déduite du laboratoire (le comparateur prête Kardegic au Laboratoire 3 ou
   Lamaline au Laboratoire 6) ; un produit absent de la fiche n'est « Générique » que si son nom commence par un génériqueur */
var FAMF = { 'Princeps': 'Princeps remboursables', 'Générique': 'Génériques', 'Biosimilaire': 'Biosimilaires', 'Parapharmacie': 'Non remboursés', 'Conseil': 'Non remboursés', 'Matériel': 'Non remboursés' };
var FAM = {}; (function () { var F = J.D.fiche; F.top10.concat(F.aProposer.groupeAchat.premiers, F.aProposer.reseau.premiers).forEach(function (p) { var k = p.nom.split(',')[0]; if (FAM[k] || !p.famille) return; var c = Object.keys(FAMF).filter(function (x) { return p.famille.indexOf(x) === 0; })[0]; if (c) FAM[k] = FAMF[c]; }); })();
/* un produit classé « Non remboursés » dans le Catalogue produits l'est aussi dans le comparateur (la famille se lit au même endroit partout) */
(J.X.produits && J.X.produits.lignes || []).forEach(function (p) { var k = p.nom.split(',')[0]; if (p.famille === 'nr' && !FAM[k]) FAM[k] = 'Non remboursés'; });
var GENERIQUEURS =/^(Laboratoire (?:3|4|5|6|8|9|10)|Mylan|Cristers|Almus|Zydus)\s/i;
var FAMS = ['Toutes familles', 'Princeps remboursables', 'Non remboursés', 'Génériques', 'Biosimilaires'];
var CIRCUIT = { Grossiste: 'grossiste-répartiteur', Plateforme: 'plateforme en ligne' };
var GRP = {}; X.groupes.forEach(function (g, i) { g.col = 'var(--cat-' + (i + 1) + ')'; g.i = i; g.acteurs.forEach(function (a) { GRP[a] = g; }); });
var groupeDe = function (nom) { return X.groupes.filter(function (g) { return g.nom === nom; })[0]; };
var acteurDe = function (imp) { return imp.nom.split(' · ')[0]; };
var sourceDe = function (a) { return X.sources.filter(function (s) { return s.nom === a; })[0]; };
var fam = function (p) { return FAM[p.produit.split(',')[0]] || (GENERIQUEURS.test(p.produit) ? 'Génériques' : 'Princeps remboursables'); };
var circuit = function (a) { var s = sourceDe(a); return s ? (CIRCUIT[s.tag] || s.tag.toLowerCase()) : ''; };
var prix = function (v) { return nf2.format(v) + ' €'; };
var q = function () { return C.q.trim().toLowerCase(); };
var match = function (txt) { var k = q(); return !k || String(txt).toLowerCase().indexOf(k) >= 0; };
J.ccEtat = C;
/* ---------- la carte : même projection que l'écran Carte (recalculée ici pour ne dépendre que du socle et du fond local) ---------- */
var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PAD = 14;
var MW = (BB.est - BB.ouest) * CM * KM + 2 * PAD;
function MX(lng) { return PAD + (lng - BB.ouest) * CM * KM; }
function MY(lat) { return PAD + (BB.nord - lat) * KM; }
var FOND = '', CENTRES = [];
/* un dépôt se nomme par la grande ville la plus proche (les données ne portent qu'un index technique « dépôt N ») */
function villeDe(p) { var x = MX(p.lng), y = MY(p.lat), best = '', bd = Infinity; (window.VILLES_PACA || []).forEach(function (v) { var d = Math.pow(MX(v.lng) - x, 2) + Math.pow(MY(v.lat) - y, 2); if (d < bd) { bd = d; best = v.nom; } }); return best; }
var lieuDe = function (p) { var v = villeDe(p); return v ? 'dépôt près ' + (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(v) ? 'd’' : 'de ') + v : 'dépôt'; };
window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, mx = 0, my = 0, k = 0;
  polys[0][0].forEach(function (c) { mx += c[0]; my += c[1]; k++; }); CENTRES.push({ nom: f.properties.nom, x: MX(mx / k), y: MY(my / k) });
  FOND += '<path d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '"/>'; });
/* dessin à la largeur réelle w : cadre calé sur les implantations montrées (jamais au-delà du fond), textes à 13 px rendus quels que soient l'échelle */
function carte(w, o) {
  o = o || {}; var pts = X.implantations.filter(function (p) { return o.groupe ? (GRP[acteurDe(p)] || {}).nom === o.groupe : (!o.acteur || acteurDe(p) === o.acteur); }), id = o.id || 'cc';
  var xs = pts.map(function (p) { return MX(p.lng); }), ys = pts.map(function (p) { return MY(p.lat); }), m = 34;
  var x0 = Math.max(0, Math.min.apply(null, xs) - m), x1 = Math.min(MW, Math.max.apply(null, xs) + m), y0 = Math.max(0, Math.min.apply(null, ys) - m), y1 = Math.max.apply(null, ys) + m;
  if (pts.length < 2) { x0 = Math.max(0, xs[0] - 90); x1 = xs[0] + 90; y0 = Math.max(0, ys[0] - 70); y1 = ys[0] + 70; }
  var rt = o.ratio || (w < 760 ? 1 : .68), vw = x1 - x0, vh = y1 - y0;
  if (vh / vw > rt) { var nw = vh / rt, cx = (x0 + x1) / 2; x0 = cx - nw / 2; x1 = cx + nw / 2; vw = nw; } else { var nh = vw * rt, cy = (y0 + y1) / 2; y0 = cy - nh / 2; y1 = cy + nh / 2; vh = nh; }
  /* échelle 1:1 : textes, points et traits sont écrits en pixels d'écran (13 px réels) ; seul le fond est mis à l'échelle dans son groupe */
  var s = w / vw, h = Math.round(w * vh / vw), PX = function (x) { return ((x - x0) * s).toFixed(1); }, PY = function (y) { return ((y - y0) * s).toFixed(1); };
  var svg = '<svg class="cc-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.aria || 'Carte des implantations des grossistes concurrents') + '">' +
    '<defs><radialGradient id="' + id + '-mer" cx="26%" cy="8%" r="100%"><stop offset="0" stop-color="#EFF3F7"/><stop offset="1" stop-color="#D9E1EB"/></radialGradient><linearGradient id="' + id + '-sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFBF7"/><stop offset="1" stop-color="#EEECE4"/></linearGradient></defs>' +
    '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="url(#' + id + '-mer)"/><g transform="translate(' + (-x0 * s).toFixed(2) + ' ' + (-y0 * s).toFixed(2) + ') scale(' + s.toFixed(4) + ')" fill="url(#' + id + '-sol)" stroke="#fff" stroke-width="' + (1.4 / s).toFixed(3) + '" stroke-linejoin="round">' + FOND + '</g>';
  /* les repères écrits (départements, villes) sont émis APRÈS les points des dépôts : ils restent lisibles, jamais recouverts */
  var rep = '';
  if (w >= 560) CENTRES.forEach(function (c) { if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) return; rep += '<text x="' + PX(c.x) + '" y="' + PY(c.y) + '" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1" fill="#5B6478" stroke="#fff" stroke-width="3" paint-order="stroke" pointer-events="none">' + esc(c.nom.toUpperCase()) + '</text>'; });
  window.VILLES_PACA.forEach(function (v) { if (v.rang > (w < 560 ? 1 : 2)) return; var x = MX(v.lng), y = MY(v.lat); if (x < x0 || x > x1 || y < y0 || y > y1) return;
    rep += '<circle cx="' + PX(x) + '" cy="' + PY(y) + '" r="2.2" fill="#5B6478" pointer-events="none"/><text x="' + (+PX(x) + 6).toFixed(1) + '" y="' + (+PY(y) - 5).toFixed(1) + '" font-size="13" font-weight="600" fill="#3B4357" stroke="#fff" stroke-width="3" paint-order="stroke" pointer-events="none">' + esc(v.nom) + '</text>'; });
  pts.forEach(function (p) { var g = GRP[acteurDe(p)] || X.groupes[0], x = PX(MX(p.lng)), y = PY(MY(p.lat)), estompe = (C.groupe && g.nom !== C.groupe && !o.acteur && !o.groupe) || !match(p.nom + ' ' + g.nom + ' ' + villeDe(p));
    svg += '<g class="cc-pt' + (estompe ? ' loin' : '') + '" data-imp="' + X.implantations.indexOf(p) + '" data-acteur="' + esc(acteurDe(p)) + '" tabindex="0" role="button" aria-label="' + esc(acteurDe(p)) + ', ' + esc(lieuDe(p)) + ', ' + esc(g.nom) + '"><circle cx="' + x + '" cy="' + y + '" r="22" fill="transparent"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="11" fill="' + g.col + '" fill-opacity=".13"/><circle class="cc-pp" cx="' + x + '" cy="' + y + '" r="5" fill="' + g.col + '" stroke="#fff" stroke-width="2"/></g>'; });
  return svg + rep + '</svg>';
}
function lierCarte(box) {
  var tip = $('.cc-tip', box.parentNode);
  $$('.cc-pt', box).forEach(function (g) {
    var p = X.implantations[+g.getAttribute('data-imp')], grp = GRP[acteurDe(p)] || X.groupes[0];
    var montre = function () { if (!tip) return; tip.innerHTML = '<b>' + esc(acteurDe(p)) + '</b><span>' + esc(lieuDe(p)) + ' · ' + esc(grp.nom) + ' · ouvrir la fiche</span>'; tip.hidden = false; var r = g.getBoundingClientRect(), b = box.parentNode.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(b.width - tip.offsetWidth - 8, r.left - b.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(8, r.top - b.top - tip.offsetHeight - 8) + 'px'; };
    g.addEventListener('mouseenter', montre); g.addEventListener('focus', montre);
    g.addEventListener('mouseleave', function () { if (tip) tip.hidden = true; });
    var go = function () { C.acteur = acteurDe(p); J.aller('concurrents-detail'); };
    g.addEventListener('click', go); g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
  });
}
J.ccCarte = carte; J.ccLier = lierCarte;
/* ---------- onglet Carte : la carte + « Qui est qui ? » (une couleur par groupe, un clic isole ses dépôts) ---------- */
function ongletCarte() {
  var leg = X.groupes.slice().sort(function (a, b) { return b.part - a.part; }).map(function (g) { var on = C.groupe === g.nom;
    return '<button type="button" class="cc-g' + (on ? ' on' : '') + '" data-grp="' + esc(g.nom) + '" aria-pressed="' + on + '"><span class="puce" style="background:' + g.col + '"></span><span class="cc-gt"><b>' + esc(g.nom) + '</b><span class="sub">' + g.acteurs.map(esc).join(' · ') + ' · ' + esc(g.zone) + '</span><span class="cc-gp"><span class="bar12"><i style="width:' + g.part + '%;background:' + g.col + '"></i></span><b class="num">' + g.part + ' %</b><span class="sub">de part de marché · ' + nf.format(g.depots) + ' dépôts en France</span></span></span></button>'; }).join('');
  return '<div class="cc-deux"><section class="carte cc-cartebox" data-interne aria-label="Carte des implantations"><div class="cc-map" id="cc-map"><div class="cc-dessin" id="cc-dessin"></div><div class="cc-tip" hidden></div></div>' +
    '<p class="note cc-note">Un point par dépôt repéré, à la couleur de son groupe · un clic ouvre la fiche de l’acteur' + (C.groupe ? ' · seuls les dépôts de <b>' + esc(C.groupe) + '</b> sont en couleur' : '') + '.</p></section>' +
    '<section class="carte cc-leg" data-interne aria-label="Qui est qui"><div class="tete"><div><h2>Qui est qui ?</h2><p class="st">les groupes, leurs acteurs et leur part de marché · un clic isole ses dépôts</p></div></div><div class="cc-gs entre">' + leg + '</div>' + (C.groupe ? '<button type="button" class="pil cc-tout" data-grp="">' + J.ico('close') + 'Tous les groupes</button>' : '') + '</section></div>';
}
/* ---------- onglet Annuaire : tableau à filets (groupe, acteurs, part de marché, dépôts) ---------- */
function ongletAnnuaire() {
  var L = X.groupes.slice().sort(function (a, b) { return b.part - a.part; }).filter(function (g) { return match(g.nom + ' ' + g.acteurs.join(' ') + ' ' + g.zone); });
  return '<section class="carte cc-tab" data-interne aria-label="Annuaire des concurrents"><div class="tete"><div><h2>Les groupes et leurs acteurs</h2><p class="st">classés par part de marché · un clic sur un acteur ouvre sa fiche (observations, catalogue, prix face aux nôtres)</p></div></div>' +
    (L.length ? '<table class="tabl"><thead><tr><th>Groupe<span class="st">zone</span></th><th>Acteurs<span class="st">grossistes et plateformes</span></th><th class="num">Part de marché<span class="st">France, estimation</span></th><th class="num">Dépôts<span class="st">en France</span></th></tr></thead><tbody>' +
    L.map(function (g, i) { return '<tr style="--i:' + i + '"><td data-l="Groupe"><button type="button" class="cc-gn cc-gb" data-acteur="' + esc(g.nom) + '" aria-label="Ouvrir la fiche du groupe ' + esc(g.nom) + '"><span class="puce" style="background:' + g.col + '"></span><span><b>' + esc(g.nom) + '</b><span class="sub">' + esc(g.zone) + ' · fiche du groupe</span></span></button></td><td data-l="Acteurs"><span class="cc-acts">' + g.acteurs.map(function (a) { return '<button type="button" class="chip cc-act" data-acteur="' + esc(a) + '">' + esc(a) + (circuit(a) ? '<span class="cc-circ">' + esc(circuit(a)) + '</span>' : '') + J.ico('chev') + '</button>'; }).join('') + '</span></td>' +
      '<td class="num" data-l="Part de marché"><span class="cc-part"><span class="bar12"><i style="width:' + g.part + '%;background:' + g.col + '"></i></span><b>' + g.part + ' %</b></span></td><td class="num" data-l="Dépôts"><b>' + nf.format(g.depots) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<p class="note">Aucun groupe ne correspond à « ' + esc(C.q) + ' ».</p>') +
    '<p class="note">Parts de marché et dépôts : estimations internes · ensemble, ces groupes pèsent ' + X.groupes.reduce(function (s, g) { return s + g.part; }, 0) + ' % du marché, le reste est fait d’indépendants et de petits répartiteurs.</p></section>';
}
J.ccOnglets = { carte: ongletCarte, annuaire: ongletAnnuaire };
J.ccAides = { STUB: STUB, CONC: CONC, FAM: FAM, FAMS: FAMS, GRP: GRP, groupeDe: groupeDe, acteurDe: acteurDe, sourceDe: sourceDe, fam: fam, prix: prix, match: match, lieuDe: lieuDe, circuit: circuit };
})();
/* ====================================================================================================================
   Concurrents (suite) : onglets Prix (le comparateur en tableau + les catalogues relevés + listings face à un concurrent + D2P), Actualité, Liens ;
   l'écran assemblé (bandeau de recherche, une barre à cinq onglets) ; la fiche d'un acteur (#concurrents-detail) : carte d'identité,
   ses prix face aux nôtres, ses dépôts (mini-carte), « Le catalogue X » replié avec les colonnes du catalogue (valeurs fictives).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, nf2 = J.nf2, S = J.S, X = J.X && J.X.concurrents, A = J.ccAides, C = J.ccEtat;
if (!X || !A) return;
var STUB = A.STUB, CONC = A.CONC, ICO_ONG = { carte: 'pin', annuaire: 'group', prix: 'euro', actu: 'infos', liens: 'net' };
var VP_C = '<p class="note vp cc-vp">Concurrents est un outil interne (conditions de tiers) : rien à montrer au pharmacien dans cette vue. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>';
function moinsCher(p) { var m = p.nous; CONC.forEach(function (c) { if (p[c] != null && p[c] < m) m = p[c]; }); return m; }
function ongletPrix() {
  var rows = X.comparateur.slice().sort(function (a, b) { return b.pharmacies - a.pharmacies; }).filter(function (p) { return (C.fam === 'toutes' || A.fam(p) === C.fam) && A.match(p.produit + ' ' + p.labo + ' ' + A.fam(p)); });
  var pills = A.FAMS.map(function (f) { var k = f === 'Toutes familles' ? 'toutes' : f, n = k === 'toutes' ? 1 : X.comparateur.filter(function (p) { return A.fam(p) === f; }).length;
    return n ? '<button type="button" class="chip' + (C.fam === k ? ' on' : '') + '" data-fam="' + esc(k) + '" aria-pressed="' + (C.fam === k) + '">' + f + '</button>' : '<button type="button" class="chip cc-vide" data-stub="Aucun produit de cette famille parmi les produits comparés de cette maquette.">' + f + '</button>'; }).join('');
  var cell = function (v, min, nous) { return v == null ? '<span class="cc-abs">—</span>' : '<span class="cc-prix' + (v === min ? ' min' : '') + (nous ? ' nous' : '') + '">' + (v === min ? '<i class="puce" style="background:var(--e-bien)"></i>' : '') + A.prix(v) + '</span>'; };
  return '<section class="carte cc-tab cc-prixbox" data-interne aria-label="Le comparateur de prix"><div class="tete"><div><h2>Le comparateur de prix</h2><p class="st">un produit par ligne, une colonne par concurrent · prix nets hors taxes par boîte · le point vert marque le moins cher de la ligne · « — » : pas au catalogue · en tête : nos plus grosses sorties en nombre de pharmacies</p></div></div>' +
    '<div class="chips cc-fams" role="group" aria-label="Familles">' + pills + '</div>' +
    (rows.length ? '<div class="tabl-wrap"><table class="tabl cc-cmp"><thead><tr><th>Produit<span class="st">laboratoire · famille</span></th><th class="num">Pharmacies<span class="st">qui le commandent</span></th><th class="num cc-thn">Nous<span class="st">Intégral</span></th>' + CONC.map(function (c) { return '<th class="num">' + c + '<span class="st">' + ((A.GRP[c] || {}).nom || '') + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (p, i) { var m = moinsCher(p); return '<tr style="--i:' + i + '"><td data-l="Produit"><b class="cc-pn">' + esc(p.produit) + '</b><span class="sub">' + esc(p.labo) + ' · ' + esc(A.fam(p)) + '</span></td><td class="num" data-l="Pharmacies"><b>' + nf.format(p.pharmacies) + '</b></td><td class="num cc-tdn" data-l="Nous">' + cell(p.nous, m, true) + '</td>' + CONC.map(function (c) { return '<td class="num" data-l="' + c + '">' + cell(p[c], m) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="note">Aucun produit ne correspond.</p>') +
    '<div class="cc-pied"><span class="lbl">Listings face à un concurrent :</span>' + CONC.map(function (c) { return '<button type="button" class="chip" data-stub="' + STUB('Listing face à ' + c + ' : l’éditeur produit par produit') + '">' + J.ico('doc') + c + '</button>'; }).join('') + '<button type="button" class="chip" data-stub="' + STUB('Comparaison D2P du réseau, et d’une pharmacie') + '">' + J.ico('chart') + 'Comparaison D2P</button></div><p class="note cc-regle">' + J.ico('lock') + '<span>' + esc(X.avertissement) + '</span></p></section>' +
    '<section class="carte cc-tab" data-interne aria-label="Les catalogues relevés"><div class="tete"><div><h2>Les catalogues relevés</h2><p class="st">une fiche par source : ce qu’on y lit, la date du relevé, le nombre de références · un clic ouvre la fiche et son catalogue</p></div></div><table class="tabl"><thead><tr><th>Source</th><th>Ce qu’on y lit</th><th class="num">Relevé le</th><th class="num">Références</th><th></th></tr></thead><tbody>' +
    X.sources.filter(function (s) { return A.match(s.nom + ' ' + s.tag + ' ' + s.quoi); }).map(function (s, i) { return '<tr class="cc-lr" data-acteur="' + esc(s.nom) + '" tabindex="0" role="link" aria-label="Ouvrir la fiche ' + esc(s.nom) + '" style="--i:' + i + '"><td data-l="Source"><b class="cc-pn">' + esc(s.nom) + '</b><span class="sub">' + esc(s.tag) + ((A.GRP[s.nom]) ? ' · ' + esc(A.GRP[s.nom].nom) : '') + '</span></td><td data-l="Ce qu’on y lit"><span class="cc-quoi">' + esc(s.quoi) + '</span></td><td class="num" data-l="Relevé le">' + esc(s.releve) + '</td><td class="num" data-l="Références"><b>' + nf.format(s.references) + '</b></td><td class="cc-chev">' + J.ico('chev') + '</td></tr>'; }).join('') + '</tbody></table>' +
    '</section>';
}
function ongletActu() {
  var L = X.actus.filter(function (a) { return A.match(a.titre + ' ' + a.source); });
  return '<section class="carte cc-tab" data-interne aria-label="Actualité"><div class="tete"><div><h2>Faits vérifiés et presse</h2><p class="st">du plus récent au plus ancien · mis à jour chaque jour · la source est citée sous chaque ligne</p></div></div>' +
    (L.length ? '<table class="tabl"><thead><tr><th class="cc-q">Quand</th><th>Quoi</th><th>Nature</th></tr></thead><tbody>' + L.map(function (a, i) { return '<tr style="--i:' + i + '"><td class="num cc-q" data-l="Quand">' + esc(a.date) + '</td><td data-l="Quoi"><b class="cc-pn">' + esc(a.titre) + '</b><span class="sub">' + esc(a.source) + '</span></td><td data-l="Nature">' + (a.type === 'fait' ? J.etatHtml('cliente', 'Fait vérifié') : '<span class="etat">' + J.ico('infos', 'var(--e-neutre)') + 'Presse</span>') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="note">Rien ne correspond.</p>') + '</section>';
}
function ongletLiens() {
  return '<section class="carte cc-tab" data-interne aria-label="Qui détient qui"><div class="tete"><div><h2>Qui détient qui ?</h2><p class="st">groupes, filiales et participations · un clic sur un acteur ouvre sa fiche</p></div></div><div class="cc-liens entre">' +
    X.groupes.map(function (g, i) { var L = X.liens.filter(function (l) { return l.a === g.nom; });
      return '<div class="cc-lg" style="--i:' + i + '"><span class="cc-ln"><span class="puce" style="background:' + g.col + '"></span><b>' + esc(g.nom) + '</b><span class="sub">' + esc(g.zone) + '</span></span><div class="cc-lrs">' + (L.length ? L.map(function (l) { return '<div class="cc-lr2"><span class="cc-lk">' + esc(l.lien) + '</span><button type="button" class="chip cc-act" data-acteur="' + esc(l.b) + '">' + esc(l.b) + J.ico('chev') + '</button></div>'; }).join('') : g.acteurs.map(function (a) { return '<div class="cc-lr2"><span class="cc-lk">lien non renseigné</span><button type="button" class="chip cc-act" data-acteur="' + esc(a) + '">' + esc(a) + J.ico('chev') + '</button></div>'; }).join('')) + '</div></div>'; }).join('') + '</div></section>';
}
J.ccOnglets.prix = ongletPrix; J.ccOnglets.actu = ongletActu; J.ccOnglets.liens = ongletLiens;
/* ---------- l'écran ---------- */
function corps() { return (J.ccOnglets[C.onglet] || J.ccOnglets.carte)(); }
function apresCorps(el) {
  var d = $('#cc-dessin', el); if (d) J.dessine(d, function (w) { return J.ccCarte(w); }, J.ccLier);
  $$('[data-grp]', el).forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-grp'); C.groupe = C.groupe === v ? '' : v; J.ecrans.concurrents.rendre(el, { suite: '' }); }; });
  $$('[data-fam]', el).forEach(function (b) { b.onclick = function () { C.fam = b.getAttribute('data-fam'); J.ecrans.concurrents.rendre(el, { suite: '' }); }; });
  $$('[data-acteur]', el).forEach(function (b) { var go = function () { C.acteur = b.getAttribute('data-acteur'); J.aller('concurrents-detail'); }; b.onclick = go; if (b.tagName === 'TR') b.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
}
J.ecrans.concurrents = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail') { window.scrollTo(0, 0); return detail(el); }
    if (etat.suite && J.ccOnglets[etat.suite]) C.onglet = etat.suite;   /* #concurrents-prix, -annuaire, -actu, -liens ouvrent l'onglet */
    var ong = X.onglets.filter(function (o) { return o[0] === C.onglet; })[0] || X.onglets[0];
    el.innerHTML = '<div class="page cc">' + J.bandeau({ croix: true, eyebrow: 'Veille concurrence · réservé à l’interne Intégral', titre: 'Concurrents',
      lede: '<span class="vi"><b>' + X.groupes.length + ' groupes</b>, <b>' + Object.keys(A.GRP).length + ' acteurs</b> et <b>' + X.implantations.length + ' dépôts</b> repérés autour du secteur ; <b>' + X.comparateur.length + ' produits</b> comparés face à <b>' + X.sources.length + ' catalogues</b> relevés.</span><span class="vp">La veille concurrence de l’équipe : réservée à l’interne.</span>',
      recherche: { id: 'cc-q', placeholder: window.innerWidth < 760 ? 'Un grossiste, un produit…' : 'Un grossiste, un groupe, un produit, une source…', aria: 'Rechercher dans la veille concurrence', valeur: C.q },
      }).replace('<p class="eyebrow">', '<p class="eyebrow">' + J.ico('lock')) +
      '<div class="cc-sousnav" data-interne><div class="vues cc-ong" role="tablist" aria-label="Onglets">' + X.onglets.map(function (o) { return '<button type="button" role="tab" data-onglet="' + o[0] + '"' + (o[0] === C.onglet ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' + J.ico(ICO_ONG[o[0]] || 'more') + o[1] + '</button>'; }).join('') + '</div><p class="cc-question">' + esc(ong[2]) + '</p></div>' +
      VP_C + '<div id="cc-corps">' + corps() + '</div></div>';
    J.poseIcones(el);
    $$('[data-onglet]', el).forEach(function (b) { b.onclick = function () { C.onglet = b.getAttribute('data-onglet'); J.ecrans.concurrents.rendre(el, { suite: '' }); }; });
    $('#cc-q', el).oninput = function (e) { C.q = e.target.value; var k = $('#cc-corps', el); k.innerHTML = corps(); J.poseIcones(k); apresCorps(el); };
    apresCorps(el);
  }
};
/* ---------- #concurrents-detail : la fiche d'un acteur ou d'une source ---------- */
function cip(k) { var h = 7; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 1e9; return '3400' + ('000000000' + h).slice(-9); }
function detail(el) {
  var a = C.acteur, grp = A.groupeDe(a), g = A.GRP[a] || grp, s = A.sourceDe(a), liens = X.liens.filter(function (l) { return grp ? l.a === a : l.b === a; }), imps = X.implantations.filter(function (p) { return grp ? (A.GRP[A.acteurDe(p)] || {}).nom === a : A.acteurDe(p) === a; });
  var P = X.comparateur.filter(function (p) { return p[a] != null; }), mc = P.filter(function (p) { return p[a] < p.nous; }).length, noms = CONC.slice(); X.sources.forEach(function (x) { if (noms.indexOf(x.nom) < 0) noms.push(x.nom); }); X.groupes.forEach(function (x) { noms.push(x.nom); });
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Concurrents</button><div class="cc-pn" data-interne><button type="button" class="b-rond" data-cc-pn="-1" aria-label="Acteur précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-cc-pn="1" aria-label="Acteur suivant">' + J.ico('chev') + '</button></div><label class="filtre cc-autre" data-interne>' + J.ico('search') + '<select id="cc-autre" aria-label="Autre acteur"><option value="">Autre acteur…</option>' + noms.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select></label>';
  var lignes = [['Groupe', g && !grp ? esc(g.nom) : ''], ['Acteurs', grp ? '<span class="cc-acts">' + grp.acteurs.map(function (x) { return '<button type="button" class="chip cc-act" data-acteur="' + esc(x) + '">' + esc(x) + J.ico('chev') + '</button>'; }).join('') + '</span>' : ''], ['Lien', liens.map(function (l) { return esc(l.a) + ' ' + esc(l.lien) + ' ' + esc(l.b); }).join(' · ')], ['Zone', g ? esc(g.zone) : ''], ['Dépôts en France', g ? nf.format(g.depots) : ''], ['Autres acteurs du groupe', g && !grp ? g.acteurs.filter(function (x) { return x !== a; }).map(esc).join(' · ') : ''],
    ['Catalogue relevé le', s ? esc(s.releve) : ''], ['Références au catalogue', s ? nf.format(s.references) : ''], ['Ce qu’on y lit', s ? esc(s.quoi) : '']];
  var actions = '<div class="ronds">' + J.rond('pin', 'Sur la carte', null, 1, ' data-cc-va="carte"') + J.rond('euro', 'Comparer', null, 0, ' data-cc-va="prix"') + J.rond('doc', 'Listing face à lui', STUB('Listing face à ' + a)) + J.rond('share', 'Partager', STUB('Partager la fiche')) + J.rond('note', 'Observation', STUB('Noter une observation')) + J.rond('star', 'Études', STUB('Les études sur ' + a)) + '</div>' +
    '<button type="button" class="pil plein" data-stub="' + STUB('Qui est ' + a + ' ? (observations et études de l’équipe)') + '">' + J.ico('eye') + 'Qui est ' + esc(a) + ' ?</button><button type="button" class="pil contour" data-stub="Conditions de tiers : réservé à l’interne Intégral, jamais dans un document remis à une officine.">' + J.ico('lock') + 'Ses conditions · interne</button>';
  el.innerHTML = '<div class="page cc cc-det">' + J.bandeau({ classe: 'cc-ban', deborde: true, eyebrow: 'Fiche ' + (grp ? 'groupe' : s ? esc(s.tag.toLowerCase()) : 'acteur') + ' · veille concurrence · réservé à l’interne', recherche: '<div class="cc-outils">' + outils + '</div>' }) +
    VP_C + '<div class="sous-bandeau" data-interne>' +
    J.identite({ classe: 'cc-id', nom: esc(a), meta: '<span class="etat">' + J.ico(grp ? 'layers' : 'truck', 'var(--e-neutre)') + esc(grp ? 'Groupe' : s ? s.tag : 'Grossiste') + '</span>' + (g ? '<span class="cc-gm"><span class="puce" style="background:' + g.col + '"></span>' + esc(grp ? g.zone : g.nom) + '</span>' : ''),
      mois: g ? { lib: 'Part de marché du groupe', val: g.part + ' %', evo: '<span class="sub">France, estimation</span>' } : null, lignes: lignes, actions: actions }) +
    '<div class="gdouble stack entre cc-suite"><section class="carte cc-tab"><div class="tete"><div><h2>' + (P.length ? 'Moins cher que nous sur ' + mc + ' produit' + (mc > 1 ? 's' : '') + ' sur ' + P.length : grp ? 'Les prix se lisent acteur par acteur' : 'Aucun prix relevé face aux nôtres') + '</h2><p class="st">' + (grp ? 'ouvrez un acteur du groupe pour ses prix face aux nôtres' : 'prix nets hors taxes par boîte · l’écart lit son prix face au nôtre') + '</p></div></div>' +
    (P.length ? '<table class="tabl"><thead><tr><th>Produit</th><th class="num">Lui</th><th class="num">Nous</th><th class="num">Écart</th></tr></thead><tbody>' + P.map(function (p) { var e = (p[a] - p.nous) / p.nous * 100; return '<tr><td data-l="Produit"><b class="cc-pn">' + esc(p.produit.split(',')[0]) + '</b><span class="sub">' + esc(p.labo) + '</span></td><td class="num" data-l="Lui"><b>' + A.prix(p[a]) + '</b></td><td class="num" data-l="Nous">' + A.prix(p.nous) + '</td><td class="num" data-l="Écart"><span class="evo">' + J.ico(e < 0 ? 'bas' : 'haut', e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '<b class="num">' + J.signe(e) + '</b></span></td></tr>'; }).join('') + '</tbody></table>' : '') + '</section>' +
    '<section class="carte"><div class="tete"><div><h2>' + (grp ? 'Les dépôts du groupe autour du secteur' : 'Ses dépôts autour du secteur') + '</h2><p class="st">' + (imps.length ? 'un point par dépôt repéré' : 'aucun dépôt repéré autour du secteur') + '</p></div></div>' + (imps.length ? '<div class="cc-map cc-mini"><div class="cc-dessin" id="cc-mini"></div><div class="cc-tip" hidden></div></div><ul class="cc-dl">' + imps.map(function (p) { return '<li>' + J.ico('pin', g ? g.col : 'var(--e-neutre)') + (grp ? esc(A.acteurDe(p)) + ' · ' : '') + esc(J.maj(A.lieuDe(p))) + '</li>'; }).join('') + '</ul>' : '') + '</section></div>' +
    /* catalogue d'une source : tarif = net × un coefficient propre à la ligne (1,10 à 1,30) ; sur génériques et non remboursables le prix est libre : tarif = net, pas d'abandon */
    (s ? '<section class="carte cc-cat" data-interne><div class="tete"><div><h2>Le catalogue ' + esc(a) + '</h2><p class="st">les colonnes du catalogue relevé</p></div></div><details class="tabm"><summary>Voir le catalogue</summary><div class="tabl-wrap"><table class="tabl cc-cmp"><thead><tr><th>CIP 13<span class="st">code EAN</span></th><th>Produit</th><th>Laboratoire</th><th>Gamme</th><th class="num">Tarif hors taxes</th><th class="num">Abandon de marge</th><th class="num">Net</th><th class="num">TVA</th><th class="num">Quantité minimale</th></tr></thead><tbody>' +
      P.map(function (p) { var f = A.fam(p), libre = f === 'Non remboursés' || f === 'Génériques', coef = libre ? 1 : 1.10 + (parseInt(cip(p.produit + a).slice(-2), 10) % 21) / 100, tarif = p[a] * coef; return '<tr><td class="num" data-l="CIP 13">' + cip(p.produit) + '</td><td data-l="Produit"><b class="cc-pn">' + esc(p.produit) + '</b></td><td data-l="Laboratoire">' + esc(p.labo) + '</td><td data-l="Gamme">' + esc(f) + '</td><td class="num" data-l="Tarif hors taxes">' + A.prix(tarif) + '</td><td class="num" data-l="Abandon de marge">' + (libre ? '—' : nf1.format((1 - 1 / coef) * 100) + ' %') + '</td><td class="num" data-l="Net"><b>' + A.prix(p[a]) + '</b></td><td class="num" data-l="TVA">' + (f === 'Non remboursés' ? '10 %' : '2,1 %') + '</td><td class="num" data-l="Quantité minimale">1</td></tr>'; }).join('') + '</tbody></table></div></details></section>' : '') + '</div></div>';
  J.poseIcones(el);
  if (imps.length) J.dessine($('#cc-mini', el), function (w) { return J.ccCarte(w, grp ? { groupe: a, id: 'ccm', ratio: .62, aria: 'Dépôts du ' + a } : { acteur: a, id: 'ccm', ratio: .62, aria: 'Dépôts de ' + a }); }, J.ccLier);
  $$('[data-acteur]', el).forEach(function (b) { b.onclick = function () { C.acteur = b.getAttribute('data-acteur'); J.route(); }; });
  $('#cc-autre', el).onchange = function (e) { if (e.target.value) { C.acteur = e.target.value; J.route(); } };
  $$('[data-cc-pn]', el).forEach(function (b) { b.onclick = function () { var k = noms.indexOf(C.acteur); C.acteur = noms[((k < 0 ? 0 : k) + (+b.getAttribute('data-cc-pn')) + noms.length) % noms.length]; J.route(); window.scrollTo(0, 0); }; });   // précédent / suivant, comme les autres fiches
  $$('[data-cc-va]', el).forEach(function (b) { b.onclick = function () { C.onglet = b.getAttribute('data-cc-va'); if (C.onglet === 'carte' && g) C.groupe = g.nom; J.aller('concurrents'); }; });
}
})();
