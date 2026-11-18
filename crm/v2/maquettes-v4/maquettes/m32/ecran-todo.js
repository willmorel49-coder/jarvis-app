/* To do list. Deux parties : 1) le modèle des tâches, partagé avec l'accueil (J.todoModele : cocher sur l'accueil = coché ici, et inversement) ;
   2) l'écran « todo » (bandeau avec la recherche, bande de trois chiffres, onglets, groupes, mails tout prêts, feuille d'ajout).
   Données : DONNEES_V5.todo (fictives). Le « jour » de la maquette est le 17/11/2026 (date des données). */
(function () {
'use strict';
var J = window.J32, X = J.X, S = J.S;
var T0 = X.todo, AUJ = '2026-11-17';
S.todo = S.todo || { fait: {}, ech: {}, suppr: {}, ajout: [], onglet: 'taches', seg: 'afaire', q: '', annule: null, feuille: false, menu: null };
var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function jours(iso) { return Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(2026, 10, 17)) / 864e5); }
function plusJours(n) { var d = new Date(Date.UTC(2026, 10, 17 + n)); return d.toISOString().slice(0, 10); }
var M = J.todoModele = {
  AUJ: AUJ, genres: T0.genres, jours: jours, plusJours: plusJours,
  toutes: function () {
    var E = S.todo;
    return T0.taches.concat(E.ajout).filter(function (t) { return !E.suppr[t.id]; }).map(function (t) {
      var c = {}; for (var k in t) c[k] = t[k];
      if (E.fait[t.id] != null) { c.fait = E.fait[t.id]; if (c.fait && !c.faitLe) c.faitLe = AUJ; }
      if (E.ech[t.id] !== undefined) c.echeance = E.ech[t.id];
      c.d = c.echeance ? jours(c.echeance) : null;
      return c;
    });
  },
  tri: function (a, b) { if (a.d == null && b.d == null) return 0; if (a.d == null) return 1; if (b.d == null) return -1; return a.d - b.d; },
  aFaire: function () { return M.toutes().filter(function (t) { return !t.fait; }).sort(M.tri); },
  faites: function () { return M.toutes().filter(function (t) { return t.fait; }).sort(function (a, b) { return (b.faitLe || '').localeCompare(a.faitLe || ''); }); },
  cocher: function (id, fait) { S.todo.fait[id] = fait; S.todo.annule = fait ? { id: id, t: Date.now() } : null; if (fait) S.todo.faitLe = S.todo.faitLe || {}; },
  reporter: function (id, iso) { S.todo.ech[id] = iso; },
  supprimer: function (id) { S.todo.suppr[id] = true; },
  ajouter: function (t) { t.id = 'n' + (S.todo.ajout.length + 1); t.fait = false; S.todo.ajout.push(t); return t; },
  /* l'échéance en mots : « aujourd'hui », « hier · en retard », « demain », « jeudi 19 nov. », « sans date » */
  quand: function (t) {
    if (t.d == null) return { txt: 'sans date', cls: 'sans' };
    var d = t.d, j = new Date(t.echeance + 'T12:00:00'), lib = JOURS[j.getDay()] + ' ' + j.getDate() + ' ' + MOIS[j.getMonth()];
    if (d === 0) return { txt: 'aujourd’hui', cls: 'auj' };
    if (d === -1) return { txt: 'hier · en retard', cls: 'retard' };
    if (d < 0) return { txt: 'il y a ' + (-d) + ' jours · en retard', cls: 'retard' };
    if (d === 1) return { txt: 'demain', cls: 'avenir' };
    return { txt: lib, cls: 'avenir' };
  },
  genreIco: function (g) { return { rdv: 'cal', merci: 'mail', compte: 'doc', libre: 'list' }[g] || 'list'; }
};
})();
/* ====================================================================================================================
   L'ÉCRAN « todo » : bandeau bleu (date, titre, phrase calculée, « + Ajouter une tâche », champ qui filtre, note « Personnelle »), bande de trois
   chiffres, onglets Tâches · Prospects à relancer · Prospects chauds, segment À faire / Fait, groupes, menu ··· (Préparer le mail, Reporter, Ouvrir la fiche, Supprimer),
   « Annuler » temporaire, les mails tout prêts + Mes modèles, feuille d'ajout (genre, officine, note + Dicter, date). Tout INTERNE et personnel.
   Aucun chiffre deux fois : le total dans la phrase, aujourd'hui / à venir / faites dans la bande, les deux comptes de prospects dans les onglets seulement.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, X = J.X, S = J.S, M = J.todoModele, T0 = X.todo, OFF = J.OFF, E = S.todo;
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var GCOL = { rdv: 'var(--cat-1)', merci: 'var(--c-pharma)', compte: 'var(--cat-5)', libre: 'var(--e-neutre)' }, ECOL = { retard: 'var(--e-alerte)', auj: 'var(--e-attention)', avenir: 'var(--cat-1)', sans: 'var(--e-neutre)' };
function passe(t) { var s = E.q.trim().toLowerCase(); return !s || (t.note + ' ' + (t.officine ? J.nomOff(t.officine) : '') + ' ' + (M.genres[t.genre] || '')).toLowerCase().indexOf(s) >= 0; }
function pl(n, un, des) { return n + ' ' + (n > 1 ? des : un); }
function lede() { var af = M.aFaire(), urg = af.filter(function (t) { return t.d != null && t.d <= 0; }).length;
  if (!af.length) return 'Rien à faire pour l’instant : <b>tout est coché</b>.';
  if (!urg) return 'Rien d’urgent aujourd’hui : <b>' + pl(af.length, 'tâche', 'tâches') + '</b> à faire en tout, toutes à venir.';
  return '<b>' + pl(af.length, 'tâche', 'tâches') + '</b> à faire en tout ; celles d’<b>aujourd’hui</b> et les <b>retards</b> sont en tête de liste.'; }
function vide(t) { return '<p class="note td-vide">' + t + '</p>'; }
/* ---------- une ligne de tâche : case (44 px), genre (icône colorée), note + officine (→ fiche), échéance, menu ··· ---------- */
function ligne(t, i) {
  var qd = M.quand(t), off = t.officine ? J.nomOff(t.officine) : '', fait = !!t.fait, ouvert = E.menu === t.id;
  return '<li class="td-l" data-id="' + t.id + '" style="--i:' + Math.min(i, 12) + '">' +
    '<button type="button" class="td-chk" role="checkbox" aria-checked="' + fait + '" data-coche="' + t.id + '" aria-label="' + (fait ? 'Remettre à faire' : 'Marquer comme faite') + ' : ' + esc(t.note) + '"><span class="ico">' + J.icoSvg('coche') + '</span></button>' +
    '<span class="td-ico">' + J.ico(M.genreIco(t.genre), GCOL[t.genre] || GCOL.libre) + '</span>' +
    (t.officine ? '<button type="button" class="td-t" data-fiche="' + t.officine + '" aria-label="Ouvrir la fiche de ' + esc(off) + '">' : '<div class="td-t">') + '<b>' + esc(t.note) + '</b><span class="sub">' + esc(M.genres[t.genre] || 'À faire') + (off ? ' · ' + esc(off) : '') + (fait && t.faitLe ? ' · faite le ' + J.dateFr(t.faitLe) : '') + '</span>' + (t.officine ? '</button>' : '</div>') +
    '<span class="td-ech"><i class="puce" style="background:' + (ECOL[qd.cls] || ECOL.sans) + '"></i>' + qd.txt + '</span>' +
    '<button type="button" class="b-rond td-menu" data-menu="' + t.id + '" aria-label="Plus d’actions pour cette tâche" aria-haspopup="menu" aria-expanded="' + ouvert + '">' + J.ico('more') + '</button>' +
    (ouvert ? '<div class="td-pop" role="menu"><button type="button" role="menuitem" data-stub="' + STUB('Préparer le mail « ' + (M.genres[t.genre] || 'À faire') + ' » dans Outlook') + '">' + J.ico('mail') + 'Préparer le mail</button><button type="button" role="menuitem" data-report="' + t.id + '">' + J.ico('cal') + 'Reporter à demain</button>' + (t.officine ? '<button type="button" role="menuitem" data-fiche="' + t.officine + '">' + J.ico('pharma') + 'Ouvrir la fiche</button>' : '') + '<button type="button" role="menuitem" data-suppr="' + t.id + '">' + J.ico('close') + 'Supprimer</button></div>' : '') + '</li>';
}
function groupe(titre, L) { return L.length ? '<h3 class="td-g">' + titre + '</h3><ul class="td-liste">' + L.map(ligne).join('') + '</ul>' : ''; }
function relances() { var L = T0.relances; if (!L.length) return vide('Aucune relance à faire maintenant.');
  return '<table class="tabl td-tab"><thead><tr><th>Officine<span class="st">prospect</span></th><th>Lien de rendez-vous envoyé le</th><th class="num">Depuis</th><th>État</th><th></th></tr></thead><tbody>' + L.map(function (r) { var o = J.offById(r.officine);
    return '<tr><td data-l="Officine"><button type="button" class="td-t" data-fiche="' + r.officine + '"><b>' + esc(J.nomOff(r.officine)) + '</b><span class="sub">' + (o ? esc(o.ville) : '') + '</span></button></td><td data-l="Lien envoyé le">' + esc(r.envoye) + '</td><td class="num" data-l="Depuis"><b>' + pl(r.jours, 'jour', 'jours') + '</b></td><td data-l="État"><span class="etat">' + J.ico('mail', 'var(--e-attention)') + esc(r.etat) + '</span></td><td class="td-act"><button type="button" class="pil" data-relancer="' + r.officine + '" data-envoye="' + esc(r.envoye) + '">' + J.ico('send') + 'Relancer</button></td></tr>'; }).join('') + '</tbody></table><p class="note">« Relancer » ajoute la relance à vos tâches d’aujourd’hui ; le mail se prépare ensuite dans Outlook.</p>'; }
