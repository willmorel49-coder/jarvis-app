/* « Le QG » : fil de l'équipe (messages datés, champ d'écriture), Sujets (titre, auteur, N messages, quand → #qg-detail), Nouveau sujet,
   Remontées (idées de l'équipe : titre, état À l'étude / Prévu / Écarté = mot + icône, votes), un sujet ouvert (carte d'identité + le fil du sujet + réponse).
   Données : window.DONNEES_V5.qg (FICTIVES, dites à l'écran) ; prénoms = ceux des données fictives seulement. Le fil d'un sujet n'existe pas dans les données (seul le
   nombre de messages) : un message d'ouverture par sujet et des réponses courtes tirées d'une réserve neutre, de façon déterministe. Écrire, répondre et voter marchent
   dans la maquette (état en mémoire, non enregistré). Tout interne : [data-interne] + avis .vp. Aucune couleur de chiffre : les états vivent sur l'icône seule. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, S = J.S, X = J.X;
var Q = X && X.qg; if (!Q) return;
var P = X.personne || { prenom: 'Claire', nom: 'Claire Tessier', initiales: 'CT' };
var MOI = (P.prenom || 'Claire') + ' ' + String(P.nom || 'T').split(' ').pop().charAt(0) + '.';
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var OUVERTURE = ['Le listing 2027 est dans Documents depuis lundi. Qui l’a déjà présenté en officine, et avec quel accueil ?', 'Le contingentement sur les stylos 3 ml inquiète les titulaires. Quel message leur donner, et faut-il l’écrire dans le brief du matin ?',
  'Proposition : un rappel automatique trois jours après chaque rendez-vous, pour ne plus oublier le suivi.', 'Premiers retours sur le catalogue Offilog 300 : qu’en disent vos officines, et quelles références manquent ?', 'Deux rendez-vous à Fréjus jeudi : quelqu’un part de Marseille et peut faire la route à deux ?'];
/* le fil d'un sujet n'existe pas dans les données (seul le nombre de messages) : une réserve de réponses PAR SUJET (jamais la phrase d'un autre sujet dans un fil), et des heures
   qui suivent l'ouverture : un sujet « il y a N h » a ses réponses entre son ouverture et le dernier message du fil (l'heure de l'écran) ; « hier » / « il y a N jours » : une suite
   strictement croissante dans la journée (« du premier message au dernier »). */
