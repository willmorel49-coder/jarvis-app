/* Bloc-notes (#blocnotes). Privé à chacun, tout interne ([data-interne] + avis .vp).
   Bandeau à croix et de recherche, cartes blanches, boutons ronds ; notes groupées par jour en lignes à filets,
   libellés gris / valeurs encre. Données : J.X.blocnotes (jours → notes : heure, texte, mode ; propositions : texte, source), fictives.
   État en mémoire (J.S.blocnotes) : notes ajoutées, dictée en cours, propositions acceptées ou écartées — rien n'est enregistré.
   Les seuls nombres de l'écran : les compteurs du segment (Toutes · Dictées · Écrites) et le badge des propositions restantes ; jamais réécrits. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, X = J.X, S = J.S, OFF = J.OFF;
var BN = X.blocnotes, PERS = X.personne || {};
var K = S.blocnotes = S.blocnotes || { q: '', mode: 'toutes', jours: null, props: null, dictee: false, brouillon: '' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
function init() { if (K.jours) return; K.jours = JSON.parse(JSON.stringify(BN.jours || [])); K.props = (BN.propositions || []).map(function (p, i) { return { i: i, texte: p.texte, source: p.source, etat: '' }; }); }
/* la date réelle, au format des données (« Mardi 17 novembre ») : sert seulement à poser « Aujourd'hui » et à dater une note neuve */
function aujourdhui() { var s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); }
function heureNow() { var d = new Date(); return d.getHours() + ' h ' + ('0' + d.getMinutes()).slice(-2); }
/* une officine citée dans la note (nom sans « Pharmacie du/de la/des ») : un geste « Ouvrir sa fiche » apparaît */
function officineCitee(txt) { var t = txt.toLowerCase(); for (var i = 0; i < OFF.length; i++) { var cle = OFF[i].nom.replace(/^(PHARMACIE|PHIE)\s+(DU|DE LA|DE|DES|D’|DE L’)?\s*/i, '').toLowerCase(); if (cle.length >= 4 && t.indexOf(cle) >= 0) return OFF[i]; } return null; }
function toutes() { var out = []; K.jours.forEach(function (j) { j.notes.forEach(function (n) { out.push(n); }); }); return out; }
function visibles() {
  var q = K.q.trim().toLowerCase();
  /* les jours sont rangés du plus récent au plus ancien ; dans un jour, les notes (gardées par heure croissante) s'affichent aussi de la plus récente à la plus ancienne */
  return K.jours.map(function (j) { return { jour: j.jour, notes: j.notes.slice().reverse().filter(function (n) { if (K.mode === 'dictees' && n.mode !== 'dicté') return false; if (K.mode === 'ecrites' && n.mode !== 'écrit') return false; return !q || n.texte.toLowerCase().indexOf(q) >= 0; }) }; }).filter(function (j) { return j.notes.length; });
}
function modeHtml(n) { var d = n.mode === 'dicté'; return '<span class="etat bn-mode">' + J.ico(d ? 'mic' : 'edit', 'var(--e-neutre)') + (d ? 'dictée' : 'écrite') + '</span>'; }
function ligneNote(n, i) {
  var o = officineCitee(n.texte);
  return '<li class="bn-note" style="--i:' + Math.min(i, 10) + '"><span class="bn-h num">' + esc(n.heure) + '</span><div class="bn-corps"><p class="bn-txt">' + esc(n.texte) + '</p><div class="bn-meta">' + modeHtml(n) +
    (o ? '<button type="button" class="chip bn-chip" data-off="' + o.id + '">' + J.ico('pharma') + 'Ouvrir ' + esc(J.joli(o.nom)) + '</button>' : '') +
    '<button type="button" class="chip bn-chip" data-stub="' + STUB('Transformer la note en tâche') + '">' + J.ico('tasks') + 'Vers une tâche</button></div></div>' +
    '<button type="button" class="b-rond bn-more" aria-label="Autres gestes sur cette note" data-stub="' + STUB('Modifier, partager à l’équipe ou supprimer') + '">' + J.ico('more') + '</button></li>';
}
function blocJours() {
  var V = visibles(), auj = aujourdhui();
  if (!V.length) return '<p class="bn-vide">Aucune note ne correspond' + (K.q ? ' à « ' + esc(K.q) + ' »' : '') + '.</p>';
  return V.map(function (j) { return '<div class="bn-jour"><h3>' + esc(j.jour) + (j.jour === auj ? '<span class="bn-auj">Aujourd’hui</span>' : '') + '</h3><ul class="bn-liste entre">' + j.notes.map(ligneNote).join('') + '</ul></div>'; }).join('');
}
/* la note d'où vient une proposition (« note de 9 h 05 ») est nommée par son moment, sans réécrire l'heure déjà lue dans le fil des jours */
function sourceLib(src) { var h = String(src).replace(/^note de\s*/i, ''), jour = null;
  K.jours.forEach(function (j) { j.notes.forEach(function (n) { if (!jour && n.heure === h) jour = j.jour; }); });
  if (!jour) return 'd’après la ' + esc(src);
  return 'd’après votre note ' + (jour === aujourdhui() ? (parseInt(h, 10) < 12 ? 'de ce matin' : 'de cet après-midi') : 'de ' + esc(jour.split(' ')[0].toLowerCase())); }
