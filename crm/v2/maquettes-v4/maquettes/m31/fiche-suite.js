/* m31 — fiche (suite) : courbe des ventes visible, notre marge, catégories, place parmi nos clients, top 10, ne commande plus, rendez-vous et notes. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, MOY = J.MOY, S = J.S, P = J.P, T = function (a, b) { return J.T(a, b); };
function ordre(n) { return n + (n === 1 ? 're' : 'e'); }
var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
function courbeCarte(F, c) {
  return '<section class="carte c-courbe" id="f-courbe" style="--i:3"><div class="cg-tete"><div><h2 id="f-titre-c"></h2><p class="note" id="f-sous-c"></p></div>' +
    '<div class="seg" role="group" aria-label="Série"><button type="button" data-serie="ca" aria-pressed="' + (S.serie === 'ca') + '">Chiffre d’affaires</button><button type="button" data-serie="marges" aria-pressed="' + (S.serie === 'marges') + '">Marges</button></div></div>' +
    '<div class="chart-box" id="f-histo"></div><p class="lecteur" id="f-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg" id="f-leg"></div>' +
    '<details class="tabm"><summary>Voir le tableau</summary><div id="f-tab"></div></details></section>';
}
function dessinerCourbe(F, c) {
  var pv = c.pv, mois = c.mois, cm = c.cm, last = cm.length - 1, best = cm.indexOf(Math.max.apply(null, cm)), cfg, textes;
  var ml = function (l) { return J.ml(l); };
  if (S.serie === 'ca') {
    var pct = cm[last - 1] ? Math.round((cm[last] - cm[last - 1]) / cm[last - 1] * 100) : 0;
    $('#f-titre-c').textContent = J.maj(ml(mois[last])) + (pct < 0 ? ' recule de ' : ' progresse de ') + Math.abs(pct) + ' % sur ' + ml(mois[last - 1]) + (pv ? '' : ' · ×' + nf1.format(c.ratio) + ' la moyenne de nos clients');
    $('#f-sous-c').textContent = T('Votre chiffre d’affaires net hors taxes par mois', 'Chiffre d’affaires net hors taxes par mois') + ', ' + F.periode + '. Record : ' + ml(mois[best]) + ' (' + eur(cm[best]) + ').';
    cfg = { labels: mois, a: { vals: cm, col: 'var(--c-ca)' }, fmt: J.eurM, repere: pv ? null : { v: MOY.caMois, txt: 'Moyenne de nos clients · ' + eur(MOY.caMois) }, aria: 'Chiffre d’affaires par mois', id: 'ca' };
    textes = cm.map(function (v, i) { return '<b>' + ml(mois[i]) + ' 2026</b> : ' + eur(v) + (pv ? '' : ', ' + (v >= MOY.caMois ? 'au-dessus' : 'sous') + ' la moyenne de nos clients (' + eur(MOY.caMois) + ')'); });
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-ca)"></i>' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + '</span>' + (pv ? '' : '<span data-interne><i class="trait"></i>Moyenne de nos clients · ' + eur(MOY.caMois) + '</span>');
  } else {
    var ph = F.margePharmacienParMois, nu = F.margeNousParMois;
    $('#f-titre-c').textContent = pv ? 'Votre marge de pharmacien : ' + eur(ph[last]) + ' en ' + ml(mois[last]) : 'Marges en ' + ml(mois[last]) + ' : ' + eur(ph[last]) + ' pour le pharmacien, ' + eur(nu[last]) + ' pour nous';
    $('#f-sous-c').textContent = 'Même unité (euros par mois), ' + F.periode + (pv ? '.' : '. Notre marge : estimation, génériques comptés à zéro.');
    cfg = { labels: mois, a: { vals: ph, col: 'var(--c-pharma)' }, b: pv ? null : { vals: nu, col: 'var(--c-nous)' }, fmt: J.eurM, aria: 'Marges par mois', id: 'mg' };
    textes = ph.map(function (v, i) { return '<b>' + ml(mois[i]) + ' 2026</b> : marge du pharmacien ' + eur(v) + (pv ? '' : ', notre marge ' + eur(nu[i])); });
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-pharma)"></i>' + T('Votre marge', 'Marge du pharmacien') + '</span>' + (pv ? '' : '<span data-interne><i class="puce" style="background:var(--c-nous)"></i>Notre marge Intégral</span>');
  }
  J.dessine($('#f-histo'), function (w) { return J.courbe(cfg, w); }, function (box) { J.lie(box, textes, $('#f-lect')); });
  var rows = cm.map(function (v, i) { var p = i ? cm[i - 1] : 0; return '<tr><td>' + ml(mois[i]) + '</td><td class="num">' + eur(v) + '</td><td class="num">' + (i && p ? J.signe((v - p) / p * 100) : '—') + '</td></tr>'; }).join('');
  $('#f-tab').innerHTML = '<table class="tab"><thead><tr><th>Mois</th><th>Chiffre d’affaires net hors taxes</th><th>Évolution sur un mois</th></tr></thead><tbody>' + rows + '<tr class="cumul"><td>Cumul janv.–oct. 2026</td><td class="num">' + eur(F.ca) + '</td><td></td></tr></tbody></table><p class="note">Net : au prix facturé par Intégral, hors taxes, avoirs déduits.</p>';
}
function margeCarte(F, c) {
  var fam = P.secteurs[0].mois[11].margeParFamille.filter(function (f) { return f.part > 0; }), tot = F.margeNous, moy = MOY.margeNousMois * 10, r = moy ? tot / moy : 0;
  var mx = Math.max.apply(null, fam.map(function (f) { return f.part; }));
  return '<section class="carte" data-interne style="--i:4"><h2>Ce que cette officine nous rapporte</h2><p class="note">Notre marge cumulée · ' + F.periode + ' · comparée à la moyenne de nos ' + nf.format(MOY.nClients) + ' clients sur le même nombre de mois livrés</p>' +
    '<div class="duo"><div><span class="co-l">Total</span><div class="grand num">' + eur(tot) + '</div></div><div><span class="co-l">Moyenne de nos clients</span><div class="grand num gris">' + eur(moy) + '</div></div><div><span class="co-l">Face à la moyenne</span><div class="grand num">×' + nf1.format(r) + '</div></div></div>' +
    '<div class="lp-tab">' + fam.map(function (f) { return '<div class="lp-l"><span class="lp-nom"><b>' + esc(f.nom) + '</b></span><span class="lp-bar"><span class="bar12"><i style="width:' + (f.part / mx * 100).toFixed(1) + '%;background:var(--c-nous)"></i></span><span class="num">' + nf1.format(f.part) + ' % · ' + eur(tot * f.part / 100) + '</span></span></div>'; }).join('') + '</div>' +
    '<p class="note">Génériques comptés à zéro. Répartition proportionnelle au réseau (valeurs fictives).</p></section>';
}
function frisePlace(F) {
  var n = 64, bars = '', pos = Math.max(1, Math.min(n, Math.round(F.rang.france / F.rang.surFrance * n))), w = 100 / n;
  for (var i = 0; i < n; i++) { var t = i / (n - 1), h = 10 + 62 * Math.exp(-Math.pow((t - .22) / .2, 2)) + 5 * Math.sin(i * 1.7); bars += '<i class="fb' + (i === n - pos ? ' moi' : '') + '" style="left:' + (i * w).toFixed(2) + '%;height:' + h.toFixed(0) + 'px"></i>'; }
  return '<div class="posit" data-interne><h3>Place parmi nos clients</h3><div class="frise-d" role="img" aria-label="Répartition de nos ' + nf.format(F.rang.surFrance) + ' clients par chiffre d’affaires ; cette officine est ' + ordre(F.rang.france) + '">' + bars + '</div><div class="frise-ax"><span>Plus petit chiffre d’affaires</span><span>Plus grand</span></div><p class="note">Elle est ici · ' + ordre(F.rang.france) + ' sur ' + nf.format(F.rang.surFrance) + ', classées par chiffre d’affaires.</p></div>';
}
J.fichesuite = function (el, o, F, c) {
  var pv = c.pv, box = $('#f-suite', el);
  var max = Math.max.apply(null, F.categories.map(function (k) { return Math.max(k.montant, pv ? 0 : k.moyenneClients * 10); })), rdv = F.prochainRendezVous;
  box.innerHTML = courbeCarte(F, c) + margeCarte(F, c) +
    '<section class="carte" id="f-cat" style="--i:5"><h2>' + T('Vos achats par catégorie', 'Ses achats par catégorie') + ' · ' + F.periode + '</h2><p class="note">Un trait par catégorie' + (pv ? '' : ', le repère gris est la moyenne de nos clients sur 10 mois') + '.</p><div class="cbs">' +
    F.categories.map(function (k, i) { var v = k.montant / max * 100, m = k.moyenneClients * 10 / max * 100;
      return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:var(--cat-' + (i + 1) + ')"></span><b>' + esc(k.nom) + '</b></span><span class="cb-v num">' + eur(k.montant) + '</span></div><div class="cb-pist"><i class="cb-b" style="width:' + v.toFixed(1) + '%;background:var(--cat-' + (i + 1) + ')"></i>' + (pv ? '' : '<i class="cb-m" data-interne style="left:' + m.toFixed(1) + '%"></i>') + '</div>' + (pv ? '' : '<div class="cb-p" data-interne><span>moyenne : ' + eur(k.moyenneClients * 10) + '</span><b class="num">×' + nf1.format(k.montant / (k.moyenneClients * 10)) + '</b></div>') + '</div>'; }).join('') + '</div>' + frisePlace(F) + '</section>' +
    '<div class="gdeux stack" style="--i:6"><section class="carte"><h2>Top 10 · famille de produits</h2><p class="note">Désignation, euros et boîtes.</p><div class="lp-tab">' + F.top10.map(function (p, i) { return '<div class="lp-l"><span class="lp-nom"><b>' + (i + 1) + '. ' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></span><span class="num cat-v">' + eur(p.montant) + ' · ' + nf.format(p.quantite) + ' boîtes</span></div>'; }).join('') + '</div></section>' +
    '<section class="carte" id="f-ne"><h2>' + T('Ce que vous ne commandez plus', 'Ce qu’elle ne commande plus') + '</h2><p class="note">' + F.nePlusCommande.length + ' produits commandés au moins 4 mois, absents du dernier mois. Case pleine : commandé ce mois-là.</p><div class="lp-tab">' +
    F.nePlusCommande.map(function (p) { var k = new Date(p.derniereCommande).getMonth(), cases = ''; for (var i = 0; i < 10; i++) cases += '<i class="' + (i <= k && i > k - 5 ? 'plein' : '') + '"></i>'; return '<div class="lp-l"><span class="lp-nom"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">Dernière commande : ' + J.dateFr(p.derniereCommande) + '</span></span><span class="frise-m" aria-label="Mois commandés">' + cases + '</span></div>'; }).join('') + '</div>' +
    '<div class="mois-ax"><span>janv.</span><span>oct.</span></div></section></div>' +
    '<section class="carte" data-interne style="--i:7"><h2>Rendez-vous, notes et tâches</h2><div class="rdv"><span class="rond gris"><span class="ico" data-ico="cal"></span></span><div><b>Prochain rendez-vous : ' + J.dateFr(rdv.date) + ' à ' + rdv.heure.replace(':', ' h ') + '</b><span class="sub">' + esc(rdv.lieu) + ' · ' + esc(rdv.objet) + '</span></div><button type="button" class="pil" data-stub="Le rendez-vous n’est pas dessiné dans cette maquette.">Noter un rendez-vous</button></div>' +
    '<div class="gdeux stack"><div><h3>Notes de l’équipe</h3>' + F.notes.map(function (n) { return '<p class="nt"><span class="co-l">' + J.dateFr(n.date) + '</span>' + esc(n.texte) + '</p>'; }).join('') + '</div><div><h3>Tâches</h3>' + F.taches.map(function (t) { return '<p class="nt tk"><span class="ico">' + J.icoSvg(t.fait ? 'check' : 'list', t.fait ? 'var(--e-bien)' : 'var(--e-neutre)') + '</span><span>' + esc(t.texte) + '<span class="co-l"> · ' + J.dateFr(t.echeance) + '</span></span></p>'; }).join('') + '</div></div></section>';
  J.poseIcones(box);
  dessinerCourbe(F, c);
  $$('[data-serie]', box).forEach(function (b) { b.onclick = function () { S.serie = b.getAttribute('data-serie'); $$('[data-serie]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); dessinerCourbe(F, c); }; });
};
})();
