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
  var ANNEE = 2026;        // repli seulement : l'année de référence est celle du dernier mois des ventes (anneeRef)
  // 14/10/2026 — année 2027 : les mois des ventes sont un compteur (1..12 = 2026, 13 = janv. 2027, voir V2.moisCompact).
  function moisCal(c) { return V2.moisDeMois ? V2.moisDeMois(c) : c; }
  function anneeDe(c) { return V2.anneeDeMois ? V2.anneeDeMois(c) : ANNEE; }
  function anneeRef() { var m = D.cache && D.cache.mois; return m && m.length ? anneeDe(m[m.length - 1]) : ANNEE; }
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var GRIS = '#6B7385';    // l'année précédente, en retrait (4,7:1 sur blanc)

  var C = { q: '', fam: 'all', opp: true, stock: false, top: 200, tri: 'potentiel',
            page: 1, cip: null, offTout: false, unite: 'q', panier: false,
            mol: false, dcTout: false, pend: null };   // 21/10/2026 : « Déjà commandé » (toute la molécule ? tout voir ?) et molécule à résoudre au prochain rendu
  var PANIER_MAX = 200;    // au-delà, une fiche n'est plus lisible : « Tout ajouter » s'arrête là et le dit
  var D = { nat: null, natEtat: 0, etabEtat: 0, catEtat: 0,
            cache: null, sig: '', aqui: null, aquiIdx: null, aquiEtat: 0, noms: null,
            frEtat: 0, mensuel: null, mensuelRef: null, mensuelN: 0, frPos: null, frPosRef: null,
            tend: null, tendSig: '', pts: {}, cmd: null, molCips: null, molCipsRef: null };

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
  // ── Panier : la sélection de v2-produits.js (même mémoire, même document, même fiche) ──
  function sel() { var S = V2.produits.S; if (!S.sel) S.sel = {}; return S.sel; }
  function selN() { return Object.keys(sel()).length; }
  function majPanier() {
    if (V2.produits.selSauver) V2.produits.selSauver();
    if (C.panier && !selN()) C.panier = false;
    majResultats();
    var b = document.getElementById('cp-bar-hote'); if (b) b.innerHTML = barreHtml();
    var p = document.getElementById('cp-pan-add'); if (p && C.cip) p.outerHTML = boutonPanneau(C.cip);
  }
  function boutonAdd(cip) {
    var pris = !!sel()[cip];
    return '<button class="cp-add' + (pris ? ' on' : '') + '" aria-pressed="' + pris + '" aria-label="' + (pris ? 'Retirer du panier' : 'Ajouter au panier') +
      '" title="' + (pris ? 'Retirer du panier' : 'Ajouter au panier') + '" onclick="V2.comptoir.panier(\'' + escAttr(cip) + '\',event)">' + (pris ? '✓' : '+') + '</button>';
  }
  function boutonPanneau(cip) {
    var pris = !!sel()[cip];
    return '<button id="cp-pan-add" class="v2-btn cp-cta cp-cta2" onclick="V2.comptoir.panier(\'' + escAttr(cip) + '\',event)">' +
      (pris ? '✓ Au panier — retirer' : 'Ajouter au panier') + '</button>';
  }
  function outilsPanierHtml(n) {
    var np = selN();
    return '<button class="cp-chip cp-chip-add" ' + (n ? '' : 'disabled ') + 'onclick="V2.comptoir.panierTout()">+ Tout ajouter au panier (' + fr(Math.min(n, PANIER_MAX)) + ')</button>' +
      (np ? '<button class="cp-chip' + (C.panier ? ' on' : '') + '" onclick="V2.comptoir.panierVoir()">Au panier (' + fr(np) + ')</button>' : '');
  }
  function barreHtml() {
    var n = selN();
    if (!n) return '';
    return '<div class="cp-bar" role="region" aria-label="Panier"><span class="cp-bar-n"><b>' + fr(n) + '</b> produit' + (n > 1 ? 's' : '') + ' au panier</span>' +
      '<button class="cp-bar-l" onclick="V2.comptoir.panierVoir()">' + (C.panier ? 'Tout le catalogue' : 'Voir') + '</button>' +
      '<button class="cp-bar-l" onclick="V2.comptoir.panierVider()">Vider</button>' +
      '<button class="v2-btn v2-btn-primary cp-bar-go" onclick="V2.comptoir.panierFiche()">Créer la fiche</button></div>';
  }

  function rerender() { if (V2.route && V2.route.name === 'produits' && V2.render) V2.render(); }

  // ── Chargements à la demande ──────────────────────────────────
  function charger() {
    if (!V2.produits.catalogueIndex() && !D.catEtat && V2.loadFiles) {
      D.catEtat = 1;
      V2.loadFiles(['catcomplet']).then(function () { D.catEtat = 2; rerender(); });
    }
    chargerNat();
    if (!window.ETAB_PRICES && !D.etabEtat) {
      D.etabEtat = 1;
      var s = document.createElement('script');
      s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260922o');
      s.async = true;
      s.onload = s.onerror = function () { D.etabEtat = 2; rerender(); };
      document.head.appendChild(s);
    }
  }

  // Même adresse que l'écran Appro : un seul téléchargement par jour. Partagé avec la recherche ⌘K
  // (22/10/2026) : une seule demande, quel que soit celui qui la fait en premier.
  function chargerNat() {
    if (D.natP) return D.natP;
    D.natEtat = 1;
    var jour = new Date().toISOString().slice(0, 10);
    D.natP = fetch('national.json?d=' + jour, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { D.nat = j || { data: {} }; D.natEtat = 2; rerender(); }, function () { D.nat = { data: {} }; D.natEtat = 3; rerender(); });
    return D.natP;
  }

  // ── 22/10/2026 — molécule manquante : la DCI de la base nationale ──
  // 4 769 produits du catalogue n'ont pas de molécule (ELIQUIS 5MG compris : « apixaban » ne le trouvait pas).
  // national.json en donne une pour 875 d'entre eux, mais UNE seule substance, même pour une association
  // (TRAMADOL/PARACÉTAMOL → « PARACÉTAMOL »), et dans un autre vocabulaire (« MÉSILATE DE DOXAZOSINE »).
  // On regarde donc les produits du catalogue qui ont DÉJÀ une molécule et la même DCI nationale :
  //   aucun → la DCI nationale devient la molécule ; tous la même → celle du catalogue (même rubrique) ;
  //   plusieurs → association probable : la DCI sert à la RECHERCHE, jamais au regroupement par molécule
  //   (sinon les clientes du tramadol/paracétamol gonfleraient celles du paracétamol).
  // Rend { cip: { dci, mol } } pour les seuls produits sans molécule ; mol vaut '' quand c'est ambigu.
  function repliMolecules(CAT, N) {
    var vues = {}, out = {}, c, n, k, m;
    for (c in CAT) {
      if (!Object.prototype.hasOwnProperty.call(CAT, c) || !CAT[c].mol || !(n = N[c]) || !n.d) continue;
      k = sansAccent(n.d).trim(); m = vues[k] || (vues[k] = {});
      if (!m[sansAccent(CAT[c].mol).trim()]) m[sansAccent(CAT[c].mol).trim()] = CAT[c].mol;
    }
    for (c in CAT) {
      if (!Object.prototype.hasOwnProperty.call(CAT, c) || CAT[c].mol || !(n = N[c]) || !n.d) continue;
      m = vues[sansAccent(n.d).trim()];
      k = m ? Object.keys(m) : [];
      out[c] = { dci: n.d, mol: k.length === 0 ? n.d : k.length === 1 ? m[k[0]] : '' };
    }
    return out;
  }
  // Calculé une fois par catalogue et par fichier national ; null tant que l'un des deux manque.
  function repli() {
    var CAT = V2.produits && V2.produits.catalogueIndex && V2.produits.catalogueIndex();
    if (!CAT || D.natEtat < 2) return null;
    // CAT._nrAjout : le Comptoir ajoute ensuite au même objet les NR hors catalogue (ajouterNrHorsCat).
    if (!D.repli || D.repliCat !== CAT || D.repliNat !== D.nat || D.repliNr !== !!CAT._nrAjout) {
      D.repli = repliMolecules(CAT, (D.nat && D.nat.data) || {}); D.repliCat = CAT; D.repliNat = D.nat; D.repliNr = !!CAT._nrAjout;
    }
    return D.repli;
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
    for (i = 0; i < VM.mois.length; i++) out.push(F.meta.mois.indexOf(anneeDe(VM.mois[i]) + '-' + pad2(moisCal(VM.mois[i]))));
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
    var f25 = [], f26 = [], y0 = 0, y1 = 0, nb = 0, dern = 0, ANNEE = anneeRef();
    if (fm) {
      for (i = 1; i <= 12; i++) {
        var a = F.meta.mois.indexOf((ANNEE - 1) + '-' + pad2(i)), b = F.meta.mois.indexOf(ANNEE + '-' + pad2(i));
        f25.push(a >= 0 ? fm[a] : null); f26.push(b >= 0 ? fm[b] : null);
        if (a >= 0 && b >= 0) { y0 += fm[a]; y1 += fm[b]; nb++; dern = i; }
      }
    }
    var k = Math.min(3, Math.floor(n / 2)), v1 = 0, v2 = 0;
    for (i = 0; i < k; i++) { v1 += q[i]; v2 += q[n - 1 - i]; }
    return { mois: VM.mois, q: q, ca: ca, fr: frm, part: part, f25: f25, f26: f26, an: ANNEE, aFrance: !!fm,
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
      for (i = 0; i < S.length; i++) if (S[i][1] >= 1) vus[S[i][1]] = 1;
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
    var RM = repli() || {};   // 22/10/2026 : molécule manquante → DCI nationale

    var lignes = [], nDetail = 0;
    for (c in CAT) {
      if (!Object.prototype.hasOwnProperty.call(CAT, c)) continue;
      var o = CAT[c], ps = PS[c], rm = RM[c];
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
        cip: c, d: lib, labo: o.labo || '', mol: o.mol || (rm && rm.mol) || '', f: fam,
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
        hay: sansAccent(lib + ' ' + c + ' ' + (o.labo || '') + ' ' + (o.mol || '') + (rm ? ' ' + rm.dci : ''))
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
          if (V2.voitVentesDe && !V2.voitVentesDe(id)) continue;   // 24/09/2026 — confidentialité : ses officines seulement
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
      // « Au panier » montre TOUT le panier : les autres filtres ne doivent pas en cacher une partie.
      if (C.panier) { if (sel()[l.cip]) out.push(l); continue; }
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

  // ── 21/10/2026 — « Déjà commandé par » : qui a déjà commandé ce produit (ou cette molécule) ──
  // Fonctions pures (testées sans écran). Une ligne de ventes : [officine, mois, commercial, cip, boîtes, pu, CA].
  // 🔴 Confidentialité (direction) : les officines fictives « 0 » / « 0E » (reste du réseau) ne se comptent jamais,
  // et un commercial restreint ne voit que SES officines (V2.voitVentesDe) — on reçoit ces deux règles en paramètres,
  // on n'en réécrit aucune. Boîtes ≤ 0 ignorées.
  function indexCommandes(sales, voit, estReste) {
    var par = {}, vu = {}, debut = 0, fin = 0, i;
    for (i = 0; i < (sales ? sales.length : 0); i++) {
      var r = sales[i], q = r[4];
      if (!(q > 0)) continue;
      var id = String(r[0]);
      if (estReste && estReste(id)) continue;
      var ok = vu[id];
      if (ok === undefined) ok = vu[id] = !voit || !!voit(id);
      if (!ok) continue;
      var m = r[1], c = String(r[3]);
      if (!debut || m < debut) debut = m;
      if (m > fin) fin = m;
      var o = par[c] || (par[c] = {}), e = o[id];
      if (!e) o[id] = [q, m]; else { e[0] += q; if (m > e[1]) e[1] = m; }
    }
    return { par: par, debut: debut, fin: fin };
  }
  // cips = { cip: 1, … } ; rend [{ id, q, dern }] par boîtes décroissantes (à égalité : dernière commande la plus récente).
  function listerCommandes(IX, cips) {
    var tot = {}, c, id, out = [];
    for (c in cips) {
      if (!Object.prototype.hasOwnProperty.call(cips, c) || !IX.par[c]) continue;
      for (id in IX.par[c]) {
        if (!Object.prototype.hasOwnProperty.call(IX.par[c], id)) continue;
        var e = IX.par[c][id], t = tot[id];
        if (!t) tot[id] = { id: id, q: e[0], dern: e[1] }; else { t.q += e[0]; if (e[1] > t.dern) t.dern = e[1]; }
      }
    }
    for (id in tot) if (Object.prototype.hasOwnProperty.call(tot, id)) out.push(tot[id]);
    out.sort(function (a, b) { return (b.q - a.q) || (b.dern - a.dern) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return out;
  }
  // Calculé une seule fois par jeu de ventes (et par utilisateur : le périmètre en dépend), comme D.mensuel.
  function commandes() {
    var S = window.WML_SALES;
    if (!S || !S.length) return null;
    if (D.cmd && D.cmd.ref === S && D.cmd.n === S.length && D.cmd.user === V2.user) return D.cmd.ix;
    var ix = indexCommandes(S, V2.voitVentesDe ? function (id) { return V2.voitVentesDe(id); } : null, V2.estReste ? function (id) { return V2.estReste(id); } : null);
    D.cmd = { ref: S, n: S.length, user: V2.user, ix: ix };
    return ix;
  }
  // Molécule (normalisée) → tous les CIP du catalogue qui la portent.
  function molCips(d) {
    if (D.molCips && D.molCipsRef === d) return D.molCips;
    var m = {}, i, L = d.lignes;
    for (i = 0; i < L.length; i++) {
      var k = sansAccent(L[i].mol).trim();
      if (k) (m[k] || (m[k] = [])).push(L[i].cip);
    }
    D.molCips = m; D.molCipsRef = d;
    return m;
  }
  // Le produit le plus vendu (nos boîtes par an) d'une molécule.
  function topDeMolecule(d, mol) {
    var g = molCips(d)[sansAccent(mol).trim()] || [], best = null, i;
    for (i = 0; i < g.length; i++) {
      var l = d.parCip[g[i]];
      if (l && (!best || l.an > best.an)) best = l;
    }
    return best ? best.cip : null;
  }
  function moisLib(m) { return MOIS_C[moisCal(m) - 1] + ' ' + anneeDe(m); }

  // ═══════════════════════════════════════════════════════════════
  // SOCLE DE CALCUL du panneau produit (22/10/2026) — spec : SPEC-DONNEES.md
  // Les designers n'ont rien à recalculer : ils affichent V2.comptoir.stats(l, d).
  // Tout ce qui est « calcul » est pur (aucun accès à l'écran ni au réseau) et testé : V2.comptoir._calc.
  // ═══════════════════════════════════════════════════════════════
  var MG_TAUX = 0.0693, MG_PLAF = 32.50, SEUIL_HAUT = 468.97;     // marge grossiste réglementée : 6,93 %, plafond 32,50 €
  var PLANCHER_MG = { 2026: 0.30, 2027: 0.22 };                    // plancher par boîte (arrêté du 3/8/2026 : 0,22 € dès le 20/01/2027)
  var FORFAIT_FROID = { 2026: 0.63, 2027: 0.80 };                  // forfait chaîne du froid, jamais partagé avec l'officine
  // Marge officine réglementée (annexe I-2, lissée) : [borne basse, borne haute, taux] sur le prix fabricant HT.
  var TRANCHES_OFFICINE = [[0, 1.91, 0.10], [1.91, 22.90, 0.07], [22.90, 150, 0.055], [150, 1930, 0.05]];
  var FAM_PRINCEPS = { pr_low: 1, pr_mid: 1, pr_high: 1 };         // comme margeNettePrinceps : princeps remboursables seuls
  var JOURS_ALERTE_PRIX = 180, ECART_CATALOGUE = 0.02, JOURS_RAPPEL = 365;
  var FICHIERS = {
    prixFuturs: 'prix-futurs.json', prixArchive: 'prix-futurs-archive.json', generiques: 'generiques-bdpm.json',
    ema: 'ema-generiques.json', regional: 'marche-regional.json', previsions: 'previsions.json',
    ansm: 'ansm-dispo.json', rappels: 'rappels-lots.json', has: 'has-avis.json'
  };

  function anBareme(an) { return an >= 2027 ? 2027 : 2026; }
  // Prix fabricant HT depuis le prix grossiste HT du catalogue : le barème grossiste, à l'envers.
  // La bascule se calcule (plancher / taux), jamais avec l'arrondi 4,33.
  function pfhtDepuisPpht(ppht, froid) {
    var p = +ppht, pl = PLANCHER_MG[2026], base, r;
    if (!(p > 0)) return null;
    base = p - (froid ? FORFAIT_FROID[2026] : 0);
    if (!(base > 0)) return null;
    if (base <= pl + pl / MG_TAUX) r = base - pl;
    else if (base <= SEUIL_HAUT * (1 + MG_TAUX)) r = base / (1 + MG_TAUX);
    else r = base - MG_TAUX * SEUIL_HAUT;
    return r > 0 ? r : null;
  }
  // Marge grossiste réglementée par boîte : borne entre le plancher et 32,50 €, + forfait froid si chaîne du froid.
  function margeGrossiste(pfht, an, froid) {
    var a = anBareme(an), m;
    if (!(pfht > 0)) return null;
    m = Math.min(Math.max(PLANCHER_MG[a], MG_TAUX * Math.min(pfht, SEUIL_HAUT)), MG_PLAF);
    return froid ? m + FORFAIT_FROID[a] : m;
  }
  // Marge officine réglementée (hors honoraires de dispensation), inchangée en 2027.
  function margeOfficine(pfht) {
    var s = 0, i, t, x = +pfht;
    if (!(x > 0)) return null;
    for (i = 0; i < TRANCHES_OFFICINE.length; i++) {
      t = TRANCHES_OFFICINE[i];
      if (x > t[0]) s += (Math.min(x, t[1]) - t[0]) * t[2];
    }
    return s;
  }
  // L'abandon de marge suit la marge grossiste (hors forfait froid) : même taux, nouveau plancher.
  function abandon2027(ab26, pfht) {
    var a = margeGrossiste(pfht, 2026, false), b = margeGrossiste(pfht, 2027, false);
    if (ab26 == null || !(a > 0) || !(b > 0)) return null;
    return ab26 * b / a;
  }
  // Gain de l'officine sur une boîte achetée chez nous = marge réglementée + abandon de marge.
  // Princeps remboursables seulement ; ailleurs applicable:false (jamais 0 €).
  function margePharmacien(fam, pfht, ab26) {
    var reg, a27, t26, t27;
    if (!FAM_PRINCEPS[fam] || !(pfht > 0)) return { applicable: false };
    reg = margeOfficine(pfht);
    a27 = abandon2027(ab26, pfht);
    t26 = reg + (ab26 || 0);
    t27 = reg + (a27 || 0);
    return { applicable: true, reglementee: reg, abandon26: ab26 == null ? null : ab26, abandon27: a27,
             total26: t26, total27: t27, delta: t27 - t26, sansAbandon: ab26 == null };
  }

  function jourIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function ajouterJours(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }

  // Alertes de prix public (JO / CEPS) d'un CIP : baisses et hausses (jamais « stable »), passées depuis moins
  // de 180 jours ou à venir. futurs / archive = contenu des deux fichiers (ou null). pfhtCat = prix fabricant HT reconstruit.
  function alertesPrix(cip, futurs, archive, now, pfhtCat) {
    var src = [], vus = {}, ev = [], i, e, k, lim = jourIso(ajouterJours(now, -JOURS_ALERTE_PRIX)), auj = jourIso(now);
    if (futurs && futurs.changes) src = src.concat(futurs.changes);
    if (archive && archive.evenements) src = src.concat(archive.evenements);
    for (i = 0; i < src.length; i++) {
      e = src[i];
      if (!e || String(e.c) !== String(cip) || (e.sens !== 'baisse' && e.sens !== 'hausse') || !e.date_effet) continue;
      if (e.date_effet < lim) continue;
      k = e.sens + '|' + e.date_effet;
      if (vus[k]) continue;
      vus[k] = 1;
      ev.push({ sens: e.sens, ancienTtc: e.ancien_ttc == null ? null : +e.ancien_ttc, nouveauTtc: e.ppttc == null ? null : +e.ppttc,
                pfht: e.pfht == null ? null : +e.pfht, dateEffet: e.date_effet, aVenir: e.date_effet > auj });
    }
    ev.sort(function (a, b) { return a.dateEffet < b.dateEffet ? 1 : a.dateEffet > b.dateEffet ? -1 : 0; });
    // Le catalogue ne suit pas toujours : une baisse déjà en vigueur dont le prix fabricant est inférieur de plus de 2 %
    // à celui du catalogue n'est pas encore dans le prix affiché. Un catalogue déjà au niveau du nouveau prix, ou
    // dessous (BOSUTINIB ZEN, VARENICLINE TVC, 22/10/2026), n'est pas en retard.
    var retard = false, ecart = null;
    for (i = 0; i < ev.length; i++) {
      if (!ev[i].aVenir) {
        if (ev[i].sens === 'baisse' && ev[i].pfht > 0 && pfhtCat > 0) {
          ecart = ev[i].pfht / pfhtCat - 1;
          retard = ecart < -ECART_CATALOGUE;
        }
        break;   // seule la plus récente des alertes en vigueur compte
      }
    }
    return { evenements: ev, catalogueEnRetard: retard, ecartPfht: ecart };
  }

  // Statut générique : « nouveau » (+ date) si le CIP est dans un groupe apparu au dernier passage, « commercialise »
  // si un générique est commercialisé pour ce princeps, « repertoire » si seul le groupe est inscrit (national g = 1).
  function statutGenerique(cip, gen, natEntree) {
    var out = { statut: 'aucun', depuis: null }, i, g, c = String(cip);
    if (!gen && !natEntree) return null;
    if (gen) {
      for (i = 0; i < (gen.newGeneric || []).length; i++) {
        g = gen.newGeneric[i];
        if ((g.cips || []).indexOf(c) >= 0) { out.statut = 'nouveau'; out.depuis = g.since || null; return out; }
      }
      if ((gen.princepsWithGeneric || []).indexOf(c) >= 0) { out.statut = 'commercialise'; return out; }
    }
    if (natEntree && +natEntree.g === 1) out.statut = 'repertoire';
    return out;
  }
  // Génériques / biosimilaires en approche (EMA) : entrées dont la DCI est la molécule du produit.
  function emaPourMolecule(ema, mol) {
    var m = sansAccent(mol).trim(), jetons, out = [], i, e, k;
    if (!ema || !ema.items) return null;
    if (!m) return [];
    jetons = m.split(/[\/+,]/).map(function (x) { return x.trim(); }).filter(Boolean);
    for (i = 0; i < ema.items.length; i++) {
      e = ema.items[i]; k = sansAccent(e.inn).trim();
      if (k && (k === m || jetons.indexOf(k) >= 0)) out.push({ nom: e.name || '', type: e.type || '', statut: e.status || '', date: e.opinion || e.amm || null });
    }
    return out;
  }

  // Rupture / tension ANSM d'un CIP : la plus grave d'abord.
  function ansmPourCip(ansm, cip) {
    var best = null, rang = -1, i, it, r, c = String(cip);
    if (!ansm || !ansm.items) return null;
    for (i = 0; i < ansm.items.length; i++) {
      it = ansm.items[i];
      if ((it.cips || []).indexOf(c) < 0) continue;
      r = /Rupture/.test(it.st) ? 3 : /Tension/.test(it.st) ? 2 : 1;
      if (r > rang) { rang = r; best = it; }
    }
    return best ? { statut: String(best.st || ''), retour: best.retour && (best.retour.iso || best.retour.raw) || null,
                    retourTexte: best.retour && best.retour.raw || null, depuis: best.since || null, maj: best.maj || null } : null;
  }
  // Rappel de lot de moins de 12 mois (le plus récent).
  function rappelPourCip(rap, cip, now) {
    var lim = jourIso(ajouterJours(now, -JOURS_RAPPEL)), best = null, i, it, c = String(cip);
    if (!rap || !rap.items) return null;
    for (i = 0; i < rap.items.length; i++) {
      it = rap.items[i];
      if ((it.cips || []).indexOf(c) < 0 || !it.d || it.d < lim) continue;
      if (!best || it.d > best.d) best = it;
    }
    return best ? { date: best.d, titre: best.t || '', motif: best.motif || '', nbLots: (best.lots || []).length } : null;
  }
  // Dernier avis HAS (SMR / ASMR) d'un CIP.
  function hasPourCip(has, cip) {
    var best = null, i, it, c = String(cip);
    if (!has || !has.items) return null;
    for (i = 0; i < has.items.length; i++) {
      it = has.items[i];
      if ((it.cips || []).indexOf(c) < 0) continue;
      if (!best || String(it.date || '') > String(best.date || '')) best = it;
    }
    return best ? { smr: best.smr || '', asmr: best.asmr || '', date: best.date || null, motif: best.motif || '' } : null;
  }

  // Prévisions (previsions.json) : [m3,b3,h3, m6,b6,h6, m12,b12,h12, bascule, fiable] ; 100 = rythme des 3 derniers mois.
  function previsionsPourCip(prev, cip) {
    var v = prev && prev.data && prev.data[String(cip)];
    if (!v) return null;
    return { m3: v[0], b3: v[1], h3: v[2], m6: v[3], b6: v[4], h6: v[5], m12: v[6], b12: v[7], h12: v[8],
             bascule: v[9], fiable: +v[10] === 1, dernierMois: prev.dernier_mois_reel || null };
  }
  // Mois le plus fort / le plus faible depuis les 12 indices saisonniers (national.json, champ s).
  function saisonDe(s) {
    var i, hi = 0, lo = 0;
    if (!s || s.length !== 12) return null;
    for (i = 1; i < 12; i++) { if (s[i] > s[hi]) hi = i; if (s[i] < s[lo]) lo = i; }
    return { moisFort: hi + 1, moisFaible: lo + 1, indices: s.slice() };
  }

  // Nos ventes d'un CIP sur les mois donnés : boîtes, CA HT, clientes (hors « reste du réseau »),
  // et, si on le demande, le détail par commercial (trié par CA). Ligne : [officine, mois, commercial, cip, boîtes, pu, CA].
  function ventesProduit(S, cip, mois, estReste, avecComm, voit) {
    var garde = {}, i, r, q, id, nom, c, ids = {}, res = { boites: 0, ca: 0, clientes: 0, comm: null }, cm = avecComm ? {} : null, k;
    for (i = 0; i < mois.length; i++) garde[mois[i]] = 1;
    for (i = 0; i < S.length; i++) {
      r = S[i];
      if (r[3] !== cip && String(r[3]) !== cip) continue;
      q = r[4];
      if (!(q > 0) || !garde[r[1]]) continue;
      res.boites += q; res.ca += +r[6] || 0;
      id = String(r[0]);
      // Les clientes comptées sont celles que l'utilisateur a le droit de voir (agrégats boîtes et CA : tout le réseau).
      if (!(estReste && estReste(id)) && (!voit || voit(id))) ids[id] = 1;
      if (cm) {
        nom = r[2];
        if (!nom) continue;
        c = cm[nom] || (cm[nom] = { nom: nom, boites: 0, ca: 0, ids: {} });
        c.boites += q; c.ca += +r[6] || 0;
        if (!(estReste && estReste(id)) && (!voit || voit(id))) c.ids[id] = 1;
      }
    }
    res.clientes = Object.keys(ids).length;
    if (cm) {
      res.comm = [];
      for (k in cm) if (Object.prototype.hasOwnProperty.call(cm, k)) res.comm.push({ nom: cm[k].nom, boites: cm[k].boites, ca: cm[k].ca, clientes: Object.keys(cm[k].ids).length });
      res.comm.sort(function (a, b) { return (b.ca - a.ca) || (b.boites - a.boites); });
    }
    return res;
  }

  // ── Chargement à la demande, une seule fois par fichier ──
  // Un fichier absent ou en erreur donne simplement « donnée indisponible » (état 3) : jamais d'exception.
  function planRerender() {
    if (D.rr) return;
    D.rr = setTimeout(function () { D.rr = null; if (C.cip) rerender(); }, 60);
  }
  function demander(cle) {
    var e = D.fich && D.fich[cle], jour, p;
    if (!D.fich) { D.fich = {}; D.fichP = []; }
    if (D.fich[cle]) return D.fich[cle];
    e = D.fich[cle] = { etat: 1, data: null };
    if (typeof fetch !== 'function') { e.etat = 3; return e; }
    try {
      jour = new Date().toISOString().slice(0, 10);
      p = fetch(FICHIERS[cle] + '?v=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { e.data = j || null; e.etat = j ? 2 : 3; }, function () { e.etat = 3; })
        .then(function () { try { planRerender(); } catch (x) { /* rien */ } });
      D.fichP.push(p);
    } catch (x) { e.etat = 3; }
    return e;
  }
  function fichier(cle) { var e = demander(cle); return e.etat === 2 ? e.data : null; }
  function stats_chargement() { var k, n = 0; for (k in D.fich) if (Object.prototype.hasOwnProperty.call(D.fich, k) && D.fich[k].etat === 1) n++; return n; }

  // Estimation de la direction (MARGE_PRODUITS), demandée une fois ; refusée pour les comptes sans accès.
  function demanderMargeProduits() {
    if (window.MARGE_PRODUITS || D.mpEtat) return;
    D.mpEtat = 1;
    try {
      var c = V2.sb && V2.sb();
      if (!V2.loadFiles || !c || !(V2.user && V2.user.id)) { D.mpEtat = 3; return; }
      // Même accès que « Notre marge par produit » : la base répond d'abord, le fichier n'est demandé que sur un oui.
      Promise.resolve(c.rpc('jarvis_acces_marge_produits')).then(function (r) {
        if (!(r && !r.error && r.data === true)) { D.mpEtat = 3; return; }
        return V2.loadFiles(['margeproduits']).then(function () { D.mpEtat = window.MARGE_PRODUITS ? 2 : 3; planRerender(); });
      }).catch(function () { D.mpEtat = 3; });
    } catch (x) { D.mpEtat = 3; }
  }
  function ligneMargeProduits(cip) {
    var M = window.MARGE_PRODUITS, cols, ix = {}, i;
    if (!M || !M.produits || !M.meta || !M.meta.colonnes) return null;
    if (D.mpRef !== M) {
      cols = M.meta.colonnes;
      for (i = 0; i < cols.length; i++) ix[cols[i]] = i;
      D.mpIx = {}; D.mpRef = M;
      if (ix.cip !== undefined) for (i = 0; i < M.produits.length; i++) D.mpIx[String(M.produits[i][ix.cip])] = i;
      D.mpCol = ix;
    }
    i = D.mpIx[String(cip)];
    if (i === undefined) return null;
    var p = M.produits[i], c = D.mpCol;
    return { m26: c.marge_boite_26 === undefined ? null : p[c.marge_boite_26], m27: c.marge_boite_27 === undefined ? null : p[c.marge_boite_27],
             t26: c.taux_26 === undefined ? null : p[c.taux_26], t27: c.taux_27 === undefined ? null : p[c.taux_27],
             dispo27: c.dispo_2027 === undefined ? null : p[c.dispo_2027] === 1 };
  }
  // Notre marge par boîte : l'estimation de la direction si elle a ce CIP, sinon la règle du Pilotage (libellée « estimation »).
  function notreMargeDe(l) {
    var cip = String(l.cip), m = ligneMargeProduits(cip), pu, a, b;
    demanderMargeProduits();
    if (m && m.m26 != null) {
      return { source: 'direction', libelle: 'estimation de la direction', boite26: +m.m26, boite27: m.m27 == null ? null : +m.m27,
               delta: m.m27 == null ? null : m.m27 - m.m26, taux26: m.t26, taux27: m.t27, disponible2027: m.dispo27 };
    }
    pu = l.net > 0 ? l.net : (l.prix > 0 ? l.prix : 0);
    if (!V2.piloMargeVente || !(pu > 0)) return null;
    try {
      a = V2.piloMargeVente({ artCode: cip, puNet: pu, qte: 1, mntNetHt: pu, year: 2026 });
      b = V2.piloMargeVente({ artCode: cip, puNet: pu, qte: 1, mntNetHt: pu, year: 2027 });
    } catch (x) { return null; }
    if (!isFinite(a) || !isFinite(b)) return null;
    return { source: 'pilotage', libelle: 'estimation (règle du Pilotage)', boite26: a, boite27: b, delta: b - a, taux26: null, taux27: null, disponible2027: null };
  }

  var _froidSet = null, _froidRef = null;
  function estFroid(cip) {
    var F = window.FROID_CIPS;
    if (!F) return false;
    if (_froidRef !== F) { _froidRef = F; _froidSet = {}; F.forEach(function (c) { _froidSet[String(c).replace(/\D/g, '')] = 1; }); }
    return !!_froidSet[String(cip)];
  }
  function maintenant() { return D.horloge ? D.horloge() : new Date(); }
  function periodeLib(mois) {
    var a = mois[0], b = mois[0], i;
    for (i = 1; i < mois.length; i++) { if (mois[i] < a) a = mois[i]; if (mois[i] > b) b = mois[i]; }
    return anneeDe(a) === anneeDe(b) ? MOIS_C[moisCal(a) - 1] + ' → ' + MOIS_C[moisCal(b) - 1] + ' ' + anneeDe(b) : moisLib(a) + ' → ' + moisLib(b);
  }
  function moisIso(iso) { var m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? MOIS_C[+m[2] - 1] + ' ' + m[1] : ''; }

  // ── L'objet complet du panneau. null pour chaque partie sans donnée. ──
  // Unités : € par boîte sauf mention ; « Ttc » = prix public ; pourcentages en nombres entiers ou décimaux (11 = +11 %).
  function stats(l, d) {
    var cip, froid, pfht, now, N, ne, S, mois, restreint, v, out, i, fut, arch, rg, fam, rg2, e, mom, tend, prev, sais;
    if (!l) return null;
    cip = String(l.cip); d = d || D.cache || {};
    now = maintenant();
    froid = estFroid(cip);
    pfht = pfhtDepuisPpht(l.ppht, froid);
    N = (D.nat && D.nat.data) || null; ne = N && N[cip] || null;

    out = { cip: cip, nom: l.d, famille: l.f, froid: froid, chargement: false, indisponibles: [] };

    // Prix et marges (par boîte)
    out.prix = { ppht: l.ppht > 0 ? l.ppht : null, net: l.net > 0 ? l.net : null, affiche: l.prix > 0 ? l.prix : null,
                 pfht: pfht, pfhtReconstitue: true, abandon26: l.ab == null ? null : l.ab };
    out.margeGrossiste = pfht == null ? null : (function () {
      var m26 = margeGrossiste(pfht, 2026, false), m27 = margeGrossiste(pfht, 2027, false);
      return { reglementee26: m26, reglementee27: m27, froid: froid, forfait26: froid ? FORFAIT_FROID[2026] : 0, forfait27: froid ? FORFAIT_FROID[2027] : 0,
               total26: margeGrossiste(pfht, 2026, froid), total27: margeGrossiste(pfht, 2027, froid) };
    })();
    out.margeOfficine = pfht == null ? null : { reglementee: margeOfficine(pfht), inchangee2027: true };
    out.abandon = l.ab == null ? null : { de26: l.ab, de27: abandon2027(l.ab, pfht) };
    out.margePharmacien = pfht == null ? null : margePharmacien(l.f, pfht, l.ab);
    out.notreMarge = notreMargeDe(l);

    // Alertes de prix public (JO)
    fut = fichier('prixFuturs'); arch = fichier('prixArchive');
    out.alertePrix = (fut || arch) ? alertesPrix(cip, fut, arch, now, pfht) : null;

    // Générique
    var genF = fichier('generiques'); rg2 = fichier('ema');
    fam = statutGenerique(cip, genF, ne);
    out.generique = (fam || rg2) ? { statut: fam ? fam.statut : null, depuis: fam ? fam.depuis : null, donneesAu: genF && genF.donneesAu || null, ema: emaPourMolecule(rg2, l.mol) } : null;

    // France : boîtes et valeur de l'année 2025 (Open Medic)
    e = fichier('regional'); rg = e && e.data && e.data[cip];
    out.france = null;
    if (l.france > 0 || rg) {
      var vb = 0, vv = 0;
      if (rg) { for (i = 0; i < (rg.b || []).length; i++) vb += rg.b[i] || 0; for (i = 0; i < (rg.e || []).length; i++) vv += rg.e[i] || 0; }
      var bo = l.france > 0 ? l.france : vb;
      out.france = { annee: 2025, boites: bo, valeur: rg ? vv : null, prixMoyen: rg && bo > 0 ? vv / bo : null, rang: l.rang || null,
                     libelleValeur: 'valeur au prix public, 2025' };
    }

    // Nos ventes et par commercial, sur les mois complets du reste du panneau
    S = window.WML_SALES; mois = d.mois;
    restreint = !!(V2.ventesRestreintes && V2.ventesRestreintes());
    out.nosVentes = null; out.parCommercial = null;
    if (S && S.length && mois && mois.length) {
      var cle = [S.length, cip, mois.join(','), restreint ? 1 : 0, V2.user ? 1 : 0].join('|');
      if (!D.stVentes || D.stVentesRef !== S || D.stVentes.cle !== cle) {
        D.stVentes = { cle: cle, v: ventesProduit(S, cip, mois, V2.estReste ? function (id) { return V2.estReste(id); } : null, !restreint,
          V2.voitVentesDe ? function (id) { return V2.voitVentesDe(id); } : null) };
        D.stVentesRef = S;
      }
      v = D.stVentes.v;
      out.nosVentes = { boitesAn: l.an, boites: v.boites, ca: v.ca, clientes: v.clientes, nbMois: mois.length, periode: periodeLib(mois) };
      if (!restreint) out.parCommercial = { periode: out.nosVentes.periode, lignes: v.comm };
    }

    // Tendance
    mom = V2.momentum ? V2.momentum(cip) : null;
    tend = V2.tendance ? V2.tendance(cip) : null;
    prev = previsionsPourCip(fichier('previsions'), cip);
    sais = saisonDe(ne && ne.s);
    out.tendance = (tend == null && mom == null && !prev && !sais) ? null : {
      anAn: tend, anAnPeriode: window.TENDANCE && window.TENDANCE.meta ? libMoisListe(window.TENDANCE.meta.mois, window.TENDANCE.meta.gen) : null,
      momentum: mom, momentumPeriode: window.MOMENTUM && window.MOMENTUM.meta ? libFenetre(window.MOMENTUM.meta.fenetre) : null,
      previsions: prev, saison: sais };

    // Autres
    var nv = V2.nouveaute ? V2.nouveaute(cip) : null;
    out.autres = { froid: froid, nouveaute: nv ? { amm: nv.amm || null, labo: nv.labo || '' } : null,
                   ansm: ansmPourCip(fichier('ansm'), cip), rappel: rappelPourCip(fichier('rappels'), cip, now), has: hasPourCip(fichier('has'), cip) };

    for (v in FICHIERS) if (Object.prototype.hasOwnProperty.call(FICHIERS, v)) {
      if (D.fich[v].etat === 3) out.indisponibles.push(v);
    }
    out.chargement = stats_chargement() > 0;
    return out;
  }
  function libMoisListe(liste, gen) {
    var m = String(liste || '').split('/').filter(Boolean), an = String(gen || '').slice(0, 4);
    if (!m.length || !an) return null;
    return MOIS_C[+m[0] - 1] + ' → ' + MOIS_C[+m[m.length - 1] - 1] + ' ' + an + ' face à ' + (an - 1);
  }
  function libFenetre(f) {
    var m = /^(\d{4})-(\d{2})\D+(\d{4})-(\d{2})$/.exec(String(f || ''));
    return m ? MOIS_C[+m[2] - 1] + ' ' + m[1] + ' → ' + MOIS_C[+m[4] - 1] + ' ' + m[3] : null;
  }

  // ── Vue pharmacien : le même calcul, un rendu qui masque ce qui est interne (mémorisé, avec repli sans stockage) ──
  var CLE_VUE_PHARMA = 'jarvis.comptoir.vuePharma';
  function lireVuePharma() { try { return !!(window.localStorage && window.localStorage.getItem(CLE_VUE_PHARMA) === '1'); } catch (x) { return false; } }
  function ecrireVuePharma(b) { try { if (window.localStorage) window.localStorage.setItem(CLE_VUE_PHARMA, b ? '1' : '0'); } catch (x) { /* sans stockage : valable pour cette séance */ } }
  C.vuePharma = lireVuePharma();

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
      var box = document.getElementById('cp-evo-n'), bm = document.getElementById('cp-evo-m'), l = D.cache && C.cip && D.cache.parCip[C.cip];
      if (box && l) box.innerHTML = evoHtml(l, 'nous');
      if (bm && l) bm.innerHTML = evoHtml(l, 'marche');
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
    panier: function (cip, ev) {
      if (ev) ev.stopPropagation();
      cip = String(cip);
      if (sel()[cip]) delete sel()[cip]; else sel()[cip] = 1;
      majPanier();
    },
    // En gros : tout ce que les filtres affichent, dans l'ordre du tri, jusqu'à PANIER_MAX.
    panierTout: function () {
      var d = donnees(); if (!d) return;
      var L = filtrees(d.lignes), s = sel(), ajout = 0, i;
      for (i = 0; i < L.length && i < PANIER_MAX; i++) if (!s[L[i].cip]) { s[L[i].cip] = 1; ajout++; }
      majPanier();
      if (V2.toast) V2.toast(ajout ? fr(ajout) + ' produit' + (ajout > 1 ? 's ajoutés' : ' ajouté') + ' au panier' +
        (L.length > PANIER_MAX ? ' (les ' + PANIER_MAX + ' premiers du tri)' : '') : 'Ces produits sont déjà au panier');
    },
    panierVoir: function () { C.panier = !C.panier; C.page = 1; majPanier(); },
    panierVider: function () { V2.produits.S.sel = {}; C.panier = false; majPanier(); },
    panierFiche: function () { V2.comptoir.fermerPanneau(); V2.produits.ficheDuPanier(); },
    ouvrir: function (cip) { C.cip = String(cip); C.offTout = false; C.mol = false; C.dcTout = false; rerender(); },
    // 21/10/2026 — arrivée depuis la recherche ⌘K : filtres remis à zéro (sinon « Opportunités seulement » cache
    // le produit cherché), recherche du Comptoir remplie, panneau ouvert. Une molécule (sans CIP) ouvre le produit
    // que nous vendons le plus, sur la vue « Toute la molécule » ; il est choisi au rendu, quand le catalogue est prêt.
    // On force le mode Comptoir : l'écran Produits peut avoir été laissé en mode Client.
    depuisRecherche: function (o) {
      o = o || {};
      C.q = o.q || ''; C.fam = 'all'; C.opp = false; C.stock = false; C.panier = false; C.page = 1;
      C.offTout = false; C.dcTout = false;
      C.cip = o.cip ? String(o.cip) : null; C.mol = !o.cip; C.pend = o.cip ? null : (o.mol || o.q || null);
      var S = V2.produits && V2.produits.S;
      if (S) { S.mode = 'comptoir'; S.apercu = false; }
      V2.go('produits');
    },
    dcMol: function (v) { C.mol = !!v; C.dcTout = false; rerender(); },
    dcTout: function () { C.dcTout = true; rerender(); },
    versOfficine: function (id) { V2.comptoir.fermerPanneau(); V2.go('pharma', String(id)); },
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
    return '<div class="cp-row' + (sel()[l.cip] ? ' pris' : '') + '" role="button" tabindex="0" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')"' +
      ' onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();this.click()}">' +
      boutonAdd(l.cip) +
      '<span class="cp-nom"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="cp-num"><b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' +
        (l.ab != null ? '<i title=""Abandon de marge">−' + eur2(l.ab) + '</i>' : '') + '</span>' +
      '<span class="cp-num"><b>' + numK(l.an) + '</b><i>bt/an</i></span>' +
      '<span class="cp-num cp-rang">' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</span>' +
      partHtml(l, d.partMoy, TD) +
      '<span class="cp-num">' + (l.opp ? '<b>' + eurK(l.pot) + '</b><i>par an</i>' : '<span class="cp-na">—</span>') + '</span>' +
      etabsCellules(l) +
      '<span class="cp-aqui">' + aQuiNb(l, AQ) + '</span>' +
      '</div>';
  }
  function carte(l, d, AQ, TD) {
    return '<div class="cp-card' + (sel()[l.cip] ? ' pris' : '') + '" role="button" tabindex="0" onclick="V2.comptoir.ouvrir(\'' + escAttr(l.cip) + '\')"' +
      ' onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();this.click()}">' +
      '<span class="cp-card-h"><span class="cp-card-n"><span class="cp-lib-l"><span class="cp-lib">' + esc(l.d) + '</span>' + badges(l) + '</span>' +
        '<span class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="cp-num"><b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' +
        (l.ab != null ? '<i>Abandon ' + eur2(l.ab) + '</i>' : '') + '</span></span>' +
      '<span class="cp-card-v"><b>' + fr(l.an) + '</b> bt/an · France <b>' + (l.rang ? 'n°' + fr(l.rang) : '—') + '</b></span>' +
      '<span class="cp-card-p">' + partHtml(l, d.partMoy, TD) + '</span>' +
      (l.opp ? '<span class="cp-pill">Potentiel <b>' + eurK(l.pot) + '</b> par an</span>' : '') +
      '<span class="cp-card-b"><span class="cp-strip">' + etabsCellules(l) + '</span>' +
        '<span class="cp-aqui">à qui : ' + aQuiNb(l, AQ) + '</span>' + boutonAdd(l.cip) + '</span>' +
      '</div>';
  }
  function resultatsHtml(d) {
    var L = filtrees(d.lignes), AQ = aQui();
    var TD = (C.tri === 'hausse' || C.tri === 'baisse') ? tendances() : null;
    var vis = L.slice(0, C.page * PAR_PAGE), rows = '', cards = '', i;
    for (i = 0; i < vis.length; i++) { rows += ligneTable(vis[i], d, AQ, TD); cards += carte(vis[i], d, AQ, TD); }
    var head = '<div class="cp-head"><span class="c">Panier</span><span>Produit</span><span class="n">Prix net</span><span class="n">Ventes</span>' +
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
        : C.panier ? '<div class="cp-vide">Le panier est vide.</div>'
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
    var o = document.getElementById('cp-outils'); if (o && src) o.innerHTML = outilsPanierHtml(+src.getAttribute('data-n') || 0);
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
    return Math.max(260, (vw >= 1000 ? 720 - 48 : Math.min(vw, 640) - 40) - 28);   // panneau, moins ses marges et le cadre de la courbe
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
  function plage(mois, a, b) { return MOIS_C[moisCal(mois[a]) - 1] + (a === b ? '' : '–' + MOIS_C[moisCal(mois[b]) - 1]); }

  function evoHtml(l, mode) {
    var F = window.FRANCE_MOIS;
    if (!F && D.frEtat < 2) return '<p class="cp-note">Chargement des ventes France mois par mois…</p>';
    var e = evolution(l.cip);
    if (!e) return '<p class="cp-note">Les ventes du réseau ne sont pas encore chargées.</p>';
    var ANNEE = e.an;   // année du dernier mois de nos ventes (2027 dès que janvier 2027 y est)
    if (!mode) D.pts = {};
    var MA = mode === 'marche', NO = mode === 'nous';
    var W = largeurPan(), n = e.mois.length, ca = C.unite === 'ca', i, h = '';
    var labels = e.mois.map(function (m) { return MOIS_C[moisCal(m) - 1]; });
    var fmtV = ca ? eurK : numK, uni = ca ? '' : ' bt';

    // Les trois chiffres qui répondent : nos ventes montent-elles, gagnons-nous des parts, le marché bouge-t-il ?
    if (!MA) h += '<div class="cp-tus">' +
      tuile('Nos ventes', fr(e.v2 / (e.k || 1)) + ' <small>bt/mois</small>', e.v1 > 0 ? e.v2 / e.v1 - 1 : null,
        e.k ? plage(e.mois, n - e.k, n - 1) + ' face à ' + plage(e.mois, 0, e.k - 1) : '—') +
      (e.tp
        ? tuile('Notre part', fmtPart(e.tp.fin), e.tp.debut > 0 ? e.tp.fin / e.tp.debut - 1 : null,
            plage(e.mois, e.tp.c, e.tp.d) + ' face à ' + plage(e.mois, e.tp.a, e.tp.b) + ' (' + fmtPart(e.tp.debut) + ')')
        : tuile('Notre part', '—', null, e.aFrance ? 'pas assez de mois comparables' : 'pas de ventes France publiées')) +
      (NO ? '' : e.yoy != null
        ? tuile('Marché France', numK(e.y1 / e.yoyMois) + ' <small>bt/mois</small>', e.yoy,
            'janv.–' + MOIS_C[e.yoyDern - 1] + ' ' + ANNEE + ' face à ' + (ANNEE - 1))
        : tuile('Marché France', '—', null, 'non publié pour ce produit')) +
      '</div>';

    if (!MA) h += '<div class="cp-ch"><div class="cp-ch-t"><span>Nos ventes, mois par mois</span>' +
      '<span class="cp-seg" role="group" aria-label="Unité">' +
        '<button class="' + (ca ? '' : 'on') + '" aria-pressed="' + !ca + '" onclick="V2.comptoir.unite(\'q\')">Boîtes</button>' +
        '<button class="' + (ca ? 'on' : '') + '" aria-pressed="' + ca + '" onclick="V2.comptoir.unite(\'ca\')">Chiffre d\'affaires</button></span></div>' +
      courbe({ id: 'cp-c-v', g: 'n', W: W, H: 180, labels: labels, fmt: fmtV,
        series: [{ v: ca ? e.ca : e.q, cls: 'b', aire: true }],
        aria: 'Nos ventes mois par mois, ' + plage(e.mois, 0, n - 1) + ' ' + anneeDe(e.mois[n - 1]),
        tip: bulleN }) + '</div>';

    if (e.aFrance) {
      var pm = D.cache ? D.cache.partMoy : 0, avecPart = e.part.some(function (x) { return x != null; });
      if (avecPart && !MA) {
        // Même nombre de décimales sur tout l'axe (pas « 1,0 % » au-dessus de « 0,50 % »).
        var pMax = Math.max.apply(null, e.part.map(function (x) { return x || 0; }).concat([pm]));
        var decP = niceMax(pMax * 1.08) * 100 < 1.5 ? 2 : 1;
        h += '<div class="cp-ch"><div class="cp-ch-t"><span>Notre part du marché France</span></div>' +
          courbe({ id: 'cp-c-p', g: 'n', W: W, H: 160, labels: labels,
            fmt: function (v) { return v <= 0 ? '0 %' : fr(v * 100, decP) + ' %'; },
            series: [{ v: e.part, cls: 'b' }], ref: { v: pm, lib: 'notre part moyenne ' + fmtPart(pm) },
            aria: 'Notre part du marché France mois par mois', tip: bulleN }) + '</div>';
      }
      if (!NO) h += '<div class="cp-ch"><div class="cp-ch-t"><span>Le marché France, mois par mois</span>' +
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
      rows += '<tr><td>' + MOIS_C[moisCal(e.mois[i]) - 1] + ' ' + anneeDe(e.mois[i]) + '</td><td>' + fr(e.q[i]) + '</td><td>' + eurK(e.ca[i]) + '</td>' +
        '<td>' + (e.fr[i] != null ? fr(e.fr[i]) : '—') + '</td><td>' + fmtPart(e.part[i]) + '</td></tr>';
    }
    if (!MA) h += '<details class="cp-tab"><summary>Voir les chiffres mois par mois</summary><div class="cp-tabw"><table>' +
      '<thead><tr><th>Mois</th><th>Nos boîtes</th><th>Notre CA</th><th>France</th><th>Part</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></details>';
    h += '<p class="cp-note">' + (MA ? '' : 'Nos ventes : réseau, mois complets. ') + 'France : Medic\'AM, boîtes remboursées, publié jusqu\'à ' +
        (F ? esc(MOIS_C[+F.meta.mois[F.meta.mois.length - 1].slice(5) - 1] + ' ' + F.meta.mois[F.meta.mois.length - 1].slice(0, 4)) : '—') +
        (MA ? '.' : '. Part = nos boîtes ÷ boîtes France du même mois.') + '</p>';
    return h;

    function bulleN(j) {
      return '<b>' + MOIS_C[moisCal(e.mois[j]) - 1] + ' ' + anneeDe(e.mois[j]) + '</b>' +
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

  // Bloc « Déjà commandé par » (21/10/2026) : les clientes qui ont déjà commandé ce produit, ou toute sa molécule.
  function dejaHtml(l, d) {
    var IX = commandes();
    if (!IX) return '';
    var restreint = !!(V2.ventesRestreintes && V2.ventesRestreintes());
    var nm = sansAccent(l.mol).trim(), grp = nm ? (molCips(d)[nm] || []) : [];
    var multi = grp.length >= 2, tout = multi && C.mol, cips = {}, i;
    if (tout) { for (i = 0; i < grp.length; i++) cips[grp[i]] = 1; } else cips[l.cip] = 1;
    var liste = listerCommandes(IX, cips);
    var titre = (restreint ? 'Vos clientes qui l\'ont commandé' : 'Déjà commandé par') + ' <span>' + fr(liste.length) + '</span>';
    var puces = multi
      ? '<div class="cp-chips cp-dc-ch" role="group" aria-label="Portée"><button class="cp-chip' + (tout ? '' : ' on') + '" aria-pressed="' + (!tout) + '" onclick="V2.comptoir.dcMol(false)">Ce produit</button>' +
        '<button class="cp-chip' + (tout ? ' on' : '') + '" aria-pressed="' + tout + '" onclick="V2.comptoir.dcMol(true)">Toute la molécule (' + fr(grp.length) + ' produits)</button></div>'
      : '';
    var corps;
    if (!liste.length) {
      corps = '<p class="cp-note">' + (tout ? 'Aucune de vos clientes n\'a commandé cette molécule sur la période.' : 'Aucune de vos clientes ne l\'a commandé sur la période.') + '</p>';
    } else {
      var n = liste.length, per = IX.debut === IX.fin ? 'en ' + moisLib(IX.debut) : 'de ' + moisLib(IX.debut) + ' à ' + moisLib(IX.fin);
      corps = '<p class="cp-phrase">' + (restreint ? (n > 1 ? '<b>' + fr(n) + '</b> de vos clientes ont commandé ' : '<b>1</b> de vos clientes a commandé ')
        : (n > 1 ? '<b>' + fr(n) + '</b> clientes ont commandé ' : '<b>1</b> cliente a commandé ')) +
        (tout ? 'cette molécule ' : 'ce produit ') + esc(per) + '.</p>';
      var vis = C.dcTout ? liste : liste.slice(0, OFF_VISIBLES);
      for (i = 0; i < vis.length; i++) {
        var o = vis[i], p = officine(o.id) || {};
        corps += '<button class="cp-dc-l" onclick="V2.comptoir.versOfficine(\'' + escAttr(o.id) + '\')"><span class="cp-dc-m">' +
          '<b>' + esc(p.name || ('Officine ' + o.id)) + '</b>' +
          (p.ville ? '<span>' + esc(p.ville) + '</span>' : '') +
          '<span>Dernière commande : ' + esc(moisLib(o.dern)) + '</span></span>' +
          '<span class="cp-dc-q"><b>' + fr(o.q) + '</b> <small>bt</small></span></button>';
      }
      if (!C.dcTout && liste.length > OFF_VISIBLES) {
        corps += '<button class="cp-more" onclick="V2.comptoir.dcTout()">Voir les ' + fr(liste.length - OFF_VISIBLES) + ' autres</button>';
      }
    }
    return '<p class="cp-st" id="cp-dc-t">' + titre + '</p>' + puces + corps;
  }

  // ── Rendu v4 « Le mélange » (22/10/2026) : squelette v1 (panneau 720 px, en-tête, tuiles) + fil numéroté v3 (cinq blocs, phrases). ──
  // Rien n'est recalculé ici : chaque chiffre vient de V2.comptoir.stats(l, d).
  // Date d'effet du plancher de marge grossiste 2027 (arrêté du 3/8/2026), la même que PLANCHER_MG[2027] plus haut.
  var DATE_MG_2027 = '2027-01-20';
  var LIB_INDISPO = { prixFuturs: 'prix publics (JO)', prixArchive: 'prix publics passés', generiques: 'génériques', ema: 'génériques en approche',
    regional: 'valeur France', previsions: 'prévisions', ansm: 'ruptures ANSM', rappels: 'rappels de lots', has: 'avis HAS' };
  var ALERTE_FICHIERS = ['prixFuturs', 'prixArchive', 'generiques', 'ema', 'ansm', 'rappels'];
  function pctSigne(x) { return x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + fr(Math.abs(x)) + ' %'; }
  function dateJour(iso) { return dateFr(String(iso || '').slice(0, 10)); }
  function gros(t) { return '<b class="cq-g">' + t + '</b>'; }
  function eurRond(n) { n = +n || 0; return Math.abs(n) >= 1e6 ? fr(n / 1e6, Math.abs(n) >= 1e7 ? 0 : 1) + ' M€' : Math.abs(n) >= 1e3 ? fr(n / 1e3) + ' k€' : fr(n) + ' €'; }

  function bloc(num, titre, corps, cls) {
    return '<section class="cq-bl ' + (cls || '') + '" aria-labelledby="cq-b' + num + '"><h3 class="cq-bt" id="cq-b' + num + '"><span>' + num + '</span>' + titre + '</h3>' + corps + '</section>';
  }
  function noteBloc(t) { return '<p class="cp-note cq-nb">' + t + '</p>'; }

  // 1. Ce qui change : une carte par alerte, phrases en clair, gros badge à gauche.
  function alerte(kind, fig, texte) {
    return '<div class="cq-al cq-al-' + kind + '"><span class="cq-al-f">' + fig + '</span><p>' + texte + '</p></div>';
  }
  function blocAlertes(s, l, vp) {
    var h = '', i, x, n = 0, premierEffectif = true;
    if (s.alertePrix) {
      for (i = 0; i < s.alertePrix.evenements.length; i++) {
        x = s.alertePrix.evenements[i];
        var baisse = x.sens === 'baisse', pct = (x.ancienTtc > 0 && x.nouveauTtc != null) ? (x.nouveauTtc / x.ancienTtc - 1) * 100 : null;
        var verbe = x.aVenir ? (baisse ? 'baissera' : 'augmentera') : (baisse ? 'a baissé' : 'a augmenté');
        var t = 'Le prix public ' + verbe + (pct != null ? ' de ' + gros(fr(Math.abs(pct)) + ' %') : '') + ' le ' + dateJour(x.dateEffet) +
          (x.ancienTtc != null && x.nouveauTtc != null ? ' : ' + fr(x.ancienTtc, 2) + ' → ' + fr(x.nouveauTtc, 2) + ' € (JO).' : ' (JO).');
        if (!x.aVenir && premierEffectif) {
          premierEffectif = false;
          if (s.alertePrix.catalogueEnRetard && !vp) t += ' Le prix du catalogue n\'en tient pas encore compte : les marges ci-dessous reposent sur l\'ancien prix.';
        }
        h += alerte('prix', pct != null ? (pct < 0 ? '−' : '+') + fr(Math.abs(pct)) + ' %' : 'Prix', t); n++;
      }
    }
    var g = s.generique;
    if (g && g.statut === 'nouveau') { h += alerte('info', 'Générique', 'Un nouveau groupe de génériques est arrivé' + (g.depuis ? ' le ' + gros(dateJour(g.depuis)) : '') + '.'); n++; }
    else if (g && g.statut === 'commercialise') { h += alerte('info', 'Générique', 'Un générique est commercialisé.'); n++; }
    else if (g && g.statut === 'repertoire') { h += alerte('info', 'Générique', 'Le groupe est inscrit au répertoire des génériques (pas forcément commercialisé).'); n++; }
    if (g && g.ema && g.ema.length) {
      for (i = 0; i < g.ema.length; i++) {
        x = g.ema[i];
        h += alerte('info', 'À venir', 'Un générique approche : ' + esc(x.nom) + (x.type ? ' (' + esc(x.type) + ')' : '') + (x.statut ? ', ' + esc(x.statut) : '') + (x.date ? ', avis de l\'EMA du ' + dateJour(x.date) : '') + '.'); n++;
      }
    }
    var a = s.autres && s.autres.ansm;
    if (a) { h += alerte('warn', /rupture/i.test(a.statut || '') ? 'Rupture' : 'Tension', 'Le produit est signalé « ' + esc(a.statut) + ' » par l\'ANSM' + (a.depuis ? ' depuis le ' + dateJour(a.depuis) : '') + ' ; retour prévu : ' + gros(esc(a.retourTexte || a.retour || 'non communiqué')) + '.'); n++; }
    else if (l && l.rupt) { h += alerte('warn', 'Rupture', 'Le produit est signalé en rupture (ANSM) ; date de retour non communiquée.'); n++; }
    var r = s.autres && s.autres.rappel;
    if (r) { h += alerte('warn', 'Rappel', 'Un rappel de lots a été publié le ' + dateJour(r.date) + (r.titre ? ' : ' + esc(r.titre) : '') + (r.nbLots ? ' (' + fr(r.nbLots) + ' lot' + (r.nbLots > 1 ? 's' : '') + ')' : '') + '.'); n++; }
    var manque = s.indisponibles.filter(function (k) { return ALERTE_FICHIERS.indexOf(k) >= 0; }).map(function (k) { return LIB_INDISPO[k]; });
    if (!n) {
      h = s.chargement ? '<p class="cq-rien cq-rien-c">Vérification en cours…</p>'
        : '<p class="cq-rien"><i aria-hidden="true">✓</i>Rien à signaler sur ce produit.</p>';
    }
    if (manque.length) h += noteBloc('Non vérifié pour le moment : ' + esc(manque.join(', ')) + '.');
    return bloc(1, 'Ce qui change', h);
  }

  // Tuiles chiffrées (squelette v1) : libellé, contenu, note de période.
  function tuileT(cls, lib, unite, corps, per) {
    return '<section class="cp-t ' + cls + '" aria-label="' + esc(lib) + '"><p class="cp-tl">' + esc(lib) + (unite ? '<span>' + esc(unite) + '</span>' : '') + '</p>' +
      corps + (per ? '<p class="cp-tp">' + per + '</p>' : '') + '</section>';
  }
  function tuileVide(cls, lib, unite, raison) {
    return tuileT(cls, lib, unite, '<p class="cp-big nd">—</p><p class="cp-tx">' + esc(raison) + '</p>', '');
  }
  function minis(items) {
    var h = '<div class="cp-mn' + (items.length === 3 ? ' s3' : '') + '" style="--n:' + (items.length === 3 ? 2 : items.length) + '">', i;
    for (i = 0; i < items.length; i++) h += '<div><small>' + items[i][0] + '</small><b>' + items[i][1] + '</b></div>';
    return h + '</div>';
  }
  function reglette(m, b, h) {
    var pos = function (v) { return Math.max(0, Math.min(100, (v - 70) / 60 * 100)); };
    return '<div class="cp-rg" role="img" aria-label="Fourchette : entre ' + fr(b) + ' % et ' + fr(h) + ' %, valeur centrale ' + fr(m) + ' %">' +
      '<i style="left:' + pos(b).toFixed(1) + '%;width:' + Math.max(2, pos(h) - pos(b)).toFixed(1) + '%"></i>' +
      '<span class="z"></span><span class="m" style="left:' + pos(m).toFixed(1) + '%"></span></div>';
  }

  // 2. Les marges : deux tuiles, chacune = UNE phrase + deux barres empilées (aujourd'hui / 2027). Un chiffre ne s'écrit qu'une fois, hors barres.
  function barre(lib, reg, ab, total, max, legende) {
    var w1 = max > 0 ? reg / max * 100 : 0, w2 = max > 0 && ab ? ab / max * 100 : 0;
    return '<div class="cq-br"><div class="cq-br-h"><span>' + lib + '</span><b>' + eur2(total) + '</b></div>' +
      '<div class="cq-br-t" aria-hidden="true"><i class="cq-s1" style="width:' + w1.toFixed(2) + '%"></i>' + (w2 > 0 ? '<i class="cq-s2" style="width:' + w2.toFixed(2) + '%"></i>' : '') + '</div>' +
      (legende ? '<p class="cq-br-d"><span><i class="cq-k1"></i>marge réglementée ' + eur2(reg) + '</span>' + (ab ? '<span><i class="cq-k2"></i>abandon de marge ' + eur2(ab) + '</span>' : '') + '</p>' : '') + '</div>';
  }
  function tuileMargePharmacien(s, vp) {
    var m = s.margePharmacien, cls = vp ? 'w6 m1' : 'w3 m1';
    if (!m) return tuileVide(cls, 'Marge pharmacien', 'par boîte', 'Prix fabricant HT non disponible pour ce produit.');
    if (!m.applicable) return tuileVide(cls, 'Marge pharmacien', 'par boîte', 'Calculée pour les princeps remboursables seulement (ni générique, ni biosimilaire, ni produit non remboursable).');
    var egal = Math.abs(m.delta) < 0.005, max = Math.max(m.total26, m.total27), d27 = dateFr(DATE_MG_2027);
    var diffAb = m.abandon26 != null && m.abandon27 != null && Math.round((m.abandon27 - m.abandon26) * 100) !== 0;
    return tuileT(cls, 'Marge pharmacien', 'par boîte',
      '<p class="cq-ph">Le pharmacien gagne ' + gros(eur2(m.total26)) + ' par boîte' +
        (egal ? ', ' + gros('autant') + ' en 2027.' : ' aujourd\'hui, puis ' + gros(eur2(m.total27)) + ' à partir du ' + d27 + ' (' + (m.delta < 0 ? '−' : '+') + eur2(Math.abs(m.delta)) + ').') + '</p>' +
      '<div class="cq-brs">' + barre('Aujourd\'hui', m.reglementee, m.abandon26, m.total26, max, true) +
        barre(egal ? 'En 2027 : inchangé' : 'À partir du ' + d27, m.reglementee, m.abandon27, m.total27, max, diffAb) + '</div>',
      m.sansAbandon ? 'Aucun abandon de marge sur ce prix.' : 'Par boîte, princeps remboursable.');
  }
  function tuileNotreMarge(s) {
    var nm = s.notreMarge;
    if (nm && !(nm.boite26 > 0.004) && !(nm.boite27 > 0.004)) return tuileVide('w3 m1', 'Notre marge', 'par boîte', 'Aucune marge calculée sur ce produit par la règle du Pilotage.');
    if (!nm) return tuileVide('w3 m1', 'Notre marge', 'par boîte', 'Donnée indisponible pour ce produit.');
    var egal = nm.boite27 != null && Math.abs(nm.delta) < 0.005, d27 = dateFr(DATE_MG_2027), mx = Math.max(nm.boite26, nm.boite27 || 0);
    var bar = function (lib, v) {
      return '<div class="cq-br"><div class="cq-br-h"><span>' + lib + '</span><b>' + (v != null ? eur2(v) : '—') + '</b></div>' +
        '<div class="cq-br-t" aria-hidden="true"><i class="cq-s3" style="width:' + (v != null && mx > 0 ? (v / mx * 100).toFixed(2) : 0) + '%"></i></div></div>';
    };
    return tuileT('w3 m1', 'Notre marge', 'par boîte',
      '<p class="cq-ph">Nous gardons ' + gros(eur2(nm.boite26)) + ' par boîte' +
        (nm.boite27 == null ? ', 2027 pas encore connue.' : egal ? ', ' + gros('autant') + ' en 2027.' : ' aujourd\'hui, puis ' + gros(eur2(nm.boite27)) + ' à partir du ' + d27 + ' (' + (nm.delta < 0 ? '−' : '+') + eur2(Math.abs(nm.delta)) + ').') + '</p>' +
      '<div class="cq-brs">' + bar('Aujourd\'hui', nm.boite26) + (nm.boite27 != null ? bar(egal ? 'En 2027 : inchangé' : 'À partir du ' + d27, nm.boite27) : '') + '</div>',
      nm.source === 'pilotage' ? 'Estimation, règle du Pilotage.' : esc(nm.libelle || 'Source : direction') + (nm.disponible2027 === false ? ' Produit non prévu au catalogue 2027.' : ''));
  }
  function blocMarges(s, vp) {
    return bloc(2, 'Les marges', '<div class="cp-grid">' + tuileMargePharmacien(s, vp) + (vp ? '' : tuileNotreMarge(s)) + '</div>');
  }

  // 3. Le marché : rangée de trois tuiles (v1), puis la courbe France mois par mois.
  function blocMarche(s, l, vp) {
    var h = '', fr_ = s.france, nv = s.nosVentes, t = s.tendance;
    if (fr_) h += tuileT(vp ? 'w3' : 'm1', 'France', '2025',
      '<p class="cp-big">' + numK(fr_.boites) + ' <small>boîtes</small></p>' +
      minis([['Valeur', fr_.valeur != null ? eurK(fr_.valeur) : '—'], ['Rang', fr_.rang ? 'n°' + fr(fr_.rang) : '—']]),
      'France 2025' + (fr_.prixMoyen != null ? ' · ' + eur2(fr_.prixMoyen) + ' par boîte en moyenne' : ''));
    else h += tuileVide(vp ? 'w3' : 'm1', 'France', '2025', 'Produit absent des ventes France.');
    if (!vp) {
      if (nv) {
        var part = fr_ && fr_.boites > 0 ? nv.boitesAn / fr_.boites : null;
        h += tuileT('m1', 'Nos ventes', '',
          '<p class="cp-big">' + eurK(nv.ca) + ' <small>HT</small></p>' +
          minis([['Boîtes', fr(nv.boites)], ['Clientes', fr(nv.clientes)], ['Part', part != null ? fmtPart(part) : '—']]),
          'Nos ventes, ' + esc(nv.periode));
      } else h += tuileVide('m1', 'Nos ventes', '', 'Ventes du réseau pas encore chargées.');
    }
    if (t && (t.anAn != null || t.previsions)) {
      var p = t.previsions, tonT = t.anAn == null ? '' : t.anAn > 0.5 ? ' up' : t.anAn < -0.5 ? ' down' : '';
      h += tuileT(vp ? 'w3 m1' : 'm1', 'Tendance', 'France, an/an',
        '<p class="cp-big' + tonT + '">' + pctSigne(t.anAn) + ' <small>sur un an</small></p>' +
        (p ? '<div class="cp-fc"><p class="cp-fc-h"><span>Prévision à 6 mois</span><b>' + fr(p.m6) + ' % <small>(' + fr(p.b6) + '–' + fr(p.h6) + ')</small></b></p>' +
          reglette(p.m6, p.b6, p.h6) +
          '<p class="cp-fc-n">100 = rythme des 3 derniers mois' + (p.fiable ? '' : ' · fourchette large') + ' · 3 mois : ' + fr(p.m3) + ' % · 12 mois : ' + fr(p.m12) + ' %</p></div>'
          : '<p class="cp-tx">Prévisions indisponibles.</p>'),
        t.anAn != null ? esc(t.anAnPeriode || 'même période un an avant') + (t.momentum != null ? ' · élan ' + pctSigne(t.momentum) + ' par mois' : '') : '');
    } else h += tuileVide(vp ? 'w3 m1' : 'm1', 'Tendance', 'France, an/an', 'Pas de tendance publiée pour ce produit.');
    return bloc(3, 'Le marché', '<div class="cp-grid">' + h + '</div>' +
      '<p class="cp-fn">' + (vp ? '' : 'Part = nos boîtes par an ÷ boîtes France 2025. ') + 'Valeur : prix public, base de remboursement.</p>' +
      '<div id="cp-evo-m" class="cp-card">' + evoHtml(l, 'marche') + '</div>');
  }

  // Par commercial : petites barres horizontales (direction seulement ; null = le bloc n'existe pas).
  function parCommercialHtml(s) {
    var pc = s.parCommercial, i, x, max = 0, h;
    if (!pc) return '';
    h = '<div class="cp-bl"><p class="cp-st">Par commercial</p>';
    if (!pc.lignes.length) return h + '<p class="cp-note">Aucune vente attribuée à un commercial.</p></div>';
    for (i = 0; i < pc.lignes.length; i++) max = Math.max(max, pc.lignes[i].ca || 0);
    h += '<p class="cp-note">Nos ventes, ' + esc(pc.periode) + ', chiffre d\'affaires HT.</p>';
    for (i = 0; i < pc.lignes.length; i++) {
      x = pc.lignes[i];
      h += '<div class="cp-pc"><b title="' + escAttr(x.nom) + '">' + esc(x.nom) + '</b>' +
        '<span class="cp-bh"><i style="width:' + (max > 0 ? Math.max(2, (x.ca || 0) / max * 100).toFixed(1) : 0) + '%"></i></span>' +
        '<strong>' + eurK(x.ca) + '</strong><small>' + fr(x.boites) + ' boîte' + (x.boites > 1 ? 's' : '') + ' · ' + fr(x.clientes) + ' cliente' + (x.clientes > 1 ? 's' : '') + '</small></div>';
    }
    return h + '</div>';
  }

  // 4. Chez nous (interne) : jamais en vue pharmacien.
  function blocNous(s, l, d, liste, ventes, off) {
    var h = '<div class="cq-sep" role="note"><span>Interne</span> masqué en vue pharmacien</div><section class="cq-bl cq-bl-i" aria-labelledby="cq-b4"><h3 class="cq-bt" id="cq-b4"><span>4</span>Chez nous · interne</h3>';
    h += parCommercialHtml(s);
    h += '<p class="cp-st">Nos ventes, mois par mois</p><div id="cp-evo-n" class="cp-card">' + evoHtml(l, 'nous') + '</div>';
    h += '<div class="cp-bl">' + dejaHtml(l, d) + '</div>';
    h += '<div class="cp-bl"><p class="cp-st">Potentiel</p>' + ventes + '</div>';
    h += '<div class="cp-bl"><p class="cp-st">À qui le proposer' + (liste ? ' <span>' + fr(liste.length) + '</span>' : '') + '</p>' + off + '</div>';
    return h + '</section>';
  }

  // 5. Le produit
  function fait(lib, val, det) {
    return '<div class="cp-ft"><em>' + lib + '</em><b>' + val + '</b>' + (det ? '<small>' + det + '</small>' : '') + '</div>';
  }
  function blocProduit(s, l, stock) {
    var h = '<p class="cp-st cp-st0">Stock par établissement</p>' + stock + '<div class="cp-fts">', x = s.autres, g = s.generique;
    if (g && g.statut) {
      var lib = { commercialise: 'Un générique est commercialisé', nouveau: 'Nouveau groupe de génériques', repertoire: 'Groupe inscrit au répertoire des génériques', aucun: 'Aucun générique' };
      h += fait('Générique', esc(lib[g.statut] || g.statut), g.depuis ? 'depuis le ' + dateJour(g.depuis) : g.donneesAu ? 'BDPM, données au ' + dateJour(g.donneesAu) : 'BDPM');
    }
    h += fait('Chaîne du froid', x.froid ? 'Oui, 2 à 8 °C' : 'Non');
    if (x.has) h += fait('Avis HAS', 'SMR ' + esc(x.has.smr || '—') + ' · ASMR ' + esc(x.has.asmr || '—'), 'avis du ' + dateJour(x.has.date) + (x.has.motif ? ' · ' + esc(x.has.motif) : ''));
    else h += fait('Avis HAS', 'Aucun avis récent');
    if (s.tendance && s.tendance.saison) {
      var sa = s.tendance.saison, ind = sa.indices, mx = Math.max.apply(null, ind), bars = '', i;
      for (i = 0; i < 12; i++) bars += '<i class="' + (i + 1 === sa.moisFort ? 'f' : i + 1 === sa.moisFaible ? 'w' : '') + '" style="height:' + Math.max(8, ind[i] / (mx || 1) * 100).toFixed(0) + '%" title="' + MOIS_C[i] + '"></i>';
      h += fait('Saisonnalité', 'Fort en ' + MOIS_C[sa.moisFort - 1] + ', faible en ' + MOIS_C[sa.moisFaible - 1], 'ventes France, indices du produit') +
        '<div class="cp-sai" role="img" aria-label="Indice saisonnier mois par mois, de janvier à décembre">' + bars + '</div><div class="cp-sai-m" aria-hidden="true"><span>janv.</span><span>juin</span><span>déc.</span></div>';
    }
    h += fait('Nouveauté', x.nouveaute ? 'AMM ' + esc(x.nouveaute.amm || '') + (x.nouveaute.labo ? ' · ' + esc(x.nouveaute.labo) : '') : 'Non', 'AMM de moins de 36 mois');
    return bloc(5, 'Le produit', h + '</div>', 'cq-bl-p');
  }

  function panneauHaut(l, s, vp) {
    var ab = l.ab != null;
    return '<div class="cp-hero"><div class="cp-hn"><small>' + (l.f === 'nr' ? 'Tarif' : 'Prix net') + ', par boîte</small>' +
        '<b>' + (l.prix > 0 ? eur2(l.prix) : '—') + '</b>' + (ab ? '<s>' + eur2(l.ppht) + '</s>' : '') + '</div>' +
      (ab ? '<div class="cp-hn ab"><small>Abandon de marge, par boîte</small><b>' + eur2(l.ab) + '</b></div>' : '') +
      '<div class="cp-hg">' +
        (l.f === 'nr' && l.prix > 0 ? '<span class="cp-tag">' + (l.tar ? 'Tarif au ' + dateFr(window.ETAB_PRICES.tarifDate) : 'Tarif') + '</span>' : '') +
        (l.rupt ? '<span class="cp-tag cp-tag-r">Rupture ANSM</span>' : '') +
        (l.opp && !vp ? '<span class="cp-tag">Opportunité</span>' : '') + '</div></div>';
  }

  function panneauHtml(d) {
    var l = C.cip && d.parCip[C.cip];
    if (!l) return '';
    chargerFrance();
    var FAM = V2.produits.FAM || {};
    var AQ = aQui(), liste = AQ ? (AQ[l.cip] || []) : null, i;
    var aLaMoy = l.france > 0 ? l.france * d.partMoy : 0;
    var vp = !!C.vuePharma, s = stats(l, d);

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
            (l.opp ? ' · potentiel ' + fr(l.pot) + ' € par an si on rejoint notre part moyenne.'
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

    var indispo = s && s.indisponibles.filter(function (k) { return ALERTE_FICHIERS.indexOf(k) < 0; }).length ? '<p class="cp-note">Données momentanément indisponibles : ' +
      esc(s.indisponibles.filter(function (k) { return ALERTE_FICHIERS.indexOf(k) < 0; }).map(function (k) { return LIB_INDISPO[k] || k; }).join(', ')) + '.</p>' : '';
    return '<div class="cp-fond" onclick="V2.comptoir.fermer()"></div>' +
      '<aside class="cp-pan' + (vp ? ' vp' : '') + '" role="dialog" aria-label="Fiche produit">' +
      '<div class="cp-pan-h"><div class="cp-pan-id"><p class="cp-pan-t">' + esc(l.d) + '</p>' +
        '<p class="cp-meta">' + esc([l.labo, 'CIP ' + l.cip, FAM[l.f] ? FAM[l.f].l : ''].filter(Boolean).join(' · ')) + '</p></div>' +
        '<button class="cp-vp' + (vp ? ' on' : '') + '" aria-pressed="' + vp + '" onclick="V2.comptoir.vuePharma(' + (!vp) + ')">' +
          '<span class="cp-sw" aria-hidden="true"><i></i></span>Vue pharmacien</button>' +
        '<button class="cp-x" aria-label="Fermer" onclick="V2.comptoir.fermer()">' + (ICO('close', 18, 2) || '✕') + '</button></div>' +
      '<div class="cp-pan-c">' +
        (vp ? '<p class="cp-vpn">Vue pharmacien active : notre marge, nos ventes et les noms des autres officines sont masqués.</p>' : '') +
        (s ? panneauHaut(l, s, vp) : '') +
        (l.f === 'nr' && l.net > 0 && Math.abs(l.net - l.prix) >= 0.01 * l.prix
          ? '<p class="cp-note">Prix moyen facturé au réseau : ' + eur2(l.net) + '.</p>' : '') +
        (s ? blocAlertes(s, l, vp) + blocMarges(s, vp) + blocMarche(s, l, vp) + (vp ? '' : blocNous(s, l, d, liste, ventes, off)) + blocProduit(s, l, stock) : blocProduit({ autres: { froid: false }, generique: null, tendance: null }, l, stock)) +
        indispo +
        '<div class="cp-ctas">' + boutonPanneau(l.cip) +
        '<button class="v2-btn v2-btn-primary cp-cta" onclick="V2.produits.ficheMarketing(\'' + escAttr(l.cip) + '\')">Fiche marketing du produit</button></div>' +
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
  // Exposé pour les tests : calcul pur, sans écran.
  V2.comptoir._indexCommandes = indexCommandes;
  V2.comptoir._listerCommandes = listerCommandes;
  V2.comptoir._dejaCommande = function (sales, cips, voit, estReste) { return listerCommandes(indexCommandes(sales, voit, estReste), cips); };
  V2.comptoir._repliMolecules = repliMolecules;
  // Socle de calcul (22/10/2026) : l'objet complet du panneau, et ses calculs purs pour les tests.
  V2.comptoir.stats = stats;
  V2.comptoir.vuePharma = function (b) {
    if (arguments.length) { C.vuePharma = !!b; ecrireVuePharma(C.vuePharma); rerender(); }
    return C.vuePharma;
  };
  V2.comptoir._calc = {
    pfhtDepuisPpht: pfhtDepuisPpht, margeGrossiste: margeGrossiste, margeOfficine: margeOfficine, abandon2027: abandon2027,
    margePharmacien: margePharmacien, alertesPrix: alertesPrix, statutGenerique: statutGenerique, emaPourMolecule: emaPourMolecule,
    ansmPourCip: ansmPourCip, rappelPourCip: rappelPourCip, hasPourCip: hasPourCip, previsionsPourCip: previsionsPourCip,
    saisonDe: saisonDe, ventesProduit: ventesProduit,
    // Pour les tests : attendre les fichiers demandés, fixer la date du jour.
    pret: function () { return Promise.all(D.fichP || []); },
    horloge: function (f) { D.horloge = f || null; }
  };
  // Pour la recherche ⌘K (22/10/2026) : la table de repli (null tant qu'elle n'est pas prête) et sa demande.
  V2.comptoir.repliMol = repli;
  V2.comptoir.chargerNational = chargerNat;
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
    if (C.pend) { var mt = topDeMolecule(d, C.pend); C.pend = null; if (mt) C.cip = mt; }   // 21/10/2026 : molécule choisie depuis ⌘K
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
    var periode = d.mois.length ? MOIS[moisCal(d.mois[0])] + '–' + MOIS[moisCal(d.mois[d.mois.length - 1])] + ' (' + d.mois.length + ' mois complets)' : '—';

    poserPanneau(d);
    return '<div class="cp">' +
      '<div class="cp-tete">' +
        '<div class="cp-tete-l"><span class="cp-sous">Catalogue des 7 établissements</span><span class="cp-n" id="cp-count">' + libCompte(n) + '</span></div>' +
        '<div class="cp-search">' + ICO('search', 18, 2) +
          '<input type="search" autocomplete="off" enterkeyhint="search" placeholder="Nom, CIP, molécule, laboratoire…" value="' + escAttr(C.q) + '"' +
          ' oninput="V2.comptoir.q(this.value)">' +
        '</div>' +
        '<div class="cp-chips">' + fams + '</div>' +
        '<div class="cp-chips cp-chips-w">' +
          '<button class="cp-chip' + (C.opp ? ' on' : '') + '" onclick="V2.comptoir.opp()">Opportunités seulement</button>' +
          '<button class="cp-chip' + (C.stock ? ' on' : '') + '" onclick="V2.comptoir.stock()">En stock</button>' +
          '<select class="cp-sel" aria-label="Meilleures ventes France" onchange="V2.comptoir.top(this.value)">' + selTop + '</select>' +
          '<select class="cp-sel" aria-label="Tri" onchange="V2.comptoir.tri(this.value)">' + selTri + '</select>' +
        '</div>' +
        '<div class="cp-chips" id="cp-outils">' + outilsPanierHtml(n) + '</div>' +
        '<div class="cp-leg"><span><i class="cp-dot g"></i>stock ≥ 50</span><span><i class="cp-dot l"></i>1 à 49</span>' +
          '<span><i class="cp-dot z"></i>0</span><span><i class="cp-leg-m"></i>part moyenne ' + fr(d.partMoy * 100, 2) + ' %</span></div>' +
      '</div>' +
      '<div id="cp-res">' + resultatsHtml(d) + '</div>' +
      '<div id="cp-bar-hote">' + barreHtml() + '</div>' +
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
      '@media (max-width:640px){.cp-chips-w{flex-wrap:wrap;overflow-x:visible}.cp-chips-w .cp-sel{flex:1 1 100%;max-width:100%}}',
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
      '.cp-head,.cp-row{display:grid;grid-template-columns:44px minmax(200px,1.4fr) 78px 66px 58px 110px 74px repeat(7,30px) 54px;align-items:center;gap:8px;padding:0 12px}',
      '.cp-head{height:34px;font:700 13px/1 Inter,sans-serif;color:var(--cp-ink3);text-transform:uppercase;white-space:nowrap}',
      '.cp-head .n{text-align:right}.cp-head .c{text-align:center}',
      '.cp-body{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--cp-shadow);overflow:hidden}',
      '.cp-row{width:100%;min-height:58px;padding-top:8px;padding-bottom:8px;border:0;border-top:1px solid var(--line);background:transparent;cursor:pointer;font:inherit;color:inherit}',
      '.cp-row:first-child{border-top:0}',
      '.cp-row:hover{background:var(--cp-alt)}',
      '.cp-row.pris,.cp-card.pris{background:var(--cp-wash)}',
      '.cp-row:focus-visible,.cp-card:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-2px}',
      '.cp-add{flex:none;justify-self:center;width:44px;height:44px;border-radius:12px;border:1px solid rgba(16,19,28,.14);background:var(--card);font:700 18px/1 Inter,sans-serif;color:var(--ip-blue);cursor:pointer}',
      '.cp-add.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.cp-chip-add{border-style:dashed;color:var(--cp-deep)}',
      '.cp-chip:disabled{opacity:.5;cursor:default}',
      '.cp-cta2{margin-bottom:8px;border:1px solid rgba(16,19,28,.14);background:var(--card);color:var(--ip-ink)}',
      // La barre du panier reste au pied de l'écran pendant qu'on parcourt la liste (sticky : pas de position:fixed sous #v2-root).
      '#cp-bar-hote{position:sticky;bottom:calc(12px + env(safe-area-inset-bottom));z-index:5}',
      '.cp-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:12px 0 0;padding:8px 8px 8px 16px;border-radius:16px;background:var(--ip-ink);color:#fff;box-shadow:0 14px 34px -12px rgba(16,19,28,.55)}',
      '.cp-bar-n{flex:1;min-width:140px;font:500 14px/1.2 Inter,sans-serif}',
      '.cp-bar-n b{font-weight:800;font-variant-numeric:tabular-nums}',
      '.cp-bar-l{min-height:44px;padding:0 12px;border:0;border-radius:12px;background:transparent;color:#fff;font:650 14px/1 Inter,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
      '.cp-bar-go{min-height:44px}',
      // Téléphone : le bouton rond « + » du CRM occupe le coin bas droit — la barre lui laisse la place.
      '@media (max-width:879px){.cp-bar{padding-right:80px}}',
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
      '@media (min-width:1000px){.cp-pan{left:auto;top:0;max-height:none;border-radius:0;box-shadow:-20px 0 50px rgba(16,19,28,.22)}}',
      '.cp-pan-h{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"id x" "vp vp";align-items:start;gap:10px;padding:16px 20px 12px}.cp-pan-id{grid-area:id;min-width:0}.cp-vp{grid-area:vp;justify-self:start}.cp-x{grid-area:x}',
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
      '.cp-dc-ch{flex-wrap:wrap;overflow:visible;margin:0 0 8px}',
      '.cp-dc-ch .cp-chip{min-height:44px;white-space:normal;text-align:left}',
      '.cp-dc-l{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:10px 0;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;cursor:pointer;font:inherit;color:var(--ip-ink)}',
      '.cp-dc-m{flex:1;min-width:0}',
      '.cp-dc-m b{display:block;font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-dc-m span{display:block;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-dc-q{flex:none;font:400 13px/1.2 Inter,sans-serif;color:var(--cp-ink3);white-space:nowrap}',
      '.cp-dc-q b{font:800 15px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
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
      '@media (max-width:430px){.cp-tus{grid-template-columns:1fr 1fr}.cp-tus .cp-tu:last-child{grid-column:span 2}}',
      // Tableau de bord (v1) : grille de tuiles, alertes, barres par commercial.
      '.cp-vp{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:0 14px 0 10px;border-radius:999px;border:1.5px solid var(--ip-blue);background:var(--card);color:var(--ip-blue);font:750 14px/1 Inter,sans-serif;cursor:pointer;white-space:nowrap}',
      '.cp-vp.on{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.cp-sw{position:relative;flex:none;width:30px;height:18px;border-radius:999px;background:rgba(0,80,230,.22)}',
      '.cp-sw i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--ip-blue)}',
      '.cp-vp.on .cp-sw{background:rgba(255,255,255,.35)}.cp-vp.on .cp-sw i{left:14px;background:#fff}',
      '.cp-vpn{margin:0 0 12px;padding:9px 12px;border-radius:12px;background:var(--cp-wash);color:var(--cp-deep);font:650 13.5px/1.4 Inter,sans-serif}',
      '.cp-hero{display:flex;align-items:flex-end;flex-wrap:wrap;gap:6px 28px;padding:4px 0 14px}',
      '.cp-hn{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}',
      '.cp-hn small{flex:1 1 100%;font:650 13px/1.3 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-hn b{font:800 34px/1 Inter,sans-serif;letter-spacing:-.02em;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-hn.ab b{color:var(--ip-blue)}',
      '.cp-hn s{font:500 14px/1 Inter,sans-serif;color:var(--cp-ink3);font-variant-numeric:tabular-nums}',
      '.cp-hg{display:flex;gap:6px;flex-wrap:wrap;align-self:center}',
      '.cp-als{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-wrap:wrap;gap:8px}',
      '.cp-al{display:flex;align-items:flex-start;gap:8px;max-width:100%;padding:8px 12px;border-radius:14px;font:650 13.5px/1.35 Inter,sans-serif}',
      '.cp-al i{flex:none;width:9px;height:9px;margin-top:5px;border-radius:50%}',
      '.cp-al small{font:500 13px/1.35 Inter,sans-serif}',
      '.cp-al.info{background:var(--cp-wash);color:var(--cp-deep)}.cp-al.info i{background:var(--ip-blue)}',
      '.cp-al.warn{background:var(--cp-amberw);color:#7A4709}.cp-al.warn i{background:#D98A1F}',
      '.cp-al.bad{background:#FDECEF;color:#A11D33}.cp-al.bad i{background:#D6334C}',
      '.cp-calm{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:8px 12px;border-radius:14px;border:1px solid var(--line);background:var(--cp-alt);font:600 13.5px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-calm i{flex:none;width:9px;height:9px;border-radius:50%;background:var(--cp-green)}',
      '.cp-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}',
      '.cp-t{grid-column:span 2;display:flex;flex-direction:column;gap:7px;min-width:0;padding:14px 14px 12px;border-radius:18px;border:1px solid var(--line);background:radial-gradient(260px 120px at 0 0,rgba(0,80,230,.10),transparent 70%),var(--card);box-shadow:var(--sh-1)}',
      '.cp-t.w3{grid-column:span 3}.cp-t.w6{grid-column:span 6}',
      '.cp-t.hero{border-color:rgba(0,80,230,.28);background:radial-gradient(340px 150px at 0 0,rgba(0,80,230,.17),transparent 70%),radial-gradient(240px 120px at 100% 100%,rgba(0,80,230,.06),transparent 70%),var(--card)}',
      '.cp-tl{margin:0;font:750 13px/1.25 Inter,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:var(--ip-ink)}',
      '.cp-tl span{margin-left:7px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--cp-ink3)}',
      '.cp-big{margin:0;font:800 30px/1.05 Inter,sans-serif;letter-spacing:-.02em;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-big small{font:650 14px/1 Inter,sans-serif;letter-spacing:0;color:var(--cp-ink3)}',
      '.cp-big.nd{color:var(--cp-ink3)}.cp-big.up{color:var(--cp-green)}.cp-big.down{color:var(--cp-amber)}',
      '.cp-tx{margin:0;font:400 13px/1.4 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-tp{margin:auto 0 0;padding-top:7px;border-top:1px solid var(--line);font:500 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-duo{display:flex;align-items:flex-end;gap:10px}',
      '.cp-duo div{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.cp-duo small{font:650 13px/1.2 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-duo b{font:800 32px/1 Inter,sans-serif;letter-spacing:-.02em;color:var(--ip-ink);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cp-duo .n27 b{color:var(--ip-blue)}',
      '.cp-ar{padding-bottom:5px;font:700 22px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-dz{display:inline-flex;align-self:flex-start;padding:5px 11px;border-radius:999px;font:750 13.5px/1.2 Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.cp-dz.up{background:#E4F4EC;color:var(--cp-green)}.cp-dz.down{background:var(--cp-amberw);color:var(--cp-amber)}',
      '.cp-dz.nul{background:var(--cp-alt);border:1px solid var(--line);color:var(--cp-ink3)}',
      '.cp-mn{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:8px}',
      '.cp-mn div{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.cp-mn.s3 div:first-child{grid-column:1/-1}',
      '.cp-mn small{font:650 13px/1.2 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-mn b{font:800 16px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.cp-fc{display:flex;flex-direction:column;gap:7px}',
      '.cp-fc-h{margin:0;display:flex;align-items:baseline;justify-content:space-between;gap:8px;font:650 13px/1.2 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-fc-h b{font:800 17px/1.1 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cp-fc-h small{font:650 13px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-fc-n{margin:0;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-rg{position:relative;height:10px;margin:2px 6px;border-radius:999px;background:var(--cp-alt);border:1px solid var(--line)}',
      '.cp-rg i{position:absolute;top:1px;bottom:1px;border-radius:999px;background:rgba(0,80,230,.28)}',
      '.cp-rg .z{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:var(--ip-ink)}',
      '.cp-rg .m{position:absolute;top:-3px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--ip-blue);border:2px solid var(--card);box-shadow:0 1px 3px rgba(16,19,28,.35)}',
      '.cp-fn{margin:8px 0 0;font:400 13px/1.4 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-card{padding:4px 14px 8px;border-radius:18px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh-1)}',
      '.cp-2{display:grid;grid-template-columns:minmax(0,1fr);gap:0 28px;align-items:start}',
      '@media (min-width:1000px){.cp-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.cp-2>.cp-bl:only-child{grid-column:1/-1}}',
      '.cp-bl{min-width:0}',
      '.cp-pc{display:grid;grid-template-columns:minmax(64px,96px) minmax(0,1fr) auto;align-items:center;gap:2px 10px;padding:7px 0;border-bottom:1px solid var(--line)}',
      '.cp-pc b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-bh{display:block;height:8px;border-radius:999px;background:var(--cp-alt);overflow:hidden}',
      '.cp-bh i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5C93F2,var(--ip-blue))}',
      '.cp-pc strong{font:800 13.5px/1.2 Inter,sans-serif;color:var(--ip-ink);font-variant-numeric:tabular-nums;text-align:right}',
      '.cp-pc small{grid-column:2/4;font:400 13px/1.3 Inter,sans-serif;color:var(--cp-ink3);font-variant-numeric:tabular-nums}',
      '.cp-kv{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;border-bottom:1px solid var(--line)}',
      '.cp-kv em{font:650 13.5px/1.3 Inter,sans-serif;font-style:normal;color:var(--cp-ink3)}',
      '.cp-kv span{display:flex;flex-direction:column;align-items:flex-end;text-align:right}',
      '.cp-kv b{font:800 13.5px/1.3 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-kv small{font:400 13px/1.3 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-ctas{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:18px}',
      '@media (min-width:1000px){.cp-ctas{grid-template-columns:1fr 1fr}}',
      '.cp-ctas .cp-cta{margin:0}',
      '@media (min-width:1000px){.cp-pan{width:720px;max-width:720px}.cp-pan-h{position:sticky;top:0;z-index:3;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"id vp x";align-items:center;gap:12px;padding:18px 24px 12px;background:radial-gradient(520px 200px at 6% -90px,rgba(0,80,230,.13),transparent 70%),var(--card)}.cp-pan-c{padding:0 24px}}',
      '@media (max-width:520px){.cp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cp-t,.cp-t.w3,.cp-t.w6{grid-column:span 1}.cp-t.w3,.cp-t.w6{grid-column:span 2}.cp-t:not(.w3):not(.w6) .cp-mn{grid-template-columns:1fr}.cp-hero{display:grid;grid-template-columns:1fr 1fr}.cp-hg{grid-column:1/-1}.cp-hn b{font-size:28px}.cp-big{font-size:26px}.cp-duo b{font-size:28px}.cp-hn b{font-size:30px}}',
      // ── v4 « Le mélange » : fil numéroté de la v3 posé sur le squelette (tuiles, en-tête) de la v1. ──
      '.cp-pan-c{--px:20px}@media (min-width:1000px){.cp-pan-c{--px:24px}}',
      '.cp-meta{margin:0;font:400 13px/1.4 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-hero{padding:0 0 4px}.cp-hn b{font-size:30px}',
      '.cq-bl{padding:10px 0 4px;border-top:1px solid var(--line)}',
      '.cq-bt{display:flex;align-items:center;gap:10px;margin:0 0 8px;font:750 13px/1 Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--ip-blue-d)}',
      '.cq-bt span{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:50%;background:var(--ip-blue);color:#fff;font-size:13px;letter-spacing:0}',
      '.cq-nb{margin:0 0 8px}',
      '.cq-g{font:800 22px/1.1 Inter,sans-serif;letter-spacing:-.02em;color:var(--ip-blue-d);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.cq-ph{margin:0 0 10px;font:500 15px/1.5 Inter,sans-serif;color:var(--ip-ink)}',
      '.cq-al{display:grid;grid-template-columns:84px 1fr;gap:14px;align-items:center;margin:0 0 6px;padding:7px 14px 7px 10px;border-radius:20px;border:1px solid var(--line);background:radial-gradient(260px 120px at 0 0,rgba(0,80,230,.10),transparent 70%),var(--card);box-shadow:var(--cp-shadow)}',
      '.cq-al p{margin:0;font:400 14.5px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.cq-al-info{grid-template-columns:84px 1fr;padding:6px 14px 6px 10px;gap:12px;border-radius:16px;box-shadow:none;background:var(--cp-alt)}.cq-al-info .cq-al-f{min-height:32px;padding:3px 4px;border-radius:10px}',
      '.cq-al-f{display:flex;align-items:center;justify-content:center;min-height:44px;padding:6px 4px;border-radius:14px;background:var(--cp-wash);color:var(--ip-blue-d);font:800 22px/1.1 Inter,sans-serif;letter-spacing:-.02em;text-align:center;font-variant-numeric:tabular-nums}',
      '.cq-al-info .cq-al-f{font-size:14px;letter-spacing:0}',
      '.cq-al-warn{background:radial-gradient(260px 120px at 0 0,rgba(154,91,18,.12),transparent 70%),var(--cp-amberw)}',
      '.cq-al-warn .cq-al-f{background:#fff;color:var(--cp-amber);font-size:14px;letter-spacing:0}',
      '.cq-al .cq-g{font-size:17px;color:inherit}.cq-al-prix .cq-g{color:var(--ip-blue-d)}',
      '.cq-rien{display:flex;align-items:center;gap:12px;margin:0 0 8px;font:600 16px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.cq-rien i{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#E3F4EC;color:var(--cp-green);font-style:normal;font-weight:800}',
      '.cq-rien-c{font-weight:500;color:var(--cp-ink3)}',
      '.cq-brs{display:grid;gap:6px;margin:0 0 4px}',
      '.cq-br-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:3px}',
      '.cq-br-h span{font:650 13.5px/1.2 Inter,sans-serif;color:var(--ip-ink)}',
      '.cq-br-h b{font:800 16px/1 Inter,sans-serif;color:var(--ip-blue-d);font-variant-numeric:tabular-nums}',
      '.cq-br-t{display:flex;width:100%;height:14px;border-radius:7px;background:var(--cp-alt);overflow:hidden}',
      '.cq-br-t i{display:block;height:100%}',
      '.cq-s1{background:#9DB4E8}.cq-s2{background:var(--ip-blue)}.cq-s3{background:var(--ip-blue-d);border-radius:0 7px 7px 0}',
      '.cq-br-d{display:flex;flex-wrap:wrap;align-items:center;gap:0 14px;margin:4px 0 0;font:400 13px/1.35 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cq-br-d span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}','.cq-k1,.cq-k2{display:inline-block;width:10px;height:10px;border-radius:3px;flex:none}.cq-k1{background:#9DB4E8}.cq-k2{background:var(--ip-blue)}',
      '.cq-sep{display:flex;align-items:center;gap:10px;margin:16px calc(-1 * var(--px)) 0;padding:12px var(--px);background:radial-gradient(300px 80px at 0 0,rgba(90,140,255,.35),transparent 70%),var(--ip-blue-d);color:#fff;font:600 14px/1.2 Inter,sans-serif}',
      '.cq-sep span{padding:4px 10px;border-radius:999px;background:#fff;color:var(--ip-blue-d);font:800 13px/1 Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em}',
      '.cq-bl-i{margin:0 calc(-1 * var(--px));padding:16px var(--px) 18px;background:var(--cp-alt);border-top:0}',
      '.cq-bl-i .cp-card,.cq-bl-i .cp-vgrid div,.cq-bl-i .cp-ecart.plat{background:var(--card)}',
      '.cq-bl-i .cp-chip:not(.on){background:var(--card)}',
      '.cq-bl-i .cp-bh{background:#fff}',
      '.cp-st small{margin-left:6px;font:400 13px/1 Inter,sans-serif;text-transform:none;letter-spacing:0;color:var(--cp-ink3)}',
      '.cp-st0{margin-top:0}',
      '.cp-fts{display:grid;gap:0}',
      '.cp-ft{display:grid;grid-template-columns:130px 1fr;gap:2px 12px;padding:11px 0;border-bottom:1px solid var(--line)}',
      '.cp-ft em{grid-row:span 2;font:650 13px/1.4 Inter,sans-serif;font-style:normal;color:var(--cp-ink3)}',
      '.cp-ft b{font:700 15px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.cp-ft small{font:400 13px/1.4 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cp-sai{display:flex;align-items:flex-end;gap:4px;height:44px;margin:8px 0 0 142px}',
      '.cp-sai i{flex:1;border-radius:3px 3px 0 0;background:#C9D6F2}.cp-sai i.f{background:var(--ip-blue)}.cp-sai i.w{background:var(--cp-amber)}',
      '.cp-sai-m{display:flex;justify-content:space-between;margin:3px 0 4px 142px;font:400 13px/1 Inter,sans-serif;color:var(--cp-ink3)}',
      '.cq-bl-p{padding-bottom:6px}',
      '.cp-t .cq-ph{margin:0 0 2px}.cp-t .cp-tp{padding-top:5px}',
      '@media (min-width:1000px){.cp-hero{flex-wrap:nowrap}.cp-hg{margin-left:auto;padding-bottom:4px}.cp-t{padding:12px 14px 10px;gap:6px}.cp-pan-h{padding:14px 24px 8px}.cp-fn{margin:6px 0 8px}}',
      '@media (max-width:520px){.cp-t.m1{grid-column:span 2}.cp-t:not(.w3):not(.w6) .cp-mn{grid-template-columns:repeat(var(--n),minmax(0,1fr))}.cp-t:not(.w3):not(.w6) .cp-mn.s3{grid-template-columns:repeat(2,minmax(0,1fr))}.cq-al{grid-template-columns:1fr;gap:8px}.cq-al-f{justify-content:flex-start;min-height:0;padding:8px 12px;font-size:20px}.cq-al-info .cq-al-f,.cq-al-warn .cq-al-f{font-size:14px}.cp-ft{grid-template-columns:1fr}.cp-ft em{grid-row:auto}.cp-sai,.cp-sai-m{margin-left:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
