/* m31 — dessins SVG : mini-courbe, anneau, courbe de la fiche (axes légers, moyenne grise étiquetée), colonnes sans axes du Pilotage. */
(function () {
'use strict';
var J = window.J31, esc = J.esc, nf = J.nf;
function lisse(pts) { /* courbe douce qui ne dépasse jamais ses voisins (pas de bosse inventée) */
  var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
    var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    var c1y = Math.max(lo, Math.min(hi, p1[1] + (p2[1] - p0[1]) * t)), c2y = Math.max(lo, Math.min(hi, p2[1] - (p3[1] - p1[1]) * t));
    d += 'C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return d;
}
J.spark = function (vals, moy, w, h, couleur, opts) {
  opts = opts || {};
  if (!vals.length || !vals.every(isFinite)) return '';
  var tous = vals.concat(moy ? [moy] : []), max = Math.max.apply(null, tous), min = Math.min.apply(null, tous), pad = 4;
  if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / Math.max(1, vals.length - 1); };
  var Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); };
  var pts = vals.map(function (v, i) { return [X(i), Y(v)]; }), d = lisse(pts);
  var s = '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(opts.aria || 'Courbe') + '">';
  if (moy) s += '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + Y(moy).toFixed(1) + '" y2="' + Y(moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.2" stroke-dasharray="3 3"/>';
  s += '<path d="' + d + 'L' + X(vals.length - 1).toFixed(1) + ' ' + (h - pad) + 'L' + X(0).toFixed(1) + ' ' + (h - pad) + 'Z" fill="' + couleur + '" fill-opacity=".09"/>';
  s += '<path class="trace" d="' + d + '" fill="none" stroke="' + couleur + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>';
  s += '<circle cx="' + X(vals.length - 1).toFixed(1) + '" cy="' + Y(vals[vals.length - 1]).toFixed(1) + '" r="3.2" fill="#fff" stroke="' + couleur + '" stroke-width="2"/></svg>';
  return s;
};
J.spark2 = function (a, b, w, h, ca) { /* deux courbes en largeur libre : la série en couleur, la Moyenne Intégral en gris pointillé */
  if (!a.every(isFinite) || !b.every(isFinite)) return '';
  var all = a.concat(b), max = Math.max.apply(null, all), min = Math.min.apply(null, all), pad = 5; if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / (a.length - 1); }, Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); };
  var p = function (arr) { return lisse(arr.map(function (v, i) { return [X(i), Y(v)]; })); };
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Évolution sur 13 mois"><path d="' + p(b) + '" fill="none" stroke="var(--c-moyenne)" stroke-width="1.6" stroke-dasharray="4 3"/>' +
    '<path d="' + p(a) + 'L' + X(a.length - 1).toFixed(1) + ' ' + (h - pad) + 'L' + X(0).toFixed(1) + ' ' + (h - pad) + 'Z" fill="' + ca + '" fill-opacity=".09"/>' +
    '<path class="trace" pathLength="1" d="' + p(a) + '" fill="none" stroke="' + ca + '" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="' + X(a.length - 1).toFixed(1) + '" cy="' + Y(a[a.length - 1]).toFixed(1) + '" r="3.4" fill="#fff" stroke="' + ca + '" stroke-width="2"/></svg>';
};
J.anneau = function (score, t) {
  t = t || 34; var r = t / 2 - 4, c = 2 * Math.PI * r, m = t / 2;
  return '<svg class="anneau" viewBox="0 0 ' + t + ' ' + t + '" width="' + t + '" height="' + t + '" aria-hidden="true"><circle cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="var(--enc-5)" stroke-width="4"/><circle class="arc" cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="var(--c-ca)" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (c * score / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + m + ' ' + m + ')"/></svg>';
};
/* Courbe de la fiche : aire douce, axe léger à gauche, Moyenne de nos clients en gris pointillé ÉTIQUETÉE, record et dernier mois étiquetés, 2 séries au plus. */
J.courbe = function (cfg, w) {
  var h = cfg.h || (w < 520 ? 240 : 300), L = 46, R = 14, T = 26, B = 32, n = cfg.labels.length, a = cfg.a.vals, b = cfg.b ? cfg.b.vals : null;
  if (!a.every(isFinite) || (b && !b.every(isFinite))) return '';
  var tous = a.concat(b || [], cfg.repere ? [cfg.repere.v] : [], [1]), max = Math.max.apply(null, tous), pas = J.niceStep(max), top = Math.ceil(max * 1.04 / pas) * pas;
  var iw = w - L - R, ih = h - T - B, X = function (i) { return L + (i + .5) * iw / n; }, Y = function (v) { return T + ih - v / top * ih; };
  var s = '<svg class="courbe" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(cfg.aria || 'Courbe') + '">';
  for (var g = 0; g <= top + 1; g += pas) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="var(--filet)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Y(g) + 4.5).toFixed(1) + '" font-size="13" text-anchor="end" fill="var(--enc-3)">' + J.kfmt(g) + '</text>';
  var pa = a.map(function (v, i) { return [X(i), Y(v)]; }), da = lisse(pa);
  s += '<defs><linearGradient id="gA' + (cfg.id || '') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + cfg.a.col + '" stop-opacity=".20"/><stop offset="1" stop-color="' + cfg.a.col + '" stop-opacity="0"/></linearGradient></defs>';
  s += '<path d="' + da + 'L' + X(n - 1).toFixed(1) + ' ' + (T + ih) + 'L' + X(0).toFixed(1) + ' ' + (T + ih) + 'Z" fill="url(#gA' + (cfg.id || '') + ')"/>';
  if (cfg.repere) {
    var yr = Y(cfg.repere.v);
    s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + yr.toFixed(1) + '" y2="' + yr.toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="6 4"/>';
    s += '<text x="' + (L + 6) + '" y="' + (yr - 7).toFixed(1) + '" font-size="13" font-weight="600" text-anchor="start" fill="var(--enc-2)" stroke="#fff" stroke-width="4" paint-order="stroke">' + esc(cfg.repere.txt) + '</text>';
  }
  if (b) s += '<path class="trace" pathLength="1" d="' + lisse(b.map(function (v, i) { return [X(i), Y(v)]; })) + '" fill="none" stroke="' + cfg.b.col + '" stroke-width="2.4" stroke-linecap="round"/>';
  s += '<path class="trace" pathLength="1" d="' + da + '" fill="none" stroke="' + cfg.a.col + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  var rec = a.indexOf(Math.max.apply(null, a)), last = n - 1;
  [rec, last].forEach(function (i, k) {
    if (k && i === rec) return;
    var anc = i > n - 3 ? 'end' : i < 2 ? 'start' : 'middle', yy = pa[i][1] - 13;
    s += '<circle cx="' + pa[i][0].toFixed(1) + '" cy="' + pa[i][1].toFixed(1) + '" r="5" fill="#fff" stroke="' + cfg.a.col + '" stroke-width="2.5"/>';
    s += '<text x="' + pa[i][0].toFixed(1) + '" y="' + Math.max(14, yy).toFixed(1) + '" font-size="13" font-weight="700" text-anchor="' + anc + '" fill="var(--enc-1)" stroke="#fff" stroke-width="4" paint-order="stroke">' + (i === rec ? 'Record ' : '') + cfg.fmt(a[i]) + '</text>';
  });
  cfg.labels.forEach(function (l, i) { s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 9) + '" font-size="13" text-anchor="middle" fill="var(--enc-3)">' + esc(l) + '</text>'; });
  s += '<line class="marque-lue" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" stroke="var(--enc-4)" stroke-width="1" style="display:none"/>';
  cfg.labels.forEach(function (l, i) { s += '<g class="zone" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="' + T + '" width="' + (iw / n).toFixed(1) + '" height="' + ih + '" fill="transparent"/></g>'; });
  return s + '</svg>';
};
/* Colonnes sans axes (héros du Pilotage) : période en couleur, autres mois en gris-bleu clair, mois incomplet en pointillé, lecture au survol ou au doigt. */
J.colonnes = function (cfg, w) {
  var h = cfg.h || 190, T = 12, B = 30, n = cfg.vals.length;
  if (!cfg.vals.every(isFinite)) return '';
  var max = Math.max.apply(null, cfg.vals.concat([1])), ih = h - T - B, iw = w - 4, bw = Math.min(40, iw / n * .62);
  var X = function (i) { return 2 + (i + .5) * iw / n; }, Y = function (v) { return T + ih - Math.max(6, v / max * ih); };
  var s = '<svg class="colonnes" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(cfg.aria || 'Colonnes') + '">';
  s += '<line x1="2" x2="' + (w - 2) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '" stroke="var(--filet)" stroke-width="1.5"/>';
  cfg.vals.forEach(function (v, i) {
    var sel = !cfg.sel || cfg.sel.indexOf(i) >= 0, inc = cfg.incompl && cfg.incompl.indexOf(i) >= 0, y = Y(v), hh = T + ih - y, col = sel ? cfg.couleur : '#C9D3E6';
    s += '<rect class="bar" x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="7" ' + (inc ? 'fill="#fff" stroke="' + col + '" stroke-width="1.8" stroke-dasharray="4 3"' : 'fill="' + col + '"') + ' style="transform-origin:' + X(i).toFixed(1) + 'px ' + (T + ih) + 'px;animation-delay:' + (i * 40) + 'ms"/>';
    s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 9) + '" font-size="13" text-anchor="middle" fill="' + (sel ? 'var(--enc-1)' : 'var(--enc-3)') + '" font-weight="' + (sel ? 600 : 400) + '">' + esc(cfg.labels[i]) + '</text>';
    s += '<g class="zone" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="0" width="' + (iw / n).toFixed(1) + '" height="' + h + '" fill="transparent"/></g>';
  });
  return s + '</svg>';
};
})();
