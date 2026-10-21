/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Listing produits 2027 (V2.listings2027) — 21/10/2026

   Will : « une page sur jarvis que pour les commerciaux restreint où on est en
   petit groupe : Listing produits 2027, l'explication de la marge en % et ce que
   ça peut représenter pour nous, les listings en masse, marge et rémunération
   par rapport à ce qu'on fait actuellement ».

   · Même accès que « Notre marge par produit » : RPC jarvis_acces_marge_produits()
     (_sql/marge-produits.sql), aucun SQL de plus. La vraie barrière est côté base :
     la clé `listings` vit dans le MÊME fichier protégé marge-produits.js (seau
     protégé), jamais dans le dépôt. Il n'est demandé qu'APRÈS le oui de la base.
   · Aucun chiffre métier n'est écrit ici : tout se lit dans
     window.MARGE_PRODUITS.listings. Les seules constantes sont des réglages
     d'AFFICHAGE (couleurs des familles, plafond de saisie).
   · Même habillage que v2-margeproduits.js (mêmes classes mp-*, mêmes boutons).
     Ni flou, ni verre dépoli, ni dégradé sur du texte, ni opacity sur du texte.
   · « Ce qu'on fait actuellement » = le panier habituel du réseau, et rien d'autre.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : (window.ICO ? window.ICO(n, s, w) : ''); };

  // ── Réglages d'affichage (pas des données métier) ─────────────────
  var COULEURS = { froid: '#0891B2', coeur: '#E0556E', cher: '#3A4A9C', entre: '#C7791A', sous: '#6D4FC4' };
  var ORDRE = ['sous', 'entre', 'coeur', 'cher', 'froid'];   // prix croissant, puis le froid
  var MAX_PHARMACIES = 99999;
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ── État ──────────────────────────────────────────────────────────
  var acces = null, accesP = null, accesEchec = false;
  var etatFichier = 'attente';   // attente | charge | refuse
  var D = null;                  // données préparées
  var S = { ouvert: {}, n: [], p: 0 };
  var racine = null, ecouteurs = false;

  function sb() { return (V2.sb && V2.sb()) || null; }
  function moi() { return (V2.user && V2.user.id) || null; }

  // ── Accès : c'est la base qui répond, pas une liste écrite ici ────
  function verifier() {
    if (acces !== null) return Promise.resolve(acces);
    if (accesP) return accesP;
    var c = sb();
    if (!c || !moi()) return Promise.resolve(false);
    accesP = c.rpc('jarvis_acces_marge_produits').then(function (r) {
      accesP = null;
      if (r && !r.error) { acces = (r.data === true); return acces; }
      return false;                   // échec de lecture : on redemandera, on ne conclut rien
    }).catch(function () { accesP = null; return false; });
    return accesP;
  }

  // ── Fichier protégé (le même que « Notre marge par produit ») ─────
  function charger() {
    if (window.MARGE_PRODUITS) { etatFichier = 'charge'; return Promise.resolve(); }
    if (!V2.loadFiles) { etatFichier = 'refuse'; return Promise.resolve(); }
    return V2.loadFiles(['margeproduits']).then(function () {
      etatFichier = window.MARGE_PRODUITS ? 'charge' : 'refuse';
    }, function () { etatFichier = 'refuse'; });
  }

  // ── Formats ───────────────────────────────────────────────────────
  function nf(n, dec) {
    var s;
    try { s = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n); }
    catch (e) { s = n.toFixed(dec || 0).replace('.', ','); }
    return s.replace(/ /g, ' ');     // l'espace fine ne s'imprime pas partout : espace insécable ordinaire
  }
  function moins(s) { return s.replace(/^-/, '−'); }
  function eur0(n) { return moins(nf(Math.round(n))) + ' €'; }
  function eur2(n) { return moins(nf(n, 2)) + ' €'; }
  function pct(v, d) { return moins(nf(v * 100, d == null ? 1 : d)) + ' %'; }
  function entier(n) { return moins(nf(Math.round(n))); }
  function fois(v) { return '× ' + nf(v, 1); }
  function dateLongue(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    return parseInt(m[3], 10) + (m[3] === '01' ? 'er' : '') + ' ' + MOIS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  // ── Préparation des données ───────────────────────────────────────
  function preparer(M) {
    var L = M.listings;
    if (!L || !L.listes || !L.listes.length || !L.reseau || !L.bareme || !L.familles || !L.colonnes) throw new Error('listings incomplets');
    var ix = {}, i;
    for (i = 0; i < L.colonnes.length; i++) ix[L.colonnes[i]] = i;
    var listes = L.listes.map(function (s, k) {
      var o = {};
      for (var key in s) if (key !== 'lignes') o[key] = s[key];
      o.k = k;
      o.lignes = s.lignes.map(function (l) {
        return { cip: String(l[ix.cip]), nom: String(l[ix.nom]), q: l[ix.q], net: l[ix.net27], total: l[ix.total], marge: l[ix.marge],
          famille: l[ix.famille], ppht: l[ix.ppht27], section: l[ix.section] };
      });
      o.tauxFois = L.reseau.taux ? o.taux / L.reseau.taux : 0;
      return o;
    });
    var tx = L.reseau.taux;
    var tmin = Math.min.apply(null, listes.map(function (s) { return s.taux; })), tmax = Math.max.apply(null, listes.map(function (s) { return s.taux; }));
    S.n = listes.map(function () { return 0; });
    return { M: M, L: L, listes: listes, tx: tx, tmin: tmin, tmax: tmax, bareme: L.bareme, tranches: L.bareme.tranches, bonus: L.bareme.bonus,
      fams: L.familles, autres: L.autres, seuils: L.seuils, ex: L.exemple };
  }

  // ── Calculs (exposés sur V2.listings2027 : la preuve les recalcule seule) ──
  function tauxPrime(p) { return D.tranches[p].taux + D.bonus; }
  function prime(marge, p) { return marge * tauxPrime(p); }
  function simuler(nbs, p) {
    var achats = 0, marge = 0, i;
    for (i = 0; i < D.listes.length; i++) {
      var n = Math.max(0, Math.floor(+nbs[i] || 0));
      achats += n * D.listes[i].ca; marge += n * D.listes[i].marge;
    }
    var margeP = achats * D.tx, pr = prime(marge, p), prP = prime(margeP, p);
    return { achats: achats, marge: marge, margePanier: margeP, ecartMarge: marge - margeP,
      prime: pr, primePanier: prP, ecartPrime: pr - prP, primeAn: pr * 12, primePanierAn: prP * 12, ecartPrimeAn: (pr - prP) * 12 };
  }

  // ── Pièces ────────────────────────────────────────────────────────
  function barre(part, couleur, max) {
    var w = Math.max(0, Math.min(1, max ? part / max : 0)) * 100;
    return '<span class="mp-bar"><i style="width:' + w.toFixed(2) + '%;background:' + couleur + '"></i></span>';
  }
  function chipFam(f) { return '<span class="mp-fam" style="--c:' + (COULEURS[f.cle] || '#8A93A8') + '"><i></i>' + esc(f.nom) + '</span>'; }
  function pctC(v) { var x = v * 100; return moins(nf(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 1)) + ' %'; }   // 7,5 % · 15 % · 30 % (sans « ,0 »)
  function nomPalier(p) { return pctC(D.tranches[p].taux); }

  function enTete() {
    return '<div class="mp-hero">' +
      '<div class="mp-hero-t"><div class="mp-eyebrow"><span class="dot"></span>Accès réservé au groupe restreint</div>' +
      '<h1 class="mp-h1">Listing produits 2027</h1>' +
      '<p class="mp-sub">Les ' + D.listes.length + ' listings à proposer aux pharmacies en janvier 2027, ce qu’ils rapportent à Intégral Pharma en pourcentage, et ce que cela représente pour vous. ' +
      'Estimations calculées le ' + esc(dateLongue(D.L.date_calcul)) + ', prix nets à partir du ' + esc(dateLongue(D.L.date_bareme)) + '.</p></div></div>';
  }
  function kpis() {
    var fmin = Math.min.apply(null, D.listes.map(function (s) { return s.tauxFois; })), fmax = Math.max.apply(null, D.listes.map(function (s) { return s.tauxFois; }));
    var h = '';
    h += '<div class="mp-kpi" style="--k:var(--c-froid)"><div class="mp-kl">Taux de marge des listings</div>' +
      '<div class="mp-kv" data-k="tx-listings">' + pct(D.tmin, 1) + ' à ' + pct(D.tmax, 1) + '</div>' +
      '<div class="mp-kd">Pour 100 € achetés par la pharmacie dans un de nos ' + D.listes.length + ' listings, Intégral Pharma garde entre ' + nf(D.tmin * 100, 1) + ' et ' + nf(D.tmax * 100, 1) + ' €.</div></div>';
    h += '<div class="mp-kpi" style="--k:var(--ip-blue)"><div class="mp-kl">Panier habituel du réseau</div>' +
      '<div class="mp-kv" data-k="tx-reseau">' + pct(D.tx, 2) + '</div>' +
      '<div class="mp-kd">C’est ce que nous garderons en 2027 sur 100 € d’achats habituels des pharmacies (tous produits, génériques compris).'+
      '</div></div>';
    h += '<div class="mp-kpi" style="--k:var(--c-mint)"><div class="mp-kl">Combien de fois plus</div>' +
      '<div class="mp-kv" data-k="fois">' + fois(fmin) + ' à ' + fois(fmax) + '</div>' +
      '<div class="mp-kd">À montant acheté égal, un listing rapporte de ' + nf(fmin, 1) + ' à ' + nf(fmax, 1) + ' fois plus qu’un panier habituel, donc plus de prime pour le commercial.</div></div>';
    return '<div class="mp-kpis ls-kpis">' + h + '</div>';
  }

  // ── b · La marge en %, expliquée ──────────────────────────────────
  function libelleFamille(f) {
    var s = D.seuils;
    if (f.cle === 'sous') return 'Prix net sous ' + nf(s.bascule, 2) + ' €';
    if (f.cle === 'entre') return 'De ' + nf(s.bascule, 2) + ' à ' + nf(s.palier_petit, 2) + ' €, la tranche ajoutée en 2027';
    if (f.cle === 'coeur') return 'De ' + nf(s.palier_petit, 2) + ' à ' + nf(s.plafond, 2) + ' €';
    if (f.cle === 'cher') return 'Au-dessus de ' + nf(s.plafond, 2) + ' €';
    return 'Produits froids, forfait de ' + nf(s.forfait_froid, 2) + ' € par boîte';
  }
  function sectionExplication() {
    var ex = D.ex, f = ex.froid, p = ex.petit;
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>La marge en %, expliquée</h2><span>Le taux de marge = notre marge ÷ ce que la pharmacie achète (prix net, hors taxes). C’est lui qui dit ce qu’un euro acheté rapporte.</span></div>';
    h += '<div class="mp-card ls-expl"><div class="ls-ex-g">' +
      '<div class="ls-ex"><div class="ls-ex-t">Un produit froid</div><b>' + esc(f.nom) + '</b>' +
      '<p>La pharmacie paie <b>' + eur2(f.net) + '</b>. Nous gardons <b>' + eur2(f.marge_boite) + '</b> par boîte, soit <b class="ls-taux">' + pct(f.marge_boite / f.net, 2) + '</b> du prix.</p></div>' +
      '<div class="ls-ex"><div class="ls-ex-t">Un des produits les moins chers, hors froid</div><b>' + esc(p.nom) + '</b>' +
      '<p>La pharmacie paie <b>' + eur2(p.net) + '</b>. Nous gardons <b>' + eur2(p.marge_boite) + '</b> par boîte, soit <b class="ls-taux">' + pct(p.marge_boite / p.net, 2) + '</b> du prix.</p></div>' +
      '</div><p class="mp-def">Ces deux produits sont tirés du listing de ' + eur0(ex.budget) + '. Une boîte de froid rapporte plus d’euros (' + eur2(f.marge_boite) + ' contre ' + eur2(p.marge_boite) + '), mais pas forcément plus de pourcentage : le taux dépend du prix du produit. ' +
      'Un listing atteint ' + pct(D.tmin, 1) + ' à ' + pct(D.tmax, 1) + ' parce qu’il laisse de côté les génériques et les prix fixes des laboratoires et place en tête les produits au meilleur taux de marge, alors que le panier habituel les contient tous (' + pct(D.tx, 2) + ').</p></div>';
    h += '<div class="mp-sh ls-sh2"><h2 class="ls-h3">Notre marge par famille de prix, en janvier 2027</h2><span>Pour chaque famille : sa part des boîtes vendues, sa part de notre marge, ce que nous gardons par boîte et le taux de marge.</span></div>';
    h += '<div class="mp-card mp-fams"><div class="mp-fh" aria-hidden="true"><span>Famille</span><span>Part des boîtes · part de notre marge</span><span>Marge par boîte</span><span>Taux de marge</span></div>';
    D.fams.slice().sort(function (a, b) { return ORDRE.indexOf(a.cle) - ORDRE.indexOf(b.cle); }).forEach(function (f) {
      h += '<div class="mp-fr" data-fam="' + esc(f.cle) + '"><div class="mp-fn">' + chipFam(f) + '<small>' + esc(libelleFamille(f)) + '</small></div>' +
        '<div class="mp-fb"><div class="mp-fl"><span>Boîtes</span>' + barre(f.part_boites, '#9AA6C0', 1) + '<b>' + pct(f.part_boites) + '</b></div>' +
        '<div class="mp-fl m"><span>Notre marge</span>' + barre(f.part_marge, COULEURS[f.cle] || '#8A93A8', 1) + '<b>' + pct(f.part_marge) + '</b></div></div>' +
        '<div class="mp-fv" data-l="Marge par boîte">' + eur2(f.mb) + '</div>' +
        '<div class="mp-fv" data-l="Taux de marge">' + pct(f.taux, 2) + '</div></div>';
    });
    h += '</div><p class="mp-note">Les autres familles (non remboursés, prix fixes des laboratoires, génériques) représentent ' + pct(D.autres.part_boites, 0) + ' des boîtes et ' + pct(D.autres.part_marge, 0) + ' de notre marge.</p></section>';
    return h;
  }

  // ── c · Les 6 listings ────────────────────────────────────────────
  function enteteListes() {
    return '<div class="mp-row mp-head ls-row ls-hd" aria-hidden="true"><span>Listing</span><span class="c">Notre marge / mois</span><span class="c">Taux de marge</span><span class="c">Part du froid</span>' +
      '<span class="c">Prime (' + nomPalier(0) + ' + ' + pct(D.bonus, 0) + ')</span><span class="c">Même montant, panier habituel</span><span></span></div>';
  }
  function ligneListe(s) {
    var o = !!S.ouvert[s.k], panier = s.reseau, pp = prime(panier, 0);
    var h = '<div class="ls-it' + (o ? ' ouvert' : '') + '" data-k="' + s.k + '">' +
      '<button type="button" class="mp-row ls-row ls-btn" data-ls="ouv" data-i="' + s.k + '" aria-expanded="' + o + '" aria-controls="ls-det-' + s.k + '">' +
      '<span class="mp-n"><b>' + eur0(s.budget) + ' par mois</b><span>' + entier(s.refs) + ' produits · ' + entier(s.boites) + ' boîtes</span></span>' +
      '<span class="mp-c" data-l="Notre marge / mois" data-v="marge">' + eur2(s.marge) + '</span>' +
      '<span class="mp-c" data-l="Taux de marge" data-v="taux"><b class="ls-chip">' + pct(s.taux, 2) + '</b></span>' +
      '<span class="mp-c" data-l="Part du froid" data-v="froid">' + pct(s.part_froid, 0) + '</span>' +
      '<span class="mp-c ls-pr" data-l="Prime du commercial / mois" data-v="prime"><b>' + eur2(s.p1) + '</b><small>' + nomPalier(1) + ' : ' + eur2(s.p2) + ' · ' + nomPalier(2) + ' : ' + eur2(s.p3) + '</small></span>' +
      '<span class="mp-c ls-pr" data-l="Même montant, panier habituel" data-v="panier"><b>' + eur2(panier) + '</b><small>prime ' + eur2(pp) + '</small></span>' +
      '<span class="mp-chev" aria-hidden="true"></span></button>';
    h += '<div class="ls-det" id="ls-det-' + s.k + '"' + (o ? '' : ' hidden') + '>' + (o ? detail(s) : '') + '</div></div>';
    return h;
  }
  function detail(s) {
    var h = '<div class="mp-odh"><div><b>' + eur0(s.budget) + ' par mois : ' + entier(s.refs) + ' produits, ' + entier(s.boites) + ' boîtes</b>' +
      '<span>Montant exact ' + eur2(s.ca) + '. Prix nets à partir du ' + esc(dateLongue(D.L.date_bareme)) + ' ; la marge est la nôtre, elle ne figure jamais sur le document remis à la pharmacie.</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary mp-fiche" data-ls="pdf" data-i="' + s.k + '">' + ICO('fiche', 16, 2) + ' PDF pour la pharmacie</button></div>';
    h += '<div class="ls-pl ls-plh" aria-hidden="true"><span>#</span><span>Produit</span><span class="c">Boîtes</span><span class="c">Prix net</span><span class="c">Montant</span><span class="c">Notre marge</span></div>';
    s.lignes.forEach(function (l, i) {
      h += '<div class="ls-pl" data-cip="' + esc(l.cip) + '"><span class="mp-rk">' + (i + 1) + '</span>' +
        '<span class="mp-n"><b>' + esc(l.nom) + '</b><span>CIP ' + esc(l.cip) + '</span></span>' +
        '<span class="mp-c" data-l="Boîtes">' + entier(l.q) + '</span><span class="mp-c" data-l="Prix net">' + eur2(l.net) + '</span>' +
        '<span class="mp-c" data-l="Montant">' + eur2(l.total) + '</span><span class="mp-c" data-l="Notre marge">' + eur2(l.marge) + '</span></div>';
    });
    return h;
  }
  // Will, 21/10 : « les listing pdf dessus aussi » : les 6 PDF à remettre, visibles sans rien déplier.
  // Un bouton = un seul PDF.
  function pdfs() {
    var h = '<div class="mp-card ls-pdfs"><div class="ls-pdfs-t"><b>Les ' + D.listes.length + ' PDF à remettre aux pharmacies</b>' +
      '<span>Produits, CIP, boîtes par mois, prix nets à partir du ' + esc(dateLongue(D.L.date_bareme)) + ' et montant. Ni notre marge, ni taux, ni prime.</span></div><div class="ls-pdfs-g">';
    D.listes.forEach(function (s) {
      h += '<button type="button" class="ls-pdf" data-ls="pdf" data-i="' + s.k + '">' + ICO('fiche', 18, 2) +
        '<span><b>' + eur0(s.budget) + ' par mois</b><small>' + entier(s.refs) + ' produits · PDF</small></span></button>';
    });
    return h + '</div></div>';
  }
  function sectionListes() {
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Les ' + D.listes.length + ' listings</h2><span>Pour chaque montant d’achats mensuel : ce que nous gagnons, le taux de marge, la prime du commercial, et la même chose sur un panier habituel de même montant. Un clic ouvre la liste des produits.</span></div>';
    h += pdfs();
    h += '<div class="mp-card ls-list">' + enteteListes();
    D.listes.forEach(function (s) { h += ligneListe(s); });
    h += '</div><p class="mp-note">Prime du commercial = notre marge × (taux du palier + ' + pct(D.bonus, 0) + ' de bonus). Le palier dépend du chiffre d’affaires total du mois du commercial. Longueur de listing : ' + esc(D.L.longueur) + ', tirée d’une sélection de ' + entier(D.L.selection_pool) + ' produits.</p></section>';
    return h;
  }

  // ── d · En masse ──────────────────────────────────────────────────
  function texteBareme() {
    var t = D.tranches, parts = [];
    t.forEach(function (x, i) {
      parts.push(pctC(x.taux) + ' de la marge ' + (x.a != null ? (i === 0 ? 'jusqu’à ' : 'jusqu’à ') + eur0(x.a) : 'au-delà') + (i === t.length - 1 && x.a == null ? '' : ''));
    });
    return parts.join(', ') + ', plus ' + pct(D.bonus, 0) + ' de bonus sur la marge.';
  }
  function sectionMasse() {
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>En masse</h2><span>Combien de pharmacies prennent chaque listing ? Saisissez-le : la marge d’Intégral Pharma et la prime du commercial se recalculent aussitôt, face aux mêmes achats au panier habituel.</span></div>';
    h += '<div class="mp-card ls-masse"><div class="ls-champs">';
    D.listes.forEach(function (s) {
      h += '<label class="mp-field" for="ls-n-' + s.k + '"><span>Pharmacies à ' + eur0(s.budget) + ' par mois</span>' +
        '<input id="ls-n-' + s.k + '" class="ls-n" data-i="' + s.k + '" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" value="' + (S.n[s.k] || '') + '"></label>';
    });
    h += '</div><div class="ls-palier"><span class="mp-seg-l">Palier du commercial</span><div class="mp-seg" role="group" aria-label="Palier de prime">';
    D.tranches.forEach(function (t, i) {
      h += '<button type="button" data-ls="palier" data-p="' + i + '" aria-pressed="' + (S.p === i) + '" class="' + (S.p === i ? 'on' : '') + '">' + pctC(t.taux) + '</button>';
    });
    h += '</div></div><p class="mp-note ls-bar">Barème : ' + esc(texteBareme()) + ' Le palier dépend du chiffre d’affaires total du mois du commercial, pas du seul listing : choisissez celui qui correspond à votre mois.</p>';
    h += '<div id="ls-res" class="ls-res" aria-live="polite"></div></div></section>';
    return h;
  }
  function resultat() {
    var r = simuler(S.n, S.p);
    var signe = function (v) { return (v < 0 ? '−' : '+') + eur0(Math.abs(v)); };
    var ligne = function (nom, a, b, e, cle) {
      return '<div class="ls-rl" data-r="' + cle + '"><span class="ls-rn">' + nom + '</span><span class="ls-rv" data-l="Avec les listings"><b>' + a + '</b></span>' +
        '<span class="ls-rv" data-l="Panier habituel">' + b + '</span><span class="ls-rv ls-re" data-l="Écart">' + e + '</span></div>';
    };
    var h = '<div class="ls-rl ls-rh" aria-hidden="true"><span></span><span class="c">Avec les listings</span><span class="c">Panier habituel</span><span class="c">Écart</span></div>';
    h += ligne('Achats des pharmacies / mois', eur0(r.achats), eur0(r.achats), 'même montant', 'achats');
    h += ligne('Notre marge / mois', eur0(r.marge), eur0(r.margePanier), '<b class="' + (r.ecartMarge < 0 ? 'neg' : 'pos') + '">' + signe(r.ecartMarge) + '</b>', 'marge');
    h += ligne('Prime du commercial / mois', eur0(r.prime), eur0(r.primePanier), '<b class="' + (r.ecartPrime < 0 ? 'neg' : 'pos') + '">' + signe(r.ecartPrime) + '</b>', 'prime');
    h += ligne('Prime du commercial / an', eur0(r.primeAn), eur0(r.primePanierAn), '<b class="' + (r.ecartPrimeAn < 0 ? 'neg' : 'pos') + '">' + signe(r.ecartPrimeAn) + '</b>', 'primean');
    return h;
  }
  function majResultat() { var e = document.getElementById('ls-res'); if (e) e.innerHTML = resultat(); }

  function pied() {
    return '<footer class="mp-pied"><h3>Comment lire cette page</h3><ul>' +
      '<li>Notre marge est une estimation de la direction, au barème des grossistes du ' + esc(dateLongue(D.L.date_bareme)) + ', sur les ventes de toute l’équipe.</li>' +
      '<li>Le panier habituel est la marge moyenne que nous gardons sur l’ensemble des achats du réseau : ' + pct(D.tx, 2) + ' du chiffre d’affaires.</li>' +
      '<li>La prime est calculée sur la marge : taux du palier choisi + ' + pct(D.bonus, 0) + ' de bonus. Les primes sur le chiffre d’affaires des laboratoires de génériques ne sont pas comptées ici.</li></ul>' +
      '<p class="conf">Confidentiel : réservé à votre compte.</p></footer>';
  }

  // ── PDF pour la pharmacie (même habillage que la liste « À proposer ») ──
  // AUCUNE marge, AUCUN taux, AUCUNE prime sur ce document.
  var SECTIONS = [['froid', 'Produits froids', '#0E7C86'], ['pr', 'Princeps remboursables', '#0050E6'], ['nr', 'Non remboursables', '#5B6477']];
  var LOGO = 'img/logo-integral-serre.png';
  function pdfHtml(s) {
    var MONO = "'Geist Mono',ui-monospace,monospace";
    var COLS = '<colgroup><col style="width:5%"><col style="width:37%"><col style="width:14%"><col style="width:8%"><col style="width:11%"><col style="width:12%"><col style="width:13%"></colgroup>';
    var thd = function (h, al) { return '<th style="text-align:' + al + ';padding:6px 8px;font-size:8.5px;font-weight:800;letter-spacing:.5px;color:#FFFFFF;text-transform:uppercase">' + h + '</th>'; };
    var num = 0, jour = dateLongue(D.L.date_calcul), dateB = dateLongue(D.L.date_bareme);
    var blocs = SECTIONS.map(function (sec) {
      var rs = s.lignes.filter(function (l) { return l.section === sec[0]; });
      if (!rs.length) return '';
      var trs = rs.map(function (l, i) {
        num++;
        var pp = l.ppht == null ? '—' : (l.net < l.ppht ? '<span style="text-decoration:line-through">' + eur2(l.ppht) + '</span>' : eur2(l.ppht));
        return '<tr style="page-break-inside:avoid;background:' + (i % 2 ? '#F7F9FC' : '#FFFFFF') + ';border-bottom:1px solid #EEF1F6">' +
          '<td style="padding:5.5px 8px;font-family:' + MONO + ';font-size:9px;color:#5B6477">' + num + '</td>' +
          '<td style="padding:5.5px 8px;font-size:11.5px;font-weight:700;color:#10131C">' + esc(String(l.nom).slice(0, 58)) + '</td>' +
          '<td style="padding:5.5px 8px;font-family:' + MONO + ';font-size:9px;color:#5B6477">' + esc(l.cip) + '</td>' +
          '<td style="padding:5.5px 8px;text-align:center;font-family:' + MONO + ';font-size:11px;font-weight:700">' + entier(l.q) + '</td>' +
          '<td style="padding:5.5px 8px;text-align:right;font-family:' + MONO + ';font-size:9.5px;color:#6B7385;white-space:nowrap">' + pp + '</td>' +
          '<td style="padding:5.5px 8px;text-align:right;font-family:' + MONO + ';font-size:11.5px;font-weight:800;color:#0050E6;white-space:nowrap">' + eur2(l.net) + '</td>' +
          '<td style="padding:5.5px 8px;text-align:right;font-family:' + MONO + ';font-size:10.5px;white-space:nowrap">' + eur2(l.total) + '</td></tr>';
      });
      // Le titre de la partie reste collé à ses 3 premières lignes (sinon html2pdf peut le laisser seul en bas de page) ;
      // le reste des lignes suit dans un second tableau, coupé entre deux lignes.
      var tab = function (corps, tete) { return '<table style="width:100%;border-collapse:collapse;table-layout:fixed">' + COLS + (tete || '') + '<tbody>' + corps.join('') + '</tbody></table>'; };
      return '<div style="page-break-inside:avoid;margin-top:13px"><div style="background:' + sec[2] + ';display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-radius:5px 5px 0 0">' +
        '<span style="color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">' + sec[1] + '</span>' +
        '<span style="color:#FFFFFF;font-size:9.5px;font-weight:700">' + rs.length + ' produit' + (rs.length > 1 ? 's' : '') + '</span></div>' +
        tab(trs.slice(0, 3), '<thead><tr style="background:#10131C">' + thd('#', 'left') + thd('Produit', 'left') + thd('CIP 13', 'left') +
        thd('Boîtes / mois', 'center') + thd('PPHT', 'right') + thd('Prix net Intégral', 'right') + thd('Montant / mois', 'right') + '</tr></thead>') + '</div>' +
        (trs.length > 3 ? tab(trs.slice(3)) : '');
    }).join('');
    var chiffre = function (t, v, bleu) { return '<div style="flex:1;border:1px solid #E1E7F1;border-radius:8px;padding:9px 12px;background:#F7F9FC"><div style="font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#5B6477">' + t +
      '</div><div style="font-size:19px;font-weight:800;margin-top:2px;color:' + (bleu ? '#0050E6' : '#10131C') + '">' + v + '</div></div>'; };
    return '<div style="width:794px;background:#FFFFFF;color:#10131C;font-family:Satoshi,Inter,system-ui,sans-serif;font-size:12px;line-height:1.35">' +
      // En-tête des PDF du bureau (19/10) : le vrai logo dans une pastille blanche, puis « Sélection Intégral Pharma ».
      // Copie locale du logo (même origine) : html2canvas la reprend dans le PDF.
      '<div style="background:linear-gradient(90deg,#0034A0,#0050E6);padding:13px 26px;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:15px"><div style="border-radius:9px;background:#FFFFFF;padding:6px 10px;display:flex"><img src="' + LOGO + '" alt="Intégral Pharma" style="height:46px;width:auto;display:block"></div>' +
        '<div style="color:#FFFFFF;font-size:16px;font-weight:800;line-height:1.1">Sélection Intégral Pharma</div></div>' +
        '<div style="text-align:right;color:#FFFFFF"><div style="font-size:12px;color:#C9D8F8">Édité le ' + esc(jour) + '</div><div style="font-size:12px;font-weight:700;margin-top:1px">' + entier(s.refs) + ' produits</div></div></div>' +
      '<div style="background:#10131C;padding:6px 22px;page-break-inside:avoid"><span style="color:#C7D2E6;font-size:9.5px;font-weight:600;letter-spacing:.3px;text-transform:uppercase">Sélection pour ' + eur0(s.budget) + ' d’achats par mois · prix nets à partir du ' + esc(dateB) + '</span></div>' +
      '<div style="padding:16px 22px 20px"><div style="display:flex;gap:10px;margin-bottom:6px;page-break-inside:avoid">' +
        chiffre('Montant de la sélection', eur0(s.ca) + ' HT / mois', true) + chiffre('Produits', entier(s.refs)) + chiffre('Boîtes par mois', entier(s.boites)) + '</div>' +
        blocs +
        '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:#EEF3FD;border:1px solid #D5E1FA;border-radius:8px;padding:10px 14px;page-break-inside:avoid">' +
          '<b style="font-size:13px">Total de la sélection · ' + entier(s.boites) + ' boîtes par mois</b><span style="font-size:17px;font-weight:800;color:#0050E6;font-family:' + MONO + '">' + eur2(s.ca) + ' HT</span></div>' +
        '<div style="margin-top:14px;padding-top:9px;border-top:1px solid #E7EBF2;font-size:8.5px;color:#5B6477;line-height:1.5"><span style="font-weight:800;color:#0050E6">Intégral Pharma</span> · groupe de grossistes-répartiteurs. ' +
          'Prix nets HT indicatifs à partir du ' + esc(dateB) + ', édités le ' + esc(jour) + ' : les tarifs des laboratoires peuvent évoluer d’ici là.<br>' +
          'PPHT barré : le prix net Intégral est inférieur au tarif. Non remboursables : prix libre, prix net seul. Les produits froids sont regroupés en tête.</div>' +
      '</div></div>';
  }
  function ouvrirPdf(i) {
    var s = D.listes[i]; if (!s) return;
    if (!V2.pdfPreview) { if (V2.toast) V2.toast('Module PDF indisponible', 'error'); return; }
    V2.pdfPreview(pdfHtml(s), 'Selection-Integral-Pharma-' + s.budget + '-euros-par-mois.pdf', 'Sélection Intégral Pharma');
  }

  // ── Écrans d'état ─────────────────────────────────────────────────
  function top() { return (V2.topbar ? V2.topbar({ back: true, nom: 'Listing produits 2027' }) : ''); }
  function message(root, titre, texte, bouton) {
    css();
    root.innerHTML = top() + '<div class="v2-wrap mp-wrap"><div class="mp-etat" data-etat="1"><div class="mp-lock">' + ICO('euro', 26, 1.8) + '</div><h1 class="mp-et">' + esc(titre) + '</h1><p>' + esc(texte) + '</p>' + (bouton || '') + '</div></div>';
  }
  function chargement(root) { css(); root.innerHTML = top() + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>'; }

  function dessiner(root) {
    var y = window.pageYOffset || 0;
    root.innerHTML = top() + '<div class="v2-wrap mp-wrap" data-ls-page="1">' + enTete() + kpis() + sectionExplication() + sectionListes() + sectionMasse() + pied() + '</div>';
    racine = root;
    majResultat();
    try { window.scrollTo(0, y); } catch (e) {}
  }
  function enRoute() { return !!(V2.route && V2.route.name === 'listings2027'); }

  function brancher() {
    if (ecouteurs) return; ecouteurs = true;
    document.addEventListener('click', function (e) {
      if (!enRoute()) return;
      var b = e.target.closest ? e.target.closest('[data-ls]') : null; if (!b) return;
      var a = b.getAttribute('data-ls');
      if (a === 'ouv' && D) {
        var i = +b.getAttribute('data-i'), it = b.parentNode, det = it.querySelector('.ls-det'), o = !S.ouvert[i];
        S.ouvert[i] = o; it.classList.toggle('ouvert', o); b.setAttribute('aria-expanded', String(o));
        if (o) { det.innerHTML = detail(D.listes[i]); det.hidden = false; } else { det.hidden = true; det.innerHTML = ''; }
      } else if (a === 'pdf' && D) { ouvrirPdf(+b.getAttribute('data-i')); }
      else if (a === 'palier' && D) {
        S.p = +b.getAttribute('data-p');
        [].forEach.call(document.querySelectorAll('[data-ls="palier"]'), function (x) { var on = (+x.getAttribute('data-p') === S.p); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
        majResultat();
      } else if (a === 'reessayer') { accesEchec = false; if (etatFichier === 'refuse') etatFichier = 'attente'; V2.render(); }
      else if (a === 'recharger') { try { window.location.reload(); } catch (x) {} }
    });
    document.addEventListener('input', function (e) {
      if (!D || !enRoute() || !e.target || !e.target.classList || !e.target.classList.contains('ls-n')) return;
      var v = String(e.target.value).replace(/[^0-9]/g, '').slice(0, 5), n = Math.min(MAX_PHARMACIES, parseInt(v || '0', 10) || 0);
      if (e.target.value !== v) e.target.value = v;
      S.n[+e.target.getAttribute('data-i')] = n;
      majResultat();
    });
  }

  V2.pages = V2.pages || {};
  V2.pages.listings2027 = {
    needs: [],     // le fichier de chiffres n'est demandé qu'APRÈS le contrôle d'accès (voir charger)
    render: function (root) {
      css(); racine = root;
      if (acces === null) {
        if (accesEchec) {
          message(root, 'Connexion impossible pour l’instant', 'L’écran n’a pas pu vérifier votre accès. Réessayez dans un instant.',
            '<button class="v2-btn v2-btn-primary" data-ls="reessayer">Réessayer</button>');
          brancher();
          return;
        }
        chargement(root);
        verifier().then(function () {
          if (acces === null) accesEchec = true;
          if (!enRoute()) return;
          V2.render();
        });
        return;
      }
      if (acces === false) {
        message(root, 'Cet écran est réservé', 'Le listing produits 2027 n’est visible que depuis un compte autorisé. Ce compte n’y a pas accès.',
          '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'home\')">Retour à l’accueil</button>');
        return;
      }
      if (etatFichier === 'attente') {
        chargement(root);
        charger().then(function () { if (enRoute()) V2.render(); });
        return;
      }
      if (etatFichier === 'refuse' || !window.MARGE_PRODUITS) {
        message(root, 'Ces chiffres sont réservés', 'Le fichier du listing produits n’a pas pu être ouvert avec ce compte. Si la connexion a été coupée, réessayez dans un instant.',
          '<button class="v2-btn v2-btn-primary" data-ls="reessayer">Réessayer</button>');
        brancher();
        return;
      }
      if (!D) {
        if (!window.MARGE_PRODUITS.listings) {   // ancien fichier encore rangé sur cet appareil : la page ne plante pas, elle le dit
          message(root, 'Données en cours de mise à jour', 'Les chiffres de cette page viennent d’être renouvelés et cet appareil garde encore l’ancienne version. Rechargez la page pour les recevoir.',
            '<button class="v2-btn v2-btn-primary" data-ls="recharger">Recharger la page</button>');
          brancher();
          return;
        }
        try { D = preparer(window.MARGE_PRODUITS); }
        catch (e) { console.error('[V2 listings2027]', e); message(root, 'Ces chiffres ne se lisent pas', 'Le fichier du listing produits est illisible. Il faut le régénérer.'); return; }
      }
      brancher();
      dessiner(root);
    }
  };

  // Calculs exposés : la preuve les recalcule indépendamment.
  V2.listings2027 = {
    simuler: function (nbs, p) { return D ? simuler(nbs, p) : null; },
    prime: function (marge, p) { return D ? prime(marge, p) : null; },
    pdfHtml: function (i) { return D && D.listes[i] ? pdfHtml(D.listes[i]) : null; },
    donnees: function () { return D; },
    // La ligne du menu du compte : posée seulement si la base dit oui, juste sous « Notre marge par produit ».
    menu: function (m) {
      verifier().then(function (ok) {
        if (!ok || !m || !m.parentNode || m.querySelector('.ls-um')) return;
        var b = document.createElement('button');
        b.className = 'v2-um-item ls-um';
        b.innerHTML = ICO('euro', 16, 2) + 'Listing produits 2027';
        b.onclick = function () { if (m.parentNode && m.classList.contains('v2-usermenu')) m.parentNode.removeChild(m); V2.go('listings2027'); };
        var ref = m.querySelector('.mp-um');
        if (ref) { if (ref.nextSibling) ref.parentNode.insertBefore(b, ref.nextSibling); else ref.parentNode.appendChild(b); }
        else { var prem = m.querySelector('.v2-um-item'); if (prem) m.insertBefore(b, prem); else m.appendChild(b); }
      });
    }
  };

  // ── Habillage : celui de « Notre marge par produit » + quelques pièces propres ──
  function css() {
    if (V2.margeproduits && V2.margeproduits.css) V2.margeproduits.css();
    if (document.getElementById('ls-css')) return;
    var s = document.createElement('style'); s.id = 'ls-css';
    s.textContent = [
      '.ls-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '.ls-kpis .mp-kv{font-size:26px}',
      '.ls-sh2{margin-top:26px}.ls-h3{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.ls-expl{padding:20px 22px}',
      '.ls-ex-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}',
      '.ls-ex{border:1px solid var(--line);border-radius:var(--r-card);padding:14px 16px;background:var(--card-2)}',
      '.ls-ex-t{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}',
      '.ls-ex b{font-weight:800}.ls-ex p{margin:8px 0 0;font-size:14px;line-height:1.55;color:var(--ip-ink-2)}',
      '.ls-taux{font-family:var(--mono);color:#0A6C86}',
      '.mp-fams .mp-fn small{max-width:200px}',
      /* liste des listings */
      /* les 6 PDF à remettre */
      '.ls-pdfs{padding:16px 18px;margin-bottom:14px}',
      '.ls-pdfs-t{display:flex;flex-direction:column;gap:3px;margin-bottom:12px}.ls-pdfs-t b{font-size:15px;font-weight:800}.ls-pdfs-t span{font-size:13px;color:var(--muted)}',
      '.ls-pdfs-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '.ls-pdf{display:flex;align-items:center;gap:10px;min-height:56px;padding:10px 12px;text-align:left;font:inherit;color:var(--ip-ink,#10131C);background:var(--card-2);border:1px solid var(--line);border-radius:12px;cursor:pointer}',
      '.ls-pdf svg{flex:none;color:#0050E6}',
      '.ls-pdf span{display:flex;flex-direction:column;gap:1px;min-width:0}.ls-pdf b{font-size:13.5px;font-weight:800}.ls-pdf small{font-size:12px;font-weight:600;color:var(--muted)}',
      '.ls-pdf:hover{border-color:#0050E6;background:color-mix(in srgb,#0050E6 6%,var(--card))}',
      '.ls-pdf:focus-visible{outline:2px solid #0050E6;outline-offset:2px}',
      '.ls-list{overflow:hidden}',
      '.ls-row{grid-template-columns:minmax(0,1.1fr) 116px 108px 80px 250px 150px 22px;width:100%;text-align:left;font:inherit;font-size:13.5px;color:inherit;background:none;border:0;border-bottom:1px solid var(--line-2);cursor:pointer;min-height:64px}',
      '.ls-row.ls-hd{cursor:default;min-height:0;font-size:12px}',
      '.ls-btn:hover{background:var(--card-2)}',
      '.ls-btn:focus-visible{outline:2px solid #0A6C86;outline-offset:-2px}',
      '.ls-it.ouvert .ls-btn{background:var(--card-2)}',
      '.ls-it.ouvert .mp-chev{transform:rotate(-135deg)}',
      '.ls-chip{display:inline-block;font-family:var(--mono);font-weight:800;color:#0A6C86;background:color-mix(in srgb,var(--c-froid) 13%,#fff);padding:3px 10px;border-radius:20px;box-shadow:0 0 0 1px color-mix(in srgb,var(--c-froid) 30%,transparent)}',
      '.ls-pr{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.ls-pr b{font-weight:800}.ls-pr small{font-family:var(--font);font-size:12px;font-weight:600;color:var(--muted)}',
      '.ls-det{padding:6px 22px 18px;background:var(--card-2);border-bottom:1px solid var(--line)}.ls-det[hidden]{display:none}',
      '.ls-pl{display:grid;grid-template-columns:34px minmax(0,1fr) 80px 100px 110px 110px;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line-2);font-size:13.5px}',
      '.ls-plh{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-top:0;padding-bottom:6px}.ls-plh .c{text-align:right}',
      /* en masse */
      '.ls-masse{padding:20px 22px}',
      '.ls-champs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}',
      '.ls-champs .mp-field input{text-align:right;font-family:var(--mono)}',
      '.ls-palier{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:18px}',
      '.ls-bar{margin-top:12px}',
      '.ls-res{margin-top:16px;border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;background:var(--card)}',
      '.ls-rl{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 1fr 1fr;gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid var(--line-2);font-size:14px}',
      '.ls-rl:last-child{border-bottom:0}',
      '.ls-rh{background:var(--card-2);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:10px;padding-bottom:10px}.ls-rh .c{text-align:right}',
      '.ls-rn{font-weight:700}',
      '.ls-rv{font-family:var(--mono);text-align:right;font-variant-numeric:tabular-nums;font-weight:600}.ls-rv b{font-weight:800}',
      '.ls-re b.neg{color:var(--c-rose-txt)}.ls-re b.pos{color:var(--c-mint-txt)}',
      '@media(max-width:1040px){.ls-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.ls-row{grid-template-columns:minmax(0,1fr) 100px 90px 70px 160px 140px 18px;gap:10px}',
      '.ls-pl{grid-template-columns:30px minmax(0,1fr) 70px 90px 100px 100px}}',
      '@media(max-width:720px){',
      '.ls-kpis{grid-template-columns:minmax(0,1fr)}',
      '.ls-ex-g{grid-template-columns:minmax(0,1fr)}',
      '.ls-expl,.ls-masse,.ls-pdfs{padding:16px}',
      '.ls-pdfs-g{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.ls-hd{display:none}',
      '.ls-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px;padding:14px 38px 14px 16px;position:relative;align-items:start}',
      '.ls-row .mp-n{grid-column:1/-1}',
      '.ls-pr{align-items:flex-start}',
      '.ls-row .mp-c.ls-pr{display:flex}',
      '.ls-btn .mp-chev{position:absolute;right:16px;top:22px}',
      '.ls-det{padding:4px 16px 16px}',
      '.ls-plh{display:none}',
      '.ls-pl{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px;position:relative;padding-left:0}',
      '.ls-pl .mp-rk{display:none}.ls-pl .mp-n{grid-column:1/-1}.ls-pl .mp-n b{white-space:normal}',
      '.ls-champs{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.ls-palier{flex-direction:column;align-items:stretch}.ls-palier .mp-seg{width:100%}.ls-palier .mp-seg button{flex:1 1 0;padding:0 8px}',
      '.ls-rh{display:none}',
      '.ls-rl{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 8px;padding:14px 14px}',
      '.ls-rn{grid-column:1/-1}',
      '.ls-rv{text-align:left;font-size:14px}.ls-rv::before{content:attr(data-l);display:block;font-family:var(--font);font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:2px}',
      '.mp-fiche{width:100%}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
