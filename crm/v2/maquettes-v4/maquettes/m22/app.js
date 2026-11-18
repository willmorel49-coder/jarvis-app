/* m22 — Strava, v4 nuancée, transposée en clair. Une page, quatre écrans : liste, fiche, pilotage, carte.
   Données : donnees.js + donnees-v4.js (fictives). Partie 1 : outils, icônes, dessins (courbe de comparaison, badge denté, barres). */
(function () {
'use strict';
var D = window.DONNEES, V = window.DONNEES_V4, P = V.pilotage, C = V.carte;
var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
var nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
var nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
function eur(n) { return nf.format(Math.round(n)) + ' €'; }
function eurM(n) { return Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + ' M€' : eur(n); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function signe(p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + nf.format(Math.abs(Math.round(p))) + ' %'; }
/* grand nombre : l'unité (€, M€) passe en petit, comme « km » chez Strava */
function gros(txt) { var m = String(txt).match(/^(.*?)(\s?(?:€|M€|k€))$/); return m ? esc(m[1]) + '<small>' + esc(m[2].trim()) + '</small>' : esc(txt); }
function ini(n) { return n.replace(/^(PHARMACIE|PHIE)\s+(DU|DE LA|DE|DES|D’|DE L’)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'P'; }
var PETITS = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'd’', 'l’', 'aux', 'au'];
function joli(n) { var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  return String(n).toLowerCase().replace(/'/g, '’').split(' ').map(function (t, k) {
    if (k > 0 && PETITS.indexOf(t) >= 0) return t;
    return t.split('-').map(function (s, q) { if (q > 0 && PETITS.indexOf(s) >= 0) return s; var ap = s.indexOf('’'); return ap > 0 && ap < 3 ? s.slice(0, ap + 1) + cap(s.slice(ap + 1)) : cap(s); }).join('-'); }).join(' '); }
function dateFr(d) { return d ? d.split('-').reverse().join('/') : '—'; }
var ICO = {
  officines: '<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6M12 9v3M10.5 10.5h3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pin: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16 9.5"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>',
  haut: '<path d="M7 17L17 7M9 7h8v8"/>',
  bas: '<path d="M7 7l10 10M17 9v8H9"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  chevb: '<path d="M6 9l6 6 6-6"/>',
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
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  boussole: '<path d="M12 4l4 9H8zM8 15l4 5 4-5"/>',
  tri: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  filtre: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>'
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
/* ---------- dessins ---------- */
/* Bouclier de carte (le « shield » orange de Strava), en trait fin : contour d'encre, chevrons de la couleur du chiffre */
function bouclier(col) {
  return '<svg class="bouclier" viewBox="0 0 40 46" width="40" height="46" aria-hidden="true"><path d="M20 3l15 5v14c0 9-6 16-15 21C11 38 5 31 5 22V8z" fill="#fff" stroke="var(--enc-2)" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M13 25l7-11 7 11M15.5 29.5L20 23l4.5 6.5" fill="none" stroke="' + (col || 'var(--c-ca)') + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/* Badge denté (les médailles de « Projections ») : couronne à 12 dents, trait de la couleur du chiffre */
function badge(col, glyphe, texte) {
  var pts = [], N = 120, R = 29, cx = 34, cy = 34;
  for (var i = 0; i < N; i++) { var a = i / N * Math.PI * 2, r = R * (1 + 0.075 * Math.cos(12 * a)); pts.push((cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1)); }
  return '<svg class="badge" viewBox="0 0 68 68" width="68" height="68" aria-hidden="true"><path d="M' + pts.join('L') + 'Z" fill="#fff" stroke="' + col + '" stroke-width="2.6" stroke-linejoin="round"/>' +
    (glyphe ? '<g transform="translate(22 22) scale(1.0)" fill="none" stroke="' + col + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICO[glyphe] || '') + '</g>' : '') +
    (texte ? '<text x="34" y="40" font-size="19" font-weight="800" text-anchor="middle" fill="' + col + '">' + esc(texte) + '</text>' : '') + '</svg>';
}
/* Courbe « Comparaison des progrès » : sans axes, segments droits, points blancs cerclés, aire sous la 1re série seulement,
   point actif grossi avec halo, légende = pastille + grand chiffre. cfg : {labels, a, b, aCol, aVoile, bCol, aNom, bNom, fmt, h, dans:[i0,i1], incompl:[i], sousTitres:[]} */
function courbe(cfg) {
  var n = cfg.a.length, W = cfg.w || 560, H = cfg.h || 220, PX = 26, PT = 26, PB = 16, bCol = cfg.bCol || 'var(--enc-4)';
  var vals = cfg.a.filter(isFinite).concat((cfg.b || []).filter(function (v) { return v != null && isFinite(v); }));
  if (!vals.length || cfg.a.some(function (v) { return !isFinite(v); })) return '';
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); if (mx === mn) mx = mn + 1;
  var span = mx - mn; mn -= span * .12; mx += span * .1;
  var X = function (i) { return PX + i * (W - 2 * PX) / Math.max(1, n - 1); };
  var Y = function (v) { return PT + (H - PT - PB) * (1 - (v - mn) / (mx - mn)); };
  var base = H - PB + 4;
  function chemin(arr) { var d = '', pre = false; arr.forEach(function (v, i) { if (v == null || !isFinite(v)) { pre = false; return; } d += (pre ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pre = true; }); return d; }
  var dA = chemin(cfg.a), dB = cfg.b ? chemin(cfg.b) : '';
  var s = '<div class="cb" data-cb><div class="cb-zone"><svg class="cb-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || 'Courbe de comparaison') + '">';
  s += '<path class="cb-aire" d="' + dA + 'L' + X(n - 1).toFixed(1) + ' ' + base + 'L' + X(0).toFixed(1) + ' ' + base + 'Z" fill="' + (cfg.aVoile || 'var(--c-ca-voile)') + '"/>';
  if (dB) s += '<path class="cb-trait cb-b" pathLength="1" d="' + dB + '" fill="none" stroke="' + bCol + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<path class="cb-trait cb-a" pathLength="1" d="' + dA + '" fill="none" stroke="' + cfg.aCol + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  var dedans = function (i) { return !cfg.dans || (i >= cfg.dans[0] && i <= cfg.dans[1]); };
  if (cfg.b) cfg.b.forEach(function (v, i) { if (v != null && isFinite(v)) s += '<circle class="cb-pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="5" fill="#fff" stroke="' + bCol + '" stroke-width="2.8"/>'; });
  cfg.a.forEach(function (v, i) { s += '<circle class="cb-pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (dedans(i) ? 5.6 : 4) + '" fill="' + (cfg.incompl && cfg.incompl.indexOf(i) >= 0 ? '#fff' : '#fff') + '" stroke="' + cfg.aCol + '" stroke-width="' + (dedans(i) ? 3 : 2.2) + '"' + (cfg.incompl && cfg.incompl.indexOf(i) >= 0 ? ' stroke-dasharray="3 2.4"' : '') + '/>'; });
  s += '<g class="cb-act"><circle class="cb-halo-b" r="20" fill="'+bCol+'" fill-opacity=".16" cx="-50" cy="-50"/><circle class="cb-pt-b" r="9" fill="' + bCol + '" cx="-50" cy="-50"/><circle class="cb-halo-a" r="22" fill="' + (cfg.aHalo || cfg.aCol) + '" fill-opacity=".16" cx="-50" cy="-50"/><circle class="cb-pt-a" r="9.5" fill="' + cfg.aCol + '" cx="-50" cy="-50"/></g>';
  for (var i = 0; i < n; i++) s += '<rect class="cb-hit" data-i="' + i + '" x="' + (X(i) - (W - 2 * PX) / (n - 1) / 2).toFixed(1) + '" y="0" width="' + ((W - 2 * PX) / (n - 1)).toFixed(1) + '" height="' + H + '" fill="transparent"/>';
  s += '</svg><div class="cb-bulle" hidden></div></div>';
  if (cfg.labels && !cfg.sansMois) s += '<div class="cb-mois" aria-hidden="true">' + cfg.labels.map(function (l, i) { return '<span data-i="' + i + '" style="left:' + (X(i) / W * 100).toFixed(2) + '%">' + esc(l) + '</span>'; }).join('') + '</div>';
  s += '<div class="cb-leg">' +
    '<div class="cb-l"><i class="cb-p" style="background:' + cfg.aCol + '"></i><div><b class="cb-va num"></b><span class="cb-na">' + esc(cfg.aNom) + '</span></div></div>' +
    (cfg.b ? '<div class="cb-l"><i class="cb-p" style="background:' + bCol + '"></i><div><b class="cb-vb num"></b><span class="cb-nb">' + esc(cfg.bNom) + '</span></div></div>' : '') + '</div></div>';
  return { html: s, bind: function (box) {
    var cb = $('[data-cb]', box), W2 = W, act = $('.cb-act', cb), RMs = RM;
    function pose(i, bulle) {
      i = Math.max(0, Math.min(n - 1, i));
      var xa = X(i), ya = Y(cfg.a[i]);
      $('.cb-halo-a', cb).setAttribute('cx', xa.toFixed(1)); $('.cb-halo-a', cb).setAttribute('cy', ya.toFixed(1));
      $('.cb-pt-a', cb).setAttribute('cx', xa.toFixed(1)); $('.cb-pt-a', cb).setAttribute('cy', ya.toFixed(1));
      var vb = cfg.b ? cfg.b[i] : null, okb = vb != null && isFinite(vb);
      ['.cb-halo-b', '.cb-pt-b'].forEach(function (q) { var e = $(q, cb); e.setAttribute('cx', okb ? xa.toFixed(1) : -50); e.setAttribute('cy', okb ? Y(vb).toFixed(1) : -50); });
      $('.cb-va', cb).innerHTML = gros(cfg.fmt(cfg.a[i]));
      var nom = (cfg.sous && cfg.sous[i]) ? ' · ' + cfg.sous[i] : '';
      $('.cb-na', cb).textContent = cfg.aNom + nom;
      if (cfg.b) { $('.cb-vb', cb).innerHTML = okb ? gros(cfg.fmt(vb)) : '—'; $('.cb-nb', cb).textContent = cfg.bNom + (okb ? nom : ' · pas de comparaison'); }
      $$('.cb-mois span', cb).forEach(function (m) { m.classList.toggle('on', +m.getAttribute('data-i') === i); });
      var bu = $('.cb-bulle', cb);
      if (bulle) { bu.hidden = false; bu.style.left = (xa / W2 * 100).toFixed(1) + '%'; bu.style.top = (ya / H * 100).toFixed(1) + '%'; bu.innerHTML = '<b>' + esc(cfg.labelsLong ? cfg.labelsLong[i] : cfg.labels[i]) + '</b> ' + esc(cfg.fmt(cfg.a[i])) + (okb ? ' · ' + esc(cfg.fmt(vb)) : ''); }
      else bu.hidden = true;
    }
    $$('.cb-hit', cb).forEach(function (r) {
      var f = function () { pose(+r.getAttribute('data-i'), true); };
      r.addEventListener('mouseenter', f); r.addEventListener('click', f); r.addEventListener('touchstart', f, { passive: true });
    });
    cb.addEventListener('mouseleave', function () { pose(cfg.actif == null ? n - 1 : cfg.actif, false); });
    pose(cfg.actif == null ? n - 1 : cfg.actif, false);
  } };
}
function monter(box, c) { if (!c) { box.innerHTML = ''; return; } box.innerHTML = c.html; c.bind(box); }
/* Barres horizontales de 12 px (tronçons de Strava) : lignes [nom, valeur, sous, repère] */
function barresH(lignes, col, fmtv, opt) {
  opt = opt || {};
  var mx = Math.max.apply(null, lignes.map(function (l) { return Math.max(l[1], l[3] || 0); }).concat([1]));
  return '<div class="troncons">' + lignes.map(function (l) {
    return '<div class="tr"><span class="tr-nom"><b>' + esc(l[0]) + '</b>' + (l[2] ? '<span class="sub">' + esc(l[2]) + '</span>' : '') + '</span>' +
      '<span class="tr-bar"><span class="bar12"><i style="width:' + (Math.max(0, l[1]) / mx * 100).toFixed(1) + '%;background:' + (l[4] || col) + '"></i>' +
      (l[3] != null ? '<em class="rep" style="left:' + (l[3] / mx * 100).toFixed(1) + '%" title="' + esc(opt.repNom || 'Moyenne de nos clients') + '"></em>' : '') + '</span><span class="num tr-v">' + fmtv(l[1]) + '</span></span></div>'; }).join('') + '</div>';
}
function miniCourbe(vals, moy, col, w, h) { /* vignette « itinéraire » d'une ligne de la liste */
  if (!vals.length || !vals.every(isFinite)) return '';
  var all = vals.concat(moy ? [moy] : []), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all), pad = 7; if (mx === mn) mx = mn + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / (vals.length - 1); }, Y = function (v) { return h - pad - (v - mn) * (h - 2 * pad) / (mx - mn); };
  var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
  return '<svg class="vign-svg" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
    (moy ? '<path d="M' + pad + ' ' + Y(moy).toFixed(1) + 'L' + (w - pad) + ' ' + Y(moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1 5" fill="none"/>' : '') +
    '<path class="trace" pathLength="1" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + X(vals.length - 1).toFixed(1) + '" cy="' + Y(vals[vals.length - 1]).toFixed(1) + '" r="4.6" fill="#fff" stroke="' + col + '" stroke-width="2.6"/></svg>';
}
function anneau(score, t) {
  var r = 15, c = 2 * Math.PI * r, tt = t || 5;
  return '<svg class="anneau" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="' + r + '" fill="none" stroke="var(--enc-5)" stroke-width="' + tt + '"/><circle cx="20" cy="20" r="' + r + '" fill="none" stroke="var(--c-ca)" stroke-width="' + tt + '" stroke-linecap="round" stroke-dasharray="' + (c * score / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 20 20)"/></svg>';
}
function couronne() { return '<svg class="couronne" viewBox="0 0 30 24" width="30" height="24" aria-label="Première place" role="img"><path d="M3 20h24l1.5-13-7 5L15 3l-6.5 9-7-5zM4 22h22" fill="var(--e-attention)" stroke="var(--e-attention)" stroke-width="1.6" stroke-linejoin="round"/></svg>'; }
/* ---------- Partie 2 : modèle, projection de la carte, liste ---------- */
var MOY = D.moyenneClients, OFF = D.officines;
var S = { vue: 'integral', off: OFF[0].id, stat: 'clients', grp: '', q: '', nb: 20, serie: 'ca',
  sect: 'tous', per: 'dernier', du: 9, au: 11, detail: false, cf: 'tout', cq: '', ccom: '', cgrp: '', volet: null, tour: {}, tourVue: false, couche: 'ca' };
function offById(id) { for (var i = 0; i < OFF.length; i++) if (OFF[i].id === id) return OFF[i]; return null; }
function pointById(id) { for (var i = 0; i < C.points.length; i++) if (C.points[i].id === id) return C.points[i]; return null; }
function etatOff(o) { return o.statut === 'prospect' ? 'prospect' : o.aRappeler ? 'rappel' : 'cliente'; }
var ETAT = { cliente: ['check', 'var(--e-bien)', 'Cliente'], rappel: ['bell', 'var(--e-attention)', 'À rappeler'], prospect: ['user', 'var(--e-neutre)', 'Prospect'], aucune: ['user', 'var(--e-neutre)', 'Aucune vente'] };
function etatHtml(k) { var e = ETAT[k]; return '<span class="etat"><span class="ico">' + icoSvg(e[0], e[1]) + '</span>' + e[2] + '</span>'; }
/* projection du fond de carte local (aucune tuile) */
var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PADM = 14;
var MW = (BB.est - BB.ouest) * CM * KM + 2 * PADM, MH = (BB.nord - BB.sud) * KM + 2 * PADM;
function MX(lng) { return PADM + (lng - BB.ouest) * CM * KM; }
function MY(lat) { return PADM + (BB.nord - lat) * KM; }
var FOND = null;
function fondPaths() {
  if (FOND) return FOND;
  FOND = '';
  window.FOND_PACA.features.forEach(function (f) {
    var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    FOND += '<path d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '" class="terre"/>';
  });
  return FOND;
}
function ficheDe(id) { /* la 1re officine reprend DONNEES.fiche ; les autres sont dérivées de leur ligne (inventé, proportionnel) */
  var o = offById(id), F = D.fiche;
  if (id === F.id) return F;
  var k = o.ca ? o.ca / F.ca : 0, kn = F.margeNous ? o.margeNous / F.margeNous : 0, kp = F.margePharmacien ? o.margePharmacien / F.margePharmacien : 0;
  var cm = o.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2] || 0;
  var base = JSON.parse(JSON.stringify(F)), num = parseInt(id.replace(/\D/g, ''), 10);
  base.id = o.id; base.nom = o.nom; base.statut = o.statut; base.ca = o.ca; base.margeNous = o.margeNous; base.margePharmacien = o.margePharmacien;
  base.caParMois = cm; base.margeNousParMois = F.margeNousParMois.map(function (v) { return Math.round(v * kn); });
  base.margePharmacienParMois = F.margePharmacienParMois.map(function (v) { return Math.round(v * kp); });
  base.dernierMois = { libelle: F.dernierMois.libelle, ca: last, evolutionSurMoisPrecedent: prev ? Math.round((last - prev) / prev * 100) : 0 };
  base.produitsDifferentsAchetes = Math.round(F.produitsDifferentsAchetes * Math.sqrt(k || .01));
  base.categories.forEach(function (c) { c.montant = Math.round(c.montant * k); });
  var meilleurs = OFF.filter(function (x) { return x.statut !== 'prospect' && x.ca > o.ca; }).length;
  base.rang = { france: o.statut === 'prospect' ? 0 : Math.max(1, Math.round(F.rang.surFrance * (meilleurs / 39) * .5) + 1), surFrance: F.rang.surFrance, groupement: 1 + meilleurs % 9, surGroupement: F.rang.surGroupement };
  base.identite.titulaires = o.titulaire; base.identite.groupement = o.groupement; base.identite.ville = o.ville; base.identite.cp = o.cp;
  base.identite.cip = '2' + (300000 + num * 137).toString().slice(0, 6);
  base.identite.adresse = 'Adresse à compléter'; base.identite.aSavoir = ''; base.identite.nbPharmaciens = '—';
  base.identite.telephone = '04 00 ' + ('00' + (10 + num)).slice(-2) + ' 46 78'; base.identite.portable = '04 00 12 45 81'; base.identite.fax = ''; base.identite.email = 'contact@' + id + '.example';
  base.aProposer.groupeAchat.groupement = o.groupement; base.aProposer.groupeAchat.nbProduits = 300 + (num * 17) % 300;
  return base;
}
/* ---------- LISTE : le fil d'activités de Strava ---------- */
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
function ligneHtml(o) {
  var e = etatOff(o), est = o.statut === 'prospect', last = o.caParMois[o.caParMois.length - 1], prev = o.caParMois[o.caParMois.length - 2];
  var evo = prev ? Math.round((last - prev) / prev * 100) : null;
  var vign = est ? '<span class="vign-ini">' + ini(o.nom) + '</span>' : miniCourbe(o.caParMois, MOY.caMois, 'var(--c-ca)', 132, 96);
  var baisse = o.baisse3mois != null ? '<span class="baisse"><span class="ico">' + icoSvg('bas', 'var(--e-alerte)') + '</span>−' + Math.abs(o.baisse3mois) + ' % en 3 mois</span>' : '';
  return '<a class="fil" href="#fiche" data-officine="' + o.id + '" role="row">' +
    '<span class="vign" aria-hidden="true">' + vign + '</span>' +
    '<span class="fil-nom"><b>' + esc(joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + o.cp + ' · ' + esc(o.groupement) + '</span><span class="fil-etat">' + etatHtml(e) + baisse + '</span></span>' +
    '<span class="fil-stats">' +
      '<span class="st"><span class="st-l"><i class="puce" style="background:var(--c-ca)"></i>Chiffre d’affaires</span><span class="st-v num">' + (est ? '—' : gros(eur(o.ca))) + '</span><span class="st-s">janv.–oct. 2026' + (evo == null || est ? '' : ' · ' + signe(evo) + ' en octobre') + '</span></span>' +
      '<span class="st" data-interne><span class="st-l"><i class="puce" style="background:var(--c-nous)"></i>Notre marge Intégral</span><span class="st-v num">' + (est ? '—' : gros(eur(o.margeNous))) + '</span><span class="st-s">estimation</span></span>' +
      '<span class="st"><span class="st-l"><i class="puce" style="background:var(--c-pharma)"></i>Marge du pharmacien</span><span class="st-v num">' + (est ? '—' : gros(eur(o.margePharmacien))) + '</span><span class="st-s">janv.–oct. 2026</span></span></span>' +
    '<span class="fil-prop"><span class="badge-prop">' + anneau(o.score, 5) + '<span class="bp-t"><b class="num">' + o.score + '</b> sur 100<small>À lui proposer</small></span></span></span></a>';
}
function renderListe() {
  var el = $('#ecran-liste'), nbC = D.secteur.nbClientes, nbP = D.secteur.nbProspects;
  var ap = OFF.filter(function (o) { return o.aRappeler; });
  var grps = []; OFF.forEach(function (o) { if (grps.indexOf(o.groupement) < 0) grps.push(o.groupement); });
  el.innerHTML =
    '<div class="profil cs"><div class="profil-t"><p class="eyebrow">Mon secteur · ' + esc(D.secteur.commerciale) + '</p><h1 class="titre">Mes officines</h1>' +
    '<p class="sous">' + nf.format(D.secteur.nbOfficines) + ' officines dans le secteur · moyenne de nos ' + nf.format(MOY.nClients) + ' clients : <b class="num">' + eur(MOY.caMois) + '</b> par mois</p></div>' +
    '<div class="profil-s" role="group" aria-label="Afficher">' +
      '<button type="button" class="stat-b" data-lstat="clients" aria-pressed="' + (S.stat === 'clients') + '"><b class="num">' + nf.format(nbC) + '</b><span>Clients</span></button>' +
      '<button type="button" class="stat-b" data-lstat="prospects" aria-pressed="' + (S.stat === 'prospects') + '"><b class="num">' + nf.format(nbP) + '</b><span>Prospects de mon secteur</span></button>' +
      '<div class="stat-r"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--enc-5)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--e-attention)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + (163.4 * ap.length / 12).toFixed(1) + ' 163.4" transform="rotate(-90 32 32)"/></svg><span class="stat-rt"><b class="num">' + ap.length + '</b><span>à rappeler cette semaine</span></span></div></div></div>' +
    '<div class="sousnav" role="tablist"><a href="#liste" class="on"><span class="ico" data-ico="officines"></span>Officines</a><button type="button" data-stub="Écran Groupements non dessiné dans cette maquette."><span class="ico" data-ico="layers"></span>Groupements</button><button type="button" data-stub="Écran Mes listes non dessiné dans cette maquette."><span class="ico" data-ico="list"></span>Mes listes</button><a href="#carte"><span class="ico" data-ico="pin"></span>Carte secteur</a></div>' +
    '<div class="chips"><label class="chip-s"><span class="ico" data-ico="search"></span><input id="l-q" type="search" value="' + esc(S.q) + '" placeholder="Nom, titulaire, ville ou code postal" aria-label="Rechercher dans la liste"></label>' +
    '<label class="chip">Commercial<select id="l-com" aria-label="Commercial"><option>Tous</option><option>' + esc(D.secteur.commerciale) + '</option></select><span class="ico" data-ico="chevb"></span></label>' +
    '<label class="chip">Groupement<select id="l-grp" aria-label="Groupement"><option value="">Tous</option>' + grps.map(function (g) { return '<option' + (S.grp === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select><span class="ico" data-ico="chevb"></span></label>' +
    '<span class="chips-d"><button type="button" class="pil" data-stub="Exportation non dessinée dans cette maquette."><span class="ico" data-ico="down"></span>Exporter mes clients en Excel</button><button type="button" class="pil plein" data-stub="Création non dessinée dans cette maquette."><span class="ico" data-ico="plus"></span>Créer un prospect</button></span></div>' +
    (S.stat === 'clients' ? '<div class="rappel"><h2 class="titre-s">À rappeler cette semaine</h2><div class="rap-l">' + ap.slice(0, 6).map(function (o) { return '<button type="button" class="rap cs" data-rappel="' + o.id + '"><span class="ico">' + icoSvg('bell', 'var(--e-attention)') + '</span><span class="rap-t"><b>' + esc(joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.baisse3mois != null ? ' · −' + Math.abs(o.baisse3mois) + ' % en 3 mois' : '') + '</span></span></button>'; }).join('') + '</div></div>' : '') +
    '<p class="note cpt" id="l-cpt"></p>' +
    '<div class="fil-l" id="l-lignes" role="table" aria-label="Officines"></div>' +
    '<div class="pied-l"><button type="button" class="pil" id="l-plus">Afficher 10 de plus</button><p class="note">Moyenne de nos ' + nf.format(MOY.nClients) + ' clients : ' + eur(MOY.caMois) + ' par mois (pointillé gris dans chaque vignette). Notre marge : estimation, génériques comptés à zéro. Données fictives.</p></div>';
  poseIcones(el); remplirLignes();
  $$('[data-lstat]', el).forEach(function (b) { b.onclick = function () { S.stat = b.getAttribute('data-lstat'); S.nb = 20; renderListe(); }; });
  $('#l-grp', el).onchange = function (e) { S.grp = e.target.value; S.nb = 20; remplirLignes(); };
  $('#l-q', el).oninput = function (e) { S.q = e.target.value; remplirLignes(); };
  $('#l-plus', el).onclick = function () { S.nb += 10; remplirLignes(); };
  $$('[data-rappel]', el).forEach(function (b) { b.onclick = function () { ouvrirFiche(b.getAttribute('data-rappel')); }; });
}
function ouvrirFiche(id) { S.off = id; if (location.hash === '#fiche') route(); else location.hash = '#fiche'; }
function remplirLignes() {
  var l = listeFiltree(), aff = l.slice(0, S.nb), box = $('#l-lignes');
  box.innerHTML = aff.length ? aff.map(ligneHtml).join('') : '<p class="vide">Aucune officine. Aucun résultat pour « ' + esc(S.q) + ' ».</p>';
  $('#l-cpt').textContent = nf.format(D.secteur.nbOfficines) + ' officines, classées par chiffre d’affaires de janv. à oct. 2026 · ' + aff.length + ' affichées';
  $('#l-plus').hidden = l.length <= S.nb;
  $$('[data-officine]', box).forEach(function (a) { a.addEventListener('click', function (ev) { ev.preventDefault(); ouvrirFiche(a.getAttribute('data-officine')); }); });
}
/* ---------- Partie 3 : fiche d'une officine (page « activité » de Strava) ---------- */
var MOIS_LONG = { 'janv.': 'janvier', 'févr.': 'février', 'mars': 'mars', 'avr.': 'avril', 'mai': 'mai', 'juin': 'juin', 'juil.': 'juillet', 'août': 'août', 'sept.': 'septembre', 'oct.': 'octobre' };
function ml(l) { return MOIS_LONG[l] || l; }
function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function T(vous, elle) { return S.vue === 'pharmacien' ? vous : elle; }
function carteS(titre, corps, col, cls, id) { /* carte Strava : bouclier + titre sur 2 lignes + une seule idée */
  return '<section class="cs ' + (cls || '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + (titre ? '<header class="cs-t">' + bouclier(col) + '<h2>' + titre + '</h2></header>' : '') + corps + '</section>';
}
function heroCarte(o, p) {
  if (!p) return '<div class="hero-carte hors"><span class="vign-ini grand">' + ini(o.nom) + '</span><span class="note">Hors des six départements de la carte</span></div>';
  var x = MX(p.lng), y = MY(p.lat);
  return '<div class="hero-carte"><svg viewBox="' + (x - 78).toFixed(1) + ' ' + (y - 60).toFixed(1) + ' 156 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Position de ' + esc(joli(o.nom)) + ' sur la carte du secteur">' +
    fondPaths() + '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="var(--c-ca)" fill-opacity=".16"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7.5" fill="var(--c-ca)" stroke="#fff" stroke-width="2.6"/></svg><span class="hero-pin">' + esc(o.ville) + '</span></div>';
}
function ligneListe(titre, n, arr, sc) {
  return '<section class="cs liste-prop"><header class="cs-t">' + bouclier(sc) + '<h2>' + esc(titre) + '</h2></header><p class="lp-n"><b class="num">' + nf.format(n) + '</b> produits</p>' +
    '<div class="lp-btn"><button type="button" class="pil" data-stub="Téléchargement non dessiné dans cette maquette."><span class="ico" data-ico="doc"></span>Télécharger en PDF</button><button type="button" class="pil" data-stub="Téléchargement non dessiné dans cette maquette."><span class="ico" data-ico="down"></span>Télécharger en Excel</button><button type="button" class="pil plein" data-stub="Envoi non dessiné dans cette maquette."><span class="ico" data-ico="send"></span>Envoyer cette liste</button></div>' +
    '<div class="lp-ent"><span>Produit</span><span>Officines qui le commandent</span></div>' +
    '<div class="troncons">' + arr.slice(0, 5).map(function (p) { return '<div class="tr"><span class="tr-nom"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></span><span class="tr-bar"><span class="bar12"><i style="width:' + p.partOfficines + '%;background:' + sc + '"></i></span><span class="num tr-v">' + p.partOfficines + ' % des officines</span></span></div>'; }).join('') + '</div></section>';
}
function lignesCoord(F) {
  var I = F.identite;
  var L = [['Ville', I.cp + ' ' + I.ville, 0], ['Adresse', I.adresse, 0], ['Titulaire', I.titulaires, 0], ['Groupement', I.groupement, 0],
    ['Téléphone', I.telephone, 1], ['Portable', I.portable, 1], ['E-mail', I.email, 1], ['Logiciel', I.logiciel || 'inconnu', 1], ['Grossiste principal', I.grossistePrincipal, 1],
    ['Pharmaciens', I.nbPharmaciens, 1], ['CIP', I.cip, 1], ['Fax', I.fax || '—', 1]];
  return L.map(function (l) { return '<div class="co"' + (l[2] ? ' data-interne' : '') + '><span class="co-l">' + l[0] + '</span><span class="co-v">' + esc(l[1]) + '</span></div>'; }).join('');
}
function renderFiche() {
  var el = $('#ecran-fiche'), o = offById(S.off) || OFF[0], F = ficheDe(o.id), I = F.identite, pv = S.vue === 'pharmacien', pt = pointById(o.id);
  var mois = F.moisLabels, cm = F.caParMois, n = cm.length, last = cm[n - 1], prev = cm[n - 2], best = cm.indexOf(Math.max.apply(null, cm));
  var evo = prev ? Math.round((last - prev) / prev * 100) : 0, ratio = (F.ca / 10) / MOY.caMois, prospect = o.statut === 'prospect';
  var pm = F.margePharmacienParMois.reduce(function (a, b) { return a + b; }, 0) / 10, nm = F.margeNousParMois.reduce(function (a, b) { return a + b; }, 0) / 10;
  var autres = OFF.filter(function (x) { return x.statut !== 'prospect'; });
  el.setAttribute('data-vue-actuelle', S.vue);
  var rang = autres.slice().sort(function (a, b) { return b.ca - a.ca; });
  var pos = rang.map(function (x) { return x.id; }).indexOf(o.id);
  var fen = pos < 0 ? [] : pos <= 2 ? rang.slice(0, 4).map(function (x, k) { return [k, x]; }) : [[0, rang[0]]].concat([pos - 1, pos, pos + 1].filter(function (k) { return k < rang.length; }).map(function (k) { return [k, rang[k]]; }));
  var classement = fen.map(function (r) { var x = r[1], moi = x.id === o.id;
    return '<div class="rg' + (moi ? ' moi' : '') + '"><span class="rg-n num">' + (r[0] + 1) + '</span><span class="rg-av" aria-hidden="true">' + ini(x.nom) + '</span><span class="rg-nom"><b>' + (moi ? 'Cette officine' : esc(joli(x.nom))) + '</b><span class="sub">' + (moi ? esc(joli(x.nom)) + ' · ' : '') + eur(x.ca) + ' · janv.–oct. 2026</span></span>' + (r[0] === 0 ? couronne() : '') + '</div>'; }).join('');
  var fam = P.secteurs[0].mois[11].margeParFamille;
  el.innerHTML =
    '<div class="barre-f"><button type="button" class="pil" data-action="retour"><span class="ico" data-ico="back"></span>Officines</button>' +
    '<label class="chip" data-interne>Autre officine<select id="f-autre" aria-label="Autre officine"><option value="">Choisir…</option>' + autres.map(function (x) { return '<option value="' + x.id + '">' + esc(joli(x.nom)) + '</option>'; }).join('') + '</select><span class="ico" data-ico="chevb"></span></label>' +
    '<div class="seg" role="group" aria-label="Vue"><button type="button" data-vue="integral" aria-pressed="' + !pv + '">Vue Intégral</button><button type="button" data-vue="pharmacien" aria-pressed="' + pv + '">Vue pharmacien</button></div>' +
    '<button type="button" class="pil" data-interne data-stub="Brief du jour non dessiné dans cette maquette.">Voir le brief du jour <b class="cpt7">7</b></button></div>' +
    '<p class="note vuenote">' + (pv ? 'Vue pharmacien : rien d’interne à l’écran, vous pouvez la lui montrer.' : 'Vue Intégral : notre marge, comparée à nos clients. À ne pas lui montrer.') + '</p>' +
    '<section class="cs hero-f">' + heroCarte(o, pt) +
    '<div class="hero-t"><p class="eyebrow" data-interne>CIP ' + I.cip + ' · ' + (prospect ? 'PROSPECT' : 'CLIENTE INTÉGRAL') + ' · ' + esc(D.secteur.commerciale) + '</p><h1 class="titre">' + esc(joli(F.nom)) + '</h1>' +
    '<p class="sous">' + esc(I.ville) + ' · ' + I.cp + ' · ' + esc(I.titulaires) + '</p><p class="etats">' + etatHtml(etatOff(o)) + '<span class="sub">' + (prospect ? 'Aucune vente' : 'Cliente depuis ' + (F.clienteDepuis || '2019')) + '</span></p>' +
    '<div class="trois"><div><span class="co-l"><i class="puce" style="background:var(--c-ca)"></i>' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + '</span><b class="grand num" id="f-ca">' + gros(eur(F.ca)) + '</b><span class="st-s">' + F.periode + '</span></div>' +
    '<div data-interne><span class="co-l"><i class="puce" style="background:var(--c-nous)"></i>Notre marge Intégral</span><b class="grand num">' + gros(eur(F.margeNous)) + '</b><span class="st-s">estimation, génériques à zéro</span></div>' +
    '<div><span class="co-l"><i class="puce" style="background:var(--c-pharma)"></i>' + T('Votre marge', 'Marge du pharmacien') + '</span><b class="grand num">' + gros(eur(F.margePharmacien)) + '</b><span class="st-s">' + F.periode + '</span></div></div>' +
    '<p class="dernier"><b class="num">' + F.dernierMois.libelle + ' : ' + eur(last) + '</b><span class="evo"><span class="ico">' + icoSvg(evo < 0 ? 'bas' : 'haut', evo < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span>' + signe(evo) + ' sur ' + ml(mois[n - 2]) + '</span></p>' +
    '<div class="actions" data-interne><button class="pil plein" type="button" data-stub="Appel non dessiné."><span class="ico" data-ico="phone"></span>Appeler</button><button class="pil" type="button" data-stub="E-mail non dessiné."><span class="ico" data-ico="mail"></span>Écrire un e-mail</button><button class="pil" type="button" data-stub="Note non dessinée."><span class="ico" data-ico="note"></span>Prendre une note</button><button class="pil" type="button" data-stub="Rendez-vous non dessiné."><span class="ico" data-ico="cal"></span>Proposer un rendez-vous</button><button class="pil" type="button" data-stub="Rendez-vous non dessiné."><span class="ico" data-ico="cal"></span>Noter un rendez-vous</button><button class="pil" type="button" data-stub="Catalogue non dessiné."><span class="ico" data-ico="box"></span>Voir ses produits</button><button class="pil" type="button" data-stub="Comparaison non dessinée."><span class="ico" data-ico="chart"></span>Comparer avec D2P</button></div></div></section>' +
    '<div class="g-comp">' +
    carteS('<span id="f-titre-c"></span>', '<p class="note" id="f-sous-c"></p><div class="seg seg-c" role="group" aria-label="Série"><button type="button" data-serie="ca" aria-pressed="' + (S.serie === 'ca') + '">Chiffre d’affaires</button><button type="button" data-serie="marges" aria-pressed="' + (S.serie === 'marges') + '">Marges</button></div><div id="f-courbe"></div>', 'var(--c-ca)', 'c-comp', 'f-comparaison') +
    carteS(T('Vos repères', 'Ses repères'), '<div class="grille22" id="f-rep"></div>', 'var(--c-cmd)', 'c-rep') + '</div>' +
    '<h2 class="titre-s" id="f-prop">À proposer</h2>' +
    '<div class="gdeux">' + ligneListe('Le réseau Intégral', F.aProposer.reseau.nbProduits, F.aProposer.reseau.premiers, 'var(--cat-1)') + ligneListe(I.groupement === 'Sans groupement' ? 'Listing du groupe d’achat' : 'Listing ' + I.groupement, F.aProposer.groupeAchat.nbProduits, F.aProposer.groupeAchat.premiers, 'var(--cat-3)') + '</div>' +
    '<div class="gtrois acts"><div class="cs act"><span class="ico" data-ico="box"></span><div><b>Catalogue pour son logiciel</b><span class="sub">' + esc(I.logiciel || 'À choisir') + ' · ' + esc(F.aProposer.catalogueLogiciel.libelle) + '</span></div><button class="pil" type="button" data-stub="Catalogue non dessiné.">Préparer</button></div>' +
    '<div class="cs act" data-interne><span class="ico" data-ico="list"></span><div><b>Liste de tâches</b><span class="sub">' + F.taches.length + ' tâches · prochaine le ' + dateFr(F.taches[0].echeance) + '</span></div><button class="pil" type="button" data-stub="Tâches non dessinées.">Ajouter une tâche</button></div>' +
    '<div class="cs act"><span class="ico" data-ico="send"></span><div><b>Choisir quoi lui transmettre</b><span class="sub">Documents et catalogues</span></div><button class="pil plein" type="button" data-stub="Transmission non dessinée.">Choisir</button></div></div>' +
    '<h2 class="titre-s">' + T('Vos chiffres', 'Ses chiffres') + '</h2>' +
    '<div class="gdeux">' + (pv ? '' : carteS('Place dans mon secteur', '<p class="note">Parmi les ' + autres.length + ' clientes de la liste, par chiffre d’affaires de janv. à oct. 2026 · ' + (F.rang.france ? F.rang.france + (F.rang.france === 1 ? 're' : 'e') + ' sur ' + nf.format(F.rang.surFrance) + ' officines actives en France' : 'aucune vente') + '</p><div class="rangs">' + classement + '</div>', 'var(--c-ca)', 'c-rangs').replace('<section class="cs c-rangs"', '<section data-interne class="cs c-rangs"')) +
    carteS(T('Vos achats par catégorie', 'Ses achats par catégorie'), '<p class="note">' + F.periode + (pv ? '' : ' · repère gris : la moyenne de nos clients') + '</p>' + barresH(F.categories.map(function (c, i) { return [c.nom, c.montant, c.montant ? nf.format(Math.round(c.montant / F.ca * 100)) + ' % du total' : '', pv ? null : c.moyenneClients, 'var(--cat-' + (i + 1) + ')']; }), 'var(--cat-1)', eur), 'var(--cat-2)', '', 'f-cat') + '</div>' +
    '<div class="gdeux">' + carteS('Top 10 · famille de produits', '<div class="troncons">' + F.top10.map(function (p, i) { return '<div class="tr"><span class="tr-nom"><b>' + (i + 1) + '. ' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></span><span class="num tr-v">' + eur(p.montant) + ' · ' + nf.format(p.quantite) + ' boîtes</span></div>'; }).join('') + '</div>', 'var(--cat-3)', '') +
    carteS(F.nePlusCommande.length + ' produits ne sont plus commandés', '<p class="note">' + T('Commandés au moins 4 mois sur 5, absents du dernier mois', 'Commandés au moins 4 mois sur les 5 précédents, absents du dernier mois') + '</p><div class="troncons">' + F.nePlusCommande.map(function (p) { var k = new Date(p.derniereCommande).getMonth(), cases = ''; for (var i = 0; i < 10; i++) cases += '<i class="' + (i <= k && i > k - 5 ? 'plein' : '') + '"></i>'; return '<div class="tr"><span class="tr-nom"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">dernière commande le ' + dateFr(p.derniereCommande) + '</span></span><span class="frise" aria-label="Mois commandés">' + cases + '</span></div>'; }).join('') + '</div>', 'var(--e-alerte)', '') + '</div>' +
    '<div class="gdeux">' + (pv ? '' : carteS('Ce que cette officine nous rapporte', '<p class="note">Notre marge cumulée, janv.–oct. 2026 : <b class="num">' + eur(F.margeNous) + '</b> · moyenne de nos clients sur la même durée : <b class="num">' + eur(MOY.margeNousMois * 10) + '</b></p>' + barresH(fam.map(function (f) { return [f.nom, F.margeNous * f.part / 100, nf1.format(f.part) + ' % de notre marge']; }), 'var(--c-nous)', eur) + '<p class="note">Génériques comptés à zéro.</p>', 'var(--c-nous)', '').replace('<section class="cs "', '<section data-interne class="cs "')) +
    carteS(T('Vos ventes mois par mois', 'Ses ventes mois par mois'), '<details class="tab"><summary>Voir le tableau</summary><table class="tbl"><thead><tr><th>Mois</th><th>Chiffre d’affaires net hors taxes</th><th>Évolution</th></tr></thead><tbody>' + cm.map(function (v, i) { var p = i ? cm[i - 1] : 0; return '<tr><td>' + ml(mois[i]) + '</td><td class="num">' + eur(v) + '</td><td class="num">' + (i && p ? signe((v - p) / p * 100) : '—') + '</td></tr>'; }).join('') + '<tr class="cum"><td>Cumul janv.–oct. 2026</td><td class="num">' + eur(F.ca) + '</td><td></td></tr></tbody></table></details><p class="note">Net : au prix facturé par Intégral, hors taxes, avoirs déduits.</p>', 'var(--c-ca)', '') + '</div>' +
    '<div class="gdeux">' + carteS('Coordonnées', '<div class="coords">' + lignesCoord(F) + '</div>' + (I.aSavoir ? '<div class="savoir" data-interne><span class="co-l">À savoir</span><p>' + esc(I.aSavoir) + '</p></div>' : ''), 'var(--c-cmd)', '') +
    '<section class="cs" data-interne><header class="cs-t">' + bouclier('var(--c-nous)') + '<h2>Rendez-vous, notes et tâches</h2></header>' +
    '<div class="rdv"><span class="co-l">Prochain rendez-vous</span><b class="num">' + dateFr(F.prochainRendezVous.date) + ' à ' + F.prochainRendezVous.heure.replace(':', ' h ') + '</b><span class="sub">' + esc(F.prochainRendezVous.lieu) + ' · ' + esc(F.prochainRendezVous.objet) + '</span></div>' +
    '<h3>Notes de l’équipe</h3>' + F.notes.map(function (x) { return '<p class="nt"><span class="co-l">' + dateFr(x.date) + '</span> ' + esc(x.texte) + '</p>'; }).join('') +
    '<h3>Tâches</h3>' + F.taches.map(function (t) { return '<p class="nt"><span class="ico">' + icoSvg(t.fait ? 'check' : 'list', t.fait ? 'var(--e-bien)' : 'var(--e-neutre)') + '</span> ' + esc(t.texte) + ' · ' + dateFr(t.echeance) + '</p>'; }).join('') + '</section></div>';
  poseIcones(el);
  /* courbe de comparaison */
  var best2 = ml(mois[best]), pct = prev ? Math.round((last - prev) / prev * 100) : 0, PM = P.moyenneIntegral;
  var moyCa = [], moyMg = [];
  for (var i = 0; i < 10; i++) { moyCa.push(PM[i + 2].caCl); moyMg.push(PM[i + 2].mgCl); }
  var cfg, titre, sous;
  if (S.serie === 'ca') {
    titre = maj(ml(mois[n - 1])) + (pct < 0 ? ' recule de ' : ' progresse de ') + Math.abs(pct) + ' % sur ' + ml(mois[n - 2]) + (best === n - 2 && pct < 0 ? ', après son record' : '');
    sous = T('Votre chiffre d’affaires net hors taxes par mois', 'Chiffre d’affaires net hors taxes par mois') + ', ' + F.periode + '. Record : ' + best2 + ' (' + eur(cm[best]) + ')' + (pv ? '.' : ' · ×' + nf1.format(ratio) + ' la moyenne de nos clients.');
    cfg = { labels: mois, labelsLong: mois.map(function (m) { return ml(m) + ' 2026'; }), a: cm, b: pv ? null : moyCa, aCol: 'var(--c-ca)', aVoile: 'var(--c-ca-voile)', aNom: T('Votre chiffre d’affaires', 'Cette officine'), bNom: 'Moyenne de nos clients', fmt: eur, sous: mois.map(ml), aria: 'Chiffre d’affaires par mois face à la moyenne de nos clients' };
  } else {
    var ph = F.margePharmacienParMois, nu = F.margeNousParMois;
    titre = pv ? 'Votre marge : ' + eur(ph[n - 1]) + ' en ' + ml(mois[n - 1]) : 'Le pharmacien garde ' + eur(ph[n - 1]) + ', nous ' + eur(nu[n - 1]) + ' en ' + ml(mois[n - 1]);
    sous = 'Même unité (euros par mois), ' + F.periode + (pv ? '.' : '. Notre marge : estimation, génériques comptés à zéro.');
    cfg = { labels: mois, labelsLong: mois.map(function (m) { return ml(m) + ' 2026'; }), a: ph, b: pv ? null : nu, aCol: 'var(--c-pharma)', aVoile: 'var(--c-pharma-voile)', bCol: 'var(--c-nous)', aNom: T('Votre marge', 'Marge du pharmacien'), bNom: 'Notre marge Intégral', fmt: eur, sous: mois.map(ml), aria: 'Marges par mois' };
  }
  $('#f-titre-c', el).textContent = titre; $('#f-sous-c', el).textContent = sous;
  monter($('#f-courbe', el), courbe(cfg));
  /* repères : grille 2×2 de badges dentés (« Projections ») */
  var rep = [];
  if (!pv) rep.push([ICO_R.rang, 'var(--c-ca)', F.rang.france ? F.rang.france + (F.rang.france === 1 ? 're' : 'e') : '—', 'sur ' + nf.format(F.rang.surFrance) + ' clientes actives', 'rang']);
  if (!pv) rep.push([ICO_R.fois, 'var(--c-ca)', '×' + nf1.format(ratio), 'la moyenne de nos clients, par mois', 'fois']);
  rep.push([ICO_R.prod, 'var(--c-cmd)', nf.format(F.produitsDifferentsAchetes), 'produits différents achetés', 'prod']);
  rep.push([ICO_R.prop, 'var(--c-ca)', String(o.score), T('sur 100 · à vous proposer', 'sur 100 · à lui proposer'), 'prop']);
  $('#f-rep', el).innerHTML = rep.map(function (r) { return '<div class="rep-c">' + badge(r[1], r[0]) + '<b class="num">' + esc(r[2]) + '</b><span>' + esc(r[3]) + '</span></div>'; }).join('');
  compter($('#f-ca', el), F.ca, function (v) { return gros(eur(v)); });
  $$('[data-vue]', el).forEach(function (b) { b.onclick = function () { S.vue = b.getAttribute('data-vue'); document.body.setAttribute('data-vue-courante', S.vue); renderFiche(); }; });
  $$('[data-serie]', el).forEach(function (b) { b.onclick = function () { S.serie = b.getAttribute('data-serie'); renderFiche(); }; });
  $('[data-action="retour"]', el).onclick = function () { location.hash = '#liste'; };
  $('#f-autre', el).onchange = function (e) { if (e.target.value) { S.off = e.target.value; renderFiche(); window.scrollTo(0, 0); } };
}
var ICO_R = { rang: 'chart', fois: 'haut', prod: 'box', prop: 'check' };
/* ---------- Partie 4 : Pilotage (cartes de la vitrine Strava : Comparaison des progrès, Projections, Leaderboard) ---------- */
var PL = P.moisLibelles, PLL = P.moisLibellesLongs;
function moisDe(sect) { if (sect === 'tous') return P.reseau.mois; for (var i = 0; i < P.secteurs.length; i++) if (P.secteurs[i].id === sect) return P.secteurs[i].mois; return P.reseau.mois; }
function plage() { if (S.per === 'dernier') return [11, 11]; if (S.per === '3') return [9, 11]; if (S.per === 'annee') return [2, 11]; return [Math.min(S.du, S.au), Math.max(S.du, S.au)]; }
function plagePrec(r) { var n = r[1] - r[0] + 1, a = r[0] - n; return a < 0 ? null : [a, r[0] - 1]; }
function somme(ms, r, k) { var s = 0; for (var i = r[0]; i <= r[1]; i++) s += (typeof k === 'function' ? k(ms[i]) : ms[i][k]); return s; }
function moy(ms, r, k) { return somme(ms, r, k) / (r[1] - r[0] + 1); }
var MES = {
  ca: { nom: 'Chiffre d’affaires', ico: 'euro', col: 'var(--c-ca)', voile: 'var(--c-ca-voile)', f: function (ms, r) { return somme(ms, r, 'ca'); }, s: function (m) { return m.ca; }, fmt: eurM },
  nous: { nom: 'Notre marge', ico: 'chart', col: 'var(--c-nous)', voile: 'var(--c-nous-voile)', f: function (ms, r) { return somme(ms, r, 'margeNous'); }, s: function (m) { return m.margeNous; }, fmt: eur },
  phar: { nom: 'Marge pharmacien générée', ico: 'officines', col: 'var(--c-pharma)', voile: 'var(--c-pharma-voile)', f: function (ms, r) { return somme(ms, r, 'margePharmacien'); }, s: function (m) { return m.margePharmacien; }, fmt: eur },
  act: { nom: 'Officines actives', ico: 'user', col: 'var(--c-cmd)', voile: 'var(--c-cmd-voile)', f: function (ms, r) { return Math.round(moy(ms, r, 'officinesActives')); }, s: function (m) { return m.officinesActives; }, fmt: function (v) { return nf.format(v); } },
  panier: { nom: 'Panier moyen', ico: 'box', col: 'var(--c-ca)', voile: 'var(--c-ca-voile)', f: function (ms, r) { return somme(ms, r, 'ca') / Math.max(1, somme(ms, r, 'officinesActives')); }, s: function (m) { return m.ca / Math.max(1, m.officinesActives); }, fmt: eur }
};
function libPeriode(r) { if (S.per === 'dernier') return 'octobre 2026'; if (r[0] === r[1]) return PLL[r[0]].toLowerCase(); return PL[r[0]] + ' → ' + PL[r[1]]; }
function nomMoisAvant() { return S.per === 'dernier' ? 'septembre' : 'la période d’avant'; }
function evoHtml(v, w, avant, neutre) {
  if (w == null || !w) return '<span class="evo">Pas de comparaison possible</span>';
  var p = (v - w) / w * 100;
  if (Math.abs(p) < .5) return '<span class="evo">égal à ' + avant + '</span>';
  return '<span class="evo"><span class="ico">' + icoSvg(neutre ? 'chev' : p < 0 ? 'bas' : 'haut', neutre ? 'var(--e-neutre)' : p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span><b>' + signe(p) + '</b> qu’en ' + avant + '</span>';
}
var PAR = [
  { k: 'ca', nom: 'Chiffre d’affaires par client', unit: 'par client et par mois', col: 'var(--c-ca)', voile: 'var(--c-ca-voile)', v: function (m) { return m.ca / m.officinesActives; }, g: function (a) { return a.caCl; }, fmt: eur },
  { k: 'nous', nom: 'Notre marge par client', unit: 'par client et par mois', col: 'var(--c-nous)', voile: 'var(--c-nous-voile)', v: function (m) { return m.margeNous / m.officinesActives; }, g: function (a) { return a.mgCl; }, fmt: eur },
  { k: 'liv', nom: 'Livraisons par client', unit: 'par client et par mois', col: 'var(--c-cmd)', voile: 'var(--c-cmd-voile)', neutre: true, v: function (m) { return m.livraisons / m.officinesActives; }, g: function (a) { return a.livraisons; }, fmt: function (v) { return nf1.format(v) + ' par mois'; } },
  { k: 'mpl', nom: 'Marge par livraison', unit: 'par livraison', col: 'var(--c-nous)', voile: 'var(--c-nous-voile)', v: function (m) { return m.margeNous / m.livraisons; }, g: function (a) { return a.margeParLivraison; }, fmt: eur },
  { k: 'apl', nom: 'Marge après livraisons', unit: 'par client et par mois', col: 'var(--c-pharma)', voile: 'var(--c-pharma-voile)', v: function (m) { return (m.margeNous - m.livraisons * P.reseau.coutLivraison) / m.officinesActives; }, g: function (a) { return a.margeApresLivraison; }, fmt: eur }
];
function optMois(sel) { var s = ''; for (var i = 12; i >= 0; i--) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + PLL[i] + (i === 12 ? ' (incomplet)' : '') + '</option>'; return s; }
function subMes(k, v, ca) {
  if (k === 'nous') return nf2.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'phar') return nf1.format(v / ca * 100) + ' % du chiffre d’affaires';
  if (k === 'act') return 'au moins une commande · ' + Math.round(v / (S.sect === 'tous' ? P.reseau.nbOfficines : Math.round(P.reseau.nbOfficines / 8)) * 100) + ' % des officines';
  return 'par officine active';
}
function rangsHtml(lignes) { /* lignes : [nom, sous, valeur] ; la 1re porte la couronne (Leaderboard) */
  return '<div class="rangs">' + lignes.map(function (l, i) { return '<div class="rg"><span class="rg-n num">' + (i + 1) + '</span><span class="rg-av" aria-hidden="true">' + ini(l[0].toUpperCase().indexOf('PHARMACIE') === 0 ? l[0] : 'Pharmacie ' + l[0]) + '</span><span class="rg-nom"><b>' + esc(l[0]) + '</b><span class="sub">' + esc(l[1]) + '</span></span><span class="rg-v num">' + esc(l[2]) + '</span>' + (i === 0 ? couronne() : '') + '</div>'; }).join('') + '</div>';
}
function renderPilotage() {
  var el = $('#ecran-pilotage'), ms = moisDe(S.sect), r = plage(), pr = plagePrec(r), n = r[1] - r[0] + 1;
  var nomSect = S.sect === 'tous' ? 'Tous les secteurs' : (P.secteurs.filter(function (s) { return s.id === S.sect; })[0] || {}).nom;
  var ca = MES.ca.f(ms, r), caP = pr ? MES.ca.f(ms, pr) : null, lp = libPeriode(r), av = nomMoisAvant();
  var pc = caP ? Math.round((ca - caP) / caP * 100) : null;
  var titreHero = pc == null ? 'Le chiffre d’affaires de ' + lp : (S.per === 'dernier' ? 'Octobre ' + (pc < 0 ? 'recule de ' : 'progresse de ') + Math.abs(pc) + ' % sur ' + av : 'Le chiffre d’affaires ' + (pc < 0 ? 'recule de ' : 'progresse de ') + Math.abs(pc) + ' % sur ' + av);
  var lede = (S.sect === 'tous' ? 'Le réseau Intégral' : 'Le secteur de ' + esc(nomSect)) + ' a fait ' + eurM(ca) + ' de ventes en ' + esc(lp) + (pc == null ? '.' : ', ' + Math.abs(pc) + ' % de ' + (pc < 0 ? 'moins' : 'plus') + ' qu’en ' + av + '.');
  el.innerHTML =
    '<div class="tete"><div><p class="eyebrow">' + (S.sect === 'tous' ? 'Tous les secteurs' : 'Secteur de ' + esc(nomSect)) + ' · ' + esc(lp) + '</p><h1 class="titre">Pilotage</h1></div></div>' +
    '<div class="chips"><label class="chip">Secteur<select id="p-sect" aria-label="Secteur regardé"><option value="tous">Tous les secteurs</option>' + P.secteurs.map(function (s) { return '<option value="' + s.id + '"' + (S.sect === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select><span class="ico" data-ico="chevb"></span></label>' +
    '<div class="seg" role="group" aria-label="Période">' + [['dernier', 'Dernier mois'], ['3', '3 mois'], ['annee', 'Année'], ['choisir', 'Choisir']].map(function (b) { return '<button type="button" data-periode="' + b[0] + '" aria-pressed="' + (S.per === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
    (S.per === 'choisir' ? '<label class="chip">Du<select id="p-du" aria-label="Du">' + optMois(S.du) + '</select></label><label class="chip">au<select id="p-au" aria-label="au">' + optMois(S.au) + '</select></label>' : '') + '</div>' +
    '<p class="note alerte-n"><span class="ico">' + icoSvg('bell', 'var(--e-attention)') + '</span>' + esc(P.noteMoisIncomplet) + '</p>' +
    '<section class="cs c-hero"><header class="cs-t">' + bouclier('var(--c-ca)') + '<h2>' + esc(titreHero) + '</h2></header>' +
    '<div class="hero-nb"><div><span class="co-l"><i class="puce" style="background:var(--c-ca)"></i>Chiffre d’affaires · ' + esc(lp) + '</span><b class="grand num" id="p-ca">' + gros(eurM(ca)) + '</b></div><p class="lede">' + lede + '</p></div>' +
    '<p class="note">Net hors taxes, ce que les officines ont acheté · les mois de la période ont un point plein' + (pr ? ', le trait gris est la période d’avant' : '') + '</p><div id="p-courbe"></div></section>' +
    '<div class="g-pil"><section class="cs c-mes"><header class="cs-t">' + bouclier('var(--c-pharma)') + '<h2>Les mesures de ' + esc(lp) + '</h2></header><div class="grille22" id="p-mes"></div></section>' +
    '<section class="cs mol"><header class="cs-t">' + bouclier('var(--c-cmd)') + '<h2>Molécules vendues</h2></header><b class="grand num">' + nf.format(Math.round(moy(ms, r, function (m) { return m.molecules.total; }))) + '<small>molécules</small></b><p class="note">Différentes, vendues en ' + esc(lp) + ' · dont ' + nf.format(Math.round(moy(ms, r, function (m) { return m.molecules.cheres; }))) + ' chères (468 € et plus)</p>' + (S.sect === 'tous' ? '' : comparMol(ms, r)) + '</section></div>' +
    '<h2 class="titre-s">Par client, face à la Moyenne Intégral</h2><div class="g-par" id="p-par"></div>' +
    '<div class="detail-b"><button type="button" class="pil plein" data-action="detail">' + (S.detail ? 'Masquer le détail' : 'Voir tout le détail') + '</button><span class="note">Classement des commerciaux, répartitions, produits, groupements, pharmacies à relancer…</span></div>' +
    '<div id="p-detail" ' + (S.detail ? '' : 'hidden') + '></div>';
  poseIcones(el);
  /* courbe : 13 mois, période en points pleins, période d'avant en gris */
  var a = ms.map(function (m) { return m.ca; }), b = null;
  if (pr) { b = a.map(function (v, i) { var j = i - n; return j >= 0 ? a[j] : null; }); }
  var sel = r;
  monter($('#p-courbe', el), courbe({ labels: PL.map(function (l) { return l.split(' ')[0]; }), labelsLong: PLL, a: a, b: b, aCol: 'var(--c-ca)', aVoile: 'var(--c-ca-voile)', aNom: 'Ventes du mois', bNom: 'Période d’avant', fmt: eurM, dans: sel, incompl: [12], actif: r[1], sous: PL.map(function (l, i) { return i === 12 ? 'mois incomplet' : l; }), aria: 'Chiffre d’affaires des 13 derniers mois', h: 250, w: 1120 }));
  compter($('#p-ca', el), ca, function (v) { return gros(eurM(v)); });
  $('#p-mes', el).innerHTML = ['nous', 'phar', 'act', 'panier'].map(function (k) {
    var d = MES[k], v = d.f(ms, r), w = pr ? d.f(ms, pr) : null;
    return '<button type="button" class="rep-c mes" data-mes="' + k + '">' + badge(d.col, d.ico) + '<b class="num">' + gros(d.fmt(v)) + '</b><span class="mes-n">' + d.nom + '</span><span class="st-s">' + esc(subMes(k, v, ca)) + '</span>' + evoHtml(v, w, av) + '</button>'; }).join('');
  remplirPar(ms, r);
  $$('[data-periode]', el).forEach(function (bt) { bt.onclick = function () { S.per = bt.getAttribute('data-periode'); renderPilotage(); }; });
  $('#p-sect', el).onchange = function (e) { S.sect = e.target.value; renderPilotage(); };
  if ($('#p-du', el)) { $('#p-du', el).onchange = function (e) { S.du = +e.target.value; renderPilotage(); }; $('#p-au', el).onchange = function (e) { S.au = +e.target.value; renderPilotage(); }; }
  $$('[data-mes]', el).forEach(function (bt) { bt.onclick = function () { ouvrirFeuille(bt.getAttribute('data-mes')); }; });
  $('[data-action="detail"]', el).onclick = function () { S.detail = !S.detail; location.hash = S.detail ? '#pilotage-detail' : '#pilotage'; };
  if (S.detail) remplirDetail(ms, r);
}
function comparMol(ms, r) {
  var tot = moy(ms, r, function (m) { return m.molecules.total; }), ref = moy(P.reseau.mois, r, function (m) { return m.molecules.total; }) / 8;
  return '<span class="evo"><span class="ico">' + icoSvg(tot >= ref ? 'haut' : 'bas', tot >= ref ? 'var(--e-bien)' : 'var(--e-alerte)') + '</span>' + nf1.format(tot / ref) + ' fois la moyenne Intégral</span>';
}
function valPar(d, ms, r) { var s = 0, k = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.v(ms[i], i); k++; } return s / k; }
function valMoy(d, r) { var s = 0, k = 0; for (var i = r[0]; i <= r[1]; i++) { s += d.g(P.moyenneIntegral[i]); k++; } return s / k; }
function remplirPar(ms, r) {
  var box = $('#p-par');
  box.innerHTML = PAR.map(function (d) { return '<section class="cs par" id="par-' + d.k + '"><header class="cs-t">' + bouclier(d.col) + '<h2>' + d.nom + '</h2></header><p class="note">' + d.unit + ' · ' + esc(libPeriode(r)) + '</p><div class="par-c"></div><p class="par-e"></p></section>'; }).join('');
  PAR.forEach(function (d) {
    var m = valMoy(d, r), v = S.sect === 'tous' ? null : valPar(d, ms, r), e = v == null ? null : ((v - m) / m * 100);
    var sB = P.moyenneIntegral.map(d.g), sA = ms.map(function (x, i) { return d.v(x, i); });
    var c = courbe({ labels: PL.map(function (l) { return l.split(' ')[0]; }), labelsLong: PLL, a: v == null ? sB : sA, b: v == null ? null : sB, aCol: d.col, aVoile: d.voile, aNom: v == null ? 'Moyenne Intégral' : 'Ce secteur', bNom: 'Moyenne Intégral', fmt: d.fmt, h: 150, sansMois: true, actif: r[1], sous: PL, aria: d.nom + ' sur 13 mois' });
    monter($('.par-c', $('#par-' + d.k)), c);
    $('.par-e', $('#par-' + d.k)).innerHTML = v == null ? '' : '<span class="evo"><span class="ico">' + icoSvg(d.neutre ? 'chev' : e < 0 ? 'bas' : 'haut', d.neutre ? 'var(--e-neutre)' : e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span><b>' + signe(e) + '</b> face à la Moyenne Intégral (' + d.fmt(m) + ')</span>';
  });
}
/* feuille latérale : naît de la mesure touchée */
function panneau(titre, html) {
  var p = $('#panneau');
  if (!p) { p = document.createElement('aside'); p.id = 'panneau'; p.className = 'panneau'; p.setAttribute('data-panneau', ''); p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'false'); document.body.appendChild(p); }
  p.innerHTML = '<div class="pn-t"><h2>' + esc(titre) + '</h2><button type="button" class="pil" data-fermer aria-label="Fermer"><span class="ico" data-ico="close"></span>Fermer</button></div><div class="pn-c">' + html + '</div>';
  poseIcones(p); p.hidden = false;
  $('[data-fermer]', p).onclick = function () { p.hidden = true; };
  return p;
}
function ouvrirFeuille(k) {
  var d = MES[k], ms = moisDe(S.sect), r = plage(), v = d.f(ms, r), pr = plagePrec(r), w = pr ? d.f(ms, pr) : null;
  var p = panneau(d.nom, '<b class="grand num">' + gros(d.fmt(v)) + '</b><p class="note">' + esc(libPeriode(r)) + '</p>' + evoHtml(v, w, nomMoisAvant()) + '<div id="fe-h"></div>');
  monter($('#fe-h', p), courbe({ labels: PL.map(function (l) { return l.split(' ')[0]; }), labelsLong: PLL, a: ms.map(d.s), aCol: d.col, aVoile: d.voile, aNom: d.nom, fmt: d.fmt, h: 200, dans: r, incompl: [12], actif: r[1], sous: PL, aria: d.nom + ' sur 13 mois' }));
}
function remplirDetail(ms, r) {
  var box = $('#p-detail'), top = S.per === 'dernier' ? P.top10Officines.dernierMois : S.per === '3' ? P.top10Officines.troisMois : P.top10Officines.annee;
  var cl = P.secteurs.map(function (s) { return [s.nom, 'Chiffre d’affaires ' + eurM(somme(s.mois, r, 'ca')), somme(s.mois, r, 'margeNous')]; }).sort(function (a, b) { return b[2] - a[2]; });
  var fam = {}, tot = 0, src = S.sect === 'tous' ? P.secteurs : P.secteurs.filter(function (s) { return s.id === S.sect; });
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm || !mm.margeParFamille) continue; mm.margeParFamille.forEach(function (f) { fam[f.nom] = (fam[f.nom] || 0) + Math.max(0, f.euros); tot += Math.max(0, f.euros); }); } });
  var famL = Object.keys(fam).map(function (nm) { return [nm, fam[nm] / (tot || 1) * 100]; });
  var rep = {}, repT = {}, tF = 0, tT = 0;
  src.forEach(function (s) { for (var i = r[0]; i <= r[1]; i++) { var mm = s.mois[i]; if (!mm) continue; (mm.repartitionFamille || []).forEach(function (f) { rep[f.nom] = (rep[f.nom] || 0) + f.euros; tF += f.euros; }); (mm.repartitionTranche || []).forEach(function (f) { repT[f.nom] = (repT[f.nom] || 0) + f.euros; tT += f.euros; }); } });
  var pc = function (v) { return nf1.format(v) + ' %'; };
  box.innerHTML = '<div class="stack">' +
    '<div class="gdeux">' + carteS('Classement des commerciaux par notre marge · ' + esc(libPeriode(r)), rangsHtml(cl.map(function (c) { return [c[0], c[1], eur(c[2])]; })), 'var(--c-nous)') +
    carteS('Notre marge, famille par famille', '<p class="note">Part de la période · génériques comptés à zéro</p>' + barresH(famL, 'var(--c-nous)', pc), 'var(--c-nous)') + '</div>' +
    '<div class="gdeux">' + carteS('Répartition du chiffre d’affaires par famille', barresH(Object.keys(rep).map(function (nm) { return [nm, rep[nm] / tF * 100]; }), 'var(--c-ca)', pc), 'var(--c-ca)') +
    carteS('Répartition par tranche de prix', barresH(Object.keys(repT).map(function (nm) { return [nm, repT[nm] / tT * 100]; }), 'var(--c-ca)', pc), 'var(--c-ca)') + '</div>' +
    '<div class="gdeux">' + carteS('Top 10 des officines · ' + esc(libPeriode(r)), rangsHtml(top.map(function (o) { return [joli(o.nom), o.ville + ' · marge du pharmacien ' + eur(o.margePharmacien) + ' · notre marge ' + eur(o.margeNous), eur(o.ca)]; })), 'var(--c-ca)') +
    carteS('Chiffre d’affaires et marge par groupement · ' + P.groupementsPeriode, barresH(P.groupements.map(function (g) { return [g.nom, g.ca, g.officines + ' officines · marge du pharmacien ' + eur(g.margePharmacien)]; }), 'var(--c-ca)', eurM), 'var(--c-ca)') + '</div>' +
    carteS('Le gisement · ' + P.gisement.officines + ' officines', '<p class="note">Ce que la France achète et que vos officines n’ont pas commandé, uniquement ce qu’Intégral a en stock. Classé par euros.</p><div class="jauge"><div class="jauge-b"><i style="width:' + P.gisement.couverture.part + '%"></i></div><span class="num">' + P.gisement.couverture.part + ' % · ' + nf.format(P.gisement.couverture.produitsCommandes) + ' sur ' + nf.format(P.gisement.couverture.produitsMarche) + ' produits du marché commandés au moins une fois</span></div>' +
      barresH(P.gisement.lignes.map(function (g) { return [g.rang + '. ' + g.nom.split(',')[0], g.potentielParAn, g.officinesNeLePrennentPas + ' officines sur ' + g.surOfficines + ' ne le prennent pas · ' + eur(g.prixNetBoite) + ' la boîte']; }), 'var(--c-ca)', function (v) { return eurM(v) + ' par an'; }), 'var(--c-ca)') +
    carteS('Pharmacies en baisse, à relancer', '<p class="note">3 derniers mois contre les 3 précédents · ' + esc(P.pharmaciesEnBaisse.regle) + '</p><div class="troncons">' + P.pharmaciesEnBaisse.lignes.map(function (o) { return '<div class="tr"><span class="tr-nom"><b>' + o.rang + '. ' + esc(joli(o.nom.replace(/^PHARMACIE\s+/, ''))) + '</b><span class="sub">' + esc(o.ville) + '</span></span><span class="num tr-v"><span class="ico">' + icoSvg('bas', 'var(--e-alerte)') + '</span>' + eur(o.baisseParMois) + ' par mois · −' + Math.abs(o.pourcent) + ' %</span></div>'; }).join('') + '</div>', 'var(--e-alerte)') +
    '<p class="note">Offilog et « Mes produits » : blocs non dessinés dans cette maquette (aucune donnée fictive prévue). Données fictives.</p></div>';
  poseIcones(box);
}
/* ---------- Partie 5 : Carte du secteur (page /maps de Strava : plein cadre, pastilles-menus, boutons ronds) ---------- */
var MOBILE = function () { return window.innerWidth <= 760; };
function teinteCA(ca) { var t = Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); var a = [174, 196, 240], b = [26, 66, 160]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }).join(',') + ')'; }
function tCA(ca) { return Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); }
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
var carteRendue = false, POS = null, VUE = { cx: 0, cy: 0, s: 1, s0: 1 }, DEPL = false, LIBRE = null;
function mesurer() { var z = $('#c-zone'), r = z.getBoundingClientRect(); return { w: Math.max(300, r.width), h: Math.max(300, r.height) }; }
function librePx(w, h) { /* rectangle de la carte laissé libre par les commandes flottantes : aucun point ne s'y trouve sous une commande */
  if (MOBILE()) return { x0: 14, y0: 136, x1: w - 14, y1: h - 214 };
  return { x0: 92, y0: 92, x1: w - 28, y1: h - 76 };
}
function positions() { /* léger écartement en pixels : le centre d'aucun point n'est caché par un autre */
  if (POS) return POS;
  var s0 = VUE.s0, L = C.points.map(function (p) { return { p: p, x: MX(p.lng) * s0, y: MY(p.lat) * s0, r: rayonPx(p) }; });
  for (var it = 0; it < 70; it++) { var bouge = false;
    for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
      var a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = a.r + b.r + 2.2;
      if (d < m) { var k = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; k = m / 2; } a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; bouge = true; } }
    if (!bouge) break; }
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
  var ech = $('#c-ech'); if (ech) { ech.style.width = Math.round((10 / 111.2) * KM * k) + 'px'; }
  majSel(); dessinerTournee();
}
function ajusterVue() {
  var m = mesurer(), f = librePx(m.w, m.h), fw = f.x1 - f.x0, fh = f.y1 - f.y0;
  VUE.s0 = Math.min(fw / MW, fh / MH); VUE.s = VUE.s0;
  var px = f.x0 + fw / 2, py = f.y0 + fh / 2; /* le centre de la région tombe au centre du rectangle libre */
  VUE.cx = MW / 2 + (m.w / 2 - px) / VUE.s; VUE.cy = MH / 2 + (m.h / 2 - py) / VUE.s;
  VUE.cx0 = VUE.cx; VUE.cy0 = VUE.cy;
}
function renderCarte() {
  var el = $('#ecran-carte'), m0 = MOBILE();
  el.innerHTML =
    '<div class="c-zone" id="c-zone"><svg id="c-svg" class="c-svg" role="img" aria-label="Carte du secteur : ' + C.points.length + ' officines"><defs><radialGradient id="c-mer" cx="30%" cy="12%" r="90%"><stop offset="0" stop-color="#EAF1F6"/><stop offset="1" stop-color="#D3E0EA"/></radialGradient></defs>' +
    '<rect id="c-fond" x="-2000" y="-2000" width="5000" height="5000" fill="url(#c-mer)"/><g id="c-terre">' + fondPaths() + '</g><g id="c-dep"></g><g id="c-tr"></g><g id="c-pts"></g><g id="c-selg"></g><g id="c-vil"></g></svg>' +
    /* haut : recherche + pastilles-menus + bouton principal */
    '<div class="c-haut"><label class="c-rech"><span class="ico" data-ico="search"></span><input id="c-q" type="search" placeholder="Une pharmacie, une ville, un code postal" aria-label="Rechercher sur la carte" value="' + esc(S.cq) + '"></label>' +
    '<div class="c-chips"><div class="seg seg-c" role="group" aria-label="Afficher"><button type="button" data-filtre="tout" aria-pressed="true">Tout</button><button type="button" data-filtre="clients" aria-pressed="false">Clients</button><button type="button" data-filtre="prospects" aria-pressed="false">Prospects</button></div>' +
    '<button type="button" class="chip chip-b c-bfiltres" id="c-bf" aria-expanded="false"><span class="ico" data-ico="filtre"></span>Filtres<span class="ico" data-ico="chevb"></span></button>' +
    '<span class="c-sec" id="c-sec"><label class="chip">Commercial<select id="c-com" aria-label="Commercial"><option value="">Tous</option>' + C.commerciaux.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><span class="ico" data-ico="chevb"></span></label>' +
    '<label class="chip">Groupement<select id="c-grp" aria-label="Groupement"><option value="">Tous</option>' + C.groupements.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><span class="ico" data-ico="chevb"></span></label></span></div>' +
    '</div><div class="c-act"><b class="cpt-pil num" id="c-cpt"></b><button class="pil" type="button" data-act="liste"><span class="ico" data-ico="list"></span>Liste</button><button class="pil" type="button" data-stub="Exportation non dessinée dans cette maquette."><span class="ico" data-ico="down"></span>Excel</button><button class="pil plein" type="button" data-act="tournee"><span class="ico" data-ico="route"></span>Ma tournée <b class="cpt7" id="c-nt">0</b></button></div>' +
    /* gauche : boutons ronds */
    '<div class="c-ronds"><button type="button" class="rond" data-z="+" aria-label="Zoom avant"><span class="ico" data-ico="plus"></span></button><button type="button" class="rond" data-z="-" aria-label="Zoom arrière"><span class="ico" data-ico="minus"></span></button><button type="button" class="rond" data-z="pos" aria-label="Recentrer sur mon secteur"><span class="ico" data-ico="locate"></span></button><button type="button" class="rond" data-z="nord" aria-label="Réinitialiser la vue"><span class="ico" data-ico="boussole"></span></button></div>' +
    '<div class="c-bas"><button type="button" class="rond" data-act="couche" aria-label="Changer la couleur des points" aria-pressed="false"><span class="ico" data-ico="layers"></span></button><button type="button" class="rond rond-t" data-act="zones" aria-pressed="false" aria-label="Afficher les départements">Zones</button><span class="ech"><i id="c-ech"></i><em>10 km</em></span></div>' +
    '<div class="c-leg" id="c-leg"></div><div id="c-volet-zone"></div></div>' +
    '<p class="note c-note">Fond de carte local, sans service extérieur. ' + C.noteSegments + ' Treize officines de la liste sont hors des six départements et n’apparaissent pas ici. Données fictives.</p>';
  poseIcones(el); carteRendue = true;
  construirePoints();
  var z = $('#c-zone');
  $('#c-pts').addEventListener('click', function (ev) { if (DEPL) return; var c = ev.target.closest && ev.target.closest('[data-point]'); if (!c) return; S.volet = c.getAttribute('data-point'); if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; });
  $$('[data-filtre]', el).forEach(function (b) { b.onclick = function () { S.cf = b.getAttribute('data-filtre'); majCarte(); }; });
  $('#c-q', el).oninput = function (e) { S.cq = e.target.value; majCarte(); };
  $('#c-com', el).onchange = function (e) { S.ccom = e.target.value; majCarte(); };
  $('#c-grp', el).onchange = function (e) { S.cgrp = e.target.value; majCarte(); };
  $('#c-bf', el).onclick = function () { var o = $('#c-sec').classList.toggle('ouvert'); this.setAttribute('aria-expanded', String(o)); };
  $('[data-act="liste"]', el).onclick = ouvrirListeCarte;
  $('[data-act="tournee"]', el).onclick = ouvrirTournee;
  $('[data-act="couche"]', el).onclick = function () { S.couche = S.couche === 'ca' ? 'statut' : 'ca'; this.setAttribute('aria-pressed', String(S.couche === 'statut')); recolorer(); };
  $('[data-act="zones"]', el).onclick = function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', String(o)); zones(o); };
  $$('[data-z]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-z'); if (k === '+') VUE.s = Math.min(VUE.s0 * 5, VUE.s * 1.5); else if (k === '-') VUE.s = Math.max(VUE.s0, VUE.s / 1.5); else { VUE.s = VUE.s0; VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } if (VUE.s === VUE.s0) { VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } appliquerVue(); }; });
  /* déplacement à la souris ou au doigt */
  var dep = null;
  z.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.c-haut,.c-ronds,.c-bas,.c-leg,.volet,.c-act')) return; dep = { x: ev.clientX, y: ev.clientY, cx: VUE.cx, cy: VUE.cy, bouge: false }; });
  window.addEventListener('pointermove', function (ev) { if (!dep) return; var dx = ev.clientX - dep.x, dy = ev.clientY - dep.y; if (Math.abs(dx) + Math.abs(dy) > 6) dep.bouge = true; if (dep.bouge && VUE.s > VUE.s0 * 1.02) { DEPL = true; VUE.cx = dep.cx - dx / VUE.s; VUE.cy = dep.cy - dy / VUE.s; appliquerVue(); } });
  window.addEventListener('pointerup', function () { if (dep && dep.bouge) setTimeout(function () { DEPL = false; }, 60); dep = null; });
  z.addEventListener('wheel', function (ev) { if (!ev.ctrlKey && !ev.metaKey && Math.abs(ev.deltaY) < 2) return; ev.preventDefault(); VUE.s = Math.max(VUE.s0, Math.min(VUE.s0 * 5, VUE.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); if (VUE.s === VUE.s0) { VUE.cx = VUE.cx0; VUE.cy = VUE.cy0; } appliquerVue(); }, { passive: false });
  legende(); majCarte();
}
function construirePoints() {
  ajusterVue(); POS = null; var pos = positions();
  var ordre = C.points.slice().sort(function (a, b) { return (estClient(b) ? 1 : 0) - (estClient(a) ? 1 : 0) || b.ca - a.ca; });
  $('#c-pts').innerHTML = ordre.map(function (p) {
    return '<circle data-point="' + p.id + '" data-statut="' + p.statut + '" data-r="' + rayonPx(p).toFixed(1) + '" cx="' + pos[p.id][0].toFixed(2) + '" cy="' + pos[p.id][1].toFixed(2) + '" r="3" fill="' + couleurPoint(p) + '" stroke="#fff" stroke-width="1" tabindex="-1"><title>' + esc(joli(p.nom)) + '</title></circle>';
  }).join('');
  $$('#c-zone .c-ville').forEach(function (e) { e.remove(); });
  window.VILLES_PACA.filter(function (v) { return v.rang <= 2; }).forEach(function (v) { var d = document.createElement('span'); d.className = 'c-ville'; d.setAttribute('data-lng', v.lng); d.setAttribute('data-lat', v.lat); d.textContent = v.nom; $('#c-zone').appendChild(d); });
  var dep = {}; window.FOND_PACA.features.forEach(function (f) { var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, mx = 0, my = 0, k = 0; polys[0][0].forEach(function (c) { mx += c[0]; my += c[1]; k++; }); dep[f.properties.code] = '<text x="' + MX(mx / k).toFixed(1) + '" y="' + MY(my / k).toFixed(1) + '" text-anchor="middle" fill="var(--enc-3)" font-weight="700" letter-spacing=".08em" pointer-events="none">' + esc(f.properties.nom.toUpperCase()) + '</text>'; });
  $('#c-dep').innerHTML = Object.keys(dep).map(function (k) { return dep[k]; }).join(''); $('#c-dep').style.display = 'none';
  appliquerVue();
}
function zones(on) { $('#c-dep').style.display = on ? '' : 'none'; $('#c-terre').classList.toggle('zones', on); }
function recolorer() {
  POS = null; var pos = positions();
  $$('#c-pts [data-point]').forEach(function (c) { var p = pointById(c.getAttribute('data-point')); c.setAttribute('fill', couleurPoint(p)); c.setAttribute('data-r', rayonPx(p).toFixed(1)); c.setAttribute('cx', pos[p.id][0].toFixed(2)); c.setAttribute('cy', pos[p.id][1].toFixed(2)); });
  legende(); appliquerVue(); dessinerTournee();
}
function legende() {
  var dot = function (c, d) { return '<i class="dot" style="width:' + d + 'px;height:' + d + 'px;background:' + c + '"></i>'; };
  $('#c-leg').innerHTML = S.couche === 'ca'
    ? '<b>Chiffre d’affaires</b><span>' + dot(teinteCA(2000), 9) + 'petit</span><span>' + dot(teinteCA(60000), 13) + 'moyen</span><span>' + dot(teinteCA(900000), 18) + 'grand</span><span>' + dot('var(--e-attention)', 10) + 'À rappeler</span><span>' + dot('var(--enc-4)', 9) + 'Prospect</span>'
    : '<b>Statut</b><span>' + dot('var(--c-ca)', 12) + 'Cliente</span><span>' + dot('var(--e-attention)', 12) + 'À rappeler</span><span>' + dot('var(--enc-4)', 10) + 'Prospect</span><span>' + dot('var(--enc-5)', 10) + 'Aucune vente</span>';
}
function majCarte() {
  var n = 0;
  $$('#c-pts [data-point]').forEach(function (c) { var p = pointById(c.getAttribute('data-point')), v = pointVisible(p); c.style.display = v ? '' : 'none'; if (v) n++; });
  $$('[data-filtre]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtre') === S.cf)); });
  $('#c-cpt').textContent = nf.format(n) + ' officines';
  $('#c-nt').textContent = Object.keys(S.tour).filter(function (k) { return S.tour[k]; }).length || C.tournee.arrets.length;
  dessinerTournee();
}
function majSel() {
  var g = $('#c-selg'); if (!g) return;
  var p = S.volet && $('#c-volet-zone .volet') && !$('#c-volet-zone .volet').hidden ? pointById(S.volet) : null;
  if (!p) { g.innerHTML = ''; return; }
  var q = positions()[p.id], k = 1 / (VUE.k || VUE.s);
  g.innerHTML = '<circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (24 * k).toFixed(2) + '" fill="var(--c-ca)" fill-opacity=".14" pointer-events="none"/><circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r="' + (17 * k).toFixed(2) + '" fill="var(--c-ca)" stroke="#fff" stroke-width="' + (3 * k).toFixed(2) + '" pointer-events="none"/>' +
    '<text x="' + q[0].toFixed(2) + '" y="' + (q[1] + 5 * k).toFixed(2) + '" text-anchor="middle" font-size="' + (14 * k).toFixed(2) + '" font-weight="700" fill="#fff" pointer-events="none">' + esc(ini(p.nom)) + '</text>';
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
  panneau('Ma tournée', '<p class="note">' + esc(d.nom) + ' · départ ' + d.depart.replace(':', ' h ') + '</p><div class="grille3"><div><span class="co-l">Arrêts</span><b class="grand num">' + d.arrets.length + '</b></div><div><span class="co-l">Distance</span><b class="grand num">' + d.kmTotal + '<small>km</small></b></div><div><span class="co-l">Fin</span><b class="grand num">' + d.fin.replace(':', ' h ') + '</b></div></div>' +
    '<div class="troncons"><div class="tr"><span class="tr-nom"><b>Départ · ' + esc(d.depot.nom) + '</b><span class="sub">' + esc(d.depot.adresse) + '</span></span><span class="num tr-v">' + d.depart.replace(':', ' h ') + '</span></div>' +
    d.arrets.map(function (a) { var p = pointById(a.id); return '<div class="tr"><span class="tr-nom"><b>' + a.ordre + '. ' + esc(joli(p.nom)) + '</b><span class="sub">' + esc(p.ville) + ' · visite de ' + a.dureeVisite + ' min · ' + a.kmDepuisPrecedent + ' km depuis l’arrêt précédent</span></span><span class="num tr-v">' + a.arrivee.replace(':', ' h ') + '</span></div>'; }).join('') + '</div>' +
    '<a class="pil" href="#carte" data-stub="Itinéraire externe non dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</a>');
}
function ouvrirListeCarte() {
  var l = C.points.filter(pointVisible).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 40);
  var p = panneau('Liste des pharmacies', '<p class="note">' + l.length + ' premières, classées par chiffre d’affaires.</p><div class="troncons">' + l.map(function (q) { return '<button type="button" class="tr tr-b" data-ouvre="' + q.id + '"><span class="tr-nom"><b>' + esc(joli(q.nom)) + '</b><span class="sub">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.groupement) + '</span></span><span class="num tr-v">' + (q.ca ? eur(q.ca) : '—') + '</span></button>'; }).join('') + '</div>');
  $$('[data-ouvre]', p).forEach(function (b) { b.onclick = function () { p.hidden = true; S.volet = b.getAttribute('data-ouvre'); if (location.hash === '#carte-fiche') majVolet(true); else location.hash = '#carte-fiche'; }; });
}
function majVolet(ouvert) {
  var zone = $('#c-volet-zone'); if (!zone) return; var v = $('.volet', zone);
  if (!v) { v = document.createElement('aside'); v.className = 'volet cs'; v.setAttribute('data-volet', ''); v.setAttribute('aria-label', 'Fiche de l’officine'); zone.appendChild(v); }
  if (!ouvert || !S.volet) { v.hidden = true; majSel(); return; }
  var p = pointById(S.volet), cm = p.caParMois || [], ml10 = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
  var ex = offById(p.id);
  v.innerHTML = '<div class="grabber" aria-hidden="true"></div><div class="vo-t"><span class="vo-av" aria-hidden="true">' + esc(ini(p.nom)) + '</span><div><h2>' + esc(joli(p.nom)) + '</h2><p class="note">' + esc(p.titulaire) + ' · ' + esc(p.ville) + ' · ' + p.cp + '</p></div><button type="button" class="rond rond-p" data-fermer-volet aria-label="Fermer la fiche"><span class="ico" data-ico="close"></span></button></div>' +
    '<div class="pastilles"><span class="chip-p">' + (p.statut === 'à rappeler' ? 'À rappeler' : p.statut === 'cliente' ? p.segment : p.statut === 'prospect' ? 'Prospect' : 'Aucune vente') + '</span><span class="chip-p">' + esc(p.commercial) + '</span><span class="chip-p">' + esc(p.groupement) + '</span><span class="chip-p">n° ' + p.id + '</span></div>' +
    (p.ca ? '<div class="trois trois-v"><div><span class="co-l">Chiffre d’affaires (10 mois)</span><b class="num mont">' + gros(eur(p.ca)) + '</b></div><div><span class="co-l">Références</span><b class="num mont">' + nf.format(Math.round(p.ca / 1100)) + '</b></div><div><span class="co-l">Potentiel</span><b class="num mont">' + gros(eur(p.ca * 1.35)) + '</b></div></div>' +
    '<h3>Chiffre d’affaires par mois</h3><div id="vo-c"></div><h3>Produits phares</h3><div class="troncons">' + (p.produits || []).map(function (q) { return '<div class="tr"><span class="tr-nom"><b>' + esc(q.nom.split(',')[0]) + '</b></span><span class="num tr-v">' + eur(q.ca) + '</span></div>'; }).join('') + '</div>' : '<p class="note">Pas encore de ventes réseau pour cette officine.</p>') +
    '<div class="co"><span class="co-l">Téléphone</span><span class="co-v">' + esc(p.telephone) + '</span></div>' +
    (p.suivi ? '<div class="co"><span class="co-l">Dernière visite</span><span class="co-v">' + dateFr(p.suivi.derniereVisite) + '</span></div><div class="co"><span class="co-l">Prochain rendez-vous</span><span class="co-v">' + (p.suivi.prochainRendezVous ? dateFr(p.suivi.prochainRendezVous.date) + ' à ' + p.suivi.prochainRendezVous.heure.replace(':', ' h ') : '—') + '</span></div>' : '') +
    '<div class="actions">' + (ex ? '<button class="pil plein" type="button" data-action="ouvrir-fiche">Ouvrir la fiche complète</button>' : '<button class="pil" type="button" data-stub="Fiche complète non dessinée pour cette officine fictive.">Ouvrir la fiche complète</button>') + '<button class="pil" type="button" data-act="ajout">' + (S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button><button class="pil" type="button" data-stub="Itinéraire externe non dessiné dans cette maquette."><span class="ico" data-ico="route"></span>Itinéraire</button></div>';
  poseIcones(v); v.hidden = false; v.setAttribute('data-cran', '1');
  if (p.ca) monter($('#vo-c', v), courbe({ labels: ml10, labelsLong: ml10.map(ml), a: cm, aCol: 'var(--c-ca)', aVoile: 'var(--c-ca-voile)', aNom: 'Chiffre d’affaires', fmt: eur, h: 120, sansMois: true, sous: ml10, aria: 'Chiffre d’affaires par mois de ' + joli(p.nom) }));
  $('[data-fermer-volet]', v).onclick = function () { S.volet = null; location.hash = '#carte'; };
  $('.grabber', v).onclick = function () { var c = +v.getAttribute('data-cran'); v.setAttribute('data-cran', String(c >= 3 ? 1 : c + 1)); };
  var of = $('[data-action="ouvrir-fiche"]', v); if (of) of.onclick = function () { S.off = p.id; v.hidden = true; location.hash = '#fiche'; };
  $('[data-act="ajout"]', v).onclick = function (e) { S.tour[p.id] = !S.tour[p.id]; e.currentTarget.textContent = S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée'; majCarte(); };
  majSel();
}
/* ---------- routage, signets, démarrage ---------- */
function route() {
  var h = (location.hash || '#liste').slice(1), base = h.split('-')[0];
  if (['liste', 'fiche', 'pilotage', 'carte'].indexOf(base) < 0) { base = 'liste'; h = 'liste'; }
  ['liste', 'fiche', 'pilotage', 'carte'].forEach(function (e) { $('#ecran-' + e).hidden = e !== base; });
  document.body.setAttribute('data-ecran-actif', base);
  $$('[data-nav]').forEach(function (a) { var k = a.getAttribute('data-nav'), on = (k === 'officines' && (base === 'liste' || base === 'fiche')) || k === base; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var pn = $('#panneau'); if (pn) pn.hidden = true;
  if (base !== 'carte') majVolet(false);
  if (base === 'liste') renderListe();
  else if (base === 'fiche') renderFiche();
  else if (base === 'pilotage') { S.detail = h === 'pilotage-detail'; renderPilotage(); }
  else {
    cadrerCarte();
    if (!carteRendue) renderCarte();
    if (h === 'carte-fiche') { if (!S.volet) S.volet = C.points.filter(function (p) { return p.segment === 'Client A'; })[0].id; majVolet(true); } else majVolet(false);
  }
  if (!(base === 'pilotage' && S.detail)) window.scrollTo(0, 0);
  else { var d = $('#p-detail'); var y = d && d.getBoundingClientRect ? d.getBoundingClientRect().top + window.scrollY - 90 : 0; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); }
}
function cadrerCarte() { /* la carte prend tout l'écran sous la barre du haut (et au-dessus de la barre d'onglets du téléphone) */
  var s = $('#ecran-carte'), top = s.getBoundingClientRect().top + window.scrollY, bas = MOBILE() ? 64 : 0, noteH = 44;
  var h = Math.max(520, window.innerHeight - top - bas - noteH);
  s.style.setProperty('--h-carte', h + 'px');
}
function signets() {
  $('#signets').innerHTML = OFF.slice(0, 3).map(function (o) { return '<a href="#fiche" data-signet="' + o.id + '">' + esc(joli(o.nom)) + '<small>' + eur(o.ca) + '</small></a>'; }).join('');
  $$('[data-signet]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); ouvrirFiche(a.getAttribute('data-signet')); }; });
}
document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-stub]'); if (t) { e.preventDefault(); toast(t.getAttribute('data-stub')); } });
$('#rech-globale').addEventListener('input', function (e) { S.q = e.target.value; if (location.hash !== '#liste' && location.hash !== '') location.hash = '#liste'; else if ($('#l-q')) { $('#l-q').value = S.q; remplirLignes(); } });
window.addEventListener('hashchange', route);
poseIcones(document); signets(); route();
})();
