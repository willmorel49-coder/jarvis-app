/* m01d — Pappers v4 : Pilotage, la feuille (panneau à droite) et « Voir tout le détail » (cartes côte à côte). */
(function () {
  'use strict';
  var N = window.N, P = window.DONNEES_V4.pilotage, esc = N.esc, P2 = N.pil, S = P2.S, $ = P2.$, $$ = P2.$$;
  var eur = P2.eur, eurM = P2.eurM, nf = P2.nf, nf1 = P2.nf1, signe = P2.signe, somme = P2.somme;
  var PL = P.moisLibelles, PLL = P.moisLibellesLongs;
  function nom(n) { return N.titre(String(n).replace(/^PHARMACIE\s+/i, '')); }

  /* La feuille : mesure choisie, son histogramme (avec la Moyenne Intégral pour les mesures « par client »), sa définition. */
  P2.feuille = function (cle) {
    var ms = P2.moisDe(S.sect), r = P2.plage(), pr = P2.plagePrec(r), sel = [], i, h, d, lib = P2.libPeriode(r);
    for (i = r[0]; i <= r[1]; i++) sel.push(i);
    var p = $('#panneau');
    function ouvrir(titre, corps) {
      p.innerHTML = '<div class="pn-t"><h2>' + esc(titre) + '</h2><button type="button" class="btn" data-fermer aria-label="Fermer">' + N.ico('back') + 'Fermer</button></div><div class="pn-c">' + corps + '</div>';
      p.hidden = false; $('[data-fermer]', p).onclick = function () { p.hidden = true; };
      N.icones(p);
    }
    if (cle === 'mol') {
      ouvrir('Molécules chères', '<p class="st">Une molécule est « chère » dès qu’une de ses boîtes est vendue à 468 € ou plus (prix net). ' + esc(lib) + '.</p>' +
        '<div class="tab h tab--mol"><span>Molécule</span><span class="num">Boîtes</span><span class="num">Chiffre d’affaires</span><span class="num">Prix de la boîte</span></div>' +
        P.moleculesCheres.map(function (m) { return '<div class="tab tab--mol"><span><b>' + esc(m.nom.charAt(0).toUpperCase() + m.nom.slice(1)) + '</b><span class="sous">' + m.officines + ' officines</span></span><span class="num">' + nf.format(m.boites) + '</span><span class="num">' + eur(m.ca) + '</span><span class="num">' + eur(m.prixBoite) + '</span></div>'; }).join(''));
      return;
    }
    if (cle.indexOf('par:') === 0) {
      d = P2.PAR.filter(function (x) { return x.k === cle.slice(4); })[0];
      var sA = ms.map(function (x, k) { return d.v(x, k); }), sB = P.moyenneIntegral.map(d.g), m = P2.valMoy(d, r), v = S.sect === 'tous' ? null : P2.valPar(d, ms, r);
      ouvrir(d.nom, '<p class="gros-n gros-n--s">' + d.fmt(v == null ? m : v) + '</p><p class="st">' + d.unit + ' · ' + esc(lib) + '</p>' +
        (v == null ? '' : '<p class="st">Moyenne Intégral : <b>' + d.fmt(m) + '</b> · <b>' + signe((v - m) / m * 100) + '</b> face à la Moyenne Intégral</p>') +
        '<div id="fe-h"></div><p class="lecteur" id="fe-l" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>' +
        '<div class="leg"><span class="lg2"><i class="dot" style="--k:' + d.col + '"></i>' + (v == null ? 'Moyenne Intégral' : 'Votre secteur') + '</span>' + (v == null ? '' : '<span class="lg2"><i class="dot dot--l"></i>Moyenne Intégral</span>') + '</div>' +
        '<p class="meth">' + ({ ca: 'Ce qu’un client achète en moyenne chaque mois.', nous: 'Ce qu’un client rapporte en moyenne à Intégral chaque mois.', liv: 'Nombre de livraisons reçues par un client chaque mois.', mpl: 'Notre marge divisée par le nombre de livraisons.', apl: 'Notre marge moins le coût des livraisons, par client et par mois.' })[d.k] + '</p>');
      var bx = $('#fe-h', p);
      bx.innerHTML = P2.histo({ labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: v == null ? sB : sA, sel: sel, incompl: [12], couleur: d.col, w: P2.largeur(bx, 280, 420), h: 220, ligne: v == null ? null : { vals: sB }, axe: function (g) { return g >= 1000 ? nf.format(g / 1000) + ' k€' : nf1.format(g).replace(',0', ''); }, aria: d.nom });
      P2.lier(bx, PL.map(function (l, k) { return '<b>' + PLL[k] + '</b> : ' + d.fmt(v == null ? sB[k] : sA[k]) + (v == null ? '' : ' · Moyenne Intégral : ' + d.fmt(sB[k])); }), $('#fe-l', p));
      return;
    }
    d = P2.MES[cle];
    var val = d.f(ms, r), w = pr ? d.f(ms, pr) : null;
    ouvrir(d.nom, '<p class="gros-n gros-n--s">' + d.fmt(val) + '</p><p class="st">' + esc(lib) + '</p><p class="hero-evo">' + P2.evo(val, w, S.per === 'dernier' ? 'septembre' : 'la période d’avant') + '</p><div id="fe-h"></div><p class="lecteur" id="fe-l" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>' +
      '<div class="leg"><span class="lg2"><i class="dot" style="--k:' + d.col + '"></i>' + esc(lib) + '</span><span class="lg2"><i class="dot" style="--k:var(--enc-5)"></i>Autres mois</span><span class="lg2"><i class="dot dot--vide"></i>Mois incomplet</span></div>');
    var b2 = $('#fe-h', p);
    b2.innerHTML = P2.histo({ labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: ms.map(d.s), sel: sel, incompl: [12], couleur: d.col, w: P2.largeur(b2, 280, 420), h: 220, axe: P2.axeEur, aria: d.nom });
    P2.lier(b2, ms.map(function (m, k) { return '<b>' + PLL[k] + '</b> : ' + d.fmt(d.s(m)) + (k === 12 ? ' (mois incomplet)' : ''); }), $('#fe-l', p));
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var p = $('#panneau'); if (p) p.hidden = true; } });

  /* Lignes à barre fine : nom, sous-titre, barre d'une seule teinte, valeur. */
  function barres(lignes, col, fmt) {
    var mx = Math.max.apply(null, lignes.map(function (l) { return l[1]; }).concat([1]));
    return '<div class="bl">' + lignes.map(function (l) { return '<div class="bl-l"><span class="bl-n"><b>' + esc(l[0]) + '</b>' + (l[2] ? '<span class="sous">' + esc(l[2]) + '</span>' : '') + '</span><span class="bl-b"><span class="piste2" style="--k:' + col + '"><i style="width:' + (Math.max(0, l[1]) / mx * 100).toFixed(1) + '%"></i></span></span><span class="bl-v">' + fmt(l[1]) + '</span></div>'; }).join('') + '</div>';
  }
  function carte(titre, st, corps) { return '<section class="cadre"><header><div><h2>' + titre + '</h2>' + (st ? '<p class="st">' + st + '</p>' : '') + '</div></header>' + corps + '</section>'; }

  P2.detail = function (ms, r) {
    var box = $('#p-detail'), lp = P2.libPeriode(r);
    var top = S.per === 'dernier' ? P.top10Officines.dernierMois : S.per === '3' ? P.top10Officines.troisMois : P.top10Officines.annee;
    var src = S.sect === 'tous' ? P.secteurs : P.secteurs.filter(function (s) { return s.id === S.sect; });
    var cl = P.secteurs.map(function (s) { return [s.nom, somme(s.mois, r, 'margeNous'), eurM(somme(s.mois, r, 'ca')) + ' de chiffre d’affaires']; }).sort(function (a, b) { return b[1] - a[1]; });
    var fam = {}, tot = 0, rep = {}, repT = {}, tF = 0, tT = 0, i;
    src.forEach(function (s) { for (i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm) continue;
      (mm.margeParFamille || []).forEach(function (f) { fam[f.nom] = (fam[f.nom] || 0) + Math.max(0, f.euros); tot += Math.max(0, f.euros); });
      (mm.repartitionFamille || []).forEach(function (f) { rep[f.nom] = (rep[f.nom] || 0) + f.euros; tF += f.euros; });
      (mm.repartitionTranche || []).forEach(function (f) { repT[f.nom] = (repT[f.nom] || 0) + f.euros; tT += f.euros; }); } });
    var pc = function (o, t) { return Object.keys(o).map(function (k) { return [k, o[k] / (t || 1) * 100]; }); }, pct = function (v) { return nf1.format(v) + ' %'; };
    var gm = P.groupements;
    var h = '<div class="rang">' + carte('Marché et opportunités', 'Marché France × vos ventes réseau : où pousser quoi, princeps en stock Intégral.', '<div class="btns"><button type="button" class="btn" data-stub="Écran Marché non dessiné dans cette maquette.">Ouvrir</button></div>') +
      carte('Offilog, « Mes produits » et « Le marché France »', 'Blocs non dessinés dans cette maquette (aucune donnée fictive prévue).', '') + '</div>';
    h += '<div class="rang">' + carte('Classement des commerciaux par notre marge', esc(lp) + ' · uniquement en vue « Tous les secteurs »', S.sect === 'tous' ? barres(cl, 'var(--c-nous)', eur) : '<p class="vide-mini">Choisissez « Tous les secteurs » pour voir le classement.</p>') +
      carte('Notre marge, famille par famille', 'part de notre marge sur la période · génériques comptés à zéro', barres(pc(fam, tot), 'var(--c-nous)', pct)) + '</div>';
    h += '<div class="rang">' + carte('Répartition de mon chiffre d’affaires, par famille', esc(lp) + ' · part du total', barres(pc(rep, tF), 'var(--c-ca)', pct)) +
      carte('Répartition par tranche de prix', esc(lp) + ' · part du total', barres(pc(repT, tT), 'var(--c-ca)', pct)) + '</div>';
    h += '<div class="rang">' + carte('Top 10 des officines', esc(lp), barres(top.map(function (o) { return [o.rang + '. ' + nom(o.nom), o.ca, o.ville + ' · marge du pharmacien ' + eur(o.margePharmacien) + ' · notre marge ' + eur(o.margeNous)]; }), 'var(--c-ca)', eur)) +
      carte('Chiffre d’affaires et marge par groupement', esc(P.groupementsPeriode), barres(gm.map(function (g) { return [g.nom, g.ca, g.officines + ' officines · marge du pharmacien ' + eur(g.margePharmacien)]; }), 'var(--c-ca)', eurM)) + '</div>';
    /* évolution mois par mois avec trois repères */
    var cm = ms.map(function (m) { return m.ca; }), comp = cm.slice(0, 12), mx = Math.max.apply(null, comp), imx = comp.indexOf(mx);
    h += carte('Évolution du chiffre d’affaires, mois par mois', '13 mois, dont 1 incomplet', '<div class="trois-rep"><div><span class="sous">Moyenne des mois complets</span><b>' + eurM(comp.reduce(function (a, b) { return a + b; }, 0) / 12) + '</b></div><div><span class="sous">Meilleur mois</span><b>' + eurM(mx) + '</b><span class="sous">' + PLL[imx] + '</span></div><div><span class="sous">Mois complets</span><b>12 sur 13</b></div></div><div id="d-histo"></div><p class="lecteur" id="d-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>');
    /* gisement et pharmacies en baisse */
    var G = P.gisement;
    h += '<div class="rang">' + carte('Le gisement · ' + G.officines + ' officines', 'Ce que la France achète et que vos officines n’ont pas commandé, uniquement ce qu’Intégral a en stock. Classé par euros.',
      '<p class="jauge-t"><b>' + G.couverture.part + ' %</b> · ' + nf.format(G.couverture.produitsCommandes) + ' / ' + nf.format(G.couverture.produitsMarche) + ' produits du marché remboursable commandés au moins une fois</p><span class="piste2" style="--k:var(--c-ca)"><i style="width:' + G.couverture.part + '%"></i></span>' +
      barres(G.lignes.map(function (g) { return [g.rang + '. ' + g.nom.split(',')[0], g.potentielParAn, g.officinesNeLePrennentPas + ' officines sur ' + g.surOfficines + ' ne le prennent pas · ' + eur(g.prixNetBoite) + ' la boîte']; }), 'var(--c-ca)', function (v) { return eurM(v) + ' par an'; })) +
      carte('Pharmacies en baisse, à relancer', '3 derniers mois contre les 3 précédents · ' + esc(P.pharmaciesEnBaisse.regle),
        '<div class="bl">' + P.pharmaciesEnBaisse.lignes.map(function (o) { return '<button type="button" class="bl-l bl-l--b" data-officine="' + o.id + '"><span class="bl-n"><b>' + o.rang + '. ' + esc(nom(o.nom)) + '</b><span class="sous">' + esc(o.ville) + '</span></span><span class="bl-v">' + P2.ico('bas', 'var(--e-alerte)') + ' ' + eur(o.baisseParMois) + ' par mois · <b>' + o.pourcent + ' %</b></span>' + P2.ico('next') + '</button>'; }).join('') + '</div>') + '</div>';
    box.innerHTML = h;
    var hb = $('#d-histo', box);
    hb.innerHTML = P2.histo({ labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: cm, sel: null, incompl: [12], couleur: 'var(--c-ca)', w: P2.largeur(hb, 300, 900), h: 250, axe: P2.axeEur, moy: comp.reduce(function (a, b) { return a + b; }, 0) / 12, moyTxt: 'Moyenne des mois complets', aria: 'Chiffre d’affaires sur 13 mois' });
    P2.lier(hb, ms.map(function (m, k) { return '<b>' + PLL[k] + '</b> : ' + eurM(m.ca) + (k === 12 ? ' (mois incomplet)' : ''); }), $('#d-lect', box));
    N.icones(box);
  };
})();
