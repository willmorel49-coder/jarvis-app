/* m29 — Revolut transposé en clair. Une page, quatre écrans : liste, fiche, pilotage, carte. Données fictives : donnees.js + donnees-v4.js. */
(function () {
'use strict';
var D = window.DONNEES, V = window.DONNEES_V4, P = V.pilotage, C = V.carte;
var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var fixe = function (f) { return { format: function (n) { return f.format(n).replace(/[\u202f\u00a0]/g, '\u00a0'); } }; };
var nf = fixe(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }));
var nf1 = fixe(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
var nf2 = fixe(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }));
function eur(n) { return nf.format(Math.round(n)) + ' €'; }
function eurM(n) { return Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + ' M€' : eur(n); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function signe(p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + nf.format(Math.abs(Math.round(p))) + ' %'; }
function gros(txt) { var m = String(txt).match(/^(.*?)(\s?(?:€|M€|k€))$/); return m ? esc(m[1]) + '<small>' + esc(m[2].trim()) + '</small>' : esc(txt); }
function dfr(d) { return d.split('-').reverse().join('/'); }
function ini(n) { return n.replace(/^(PHARMACIE|PHIE)\s+(DU|DE LA|DE|DES|D’|DE L’)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'P'; }
var PETITS = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'd’', 'l’', 'aux', 'au'];
function joli(n) { var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  return String(n).toLowerCase().replace(/'/g, '’').split(' ').map(function (t, k) {
    if (k > 0 && PETITS.indexOf(t) >= 0) return t;
    return t.split('-').map(function (s, q) { if (q > 0 && PETITS.indexOf(s) >= 0) return s; var ap = s.indexOf('’'); return ap > 0 && ap < 3 ? s.slice(0, ap + 1) + cap(s.slice(ap + 1)) : cap(s); }).join('-'); }).join(' '); }
