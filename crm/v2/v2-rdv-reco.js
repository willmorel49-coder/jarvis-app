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
    // ⚠️ « œ » n'est pas une lettre accentuée mais deux lettres : sans cette ligne, « Phie cœur
    // de bourg » devenait « C UR DE BOURG » et tombait sur « PHARMACIE DE BOURG » (24/11/2026).
    var s = String(texte == null ? '' : texte).replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE');
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
    t = presquePharmacie(t);
    var m = MARQUEUR.exec(t);
    if (!m) return { texte: t, marqueur: false };
    var reste = t.slice(m.index + m[0].length).trim();
    var c = COMMENTAIRE.exec(reste);
    if (c) reste = reste.slice(0, c.index).trim();
    return { texte: reste, marqueur: true };
  };

  // ⚠️ 26/11/2026 — « Pharmcie des fougères » (agenda de Will, client à Saint-Georges-sur-Loire) : sans le
  // mot « pharmacie » bien écrit, le titre perdait son marqueur et ne valait plus qu'une correspondance
  // exacte. Une lettre de trop, de moins, changée ou deux lettres inversées : c'est encore « pharmacie ».
  // PHARMACIEN(S) et PHARMACIES restent ce qu'ils sont (une réunion, un salon).
  var PAS_MARQUEUR = { PHARMACIEN: 1, PHARMACIES: 1 };
  function unePres(a, b) {
    var la = a.length, lb = b.length, i = 0;
    if (Math.abs(la - lb) > 1) return false;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
    if (la === lb) return a.slice(i + 1) === b.slice(i + 1) ||
      (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2));
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }
  function presquePharmacie(t) {
    return t.split(' ').map(function (w) {
      return (w !== 'PHARMACIE' && !PAS_MARQUEUR[w] && w.length >= 8 && w.length <= 10 && w.charAt(0) === 'P' && unePres(w, 'PHARMACIE')) ? 'PHARMACIE' : w;
    }).join(' ');
  }

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
                 ville: M.normaliser(o.ville || ''), cp: codePostal(o.cp) });
    }
    return out;
  };

  // « 6000 » lu comme un nombre est « 06000 ». Rien d'autre qu'un code postal à cinq chiffres.
  function codePostal(v) {
    var c = String(v == null ? '' : v).trim();
    if (/^\d{4}$/.test(c)) c = '0' + c;
    return /^\d{5}$/.test(c) ? c : '';
  }

  // Ce que le titre dit du LIEU, hors du nom : un code postal (« Pharmacie Martin (49250) »),
  // ou une ville connue écrite entre parenthèses (« Phie de saint Martin (segre en Anjou bleu) »).
  // Une parenthèse qui n'est pas une ville connue (« (Charlotte) », un contact) ne dit rien.
  function lieux(titre, villes) {
    var brut = String(titre == null ? '' : titre), cps = [], vs = [];
    M.normaliser(brut).split(' ').forEach(function (m) { if (/^(0[1-9]|[1-8]\d|9[0-5]|97)\d{3}$/.test(m)) cps.push(m); });
    // 26/11/2026 — morceaux de 1 à 4 mots qui sont une ville connue, 4 lettres au moins (« Y », « EST » ne disent rien).
    function morceaux(t) {
      var mots = t.split(' ').filter(Boolean), out = [];
      for (var a = 0; a < mots.length; a++) for (var n = 1; n <= 4 && a + n <= mots.length; n++) {
        var g = mots.slice(a, a + n).join(' ');
        if (g.length >= 4 && villes[g] && out.indexOf(g) === -1) out.push(g);
      }
      return out;
    }
    // Une parenthèse : la ville entière, sinon une ville dans la parenthèse (« (segre en Anjou bleu) » : SEGRE, 26/11/2026).
    if (villes) brut.replace(/\(([^)]*)\)/g, function (_, x) {
      var v = M.normaliser(x);
      if (v && villes[v]) vs.push(v); else morceaux(v).forEach(function (g) { if (vs.indexOf(g) === -1) vs.push(g); });
      return '';
    });
    // 26/11/2026 — et une ville connue écrite EN CLAIR, hors parenthèses (« Pharmacie long champs Rennes »).
    var nues = villes ? morceaux(M.normaliser(brut.replace(/\([^)]*\)/g, ' '))) : [];
    return { cps: cps, villes: vs, nues: nues };
  }
  function dedans(mot, phrase) { return (' ' + phrase + ' ').indexOf(' ' + mot + ' ') !== -1; }
  // La ville trouvée fait-elle partie du NOM de l'officine ? « Pharmacie la grand prairie » : GRAND est une commune
  // des Vosges, mais c'est ici le début de GRANDE (PHARMACIE LA GRANDE PRAIRIE) — un mot du nom qui commence pareil.
  function dansLeNom(v, e) {
    var nom = M.normaliser(e.o.name);
    if (dedans(v, nom)) return true;
    if (v.indexOf(' ') !== -1) return false;
    return nom.split(' ').some(function (w) { return w.length >= 4 && (w.indexOf(v) === 0 || v.indexOf(w) === 0); });
  }

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

  // 26/11/2026 — « Pharmacie la grand prairie » : PHARMACIE LA GRANDE PRAIRIE, cliente de Will à Bourgueil, perdait
  // contre une PHARMACIE DE LA PRAIRIE de l'Aisne. Un mot au masculin ou au singulier vaut le même mot du nom
  // (GRAND/GRANDE, CHAMP/CHAMPS, FOUGERE/FOUGERES), la forme courte faisant 5 lettres au moins. Jamais un « E » retiré :
  // LOIRE n'est pas LOIR (deux rivières) ; et HAUTES n'est pas HAUT (4 lettres).
  function aLeMot(e, m) {
    if (e.jetons[m]) return true;
    if (m.length < 5) return false;
    return !!(e.jetons[m + 'E'] || e.jetons[m + 'S'] || e.jetons[m + 'ES'] ||
      (/S$/.test(m) && m.length >= 6 && e.jetons[m.slice(0, -1)]));
  }

  // `porte` : l'index est celui du portefeuille du commercial (64 officines), pas l'annuaire (19 700).
  function chercher(seg, marqueur, index, lieu, porte) {
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
      for (var k = 0; k < js.length; k++) if (aLeMot(e, js[k])) { communs++; seul = js[k]; }
      if (!contenu && !communs) continue;
      // Un nom distinctif très court ne vaut que s'il est tout le segment — sa ville à part (26/11/2026 :
      // « Pharmacie du lys coron » = PHARMACIE DU LYS à Coron, enseigne d'un client de Will).
      if (e.dist.length <= 3 && seg !== e.dist && js.filter(function (m) { return !dedans(m, e.ville); }).join(' ') !== e.dist) continue;
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
      // ⚠️ 24/11/2026 — le lieu écrit dans le titre tranche. Un code postal qui n'est pas celui de
      // l'officine : ce n'est pas elle (« Pharmacie Martin (49250) » n'est pas Combronde, 63460).
      // Une ville entre parenthèses qui n'est pas la sienne : jamais une certitude.
      if (lieu && lieu.cps.length && e.cp) {
        if (lieu.cps.indexOf(e.cp) === -1) continue;
        score = Math.min(1, score + 0.12);
      }
      if (lieu && lieu.villes.length && e.ville) {
        var chez = lieu.villes.some(function (v) { return dedans(v, e.ville) || dedans(e.ville, v); });
        var autreV = lieu.villes.some(function (v) { return !dedans(v, e.ville) && !dedans(e.ville, v) && !dansLeNom(v, e); });
        if (chez) score = Math.min(1, score + 0.12);
        else if (autreV) score = Math.min(score, SEUIL_RECONNU - 0.01);
      }
      // ⚠️ 26/11/2026 — une ville écrite en clair qui n'est ni la sienne ni un mot de son nom : ce n'est pas elle.
      // « Pharmacie long champs Rennes » sortait en PHARMACIE DES CHAMPS à Bécon-les-Granits (« pas un de mes
      // clients », Will) et comptait comme un rendez-vous posé chez lui.
      if (lieu && lieu.nues && lieu.nues.length && e.ville) {
        var ailleurs = false;
        for (k = 0; k < lieu.nues.length && !ailleurs; k++) {
          var v = lieu.nues[k];
          if (!dedans(v, e.ville) && !dedans(e.ville, v) && !dansLeNom(v, e)) ailleurs = true;
        }
        if (ailleurs) continue;
      }
      // ⚠️ Un nom qui n'explique pas TOUT le titre n'est jamais une certitude (24/11/2026) :
      // « Pharmacie boulevard de l'Est » sortait « reconnu » en PHARMACIE DU BOULEVARD à Brive,
      // « Phie cœur de bourg » en PHARMACIE DE BOURG, parce qu'un nom d'un seul mot est
      // entièrement « recouvert » par n'importe quel titre qui le contient. Un mot du titre
      // absent du nom (EST, COEUR, LISIEUX) et qui n'est pas la ville de l'officine : on descend
      // sous le seuil, le commercial tranche (« à confirmer »). L'inverse (un mot du NOM absent
      // du titre) n'est pas retenu : mesuré sur l'agenda réel, il rétrogradait des officines du
      // portefeuille à deux noms dont le commercial n'écrit qu'un (« Phie deroche »).
      if (seg !== e.dist) {
        var villeJ = {}, reste = 0;
        e.ville.split(' ').forEach(function (v) { if (v) villeJ[v] = 1; });
        for (k = 0; k < js.length; k++) if (!aLeMot(e, js[k]) && !villeJ[js[k]] && /^[A-Z]{2,}$/.test(js[k])) reste++;
        if (reste) score = Math.min(score, SEUIL_RECONNU - 0.01);
      }
      // 26/11/2026 — « Pharmacie Gouabau Pillet » (client de Will, PHARMACIE GOUABAU - PIHOUEE à Juigné-sur-Loire)
      // tombait à 0,58, sous le seuil : un NOM PROPRE partagé avec une officine de SON portefeuille, derrière le mot
      // « pharmacie », vaut au moins « à confirmer ». Nom propre = mot que portent au plus 2 officines du fichier et de
      // l'annuaire (`index.rares`, posé par V2.planningIndex) : GOUABAU 1, HUMEAU 2 ; SAINT 668, COEUR 24 n'en sont pas
      // (« Phie Saint vigor » tombait sur SAINT MARTIN DE LA PLACE). Jamais dans l'annuaire national.
      if (porte && marqueur && !contenu && communs && index.rares) {
        for (k = 0; k < js.length; k++) if (e.jetons[js[k]] && index.rares[js[k]]) { score = Math.max(score, SEUIL_CONFIRMER); break; }
      }
      if (!marqueur) score -= 0.10;
      trouves.push({ s: score, o: e.o, dist: e.dist });
    }
    if (!trouves.length) return vide;
    trouves.sort(function (a, b) { return b.s - a.s; });
    // Une officine peut avoir deux noms dans l'index (celui du fichier et son enseigne, 26/11/2026) : on compte
    // des OFFICINES proches, pas des noms, sinon « Pharmacie Morvillez cœur de bourg » ne serait jamais certaine.
    var haut = trouves[0].s, proches = 0, vus = {};
    for (var p = 0; p < trouves.length; p++) {
      var idp = String(trouves[p].o.id);
      if (trouves[p].s >= haut - 0.04 && !vus[idp]) { vus[idp] = 1; proches++; }
    }
    return { officine: trouves[0].o, score: haut, candidats: proches, dist: trouves[0].dist };
  }

  function parId(index, id) {
    for (var i = 0; i < index.length; i++) if (String(index[i].o.id) === String(id)) return index[i].o;
    return null;
  }

  // `villes` (facultatif) : les villes connues, normalisées ({ 'SEGRE EN ANJOU BLEU': 1 }), pour lire
  // une ville écrite entre parenthèses. Sans elles, seule la ville hors parenthèses compte.
  M.apparier = function (titre, indexPortefeuille, indexNational, alias, villes) {
    var rien = { officine: null, score: 0, candidats: 0, source: null, etat: 'ignore' };
    var seg = M.segment(titre);
    if (!seg.texte) return rien;
    var lieu = lieux(titre, villes);

    // 1. Un rattachement déjà validé à la main gagne toujours.
    var cip = (alias || {})[seg.texte];
    if (cip) {
      var o = parId(indexPortefeuille || [], cip) || parId(indexNational || [], cip);
      if (o) return { officine: o, score: 1, candidats: 1, source: 'alias', etat: 'reconnu' };
    }

    // 2. Le portefeuille d'abord : ce sont ses clients.
    var p = chercher(seg.texte, seg.marqueur, indexPortefeuille || [], lieu, true);
    var meilleur = { r: p, source: 'portefeuille' };

    if (!seg.marqueur) {
      // ⚠️ Sans le mot « pharmacie », l'annuaire national reste fermé et le
      // portefeuille n'est accepté que sur une correspondance exacte.
      if (!(p.officine && (seg.texte === p.dist || p.score >= 0.95))) return rien;
    } else if (!p.officine || p.score < 0.95) {
      // ⚠️ Le seuil était à 0,80, et c'était trop bas : « Voir Clement phie
      // des plantes » trouvait « PHARMACIE DU JARDIN DES PLANTES » à Grenoble
      // dans le portefeuille (0,88, par simple inclusion du mot « plantes »)
      // et n'allait donc jamais voir « PHARMACIE DES PLANTES » à Angers, à
      // deux pas du secteur. On ne s'arrête au portefeuille que si la
      // correspondance y est quasi parfaite ; sinon on compare les deux.
      var n = chercher(seg.texte, seg.marqueur, indexNational || [], lieu);
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