var REPONSES = [
  ['Testé hier à Aix : bon accueil, la titulaire a demandé la version imprimée.', 'Pas encore présenté, je m’en charge cette semaine.', 'À Toulon, la question du prix net est venue tout de suite : prévoir la réponse.', 'La version PDF passe bien sur tablette, moins sur téléphone.', 'Je l’ai joint au mail de suite de rendez-vous, retour positif.', 'Proposition : une page de synthèse en tête, le détail ensuite.', 'D’accord, je prépare cette page pour vendredi.'],
  ['Même retour à Toulon : la question revient à chaque visite.', 'Le laboratoire annonce un retour progressif début janvier.', 'Deux boîtes par commande pour l’instant : le quota est celui du comptoir.', 'D’accord pour l’écrire dans le brief, je prépare une phrase courte.', 'Les titulaires veulent surtout une date : donnons celle du laboratoire.', 'J’ai mis la fiche à jour dans Documents.', 'Le message tient en trois lignes, je vous l’envoie pour relecture.', 'Relu : rien à redire, on peut l’envoyer demain matin.', 'Pensez aux officines sans commande depuis un mois : elles ne le verront pas.', 'Je les appelle demain, la liste est dans la To do.', 'Merci à tous : sujet à clore quand le retour sera confirmé.'],
  ['Bonne idée, à condition de pouvoir régler le délai.', 'Trois jours me semblent courts après une première visite : cinq ?', 'Je transmets à l’équipe produit avec les deux délais.'],
  ['Retour d’Avignon : le format plaît, la pagination moins.', 'Deux références de parapharmacie manquent, je les ai notées.', 'À Nice, la titulaire a surtout regardé la chaîne du froid.', 'Je vois le point avec l’équipe produit et je reviens vers vous.', 'Le tableau des prix nets est le plus consulté : à mettre en tête.', 'Les officines Pharma Horizon demandent la version avec leur logo.', 'Retours compilés dans Documents, onglet « Offilog 300 ».', 'Merci, je passe la synthèse à l’équipe marketing.'],
  ['Je pars de Marseille à 8 h, une place libre.', 'Parfait, rendez-vous au dépôt de Septèmes à 7 h 45.']
];
function minutes(h) { var m = /(\d+)\s*h\s*(\d*)/.exec(String(h || '')); return m ? (+m[1]) * 60 + (+m[2] || 0) : 0; }
function hhmm(n) { n = Math.max(0, Math.round(n)); return Math.floor(n / 60) + ' h ' + ('0' + (n % 60)).slice(-2); }
var FIN_FIL = Q.fil.length ? Math.max.apply(null, Q.fil.map(function (m) { return minutes(m.heure); })) : 10 * 60 + 30; /* l'heure de l'écran = le dernier message du fil */
function heuresDe(s, n) { var il = /il y a (\d+) h/.exec(String(s.quand || '')), deb, fin, jour;
  if (il) { deb = Math.max(0, FIN_FIL - (+il[1]) * 60); fin = FIN_FIL - 4; jour = 'aujourd’hui'; } else { deb = 9 * 60 + 5; fin = 18 * 60 + 10; jour = s.quand; }
  var out = []; for (var k = 0; k < n; k++) out.push(jour + ' · ' + hhmm(deb + (k + 1) * (fin - deb) / (n + 1))); return out; }
var PERSONNES = []; Q.sujets.concat(Q.fil).forEach(function (x) { if (PERSONNES.indexOf(x.par) < 0) PERSONNES.push(x.par); });
var ICO_ETAT = { 'À l’étude': ['bulb', 'var(--e-attention)'], 'Prévu': ['check', 'var(--e-bien)'], 'Écarté': ['close', 'var(--e-neutre)'] };
/* état de l'écran : copies des données (écrire, répondre, voter changent ce qui s'affiche, sans rien enregistrer) */
var E = S.qg = S.qg || { q: '', sujet: 0, form: false, idee: false, fil: Q.fil.slice(), votes: {},
  sujets: Q.sujets.map(function (s, i) { return { titre: s.titre, par: s.par, quand: s.quand, ouverture: OUVERTURE[i % OUVERTURE.length], reponses: reponsesDe(s, i) }; }),
  remontees: Q.remontees.map(function (r) { return { titre: r.titre, etat: r.etat, votes: r.votes }; }) };
function reponsesDe(s, i) { var out = [], n = Math.max(0, (s.messages || 1) - 1), pool = REPONSES[i % REPONSES.length], h = heuresDe(s, n);
  for (var j = 0; j < n; j++) { var par = PERSONNES[(i * 2 + j * 3 + 1) % PERSONNES.length]; if (par === s.par && PERSONNES.length > 1) par = PERSONNES[(i * 2 + j * 3 + 2) % PERSONNES.length];
    out.push({ par: par, texte: pool[j % pool.length], quand: h[j] }); } return out; }