var ICO = {
  bank: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pin: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16 9.5"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>',
  haut: '<path d="M7 17L17 7M9 7h8v8"/>',
  bas: '<path d="M7 7l10 10M17 9v8H9"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/>',
  euro: '<path d="M17 6.5a6 6 0 1 0 0 11M5 10h8M5 14h8"/>',
  grp: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20c.6-3.6 3-5 6-5s5.4 1.4 6 5M15.5 15.2c3-.4 5 1 5.5 4.8"/>',
  mol: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><circle cx="12" cy="17" r="3"/><path d="M10.5 10.5l1 4M15.5 10.5l-2 4.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'
};
function icoSvg(k, c) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + (ICO[k] || '') + '</svg>'; }
function poseIcones(r) { $$('[data-ico]', r).forEach(function (e) { if (!e.firstChild) e.innerHTML = icoSvg(e.getAttribute('data-ico')); }); }
function toast(t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2600); }
function compter(el, fin, fmt, dur) {
  if (!isFinite(fin)) fin = 0;
  if (RM || !el) { if (el) el.innerHTML = fmt(fin); return; }
  var t0 = null; dur = dur || 900;
  function pas(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.innerHTML = fmt(fin * e); if (k < 1) requestAnimationFrame(pas); else el.innerHTML = fmt(fin); }
  requestAnimationFrame(pas);
}
/* ---------- courbes lisses (le seul graphique de Revolut qu'on imite : la ligne fine d'un compte, ici inventée) ---------- */
function lisse(pts) { /* interpolation monotone : jamais de dépassement sous la ligne de base */
  var n = pts.length; if (n < 2) return ''; var dx = [], m = [], t = [], i;
  for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (i = 0; i < n - 1; i++) { var h = dx[i] / 3; d += 'C' + (pts[i][0] + h).toFixed(1) + ' ' + (pts[i][1] + t[i] * h).toFixed(1) + ' ' + (pts[i + 1][0] - h).toFixed(1) + ' ' + (pts[i + 1][1] - t[i + 1] * h).toFixed(1) + ' ' + pts[i + 1][0].toFixed(1) + ' ' + pts[i + 1][1].toFixed(1); }
  return d;
}
var gid = 0;
function spark(vals, moy, w, h, couleur, aria) {
  if (!vals.length || !vals.every(isFinite)) return '';
  var all = vals.concat(moy ? [moy] : []), max = Math.max.apply(null, all), min = Math.min.apply(null, all), pad = 4;
  if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / Math.max(1, vals.length - 1); };
  var Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); };
  var pts = vals.map(function (v, i) { return [X(i), Y(v)]; });
  var s = '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(aria || 'Courbe') + '">';
  if (moy) s += '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + Y(moy).toFixed(1) + '" y2="' + Y(moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.2" stroke-dasharray="3 3"/>';
  s += '<path class="trace" pathLength="1" d="' + lisse(pts) + '" fill="none" stroke="' + couleur + '" stroke-width="2" stroke-linecap="round"/><circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="3" fill="' + couleur + '"/></svg>';
  return s;
}
function spark2(a, b, w, h, ca) { /* la valeur regardée en couleur, la Moyenne Intégral en gris pointillé */
  if (!a.every(isFinite) || !b.every(isFinite)) return '';
  var all = a.concat(b), max = Math.max.apply(null, all), min = Math.min.apply(null, all), pad = 4; if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / (a.length - 1); }, Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); };
  var p = function (arr) { return lisse(arr.map(function (v, i) { return [X(i), Y(v)]; })); };
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" role="img" aria-label="Évolution sur 13 mois"><path d="' + p(b) + '" fill="none" stroke="var(--c-moyenne)" stroke-width="1.6" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/><path class="trace" pathLength="1" d="' + p(a) + '" fill="none" stroke="' + ca + '" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
}
function anneau(score) {
  var r = 9.5, c = 2 * Math.PI * r;
  return '<svg class="anneau" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="' + r + '" fill="none" stroke="var(--enc-5)" stroke-width="3"/><circle cx="12" cy="12" r="' + r + '" fill="none" stroke="var(--c-ca)" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (c * score / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 12 12)"/></svg>';
}
function niceTop(max) { var raw = max / 3, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p * 3; }
/* Courbe de lecture : cfg = {box, labels, vals, ligne2:{vals,couleur}, moy, moyTxt, couleur, incompl, h, aria, lecteur(i), etiq:[idx,...], fmt} */
function courbe(cfg) {
  var box = cfg.box, w = Math.max(260, Math.round(box.clientWidth || 340)), h = cfg.h || 220, vals = cfg.vals, n = vals.length;
  if (!n || !vals.every(isFinite) || (cfg.ligne2 && !cfg.ligne2.vals.every(isFinite))) { box.innerHTML = ''; return; }
  var L = 14, R = 14, T = 34, B = 30, iw = w - L - R, ih = h - T - B;
  var tout = vals.concat(cfg.ligne2 ? cfg.ligne2.vals : [], cfg.moy ? [cfg.moy] : [], [1]);
  var top = Math.max.apply(null, tout) * 1.08;
  var X = function (i) { return L + i * iw / Math.max(1, n - 1); }, Y = function (v) { return T + ih - v / top * ih; };
  var id = 'g' + (++gid), inc = cfg.incompl != null ? cfg.incompl : -1, fin = inc >= 0 ? inc : n;
  var pts = vals.slice(0, fin).map(function (v, i) { return [X(i), Y(v)]; });
  var d = lisse(pts), s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(cfg.aria || 'Courbe') + '">';
  s += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + cfg.couleur + '" stop-opacity=".16"/><stop offset="1" stop-color="' + cfg.couleur + '" stop-opacity="0"/></linearGradient></defs>';
  [0, .5, 1].forEach(function (k) { var y = Y(top / 1.08 * k); s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--filet)" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>'; });
  if (cfg.moy != null) {
    s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(cfg.moy).toFixed(1) + '" y2="' + Y(cfg.moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="5 4"/>';
    s += '<text x="' + L + '" y="' + (Y(cfg.moy) - 7).toFixed(1) + '" font-size="13" fill="var(--m-second)" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(cfg.moyTxt || '') + '</text>';
  }
  if (!cfg.ligne2) s += '<path d="' + d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (T + ih) + 'L' + pts[0][0].toFixed(1) + ' ' + (T + ih) + 'Z" fill="url(#' + id + ')"/>';
  s += '<path class="trace" pathLength="1" d="' + d + '" fill="none" stroke="' + cfg.couleur + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  if (cfg.ligne2) { var p2 = cfg.ligne2.vals.map(function (v, i) { return [X(i), Y(v)]; }); s += '<path class="trace" pathLength="1" d="' + lisse(p2) + '" fill="none" stroke="' + cfg.ligne2.couleur + '" stroke-width="3" stroke-linecap="round"/>'; }
  if (inc >= 0) { var a = pts[pts.length - 1], b = [X(inc), Y(vals[inc])]; s += '<path d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + '" stroke="' + cfg.couleur + '" stroke-width="2.4" stroke-dasharray="4 4" fill="none"/><circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="5" fill="#fff" stroke="' + cfg.couleur + '" stroke-width="2"/>'; }
  var dernier = n - 1 - (inc >= 0 ? 1 : 0), pl = pts[pts.length - 1];
  s += '<circle cx="' + pl[0].toFixed(1) + '" cy="' + pl[1].toFixed(1) + '" r="5" fill="' + cfg.couleur + '" stroke="#fff" stroke-width="2.5"/>';
  (cfg.etiq || []).forEach(function (e) { var x = X(e[0]), y = Y(vals[e[0]]), anc = x < 80 ? 'start' : x > w - 80 ? 'end' : 'middle';
    s += '<text x="' + x.toFixed(1) + '" y="' + Math.max(14, y - 12).toFixed(1) + '" font-size="13" font-weight="600" text-anchor="' + anc + '" fill="var(--enc-1)" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(e[1]) + '</text><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.5" fill="' + cfg.couleur + '"/>'; });
  var pas = (n > 10 || iw / Math.max(1, n - 1) < 56) ? 2 : 1;
  cfg.labels.forEach(function (lb, i) { if ((n - 1 - i) % pas === 0) s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="13" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '" fill="var(--m-libelle)">' + esc(lb) + '</text>'; });
  s += '<g class="cur" style="display:none"><line y1="' + T + '" y2="' + (T + ih) + '" stroke="var(--enc-3)" stroke-width="1.2"/><circle r="6" fill="' + cfg.couleur + '" stroke="#fff" stroke-width="3"/></g>';
  s += '<rect class="zone" x="0" y="0" width="' + w + '" height="' + h + '" fill="transparent" style="touch-action:pan-y"/></svg>';
  box.innerHTML = s;
  var svg = box.firstChild, cur = $('.cur', svg), zone = $('.zone', svg), ligne = cur.firstChild, pt = cur.lastChild;
  function vers(ev) { var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / (r.width || 1) * w, i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (iw / Math.max(1, n - 1)))));
    cur.style.display = ''; ligne.setAttribute('x1', X(i)); ligne.setAttribute('x2', X(i)); pt.setAttribute('cx', X(i)); pt.setAttribute('cy', Y(vals[i])); if (cfg.lecteur) cfg.lecteur(i); }
  zone.addEventListener('mousemove', vers); zone.addEventListener('click', vers); zone.addEventListener('touchstart', function (e) { if (e.touches[0]) vers(e.touches[0]); }, { passive: true }); zone.addEventListener('touchmove', function (e) { if (e.touches[0]) vers(e.touches[0]); }, { passive: true });
}
/* ---------- état et modèle ---------- */
var MOY = D.moyenneClients, OFF = D.officines;
var S = { vue: 'integral', off: OFF[0].id, stat: 'clients', com: '', grp: '', q: '', nb: 30, serie: 'ca', plus: false,
  sect: 'tous', per: 'dernier', du: 9, au: 11, detail: false, cf: 'tout', cq: '', ccom: '', cgrp: '', volet: null, tour: {}, tourVue: false };
function offById(id) { for (var i = 0; i < OFF.length; i++) if (OFF[i].id === id) return OFF[i]; return null; }
function pointById(id) { for (var i = 0; i < C.points.length; i++) if (C.points[i].id === id) return C.points[i]; return null; }
function etatOff(o) { return o.statut === 'prospect' ? 'prospect' : o.aRappeler ? 'rappel' : 'cliente'; }
var ETAT = { cliente: ['check', 'var(--e-bien)', 'Cliente'], rappel: ['bell', 'var(--e-attention)', 'À rappeler'], prospect: ['user', 'var(--e-neutre)', 'Prospect'], aucune: ['user', 'var(--e-neutre)', 'Aucune vente'] };
function etatHtml(k) { var e = ETAT[k]; return '<span class="etat"><span class="ico">' + icoSvg(e[0], e[1]) + '</span>' + e[2] + '</span>'; }
function ficheDe(id) { /* la 1re officine reprend DONNEES.fiche ; les autres sont dérivées de leur ligne */
  var o = offById(id), F = D.fiche;
  if (id === F.id) return F;
  var k = o.ca ? o.ca / F.ca : 0, kn = F.margeNous ? o.margeNous / F.margeNous : 0, kp = F.margePharmacien ? o.margePharmacien / F.margePharmacien : 0;
  var cm = o.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2] || 0, nn = parseInt(id.replace(/\D/g, ''), 10);
  var base = JSON.parse(JSON.stringify(F));
  base.id = o.id; base.nom = o.nom; base.statut = o.statut; base.ca = o.ca; base.margeNous = o.margeNous; base.margePharmacien = o.margePharmacien;
  base.caParMois = cm; base.margeNousParMois = F.margeNousParMois.map(function (v) { return Math.round(v * kn); });
  base.margePharmacienParMois = F.margePharmacienParMois.map(function (v) { return Math.round(v * kp); });
  base.dernierMois = { libelle: F.dernierMois.libelle, ca: last, evolutionSurMoisPrecedent: prev ? Math.round((last - prev) / prev * 100) : 0 };
  base.produitsDifferentsAchetes = Math.round(F.produitsDifferentsAchetes * Math.sqrt(k || .01));
  base.categories.forEach(function (c) { c.montant = Math.round(c.montant * k); });
  base.rang = { france: Math.max(1, Math.round(F.rang.surFrance * (1 - Math.min(.98, (o.ca / OFF[0].ca) * .9)))), surFrance: F.rang.surFrance, groupement: 1, surGroupement: F.rang.surGroupement };
  base.identite.titulaires = o.titulaire; base.identite.groupement = o.groupement; base.identite.ville = o.ville; base.identite.cp = o.cp;
  base.identite.cip = '2' + (300000 + nn * 137).toString().slice(0, 6);
  base.identite.adresse = 'Adresse à compléter'; base.identite.aSavoir = ''; base.identite.nbPharmaciens = '—';
  base.identite.telephone = '04 00 ' + ('00' + (10 + nn)).slice(-2) + ' 46 78'; base.identite.portable = '04 00 12 45 81'; base.identite.fax = ''; base.identite.email = 'contact@' + id + '.example';
  base.aProposer.groupeAchat.groupement = o.groupement; base.aProposer.groupeAchat.nbProduits = 300 + (nn * 17) % 300;
  return base;
}
/* ---------- LISTE (écran d'accueil d'un compte : solde géant, boutons ronds, carte de lignes) ---------- */
function listeFiltree() {
  var q = S.q.toLowerCase();
  return OFF.filter(function (o) {
    if (S.stat === 'clients' && o.statut === 'prospect') return false;
    if (S.stat === 'prospects' && o.statut !== 'prospect') return false;
    if (S.grp && o.groupement !== S.grp) return false;
    if (q && (o.nom + ' ' + o.ville + ' ' + o.cp + ' ' + o.titulaire).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function rond(ico, lib, extra, cls) { return '<button type="button" class="rond ' + (cls || '') + '" ' + (extra || '') + '><span class="c"><span class="ico" data-ico="' + ico + '"></span></span>' + lib + '</button>'; }
function ligneHtml(o) {
  var e = etatOff(o), est = o.statut === 'prospect';
  var baisse = o.baisse3mois != null ? '<span class="evo"><span class="ico">' + icoSvg('bas', 'var(--e-alerte)') + '</span>−' + Math.abs(o.baisse3mois) + ' % en 3 mois</span>' : '';
  return '<a class="ligne l-off" href="#fiche" data-officine="' + o.id + '">' +
    '<span class="past" aria-hidden="true">' + ini(o.nom) + '</span>' +
    '<span class="txt"><b>' + esc(joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + o.cp + ' · ' + esc(o.groupement) + '</span></span>' +
    '<span class="droite"><span class="mont num">' + (est ? '—' : gros(eur(o.ca))) + '</span><span class="sub">chiffre d’affaires · janv.–oct. 2026</span></span>' +
    '<span class="bas">' + (est ? '<span class="sub">Aucune vente</span>' : '<span class="sp">' + spark(o.caParMois, MOY.caMois, 84, 28, 'var(--c-ca)', 'Chiffre d’affaires des 10 mois de ' + joli(o.nom) + ', face à la moyenne de nos clients') + '</span>') +
    '<span class="prop">' + anneau(o.score) + '<span class="num">À lui proposer : ' + o.score + ' sur 100</span></span>' + etatHtml(e) + baisse +
    (est ? '' : '<span class="sub num" data-interne>Notre marge Intégral ' + eur(o.margeNous) + ' <i class="sub">estimation</i></span><span class="sub num">Marge du pharmacien ' + eur(o.margePharmacien) + '</span>') + '</span></a>';
}
function renderListe() {
  var el = $('#ecran-liste'), nbC = D.secteur.nbClientes, nbP = D.secteur.nbProspects;
  var ap = OFF.filter(function (o) { return o.aRappeler; });
  var grps = []; OFF.forEach(function (o) { if (grps.indexOf(o.groupement) < 0) grps.push(o.groupement); });
  el.innerHTML =
    '<div class="hero"><div class="lib">Secteur de ' + esc(D.secteur.commerciale) + '</div><h1 class="geant num" id="l-geant">0</h1>' +
    '<button class="pilule" type="button" id="l-pilule"><span class="ico" data-ico="bank"></span><span id="l-pilule-t">Officines</span></button>' +
    '<span class="evo">moyenne de nos ' + nf.format(MOY.nClients) + ' clients : ' + eur(MOY.caMois) + ' par mois</span></div>' +
    '<div class="ronds">' + rond('plus', 'Prospect', 'data-stub="Création non dessinée dans cette maquette."') + rond('down', 'Excel', 'data-stub="Exportation non dessinée dans cette maquette."') + rond('grp', 'Groupements', 'data-stub="Écran Groupements non dessiné."') + rond('list', 'Mes listes', 'data-stub="Écran Mes listes non dessiné."') + '</div>' +
    '<div class="tuiles"><div class="tuile"><span class="lib"><span class="puce" style="background:var(--c-ca)"></span>Moyenne de nos ' + nf.format(MOY.nClients) + ' clients</span><span class="val num">' + gros(eur(MOY.caMois)) + '</span><span class="sub">par mois · janv.–oct. 2026</span></div>' +
    '<div class="tuile"><span class="lib"><span class="ico" style="width:16px;height:16px">' + icoSvg('bell', 'var(--e-attention)') + '</span>À rappeler cette semaine</span><span class="val num">' + ap.length + '</span><span class="sub">officines dont les commandes baissent</span></div></div>' +
    (S.stat === 'clients' ? '<div class="carte"><div class="ent"><h2>À rappeler cette semaine</h2></div>' + ap.slice(0, S.rapTout ? 99 : 3).map(function (o) { return '<button type="button" class="ligne" data-rappel="' + o.id + '"><span class="past">' + icoSvg('bell', 'var(--e-attention)') + '</span><span class="txt"><b>' + esc(joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.baisse3mois != null ? ' · −' + Math.abs(o.baisse3mois) + ' % en 3 mois' : ' · commandes en baisse') + '</span></span><span class="droite"><span class="mont num">' + eur(o.ca) + '</span></span></button>'; }).join('') + (ap.length > 3 ? '<div class="voir-tout"><button type="button" class="btn-texte" id="l-rap-plus">' + (S.rapTout ? 'Voir moins' : 'Voir tout') + '</button></div>' : '') + '</div>' : '') +
    '<div class="filtres"><div class="seg" role="group" aria-label="Afficher"><button type="button" data-lstat="clients" aria-pressed="' + (S.stat === 'clients') + '">Clients ' + nf.format(nbC) + '</button><button type="button" data-lstat="prospects" aria-pressed="' + (S.stat === 'prospects') + '">Prospects de mon secteur ' + nbP + '</button></div>' +
    '<label class="filtre">Commercial<select id="l-com" aria-label="Commercial"><option>Tous</option><option>' + esc(D.secteur.commerciale) + '</option></select></label>' +
    '<label class="filtre">Groupement<select id="l-grp" aria-label="Groupement"><option value="">Tous</option>' + grps.map(function (g) { return '<option' + (S.grp === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
    '<label class="filtre"><span class="ico" data-ico="search"></span><input id="l-q" type="search" value="' + esc(S.q) + '" placeholder="Nom, titulaire, ville ou code postal" aria-label="Rechercher dans la liste"></label></div>' +
    '<p class="note cpt" id="l-cpt" style="margin:18px 4px 0"></p>' +
    '<div class="carte" id="l-carte"><div class="ent"><h2>Mes officines</h2><span class="sub">classées par chiffre d’affaires</span></div><div id="l-lignes"></div><div class="voir-tout"><button type="button" class="btn-texte" id="l-plus">Voir tout</button></div></div>' +
    '<p class="note" style="margin:12px 4px 0">Courbe : les 10 mois de l’officine, trait gris pointillé = moyenne de nos clients. Notre marge : estimation, génériques comptés à zéro.</p><p class="fict">Données fictives</p>';
  poseIcones(el); remplirLignes();
  compter($('#l-geant', el), D.secteur.nbOfficines, function (v) { return nf.format(Math.round(v)) + '<small>officines</small>'; }, 1000);
  $$('[data-lstat]', el).forEach(function (b) { b.onclick = function () { S.stat = b.getAttribute('data-lstat'); S.nb = 30; renderListe(); }; });
  $('#l-grp', el).onchange = function (e) { S.grp = e.target.value; S.nb = 30; remplirLignes(); };
  $('#l-q', el).oninput = function (e) { S.q = e.target.value; remplirLignes(); };
  $('#l-plus', el).onclick = function () { S.nb += 20; remplirLignes(); };
  var rp = $('#l-rap-plus', el); if (rp) rp.onclick = function () { S.rapTout = !S.rapTout; renderListe(); };
  $('#l-pilule', el).onclick = function () { toast('Vous êtes dans la liste des officines de votre secteur.'); };
  $$('[data-rappel]', el).forEach(function (b) { b.onclick = function () { S.off = b.getAttribute('data-rappel'); if (location.hash === '#fiche') route(); else location.hash = '#fiche'; }; });
}
function remplirLignes() {
  var l = listeFiltree(), aff = l.slice(0, S.nb), box = $('#l-lignes');
  box.innerHTML = aff.length ? aff.map(ligneHtml).join('') : '<p class="note" style="padding:14px">Aucune officine. Aucun résultat pour « ' + esc(S.q) + ' ».</p>';
  $('#l-cpt').textContent = nf.format(D.secteur.nbOfficines) + ' officines, classées par chiffre d’affaires de janv. à oct. 2026 · ' + aff.length + ' affichées';
  $('#l-plus').parentNode.hidden = l.length <= S.nb;
  $$('[data-officine]', box).forEach(function (a) { a.addEventListener('click', function (ev) { ev.preventDefault(); S.off = a.getAttribute('data-officine'); if (location.hash === '#fiche') route(); else location.hash = '#fiche'; }); });
}
/* ---------- FICHE (page d'un compte : libellé, solde géant, pilule, boutons ronds, cartes, tuiles) ---------- */
var MOIS_LONG = { 'janv.': 'janvier', 'févr.': 'février', 'mars': 'mars', 'avr.': 'avril', 'mai': 'mai', 'juin': 'juin', 'juil.': 'juillet', 'août': 'août', 'sept.': 'septembre', 'oct.': 'octobre' };
function ml(l) { return MOIS_LONG[l] || l; }
function T(vous, elle) { return S.vue === 'pharmacien' ? vous : elle; }
function ligneProp(titre, n, arr, comp) {
  return '<div class="carte"><div class="ent"><h2>' + esc(titre) + '</h2><span class="num sub">' + nf.format(n) + ' produits</span></div>' +
    '<div class="ronds" style="padding:6px 0 4px">' + rond('doc', 'PDF', 'data-stub="Téléchargement non dessiné dans cette maquette."') + rond('down', 'Excel', 'data-stub="Téléchargement non dessiné dans cette maquette."') + rond('send', 'Envoyer', 'data-stub="Envoi non dessiné dans cette maquette."', 'plein') + '</div>' +
    '<p class="note">Part des officines qui commandent le produit.</p>' +
    arr.slice(0, 5).map(function (p) { return '<div class="ligne"><span class="past">' + icoSvg('box') + '</span><span class="txt"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span><span class="lig-bar"><span class="barre12"><i style="width:' + p.partOfficines + '%;background:var(--cat-1)"></i></span></span></span><span class="droite"><span class="mont num">' + p.partOfficines + ' %</span><span class="sub">des officines</span></span></div>'; }).join('') + '</div>';
}
function lignesCoord(F) {
  var I = F.identite;
  var L = [['Ville', I.cp + ' ' + I.ville, 0], ['Adresse', I.adresse, 0], ['Titulaire', I.titulaires, 0], ['Groupement', I.groupement, 0],
    ['Téléphone', I.telephone, 1], ['Portable', I.portable, 1], ['E-mail', I.email, 1], ['Logiciel', I.logiciel || 'inconnu', 1], ['Grossiste principal', I.grossistePrincipal, 1],
    ['Pharmaciens', I.nbPharmaciens, 1], ['CIP', I.cip, 1], ['Fax', I.fax || '—', 1]];
  return L.map(function (l) { return '<div class="co"' + (l[2] ? ' data-interne' : '') + '><span class="co-l">' + l[0] + '</span><span class="co-v">' + esc(l[1]) + '</span></div>'; }).join('');
}
function renderFiche() {
  var el = $('#ecran-fiche'), o = offById(S.off) || OFF[0], F = ficheDe(o.id), I = F.identite, pv = S.vue === 'pharmacien';
  var mois = F.moisLabels, cm = F.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2];
  var evo = prev ? Math.round((last - prev) / prev * 100) : 0, ratio = (F.ca / 10) / MOY.caMois;
  var autres = OFF.filter(function (x) { return x.statut !== 'prospect'; });
  el.setAttribute('data-vue-actuelle', S.vue);
  el.innerHTML =
    '<div class="barre-f"><button type="button" class="pil" data-action="retour"><span class="ico" data-ico="back"></span>Officines</button>' +
    '<div class="seg" role="group" aria-label="Vue"><button type="button" data-vue="integral" aria-pressed="' + !pv + '">Vue Intégral</button><button type="button" data-vue="pharmacien" aria-pressed="' + pv + '">Vue pharmacien</button></div>' +
    '<label class="filtre" data-interne>Autre officine<select id="f-autre" aria-label="Autre officine"><option value="">Choisir…</option>' + autres.map(function (x) { return '<option value="' + x.id + '">' + esc(joli(x.nom)) + '</option>'; }).join('') + '</select></label>' +
    '<button type="button" class="pil" data-interne data-stub="Brief du jour non dessiné dans cette maquette.">Voir le brief du jour <b class="cpt7">7</b></button></div>' +
    '<p class="note vuenote">' + (pv ? 'Vue pharmacien : rien d’interne à l’écran, vous pouvez la lui montrer.' : 'Vue Intégral : à ne pas lui montrer.') + '</p>' +
    '<div class="hero"><div class="lib">' + esc(joli(F.nom)) + '</div><h1 class="geant num" id="f-ca">' + gros(eur(F.ca)) + '</h1>' +
    '<button class="pilule" type="button" data-ancre="f-prop">' + (pv ? '<span class="ico">' + icoSvg('bank') + '</span>' : etatHtml(etatOff(o)).replace('class="etat"', 'class="etat" style="font-size:15px"') + '<span>·</span>') + '<span>' + esc(I.groupement) + '</span></button>' +
    '<span class="evo">' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + ' · ' + F.periode + '</span>' +
    '<span class="evo"><span class="ico">' + icoSvg(evo < 0 ? 'bas' : 'haut', evo < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span>' + F.dernierMois.libelle + ' : ' + eur(last) + ', ' + signe(evo) + ' sur ' + ml(mois[mois.length - 2]) + '</span>' +
    '<span class="evo" data-interne>×' + nf1.format(ratio) + ' la moyenne de nos clients · ' + F.rang.france + (F.rang.france === 1 ? 're' : 'e') + ' sur ' + nf.format(F.rang.surFrance) + '</span>' +
    '<span class="sub" data-interne style="display:block;margin-top:6px">CIP ' + I.cip + ' · ' + (o.statut === 'prospect' ? 'PROSPECT' : 'CLIENTE INTÉGRAL') + ' · ' + esc(D.secteur.commerciale) + '</span></div>' +
    '<div class="ronds" data-interne>' + rond('phone', 'Appeler', 'data-stub="Appel non dessiné."', 'plein') + rond('mail', 'E-mail', 'data-stub="E-mail non dessiné."') + rond('note', 'Note', 'data-stub="Note non dessinée."') + rond('dots', 'Plus', 'id="f-plus"') + '</div>' +
    '<div class="carte" id="f-plus-c" data-interne ' + (S.plus ? '' : 'hidden') + '>' +
    [['cal', 'Proposer un rendez-vous', 'Elle choisit son créneau'], ['cal', 'Noter un rendez-vous', 'Jour et heure libres, même passés'], ['box', 'Voir ses produits', 'Catalogue calé sur cette officine'], ['chart', 'Comparer avec D2P', 'Face à face de conditions']].map(function (a) { return '<button type="button" class="ligne" data-stub="' + a[1] + ' : non dessiné dans cette maquette."><span class="past">' + icoSvg(a[0]) + '</span><span class="txt"><b>' + a[1] + '</b><span class="sub">' + a[2] + '</span></span><span class="ico chev">' + icoSvg('chev') + '</span></button>'; }).join('') + '</div>' +
    '<div class="carte graph"><div id="f-courbe"><h3 id="f-titre-c"></h3><p class="note" id="f-sous-c" style="margin:2px 4px 8px"></p>' +
    '<div class="sel-g"><div class="seg" role="group" aria-label="Série"><button type="button" data-serie="ca" aria-pressed="' + (S.serie === 'ca') + '">Chiffre d’affaires</button><button type="button" data-serie="marges" aria-pressed="' + (S.serie === 'marges') + '">Marges</button></div></div>' +
    '<div class="courbe" id="f-histo"></div><p class="lecteur" id="f-lect" aria-live="polite">Touchez ou survolez la courbe pour lire un mois.</p><div class="leg" id="f-leg"></div>' +
    '<details class="tabm"><summary>Voir le tableau</summary><div id="f-tab"></div></details></div></div>' +
    '<div class="tuiles" id="f-synth"></div>' +
    '<h2 class="titre-s" id="f-prop">À proposer</h2>' +
    ligneProp('Le réseau', F.aProposer.reseau.nbProduits, F.aProposer.reseau.premiers) + ligneProp(I.groupement === 'Sans groupement' ? 'Listing du groupe d’achat' : 'Listing ' + I.groupement, F.aProposer.groupeAchat.nbProduits, F.aProposer.groupeAchat.premiers) +
    '<div class="carte"><button type="button" class="ligne" data-stub="Catalogue non dessiné."><span class="past">' + icoSvg('box') + '</span><span class="txt"><b>Catalogue pour son logiciel</b><span class="sub">' + esc(I.logiciel || 'À choisir') + ' · ' + esc(F.aProposer.catalogueLogiciel.libelle) + '</span></span><span class="ico chev">' + icoSvg('chev') + '</span></button>' +
    '<button type="button" class="ligne" data-interne data-stub="Tâches non dessinées."><span class="past">' + icoSvg('list') + '</span><span class="txt"><b>Liste de tâches</b><span class="sub">' + F.taches.length + ' tâches · prochaine le ' + dfr(F.taches[0].echeance) + ' · Ajouter une tâche</span></span><span class="ico chev">' + icoSvg('chev') + '</span></button>' +
    '<button type="button" class="ligne" data-stub="Transmission non dessinée."><span class="past">' + icoSvg('send') + '</span><span class="txt"><b>Choisir quoi lui transmettre</b><span class="sub">Documents et catalogues</span></span><span class="ico chev">' + icoSvg('chev') + '</span></button></div>' +
    '<h2 class="titre-s">' + T('Vos achats', 'Ses achats') + '</h2><div class="carte" id="f-cat"></div><div class="carte" id="f-top"></div><div class="carte" id="f-ne"></div><div class="carte" data-interne id="f-notes"></div>' +
    '<h2 class="titre-s">Coordonnées</h2><div class="carte">' + lignesCoord(F) + (I.aSavoir ? '<div class="savoir" data-interne><span class="co-l">À savoir</span><p>' + esc(I.aSavoir) + '</p></div>' : '') + '</div><p class="fict">Données fictives</p>';
  poseIcones(el);
  remplirSynth(F, ratio); dessinerCourbe(F, mois, cm, ratio); remplirCat(F); remplirTop(F); remplirNe(F, o);
  compter($('#f-ca', el), F.ca, function (v) { return gros(eur(v)); });
  $$('[data-vue]', el).forEach(function (b) { b.onclick = function () { S.vue = b.getAttribute('data-vue'); document.body.setAttribute('data-vue-courante', S.vue); renderFiche(); }; });
  $$('[data-serie]', el).forEach(function (b) { b.onclick = function () { S.serie = b.getAttribute('data-serie'); renderFiche(); }; });
  $('[data-action="retour"]', el).onclick = function () { location.hash = '#liste'; };
  $('#f-autre', el).onchange = function (e) { if (e.target.value) { S.off = e.target.value; renderFiche(); } };
  $('#f-plus', el).onclick = function () { S.plus = !S.plus; $('#f-plus-c').hidden = !S.plus; };
  $$('[data-ancre]', el).forEach(function (a) { a.onclick = function () { var t = $('#' + a.getAttribute('data-ancre')); if (t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }; });
}
function remplirSynth(F, ratio) {
  var pm = F.margePharmacienParMois.reduce(function (a, b) { return a + b; }, 0) / 10, nm = F.margeNousParMois.reduce(function (a, b) { return a + b; }, 0) / 10;
  $('#f-synth').innerHTML =
    '<div class="tuile"><span class="lib"><span class="puce" style="background:var(--c-ca)"></span>' + T('Votre chiffre d’affaires par mois', 'Chiffre d’affaires par mois') + '</span><span class="val num">' + gros(eur(F.ca / 10)) + '</span><span class="sub" data-interne>×' + nf1.format(ratio) + ' la moyenne de nos clients (' + eur(MOY.caMois) + ')</span></div>' +
    '<div class="tuile" data-interne><span class="lib"><span class="puce" style="background:var(--c-nous)"></span>Notre marge Intégral par mois</span><span class="val num">' + gros(eur(nm)) + '</span><span class="sub">moyenne de nos clients : ' + eur(MOY.margeNousMois) + '</span></div>' +
    '<div class="tuile"><span class="lib"><span class="puce" style="background:var(--c-pharma)"></span>' + T('Votre marge', 'Marge du pharmacien') + ' par mois</span><span class="val num">' + gros(eur(pm)) + '</span><span class="sub" data-interne>moyenne de nos clients : ' + eur(MOY.margePharmacienMois) + '</span></div>' +
    '<div class="tuile"><span class="lib"><span class="puce" style="background:var(--c-cmd)"></span>Produits différents achetés</span><span class="val num">' + nf.format(F.produitsDifferentsAchetes) + '</span><span class="sub">janv.–oct. 2026</span></div>';
}
function dessinerCourbe(F, mois, cm, ratio) {
  var pv = S.vue === 'pharmacien', box = $('#f-histo'), lect = $('#f-lect'), last = cm.length - 1, best = cm.indexOf(Math.max.apply(null, cm)), cfg;
  var kE = function (v) { return (v >= 1000 ? nf.format(v / 1000) + ' k€' : v + ' €'); };
  if (S.serie === 'ca') {
    var pct = cm[last - 1] ? Math.round((cm[last] - cm[last - 1]) / cm[last - 1] * 100) : 0;
    $('#f-titre-c').textContent = ml(mois[last]).charAt(0).toUpperCase() + ml(mois[last]).slice(1) + (pct < 0 ? ' recule de ' : ' progresse de ') + Math.abs(pct) + ' % sur ' + ml(mois[last - 1]) + (pv ? '' : ' · ×' + nf1.format(ratio) + ' la moyenne de nos clients');
    $('#f-sous-c').textContent = T('Votre chiffre d’affaires net hors taxes par mois', 'Chiffre d’affaires net hors taxes par mois') + ', ' + F.periode + '. Record : ' + ml(mois[best]) + ' (' + eur(cm[best]) + ').';
    cfg = { vals: cm, couleur: 'var(--c-ca)', moy: pv ? null : MOY.caMois, moyTxt: 'Moyenne de nos clients · ' + eur(MOY.caMois), etiq: best === last ? [[last, eur(cm[last])]] : [[best, 'Record ' + kE(cm[best])], [last, kE(cm[last])]],
      lecteur: function (i) { lect.innerHTML = '<b>' + ml(mois[i]) + ' 2026</b> : ' + eur(cm[i]) + (pv ? '' : ', ' + (cm[i] >= MOY.caMois ? 'au-dessus de' : 'sous') + ' la moyenne de nos clients (' + eur(MOY.caMois) + ')'); } };
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-ca)"></i>' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + '</span>' + (pv ? '' : '<span data-interne><i class="trait"></i>Moyenne de nos clients · ' + eur(MOY.caMois) + '</span>');
  } else {
    var ph = F.margePharmacienParMois, nu = F.margeNousParMois;
    $('#f-titre-c').textContent = pv ? 'Votre marge de pharmacien : ' + eur(ph[last]) + ' en ' + ml(mois[last]) : 'Marges : ' + eur(ph[last]) + ' pour le pharmacien, ' + eur(nu[last]) + ' pour nous en ' + ml(mois[last]);
    $('#f-sous-c').textContent = 'Même unité (euros par mois), ' + F.periode + (pv ? '.' : '. Notre marge : estimation, génériques comptés à zéro.');
    cfg = { vals: ph, couleur: 'var(--c-pharma)', ligne2: pv ? null : { vals: nu, couleur: 'var(--c-nous)' }, etiq: [[last, kE(ph[last])]],
      lecteur: function (i) { lect.innerHTML = '<b>' + ml(mois[i]) + ' 2026</b> : marge du pharmacien ' + eur(ph[i]) + (pv ? '' : ', notre marge ' + eur(nu[i])); } };
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-pharma)"></i>' + T('Votre marge', 'Marge du pharmacien') + '</span>' + (pv ? '' : '<span data-interne><i class="puce" style="background:var(--c-nous)"></i>Notre marge Intégral</span>');
  }
  cfg.box = box; cfg.labels = mois; cfg.h = 240; cfg.aria = 'Courbe des ventes par mois';
  courbe(cfg); lect.textContent = 'Touchez ou survolez la courbe pour lire un mois.';
  S.redessin = function () { courbe(cfg); };
  var rows = cm.map(function (v, i) { var p = i ? cm[i - 1] : 0; return '<tr><td>' + ml(mois[i]) + '</td><td class="num">' + eur(v) + '</td><td class="num">' + (i && p ? signe((v - p) / p * 100) : '—') + '</td></tr>'; }).join('');
  $('#f-tab').innerHTML = '<table class="tab"><thead><tr><th>Mois</th><th>Chiffre d’affaires net hors taxes</th><th>Évolution sur un mois</th></tr></thead><tbody>' + rows + '<tr class="cumul"><td>Cumul janv.–oct. 2026</td><td class="num">' + eur(F.ca) + '</td><td></td></tr></tbody></table><p class="note">Net : au prix facturé par Intégral, hors taxes, avoirs déduits.</p>';
}
function remplirCat(F) {
  var pv = S.vue === 'pharmacien', max = Math.max.apply(null, F.categories.map(function (c) { return Math.max(c.montant, pv ? 0 : c.moyenneClients * 10); })), tot = F.categories.reduce(function (a, c) { return a + c.montant; }, 0) || 1;
  $('#f-cat').innerHTML = '<div class="ent"><h2>' + T('Vos achats par catégorie', 'Ses achats par catégorie') + '</h2><span class="sub">' + F.periode + '</span></div>' + (pv ? '' : '<p class="note" data-interne>Barre grise : moyenne de nos clients sur 10 mois.</p>') +
    F.categories.map(function (c, i) {
      return '<div class="ligne" style="align-items:flex-start"><span class="past"><span class="puce" style="background:var(--cat-' + (i + 1) + ')"></span></span><span class="txt"><b>' + esc(c.nom) + '</b><span class="sub">' + nf1.format(c.montant / tot * 100) + ' % de ses achats</span>' +
        '<span class="barre12" style="margin-top:6px"><i style="width:' + (c.montant / max * 100).toFixed(1) + '%;background:var(--cat-' + (i + 1) + ')"></i></span>' +
        (pv ? '' : '<span class="barre12 gris" data-interne><i style="width:' + (c.moyenneClients * 10 / max * 100).toFixed(1) + '%"></i></span><span class="sub" data-interne>Moyenne de nos clients : ' + eur(c.moyenneClients * 10) + '</span>') + '</span><span class="droite"><span class="mont num">' + eur(c.montant) + '</span></span></div>';
    }).join('') +
    (pv ? '' : '<div data-interne class="posit"><b style="font-weight:600">Place parmi nos clients</b><div class="frise"><span class="base"></span><i class="pt" style="left:' + Math.max(2, Math.min(97, (F.rang.france / F.rang.surFrance) * 100)).toFixed(1) + '%"></i></div><p class="sub" style="margin:0">Elle est ici · ' + F.rang.france + (F.rang.france === 1 ? 're' : 'e') + ' sur ' + nf.format(F.rang.surFrance) + ', classées par chiffre d’affaires.</p></div>');
}
function remplirTop(F) {
  $('#f-top').innerHTML = '<div class="ent"><h2>Top 10 · famille de produits</h2></div>' + F.top10.slice(0, S.topTout ? 10 : 5).map(function (p, i) { return '<div class="ligne"><span class="past">' + (i + 1) + '</span><span class="txt"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></span><span class="droite"><span class="mont num">' + eur(p.montant) + '</span><span class="sub num">' + nf.format(p.quantite) + ' boîtes</span></span></div>'; }).join('') + '<div class="voir-tout"><button type="button" class="btn-texte" id="f-top-plus">' + (S.topTout ? 'Voir moins' : 'Voir tout') + '</button></div>';
  $('#f-top-plus').onclick = function () { S.topTout = !S.topTout; remplirTop(F); };
}
function remplirNe(F) {
  $('#f-ne').innerHTML = '<div class="ent"><h2>' + T('Ce que vous ne commandez plus', 'Ce qu’elle ne commande plus') + '</h2></div><p class="note">' + F.nePlusCommande.length + ' produits commandés au moins 4 mois, absents du dernier mois.</p>' +
    F.nePlusCommande.map(function (p) { var k = new Date(p.derniereCommande).getMonth(), cases = ''; for (var i = 0; i < 10; i++) cases += '<i class="' + (i <= k && i > k - 5 ? 'plein' : '') + '"></i>'; return '<div class="ligne"><span class="past">' + icoSvg('bas', 'var(--e-alerte)') + '</span><span class="txt"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">Dernière commande : ' + dfr(p.derniereCommande) + '</span></span><span class="frise-m" aria-label="Mois commandés, janvier à octobre">' + cases + '</span></div>'; }).join('');
  var rdv = F.prochainRendezVous;
  $('#f-notes').innerHTML = '<div class="ent"><h2>Rendez-vous, notes et tâches</h2></div>' +
    '<div class="ligne"><span class="past">' + icoSvg('cal') + '</span><span class="txt"><b>Prochain rendez-vous : ' + dfr(rdv.date) + ' à ' + rdv.heure.replace(':', ' h ') + '</b><span class="sub">' + esc(rdv.lieu) + ' · ' + esc(rdv.objet) + '</span></span></div>' +
    F.notes.map(function (n) { return '<div class="ligne"><span class="past">' + icoSvg('note') + '</span><span class="txt"><b>Note du ' + dfr(n.date) + '</b><span class="sub">' + esc(n.texte) + '</span></span></div>'; }).join('') +
    F.taches.map(function (t) { return '<div class="ligne"><span class="past">' + icoSvg(t.fait ? 'check' : 'list', t.fait ? 'var(--e-bien)' : 'var(--e-neutre)') + '</span><span class="txt"><b>' + esc(t.texte) + '</b><span class="sub">' + (t.fait ? 'Fait · ' : 'À faire avant le ') + dfr(t.echeance) + '</span></span></div>'; }).join('');
}
/* ---------- PILOTAGE (INVENTÉ : Revolut n'a pas de tableau de bord ici ; mêmes composants : solde géant, pilules, tuiles, lignes, feuille) ---------- */
var PL = P.moisLibelles, PLL = P.moisLibellesLongs;
function moisDe(sect) { if (sect === 'tous') return P.reseau.mois; for (var i = 0; i < P.secteurs.length; i++) if (P.secteurs[i].id === sect) return P.secteurs[i].mois; return P.reseau.mois; }
function plage() { if (S.per === 'dernier') return [11, 11]; if (S.per === '3') return [9, 11]; if (S.per === 'annee') return [2, 11]; return [Math.min(S.du, S.au), Math.max(S.du, S.au)]; }
function plagePrec(r) { var n = r[1] - r[0] + 1, a = r[0] - n; return a < 0 ? null : [a, r[0] - 1]; }
function somme(ms, r, k) { var s = 0; for (var i = r[0]; i <= r[1]; i++) s += (typeof k === 'function' ? k(ms[i]) : ms[i][k]); return s; }
function moy(ms, r, k) { return somme(ms, r, k) / (r[1] - r[0] + 1); }
var MES = {
  ca: { nom: 'Chiffre d’affaires', ico: 'euro', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca'); }, s: function (m) { return m.ca; }, fmt: eurM },
  nous: { nom: 'Notre marge', ico: 'chart', col: 'var(--c-nous)', f: function (ms, r) { return somme(ms, r, 'margeNous'); }, s: function (m) { return m.margeNous; }, fmt: eur },
  phar: { nom: 'Marge pharmacien générée', ico: 'bank', col: 'var(--c-pharma)', f: function (ms, r) { return somme(ms, r, 'margePharmacien'); }, s: function (m) { return m.margePharmacien; }, fmt: eur },
  act: { nom: 'Officines actives', ico: 'user', col: 'var(--c-cmd)', f: function (ms, r) { return Math.round(moy(ms, r, 'officinesActives')); }, s: function (m) { return m.officinesActives; }, fmt: function (v) { return nf.format(v); } },
  panier: { nom: 'Panier moyen', ico: 'box', col: 'var(--c-ca)', f: function (ms, r) { return somme(ms, r, 'ca') / Math.max(1, somme(ms, r, 'officinesActives')); }, s: function (m) { return m.ca / Math.max(1, m.officinesActives); }, fmt: eur }
};
function libPeriode(r) { if (S.per === 'dernier') return 'octobre 2026'; if (r[0] === r[1]) return PLL[r[0]].toLowerCase(); return PL[r[0]] + ' → ' + PL[r[1]]; }
function nomMoisAvant() { return S.per === 'dernier' ? 'septembre' : 'la période d’avant'; }
function evoTexte(v, w, avant) { if (w == null || !w) return '<span class="evo">Pas de comparaison possible</span>'; var p = (v - w) / w * 100; return '<span class="evo"><span class="ico">' + icoSvg(p < 0 ? 'bas' : 'haut', p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span>' + (Math.abs(p) < .5 ? 'égal à ' + avant : '<b>' + signe(p) + '</b>' + (avant.indexOf('la ') === 0 ? ' que ' : ' qu’en ') + avant) + '</span>'; }
var PAR = [
  { k: 'ca', nom: 'Chiffre d’affaires par client', unit: 'par client et par mois', col: 'var(--c-ca)', ico: 'euro', v: function (m) { return m.ca / m.officinesActives; }, g: function (a) { return a.caCl; }, fmt: eur },
  { k: 'nous', nom: 'Notre marge par client', unit: 'par client et par mois', col: 'var(--c-nous)', ico: 'chart', v: function (m) { return m.margeNous / m.officinesActives; }, g: function (a) { return a.mgCl; }, fmt: eur },
  { k: 'liv', nom: 'Livraisons par client', unit: 'par client et par mois', col: 'var(--c-cmd)', ico: 'box', neutre: true, v: function (m) { return m.livraisons / m.officinesActives; }, g: function (a) { return a.livraisons; }, fmt: function (v) { return nf1.format(v) + ' par mois'; } },
  { k: 'mpl', nom: 'Marge par livraison', unit: 'par livraison', col: 'var(--c-nous)', ico: 'route', v: function (m) { return m.margeNous / m.livraisons; }, g: function (a) { return a.margeParLivraison; }, fmt: eur },
  { k: 'apl', nom: 'Marge après livraisons', unit: 'par client et par mois', col: 'var(--c-pharma)', ico: 'bank', v: function (m) { return (m.margeNous - m.livraisons * P.reseau.coutLivraison) / m.officinesActives; }, g: function (a) { return a.margeApresLivraison; }, fmt: eur }
];
function optMois(sel) { var s = ''; for (var i = 12; i >= 0; i--) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + PLL[i] + (i === 12 ? ' (incomplet)' : '') + '</option>'; return s; }
function subMes(k, ms, r, v, ca) {
  if (k === 'nous') return nf2.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'phar') return nf1.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'act') return 'au moins une commande · ' + Math.round(v / (S.sect === 'tous' ? P.reseau.nbOfficines : Math.round(P.reseau.nbOfficines / 8)) * 100) + ' % des officines';
  return 'par officine active';
}
function renderPilotage() {
  var el = $('#ecran-pilotage'), ms = moisDe(S.sect), r = plage(), pr = plagePrec(r), M = MES;
  var nomSect = S.sect === 'tous' ? 'Tous les secteurs' : (P.secteurs.filter(function (s) { return s.id === S.sect; })[0] || {}).nom;
  var ca = M.ca.f(ms, r), caP = pr ? M.ca.f(ms, pr) : null, lp = libPeriode(r), av = nomMoisAvant();
  var pc = caP ? Math.round((ca - caP) / caP * 100) : null;
  var lede = 'En ' + lp + ', ' + (S.sect === 'tous' ? 'le réseau Intégral' : 'le secteur de ' + esc(nomSect)) + ' a fait <b>' + eurM(ca) + '</b> de ventes' + (pc == null ? '.' : ', <b>' + Math.abs(pc) + ' % de ' + (pc < 0 ? 'moins' : 'plus') + '</b> ' + (av.indexOf('la ') === 0 ? 'que ' : 'qu’en ') + av + '.');
  el.innerHTML =
    '<p class="note eyebrow">' + (S.sect === 'tous' ? 'Tous les secteurs' : 'Secteur de ' + esc(nomSect)) + ' · ' + esc(lp) + '</p><h1 class="titre">Pilotage</h1>' +
    '<div class="hero" style="margin-top:14px"><div class="lib">Chiffre d’affaires · ' + esc(lp) + '</div><div class="geant num" id="p-ca">' + gros(eurM(ca)) + '</div><span class="sub">net hors taxes · ce que les officines ont acheté</span><div style="margin-top:8px">' + evoTexte(ca, caP, av) + '</div></div>' +
    '<p class="lede">' + lede + '</p>' +
    '<div class="dispos"><div class="seg" role="group" aria-label="Période">' + [['dernier', 'Dernier mois'], ['3', '3 mois'], ['annee', 'Année'], ['choisir', 'Choisir']].map(function (b) { return '<button type="button" data-periode="' + b[0] + '" aria-pressed="' + (S.per === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
    (S.per === 'choisir' ? '<label class="filtre">Du<select id="p-du" aria-label="Du">' + optMois(S.du) + '</select></label><label class="filtre">au<select id="p-au" aria-label="au">' + optMois(S.au) + '</select></label>' : '') +
    '<label class="filtre">Secteur regardé<select id="p-sect" aria-label="Secteur regardé"><option value="tous">Tous les secteurs</option>' + P.secteurs.map(function (s) { return '<option value="' + s.id + '"' + (S.sect === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select></label></div>' +
    '<p class="alerte-n"><span class="ico">' + icoSvg('bell', 'var(--e-attention)') + '</span>' + esc(P.noteMoisIncomplet) + '</p>' +
    '<div class="carte graph"><h3>Chiffre d’affaires des 13 derniers mois</h3><p class="note" style="margin:2px 4px 6px">net hors taxes · le dernier mois, incomplet, est en pointillé</p><div class="courbe" id="p-histo"></div><p class="lecteur" id="p-lect" aria-live="polite">Touchez ou survolez la courbe pour lire un mois.</p><div class="leg"><span><i class="puce" style="background:var(--c-ca)"></i>' + esc(lp) + '</span><span><i class="trait" style="border-color:var(--c-ca)"></i>Mois incomplet</span></div></div>' +
    '<h2 class="titre-s">Les mesures · ' + esc(lp) + '</h2><div class="tuiles">' + ['nous', 'phar', 'act', 'panier'].map(function (k) { var d = M[k], v = d.f(ms, r), w = pr ? d.f(ms, pr) : null;
      return '<button type="button" class="tuile" data-mes="' + k + '"' + (k === 'nous' ? ' data-interne' : '') + '><span class="lib"><span class="ico" style="width:18px;height:18px">' + icoSvg(d.ico, d.col) + '</span>' + d.nom + '</span><span class="val num">' + gros(d.fmt(v)) + '</span><span class="sub">' + subMes(k, ms, r, v, ca) + '</span>' + evoTexte(v, w, av) + spark(ms.map(d.s), null, 120, 30, d.col, d.nom + ' sur 13 mois') + '</button>'; }).join('') + '</div>' +
    '<div class="carte" style="margin-top:12px"><div class="ligne"><span class="past">' + icoSvg('mol') + '</span><span class="txt"><b>Molécules · ' + esc(lp) + '</b><span class="sub">différentes, vendues · dont ' + nf.format(Math.round(moy(ms, r, function (m) { return m.molecules.cheres; }))) + ' chères (468 € et plus)</span>' + (S.sect === 'tous' ? '' : '<span class="evo">' + comparMol(ms, r) + '</span>') + '</span><span class="droite"><span class="mont num">' + nf.format(Math.round(moy(ms, r, function (m) { return m.molecules.total; }))) + ' molécules</span></span></div></div>' +
    '<h2 class="titre-s">Par client, face à la Moyenne Intégral</h2><div class="carte" id="p-par"></div>' +
    '<div class="detail-b"><button type="button" class="pil plein" data-action="detail">' + (S.detail ? 'Masquer le détail' : 'Voir tout le détail') + '</button><span class="note">Répartitions, classements, produits, marché France, pharmacies à relancer…</span></div>' +
    '<div id="p-detail" ' + (S.detail ? '' : 'hidden') + '></div><p class="fict">Données fictives</p>';
  poseIcones(el);
  var cfg = { box: $('#p-histo'), labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: ms.map(function (m) { return m.ca; }), couleur: 'var(--c-ca)', incompl: 12, h: 230, aria: 'Chiffre d’affaires des 13 derniers mois', etiq: [[11, eurM(ms[11].ca)]],
    lecteur: function (i) { $('#p-lect').innerHTML = '<b>' + PLL[i] + '</b> : ' + eurM(ms[i].ca) + (i === 12 ? ' (mois incomplet)' : ''); } };
  courbe(cfg); S.redessin = function () { courbe(cfg); };
  compter($('#p-ca'), ca, function (v) { return gros(eurM(v)); });
  remplirPar(ms, r);
  $$('[data-periode]', el).forEach(function (b) { b.onclick = function () { S.per = b.getAttribute('data-periode'); renderPilotage(); }; });
  $('#p-sect', el).onchange = function (e) { S.sect = e.target.value; renderPilotage(); };
  if ($('#p-du', el)) { $('#p-du', el).onchange = function (e) { S.du = +e.target.value; renderPilotage(); }; $('#p-au', el).onchange = function (e) { S.au = +e.target.value; renderPilotage(); }; }
  $$('[data-mes]', el).forEach(function (b) { b.onclick = function () { ouvrirFeuille(b.getAttribute('data-mes')); }; });
  $('[data-action="detail"]', el).onclick = function () { S.detail = !S.detail; location.hash = S.detail ? '#pilotage-detail' : '#pilotage'; };
  if (S.detail) remplirDetail(ms, r);
}
function comparMol(ms, r) {
  var tot = moy(ms, r, function (m) { return m.molecules.total; }), ref = moy(P.reseau.mois, r, function (m) { return m.molecules.total; }) / 8;
  return '<span class="ico">' + icoSvg(tot >= ref ? 'haut' : 'bas', tot >= ref ? 'var(--e-bien)' : 'var(--e-alerte)') + '</span>' + nf1.format(tot / ref) + ' fois la moyenne Intégral';
}
function valPar(d, ms, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.v(ms[i], i); n++; } return s / n; }
function valMoy(d, r) { var s = 0, n = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.g(P.moyenneIntegral[i]); n++; } return s / n; }
function remplirPar(ms, r) {
  $('#p-par').innerHTML = '<p class="note" style="padding-top:12px">Trait gris pointillé : la Moyenne Intégral, mois par mois (' + PL[0] + ' → ' + PL[12] + ').</p>' + PAR.map(function (d) {
    var m = valMoy(d, r), v = S.sect === 'tous' ? null : valPar(d, ms, r), e = v == null ? '' : ((v - m) / m * 100);
    var sA = ms.map(function (x, i) { return d.v(x, i); }), sB = P.moyenneIntegral.map(d.g), interne = d.k === 'nous' || d.k === 'mpl' || d.k === 'apl';
    return '<div class="par-l"' + (interne ? ' data-interne' : '') + '><span class="past">' + icoSvg(d.ico, d.col) + '</span><span class="txt"><b>' + d.nom + '</b><span class="sub">' + d.unit + ' · ' + esc(libPeriode(r)) + '</span>' +
      (v == null ? '<span class="sub">Moyenne Intégral du réseau</span>' : '<span class="sub">Moyenne Intégral : ' + d.fmt(m) + '</span><span class="evo"><span class="ico">' + icoSvg(d.neutre ? 'chev' : e < 0 ? 'bas' : 'haut', d.neutre ? 'var(--e-neutre)' : e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span><b>' + signe(e) + '</b> face à la Moyenne Intégral</span>') + '</span>' +
      '<span class="mont num" style="font-size:18px;font-weight:600">' + gros(d.fmt(v == null ? m : v)) + '</span><span class="sp">' + spark2(v == null ? sB : sA, sB, 240, 40, d.col) + '</span></div>';
  }).join('');
}
function panneau(titre, html) {
  var p = $('#panneau');
  if (!p) { p = document.createElement('aside'); p.id = 'panneau'; p.className = 'feuille'; p.setAttribute('role', 'dialog'); document.body.appendChild(p); }
  p.innerHTML = '<div class="poignee"></div><div class="f-t"><h2>' + esc(titre) + '</h2><button type="button" class="ferme" data-fermer aria-label="Fermer"><span class="ico" data-ico="close"></span></button></div><div>' + html + '</div>';
  poseIcones(p); p.hidden = false; $('[data-fermer]', p).onclick = function () { p.hidden = true; };
  return p;
}
function ouvrirFeuille(k) {
  var d = MES[k], ms = moisDe(S.sect), r = plage(), v = d.f(ms, r), pr = plagePrec(r), w = pr ? d.f(ms, pr) : null;
  var p = panneau(d.nom, '<div class="geant num" style="font-size:40px;font-weight:600;text-align:center">' + gros(d.fmt(v)) + '</div><p class="note" style="text-align:center">' + esc(libPeriode(r)) + '</p><div style="text-align:center">' + evoTexte(v, w, nomMoisAvant()) + '</div><div class="courbe" id="fe-h" style="margin-top:8px"></div><p class="lecteur" id="fe-l">Touchez ou survolez la courbe pour lire un mois.</p>');
  courbe({ box: $('#fe-h', p), labels: PL.map(function (l) { return l.split(' ')[0]; }), vals: ms.map(d.s), couleur: d.col, incompl: 12, h: 200, aria: d.nom, lecteur: function (i) { $('#fe-l', p).innerHTML = '<b>' + PLL[i] + '</b> : ' + d.fmt(d.s(ms[i])); } });
}
function barresH(lignes, col, fmtv, ico) { /* lignes : [nom, valeur, sous] — lignes de la carte, barre fine à droite du texte */
  var mx = Math.max.apply(null, lignes.map(function (l) { return l[1]; }).concat([1]));
  return lignes.map(function (l, i) { return '<div class="ligne"><span class="past">' + (ico ? icoSvg(ico) : (i + 1)) + '</span><span class="txt"><b>' + esc(l[0]) + '</b>' + (l[2] ? '<span class="sub">' + esc(l[2]) + '</span>' : '') + '<span class="barre12" style="margin-top:4px"><i style="width:' + (Math.max(0, l[1]) / mx * 100).toFixed(1) + '%;background:' + col + '"></i></span></span><span class="droite"><span class="mont num">' + fmtv(l[1]) + '</span></span></div>'; }).join('');
}
function remplirDetail(ms, r) {
  var box = $('#p-detail'), top = S.per === 'dernier' ? P.top10Officines.dernierMois : S.per === '3' ? P.top10Officines.troisMois : P.top10Officines.annee;
  var cl = P.secteurs.map(function (s) { return [s.nom, somme(s.mois, r, 'margeNous'), eurM(somme(s.mois, r, 'ca')) + ' de chiffre d’affaires']; }).sort(function (a, b) { return b[1] - a[1]; });
  var fam = {}, tot = 0, src = S.sect === 'tous' ? P.secteurs : P.secteurs.filter(function (s) { return s.id === S.sect; });
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm || !mm.margeParFamille) continue; mm.margeParFamille.forEach(function (f) { fam[f.nom] = (fam[f.nom] || 0) + Math.max(0, f.euros); tot += Math.max(0, f.euros); }); } });
  var famL = Object.keys(fam).map(function (n) { return [n, fam[n] / (tot || 1) * 100]; });
  var rep = {}, repT = {}, tF = 0, tT = 0;
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm) continue; (mm.repartitionFamille || []).forEach(function (f) { rep[f.nom] = (rep[f.nom] || 0) + f.euros; tF += f.euros; }); (mm.repartitionTranche || []).forEach(function (f) { repT[f.nom] = (repT[f.nom] || 0) + f.euros; tT += f.euros; }); } });
  var gm = P.groupements, pc = function (v) { return nf1.format(v) + ' %'; };
  box.innerHTML =
    '<div class="carte"><div class="ent"><h2>Classement des commerciaux par notre marge</h2></div><p class="note">' + esc(libPeriode(r)) + ' · interne</p>' + barresH(cl, 'var(--c-nous)', eur, 'user') + '</div>' +
    '<div class="carte"><div class="ent"><h2>Notre marge, famille par famille</h2></div><p class="note">Part de la période · génériques comptés à zéro · interne</p>' + barresH(famL, 'var(--c-nous)', pc, 'chart') + '</div>' +
    '<div class="carte"><div class="ent"><h2>Répartition du chiffre d’affaires par famille</h2></div>' + barresH(Object.keys(rep).map(function (n) { return [n, rep[n] / tF * 100]; }), 'var(--c-ca)', pc, 'box') + '</div>' +
    '<div class="carte"><div class="ent"><h2>Répartition par tranche de prix</h2></div>' + barresH(Object.keys(repT).map(function (n) { return [n, repT[n] / tT * 100]; }), 'var(--c-ca)', pc, 'euro') + '</div>' +
    '<div class="carte"><div class="ent"><h2>Top 10 des officines</h2></div><p class="note">' + esc(libPeriode(r)) + '</p>' + barresH(top.map(function (o) { return [joli(o.nom), o.ca, o.ville + ' · marge du pharmacien ' + eur(o.margePharmacien) + ' · notre marge ' + eur(o.margeNous)]; }), 'var(--c-ca)', eur) + '</div>' +
    '<div class="carte"><div class="ent"><h2>Chiffre d’affaires et marge par groupement</h2></div><p class="note">' + P.groupementsPeriode + '</p>' + barresH(gm.map(function (g) { return [g.nom, g.ca, g.officines + ' officines · marge du pharmacien ' + eur(g.margePharmacien)]; }), 'var(--c-ca)', eurM, 'grp') + '</div>' +
    '<div class="carte"><div class="ent"><h2>Le gisement · ' + P.gisement.officines + ' officines</h2></div><p class="note">Ce que la France achète et que vos officines n’ont pas commandé, uniquement ce qu’Intégral a en stock. Classé par euros.</p><div class="ligne"><span class="past">' + icoSvg('box') + '</span><span class="txt"><b>' + P.gisement.couverture.part + ' % du marché commandé</b><span class="sub">' + nf.format(P.gisement.couverture.produitsCommandes) + ' sur ' + nf.format(P.gisement.couverture.produitsMarche) + ' produits commandés au moins une fois</span><span class="barre12" style="margin-top:4px"><i style="width:' + P.gisement.couverture.part + '%;background:var(--c-ca)"></i></span></span></div>' +
    barresH(P.gisement.lignes.map(function (g) { return [g.nom.split(',')[0], g.potentielParAn, g.officinesNeLePrennentPas + ' officines sur ' + g.surOfficines + ' ne le prennent pas · ' + eur(g.prixNetBoite) + ' la boîte']; }), 'var(--c-ca)', function (v) { return eurM(v) + ' par an'; }) + '</div>' +
    '<div class="carte"><div class="ent"><h2>Pharmacies en baisse, à relancer</h2></div><p class="note">3 derniers mois contre les 3 précédents · ' + esc(P.pharmaciesEnBaisse.regle) + '</p>' + P.pharmaciesEnBaisse.lignes.map(function (o) { return '<div class="ligne"><span class="past">' + icoSvg('bas', 'var(--e-alerte)') + '</span><span class="txt"><b>' + esc(joli(o.nom.replace(/^PHARMACIE\s+/, ''))) + '</b><span class="sub">' + esc(o.ville) + '</span></span><span class="droite"><span class="mont num">−' + Math.abs(o.pourcent) + ' %</span><span class="sub num">' + eur(o.baisseParMois) + ' par mois</span></span></div>'; }).join('') + '</div>' +
    '<p class="note" style="margin:12px 4px 0">Offilog, « Mes produits » et « Marché France » : blocs non dessinés dans cette maquette (aucune donnée fictive prévue).</p>';
}
/* ---------- CARTE DU SECTEUR (INVENTÉE : Revolut n'a pas de carte ; carte blanche arrondie, pilules, feuille qui monte du bas) ---------- */
var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PADM = 14;
var MW = (BB.est - BB.ouest) * CM * KM + 2 * PADM, MH = (BB.nord - BB.sud) * KM + 2 * PADM;
function MX(lng) { return PADM + (lng - BB.ouest) * CM * KM; }
function MY(lat) { return PADM + (BB.nord - lat) * KM; }
function teinteCA(ca) { var t = Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); var a = [174, 196, 240], b = [26, 66, 160]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }).join(',') + ')'; }
function rayonCA(ca) { var t = Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); return 4.6 + t * 6.4; }
function estClient(p) { return p.statut === 'cliente' || p.statut === 'à rappeler'; }
function pointVisible(p) {
  if (S.cf === 'clients' && !estClient(p)) return false;
  if (S.cf === 'prospects' && estClient(p)) return false;
  if (S.ccom && p.commercial !== S.ccom) return false;
  if (S.cgrp && p.groupement !== S.cgrp) return false;
  if (S.cq && (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(S.cq.toLowerCase()) < 0) return false;
  return true;
}
var carteRendue = false, POS = null;
function rayonP(p) { return estClient(p) ? rayonCA(p.ca) : 4.2; }
function positions() { /* léger écartement : aucun centre de point n'est caché par un autre */
  if (POS) return POS;
  var L = C.points.map(function (p) { return { p: p, x: MX(p.lng), y: MY(p.lat), r: rayonP(p) }; });
  for (var it = 0; it < 40; it++) { var bouge = false;
    for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
      var a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = Math.max(a.r, b.r) + 2.5;
      if (d < m) { var k = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; k = m / 2; } a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; bouge = true; } }
    if (!bouge) break; }
  POS = {}; L.forEach(function (o) { POS[o.p.id] = [o.x, o.y]; }); return POS;
}
function renderCarte() {
  var el = $('#ecran-carte');
  var fond = ''; window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; fond += '<path d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '" fill="#fff" stroke="var(--enc-5)" stroke-width="1.1"/>'; });
  var villes = window.VILLES_PACA.filter(function (v) { return v.rang <= 2; }).map(function (v) { var w = v.nom.length * 7.4 + 14; return '<g pointer-events="none"><rect x="' + (MX(v.lng) + 10).toFixed(1) + '" y="' + (MY(v.lat) - 25).toFixed(1) + '" width="' + w.toFixed(0) + '" height="21" rx="10.5" fill="#fff" stroke="var(--enc-5)" stroke-width="1"/><text x="' + (MX(v.lng) + 17).toFixed(1) + '" y="' + (MY(v.lat) - 10).toFixed(1) + '" font-size="13" font-weight="500" fill="var(--m-second)">' + v.nom + '</text></g>'; }).join('');
  var ordre = C.points.slice().sort(function (a, b) { return (estClient(b) ? 1 : 0) - (estClient(a) ? 1 : 0) || b.ca - a.ca; });
  var pts = ordre.map(function (p) {
    var col = p.statut === 'à rappeler' ? 'var(--e-attention)' : p.statut === 'cliente' ? teinteCA(p.ca) : p.statut === 'prospect' ? 'var(--enc-4)' : 'var(--enc-5)';
    return '<circle data-point="' + p.id + '" data-statut="' + p.statut + '" cx="' + positions()[p.id][0].toFixed(1) + '" cy="' + positions()[p.id][1].toFixed(1) + '" r="' + rayonP(p).toFixed(1) + '" fill="' + col + '" stroke="#fff" stroke-width="1.4" tabindex="-1"><title>' + esc(joli(p.nom)) + '</title></circle>';
  }).join('');
  el.innerHTML =
    '<p class="note eyebrow" id="c-cpt-t"></p><h1 class="titre">Carte du secteur</h1>' +
    '<div class="filtres" style="justify-content:center"><label class="filtre"><span class="ico" data-ico="search"></span><input id="c-q" type="search" placeholder="Une pharmacie, une ville, un code postal" aria-label="Rechercher sur la carte" value="' + esc(S.cq) + '"></label><b class="cpt-pil num" id="c-cpt"></b>' +
    '<div class="seg" role="group" aria-label="Afficher"><button type="button" data-filtre="tout" aria-pressed="true">Tout</button><button type="button" data-filtre="clients" aria-pressed="false">Clients</button><button type="button" data-filtre="prospects" aria-pressed="false">Prospects</button></div>' +
    '<label class="filtre">Commercial<select id="c-com" aria-label="Commercial"><option value="">Tous</option>' + C.commerciaux.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
    '<label class="filtre">Groupement<select id="c-grp" aria-label="Groupement"><option value="">Tous</option>' + C.groupements.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="carte carte-c"><svg id="c-svg" viewBox="0 0 ' + MW.toFixed(0) + ' ' + MH.toFixed(0) + '" role="img" aria-label="Carte du secteur : ' + C.points.length + ' officines">' + fond + '<g id="c-tr"></g><g id="c-pts">' + pts + '</g>' + villes + '</svg>' +
    '<div class="legende"><b>Chiffre d’affaires</b><span><i class="dot" style="width:9px;height:9px;background:' + teinteCA(2000) + '"></i>petit</span><span><i class="dot" style="width:13px;height:13px;background:' + teinteCA(60000) + '"></i>moyen</span><span><i class="dot" style="width:18px;height:18px;background:' + teinteCA(900000) + '"></i>grand</span><span><i class="dot" style="width:9px;height:9px;background:var(--e-attention)"></i>À rappeler</span><span><i class="dot" style="width:9px;height:9px;background:var(--enc-4)"></i>Prospect</span></div></div>' +
    '<div class="ronds">' + rond('list', 'Liste', 'data-act="liste"') + rond('down', 'Excel', 'data-stub="Exportation non dessinée dans cette maquette."') + rond('route', 'Ma tournée', 'data-act="tournee"', 'plein') + '</div>' +
    '<p class="note">Fond de carte local, sans service extérieur. ' + C.noteSegments + ' Treize officines de la liste sont hors des six départements et n’apparaissent pas ici.</p><p class="fict">Données fictives</p>';
  poseIcones(el); carteRendue = true;
  $$('[data-point]', el).forEach(function (c) { c.addEventListener('click', function () { S.volet = c.getAttribute('data-point'); if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; }); });
  $$('[data-filtre]', el).forEach(function (b) { b.onclick = function () { S.cf = b.getAttribute('data-filtre'); majCarte(); }; });
  $('#c-q', el).oninput = function (e) { S.cq = e.target.value; majCarte(); };
  $('#c-com', el).onchange = function (e) { S.ccom = e.target.value; majCarte(); };
  $('#c-grp', el).onchange = function (e) { S.cgrp = e.target.value; majCarte(); };
  $('[data-act="liste"]', el).onclick = ouvrirListeCarte;
  $('[data-act="tournee"]', el).onclick = ouvrirTournee;
  majCarte();
}
function majCarte() {
  var n = 0;
  $$('#c-pts [data-point]').forEach(function (c) { var p = pointById(c.getAttribute('data-point')), v = pointVisible(p); c.style.display = v ? '' : 'none'; if (v) n++; });
  $$('[data-filtre]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtre') === S.cf)); });
  $('#c-cpt').textContent = nf.format(n) + ' officines'; $('#c-cpt-t').textContent = 'La carte de votre secteur · ' + nf.format(C.points.length) + ' officines localisées';
  dessinerTournee();
}
function dessinerTournee() {
  var g = $('#c-tr'); if (!g) return;
  if (!S.tourVue) { g.innerHTML = ''; return; }
  var d = C.tournee, pts = [[MX(d.depot.lng), MY(d.depot.lat)]].concat(d.arrets.map(function (a) { var q = positions()[a.id]; return [q[0], q[1]]; }));
  g.innerHTML = '<path d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '" fill="none" stroke="var(--c-moyenne)" stroke-width="2" stroke-dasharray="6 4"/>' + pts.map(function (q, i) { return '<g pointer-events="none"><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="9" fill="#fff" stroke="var(--c-moyenne)" stroke-width="1.6"/><text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4.5).toFixed(1) + '" font-size="13" text-anchor="middle" fill="var(--enc-1)">' + (i ? i : 'D') + '</text></g>'; }).join('');
}
function ouvrirTournee() {
  S.tourVue = true; dessinerTournee(); var d = C.tournee; majVolet(false);
  panneau('Ma tournée', '<p class="note">' + esc(d.nom) + ' · départ ' + d.depart.replace(':', ' h ') + '</p><div class="trois"><div><span class="co-l">Arrêts</span><div class="val num">' + d.arrets.length + '</div></div><div><span class="co-l">Distance</span><div class="val num">' + d.kmTotal + ' km</div></div><div><span class="co-l">Fin</span><div class="val num">' + d.fin.replace(':', ' h ') + '</div></div></div>' +
    '<div class="ligne"><span class="past">D</span><span class="txt"><b>Départ · ' + esc(d.depot.nom) + '</b><span class="sub">' + esc(d.depot.adresse) + '</span></span><span class="droite"><span class="mont num">' + d.depart.replace(':', ' h ') + '</span></span></div>' +
    d.arrets.map(function (a) { var p = pointById(a.id); return '<div class="ligne"><span class="past">' + a.ordre + '</span><span class="txt"><b>' + esc(joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · visite de ' + a.dureeVisite + ' min · ' + a.kmDepuisPrecedent + ' km depuis l’arrêt précédent</span></span><span class="droite"><span class="mont num">' + a.arrivee.replace(':', ' h ') + '</span></span></div>'; }).join('') +
    '<div class="actions"><button class="pil" type="button" data-stub="Itinéraire externe non dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</button></div>');
}
function ouvrirListeCarte() {
  majVolet(false);
  var l = C.points.filter(pointVisible).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 40);
  var p = panneau('Liste des pharmacies', '<p class="note">' + l.length + ' premières, classées par chiffre d’affaires.</p>' + l.map(function (q) { return '<button type="button" class="ligne" data-ouvre="' + q.id + '"><span class="past">' + ini(q.nom) + '</span><span class="txt"><b>' + esc(joli(q.nom)) + '</b><span class="sub">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.groupement) + '</span></span><span class="droite"><span class="mont num">' + (q.ca ? eur(q.ca) : '—') + '</span></span></button>'; }).join(''));
  $$('[data-ouvre]', p).forEach(function (b) { b.onclick = function () { p.hidden = true; S.volet = b.getAttribute('data-ouvre'); if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; }; });
}
function majVolet(ouvert) {
  var v = $('#volet');
  if (!v) { v = document.createElement('aside'); v.id = 'volet'; v.className = 'feuille'; v.setAttribute('data-volet', ''); v.setAttribute('aria-label', 'Fiche de l’officine'); document.body.appendChild(v); }
  if (!ouvert || !S.volet) { v.hidden = true; $$('[data-point]').forEach(function (c) { c.removeAttribute('data-sel'); }); return; }
  var pn = $('#panneau'); if (pn) pn.hidden = true;
  var p = pointById(S.volet), cm = p.caParMois || [], mx = Math.max.apply(null, cm.concat([1])), ml10 = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
  var ex = offById(p.id);
  v.innerHTML = '<div class="poignee"></div><div class="f-t"><div><h2>' + esc(joli(p.nom)) + '</h2><p class="note">' + esc(p.titulaire) + ' · ' + esc(p.ville) + ' · ' + p.cp + '</p></div><button type="button" class="ferme" data-fermer-volet aria-label="Fermer la fiche"><span class="ico" data-ico="close"></span></button></div><div>' +
    '<div class="pastilles"><span class="chip">' + (p.statut === 'à rappeler' ? 'À rappeler' : p.statut === 'cliente' ? p.segment : p.statut === 'prospect' ? 'Prospect' : 'Aucune vente') + '</span><span class="chip">' + esc(p.commercial) + '</span><span class="chip">' + esc(p.groupement) + '</span><span class="chip">n° ' + p.id + '</span></div>' +
    (p.ca ? '<div class="trois"><div><span class="co-l">Chiffre d’affaires (10 mois)</span><div class="val num">' + gros(eur(p.ca)) + '</div></div><div><span class="co-l">Références</span><div class="val num">' + nf.format(Math.round(p.ca / 1100)) + '</div></div><div><span class="co-l">Potentiel</span><div class="val num">' + gros(eur(p.ca * 1.35)) + '</div></div></div>' +
    '<h3>Chiffre d’affaires par mois</h3><div class="mini-b">' + cm.map(function (v2, i) { return '<span class="mb"><i style="height:' + Math.max(2, v2 / mx * 56).toFixed(0) + 'px" title="' + ml10[i] + ' : ' + eur(v2) + '"></i><em>' + ml10[i].slice(0, 3) + '</em></span>'; }).join('') + '</div>' +
    '<h3>Produits phares</h3>' + (p.produits || []).map(function (q) { return '<div class="ligne" style="min-height:48px"><span class="txt"><b>' + esc(q.nom.split(',')[0]) + '</b></span><span class="droite"><span class="mont num">' + eur(q.ca) + '</span></span></div>'; }).join('') : '<p class="note">Pas encore de ventes réseau pour cette officine.</p>') +
    '<div class="co"><span class="co-l">Téléphone</span><span class="co-v">' + esc(p.telephone) + '</span></div>' +
    (p.suivi ? '<div class="co"><span class="co-l">Dernière visite</span><span class="co-v">' + (p.suivi.derniereVisite ? dfr(p.suivi.derniereVisite) : '—') + '</span></div><div class="co"><span class="co-l">Prochain rendez-vous</span><span class="co-v">' + (p.suivi.prochainRendezVous ? dfr(p.suivi.prochainRendezVous.date) + ' à ' + p.suivi.prochainRendezVous.heure.replace(':', ' h ') : '—') + '</span></div>' : '') +
    '<div class="actions">' + (ex ? '<button class="pil plein" type="button" data-action="ouvrir-fiche">Ouvrir la fiche complète</button>' : '<button class="pil" type="button" data-stub="Fiche complète non dessinée pour cette officine fictive.">Ouvrir la fiche complète</button>') + '<button class="pil" type="button" data-act="ajout">' + (S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button><button class="pil" type="button" data-stub="Itinéraire externe non dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</button></div></div>';
  poseIcones(v); v.hidden = false;
  $$('[data-point]').forEach(function (c) { if (c.getAttribute('data-point') === p.id) c.setAttribute('data-sel', '1'); else c.removeAttribute('data-sel'); });
  $('[data-fermer-volet]', v).onclick = function () { S.volet = null; location.hash = '#carte'; };
  var of = $('[data-action="ouvrir-fiche"]', v); if (of) of.onclick = function () { S.off = p.id; v.hidden = true; location.hash = '#fiche'; };
  $('[data-act="ajout"]', v).onclick = function (e) { S.tour[p.id] = !S.tour[p.id]; e.currentTarget.textContent = S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée'; };
}
/* ---------- routage et démarrage ---------- */
function route() {
  var h = (location.hash || '#liste').slice(1), base = h.split('-')[0];
  if (['liste', 'fiche', 'pilotage', 'carte'].indexOf(base) < 0) { base = 'liste'; h = 'liste'; }
  ['liste', 'fiche', 'pilotage', 'carte'].forEach(function (e) { $('#ecran-' + e).hidden = e !== base; });
  $$('[data-nav]').forEach(function (a) { var k = a.getAttribute('data-nav'), on = (k === 'officines' && (base === 'liste' || base === 'fiche')) || k === base; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var pn = $('#panneau'); if (pn) pn.hidden = true;
  S.redessin = null;
  if (base !== 'carte') majVolet(false);
  if (base === 'liste') renderListe();
  else if (base === 'fiche') renderFiche();
  else if (base === 'pilotage') { S.detail = h === 'pilotage-detail'; renderPilotage(); }
  else { if (!carteRendue) renderCarte(); if (h === 'carte-fiche') { if (!S.volet) S.volet = C.points.filter(function (p) { return p.segment === 'Client A'; })[0].id; majVolet(true); } else majVolet(false); }
  if (!(base === 'pilotage' && S.detail)) window.scrollTo(0, 0);
  else { var d = $('#p-detail'), y = d ? d.getBoundingClientRect().top + window.scrollY - 80 : 0; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); }
}
document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-stub]'); if (t) { e.preventDefault(); toast(t.getAttribute('data-stub')); } });
$('#rech-globale').addEventListener('input', function (e) { S.q = e.target.value; if (location.hash !== '#liste' && location.hash !== '') location.hash = '#liste'; else if ($('#l-q')) { $('#l-q').value = S.q; remplirLignes(); } });
var lw = window.innerWidth, rt;
window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (window.innerWidth !== lw) { lw = window.innerWidth; if (S.redessin) S.redessin(); } }, 200); });
window.addEventListener('hashchange', route);
poseIcones(document); route();
})();
