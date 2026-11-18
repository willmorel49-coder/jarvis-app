/* JARVIS DAILY, le brief du marché officinal.
   L'écran INFOS DU JOUR = le média du matin : bandeau « recherche d'abord » (jour et heure d'édition, phrase-réponse, « Écouter le résumé », « Ma bibliothèque »,
   champ qui filtre en direct, sélecteur d'édition profil × secteur) ; la une « Le résumé en 60 secondes » (cinq informations, frise des durées, brief audio par la
   synthèse vocale du navigateur) ; « Ma bibliothèque commerciale » (localStorage dans un try/catch, la page marche sans) ; la barre des 8 rubriques ; le journal
   (une section par rubrique : nature + date, titre, résumé, « Pourquoi c'est important pour moi », « L'impact sur mon secteur » cliquable, gestes ; « À surveiller »
   en agenda) ; le volet d'un article (#infos-detail) ; le pied (avertissement, éditions d'avant). Données FICTIVES : window.DONNEES_GPS.daily. Tout l'écran est
   INTERNE. Aucun chiffre écrit deux fois : le nombre d'informations vit dans la phrase du bandeau, les comptes par rubrique dans la barre des rubriques. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, S = J.S, G = window.DONNEES_GPS, DY = G && G.daily;
if (!DY) { J.ecrans.infos = { rendre: function (el) { el.innerHTML = '<div class="page"><section class="carte"><h1>JARVIS DAILY</h1><p class="note">Les données du DAILY (donnees-gps-daily.js) ne sont pas chargées : l’écran ne peut pas se dessiner.</p></section></div>'; } }; return; }
var ED = DY.edition, RUBS = DY.rubriques, INF = DY.infos, EDS = DY.editions, R60 = DY.resume60, AUD = DY.audio, BIB = DY.bibliotheque, AUJ = G.aujourdhui;
var X = J.X, MATINS = (X && X.infos && X.infos.matinsAvant) || [];
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var CLE = BIB.cleStockage, CLE_ED = CLE + '-edition';
function lireLocal(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function ecrireLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; /* la page marche sans */ } }
function profilDe(id) { return EDS.profils.filter(function (p) { return p.id === id; })[0] || null; }
function secteurDe(id) { return EDS.secteurs.filter(function (s) { return s.id === id; })[0] || null; }
/* ---------- état : édition choisie (gardée dans ce navigateur), rubrique filtrée, recherche, article ouvert, bibliothèque ----------
   S.infos.edition (« profil-secteur ») est la clé que lit l'accueil GPS : elle suit toujours le choix fait ici (et l'inverse, voir suivreEdition). */
