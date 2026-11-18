/* Appro : couverture de stock et ruptures des établissements d'Intégral Pharma, trois vues (Aujourd'hui, Anticiper, Calendrier) et le détail d'un établissement
   (#appro-detail). Listes en tableaux à filets fins, « × N la moyenne » sous le chiffre ; états = mot + icône. Données fictives : window.DONNEES_V5.appro.
   Tout interne : [data-interne] + avis .vp. Les totaux vivent dans la phrase du bandeau, les tableaux ne portent que les valeurs par ligne. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, S = J.S, X = J.X;
var A = X && X.appro; if (!A) return;
var E = S.appro = S.appro || { vue: 'aujourdhui', etat: 'tous', q: '', etab: '', lu: -1 }; if (E.vue === 'calendrier') E.vue = 'aujourdhui';
var ETABS = A.etablissements.slice(), PRODUITS = A.aujourdhui, CAL = A.calendrier;
var ORDRE_ETAT = { 'Rupture': 0, 'Tension': 1, 'Contingenté': 2, 'Retour prévu': 3 };
var ICO_ETAT = { 'Rupture': ['close', 'var(--e-alerte)'], 'Tension': ['bell', 'var(--e-attention)'], 'Contingenté': ['lock', 'var(--e-attention)'], 'Retour prévu': ['check', 'var(--e-bien)'] };
var ICO_RAISON = { 'ventes en hausse': 'haut', 'quota atteint': 'lock', 'fournisseur en retard': 'truck', 'saison': 'cal' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
/* ---------- lectures dérivées (une seule fois, jamais écrites en dur) ---------- */
var somme = function (cle) { return ETABS.reduce(function (s, e) { return s + e[cle]; }, 0); };
var TOT = { ruptures: somme('ruptures'), enTension: somme('enTension'), quotas: somme('quotas') };
var MOY = { couverture: somme('couverture') / ETABS.length, ruptures: TOT.ruptures / ETABS.length, enTension: TOT.enTension / ETABS.length, quotas: TOT.quotas / ETABS.length };
var PAR_COUV = ETABS.slice().sort(function (a, b) { return a.couverture - b.couverture || a.ruptures - b.ruptures; });
function rangCouv(e) { var tri = ETABS.slice().sort(function (a, b) { return b.couverture - a.couverture; }); return tri.indexOf(e) + 1; }
function etabParCode(c) { for (var i = 0; i < ETABS.length; i++) if (ETABS[i].code === c) return ETABS[i]; return null; }
/* « Anticiper » : les données portent chaque produit deux fois (deux horizons) → une ligne par produit, le plus proche en grand, l'autre en sous-ligne */
function anticiper() {
  var par = {}, out = [];
  A.anticiper.forEach(function (x) { (par[x.produit] = par[x.produit] || []).push(x); });
  Object.keys(par).forEach(function (p) { var h = par[p].slice().sort(function (a, b) { return a.jours - b.jours; }); out.push({ produit: p, jours: h[0].jours, raison: h[0].raison, suite: h.slice(1) }); });
  return out.sort(function (a, b) { return a.jours - b.jours; });
}
var ANTI = anticiper();
/* répartition FICTIVE des 12 produits suivis entre les établissements (les données n'ont pas ce lien) : déterministe, dite à l'écran */
function manqueIci(k, i) { return ((i * 3 + k * 5) % 7) < 3; }
function couvHtml(e) { return '<span class="ap-couv"><span class="ap-pist" aria-hidden="true"><i style="width:' + e.couverture + '%"></i></span><b class="num">' + e.couverture + ' %</b></span>'; }
function etatHtml(etat) { var k = ICO_ETAT[etat] || ICO_ETAT.Tension; return '<span class="etat"><span class="ico">' + J.icoSvg(k[0], k[1]) + '</span>' + esc(etat) + '</span>'; }
function stockHtml(n) { return n > 0 ? '<b>' + nf.format(n) + '</b><span class="fois">boîtes en plateforme</span>' : '<b>0</b><span class="fois">boîte · épuisé</span>'; }
function avisVp() { return '<p class="vp ap-vp">Cet outil est réservé à l’équipe Intégral : rien n’y est montré au pharmacien. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>'; }
function filtreQ(txt) { var q = E.q.trim().toLowerCase(); return !q || txt.toLowerCase().indexOf(q) >= 0; }
/* ---------- tableau des établissements (la couverture, les moins couverts d'abord ; une ligne → #appro-detail) ---------- */
function tableEtabs() {
  var rows = PAR_COUV.filter(function (e) { return filtreQ(e.code + ' ' + e.nom); }).map(function (e, i) {
    return '<tr class="ap-l" data-etab="' + esc(e.code) + '" tabindex="0" role="link" aria-label="Ouvrir l’établissement de ' + esc(e.nom) + '" style="--i:' + i + '">' +
      '<td data-l="Établissement"><div class="ap-id"><span class="ap-av" aria-hidden="true">' + esc(e.code) + '</span><div class="ap-txt"><b class="ap-nom">' + esc(e.nom) + '</b><span class="sub">plateforme ' + esc(e.code) + ' · ' + J.ordre(rangCouv(e)) + ' en couverture</span></div></div></td>' +
      '<td class="num" data-l="Couverture ce matin">' + couvHtml(e) + '</td>' +
      '<td class="num" data-l="Références en rupture"><b>' + nf.format(e.ruptures) + '</b>' + J.fois(e.ruptures, MOY.ruptures) + '</td>' +
      '<td class="num" data-l="En tension"><b>' + nf.format(e.enTension) + '</b>' + J.fois(e.enTension, MOY.enTension) + '</td>' +
      '<td class="num" data-l="Sous quota"><b>' + nf.format(e.quotas) + '</b>' + J.fois(e.quotas, MOY.quotas) + '</td>' +
      '<td class="ap-chev">' + J.ico('chev') + '</td></tr>'; }).join('');
  return '<section class="carte ap-tab" aria-label="Couverture de stock par établissement"><div class="tete"><div><h2>Couverture de stock par établissement</h2><p class="st">part des références du catalogue disponibles ce matin · moyenne des plateformes : ' + nf.format(Math.round(MOY.couverture)) + ' % · les moins couvertes d’abord · un clic ouvre la plateforme</p></div></div>' +
    '<table class="tabl"><thead><tr><th>Établissement<span class="st">plateforme · rang de couverture</span></th><th class="num">Couverture<span class="st">références disponibles</span></th><th class="num">Références en rupture<span class="st">« × N la moyenne » des 7</span></th><th class="num">En tension<span class="st">stock sous 10 jours</span></th><th class="num">Sous quota<span class="st">contingentées</span></th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="6" class="ap-vide">Aucun établissement ne répond à « ' + esc(E.q) + ' ».</td></tr>') + '</tbody></table></section>';
}
/* ---------- vue « Aujourd'hui » : les produits suivis, état = mot + icône, retour prévu, stock ---------- */
function ligneProduit(p, i) {
  return '<tr style="--i:' + Math.min(i, 12) + '"><td data-l="Produit"><b class="ap-prod">' + esc(p.produit) + '</b><span class="sub">' + esc(p.labo) + '</span></td><td data-l="État">' + etatHtml(p.etat) + '</td>' +
    '<td data-l="Retour prévu">' + (p.retour === 'inconnu' ? '<span class="ap-gris">date inconnue</span>' : '<b class="ap-ret">' + esc(J.maj(p.retour)) + '</b>') + '</td><td class="num" data-l="Stock">' + stockHtml(p.stock) + '</td></tr>';
}
var TETE_PRODUITS = '<thead><tr><th>Produit<span class="st">désignation · laboratoire</span></th><th>État<span class="st">ce matin</span></th><th>Retour prévu<span class="st">annoncé par le laboratoire</span></th><th class="num">Stock<span class="st">toutes plateformes</span></th></tr></thead>';
function vueAujourdhui() {
  var tous = PRODUITS.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) { return ORDRE_ETAT[a.p.etat] - ORDRE_ETAT[b.p.etat] || a.i - b.i; });
  var cpt = {}; tous.forEach(function (x) { cpt[x.p.etat] = (cpt[x.p.etat] || 0) + 1; });
  var vis = tous.filter(function (x) { return (E.etat === 'tous' || x.p.etat === E.etat) && filtreQ(x.p.produit + ' ' + x.p.labo); });
  var chips = '<div class="seg ap-etats" role="group" aria-label="État des produits"><button type="button" data-etat="tous" aria-pressed="' + (E.etat === 'tous') + '">Tous <span class="cnt">' + tous.length + '</span></button>' +
    Object.keys(ORDRE_ETAT).map(function (k) { return cpt[k] ? '<button type="button" data-etat="' + esc(k) + '" aria-pressed="' + (E.etat === k) + '">' + J.ico(ICO_ETAT[k][0], ICO_ETAT[k][1]) + esc(k) + ' <span class="cnt">' + cpt[k] + '</span></button>' : ''; }).join('') + '</div>';
  var rows = vis.map(function (x, i) { return ligneProduit(x.p, i); }).join('');
  return '<section class="carte ap-tab ap-auj" aria-label="Les produits suivis aujourd’hui"><div class="tete"><div><h2>Les produits que le réseau suit aujourd’hui</h2><p class="st">les références les plus demandées par les officines · ruptures d’abord · « Contingenté » est le même badge que sur le comptoir du Catalogue produits : un quota par commande</p></div>' + chips + '</div>' +
    '<table class="tabl">' + TETE_PRODUITS + '<tbody>' + (rows || '<tr><td colspan="4" class="ap-vide">Aucun produit ne répond à « ' + esc(E.q) + ' » dans cet état.</td></tr>') + '</tbody></table></section>';
}
/* ---------- vue « Anticiper » : ce qui va manquer, dans N jours (grand chiffre encre + trait de délai sur 30 jours), raison = mot + icône ---------- */
function vueAnticiper() {
  var vis = ANTI.filter(function (a) { return filtreQ(a.produit + ' ' + a.raison); }), horizon = 30;
  var rows = vis.map(function (a, i) {
    return '<tr style="--i:' + i + '"><td data-l="Produit"><b class="ap-prod">' + esc(a.produit) + '</b>' + (a.suite.length ? '<span class="sub">puis ' + a.suite.map(function (s) { return 'dans ' + s.jours + ' jours · ' + esc(s.raison); }).join(', ') + '</span>' : '') + '</td>' +
      '<td data-l="Manque dans"><div class="ap-delai"><b class="num">' + a.jours + '<small>j</small></b><span class="ap-pist ap-pist-d" aria-hidden="true"><i style="width:' + Math.min(100, a.jours / horizon * 100).toFixed(1) + '%"></i></span></div></td>' +
      '<td data-l="Raison"><span class="etat">' + J.ico(ICO_RAISON[a.raison] || 'bell', 'var(--e-attention)') + esc(J.maj(a.raison)) + '</span></td>' +
      '<td class="ap-act"><button type="button" class="pil" data-stub="' + STUB('Prévenir mes officines') + '">' + J.ico('send') + 'Prévenir<span class="long">mes officines</span></button></td></tr>'; }).join('');
  return '<section class="carte ap-tab ap-anti" aria-label="Ce qui va manquer"><div class="tete"><div><h2>' + (vis.length ? 'Le plus urgent : ' + esc(vis[0].produit.split(',')[0]) : 'Rien à anticiper') + '</h2><p class="st">les produits qui vont manquer et pourquoi · le plus urgent d’abord · le trait mesure le délai sur ' + horizon + ' jours · un second manque éventuel est écrit sous le produit</p></div></div>' +
    '<table class="tabl"><thead><tr><th>Produit<span class="st">désignation · manque suivant</span></th><th>Manque dans<span class="st">jours · délai sur ' + horizon + ' jours</span></th><th>Raison<span class="st">d’après les prévisions</span></th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4" class="ap-vide">Aucun produit ne répond à « ' + esc(E.q) + ' ».</td></tr>') + '</tbody></table></section>';
}
/* ---------- vue « Calendrier » : ruptures attendues et retours annoncés, mois par mois (colonnes groupées, 2 séries, sans axes, lecture au doigt) ---------- */
function calSvg(w) {
  var h = 230, T = 30, B = 32, n = CAL.length, iw = w - 8, ih = h - T - B, max = Math.max.apply(null, CAL.map(function (m) { return Math.max(m.ruptures, m.retours); }).concat([1]));
  var g = Math.min(34, iw / n * .26), X = function (i) { return 4 + (i + .5) * iw / n; }, Y = function (v) { return T + ih - Math.max(4, v / max * ih); };
  var s = '<svg class="colonnes" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Ruptures attendues et retours annoncés par mois"><line x1="4" x2="' + (w - 4) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '" stroke="var(--filet)" stroke-width="1.5"/>';
  CAL.forEach(function (m, i) {
    [['ruptures', 'var(--cat-2)', -1], ['retours', 'var(--cat-3)', 1]].forEach(function (sr) { var v = m[sr[0]], x = X(i) + sr[2] * (g / 2 + 3) - g / 2, y = Y(v);
      s += '<rect class="bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + g.toFixed(1) + '" height="' + (T + ih - y).toFixed(1) + '" rx="6" fill="' + sr[1] + '" style="transform-origin:' + (x + g / 2).toFixed(1) + 'px ' + (T + ih) + 'px;animation-delay:' + (i * 60) + 'ms"/>';
      s += '<text x="' + (x + g / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" font-size="13" font-weight="700" text-anchor="middle" fill="var(--enc-1)">' + v + '</text>'; });
    s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 9) + '" font-size="13" font-weight="600" text-anchor="middle" fill="var(--enc-1)">' + esc(J.maj(J.ml(m.mois))) + '</text>';
    s += '<g class="zone" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="0" width="' + (iw / n).toFixed(1) + '" height="' + h + '" fill="transparent"/></g>'; });
  return s + '</svg>';
}
function vueCalendrier() {
  /* « ramène le plus de produits » = le plus de retours annoncés (ce que dit la phrase), pas le meilleur solde */
  var pire = CAL.reduce(function (p, m) { return m.ruptures > p.ruptures ? m : p; }, CAL[0]), mieux = CAL.reduce(function (p, m) { return m.retours > p.retours ? m : p; }, CAL[0]);
  return '<section class="carte ap-cal" aria-label="Calendrier des ruptures et des retours"><div class="tete"><div><h2>Le mois le plus tendu sera ' + esc(J.ml(pire.mois)) + ' ; ' + esc(J.ml(mieux.mois)) + ' ramène le plus de produits</h2><p class="st">ruptures attendues et retours annoncés par les laboratoires, de ' + esc(J.ml(CAL[0].mois)) + ' à ' + esc(J.ml(CAL[CAL.length - 1].mois)) + ' · touchez un mois pour le lire</p></div></div>' +
    '<div class="chart-box ap-chart" id="ap-cal-box"></div><p class="lecteur" id="ap-cal-lect" aria-live="polite">Touchez ou survolez un mois pour lire son détail.</p>' +
    '<div class="leg"><span><i class="puce" style="background:var(--cat-2)"></i>Ruptures attendues</span><span><i class="puce" style="background:var(--cat-3)"></i>Retours annoncés</span></div>' +
    '<details class="tabm"><summary>Voir le tableau</summary><table class="tabl"><thead><tr><th>Mois</th><th class="num">Ruptures attendues</th><th class="num">Retours annoncés</th><th class="num">Solde</th></tr></thead><tbody>' +
    CAL.map(function (m) { var d = m.retours - m.ruptures; return '<tr><td>' + esc(J.maj(J.ml(m.mois))) + '</td><td class="num">' + m.ruptures + '</td><td class="num">' + m.retours + '</td><td class="num">' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '</td></tr>'; }).join('') + '</tbody></table></details></section>';
}
function apresCal(el) {
  var box = $('#ap-cal-box', el); if (!box) return;
  J.dessine(box, calSvg, function (b) { J.lie(b, CAL.map(function (m) { return '<b>' + esc(J.maj(J.ml(m.mois))) + '</b> : ' + m.ruptures + ' rupture' + (m.ruptures > 1 ? 's' : '') + ' attendue' + (m.ruptures > 1 ? 's' : '') + ', ' + m.retours + ' retour' + (m.retours > 1 ? 's' : '') + ' annoncé' + (m.retours > 1 ? 's' : '') + '.'; }), $('#ap-cal-lect', el)); });
}
J.approCommun = { E: E, ETABS: ETABS, PRODUITS: PRODUITS, ANTI: ANTI, CAL: CAL, MOY: MOY, TOT: TOT, PAR_COUV: PAR_COUV, ORDRE_ETAT: ORDRE_ETAT, TETE_PRODUITS: TETE_PRODUITS, rangCouv: rangCouv, etabParCode: etabParCode, manqueIci: manqueIci, couvHtml: couvHtml, etatHtml: etatHtml, stockHtml: stockHtml, ligneProduit: ligneProduit, avisVp: avisVp, STUB: STUB, tableEtabs: tableEtabs, vueAujourdhui: vueAujourdhui, vueAnticiper: vueAnticiper, vueCalendrier: vueCalendrier, apresCal: apresCal };
})();
/* ====================================================================================================================
   L'ÉCRAN : bandeau de recherche (la phrase-réponse porte les totaux), choix de la vue, la vue, puis la couverture par établissement.
   LE DÉTAIL (#appro-detail) : une plateforme = carte d'identité (nom, couverture en grand, clé-valeur, actions), ses références face aux autres, ce qui manque ici.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, S = J.S, C = J.approCommun; if (!C) return;
var E = C.E, ETABS = C.ETABS, PRODUITS = C.PRODUITS, ANTI = C.ANTI, CAL = C.CAL, MOY = C.MOY, TOT = C.TOT, PAR_COUV = C.PAR_COUV, STUB = C.STUB;
/* deux vues en tableau (le segment les NOMME, sans compteur : le filtre d'état compte déjà, et un chiffre ne s'écrit pas deux fois) ; le calendrier est TOUJOURS visible
   (un graphique ne se cache pas derrière un clic : seuls les tableaux se replient) ; puis la couverture par établissement */
