/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Reconnaître une officine dans un titre d'agenda

   Ce module ne touche ni au DOM ni au réseau : on lui donne un titre et
   deux index d'officines, il rend une officine ou rien. C'est ce qui
   permet de le tester sur les vrais titres, hors navigateur.

   Mesuré le 14/08/2026 sur l'agenda réel de William Morel : 531
   événements, 463 titres distincts, 173 contenant « pharmacie / phie ».
   Sur ces 173 : 55 % reconnus tout seuls, 32 % à confirmer, 13 % ratés,
   et zéro fausse reconnaissance.

   Les deux verrous qui donnent ce zéro, chacun né d'une faute observée :

   1. FRONTIÈRE DE MOT. Sans elle, « Pharmacie HA » se trouvait dans
      « Verif mounjaro commande OmaHA beach », et « André » dans
      « ALEXANDRE PREISS ». Un nom distinctif de 3 caractères ou moins
      ne vaut donc que s'il EST tout le segment.

   2. PAS D'ANNUAIRE NATIONAL SANS LE MOT « PHARMACIE ». Avec 19 667
      noms, n'importe quel mot courant trouve une homonyme : « Caen »,
      « Marseille », « PAULINE », « RDV BANQUE » étaient toutes
      reconnues. Un titre sans marqueur n'est accepté que s'il désigne
      exactement une officine du portefeuille — celles que le commercial
      connaît assez pour les écrire en raccourci.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  var SEUIL_RECONNU = 0.85;
  var SEUIL_CONFIRMER = 0.60;

  // Ce que le commercial écrit AUTOUR du nom. Les formes longues d'abord :
  // « PRISE DE RDV » doit être essayé avant « RDV », sinon il reste « DE ».
  var VERBES = /^(PRISE DE RDV A FAIRE AVEC|PRISE DE RDV AVEC|PRISE DE RDV|PRISE RDV|PRENDRE RDV AVEC|PRENDRE RDV|REPASSER VOIR|RETOURNER VOIR|PASSER VOIR|ALLER VOIR|ALLEZ VOIR|RDV AVEC|APPELLE|APPELER|APPELE|APPEL|RAPPELER|RELANCER|RELANCE|VERIFIER|VERIF|PASSER|ALLEZ|ALLER|CALL|VOIR|RDV|A FAIRE|POUR)\s+/;
  var MARQUEUR = /\b(PHARMACIE|PHIE|PHCIE)\b/;
  var COMMENTAIRE = /\b(POUR|AVEC|PROBLEME|COMMANDE|LIVRAISON|PRESENTATION|BILAN|SMS|MR|MME|DR)\b/;
  var MOTS_VIDES = { DE: 1, DU: 1, DES: 1, LA: 1, LE: 1, LES: 1, L: 1, D: 1,
                     ET: 1, AU: 1, AUX: 1, A: 1, SUR: 1 };
  // Des mots qui prouvent que le titre parle du métier, pas d'une officine.
  var PAS_UNE_OFFICINE = { CONGRES: 1, PHARMAGORA: 1, REUNION: 1, SALON: 1,
                           FORMATION: 1, PHARMACIEN: 1, PHARMACIENS: 1,
                           TEAMS: 1, VISIO: 1, SEMINAIRE: 1 };

  var ACCENTS = 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
  var SANS    = 'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy';

  M.normaliser = function (texte) {
    var s = String(texte == null ? '' : texte);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var k = ACCENTS.indexOf(s.charAt(i));
      out += (k === -1) ? s.charAt(i) : SANS.charAt(k);
    }
    out = out.toUpperCase().replace(/\bPH\./g, ' PHARMACIE ');
    return out.replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  M.distinctif = function (nom) {
    var n = M.normaliser(nom).replace(MARQUEUR, ' ');
    return n.split(' ').filter(function (m) { return m && !MOTS_VIDES[m]; }).join(' ');
  };

  M.segment = function (titre) {
    var t = M.normaliser(String(titre == null ? '' : titre).replace(/\([^)]*\)/g, ' '));
    for (var i = 0; i < 3; i++) {                 // « Allez voir phie… » cumule
      var apres = t.replace(VERBES, '');
      if (apres === t) break;
      t = apres;
    }
    var m = MARQUEUR.exec(t);
    if (!m) return { texte: t, marqueur: false };
    var reste = t.slice(m.index + m[0].length).trim();
    var c = COMMENTAIRE.exec(reste);
    if (c) reste = reste.slice(0, c.index).trim();
    return { texte: reste, marqueur: true };
  };

  // La clé d'alias doit être la même pour « Appeler phie du lys » et
  // « Phie du lys » : c'est le segment, pas le titre brut.
  M.cleAlias = function (titre) { return M.segment(titre).texte; };

  M.indexer = function (officines) {
    var out = [];
    for (var i = 0; i < (officines || []).length; i++) {
      var o = officines[i];
      if (!o || !o.name) continue;
      var d = M.distinctif(o.name);
      if (!d) continue;
      var j = {}, mm = d.split(' ');
      for (var k = 0; k < mm.length; k++) j[mm[k]] = 1;
      out.push({ o: o, dist: d, jetons: j, nbJetons: mm.length,
                 ville: M.normaliser(o.ville || '') });
    }
    return out;
  };

  // Similarité de deux chaînes : part des bigrammes communs. Suffisant ici,
  // et sans dépendance — le projet n'a pas d'étape de build.
  function similarite(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    var pa = {}, n = 0, i, g;
    for (i = 0; i < a.length - 1; i++) { g = a.substr(i, 2); pa[g] = (pa[g] || 0) + 1; }
    for (i = 0; i < b.length - 1; i++) {
      g = b.substr(i, 2);
      if (pa[g] > 0) { pa[g]--; n++; }
    }
    return (2 * n) / (a.length - 1 + b.length - 1);
  }

  function chercher(seg, marqueur, index) {
    var vide = { officine: null, score: 0, candidats: 0, dist: '' };
    if (!seg) return vide;
    var js = seg.split(' ').filter(function (m) { return m && !MOTS_VIDES[m]; });
    if (!js.length) return vide;
    for (var z = 0; z < js.length; z++) if (PAS_UNE_OFFICINE[js[z]]) return vide;

    var enveloppe = ' ' + seg + ' ';
    var trouves = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      // ⚠️ FRONTIÈRE DE MOT : on cherche « HA » entouré d'espaces, jamais
      // la sous-chaîne « HA » qui se cache dans « OMAHA ».
      var contenu = enveloppe.indexOf(' ' + e.dist + ' ') !== -1;
      var communs = 0, seul = null;
      for (var k = 0; k < js.length; k++) if (e.jetons[js[k]]) { communs++; seul = js[k]; }
      if (!contenu && !communs) continue;
      // Un nom distinctif très court ne vaut que s'il est tout le segment.
      if (e.dist.length <= 3 && seg !== e.dist) continue;
      // Un seul mot commun, et il est banal : pas assez pour désigner.
      if (!contenu && communs === 1 && seul && seul.length <= 4) continue;

      var ratio = similarite(seg, e.dist);
      var recouvre = communs / Math.max(1, Math.min(js.length, e.nbJetons));
      var score = Math.max(ratio, 0.7 * recouvre + 0.3 * ratio);
      // ⚠️ « Contenu dans » ne suffit pas : « PHARMACIE BOIS » est contenu dans
      // « des bois jaunis pour prise rdv », et sortait en « reconnu » — donc
      // affiché comme certain, sans rien demander. Le nom doit couvrir une
      // bonne part du segment pour valoir une certitude ; sinon il descend en
      // « à confirmer », où le commercial tranche.
      if (contenu) {
        var couverture = communs / js.length;
        score = Math.max(score, 0.78 + 0.14 * couverture);
      }
      if (seg === e.dist) score = 1;
      // La ville écrite dans le titre départage deux homonymes.
      if (e.ville && enveloppe.indexOf(' ' + e.ville + ' ') !== -1) score = Math.min(1, score + 0.12);
      if (!marqueur) score -= 0.10;
      trouves.push({ s: score, o: e.o, dist: e.dist });
    }
    if (!trouves.length) return vide;
    trouves.sort(function (a, b) { return b.s - a.s; });
    var haut = trouves[0].s, proches = 0;
    for (var p = 0; p < trouves.length; p++) if (trouves[p].s >= haut - 0.04) proches++;
    return { officine: trouves[0].o, score: haut, candidats: proches, dist: trouves[0].dist };
  }

  function parId(index, id) {
    for (var i = 0; i < index.length; i++) if (String(index[i].o.id) === String(id)) return index[i].o;
    return null;
  }

  M.apparier = function (titre, indexPortefeuille, indexNational, alias) {
    var rien = { officine: null, score: 0, candidats: 0, source: null, etat: 'ignore' };
    var seg = M.segment(titre);
    if (!seg.texte) return rien;

    // 1. Un rattachement déjà validé à la main gagne toujours.
    var cip = (alias || {})[seg.texte];
    if (cip) {
      var o = parId(indexPortefeuille || [], cip) || parId(indexNational || [], cip);
      if (o) return { officine: o, score: 1, candidats: 1, source: 'alias', etat: 'reconnu' };
    }

    // 2. Le portefeuille d'abord : ce sont ses clients.
    var p = chercher(seg.texte, seg.marqueur, indexPortefeuille || []);
    var meilleur = { r: p, source: 'portefeuille' };

    if (!seg.marqueur) {
      // ⚠️ Sans le mot « pharmacie », l'annuaire national reste fermé et le
      // portefeuille n'est accepté que sur une correspondance exacte.
      if (!(p.officine && (seg.texte === p.dist || p.score >= 0.95))) return rien;
    } else if (!p.officine || p.score < 0.80) {
      var n = chercher(seg.texte, seg.marqueur, indexNational || []);
      if (n.officine && n.score > p.score) meilleur = { r: n, source: 'annuaire' };
    }

    var r = meilleur.r;
    if (!r.officine) return rien;
    var etat = (r.score >= SEUIL_RECONNU && r.candidats === 1) ? 'reconnu'
             : (r.score >= SEUIL_CONFIRMER ? 'confirmer' : 'ignore');
    if (etat === 'ignore') return rien;
    return { officine: r.officine, score: r.score, candidats: r.candidats,
             source: meilleur.source, etat: etat };
  };

  M._SEUIL_RECONNU = SEUIL_RECONNU;
  M._SEUIL_CONFIRMER = SEUIL_CONFIRMER;

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2RECO = M;
})(typeof window !== 'undefined' ? window : this);
