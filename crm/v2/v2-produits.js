/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Produits » (pages.produits)
   L'entrée UNIQUE des produits, découpée par PUBLIC :
     · Client     — une officine qui nous achète déjà : ce que ses confrères
                    du même groupement prennent et qu'elle ne prend pas.
     · Groupement — un groupement entier : sur quoi ses adhérents sont en
                    retard chez nous, pour le travailler en bloc.
     · Prospect   — aucun historique : on part du catalogue.
     · Achats     — la même matière pour l'équipe achats (couverture de stock).
   Le même composeur (N meilleurs produits par catégorie, laboratoires,
   exclusivités) s'applique aux trois publics commerciaux.
   Le calcul vit dans v2-produits-moteur.js (module pur, testé).
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
  var FAM_COURT = {
    pr_low: 'petits prix', pr_mid: 'moyens', pr_high: 'chers',
    nr: 'NR', gen: 'génér.', biosim: 'biosim.'
  };
  // Seules les familles princeps portent un abandon de marge. Génériques,
  // NR et biosimilaires : net = PPHT, aucun abandon (règle métier stricte).
  function porteAbandon(f) { return String(f || '').indexOf('pr_') === 0; }

  // Le réglage d'abandon n'a de sens QUE sur les petits prix : l'abandon y est
  // un forfait de 0,18 €, donc un taux qui va de 4,2 % à 60 % selon le tarif.
  // Ailleurs il ne discrimine rien — 3,89 % sur toute la tranche médiane, et
  // sur les produits chers le forfait de 19,50 € donne un taux qui s'effondre.
  var REGLE_ABANDON = { pr_low: 1 };
  var PALIERS_ABANDON = [0, 4, 6, 8, 10, 15];
  var LABOS_FAM = { gen: 1, biosim: 1 };
  var NB_LABOS_AFFICHES = 8;
  // Génériqueurs partenaires d'Intégral (confirmé par Will le 04/08/2026).
  var PARTENAIRES = ['EG Labo', 'Zentiva', 'Zydus', 'Teva'];

  var PUBLICS = [
    ['client', 'Client'], ['groupement', 'Groupement'],
    ['prospect', 'Prospect'], ['achats', 'Achats']
  ];
  // Les trois publics commerciaux partagent le composeur par catégorie.
  var AVEC_COMPOSEUR = { client: 1, groupement: 1, prospect: 1 };

  var S = {
    mode: 'client', ph: null, grp: null, fam: 'all', q: '', sansRupture: false,
    page: 0, horsStock: false,
    sm: null,  // composition par catégorie, chargée au 1er rendu
    sel: null,  // { cip: 1 } — produits retenus pour le document
    doc: null,  // retouches du document (titre, ordre, lignes retirees, champs)
    apercu: false
  };
  var PAR_PAGE = 40;

  V2.produits = V2.produits || {};
  V2.produits.S = S;

  // ── Données ────────────────────────────────────────────────────
  V2.produits.index = function () {
    var M = window.V2PRODUITS;
    if (!M) return null;
    var sig = (V2.sales || []).length + ':' + (V2.pharmacies || []).length;
    if (V2.produits._idx && V2.produits._sig === sig) return V2.produits._idx;
    // Groupements canonisés AVANT indexation : sinon les variantes d'un même
    // groupement sont comptées comme des groupes différents.
    var offs = (V2.pharmacies || []).map(function (p) {
      return { id: p.id, name: p.name, cp: p.cp, ca: p.ca, ville: p.ville,
               groupement: canonGrp(p.groupement) };
    });
    V2.produits._idx = M.indexer(offs, V2.sales || []);
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
  function famDe(cip) { var f = fiche(cip); return f ? f.f : ''; }
  function enRupture(cip) {
    var R = window.RUPTURES && window.RUPTURES.data;
    return !!(R && R[String(cip)]);
  }
  function stockIP() { return (window.STOCK_IP && window.STOCK_IP.data) || {}; }

  // ── Groupements : nom canonique et logo ────────────────────────
  // L'app fusionne les variantes de noms via GRP_ALIAS. Sans ça, « UPP » (73
  // officines), « Pharm-Upp » (4) et « UPP ULTRA » (3) apparaissent comme trois
  // groupements distincts — et le logo, indexé sur « Pharm-Upp », ne sort jamais.
  function normCle(x) {
    var v = String(x == null ? '' : x).toLowerCase();
    if (v.normalize) v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return v.replace(/[^a-z0-9]/g, '');
  }
  function canonGrp(nom) {
    nom = String(nom == null ? '' : nom).trim();
    if (!nom) return '';
    if (V2.canonGrp) { try { return V2.canonGrp(nom) || nom; } catch (e) {} }
    var A = window.GRP_ALIAS || {};
    return A[normCle(nom)] || nom;
  }
  // Logos embarqués en local (base64) dans wml-officines-data.js. Indexés sur
  // le nom BRUT : on les réindexe sur le nom canonique normalisé.
  function logos() {
    if (V2.produits._logos) return V2.produits._logos;
    var src = window.GRP_LOGOS || {}, out = {}, k;
    for (k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var c = normCle(canonGrp(k));
      if (c && !out[c]) out[c] = src[k];
      var b = normCle(k);
      if (b && !out[b]) out[b] = src[k];
    }
    V2.produits._logos = out;
    return out;
  }
  // Image si on l'a, sinon pastille d'initiales — jamais de trou dans la mise
  // en page. Même principe que grpLogo() de v2-pharma.js.
  function logoGrp(nom, grand) {
    var cls = 'pr-logo' + (grand ? ' pr-logo-g' : '');
    var l = logos()[normCle(canonGrp(nom))];
    if (l) return '<span class="' + cls + '"><img src="' + esc(l) + '" alt=""></span>';
    var ini = String(nom || '?').replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ').trim().split(/\s+/)
      .slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    return '<span class="' + cls + ' pr-logo-x">' + esc(ini) + '</span>';
  }
  // Sous ce seuil, « 2 pharmacies le prennent » dessert l'argument : on se tait.
  var SEUIL_PREUVE = 10;

  // ── Recherche : une seule barre pour les officines ET les groupements ──
  // Taper ne doit JAMAIS relancer V2.render() : le champ perdrait le focus et
  // le clavier se refermerait sur iPhone. On ne rafraîchit que la liste.
  var MAX_OFF = 12, MAX_GRP = 4;
  var suggCourantes = [], suggSel = -1;

  function sansAccent(x) {
    var v = String(x == null ? '' : x).toLowerCase();
    if (v.normalize) v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return v;
  }
  function suggestions(q) {
    q = sansAccent(q).trim();
    if (!q) return [];
    var out = [], i;
    // Groupements d'abord : ils mènent à une liste entière, pas à une officine.
    var G = groupements();
    for (i = 0; i < G.noms.length && out.length < MAX_GRP; i++) {
      var n = G.noms[i];
      if (sansAccent(n).indexOf(q) < 0) continue;
      out.push({ type: 'grp', cle: n, titre: n, sous: G.n[n] + ' officines', logo: logoGrp(n) });
    }
    var phs = V2.pharmacies || [], nOff = 0;
    for (i = 0; i < phs.length && nOff < MAX_OFF; i++) {
      var p = phs[i];
      // ⚠️ ville et cp sont vides pour une partie du parc : on ne se repose
      // jamais dessus seul, le nom suffit toujours à retrouver une officine.
      var foin = sansAccent((p.name || '') + ' ' + (p.ville || '') + ' ' + (p.cp || ''));
      if (foin.indexOf(q) < 0) continue;
      var g = canonGrp(p.groupement);
      var sous = [p.ville || '', p.cp || '', g].filter(Boolean).join(' · ');
      out.push({ type: 'off', cle: String(p.id), titre: p.name || ('Officine ' + p.id),
                 sous: sous || 'officine', logo: g ? logoGrp(g) : '' });
      nOff++;
    }
    return out;
  }
  function suggHtml(liste) {
    if (!liste.length) return '';
    var h = '', i;
    for (i = 0; i < liste.length; i++) {
      var x = liste[i];
      h += '<button class="pr-sug' + (i === suggSel ? ' on' : '') +
        '" onmousedown="event.preventDefault()" onclick="V2.produits.rechChoisir(' + i + ')">' +
        (x.logo || '') +
        '<span class="pr-sug-m"><span class="pr-sug-t">' + esc(x.titre) + '</span>' +
        '<span class="pr-sug-s">' + esc(x.sous) + '</span></span>' +
        '<span class="pr-sug-k">' + (x.type === 'grp' ? 'groupement' : 'officine') + '</span></button>';
    }
    return h;
  }
  function rafraichirSugg() {
    var box = document.getElementById('pr-sugg');
    if (!box) return;
    box.innerHTML = suggHtml(suggCourantes);
    box.style.display = suggCourantes.length ? 'block' : 'none';
  }
  var tr = null;
  V2.produits.rechSaisie = function (v) {
    if (tr) clearTimeout(tr);
    tr = setTimeout(function () {
      suggCourantes = suggestions(v);
      suggSel = suggCourantes.length ? 0 : -1;
      rafraichirSugg();
    }, 180);
  };
  V2.produits.rechChoisir = function (i) {
    var x = suggCourantes[i];
    if (!x) return;
    suggCourantes = []; suggSel = -1;
    // Choisir un groupement bascule sur l'onglet Groupement, choisir une
    // officine sur l'onglet Client : la recherche pilote le mode.
    if (x.type === 'grp') { S.mode = 'groupement'; S.grp = x.cle; V2.produits._grpCle = null; }
    else { S.mode = 'client'; S.ph = x.cle; }
    S.page = 0;
    V2.render();
  };
  V2.produits.rechTouche = function (e) {
    if (!e) return;
    var k = e.key;
    if (k === 'Escape') { suggCourantes = []; suggSel = -1; rafraichirSugg(); return; }
    if (!suggCourantes.length) return;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      suggSel = (suggSel + (k === 'ArrowDown' ? 1 : -1) + suggCourantes.length) % suggCourantes.length;
      rafraichirSugg();
    } else if (k === 'Enter') {
      e.preventDefault();
      V2.produits.rechChoisir(suggSel < 0 ? 0 : suggSel);
    }
  };
  V2.produits.rechFermer = function () {
    setTimeout(function () { suggCourantes = []; suggSel = -1; rafraichirSugg(); }, 120);
  };

  // La barre, posée en tête des modes Client et Groupement.
  function barreRecherche(place) {
    return '<div class="pr-rech">' +
      '<div class="pr-search pr-rech-in">' + ICO('search', 16, 2) +
        '<input type="search" autocomplete="off" placeholder="' + escAttr(place) + '"' +
        ' oninput="V2.produits.rechSaisie(this.value)"' +
        ' onkeydown="V2.produits.rechTouche(event)"' +
        ' onblur="V2.produits.rechFermer()">' +
      '</div>' +
      '<div class="pr-sugg" id="pr-sugg" style="display:none"></div>' +
      '</div>';
  }

  // CIP de nos listes négociées : « OFFRE IP Générique » et « Offres
  // Privilèges IP » (crm/marketing-offers.js). 41 références, 35 en stock.
  function cipsExclusifs() {
    if (V2.produits._excl) return V2.produits._excl;
    var set = {}, O = window.MARKETING_IP_OFFERS || [], i, j;
    for (i = 0; i < O.length; i++) {
      if (!/Générique|Privilèges/i.test(String(O[i].title || ''))) continue;
      var pr = O[i].products || [];
      for (j = 0; j < pr.length; j++) {
        var c = String(pr[j].cip13 || pr[j].ean || '').replace(/\D/g, '');
        if (c) set[c] = 1;
      }
    }
    V2.produits._excl = set;
    return set;
  }
  // CIP → laboratoire. Génériques : GENERIQUEURS. Biosimilaires : la base
  // BIOSIMILAIRES, où chaque produit porte ses CIP.
  function laboParCip() {
    if (V2.produits._labo) return V2.produits._labo;
    var m = {}, G = window.GENERIQUEURS, c;
    if (G) {
      var d = G.data || G;
      for (c in d) {
        if (!Object.prototype.hasOwnProperty.call(d, c)) continue;
        var v = d[c];
        m[String(c)] = typeof v === 'string' ? v : (v && (v.labo || v.g)) || null;
      }
    }
    var BS = window.BIOSIMILAIRES, i, j, k;
    if (BS && BS.molecules) {
      for (i = 0; i < BS.molecules.length; i++) {
        var lst = BS.molecules[i].biosimilaires || [];
        for (j = 0; j < lst.length; j++) {
          var cips = lst[j].cips || [];
          for (k = 0; k < cips.length; k++) if (lst[j].labo) m[String(cips[k])] = lst[j].labo;
        }
      }
    }
    V2.produits._labo = m;
    return m;
  }
  function catalogue() {
    if (V2.produits._cat) return V2.produits._cat;
    var PS = window.PROD_STATS || [], ST = stockIP();
    var R = (window.RUPTURES && window.RUPTURES.data) || {};
    var EX = cipsExclusifs(), LB = laboParCip();
    var out = [], i;
    for (i = 0; i < PS.length; i++) {
      var r = PS[i], c = String(r.c);
      out.push({ cip: c, fam: r.f, n: +r.n || 0, ppht: +r.ppht || 0,
                 stock: +ST[c] || 0, rupture: !!R[c],
                 labo: LB[c] || null, exclusif: !!EX[c] });
    }
    V2.produits._cat = out;
    return out;
  }

  // ── Composition par catégorie ──────────────────────────────────
  var PRESETS = {
    decouverte: { l: 'Découverte', q: { pr_low: 50, pr_mid: 20, pr_high: 5, nr: 10, gen: 20, biosim: 0 }, a: { pr_low: 8 } },
    petitsprix: { l: 'Petits prix', q: { pr_low: 80, pr_mid: 0, pr_high: 0, nr: 0, gen: 0, biosim: 0 }, a: { pr_low: 8 } },
    large:      { l: 'Large', q: { pr_low: 40, pr_mid: 40, pr_high: 10, nr: 30, gen: 40, biosim: 10 }, a: {} }
  };
  function smDefaut() {
    var p = PRESETS.decouverte;
    return {
      quotas: JSON.parse(JSON.stringify(p.q)), abandonMin: JSON.parse(JSON.stringify(p.a)),
      labos: {}, exclusifs: {}, nom: '', plie: false
    };
  }
  // Toute composition qui entre ici est normalisée : un réglage tronqué ne
  // doit JAMAIS produire un écran blanc en rendez-vous.
  function smNormaliser(b) {
    var d = smDefaut(), i, k;
    if (!b || typeof b !== 'object') return d;
    if (!b.quotas || typeof b.quotas !== 'object') b.quotas = d.quotas;
    if (!b.abandonMin || typeof b.abandonMin !== 'object') b.abandonMin = {};
    if (!b.labos || typeof b.labos !== 'object') b.labos = {};
    if (!b.exclusifs || typeof b.exclusifs !== 'object') b.exclusifs = {};
    for (k in b.labos) {
      if (Object.prototype.hasOwnProperty.call(b.labos, k) && !Array.isArray(b.labos[k])) b.labos[k] = [];
    }
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

  // ── Sélection : quels produits partent dans le document ────────
  // Pas de quantité : ce qui se règle, c'est le NOMBRE de meilleurs produits
  // par catégorie (le composeur). Ici on ne fait qu'inclure ou exclure.
  function selCharger() {
    try {
      var b = JSON.parse(localStorage.getItem('produits.selection')), out = {}, c;
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        for (c in b) if (Object.prototype.hasOwnProperty.call(b, c)) out[String(c)] = 1;
      }
      return out;
    } catch (e) { return {}; }
  }
  function selSauver() {
    try { localStorage.setItem('produits.selection', JSON.stringify(S.sel)); } catch (e) {}
  }
  function selNb() {
    var n = 0, c;
    for (c in S.sel) if (Object.prototype.hasOwnProperty.call(S.sel, c)) n++;
    return n;
  }

  // ── Commandes appelées depuis le HTML ──────────────────────────
  V2.produits.setMode = function (m) { S.mode = m; S.page = 0; V2.render(); };
  V2.produits.setPh = function (id) { S.ph = id || null; S.page = 0; V2.render(); };
  V2.produits.setGrp = function (g) { S.grp = g || null; S.page = 0; V2.produits._ach = null; V2.render(); };
  V2.produits.setFam = function (k) { S.fam = k; S.page = 0; V2.render(); };
  V2.produits.setRupt = function () { S.sansRupture = !S.sansRupture; S.page = 0; V2.render(); };
  V2.produits.setHorsStock = function () { S.horsStock = !S.horsStock; S.page = 0; V2.produits._ach = null; V2.render(); };
  V2.produits.plus = function () { S.page += 1; V2.render(); };
  var tq = null;
  V2.produits.setQ = function (v) {
    S.q = v || '';
    if (tq) clearTimeout(tq);
    tq = setTimeout(function () { S.page = 0; V2.render(); }, 220);
  };
  V2.produits.smQuota = function (fam, delta) {
    S.sm.quotas[fam] = Math.max(0, Math.min(300, (+S.sm.quotas[fam] || 0) + delta));
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
  V2.produits.smLabo = function (fam, nom) {
    var l = S.sm.labos[fam] || (S.sm.labos[fam] = []);
    var i = l.indexOf(nom);
    if (i >= 0) l.splice(i, 1); else l.push(nom);
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smLabosTous = function (fam) { S.sm.labos[fam] = []; S.page = 0; smSauver(); V2.render(); };
  V2.produits.smPartenaires = function (fam) {
    var l = S.sm.labos[fam] || [];
    var memes = l.length === PARTENAIRES.length &&
      PARTENAIRES.every(function (p) { return l.indexOf(p) >= 0; });
    S.sm.labos[fam] = memes ? [] : PARTENAIRES.slice();
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smExclusif = function (fam) {
    S.sm.exclusifs[fam] = !S.sm.exclusifs[fam];
    S.page = 0; smSauver(); V2.render();
  };
  V2.produits.smPlier = function () { S.sm.plie = !S.sm.plie; smSauver(); V2.render(); };
  V2.produits.smPreset = function (k) {
    var p = PRESETS[k]; if (!p) return;
    S.sm.quotas = JSON.parse(JSON.stringify(p.q));
    S.sm.abandonMin = JSON.parse(JSON.stringify(p.a));
    S.sm.labos = {}; S.sm.exclusifs = {};
    S.page = 0; smSauver(); V2.render();
  };
  var tn = null;
  V2.produits.smNom = function (v) {
    S.sm.nom = v || '';
    if (tn) clearTimeout(tn);
    tn = setTimeout(smSauver, 400);
  };
  V2.produits.selBascule = function (cip) {
    cip = String(cip);
    if (S.sel[cip]) delete S.sel[cip]; else S.sel[cip] = 1;
    selSauver(); V2.render();
  };
  V2.produits.selVider = function () { S.sel = {}; selSauver(); V2.render(); };

  // ── Filtres d'affichage ────────────────────────────────────────
  function filtrer(lignes) {
    var q = S.q.trim().toLowerCase(), out = [], i;
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
  // Les listes « trou vs confrères » ne portent pas la famille : on l'ajoute
  // pour pouvoir leur appliquer le composeur comme à un prospect.
  function avecFamille(lignes) {
    var out = [], i;
    for (i = 0; i < lignes.length; i++) {
      var l = lignes[i];
      out.push(l.fam ? l : {
        cip: l.cip, fam: famDe(l.cip), peers: l.peers, pctPeers: l.pctPeers,
        caMoyen: l.caMoyen, potentiel: l.potentiel, stock: l.stock,
        officines: l.officines, couverture: l.couverture
      });
    }
    return out;
  }

  // ── Briques de rendu ───────────────────────────────────────────
  function chiffre(v, lib, cls) {
    return '<div class="' + (cls || '') + '"><span>' + v + '</span><em>' + lib + '</em></div>';
  }
  function vide(t, d) {
    return '<div class="v2-empty"><div class="v2-empty-t">' + esc(t) + '</div>' +
      '<div class="v2-empty-d">' + esc(d) + '</div></div>';
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
  function boutonSel(cip) {
    var c = escAttr(cip), pris = !!S.sel[String(cip)];
    return '<button class="pr-add' + (pris ? ' on' : '') +
      '" onclick="V2.produits.selBascule(\'' + c + '\')">' +
      (pris ? '✓ Dans le document' : '+ Ajouter au document') + '</button>';
  }
  function liste(lignes, visibles, corps) {
    if (!lignes.length) {
      return vide('Aucun produit avec ces filtres', 'Élargis la recherche ou change de catégorie.');
    }
    return '<div class="pr-liste">' + corps + '</div>' +
      (visibles.length < lignes.length
        ? '<button class="v2-btn pr-plus" onclick="V2.produits.plus()">Voir 40 produits de plus</button>'
        : '');
  }
  function rendreLignes(lignes, fn) {
    // Le document reprend TOUTE la liste filtree, pas seulement la page visible.
    V2.produits._affichees = lignes;
    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '', i;
    for (i = 0; i < visibles.length; i++) corps += fn(visibles[i]);
    return { visibles: visibles, corps: corps };
  }

  // ── Le composeur, partagé par les trois publics ────────────────
  function ligneLabos(fam) {
    if (!LABOS_FAM[fam] || !(+S.sm.quotas[fam] > 0)) return '';
    var M = window.V2PRODUITS;
    var choisis = S.sm.labos[fam] || [];
    var dispo = M.labosDisponibles(catalogue(), fam).slice(0, NB_LABOS_AFFICHES);
    if (!dispo.length) return '';
    var q = function (v) { return String(v).replace(/[\\'"<>&]/g, ''); };
    var c = '<span class="pr-chip sm-lab' + (choisis.length ? '' : ' on') +
      '" onclick="V2.produits.smLabosTous(\'' + fam + '\')">Tous</span>';
    if (fam === 'gen') {
      var memes = choisis.length === PARTENAIRES.length &&
        PARTENAIRES.every(function (p) { return choisis.indexOf(p) >= 0; });
      c += '<span class="pr-chip sm-lab' + (memes ? ' on' : '') +
        '" onclick="V2.produits.smPartenaires(\'gen\')">Partenaires</span>' +
        '<span class="pr-chip sm-lab sm-excl' + (S.sm.exclusifs.gen ? ' on' : '') +
        '" onclick="V2.produits.smExclusif(\'gen\')">Exclusivités</span>';
    }
    for (var i = 0; i < dispo.length; i++) {
      c += '<span class="pr-chip sm-lab' + (choisis.indexOf(dispo[i].nom) >= 0 ? ' on' : '') +
        '" onclick="V2.produits.smLabo(\'' + fam + '\',\'' + q(dispo[i].nom) + '\')">' +
        esc(dispo[i].nom) + ' <em>' + dispo[i].n + '</em></span>';
    }
    return '<div class="pr-chips pr-defile sm-labos">' + c + '</div>';
  }
  function ligneComposeur(fam, dispo) {
    var q = +S.sm.quotas[fam] || 0;
    // Rouge UNIQUEMENT si la categorie est demandee et qu'il n'y a rien du
    // tout : demander 50 quand il en existe 5 n'est pas une erreur, on prend
    // les 5. Tout peindre en rouge rendrait l'alerte invisible.
    var manque = dispo != null && q > 0 && dispo === 0;
    var sel;
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
    return '<div class="sm-row">' +
      '<div class="sm-fam"><span class="sm-dot" style="background:' + FAM[fam].c + '"></span>' +
        esc(FAM[fam].l) +
        (dispo != null ? '<em class="' + (manque ? 'sm-manque' : '') + '">' + num(dispo) + ' dispo</em>' : '') +
      '</div>' +
      '<div class="sm-ctl">' +
        '<button class="sm-b" aria-label="Moins" onclick="V2.produits.smQuota(\'' + fam + '\',-5)">–</button>' +
        '<input class="sm-n" inputmode="numeric" value="' + q + '" onchange="V2.produits.smQuotaSet(\'' + fam + '\',this.value)">' +
        '<button class="sm-b" aria-label="Plus" onclick="V2.produits.smQuota(\'' + fam + '\',5)">+</button>' +
        sel +
      '</div>' +
      ligneLabos(fam) +
      '</div>';
  }
  // `dispo` : nombre de références éligibles par catégorie. Connu pour un
  // prospect (le moteur le rend) ; pour un client ou un groupement on compte
  // les lignes de sa propre liste avant limitation.
  function composeurHtml(dispo) {
    var M = window.V2PRODUITS, i, k;
    var resume = [];
    for (i = 0; i < FAM_ORDRE.length; i++) {
      k = FAM_ORDRE[i];
      if (+S.sm.quotas[k] > 0) resume.push(S.sm.quotas[k] + ' ' + FAM_COURT[k]);
    }
    var entete = '<button class="sm-plier" onclick="V2.produits.smPlier()">' +
      (S.sm.plie ? '▸ Régler la liste' : '▾ Replier le réglage') +
      '<em>' + esc(resume.length ? resume.join(' · ') : 'aucune catégorie') + '</em></button>';
    if (S.sm.plie) return entete;
    var comp = '';
    for (i = 0; i < M.FAMILLES.length; i++) {
      comp += ligneComposeur(M.FAMILLES[i], dispo ? (dispo[M.FAMILLES[i]] || 0) : null);
    }
    var presets = '';
    for (k in PRESETS) {
      if (!Object.prototype.hasOwnProperty.call(PRESETS, k)) continue;
      presets += '<span class="pr-chip" onclick="V2.produits.smPreset(\'' + k + '\')">' + esc(PRESETS[k].l) + '</span>';
    }
    return entete + '<div class="pr-chips sm-presets">' + presets + '</div>' +
      '<div class="sm-grille">' + comp + '</div>';
  }
  function compterParFamille(lignes) {
    var d = {}, i;
    for (i = 0; i < FAM_ORDRE.length; i++) d[FAM_ORDRE[i]] = 0;
    for (i = 0; i < lignes.length; i++) if (d[lignes[i].fam] !== undefined) d[lignes[i].fam]++;
    return d;
  }

  function filtresHtml() {
    // Les catégories se choisissent déjà dans le composeur : des puces de
    // famille en dessous seraient redondantes et contradictoires.
    var fams = '';
    if (!AVEC_COMPOSEUR[S.mode]) {
      var chips = '<span class="pr-chip' + (S.fam === 'all' ? ' on' : '') +
        '" onclick="V2.produits.setFam(\'all\')">Toutes familles</span>', i, k;
      for (i = 0; i < FAM_ORDRE.length; i++) {
        k = FAM_ORDRE[i];
        chips += '<span class="pr-chip' + (S.fam === k ? ' on' : '') +
          '" onclick="V2.produits.setFam(\'' + k + '\')">' + esc(FAM[k].l) + '</span>';
      }
      fams = '<div class="pr-chips pr-defile">' + chips + '</div>';
    }
    return '<div class="pr-filtres">' +
      '<div class="pr-search">' + ICO('search', 16, 2) +
        '<input placeholder="Produit ou CIP…" value="' + escAttr(S.q) +
        '" oninput="V2.produits.setQ(this.value)">' +
      '</div>' + fams +
      '<div class="pr-chips">' +
        '<span class="pr-chip' + (S.sansRupture ? ' on' : '') +
        '" onclick="V2.produits.setRupt()">Masquer les ruptures ANSM</span>' +
      '</div></div>';
  }

  function actionsHtml(sousTitre) {
    return '<button class="v2-btn v2-btn-primary pr-pdf" onclick="V2.produits.apercu(true)">Voir et retoucher le document</button>' +
      '<button class="v2-btn pr-mail" onclick="V2.produits.documentPdf()">Sortir le PDF</button>' +
      '<button class="v2-btn pr-mail" onclick="V2.produits.documentMail()">Par mail</button>' +
      '<div class="pr-source">' + esc(sousTitre) + '</div>';
  }

  // ── Mode Client ────────────────────────────────────────────────
  function ligneClient(l) {
    var f = fiche(l.cip);
    var abandon = (f && porteAbandon(f.f) && f.ppht > 0 && f.net > 0) ? eur(f.ppht - f.net) : '—';
    return '<div class="pr-row">' + enTeteProduit(l) +
      '<div class="pr-arg">' + (l._logo || '') +
        '<strong>' + num(l.peers) + ' des ' + num(l._nbConf) + '</strong> ' + esc(l._grp) +
        ' le prennent · <strong>' + eur(l.caMoyen) + '</strong> en moyenne</div>' +
      '<div class="pr-chiffres">' +
        chiffre(eur(l.potentiel), 'potentiel', 'pr-pot') +
        chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
        chiffre(abandon, 'abandon de marge') +
        chiffre(num(l.stock), 'en stock') +
      '</div>' + boutonSel(l.cip) + '</div>';
  }
  function rendreClient() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');
    var phs = (V2.pharmacies || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    if (!phs.length) return vide('Aucune officine', 'Les données réseau ne sont pas chargées.');
    if (!S.ph) S.ph = String(phs[0].id);

    var i;
    var r = M.listingOfficine(idx, S.ph, { stock: stockIP() });
    var libGrp = r.groupe ? r.groupe.libelle : 'confrères';
    var brutes = filtrer(avecFamille(r.lignes));
    var dispo = compterParFamille(brutes);
    var lignes = M.limiterParCategorie(brutes, S.sm.quotas);
    // Le logo n'a de sens que pour un vrai groupement : sur le chemin de repli
    // (« officines comparables »), il n'y a pas de marque à montrer.
    var nomGrp = (idx.officines[String(S.ph)] || {}).groupement || '';
    var estGrp = !!(r.groupe && r.groupe.type === 'groupement' && nomGrp);
    var logoH = estGrp ? logoGrp(nomGrp) : '';
    for (i = 0; i < lignes.length; i++) {
      lignes[i]._grp = libGrp; lignes[i]._nbConf = r.nbConfreres; lignes[i]._logo = logoH;
    }
    var pot = 0;
    for (i = 0; i < lignes.length; i++) pot += lignes[i].potentiel;

    var noteSeuil = (r.seuil != null && r.seuil < M.SEUIL_PEERS)
      ? '<div class="pr-note">Comparaison élargie : cette officine a peu de confrères actifs, ' +
        'le seuil est descendu à ' + Math.round(r.seuil * 100) + ' %.</div>' : '';
    var rl = rendreLignes(lignes, ligneClient);

    return '<div class="pr-bandeau">' +
      barreRecherche('Officine ou groupement — nom, ville, code postal…') +
      '<div class="pr-cible">' + esc(nomCible() || '—') + '</div>' +
      '<div class="pr-ctx">' +
        '<span class="pr-ctx-grp">' + (estGrp ? logoGrp(nomGrp) : '') +
          num(r.nbConfreres) + ' ' + esc(libGrp) + '</span>' +
        '<span class="pr-ctx-pot">' + eur(pot) + ' de potentiel</span>' +
        '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
      '</div>' + noteSeuil + suiviHtml() + composeurHtml(dispo) +
      actionsHtml('ventes réseau jan.–juin 2026') +
      '</div>' + filtresHtml() + liste(lignes, rl.visibles, rl.corps) + panierHtml();
  }

  // ── Mode Groupement ────────────────────────────────────────────
  function ligneGroupement(l) {
    var f = fiche(l.cip);
    var abandon = (f && porteAbandon(f.f) && f.ppht > 0 && f.net > 0) ? eur(f.ppht - f.net) : '—';
    return '<div class="pr-row">' + enTeteProduit(l) +
      '<div class="pr-arg">' + (l._logo || '') +
        '<strong>' + num(l.officines) + ' adhérents sur ' + num(l._taille) + '</strong>' +
        ' ne nous le prennent pas' +
        (l._pris > 0 ? ' · <strong>' + num(l._pris) + '</strong> le prennent déjà' : '') + '</div>' +
      '<div class="pr-chiffres">' +
        chiffre(eur(l.potentiel), 'potentiel', 'pr-pot') +
        chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
        chiffre(abandon, 'abandon de marge') +
        chiffre(num(l.stock), 'en stock') +
      '</div>' + boutonSel(l.cip) + '</div>';
  }
  function groupements() {
    var vus = {}, phs = V2.pharmacies || [], i, g;
    for (i = 0; i < phs.length; i++) {
      g = canonGrp(phs[i].groupement);
      if (g) vus[g] = (vus[g] || 0) + 1;
    }
    var noms = Object.keys(vus).sort(function (a, b) { return vus[b] - vus[a]; });
    return { noms: noms, n: vus };
  }
  function rendreGroupement() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');
    var G = groupements();
    if (!G.noms.length) return vide('Aucun groupement', 'Les données réseau ne sont pas chargées.');
    if (!S.grp || G.n[S.grp] === undefined) S.grp = G.noms[0];

    var i;
    // Même moteur que la vue Achats, filtré sur le groupement : agrège les
    // trous de tous ses adhérents.
    var cle = 'g:' + S.grp;
    if (V2.produits._grpCle !== cle) {
      V2.produits._grpLignes = M.listingProduits(idx, { stock: stockIP(), filtreGroupement: S.grp });
      V2.produits._grpCle = cle;
    }
    var brutes = filtrer(avecFamille(V2.produits._grpLignes));
    var dispo = compterParFamille(brutes);
    var lignes = M.limiterParCategorie(brutes, S.sm.quotas);
    var logoH = logoGrp(S.grp), taille = G.n[S.grp] || 0, pot = 0;
    for (i = 0; i < lignes.length; i++) {
      lignes[i]._logo = logoH;
      lignes[i]._taille = taille;
      // Combien d'adhérents le prennent DÉJÀ : l'autre moitié de l'argument.
      lignes[i]._pris = M.penetration(idx, lignes[i].cip, S.grp).n;
      pot += lignes[i].potentiel;
    }
    var rl = rendreLignes(lignes, ligneGroupement);

    return '<div class="pr-bandeau">' +
      barreRecherche('Groupement ou officine — nom, ville, code postal…') +
      '<div class="pr-cible">' + logoGrp(S.grp, true) + esc(S.grp) + '</div>' +
      '<div class="pr-ctx">' +
        '<span class="pr-ctx-grp">' + num(taille) + ' adhérents</span>' +
        '<span class="pr-ctx-pot">' + eur(pot) + ' de potentiel</span>' +
        '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
      '</div>' + composeurHtml(dispo) +
      actionsHtml('ventes réseau jan.–juin 2026') +
      '</div>' + filtresHtml() + liste(lignes, rl.visibles, rl.corps) + panierHtml();
  }

  // ── Mode Prospect ──────────────────────────────────────────────
  function ligneProspect(l) {
    var fam = FAM[l.fam];
    var ab = l.abandon == null ? null : l.abandon;
    return '<div class="pr-row">' +
      '<div class="pr-lib">' + esc((fiche(l.cip) || {}).d || ('CIP ' + l.cip)) +
        (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
        (l.rupture ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
      '</div>' +
      '<div class="pr-arg">' +
        (l.n >= SEUIL_PREUVE
          ? '<strong>' + num(l.n) + ' des ' + num(l._reseau) + '</strong> officines du réseau nous le prennent'
          : 'Référence de niche') +
        (ab != null ? ' · <strong>+' + eur(ab) + ' par boîte</strong> pour le pharmacien (' +
          (Math.round(l.abandonPct * 10) / 10).toString().replace('.', ',') + ' %)' : '') + '</div>' +
      '<div class="pr-chiffres">' +
        chiffre(eur(l.net), 'prix net', 'pr-pot') +
        chiffre(ab == null ? '—' : '+' + eur(ab), 'abandon de marge') +
        chiffre(eur(l.ppht), 'tarif') +
        chiffre(num(l.stock), 'en stock') +
      '</div>' + boutonSel(l.cip) + '</div>';
  }
  function rendreProspect() {
    var M = window.V2PRODUITS;
    if (!M || !M.listeSurMesure) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas à jour.');
    if (!(window.PROD_STATS || []).length) return vide('Catalogue indisponible', 'Les données produits ne sont pas chargées.');
    var r = M.listeSurMesure(catalogue(), {
      quotas: S.sm.quotas, abandonMin: S.sm.abandonMin, sansRupture: S.sansRupture,
      labos: S.sm.labos, exclusifs: S.sm.exclusifs
    });
    var lignes = filtrer(r.lignes), reseau = (V2.pharmacies || []).length, i;
    for (i = 0; i < lignes.length; i++) lignes[i]._reseau = reseau;
    var rl = rendreLignes(lignes, ligneProspect);
    return '<div class="pr-bandeau">' +
      '<input class="pr-select sm-nom" placeholder="Nom de l\'officine (pour le PDF)" value="' +
        escAttr(S.sm.nom) + '" oninput="V2.produits.smNom(this.value)">' +
      composeurHtml(r.dispo) +
      '<div class="pr-ctx"><span class="pr-ctx-pot">' + num(lignes.length) + ' produits dans la liste</span></div>' +
      actionsHtml('catalogue Intégral · uniquement ce qui est en stock') +
      '</div>' + filtresHtml() + liste(lignes, rl.visibles, rl.corps) + panierHtml();
  }

  // ── Mode Achats (équipe achats, pas un public client) ──────────
  function generiqueur(cip) {
    var G = window.GENERIQUEURS;
    if (!G) return '';
    var d = G.data || G, e = d[String(cip)];
    if (!e) return '';
    return typeof e === 'string' ? e : (e.labo || e.g || '');
  }
  function ligneAchat(l) {
    var f = fiche(l.cip), g = generiqueur(l.cip);
    var couv = l.couverture == null ? '—'
      : (l.couverture >= 24 ? '> 24 mois'
        : (Math.round(l.couverture * 10) / 10).toString().replace('.', ',') + ' mois');
    return '<div class="pr-row">' + enTeteProduit(l) +
      '<div class="pr-arg"><strong>' + num(l.officines) + ' officines</strong> ne nous le prennent pas' +
        (g ? ' · ' + esc(g) : '') + '</div>' +
      '<div class="pr-chiffres">' +
        chiffre(eur(l.potentiel), 'potentiel réseau', 'pr-pot') +
        chiffre(num(l.stock), 'en stock') +
        chiffre(esc(couv), 'couverture') +
        chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
      '</div></div>';
  }
  function rendreAchats() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');
    // 691 listings coûtent ~600 ms : on mémorise tant que le filtre de fond
    // ne bouge pas (la recherche et les familles filtrent en aval).
    var cle = (S.horsStock ? 'hs' : 'st');
    if (V2.produits._achCle !== cle || !V2.produits._ach) {
      var l = M.listingProduits(idx, { stock: stockIP(), exigerStock: !S.horsStock });
      if (S.horsStock) l = l.filter(function (x) { return !(x.stock > 0); });
      V2.produits._ach = l;
      V2.produits._achCle = cle;
    }
    var lignes = filtrer(V2.produits._ach), i, total = 0;
    for (i = 0; i < lignes.length; i++) total += lignes[i].potentiel;
    var rl = rendreLignes(lignes, ligneAchat);
    return '<div class="pr-bandeau">' +
      '<div class="pr-ctx">' +
        '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
        '<span class="pr-ctx-pot">' + eur(total) + ' de potentiel réseau</span>' +
      '</div>' +
      '<div class="pr-chips"><span class="pr-chip' + (S.horsStock ? ' on' : '') +
        '" onclick="V2.produits.setHorsStock()">Uniquement ce qu\'on n\'a pas</span></div>' +
      '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' + filtresHtml() + liste(lignes, rl.visibles, rl.corps);
  }

  // ── Mémoire des propositions et suivi d'effet ──────────────────
  // On n'enregistre PAS une date mais le dernier mois présent dans les
  // données au moment de la proposition : le fichier mensuel arrive avec du
  // retard, c'est son avancement qui dit si un produit est entré depuis.
  function propsCharger() {
    try {
      var b = JSON.parse(localStorage.getItem('produits.propositions'));
      return Array.isArray(b) ? b : [];
    } catch (e) { return []; }
  }
  function propsEnregistrer(cips) {
    if (S.mode !== 'client' || !S.ph || !cips.length) return;   // prospect : rien à suivre
    var idx = V2.produits.index();
    if (!idx) return;
    var liste = propsCharger();
    liste.unshift({
      ph: String(S.ph), nom: nomCible(), cips: cips.slice(),
      moisBase: idx.moisMax || 0, date: new Date().toISOString().slice(0, 10)
    });
    try { localStorage.setItem('produits.propositions', JSON.stringify(liste.slice(0, 50))); } catch (e) {}
  }
  function jourCourt(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : String(iso || '');
  }
  function suiviHtml() {
    if (S.mode !== 'client' || !S.ph) return '';
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx || !M.suiviProposition) return '';
    var liste = propsCharger(), i, out = '';
    for (i = 0; i < liste.length && out.length < 3000; i++) {
      var p = liste[i];
      if (String(p.ph) !== String(S.ph)) continue;
      var r = M.suiviProposition(idx, S.ph, p.cips, p.moisBase);
      var phrase = r.moisRecus <= 0
        ? 'en attente du prochain fichier de ventes'
        : '<strong>' + num(r.entres.length) + ' produit' + (r.entres.length > 1 ? 's' : '') +
          '</strong> sur ' + num(r.total) + ' sont entrés en commande depuis';
      out += '<div class="pr-suivi"><b>Proposition du ' + esc(jourCourt(p.date)) + '</b> · ' + phrase +
        (r.dejaPris.length ? ' <em>(' + num(r.dejaPris.length) + ' déjà pris avant)</em>' : '') + '</div>';
    }
    return out;
  }

  // ── Le document laissé au pharmacien ───────────────────────────
  function nomCible() {
    if (S.mode === 'prospect') return (S.sm && S.sm.nom) || '';
    if (S.mode === 'groupement') return S.grp || '';
    var phs = V2.pharmacies || [], i;
    for (i = 0; i < phs.length; i++) if (String(phs[i].id) === String(S.ph)) return phs[i].name || '';
    return '';
  }
  // Les CIP du document : la sélection si elle existe, sinon toute la liste
  // affichée. Aucune quantité — ce qui se règle, c'est le nombre de meilleurs
  // produits par catégorie.
  function documentBase() {
    var n = selNb(), out = [], c, i;
    if (n) {
      for (c in S.sel) if (Object.prototype.hasOwnProperty.call(S.sel, c)) out.push(String(c));
      return out;
    }
    var l = V2.produits._affichees || [];
    for (i = 0; i < l.length; i++) out.push(String(l[i].cip));
    return out;
  }

  // ── Retouches du document ──────────────────────────────────────
  // Le commercial peut réécrire un libellé, corriger un prix, retirer ou
  // déplacer une ligne, changer le titre. Ces retouches vivent à part de la
  // liste calculée : on peut toujours « repartir de la liste » sans rien perdre.
  function docDefaut() { return { titre: null, ordre: null, retires: {}, champs: {} }; }
  function docCharger() {
    try {
      var b = JSON.parse(localStorage.getItem('produits.document'));
      if (!b || typeof b !== 'object') return docDefaut();
      return {
        titre: typeof b.titre === 'string' ? b.titre : null,
        ordre: Array.isArray(b.ordre) ? b.ordre.map(String) : null,
        retires: (b.retires && typeof b.retires === 'object') ? b.retires : {},
        champs: (b.champs && typeof b.champs === 'object') ? b.champs : {}
      };
    } catch (e) { return docDefaut(); }
  }
  function docSauver() {
    try { localStorage.setItem('produits.document', JSON.stringify(S.doc)); } catch (e) {}
  }

  // Les CIP du document : la sélection si elle existe, sinon toute la liste
  // affichée — puis les retouches (lignes retirées, ordre imposé).
  function documentCips() {
    var base = documentBase(), vus = {}, out = [], i, c;
    for (i = 0; i < base.length; i++) vus[base[i]] = 1;
    if (S.doc.ordre) {
      // On garde l'ordre choisi pour ce qui est encore dans la liste, puis on
      // ajoute à la fin ce qui est apparu depuis.
      for (i = 0; i < S.doc.ordre.length; i++) {
        c = S.doc.ordre[i];
        if (vus[c] && !S.doc.retires[c] && out.indexOf(c) < 0) out.push(c);
      }
      for (i = 0; i < base.length; i++) {
        if (!S.doc.retires[base[i]] && out.indexOf(base[i]) < 0) out.push(base[i]);
      }
      return out;
    }
    for (i = 0; i < base.length; i++) if (!S.doc.retires[base[i]]) out.push(base[i]);
    return out;
  }
  function docLibelle(cip) {
    var r = S.doc.champs[cip];
    if (r && typeof r.d === 'string' && r.d.trim()) return r.d;
    var f = fiche(cip);
    return f && f.d ? f.d : ('CIP ' + cip);
  }
  function docNet(cip) {
    var r = S.doc.champs[cip];
    if (r && typeof r.net === 'number' && isFinite(r.net) && r.net >= 0) return r.net;
    var M = window.V2PRODUITS, f = fiche(cip), ppht = f ? +f.ppht || 0 : 0;
    // Prospect : le net vient du BARÈME, ce à quoi il a droit. Client et
    // groupement : le net réel du réseau, déjà négocié.
    if (S.mode === 'prospect') {
      return (M && M.porteAbandon(f && f.f) && ppht > 0)
        ? Math.round((ppht - M.bareme(ppht)) * 100) / 100 : ppht;
    }
    return (f && f.net > 0) ? f.net : null;
  }
  function docTitre() {
    if (typeof S.doc.titre === 'string' && S.doc.titre.trim()) return S.doc.titre;
    return nomCible() || 'Sélection Intégral Pharma';
  }

  V2.produits.docTitreSet = function (v) {
    S.doc.titre = String(v || '').trim() || null; docSauver(); V2.render();
  };
  V2.produits.docChamp = function (cip, champ, valeur) {
    cip = String(cip);
    var r = S.doc.champs[cip] || (S.doc.champs[cip] = {});
    if (champ === 'net') {
      // « 1,25 € » → 1.25 ; vide ou illisible → on reprend la valeur calculée.
      var n = parseFloat(String(valeur).replace(/[^0-9,.-]/g, '').replace(',', '.'));
      if (isFinite(n) && n >= 0) r.net = Math.round(n * 100) / 100; else delete r.net;
    } else {
      var t = String(valeur || '').trim();
      if (t) r.d = t.slice(0, 90); else delete r.d;
    }
    if (!r.d && r.net === undefined) delete S.doc.champs[cip];
    docSauver(); V2.render();
  };
  V2.produits.docRetirer = function (cip) {
    S.doc.retires[String(cip)] = 1; docSauver(); V2.render();
  };
  V2.produits.docDeplacer = function (cip, sens) {
    var l = documentCips(), i = l.indexOf(String(cip)), j = i + sens;
    if (i < 0 || j < 0 || j >= l.length) return;
    var t = l[i]; l[i] = l[j]; l[j] = t;
    S.doc.ordre = l; docSauver(); V2.render();
  };
  V2.produits.docReset = function () {
    S.doc = docDefaut(); docSauver(); V2.render();
  };
  V2.produits.docRetouche = function () {
    var d = S.doc, n = 0, c;
    for (c in d.retires) if (Object.prototype.hasOwnProperty.call(d.retires, c)) n++;
    for (c in d.champs) if (Object.prototype.hasOwnProperty.call(d.champs, c)) n++;
    if (d.titre) n++;
    if (d.ordre) n++;
    return n;
  };
  // Saisie directe dans l'aperçu : on lit l'élément au moment où il perd le
  // focus. Pas de double-clic — il n'existe pas au doigt.
  V2.produits.docSaisie = function (el) {
    if (!el) return;
    var cip = el.getAttribute('data-cip'), champ = el.getAttribute('data-champ');
    var v = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (champ === 'titre') V2.produits.docTitreSet(v);
    else if (cip) V2.produits.docChamp(cip, champ, v);
  };
  V2.produits.apercu = function (on) { S.apercu = !!on; V2.render(); };
  // Le corps du document : les mêmes lignes à l'écran et au PDF. `edit` ajoute
  // la saisie directe et les boutons de retouche — le PDF n'en porte jamais.
  function docLignes(edit) {
    var cips = documentCips();
    if (!cips.length) return null;
    // Regroupé dans le vocabulaire du PHARMACIEN : nos trois tranches de
    // princeps n'ont de sens que pour nous.
    var BLOCS = [
      { t: 'Médicaments remboursables', f: ['pr_low', 'pr_mid', 'pr_high'] },
      { t: 'Non remboursables', f: ['nr'] },
      { t: 'Génériques', f: ['gen'] },
      { t: 'Biosimilaires', f: ['biosim'] }
    ];
    var rows = '', b, i, n = 0, cols = edit ? 4 : 3;
    for (b = 0; b < BLOCS.length; b++) {
      var dedans = [];
      for (i = 0; i < cips.length; i++) if (BLOCS[b].f.indexOf(famDe(cips[i])) >= 0) dedans.push(cips[i]);
      if (!dedans.length) continue;
      rows += '<tr class="bloc"><td colspan="' + cols + '">' + esc(BLOCS[b].t) +
        ' <span>' + dedans.length + '</span></td></tr>';
      for (i = 0; i < dedans.length; i++) {
        var c = dedans[i], net = docNet(c), q = escAttr(c);
        var lib = edit
          ? '<span class="ed" contenteditable="true" data-cip="' + q + '" data-champ="d"' +
            ' onblur="V2.produits.docSaisie(this)">' + esc(docLibelle(c)) + '</span>'
          : esc(docLibelle(c));
        var prix = edit
          ? '<span class="ed" contenteditable="true" data-cip="' + q + '" data-champ="net"' +
            ' onblur="V2.produits.docSaisie(this)">' + (net > 0 ? eur(net) : '—') + '</span>'
          : (net > 0 ? eur(net) : '—');
        rows += '<tr><td>' + lib + '</td>' +
          '<td class="n">' + esc(c) + '</td>' +
          '<td class="n">' + prix + '</td>' +
          (edit ? '<td class="act">' +
            '<button title="Monter" onclick="V2.produits.docDeplacer(\'' + q + '\',-1)">↑</button>' +
            '<button title="Descendre" onclick="V2.produits.docDeplacer(\'' + q + '\',1)">↓</button>' +
            '<button title="Retirer" onclick="V2.produits.docRetirer(\'' + q + '\')">✕</button>' +
            '</td>' : '') +
          '</tr>';
        n++;
      }
    }
    return { rows: rows, n: n, cips: cips };
  }

  function docStyle() {
    return '@page{size:A4;margin:14mm}' +
      'body{font:12px/1.45 Inter,system-ui,sans-serif;color:#10131C;margin:0}' +
      'h1{font-size:19px;margin:0 0 2px;color:#0050E6}' +
      '.sub{color:#5A6478;font-size:12px;margin-bottom:14px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6478;' +
      'border-bottom:1.5px solid #0050E6;padding:6px 4px}' +
      'td{padding:6px 4px;border-bottom:1px solid #E6E9F0}' +
      'td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}' +
      'tr.bloc td{padding:14px 4px 5px;font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.05em;color:#0050E6;border-bottom:1px solid #0050E6}' +
      'tr.bloc span{color:#8A93A6;font-weight:500}' +
      '.pied{margin-top:16px;font-size:10px;color:#8A93A6}';
  }
  function docPied() {
    return 'Prix nets hors taxes. Tous les produits de cette sélection sont ' +
      'disponibles au jour de l\'édition, sous réserve des stocks.';
  }

  V2.produits.documentHtml = function () {
    var d = docLignes(false);
    if (!d) return { erreur: 'Aucun produit à mettre dans le document' };
    var titre = docTitre();
    var jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>Sélection produits — ' + esc(titre) + '</title><style>' + docStyle() +
      '</style></head><body>' +
      '<h1>Sélection produits — ' + esc(titre) + '</h1>' +
      '<div class="sub">Établie le ' + esc(jour) + ' · Intégral Pharma</div>' +
      '<table><thead><tr><th>Produit</th><th class="n">CIP</th><th class="n">Prix net</th></tr></thead>' +
      '<tbody>' + d.rows + '</tbody></table>' +
      '<div class="pied">' + docPied() + '</div>' +
      '</body></html>';
    return { html: html, titre: titre, lignes: d.n, cips: d.cips };
  };

  function ouvrirImpression(html) {
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var w = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); if (V2.toast) V2.toast('Autorise les fenêtres pour sortir le document'); return; }
    w.focus();
    setTimeout(function () {
      try { w.print(); } catch (e) {}
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }, 400);
  }
  V2.produits.documentPdf = function () {
    var r = V2.produits.documentHtml();
    if (r.erreur) { if (V2.toast) V2.toast(r.erreur); return; }
    propsEnregistrer(r.cips);
    ouvrirImpression(r.html);
  };
  // Le mail part de la boîte du commercial (mailto:), jamais d'un service
  // d'envoi : zéro clé, zéro coût, et un expéditeur que le pharmacien connaît.
  V2.produits.documentMail = function () {
    var cips = documentCips();
    if (!cips.length) { if (V2.toast) V2.toast('Aucun produit à envoyer'); return; }
    var corps = 'Bonjour,\n\nComme convenu, voici la sélection dont nous avons parlé :\n\n', i;
    for (i = 0; i < cips.length && i < 60; i++) {
      var f = fiche(cips[i]);
      corps += '- ' + (f && f.d ? f.d : ('CIP ' + cips[i])) + ' (CIP ' + cips[i] + ')\n';
    }
    corps += '\nProduits disponibles ce jour, sous réserve des stocks.\n\nBien à vous,\n';
    var nom = nomCible();
    propsEnregistrer(cips);
    window.location.href = 'mailto:?subject=' +
      encodeURIComponent('Sélection Intégral Pharma' + (nom ? ' — ' + nom : '')) +
      '&body=' + encodeURIComponent(corps);
  };

  // ── L'aperçu : le document tel qu'il sortira, modifiable ───────
  function rendreApercu() {
    // L'aperçu se sert de la liste affichée. Si on arrive ici sans que la liste
    // ait été rendue (rechargement, lien direct), on la calcule d'abord —
    // sinon le document paraît vide alors qu'il ne l'est pas.
    if (!V2.produits._affichees || !V2.produits._affichees.length) {
      try {
        if (S.mode === 'groupement') rendreGroupement();
        else if (S.mode === 'prospect') rendreProspect();
        else if (S.mode === 'achats') rendreAchats();
        else rendreClient();
      } catch (e) {}
    }
    var d = docLignes(true);
    var titre = docTitre();
    var jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var nRet = V2.produits.docRetouche();
    if (!d) {
      return '<div class="pr-apx-bar">' +
        '<button class="v2-btn" onclick="V2.produits.apercu(false)">← Revenir à la liste</button></div>' +
        vide('Le document est vide', 'Tu as retiré toutes les lignes. Reprends la liste pour repartir.') +
        (nRet ? '<button class="v2-btn pr-plus" onclick="V2.produits.docReset()">Repartir de la liste</button>' : '');
    }
    return '' +
      '<div class="pr-apx-bar">' +
        '<button class="v2-btn" onclick="V2.produits.apercu(false)">← Liste</button>' +
        '<span class="pr-apx-n">' + num(d.n) + ' produits</span>' +
        (nRet ? '<button class="v2-btn pr-apx-raz" onclick="V2.produits.docReset()">Repartir de la liste</button>' : '') +
        '<button class="v2-btn v2-btn-primary" onclick="V2.produits.documentPdf()">PDF</button>' +
        '<button class="v2-btn" onclick="V2.produits.documentMail()">Mail</button>' +
      '</div>' +
      '<div class="pr-apx-aide">Touche un libellé ou un prix pour le corriger. ↑ ↓ pour déplacer, ✕ pour retirer.</div>' +
      '<div class="pr-apx-feuille"><div class="pr-apx-a4">' +
        '<h1>Sélection produits — <span class="ed" contenteditable="true" data-champ="titre"' +
          ' onblur="V2.produits.docSaisie(this)">' + esc(titre) + '</span></h1>' +
        '<div class="sub">Établie le ' + esc(jour) + ' · Intégral Pharma</div>' +
        '<table><thead><tr><th>Produit</th><th class="n">CIP</th><th class="n">Prix net</th>' +
        '<th class="n"></th></tr></thead><tbody>' + d.rows + '</tbody></table>' +
        '<div class="pied">' + docPied() + '</div>' +
      '</div></div>';
  }

  function panierHtml() {
    var n = selNb();
    if (!n) return '';
    return '<div class="pr-panier">' +
      '<b>' + num(n) + ' produit' + (n > 1 ? 's' : '') + ' retenu' + (n > 1 ? 's' : '') + '</b>' +
      '<em>le document ne contiendra que ceux-là</em>' +
      '<button class="vider" onclick="V2.produits.selVider()">Tout reprendre</button>' +
      '</div>';
  }

  // ── Page ───────────────────────────────────────────────────────
  V2.pages.produits = {
    render: function (root, param) {
      if (param) { S.ph = String(param); S.mode = 'client'; }
      injectStyles();
      // Anciens noms de mode encore en mémoire d'une version précédente.
      if (S.mode === 'vendeur') S.mode = 'client';
      if (S.mode === 'surmesure') S.mode = 'prospect';
      S.sm = S.sm ? smNormaliser(S.sm) : smCharger();
      if (!S.sel) S.sel = selCharger();
      if (!S.doc) S.doc = docCharger();

      var onglets = '<div class="pr-modes pr-defile">', i;
      for (i = 0; i < PUBLICS.length; i++) {
        onglets += '<button class="pr-mode' + (S.mode === PUBLICS[i][0] ? ' on' : '') +
          '" onclick="V2.produits.setMode(\'' + PUBLICS[i][0] + '\')">' + PUBLICS[i][1] + '</button>';
      }
      onglets += '</div>';

      if (S.apercu) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap pr-wrap">' + rendreApercu() + '</div>';
        return;
      }
      var corps = S.mode === 'groupement' ? rendreGroupement()
        : S.mode === 'prospect' ? rendreProspect()
        : S.mode === 'achats' ? rendreAchats()
        : rendreClient();

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap pr-wrap"><div class="v2-page-title">Produits</div>' +
        onglets + corps + liensBas() + '</div>';
    }
  };

  function liensBas() {
    var l = [];
    if (V2.pages.catalogue) l.push('<a onclick="V2.go(\'catalogue\')">Catalogue complet</a>');
    if (V2.pages.molecules) l.push('<a onclick="V2.go(\'molecules\')">Prix par produit</a>');
    if (V2.pages.appro) l.push('<a onclick="V2.go(\'appro\')">Appro Intégral</a>');
    return l.length ? '<div class="pr-liens">' + l.join('') + '</div>' : '';
  }

  function injectStyles() {
    if (document.getElementById('pr-styles')) return;
    var s = document.createElement('style');
    s.id = 'pr-styles';
    s.textContent = [
      '.pr-wrap{padding-bottom:64px}',
      '.pr-modes{display:flex;gap:8px;margin:12px 0}',
      '.pr-mode{flex:none;min-height:44px;padding:0 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 15px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-mode.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-bandeau{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}',
      '.pr-select{width:100%;min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);padding:0 10px;background:var(--paper);color:var(--ip-ink)}',
      '.pr-ctx{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font:600 14px/1.3 Inter,sans-serif}',
      '.pr-ctx-pot{color:var(--ip-blue)}',
      '.pr-ctx-n,.pr-ctx-grp{color:var(--muted)}',
      '.pr-note{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(199,121,26,.10);border:1px solid rgba(199,121,26,.30);font:500 13px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-suivi{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(30,158,106,.10);border:1px solid rgba(30,158,106,.30);font:400 13px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-suivi b{font-weight:700}',
      '.pr-suivi em{font-style:normal;color:var(--muted)}',
      '.pr-pdf{margin-top:12px;width:100%;min-height:44px}',
      '.pr-mail{margin-top:8px;width:100%;min-height:44px}',
      '@media (min-width:760px){.pr-pdf,.pr-mail{width:auto;padding:0 28px}.pr-mail{margin-left:8px}}',
      '.pr-source{margin-top:10px;font:400 12px/1 Inter,sans-serif;color:var(--muted)}',
      '.pr-filtres{margin-bottom:12px}',
      '.pr-search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0 12px;min-height:44px}',
      '.pr-search input{flex:1;border:0;background:transparent;font-size:16px;color:var(--ip-ink);outline:none}',
      '.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.pr-defile{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '.pr-defile::-webkit-scrollbar{display:none}',
      '.pr-defile .pr-chip{flex:none}',
      '.pr-chip{min-height:36px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 13px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-chip.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px}',
      '.pr-lib{font:700 15px/1.35 Satoshi,Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-fam{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font:600 11px/1.6 Inter,sans-serif;color:var(--fc);border:1px solid var(--fc)}',
      '.pr-rupt{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--c-rose);color:#fff;font:600 11px/1.6 Inter,sans-serif}',
      // Largeur libre : la plupart des logos de groupements sont horizontaux et
      // deviennent illisibles dans un carre.
      '.pr-logo{display:inline-flex;align-items:center;justify-content:center;min-width:22px;max-width:52px;height:22px;padding:0 3px;margin-right:6px;border-radius:5px;background:#fff;border:1px solid var(--line);overflow:hidden;vertical-align:-6px;flex:none}',
      '.pr-logo img{max-width:100%;max-height:100%;object-fit:contain;display:block}',
      '.pr-logo-x{font:700 9px/1 Inter,sans-serif;color:var(--muted);background:var(--paper)}',
      '.pr-logo-g{min-width:34px;max-width:78px;height:34px;border-radius:8px;vertical-align:-11px}',
      '.pr-logo-g.pr-logo-x{font-size:13px}',
      '.pr-arg{margin-top:6px;font:400 14px/1.4 Inter,sans-serif;color:var(--muted)}',
      '.pr-chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}',
      '.pr-chiffres span{display:block;font:600 15px/1.2 "Geist Mono",ui-monospace,monospace;color:var(--ip-ink)}',
      '.pr-chiffres em{display:block;font:400 11px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.pr-pot span{color:var(--ip-blue)}',
      '.pr-add{margin-top:10px;width:100%;min-height:44px;border-radius:10px;border:1px dashed var(--ip-blue);background:transparent;color:var(--ip-blue);font:600 14px/1 Inter,sans-serif;cursor:pointer}',
      '.pr-add.on{border-style:solid;background:var(--ip-blue);color:#fff}',
      '.pr-panier{position:sticky;bottom:8px;z-index:40;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:12px;border-radius:14px;background:var(--ip-blue);color:#fff;box-shadow:0 6px 22px rgba(0,80,230,.28)}',
      '.pr-panier b{font:700 15px/1.2 Inter,sans-serif}',
      '.pr-panier em{font:400 12px/1.3 Inter,sans-serif;font-style:normal;opacity:.85;flex:1;min-width:110px}',
      '.pr-panier button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;font:600 14px/1 Inter,sans-serif;cursor:pointer}',
      '.pr-plus{width:100%;min-height:44px;margin-top:8px}',
      '.pr-rech{position:relative;margin-bottom:10px}',
      '.pr-rech-in{background:var(--paper)}',
      // La liste est ancree SOUS le champ, pas en plein ecran : on garde le
      // contexte de la page derriere, contrairement a la palette Cmd+K.
      '.pr-sugg{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;max-height:56vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(16,19,28,.14)}',
      '.pr-sug{display:flex;align-items:center;gap:8px;width:100%;min-height:52px;padding:8px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;cursor:pointer}',
      '.pr-sug:last-child{border-bottom:0}',
      '.pr-sug.on{background:rgba(0,80,230,.07)}',
      '.pr-sug-m{flex:1;min-width:0}',
      '.pr-sug-t{display:block;font:600 14px/1.25 Inter,sans-serif;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pr-sug-s{display:block;font:400 12px/1.3 Inter,sans-serif;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pr-sug-k{font:600 10px/1 Inter,sans-serif;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;flex:none}',
      '.pr-cible{display:flex;align-items:center;gap:8px;font:700 17px/1.3 Satoshi,Inter,sans-serif;color:var(--ip-ink);margin-bottom:2px}',
      '.pr-apx-bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;margin-bottom:6px;background:var(--paper)}',
      '.pr-apx-bar .v2-btn{min-height:44px;padding:0 14px}',
      '.pr-apx-n{font:600 14px/1 Inter,sans-serif;color:var(--muted);flex:1;min-width:70px}',
      '.pr-apx-raz{color:var(--c-rose)}',
      '.pr-apx-aide{font:400 13px/1.4 Inter,sans-serif;color:var(--muted);margin-bottom:10px}',
      // La feuille garde la largeur A4 (794 px) et se met a l echelle de
      // l ecran : ce qu on voit est exactement ce qui sortira.
      '.pr-apx-feuille{overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}',
      '.pr-apx-a4{width:794px;max-width:100%;font:12px/1.45 Inter,system-ui,sans-serif;color:#10131C}',
      '.pr-apx-a4 h1{font-size:19px;margin:0 0 2px;color:#0050E6}',
      '.pr-apx-a4 .sub{color:#5A6478;font-size:12px;margin-bottom:14px}',
      '.pr-apx-a4 table{width:100%;border-collapse:collapse}',
      '.pr-apx-a4 th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6478;border-bottom:1.5px solid #0050E6;padding:6px 4px}',
      '.pr-apx-a4 td{padding:6px 4px;border-bottom:1px solid #E6E9F0}',
      '.pr-apx-a4 td.n,.pr-apx-a4 th.n{text-align:right;font-variant-numeric:tabular-nums}',
      '.pr-apx-a4 tr.bloc td{padding:14px 4px 5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0050E6;border-bottom:1px solid #0050E6}',
      '.pr-apx-a4 tr.bloc span{color:#8A93A6;font-weight:500}',
      '.pr-apx-a4 .pied{margin-top:16px;font-size:10px;color:#8A93A6}',
      // Ce qui se touche se voit : pointille discret, fond au focus.
      '.pr-apx-a4 .ed{border-bottom:1px dashed rgba(0,80,230,.45);outline:none;display:inline-block;min-width:28px;padding:1px 2px;border-radius:3px}',
      '.pr-apx-a4 .ed:focus{background:rgba(0,80,230,.08);border-bottom-style:solid}',
      '.pr-apx-a4 td.act{white-space:nowrap;text-align:right;width:1%}',
      '.pr-apx-a4 td.act button{min-width:34px;min-height:34px;margin-left:2px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ip-ink);font-size:14px;cursor:pointer}',
      // Sous 700 px, on n'essaie plus de reproduire une A4 : elle serait
      // ecrasee et illisible. L'apercu redevient une surface d'EDITION
      // fluide — le PDF, lui, reste en A4. Le CIP sort de l'ecran : il ne
      // sert a rien pour retoucher, et il mange la largeur du libelle.
      '@media (max-width:700px){',
      '  .pr-apx-feuille{padding:12px}',
      '  .pr-apx-a4{width:100%}',
      '  .pr-apx-a4 th:nth-child(2),.pr-apx-a4 td:nth-child(2){display:none}',
      '  .pr-apx-a4 td.act{white-space:normal;width:auto}',
      '  .pr-apx-a4 td.act button{min-width:40px;min-height:44px}',
      '}',
      '.pr-liens{display:flex;flex-wrap:wrap;gap:14px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}',
      '.pr-liens a{font:500 13px/1 Inter,sans-serif;color:var(--muted);cursor:pointer;text-decoration:underline}',
      '.sm-plier{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;min-height:44px;margin:10px 0;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--paper);font:600 14px/1.2 Inter,sans-serif;color:var(--ip-blue);cursor:pointer;text-align:left}',
      '.sm-plier em{font:400 12px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.sm-labos{margin-top:8px}',
      '.sm-lab{min-height:38px;font-size:12.5px}',
      '.sm-lab em{font-style:normal;opacity:.55;margin-left:3px}',
      '.sm-excl.on{background:var(--c-mint);border-color:var(--c-mint)}',
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
