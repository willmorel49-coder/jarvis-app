/* Carte des groupements (#carte-groupements). Tout interne ([data-interne] + avis .vp).
   Même langage de carte que La carte : le moteur J.ca.creer (fond local, un rond par officine écarté, zoom, survol, sélection)
   est réutilisé tel quel, en lecture. Ici : menu « Choisir un groupement » dans le grand champ blanc du bandeau (+ Vue d'ensemble = classement des
   groupements), compteur calculé dans la phrase du bandeau, carte avec les adhérents du groupement choisi — clients dans les bleus de La carte (taille et clarté
   selon le chiffre d'affaires), prospects en gris discret, anneau ambre « À rappeler » —, liste à droite (officine, ville, état, chiffre d'affaires) → fiche.
   Données : J.X.carteGroupements (choix, parDefaut), J.C = DONNEES_V4.carte (300 points, champ groupement), J.D.officines (les 40 qui ont une fiche). Fictives. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, eur = J.eur, X = J.X, S = J.S, C = J.C, ca = J.ca;
var CG = X.carteGroupements || {}, SANS = 'Sans groupement';
var GRPS = (CG.choix || []).filter(function (g) { return C.groupements.indexOf(g) >= 0; }); if (!GRPS.length) GRPS = C.groupements.filter(function (g) { return g !== SANS; });
var K = S.cg = S.cg || { grp: GRPS.indexOf(CG.parDefaut) >= 0 ? CG.parDefaut : GRPS[0], f: 'tout', sel: null, nb: 30, focus: null, vuGr: null };
/* les trois états d'un adhérent : cliente (dont « à rappeler »), prospect, et « aucune vente » (ni l'un ni l'autre) — comptés à part, jamais confondus */
function etats(P) { var cl = P.filter(ca.estClient).length, pr = P.filter(function (p) { return p.statut === 'prospect'; }).length; return { n: P.length, cl: cl, pr: pr, sv: P.length - cl - pr }; }
function pl(n, mot) { return nf.format(n) + ' ' + mot + (n > 1 ? 's' : ''); }
var EL = document.getElementById('ecran-carte-groupements'), I = null, ecoute = false;
var BLEUS = ca.BLEUS, BLEU = ca.BLEUS[3], GRIS = ca.GRIS, GRIS2 = ca.GRIS2, AMBRE = ca.AMBRE;
var MOBILE = function () { return window.innerWidth <= 760; };
function duGroupe(p) { return K.grp === 'tout' || p.groupement === K.grp; }
function cherche(p) { var q = (K.q || '').trim().toLowerCase(); return !q || (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + (p.titulaire || '')).toLowerCase().indexOf(q) >= 0; }
function visible(p) { if (!duGroupe(p) || !cherche(p)) return false; var cl = ca.estClient(p); if (K.f === 'clients' && !cl) return false; if (K.f === 'prospects' && cl) return false; return true; }
function couleur(p) { var cl = ca.estClient(p), fade = K.grp === 'tout' && K.focus && p.groupement !== K.focus; if (!cl) return fade ? '#E6E9EF' : (p.statut === 'prospect' ? GRIS : GRIS2); return fade ? '#DCE5F5' : ca.couleurPalier(ca.palier(p)); }
function rayon(p) { return ca.estClient(p) ? ca.PALIER_R[ca.palier(p)] : 4.2; }
function anneau(p) { return p.statut === 'à rappeler' ? AMBRE : null; }
function tip(p) { var cl = ca.estClient(p); return '<b>' + esc(J.joli(p.nom)) + '</b><span>' + esc(p.cp + ' ' + p.ville) + (p.groupement !== SANS ? ' · ' + esc(p.groupement) : '') + '</span><span>' + (cl ? (p.statut === 'à rappeler' ? 'Cliente à rappeler' : 'Cliente') + ' · ' + eur(p.ca) + ' sur ' + ca.NM + ' mois' : (p.statut === 'prospect' ? 'Prospect' : 'Aucune vente')) + '</span>'; }
function teinter() { $$('#cg-pts [data-point]').forEach(function (c) { var p = J.pointById(c.getAttribute('data-point')); if (p) c.setAttribute('fill', couleur(p)); }); }
/* ---------- la phrase-compteur du bandeau (les seuls totaux de l'écran) ---------- */
function compteur() { var e = $('#cg-cpt'); if (!e) return;
  if (K.grp === 'tout') { e.innerHTML = 'Les <b>' + nf.format(GRPS.length) + ' groupements</b> de votre secteur, classés par le chiffre d’affaires de leurs adhérents clientes. Choisissez-en un, dans le menu ou dans le classement, pour voir ses adhérents sur la carte.'; return; }
  /* les adhérents de toute l'équipe (répartition par commercial) ; les « aucune vente » comptés à part des prospects */
  var E = etats(C.points.filter(duGroupe));
  e.innerHTML = '<b>' + pl(E.n, 'adhérent') + '</b> ' + esc(K.grp) + ' sur la carte de votre secteur, toute l’équipe confondue : <b>' + pl(E.cl, 'cliente') + '</b> en bleu, en avant, <b>' + pl(E.pr, 'prospect') + '</b> en gris' +
    (E.sv ? ' et <b>' + nf.format(E.sv) + ' sans vente</b> en gris clair' : '') + '. Un clic ouvre la fiche.'; }