function chauds() { var L = T0.chauds; if (!L.length) return vide('Aucun prospect chaud pour l’instant.');
  return '<table class="tabl td-tab"><thead><tr><th>Officine<span class="st">prospect</span></th><th>Le signal</th><th></th></tr></thead><tbody>' + L.map(function (c) { var o = J.offById(c.officine);
    return '<tr><td data-l="Officine"><button type="button" class="td-t" data-fiche="' + c.officine + '"><b>' + esc(J.nomOff(c.officine)) + '</b><span class="sub">' + (o ? esc(o.ville) : '') + '</span></button></td><td data-l="Signal"><span class="td-sig">' + J.ico('spark', 'var(--e-attention)') + esc(c.signal) + '</span></td><td class="td-act"><button type="button" class="pil plein" data-stub="' + STUB('Appeler') + '">' + J.ico('phone') + 'Appeler</button><button type="button" class="pil" data-proposer="' + c.officine + '">' + J.ico('cal') + 'Proposer un rendez-vous</button></td></tr>'; }).join('') + '</tbody></table>'; }
/* ---------- le corps : bande de trois chiffres, onglets, segment, listes ---------- */
function corps() {
  var af = M.aFaire(), fa = M.faites(), d = function (f) { return af.filter(f); }, auj = d(function (t) { return t.d === 0; }), ret = d(function (t) { return t.d != null && t.d < 0; }), ven = d(function (t) { return t.d > 0; }), sans = d(function (t) { return t.d == null; });
  var html = '';
  if (af.length || fa.length) html += '<div class="td-bande entre">' + J.stat({ i: 0, lib: 'À faire aujourd’hui', val: nf.format(auj.length), note: ret.length ? pl(ret.length, 'en retard', 'en retard') : 'rien en retard' }) +
    J.stat({ i: 1, lib: 'À venir', val: nf.format(ven.length + sans.length), note: sans.length ? pl(sans.length, 'tâche sans date', 'tâches sans date') : 'sur les prochains jours' }) + J.stat({ i: 2, lib: 'Faites', val: nf.format(fa.length), note: 'encore dans la liste' }) + '</div>';
  html += '<div class="td-ong"><div class="seg" role="group" aria-label="Onglets">' + [['taches', 'Tâches', 0], ['relances', '<span class="long">Prospects à relancer</span><span class="td-court">À relancer</span>', T0.relances.length], ['chauds', '<span class="long">Prospects chauds</span><span class="td-court">Chauds</span>', T0.chauds.length]].map(function (o) { return '<button type="button" data-onglet="' + o[0] + '" aria-pressed="' + (E.onglet === o[0]) + '">' + o[1] + (o[2] ? ' <span class="cnt">' + o[2] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
    (E.onglet === 'taches' ? '<div class="seg" role="group" aria-label="À faire ou fait"><button type="button" data-seg="afaire" aria-pressed="' + (E.seg === 'afaire') + '">À faire</button><button type="button" data-seg="fait" aria-pressed="' + (E.seg === 'fait') + '">Fait</button></div>' : '') + '</div>';
  var an = E.annule && Date.now() - E.annule.t < 8000 ? E.annule : null, liste;
  if (E.onglet === 'taches') {
    if (E.seg === 'afaire') { var p = function (L) { return L.filter(passe); }, g = groupe('En retard ou aujourd’hui', p(ret.concat(auj))) + groupe('À venir', p(ven)) + groupe('Sans date', p(sans)); liste = g || vide(af.length ? 'Aucune tâche pour « ' + esc(E.q.trim()) + ' ».' : 'Ajoutez votre première tâche.'); }
    else { var ff = fa.filter(passe); liste = ff.length ? groupe('Faites', ff) : vide(fa.length ? 'Aucune tâche faite pour « ' + esc(E.q.trim()) + ' ».' : 'Rien de coché pour l’instant.'); }
  } else liste = E.onglet === 'relances' ? relances() : chauds();
  return html + '<section class="carte td-carte" aria-label="Liste">' + (an ? '<div class="td-annule"><span>' + J.ico('check', 'var(--e-bien)') + 'Tâche faite.</span><button type="button" class="pil" data-annule="' + an.id + '">Annuler</button></div>' : '') + liste + '</section>';
}
function mails() { var ICO = { rdv: 'cal', merci: 'mail', compte: 'doc' };
  return '<h2 class="titre-s">Les mails tout prêts<span class="st">trois modèles de la maison et les vôtres · le mail joint les fiches faites dans Marketing et le catalogue par catégorie</span></h2><div class="td-mails entre">' +
    T0.modeles.map(function (m, i) { return '<section class="carte td-mod" style="--i:' + i + '"><span class="rond gris">' + J.ico(ICO[m.k] || 'mail') + '</span><div><b>' + esc(m.t) + '</b><span class="sub">' + esc(m.s) + '</span></div><button type="button" class="pil" data-stub="' + STUB('Préparer le mail « ' + m.t + ' » dans Outlook') + '">' + J.ico('send') + 'Préparer</button></section>'; }).join('') +
    '<section class="carte td-mod td-mes" style="--i:3"><span class="rond gris">' + J.ico('user') + '</span><div><b>Mes modèles</b><span class="sub">les vôtres · adresse du pharmacien facultative</span></div><ul class="td-mesl">' + T0.mesModeles.map(function (m) { return '<li><button type="button" data-stub="' + STUB('Ouvrir le modèle « ' + m.t + ' »') + '"><span><b>' + esc(m.t) + '</b><span class="sub">' + esc(m.s) + '</span></span>' + J.ico('chev') + '</button></li>'; }).join('') + '</ul><button type="button" class="pil" data-stub="' + STUB('Créer un modèle (ex. : Relance après salon)') + '">' + J.ico('plus') + 'Nouveau modèle</button></section></div>'; }
/* ---------- la feuille « Ajouter une tâche » ---------- */
function feuilleHtml() { var F = E.form;
  return '<div class="td-voile" data-fermer></div><aside class="td-feuille" role="dialog" aria-modal="true" aria-label="Ajouter une tâche"><div class="td-f-h"><h2>Ajouter une tâche</h2><button type="button" class="b-rond" data-fermer aria-label="Fermer">' + J.ico('close') + '</button></div>' +
    '<p class="td-lab">Quel genre de tâche ?</p><div class="td-genres" role="group" aria-label="Genre">' + Object.keys(M.genres).map(function (g) { return '<button type="button" class="td-gen" data-genre="' + g + '" aria-pressed="' + (F.genre === g) + '">' + J.ico(M.genreIco(g), GCOL[g]) + esc(M.genres[g]) + '</button>'; }).join('') + '</div>' +
    '<label class="td-lab">Officine<select class="sel" id="td-off"><option value="">Nom de l’officine (ou rien)</option>' + OFF.map(function (o) { return '<option value="' + o.id + '"' + (F.officine === o.id ? ' selected' : '') + '>' + esc(J.joli(o.nom)) + ' · ' + esc(o.ville) + '</option>'; }).join('') + '</select></label>' +
    '<label class="td-lab">Note<textarea id="td-note" rows="3" placeholder="Ex. : commande de Repatha">' + esc(F.note) + '</textarea></label><button type="button" class="pil td-dicter" data-stub="' + STUB('Dicter la note à la voix') + '">' + J.ico('mic') + 'Dicter</button>' +
    '<label class="td-lab">Pour quand ?<input type="date" id="td-date" value="' + esc(F.echeance || '') + '"></label><div class="td-rapides">' + [['Aujourd’hui', M.plusJours(0)], ['Demain', M.plusJours(1)], ['Dans une semaine', M.plusJours(7)], ['Sans date', '']].map(function (r) { return '<button type="button" class="chip" data-date="' + r[1] + '">' + r[0] + '</button>'; }).join('') + '</div>' +
    '<div class="td-f-pied"><button type="button" class="pil plein" data-valider>' + J.ico('plus') + 'Ajouter</button><button type="button" class="pil" data-fermer>Annuler</button></div></aside>'; }
function maj(el) { $('#td-corps', el).innerHTML = corps(); var l = $('#td-lede', el); if (l) l.innerHTML = lede(); brancher(el); }
function feuille(el) { $('#td-feuille', el).innerHTML = E.feuille ? feuilleHtml() : ''; brancher(el); var n = $('#td-note', el); if (n) n.focus(); }
function brancher(el) {
  var on = function (sel, f) { $$(sel, el).forEach(function (b) { b.onclick = function (ev) { f(b, ev); }; }); }, v = function (b, a) { return b.getAttribute(a); };
  on('[data-coche]', function (b) { var id = v(b, 'data-coche'); if (b.getAttribute('aria-checked') === 'true') { M.cocher(id, false); maj(el); return; } b.setAttribute('aria-checked', 'true'); b.closest('.td-l').classList.add('td-out'); setTimeout(function () { M.cocher(id, true); maj(el); setTimeout(function () { var a = $('.td-annule', el); if (a) a.remove(); }, 8000); }, 280); });
  on('[data-annule]', function (b) { M.cocher(v(b, 'data-annule'), false); maj(el); });
  on('[data-fiche]', function (b) { J.ouvrirFiche(v(b, 'data-fiche')); });
  on('[data-menu]', function (b) { var id = v(b, 'data-menu'); E.menu = E.menu === id ? null : id; maj(el); });
  on('[data-report]', function (b) { M.reporter(v(b, 'data-report'), M.plusJours(1)); E.menu = null; maj(el); J.toast('Tâche reportée à demain.'); });
  on('[data-suppr]', function (b) { M.supprimer(v(b, 'data-suppr')); E.menu = null; maj(el); J.toast('Tâche supprimée.'); });
  on('[data-onglet]', function (b) { E.onglet = v(b, 'data-onglet'); E.menu = null; maj(el); });
  on('[data-seg]', function (b) { E.seg = v(b, 'data-seg'); E.menu = null; maj(el); });
  on('[data-relancer]', function (b) { M.ajouter({ genre: 'rdv', officine: v(b, 'data-relancer'), note: 'Relancer : lien de rendez-vous envoyé le ' + v(b, 'data-envoye'), echeance: M.AUJ }); maj(el); J.toast('Relance ajoutée à vos tâches d’aujourd’hui.'); });
  on('[data-proposer]', function (b) { M.ajouter({ genre: 'rdv', officine: v(b, 'data-proposer'), note: 'Proposer un rendez-vous (prospect chaud)', echeance: M.AUJ }); maj(el); J.toast('Demande de rendez-vous ajoutée à vos tâches d’aujourd’hui.'); });
  on('[data-ajouter]', function () { E.feuille = true; E.form = { genre: 'rdv', officine: '', note: '', echeance: M.AUJ }; feuille(el); });
  on('[data-fermer]', function () { E.feuille = false; feuille(el); });
  on('[data-genre]', function (b) { E.form.genre = v(b, 'data-genre'); $$('[data-genre]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
  on('[data-date]', function (b) { E.form.echeance = v(b, 'data-date'); var i = $('#td-date', el); if (i) i.value = E.form.echeance; });
  on('[data-valider]', function () { var F = E.form; if (!F.note.trim()) { J.toast('Écrivez d’abord la note de la tâche.'); var n = $('#td-note', el); if (n) n.focus(); return; }
    M.ajouter({ genre: F.genre, officine: F.officine || null, note: F.note.trim(), echeance: F.echeance || null }); E.feuille = false; E.onglet = 'taches'; E.seg = 'afaire'; feuille(el); maj(el); J.toast('Tâche ajoutée' + (F.echeance ? ' pour le ' + J.dateFr(F.echeance) : ', sans date') + '.'); });
  var o = $('#td-off', el); if (o) o.onchange = function () { E.form.officine = o.value; };
  var n2 = $('#td-note', el); if (n2) n2.oninput = function () { E.form.note = n2.value; };
  var dt = $('#td-date', el); if (dt) dt.onchange = function () { E.form.echeance = dt.value; };
  var q = $('#td-q', el); if (q) q.oninput = function () { E.q = q.value; maj(el); };
}
J.ecrans.todo = {
  rendre: function (el) {
    /* L'action du bandeau est une pilule blanche ; la note « Personnelle » est un bloc à part sous le bandeau, pas une ligne de plus dans le bleu.
       En vue pharmacien, le bandeau ne garde que son titre et le champ ; la feuille d'ajout vit dans le conteneur interne. */
    el.innerHTML = '<div class="page td-page">' + J.bandeau({ croix: true, eyebrow: esc(X.accueil.date) + ' · ma liste', titre: 'To do list', lede: '<span id="td-lede">' + lede() + '</span>',
        actions: '<button type="button" class="pil" data-ajouter>' + J.ico('plus') + 'Ajouter une tâche</button>',
        recherche: { id: 'td-q', placeholder: 'Une officine, une note…', aria: 'Filtrer les tâches', valeur: E.q } }) +
      '<p class="note vp td-vp">Vue pharmacien : la To do list est personnelle et réservée à l’interne, elle n’est pas affichée. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
      '<div data-interne><p class="note td-perso">' + J.ico('lock') + '<span><b>Personnelle : chacun voit la sienne.</b> Demandes de rendez-vous à envoyer, suites de rendez-vous, ouvertures de compte, et tout le reste.</span></p>' +
      '<div id="td-corps">' + corps() + '</div>' + mails() + '<div id="td-feuille">' + (E.feuille ? feuilleHtml() : '') + '</div></div></div>';
    $$('.bandeau .lede,.ban-act,.rech-g', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
    brancher(el);
    if (!J.tdOnce) { J.tdOnce = true;
      document.addEventListener('click', function (ev) { if (E.menu && !(ev.target.closest && ev.target.closest('.td-pop,[data-menu]'))) { E.menu = null; var e2 = $('#ecran-todo'); if (e2 && !e2.hidden && $('#td-corps', e2)) maj(e2); } });
      document.addEventListener('keydown', function (ev) { if (ev.key !== 'Escape' || J.courant.ecran !== 'todo') return; var e2 = $('#ecran-todo'); if (!e2) return; if (E.feuille) { E.feuille = false; feuille(e2); } else if (E.menu) { E.menu = null; maj(e2); } }); }
  }
};
})();
