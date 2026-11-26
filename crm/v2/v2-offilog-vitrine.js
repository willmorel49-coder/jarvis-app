/* ═══════════════════════════════════════════════════════
   V2 · OFFILOG — « Le catalogue Offilog » (maquette A « La vitrine », choisie par Will)
   Un catalogue de 100, 200 ou 300 produits, à voir, imprimer ou envoyer par mail (PDF fabriqué dans le navigateur).
   TOUT vient de ce que l'écran Offilog a déjà chargé (V2.offilogItems) : classement du dernier relevé, prix Offilog,
   tarif laboratoire, rayon, photo. Rien de confidentiel n'est écrit ici ; aucune date, édition, nombre de pages ou
   de marques n'est écrit en dur : tout se calcule à l'ouverture.
   Rendu : une iframe (srcdoc) qui reçoit la feuille v2-offilog-vitrine.css (celle de la maquette) sans toucher au CRM.
   API : V2.offVitrine(n) · V2.offVitrineDonnees(n) et V2.offVitrineHtml(n) (sans écran, lues par les tests) ·
         V2.offVitrineImprimer(n) · V2.offVitrinePdf(n) (télécharger) · V2.offVitrineMail(n) · V2.offVitrinePanneau() (la porte de l'écran Offilog).
   Chargé par le CRM seulement (absent de l'app OPSO). Rien au chargement ne touche à la fenêtre : tout est paresseux.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2;

  // Où est ce fichier : sert à retrouver la feuille de style et le logo (même dossier, même jeton ?v=).
  var BASE = '', JETON = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) { BASE = cs.src.replace(/[?#].*$/, '').replace(/[^/]+$/, ''); JETON = (cs.src.match(/\?[^#]*/) || [''])[0]; }
  } catch (e) {}

  var CHOIX = [100, 200, 300];
  var NOUV_RANG_MAX = 1500;           // une nouveauté doit être classée dans les 1 500 premiers de la liste
  var NOUV_PETIT = 8, NOUV_GRAND = 12; // 8 nouveautés à 100 produits, 12 à 200 et 300
  var choix = 100;

  // ── Petits outils d'écriture ───────────────────────
  var NB = ' ', MOINS = '−';
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fr(x, d) { return x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, NB); }
  function eur(x) { return fr(x, 2) + NB + '€'; }
  function ent(x) { return x.toLocaleString('fr-FR').replace(/[  ]/g, NB); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Date écrite en français depuis une date ISO des données (jamais une date écrite ici).
  function dl(iso, an) {
    if (!iso || String(iso).length < 10) return '';
    var o = { day: 'numeric', month: 'long', timeZone: 'UTC' };
    if (an) o.year = 'numeric';
    return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-FR', o);
  }
  function cle(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function norm(s) { return cle(s).replace(/[^a-z0-9]/g, ''); }
  function estMaj(s) { return s === s.toUpperCase() && s !== s.toLowerCase(); }   // « isupper » : des majuscules et aucune minuscule
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
  function haut1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Marque et nom : portage de marque_nom (catalogue PDF de l'atelier) ───────────
  // OFFILOG_BEST écrit « MARQUE – produit » : le préfixe est retiré du nom s'il répète la marque, gardé s'il nomme une gamme.
  var MARQUES_BRUTES = { 'LA ROCHE-POSAY': 'La Roche-Posay', 'PIERRE FABRE...': 'Pierre Fabre', 'AVENE': 'Avène', 'A-DERMA': 'A-Derma' };
  var MARQUES_COMPLETES = { 'BAYER SANTE...': 'Bayer Santé', 'LE COMPTOIR...': 'Le Comptoir du Bain', 'LES PETITES...': 'Les Petites Choses',
    'Jouvence de...': 'Jouvence de l’Abbé Soury', 'Jolly Jatel...': 'Jolly Jatel' };
  var GRAPHIE = { 'Bausch&lomb': 'Bausch + Lomb', 'Cavailles': 'Cavaillès', 'Eau Precieuse': 'Eau Précieuse', 'Fabre Sante': 'Fabre Santé',
    "Flect'expert": "Flect'Expert", 'LA Rosée': 'La Rosée', 'Luc ET Léa': 'Luc et Léa', 'Les 3 Chenes': 'Les 3 Chênes',
    'Nestle': 'Nestlé', 'ROC': 'RoC', 'Cb12': 'CB12', 'Onetouch': 'OneTouch', '8mel+': '8MEL+',
    'Pileje': 'PiLeJe', 'Accu-fine': 'Accu-Fine', 'Biogaia': 'BioGaia', 'Cinq Sur Cinq': 'Cinq sur Cinq', 'Thermacare': 'ThermaCare',
    'Ialusetcare': 'IalusetCare', 'Forté Pharma': 'Forté Pharma', 'Voltanura': 'VoltaNatura', 'Upsa': 'UPSA', 'Waterwipes': 'WaterWipes' };
  var PREFIXE_LABO = { '3C Pharma': 1, 'BAUSCH&LOMB': 1, 'Haleon': 1, 'Iprad': 1, 'Majorelle': 1, 'UPSA': 1 };
  var PREFIXE_PRODUIT = { 'Collagène': 1, 'Ialusetpro Family': 1 };
  var PREFIXE_MARQUE = {
    'AKILEINE': 'Akileïne', 'Akileine': 'Akileïne', 'AKILEÏNE': 'Akileïne', 'SPORTS AKILEINE': ['Akileïne', 'Sports'],
    'ALVITYL': 'Alvityl', 'AMILAB': 'Amilab', 'Arkogégules': 'Arkogélules', 'AUDISPRAY': 'Audispray',
    'AUREOCYDE': 'Aureocyde', 'Bach': 'Fleurs de Bach Original',
    'Confiance - Lady 2 Gouttes - Protections anatomiques femmes': ['Confiance', 'Lady 2 Gouttes - Protections anatomiques femmes'],
    'COUP D’ECLAT': 'Coup d’Éclat', 'Coup D’Eclat': 'Coup d’Éclat', 'Duo LP PRO': 'Duo LP-Pro', 'ETIAXIL': 'Etiaxil',
    'HYALUGEL': 'Hyalugel', 'Laboratoires Élerte': 'Élerte', 'MAG 2': 'Mag 2', 'MARIMER': 'Marimer', 'Modialc': 'Modilac',
    'Mölnylycke': 'Mölnlycke', 'NEUTRADERM': 'Neutraderm', 'PARASIDOSE': 'Parasidose', 'Perles De Peau': 'Perles de Peau',
    'Physiolac Bio': 'Physiolac', 'POUXIT': 'Pouxit', 'Probilog': 'Probiolog',
    'RHINOSEDAL': 'Rhinosedal', 'RHINOVITA': 'Rhinovita', 'SEPTIMYL': 'Septimyl', 'TAIDO': 'Taïdo',
    'VALDISPERT': 'Valdispert', 'Vitacitral': 'Vita Citral' };
  var LABOS_A_MARQUES = { 'bauschlomb': 1, 'upsa': 1 };
  var MARQUES_DU_LABO = {
    'Aqualarm': 'Aqualarm', 'Bio True': 'Biotrue', 'Biotrue': 'Biotrue', 'Bloxaphte': 'Bloxaphte', 'Boxaphte': 'Bloxaphte',
    'Ceruspray': 'Ceruspray', 'C’Zen': 'C’Zen', 'Désosept': 'Désosept', 'Hyarhinol': 'Hyarhinol', 'Preservision': 'Preservision',
    'Renu': 'Renu', 'Sensioptic': 'Sensioptic', 'Thermcool': 'Thermcool',
    'Hydrafizz': 'Hydrafizz', 'Hydrafrizz': 'Hydrafizz', 'PeptiFort': 'PeptiFort', 'Phytonormyl': 'Phytonormyl',
    'Phytovex': 'Phytovex', 'Sérélyspharma': 'Sérélyspharma' };

  // Scories du relevé : « Marque – - Libellé », un point ou un tiret en tête, une espace avant la virgule.
  function nettoyer(n) {
    n = String(n || '').replace(/\s+/g, ' ').trim();
    n = n.replace(/(–)\s*[-–]\s*/g, '$1 ').replace(/\s+([,;])/g, '$1');
    return n.replace(/^[.\-– ]+/, '').trim();
  }
  function marqueBrute(m) {
    m = String(m || '').trim();
    if (has(MARQUES_BRUTES, m)) return MARQUES_BRUTES[m];
    if (estMaj(m) && m.length > 3) return m.split(' ').map(function (w) { return w.length > 2 ? cap(w) : w; }).join(' ').replace('Gum', 'GUM').replace('Mam', 'MAM');
    return m || 'Autres marques';
  }
  function marqueNom0(nomBrut, brut) {
    var nom = String(nomBrut || '').trim();
    var m = /^(.*?)\s+–\s*(.+)$/.exec(nom) || /^(.*?)\s+-\s+(.+)$/.exec(nom);
    var pre = m ? m[1].trim() : '', rest = m ? m[2].trim() : nom;
    brut = String(brut || '').trim();
    var mq;
    if (has(MARQUES_COMPLETES, brut)) mq = MARQUES_COMPLETES[brut];
    else if (brut) mq = marqueBrute(brut);
    else if (pre) mq = (estMaj(pre) && pre.length > 3) ? pre.split(' ').map(cap).join(' ') : pre;
    else mq = 'Autres marques';
    if (has(GRAPHIE, mq)) mq = GRAPHIE[mq];
    var np = norm(pre), nm = norm(mq);
    var proche = np.indexOf(nm) >= 0 || nm.indexOf(np) >= 0;
    var nomOut;
    if (pre && !has(PREFIXE_PRODUIT, pre) && (has(PREFIXE_MARQUE, pre) || !proche)) {
      var garde = '', laboPre = has(PREFIXE_LABO, pre);
      if (!laboPre) {
        var v = has(PREFIXE_MARQUE, pre) ? PREFIXE_MARQUE[pre] : pre;
        if (Array.isArray(v)) { mq = v[0]; garde = v[1]; } else { mq = v; garde = ''; }
        if (has(GRAPHIE, mq)) mq = GRAPHIE[mq];
        if (rest.indexOf(mq + ' ') === 0) rest = rest.slice(mq.length + 1);
      }
      nomOut = (garde ? garde + ' – ' + rest : rest).replace(/^[ \-–·]+/, '');
      return [mq, haut1(nomOut), !laboPre];
    }
    if (pre && proche) nomOut = rest;
    else if (pre) nomOut = pre + ' – ' + rest;
    else nomOut = rest;
    return [mq, haut1(nomOut.replace(/^[ \-–·]+/, '')), false];
  }
  // gammes : marques reconnues par le préfixe d'au moins un libellé de la liste (Arkogélules, Confiance…)
  function gammesDe(liste) {
    var G = {};
    liste.forEach(function (p) { var r = marqueNom0(p.nom, p.marque); if (r[2]) G[norm(r[0])] = r[0]; });
    return G;
  }
  function marqueNom(p, G) {
    var r = marqueNom0(p.nom, p.marque), mq = r[0], nm = r[1];
    var m = /^(.*?)\s+[–-]\s/.exec(String(p.nom || '').trim());
    var i, k, mots, b, reste;
    if (m && has(LABOS_A_MARQUES, norm(m[1]))) {
      mots = nm.split(' ');
      for (i = 0; i < 2; i++) {
        k = 2 - i;
        b = MARQUES_DU_LABO[mots.slice(0, k).join(' ')];
        reste = mots.slice(k).join(' ').replace(/^[ \-–·,]+/, '');
        if (b && reste) return { marque: b, nom: haut1(reste) };
      }
    }
    if (!r[2]) {
      mots = nm.split(' ');
      for (i = 0; i < 3; i++) {
        k = 3 - i;
        b = G[norm(mots.slice(0, k).join(' '))];
        reste = mots.slice(k).join(' ').replace(/^[ \-–·,]+/, '');
        if (b && b !== mq && reste) return { marque: b, nom: haut1(reste) };
      }
    }
    return { marque: mq, nom: nm };
  }

  // ── Rayons : cinq grands rayons (même regroupement que la maquette) ───────────
  var GROUPES = [
    { id: 'beaute', t: 't-beaute', nom: 'Beauté & soins', r: ['Beauté & Soins', 'Soins du visage', 'Soins du corps', 'Autres soins', 'Solaire adulte', 'Solaire préparation', 'Après-soleil'] },
    { id: 'sante', t: 't-sante', nom: 'Santé', r: ['Santé', 'Inconfort', 'Compléments alimentaires', 'Aide Minceur', 'Soins Oreilles & Nez', 'Vision & Yeux', 'Premiers soins'] },
    { id: 'hygiene', t: 't-hygiene', nom: 'Hygiène', r: ['Hygiène', 'Hygiène intime', 'Hygiène bucco-dentaire', 'Douches & Bains', 'Déodorants', 'Épilation & Rasage'] },
    { id: 'bebe', t: 't-bebe', nom: 'Bébé & maman', r: ['Bébé', 'Changes de bébés', 'Puériculture', 'Grossesse & Maternité'] },
    { id: 'autres', t: 't-autres', nom: 'Autres rayons', r: null }
  ];
  function groupeDe(rayon) {
    for (var i = 0; i < GROUPES.length - 1; i++) if (GROUPES[i].r.indexOf(rayon) >= 0) return GROUPES[i];
    return GROUPES[GROUPES.length - 1];
  }

  // ── Les données : lues dans les produits de l'écran, sans écran (testable) ──────
  // Un produit entre dans le catalogue s'il a un rang au DERNIER relevé du marché, un prix Offilog et un code à 13 chiffres.
  // Le rang affiché est la position dans la liste (1, 2, 3…), jamais un rang brut de l'historique.
  // Marques exclues : liste PRIVÉE (fichier protégé `offilogexclus`, jamais dans le dépôt). Sans elle valide, le catalogue reste FERMÉ.
  function exclusValides() {
    var X = window.OFFILOG_EXCLUS;
    return !!(X && typeof X === 'object' && Array.isArray(X.marques) && X.marques.length && Array.isArray(X.eans) && Array.isArray(X.prefixes));
  }
  function setDe(a) { var o = {}; (a || []).forEach(function (v) { o[String(v).toLowerCase()] = 1; }); return o; }
  // Préfixe du libellé brut « MARQUE – produit » (équivalent de la règle de l'atelier), en minuscules.
  function prefixeDe(nom) { var m = /^(.*?)\s+[–-]\s/.exec(String(nom || '').trim()); return m ? m[1].trim().toLowerCase() : ''; }
  function estExclu(it, X) {
    if (X.eans[String(it.ean)] || (X.prefixes[prefixeDe(it.name)] && prefixeDe(it.name))) return true;
    var t = (String(it.brand || '') + ' ' + String(it.name || '')).toLowerCase(), b = String(it.brand || '').trim().toLowerCase();
    return X.liste.some(function (m) { return m && (t.indexOf(m) >= 0 || b === m); });
  }
  function lireItems(frais) { return (V2 && V2.offilogItems ? V2.offilogItems(!!frais) : []) || []; }
  function candidats(items, X) {
    var vus = {}, L = [];
    items.forEach(function (it) {
      var e = String(it.ean || '');
      if (estExclu(it, X)) return;   // retiré AVANT le classement : les positions 1..N se recalculent sans trou
      if (!it.mkt || it.mkt.sorti || !(it.mkt.rang > 0) || !(it.price > 0) || !/^\d{13}$/.test(e) || vus[e]) return;
      vus[e] = 1; L.push(it);
    });
    // tri stable : à rang égal, l'ordre de l'écran
    return L.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) { return (a.it.mkt.rang - b.it.mkt.rang) || (a.i - b.i); })
      .map(function (x, j) { return { it: x.it, pos: j + 1 }; });
  }
  // Tarif laboratoire : exactement ce que montre l'écran (tarif connu, non douteux, Offilog 1 % à 70 % dessous) ; sinon rien.
  function tarifDe(it) {
    if (it.pcat && !it.pcatVerif && it.pcatRatio > 0 && it.pcatRatio <= 0.70 && it.pcat.prix > 0) {
      var p = Math.round(it.pcatRatio * 100);
      if (p >= 1) return { tarif: it.pcat.prix, pct: p };
    }
    return { tarif: null, pct: null };
  }
  // Nouveauté : absente du classement au PREMIER relevé, classée au dernier, dans les premiers de notre liste.
  function nouveauDe(it) {
    var s = it.mkt && it.mkt.serie;
    if (!s || !s.length || s[0] > 0) return null;
    var i0 = -1, i;
    for (i = 0; i < s.length; i++) if (s[i] > 0) { i0 = i; break; }
    if (i0 < 0) return null;
    return { entree: (it.mkt.dates || [])[i0] || '', rangs: s.slice() };
  }
  // Nouveautés transmises par le robot des prix du lundi (fichier protégé `offilognouv`, window.OFFILOG_NOUVEAUTES) : la liste de
  // l'écran date du PREMIER relevé, elle ne peut donc contenir aucune nouveauté. Le robot calcule le rang avec la règle du
  // marché (comparable à mkt.rang). Ignorées si leur relevé de référence n'est pas le premier relevé du marché chargé.
  // La liste des marques à retirer s'applique à elles comme aux autres (candidats). Pas de tarif labo : l'écran ne les montre pas.
  function itemsRobot() {
    var N = window.OFFILOG_NOUVEAUTES, M = window.OFFILOG_MARCHE;
    if (!N || !Array.isArray(N.items) || !Array.isArray(N.dates) || !N.dates.length || N.dates[0] !== N.premier) return [];
    if (!M || !Array.isArray(M.releves) || !M.releves.length || N.premier !== M.releves[0]) return [];
    var C = window.OFFILOG_CATS || {};
    return N.items.filter(function (f) {
      return f && /^\d{13}$/.test(String(f.ean)) && f.prix > 0 && f.rang > 0 && Array.isArray(f.rangs) && f.rangs.length === N.dates.length;
    }).map(function (f) {
      return { id: String(f.id), ean: String(f.ean), name: String(f.nom || ''), brand: String(f.marque || ''), price: +f.prix,
        sousRayon: C[String(f.id)] || '', mkt: { rang: +f.rang, serie: f.rangs.slice(), dates: N.dates.slice(), sorti: false } };
    });
  }
  // Photo : détourage WebP si l'EAN figure à l'index (oimg-cut/), sinon le JPEG à fond blanc (oimg/), sinon rien (vignette au nom de la marque).
  // On ne demande JAMAIS un WebP que l'index n'annonce pas.
  function indexCut() {
    var A = window.OFFILOG_CUT, o = {};
    if (Array.isArray(A)) A.forEach(function (e) { o[String(e)] = 1; });
    return o;
  }
  function photoDe(it, cut) {
    if (cut && cut[String(it.ean)]) return { src: BASE + 'oimg-cut/' + String(it.ean) + '.webp', type: 'webp' };
    var M = window.OFFILOG_IMG;
    var v = M && it.id != null ? M[String(it.id)] : null;
    return typeof v === 'string' && v ? { src: v, type: 'jpg' } : { src: '', type: '' };
  }
  // frais : reconstruire la liste de l'écran (des fichiers viennent d'arriver)
  function donnees(n, frais) {
    n = CHOIX.indexOf(+n) >= 0 ? +n : choix;
    var M = window.OFFILOG_MARCHE || {}, rel = M.releves || [];
    var C = window.OFFILOG_CATALOGUE;
    var base = { n: n, produits: [], nouveautes: [], reste: [], releves: rel.slice(), classement_du: rel.length ? rel[rel.length - 1] : (M.maj || ''),
      prix_du: (C && C.maj) ? String(C.maj) : '', nb_marques: 0, avec_tarif: 0, sans_photo: 0, avec_webp: 0, avec_jpg: 0, disponibles: 0, exclus_absent: false };
    // FERMÉ PAR DÉFAUT : sans la liste des marques à retirer, aucun produit.
    if (!exclusValides()) { base.exclus_absent = true; return base; }
    var XS = window.OFFILOG_EXCLUS;
    var X = { eans: setDe(XS.eans), prefixes: setDe(XS.prefixes), liste: XS.marques.map(function (m) { return String(m).trim().toLowerCase(); }).filter(Boolean) };
    var cut = indexCut();
    var L = candidats(lireItems(frais).concat(itemsRobot()), X);   // à EAN égal, la fiche de l'écran passe la première
    var G = gammesDe(L.map(function (x) { return { nom: nettoyer(x.it.name), marque: x.it.brand }; }));
    function fiche(x) {
      var it = x.it, mn = marqueNom({ nom: nettoyer(it.name), marque: it.brand }, G), t = tarifDe(it), nv = nouveauDe(it), ph = photoDe(it, cut);
      return { ean: String(it.ean), id: it.id, pos: x.pos, marque: mn.marque, nom: mn.nom, rayon: it.sousRayon || 'Autres soins',
        prix: it.price, tarif: t.tarif, pct: t.pct, photo: ph.src, photo_type: ph.type, _nv: nv };
    }
    var k = n >= 200 ? NOUV_GRAND : NOUV_PETIT;
    var nouv = [], i, f;
    for (i = 0; i < L.length && nouv.length < k; i++) {
      if (L[i].pos > NOUV_RANG_MAX) break;
      f = fiche(L[i]);
      if (f._nv) nouv.push(f);
    }
    var pris = {};
    nouv.forEach(function (p) { pris[p.ean] = 1; });
    var reste = [];
    for (i = 0; i < L.length && reste.length < n - nouv.length; i++) if (!pris[String(L[i].it.ean)]) reste.push(fiche(L[i]));
    var tous = nouv.concat(reste).sort(function (a, b) { return a.pos - b.pos; });
    tous.forEach(function (p, j) { p.rang = j + 1; });
    nouv.forEach(function (p) {
      var s = p._nv.rangs, a = null, b = null, j;
      for (j = 0; j < s.length; j++) if (s[j] > 0) { if (a === null) a = j; b = j; }
      // phrase : apparition au relevé d'entrée, places gagnées depuis (premier rang connu moins dernier, si positif) ; aucun rang brut n'est cité
      p.entree = p._nv.entree;
      p.gain = (a !== null && s[a] > s[b]) ? s[a] - s[b] : 0;
    });
    tous.forEach(function (p) { delete p._nv; });
    nouv.sort(function (a, b) { return a.pos - b.pos; });
    var marques = {};
    tous.forEach(function (p) { marques[p.marque] = 1; });
    // seule date de prix lisible dans l'app : celle du fichier du catalogue client (prix Offilog relevés le…). Absente : on n'en écrit pas.
    base.produits = tous; base.nouveautes = nouv; base.reste = reste;
    base.nb_marques = Object.keys(marques).length;
    base.avec_tarif = tous.filter(function (p) { return p.tarif > 0; }).length;
    base.sans_photo = tous.filter(function (p) { return !p.photo; }).length;
    base.avec_webp = tous.filter(function (p) { return p.photo_type === 'webp'; }).length;
    base.avec_jpg = tous.filter(function (p) { return p.photo_type === 'jpg'; }).length;
    base.disponibles = L.length;
    return base;
  }

  // Réglage unique : seuil de commande pour la livraison, annoncé en dernière page (à changer ICI, jamais dans la phrase).
  var LIVRAISON_DES_EUROS = 300;

  // ── Les pages (portage de la maquette ; seule la source des données change) ──────
  function construire(D) {
    var pageNo = 1, marquesPages = {};
    var LOGO = BASE + 'logos/offilog.png';
    // « Prix HT au 16 novembre 2026 » : la date vient des données ; sans date de prix connue, on écrit « Prix HT » tout court.
    var prixHt = D.prix_du ? 'Prix HT au ' + dl(D.prix_du, true) : 'Prix HT';
    function note(p) { (marquesPages[p.marque] = marquesPages[p.marque] || []); if (marquesPages[p.marque].indexOf(pageNo) < 0) marquesPages[p.marque].push(pageNo); }
    function theme(p) { return groupeDe(p.rayon).t; }
    function ecart(p) {
      if (p.pct == null || p.tarif == null) return '';
      return '<div class="ecart"><b>' + MOINS + ent(p.pct) + ' %</b><span>tarif labo ' + eur(p.tarif) + '</span></div>';
    }
    function img(p, alt) { return '<img class="' + (p.photo_type === 'webp' ? 'dc' : 'jp') + '" src="' + esc(p.photo) + '" alt="' + esc(alt == null ? p.marque + ' ' + p.nom : alt) + '">'; }

    function fiche(p) {
      note(p);
      var st = p.photo ? '<i class="sk"></i><i class="ct"></i>' + img(p) : '<div class="vig">' + esc(p.marque) + '</div>';
      return '<article class="fiche ' + theme(p) + '" data-ean="' + p.ean + '"><div class="stage"><span class="rk">' + ent(p.rang) + '</span>' + st + '</div>' +
        '<div class="txt"><div class="marque">' + esc(p.marque) + '</div><div class="nom">' + esc(p.nom) + '</div>' +
        '<div class="bas"><div class="prix">' + eur(p.prix) + '<small>HT</small></div>' + ecart(p) + '</div>' +
        '<div class="rg">n° ' + ent(p.rang) + ' des ventes</div></div></article>';
    }
    // Aucun rang brut : seulement le relevé d'apparition et le nombre de places gagnées depuis (calculé dans les données).
    function phrase(p) {
      var s = 'Apparu au relevé du ' + dl(p.entree);
      if (p.gain > 0) s += ' · ' + (p.gain === 1 ? '1 place gagnée' : ent(p.gain) + ' places gagnées') + ' depuis';
      return s + '.';
    }
    function scene(p, grand) {
      note(p);
      var pl = p.photo ? '<div class="pl"><div class="socle">' + img(p) + '</div></div>' : '<div class="vig">' + esc(p.marque) + '</div>';
      var st = grand ? ' style="--ph:12mm;--pi:54mm"' : ' style="--ph:13mm;--pi:' + (p.photo ? '50mm' : '0') + '"';
      return '<article class="scene ' + theme(p) + '" data-ean="' + p.ean + '"' + st + '>' +
        '<span class="nb">Nouveauté</span>' + pl +   // sans numéro (choix de Will) : sa place dans le catalogue n'est pas son rang de vente
        '<div class="st"><div class="marque">' + esc(p.marque) + '</div><div class="nom">' + esc(p.nom) + '</div>' +
        '<div class="prix">' + eur(p.prix) + '<small>HT</small></div>' + ecart(p) +
        '<div class="ph">' + phrase(p) + '</div></div></article>';
    }
    function folio(g) { return '<div class="folio"><span>Catalogue Offilog · ' + prixHt.charAt(0).toLowerCase() + prixHt.slice(1) + '</span><span>' + g + '</span><i>' + pageNo + '</i></div>'; }

    function pageCouv(n, nbMarques, ved) {
      var pos = ['p2', 'p3', 'p1'], ordre = [ved[1], ved[2], ved[0]];
      var vit = ordre.map(function (p, i) { return p ? '<div class="' + pos[i] + ' socle-wrap"><div class="socle">' + img(p, p.marque) + '</div></div>' : ''; }).join('');
      var dates = [prixHt, D.classement_du ? 'Classement des ventes du ' + dl(D.classement_du, true) : ''].filter(Boolean).join('<br>');
      return '<section class="page couv"><div class="faisceau" data-deco></div>' +
        '<div class="logo"><img src="' + esc(LOGO) + '" alt="Offilog"></div>' +
        '<div class="edition">Catalogue parapharmacie<br>' + prixHt + '</div>' +
        '<h1>Les meilleures ventes<em>et les nouveautés qui montent</em></h1>' +
        '<p class="sous"><b>La sélection Offilog</b> : ce que les officines commandent le plus chez nous, rangé par rayon, avec le tarif labo à côté du prix Offilog.</p>' +
        '<div class="vit">' + vit + '</div><div class="sol"></div>' +
        '<div class="pied"><div><b>' + ent(n) + '</b>références</div><div><b>' + ent(nbMarques) + '</b>marques</div>' +
        '<div class="dt">' + dates + '</div></div></section>';
    }
    function pageNouv(its, premiere, k, grand) {
      pageNo++;
      var depuis = D.releves.length ? dl(D.releves[0]) : '';
      var kick = '<div class="kick">Entrées dans nos ventes' + (depuis ? ' depuis le relevé du ' + depuis : '') + '</div>';
      var tete = premiere
        ? '<div class="tete">' + kick + '<h2>Les nouveautés qui montent</h2><p>' + ent(k) + ' produits absents de notre classement' + (depuis ? ' au relevé du ' + depuis : '') + ', entrés depuis.</p></div>'
        : '<div class="tete">' + kick + '<h2>Les nouveautés <em style="font-weight:400">(suite)</em></h2></div>';
      return '<section class="page nouv">' + tete + '<div class="nvg ' + (grand ? 'nv4' : 'nv6') + '">' + its.map(function (p) { return scene(p, grand); }).join('') + '</div>' +
        '<div class="folio" style="color:#EADCF5"><span>Catalogue Offilog · ' + prixHt.charAt(0).toLowerCase() + prixHt.slice(1) + '</span><span>Les nouveautés</span><i>' + pageNo + '</i></div></section>';
    }
    function pageRayon(g, its, ouverture, heros, total, nbm) {
      pageNo++;
      var h;
      if (ouverture) {
        var pls = heros.map(function (p, i) { return '<div class="pl pl' + (i + 1) + '"><div class="socle">' + img(p, '') + '</div></div>'; }).join('');
        h = '<div class="band"><div class="kick">Les meilleures ventes</div><h2>' + g.nom + '</h2>' +
          '<div class="cpt"><b>' + ent(total) + '</b>référence' + (total > 1 ? 's' : '') + ' · ' + ent(nbm) + ' marque' + (nbm > 1 ? 's' : '') + ',<br>classées par rang de vente.</div>' + pls + '</div>';
      } else {
        h = '<div class="slim"><h3>' + g.nom + '<em>suite</em></h3><span>Les meilleures ventes</span></div>';
      }
      return '<section class="page rayon ' + g.t + '">' + h + '<div class="grille ' + (ouverture ? 'g3' : 'g4') + '">' + its.map(fiche).join('') + '</div>' + folio(g.nom) + '</section>';
    }
    function pagesIndex() {
      var noms = Object.keys(marquesPages).sort(function (a, b) { return cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0; });
      var rows = [], lettre = '';
      noms.forEach(function (m) {
        var L = cle(m).charAt(0).toUpperCase();
        if (!/[A-Z]/.test(L)) L = '#';
        if (L !== lettre) { lettre = L; rows.push({ l: L }); }
        var pg = marquesPages[m].slice().sort(function (a, b) { return a - b; });
        rows.push({ m: m, p: pg.length > 4 ? pg.slice(0, 4).join(' · ') + ' …' : pg.join(' · ') });
      });
      var tot = rows.reduce(function (a, r) { return a + (r.l ? 7.4 : 5.15); }, 0);
      var f = 1.3, np = Math.max(1, Math.ceil(tot * f / (3 * 226))), MAXH = Math.min(226, tot * f / (np * 3) + 8 * f);
      var out = [], cols = [], col = [], h = 0;
      rows.forEach(function (r) {
        var hh = (r.l ? 7.4 : 5.15) * f, need = r.l ? hh + 5.15 * f : hh;
        if (h + need > MAXH && col.length) { cols.push(col); col = []; h = 0; }
        if (cols.length === 3) { out.push(cols); cols = []; }
        col.push(r); h += hh;
      });
      if (col.length) cols.push(col);
      if (cols.length) out.push(cols);
      out = out.map(function (cs) {
        return cs.map(function (seg) {
          return '<div class="icol">' + seg.map(function (r) {
            return r.l ? '<div class="il">' + r.l + '</div>' : '<div class="ir"><b>' + esc(r.m) + '</b><span>' + r.p + '</span></div>';
          }).join('') + '</div>';
        }).join('');
      });
      return { pages: out, nb: noms.length };
    }
    function pageIndex(cols, i, tot, nb) {
      pageNo++;
      return '<section class="page index"><div class="ih"><div class="kick">Index</div><h2>Les marques' + (tot > 1 ? ' <em style="font-weight:400;font-size:.6em">(' + (i + 1) + '/' + tot + ')</em>' : '') + '</h2>' +
        '<p>' + ent(nb) + ' marques, par ordre alphabétique, avec les pages où retrouver leurs produits.</p></div>' +
        '<div class="icols" style="--f:1.3">' + cols + '</div>' + folio('Index des marques') + '</section>';
    }
    function pageDos(ved) {
      pageNo++;
      var s = ved.slice(0, 3).map(function (p, i) { return '<div class="p ' + 'abc'.charAt(i) + '"><div class="socle">' + img(p) + '</div></div>'; }).join('');
      var mentions = [prixHt, D.classement_du ? 'classement des ventes du ' + dl(D.classement_du, true) : ''].filter(Boolean).join(' · ');
      return '<section class="page dos"><div class="faisceau" data-deco></div>' +
        '<div class="logo"><img src="' + esc(LOGO) + '" alt="Offilog"></div>' +
        '<h2>Comment commander<em>simplement</em></h2>' +
        '<ul class="cmd"><li>Prix net, à l’unité</li><li>Livraison dès ' + ent(LIVRAISON_DES_EUROS) + '\u00a0€ de commande</li>' +
        '<li>Le panier se conserve sur le poste de la commande</li><li>Réception de la facture dès l’envoi de la commande</li>' +
        '<li>Si problème lors de la réception, contactez le SAV sur la plateforme</li></ul>' +
        '<div class="site">offilog.fr</div><div class="sc">' + s + '</div>' +
        '<div class="sol"></div><p class="mentions">' + mentions + '.<br>Offilog, la centrale parapharmacie du groupe Intégral.</p></section>';
    }

    var tous = D.produits, nouv = D.nouveautes, reste = D.reste;
    var vedettes = tous.filter(function (p) { return p.photo; }).sort(function (a, b) { return a.rang - b.rang; }).slice(0, 3);
    var pages = [];
    var couv = pageCouv(tous.length, D.nb_marques, vedettes);
    var k = nouv.length, grand = D.n < 200, par = grand ? 4 : 6, i;
    for (i = 0; i < k; i += par) pages.push(pageNouv(nouv.slice(i, i + par), i === 0, k, grand));
    GROUPES.forEach(function (g) {
      var it = reste.filter(function (p) { return groupeDe(p.rayon) === g; }).sort(function (a, b) { return a.rang - b.rang; });
      if (!it.length) return;
      var nbm = {}; it.forEach(function (p) { nbm[p.marque] = 1; });
      nbm = Object.keys(nbm).length;
      var heros = it.filter(function (p) { return p.photo; }).slice(0, 3);
      var pos = 0, first = true;
      while (pos < it.length) {
        var cap = first ? 9 : 12;
        pages.push(pageRayon(g, it.slice(pos, pos + cap), first, heros, it.length, nbm));
        pos += cap; first = false;
      }
    });
    var idx = pagesIndex();
    idx.pages.forEach(function (cols, j) { pages.push(pageIndex(cols, j, idx.pages.length, idx.nb)); });
    pages.push(pageDos(vedettes.slice().reverse()));
    return couv + pages.join('');
  }

  function htmlDoc(D) {
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Le catalogue Offilog</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Schibsted+Grotesk:wght@400..800&display=swap" rel="stylesheet">' +
      '<link rel="stylesheet" href="' + esc(BASE + 'v2-offilog-vitrine.css' + JETON) + '"></head>' +
      '<body><main id="doc">' + construire(D) + '</main></body></html>';
  }
  function compterPages(html) { return (html.match(/<section class="page[ "]/g) || []).length; }

  // ── API sans écran (lue par les tests) ───────────────
  V2.offVitrineDonnees = function (n) { return donnees(n); };
  // 18/11/2026 — onglet « Très bien placés » (v2-offilog.js) : la MÊME liste que le catalogue (marques exclues retirées, ordre du
  // dernier relevé, position sans trou), avec la marque et le nom nettoyés. null tant que la liste privée manque : l'onglet reste fermé.
  V2.offVitrineClasses = function () {
    if (!exclusValides()) return null;
    var XS = window.OFFILOG_EXCLUS;
    var X = { eans: setDe(XS.eans), prefixes: setDe(XS.prefixes), liste: XS.marques.map(function (m) { return String(m).trim().toLowerCase(); }).filter(Boolean) };
    var L = candidats(lireItems(false), X);
    var G = gammesDe(L.map(function (x) { return { nom: nettoyer(x.it.name), marque: x.it.brand }; }));
    return L.map(function (x) { var mn = marqueNom({ nom: nettoyer(x.it.name), marque: x.it.brand }, G); return { it: x.it, pos: x.pos, marque: mn.marque, nom: mn.nom }; });
  };
  V2.offVitrineHtml = function (n) { return construire(donnees(n)); };

  // ── Chargement des sources, à l'ouverture ──────────────
  // L'écran Offilog a déjà demandé ces fichiers ; s'ils manquent encore (ouverture très rapide), on les attend.
  // Index des détourages WebP disponibles (oimg-cut/liste.json) : lu une fois ; absent ou illisible = aucun détourage (repli JPEG).
  var indexDemande = false;
  function chargerIndexCut() {
    if (Array.isArray(window.OFFILOG_CUT) || indexDemande || !BASE || typeof fetch !== 'function') return Promise.resolve();
    indexDemande = true;
    return fetch(BASE + 'oimg-cut/liste.json' + JETON).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (a) { if (Array.isArray(a)) window.OFFILOG_CUT = a.map(String); })
      .catch(function () { window.OFFILOG_CUT = []; });
  }
  function preparer(n) {
    var cles = [];
    if (!window.OFFILOG_BEST_PRIX) cles.push('offilogbestprix');
    if (!window.OFFILOG_MARCHE) cles.push('offilogmarche');
    if (!window.OFFILOG_CATS) cles.push('offilogcats');
    if (!window.OFFILOG_CATALOGUE) cles.push('offilogcatalogue');   // seulement pour la date des prix ; son absence ne bloque rien
    if (!exclusValides()) cles.push('offilogexclus');                // la liste des marques à retirer : sans elle, rien n'est montré
    if (!window.OFFILOG_NOUVEAUTES) cles.push('offilognouv');        // les nouveautés du robot : absentes = un catalogue sans nouveautés
    var p = cles.length && V2.loadFiles ? V2.loadFiles(cles) : Promise.resolve();
    return Promise.resolve(p).catch(function () {}).then(function () {
      return V2.offilogChargerMeilleures ? V2.offilogChargerMeilleures() : true;
    }).then(function () {
      if (V2.fusionnerPrixBest) { try { V2.fusionnerPrixBest(); } catch (e) {} }
      return chargerIndexCut();
    }).then(function () {
      return donnees(n, cles.length > 0);
    }).then(function (D) {
      // photos : le détourage WebP si l'index l'annonce ; sinon un petit JPEG par produit (v2/oimg/), lu seulement pour ceux-là
      if (!D.produits.length || !V2.offilogImgs) return D;
      var ids = D.produits.filter(function (p) { return p.photo_type !== 'webp'; }).map(function (p) { return p.id; });
      if (!ids.length) return D;
      return Promise.resolve(V2.offilogImgs(ids)).catch(function () {}).then(function () { return donnees(n); });
    });
  }
  // ── La fenêtre : barre d'outils du CRM au-dessus de l'iframe ──────────────
  var modal = null, frame = null, etat = { n: 0, D: null, pages: 0 }, enCours = false, cssPose = false;
  function ICO(nom, s, w) { return window.ICO ? window.ICO(nom, s, w) : ''; }
  function poserCss() {
    if (cssPose || !document.getElementById) return;
    cssPose = true;
    var st = document.createElement('style'); st.id = 'ovt-css';
    // 22/11/2026 (V3) : la barre est claire (texte sombre sur fond blanc, boutons de 44 px) et la feuille entière tient à l'écran, y compris au téléphone (voir ajuster).
    st.textContent = [
      '#ovt-modal{position:fixed;inset:0;z-index:130;display:none;flex-direction:column;background:#E4E8F0}',
      '#ovt-modal.open{display:flex}',
      '.ovt-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:10px 16px;background:linear-gradient(180deg,#fff,#F3F6FC);border-bottom:1px solid #D7E0F0;box-shadow:0 10px 22px -18px rgba(0,26,104,.55);color:#1A2030}',
      '.ovt-th{display:flex;flex-direction:column;gap:2px;margin-right:8px;min-width:0}',
      '.ovt-t{font-family:var(--font,"Archivo",system-ui,sans-serif);font-weight:800;font-size:19px;letter-spacing:-.02em;line-height:1.2;color:#1A2030}',
      '.ovt-info{font-size:14px;line-height:1.3;color:#3D4960}',
      '.ovt-segs{display:flex;gap:8px}',
      '.ovt-bar .v2-seg{min-height:44px;padding:0 16px;font-size:15px;font-weight:700;color:#1A2030;background:#fff;border:1px solid #BFCDE8}',
      '.ovt-bar .v2-seg.on{background:#0050E6;border-color:#0050E6;color:#fff}',
      '.ovt-bar .v2-btn{min-height:44px;padding:0 18px;font-size:15px;font-weight:700;white-space:nowrap}',
      '.ovt-bar .v2-btn-primary{background:#0050E6;border-color:#0050E6;color:#fff}',
      '.ovt-bar .v2-btn-ghost,.ovt-bar .v2-btn-ghost:hover{background:#fff;border:1px solid #BFCDE8;color:#1A2030}',
      '.ovt-x{margin-left:auto}',
      '.ovt-stage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex}',
      '.ovt-frame{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#cfccc8;transform-origin:0 0}',
      '.ovt-msg{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-size:16px;color:#1A2030}',
      '#ovt-pret{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:250;display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px 16px 14px 20px;border-radius:16px;background:#fff;border:1px solid #BFCDE8;box-shadow:0 18px 44px -12px rgba(0,26,104,.38),0 2px 6px rgba(0,26,104,.1);color:#1A2030;font-family:var(--font,"Archivo",system-ui,sans-serif)}',
      '.ovt-pret-tx{display:flex;flex-direction:column;gap:2px;min-width:0}.ovt-pret-tx b{font-size:16px;font-weight:800}.ovt-pret-tx span{font-size:14px;color:#3D4960}',
      '.ovt-pret-a{display:flex;gap:8px}.ovt-pret-a .v2-btn{min-height:44px;padding:0 16px;font-size:15px;font-weight:700;white-space:nowrap}',
      '.ovt-pret-a .v2-btn-primary{background:#0050E6;border-color:#0050E6;color:#fff}.ovt-pret-a .v2-btn-ghost{background:#fff;border:1px solid #BFCDE8;color:#1A2030}.ovt-pret-a .ovt-pret-x{padding:0;width:44px;justify-content:center}',
      '@media(max-width:700px){#ovt-pret{left:12px;right:12px;width:auto;max-width:none;transform:none}.ovt-pret-a{flex:1 1 100%}.ovt-pret-a .v2-btn:not(.ovt-pret-x){flex:1;justify-content:center;padding:0 8px}}',
      '@media(max-width:700px){.ovt-bar{gap:8px;padding:8px 12px 10px}.ovt-th{order:1;flex:1 1 0}.ovt-x{order:2;margin-left:0}.ovt-segs{order:3;flex:1 1 100%}.ovt-segs .v2-seg{flex:1;padding:0 6px}.ovt-seg-l{display:none}.ovt-b{order:4;flex:1 1 0}.ovt-bar .v2-btn{padding:0 8px}}'
    ].join('');
    document.head.appendChild(st);
  }
  function barre() {
    var segs = CHOIX.map(function (c) {
      return '<button type="button" class="v2-seg' + (c === choix ? ' on' : '') + '" aria-pressed="' + (c === choix ? 'true' : 'false') + '" onclick="V2.offVitrineChoix(' + c + ')">' + c + '<span class="ovt-seg-l"> produits</span></button>';
    }).join('');
    return '<div class="ovt-bar"><div class="ovt-th"><span class="ovt-t">Catalogue à envoyer</span><span class="ovt-info" id="ovt-info" aria-live="polite"></span></div>' +
      '<div class="ovt-segs" role="group" aria-label="Nombre de produits">' + segs + '</div>' +
      '<button type="button" class="v2-btn v2-btn-primary ovt-b" onclick="V2.offVitrineImprimer()">' + ICO('fiche', 15, 2) + ' Imprimer</button>' +
      '<button type="button" class="v2-btn v2-btn-primary ovt-b" onclick="V2.offVitrinePdf()">' + ICO('download', 15, 2) + ' <span class="ovt-seg-l">Télécharger le </span>PDF</button>' +
      '<button type="button" class="v2-btn v2-btn-primary ovt-b" onclick="V2.offVitrineMail()">' + ICO('spark', 15, 2) + ' Envoyer<span class="ovt-seg-l"> par mail</span></button>' +
      '<button type="button" class="v2-btn v2-btn-ghost ovt-x" onclick="V2.offVitrineFermer()">' + ICO('close', 15, 2) + ' Fermer</button></div>' +
      '<div class="ovt-stage"></div>';
  }
  // La feuille A4 (210 mm) a une largeur fixe : sur un écran plus étroit, on la montre ENTIÈRE en la réduisant (l'iframe garde sa mise en page, donc l'impression et le PDF ne changent pas).
  var LARGEUR_FEUILLE = 830;
  function ajuster() {
    if (!modal || !frame || !frame.classList.contains('ovt-frame')) return;
    var st = modal.querySelector('.ovt-stage'); if (!st) return;
    var W = st.clientWidth, H = st.clientHeight, k = Math.min(1, W / LARGEUR_FEUILLE);
    if (k >= 1) { frame.style.width = '100%'; frame.style.height = '100%'; frame.style.transform = 'none'; return; }
    frame.style.width = LARGEUR_FEUILLE + 'px'; frame.style.height = Math.ceil(H / k) + 'px'; frame.style.transform = 'scale(' + k.toFixed(4) + ')';
  }
  function info(t) { var e = document.getElementById('ovt-info'); if (e) e.textContent = t; }
  function message(html) {
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null;
    var m = modal.querySelector('.ovt-msg');
    if (!m) { m = document.createElement('div'); m.className = 'ovt-msg'; (modal.querySelector('.ovt-stage') || modal).appendChild(m); }
    m.innerHTML = html;
  }
  function retirerMessage() { var m = modal && modal.querySelector('.ovt-msg'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function surCloture(e) { if (e.key === 'Escape' && modal && modal.classList.contains('open')) V2.offVitrineFermer(); }

  // Une iframe de plus : dans la fenêtre (visible) ou hors écran (pour le PDF envoyé sans ouvrir le catalogue).
  function monterFrame(D, visible) {
    return new Promise(function (ok, ko) {
      var f = document.createElement('iframe');
      f.title = 'Le catalogue Offilog';
      if (visible) f.className = 'ovt-frame';
      else f.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;height:1200px;border:0';
      f.onload = function () {
        var fw = f.contentWindow, d = fw.document, fo = d.fonts;
        var attente = fo ? Promise.all([fo.load('500 20px "Bodoni Moda"'), fo.load('800 15px "Schibsted Grotesk"')].map(function (p) { return Promise.resolve(p).catch(function () {}); })).then(function () { return fo.ready; }) : Promise.resolve();
        var imgs = [].slice.call(d.images).map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); });
        Promise.all([attente.catch(function () {}), Promise.all(imgs)]).then(function () {
          // convention des contrôles : window.rendre(n) redessine le catalogue dans l'iframe
          fw.rendre = function (m) { var doc = fw.document.getElementById('doc'); if (doc) doc.innerHTML = V2.offVitrineHtml(m); return doc ? doc.querySelectorAll('section.page').length : 0; };
          ok(f);
        });
      };
      f.onerror = ko;
      f.srcdoc = htmlDoc(D);
      (visible ? (modal.querySelector('.ovt-stage') || modal) : document.body).appendChild(f);
    });
  }

  function ouvrir(n, opts) {
    opts = opts || {};
    if (n && CHOIX.indexOf(+n) >= 0) choix = +n;
    poserCss();
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'ovt-modal';
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Catalogue à envoyer');
      document.body.appendChild(modal);
      try { document.addEventListener('keydown', surCloture); window.addEventListener('resize', ajuster); } catch (e) {}
    }
    modal.innerHTML = barre();
    modal.classList.add('open');
    frame = null;
    message('<div>Préparation du catalogue…</div>');
    var n0 = choix;
    return preparer(n0).then(function (D) {
      if (!modal.classList.contains('open') || n0 !== choix) return null;   // l'utilisateur a changé de choix ou fermé
      if (D.exclus_absent) {
        info('');
        message('<div>La liste des marques à retirer n\'a pas pu être chargée. Rien n\'est montré. Réessayez.</div>' +
          '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.offVitrine()">Réessayer</button>');
        return null;
      }
      if (!D.produits.length) {
        info('');
        message('<div>Le classement des ventes et les prix Offilog ne sont pas encore chargés.<br>Patientez un instant, puis cliquez sur « Réessayer ».</div>' +
          '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.offVitrine()">Réessayer</button>');
        return null;
      }
      return monterFrame(D, true).then(function (f) {
        if (!modal.classList.contains('open') || n0 !== choix) { if (f.parentNode) f.parentNode.removeChild(f); return null; }
        retirerMessage();
        frame = f; ajuster(); etat = { n: n0, D: D, pages: compterPages(f.contentDocument.getElementById('doc').innerHTML) };
        info(ent(D.produits.length) + ' produits · ' + ent(etat.pages) + ' pages' +
          (D.avec_tarif < D.produits.length ? ' · tarif labo connu pour ' + ent(D.avec_tarif) : ' · tarif labo connu pour tous'));
        if (opts.imprimer) { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { V2.toast('Impression impossible ici.', 'error'); } }
        return f;
      });
    }).catch(function (e) {
      console.error('catalogue Offilog', e);
      message('<div>Le catalogue n\'a pas pu être préparé. Vérifiez la connexion puis cliquez sur « Réessayer ».</div><button type="button" class="v2-btn v2-btn-primary" onclick="V2.offVitrine()">Réessayer</button>');
    });
  }
  V2.offVitrine = function (n) { return ouvrir(n); };
  V2.offVitrineImprimer = function (n) {
    if (modal && modal.classList.contains('open') && frame && (!n || +n === etat.n)) {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { V2.toast('Impression impossible ici.', 'error'); }
      return Promise.resolve();
    }
    return ouvrir(n, { imprimer: true });
  };
  V2.offVitrineFermer = function () {
    if (modal) modal.classList.remove('open');
    if (frame && frame.parentNode && !enCours) frame.parentNode.removeChild(frame);
    if (!enCours) frame = null;
  };
  // Le choix 100 / 200 / 300 : sur l'écran Offilog (la porte) il se retient ; dans la fenêtre il redessine le catalogue.
  V2.offVitrineChoix = function (c) {
    if (CHOIX.indexOf(+c) < 0) return;
    choix = +c;
    [].forEach.call(document.querySelectorAll('[data-vit-n]'), function (b) {
      var on = +b.getAttribute('data-vit-n') === choix; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (modal && modal.classList.contains('open')) ouvrir(choix);
    else if (V2.offVitrineVignette) V2.offVitrineVignette();
  };

  // ── Le PDF envoyé par mail : fabriqué ICI, page par page, dans l'iframe (c'est là que vit la feuille de style) ──
  // html2pdf n'expose pas jsPDF, et l'objet `pdf` qu'il rend n'a pas la classe pour constructeur : on garde ce DOCUMENT
  // (une page minuscule rendue au bon format, vidée) comme le fait le catalogue « 500 meilleures ventes ».
  var URL_HTML2PDF = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
  function nouveauPdfA4() {
    var opt = { unit: 'pt', format: 'a4', orientation: 'portrait' };
    var el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:20px;background:#fff;font-size:8px';
    el.textContent = '.'; document.body.appendChild(el);
    var fin = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    return window.html2pdf().set({ html2canvas: { scale: 0.5 }, jsPDF: opt }).from(el).toPdf().get('pdf').then(function (pdf) {
      fin();
      if (!pdf || typeof pdf.addImage !== 'function' || typeof pdf.deletePage !== 'function') throw new Error('jsPDF absent');
      var n = pdf.getNumberOfPages();
      pdf.addPage('a4', 'portrait');
      for (var i = n; i >= 1; i--) pdf.deletePage(i);
      pdf.setPage(1);
      return pdf;
    }, function (e) { fin(); throw e; });
  }
  // html2canvas copie la page dans le document qui l'appelle : pour garder la feuille de style, la bibliothèque est chargée DANS l'iframe.
  function html2pdfDans(fw) {
    if (fw.html2pdf) return Promise.resolve();
    return Promise.resolve(window.ensureHtml2Pdf ? window.ensureHtml2Pdf() : null).then(function () {
      var tag = document.querySelector('script[src*="html2pdf"]');
      return new Promise(function (ok, ko) {
        var s = fw.document.createElement('script');
        s.src = tag && tag.src ? tag.src : URL_HTML2PDF;
        s.onload = ok; s.onerror = ko; fw.document.head.appendChild(s);
      });
    });
  }
  // html2canvas (1.0.0, dans html2pdf 0.10.2) ignore object-fit : il étire toute la photo sur sa boîte de CONTENU
  // (tube Fixodent étiré 2,5 fois en hauteur, flacons élargis dans le PDF envoyé). Des marges intérieures ramènent cette
  // boîte à la taille « contain », placée selon object-position. À l'écran rien ne bouge ; le style d'origine revient après la page.
  function cadrage(W, H, nw, nh, px, py) {
    if (!(W > 0 && H > 0 && nw > 0 && nh > 0)) return null;
    var r = nw / nh, w = Math.min(W, H * r), h = Math.min(H, W / r);
    if (W - w < 0.5 && H - h < 0.5) return null;
    var l = (W - w) * px, t = (H - h) * py;
    return { t: t, r: W - w - l, b: H - h - t, l: l };
  }
  function fraction(v) {
    var k = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 }, m = /^(-?[\d.]+)%$/.exec(v || '');
    return m ? +m[1] / 100 : (v in k ? k[v] : 0.5);
  }
  function cadrerPhotos(sec, fw) {
    var faits = [];
    [].forEach.call(sec.querySelectorAll('img'), function (im) {
      var cs = fw.getComputedStyle(im);
      if (cs.objectFit !== 'contain' || !im.complete) return;
      var W = parseFloat(cs.width), H = parseFloat(cs.height), op = String(cs.objectPosition || '').split(/\s+/);
      var c = cadrage(W, H, im.naturalWidth, im.naturalHeight, fraction(op[0]), fraction(op[1]));
      if (!c) return;
      faits.push([im, im.getAttribute('style')]);
      im.style.boxSizing = 'border-box'; im.style.width = W + 'px'; im.style.height = H + 'px';
      im.style.padding = c.t + 'px ' + c.r + 'px ' + c.b + 'px ' + c.l + 'px';
    });
    return function () { faits.forEach(function (x) { if (x[1] == null) x[0].removeAttribute('style'); else x[0].setAttribute('style', x[1]); }); };
  }
  // Une photo perdue ne doit jamais partir en case vide. Deux contrôles :
  // 1. avant le PDF, les photos de l'aperçu (src posé, mais rien de chargé : naturalWidth 0) ;
  // 2. pendant le PDF : html2canvas RECHARGE chaque photo (17/11/2026 : 429 de Vercel, 34 photos vides dans un PDF « réussi »).
  //    Quand ce rechargement échoue, html2canvas 1.0.0 saute la photo et écrit seulement « Error loading image <adresse> »
  //    par console.error (la console de l'iframe, où vit la bibliothèque ; logging: true est donc indispensable).
  function photosCassees(racine) {
    return [].filter.call(racine.querySelectorAll('img'), function (im) {
      return !!im.getAttribute('src') && (!im.complete || !(im.naturalWidth > 0));
    }).map(function (im) { return im.getAttribute('src'); });
  }
  function ecouterPhotosPerdues(fw) {
    var perdues = [], c = fw.console, avant = c && c.error;
    if (!c) return { perdues: perdues, fin: function () {} };
    c.error = function () {
      for (var k = 0; k < arguments.length; k++) {
        var m = /^Error loading image (.*)$/.exec(String(arguments[k]));
        if (m) { perdues.push(m[1]); break; }
      }
      if (typeof avant === 'function') return avant.apply(c, arguments);
    };
    return { perdues: perdues, fin: function () { c.error = avant; } };
  }
  // une même photo figure plusieurs fois (scène + carte) : on compte les photos, pas leurs apparitions
  function errPhotos(liste) {
    var u = liste.filter(function (s, i) { return liste.indexOf(s) === i; }), e = new Error('photos non chargées : ' + u.length);
    e.photos = u; return e;
  }
  // Un raté PASSAGER ne doit pas refuser le PDF (17/11/2026 : 1 photo sur 323 non chargée en prod, servie en 200 juste après) :
  // avant d'abandonner, on attend un peu (le 429 de Vercel retombe vite) et on redemande la photo, deux fois au plus.
  var PAUSES_REESSAI = [2, 6];   // secondes
  function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // aperçu : chaque photo cassée est redemandée, 15 s au plus. À une adresse NEUVE (même fichier, suffixe ?reessai=N) :
  // la même adresse reposée ne redemande rien sous WebKit, qui ressert l'échec gardé pour la page (preuve WebKit du 17/11/2026).
  // Un seul N par essai : les apparitions d'une même photo (scène + carte) partagent l'adresse, donc une seule demande.
  var nReessai = 0;
  function rechargerPhotos(racine, srcs) {
    var n = ++nReessai;
    return Promise.all([].filter.call(racine.querySelectorAll('img'), function (im) { return srcs.indexOf(im.getAttribute('src')) >= 0; }).map(function (im) {
      return new Promise(function (r) {
        var t = setTimeout(fini, 15000);
        function fini() { clearTimeout(t); im.removeEventListener('load', fini); im.removeEventListener('error', fini); r(); }
        im.addEventListener('load', fini); im.addEventListener('error', fini);
        var s = String(im.getAttribute('src')).replace(/[?&]reessai=\d+$/, '');
        im.src = s + (s.indexOf('?') >= 0 ? '&' : '?') + 'reessai=' + n;
      });
    }));
  }
  function photosPretes(racine, k) {
    var cassees = photosCassees(racine);
    if (!cassees.length) return Promise.resolve();
    if (k >= PAUSES_REESSAI.length) return Promise.reject(errPhotos(cassees));
    return pause(PAUSES_REESSAI[k] * 1000).then(function () { return rechargerPhotos(racine, cassees); }).then(function () { return photosPretes(racine, k + 1); });
  }
  // une page du PDF : si html2canvas a perdu une photo en la rechargeant, la page entière est refaite après la pause
  function rendrePage(fw, sec, k) {
    var remettre = cadrerPhotos(sec, fw), ecoute = ecouterPhotosPerdues(fw);
    var fin = function () { ecoute.fin(); remettre(); };
    return fw.html2pdf().set({ html2canvas: { scale: 1.5, useCORS: true, logging: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 } })
      .from(sec).toCanvas().get('canvas').then(function (cv) {
        fin();
        if (!ecoute.perdues.length) return cv;
        cv.width = cv.height = 0;
        if (k >= PAUSES_REESSAI.length) throw errPhotos(ecoute.perdues);   // toujours perdue : on s'arrête à cette page
        return pause(PAUSES_REESSAI[k] * 1000).then(function () { return rendrePage(fw, sec, k + 1); });
      }, function (e) { fin(); throw e; });
  }
  V2._offVitrinePdf = { cadrage: cadrage, cadrerPhotos: cadrerPhotos, photosCassees: photosCassees, ecouterPhotosPerdues: ecouterPhotosPerdues, errPhotos: errPhotos,
    PAUSES_REESSAI: PAUSES_REESSAI, photosPretes: photosPretes, rendrePage: rendrePage };
  function fabriquerPdf(f, suivi) {
    var fw = f.contentWindow, secs = [].slice.call(fw.document.querySelectorAll('section.page')), pdf = null;
    if (!secs.length) return Promise.reject(new Error('aucune page'));
    return photosPretes(fw.document, 0).then(function () {
      return Promise.all([html2pdfDans(fw), Promise.resolve(window.ensureHtml2Pdf ? window.ensureHtml2Pdf() : null)]);
    }).then(nouveauPdfA4).then(function (doc) {
      pdf = doc;
      var p = Promise.resolve();
      secs.forEach(function (sec, i) {
        p = p.then(function () {
          if (suivi) suivi(i + 1, secs.length);
          return rendrePage(fw, sec, 0).then(function (cv) {
            if (i > 0) pdf.addPage('a4', 'portrait');
            pdf.addImage(cv.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
            cv.width = cv.height = 0;
          });
        });
      });
      return p;
    }).then(function () { return pdf.output('blob'); });
  }
  // 26/11/2026 — Will : « il manque un bouton pdf pour avoir directement le pdf qui s'enregistre ou envoyer ne fonctionne pas ».
  // Cause mesurée sous WebKit : Safari REFUSE la feuille de partage (NotAllowedError) quand elle s'ouvre plusieurs secondes après
  // le clic — le temps de fabriquer le PDF — et le refus était avalé sans rien dire. Le téléchargement, lui, passe après l'attente.
  // Donc : « Télécharger le PDF » enregistre dès que le PDF est prêt ; « Envoyer » montre « Le PDF est prêt » et le partage part
  // au clic suivant, DANS le geste. Le dernier PDF fabriqué est gardé : redemandé pour le même nombre, il part tout de suite.
  var pret = null;   // { n, file, pages }
  function enregistrer(file) {
    var u = URL.createObjectURL(file), a = document.createElement('a');
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    V2.toast('PDF enregistré dans vos téléchargements : ' + esc(file.name));
  }
  function partager(file) {
    var peut = false;
    try { peut = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    if (!peut) { enregistrer(file); return Promise.resolve(); }
    return navigator.share({ files: [file], title: 'Le catalogue Offilog' }).then(fermerPret, function (e) {
      if (e && e.name === 'AbortError') return;   // feuille fermée par l'utilisateur : rien à faire
      console.error('catalogue Offilog, partage', e);
      enregistrer(file);
    });
  }
  function fermerPret() { var b = document.getElementById('ovt-pret'); if (b && b.parentNode) b.parentNode.removeChild(b); }
  // l'encadré « Le PDF est prêt » : posé sur <body> (une fenêtre de l'app ne le piège pas), au-dessus du catalogue ouvert
  function proposer(p) {
    poserCss(); fermerPret();
    var b = document.createElement('div');
    b.id = 'ovt-pret'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-labelledby', 'ovt-pret-t');
    b.innerHTML = '<div class="ovt-pret-tx"><b id="ovt-pret-t">Le PDF est prêt</b><span>' + ent(p.n) + ' produits · ' + ent(p.pages) + ' pages</span></div>' +
      '<div class="ovt-pret-a"><button type="button" class="v2-btn v2-btn-primary" data-pret="envoyer">' + ICO('spark', 15, 2) + ' Envoyer</button>' +
      '<button type="button" class="v2-btn v2-btn-ghost" data-pret="pdf">' + ICO('download', 15, 2) + ' Télécharger</button>' +
      '<button type="button" class="v2-btn v2-btn-ghost ovt-pret-x" data-pret="x" aria-label="Fermer">' + ICO('close', 15, 2) + '</button></div>';
    b.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-pret]') : null; if (!t) return;
      var q = t.getAttribute('data-pret');
      if (q === 'x') fermerPret();
      else if (q === 'pdf') { enregistrer(p.file); fermerPret(); }
      else partager(p.file);
    });
    document.body.appendChild(b);
    try { b.querySelector('[data-pret="envoyer"]').focus(); } catch (e) {}
  }
  V2.offVitrineMail = function (n) { return produire(n, 'mail'); };
  V2.offVitrinePdf = function (n) { return produire(n, 'pdf'); };
  function produire(n, mode) {
    if (enCours) { V2.toast('Le PDF est déjà en préparation…'); return Promise.resolve(); }
    if (n && CHOIX.indexOf(+n) >= 0) choix = +n;
    var n0 = choix, ouverte = modal && modal.classList.contains('open') && frame && etat.n === n0, horsEcran = null;
    if (pret && pret.n === n0) {   // déjà fabriqué : part dans le geste, sans attente
      if (mode === 'pdf') enregistrer(pret.file); else partager(pret.file);
      return Promise.resolve();
    }
    enCours = true; fermerPret();
    V2.toast('Préparation du PDF…');
    var f0 = ouverte ? Promise.resolve({ f: frame, D: etat.D }) : preparer(n0).then(function (D) {
      if (D.exclus_absent) throw new Error('liste des marques à retirer absente : PDF refusé');
      if (!D.produits.length) throw new Error('données Offilog pas chargées');
      return monterFrame(D, false).then(function (f) { horsEcran = f; return { f: f, D: D }; });
    });
    return f0.then(function (x) {
      var nbPages = 0;
      return fabriquerPdf(x.f, function (i, t) { nbPages = t; info('PDF : page ' + i + ' / ' + t); }).then(function (blob) {
        var nom = 'Catalogue-Offilog-' + x.D.produits.length + '-references.pdf';
        pret = { n: n0, file: new File([blob], nom, { type: 'application/pdf' }), pages: nbPages };
        if (mode === 'pdf') enregistrer(pret.file); else proposer({ n: x.D.produits.length, file: pret.file, pages: nbPages });
      });
    }).catch(function (e) {
      console.error('catalogue Offilog, PDF', e);
      var nPh = e && e.photos ? e.photos.length : 0;
      V2.toast(/^liste des marques/.test(String(e && e.message)) ? 'La liste des marques à retirer n\'a pas pu être chargée. Rien n\'est montré. Réessayez.'
        : nPh ? (nPh === 1 ? 'Une photo n\'a pas pu être chargée' : nPh + ' photos n\'ont pas pu être chargées') + ' : le PDF aurait eu des cases vides. Rien n\'a été envoyé. Réessayez dans quelques minutes.'
        : 'Le PDF n\'a pas pu être préparé (connexion ?). Rien n\'a été envoyé, réessayez.', 'error');
    }).then(function () {
      enCours = false;
      if (horsEcran && horsEcran.parentNode) horsEcran.parentNode.removeChild(horsEcran);
      if (modal && modal.classList.contains('open') && etat.D) info(ent(etat.D.produits.length) + ' produits · ' + ent(etat.pages) + ' pages');
      else if (frame && !(modal && modal.classList.contains('open'))) { if (frame.parentNode) frame.parentNode.removeChild(frame); frame = null; }
    });
  }

  // ── L'onglet « Le catalogue » de l'écran Offilog (V3) : la couverture en vignette, le choix 100 / 200 / 300, Voir, Imprimer, Envoyer ──
  // La vignette est la VRAIE couverture, dans une petite iframe réduite : la même page que dans le catalogue, sans toucher à sa mise en page.
  var vigJeton = 0;
  V2.offVitrinePanneau = function () {
    var segs = CHOIX.map(function (c) {
      return '<button type="button" class="v2-seg' + (c === choix ? ' on' : '') + '" data-vit-n="' + c + '" aria-pressed="' + (c === choix ? 'true' : 'false') + '" onclick="V2.offVitrineChoix(' + c + ')">' + c + ' produits</button>';
    }).join('');
    var M = window.OFFILOG_MARCHE, rel = (M && M.releves) || [], der = rel.length ? rel[rel.length - 1] : (M && M.maj) || '';
    return '<div class="olv">' +
      '<div class="olv-vig" id="olv-vig" role="button" tabindex="0" aria-label="Voir le catalogue en grand" onclick="V2.offVitrine()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();V2.offVitrine()}">' +
        '<span class="olv-vig-c" aria-hidden="true"></span><span class="olv-vig-t">Préparation de la couverture…</span></div>' +
      '<div class="olv-txt"><h2 class="olv-h">Catalogue à envoyer</h2>' +
        '<p class="olv-p">Un catalogue prêt à montrer ou à envoyer au pharmacien : les meilleures ventes d\'Offilog, avec le prix Offilog et, quand nous le connaissons, le tarif du laboratoire.' +
        (der ? ' Classement des ventes du ' + esc(dl(der, true)) + '.' : '') + '</p>' +
        '<div class="olm-pan-l">Combien de produits dans le catalogue ?</div><div class="v2-segs off-adv-segs">' + segs + '</div>' +
        '<div class="olv-act">' +
          '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.offVitrine()">' + ICO('fiche', 15, 2) + ' Voir le catalogue</button>' +
          '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.offVitrineImprimer()">' + ICO('fiche', 15, 2) + ' Imprimer</button>' +
          '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.offVitrinePdf()">' + ICO('download', 15, 2) + ' Télécharger le PDF</button>' +
          '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.offVitrineMail()">' + ICO('spark', 15, 2) + ' Envoyer par mail</button></div></div></div>';
  };
  // Remplit la vignette : seule la première page (la couverture) du catalogue est montée.
  V2.offVitrineVignette = function () {
    var h = document.getElementById('olv-vig'); if (!h) return;
    var j = ++vigJeton, n0 = choix, txt = h.querySelector('.olv-vig-t');
    preparer(n0).then(function (D) {
      if (j !== vigJeton || !document.body.contains(h)) return;
      if (D.exclus_absent || !D.produits.length) { if (txt) txt.textContent = 'Couverture indisponible pour le moment'; return; }
      var html = construire(D), a = html.indexOf('<section class="page'), b = html.indexOf('<section class="page', a + 10);
      var couv = b > a ? html.slice(a, b) : html.slice(a);
      var f = document.createElement('iframe');
      f.title = 'Couverture du catalogue'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true'); f.setAttribute('scrolling', 'no');
      f.srcdoc = htmlDoc(D).replace(/<body>[\s\S]*<\/body>/, function () { return '<body style="margin:0;background:transparent"><main id="doc" style="padding:0">' + couv + '</main></body>'; });
      f.onload = function () { if (j === vigJeton && document.body.contains(h)) { h.classList.add('pret'); if (txt) txt.textContent = ''; } };
      var c = h.querySelector('.olv-vig-c'); if (!c) return;
      c.innerHTML = ''; c.appendChild(f);
    }).catch(function () { if (txt) txt.textContent = 'Couverture indisponible pour le moment'; });
  };
})();