/* ---------- la liste à droite : adhérents du groupement, ou classement des groupements ---------- */
function lignes() { return C.points.filter(visible).sort(function (a, b) { return (ca.estClient(b) ? 1 : 0) - (ca.estClient(a) ? 1 : 0) || b.ca - a.ca || a.nom.localeCompare(b.nom); }); }
function tableGroupe() { var P = lignes(), aff = P.slice(0, K.nb);
  return '<div class="tete"><div><h2>Les adhérents ' + esc(K.grp) + '</h2><p class="st">clientes d’abord, par chiffre d’affaires, puis les prospects · survolez une ligne pour la voir sur la carte</p></div></div>' +
    '<table class="tabl cg-t"><thead><tr><th>Officine<span class="st">ville · état</span></th><th class="num">Chiffre d’affaires<span class="st">' + ca.NM + ' mois</span></th></tr></thead><tbody id="cg-corps">' +
    (aff.length ? aff.map(function (p, i) { var cl = ca.estClient(p); return '<tr data-pt="' + p.id + '" class="cg-l' + (K.sel === p.id ? ' lu' : '') + '" tabindex="0" role="link" aria-label="' + esc(J.joli(p.nom)) + '" style="--i:' + Math.min(i, 12) + '"><td><b class="cg-nom">' + esc(J.joli(p.nom)) + '</b><span class="sub">' + esc(p.cp + ' ' + p.ville) + '</span><span class="cg-etat">' + J.etatHtml(ca.etatDe(p)) + '</span></td><td class="num">' + (cl ? '<b>' + eur(p.ca) + '</b>' + J.fois(p.ca, J.MOY.caMois * ca.NM) : '<span class="cg-vide">—</span>') + '</td></tr>'; }).join('') : '<tr><td colspan="2" class="cg-vide-l">Aucune officine pour ce choix.</td></tr>') + '</tbody></table>' +
    /* data-cg-plus, pas data-plus : data-plus est l'attribut du « + » du socle (Actions rapides), qui s'ouvrait en plus des lignes */
    (P.length > K.nb ? '<div class="cg-pied"><button type="button" class="pil" data-cg-plus>Afficher ' + Math.min(30, P.length - K.nb) + ' de plus</button></div>' : ''); }
