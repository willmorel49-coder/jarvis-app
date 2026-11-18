/* m01d — Pappers v4 : routage par adresse (#liste, #fiche, #pilotage, #pilotage-detail, #carte, #carte-fiche) et navigation. */
(function () {
  'use strict';
  var N = window.N, F = N.D.fiche;
  var BASES = ['liste', 'fiche', 'pilotage', 'carte'];
  var ancienne = null;

  function ecran(e) { return document.querySelector('[data-ecran="' + e + '"]'); }

  N.route = function () {
    var h = (location.hash || '#liste').slice(1), base = h.split('-')[0];
    if (BASES.indexOf(base) < 0) { base = 'liste'; h = 'liste'; }
    var change = ancienne !== base;
    var pn = document.getElementById('panneau'); if (pn) pn.hidden = true;
    if (change && ancienne === 'fiche' && N.detruire) { N.detruire(); N.rendu = null; }
    if (change && ancienne === 'carte' && N.carteFermer) N.carteFermer();
    BASES.forEach(function (e) { var el = ecran(e); if (el) el.hidden = e !== base; });
    document.body.setAttribute('data-etat', base);
    Array.prototype.forEach.call(document.querySelectorAll('.menu [data-nav]'), function (a) {
      var k = a.getAttribute('data-nav'), on = (k === 'officines' && (base === 'liste' || base === 'fiche')) || k === base;
      a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (change) window.scrollTo(0, 0);
    if (base === 'fiche') {
      var m = /^fiche-(of\d+)$/.exec(h); if (m) N.courant = m[1];
      if (!N.courant) N.courant = F.id;
      if (N.rendu !== N.courant) {
        var fiche = ecran('fiche'), src = N.srcAnim; N.srcAnim = null;
        N.rendreFiche(N.fiche(N.courant)); N.icones(fiche); N.rendu = N.courant;
        if (!N.REDUIT && fiche.animate && src && src.getBoundingClientRect) {
          var from = src.getBoundingClientRect(), cx = from.left + from.width / 2, cy = from.top + from.height / 2;
          var dx = (cx - innerWidth / 2) * 0.5, dy = Math.max(-40, Math.min(160, (cy - 140) * 0.35));
          fiche.animate([{ opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.32,.72,0,1)' });
        }
        N.compter(fiche); N.graphiques();
      }
    } else if (base === 'pilotage') {
      N.pilotageRendre(h === 'pilotage-detail');
    } else if (base === 'carte') {
      N.carteRendre(h === 'carte-fiche');
    }
    ancienne = base;
  };

  /* Recherche de la barre du haut : elle filtre la liste des officines. */
  var rg = document.getElementById('rech-globale');
  if (rg) rg.addEventListener('input', function (e) {
    var v = e.target.value, q = document.getElementById('q');
    N.D && (window.M01.etat.q = v); if (q) q.value = v;
    window.M01.listeRendre();
    if (location.hash !== '#liste' && location.hash !== '') location.hash = '#liste';
  });
  var q0 = document.getElementById('q');
  if (q0) q0.addEventListener('input', function (e) { if (rg) rg.value = e.target.value; });

  window.addEventListener('hashchange', N.route);
  N.route();
})();
