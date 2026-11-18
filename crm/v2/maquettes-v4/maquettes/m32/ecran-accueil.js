/* L'ACCUEIL = JARVIS GPS.
   Bandeau compact « recherche d'abord » (le champ et le pli JARVIS DAILY tiennent dans sa colonne de droite : résumé en 60 secondes, « Écouter ») · la carte du
   territoire vivant dès le premier écran (moteur J.ca de ecran-carte.js : fond local, 300 points, zoom, survol, clic) : couches (clients actifs, prospects, à rappeler,
   à visiter, opportunité commerciale, groupement choisi), fiche latérale sans quitter la carte (#accueil-fiche) avec « JARVIS vous propose » calculé autour de
   l'officine, Ma tournée (#accueil-tournee, itinéraire calculé localement), opportunités géographiques (#accueil-proximite : position FICTIVE, rayon réglable, les six
   filtres, visite supplémentaire calculée dans le créneau libéré), Liste, impact d'une information du DAILY montré sur la carte.
   Données FICTIVES : DONNEES_GPS (donnees-gps-daily.js), DONNEES_V4.carte, DONNEES. Aucun chiffre écrit deux fois ; aucune ressource externe ; aucune géolocalisation. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, C = J.C, S = J.S;
var G = window.DONNEES_GPS, O = G.officines, GP = G.gps, DY = G.daily, PROP = GP.proposition, FIN = GP.finRendezVous, IT = GP.itineraire, DEPOT = IT.depart;
var MOBILE = function () { return window.innerWidth <= 760; }, ETROIT = function () { return window.innerWidth <= 1100; };
/* Sous-adresses : #accueil-fiche, #accueil-tournee, #accueil-proximite (déclarées dans data-adresses de index.html, séparées par des virgules). */
/* l'état : vue du volet (defaut · fiche · tournee · proximite · liste · resultats · info), d'où vient la fiche, couche, groupement, recherche, tournée du matin,
   visite supplémentaire de l'après-midi, information du DAILY montrée sur la carte, rayon et filtre de proximité, pli du DAILY */
var CLE_D60 = 'jarvis-gps-m33-daily-ouvert';
var K = S.accueil = { vue: 'defaut', depuis: 'defaut', couche: 'tout', coucheAvant: 'tout', grp: GP.groupements[0].id, autres: true, q: '', avant: 'defaut', fiche: null, tour: [], visite: null, info: null,
  rayon: FIN.rayonKm, pf: '', pgrp: '', plgo: '', dOuvert: false, tri: 'priorite', nb: 40, ql: '', garder: null, sig: '', edAff: '', voir: false, centrer: null, zoomProx: false, recolorer: false, infoAdresse: false };
try { K.dOuvert = localStorage.getItem(CLE_D60) === 'oui'; } catch (e) { K.dOuvert = false; }
var I = null, ecoute = false, EXCL = FIN.rendezVousQuitte.officine, NB_AUTRES = 0;
Object.keys(O).forEach(function (id) { if (!O[id].mien) NB_AUTRES++; });
var INFO_BY = {}, RUB_BY = {}; DY.infos.forEach(function (x) { INFO_BY[x.id] = x; }); DY.rubriques.forEach(function (r) { RUB_BY[r.id] = r.nom; });
var GRP_NOM = {}; GP.groupements.forEach(function (g) { GRP_NOM[g.id] = g.nom; });
var ICO_OPP = { offilog: 'box', listing: 'doc', logiciel: 'screen', produit: 'pill', baisse: 'bas', ouverture: 'user', 'premiere-commande': 'spark', biosimilaires: 'pill', reprise: 'infos' };
/* ---------- aides ---------- */
function pt(id) { return J.pointById(id); }
function km(a, b) { var R = 6371, dl = (b.lat - a.lat) * Math.PI / 180, dg = (b.lng - a.lng) * Math.PI / 180, x = Math.sin(dl / 2), y = Math.sin(dg / 2), hh = x * x + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * y * y; return 2 * R * Math.asin(Math.sqrt(hh)); }
function heureMin(s) { var m = String(s).match(/(\d{1,2})\s*(?:h|:)\s*(\d{0,2})/); return m ? (+m[1]) * 60 + (+m[2] || 0) : 0; }   // « 08:00 » comme « 15 h 10 »
function hm(m) { m = Math.round(m); return Math.floor(m / 60) + ' h ' + ('0' + (m % 60)).slice(-2); }
function h(t) { return hm(heureMin(t)); }
function duree(m) { m = Math.round(m); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + ('0' + (m % 60)).slice(-2) : ''); }   // au-delà d'une heure, en heures
function norm(s) { s = String(s == null ? '' : s); try { s = s.normalize('NFD'); } catch (e) {} return s.replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, '\'').replace(/[-‐‑–]/g, ' ').replace(/\s+/g, ' ').toLowerCase(); }   // « frejus » trouve Fréjus, « saint raphael » Saint-Raphaël
function chez(nom, maj) { return /^pharmacie\b/i.test(nom) ? (maj ? 'À la ' : 'à la ') + nom : (maj ? 'Chez ' : 'chez ') + nom; }
function nomDep(code) { return (J.ca && J.ca.nomDep && J.ca.nomDep[code]) || code; }
function etatCle(o) { return o.sousStatut === 'à rappeler' ? 'rappel' : o.sousStatut === 'cliente' ? 'cliente' : o.sousStatut === 'prospect' ? 'prospect' : 'aucune'; }
function statutTexte(o, p) { return o.sousStatut === 'à rappeler' ? 'Cliente à rappeler' : o.sousStatut === 'cliente' ? 'Cliente · ' + esc(p.segment) : o.sousStatut === 'prospect' ? 'Prospect' : 'Compte ouvert, sans vente'; }
function visiteTexte(o) { return o.derniereVisite ? 'vue ' + esc(o.derniereVisiteTexte) : 'jamais visitée'; }
function lienPlans(p, depuis) { return 'maps://?daddr=' + p.lat + ',' + p.lng + (depuis ? '&saddr=' + depuis.lat + ',' + depuis.lng : '') + '&dirflg=d'; }   /* un lien vers Plans : aucune requête réseau de la page */
function pluriel(n, un, des) { return n > 1 ? des : un; }
var MOTS = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'];
function enMots(n) { return MOTS[n] || String(n); }
function maj1(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
var NB_FICHES = C.points.filter(function (p) { return !!(J.offFiche || J.offById)(p.id); }).length;   // officines de la carte qui ont une fiche complète (tout le portefeuille : le relevé, plus les fiches dérivées de app.js)
/* ---------- les couches : les six catégories du concept (noms lus dans gps.legende) + deux couches ouvertes par les nombres du bandeau + l'information du DAILY.
   La couleur ne vit que sur les points. En « Tout voir », la couleur dit cliente ou prospect ; un anneau signale « à rappeler » (ambre) ou « à visiter » (violet). ---------- */
var LEG = {}; GP.legende.forEach(function (l) { LEG[l.cle] = l; });
var GRIS_P = '#8A93A5', GRIS_F = '#D3D8E2', GRIS_A = '#CDD3DD', BLEU = '#2A63CC', AMBRE = '#A8700A', VIOLET = '#6B5BC2';
function potentiel(o) { return o.opportunites.reduce(function (s, t) { return s + (t.potentielMois || 0); }, 0); }
var POTS = []; Object.keys(O).forEach(function (id) { if (O[id].mien && O[id].opportunites.length) POTS.push(potentiel(O[id])); }); POTS.sort(function (a, b) { return a - b; });
var T1 = POTS[Math.floor(POTS.length / 3)] || 0, T2 = POTS[Math.floor(POTS.length * 2 / 3)] || 0;
function palierPot(o) { var v = potentiel(o); return v >= T2 ? 3 : v >= T1 ? 2 : 1; }   // trois paliers du potentiel par mois (les tiers des officines à opportunité)
var COUCHES = [
  { cle: 'tout', nom: 'Tout voir', col: '#5B6478', test: function () { return true; }, def: 'Bleu : les clientes · gris : les prospects · anneau ambre : à rappeler · anneau violet : à visiter.' },
  { cle: 'clients', nom: LEG.clients.nom, col: BLEU, test: function (o) { return o.categorie === 'client'; }, def: 'Les clientes qui commandent : plus le point est gros, plus le segment est élevé.' },
  { cle: 'prospects', nom: LEG.prospects.nom, col: GRIS_P, test: function (o) { return o.categorie === 'prospect'; }, def: 'Les officines du portefeuille qui ne commandent pas encore.' },
  { cle: 'rappeler', nom: LEG.rappeler.nom, col: AMBRE, anneau: true, test: function (o) { return o.sousStatut === 'à rappeler'; }, def: 'Des clientes dont les commandes reculent : un appel est attendu.' },
  { cle: 'visiter', nom: LEG.visiter.nom, col: VIOLET, anneau: true, test: function (o) { return !!o.aVisiter; }, def: 'Pas vues depuis quatre mois ou plus, ou en retrait sur trois mois : une visite s’impose.' },
  { cle: 'opportunite', nom: LEG.opportunite.nom, col: '#25998A', test: function (o) { return o.opportunites.length > 0; }, def: 'Au moins une opportunité identifiée : plus le point est gros, plus le potentiel estimé par mois est élevé.' },
  { cle: 'groupement', nom: LEG.groupement.nom, col: '#122F6E', anneau: true, test: function (o) { return !!o.groupementId && o.groupementId === K.grp; }, def: 'Les adhérentes du groupement choisi dans le menu.' },
  { cle: 'relancer', nom: 'Pharmacies à relancer', col: AMBRE, cache: true, test: function (o) { return !!o.aRelancer; }, def: 'Un envoi ou un contact resté sans réponse, plus les clientes à rappeler.' },
  { cle: 'noncontactes', nom: 'Prospects jamais contactés', col: '#3E4A60', cache: true, test: function (o) { return !!o.nonContacte; }, def: 'Des prospects sans aucun contact à ce jour.' },
  { cle: 'info', nom: 'Concernées par l’information', col: '#0050E6', cache: true, test: function (o) { var x = INFO_BY[K.info]; return !!x && x.concernes.officines.indexOf(o.id) >= 0; }, def: 'Les pharmacies du portefeuille que l’information du DAILY concerne.' }
];
var COUCHE_BY = {}; COUCHES.forEach(function (c) { COUCHE_BY[c.cle] = c; });
function coucheActive() { return K.couche === 'tout' ? null : COUCHE_BY[K.couche]; }
function compte(c) { var n = 0; Object.keys(O).forEach(function (id) { if (O[id].mien && c.test(O[id])) n++; }); return n; }
function couleurCat(o) { return o.categorie === 'client' ? BLEU : GRIS_P; }
function couleur(p) { var o = O[p.id]; if (!o || !o.mien) return GRIS_A; var c = coucheActive(); if (c) return c.test(o) ? (c.anneau ? couleurCat(o) : c.col) : GRIS_F; return couleurCat(o); }
function rayon(p) { var o = O[p.id]; if (!o || !o.mien) return 3.2; var c = coucheActive();
  if (c) return c.test(o) ? (c.cle === 'opportunite' ? [0, 5.2, 7.2, 9.6][palierPot(o)] : 7) : 3.6;
  return o.categorie === 'client' ? (p.segment === 'Client A' ? 7 : p.segment === 'Client B' ? 6 : 5.2) : 4.6; }
function anneau(p) { var o = O[p.id]; if (!o || !o.mien) return null; var c = coucheActive();
  if (c && c.anneau) return c.test(o) ? c.col : null;
  var k = K.couche; if (k !== 'tout' && k !== 'clients' && k !== 'prospects') return null;
  if (o.sousStatut === 'à rappeler') return AMBRE;
  if (o.aVisiter) return VIOLET;
  return null; }
function cherche(p, q) { var n = norm(q).trim(); return !n || norm(p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).indexOf(n) >= 0; }
function enProx() { return K.vue === 'proximite' || (K.vue === 'fiche' && K.depuis === 'proximite'); }   // la fiche ouverte depuis la proximité garde le scénario
function visible(p) { var o = O[p.id]; if (!o) return false; if (!o.mien && !K.autres) return false;
  if (enProx()) { if (p.id === EXCL) return true; var d = kmDe(p.id); return d != null && d <= K.rayon; }
  if (K.q && !cherche(p, K.q)) return false;
  return true; }
function tip(p) { var o = O[p.id], n = o.opportunites.length;
  return '<b>' + esc(J.joli(p.nom)) + '</b><span>' + esc(p.ville) + ' · ' + p.cp + '</span><span>' + statutTexte(o, p) + (o.mien ? ' · ' + visiteTexte(o) : ' · suivie par ' + esc(p.commercial)) + '</span>' +
    (o.mien && n ? '<span>' + n + ' opportunité' + pluriel(n, '', 's') + ' · ' + eur(potentiel(o)) + ' par mois estimés</span>' : '') + (o.mien && o.aVisiter ? '<span>À visiter</span>' : ''); }
/* ---------- la tournée du matin (étape 4) : ordre calculé localement, plus proche voisin depuis le dépôt ; vitesse et durée de visite lues dans gps.itineraire ---------- */
function dansTour(id) { return K.tour.indexOf(id) >= 0; }
function basculerTour(id) { var i = K.tour.indexOf(id); if (i >= 0) K.tour.splice(i, 1); else K.tour.push(id); return i < 0; }
function planTour(ids) { var reste = (ids || K.tour).slice(), A = [], cur = DEPOT, t = heureMin(DEPOT.heure), tot = 0;
  while (reste.length) { var bi = 0, bd = 1e9; reste.forEach(function (id, i) { var d = km(cur, pt(id)); if (d < bd) { bd = d; bi = i; } });
    var id = reste.splice(bi, 1)[0], min = Math.round(bd / IT.vitesseKmH * 60); t += min; A.push({ id: id, km: bd, min: min, arrivee: t, depart: t + IT.minutesParVisite }); t += IT.minutesParVisite; tot += bd; cur = pt(id); }
  var retour = A.length ? km(cur, DEPOT) : 0, minRetour = Math.round(retour / IT.vitesseKmH * 60);
  return { arrets: A, km: tot, kmRetour: retour, minRetour: minRetour, fin: A.length ? t + minRetour : null, route: Math.round((tot + retour) / IT.vitesseKmH * 60), visite: A.length * IT.minutesParVisite }; }
/* ---------- la visite supplémentaire : calculée depuis la position FICTIVE à l'heure réelle de fin du rendez-vous, dans le créneau libéré (jamais dans la tournée du matin) ---------- */
var POS = { lat: FIN.lat, lng: FIN.lng }, H_FIN = heureMin(FIN.rendezVousQuitte.heureReelleFin), H_PREVU = heureMin(FIN.rendezVousQuitte.heurePrevueFin), LIBRE = Math.max(0, H_PREVU - H_FIN);
function visiteDe(id) { var p = pt(id); if (!p) return null; var d = kmDe(id); if (d == null) d = km(POS, p);
  var min = Math.max(1, Math.round(d / IT.vitesseKmH * 60)), arr = H_FIN + min, dep = arr + IT.minutesParVisite;
  return { id: id, km: d, min: min, arrivee: arr, depart: dep, marge: H_PREVU - dep, tient: dep <= H_PREVU }; }
function nbTournee() { return K.tour.length + (K.visite ? 1 : 0); }
/* ---------- les opportunités géographiques : position FICTIVE (Grasse), distances lues dans gps.finRendezVous.aProximite, les six filtres dans l'ordre du texte ---------- */
var PROX = FIN.aProximite, KM_BY = {}; PROX.forEach(function (x) { KM_BY[x.id] = x.km; });
function kmDe(id) { return KM_BY[id] != null ? KM_BY[id] : null; }
var FILTRES = [
  { cle: 'clients-a-visiter', test: function (o) { return o.categorie === 'client' && !!o.aVisiter; } },
  { cle: 'prospects-non-contactes', test: function (o) { return !!o.nonContacte; } },
  { cle: 'a-relancer', test: function (o) { return !!o.aRelancer; } },
  { cle: 'groupement', test: function (o) { return K.pgrp ? o.groupementId === K.pgrp : !!o.groupementId; } },
  { cle: 'logiciel', test: function (o) { return K.plgo ? o.logicielCle === K.plgo : !!o.logicielCle; } },
  { cle: 'opportunites', test: function (o) { return o.opportunites.length > 0; } }
];
GP.filtresProximite.forEach(function (f, i) { FILTRES[i].nom = f.nom; });
function dansRayon() { return PROX.filter(function (x) { return x.km <= K.rayon && x.id !== EXCL; }); }
function filtreCourant() { for (var i = 0; i < FILTRES.length; i++) if (FILTRES[i].cle === K.pf) return FILTRES[i]; return null; }
/* ---------- « JARVIS vous propose » autour d'une officine (étape 3, calculé pour la fiche ouverte) : les pharmacies du portefeuille les plus proches,
   et celle qui n'a pas été vue depuis le plus longtemps ---------- */
function anciennete(o) { return o.derniereVisite ? (o.moisSansVisite || 0) : 99; }
function propositionPour(id) { var p = pt(id); if (!p) return null; var L = [];
  Object.keys(O).forEach(function (k) { if (k === id || !O[k].mien) return; var q = pt(k); if (!q) return; var d = km(p, q); if (d <= 15) L.push({ id: k, km: d }); });
  L.sort(function (a, b) { return a.km - b.km; });
  var r = [5, 10, 15].filter(function (x) { return L.filter(function (c) { return c.km <= x; }).length >= 2; })[0] || 15, M = L.filter(function (c) { return c.km <= r; }).slice(0, 3);
  if (!M.length) return null;
  var vieux = M.slice().sort(function (a, b) { return anciennete(O[b.id]) - anciennete(O[a.id]); })[0];
  return { officines: M, rayon: r, vieux: vieux }; }
/* ---------- JARVIS DAILY : l'édition suivie (celle que le DAILY a choisie : J.daily, puis S.infos.edition, puis le défaut des données) et la lecture à voix haute ---------- */
function edition() { try { var d = J.daily && J.daily.edition && J.daily.edition(); if (d && d.cle && DY.resume60[d.cle]) return d.cle; } catch (e) {}
  var e2 = S.infos && S.infos.edition; if (e2 && DY.resume60[e2]) return e2; var p = DY.editions.parDefaut; return p.profil + '-' + p.secteur; }
function items60() { return DY.resume60[edition()] || []; }
function nomEdition() { var e = edition().split('-'), p = DY.editions.profils.filter(function (x) { return x.id === e[0]; })[0], s = DY.editions.secteurs.filter(function (x) { return x.id === e[1]; })[0]; return (p ? p.nom : e[0]) + ' · ' + (s ? s.nom : e[1]); }
function infosEdition() { var e = edition().split('-'), out = {}; DY.infos.forEach(function (x) { if (x.editions.profils.indexOf(e[0]) >= 0 && x.editions.secteurs.indexOf(e[1]) >= 0) out[x.id] = true; }); return out; }
function actuDe(o) { var E = infosEdition(); return (o.dansActualite || []).map(function (k) { return INFO_BY[k]; }).filter(Boolean)
  .sort(function (a, b) { return (E[b.id] ? 1 : 0) - (E[a.id] ? 1 : 0) || a.concernes.nbOfficines - b.concernes.nbOfficines; }); }   // celles de l'édition d'abord, puis les plus précises
var AUDIO = { actif: false, jeton: 0, utts: [] }, VOIX = null;
function peutParler() { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); }
/* la même règle que le DAILY : voix française de France installée sur la machine, sinon fr-FR, sinon une autre voix française */
function voixFr() { if (VOIX) return VOIX; try { var vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [], f = function (t) { for (var i = 0; i < vs.length; i++) if (t(vs[i])) return vs[i]; return null; };
  VOIX = f(function (v) { return /^fr[-_]FR$/i.test(v.lang) && v.localService; }) || f(function (v) { return /^fr[-_]FR$/i.test(v.lang); }) || f(function (v) { return /^fr/i.test(v.lang); }); } catch (e) {} return VOIX; }
