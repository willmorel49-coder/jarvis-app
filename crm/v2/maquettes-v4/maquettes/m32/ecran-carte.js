/* La carte (#carte, #carte-fiche) et Carte secteur (#carte-secteur, 4e vue d'Officines).
   Carte plein cadre à contrôles flottants, fond LOCAL (contours des six départements et villes, aucune tuile ni
   service extérieur), un rond par officine, volet à droite / tiroir à trois crans au téléphone. Bandeau « recherche d'abord »,
   volet = carte d'identité en clé-valeur, listes en tableaux à filets. Couleur nuancée : UNE teinte (le bleu du chiffre d'affaires) en clartés,
   prospects en gris, l'ambre seulement sur l'anneau « À rappeler ». Données : J.C (DONNEES_V4.carte), fictives. Aucun chiffre écrit deux fois.
   Le MOTEUR (projection, fond, points écartés, zoom par viewBox, survol, sélection, tournée, zones), partagé par les deux écrans. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, C = J.C;
var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PAD = 14;
var MW = (BB.est - BB.ouest) * CM * KM + 2 * PAD, MH = (BB.nord - BB.sud) * KM + 2 * PAD;
function MX(lng) { return PAD + (lng - BB.ouest) * CM * KM; }
function MY(lat) { return PAD + (BB.nord - lat) * KM; }
var MOBILE = function () { return window.innerWidth <= 760; };
var ME = (J.X && J.X.personne && J.X.personne.nom) || C.commerciaux[0];
var ca = J.ca = { MX: MX, MY: MY, MW: MW, MH: MH, ME: ME, MOBILE: MOBILE, KM: KM };
/* lus dans les données, jamais écrits en dur : nombre de mois de ventes de la carte, année et dernier mois complet (« ventes à jour à fin … ») */
ca.NM = J.D.mois.length;
ca.AN = (function () { var cov = J.P.couverture || [], cles = J.P.moisCles || [], k = 11; for (var i = cov.length - 1; i >= 0; i--) if (cov[i].complet) { k = i; break; } return String(cles[k] || '').slice(0, 4); })();
ca.FIN = J.ml(J.D.mois[ca.NM - 1]) + (ca.AN ? ' ' + ca.AN : '');
ca.estClient = function (p) { return p.statut === 'cliente' || p.statut === 'à rappeler'; };
ca.dep = function (p) { return p.cp.slice(0, 2); };
ca.nomDep = {}; ca.centres = {};
window.FOND_PACA.features.forEach(function (f) { ca.nomDep[f.properties.code] = f.properties.nom; var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, mx = 0, my = 0, k = 0; polys[0][0].forEach(function (c) { mx += c[0]; my += c[1]; k++; }); ca.centres[f.properties.code] = [MX(mx / k), MY(my / k)]; });
/* une teinte, cinq clartés (du plus clair au plus foncé) ; deux gris pour « sans vente » */
ca.BLEUS = ['#A9C3EE', '#6F97DF', '#2A63CC', '#1D4CA8', '#122F6E'];
ca.GRIS = '#8A93A5'; ca.GRIS2 = '#C5CBD6'; ca.AMBRE = '#A8700A';
/* cinq paliers de chiffre d'affaires (10 mois), bornes rondes adaptées aux données fictives */
ca.PALIERS = [0, 15000, 50000];   // les segments de La carte, sur 10 mois : C, B, A
ca.PALIER_LIB = ['prospect ou sans vente', 'Client C · moins de 15 000 €', 'Client B · 15 000 à 50 000 €', 'Client A · 50 000 € et plus'];
ca.PALIER_R = [4.2, 5.5, 7, 9, 12];
ca.palier = function (p) { if (!p.ca) return 0; for (var i = ca.PALIERS.length - 1; i >= 1; i--) if (p.ca >= ca.PALIERS[i]) return i + 1; return 1; };
ca.couleurPalier = function (k) { return k === 0 ? ca.GRIS : ca.BLEUS[[0, 2, 4][k - 1]]; };   // mêmes bleus que les segments C, B, A
ca.etatDe = function (p) { return p.statut === 'à rappeler' ? 'rappel' : p.statut === 'cliente' ? 'cliente' : p.statut === 'prospect' ? 'prospect' : 'aucune'; };
ca.segCouleur = function (p) { if (!ca.estClient(p)) return p.statut === 'prospect' ? ca.GRIS : ca.GRIS2; return p.segment === 'Client A' ? ca.BLEUS[4] : p.segment === 'Client B' ? ca.BLEUS[2] : ca.BLEUS[0]; };
ca.segRayon = function (p) { if (!ca.estClient(p)) return 4.2; return p.segment === 'Client A' ? 7.5 : p.segment === 'Client B' ? 6 : 5; };
var FOND = null;
function fondPaths() {
  if (FOND) return FOND; FOND = '';
  window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    FOND += '<path data-code="' + f.properties.code + '" class="terre" d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '"/>'; });
  return FOND;
}
/* ---------- la fabrique : une carte dans une zone ; o = { zone, id, aria, rayon(p), couleur(p), anneau(p)?, visible(p), tip(p)?, onClic(p)?, onDep(code)?, libre(w,h)?, apres()? } ---------- */
ca.creer = function (o) {
  var id = o.id, I = { o: o, zone: o.zone, VUE: { cx: 0, cy: 0, s: 1, s0: 1, cx0: 0, cy0: 0 }, POS: null, k: 1, x: 0, y: 0, sel: null, tour: null, zonesFn: null, deps: false, hover: null, nVisibles: 0 };
  I.zone.innerHTML = '<svg id="' + id + '-svg" class="ca-svg" role="img" aria-label="' + esc(o.aria || 'Carte du secteur') + '"><defs><radialGradient id="' + id + '-mer" cx="26%" cy="8%" r="100%"><stop offset="0" stop-color="#EFF3F7"/><stop offset="1" stop-color="#D9E1EB"/></radialGradient><linearGradient id="' + id + '-sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFBF7"/><stop offset="1" stop-color="#EFEDE6"/></linearGradient></defs>' +
    '<rect x="-4000" y="-4000" width="9000" height="9000" fill="url(#' + id + '-mer)"/><g id="' + id + '-terre" class="ca-terre" style="fill:url(#' + id + '-sol)">' + fondPaths() + '</g><g id="' + id + '-dep" class="ca-dep" style="display:none">' +
    Object.keys(ca.centres).map(function (k) { var c = ca.centres[k]; return '<text x="' + c[0].toFixed(1) + '" y="' + c[1].toFixed(1) + '" text-anchor="middle" font-weight="700" letter-spacing=".08em" fill="#1A2030" stroke="#fff" stroke-width="4" paint-order="stroke" pointer-events="none">' + esc(ca.nomDep[k].toUpperCase()) + '</text>'; }).join('') +
    '</g><g id="' + id + '-tr" pointer-events="none"></g><g id="' + id + '-pts"></g><g id="' + id + '-selg" pointer-events="none"></g></svg>' +
    '<div class="ca-villes" id="' + id + '-villes" aria-hidden="true">' + window.VILLES_PACA.map(function (v) { return '<span class="ca-ville" data-lng="' + v.lng + '" data-lat="' + v.lat + '" data-rang="' + v.rang + '" hidden>' + esc(v.nom) + '</span>'; }).join('') + '</div><div class="ca-tip" id="' + id + '-tip" hidden></div>';
  var sv = $('#' + id + '-svg');
  function mesurer() { var r = I.zone.getBoundingClientRect(); return { w: Math.max(300, r.width), h: Math.max(300, r.height) }; }
  function libre(w, h) { return o.libre ? o.libre(w, h) : (MOBILE() ? { x0: 14, y0: 70, x1: w - 14, y1: h - 140 } : { x0: 84, y0: 20, x1: w - 24, y1: h - 96 }); }
  function rayonDe(p) { var r = o.rayon(p); return MOBILE() ? r * .88 : r; }
  function positions() { /* léger écartement en pixels (à l'échelle d'ouverture) : le centre d'aucun point n'est caché par un autre */
    if (I.POS) return I.POS;
    var s0 = I.VUE.s0, L = C.points.map(function (p) { return { p: p, x: MX(p.lng) * s0, y: MY(p.lat) * s0, r: rayonDe(p) }; });
    for (var it = 0; it < 60; it++) { var bouge = false;
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
        var a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = a.r + b.r + 2;
        if (d < m) { var k = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; k = m / 2; } a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; bouge = true; } }
      if (!bouge) break; }
    I.POS = {}; L.forEach(function (q) { I.POS[q.p.id] = [q.x / s0, q.y / s0]; }); return I.POS;
  }
  I.positions = positions;
  function ajuster() { var m = mesurer(), f = libre(m.w, m.h), fw = Math.max(120, f.x1 - f.x0), fh = Math.max(120, f.y1 - f.y0), V = I.VUE;
    V.s0 = Math.min(fw / MW, fh / MH); V.s = V.s0; var px = f.x0 + fw / 2, py = f.y0 + fh / 2;
    V.cx = MW / 2 + (m.w / 2 - px) / V.s; V.cy = MH / 2 + (m.h / 2 - py) / V.s; V.cx0 = V.cx; V.cy0 = V.cy; }
  function appliquer() {
    var m = mesurer(), V = I.VUE, s = V.s, w = m.w / s, h = m.h / s, x = V.cx - w / 2, y = V.cy - h / 2; if (![x, y, w, h].every(isFinite) || !sv) return;
    sv.setAttribute('viewBox', x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2)); I.k = s; I.x = x; I.y = y;
    $$('#' + id + '-pts [data-point]').forEach(function (c) { var r = +c.getAttribute('data-r'); if (c.getAttribute('data-h')) r *= 1.4; c.setAttribute('r', (r / s).toFixed(2)); c.setAttribute('stroke-width', ((c.getAttribute('data-anneau') ? 2.4 : 1.4) / s).toFixed(2)); });
    $$('#' + id + '-dep text').forEach(function (t) { t.setAttribute('font-size', (13.5 / s).toFixed(2)); t.setAttribute('stroke-width', (4 / s).toFixed(2)); });
    $$('#' + id + '-villes .ca-ville').forEach(function (e) { var lng = +e.getAttribute('data-lng'), lat = +e.getAttribute('data-lat'), rg = +e.getAttribute('data-rang'); e.hidden = !(rg <= 1 || (rg <= 2 && s > V.s0 * 1.3) || (rg <= 4 && s > V.s0 * 2) || s > V.s0 * 3); e.style.left = ((MX(lng) - x) * s + 9).toFixed(1) + 'px'; e.style.top = ((MY(lat) - y) * s - 26).toFixed(1) + 'px'; });
    var ech = $('#' + id + '-ech'); if (ech) ech.style.width = Math.round((10 / 111.2) * KM * s) + 'px';
    I.zone.classList.toggle('zoome', s > V.s0 * 1.02);
    dessinerSel(); dessinerTour(); if (o.apres) o.apres(I);
  }
  I.points = function () { /* (re)construit les cercles : clientes dessous (les plus grosses d'abord), petits points au-dessus */
    ajuster(); I.POS = null; var pos = positions(), ordre = C.points.slice().sort(function (a, b) { return (ca.estClient(b) ? 1 : 0) - (ca.estClient(a) ? 1 : 0) || b.ca - a.ca; });
    $('#' + id + '-pts').innerHTML = ordre.map(function (p) { var q = pos[p.id], an = o.anneau && o.anneau(p); return '<circle data-point="' + p.id + '" data-r="' + rayonDe(p).toFixed(1) + '" cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="3" fill="' + o.couleur(p) + '" stroke="#fff"' + (an ? ' data-anneau="1" style="stroke:' + an + '"' : '') + ' tabindex="-1"/>'; }).join('');
    I.maj();
  };
  I.maj = function () { var n = 0; $$('#' + id + '-pts [data-point]').forEach(function (c) { var p = J.pointById(c.getAttribute('data-point')), v = !I.zonesFn && o.visible(p); c.style.display = v ? '' : 'none'; if (v) n++; }); I.nVisibles = n; appliquer(); return n; };
  I.recolorer = function () { I.POS = null; var pos = positions(); $$('#' + id + '-pts [data-point]').forEach(function (c) { var p = J.pointById(c.getAttribute('data-point')), an = o.anneau && o.anneau(p); c.setAttribute('fill', o.couleur(p)); c.setAttribute('data-r', rayonDe(p).toFixed(1)); c.setAttribute('cx', pos[p.id][0].toFixed(2)); c.setAttribute('cy', pos[p.id][1].toFixed(2)); if (an) { c.setAttribute('data-anneau', '1'); c.style.stroke = an; } else { c.removeAttribute('data-anneau'); c.style.stroke = ''; } }); I.maj(); };
  I.vue = function (k) { var V = I.VUE; if (k === '+') V.s = Math.min(V.s0 * 6, V.s * 1.5); else if (k === '-') V.s = Math.max(V.s0, V.s / 1.5); else { V.s = V.s0; } if (V.s === V.s0) { V.cx = V.cx0; V.cy = V.cy0; } appliquer(); };
  I.centrer = function (p, mult) { var q = positions()[p.id], V = I.VUE; V.s = Math.max(V.s, V.s0 * (mult || 3)); V.cx = q[0]; V.cy = q[1]; appliquer(); };
  I.redessiner = function () { if (!I.zone.clientWidth) return; var V = I.VUE, ratio = V.s / (V.s0 || 1), zoome = ratio > 1.02, cx = V.cx, cy = V.cy; ajuster(); if (zoome) { V.s = V.s0 * ratio; V.cx = cx; V.cy = cy; } I.POS = null; var pos = positions(); $$('#' + id + '-pts [data-point]').forEach(function (c) { var q = pos[c.getAttribute('data-point')]; if (q) { c.setAttribute('cx', q[0].toFixed(2)); c.setAttribute('cy', q[1].toFixed(2)); } }); appliquer(); };
  I.zones = function (fn) { I.zonesFn = fn; $$('#' + id + '-terre [data-code]').forEach(function (pth) { var col = fn ? fn(pth.getAttribute('data-code')) : null; pth.style.fill = col || ''; pth.classList.toggle('cliquable', !!fn); }); $('#' + id + '-dep').style.display = fn || I.deps ? '' : 'none'; $('#' + id + '-terre').classList.toggle('zones', !!fn || I.deps); I.maj(); };
  I.contours = function (on) { I.deps = !!on; $('#' + id + '-dep').style.display = on || I.zonesFn ? '' : 'none'; $('#' + id + '-terre').classList.toggle('zones', !!on || !!I.zonesFn); appliquer(); };
  I.selection = function (pid) { I.sel = pid || null; dessinerSel(); };
  I.tournee = function (arr) { I.tour = arr || null; dessinerTour(); };
  function dessinerSel() { var g = $('#' + id + '-selg'); if (!g) return; var p = I.sel ? J.pointById(I.sel) : null; if (!p) { g.innerHTML = ''; return; } var q = positions()[p.id], k = 1 / (I.k || 1);
    g.innerHTML = '<circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (24 * k).toFixed(2) + '" fill="#2A63CC" fill-opacity=".14"/><circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (14 * k).toFixed(2) + '" fill="none" stroke="#2A63CC" stroke-width="' + (3 * k).toFixed(2) + '"/><circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (5 * k).toFixed(2) + '" fill="#2A63CC" stroke="#fff" stroke-width="' + (2 * k).toFixed(2) + '"/>'; }
  function dessinerTour() { var g = $('#' + id + '-tr'); if (!g) return; if (!I.tour || !I.tour.length) { g.innerHTML = ''; return; } var pos = positions(), k = 1 / (I.k || 1), d = C.tournee;
    var pts = [[MX(d.depot.lng), MY(d.depot.lat)]].concat(I.tour.map(function (pid) { var q = pos[pid]; return [q[0], q[1]]; }));
    g.innerHTML = '<path d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '" fill="none" stroke="#fff" stroke-width="' + (7 * k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/><path d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '" fill="none" stroke="#2A63CC" stroke-width="' + (3.5 * k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="' + (9 * k).toFixed(2) + ' ' + (7 * k).toFixed(2) + '"/>' +
      pts.map(function (q, i) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + ((i ? 11 : 9) * k).toFixed(2) + '" fill="' + (i ? '#fff' : '#1A2030') + '" stroke="' + (i ? '#2A63CC' : '#fff') + '" stroke-width="' + (2.6 * k).toFixed(2) + '"/>' + (i ? '<text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4.6 * k).toFixed(1) + '" font-size="' + (13 * k).toFixed(2) + '" font-weight="800" text-anchor="middle" fill="#1A2030">' + i + '</text>' : ''); }).join(''); }
  /* survol : le point grossit, une info-bulle suit ; clic : le point le plus proche du doigt (22 px), ou un département en mode zones */
  function versCarte(ev) { var pt = sv.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; var mm = sv.getScreenCTM(); if (!mm) return null; return pt.matrixTransform(mm.inverse()); }
  function proche(ev, dmax) { var q = versCarte(ev); if (!q) return null; var pos = positions(), best = null, bd = 1e9; C.points.forEach(function (p) { if (!o.visible(p)) return; var d = Math.sqrt(Math.pow(pos[p.id][0] - q.x, 2) + Math.pow(pos[p.id][1] - q.y, 2)) * I.k; if (d < bd) { bd = d; best = p; } }); return bd <= dmax ? best : null; }
  function survol(p) { var tip = $('#' + id + '-tip');
    if (I.hover && (!p || p.id !== I.hover.id)) { var c0 = $('#' + id + '-pts [data-point="' + I.hover.id + '"]'); if (c0) { c0.removeAttribute('data-h'); c0.setAttribute('r', (+c0.getAttribute('data-r') / I.k).toFixed(2)); } }
    I.hover = p; if (!p) { if (tip) tip.hidden = true; sv.style.cursor = ''; return; }
    var c = $('#' + id + '-pts [data-point="' + p.id + '"]'); if (c) { c.setAttribute('data-h', '1'); c.setAttribute('r', (+c.getAttribute('data-r') * 1.4 / I.k).toFixed(2)); } sv.style.cursor = 'pointer';
    if (!tip || !o.tip) return; var q = positions()[p.id], zr = I.zone.getBoundingClientRect(); tip.innerHTML = o.tip(p); tip.hidden = false;
    var px = (q[0] - I.x) * I.k, py = (q[1] - I.y) * I.k - (+c.getAttribute('data-r')) * 1.4 - 10;
    tip.style.left = Math.max(8, Math.min(zr.width - tip.offsetWidth - 8, px - tip.offsetWidth / 2)).toFixed(0) + 'px'; tip.style.top = Math.max(8, py - tip.offsetHeight).toFixed(0) + 'px'; }
  I.survol = survol;
  I.ecranDe = function (p) { var q = positions()[p.id]; return { x: (q[0] - I.x) * I.k, y: (q[1] - I.y) * I.k, r: +($('#' + id + '-pts [data-point="' + p.id + '"]') || { getAttribute: function () { return 6; } }).getAttribute('data-r') }; };
  var DEP = null, DEPL = false;
  var horsCarte = function (t) { return t.closest && t.closest('.ca-flot,.ca-volet,.ca-pan,.ca-bulle,button,a,input,select,label'); };
  I.zone.addEventListener('pointerdown', function (ev) { if (horsCarte(ev.target)) return; DEP = { x: ev.clientX, y: ev.clientY, cx: I.VUE.cx, cy: I.VUE.cy, bouge: false }; });
  window.addEventListener('pointermove', function (ev) { if (!DEP) return; var dx = ev.clientX - DEP.x, dy = ev.clientY - DEP.y; if (Math.abs(dx) + Math.abs(dy) > 6) DEP.bouge = true; if (DEP.bouge && I.VUE.s > I.VUE.s0 * 1.02) { DEPL = true; I.VUE.cx = DEP.cx - dx / I.VUE.s; I.VUE.cy = DEP.cy - dy / I.VUE.s; appliquer(); } });
  window.addEventListener('pointerup', function () { if (DEP && DEP.bouge) setTimeout(function () { DEPL = false; }, 60); DEP = null; });
  I.zone.addEventListener('wheel', function (ev) { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); var V = I.VUE; V.s = Math.max(V.s0, Math.min(V.s0 * 6, V.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); if (V.s === V.s0) { V.cx = V.cx0; V.cy = V.cy0; } appliquer(); }, { passive: false });
  I.zone.addEventListener('dblclick', function (ev) { if (horsCarte(ev.target)) return; var q = versCarte(ev); if (!q) return; var V = I.VUE; V.s = Math.min(V.s0 * 6, V.s * 1.8); V.cx = q.x; V.cy = q.y; appliquer(); });
  sv.addEventListener('click', function (ev) { if (DEPL) return;
    if (I.zonesFn) { var t = ev.target.closest && ev.target.closest('[data-code]'); if (t && o.onDep) o.onDep(t.getAttribute('data-code')); return; }
    var c = ev.target.closest && ev.target.closest('[data-point]'), p = c ? J.pointById(c.getAttribute('data-point')) : proche(ev, 22); if (p) { if (o.onClic) o.onClic(p, ev); } else if (o.onVide) o.onVide(); });
  sv.addEventListener('mousemove', function (ev) { if (MOBILE() || DEP) return; survol(I.zonesFn ? null : proche(ev, 16)); });
  sv.addEventListener('mouseleave', function () { survol(null); });
  return I;
};
ca.departements = function () { /* chiffres par département, calculés sur les points */
  var out = {}; C.departements.forEach(function (d) { out[d] = { code: d, nom: ca.nomDep[d], n: 0, clientes: 0, prospects: 0, ca: 0, rappel: 0 }; });
  C.points.forEach(function (p) { var d = out[ca.dep(p)]; if (!d) return; d.n++; if (ca.estClient(p)) { d.clientes++; d.ca += p.ca; if (p.statut === 'à rappeler') d.rappel++; } else d.prospects++; });
  return out;
};
})();
/* ====================================================================================================================
   LA CARTE (#carte, #carte-fiche) : bandeau « recherche d'abord » (le compteur vit dans la phrase), segment Tout / Clients / Prospects, menus Commercial
   et Groupement, « Plus de filtres » (département, tranche, ville, titulaire, couleur, zones), pastilles de filtres actifs + « Tout effacer » ;
   carte plein cadre : zoom, Liste / Excel / Ma tournée, Points / Bulles, Zones par département, légende qui change ; volet [data-volet] = carte d'identité.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, C = J.C, S = J.S, ca = J.ca, MOBILE = ca.MOBILE, ME = ca.ME;
var K = S.carte = { f: 'tout', com: '', grp: '', q: '', dep: '', tr: '', ville: '', tit: '', couleur: 'segment', bulles: false, zones: false, colorer: 'part', plus: false, volet: null, tour: {}, retires: {}, tourVue: false, triListe: 'ca', nbListe: 40, qListe: '' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var I = null, ecoute = false;
var COULEURS = [['segment', 'Client / Prospect'], ['suivi', 'Suivi des prospects'], ['commercial', 'Commercial'], ['tranche', 'Tranche de chiffre d’affaires'], ['groupement', 'Groupement']];
var COLORER = [['part', 'part de clientes'], ['densite', 'densité d’officines'], ['potentiel', 'potentiel (prospects)']];
function visible(p) { var cl = ca.estClient(p);
  if (K.f === 'clients' && !cl) return false; if (K.f === 'prospects' && cl) return false; if (K.bulles && !p.ca) return false;
  if (K.com && p.commercial !== K.com) return false; if (K.grp && p.groupement !== K.grp) return false; if (K.dep && ca.dep(p) !== K.dep) return false;
  if (K.tr !== '' && String(ca.palier(p)) !== K.tr) return false;
  if (K.ville && p.ville.toLowerCase().indexOf(K.ville.toLowerCase()) < 0) return false; if (K.tit && p.titulaire.toLowerCase().indexOf(K.tit.toLowerCase()) < 0) return false;
  if (K.q && (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(K.q.toLowerCase()) < 0) return false;
  return true; }
function rayon(p) { var cl = ca.estClient(p); if (K.bulles) return cl && p.ca ? Math.min(18, 4 + Math.sqrt(p.ca / 10000) * 1.25) : 0;
  if (K.couleur === 'tranche') return ca.PALIER_R[ca.palier(p)]; if (K.couleur === 'segment') return ca.segRayon(p); if (K.couleur === 'suivi') return cl ? 4.5 : 6; return cl ? 6.2 : 4.4; }
function couleur(p) { var cl = ca.estClient(p);
  if (K.couleur === 'suivi') return cl ? ca.GRIS2 : p.suivi && p.suivi.prochainRendezVous ? '#2F8A4A' : p.suivi && p.suivi.derniereVisite ? ca.GRIS : ca.BLEUS[2];
  if (K.couleur === 'commercial') { var qui = K.com || ME; return !cl ? ca.GRIS2 : p.commercial === qui ? ca.BLEUS[3] : ca.GRIS; }
  if (K.couleur === 'tranche') return ca.couleurPalier(ca.palier(p));
  if (K.couleur === 'groupement') { if (K.grp) return p.groupement === K.grp ? ca.BLEUS[3] : cl ? ca.GRIS : ca.GRIS2; return p.groupement === 'Sans groupement' ? ca.GRIS : cl ? ca.BLEUS[3] : ca.BLEUS[0]; }
  return ca.segCouleur(p); }
function anneau(p) { return p.statut === 'à rappeler' ? ca.AMBRE : null; }
function tip(p) { var cl = ca.estClient(p); return '<b>' + esc(J.joli(p.nom)) + '</b><span class="ca-tt">' + esc(p.titulaire) + '</span><span>' + esc(p.ville) + ' · ' + p.cp + '</span><span>' + (cl ? esc(p.segment) + (p.statut === 'à rappeler' ? ' · à rappeler' : '') : p.statut === 'prospect' ? 'Prospect' : 'Aucune vente') + ' · ' + esc(p.groupement) + ' · ' + esc(p.commercial) + (cl && p.commercial === ME ? '<span class="ca-tin" data-interne> · ' + eur(p.ca) + ' sur ' + ca.NM + ' mois</span>' : '') + '</span>'; }
function opt(v, lib, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(lib) + '</option>'; }
function filtresHtml() {
  return '<div class="ca-f1"><div class="seg" role="group" aria-label="Afficher">' + [['tout', 'Tout'], ['clients', 'Clients'], ['prospects', 'Prospects']].map(function (b) { return '<button type="button" data-filtre="' + b[0] + '" aria-pressed="' + (K.f === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
    '<label class="filtre">Commercial<select id="ca-com" aria-label="Commercial">' + opt('', 'Tous', !K.com) + C.commerciaux.map(function (c) { return opt(c, c, K.com === c); }).join('') + '</select></label>' +
    '<label class="filtre">Groupement<select id="ca-grp" aria-label="Groupement">' + opt('', 'Tous', !K.grp) + C.groupements.map(function (g) { return opt(g, g, K.grp === g); }).join('') + '</select></label>' +
    '<button type="button" class="pil ca-bplus" id="ca-bplus" aria-expanded="' + K.plus + '" aria-controls="ca-f2">' + J.ico('filtre') + '<span class="long">Plus de filtres</span><span class="ca-mob">Filtres</span><span class="ico ca-chev">' + J.icoSvg(K.plus ? 'chevb' : 'chev') + '</span></button></div>' +
    '<div class="ca-f2" id="ca-f2"' + (K.plus ? '' : ' hidden') + '>' +
    '<label class="filtre">Département<select id="ca-dep" aria-label="Département">' + opt('', 'Tous', !K.dep) + C.departements.map(function (d) { return opt(d, d + ' · ' + ca.nomDep[d], K.dep === d); }).join('') + '</select></label>' +
    '<label class="filtre">Chiffre d’affaires<select id="ca-tr" aria-label="Tranche de chiffre d’affaires">' + opt('', 'Toutes les tranches', K.tr === '') + ca.PALIER_LIB.map(function (l, i) { return opt(String(i), i ? l + ' · ' + ca.NM + ' mois' : 'sans vente', K.tr === String(i)); }).join('') + '</select></label>' +
    '<label class="filtre">Ville<input id="ca-ville" type="search" placeholder="contient…" aria-label="Ville contient" value="' + esc(K.ville) + '"></label>' +
    '<label class="filtre">Titulaire<input id="ca-tit" type="search" placeholder="contient…" aria-label="Titulaire contient" value="' + esc(K.tit) + '"></label>' +
    '<label class="filtre">Couleur<select id="ca-coul" aria-label="Couleur des points">' + COULEURS.map(function (c) { return opt(c[0], c[1], K.couleur === c[0]); }).join('') + '<option value="" disabled>UGA · pas encore disponible</option></select></label>' +
    '<label class="filtre">Colorer les zones<select id="ca-colorer" aria-label="Colorer les zones par">' + COLORER.map(function (c) { return opt(c[0], c[1], K.colorer === c[0]); }).join('') + '</select></label>' +
    '<button type="button" class="pil ca-bplus" data-stub="L’export vers un service de cartes (fichier KML) n’est pas dessiné dans cette maquette.">' + J.ico('ext') + 'Exporter la sélection (KML)</button></div>' +
    '<div class="ca-past" id="ca-past" hidden></div>';
}
function flottants() {
  return '<div class="ca-flot ca-ronds"><button type="button" class="b-rond" data-z="+" aria-label="Zoom avant">' + J.ico('plus') + '</button><button type="button" class="b-rond" data-z="-" aria-label="Zoom arrière">' + J.ico('minus') + '</button><button type="button" class="b-rond" data-z="pos" aria-label="Recentrer sur mon secteur">' + J.ico('locate') + '</button></div>' +
    '<div class="ca-flot ca-act"><button type="button" class="pil" data-pan="liste" aria-label="Liste des pharmacies">' + J.ico('list') + '<span class="long">Liste</span></button><button type="button" class="pil" data-stub="Extraire les officines du filtre dans un fichier Excel : non dessiné dans cette maquette." aria-label="Extraire en Excel">' + J.ico('down') + '<span class="long">Excel</span></button><button type="button" class="pil plein" data-pan="tournee" aria-label="Ma tournée">' + J.ico('route') + '<span class="long">Ma tournée</span><b class="cpt7" id="ca-nt"></b></button></div>' +
    '<div class="ca-flot ca-bas"><div class="seg" role="group" aria-label="Points ou bulles"><button type="button" data-mode="points" aria-pressed="' + !K.bulles + '">Points</button><button type="button" data-mode="bulles" aria-pressed="' + K.bulles + '">Bulles<span class="long"> = chiffre d’affaires</span></button></div><button type="button" class="pil" data-zones aria-pressed="' + K.zones + '">' + J.ico('layers') + 'Zones</button><span class="ca-ech"><i id="ca-ech"></i><em>10 km</em></span></div>' +
    '<div class="ca-flot ca-leg" id="ca-leg"></div>' +
    '<aside class="ca-volet" id="ca-volet" data-volet role="dialog" aria-label="Fiche de l’officine" hidden></aside><aside class="ca-pan" id="ca-pan" role="dialog" aria-label="Panneau" hidden></aside>';
}
function dot(c, d, cls) { return '<i class="dot' + (cls ? ' ' + cls : '') + '" style="width:' + d + 'px;height:' + d + 'px;background:' + c + '"></i>'; }
function zonesCalc() { var D = ca.departements(), val = {}, vals = [], fmt, lib;
  Object.keys(D).forEach(function (k) { var d = D[k], v = K.colorer === 'part' ? (d.n ? d.clientes / d.n * 100 : 0) : K.colorer === 'densite' ? d.n : d.prospects; val[k] = v; vals.push(v); });
  fmt = K.colorer === 'part' ? function (v) { return nf.format(Math.round(v)) + ' %'; } : function (v) { return nf.format(Math.round(v)); };
  lib = K.colorer === 'part' ? 'Part de clientes' : K.colorer === 'densite' ? 'Officines par département' : 'Prospects par département';
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pas = (hi - lo) / 5 || 1;
  return { val: val, lo: lo, pas: pas, fmt: fmt, lib: lib, bin: function (v) { return Math.max(0, Math.min(4, Math.floor((v - lo) / pas))); } }; }
function legende() { var L = $('#ca-leg'); if (!L) return; var h;
  if (K.zones) { var z = zonesCalc(); h = '<b>' + z.lib + '</b>' + [0, 1, 2, 3, 4].map(function (i) { return '<span>' + dot(ca.BLEUS[i], 12) + z.fmt(z.lo + i * z.pas) + (i < 4 ? ' à ' + z.fmt(z.lo + (i + 1) * z.pas) : ' et plus') + '</span>'; }).join(''); }
  else if (K.couleur === 'suivi') h = '<b>Suivi des prospects</b><span>' + dot('#2F8A4A', 12) + 'Rendez-vous pris</span><span>' + dot(ca.GRIS, 12) + 'Déjà vue</span><span>' + dot(ca.BLEUS[2], 12) + 'Jamais vue</span><span>' + dot(ca.GRIS2, 10) + 'Cliente</span><span class="ca-lgris">' + dot('#E8ECF4', 12) + 'Ne pas y retourner · pas encore disponible</span>';
  else if (K.couleur === 'commercial') h = '<b>Commercial</b><span>' + dot(ca.BLEUS[3], 12) + 'Clientes de ' + esc(K.com || ME) + '</span><span>' + dot(ca.GRIS, 12) + 'Clientes des autres commerciaux</span><span>' + dot(ca.GRIS2, 10) + 'Prospect, à conquérir</span>';
  else if (K.couleur === 'tranche') h = '<b>Chiffre d’affaires · ' + ca.NM + ' mois</b>' + ca.PALIER_LIB.map(function (l, i) { return '<span>' + dot(ca.couleurPalier(i), 8 + i * 2.5) + l + '</span>'; }).join('');
  else if (K.couleur === 'groupement') h = K.grp ? '<b>Groupement</b><span>' + dot(ca.BLEUS[3], 12) + esc(K.grp) + '</span><span>' + dot(ca.GRIS, 12) + 'Autre groupement ou sans</span>' : '<b>Groupement</b><span>' + dot(ca.BLEUS[3], 12) + 'Cliente adhérente</span><span>' + dot(ca.BLEUS[0], 12) + 'Prospect adhérent</span><span>' + dot(ca.GRIS, 12) + 'Sans groupement</span>';
  else h = '<b>Client / Prospect</b><span>' + dot(ca.BLEUS[4], 15) + 'Client A</span><span>' + dot(ca.BLEUS[2], 12) + 'Client B</span><span>' + dot(ca.BLEUS[0], 10) + 'Client C</span><span>' + dot(ca.GRIS, 9) + 'Prospect</span><span>' + dot('#fff', 12, 'anneau') + 'À rappeler</span>';
  if (K.bulles && !K.zones) h += '<span>' + dot(ca.BLEUS[2], 8) + dot(ca.BLEUS[2], 13) + dot(ca.BLEUS[2], 19) + 'taille = chiffre d’affaires des ' + ca.NM + ' mois, clientes seulement</span>';
  L.innerHTML = h; }
function filtresActifs() { var L = [];
  if (K.f !== 'tout') L.push(['f', K.f === 'clients' ? 'Clients' : 'Prospects']); if (K.com) L.push(['com', K.com]); if (K.grp) L.push(['grp', K.grp]); if (K.dep) L.push(['dep', 'Dépt ' + K.dep + ' · ' + ca.nomDep[K.dep]]);
  if (K.tr !== '') L.push(['tr', 'Chiffre d’affaires : ' + ca.PALIER_LIB[+K.tr]]); if (K.ville) L.push(['ville', 'Ville : ' + K.ville]); if (K.tit) L.push(['tit', 'Titulaire : ' + K.tit]); if (K.q) L.push(['q', '« ' + K.q + ' »']); if (K.bulles) L.push(['bulles', 'Bulles = chiffre d’affaires']);
  return L; }
function majPastilles() { var P = $('#ca-past'); if (!P) return; var L = filtresActifs(); P.hidden = !L.length;
  P.innerHTML = L.map(function (f) { return '<button type="button" class="ca-chip" data-raz="' + f[0] + '" aria-label="Retirer le filtre ' + esc(f[1]) + '">' + esc(f[1]) + '<span class="ico">' + J.icoSvg('close') + '</span></button>'; }).join('') + (L.length ? '<button type="button" class="pil clair ca-eff" data-raz="tout">Tout effacer</button>' : '');
  $$('[data-raz]', P).forEach(function (b) { b.onclick = function () { raz(b.getAttribute('data-raz')); }; }); }
function raz(k) { var tout = k === 'tout';
  if (tout || k === 'f') K.f = 'tout'; if (tout || k === 'com') K.com = ''; if (tout || k === 'grp') K.grp = ''; if (tout || k === 'dep') K.dep = ''; if (tout || k === 'tr') K.tr = ''; if (tout || k === 'ville') K.ville = ''; if (tout || k === 'tit') K.tit = ''; if (tout || k === 'q') K.q = ''; if (tout || k === 'bulles') K.bulles = false;
  var el = $('#ecran-carte'); ['ca-com', 'ca-grp', 'ca-dep', 'ca-tr', 'ca-ville', 'ca-tit', 'ca-q'].forEach(function (id) { var e = $('#' + id, el); if (e) e.value = id === 'ca-com' ? K.com : id === 'ca-grp' ? K.grp : id === 'ca-dep' ? K.dep : id === 'ca-tr' ? K.tr : id === 'ca-ville' ? K.ville : id === 'ca-tit' ? K.tit : K.q; });
  $$('[data-filtre]', el).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtre') === K.f)); }); $$('[data-mode]', el).forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-mode') === 'bulles') === K.bulles)); });
  if (k === 'bulles' || tout) I.recolorer(); appliquer(); }
function majCpt() { var e = $('#ca-cpt'); if (!e || !I) return; var n = 0, nc = 0, np = 0; C.points.forEach(function (p) { if (!visible(p)) return; n++; if (ca.estClient(p)) nc++; else np++; });
  var actifs = filtresActifs().length, zoneTxt = K.zones ? ' En mode Zones, les ' + C.departements.length + ' départements sont colorés par ' + COLORER.filter(function (c) { return c[0] === K.colorer; })[0][1] + ' : un clic sur l’un d’eux ouvre son potentiel.' : '';
  if (K.f === 'clients') e.innerHTML = '<b>' + nf.format(n) + ' clientes</b>' + (actifs > 1 ? ' correspondent à vos filtres' : ' sur la carte de votre secteur') + '.<span class="long"> Un clic ouvre la fiche ; un second clic sur le même point l’ajoute à la tournée, ou l’en retire.</span>' + zoneTxt;
  else if (K.f === 'prospects') e.innerHTML = '<b>' + nf.format(n) + ' prospects</b>' + (actifs > 1 ? ' correspondent à vos filtres' : ' sur la carte de votre secteur') + '.<span class="long"> Un clic ouvre la fiche ; un second clic sur le même point l’ajoute à la tournée, ou l’en retire.</span>' + zoneTxt;
  else e.innerHTML = '<b>' + nf.format(n) + ' officines</b>' + (actifs ? ' correspondent à vos filtres' : ' sur la carte de votre secteur') + ' : <b>' + nf.format(nc) + ' clientes</b> et <b>' + nf.format(np) + ' prospects</b>.<span class="long"> Un clic ouvre la fiche ; un second clic sur le même point l’ajoute à la tournée, ou l’en retire.</span>' + zoneTxt; }
function majTournee() { var e = $('#ca-nt'); if (e) e.textContent = arretsCourants().length; }
function arretsCourants() { var L = C.tournee.arrets.filter(function (a) { return !K.retires[a.id]; }).map(function (a) { return { id: a.id, a: a }; }); Object.keys(K.tour).forEach(function (id) { if (K.tour[id] && !C.tournee.arrets.some(function (a) { return a.id === id; })) L.push({ id: id, a: null }); }); return L; }
function dansTournee(id) { return K.tour[id] ? true : C.tournee.arrets.some(function (a) { return a.id === id; }) && !K.retires[id]; }
function basculerTournee(id) { if (C.tournee.arrets.some(function (a) { return a.id === id; })) K.retires[id] = !K.retires[id]; else K.tour[id] = !K.tour[id]; majTournee(); if (K.tourVue) I.tournee(arretsCourants().map(function (x) { return x.id; })); return dansTournee(id); }
function appliquer() { if (!I) return; if (K.zones) { var z = zonesCalc(); I.zones(function (code) { return ca.BLEUS[z.bin(z.val[code])]; }); } else { I.zones(null); I.maj(); } legende(); majCpt(); majPastilles(); }
function cadrer() { var z = $('#ca-zone'); if (!z) return; var h = window.innerHeight - z.getBoundingClientRect().top - (MOBILE() ? 100 : 24); h = Math.max(MOBILE() ? 480 : 500, Math.min(MOBILE() ? 640 : 820, isFinite(h) ? h : 0)); z.style.setProperty('--ca-h', h + 'px'); }
function construire(el) {
  el.innerHTML = '<div class="page ca-page' + (K.plus ? ' ca-ouvert' : '') + '" id="ca-page">' + J.bandeau({ croix: true, classe: 'ca-ban', eyebrow: 'Mon secteur · ' + C.departements.length + ' départements<span class="long"> · ventes à jour à fin ' + ca.FIN + '</span>', titre: 'La carte', lede: '<span id="ca-cpt"></span>',
    recherche: { id: 'ca-q', placeholder: 'Pharmacie, ville, code postal', aria: 'Rechercher sur la carte', valeur: K.q }, bas: filtresHtml() }) +
    '<div class="ca-zone" id="ca-zone"></div>' +
    '<p class="note ca-note">Fond de carte local (contours des ' + C.departements.length + ' départements, villes), sans aucun service extérieur · ' + esc(C.noteSegments).replace(/(\d) (\d)/g, '$1 $2') + ' · ' + C.horsSecteur.length + ' officines de la liste sont hors de ces ' + C.departements.length + ' départements et n’apparaissent pas ici.</p></div>';
  cadrer();
  I = ca.creer({ zone: $('#ca-zone', el), id: 'ca', aria: 'Carte du secteur : ' + C.points.length + ' officines', rayon: rayon, couleur: couleur, anneau: anneau, visible: visible, tip: tip,
    onClic: function (p) { var v = $('#ca-volet');
      if (K.volet === p.id && v && !v.hidden) { var d = basculerTournee(p.id); J.toast(J.joli(p.nom) + (d ? ' est ajoutée à votre tournée.' : ' est retirée de votre tournée.')); ouvrirVolet(p.id); return; }   /* second clic sur le point déjà ouvert : la tournée (promis par la phrase du bandeau) */
      K.volet = p.id; if (J.courant.hash === 'carte-fiche') ouvrirVolet(p.id); else { K.garder = window.scrollY; J.aller('carte-fiche'); } }, onDep: function (code) { ouvrirPotentiel(code); },
    libre: function (w, h) { return MOBILE() ? { x0: 14, y0: 70, x1: w - 14, y1: h - 150 } : { x0: 84, y0: 76, x1: w - (w > 1000 ? 440 : 24), y1: h - 76 }; } });
  $('#ca-zone', el).insertAdjacentHTML('beforeend', flottants());
  J.poseIcones(el); I.points(); majTournee();
  K.tourVue = true; I.tournee(arretsCourants().map(function (x) { return x.id; }));   /* la tournée du jour est tracée dès l'ouverture ; « Tracé sur la carte » la retire */
  appliquer();
  var rejouer = function () { appliquer(); };
  $$('[data-filtre]', el).forEach(function (b) { b.onclick = function () { K.f = b.getAttribute('data-filtre'); $$('[data-filtre]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); rejouer(); }; });
  $('#ca-com', el).onchange = function (e) { K.com = e.target.value; if (K.couleur === 'commercial') I.recolorer(); rejouer(); };
  $('#ca-grp', el).onchange = function (e) { K.grp = e.target.value; if (K.couleur === 'groupement') I.recolorer(); rejouer(); };
  $('#ca-dep', el).onchange = function (e) { K.dep = e.target.value; rejouer(); };
  $('#ca-tr', el).onchange = function (e) { K.tr = e.target.value; rejouer(); };
  $('#ca-ville', el).oninput = function (e) { K.ville = e.target.value; rejouer(); };
  $('#ca-tit', el).oninput = function (e) { K.tit = e.target.value; rejouer(); };
  $('#ca-q', el).oninput = function (e) { K.q = e.target.value; rejouer(); };
  $('#ca-coul', el).onchange = function (e) { if (!e.target.value) return; K.couleur = e.target.value; I.recolorer(); rejouer(); };
  $('#ca-colorer', el).onchange = function (e) { K.colorer = e.target.value; rejouer(); };
  $('#ca-bplus', el).onclick = function () { K.plus = !K.plus; $('#ca-f2', el).hidden = !K.plus; this.setAttribute('aria-expanded', String(K.plus)); $('.ca-chev', this).innerHTML = J.icoSvg(K.plus ? 'chevb' : 'chev'); $('#ca-page', el).classList.toggle('ca-ouvert', K.plus); cadrer(); I.redessiner(); };
  $$('[data-z]', el).forEach(function (b) { b.onclick = function () { I.vue(b.getAttribute('data-z')); }; });
  $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { K.bulles = b.getAttribute('data-mode') === 'bulles'; $$('[data-mode]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); I.recolorer(); rejouer(); }; });
  $('[data-zones]', el).onclick = function () { K.zones = !K.zones; this.setAttribute('aria-pressed', String(K.zones)); if (!K.zones) departementOn(null); rejouer(); };
  $$('[data-pan]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-pan'); if (k === 'liste') ouvrirListe(); else ouvrirTournee(); }; });
  if (!ecoute) { ecoute = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && I) { fermerVolet(true); fermerPan(); } });
    window.addEventListener('resize', function () { var s = $('#ecran-carte'); if (s && !s.hidden && I) { cadrer(); I.redessiner(); } }); }
}
function departementOn(code) { $$('#ca-terre [data-code]').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-code') === code); }); }
J.ecrans.carte = {
  rendre: function (el, etat) {
    if (!I || !$('#ca-zone', el)) construire(el); else { cadrer(); I.redessiner(); appliquer(); }
    if (K.garder != null) { window.scrollTo(0, K.garder); K.garder = null; }   /* le routeur remonte en haut de page à chaque adresse : on revient où l'on était (clic sur un point, fermeture du volet) */
    if (etat.suite === 'fiche') { if (!K.volet) K.volet = (C.points.filter(function (p) { return p.segment === 'Client A' && p.commercial === ME; })[0] || C.points[0]).id; var vo = $('#ca-volet'); if (!vo || vo.hidden || K.ouvert !== K.volet) ouvrirVolet(K.volet); } else fermerVolet(false);   /* un volet déjà ouvert sur la même officine garde son cran et son défilement */
  }
};
/* ---------- le volet (#carte-fiche) : carte d'identité de l'officine — trois chiffres, chiffre d'affaires par mois, produits phares, clé-valeur, actions ---------- */
var ESTIM = { 'Pharma Horizon': ['Grossiste 2', 'Laboratoire 6'], 'Soleil Officine': ['Grossiste 6', 'Laboratoire 3'], 'Mistral Pharma': ['Grossiste 4', 'Laboratoire 4'], 'Calanques Santé': ['Grossiste 2', 'Laboratoire 5'], 'Réseau Azur': ['Grossiste 6', 'Laboratoire 8'] };
function cran(el) { return function () { var c = +el.getAttribute('data-cran') || 1; el.setAttribute('data-cran', String(c >= 3 ? 1 : c + 1)); }; }
function h(t) { return String(t).replace(':', ' h '); }
function ouvrirVolet(pid) {
  var p = J.pointById(pid); if (!p) return; K.volet = pid; K.ouvert = pid; fermerPan(false);
  var v = $('#ca-volet'), cl = ca.estClient(p), mien = p.commercial === ME, ex = (J.offFiche || J.offById)(p.id), cm = p.caParMois || [], ML = J.D.mois, n = cm.length, est = ESTIM[p.groupement];
  var dern = cm[n - 1], av = cm[n - 2], evo = av ? Math.round((dern - av) / av * 100) : 0, haut = cm.filter(function (x) { return x >= J.MOY.caMois; }).length, dans = dansTournee(p.id);
  var chiffres = '<div class="ca-3"><div><span class="ca-l">Chiffre d’affaires · ' + n + ' mois</span><b class="num">' + J.gros(eur(p.ca)) + '</b><span class="fois" data-interne>× ' + nf1.format(p.ca / (J.MOY.caMois * n)) + ' l’officine moyenne de nos clients</span></div>' +
    '<div><span class="ca-l">' + J.ml(ML[n - 1]) + ' ' + ca.AN + '</span><b class="num">' + J.gros(eur(dern)) + '</b>' + J.evoHtml(evo, 'sur ' + J.ml(ML[n - 2])) + '</div>' +
    '<div data-interne><span class="ca-l">Mois au-dessus de la moyenne de nos clients</span><b class="num">' + haut + ' <small>sur ' + n + '</small></b></div></div>' +
    '<h3>Chiffre d’affaires par mois</h3><div class="chart-box ca-cb" id="ca-vc"></div><p class="lecteur" id="ca-vl" aria-live="polite">Touchez ou survolez un mois pour le lire.</p>' +
    '<h3>Produits phares</h3><table class="tabl ca-tp"><thead><tr><th>Produit</th><th class="num">Chiffre d’affaires</th></tr></thead><tbody>' + (p.produits || []).map(function (q) { var i = q.nom.indexOf(','); return '<tr><td><b>' + esc(i > 0 ? q.nom.slice(0, i) : q.nom) + '</b>' + (i > 0 ? '<span class="sub">' + esc(q.nom.slice(i + 1).trim()) + '</span>' : '') + '</td><td class="num"><b>' + eur(q.ca) + '</b></td></tr>'; }).join('') + '</tbody></table>';
  var lignes = [['Titulaire', esc(p.titulaire)], ['Téléphone', '<a class="ca-tel" href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">' + esc(p.telephone) + '</a>', 0, 1], ['Adresse', esc(p.cp + ' ' + p.ville)], ['Identifiant', 'n° ' + esc(p.id)], ['Groupement', esc(p.groupement)], ['Commercial', esc(p.commercial) + (mien ? ' · vous' : ''), 1],
    ['Dernière visite', p.suivi && p.suivi.derniereVisite ? J.dateFr(p.suivi.derniereVisite) : 'jamais visitée', 1], ['Prochain rendez-vous', p.suivi && p.suivi.prochainRendezVous ? J.dateFr(p.suivi.prochainRendezVous.date) + ' à ' + h(p.suivi.prochainRendezVous.heure) : 'aucun de prévu', 1],
    ['Grossiste probable', est ? esc(est[0]) + ' <span class="sub ca-inl">· d’après le groupement</span>' : '', 1], ['Génériqueur probable', est ? esc(est[1]) : '', 1]];
  v.innerHTML = '<button type="button" class="ca-grab" aria-label="Agrandir ou réduire la fiche"><i></i></button>' +
    '<div class="ca-vt"><span class="ca-av" aria-hidden="true">' + esc(J.ini(p.nom)) + '</span><div><p class="eyebrow">' + (cl ? 'Cliente Intégral' : 'Prospect') + '</p><h2>' + esc(J.joli(p.nom)) + '</h2></div><button type="button" class="b-rond" data-fermer-volet aria-label="Fermer la fiche">' + J.ico('close') + '</button></div>' +
    '<div class="ca-meta">' + J.etatHtml(ca.etatDe(p)) + (cl ? '<span class="etat">' + esc(p.segment) + '</span>' : '') + '<span class="etat">' + J.ico('pin') + esc(ca.nomDep[ca.dep(p)] || p.cp) + '</span></div>' +
    (cl ? (mien ? chiffres : '<p class="note ca-reserve">Chiffres de vente réservés au commercial de cette officine, ' + esc(p.commercial) + '.</p>') : '<p class="note ca-reserve">Pas encore de ventes réseau pour cette officine.</p>') +
    '<div class="ronds ca-ronds-v" data-interne>' + J.rond('doc', 'Fiche complète', ex ? '' : 'La fiche complète est ouverte pour les officines de votre portefeuille : celle-ci est suivie par ' + p.commercial + '.', 1, ex ? ' data-act="fiche"' : '') + J.rond(dans ? 'check' : 'route', dans ? 'Dans ma tournée' : 'Ajouter à ma tournée', '', 0, ' data-act="tour" aria-pressed="' + dans + '"') + J.rond('pin', 'Itinéraire', 'L’itinéraire dans l’appli de navigation n’est pas dessiné dans cette maquette.') + '</div>' +
    '<h3>Carte d’identité</h3>' + J.kv(lignes) +
    '<div class="ca-chips" data-interne><button type="button" class="chip" data-stub="' + STUB('Noter une relance') + '">' + J.ico('bell') + 'Noter une relance</button><button type="button" class="chip" data-stub="' + STUB('Prendre une note') + '">' + J.ico('note') + 'Note d’équipe</button><button type="button" class="chip" data-stub="' + STUB('Compléter les infos client') + '">' + J.ico('edit') + 'Infos client</button></div>' +
    '<p class="note">' + (cl && mien ? 'Références achetées, potentiel, interlocuteur' : 'Interlocuteur') + ', logiciel, livraison, SIREN et courriel : pas encore sur la carte.</p>';
  J.poseIcones(v); v.hidden = false; v.setAttribute('data-cran', '1'); v.scrollTop = 0; I.selection(p.id);
  if (cl && mien) J.dessine($('#ca-vc', v), function (w) { return J.colonnes({ labels: ML.map(function (l) { return l.slice(0, 3); }), vals: cm, couleur: 'var(--c-ca)', h: 120, aria: 'Chiffre d’affaires par mois de ' + J.joli(p.nom) }, w); }, function (b) { J.lie(b, cm.map(function (x, i) { return '<b>' + J.ml(ML[i]) + ' ' + ca.AN + '</b> : ' + eur(x); }), $('#ca-vl', v)); });
  $('[data-fermer-volet]', v).onclick = function () { fermerVolet(true); };
  $('.ca-grab', v).onclick = cran(v);
  var f = $('[data-act="fiche"]', v); if (f) f.onclick = function () { J.ouvrirFiche(p.id); };
  $('[data-act="tour"]', v).onclick = function () { var d = basculerTournee(p.id); this.setAttribute('aria-pressed', String(d)); this.innerHTML = '<span class="rond"><span class="ico">' + J.icoSvg(d ? 'check' : 'route') + '</span></span>' + (d ? 'Dans ma tournée' : 'Ajouter à ma tournée'); J.toast(d ? J.joli(p.nom) + ' est ajoutée à votre tournée.' : J.joli(p.nom) + ' est retirée de votre tournée.'); };
}
function fermerVolet(nav) { var v = $('#ca-volet'); if (v) v.hidden = true; K.ouvert = null; if (I) I.selection(null); if (nav && J.courant.hash === 'carte-fiche') { K.garder = window.scrollY; J.aller('carte'); } }
/* ---------- les panneaux : Liste des pharmacies, Ma tournée (frise horaire, dépôt de départ), Potentiel du secteur (un département) ---------- */
function ouvrirPan(titre, sous, html, cls) { if (J.courant.hash === 'carte-fiche') fermerVolet(true); else fermerVolet(false);
  var p = $('#ca-pan'); p.className = 'ca-pan' + (cls ? ' ' + cls : ''); p.innerHTML = '<button type="button" class="ca-grab" aria-label="Agrandir ou réduire le panneau"><i></i></button><div class="ca-pt"><div><p class="eyebrow">' + sous + '</p><h2>' + titre + '</h2></div><button type="button" class="b-rond" data-fermer-pan aria-label="Fermer">' + J.ico('close') + '</button></div><div class="ca-pc">' + html + '</div>';
  J.poseIcones(p); p.hidden = false; p.setAttribute('data-cran', '2'); p.scrollTop = 0; $('[data-fermer-pan]', p).onclick = function () { fermerPan(true); }; $('.ca-grab', p).onclick = cran(p); return p; }
function fermerPan(fin) { var p = $('#ca-pan'); if (p) p.hidden = true; if (fin !== false) { departementOn(null); } }
function ligneListe(q) { var dans = dansTournee(q.id), cl = ca.estClient(q);
  return '<div class="ca-tr"><button type="button" class="ca-tn" data-ouvre="' + q.id + '"><b>' + esc(J.joli(q.nom)) + '</b><span class="sub">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.titulaire) + '</span><span class="ca-tm">' + J.etatHtml(ca.etatDe(q)) + (cl && q.commercial === ME ? '<span class="etat" data-interne>' + eur(q.ca) + '</span>' : '') + '<span class="etat">' + esc(q.commercial) + '</span>' + (q.groupement !== 'Sans groupement' ? '<span class="etat">' + esc(q.groupement) + '</span>' : '') + '</span></button>' +
    '<span class="ca-ta"><button type="button" class="b-rond" data-loc="' + q.id + '" aria-label="Voir sur la carte">' + J.ico('locate') + '</button><button type="button" class="b-rond" data-tourne="' + q.id + '" aria-label="' + (dans ? 'Retirer de ma tournée' : 'Ajouter à ma tournée') + '" aria-pressed="' + dans + '">' + J.ico(dans ? 'check' : 'plus') + '</button></span></div>'; }
function ouvrirListe() {
  var ql = K.qListe.toLowerCase(), l = C.points.filter(visible).filter(function (p) { return !ql || (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(ql) >= 0; }).sort(K.triListe === 'nom' ? function (a, b) { return J.joli(a.nom).localeCompare(J.joli(b.nom), 'fr'); } : function (a, b) { return b.ca - a.ca || J.joli(a.nom).localeCompare(J.joli(b.nom), 'fr'); }), aff = l.slice(0, K.nbListe);
  var pan = ouvrirPan('Liste des pharmacies', 'celles du filtre en cours', '<div class="ca-pf"><label class="filtre">' + J.ico('search') + '<input id="ca-lq" type="search" placeholder="Un nom, une ville, un code postal…" aria-label="Rechercher dans la liste" value="' + esc(K.qListe) + '"></label>' +
    '<div class="seg" role="group" aria-label="Trier"><button type="button" data-tri="ca" aria-pressed="' + (K.triListe === 'ca') + '">Chiffre d’affaires</button><button type="button" data-tri="nom" aria-pressed="' + (K.triListe === 'nom') + '">Nom</button></div></div>' +
    '<p class="note">' + (ql ? '<b>' + nf.format(l.length) + '</b> résultat' + (l.length > 1 ? 's' : '') + ' · ' : '') + 'classées par ' + (K.triListe === 'nom' ? 'nom' : 'chiffre d’affaires, prospects en fin de liste') + ' · ' + aff.length + ' affichée' + (aff.length > 1 ? 's' : '') + '</p>' +
    '<div class="ca-tl">' + (aff.length ? aff.map(ligneListe).join('') : '<p class="note">Aucune officine ne correspond.</p>') + '</div>' + (l.length > aff.length ? '<button type="button" class="pil" data-plus>Voir ' + Math.min(40, l.length - aff.length) + ' de plus</button>' : ''), 'ca-pan-liste');
  $('#ca-lq', pan).oninput = function (e) { K.qListe = e.target.value; K.nbListe = 40; var pos = e.target.selectionStart; ouvrirListe(); var q = $('#ca-lq'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} };
  $$('[data-tri]', pan).forEach(function (b) { b.onclick = function () { K.triListe = b.getAttribute('data-tri'); ouvrirListe(); }; });
  var plus = $('[data-plus]', pan); if (plus) plus.onclick = function () { K.nbListe += 40; ouvrirListe(); };
  $$('[data-ouvre]', pan).forEach(function (b) { b.onclick = function () { K.volet = b.getAttribute('data-ouvre'); K.garder = window.scrollY; J.aller('carte-fiche'); }; });
  $$('[data-loc]', pan).forEach(function (b) { b.onclick = function () { var p = J.pointById(b.getAttribute('data-loc')); I.centrer(p, 3.2); I.selection(p.id); if (MOBILE()) pan.setAttribute('data-cran', '1'); }; });
  $$('[data-tourne]', pan).forEach(function (b) { b.onclick = function () { var d = basculerTournee(b.getAttribute('data-tourne')); b.setAttribute('aria-pressed', String(d)); b.setAttribute('aria-label', d ? 'Retirer de ma tournée' : 'Ajouter à ma tournée'); b.innerHTML = J.ico(d ? 'check' : 'plus'); }; });
}
function ouvrirTournee() {
  var d = C.tournee, L = arretsCourants(), fixes = L.filter(function (x) { return x.a; }), ajouts = L.filter(function (x) { return !x.a; });
  K.tourVue = true; I.tournee(L.map(function (x) { return x.id; }));
  var route = fixes.reduce(function (s, x) { return s + x.a.minutesDepuisPrecedent; }, 0), visite = fixes.reduce(function (s, x) { return s + x.a.dureeVisite; }, 0);
  var frise = '<li><span class="ca-fh num">' + h(d.depart) + '</span><span class="ca-fb dep">D</span><div><b>Départ · ' + esc(d.depot.nom) + '</b><span class="sub">' + esc(d.depot.adresse) + '</span></div></li>';
  fixes.forEach(function (x, i) { var a = x.a, p = J.pointById(x.id), rdv = p.suivi && p.suivi.prochainRendezVous;
    frise += '<li class="ca-ft">' + J.ico('route') + a.minutesDepuisPrecedent + ' min · ' + a.kmDepuisPrecedent + ' km</li>' +
      '<li><span class="ca-fh num">' + h(a.arrivee) + '</span><span class="ca-fb">' + (i + 1) + '</span><div><b>' + esc(J.joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · ' + p.cp + ' · ' + esc(p.telephone) + '</span><span class="sub">visite de ' + a.dureeVisite + ' min · repart à ' + h(a.depart) + (rdv ? ' · rendez-vous le ' + J.dateFr(rdv.date) + ' à ' + h(rdv.heure) : '') + '</span>' + (rdv ? '' : '<button type="button" class="chip ca-chip-s" data-stub="' + STUB('Fixer l’heure du rendez-vous') + '">' + J.ico('cal') + 'Fixer un rendez-vous</button>') + '</div><button type="button" class="b-rond" data-retire="' + x.id + '" aria-label="Retirer cet arrêt">' + J.ico('close') + '</button></li>'; });
  if (fixes.length) frise += '<li class="ca-ft">' + J.ico('route') + d.retour.kmDepuisDernier + ' km</li><li><span class="ca-fh num">' + h(d.fin) + '</span><span class="ca-fb dep">R</span><div><b>Retour au dépôt</b><span class="sub">fin de la tournée</span></div></li>';
  if (ajouts.length) frise += '<li class="ca-fs"><b>À placer dans la journée</b><span class="sub">ajoutées depuis une fiche ou la liste ; « Ré-optimiser » les range dans la frise</span></li>' + ajouts.map(function (x) { var p = J.pointById(x.id); return '<li><span class="ca-fh"></span><span class="ca-fb">+</span><div><b>' + esc(J.joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · ' + p.cp + '</span></div><button type="button" class="b-rond" data-retire="' + x.id + '" aria-label="Retirer cet arrêt">' + J.ico('close') + '</button></li>'; }).join('');
  var pan = ouvrirPan('Ma tournée', esc(d.nom), (L.length ? '<div class="ca-4"><div><span class="ca-l">Distance</span><b class="num">' + d.kmTotal + ' <small>km</small></b></div><div><span class="ca-l">Sur la route</span><b class="num">' + route + ' <small>min</small></b></div><div><span class="ca-l">En visite</span><b class="num">' + visite + ' <small>min</small></b></div><div><span class="ca-l">Par arrêt</span><b class="num">' + nf1.format(d.kmTotal / Math.max(1, fixes.length)) + ' <small>km</small></b></div></div><p class="note">Temps estimés · dans l’appli, les temps réels par la route viennent d’un service gratuit de calcul d’itinéraire.</p>' : '<p class="note ca-reserve">Votre tournée est vide.</p>') +
    '<label class="filtre ca-depot">Je pars de<select id="ca-depot" aria-label="Point de départ"><option>' + esc(d.depot.nom) + '</option><option>Mon domicile</option><option>Le dépôt le plus proche</option></select></label><p class="note">Les autres dépôts du groupe ne sont pas encore repérés : un seul dépôt de départ.</p>' +
    '<details class="tabm ca-compose"><summary>' + J.ico('spark') + 'Composer ma tournée du jour</summary><div class="ca-form"><label class="filtre">Zone à couvrir<input type="search" placeholder="ville ou pharmacie, optionnel" aria-label="Zone à couvrir"></label><label class="filtre">Groupements à cibler<select aria-label="Groupements à cibler"><option>Tous</option>' + C.groupements.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
    '<label class="filtre">Heure de départ<select aria-label="Heure de départ"><option>07:30</option><option selected>08:00</option><option>08:30</option><option>09:00</option></select></label><label class="filtre">Visites<select aria-label="Nombre de visites">' + [6, 7, 8, 9, 10, 11, 12].map(function (n) { return '<option' + (n === 8 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
    '<div class="seg" role="group" aria-label="Inclure mes clients"><button type="button" aria-pressed="true">Avec mes clients</button><button type="button" aria-pressed="false">Prospects seuls</button></div><button type="button" class="pil plein" data-stub="' + STUB('Générer la tournée') + '">' + J.ico('spark') + 'Générer la tournée</button>' +
    '<p class="note">Prospection sur votre zone de livraison : on ne propose que des prospects proches d’une cliente Intégral, pour que la tournée reste rentable.</p></div></details>' +
    '<h3>La frise de la journée</h3><ol class="ca-frise">' + frise + '</ol>' +
    '<div class="ca-pact">' + (L.length && J.pointById(L[0].id) ? '<a class="pil plein" href="maps://?saddr=' + d.depot.lat + ',' + d.depot.lng + '&amp;daddr=' + J.pointById(L[0].id).lat + ',' + J.pointById(L[0].id).lng + '&amp;dirflg=d">' + J.ico('route') + 'Ouvrir dans l’appli de navigation</a>' : '') + '<button type="button" class="pil" data-stub="' + STUB('Ré-optimiser') + '">Ré-optimiser</button><button type="button" class="pil" data-stub="' + STUB('Enregistrer') + '">Enregistrer</button><a class="pil" href="#tournees">Mes tournées</a><button type="button" class="pil" data-stub="' + STUB('Prospects proches') + '">Prospects proches</button><button type="button" class="pil" data-trace aria-pressed="' + K.tourVue + '">Tracé sur la carte</button><button type="button" class="pil" data-vider>Vider</button></div>' +
    '<p class="note">Exporter : <button type="button" class="ca-lien" data-stub="' + STUB('Exporter vers l’agenda') + '">agenda</button> · <button type="button" class="ca-lien" data-stub="' + STUB('Exporter en KML') + '">KML</button> · <button type="button" class="ca-lien" data-stub="' + STUB('Exporter en Excel') + '">Excel</button></p>', 'ca-pan-tour');
  $$('[data-retire]', pan).forEach(function (b) { b.onclick = function () { basculerTournee(b.getAttribute('data-retire')); ouvrirTournee(); }; });
  $('[data-vider]', pan).onclick = function () { C.tournee.arrets.forEach(function (a) { K.retires[a.id] = true; }); K.tour = {}; majTournee(); ouvrirTournee(); };
  $('[data-trace]', pan).onclick = function () { K.tourVue = !K.tourVue; this.setAttribute('aria-pressed', String(K.tourVue)); I.tournee(K.tourVue ? arretsCourants().map(function (x) { return x.id; }) : null); };
}
function ouvrirPotentiel(code) {
  var D = ca.departements(), d = D[code]; if (!d) return; departementOn(code);
  var codes = Object.keys(D), moyPart = codes.reduce(function (s, k) { return s + (D[k].n ? D[k].clientes / D[k].n * 100 : 0); }, 0) / codes.length, part = d.n ? d.clientes / d.n * 100 : 0, parCl = d.clientes ? d.ca / d.clientes : 0;
  var prospects = C.points.filter(function (p) { return ca.dep(p) === code && !ca.estClient(p); }).sort(function (a, b) { return (a.groupement === 'Sans groupement' ? 1 : 0) - (b.groupement === 'Sans groupement' ? 1 : 0) || a.ville.localeCompare(b.ville, 'fr'); }).slice(0, 5);
  var pan = ouvrirPan('Potentiel du secteur', esc(code + ' · ' + d.nom), '<div class="ca-4"><div><span class="ca-l">Clientes</span><b class="num">' + nf.format(d.clientes) + '</b></div><div><span class="ca-l">Prospects</span><b class="num">' + nf.format(d.prospects) + '</b></div><div><span class="ca-l">Part de clientes</span><b class="num">' + nf.format(Math.round(part)) + ' <small>%</small></b><span class="fois">' + J.icoSvg(part >= moyPart ? 'haut' : 'bas', part >= moyPart ? 'var(--e-bien)' : 'var(--e-alerte)') + ' ' + nf.format(Math.round(Math.abs(part - moyPart))) + ' points ' + (part >= moyPart ? 'au-dessus' : 'au-dessous') + ' de la moyenne des ' + C.departements.length + ' départements</span></div><div><span class="ca-l">À rappeler</span><b class="num">' + nf.format(d.rappel) + '</b></div></div>' +
    (d.clientes ? '<div class="ca-3" data-interne><div><span class="ca-l">Chiffre d’affaires des clientes · ' + ca.NM + ' mois</span><b class="num">' + J.gros(eur(d.ca)) + '</b></div><div><span class="ca-l">Par cliente</span><b class="num">' + J.gros(eur(parCl)) + '</b></div><div><span class="ca-l">Si les prospects achetaient comme la cliente moyenne du département</span><b class="num">' + J.gros(eur(d.prospects * parCl)) + '</b><span class="fois">ordre de grandeur, sur ' + ca.NM + ' mois</span></div></div>' : '') +
    '<h3>Prospects du département</h3><p class="note">Les cinq premiers, adhérents d’un groupement d’abord · un clic ouvre la fiche.</p><div class="ca-tl">' + prospects.map(function (q) { return '<div class="ca-tr"><button type="button" class="ca-tn" data-ouvre="' + q.id + '"><b>' + esc(J.joli(q.nom)) + '</b><span class="sub">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.groupement) + '</span></button><span class="ca-ta"><button type="button" class="b-rond" data-loc="' + q.id + '" aria-label="Voir sur la carte">' + J.ico('locate') + '</button></span></div>'; }).join('') + '</div>' +
    '<p class="note">Habitants par officine, part des 80 ans et plus, quartiers INSEE : pas encore sur la carte (source : INSEE, recensement ; Assurance maladie, Open Medic · ordre de grandeur).</p>', 'ca-pan-pot');
  $$('[data-ouvre]', pan).forEach(function (b) { b.onclick = function () { K.volet = b.getAttribute('data-ouvre'); K.zones = false; var z = $('[data-zones]'); if (z) z.setAttribute('aria-pressed', 'false'); departementOn(null); appliquer(); K.garder = window.scrollY; J.aller('carte-fiche'); }; });
  $$('[data-loc]', pan).forEach(function (b) { b.onclick = function () { var p = J.pointById(b.getAttribute('data-loc')); K.zones = false; var z = $('[data-zones]'); if (z) z.setAttribute('aria-pressed', 'false'); departementOn(null); appliquer(); I.centrer(p, 3.2); I.selection(p.id); }; });
}
})();
/* ====================================================================================================================
   CARTE SECTEUR (#carte-secteur, 4e vue d'Officines) : en-tête « Mes officines » (compteur d'officines localisées dans la phrase), les quatre vues,
   menu Commercial ; même carte, un rond par officine dont la taille ET la teinte suivent cinq paliers de chiffre d'affaires ; légende flottante à cinq
   paliers ; bulle au clic (nom, ville, groupement, chiffre d'affaires si on a le droit de le voir, « Ouvrir la fiche → »).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, C = J.C, S = J.S, ca = J.ca, MOBILE = ca.MOBILE, ME = ca.ME;
var K = S.carteSecteur = { com: '', q: '', bulle: null }, I = null, ecoute = false;
function visible(p) { if (K.com && p.commercial !== K.com) return false; if (K.q && (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(K.q.toLowerCase()) < 0) return false; return true; }
function majCpt() { var e = $('#cs-cpt'); if (!e) return; var n = C.points.filter(visible).length, filtre = K.com || K.q;
  e.innerHTML = 'La carte de votre secteur · <b>' + nf.format(C.points.length) + ' officines localisées</b>' + (filtre ? ' · <b>' + nf.format(n) + '</b> ' + (K.com ? 'suivie' + (n > 1 ? 's' : '') + ' par ' + esc(K.com) : 'trouvée' + (n > 1 ? 's' : '')) : '') + ' · la taille et la teinte d’un rond suivent le chiffre d’affaires des ' + ca.NM + ' mois ; un clic ouvre la bulle de l’officine.'; }
function fermerBulle() { K.bulle = null; var b = $('#cs-bulle'); if (b) b.hidden = true; if (I) I.selection(null); }
function placerBulle() { var b = $('#cs-bulle'); if (!b || b.hidden || !K.bulle || !I) return; var p = J.pointById(K.bulle), q = I.ecranDe(p), zr = I.zone.getBoundingClientRect(), w = b.offsetWidth, hh = b.offsetHeight;
  var x = q.x - w / 2, y = q.y - q.r - 12 - hh; if (y < 8) y = q.y + q.r + 12; x = Math.max(8, Math.min(zr.width - w - 8, x)); b.style.left = x.toFixed(0) + 'px'; b.style.top = Math.max(8, y).toFixed(0) + 'px'; }
function ouvrirBulle(p) { K.bulle = p.id; var b = $('#cs-bulle'), cl = ca.estClient(p), mien = p.commercial === ME, ex = (J.offFiche || J.offById)(p.id);
  b.innerHTML = '<button type="button" class="b-rond ca-bx" data-fermer-bulle aria-label="Fermer la bulle">' + J.ico('close') + '</button><b>' + esc(J.joli(p.nom)) + '</b><span>' + esc(p.cp + ' ' + p.ville) + '</span>' + (p.groupement !== 'Sans groupement' ? '<span class="ca-bg">' + esc(p.groupement) + '</span>' : '') +
    (cl ? (mien ? '<span class="num ca-bca" data-interne><b>' + eur(p.ca) + '</b> de chiffre d’affaires · ' + ca.NM + ' mois</span>' : '<span class="ca-bg">chiffres réservés à ' + esc(p.commercial) + '</span>') : '<span class="ca-bg">' + (p.statut === 'prospect' ? 'prospect' : 'aucune vente') + ' · pas encore de vente réseau</span>') +
    (ex ? '<a class="ca-blien" href="#fiche" data-ouvre="' + p.id + '">Ouvrir la fiche →</a>' : '<a class="ca-blien" href="#carte-secteur" data-stub="La fiche complète est ouverte pour les officines de votre portefeuille : celle-ci est suivie par ' + p.commercial + '.">Ouvrir la fiche →</a>');
  J.poseIcones(b); b.hidden = false; I.selection(p.id); placerBulle();
  $('[data-fermer-bulle]', b).onclick = fermerBulle;
  var a = $('[data-ouvre]', b); if (a) a.onclick = function (ev) { ev.preventDefault(); J.ouvrirFiche(p.id); }; }
function cadrer() { var z = $('#cs-zone'); if (!z) return; var h = window.innerHeight - z.getBoundingClientRect().top - (MOBILE() ? 100 : 24); h = Math.max(MOBILE() ? 480 : 500, Math.min(MOBILE() ? 640 : 820, isFinite(h) ? h : 0)); z.style.setProperty('--ca-h', h + 'px'); }
function construire(el) {
  el.innerHTML = '<div class="page cs-page">' + J.bandeau({ croix: true, classe: 'ca-ban', eyebrow: 'Mon secteur<span class="long"> · ventes à jour à fin ' + ca.FIN + '</span>', titre: 'Carte du secteur', lede: '<span id="cs-cpt"></span>',
    recherche: { id: 'cs-q', placeholder: 'Pharmacie, ville, code postal', aria: 'Rechercher sur la carte du secteur', valeur: K.q },
    bas: '<label class="filtre">Commercial<select id="cs-com" aria-label="Commercial"><option value="">Tous</option>' + C.commerciaux.map(function (c) { return '<option value="' + esc(c) + '"' + (K.com === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' }) +
    '<div class="cs-sousnav">' + J.vuesOfficines('carte-secteur') + '</div>' +
    '<div class="ca-zone cs-zone" id="cs-zone"></div>' +
    '<p class="note ca-note">Fond de carte local, sans aucun service extérieur · position des officines : adresse de l’annuaire, sinon le centre de la commune · ' + C.horsSecteur.length + ' officines de la liste sont hors des ' + C.departements.length + ' départements et n’apparaissent pas ici.</p></div>';
  cadrer();
  I = ca.creer({ zone: $('#cs-zone', el), id: 'cs', aria: 'Carte du secteur : ' + C.points.length + ' officines localisées', rayon: function (p) { return ca.PALIER_R[ca.palier(p)]; }, couleur: function (p) { return ca.couleurPalier(ca.palier(p)); }, visible: visible,
    onClic: function (p) { ouvrirBulle(p); }, onVide: fermerBulle, apres: placerBulle, libre: function (w, h) { return MOBILE() ? { x0: 14, y0: 70, x1: w - 14, y1: h - 120 } : { x0: 84, y0: 76, x1: w - 24, y1: h - 60 }; } });
  $('#cs-zone', el).insertAdjacentHTML('beforeend', '<div class="ca-flot ca-ronds"><button type="button" class="b-rond" data-z="+" aria-label="Zoom avant">' + J.ico('plus') + '</button><button type="button" class="b-rond" data-z="-" aria-label="Zoom arrière">' + J.ico('minus') + '</button><button type="button" class="b-rond" data-z="pos" aria-label="Recentrer sur mon secteur">' + J.ico('locate') + '</button></div>' +
    '<div class="ca-flot ca-bas"><span class="ca-ech"><i id="cs-ech"></i><em>10 km</em></span></div>' +
    '<div class="ca-flot ca-leg" id="cs-leg"><b>Chiffre d’affaires · ' + ca.NM + ' mois</b>' + ca.PALIER_LIB.map(function (l, i) { var d = ca.PALIER_R[i] * 1.6; return '<span><i class="dot" style="width:' + d + 'px;height:' + d + 'px;background:' + ca.couleurPalier(i) + '"></i>' + l + '</span>'; }).join('') + '</div>' +
    '<div class="ca-bulle" id="cs-bulle" role="dialog" aria-label="Officine" hidden></div>');
  J.poseIcones(el); I.points(); majCpt();
  var vs = $('.cs-sousnav .vues', el), on = vs ? $('.on', vs) : null; if (vs && on) { var dx = on.getBoundingClientRect().right - vs.getBoundingClientRect().right; if (dx > 0) vs.scrollLeft += dx + 6; }   /* au téléphone la pilule des quatre vues défile : l'onglet actif (le 4e) doit être visible */
  $('#cs-com', el).onchange = function (e) { K.com = e.target.value; fermerBulle(); I.maj(); majCpt(); };
  $('#cs-q', el).oninput = function (e) { K.q = e.target.value; fermerBulle(); I.maj(); majCpt(); };
  $$('[data-z]', el).forEach(function (b) { b.onclick = function () { I.vue(b.getAttribute('data-z')); }; });
  if (!ecoute) { ecoute = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerBulle(); });
    window.addEventListener('resize', function () { var s = $('#ecran-carte-secteur'); if (s && !s.hidden && I) { cadrer(); I.redessiner(); } }); }
}
J.ecrans['carte-secteur'] = {
  rendre: function (el) { if (!I || !$('#cs-zone', el)) construire(el); else { cadrer(); I.redessiner(); I.maj(); majCpt(); } }
};
})();
