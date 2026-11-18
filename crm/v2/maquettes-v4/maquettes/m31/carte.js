/* m31 — Carte du secteur : carte plein cadre à contrôles flottants, fond LOCAL (aucune tuile), 300 points, volet / tiroir de l'officine. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, S = J.S, C = J.C, D = J.D;
var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PADM = 14;
var MW = (BB.est - BB.ouest) * CM * KM + 2 * PADM, MH = (BB.nord - BB.sud) * KM + 2 * PADM;
function MX(lng) { return PADM + (lng - BB.ouest) * CM * KM; }
function MY(lat) { return PADM + (BB.nord - lat) * KM; }
var MOBILE = function () { return window.innerWidth <= 760; };
var FOND = null;
function fondPaths() {
  if (FOND) return FOND; FOND = '';
  window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    FOND += '<path d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '" class="terre"/>'; });
  return FOND;
}
/* points : taille et clarté d'UNE teinte = chiffre d'affaires ; prospects en gris ; une 2e teinte seulement pour « À rappeler » */
function tCA(ca) { return Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); }
function teinteCA(ca) { var t = tCA(ca), a = [174, 196, 240], b = [26, 66, 160]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }).join(',') + ')'; }
function estClient(p) { return p.statut === 'cliente' || p.statut === 'à rappeler'; }
function rayonPx(p) { var m = MOBILE(); if (S.couche === 'statut') return estClient(p) ? (m ? 6 : 7.5) : (m ? 4.5 : 5.5); return estClient(p) ? (m ? 4.6 : 5.4) + tCA(p.ca) * (m ? 4.4 : 6.6) : (m ? 4.2 : 5); }
function couleurPoint(p) {
  if (S.couche === 'statut') return p.statut === 'à rappeler' ? 'var(--e-attention)' : p.statut === 'cliente' ? 'var(--c-ca)' : p.statut === 'prospect' ? 'var(--enc-4)' : 'var(--enc-5)';
  return p.statut === 'à rappeler' ? 'var(--e-attention)' : p.statut === 'cliente' ? teinteCA(p.ca) : p.statut === 'prospect' ? 'var(--enc-4)' : 'var(--enc-5)';
}
function pointVisible(p) {
  if (S.cf === 'clients' && !estClient(p)) return false;
  if (S.cf === 'prospects' && estClient(p)) return false;
  if (S.ccom && p.commercial !== S.ccom) return false;
  if (S.cgrp && p.groupement !== S.cgrp) return false;
  if (S.cq && (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(S.cq.toLowerCase()) < 0) return false;
  return true;
}
var rendue = false, POS = null, VUE = { cx: 0, cy: 0, s: 1, s0: 1, k: 1 }, DEPL = false;
function mesurer() { var z = $('#c-zone'), r = z.getBoundingClientRect(); return { w: Math.max(300, r.width), h: Math.max(300, r.height) }; }
function librePx(w, h) { return MOBILE() ? { x0: 14, y0: 150, x1: w - 14, y1: h - 150 } : { x0: 92, y0: 140, x1: w - 440, y1: h - 76 }; }
function obstacles() { /* contrôles flottants visibles, en pixels de la zone (vue de départ) : aucun centre de point ne doit tomber dessous */
  var z = $('#c-zone'); if (!z) return [];
  var zr = z.getBoundingClientRect();
  return $$('.c-haut > *, .c-act > *, .c-ronds > *, .c-bas > *, .c-leg', z).map(function (e) { return e.getBoundingClientRect(); })
    .filter(function (r) { return r.width >= 1 && r.height >= 1; })
    .map(function (r) { return [r.left - zr.left, r.top - zr.top, r.right - zr.left, r.bottom - zr.top]; });
}
function horsControles(o, ob, ox, oy, w, h) { /* sort le point du contrôle qui le couvre, par le côté le plus proche qui reste dans la zone */
  var sx = o.x + ox, sy = o.y + oy, mg = o.r + 3, best = null;
  function couvrant(x, y) { for (var i = 0; i < ob.length; i++) { var b = ob[i]; if (x > b[0] - mg && x < b[2] + mg && y > b[1] - mg && y < b[3] + mg) return b; } return null; }
  if (!couvrant(sx, sy)) return false;
  for (var dir = 0; dir < 4; dir++) { var x = sx, y = sy, b, n = 0;
    while ((b = couvrant(x, y)) && n++ < 8) { if (dir === 0) x = b[0] - mg; else if (dir === 1) x = b[2] + mg; else if (dir === 2) y = b[1] - mg; else y = b[3] + mg; }
    if (couvrant(x, y) || x < mg || x > w - mg || y < mg || y > h - mg) continue;
    var dd = Math.abs(x - sx) + Math.abs(y - sy); if (!best || dd < best[2]) best = [x, y, dd]; }
  if (!best) return false;
  o.x = best[0] - ox; o.y = best[1] - oy; return true;
}
function positions() { /* léger écartement en pixels : le centre d'aucun point n'est caché par un autre, ni par un contrôle flottant */
  if (POS) return POS;
  var s0 = VUE.s0, L = C.points.map(function (p) { return { p: p, x: MX(p.lng) * s0, y: MY(p.lat) * s0, r: rayonPx(p) }; });
  var m0 = mesurer(), ob = obstacles(), ox = m0.w / 2 - VUE.cx0 * s0, oy = m0.h / 2 - VUE.cy0 * s0;
  var sortir = function (o) { if (horsControles(o, ob, ox, oy, m0.w, m0.h)) bouge = true; };
  for (var it = 0; it < 70; it++) { var bouge = false;
    for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
      var a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = a.r + b.r + 2.2;
      if (d < m) { var k = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; k = m / 2; } a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; bouge = true; } }
    L.forEach(sortir);
    if (!bouge) break; }
  L.forEach(sortir);
  POS = {}; L.forEach(function (o) { POS[o.p.id] = [o.x / s0, o.y / s0]; }); return POS;
}
function appliquerVue() {
  var z = $('#c-zone'); if (!z) return; var m = mesurer(), sv = $('#c-svg');
  var w = m.w / VUE.s, h = m.h / VUE.s, x = VUE.cx - w / 2, y = VUE.cy - h / 2;
  if (![x, y, w, h].every(isFinite)) return;
  sv.setAttribute('viewBox', x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2));
  var rc = sv.getBoundingClientRect(), k = Math.min(rc.width / w, rc.height / h); if (!isFinite(k) || k <= 0) k = VUE.s;
  VUE.k = k;
  $$('#c-pts [data-point]').forEach(function (c) { c.setAttribute('r', (+c.getAttribute('data-r') / k).toFixed(2)); c.setAttribute('stroke-width', (1.6 / k).toFixed(2)); });
  $$('#c-dep text').forEach(function (t) { t.setAttribute('font-size', (13.5 / k).toFixed(2)); });
  var ox = (rc.width - w * k) / 2, oy = (rc.height - h * k) / 2;
  $$('.c-ville', z).forEach(function (e) { var lng = +e.getAttribute('data-lng'), lat = +e.getAttribute('data-lat'); e.style.left = (ox + (MX(lng) - x) * k + 10).toFixed(1) + 'px'; e.style.top = (oy + (MY(lat) - y) * k - 26).toFixed(1) + 'px'; });
  var ech = $('#c-ech'); if (ech) ech.style.width = Math.round((10 / 111.2) * KM * k) + 'px';
  majSel(); dessinerTournee();
}
function ajusterVue() {
  var m = mesurer(), f = librePx(m.w, m.h), fw = f.x1 - f.x0, fh = f.y1 - f.y0;
  VUE.s0 = Math.min(fw / MW, fh / MH); VUE.s = VUE.s0;
  var px = f.x0 + fw / 2, py = f.y0 + fh / 2;
  VUE.cx = MW / 2 + (m.w / 2 - px) / VUE.s; VUE.cy = MH / 2 + (m.h / 2 - py) / VUE.s; VUE.cx0 = VUE.cx; VUE.cy0 = VUE.cy;
}
function pointProche(ev) { /* zone de clic plus large que le point : le point le plus proche du doigt (22 px) */
  var sv = $('#c-svg'), pt = sv.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; var mm = sv.getScreenCTM(); if (!mm) return null;
  var q = pt.matrixTransform(mm.inverse()), pos = positions(), best = null, bd = 1e9;
  C.points.forEach(function (p) { if (!pointVisible(p)) return; var d = Math.sqrt(Math.pow(pos[p.id][0] - q.x, 2) + Math.pow(pos[p.id][1] - q.y, 2)) * VUE.k; if (d < bd) { bd = d; best = p; } });
  return bd <= 22 ? best : null;
}
J.renderCarte = function () {
  var el = $('#ecran-carte');
  el.innerHTML =
    '<div class="c-tete"><div><h1>Carte du secteur</h1><p class="note">La carte de votre secteur · <span id="c-cpt-t"></span></p></div>' +
    '<div class="onglets-l" role="group" aria-label="Vues"><a href="#liste"><span class="ico" data-ico="home"></span>Officines</a><button type="button" data-stub="L’écran Groupements n’est pas dessiné dans cette maquette."><span class="ico" data-ico="group"></span>Groupements</button><button type="button" data-stub="L’écran Mes listes n’est pas dessiné dans cette maquette."><span class="ico" data-ico="list"></span>Mes listes</button><a href="#carte" class="on"><span class="ico" data-ico="pin"></span>Carte secteur</a></div></div>' +
    '<div class="c-zone" id="c-zone"><svg id="c-svg" class="c-svg" role="img" aria-label="Carte du secteur : ' + C.points.length + ' officines"><defs><radialGradient id="c-mer" cx="30%" cy="12%" r="90%"><stop offset="0" stop-color="#EEF4FB"/><stop offset="1" stop-color="#D5E2EF"/></radialGradient></defs>' +
    '<rect id="c-fond" x="-2000" y="-2000" width="5000" height="5000" fill="url(#c-mer)"/><g id="c-terre">' + fondPaths() + '</g><g id="c-dep"></g><g id="c-tr"></g><g id="c-pts"></g><g id="c-selg"></g></svg>' +
    '<div class="c-haut"><label class="c-rech"><span class="ico" data-ico="search"></span><input id="c-q" type="search" placeholder="Une pharmacie, une ville, un code postal" aria-label="Rechercher sur la carte" value="' + esc(S.cq) + '"></label>' +
    '<div class="c-chips"><div class="seg" role="group" aria-label="Afficher"><button type="button" data-filtre="tout" aria-pressed="true">Tout</button><button type="button" data-filtre="clients" aria-pressed="false">Clients</button><button type="button" data-filtre="prospects" aria-pressed="false">Prospects</button></div>' +
    '<button type="button" class="chip c-bfiltres" id="c-bf" aria-expanded="false"><span class="ico" data-ico="filtre"></span>Filtres</button>' +
    '<span class="c-sec" id="c-sec"><label class="filtre">Commercial<select id="c-com" aria-label="Commercial"><option value="">Tous</option>' + C.commerciaux.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
    '<label class="filtre">Groupement<select id="c-grp" aria-label="Groupement"><option value="">Tous</option>' + C.groupements.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label></span></div></div>' +
    '<div class="c-act"><b class="cpt-pil num" id="c-cpt"></b><button class="pil" type="button" data-act="liste"><span class="ico" data-ico="list"></span>Liste</button><button class="pil" type="button" data-stub="L’exportation n’est pas dessinée dans cette maquette."><span class="ico" data-ico="down"></span>Excel</button><button class="pil plein" type="button" data-act="tournee"><span class="ico" data-ico="route"></span>Ma tournée <b class="cpt7" id="c-nt">0</b></button></div>' +
    '<div class="c-ronds"><button type="button" class="b-rond" data-z="+" aria-label="Zoom avant"><span class="ico" data-ico="plus"></span></button><button type="button" class="b-rond" data-z="-" aria-label="Zoom arrière"><span class="ico" data-ico="minus"></span></button><button type="button" class="b-rond" data-z="pos" aria-label="Recentrer sur mon secteur"><span class="ico" data-ico="locate"></span></button></div>' +
    '<div class="c-bas"><button type="button" class="b-rond" data-act="couche" aria-label="Changer la couleur des points" aria-pressed="false"><span class="ico" data-ico="layers"></span></button><button type="button" class="pil" data-act="zones" aria-pressed="false" aria-label="Afficher les départements">Zones</button><span class="ech"><i id="c-ech"></i><em>10 km</em></span></div>' +
    '<div class="c-leg" id="c-leg"></div><div id="c-volet-zone"></div></div>' +
    '<p class="note c-note">Fond de carte local, sans service extérieur. ' + C.noteSegments + ' Treize officines de la liste sont hors des six départements et n’apparaissent pas ici. Données fictives.</p>';
  J.poseIcones(el); rendue = true; construirePoints();
  var z = $('#c-zone');
  $('#c-svg').addEventListener('click', function (ev) { if (DEPL) return; var c = ev.target.closest && ev.target.closest('[data-point]'), id = c ? c.getAttribute('data-point') : null; if (!id) { var p = pointProche(ev); id = p ? p.id : null; } if (!id) return; S.volet = id; if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; });
  $$('[data-filtre]', el).forEach(function (b) { b.onclick = function () { S.cf = b.getAttribute('data-filtre'); majCarte(); }; });
  $('#c-q', el).oninput = function (e) { S.cq = e.target.value; majCarte(); };
  $('#c-com', el).onchange = function (e) { S.ccom = e.target.value; majCarte(); };
  $('#c-grp', el).onchange = function (e) { S.cgrp = e.target.value; majCarte(); };
  $('#c-bf', el).onclick = function () { var o = $('#c-sec').classList.toggle('ouvert'); this.setAttribute('aria-expanded', String(o)); };
  $('[data-act="liste"]', el).onclick = ouvrirListeCarte;
  $('[data-act="tournee"]', el).onclick = ouvrirTournee;
  $('[data-act="couche"]', el).onclick = function () { S.couche = S.couche === 'ca' ? 'statut' : 'ca'; this.setAttribute('aria-pressed', String(S.couche === 'statut')); recolorer(); };
  $('[data-act="zones"]', el).onclick = function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', String(o)); $('#c-dep').style.display = o ? '' : 'none'; $('#c-terre').classList.toggle('zones', o); };
  $$('[data-z]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-z'); if (k === '+') VUE.s = Math.min(VUE.s0 * 5, VUE.s * 1.5); else if (k === '-') VUE.s = Math.max(VUE.s0, VUE.s / 1.5); else { VUE.s = VUE.s0; VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } if (VUE.s === VUE.s0) { VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } appliquerVue(); }; });
  var dep = null;
  z.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.c-haut,.c-ronds,.c-bas,.c-leg,.volet,.c-act')) return; dep = { x: ev.clientX, y: ev.clientY, cx: VUE.cx, cy: VUE.cy, bouge: false }; });
  window.addEventListener('pointermove', function (ev) { if (!dep) return; var dx = ev.clientX - dep.x, dy = ev.clientY - dep.y; if (Math.abs(dx) + Math.abs(dy) > 6) dep.bouge = true; if (dep.bouge && VUE.s > VUE.s0 * 1.02) { DEPL = true; VUE.cx = dep.cx - dx / VUE.s; VUE.cy = dep.cy - dy / VUE.s; appliquerVue(); } });
  window.addEventListener('pointerup', function () { if (dep && dep.bouge) setTimeout(function () { DEPL = false; }, 60); dep = null; });
  z.addEventListener('wheel', function (ev) { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); VUE.s = Math.max(VUE.s0, Math.min(VUE.s0 * 5, VUE.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); if (VUE.s === VUE.s0) { VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } appliquerVue(); }, { passive: false });
  legende(); majCarte();
};
function construirePoints() {
  ajusterVue(); POS = null; var pos = positions();
  var ordre = C.points.slice().sort(function (a, b) { return (estClient(b) ? 1 : 0) - (estClient(a) ? 1 : 0) || b.ca - a.ca; });
  $('#c-pts').innerHTML = ordre.map(function (p) { return '<circle data-point="' + p.id + '" data-statut="' + p.statut + '" data-r="' + rayonPx(p).toFixed(1) + '" cx="' + pos[p.id][0].toFixed(2) + '" cy="' + pos[p.id][1].toFixed(2) + '" r="3" fill="' + couleurPoint(p) + '" stroke="#fff" stroke-width="1" tabindex="-1"><title>' + esc(J.joli(p.nom)) + '</title></circle>'; }).join('');
  $$('#c-zone .c-ville').forEach(function (e) { e.remove(); });
  window.VILLES_PACA.filter(function (v) { return v.rang <= 2; }).forEach(function (v) { var d = document.createElement('span'); d.className = 'c-ville'; d.setAttribute('data-lng', v.lng); d.setAttribute('data-lat', v.lat); d.textContent = v.nom; $('#c-zone').appendChild(d); });
  var dep = {}; window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, mx = 0, my = 0, k = 0; polys[0][0].forEach(function (c) { mx += c[0]; my += c[1]; k++; }); dep[f.properties.code] = '<text x="' + MX(mx / k).toFixed(1) + '" y="' + MY(my / k).toFixed(1) + '" text-anchor="middle" fill="var(--enc-3)" font-weight="700" letter-spacing=".08em" pointer-events="none">' + esc(f.properties.nom.toUpperCase()) + '</text>'; });
  $('#c-dep').innerHTML = Object.keys(dep).map(function (k) { return dep[k]; }).join(''); $('#c-dep').style.display = 'none';
  appliquerVue();
}
function recolorer() { POS = null; var pos = positions(); $$('#c-pts [data-point]').forEach(function (c) { var p = J.pointById(c.getAttribute('data-point')); c.setAttribute('fill', couleurPoint(p)); c.setAttribute('data-r', rayonPx(p).toFixed(1)); c.setAttribute('cx', pos[p.id][0].toFixed(2)); c.setAttribute('cy', pos[p.id][1].toFixed(2)); }); legende(); appliquerVue(); }
function legende() {
  var dot = function (c, d) { return '<i class="dot" style="width:' + d + 'px;height:' + d + 'px;background:' + c + '"></i>'; };
  $('#c-leg').innerHTML = S.couche === 'ca'
    ? '<b>Chiffre d’affaires</b><span>' + dot(teinteCA(2000), 9) + 'petit</span><span>' + dot(teinteCA(60000), 13) + 'moyen</span><span>' + dot(teinteCA(900000), 18) + 'grand</span><span>' + dot('var(--e-attention)', 10) + 'À rappeler</span><span>' + dot('var(--enc-4)', 9) + 'Prospect</span>'
    : '<b>Statut</b><span>' + dot('var(--c-ca)', 12) + 'Cliente</span><span>' + dot('var(--e-attention)', 12) + 'À rappeler</span><span>' + dot('var(--enc-4)', 10) + 'Prospect</span><span>' + dot('var(--enc-5)', 10) + 'Aucune vente</span>';
}
function majCarte() {
  var n = 0;
  $$('#c-pts [data-point]').forEach(function (c) { var p = J.pointById(c.getAttribute('data-point')), v = pointVisible(p); c.style.display = v ? '' : 'none'; if (v) n++; });
  $$('[data-filtre]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtre') === S.cf)); });
  $('#c-cpt').textContent = nf.format(n) + ' officines'; $('#c-cpt-t').textContent = nf.format(C.points.length) + ' officines localisées';
  $('#c-nt').textContent = Object.keys(S.tour).filter(function (k) { return S.tour[k]; }).length || C.tournee.arrets.length;
  dessinerTournee();
}
function majSel() {
  var g = $('#c-selg'); if (!g) return;
  var vz = $('#c-volet-zone .volet'), p = S.volet && vz && !vz.hidden ? J.pointById(S.volet) : null;
  if (!p) { g.innerHTML = ''; return; }
  var q = positions()[p.id], k = 1 / (VUE.k || VUE.s);
  g.innerHTML = '<circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (24 * k).toFixed(2) + '" fill="var(--c-ca)" fill-opacity=".14" pointer-events="none"/><circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (17 * k).toFixed(2) + '" fill="var(--c-ca)" stroke="#fff" stroke-width="' + (3 * k).toFixed(2) + '" pointer-events="none"/><text x="' + q[0].toFixed(2) + '" y="' + (q[1] + 5 * k).toFixed(2) + '" text-anchor="middle" font-size="' + (14 * k).toFixed(2) + '" font-weight="700" fill="#fff" pointer-events="none">' + esc(J.ini(p.nom)) + '</text>';
}
function dessinerTournee() {
  var g = $('#c-tr'); if (!g) return;
  if (!S.tourVue) { g.innerHTML = ''; return; }
  var d = C.tournee, pos = positions(), k = 1 / (VUE.k || VUE.s), pts = [[MX(d.depot.lng), MY(d.depot.lat)]].concat(d.arrets.map(function (a) { var q = pos[a.id]; return [q[0], q[1]]; }));
  g.innerHTML = '<path d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '" fill="none" stroke="var(--c-ca)" stroke-width="' + (4 * k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    pts.map(function (q, i) { return '<g pointer-events="none"><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (11 * k).toFixed(2) + '" fill="#fff" stroke="var(--c-ca)" stroke-width="' + (3 * k).toFixed(2) + '"/><text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4.5 * k).toFixed(1) + '" font-size="' + (13 * k).toFixed(2) + '" font-weight="700" text-anchor="middle" fill="var(--enc-1)">' + (i ? i : 'D') + '</text></g>'; }).join('');
}
function ouvrirTournee() {
  S.tourVue = true; dessinerTournee(); var d = C.tournee;
  J.panneau('Ma tournée', '<p class="note">' + esc(d.nom) + ' · départ ' + d.depart.replace(':', ' h ') + '</p><div class="duo"><div><span class="co-l">Arrêts</span><b class="grand num">' + d.arrets.length + '</b></div><div><span class="co-l">Distance</span><b class="grand num">' + d.kmTotal + ' km</b></div><div><span class="co-l">Fin</span><b class="grand num">' + d.fin.replace(':', ' h ') + '</b></div></div>' +
    '<div class="lp-tab"><div class="lp-l"><span class="lp-nom"><b>Départ · ' + esc(d.depot.nom) + '</b><span class="sub">' + esc(d.depot.adresse) + '</span></span><span class="num cat-v">' + d.depart.replace(':', ' h ') + '</span></div>' +
    d.arrets.map(function (a) { var p = J.pointById(a.id); return '<div class="lp-l"><span class="lp-nom"><b>' + a.ordre + '. ' + esc(J.joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · visite de ' + a.dureeVisite + ' min · ' + a.kmDepuisPrecedent + ' km depuis l’arrêt précédent</span></span><span class="num cat-v">' + a.arrivee.replace(':', ' h ') + '</span></div>'; }).join('') + '</div>' +
    '<a class="pil" href="#carte" data-stub="L’itinéraire externe n’est pas dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</a>');
}
function ouvrirListeCarte() {
  var l = C.points.filter(pointVisible).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 40);
  var p = J.panneau('Liste des pharmacies', '<p class="note">' + l.length + ' premières, classées par chiffre d’affaires.</p><div class="lp-tab">' + l.map(function (q) { return '<button type="button" class="lp-l lp-b" data-ouvre="' + q.id + '"><span class="lp-nom"><b>' + esc(J.joli(q.nom)) + '</b><span class="sub">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.groupement) + '</span></span><span class="num cat-v">' + (q.ca ? eur(q.ca) : '—') + '</span></button>'; }).join('') + '</div>');
  $$('[data-ouvre]', p).forEach(function (b) { b.onclick = function () { p.hidden = true; S.volet = b.getAttribute('data-ouvre'); if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; }; });
}
function majVolet(ouvert) {
  var zone = $('#c-volet-zone'); if (!zone) return; var v = $('.volet', zone);
  if (!v) { v = document.createElement('aside'); v.className = 'volet'; v.setAttribute('data-volet', ''); v.setAttribute('aria-label', 'Fiche de l’officine'); zone.appendChild(v); }
  if (!ouvert || !S.volet) { v.hidden = true; majSel(); return; }
  var p = J.pointById(S.volet), cm = p.caParMois || [], ml10 = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'], ex = J.offById(p.id);
  v.innerHTML = '<button type="button" class="grabber" aria-label="Agrandir ou réduire la fiche"></button><div class="vo-t"><span class="vo-av" aria-hidden="true">' + esc(J.ini(p.nom)) + '</span><div><h2>' + esc(J.joli(p.nom)) + '</h2><p class="note">' + esc(p.titulaire) + ' · ' + esc(p.ville) + ' · ' + p.cp + '</p></div><button type="button" class="b-rond" data-fermer-volet aria-label="Fermer la fiche"><span class="ico" data-ico="close"></span></button></div>' +
    '<div class="pastilles"><span class="chip-p">' + (p.statut === 'à rappeler' ? 'À rappeler' : p.statut === 'cliente' ? p.segment : p.statut === 'prospect' ? 'Prospect' : 'Aucune vente') + '</span><span class="chip-p">' + esc(p.commercial) + '</span><span class="chip-p">' + esc(p.groupement) + '</span><span class="chip-p">n° ' + p.id + '</span></div>' +
    (p.ca ? '<div class="trois-v"><div><span class="co-l">Chiffre d’affaires (10 mois)</span><b class="num mont">' + J.gros(eur(p.ca)) + '</b></div><div><span class="co-l">Références</span><b class="num mont">' + nf.format(Math.round(p.ca / 1100)) + '</b></div><div><span class="co-l">Potentiel</span><b class="num mont">' + J.gros(eur(p.ca * 1.35)) + '</b></div></div>' +
    '<h3>Chiffre d’affaires par mois</h3><div class="chart-box" id="vo-c"></div><h3>Produits phares</h3><div class="lp-tab">' + (p.produits || []).map(function (q) { return '<div class="lp-l"><span class="lp-nom"><b>' + esc(q.nom.split(',')[0]) + '</b></span><span class="num cat-v">' + eur(q.ca) + '</span></div>'; }).join('') + '</div>' : '<p class="note">Pas encore de ventes réseau pour cette officine.</p>') +
    '<div class="vo-l"><span class="co-l">Téléphone</span><b>' + esc(p.telephone) + '</b></div>' +
    (p.suivi ? '<div class="vo-l"><span class="co-l">Dernière visite</span><b>' + J.dateFr(p.suivi.derniereVisite) + '</b></div><div class="vo-l"><span class="co-l">Prochain rendez-vous</span><b>' + (p.suivi.prochainRendezVous ? J.dateFr(p.suivi.prochainRendezVous.date) + ' à ' + p.suivi.prochainRendezVous.heure.replace(':', ' h ') : '—') + '</b></div>' : '') +
    '<div class="vo-act">' + (ex ? '<button class="pil plein" type="button" data-action="ouvrir-fiche">Ouvrir la fiche complète</button>' : '<button class="pil" type="button" data-stub="La fiche complète n’est pas dessinée pour cette officine fictive.">Ouvrir la fiche complète</button>') + '<button class="pil" type="button" data-act="ajout">' + (S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button><button class="pil" type="button" data-stub="L’itinéraire externe n’est pas dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</button></div>';
  J.poseIcones(v); v.hidden = false; v.setAttribute('data-cran', '1');
  if (p.ca) J.dessine($('#vo-c', v), function (w) { return J.colonnes({ labels: ml10.map(function (l) { return l.slice(0, 3); }), vals: cm, couleur: 'var(--c-ca)', h: 130, aria: 'Chiffre d’affaires par mois de ' + J.joli(p.nom) }, w); }, function (b) { J.lie(b, cm.map(function (x, i) { return '<b>' + ml10[i] + '</b> : ' + eur(x); }), null); });
  $('[data-fermer-volet]', v).onclick = function () { S.volet = null; location.hash = '#carte'; };
  $('.grabber', v).onclick = function () { var c = +v.getAttribute('data-cran'); v.setAttribute('data-cran', String(c >= 3 ? 1 : c + 1)); };
  var of = $('[data-action="ouvrir-fiche"]', v); if (of) of.onclick = function () { S.off = p.id; v.hidden = true; location.hash = '#fiche'; };
  $('[data-act="ajout"]', v).onclick = function (e) { S.tour[p.id] = !S.tour[p.id]; e.currentTarget.textContent = S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée'; majCarte(); };
  majSel();
}
J.carteMontrer = function (h) {
  if (!rendue) J.renderCarte();
  cadrer(); construirePoints(); majCarte();
  if (h === 'carte-fiche') { if (!S.volet) S.volet = C.points.filter(function (p) { return p.segment === 'Client A'; })[0].id; majVolet(true); } else majVolet(false);
};
J.carteVoletOff = function () { majVolet(false); };
function cadrer() { /* la carte prend tout l'écran sous la barre du haut (et au-dessus de la barre d'onglets du téléphone) */
  var s = $('#ecran-carte'), z = $('#c-zone'); if (!z) return;
  var top = z.getBoundingClientRect().top, bas = MOBILE() ? 76 : 0, noteH = 46;
  var h = Math.max(520, window.innerHeight - top - bas - noteH); if (isFinite(h)) s.style.setProperty('--h-carte', h + 'px');
}
window.addEventListener('resize', function () { if (rendue && $('#ecran-carte') && !$('#ecran-carte').hidden) { cadrer(); POS = null; construirePoints(); majCarte(); } });
})();