function surligner(i) { AUDIO.i = i; $$('#ac-d60 li').forEach(function (li, k) { if (k === i) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current'); });
  var t = $('#ac-dtk'), it = items60(); if (t) t.textContent = AUDIO.actif ? (i >= 0 && it[i] ? (i + 1) + ' sur ' + it.length + ' · ' + it[i].phrase : DY.audio.intro) : (it[0] ? it[0].phrase : ''); }
function majBoutonAudio() { $$('#ecran-accueil [data-audio]').forEach(function (b) { b.setAttribute('aria-pressed', String(AUDIO.actif)); b.innerHTML = J.ico(AUDIO.actif ? 'close' : 'son') + '<span>' + (AUDIO.actif ? 'Arrêter' : esc(DY.audio.bouton)) + '</span>'; }); }
function finAudio() { AUDIO.actif = false; AUDIO.utts = []; surligner(-1); majBoutonAudio(); }
function arreter60() { AUDIO.jeton++; try { window.speechSynthesis.cancel(); } catch (e) {} finAudio(); }
function lire60() {
  var n = $('[data-audio-note]'); if (!peutParler()) { if (n) { n.textContent = DY.audio.indisponible; n.hidden = false; } J.toast(DY.audio.indisponible); return; }
  if (AUDIO.actif) { arreter60(); return; }
  var ss = window.speechSynthesis, textes = [DY.audio.intro].concat(items60().map(function (x) { return x.phrase; })), occupe = !!(ss.speaking || ss.pending), jeton = ++AUDIO.jeton;
  try { ss.cancel(); } catch (e) {}
  AUDIO.actif = true; AUDIO.utts = []; majBoutonAudio(); surligner(-1); if (n) { n.textContent = DY.audio.consigne; n.hidden = false; } else J.toast(DY.audio.consigne);
  var dire = function (k) { if (jeton !== AUDIO.jeton) return; if (k >= textes.length) { finAudio(); return; }
    var u = new window.SpeechSynthesisUtterance(textes[k]), v = voixFr(); u.lang = DY.audio.langue || 'fr-FR'; u.rate = 1; if (v) u.voice = v; AUDIO.utts.push(u);   // gardées jusqu'à leur fin
    u.onstart = function () { if (jeton === AUDIO.jeton) surligner(k - 1); };
    u.onend = function () { if (jeton === AUDIO.jeton) dire(k + 1); };
    u.onerror = function () { if (jeton === AUDIO.jeton) dire(k + 1); };
    try { ss.speak(u); } catch (e) { finAudio(); J.toast(DY.audio.indisponible); } };
  if (occupe) setTimeout(function () { dire(0); }, 80); else dire(0);   // Safari : un speak() juste après cancel() peut rester muet
}
/* en quittant l'accueil (menu du haut, « Tout le brief », fiche complète), la voix s'arrête : aucun son sans bouton « Arrêter » à l'écran */
if (window.addEventListener) window.addEventListener('hashchange', function () { if (AUDIO.actif && !/^#accueil/.test(location.hash)) arreter60(); });
function lireDaily(id) { S.infos = S.infos || {}; S.infos.ouverte = id; if (J.daily && J.daily.aller) J.daily.aller(id); else J.aller('infos-detail'); }
/* exposé pour les autres écrans : le DAILY ouvre la carte centrée sur une officine citée, sa fiche latérale ouverte */
/* la couche « information » (les pharmacies qu'une information du DAILY concerne) se quitte, ou se prend, pendant que l'accueil est caché : les couleurs se refont à l'arrivée (rendre) */
function sortirInfo() { if (!K.info) return; K.info = null; if (K.couche === 'info') K.couche = K.coucheAvant || 'tout'; K.recolorer = true; }
J.gpsOuvrir = function (id) { if (!O[id]) return; sortirInfo(); K.fiche = id; K.depuis = 'defaut'; K.centrer = id; K.voir = true; J.aller('accueil-fiche'); };
/* « Voir sur la carte » d'une information du DAILY : l'accueil s'ouvre avec toutes les pharmacies concernées allumées et « L'impact sur mon secteur » dans le volet */
J.gpsInfo = function (id) { if (!INFO_BY[id]) return; K.voir = true; J.aller('accueil-info-' + id); };   // adresse #accueil-info-<id> : l'état (couche, volet) se prend à l'arrivée, dans rendre
J.gps = { K: K, planTour: planTour, dansTour: dansTour, basculerTour: basculerTour, visiteDe: visiteDe, propositionPour: propositionPour, norm: norm, edition: edition, info: J.gpsInfo };
J.gps.centrer = J.gpsOuvrir;   // le nom que le DAILY essaie en second
/* ====================================================================================================================
   Morceau 2 : la page. Bandeau compact (titre et phrase à gauche ; champ de recherche et pli JARVIS DAILY à droite), résumé déplié à la demande,
   la carte juste dessous (hauteur = la fenêtre), ses contrôles flottants, la légende-couches, les calques dessinés au-dessus des points.
   ==================================================================================================================== */
/* les deux nombres internes du bandeau sont des boutons : chacun allume sa couche sur la carte */
function phraseBandeau() { var c = GP.compteurs;
  return '<b>' + nf.format(c.portefeuille) + ' pharmacies</b> dans votre portefeuille, dont <button type="button" class="ac-bn" data-couche-b="noncontactes">' + nf.format(c.nonContactes) + ' prospects jamais contactés</button> et <button type="button" class="ac-bn" data-couche-b="relancer">' + nf.format(c.aRelancer) + ' à relancer</button><span class="ac-dsk"> : un clic les montre sur la carte</span>.'; }
/* le pli JARVIS DAILY, discret : une ligne dans le bandeau (« Écouter » sans rien ouvrir) ; le chevron déplie les cinq informations sous le bandeau */
function dailyPli() { var E = DY.edition, it = items60();
  return '<span class="ac-dpico">' + J.ico('infos') + '</span><a class="ac-dptx" href="#infos" title="Ouvrir le brief complet dans JARVIS DAILY"><span class="ac-dpe">' + esc(E.titre) + '<span class="ac-dsk"> · 60 secondes</span></span><b id="ac-dtk">' + esc(it[0] ? it[0].phrase : '') + '</b></a>' +
    '<button type="button" class="pil plein ac-dpb" data-audio aria-pressed="false">' + J.ico('son') + '<span>' + esc(DY.audio.bouton) + '</span></button>' +
    '<button type="button" class="b-rond ac-d60b" data-d60 aria-expanded="' + K.dOuvert + '" aria-controls="ac-dpan" aria-label="' + (K.dOuvert ? 'Replier le résumé' : 'Déplier les cinq informations') + '">' + J.ico('chevb') + '</button>'; }
function dailyPanel() { if (!K.dOuvert) return ''; var items = items60(), tot = items.reduce(function (s, x) { return s + x.secondes; }, 0), E = DY.edition;
  return '<section class="carte ac-daily" aria-label="JARVIS DAILY, le résumé en ' + tot + ' secondes"><div class="ac-dt"><div class="ac-dtt"><p class="eyebrow">' + esc(E.titre) + ' · ' + esc(E.sousTitre) + '</p><h2>Le résumé en ' + tot + ' secondes</h2><p class="sub">Édition ' + esc(nomEdition()) + ' · ' + esc(E.heure) + ' · ' + esc(G.mention) + ' · un clic sur une information montre sur la carte les pharmacies concernées</p></div>' +
    '<div class="ac-dact"><a class="pil" href="#infos">' + J.ico('infos') + 'Tout le brief</a><button type="button" class="pil" data-d60>' + J.ico('close') + 'Replier</button></div></div>' +
    '<ol class="ac-d60" id="ac-d60">' + items.map(function (x, i) { var inf = INFO_BY[x.id], rub = inf ? RUB_BY[inf.rubrique] : '';
      return '<li style="--i:' + i + '"><button type="button" data-info="' + esc(x.id) + '" aria-pressed="' + (K.info === x.id) + '">' + (rub ? '<span class="ac-dr">' + esc(rub) + '</span>' : '') + '<span class="ac-dp">' + esc(x.phrase) + '</span>' +
        '<span class="ac-ds">' + (inf ? esc(inf.source) + ' · ' + esc(inf.dateTexte) + ' · ' : '') + x.secondes + ' s</span></button></li>'; }).join('') + '</ol>' +
    '<p class="note ac-dnote" data-audio-note hidden></p></section>'; }
function majDaily() { var p = $('#ac-dpli'), q = $('#ac-dpan'); K.edAff = edition(); if (p) { p.innerHTML = dailyPli(); J.poseIcones(p); } if (q) { q.innerHTML = dailyPanel(); J.poseIcones(q); } majBoutonAudio(); if (AUDIO.actif) surligner(AUDIO.i == null ? -1 : AUDIO.i); }
function basculerDaily() { K.dOuvert = !K.dOuvert; try { localStorage.setItem(CLE_D60, K.dOuvert ? 'oui' : 'non'); } catch (e) {} majDaily(); cadrer(); if (I) { I.redessiner(); K.sig = ''; majVolet(); } }
function flottantsHtml() {
  return '<div class="ac-labs" id="ac-labs" aria-hidden="true"></div><div class="ac-flot ac-couches" id="ac-couches" role="group" aria-label="Couches de la carte"></div>' +
    '<div class="ac-flot ac-zoom"><button type="button" class="b-rond" data-z="+" aria-label="Zoom avant">' + J.ico('plus') + '</button><button type="button" class="b-rond" data-z="-" aria-label="Zoom arrière">' + J.ico('minus') + '</button><button type="button" class="b-rond" data-z="pos" aria-label="Recentrer sur mon territoire">' + J.ico('locate') + '</button></div>' +
    '<div class="ac-flot ac-haut"><button type="button" class="pil clair ac-bprox ac-dsk" data-pan="proximite">' + J.ico('locate') + 'Rendez-vous terminé plus tôt ?</button><button type="button" class="pil" data-pan="liste" aria-label="Liste des pharmacies">' + J.ico('list') + '<span class="ac-dsk">Liste</span></button><button type="button" class="pil plein" data-pan="tournee">' + J.ico('route') + '<span>Ma tournée</span><b class="cpt7" id="ac-nt" hidden></b></button></div>' +
    '<button type="button" class="pil clair ac-flot ac-fprox ac-mob" data-pan="proximite">' + J.ico('locate') + 'Terminé plus tôt ?</button>' +
    '<div class="ac-flot ac-bas"><span class="ac-ech"><i id="ac-ech"></i><em>10 km</em></span><p class="ac-def" id="ac-def"></p></div>' +
    '<aside class="ac-volet" id="ac-volet" data-volet role="dialog" aria-label="Volet de JARVIS GPS" hidden></aside>'; }
function puce(c) { return c.anneau ? '<i class="ac-puce ac-puce-anneau" style="border-color:' + c.col + '"></i>' : '<i class="ac-puce" style="background:' + c.col + '"></i>'; }
function couchesHtml() { var act = coucheActive(), cache = act && act.cache ? act : null;
  return '<div class="ac-ctr"><p class="ac-ct">' + J.ico('layers') + 'Afficher</p><button type="button" class="ac-tout" data-couche="tout" aria-pressed="' + (K.couche === 'tout') + '">Tout voir</button></div>' +
    (cache ? '<button type="button" class="ac-couche ac-cache" data-couche="tout" aria-pressed="true" aria-label="' + esc(cache.nom) + ' : revenir à tout voir">' + puce(cache) + '<span class="ac-cn">' + esc(cache.nom) + '</span><b class="num">' + nf.format(compte(cache)) + '</b>' + J.ico('close') + '</button>' : '') +
    COUCHES.filter(function (c) { return c.cle !== 'tout' && !c.cache; }).map(function (c) { var on = K.couche === c.cle, grp = c.cle === 'groupement';
      return '<button type="button" class="ac-couche" data-couche="' + c.cle + '" aria-pressed="' + on + '" title="' + esc(c.def) + '">' + puce(c) + '<span class="ac-cn">' + esc(grp ? 'Groupement' : c.nom) + '</span>' + (grp ? '' : '<b class="num">' + nf.format(compte(c)) + '</b>') + '</button>' +
        (grp ? '<label class="ac-grpl"><span class="ac-vis">Groupement choisi</span><select class="sel ac-sel" id="ac-grp" aria-label="Groupement choisi">' + GP.groupements.map(function (g) { return '<option value="' + esc(g.id) + '"' + (K.grp === g.id ? ' selected' : '') + '>' + esc(g.nom) + ' · ' + nf.format(g.nPortefeuille) + '</option>'; }).join('') + '</select></label>' : ''); }).join('') +
    '<button type="button" class="ac-couche ac-autres" data-autres aria-pressed="' + K.autres + '"><i class="ac-puce ac-puce-autre"></i><span class="ac-cn">Suivies par un autre commercial</span><b class="num">' + nf.format(NB_AUTRES) + '</b></button>'; }
function majCouches() { var e = $('#ac-couches'); if (!e) return; e.innerHTML = couchesHtml(); J.poseIcones(e); var d = $('#ac-def'), c = COUCHE_BY[K.couche] || COUCHES[0]; if (d) d.textContent = c.def; }
function choisirCouche(cle) { if (!COUCHE_BY[cle]) return; if (K.couche === cle && cle !== 'tout') cle = 'tout';
  if (K.vue === 'info' && cle !== 'info') { K.info = null; K.vue = 'defaut'; majDaily(); }
  K.couche = cle; if (K.vue === 'liste') { K.nb = 40; } K.sig = ''; majCouches(); if (I) { I.recolorer(); majVolet(); dessinerCalques(I); } }
/* ---------- calques propres à JARVIS GPS, dans le SVG du moteur. Au-dessus des points (#ac-sur) : la proposition du matin (dépôt, tracé qui se dessine, arrêts
   numérotés avec un halo lent), la position fictive et la visite supplémentaire. Sous les points (#ac-sous) : le disque du rayon. ---------- */
var ANIM_JUSQU = 0;
function animer() { return !J.RM && Date.now() < ANIM_JUSQU; }   // le tracé ne se dessine qu'à l'arrivée, pas à chaque zoom
function f2(x) { return x.toFixed(2); }
/* les textes de la carte (numéros des arrêts, « Vous êtes ici ») sont en HTML au-dessus du SVG : 13 px réels à tout zoom, comme les noms de villes du moteur */
var LABS = [];
function ecran(M, q) { var sv = $('#ac-svg'), z = $('#ac-zone'), m = null, zr = null; try { m = sv && sv.getScreenCTM && sv.getScreenCTM(); zr = z && z.getBoundingClientRect(); } catch (e) {}
  if (m && zr && zr.width > 0 && isFinite(m.a) && isFinite(m.e)) return [m.a * q[0] + m.c * q[1] + m.e - zr.left, m.b * q[0] + m.d * q[1] + m.f - zr.top];   // la matrice du SVG tel qu'il est dessiné : jamais de décalage avec les cercles
  return [(q[0] - M.x) * M.k, (q[1] - M.y) * M.k]; }
function marque(q, k, txt, plein, M) { var e = ecran(M, q); LABS.push('<span class="ac-mk' + (plein ? ' ac-mk-d' : '') + '" style="left:' + e[0].toFixed(1) + 'px;top:' + e[1].toFixed(1) + 'px">' + txt + '</span>');
  return '<circle cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="' + f2(11 * k) + '" fill="' + (plein ? '#1A2030' : '#fff') + '" stroke="' + (plein ? '#fff' : '#1D4CA8') + '" stroke-width="' + f2(2.6 * k) + '"/>'; }
function trace(pts, k, cls) { var ch = pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('');
  return '<path d="' + ch + '" fill="none" stroke="#fff" stroke-width="' + f2(7 * k) + '" stroke-linecap="round" stroke-linejoin="round"/><path d="' + ch + '"' + (cls ? ' pathLength="1" class="trace"' : '') + ' fill="none" stroke="#1D4CA8" stroke-width="' + f2(3 * k) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
function montrerProposition() { return !K.tour.length && (K.vue === 'defaut' || K.vue === 'tournee'); }
/* le moteur écarte les points d'un même lieu à l'échelle d'ouverture : zoomée (proximité, « Voir de près »), cet écart grandirait avec le zoom et poserait une
   pharmacie située à 1 km hors du disque de 10 km. Zoomée, la carte recalcule l'écart à l'échelle courante (même règle que le moteur, points visibles seulement),
   et rend ses positions au moteur en revenant à l'ouverture. */
var POSX = null, POSX_S = 0, POSX_SIG = '';
function poserPoints(M) { var pos = M.positions(); $$('#ac-pts [data-point]').forEach(function (c) { var q = pos[c.getAttribute('data-point')]; if (q) { c.setAttribute('cx', q[0].toFixed(2)); c.setAttribute('cy', q[1].toFixed(2)); } }); M.selection(M.sel); M.tournee(M.tour); }
function ajusterPositions(M) { var V = M.VUE, s = V.s, ca = J.ca, sig = [enProx(), K.rayon, K.q, K.autres, K.couche, K.grp, MOBILE()].join('|');
  if (s <= V.s0 * 1.05) { if (POSX && M.POS === POSX) { M.POS = null; POSX = null; poserPoints(M); } return; }
  if (POSX && M.POS === POSX && Math.abs(s - POSX_S) / s < .04 && sig === POSX_SIG) return;
  var mob = MOBILE(), L = C.points.map(function (p) { return { p: p, x: ca.MX(p.lng) * s, y: ca.MY(p.lat) * s, r: rayon(p) * (mob ? .88 : 1), v: visible(p) }; }), A = L.filter(function (q) { return q.v; });
  for (var it = 0; it < 60; it++) { var bouge = false;
    for (var i = 0; i < A.length; i++) for (var j = i + 1; j < A.length; j++) { var a = A[i], b = A[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = a.r + b.r + 2;
      if (d < m) { var kk = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; kk = m / 2; } a.x -= dx * kk; a.y -= dy * kk; b.x += dx * kk; b.y += dy * kk; bouge = true; } }
    if (!bouge) break; }
  var P = {}; L.forEach(function (q) { P[q.p.id] = [q.x / s, q.y / s]; }); M.POS = POSX = P; POSX_S = s; POSX_SIG = sig; poserPoints(M); }
var DESSIN = null;   // taille du cadre de la carte au dernier dessin : si elle change ensuite (polices qui arrivent), la carte se redessine
function dessinerCalques(M) { var gs = $('#ac-sous'), gp = $('#ac-sur'), gl = $('#ac-labs'); if (!gs || !gp) return; var zc = $('#ac-zone'); if (zc && zc.clientWidth) DESSIN = [zc.clientWidth, zc.clientHeight]; ajusterPositions(M); var ca = J.ca, k = 1 / (M.k || 1), pos = M.positions(), ss = '', sp = '', an = animer(), px = enProx(); LABS = [];
  if (px) { var x = ca.MX(FIN.lng), y = ca.MY(FIN.lat), R = K.rayon / 111.2 * ca.KM, me = [x, y], e = ecran(M, me);
    ss = '<circle cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(R) + '" fill="#2A63CC" fill-opacity=".07" stroke="#2A63CC" stroke-width="' + f2(1.5 * k) + '" stroke-dasharray="' + f2(6 * k) + ' ' + f2(5 * k) + '"/>';
    if (K.visite && pos[K.visite]) sp += trace([me, pos[K.visite]], k, an) + marque(pos[K.visite], k, '1', false, M);
    ss += '<g class="ac-pos"><circle class="ac-pulse" cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(15 * k) + '" fill="#0050E6" fill-opacity=".16"/><circle cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(7 * k) + '" fill="#0050E6" stroke="#fff" stroke-width="' + f2(3 * k) + '"/></g>';   // sous les points : les pharmacies toutes proches restent visibles
    LABS.push('<span class="ac-lab" style="left:' + e[0].toFixed(1) + 'px;top:' + e[1].toFixed(1) + 'px">Vous êtes ici · ' + esc(FIN.ville) + ' (position fictive)</span>'); }
  else if (montrerProposition()) { var d = [ca.MX(DEPOT.lng), ca.MY(DEPOT.lat)], cib = PROP.officines.map(function (o) { return pos[o.id]; }).filter(Boolean);
    sp = trace([d].concat(cib), k, an) + cib.map(function (q, i) { return '<circle class="ac-pulse ac-halo" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="' + f2(16 * k) + '" fill="#1D4CA8" fill-opacity=".14"/>' + marque(q, k, String(i + 1), false, M); }).join('') + marque(d, k, 'D', true, M); }
  gs.innerHTML = ss; gp.innerHTML = sp; if (gl) gl.innerHTML = LABS.join('');
  $$('#ac-villes .ca-ville').forEach(function (v) { if (px && v.textContent === FIN.ville) v.hidden = true; }); }   // le nom de la ville est déjà dans « Vous êtes ici »
function voletLargeur() { var v = $('#ac-volet'); return v && !v.hidden && !MOBILE() ? v.offsetWidth : 0; }
function libre(w, hh) { if (MOBILE()) { var vm = $('#ac-volet'), y1 = hh - 70; if (vm && !vm.hidden) y1 = Math.min(y1, Math.max(124 + 150, window.innerHeight - 92 - vm.offsetHeight - 86)); return { x0: 14, y0: 124, x1: w - 14, y1: y1 }; }   /* au téléphone, les points restent au-dessus du tiroir */ var vl = voletLargeur(); if (ETROIT()) return { x0: 16, y0: 124, x1: w - (vl ? vl + 32 : 24), y1: hh - 64 }; return { x0: 300, y0: 70, x1: w - (vl ? vl + 32 : 24), y1: hh - 56 }; }
function mesure() { var r = $('#ac-zone').getBoundingClientRect(); return { w: Math.max(300, r.width), h: Math.max(300, r.height) }; }
function centrerSur(lng, lat, s) { if (!I) return; var ca = J.ca, V = I.VUE, m = mesure(), f = libre(m.w, m.h), px = (f.x0 + f.x1) / 2, py = (f.y0 + f.y1) / 2;
  V.s = Math.max(V.s0, Math.min(V.s0 * 6, s || V.s0 * 3)); V.cx = ca.MX(lng) + (m.w / 2 - px) / V.s; V.cy = ca.MY(lat) + (m.h / 2 - py) / V.s; I.maj(); }
/* cadre la carte sur un groupe de lieux (la proposition du matin : le dépôt et ses trois pharmacies) */
function cadrerSur(lieux) { if (!I || !lieux.length) return; var ca = J.ca, xs = lieux.map(function (l) { return ca.MX(l.lng); }), ys = lieux.map(function (l) { return ca.MY(l.lat); }), m = mesure(), f = libre(m.w, m.h),
  x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), s = Math.min((f.x1 - f.x0) * .7 / Math.max(1e-6, x1 - x0), (f.y1 - f.y0) * .7 / Math.max(1e-6, y1 - y0));
  var V = I.VUE; V.s = Math.max(V.s0, Math.min(V.s0 * 6, s)); var px = (f.x0 + f.x1) / 2, py = (f.y0 + f.y1) / 2; V.cx = (x0 + x1) / 2 + (m.w / 2 - px) / V.s; V.cy = (y0 + y1) / 2 + (m.h / 2 - py) / V.s; I.maj(); }
function zoomProx() { var m = mesure(), f = libre(m.w, m.h), R = K.rayon / 111.2 * J.ca.KM, s = Math.min(I.VUE.s0 * 6, ((f.y1 - f.y0) * .78) / (2 * R)); centrerSur(FIN.lng, FIN.lat, s); }
/* la carte prend la hauteur de la fenêtre sous le bandeau : tout le territoire est visible au premier écran */
function cadrer() { var z = $('#ac-zone'); if (!z) return; var top = z.getBoundingClientRect().top + window.scrollY, hh = window.innerHeight - top - (MOBILE() ? 92 : 16);
  hh = Math.max(MOBILE() ? 460 : 496, Math.min(MOBILE() ? 640 : 900, isFinite(hh) ? hh : 0)); z.style.setProperty('--ac-h', Math.round(hh) + 'px'); }
function majTourUI() { var n = $('#ac-nt'), nb = nbTournee(); if (n) { n.textContent = nb; n.hidden = !nb; } if (I) { I.tournee(K.tour.length && !enProx() ? planTour().arrets.map(function (a) { return a.id; }) : null); dessinerCalques(I); }
  $$('#ecran-accueil [data-tourne]').forEach(function (b) { var id = b.getAttribute('data-tourne'), d = dansTour(id); b.setAttribute('aria-pressed', String(d)); b.setAttribute('aria-label', d ? 'Retirer de ma tournée' : 'Ajouter à ma tournée');
    if (b.classList.contains('rond-act')) b.innerHTML = '<span class="rond"><span class="ico">' + J.icoSvg(d ? 'check' : 'route') + '</span></span>' + (d ? 'Dans ma tournée' : GP.fiche.boutons[1]); else b.innerHTML = J.ico(d ? 'check' : 'plus'); });
  $$('#ecran-accueil [data-visite]').forEach(function (b) { var id = b.getAttribute('data-visite'), d = K.visite === id; b.setAttribute('aria-pressed', String(d));
    if (b.classList.contains('rond-act')) b.innerHTML = '<span class="rond"><span class="ico">' + J.icoSvg(d ? 'check' : 'plus') + '</span></span>' + (d ? 'Visite prévue' : esc(FIN.geste)); else b.innerHTML = J.ico(d ? 'check' : 'plus') + (d ? 'Visite prévue' : esc(FIN.geste)); });
  $$('#ecran-accueil [data-ajout]').forEach(function (b) { var ids = b.getAttribute('data-ajout').split(','), toutes = ids.every(dansTour); b.setAttribute('aria-pressed', String(toutes)); b.innerHTML = J.ico(toutes ? 'check' : 'route') + (toutes ? 'Dans ma tournée' : esc(b.getAttribute('data-lib'))); }); }
/* l'entrée du territoire : les points apparaissent en cascade, du dépôt vers les bords (coupé par « réduire le mouvement ») */
function entreePoints() { if (J.RM || !I) return; var ca = J.ca, d0 = [ca.MX(DEPOT.lng), ca.MY(DEPOT.lat)], pos = I.positions(), L = $$('#ac-pts [data-point]'), dm = 1e-6;
  var ds = L.map(function (c) { var q = pos[c.getAttribute('data-point')]; var d = q ? Math.sqrt(Math.pow(q[0] - d0[0], 2) + Math.pow(q[1] - d0[1], 2)) : 0; if (d > dm) dm = d; return d; });
  L.forEach(function (c, i) { c.style.animationDelay = Math.round(ds[i] / dm * 520) + 'ms'; c.classList.add('ac-in'); }); }
function construire(el) {
  var droite = '<label class="rech-g ac-rech">' + J.ico('search') + '<input id="ac-q" type="search" placeholder="Pharmacie, ville, code postal" aria-label="Rechercher une pharmacie sur la carte" value="' + esc(K.q) + '" autocomplete="off"></label>' +
    '<div class="ac-dpli" id="ac-dpli" role="group" aria-label="JARVIS DAILY, le résumé en 60 secondes"></div>';
  el.innerHTML = '<div class="page ac-page">' + J.bandeau({ croix: true, classe: 'ac-ban', eyebrow: 'JARVIS GPS<span class="ac-dsk"> · ' + esc(DY.edition.jour) + '</span>', titre: 'Votre territoire vivant', lede: phraseBandeau(), actions: droite }) +
    '<p class="note vp ac-vp">Vue pharmacien : JARVIS GPS est réservé à l’interne, la carte et ses fiches ne sont pas affichées. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
    '<div id="ac-dpan" data-interne></div><div class="ac-zone" id="ac-zone" data-interne></div><div class="ac-dessous" id="ac-dessous" data-interne></div>' +
    '<p class="note ac-note">Fond de carte local (contours des ' + C.departements.length + ' départements, villes), aucun service extérieur · position « fin de rendez-vous » fictive, jamais la géolocalisation réelle · distances à vol d’oiseau · ' + esc(G.mention) + '.</p></div>';
  $$('.ban-tete .lede,.ban-act', el).forEach(function (e) { e.setAttribute('data-interne', ''); });   // vue pharmacien : le bandeau ne garde que son titre
  majDaily(); cadrer();
  I = J.ca.creer({ zone: $('#ac-zone', el), id: 'ac', aria: 'JARVIS GPS : les ' + C.points.length + ' officines du secteur', rayon: rayon, couleur: couleur, anneau: anneau, visible: visible, tip: tip, libre: libre, apres: dessinerCalques,
    onClic: function (p) { ouvrirFiche(p.id); }, onVide: function () { if (K.vue === 'fiche') fermerVolet(); } });
  var sv = $('#ac-svg', el), gs = document.createElementNS('http://www.w3.org/2000/svg', 'g'), gp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gs.setAttribute('id', 'ac-sous'); gs.setAttribute('pointer-events', 'none'); gp.setAttribute('id', 'ac-sur'); gp.setAttribute('pointer-events', 'none'); sv.insertBefore(gs, $('#ac-tr', el)); sv.appendChild(gp);
  $('#ac-zone', el).insertAdjacentHTML('beforeend', flottantsHtml());
  J.poseIcones(el); ANIM_JUSQU = Date.now() + 1400; I.points(); entreePoints(); majCouches();
  $('#ac-q', el).oninput = function (e) { K.q = e.target.value.trim(); if (K.q) { if (K.vue !== 'resultats') { K.avant = K.vue === 'fiche' ? 'defaut' : K.vue; K.vue = 'resultats'; } } else if (K.vue === 'resultats') K.vue = K.avant || 'defaut'; K.nb = 40; K.sig = ''; if (J.courant.suite) { K.garder = window.scrollY; J.aller('accueil'); } else { I.maj(); majVolet(); } };
  $$('.ac-flot, .ac-volet', el).forEach(function (f) { ['pointerdown', 'dblclick', 'wheel'].forEach(function (ev) { f.addEventListener(ev, function (e) { e.stopPropagation(); }); }); });
  brancher(el);
  /* le cadre de la carte (ou le bandeau au-dessus : une police qui arrive change sa hauteur) change de taille sans événement « resize » : la hauteur de la carte se recale sur la fenêtre,
     puis la carte, ses calques et le volet se redessinent s'ils ne l'ont pas été à cette taille */
  if (window.ResizeObserver) { try { var ro = new ResizeObserver(function () { var z = $('#ac-zone'), sec = $('#ecran-accueil'); if (!z || !I || !sec || sec.hidden || !z.clientWidth) return; cadrer();
    if (DESSIN && Math.abs(DESSIN[0] - z.clientWidth) < 1 && Math.abs(DESSIN[1] - z.clientHeight) < 1) return; I.redessiner(); K.sig = ''; majVolet(); });
    ro.observe($('#ac-zone', el)); var bn = $('.ac-ban', el); if (bn) ro.observe(bn); } catch (e) {} }
  if (!ecoute) { ecoute = true;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && I && !$('#ecran-accueil').hidden && K.vue !== 'defaut') fermerVolet(); });
    window.addEventListener('resize', function () { var s = $('#ecran-accueil'); if (s && !s.hidden && I) { cadrer(); I.redessiner(); K.sig = ''; majVolet(); } }); }
}
/* ====================================================================================================================
   Morceau 3 : le volet (JARVIS vous propose · la fiche latérale · Ma tournée · opportunités géographiques · information du DAILY · Liste · résultats), navigation, clics, rendre.
   ==================================================================================================================== */
function kmf(x) { return (Math.abs(x - Math.round(x)) < .05 ? nf.format(Math.round(x)) : nf1.format(x)) + ' km'; }
function tete(eyebrow, titre, fermer, cls) { return '<button type="button" class="ac-grab" aria-label="Agrandir ou réduire le volet"><i></i></button><div class="ac-vt"><div><p class="eyebrow">' + eyebrow + '</p><h2' + (cls ? ' class="' + cls + '"' : '') + '>' + titre + '</h2></div>' + (fermer ? '<button type="button" class="b-rond" data-fermer aria-label="Fermer">' + J.ico('close') + '</button>' : '') + '</div>'; }
function tag(ico, col, txt) { return '<span class="etat"><span class="ico">' + J.icoSvg(ico, col) + '</span>' + txt + '</span>'; }
function tagsDe(o, p, max) { var L = [J.etatHtml(etatCle(o))];
  if (o.aVisiter) L.push(tag('route', 'var(--c-cmd)', 'À visiter')); if (o.nonContacte) L.push(tag('user', 'var(--e-neutre)', 'Jamais contactée')); if (o.aRelancer && o.sousStatut !== 'à rappeler') L.push(tag('bell', 'var(--e-attention)', 'À relancer'));
  if (o.opportunites.length) L.push(tag('spark', 'var(--c-pharma)', esc(o.opportunites[0].titre)));
  if (K.vue === 'proximite' && K.pf === 'groupement' && p.groupement !== 'Sans groupement') L.push(tag('group', 'var(--enc-3)', esc(p.groupement))); if (K.vue === 'proximite' && K.pf === 'logiciel' && o.logiciel) L.push(tag('screen', 'var(--enc-3)', esc(o.logiciel)));
  return L.slice(0, max || 3).join(''); }
function boutonTour(id) { var d = dansTour(id); return '<button type="button" class="b-rond" data-tourne="' + id + '" aria-pressed="' + d + '" aria-label="' + (d ? 'Retirer de ma tournée' : 'Ajouter à ma tournée') + '">' + J.ico(d ? 'check' : 'plus') + '</button>'; }
function boutonVisite(id) { var d = K.visite === id; return '<button type="button" class="chip" data-visite="' + id + '" aria-pressed="' + d + '">' + J.ico(d ? 'check' : 'plus') + (d ? 'Visite prévue' : esc(FIN.geste)) + '</button>'; }
function ligne(id, x) { x = x || {}; var p = pt(id), o = O[id];
  return '<div class="ac-l' + (x.visite ? ' ac-l-chip' : '') + '" data-officine="' + id + '"><button type="button" class="ac-ln" data-ouvre="' + id + '"><b>' + esc(J.joli(p.nom)) + '</b><span class="sub">' + (x.sous || esc(p.ville) + ' · ' + p.cp) + '</span>' + (x.tags ? '<span class="ac-tags">' + x.tags + '</span>' : '') + '</button>' +
    '<span class="ac-la"><button type="button" class="b-rond" data-loc="' + id + '" aria-label="Voir sur la carte">' + J.ico('locate') + '</button>' + (o.mien ? (x.visite ? boutonVisite(id) : boutonTour(id)) : '') + '</span></div>'; }
function boutonAjout(ids, lib) { var toutes = ids.every(dansTour); return '<button type="button" class="pil plein ac-geste" data-ajout="' + ids.join(',') + '" data-lib="' + esc(lib) + '" aria-pressed="' + toutes + '">' + J.ico(toutes ? 'check' : 'route') + (toutes ? 'Dans ma tournée' : esc(lib)) + '</button>'; }
/* --- par défaut : JARVIS vous propose (étape 3), le scénario « rendez-vous terminé plus tôt », Ma tournée en bref --- */
function porte(ico, eyebrow, titre, sous, attr) { return '<button type="button" class="ac-porte" ' + attr + '><span class="rond gris">' + J.ico(ico) + '</span><span class="ac-porte-t"><span class="eyebrow">' + eyebrow + '</span><b>' + titre + '</b>' + (sous ? '<span class="sub">' + sous + '</span>' : '') + '</span></button>'; }
function defautHtml() { var plan = planTour(), q = pt(EXCL), v = K.visite ? visiteDe(K.visite) : null;
  return tete('JARVIS vous propose · ce matin, au départ', esc(PROP.phrase), false, 'ac-h2p') +
    '<p class="note ac-pnote">Autour du dépôt ' + esc(PROP.autour.nom.replace(/^Dépôt\s+/i, '')) + ', départ à ' + h(PROP.autour.heure) + ' · arrêts tracés sur la carte. <button type="button" class="ac-lien" data-voir-prop>Voir de près</button></p>' +
    '<div class="ac-liste ac-p0">' + PROP.officines.map(function (x, i) { var o = O[x.id], p = pt(x.id), vx = x.id === PROP.nonVisiteeDepuis.officine;   // la moins récemment vue porte la cloche, sans redire le nombre de mois
      return ligne(x.id, { sous: '<span class="ac-num">' + (i + 1) + '</span>' + esc(p.ville) + ' · ' + kmf(x.km) + ' · ' + (vx ? '<span class="ac-vx">' + J.ico('bell') + 'vue le ' + J.dateFr(o.derniereVisite) + '</span>' : '<span class="ac-vu">vue le ' + J.dateFr(o.derniereVisite) + '</span>') }); }).join('') + '</div>' +
    boutonAjout(PROP.geste.officines, PROP.geste.libelle) +
    '<div class="ac-portes">' + porte('locate', 'Scénario · ' + esc(FIN.rendezVousQuitte.heureReelleFin), 'Rendez-vous terminé plus tôt', esc(chez(J.joli(q.nom), true)) + ', ' + esc(FIN.ville), 'data-pan="proximite"') +
    porte('route', 'Ma tournée', K.tour.length ? K.tour.length + ' arrêt' + pluriel(K.tour.length, '', 's') + ' · retour ' + hm(plan.fin) : v ? 'Une visite cet après-midi' : 'Vide pour l’instant', K.tour.length ? 'Itinéraire tracé sur la carte' : v ? 'Arrivée ' + hm(v.arrivee) : 'JARVIS prépare l’itinéraire', 'data-pan="tournee"') + '</div>'; }
/* --- la fiche latérale (étape 2) : tout ce que le concept demande, sans quitter la carte ; « JARVIS vous propose » calculé autour d'elle --- */
function nomProduit(q) { var i = q.nom.indexOf(','), nom = i > 0 ? q.nom.slice(0, i) : q.nom, suite = i > 0 ? q.nom.slice(i + 1).trim() : '';
  if (/^présentation\s+\d+$/i.test(suite)) suite = '';   // libellé de remplissage des données (« présentation 2 ») : on ne garde que le nom et la famille
  return { nom: nom, sous: (suite ? suite + ' · ' : '') + q.famille }; }
function propHtml(id) { var o = O[id], P = propositionPour(id); if (!P) return ''; var n = P.officines.length, vo = O[P.vieux.id], a = anciennete(vo), ids = (o.mien && !enProx() ? [id] : []).concat(P.officines.map(function (x) { return x.id; }));
  var phrase = maj1(enMots(n)) + ' pharmacie' + pluriel(n, '', 's') + ' de votre portefeuille se trouve' + pluriel(n, '', 'nt') + ' à moins de ' + P.rayon + ' km.' +
    (a >= 99 ? (n > 1 ? ' L’une d’elles n’a jamais été visitée.' : ' Elle n’a jamais été visitée.') : a >= 3 ? (n > 1 ? ' L’une d’elles n’a pas été visitée depuis ' + a + ' mois.' : ' Elle n’a pas été visitée depuis ' + a + ' mois.') : '');
  var lib = ids.length === 1 ? 'Ajouter cette pharmacie à ma tournée' : 'Ajouter les ' + enMots(ids.length) + ' à ma tournée' + (ids.indexOf(id) >= 0 ? ' (celle-ci comprise)' : '');
  return '<div class="ac-prop"><p class="eyebrow">' + J.ico('spark') + 'JARVIS vous propose</p><p class="ac-propt">' + esc(phrase) + '</p><div class="ac-liste">' +
    P.officines.map(function (x) { var q = O[x.id], p = pt(x.id), lui = x.id === P.vieux.id && a >= 3;   // la plus ancienne porte son étiquette, les autres leur dernière visite
      return ligne(x.id, { sous: esc(p.ville) + ' · ' + kmf(x.km) + (lui ? '' : ' · ' + visiteTexte(q)), tags: lui ? tag('bell', 'var(--e-attention)', a >= 99 ? 'Jamais visitée' : 'Pas revue depuis ' + a + ' mois') : '' }); }).join('') + '</div>' +
    (enProx() ? '' : boutonAjout(ids, lib)) + '</div>'; }
function ficheHtml(id) { var p = pt(id), o = O[id], cl = o.categorie === 'client', mien = o.mien, ex = (J.offFiche || J.offById)(id), cm = p.caParMois || [], n = cm.length, M = o.montants, px = enProx(), v = px && mien ? visiteDe(id) : null;
  var aBaisse = o.opportunites.some(function (t) { return t.type === 'baisse'; }), motifV = o.aVisiter && o.motifVisite && o.motifVisite.indexOf('%') < 0 ? o.motifVisite : (o.aVisiter && !aBaisse ? o.motifVisite : ''), evo = !aBaisse && !(o.motifVisite && o.motifVisite.indexOf('%') >= 0);
  var dk = kmDe(id), tt = tete('Fiche officine · ' + esc(nomDep(o.departement)) + (px && dk != null ? ' · à ' + kmf(dk) + ' de vous' : ''), esc(J.joli(p.nom)), true);
  var meta = '<div class="ac-meta">' + J.etatHtml(etatCle(o), o.sousStatut === 'à rappeler' ? 'Cliente à rappeler' : null) + (cl && mien ? tag('star', 'var(--enc-3)', esc(p.segment)) : '') + (o.nonContacte ? tag('user', 'var(--e-neutre)', 'Jamais contactée') : '') + (o.clientOffilog ? tag('box', 'var(--c-ca)', 'Cliente Offilog') : '') + '</div>';
  var chiffres = cl && mien ? '<div class="ac-ch" data-interne><p class="ac-per">' + (M ? esc(M.periode) + ' · ' : '') + n + ' mois de ventes</p><div class="ac-ch1"><span class="ac-l">Chiffre d’affaires</span><b class="num">' + J.gros(eur(p.ca)) + '</b>' + (evo ? J.evoHtml(o.evolutionPct, 'trois derniers mois') : '') + '</div><div class="ac-spark" id="ac-spark"></div>' +
    (M ? '<div><span class="ac-l">Notre marge</span><b class="num">' + J.gros(eur(M.margeNous)) + '</b></div><div><span class="ac-l">Abandon de marge</span><b class="num">' + J.gros(eur(M.abandonMarge)) + '</b></div>' : '') + '</div>'
    : cl ? '<p class="note ac-reserve">Chiffres de vente réservés au commercial de cette officine, ' + esc(p.commercial) + '.</p>' : '<p class="note ac-reserve">Pas encore de ventes réseau pour cette officine' + (o.sousStatut === 'prospect' ? ' : prospect à conquérir.' : '.') + '</p>';
  var tel = String(p.telephone).replace(/[^\d+]/g, '');
  var act = '<div class="ronds ac-ronds"><a class="rond-act plein" href="tel:' + esc(tel) + '"><span class="rond"><span class="ico">' + J.icoSvg('phone') + '</span></span>Appeler</a>' +
    J.rond('doc', GP.fiche.boutons[0], ex ? '' : 'La fiche complète est ouverte pour vos ' + NB_FICHES + ' officines : celle-ci est suivie par ' + p.commercial + '.', 0, ex ? ' data-act="fiche"' : '') +
    (mien ? (px ? J.rond(K.visite === id ? 'check' : 'plus', K.visite === id ? 'Visite prévue' : esc(FIN.geste), '', 0, ' data-visite="' + id + '" aria-pressed="' + (K.visite === id) + '"') : J.rond(dansTour(id) ? 'check' : 'route', dansTour(id) ? 'Dans ma tournée' : GP.fiche.boutons[1], '', 0, ' data-tourne="' + id + '" aria-pressed="' + dansTour(id) + '"')) : '') +
    '<a class="rond-act" href="' + lienPlans(p, px ? POS : null) + '"><span class="rond"><span class="ico">' + J.icoSvg('pin') + '</span></span>' + esc(GP.fiche.boutons[2]) + '</a></div>';
  var creneau = v ? '<p class="ac-motif ac-cre' + (v.tient ? '' : ' hors') + '">' + J.ico(v.tient ? 'check' : 'bell') + '<span><b>' + (v.tient ? 'Tient dans le créneau libéré.' : 'Déborde du créneau libéré.') + '</b> ' + duree(v.min) + ' de route depuis votre position fictive · arrivée ' + hm(v.arrivee) + ' · repartirait à ' + hm(v.depart) + (v.tient ? ', ' + v.marge + ' min avant ' + hm(H_PREVU) : ', ' + (-v.marge) + ' min après ' + hm(H_PREVU)) + '.</span></p>' : '';
  var rap = o.sousStatut === 'à rappeler', mr = o.motifRelance ? String(o.motifRelance).replace(/^À rappeler\s*:\s*/i, '') : '';
  var motifs = (motifV ? '<p class="ac-motif">' + J.ico('route') + '<span><b>À visiter.</b> ' + esc(motifV) + '</span></p>' : '') + (o.aRelancer && mr ? '<p class="ac-motif">' + J.ico('bell') + '<span><b>' + (rap ? 'À rappeler.' : 'À relancer.') + '</b> ' + esc(maj1(mr)) + '</span></p>' : '');
  var lignes = [['Titulaire', esc(p.titulaire)], ['Téléphone', '<a class="ac-tel" href="tel:' + esc(tel) + '">' + esc(p.telephone) + '</a>'], ['Adresse', o.adresse ? esc(o.adresse) : ''], ['Commune', esc(p.cp + ' ' + p.ville)], ['Groupement', esc(p.groupement)], ['Logiciel', o.logiciel ? esc(o.logiciel) : 'non renseigné'],
    ['Dernière visite', o.derniereVisite ? J.dateFr(o.derniereVisite) + ' <span class="sub ac-inl">· ' + esc(o.derniereVisiteTexte) + '</span>' : 'jamais visitée', 1],
    ['Dernier contact', o.dernierContact && o.dernierContact.type !== 'visite' ? esc(o.dernierContact.type) + ' · ' + J.dateFr(o.dernierContact.date) : '', 1], ['Prochain rendez-vous', o.prochainRendezVous ? J.dateFr(o.prochainRendezVous.date) + ' à ' + h(o.prochainRendezVous.heure) : '', 1], ['Commercial', mien ? '' : esc(p.commercial), 1]];
  var opp = o.opportunites.length ? '<h3>Opportunité' + pluriel(o.opportunites.length, '', 's') + ' commerciale' + pluriel(o.opportunites.length, '', 's') + ' <span class="st">potentiel estimé par mois</span></h3><ul class="ac-opps">' + o.opportunites.map(function (t) { return '<li><span class="ac-oppi">' + J.ico(ICO_OPP[t.type] || 'spark') + '</span><div><b>' + esc(t.titre) + '</b><span class="sub">' + esc(t.pourquoi) + '</span></div><b class="num ac-pot">' + eur(t.potentielMois) + '</b></li>'; }).join('') + '</ul>' : '';
  var prod = '<h3>Produits à lui proposer <span class="st">potentiel par mois</span></h3><table class="tabl ac-tp"><tbody>' + o.aProposer.map(function (q) { var np = nomProduit(q); return '<tr><td><b>' + esc(np.nom) + '</b><span class="sub">' + esc(np.sous) + '</span><span class="sub">' + esc(q.pourquoi) + '</span></td><td class="num"><b>' + eur(q.potentielMois) + '</b></td></tr>'; }).join('') + '</tbody></table>';
  var A = actuDe(o), E = infosEdition(), actu = A.length ? '<h3>Dans l’actualité <span class="st">JARVIS DAILY du jour</span></h3><ul class="ac-actu">' + A.slice(0, 3).map(function (inf) { return '<li><button type="button" data-lire="' + esc(inf.id) + '"><span class="sub">' + esc(RUB_BY[inf.rubrique] || '') + ' · ' + esc(inf.dateTexte) + (E[inf.id] ? '' : ' · hors de votre édition') + '</span><b>' + esc(inf.titre) + '</b><span class="sub ac-pq">Pourquoi elle : ' + esc(maj1(inf.concernes.critere).replace(/\.$/, '')) + '.</span>' + J.ico('chev') + '</button></li>'; }).join('') + '</ul>' + (A.length > 3 ? '<a class="ac-lien" href="#infos">' + (A.length - 3) + ' autre' + pluriel(A.length - 3, '', 's') + ' dans le brief du jour</a>' : '') : '';
  return tt + meta + act + creneau + chiffres + motifs + (px ? '' : propHtml(id)) + '<h3>Carte d’identité</h3>' + J.kv(lignes) + opp + prod + actu + '<p class="note">' + esc(G.mention) + (mien ? '' : ' · officine suivie par un autre commercial : fiche réduite.') + '</p>'; }
function dessinerSpark(v) { var b = $('#ac-spark', v), p = pt(K.fiche); if (!b || !p || !p.caParMois) return; var cm = p.caParMois, ML = J.D.mois;
  J.dessine(b, function (w) { return J.spark(cm, null, w, 48, 'var(--c-ca)', { aria: 'Chiffre d’affaires par mois de ' + J.joli(p.nom) }); }); b.setAttribute('title', cm.map(function (x, i) { return J.ml(ML[i]) + ' : ' + eur(x); }).join(' · ')); }
/* --- Ma tournée (étape 4) : le matin depuis le dépôt ; l'après-midi, la visite supplémentaire depuis la position fictive --- */
function friseHtml(A, plan, retirer) { return '<ol class="ac-frise"><li><span class="ac-fh num">' + h(DEPOT.heure) + '</span><span class="ac-fb dep">D</span><div><b>Départ · ' + esc(DEPOT.nom) + '</b><span class="sub">' + esc(DEPOT.adresse) + '</span></div></li>' +
    A.map(function (a, i) { var p = pt(a.id); return '<li class="ac-ft">' + J.ico('route') + duree(a.min) + ' · ' + kmf(a.km) + '</li><li><span class="ac-fh num">' + hm(a.arrivee) + '</span><span class="ac-fb">' + (i + 1) + '</span><div><b>' + esc(J.joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · ' + p.cp + ' · repart à ' + hm(a.depart) + '</span></div>' +
      (retirer ? '<span class="ac-la"><a class="b-rond" href="' + lienPlans(p, i ? pt(A[i - 1].id) : DEPOT) + '" aria-label="Ouvrir ce trajet dans Plans">' + J.ico('ext') + '</a><button type="button" class="b-rond" data-retire="' + a.id + '" aria-label="Retirer cet arrêt">' + J.ico('close') + '</button></span>' : '') + '</li>'; }).join('') +
    (A.length ? '<li class="ac-ft">' + J.ico('route') + duree(plan.minRetour) + ' · ' + kmf(plan.kmRetour) + '</li><li><span class="ac-fh num">' + hm(plan.fin) + '</span><span class="ac-fb dep">R</span><div><b>Retour au dépôt</b><span class="sub">fin de la tournée du matin</span></div></li>' : '') + '</ol>'; }
function visiteHtml(v, complet) { var p = pt(v.id), q = pt(EXCL);
  return '<div class="ac-vsup"><p class="eyebrow">' + J.ico('locate') + 'Cet après-midi · visite supplémentaire</p><ol class="ac-frise"><li><span class="ac-fh num">' + hm(H_FIN) + '</span><span class="ac-fb dep">' + J.icoSvg('locate') + '</span><div><b>Fin du rendez-vous</b><span class="sub">' + esc(chez(J.joli(q.nom), true)) + ', ' + esc(FIN.ville) + ' · position fictive</span></div></li>' +
    '<li class="ac-ft">' + J.ico('route') + duree(v.min) + ' · ' + kmf(v.km) + '</li><li><span class="ac-fh num">' + hm(v.arrivee) + '</span><span class="ac-fb">1</span><div><b>' + esc(J.joli(p.nom)) + '</b><span class="sub">repart à ' + hm(v.depart) + ' · ' + (v.tient ? v.marge + ' min avant la fin prévue du créneau (' + hm(H_PREVU) + ')' : 'déborde de ' + (-v.marge) + ' min le créneau prévu jusqu’à ' + hm(H_PREVU)) + '</span></div></li></ol>' +
    '<div class="ac-pact"><a class="pil plein" href="' + lienPlans(p, POS) + '">' + J.ico('route') + 'Itinéraire depuis ' + esc(FIN.ville) + '</a><button type="button" class="pil" data-retire-visite>' + J.ico('close') + 'Retirer</button>' + (complet ? '<button type="button" class="pil" data-pan="proximite">' + J.ico('locate') + 'Pharmacies proches</button>' : '') + '</div></div>'; }
function tourneeHtml() { var plan = planTour(), A = plan.arrets, v = K.visite ? visiteDe(K.visite) : null, apercu = A.length ? null : planTour(PROP.geste.officines);
  return tete('Ma tournée · départ ' + esc(DEPOT.nom), A.length ? nf.format(Math.round(plan.km + plan.kmRetour)) + ' km de route ce matin' : 'Votre tournée du matin est vide', true) +
    (A.length ? '<div class="ac-4"><div><span class="ac-l">Sur la route</span><b class="num">' + duree(plan.route) + '</b></div><div><span class="ac-l">En visite</span><b class="num">' + duree(plan.visite) + '</b></div></div>' + friseHtml(A, plan, true) +
      '<div class="ac-pact"><a class="pil plein" href="' + lienPlans(pt(A[0].id), DEPOT) + '">' + J.ico('route') + 'Trajet vers le 1er arrêt dans Plans</a><button type="button" class="pil" data-vider>Vider</button></div>' +
      '<p class="note">Plans reçoit un trajet à la fois : la flèche de chaque arrêt ouvre le trajet depuis l’arrêt précédent.</p>'
    : '<p class="note">Sélectionnez des pharmacies (fiche, proposition, liste) : JARVIS prépare l’itinéraire et le trace sur la carte. Aperçu de la tournée que JARVIS propose ce matin, pas encore ajoutée :</p>' + friseHtml(apercu.arrets, apercu, false) + boutonAjout(PROP.geste.officines, PROP.geste.libelle)) +
    (v ? visiteHtml(v, true) : '') +
    '<p class="note">' + esc(IT.note) + ' Vitesse retenue ' + IT.vitesseKmH + ' km/h, ' + IT.minutesParVisite + ' min par visite.</p>'; }
/* --- opportunités géographiques : « Vous êtes à proximité de N pharmacies. », rayon, les six filtres du texte, « Ajouter une visite » dans le créneau libéré --- */
var ICO_F = { 'clients-a-visiter': 'route', 'prospects-non-contactes': 'user', 'a-relancer': 'bell', groupement: 'group', logiciel: 'screen', opportunites: 'spark' };
function selParam(cle, miens) { var cpt = {}, noms = {}; miens.forEach(function (x) { var o = O[x.id], k = cle === 'groupement' ? o.groupementId : o.logicielCle; if (!k) return; cpt[k] = (cpt[k] || 0) + 1; noms[k] = cle === 'groupement' ? pt(x.id).groupement : o.logiciel; });
  var val = cle === 'groupement' ? K.pgrp : K.plgo; return '<label class="filtre ac-fparam">Lequel<select id="' + (cle === 'groupement' ? 'ac-pgrp' : 'ac-plgo') + '" aria-label="' + (cle === 'groupement' ? 'Groupement' : 'Logiciel') + '"><option value=""' + (val ? '' : ' selected') + '>' + (cle === 'groupement' ? 'Tous les groupements' : 'Tous les logiciels connus') + '</option>' + Object.keys(cpt).map(function (k) { return '<option value="' + esc(k) + '"' + (val === k ? ' selected' : '') + '>' + esc(noms[k]) + ' · ' + cpt[k] + '</option>'; }).join('') + '</select></label>'; }
function proxHtml() { var tous = dansRayon(), miens = tous.filter(function (x) { return x.mien; }), f = filtreCourant(), L = f ? miens.filter(function (x) { return f.test(O[x.id]); }) : miens, n = miens.length, q = pt(EXCL), v = K.visite ? visiteDe(K.visite) : null;
  var phrase = K.rayon === FIN.rayonKm && n === FIN.nbPortefeuilleDansRayon ? FIN.phrase : 'Vous êtes à proximité de ' + n + ' pharmacie' + pluriel(n, '', 's') + '.';
  return tete('Opportunités géographiques · position fictive : ' + esc(FIN.ville) + ' (' + esc(FIN.departement) + ')', esc(phrase), true) +
    '<p class="note">Rendez-vous ' + esc(chez(J.joli(q.nom))) + ' terminé à ' + esc(FIN.rendezVousQuitte.heureReelleFin) + ' au lieu de ' + esc(FIN.rendezVousQuitte.heurePrevueFin) + ' : ' + LIBRE + ' minutes libres pour une visite supplémentaire (' + IT.minutesParVisite + ' min sur place). ' + tous.length + ' pharmacies en tout dans ce rayon, les autres suivies par un autre commercial.</p>' +
    (v ? visiteHtml(v, false) : '') +
    '<div class="ac-ray" role="group" aria-label="Rayon"><span class="ac-l">Rayon</span>' + FIN.rayons.map(function (r) { return '<button type="button" class="ac-chip" data-rayon="' + r + '" aria-pressed="' + (r === K.rayon) + '">' + r + ' km</button>'; }).join('') + '</div>' +
    '<div class="ac-frows" role="group" aria-label="Filtrer">' + FILTRES.map(function (ft) { var c = miens.filter(function (x) { return ft.test(O[x.id]); }).length, on = K.pf === ft.cle; return '<button type="button" class="ac-frow" data-pf="' + ft.cle + '" aria-pressed="' + on + '">' + J.ico(ICO_F[ft.cle]) + '<span>' + esc(ft.nom) + '</span><b class="num">' + c + '</b></button>' + (on && (ft.cle === 'groupement' || ft.cle === 'logiciel') ? selParam(ft.cle, miens) : ''); }).join('') + '</div>' +
    '<h3>' + (f ? esc(f.nom) : 'Dans le rayon, par distance') + '</h3><div class="ac-liste">' + (L.length ? L.map(function (x) { var p = pt(x.id), w = visiteDe(x.id);
      return ligne(x.id, { visite: true, sous: kmf(x.km) + ' · ' + esc(p.ville) + ' · ' + duree(w.min) + ' de route · repartirait à ' + hm(w.depart), tags: (w.tient ? tag('check', 'var(--e-bien)', 'Tient dans le créneau') : tag('bell', 'var(--e-attention)', 'Hors du créneau')) + tagsDe(O[x.id], p, 2) }); }).join('') : '<p class="note">Aucune pharmacie de votre portefeuille ne correspond dans ce rayon : élargissez le rayon ou changez de filtre.</p>') + '</div><p class="note">' + esc(FIN.scenario) + '</p>'; }
/* --- une information du DAILY montrée sur la carte : « L'impact sur mon secteur », puis l'article complet en second geste --- */
function infoHtml() { var x = INFO_BY[K.info]; if (!x) return defautHtml(); var C2 = COUCHE_BY.info, L = trier(C.points.filter(function (p) { var o = O[p.id]; return o && o.mien && C2.test(o); })), E = infosEdition();
  return tete(esc(RUB_BY[x.rubrique] || '') + ' · ' + esc(x.dateTexte) + ' · ' + esc(x.source), esc(x.titre), true) + '<p class="ac-dres">' + esc(x.resume) + '</p>' +
    '<h3>Pourquoi c’est important pour moi</h3><p class="ac-dres">' + esc(x.pourquoi) + '</p>' +
    '<h3>L’impact sur mon secteur <span class="st">' + L.length + ' pharmacie' + pluriel(L.length, '', 's') + ' allumée' + pluriel(L.length, '', 's') + ' sur la carte</span></h3><p class="note">' + esc(x.concernes.critere) + ((x.concernes.groupements || []).length ? ' · elles sont adhérentes de : ' + x.concernes.groupements.map(function (g) { return esc(GRP_NOM[g] || g); }).join(', ') : '') + (E[x.id] ? '' : ' · hors de votre édition') + '</p>' +
    '<div class="ac-liste">' + L.slice(0, 6).map(function (p) { return ligne(p.id, { tags: tagsDe(O[p.id], p, 2) }); }).join('') + '</div>' + (L.length > 6 ? '<button type="button" class="pil" data-pan="liste">' + J.ico('list') + 'Les ' + L.length + ' dans la liste</button>' : '') +
    '<div class="ac-pact"><button type="button" class="pil plein" data-lire="' + esc(x.id) + '">' + J.ico('infos') + 'Lire l’article dans JARVIS DAILY</button></div><p class="note">' + esc(x.nature) + ' · ' + esc(x.mention) + '</p>'; }
function montrerInfo(id) { if (!INFO_BY[id]) return; if (K.vue === 'info' && K.info === id) { quitterInfo(); K.vue = 'defaut'; appliquerVue(); return; }
  if (K.couche !== 'info') K.coucheAvant = K.couche; K.info = id; K.couche = 'info'; K.vue = 'info'; K.sig = ''; if (K.q) { K.q = ''; var qe = $('#ac-q'); if (qe) qe.value = ''; } majCouches(); I.recolorer(); majDaily();
  if (J.courant.suite) { K.garder = window.scrollY; J.aller('accueil'); } else appliquerVue(); }
function quitterInfo() { K.info = null; if (K.couche === 'info') K.couche = K.coucheAvant || 'tout'; majCouches(); if (I) I.recolorer(); majDaily(); }
/* --- Liste (les pharmacies de la couche) et résultats de la recherche du bandeau ; la frappe ne redessine que la liste, jamais le champ --- */
function prio(o) { return (o.aVisiter ? 8 : 0) + (o.sousStatut === 'à rappeler' ? 4 : 0) + (o.aRelancer ? 2 : 0) + Math.min(3, o.opportunites.length) + (o.nonContacte ? 1 : 0); }
function trier(L) { return L.sort(K.tri === 'nom' ? function (a, b) { return J.joli(a.nom).localeCompare(J.joli(b.nom), 'fr'); } : K.tri === 'ca' ? function (a, b) { return b.ca - a.ca; } : function (a, b) { return prio(O[b.id]) - prio(O[a.id]) || b.ca - a.ca; }); }
function listeCorps() { var c = coucheActive(), L = trier(C.points.filter(function (p) { var o = O[p.id]; return o && o.mien && (!c || c.test(o)) && cherche(p, K.ql); })), aff = L.slice(0, K.nb);
  return (K.ql ? '<p class="note"><b>' + nf.format(L.length) + '</b> résultat' + pluriel(L.length, '', 's') + ' pour « ' + esc(K.ql) + ' »</p>' : '') +
    '<div class="ac-liste">' + (aff.length ? aff.map(function (p) { return ligne(p.id, { tags: tagsDe(O[p.id], p, 2) }); }).join('') : '<p class="note">Aucune pharmacie ne correspond.</p>') + '</div>' + (L.length > aff.length ? '<button type="button" class="pil" data-plus-liste>Voir ' + Math.min(40, L.length - aff.length) + ' de plus</button>' : ''); }
function listeHtml() { var c = coucheActive();
  return tete('Liste · classée par ' + (K.tri === 'nom' ? 'nom' : K.tri === 'ca' ? 'chiffre d’affaires' : 'priorité'), esc(c ? c.nom : 'Mon portefeuille'), true) +
    '<div class="ac-pf"><label class="filtre">' + J.ico('search') + '<input id="ac-lq" type="search" placeholder="Un nom, une ville, un code postal…" aria-label="Rechercher dans la liste" value="' + esc(K.ql) + '" autocomplete="off"></label><div class="seg" role="group" aria-label="Trier"><button type="button" data-tri="priorite" aria-pressed="' + (K.tri === 'priorite') + '">Priorité</button><button type="button" data-tri="nom" aria-pressed="' + (K.tri === 'nom') + '">Nom</button><button type="button" data-tri="ca" aria-pressed="' + (K.tri === 'ca') + '" data-interne>Ventes</button></div></div>' +
    '<div id="ac-lres">' + listeCorps() + '</div>'; }
function resultatsHtml() { var L = trier(C.points.filter(function (p) { return visible(p) && cherche(p, K.q); })), aff = L.slice(0, K.nb);
  return tete('Recherche sur la carte', '<span class="num">' + nf.format(L.length) + '</span> pharmacie' + pluriel(L.length, '', 's') + ' pour « ' + esc(K.q) + ' »', true) + '<p class="note">Les points qui ne correspondent pas sont retirés de la carte le temps de la recherche ; les accents ne comptent pas.</p>' +
    '<div class="ac-liste">' + (aff.length ? aff.map(function (p) { var o = O[p.id]; return ligne(p.id, { tags: o.mien ? tagsDe(o, p, 2) : tag('user', 'var(--enc-3)', 'suivie par ' + esc(p.commercial)) }); }).join('') : '<p class="note">Aucune pharmacie ne correspond.</p>') + '</div>' + (L.length > aff.length ? '<button type="button" class="pil" data-plus-liste>Voir ' + Math.min(40, L.length - aff.length) + ' de plus</button>' : ''); }
/* --- le volet : à droite sur ordinateur (contenu par défaut = JARVIS vous propose), tiroir à trois crans au téléphone (le défaut vit alors sous la carte) --- */
function voletHtml() { return K.vue === 'fiche' ? ficheHtml(K.fiche) : K.vue === 'tournee' ? tourneeHtml() : K.vue === 'proximite' ? proxHtml() : K.vue === 'liste' ? listeHtml() : K.vue === 'resultats' ? resultatsHtml() : K.vue === 'info' ? infoHtml() : defautHtml(); }
function signature() { return [K.vue, K.fiche, K.depuis, K.rayon, K.pf, K.pgrp, K.plgo, K.q, K.tri, K.nb, K.ql, K.couche, K.grp, K.info, MOBILE(), K.tour.join(','), K.visite, edition()].join('|'); }
/* les ronds encre à lettre blanche (départ, retour) restés sous le bas du volet qui défile sont vraiment masqués tant qu'ils sont hors de vue ; ils réapparaissent dès qu'on fait défiler jusqu'à eux */
var IO_V = null;
function masquerHors(v) { if (IO_V) IO_V.disconnect(); IO_V = null; if (!window.IntersectionObserver) return;
  IO_V = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.style.visibility = e.isIntersecting ? '' : 'hidden'; }); }, { root: v });
  $$('.ac-fb.dep', v).forEach(function (b) { IO_V.observe(b); }); }