function ini(n) { return String(n).split(/\s+/).map(function (w) { return w.charAt(0); }).join('').replace(/\./g, '').slice(0, 2).toUpperCase(); }
/* typographie française : espace insécable avant ? ! : ; et à l'intérieur des guillemets (un « ? » ne reste jamais seul sur sa ligne) */
function typo(s) { return esc(s).replace(/\s([?!:;»])/g, ' $1').replace(/«\s/g, '« '); }
function av(nom) { return nom === MOI ? '<span class="avatar qg-moi" aria-hidden="true">' + esc(P.initiales || ini(nom)) + '</span>' : '<span class="qg-av" aria-hidden="true">' + esc(ini(nom)) + '</span>'; }
function etatHtml(e) { var k = ICO_ETAT[e] || ICO_ETAT['À l’étude']; return '<span class="etat">' + J.ico(k[0], k[1]) + esc(e) + '</span>'; }
function maintenant() { var d = new Date(); return d.getHours() + ' h ' + ('0' + d.getMinutes()).slice(-2); }
function filtreQ(txt) { var q = E.q.trim().toLowerCase(); return !q || txt.toLowerCase().indexOf(q) >= 0; }
function avisVp() { return '<p class="vp qg-vp">Cet outil est réservé à l’équipe Intégral : rien n’y est montré au pharmacien. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>'; }
function message(m, i, cle) { return '<div class="qg-msg' + (m.par === MOI ? ' moi' : '') + '" style="--i:' + Math.min(i, 12) + '">' + av(m.par) + '<div class="qg-m"><div class="qg-m-t"><b>' + esc(m.par === MOI ? 'Vous' : m.par) + '</b><span class="qg-h">' + esc(m[cle || 'heure']) + '</span></div><p>' + typo(m.texte) + '</p></div></div>'; }
function composer(id, placeholder, bouton) { return '<form class="qg-ecrire" id="' + id + '"><label class="filtre qg-champ">' + J.ico('chat') + '<input type="text" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '" maxlength="240" autocomplete="off"></label><button type="submit" class="pil plein">' + J.ico('send') + bouton + '</button></form>'; }
/* ---------- les trois cartes de l'écran ---------- */
function carteFil() {
  var vis = E.fil.filter(function (m) { return filtreQ(m.par + ' ' + m.texte); });
  return '<section class="carte qg-fil" aria-label="Fil de l’équipe"><div class="tete"><div><h2>Fil de l’équipe</h2><p class="st">ce que l’équipe se dit aujourd’hui · du plus ancien au plus récent</p></div></div>' +
    '<div class="qg-msgs entre" id="qg-msgs">' + (vis.length ? vis.map(function (m, i) { return message(m, i); }).join('') : '<p class="note">Aucun message ne contient « ' + esc(E.q) + ' ».</p>') + '</div>' + composer('qg-f-ecrire', 'Écrire à l’équipe…', 'Envoyer') + '</section>';
}
function carteSujets() {
  var vis = E.sujets.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return filtreQ(x.s.titre + ' ' + x.s.par); });
  return '<section class="carte qg-sujets" aria-label="Sujets"><div class="tete"><div><h2>Sujets</h2><p class="st">les discussions ouvertes · le plus récent d’abord · un clic ouvre le sujet</p></div><button type="button" class="pil" data-qg-form aria-expanded="' + E.form + '">' + J.ico('plus') + 'Nouveau sujet</button></div>' +
    (E.form ? '<form class="qg-nouveau" id="qg-nouveau"><label class="filtre qg-champ">' + J.ico('edit') + '<input type="text" placeholder="Le titre du sujet…" aria-label="Titre du nouveau sujet" maxlength="90" autocomplete="off"></label><label class="filtre qg-champ">' + J.ico('chat') + '<input type="text" placeholder="Votre premier message…" aria-label="Premier message" maxlength="240" autocomplete="off"></label><button type="submit" class="pil plein">' + J.ico('send') + 'Ouvrir le sujet</button></form>' : '') +
    '<div class="qg-liste">' + (vis.length ? vis.map(function (x, k) { var s = x.s, n = 1 + s.reponses.length; return '<button type="button" class="qg-sujet" data-sujet="' + x.i + '" style="--i:' + k + '">' + av(s.par) + '<span class="qg-s-t"><b>' + typo(s.titre) + '</b><span class="sub">par ' + esc(s.par === MOI ? 'vous' : s.par) + ' · ' + n + ' message' + (n > 1 ? 's' : '') + ' · ' + esc(s.quand) + '</span></span>' + J.ico('chev') + '</button>'; }).join('') : '<p class="note">Aucun sujet ne contient « ' + esc(E.q) + ' ».</p>') + '</div></section>';
}
function carteRemontees() {
  var tri = E.remontees.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return filtreQ(x.r.titre + ' ' + x.r.etat); }).sort(function (a, b) { return b.r.votes - a.r.votes; });
  return '<section class="carte qg-rem" aria-label="Remontées"><div class="tete"><div><h2>Remontées</h2><p class="st">les idées de l’équipe pour JARVIS · un vote par personne · l’état est décidé par l’équipe produit · les plus votées d’abord</p></div><button type="button" class="pil" data-qg-idee aria-expanded="' + E.idee + '">' + J.ico('bulb') + 'Proposer une idée</button></div>' +
    (E.idee ? '<form class="qg-nouveau" id="qg-idee"><label class="filtre qg-champ">' + J.ico('bulb') + '<input type="text" placeholder="Votre idée, en une phrase…" aria-label="Votre idée" maxlength="120" autocomplete="off"></label><button type="submit" class="pil plein">' + J.ico('send') + 'Proposer</button></form>' : '') +
    '<table class="tabl qg-tab"><thead><tr><th>Idée</th><th>État<span class="st">décidé par l’équipe produit</span></th><th class="num">Votes</th><th></th></tr></thead><tbody>' +
    (tri.length ? tri.map(function (x, k) { var r = x.r, v = !!E.votes[x.i]; return '<tr style="--i:' + k + '"><td data-l="Idée"><b class="qg-idee-t">' + typo(r.titre) + '</b></td><td data-l="État">' + etatHtml(r.etat) + '</td><td class="num" data-l="Votes"><b>' + nf.format(r.votes) + '</b></td><td class="qg-act"><button type="button" class="pil' + (v ? ' contour' : '') + '" data-vote="' + x.i + '" aria-pressed="' + v + '">' + J.ico(v ? 'check' : 'plus') + (v ? 'Voté' : 'Voter') + '</button></td></tr>'; }).join('') : '<tr><td colspan="4" class="qg-vide">Aucune idée ne contient « ' + esc(E.q) + ' ».</td></tr>') + '</tbody></table></section>';
}
/* ---------- l'écran principal ---------- */
function corps() { return '<div class="gdouble stack qg-haut">' + carteFil() + carteSujets() + '</div>' + carteRemontees(); }
var RACINE = null;
function lier(el) {
  $$('[data-sujet]', el).forEach(function (b) { b.onclick = function () { E.sujet = +b.getAttribute('data-sujet'); J.aller('qg-detail'); }; });
  $$('[data-qg-form]', el).forEach(function (b) { b.onclick = function () { E.form = !E.form; E.idee = false; redessiner(); if (E.form) { var i = $('#qg-nouveau input', RACINE); if (i) i.focus(); } }; });
  $$('[data-qg-idee]', el).forEach(function (b) { b.onclick = function () { E.idee = !E.idee; E.form = false; redessiner(); if (E.idee) { var i = $('#qg-idee input', RACINE); if (i) i.focus(); } }; });
  $$('[data-vote]', el).forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-vote'), r = E.remontees[k]; if (!r) return; if (E.votes[k]) { delete E.votes[k]; r.votes -= 1; } else { E.votes[k] = true; r.votes += 1; } redessiner(); }; });
  var f = $('#qg-f-ecrire', el); if (f) f.onsubmit = function (ev) { ev.preventDefault(); var i = $('input', f), t = i.value.trim(); if (!t) { J.toast('Écrivez d’abord votre message.'); return; } E.fil.push({ par: MOI, texte: t, heure: maintenant() }); E.q = ''; redessiner(); J.toast('Message envoyé à l’équipe (dans cette maquette, il n’est pas enregistré).'); };
  var n = $('#qg-nouveau', el); if (n) n.onsubmit = function (ev) { ev.preventDefault(); var ins = $$('input', n), t = ins[0].value.trim(), m = ins[1].value.trim(); if (!t) { J.toast('Donnez d’abord un titre au sujet.'); return; }
    E.sujets.unshift({ titre: t, par: MOI, quand: 'à l’instant', ouverture: m || t, reponses: [] }); E.form = false; E.q = ''; E.sujet = 0; J.aller('qg-detail'); };
  var d = $('#qg-idee', el); if (d) d.onsubmit = function (ev) { ev.preventDefault(); var t = $('input', d).value.trim(); if (!t) { J.toast('Écrivez d’abord votre idée.'); return; } E.remontees.push({ titre: t, etat: 'À l’étude', votes: 1 }); E.votes[E.remontees.length - 1] = true; E.idee = false; E.q = ''; redessiner(); J.toast('Idée proposée à l’équipe (dans cette maquette, elle n’est pas enregistrée).'); };
  J.poseIcones(el);
}
/* redessine depuis le conteneur d'écran (RACINE), jamais depuis la boîte elle-même : querySelector ne trouve que des descendants, et Nouveau sujet / Proposer / Voter / Envoyer restaient inertes */
function redessiner() { var el = RACINE, box = el && $('#qg-corps', el); if (!box) return; box.innerHTML = corps(); lier(box); var q = $('#qg-q', el); if (q && q.value !== E.q) q.value = E.q; }
function principal(el) {
  RACINE = el;
  var nbMsg = E.fil.length, nbSuj = E.sujets.length, nbRem = E.remontees.length;
  var lede = '<span data-interne><b>' + nbMsg + ' message' + (nbMsg > 1 ? 's' : '') + '</b> ce matin dans le fil, <b>' + nbSuj + ' sujet' + (nbSuj > 1 ? 's' : '') + '</b> ouvert' + (nbSuj > 1 ? 's' : '') + ' et <b>' + nbRem + ' remontée' + (nbRem > 1 ? 's' : '') + '</b> d’idées. Ce que l’équipe se dit, au même endroit ; un clic sur un sujet l’ouvre.</span><span class="vp">Outil réservé à l’équipe Intégral.</span>';
  el.innerHTML = '<div class="page">' + J.bandeau({
    croix: true, eyebrow: 'QG · ' + esc((X.accueil && X.accueil.date) || 'aujourd’hui'), titre: 'QG', lede: lede,
    actions: '<button class="pil" type="button" data-interne data-stub="' + STUB('Régler mes notifications') + '">' + J.ico('bell') + 'Mes notifications</button>',
    recherche: { id: 'qg-q', placeholder: 'Un sujet, un message, une idée, un collègue…', aria: 'Rechercher dans le QG', valeur: E.q }
  }) + '<div class="qg-corps stack" id="qg-corps" data-interne>' + corps() + '</div>' + avisVp() + '</div>';
  lier($('#qg-corps', el));
  /* vue pharmacien : les outils du bandeau (actions, recherche) sont internes, comme sur l'écran To do */
  $$('.ban-act,.rech-g', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  $('#qg-q', el).oninput = function (ev) { E.q = ev.target.value; redessiner(); };
}
/* ---------- un sujet ouvert (#qg-detail) ---------- */
function detail(el) {
  var i = Math.max(0, Math.min(E.sujet, E.sujets.length - 1)), s = E.sujets[i]; if (!s) { principal(el); return; } E.sujet = i;
  var msgs = [{ par: s.par, texte: s.ouverture, quand: s.quand }].concat(s.reponses), parts = []; msgs.forEach(function (m) { if (parts.indexOf(m.par) < 0) parts.push(m.par); });
  /* vue pharmacien : seul le bouton Retour reste ; flèches et menu des sujets (leurs titres sont internes) portent data-interne */
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'QG</button><div class="qg-outils-i" data-interne><div class="qg-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Sujet précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Sujet suivant">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre qg-autre">' + J.ico('search') + '<select id="qg-autre" aria-label="Autre sujet"><option value="">Autre sujet…</option>' + E.sujets.map(function (x, k) { return '<option value="' + k + '">' + typo(x.titre) + '</option>'; }).join('') + '</select></label></div>';
  var actions = '<div class="ronds"><a class="rond-act" href="#qg-detail" data-ancre="qg-rep"><span class="rond"><span class="ico">' + J.icoSvg('chat') + '</span></span>Répondre</a>' + J.rond('bell', 'Suivre', STUB('Suivre ce sujet')) + J.rond('share', 'Partager', STUB('Partager ce sujet')) + '</div>' +
    '<button class="pil plein" type="button" data-stub="' + STUB('Marquer le sujet comme résolu') + '">' + J.ico('check') + 'Marquer comme résolu</button><button class="pil contour" type="button" data-stub="' + STUB('Créer une tâche depuis ce sujet') + '">' + J.ico('tasks') + 'En faire une tâche</button>';
  var dernier = msgs[msgs.length - 1];
  el.innerHTML = '<div class="page">' + J.bandeau({ classe: 'qg-ban-det', deborde: true, eyebrow: '<span data-interne>QG · sujet ouvert par ' + esc(s.par === MOI ? 'vous' : s.par) + '</span><span class="vp">Le QG</span>', recherche: '<div class="qg-outils">' + outils + '</div>' }) +
    '<div class="sous-bandeau stack entre" data-interne>' + J.identite({ classe: 'qg-ident', nom: typo(s.titre), meta: '<span class="etat">' + J.ico('chat', 'var(--e-neutre)') + 'Sujet ouvert</span><span>' + (parts.length > 1 ? parts.length + ' participants' : 'un participant') + '</span>',
      mois: { lib: 'Messages dans le sujet', val: nf.format(msgs.length), evo: '<span class="sub">dernier message de ' + esc(dernier.par === MOI ? 'vous' : dernier.par) + '</span>' },
      lignes: [['Ouvert par', esc(s.par === MOI ? 'Vous' : s.par)], ['Ouvert', esc(s.quand)], ['Participants', esc(parts.map(function (p) { return p === MOI ? 'vous' : p; }).join(', '))], ['Suivi', 'vous recevez chaque réponse'], ['Visibilité', 'toute l’équipe Intégral']], actions: actions }) +
    '<section class="carte qg-fil" aria-label="Le fil du sujet"><div class="tete"><div><h2>Le fil du sujet</h2><p class="st">du premier message au dernier · répondre ajoute votre message au bas du fil</p></div></div><div class="qg-msgs entre">' + msgs.map(function (m, k) { return message(m, k, 'quand'); }).join('') + '</div><div id="qg-rep">' + composer('qg-repondre', 'Répondre à ' + (s.par === MOI ? 'l’équipe' : s.par) + '…', 'Répondre') + '</div></section></div>' + avisVp() + '</div>';
  J.poseIcones(el);
  $('#qg-repondre', el).onsubmit = function (ev) { ev.preventDefault(); var f = ev.target, t = $('input', f).value.trim(); if (!t) { J.toast('Écrivez d’abord votre réponse.'); return; } s.reponses.push({ par: MOI, texte: t, quand: 'à l’instant · ' + maintenant() }); J.route(); var c = $('#qg-rep', el); if (c) { var y = c.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } };
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var n = i + (+b.getAttribute('data-pn')); if (n < 0) n = E.sujets.length - 1; if (n >= E.sujets.length) n = 0; E.sujet = n; J.route(); window.scrollTo(0, 0); }; });
  $('#qg-autre', el).onchange = function (ev) { if (ev.target.value !== '') { E.sujet = +ev.target.value; J.route(); window.scrollTo(0, 0); } };
  $$('[data-ancre]', el).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); var c = $('#' + a.getAttribute('data-ancre'), el); if (c) { var y = c.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); var inp = $('input', c); if (inp) inp.focus(); } }; });
}
J.ecrans.qg = { rendre: function (el, etat) { if (etat.suite === 'detail') detail(el); else principal(el); } };
})();
