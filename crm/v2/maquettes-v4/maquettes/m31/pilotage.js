/* m31 — Pilotage : bandeau, période, héros (deux grands chiffres + colonnes sans axes, emprunt m22), 4 mesures, molécules, « par client » face à la Moyenne Intégral, tout le détail. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, eurM = J.eurM, nf = J.nf, nf1 = J.nf1, nf2 = J.nf2, S = J.S, P = J.P;
var PL = P.moisLibelles, PLL = P.moisLibellesLongs, COURT = PL.map(function (l) { return l.split(' ')[0]; });
function moisDe(sect) { if (sect === 'tous') return P.reseau.mois; for (var i = 0; i < P.secteurs.length; i++) if (P.secteurs[i].id === sect) return P.secteurs[i].mois; return P.reseau.mois; }
function plage() { if (S.per === 'dernier') return [11, 11]; if (S.per === '3') return [9, 11]; if (S.per === 'annee') return [2, 11]; return [Math.min(S.du, S.au), Math.max(S.du, S.au)]; }
function plagePrec(r) { var n = r[1] - r[0] + 1, a = r[0] - n; return a < 0 ? null : [a, r[0] - 1]; }
function somme(ms, r, k) { var s = 0; for (var i = r[0]; i <= r[1]; i++) s += (typeof k === 'function' ? k(ms[i]) : ms[i][k]); return s; }
function moy(ms, r, k) { return somme(ms, r, k) / (r[1] - r[0] + 1); }
var MES = {
  ca: { nom: 'Chiffre d’affaires', ico: 'euro', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca'); }, s: function (m) { return m.ca; }, fmt: eurM },
  nous: { nom: 'Notre marge', ico: 'chart', col: 'var(--c-nous)', f: function (ms, r) { return somme(ms, r, 'margeNous'); }, s: function (m) { return m.margeNous; }, fmt: eur },
  phar: { nom: 'Marge pharmacien générée', ico: 'user', col: 'var(--c-pharma)', f: function (ms, r) { return somme(ms, r, 'margePharmacien'); }, s: function (m) { return m.margePharmacien; }, fmt: eur },
  act: { nom: 'Officines actives', ico: 'check', col: 'var(--c-cmd)', f: function (ms, r) { return Math.round(moy(ms, r, 'officinesActives')); }, s: function (m) { return m.officinesActives; }, fmt: function (v) { return nf.format(v); } },
  panier: { nom: 'Panier moyen', ico: 'box', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca') / Math.max(1, somme(ms, r, 'officinesActives')); }, s: function (m) { return m.ca / Math.max(1, m.officinesActives); }, fmt: eur }
};
var PAR = [
  { k: 'ca', nom: 'Chiffre d’affaires par client', unit: 'par client et par mois', col: 'var(--c-ca)', ico: 'euro', v: function (m) { return m.ca / m.officinesActives; }, g: function (a) { return a.caCl; }, fmt: eur },
  { k: 'nous', nom: 'Notre marge par client', unit: 'par client et par mois', col: 'var(--c-nous)', ico: 'chart', v: function (m) { return m.margeNous / m.officinesActives; }, g: function (a) { return a.mgCl; }, fmt: eur },
  { k: 'liv', nom: 'Livraisons par client', unit: 'par client et par mois', col: 'var(--c-cmd)', ico: 'route', neutre: true, v: function (m) { return m.livraisons / m.officinesActives; }, g: function (a) { return a.livraisons; }, fmt: function (v) { return nf1.format(v) + ' par mois'; } },
  { k: 'mpl', nom: 'Marge par livraison', unit: 'par livraison', col: 'var(--c-nous)', ico: 'box', v: function (m) { return m.margeNous / m.livraisons; }, g: function (a) { return a.margeParLivraison; }, fmt: eur },
  { k: 'apl', nom: 'Marge après livraisons', unit: 'par client et par mois', col: 'var(--c-pharma)', ico: 'check', v: function (m) { return (m.margeNous - m.livraisons * P.reseau.coutLivraison) / m.officinesActives; }, g: function (a) { return a.margeApresLivraison; }, fmt: eur }
];
function libPeriode(r) { if (S.per === 'dernier') return 'octobre 2026'; if (r[0] === r[1]) return PLL[r[0]].toLowerCase(); return PL[r[0]] + ' → ' + PL[r[1]]; }
function libCourt(r) { return S.per === 'dernier' ? 'octobre 2026' : S.per === '3' ? '3 derniers mois' : S.per === 'annee' ? 'l’année' : 'la période'; }
function avant(r) { return S.per === 'dernier' ? 'septembre' : 'la période d’avant'; }
function evo(v, w, av, neutre) {
  if (w == null || !w) return '<span class="evo">Pas de comparaison possible</span>';
  var p = (v - w) / w * 100, egal = Math.abs(p) < .5, ic = neutre ? 'chev' : p < 0 ? 'bas' : 'haut', col = neutre ? 'var(--e-neutre)' : p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)';
  return '<span class="evo"><span class="ico">' + J.icoSvg(ic, col) + '</span>' + (egal ? 'égal à ' + av : '<b>' + J.signe(p) + '</b> qu’en ' + av) + '</span>';
}
function optMois(sel) { var s = ''; for (var i = 12; i >= 0; i--) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + PLL[i] + (i === 12 ? ' (incomplet)' : '') + '</option>'; return s; }
function subMes(k, r, v, ca) {
  if (k === 'nous') return nf2.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'phar') return nf1.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'act') return 'au moins une commande · ' + Math.round(v / (S.sect === 'tous' ? P.reseau.nbOfficines : Math.round(P.reseau.nbOfficines / 8)) * 100) + ' % des officines';
  return 'par officine active';
}
function valPar(d, ms, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.v(ms[i], i); n++; } return s / n; }
function valMoy(d, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.g(P.moyenneIntegral[i]); n++; } return s / n; }
J.panneau = function (titre, html) {
  var p = $('#panneau');
  if (!p) { p = document.createElement('aside'); p.id = 'panneau'; p.className = 'panneau'; p.setAttribute('data-panneau', ''); p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'false'); document.body.appendChild(p); }
  p.innerHTML = '<div class="pn-t"><h2>' + esc(titre) + '</h2><button type="button" class="pil" data-fermer aria-label="Fermer"><span class="ico" data-ico="close"></span>Fermer</button></div><div class="pn-c">' + html + '</div>';
  J.poseIcones(p); p.hidden = false;
  $('[data-fermer]', p).onclick = function () { p.hidden = true; };
  return p;
};
function feuille(k) {
  var d = MES[k], ms = moisDe(S.sect), r = plage(), v = d.f(ms, r), pr = plagePrec(r), w = pr ? d.f(ms, pr) : null, sel = []; for (var i = r[0]; i <= r[1]; i++) sel.push(i);
  var p = J.panneau(d.nom, '<div class="grand-f num">' + J.gros(d.fmt(v)) + '</div><p class="note">' + esc(libPeriode(r)) + '</p>' + evo(v, w, avant(r)) + '<div class="chart-box" id="fe-h"></div><p class="lecteur" id="fe-l">Touchez ou survolez un mois pour le lire.</p><div class="leg"><span><i class="puce" style="background:' + d.col + '"></i>' + esc(libPeriode(r)) + '</span><span><i class="puce" style="background:#C9D3E6"></i>Autres mois</span><span><i class="puce box-in"></i>Mois incomplet</span></div>');
  var textes = ms.map(function (m, i) { return '<b>' + PLL[i] + '</b> : ' + d.fmt(d.s(m)) + (i === 12 ? ' (mois incomplet)' : ''); });
  J.dessine($('#fe-h', p), function (w2) { return J.colonnes({ labels: COURT, vals: ms.map(d.s), sel: sel, incompl: [12], couleur: d.col, h: 200, aria: d.nom }, w2); }, function (b) { J.lie(b, textes, $('#fe-l', p)); });
}
function barresH(lignes, col, fmtv) {
  var mx = Math.max.apply(null, lignes.map(function (l) { return l[1]; }).concat([1]));
  return '<div class="lp-tab">' + lignes.map(function (l) { return '<div class="lp-l"><span class="lp-nom"><b>' + esc(l[0]) + '</b>' + (l[2] ? '<span class="sub">' + esc(l[2]) + '</span>' : '') + '</span><span class="lp-bar"><span class="bar12"><i style="width:' + (Math.max(0, l[1]) / mx * 100).toFixed(1) + '%;background:' + col + '"></i></span><span class="num">' + fmtv(l[1]) + '</span></span></div>'; }).join('') + '</div>';
}
J.renderPilotage = function () {
  var el = $('#ecran-pilotage'), ms = moisDe(S.sect), r = plage(), pr = plagePrec(r);
  var nomSect = S.sect === 'tous' ? 'Tous les secteurs' : (P.secteurs.filter(function (s) { return s.id === S.sect; })[0] || {}).nom;
  var ca = MES.ca.f(ms, r), caP = pr ? MES.ca.f(ms, pr) : null, lp = libPeriode(r), av = avant(r), pc = caP ? Math.round((ca - caP) / caP * 100) : null;
  var lede = 'En ' + lp + ', ' + (S.sect === 'tous' ? 'le réseau Intégral' : 'le secteur de ' + esc(nomSect)) + ' a fait <b>' + eurM(ca) + '</b> de ventes' + (pc == null ? '.' : ', <b>' + Math.abs(pc) + ' % de ' + (pc < 0 ? 'moins' : 'plus') + '</b> qu’en ' + av + '.');
  el.innerHTML =
    '<div class="banniere ban-p"><div class="croix" aria-hidden="true"><i></i><i></i></div><p class="eyebrow">' + (S.sect === 'tous' ? 'Tous les secteurs' : 'Secteur de ' + esc(nomSect)) + ' · ' + esc(lp) + '</p><h1>Pilotage</h1><p class="lede">' + lede + '</p>' +
    '<div class="ban-bas"><div class="ban-afficher"><label class="filtre fl-b">Secteur regardé<select id="p-sect" aria-label="Secteur regardé"><option value="tous">Tous les secteurs</option>' + P.secteurs.map(function (s) { return '<option value="' + s.id + '"' + (S.sect === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="ban-afficher"><div class="seg" role="group" aria-label="Période">' + [['dernier', 'Dernier mois'], ['3', '3 mois'], ['annee', 'Année'], ['choisir', 'Choisir']].map(function (b) { return '<button type="button" data-periode="' + b[0] + '" aria-pressed="' + (S.per === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
    (S.per === 'choisir' ? '<label class="filtre fl-b">Du<select id="p-du" aria-label="Du">' + optMois(S.du) + '</select></label><label class="filtre fl-b">au<select id="p-au" aria-label="au">' + optMois(S.au) + '</select></label>' : '') + '</div></div></div>' +
    '<p class="alerte-n"><span class="ico">' + J.icoSvg('bell', 'var(--e-attention)') + '</span>' + esc(P.noteMoisIncomplet) + '</p>' +
    '<h2 class="titre-s">Les ventes</h2>' +
    '<div class="carte c-hero entre"><div class="hero2" style="--i:0"><div class="h2c"><span class="co-l">Chiffre d’affaires · ' + esc(lp) + '</span><div class="h2n num" id="p-ca">' + J.gros(eurM(ca)) + '</div><p class="note">net hors taxes · ce que les officines ont acheté</p>' + evo(ca, caP, av) + '</div>' +
    '<div class="h2c gris"><span class="co-l">' + (caP == null ? 'Période d’avant' : J.maj(av)) + '</span><div class="h2n num">' + (caP == null ? '—' : J.gros(eurM(caP))) + '</div><p class="note">' + (caP == null ? 'Pas de comparaison possible' : 'la période juste avant, même durée') + '</p></div></div>' +
    '<div class="chart-box" id="p-histo" style="--i:1"></div><p class="lecteur" id="p-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg"><span><i class="puce" style="background:var(--c-ca)"></i>' + esc(lp) + '</span><span><i class="puce" style="background:#C9D3E6"></i>Autres mois</span><span><i class="puce box-in"></i>Mois incomplet</span></div></div>' +
    '<div class="gquatre stack mesures entre" style="margin-top:18px">' + ['nous', 'phar', 'act', 'panier'].map(function (k, q) { var d = MES[k], v = d.f(ms, r), w = pr ? d.f(ms, pr) : null;
      return '<button type="button" class="carte mes" data-mes="' + k + '" style="--i:' + (q + 2) + '"><span class="mes-h"><span class="rond gris"><span class="ico">' + J.icoSvg(d.ico, d.col) + '</span></span><b>' + d.nom + '</b><span class="ico fl">' + J.icoSvg('chev') + '</span></span><span class="mes-v num">' + J.gros(d.fmt(v)) + '</span><span class="sub">' + subMes(k, r, v, ca) + ' · ' + esc(libCourt(r)) + '</span>' + evo(v, w, av) + J.spark(ms.map(d.s), null, 220, 40, d.col, { aria: d.nom + ' sur 13 mois' }) + '</button>'; }).join('') + '</div>' +
    '<div class="carte mol" id="p-mol"></div>' +
    '<h2 class="titre-s">Par client, face à la Moyenne Intégral</h2><div class="carte par-l" id="p-par"></div>' +
    '<div class="detail-b"><button type="button" class="pil plein" data-action="detail">' + (S.detail ? 'Masquer le détail' : 'Voir tout le détail') + '</button><span class="note">Répartitions, classements, produits, marché France, pharmacies à relancer…</span></div><div id="p-detail" ' + (S.detail ? '' : 'hidden') + '></div>';
  J.poseIcones(el);
  var textes = ms.map(function (m, i) { return '<b>' + PLL[i] + '</b> : ' + eurM(m.ca) + (i === 12 ? ' (mois incomplet)' : ''); }), sel = []; for (var i = r[0]; i <= r[1]; i++) sel.push(i);
  J.dessine($('#p-histo'), function (w) { return J.colonnes({ labels: COURT, vals: ms.map(function (m) { return m.ca; }), sel: sel, incompl: [12], couleur: 'var(--c-ca)', h: 200, aria: 'Chiffre d’affaires des 13 derniers mois' }, w); }, function (b) { J.lie(b, textes, $('#p-lect')); });
  J.compter($('#p-ca'), ca, function (v) { return J.gros(eurM(v)); }, 1100);
  molecules(ms, r); remplirPar(ms, r);
  $$('[data-periode]', el).forEach(function (b) { b.onclick = function () { S.per = b.getAttribute('data-periode'); J.renderPilotage(); }; });
  $('#p-sect', el).onchange = function (e) { S.sect = e.target.value; J.renderPilotage(); };
  if ($('#p-du', el)) { $('#p-du', el).onchange = function (e) { S.du = +e.target.value; J.renderPilotage(); }; $('#p-au', el).onchange = function (e) { S.au = +e.target.value; J.renderPilotage(); }; }
  $$('[data-mes]', el).forEach(function (b) { b.onclick = function () { feuille(b.getAttribute('data-mes')); }; });
  $('[data-action="detail"]', el).onclick = function () { S.detail = !S.detail; location.hash = S.detail ? '#pilotage-detail' : '#pilotage'; };
  if (S.detail) detail(ms, r);
};
function molecules(ms, r) {
  var tot = Math.round(moy(ms, r, function (m) { return m.molecules.total; })), ch = Math.round(moy(ms, r, function (m) { return m.molecules.cheres; })), ref = moy(P.reseau.mois, r, function (m) { return m.molecules.total; }) / 8;
  $('#p-mol').innerHTML = '<span class="rond gris"><span class="ico">' + J.icoSvg('box', 'var(--c-cmd)') + '</span></span><div class="mol-t"><h2>Molécules · ' + esc(libPeriode(r)) + '</h2><p class="note">différentes, vendues · dont <b>' + ch + ' chères</b> (468 € et plus)</p></div><div class="mol-v"><b class="num">' + nf.format(tot) + ' <small>molécules</small></b>' +
    (S.sect === 'tous' ? '' : '<span class="evo"><span class="ico">' + J.icoSvg(tot >= ref ? 'haut' : 'bas', tot >= ref ? 'var(--e-bien)' : 'var(--e-alerte)') + '</span>' + nf1.format(tot / ref) + ' fois la moyenne Intégral</span>') + '</div>';
}
function remplirPar(ms, r) {
  $('#p-par').innerHTML = PAR.map(function (d, q) {
    var m = valMoy(d, r), v = S.sect === 'tous' ? null : valPar(d, ms, r), e = v == null ? 0 : ((v - m) / m * 100);
    var sA = ms.map(function (x, i) { return d.v(x, i); }), sB = P.moyenneIntegral.map(d.g);
    return '<div class="par-r"><span class="rond gris"><span class="ico">' + J.icoSvg(d.ico, d.col) + '</span></span><div class="par-t"><b>' + d.nom + '</b><span class="sub">' + d.unit + ' · ' + esc(libPeriode(r)) + '</span><span class="sub">' + (v == null ? 'Moyenne Intégral du réseau' : 'Moyenne Intégral : ' + d.fmt(m)) + '</span></div>' +
      '<div class="par-s">' + J.spark2(v == null ? sB : sA, sB, 240, 46, d.col) + '<span class="sub">par mois, ' + PL[0] + ' → ' + PL[12] + (v == null ? '' : ' · trait gris : Moyenne Intégral') + '</span></div>' +
      '<div class="par-v"><b class="num">' + J.gros(d.fmt(v == null ? m : v)) + '</b>' + (v == null ? '' : '<span class="evo"><span class="ico">' + J.icoSvg(d.neutre ? 'chev' : e < 0 ? 'bas' : 'haut', d.neutre ? 'var(--e-neutre)' : e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span><b>' + J.signe(e) + '</b> face à la Moyenne Intégral</span>') + '</div></div>';
  }).join('');
}
function detail(ms, r) {
  var box = $('#p-detail'), top = S.per === 'dernier' ? P.top10Officines.dernierMois : S.per === '3' ? P.top10Officines.troisMois : P.top10Officines.annee;
  var cl = P.secteurs.map(function (s) { return [s.nom, somme(s.mois, r, 'margeNous'), eurM(somme(s.mois, r, 'ca')) + ' de chiffre d’affaires']; }).sort(function (a, b) { return b[1] - a[1]; });
  var fam = {}, tot = 0, src = S.sect === 'tous' ? P.secteurs : P.secteurs.filter(function (s) { return s.id === S.sect; });
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm || !mm.margeParFamille) continue; mm.margeParFamille.forEach(function (f) { fam[f.nom] = (fam[f.nom] || 0) + Math.max(0, f.euros); tot += Math.max(0, f.euros); }); } });
  var famL = Object.keys(fam).map(function (n) { return [n, fam[n] / (tot || 1) * 100]; });
  var rep = {}, repT = {}, tF = 0, tT = 0;
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm) continue; (mm.repartitionFamille || []).forEach(function (f) { rep[f.nom] = (rep[f.nom] || 0) + f.euros; tF += f.euros; }); (mm.repartitionTranche || []).forEach(function (f) { repT[f.nom] = (repT[f.nom] || 0) + f.euros; tT += f.euros; }); } });
  var gm = P.groupements;
  var pct = function (v) { return nf1.format(v) + ' %'; };
  box.innerHTML = '<div class="stack det">' +
    '<div class="carte"><h2>Marché et opportunités</h2><p class="note">Marché France × vos ventes réseau : où pousser quoi, princeps en stock Intégral.</p><button type="button" class="pil" data-stub="L’écran Marché n’est pas dessiné dans cette maquette.">Ouvrir</button></div>' +
    '<div class="gdeux stack"><div class="carte"><h2>Classement des commerciaux par notre marge · ' + esc(libPeriode(r)) + '</h2>' + barresH(cl, 'var(--c-nous)', eur) + '</div>' +
    '<div class="carte"><h2>Notre marge, famille par famille</h2><p class="note">Chaque pourcentage est une part de notre marge de la période.</p>' + barresH(famL, 'var(--c-nous)', pct) + '<p class="note">Génériques comptés à zéro.</p></div></div>' +
    '<div class="gdeux stack"><div class="carte"><h2>Répartition du chiffre d’affaires par famille</h2>' + barresH(Object.keys(rep).map(function (n) { return [n, rep[n] / tF * 100]; }), 'var(--c-ca)', pct) + '</div>' +
    '<div class="carte"><h2>Répartition par tranche de prix</h2>' + barresH(Object.keys(repT).map(function (n) { return [n, repT[n] / tT * 100]; }), 'var(--c-ca)', pct) + '</div></div>' +
    '<div class="gdeux stack"><div class="carte"><h2>Top 10 des officines · ' + esc(libPeriode(r)) + '</h2>' + barresH(top.map(function (o) { return [o.rang + '. ' + J.joli(o.nom), o.ca, o.ville + ' · marge du pharmacien ' + eur(o.margePharmacien) + ' · notre marge ' + eur(o.margeNous)]; }), 'var(--c-ca)', eur) + '</div>' +
    '<div class="carte"><h2>Chiffre d’affaires et marge par groupement · ' + P.groupementsPeriode + '</h2>' + barresH(gm.map(function (g) { return [g.nom, g.ca, g.officines + ' officines · marge du pharmacien ' + eur(g.margePharmacien)]; }), 'var(--c-ca)', eurM) + '</div></div>' +
    '<div class="carte"><h2>Le gisement · ' + P.gisement.officines + ' officines</h2><p class="note">Ce que la France achète et que vos officines n’ont pas commandé, uniquement ce qu’Intégral a en stock. Classé par euros.</p><div class="jauge"><div class="cb-pist"><i class="cb-b" style="width:' + P.gisement.couverture.part + '%;background:var(--c-ca)"></i></div><span class="num">' + P.gisement.couverture.part + ' % · ' + nf.format(P.gisement.couverture.produitsCommandes) + ' sur ' + nf.format(P.gisement.couverture.produitsMarche) + ' produits du marché commandés au moins une fois</span></div>' +
    barresH(P.gisement.lignes.map(function (g) { return [g.rang + '. ' + g.nom.split(',')[0], g.potentielParAn, g.officinesNeLePrennentPas + ' officines sur ' + g.surOfficines + ' ne le prennent pas · ' + eur(g.prixNetBoite) + ' la boîte']; }), 'var(--c-ca)', function (v) { return eurM(v) + ' par an'; }) + '</div>' +
    '<div class="carte"><h2>Pharmacies en baisse, à relancer</h2><p class="note">3 derniers mois contre les 3 précédents · ' + esc(P.pharmaciesEnBaisse.regle) + '</p><div class="lp-tab">' + P.pharmaciesEnBaisse.lignes.map(function (o) { return '<div class="lp-l"><span class="lp-nom"><b>' + o.rang + '. ' + esc(J.joli(o.nom.replace(/^PHARMACIE\s+/, ''))) + '</b><span class="sub">' + esc(o.ville) + '</span></span><span class="num cat-v"><span class="ico ib">' + J.icoSvg('bas', 'var(--e-alerte)') + '</span>' + eur(o.baisseParMois) + ' par mois · −' + Math.abs(o.pourcent) + ' %</span></div>'; }).join('') + '</div></div>' +
    '<p class="note">Offilog et « Mes produits » : blocs non dessinés dans cette maquette (aucune donnée fictive prévue).</p></div>';
  J.poseIcones(box);
}
})();
