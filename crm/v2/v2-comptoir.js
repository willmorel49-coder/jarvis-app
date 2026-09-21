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
   (remboursables compris depuis le 16/09/2026 ; SEP ajouté le 17/09, POS le 21/09 ; un site
   sans ligne → « non communiqué »). Pour le reste on montre le stock
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
  // Mois par mois (demande de Will, 15/09/2026) : nos ventes, notre part du marché France
  // et le marché France, par produit. Ventes France : france-mois-data.js (Medic'AM).
  var FRANCE_V = '20260915f';
  var ANNEE = 2026;        // même année que les ventes (v2-boot.js : year 2026)
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var GRIS = '#6B7385';    // l'année précédente, en retrait (4,7:1 sur blanc)

  var C = { q: '', fam: 'all', opp: true, stock: false, top: 200, tri: 'potentiel',
            page: 1, cip: null, offTout: false, unite: 'q' };
  var D = { nat: null, natEtat: 0, etabEtat: 0, catEtat: 0,
            cache: null, sig: '', aqui: null, aquiIdx: null, aquiEtat: 0, noms: null,
            frEtat: 0, mensuel: null, mensuelRef: null, mensuelN: 0, frPos: null, frPosRef: null,
            tend: null, tendSig: '', pts: {} };

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
      s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260921m');
      s.async = true;
      s.onload = s.onerror = function () { D.etabEtat = 2; rerender(); };
      document.head.appendChild(s);
    }
  }

  // Ventes France mois par mois : 1,2 Mo, chargé seulement quand on en a besoin
  // (fiche d'un produit ouverte, ou tri par évolution de la part).
  function chargerFrance() {
    if (window.FRANCE_MOIS || D.frEtat) return;
    D.frEtat = 1;
    var s = document.createElement('script');
    s.src = 'france-mois-data.js?v=' + FRANCE_V;
    s.async = true;
    s.onload = s.onerror = function () { D.frEtat = 2; D.tend = null; rerender(); };
    document.head.appendChild(s);
  }

  // ── Mois par mois ─────────────────────────────────────────────
  function pad2(m) { return ('0' + m).slice(-2); }
  function zeros(n) { var a = [], i; for (i = 0; i < n; i++) a.push(0); return a; }

  // Nos boîtes et notre CA par produit, sur les mêmes mois complets que ventesAn().
  function ventesMois(mois) {
    var S = window.WML_SALES, i;
    if (!S || !S.length || !mois || !mois.length) return null;
    if (D.mensuel && D.mensuelRef === S && D.mensuelN === S.length) return D.mensuel;
    var pos = {}, q = {}, ca = {}, n = mois.length;
    for (i = 0; i < n; i++) pos[mois[i]] = i;
    for (i = 0; i < S.length; i++) {
      var r = S[i], k = pos[r[1]];
      if (k === undefined || !(r[4] > 0)) continue;
      var c = String(r[3]);
      if (!q[c]) { q[c] = zeros(n); ca[c] = zeros(n); }
      q[c][k] += r[4];
      ca[c][k] += +r[6] || 0;
    }
    D.mensuel = { mois: mois.slice(), q: q, ca: ca };
    D.mensuelRef = S; D.mensuelN = S.length; D.frPos = null;
    return D.mensuel;
  }

  // Pour chacun de nos mois : sa position dans la série France (-1 si pas encore publié).
  function frPos(VM) {
    var F = window.FRANCE_MOIS;
    if (!F) return null;
    if (D.frPos && D.frPosRef === F) return D.frPos;
    var out = [], i;
    for (i = 0; i < VM.mois.length; i++) out.push(F.meta.mois.indexOf(ANNEE + '-' + pad2(VM.mois[i])));
    D.frPos = out; D.frPosRef = F;
    return out;
  }

  // Notre part sur les premiers mois comparables face aux derniers (3 et 3 au plus).
  function tendPart(q, fm, posF) {
    var idx = [], i;
    for (i = 0; i < q.length; i++) if (posF[i] >= 0 && fm[posF[i]] > 0) idx.push(i);
    var k = Math.min(3, Math.floor(idx.length / 2));
    if (k < 1) return null;
    var q1 = 0, f1 = 0, q2 = 0, f2 = 0;
    for (i = 0; i < k; i++) {
      q1 += q[idx[i]]; f1 += fm[posF[idx[i]]];
      q2 += q[idx[idx.length - 1 - i]]; f2 += fm[posF[idx[idx.length - 1 - i]]];
    }
    return { debut: q1 / f1, fin: q2 / f2, q1: q1, q2: q2, F1: f1, F2: f2,
             a: idx[0], b: idx[k - 1], c: idx[idx.length - k], d: idx[idx.length - 1] };
  }

  function evolution(cip) {
    var d = D.cache, VM = d && ventesMois(d.mois), i;
    if (!VM) return null;
    var F = window.FRANCE_MOIS, n = VM.mois.length, posF = frPos(VM) || [];
    var q = VM.q[cip] || zeros(n), ca = VM.ca[cip] || zeros(n);
    var fm = (F && F.data[cip]) || null, frm = [], part = [];
    for (i = 0; i < n; i++) {
      var v = (fm && posF[i] >= 0) ? fm[posF[i]] : null;
      frm.push(v); part.push(v > 0 ? q[i] / v : null);
    }
    var f25 = [], f26 = [], y0 = 0, y1 = 0, nb = 0, dern = 0;
    if (fm) {
      for (i = 1; i <= 12; i++) {
        var a = F.meta.mois.indexOf((ANNEE - 1) + '-' + pad2(i)), b = F.meta.mois.indexOf(ANNEE + '-' + pad2(i));
        f25.push(a >= 0 ? fm[a] : null); f26.push(b >= 0 ? fm[b] : null);
        if (a >= 0 && b >= 0) { y0 += fm[a]; y1 += fm[b]; nb++; dern = i; }
      }
    }
    var k = Math.min(3, Math.floor(n / 2)), v1 = 0, v2 = 0;
    for (i = 0; i < k; i++) { v1 += q[i]; v2 += q[n - 1 - i]; }
    return { mois: VM.mois, q: q, ca: ca, fr: frm, part: part, f25: f25, f26: f26, aFrance: !!fm,
             k: k, v1: v1, v2: v2, tp: fm ? tendPart(q, fm, posF) : null,
             yoy: y0 > 0 ? y1 / y0 - 1 : null, y1: y1, yoyMois: nb, yoyDern: dern };
  }

  // Évolution de notre part, pour trier le catalogue. Sous ces planchers (10 boîtes de
  // notre côté, 1 000 en France, sur chaque période), une variation n'est que du bruit.
  // r = variation relative de la part (affichée) ; g = boîtes gagnées ou perdues sur la
  // dernière période face à la part du début (le tri) : un +900 % sur 12 boîtes ne doit
  // pas passer devant un +20 % sur un best-seller.
  function tendances() {
    var d = D.cache, F = window.FRANCE_MOIS, VM = d && ventesMois(d.mois);
    if (!F || !VM) return null;
    if (D.tend && D.tendSig === D.sig) return D.tend;
    var posF = frPos(VM), out = {}, c;
    for (c in VM.q) {
      if (!Object.prototype.hasOwnProperty.call(VM.q, c) || !F.data[c]) continue;
      var t = tendPart(VM.q[c], F.data[c], posF);
      if (t && t.q1 >= 10 && t.q2 >= 10 && t.F1 >= 1000 && t.F2 >= 1000) out[c] = { r: t.fin / t.debut - 1, g: (t.fin - t.debut) * t.F2 };
    }
    D.tend = out; D.tendSig = D.sig;
    return out;
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
  // NR tenus par un établissement mais absents du catalogue (arrêté de juin) :
  // generate_etab_prices.py les donne, avec leur nature sûre (AFMCODE).
  function ajouterNrHorsCat(CAT) {
    var X = window.ETAB_PRICES && window.ETAB_PRICES.nrHorsCat, A = (window.ETAB_PRICES && window.ETAB_PRICES.all) || {}, c;
    if (!X || CAT._nrAjout) return;
    for (c in X) {
      if (Object.prototype.hasOwnProperty.call(X, c) && !CAT[c]) {
        var a = A[c] || [0, 0];
        CAT[c] = { c: c, cip: c, d: X[c][0], labo: X[c][1] || '', mol: '', f: 'nr', ppht: +a[0] || 0, net: 0,
                   stock: Math.max(0, +a[1] || 0), mitm: false, n: 0 };
      }
    }
    Object.defineProperty(CAT, '_nrAjout', { value: true });
  }

  function donnees() {
    var CAT = V2.produits.catalogueIndex();
    if (!CAT || D.natEtat < 2) return null;
    ajouterNrHorsCat(CAT);
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
    var TAR = (window.ETAB_PRICES && window.ETAB_PRICES.tarif) || {};
    var ALL = (window.ETAB_PRICES && window.ETAB_PRICES.all) || {};
    var M = window.V2PRODUITS, porte = function (f) { return M ? M.porteAbandon(f) : String(f || '').indexOf('pr_') === 0; };

    var lignes = [], nDetail = 0;
    for (c in CAT) {
      if (!Object.prototype.hasOwnProperty.call(CAT, c)) continue;
      var o = CAT[c], ps = PS[c];
      var fam = (ps && ps.f) || o.f;
      var ppht = +(ps && ps.ppht) || +o.ppht || 0;
      // NR : le tarif de la dernière extraction (15/09) remplace celui de juin. Un écart
      // hors de ×0,2–×5 ressemble à une erreur de saisie (INFRACYANINE 100,43 → 0,30) :
      // dans le doute, on garde l'ancien.
      var tar = +TAR[c] || 0;
      if (fam === 'nr' && tar > 0 && (!(ppht > 0) || (tar / ppht > 0.2 && tar / ppht < 5))) ppht = tar;
      else tar = 0;
      if (fam === 'nr' && !(ppht > 0) && ALL[c]) ppht = +ALL[c][0] || 0;
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
        // Un site absent reste undefined (« non communiqué ») : l'extraction de
        // septembre ne couvre que 5 sites, un 0 inventé y lirait une rupture.
      }
      if (etab) nDetail++;
      var stk = 0;
      if (etab) { for (i in etab) if (Object.prototype.hasOwnProperty.call(etab, i)) stk += etab[i]; }
      lignes.push({
        cip: c, d: lib, labo: o.labo || '', mol: o.mol || '', f: fam,
        ppht: ppht, net: net, tar: tar,
        // Prix affiché : un NR se présente à son tarif (le net réseau n'est qu'un
        // prix moyen facturé) ; le reste, au prix net.
        prix: fam === 'nr' ? (ppht || net) : net,
        ab: (porte(fam) && ppht > 0 && net > 0 && net < ppht) ? ppht - net : null,
        // Le fichier de stock porte des valeurs négatives (-367, -1 149…) :
        // bornées à 0, comme dans l'écran Appro.
        // Détail par site connu : il est plus récent que le consolidé (début septembre).
        stock: etab ? stk : Math.max(0, Object.prototype.hasOwnProperty.call(STK, c) ? (+STK[c] || 0) : (+o.stock || 0)),
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
    var t = C.tri, TD = (t === 'hausse' || t === 'baisse') ? tendances() : null;
    out.sort(function (a, b) {
      if (TD) {
        var ta = TD[a.cip], tb = TD[b.cip];
        if (ta === undefined || tb === undefined) return ((ta === undefined) - (tb === undefined)) || (b.an - a.an);
        return t === 'hausse' ? tb.g - ta.g : ta.g - tb.g;
      }
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
    tri: function (v) {
      C.tri = v || 'potentiel'; C.page = 1;
      if (C.tri === 'hausse' || C.tri === 'baisse') chargerFrance();
      rerender();
    },
    // Boîtes ↔ chiffre d'affaires : on ne redessine que les courbes, le panneau garde sa position.
    unite: function (u) {
      C.unite = u === 'ca' ? 'ca' : 'q';
      var box = document.getElementById('cp-evo'), l = D.cache && C.cip && D.cache.parCip[C.cip];
      if (box && l) box.innerHTML = evoHtml(l);
    },
    survol: function (ev, el) {
      var P = D.pts[el.id], svg = el.querySelector('svg');
      if (!P || !svg) return;
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * P.W / (r.width || P.W), i, best = 0;
      for (i = 1; i < P.x.length; i++) if (Math.abs(P.x[i] - x) < Math.abs(P.x[best] - x)) best = i;
      montrer(el, best);
    },
    touche: function (ev, el) {
      var P = D.pts[el.id];
      if (!P || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
      ev.preventDefault();
      var i = el._i == null ? (ev.key === 'ArrowLeft' ? P.x.length - 1 : 0) : el._i + (ev.key === 'ArrowLeft' ? -1 : 1);
      montrer(el, Math.max(0, Math.min(P.x.length - 1, i)));
    },
    sortie: function (el) {
      var liste = document.querySelectorAll('.cp-ch-w[data-g="' + el.getAttribute('data-g') + '"]'), j, s;
      for (j = 0; j < liste.length; j++) {
        var c = liste[j], hl = c.querySelectorAll('.cp-hl'), ch = c.querySelector('.cp-chl'), tip = c.querySelector('.cp-tip');
        if (ch) ch.style.display = 'none';
        if (tip) tip.style.display = 'none';
        for (s = 0; s < hl.length; s++) hl[s].style.display = 'none';
        c._i = null;
      }
    },
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
  function partHtml(l, partMoy, TD) {
    if (l.part === null || !(partMoy > 0)) return '<span class="cp-part-na">—</span>';
    var sg = (TD && TD[l.cip]) ? signe(TD[l.cip].r) : null;
    var max = partMoy * ECHELLE_PART;
    var rempli = Math.max(0, Math.min(l.part / max, 1)) * 100;
    var repere = 100 / ECHELLE_PART;
    var pct = l.part * 100;
    var txt = l.an <= 0 ? '0 %' : pct < 0.005 ? '< 0,01 %' : fr(pct, 2) + ' %';
    return '<span class="cp-part"><span class="cp-part-t">' +
      '<span class="cp-part-f" style="width:' + rempli.toFixed(1) + '%"></span>' +
      '<span class="cp-part-m" style="left:' + repere.toFixed(1) + '%"></span></span>' +
      '<span class="cp-part-p">' + txt +
        (sg ? '<span class="cp-part-d ' + sg.cls + '" title="Évolution de notre part">' + sg.txt + '</span>' : '') +
      '</span></span>';
  }
  function etabsCellules(l) {
    if (!l.etab) {
      return '<span class="cp-etab-tot" title="Détail par établissement non disponible pour ce produit">' +
        fr(l.stock) + ' en stock · tous sites</span>';
    }
    var h = '', i;
    for (i = 0; i < ETABS.length; i++) {
      var v = l.etab[ETABS[i]];
      h += v === undefined
        ? '<span class="cp-dot-c" title="' + ETABS[i] + ' : non communiqué"><span class="cp-dot u"></span></span>'
        : '<span class="cp-dot-c" title="' + ETABS[i] + ' : ' + fr(v) + '"><span class="cp-dot ' + dotCls(v) + '"></span></span>';
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
  function ligneTable(l, d, AQ, TD) {
    return '<button class="cp-row" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')">' +
      '<span class="cp-nom"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="cp-num"><b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' +
        (l.ab != null ? '<i title="Abandon de marge">−' + eur2(l.ab) + '</i>' : '') + '</span>' +
      '<span class="cp-num"><b>' + numK(l.an) + '</b><i>bt/an</i></span>' +
      '<span class="cp-num cp-rang">' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</span>' +
      partHtml(l, d.partMoy, TD) +
      '<span class="cp-num">' + (l.opp ? '<b>' + eurK(l.pot) + '</b><i>par an</i>' : '<span class="cp-na">—</span>') + '</span>' +
      etabsCellules(l) +
      '<span class="cp-aqui">' + aQuiNb(l, AQ) + '</span>' +
      '</button>';
  }
  function carte(l, d, AQ, TD) {
    return '<button class="cp-card" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')">' +
      '<span class="cp-card-h"><span class="cp-card-n"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="cp-num"><b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' +
        (l.ab != null ? '<i>Abandon ' + eur2(l.ab) + '</i>' : '') + '</span></span>' +
      '<span class="cp-card-v"><b>' + fr(l.an) + '</b> bt/an · France <b>' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</b></span>' +
      '<span class="cp-card-p">' + partHtml(l, d.partMoy, TD) + '</span>' +
      (l.opp ? '<span class="cp-pill">Potentiel <b>' + eurK(l.pot) + '</b> par an</span>' : '') +
      '<span class="cp-card-b"><span class="cp-strip">' + etabsCellules(l) + '</span>' +
        '<span class="cp-aqui">à qui : ' + aQuiNb(l, AQ) + '</span></span>' +
      '</button>';
  }
  function resultatsHtml(d) {
    var L = filtrees(d.lignes), AQ = aQui();
    var TD = (C.tri === 'hausse' || C.tri === 'baisse') ? tendances() : null;
    var vis = L.slice(0, C.page * PAR_PAGE), rows = '', cards = '', i;
    for (i = 0; i < vis.length; i++) { rows += ligneTable(vis[i], d, AQ, TD); cards += carte(vis[i], d, AQ, TD); }
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
  function dateFr(iso) { return String(iso || '').split('-').reverse().join('/'); }
  function libCompte(n) { return fr(n) + ' produit' + (n > 1 ? 's' : ''); }
  function majResultats() {
    var box = document.getElementById('cp-res'), d = donnees();
    if (!box || !d) return;
    box.innerHTML = resultatsHtml(d);
    var src = document.getElementById('cp-count-src'), cnt = document.getElementById('cp-count');
    if (src && cnt) cnt.textContent = libCompte(+src.getAttribute('data-n') || 0);
  }

  // ── Courbes mois par mois ─────────────────────────────────────
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), r = v / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  }
  function fmtPart(p) {
    if (p == null) return '—';
    var x = p * 100;
    return x <= 0 ? '0 %' : x < 0.005 ? '< 0,01 %' : fr(x, 2) + ' %';
  }
  function signe(x) {
    if (x == null || !isFinite(x)) return null;
    if (Math.abs(x) < 0.005) return { cls: '', txt: 'stable' };
    return { cls: x > 0 ? 'up' : 'down', txt: (x > 0 ? '▲ +' : '▼ −') + fr(Math.abs(x) * 100) + ' %' };
  }
  function largeurPan() {
    var vw = window.innerWidth || 390;
    return Math.max(260, (vw >= 1000 ? 460 : Math.min(vw, 640)) - 40);
  }

  // SVG à sa vraie taille en pixels : les textes des axes restent à 13 px.
  // o = { id, g (groupe de survol), W, H, labels, series:[{v, cls, aire}], ref:{v, lib}, fmt, tip, aria }
  function courbe(o) {
    var pl = 58, pr = 22, pt = 14, pb = 28, W = o.W, H = o.H, n = o.labels.length;
    var w = W - pl - pr, h = H - pt - pb, max = 0, i, s, k;
    for (s = 0; s < o.series.length; s++) for (i = 0; i < n; i++) if (o.series[s].v[i] > max) max = o.series[s].v[i];
    if (o.ref && o.ref.v > max) max = o.ref.v;
    max = niceMax(max * 1.08);
    var X = function (j) { return pl + (n > 1 ? j * w / (n - 1) : w / 2); };
    var Y = function (v) { return pt + h - (v / max) * h; };
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    for (k = 0; k <= 2; k++) {
      var gy = Y(max * k / 2).toFixed(1);
      svg += '<line class="cp-g" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text class="cp-ax" x="' + (pl - 8) + '" y="' + (+gy + 4) + '" text-anchor="end">' + o.fmt(max * k / 2) + '</text>';
    }
    var pas = (w / Math.max(1, n - 1)) < 36 ? 2 : 1, xs = [];
    for (i = 0; i < n; i++) {
      xs.push(+X(i).toFixed(1));
      if (i % pas === 0) svg += '<text class="cp-ax" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + o.labels[i] + '</text>';
    }
    if (o.ref && o.ref.v > 0) {
      var ry = Y(o.ref.v).toFixed(1);
      svg += '<line class="cp-ref" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + ry + '" y2="' + ry + '"/>' +
        '<text class="cp-ax cp-ref-t" x="' + (W - pr) + '" y="' + (ry - 6) + '" text-anchor="end">' + o.ref.lib + '</text>';
    }
    var pts = [];
    for (s = 0; s < o.series.length; s++) {
      var S = o.series[s], dl = '', pp = [], dots = '', prem = -1, dern = -1;
      for (i = 0; i < n; i++) {
        var v = S.v[i];
        if (v == null) { pp.push(null); continue; }
        var x = X(i).toFixed(1), y = Y(v).toFixed(1);
        pp.push([+x, +y]);
        dl += (S.v[i - 1] == null ? 'M' : 'L') + x + ' ' + y;
        dots += '<circle class="cp-pt ' + S.cls + '" r="4" cx="' + x + '" cy="' + y + '"/>';
        if (prem < 0) prem = i;
        dern = i;
      }
      if (S.aire && prem >= 0) {
        var ai = 'M' + X(prem).toFixed(1) + ' ' + Y(0).toFixed(1);
        for (i = prem; i <= dern; i++) if (pp[i]) ai += 'L' + pp[i][0] + ' ' + pp[i][1];
        svg += '<path class="cp-aire ' + S.cls + '" d="' + ai + 'L' + X(dern).toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z"/>';
      }
      svg += '<path class="cp-l ' + S.cls + '" d="' + dl + '"/>' + dots;
      pts.push(pp);
    }
    svg += '<line class="cp-chl" x1="0" x2="0" y1="' + pt + '" y2="' + (pt + h) + '" style="display:none"/>';
    for (s = 0; s < o.series.length; s++) svg += '<circle class="cp-hl ' + o.series[s].cls + '" r="5.5" cx="0" cy="0" style="display:none"/>';
    D.pts[o.id] = { p: pts, x: xs, W: W, tip: o.tip };
    return '<div class="cp-ch-w" id="' + o.id + '" data-g="' + o.g + '" tabindex="0" role="img" aria-label="' + escAttr(o.aria) + '"' +
      ' onpointermove="V2.comptoir.survol(event,this)" onpointerleave="V2.comptoir.sortie(this)"' +
      ' onkeydown="V2.comptoir.touche(event,this)" onblur="V2.comptoir.sortie(this)">' +
      svg + '</svg><div class="cp-tip" style="display:none"></div></div>';
  }

  // Le même mois s'allume sur toutes les courbes du groupe ; la bulle suit celle qu'on survole.
  function montrer(el, i) {
    var liste = document.querySelectorAll('.cp-ch-w[data-g="' + el.getAttribute('data-g') + '"]'), j, s;
    for (j = 0; j < liste.length; j++) {
      var c = liste[j], P = D.pts[c.id];
      if (!P) continue;
      var hl = c.querySelectorAll('.cp-hl'), ch = c.querySelector('.cp-chl');
      for (s = 0; s < P.p.length; s++) {
        var q = P.p[s][i];
        if (q) { hl[s].setAttribute('cx', q[0]); hl[s].setAttribute('cy', q[1]); hl[s].style.display = ''; }
        else hl[s].style.display = 'none';
      }
      if (P.x[i] != null) { ch.setAttribute('x1', P.x[i]); ch.setAttribute('x2', P.x[i]); ch.style.display = ''; }
      c._i = i;
    }
    var P0 = D.pts[el.id], tip = el.querySelector('.cp-tip'), svg = el.querySelector('svg');
    if (!P0 || !tip || !svg) return;
    tip.innerHTML = P0.tip(i);
    tip.style.display = '';
    var larg = svg.getBoundingClientRect().width || P0.W, xx = P0.x[i] * larg / P0.W, tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(larg - tw, xx + 14 + tw > larg ? xx - tw - 14 : xx + 14)) + 'px';
  }

  function ligneBulle(cls, val, lib) {
    return '<span class="cp-tr">' + (cls ? '<i class="cp-lk ' + cls + '"></i>' : '') + '<b>' + val + '</b><em>' + lib + '</em></span>';
  }
  function tuile(lib, val, delta, sous) {
    var sg = signe(delta);
    return '<div class="cp-tu"><em>' + lib + '</em><b>' + val + '</b>' +
      (sg ? '<span class="cp-dl ' + sg.cls + '">' + sg.txt + '</span>' : '') + '<small>' + sous + '</small></div>';
  }
  function plage(mois, a, b) { return MOIS_C[mois[a] - 1] + (a === b ? '' : '–' + MOIS_C[mois[b] - 1]); }

  function evoHtml(l) {
    var F = window.FRANCE_MOIS;
    if (!F && D.frEtat < 2) return '<p class="cp-note">Chargement des ventes France mois par mois…</p>';
    var e = evolution(l.cip);
    if (!e) return '<p class="cp-note">Les ventes du réseau ne sont pas encore chargées.</p>';
    D.pts = {};
    var W = largeurPan(), n = e.mois.length, ca = C.unite === 'ca', i, h = '';
    var labels = e.mois.map(function (m) { return MOIS_C[m - 1]; });
    var fmtV = ca ? eurK : numK, uni = ca ? '' : ' bt';

    // Les trois chiffres qui répondent : nos ventes montent-elles, gagnons-nous des parts, le marché bouge-t-il ?
    h += '<div class="cp-tus">' +
      tuile('Nos ventes', fr(e.v2 / (e.k || 1)) + ' <small>bt/mois</small>', e.v1 > 0 ? e.v2 / e.v1 - 1 : null,
        e.k ? plage(e.mois, n - e.k, n - 1) + ' face à ' + plage(e.mois, 0, e.k - 1) : '—') +
      (e.tp
        ? tuile('Notre part', fmtPart(e.tp.fin), e.tp.debut > 0 ? e.tp.fin / e.tp.debut - 1 : null,
            plage(e.mois, e.tp.c, e.tp.d) + ' face à ' + plage(e.mois, e.tp.a, e.tp.b) + ' (' + fmtPart(e.tp.debut) + ')')
        : tuile('Notre part', '—', null, e.aFrance ? 'pas assez de mois comparables' : 'pas de ventes France publiées')) +
      (e.yoy != null
        ? tuile('Marché France', numK(e.y1 / e.yoyMois) + ' <small>bt/mois</small>', e.yoy,
            'janv.–' + MOIS_C[e.yoyDern - 1] + ' ' + ANNEE + ' face à ' + (ANNEE - 1))
        : tuile('Marché France', '—', null, 'non publié pour ce produit')) +
      '</div>';

    h += '<div class="cp-ch"><div class="cp-ch-t"><span>Nos ventes, mois par mois</span>' +
      '<span class="cp-seg" role="group" aria-label="Unité">' +
        '<button class="' + (ca ? '' : 'on') + '" aria-pressed="' + !ca + '" onclick="V2.comptoir.unite(\'q\')">Boîtes</button>' +
        '<button class="' + (ca ? 'on' : '') + '" aria-pressed="' + ca + '" onclick="V2.comptoir.unite(\'ca\')">Chiffre d\'affaires</button></span></div>' +
      courbe({ id: 'cp-c-v', g: 'n', W: W, H: 180, labels: labels, fmt: fmtV,
        series: [{ v: ca ? e.ca : e.q, cls: 'b', aire: true }],
        aria: 'Nos ventes mois par mois, ' + plage(e.mois, 0, n - 1) + ' ' + ANNEE,
        tip: bulleN }) + '</div>';

    if (e.aFrance) {
      var pm = D.cache ? D.cache.partMoy : 0, avecPart = e.part.some(function (x) { return x != null; });
      if (avecPart) {
        // Même nombre de décimales sur tout l'axe (pas « 1,0 % » au-dessus de « 0,50 % »).
        var pMax = Math.max.apply(null, e.part.map(function (x) { return x || 0; }).concat([pm]));
        var decP = niceMax(pMax * 1.08) * 100 < 1.5 ? 2 : 1;
        h += '<div class="cp-ch"><div class="cp-ch-t"><span>Notre part du marché France</span></div>' +
          courbe({ id: 'cp-c-p', g: 'n', W: W, H: 160, labels: labels,
            fmt: function (v) { return v <= 0 ? '0 %' : fr(v * 100, decP) + ' %'; },
            series: [{ v: e.part, cls: 'b' }], ref: { v: pm, lib: 'notre part moyenne ' + fmtPart(pm) },
            aria: 'Notre part du marché France mois par mois', tip: bulleN }) + '</div>';
      }
      h += '<div class="cp-ch"><div class="cp-ch-t"><span>Le marché France</span>' +
        '<span class="cp-ch-lg"><span><i class="cp-lk b"></i>' + ANNEE + '</span><span><i class="cp-lk g"></i>' + (ANNEE - 1) + '</span></span></div>' +
        courbe({ id: 'cp-c-f', g: 'f', W: W, H: 170, labels: MOIS_C, fmt: numK,
          series: [{ v: e.f25, cls: 'g' }, { v: e.f26, cls: 'b' }],
          aria: 'Ventes France mois par mois, ' + ANNEE + ' face à ' + (ANNEE - 1), tip: bulleF }) + '</div>';
    } else {
      h += '<p class="cp-note">Aucune vente France publiée pour ce produit (Medic\'AM ne compte que les boîtes remboursées) : ' +
        'pas de part de marché à tracer.</p>';
    }

    // La même chose en tableau : chaque valeur se lit sans survoler.
    var rows = '';
    for (i = 0; i < n; i++) {
      rows += '<tr><td>' + MOIS_C[e.mois[i] - 1] + '</td><td>' + fr(e.q[i]) + '</td><td>' + eurK(e.ca[i]) + '</td>' +
        '<td>' + (e.fr[i] != null ? fr(e.fr[i]) : '—') + '</td><td>' + fmtPart(e.part[i]) + '</td></tr>';
    }
    h += '<details class="cp-tab"><summary>Voir les chiffres mois par mois</summary><div class="cp-tabw"><table>' +
      '<thead><tr><th>' + ANNEE + '</th><th>Nos boîtes</th><th>Notre CA</th><th>France</th><th>Part</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></details>' +
      '<p class="cp-note">Nos ventes : réseau, mois complets. France : Medic\'AM, boîtes remboursées, publié jusqu\'à ' +
        (F ? esc(MOIS_C[+F.meta.mois[F.meta.mois.length - 1].slice(5) - 1] + ' ' + F.meta.mois[F.meta.mois.length - 1].slice(0, 4)) : '—') +
        '. Part = nos boîtes ÷ boîtes France du même mois.</p>';
    return h;

    function bulleN(j) {
      return '<b>' + MOIS_C[e.mois[j] - 1] + ' ' + ANNEE + '</b>' +
        ligneBulle('b', ca ? eurK(e.ca[j]) : fr(e.q[j]) + uni, 'nos ventes') +
        (e.aFrance
          ? (e.fr[j] != null
            ? ligneBulle('', fr(e.fr[j]) + ' bt', 'France') + ligneBulle('', fmtPart(e.part[j]), 'notre part')
            : ligneBulle('', 'pas encore publié', 'France'))
          : '');
    }
    function bulleF(j) {
      var a = e.f25[j], b = e.f26[j], sg = (a > 0 && b != null) ? signe(b / a - 1) : null;
      return '<b>' + MOIS_C[j] + '</b>' +
        ligneBulle('b', b != null ? fr(b) + ' bt' : 'pas encore publié', String(ANNEE)) +
        ligneBulle('g', a != null ? fr(a) + ' bt' : '—', String(ANNEE - 1)) +
        (sg ? ligneBulle('', sg.txt, 'sur un an') : '');
    }
  }

  function panneauHtml(d) {
    var l = C.cip && d.parCip[C.cip];
    if (!l) return '';
    chargerFrance();
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
        var sv = l.etab[ETABS[i]];
        stock += sv === undefined
          ? '<div class="nd" title="Non communiqué"><em>' + ETABS[i] + '</em><b>—</b></div>'
          : '<div class="' + (sv > 0 ? '' : 'zero') + '"><em>' + ETABS[i] + '</em><b>' + fr(sv) + '</b></div>';
      }
      stock += '</div><p class="cp-note">Stock déclaré par chaque établissement. « — » : non communiqué.</p>';
    } else {
      stock = '<div class="cp-sgrid"><div class="large"><em>Tous sites</em><b>' + fr(l.stock) + '</b></div></div>' +
        '<p class="cp-note">Pas de détail par établissement pour ce produit.</p>';
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
        '<div class="cp-prix"><b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' +
          (l.f === 'nr' && l.prix > 0 ? '<span class="cp-tag">' + (l.tar ? 'Tarif au ' + dateFr(window.ETAB_PRICES.tarifDate) : 'Tarif') + '</span>' : '') +
          (l.ab != null ? '<s>' + eur2(l.ppht) + '</s><span class="cp-tag">Abandon de marge ' + eur2(l.ab) + ' / boîte</span>' : '') +
          (l.rupt ? '<span class="cp-tag cp-tag-r">Rupture ANSM</span>' : '') +
          (l.opp ? '<span class="cp-tag">Opportunité</span>' : '') + '</div>' +
        (l.f === 'nr' && l.net > 0 && Math.abs(l.net - l.prix) >= 0.01 * l.prix
          ? '<p class="cp-note">Prix moyen facturé au réseau : ' + eur2(l.net) + '.</p>' : '') +
        '<p class="cp-st">Ventes</p>' + ventes +
        '<p class="cp-st">Mois par mois</p><div id="cp-evo">' + evoHtml(l) + '</div>' +
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
      // Les courbes sont dessinées à la largeur du panneau : on les refait si l'écran change.
      var tr = null;
      window.addEventListener('resize', function () {
        if (tr) clearTimeout(tr);
        tr = setTimeout(function () { if (C.cip) V2.comptoir.unite(C.unite); }, 200);
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
    var tris = [['potentiel', 'potentiel'], ['rang', 'rang France'], ['ventes', 'nos ventes'], ['hausse', 'notre part en hausse'], ['baisse', 'notre part en baisse'], ['az', 'A → Z']], selTri = '';
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
        'Stock par établissement connu pour ' + fr(d.nDetail) + ' références ; ailleurs, stock total des 7 sites.' +
        (window.ETAB_PRICES && window.ETAB_PRICES.tarifDate
          ? ' Produits non remboursables : tarif et stock au ' + esc(dateFr(window.ETAB_PRICES.tarifDate)) +
            autresDates() + ', y compris ceux que le catalogue de juin ne connaissait pas.' : '') + '</p>' +
      '</div>';
  };

  // Sites dont le stock n'est pas à la date du tarif : « (SEP : 17/09/2026 ; POS : juillet) ».
  function autresDates() {
    var EPx = window.ETAB_PRICES, SD = EPx.siteDates || {}, parts = [];
    ETABS.forEach(function (e) {
      if (SD[e] !== EPx.tarifDate) parts.push(e + ' : ' + (SD[e] ? esc(dateFr(SD[e])) : 'juillet'));
    });
    return parts.length ? ' (' + parts.join(' ; ') + ')' : '';
  }

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
      '.cp-dot.u{background:transparent;border:1.5px dashed var(--cp-ink3)}',
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
      '.cp-sgrid div.nd b{color:var(--cp-ink3)}',
      '.cp-sgrid b{font:800 14px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-note{margin:0 0 6px;font:400 13px/1.5 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-off{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}',
      '.cp-off-m{flex:1;min-width:0}',
      '.cp-off-m b{display:block;font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-off-m span{display:block;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-off-b{flex:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--ip-blue);background:var(--card);color:var(--ip-blue);font:700 13.5px/1 Inter,sans-serif;cursor:pointer}',
      '.cp-cta{display:block;width:100%;min-height:50px;margin:16px 0 4px}',
      '@media (max-width:430px){.cp-vgrid{grid-template-columns:1fr 1fr}.cp-vgrid div:last-child{grid-column:span 2}}',
      // Mois par mois : trois chiffres, puis les courbes (une seule échelle chacune).
      '.cp-part-p{display:flex;flex-direction:column;gap:3px}',
      '.cp-part-d{font:750 13px/1 Inter,sans-serif;color:var(--cp-ink3)}.cp-part-d.up,.cp-dl.up{color:var(--cp-green)}.cp-part-d.down,.cp-dl.down{color:var(--cp-amber)}',
      '.cp-tus{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px}',
      '.cp-tu{display:flex;flex-direction:column;gap:3px;min-width:0;padding:10px 9px;border-radius:12px;border:1px solid var(--line);background:radial-gradient(180px 80px at 0 0,rgba(0,80,230,.08),transparent 70%),var(--card)}',
      '.cp-tu em{font:650 13px/1.25 Inter,sans-serif;font-style:normal;color:var(--cp-ink3)}',
      '.cp-tu b{font:800 16px/1.2 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-tu b small{font:650 13px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-tu>small{font:400 13px/1.3 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-dl{font:750 13px/1.2 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-ch{margin:0;padding:12px 0 6px;border-top:1px solid var(--line)}',
      '.cp-tus+.cp-ch{border-top:0}',
      '.cp-ch-t{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 6px;font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-ch-lg{display:inline-flex;gap:12px;font:400 13px/1 Inter,sans-serif;color:var(--cp-ink3)}.cp-ch-lg span{display:inline-flex;align-items:center;gap:5px}',
      '.cp-seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--cp-alt);border:1px solid var(--line)}',
      '.cp-seg button{min-height:38px;padding:0 12px;border:0;border-radius:999px;background:transparent;font:650 13px/1 Inter,sans-serif;color:var(--cp-ink3);cursor:pointer}',
      '.cp-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:0 1px 2px rgba(16,19,28,.14)}',
      '.cp-ch-w{position:relative;outline:none;touch-action:pan-y}',
      '.cp-ch-w:focus-visible{box-shadow:0 0 0 2px var(--ip-blue);border-radius:8px}',
      '.cp-ch-w svg{display:block;max-width:100%;height:auto;overflow:visible}',
      '.cp-g{stroke:rgba(16,19,28,.09);stroke-width:1}',
      '.cp-ax{font:400 13px Inter,sans-serif;fill:var(--cp-ink3);font-variant-numeric:tabular-nums}',
      '.cp-ref{stroke:var(--ip-ink);stroke-width:1;opacity:.5}',
      '.cp-ref-t{fill:var(--ip-ink);paint-order:stroke;stroke:var(--card);stroke-width:4px;stroke-linejoin:round}',
      '.cp-l{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}',
      '.cp-l.b{stroke:var(--ip-blue)}.cp-l.g{stroke:' + GRIS + '}',
      '.cp-aire.b{fill:var(--ip-blue);opacity:.1}',
      '.cp-pt,.cp-hl{stroke:var(--card);stroke-width:2}.cp-pt.b,.cp-hl.b{fill:var(--ip-blue)}.cp-pt.g,.cp-hl.g{fill:' + GRIS + '}',
      '.cp-chl{stroke:var(--ip-ink);stroke-width:1;opacity:.35}',
      '.cp-tip{position:absolute;top:0;z-index:2;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--line);box-shadow:0 10px 26px -12px rgba(16,19,28,.4);pointer-events:none}',
      '.cp-tip>b{display:block;margin-bottom:3px;font:700 13px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-tr{display:flex;align-items:center;gap:6px;font:400 13px/1.55 Inter,sans-serif;color:var(--cp-ink3);white-space:nowrap}',
      '.cp-tr b{color:var(--ip-ink);font-weight:750;font-variant-numeric:tabular-nums}.cp-tr em{font-style:normal}',
      '.cp-lk{display:inline-block;flex:none;width:12px;height:2px;border-radius:2px}.cp-lk.b{background:var(--ip-blue)}.cp-lk.g{background:' + GRIS + '}',
      '.cp-tab{margin:4px 0 2px;border-top:1px solid var(--line)}',
      '.cp-tab summary{min-height:44px;display:flex;align-items:center;font:700 13.5px/1 Inter,sans-serif;color:var(--ip-blue);cursor:pointer}',
      '.cp-tabw{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '.cp-tab table{width:100%;border-collapse:collapse;font:400 13px/1.3 Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.cp-tab th,.cp-tab td{padding:6px 4px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}',
      '.cp-tab th{font-weight:700;color:var(--cp-ink3)}.cp-tab td{color:var(--ip-ink)}',
      '.cp-tab th:first-child,.cp-tab td:first-child{text-align:left}',
      '@media (max-width:430px){.cp-tus{grid-template-columns:1fr 1fr}.cp-tus .cp-tu:last-child{grid-column:span 2}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
