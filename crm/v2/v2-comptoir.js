/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Produits — « Le comptoir » (vue d'entrée de l'écran Produits)
   Choisi par Will le 15/09/2026 parmi trois maquettes (c2).
   Le catalogue de TOUS les établissements Intégral, qu'on interroge :
     · une recherche (nom, CIP, molécule, laboratoire) + filtres ;
     · un tableau : prix net, nos ventes, rang France, notre part face à la
       part moyenne, potentiel, stock de chacun des 7 établissements,
       nombre d'officines à qui le proposer ;
     · un panneau par produit : ventes, stock par site, à qui le proposer.
   Opportunité = parmi les meilleures ventes France ET nos ventes sous
   notre part moyenne (même calcul que v2-appro.js::partGlobale).
   Stock par établissement : UNIQUEMENT ce que donne etab-prices-data.js
   (aujourd'hui les non remboursables). Pour le reste on montre le stock
   consolidé et on le dit — jamais de répartition inventée.
   Les vues par officine / groupement / prospect / achats restent dans
   v2-produits.js, atteignables depuis le pied de page et le panneau.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var escAttr = function (s) { return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, '')); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };

  var ETABS = ['CPR', 'HP', 'MSP', 'OPS', 'POS', 'SEP', 'SOP'];
  var FAM_ORDRE = ['pr_low', 'pr_mid', 'pr_high', 'nr', 'gen', 'biosim'];
  var PAR_PAGE = 40, OFF_VISIBLES = 5;
  var MINVEL = 5;          // même seuil que v2-appro.js : ≥ 5 boîtes/mois = produit « mouvant »
  var ECHELLE_PART = 3;    // la mini-barre va de 0 à 3 × la part moyenne

  var C = { q: '', fam: 'all', opp: true, stock: false, top: 200, tri: 'potentiel',
            page: 1, cip: null, offTout: false };
  var D = { nat: null, natEtat: 0, etabEtat: 0, catEtat: 0,
            cache: null, sig: '', aqui: null, aquiIdx: null, aquiEtat: 0, noms: null };

  // L'espace fine insécable de toLocaleString est quasi invisible sous WebKit.
  function fr(n, dec) {
    return (+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 })
      .replace(/ /g, ' ');
  }
  function eur2(n) { return fr(n, 2) + ' €'; }
  function eurK(n) {
    n = +n || 0;
    if (Math.abs(n) >= 1e6) return fr(n / 1e6, 2) + ' M€';
    if (Math.abs(n) >= 1e3) return fr(n / 1e3) + ' k€';
    return fr(n) + ' €';
  }
  function numK(n) {
    n = +n || 0;
    if (Math.abs(n) >= 1e6) return fr(n / 1e6, 2) + ' M';
    if (Math.abs(n) >= 1e4) return fr(n / 1e3) + ' k';
    return fr(n);
  }
  function sansAccent(x) {
    var v = String(x == null ? '' : x).toLowerCase();
    if (v.normalize) v = v.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return v;
  }
  function stockIP() { return (window.STOCK_IP && window.STOCK_IP.data) || {}; }
  function rerender() { if (V2.route && V2.route.name === 'produits' && V2.render) V2.render(); }

  // ── Chargements à la demande ──────────────────────────────────
  function charger() {
    if (!V2.produits.catalogueIndex() && !D.catEtat && V2.loadFiles) {
      D.catEtat = 1;
      V2.loadFiles(['catcomplet']).then(function () { D.catEtat = 2; rerender(); });
    }
    if (!D.natEtat) {
      D.natEtat = 1;
      // Même adresse que l'écran Appro : un seul téléchargement par jour.
      var jour = new Date().toISOString().slice(0, 10);
      fetch('national.json?d=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { D.nat = j || { data: {} }; D.natEtat = 2; rerender(); })
        .catch(function () { D.nat = { data: {} }; D.natEtat = 3; rerender(); });
    }
    if (!window.ETAB_PRICES && !D.etabEtat) {
      D.etabEtat = 1;
      var s = document.createElement('script');
      s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260803j');
      s.async = true;
      s.onload = s.onerror = function () { D.etabEtat = 2; rerender(); };
      document.head.appendChild(s);
    }
  }

  // ── Nos ventes annualisées, sur les mois COMPLETS ─────────────
  function ventesAn() {
    var S = window.WML_SALES, an = {}, garde = {}, mois = [], i, c;
    if (!S || !S.length) return { an: an, mois: mois };
    if (V2.approMoisRetenus) mois = V2.approMoisRetenus(S);
    else {
      var vus = {};
      for (i = 0; i < S.length; i++) if (S[i][1] >= 1 && S[i][1] <= 12) vus[S[i][1]] = 1;
      mois = Object.keys(vus).map(Number).sort(function (a, b) { return a - b; });
    }
    for (i = 0; i < mois.length; i++) garde[mois[i]] = 1;
    for (i = 0; i < S.length; i++) {
      var r = S[i], q = r[4] || 0;
      if (q <= 0 || !garde[r[1]]) continue;
      c = String(r[3]);
      an[c] = (an[c] || 0) + q;
    }
    var n = mois.length || 1;
    for (c in an) if (Object.prototype.hasOwnProperty.call(an, c)) an[c] = an[c] / n * 12;
    return { an: an, mois: mois };
  }

  // ── Le catalogue enrichi ──────────────────────────────────────
  function donnees() {
    var CAT = V2.produits.catalogueIndex();
    if (!CAT || D.natEtat < 2) return null;
    var S = window.WML_SALES;
    var sig = (S ? S.length : 0) + '|' + D.natEtat + '|' + (window.ETAB_PRICES ? 1 : 0) + '|' + C.top +
      '|' + (window.PROD_STATS || []).length;
    if (D.cache && D.sig === sig) return D.cache;

    var N = (D.nat && D.nat.data) || {}, V = ventesAn(), STK = stockIP();
    var R = (window.RUPTURES && window.RUPTURES.data) || {};
    var c, i;

    // Part moyenne : reprend v2-appro.js::partGlobale (stock connu ∪ produits mouvants).
    var ip = 0, nat = 0;
    for (c in N) {
      if (!Object.prototype.hasOwnProperty.call(N, c) || !(N[c] && N[c].v > 0)) continue;
      var a = V.an[c] || 0;
      if (!Object.prototype.hasOwnProperty.call(STK, c) && a / 12 < MINVEL) continue;
      ip += a; nat += N[c].v;
    }
    var partMoy = nat > 0 ? ip / nat : 0;

    var rangs = {}, tri = [];
    for (c in N) if (Object.prototype.hasOwnProperty.call(N, c) && N[c] && N[c].v > 0) tri.push(c);
    tri.sort(function (x, y) { return N[y].v - N[x].v; });
    for (i = 0; i < tri.length; i++) rangs[tri[i]] = i + 1;

    var PS = {}, P = window.PROD_STATS || [];
    for (i = 0; i < P.length; i++) PS[String(P[i].c)] = P[i];
    var EP = (window.ETAB_PRICES && window.ETAB_PRICES.prices) || null;
    var M = window.V2PRODUITS, porte = function (f) { return M ? M.porteAbandon(f) : String(f || '').indexOf('pr_') === 0; };

    var lignes = [], nDetail = 0;
    for (c in CAT) {
      if (!Object.prototype.hasOwnProperty.call(CAT, c)) continue;
      var o = CAT[c], ps = PS[c];
      var fam = (ps && ps.f) || o.f;
      var ppht = +(ps && ps.ppht) || +o.ppht || 0;
      var net = +(ps && ps.net) || +o.net || 0;
      var lib = (ps && ps.d) || o.d || ('CIP ' + c);
      var n = N[c], vente = V.an[c] || 0, rg = rangs[c] || 0;
      var part = (n && n.v > 0) ? vente / n.v : null;
      var ecart = (n && n.v > 0 && partMoy > 0) ? Math.max(0, n.v * partMoy - vente) : 0;
      var opp = !!(rg && rg <= C.top && part !== null && part < partMoy);
      var etab = null;
      if (EP) {
        for (i = 0; i < ETABS.length; i++) {
          var x = EP[ETABS[i]] && EP[ETABS[i]][c];
          if (x) { etab = etab || {}; etab[ETABS[i]] = Math.max(0, +x[1] || 0); }
        }
        if (etab) for (i = 0; i < ETABS.length; i++) if (etab[ETABS[i]] === undefined) etab[ETABS[i]] = 0;
      }
      if (etab) nDetail++;
      lignes.push({
        cip: c, d: lib, labo: o.labo || '', mol: o.mol || '', f: fam,
        ppht: ppht, net: net,
        ab: (porte(fam) && ppht > 0 && net > 0 && net < ppht) ? ppht - net : null,
        // Le fichier de stock porte des valeurs négatives (-367, -1 149…) :
        // bornées à 0, comme dans l'écran Appro.
        stock: Math.max(0, Object.prototype.hasOwnProperty.call(STK, c) ? (+STK[c] || 0) : (+o.stock || 0)),
        rupt: !!R[c], an: vente, rang: rg, part: part, france: n ? n.v : 0,
        ecart: ecart, pot: opp ? ecart * (net > 0 ? net : ppht) : 0, opp: opp, etab: etab,
        hay: sansAccent(lib + ' ' + c + ' ' + (o.labo || '') + ' ' + (o.mol || ''))
      });
    }
    D.cache = { lignes: lignes, partMoy: partMoy, mois: V.mois, nDetail: nDetail,
                natGen: D.nat && D.nat.generated, parCip: null };
    D.cache.parCip = {};
    for (i = 0; i < lignes.length; i++) D.cache.parCip[lignes[i].cip] = lignes[i];
    D.sig = sig;
    return D.cache;
  }

  // ── « À qui le proposer » : la liste par officine, retournée par produit ──
  // Même primitive que la vue Client (listingOfficine). ~0,6 s pour tout le
  // réseau : calculé une fois, après le premier affichage.
  function aQui() {
    var idx = V2.produits.index();
    if (!idx || !(V2.sales || []).length) return null;
    if (D.aqui && D.aquiIdx === idx) return D.aqui;
    if (D.aquiEtat === 1) return null;
    D.aquiEtat = 1;
    setTimeout(function () {
      var M = window.V2PRODUITS, par = {}, id, i, stk = stockIP();
      if (M) {
        for (id in idx.officines) {
          if (!Object.prototype.hasOwnProperty.call(idx.officines, id)) continue;
          var r = M.listingOfficine(idx, id, { stock: stk, garantirMin: false, exigerStock: false });
          for (i = 0; i < r.lignes.length; i++) {
            var l = r.lignes[i];
            (par[l.cip] || (par[l.cip] = [])).push({
              id: id, peers: l.peers, n: r.nbConfreres, pot: l.potentiel,
              grp: !!(r.groupe && r.groupe.type === 'groupement')
            });
          }
        }
        for (id in par) if (Object.prototype.hasOwnProperty.call(par, id)) par[id].sort(function (a, b) { return b.pot - a.pot; });
      }
      D.aqui = par; D.aquiIdx = idx; D.aquiEtat = 2;
      rerender();
    }, 40);
    return null;
  }
  function officine(id) {
    if (!D.noms || D.nomsN !== (V2.pharmacies || []).length) {
      D.noms = {}; D.nomsN = (V2.pharmacies || []).length;
      (V2.pharmacies || []).forEach(function (p) { D.noms[String(p.id)] = p; });
    }
    return D.noms[String(id)] || null;
  }

  // ── Filtres et tri ────────────────────────────────────────────
  function filtrees(L) {
    var q = sansAccent(C.q).trim(), out = [], i;
    for (i = 0; i < L.length; i++) {
      var l = L[i];
      if (C.fam !== 'all' && l.f !== C.fam) continue;
      if (C.opp && !l.opp) continue;
      if (C.stock && !(l.stock > 0)) continue;
      if (q && l.hay.indexOf(q) < 0) continue;
      out.push(l);
    }
    var t = C.tri;
    out.sort(function (a, b) {
      if (t === 'rang') return (a.rang || 1e9) - (b.rang || 1e9);
      if (t === 'ventes') return b.an - a.an;
      if (t === 'az') return a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
      return (b.pot - a.pot) || (b.an - a.an);
    });
    return out;
  }

  // ── Commandes ─────────────────────────────────────────────────
  var tq = null;
  V2.comptoir = {
    q: function (v) {
      C.q = v || '';
      if (tq) clearTimeout(tq);
      // Taper ne relance jamais V2.render() : le champ perdrait le focus
      // et le clavier se refermerait sur iPhone. On ne remplace que la liste.
      tq = setTimeout(function () { C.page = 1; majResultats(); }, 160);
    },
    effacer: function () { C.q = ''; C.page = 1; rerender(); },
    fam: function (k) { C.fam = k; C.page = 1; rerender(); },
    opp: function () { C.opp = !C.opp; C.page = 1; rerender(); },
    stock: function () { C.stock = !C.stock; C.page = 1; rerender(); },
    top: function (v) { C.top = parseInt(v, 10) || 200; C.page = 1; rerender(); },
    tri: function (v) { C.tri = v || 'potentiel'; C.page = 1; rerender(); },
    plus: function () { C.page += 1; majResultats(); },
    ouvrir: function (cip) { C.cip = String(cip); C.offTout = false; rerender(); },
    fermer: function () { C.cip = null; rerender(); },
    offTout: function () { C.offTout = true; rerender(); },
    // Ouvre la vue Client de cette officine avec ce produit déjà retenu :
    // le document, le PDF et le mail existants prennent le relais.
    pourOfficine: function (id, cip) {
      var S = V2.produits.S;
      V2.comptoir.fermerPanneau();
      if (S && S.sel && !S.sel[String(cip)] && V2.produits.selBascule) V2.produits.selBascule(String(cip));
      V2.go('produits', String(id));
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────
  function dotCls(v) { return v <= 0 ? 'z' : v < 50 ? 'l' : 'g'; }
  function partHtml(l, partMoy) {
    if (l.part === null || !(partMoy > 0)) return '<span class="cp-part-na">—</span>';
    var max = partMoy * ECHELLE_PART;
    var rempli = Math.max(0, Math.min(l.part / max, 1)) * 100;
    var repere = 100 / ECHELLE_PART;
    var pct = l.part * 100;
    var txt = l.an <= 0 ? '0 %' : pct < 0.005 ? '< 0,01 %' : fr(pct, 2) + ' %';
    return '<span class="cp-part"><span class="cp-part-t">' +
      '<span class="cp-part-f" style="width:' + rempli.toFixed(1) + '%"></span>' +
      '<span class="cp-part-m" style="left:' + repere.toFixed(1) + '%"></span></span>' +
      '<span class="cp-part-p">' + txt + '</span></span>';
  }
  function etabsCellules(l) {
    if (!l.etab) {
      return '<span class="cp-etab-tot" title="Détail par établissement non disponible pour ce produit">' +
        fr(l.stock) + ' en stock · tous sites</span>';
    }
    var h = '', i;
    for (i = 0; i < ETABS.length; i++) {
      var v = l.etab[ETABS[i]];
      h += '<span class="cp-dot-c" title="' + ETABS[i] + ' : ' + fr(v) + '"><span class="cp-dot ' + dotCls(v) + '"></span></span>';
    }
    return h;
  }
  function aQuiNb(l, AQ) {
    if (!AQ) return '…';
    return fr((AQ[l.cip] || []).length);
  }
  function badges(l) {
    return (l.opp ? '<span class="cp-badge">Opportunité</span>' : '') +
      (l.rupt ? '<span class="cp-badge cp-badge-r">Rupture ANSM</span>' : '');
  }
  function ligneTable(l, d, AQ) {
    return '<button class="cp-row" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')">' +
      '<span class="cp-nom"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="cp-num"><b>' + (l.net > 0 ? eur2(l.net) : '—') + '</b>' +
        (l.ab != null ? '<i title="Abandon de marge">−' + eur2(l.ab) + '</i>' : '') + '</span>' +
      '<span class="cp-num"><b>' + numK(l.an) + '</b><i>bt/an</i></span>' +
      '<span class="cp-num cp-rang">' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</span>' +
      partHtml(l, d.partMoy) +
      '<span class="cp-num">' + (l.opp ? '<b>' + eurK(l.pot) + '</b><i>par an</i>' : '<span class="cp-na">—</span>') + '</span>' +
      etabsCellules(l) +
      '<span class="cp-aqui">' + aQuiNb(l, AQ) + '</span>' +
      '</button>';
  }
  function carte(l, d, AQ) {
    return '<button class="cp-card" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')">' +
      '<span class="cp-card-h"><span class="cp-card-n"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="cp-num"><b>' + (l.net > 0 ? eur2(l.net) : '—') + '</b>' +
        (l.ab != null ? '<i>Abandon ' + eur2(l.ab) + '</i>' : '') + '</span></span>' +
      '<span class="cp-card-v"><b>' + fr(l.an) + '</b> bt/an · France <b>' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</b></span>' +
      '<span class="cp-card-p">' + partHtml(l, d.partMoy) + '</span>' +
      (l.opp ? '<span class="cp-pill">Potentiel <b>' + eurK(l.pot) + '</b> par an</span>' : '') +
      '<span class="cp-card-b"><span class="cp-strip">' + etabsCellules(l) + '</span>' +
        '<span class="cp-aqui">à qui : ' + aQuiNb(l, AQ) + '</span></span>' +
      '</button>';
  }
  function resultatsHtml(d) {
    var L = filtrees(d.lignes), AQ = aQui();
    var vis = L.slice(0, C.page * PAR_PAGE), rows = '', cards = '', i;
    for (i = 0; i < vis.length; i++) { rows += ligneTable(vis[i], d, AQ); cards += carte(vis[i], d, AQ); }
    var head = '<div class="cp-head"><span>Produit</span><span class="n">Prix net</span><span class="n">Ventes</span>' +
      '<span class="n">France</span><span>Part</span><span class="n">Potentiel</span>';
    for (i = 0; i < ETABS.length; i++) head += '<span class="c">' + ETABS[i] + '</span>';
    head += '<span class="c">À qui</span></div>';
    var reste = L.length - vis.length;
    return '<div class="cp-count" id="cp-count-src" data-n="' + L.length + '"></div>' +
      (L.length
        ? '<div class="cp-table">' + head + '<div class="cp-body">' + rows + '</div></div>' +
          '<div class="cp-cards">' + cards + '</div>' +
          (reste > 0 ? '<button class="cp-more" onclick="V2.comptoir.plus()">Voir ' + fr(Math.min(reste, PAR_PAGE)) +
            ' produits de plus <i>(' + fr(reste) + ' restants)</i></button>' : '')
        : '<div class="cp-vide">Aucun produit ne correspond' +
          (C.opp ? ' — retirez le filtre « Opportunités seulement » pour chercher dans tout le catalogue.' : '.') + '</div>');
  }
  function libCompte(n) { return fr(n) + ' produit' + (n > 1 ? 's' : ''); }
  function majResultats() {
    var box = document.getElementById('cp-res'), d = donnees();
    if (!box || !d) return;
    box.innerHTML = resultatsHtml(d);
    var src = document.getElementById('cp-count-src'), cnt = document.getElementById('cp-count');
    if (src && cnt) cnt.textContent = libCompte(+src.getAttribute('data-n') || 0);
  }

  function panneauHtml(d) {
    var l = C.cip && d.parCip[C.cip];
    if (!l) return '';
    var FAM = V2.produits.FAM || {};
    var AQ = aQui(), liste = AQ ? (AQ[l.cip] || []) : null, i;
    var aLaMoy = l.france > 0 ? l.france * d.partMoy : 0;

    var ventes;
    if (!(l.france > 0)) {
      ventes = '<p class="cp-phrase">Nous vendons <b>' + fr(l.an) + '</b> boîtes par an. Ce produit n\'est pas dans les ventes France ' +
        '(Open Medic) : pas de comparaison possible.</p>';
    } else {
      ventes = '<div class="cp-vgrid">' +
        '<div><em>Nos ventes</em><b>' + fr(l.an) + ' <small>bt/an</small></b></div>' +
        '<div><em>À notre part moyenne</em><b>' + fr(aLaMoy) + ' <small>bt/an</small></b></div>' +
        '<div><em>France</em><b>n°' + fr(l.rang) + '</b></div></div>' +
        (l.ecart > 0
          ? '<p class="cp-ecart">Écart : ' + fr(l.ecart) + ' boîtes par an' +
            (l.opp ? ' · potentiel ' + fr(l.pot) + ' € par an si on rejoint notre part moyenne.'
                   : ' · hors du top ' + C.top + ' France, donc pas compté comme opportunité.') + '</p>'
          : '<p class="cp-ecart plat">Nous sommes déjà à notre part moyenne, ou au-dessus.</p>');
    }

    var stock;
    if (l.etab) {
      stock = '<div class="cp-sgrid">';
      for (i = 0; i < ETABS.length; i++) {
        stock += '<div class="' + (l.etab[ETABS[i]] > 0 ? '' : 'zero') + '"><em>' + ETABS[i] + '</em><b>' + fr(l.etab[ETABS[i]]) + '</b></div>';
      }
      stock += '</div><p class="cp-note">Stock déclaré par chaque établissement.</p>';
    } else {
      stock = '<div class="cp-sgrid"><div class="large"><em>Tous sites</em><b>' + fr(l.stock) + '</b></div></div>' +
        '<p class="cp-note">Le détail par établissement n\'existe aujourd\'hui que pour les non remboursables.</p>';
    }

    var off;
    if (!liste) off = '<p class="cp-note">Calcul en cours…</p>';
    else if (!liste.length) off = '<p class="cp-note">Aucune officine : ses confrères ne le prennent pas assez souvent pour le proposer.</p>';
    else {
      var vis = C.offTout ? liste : liste.slice(0, OFF_VISIBLES);
      off = '';
      for (i = 0; i < vis.length; i++) {
        var o = vis[i], p = officine(o.id) || {};
        var grp = p.groupement ? (V2.canonGrp ? (V2.canonGrp(p.groupement) || p.groupement) : p.groupement) : '';
        off += '<div class="cp-off"><div class="cp-off-m">' +
          '<b>' + esc(p.name || ('Officine ' + o.id)) + '</b>' +
          '<span>' + esc([p.ville, grp].filter(Boolean).join(' · ')) + '</span>' +
          '<span>' + fr(o.peers) + ' des ' + fr(o.n) + (o.grp ? ' confrères du groupement' : ' officines comparables') +
            ' le prennent · potentiel ' + eurK(o.pot) + '</span></div>' +
          '<button class="cp-off-b" onclick="V2.comptoir.pourOfficine(\'' + escAttr(o.id) + '\',\'' + escAttr(l.cip) + '\')">Sa liste</button></div>';
      }
      if (!C.offTout && liste.length > OFF_VISIBLES) {
        off += '<button class="cp-more" onclick="V2.comptoir.offTout()">Voir les ' + fr(liste.length - OFF_VISIBLES) + ' autres</button>';
      }
    }

    return '<div class="cp-fond" onclick="V2.comptoir.fermer()"></div>' +
      '<aside class="cp-pan" role="dialog" aria-label="Fiche produit">' +
      '<div class="cp-pan-h"><div><p class="cp-pan-t">' + esc(l.d) + '</p>' +
        '<p class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip, FAM[l.f] ? FAM[l.f].l : ''].filter(Boolean).join(' · ')) + '</p></div>' +
        '<button class="cp-x" aria-label="Fermer" onclick="V2.comptoir.fermer()">' + (ICO('close', 18, 2) || '✕') + '</button></div>' +
      '<div class="cp-pan-c">' +
        '<div class="cp-prix"><b>' + (l.net > 0 ? eur2(l.net) : '—') + '</b>' +
          (l.ab != null ? '<s>' + eur2(l.ppht) + '</s><span class="cp-tag">Abandon de marge ' + eur2(l.ab) + ' / boîte</span>' : '') +
          (l.rupt ? '<span class="cp-tag cp-tag-r">Rupture ANSM</span>' : '') +
          (l.opp ? '<span class="cp-tag">Opportunité</span>' : '') + '</div>' +
        '<p class="cp-st">Ventes</p>' + ventes +
        '<p class="cp-st">Stock par établissement</p>' + stock +
        '<p class="cp-st">À qui le proposer' + (liste ? ' <span>' + fr(liste.length) + '</span>' : '') + '</p>' + off +
        '<button class="v2-btn v2-btn-primary cp-cta" onclick="V2.produits.ficheMarketing(\'' + escAttr(l.cip) + '\')">Fiche marketing du produit</button>' +
      '</div></aside>';
  }

  // Le panneau vit sous <body>, pas dans la page : #v2-root garde la
  // transformation de son animation d'entrée (mo-view-in), et un
  // position:fixed placé dedans se cale sur la page au lieu de l'écran —
  // mesuré sous WebKit à 390 px : feuille ouverte à 7 378 px du haut.
  function hote() {
    var h = document.getElementById('cp-pan-hote');
    if (!h) {
      h = document.createElement('div');
      h.id = 'cp-pan-hote';
      document.body.appendChild(h);
      window.addEventListener('hashchange', function () {
        if (!/^#produits(\/|$)/.test(location.hash)) V2.comptoir.fermerPanneau();
      });
    }
    return h;
  }
  function poserPanneau(d) { hote().innerHTML = C.cip ? panneauHtml(d) : ''; }
  V2.comptoir.fermerPanneau = function () {
    C.cip = null;
    var h = document.getElementById('cp-pan-hote');
    if (h) h.innerHTML = '';
  };

  V2.comptoir.rendre = function () {
    injectStyles();
    charger();
    var d = donnees();
    if (!d) {
      var echec = V2.protegeEchec && V2.protegeEchec.catcomplet;
      return '<div class="v2-empty"><div class="v2-empty-t">' +
        (echec ? 'Le catalogue n\'a pas pu être chargé' : 'Chargement du catalogue…') + '</div>' +
        '<div class="v2-empty-d">' + (echec ? 'Vérifiez la connexion, puis revenez sur cet écran.'
          : 'Les références des 7 établissements et les ventes France arrivent (une seule fois).') + '</div></div>';
    }
    var FAM = V2.produits.FAM || {}, i, k;
    var fams = '<button class="cp-chip' + (C.fam === 'all' ? ' on' : '') + '" onclick="V2.comptoir.fam(\'all\')">Toutes les familles</button>';
    for (i = 0; i < FAM_ORDRE.length; i++) {
      k = FAM_ORDRE[i];
      if (FAM[k]) fams += '<button class="cp-chip' + (C.fam === k ? ' on' : '') + '" onclick="V2.comptoir.fam(\'' + k + '\')">' + esc(FAM[k].l) + '</button>';
    }
    var tops = [50, 100, 200, 500], selTop = '';
    for (i = 0; i < tops.length; i++) selTop += '<option value="' + tops[i] + '"' + (C.top === tops[i] ? ' selected' : '') + '>Meilleures ventes France : top ' + tops[i] + '</option>';
    var tris = [['potentiel', 'potentiel'], ['rang', 'rang France'], ['ventes', 'nos ventes'], ['az', 'A → Z']], selTri = '';
    for (i = 0; i < tris.length; i++) selTri += '<option value="' + tris[i][0] + '"' + (C.tri === tris[i][0] ? ' selected' : '') + '>Trier : ' + tris[i][1] + '</option>';

    var n = filtrees(d.lignes).length;
    var MOIS = ['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var periode = d.mois.length ? MOIS[d.mois[0]] + '–' + MOIS[d.mois[d.mois.length - 1]] + ' (' + d.mois.length + ' mois complets)' : '—';

    poserPanneau(d);
    return '<div class="cp">' +
      '<div class="cp-tete">' +
        '<div class="cp-tete-l"><span class="cp-sous">Catalogue des 7 établissements</span><span class="cp-n" id="cp-count">' + libCompte(n) + '</span></div>' +
        '<div class="cp-search">' + ICO('search', 18, 2) +
          '<input type="search" autocomplete="off" enterkeyhint="search" placeholder="Nom, CIP, molécule, laboratoire…" value="' + escAttr(C.q) + '"' +
          ' oninput="V2.comptoir.q(this.value)">' +
        '</div>' +
        '<div class="cp-chips">' + fams + '</div>' +
        '<div class="cp-chips">' +
          '<button class="cp-chip' + (C.opp ? ' on' : '') + '" onclick="V2.comptoir.opp()">Opportunités seulement</button>' +
          '<button class="cp-chip' + (C.stock ? ' on' : '') + '" onclick="V2.comptoir.stock()">En stock</button>' +
          '<select class="cp-sel" aria-label="Meilleures ventes France" onchange="V2.comptoir.top(this.value)">' + selTop + '</select>' +
          '<select class="cp-sel" aria-label="Tri" onchange="V2.comptoir.tri(this.value)">' + selTri + '</select>' +
        '</div>' +
        '<div class="cp-leg"><span><i class="cp-dot g"></i>stock ≥ 50</span><span><i class="cp-dot l"></i>1 à 49</span>' +
          '<span><i class="cp-dot z"></i>0</span><span><i class="cp-leg-m"></i>part moyenne ' + fr(d.partMoy * 100, 2) + ' %</span></div>' +
      '</div>' +
      '<div id="cp-res">' + resultatsHtml(d) + '</div>' +
      '<p class="cp-src">Opportunité = dans le top ' + C.top + ' des ventes France et nos ventes sous notre part moyenne. ' +
        'Nos ventes : réseau, ' + esc(periode) + ', ramenées à l\'année. Ventes France : Open Medic' +
        (d.natGen ? ' (mis à jour le ' + esc(String(d.natGen).split('-').reverse().join('/')) + ')' : '') + '. ' +
        'Stock par établissement connu pour ' + fr(d.nDetail) + ' références (non remboursables) ; ailleurs, stock total des 7 sites.</p>' +
      '</div>';
  };

  function injectStyles() {
    if (document.getElementById('cp-styles')) return;
    var s = document.createElement('style');
    s.id = 'cp-styles';
    s.textContent = [
      '.cp,#cp-pan-hote{--cp-wash:#EAF1FF;--cp-deep:#0034A0;--cp-green:#0F7A52;--cp-amber:#9A5B12;--cp-amberw:#FBF0E1;--cp-alt:#F7F9FC;--cp-ink3:#5B6272;--cp-shadow:0 1px 2px rgba(16,19,28,.05),0 10px 26px -16px rgba(16,19,28,.28)}',
      // La lumière vient d'en haut à gauche, derrière la recherche.
      '.cp-tete{position:relative;margin:8px 0 12px;padding:14px;border-radius:16px;border:1px solid var(--line);background:radial-gradient(520px 200px at 18% -60px,rgba(0,80,230,.11),transparent 70%),radial-gradient(380px 180px at 90% -40px,rgba(0,80,230,.06),transparent 65%),var(--card)}',
      '.cp-tete-l{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}',
      '.cp-sous{font:700 15px/1.2 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-n{font:600 13px/1 Inter,sans-serif;color:var(--cp-ink3);white-space:nowrap}',
      '.cp-search{display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;margin-bottom:10px;border-radius:14px;border:1px solid rgba(16,19,28,.12);background:var(--card);box-shadow:var(--cp-shadow);color:var(--cp-ink3)}',
      '.cp-search input{flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;font-size:16px;color:var(--ip-ink)}',
      '.cp-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-bottom:6px;align-items:center}',
      '.cp-chips::-webkit-scrollbar{display:none}',
      '.cp-chip{flex:none;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(16,19,28,.12);background:var(--card);font:650 13px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer;white-space:nowrap}',
      '.cp-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.cp-sel{flex:none;min-height:36px;padding:0 10px;border-radius:999px;border:1px solid rgba(16,19,28,.12);background:var(--card);font:650 13px/1 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px;font:400 13px/1.3 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-leg span{display:inline-flex;align-items:center;gap:5px}',
      '.cp-leg-m{display:inline-block;width:2px;height:13px;background:var(--ip-ink)}',
      '.cp-dot{display:inline-block;width:10px;height:10px;border-radius:3px;flex:none}',
      '.cp-dot.z{background:var(--cp-amber)}',
      '.cp-dot.l{background:var(--cp-amberw);border:1.5px solid var(--cp-amber)}',
      '.cp-dot.g{background:var(--cp-green)}',
      '.cp-badge{flex:none;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:var(--cp-wash);color:var(--cp-deep);font:700 13px/1 Inter,sans-serif;white-space:nowrap}',
      '.cp-badge-r{background:var(--cp-amberw);color:var(--cp-amber)}',
      '.cp-lib-l{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}',
      '.cp-lib{font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink);text-align:left}',
      '.cp-meta{display:block;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3);text-align:left;margin:1px 0 0}',
      '.cp-num{display:block;text-align:right;white-space:nowrap}',
      '.cp-num b{display:block;font:800 13.5px/1.25 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-num i{display:block;font:400 13px/1.25 Inter,sans-serif;font-style:normal;color:var(--cp-ink3)}',
      '.cp-rang{font:700 13px/1 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-na,.cp-part-na{color:var(--cp-ink3);font:600 13px/1 Inter,sans-serif}',
      '.cp-part{display:flex;align-items:center;gap:6px}',
      '.cp-part-t{position:relative;flex:none;width:56px;height:16px;border-radius:5px;background:var(--cp-alt);border:1px solid rgba(16,19,28,.12)}',
      '.cp-part-f{position:absolute;left:0;top:0;bottom:0;min-width:3px;border-radius:5px;background:var(--ip-blue)}',
      '.cp-part-m{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ip-ink);box-shadow:0 0 0 1px rgba(251,252,254,.9)}',
      '.cp-part-p{font:400 13px/1 Inter,sans-serif;color:var(--cp-ink3);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.cp-aqui{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 10px;border-radius:999px;background:var(--cp-wash);color:var(--cp-deep);font:750 13px/1 Inter,sans-serif;white-space:nowrap}',
      '.cp-etab-tot{grid-column:span 7;font:400 13px/1.3 Inter,sans-serif;color:var(--cp-ink3);text-align:center}',
      '.cp-dot-c{display:flex;align-items:center;justify-content:center}',
      // Ordinateur : le tableau. Téléphone : des cartes.
      '.cp-table{display:none}',
      '.cp-head,.cp-row{display:grid;grid-template-columns:minmax(200px,1.4fr) 84px 72px 62px 118px 84px repeat(7,30px) 62px;align-items:center;gap:8px;padding:0 12px}',
      '.cp-head{height:34px;font:700 13px/1 Inter,sans-serif;color:var(--cp-ink3);text-transform:uppercase;white-space:nowrap}',
      '.cp-head .n{text-align:right}.cp-head .c{text-align:center}',
      '.cp-body{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--cp-shadow);overflow:hidden}',
      '.cp-row{width:100%;min-height:58px;padding-top:8px;padding-bottom:8px;border:0;border-top:1px solid var(--line);background:transparent;cursor:pointer;font:inherit;color:inherit}',
      '.cp-row:first-child{border-top:0}',
      '.cp-row:hover{background:var(--cp-alt)}',
      '.cp-nom{min-width:0}',
      '.cp-row .cp-aqui{justify-self:stretch}',
      '.cp-cards{display:flex;flex-direction:column;gap:8px}',
      '.cp-card{display:block;width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--card);box-shadow:var(--cp-shadow);cursor:pointer;font:inherit;color:inherit;text-align:left}',
      '.cp-card-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}',
      '.cp-card-n{min-width:0}',
      '.cp-card-v{display:block;margin-top:9px;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-card-v b{color:var(--ip-ink);font-weight:700}',
      '.cp-card-p{display:block;margin-top:7px}',
      '.cp-card-p .cp-part-t{width:100px}',
      '.cp-pill{display:inline-flex;align-items:center;gap:5px;min-height:26px;margin-top:8px;padding:0 10px;border-radius:999px;background:var(--cp-wash);color:var(--cp-deep);font:700 13px/1 Inter,sans-serif}',
      '.cp-card-b{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}',
      '.cp-strip{display:flex;align-items:center;gap:5px;min-width:0}',
      '.cp-strip .cp-dot-c{width:auto}',
      '.cp-strip .cp-etab-tot{text-align:left}',
      '@media (min-width:880px){.cp-table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}.cp-cards{display:none}}',
      '.cp-more{display:block;width:100%;min-height:46px;margin-top:10px;border-radius:14px;border:1px dashed rgba(16,19,28,.14);background:var(--cp-alt);font:700 14px/1.2 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.cp-more i{font-style:normal;font-weight:500;color:var(--cp-ink3)}',
      '.cp-vide{padding:36px 16px;text-align:center;border-radius:18px;border:1px solid var(--line);background:var(--card);font:400 14px/1.5 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-src{margin:16px 2px 0;font:400 13px/1.5 Inter,sans-serif;color:var(--cp-ink3)}',
      // Panneau : feuille en bas au téléphone, colonne à droite sur ordinateur.
      '.cp-fond{position:fixed;inset:0;z-index:900;background:rgba(16,19,28,.38)}',
      '.cp-pan{position:fixed;left:0;right:0;bottom:0;z-index:901;max-width:640px;max-height:88vh;margin:0 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--card);border-radius:20px 20px 0 0;box-shadow:0 -20px 50px rgba(16,19,28,.28);padding-bottom:calc(20px + env(safe-area-inset-bottom))}',
      '@media (min-width:1000px){.cp-pan{left:auto;top:0;width:460px;max-width:460px;max-height:none;border-radius:0;box-shadow:-20px 0 50px rgba(16,19,28,.22)}}',
      '.cp-pan-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 20px 12px}',
      '.cp-pan-t{margin:0 0 3px;font:800 16.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-x{flex:none;width:44px;height:44px;margin:-6px -6px 0 0;border-radius:10px;border:1px solid rgba(16,19,28,.12);background:var(--card);color:var(--ip-ink);cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.cp-pan-c{padding:0 20px}',
      '.cp-prix{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:12px 0;margin-bottom:6px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}',
      '.cp-prix b{font:800 20px/1 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-prix s{font:400 13px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-tag{padding:4px 9px;border-radius:999px;background:var(--cp-wash);color:var(--cp-deep);font:700 13px/1.2 Inter,sans-serif}',
      '.cp-tag-r{background:var(--cp-amberw);color:var(--cp-amber)}',
      '.cp-st{margin:16px 0 8px;font:750 13px/1 Inter,sans-serif;text-transform:uppercase;letter-spacing:.02em;color:var(--ip-ink)}',
      '.cp-st span{margin-left:6px;padding:2px 8px;border-radius:999px;background:var(--cp-wash);color:var(--cp-deep)}',
      '.cp-vgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}',
      '.cp-vgrid div,.cp-sgrid div{display:flex;flex-direction:column;gap:3px;padding:9px 8px;border-radius:10px;background:var(--cp-alt);border:1px solid var(--line)}',
      '.cp-vgrid em,.cp-sgrid em{font:650 13px/1.25 Inter,sans-serif;font-style:normal;color:var(--cp-ink3)}',
      '.cp-vgrid b{font:800 15px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-vgrid small{font:650 13px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-phrase{margin:0 0 8px;font:400 13.5px/1.5 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-ecart{margin:0;padding:8px 10px;border-radius:10px;background:var(--cp-wash);color:var(--cp-deep);font:700 13px/1.4 Inter,sans-serif}',
      '.cp-ecart.plat{background:var(--cp-alt);color:var(--cp-ink3);font-weight:600}',
      '.cp-sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}',
      '.cp-sgrid div{align-items:center}',
      '.cp-sgrid div.large{grid-column:span 4}',
      '.cp-sgrid div.zero b{color:var(--cp-amber)}',
      '.cp-sgrid b{font:800 14px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-note{margin:0 0 6px;font:400 13px/1.5 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-off{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}',
      '.cp-off-m{flex:1;min-width:0}',
      '.cp-off-m b{display:block;font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-off-m span{display:block;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-off-b{flex:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--ip-blue);background:var(--card);color:var(--ip-blue);font:700 13.5px/1 Inter,sans-serif;cursor:pointer}',
      '.cp-cta{display:block;width:100%;min-height:50px;margin:16px 0 4px}',
      '@media (max-width:430px){.cp-vgrid{grid-template-columns:1fr 1fr}.cp-vgrid div:last-child{grid-column:span 2}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