function icoProp(texte) { var t = texte.toLowerCase(); return t.indexOf('tâche') >= 0 ? 'tasks' : t.indexOf('note') >= 0 ? 'note' : t.indexOf('rendez') >= 0 ? 'cal' : 'spark'; }
function blocProps() {
  var restantes = K.props.filter(function (p) { return !p.etat; }).length;
  var items = K.props.map(function (p) {
    var corps = '<span class="rond gris' + (p.etat === 'ok' ? ' bn-ok' : '') + '">' + J.ico(p.etat === 'ok' ? 'check' : icoProp(p.texte), p.etat === 'ok' ? 'var(--e-bien)' : '') + '</span><div class="bn-pt"><b>' + esc(p.texte) + '</b><span class="sub">' + sourceLib(p.source) + (p.etat === 'ok' ? ' · <b class="bn-fait">ajoutée au CRM</b>' : p.etat === 'non' ? ' · écartée' : '') + '</span></div>';
    var act = !p.etat ? '<button type="button" class="pil plein" data-acc="' + p.i + '">' + J.ico('coche') + 'Accepter</button><button type="button" class="pil" data-non="' + p.i + '">Écarter</button>' : '<button type="button" class="pil" data-retablir="' + p.i + '">Rétablir</button>';
    return '<li class="bn-prop' + (p.etat ? ' ' + p.etat : '') + '">' + corps + '<div class="bn-prop-act">' + act + '</div></li>'; }).join('');
  return '<section class="carte bn-robot"><div class="tete"><div><p class="bn-eyebrow">Chaque soir</p><h2>Propositions du robot du soir' + (restantes ? ' <b class="cpt7">' + restantes + '</b>' : '') + '</h2><p class="st">une proposition = une action sur le CRM, à accepter ou à écarter · rien n’est écrit sans vous</p></div></div>' +
    (K.props.length ? '<ul class="bn-props">' + items + '</ul>' : '<p class="note">Le robot n’a rien proposé : écrivez ou dictez, il relira vos notes ce soir.</p>') +
    (K.props.length && !restantes ? '<p class="bn-tout">' + J.ico('check', 'var(--e-bien)') + 'Tout est traité. Le robot repassera ce soir.</p>' : '') + '</section>';
}
function composeur() {
  return '<section class="carte bn-comp" aria-label="Écrire ou dicter une note"><div class="bn-comp-t"><span class="rond gris">' + J.ico('edit') + '</span><div><h2>Une note, maintenant</h2><p class="st">Écrite ou dictée, elle reste à vous ; le robot la relit ce soir.</p></div></div>' +
    '<textarea id="bn-txt" rows="3" placeholder="' + (K.dictee ? 'Parlez : le texte dicté apparaît ici…' : 'Écrire une note… une officine, un fait, une chose à faire') + '" aria-label="Texte de la note">' + esc(K.brouillon) + '</textarea>' +
    '<div class="bn-dict"' + (K.dictee ? '' : ' hidden') + ' id="bn-dict" role="status"><span class="bn-ondes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Je vous écoute… parlez, puis « Arrêter » : la note sera enregistrée comme dictée.</span></div>' +
    '<div class="bn-comp-act"><button type="button" class="pil plein" id="bn-save">' + J.ico('coche') + 'Enregistrer</button><button type="button" class="pil" id="bn-mic" aria-pressed="' + K.dictee + '">' + J.ico('mic') + (K.dictee ? 'Arrêter' : 'Dicter') + '</button><span class="bn-prive">' + J.ico('lock') + 'Privé : seule ' + esc(PERS.prenom || 'vous') + ' voit ce bloc-notes.</span></div></section>';
}
function poser(texte, mode) {
  var auj = aujourdhui(), g = K.jours.length && K.jours[0].jour === auj ? K.jours[0] : null;
  if (!g) { g = { jour: auj, notes: [] }; K.jours.unshift(g); }
  g.notes.push({ heure: heureNow(), texte: texte, mode: mode });
  K.q = ''; K.mode = 'toutes';
}
function ajouter(texte, mode) { poser(texte, mode); K.brouillon = ''; K.dictee = false; }
/* pour Le marché (« Noter dans le bloc-notes ») : une note écrite du jour, sans toucher au brouillon en cours du composeur */
J.bnAjouter = function (texte) { init(); poser(texte, 'écrit'); };
J.ecrans.blocnotes = {
  rendre: function (el) {
    init();
    var re = function () { var y = window.scrollY; J.ecrans.blocnotes.rendre(el); window.scrollTo(0, y); };   /* re-rend sans remonter la page */
    var T = toutes(), nD = T.filter(function (n) { return n.mode === 'dicté'; }).length, nE = T.length - nD;
    var seg = function (k, lib, n) { return '<button type="button" data-bnmode="' + k + '" aria-pressed="' + (K.mode === k) + '">' + lib + ' <span class="cnt">' + nf.format(n) + '</span></button>'; };
    el.innerHTML = '<div class="page bn-page">' + J.bandeau({
      croix: true, eyebrow: '<span data-interne>Bloc-notes · privé à chacun<span class="long"> · ' + esc(PERS.nom || '') + '</span></span><span class="vp">Outil interne · vue pharmacien</span>', titre: 'Bloc-notes',
      lede: 'Vos notes <b>écrites</b> ou <b>dictées</b> au fil de la journée, groupées par jour. Le soir, le robot en tire des <b>propositions</b> pour le CRM : vous acceptez, ou non.',
      recherche: { id: 'bn-q', placeholder: window.innerWidth <= 760 ? 'Chercher dans vos notes' : 'Chercher dans vos notes : une officine, un mot…', aria: 'Chercher dans vos notes', valeur: K.q },
      bas: '<span class="lbl">Afficher :</span><div class="seg" role="group" aria-label="Afficher">' + seg('toutes', 'Toutes', T.length) + seg('dictees', 'Dictées', nD) + seg('ecrites', 'Écrites', nE) + '</div>'
    }) +
    '<p class="vp note bn-vp">Vue pharmacien : le bloc-notes est privé et interne, il n’a rien à lui montrer. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
    '<div class="bn-grille" data-interne><div class="bn-col"><div class="entre">' + composeur() + '</div><section class="carte bn-jours"><div class="tete"><div><h2>Au fil des jours</h2><p class="st">les plus récentes en haut · une ligne = l’heure, le texte, la façon dont la note est entrée</p></div></div><div id="bn-corps">' + blocJours() + '</div></section></div>' +
    '<div class="bn-col bn-droite entre">' + blocProps() + '</div></div></div>';
    J.poseIcones(el);
    /* vue pharmacien : la phrase, la recherche et le segment à compteurs du bandeau sont internes, comme sur les écrans To do et Appro */
    $$('.bandeau .lede,.ban-act,.rech-g,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
    var ta = $('#bn-txt', el);
    ta.oninput = function () { K.brouillon = ta.value; };
    $('#bn-q', el).oninput = function (e) { K.q = e.target.value; $('#bn-corps', el).innerHTML = blocJours(); lier(el); };
    $$('[data-bnmode]', el).forEach(function (b) { b.onclick = function () { K.mode = b.getAttribute('data-bnmode'); re(); }; });
    $('#bn-save', el).onclick = function () { var t = ta.value.trim(); if (!t) { ta.focus(); J.toast('Écrivez d’abord quelques mots.'); return; } ajouter(t, K.dictee ? 'dicté' : 'écrit'); re(); J.toast('Note enregistrée dans votre bloc-notes.'); };
    $('#bn-mic', el).onclick = function () { if (K.dictee) { var t = ta.value.trim(); if (t) { ajouter(t, 'dicté'); re(); J.toast('Note dictée enregistrée.'); } else { K.dictee = false; re(); J.toast('Dictée arrêtée : rien à enregistrer (le micro n’est pas branché dans cette maquette, le texte se tape).'); } } else { K.dictee = true; re(); var t2 = $('#bn-txt'); if (t2) t2.focus(); } };
    $$('[data-acc],[data-non],[data-retablir]', el).forEach(function (b) { b.onclick = function () { var i = +(b.getAttribute('data-acc') || b.getAttribute('data-non') || b.getAttribute('data-retablir')), p = K.props[i]; if (!p) return; p.etat = b.hasAttribute('data-acc') ? 'ok' : b.hasAttribute('data-non') ? 'non' : ''; re(); if (p.etat === 'ok') J.toast('Proposition acceptée : ' + p.texte.split(' pour ')[0] + ' (maquette : rien n’est écrit dans le vrai CRM).'); }; });
    lier(el);
  }
};
function lier(el) { $$('[data-off]', el).forEach(function (b) { b.onclick = function () { J.ouvrirFiche(b.getAttribute('data-off')); }; }); }
})();
