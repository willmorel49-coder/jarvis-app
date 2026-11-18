/* m31 — JARVIS, gros upgrade. Aides communes : formats, icônes, données, petits dessins SVG. Données : donnees.js + donnees-v4.js (fictives). */
(function () {
'use strict';
var J = window.J31 = {};
var D = window.DONNEES, V = window.DONNEES_V4;
J.D = D; J.V = V; J.P = V.pilotage; J.C = V.carte; J.MOY = D.moyenneClients; J.OFF = D.officines;
J.RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var RM = J.RM;
var $ = J.$ = function (s, r) { return (r || document).querySelector(s); };
var $$ = J.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var nf = J.nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
var nf1 = J.nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
var nf2 = J.nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
var eur = J.eur = function (n) { return nf.format(Math.round(n)) + ' €'; };
J.eurM = function (n) { return Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + ' M€' : eur(n); };
var esc = J.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
J.signe = function (p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + nf.format(Math.abs(Math.round(p))) + ' %'; };
J.gros = function (txt) { var m = String(txt).match(/^(.*?)(\s?(?:€|M€|k€))$/); return m ? esc(m[1]) + '<small>' + esc(m[2].trim()) + '</small>' : esc(txt); };
J.dateFr = function (d) { return d ? d.split('-').reverse().join('/') : '—'; };
J.maj = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
J.ini = function (n) { return n.replace(/^(PHARMACIE|PHIE)\s+(DU|DE LA|DE|DES|D’|DE L’)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'P'; };
var PETITS = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'd’', 'l’', 'aux', 'au'];
J.joli = function (n) { var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  return String(n).toLowerCase().replace(/'/g, '’').split(' ').map(function (t, k) {
    if (k > 0 && PETITS.indexOf(t) >= 0) return t;
    return t.split('-').map(function (s, q) { if (q > 0 && PETITS.indexOf(s) >= 0) return s; var ap = s.indexOf('’'); return ap > 0 && ap < 3 ? s.slice(0, ap + 1) + cap(s.slice(ap + 1)) : cap(s); }).join('-'); }).join(' '); };
var ICO = J.ICO = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pin: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16 9.5"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>',
  haut: '<path d="M7 17L17 7M9 7h8v8"/>', bas: '<path d="M7 7l10 10M17 9v8H9"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', chevb: '<path d="M6 9l6 6 6-6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>', send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/>',
  euro: '<path d="M17 6.5a6 6 0 1 0 0 11M5 10h8M5 14h8"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16zM13 7l4 4"/>',
  net: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  group: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M16 15c2.6 0 4.4 1.3 5 4"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  tasks: '<path d="M4 6l2 2 3-3M4 14l2 2 3-3M12 7h8M12 15h8"/>',
  clip: '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
var icoSvg = J.icoSvg = function (k, c) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + (ICO[k] || '') + '</svg>'; };
J.poseIcones = function (r) { $$('[data-ico]', r).forEach(function (e) { if (!e.firstChild) e.innerHTML = icoSvg(e.getAttribute('data-ico')); }); };
J.toast = function (t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(J.toast.t); J.toast.t = setTimeout(function () { e.hidden = true; }, 2600); };
J.compter = function (el, fin, fmt, dur) {
  if (!isFinite(fin)) fin = 0;
  if (RM || !el) { if (el) el.innerHTML = fmt(fin); return; }
  var t0 = null; dur = dur || 900;
  function pas(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.innerHTML = fmt(fin * e); if (k < 1) requestAnimationFrame(pas); else el.innerHTML = fmt(fin); }
  requestAnimationFrame(pas);
};
/* états : mot + icône, la couleur ne sert que l'icône */
var ETAT = J.ETAT = { cliente: ['check', 'var(--e-bien)', 'Cliente'], rappel: ['bell', 'var(--e-attention)', 'À rappeler'], prospect: ['user', 'var(--e-neutre)', 'Prospect'], aucune: ['user', 'var(--e-neutre)', 'Aucune vente'] };
J.etatHtml = function (k) { var e = ETAT[k]; return '<span class="etat"><span class="ico">' + icoSvg(e[0], e[1]) + '</span>' + e[2] + '</span>'; };
/* ---------- modèle ---------- */
var OFF = J.OFF, F0 = D.fiche;
J.offById = function (id) { for (var i = 0; i < OFF.length; i++) if (OFF[i].id === id) return OFF[i]; return null; };
J.pointById = function (id) { for (var i = 0; i < J.C.points.length; i++) if (J.C.points[i].id === id) return J.C.points[i]; return null; };
J.etatOff = function (o) { return o.statut === 'prospect' ? 'prospect' : o.aRappeler ? 'rappel' : 'cliente'; };
J.ficheDe = function (id) { /* la 1re officine reprend DONNEES.fiche ; les autres sont dérivées de leur ligne (inventé, proportionnel) */
  var o = J.offById(id), F = F0;
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
  base.identite.telephone = '04 00 ' + ('00' + (10 + num)).slice(-2) + ' 46 78'; base.identite.portable = '04 00 ' + ('00' + (10 + num)).slice(-2) + ' 46 80'; base.identite.fax = ''; base.identite.email = 'contact@' + id + '.example';
  base.aProposer.groupeAchat.groupement = o.groupement; base.aProposer.groupeAchat.nbProduits = 300 + (num * 17) % 300;
  return base;
};
/* ---------- registre des dessins redessinés à la largeur réelle (le texte reste lisible à 390 px) ---------- */
var REG = [];
J.dessine = function (box, fn, apres) {
  if (!box) return; REG = REG.filter(function (r) { return document.body.contains(r.box) && r.box !== box; });
  var item = { box: box, fn: fn, apres: apres }; REG.push(item); J.trace(item);
};
J.trace = function (item) {
  var w = Math.floor(item.box.clientWidth);
  if (w < 40) { var nb = (item.n = (item.n || 0) + 1); if (nb < 6) setTimeout(function () { J.trace(item); }, 120); return; }
  item.box.innerHTML = item.fn(w); item.w = w;
  if (item.apres) item.apres(item.box);
};
var tm = null;
window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(function () { REG.forEach(function (r) { if (document.body.contains(r.box) && r.box.clientWidth && Math.abs(r.box.clientWidth - (r.w || 0)) > 4) J.trace(r); }); }, 160); });
J.niceStep = function (max) { var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
J.kfmt = function (g) { return g >= 1e6 ? nf1.format(g / 1e6).replace(',0', '') + ' M€' : g >= 1000 ? nf.format(g / 1000) + ' k€' : g + ' €'; };
/* lecture au survol ou au doigt : cases [data-i] d'une boîte, texte dans le lecteur */
J.lie = function (box, textes, lecteur, base) {
  var cases = $$('.zone', box);
  function f(g) { var i = +g.getAttribute('data-i'); if (lecteur) lecteur.innerHTML = textes[i]; $$('.zone', box).forEach(function (z) { z.classList.toggle('lu', z === g); }); var m = $('.marque-lue', box); if (m) { var x = g.getAttribute('data-x'); m.setAttribute('x1', x); m.setAttribute('x2', x); m.style.display = ''; } }
  cases.forEach(function (g) { g.addEventListener('mouseenter', function () { f(g); }); g.addEventListener('click', function () { f(g); }); g.addEventListener('touchstart', function () { f(g); }, { passive: true }); });
};
})();
