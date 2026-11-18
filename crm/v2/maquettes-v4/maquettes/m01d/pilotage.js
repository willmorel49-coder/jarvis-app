/* m01d — Pappers v4 : écran Pilotage (bandeau bleu, carte d'identité « chiffre d'affaires », listes clé-valeur côte à côte). */
(function () {
  'use strict';
  var N = window.N, P = window.DONNEES_V4.pilotage, esc = N.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  function eur(n) { return nf.format(Math.round(n)) + ' €'; }
  function eurM(n) { return Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + ' M€' : eur(n); }
  function signe(p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + nf.format(Math.abs(Math.round(p))) + ' %'; }
  var S = { sect: 'tous', per: 'dernier', du: 9, au: 11, detail: false };
  var PL = P.moisLibelles, PLL = P.moisLibellesLongs;
  var P2 = N.pil = { S: S, eur: eur, eurM: eurM, nf: nf, nf1: nf1, nf2: nf2, signe: signe, $: $, $$: $$ };

  P2.moisDe = function (sect) { if (sect === 'tous') return P.reseau.mois; for (var i = 0; i < P.secteurs.length; i++) if (P.secteurs[i].id === sect) return P.secteurs[i].mois; return P.reseau.mois; };
  P2.plage = function () { if (S.per === 'dernier') return [11, 11]; if (S.per === '3') return [9, 11]; if (S.per === 'annee') return [2, 11]; return [Math.min(S.du, S.au), Math.max(S.du, S.au)]; };
  P2.plagePrec = function (r) { var n = r[1] - r[0] + 1, a = r[0] - n; return a < 0 ? null : [a, r[0] - 1]; };
  P2.somme = function (ms, r, k) { var s = 0; for (var i = r[0]; i <= r[1]; i++) s += (typeof k === 'function' ? k(ms[i]) : ms[i][k]); return s; };
  var somme = P2.somme, moy = function (ms, r, k) { return somme(ms, r, k) / (r[1] - r[0] + 1); };
  P2.libPeriode = function (r) {
    if (S.per === 'dernier') return 'octobre 2026';
    if (S.per === '3') return 'août – octobre 2026';
    if (S.per === 'annee') return 'janvier – octobre 2026';
    if (r[0] === r[1]) return PLL[r[0]].toLowerCase();
    return PLL[r[0]].toLowerCase() + ' – ' + PLL[r[1]].toLowerCase();
  };
  function nomAvant() { return S.per === 'dernier' ? 'septembre' : 'la période d’avant'; }

  var MES = P2.MES = {
    nous: { nom: 'Notre marge', col: 'var(--c-nous)', f: function (ms, r) { return somme(ms, r, 'margeNous'); }, s: function (m) { return m.margeNous; }, fmt: eur },
    phar: { nom: 'Marge pharmacien générée', col: 'var(--c-pharma)', f: function (ms, r) { return somme(ms, r, 'margePharmacien'); }, s: function (m) { return m.margePharmacien; }, fmt: eur },
    act: { nom: 'Officines actives', col: 'var(--c-cmd)', f: function (ms, r) { return Math.round(moy(ms, r, 'officinesActives')); }, s: function (m) { return m.officinesActives; }, fmt: function (v) { return nf.format(v); } },
    panier: { nom: 'Panier moyen', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca') / Math.max(1, somme(ms, r, 'officinesActives')); }, s: function (m) { return m.ca / Math.max(1, m.officinesActives); }, fmt: eur }
  };
  MES.ca = { nom: 'Chiffre d’affaires', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca'); }, s: function (m) { return m.ca; }, fmt: eurM };
  var PAR = P2.PAR = [
    { k: 'ca', nom: 'Chiffre d’affaires par client', unit: 'par client et par mois', col: 'var(--c-ca)', v: function (m) { return m.ca / m.officinesActives; }, g: function (a) { return a.caCl; }, fmt: eur },
    { k: 'nous', nom: 'Notre marge par client', unit: 'par client et par mois', col: 'var(--c-nous)', v: function (m) { return m.margeNous / m.officinesActives; }, g: function (a) { return a.mgCl; }, fmt: eur },
    { k: 'liv', nom: 'Livraisons par client', unit: 'par client et par mois', col: 'var(--c-cmd)', neutre: true, v: function (m) { return m.livraisons / m.officinesActives; }, g: function (a) { return a.livraisons; }, fmt: function (v) { return nf1.format(v) + ' par mois'; } },
    { k: 'mpl', nom: 'Marge par livraison', unit: 'par livraison', col: 'var(--c-nous)', v: function (m) { return m.margeNous / m.livraisons; }, g: function (a) { return a.margeParLivraison; }, fmt: eur },
    { k: 'apl', nom: 'Marge après livraisons', unit: 'par client et par mois', col: 'var(--c-pharma)', v: function (m) { return (m.margeNous - m.livraisons * P.reseau.coutLivraison) / m.officinesActives; }, g: function (a) { return a.margeApresLivraison; }, fmt: eur }
  ];

  /* Histogramme SVG : période en couleur, autres mois en gris, mois incomplet en pointillé, moyenne grise tracée, axe à droite. */
  function pas(max) { var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  P2.histo = function (c) {
    if (!c.vals.length || !c.vals.every(isFinite)) return '';
    var w = c.w || 640, h = c.h || 240, L = 6, R = w < 420 ? 52 : 64, T = 22, B = 28, n = c.vals.length;
    var ligne = c.ligne ? c.ligne.vals : [];
    var max = Math.max.apply(null, c.vals.concat(ligne, [c.moy || 0, 1])), st = pas(max), top = Math.ceil(max / st) * st;
    var iw = w - L - R, ih = h - T - B, bw = Math.min(26, iw / n * .56);
    var X = function (i) { return L + (i + .5) * iw / n; }, Y = function (v) { return T + ih - v / top * ih; };
    var s = '<svg class="histo" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(c.aria || 'Histogramme') + '">';
    for (var g = 0; g <= top + 1; g += st) {
      s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="var(--filet)" stroke-width="1"/>';
      s += '<text x="' + (w - R + 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" font-size="13" fill="var(--enc-3)">' + (c.axe ? c.axe(g) : g) + '</text>';
    }
    c.vals.forEach(function (v, i) {
      var sel = !c.sel || c.sel.indexOf(i) >= 0, inc = c.incompl && c.incompl.indexOf(i) >= 0, hh = Math.max(1, ih - (Y(v) - T));
      var col = sel ? c.couleur : 'var(--enc-5)';
      s += '<g class="barre" data-i="' + i + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="' + T + '" width="' + (iw / n).toFixed(1) + '" height="' + ih + '" fill="transparent"/>' +
        '<rect class="bar" x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="3" ' +
        (inc ? 'fill="#fff" stroke="' + col + '" stroke-width="1.6" stroke-dasharray="4 3"' : 'fill="' + col + '"') + ' style="transform-origin:' + X(i).toFixed(1) + 'px ' + (T + ih) + 'px;animation-delay:' + (i * 40) + 'ms"/></g>';
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 7) + '" font-size="13" text-anchor="middle" fill="var(--enc-3)">' + esc(c.labels[i]) + '</text>';
    });
    if (c.ligne) {
      s += '<path d="' + ligne.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('') + '" fill="none" stroke="var(--c-moyenne)" stroke-width="1.6" stroke-dasharray="5 4" stroke-linecap="round"/>';
      s += ligne.map(function (v, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.8" fill="var(--c-moyenne)"/>'; }).join('');
    }
    if (c.moy != null) {
      s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(c.moy).toFixed(1) + '" y2="' + Y(c.moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="6 4"/>';
      if (c.moyTxt) s += '<text x="' + (L + 4) + '" y="' + (Y(c.moy) - 6).toFixed(1) + '" font-size="13" font-weight="700" fill="var(--c-moyenne)" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(c.moyTxt) + '</text>';
    }
    return s + '</svg>';
  };
  P2.lier = function (box, textes, lect) {
    $$('.barre', box).forEach(function (g) {
      var f = function () { var i = +g.getAttribute('data-i'); if (lect) lect.innerHTML = textes[i]; $$('.bar', box).forEach(function (b, k) { b.classList.toggle('vue', k === i); }); };
      g.addEventListener('mouseenter', f); g.addEventListener('click', f); g.addEventListener('touchstart', f, { passive: true });
    });
  };
  P2.largeur = function (el, min, max) { return Math.max(min, Math.min(max, Math.round(el.clientWidth || max))); };
  P2.axeEur = function (g) { return g >= 1e6 ? nf1.format(g / 1e6).replace(',0', '') + ' M€' : g >= 1000 ? nf.format(g / 1000) + ' k€' : nf.format(g); };

  function ico(nom, c) { var p = { haut: '<path d="m6 15 6-6 6 6"/>', bas: '<path d="m6 9 6 6 6-6"/>', egal: '<path d="M5 12h14"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>', next: '<path d="m9 6 6 6-6 6"/>' }[nom];
    return '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + (c || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  P2.ico = ico;
  P2.evo = function (v, w, avant, neutre) {
    if (!w) return '<span class="evo-t">Pas de comparaison possible</span>';
    var p = (v - w) / w * 100, egal = Math.abs(p) < .5;
    var i = egal || neutre ? ico('egal', 'var(--e-neutre)') : ico(p < 0 ? 'bas' : 'haut', p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)');
    return '<span class="evo-t">' + i + (egal ? 'égal à ' + avant : '<b>' + signe(p) + '</b> qu’en ' + avant) + '</span>';
  };
  function spark(a, w, h, col, b) {
    if (!a.every(isFinite)) return '';
    var all = a.concat(b || []), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all), pad = 4; if (mx === mn) mx = mn + 1;
    var X = function (i) { return pad + i * (w - 2 * pad) / (a.length - 1); }, Y = function (v) { return h - pad - (v - mn) * (h - 2 * pad) / (mx - mn); };
    var d = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''); };
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Évolution sur 13 mois">' +
      (b ? '<path d="' + d(b) + '" fill="none" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="4 3"/>' : '') +
      '<path class="sp-fil" pathLength="1" d="' + d(a) + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + X(a.length - 1).toFixed(1) + '" cy="' + Y(a[a.length - 1]).toFixed(1) + '" r="3.6" fill="#fff" stroke="' + col + '" stroke-width="2.4"/></svg>';
  }
  P2.spark = spark;

  function subMes(k, ms, r, v, ca) {
    if (k === 'nous') return nf2.format(v / ca * 100) + ' % du chiffre d’affaires';
    if (k === 'phar') return nf1.format(v / ca * 100) + ' % du chiffre d’affaires';
    if (k === 'act') return 'au moins une commande · ' + Math.round(v / (S.sect === 'tous' ? P.reseau.nbOfficines : Math.round(P.reseau.nbOfficines / 8)) * 100) + ' % des officines';
    return 'par officine active';
  }
  function optMois(sel) { var s = ''; for (var i = 12; i >= 0; i--) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + PLL[i] + (i === 12 ? ' (incomplet)' : '') + '</option>'; return s; }
  function valPar(d, ms, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.v(ms[i], i); n++; } return s / n; }
  function valMoy(d, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.g(P.moyenneIntegral[i]); n++; } return s / n; }
  P2.valMoy = valMoy; P2.valPar = valPar;
  P2.nomSect = function () { return S.sect === 'tous' ? 'Tous les secteurs' : (P.secteurs.filter(function (s) { return s.id === S.sect; })[0] || {}).nom; };

  N.pilotageRendre = function (detail) {
    S.detail = !!detail;
    var el = $('#ecran-pilotage'), ms = P2.moisDe(S.sect), r = P2.plage(), pr = P2.plagePrec(r), M = MES;
    var nomS = P2.nomSect(), ca = M.ca.f(ms, r), caP = pr ? M.ca.f(ms, pr) : null, lp = P2.libPeriode(r), av = nomAvant();
    var pc = caP ? Math.round((ca - caP) / caP * 100) : null;
    var lede = 'En ' + esc(lp) + ', ' + (S.sect === 'tous' ? 'le réseau Intégral' : 'le secteur de ' + esc(nomS)) + ' a fait <b>' + eurM(ca) + '</b> de ventes' + (pc == null ? '.' : ', <b>' + Math.abs(pc) + ' % de ' + (pc < 0 ? 'moins' : 'plus') + '</b> qu’en ' + av + '.');
    var moyCl = valMoy(PAR[0], r);
    el.innerHTML =
      '<header class="bandeau bandeau--pil"><div class="wrap"><p class="maj">Ventes à jour au 31 octobre 2026 · Données fictives</p>' +
      '<div class="hero"><div><p class="sur">' + (S.sect === 'tous' ? 'Tous les secteurs' : 'Secteur de ' + esc(nomS)) + ' · ' + esc(lp) + '</p><h1>Pilotage</h1><p class="hsous lede">' + lede + '</p></div>' +
      '<label class="sel-b"><span class="lbl">Secteur regardé</span><select id="p-sect" aria-label="Secteur regardé"><option value="tous">Tous les secteurs</option>' + P.secteurs.map(function (s) { return '<option value="' + s.id + '"' + (S.sect === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="pil-filtres"><div class="seg" role="group" aria-label="Période">' + [['dernier', 'Dernier mois'], ['3', '3 mois'], ['annee', 'Année'], ['choisir', 'Choisir']].map(function (b) { return '<button type="button" data-periode="' + b[0] + '" aria-pressed="' + (S.per === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
      (S.per === 'choisir' ? '<label class="sel-b sel-b--h"><span class="lbl">Du</span><select id="p-du" aria-label="Du">' + optMois(S.du) + '</select></label><label class="sel-b sel-b--h"><span class="lbl">au</span><select id="p-au" aria-label="au">' + optMois(S.au) + '</select></label>' : '') + '</div></div></header>' +
      '<div class="wrap fiche pil"><p class="alerte-n" role="note">' + ico('bell', 'var(--e-attention)') + '<span>' + esc(P.noteMoisIncomplet) + '</span></p>' +
      '<section class="ident ident--pil"><div class="pil-gros"><p class="st">Chiffre d’affaires · ' + esc(lp) + '</p><b class="gros-n" id="p-ca" data-v="' + Math.round(ca) + '">' + eurM(ca) + '</b>' +
      '<p class="st">net hors taxes · ce que les officines ont acheté</p><p class="hero-evo">' + P2.evo(ca, caP, av) + '</p>' +
      '<p class="st">Moyenne Intégral : <b>' + eur(moyCl) + '</b> par client et par mois</p></div>' +
      '<div class="pil-histo"><div id="p-histo"></div><p class="lecteur" id="p-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>' +
      '<div class="leg"><span class="lg2"><i class="dot" style="--k:var(--c-ca)"></i>' + esc(lp) + '</span><span class="lg2"><i class="dot" style="--k:var(--enc-5)"></i>Autres mois</span><span class="lg2"><i class="dot dot--vide"></i>Mois incomplet</span></div></div></section>' +
      '<div class="rang"><section class="cadre"><header><div><h2>Les mesures</h2><p class="st">' + esc(lp) + ' · ' + (S.sect === 'tous' ? 'tous les secteurs' : 'secteur de ' + esc(nomS)) + '</p></div></header><dl class="kv kv--filets">' +
      ['nous', 'phar', 'act', 'panier'].map(function (k) { var d = M[k], v = d.f(ms, r), w = pr ? d.f(ms, pr) : null;
        return '<div><dt><i class="dot" style="--k:' + d.col + '"></i>' + d.nom + '<span class="sous">' + subMes(k, ms, r, v, ca) + '</span></dt><dd><button type="button" class="mes-b" data-mes="' + k + '"><span class="mv"><b>' + d.fmt(v) + '</b>' + P2.evo(v, w, av) + '</span>' + spark(ms.map(d.s), 84, 28, d.col) + ico('next') + '</button></dd></div>'; }).join('') + '</dl></section>' +
      '<section class="cadre"><header><div><h2>Molécules</h2><p class="st">' + esc(lp) + '</p></div></header><dl class="kv kv--filets">' + molecules(ms, r) + '</dl>' +
      '<div class="btns"><button type="button" class="btn" data-mes="mol">' + N.ico('table') + 'Voir les molécules chères</button></div></section></div>' +
      '<section class="cadre"><header><div><h2>Par client, face à la Moyenne Intégral</h2><p class="st">' + esc(lp) + ' · trait gris : Moyenne Intégral</p></div></header><div class="par-l">' + parClient(ms, r) + '</div></section>' +
      '<div class="detail-barre"><button type="button" class="btn btn--plein" data-action="detail" aria-expanded="' + S.detail + '">' + (S.detail ? 'Masquer le détail' : 'Voir tout le détail') + '</button><span class="st">Répartitions, classements, produits, marché France, pharmacies à relancer…</span></div>' +
      '<div id="p-detail"' + (S.detail ? '' : ' hidden') + '></div></div>';
    N.icones(el);
    var sel = []; for (var i = r[0]; i <= r[1]; i++) sel.push(i);
    var box = $('#p-histo', el);
    var textes = ms.map(function (m, i) { return '<b>' + PLL[i] + '</b> : ' + eurM(m.ca) + (i === 12 ? ' (mois incomplet)' : ''); });
    box.innerHTML = P2.histo({ labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: ms.map(function (m) { return m.ca; }), sel: sel, incompl: [12], couleur: 'var(--c-ca)', w: P2.largeur(box, 300, 700), h: 250, axe: P2.axeEur,
      moy: moy(ms.slice(0, 12), [0, 11], 'ca'), moyTxt: 'Moyenne des mois complets', aria: 'Chiffre d’affaires des 13 derniers mois' });
    P2.lier(box, textes, $('#p-lect', el));
    compter($('#p-ca', el), ca);
    $$('[data-periode]', el).forEach(function (b) { b.onclick = function () { S.per = b.getAttribute('data-periode'); N.pilotageRendre(S.detail); }; });
    $('#p-sect', el).onchange = function (e) { S.sect = e.target.value; N.pilotageRendre(S.detail); };
    if ($('#p-du', el)) { $('#p-du', el).onchange = function (e) { S.du = +e.target.value; N.pilotageRendre(S.detail); }; $('#p-au', el).onchange = function (e) { S.au = +e.target.value; N.pilotageRendre(S.detail); }; }
    $$('[data-mes],[data-par]', el).forEach(function (b) { b.onclick = function () { if (N.pil.feuille) N.pil.feuille(b.getAttribute('data-mes') || 'par:' + b.getAttribute('data-par')); }; });
    $('[data-action="detail"]', el).onclick = function () { location.hash = S.detail ? '#pilotage' : '#pilotage-detail'; };
    if (S.detail && N.pil.detail) N.pil.detail(ms, r);
  };
  function molecules(ms, r) {
    var tot = moy(ms, r, function (m) { return m.molecules.total; }), ch = moy(ms, r, function (m) { return m.molecules.cheres; });
    var ref = moy(P.reseau.mois, r, function (m) { return m.molecules.total; }) / 8, refCh = moy(P.reseau.mois, r, function (m) { return m.molecules.cheres; }) / 8;
    var rapp = S.sect === 'tous' ? 'moyenne du réseau' : (tot >= ref ? '<b>' + nf1.format(tot / ref) + ' fois</b> la moyenne Intégral' : '<b>' + signe((tot - ref) / ref * 100) + '</b> face à la moyenne Intégral');
    function ligne(l, v, s) { return '<div><dt>' + l + '</dt><dd><b>' + v + '</b>' + (s ? '<span class="sous">' + s + '</span>' : '') + '</dd></div>'; }
    return ligne('Molécules vendues', nf.format(Math.round(tot)), 'molécules différentes, vendues · ' + esc(P2.libPeriode(r))) +
      ligne('Dont chères', nf.format(Math.round(ch)), 'une boîte à 468 € ou plus (prix net)') +
      ligne('Face à la Moyenne Intégral', rapp, 'moyenne par secteur : ' + nf.format(Math.round(ref)) + ' molécules, dont ' + nf.format(Math.round(refCh)) + ' chères');
  }
  function parClient(ms, r) {
    return PAR.map(function (d) {
      var m = valMoy(d, r), v = S.sect === 'tous' ? null : valPar(d, ms, r), e = v == null ? null : (v - m) / m * 100;
      var sA = ms.map(function (x, i) { return d.v(x, i); }), sB = P.moyenneIntegral.map(d.g);
      return '<button type="button" class="par-b" data-par="' + d.k + '"><span class="par-n"><b>' + d.nom + '</b><span class="sous">' + d.unit + '</span></span>' +
        '<span class="par-v"><b>' + d.fmt(v == null ? m : v) + '</b><span class="sous">' + (v == null ? 'Moyenne Intégral du réseau' : 'Moyenne Intégral : ' + d.fmt(m)) + '</span></span>' +
        '<span class="par-e">' + (e == null ? '' : '<span class="evo-t">' + ico(d.neutre ? 'egal' : e < 0 ? 'bas' : 'haut', d.neutre ? 'var(--e-neutre)' : e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '<b>' + signe(e) + '</b> face à la Moyenne Intégral</span>') + '</span>' +
        '<span class="par-g">' + (v == null ? spark(sB, 200, 40, d.col) : spark(sA, 200, 40, d.col, sB)) + '</span>' + ico('next') + '</button>';
    }).join('');
  }
  function compter(el, v) {
    if (!el) return;
    el.textContent = eurM(v);
    if (N.REDUIT || !(v > 0)) return;
    var t0 = null;
    function pas1(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / 900); k = 1 - Math.pow(1 - k, 3); el.textContent = eurM(v * k); if (k < 1) requestAnimationFrame(pas1); else el.textContent = eurM(v); }
    el.textContent = eurM(0); requestAnimationFrame(pas1);
  }
  var larg0 = window.innerWidth;
  window.addEventListener('resize', function () { if (window.innerWidth !== larg0 && !document.querySelector('[data-ecran="pilotage"]').hidden) { larg0 = window.innerWidth; clearTimeout(P2._t); P2._t = setTimeout(function () { N.pilotageRendre(S.detail); }, 250); } });
})();
