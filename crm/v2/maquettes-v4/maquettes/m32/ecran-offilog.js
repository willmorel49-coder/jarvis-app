/* Offilog (data-ecran="offilog") = la centrale parapharmacie d'Intégral.
   #offilog : bandeau de recherche (nom, marque, EAN ; phrase calculée ; médiane sous le prix catalogue ; Classement / Moins chers
   ailleurs), « Que voulez-vous faire ? » (Trouver un produit · Le catalogue Offilog 100 / 200 / 300 · Comparer nos prix, chaque porte ouvre son choix
   dessous), deux graphiques visibles (écart au prix catalogue par rayon ; les plateformes face à Offilog), Rayons, Meilleures ventes en tableau
   (rang, picto, mouvement, prix, plateforme la moins chère, 8 semaines), sélection → PDF / Excel, Comment commander. #offilog-detail : la fiche
   d'un produit (carte d'identité, prix des plateformes, historique de rang, même rayon).
   Interne : prix d'achat et comparaisons ([data-interne]) ; le catalogue Offilog est le seul objet à remettre au pharmacien. Données fictives. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, nf2 = J.nf2, X = J.X, S = J.S;
var O = X.offilog, PL = O.plateformes, PR = O.produits, SEUIL = 7;   // « moins cher ailleurs » = une plateforme au moins 7 % sous le prix Offilog (règle écrite à l'écran)
var E = S.offilog = S.offilog || { q: '', rayon: '', porte: '', taille: O.catalogueTailles[1], plat: '', comparer: false, nb: 12, sel: [], id: PR[0].id, tri: 'rang' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var eur2 = function (n) { return nf2.format(n) + '\u00A0€'; }, PCT = ' %', sg = function (n) { return J.signe(n).replace(' %', PCT); };   // pourcentages et euros : signe du socle, espace insécable (l’unité ne reste pas seule en fin de ligne)
var LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'], lettres = function (n) { return LETTRES[n] || String(n); };   // « les quatre plateformes », « des cinq » : comptés, jamais écrits en dur
var ICO2 = {
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>', bottle: '<path d="M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3zM8 13h8"/>',
  soap: '<rect x="4" y="8" width="16" height="10" rx="3"/><path d="M8 5h6M8 13h4"/>', baby: '<circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6M10 8.5h.01M14 8.5h.01M10 11.5c1 .8 3 .8 4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  comb: '<path d="M5 4h14v6H5zM7 10v10M10 10v8M13 10v10M16 10v8"/>', tooth: '<path d="M8 3c2 0 2.5 1 4 1s2-1 4-1c3 0 4 3 3 6s-2 4-2 8c0 2-1 4-2 4s-1.5-5-3-5-2 5-3 5-2-2-2-4c0-4-1-5-2-8s0-6 3-6z"/>',
  basket: '<path d="M3 10h18l-2 10H5zM8 10l3-6M16 10l-3-6M9 14v3M15 14v3"/>', print: '<path d="M7 8V4h10v4M7 17H4v-6h16v6h-3"/><rect x="7" y="14" width="10" height="6"/>',
  barcode: '<path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v14M20 5v14"/>', present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M8 12l3-3 2 2 3-4"/>'
};
function ico(k, c) { return ICO2[k] ? '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + ICO2[k] + '</svg></span>' : J.ico(k, c); }
function rond(k, txt, stub, plein, extra) { return '<button type="button" class="rond-act' + (plein ? ' plein' : '') + '"' + (stub ? ' data-stub="' + esc(stub) + '"' : '') + (extra || '') + '><span class="rond">' + ico(k) + '</span>' + txt + '</button>'; }
/* un rayon = un picto + une couleur de catégorie, sur le picto seul */
var RAYON = { 'Soin du visage': ['drop', 1, 'Visage', 'Vis.'], 'Soin du corps': ['bottle', 2, 'Corps', 'Corps'], 'Hygiène': ['soap', 3, 'Hygiène', 'Hyg.'], 'Bébé': ['baby', 4, 'Bébé', 'Bébé'], 'Solaire': ['sun', 5, 'Solaire', 'Sol.'], 'Compléments': ['pill', 6, 'Compléments', 'Comp.'], 'Cheveux': ['comb', 7, 'Cheveux', 'Chev.'], 'Bucco-dentaire': ['tooth', 8, 'Dentaire', 'Dent.'] };
function picto(p, cl) { var r = RAYON[p.rayon] || ['box', 1]; return '<span class="og-picto' + (cl ? ' ' + cl : '') + '" aria-hidden="true">' + ico(r[0], 'var(--cat-' + r[1] + ')') + '</span>'; }
function ecartCat(p) { return Math.round((1 - p.prix / p.prixCatalogue) * 100); }
function meilleure(p, plat) { var b = null; PL.forEach(function (n) { if (plat && n !== plat) return; var v = p.plateformes[n]; if (b === null || v < b[1]) b = [n, v]; }); return b; }
function moinsCher(p, plat) { var b = meilleure(p, plat); return !!b && b[1] <= p.prix * (1 - SEUIL / 100); }
function pc(a, b) { return Math.round((a / b - 1) * 100); }
function mvtHtml(m, long) {
  if (m > 0) return '<span class="evo">' + J.ico('haut', 'var(--e-bien)') + '<b class="num">+' + m + '</b>' + (long ? ' place' + (m > 1 ? 's' : '') + ' cette semaine' : '') + '</span>';
  if (m < 0) return '<span class="evo">' + J.ico('bas', 'var(--e-alerte)') + '<b class="num">−' + Math.abs(m) + '</b>' + (long ? ' place' + (m < -1 ? 's' : '') + ' cette semaine' : '') + '</span>';
  return '<span class="evo">' + J.ico('minus', 'var(--e-neutre)') + 'stable' + (long ? ' cette semaine' : '') + '</span>';
}
function parId(id) { for (var i = 0; i < PR.length; i++) if (PR[i].id === id) return PR[i]; return PR[0]; }
function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
function grasNombres(t) { return esc(t).replace(/(\d[\d   ]*\d|\d)( produits| marques)?/g, function (m) { return '<b>' + m + '</b>'; }); }
/* la phrase du bandeau : son dernier membre (« …, 9 sont moins chers chez un concurrent ») est une comparaison de prix, donc interne → il disparaît en vue pharmacien */
function ledeHtml() { var m = O.phrase.match(/^(.*?)(,\s*\d[\d\u00A0\u202F ]*\s+sont moins chers[^.]*)\.?\s*$/), nb6 = PR.filter(function (p) { return moinsCher(p, ''); }).length; return m ? grasNombres(m[1]) + '<span data-interne>' + grasNombres(m[2] + ', dont ' + nb6 + ' dans les ' + PR.length + ' premi\u00E8res places') + '</span>.' : grasNombres(O.phrase); }
/* la courbe de rang se construit sur ce qui est ÉCRIT : dernier point = rang du jour, avant-dernier = rang + mouvement de la semaine ; l'historique antérieur des
   données (sans lien avec le rang) garde sa forme, recalé sur « il y a une semaine » et borné à la 1re place → le dernier segment va toujours dans le sens de la flèche */
