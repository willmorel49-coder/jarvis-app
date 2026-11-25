/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Infos du jour → « À faire avec les infos » (21/11/2026, maquette C choisie par Will,
   modèle : la vue « Aujourd'hui » de Things 3). Chaque info devient UNE chose à faire.

   Ce fichier ne dessine rien : il écrit les textes simples de chaque info, chaque jour, par des
   RÈGLES selon le type d'info (aucun service d'IA, aucune clé). Il ne dit que ce que les sources
   disent : une durée, un chiffre ou un nom absent du texte d'origine n'est jamais inventé.
     - annonce Bodacc du secteur, selon son motif (vente, tribunal, liquidation, holding, création,
       fermeture, nouveau dirigeant), client ou non ;
     - médicament qui manque (article repris par plusieurs sources, ou nouvelle alerte de l'ANSM) ;
     - baisses de prix du comité des prix (CEPS) au Journal officiel ;
     - nouvelle règle du Journal officiel qui a un résumé et une date d'effet ;
     - rappel de lot qui concerne les officines.
   Une tâche : { id, groupe, etiquette, ton, titre, lieu, quand, pourVous, action, aDire, source, url, vue, pid }.
   `vue` = le panneau de l'écran Infos qui montre tout le reste de ce type (secteur, ruptures, echeances, rappels).
   Cible de qualité : les textes écrits à la main de la maquette
   (~/jarvis-preuves/infos-simple-2026-11-21/maquettes/donnees.js).
   Pur : se charge aussi sous Node (tests/infos-taches.test.mjs).
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];

  function txt(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function cap(s) { s = txt(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return txt(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function voyelle(s) { return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(txt(s)); }

  /* ── dates : `auj` (AAAA-MM-JJ) est passé par l'appelant, pour que les tests sachent la réponse ── */
  function jour(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function ecart(iso, auj) { var a = jour(iso), b = jour(auj); return isNaN(a) || isNaN(b) ? null : Math.round((a - b) / 864e5); }   // > 0 = à venir
  function dc(iso) { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? (+m[2] === 1 ? '1er' : String(+m[2])) + ' ' + MOIS[+m[1] - 1] : ''; }
  function dl(iso) { var c = dc(iso); return c ? c + ' ' + String(iso).slice(0, 4) : ''; }
  function moisDe(iso) { var m = /^\d{4}-(\d{2})/.exec(String(iso || '')); return m ? MOIS[+m[1] - 1] : ''; }
  function quandPasse(iso, auj) {
    var n = ecart(iso, auj); if (n === null) return '';
    n = -n;
    return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : n < 7 ? 'il y a ' + n + ' jours' : n < 14 ? 'il y a 1 semaine' : n < 60 ? 'il y a ' + Math.floor(n / 7) + ' semaines' : dc(iso);
  }
  function quandAvenir(iso, auj) { var n = ecart(iso, auj); return n === null ? '' : n > 1 ? 'dans ' + n + ' jours' : n === 1 ? 'demain' : 'aujourd’hui'; }
  function nombre(n) { return n >= 0 && n <= 10 ? NOMBRES[n] : String(n); }
  // « 20 novembre 2026 » / « 1er décembre 2026 » → 2026-11-20
  function isoDe(j, m, a) { var i = MOIS.indexOf(String(m).toLowerCase()); if (i < 0) return ''; var d = j === '1er' ? 1 : +j; return a + '-' + (i < 9 ? '0' : '') + (i + 1) + '-' + (d < 10 ? '0' : '') + d; }

  /* ── noms : « PHARMACIE DES COMTES DU MAINE » → « Pharmacie des Comtes du Maine » (même règle que sctJoli de v2-infos.js) ── */
  var PETITS = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, sur: 1, en: 1, aux: 1, au: 1 };
  var FORMES = /^(selarl|selas|selafa|selarlu|sarl|snc|spfpl|spfplas|sas|sasu|eurl|sa)$/;
  function joli(s) {
    return txt(s).toLowerCase().split(/(\s+|-)/).map(function (w, i) {
      if (/^\s+$|^-$/.test(w) || !w) return w;
      if (FORMES.test(w)) return w.toUpperCase();
      var m = /^([dl]['’])(.*)$/.exec(w); if (m) return m[1] + m[2].charAt(0).toUpperCase() + m[2].slice(1);
      if (i > 0 && PETITS[w]) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  function sansForme(n) { return txt(n).replace(/^(?:(?:SELARL|SELAS|SELAFA|SELARLU|SARL|SNC|SPFPL|SPFPLAS|SAS|SASU|EURL|SA)\s+)+/, ''); }
  function estPharmacie(n) { return /^(pharmacie|grande pharmacie|officine)\b/i.test(n); }
  function avecLa(n) { return estPharmacie(n) ? 'la ' + n : 'la société ' + n; }                        // « Prendre rendez-vous avec la Pharmacie X »
  function deLa(n) { return estPharmacie(n) ? 'de la ' + n : 'de la société ' + n; }                      // « les officines voisines de la Pharmacie X »
  // « Le Mans » → « du Mans », « Les Sorinières » → « des Sorinières », « Angers » → « d’Angers »
  function deVille(v) {
    v = joli(v);
    if (/^Le /.test(v)) return 'du ' + v.slice(3);
    if (/^Les /.test(v)) return 'des ' + v.slice(4);
    if (/^La /.test(v)) return 'de La ' + v.slice(3);
    return voyelle(v) ? 'd’' + v : 'de ' + v;
  }
  function aVille(v) { v = joli(v); return /^Le /.test(v) ? 'au ' + v.slice(3) : /^Les /.test(v) ? 'aux ' + v.slice(4) : 'à ' + v; }

  /* ════════════════ 1. ANNONCE BODACC DU SECTEUR ════════════════
     e : une ligne de bodacc-secteur.json { id, d, f, nom, ville, cp, dep, detail, url }.
     o : { auj, tag ('client' | 'prospect' | 'hors' | 'reste'), aDire (la phrase « À dire » de sctGeste), pid } */
  function bodacc(e, o) {
    o = o || {};
    var client = o.tag === 'client', nom = joli(sansForme(e.nom)) || joli(e.nom), v = joli(e.ville), detail = txt(e.detail);
    var qui = client ? 'Votre client ' + deVille(v) : 'Une officine ' + deVille(v);
    var t = { etiquette: 'Nouveau dirigeant', ton: 'bleu' };
    switch (e.f) {
      case 'cession':
        t = { etiquette: 'Officine vendue', ton: client ? 'orange' : 'vert', titre: qui + ' change de propriétaire',
          pourVous: client ? 'Le repreneur peut revoir tous ses fournisseurs : il faut le rencontrer avant la concurrence.'
            : 'Le nouveau pharmacien choisit ses fournisseurs dans ses premières semaines : c’est le moment de le rencontrer.',
          action: client ? 'Rencontrer le repreneur ' + deLa(nom) : 'Prendre rendez-vous avec ' + avecLa(nom) };
        break;
      case 'procedure':
        var liq = /liquidation/i.test(detail);
        t = { etiquette: liq ? 'Officine en liquidation' : 'Officine en difficulté', ton: 'orange',
          titre: qui + (liq ? ' est en liquidation' : ' passe devant le tribunal'),
          pourVous: client ? 'Votre client est fragilisé : son encours doit être revu avant la prochaine commande.'
            : liq ? 'Elle va sans doute fermer : ses patients iront chez les officines voisines.'
              : 'Elle est fragilisée : les officines voisines peuvent récupérer une partie de ses patients.',
          action: client ? 'Faire le point sur l’encours avec la direction' : 'Appeler les officines voisines ' + deLa(nom) };
        break;
      case 'creation':
        if (/SPFPL|HOLDING/i.test(e.nom) || /holding/i.test(detail)) {
          t = { etiquette: 'Rachat en préparation', ton: 'bleu', titre: 'Des pharmaciens créent une société de rachat ' + aVille(v),
            pourVous: 'Ce type de société sert à racheter une officine : un rachat se prépare dans votre secteur.',
            action: 'Demander aux officines ' + deVille(v) + ' qui prépare un rachat' };
        } else {
          t = { etiquette: 'Nouvelle officine', ton: 'bleu', titre: 'Une nouvelle société d’officine est créée ' + aVille(v),
            pourVous: 'Une reprise ou une ouverture se prépare : le futur titulaire va choisir ses fournisseurs.',
            action: 'Se présenter à ' + avecLa(nom) };
        }
        break;
      case 'fermeture':
        t = { etiquette: 'Officine qui ferme', ton: 'orange', titre: qui + ' ferme',
          pourVous: client ? 'Votre client ferme : ses commandes vont s’arrêter.' : 'Ses patients vont aller chez les officines voisines : elles vont vendre plus.',
          action: client ? 'Faire le point avec la direction sur ce compte' : 'Appeler les officines voisines ' + deLa(nom) };
        break;
      default:
        t = { etiquette: 'Nouveau dirigeant', ton: 'bleu', titre: qui + ' change de dirigeant',
          pourVous: client ? 'Nouvel interlocuteur chez votre client : il faut se présenter et reprendre le fil.'
            : 'Un nouveau dirigeant peut revoir ses fournisseurs : c’est une occasion de se présenter.',
          action: 'Se présenter au nouveau dirigeant ' + deLa(nom) };
    }
    t.id = 'b-' + norm(e.id || e.nom + '-' + e.d);
    t.groupe = 'secteur';
    t.lieu = (client ? 'Votre client · ' : '') + (estPharmacie(nom) ? nom : joli(e.nom)) + ' · ' + v + (e.dep ? ' (' + e.dep + ')' : '');
    t.quand = quandPasse(e.d, o.auj);
    t.aDire = txt(o.aDire) || t.pourVous;
    t.source = 'Bodacc · annonces légales';
    t.url = e.url || '';
    t.vue = 'secteur';
    t.pid = o.pid || '';
    return t;
  }

  /* les 3 annonces du secteur : un nom une seule fois, les clients d'abord, puis la plus récente ; à date égale, une vente avant une procédure, etc. */
  var RANG_F = { cession: 0, procedure: 1, creation: 2, fermeture: 3, dirigeant: 4 };
  function rangF(f) { return Object.prototype.hasOwnProperty.call(RANG_F, f) ? RANG_F[f] : 5; }
  function secteur(annonces, o) {
    o = o || {};
    var vu = {}, L = [];
    (annonces || []).forEach(function (e) {
      var k = norm(sansForme(e.nom)).slice(0, 18); if (!k || vu[k]) return; vu[k] = 1;
      var tg = o.tag ? o.tag(e) : { t: '' };
      L.push({ e: e, tag: tg.t || '', pid: tg.ficheId || '' });
    });
    L.sort(function (a, b) { return ((a.tag === 'client' ? 0 : 1) - (b.tag === 'client' ? 0 : 1)) || String(b.e.d || '').localeCompare(String(a.e.d || '')) || (rangF(a.e.f) - rangF(b.e.f)); });
    return L.slice(0, o.max || 3).map(function (x) {
      return bodacc(x.e, { auj: o.auj, tag: x.tag, pid: x.pid, aDire: o.geste ? o.geste(x.e, x.tag) : '' });
    });
  }

  /* ════════════════ 2. MÉDICAMENT QUI MANQUE ════════════════ */
  function sourceSimple(s) { s = txt(s); return /^ANSM/i.test(s) ? 'Agence du médicament' : s.split(' · ')[0]; }
  function sources(L) { var vu = {}, out = []; L.forEach(function (s) { s = sourceSimple(s); if (s && !vu[s]) { vu[s] = 1; out.push(s); } }); return out.slice(0, 3).join(' · '); }
  function nbSources(a) {
    var f = (a.faits || []).join(' '), m = /(\d+) sources en parlent/.exec(f);
    return Math.max(m ? +m[1] : 0, +a.n_src || 0, (a.srcs || []).length, 1);
  }
  // « Tensions en furosémide 20 et 40 mg : … » → « furosémide 20 et 40 mg » ; « Rupture de furosémide : … » → « furosémide »
  var RE_MOL = /\b(?:tensions?|ruptures?|p[ée]nuries?|manques?)(?: d[’']approvisionnement)? (?:en|de|d[’']|du|des) ?([a-zà-ÿ]+(?:-[a-zà-ÿ]+)?(?: \d+(?:[,.]\d+)?(?: et \d+(?:[,.]\d+)?)? ?(?:mg|µg|g|ml|ui)\b)?)/i;
  function molecule(t) { var m = RE_MOL.exec(txt(t)); return m && m[1].length > 3 ? m[1].toLowerCase() : ''; }
  function article(n) { return voyelle(n) ? 'L’' : 'Le '; }
  function texte(a) { return [a.t, a.r].concat(a.points || []).join(' '); }

  function manque(arts, o) {   // arts : les articles « rupture » de l'édition qui parlent de la même molécule, le plus repris d'abord
    o = o || {};
    var a = arts[0], mol = molecule(a.t), base = mol.split(' ')[0], tout = arts.map(texte).join(' ');
    var prep = /pr[ée]parations? magistrales?/i.test(tout) && /rembours/i.test(tout);
    var Le = article(mol);
    return {
      id: 'm-' + norm(base), groupe: 'france', etiquette: 'Médicament qui manque', ton: 'rouge',
      titre: Le + mol + ' manque',
      lieu: 'Toutes les officines', quand: dc(a.d),
      pourVous: prep ? 'Les officines vont en manquer. L’Agence du médicament autorise à le remplacer par des préparations faites en pharmacie, remboursées.'
        : 'Les officines vont en manquer : leurs patients vont demander une solution.',
      action: prep ? 'Prévenir vos officines : préparations de ' + base + ' autorisées et remboursées'
        : 'Aider vos officines à sécuriser leur stock de ' + base,
      aDire: prep ? Le + base + ' manque : les préparations en officine sont autorisées et remboursées.'
        : Le + base + ' manque : pensez à sécuriser votre stock.',
      source: sources([].concat.apply([], arts.map(function (x) { return x.srcs && x.srcs.length ? x.srcs : [x.s]; }))),
      url: a.u || '', vue: 'ruptures', pid: ''
    };
  }

  // une nouvelle alerte de l'ANSM : seulement un produit de ville, en rupture ou en tension
  function hospitalier(spec) { return /perfusion|à diluer|poudre et solvant|usage hospitalier|réservé à l.usage/i.test(spec); }
  function nomCourt(s) { return txt(String(s || '').split(/ – | - /)[0].split(',')[0].replace(/\s*\[[^\]]*\]/g, '')); }
  function rupture(r, o) {
    o = o || {};
    var nom = nomCourt(r.spec || r.dci), marque = nom.split(' ')[0], rup = /rupture/i.test(r.st), Le = article(nom), sub = !!+r.subst;
    var etat = rup ? ' est en rupture' : ' est difficile à obtenir';
    return {
      id: 'a-' + norm(nom), groupe: 'france', etiquette: 'Médicament qui manque', ton: 'rouge',
      titre: Le + nom + etat, lieu: 'Toutes les officines', quand: quandPasse(r.since, o.auj),
      pourVous: sub ? 'Une autre solution existe : vos officines peuvent la proposer à leurs patients.'
        : 'Il n’y a pas de remplacement simple : les patients iront chez l’officine qui en a.',
      action: sub ? 'Rappeler à vos officines qu’une solution de remplacement existe' : 'Aider vos officines à sécuriser leur stock de ' + marque,
      aDire: Le + marque + etat + (sub ? ' : une solution de remplacement existe.' : ' : sécurisez votre stock dès qu’il revient.'),
      source: 'Agence du médicament', url: 'https://ansm.sante.fr/disponibilites-des-produits-de-sante', vue: 'ruptures', pid: ''
    };
  }

  /* ════════════════ 3. BAISSES DE PRIX (CEPS, Journal officiel) ════════════════
     Titre écrit par generate_brief.py (titre_baisses) : « 5 baisses de prix publiées au Journal officiel,
     applicables à partir du 20 novembre 2026 ; 82 autres au 2 janvier 2027 » (ou « … entre le X et le Y »). */
  var RE_B1 = /(\d+) baisses? de prix .*?à partir du (1er|\d{1,2}) ([a-zéû]+) (\d{4})/i;
  var RE_B2 = /; (\d+) autres? (?:au|entre le) (1er|\d{1,2}) ([a-zéû]+) (\d{4})/i;
  function prix(e, o) {
    o = o || {};
    var t = txt(e.t), m1 = RE_B1.exec(t); if (!m1) return null;
    var m2 = RE_B2.exec(t), auj = o.auj;
    var b1 = { n: +m1[1], d: isoDe(m1[2], m1[3], m1[4]) }, b2 = m2 ? { n: +m2[1], d: isoDe(m2[2], m2[3], m2[4]) } : null;
    // le produit cité en premier : « MEDIKINET 10MG LM GELU BT28, … » → « Medikinet »
    var prod = /\b([A-Z][A-Z-]{3,})\s+\d/.exec(String(e.r || '')), marque = prod ? cap(prod[1].toLowerCase()) : '';
    var princ = b2 && ecart(b2.d, auj) > 0 ? b2 : b1, autre = princ === b2 ? b1 : null;
    var avenir = ecart(princ.d, auj) > 0, pl = princ.n > 1;
    var quandStock = +princ.d.slice(8, 10) <= 7 ? 'en ' + MOIS[(MOIS.indexOf(moisDe(princ.d)) + 11) % 12] : 'd’ici au ' + dc(princ.d);
    var p = {
      id: 'p-' + princ.d, groupe: 'france', etiquette: 'Prix qui baissent', ton: 'orange',
      titre: princ.n + (pl ? ' médicaments baissent' : ' médicament baisse') + ' de prix ' + (avenir ? 'le ' + dc(princ.d) : ecart(princ.d, auj) === 0 ? 'aujourd’hui' : 'depuis le ' + dc(princ.d)),
      lieu: 'Toutes les officines', quand: e.d ? 'publié le ' + dc(e.d) : '',
      source: 'Journal officiel · comité des prix (CEPS)', url: e.u || '', vue: 'echeances', pid: ''
    };
    if (avenir) {
      p.pourVous = 'Les boîtes en stock vaudront moins après le ' + dc(princ.d) + '.' +
        (autre ? ' ' + cap(nombre(autre.n)) + (autre.n > 1 ? ' baissent' : ' baisse') + (ecart(autre.d, auj) > 0 ? ' le ' : ' déjà depuis le ') + dc(autre.d) + (marque ? ', dont le ' + marque : '') + '.' : '');
      p.action = 'Conseiller de ne pas trop stocker ces produits ' + quandStock;
      p.aDire = princ.n + (pl ? ' baisses' : ' baisse') + ' de prix le ' + dc(princ.d) + ' : évitez de trop stocker ces produits ' + quandStock + '.';
    } else {
      p.pourVous = 'Les boîtes en stock valent moins depuis le ' + dc(princ.d) + (marque ? ', dont le ' + marque : '') + '.';
      p.action = 'Prévenir vos officines que leurs boîtes en stock valent moins';
      p.aDire = princ.n + (pl ? ' baisses' : ' baisse') + ' de prix depuis le ' + dc(princ.d) + ' : vos boîtes en stock valent moins.';
    }
    return p;
  }

  /* ════════════════ 4. NOUVELLE RÈGLE DU JOURNAL OFFICIEL ════════════════
     e : une échéance épinglée (motif « echeance », source Journal officiel) qui a un résumé (`r`) et une date d'effet (`effet`). */
  function regle(e, o) {
    o = o || {};
    var res = txt(e.r).replace(/\bminimum\b/g, 'au moins').replace(/\bplafond\b/g, 'au plus'), marge = /marge (des )?grossiste|répartit/i.test(e.r);
    if (res && !/[.!?]$/.test(res)) res += '.';
    return {
      id: 'r-' + norm(e.u || e.t).slice(-40), groupe: 'france', etiquette: 'Nouvelle règle', ton: 'bleu',
      titre: marge ? 'La marge des grossistes change le ' + dc(e.effet) : 'Une nouvelle règle s’applique le ' + dc(e.effet),
      lieu: 'Toutes les officines', quand: quandAvenir(e.effet, o.auj),
      pourVous: res + (marge ? ' Vos pharmaciens vont vous en parler.' : ''),
      action: marge ? 'Relire le nouveau barème avant les rendez-vous de ' + moisDe(e.effet) : 'Lire le texte avant le ' + dc(e.effet),
      aDire: marge ? 'Le nouveau barème de la marge grossiste s’applique le ' + dl(e.effet) + '.' : txt(e.r),
      source: 'Journal officiel', url: e.u || '', vue: 'echeances', pid: ''
    };
  }

  /* ════════════════ 5. RAPPEL DE LOT ════════════════
     Seulement s'il touche les officines (choix de Will, 25/11/2026, « Chez nous ou officines ») : le produit est dans notre catalogue
     ou notre stock (cat / stk, posés par generate_rappels_lots.py), ou l'Agence nomme les officines dans le niveau de rappel.
     Un produit d'hôpital qu'on ne vend pas (lot Z011, albumine iodée [125I], prévenu « en direct auprès des clients ») ne monte pas. */
  function pourOfficines(r) { return !!((r.cat && r.cat.length) || (r.stk && r.stk.length)) || /officine|pharmacie/i.test(txt(r.niv)); }
  function rappel(r, o) {
    o = o || {};
    var nom = nomCourt(r.t), lots = r.lots || [], un = lots.length === 1 && lots[0].n;
    return {
      id: 'l-' + norm(nom + '-' + (un || r.d)), groupe: 'france', etiquette: 'Lot rappelé', ton: 'rouge',
      titre: un ? 'Un lot de ' + nom + ' est rappelé' : 'Des lots de ' + nom + ' sont rappelés',
      lieu: 'Toutes les officines', quand: quandPasse(r.d, o.auj),
      pourVous: 'Ces boîtes doivent sortir des rayons : vos officines doivent vérifier leur stock.',
      action: 'Prévenir vos officines de vérifier ' + (un ? 'le lot ' + un : 'les lots rappelés'),
      aDire: un ? 'Le lot ' + un + ' de ' + nom + ' est rappelé : à retirer du stock.' : 'Des lots de ' + nom + ' sont rappelés : à retirer du stock.',
      source: 'Agence du médicament', url: r.url || '', vue: 'rappels', pid: ''
    };
  }

  /* ════════════════ « EN FRANCE » : 3 au plus, une par type, la plus utile d'abord ════════════════
     Ordre : rappel de lot pour les officines (7 jours) · médicament qui manque repris par 2 sources ou plus ·
     baisses de prix · règle sur la marge des grossistes (120 jours) · nouvelle alerte de rupture · autre règle. */
  function france(B, o) {
    o = o || {};
    var auj = o.auj, C = [];
    function poser(score, type, t) { if (t) C.push({ s: score, type: type, t: t }); }
    (B.rappels_lots || []).filter(function (r) { var n = ecart(r.d, auj); return pourOfficines(r) && n !== null && n >= -7; })
      .slice(0, 1).forEach(function (r) { poser(1, 'rappel', rappel(r, o)); });
    // médicament qui manque : les articles qui nomment une molécule (« Tensions en X », « Rupture de X »), regroupés par molécule ;
    // un groupe compte seulement si l'un de ses articles est rangé « rupture » par le robot (« Rupture de contrat » n'est pas un médicament)
    var arts = (B.cinq || []).concat(B.fil || []).filter(function (a) { return molecule(a.t); }), parMol = {};
    arts.forEach(function (a) { var k = norm(molecule(a.t).split(' ')[0]); (parMol[k] = parMol[k] || []).push(a); });
    var mols = Object.keys(parMol).map(function (k) {
      var L = parMol[k].slice().sort(function (a, b) { return nbSources(b) - nbSources(a); });
      return { L: L, n: L.reduce(function (s, a) { return s + nbSources(a); }, 0) };
    }).filter(function (m) { return m.n >= 2 && m.L.some(function (a) { return a.theme === 'rupture'; }); }).sort(function (a, b) { return b.n - a.n; });
    if (mols.length) poser(2, 'manque', manque(mols[0].L, o));
    var bp = [B.une].concat(B.cinq || [], B.epingles || []).filter(function (e) { return e && RE_B1.test(txt(e.t)); })
      .sort(function (a, b) { return txt(b.t).length - txt(a.t).length; })[0];
    if (bp) poser(3, 'prix', prix(bp, o));
    var regles = (B.epingles || []).filter(function (e) {
      var n = ecart(e.effet, auj);
      return e.motif === 'echeance' && /journal officiel/i.test(e.s) && !/CEPS/i.test(e.s) && txt(e.r).length > 20 && n !== null && n >= 0 && n <= 120;
    }).sort(function (a, b) { return ecart(a.effet, auj) - ecart(b.effet, auj); });
    var rm = regles.filter(function (e) { return /marge (des )?grossiste|répartit/i.test(e.r); })[0];
    if (rm) poser(4, 'regle', regle(rm, o));
    var rv = (B.ruptures_neuves || []).filter(function (r) { return /rupture|tension/i.test(r.st) && !hospitalier(r.spec); })[0];
    if (rv && !mols.length) poser(5, 'manque', rupture(rv, o));
    var ra = regles.filter(function (e) { return e !== rm; })[0];
    if (ra && !rm) poser(6, 'regle', regle(ra, o));
    C.sort(function (a, b) { return a.s - b.s; });
    var vus = {}, out = [];
    C.forEach(function (c) { if (out.length < (o.max || 3) && !vus[c.type]) { vus[c.type] = 1; out.push(c.t); } });
    return out;
  }

  var M = { bodacc: bodacc, secteur: secteur, manque: manque, rupture: rupture, prix: prix, regle: regle, rappel: rappel, france: france,
    _: { joli: joli, deVille: deVille, aVille: aVille, molecule: molecule, dc: dc, quandPasse: quandPasse, quandAvenir: quandAvenir, hospitalier: hospitalier, pourOfficines: pourOfficines } };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else { root.V2 = root.V2 || {}; root.V2.infosTaches = M; }
})(typeof window !== 'undefined' ? window : this);
