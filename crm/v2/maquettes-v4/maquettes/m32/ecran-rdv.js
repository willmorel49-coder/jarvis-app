/* Rendez-vous (#rdv) et un rendez-vous ouvert (#rdv-detail).
   Bandeau bleu (titre, phrase-réponse « N à venir · N cette semaine · N en attente », grand champ de recherche), listes en tableaux à filets fins, boutons ronds d'actions,
   cartes blanches : bande des jours (3 semaines, jour ouvert = le prochain qui porte un rendez-vous), la journée (rendez-vous + plages occupées de l'agenda personnel),
   passés à qualifier, barre d'actions (Inviter une officine, Noter un rendez-vous, ··· → Planning, Suivi, Radar, Disponibilités, Mes modèles, Appels, exporter l'agenda,
   notifications), À rappeler / En attente / Sans réponse. Données : J.X.rdv (fictives, dites à l'écran). Écran personnel et interne : chaque bloc porte data-interne. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, eur = J.eur, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S, R = J.X && J.X.rdv;
if (!R) return;
var E = S.rdv = S.rdv || { jour: '', sel: -1, plus: false, q: '', qualif: {} };
var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], JC = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
var MOISL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'], MOISC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var VP_R = '<p class="note vp rv-vp">Rendez-vous est un outil interne : rien à montrer au pharmacien dans cette vue. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>';
function dt(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function plusJ(s, n) { var d = dt(s); d.setDate(d.getDate() + n); return iso(d); }
function longue(s) { var d = dt(s); return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOISL[d.getMonth()]; }
function heure(h) { var p = h.split(':'); return (+p[0]) + ' h' + (p[1] !== '00' ? ' ' + p[1] : ''); }
var AUJ = R.aujourdhui, LUNDI = plusJ(AUJ, -((dt(AUJ).getDay() + 6) % 7)), DIM = plusJ(LUNDI, 6);
var RDV = R.rendezVous.slice().sort(function (a, b) { return (a.date + a.heure) < (b.date + b.heure) ? -1 : 1; });
var OCC = R.occupes.slice().sort(function (a, b) { return (a.date + a.debut) < (b.date + b.debut) ? -1 : 1; });
J.rdvListe = RDV;
if (E.sel < 0) { E.sel = 0; RDV.some(function (r, i) { if (r.date >= AUJ) { E.sel = i; return true; } return false; }); }
function off(id) { return J.offById(id); }
function nom(id) { return J.nomOff(id); }
function lieu(id) { var o = off(id); return o ? esc(o.ville) + (o.groupement && o.groupement !== 'Sans groupement' ? ' · ' + esc(o.groupement) : '') : ''; }
/* icônes absentes du jeu commun : dessinées ici (trait 1,9, 24×24) */
var ICO2 = { horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', ics: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5L12 18l2.5-2.5"/>' };
function ico(k, c) { return ICO2[k] ? '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + ICO2[k] + '</svg></span>' : J.ico(k, c); }
/* ---------- la bande des jours (3 semaines à partir du lundi de la semaine en cours) ---------- */
function bande() {
  var s = '';
  for (var i = 0; i < 21; i++) {
    var j = plusJ(LUNDI, i), d = dt(j), n = RDV.filter(function (r) { return r.date === j; }).length, occ = OCC.some(function (o) { return o.date === j; });
    var pts = ''; for (var k = 0; k < Math.min(n, 3); k++) pts += '<i></i>';
    s += '<button type="button" class="rv-j' + (j === E.jour ? ' on' : '') + (j === AUJ ? ' auj' : '') + (j < AUJ ? ' passe' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' we' : '') + '" data-jour="' + j + '" aria-pressed="' + (j === E.jour) + '" aria-label="' + esc(J.maj(longue(j))) + (n ? ', ' + n + ' rendez-vous' : '') + (occ ? ', agenda occupé' : '') + '">' +
      ((i === 0 || d.getDate() === 1) ? '<span class="rv-m">' + MOISC[d.getMonth()] + '</span>' : '') + '<span class="rv-js">' + JC[d.getDay()] + '</span><b class="rv-jn num">' + d.getDate() + '</b><span class="rv-pts">' + pts + (occ ? '<i class="occ"></i>' : '') + '</span></button>';
  }
  return '<div class="rv-bande" role="group" aria-label="Les trois prochaines semaines">' + s + '</div>';
}
/* ---------- la journée ouverte : rendez-vous + plages occupées, dans l'ordre des heures ---------- */
function ligneRdv(r, i, avecDate) {
  var o = off(r.officine);
  return '<button type="button" class="rv-r" data-rdv="' + i + '" aria-label="Ouvrir le rendez-vous avec ' + esc(nom(r.officine)) + '"><span class="rv-h num">' + (avecDate ? '<span class="rv-hd">' + JC[dt(r.date).getDay()] + ' ' + dt(r.date).getDate() + ' ' + MOISC[dt(r.date).getMonth()] + '</span>' : '') + heure(r.heure) + '</span>' +
    '<span class="rv-c"><b>' + esc(nom(r.officine)) + '</b><span class="sub">' + lieu(r.officine) + ' · vue il y a ' + esc(r.vuIlYa) + (o && o.aRappeler ? ' · à rappeler' : '') + '</span><span class="rv-obj">' + esc(r.objet) + '</span><span class="rv-prep">' + J.ico('clip') + esc(r.prepa) + '</span></span>' + J.ico('chev') + '</button>';
}
function journee() {
  var q = E.q.trim().toLowerCase(), titre, st, corps = '';
  if (q) {
    var trouve = RDV.map(function (r, i) { return [r, i]; }).filter(function (x) { var r = x[0]; return (nom(r.officine) + ' ' + r.objet + ' ' + J.dateFr(r.date) + ' ' + longue(r.date) + ' ' + lieu(r.officine)).toLowerCase().indexOf(q) >= 0; });
    titre = 'Résultats pour « ' + esc(E.q.trim()) + ' »'; st = trouve.length ? trouve.length + ' rendez-vous sur les trois semaines et au-delà' : 'aucun rendez-vous ne correspond';
    corps = trouve.map(function (x) { return ligneRdv(x[0], x[1], true); }).join('');
  } else {
    var items = [];
    RDV.forEach(function (r, i) { if (r.date === E.jour) items.push({ t: r.heure, h: ligneRdv(r, i) }); });
    OCC.forEach(function (o) { if (o.date === E.jour) items.push({ t: o.debut, h: '<div class="rv-o" data-occ><span class="rv-h num">' + heure(o.debut) + '<span class="rv-fin">→ ' + heure(o.fin) + '</span></span><span class="rv-c">' + ico('horloge') + '<span><b>' + esc(o.t) + '</b><span class="sub">plage occupée de votre agenda personnel</span></span></span></div>' }); });
    items.sort(function (a, b) { return a.t < b.t ? -1 : 1; });
    var nr = RDV.filter(function (r) { return r.date === E.jour; }).length, no = items.length - nr;
    titre = J.maj(longue(E.jour)) + (E.jour === AUJ ? ' · aujourd’hui' : ''); st = items.length ? (nr ? nr + ' rendez-vous' : 'aucun rendez-vous') + (no ? ' · ' + no + ' plage' + (no > 1 ? 's' : '') + ' occupée' + (no > 1 ? 's' : '') : '') : '';
    corps = items.length ? items.map(function (x) { return x.h; }).join('') : '<p class="rv-vide">' + J.ico('cal') + 'Rien de prévu ce jour-là : l’agenda est libre.</p>';
  }
  return '<div class="tete"><div><h2 id="rv-titre-j">' + titre + '</h2>' + (st ? '<p class="st">' + st + '</p>' : '') + '</div><button type="button" class="pil" data-stub="' + STUB('Noter un rendez-vous ce jour-là') + '">' + J.ico('plus') + 'Ce jour-là</button></div><div class="rv-liste entre">' + corps + '</div>';
}
/* ---------- passés à qualifier (15 derniers jours) ---------- */
function passes() {
  /* les rendez-vous de l'agenda déjà passés (hier) rejoignent ceux de R.passes : une seule liste, dédoublonnée par date + officine, du plus récent au plus ancien */
  var lim = plusJ(AUJ, -15), vus = {}, P = [];
  R.passes.concat(RDV.filter(function (r) { return r.date < AUJ; })).forEach(function (p) { var k = p.date + p.officine; if (p.date >= lim && p.date < AUJ && !vus[k]) { vus[k] = 1; P.push(p); } });
  P.sort(function (a, b) { return (a.date + a.heure) < (b.date + b.heure) ? 1 : -1; });
  if (!P.length) return '';
  return '<section class="carte rv-passes" data-interne aria-label="Rendez-vous passés à qualifier"><div class="tete"><div><h2>Passés à qualifier</h2><p class="st">les rendez-vous des quinze derniers jours : tenu, ou à suivre ?</p></div></div><table class="tabl"><tbody>' +
    P.map(function (p, i) { var k = p.date + p.officine, q = E.qualif[k]; return '<tr><td data-l="Quand"><b class="rv-pd">' + JC[dt(p.date).getDay()] + ' ' + dt(p.date).getDate() + ' ' + MOISC[dt(p.date).getMonth()] + '</b><span class="sub">' + heure(p.heure) + '</span></td><td data-l="Officine"><b class="rv-pn">' + esc(nom(p.officine)) + '</b><span class="sub">' + lieu(p.officine) + '</span></td>' +
      '<td class="rv-q" data-l="État">' + (q ? J.etatHtml(q === 'tenu' ? 'cliente' : 'rappel', q === 'tenu' ? 'Tenu' : 'À suivre') + '<button type="button" class="rv-lien" data-qualif="' + esc(k) + '" data-val="">Modifier</button>' : '<div class="seg"><button type="button" data-qualif="' + esc(k) + '" data-val="tenu" aria-pressed="false">Tenu</button><button type="button" data-qualif="' + esc(k) + '" data-val="suivre" aria-pressed="false">À suivre</button></div>') + '</td></tr>'; }).join('') + '</tbody></table></section>';
}
/* ---------- À rappeler · En attente · Sans réponse ---------- */
function troisListes() {
  var ar = R.aRappeler.map(function (id) { var o = off(id); return [id, o && o.baisse3mois != null ? '−' + Math.abs(o.baisse3mois) + ' % en 3 mois' : 'dernière commande le ' + (o ? J.dateFr(o.derniereCommande) : '—'), 'bell', 'var(--e-attention)', 'Appeler', 'phone']; });
  var ea = R.enAttente.map(function (x) { return [x.officine, 'lien envoyé le ' + esc(x.envoye) + ' · le pharmacien choisit son créneau', 'send', 'var(--e-neutre)', 'Relancer', 'mail']; });
  var sr = R.sansReponse.map(function (id) { return [id, 'lien envoyé il y a plus de 7 jours, sans réponse', 'bell', 'var(--e-alerte)', 'Appeler', 'phone']; });
  var carte = function (titre, st, L) { return '<section class="carte rv-l" data-interne aria-label="' + titre + '"><div class="tete"><div><h2>' + titre + '</h2><p class="st">' + st + '</p></div></div>' + (L.length ? '<table class="tabl"><tbody>' +
    L.map(function (l) { return '<tr class="rv-lr" data-off="' + l[0] + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(nom(l[0])) + '"><td><span class="rv-li">' + J.ico(l[2], l[3]) + '<span><b>' + esc(nom(l[0])) + '</b><span class="sub">' + lieu(l[0]) + '</span><span class="sub">' + l[1] + '</span></span></span></td><td class="rv-la"><button type="button" class="pil" data-stub="' + STUB(l[4] + ' ' + nom(l[0])) + '">' + J.ico(l[5]) + l[4] + '</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="note">Personne pour l’instant.</p>') + '</section>'; };
  return '<div class="rv-trois stack entre">' + carte('À rappeler', 'leurs commandes baissent : un appel avant la tournée', ar) + carte('En attente', 'invitations envoyées, créneau pas encore choisi', ea) + carte('Sans réponse', 'relance conseillée, par téléphone', sr) + '</div>';
}
/* ---------- le module derrière « ··· » (les deux gestes principaux sont dans le bandeau) ---------- */
function barre() {
  if (!E.plus) return '';
  var reste = [['table', 'Planning', 'rdv-planning'], ['eye', 'Suivi', 'rdv-suivi'], ['locate', 'Radar'], ['cal', 'Disponibilités'], ['doc', 'Mes modèles', 'todo'], ['phone', 'Appels'], ['ics', 'Exporter l’agenda'], ['bell', 'Notifications']];
  return '<section class="carte rv-barre" id="rv-plus" data-interne aria-label="Tout le module"><div class="rv-ronds">' + reste.map(function (x) { var svg = ICO2[x[0]] ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICO2[x[0]] + '</svg>' : x[0];
      return x[2] ? '<a class="rond-act" href="#' + x[2] + '"><span class="rond"><span class="ico">' + J.icoSvg(x[0]) + '</span></span>' + x[1] + '</a>' : J.rond(svg, x[1], STUB(x[1])); }).join('') + '</div>' +
    '<p class="note">Rendez-vous est un outil personnel : vous ne voyez que votre agenda. Inviter une officine envoie un lien au pharmacien, qui choisit lui-même son créneau.</p></section>';
}
/* ---------- deux pages du module : Planning (les trois semaines, jour par jour) et Suivi (où en est chaque invitation) ---------- */
function tetePage(titre, eyebrow, lede) {
  return J.bandeau({ classe: 'rv-ban-p', eyebrow: eyebrow, titre: titre, lede: lede, actions: '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Rendez-vous</button>' }) + VP_R;
}
function planning(el) {
  var L = [];
  for (var i = 0; i < 21; i++) { var j = plusJ(LUNDI, i), d = dt(j); if (d.getDay() === 0 || d.getDay() === 6) continue;
    var rv = RDV.filter(function (r) { return r.date === j; }), oc = OCC.filter(function (o) { return o.date === j; });
    L.push('<tr' + (j === AUJ ? ' class="lu"' : '') + '><td data-l="Jour"><b class="rv-pd">' + JC[d.getDay()] + ' ' + d.getDate() + ' ' + MOISC[d.getMonth()] + '</b>' + (j === AUJ ? '<span class="sub">aujourd’hui</span>' : j < AUJ ? '<span class="sub">passé</span>' : '') + '</td>' +
      '<td data-l="Rendez-vous">' + (rv.length ? rv.map(function (r) { return '<button type="button" class="rv-pl" data-rdv="' + RDV.indexOf(r) + '"><b>' + heure(r.heure) + '</b> · ' + esc(nom(r.officine)) + '<span class="sub">' + esc(r.objet) + '</span></button>'; }).join('') : '<span class="sub">aucun rendez-vous</span>') + '</td>' +
      '<td data-l="Agenda">' + (oc.length ? oc.map(function (o) { return '<span class="sub">' + heure(o.debut) + ' à ' + heure(o.fin) + ' · ' + esc(o.t) + '</span>'; }).join('') : '<span class="sub">libre</span>') + '</td></tr>'); }
  el.innerHTML = '<div class="page rv">' + tetePage('Planning', 'Rendez-vous · trois semaines à partir du ' + dt(LUNDI).getDate() + ' ' + MOISL[dt(LUNDI).getMonth()], '<span class="vi">Vos rendez-vous et les plages déjà prises de votre agenda, <b>jour ouvré par jour ouvré</b>. Un clic sur un rendez-vous le prépare.</span>') +
    '<section class="carte rv-tabp" data-interne aria-label="Planning"><table class="tabl rv-plan"><thead><tr><th>Jour</th><th>Rendez-vous<span class="st">heure · officine · objet</span></th><th>Agenda<span class="st">plages occupées</span></th></tr></thead><tbody>' + L.join('') + '</tbody></table></section></div>';
  J.poseIcones(el); lierRdv(el);
}
function suivi(el) {
  var pris = RDV.filter(function (r) { return r.date >= AUJ; }).map(function (r) { return [r.officine, 'cliente', 'Rendez-vous pris', 'le ' + longue(r.date) + ' à ' + heure(r.heure)]; });
  var att = R.enAttente.map(function (x) { return [x.officine, 'prospect', 'En attente', 'lien envoyé le ' + esc(x.envoye) + ' · le pharmacien choisit son créneau']; });
  var sr = R.sansReponse.map(function (id) { return [id, 'baisse', 'Sans réponse', 'lien envoyé il y a plus de 7 jours : relance conseillée, par téléphone']; });
  var T = sr.concat(att, pris);
  el.innerHTML = '<div class="page rv">' + tetePage('Suivi', 'Rendez-vous · où en est chaque invitation', '<span class="vi"><b>' + T.length + ' officines</b> suivies : les invitations sans réponse d’abord, puis celles en attente, puis les rendez-vous pris.</span>') +
    '<section class="carte rv-tabp" data-interne aria-label="Suivi des invitations"><table class="tabl"><thead><tr><th>Officine<span class="st">ville · groupement</span></th><th>État<span class="st">où en est l’invitation</span></th></tr></thead><tbody>' +
    T.map(function (t) { return '<tr class="rv-lr" data-off="' + t[0] + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(nom(t[0])) + '"><td data-l="Officine"><b class="rv-pn">' + esc(nom(t[0])) + '</b><span class="sub">' + lieu(t[0]) + '</span></td><td data-l="État">' + J.etatHtml(t[1], t[2]) + '<span class="sub">' + t[3] + '</span></td></tr>'; }).join('') + '</tbody></table></section></div>';
  J.poseIcones(el);
  $$('.rv-lr', el).forEach(function (tr) { var go = function () { J.ouvrirFiche(tr.getAttribute('data-off')); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
}
/* ---------- l'écran ---------- */
J.ecrans.rdv = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail' && J.rdvDetail) { window.scrollTo(0, 0); return J.rdvDetail(el, RDV[E.sel] ? E.sel : 0); }
    if (etat.suite === 'planning') return planning(el);
    if (etat.suite === 'suivi') return suivi(el);
    if (!E.jour) { var p = RDV.filter(function (r) { return r.date >= AUJ; })[0]; E.jour = p ? p.date : AUJ; }
    var aVenir = RDV.filter(function (r) { return r.date >= AUJ; }).length, sem = RDV.filter(function (r) { return r.date >= AUJ && r.date <= DIM; }).length, att = R.enAttente.length;
    el.innerHTML = '<div class="page rv">' + J.bandeau({
      croix: true, eyebrow: 'Mon agenda · semaine du ' + dt(LUNDI).getDate() + ' ' + MOISL[dt(LUNDI).getMonth()] + ' ' + dt(LUNDI).getFullYear(), titre: 'Rendez-vous',
      lede: '<span class="vi"><b>' + aVenir + ' à venir</b> · <b>' + sem + ' cette semaine</b> · <b>' + att + ' en attente</b> d’une réponse du pharmacien. Un clic sur un jour ouvre la journée, un clic sur un rendez-vous le prépare.</span><span class="vp">Votre agenda de rendez-vous : personnel, réservé à l’interne.</span>',
      actions: '<button type="button" class="pil" data-stub="' + STUB('Inviter une officine : un lien de prise de rendez-vous part au pharmacien, il choisit son créneau') + '">' + J.ico('send') + 'Inviter une officine</button>' +
        '<button type="button" class="pil contour" data-stub="' + STUB('Noter un rendez-vous, jour et heure libres') + '">' + J.ico('cal') + 'Noter un rendez-vous</button>' +
        '<button type="button" class="pil contour rv-bplus" data-rv-plus aria-expanded="' + E.plus + '" aria-controls="rv-plus" aria-label="' + (E.plus ? 'Replier le module' : 'Tout le module : planning, suivi, radar…') + '" title="' + (E.plus ? 'Replier le module' : 'Tout le module : planning, suivi, radar…') + '">' + J.ico(E.plus ? 'close' : 'more') + '</button>',
      recherche: { id: 'rv-q', placeholder: 'Une officine, un objet, une date…', aria: 'Rechercher un rendez-vous', valeur: E.q }
    }) + VP_R +
      barre() +
      '<section class="carte rv-cal" data-interne aria-label="Bande des jours"><div class="tete"><div><h2>Les trois prochaines semaines</h2><p class="st">un point par rendez-vous · le trait gris : une plage occupée de votre agenda · le jour ouvert est le prochain qui porte un rendez-vous</p></div><button type="button" class="pil" data-jour="' + AUJ + '">' + J.ico('locate') + 'Aujourd’hui</button></div>' + bande() + '</section>' +
      '<div class="rv-deux stack"><section class="carte rv-jour" data-interne aria-label="La journée" id="rv-jour">' + journee() + '</section>' + passes() + '</div>' +
      troisListes() + '</div>';
    J.poseIcones(el);
    var self = this;
    $$('[data-jour]', el).forEach(function (b) { b.onclick = function () { E.jour = b.getAttribute('data-jour'); E.q = ''; self.rendre(el, etat); window.scrollTo(0, Math.max(0, $('#rv-jour').getBoundingClientRect().top + window.scrollY - 96)); }; });
    $('#rv-q', el).oninput = function (e) { E.q = e.target.value; $('#rv-jour', el).innerHTML = journee(); J.poseIcones($('#rv-jour', el)); lierRdv(el); };
    var plus = $('[data-rv-plus]', el); if (plus) plus.onclick = function () { E.plus = !E.plus; self.rendre(el, etat); };
    $$('[data-qualif]', el).forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-val'); if (v) E.qualif[b.getAttribute('data-qualif')] = v; else delete E.qualif[b.getAttribute('data-qualif')]; self.rendre(el, etat); }; });
    $$('.rv-lr', el).forEach(function (tr) { var go = function (ev) { if (ev.target.closest('button')) return; J.ouvrirFiche(tr.getAttribute('data-off')); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(ev); } }; });
    lierRdv(el);
  }
};
function lierRdv(el) { $$('[data-rdv]', el).forEach(function (b) { b.onclick = function () { E.sel = +b.getAttribute('data-rdv'); J.aller('rdv-detail'); }; }); }
J.rdvOutils = { dt: dt, longue: longue, heure: heure, JC: JC, MOISC: MOISC, MOISL: MOISL, AUJ: AUJ, STUB: STUB, nom: nom, lieu: lieu, off: off, ico: ico, E: E, VP: VP_R };
})();
/* ====================================================================================================================
   #rdv-detail : un rendez-vous ouvert = la carte d'identité de l'officine (nom à gauche, l'heure en grand, clé-valeur au centre, actions à droite),
   puis « ce qui prépare la visite » : les deux listes à proposer, la courbe des dix mois face à la moyenne, ce qu'elle ne commande plus,
   les notes et tâches de l'équipe. Précédent / suivant et « Autre rendez-vous… » comme sur la fiche modèle.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, eur = J.eur, OFF = J.OFF, MOY = J.MOY, U = J.rdvOutils;
if (!U) return;
var E = U.E, STUB = U.STUB;
function liste(titre, sous, ico, L) {
  return '<section class="carte rv-prop"><div class="rv-pt"><span class="rond gris">' + J.ico(ico) + '</span><div><h2>' + esc(titre) + '</h2><p class="st">' + esc(sous) + ' · part des officines qui commandent le produit</p></div><div class="rv-pnb"><b class="num">' + nf.format(L.nbProduits) + '</b><span>produits</span></div></div>' +
    '<div class="rv-pr">' + J.rond('doc', 'PDF', STUB('Télécharger en PDF')) + J.rond('down', 'Excel', STUB('Télécharger en Excel')) + J.rond('send', 'Envoyer', STUB('Envoyer cette liste'), 1) + '</div>' +
    '<table class="tabl"><tbody>' + L.premiers.slice(0, 5).map(function (p) { return '<tr><td><b class="rv-nomp">' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></td><td class="num"><span class="rv-part"><span class="bar12"><i style="width:' + p.partOfficines + '%"></i></span><b>' + p.partOfficines + ' %</b></span></td></tr>'; }).join('') + '</tbody></table></section>';
}
J.rdvDetail = function (el, i) {
  var RDV = J.rdvListe, r = RDV[i], o = U.off(r.officine) || OFF[0], Fi = J.ficheDe(o.id), I = Fi.identite, pros = o.statut === 'prospect';
  var mois = Fi.moisLabels, cm = Fi.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2], evo = prev ? Math.round((last - prev) / prev * 100) : 0, passe = r.date < U.AUJ;
  var autres = '<label class="filtre rv-autre" data-interne>' + J.ico('cal') + '<select id="rv-autre" aria-label="Autre rendez-vous"><option value="">Autre rendez-vous…</option>' + RDV.map(function (x, k) { var d = U.dt(x.date); return '<option value="' + k + '">' + U.JC[d.getDay()] + ' ' + d.getDate() + ' ' + U.MOISC[d.getMonth()] + ' · ' + U.heure(x.heure) + ' · ' + esc(U.nom(x.officine)) + '</option>'; }).join('') + '</select></label>';
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Rendez-vous</button><div class="rv-pnv" data-interne><button type="button" class="b-rond" data-pn="-1" aria-label="Rendez-vous précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Rendez-vous suivant">' + J.ico('chev') + '</button></div>' + autres;
  var lignes = [['Objet', esc(r.objet)], ['Préparation', esc(r.prepa)], ['Dernière visite', 'il y a ' + esc(r.vuIlYa)], ['Adresse', esc(I.adresse) + ', ' + esc(I.cp + ' ' + I.ville)], ['Titulaire', esc(I.titulaires)], ['Téléphone', esc(I.telephone) + (I.portable ? ' · ' + esc(I.portable) : ''), 0, 1],
    ['Groupement', esc(I.groupement)], ['Logiciel', esc(I.logiciel || 'inconnu')], ['Grossiste principal', esc(I.grossistePrincipal)], [J.maj(J.ml(mois[mois.length - 1])) + ' 2026', pros ? '' : '<span class="num">' + eur(last) + '</span> ' + J.evoHtml(evo, 'sur ' + J.ml(mois[mois.length - 2]))]];
  var actions = '<div class="ronds">' + J.rond('phone', 'Appeler', STUB('Appeler'), 1) + J.rond('route', 'Itinéraire', STUB('Itinéraire')) + J.rond('mail', 'E-mail', STUB('Écrire un e-mail')) + J.rond('note', 'Note', STUB('Prendre une note')) + J.rond('edit', 'Déplacer', STUB('Déplacer le rendez-vous')) + J.rond('close', 'Annuler', STUB('Annuler le rendez-vous')) + '</div>' +
    '<button type="button" class="pil plein" data-fiche="' + o.id + '">' + J.ico('pharma') + 'Ouvrir la fiche de l’officine</button><button type="button" class="pil contour" data-stub="' + STUB('Choisir quoi lui transmettre') + '">' + J.ico('clip') + 'Choisir quoi lui transmettre</button><button type="button" class="pil contour" data-stub="' + STUB('Préparer le catalogue pour son logiciel') + '">' + J.ico('screen') + 'Catalogue pour ' + esc(I.logiciel || 'son logiciel') + '</button>';
  var dessus = cm.filter(function (v) { return v >= MOY.caMois; }).length;
  el.innerHTML = '<div class="page rv rv-det">' + J.bandeau({ classe: 'rv-ban', deborde: true, eyebrow: 'Rendez-vous · ' + (passe ? 'passé, à qualifier' : 'à venir') + '<span class="vi"> · agenda de ' + esc(J.X.personne.nom) + '</span>', recherche: '<div class="rv-outils">' + outils + '</div>' }) +
    U.VP + '<div class="sous-bandeau" data-interne>' +
    J.identite({ classe: 'rv-id', nom: esc(J.joli(o.nom)), meta: J.etatHtml(J.etatOff(o)) + '<span>' + U.lieu(o.id) + '</span>', mois: { lib: J.maj(U.longue(r.date)), val: U.heure(r.heure), evo: '<span class="sub">' + (passe ? 'rendez-vous passé' : 'à votre agenda') + '</span>' }, lignes: lignes, actions: actions }) +
    '<h2 class="titre-s">Ce qui prépare la visite<span class="st">les deux listes à lui proposer, ses dix mois face à la moyenne de nos clients, ce qu’elle ne commande plus, vos notes</span></h2>' +
    '<div class="gdeux stack entre">' + liste('Le réseau', 'Meilleures ventes nationales', 'net', Fi.aProposer.reseau) + liste(I.groupement === 'Sans groupement' ? 'Listing du groupe d’achat' : 'Listing ' + I.groupement, 'Groupe d’achat', 'group', Fi.aProposer.groupeAchat) + '</div>' +
    (pros ? '' : '<div class="gdouble stack entre"><section class="carte"><div class="tete"><div><h2>Au-dessus de l’officine moyenne de nos clients ' + dessus + ' mois sur ' + cm.length + '</h2><p class="st">chiffre d’affaires net hors taxes par mois, ' + Fi.periode + ' · trait gris : l’officine moyenne de nos clients · le dernier mois est dans la carte d’identité</p></div></div><div class="chart-box" id="rv-courbe"></div><p class="lecteur" id="rv-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p></section>' +
    '<section class="carte"><div class="tete"><div><h2>Ne commande plus</h2><p class="st">commandés au moins 4 mois, absents du dernier mois · à aborder</p></div></div><table class="tabl"><tbody>' + Fi.nePlusCommande.slice(0, 5).map(function (p) { return '<tr><td><b class="rv-nomp">' + esc(p.nom.split(',')[0]) + '</b><span class="sub">dernière commande : ' + J.dateFr(p.derniereCommande) + '</span></td></tr>'; }).join('') + '</tbody></table></section></div>') +
    '<div class="gdeux stack entre"><section class="carte"><div class="tete"><div><h2>Notes de l’équipe</h2><p class="st">réservé à l’interne</p></div><button type="button" class="pil" data-stub="' + STUB('Prendre une note') + '">' + J.ico('note') + 'Prendre une note</button></div>' + Fi.notes.map(function (n) { return '<p class="rv-nt"><span class="rv-nd">' + J.dateFr(n.date) + '</span>' + esc(n.texte) + '</p>'; }).join('') + '</section>' +
    '<section class="carte"><div class="tete"><div><h2>Tâches</h2><p class="st">à faire autour de ce rendez-vous</p></div><button type="button" class="pil" data-stub="' + STUB('Ajouter une tâche') + '">' + J.ico('plus') + 'Ajouter</button></div>' + Fi.taches.map(function (t) { return '<p class="rv-nt rv-tk">' + J.ico(t.fait ? 'check' : 'list', t.fait ? 'var(--e-bien)' : 'var(--e-neutre)') + '<span>' + esc(t.texte) + '<span class="rv-nd"> · ' + J.dateFr(t.echeance) + '</span></span></p>'; }).join('') + '</section></div></div></div>';
  J.poseIcones(el);
  if (!pros) { var cfg = { labels: mois, a: { vals: cm, col: 'var(--c-ca)' }, fmt: J.eurM, points: [cm.indexOf(Math.max.apply(null, cm))], repere: { v: MOY.caMois, txt: 'Moyenne de nos clients' }, aria: 'Chiffre d’affaires par mois', id: 'rv', h: 230 }, textes = cm.map(function (v, k) { return '<b>' + J.ml(mois[k]) + ' 2026</b> : ' + eur(v) + ', ' + (v >= MOY.caMois ? 'au-dessus de' : 'sous') + ' la moyenne de nos clients'; });
    J.dessine($('#rv-courbe', el), function (w) { cfg.labels = w < 460 ? mois.map(function (m, k) { return k % 2 ? '' : m; }) : mois; return J.courbe(cfg, w); }, function (box) { J.lie(box, textes, $('#rv-lect', el)); }); }
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var k = i + (+b.getAttribute('data-pn')); if (k < 0) k = RDV.length - 1; if (k >= RDV.length) k = 0; E.sel = k; J.route(); }; });
  $('#rv-autre', el).onchange = function (e) { if (e.target.value !== '') { E.sel = +e.target.value; J.route(); } };
  $$('[data-fiche]', el).forEach(function (b) { b.onclick = function () { J.ouvrirFiche(b.getAttribute('data-fiche')); }; });
};
})();
