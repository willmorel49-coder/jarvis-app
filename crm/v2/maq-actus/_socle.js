/* Socle commun aux 4 maquettes « Infos » — chargement des VRAIES données du jour
   (crm/v2/brief-jour.json, écrit chaque matin par generate_brief.py) et petits
   utilitaires. Aucune donnée inventée : ce que les maquettes montrent est ce que
   l'app montrera. */
window.MAQ = (function () {
  var THEME_ACC = {
    marge: '#C7791A', remboursement: '#0050E6', generique: '#1E9E6A', rupture: '#E0556E',
    securite: '#E0556E', concurrence: '#6D4FC4', officine: '#0050E6', industrie: '#737A8C', sante: '#00889E', autre: '#737A8C'
  };
  var THEME_ACC_T = {
    marge: '#9A5B12', remboursement: '#0034A0', generique: '#0F7A52', rupture: '#C7283D',
    securite: '#C7283D', concurrence: '#553BA6', officine: '#0034A0', industrie: '#5C6273', sante: '#00697A', autre: '#5C6273'
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function acc(t) { return THEME_ACC[t] || THEME_ACC.autre; }
  function accT(t) { return THEME_ACC_T[t] || THEME_ACC_T.autre; }
  function dateFr() {
    try {
      var d = new Date(), s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      s = d.getDate() === 1 ? s.replace(/ 1 /, ' 1er ') : s;
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) { return ''; }
  }
  function ilYA(iso) {
    try {
      var j = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso + 'T00:00:00')) / 864e5);
      if (j <= 0) return "aujourd'hui"; if (j === 1) return 'hier';
      if (j < 7) return 'il y a ' + j + ' jours';
      return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch (e) { return ''; }
  }
  /* La couverture : la photo déclarée par le site, sinon une planche dessinée aux
     couleurs du thème. Si la photo refuse de se charger (serveur qui bloque les
     appels venus d'ailleurs), la planche réapparaît toute seule. */
  function cover(a, cls) {
    var c = acc(a.theme);
    var plaque = '<span class="mq-plaque" style="--a:' + c + '">' +
      '<span class="mq-plaque-t">' + esc(a.theme_l || '') + '</span></span>';
    return '<span class="mq-cov ' + (cls || '') + '">' + plaque +
      (a.img ? '<img src="' + esc(a.img) + '" alt="" loading="lazy" decoding="async" ' +
               'referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</span>';
  }
  function meta(a) {
    var m = [];
    if (a.mn) m.push(a.mn + ' min');
    m.push(ilYA(a.d));
    return m.join(' · ');
  }
  function charger(cb) {
    fetch('../brief-jour.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        d.tout = (d.cinq || []).concat(d.fil || []);
        cb(d);
      })
      .catch(function () {
        document.body.innerHTML = '<p style="font:16px/1.6 system-ui;padding:60px;text-align:center;color:#737A8C">' +
          'L\'édition du jour n\'a pas pu être chargée.</p>';
      });
  }
  return { esc: esc, acc: acc, accT: accT, dateFr: dateFr, ilYA: ilYA, cover: cover, meta: meta, charger: charger };
})();
