/* Base Biosimilaires (#biosimilaires). Bandeau bleu (recherche, aire, canal), chips Substituables / Partenaires / Chez Intégral, quatre cartes à grand chiffre,
   les cinq fiches à télécharger (boutons ronds), puis une carte par molécule qui se lit comme une fiche d'identité (résumé toujours visible avec la pénétration en barre ;
   repliée : clé-valeur + tableau des biosimilaires, net Intégral en interne).
   Le prix d'achat de l'officine avant abandon de marge s'écrit « tarif hors taxes » : ce n'est pas le prix fabricant.
   Les quatre grands chiffres se comptent dans les molécules affichées (X.molecules), pas dans la « meta » de la base entière.
   Données : DONNEES_V5.biosimilaires (fictives). */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, X = J.X.biosimilaires, M = X.meta;
var B = J.S.biosimilaires = { q: '', aire: '', canal: 'tous', sub: false, part: false, ip: false, ouverts: null };
var PART = ['Laboratoire 3', 'Laboratoire 4', 'Laboratoire 5'], STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var ICO_T = ['down', 'doc', 'doc', 'send', 'send'];
function periode() { var a = M.mois[0].split(' '), b = M.mois[1].split(' '); return 'de ' + J.ml(a[0]) + ' ' + a[1] + ' à ' + J.ml(b[0]) + ' ' + b[1]; }
function aPart(m) { return m.biosims.some(function (b) { return b.partenaire; }); }
function aIP(m) { return m.biosims.some(function (b) { return b.refIP; }); }
function filtrees() {
  var q = B.q.toLowerCase();
  return X.molecules.filter(function (m) {
    if (B.aire && m.aire !== B.aire) return false;
    if (B.canal !== 'tous' && m.canal !== B.canal) return false;
    if (B.sub && !m.substituable) return false;
    if (B.part && !aPart(m)) return false;
    if (B.ip && !aIP(m)) return false;
    if (q && (m.dci + ' ' + m.princeps + ' ' + m.aire + ' ' + m.biosims.map(function (b) { return b.marque + ' ' + b.labo; }).join(' ')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return (b.substituable - a.substituable) || (aPart(b) - aPart(a)) || (b.penetration - a.penetration); });
}
function canalHtml(m) { return '<span class="etat">' + J.ico(m.canal === 'ville' ? 'pharma' : 'box', 'var(--e-neutre)') + (m.canal === 'ville' ? 'Ville' : 'Hôpital') + '</span>'; }
function carte(m, i, ouvert) {
  var labos = []; m.biosims.forEach(function (b) { if (labos.indexOf(b.labo) < 0) labos.push(b.labo); });
  var refs = m.biosims.filter(function (b) { return b.refIP; }).map(function (b) { return b.marque; }), parts = m.biosims.filter(function (b) { return b.partenaire; }).map(function (b) { return b.labo; }).filter(function (v, k, a) { return a.indexOf(v) === k; });
  var tags = (m.substituable ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Substituable en officine</span>' : '') + canalHtml(m) + (parts.length ? '<span class="etat">' + J.ico('star', 'var(--e-bien)') + 'Partenaire</span>' : '') + (refs.length ? '<span class="etat">' + J.ico('coche', 'var(--bleu)') + 'Chez Intégral</span>' : '');
  var sum = '<summary><div class="bs-sum"><div class="bs-nom"><h2>' + esc(J.maj(m.dci)) + '</h2><span class="sub">' + esc(m.aire) + ' · princeps ' + esc(m.princeps) + '</span><div class="bs-tags">' + tags + '</div></div>' +
    '<div class="bs-pen"><span class="bs-lib">Pénétration des biosimilaires en France</span><span class="bs-pbar"><span class="bar12"><i style="width:' + m.penetration + '%;background:var(--c-ca)"></i></span><b class="num">' + m.penetration + ' %</b></span></div>' +
    '<div class="bs-n"><b class="num">' + m.biosims.length + '</b><span>biosimilaire' + (m.biosims.length > 1 ? 's' : '') + '</span></div><span class="ico bs-chev">' + J.icoSvg('chevb') + '</span></div></summary>';
  // la clé-valeur ne redit pas le résumé (molécule, aire, princeps, canal y sont déjà) : elle donne ce qu'il ne dit pas
  var kv = J.kv([['Substituable', m.substituable ? 'Oui · liste de l’arrêté du 10 avril 2026' : 'Non · prescription obligatoire pour changer'], ['Laboratoires', esc(labos.join(' · '))], ['Partenaires', parts.length ? esc(parts.join(' · ')) : 'aucun laboratoire partenaire'], ['Référencés Intégral', refs.length ? esc(refs.join(' · ')) : 'aucune présentation au tarif Intégral']], 'serree');
  var tab = '<table class="tabl bs-tab"><thead><tr><th>Biosimilaire<span class="st">marque · laboratoire</span></th><th>Partenaire</th><th>Chez Intégral</th><th class="num">Tarif<span class="st">hors taxes, avant abandon de marge</span></th><th class="num" data-interne>Net Intégral<span class="st">réservé à l’interne</span></th></tr></thead><tbody>' +
    m.biosims.map(function (b) { return '<tr><td data-l="Biosimilaire"><b class="bs-marque">' + esc(b.marque) + '</b><span class="sub">' + esc(b.labo) + '</span></td><td data-l="Partenaire">' + (b.partenaire ? '<span class="etat">' + J.ico('star', 'var(--e-bien)') + 'Oui</span>' : '<span class="bs-non">non</span>') + '</td><td data-l="Chez Intégral">' + (b.refIP ? '<span class="etat">' + J.ico('coche', 'var(--bleu)') + 'Référencé</span>' : '<span class="bs-non">non référencé</span>') + '</td><td class="num" data-l="Tarif hors taxes"><b>' + J.eur2(b.ppht) + '</b></td><td class="num" data-l="Net Intégral" data-interne><b>' + J.eur2(b.net) + '</b></td></tr>'; }).join('') + '</tbody></table>';
  return '<details class="carte bs-mol" data-dci="' + esc(m.dci) + '"' + (ouvert ? ' open' : '') + ' style="--i:' + Math.min(i, 12) + '">' + sum + '<div class="bs-corps"><div class="bs-deux"><div>' + kv + '</div><div>' + tab + '</div></div></div></details>';
}
function remplir(el) {
  var l = filtrees(), nb = l.reduce(function (s, m) { return s + m.biosims.length; }, 0), box = $('#bs-liste', el);
  if (!B.ouverts) { B.ouverts = {}; l.slice(0, 2).forEach(function (m) { B.ouverts[m.dci] = true; }); }
  var filtre = !!(B.q || B.aire || B.canal !== 'tous' || B.sub || B.part || B.ip);   // sans filtre, les nombres sont déjà dans les quatre cartes : on ne les réécrit pas
  $('#bs-cpt', el).innerHTML = !l.length ? '<b>Aucun résultat pour ces filtres.</b>' : filtre ? '<b>' + l.length + ' molécule' + (l.length > 1 ? 's' : '') + ' · ' + nb + ' biosimilaire' + (nb > 1 ? 's' : '') + '</b> pour ces filtres, substituables et partenaires en tête · touchez une molécule pour sa fiche' : 'Toutes les molécules, substituables et partenaires en tête · touchez une molécule pour sa fiche';
  box.innerHTML = l.map(function (m, i) { return carte(m, i, !!B.ouverts[m.dci]); }).join('');
  $$('details.bs-mol', box).forEach(function (d) { d.addEventListener('toggle', function () { B.ouverts[d.getAttribute('data-dci')] = d.open; }); });
  J.poseIcones(box);
}
J.ecrans.biosimilaires = {
  rendre: function (el) {
    var aires = []; X.molecules.forEach(function (m) { if (aires.indexOf(m.aire) < 0) aires.push(m.aire); }); aires.sort();
    // les quatre grands chiffres se comptent dans les molécules affichées : la « meta » de la donnée décrit une base entière que les cartes dessous ne montrent pas
    var nMol = X.molecules.length, nBio = X.molecules.reduce(function (s, m) { return s + m.biosims.length; }, 0), nSub = X.molecules.filter(function (m) { return m.substituable; }).length, nIP = X.molecules.reduce(function (s, m) { return s + m.biosims.filter(function (b) { return b.refIP; }).length; }, 0);
    var pSub = nMol ? Math.round(nSub / nMol * 100) : 0, pIP = nBio ? Math.round(nIP / nBio * 100) : 0;
    var chip = function (k, txt, on) { return '<button type="button" class="chip bs-chip" data-bs="' + k + '" aria-pressed="' + on + '">' + J.ico(on ? 'coche' : 'plus') + txt + '</button>'; };
    el.innerHTML = '<div class="page">' + J.bandeau({ croix: true, eyebrow: 'Base biosimilaires · ventes ' + periode(), titre: 'Biosimilaires',
      lede: 'Tous les biosimilaires disponibles en France, croisés à vos ventes et aux stocks du réseau. Les <b>substituables en officine</b> et les <b>laboratoires partenaires</b> en tête.',
      recherche: { id: 'bs-q', placeholder: 'Molécule, marque, laboratoire…', aria: 'Rechercher dans la base biosimilaires', valeur: B.q },
      bas: '<span class="lbl">Afficher :</span><div class="seg" role="group" aria-label="Canal"><button type="button" data-canal="tous" aria-pressed="' + (B.canal === 'tous') + '">Ville et hôpital</button><button type="button" data-canal="ville" aria-pressed="' + (B.canal === 'ville') + '">Ville</button><button type="button" data-canal="hopital" aria-pressed="' + (B.canal === 'hopital') + '">Hôpital</button></div>' +
        '<label class="filtre">Aire :<select id="bs-aire" aria-label="Aire thérapeutique"><option value="">Toutes les aires</option>' + aires.map(function (a) { return '<option value="' + esc(a) + '"' + (B.aire === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></label>' +
        /* les trois filtres à cocher sont dans le bandeau */
        '<div class="chips bs-chips" role="group" aria-label="Filtres">' + chip('sub', 'Substituables en officine', B.sub) + chip('part', 'Partenaires · ' + PART.join(' · '), B.part) + chip('ip', 'Chez Intégral', B.ip) + '</div>' }) +
      '<div class="gquatre stack entre bs-synth">' +
        J.stat({ i: 1, lib: 'Molécules', val: nf.format(nMol), note: 'ville et hôpital' }) +
        J.stat({ i: 2, lib: 'Biosimilaires', val: nf.format(nBio), note: 'présentations, toutes molécules confondues' }) +
        J.stat({ i: 3, lib: 'Substituables en officine', val: nf.format(nSub), note: '<span class="bs-prop" role="img" aria-label="' + pSub + ' % des molécules"><i style="width:' + pSub + '%"></i></span>part des molécules' }) +
        J.stat({ i: 4, lib: 'Référencés Intégral', val: nf.format(nIP), note: '<span class="bs-prop" role="img" aria-label="' + pIP + ' % des biosimilaires"><i style="width:' + pIP + '%"></i></span>part des biosimilaires au tarif Intégral' }) + '</div>' +
      '<section class="carte bs-telech"><div class="tete"><div><h2>Les fiches à télécharger</h2><p class="st">espace protégé · les fiches pharmacien ne montrent que le tarif hors taxes, jamais le net Intégral</p></div></div><div class="ronds bs-ronds">' +
        X.telechargements.map(function (t, i) { var interne = !/pharmacien/i.test(t); return J.rond(ICO_T[i], esc(t.replace(' (net IP)', '').replace('·', '·')), STUB('Télécharger « ' + t + ' »'), i === 0, interne ? ' data-interne' : ''); }).join('') + '</div></section>' +
      '<p class="bs-cpt" id="bs-cpt"></p><div class="stack bs-liste" id="bs-liste"></div>' +
      '<section class="carte bs-legende"><div class="tete"><div><h2>Pour lire la base</h2><p class="st">définitions et source</p></div></div>' +
        J.kv([['Substituable officine', 'liste de l’arrêté du 10 avril 2026 : le pharmacien peut délivrer le biosimilaire à la place du princeps'], ['Partenaires', PART.join(' · ') + ' : laboratoires avec lesquels Intégral a un accord'], ['Tarif hors taxes', 'le prix d’achat de l’officine avant abandon de marge, celui des factures'], ['Net Intégral', 'notre prix de cession net, constaté sur les factures · réservé à l’interne', 1], ['Pénétration', 'part des boîtes de biosimilaires dans les ventes de la molécule, en France'], ['Hôpital', 'hors du périmètre officine : pour information'], ['Source', 'base biosimilaires Intégral, générée le ' + esc(M.genere)]], 'serree') + '</section></div>';
    remplir(el);
    $('#bs-q', el).oninput = function (e) { B.q = e.target.value; remplir(el); };
    $('#bs-aire', el).onchange = function (e) { B.aire = e.target.value; remplir(el); };
    $$('[data-canal]', el).forEach(function (b) { b.onclick = function () { B.canal = b.getAttribute('data-canal'); $$('[data-canal]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); remplir(el); }; });
    $$('[data-bs]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-bs'); B[k] = !B[k]; b.setAttribute('aria-pressed', String(B[k])); b.firstChild.innerHTML = J.icoSvg(B[k] ? 'coche' : 'plus'); remplir(el); }; });
    J.poseIcones(el);
  }
};
})();