function tableClassement() {
  var rows = GRPS.map(function (g) { var P = C.points.filter(function (p) { return p.groupement === g; }), cl = P.filter(ca.estClient), tot = cl.reduce(function (s, p) { return s + p.ca; }, 0), E = etats(P); return { g: g, n: E.n, cl: E.cl, pr: E.pr, sv: E.sv, ca: tot, part: P.length ? cl.length / P.length * 100 : 0 }; }).sort(function (a, b) { return b.ca - a.ca; });
  var max = Math.max.apply(null, rows.map(function (r) { return r.ca; }).concat([1]));
  return '<div class="tete"><div><h2>Le classement des groupements</h2><p class="st">par chiffre d’affaires des adhérents clientes · survolez pour les repérer sur la carte, cliquez pour n’afficher qu’eux</p></div></div>' +
    '<table class="tabl cg-t cg-cl"><thead><tr><th>Groupement<span class="st">adhérents sur la carte : clientes · prospects · sans vente</span></th><th class="num">Chiffre d’affaires<span class="st">clientes · ' + ca.NM + ' mois</span></th></tr></thead><tbody>' +
    rows.map(function (r, i) { return '<tr data-grp="' + esc(r.g) + '" class="cg-l" tabindex="0" role="link" aria-label="Voir les adhérents ' + esc(r.g) + '" style="--i:' + i + '"><td><div class="cg-g"><span class="cg-av" aria-hidden="true">' + esc(r.g.charAt(0)) + '</span><div><b class="cg-nom">' + esc(r.g) + '</b><span class="sub">' + pl(r.n, 'adhérent') + ' : ' + pl(r.cl, 'cliente') + ' · ' + pl(r.pr, 'prospect') + (r.sv ? ' · ' + nf.format(r.sv) + ' sans vente' : '') + '</span></div></div></td><td class="num"><span class="cg-bar"><span class="bar12"><i style="width:' + (r.ca / max * 100).toFixed(1) + '%;background:' + BLEU + '"></i></span><b>' + eur(r.ca) + '</b><span class="fois">' + nf.format(Math.round(r.part)) + ' % de clientes</span></span></td></tr>'; }).join('') + '</tbody></table>'; }
function legende() { return '<b>' + (K.grp === 'tout' ? 'Toutes les officines du secteur' : 'Adhérents ' + esc(K.grp)) + '</b><span><i class="cg-dot" style="width:12px;height:12px;background:' + BLEU + '"></i>Cliente · taille et clarté selon le chiffre d’affaires</span><span><i class="cg-dot" style="width:8px;height:8px;background:' + GRIS + '"></i>Prospect</span><span><i class="cg-dot" style="width:8px;height:8px;background:' + GRIS2 + '"></i>Aucune vente</span><span><i class="cg-dot cg-anneau"></i>À rappeler</span>'; }
/* ---------- la bulle d'un point (sélection) ---------- */
function fermerBulle() { K.sel = null; var b = $('#cg-bulle'); if (b) b.hidden = true; if (I) I.selection(null); $$('.cg-l.lu').forEach(function (r) { r.classList.remove('lu'); }); }
function placerBulle() { var b = $('#cg-bulle'); if (!b || b.hidden || !K.sel || !I) return; var p = J.pointById(K.sel); if (!p) return; var q = I.ecranDe(p), zr = I.zone.getBoundingClientRect(), w = b.offsetWidth, hh = b.offsetHeight;
  var x = q.x - w / 2, y = q.y - q.r - 12 - hh; if (y < 8) y = q.y + q.r + 12; x = Math.max(8, Math.min(zr.width - w - 8, x)); b.style.left = x.toFixed(0) + 'px'; b.style.top = Math.max(8, y).toFixed(0) + 'px'; }
function ouvrirBulle(p) { K.sel = p.id; var b = $('#cg-bulle'), cl = ca.estClient(p), ex = J.offById(p.id);
  b.innerHTML = '<button type="button" class="b-rond cg-bx" data-fermer-bulle aria-label="Fermer la bulle">' + J.ico('close') + '</button><b>' + esc(J.joli(p.nom)) + '</b><span>' + esc(p.cp + ' ' + p.ville) + '</span><span class="cg-bl">' + J.etatHtml(ca.etatDe(p)) + (p.groupement !== SANS ? '<span class="cg-bg">' + esc(p.groupement) + '</span>' : '') + '</span>' +
    (cl ? '<span class="num cg-bca"><b>' + eur(p.ca) + '</b> de chiffre d’affaires · ' + ca.NM + ' mois</span>' : '') +
    (ex ? '<a class="cg-blien" href="#fiche" data-ouvre="' + p.id + '">Ouvrir la fiche →</a>' : '<button type="button" class="cg-blien" data-stub="La fiche complète n’est pas dessinée pour cette officine fictive : seules les ' + J.OFF.length + ' officines du relevé en ont une.">Ouvrir la fiche →</button>');
  J.poseIcones(b); b.hidden = false; I.selection(p.id); placerBulle();
  $$('.cg-l').forEach(function (r) { r.classList.toggle('lu', r.getAttribute('data-pt') === p.id); }); var row = $('.cg-l.lu'); if (row && row.scrollIntoView && !MOBILE()) row.scrollIntoView({ block: 'nearest' });
  $('[data-fermer-bulle]', b).onclick = fermerBulle; var a = $('[data-ouvre]', b); if (a) a.onclick = function (ev) { ev.preventDefault(); J.ouvrirFiche(p.id); }; }
