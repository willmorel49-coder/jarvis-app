/* Étude de zone · rendu commun « m1 · Le dossier vivant » (27/11/2026), partagé par JARVIS et Phirst.
   Tout vient de l'étude reçue : aucun chiffre tapé à la main. Tout est sous une racine <div class="em1"> ; aucun écouteur sur document/window
   ne survit à demonter(). Contrat : window.ETUDE_M1 = { VERSION_DONNEES, recoller, degonfler, pret, monter }. */
(function () {
'use strict';
var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
var VERSION_DONNEES = '2026-11-27'; // dossier daté des fichiers en ligne, lu par les deux apps

/* ================= purs (aussi pour node) ================= */
/* Remet chaque ligne de « sommes » à sa place : mêmes règles que decouper.recoller (tri : longueur du chemin, puis position). */
function recoller(sans, sommes) {
  var e = JSON.parse(JSON.stringify(sans));
  (sommes || []).slice().sort(function (a, b) { return (a.chemin.length - b.chemin.length) || (a.position - b.position); }).forEach(function (r) {
    var parent = e, i;
    for (i = 0; i < r.chemin.length - 1; i++) parent = parent[r.chemin[i]];
    var cle = r.chemin[r.chemin.length - 1], val = JSON.parse(JSON.stringify(r.valeur));
    if (r.type === 'remplace') { parent[cle] = val; return; }
    if (Array.isArray(parent)) { parent.splice(r.position, 0, val); return; }
    var items = Object.entries(parent);
    items.splice(r.position, 0, [cle, val]);
    Object.keys(parent).forEach(function (k) { delete parent[k]; });
    items.forEach(function (kv) { parent[kv[0]] = kv[1]; });
  });
  return e;
}
/* ArrayBuffer d'un .json.gz -> objet */
function degonfler(buf) {
  var flux = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(flux).text().then(function (t) { return JSON.parse(t); });
}

/* ================= chargement des ressources (navigateur) ================= */
var attente = null, pretOk = null;
function dossier() { return SCRIPT ? SCRIPT.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : ''; }
/* le ?v= de l'adresse du module, repris pour sa feuille : sans lui, Safari garderait l'ancienne feuille après une mise en ligne */
function jeton() { var m = /\?[^#]*/.exec(SCRIPT); return m ? m[0] : ''; }
function ajouter(tag, attrs) {
  return new Promise(function (ok, ko) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; });
    el.onload = function () { ok(true); }; el.onerror = function () { ko(new Error(attrs.href || attrs.src)); };
    document.head.appendChild(el);
  });
}
function chargerLeaflet() {
  if (window.L) return Promise.resolve(true);
  if (window.PHIRST_LEAFLET) return new Promise(function (ok) { window.PHIRST_LEAFLET(function (b) { ok(b !== false && !!window.L); }); });
  var d = dossier() + '../../crm/v2/vendor/leaflet/';
  return ajouter('link', { rel: 'stylesheet', href: d + 'leaflet.css' }).then(function () { return ajouter('script', { src: d + 'leaflet.js' }); }).then(function () { return !!window.L; });
}
function pret(cb) {
  if (pretOk === true) return cb(true);
  if (attente) { attente.push(cb); return; }
  attente = [cb];
  var fini = function (ok) { var a = attente; attente = null; if (ok) pretOk = true; a.forEach(function (f) { try { f(ok); } catch (e) { console.error(e); } }); };
  var d = dossier();
  var css = document.querySelector('link[data-em1-css]') ? Promise.resolve(true) : ajouter('link', { rel: 'stylesheet', href: d + 'phirst-etude-m1.css' + jeton(), 'data-em1-css': '1' });
  var chart = window.Chart ? Promise.resolve(true) : ajouter('script', { src: d + '../../crm/v2/vendor/chart/chart.umd.min.js' }).then(function () { return !!window.Chart; });
  var coupe = setTimeout(function () { fini(false); }, 20000);
  Promise.all([css, chart, chargerLeaflet()]).then(function (r) { clearTimeout(coupe); fini(r.every(Boolean)); }, function (e) { clearTimeout(coupe); console.warn('ETUDE_M1.pret :', e && e.message); fini(false); });
}

/* ================= le rendu ================= */
function monter(hote, etude, opts) {
  opts = opts || {};
  var doc = hote.ownerDocument, win = doc.defaultView;
  var vue = opts.vue === 'telepro' || opts.vue === 'jarvis' ? opts.vue : 'yann';
  var E = etude, ZS = ['5', '10', '15'];
  var S = { z: '10', nbV: 8, fiche: null, ancre: null, last: {} };
  var vivant = true, charts = [], figs = [], io = null, map = null, calques = {}, voisinesLayer = null, pin = null, lienSim = null, vmarks = {}, ecout = [];
  var tel = vue === 'telepro', jar = vue === 'jarvis';
  var R = doc.createElement('div'); R.className = 'em1'; R.setAttribute('data-vue', vue); R.setAttribute('data-zone', S.z);
  var defile = opts.defile || doc.scrollingElement || doc.documentElement;
  var defileEstPage = defile === doc.scrollingElement || defile === doc.documentElement;
  var reduit = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || R).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || R).querySelectorAll(s)); };
  var NBSP = '\u00a0'; // espace insécable écrite en clair : la vraie avait été perdue à la fabrication (montants coupés à l'impression, 28/11)
  var mobile = function () { return win.matchMedia('(max-width:1099px)').matches; };
  function sur(cible, type, fn, o) { cible.addEventListener(type, fn, o); ecout.push([cible, type, fn, o]); }

  /* ---------- formats ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var decs = function (x) { var s = String(Math.round(x * 100) / 100), i = s.indexOf('.'); return i < 0 ? 0 : Math.min(2, s.length - i - 1); };
  var nb = function (x, d) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace(/[\u00a0\u202f]/g, NBSP); };
  var fmtNum = function (x, unit) { var a = Math.abs(x), d; if (Number.isInteger(x) || a >= 100) d = 0; else if (unit && unit.includes('%')) d = 1; else d = Math.min(2, decs(x)); return nb(x, d); };
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var dateFr = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[3] === 1 ? '1er' : +m[3]) + ' ' + MOIS[+m[2] - 1] + ' ' + m[1] : String(s || ''); };
  var ZONAGE = function (s) { return /ZIP/.test(s) ? 'Zone d\'intervention prioritaire' : /ZAC/.test(s) ? 'Zone d\'action complémentaire' : /HZ/.test(s) ? 'Hors zone' : s; };
  function fmtVal(x, unit) {
    if (x == null) return 'inconnu';
    if (typeof x === 'string') return unit === 'zonage' ? ZONAGE(x) : unit === 'date' ? dateFr(x) : x === 'descend' ? 'à la baisse' : x === 'monte' ? 'à la hausse' : x + (unit ? NBSP + unit : '');
    switch (unit) {
      case '%': return fmtNum(x, '%') + NBSP + '%';
      case '% par an': return fmtNum(x, '%') + NBSP + '% par an';
      case '€': return nb(Math.round(x), 0) + NBSP + '€';
      case '€ par mois': return nb(Math.round(x), 0) + NBSP + '€ par mois';
      case 'm': return x >= 1000 ? nb(x / 1000, 1) + NBSP + 'km' : nb(x, 0) + NBSP + 'm';
      case 'part (0 à 1)': return fmtNum(x * 100, '%') + NBSP + '%';
      case 'rang': case 'zonage': case 'date': return nb(x, 0);
      default: return fmtNum(x) + (unit ? NBSP + unit : '');
    }
  }
  /* texte sûr pour la vue courante : la téléprospectrice ne voit jamais un montant (mots entiers : « Europe », « neurologue » restent) */
  var RE_REEL = /€|(?<![A-Za-zÀ-ÿ])euros?(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])millions?(?![A-Za-zÀ-ÿ])/i;
  var tx = function (s) {
    if (s == null) return ''; s = String(s).trim();
    if (!s || s === 'null' || s === 'undefined') return '';
    if (tel && RE_REEL.test(s)) return '';
    return s.replace(/\s*\(c'est une somme[^)]*\)/, '');
  };
  var PETITS = /^(de|du|des|la|le|les|l|d|et|en|sur|sous|aux|au|a)$/i;
  var tc = function (s) { s = String(s || ''); if (/[a-zàéèê]/.test(s)) return s; return s.toLowerCase().replace(/\p{L}+/gu, function (w, i) { return /^(sarl|selarl|selas|sas|eurl|scp)$/i.test(w) ? w.toUpperCase() : PETITS.test(w) && i ? w : w.charAt(0).toUpperCase() + w.slice(1); }); };
  var nomSur = function (s) { return tx(tc(s)) || tc(s); };
  var court = function (n) { return n.replace(/^Pharmacie\s+(du |de la |de l'|des |de |d')?/i, '').trim() || n; };
  var horaires = function (t) { return !t ? '' : t.replace(/Mo/g, 'lun.').replace(/Tu/g, 'mar.').replace(/We/g, 'mer.').replace(/Th/g, 'jeu.').replace(/Fr/g, 'ven.').replace(/Sa/g, 'sam.').replace(/Su/g, 'dim.').replace(/(\d{2}):(\d{2})/g, function (m, h, mi) { return (+h) + NBSP + 'h' + (mi === '00' ? '' : NBSP + mi); }).replace(/\+/g, ' ou plus tard').replace(/;/g, ' ·'); };
  var pl = function (n, mot) { return nb(n, 0) + NBSP + mot + (Math.abs(n) >= 2 ? 's' : ''); };
  var equipeTxt = function (e) { return pl(e.titulaires, 'titulaire') + ', ' + (e.adjoints ? pl(e.adjoints, 'adjoint') : 'aucun adjoint'); };
  var cnt = function (x, unit, key) { return '<span class="em1-cnt" data-v="' + x + '" data-u="' + esc(unit || '') + '" data-k="' + esc(key) + '">' + esc(fmtVal(x, unit)) + '</span>'; };
  var cv = function (n) { return win.getComputedStyle(R).getPropertyValue(n).trim(); };
  var mix = function (hex, t) { var h = hex.replace('#', ''), c = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); return '#' + c.map(function (v) { return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); }).join(''); };

  /* ---------- squelette ---------- */
  R.innerHTML = '<div class="em1-reglette"><div class="em1-rg-in">' +
    '<div class="em1-rg-zone"><span class="em1-rg-lib">Zone de trajet en voiture</span><div class="em1-seg" role="group" aria-label="Zone de trajet"><i class="em1-thumb" aria-hidden="true"></i>' +
    ZS.map(function (z) { return '<button type="button" data-z="' + z + '" aria-pressed="' + (z === S.z) + '">' + z + ' min</button>'; }).join('') + '</div></div>' +
    '<p class="em1-rg-hab"></p><nav class="em1-rg-chap" aria-label="Chapitres"></nav>' +
    '<div class="em1-rg-imp" role="group" aria-label="Imprimer"><button type="button" data-imprimer="resume">Imprimer le résumé</button><button type="button" data-imprimer="complet">Imprimer le dossier complet</button></div>' +
    '</div><i class="em1-rg-prog" aria-hidden="true"></i></div>' +
    '<main class="em1-doc"><section class="em1-feuille em1-couv" aria-label="Couverture"></section><div class="em1-integral-hote"></div><div class="em1-chapitres"></div><section class="em1-feuille em1-pied"></section></main>' +
    '<div class="em1-voile" hidden></div><aside class="em1-fiche" role="dialog" aria-modal="false" aria-labelledby="em1-fiche-titre" tabindex="-1" hidden></aside>';
  hote.appendChild(R);
  var pageStyle = doc.createElement('style'); pageStyle.setAttribute('data-em1-page', '1'); pageStyle.textContent = '@page{size:A4;margin:12mm}'; doc.head.appendChild(pageStyle);

  /* ---------- réglette ---------- */
  function haut() { // la barre du calque (si elle est collée en haut) pousse la réglette sous elle
    var b = defile.querySelector && defile.querySelector('.pe-barre'), h = 0;
    if (b) { var p = win.getComputedStyle(b).position; if (p === 'sticky' || p === 'fixed') h = b.offsetHeight; }
    R.style.setProperty('--em1-haut', h + 'px');
  }
  function majHab() {
    var h = E.zones[S.z].chiffres.habitants, el = $('.em1-rg-hab');
    el.innerHTML = '<b>' + cnt(h, '', 'rg-hab') + '</b><span>habitants à moins de ' + S.z + NBSP + 'min</span>';
    if (win.matchMedia('(max-width:640px)').matches) $('b', el).insertAdjacentHTML('beforeend', '<small>habitants à moins de ' + S.z + NBSP + 'min</small>');
  }
  $('.em1-rg-chap').innerHTML = E.reponses.map(function (r, i) { return '<a href="#c-' + esc(r.id) + '" data-i="' + i + '" title="' + esc(r.titre) + '">' + (i + 1) + '</a>'; }).join('');

  /* ---------- couverture ---------- */
  function renderCouv() {
    var m = E.meta;
    $('.em1-couv').innerHTML = '<div class="em1-astre" aria-hidden="true"><i class="em1-an em1-a1"></i><i class="em1-an em1-a2"></i><i class="em1-an em1-a3"></i><i class="em1-horizon"></i></div><div class="em1-faisceau" aria-hidden="true"></div>' +
      '<div class="em1-couv-haut"><div class="em1-couv-g"><div class="em1-entete"><span><b>Étude de zone</b> · ' + esc(m.nom) + ', ' + esc(m.commune) + '</span><span>Calculée le ' + esc(m.date_calcul_etude) + '</span></div>' +
      '<div class="em1-nom" role="heading" aria-level="1">' + esc(m.nom) + '</div><p class="em1-adresse">' + esc(m.adresse) + (m.intercommunalite ? ' · ' + esc(m.intercommunalite) : '') + '</p>' +
      (jar ? '<p class="em1-collab">Étude réalisée en collaboration avec Phirst</p>' : '') +
      '<div class="em1-resume">' + E.resume.map(function (p) { return tx(p) ? '<p>' + esc(tx(p)) + '</p>' : ''; }).join('') + '</div></div>' +
      '<div class="em1-couv-d"><div class="em1-carte-cadre"><div class="em1-carte" aria-label="Carte des zones de trajet et des pharmacies voisines"></div></div>' +
      '<div class="legende">' + ZS.map(function (z) { return '<button type="button" class="lz" data-zl="' + z + '" data-sel="' + (z === S.z) + '" style="--c:var(--z' + z + ')"><i></i>' + z + ' min en voiture</button>'; }).join('') +
      '<span class="lz"><i style="--c:var(--marque);border-radius:50%"></i>Pharmacies voisines</span><span class="em1-src">Temps de trajet : IGN Géoplateforme, calculé le ' + esc(m.date_calcul_etude) + ' · Fond de carte : Plan IGN · Pharmacies : ministère de la Santé (FINESS)</span></div></div></div>' +
      '<div class="em1-couv-bas"></div>';
    renderCouvBas();
    var ih = $('.em1-integral-hote');
    ih.innerHTML = jar && opts.chezIntegral ? '<section class="em1-feuille em1-integral">' + opts.chezIntegral + '</section>' : '';
  }
  function renderCouvBas() {
    var c = E.zones[S.z].chiffres;
    var hp = c.pharmacies_finess ? Math.round(c.habitants / c.pharmacies_finess) : null;
    var cles = [[c.habitants, 'hab', 'habitants à moins de ' + S.z + ' minutes', 'INSEE, Filosofi · 2021'], [c.pharmacies_finess, 'pharmacies', 'pharmacies à moins de ' + S.z + ' minutes, celle-ci comprise', 'ministère de la Santé, FINESS'], [hp, 'hab', 'habitants par pharmacie dans cette zone', 'calcul : habitants divisés par pharmacies']];
    var ind = E.reperes.indicateurs.filter(function (i) { var m = /_(5|10|15)$/.exec(i.cle); return !m || m[1] === S.z; });
    var cl = E.reperes.classe;
    $('.em1-couv-bas').innerHTML = '<div class="em1-cles">' + cles.map(function (x, i) { return '<div class="em1-cle"><span class="em1-v">' + (x[0] == null ? 'inconnu' : cnt(x[0], '', 'cle' + i)) + '</span><span><span class="em1-l">' + esc(x[2]) + '</span><span class="em1-src">' + esc(x[3]) + '</span></span></div>'; }).join('') + '</div>' +
      '<div class="em1-rep-t"><h2>Où vous situez-vous en France ?</h2><p class="em1-ecran">Le point glisse sur l\'échelle des pharmacies étudiées.</p></div>' +
      '<div class="em1-reperes">' + ind.map(repHTML).join('') + '</div>' +
      '<p class="em1-rep-leg"><i style="background:var(--acc)"></i>Votre pharmacie, parmi toutes les pharmacies étudiées' + (cl && cl.nom ? ' <i style="border:2px solid var(--ink3);margin-left:14px"></i>Parmi les pharmacies des ' + esc(cl.nom) : '') + '.</p>';
  }
  function repHTML(i) {
    var raison = tx(i.raison), unit = i.unite;
    var val = i.valeur == null ? 'inconnu' : (/hab/.test(unit || '') && !/\//.test(unit) ? nb(Math.round(i.valeur), 0) + NBSP + unit : fmtVal(i.valeur, unit));
    var x = i.centile_national, xc = i.centile_classe;
    var piste = x == null ? '<div class="em1-piste"></div>' : '<div class="em1-piste" style="--x:' + x + '%;--xc:' + (xc == null ? x : xc) + '%">' + [25, 50, 75].map(function (t) { return '<i class="em1-tk" style="left:' + t + '%"></i><span class="em1-tkl" style="left:' + t + '%;top:17px">' + t + '</span>'; }).join('') + (xc != null ? '<i class="em1-pc"></i>' : '') + '<i class="em1-pt"></i></div>';
    return '<div class="em1-rep"><div class="em1-rl">' + esc(tx(i.libelle)) + '</div>' + piste + '<div class="em1-rv"><b>' + esc(val) + '</b>' + esc(x == null ? (raison || 'inconnu') : tx(i.phrase)) + '</div></div>';
  }

  /* ---------- blocs ---------- */
  var valeurs = function (b) { return (b.valeurs || []).filter(function (v) { return !(tel && v.somme); }); };
  var val = function (b, id) { return (b.valeurs || []).find(function (v) { return v.id === id; }); };
  var LIB = { ehpad_pa: 'EHPAD et résidences pour personnes âgées' };
  var libelle = function (v) { return LIB[v.libelle] || (/^[a-z_]+$/.test(v.libelle) ? v.libelle.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }) : v.libelle); };

  /* C4 (28/11/2026) : un chiffre qui suit la zone choisie dit sa zone, sinon il paraît contredire la zone naturelle. */
  var avecZone = function (lib) { var z = 'à moins de ' + S.z + NBSP + 'min'; return / par zone( de trajet)?$/.test(lib) ? lib.replace(/ par zone( de trajet)?$/, ' ' + z) : / de la zone par /.test(lib) ? lib.replace(' de la zone ', ' ' + z + ', ') : lib + ' (' + z + ')'; };
  function rowHTML(v, b) {
    var lib = esc(tx(libelle(v)));
    if (v.par_zone) lib = avecZone(lib);
    if (v.id === 'parc_connu') return '<div class="em1-val em1-question"><div class="em1-vl"><b>Question au pharmacien :</b> avez-vous déjà un robot de dispensation ?<small>« Absente du parc connu » ne veut pas dire « sans robot » : le parc connu est incomplet.</small></div></div>';
    if (v.id === 'sief_detail') return '';
    if (v.par_rayon) return '';
    if (v.par_zone && v.par_zone[S.z] && typeof v.par_zone[S.z] === 'object') return '<div class="em1-val"><div class="em1-vl">' + lib + '</div><div class="em1-vv em1-txt">' + Object.entries(v.par_zone[S.z]).map(function (kp) { return esc(ZONAGE(kp[0])) + ' : ' + nb(kp[1] * 100, 0) + NBSP + '%'; }).join(', ') + '</div></div>';
    var x = v.par_zone ? v.par_zone[S.z] : v.valeur;
    var note = /_|\[\]|\bnull\b/.test(v.note || '') ? '' : tx(v.note);
    if (x == null) return '<div class="em1-val em1-inc"><div class="em1-vl">' + lib + (v.raison ? '<small>' + esc(tx(v.raison)) + '</small>' : '') + '</div><div class="em1-vv">' + esc(tx(v.absence) || 'inconnu') + '</div></div>';
    var nombre = typeof x === 'number' && v.unite !== 'date' && v.unite !== 'zonage';
    var aff = nombre ? cnt(x, v.unite, b.id + '.' + v.id) : esc(fmtVal(x, v.unite));
    var tag = v.declenche ? ' <span class="em1-tag em1-q">à pousser</span>' : '';
    var phrase = typeof x === 'string' && x.length > 40;
    var long = nombre && (v.unite || '').length > 12 || phrase;
    return '<div class="em1-val' + (v.declenche ? ' em1-dec' : '') + (long ? ' em1-long' : '') + (phrase ? ' em1-lphrase' : '') + '"><div class="em1-vl">' + lib + tag + (note ? '<small>' + esc(note) + '</small>' : '') + '</div><div class="em1-vv' + (nombre ? '' : ' em1-txt') + (phrase ? ' em1-phrase' : '') + '">' + aff + '</div></div>';
  }
  function tableRayons(b) {
    var L = valeurs(b).filter(function (v) { return v.par_rayon; }); if (!L.length) return '';
    var rs = Array.from(new Set(L.flatMap(function (v) { return Object.keys(v.par_rayon); }))).sort(function (a, c) { return a - c; });
    var u = function (r) { return r >= 1000 ? (r / 1000) + ' km' : r + ' m'; };
    return '<table class="em1-tab"><thead><tr><th></th>' + rs.map(function (r) { return '<th>à ' + u(+r) + '</th>'; }).join('') + '</tr></thead><tbody>' + L.map(function (v) { return '<tr><td>' + esc(tx(libelle(v))) + '</td>' + rs.map(function (r) { return '<td>' + (v.par_rayon[r] == null ? '–' : cnt(v.par_rayon[r], '', b.id + '.' + v.id + '.' + r)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  var srcLine = function (b) { var s = Array.from(new Set(valeurs(b).map(function (v) { return v.source ? tx(v.source) + (v.millesime ? ' · ' + tx(v.millesime) : '') : ''; }).filter(Boolean))); return s.length ? '<p class="em1-srcb">Source : ' + esc(s.join(' ; ')) + '</p>' : ''; };

  function voisinesListe() {
    var L = E.pharmacies.filter(function (p) { return +p.zone_min <= +S.z; }).sort(function (a, c) { return a.distance_km - c.distance_km; });
    if (!L.length) return '<p class="em1-srcb">Aucune pharmacie voisine à moins de ' + S.z + ' minutes.</p>';
    var rows = L.slice(0, S.nbV).map(function (p) { return '<li><button type="button" class="em1-vrow" data-voisine="' + esc(p.finess) + '"><span class="em1-vn">' + esc(nomSur(p.nom)) + '</span><span class="em1-vm">' + esc(tc(p.commune)) + ' · ' + nb(p.distance_km, 1) + NBSP + 'km · ' + p.zone_min + NBSP + 'min</span><span class="em1-vt">' + (p.a_surveiller ? 'À surveiller' : '') + '</span><i class="em1-go" aria-hidden="true">›</i></button></li>'; }).join('');
    var reste = L.length - S.nbV;
    return '<div class="em1-voisines"><h4>Les ' + L.length + ' pharmacies voisines à moins de ' + S.z + ' minutes</h4><p class="em1-srcb" style="margin:0 0 8px"><span class="em1-ecran">Touchez une ligne : sa fiche s\'ouvre dans la marge. </span>« À surveiller » : titulaire de 60 ans et plus, exerçant seul.</p><ul class="em1-vlist">' + rows + '</ul>' + (reste > 0 ? '<button type="button" class="em1-plus" data-plus>Voir ' + Math.min(20, reste) + ' de plus (' + reste + ' restantes)</button>' : '') + '</div>';
  }
  function siefListe(b) {
    var d = (val(b, 'sief_detail') || {}).detail || []; if (!d.length) return '';
    return '<div class="em1-voisines"><h4>Vers qui iraient ces habitants</h4><ul class="em1-vlist">' + d.slice(0, 6).map(function (x) { return '<li><button type="button" class="em1-vrow" data-voisine="' + esc(x.finess) + '"><span class="em1-vn">' + esc(nomSur(x.nom)) + '</span><span class="em1-vm">' + cnt(x.habitants, 'habitants', 'sief.' + x.finess) + ' · ' + nb(x.part_pct, 1) + NBSP + '% de votre zone naturelle</span><i class="em1-go" aria-hidden="true">›</i></button></li>'; }).join('') + '</ul></div>';
  }
  function comptesHTML() {
    var x = E.exploitant, cs = x.comptes || [];
    var h = '<h3>Votre exploitant actuel</h3><div class="em1-vals">';
    var ligne = function (l, v) { return v ? '<div class="em1-val"><div class="em1-vl">' + esc(l) + '</div><div class="em1-vv em1-txt">' + esc(v) + '</div></div>' : ''; };
    h += ligne('Société', tx(x.denomination) + (x.forme_juridique ? ' · ' + x.forme_juridique : ''));
    h += ligne('Société créée le', x.creation_societe ? dateFr(x.creation_societe) : '');
    h += ligne('Dirigeant', (x.dirigeants || []).map(function (d) { return d.qualite + (d.age ? ', ' + d.age + NBSP + 'ans' : ''); }).join(' ; '));
    h += ligne('Effectif', x.effectif ? x.effectif.tranche + ' (' + x.effectif.annee + ')' : 'inconnu' + (x.effectif_raison ? ' : ' + tx(x.effectif_raison) : ''));
    h += ligne('Équipe', x.equipe ? equipeTxt(x.equipe) : '');
    if (x.transmission) h += '<div class="em1-val em1-long em1-lphrase"><div class="em1-vl">Transmission</div><div class="em1-vv em1-txt em1-phrase">' + esc(tx(x.transmission.texte)) + '</div></div>';
    h += '</div>';
    if (x.transmission && (jar || tel)) h += '<p class="em1-notice em1-ecran"><b>À surveiller (JARVIS, non imprimé).</b> ' + esc(tx(x.transmission.interne)) + '</p>';
    if (x.perime_dans_l_etude_actuelle) h += '<p class="em1-notice"><b>Attention, exploitant à vérifier.</b> L\'exploitant actuel est ' + esc(tx(x.denomination)) + ' ; les chiffres lus à l\'annuaire sont ceux de l\'ancienne société.</p>';
    if (!cs.length) return h + '<div class="em1-etat"><span><b>Comptes : inconnus.</b> ' + esc(tx(x.comptes_raison) || 'aucun exercice lisible') + '</span></div>';
    var duree = function (i) { if (i + 1 >= cs.length) return 0; var m = Math.round((Date.parse(cs[i].cloture) - Date.parse(cs[i + 1].cloture)) / 864e5 / 30.44); return m > 0 && m < 12 ? m : 0; };
    var cols = [['Clôture', function (c, i) { var m = duree(i); return dateFr(c.cloture) + (m ? ' (exercice de ' + m + NBSP + 'mois)' : ''); }]];
    if (!tel) cols.push(["Chiffre d'affaires", function (c) { return c.ca && c.ca.valeur != null ? fmtVal(c.ca.valeur, '€') : 'inconnu'; }], ['Résultat net', function (c) { return c.resultat_net && c.resultat_net.valeur != null ? fmtVal(c.resultat_net.valeur, '€') : 'inconnu'; }]);
    cols.push(['Endettement', function (c) { return c.taux_endettement_pct == null ? 'inconnu' : fmtVal(c.taux_endettement_pct, '%'); }], ['Autonomie financière', function (c) { return c.autonomie_financiere_pct == null ? 'inconnu' : fmtVal(c.autonomie_financiere_pct, '%'); }]);
    return h + '<h3 style="margin-top:22px">Exercices lisibles</h3><div class="em1-defile-x"><table class="em1-tab em1-ex"><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + cs.map(function (c, i) { return '<tr>' + cols.map(function (k) { return '<td>' + esc(k[1](c, i)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  /* Ne pas couper « L5125-6-1 » ni « 2 000 » en fin de ligne (texte déjà échappé). */
  var insec = function (s) { return s.replace(/(L\.? ?\d{4}-[\d-]*\d)/g, '<span class="em1-nw">$1</span>').replace(/(\d) (\d{3})(?!\d)/g, '$1 $2').replace(/(\d) (%|km|m)(?![a-zà-ÿ])/g, '$1 $2'); };
  function loiHTML(b) {
    if (!b.citations || !b.citations.length) return '';
    var arts = b.citations.map(function (c) { return '<div class="em1-art"><h4>Article ' + esc(c.article) + ' <span>version en vigueur depuis le ' + esc(c.version) + '</span></h4>' + c.alineas.map(function (a) { return '<p class="em1-cite">' + esc(a) + '</p>'; }).join('') + '<p class="em1-srcb">' + esc(tx(c.modifie_par)) + ' · <a href="' + esc(/^https:\/\//.test(c.url_legifrance || '') ? c.url_legifrance : '#') + '" target="_blank" rel="noopener">texte sur Légifrance</a></p></div>'; }).join('');
    var lec = b.lecture && b.lecture.length ? '<div class="em1-lecture"><h4>' + esc(tx(b.lecture_titre) || 'En clair') + '</h4><ul>' + b.lecture.map(function (l) { return '<li>' + insec(esc(l)) + '</li>'; }).join('') + '</ul></div>' : '';
    return lec + '<div class="em1-loi">' + arts + '</div>';
  }
  function malDessHTML(b) {
    if (b.id !== 'zones_mal_desservies' || !b.communes) return '';
    var h = '';
    if (b.communes.length) h += '<h4 class="em1-md-t">Communes de la zone sans pharmacie ou avec une place ouverte</h4><table class="em1-tab em1-md"><thead><tr><th class="em1-txt">Commune</th><th>Habitants</th><th>Zone</th><th class="em1-txt">Situation</th></tr></thead><tbody>' + b.communes.map(function (c) { return '<tr><td class="em1-txt">' + esc(c.nom) + (c.est_commune_etudiee ? ' (votre commune)' : '') + '</td><td>' + nb(c.population, 0) + '</td><td>' + c.zone_min + NBSP + 'min</td><td class="em1-txt">' + esc(c.etat) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (b.poches && b.poches.length) h += '<h4 class="em1-md-t">Où vivent les habitants loin de toute pharmacie</h4><table class="em1-tab em1-md"><thead><tr><th class="em1-txt">Leur pharmacie la plus proche</th><th>Habitants</th><th class="em1-txt">Du côté de</th><th>Distance moyenne</th></tr></thead><tbody>' + b.poches.map(function (x) { return '<tr><td class="em1-txt">' + (x.est_etudiee ? 'Vous' : esc(nomSur(x.nom || ''))) + '</td><td>' + nb(x.habitants, 0) + '</td><td class="em1-txt">' + esc(x.vers_commune || 'inconnu') + '</td><td>' + nb(x.distance_moyenne_m / 1000, 1) + NBSP + 'km</td></tr>'; }).join('') + '</tbody></table>';
    return h;
  }
  function blocHTML(r, b) {
    var main = '<h3>' + esc(tx(b.titre)) + '</h3>', etat = '';
    if (b.etat === 'a_venir' || b.etat === 'provisoire') etat = '<div class="em1-etat"><span><b>' + (b.etat === 'a_venir' ? 'Calcul à venir.' : 'Règle provisoire.') + '</b> ' + (b.etat === 'a_venir' ? 'Ce calcul n\'est pas encore fait : aucun chiffre n\'est affiché.' : 'Une seule règle est écrite (l\'âge) ; aucun profil n\'est inventé en attendant les autres.') + '</span></div>';
    else if (b.etat === 'renvoi') { var t = b.renvoi_vers && E.reponses.find(function (x) { return x.id === b.renvoi_vers; }); etat = '<p class="em1-renvoi">' + (t ? 'Voir le chapitre <a href="#c-' + t.id + '">' + (E.reponses.indexOf(t) + 1) + ' · ' + esc(t.titre) + '</a>.' : 'Voir le chapitre qui traite de ce sujet.') + '</p>'; }
    if (b.id === 'achat_fonds') main = comptesHTML() + '<div style="height:22px"></div>' + main;
    if (b.id === 'zones_mal_desservies' && b.phrase) etat = '<p class="em1-phrase-b">' + insec(esc(tx(b.phrase))) + '</p>' + etat;
    var vs = valeurs(b).map(function (v) { return rowHTML(v, b); }).join('');
    main += etat + (vs.trim() ? '<div class="em1-vals">' + vs + '</div>' : '') + tableRayons(b);
    if (b.id === 'concurrentes') main += voisinesListe();
    if (b.id === 'si_elle_fermait') main += siefListe(b);
    main += loiHTML(b) + malDessHTML(b) + srcLine(b);
    var fg = FIG[b.id] ? FIG[b.id](b) : '';
    return '<section class="em1-bloc" data-bloc="' + esc(b.id) + '"><div class="em1-p-main">' + main + '</div><div class="em1-p-marge"><p class="em1-note-t">Pourquoi ce bloc</p><p class="em1-pourquoi">' + esc(tx(b.pourquoi)) + '</p>' + fg + '</div></section>';
  }

  /* ---------- figures (graphiques Chart.js ou réglettes) ---------- */
  function chartFig(titre, build, h) { var id = 'cv' + figs.length; figs.push({ id: id, build: build }); return '<figure class="em1-fig"><figcaption>' + esc(titre) + '</figcaption><div class="em1-cv' + (h ? ' em1-h' : '') + '"><canvas data-fid="' + id + '" role="img" aria-label="' + esc(titre) + '"></canvas></div></figure>'; }
  var hi = function (arr, c) { return arr.map(function (_, i) { return i === ZS.indexOf(S.z) ? c : mix(c, .55); }); };
  function barre(o) {
    return function () {
      return { type: 'bar', data: { labels: o.labels, datasets: o.sets.map(function (s, i) { return { label: s.label, data: s.data, backgroundColor: o.hiZone ? hi(s.data, cv('--g' + (i + 1))) : cv('--g' + (s.c || i + 1)), borderRadius: 3, maxBarThickness: o.horiz ? 22 : 34 }; }).concat(o.ligne ? [{ type: 'line', label: o.ligne.label, data: o.labels.map(function () { return o.ligne.v; }), borderColor: cv('--ink'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }] : []) },
        options: { indexAxis: o.horiz ? 'y' : 'x', plugins: { legend: { display: !!o.legend, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } }, valeurs: { fmt: o.fmt || function (v) { return nb(v, decs(v)); } } }, scales: { x: { grid: { display: false }, beginAtZero: true, grace: o.horiz ? '28%' : 0, ticks: { display: !o.horiz } }, y: { grid: { color: cv('--fil2') }, border: { display: false }, beginAtZero: true, grace: o.horiz ? 0 : '14%', ticks: { display: !o.horiz, maxTicksLimit: 4 } } } } };
    };
  }
  var ZL = ['5 min', '10 min', '15 min'];
  var FIG = {
    ages: function (b) { return chartFig('Âges selon la zone (part, en %)', barre({ labels: ZL, hiZone: true, legend: true, fmt: function (v) { return nb(v, 1); }, sets: [['part_0_17', '0 à 17 ans'], ['part_65_plus', '65 ans et plus'], ['part_80_plus', '80 ans et plus']].map(function (p) { return { label: p[1], data: ZS.map(function (z) { return val(b, p[0]).par_zone[z]; }) }; }) })); },
    revenus: function (b) { return chartFig('Ménages sous le seuil de pauvreté (%)', barre({ labels: ZL, hiZone: true, fmt: function (v) { return nb(v, 1); }, sets: [{ label: 'Ménages pauvres', data: ZS.map(function (z) { return val(b, 'menages_pauvres').par_zone[z]; }) }] }), true); },
    aines_seuls: function (b) { var p = val(b, 'part_80_seuls'); if (!p || p.valeur == null) return ''; return chartFig('Ménages de 80 ans et plus qui vivent seuls', function () { return { type: 'doughnut', data: { labels: ['Vivent seuls', 'Autres'], datasets: [{ data: [p.valeur, 100 - p.valeur], backgroundColor: [cv('--g1'), mix(cv('--g1'), .8)], borderWidth: 0 }] }, options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } }, centre: { t: nb(p.valeur, 1) + ' %' } } } }; }); },
    actifs_passage: function (b) { return chartFig('Emplois et actifs de la commune', barre({ horiz: true, labels: ['Emplois sur place', 'Y habitent aussi', 'Entrants estimés'], sets: [{ label: 'Actifs', data: ['emplois', 'actifs_sur_place', 'entrants'].map(function (i) { return (val(b, i) || {}).valeur; }), c: 1 }] }), true); },
    zone_naturelle: function (b) { var r = (val(b, 'zn_rang') || {}).valeur, n = E.pharmacies.length + 1; if (r == null) return ''; var x = n > 1 ? (r - 1) / (n - 1) * 100 : 0; return '<figure class="em1-fig"><figcaption>Votre rang parmi les ' + n + ' pharmacies à moins de 15 minutes</figcaption><div class="em1-rail" style="--x:' + x + '%"><span class="em1-rb" style="left:0">1</span><span class="em1-rb" style="left:100%">' + n + '</span><i class="em1-rt" style="left:0"></i><i class="em1-rt" style="left:100%"></i><i class="em1-rp"></i></div><p class="em1-fig-note">Rang ' + r + ' : 1 est la pharmacie qui compte le plus d\'habitants autour d\'elle.</p></figure>'; },
    si_elle_fermait: function (b) { var d = ((val(b, 'sief_detail') || {}).detail || []).slice(0, 6); if (!d.length) return ''; return chartFig('Habitants reportés, par pharmacie voisine', barre({ horiz: true, labels: d.map(function (x) { return court(nomSur(x.nom)).slice(0, 26); }), sets: [{ label: 'Habitants', data: d.map(function (x) { return x.habitants; }), c: 1 }], fmt: function (v) { return nb(v, 0); } })); },
    prescripteurs: function (b) { var ids = [['presc_gen', 'Généralistes'], ['presc_spe', 'Spécialistes'], ['presc_dent', 'Dentistes'], ['presc_sf', 'Sages-femmes']].filter(function (p) { return val(b, p[0]) && val(b, p[0]).par_rayon; }); if (!ids.length) return ''; return chartFig('Prescripteurs autour de la porte', barre({ labels: ids.map(function (i) { return i[1]; }), legend: true, fmt: function (v) { return nb(v, 0); }, sets: ['100', '300'].map(function (r) { return { label: 'à ' + r + ' m', data: ids.map(function (p) { return val(b, p[0]).par_rayon[r]; }) }; }) })); },
    msp_cs: function (b) { var m = val(b, 'msp_nb'), c = val(b, 'cs_nb'); if (!m || !m.par_zone) return ''; return chartFig('Maisons et centres de santé, par zone', barre({ labels: ZL, hiZone: false, legend: true, fmt: function (v) { return nb(v, 0); }, sets: [{ label: 'Maisons de santé', data: ZS.map(function (z) { return m.par_zone[z]; }) }, { label: 'Centres de santé', data: ZS.map(function (z) { return c.par_zone[z]; }) }] })); },
    logements_autorises: function () { var L = E.zones[S.z].logements, ys = Object.keys(L).sort(); return chartFig('Logements autorisés et commencés, zone de ' + S.z + ' min', barre({ labels: ys, legend: true, fmt: function (v) { return nb(v, 0); }, sets: [{ label: 'Autorisés', data: ys.map(function (y) { return L[y].autorises; }) }, { label: 'Commencés', data: ys.map(function (y) { return L[y].commences; }) }] })); },
    quorum: function (b) {
      var g = function (id) { return (val(b, id) || {}).valeur; }, p15 = g('q_pop15'), p23 = g('q_pop23'), tx_ = g('q_taux'), bo = g('q_borne'), sd = g('q_dessous'); if (p23 == null) return '';
      var ys = ['2015', '2023', '2031'], tend = tx_ == null ? null : Math.round(p23 * Math.pow(1 + tx_ / 100, 8));
      return chartFig('Population de la commune et seuil du quorum', function () { return { type: 'line', data: { labels: ys, datasets: [{ label: 'Population connue', data: [p15, p23, null], borderColor: cv('--g1'), backgroundColor: cv('--g1'), borderWidth: 3, pointRadius: 5, tension: .25 }, { label: 'Tendance prolongée', data: [null, p23, tend], borderColor: cv('--g2'), borderDash: [6, 4], borderWidth: 2, pointRadius: 4, tension: .25 }].concat(bo != null ? [{ label: 'Borne haute (logements autorisés)', data: [null, p23, bo], borderColor: cv('--g3'), borderDash: [2, 4], borderWidth: 2, pointRadius: 4 }] : [], sd != null ? [{ label: 'Seuil du dessous (' + nb(sd, 0) + ')', data: ys.map(function () { return sd; }), borderColor: cv('--ink'), borderWidth: 1.5, pointRadius: 0 }] : []) }, options: { plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } } }, scales: { y: { grid: { color: cv('--fil2') }, border: { display: false }, ticks: { maxTicksLimit: 5 } }, x: { grid: { display: false } } } } }; });
    },
    concurrentes: function () {
      var z = +S.z, L = E.pharmacies.filter(function (p) { return +p.zone_min <= z; });
      var B = [[0, 1, 'moins de 1 km'], [1, 2, '1 à 2 km'], [2, 3, '2 à 3 km'], [3, 5, '3 à 5 km'], [5, 1e9, '5 km et plus']].filter(function (x) { return L.some(function (p) { return p.distance_km >= x[0] && p.distance_km < x[1]; }); }); if (!B.length) return '';
      return chartFig('Pharmacies voisines selon la distance (zone de ' + S.z + ' min)', barre({ labels: B.map(function (x) { return x[2]; }), fmt: function (v) { return nb(v, 0); }, sets: [{ label: 'Pharmacies', data: B.map(function (x) { return L.filter(function (p) { return p.distance_km >= x[0] && p.distance_km < x[1]; }).length; }), c: 1 }] }));
    },
    pda_volume: function (b) { var v = val(b, 'ehpad_places'); if (!v || !v.par_zone) return ''; var sv = E.reponses[4].verdict || {}; return chartFig('Places d\'EHPAD autour de vous', barre({ labels: ZL, hiZone: true, fmt: function (x) { return nb(x, 0); }, sets: [{ label: 'Places', data: ZS.map(function (z) { return v.par_zone[z]; }) }], ligne: sv.seuil_places ? { v: sv.seuil_places, label: 'Plus petit automate de PDA' } : null, legend: !!sv.seuil_places })); },
    capacite_investir: function () {
      var cs = (E.exploitant.comptes || []).filter(function (c) { return c.taux_endettement_pct != null; }).slice().sort(function (a, c) { return a.cloture < c.cloture ? -1 : 1; }); if (!cs.length) return '';
      var ys = cs.map(function (c) { return c.cloture.slice(0, 4); });
      return chartFig('Endettement et autonomie, par exercice (%)', function () { return { type: cs.length > 1 ? 'line' : 'bar', data: { labels: ys, datasets: [{ label: 'Endettement', data: cs.map(function (c) { return c.taux_endettement_pct; }), borderColor: cv('--g1'), backgroundColor: cv('--g1'), borderWidth: 3, pointRadius: 4, tension: .25, maxBarThickness: 40 }, { label: 'Autonomie financière', data: cs.map(function (c) { return c.autonomie_financiere_pct; }), borderColor: cv('--g2'), backgroundColor: cv('--g2'), borderWidth: 3, pointRadius: 4, tension: .25, maxBarThickness: 40 }] }, options: { plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } } }, scales: { y: { grid: { color: cv('--fil2') }, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 4 } }, x: { grid: { display: false } } } } }; });
    },
    robot_roi: function (b) { return espace(b); }, place_regagnee: function (b) { return espace(b); },
    generalistes_60: function (b) { var a = val(b, 'gen60'), c = val(b, 'gen65'); if (!a) return ''; return chartFig('Généralistes libéraux du département (%)', barre({ horiz: true, labels: ['60 ans et plus', '65 ans et plus'], fmt: function (v) { return nb(v, 1); }, sets: [{ label: 'Part', data: [a.valeur, c && c.valeur], c: 1 }] }), true); },
    achat_fonds: function (b) { var d = (val(b, 'fonds_date') || {}).valeur, y = d && +d.slice(0, 4), y0 = +(E.meta.date_calcul_etude || '').slice(-4); if (!y || !y0) return ''; return '<figure class="em1-fig"><div class="em1-gros">' + cnt(y0 - y, 'ans', 'ans-fonds') + '<small>depuis l\'achat du fonds par l\'exploitant actuel (' + dateFr(d) + ')</small></div></figure>'; }
  };
  function espace(b) {
    var L = [['espace_gagne', 'Ont gagné de la place'], ['espace_backoffice', 'Place : back-office'], ['espace_vente', 'Place : espace de vente']].filter(function (p) { return val(b, p[0]) && val(b, p[0]).valeur != null; });
    if (!L.length) return '';
    return chartFig('Place regagnée grâce à une machine (% des répondants)', barre({ horiz: true, labels: L.map(function (l) { return l[1]; }), fmt: function (v) { return nb(v, 1); }, sets: [{ label: 'Part', data: L.map(function (p) { return val(b, p[0]).valeur; }), c: 1 }] }), true);
  }

  /* ---------- chapitres ---------- */
  function headline(r, i) {
    var v = tel && r.verdict_telepro ? r.verdict_telepro : r.verdict;
    if (v && tx(v.texte)) return { t: tx(v.texte), v: v };
    if (i === 1 && E.resume[0]) return { t: tx(E.resume[0]), v: null };
    if (i === 5) { var b = r.blocs.find(function (x) { return x.id === 'achat_fonds'; }), f = b && val(b, 'fonds_date'); return { t: f && f.valeur ? 'Le fonds a été acheté par l\'exploitant actuel le ' + dateFr(f.valeur) + '.' : 'Date d\'achat du fonds : inconnue.', v: null, sub: f && !f.valeur ? tx(f.raison) : '' }; }
    return { t: 'Pas de verdict pour cette pharmacie.', v: null, sub: v && tx(v.raison) };
  }
  function chapitreHTML(r, i) {
    var h = headline(r, i), v = h.v || {};
    var cites = (v.citations || []).filter(function (c) { return tx(c.texte); }).map(function (c) { return '<blockquote class="em1-cite" style="margin:14px 0 0">' + esc(tx(c.texte)) + '<cite>' + esc(c.source) + (c.page ? ', page ' + c.page : '') + '</cite></blockquote>'; }).join('');
    var regle = tx(v.regle) ? '<p class="em1-regle"><b>La règle appliquée.</b> ' + esc(tx(v.regle)) + (v.provisoire ? '<span class="em1-tag">règle provisoire</span>' : '') + (tx(v.source) ? '<span class="em1-srcb" style="display:block">Source : ' + esc(tx(v.source)) + '</span>' : '') + '</p>' : '';
    var reserve = tx(v.reserve) ? '<p class="em1-verdict-sub">' + esc(tx(v.reserve)) + '</p>' : '';
    var avert = tx(v.avertissement) ? '<p class="em1-verdict-sub">' + esc(tx(v.avertissement)) + '</p>' : '';
    var compl = (v.complements || []).filter(function (c) { return tx(c.texte); });
    var complHTML = compl.length ? '<div class="em1-p-main" style="padding-top:8px;padding-bottom:20px"><ul class="em1-compl">' + compl.map(function (c) { return '<li>' + (c.question_au_pharmacien ? '<span class="em1-tag em1-q" style="margin:0 8px 0 0">À demander au pharmacien</span>' : '') + esc(tx(c.texte)) + (c.source && !c.question_au_pharmacien ? '<small>' + esc(c.source) + (c.page ? ', page ' + c.page : '') + '</small>' : '') + '</li>'; }).join('') + '</ul></div><div class="em1-p-marge"></div>' : '';
    var nsp = r.blocs.filter(function (b) { return tx(b.ne_sait_pas); }).map(function (b) { return '<li><b>' + esc(tx(b.titre)) + '.</b> ' + esc(tx(b.ne_sait_pas)) + '</li>'; }).join('');
    return '<article class="em1-chapitre" id="em1-c-' + r.id + '" data-ch="' + i + '"><header class="em1-ch-tete"><div class="em1-p-main"><span class="em1-ch-num">' + String(i + 1).padStart(2, '0') + '</span><p class="em1-ch-q">' + esc(tx(r.question)) + '</p><span class="em1-ch-titre" style="margin-top:10px">' + esc(r.titre) + '</span><p class="em1-verdict">' + esc(h.t) + '</p>' + (h.sub ? '<p class="em1-verdict-sub">' + esc(h.sub) + '</p>' : '') + avert + reserve + '</div><div class="em1-p-marge">' + regle + cites + '</div></header>' +
      r.blocs.map(function (b) { return blocHTML(r, b); }).join('') + (complHTML ? '<div class="em1-ch-pied em1-compl-pied">' + complHTML + '</div>' : '') +
      '<footer class="em1-ch-pied"><div class="em1-p-main"><h4 class="em1-nsp-t">Ce qu\'on ne sait pas</h4><ul class="em1-nsp">' + (nsp || '<li>Rien de plus que ce qui est écrit dans les blocs ci-dessus.</li>') + '</ul></div><div class="em1-p-marge"></div></footer></article>';
  }
  function renderChapitres() {
    killCharts(); figs.length = 0;
    $('.em1-chapitres').innerHTML = E.reponses.map(chapitreHTML).join('');
    var src = (E.sources || []).map(function (s) { return tx(s.nom) ? '<li>' + esc(tx(s.nom)) + '<span>' + esc(tx(s.millesime)) + '</span></li>' : ''; }).join('');
    var av = (E.avertissements || []).map(function (a) { return tx(a); }).filter(Boolean);
    $('.em1-pied').innerHTML = '<h2>Les sources de cette étude</h2><ul>' + src + '</ul>' + (av.length ? '<p class="em1-avert"><b>À savoir.</b> ' + av.map(esc).join(' ') + '</p>' : '');
  }

  /* ---------- graphiques ---------- */
  function killCharts() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; }
  var pluginValeurs = { id: 'valeurs', afterDatasetsDraw: function (ch, a, o) { if (!o || !o.fmt) return; var ctx = ch.ctx; ctx.save(); ctx.font = '600 13px Archivo, sans-serif'; ctx.fillStyle = cv('--ink'); ctx.textBaseline = 'middle';
    ch.data.datasets.forEach(function (ds, i) { var m = ch.getDatasetMeta(i); if (m.hidden || ds.type === 'line') return; m.data.forEach(function (bar, j) { var v = ds.data[j]; if (v == null) return; var t = o.fmt(v); if (ch.options.indexAxis === 'y') { ctx.textAlign = 'left'; ctx.fillText(t, bar.x + 6, bar.y); } else { ctx.textAlign = 'center'; ctx.fillText(t, bar.x, bar.y - 10); } }); }); ctx.restore(); } };
  var pluginCentre = { id: 'centre', afterDraw: function (ch, a, o) { if (!o || !o.t) return; var c = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.font = '440 ' + Math.round(Math.min(30, (c.bottom - c.top) / 4)) + 'px Newsreader, serif'; ctx.fillStyle = cv('--ink'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.t, (c.left + c.right) / 2, (c.top + c.bottom) / 2); ctx.restore(); } };
  function buildCharts() {
    if (!win.Chart) return;
    figs.forEach(function (f) {
      var cv_ = $('canvas[data-fid="' + f.id + '"]'); if (!cv_) return;
      var cfg = f.build(); cfg.plugins = [pluginValeurs, pluginCentre];
      cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, font: { family: 'Archivo, sans-serif', size: 13 }, color: cv('--ink2'), layout: { padding: { top: 20, right: 10 } } }, cfg.options);
      if (cfg.type !== 'doughnut') cfg.options.layout = { padding: { top: 22, right: 12 } };
      try { var ch = new win.Chart(cv_, cfg); ch._fig = cv_.closest('.em1-fig'); charts.push(ch); win.requestAnimationFrame(function () { if (vivant) try { ch.resize(); } catch (e) {} }); } catch (e) { console.warn('graphique', f.id, e.message); }
    });
  }
  function rejouer(ch) { if (reduit) return; ch.options.animation = { duration: 900, easing: 'easeOutQuart' }; ch.reset(); ch.update(); }

  /* ---------- compteurs, révélations, suivi de lecture ---------- */
  function afterRender() {
    buildCharts();
    if (io) io.disconnect();
    io = new win.IntersectionObserver(function (es) { es.forEach(function (en) {
      if (!en.isIntersecting || !vivant) return; var el = en.target; io.unobserve(el);
      if (el.classList.contains('em1-cnt')) animCnt(el);
      else if (el.classList.contains('em1-chapitre')) el.classList.add('em1-vu');
      else { var ch = charts.find(function (c) { return c._fig === el; }); if (ch) rejouer(ch); }
    }); }, { threshold: .15, root: defileEstPage ? null : defile });
    $$('.em1-cnt, .em1-chapitre').forEach(function (el) { io.observe(el); }); charts.forEach(function (c) { if (c._fig) io.observe(c._fig); });
  }
  function animCnt(el) {
    var to = +el.dataset.v, u = el.dataset.u, k = el.dataset.k, from = S.last[k] != null ? S.last[k] : 0; S.last[k] = to;
    if (reduit || from === to || isNaN(to)) return;
    var t0 = win.performance.now(), d = Math.min(1400, 500 + Math.pow(Math.abs(to - from), .3) * 40), dec = Number.isInteger(to) ? 0 : decs(to);
    var f = function (now) { if (!vivant) return; var p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 3), x = from + (to - from) * e; el.textContent = fmtVal(dec ? +x.toFixed(dec + 1) : Math.round(x), u); if (p < 1) win.requestAnimationFrame(f); else el.textContent = fmtVal(to, u); };
    win.requestAnimationFrame(f);
  }
  /* géométrie du défilement : le calque #pe défile lui-même (jamais window) */
  var hautVue = function () { return defileEstPage ? 0 : defile.getBoundingClientRect().top; };
  var hautDefile = function () { return defileEstPage ? (doc.scrollingElement || doc.documentElement).scrollTop : defile.scrollTop; };
  var hautViewport = function () { return defileEstPage ? win.innerHeight : defile.clientHeight; };
  function allerA(top, doux) { if (defileEstPage) win.scrollTo({ top: top, behavior: doux && !reduit ? 'smooth' : 'auto' }); else defile.scrollTo({ top: top, behavior: doux && !reduit ? 'smooth' : 'auto' }); }
  function decaler(dy, doux) { allerA(hautDefile() + dy, doux); }
  function suivi() {
    var ch = $$('.em1-chapitre'), on = -1, y = hautVue() + hautViewport() * .35;
    ch.forEach(function (c, i) { var r = c.getBoundingClientRect(); if (r.top < y && r.bottom > y) on = i; });
    $$('.em1-rg-chap a').forEach(function (a) { a.classList.toggle('em1-on', +a.dataset.i === on); });
    var tot = defileEstPage ? (doc.scrollingElement || doc.documentElement).scrollHeight : defile.scrollHeight;
    var p = hautDefile() / Math.max(1, tot - hautViewport());
    $('.em1-rg-prog').style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)).toFixed(4) + ')';
  }
  var tick = false;
  sur(defileEstPage ? win : defile, 'scroll', function () { if (!tick) { tick = true; win.requestAnimationFrame(function () { tick = false; if (vivant) suivi(); }); } }, { passive: true });

  /* ---------- carte ---------- */
  var TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  function initCarte() {
    var L = win.L; if (!L) return;
    map = L.map($('.em1-carte'), { zoomControl: true, scrollWheelZoom: false, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, renderer: L.svg() });
    L.tileLayer(TUILES, { maxZoom: 17, attribution: '© IGN Plan v2' }).addTo(map);
    map.setView([46.6, 2.4], 6, { animate: false });
    voisinesLayer = L.layerGroup().addTo(map);
  }
  function dessinerCarte() {
    if (!map) return; var L = win.L; map.stop(); map.invalidateSize(); map.setView([E.meta.lat, E.meta.lon], 12, { animate: false });
    ['15', '10', '5'].forEach(function (z) { calques[z] = L.polygon(E.zones[z].contour.map(function (p) { return [p[1], p[0]]; }), { className: 'em1-zn em1-zn' + z, interactive: false }).addTo(map); });
    pin = L.marker([E.meta.lat, E.meta.lon], { icon: L.divIcon({ className: '', html: '<span class="em1-pin"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }).addTo(map);
    carteZone(true);
  }
  function carteZone(anime) {
    if (!map) return; var L = win.L;
    ZS.forEach(function (z) { var p = calques[z] && calques[z].getElement(); if (!p) return; p.classList.toggle('em1-sel', z === S.z);
      if (z === S.z && !reduit && anime) { try { var L_ = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = L_; p.style.strokeDashoffset = L_; p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.3,.7,.2,1), fill-opacity .6s, stroke-width .6s'; p.style.strokeDashoffset = 0; win.setTimeout(function () { p.style.strokeDasharray = ''; }, 1400); } catch (x) {} } });
    voisinesLayer.clearLayers(); vmarks = {};
    E.pharmacies.filter(function (p) { return +p.zone_min <= +S.z; }).forEach(function (p) {
      var m = L.circleMarker([p.lat, p.lon], { radius: 7, className: 'em1-vm', weight: 2 }).addTo(voisinesLayer); vmarks[p.finess] = m;
      m.bindTooltip(esc(nomSur(p.nom)), { direction: 'top' }); // Leaflet écrit l'info-bulle en HTML : nom lu sur OpenStreetMap, modifiable par tous
      m.on('click', function () { ouvrirFiche(p.finess, m.getElement(), true); });
    });
    map.fitBounds(calques[S.z].getBounds(), { padding: [20, 20], animate: false });
    $$('.legende .lz[data-zl]').forEach(function (b) { b.dataset.sel = String(b.dataset.zl === S.z); });
  }

  /* ---------- fiche d'une voisine ---------- */
  function ouvrirFiche(finess, ancre, depuisCarte) {
    var p = E.pharmacies.find(function (x) { return x.finess === finess; }); if (!p) return;
    fermerFiche(true); S.fiche = finess; S.ancre = ancre;
    var f = $('.em1-fiche'), r = p.report || {};
    var dl = [];
    var d = function (k, v, s) { if (v) dl.push('<div><dt>' + k + '</dt><dd>' + v + (s ? '<small>' + s + '</small>' : '') + '</dd></div>'); };
    d('Distance', nb(p.distance_km, 1) + NBSP + 'km', 'à ' + p.zone_min + NBSP + 'min en voiture, à vol d\'oiseau pour la distance');
    d('Équipe', p.equipe ? equipeTxt(p.equipe) + (p.seul ? ' · exerce seul' : '') : '');
    d('Titulaire', p.exploitant_perime ? 'âge non affiché' : p.age_titulaire && p.age_titulaire.age ? p.age_titulaire.age + NBSP + 'ans' + (p.titulaire_60_plus ? ' · 60 ans et plus' : '') : 'inconnu', p.exploitant_perime ? 'société lue périmée à l\'annuaire' : '');
    var g = p['groupement']; d('Appartenance', g ? esc(g.nom) : 'inconnue', g ? (g.a_verifier ? 'à vérifier' : '') : esc(tx(p['groupement_raison'])));
    d('Horaires', p.horaires && p.horaires.texte ? esc(horaires(p.horaires.texte)) : 'inconnus', p.horaires ? (p.horaires.dimanche ? 'ouverte le dimanche · ' : '') + esc(tx(p.horaires.source)) : '');
    var ventes = (p.ventes || []).filter(function (v) { return v.date_publication || v.operation; }).slice(0, 1);
    d('Fonds', ventes.length ? esc(ventes[0].operation || 'vente') + ' publié le ' + esc(dateFr(ventes[0].date_publication)) + (!tel && ventes[0].prix && ventes[0].prix.valeur != null ? ' · ' + fmtVal(ventes[0].prix.valeur, '€') : '') : 'aucune vente publiée');
    if (!tel) d('Chiffre d\'affaires', p.exploitant_perime ? 'non affiché' : p.ca_publie && p.ca_publie.valeur != null ? fmtVal(p.ca_publie.valeur, '€') : 'inconnu', p.ca_publie ? '' : esc(tx(p.ca_raison)));
    f.innerHTML = '<button type="button" class="em1-x" aria-label="Fermer la fiche">×</button><h3 id="em1-fiche-titre">' + esc(nomSur(p.nom)) + '</h3><p class="em1-sous">' + esc(tc(p.commune)) + (p.a_surveiller ? ' · à surveiller' : '') + '</p><dl>' + dl.join('') + '</dl>' +
      '<button type="button" class="em1-btn-sim" data-simuler>Et si elle fermait ?</button><div class="em1-sim" hidden></div>';
    f.hidden = false; $('.em1-voile').hidden = !mobile();
    placer(f, ancre, depuisCarte);
    $$('.em1-vrow.em1-actif').forEach(function (x) { x.classList.remove('em1-actif'); }); if (ancre && ancre.classList && ancre.classList.contains('em1-vrow')) ancre.classList.add('em1-actif');
    f.focus({ preventScroll: true });
    f._p = p;
  }
  /* position relative à la racine (le calque défile : jamais scrollX/scrollY) */
  function placer(f, a, depuisCarte) {
    if (mobile() || !a) { f.style.left = f.style.top = ''; return; }
    var r = a.getBoundingClientRect(), rr = R.getBoundingClientRect(), W = win.innerWidth, w = 372, left, mg, pm, mr;
    if (depuisCarte) left = r.right + 16 + w < W - 8 ? r.right + 16 : r.left - 16 - w;
    else { mg = a.closest('.em1-bloc, .em1-ch-tete'); pm = mg && $('.em1-p-marge', mg); mr = pm && pm.getBoundingClientRect(); left = mr && mr.width > 100 ? mr.left + 12 : r.right + 16; if (left + w > W - 8) left = W - w - 8; }
    left = Math.max(8, left);
    var h0 = Math.max(r.top - 14, hautVue() + decalageAncre() - 12); // jamais sous la barre ni la réglette, même si la ligne y est cachée
    f.style.left = (left - rr.left) + 'px'; f.style.top = (h0 - rr.top) + 'px';
    f.style.setProperty('--ox', (r.right - left > 0 && !depuisCarte ? Math.min(0, left - r.right) : r.left + r.width / 2 - left) + 'px'); f.style.setProperty('--oy', '24px');
    var bas = h0 + f.offsetHeight, bord = hautVue() + hautViewport(), depasse = bas - (bord - 8);
    if (depasse > 0) decaler(Math.min(depasse + 16, h0 - (hautVue() + decalageAncre())), true);
  }
  function fermerFiche(silence) {
    var f = $('.em1-fiche'); if (f.hidden && !S.fiche) return;
    f.hidden = true; $('.em1-voile').hidden = true; $$('.em1-vrow.em1-actif').forEach(function (x) { x.classList.remove('em1-actif'); });
    if (lienSim && map) { map.removeLayer(lienSim); lienSim = null; } Object.keys(vmarks).forEach(function (k) { var e = vmarks[k].getElement(); if (e) e.classList.remove('em1-efface'); });
    var a = S.ancre; S.fiche = null; S.ancre = null; if (!silence && a && a.focus && doc.contains(a)) a.focus({ preventScroll: true });
  }
  function simuler() {
    var f = $('.em1-fiche'), p = f._p; if (!p) return; var r = p.report || {}, sv = r.si_voisine_fermait, se = r.si_elle_fermait, box = $('.em1-sim', f);
    var nombre = sv ? sv.habitants_reportes_vers_nous : null;
    var svg = '<svg viewBox="0 0 320 90" aria-hidden="true"><line class="em1-lien" x1="56" y1="45" x2="264" y2="45" stroke-width="2"/><circle class="em1-efface" cx="46" cy="45" r="30" fill="none" stroke="var(--ink3)"/><circle class="em1-moi" cx="274" cy="45" r="26"/><g class="em1-flux" transform="translate(70 45)">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<circle cx="0" cy="' + ((i % 3 - 1) * 8) + '" r="4"/>'; }).join('') + '</g><text x="46" y="49" text-anchor="middle" font-size="13" fill="var(--ink2)" font-family="Archivo">Elle</text><text x="274" y="49" text-anchor="middle" font-size="13" fill="#fff" font-family="Archivo">Vous</text></svg>';
    var corps;
    if (sv) corps = '<div class="em1-gros"><span class="em1-cnt" data-v="' + nombre + '" data-u="" data-k="sim">' + nb(nombre, 0) + '</span><small>habitant' + (nombre > 1 ? 's' : '') + ' reporté' + (nombre > 1 ? 's' : '') + ' vers vous si elle fermait' + (sv.dont_65_plus ? ' (dont ' + nb(sv.dont_65_plus, 0) + NBSP + 'de 65 ans et plus)' : '') + '</small></div><p class="em1-sens">' + (nombre === 0 ? 'Aucun habitant de sa zone ne vous aurait pour pharmacie la plus proche. ' : '') + (sv.premier_beneficiaire ? 'Premier bénéficiaire : ' + esc(nomSur(sv.premier_beneficiaire)) + '. ' : '') + (sv.habitants_de_sa_zone ? 'Sa zone compte ' + nb(sv.habitants_de_sa_zone, 0) + NBSP + 'habitants.' : '') + '</p>';
    else if (se) corps = '<p class="em1-st"><b>Ce calcul n\'est pas possible pour cette voisine</b> (aucun habitant ne l\'a pour pharmacie la plus proche dans nos carrés). Dans l\'autre sens :</p><div class="em1-gros"><span class="em1-cnt" data-v="' + se.habitants_reportes_vers_voisine + '" data-u="" data-k="sim">' + nb(se.habitants_reportes_vers_voisine, 0) + '</span><small>habitant' + (se.habitants_reportes_vers_voisine >= 2 ? 's' : '') + ' de votre zone naturelle ' + (se.habitants_reportes_vers_voisine >= 2 ? 'iraient' : 'irait') + ' vers elle si vous fermiez (' + nb(se.part_de_notre_zone_pct, 1) + NBSP + '% de cette zone)</small></div>';
    else corps = '<p class="em1-st"><b>Report non calculé</b> pour cette voisine : aucune donnée n\'est affichée à la place.</p>';
    box.innerHTML = svg + corps + '<p class="em1-lim">' + esc(tx(r.limite) || 'Report théorique, à ne pas présenter comme une prévision.') + '</p>'; box.hidden = false;
    S.last.sim = 0; $$('.em1-cnt', box).forEach(animCnt);
    if (map && vmarks[p.finess]) { var el = vmarks[p.finess].getElement(); if (el) el.classList.add('em1-efface'); if (lienSim) map.removeLayer(lienSim); lienSim = win.L.polyline([[p.lat, p.lon], [E.meta.lat, E.meta.lon]], { className: 'em1-flux-l', interactive: false }).addTo(map); }
    if (mobile()) { f.scrollTo({ top: box.offsetTop - 12, behavior: reduit ? 'auto' : 'smooth' }); return; }
    var fb = f.getBoundingClientRect(), bord = hautVue() + hautViewport(); if (fb.bottom > bord - 8) decaler(fb.bottom - bord + 20, true);
  }

  /* ---------- changements d'état ---------- */
  function garderLecture(fn) {
    var ref = $$('.em1-chapitre').find(function (c) { return c.getBoundingClientRect().bottom > hautVue() + 80; }), off = ref ? ref.getBoundingClientRect().top : 0, id = ref && ref.id;
    fn(); var n = id && doc.getElementById(id); if (n) decaler(n.getBoundingClientRect().top - off, false);
  }
  function choisirZone(z) {
    if (z === S.z) return; fermerFiche(true); S.z = z; S.nbV = 8; R.setAttribute('data-zone', z);
    $$('.em1-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.z === z)); });
    majHab(); renderCouvBas(); garderLecture(function () { renderChapitres(); afterRender(); }); carteZone(true);
  }
  function decalageAncre() { var rg = $('.em1-reglette'); return (rg ? rg.offsetHeight : 0) + (parseFloat(R.style.getPropertyValue('--em1-haut')) || 0) + 12; }
  sur(R, 'click', function (ev) {
    var t = ev.target.closest('button, a'), v = ev.target.closest('[data-voisine]');
    if (t && t.dataset.imprimer) return imprimer(t.dataset.imprimer);
    if (t && t.dataset.z) return choisirZone(t.dataset.z);
    if (t && t.dataset.zl) return choisirZone(t.dataset.zl);
    if (t && t.matches('[data-plus]')) { S.nbV += 20; garderLecture(function () { renderChapitres(); afterRender(); }); return; }
    if (t && t.matches('[data-simuler]')) return simuler();
    if (t && t.classList.contains('em1-x')) return fermerFiche();
    if (v) return ouvrirFiche(v.dataset.voisine, v);
    if (ev.target.classList.contains('em1-voile')) return fermerFiche();
    var a = ev.target.closest('a[href^="#c-"]');
    if (a) { ev.preventDefault(); var c = $('#em1-c-' + a.getAttribute('href').slice(3)); if (c) allerA(hautDefile() + c.getBoundingClientRect().top - hautVue() - decalageAncre() + 12, true); }
  });
  /* Échap : la fiche d'abord (sans fermer tout le calque), retiré au démontage */
  sur(doc, 'keydown', function (ev) { if (ev.key === 'Escape' && S.fiche) { ev.stopPropagation(); fermerFiche(); } }, true);

  /* ---------- impression ---------- */
  var cadrerCarte = function () { if (!map) return; map.invalidateSize(); var z = calques[S.z]; if (z) map.fitBounds(z.getBounds(), { padding: [12, 12], animate: false }); };
  // beforeprint part AVANT la mise en page A4 : chaque graphique reçoit la taille papier de la marge (64 mm = 242 px ; 200 px de haut, 150 pour les bas)
  sur(win, 'beforeprint', function () { cadrerCarte(); charts.forEach(function (c) { try { c.resize(242, c.canvas.parentNode.classList.contains('em1-h') ? 150 : 200); } catch (e) {} }); });
  var reTailler = function () { win.requestAnimationFrame(function () { if (!vivant) return; cadrerCarte(); charts.forEach(function (c) { try { c.resize(); } catch (e) {} }); }); };
  var retirerMode = function () { doc.documentElement.removeAttribute('data-impression'); };
  sur(win, 'afterprint', function () { retirerMode(); reTailler(); });
  var mqPrint = win.matchMedia('print'), surMq = function (e) { if (!e.matches) retirerMode(); reTailler(); };
  mqPrint.addEventListener('change', surMq);
  function imprimer(mode) { doc.documentElement.setAttribute('data-impression', mode === 'resume' ? 'resume' : 'complet'); win.print(); }
  sur(win, 'resize', haut);

  /* lumière : le faisceau de la couverture suit le pointeur */
  sur($('.em1-couv'), 'pointermove', function (ev) { var r = ev.currentTarget.getBoundingClientRect(); ev.currentTarget.style.backgroundImage = 'radial-gradient(520px 360px at ' + (ev.clientX - r.left) + 'px ' + (ev.clientY - r.top) + 'px,rgba(255,255,255,.9),rgba(255,255,255,0) 70%),linear-gradient(112deg,var(--papier-h) 0%,rgba(255,255,255,0) 44%),radial-gradient(900px 520px at 100% 0%,var(--menthe),rgba(255,255,255,0) 72%)'; });

  /* ---------- démarrage et démontage ---------- */
  haut(); majHab(); renderCouv(); renderChapitres(); afterRender(); initCarte(); dessinerCarte(); suivi();
  win.setTimeout(function () { if (vivant && map) map.invalidateSize(); }, 60);
  if (typeof opts.surCarte === 'function' && map) { try { opts.surCarte(map, win.L); } catch (e) { console.warn('surCarte', e && e.message); } }

  function demonter() {
    if (!vivant) return; vivant = false;
    ecout.forEach(function (e) { e[0].removeEventListener(e[1], e[2], e[3]); }); ecout = [];
    mqPrint.removeEventListener('change', surMq);
    if (io) io.disconnect();
    killCharts();
    if (map) { try { map.remove(); } catch (e) {} map = null; }
    retirerMode();
    if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
    if (R.parentNode) R.parentNode.removeChild(R);
  }
  return { demonter: demonter, imprimer: imprimer };
}

var API = { VERSION_DONNEES: VERSION_DONNEES, recoller: recoller, degonfler: degonfler, pret: pret, monter: monter };
if (typeof window !== 'undefined') window.ETUDE_M1 = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