function majVolet() { var v = $('#ac-volet'), d = $('#ac-dessous'); if (!v || !I) return; var mob = MOBILE(), sig = signature();
  if (sig === K.sig) return; var neuf = K.vueAff !== K.vue || K.ficheAff !== K.fiche; K.sig = sig; K.vueAff = K.vue; K.ficheAff = K.fiche;
  if (mob) { d.innerHTML = '<section class="carte ac-dcarte">' + defautHtml() + '</section>'; J.poseIcones(d); } else d.innerHTML = '';
  var etait = v.hidden; if (mob && K.vue === 'defaut') { v.hidden = true; if (!etait) I.redessiner(); return; }
  v.innerHTML = voletHtml(); J.poseIcones(v); v.hidden = false; masquerHors(v); if (neuf || etait) { v.setAttribute('data-cran', K.vue === 'fiche' || K.vue === 'proximite' || K.vue === 'info' ? '1' : '2'); v.scrollTop = 0; if (mob) K.voir = true; }   // au téléphone, la carte reste visible au-dessus du tiroir
  if (K.vue === 'fiche') dessinerSpark(v); if (etait) I.redessiner(); majTourUI(); }
function appliquerVue() { if (!I) return;
  if (!enProx() && K.zoomProx) { K.zoomProx = false; I.vue('pos'); }
  I.maj(); I.selection(K.vue === 'fiche' ? K.fiche : null); majVolet(); majTourUI();
  if (enProx() && !K.zoomProx) { K.zoomProx = true; zoomProx(); }   // une fois le volet ouvert : la position se centre dans la partie libre de la carte
  if (MOBILE() && K.voir && K.vue !== 'defaut') { K.voir = false; setTimeout(voirCarte, 30); if (enProx()) { K.zoomProx = true; zoomProx(); } } }