function serieRang(p) {
  var h = p.histo || [], n = h.length; if (n < 2) return [];
  var prev = Math.max(1, p.rang + p.mvt), ref = h[n - 2], base = h.slice(0, n - 1).map(function (v) { return v - ref; }), lo = Math.min.apply(null, base), f = lo < 0 ? Math.min(1, (prev - 1) / -lo) : 1;
  return base.map(function (v) { return prev + v * f; }).concat([p.rang]);
}
function sparkRang(p, w, h, aria) { return J.spark(serieRang(p).map(function (v) { return -v; }), 0, w, h, 'var(--enc-2)', { aria: aria }); }   // encre : le rang n'est pas un des quatre indicateurs colorés
function pathIco(k) { return ICO2[k] || J.icoSvg(k).replace(/^<svg[^>]*>|<\/svg>$/g, ''); }
/* colonnes du socle + ce qui leur manque pour se lire sans clic : la valeur au-dessus de chaque barre, un repère en pointillé étiqueté, et au téléphone le picto du
   rayon à la place d'un libellé abrégé (même géométrie que J.colonnes : T = 12, B = 30, 2 px de marge) */
function colonnesPlus(cfg, w, o) {
  var h = cfg.h || 190, T = 12, B = 30, n = cfg.vals.length, max = Math.max.apply(null, cfg.vals.concat([1])), ih = h - T - B, iw = w - 4, haut = 20;
  var X = function (i) { return 2 + (i + .5) * iw / n; }, Y = function (v) { return T + ih - Math.max(6, v / max * ih); }, s = '';
  var svg = J.colonnes(o.pictos ? Object.assign({}, cfg, { labels: cfg.labels.map(function () { return ''; }) }) : cfg, w); if (!svg) return '';
  var serre = iw / n < 60, haut2 = haut + (serre ? 14 : 0);   // colonnes serrées (téléphone) : une valeur qui toucherait sa voisine monte d'un cran
  svg = svg.replace('viewBox="0 0 ' + w + ' ' + h + '"', 'viewBox="0 -' + haut2 + ' ' + w + ' ' + (h + haut2) + '"').replace('height="' + h + '"', 'height="' + (h + haut2) + '"');   // de la place au-dessus pour les valeurs et la légende
  /* hauteur de chaque valeur : juste au-dessus de sa colonne ; elle monte d'un cran (ou descend un peu) quand elle toucherait sa voisine (colonnes serrées) ou le trait de la médiane.
     On retient la combinaison qui déplace le moins, parmi quatre positions par valeur (petit calcul de proche en proche). */
  var yr0 = o.repere != null && o.repere <= max ? Y(o.repere) : null, DEC = [0, 4, -14, -28], ysv = [];
  (function () {
    var yk = function (i, k) { return Y(cfg.vals[i]) - 6 + DEC[k]; }, cout = [], pere = [], i, k, kp, m, arg, mn = Infinity, kk = 0;
    var libre = function (i, k) { var y = yk(i, k); return y >= -haut2 + 26 && (yr0 === null || yr0 < y - 17 || yr0 > y + 5); };
    for (i = 0; i < n; i++) {
      cout[i] = []; pere[i] = [];
      for (k = 0; k < DEC.length; k++) {
        if (!libre(i, k)) { cout[i][k] = Infinity; continue; }
        if (!i) { cout[i][k] = Math.abs(DEC[k]); continue; }
        m = Infinity; arg = 0;
        for (kp = 0; kp < DEC.length; kp++) if (cout[i - 1][kp] < m && (!serre || Math.abs(yk(i, k) - yk(i - 1, kp)) >= 14)) { m = cout[i - 1][kp]; arg = kp; }
        cout[i][k] = m + Math.abs(DEC[k]); pere[i][k] = arg;
      }
    }
    if (n) for (k = 0; k < DEC.length; k++) if (cout[n - 1][k] < mn) { mn = cout[n - 1][k]; kk = k; }
    for (i = n - 1; i >= 0; i--) { ysv[i] = yk(i, mn < Infinity ? kk : 0); if (mn < Infinity) kk = pere[i][kk]; }
  })();
  var yVal = function (v, i) { return ysv[i]; };
  if (o.repere != null && o.repere <= max) {
    /* le repère : la ligne en pointillé, et sa légende dans la marge haute (jamais sur une barre) — à droite, ou à gauche si une haute colonne y est */
    var yr = Y(o.repere), txt = o.repereTxt || 'médiane', lw = txt.length * 6.8 + 30, yl = -haut2 + 12, gene = function (x0) { return cfg.vals.some(function (v, i) { return X(i) > x0 - 16 && X(i) < x0 + lw + 16 && yVal(v, i) < yl + 16; }); }, x0 = gene(w - 6 - lw) && !gene(6) ? 6 : w - 6 - lw;
    s += '<line x1="2" x2="' + (w - 2) + '" y1="' + yr.toFixed(1) + '" y2="' + yr.toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="6 4" pointer-events="none"/>' +
      '<line x1="' + x0.toFixed(1) + '" x2="' + (x0 + 22).toFixed(1) + '" y1="' + (yl - 4) + '" y2="' + (yl - 4) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="6 4" pointer-events="none"/>' +
      '<text x="' + (x0 + 28).toFixed(1) + '" y="' + yl + '" font-size="13" font-weight="600" text-anchor="start" fill="var(--enc-2)" pointer-events="none">' + esc(txt) + '</text>';
  }
  cfg.vals.forEach(function (v, i) { s += '<text x="' + X(i).toFixed(1) + '" y="' + yVal(v, i).toFixed(1) + '" font-size="13" font-weight="700" text-anchor="middle" fill="var(--enc-1)" stroke="#fff" stroke-width="4" paint-order="stroke" pointer-events="none">' + esc(o.fmt(v)) + '</text>'; });
  if (o.pictos) o.pictos.forEach(function (pi, i) { s += '<g transform="translate(' + (X(i) - 9).toFixed(1) + ',' + (h - 27) + ') scale(.75)" fill="none" stroke="' + pi[1] + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">' + pathIco(pi[0]) + '</g>'; });
  return svg.replace('</svg>', s + '</svg>');
}
function filtres() {
  var q = E.q.trim().toLowerCase();
  var l = PR.filter(function (p) { if (E.rayon && p.rayon !== E.rayon) return false; if (E.comparer && !moinsCher(p, E.plat)) return false; return !q || (p.nom + ' ' + p.marque + ' ' + p.rayon + ' ' + p.ean).toLowerCase().indexOf(q) >= 0; });
  var tri = { rang: function (a, b) { return a.rang - b.rang; }, prix: function (a, b) { return a.prix - b.prix; }, ecart: function (a, b) { return ecartCat(b) - ecartCat(a); }, mvt: function (a, b) { return b.mvt - a.mvt; } };
  return l.sort(tri[E.tri] || tri.rang);
}
/* ---------- la sélection (barre posée en bas, PDF / Excel / vider) ---------- */
function selHtml() { var n = E.sel.length; return n ? '<span class="og-sel-n"><b class="num">' + n + '</b> produit' + (n > 1 ? 's' : '') + ' dans la sélection</span><div class="og-sel-act">' + rond('doc', 'PDF', STUB('Télécharger la sélection en PDF'), 1) + rond('down', 'Excel', STUB('Télécharger la sélection en Excel')) + rond('send', 'Envoyer', STUB('Envoyer la sélection')) + '<button type="button" class="pil" data-vider>' + J.ico('close') + 'Vider</button></div>' : ''; }
function selBar(el) { var b = $('#og-selbar', el); if (!b) return; b.innerHTML = selHtml(); b.hidden = !E.sel.length; var v = $('[data-vider]', b); if (v) v.onclick = function () { E.sel = []; selBar(el); $$('[data-sel]', el).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); x.innerHTML = J.ico('plus'); }); }; J.poseIcones(b); }
function toggleSel(id, btn, el) { var i = E.sel.indexOf(id); if (i >= 0) E.sel.splice(i, 1); else E.sel.push(id); var on = i < 0; if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.innerHTML = on ? J.ico('coche', 'var(--e-bien)') : J.ico('plus'); } selBar(el); }
function boutonSel(p) { var on = E.sel.indexOf(p.id) >= 0; return '<button type="button" class="b-rond og-add" data-sel="' + p.id + '" aria-pressed="' + on + '" aria-label="Ajouter ' + esc(p.nom) + ' à la sélection">' + (on ? J.ico('coche', 'var(--e-bien)') : J.ico('plus')) + '</button>'; }
function lierSel(el) { $$('[data-sel]', el).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); toggleSel(b.getAttribute('data-sel'), b, el); }; }); }
/* ---------- une ligne du tableau des meilleures ventes ---------- */
function platCell(p) {
  var b = meilleure(p, E.plat), e = pc(b[1], p.prix), mc = moinsCher(p, E.plat);
  var ic = mc ? J.ico('bas', 'var(--e-alerte)') : e < 0 ? J.ico('minus', 'var(--e-attention)') : J.ico('check', 'var(--e-bien)');
  var txt = mc ? 'moins chère : ' + (e === 0 ? 'au même prix' : sg(e) + ' sous Offilog') : e < 0 ? sg(e) + ' sous Offilog, sous le seuil' : e === 0 ? 'au même prix qu’Offilog' : sg(e) + ' au-dessus d’Offilog';
  return '<td data-l="Plateforme la moins chère" data-interne><span class="og-plat">' + ic + '<span><b>' + esc(b[0]) + ' · ' + eur2(b[1]) + '</b><span class="fois">' + txt + '</span></span></span></td>';
}
function ligne(p, i) {
  return '<tr class="og-l" data-produit="' + p.id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(p.nom) + '" style="--i:' + Math.min(i, 14) + '">' +
    '<td data-l="Rang" class="og-td-rang"><b class="og-rang num">' + p.rang + '</b>' + mvtHtml(p.mvt) + '</td>' +
    '<td data-l="Produit"><div class="og-prod">' + picto(p) + '<div class="og-prod-t"><b>' + esc(p.nom) + '</b><span class="sub">' + esc(p.marque) + ' · ' + esc(p.rayon) + '</span></div></div></td>' +
    '<td class="num" data-l="Prix Offilog"><b>' + eur2(p.prix) + '</b><span class="fois">' + sg(-ecartCat(p)) + ' sous le catalogue</span></td>' + platCell(p) +
    '<td data-l="8 semaines" class="og-td-sp">' + sparkRang(p, 96, 30, 'Place dans le classement sur 8 semaines : la courbe monte quand le produit gagne des places') + '</td>' +
    '<td class="og-td-add" data-interne>' + boutonSel(p) + '</td><td class="chev">' + J.ico('chev') + '</td></tr>';
}
function remplir(el) {
  var l = filtres(), aff = l.slice(0, E.nb), box = $('#og-corps', el);
  box.innerHTML = aff.length ? aff.map(ligne).join('') : '<tr><td colspan="7" class="og-vide">Aucun produit' + (E.q ? ' pour « ' + esc(E.q) + ' »' : '') + (E.rayon ? ' dans le rayon ' + esc(E.rayon) : '') + (E.comparer ? ' moins cher ailleurs' + (E.plat ? ' chez ' + esc(E.plat) : '') : '') + '. <a href="#offilog" data-raz>Tout afficher</a></td></tr>';
  /* la portée (« les N premières places ») n'est écrite qu'une fois, dans le bandeau, devant le segment Classement / Moins chers ailleurs */
  $('#og-cpt', el).innerHTML = (E.comparer ? '<b>' + l.length + ' produit' + (l.length > 1 ? 's' : '') + '</b> moins cher' + (l.length > 1 ? 's' : '') + ' ailleurs : une plateforme' + (E.plat ? ' (' + esc(E.plat) + ')' : '') + ' au moins ' + SEUIL + PCT + ' sous le prix Offilog' : (E.rayon || E.q ? '<b>' + l.length + ' produit' + (l.length > 1 ? 's' : '') + '</b> parmi les meilleures ventes' : 'Les meilleures ventes Offilog')) + (aff.length < l.length ? ' · ' + aff.length + ' affichés' : '') + ' · ' + { rang: 'dans l’ordre du classement', prix: 'du moins cher au plus cher', ecart: 'du plus grand écart au prix catalogue', mvt: 'ceux qui montent le plus en tête' }[E.tri];
  $('#og-plus', el).hidden = l.length <= E.nb;
  $$('tr[data-produit]', box).forEach(function (tr) { var go = function () { E.id = tr.getAttribute('data-produit'); J.aller('offilog-detail'); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  var raz = $('[data-raz]', box); if (raz) raz.onclick = function (ev) { ev.preventDefault(); E.q = ''; E.rayon = ''; E.comparer = false; E.plat = ''; J.route(); };
  lierSel(el); selBar(el); J.poseIcones(box);
}
/* ---------- « Que voulez-vous faire ? » : trois portes, chacune ouvre son choix juste dessous ---------- */
var PORTE_ICO = { trouver: 'search', catalogue: 'doc', comparer: 'euro' };
function panneau(el) {
  var pan = $('#og-pan', el), k = E.porte, h = '';
  $$('[data-porte]', el).forEach(function (b) { b.setAttribute('aria-expanded', String(b.getAttribute('data-porte') === k)); b.classList.toggle('on', b.getAttribute('data-porte') === k); });
  if (!k) { pan.hidden = true; pan.innerHTML = ''; return; }
  var ferme = '<button type="button" class="b-rond og-ferme" data-ferme aria-label="Refermer">' + J.ico('close') + '</button>';
  if (k === 'trouver') h = '<div class="tete"><div><h2>Trouver un produit</h2><p class="st">par nom, marque ou code EAN dans le champ du haut, ou en parcourant un rayon plus bas · quatre produits du classement pour commencer</p></div>' + ferme + '</div>' +
    '<div class="og-quatre entre">' + PR.slice(0, 4).map(function (p, i) { return '<button type="button" class="og-mini" data-ouvre="' + p.id + '" style="--i:' + i + '">' + picto(p, 'grand') + '<b>' + esc(p.nom) + '</b><span class="st">' + esc(p.marque) + '</span></button>'; }).join('') + '</div>' +
    '<div class="og-pan-act"><button type="button" class="pil plein" data-chercher>' + J.ico('search') + esc(O.portes[0].go) + '</button><button type="button" class="pil" data-rayons>' + J.ico('layers') + 'Parcourir un rayon</button></div>';
  if (k === 'catalogue') h = '<div class="tete"><div><h2>Le catalogue Offilog</h2><p class="st">les meilleures ventes d’Offilog dans l’ordre du classement, au prix public : le seul document de cet écran qu’on remet au pharmacien</p></div>' + ferme + '</div>' +
    '<div class="og-cat"><div><span class="lbl">Taille du catalogue</span><div class="seg og-tailles" role="group" aria-label="Taille du catalogue">' + O.catalogueTailles.map(function (t) { return '<button type="button" data-taille="' + t + '" aria-pressed="' + (E.taille === t) + '">' + t + ' produits</button>'; }).join('') + '</div>' +
    '<p class="note og-cat-note">Ses chapitres : <b>Les meilleures ventes</b> · <b>Les nouveautés qui montent</b> · <b>Les nouveautés</b> · un bloc par rayon · <b>Les marques</b> · <b>Comment commander</b>.</p></div>' +
    '<div class="ronds og-ronds">' + rond('doc', 'PDF', STUB('Télécharger le catalogue en PDF'), 1) + rond('print', 'Imprimer', STUB('Imprimer le catalogue')) + rond('send', 'Envoyer', STUB('Envoyer le catalogue au pharmacien')) + rond('present', 'Montrer', STUB('Montrer le catalogue à l’écran')) + '</div></div>';
  if (k === 'comparer') h = '<div class="tete" data-interne><div><h2>Comparer nos prix</h2><p class="st">où une plateforme est moins chère que l’achat Offilog, et laquelle · réservé à l’interne</p></div>' + ferme + '</div>' +
    '<div data-interne><p class="note">Un produit est « moins cher ailleurs » quand une plateforme est <b>au moins ' + SEUIL + PCT + ' sous le prix Offilog</b>. Face à :</p><div class="chips og-plats"><button type="button" class="chip" data-plat="" aria-pressed="' + !E.plat + '">Les ' + lettres(PL.length) + ' plateformes</button>' + PL.map(function (n) { return '<button type="button" class="chip" data-plat="' + esc(n) + '" aria-pressed="' + (E.plat === n) + '">' + esc(n) + '</button>'; }).join('') + '</div>' +
    '<div class="og-pan-act"><button type="button" class="pil plein" data-comparer>' + J.ico('euro') + esc(O.portes[2].go) + '</button>' + (E.comparer ? '<button type="button" class="pil" data-tout>Revenir au classement</button>' : '') + '</div></div>';
  pan.innerHTML = h; pan.hidden = false; J.poseIcones(pan);
  $('[data-ferme]', pan).onclick = function () { E.porte = ''; panneau(el); };
  $$('[data-ouvre]', pan).forEach(function (b) { b.onclick = function () { E.id = b.getAttribute('data-ouvre'); J.aller('offilog-detail'); }; });
  var c = $('[data-chercher]', pan); if (c) c.onclick = function () { var q = $('#og-q', el); q.focus(); window.scrollTo(0, 0); };
  var r = $('[data-rayons]', pan); if (r) r.onclick = function () { var t = $('#og-rayons', el); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 90); };
  $$('[data-taille]', pan).forEach(function (b) { b.onclick = function () { E.taille = +b.getAttribute('data-taille'); $$('[data-taille]', pan).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
  $$('[data-plat]', pan).forEach(function (b) { b.onclick = function () { E.plat = b.getAttribute('data-plat'); $$('[data-plat]', pan).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); if (E.comparer) remplir(el); }; });
  var cp = $('[data-comparer]', pan); if (cp) cp.onclick = function () { E.comparer = true; E.nb = PR.length; $$('[data-aff]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-aff') === 'moins')); }); remplir(el); var t = $('#og-tab', el); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 90); };
  var tt = $('[data-tout]', pan); if (tt) tt.onclick = function () { E.comparer = false; E.nb = 12; J.route(); };
}
/* ---------- les deux graphiques visibles : écart au prix catalogue par rayon ; les plateformes face à Offilog ---------- */
function vizHtml() {
  var parR = {}; PR.forEach(function (p) { (parR[p.rayon] = parR[p.rayon] || []).push(ecartCat(p)); });
  var rayons = O.rayons.map(function (r) { return r.nom; }), vals = rayons.map(function (r) { return med(parR[r] || [0]); }), max = Math.max.apply(null, vals);
  /* « moins chère sur N produits » suit la MÊME règle que le segment du bandeau (au moins 7 % sous le prix Offilog) : les quatre comptes font le total du segment */
  var plats = PL.map(function (n) { var e = PR.map(function (p) { return pc(p.plateformes[n], p.prix); }); return { n: n, med: med(e), sous: PR.filter(function (p) { return p.plateformes[n] <= p.prix * (1 - SEUIL / 100); }).length }; });
  var egal = plats.filter(function (x) { return x.med === 0; }).map(function (x) { return x.n; }), dessous = plats.filter(function (x) { return x.med < 0; }).map(function (x) { return x.n; }), mx = Math.max.apply(null, plats.map(function (x) { return Math.abs(x.med); }).concat([1]));
  var titre2 = dessous.length ? dessous.join(' et ') + ' sous le prix Offilog en médiane' : (egal.length ? 'Aucune plateforme sous Offilog en médiane, ' + egal.join(' et ') + ' à égalité' : 'Toutes les plateformes au-dessus du prix Offilog, en médiane');
  var rayonMax = rayons[vals.indexOf(max)];   // le titre dit QUI est le plus loin ; la valeur est écrite sur la colonne, pas deux fois
  return '<div class="gdouble stack og-viz entre"><section class="carte" style="--i:0"><div class="tete"><div><h2>' + esc(rayonMax) + ', le rayon le plus loin sous le prix catalogue</h2><p class="st">écart médian entre le prix Offilog et le prix catalogue (prix public conseillé), rayon par rayon, parmi les meilleures ventes · en pointillé, la médiane du classement entier · touchez une colonne pour la lire</p></div></div><div class="chart-box og-col" id="og-col"></div><p class="lecteur" id="og-lect" aria-live="polite">Touchez ou survolez un rayon pour le lire.</p></section>' +
    '<section class="carte" data-interne style="--i:1"><div class="tete"><div><h2>' + titre2 + '</h2><p class="st">écart médian de chaque plateforme au prix Offilog, parmi les meilleures ventes · « moins chère » : au moins ' + SEUIL + PCT + ' sous le prix Offilog · en gris : une comparaison, pas une série</p></div></div><div class="og-cbs">' +
    plats.map(function (x) { return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:var(--enc-4)"></span><b>' + esc(x.n) + '</b></span><span class="cb-v num">' + sg(x.med) + '</span></div><div class="cb-pist"><i class="cb-b" style="width:' + Math.max(1.5, Math.abs(x.med) / mx * 100).toFixed(1) + '%;background:var(--enc-4)"></i></div><div class="cb-p"><span>' + (x.med > 0 ? 'au-dessus d’Offilog' : x.med < 0 ? 'sous Offilog' : 'au même prix qu’Offilog') + ' en médiane</span><b class="num">' + (x.sous ? 'moins chère sur ' + x.sous + ' produit' + (x.sous > 1 ? 's' : '') : 'moins chère sur aucun produit') + '</b></div></div>'; }).join('') + '</div></section></div>';
}
function dessinerViz(el) {
  var parR = {}; PR.forEach(function (p) { (parR[p.rayon] = parR[p.rayon] || []).push(ecartCat(p)); });
  var rayons = O.rayons.map(function (r) { return r.nom; }), vals = rayons.map(function (r) { return med(parR[r] || [0]); });
  var textes = rayons.map(function (r, i) { return '<b>' + esc(r) + '</b> : prix Offilog ' + sg(-vals[i]) + ' sous le prix catalogue en médiane, sur ' + (parR[r] || []).length + ' produits parmi les meilleures ventes.'; });
  /* couleur : l'écart entre le prix Offilog et le prix public est la place laissée au pharmacien → la teinte « marge du pharmacien » ; le repère est la médiane du classement (celle du bandeau) */
  J.dessine($('#og-col', el), function (w) {
    var tel = (w - 4) / rayons.length < 72;   // colonnes de moins de 72 px : les noms entiers ne tiennent plus dessous, le picto du rayon les remplace (aucune abréviation), le nom entier est dans le lecteur
    return colonnesPlus({ vals: vals, labels: rayons.map(function (r) { return RAYON[r] ? RAYON[r][2] : r; }), couleur: 'var(--c-pharma)', aria: 'Écart médian au prix catalogue par rayon', h: tel ? 170 : 210 }, w,
      { fmt: function (v) { return sg(-v); }, repere: O.medianeSousCatalogue, repereTxt: 'médiane du classement', pictos: tel ? rayons.map(function (r) { var x = RAYON[r] || ['box', 1]; return [x[0], 'var(--cat-' + x[1] + ')']; }) : null });
  }, function (box) { J.lie(box, textes, $('#og-lect', el)); });
}
J.ecrans.offilog = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail') return rendreDetail(el);
    var nbMoins = PR.filter(function (p) { return moinsCher(p, ''); }).length;
    /* le 9 de la phrase vaut pour le classement entier ; le 6 du segment vaut pour les N premières places : la portée est écrite devant le segment, une seule fois sur l'écran */
    el.innerHTML = '<div class="page og">' + J.bandeau({
      croix: true, eyebrow: esc(O.eyebrow) + ' · ' + esc(O.periode), titre: 'Offilog', lede: ledeHtml(),
      recherche: { id: 'og-q', placeholder: 'Nom, marque ou code EAN…', aria: 'Rechercher un produit Offilog', valeur: E.q },
      bas: '<span class="lbl">Médiane : <b class="num">' + O.medianeSousCatalogue + PCT + '</b> sous le prix catalogue, sur <b class="num">' + nf.format(O.medianeN) + ' produits</b></span><span class="lbl og-portee" data-interne>Dans les <b class="num">' + PR.length + ' premières places</b> :</span><div class="seg" role="group" aria-label="Afficher" data-interne><button type="button" data-aff="tout" aria-pressed="' + !E.comparer + '">Classement</button><button type="button" data-aff="moins" aria-pressed="' + E.comparer + '">Moins chers ailleurs <span class="cnt">' + nbMoins + '</span></button></div>'
    }) +
    '<h2 class="titre-s">Que voulez-vous faire ?<span class="st">chaque porte ouvre son choix juste dessous</span></h2>' +
    '<div class="og-portes entre">' + O.portes.map(function (p, i) { return '<button type="button" class="og-porte" data-porte="' + p.k + '" aria-expanded="false" style="--i:' + i + '"' + (p.k === 'comparer' ? ' data-interne' : '') + '><span class="rond gris">' + J.ico(PORTE_ICO[p.k]) + '</span><span class="og-porte-t"><b>' + esc(p.t) + '</b><span class="st">' + esc(p.s) + '</span></span><span class="og-porte-go">' + esc(p.go) + J.ico('chevb') + '</span></button>'; }).join('') + '</div>' +
    '<section class="carte og-panc" id="og-pan" hidden></section>' +
    vizHtml() +
    '<h2 class="titre-s" id="og-rayons">Rayons<span class="st">le nombre de produits classés dans chaque rayon · une pastille filtre la liste</span></h2>' +
    '<div class="chips og-chips"><button type="button" class="chip" data-rayon="" aria-pressed="' + !E.rayon + '">Tous les rayons</button>' + O.rayons.map(function (r) { return '<button type="button" class="chip" data-rayon="' + esc(r.nom) + '" aria-pressed="' + (E.rayon === r.nom) + '">' + picto({ rayon: r.nom }) + esc(r.nom) + ' <span class="cnt">' + nf.format(r.n) + '</span></button>'; }).join('') + '</div>' +
    '<section class="carte og-tab" id="og-tab" aria-label="Meilleures ventes"><div class="tete"><div><h2>Meilleures ventes</h2><p class="st" id="og-cpt"></p></div><label class="filtre">Trier :<select id="og-tri" aria-label="Trier">' + [['rang', 'classement'], ['prix', 'prix Offilog'], ['ecart', 'écart au prix catalogue'], ['mvt', 'montent le plus']].map(function (t) { return '<option value="' + t[0] + '"' + (E.tri === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="tabl-wrap"><table class="tabl og-tabl"><thead><tr><th>Rang<span class="st">mouvement de la semaine</span></th><th>Produit<span class="st">marque · rayon</span></th><th class="num">Prix Offilog<span class="st">écart au prix catalogue</span></th><th data-interne>Plateforme la moins chère<span class="st">face au prix Offilog</span></th><th>8 semaines<span class="st">place dans le classement</span></th><th data-interne></th><th></th></tr></thead><tbody id="og-corps"></tbody></table></div>' +
    '<div class="og-pied"><button type="button" class="pil" id="og-plus">' + J.ico('chevb') + 'Afficher toutes les places</button></div>' +
    '</section>' +
    '<section class="carte og-cmd"><div class="tete"><div><h2>Comment commander</h2><p class="st">ce qu’on remet au pharmacien, et ce qu’on suit ensuite</p></div></div><div class="og-etapes">' +
      '<div class="og-etape"><span class="rond gris">' + J.ico('doc') + '</span><div><b>L’ouverture de compte Offilog 2026</b><span class="note">Le formulaire en PDF, à joindre au mail de la To do list ou à laisser au comptoir.</span></div><button type="button" class="pil" data-stub="' + STUB('Ouvrir la fiche d’ouverture de compte Offilog 2026') + '">' + J.ico('doc') + 'PDF</button></div>' +
      '<div class="og-etape"><span class="rond gris">' + ico('basket') + '</span><div><b>La commande se passe sur le site Offilog</b><span class="note">Livrée avec la tournée Intégral ; le catalogue ci-dessus donne l’ordre des meilleures ventes.</span></div></div>' +
      '<div class="og-etape" data-interne><span class="rond gris">' + J.ico('chart') + '</span><div><b>Les ventes Offilog du mois</b><span class="note">Le chiffre d’affaires Offilog par commercial et les pharmacies à relancer.</span></div><button type="button" class="pil" data-stub="Les ventes Offilog du mois (chiffre d’affaires par commercial, prime, pharmacies à relancer) ne sont pas fournies dans cette maquette : bloc non dessiné.">' + J.ico('chart') + 'Ouvrir</button></div></div></section>' +
    '<div class="og-selbar" id="og-selbar" data-interne hidden></div></div>';
    remplir(el); panneau(el); dessinerViz(el);
    $('#og-q', el).oninput = function (e) { E.q = e.target.value; E.nb = 12; remplir(el); };
    $$('[data-porte]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-porte'); E.porte = E.porte === k ? '' : k; panneau(el); }; });
    $$('[data-aff]', el).forEach(function (b) { b.onclick = function () { E.comparer = b.getAttribute('data-aff') === 'moins'; E.nb = E.comparer ? PR.length : 12; $$('[data-aff]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); remplir(el); }; });
    $$('[data-rayon]', el).forEach(function (b) { b.onclick = function () { E.rayon = b.getAttribute('data-rayon'); E.nb = 12; $$('[data-rayon]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); remplir(el); }; });
    $('#og-tri', el).onchange = function (e) { E.tri = e.target.value; remplir(el); };
    $('#og-plus', el).onclick = function () { E.nb = PR.length; remplir(el); };
  }
};
/* ====================================================================================================================
   #offilog-detail : la fiche d'un produit = bandeau court (retour, précédent / suivant, « Autre produit… »), carte d'identité qui déborde
   du bandeau (nom, marque, rayon, EAN, rang, prix catalogue ; grand prix Offilog et écart ; actions rondes), prix des plateformes (interne),
   historique de rang (forme seule : la série fictive ne se raccorde pas au rang), les autres produits du rayon.
   ==================================================================================================================== */
function rendreDetail(el) {
  window.scrollTo(0, 0);   // le socle garde le défilement sur les adresses « -detail » : la fiche s'ouvre sur la carte d'identité, pas à la hauteur de la ligne cliquée
  var p = parId(E.id), idx = PR.indexOf(p), ec = ecartCat(p), prev = p.rang + p.mvt, b = meilleure(p, ''), e = pc(b[1], p.prix), dans = E.sel.indexOf(p.id) >= 0;
  /* le titre de la carte des plateformes ne répète pas l'écart (il est dans sa ligne du tableau) */
  var titrePlats = moinsCher(p, '') ? esc(b[0]) + ' est moins cher qu’Offilog' : e < 0 ? esc(b[0]) + ' est un peu moins cher qu’Offilog, sans atteindre le seuil de ' + SEUIL + PCT : e === 0 ? esc(b[0]) + ' est au même prix qu’Offilog' : 'Offilog est le moins cher des ' + lettres(PL.length + 1);
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Offilog</button><div class="og-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Produit précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Produit suivant">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre og-autre">' + J.ico('search') + '<select id="og-autre" aria-label="Autre produit"><option value="">Autre produit…</option>' + PR.map(function (x) { return '<option value="' + x.id + '">' + x.rang + '. ' + esc(x.nom) + ' — ' + esc(x.marque) + '</option>'; }).join('') + '</select></label>';
  var lignes = [['Marque', esc(p.marque)], ['Rayon', esc(p.rayon)], ['Code EAN', '<span class="num">' + esc(p.ean) + '</span>', 0, 1], ['Rang', J.ordre(p.rang) + ' sur ' + nf.format(O.nbProduits) + ' produits classés'],
    ['Il y a une semaine', prev >= 1 && p.mvt !== 0 ? J.ordre(prev) + ' place' : ''], ['Prix catalogue', eur2(p.prixCatalogue) + ' · prix public conseillé']];
  var actions = '<div class="ronds og-ronds-d">' + rond(dans ? 'coche' : 'plus', dans ? 'Dans la sélection' : 'Ajouter à la sélection', '', 1, ' data-sel-d data-interne aria-pressed="' + dans + '"') + rond('doc', 'Fiche PDF', STUB('Télécharger la fiche produit en PDF')) + rond('share', 'Partager', STUB('Partager la fiche')) + '</div>' +
    '<button class="pil contour" type="button" data-stub="' + STUB('Voir sur le site Offilog') + '">' + J.ico('ext') + 'Voir sur le site Offilog</button><a class="pil contour" href="#offilog-detail" data-ancre="og-plats" data-interne>' + J.ico('euro') + 'Comparer nos prix</a>';
  var memes = PR.filter(function (x) { return x.rayon === p.rayon && x.id !== p.id; });
  el.innerHTML = '<div class="page og og-det">' + J.bandeau({ classe: 'og-ban-d', deborde: true, eyebrow: 'Offilog · fiche produit · ' + esc(O.periode), recherche: '<div class="og-outils">' + outils + '</div>' }) +
    '<div class="sous-bandeau">' + J.identite({ classe: 'og-ident', nom: esc(p.nom), meta: picto(p, 'grand') + '<span class="etat">' + J.ico('star', 'var(--cat-5)') + 'Parmi les meilleures ventes</span>' + mvtHtml(p.mvt, true),
      mois: { lib: 'Prix Offilog', val: eur2(p.prix), evo: '<span class="evo">' + J.ico('bas', 'var(--e-bien)') + '<b class="num">' + sg(-ec) + '</b> <span class="sub" style="display:inline">sous le prix catalogue</span></span>' }, lignes: lignes, actions: actions }) +
    '<div class="gdeux stack entre og-det-grid">' +
      '<section class="carte" id="og-plats" data-interne style="--i:0"><div class="tete"><div><h2>' + titrePlats + '</h2><p class="st">prix public relevé sur chaque plateforme, face au prix Offilog · un produit est « moins cher ailleurs » à partir de ' + SEUIL + PCT + ' d’écart · réservé à l’interne</p></div></div>' +
        '<table class="tabl og-tabp"><thead><tr><th>Plateforme</th><th class="num">Prix relevé</th><th class="num">Écart à Offilog</th></tr></thead><tbody>' + PL.slice().sort(function (x, y) { return p.plateformes[x] - p.plateformes[y]; }).map(function (n) { var v = p.plateformes[n], d = pc(v, p.prix); return '<tr' + (n === b[0] ? ' class="lu"' : '') + '><td><b>' + esc(n) + '</b></td><td class="num"><b>' + eur2(v) + '</b></td><td class="num"><span class="evo">' + J.ico(d < 0 ? 'bas' : d > 0 ? 'haut' : 'minus', d < 0 ? 'var(--e-alerte)' : d > 0 ? 'var(--e-bien)' : 'var(--e-neutre)') + '<b class="num">' + sg(d) + '</b></span></td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="carte" style="--i:1"><div class="tete"><div><h2>Historique de rang</h2><p class="st">les 8 dernières semaines · la courbe monte quand le produit gagne des places · elle finit sur sa place du jour, après le mouvement de la semaine écrit dans la carte d’identité</p></div></div><div class="chart-box og-histo" id="og-histo"></div><div class="og-ax"><span>il y a 8 semaines</span><span>cette semaine</span></div></section>' +
    '</div>' +
    '<section class="carte og-tab og-meme"><div class="tete"><div><h2>Dans le même rayon · ' + esc(p.rayon) + '</h2><p class="st">les autres produits du rayon dans les ' + PR.length + ' premières places · un clic ouvre la fiche</p></div><button type="button" class="pil" data-rayon-liste>' + J.ico('layers') + 'Voir le rayon dans la liste</button></div>' +
      '<div class="tabl-wrap"><table class="tabl og-tabl"><thead><tr><th>Rang<span class="st">mouvement de la semaine</span></th><th>Produit<span class="st">marque · rayon</span></th><th class="num">Prix Offilog<span class="st">écart au prix catalogue</span></th><th data-interne>Plateforme la moins chère<span class="st">face au prix Offilog</span></th><th>8 semaines<span class="st">place dans le classement</span></th><th data-interne></th><th></th></tr></thead><tbody>' + memes.map(ligne).join('') + '</tbody></table></div></section>' +
    '<div class="og-selbar" id="og-selbar" data-interne hidden></div></div>';
  J.poseIcones(el);
  J.dessine($('#og-histo', el), function (w) { return sparkRang(p, w, w < 560 ? 120 : 150, 'Place dans le classement sur 8 semaines'); });
  $$('[data-pn]', el).forEach(function (x) { x.onclick = function () { var k = idx + (+x.getAttribute('data-pn')); if (k < 0) k = PR.length - 1; if (k >= PR.length) k = 0; E.id = PR[k].id; J.route(); }; });
  $('#og-autre', el).onchange = function (ev) { if (ev.target.value) { E.id = ev.target.value; J.route(); } };
  $$('tr[data-produit]', el).forEach(function (tr) { var go = function () { E.id = tr.getAttribute('data-produit'); J.route(); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  $('[data-rayon-liste]', el).onclick = function () { E.rayon = p.rayon; E.comparer = false; E.nb = 12; J.aller('offilog'); };
  var bs = $('[data-sel-d]', el); bs.onclick = function () { toggleSel(p.id, null, el); var on = E.sel.indexOf(p.id) >= 0; bs.setAttribute('aria-pressed', String(on)); bs.innerHTML = '<span class="rond">' + J.ico(on ? 'coche' : 'plus') + '</span>' + (on ? 'Dans la sélection' : 'Ajouter à la sélection'); };
  var an = $('[data-ancre]', el); if (an) an.onclick = function (ev) { ev.preventDefault(); var t = $('#og-plats', el); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 90); };
  lierSel(el); selBar(el);
}
})();
