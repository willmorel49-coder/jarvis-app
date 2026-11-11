/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · TOURNÉES (V2.pages.tournees) — 10/11/2026
   Écran séparé de La carte, version « Le classement des tournées » choisie par Will : les établissements en haut (OPS actif, les six
   autres « à recevoir », aucun chiffre), puis les tournées classées par rentabilité par mois.
   11/11/2026 — une ligne cliquée ouvre le TABLEAU DE BORD de la tournée (#tournees/Txx, maquette « Le tableau de bord de la tournée »
   choisie par Will le 10/11) : CA, Notre marge, commandes, marge par commande, coût des livraisons et rentabilité, mois par mois et
   pour chaque cliente ; répartition par famille ; « où part la rentabilité » ; commandes par mois × marge par commande ; sur la route
   (petite carte, prospects à voir en priorité triés par détour, clientes à faire grossir) ; liste des clientes triable. Un clic sur une
   cliente la surligne partout (graphiques, carte, liste) et ouvre son détail mois par mois.

   - DONNÉES : PAS dans le dépôt (public). Fichier du seau privé `donnees-protegees`, à sa racine, nommé `tournees-etablissements.js`
     (clé « tournees » de v2-boot.js, variable globale TOURNEES_ECRAN), fabriqué hors dépôt. Il ne porte que les valeurs BRUTES :
     toutes les formules ci-dessous (médiane, raison, gain, potentiel, tri des prospects, classement, totaux et mois du tableau de bord)
     sont calculées ICI et testées (tests/tournees.test.mjs, avec des données fictives). Calcul de la fiche officine : 1 commande =
     1 livraison = 1 jour avec facture, au plus 1 par jour (Will, 11/11/2026) ; aucun prix d'achat, aucune marge produit par produit (totaux et familles seulement).
   - QUI VOIT : tout compte connecté sauf le rôle `opso` (décision de Will, 10/11/2026 : « tout le monde voit tout » sur CET écran,
     exception à la règle « un commercial ne voit pas les ventes des autres » ; V2.voitVentesDe n'est donc PAS appliqué ici). La base
     refuse déjà le fichier au rôle opso (jarvis_peut_lire_protege) ; l'écran le dit aussi.
   - Noms des prospects : base PHARMA_FR (V2.ensurePharmaFr, un seul téléchargement), à partir du CIP.
   - Fond de carte : V2.fondCarte (jamais CARTO, qui exige une clé).
   - Fichier absent ou illisible : message clair, jamais une page vide ni un faux zéro.
   Formules : voir les commentaires de C.analyser.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var C = {};   // calcul pur (testé : tests/tournees.test.mjs)
  var NB = ' ';

  // ── Calcul pur ────────────────────────────────────────────────
  // Arrondi au centime IDENTIQUE à round(x, 2) de Python (le fichier et la fiche sont calculés en Python) : sur la valeur binaire exacte
  // (Math.round(x*100) diffère d'un centime sur les .xx5 inexacts), et, quand la valeur tombe EXACTEMENT à mi-chemin (.125, .375, .625,
  // .875 sont exacts en binaire), au centime PAIR comme Python — toFixed arrondirait vers le haut (11/11/2026 : 2 écarts d'un centime sur 18 235).
  function r2(x) {
    var a = Math.abs(x), f = a * 8;
    if (isFinite(f) && f === Math.floor(f) && Math.round(a * 1000) % 10 === 5) { var lo = Math.floor(a * 100), v = (lo % 2 ? lo + 1 : lo) / 100; return x < 0 ? -v : v; }
    return Number(x.toFixed(2));
  }
  C.r2 = r2;
  C.mediane = function (a) {
    if (!a || !a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length, m = n >> 1;
    return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  // Le fichier est-il utilisable ? Rend '' si oui, sinon le motif (jamais une exception).
  C.valider = function (d) {
    if (!d || typeof d !== 'object') return 'fichier absent';
    if (!d.tournees || typeof d.tournees !== 'object' || !Object.keys(d.tournees).length) return 'aucune tournée dans le fichier';
    var ok = Object.keys(d.tournees).every(function (k) {
      var t = d.tournees[k];
      return t && Array.isArray(t.arrets) && Array.isArray(t.trace) && Array.isArray(t.prospects);
    });
    if (!ok) return 'fichier illisible';
    if (!Array.isArray(d.etablissements)) return 'liste des établissements absente';
    return '';
  };
  // Établissements : « actif » = le fichier dit qu'il a des tournées ; sinon « à recevoir » (aucun chiffre).
  C.etablissements = function (d) {
    return ((d && d.etablissements) || []).map(function (e) { return { s: e.s, nom: e.nom, ville: e.ville, actif: e.tournees === true }; });
  };
  // Prospects : [cip, lat, lng, km_route, apres, avant, detour, fiable] -> objets, position fiable d'abord, puis détour croissant, puis km sur la route.
  C.prospects = function (liste) {
    return (liste || []).map(function (p) { return { cip: String(p[0]), lat: p[1], lng: p[2], km_route: p[3], apres: p[4], avant: p[5], detour: p[6], fiable: !!p[7] }; })
      .sort(function (a, b) { return (a.fiable === b.fiable ? 0 : (a.fiable ? -1 : 1)) || (a.detour - b.detour) || (a.km_route - b.km_route); });
  };
  // Prospects à 2 km de détour ou moins : position fiable ET détour <= 2 (compte complet).
  C.nb2km = function (pros) { return (pros || []).filter(function (p) { return p.fiable && p.detour <= 2; }).length; };
  // Raison pour laquelle une cliente est « à faire grossir » (la première qui s'applique), ou null.
  C.raison = function (rm, mm, jm, mj, med) {
    if (rm < 0) return 'En perte';
    if (jm > med.jours_mois && mj < med.marge_jour) return 'Commande trop souvent pour sa marge';
    if (mm < med.marge_mois) return 'Marge sous la médiane de sa tournée';
    return null;
  };
  // Analyse d'UNE tournée (valeurs brutes -> chiffres affichés).
  //  - rentabilité par mois de la cliente = r.rm (marge moins livraisons, divisée par les mois livrés) ; de la tournée = somme des clientes ;
  //  - médianes calculées sur les clientes de la tournée qui ont des ventes (r non nul) : rentabilité mensuelle, marge mensuelle (m / mo),
  //    jours de commande par mois (jm), marge par jour de commande (mj) ;
  //  - gain = max(0, médiane des rentabilités mensuelles − rentabilité mensuelle de la cliente), retenu seulement si elle a une raison ET gain > 0 ;
  //  - potentiel = somme des gains retenus ; clientes en perte = rentabilité mensuelle < 0.
  C.analyser = function (t) {
    var arrets = (t && t.arrets) || [], R = arrets.filter(function (a) { return a.r; });
    var med = {
      renta: C.mediane(R.map(function (a) { return a.r.rm; })),
      marge_mois: C.mediane(R.map(function (a) { return a.r.m / a.r.mo; })),
      jours_mois: C.mediane(R.map(function (a) { return a.r.jm; })),
      marge_jour: C.mediane(R.map(function (a) { return a.r.mj; }))
    };
    var grossir = [], nbPerte = 0;
    var arr = arrets.map(function (a) {
      var o = { n: a.n, id: a.id, nom: a.nom, ville: a.ville, lat: a.lat, lng: a.lng, com: a.com, renta_mois: null, statut: 'none' };
      if (a.r) {
        var rm = a.r.rm, mm = a.r.m / a.r.mo;
        o.renta_mois = rm;
        o.statut = rm < 0 ? 'perte' : (rm < med.renta ? 'sous' : 'bon');
        if (rm < 0) nbPerte++;
        var gain = Math.max(0, med.renta - rm), raison = C.raison(rm, mm, a.r.jm, a.r.mj, med);
        o.gain = r2(gain); o.raison = raison;
        if (raison && gain > 0) grossir.push({ n: a.n, id: a.id, nom: a.nom, ville: a.ville, lat: a.lat, lng: a.lng, raison: raison, renta_mois: rm, gain: r2(gain) });
      }
      return o;
    });
    grossir.sort(function (a, b) { return b.gain - a.gain; });
    var pros = C.prospects(t && t.prospects);
    return {
      code: t.code, nom: t.nom, jours: t.jours || [], jours_statut: t.jours_statut, transporteur: t.transporteur, nb_arrets: t.nb_arrets,
      km_total: r2((t.km_aller || 0) + (t.km_retour || 0)), marge_jour: t.marge_jour, jours_commande: t.jours_commande,
      rentabilite: t.rentabilite,
      rentabilite_mois: r2(R.reduce(function (s, a) { return s + a.r.rm; }, 0)),
      nb_perte: nbPerte, nb_avec_ventes: R.length, med: med, arrets: arr,
      grossir: grossir, potentiel: r2(grossir.reduce(function (s, g) { return s + g.gain; }, 0)), nb_grossir: grossir.length,
      prospects: pros, nb_prospects: pros.length, nb_prospects_2km: C.nb2km(pros), trace: t.trace
    };
  };
  C.analyserTout = function (d) {
    var out = {};
    Object.keys((d && d.tournees) || {}).forEach(function (k) { out[k] = C.analyser(d.tournees[k]); });
    return out;
  };
  // Classement : tri sur une colonne (sens -1 = du plus grand au plus petit), égalités départagées par la rentabilité par mois.
  C.classer = function (A, cle, sens) {
    return Object.keys(A).sort(function (a, b) { return (sens * (A[a][cle] - A[b][cle])) || (A[b].rentabilite_mois - A[a].rentabilite_mois); });
  };
  C.bilan = function (A) {
    var k = Object.keys(A);
    return { n: k.length, rentabilite_mois: r2(k.reduce(function (s, c) { return s + A[c].rentabilite_mois; }, 0)), potentiel: r2(k.reduce(function (s, c) { return s + A[c].potentiel; }, 0)) };
  };
  // Jours de livraison : texte court (trois lettres) ; vide = « à préciser ».
  C.jours = function (t) {
    var j = (t && t.jours) || [];
    return j.length ? j.map(function (x) { return String(x).slice(0, 3); }).join(' ') : '';
  };
  // Position d'un prospect sur la route.
  C.position = function (p) {
    var a = p.apres, b = p.avant;
    if (!a && b) return 'entre le dépôt et l’arrêt n°' + NB + b;
    if (a && b == null) return 'après l’arrêt n°' + NB + a + ', avant le retour au dépôt';
    if (!a && b == null) return 'sur la route';
    return 'entre l’arrêt n°' + NB + a + ' et n°' + NB + b;
  };
  // Index PHARMA_FR : cip -> { nom, ville } (colonnes 13 = CIP, 6 = nom, 7 = ville).
  C.indexPF = function (pf) {
    var o = {};
    ((pf && pf.p) || []).forEach(function (p) { o[String(p[13])] = { nom: p[6], ville: p[7] }; });
    return o;
  };
  // Formats
  C.nf = function (x, d) {
    if (x == null || isNaN(x)) return '—';
    var s = Math.abs(Number(x)).toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    var neg = Number(x) < 0 && Number(Math.abs(x).toFixed(d || 0)) !== 0;
    return (neg ? '−' : '') + s.join(',');
  };
  C.eur = function (x, d) { return x == null ? '—' : C.nf(x, d || 0) + NB + '€'; };
  C.eurSigne = function (x, d) { return x == null ? '—' : (x > 0 ? '+' : '') + C.eur(x, d || 0); };
  C.km = function (x, d) { return C.nf(x, d == null ? 1 : d) + NB + 'km'; };
  C.detour = function (p) { return p.detour < 0.05 ? 'sur la route' : 'détour ' + C.nf(p.detour, 1) + NB + 'km'; };
  C.joli = function (s) {   // NOM EN MAJUSCULES -> Nom en minuscules
    return String(s || '').toLowerCase().replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Du|Des|La|Le|Les|Et|Sur|En|Aux|Au|Sous|Pres)\b/g, function (m, w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); })
      .replace(/\b(L|D) (?=[A-ZÀ-Ý])/g, function (m, x) { return x.toLowerCase() + '’'; }).replace(/\bSt\b/g, 'Saint').replace(/\bSte\b/g, 'Sainte');
  };
  C.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };

  // ── Tableau de bord d'UNE tournée (11/11/2026, maquette « Le tableau de bord de la tournée » choisie par Will) ──
  // Fichier version 2 : chaque arrêt porte `m` = [CA, Notre marge, commandes] par mois (null = aucune ligne ce mois-là, ordre de d.mois),
  // `f` = Notre marge par famille (ordre C.FAM), `g` = CA des génériques (leur marge est comptée à zéro, comme sur la fiche officine).
  // Calcul = celui de la fiche (v2-pharma.js rentabiliteDe) : 1 commande = 1 livraison, au plus 1 par jour (11/11/2026) ; « par mois » = sur les mois où la
  // cliente a été livrée ; rentabilité = Notre marge − commandes × coût d'une livraison (coût LU dans le fichier, jamais écrit ici).
  C.FAM = ['p', 'p1', 'p2', 'i', 'c', 'fr', 'nr'];   // = v2-boot.js (V2.notreMarge)
  C.LIBELLES = { p: 'Petits prix (moins de 4,33 €)', p1: 'Petits prix (moins de 3,17 €)', p2: 'De 3,17 à 4,33 €', i: 'De 4,33 à 468 €', c: 'Plus de 468 €', fr: 'Chaîne du froid', nr: 'Non remboursés' };
  C.MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  C.MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  C.moisCourt = function (cle) { return C.MOIS_COURTS[+String(cle).slice(5, 7) - 1] || String(cle); };
  C.moisLong = function (cle) { return (C.MOIS_LONGS[+String(cle).slice(5, 7) - 1] || '') + ' ' + String(cle).slice(0, 4); };
  // commandes par mois : au dixième, la moitié vers le haut (même arrondi que la fiche et que le fichier des tournées)
  C.cmdMois = function (cmd, nm) { return nm ? Math.floor(cmd / nm * 10 + 0.5) / 10 : null; };
  // Totaux d'une cliente à partir de ses mois ; null si elle n'a aucune commande sur la période (comme la fiche : pas de rentabilité).
  C.totCliente = function (m, cout) {
    var ca = 0, mg = 0, cmd = 0, nm = 0;
    (m || []).forEach(function (x) { if (!x) return; ca += x[0]; mg += x[1]; cmd += x[2]; if (x[2] > 0) nm++; });
    if (!cmd) return null;
    return { ca: r2(ca), marge: r2(mg), cmd: cmd, mois_livres: nm, cmd_mois: C.cmdMois(cmd, nm), marge_cmd: r2(mg / cmd), cout: r2(cmd * cout),
      renta: r2(mg - cmd * cout), renta_mois: r2((mg - cmd * cout) / nm), ca_mois: r2(ca / nm), marge_mois: r2(mg / nm), taux: ca > 0 ? r2(mg / ca * 100) : null };
  };
  // Le tableau de bord d'une tournée : clientes (dans l'ordre de livraison), totaux, série des mois, médianes, familles.
  // Rend null si le fichier n'a pas les mois (version 1) : l'écran le dit au lieu d'afficher des zéros.
  C.tableau = function (t, d) {
    if (!t || !d || !Array.isArray(d.mois) || !d.mois.length || !isFinite(Number(d.cout_livraison))) return null;
    var NBm = d.mois.length, cout = Number(d.cout_livraison), F = C.FAM.length, fen = C.fenetreTendance(d.mois, d.couv);
    var cl = (t.arrets || []).map(function (a) {
      var m = Array.isArray(a.m) && a.m.length === NBm ? a.m : null;
      var tot = (a.r && m) ? C.totCliente(m, cout) : null;
      return { n: a.n, id: String(a.id), fi: a.fi ? String(a.fi) : '', nom: a.nom, ville: a.ville, lat: a.lat, lng: a.lng, com: a.com,
        m: tot ? m : null, f: tot && Array.isArray(a.f) ? a.f : null, g: tot ? (+a.g || 0) : 0, tot: tot, tend: tot ? C.tendance(m, fen) : null };
    });
    var V = cl.filter(function (c) { return c.tot; });
    var somme = function (f) { return V.reduce(function (s, c) { return s + f(c); }, 0); };
    var serie = d.mois.map(function (k, i) {
      var ca = 0, mg = 0, cmd = 0, livrees = 0;
      V.forEach(function (c) { var x = c.m[i]; if (!x) return; ca += x[0]; mg += x[1]; cmd += x[2]; if (x[2] > 0) livrees++; });
      return [r2(ca), r2(mg), cmd, r2(mg - cmd * cout), livrees];
    });
    var ca = somme(function (c) { return c.tot.ca; }), mg = somme(function (c) { return c.tot.marge; }), cmd = somme(function (c) { return c.tot.cmd; });
    var fam = {};
    C.FAM.forEach(function (k, i) { fam[k] = r2(somme(function (c) { return c.f && c.f.length === F ? +c.f[i] || 0 : 0; })); });
    var tot = { ca: r2(ca), marge: r2(mg), cmd: cmd, cout: r2(cmd * cout), renta: r2(mg - cmd * cout),
      renta_mois: r2(somme(function (c) { return c.tot.renta_mois; })), ca_mois: r2(somme(function (c) { return c.tot.ca_mois; })),
      marge_mois: r2(somme(function (c) { return c.tot.marge_mois; })), cmd_mois: r2(somme(function (c) { return c.tot.cmd_mois; })),
      marge_cmd: cmd ? r2(mg / cmd) : null, taux: ca > 0 ? r2(mg / ca * 100) : null,
      nb_ventes: V.length, nb_sans: cl.length - V.length, nb_perte: V.filter(function (c) { return c.tot.renta_mois < 0; }).length,
      fam: fam, gen: r2(somme(function (c) { return c.g; })) };
    var med = V.length ? { cmd_mois: C.mediane(V.map(function (c) { return c.tot.cmd_mois; })), marge_cmd: r2(C.mediane(V.map(function (c) { return c.tot.marge_cmd; }))),
      renta_mois: r2(C.mediane(V.map(function (c) { return c.tot.renta_mois; }))) } : null;
    return { code: t.code, nom: t.nom, mois: d.mois.slice(), cout: cout, clientes: cl, serie: serie, tot: tot, med: med, fen: fen };
  };
  // Clientes « qui commandent souvent pour peu de marge » : plus de commandes par mois ET moins de marge par commande que la médiane.
  C.souventPeu = function (tb) {
    if (!tb || !tb.med) return [];
    return tb.clientes.filter(function (c) { return c.tot && c.tot.cmd_mois > tb.med.cmd_mois && c.tot.marge_cmd < tb.med.marge_cmd; });
  };
  // Familles non nulles, de la plus forte à la plus faible ; part = sur la somme des valeurs absolues.
  C.familles = function (fam) {
    var L = C.FAM.filter(function (k) { return fam && Math.round((fam[k] || 0) * 100) !== 0; }).map(function (k) { return { k: k, l: C.LIBELLES[k], v: fam[k] }; });
    var tot = L.reduce(function (s, f) { return s + Math.abs(f.v); }, 0);
    L.forEach(function (f) { f.part = tot ? r2(Math.abs(f.v) / tot * 100) : 0; });
    return L.sort(function (a, b) { return b.v - a.v; });
  };
  // Tri de la liste des clientes : clé de c.tot (ou 'n' = ordre de livraison) ; les clientes sans ventes restent en bas, dans l'ordre de livraison.
  C.trier = function (cl, cle, sens) {
    return cl.slice().sort(function (a, b) {
      if (cle === 'n') return sens * (a.n - b.n);
      if (!a.tot || !b.tot) return (a.tot ? -1 : b.tot ? 1 : 0) || (a.n - b.n);
      var x = cle === 'tend' ? (a.tend ? a.tend.tri : null) : a.tot[cle], y = cle === 'tend' ? (b.tend ? b.tend.tri : null) : b.tot[cle];   // tendance : % d'écart (nouvelle en haut)
      if (x == null || y == null) return (x == null && y == null) ? a.n - b.n : (x == null ? 1 : -1);   // valeur inconnue (taux sans CA) : en bas
      return (sens * (x - y)) || (a.n - b.n);
    });
  };
  // Mois incomplets (ventes pas encore toutes transmises) : texte du Pilotage (V2.pmCouvT), lu dans le fichier (d.couv), mot pour mot.
  C.texteMoisIncomplets = function (mois, couv) {
    var L = (mois || []).filter(function (k) { return couv && couv[k]; }).map(function (k) { return { lib: C.moisLong(k), c: couv[k] }; });
    if (!L.length) return '';
    var sur = function (f) { return f.c[0] + ' secteur' + (f.c[0] > 1 ? 's' : '') + ' sur ' + f.c[1]; };
    return L.length === 1
      ? L[0].lib.charAt(0).toUpperCase() + L[0].lib.slice(1) + ' incomplet : ' + sur(L[0]) + ' ont transmis toutes leurs ventes. Chiffres partiels pour ce mois.'
      : 'Mois incomplets : ' + L.map(function (f) { return f.lib + ' (' + sur(f) + ')'; }).join(', ') + ' ont transmis toutes leurs ventes. Chiffres partiels pour ces mois.';
  };
  // Graduation « ronde » d'un axe (environ 4 pas) ; entier = pas jamais sous 1 (commandes).
  C.pas = function (v, entier) {
    if (!(v > 0)) return { max: entier ? 4 : 1, step: entier ? 1 : 0.25 };
    var r = v / 4, e = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), f = r / e, m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10, s = m * e;
    if (entier && s < 1) s = 1;
    return { max: Math.ceil(v / s - 1e-9) * s, step: s };
  };
  // Montants comme la fiche officine (V2.fmtEur) : 1 000 € et plus en euros entiers, sinon au centime ; inconnu = tiret.
  C.eurF = function (x) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    if (x === 0) return '0' + NB + '€';
    return C.nf(x, Math.abs(x) >= 1000 ? 0 : 2) + NB + '€';
  };
  C.pct = function (x) { return (typeof x === 'number' && isFinite(x)) ? C.nf(x, 2) + NB + '%' : '—'; };
  C.dec1 = function (x) { return (typeof x === 'number' && isFinite(x)) ? C.nf(x, 1) : '—'; };
  C.ent = function (x) { return (typeof x === 'number' && isFinite(x)) ? C.nf(x, 0) : '—'; };
  // graduation d'un axe en euros : k€ dès 2 000 € (une décimale si le pas n'est pas rond : 2,5 k€, jamais « 3 k€ » pour 2 500)
  C.kEur = function (v, max) { return max >= 2000 ? C.nf(v / 1000, v % 1000 ? 1 : 0) + NB + 'k€' : C.nf(v, v % 1 ? 1 : 0) + NB + '€'; };
  C.grad = function (v) { return C.nf(v, v % 1 ? 1 : 0); };

  // ── Les 4 ajouts du tableau de bord (11/11/2026, questions cliquées de Will) ──
  // 1. TENDANCE de chaque cliente : Notre marge par mois des 3 derniers mois COMPLETS contre les mois complets d'avant. Les mois incomplets
  //    (d.couv, lu dans le fichier) sont laissés de côté et nommés à l'écran. « Par mois » compte ici TOUS les mois de la fenêtre, même sans
  //    commande (une cliente qui ne commande plus doit apparaître en baisse). Hausse ou baisse = au moins 10 % d'écart ; sinon stable.
  C.SEUIL_TENDANCE = 10;
  C.fenetreTendance = function (mois, couv) {
    var ok = [], exclus = [];
    (mois || []).forEach(function (k, i) { if (couv && couv[k]) exclus.push(k); else ok.push(i); });
    if (ok.length < 4) return null;   // il faut 3 mois récents ET au moins 1 mois avant
    return { recent: ok.slice(-3), avant: ok.slice(0, -3), exclus: exclus };
  };
  C.tendance = function (m, fen) {
    if (!Array.isArray(m) || !fen) return null;
    var moy = function (ix, j) { return ix.reduce(function (s, i) { return s + (m[i] ? (+m[i][j] || 0) : 0); }, 0) / ix.length; };
    var ma = moy(fen.avant, 1), mr = moy(fen.recent, 1), ca = moy(fen.avant, 0), cr = moy(fen.recent, 0), ka = moy(fen.avant, 2), kr = moy(fen.recent, 2);
    var o = { marge_avant: r2(ma), marge_recent: r2(mr), ca_avant: r2(ca), ca_recent: r2(cr), cmd_avant: C.cmdMois(ka * 10, 10), cmd_recent: C.cmdMois(kr * 10, 10),
      ecart: r2(mr - ma), pct: null, sens: 'stable' };
    if (!ka && !kr) { o.sens = 'aucune'; o.tri = 0; return o; }
    if (!ka) { o.sens = 'nouvelle'; o.tri = 1e9; return o; }
    if (ma > 0) {
      o.pct = r2((mr - ma) / ma * 100);
      o.sens = o.pct >= C.SEUIL_TENDANCE ? 'hausse' : o.pct <= -C.SEUIL_TENDANCE ? 'baisse' : 'stable';
      o.tri = o.pct;
    } else {   // marge d'avant nulle ou négative : un pourcentage ne veut rien dire, on garde l'écart en euros
      o.sens = mr > ma ? 'hausse' : mr < ma ? 'baisse' : 'stable';
      o.tri = o.sens === 'hausse' ? 1e6 : o.sens === 'baisse' ? -1e6 : 0;
    }
    return o;
  };
  C.texteTendance = function (t) {
    if (!t || t.sens === 'aucune') return '—';
    if (t.sens === 'nouvelle') return 'Nouvelle';
    if (t.pct != null) return (t.pct > 0 ? '+' : '') + C.nf(t.pct, 0) + NB + '%';
    return C.eurSigne(t.ecart, 0) + NB + 'par mois';
  };
  C.moisListe = function (mois, ix) {   // « juin, juillet et octobre »
    var L = ix.map(function (i) { return C.MOIS_LONGS[+String(mois[i]).slice(5, 7) - 1] || String(mois[i]); });
    return L.length > 1 ? L.slice(0, -1).join(', ') + ' et ' + L[L.length - 1] : (L[0] || '');
  };
  C.texteFenetre = function (mois, fen) {
    if (!fen) return 'Tendance non calculée : il faut au moins quatre mois complets.';
    var t = 'Tendance = Notre marge par mois des 3 derniers mois complets (' + C.moisListe(mois, fen.recent) + ') contre les ' + fen.avant.length + ' mois complets d’avant (' + C.moisListe(mois, fen.avant) + '), tous les mois comptés même sans commande ; hausse ou baisse à partir de ' + C.SEUIL_TENDANCE + NB + '%.';
    if (fen.exclus.length) t += ' ' + cap0(C.moisListe(mois, fen.exclus.map(function (k) { return mois.indexOf(k); }))) + (fen.exclus.length > 1 ? ', incomplets, sont laissés de côté.' : ', incomplet, est laissé de côté.');
    return t;
  };
  function cap0(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  // Tendance de toute la tournée (somme des clientes) et nombre de clientes en hausse / en baisse / nouvelles.
  C.tendanceTournee = function (tb) {
    if (!tb || !tb.fen) return null;
    var m = tb.mois.map(function (k, i) { var s = tb.serie[i]; return [s[0], s[1], s[2]]; });
    var t = C.tendance(m, tb.fen), n = { hausse: 0, baisse: 0, stable: 0, nouvelle: 0, aucune: 0 };
    tb.clientes.forEach(function (c) { if (c.tend) n[c.tend.sens]++; });
    if (t) t.nb = n;
    return t;
  };

  // 2. SIMULATION « et si… » : coût d'une livraison choisi (par défaut celui du fichier) et livraisons des clientes en perte réduites d'une part.
  //    Hypothèses (écrites à l'écran) : une cliente « en perte » l'est AU COÛT SIMULÉ ; elle garde la même Notre marge (mêmes achats, regroupés
  //    en moins de livraisons) et les mêmes mois livrés ; les autres clientes gardent leurs livraisons.
  C.simuler = function (tb, cout, reduc) {
    if (!tb) return null;
    cout = Number(cout); reduc = Number(reduc) || 0;
    if (!isFinite(cout) || cout < 0 || reduc < 0 || reduc >= 1) return null;
    // cliente inchangée (même coût, mêmes livraisons) : ses chiffres du tableau, au centime près, pour que 0 % au coût du fichier = chiffres actuels
    var V = tb.clientes.filter(function (c) { return c.tot; }), meme = cout === tb.cout, rm = 0, mg = 0, cmd = 0, perteAvant = 0, perteApres = 0, visees = 0;
    V.forEach(function (c) {
      var x = c.tot, perte = meme ? x.renta_mois < 0 : x.marge - x.cmd * cout < 0, k = perte ? x.cmd * (1 - reduc) : x.cmd;
      var rmc = (meme && k === x.cmd) ? x.renta_mois : r2((x.marge - k * cout) / x.mois_livres);
      if (perte) { visees++; perteAvant++; }
      if (rmc < 0) perteApres++;
      cmd += k; mg += x.marge; rm += rmc;
    });
    return { cout: cout, reduc: reduc, visees: visees,
      actuel: { cout: tb.cout, renta: tb.tot.renta, renta_mois: tb.tot.renta_mois, nb_perte: tb.tot.nb_perte, cmd: tb.tot.cmd },
      simule: { renta: r2(mg - cmd * cout), renta_mois: r2(rm), nb_perte_cout: perteAvant, nb_perte: perteApres, cmd: Math.round(cmd) },
      ecart_mois: r2(rm - tb.tot.renta_mois), seuil: tb.tot.marge_cmd };
  };

  // 3. COMPARER deux tournées : les mêmes chiffres que le classement (C.analyser) et que le tableau de bord (C.tableau).
  //    sens : 1 = plus c'est haut, mieux c'est ; -1 = l'inverse ; 0 = ni l'un ni l'autre (rien n'est mis en avant).
  C.comparer = function (A, d, c1, c2) {
    var a = A && A[c1], b = A && A[c2], ta = a && C.tableau(d.tournees[c1], d), tbb = b && C.tableau(d.tournees[c2], d);
    if (!a || !b || !ta || !tbb) return null;
    var ord = C.classer(A, 'rentabilite_mois', -1), ea = C.tendanceTournee(ta), eb = C.tendanceTournee(tbb);
    var L = [
      ['rang', 'Rang au classement', ord.indexOf(c1) + 1, ord.indexOf(c2) + 1, 'rang', -1],
      ['renta_mois', 'Rentabilité par mois', ta.tot.renta_mois, tbb.tot.renta_mois, 'eur', 1],
      ['renta', 'Rentabilité sur la période', ta.tot.renta, tbb.tot.renta, 'eur', 1],
      ['ca', 'CA', ta.tot.ca, tbb.tot.ca, 'eur', 1],
      ['marge', 'Notre marge', ta.tot.marge, tbb.tot.marge, 'eur', 1],
      ['taux', 'Taux de marge', ta.tot.taux, tbb.tot.taux, 'pct', 1],
      ['cmd', 'Commandes', ta.tot.cmd, tbb.tot.cmd, 'ent', 0],
      ['cmd_mois', 'Commandes par mois', ta.tot.cmd_mois, tbb.tot.cmd_mois, 'dec1', 0],
      ['marge_cmd', 'Marge par commande', ta.tot.marge_cmd, tbb.tot.marge_cmd, 'eur', 1],
      ['cout', 'Coût des livraisons', ta.tot.cout, tbb.tot.cout, 'eur', -1],
      ['nb_ventes', 'Clientes avec commandes', ta.tot.nb_ventes, tbb.tot.nb_ventes, 'ent', 0],
      ['nb_perte', 'Clientes en perte', ta.tot.nb_perte, tbb.tot.nb_perte, 'ent', -1],
      ['baisse', 'Clientes en baisse', ea ? ea.nb.baisse : null, eb ? eb.nb.baisse : null, 'ent', -1],
      ['hausse', 'Clientes en hausse', ea ? ea.nb.hausse : null, eb ? eb.nb.hausse : null, 'ent', 1],
      ['nb_arrets', 'Arrêts', a.nb_arrets, b.nb_arrets, 'ent', 0],
      ['km_total', 'Kilomètres (aller et retour)', a.km_total, b.km_total, 'km', 0],
      ['nb_prospects_2km', 'Prospects à 2 km ou moins', a.nb_prospects_2km, b.nb_prospects_2km, 'ent', 1],
      ['potentiel', 'Potentiel par mois', a.potentiel, b.potentiel, 'eur', 0]
    ].map(function (l) {
      var m = 0;
      if (l[5] && typeof l[2] === 'number' && typeof l[3] === 'number' && l[2] !== l[3]) m = (l[2] - l[3]) * l[5] > 0 ? 1 : 2;
      return { k: l[0], l: l[1], a: l[2], b: l[3], f: l[4], mieux: m };
    });
    return { a: c1, b: c2, lignes: L };
  };

  // 4. EXPORT EXCEL de la tournée : les feuilles (tableaux de valeurs, nombres laissés en nombres pour qu'Excel calcule). nomDe(cip) -> { nom, ville }.
  C.feuillesExcel = function (tb, a, d, nomDe, etab, quand) {
    if (!tb || !a) return null;
    var fen = tb.fen, mois = tb.mois, cout = tb.cout, v = function (x) { return typeof x === 'number' && isFinite(x) ? x : ''; };
    var cli = [['N° d’arrêt', 'Cliente', 'Ville', 'Commercial', 'CA (€)', 'Notre marge (€)', 'Taux de marge (%)', 'Commandes', 'Commandes par mois', 'Marge par commande (€)',
      'Coût des livraisons (€)', 'Rentabilité (€)', 'Rentabilité par mois (€)', 'Notre marge par mois, mois d’avant (€)', 'Notre marge par mois, 3 derniers mois (€)', 'Tendance']];
    tb.clientes.forEach(function (c) {
      var x = c.tot, t = c.tend;
      if (!x) { cli.push([c.n, C.joli(c.nom), C.joli(c.ville), c.com || '', 'Aucune commande sur la période']); return; }
      cli.push([c.n, C.joli(c.nom), C.joli(c.ville), c.com || '', v(x.ca), v(x.marge), v(x.taux), v(x.cmd), v(x.cmd_mois), v(x.marge_cmd), v(x.cout), v(x.renta), v(x.renta_mois),
        t ? v(t.marge_avant) : '', t ? v(t.marge_recent) : '', t ? C.texteTendance(t).replace(/ /g, ' ') : '']);
    });
    var T = tb.tot, tt = C.tendanceTournee(tb);
    cli.push(['', 'Total de la tournée ' + tb.code, '', '', v(T.ca), v(T.marge), v(T.taux), v(T.cmd), v(T.cmd_mois), v(T.marge_cmd), v(T.cout), v(T.renta), v(T.renta_mois),
      tt ? v(tt.marge_avant) : '', tt ? v(tt.marge_recent) : '', tt ? C.texteTendance(tt).replace(/ /g, ' ') : '']);
    var couv = d.couv || {}, inc = function (k) { return couv[k] ? 'Incomplet : ' + couv[k][0] + ' secteurs sur ' + couv[k][1] + ' ont transmis toutes leurs ventes' : 'Complet'; };
    var mm = [['Mois', 'CA (€)', 'Notre marge (€)', 'Commandes', 'Rentabilité (€)', 'Clientes livrées', 'Mois']];
    mois.forEach(function (k, i) { var s = tb.serie[i]; mm.push([cap0(C.moisLong(k)), s[0], s[1], s[2], s[3], s[4], inc(k)]); });
    mm.push(['Total', T.ca, T.marge, T.cmd, T.renta, T.nb_ventes, '']);
    var cm = [['N° d’arrêt', 'Cliente', 'Mois', 'CA (€)', 'Notre marge (€)', 'Commandes', 'Rentabilité (€)', 'Mois']];
    tb.clientes.forEach(function (c) {
      if (!c.m) return;
      c.m.forEach(function (x, i) { if (x) cm.push([c.n, C.joli(c.nom), cap0(C.moisLong(mois[i])), x[0], x[1], x[2], r2(x[1] - x[2] * cout), couv[mois[i]] ? 'Incomplet' : 'Complet']); });
    });
    var pr = [['Rang', 'Pharmacie', 'Ville', 'Position sur la route', 'Détour (km)', 'Km depuis le dépôt sur la route', 'Position']];
    a.prospects.forEach(function (p, i) { var n = nomDe ? nomDe(p.cip) : { nom: '', ville: '' }; pr.push([i + 1, n.nom, n.ville, C.position(p).replace(/ /g, ' '), v(p.detour), v(p.km_route), p.fiable ? 'Fiable' : 'À vérifier']); });
    var lire = [['Tournée', tb.code + ' · ' + tb.nom], ['Établissement', etab || ''], ['Période', d.periode || ''], ['Coût d’une livraison (€)', cout],
      ['Extrait le', quand || ''], [], ['Règles de calcul', ''],
      ['Commandes', '1 commande = 1 livraison = 1 jour avec facture, au plus 1 par jour, comme sur la fiche officine.'],
      ['Coût des livraisons', 'Commandes × coût d’une livraison.'], ['Rentabilité', 'Notre marge − coût des livraisons.'],
      ['« Par mois »', 'Divisé par les mois où la cliente a été livrée ; pour la tournée, somme des clientes.'],
      ['Tendance', C.texteFenetre(mois, fen).replace(/ /g, ' ')]];
    if (T.gen > 0) lire.push(['Notre marge', 'Génériques comptés à zéro, comme sur la fiche officine.']);
    var mi = C.texteMoisIncomplets(mois, couv); if (mi) lire.push(['Mois incomplets', mi]);
    return [
      { nom: 'Clientes', lignes: cli, largeurs: [9, 34, 22, 11, 12, 14, 10, 11, 11, 13, 13, 13, 13, 16, 16, 12], filtre: true },
      { nom: 'Mois par mois', lignes: mm, largeurs: [16, 12, 14, 11, 13, 10, 60] },
      { nom: 'Clientes par mois', lignes: cm, largeurs: [9, 34, 16, 12, 14, 11, 13, 11], filtre: true },
      { nom: 'Prospects', lignes: pr, largeurs: [6, 34, 22, 44, 11, 14, 11], filtre: true },
      { nom: 'À lire', lignes: lire, largeurs: [24, 110] }
    ];
  };
  C.nomFichierExcel = function (code, nom, jour) {
    var s = String(code + ' ' + (nom || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'Tournee-' + s.slice(0, 60) + (jour ? '-' + jour : '') + '.xlsx';
  };

  V2.tournees = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  if (!glob.document) return;   // fenêtre des tests : pas d'écran

  // ── Écran ────────────────────────────────────────────────────
  // #tournees        : le classement des tournées (entrée de l'écran, inchangé sauf le clic qui ouvre le tableau de bord)
  // #tournees/T10    : le tableau de bord de la tournée (11/11/2026) : tuiles, mois par mois, familles, « où part la rentabilité »,
  //                    commandes × marge par commande, sur la route (carte, prospects, clientes à faire grossir), liste des clientes.
  //                    Un clic sur une cliente (barre, point, carte, liste) la surligne partout et ouvre son détail mois par mois.
  var esc = C.esc, joli = C.joli, eur = C.eur, eurSigne = C.eurSigne, eurF = C.eurF;
  var COUL = { perte: '#E0556E', sous: '#C7791A', bon: '#1E9E6A', none: '#8A91A4' };
  var COLS = [['rentabilite_mois', 'Rentabilité par mois'], ['marge_jour', 'Marge par commande'], ['nb_perte', 'Clientes en perte'], ['nb_prospects_2km', 'Prospects sur la route'], ['potentiel', 'Potentiel par mois']];
  // colonnes de la liste des clientes : [clé de tot, titre, format]
  var LCOLS = [['ca', 'CA', eurF], ['marge', 'Notre marge', eurF], ['taux', 'Taux de marge', C.pct], ['cmd', 'Commandes', C.ent], ['cmd_mois', 'Commandes par mois', C.dec1],
    ['marge_cmd', 'Marge par commande', eurF], ['cout', 'Coût des livraisons', eurF], ['renta', 'Rentabilité', eurF], ['renta_mois', 'Rentabilité par mois', eurF]];
  var S = { d: null, A: null, erreur: '', charge: false, etab: 'OPS', open: null, sortK: 'rentabilite_mois', sortDir: -1, map: null, cur: null, pf: null, root: null,
    tb: null, tbCode: null, mes: 'ca', pid: null, lk: 'n', ld: 1, rz: false, larg: 0, marq: {} };

  function interdit() {
    var b = glob.V2_BRAND, u = V2.user;
    return !!((b && b.opso) || (u && (u.opsoOnly || u.role === 'opso')));
  }
  function charger() {
    if (glob.TOURNEES_ECRAN) return Promise.resolve(glob.TOURNEES_ECRAN);
    if (!V2.loadFiles) return Promise.reject(new Error('chargeur de fichiers protégés absent'));
    return Promise.resolve(V2.loadFiles(['tournees'])).then(function () {
      if (!glob.TOURNEES_ECRAN) throw new Error('fichier des tournées non reçu');
      return glob.TOURNEES_ECRAN;
    });
  }

  function ensureLeaflet(cb) {
    if (glob.L) { cb(); return; }
    var V = 'vendor/leaflet/', l = document.createElement('link'); l.rel = 'stylesheet'; l.href = V + 'leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = V + 'leaflet.js'; s.onload = function () { cb(); }; s.onerror = function () { cb('err'); }; document.head.appendChild(s);
  }

  function css() {
    if (document.getElementById('trn-css')) return;
    var s = document.createElement('style'); s.id = 'trn-css';
    s.textContent = [
      '.trn-page{max-width:1240px;margin:0 auto;padding:18px 24px 96px;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.trn-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px}',
      // 11/11/2026 : dans les habillages sombres de l'app (data-hab), le texte posé sur le fond de page était illisible : l'en-tête passe sur une plaque
      'html[data-hab] .trn-hd,html[data-hab] .trn-tb-top{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:14px 18px}',
      '.trn-hd h1{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:0}',
      '.trn-hd p{color:var(--muted);font-size:14px;margin:4px 0 0}',
      '.trn-bil{display:flex;gap:28px}',
      '.trn-bil div{text-align:right}.trn-bil b{display:block;font-size:22px;letter-spacing:-.02em}.trn-bil span{font-size:12px;color:var(--muted)}',
      '.trn-note{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:10px 14px;border-radius:var(--r-md);background:#FBF0DF;color:var(--c-amber-txt);font-size:13px;font-weight:500;line-height:1.4}',
      '.trn-etabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:6px 8px 14px;margin:-6px -8px -14px}',
      '.trn-etabs::-webkit-scrollbar{display:none}',
      '.trn-pill{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:var(--tap-min);padding:0 14px;border-radius:var(--r-pill);background:var(--card);border:1px solid var(--line-strong);font-weight:600;font-size:13px;white-space:nowrap;color:var(--ip-ink);cursor:pointer;font-family:inherit}',
      '.trn-pill.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.trn-pill.off{background:var(--surf-sunken);color:var(--muted);border-style:dashed}',
      '.trn-pill.sel:not(.on){border-style:solid;border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.trn-pill .soft{font-weight:500;font-size:12px;color:var(--muted)}',
      '.trn-pill.on .soft{color:#fff}',
      '.trn-attente{max-width:560px;margin:56px auto;padding:32px;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2)}',
      '.trn-attente-t{font-size:22px;font-weight:700;margin-bottom:8px}',
      '.trn-attente p{color:var(--muted);margin:12px 0 0}',
      '.trn-tbl{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden;margin-top:12px}',
      '.trn-row{display:grid;grid-template-columns:44px minmax(220px,2.2fr) 1.5fr 1fr .8fr .9fr 1fr 20px;align-items:center;gap:12px;padding:0 20px;width:100%;text-align:left;border:0;background:none;font:inherit;color:inherit;cursor:pointer}',
      '.trn-th{min-height:40px;font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2);border-bottom:1px solid var(--line);text-transform:uppercase;letter-spacing:.04em;cursor:default}',
      '.trn-th button{font:inherit;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;min-height:40px;border:0;background:none;cursor:pointer}',
      '.trn-th button.s{color:var(--ip-blue)}',
      '.trn-r{border-bottom:1px solid var(--line-2)}',
      '.trn-r>button.trn-row{min-height:52px}',
      '@media (hover:hover){.trn-r:hover>button.trn-row{background:var(--surf-sunken)}}',
      '.trn-go{color:var(--muted);font-size:18px;font-weight:600;text-align:right}',
      '@media (hover:hover){.trn-r:hover .trn-go{color:var(--ip-blue)}}',
      '.trn-rk{font-weight:700;color:var(--muted)}',
      '.trn-nm b{display:block;font-size:14px}.trn-nm span{font-size:12px;color:var(--muted)}',
      '.trn-barre{display:flex;align-items:center;gap:8px;font-weight:700}',
      '.trn-barre i{display:block;height:8px;border-radius:4px;background:var(--ip-blue);min-width:3px}html:not([data-hab]) .trn-barre i{background:linear-gradient(90deg,#7BA4F5,var(--ip-blue))}',
      '.trn-c{font-weight:600}',
      '.trn-neg{color:var(--c-rose-txt)}',
      '.trn-pot{color:var(--ip-blue);font-weight:700}',
      '.trn-li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-sm);background:var(--card);border:1px solid var(--line);margin-bottom:5px;font-size:13px;min-height:44px;width:100%;text-align:left;font-family:inherit;color:inherit}',
      'button.trn-li{cursor:pointer}@media (hover:hover){button.trn-li:hover{border-color:var(--line-strong);background:var(--card-2)}}',
      'button.trn-li.sel{border-color:var(--ip-blue);background:rgba(0,80,230,.08);background:color-mix(in srgb,var(--ip-blue) 9%,var(--card))}',
      '.trn-li div{min-width:0}.trn-li b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.trn-li span{font-size:12px;color:var(--muted)}',
      '.trn-li em{font-style:normal;font-weight:700;color:var(--ip-blue);white-space:nowrap}',
      '.trn-vide{color:var(--muted);font-size:13px}',
      '.trn-m{display:none}',
      '.trn-ic{background:none;border:0}',
      '.trn-pt{width:28px;height:28px;border-radius:50%;border:2px solid #fff;color:#fff;font:700 11px/24px var(--font);text-align:center;box-shadow:0 2px 6px rgba(16,19,28,.3);cursor:pointer}',
      '.trn-pt.sel{box-shadow:0 0 0 3px #10131C,0 2px 8px rgba(16,19,28,.4)}',
      '.trn-lo{width:24px;height:24px;margin:1px;background:#fff;border:2px solid var(--ip-blue);transform:rotate(45deg);border-radius:4px;box-shadow:0 2px 6px rgba(0,52,160,.35);display:flex;align-items:center;justify-content:center}',
      '.trn-lo span{transform:rotate(-45deg);font:700 11px/1 var(--font);color:var(--ip-blue)}',
      '.trn-err{max-width:560px;margin:56px auto;padding:28px;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2)}',
      '.trn-err b{display:block;font-size:20px;margin-bottom:8px}.trn-err p{color:var(--muted);margin:0 0 16px}',
      // ── tableau de bord ──
      '.trn-tb{container-type:inline-size}',
      '.trn-tb-nav{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin-bottom:10px}',
      '.trn-lien{display:inline-flex;align-items:center;min-height:var(--tap-min);padding:0 16px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);font:600 14px var(--font);cursor:pointer;box-shadow:var(--sh-1)}',
      '@media (hover:hover){.trn-lien:hover{border-color:var(--ip-blue);color:var(--ip-blue)}}',
      '.trn-sel-l{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.trn-sel{-webkit-appearance:none;appearance:none;min-height:var(--tap-min);min-width:260px;padding:0 38px 0 14px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath d=%27M1 1.5l5 5 5-5%27 fill=%27none%27 stroke=%27%23646B80%27 stroke-width=%272%27 stroke-linecap=%27round%27/%3E%3C/svg%3E") no-repeat right 14px center;font:600 15px var(--font);color:var(--ip-ink);text-transform:none;letter-spacing:0;box-shadow:var(--sh-1);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',   // WebKit : le nom trop long d'une tournée élargissait la page au téléphone
      '.trn-tb-top{margin-bottom:14px}.trn-tb-hd{margin:4px 0 0}',
      '.trn-kick{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-blue)}',
      '.trn-tb-hd h1{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1.15;margin:4px 0 6px;overflow-wrap:anywhere}',
      '.trn-meta{font-size:13.5px;color:var(--ip-ink-2);margin:0;line-height:1.45}.trn-meta b{font-weight:700;color:var(--ip-ink)}',
      '.trn-per{font-size:13px;color:var(--muted);margin:2px 0 0;line-height:1.45}',
      '.trn-tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}',
      '.trn-tile{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:14px 16px;min-width:0}',
      '.trn-tile .l{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}',
      '.trn-tile .v{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.2;margin:4px 0 2px;white-space:nowrap}',
      '.trn-tile .s{font-size:12px;color:var(--muted);line-height:1.35}.trn-tile .s b{color:var(--ip-ink-2);font-weight:700}',
      '.trn-g2,.trn-g3{display:grid;gap:14px;margin-bottom:14px;align-items:start}',
      '.trn-g2{grid-template-columns:minmax(0,2.6fr) minmax(0,1fr)}.trn-g3{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}',
      '.trn-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:16px 18px;min-width:0;margin-bottom:14px}',
      '.trn-g2>.trn-card,.trn-g3>.trn-card{margin-bottom:0}',
      '.trn-card h2{font-size:15px;font-weight:800;letter-spacing:-.01em;margin:0}',
      '.trn-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.trn-sub{font-size:12px;color:var(--muted);margin:3px 0 10px;line-height:1.4}',
      '.trn-seg{display:inline-flex;gap:4px;padding:4px;border-radius:var(--r-pill);background:var(--card-2);border:1px solid var(--line-strong)}',
      '.trn-seg button{min-height:36px;padding:0 14px;border-radius:var(--r-pill);border:0;background:none;font:600 13px var(--font);color:var(--ip-ink-2);white-space:nowrap;cursor:pointer}',
      '.trn-seg button[aria-pressed=true]{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.trn-chart svg{display:block;width:100%;height:auto;overflow:visible}',
      '.trn-chart text{font-family:var(--font);font-variant-numeric:tabular-nums}',
      '.trn-ax{font-size:10.5px;fill:var(--muted)}.trn-axb{font-size:10.5px;fill:var(--ip-ink-2);font-weight:600}',
      '.trn-gl{stroke:var(--line)}.trn-gl0{stroke:var(--line-strong)}.trn-glv{stroke:var(--line-2)}',
      '.trn-bar{fill:var(--ip-blue)}.trn-hach0{fill:var(--ip-blue);fill-opacity:.16}.trn-hach1{fill:var(--ip-blue);fill-opacity:.55}',
      '.trn-cmd{fill:none;stroke:var(--ip-ink-2);stroke-width:2;stroke-linejoin:round}',
      '.trn-dot{fill:var(--card);stroke:var(--ip-ink-2);stroke-width:1.5}',
      '.trn-dl{font-weight:800;fill:var(--ip-ink);text-anchor:middle}',
      '.trn-hit{cursor:pointer}.trn-hit .bg{fill:transparent}@media (hover:hover){.trn-hit:hover .bg{fill:var(--surf-sunken)}}',
      '.trn-hit.sel .bg{fill:var(--ip-blue);fill-opacity:.12}.trn-hit .ring{visibility:hidden;fill:none;stroke:var(--ip-ink);stroke-width:2}.trn-hit.sel .ring{visibility:visible}',
      '.trn-hit:focus{outline:none}.trn-hit:focus-visible .bg{stroke:var(--ip-blue);stroke-width:1.5}',
      '.trn-rl{font-size:11.5px;fill:var(--ip-ink-2);font-weight:600}.trn-rn{fill:var(--muted)}',
      '.trn-rv{font-size:11.5px;font-weight:700;fill:var(--ip-ink);text-anchor:end}.trn-rv.n{fill:var(--c-rose-txt)}',
      '.trn-pos{fill:var(--ip-blue)}.trn-negf{fill:var(--c-rose)}',
      '.trn-zone{fill:var(--c-rose);fill-opacity:.12}.trn-medl{stroke:var(--ip-ink-2);stroke-dasharray:4 3}',
      '.trn-pt-b{fill:var(--ip-blue);fill-opacity:.85;stroke:var(--card);stroke-width:1.5}.trn-pt-r{fill:var(--c-rose);fill-opacity:.9;stroke:var(--card);stroke-width:1.5}',
      '.trn-lg{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:12px;color:var(--ip-ink-2);margin-top:8px;line-height:1.4}',
      '.trn-lg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px;background:var(--ip-blue)}',
      '.trn-lg i.l{height:0;border-top:2px solid var(--ip-ink-2);border-radius:0;width:14px;vertical-align:3px;background:none}',
      '.trn-lg i.h{background:repeating-linear-gradient(45deg,rgba(0,80,230,.55) 0 2px,rgba(0,80,230,.16) 2px 5px)}',
      '.trn-lg i.z{background:rgba(224,85,110,.22);border:1px solid var(--c-rose)}',
      '.trn-lg i.r{background:var(--c-rose);border-radius:50%}.trn-lg i.b{border-radius:50%}',
      '.trn-quad{font-size:12.5px;color:var(--c-rose-txt);font-weight:600;line-height:1.45;margin:8px 0 0}',
      '.trn-fam{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(60px,1fr) 78px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.5px}',
      '.trn-fam:last-child{border-bottom:0}.trn-fam .t{line-height:1.25}.trn-fam .p{text-align:right;white-space:nowrap}.trn-fam .p small{display:block;color:var(--muted);font-size:11px}',
      '.trn-fam .bar{height:10px;border-radius:5px;background:var(--surf-sunken);overflow:hidden}.trn-fam .bar i{display:block;height:100%;border-radius:5px;background:var(--ip-blue)}',
      '.trn-fam .bar i.n{background:var(--c-rose)}',
      '.trn-scr{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:12px}',
      '.trn-mt,.trn-lst,.trn-mc{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}.trn-mt{font-size:11px}',
      '.trn-mt th,.trn-mt td,.trn-lst>thead>tr>th,.trn-lst>tbody>tr>td,.trn-lst>tfoot>tr>td,.trn-mc th,.trn-mc td{padding:0 6px;height:34px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line-2);background:var(--card)}',
      '.trn-mt th,.trn-lst>thead>tr>th,.trn-mc th{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);background:var(--card-2);height:36px}',
      '.trn-mt th:first-child,.trn-mt td:first-child,.trn-lst>thead>tr>th:first-child,.trn-lst>tbody>tr>td:first-child,.trn-lst>tfoot>tr>td:first-child,.trn-mc th:first-child,.trn-mc td:first-child{position:sticky;left:0;text-align:left;z-index:1;border-right:1px solid var(--line);font-weight:700;color:var(--ip-ink-2)}',
      '.trn-mt th:first-child,.trn-lst>thead>tr>th:first-child,.trn-mc th:first-child{z-index:2}',
      '.trn-mt td.tot,.trn-mc td.tot{font-weight:800;color:var(--ip-ink)}.trn-mt th,.trn-mt td{padding:0 4px}.trn-mt td:first-child{min-width:78px;padding-left:6px}',
      '.trn-mt th.pt,.trn-mc th.pt{color:var(--c-amber-txt)}',
      '.trn-lst>thead>tr>th{white-space:normal;line-height:1.2;vertical-align:bottom;padding-top:4px;padding-bottom:4px;height:44px}',
      '.trn-lst>thead>tr>th button{font:inherit;font-weight:800;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:inherit;background:none;border:0;padding:0;min-height:36px;text-align:inherit;cursor:pointer;line-height:1.2}',
      '.trn-lst>thead>tr>th button.s{color:var(--ip-blue)}',
      '.trn-lst>tbody>tr>td:first-child,.trn-lst>tfoot>tr>td:first-child{min-width:215px;max-width:215px;overflow:hidden;text-overflow:ellipsis}',
      '.trn-lst>tbody>tr[data-p]{cursor:pointer}@media (hover:hover){.trn-lst>tbody>tr[data-p]:hover>td{background:var(--card-2)}}',
      '.trn-lst>tbody>tr.sel>td{background:linear-gradient(rgba(0,80,230,.12),rgba(0,80,230,.12)),var(--card);background:color-mix(in srgb,var(--ip-blue) 12%,var(--card))}',
      '.trn-lst>tbody>tr>td i{font-style:normal;color:var(--muted);margin-right:6px;font-weight:600}',
      '.trn-lst>tfoot>tr>td{font-weight:800;background:linear-gradient(rgba(0,80,230,.07),rgba(0,80,230,.07)),var(--card);background:color-mix(in srgb,var(--ip-blue) 7%,var(--card));border-top:1px solid var(--line-strong)}',
      '.trn-lst>tbody>tr>td.none{text-align:left;color:var(--muted)}',
      '.trn-lst>tbody>tr.trn-x>td{position:static;overflow:visible;white-space:normal;text-align:left;height:auto;padding:0;background:var(--surf-sunken);max-width:none;min-width:0}',
      '.trn-x-in{position:sticky;left:0;max-width:min(860px,calc(100vw - 72px));max-width:min(860px,calc(100cqw - 40px));padding:12px 14px;box-sizing:border-box}',
      '.trn-chip{background:var(--surf-sunken);border-radius:var(--r-md);padding:12px 14px;margin-top:12px}',
      '.trn-chip h3,.trn-x-in h3{font-size:14px;font-weight:800;line-height:1.25;margin:0}',
      '.trn-chip .trn-sub,.trn-x-in .trn-sub{margin:2px 0 8px}',
      '.trn-dl6{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px;margin:0}',
      '.trn-dl6 dt{font-size:10.5px;color:var(--muted);line-height:1.25}',
      '.trn-dl6 dd{font-size:14px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;margin:0}',
      '.trn-mc{font-size:11.5px}.trn-mc th,.trn-mc td{height:30px;background:transparent}.trn-mc th{background:transparent}',
      '.trn-mc th:first-child,.trn-mc td:first-child{background:var(--surf-sunken)}',
      '.trn-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.trn-btn{display:inline-flex;align-items:center;justify-content:center;min-height:var(--tap-min);padding:0 18px;border-radius:var(--r-pill);background:var(--ip-blue);color:#fff;font:700 13px var(--font);box-shadow:var(--sh-blue);border:0;cursor:pointer}',
      '.trn-btn.b2{background:var(--card);color:var(--ip-ink);border:1px solid var(--line-strong);box-shadow:var(--sh-1)}',
      '.trn-ghost{color:var(--muted);font-size:12.5px;margin:0}',
      '.trn-route{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:16px}',
      '.trn-route .trn-mp{height:320px;border-radius:var(--r-md);overflow:hidden;border:1px solid var(--line-strong)}',
      '.trn-route h3{font-size:13px;font-weight:700;margin:0 0 8px}.trn-route h3 .trn-mu{font-weight:500;color:var(--muted)}',
      '.trn-route .trn-col{min-width:0;max-height:320px;overflow-y:auto}',
      // 11/11/2026 — les 4 ajouts : tendance, export Excel, « Et si… », « Comparer avec »
      '.trn-tend-b{color:var(--c-rose-txt);font-weight:700}.trn-tend-h{color:var(--c-mint-txt);font-weight:700}',
      '.trn-tendn{font-size:13px;color:var(--ip-ink-2);margin:0 0 4px;line-height:1.45}.trn-tendn b{font-weight:800}',
      '.trn-tdl{font-size:12.5px;color:var(--ip-ink-2);margin:8px 0 0;line-height:1.45}',
      '.trn-fen{font-size:12px;color:var(--muted);margin:10px 0 0;line-height:1.45}',
      '.trn-nav-d{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;max-width:100%}',
      '.trn-xl{gap:8px}',
      '.trn-champ{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 12px}',
      '.trn-champ label,.trn-champ .lab{font-size:13px;font-weight:700;color:var(--ip-ink-2)}',
      '.trn-cmpt tbody th{font-weight:600}.trn-cmpt .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
      '.trn-champ .u{display:inline-flex;align-items:center;gap:6px;font-weight:700}',
      '.trn-in{width:110px;min-height:var(--tap-min);padding:0 12px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);font:600 16px var(--font);box-shadow:var(--sh-1)}',
      '.trn-in:focus{outline:2px solid var(--ip-blue);outline-offset:1px}',
      '.trn-lien.p{min-height:36px;padding:0 12px;font-size:12.5px}',
      '.trn-res{background:var(--surf-sunken);border-radius:var(--r-md);padding:12px 14px;margin-top:12px}',
      '.trn-res dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;margin:0;font-size:13px}',
      '.trn-res dt{color:var(--ip-ink-2)}.trn-res dd{margin:0;text-align:right;font-weight:800;white-space:nowrap}',
      '.trn-res p{font-size:12.5px;color:var(--ip-ink-2);margin:8px 0 0;line-height:1.45}',
      '.trn-hyp{font-size:12px;color:var(--muted);margin:10px 0 0;line-height:1.45}',
      '.trn-cmpt{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}',
      '.trn-cmpt th,.trn-cmpt td{padding:7px 6px;border-bottom:1px solid var(--line-2);text-align:right;white-space:nowrap}',
      '.trn-cmpt th:first-child,.trn-cmpt td:first-child{text-align:left;white-space:normal;color:var(--ip-ink-2)}',
      '.trn-cmpt thead th{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.trn-cmpt .trn-mieux{color:var(--ip-blue);font-weight:800}',
      '.trn-notes{font-size:12px;color:var(--muted);line-height:1.5;margin:6px 2px 0}.trn-notes p{margin:0 0 6px}',
      '.trn-notes summary{cursor:pointer;font-weight:700;color:var(--ip-ink-2);min-height:var(--tap-min);display:flex;align-items:center}',
      '.trn-notes ul{margin:0;padding-left:18px}.trn-notes li{margin:0 0 4px}',
      '@container (max-width:1000px){',
        '.trn-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}',
        '.trn-g2,.trn-g3{grid-template-columns:minmax(0,1fr)}',
        '.trn-route{grid-template-columns:1fr 1fr}.trn-route>div:first-child{grid-column:1/3}',
      '}',
      '@container (max-width:640px){',
        '.trn-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
        '.trn-tile{padding:12px}.trn-tile .v{font-size:20px}',
        '.trn-card{padding:14px}',
        '.trn-route{grid-template-columns:1fr}.trn-route>div:first-child{grid-column:auto}',
        '.trn-route .trn-mp{height:260px}.trn-route .trn-col{max-height:none}',
        '.trn-fam{grid-template-columns:minmax(0,1.2fr) minmax(40px,.8fr) 70px;gap:8px}',
        '.trn-lst>tbody>tr>td:first-child,.trn-lst>tfoot>tr>td:first-child{min-width:132px;max-width:132px;white-space:normal;line-height:1.25;padding-top:4px;padding-bottom:4px}',   // 360 px : nom sur deux lignes plutôt qu'une colonne figée à moitié d'écran
        '.trn-lst>tbody>tr>td{height:44px}.trn-lst>thead>tr>th button{min-height:44px;min-width:44px;width:100%}',   // lignes et titres de tri touchables, même sans écran tactile détecté
        '.trn-sel-l{width:100%;min-width:0}.trn-sel{flex:1;min-width:0;width:100%;font-size:16px}',
        '.trn-seg button{min-height:var(--tap-min)}',
        '.trn-tb-hd h1{font-size:23px}',
        '.trn-dl6{grid-template-columns:repeat(2,minmax(0,1fr))}',
        '.trn-x-in{max-width:calc(100vw - 64px);max-width:calc(100cqw - 30px)}',
      '}',
      '@media (max-width:900px){',
        '.trn-page{padding:14px 16px 96px}',
        '.trn-hd h1{font-size:23px}.trn-bil{gap:16px}.trn-bil b{font-size:18px}.trn-bil div{text-align:left}',
        '.trn-row{grid-template-columns:34px 1fr auto;gap:4px 10px;padding:8px 14px}',
        '.trn-th{display:none}',
        '.trn-row .trn-nm{grid-column:2}.trn-row .trn-rk{grid-row:span 2;align-self:start;padding-top:6px}',
        '.trn-row .trn-c1{grid-column:3;grid-row:1}',
        '.trn-row .trn-c2,.trn-row .trn-c3,.trn-row .trn-c4,.trn-row .trn-c5,.trn-row .trn-go{display:none}',
        '.trn-m{display:flex;grid-column:2/4;gap:14px;font-size:12px;color:var(--ip-ink-2);flex-wrap:wrap}',
      '}',
      '@media (max-width:700px){.trn-note{font-size:13px}}',
      '@media (pointer:coarse){',
        '.trn-lst>tbody>tr>td{height:44px}',
        '.trn-lst>thead>tr>th button{min-height:44px;min-width:44px;width:100%}',
        '.trn-seg button{min-height:var(--tap-min)}',
        '.trn-sel{font-size:16px}',
        '.trn-page{padding-left:max(24px,env(safe-area-inset-left));padding-right:max(24px,env(safe-area-inset-right))}',
      '}',
      '@media (pointer:coarse) and (max-width:900px){.trn-page{padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}}',
      '@supports not (container-type:inline-size){',
        '@media (max-width:1048px){.trn-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.trn-g2,.trn-g3{grid-template-columns:minmax(0,1fr)}.trn-route{grid-template-columns:1fr 1fr}.trn-route>div:first-child{grid-column:1/3}}',
        '@media (max-width:672px){.trn-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.trn-tile .v{font-size:20px}.trn-route{grid-template-columns:1fr}.trn-route>div:first-child{grid-column:auto}.trn-sel-l{width:100%}.trn-sel{flex:1;min-width:0;width:100%;font-size:16px}.trn-dl6{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function nomPF(cip) {
    if (!S.pf && glob.PHARMA_FR) S.pf = C.indexPF(glob.PHARMA_FR);
    var o = S.pf && S.pf[cip];
    return o ? { nom: joli(o.nom), ville: joli(o.ville) } : { nom: 'Pharmacie (code ' + cip + ')', ville: '' };
  }

  function dessinerEtabs() {
    var el = document.getElementById('trn-etabs'); if (!el) return;
    el.innerHTML = C.etablissements(S.d).map(function (e) {
      return '<button type="button" class="trn-pill ' + (e.actif ? 'on' : 'off') + (S.etab === e.s ? ' sel' : '') + '" data-s="' + esc(e.s) + '" aria-pressed="' + (S.etab === e.s) + '" title="' + esc(e.nom) + ' · ' + esc(e.ville) + '"><b>' + esc(e.s) + '</b>' +
        (e.actif ? '' : '<span class="soft">à recevoir</span>') + '</button>';
    }).join('');
  }
  function etabCourant() { return C.etablissements(S.d).filter(function (e) { return e.s === S.etab; })[0]; }

  function noteJours() {
    var ts = Object.keys(S.A).map(function (k) { return S.A[k]; });
    var sans = ts.filter(function (t) { return !t.jours.length; }).length;
    return 'Jours de livraison provisoires (planning de février), à confirmer.' + (sans ? ' ' + sans + (sans > 1 ? ' tournées sans jour connu : jours à préciser.' : ' tournée sans jour connu : jours à préciser.') : '');
  }

  function dessiner() {
    var root = S.root; if (!root) return;
    if (S.open && S.A[S.open]) { tableauDeBord(S.open); return; }
    var e = etabCourant(), b = C.bilan(S.A);
    var actif = !!(e && e.actif);
    var h = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    h += '<div class="trn-page" id="trn-page"><div class="trn-hd"><div><h1>Quelle tournée travailler en premier&nbsp;?</h1>' +
      '<p>' + (e ? esc(e.nom) + ' · ' : '') + (actif ? b.n + ' tournées classées. Cliquez une ligne pour ouvrir le tableau de bord de la tournée : CA, Notre marge et commandes de chaque cliente, mois par mois, carte et prospects.' : 'Tournées à recevoir.') + '</p></div>' +
      (actif ? '<div class="trn-bil"><div><b>' + eur(b.rentabilite_mois) + '</b><span>rentabilité par mois, ' + b.n + ' tournées</span></div><div><b>' + eurSigne(b.potentiel) + '</b><span>potentiel par mois</span></div></div>' : '') + '</div>';
    if (actif) h += '<div class="trn-note" role="note"><span>' + esc(noteJours()) + (S.d.periode ? ' Chiffres : ' + esc(S.d.periode) + ', une livraison comptée ' + eur(S.d.cout_livraison) + '.' : '') + '</span></div>';
    h += '<div class="trn-etabs" id="trn-etabs"></div><div id="trn-corps"></div></div>';
    root.innerHTML = h;
    dessinerEtabs();
    var corps = document.getElementById('trn-corps');
    if (!actif) {
      corps.innerHTML = e ? '<div class="trn-attente"><div class="trn-attente-t">Tournées à recevoir</div><div><b>' + esc(e.nom) + '</b> · ' + esc(e.ville) +
        '</div><p>Les tournées de cet établissement n’ont pas encore été transmises. Aucun chiffre n’est affiché tant que le fichier n’est pas reçu.</p></div>' : '';
      return;
    }
    corps.innerHTML = '<div class="trn-tbl"><div class="trn-row trn-th" id="trn-th"></div><div id="trn-rows"></div></div>';
    lignes();
  }

  function lignes() {
    var th = document.getElementById('trn-th'), rows = document.getElementById('trn-rows'); if (!th || !rows) return;
    var A = S.A;
    th.innerHTML = '<span>#</span><span>Tournée</span>' + COLS.map(function (c) {
      return '<button type="button" class="' + (S.sortK === c[0] ? 's' : '') + '" data-k="' + c[0] + '">' + c[1] + (S.sortK === c[0] ? (S.sortDir < 0 ? ' ↓' : ' ↑') : '') + '</button>';
    }).join('') + '<span></span>';
    var ord = C.classer(A, S.sortK, S.sortDir);
    var max = Math.max.apply(null, Object.keys(A).map(function (c) { return A[c].rentabilite_mois; }));
    rows.innerHTML = ord.map(function (c, i) {
      var t = A[c], j = C.jours(t);
      return '<div class="trn-r" id="trn-r-' + esc(c) + '"><button type="button" class="trn-row" data-c="' + esc(c) + '" aria-label="' + esc(c) + ' · ' + esc(t.nom) + ' : ouvrir le tableau de bord de la tournée">' +
        '<span class="trn-rk">' + (i + 1) + '</span>' +
        '<span class="trn-nm"><b>' + esc(c) + ' · ' + esc(t.nom) + '</b><span>' + t.nb_arrets + (t.nb_arrets > 1 ? ' arrêts' : ' arrêt') + ' · ' + C.km(t.km_total, 0) + ' · ' + (j ? esc(j) : 'jours à préciser') + '</span></span>' +
        '<span class="trn-barre trn-c1"><span>' + eur(t.rentabilite_mois) + '</span><i style="width:' + Math.max(3, Math.round(Math.max(0, t.rentabilite_mois) / (max > 0 ? max : 1) * 90)) + 'px"></i></span>' +
        '<span class="trn-c trn-c2">' + eur(t.marge_jour, 2) + '</span><span class="trn-c trn-c3 ' + (t.nb_perte ? 'trn-neg' : '') + '">' + t.nb_perte + '</span><span class="trn-c trn-c4">' + t.nb_prospects_2km + '</span><span class="trn-pot trn-c5">' + eurSigne(t.potentiel) + '</span>' +
        '<span class="trn-go" aria-hidden="true">›</span>' +
        '<span class="trn-m"><span>' + eur(t.marge_jour, 2) + ' par commande</span><span>' + t.nb_perte + ' en perte</span><span>' + t.nb_prospects_2km + ' prospects</span><span class="trn-pot">' + eurSigne(t.potentiel) + '</span></span></button></div>';
    }).join('');
  }

  // ── Tableau de bord d'une tournée ──
  function mobile() { var p = document.getElementById('trn-page'); return (p ? p.clientWidth : glob.innerWidth) <= 640; }
  // écran tactile (téléphone en portrait OU tourné, tablette) : cibles dessinées à 44 px, même quand la largeur n'est pas celle d'un téléphone
  function tactile() { try { if (glob.matchMedia && glob.matchMedia('(pointer: coarse)').matches) return true; } catch (e) {} return mobile(); }
  function partiel(k) { return !!(S.d.couv && S.d.couv[S.tb.mois[k]]); }
  function negc(v) { return typeof v === 'number' && v < 0 ? 'trn-neg' : ''; }
  function court(nom, max) { var s = joli(nom); if (mobile()) s = s.replace(/^Pharmacie\s+/i, 'Ph. '); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
  function cliente(pid) { var L = (S.tb && S.tb.clientes) || []; for (var i = 0; i < L.length; i++) if (L[i].id === pid) return L[i]; return null; }
  function ficheDe(c) {   // fiche officine de la cliente dans l'annuaire du CRM : son code, sinon la fiche reliée (même règle que La carte)
    var P = V2.pharmacies || [], k = [c.id].concat(c.fi && c.fi !== c.id ? [c.fi] : []);
    for (var j = 0; j < k.length; j++) for (var i = 0; i < P.length; i++) if (String(P[i].id) === k[j]) return k[j];
    return '';
  }

  function tableauDeBord(code) {
    var root = S.root, t = S.A[code], raw = S.d.tournees[code];
    if (S.tbCode !== code) { S.pid = null; S.tbCode = code; S.lk = 'n'; S.ld = 1; S.simCout = null; S.simRed = 0; S.cmpB = null; }
    var tb = S.tb = C.tableau(raw, S.d), e = etabCourant();
    var ord = C.classer(S.A, 'rentabilite_mois', -1), rang = ord.indexOf(code) + 1;
    var codes = Object.keys(S.A).sort();
    var j = t.jours.length ? esc(t.jours.join(', ')) + ' (jours provisoires, planning de février, à confirmer)' : 'jours de livraison à préciser';
    var h = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    h += '<div class="trn-page trn-tb" id="trn-page"><div class="trn-tb-top">' +
      '<div class="trn-tb-nav"><button type="button" class="trn-lien" data-act="classement">← Les ' + ord.length + ' tournées</button>' +
      '<div class="trn-nav-d"><label class="trn-sel-l">Tournée <select class="trn-sel" id="trn-sel">' + codes.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === code ? ' selected' : '') + '>' + esc(c) + ' · ' + esc(S.A[c].nom) + '</option>'; }).join('') + '</select></label>' +
      (tb ? '<button type="button" class="trn-lien trn-xl" data-act="excel" id="trn-xl">Exporter en Excel</button>' : '') + '</div></div>' +
      '<div class="trn-tb-hd"><div class="trn-kick">Tableau de bord de la tournée' + (e ? ' · ' + esc(e.s) + ' · ' + esc(e.nom) : '') + '</div>' +
      '<h1 data-chk="t.' + esc(code) + '.titre">' + esc(code) + ' · ' + esc(t.nom) + '</h1>' +
      '<p class="trn-meta"><b>' + t.nb_arrets + '</b> ' + (t.nb_arrets > 1 ? 'arrêts' : 'arrêt') + ' · <b>' + C.km(t.km_total, 0) + '</b> (aller ' + C.km(raw.km_aller, 0) + ', retour ' + C.km(raw.km_retour, 0) + ') · ' + j +
        (t.transporteur ? ' · transporteur ' + esc(t.transporteur) : '') + ' · <b>' + rang + '<sup>' + (rang === 1 ? 're' : 'e') + '</sup></b> sur ' + ord.length + ' au classement de la rentabilité par mois</p>' +
      '<p class="trn-per">' + esc(cap(S.d.periode || '')) + ' · 1 commande = 1 livraison, au plus 1 par jour · coût d’une livraison : ' + eurF(Number(S.d.cout_livraison)) + '</p></div></div>';
    if (!tb) {
      root.innerHTML = h + '<div class="trn-err"><b>Détail mois par mois non disponible</b><p>Le fichier des tournées reçu ne porte pas encore les mois de chaque cliente. Rien n’est affiché plutôt que des chiffres faux.</p></div></div>';
      return;
    }
    h += '<section class="trn-tiles" aria-label="Totaux de la tournée">' + tuiles(tb) + '</section>' +
      '<div class="trn-g2"><section class="trn-card" aria-labelledby="trn-h-mois"><div class="trn-ch"><h2 id="trn-h-mois">La tournée mois par mois</h2>' +
        '<span class="trn-seg" role="group" aria-label="Mesure du graphique" id="trn-seg"></span></div><p class="trn-sub" id="trn-sub-mois"></p>' +
        '<div class="trn-chart" id="trn-ch-mois"></div><div class="trn-lg" id="trn-lg-mois"></div><div class="trn-scr"><table class="trn-mt" id="trn-mt"></table></div></section>' +
      '<section class="trn-card" aria-labelledby="trn-h-fam"><h2 id="trn-h-fam">Répartition par famille</h2><p class="trn-sub">Part de Notre marge de la tournée, par famille de produits, ' + esc(S.d.periode || '') + '.</p><div id="trn-fams"></div></section></div>' +
      '<div class="trn-g3"><section class="trn-card" aria-labelledby="trn-h-renta"><h2 id="trn-h-renta">Où part la rentabilité</h2>' +
        '<p class="trn-sub">Rentabilité par mois de chaque cliente (Notre marge − livraisons, sur les mois où elle a été livrée). Pertes à gauche du zéro, en rouge ; gains à droite. Touchez une barre pour voir la cliente.</p><div class="trn-chart" id="trn-ch-renta"></div></section>' +
      '<section class="trn-card" aria-labelledby="trn-h-nuage"><h2 id="trn-h-nuage">Commandes par mois × marge par commande</h2>' +
        '<p class="trn-sub">Un point = une cliente. Les lignes pointillées sont les médianes de la tournée. Touchez un point pour voir la cliente.</p><div class="trn-chart" id="trn-ch-nuage"></div>' +
        '<div class="trn-lg"><span><i class="b"></i>Cliente</span><span><i class="z"></i>Commandent souvent, pour peu de marge (plus de commandes par mois et moins de marge par commande que la médiane)</span></div>' +
        '<p class="trn-quad" id="trn-quad"></p><div class="trn-chip" id="trn-chip" aria-live="polite"></div></section></div>' +
      '<section class="trn-card" aria-labelledby="trn-h-route"><h2 id="trn-h-route">Sur la route</h2><p class="trn-sub">Carte de la tournée (couleur = rentabilité par mois de la cliente), prospects à voir en priorité et clientes à faire grossir. Touchez une cliente pour la voir.' + (tactile() ? ' Deux doigts pour déplacer ou zoomer la carte.' : '') + '</p><div class="trn-route" id="trn-route"></div></section>' +
      '<div class="trn-g3"><section class="trn-card" aria-labelledby="trn-h-sim" id="trn-sim"></section><section class="trn-card" aria-labelledby="trn-h-cmp" id="trn-cmp"></section></div>' +
      '<section class="trn-card" aria-labelledby="trn-h-liste" id="trn-liste-c"><h2 id="trn-h-liste">Les clientes de la tournée</h2>' +
        '<p class="trn-sub" id="trn-sub-liste"></p><p class="trn-tendn" id="trn-tendn">' + texteTendances(tb) + '</p><div class="trn-scr" id="trn-scr-liste"><table class="trn-lst" id="trn-lst"></table></div>' +
        '<p class="trn-fen" id="trn-fen">' + esc(C.texteFenetre(tb.mois, tb.fen)) + '</p></section>' +
      notes(tb) + '</div>';
    root.innerHTML = h;
    var sel = document.getElementById('trn-sel');
    if (sel) sel.onchange = function () { if (sel.value && sel.value !== S.open) V2.go('tournees', sel.value); };
    segs(); familles(tb); liste(); route(code); simCarte(); cmpCarte(); graphiques(); chip();
    S.larg = (document.getElementById('trn-page') || {}).clientWidth || 0;
    suivreLargeur();
  }
  // Les graphiques sont dessinés à la largeur de leur cadre : on les redessine dès que cette largeur change, quelle qu'en soit la cause
  // (fenêtre, téléphone tourné, feuille de style de l'app arrivée APRÈS le premier dessin — vu le 11/11/2026 sous WebKit : graphiques
  // dessinés trop larges puis réduits, texte minuscule). ResizeObserver sur la page ; à défaut, l'événement « resize » de la fenêtre.
  function suivreLargeur() {
    var p = document.getElementById('trn-page'); if (!p) return;
    var tmr, verifier = function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () {
        var q = document.getElementById('trn-page');
        if (!q || !S.tb || !V2.route || V2.route.name !== 'tournees' || !S.open || q.clientWidth === S.larg) return;
        S.larg = q.clientWidth; graphiques(); liste();
        if (S.cur && S.cur.fit) S.cur.fit();
      }, 120);
    };
    if (glob.ResizeObserver) {
      if (S.ro) { try { S.ro.disconnect(); } catch (e) {} }
      S.ro = new glob.ResizeObserver(verifier); S.ro.observe(p);
    } else if (!S.rz) { S.rz = true; glob.addEventListener('resize', verifier); }
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function tuiles(tb) {
    var x = tb.tot, c = tb.code;
    function tile(l, v, key, fm, s) { return '<div class="trn-tile"><div class="l">' + l + '</div><div class="v ' + negc(v) + '" data-chk="t.' + c + '.' + key + '">' + fm(v) + '</div><div class="s">' + s + '</div></div>'; }
    return tile('CA', x.ca, 'ca', eurF, '<b data-chk="t.' + c + '.ca_mois">' + eurF(x.ca_mois) + '</b> par mois') +
      tile('Notre marge', x.marge, 'marge', eurF, 'Taux de marge <b data-chk="t.' + c + '.taux">' + C.pct(x.taux) + '</b>') +
      tile('Commandes', x.cmd, 'cmd', C.ent, '<b data-chk="t.' + c + '.cmd_mois">' + C.dec1(x.cmd_mois) + '</b> par mois') +
      tile('Marge par commande', x.marge_cmd, 'marge_cmd', eurF, 'Notre marge ÷ commandes') +
      tile('Coût des livraisons', x.cout, 'cout', eurF, C.ent(x.cmd) + ' commandes × ' + eurF(tb.cout)) +
      tile('Rentabilité', x.renta, 'renta', eurF, '<b class="' + negc(x.renta_mois) + '" data-chk="t.' + c + '.renta_mois">' + eurF(x.renta_mois) + '</b> par mois · <b data-chk="t.' + c + '.nb_perte">' + x.nb_perte + '</b> ' +
        (x.nb_perte > 1 ? 'clientes' : 'cliente') + ' en perte sur ' + x.nb_ventes);
  }
  function segs() {
    var el = document.getElementById('trn-seg'); if (!el) return;
    el.innerHTML = [['ca', 'CA'], ['marge', 'Notre marge']].map(function (m) { return '<button type="button" data-m="' + m[0] + '" aria-pressed="' + (S.mes === m[0]) + '">' + m[1] + '</button>'; }).join('');
  }

  // graphique des mois : barres (CA ou Notre marge, échelle de gauche) + commandes en points numérotés (échelle de droite) ; tableau chiffré dessous
  function chMois() {
    var tb = S.tb, el = document.getElementById('trn-ch-mois'); if (!tb || !el) return;
    var c = tb.code, idx = S.mes === 'ca' ? 0 : 1, lab = S.mes === 'ca' ? 'CA' : 'Notre marge', mob = mobile(), NBm = tb.mois.length;
    var W = Math.max(280, el.clientWidth || 600), H = mob ? 230 : 270, L = mob ? 44 : 52, R = mob ? 30 : 40, Tp = 18, B = 26, iw = W - L - R, ih = H - Tp - B;
    var vmax = 0, cmax = 0;
    tb.serie.forEach(function (s) { if (s[idx] > vmax) vmax = s[idx]; if (s[2] > cmax) cmax = s[2]; });
    var ny = C.pas(vmax), nc = C.pas(cmax, true), band = iw / NBm, bw = Math.min(46, band * 0.62), g, inc = false;
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + lab + ' et commandes de la tournée ' + esc(c) + ', mois par mois"><defs><pattern id="trn-hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="trn-hach0" width="6" height="6"/><rect class="trn-hach1" width="2.5" height="6"/></pattern></defs>';
    for (g = 0; g <= Math.round(ny.max / ny.step); g++) {
      var gv = g * ny.step, gy = Tp + ih - gv / ny.max * ih;
      o += '<line class="' + (g ? 'trn-gl' : 'trn-gl0') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="trn-ax" x="' + (L - 6) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + C.kEur(gv, ny.max) + '</text>';
    }
    for (g = 0; g <= Math.round(nc.max / nc.step); g++) {
      var cv = g * nc.step, cy = Tp + ih - cv / nc.max * ih;
      o += '<text class="trn-ax" x="' + (W - R + 6) + '" y="' + (cy + 3.5).toFixed(1) + '" text-anchor="start">' + C.grad(cv) + '</text>';
    }
    var pts = [];
    tb.serie.forEach(function (s, i) {
      var v = s[idx], x = L + band * i + (band - bw) / 2, bh = Math.max(0, v / ny.max * ih), y = Tp + ih - bh, p = partiel(i);
      if (p) inc = true;
      o += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="5" ' +
        (p ? 'fill="url(#trn-hach)" class="trn-gl0" stroke-width="1"' : 'class="trn-bar" fill-opacity="' + (0.30 + 0.62 * (ny.max ? Math.max(0, v) / ny.max : 0)).toFixed(2) + '"') + '/>';
      o += '<text class="trn-axb" x="' + (L + band * i + band / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + (mob ? C.moisCourt(tb.mois[i]).charAt(0).toUpperCase() : C.moisCourt(tb.mois[i])) + (p ? '*' : '') + '</text>';
      pts.push([L + band * i + band / 2, Tp + ih - s[2] / nc.max * ih, s[2]]);
    });
    o += '<polyline class="trn-cmd" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    var r = mob ? 10 : 11;
    pts.forEach(function (p, i) {
      o += '<circle class="trn-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '"/><text class="trn-dl" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3.4).toFixed(1) + '" style="font-size:' + (p[2] >= 1000 ? 8 : p[2] >= 100 ? (mob ? 8 : 9) : (mob ? 9 : 10)) + 'px" data-chk="t.' + c + '.m' + i + '.cmd">' + C.ent(p[2]) + '</text>';
    });
    el.innerHTML = o + '</svg>';
    var sub = document.getElementById('trn-sub-mois');
    if (sub) sub.textContent = lab + ' en barres (échelle de gauche) · commandes en points numérotés (échelle de droite)' + (inc ? ' · * mois incomplet' : '');
    var lg = document.getElementById('trn-lg-mois');
    if (lg) lg.innerHTML = '<span><i></i>' + lab + '</span><span><i class="l"></i>Commandes</span>' + (inc ? '<span><i class="h"></i>Mois incomplet (ventes pas toutes transmises)</span>' : '');
    // tableau chiffré : les mesures, mois par mois, et le total de la période
    var t = tb.tot, rows = [['CA', 0, 'ca', eurF, t.ca], ['Notre marge', 1, 'marge', eurF, t.marge], ['Commandes', 2, 'cmd', C.ent, t.cmd], ['Rentabilité', 3, 'renta', eurF, t.renta], ['Clientes livrées', 4, 'livrees', C.ent, t.nb_ventes]];
    var m = '<thead><tr><th scope="col">Mois</th>' + tb.mois.map(function (k, i) { return '<th scope="col"' + (partiel(i) ? ' class="pt" title="Mois incomplet"' : '') + '>' + C.moisCourt(k) + (partiel(i) ? '*' : '') + '</th>'; }).join('') + '<th scope="col">Total</th></tr></thead><tbody>';
    rows.forEach(function (rw) {
      m += '<tr><td>' + rw[0] + '</td>' + tb.serie.map(function (s, i) { return '<td class="' + negc(s[rw[1]]) + '" data-chk="t.' + c + '.m' + i + '.' + rw[2] + '">' + rw[3](s[rw[1]]) + '</td>'; }).join('') +
        '<td class="tot ' + negc(rw[4]) + '">' + rw[3](rw[4]) + '</td></tr>';
    });
    var tab = document.getElementById('trn-mt'); if (tab) tab.innerHTML = m + '</tbody>';
  }

  function familles(tb) {
    var el = document.getElementById('trn-fams'); if (!el) return;
    var fs = C.familles(tb.tot.fam), mx = 0;
    fs.forEach(function (f) { if (Math.abs(f.v) > mx) mx = Math.abs(f.v); });
    el.innerHTML = fs.map(function (f, i) {
      var w = mx > 0 ? Math.abs(f.v) / mx * 100 : 0;
      return '<div class="trn-fam"><span class="t">' + esc(f.l) + '</span><span class="bar" aria-hidden="true"><i class="' + (f.v < 0 ? 'n' : '') + '" style="width:' + w.toFixed(1) + '%;opacity:' + (f.v < 0 ? 1 : Math.max(0.35, 0.95 - i * 0.14)).toFixed(2) + '"></i></span>' +
        '<span class="p"><b class="' + negc(f.v) + '" data-chk="t.' + tb.code + '.fam.' + f.k + '">' + eurF(f.v) + '</b><small>' + C.pct(f.part) + '</small></span></div>';
    }).join('') + (tb.tot.gen > 0 ? '<p class="trn-ghost" style="margin-top:8px">Génériques comptés à zéro dans Notre marge, comme sur la fiche officine.</p>' : '') ||
      '<p class="trn-ghost">Aucune famille renseignée.</p>';
  }

  function avecVentes() { return S.tb.clientes.filter(function (c) { return c.tot; }); }

  // « Où part la rentabilité » : une barre par cliente, de la plus rentable à la plus en perte
  function chRenta() {
    var el = document.getElementById('trn-ch-renta'); if (!S.tb || !el) return;
    var cl = avecVentes().sort(function (a, b) { return b.tot.renta_mois - a.tot.renta_mois; }), mob = mobile();
    var W = Math.max(280, el.clientWidth || 520), rh = tactile() ? 44 : 26, lw = mob ? 136 : 200, vw = mob ? 74 : 80, H = cl.length * rh + 22;
    var mn = 0, mx = 0;
    cl.forEach(function (c) { var v = c.tot.renta_mois; if (v < mn) mn = v; if (v > mx) mx = v; });
    var aw = W - lw - vw - 8, sc = aw / ((mx - mn) || 1), x0 = lw + (-mn) * sc;
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Rentabilité par mois de chaque cliente de la tournée">';
    o += '<line class="trn-gl0" x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="0" y2="' + (H - 22) + '"/>';
    cl.forEach(function (c, i) {
      var v = c.tot.renta_mois, y = i * rh, bw = Math.abs(v) * sc, bx = v < 0 ? x0 - bw : x0, bhh = rh > 30 ? 14 : 12;
      o += '<g class="trn-hit" data-p="' + esc(c.id) + '" tabindex="0" role="button" aria-label="' + esc(joli(c.nom)) + ' : rentabilité par mois ' + eurF(v) + '"><rect class="bg" x="0" y="' + y + '" width="' + W + '" height="' + rh + '" rx="6"/>' +
        '<text class="trn-rl" x="4" y="' + (y + rh / 2 + 4) + '"><tspan class="trn-rn">' + c.n + ' · </tspan>' + esc(court(c.nom, mob ? 16 : 26)) + '</text>' +
        '<rect class="' + (v < 0 ? 'trn-negf' : 'trn-pos') + '" x="' + bx.toFixed(1) + '" y="' + (y + rh / 2 - bhh / 2) + '" width="' + Math.max(bw, 1.5).toFixed(1) + '" height="' + bhh + '" rx="3"/>' +
        '<text class="trn-rv' + (v < 0 ? ' n' : '') + '" x="' + (W - 2) + '" y="' + (y + rh / 2 + 4) + '" data-chk="c.' + esc(c.id) + '.renta_mois">' + eurF(v) + '</text></g>';
    });
    el.innerHTML = o + '<text class="trn-ax" x="' + x0.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">0 €</text></svg>';
  }

  // nuage : commandes par mois (x) × marge par commande (y), médianes de la tournée en pointillés, zone « souvent pour peu de marge » en rose
  function chNuage() {
    var tb = S.tb, el = document.getElementById('trn-ch-nuage'); if (!tb || !el) return;
    var cl = avecVentes(), mob = mobile(), med = tb.med; if (!med) { el.innerHTML = '<p class="trn-ghost">Aucune cliente avec des ventes.</p>'; return; }
    var W = Math.max(280, el.clientWidth || 520), H = mob ? 310 : 370, L = mob ? 44 : 50, R = 16, Tp = 24, B = 36, iw = W - L - R, ih = H - Tp - B;
    var xs = cl.map(function (c) { return c.tot.cmd_mois; }).sort(function (a, b) { return a - b; }), n = xs.length;
    var xcap = (n > 2 && xs[n - 1] > xs[n - 2] * 1.8) ? xs[n - 2] * 1.15 : xs[n - 1] * 1.05;   // une valeur très à part ne doit pas écraser toutes les autres : elle sort du cadre, fléchée
    var ymax = 0, ymin = 0;
    cl.forEach(function (c) { if (c.tot.marge_cmd > ymax) ymax = c.tot.marge_cmd; if (c.tot.marge_cmd < ymin) ymin = c.tot.marge_cmd; });
    var haut = Math.max(ymax * 1.04, med.marge_cmd * 1.3), nx = C.pas(Math.max(xcap, med.cmd_mois * 1.3)), ny = C.pas(haut - ymin), y0 = 0;
    if (ymin < 0) { y0 = -Math.ceil(-ymin / ny.step - 1e-9) * ny.step; ny = { max: Math.ceil((haut - y0) / ny.step - 1e-9) * ny.step, step: ny.step }; }   // marge par commande négative : l'axe descend sous zéro
    var yspan = ny.max;
    function X(v) { return L + Math.max(0, Math.min(v, nx.max)) / nx.max * iw; }
    function Y(v) { return Tp + ih - (Math.max(y0, Math.min(v, y0 + yspan)) - y0) / yspan * ih; }
    var mxp = X(med.cmd_mois), myp = Y(med.marge_cmd), g;
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Commandes par mois et marge par commande de chaque cliente de la tournée">';
    o += '<rect class="trn-zone" x="' + mxp.toFixed(1) + '" y="' + myp.toFixed(1) + '" width="' + Math.max(0, L + iw - mxp).toFixed(1) + '" height="' + Math.max(0, Y(y0) - myp).toFixed(1) + '"/>';
    for (g = 0; g <= Math.round(yspan / ny.step); g++) { var yv = y0 + g * ny.step, gy = Y(yv); o += '<line class="' + (yv === 0 ? 'trn-gl0' : 'trn-gl') + '" x1="' + L + '" x2="' + (L + iw) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="trn-ax" x="' + (L - 6) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + C.kEur(yv, 0) + '</text>'; }
    for (g = 0; g <= Math.round(nx.max / nx.step); g++) { var gx = X(g * nx.step); o += '<line class="trn-glv" x1="' + gx.toFixed(1) + '" x2="' + gx.toFixed(1) + '" y1="' + Tp + '" y2="' + (Tp + ih) + '"/><text class="trn-ax" x="' + gx.toFixed(1) + '" y="' + (Tp + ih + 14) + '" text-anchor="middle">' + C.grad(g * nx.step) + '</text>'; }
    o += '<text class="trn-ax" x="' + (L + iw / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Commandes par mois</text>';
    o += '<text class="trn-ax" x="2" y="10">↑ Marge par commande</text>';   // titre de l'axe à l'horizontale, au-dessus des graduations (le titre tourné les chevauchait au téléphone)
    o += '<line class="trn-medl" x1="' + mxp.toFixed(1) + '" x2="' + mxp.toFixed(1) + '" y1="' + Tp + '" y2="' + (Tp + ih) + '"/><line class="trn-medl" x1="' + L + '" x2="' + (L + iw) + '" y1="' + myp.toFixed(1) + '" y2="' + myp.toFixed(1) + '"/>';
    o += '<text class="trn-ax" x="' + (mxp + 4).toFixed(1) + '" y="' + (Tp - 4) + '">médiane ' + C.dec1(med.cmd_mois) + ' par mois</text><text class="trn-ax" x="' + (L + iw - 2) + '" y="' + (myp - 5).toFixed(1) + '" text-anchor="end">médiane ' + eurF(med.marge_cmd) + '</text>';
    var q = C.souventPeu(tb), qset = {}, out = [];
    q.forEach(function (c) { qset[c.id] = 1; });
    cl.forEach(function (c) {
      var inq = !!qset[c.id], cut = c.tot.cmd_mois > nx.max, px = X(c.tot.cmd_mois), py = Y(c.tot.marge_cmd);
      if (cut) out.push(c);
      o += '<g class="trn-hit" data-p="' + esc(c.id) + '" tabindex="0" role="button" aria-label="' + esc(joli(c.nom)) + ' : ' + C.dec1(c.tot.cmd_mois) + ' commandes par mois, ' + eurF(c.tot.marge_cmd) + ' par commande">' +
        '<circle class="bg" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (tactile() ? 22 : 13) + '"/><circle class="ring" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="10"/>' +
        (cut ? '<path class="trn-negf" d="M' + (px - 9).toFixed(1) + ' ' + py.toFixed(1) + ' l-8 -5 v10 z"/>' : '') +
        '<circle class="' + (inq ? 'trn-pt-r' : 'trn-pt-b') + '" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6"/></g>';
    });
    el.innerHTML = o + '</svg>';
    var qt = '<b data-chk="t.' + esc(tb.code) + '.nb_souvent">' + q.length + '</b>' + (q.length > 1 ? ' clientes commandent' : ' cliente commande') + ' souvent pour peu de marge.';
    if (out.length) qt += ' Hors du cadre (flèche) : ' + out.map(function (c) { return esc(joli(c.nom)) + ', ' + C.dec1(c.tot.cmd_mois) + ' commandes par mois'; }).join(' ; ') + '.';
    var qe = document.getElementById('trn-quad'); if (qe) qe.innerHTML = qt;
  }

  // détail mois par mois d'une cliente (dans la fiche courte et sous sa ligne de la liste)
  function moisCliente(c) {
    var tb = S.tb, x = c.tot;
    if (!x) return '<p class="trn-ghost">Aucune commande ' + esc(S.d.periode || 'sur la période') + '.</p>';
    function dd(l, v, fm, k) { return '<div><dt>' + l + '</dt><dd class="' + negc(v) + '"' + (k ? ' data-chk="c.' + esc(c.id) + '.' + k + '"' : '') + '>' + fm(v) + '</dd></div>'; }
    var h = '<dl class="trn-dl6">' + dd('CA', x.ca, eurF) + dd('Notre marge', x.marge, eurF) + dd('Commandes', x.cmd, C.ent) + dd('Commandes par mois', x.cmd_mois, C.dec1) +
      dd('Marge par commande', x.marge_cmd, eurF) + dd('Rentabilité par mois', x.renta_mois, eurF) + '</dl>';
    var t = c.tend;
    if (t && t.sens !== 'aucune') h += '<p class="trn-tdl">Tendance <b class="' + clTend(t) + '" data-chk="c.' + esc(c.id) + '.tend.x">' + esc(C.texteTendance(t)) + '</b> : Notre marge par mois <b>' + eurF(t.marge_avant) + '</b> sur les mois complets d’avant, <b>' + eurF(t.marge_recent) + '</b> sur les 3 derniers mois complets (commandes par mois : ' + C.dec1(t.cmd_avant) + ' puis ' + C.dec1(t.cmd_recent) + ').</p>';
    var R = [['Commandes', function (m) { return m ? C.ent(m[2]) : '—'; }, C.ent(x.cmd)], ['CA', function (m) { return m ? eurF(m[0]) : '—'; }, eurF(x.ca)],
      ['Notre marge', function (m) { return m ? eurF(m[1]) : '—'; }, eurF(x.marge)],
      ['Rentabilité', function (m) { return m ? eurF(r2(m[1] - m[2] * tb.cout)) : '—'; }, eurF(x.renta)]];
    h += '<div class="trn-scr"><table class="trn-mc" aria-label="' + esc(joli(c.nom)) + ', mois par mois"><thead><tr><th scope="col">Mois</th>' + tb.mois.map(function (k, i) { return '<th scope="col"' + (partiel(i) ? ' class="pt"' : '') + '>' + C.moisCourt(k) + (partiel(i) ? '*' : '') + '</th>'; }).join('') + '<th scope="col">Total</th></tr></thead><tbody>' +
      R.map(function (rw, ri) {
        return '<tr><td>' + rw[0] + '</td>' + c.m.map(function (m, i) { var v = m && ri === 3 ? m[1] - m[2] * tb.cout : null; return '<td class="' + (v != null && v < 0 ? 'trn-neg' : '') + '"' + (ri === 0 ? ' data-chk="c.' + esc(c.id) + '.m' + i + '.cmd"' : '') + '>' + rw[1](m) + '</td>'; }).join('') +
          '<td class="tot">' + rw[2] + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }
  function chip() {
    var el = document.getElementById('trn-chip'); if (!el) return;
    var c = S.pid && cliente(S.pid);
    if (!c) { el.innerHTML = '<p class="trn-ghost">Touchez un point, une barre, un arrêt de la carte ou une ligne de la liste : la cliente est surlignée partout, avec son détail mois par mois.</p>'; return; }
    var f = ficheDe(c);
    el.innerHTML = '<h3>' + c.n + ' · ' + esc(joli(c.nom)) + '</h3><p class="trn-sub">' + esc(joli(c.ville)) + ' · arrêt n°' + NB + c.n + ' de la tournée' + (c.com ? ' · commercial ' + esc(c.com) : '') + '</p>' + moisCliente(c) +
      '<div class="trn-act"><button type="button" class="trn-btn" data-act="voir-ligne" data-id="' + esc(c.id) + '">Voir sa ligne dans la liste</button>' +
      (f ? '<button type="button" class="trn-btn b2" data-act="fiche" data-id="' + esc(f) + '">Ouvrir sa fiche</button>' : '') + '</div>';
  }

  function liste() {
    var tb = S.tb, el = document.getElementById('trn-lst'); if (!tb || !el) return;
    var scr = document.getElementById('trn-scr-liste'), sl = scr ? scr.scrollLeft : 0;
    var cl = C.trier(tb.clientes, S.lk, S.ld), c0 = tb.code, t = tb.tot;
    var titre = S.lk === 'n' ? 'dans l’ordre de livraison' : 'triées par ' + (S.lk === 'tend' ? 'tendance' : LCOLS.filter(function (k) { return k[0] === S.lk; })[0][1].toLowerCase()) + (S.ld < 0 ? ', de la plus forte à la plus faible' : ', de la plus faible à la plus forte');
    var sub = document.getElementById('trn-sub-liste');
    if (sub) sub.textContent = 'Clientes ' + titre + '. Coût des livraisons = commandes × ' + eurF(tb.cout) + ' · Rentabilité = Notre marge − livraisons · « par mois » = sur les mois où la cliente a été livrée. Touchez un titre pour trier, une ligne pour voir la cliente mois par mois.';
    function thb(k, l) {
      var s = S.lk === k, srt = s ? (S.ld < 0 ? 'descending' : 'ascending') : 'none';
      return '<th scope="col" aria-sort="' + srt + '"><button type="button" class="' + (s ? 's' : '') + '" data-lk="' + k + '">' + l + (s ? (S.ld < 0 ? ' ↓' : ' ↑') : '') + '</button></th>';
    }
    var h = '<thead><tr>' + thb('n', 'Cliente (ordre de livraison)') + LCOLS.map(function (k) { return thb(k[0], k[1]); }).join('') + thb('tend', 'Tendance') + '</tr></thead><tbody>';
    cl.forEach(function (c) {
      var sel = c.id === S.pid;
      var nm = '<td title="' + esc(joli(c.nom)) + ' · ' + esc(joli(c.ville)) + '"><i>' + c.n + '</i>' + esc(court(c.nom, 60)) + '</td>';   // au téléphone : « Ph. » pour garder le nom lisible
      if (!c.tot) { h += '<tr data-p="' + esc(c.id) + '" tabindex="0" class="' + (sel ? 'sel' : '') + '" aria-selected="' + sel + '">' + nm + '<td class="none" colspan="' + (LCOLS.length + 1) + '">Aucune commande ' + esc(S.d.periode || '') + '</td></tr>'; }
      else {
        h += '<tr data-p="' + esc(c.id) + '" tabindex="0" class="' + (sel ? 'sel' : '') + '" aria-selected="' + sel + '">' + nm + LCOLS.map(function (k) {
          var v = c.tot[k[0]]; return '<td class="' + negc(v) + '" data-chk="c.' + esc(c.id) + '.' + k[0] + '">' + k[2](v) + '</td>'; }).join('') + tdTend(c.tend, 'c.' + esc(c.id) + '.tend') + '</tr>';
      }
      if (sel) {
        var f = ficheDe(c);
        h += '<tr class="trn-x"><td colspan="' + (LCOLS.length + 2) + '"><div class="trn-x-in"><h3>' + c.n + ' · ' + esc(joli(c.nom)) + '</h3><p class="trn-sub">' + esc(joli(c.ville)) + (c.com ? ' · commercial ' + esc(c.com) : '') + '</p>' +
          moisCliente(c) + '<div class="trn-act">' + (f ? '<button type="button" class="trn-btn" data-act="fiche" data-id="' + esc(f) + '">Ouvrir sa fiche</button>' : '') +
          '<button type="button" class="trn-btn b2" data-act="fermer">Fermer</button></div></div></td></tr>';
      }
    });
    h += '</tbody><tfoot><tr><td>Total de la tournée ' + esc(c0) + '</td>' + LCOLS.map(function (k) { return '<td class="' + negc(t[k[0]]) + '" data-chk="t.' + esc(c0) + '.' + k[0] + '">' + k[2](t[k[0]]) + '</td>'; }).join('') + tdTend(C.tendanceTournee(tb), 't.' + esc(c0) + '.tend') + '</tr></tfoot>';
    el.innerHTML = h;
    if (scr) scr.scrollLeft = sl;
  }

  function route(code) {
    var t = S.A[code], d = document.getElementById('trn-route'); if (!t || !d) return;
    var pr = t.prospects.slice(0, 6), gr = t.grossir.slice(0, 6);
    d.innerHTML = '<div><div class="trn-mp" id="trn-mp"></div></div>' +
      '<div class="trn-col"><h3>Prospects à voir en priorité <span class="trn-mu">· ' + t.nb_prospects_2km + ' à 2 km ou moins</span></h3>' +
      (pr.length ? pr.map(function (p, i) { var n = nomPF(p.cip);
        return '<div class="trn-li"><div><b>' + String.fromCharCode(65 + i) + ' · ' + esc(n.nom) + '</b><span>' + (n.ville ? esc(n.ville) + ' · ' : '') + esc(C.position(p)) + '</span></div><em>' + esc(C.detour(p).replace('détour ', '+')) + '</em></div>'; }).join('')
        : '<div class="trn-vide">Aucun prospect sur cette route.</div>') + '</div>' +
      '<div class="trn-col"><h3>Clientes à faire grossir <span class="trn-mu">· potentiel ' + eurSigne(t.potentiel) + ' par mois</span></h3>' +
      (gr.length ? gr.map(function (g) {
        return '<button type="button" class="trn-li" data-p="' + esc(String(g.id)) + '"><div><b>' + g.n + ' · ' + esc(joli(g.nom)) + '</b><span>' + esc(g.raison) + ' · ' + eur(g.renta_mois) + '/mois</span></div><em>' + eurSigne(g.gain) + '</em></button>'; }).join('')
        : '<div class="trn-vide">Aucune cliente sous la médiane.</div>') + '</div>';
    carte(code, pr);
  }

  function carte(c, pr) {
    if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; S.cur = null; }
    var el = document.getElementById('trn-mp'); if (!el) return;
    ensureLeaflet(function (err) {
      var el2 = document.getElementById('trn-mp');
      if (err || !glob.L || !el2 || S.open !== c) { if (el2 && (err || !glob.L)) el2.innerHTML = '<div class="trn-vide" style="padding:16px">Carte indisponible.</div>'; return; }
      var L = glob.L, t = S.A[c], D = S.d.depot;
      // écran tactile : un doigt fait défiler la PAGE (la carte ne le capte plus), deux doigts zooment et déplacent la carte
      var m = L.map(el2, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile(), touchZoom: true });
      try { m.attributionControl.setPrefix(false); } catch (e) {}
      if (V2.fondCarte) V2.fondCarte(m);
      m.setView([47.3, -1.75], 8);
      var g = L.layerGroup().addTo(m);
      var line = L.polyline(t.trace, { color: '#0050E6', weight: 4, opacity: 1 }).addTo(g);
      if (D && D.lat != null) L.circleMarker([D.lat, D.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#10131C', fillOpacity: 1 }).bindTooltip('Dépôt · ' + esc(D.nom), { direction: 'top' }).addTo(g);
      t.arrets.forEach(function (a) {
        var pid = String(a.id);
        var z = tactile() ? 44 : 28;   // au téléphone, la zone touchable fait 44 px autour du rond de 28 px
        var ic = L.divIcon({ className: 'trn-ic', iconSize: [z, z], iconAnchor: [z / 2, z / 2], html: '<div class="trn-pt' + (pid === S.pid ? ' sel' : '') + '" data-p="' + esc(pid) + '" style="background:' + COUL[a.statut] + (z > 28 ? ';margin:' + (z - 28) / 2 + 'px' : '') + '">' + a.n + '</div>' });
        L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: 100, keyboard: true, title: a.n + ' · ' + joli(a.nom) }).addTo(g)
          .bindTooltip('<b>' + a.n + ' · ' + esc(joli(a.nom)) + '</b><br>' + esc(joli(a.ville)) + (a.renta_mois != null ? '<br>' + eurF(a.renta_mois) + ' par mois' : '<br>Sans commande'), { direction: 'top', offset: [0, -10] })
          .on('click', function () { choisir(pid); });
      });
      pr.forEach(function (p, i) {
        var l = String.fromCharCode(65 + i), n = nomPF(p.cip);
        var zp = tactile() ? 44 : 26;   // au téléphone, zone touchable de 44 px autour du losange
        var ic = L.divIcon({ className: 'trn-ic', iconSize: [zp, zp], iconAnchor: [zp / 2, zp / 2], html: '<div class="trn-lo"' + (zp > 26 ? ' style="margin:' + (zp - 24) / 2 + 'px"' : '') + '><span>' + l + '</span></div>' });
        L.marker([p.lat, p.lng], { icon: ic, zIndexOffset: 400 }).addTo(g)
          .bindTooltip('<b>' + l + ' · ' + esc(n.nom) + '</b><br>' + esc(n.ville) + '<br>' + esc(C.detour(p)), { direction: 'top', offset: [0, -10] });
      });
      var fit = function () { try { m.invalidateSize(); m.fitBounds(line.getBounds().pad(0.08), { animate: false }); } catch (e) {} };
      S.map = m; S.cur = { fit: fit };
      fit(); setTimeout(fit, 0); setTimeout(function () { if (S.map === m) fit(); }, 400);
    });
  }

  // ── Les 4 ajouts (11/11/2026) ──
  function clTend(t) { return t && t.sens === 'baisse' ? 'trn-tend-b' : t && t.sens === 'hausse' ? 'trn-tend-h' : ''; }
  function tdTend(t, chk) { return '<td class="' + clTend(t) + '" data-chk="' + chk + '">' + esc(C.texteTendance(t)) + '</td>'; }
  function texteTendances(tb) {
    var t = C.tendanceTournee(tb); if (!t) return esc(C.texteFenetre(tb.mois, null));
    var n = t.nb, c = esc(tb.code);
    return '<b class="trn-tend-b" data-chk="t.' + c + '.nb_baisse">' + n.baisse + '</b> ' + (n.baisse > 1 ? 'clientes' : 'cliente') + ' en baisse · <b class="trn-tend-h" data-chk="t.' + c + '.nb_hausse">' + n.hausse + '</b> en hausse' +
      (n.nouvelle ? ' · ' + n.nouvelle + (n.nouvelle > 1 ? ' nouvelles' : ' nouvelle') : '') + ' · ' + n.stable + (n.stable > 1 ? ' stables' : ' stable') +
      ' · tendance de la tournée : <b class="' + clTend(t) + '" data-chk="t.' + c + '.tend.x">' + esc(C.texteTendance(t)) + '</b> (Notre marge par mois, explication sous la liste).';
  }
  // Export Excel : SheetJS, déjà utilisé par la fiche officine (V2.ensureXLSX, v2-pharma.js) ; aucune nouvelle bibliothèque.
  function exporter() {
    var tb = S.tb, a = S.A[S.open]; if (!tb || !a) return;
    if (!V2.ensureXLSX) { if (V2.toast) V2.toast('Export Excel indisponible', 'error'); return; }
    if (V2.toast) V2.toast('Génération de l’Excel…');
    V2.ensureXLSX(function (ok) {
      if (!ok || !glob.XLSX) { if (V2.toast) V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); return; }
      var X = glob.XLSX, now = new Date(), e = etabCourant(), wb = X.utils.book_new();
      var F = C.feuillesExcel(tb, a, S.d, nomPF, e ? e.s + ' · ' + e.nom : '', now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }));
      F.forEach(function (f) {
        var ws = X.utils.aoa_to_sheet(f.lignes), n = f.lignes.length, der = f.lignes[n - 1] || [];
        ws['!cols'] = f.largeurs.map(function (w) { return { wch: w }; });
        var fin = /^Total/.test(String(der[1] || der[0] || '')) ? n - 2 : n - 1;   // le filtre s'arrête avant la ligne du total
        if (f.filtre && fin >= 1) ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: fin, c: f.largeurs.length - 1 } }) };
        X.utils.book_append_sheet(wb, ws, f.nom);
      });
      var blob = new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = C.nomFichierExcel(tb.code, tb.nom, now.toISOString().slice(0, 10));
      document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(l.href); l.remove(); }, 800);
      if (V2.toast) V2.toast('Excel téléchargé');
    });
  }
  // « Et si… » : coût d'une livraison (au départ celui du fichier) et livraisons en moins pour les clientes en perte.
  var REDUCS = [0, 0.25, 0.5, 0.75];
  function simCarte() {
    var el = document.getElementById('trn-sim'), tb = S.tb; if (!el || !tb) return;
    var cout = S.simCout == null ? tb.cout : S.simCout;
    el.innerHTML = '<h2 id="trn-h-sim">Et si…</h2><p class="trn-sub">Changez le coût d’une livraison, ou livrez moins souvent les clientes en perte : la rentabilité de la tournée est recalculée sur la période. Simulation seulement, rien n’est enregistré.</p>' +
      '<div class="trn-champ"><label for="trn-sim-cout">Coût d’une livraison</label><span class="u"><input id="trn-sim-cout" class="trn-in" type="number" inputmode="decimal" min="0" step="0.5" value="' + (typeof cout === 'number' ? cout : '') + '">€</span></div>' +
      '<div class="trn-champ"><span class="lab" id="trn-sim-l">Livraisons en moins pour les clientes en perte</span><span class="trn-seg" role="group" aria-labelledby="trn-sim-l" id="trn-sim-seg">' +
        REDUCS.map(function (r) { return '<button type="button" data-r="' + r + '" aria-pressed="' + (S.simRed === r) + '">' + (r ? '−' : '') + Math.round(r * 100) + NB + '%</button>'; }).join('') + '</span></div>' +
      '<div class="trn-res" id="trn-sim-res" aria-live="polite"></div>' +
      '<p class="trn-hyp">Hypothèses : une cliente est « en perte » au coût choisi ; livrée moins souvent, elle garde la même Notre marge (mêmes achats, regroupés en moins de livraisons) et les mêmes mois livrés ; les autres clientes gardent leurs livraisons.</p>';
    simResultat();
  }
  function simResultat() {
    var el = document.getElementById('trn-sim-res'), tb = S.tb; if (!el || !tb) return;
    var cout = S.simCout == null ? tb.cout : S.simCout, r = cout === 'x' ? null : C.simuler(tb, cout, S.simRed);
    if (!r) { el.innerHTML = '<p style="margin:0">Saisissez un coût d’une livraison en euros (0 ou plus).</p>'; return; }
    var c0 = esc(tb.code), sg = function (v) { return (v > 0 ? '+' : '') + eurF(v); };
    var quoi = 'livraison à ' + eurF(r.cout) + (r.reduc ? ', ' + Math.round(r.reduc * 100) + NB + '% de livraisons en moins pour les clientes en perte' : '');
    var h = '<dl><dt>Rentabilité par mois aujourd’hui (livraison à ' + eurF(r.actuel.cout) + ')</dt><dd class="' + negc(r.actuel.renta_mois) + '" data-chk="sim.' + c0 + '.actuel">' + eurF(r.actuel.renta_mois) + '</dd>' +
      '<dt>Rentabilité par mois simulée (' + quoi + ')</dt><dd class="' + negc(r.simule.renta_mois) + '" data-chk="sim.' + c0 + '.simule">' + eurF(r.simule.renta_mois) + '</dd>' +
      '<dt>Écart par mois</dt><dd class="' + negc(r.ecart_mois) + '" data-chk="sim.' + c0 + '.ecart">' + sg(r.ecart_mois) + '</dd>' +
      '<dt>Clientes en perte</dt><dd data-chk="sim.' + c0 + '.perte">' + r.actuel.nb_perte + ' → ' + r.simule.nb_perte + '</dd>' +
      (r.reduc ? '<dt>Commandes sur la période</dt><dd data-chk="sim.' + c0 + '.cmd">' + C.ent(r.actuel.cmd) + ' → ' + C.ent(r.simule.cmd) + '</dd>' : '') + '</dl>';
    if (r.reduc) h += '<p>' + (r.visees ? r.visees + (r.visees > 1 ? ' clientes en perte' : ' cliente en perte') + ' à ' + eurF(r.cout) + ' la livraison ' + (r.visees > 1 ? 'sont livrées' : 'est livrée') + ' ' + Math.round(r.reduc * 100) + NB + '% moins souvent.' : 'Aucune cliente en perte à ' + eurF(r.cout) + ' la livraison : rien à réduire.') + '</p>';
    if (typeof r.seuil === 'number') h += '<p>Seuil : au-delà de <b data-chk="sim.' + c0 + '.seuil">' + eurF(r.seuil) + '</b> par livraison (la marge par commande de la tournée), la tournée entière perd de l’argent.</p>';
    if (r.cout !== tb.cout) h += '<div class="trn-act"><button type="button" class="trn-lien p" data-act="sim-cout">Revenir au coût du fichier (' + eurF(tb.cout) + ')</button></div>';
    el.innerHTML = h;
  }
  // « Comparer avec » : par défaut la mieux classée des autres tournées.
  function cmpCarte() {
    var el = document.getElementById('trn-cmp'); if (!el || !S.tb) return;
    var ord = C.classer(S.A, 'rentabilite_mois', -1), code = S.open, autres = ord.filter(function (c) { return c !== code; });
    var h = '<h2 id="trn-h-cmp">Comparer avec une autre tournée</h2>';
    if (!autres.length) { el.innerHTML = h + '<p class="trn-ghost">Une seule tournée dans le fichier : rien à comparer.</p>'; return; }
    if (!S.cmpB || !S.A[S.cmpB] || S.cmpB === code) S.cmpB = autres[0];
    el.innerHTML = h + '<p class="trn-sub">Mêmes chiffres que le classement et le tableau de bord. En gras et en couleur : la meilleure des deux, quand « meilleure » a un sens. Par défaut, la mieux classée des autres tournées.</p>' +
      '<label class="trn-sel-l">Comparer avec <select class="trn-sel" id="trn-cmp-sel">' + autres.slice().sort().map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === S.cmpB ? ' selected' : '') + '>' + esc(c) + ' · ' + esc(S.A[c].nom) + '</option>'; }).join('') + '</select></label>' +
      '<p class="trn-tdl" id="trn-cmp-noms"></p><div class="trn-scr"><table class="trn-cmpt" id="trn-cmp-t"></table></div>';
    var s = document.getElementById('trn-cmp-sel'); if (s) s.onchange = function () { S.cmpB = s.value; cmpResultat(); };
    cmpResultat();
  }
  function cmpResultat() {
    var el = document.getElementById('trn-cmp-t'); if (!el) return;
    var r = C.comparer(S.A, S.d, S.open, S.cmpB), n = Object.keys(S.A).length, nm = document.getElementById('trn-cmp-noms');
    if (nm) nm.innerHTML = r ? '<b>' + esc(r.a) + '</b> · ' + esc(S.A[r.a].nom) + ' (cette tournée), face à <b>' + esc(r.b) + '</b> · ' + esc(S.A[r.b].nom) + '.' : '';   // au téléphone, le sélecteur fermé coupe le nom
    if (!r) { el.innerHTML = '<tbody><tr><td>Comparaison impossible : le fichier ne porte pas les mois de l’une des deux tournées.</td></tr></tbody>'; return; }
    var fm = function (f, v) {
      if (typeof v !== 'number' || !isFinite(v)) return '—';
      return f === 'eur' ? eurF(v) : f === 'pct' ? C.pct(v) : f === 'dec1' ? C.dec1(v) : f === 'km' ? C.km(v, 0) : f === 'rang' ? v + (v === 1 ? 're' : 'e') + ' sur ' + n : C.ent(v);
    };
    var td = function (l, v, cote) { return '<td class="' + (l.mieux === cote ? 'trn-mieux ' : '') + negc(v) + '" data-chk="cmp.' + l.k + '.' + (cote === 1 ? 'a' : 'b') + '">' + fm(l.f, v) + '</td>'; };
    el.innerHTML = '<thead><tr><th scope="col"><span class="sr-only">Mesure</span></th><th scope="col">' + esc(r.a) + '</th><th scope="col">' + esc(r.b) + '</th></tr></thead><tbody>' +
      r.lignes.map(function (l) { return '<tr><th scope="row">' + esc(l.l) + '</th>' + td(l, l.a, 1) + td(l, l.b, 2) + '</tr>'; }).join('') + '</tbody>';
  }

  function notes(tb) {
    var n = [], mi = C.texteMoisIncomplets(tb.mois, S.d.couv);
    n.push('Commandes d’un mois = factures (livraisons) du mois, comme sur la fiche officine. « Par mois » = divisé par les mois où la cliente a été livrée ; pour la tournée, somme des clientes.');
    if (tb.tot.gen > 0) n.push('Notre marge : génériques comptés à zéro.');
    if (mi) n.push(mi);
    var R = S.d.reserves || {}, rs = tb.mois.filter(function (k) { return R[k]; });
    return '<footer class="trn-notes">' + n.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') +
      (rs.length ? '<details><summary>Réserves de prix, mois par mois</summary><ul>' + rs.map(function (k) { return '<li><b>' + esc(cap(C.moisLong(k))) + '</b> : ' + esc(R[k]) + '</li>'; }).join('') + '</ul></details>' : '') + '</footer>';
  }

  function graphiques() { chMois(); chRenta(); chNuage(); surligner(); }
  function surligner() {
    [].forEach.call(document.querySelectorAll('#trn-page [data-p]'), function (e) {
      var on = e.getAttribute('data-p') === S.pid;
      e.classList.toggle('sel', on);
      if (e.tagName === 'TR') e.setAttribute('aria-selected', String(on));
    });
  }
  function choisir(pid) {
    S.pid = (pid && S.pid !== pid) ? pid : null;
    liste(); surligner(); chip();
  }

  function brancher(root) {
    root.onclick = function (ev) {
      var t = ev.target, b;
      if (!t.closest) return;
      if (t.closest('.leaflet-container')) return;   // la carte gère ses propres clics (arrêts)
      if ((b = t.closest('.trn-pill'))) { S.etab = b.getAttribute('data-s'); S.open = null; dessiner(); return; }
      if ((b = t.closest('.trn-th button'))) {
        var k = b.getAttribute('data-k');
        if (S.sortK === k) S.sortDir = -S.sortDir; else { S.sortK = k; S.sortDir = -1; }
        lignes(); return;
      }
      if ((b = t.closest('button.trn-row'))) { V2.go('tournees', b.getAttribute('data-c')); return; }
      if ((b = t.closest('[data-act]'))) {
        var a = b.getAttribute('data-act'), id = b.getAttribute('data-id');
        if (a === 'classement') V2.go('tournees');
        else if (a === 'fiche' && id) V2.go('pharma', id);
        else if (a === 'fermer') choisir(null);
        else if (a === 'excel') exporter();
        else if (a === 'sim-cout') { S.simCout = null; var ic = document.getElementById('trn-sim-cout'); if (ic) ic.value = String(S.tb ? S.tb.cout : ''); simResultat(); }
        else if (a === 'voir-ligne') {
          var r = document.querySelector('#trn-lst tr[data-p="' + (glob.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
          if (r && r.scrollIntoView) r.scrollIntoView({ block: 'center' });
        }
        return;
      }
      if ((b = t.closest('#trn-seg button'))) { S.mes = b.getAttribute('data-m'); segs(); chMois(); return; }
      if ((b = t.closest('#trn-sim-seg button'))) {
        S.simRed = Number(b.getAttribute('data-r')) || 0;
        [].forEach.call(document.querySelectorAll('#trn-sim-seg button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        simResultat(); return;
      }
      if ((b = t.closest('#trn-lst th button'))) {
        var lk = b.getAttribute('data-lk');
        if (S.lk === lk) S.ld = -S.ld; else { S.lk = lk; S.ld = lk === 'n' ? 1 : -1; }
        liste(); return;
      }
      if ((b = t.closest('#trn-page [data-p]'))) { choisir(b.getAttribute('data-p')); return; }
      if (t.closest('#trn-retry')) { S.erreur = ''; S.d = null; V2.render(); }
    };
    root.oninput = function (ev) {   // coût d'une livraison de la simulation : recalcul à chaque frappe, le champ n'est pas redessiné (le curseur reste)
      var t = ev.target; if (!t || t.id !== 'trn-sim-cout') return;
      var v = String(t.value).replace(',', '.').trim(), x = Number(v);
      S.simCout = (v === '' || !isFinite(x) || x < 0) ? 'x' : x;
      simResultat();
    };
    root.onkeydown = function (ev) {
      var g = ev.target && ev.target.closest && ev.target.closest('g.trn-hit, #trn-lst tr[data-p]');
      if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); choisir(g.getAttribute('data-p')); }
    };
  }

  V2.pages.tournees = {
    needs: [],   // rien du catalogue ni des ventes : seulement son propre fichier
    render: function (root, param) {
      css(); S.root = root; brancher(root);
      if (interdit()) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="trn-page"><div class="trn-err"><b>Cet écran n’est pas ouvert à votre compte.</b><p>Les tournées de livraison ne sont pas disponibles dans cet espace.</p></div></div>';
        return;
      }
      if (S.d && S.A) {
        S.open = (param && S.A[param]) ? param : null;
        dessiner(); return;
      }
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="trn-page">' +
        (S.erreur ? '<div class="trn-err"><b>Données des tournées non disponibles</b><p>' + esc(S.erreur) + '</p><button type="button" class="v2-btn" id="trn-retry">Réessayer</button></div>'
          : '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des tournées…</div></div>') + '</div>';
      if (S.erreur || S.charge) return;
      S.charge = true;
      charger().then(function (d) {
        var m = C.valider(d); if (m) throw new Error(m);
        S.d = d; S.A = C.analyserTout(d); S.pf = null; S.erreur = ''; S.charge = false;
        // l'adresse #tournees/Txx ouvre directement le tableau de bord de la tournée ; #tournees seul, le classement
        var p = V2.route && V2.route.name === 'tournees' ? V2.route.param : param;
        S.open = (p && S.A[p]) ? p : null;
        if (V2.route && V2.route.name === 'tournees') dessiner();
        if (V2.ensurePharmaFr && !glob.PHARMA_FR) V2.ensurePharmaFr(function () { S.pf = null; if (V2.route && V2.route.name === 'tournees' && S.open && S.d && document.getElementById('trn-route')) route(S.open); });
      }).catch(function (e) {
        S.charge = false; S.erreur = 'Le fichier des tournées n’a pas pu être lu (' + (e && e.message ? e.message : 'erreur') + '). Rien n’est affiché plutôt que des chiffres faux.';
        if (V2.route && V2.route.name === 'tournees') V2.render();
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
