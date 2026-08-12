/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Produits » (pages.produits)
   L'entrée UNIQUE des produits : pour une officine, ce que ses confrères
   du même groupement d'achat nous prennent et qu'elle ne nous prend pas,
   filtré sur le stock réel. Deux modes : Vendeur (par officine) et
   Achats (par produit).
   Le calcul vit dans v2-produits-moteur.js (module pur, 29 tests).
   Cet écran ne fait que du rendu.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  // Valeur destinée à un onclick="…('ICI')" : elle traverse HTML puis JS.
  var escAttr = function (s) { return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, '')); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : Math.round(+n || 0) + ' €'; };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(Math.round(+n || 0)); };

  var FAM = {
    pr_low:  { l: 'Princeps < 4,33 €',    c: 'var(--ip-blue)' },
    pr_mid:  { l: 'Princeps 4,33–468 €',  c: 'var(--ip-blue)' },
    pr_high: { l: 'Princeps > 468 €',     c: 'var(--ip-blue)' },
    nr:      { l: 'Non remboursable',     c: 'var(--c-amber)' },
    gen:     { l: 'Générique',            c: 'var(--c-mint)' },
    biosim:  { l: 'Biosimilaire',         c: '#6D4FC4' }
  };
  var FAM_ORDRE = ['pr_low', 'pr_mid', 'pr_high', 'nr', 'gen', 'biosim'];
  // Libellés courts pour le résumé du composeur replié.
  var FAM_COURT = {
    pr_low: 'petits prix', pr_mid: 'moyens', pr_high: 'chers',
    nr: 'NR', gen: 'génér.', biosim: 'biosim.'
  };
  // Seules les familles princeps portent un abandon de marge. Génériques,
  // NR et biosimilaires : net = PPHT, aucun abandon (règle métier stricte).
  function porteAbandon(f) { return String(f || '').indexOf('pr_') === 0; }

  var S = {
    mode: 'vendeur', ph: null, fam: 'all', q: '', sansRupture: false, page: 0,
    grp: 'all', horsStock: false,
    sm: null   // composition de la liste sur mesure, chargée au 1er rendu
  };
  var PAR_PAGE = 40;

  V2.produits = V2.produits || {};
  V2.produits.S = S;

  // ── Index (construit une fois, invalidé si les ventes changent) ──
  V2.produits.index = function () {
    var M = window.V2PRODUITS;
    if (!M) return null;
    var sig = (V2.sales || []).length + ':' + (V2.pharmacies || []).length;
    if (V2.produits._idx && V2.produits._sig === sig) return V2.produits._idx;
    V2.produits._idx = M.indexer(V2.pharmacies || [], V2.sales || []);
    V2.produits._sig = sig;
    return V2.produits._idx;
  };

  function fiche(cip) {
    if (!V2.produits._ps) {
      var m = {}, PS = window.PROD_STATS || [], i;
      for (i = 0; i < PS.length; i++) m[String(PS[i].c)] = PS[i];
      V2.produits._ps = m;
    }
    return V2.produits._ps[String(cip)] || null;
  }
  function enRupture(cip) {
    var R = window.RUPTURES && window.RUPTURES.data;
    return !!(R && R[String(cip)]);
  }
  function stockIP() {
    return (window.STOCK_IP && window.STOCK_IP.data) || {};
  }

  // ── Pilotage depuis le HTML ────────────────────────────────────
  V2.produits.setPh = function (id) { S.ph = id || null; S.page = 0; V2.render(); };
  V2.produits.setMode = function (m) { S.mode = m; S.page = 0; V2.render(); };
  V2.produits.setFam = function (k) { S.fam = k; S.page = 0; V2.render(); };
  V2.produits.setRupt = function () { S.sansRupture = !S.sansRupture; S.page = 0; V2.render(); };
  V2.produits.setGrp = function (g) { S.grp = g || 'all'; S.page = 0; V2.render(); };
  V2.produits.setHorsStock = function () { S.horsStock = !S.horsStock; S.page = 0; V2.render(); };
  V2.produits.plus = function () { S.page += 1; V2.render(); };
  var tq = null;
  V2.produits.setQ = function (v) {
    S.q = v || '';
    if (tq) clearTimeout(tq);
    tq = setTimeout(function () { S.page = 0; V2.render(); }, 220);
  };

  // ── Filtres d'affichage (le moteur a déjà fait le tri métier) ──
  function filtrer(lignes) {
    var q = S.q.trim().toLowerCase();
    var out = [], i;
    for (i = 0; i < lignes.length; i++) {
      var l = lignes[i], f = fiche(l.cip);
      if (S.fam !== 'all' && (!f || f.f !== S.fam)) continue;
      if (S.sansRupture && enRupture(l.cip)) continue;
      if (q) {
        var lib = (f && f.d ? f.d : '').toLowerCase();
        if (lib.indexOf(q) < 0 && String(l.cip).indexOf(q) < 0) continue;
      }
      out.push(l);
    }
    return out;
  }

  function chiffre(v, lib, cls) {
    return '<div class="' + (cls || '') + '"><span>' + v + '</span><em>' + lib + '</em></div>';
  }

  function enTeteProduit(l) {
    var f = fiche(l.cip);
    var lib = f && f.d ? f.d : ('CIP ' + l.cip);
    var fam = f && FAM[f.f] ? FAM[f.f] : null;
    return '<div class="pr-lib">' + esc(lib) +
      (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
      (enRupture(l.cip) ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
      '</div>';
  }

  // ── Rendu : une ligne, mode Vendeur ────────────────────────────
  function ligneHtml(l, libelleGroupe) {
    var f = fiche(l.cip);
    var abandon = (f && porteAbandon(f.f) && f.ppht > 0 && f.net > 0)
      ? eur(f.ppht - f.net) : '—';
    return '' +
      '<div class="pr-row">' +
        enTeteProduit(l) +
        '<div class="pr-arg">' +
          '<strong>' + Math.round(l.pctPeers * 100) + ' %</strong> de ses ' + esc(libelleGroupe) +
          ' le prennent · <strong>' + eur(l.caMoyen) + '</strong> en moyenne par confrère' +
        '</div>' +
        '<div class="pr-chiffres">' +
          chiffre(eur(l.potentiel), 'potentiel', 'pr-pot') +
          chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
          chiffre(abandon, 'abandon de marge') +
          chiffre(num(l.stock), 'en stock') +
        '</div>' +
      '</div>';
  }

  // ── Rendu : mode Vendeur ───────────────────────────────────────
  function rendreVendeur() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');

    var phs = (V2.pharmacies || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    if (!phs.length) return vide('Aucune officine', 'Les données réseau ne sont pas chargées.');
    if (!S.ph) S.ph = String(phs[0].id);

    var opts = '', i;
    for (i = 0; i < phs.length; i++) {
      opts += '<option value="' + escAttr(phs[i].id) + '"' +
        (String(phs[i].id) === String(S.ph) ? ' selected' : '') + '>' +
        esc(phs[i].name) + '</option>';
    }

    var r = M.listingOfficine(idx, S.ph, { stock: stockIP() });
    var lignes = filtrer(r.lignes);
    var potentielTotal = 0;
    for (i = 0; i < lignes.length; i++) potentielTotal += lignes[i].potentiel;
    var libGrp = r.groupe ? r.groupe.libelle : 'confrères';

    // Honnêteté : si le seuil a dû baisser (petite officine, pairs peu
    // actifs), on le dit au lieu de laisser croire à une comparaison forte.
    var noteSeuil = (r.seuil != null && r.seuil < M.SEUIL_PEERS)
      ? '<div class="pr-note">Comparaison élargie : cette officine a peu de confrères actifs, ' +
        'le seuil est descendu à ' + Math.round(r.seuil * 100) + ' %.</div>'
      : '';

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '';
    for (i = 0; i < visibles.length; i++) corps += ligneHtml(visibles[i], libGrp);

    return '' +
      '<div class="pr-bandeau">' +
        '<select class="pr-select" aria-label="Choisir une officine" onchange="V2.produits.setPh(this.value)">' + opts + '</select>' +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-grp">' + num(r.nbConfreres) + ' ' + esc(libGrp) + '</span>' +
          '<span class="pr-ctx-pot">' + eur(potentielTotal) + ' de potentiel</span>' +
          '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
        '</div>' +
        noteSeuil +
        '<button class="v2-btn v2-btn-primary pr-pdf" onclick="V2.produits.pdf()">Sortir le PDF</button>' +
        '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' +
      filtresHtml() +
      liste(lignes, visibles, corps);
  }

  function liste(lignes, visibles, corps) {
    if (!lignes.length) {
      return vide('Aucun produit avec ces filtres', 'Élargis la recherche ou change de famille.');
    }
    return '<div class="pr-liste">' + corps + '</div>' +
      (visibles.length < lignes.length
        ? '<button class="v2-btn pr-plus" onclick="V2.produits.plus()">Voir 40 produits de plus</button>'
        : '');
  }

  function vide(t, d) {
    return '<div class="v2-empty"><div class="v2-empty-t">' + esc(t) + '</div>' +
      '<div class="v2-empty-d">' + esc(d) + '</div></div>';
  }

  function filtresHtml() {
    // En mode Sur mesure, les familles se choisissent DÉJÀ dans le composeur
    // (un quota par catégorie) : réafficher des puces de famille en dessous
    // serait redondant et contradictoire.
    var fams = '';
    if (S.mode !== 'surmesure') {
      var chips = '<span class="pr-chip' + (S.fam === 'all' ? ' on' : '') +
        '" onclick="V2.produits.setFam(\'all\')">Toutes familles</span>', i, k;
      for (i = 0; i < FAM_ORDRE.length; i++) {
        k = FAM_ORDRE[i];
        chips += '<span class="pr-chip' + (S.fam === k ? ' on' : '') +
          '" onclick="V2.produits.setFam(\'' + k + '\')">' + esc(FAM[k].l) + '</span>';
      }
      // Une seule ligne qui défile : à 390 px, les 7 puces prenaient 4 lignes,
      // soit ~150 px avant le premier produit.
      fams = '<div class="pr-chips pr-defile">' + chips + '</div>';
    }
    return '' +
      '<div class="pr-filtres">' +
        '<div class="pr-search">' + ICO('search', 16, 2) +
          '<input placeholder="Produit ou CIP…" value="' + escAttr(S.q) +
          '" oninput="V2.produits.setQ(this.value)">' +
        '</div>' +
        fams +
        '<div class="pr-chips">' +
          '<span class="pr-chip' + (S.sansRupture ? ' on' : '') +
          '" onclick="V2.produits.setRupt()">Masquer les ruptures ANSM</span>' +
        '</div>' +
      '</div>';
  }

  // ── Rendu : mode Achats ────────────────────────────────────────
  // Même moteur, lu par produit : sur combien d'officines ce produit est-il
  // un trou. « Ce qu'on n'a pas » lève le filtre stock : c'est ce qu'il
  // faudrait rentrer.
  function achatsData(M, idx) {
    // 691 listings = ~600 ms : on mémorise tant que les filtres de fond
    // ne bougent pas (la recherche et les familles filtrent en aval).
    var cle = (S.grp || 'all') + '|' + (S.horsStock ? 'hs' : 'st');
    if (V2.produits._achatsCle === cle && V2.produits._achats) return V2.produits._achats;
    var lignes = M.listingProduits(idx, {
      stock: stockIP(),
      exigerStock: !S.horsStock,
      filtreGroupement: S.grp === 'all' ? null : S.grp
    });
    if (S.horsStock) {
      lignes = lignes.filter(function (l) { return !(l.stock > 0); });
    }
    V2.produits._achats = lignes;
    V2.produits._achatsCle = cle;
    return lignes;
  }

  function rendreAchats() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');

    var lignes = filtrer(achatsData(M, idx));
    var total = 0, i;
    for (i = 0; i < lignes.length; i++) total += lignes[i].potentiel;

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '';
    for (i = 0; i < visibles.length; i++) corps += ligneAchatHtml(visibles[i]);

    return '' +
      '<div class="pr-bandeau">' +
        '<select class="pr-select" aria-label="Filtrer par groupement d\'achat" onchange="V2.produits.setGrp(this.value)">' +
          optionsGroupements() +
        '</select>' +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
          '<span class="pr-ctx-pot">' + eur(total) + ' de potentiel réseau</span>' +
        '</div>' +
        '<div class="pr-chips">' +
          '<span class="pr-chip' + (S.horsStock ? ' on' : '') +
          '" onclick="V2.produits.setHorsStock()">Uniquement ce qu\'on n\'a pas</span>' +
        '</div>' +
        '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' +
      filtresHtml() +
      liste(lignes, visibles, corps);
  }

  function optionsGroupements() {
    var vus = {}, phs = V2.pharmacies || [], i, g;
    for (i = 0; i < phs.length; i++) {
      g = String(phs[i].groupement || '').trim();
      if (g) vus[g] = (vus[g] || 0) + 1;
    }
    var noms = Object.keys(vus).sort(function (a, b) { return vus[b] - vus[a]; });
    var out = '<option value="all"' + (S.grp === 'all' ? ' selected' : '') +
              '>Tous les groupements d\'achat</option>';
    for (i = 0; i < noms.length; i++) {
      out += '<option value="' + escAttr(noms[i]) + '"' +
             (S.grp === noms[i] ? ' selected' : '') + '>' +
             esc(noms[i]) + ' · ' + vus[noms[i]] + ' officines</option>';
    }
    return out;
  }

  function generiqueur(cip) {
    var G = window.GENERIQUEURS;
    if (!G) return '';
    var d = G.data || G;
    var e = d[String(cip)];
    if (!e) return '';
    return typeof e === 'string' ? e : (e.labo || e.g || '');
  }

  function ligneAchatHtml(l) {
    var f = fiche(l.cip);
    var g = generiqueur(l.cip);
    var couv = l.couverture == null ? '—'
      : (l.couverture >= 24 ? '> 24 mois'
        : (Math.round(l.couverture * 10) / 10).toString().replace('.', ',') + ' mois');
    return '' +
      '<div class="pr-row">' +
        enTeteProduit(l) +
        '<div class="pr-arg">' +
          '<strong>' + num(l.officines) + ' officines</strong> ne nous le prennent pas' +
          (g ? ' · ' + esc(g) : '') +
        '</div>' +
        '<div class="pr-chiffres">' +
          chiffre(eur(l.potentiel), 'potentiel réseau', 'pr-pot') +
          chiffre(num(l.stock), 'en stock') +
          chiffre(esc(couv), 'couverture') +
          chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
        '</div>' +
      '</div>';
  }

  // ── Mode Sur mesure : la « best list » d'un prospect ───────────
  // Un prospect n'a aucun historique chez nous : pas de comparaison aux
  // confrères possible. On part du catalogue et on compose par quotas,
  // ajustables en direct devant le pharmacien.
  var PRESETS = {
    decouverte: { l: 'Découverte', q: { pr_low: 50, pr_mid: 20, pr_high: 5, nr: 10, gen: 20, biosim: 0 }, a: { pr_low: 8 } },
    petitsprix: { l: 'Petits prix', q: { pr_low: 80, pr_mid: 0, pr_high: 0, nr: 0, gen: 0, biosim: 0 }, a: { pr_low: 8 } },
    large:      { l: 'Large', q: { pr_low: 40, pr_mid: 40, pr_high: 10, nr: 30, gen: 40, biosim: 10 }, a: {} }
  };
  // Le réglage d'abandon n'a de sens que là où il discrimine : sur la tranche
  // médiane le barème donne 3,89 % à tout le monde, et les NR / génériques /
  // biosimilaires n'en portent aucun.
  var REGLE_ABANDON = { pr_low: 1, pr_high: 1 };
  var PALIERS_ABANDON = [0, 4, 6, 8, 10, 15];

  function smDefaut() {
    var p = PRESETS.decouverte;
    return { quotas: JSON.parse(JSON.stringify(p.q)), abandonMin: JSON.parse(JSON.stringify(p.a)), nom: '' };
  }
  // Toute composition qui entre ici est normalisée : un réglage tronqué ou
  // corrompu (vieille version, écriture partielle, bricolage manuel) ne doit
  // JAMAIS produire un écran blanc en rendez-vous.
  function smNormaliser(b) {
    var d = smDefaut(), i, k;
    if (!b || typeof b !== 'object') return d;
    if (!b.quotas || typeof b.quotas !== 'object') b.quotas = d.quotas;
    if (!b.abandonMin || typeof b.abandonMin !== 'object') b.abandonMin = {};
    for (i = 0; i < FAM_ORDRE.length; i++) {
      k = FAM_ORDRE[i];
      b.quotas[k] = Math.max(0, Math.min(300, parseInt(b.quotas[k], 10) || 0));
    }
    b.nom = typeof b.nom === 'string' ? b.nom : '';
    b.plie = !!b.plie;
    return b;
  }
  function smCharger() {
    try { return smNormaliser(JSON.parse(localStorage.getItem('produits.surmesure'))); }
    catch (e) { return smDefaut(); }
  }
  function smSauver() {
    try { localStorage.setItem('produits.surmesure', JSON.stringify(S.sm)); } catch (e) {}
  }

  // Catalogue au format attendu par le moteur, construit une fois.
  function catalogue() {
    if (V2.produits._cat) return V2.produits._cat;
    var PS = window.PROD_STATS || [], ST = stockIP();
    var R = (window.RUPTURES && window.RUPTURES.data) || {};
    var out = [], i;
    for (i = 0; i < PS.length; i++) {
      var r = PS[i], c = String(r.c);
      out.push({ cip: c, fam: r.f, n: +r.n || 0, ppht: +r.ppht || 0,
                 stock: +ST[c] || 0, rupture: !!R[c] });
    }
    V2.produits._cat = out;
    return out;
  }

  V2.produits.smQuota = function (fam, delta) {
    var v = (+S.sm.quotas[fam] || 0) + delta;
    S.sm.quotas[fam] = Math.max(0, Math.min(300, v));
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smQuotaSet = function (fam, v) {
    var n = parseInt(String(v).replace(/\D/g, ''), 10);
    S.sm.quotas[fam] = isNaN(n) ? 0 : Math.max(0, Math.min(300, n));
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smAbandon = function (fam, v) {
    var n = parseFloat(v);
    if (!n) delete S.sm.abandonMin[fam]; else S.sm.abandonMin[fam] = n;
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smPlier = function () {
    S.sm.plie = !S.sm.plie; smSauver(); V2.render();
  };
  V2.produits.smPreset = function (k) {
    var p = PRESETS[k]; if (!p) return;
    S.sm.quotas = JSON.parse(JSON.stringify(p.q));
    S.sm.abandonMin = JSON.parse(JSON.stringify(p.a));
    S.page = 0; smSauver(); V2.render();
  };
  var tn = null;
  V2.produits.smNom = function (v) {
    S.sm.nom = v || '';
    if (tn) clearTimeout(tn);
    tn = setTimeout(smSauver, 400);
  };

  function ligneComposeur(fam, dispo) {
    var q = +S.sm.quotas[fam] || 0;
    var manque = q > dispo;
    var sel = '';
    if (REGLE_ABANDON[fam]) {
      var cur = S.sm.abandonMin[fam] || 0, i;
      sel = '<select class="sm-ab" aria-label="Abandon de marge minimum" onchange="V2.produits.smAbandon(\'' + fam + '\',this.value)">';
      for (i = 0; i < PALIERS_ABANDON.length; i++) {
        var p = PALIERS_ABANDON[i];
        sel += '<option value="' + p + '"' + (cur === p ? ' selected' : '') + '>' +
               (p === 0 ? 'tous' : '≥ ' + p + ' %') + '</option>';
      }
      sel += '</select>';
    } else {
      sel = '<span class="sm-ab-non">—</span>';
    }
    return '' +
      '<div class="sm-row">' +
        '<div class="sm-fam"><span class="sm-dot" style="background:' + FAM[fam].c + '"></span>' +
          esc(FAM[fam].l) +
          '<em class="' + (manque ? 'sm-manque' : '') + '">' + num(dispo) + ' dispo</em>' +
        '</div>' +
        '<div class="sm-ctl">' +
          '<button class="sm-b" aria-label="Moins" onclick="V2.produits.smQuota(\'' + fam + '\',-5)">–</button>' +
          '<input class="sm-n" inputmode="numeric" value="' + q + '" onchange="V2.produits.smQuotaSet(\'' + fam + '\',this.value)">' +
          '<button class="sm-b" aria-label="Plus" onclick="V2.produits.smQuota(\'' + fam + '\',5)">+</button>' +
          sel +
        '</div>' +
      '</div>';
  }

  function ligneSurMesureHtml(l) {
    var f = fiche(l.cip);
    var lib = f && f.d ? f.d : ('CIP ' + l.cip);
    var fam = FAM[l.fam];
    var ab = l.abandon == null ? null : l.abandon;
    return '' +
      '<div class="pr-row">' +
        '<div class="pr-lib">' + esc(lib) +
          (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
          (l.rupture ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
        '</div>' +
        '<div class="pr-arg">' +
          '<strong>' + num(l.n) + ' pharmacies</strong> nous le prennent' +
          (ab != null ? ' · <strong>+' + eur(ab) + ' par boîte</strong> pour le pharmacien (' +
            (Math.round(l.abandonPct * 10) / 10).toString().replace('.', ',') + ' %)' : '') +
        '</div>' +
        '<div class="pr-chiffres">' +
          chiffre(eur(l.net), 'prix net', 'pr-pot') +
          chiffre(ab == null ? '—' : '+' + eur(ab), 'abandon de marge') +
          chiffre(eur(l.ppht), 'tarif') +
          chiffre(num(l.stock), 'en stock') +
        '</div>' +
      '</div>';
  }

  function rendreSurMesure() {
    var M = window.V2PRODUITS;
    if (!M || !M.listeSurMesure) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas à jour.');
    if (!(window.PROD_STATS || []).length) return vide('Catalogue indisponible', 'Les données produits ne sont pas chargées.');

    var r = M.listeSurMesure(catalogue(), {
      quotas: S.sm.quotas, abandonMin: S.sm.abandonMin, sansRupture: S.sansRupture
    });
    var lignes = filtrer(r.lignes);

    var i, k;
    // Replié, le composeur laisse voir la liste : à 390 px il occupait tout
    // l'écran, on ne voyait donc jamais l'effet du réglage qu'on venait de faire.
    var resume = [];
    for (i = 0; i < M.FAMILLES.length; i++) {
      k = M.FAMILLES[i];
      if (+S.sm.quotas[k] > 0) resume.push(S.sm.quotas[k] + ' ' + FAM_COURT[k]);
    }
    var entete = '<button class="sm-plier" onclick="V2.produits.smPlier()">' +
      (S.sm.plie ? '▸ Régler la liste' : '▾ Replier le réglage') +
      '<em>' + esc(resume.length ? resume.join(' · ') : 'aucune catégorie') + '</em></button>';

    var corpsComposeur = '';
    if (!S.sm.plie) {
      var comp = '';
      for (i = 0; i < M.FAMILLES.length; i++) comp += ligneComposeur(M.FAMILLES[i], r.dispo[M.FAMILLES[i]]);
      var presets = '';
      for (k in PRESETS) {
        if (!Object.prototype.hasOwnProperty.call(PRESETS, k)) continue;
        presets += '<span class="pr-chip" onclick="V2.produits.smPreset(\'' + k + '\')">' + esc(PRESETS[k].l) + '</span>';
      }
      corpsComposeur = '<div class="pr-chips sm-presets">' + presets + '</div>' +
                       '<div class="sm-grille">' + comp + '</div>';
    }

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '';
    for (i = 0; i < visibles.length; i++) corps += ligneSurMesureHtml(visibles[i]);

    return '' +
      '<div class="pr-bandeau">' +
        '<input class="pr-select sm-nom" placeholder="Nom de l\'officine (pour le PDF)" value="' +
          escAttr(S.sm.nom) + '" oninput="V2.produits.smNom(this.value)">' +
        entete +
        corpsComposeur +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-pot">' + num(lignes.length) + ' produits dans la liste</span>' +
        '</div>' +
        '<button class="v2-btn v2-btn-primary pr-pdf" onclick="V2.produits.pdf()">Sortir le PDF</button>' +
        '<div class="pr-source">catalogue Intégral · uniquement ce qui est en stock</div>' +
      '</div>' +
      filtresHtml() +
      liste(lignes, visibles, corps);
  }

  // ── PDF à laisser au pharmacien ────────────────────────────────
  // Impression navigateur sur un document dédié : aucune librairie, aucun
  // coût. CONTENU AUTORISÉ : produit, prix net, disponibilité. Le barème
  // d'abandon de marge et toute autre condition chiffrée en sont exclus.
  // Fabrique le document et le REND, sans l'ouvrir : c'est ce qui permet de le
  // vérifier automatiquement (aucune condition commerciale chiffrée) au lieu de
  // le relire à l'œil dans une fenêtre d'impression.
  V2.produits.pdfHtml = function () {
    var M = window.V2PRODUITS, i;
    if (!M) return null;

    var titre, lignes;
    if (S.mode === 'surmesure') {
      // Liste prospect : le net vient du barème, calculé par le moteur.
      titre = (S.sm && S.sm.nom) ? S.sm.nom : 'Sélection Intégral Pharma';
      lignes = filtrer(M.listeSurMesure(catalogue(), {
        quotas: S.sm.quotas, abandonMin: S.sm.abandonMin, sansRupture: S.sansRupture
      }).lignes);
    } else {
      var idx = V2.produits.index();
      if (!idx || !S.ph) return { erreur: 'Choisis d\'abord une officine' };
      var ph = null, phs = V2.pharmacies || [];
      for (i = 0; i < phs.length; i++) if (String(phs[i].id) === String(S.ph)) ph = phs[i];
      if (!ph) return { erreur: 'Officine introuvable' };
      titre = ph.name;
      lignes = filtrer(M.listingOfficine(idx, S.ph, { stock: stockIP() }).lignes);
    }
    lignes = lignes.slice(0, 60);
    if (!lignes.length) return { erreur: 'Aucun produit à imprimer' };

    // Regroupé dans le vocabulaire du PHARMACIEN, pas dans nos 6 familles
    // internes : nos trois tranches de princeps n'ont de sens que pour nous.
    var BLOCS = [
      { t: 'Médicaments remboursables', f: ['pr_low', 'pr_mid', 'pr_high'] },
      { t: 'Non remboursables', f: ['nr'] },
      { t: 'Génériques', f: ['gen'] },
      { t: 'Biosimilaires', f: ['biosim'] }
    ];
    function famDe(l) {
      if (l.fam) return l.fam;                    // mode Sur mesure
      var f = fiche(l.cip);                       // mode Vendeur
      return f ? f.f : '';
    }
    var rows = '', b, j;
    for (b = 0; b < BLOCS.length; b++) {
      var dedans = [];
      for (i = 0; i < lignes.length; i++) {
        if (BLOCS[b].f.indexOf(famDe(lignes[i])) >= 0) dedans.push(lignes[i]);
      }
      if (!dedans.length) continue;
      rows += '<tr class="bloc"><td colspan="3">' + esc(BLOCS[b].t) +
              ' <span>' + dedans.length + '</span></td></tr>';
      for (j = 0; j < dedans.length; j++) {
        var l = dedans[j], f2 = fiche(l.cip);
        // `net` est porté par la ligne en mode Sur mesure (barème), sinon lu
        // dans PROD_STATS (net moyen réel du réseau).
        var net = (l.net != null) ? l.net : (f2 && f2.net > 0 ? f2.net : null);
        rows += '<tr>' +
          '<td>' + esc(f2 && f2.d ? f2.d : ('CIP ' + l.cip)) + '</td>' +
          '<td class="n">' + esc(String(l.cip)) + '</td>' +
          '<td class="n">' + (net > 0 ? eur(net) : '—') + '</td>' +
        '</tr>';
      }
    }

    var jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>Sélection produits — ' + esc(titre) + '</title><style>' +
      '@page{size:A4;margin:14mm}' +
      'body{font:12px/1.45 Inter,system-ui,sans-serif;color:#10131C;margin:0}' +
      'h1{font-size:19px;margin:0 0 2px;color:#0050E6}' +
      '.sub{color:#5A6478;font-size:12px;margin-bottom:14px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6478;' +
      'border-bottom:1.5px solid #0050E6;padding:6px 4px}' +
      'td{padding:6px 4px;border-bottom:1px solid #E6E9F0}' +
      'td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.pied{margin-top:16px;font-size:10px;color:#8A93A6}' +
      'tr.bloc td{padding:14px 4px 5px;font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.05em;color:#0050E6;border-bottom:1px solid #0050E6}' +
      'tr.bloc span{color:#8A93A6;font-weight:500}' +
      '</style></head><body>' +
      '<h1>Sélection produits — ' + esc(titre) + '</h1>' +
      '<div class="sub">Établie le ' + esc(jour) + ' · Intégral Pharma</div>' +
      '<table><thead><tr><th>Produit</th><th class="n">CIP</th>' +
      '<th class="n">Prix net</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="pied">Tous les produits de cette sélection sont disponibles au jour de ' +
      'l\'édition, sous réserve des stocks.</div>' +
      '</body></html>';

    return { html: html, titre: titre, lignes: lignes.length };
  };

  V2.produits.pdf = function () {
    var r = V2.produits.pdfHtml();
    if (!r || r.erreur) { if (V2.toast) V2.toast((r && r.erreur) || 'Moteur indisponible'); return; }
    var html = r.html;
    // Blob plutôt que document.write : pas d'écriture dans un document ouvert,
    // et la fenêtre d'impression reçoit une vraie URL.
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      if (V2.toast) V2.toast('Autorise les fenêtres pour sortir le PDF');
      return;
    }
    w.focus();
    setTimeout(function () {
      try { w.print(); } catch (e) {}
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }, 400);
  };

  // ── Page ───────────────────────────────────────────────────────
  V2.pages.produits = {
    render: function (root, param) {
      if (param) S.ph = String(param);
      injectStyles();
      var onglets = '' +
        '<div class="pr-modes">' +
          '<button class="pr-mode' + (S.mode === 'vendeur' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'vendeur\')">Vendeur</button>' +
          '<button class="pr-mode' + (S.mode === 'achats' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'achats\')">Achats</button>' +
          '<button class="pr-mode' + (S.mode === 'surmesure' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'surmesure\')">Sur mesure</button>' +
        '</div>';
      // Normalisé à chaque rendu, pas seulement au premier chargement : S.sm est
      // exposé sur V2.produits.S, donc modifiable de l'extérieur.
      S.sm = S.sm ? smNormaliser(S.sm) : smCharger();
      var corps = S.mode === 'vendeur' ? rendreVendeur()
        : S.mode === 'achats' ? rendreAchats()
        : rendreSurMesure();
      root.innerHTML =
        V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap pr-wrap">' +
          '<div class="v2-page-title">Produits</div>' +
          onglets + corps + liensBas() +
        '</div>';
    }
  };

  function liensBas() {
    var l = [];
    if (V2.pages.catalogue) l.push('<a onclick="V2.go(\'catalogue\')">Catalogue complet</a>');
    if (V2.pages.molecules) l.push('<a onclick="V2.go(\'molecules\')">Prix par produit</a>');
    if (V2.pages.appro) l.push('<a onclick="V2.go(\'appro\')">Vue achats détaillée</a>');
    return l.length ? '<div class="pr-liens">' + l.join('') + '</div>' : '';
  }

  function injectStyles() {
    if (document.getElementById('pr-styles')) return;
    var s = document.createElement('style');
    s.id = 'pr-styles';
    s.textContent = [
      '.pr-wrap{padding-bottom:64px}',
      '.pr-modes{display:flex;gap:8px;margin:12px 0}',
      '.pr-mode{min-height:44px;padding:0 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 15px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-mode.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-bandeau{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}',
      '.pr-select{width:100%;min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);padding:0 10px;background:var(--paper);color:var(--ip-ink)}',
      '.pr-ctx{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font:600 14px/1.3 Inter,sans-serif}',
      '.pr-ctx-pot{color:var(--ip-blue)}',
      '.pr-ctx-n,.pr-ctx-grp{color:var(--muted)}',
      '.pr-note{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(199,121,26,.10);border:1px solid rgba(199,121,26,.30);font:500 13px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-pdf{margin-top:12px;width:100%;min-height:44px}',
      // Sur grand écran, un bouton de 1 000 px de large est absurde.
      '@media (min-width:760px){.pr-pdf{width:auto;padding:0 28px}}',
      '.pr-source{margin-top:10px;font:400 12px/1 Inter,sans-serif;color:var(--muted)}',
      '.pr-filtres{margin-bottom:12px}',
      '.pr-search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0 12px;min-height:44px}',
      '.pr-search input{flex:1;border:0;background:transparent;font-size:16px;color:var(--ip-ink);outline:none}',
      '.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.pr-chip{min-height:36px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 13px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-chip.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px}',
      '.pr-lib{font:700 15px/1.35 Satoshi,Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-fam{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font:600 11px/1.6 Inter,sans-serif;color:var(--fc);border:1px solid var(--fc)}',
      '.pr-rupt{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--c-rose);color:#fff;font:600 11px/1.6 Inter,sans-serif}',
      '.pr-arg{margin-top:6px;font:400 14px/1.4 Inter,sans-serif;color:var(--muted)}',
      '.pr-chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}',
      '.pr-chiffres span{display:block;font:600 15px/1.2 "Geist Mono",ui-monospace,monospace;color:var(--ip-ink)}',
      '.pr-chiffres em{display:block;font:400 11px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.pr-pot span{color:var(--ip-blue)}',
      '.pr-plus{width:100%;min-height:44px;margin-top:8px}',
      '.pr-liens{display:flex;flex-wrap:wrap;gap:14px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}',
      '.pr-liens a{font:500 13px/1 Inter,sans-serif;color:var(--muted);cursor:pointer;text-decoration:underline}',
      '.pr-defile{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '.pr-defile::-webkit-scrollbar{display:none}',
      '.pr-defile .pr-chip{flex:none}',
      '.sm-plier{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;min-height:44px;margin:10px 0;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--paper);font:600 14px/1.2 Inter,sans-serif;color:var(--ip-blue);cursor:pointer;text-align:left}',
      '.sm-plier em{font:400 12px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.sm-nom{margin-bottom:10px}',
      '.sm-presets{margin-bottom:12px}',
      '.sm-grille{display:flex;flex-direction:column;gap:8px}',
      '.sm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line)}',
      '.sm-fam{display:flex;align-items:center;gap:7px;font:600 14px/1.3 Inter,sans-serif;color:var(--ip-ink);flex:1;min-width:150px}',
      '.sm-dot{width:9px;height:9px;border-radius:50%;flex:none}',
      '.sm-fam em{font:400 12px/1 Inter,sans-serif;color:var(--muted);font-style:normal;white-space:nowrap}',
      '.sm-fam em.sm-manque{color:var(--c-rose);font-weight:600}',
      '.sm-ctl{display:flex;align-items:center;gap:6px}',
      '.sm-b{width:44px;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 20px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.sm-n{width:56px;min-height:44px;text-align:center;font:600 16px/1 "Geist Mono",ui-monospace,monospace;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ip-ink)}',
      '.sm-ab{min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ip-ink);padding:0 6px}',
      '.sm-ab-non{width:70px;text-align:center;color:var(--muted);font:400 13px/1 Inter,sans-serif}',
      '@media (max-width:430px){.pr-chiffres{grid-template-columns:repeat(2,1fr);gap:10px}}',
      '@media (prefers-reduced-motion: reduce){.pr-row,.pr-chip,.pr-mode{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
