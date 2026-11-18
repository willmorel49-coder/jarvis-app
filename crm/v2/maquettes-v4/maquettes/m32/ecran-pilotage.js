/* Pilotage (#pilotage) et tout le détail (#pilotage-detail) : deux grands chiffres, colonnes sans axes, tuiles à mini-courbe, cinq lignes
   « par client » face à la moyenne Intégral en gris pointillé ; tableaux à filets dans le détail. Ce qui touche notre marge porte data-interne.
   Données : J.P (DONNEES_V4.pilotage), fictives. Aucun chiffre écrit deux fois sur un même écran : la phrase du bandeau porte les écarts, le héros les montants. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, nf2 = J.nf2, P = J.P, S = J.S;
var PS = S.pilotage = { per: 'dernier', sect: 'tous', du: 9, au: 11, detail: false, q: '', rep: 'fam', unite: 'part', gis: 'toutes', mat: null };
var PL = P.moisLibelles, PLL = P.moisLibellesLongs, COURT = PL.map(function (l) { return l.split(' ')[0]; }), INC = [12];
var MOI = P.secteurs[0];   /* le secteur de la personne connectée (avatar CT) : « Mon secteur » */
var DERN = (function () { for (var i = P.couverture.length - 1; i >= 0; i--) if (P.couverture[i].complet) return i; return 11; })();   /* dernier mois complet, lu dans les données : « ventes à jour à fin … » */
/* molécules DISTINCTES : la référence est la moyenne DES secteurs (le total du réseau divisé par 8 serait faux : des molécules différentes ne se répartissent pas) */
function refMol(r, k) { return P.secteurs.reduce(function (a, s) { return a + moy(s.mois, r, function (m) { return m.molecules[k]; }); }, 0) / P.secteurs.length; }
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
function sect(id) { for (var i = 0; i < P.secteurs.length; i++) if (P.secteurs[i].id === id) return P.secteurs[i]; return null; }
function moisDe(id) { var s = sect(id); return s ? s.mois : P.reseau.mois; }
function plage() { if (PS.per === 'dernier') return [11, 11]; if (PS.per === '3') return [9, 11]; if (PS.per === 'annee') return [2, 11]; return [Math.min(PS.du, PS.au), Math.max(PS.du, PS.au)]; }
function plagePrec(r) { var n = r[1] - r[0] + 1, a = r[0] - n; return a < 0 ? null : [a, r[0] - 1]; }
function somme(ms, r, k) { var s = 0; for (var i = r[0]; i <= r[1]; i++) s += typeof k === 'function' ? k(ms[i], i) : ms[i][k]; return s; }
function moy(ms, r, k) { return somme(ms, r, k) / (r[1] - r[0] + 1); }
function nMois(r) { return r[1] - r[0] + 1; }
function lp(r) { return r[0] === r[1] ? PLL[r[0]].toLowerCase() : COURT[r[0]] + ' → ' + PL[r[1]]; }
function moisLong(i) { var m = PLL[i].split(' '); return m[0].toLowerCase() + (m[1] !== '2026' ? ' ' + m[1] : ''); }
function phrasePer(r) { if (r[0] === r[1]) return 'En ' + moisLong(r[0]); var a = moisLong(r[0]), b = PLL[r[1]].toLowerCase(); return (/^[aeiouyâ]/.test(a) ? 'D’' : 'De ') + a + ' à ' + b; }
function quiSect() { return PS.sect === 'tous' ? 'le réseau Intégral' : PS.sect === MOI.id ? 'votre secteur' : 'le secteur de ' + esc(sect(PS.sect).nom); }
function nomSect() { return PS.sect === 'tous' ? 'Tous les secteurs' : PS.sect === MOI.id ? 'Mon secteur' : 'Secteur de ' + esc(sect(PS.sect).nom); }
function pct(v, w) { return w ? (v - w) / w * 100 : null; }
/* écart écrit : mot + icône (la couleur ne sert que l'icône) ; « égal » sous 0,5 % ; neutre pour les livraisons */
function evo(v, w, suite, neutre) {
  if (w == null || !w || !isFinite(v)) return '<span class="evo"><b>—</b>pas de comparaison possible</span>';
  var p = pct(v, w), egal = Math.abs(p) < .5, ic = neutre ? 'chev' : p < 0 ? 'bas' : 'haut', col = neutre ? 'var(--e-neutre)' : p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)';
  return '<span class="evo"><b>' + J.icoSvg(egal ? 'minus' : ic, egal ? 'var(--e-neutre)' : col) + (egal ? 'égal' : J.signe(p)) + '</b>' + esc(suite) + '</span>';
}
var MES = {
  ca: { nom: 'Chiffre d’affaires', col: 'var(--c-ca)', ico: 'euro', f: function (ms, r) { return somme(ms, r, 'ca'); }, s: function (m) { return m.ca; }, fmt: eur, def: 'Net hors taxes : ce que les officines ont acheté au réseau sur la période, avoirs déduits.' },
  nous: { nom: 'Notre marge', interne: true, col: 'var(--c-nous)', ico: 'chart', f: function (ms, r) { return somme(ms, r, 'margeNous'); }, s: function (m) { return m.margeNous; }, fmt: eur, def: 'Ce que les ventes rapportent à Intégral Pharma, génériques comptés à zéro (estimation).' },
  phar: { nom: 'Marge pharmacien générée', col: 'var(--c-pharma)', ico: 'user', f: function (ms, r) { return somme(ms, r, 'margePharmacien'); }, s: function (m) { return m.margePharmacien; }, fmt: eur, def: 'La marge réalisée par les pharmaciens sur les remboursables qu’ils nous ont achetés.' },
  act: { nom: 'Officines actives', col: 'var(--c-cmd)', ico: 'check', f: function (ms, r) { return Math.round(moy(ms, r, 'officinesActives')); }, s: function (m) { return m.officinesActives; }, fmt: function (v) { return nf.format(v); }, unite: 'officines', def: 'Officines avec au moins une commande dans le mois ; sur plusieurs mois, la moyenne mensuelle.' },
  panier: { nom: 'Panier moyen', col: 'var(--c-ca)', ico: 'box', f: function (ms, r) { return somme(ms, r, 'ca') / Math.max(1, somme(ms, r, 'officinesActives')); }, s: function (m) { return m.ca / Math.max(1, m.officinesActives); }, fmt: eur, def: 'Chiffre d’affaires divisé par le nombre d’officines actives : ce qu’une officine active achète en moyenne.' }
};
var PAR = [
  { k: 'pca', nom: 'Chiffre d’affaires par client', unit: 'par client et par mois', col: 'var(--c-ca)', ico: 'euro', v: function (m) { return m.ca / m.officinesActives; }, g: function (a) { return a.caCl; }, fmt: eur, def: 'Ce qu’un client achète en moyenne chaque mois.' },
  { k: 'pnous', nom: 'Notre marge par client', interne: true, unit: 'par client et par mois', col: 'var(--c-nous)', ico: 'chart', v: function (m) { return m.margeNous / m.officinesActives; }, g: function (a) { return a.mgCl; }, fmt: eur, def: 'Ce qu’un client rapporte en moyenne à Intégral chaque mois.' },
  { k: 'pliv', nom: 'Livraisons par client', unit: 'par client et par mois', col: 'var(--c-cmd)', ico: 'route', neutre: true, v: function (m) { return m.livraisons / m.officinesActives; }, g: function (a) { return a.livraisons; }, fmt: function (v) { return nf1.format(v) + ' par mois'; }, def: 'Nombre de livraisons reçues par un client chaque mois. Plus de livraisons n’est ni bien ni mal.' },
  { k: 'pmpl', nom: 'Marge par livraison', interne: true, unit: 'par livraison', col: 'var(--c-nous)', ico: 'truck', v: function (m) { return m.margeNous / m.livraisons; }, g: function (a) { return a.margeParLivraison; }, fmt: eur, def: 'Notre marge divisée par le nombre de livraisons.' },
  { k: 'papl', nom: 'Marge après livraisons', interne: true, unit: 'par client et par mois', col: 'var(--c-pharma)', ico: 'check', v: function (m) { return (m.margeNous - m.livraisons * P.reseau.coutLivraison) / m.officinesActives; }, g: function (a) { return a.margeApresLivraison; }, fmt: eur, def: 'Notre marge moins le coût des livraisons (' + eur(P.reseau.coutLivraison) + ' l’une), par client et par mois.' }
];
function valPar(d, ms, r) { return moy(ms, r, function (m) { return d.v(m); }); }
function valMoy(d, r) { return moy(P.moyenneIntegral, r, function (a) { return d.g(a); }); }
function sousMes(k, r, v, ca) {
  if (k === 'nous') return nf2.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'phar') return nf1.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'act') return (nMois(r) > 1 ? 'en moyenne par mois · ' : '') + 'au moins une commande' + (PS.sect === 'tous' ? ' · ' + Math.round(v / P.reseau.nbOfficines * 100) + ' % des ' + nf.format(P.reseau.nbOfficines) + ' officines du réseau' : '');
  return 'par officine active · ' + lp(r);
}
function optMois(sel) { var s = ''; for (var i = 12; i >= 0; i--) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + PLL[i] + (i === 12 ? ' (incomplet)' : '') + '</option>'; return s; }
function fois(v, m) { return m > 0 && isFinite(v) ? '<span class="fois">× ' + (v / m >= 10 ? nf.format(v / m) : nf1.format(v / m)) + ' la moyenne Intégral</span>' : ''; }
/* ---------- le bandeau : secteur regardé, phrase-réponse (les écarts), recherche, périodes ---------- */
function bandeau(ms, r, pr) {
  var ca = MES.ca.f(ms, r), caP = pr ? MES.ca.f(ms, pr) : null, p = caP ? pct(ca, caP) : null, av = pr ? (pr[0] === pr[1] ? moisLong(pr[0]) : lp(pr)) : '';
  var lede = phrasePer(r) + ', ' + quiSect() + (p == null ? ' a vendu sur <b>' + nMois(r) + ' mois</b> ; aucune période d’avant de même durée dans les ventes chargées (depuis ' + PLL[0].toLowerCase() + ').' :
    Math.abs(p) < .5 ? ' a vendu <b>autant</b> qu’en ' + esc(av) + '.' : ' a vendu <b>' + nf.format(Math.abs(Math.round(p))) + ' % de ' + (p < 0 ? 'moins' : 'plus') + '</b> qu’' + (/^[aeiouyâ]/.test(av) ? 'en ' : 'en ') + esc(av) + '.');
  if (PS.sect !== 'tous') { var e = pct(valPar(PAR[0], ms, r), valMoy(PAR[0], r)); lede += ' Par client, c’est <b>' + nf.format(Math.abs(Math.round(e))) + ' % de ' + (e < 0 ? 'moins' : 'plus') + '</b> que la moyenne Intégral.'; }
  var periodes = [['dernier', 'Dernier mois'], ['3', '3 mois'], ['annee', 'Année'], ['choisir', 'Choisir']].map(function (b) { return '<button type="button" data-periode="' + b[0] + '" aria-pressed="' + (PS.per === b[0]) + '">' + b[1] + '</button>'; }).join('');
  return J.bandeau({ croix: true, classe: 'pi-ban', eyebrow: nomSect() + ' · ' + esc(lp(r)) + '<span class="long"> · ventes à jour à fin ' + PLL[DERN].toLowerCase() + '</span>', titre: 'Pilotage', lede: lede,
    actions: '<button type="button" class="pil" data-stub="' + STUB('Exporter ce tableau de bord en PDF') + '">' + J.ico('doc') + 'Exporter en PDF</button>',
    recherche: { id: 'pi-q', placeholder: 'Une officine, un commercial, un groupement, un produit du gisement…', aria: 'Rechercher dans le détail du Pilotage', valeur: PS.q },
    bas: '<label class="filtre">Secteur regardé<select id="pi-sect" aria-label="Secteur regardé"><option value="tous">Tous les secteurs</option>' + P.secteurs.map(function (s) { return '<option value="' + s.id + '"' + (PS.sect === s.id ? ' selected' : '') + '>' + (s.id === MOI.id ? 'Mon secteur' : esc(s.nom)) + ' · ' + esc(s.zone) + '</option>'; }).join('') + '</select></label>' +
      '<span class="lbl">Période :</span><div class="seg" role="group" aria-label="Période">' + periodes + '</div>' +
      (PS.per === 'choisir' ? '<label class="filtre">Du<select id="pi-du" aria-label="Du">' + optMois(PS.du) + '</select></label><label class="filtre">au<select id="pi-au" aria-label="au">' + optMois(PS.au) + '</select></label>' : '') });
}
/* ---------- le héros : deux grands chiffres (période, période d'avant en gris) et les colonnes sans axes des 13 mois ---------- */
function hero(ms, r, pr) {
  var ca = MES.ca.f(ms, r), caP = pr ? MES.ca.f(ms, pr) : null;
  return '<section class="carte pi-hero" aria-label="Chiffre d’affaires"><div class="pi-h2 entre">' +
    '<div class="pi-hc" style="--i:0"><span class="pi-cl">Chiffre d’affaires · ' + esc(lp(r)) + '</span><div class="pi-hn num" id="pi-ca" data-ca="' + ca + '">' + J.gros(eur(ca)) + '</div><p class="note">net hors taxes · ce que les officines ont acheté' + (incomplet(r) ? ' · <b>mois incomplet compris</b>' : '') + '</p></div>' +
    '<div class="pi-hc gris" style="--i:1"><span class="pi-cl">' + (pr ? 'Période d’avant · ' + esc(lp(pr)) : 'Période d’avant') + '</span><div class="pi-hn num">' + (caP == null ? '—' : J.gros(eur(caP))) + '</div><p class="note">' + (caP == null ? 'pas de période de même durée avant ' + esc(moisLong(r[0])) : 'la période juste avant, même durée') + '</p>' +
    (caP == null ? '' : '<span class="evo pi-ecart">' + J.icoSvg(ca < caP ? 'bas' : 'haut', ca < caP ? 'var(--e-alerte)' : 'var(--e-bien)') + '<b>' + (ca < caP ? '−' : '+') + eur(Math.abs(ca - caP)) + '</b> d’écart</span>') + '</div></div>' +
    '<div class="chart-box pi-histo" id="pi-histo"></div><p class="lecteur" id="pi-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>' +
    '<div class="leg"><span><i class="puce" style="background:var(--c-ca)"></i>' + esc(lp(r)) + '</span><span><i class="puce" style="background:#C9D3E6"></i>Autres mois</span><span><i class="pi-pointille"></i>Mois incomplet</span></div>' + reperes(ms) + '</section>';
}
/* repères sous les colonnes : la moyenne des mois complets (montant écrit nulle part ailleurs) et le meilleur mois — son nom seulement,
   son montant pouvant déjà être le grand chiffre ou la période d'avant (règle « aucun chiffre deux fois ») */