var VUES = [['aujourdhui', 'Aujourd’hui'], ['anticiper', 'Anticiper']], RACINE = null;
function corps() { return (E.vue === 'anticiper' ? C.vueAnticiper() : C.vueAujourdhui()) + C.vueCalendrier() + C.tableEtabs(); }
function lier(el) {
  $$('tr[data-etab]', el).forEach(function (tr) { var go = function () { E.etab = tr.getAttribute('data-etab'); J.aller('appro-detail'); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  $$('[data-etat]', el).forEach(function (b) { b.onclick = function () { E.etat = b.getAttribute('data-etat'); redessiner(); }; });
  J.poseIcones(el); C.apresCal(el);
}
/* redessine depuis le conteneur d'écran (RACINE), jamais depuis la boîte elle-même : querySelector ne trouve que des descendants, et les pastilles d'état restaient inertes */
function redessiner() { var box = RACINE && $('#ap-corps', RACINE); if (!box) return; box.innerHTML = corps(); lier(box); }
function principal(el) {
  RACINE = el;
  var lede = '<span data-interne><b>' + nf.format(TOT.ruptures) + ' références en rupture</b>, <b>' + nf.format(TOT.enTension) + ' en tension</b> et <b>' + nf.format(TOT.quotas) + ' sous quota</b> ce matin, sur les ' + ETABS.length + ' établissements d’Intégral Pharma. Les quotas sont ceux du comptoir ; un clic sur une plateforme ouvre son détail.</span><span class="vp">Outil réservé à l’équipe Intégral.</span>';
  el.innerHTML = '<div class="page">' + J.bandeau({
    croix: true, eyebrow: 'Appro Intégral · stock des plateformes', titre: 'Appro', lede: lede,
    actions: '<button class="pil" type="button" data-interne data-stub="' + STUB('Exporter l’état du stock en PDF') + '">' + J.ico('doc') + 'Exporter en PDF</button><a class="pil" href="#produits" data-interne>' + J.ico('box') + 'Ouvrir le comptoir</a>',
    recherche: { id: 'ap-q', placeholder: window.innerWidth < 760 ? 'Un produit, un laboratoire…' : 'Un produit, un laboratoire ou un établissement…', aria: 'Rechercher un produit, un laboratoire ou un établissement', valeur: E.q },
    bas: '<span class="lbl">Voir :</span><div class="seg ap-vues" role="group" aria-label="Vue">' + VUES.map(function (v) { return '<button type="button" data-apvue="' + v[0] + '" aria-pressed="' + (E.vue === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>'
  }) + '<div class="ap-corps stack entre" id="ap-corps" data-interne>' + corps() + '</div>' + C.avisVp() + '</div>';
  lier($('#ap-corps', el));
  /* vue pharmacien : les outils du bandeau (actions, recherche, segment) sont internes, comme sur l'écran To do */
  $$('.ban-act,.rech-g,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  $$('[data-apvue]', el).forEach(function (b) { b.onclick = function () { E.vue = b.getAttribute('data-apvue'); E.etat = 'tous'; J.route(); }; });
  $('#ap-q', el).oninput = function (e) { E.q = e.target.value; redessiner(); };
}
/* ---------- le détail d'une plateforme ---------- */
function detail(el) {
  var e = C.etabParCode(E.etab) || PAR_COUV[0]; E.etab = e.code;
  var k = ETABS.indexOf(e), idx = PAR_COUV.indexOf(e), rang = C.rangCouv(e), nb = ETABS.length;
  var manquants = PRODUITS.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return C.manqueIci(k, x.i); }).sort(function (a, b) { return C.ORDRE_ETAT[a.p.etat] - C.ORDRE_ETAT[b.p.etat] || a.i - b.i; });
  var pill = e.couverture < 75 ? '<span class="etat">' + J.ico('bell', 'var(--e-alerte)') + 'Couverture faible</span>' : e.couverture < 90 ? '<span class="etat">' + J.ico('bell', 'var(--e-attention)') + 'À surveiller</span>' : '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Bien couverte</span>';
  /* vue pharmacien : seul le bouton Retour reste ; flèches et menu des plateformes sont internes */
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Appro</button><div class="ap-outils-i" data-interne><div class="ap-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Plateforme précédente">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Plateforme suivante">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre ap-autre">' + J.ico('search') + '<select id="ap-autre" aria-label="Autre plateforme"><option value="">Autre plateforme…</option>' + PAR_COUV.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.nom) + ' (' + esc(x.code) + ')</option>'; }).join('') + '</select></label></div>';
  var actions = '<div class="ronds">' + J.rond('phone', 'Appeler', STUB('Appeler la plateforme'), 1) + J.rond('mail', 'E-mail', STUB('Écrire à la plateforme')) + J.rond('doc', 'PDF', STUB('Exporter l’état du stock')) + '</div>' +
    '<a class="pil plein" href="#produits">' + J.ico('box') + 'Ouvrir le comptoir</a><button class="pil contour" type="button" data-stub="' + STUB('Prévenir mes officines') + '">' + J.ico('send') + 'Prévenir mes officines</button>';
  var plus = e.ruptures > MOY.ruptures, titreCmp = (plus ? 'Plus de références en rupture que la plateforme moyenne' : 'Moins de références en rupture que la plateforme moyenne') + (e.enTension > MOY.enTension ? ', et plus en tension' : ', et moins en tension');
  var cmp = '<section class="carte ap-tab ap-cmp" aria-label="Face aux autres plateformes"><div class="tete"><div><h2>' + titreCmp + '</h2><p class="st">toutes les plateformes côte à côte, celle-ci sur fond bleu · « × N la moyenne » compare à la plateforme moyenne · un clic change de plateforme</p></div></div>' +
    '<table class="tabl"><thead><tr><th>Établissement</th><th class="num">Références en rupture</th><th class="num">En tension<span class="st">stock sous 10 jours</span></th><th class="num">Sous quota<span class="st">contingentées</span></th></tr></thead><tbody>' +
    PAR_COUV.map(function (x, i) { return '<tr class="ap-l' + (x === e ? ' lu' : '') + '" data-etab="' + esc(x.code) + '" tabindex="0" role="link" aria-label="Ouvrir ' + esc(x.nom) + '" style="--i:' + i + '"' + (x === e ? ' aria-current="true"' : '') + '><td data-l="Établissement"><div class="ap-id"><span class="ap-av" aria-hidden="true">' + esc(x.code) + '</span><div class="ap-txt"><b class="ap-nom">' + esc(x.nom) + '</b>' + (x === e ? '<span class="sub">cette plateforme</span>' : '') + '</div></div></td>' +
      '<td class="num" data-l="Références en rupture"><b>' + nf.format(x.ruptures) + '</b>' + J.fois(x.ruptures, MOY.ruptures) + '</td><td class="num" data-l="En tension"><b>' + nf.format(x.enTension) + '</b>' + J.fois(x.enTension, MOY.enTension) + '</td><td class="num" data-l="Sous quota"><b>' + nf.format(x.quotas) + '</b>' + J.fois(x.quotas, MOY.quotas) + '</td></tr>'; }).join('') + '</tbody></table></section>';
  var manque = '<section class="carte ap-tab ap-auj" aria-label="Ce qui manque ici aujourd’hui"><div class="tete"><div><h2>Ce qui manque ici aujourd’hui</h2><p class="st">parmi les produits que le réseau suit, ceux qui font défaut sur cette plateforme · ruptures d’abord · répartition fictive entre les plateformes (données de démonstration)</p></div></div>' +
    (manquants.length ? '<table class="tabl">' + C.TETE_PRODUITS + '<tbody>' + manquants.map(function (x, i) { return C.ligneProduit(x.p, i); }).join('') + '</tbody></table>' : '<p class="note">Aucun des produits suivis ne manque ici ce matin.</p>') + '</section>';
  el.innerHTML = '<div class="page">' + J.bandeau({ classe: 'ap-ban-det', deborde: true, eyebrow: '<span data-interne>Appro · plateforme ' + esc(e.code) + '</span><span class="vp">Appro</span>', recherche: '<div class="ap-outils">' + outils + '</div>' }) +
    '<div class="sous-bandeau stack entre" data-interne>' + J.identite({ classe: 'ap-ident', nom: esc(e.nom), meta: pill + '<span>' + J.ordre(rang) + ' en couverture parmi les ' + nb + ' plateformes</span>',
      mois: { lib: 'Couverture ce matin', val: e.couverture + ' %', evo: '<span class="sub">références du catalogue disponibles · moyenne des plateformes ' + nf.format(Math.round(MOY.couverture)) + ' %</span>' },
      lignes: [['Code', esc(e.code)], ['Plateforme', esc(e.nom)], ['Produits suivis qui manquent ici', manquants.length ? nf.format(manquants.length) + ' sur ' + nf.format(PRODUITS.length) : 'aucun'], ['Quotas', 'les mêmes que le badge du comptoir'], ['Mise à jour', 'ce matin, à l’ouverture de la plateforme']], actions: actions }) +
    cmp + manque + '</div>' + C.avisVp() + '</div>';
  J.poseIcones(el);
  $$('tr[data-etab]', el).forEach(function (tr) { var go = function () { E.etab = tr.getAttribute('data-etab'); J.route(); window.scrollTo(0, 0); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var n = idx + (+b.getAttribute('data-pn')); if (n < 0) n = PAR_COUV.length - 1; if (n >= PAR_COUV.length) n = 0; E.etab = PAR_COUV[n].code; J.route(); window.scrollTo(0, 0); }; });
  $('#ap-autre', el).onchange = function (ev) { if (ev.target.value) { E.etab = ev.target.value; J.route(); window.scrollTo(0, 0); } };
}
J.ecrans.appro = { rendre: function (el, etat) { if (etat.suite === 'detail') detail(el); else principal(el); } };
})();