var E = S.infos = S.infos || {}, M0 = lireLocal(CLE_ED) || {};
if (!profilDe(E.profil)) E.profil = profilDe(M0.profil) ? M0.profil : EDS.parDefaut.profil;
if (!secteurDe(E.secteur)) E.secteur = secteurDe(M0.secteur) ? M0.secteur : EDS.parDefaut.secteur;
[['rub', ''], ['q', ''], ['ouverte', null], ['y', null], ['bib', null], ['suiteVue', null], ['vu', false], ['edsOuvert', false], ['depl', {}]].forEach(function (d) { if (!(d[0] in E)) E[d[0]] = d[1]; });
E.edition = E.profil + '-' + E.secteur;
var RUBBY = {}; RUBS.forEach(function (r) { RUBBY[r.id] = r; });
var BY = {}; INF.forEach(function (x) { BY[x.id] = x; });
/* icône de chaque rubrique, en bleu d'encre (une rubrique se distingue par son titre et sa place, pas par une couleur) ; icône selon la nature de la source */
var RUB = { marche: 'chart', reglementation: 'doc', groupements: 'group', laboratoires: 'pill', concurrents: 'truck', terrain: 'route', offilog: 'box', surveiller: 'cal' };
function rubIco(id) { return J.ico(RUB[id] || 'infos'); }
function rubNom(id) { return RUBBY[id] ? RUBBY[id].nom : id; }
function rubHtml(id) { return '<span class="etat dy-rub-e">' + rubIco(id) + esc(rubNom(id)) + '</span>'; }
var NAT = [[/officiel|légale/i, 'doc'], [/communiqué/i, 'mail'], [/presse/i, 'infos'], [/terrain/i, 'pin'], [/interne/i, 'lock'], [/agenda/i, 'cal']];
function natIco(n) { for (var i = 0; i < NAT.length; i++) if (NAT[i][0].test(n)) return NAT[i][1]; return 'doc'; }
/* sur la carte et le volet, la nature sans son « (fictif) » : la même ligne porte déjà « Source fictive · Exemple fictif » (la nature complète reste dans la clé-valeur du volet) */
function natHtml(x) { return '<span class="dy-nat">' + J.ico(natIco(x.nature)) + esc(x.nature.replace(/\s*\((fictif|fictive)\)\s*$/i, '')) + '</span>'; }
/* ---------- dates : le jour de la maquette est G.aujourdhui, jamais la date de la machine ---------- */
var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function ecart(d) { return Math.round((Date.parse(d) - Date.parse(AUJ)) / 864e5); }
function relatif(d) { var n = -ecart(d); return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : 'il y a ' + n + ' jours'; }
function dans(d) { var n = ecart(d); return n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : 'dans ' + n + ' jours'; }
function jourMois(d) { var p = d.split('-'); return (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
function dateHtml(x) { return '<span class="dy-date">' + esc(x.dateTexte) + ' <span class="dy-rel">· ' + relatif(x.date) + '</span></span>'; }
function lectureTxt(s) { return s >= 60 ? Math.round(s / 60) + '\u00a0min' : s + '\u00a0s'; }
function minutesTxt(s) { return Math.max(1, Math.round(s / 60)) + '\u00a0min'; }
/* typographie française sur les textes des données : espace insécable avant « : ; ! ? » et à l'intérieur des guillemets (jamais un deux-points en début de ligne) */
function ty(t) { return esc(t).replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0'); }
/* ---------- l'édition choisie : profil × secteur (deux profils, deux secteurs, lus dans les données) ---------- */
function cleEd() { return E.profil + '-' + E.secteur; }
function dansEdition(x) { return x.editions.profils.indexOf(E.profil) >= 0 && x.editions.secteurs.indexOf(E.secteur) >= 0; }
function edition() { return INF.filter(dansEdition); }
function nomGrp(id) { var g = (G.gps.groupements || []).filter(function (x) { return x.id === id; })[0]; return g ? g.nom : id; }
function texteDe(x) { return [x.titre, x.resume, x.pourquoi, x.accroche, x.source, x.nature, rubNom(x.rubrique), (x.concernes.groupements || []).map(nomGrp).join(' ')].join(' ').toLowerCase(); }
function visibles() { var q = E.q.trim().toLowerCase(); return edition().filter(function (x) { return (!E.rub || x.rubrique === E.rub) && (!q || texteDe(x).indexOf(q) >= 0); }); }
function compte(r) { return edition().filter(function (x) { return !r || x.rubrique === r; }).length; }
function secondes(L) { return L.reduce(function (s, x) { return s + (x.lectureSecondes || 0); }, 0); }
function resume() { return (R60[cleEd()] || []).map(function (r) { return { id: r.id, phrase: r.phrase, secondes: r.secondes, info: BY[r.id] }; }).filter(function (r) { return r.info; }); }
function nomEd() { return profilDe(E.profil).nom + ' · ' + secteurDe(E.secteur).nom; }
function rubsPleines() { return RUBS.filter(function (r) { return compte(r.id); }).length; }   // « dans N rubriques » : celles qui ont au moins une information dans l'édition
/* l'article ouvert reste ouvert quand l'édition change : s'il n'en fait pas partie, le volet le dit (« Hors de votre édition ») */
function choisirEdition(profil, secteur) { if (profil) E.profil = profil; if (secteur) E.secteur = secteur; E.edition = cleEd(); ecrireLocal(CLE_ED, { profil: E.profil, secteur: E.secteur }); arreter(false); if (E.rub && !compte(E.rub)) E.rub = ''; }
/* si un autre écran a posé S.infos.edition (une clé « profil-secteur » valide), le DAILY la suit */
function suivreEdition() { if (E.edition === cleEd()) return; EDS.profils.forEach(function (p) { EDS.secteurs.forEach(function (s) { if (p.id + '-' + s.id === E.edition) { E.profil = p.id; E.secteur = s.id; } }); }); E.edition = cleEd(); }
/* l'ordre exact de la page : par rubrique, l'article de tête (celui qui concerne le plus d'officines) puis les brèves ; « À surveiller » par échéance */
function nbOff(x) { var c = x.concernes; return c.nbOfficines || (c.officines || []).length; }
function parEcheance(a, b) { return (a.echeance || '9999-12-31').localeCompare(b.echeance || '9999-12-31'); }
function sections() {
  var L = visibles();
  return RUBS.map(function (r) { var I = L.filter(function (x) { return x.rubrique === r.id; }); if (!I.length) return null;
    if (r.id === 'surveiller') return { r: r, ag: I.slice().sort(parEcheance) };
    var t = I.reduce(function (m, x) { return nbOff(x) > nbOff(m) ? x : m; }, I[0]);
    return { r: r, tete: t, breves: I.filter(function (x) { return x !== t; }) }; }).filter(Boolean);
}
function ordrePage() { return sections().reduce(function (o, s) { return o.concat(s.ag || [s.tete].concat(s.breves)); }, []); }
/* ---------- officines et groupements concernés : les noms viennent des points de la carte (mêmes id) ; les liens croisés ---------- */
function pt(id) { return J.pointById(id); }
function nomPt(id) { var p = pt(id); return p ? J.joli(p.nom) : id; }
function villePt(id) { var p = pt(id); return p ? p.ville : ''; }
/* une officine citée ouvre la carte GPS de l'accueil centrée sur elle, sa fiche latérale ouverte (J.gpsOuvrir, exposé par l'accueil) ; repli : l'ancienne carte */
function gpsPret() { return typeof J.gpsOuvrir === 'function' || !!(J.gps && typeof J.gps.centrer === 'function'); }
function versCarte(id) { if (typeof J.gpsOuvrir === 'function' && G.officines[id]) { J.gpsOuvrir(id); return; } if (J.gps && typeof J.gps.centrer === 'function') { J.gps.centrer(id); return; } if (S.carte) S.carte.volet = id; J.aller('carte-fiche'); }
function versOfficine(id) { if (!gpsPret() && J.offById(id) && J.ouvrirFiche) J.ouvrirFiche(id); else versCarte(id); }
function versGroupement(id) { S.groupements = S.groupements || { tri: 'activite', q: '', sel: '' }; S.groupements.sel = nomGrp(id); J.aller('groupements-detail'); }
function grpChips(x, max) { var L = x.concernes.groupements || [], n = max || L.length, out = L.slice(0, n).map(function (g) { return '<button type="button" class="dy-grp" data-grp="' + esc(g) + '">' + esc(nomGrp(g)) + '</button>'; }).join(''); if (L.length > n) out += '<span class="dy-grp-plus">+ ' + (L.length - n) + '</span>'; return out; }
/* ---------- Ma bibliothèque commerciale : localStorage dans un try/catch, repli en mémoire de la séance ---------- */
function bib() { if (!E.bib) { var v = lireLocal(CLE); E.bib = Array.isArray(v) ? v.filter(function (b) { return b && BY[b.id]; }) : []; } return E.bib; }
function enBib(id) { return bib().some(function (b) { return b.id === id; }); }
function basculerBib(id) { var L = bib(), i = L.map(function (b) { return b.id; }).indexOf(id), garde; if (i >= 0) L.splice(i, 1); else L.unshift({ id: id, le: new Date().toISOString() }); garde = ecrireLocal(CLE, L);
  J.toast(i >= 0 ? 'Retiré de votre bibliothèque commerciale.' : garde ? 'Enregistré : vous retrouverez cet article dans Ma bibliothèque commerciale, demain aussi.' : 'Enregistré pour cette séance seulement : ce navigateur refuse de garder la bibliothèque d’un jour à l’autre.'); }
function leTxt(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return 'enregistré le ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' à ' + d.getHours() + ' h ' + ('0' + d.getMinutes()).slice(-2); }
/* ---------- le brief audio : synthèse vocale du navigateur (locale, gratuite), fr-FR ; un jeton coupe les enchaînements d'une lecture annulée ---------- */
var SYN = window.speechSynthesis, UTT = window.SpeechSynthesisUtterance, AUDIO_OK = !!(SYN && UTT && typeof SYN.speak === 'function');
var LEC = { actif: false, mode: '', ids: [], id: null, s: 0, jeton: 0, utts: [] }, VOIX = null;
/* une voix française de France, installée sur la machine de préférence (sinon fr-FR, sinon une autre voix française) */
function voixFr() { if (VOIX) return VOIX; try { var vs = SYN.getVoices ? SYN.getVoices() : [], f = function (t) { for (var i = 0; i < vs.length; i++) if (t(vs[i])) return vs[i]; return null; };
  VOIX = f(function (v) { return /^fr[-_]FR$/i.test(v.lang) && v.localService; }) || f(function (v) { return /^fr[-_]FR$/i.test(v.lang); }) || f(function (v) { return /^fr/i.test(v.lang); }); } catch (e) {} return VOIX; }
function texteArticle(x) { return x.titre + '. ' + x.resume + ' Pourquoi c’est important pour vous : ' + x.pourquoi; }
function lire(ids, mode) {
  if (!AUDIO_OK) { J.toast(AUD.indisponible); return; }
  var occupe = LEC.actif || !!(SYN.speaking || SYN.pending);   // Safari : un speak() juste après cancel() peut rester muet, d'où un court délai dans ce cas
  arreter(false);
  var jeton = ++LEC.jeton, seq = []; LEC.utts = [];   // les phrases en cours restent référencées jusqu'à leur fin (sinon le navigateur peut les ramasser avant onend)
  if (mode === 'resume') { seq.push({ id: null, txt: AUD.intro, s: 0 }); resume().forEach(function (r) { seq.push({ id: r.id, txt: r.phrase, s: r.secondes }); }); }
  else ids.forEach(function (id) { var x = BY[id]; if (x) seq.push({ id: id, txt: texteArticle(x), s: x.lectureSecondes }); });
  if (!seq.length) return;
  LEC.actif = true; LEC.mode = mode; LEC.ids = ids.slice(); LEC.id = null; LEC.s = 0;
  var dire = function (k) {
    if (jeton !== LEC.jeton) return;
    if (k >= seq.length) { arreter(); return; }
    var it = seq[k], u = new UTT(it.txt), v = voixFr(); u.lang = AUD.langue; u.rate = 1; if (v) u.voice = v; LEC.utts.push(u);
    u.onstart = function () { if (jeton !== LEC.jeton) return; LEC.id = it.id; LEC.s = it.s; majLecture(); };
    u.onend = function () { if (jeton === LEC.jeton) dire(k + 1); };
    u.onerror = function () { if (jeton === LEC.jeton) dire(k + 1); };
    try { SYN.speak(u); } catch (e) { arreter(); J.toast(AUD.indisponible); }
  };
  majLecture(); if (occupe) setTimeout(function () { dire(0); }, 80); else dire(0);
}
function arreter(maj) { LEC.jeton++; LEC.actif = false; LEC.id = null; LEC.s = 0; LEC.mode = ''; LEC.ids = []; if (AUDIO_OK) { try { SYN.cancel(); } catch (e) {} } if (maj !== false) majLecture(); }
function etiq(b, txt) { var t = $('.dy-bt', b); if (t) t.textContent = txt; else if (b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = txt; }
function majLecture() {
  var on = LEC.actif, R = resume(), idx = -1; R.forEach(function (r, i) { if (r.id === LEC.id) idx = i; });
  $$('[data-ecouter-resume]').forEach(function (b) { var a = on && LEC.mode === 'resume'; b.setAttribute('aria-pressed', String(a)); etiq(b, a ? 'Arrêter' : (b.getAttribute('data-long') || 'Écouter')); var i = $('.ico', b); if (i) i.innerHTML = J.icoSvg(a ? 'close' : 'son'); });
  $$('[data-ecouter]').forEach(function (b) { var a = on && LEC.mode === 'article' && LEC.ids.indexOf(b.getAttribute('data-ecouter')) >= 0; b.setAttribute('aria-pressed', String(a)); etiq(b, a ? 'Arrêter' : 'Écouter'); var i = $('.ico', b); if (i) i.innerHTML = J.icoSvg(a ? 'close' : 'son'); });
  $$('.dy-r60 li').forEach(function (li) { li.classList.toggle('lit', on && LEC.mode === 'resume' && li.getAttribute('data-id') === LEC.id); });
  $$('.dy-frise span').forEach(function (seg, i) { seg.classList.remove('fait', 'lit'); seg.style.transition = 'transform 0s'; if (!on || LEC.mode !== 'resume') return; if (i < idx) { seg.style.transition = 'transform .25s'; seg.classList.add('fait'); } else if (i === idx) { seg.style.transition = 'transform ' + (LEC.s || 1) + 's linear'; seg.classList.add('lit'); } });
  var st = $('#dy-r60-etat'); if (st) st.textContent = !on ? (AUDIO_OK ? AUD.consigne : AUD.indisponible) : LEC.mode === 'resume' ? (LEC.id ? 'Lecture en cours : information ' + (idx + 1) + '.' : 'Lecture en cours : l’introduction.') : 'Lecture de l’article en cours.';
}
window.addEventListener('hashchange', function () { if (!/^#infos/.test(location.hash)) { E.vu = false; if (LEC.actif) arreter(false); } });   // en quittant le DAILY : la lecture s'arrête, l'entrée animée rejouera au retour
/* ---------- le bandeau : jour et heure d'édition, phrase-réponse (édition, nombre, rubriques, minutes), gestes, champ, sélecteur d'édition ---------- */
function segEd(cle, liste, actif, lbl) { return '<div class="dy-sel"><span class="lbl">' + lbl + '</span><div class="seg" role="group" aria-label="' + lbl + ' de l’édition">' + liste.map(function (o) { return '<button type="button" data-ed-' + cle + '="' + esc(o.id) + '" aria-pressed="' + (o.id === actif) + '" title="' + esc(o.description || o.detail || '') + '">' + esc(o.nom) + '</button>'; }).join('') + '</div></div>'; }
/* Au téléphone, le bandeau se resserre pour que la une arrive vite : l'édition tient sur une ligne « Votre édition … · Changer » qui déplie les deux
   segments et la description du profil ; « Ma bibliothèque » passe sous la une. « Écouter » n'existe qu'une fois : dans la une. */
function bandeau() {
  var L = edition(), p = profilDe(E.profil), s = secteurDe(E.secteur), nb = bib().length, nr = rubsPleines();
  return J.bandeau({ croix: true, classe: 'dy-ban', eyebrow: esc(ED.jour) + ' · <span class="dy-ey-l">édition de </span>' + esc(ED.heure).replace(/ /g, '\u00a0') + ' · ' + esc(G.mention), titre: esc(ED.titre),
    lede: '<span class="dy-ph">' + esc(ED.sousTitre) + '<span class="dy-ph-ed">. Votre édition <b>' + esc(nomEd()) + '</b></span> : <b>' + nf.format(L.length) + '\u00a0information' + (L.length > 1 ? 's' : '') + '</b> dans <b>' + nf.format(nr) + '\u00a0rubrique' + (nr > 1 ? 's' : '') + '</b>, <b>' + minutesTxt(secondes(L)) + '</b> pour tout lire.</span>',
    actions: '<button type="button" class="pil" data-vers="dy-bib">' + J.ico('star') + 'Ma bibliothèque' + (nb ? ' <span class="cpt7">' + nf.format(nb) + '</span>' : '') + '</button>',
    recherche: { id: 'dy-q', placeholder: 'Groupement, produit, échéance', aria: 'Filtrer les informations du jour', valeur: E.q },
    bas: '<div class="dy-eds' + (E.edsOuvert ? ' deplie' : '') + '"><button type="button" class="dy-eds-b" data-eds aria-expanded="' + !!E.edsOuvert + '" aria-controls="dy-eds-p"><span class="dy-eds-t"><span class="dy-eds-l">Votre édition</span><b>' + esc(nomEd()) + '</b></span><span class="dy-eds-c"><span class="dy-bt">' + (E.edsOuvert ? 'Fermer' : 'Changer') + '</span>' + J.ico('chevb') + '</span></button>' +
      '<div class="dy-eds-p" id="dy-eds-p">' + segEd('profil', EDS.profils, E.profil, 'Profil') + segEd('secteur', EDS.secteurs, E.secteur, 'Secteur') + '<p class="dy-ed">' + esc(p.description.replace(/[.\s]+$/, '')) + ' · ' + esc(s.detail) + '.</p></div></div>' });
}
/* ---------- la une : « Le résumé en 60 secondes » — cinq informations, frise des durées, brief audio ---------- */
function uneHtml() {
  var R = resume(), tot = R.reduce(function (s, r) { return s + r.secondes; }, 0), dis = AUDIO_OK ? '' : ' aria-disabled="true"';
  return '<section class="carte dy-une" style="--i:0" aria-label="Le résumé en ' + tot + ' secondes"><div class="tete"><div><p class="dy-eyebrow">La une</p><h2>Le résumé en ' + tot + '\u00a0secondes</h2><p class="st">l’essentiel de votre édition, à lire ou à écouter · chaque ligne ouvre l’information</p></div>' +
    '<button type="button" class="pil plein dy-une-b" data-ecouter-resume' + dis + '>' + J.ico('son') + '<span class="dy-bt">Écouter</span></button></div>' +
    '<ol class="dy-r60">' + R.map(function (r, i) { return '<li data-id="' + r.id + '"><button type="button" class="dy-r60-b" data-ouvrir="' + r.id + '" aria-label="Ouvrir : ' + esc(r.info.titre) + '"><span class="dy-r60-n num">' + (i + 1) + '</span><span class="dy-r60-c"><span class="dy-r60-r">' + rubIco(r.info.rubrique) + esc(rubNom(r.info.rubrique)) + '</span><span class="dy-r60-p">' + ty(r.phrase) + '</span></span><span class="dy-r60-s num">' + r.secondes + '\u00a0s</span>' + J.ico('chev') + '</button></li>'; }).join('') + '</ol>' +
    '<div class="dy-frise" aria-hidden="true">' + R.map(function (r) { return '<span style="flex:' + r.secondes + '"><i></i></span>'; }).join('') + '</div>' +
    '<p class="note dy-r60-etat" id="dy-r60-etat">' + esc(AUDIO_OK ? AUD.consigne : AUD.indisponible) + '</p></section>';
}
/* ---------- Ma bibliothèque commerciale : les articles enregistrés, « Rouvrir » (la ligne) et « Retirer » ; vide, une seule ligne discrète sous la une ---------- */
function bibHtml() {
  var L = bib();
  if (!L.length) return '<p class="dy-bib-vide" id="dy-bib" style="--i:1">' + J.ico('star') + '<span><b>' + esc(BIB.titre) + '</b> · ' + esc(BIB.vide) + '</span></p>';
  return '<section class="carte dy-bib" id="dy-bib" style="--i:1" aria-label="' + esc(BIB.titre) + '"><div class="tete"><div><p class="dy-eyebrow">À retrouver plus tard</p><h2>' + esc(BIB.titre) + '</h2><p class="st">les articles que vous enregistrez, gardés dans ce navigateur d’un jour à l’autre</p></div></div>' +
    (L.length ? '<ul class="dy-bib-l">' + L.map(function (b) { var x = BY[b.id]; return '<li><button type="button" class="dy-bib-b" data-ouvrir="' + x.id + '">' + rubIco(x.rubrique) + '<span class="dy-bib-c"><span class="dy-bib-t">' + esc(x.titre) + '</span><span class="sub">' + esc(rubNom(x.rubrique)) + ' · ' + esc(leTxt(b.le)) + '</span></span>' + J.ico('chev') + '</button><button type="button" class="b-rond dy-bib-x" data-bib="' + x.id + '" aria-label="Retirer de la bibliothèque : ' + esc(x.titre) + '">' + J.ico('close') + '</button></li>'; }).join('') + '</ul>'
      : '<p class="dy-vide">' + esc(BIB.vide) + '</p>') + '</section>';
}
/* ---------- la barre des rubriques : « Tout » + les 8 libellés du concept, avec le nombre d'informations de l'édition (seule place de ces comptes) ---------- */
function rubsHtml() {
  return '<nav class="dy-rubs" aria-label="Rubriques du brief"><button type="button" class="dy-rb" data-rub="" aria-pressed="' + !E.rub + '">' + J.ico('layers') + 'Tout</button>' +
    RUBS.map(function (r) { var n = compte(r.id); return '<button type="button" class="dy-rb" data-rub="' + r.id + '" aria-pressed="' + (E.rub === r.id) + '"' + (n ? '' : ' disabled title="Aucune information de cette rubrique dans votre édition"') + '>' + rubIco(r.id) + esc(r.nom) + (n ? '<span class="n num">' + n + '</span>' : '') + '</button>'; }).join('') + '</nav>';
}
/* ---------- une information. Article de tête (celui qui concerne le plus d'officines de sa rubrique) : nature + date, titre, résumé, « Pourquoi c'est
   important pour moi », « L'impact sur mon secteur » au grand chiffre, Enregistrer et Écouter, source. Brève : nature + date, titre, « Pourquoi c'est
   important : » (la phrase de la rubrique), le nombre d'officines concernées, Enregistrer, source. Le résumé des brèves, la liste des officines, les groupements,
   l'écoute d'une brève et la carte vivent dans le volet (#infos-detail), ouvert par le titre ou par le nombre d'officines. ---------- */
var OUV = null;   // l'article ouvert dans le volet : sur sa carte du journal, ses chiffres s'effacent (aucun chiffre écrit deux fois à l'écran)
function ouv(x) { return OUV === x.id ? ' ouverte' : ''; }
function pourquoiHtml(x) { return '<div class="dy-pq"><span class="dy-pq-l">' + J.ico('bulb') + 'Pourquoi c’est important pour moi</span><p>' + ty(x.pourquoi) + '</p></div>'; }
function nOffTxt(n) { return '<b class="num">' + nf.format(n) + '</b> officine' + (n > 1 ? 's' : '') + ' de votre portefeuille'; }
function impactHtml(x) { var n = nbOff(x); if (!n) return ''; return '<div class="dy-imp"><span class="dy-imp-l">' + J.ico('pin') + 'L’impact sur mon secteur</span><button type="button" class="dy-imp-n" data-ouvrir="' + x.id + '" aria-label="Voir les officines concernées : ' + esc(x.titre) + '">' + nOffTxt(n) + J.ico('chev') + '</button></div>'; }
function offBtn(x) { var n = nbOff(x); return n ? '<button type="button" class="dy-imp-n dy-imp-c" data-ouvrir="' + x.id + '" aria-label="Voir les officines concernées : ' + esc(x.titre) + '">' + J.ico('pin') + '<span><b class="num">' + nf.format(n) + '</b> de vos officines</span></button>' : ''; }
function bibBtn(x) { var b = enBib(x.id); return '<button type="button" class="dy-b' + (b ? ' on' : '') + '" data-bib="' + x.id + '" aria-pressed="' + b + '">' + J.ico(b ? 'check' : 'star') + '<span class="dy-bt">' + (b ? 'Enregistré' : 'Enregistrer') + '</span></button>'; }
function srcHtml(x) { return '<p class="dy-a-src">' + lectureTxt(x.lectureSecondes) + ' de lecture</p>'; }   /* « données fictives » est dit une fois, en pied de page */
function teteHtml(x, cl) { return '<div class="dy-a-h">' + natHtml(x) + dateHtml(x) + '</div><h3 class="dy-a-t' + (cl || '') + '"><button type="button" data-ouvrir="' + x.id + '">' + ty(x.titre) + '</button></h3>'; }
function breveCorps(x) { return teteHtml(x, ' dy-brv-t') +'<p class="dy-brv-pq"><b>Pourquoi c’est important\u00a0:</b> ' + ty(x.pourquoi) + '</p><div class="dy-brv-b">' + offBtn(x) + bibBtn(x) + '</div>' + srcHtml(x); }
function carteTete(x, i) {
  return '<article class="carte dy-art dy-tete' + ouv(x) + '" data-id="' + x.id + '" style="--i:' + i + '">' + teteHtml(x) + '<p class="dy-a-r">' + ty(x.resume) + '</p>' + pourquoiHtml(x) + impactHtml(x) +
    '<div class="dy-a-act">' + bibBtn(x) + '<button type="button" class="dy-b" data-ecouter="' + x.id + '"' + (AUDIO_OK ? '' : ' aria-disabled="true"') + '>' + J.ico('son') + '<span class="dy-bt">Écouter</span></button></div>' + srcHtml(x) + '</article>';
}
function breveHtml(x) { return '<li class="dy-brv' + ouv(x) + '" data-id="' + x.id + '">' + breveCorps(x) + '</li>'; }
function agHtml(x) {
  var e = x.echeance, n = e ? ecart(e) : null;
  return '<li class="dy-ag' + ouv(x) + '" data-id="' + x.id + '"><div class="dy-ag-d" role="img" aria-label="' + (e ? 'Échéance le ' + jourMois(e) + ', ' + dans(e) : 'Sans échéance') + '">' + (n == null ? '' : n <= 0 ? '<b>ce jour</b>' : '<span>dans</span><b class="num">' + n + '</b><span>jour' + (n > 1 ? 's' : '') + '</span>') + '</div><div class="dy-ag-c">' + breveCorps(x) + '</div></li>';
}
/* ---------- le journal : une section par rubrique (libellé et phrase du concept) ; l'article de tête à gauche, les brèves à droite ; « À surveiller » en agenda chronologique ---------- */
function journal(anim) {
  var SE = sections(), q = E.q.trim(), k = 0, ent = anim ? ' entre' : '';
  if (!SE.length) return '<section class="carte dy-vide-c"><p class="dy-vide">Aucune information' + (q ? ' pour « ' + esc(q) + ' »' : '') + (E.rub ? ' dans la rubrique ' + esc(rubNom(E.rub)) : '') + ' de votre édition.</p></section>';
  // au téléphone (une seule colonne), les brèves d'une rubrique attendent derrière « Voir les N autres informations » ; une rubrique filtrée ou une recherche les montre
  return SE.map(function (s) { var r = s.r, i = Math.min(k++, 8), nb = s.breves ? s.breves.length : 0, plie = !E.rub && !q && !E.depl[r.id];
    var corps = s.ag ? '<div class="dy-rubg seul' + ent + '"><div class="carte dy-liste" style="--i:' + i + '"><ul class="dy-agenda">' + s.ag.map(agHtml).join('') + '</ul></div></div>'
      : '<div class="dy-rubg' + (nb ? '' : ' seul') + ent + '">' + carteTete(s.tete, i) + (nb ? '<div class="dy-brv-w" style="--i:' + (i + 1) + '"><div class="carte dy-liste' + (plie ? ' replie' : '') + '"><ul class="dy-breves">' + s.breves.map(breveHtml).join('') + '</ul></div>' +
        '<button type="button" class="pil dy-voir" data-voir="' + r.id + '" aria-label="' + esc(r.nom) + ' : voir ' + (nb > 1 ? 'les ' + nb + ' autres informations' : 'l’autre information') + '">' + J.ico('chevb') + (nb > 1 ? 'Voir les ' + nb + ' autres informations' : 'Voir l’autre information') + '</button></div>' : '') + '</div>';
    return '<section class="dy-rub" id="dy-' + r.id + '" aria-label="' + esc(r.nom) + '"><div class="dy-rub-h"><span class="dy-rub-i">' + rubIco(r.id) + '</span><div><h2>' + esc(r.nom) + '</h2><p class="st">' + esc(r.contenu) + '</p></div></div>' + corps + '</section>'; }).join('');
}
function pied() {
  return '<footer class="dy-pied"><p class="note">' + esc(ED.avertissement) + '</p>' + (MATINS.length ? '<div class="dy-avant"><span class="lib">Les éditions d’avant · non dessinées dans cette maquette</span><div class="chips">' + MATINS.map(function (m) { return '<button type="button" class="chip" data-stub="' + esc(STUB('Rouvrir l’édition du ' + m.date)) + '">' + J.ico('cal') + esc(m.date) + '</button>'; }).join('') + '</div></div>' : '') +
    '<p class="note">Sélection composée pour votre profil et votre secteur, jamais un flux générique · chaque information est datée et sourcée · les comptes et les minutes sont calculés sur l’édition affichée.</p></footer>';
}
/* ---------- le volet (#infos-detail) : rubrique, nature, date, titre, résumé, pourquoi, L'impact sur mon secteur en entier, clé-valeur, boutons ronds ---------- */
function ligneOff(id) { var o = G.officines[id]; return '<li><button type="button" class="dy-off" data-off="' + id + '">' + J.ico(gpsPret() || !J.offById(id) ? 'pin' : 'pharma') + '<span class="dy-off-c"><span class="dy-off-n">' + esc(nomPt(id)) + '</span><span class="sub">' + esc(villePt(id)) + (o ? ' · ' + (o.categorie === 'client' ? 'cliente' : 'prospect') + (o.groupementId ? ' · ' + esc(nomGrp(o.groupementId)) : '') : '') + '</span></span>' + J.ico('chev') + '</button></li>'; }
function voletHtml(x) {
  var c = x.concernes, offs = c.officines || [], n = c.nbOfficines || offs.length, b = enBib(x.id), tete = offs.slice(0, 6), reste = offs.slice(6);
  var kv = [['Source', esc(x.source)], ['Nature', esc(x.nature)], ['Date', esc(x.dateTexte) + ' · ' + relatif(x.date)], ['Échéance', x.echeance ? jourMois(x.echeance) + ' · ' + dans(x.echeance) : ''],
    ['Éditions', x.editions.profils.map(function (p) { var o = profilDe(p); return esc(o ? o.nom : p); }).join(', ') + '<span class="sub">' + x.editions.secteurs.map(function (s) { var o = secteurDe(s); return esc(o ? o.nom : s); }).join(' · ') + '</span>'], ['Lecture', lectureTxt(x.lectureSecondes)], ['Mention', esc(x.mention)]];
  return '<div class="dy-voile" data-fermer></div><aside class="dy-volet" data-interne role="dialog" aria-label="Article du DAILY" tabindex="-1" id="dy-volet">' +
    '<div class="dy-v-h"><button type="button" class="pil" data-fermer>' + J.ico('back') + 'Retour au brief</button><div class="dy-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Article précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Article suivant">' + J.ico('chev') + '</button></div></div>' +
    '<p class="dy-v-ey">' + rubHtml(x.rubrique) + natHtml(x) + dateHtml(x) + '</p>' + (dansEdition(x) ? '' : '<p class="dy-v-hors">' + J.ico('infos') + '<span>Hors de votre édition ' + esc(nomEd()) + ' : cette information vient d’une autre édition du jour.</span></p>') +
    '<h2 class="dy-v-t">' + ty(x.titre) + '</h2><p class="dy-v-r">' + ty(x.resume) + '</p>' + pourquoiHtml(x) +
    (n ? '<section class="dy-v-imp" aria-label="L’impact sur mon secteur"><h3>' + J.ico('pin') + 'L’impact sur mon secteur</h3><p class="dy-v-n"><b class="num">' + nf.format(n) + '</b> officine' + (n > 1 ? 's' : '') + ' de votre portefeuille</p><p class="st">' + ty(c.critere) + '</p>' +
      (typeof J.gpsInfo === 'function' ? '<p class="dy-v-carte"><button type="button" class="pil" data-carte="' + x.id + '">' + J.ico('pin') + 'Les voir sur la carte JARVIS GPS</button></p>' : '') +
      (c.groupements && c.groupements.length ? '<p class="dy-v-gl">Groupements représentés parmi ces officines · la page de chacun</p><div class="dy-v-g">' + grpChips(x) + '</div>' : '') +
      '<p class="dy-v-gl">' + (gpsPret() ? 'Chaque officine s’ouvre sur la carte GPS, centrée sur elle, sa fiche à côté.' : 'Chaque officine ouvre sa fiche, ou la carte.') + '</p><ul class="dy-offs">' + tete.map(ligneOff).join('') + '</ul>' +
      (reste.length ? '<details class="tabm dy-plus"><summary>' + J.ico('chevb') + 'Voir toutes les officines concernées</summary><ul class="dy-offs">' + reste.map(ligneOff).join('') + '</ul></details>' : '') + '</section>' : '') +
    J.kv(kv, 'serree') + '<div class="dy-v-act">' + J.rond(b ? 'check' : 'star', b ? 'Enregistré' : 'Enregistrer', null, b ? 1 : 0, ' data-bib="' + x.id + '"') + J.rond('son', 'Écouter', AUDIO_OK ? null : AUD.indisponible, 0, ' data-ecouter="' + x.id + '"') +
    J.rond('copy', 'Copier', null, 0, ' data-copier') + J.rond('tasks', 'Créer une tâche', null, 0, ' data-tache') + '</div></aside>';
}
function copier(txt, msg) { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { J.toast(msg); }, function () { J.toast('Copie refusée par le navigateur.'); }); else J.toast('Copie indisponible dans ce navigateur.'); }
function ouvrir(id) { if (!BY[id]) return; E.ouverte = id; E.y = window.scrollY; J.aller('infos-detail'); }
function fermer() { E.y = window.scrollY; J.aller('infos'); }
function relancer() { E.y = window.scrollY; J.route(); }
function defiler(id) { var c = $('#' + id); if (c) c.scrollIntoView({ behavior: J.RM ? 'auto' : 'smooth', block: 'start' }); }
/* ---------- mises à jour sur place (sans redessiner l'écran) : état « Enregistré » partout, carte de la bibliothèque, pastille du bandeau ---------- */
function majBib(el) {
  var nb = bib().length;
  $$('[data-bib]', el).forEach(function (b) { if (b.classList.contains('dy-bib-x')) return; var on = enBib(b.getAttribute('data-bib')), ico = $('.ico', b); b.setAttribute('aria-pressed', String(on)); b.classList.toggle(b.classList.contains('rond-act') ? 'plein' : 'on', on); if (ico) ico.innerHTML = J.icoSvg(on ? 'check' : 'star'); etiq(b, on ? 'Enregistré' : 'Enregistrer'); });
  var carte = $('#dy-bib', el); if (carte) { carte.insertAdjacentHTML('afterend', bibHtml()); carte.remove(); }
  var haut = $('.dy-haut', el); if (haut) haut.classList.toggle('sans-bib', !nb);   // vide : la une prend toute la largeur, la bibliothèque tient en une ligne
  var pil = $('[data-vers="dy-bib"]', el); if (pil) { var c = $('.cpt7', pil); if (nb) { if (!c) { pil.insertAdjacentHTML('beforeend', ' <span class="cpt7"></span>'); c = $('.cpt7', pil); } c.textContent = nf.format(nb); } else if (c) c.remove(); }
  J.poseIcones(el);
}
function rafraichir(el) { var c = $('#dy-corps', el); if (c) { c.innerHTML = rubsHtml() + journal(false); J.poseIcones(el); ajusterRubs(el); } majLecture(); }
/* la barre des rubriques tient sur une rangée collante ; si elle ne tient pas (fenêtre étroite, volet ouvert), elle passe à la ligne et cesse d'être collante */
function ajusterRubs(el) { var n = $('.dy-rubs', el); if (!n) return; n.classList.remove('plie'); if (window.innerWidth > 760 && n.scrollWidth > n.clientWidth + 2) n.classList.add('plie'); }
window.addEventListener('resize', function () { if (J.courant && J.courant.ecran === 'infos') { var el = $('[data-ecran="infos"]'); if (el) ajusterRubs(el); } });
/* ---------- un seul écouteur de clic sur le conteneur (il survit aux redessins) ---------- */
function lier(el) {
  if (el.dyLie) return; el.dyLie = true;
  el.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target : null; if (!t || t.closest('[data-stub]')) return;
    var b = t.closest('[data-ouvrir],[data-bib],[data-ecouter-resume],[data-ecouter],[data-eds],[data-voir],[data-off],[data-carte],[data-grp],[data-rub],[data-ed-profil],[data-ed-secteur],[data-vers],[data-fermer],[data-pn],[data-copier],[data-tache]'); if (!b || !el.contains(b)) return;
    var v = function (a) { return b.getAttribute(a); };
    if (b.hasAttribute('data-ouvrir')) { ev.preventDefault(); ouvrir(v('data-ouvrir')); return; }
    if (b.hasAttribute('data-bib')) { basculerBib(v('data-bib')); majBib(el); return; }
    if (b.hasAttribute('data-ecouter-resume')) { if (LEC.actif && LEC.mode === 'resume') arreter(); else lire([], 'resume'); return; }
    if (b.hasAttribute('data-ecouter')) { var id = v('data-ecouter'); if (LEC.actif && LEC.mode === 'article' && LEC.ids.indexOf(id) >= 0) arreter(); else lire([id], 'article'); return; }
    if (b.hasAttribute('data-voir')) { E.depl[v('data-voir')] = true; var w = b.closest('.dy-brv-w'), li = w && $('.dy-liste', w); if (li) { li.classList.remove('replie'); var f = $('.dy-brv button[data-ouvrir]', li); if (f) f.focus({ preventScroll: true }); } return; }
    if (b.hasAttribute('data-eds')) { E.edsOuvert = !E.edsOuvert; var bo = b.closest('.dy-eds'); if (bo) bo.classList.toggle('deplie', E.edsOuvert); b.setAttribute('aria-expanded', String(E.edsOuvert)); etiq(b, E.edsOuvert ? 'Fermer' : 'Changer'); return; }
    if (b.hasAttribute('data-off')) { versOfficine(v('data-off')); return; }
    if (b.hasAttribute('data-carte')) { arreter(false); if (typeof J.gpsInfo === 'function') J.gpsInfo(v('data-carte')); return; }   // toutes les pharmacies concernées allumées sur la carte de l'accueil
    if (b.hasAttribute('data-grp')) { versGroupement(v('data-grp')); return; }
    if (b.hasAttribute('data-rub')) { E.rub = v('data-rub'); rafraichir(el); var co = $('#dy-corps', el); if (co && co.getBoundingClientRect().top < 0) defiler('dy-corps'); return; }   // filtré loin dans la page : on remonte au début du journal
    if (b.hasAttribute('data-ed-profil')) { choisirEdition(v('data-ed-profil'), null); relancer(); return; }
    if (b.hasAttribute('data-ed-secteur')) { choisirEdition(null, v('data-ed-secteur')); relancer(); return; }
    if (b.hasAttribute('data-vers')) { defiler(v('data-vers')); return; }
    if (b.hasAttribute('data-fermer')) { fermer(); return; }
    if (b.hasAttribute('data-pn')) { var L = ordrePage(), x = BY[E.ouverte], i = L.indexOf(x) + (+v('data-pn')); if (!L.length) return; if (i < 0) i = L.length - 1; if (i >= L.length) i = 0; E.ouverte = L[i].id; E.y = window.scrollY; arreter(false); J.route(); return; }
    if (b.hasAttribute('data-copier')) { var o = BY[E.ouverte]; if (o) copier(o.titre + '\n' + o.resume + '\nPourquoi c’est important pour moi : ' + o.pourquoi + '\n' + o.source + ' · ' + o.nature + ' · ' + o.dateTexte + ' · ' + o.mention, 'Article copié : collez-le dans un mail ou une note.'); return; }
    if (b.hasAttribute('data-tache')) { var a = BY[E.ouverte]; if (!a) return; if (!J.todoModele) { J.toast('La To do list n’est pas chargée.'); return; } J.todoModele.ajouter({ genre: 'libre', officine: null, note: 'JARVIS DAILY · ' + a.titre, echeance: J.todoModele.AUJ }); J.toast('Tâche ajoutée pour aujourd’hui dans votre To do list.'); return; }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && J.courant.ecran === 'infos' && J.courant.suite === 'detail') fermer(); });
}
/* ---------- l'écran ---------- */
J.ecrans.infos = {
  rendre: function (el, etat) {
    if (etat.suite !== E.suiteVue) { E.suiteVue = etat.suite; if (etat.suite && RUBBY[etat.suite]) E.rub = etat.suite; }   // #infos-surveiller… : la page arrive déjà filtrée (l'accueil peut y envoyer)
    suivreEdition();
    // l'article demandé (depuis « Dans l'actualité » de l'accueil, J.daily.aller…) s'ouvre tel quel, même hors de l'édition choisie ; seul un id inconnu retombe sur le premier
    if (etat.suite === 'detail' && !(E.ouverte && BY[E.ouverte])) E.ouverte = (ordrePage()[0] || edition()[0] || INF[0]).id;
    var ouvert = etat.suite === 'detail' ? BY[E.ouverte] : null, anim = !E.vu; E.vu = true; OUV = ouvert ? ouvert.id : null;   // l'entrée animée ne joue qu'à l'arrivée sur le DAILY, pas à chaque volet
    el.innerHTML = '<div class="page dy-page' + (ouvert ? ' ouvert' : '') + '">' + bandeau() +
      '<p class="note vp dy-vp">Vue pharmacien : JARVIS DAILY est réservé à l’interne, il n’est pas affiché. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
      '<div data-interne class="dy-int"><div class="dy-haut' + (bib().length ? '' : ' sans-bib') + (anim ? ' entre' : '') + '">' + uneHtml() + bibHtml() + '</div><div id="dy-corps">' + rubsHtml() + journal(anim) + '</div>' + pied() + '</div>' + (ouvert ? voletHtml(ouvert) : '') + '</div>';
    $$('.ban-tete .lede,.ban-act,.rech-g,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });   // vue pharmacien : le bandeau ne garde que son titre (la phrase-réponse comprise)
    if (E.y != null) { var y = E.y; E.y = null; setTimeout(function () { window.scrollTo(0, y); }, 0); }
    lier(el); ajusterRubs(el);
    var q = $('#dy-q', el); if (q) q.oninput = function () { E.q = q.value; rafraichir(el); };
    majLecture();
    if (ouvert) { var vo = $('#dy-volet', el); if (vo && window.innerWidth <= 1100) vo.focus({ preventScroll: true }); }
  }
};
/* ---------- pour l'accueil GPS et la fiche latérale (« JARVIS DAILY · le résumé en 60 secondes », « Dans l'actualité ») ---------- */
J.daily = { edition: function () { return { profil: profilDe(E.profil), secteur: secteurDe(E.secteur), cle: cleEd(), infos: edition() }; }, total: function () { return edition().length; }, resume60: resume, lire: function () { lire([], 'resume'); }, arreter: arreter, enCours: function () { return LEC.actif; }, info: function (id) { return BY[id] || null; }, rubrique: rubNom,
  aller: function (id) { if (BY[id]) { E.ouverte = id; J.aller('infos-detail'); } else J.aller('infos'); }, pourOfficine: function (id) { var o = G.officines[id]; return ((o && o.dansActualite) || []).map(function (k) { return BY[k]; }).filter(Boolean); } };
J.infosTotal = function () { return edition().length; };
})();