function reperes(ms) {
  var comp = ms.map(function (m, i) { return P.couverture[i] && P.couverture[i].complet ? m.ca : null; }), vals = comp.filter(function (x) { return x != null; }); if (!vals.length) return '';
  var moyC = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, iMax = comp.indexOf(Math.max.apply(null, vals));
  return '<p class="note pi-repl">Repères · moyenne des <b>' + vals.length + ' mois complets</b> : <b class="num">' + eur(moyC) + '</b> · meilleur mois : <b>' + esc(moisLong(iMax)) + '</b></p>';
}
function incomplet(r) { return r[1] >= 12; }
/* les mini-courbes s'arrêtent au dernier mois complet : un mois de queue incomplet dessinerait une fausse chute */
function complets(arr) { return arr.filter(function (_, i) { return !P.couverture[i] || P.couverture[i].complet; }); }
var N_COMPLETS = complets(PL).length;
function tuile(k, ms, r, pr, i, ca) {
  var d = MES[k], v = d.f(ms, r), w = pr ? d.f(ms, pr) : null, av = pr ? (pr[0] === pr[1] ? moisLong(pr[0]) : lp(pr)) : '';
  return '<button type="button" class="stat pi-mes" data-mes="' + k + '"' + (d.interne ? ' data-interne' : '') + ' style="--i:' + i + '"><div class="lib"><span class="puce" style="background:' + d.col + '"></span>' + d.nom + '<span class="ico pi-chev">' + J.icoSvg('chev') + '</span></div>' +
    '<div class="val num">' + J.gros(d.fmt(v)) + (d.unite ? ' <small>' + d.unite + '</small>' : '') + '</div><p class="note">' + sousMes(k, r, v, ca) + '</p>' +
    '<div class="bas">' + J.spark(complets(ms).map(d.s), 0, 150, 40, d.col, { aria: d.nom + ' sur ' + N_COMPLETS + ' mois complets' }) + evo(v, w, pr ? 'qu’en ' + av : '') + '</div></button>';
}
function molecules(ms, r) {
  var tot = Math.round(moy(ms, r, function (m) { return m.molecules.total; })), ch = Math.round(moy(ms, r, function (m) { return m.molecules.cheres; })), ref = refMol(r, 'total');
  return '<button type="button" class="carte pi-mol" data-mes="mol" style="--i:6"><span class="rond gris">' + J.ico('pill', 'var(--c-cmd)') + '</span><div class="pi-molt"><h2>Molécules · ' + esc(lp(r)) + '</h2><p class="note">différentes, vendues' + (nMois(r) > 1 ? ', en moyenne par mois' : '') + ' · dont <b>' + nf.format(ch) + ' chères</b> (468 € la boîte et plus)</p></div>' +
    '<div class="pi-molv"><b class="num">' + nf.format(tot) + ' <small>molécules</small></b>' + (PS.sect === 'tous' ? '<span class="fois">moyenne par secteur : ' + nf.format(Math.round(ref)) + '</span>' : fois(tot, ref)) + '</div><span class="ico pi-chev">' + J.icoSvg('chev') + '</span></button>';
}
function parClient(ms, r) {
  var tous = PS.sect === 'tous';
  /* en vue « Tous », la ligne compare MON secteur à la moyenne Intégral : la 1re ligne écrit alors le montant de mon secteur (le panier moyen ci-dessus est
     celui du réseau et n'est pas réécrit). En vue secteur, la 1re ligne EST le panier moyen déjà écrit plus haut : elle n'écrit que la moyenne Intégral et le rapport. */
  return '<section class="carte pi-par" aria-label="Par client, face à la moyenne Intégral">' + PAR.map(function (d, q) {
    var m = valMoy(d, r), src = tous ? MOI.mois : ms, v = valPar(d, src, r), sA = src.map(function (x) { return d.v(x); }), sB = P.moyenneIntegral.map(d.g), qui = tous ? 'Mon secteur' : nomSect(), pca = d.k === 'pca' && !tous, ratio = m > 0 ? v / m : null;
    return '<button type="button" class="pi-r" data-mes="' + d.k + '"' + (d.interne ? ' data-interne' : '') + ' style="--i:' + (q + 7) + '"><span class="rond gris">' + J.ico(d.ico, d.col) + '</span>' +
      '<span class="pi-rt"><b>' + d.nom + '</b><span class="sub">' + qui + ' · ' + d.unit + ' · ' + esc(lp(r)) + '</span><span class="sub">' + (pca ? 'Moyenne Intégral : <b class="num">' + d.fmt(m) + '</b> · c’est le panier moyen (ci-dessus), face à celui des clients actifs du réseau' : d.k === 'pca' ? 'face au panier moyen des clients actifs du réseau (ci-dessus)' : 'Moyenne Intégral : <b class="num">' + d.fmt(m) + '</b>') + '</span></span>' +
      '<span class="pi-rs">' + J.spark2(complets(sA), complets(sB), 240, 46, d.col) + '<span class="sub">par mois, ' + COURT[0] + ' ' + PL[0].split(' ')[1] + ' → ' + complets(PL).pop() + ' · trait gris pointillé : moyenne Intégral</span></span>' +
      '<span class="pi-rv"><b class="num">' + (pca ? (ratio == null ? '—' : '× ' + nf1.format(ratio)) : J.gros(d.fmt(v))) + '</b><span class="evo">' + J.icoSvg(d.neutre ? 'chev' : v < m ? 'bas' : 'haut', d.neutre ? 'var(--e-neutre)' : v < m ? 'var(--e-alerte)' : 'var(--e-bien)') + (pca ? '<span class="fois">la moyenne Intégral</span>' : fois(v, m)) + '</span></span><span class="ico pi-chev">' + J.icoSvg('chev') + '</span></button>';
  }).join('') + '</section>';
}
J.pi = { PS: PS, MES: MES, PAR: PAR, sect: sect, moisDe: moisDe, plage: plage, plagePrec: plagePrec, somme: somme, moy: moy, lp: lp, moisLong: moisLong, evo: evo, valPar: valPar, valMoy: valMoy, COURT: COURT, PLL: PLL, PL: PL, INC: INC, MOI: MOI, STUB: STUB, nMois: nMois, fois: fois, pct: pct };
J.pi.bandeau = bandeau; J.pi.hero = hero; J.pi.refMol = refMol; J.pi.tuile = tuile; J.pi.molecules = molecules; J.pi.parClient = parClient; J.pi.nomSect = nomSect; J.pi.incomplet = incomplet;
})();
/* ====================================================================================================================
   LE RENDU DE L'ÉCRAN (J.ecrans.pilotage) et la FEUILLE d'une mesure (panneau à droite, feuille basse au téléphone ; fermeture croix, voile, Échap).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, P = J.P, pi = J.pi, PS = pi.PS, MES = pi.MES, PAR = pi.PAR, COURT = pi.COURT, PLL = pi.PLL;
var ecouteClavier = false;
J.ecrans.pilotage = {
  rendre: function (el, etat) {
    PS.detail = etat.suite === 'detail';
    var ms = pi.moisDe(PS.sect), r = pi.plage(), pr = pi.plagePrec(r), ca = MES.ca.f(ms, r), sel = []; for (var i = r[0]; i <= r[1]; i++) sel.push(i);
    el.innerHTML = '<div class="page">' + pi.bandeau(ms, r, pr) +
      '<p class="pi-note">' + J.ico('bell', 'var(--e-attention)') + '<span>' + esc(P.noteMoisIncomplet) + '</span></p>' +
      '<h2 class="titre-s pi-ts">Les ventes<span class="st">' + pi.nomSect() + ' · ' + esc(pi.lp(r)) + '</span></h2>' + pi.hero(ms, r, pr) +
      '<div class="pi-tuiles entre">' + ['nous', 'phar', 'act', 'panier'].map(function (k, q) { return pi.tuile(k, ms, r, pr, q + 2, ca); }).join('') + '</div>' + pi.molecules(ms, r) +
      '<h2 class="titre-s pi-ts">Par client, face à la moyenne Intégral<span class="st">par client et par mois · la moyenne Intégral est celle des ' + (PS.sect === 'tous' ? 'clients actifs du réseau, comptés dans la tuile Officines actives' : '<b>' + nf.format(P.moyenneIntegral[r[1]].clientsActifs) + ' clients actifs</b> du réseau') + '</span></h2>' + pi.parClient(ms, r) +
      '<div class="pi-detb"><button type="button" class="pil plein" data-action="detail">' + J.ico(PS.detail ? 'chevb' : 'chev') + (PS.detail ? 'Masquer le détail' : 'Voir tout le détail') + '</button><span class="note">Répartitions, classements, produits, marché France, pharmacies à relancer…</span></div>' +
      '<div id="pi-detail"></div></div><div class="pi-voile" id="pi-voile" hidden></div><aside class="pi-feuille" id="pi-feuille" role="dialog" aria-modal="true" aria-label="Détail d’une mesure" hidden></aside>';
    J.poseIcones(el);
    if (PS.focusQ) { PS.focusQ = false; var q0 = $('#pi-q', el); if (q0) { q0.focus(); try { q0.setSelectionRange(q0.value.length, q0.value.length); } catch (x) {} } }   /* la 1re lettre tapée ouvre le détail (écran reconstruit) : le champ garde le curseur */
    var textes = ms.map(function (m, i) { return '<b>' + PLL[i] + '</b> : ' + eur(m.ca) + ' · ' + nf.format(m.officinesActives) + ' officines actives' + (i === 12 ? ' · <b>mois incomplet</b>' : ''); });
    J.dessine($('#pi-histo', el), function (w) { return J.colonnes({ labels: w < 520 ? COURT.map(function (c, i) { return i % 2 ? c : ''; }) : COURT, vals: ms.map(function (m) { return m.ca; }), sel: sel, incompl: pi.INC, couleur: 'var(--c-ca)', h: w < 520 ? 170 : 210, aria: 'Chiffre d’affaires des 13 derniers mois' }, w); }, function (b) { J.lie(b, textes, $('#pi-lect', el)); });
    J.compter($('#pi-ca', el), ca, function (v) { return J.gros(eur(v)); }, 1100);
    var relancer = function () { J.aller(PS.detail ? 'pilotage-detail' : 'pilotage'); };
    $$('[data-periode]', el).forEach(function (b) { b.onclick = function () { PS.per = b.getAttribute('data-periode'); relancer(); }; });
    $('#pi-sect', el).onchange = function (e) { PS.sect = e.target.value; relancer(); };
    if ($('#pi-du', el)) { $('#pi-du', el).onchange = function (e) { PS.du = +e.target.value; relancer(); }; $('#pi-au', el).onchange = function (e) { PS.au = +e.target.value; relancer(); }; }
    $('#pi-q', el).oninput = function (e) { PS.q = e.target.value; if (PS.q && !PS.detail) { PS.focusQ = true; J.aller('pilotage-detail'); } else filtrer(el); };
    $$('[data-mes]', el).forEach(function (b) { b.onclick = function () { feuille(el, b.getAttribute('data-mes')); }; });
    $('[data-action="detail"]', el).onclick = function () { J.aller(PS.detail ? 'pilotage' : 'pilotage-detail'); };
    $('#pi-voile', el).onclick = function () { fermer(el); };
    if (!ecouteClavier) { ecouteClavier = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer($('#ecran-pilotage')); }); }
    if (PS.detail && J.pi.detail) { J.pi.detail($('#pi-detail', el), ms, r, pr); filtrer(el); }
  }
};
/* recherche du bandeau : filtre les lignes [data-q] des tableaux du détail */
function filtrer(el) {
  var q = (PS.q || '').toLowerCase().trim(), n = 0;
  $$('[data-q]', el).forEach(function (tr) { var ok = !q || tr.getAttribute('data-q').indexOf(q) >= 0; tr.hidden = !ok; if (ok) n++; });
  var c = $('#pi-qcpt', el); if (c) { c.hidden = !q; c.innerHTML = q ? '<b>' + n + '</b> ligne' + (n > 1 ? 's' : '') + ' du détail contien' + (n > 1 ? 'nent' : 't') + ' « ' + esc(PS.q) + ' »' : ''; }
}
J.pi.filtrer = filtrer;
function fermer(el) { if (!el) return; var f = $('#pi-feuille', el), v = $('#pi-voile', el); if (f) f.hidden = true; if (v) v.hidden = true; }
function cmp(lib, col, v, m, fmt) { var top = Math.max(v, m) * 1.04; return '<div class="pi-cmp"><div class="pi-cmpl"><span><span class="puce" style="background:' + col + '"></span>' + lib + '</span><b class="num">' + fmt(v) + '</b></div><div class="pi-cmpb"><i style="width:' + (v / top * 100).toFixed(1) + '%;background:' + col + '"></i></div>' +
  '<div class="pi-cmpl"><span><span class="puce" style="background:var(--c-moyenne)"></span>Moyenne Intégral</span><b class="num">' + fmt(m) + '</b></div><div class="pi-cmpb"><i style="width:' + (m / top * 100).toFixed(1) + '%;background:var(--c-moyenne)"></i></div></div>'; }