/* amène la carte à l'écran quand le volet s'ouvre depuis le bandeau, le DAILY ou une adresse directe (sous la barre du haut, qui reste collée) */
function voirCarte() { var z = $('#ac-zone'); if (!z || !z.offsetHeight) return; var r = z.getBoundingClientRect(), hb = $('.haut'), hh = hb ? Math.max(0, hb.getBoundingClientRect().bottom) : 0;
  if (r.top < hh - 2 || r.top > window.innerHeight * .45) { try { window.scrollTo({ top: Math.max(0, window.scrollY + r.top - hh - 10), behavior: J.RM ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, window.scrollY + r.top - hh - 10)); } } }
var VUES_SANS_ADRESSE = ['liste', 'resultats', 'info'];
function ouvrirFiche(id) { if (!O[id]) return; K.infoAdresse = false; if (K.vue !== 'fiche') K.depuis = K.vue; K.fiche = id; if (J.courant.hash === 'accueil-fiche') { K.vue = 'fiche'; K.sig = ''; appliquerVue(); } else { K.garder = window.scrollY; J.aller('accueil-fiche'); } }
function fermerVolet() { var v = K.vue;
  if (v === 'fiche') { K.garder = window.scrollY; J.aller(K.depuis === 'proximite' || K.depuis === 'tournee' ? 'accueil-' + K.depuis : 'accueil'); return; }
  if (v === 'tournee' || v === 'proximite') { K.garder = window.scrollY; J.aller('accueil'); return; }
  if (v === 'resultats') { K.q = ''; var q = $('#ac-q'); if (q) q.value = ''; }
  if (v === 'info') { quitterInfo(); if (J.courant.suite) { K.vue = 'defaut'; K.garder = window.scrollY; J.aller('accueil'); return; } }
  K.vue = 'defaut'; appliquerVue(); }