function cadrer() { var g = $('#cg-grille'), z = $('#cg-zone'); if (!g || !z) return; var h = window.innerHeight - z.getBoundingClientRect().top - (MOBILE() ? 100 : 24); h = Math.max(MOBILE() ? 420 : 520, Math.min(MOBILE() ? 560 : 760, isFinite(h) ? h : 0)); g.style.setProperty('--cg-h', h + 'px'); }
/* ---------- mise à jour sans reconstruire la carte ---------- */
function majListe(el) { $('#cg-liste', el).innerHTML = K.grp === 'tout' ? tableClassement() : tableGroupe(); J.poseIcones($('#cg-liste', el)); lierListe(el); }
function libGr() { return K.grp === 'tout' ? 'Les groupements' : 'Le groupement'; }
function maj(el) { var s = $('#cg-grp', el); if (s && s.value !== K.grp) s.value = K.grp; var lg = $('.cg-gr-t', el); if (lg) lg.textContent = libGr(); compteur(); $('#cg-leg', el).innerHTML = legende(); fermerBulle(); if (I) { teinter(); I.maj(); } majListe(el); }
function lierListe(el) {
  $$('tr[data-pt]', el).forEach(function (tr) { var p = J.pointById(tr.getAttribute('data-pt')); if (!p) return;
    tr.onmouseenter = function () { if (!MOBILE() && I) I.survol(p); }; tr.onmouseleave = function () { if (I) I.survol(null); };
    var go = function () { if (J.offById(p.id)) J.ouvrirFiche(p.id); else { if (I) I.centrer(p, 2.5); ouvrirBulle(p); } }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
  $$('tr[data-grp]', el).forEach(function (tr) { var g = tr.getAttribute('data-grp');
    tr.onmouseenter = function () { if (MOBILE()) return; K.focus = g; teinter(); }; tr.onmouseleave = function () { K.focus = null; teinter(); };
    var go = function () { K.grp = g; K.focus = null; K.nb = 30; maj(el); if (I) I.vue('pos'); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
  var plus = $('[data-cg-plus]', el); if (plus) plus.onclick = function () { K.nb += 30; majListe(el); };
}
function construire(el) {
  var seg = [['tout', 'Tout'], ['clients', 'Clientes'], ['prospects', 'Prospects']].map(function (f) { return '<button type="button" data-cgf="' + f[0] + '" aria-pressed="' + (K.f === f[0]) + '">' + f[1] + '</button>'; }).join('');
  el.innerHTML = '<div class="page cg-page">' + J.bandeau({ croix: true, classe: 'cg-ban', eyebrow: '<span data-interne>Carte des groupements<span class="long"> · ' + nf.format(C.departements.length) + ' départements · ventes à jour à fin ' + ca.FIN + '</span></span><span class="vp">Outil interne · vue pharmacien</span>', titre: 'Carte des groupements', lede: '<span id="cg-cpt"></span>',
    recherche: { id: 'cg-q', placeholder: window.innerWidth < 760 ? 'Une pharmacie, une ville…' : 'Une pharmacie, une ville, un code postal…', aria: 'Rechercher un adhérent sur la carte', valeur: K.q || '' },
    sous: '<label class="filtre cg-choix">' + J.ico('group') + '<span class="cg-choix-l">Groupement</span><select id="cg-grp" aria-label="Choisir un groupement"><option value="tout"' + (K.grp === 'tout' ? ' selected' : '') + '>Vue d’ensemble · le classement des groupements</option>' + GRPS.map(function (g) { return '<option value="' + esc(g) + '"' + (K.grp === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>',
    /* « Le groupement » : le chemin de retour vers l'espace Groupements (sa page, ou la liste en vue d'ensemble) */
    bas: '<span class="lbl">Afficher :</span><div class="seg" role="group" aria-label="Afficher">' + seg + '</div><div class="cg-liens"><button type="button" class="pil" data-cg-gr>' + J.ico('group') + '<span class="cg-gr-t">' + libGr() + '</span></button><a class="pil" href="#carte">' + J.ico('pin') + 'La carte<span class="long"> complète</span></a></div>' }) +
  '<p class="vp note cg-vp">Vue pharmacien : la carte des groupements est interne (chiffres du réseau). <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
  '<div class="cg-grille" id="cg-grille" data-interne><div class="cg-zone" id="cg-zone"></div><aside class="cg-liste"><section class="carte" id="cg-liste" aria-label="Liste"></section></aside></div>' +
  '<p class="note cg-note" data-interne>Position des officines : adresse de l’annuaire, sinon le centre de la commune · les officines hors des départements du secteur n’apparaissent pas.</p></div>';
  cadrer();
  I = ca.creer({ zone: $('#cg-zone', el), id: 'cg', aria: 'Carte des adhérents du groupement choisi', rayon: rayon, couleur: couleur, anneau: anneau, visible: visible, tip: tip, onClic: ouvrirBulle, onVide: fermerBulle, apres: placerBulle });
  $('#cg-zone', el).insertAdjacentHTML('beforeend', '<div class="cg-flot cg-ronds"><button type="button" class="b-rond" data-z="+" aria-label="Zoom avant">' + J.ico('plus') + '</button><button type="button" class="b-rond" data-z="-" aria-label="Zoom arrière">' + J.ico('minus') + '</button><button type="button" class="b-rond" data-z="pos" aria-label="Recentrer sur mon secteur">' + J.ico('locate') + '</button></div>' +
    '<div class="cg-flot cg-leg" id="cg-leg">' + legende() + '</div><div class="cg-bulle" id="cg-bulle" role="dialog" aria-label="Officine" hidden></div>');
  J.poseIcones(el); I.points(); compteur(); majListe(el);
  /* vue pharmacien : la phrase (à compteurs), le menu des groupements et le bas du bandeau (filtres, liens) sont internes, comme sur les autres outils */
  $$('.bandeau .lede,.ban-act,.rech-g,.ban-sous,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  $('[data-cg-gr]', el).onclick = function () { if (K.grp === 'tout') { J.aller('groupements'); return; } if (S.groupements) S.groupements.sel = K.grp; K.vuGr = K.grp; J.aller('groupements-detail'); };
  $('#cg-q', el).oninput = function (e) { K.q = e.target.value; K.nb = 30; fermerBulle(); I.maj(); majListe(el); };
  $('#cg-grp', el).onchange = function (e) { K.grp = e.target.value; K.nb = 30; K.focus = null; maj(el); I.vue('pos'); };
  $$('[data-cgf]', el).forEach(function (b) { b.onclick = function () { K.f = b.getAttribute('data-cgf'); $$('[data-cgf]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); K.nb = 30; fermerBulle(); I.maj(); majListe(el); }; });
  $$('[data-z]', el).forEach(function (b) { b.onclick = function () { I.vue(b.getAttribute('data-z')); }; });
  if (!ecoute) { ecoute = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerBulle(); });
    window.addEventListener('resize', function () { if (EL && !EL.hidden && I) { cadrer(); I.redessiner(); } }); }
}
J.ecrans['carte-groupements'] = {
  rendre: function (el) {
    if (!ca || !window.FOND_PACA) { el.innerHTML = '<div class="page"><section class="carte"><h1>Carte des groupements</h1><p class="note">La carte ne peut pas être affichée dans ce navigateur.</p></section></div>'; return; }
    /* arrivée depuis la page d'un groupement (bouton « Carte ») : la carte reprend le groupement regardé, s'il a changé depuis le dernier passage */
    var gs = S.groupements && S.groupements.sel, neuf = !!(gs && gs !== K.vuGr && GRPS.indexOf(gs) >= 0);
    if (neuf) { K.grp = gs; K.nb = 30; K.focus = null; } K.vuGr = gs || K.vuGr;
    if (!I || !$('#cg-zone', el)) construire(el); else { cadrer(); I.redessiner(); maj(el); if (neuf) I.vue('pos'); }
  }
};
})();