function feuille(el, k) {
  var f = $('#pi-feuille', el), v = $('#pi-voile', el), ms = pi.moisDe(PS.sect), r = pi.plage(), pr = pi.plagePrec(r), av = pr ? (pr[0] === pr[1] ? pi.moisLong(pr[0]) : pi.lp(pr)) : '', sel = []; for (var i = r[0]; i <= r[1]; i++) sel.push(i);
  var html = '', apres = null, titre, eyebrow = pi.nomSect() + ' · ' + esc(pi.lp(r));
  if (k === 'mol') {
    var tot = Math.round(pi.moy(ms, r, function (m) { return m.molecules.total; })), ch = Math.round(pi.moy(ms, r, function (m) { return m.molecules.cheres; })), refT = pi.refMol(r, 'total'), refC = pi.refMol(r, 'cheres');
    titre = 'Molécules'; var L = P.moleculesCheres;
    html = '<div class="pi-fduo"><div><span class="pi-cl">Molécules vendues</span><div class="pi-fg num">' + nf.format(tot) + '</div></div><div><span class="pi-cl">Dont chères</span><div class="pi-fg num">' + nf.format(ch) + '</div></div></div>' +
      '<p class="note">' + esc(pi.lp(r)) + ' · moyenne Intégral : <b>' + nf.format(Math.round(refT)) + ' molécules</b>, dont <b>' + nf.format(Math.round(refC)) + ' chères</b>, par secteur' + (PS.sect === 'tous' ? '' : ' · ' + pi.fois(tot, refT)) + '</p>' +
      '<p class="note">Une molécule est « chère » dès qu’une de ses boîtes est vendue à 468 € ou plus (prix net). Les produits sans molécule (surtout de la parapharmacie) ne sont pas comptés.</p>' +
      '<h3>Les molécules chères</h3><div class="tabl-wrap"><table class="tabl pi-tmol"><thead><tr><th>Molécule</th><th class="num">Boîtes</th><th class="num">Chiffre d’affaires</th><th class="num">Officines</th><th class="num">Prix de la boîte</th></tr></thead><tbody>' +
      L.map(function (m, q) { return '<tr' + (q >= 6 ? ' class="pi-plus" hidden' : '') + '><td><b>' + esc(m.nom) + '</b></td><td class="num">' + nf.format(m.boites) + '</td><td class="num"><b>' + eur(m.ca) + '</b></td><td class="num">' + nf.format(m.officines) + '</td><td class="num">' + eur(m.prixBoite) + (m.prixBoite > 3000 ? '<span class="fois">plus de 3 000 €</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="pi-fact"><button type="button" class="pil" data-voirplus>Voir les ' + (L.length - 6) + ' autres molécules chères</button><button type="button" class="pil" data-stub="' + pi.STUB('Voir toutes les molécules') + '">Voir toutes les molécules</button></div>';
    apres = function () { var b = $('[data-voirplus]', f); if (b) b.onclick = function () { $$('.pi-plus', f).forEach(function (tr) { tr.hidden = false; }); b.hidden = true; }; };
  } else if (MES[k]) {
    var d = MES[k], val = d.f(ms, r), w = pr ? d.f(ms, pr) : null; titre = d.nom;
    html = '<div class="pi-fg num">' + J.gros(d.fmt(val)) + (d.unite ? ' <small>' + d.unite + '</small>' : '') + '</div><p class="note">' + esc(pi.lp(r)) + ' · ' + (k === 'act' ? 'au moins une commande' : k === 'panier' ? 'par officine active' : 'net hors taxes') + '</p>' + pi.evo(val, w, pr ? 'qu’en ' + av : '') +
      '<div class="chart-box" id="pi-fh"></div><p class="lecteur" id="pi-fl" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg"><span><i class="puce" style="background:' + d.col + '"></i>' + esc(pi.lp(r)) + '</span><span><i class="puce" style="background:#C9D3E6"></i>Autres mois</span><span><i class="pi-pointille"></i>Mois incomplet</span></div><p class="note pi-def">' + d.def + '</p>';
    apres = function () { var t = ms.map(function (m, q) { return '<b>' + PLL[q] + '</b> : ' + d.fmt(d.s(m)) + (q === 12 ? ' · <b>mois incomplet</b>' : ''); });
      J.dessine($('#pi-fh', f), function (wd) { return J.colonnes({ labels: COURT.map(function (c) { return c.slice(0, 3); }), vals: ms.map(d.s), sel: sel, incompl: pi.INC, couleur: d.col, h: 190, aria: d.nom }, wd); }, function (b) { J.lie(b, t, $('#pi-fl', f)); }); };
  } else {
    var p = PAR.filter(function (x) { return x.k === k; })[0]; if (!p) return; titre = p.nom;
    var tous = PS.sect === 'tous', m = pi.valMoy(p, r), vs = tous ? pi.valPar(p, pi.MOI.mois, r) : pi.valPar(p, ms, r), sA = (tous ? pi.MOI.mois : ms).map(function (x) { return p.v(x); }), sB = P.moyenneIntegral.map(p.g), nomS = tous ? 'Mon secteur' : pi.nomSect();
    html = '<div class="pi-fg num">' + J.gros(p.fmt(vs)) + '</div><p class="note">' + nomS + ' · ' + esc(pi.lp(r)) + ' · ' + p.unit + '</p><span class="evo">' + J.icoSvg(p.neutre ? 'chev' : vs < m ? 'bas' : 'haut', p.neutre ? 'var(--e-neutre)' : vs < m ? 'var(--e-alerte)' : 'var(--e-bien)') + pi.fois(vs, m) + '</span>' +
      '<div class="chart-box" id="pi-fh"></div><p class="lecteur" id="pi-fl" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg"><span><i class="puce" style="background:' + p.col + '"></i>' + nomS + '</span><span><i class="trait"></i>Moyenne Intégral</span></div>' +
      '<h3>' + nomS + ' face à la moyenne · ' + esc(pi.lp(r)) + '</h3>' + cmp(nomS, p.col, vs, m, p.fmt) + '<p class="note pi-def">' + p.def + '</p>';
    apres = function () { var t = sA.map(function (x, q) { return '<b>' + PLL[q] + '</b> : ' + p.fmt(x) + ' · moyenne Intégral ' + p.fmt(sB[q]) + (q === 12 ? ' · <b>mois incomplet</b>' : ''); });
      J.dessine($('#pi-fh', f), function (wd) { var s = J.courbe({ labels: COURT.map(function (c) { return c.slice(0, 3); }), a: { vals: sA, col: p.col }, b: { vals: sB, col: 'var(--c-moyenne)' }, fmt: p.fmt, h: 230, points: [], aria: p.nom, id: 'pf' }, wd); return s.replace('stroke="var(--c-moyenne)" stroke-width="2.4"', 'stroke="var(--c-moyenne)" stroke-width="1.8" stroke-dasharray="6 4"').replace(/<text [^>]*text-anchor="end" fill="var\(--enc-3\)">[^<]*<\/text>/g, ''); }   /* sans axe chiffré : le grand chiffre et le lecteur donnent les valeurs */, function (b) { J.lie(b, t, $('#pi-fl', f)); }); };
  }
  f.innerHTML = '<div class="pi-ft"><div><p class="eyebrow">' + eyebrow + '</p><h2>' + titre + '</h2></div><button type="button" class="b-rond" data-fermer aria-label="Fermer">' + J.ico('close') + '</button></div>' + html;
  J.poseIcones(f); f.hidden = false; v.hidden = false; f.scrollTop = 0;
  $('[data-fermer]', f).onclick = function () { fermer(el); }; $('[data-fermer]', f).focus();
  if (apres) apres();
}
})();
/* ====================================================================================================================
   TOUT LE DÉTAIL (#pilotage-detail) : tableaux à filets, libellés gris, valeurs en encre ; les graphiques (mini-colonnes des
   répartitions, barres fines) sont VISIBLES sans clic. Blocs, dans l'ordre : Marché et opportunités · Notre marge par famille et
   classement des commerciaux (internes) · Répartition famille / tranche · Mes produits (matrice secteur × tranche) · Top 10 et groupements ·
   Le marché France et Offilog (renvois) · Le gisement · Pharmacies en baisse. L'évolution des 13 mois est déjà en haut de la page : pas de redite.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, P = J.P, pi = J.pi, PS = pi.PS, COURT = pi.COURT, PLL = pi.PLL, STUB = pi.STUB;
var pct = function (v) { return nf1.format(v) + ' %'; };
var NOMT = { petitsPrix: 'Petits prix', intermediaires: 'Intermédiaires', chers: 'Chers', tresChers: 'Très chers' };
function secteurs() { return PS.sect === 'tous' ? P.secteurs : P.secteurs.filter(function (s) { return s.id === PS.sect; }); }
/* agrège une liste {cle, nom, euros, boites} (famille ou tranche) sur des secteurs et les mois de la période ; part = part des euros */
function agr(liste, r, champ) {
  var acc = {}, ordre = [], tot = 0;
  liste.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var m = s.mois[i]; if (!m || !m[champ]) continue; m[champ].forEach(function (f) { if (!acc[f.cle]) { acc[f.cle] = { cle: f.cle, nom: f.nom, euros: 0, boites: 0 }; ordre.push(f.cle); } var e = Math.max(0, f.euros); acc[f.cle].euros += e; acc[f.cle].boites += f.boites; tot += e; }); } });
  return ordre.map(function (k) { var a = acc[k]; a.part = tot ? a.euros / tot * 100 : 0; return a; });
}
function serie(liste, champ, cle, unite) {
  var out = []; for (var i = 0; i < 13; i++) { var e = 0, b = 0, t = 0; liste.forEach(function (s) { var m = s.mois[i]; if (!m || !m[champ]) return; m[champ].forEach(function (f) { var x = Math.max(0, f.euros); t += x; if (f.cle === cle) { e += x; b += f.boites; } }); }); out.push(unite === 'part' ? (t ? e / t * 100 : 0) : unite === 'euros' ? e : b); }
  return out;
}
function bar(v, mx, col) { return '<span class="bar12"><i style="width:' + (mx > 0 ? Math.max(0, v) / mx * 100 : 0).toFixed(1) + '%;background:' + col + '"></i></span>'; }
function td(l, html, cls) { return '<td data-l="' + esc(l) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</td>'; }
function tete(titre, sous, droite) { return '<div class="tete"><div><h2>' + titre + '</h2>' + (sous ? '<p class="st">' + sous + '</p>' : '') + '</div>' + (droite || '') + '</div>'; }
function rang(i) { return '<span class="pi-rang">' + i + '</span>'; }
function renvoi(titre, sous, ico, adr, bouton) { return '<section class="carte pi-renvoi"><span class="rond gris">' + J.ico(ico) + '</span><div><h2>' + titre + '</h2><p class="st">' + sous + '</p></div><a class="pil" href="#' + adr + '">' + bouton + J.ico('chev') + '</a></section>'; }
function ligneOff(id, nom, sous) { return '<tr class="pi-lien" data-off="' + id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(J.joli(nom)) + '" data-q="' + esc((nom + ' ' + sous).toLowerCase()) + '">'; }
function seg(attr, choix, actif, aria) { return '<div class="seg" role="group" aria-label="' + aria + '">' + choix.map(function (c) { return '<button type="button" ' + attr + '="' + c[0] + '" aria-pressed="' + (actif === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>'; }
pi.detail = function (box, ms, r, pr) {
  var lp = esc(pi.lp(r)), tous = PS.sect === 'tous', L = secteurs(), nomS = pi.nomSect();
  var html = '<p class="pi-qcpt" id="pi-qcpt" hidden></p><h2 class="titre-s pi-ts">Tout le détail<span class="st">' + nomS + ' · ' + lp + ' · l’évolution mois par mois est en haut de la page (Les ventes)</span></h2><div class="pi-det">';
  /* 1. Marché et opportunités (renvoi vers l'écran Le marché) */
  html += renvoi('Marché et opportunités', 'Marché France × vos ventes réseau : où pousser quoi, princeps en stock Intégral.', 'chart', 'marche', 'Ouvrir');
  /* 2. Notre marge, famille par famille (interne) + classement des commerciaux par notre marge (interne, vue Tous) */
  var fam = agr(L, r, 'margeParFamille'), famP = fam.filter(function (f) { return f.euros > 0; }), gen = fam.filter(function (f) { return f.cle === 'generiques'; })[0], mxF = Math.max.apply(null, famP.map(function (f) { return f.euros; }).concat([1]));
  html += '<div class="pi-deux"><section class="carte" data-interne>' + tete('Notre marge, famille par famille', nomS + ' · ' + lp + ' · chaque pourcentage est une part de notre marge de la période · génériques comptés à zéro') +
    '<table class="tabl pi-empile"><thead><tr><th>Famille de produits</th><th class="num">Part de notre marge</th><th class="num">Notre marge</th><th class="num">Boîtes</th></tr></thead><tbody>' +
    famP.map(function (f) { return '<tr data-q="' + esc(f.nom.toLowerCase()) + '">' + td('Famille', '<b>' + esc(f.nom) + '</b>') + td('Part de notre marge', '<span class="pi-bar">' + bar(f.euros, mxF, 'var(--c-nous)') + '<b>' + pct(f.part) + '</b></span>', 'num') + td('Notre marge', eur(f.euros), 'num') + td('Boîtes', nf.format(f.boites), 'num') + '</tr>'; }).join('') + '</tbody></table>' +
    (gen ? '<p class="note">Génériques : ' + nf.format(gen.boites) + ' boîtes vendues sur la période, comptées à zéro dans notre marge (estimation, règle forfaitaire par palier de prix).</p>' : '') + '</section>';
  if (tous) {
    var cl = P.secteurs.map(function (s) { return { s: s, nous: pi.somme(s.mois, r, 'margeNous'), ca: pi.somme(s.mois, r, 'ca') }; }).sort(function (a, b) { return b.nous - a.nous; }), totN = cl.reduce(function (a, c) { return a + c.nous; }, 0), moyN = totN / cl.length, mxN = cl[0].nous;
    html += '<section class="carte" data-interne>' + tete('Classement des commerciaux par notre marge', lp + ' · ' + P.secteurs.length + ' secteurs · « × N » compare à la moyenne des secteurs · un clic sur un commercial le choisit comme secteur regardé · vue direction : un commercial ne voit que son secteur et ceux que la direction lui ouvre') +
      '<table class="tabl pi-empile"><thead><tr><th>#</th><th>Commercial<span class="st">secteur</span></th><th class="num">Notre marge<span class="st">' + lp + '</span></th><th class="num">Part du réseau</th><th class="num">Part de son chiffre d’affaires<span class="st">notre marge ÷ ses ventes</span></th></tr></thead><tbody>' +
      cl.map(function (c, i) { return '<tr class="pi-lien' + (c.s.id === pi.MOI.id ? ' pi-moi' : '') + '" data-sect="' + c.s.id + '" tabindex="0" role="link" aria-label="Regarder le secteur de ' + esc(c.s.nom) + '" data-q="' + esc((c.s.nom + ' ' + c.s.zone).toLowerCase()) + '">' + td('Rang', rang(i + 1)) + td('Commercial', '<b>' + esc(c.s.nom) + (c.s.id === pi.MOI.id ? ' <span class="pi-tag">mon secteur</span>' : '') + '</b><span class="sub">' + esc(c.s.zone) + (r[1] === 12 && !c.s.mois[12].transmis ? ' · novembre non transmis' : '') + '</span>') +
        td('Notre marge', '<span class="pi-bar">' + bar(c.nous, mxN, 'var(--c-nous)') + '<b>' + eur(c.nous) + '</b></span><span class="fois">× ' + nf1.format(c.nous / moyN) + ' la moyenne des secteurs</span>', 'num') + td('Part du réseau', pct(c.nous / totN * 100), 'num') + td('Part de son chiffre d’affaires', J.nf2.format(c.ca ? c.nous / c.ca * 100 : 0) + ' %', 'num') + '</tr>'; }).join('') + '</tbody></table></section></div>';
  } else html += '<section class="carte" data-interne>' + tete('Classement des commerciaux par notre marge', 'se lit en vue « Tous les secteurs »') + '<p class="note">Choisissez « Tous les secteurs » dans le menu Secteur regardé du bandeau pour comparer les ' + P.secteurs.length + ' commerciaux entre eux.</p></section></div>';
  /* 3. Répartition du chiffre d'affaires : familles ou tranches de prix, en part, euros ou boîtes ; une mini-carte par famille, colonnes des 13 mois */
  var champ = PS.rep === 'fam' ? 'repartitionFamille' : 'repartitionTranche', R = agr(L, r, champ), ref = agr(tous ? [pi.MOI] : P.secteurs, r, champ), refNom = tous ? 'mon secteur' : 'réseau';
  html += '<section class="carte" id="pi-rep">' + tete('Répartition du chiffre d’affaires', nomS + ' · ' + lp + ' · familles ou tranches de prix, en part, en euros ou en boîtes · les colonnes : les 13 mois, la période en couleur',
    '<div class="pi-segs">' + seg('data-rep', [['fam', 'Familles'], ['tranche', 'Tranches de prix']], PS.rep, 'Répartition') + seg('data-unite', [['part', 'Part'], ['euros', 'Euros'], ['boites', 'Boîtes']], PS.unite, 'Unité') + '</div>') +
    '<div class="pi-minis entre">' + R.map(function (f, i) { var refF = ref.filter(function (x) { return x.cle === f.cle; })[0];
      var val = PS.unite === 'part' ? pct(f.part) : PS.unite === 'euros' ? eur(f.euros) : nf.format(f.boites) + ' <small>boîtes</small>';
      var refTxt = refF && PS.unite === 'part' ? ' · ' + refNom + ' : ' + pct(refF.part) : '';
      return '<div class="pi-mini" style="--i:' + i + '"><div class="lib"><span class="puce" style="background:var(--c-ca)"></span>' + esc(f.nom) + '</div><div class="val num">' + val + '</div><p class="note">' + lp + refTxt + '</p><div class="chart-box" id="pi-mini-' + f.cle + '" data-cle="' + f.cle + '" data-i="' + i + '"></div></div>'; }).join('') + '</div>' +
    '<p class="lecteur" id="pi-mlect" aria-live="polite">Touchez ou survolez un mois d’une mini-carte pour le lire.</p><p class="note">Génériques par génériqueur et biosimilaires par laboratoire : pas encore disponibles.</p></section>';
  /* 4. Mes produits : matrice secteur × tranche de prix (euros de la période), case cliquable */
  var TR = P.secteurs[0].mois[0].repartitionTranche.map(function (t) { return { cle: t.cle, nom: t.nom }; });
  var mat = P.secteurs.map(function (s) { var a = agr([s], r, 'repartitionTranche'); return { s: s, cells: TR.map(function (t) { var f = a.filter(function (x) { return x.cle === t.cle; })[0]; return f ? f.euros : 0; }) }; });
  var mxC = Math.max.apply(null, mat.map(function (m) { return Math.max.apply(null, m.cells); }).concat([1]));
  var sel = PS.mat ? PS.mat.split('|') : null, selS = sel ? pi.sect(sel[0]) : null, selT = sel ? TR.filter(function (t) { return t.cle === sel[1]; })[0] : null;
  html += '<section class="carte" id="pi-prod">' + tete('Mes produits', 'quels produits, dans quel secteur, dans quelle catégorie de prix · ' + lp + ' · une case = le chiffre d’affaires d’un secteur sur une tranche · un clic ouvre la case, un second la relâche',
    '<div class="pi-segs"><div class="seg" role="group" aria-label="Base"><button type="button" aria-pressed="true">Tout le chiffre</button><button type="button" aria-pressed="false" data-stub="La variante « remboursables seulement » n’est pas dans les données fictives.">Remboursables</button></div>' + (sel ? '<button type="button" class="pil" data-raz>' + J.ico('close') + 'Relâcher la case</button>' : '') + '</div>') +
    '<div class="pi-mat"><table><thead><tr><th>Secteur</th>' + TR.map(function (t) { return '<th class="num">' + esc(J.maj(t.nom.split(' · ')[1] || t.nom)) + '<span class="st">' + esc(t.nom.split(' · ')[0]) + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
    mat.map(function (m) { return '<tr data-q="' + esc((m.s.nom + ' ' + m.s.zone).toLowerCase()) + '"><td>' + esc(m.s.id === pi.MOI.id ? 'Mon secteur' : m.s.nom) + '<span class="sub">' + esc(m.s.zone) + '</span></td>' + m.cells.map(function (v, k) { var on = sel && sel[0] === m.s.id && sel[1] === TR[k].cle; return '<td><button type="button" class="pi-case" data-case="' + m.s.id + '|' + TR[k].cle + '" aria-pressed="' + !!on + '">' + eur(v) + bar(v, mxC, 'var(--c-ca)') + '</button></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
    (sel && selS && selT ? '<div class="pi-casev"><h3>' + esc(selS.id === pi.MOI.id ? 'Mon secteur' : selS.nom) + ' · ' + esc(selT.nom) + '</h3>' + (selT.cle === 'chers' || selT.cle === 'tresChers' ? (function () { var idx = P.secteurs.indexOf(selS), L2 = P.moleculesCheres.filter(function (m) { return selT.cle === 'tresChers' ? m.prixBoite > 3000 : m.prixBoite <= 3000; }).slice().sort(function (a, b) { return b.parSecteur[idx] - a.parSecteur[idx]; });
      return L2.length ? '<p class="note">Les molécules chères de cette case, classées par nombre d’officines du secteur qui les commandent.</p><table class="tabl pi-empile"><thead><tr><th>Molécule</th><th class="num">Officines du secteur</th><th class="num">Prix de la boîte</th></tr></thead><tbody>' + L2.map(function (m) { return '<tr>' + td('Molécule', '<b>' + esc(m.nom) + '</b>') + td('Officines du secteur', nf.format(m.parSecteur[idx]), 'num') + td('Prix de la boîte', eur(m.prixBoite), 'num') + '</tr>'; }).join('') + '</tbody></table>' : '<p class="note">Aucune molécule de cette tranche.</p>'; })() :
      '<p class="note">Le détail des produits de cette case n’est pas encore disponible : seules les molécules chères (468 € la boîte et plus) le sont.</p>') + '</div>' : '') +
    '<p class="note">La ligne « France » (boîtes par officine, source Medic’AM) n’est pas sur cet écran : elle se lit dans l’écran Le marché.</p></section>';
  /* 5. Mes pharmacies : top 10 des officines (→ fiche) et chiffre d'affaires par groupement */
  var top = PS.per === 'dernier' ? P.top10Officines.dernierMois : PS.per === '3' ? P.top10Officines.troisMois : P.top10Officines.annee, mxT = top[0].ca, topLib = PS.per === 'dernier' ? PLL[11].toLowerCase() : PS.per === '3' ? 'trois derniers mois' : 'année';
  html += '<div class="stack"><section class="carte" id="pi-top" data-interne>' + tete('Top 10 des officines', 'classées par chiffre d’affaires · ' + esc(topLib) + ' · réseau entier · un clic ouvre la fiche', '<button type="button" class="pil" data-stub="' + STUB('Toutes les officines classées') + '">Toutes' + J.ico('chev') + '</button>') +
    '<table class="tabl pi-empile"><thead><tr><th>#</th><th>Officine<span class="st">ville · groupement</span></th><th class="num">Chiffre d’affaires</th><th class="num">Marge du pharmacien</th><th class="num" data-interne>Notre marge</th><th></th></tr></thead><tbody>' +
    top.map(function (o) { return ligneOff(o.id, o.nom, o.ville + ' ' + o.groupement) + td('Rang', rang(o.rang)) + td('Officine', '<b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + esc(o.groupement) + '</span>') + td('Chiffre d’affaires', '<span class="pi-bar">' + bar(o.ca, mxT, 'var(--c-ca)') + '<b>' + eur(o.ca) + '</b></span>', 'num') + td('Marge du pharmacien', eur(o.margePharmacien), 'num') + '<td class="num" data-l="Notre marge" data-interne>' + eur(o.margeNous) + '</td><td class="chev">' + J.ico('chev') + '</td></tr>'; }).join('') + '</tbody></table></section>';
  var gm = P.groupements.slice().sort(function (a, b) { return b.ca - a.ca; }), mxG = gm[0].ca;
  html += '<section class="carte" id="pi-grp">' + tete('Chiffre d’affaires et marge par groupement', esc(P.groupementsPeriode) + ' · ' + gm.length + ' groupements · réseau entier') +
    '<table class="tabl pi-empile"><thead><tr><th>#</th><th>Groupement</th><th class="num">Officines</th><th class="num">Chiffre d’affaires</th><th class="num">Marge du pharmacien</th><th class="num">Par officine</th></tr></thead><tbody>' +
    gm.map(function (g, i) { return '<tr data-q="' + esc(g.nom.toLowerCase()) + '">' + td('Rang', rang(i + 1)) + td('Groupement', '<b>' + esc(g.nom) + '</b>') + td('Officines', nf.format(g.officines), 'num') + td('Chiffre d’affaires', '<span class="pi-bar">' + bar(g.ca, mxG, 'var(--c-ca)') + '<b>' + eur(g.ca) + '</b></span>', 'num') + td('Marge du pharmacien', eur(g.margePharmacien), 'num') + td('Par officine', eur(g.ca / Math.max(1, g.officines)), 'num') + '</tr>'; }).join('') + '</tbody></table></section></div>';
  /* 6. Le marché France et Offilog : renvois vers leurs écrans (source Medic'AM jamais mélangée au chiffre du réseau) */
  html += '<div class="pi-deux">' + renvoi('Le marché France', 'ce que le pays achète de plus, et de moins · une moyenne par officine, source Medic’AM, jamais mélangée au chiffre du réseau', 'net', 'marche', 'Ouvrir Le marché') +
    renvoi('Offilog', esc(J.X.offilog.eyebrow) + ' · chiffre d’affaires du mois, prime, pharmacies à relancer', 'box', 'offilog', 'Ouvrir Offilog') + '</div>';
  /* 7. Le gisement : capsules par tranche, jauge de couverture, tableau */
  var G = P.gisement, gl = G.lignes, trs = {}; gl.forEach(function (g) { trs[g.tranche] = (trs[g.tranche] || 0) + 1; });
  if (PS.gis !== 'toutes' && !trs[PS.gis]) PS.gis = 'toutes';
  var glF = gl.filter(function (g) { return PS.gis === 'toutes' || g.tranche === PS.gis; }), mxP = Math.max.apply(null, gl.map(function (g) { return g.potentielParAn; }));
  html += '<section class="carte" id="pi-gis" data-interne>' + tete('Le gisement · ' + nf.format(G.officines) + ' officines', 'ce que la France achète et que vos officines n’ont pas commandé, uniquement ce qu’Intégral a en stock · classé par euros, pas par nombre de boîtes') +
    '<div class="pi-caps">' + [['toutes', 'Toutes catégories', gl.length]].concat(Object.keys(trs).map(function (k) { return [k, NOMT[k] || k, trs[k]]; })).map(function (c) { return '<button type="button" data-gis="' + c[0] + '" aria-pressed="' + (PS.gis === c[0]) + '">' + c[1] + ' <span class="cnt">' + c[2] + '</span></button>'; }).join('') + '</div>' +
    '<div class="pi-jauge"><div class="cb-pist"><i class="cb-b" style="width:' + G.couverture.part + '%;background:var(--c-ca)"></i></div><span><b class="num">' + G.couverture.part + ' %</b> · ' + nf.format(G.couverture.produitsCommandes) + ' sur ' + nf.format(G.couverture.produitsMarche) + ' produits du marché remboursable commandés au moins une fois sur la période</span></div>' +
    '<table class="tabl pi-empile"><thead><tr><th>#</th><th>Produit<span class="st">tranche de prix</span></th><th class="num">Ne le prennent pas<span class="st">sur les officines du secteur</span></th><th class="num">En France<span class="st">boîtes par pharmacie et par an</span></th><th class="num">Prix net<span class="st">de la boîte</span></th><th class="num">Potentiel<span class="st">par an</span></th></tr></thead><tbody>' +
    glF.map(function (g) { return '<tr data-q="' + esc((g.nom + ' ' + (NOMT[g.tranche] || g.tranche)).toLowerCase()) + '">' + td('Rang', rang(g.rang)) + td('Produit', '<b>' + esc(g.nom) + '</b><span class="sub">' + (g.referenceNonRepertoriee ? 'référence non répertoriée · ' : '') + esc(NOMT[g.tranche] || g.tranche) + '</span>') +
      td('Ne le prennent pas', '<b>' + nf.format(g.officinesNeLePrennentPas) + '</b><span class="fois">' + (g.dejaPrisPar ? 'déjà pris par ' + nf.format(g.dejaPrisPar) : 'aucune ne le prend encore') + '</span>', 'num') + td('En France', nf1.format(g.boitesParPharmacieParAn), 'num') + td('Prix net de la boîte', J.eur2(g.prixNetBoite), 'num') + td('Potentiel par an', '<span class="pi-bar">' + bar(g.potentielParAn, mxP, 'var(--c-ca)') + '<b>' + eur(g.potentielParAn) + '</b></span>', 'num') + '</tr>'; }).join('') + '</tbody></table><p class="note">Ce potentiel est un calcul (boîtes vendues en France par pharmacie et par an × prix net × officines qui ne le prennent pas), pas une prévision.</p></section>';
  /* 8. Pharmacies en baisse, à relancer (→ fiche) */
  var B = P.pharmaciesEnBaisse, mxB = Math.max.apply(null, B.lignes.map(function (b) { return b.baisseParMois; }));
  html += '<section class="carte" id="pi-baisse" data-interne>' + tete('Pharmacies en baisse, à relancer', '3 derniers mois contre les 3 précédents · règle du moteur de décrochage : baisse ' + esc(B.regle) + ' · un clic ouvre la fiche') +
    '<table class="tabl pi-empile"><thead><tr><th>#</th><th>Officine</th><th class="num">3 derniers mois</th><th class="num">3 mois d’avant</th><th class="num">Baisse par mois</th><th class="num">Écart</th><th></th></tr></thead><tbody>' +
    B.lignes.map(function (b) { var pt = J.pointById(b.id), nom = pt ? pt.nom : window.corrigerNomOfficine ? window.corrigerNomOfficine('PHARMACIE ' + b.nom) : 'PHARMACIE ' + b.nom, villeDans = String(nom).toUpperCase().indexOf(String(b.ville).toUpperCase()) >= 0;   /* ces noms arrivent sans « PHARMACIE » (« DU LES OLIVIERS ») : on reprend celui de la carte, déjà corrigé, sinon la correction commune ; la ville n'est pas répétée quand le nom la porte */
      return ligneOff(b.id, nom, b.ville) + td('Rang', rang(b.rang)) + td('Officine', '<b>' + esc(J.joli(nom)) + '</b>' + (villeDans ? '' : '<span class="sub">' + esc(b.ville) + '</span>')) + td('3 derniers mois', eur(b.troisDerniersMois), 'num') + td('3 mois d’avant', eur(b.troisMoisAvant), 'num') + td('Baisse par mois', '<span class="pi-bar">' + bar(b.baisseParMois, mxB, 'var(--e-alerte)') + '<b>' + eur(b.baisseParMois) + '</b></span>', 'num') + td('Écart', '<span class="evo">' + J.icoSvg('bas', 'var(--e-alerte)') + '<b>−' + nf.format(Math.abs(b.pourcent)) + ' %</b></span>', 'num') + '<td class="chev">' + J.ico('chev') + '</td></tr>'; }).join('') + '</tbody></table></section>';
  box.innerHTML = html + '</div>';
  J.poseIcones(box);
  /* mini-colonnes des répartitions, dessinées à la largeur réelle ; un lecteur commun */
  var selM = []; for (var i = r[0]; i <= r[1]; i++) selM.push(i);
  var unite = PS.unite, fmtU = function (v) { return unite === 'part' ? pct(v) : unite === 'euros' ? eur(v) : nf.format(v) + ' boîtes'; };
  $$('.pi-minis .chart-box', box).forEach(function (b) { var cle = b.getAttribute('data-cle'), q = +b.getAttribute('data-i'), s = serie(L, champ, cle, unite), nomF = R[q].nom, t = s.map(function (v, k) { return '<b>' + PLL[k] + '</b> · ' + esc(nomF) + ' : ' + fmtU(v) + (k === 12 ? ' · <b>mois incomplet</b>' : ''); });
    J.dessine(b, function (w) { return J.colonnes({ labels: COURT.map(function (c) { return c.slice(0, 1); }), vals: s, sel: selM, incompl: pi.INC, couleur: 'var(--c-ca)', h: 96, aria: nomF + ' sur 13 mois' }, w); }, function (bx) { J.lie(bx, t, $('#pi-mlect', box)); }); });
  var el = box.closest('[data-ecran]'), rejouer = function () { pi.detail(box, ms, r, pr); if (pi.filtrer) pi.filtrer(el); };
  $$('[data-rep]', box).forEach(function (b) { b.onclick = function () { PS.rep = b.getAttribute('data-rep'); rejouer(); }; });
  $$('[data-unite]', box).forEach(function (b) { b.onclick = function () { PS.unite = b.getAttribute('data-unite'); rejouer(); }; });
  $$('[data-gis]', box).forEach(function (b) { b.onclick = function () { PS.gis = b.getAttribute('data-gis'); rejouer(); }; });
  $$('[data-case]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-case'); PS.mat = PS.mat === k ? null : k; rejouer(); var c = $('#pi-prod', box); if (c) c.scrollIntoView({ block: 'nearest' }); }; });
  var raz = $('[data-raz]', box); if (raz) raz.onclick = function () { PS.mat = null; rejouer(); };
  $$('tr.pi-lien[data-off]', box).forEach(function (tr) { var go = function () { var id = tr.getAttribute('data-off'); if (J.offById(id)) J.ouvrirFiche(id); else J.toast('La fiche complète n’est pas dessinée pour cette officine fictive : seules les 40 officines du relevé en ont une.'); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  /* classement : cliquer un commercial le choisit comme secteur regardé */
  $$('tr.pi-lien[data-sect]', box).forEach(function (tr) { var go = function () { PS.sect = tr.getAttribute('data-sect'); J.aller('pilotage-detail'); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
};
})();
