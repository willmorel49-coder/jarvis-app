/* PHIRST · la lettre « préparée pour » une pharmacie (24/11/2026) — LA forme des notes de Yann, partagée par :
   - l'écran Vitrine de Yann (phirst-vitrine.js), qui les écrit dans `dossier_lettres.contenu` (verifier) ;
   - la page publique (lettre/), qui les lit par la fonction `phirst_lettre(jeton)` (normaliser).
   Maquette validée par Will le 23/11/2026 : ~/PHIRST/finalisation-2026-11-22/P-vitrine-variantes/v1/ (« 1 · La lettre », version p7).
   Le plan est un PLAN TYPE (même dessin pour chaque pharmacie) : Yann choisit, pour chaque constat et chaque idée, la zone qui s'allume.
   Fichier pur : marche seul dans node (tests/phirst-lettre-contenu.test.mjs). */
(function (racine) {
  'use strict';
  /* zones du plan type d'aujourd'hui (constats) et du plan type de demain (idées) : [clé, libellé du choix dans l'écran de Yann] */
  var ZONES_VU = [['file', 'La file d’attente'], ['para', 'La parapharmacie'], ['reserve', 'La réserve'], ['confid', 'L’endroit pour parler']];
  var ZONES_PROPOSE = [['entree', 'L’entrée'], ['comptoir', 'Le comptoir'], ['para', 'La parapharmacie'], ['confid', 'L’espace pour parler'], ['reserve', 'La réserve']];
  var MAX = { mot: 400, t: 90, d: 320, entree: 24, suiteT: 80, suiteD: 320, vu: 4, propose: 5 };
  var BORNES = { surface: [10, 5000], postes: [1, 30] };
  var JS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var ML = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function txt(v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; }
  function cles(z) { return z.map(function (x) { return x[0]; }); }
  function estJour(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(Date.parse(s + 'T12:00:00Z')).toISOString().slice(0, 10) === s; }
  function estQuand(s) { return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(s) && estJour(s.slice(0, 10)); }
  function entier(v) { if (v === '' || v == null) return null; var n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && Math.round(n) === n ? n : NaN; }
  function vide() { return { rdv: '', mot: '', vu: [], propose: [], surfaces: { aujourdhui: null, demain: null }, postes: { aujourdhui: null, demain: null }, entree: { aujourdhui: '', demain: '' }, suite: { t: '', quand: '', d: '' } }; }

  /* La page publique lit ce que la base lui rend, quoi que ce soit : tout ce qui n'a pas la bonne forme est écarté, jamais affiché. */
  function normaliser(c) {
    var o = vide(); c = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
    if (estJour(txt(c.rdv))) o.rdv = txt(c.rdv);
    o.mot = txt(c.mot).slice(0, MAX.mot);
    function liste(l, zones, max) {
      return (Array.isArray(l) ? l : []).filter(function (x) { return x && cles(zones).indexOf(x.zone) >= 0 && txt(x.t); }).slice(0, max)
        .map(function (x) { return { zone: x.zone, t: txt(x.t).slice(0, MAX.t), d: txt(x.d).slice(0, MAX.d) }; });
    }
    o.vu = liste(c.vu, ZONES_VU, MAX.vu); o.propose = liste(c.propose, ZONES_PROPOSE, MAX.propose);
    ['aujourdhui', 'demain'].forEach(function (k) {
      var s = entier(c.surfaces && c.surfaces[k]), p = entier(c.postes && c.postes[k]);
      o.surfaces[k] = s >= BORNES.surface[0] && s <= BORNES.surface[1] ? s : null;
      o.postes[k] = p >= BORNES.postes[0] && p <= BORNES.postes[1] ? p : null;
      o.entree[k] = txt(c.entree && c.entree[k]).slice(0, MAX.entree);
    });
    var s = c.suite && typeof c.suite === 'object' ? c.suite : {};
    o.suite = { t: txt(s.t).slice(0, MAX.suiteT), quand: estQuand(txt(s.quand)) ? txt(s.quand) : '', d: txt(s.d).slice(0, MAX.suiteD) };
    return o;
  }

  /* L'écran de Yann : on REFUSE ce qui dépasse (on ne coupe jamais son texte en silence) et on dit quel champ, en clair. */
  function verifier(saisie) {
    var e = [], c = saisie && typeof saisie === 'object' ? saisie : {};
    function trop(champ, v, max, nom) { if (txt(v).length > max) e.push({ champ: champ, message: nom + ' : ' + max + ' caractères au plus (il y en a ' + txt(v).length + ').' }); }
    if (txt(c.rdv) && !estJour(txt(c.rdv))) e.push({ champ: 'rdv', message: 'La date du rendez-vous n’est pas une vraie date.' });
    trop('mot', c.mot, MAX.mot, 'Le mot d’introduction');
    function liste(l, zones, max, nom, champ) {
      l = Array.isArray(l) ? l : [];
      var pleines = l.filter(function (x) { return x && (txt(x.t) || txt(x.d)); });
      if (pleines.length > max) e.push({ champ: champ, message: max + ' ' + nom + ' au plus.' });
      pleines.forEach(function (x, i) {
        var n = nom.charAt(0).toUpperCase() + nom.slice(1).replace(/s$/, '') + ' ' + (i + 1);
        if (!txt(x.t)) e.push({ champ: champ + '.' + i + '.t', message: n + ' : il manque le titre.' });
        if (cles(zones).indexOf(x.zone) < 0) e.push({ champ: champ + '.' + i + '.zone', message: n + ' : choisissez la zone du plan.' });
        trop(champ + '.' + i + '.t', x.t, MAX.t, n + ', titre'); trop(champ + '.' + i + '.d', x.d, MAX.d, n + ', détail');
      });
      return pleines.map(function (x) { return { zone: x.zone, t: txt(x.t), d: txt(x.d) }; });
    }
    var vu = liste(c.vu, ZONES_VU, MAX.vu, 'constats', 'vu'), propose = liste(c.propose, ZONES_PROPOSE, MAX.propose, 'idées', 'propose');
    var o = vide(); o.rdv = estJour(txt(c.rdv)) ? txt(c.rdv) : ''; o.mot = txt(c.mot); o.vu = vu; o.propose = propose;
    ['aujourdhui', 'demain'].forEach(function (k) {
      var lib = k === 'aujourdhui' ? 'aujourd’hui' : 'demain';
      var s = entier(c.surfaces && c.surfaces[k]), p = entier(c.postes && c.postes[k]);
      if (s !== null && !(s >= BORNES.surface[0] && s <= BORNES.surface[1])) e.push({ champ: 'surfaces.' + k, message: 'Surface ' + lib + ' : un nombre entier de m², entre ' + BORNES.surface[0] + ' et ' + BORNES.surface[1] + '.' });
      if (p !== null && !(p >= BORNES.postes[0] && p <= BORNES.postes[1])) e.push({ champ: 'postes.' + k, message: 'Postes ' + lib + ' : un nombre entier, entre ' + BORNES.postes[0] + ' et ' + BORNES.postes[1] + '.' });
      o.surfaces[k] = s === null || isNaN(s) ? null : s; o.postes[k] = p === null || isNaN(p) ? null : p;
      trop('entree.' + k, c.entree && c.entree[k], MAX.entree, 'L’entrée ' + lib);
      o.entree[k] = txt(c.entree && c.entree[k]);
    });
    var s = c.suite && typeof c.suite === 'object' ? c.suite : {};
    if (txt(s.quand) && !estQuand(txt(s.quand))) e.push({ champ: 'suite.quand', message: 'La date de la suite n’est pas une vraie date et heure.' });
    if ((txt(s.quand) || txt(s.d)) && !txt(s.t)) e.push({ champ: 'suite.t', message: 'La suite : il manque ce qui est prévu (par exemple « Le relevé du nouveau local »).' });
    trop('suite.t', s.t, MAX.suiteT, 'La suite, titre'); trop('suite.d', s.d, MAX.suiteD, 'La suite, détail');
    o.suite = { t: txt(s.t), quand: estQuand(txt(s.quand)) ? txt(s.quand) : '', d: txt(s.d) };
    return e.length ? { ok: false, erreurs: e } : { ok: true, valeur: o };
  }

  /* « mercredi 18 novembre » ; « mercredi 2 décembre, 9 h » ; « … 9 h 30 ». L'année n'est dite que si elle n'est pas celle de `annee`. */
  function jourLisible(jour, annee) {
    if (!estJour(jour)) return '';
    var d = new Date(Date.parse(jour + 'T12:00:00Z')), j = d.getUTCDate();
    return JS[d.getUTCDay()] + ' ' + (j === 1 ? '1er' : j) + ' ' + ML[d.getUTCMonth()] + (annee && +jour.slice(0, 4) !== +annee ? ' ' + jour.slice(0, 4) : '');
  }
  function quandLisible(quand, annee) {
    if (!estQuand(quand)) return '';
    var h = +quand.slice(11, 13), m = +quand.slice(14, 16);
    return jourLisible(quand.slice(0, 10), annee) + ', ' + h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '');
  }
  function m2(n) { return n == null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m²'; }

  var API = { ZONES_VU: ZONES_VU, ZONES_PROPOSE: ZONES_PROPOSE, MAX: MAX, BORNES: BORNES, vide: vide, normaliser: normaliser, verifier: verifier,
    jourLisible: jourLisible, quandLisible: quandLisible, m2: m2, estJour: estJour, estQuand: estQuand };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  racine.PHIRST_LETTRE = API;
})(typeof window !== 'undefined' ? window : globalThis);
