/* ═══════════════════════════════════════════════════════════════════════════
   MOTEUR APPRO — les formules, et rien d'autre : aucun HTML, aucun DOM.
   Extrait de v2-appro.js le 27/09/2026, sans changement de calcul, pour que
   l'écran « La grille et la fiche » et les écrans existants partagent la même
   arithmétique. Un défaut de formule se corrige désormais à UN seul endroit.
   Même motif que v2-produits-moteur.js / v2-produits.js.

   Sources : stock par site = etab-prices-data.js (ETAB_PRICES)
             vitesse de vente = réseau entier sur les mois complets (cipIndex)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};

  var M = {
    PLANCHER: 14,        // art. R.5124-59 CSP : obligation de service public, stock ≥ deux semaines
    CIBLE: 21,           // cible interne de réassort, en jours de couverture
    CIBLE_TENSION: 30,   // relevée sur une référence en tension/rupture ANSM
    DORMANT: 180,        // au-delà, le stock ne tourne plus — c'est un donneur potentiel
    MINVEL: 5            // seuil de bruit : au moins 5 bts/mois réseau pour être « mouvant »
  };

  /* ── Zone d'une référence : le vocabulaire du métier, pas une échelle de couleurs ──
     ⚠️ Piège déjà payé : ABSENT DE L'INVENTAIRE ≠ INVENTORIÉ À ZÉRO. Sans le drapeau
     `unk`, des centaines de références jamais inventoriées passaient pour « à sec » —
     autant de fausses urgences, et un carnet d'achat gonflé. */
  M.zone = function (o) {
    if (!o) return 'inconnu';
    if (o.unk) return 'inconnu';
    var cov = o.cov;
    if (cov == null) return 'inconnu';
    if (cov < 1) return 'sec';
    if (cov < M.PLANCHER) return 'hors';
    if (cov < M.cible(o)) return 'sous';
    if (cov > M.DORMANT) return 'dormant';
    return 'ok';
  };

  M.LIB = {
    inconnu: 'jamais inventorié',
    sec: 'moins d’un jour',
    hors: 'sous le plancher légal',
    sous: 'sous la cible',
    ok: 'servi',
    dormant: 'dormant'
  };

  /* ⚠️ 27/09/2026 — « à sec » ne veut PAS dire stock nul, mais MOINS D'UN JOUR de
     couverture. Sur les 3 469 références du catalogue, les 20 références classées ici
     ont TOUTES du stock (ex. CIP 3401321104311 : 2 boîtes pour 1 339 ventes/mois).
     La phrase « stock nul » y était donc fausse à chaque fois qu'elle s'affichait. */
  M.VERDICT = {
    sec: { g: 'Commander en urgence',
           p: 'Moins d’un jour de couverture : au premier appel d’officine, la ligne ne suit plus.' },
    hors: { g: 'Commander', p: 'La couverture est sous le plancher légal de deux semaines : l’obligation de service public n’est plus tenue.' },
    sous: { g: 'Commander', p: 'Au-dessus de la loi, sous notre cible interne. Ce n’est pas urgent, c’est du réglage.' },
    dormant: { g: 'Ne rien commander', p: 'Plus de six mois de couverture. Ce stock dort : la question est de l’écouler, pas d’en ajouter.' },
    ok: { g: 'Ne rien faire', p: 'La couverture est dans la cible. Cette ligne n’a pas besoin de vous aujourd’hui.' },
    inconnu: { g: 'Inventorier d’abord', p: 'Cette référence n’a jamais été inventoriée : on ne commande pas sur un stock qu’on ne connaît pas.' }
  };


  /* ⚠️ Un site SANS LIGNE pour ce produit est « non communiqué » (POS en sept. 2026),
     PAS un site à zéro : il n'est ni donneur ni receveur.
     ⚠️ `M.estime` reste lu par des écrans plus anciens : il ne dit plus « tout est estimé »
     mais « aucune demande par établissement n'est branchée ». v2-appro.js le passe à faux
     dès que le rattachement par département est en place. */
  M.estime = true;

  /* ═══════════════════════════════════════════════════════════════════════════
     QUI LIVRE QUI — la demande par établissement, enfin réelle (28/09/2026)
     Découpage par département donné par Will le 28/09/2026. Il remplace la plus
     grosse approximation de l'outil : « la demande est supposée répartie à parts
     égales entre les sept sites ».
     ═══════════════════════════════════════════════════════════════════════════ */

  /* Une zone = un ou plusieurs établissements, et la liste de ses départements.
     Trois cas, et ils ne se traitent pas pareil :
       · un seul établissement sur la zone → la demande lui est attribuée, c'est MESURÉ ;
       · trois établissements sur la même zone (HP, MSP et SEP couvrent tous les trois
         04-05-06-13-30-83-84) → aucun département ne permet de les séparer. La demande
         de la zone est partagée en trois parts égales, et CES TROIS SITES SEULEMENT
         portent la marque « estimé ». C'est une estimation sur 7,2 % de la demande,
         là où l'ancienne règle en estimait 100 % ;
       · Escale Pharma et Pharmest ne font pas partie des sept sites dont nous avons le
         stock. Leur demande existe, mais elle n'est PAS à servir depuis les sept :
         elle est mise à part (`hors`), jamais diluée sur les autres. */
  M.ZONES = [
    { sites: ['CPR'], dep: ['01', '07', '26', '38', '42', '63', '69', '73', '74'] },
    { sites: ['OPS'], dep: ['14', '16', '17', '22', '29', '35', '37', '44', '49', '50', '53', '56', '72', '79', '85', '86'] },
    { sites: ['SOP'], dep: ['19', '24', '31', '32', '33', '46', '47', '82'] },
    { sites: ['POS'], dep: ['09', '11', '12', '34', '48', '66', '81'] },
    { sites: ['HP', 'MSP', 'SEP'], dep: ['04', '05', '06', '13', '30', '83', '84'] },
    { sites: [], hors: 'Escale Pharma', dep: ['02', '18', '27', '28', '41', '45', '58', '59', '60', '61', '62', '75', '76', '77', '78', '80', '89', '91', '92', '93', '94', '95'] },
    { sites: [], hors: 'Pharmest', dep: ['57'] }
  ];

  var _zdep = null;
  function zoneParDep() {
    if (_zdep) return _zdep;
    _zdep = {};
    for (var i = 0; i < M.ZONES.length; i++)
      for (var j = 0; j < M.ZONES[i].dep.length; j++) _zdep[M.ZONES[i].dep[j]] = M.ZONES[i];
    return _zdep;
  }

  /* Le département d'un code postal — deux chiffres, et rien de plus malin :
     la Corse et l'outre-mer ne sont pas dans le périmètre des zones. */
  M.depDe = function (cp) {
    var s = String(cp == null ? '' : cp).replace(/\D/g, '');
    if (s.length < 4) return null;                 // « 0 », vide, ou saisie cassée
    return (s.length === 4 ? '0' + s : s).slice(0, 2);
  };

  /* ⚠️ Un département ABSENT de la liste ne se rattache PAS au site le plus proche.
     Mesuré le 28/09/2026 sur les ventes réelles : six zones vendaient sans figurer dans
     la liste — 73 Savoie, 63 Puy-de-Dôme, 01 Ain, 74 Haute-Savoie, 37 Indre-et-Loire,
     et 30 officines sans code postal — soit 199 307 unités, 7,3 % de la demande.
     Will a tranché le 28/09/2026 : 01, 63, 73 et 74 sont livrés par CPR, 37 par OPS.
     Restent les 30 officines SANS code postal (46 267 u, 1,7 %) : là, il n'y a rien à
     lire, donc rien à rattacher. Les deviner produirait un chiffre faux qui aurait
     l'air juste. On s'abstient, et l'écran affiche la demande non rattachée. */
  M.zoneDe = function (cp) {
    var d = M.depDe(cp);
    if (!d) return null;
    return zoneParDep()[d] || null;
  };

  /* La demande par établissement d'une référence.
     `src` est fourni par l'application (V2.approCtx) : { SITE: unités par mois }.
     Sans source branchée, on retombe sur l'ancienne hypothèse — à parts égales —
     et le drapeau `est` passe à 1 sur tous les sites : rien ne s'affiche comme mesuré
     alors que ce serait supposé. */
  M.demandeSite = null;      // branché par v2-appro.js : function (cip) -> { SITE: u/mois } | null

  M.parSite = function (cip, vM) {
    var EP = glob.ETAB_PRICES; if (!EP || !EP.prices || !EP.etabs) return null;
    var codes = EP.etabs.map(function (e) { return e.code; });
    var ds = M.demandeSite ? M.demandeSite(cip) : null;
    var out = [], tot = 0, nc = 0, estN = 0;
    codes.forEach(function (e) {
      var row = EP.prices[e] && EP.prices[e][cip];
      // Demande de CE site : mesurée si la source est branchée, sinon la part égale d'avant.
      var vMs = ds ? (ds[e] || 0) : ((vM || 0) / codes.length);
      var est = ds ? (ds._est && ds._est[e] ? 1 : 0) : 1;
      if (est) estN++;
      var vDs = vMs / 30;
      if (!row) { nc++; out.push({ site: e, st: null, cov: null, vM: vMs, est: est }); return; }
      var st = Math.max(0, row[1] || 0);
      tot += st;
      out.push({ site: e, st: st, vM: vMs, est: est,
        cov: vDs > 0 ? st / vDs : (st > 0 ? 9999 : 0) });
    });
    return { sites: out, tot: tot, nc: nc, n: codes.length, est: estN,
             mesure: !!ds, horsSept: ds ? (ds._hors || 0) : 0, nonRattache: ds ? (ds._nr || 0) : 0 };
  };

  /* Transférer entre sites ne sort pas un euro de marchandise : on le propose AVANT
     la commande au laboratoire. Décision n°8 du dossier métier. */
  M.transferts = function (cip, vM) {
    var p = M.parSite(cip, vM); if (!p) return [];
    var don = [], rec = [], mv = [], i;
    p.sites.forEach(function (x) {
      if (x.st == null) return;                       // non communiqué : on n'y touche pas
      if (x.cov >= 9999) { if (x.st > 1) don.push({ site: x.site, st: x.st }); return; }
      if (x.cov > M.DORMANT && x.st > 1) don.push({ site: x.site, st: x.st });
      else if (x.cov < M.PLANCHER) rec.push({ site: x.site, st: x.st, cov: x.cov, vM: x.vM });
    });
    don.sort(function (a, b) { return b.st - a.st; });
    rec.sort(function (a, b) { return a.cov - b.cov; });
    var di = 0;
    for (i = 0; i < rec.length && di < don.length; i++) {
      // Le besoin du receveur se calcule sur SA demande (secteur de son dépôt), plus sur
      // « la demande réseau divisée par sept » : un transfert vers OPS n'a rien à voir avec
      // la moyenne des sept quand OPS pèse 38,2 % de la demande et SOP 0,1 %.
      var vMr = (rec[i].vM != null) ? rec[i].vM : (vM || 0) / p.n;
      var besoin = Math.max(1, Math.round(vMr / 30 * M.CIBLE - rec[i].st));
      var dispo = Math.max(0, don[di].st - 1);
      var q = Math.min(besoin, dispo);
      if (q > 0) { mv.push({ de: don[di].site, vers: rec[i].site, q: q }); don[di].st -= q; }
      if (don[di].st <= 1) di++;
    }
    return mv;
  };

  /* Tout le stock réseau posé sur un seul site : les six autres ne peuvent pas servir. */
  M.concentre = function (cip, vM) {
    var p = M.parSite(cip, vM); if (!p || p.tot <= 0) return null;
    var mx = 0, site = '';
    p.sites.forEach(function (x) { if (x.st != null && x.st > mx) { mx = x.st; site = x.site; } });
    return (mx / p.tot >= 0.9) ? { site: site, st: mx, part: mx / p.tot } : null;
  };

  /* Libellé d'une couverture en jours — 9999 = du stock mais aucune vente. */
  M.jours = function (k) {
    if (k == null) return '—';
    if (k >= 9999) return 'aucune vente';
    if (k >= 400) return Math.round(k / 30) + ' mois';
    return Math.round(k) + ' j';
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     RÉGULARITÉ DE LA DEMANDE (XYZ), PRÉVISION INTERMITTENTE (Croston/SBA),
     STOCK DE SÉCURITÉ PAR CLASSE, PRIORISATION EN EUROS, INDICATEURS DE SERVICE
     Ajouté le 28/09/2026. Références : état de l'art dans ~/tests-appro/etat-art-appro.md
     (§A.2 XYZ, §A.4 stock de sécurité, §A.7 Croston/SBA, §A.10 indicateurs).
     ═══════════════════════════════════════════════════════════════════════════ */

  /* ── Les paramètres, tous nommés, aucun chiffre en dur dans un affichage ──
     ⚠️ DELAI et REVUE sont des HYPOTHÈSES : l'historique des délais réels par
     fournisseur n'existe pas encore dans nos données (trou n° 3 du dossier).
     Tout écran qui annonce un délai LIT M.DELAI, il ne le réécrit pas. */
  M.DELAI = 7;         // délai de réappro fournisseur supposé, en jours
  M.REVUE = 7;         // périodicité de revue du carnet d'achat, en jours
  M.SS_MAX_J = 30;     // plafond du stock de sécurité, en jours de couverture
  M.MIN_MOIS = 3;      // en dessous, un écart-type mensuel ne veut rien dire

  /* ── Seuils XYZ : MESURÉS, pas recopiés d'un manuel ──────────────────────
     Les seuils de la littérature (X < 0,10 · Y < 0,25) ont été appliqués aux
     7 674 références réellement vendues (mois complets, mesure du 28/09/2026) :
     ils classent 89,7 % du catalogue en Z. Un classement qui met tout dans la
     même case ne trie rien. Mesure des centiles de CV sur nos ventes :
       10 % → 0,25 · 25 % → 0,47 · 50 % → 0,88 · 75 % → 1,34 · 90 % → 2,00
     Seuils retenus (X < 0,50 · Y < 1,00) : X 26,8 % · Y 30,2 % · Z 43,0 %.
     ⚠️ Le CV est PLAFONNÉ par la longueur de l'historique : sur n mois il ne
     peut pas dépasser √(n−1) — d'où le palier à 2,00 observé sur 5 mois. Une
     référence vendue un seul mois sur cinq n'est donc pas « un peu variable » :
     elle est INTERMITTENTE, et c'est Croston qui la traite (M.croston), pas le CV. */
  M.XYZ = { X: 0.50, Y: 1.00 };

  /* ── Niveau de service par case ABC × XYZ, et le Z normal correspondant ──
     Logique de l'état de l'art §A.3 : la VALEUR décide de l'effort (A > B > C),
     l'IRRÉGULARITÉ décide du coussin à l'intérieur de la classe (une référence
     de forte valeur imprévisible mérite PLUS de sécurité, pas moins). */
  M.SERVICE = {
    AX: 0.98, AY: 0.98, AZ: 0.99,
    BX: 0.95, BY: 0.95, BZ: 0.975,
    CX: 0.90, CY: 0.90, CZ: 0.85
  };
  // Table du facteur de service (loi normale centrée réduite). Volontairement une
  // table et non une approximation numérique : neuf valeurs, toutes vérifiables.
  var ZTAB = { 0.85: 1.04, 0.90: 1.28, 0.95: 1.65, 0.975: 1.96, 0.98: 2.05, 0.99: 2.33 };
  M.cellule = function (o) { return ((o && o.abc) || 'C') + ((o && o.xyz) || 'Z'); };
  M.niveauService = function (o) { return M.SERVICE[M.cellule(o)] || 0.90; };
  M.zService = function (o) { return ZTAB[M.niveauService(o)] || 1.28; };

  /* ── Statistique de base sur une série mensuelle ─────────────────────────
     `serie` = un tableau de quantités, UN POINT PAR MOIS RETENU, zéros compris.
     Les zéros sont l'information principale sur une demande intermittente :
     les retirer transformerait un produit vendu un mois sur six en produit régulier. */
  M.moyenne = function (s) {
    if (!s || !s.length) return 0;
    var t = 0, i; for (i = 0; i < s.length; i++) t += (s[i] || 0);
    return t / s.length;
  };
  M.ecartType = function (s) {
    if (!s || s.length < 2) return 0;
    var m = M.moyenne(s), t = 0, i;
    for (i = 0; i < s.length; i++) t += Math.pow((s[i] || 0) - m, 2);
    return Math.sqrt(t / s.length);        // écart-type de population : la série EST la population
  };
  M.cv = function (s) { var m = M.moyenne(s); return m > 0 ? M.ecartType(s) / m : 0; };
  M.xyz = function (s) {
    if (!s || s.length < M.MIN_MOIS) return null;   // pas assez d'historique : on ne classe pas
    var cv = M.cv(s);
    return cv < M.XYZ.X ? 'X' : (cv < M.XYZ.Y ? 'Y' : 'Z');
  };

  /* ── Intermittence : classement de Syntetos-Boylan ───────────────────────
     ADI = nombre de mois ÷ nombre de mois AVEC vente. Au-delà de 1,32, la
     moyenne mobile est le mauvais outil (état de l'art §A.7).
     Mesuré le 28/09/2026 : 3 663 références sur 7 674, soit 47,7 % du catalogue. */
  M.adi = function (s) {
    if (!s || !s.length) return 0;
    var nz = 0, i; for (i = 0; i < s.length; i++) if ((s[i] || 0) > 0) nz++;
    return nz ? s.length / nz : 0;          // 0 = jamais vendue, pas « régulière »
  };
  M.intermittent = function (s) { var a = M.adi(s); return a >= 1.32; };

  /* ── Croston / SBA : prévision d'une demande intermittente ───────────────
     Deux lissages séparés — la TAILLE de la vente quand elle arrive, et
     l'INTERVALLE entre deux ventes. Un mois sans vente ne met rien à jour.
     SBA (Syntetos-Boylan) corrige le biais de sur-estimation de Croston par
     le facteur (1 − α/2). α = 0,1, valeur usuelle (défaut de statsforecast).
     Rendu : une prévision PAR MOIS, comparable à la moyenne qu'elle remplace. */
  M.croston = function (s, alpha, sba) {
    if (!s || !s.length) return 0;
    var a = (typeof alpha === 'number' && alpha > 0 && alpha <= 1) ? alpha : 0.1;
    var niv = null, per = null, ecart = 0, i, q, f;
    for (i = 0; i < s.length; i++) {
      ecart++;
      q = s[i] || 0;
      if (q <= 0) continue;
      if (niv == null) { niv = q; per = ecart; }        // amorce sur la première vente
      else { niv = niv + a * (q - niv); per = per + a * (ecart - per); }
      ecart = 0;
    }
    if (niv == null || !per || per <= 0) return 0;      // aucune vente sur la fenêtre
    f = niv / per;
    return (sba === false) ? f : f * (1 - a / 2);
  };

  /* ── La vitesse de vente à retenir : moyenne, ou Croston si intermittente ──
     C'est le remplacement du filtre brutal « au moins 5 boîtes par mois ».
     Mesuré le 28/09/2026 : ce filtre écartait 4 762 références sur 7 674 (62,1 %),
     soit 4,19 M€ de demande annuelle (8,1 % du total) — dont 202 références
     classées A ou B par la valeur, et 3 880 qui ont du stock chez nous. */
  M.vitesse = function (s) {
    if (!s || !s.length) return 0;
    return M.intermittent(s) ? M.croston(s) : M.moyenne(s);
  };

  /* ── Stock de sécurité ───────────────────────────────────────────────────
     Demande régulière (§A.4 cas 1) : SS = Z × σ_jour × √délai,
       avec σ_jour = σ_mensuel ÷ √30.
     Demande intermittente : la loi normale n'a plus de sens sur des ventes
     rares (§A.7). On passe en loi de Poisson, où la variance ÉGALE la moyenne :
       SS = Z × √(demande sur le délai). C'est le bon outil pour 47,7 % du catalogue.
     Rendu en JOURS de couverture, plafonné : sans plafond, une référence de
     forte valeur à historique court réclamerait des mois de stock. */
  M.ssJours = function (o, s) {
    if (!o || !s || s.length < M.MIN_MOIS) return 0;
    var vM = M.vitesse(s), vD = vM / 30;
    if (vD <= 0) return 0;
    var z = M.zService(o), ss;
    if (M.intermittent(s)) ss = z * Math.sqrt(vD * M.DELAI);
    else ss = z * (M.ecartType(s) / Math.sqrt(30)) * Math.sqrt(M.DELAI);
    return Math.min(M.SS_MAX_J, ss / vD);
  };

  /* ── La cible de couverture, désormais PROPRE À CHAQUE RÉFÉRENCE ──────────
     Avant le 28/09/2026 : 21 jours pour tout le monde, 30 en tension. Un seul
     chiffre pour 7 674 références dont la régularité va de 0,00 à 2,00 de CV.
     Maintenant : délai de réappro + périodicité de revue + stock de sécurité
     de SA case ABC×XYZ. Le plancher légal des deux semaines reste intouchable,
     et une tension ANSM ne peut jamais faire baisser la cible.
     Sans historique classable (o.ssJ absent), on retombe sur l'ancien réglage :
     on ne bricole pas une cible sur une série de deux mois. */
  M.cible = function (o) {
    var c;
    if (o && o.ssJ != null) c = M.DELAI + M.REVUE + o.ssJ;
    else c = M.CIBLE;
    c = Math.max(M.PLANCHER, c);
    if (o && o.tension) c = Math.max(c, M.CIBLE_TENSION);
    return Math.round(c);
  };

  /* Quantité conseillée : de quoi revenir à la cible, jamais négative.
     On ne commande pas sur une donnée de stock qui n'existe pas.
     `sais` = coefficient saisonnier déjà borné par l'appelant (jamais recalculé ici). */
  M.qte = function (o, sais) {
    if (!o || o.unk) return 0;
    var k = (typeof sais === 'number' && isFinite(sais) && sais > 0) ? sais : (o.sais || 1);
    return Math.max(0, Math.round(M.cible(o) * ((o.vM || 0) / 30) * k - (o.st || 0)));
  };

  /* ── PRIORISATION EN EUROS ────────────────────────────────────────────────
     « Par quelle ligne je commence ? » n'avait aucune réponse chiffrée. Une
     couverture courte sur un produit à 1,20 € et sur un produit à 900 € ne se
     traitent pas le même jour. Deux montants, deux questions différentes :

     · euroRisque : le chiffre d'affaires qu'on ne fera PAS si on ne fait rien.
       Ce qu'il manque pour tenir jusqu'à la prochaine livraison (délai + revue),
       valorisé au PPHT. Zéro dès qu'on tient le coup : ce n'est pas un manque
       « par rapport à la cible », c'est un manque par rapport à la SURVIE.
     · euroDormant : le capital immobilisé sur une référence qui ne tourne plus.
       De l'argent déjà dépensé, pas un risque — d'où deux fonctions séparées. */
  M.euroRisque = function (o) {
    if (!o || o.unk) return 0;                 // stock inconnu : un risque supposé n'est pas un risque
    var besoin = (o.vM || 0) / 30 * (M.DELAI + M.REVUE);
    return Math.max(0, besoin - (o.st || 0)) * (o.ppht || 0);
  };
  M.euroDormant = function (o) {
    if (!o || o.unk) return 0;
    return (o.cov != null && o.cov > M.DORMANT) ? (o.st || 0) * (o.ppht || 0) : 0;
  };
  M.euroCommande = function (o) { return M.qte(o) * ((o && o.ppht) || 0); };

  /* ── INDICATEURS DE SERVICE (§A.10) ───────────────────────────────────────
     ⚠️ Ce que ces chiffres sont, et ce qu'ils ne sont PAS. Un vrai taux de
     service se mesure sur les commandes d'officines REÇUES et non servies —
     donnée que nous n'avons pas (trou n° 3 du dossier, demandée à l'éditeur).
     Ce qui est calculé ici est une PHOTO du stock du jour face à la demande
     mesurée : « sur ce que le réseau nous demande, quelle part est servable
     depuis le stock d'aujourd'hui ». C'est un état des lieux, pas un historique.
     Tout écran qui l'affiche doit le dire — d'où le drapeau `photo`. */
  M.service = function (list) {
    var r = { photo: true, n: 0, nSec: 0, nSous: 0, nDormant: 0, nInconnu: 0,
              demande: 0, servable: 0, taux: null, rupture: null,
              valStock: 0, valAn: 0, rotation: null, jStock: null,
              euroRisque: 0, euroDormant: 0 };
    if (!list || !list.length) return r;
    var i, o;
    for (i = 0; i < list.length; i++) {
      o = list[i]; if (!o) continue;
      r.n++;
      if (o.unk) { r.nInconnu++; continue; }    // jamais inventorié : ne pollue aucun taux
      var z = M.zone(o);
      if (z === 'sec') r.nSec++;
      else if (z === 'hors' || z === 'sous') r.nSous++;
      else if (z === 'dormant') r.nDormant++;
      // Fenêtre de mesure : un mois de demande, la maille de nos ventes.
      var dem = (o.vM || 0), ppht = (o.ppht || 0);
      r.demande += dem * ppht;
      r.servable += Math.min(dem, (o.st || 0)) * ppht;
      r.valStock += (o.st || 0) * ppht;
      r.valAn += dem * 12 * ppht;
      r.euroRisque += M.euroRisque(o);
      r.euroDormant += M.euroDormant(o);
    }
    var mesures = r.n - r.nInconnu;
    if (r.demande > 0) r.taux = r.servable / r.demande;
    if (mesures > 0) r.rupture = r.nSec / mesures;
    if (r.valStock > 0) { r.rotation = r.valAn / r.valStock; r.jStock = 365 / r.rotation; }
    return r;
  };

  V2.approM = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window
   // Hors navigateur, `this` au niveau d'un module CommonJS vaut module.exports, PAS le global :
   // le moteur n'y voyait jamais ETAB_PRICES, donc parSite et transferts étaient intestables.
   : (typeof globalThis !== 'undefined' ? globalThis : this));