function ouvrirPan(vue, dehors) { if (dehors) K.voir = true;
  if (vue === 'tournee' || vue === 'proximite') { if (J.courant.hash === 'accueil-' + vue) { K.vue = vue; appliquerVue(); if (K.voir) { K.voir = false; voirCarte(); } } else { K.garder = dehors ? null : window.scrollY; J.aller('accueil-' + vue); } return; }
  if (vue === 'liste' && K.vue === 'liste') vue = 'defaut'; if (K.vue === 'info' && vue !== 'liste') quitterInfo(); K.vue = vue; if (J.courant.suite) { K.garder = window.scrollY; J.aller('accueil'); } else { appliquerVue(); if (K.voir) { K.voir = false; voirCarte(); } } }
function ajoutTour(ids) { var manque = ids.filter(function (x) { return !dansTour(x); });
  if (manque.length) { manque.forEach(function (x) { K.tour.push(x); }); J.toast(manque.length + ' pharmacie' + pluriel(manque.length, ' ajoutée', 's ajoutées') + ' à votre tournée du matin.'); }
  else { ids.forEach(function (x) { basculerTour(x); }); J.toast(ids.length > 1 ? 'Ces pharmacies sont retirées de votre tournée.' : 'La pharmacie est retirée de votre tournée.'); } }
