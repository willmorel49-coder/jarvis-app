(function () {
  var FEM = ['BASTIDE', 'BELLE', 'CANEBIÈRE', 'CITADELLE', 'FONTAINE', 'GARE', 'PLACE', 'VALLÉE'];
  var PLUR = ['ALPILLES', 'CALANQUES', 'COLLINES', 'GARRIGUES', 'LAVANDES', 'MIMOSAS', 'PLATANES', 'REMPARTS', 'SALINS', 'TILLEULS'];
  function corriger(nom) {
    if (!/^PHARMACIE /.test(nom)) return nom;
    var tous = nom.split(' ');
    for (var k = 3; k >= 1; k--) { // ville doublée en fin de nom
      if (tous.length >= 2 * k + 1 && tous.slice(-k).join(' ') === tous.slice(-2 * k, -k).join(' ')) { tous = tous.slice(0, -k); break; }
    }
    nom = tous.join(' ');
    var m = /^PHARMACIE DU (.+)$/.exec(nom);
    if (!m) return nom;
    var mots = m[1].split(' ');
    var p = mots[0], art = 'DU ';
    if (p === 'LES') { mots.shift(); art = 'DES '; }
    else if (PLUR.indexOf(p) >= 0) art = 'DES ';
    else if (FEM.indexOf(p) >= 0) art = 'DE LA ';
    else if (/^[AEIOUÉÈH]/.test(p)) art = "DE L'";
    return 'PHARMACIE ' + art + mots.join(' ');
  }
  function parcourir(o, vu) {
    if (!o || typeof o !== 'object' || vu.has(o)) return;
    vu.add(o);
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) parcourir(o[i], vu); return; }
    for (var c in o) {
      if (typeof o[c] === 'string' && (c === 'nom' || c === 'officine')) o[c] = corriger(o[c]);
      else parcourir(o[c], vu);
    }
  }
  var vu = new Set();
  parcourir(window.DONNEES, vu); parcourir(window.DONNEES_V4, vu);
  window.corrigerNomOfficine = corriger;
})();
