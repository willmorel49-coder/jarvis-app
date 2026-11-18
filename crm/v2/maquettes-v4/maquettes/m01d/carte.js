/* m01d — Pappers v4 : Carte du secteur (INVENTÉE : Pappers n'a pas de carte ; bandeau bleu, carte blanche flottante, volet à droite, tiroir en bas sur téléphone).
   Fond de carte local en SVG (aucune tuile). Points : une teinte de bleu (taille et clarté = chiffre d'affaires), prospects en gris, ambre pour « À rappeler ». */
(function () {
  'use strict';
  var N = window.N, V = window.DONNEES_V4, C = V.carte, esc = N.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  function eur(n) { return nf.format(Math.round(n)) + ' €'; }
  var S = { cf: 'tout', cq: '', ccom: '', cgrp: '', volet: null, tour: {}, tourVue: false, cran: 'mi' };
  C.tournee.arrets.forEach(function (a) { S.tour[a.id] = true; });
  var BB = window.FOND_PACA_BBOX, KM = 190, CM = Math.cos(43.7 * Math.PI / 180), PADM = 14;
  var MW = (BB.est - BB.ouest) * CM * KM + 2 * PADM, MH = (BB.nord - BB.sud) * KM + 2 * PADM;
  function MX(lng) { return PADM + (lng - BB.ouest) * CM * KM; }
  function MY(lat) { return PADM + (BB.nord - lat) * KM; }
  function tCA(ca) { return Math.max(0, Math.min(1, Math.log(Math.max(ca, 1000) / 1000) / Math.log(1300))); }
  function teinte(ca) { var t = tCA(ca), a = [174, 196, 240], b = [26, 66, 160]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }).join(',') + ')'; }
  function estClient(p) { return p.statut === 'cliente' || p.statut === 'à rappeler'; }
  function rayon(p) { return estClient(p) ? 4.6 + tCA(p.ca) * 6.4 : 4.2; }
  function pointById(id) { for (var i = 0; i < C.points.length; i++) if (C.points[i].id === id) return C.points[i]; return null; }
  function offById(id) { var o = N.D.officines; for (var i = 0; i < o.length; i++) if (o[i].id === id) return o[i]; return null; }
  function visible(p) {
    if (S.cf === 'clients' && !estClient(p)) return false;
    if (S.cf === 'prospects' && estClient(p)) return false;
    if (S.ccom && p.commercial !== S.ccom) return false;
    if (S.cgrp && p.groupement !== S.cgrp) return false;
    if (S.cq && (p.nom + ' ' + p.ville + ' ' + p.cp + ' ' + p.titulaire).toLowerCase().indexOf(S.cq.toLowerCase()) < 0) return false;
    return true;
  }
  var POS = null;
  function positions() { /* léger écartement : le centre d'un point n'est jamais caché par un autre */
    if (POS) return POS;
    var L = C.points.map(function (p) { return { p: p, x: MX(p.lng), y: MY(p.lat), r: rayon(p) }; });
    for (var it = 0; it < 40; it++) { var bouge = false;
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
        var a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01, m = Math.max(a.r, b.r) + 2.5;
        if (d < m) { var k = (m - d) / 2 / d; if (d < .02) { dx = 1; dy = 0; k = m / 2; } a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; bouge = true; } }
      if (!bouge) break; }
    POS = {}; L.forEach(function (o) { POS[o.p.id] = [o.x, o.y]; }); return POS;
  }
  var rendue = false;
  function icoSvg(p) { return '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }

  function dessiner() {
    var el = $('#ecran-carte'), fond = '';
    window.FOND_PACA.features.forEach(function (f) {
      var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      fond += '<path d="' + polys.map(function (pl) { return pl.map(function (rg) { return 'M' + rg.map(function (c) { return MX(c[0]).toFixed(1) + ' ' + MY(c[1]).toFixed(1); }).join('L') + 'Z'; }).join(''); }).join('') + '" fill="#fff" stroke="var(--enc-5)" stroke-width="1.1"/>';
    });
    var villes = window.VILLES_PACA.filter(function (v) { return v.rang <= 2; }).map(function (v) {
      var w = v.nom.length * 7.2 + 12;
      return '<g pointer-events="none"><rect x="' + (MX(v.lng) + 10).toFixed(1) + '" y="' + (MY(v.lat) - 24).toFixed(1) + '" width="' + w.toFixed(0) + '" height="20" rx="10" fill="#fff" stroke="var(--enc-5)"/><text x="' + (MX(v.lng) + 16).toFixed(1) + '" y="' + (MY(v.lat) - 9.5).toFixed(1) + '" font-size="13" font-weight="500" fill="var(--enc-2)">' + v.nom + '</text></g>';
    }).join('');
    var ordre = C.points.slice().sort(function (a, b) { return (estClient(b) ? 1 : 0) - (estClient(a) ? 1 : 0) || b.ca - a.ca; });
    var pts = ordre.map(function (p) {
      var col = p.statut === 'à rappeler' ? 'var(--e-attention)' : p.statut === 'cliente' ? teinte(p.ca) : p.statut === 'prospect' ? 'var(--enc-4)' : 'var(--enc-5)';
      return '<circle data-point="' + p.id + '" data-statut="' + p.statut + '" cx="' + positions()[p.id][0].toFixed(1) + '" cy="' + positions()[p.id][1].toFixed(1) + '" r="' + rayon(p).toFixed(1) + '" fill="' + col + '" stroke="#fff" stroke-width="1.4"><title>' + esc(N.titre(p.nom)) + '</title></circle>';
    }).join('');
    el.innerHTML =
      '<header class="bandeau bandeau--pil bandeau--carte"><div class="wrap"><p class="maj">Fond de carte local, sans service extérieur · Données fictives</p>' +
      '<div class="hero"><div><p class="sur">Mon secteur</p><h1>Carte du secteur</h1><p class="hsous" id="c-sous"></p></div>' +
      '<div class="hero-act"><button class="btn btn--blanc" type="button" data-act="liste">' + N.ico('table') + 'Liste</button><button class="btn btn--blanc" type="button" data-stub="Exportation non dessinée dans cette maquette.">' + N.ico('down') + 'Excel</button>' +
      '<button class="btn btn--blanc" type="button" data-act="tournee">' + N.ico('pin') + 'Ma tournée <b class="nb-t" id="c-nt"></b></button></div></div>' +
      '<label class="recherche"><span data-ico="search"></span><input id="c-q" type="search" placeholder="Une pharmacie, une ville, un code postal…" autocomplete="off" aria-label="Rechercher sur la carte"></label></div></header>' +
      '<div class="wrap fiche carte-w"><section class="cadre c-cadre"><div class="c-filtres"><div class="seg seg--clair" role="group" aria-label="Afficher">' +
      [['tout', 'Tout'], ['clients', 'Clients'], ['prospects', 'Prospects']].map(function (b) { return '<button type="button" data-filtre="' + b[0] + '" aria-pressed="' + (S.cf === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div>' +
      '<b class="c-cpt" id="c-cpt"></b>' +
      '<label class="sel-b sel-b--c"><span class="lbl">Commercial</span><select id="c-com" aria-label="Commercial"><option value="">Tous</option>' + C.commerciaux.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="sel-b sel-b--c"><span class="lbl">Groupement</span><select id="c-grp" aria-label="Groupement"><option value="">Tous</option>' + C.groupements.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="c-defile"><div class="c-map"><svg id="c-svg" viewBox="0 0 ' + MW.toFixed(0) + ' ' + MH.toFixed(0) + '" role="img" aria-label="Carte du secteur : ' + C.points.length + ' officines">' + fond + '<g id="c-tr"></g><g id="c-pts">' + pts + '</g>' + villes + '</svg></div></div>' +
      '<div class="legende" aria-label="Légende"><b>Chiffre d’affaires</b>' +
      '<span><i class="pt-l" style="width:9px;height:9px;background:' + teinte(2000) + '"></i>petit</span><span><i class="pt-l" style="width:13px;height:13px;background:' + teinte(60000) + '"></i>moyen</span><span><i class="pt-l" style="width:18px;height:18px;background:' + teinte(500000) + '"></i>grand</span>' +
      '<span><i class="pt-l" style="width:11px;height:11px;background:var(--e-attention)"></i>À rappeler</span><span><i class="pt-l" style="width:9px;height:9px;background:var(--enc-4)"></i>Prospect</span><span><i class="pt-l" style="width:9px;height:9px;background:var(--enc-5)"></i>Aucune vente</span></div>' +
      '<p class="st">' + esc(C.noteSegments) + ' Treize officines de la liste sont hors des six départements et n’apparaissent pas ici.</p></section></div>';
    N.icones(el); rendue = true;
    var svg = $('#c-svg', el);
    /* le clic vise le point le plus proche du doigt (jusqu'à 22 px), pas seulement le rond lui-même */
    svg.addEventListener('click', function (e) {
      var ctm = svg.getScreenCTM(); if (!ctm) return;
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var q = pt.matrixTransform(ctm.inverse()), ech = ctm.a || 1, best = null, bd = 22 / ech;
      $$('#c-pts [data-point]').forEach(function (c) { if (c.style.display === 'none') return; var dx = +c.getAttribute('cx') - q.x, dy = +c.getAttribute('cy') - q.y, d = Math.sqrt(dx * dx + dy * dy) - (+c.getAttribute('r')); if (d < bd) { bd = d; best = c; } });
      if (best) { S.volet = best.getAttribute('data-point'); if (location.hash === '#carte-fiche') volet(true); else location.hash = '#carte-fiche'; }
    });
    $$('[data-filtre]', el).forEach(function (b) { b.onclick = function () { S.cf = b.getAttribute('data-filtre'); maj(); }; });
    $('#c-q', el).oninput = function (e) { S.cq = e.target.value; maj(); };
    $('#c-com', el).onchange = function (e) { S.ccom = e.target.value; maj(); };
    $('#c-grp', el).onchange = function (e) { S.cgrp = e.target.value; maj(); };
    $('[data-act="liste"]', el).onclick = listePanneau; $('[data-act="tournee"]', el).onclick = tourneePanneau;
    maj();
    var dfl = $('.c-defile', el); if (dfl && dfl.scrollWidth > dfl.clientWidth) dfl.scrollLeft = (dfl.scrollWidth - dfl.clientWidth) / 2;
  }
  function maj() {
    var n = 0;
    $$('#c-pts [data-point]').forEach(function (c) { var p = pointById(c.getAttribute('data-point')), v = visible(p); c.style.display = v ? '' : 'none'; if (v) n++; });
    $$('[data-filtre]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filtre') === S.cf)); });
    $('#c-cpt').textContent = nf.format(n) + ' officines'; $('#c-sous').textContent = 'La carte de votre secteur · ' + nf.format(C.points.length) + ' officines localisées';
    $('#c-nt').textContent = Object.keys(S.tour).filter(function (k) { return S.tour[k]; }).length;
    tracer();
  }
  function tracer() {
    var g = $('#c-tr'); if (!g) return;
    if (!S.tourVue) { g.innerHTML = ''; return; }
    var d = C.tournee, pts = [[MX(d.depot.lng), MY(d.depot.lat)]].concat(d.arrets.map(function (a) { var q = positions()[a.id]; return [q[0], q[1]]; }));
    g.innerHTML = '<path d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '" fill="none" stroke="var(--c-moyenne)" stroke-width="2" stroke-dasharray="6 4"/>' +
      pts.map(function (q, i) { return '<g pointer-events="none"><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="10" fill="#fff" stroke="var(--c-moyenne)" stroke-width="1.6"/><text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4.5).toFixed(1) + '" font-size="13" font-weight="700" text-anchor="middle" fill="var(--ink)">' + (i ? i : 'D') + '</text></g>'; }).join('');
  }
  function panneau(titre, html) {
    var p = $('#panneau');
    p.innerHTML = '<div class="pn-t"><h2>' + esc(titre) + '</h2><button type="button" class="btn" data-fermer aria-label="Fermer">' + N.ico('back') + 'Fermer</button></div><div class="pn-c">' + html + '</div>';
    p.hidden = false; $('[data-fermer]', p).onclick = function () { p.hidden = true; }; N.icones(p); return p;
  }
  function tourneePanneau() {
    S.tourVue = true; tracer(); var d = C.tournee;
    panneau('Ma tournée', '<p class="st">' + esc(d.nom) + ' · départ ' + d.depart.replace(':', ' h ') + '</p><div class="trois"><div><span class="co-l">Arrêts</span><b>' + d.arrets.length + '</b></div><div><span class="co-l">Distance</span><b>' + d.kmTotal + ' km</b></div><div><span class="co-l">Fin</span><b>' + d.fin.replace(':', ' h ') + '</b></div></div>' +
      '<div class="bl"><div class="bl-l"><span class="bl-n"><b>Départ · ' + esc(d.depot.nom) + '</b><span class="sous">' + esc(d.depot.adresse) + '</span></span><span class="bl-v">' + d.depart.replace(':', ' h ') + '</span></div>' +
      d.arrets.map(function (a) { var p = pointById(a.id); return '<div class="bl-l"><span class="bl-n"><b>' + a.ordre + '. ' + esc(N.titre(p.nom)) + '</b><span class="sous">' + esc(p.ville) + ' · visite de ' + a.dureeVisite + ' min · ' + a.kmDepuisPrecedent + ' km depuis l’arrêt précédent</span></span><span class="bl-v">' + a.arrivee.replace(':', ' h ') + '</span></div>'; }).join('') + '</div>' +
      '<div class="btns"><button class="btn btn--plein" type="button" data-stub="Itinéraire externe non dessiné dans cette maquette.">' + N.ico('pin') + 'Itinéraire</button></div>');
  }
  function listePanneau() {
    var l = C.points.filter(visible).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 40);
    var p = panneau('Liste des pharmacies', '<p class="st">' + l.length + ' premières, classées par chiffre d’affaires.</p><div class="bl">' + l.map(function (q) {
      return '<button type="button" class="bl-l bl-l--b" data-ouvre-carte="' + q.id + '"><span class="bl-n"><b>' + esc(N.titre(q.nom)) + '</b><span class="sous">' + esc(q.ville) + ' · ' + q.cp + ' · ' + esc(q.commercial) + '</span></span><span class="bl-v">' + (q.ca ? eur(q.ca) : 'Aucune vente') + '</span></button>'; }).join('') + '</div>');
    $$('[data-ouvre-carte]', p).forEach(function (b) { b.onclick = function () { p.hidden = true; S.volet = b.getAttribute('data-ouvre-carte'); if (location.hash === '#carte-fiche') volet(true); else location.hash = '#carte-fiche'; }; });
  }
  var ML = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
  function volet(ouvert) {
    var v = $('#volet');
    if (!v) { v = document.createElement('aside'); v.id = 'volet'; v.className = 'volet'; v.setAttribute('data-volet', ''); v.setAttribute('aria-label', 'Fiche de l’officine'); document.body.appendChild(v); }
    if (!ouvert || !S.volet) { v.hidden = true; $$('[data-point]').forEach(function (c) { c.removeAttribute('data-sel'); }); return; }
    var p = pointById(S.volet), cm = p.caParMois || [], mx = Math.max.apply(null, cm.concat([1])), ex = offById(p.id);
    var etat = p.statut === 'à rappeler' ? ['À rappeler', icoSvg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'), 'var(--e-attention)'] : p.statut === 'cliente' ? [p.segment, icoSvg('<path d="m5 12 4.5 4.5L19 7"/>'), 'var(--e-bien)'] : [p.statut === 'prospect' ? 'Prospect' : 'Aucune vente', icoSvg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'), 'var(--e-neutre)'];
    v.innerHTML = '<button type="button" class="v-poignee" data-cran aria-label="Agrandir ou réduire la fiche"><span></span></button>' +
      '<div class="pn-t"><div><h2>' + esc(N.titre(p.nom)) + '</h2><p class="st">' + esc(p.titulaire) + '</p></div><button type="button" class="btn" data-fermer-volet aria-label="Fermer la fiche">' + N.ico('back') + 'Fermer</button></div><div class="pn-c">' +
      '<p class="st">' + esc(p.ville) + ' · ' + p.cp + '</p><p class="v-etats"><span class="pastille" style="color:' + etat[2] + '">' + etat[1] + '<span style="color:var(--ink)">' + esc(etat[0]) + '</span></span><span class="st">' + esc(p.commercial) + ' · ' + esc(p.groupement) + '</span></p>' +
      (p.ca ? '<div class="trois"><div><span class="co-l">Chiffre d’affaires (10 mois)</span><b>' + eur(p.ca) + '</b></div><div><span class="co-l">Références</span><b>' + nf.format(Math.round(p.ca / 1100)) + '</b></div><div><span class="co-l">Potentiel</span><b>' + eur(p.ca * 1.35) + '</b></div></div>' +
        '<h3>Chiffre d’affaires par mois</h3><div class="mini-b">' + cm.map(function (x, i) { return '<span class="mb"><i style="height:' + Math.max(2, x / mx * 56).toFixed(0) + 'px" title="' + ML[i] + ' : ' + eur(x) + '"></i><em>' + ML[i].slice(0, 3) + '</em></span>'; }).join('') + '</div>' +
        '<h3>Produits phares</h3><div class="bl">' + (p.produits || []).map(function (q) { return '<div class="bl-l"><span class="bl-n"><b>' + esc(q.nom.split(',')[0]) + '</b></span><span class="bl-v">' + eur(q.ca) + '</span></div>'; }).join('') + '</div>' : '<p class="st">Pas encore de ventes réseau pour cette officine.</p>') +
      '<dl class="kv kv--filets"><div><dt>Téléphone</dt><dd>' + esc(p.telephone || '—') + '</dd></div>' + (p.suivi ? '<div><dt>Dernière visite</dt><dd>' + (p.suivi.derniereVisite ? p.suivi.derniereVisite.split('-').reverse().join('/') : '—') + '</dd></div><div><dt>Prochain rendez-vous</dt><dd>' + (p.suivi.prochainRendezVous ? p.suivi.prochainRendezVous.date.split('-').reverse().join('/') + ' à ' + p.suivi.prochainRendezVous.heure.replace(':', ' h ') : '—') + '</dd></div>' : '') + '</dl>' +
      '<div class="btns">' + (ex ? '<button class="btn btn--plein" type="button" data-action="ouvrir-fiche">Ouvrir la fiche complète</button>' : '<button class="btn" type="button" data-stub="Fiche complète non dessinée pour cette officine fictive.">Ouvrir la fiche complète</button>') +
      '<button class="btn" type="button" data-act="ajout">' + (S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button><button class="btn" type="button" data-stub="Itinéraire externe non dessiné dans cette maquette.">Itinéraire</button></div></div>';
    v.setAttribute('data-cran', S.cran); N.icones(v); v.hidden = false;
    $$('[data-point]').forEach(function (c) { if (c.getAttribute('data-point') === p.id) c.setAttribute('data-sel', '1'); else c.removeAttribute('data-sel'); });
    $('[data-fermer-volet]', v).onclick = function () { S.volet = null; location.hash = '#carte'; };
    $('[data-cran]', v).onclick = function () { S.cran = S.cran === 'mi' ? 'haut' : 'mi'; v.setAttribute('data-cran', S.cran); };
    var of = $('[data-action="ouvrir-fiche"]', v); if (of) of.onclick = function () { v.hidden = true; N.ouvrir(p.id); };
    $('[data-act="ajout"]', v).onclick = function (e) { S.tour[p.id] = !S.tour[p.id]; e.currentTarget.textContent = S.tour[p.id] ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée'; maj(); };
  }
  N.carteRendre = function (avecVolet) {
    if (!rendue) dessiner();
    if (avecVolet && !S.volet) S.volet = C.points[0].id;
    volet(!!avecVolet);
  };
  N.carteFermer = function () { volet(false); };
})();
