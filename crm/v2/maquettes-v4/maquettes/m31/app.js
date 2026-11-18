/* m31 — routage (liste, fiche, pilotage, carte), navigation, démarrage. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, S = J.S;
J.route = function () {
  var h = (location.hash || '#liste').slice(1), base = h.split('-')[0];
  if (['liste', 'fiche', 'pilotage', 'carte'].indexOf(base) < 0) { base = 'liste'; h = 'liste'; }
  ['liste', 'fiche', 'pilotage', 'carte'].forEach(function (e) { $('#ecran-' + e).hidden = e !== base; });
  document.body.setAttribute('data-ecran-actif', base);
  $$('[data-nav]').forEach(function (a) { var k = a.getAttribute('data-nav'), on = (k === 'officines' && (base === 'liste' || base === 'fiche')) || k === base; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('.b-ret').hidden = base !== 'fiche';
  var pn = $('#panneau'); if (pn) pn.hidden = true;
  if (base !== 'carte') J.carteVoletOff();
  var enDetail = base === 'pilotage' && h === 'pilotage-detail';
  if (!enDetail) window.scrollTo(0, 0);
  if (base === 'liste') J.renderListe();
  else if (base === 'fiche') J.renderFiche();
  else if (base === 'pilotage') { S.detail = enDetail; J.renderPilotage(); }
  else J.carteMontrer(h);
  if (enDetail) { var d = $('#p-detail'), y = d && d.getBoundingClientRect ? d.getBoundingClientRect().top + window.scrollY - 90 : 0; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); }
};
document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-stub]'); if (t) { e.preventDefault(); J.toast(t.getAttribute('data-stub')); } });
$('.b-ret').addEventListener('click', function () { location.hash = '#liste'; });
$('#rech-globale').addEventListener('input', function (e) { S.q = e.target.value; if (location.hash !== '#liste' && location.hash !== '') location.hash = '#liste'; else if ($('#l-q')) { $('#l-q').value = S.q; J.remplirListe(); } });
window.addEventListener('hashchange', J.route);
J.poseIcones(document); J.route();
})();