function basculerVisite(id) { var nom = J.joli(pt(id).nom), avant = K.visite;
  if (avant === id) { K.visite = null; J.toast(nom + ' n’est plus prévue cet après-midi.'); return; }
  K.visite = id; var v = visiteDe(id); J.toast(nom + ' : visite supplémentaire, arrivée ' + hm(v.arrivee) + (v.tient ? ', dans le créneau libéré.' : ', au-delà du créneau prévu jusqu’à ' + hm(H_PREVU) + '.') + (avant ? ' Elle remplace la visite prévue.' : '')); }
/* clics : délégation sur l'écran ; chaque geste s'arrête ici, AVANT le gestionnaire commun (qui attrape le <body data-vue> et redessinerait l'écran) ;
   les [data-stub], le retour et le vrai bouton de vue ([data-vue] hors <body>) passent au gestionnaire commun */
function brancher(el) {
  el.addEventListener('click', function (e) { var t = e.target && e.target.closest ? e.target : null, b; if (!t) return;
    if (t.closest('[data-stub],[data-action="retour"],[data-outils],[data-plus],[data-compte]')) return;
    var dv = t.closest('[data-vue]'); if (dv && dv !== document.body) return;
    var a = t.closest('a[href^="#"]'); if (a) { var hh = a.getAttribute('href').slice(1); e.preventDefault(); e.stopPropagation(); if (hh) J.aller(hh); return; }
    var dehors = !t.closest('#ac-zone');
    if ((b = t.closest('[data-pan]'))) ouvrirPan(b.getAttribute('data-pan'), dehors);
    else if ((b = t.closest('[data-couche-b]'))) { choisirCouche(b.getAttribute('data-couche-b')); K.vue = K.couche === 'tout' ? 'defaut' : 'liste'; K.nb = 40; K.sig = '';   // la couche allumée, et sa liste dans le volet
      if (J.courant.suite) { K.garder = null; K.voir = true; J.aller('accueil'); } else { appliquerVue(); voirCarte(); } }
    else if ((b = t.closest('[data-couche]'))) choisirCouche(b.getAttribute('data-couche'));
    else if (t.closest('[data-autres]')) { K.autres = !K.autres; majCouches(); I.maj(); }
    else if ((b = t.closest('[data-z]'))) I.vue(b.getAttribute('data-z'));
    else if (t.closest('[data-audio]')) lire60();
    else if (t.closest('[data-d60]')) basculerDaily();
    else if ((b = t.closest('[data-info]'))) { montrerInfo(b.getAttribute('data-info')); voirCarte(); }
    else if ((b = t.closest('[data-lire]'))) lireDaily(b.getAttribute('data-lire'));
    else if ((b = t.closest('[data-ouvre]'))) ouvrirFiche(b.getAttribute('data-ouvre'));
    else if ((b = t.closest('[data-loc]'))) { var p = pt(b.getAttribute('data-loc')); if (p) { centrerSur(p.lng, p.lat, Math.max(I.VUE.s, I.VUE.s0 * 3.2)); I.selection(p.id); } if (MOBILE()) { var vv = $('#ac-volet'); if (vv) vv.setAttribute('data-cran', '1'); } }
    else if ((b = t.closest('[data-tourne]'))) { var id = b.getAttribute('data-tourne'), d = basculerTour(id); J.toast(J.joli(pt(id).nom) + (d ? ' est ajoutée à votre tournée du matin.' : ' est retirée de votre tournée.')); majTourUI(); majVolet(); }
    else if ((b = t.closest('[data-visite]'))) { basculerVisite(b.getAttribute('data-visite')); majTourUI(); majVolet(); }
    else if ((b = t.closest('[data-retire]'))) { basculerTour(b.getAttribute('data-retire')); majTourUI(); majVolet(); }
    else if (t.closest('[data-retire-visite]')) { K.visite = null; majTourUI(); majVolet(); }
    else if (t.closest('[data-vider]')) { K.tour = []; majTourUI(); majVolet(); }
    else if ((b = t.closest('[data-ajout]'))) { ajoutTour(b.getAttribute('data-ajout').split(',')); majTourUI(); majVolet(); }
    else if (t.closest('[data-voir-prop]')) cadrerSur([DEPOT].concat(PROP.officines.map(function (x) { return pt(x.id); })));
    else if ((b = t.closest('[data-rayon]'))) { K.rayon = +b.getAttribute('data-rayon'); zoomProx(); majVolet(); }
    else if ((b = t.closest('[data-pf]'))) { var f = b.getAttribute('data-pf'); K.pf = K.pf === f ? '' : f; majVolet(); }
    else if ((b = t.closest('[data-tri]'))) { K.tri = b.getAttribute('data-tri'); K.sig = ''; majVolet(); }
    else if (t.closest('[data-plus-liste]')) { K.nb += 40; majVolet(); }
    else if (t.closest('[data-fermer]')) fermerVolet();
    else if ((b = t.closest('.ac-grab'))) { var vo = b.closest('.ac-volet'), c = +vo.getAttribute('data-cran') || 1; vo.setAttribute('data-cran', String(c >= 3 ? 1 : c + 1)); }
    else if (t.closest('[data-act="fiche"]')) { if (J.ouvrirFiche) J.ouvrirFiche(K.fiche, J.courant.hash || 'accueil-fiche'); }
    var cp = t.closest('.cp'); if (cp) J.toast('Copié : ' + cp.parentNode.textContent.trim());
    if (t.closest('.ac-page')) { e.stopPropagation(); if (J.menuPlus) J.menuPlus(false); } });
  el.addEventListener('change', function (e) { var t = e.target; if (!t) return;
    if (t.id === 'ac-pgrp') { K.pgrp = t.value; majVolet(); } else if (t.id === 'ac-plgo') { K.plgo = t.value; majVolet(); }
    else if (t.id === 'ac-grp') { K.grp = t.value; if (K.vue === 'info') { K.info = null; K.vue = 'defaut'; majDaily(); } K.couche = 'groupement'; K.sig = ''; majCouches(); I.recolorer(); majVolet(); } });
  el.addEventListener('input', function (e) { var t = e.target; if (!t || t.id !== 'ac-lq') return; K.ql = t.value; K.nb = 40; var r = $('#ac-lres'); if (r) { r.innerHTML = listeCorps(); J.poseIcones(r); K.sig = signature(); majTourUI(); } });
  /* survoler une ligne du volet fait ressortir son point sur la carte */
  el.addEventListener('mouseover', function (e) { if (!I || MOBILE()) return; var b = e.target.closest && e.target.closest('.ac-volet [data-ouvre], .ac-volet [data-loc]'); if (b) I.selection(b.getAttribute('data-ouvre') || b.getAttribute('data-loc')); });
  el.addEventListener('mouseout', function (e) { if (!I || MOBILE()) return; var b = e.target.closest && e.target.closest('.ac-volet [data-ouvre], .ac-volet [data-loc]'); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) I.selection(K.vue === 'fiche' ? K.fiche : null); });
}
/* les constructeurs HTML, exposés pour l'épreuve hors navigateur (controle) et pour le DAILY */
J.gps.html = { defaut: defautHtml, fiche: ficheHtml, tournee: tourneeHtml, proximite: proxHtml, liste: listeHtml, resultats: resultatsHtml, info: infoHtml, couches: couchesHtml, daily: dailyPanel, pli: dailyPli, bandeau: phraseBandeau };
J.ecrans.accueil = {
  rendre: function (el, etat) {
    if (!J.ca) { el.innerHTML = '<div class="page"><section class="carte"><h1>JARVIS GPS</h1><p class="note">La carte ne peut pas être affichée dans ce navigateur.</p></section></div>'; return; }
    if (!I || !$('#ac-zone', el)) construire(el); else { cadrer(); I.redessiner(); }
    var mi = /^info-([a-z0-9]+)$/.exec(etat.suite || '');   // #accueil-info-<id> : une information du DAILY montrée sur la carte (« Les voir sur la carte », lien direct)
    if (mi && INFO_BY[mi[1]]) { if (K.info !== mi[1]) { if (K.couche !== 'info') K.coucheAvant = K.couche; K.info = mi[1]; K.couche = 'info'; K.recolorer = true; K.sig = ''; if (K.q) { K.q = ''; var qe = $('#ac-q'); if (qe) qe.value = ''; } } K.vue = 'info'; K.infoAdresse = true; }
    else if (K.infoAdresse && !etat.suite) { K.infoAdresse = false; if (K.vue === 'info') { K.info = null; if (K.couche === 'info') K.couche = K.coucheAvant || 'tout'; K.vue = 'defaut'; K.recolorer = true; K.sig = ''; } }   // « Retour » depuis l'information montrée par son adresse
    if (K.recolorer) { K.recolorer = false; majCouches(); I.recolorer(); majDaily(); K.sig = ''; }   // la couche « information » a changé (le DAILY, une fiche) pendant que l'accueil était caché
    if (K.edAff !== edition()) { majDaily(); K.sig = ''; }   // l'édition choisie dans le DAILY a changé : le résumé suit
    if (K.garder != null) { window.scrollTo(0, K.garder); K.garder = null; }
    var s = etat.suite || '';
    if (s === 'fiche') { if (!K.fiche || !O[K.fiche]) { K.fiche = PROP.officines[0].id; K.depuis = 'defaut'; } K.vue = 'fiche'; }
    else if (s === 'tournee' || s === 'proximite') K.vue = s;
    else if (K.vue === 'fiche' && (K.depuis === 'proximite' || K.depuis === 'tournee')) { K.vue = K.depuis; J.aller('accueil-' + K.depuis); return; }   // Retour depuis une fiche ouverte dans le scénario : on y revient
    else if (K.vue === 'fiche') K.vue = VUES_SANS_ADRESSE.indexOf(K.depuis) >= 0 ? K.depuis : 'defaut';
    else if (K.vue === 'tournee' || K.vue === 'proximite') K.vue = 'defaut';
    if (K.vue === 'resultats' && !K.q) K.vue = 'defaut'; if (K.vue === 'info' && !K.info) K.vue = 'defaut';
    appliquerVue();
    if (K.centrer) { var p = pt(K.centrer); K.centrer = null; if (p) centrerSur(p.lng, p.lat, I.VUE.s0 * 3); }
    if (K.voir) { K.voir = false; setTimeout(voirCarte, 30); }
  }
};
})();
