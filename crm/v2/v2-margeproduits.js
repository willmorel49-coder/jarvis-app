/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Notre marge par produit (V2.margeproduits) — 14/10/2026

   Will : « je veux vraiment voir un visuel de taux de marge par produits pour
   nous et les best produits à vendre ».

   · Réservé : l'écran n'existe que pour les comptes de
     jarvis_acces_marge_produits() (_sql/marge-produits.sql). Aucune tuile,
     aucune entrée de recherche : on y entre par le menu du compte, qui ne
     montre la ligne qu'à ces comptes. La vraie barrière est côté base : le
     fichier marge-produits.js (racine du seau protégé) ne se lit que par ces
     comptes. Celle de l'écran n'est qu'un confort.
   · Le fichier laisse deviner nos prix d'achat : il n'est JAMAIS dans le dépôt
     (.gitignore). Il est demandé APRÈS le contrôle d'accès, jamais avant.
   · Aucun chiffre métier n'est écrit ici : tout se lit dans
     window.MARGE_PRODUITS.meta / .familles. Les seules constantes ci-dessous
     sont des réglages d'AFFICHAGE (nombre de lignes, plancher de l'échelle).
   · Graphiques en SVG inline, sans librairie ; aucun flou, aucun verre dépoli.
   · 22/10/2026 — fusionné dans « Listing produits 2027 » (demande de Will) : plus de ligne
     de menu à part ; cet écran rend les onglets « Marge par produit » (#margeproduits) et
     « Marge par officine » (#margeproduits/officine) de cette page, sous le même titre.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : (window.ICO ? window.ICO(n, s, w) : ''); };

  // ── Réglages d'affichage (pas des données métier) ─────────────────
  var N_PRIORITE = 30;          // longueur de la liste « À vendre en priorité »
  var N_PAGE = 50;              // lignes du grand tableau, puis « Voir plus »
  var N_SANS = 8;               // lignes montrées dans « Tournent sans rapporter »
  var DESSIN_MIN_BOITES = 20;   // le nuage ne dessine que les produits d'au moins ce volume (fluidité)
  var Y_PLANCHER = 0.01;        // bas de l'échelle des marges par boîte (en dessous : bande « nulle ou négative »)
  var SANS_RAPPORT = { boites: 1000, marge: 0.05 };   // « tournent sans rapporter »
  // Couleurs par famille (ordre des familles du fichier). Validées par le contrôle
  // de la skill dataviz (écart entre voisins, contraste) ; le froid est l'accent fort.
  var COULEURS = ['#0891B2', '#E0556E', '#3A4A9C', '#C7791A', '#6D4FC4', '#8A93A8', '#1E9E6A'];
  var GRIS_FAMILLE = '#8A93A8';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ── État ──────────────────────────────────────────────────────────
  var acces = null, accesP = null, accesEchec = false;   // accesEchec : la base n'a pas répondu (ni oui ni non)
  var etatFichier = 'attente';   // attente | charge | refuse
  var D = null;                  // données préparées
  var S = { K: null, fam: '', q: '', tri: 'mm', sens: -1, n: N_PAGE, masq: {}, sansTout: false, epingle: null,
    vue: 'produit', oq: '', oComm: '', oSans: false, oTri: 'pf', oN: N_PAGE, oOuvert: {},
    perim: null, oCase: null, oAl: '', lst: -1 };   // pilotage : périmètre (null = pas encore choisi), case et alerte filtrées, listing
  var memo = {};
  var racine = null, ecouteurs = false, minuterie = null, dernierToucher = 0;

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

  // ── Fichier protégé ───────────────────────────────────────────────
  function charger() {
    if (window.MARGE_PRODUITS) { etatFichier = 'charge'; return Promise.resolve(); }
    if (!V2.loadFiles) { etatFichier = 'refuse'; return Promise.resolve(); }
    return V2.loadFiles(['margeproduits']).then(function () {
      etatFichier = window.MARGE_PRODUITS ? 'charge' : 'refuse';
    }, function () { etatFichier = 'refuse'; });
  }

  // ── Préparation des données ───────────────────────────────────────
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function preparer(M) {
    var meta = M.meta || {}, cols = meta.colonnes || [], ix = {}, i;
    for (i = 0; i < cols.length; i++) ix[cols[i]] = i;
    var an0 = Math.floor((meta.periode && meta.periode.de || 0) / 100) || 0;
    var an1 = an0 + 1;
    var k0 = String(an0).slice(2), k1 = String(an1).slice(2);
    var rows = [], max = { boites: 0 };
    for (i = 0; i < M.produits.length; i++) {
      var p = M.produits[i], g = function (n) { return p[ix[n]]; };
      var r = {
        i: i, nom: String(g('nom') || ''), labo: String(g('labo') || ''), f: g('famille'), prix: g('prix_net'),
        b: g('boites_mois') || 0, o: g('officines') || 0,
        mb: {}, t: {}, mm: {},
        mj: g('marge_janv_27') || 0, bj: g('boites_janv_27') || 0, dispo: g('dispo_2027') === 1, cip: String(g('cip') || '')
      };
      r.mb[k0] = g('marge_boite_' + k0); r.mb[k1] = g('marge_boite_' + k1);
      r.t[k0] = g('taux_' + k0); r.t[k1] = g('taux_' + k1);
      r.mm[k0] = g('marge_mois_' + k0); r.mm[k1] = g('marge_mois_' + k1);
      r.nomN = norm(r.nom + ' ' + r.labo + ' ' + r.cip);
      rows.push(r);
      if (r.b > max.boites) max.boites = r.b;
    }
    return { M: M, meta: meta, fams: M.familles || [], rows: rows, an0: an0, an1: an1, k0: k0, k1: k1, max: max };
  }
  // ── Vue « Par officine » : lignes du fichier (clé « officines ») ──
  function preparerOfficines(M, Dp) {
    var O = M.officines, om = M.officines_meta;
    if (!O || !om || !O.lignes || !O.colonnes) return null;
    var ix = {}, i;
    for (i = 0; i < O.colonnes.length; i++) ix[O.colonnes[i]] = i;
    var comm = om.commerciaux || [], seuilSans = om.sans_froid_boites_mois_max, k0 = Dp.k0, k1 = Dp.k1;
    var premierRecent = om.mois_actifs && om.mois_actifs.length ? Math.min.apply(null, om.mois_actifs) : 0;
    var rows = O.lignes.map(function (l) {
      var g = function (n) { return l[ix[n]]; };
      var r = { code: String(g('code')), nom: String(g('nom') || ''), ville: String(g('ville') || ''), cp: String(g('cp') || ''),
        ca: g('ca_hors_froid_mois') || 0, fb: g('froid_boites_mois') || 0, nf: g('nb_froids_suivis_achetes') || 0, dernier: g('dernier_mois'),
        comm: comm[g('commercial')] || '', manq: g('manques') || [], m: {}, pf: {}, pt: {} };
      r.m[k0] = g('marge_mois_' + k0); r.m[k1] = g('marge_mois_' + k1);
      r.pf[k0] = g('pot_froid_' + k0); r.pf[k1] = g('pot_froid_' + k1);
      r.pt[k0] = g('pot_total_' + k0); r.pt[k1] = g('pot_total_' + k1);
      r.sans = r.fb < seuilSans;
      r.plus = !!(premierRecent && typeof r.dernier === 'number' && r.dernier < premierRecent);   // « Plus d’achat depuis … » (dernier achat avant le premier mois récent)
      r.nomN = norm(r.nom + ' ' + r.ville + ' ' + r.cp + ' ' + r.code);
      return r;
    });
    return { rows: rows, meta: om, comm: comm, pil: lirePilotage(M, rows, Dp) };
  }
  var memoO = {};
  function calcO(K) {
    if (memoO[K]) return memoO[K];
    var rows = D.off.rows, n = rows.length, sans = 0, pf = 0, pt = 0;
    rows.forEach(function (r) { if (r.sans) sans++; pf += r.pf[K]; pt += r.pt[K]; });
    memoO[K] = { n: n, sans: sans, pf: pf, pt: pt };
    return memoO[K];
  }
  function trouverFam(re) { for (var i = 0; i < D.fams.length; i++) if (re.test(D.fams[i].nom)) return i; return -1; }
  function couleurFam(i) { return COULEURS[i] || GRIS_FAMILLE; }
  function nomFam(i) { return D.fams[i] ? D.fams[i].nom : '—'; }

  // ── Calculs (tout vient du fichier) ───────────────────────────────
  function calc(K) {
    if (memo[K]) return memo[K];
    var t = D.meta.total || {}, seuil = D.meta.seuils_a_pousser || {};
    var margeTot = t['marge_mois' + K], i, f;
    var fams = D.fams.map(function (f, idx) {
      var m = f['marge_mois' + K];
      return { i: idx, nom: f.nom, refs: f.refs, boites: f.boites_mois, ca: f.ca_mois, marge: m,
        pB: t.boites_mois ? f.boites_mois / t.boites_mois : 0, pM: margeTot ? m / margeTot : 0,
        mb: f.boites_mois ? m / f.boites_mois : 0, taux: f.ca_mois ? m / f.ca_mois : 0 };
    });
    var cle = (K === D.k1) ? function (r) { return r.mj; } : function (r) { return r.mm[K]; };
    var prio = D.rows.filter(function (r) {
      return r.dispo && r.mb[K] >= (seuil.marge_boite_min || 0) && r.b >= (seuil.boites_mois_min || 0);
    }).sort(function (a, b) { return cle(b) - cle(a); });
    var prioTotal = prio.length, sommePrio = 0;
    prio = prio.slice(0, N_PRIORITE);
    prio.forEach(function (r) { sommePrio += cle(r); });
    var refTot = (K === D.k1) ? t.marge_janv27 : margeTot;
    var sans = D.rows.filter(function (r) { return r.b >= SANS_RAPPORT.boites && r.mb[K] < SANS_RAPPORT.marge; })
      .sort(function (a, b) { return b.b - a.b; });
    var sansBoites = 0, sansMarge = 0;
    sans.forEach(function (r) { sansBoites += r.b; sansMarge += r.mm[K]; });
    memo[K] = { K: K, t: t, margeTot: margeTot, fams: fams, prio: prio, prioTotal: prioTotal, sommePrio: sommePrio, refTot: refTot, cle: cle,
      maxCle: prio.length ? cle(prio[0]) : 1, sans: sans, sansBoites: sansBoites, sansMarge: sansMarge };
    return memo[K];
  }

  // ── Formats ───────────────────────────────────────────────────────
  function nf(n, dec) {
    try { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n); }
    catch (e) { return n.toFixed(dec || 0).replace('.', ','); }
  }
  function moins(s) { return s.replace(/^-/, '−'); }
  function eur0(n) { return moins(nf(Math.round(n))) + ' €'; }
  function eurBoite(n) {
    if (!isFinite(n)) return '—';
    if (n === 0) return '0 €';
    return moins(nf(n, Math.abs(n) < 0.1 ? 3 : 2)) + ' €';
  }
  function pct(v, d) { return moins(nf(v * 100, d == null ? 1 : d)) + ' %'; }
  function entier(n) { return moins(nf(Math.round(n))); }
  function boitesF(n) { return n >= 100 ? entier(n) : nf(n, 1); }
  function dateLongue(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    return parseInt(m[3], 10) + (m[3] === '01' ? 'er' : '') + ' ' + MOIS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  function periodeTexte() {
    var p = D.meta.periode || {}; if (!p.de || !p.a) return '';
    var m0 = p.de % 100, m1 = p.a % 100, y0 = Math.floor(p.de / 100), y1 = Math.floor(p.a / 100);
    return 'ventes ' + MOIS[m0 - 1] + (y0 !== y1 ? ' ' + y0 : '') + ' → ' + MOIS[m1 - 1] + ' ' + y1;
  }
  function anDe(K) { return K === D.k1 ? D.an1 : D.an0; }
  function nomCourt(nom) {
    var mots = String(nom).split(/\s+/), stop = /^(INJ|CPR|GELU|BT\d*|STYLO|SRG\d*|FL\+?|PDR|SACH|SOL|CR|TB|AMP|COMP|SUSP|BUV|SIROP)/i, out = [mots[0]];
    for (var i = 1; i < mots.length && i < 3; i++) { if (stop.test(mots[i])) break; if (/^[A-Za-zÀ-ÿ]{4,}$/.test(mots[i]) && i > 1) break; out.push(mots[i]); }
    return out.join(' ');
  }

  // ── Pièces ────────────────────────────────────────────────────────
  function chipFam(i) { return '<span class="mp-fam" style="--c:' + couleurFam(i) + '"><i></i>' + esc(nomFam(i)) + '</span>'; }
  function segment(K) {
    var h = '<div class="mp-seg" role="group" aria-label="Année du barème">';
    [[D.k0, D.an0], [D.k1, D.an1]].forEach(function (a) {
      h += '<button type="button" data-act="an" data-k="' + a[0] + '" aria-pressed="' + (K === a[0]) + '" class="' + (K === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
    });
    return h + '</div>';
  }
  function barre(part, couleur, max) {
    var w = Math.max(0, Math.min(1, max ? part / max : 0)) * 100;
    return '<span class="mp-bar"><i style="width:' + w.toFixed(2) + '%;background:' + couleur + '"></i></span>';
  }
  function ecartTexte(a, b) {
    var d = b - a, p = a ? d / a : 0;
    return '<b class="' + (d < 0 ? 'neg' : 'pos') + '">' + (d < 0 ? '−' : '+') + eur0(Math.abs(d)) + ' (' + (d < 0 ? '−' : '+') + pct(Math.abs(p)) + ')</b>';
  }

  // ── En-tête et chiffres clés ──────────────────────────────────────
  function enTete(C) {
    return '<div class="mp-hero">' +
      '<div class="mp-hero-t"><div class="mp-eyebrow"><span class="dot"></span>Accès réservé au groupe restreint</div>' +
      '<h1 class="mp-h1">Listing produits 2027</h1>' +
      (S.vue === 'officine'
        ? 
          '<p class="mp-sub">Les officines clientes qui n’achètent pas, ou peu, chez nous les produits qui rapportent, surtout le froid, et ce que cela rapporterait. ' +
          'Chiffres estimés par la direction (' + esc(periodeTexte()) + '), mis à jour le ' + esc(dateLongue(D.meta.genere_le)) + '.</p></div>'
        : '<p class="mp-sub">Où se fait notre marge, produit par produit, et lesquels il faut vendre en priorité. ' +
          'Chiffres estimés par la direction, sur les ventes de toute l’équipe (' + esc(periodeTexte()) + '), mis à jour le ' + esc(dateLongue(D.meta.genere_le)) + '.</p></div>') +
      '<div class="mp-hero-b"><div class="mp-hero-a"><span class="mp-seg-l">Barème</span>' + segment(C.K) + '</div></div></div>' +
      (V2.listings2027 && V2.listings2027.onglets ? V2.listings2027.onglets(S.vue === 'officine' ? 'officine' : 'produit') : '');
  }
  function kpis(C) {
    var K = C.K, t = C.t, h = '', iF = trouverFam(/^froid$/i), iP = trouverFam(/^petit prix\s*</i);
    var fF = iF >= 0 ? C.fams[iF] : null, fP = iP >= 0 ? C.fams[iP] : null;
    // 1 · marge par mois
    h += '<div class="mp-kpi" style="--k:var(--ip-blue)"><div class="mp-kl">Notre marge par mois en ' + anDe(K) + '</div>' +
      '<div class="mp-kv" data-k="marge">' + eur0(C.margeTot) + '</div>' +
      '<div class="mp-kd">' + D.an0 + ' : ' + eur0(t['marge_mois' + D.k0]) + ' → ' + D.an1 + ' : ' + eur0(t['marge_mois' + D.k1]) + '<br>Écart : ' +
      ecartTexte(t['marge_mois' + D.k0], t['marge_mois' + D.k1]) + ' par mois</div></div>';
    // 2 · le froid : boîtes contre marge
    if (fF) {
      h += '<div class="mp-kpi" style="--k:' + couleurFam(iF) + '"><div class="mp-kl">Le froid, en ' + anDe(K) + '</div>' +
        '<div class="mp-kv" data-k="froid"><span>' + pct(fF.pB) + '</span><small>des boîtes</small> <em>→</em> <span>' + pct(fF.pM) + '</span><small>de notre marge</small></div>' +
        '<div class="mp-duo2"><div><span>Boîtes</span>' + barre(fF.pB, '#9AA6C0', 1) + '</div><div><span>Marge</span>' + barre(fF.pM, couleurFam(iF), 1) + '</div></div>' +
        '<div class="mp-kd">Peu de boîtes, plus de la moitié de la marge.</div></div>';
    }
    // 3 · marge par boîte du froid contre un petit prix
    if (fF && fP && fP.mb > 0) {
      h += '<div class="mp-kpi" style="--k:' + couleurFam(iF) + '"><div class="mp-kl">Une boîte de froid contre un petit prix</div>' +
        '<div class="mp-kv" data-k="fois">× ' + nf(fF.mb / fP.mb, 0) + '</div>' +
        '<div class="mp-kd">' + eurBoite(fF.mb) + ' de marge par boîte de froid, contre ' + eurBoite(fP.mb) + ' pour un petit prix (' + esc(fP.nom) + ').</div></div>';
    }
    // 4 · la liste à pousser
    h += '<div class="mp-kpi" style="--k:var(--c-mint)"><div class="mp-kl">À vendre en priorité</div>' +
      '<div class="mp-kv" data-k="prio">' + eur0(C.sommePrio) + '</div>' +
      '<div class="mp-kd">C’est ce que rapportent les ' + C.prio.length + ' premiers produits ' + (K === D.k1 ? 'en janvier ' + D.an1 : 'par mois en ' + anDe(K)) +
      ', soit ' + pct(C.refTot ? C.sommePrio / C.refTot : 0, 0) + ' de notre marge ' + (K === D.k1 ? 'de ce mois' : 'mensuelle') + '. ' + entier(C.prioTotal) + ' produits répondent aux deux seuils.</div></div>';
    return '<div class="mp-kpis">' + h + '</div>';
  }

  // ── Où se fait notre marge ────────────────────────────────────────
  function sectionFamilles(C) {
    var rows = C.fams.slice().sort(function (a, b) { return b.pM - a.pM; });
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Où se fait notre marge</h2><span>Pour chaque famille : sa part des boîtes vendues, sa part de notre marge</span></div><div class="mp-card mp-fams">';
    h += '<div class="mp-fh" aria-hidden="true"><span>Famille</span><span>Part des boîtes · part de notre marge</span><span>Marge par boîte</span><span>Taux de marge</span></div>';
    rows.forEach(function (f) {
      h += '<div class="mp-fr"><div class="mp-fn">' + chipFam(f.i) + '<small>' + entier(f.refs) + ' références</small></div>' +
        '<div class="mp-fb"><div class="mp-fl"><span>Boîtes</span>' + barre(f.pB, '#9AA6C0', 1) + '<b>' + pct(f.pB) + '</b></div>' +
        '<div class="mp-fl m"><span>Notre marge</span>' + barre(f.pM, couleurFam(f.i), 1) + '<b>' + pct(f.pM) + '</b></div></div>' +
        '<div class="mp-fv" data-l="Marge par boîte">' + eurBoite(f.mb) + '</div>' +
        '<div class="mp-fv" data-l="Taux de marge">' + pct(f.taux) + '</div></div>';
    });
    return h + '</div></section>';
  }

  // ── Nuage rotation × marge par boîte ─────────────────────────────
  function sectionNuage(C) {
    var seuil = D.meta.seuils_a_pousser || {};
    var nGris = D.rows.filter(function (r) { return !r.dispo && r.b >= DESSIN_MIN_BOITES; }).length;
    var leg = '<div class="mp-legend" role="group" aria-label="Familles affichées">';
    D.fams.forEach(function (f, i) {
      if (!D.rows.some(function (r) { return r.f === i && r.b >= DESSIN_MIN_BOITES; })) return;
      leg += '<button type="button" class="mp-lg' + (S.masq[i] ? ' off' : '') + '" data-act="fam" data-f="' + i + '" aria-pressed="' + !S.masq[i] + '" style="--c:' + couleurFam(i) + '"><i></i>' + esc(f.nom) + '</button>';
    });
    if (nGris) leg += '<span class="mp-lg ghost"><i></i>Intégral ne l’aura plus</span>';
    leg += '</div>';
    return '<section class="mp-sec"><div class="mp-sh"><h2>Rotation × marge par boîte</h2><span>Chaque rond est un produit : plus il est à droite, plus il tourne ; plus il est haut, plus il rapporte par boîte</span></div>' +
      '<div class="mp-card mp-nuage">' + leg +
      '<div class="mp-chart" id="mp-chart"></div>' +
      '<p class="mp-note" id="mp-chart-note"></p>' +
      '<p class="mp-note">Les deux échelles sont logarithmiques : chaque graduation vaut dix fois la précédente. La taille du rond est proportionnelle à notre marge par mois. Les deux traits pointillés sont les seuils « à pousser » (' +
      entier(seuil.boites_mois_min || 0) + ' boîtes par mois, ' + eurBoite(seuil.marge_boite_min || 0) + ' par boîte). Survolez ou touchez un rond pour le détail.</p></div></section>';
  }

  var PTS = [];   // points dessinés (pour la détection du survol / du toucher)
  function dessinerNuage() {
    var host = document.getElementById('mp-chart'); if (!host || !D) return;
    var C = calc(S.K), K = S.K, seuil = D.meta.seuils_a_pousser || {};
    var W = Math.max(280, host.clientWidth || 600), mobile = W < 560;
    // sur téléphone, le nuage est plus serré : on ne dessine que les produits d'au moins la moitié du seuil de rotation
    var minB = mobile ? Math.max(DESSIN_MIN_BOITES, Math.round((seuil.boites_mois_min || 0) / 2)) : DESSIN_MIN_BOITES;
    var H = mobile ? 470 : 580, BAND = 30;
    var ml = mobile ? 46 : 62, mr = mobile ? 10 : 20, mt = 30, mb = 44;
    var pl = ml, pr = W - mr, pt = mt, pb = H - mb;       // cadre du tracé
    var yMinLine = pb - BAND;                               // position de Y_PLANCHER
    var tous = D.rows.filter(function (r) { return r.b >= minB; });
    var maxMB = 0, maxMM = 1;
    tous.forEach(function (r) { if (r.mb[K] > maxMB) maxMB = r.mb[K]; if (r.mm[K] > maxMM) maxMM = r.mm[K]; });
    var xMin = minB * 0.7, xMax = D.max.boites * 1.35, yMax = Math.max(maxMB * 1.25, (seuil.marge_boite_min || 1) * 10);
    var lx0 = Math.log(xMin), lx1 = Math.log(xMax), ly0 = Math.log(Y_PLANCHER), ly1 = Math.log(yMax);
    function X(v) { return pl + (Math.log(v) - lx0) / (lx1 - lx0) * (pr - pl); }
    function Y(v) { return pt + (ly1 - Math.log(v)) / (ly1 - ly0) * (yMinLine - pt); }
    var rMax = mobile ? 12 : 19, rMin = mobile ? 2.2 : 2.6;

    PTS = [];
    tous.forEach(function (r) {
      if (S.masq[r.f]) return;
      var v = r.mb[K], mm = Math.max(0, r.mm[K]);
      var y = v > Y_PLANCHER ? Y(v) : (yMinLine + 8 + ((r.i * 37) % 100) / 100 * (BAND - 14));
      PTS.push({ r: r, x: X(r.b), y: y, rad: rMin + Math.sqrt(mm / maxMM) * (rMax - rMin), gris: !r.dispo });
    });
    var ordre = PTS.slice().sort(function (a, b) {
      var fa = (a.r.f === 0 && !a.gris) ? 1 : 0, fb = (b.r.f === 0 && !b.gris) ? 1 : 0;   // le froid par-dessus
      return fa - fb || b.rad - a.rad;
    });

    var s = '<svg class="mp-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Nuage de points : boîtes vendues par mois et notre marge par boîte, un rond par produit">';
    s += '<defs><radialGradient id="mp-qgrad" cx="100%" cy="0%" r="95%"><stop offset="0" stop-color="#0891B2" stop-opacity=".20"/><stop offset=".55" stop-color="#0891B2" stop-opacity=".07"/><stop offset="1" stop-color="#0891B2" stop-opacity="0"/></radialGradient></defs>';
    // quart « à vendre en priorité »
    var qx = X(seuil.boites_mois_min || xMin), qy = Y(seuil.marge_boite_min || Y_PLANCHER);
    s += '<rect x="' + qx.toFixed(1) + '" y="' + pt + '" width="' + (pr - qx).toFixed(1) + '" height="' + (qy - pt).toFixed(1) + '" fill="url(#mp-qgrad)"/>';
    // bande « nulle ou négative »
    s += '<rect x="' + pl + '" y="' + yMinLine + '" width="' + (pr - pl) + '" height="' + BAND + '" fill="#F4F6FB"/>';
    // grille et graduations
    var gx = [100, 1000, 10000, 100000], gy = [0.01, 0.1, 1, 10];
    gx.forEach(function (v) {
      if (v < xMin || v > xMax) return;
      s += '<line x1="' + X(v).toFixed(1) + '" x2="' + X(v).toFixed(1) + '" y1="' + pt + '" y2="' + pb + '" stroke="rgba(16,19,28,.07)"/>';
      s += '<text x="' + X(v).toFixed(1) + '" y="' + (pb + 18) + '" text-anchor="middle" class="mp-ax">' + entier(v) + '</text>';
    });
    gy.forEach(function (v) {
      if (v < Y_PLANCHER || v > yMax) return;
      s += '<line x1="' + pl + '" x2="' + pr + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="rgba(16,19,28,.07)"/>';
      s += '<text x="' + (pl - 7) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="mp-ax">' + nf(v, v < 1 ? (v < 0.1 ? 2 : 1) : 0) + ' €</text>';
    });
    s += '<text x="' + (pl - 7) + '" y="' + (yMinLine + BAND / 2 + 4) + '" text-anchor="end" class="mp-ax">≤ 0</text>';
    s += '<text x="' + (pr) + '" y="' + (yMinLine + 12) + '" text-anchor="end" class="mp-ax s">Marge nulle ou négative</text>';
    s += '<line x1="' + pl + '" x2="' + pr + '" y1="' + pb + '" y2="' + pb + '" stroke="rgba(16,19,28,.22)"/>';
    s += '<line x1="' + pl + '" x2="' + pr + '" y1="' + yMinLine + '" y2="' + yMinLine + '" stroke="rgba(16,19,28,.12)"/>';
    // seuils
    s += '<line x1="' + qx.toFixed(1) + '" x2="' + qx.toFixed(1) + '" y1="' + pt + '" y2="' + pb + '" stroke="#0A6C86" stroke-width="1.4" stroke-dasharray="5 5"/>';
    s += '<line x1="' + pl + '" x2="' + pr + '" y1="' + qy.toFixed(1) + '" y2="' + qy.toFixed(1) + '" stroke="#0A6C86" stroke-width="1.4" stroke-dasharray="5 5"/>';
    // les ronds
    ordre.forEach(function (p) {
      var cx = p.x.toFixed(1), cy = p.y.toFixed(1), rr = p.rad.toFixed(1);
      if (p.gris) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="#E3E6EE" fill-opacity=".7" stroke="#8A93A8" stroke-width="1" stroke-dasharray="2 2"/>';
      else if (p.r.f === 0) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + couleurFam(0) + '" fill-opacity=".82" stroke="#fff" stroke-width="1.2"/>';
      else s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + couleurFam(p.r.f) + '" fill-opacity=".5" stroke="' + couleurFam(p.r.f) + '" stroke-opacity=".75" stroke-width=".8"/>';
    });
    // étiquettes des plus gros
    var plein = PTS.filter(function (p) { return !p.gris; }).sort(function (a, b) { return b.r.mm[K] - a.r.mm[K]; });
    var nEt = mobile ? 4 : 8, etiq = '';
    var lblV = entier(seuil.boites_mois_min || 0) + ' boîtes par mois', lblH = eurBoite(seuil.marge_boite_min || 0) + ' par boîte';
    var wQ = 150, wV = lblV.length * 6.6, vGauche = (qx - 6 - wV) < pl + 2;
    // zones déjà occupées par les libellés fixes : les étiquettes de produits les évitent
    var pris = [{ x: pr - 10 - wQ, y: pt + 8, w: wQ, h: 22 }, { x: pl + 8, y: qy - 20, w: lblH.length * 6.6, h: 16 },
      { x: vGauche ? qx + 6 : qx - 6 - wV, y: yMinLine - 22, w: wV, h: 16 }];
    for (var i = 0; i < plein.length && pris.length < nEt; i++) {
      var p = plein[i], txt = nomCourt(p.r.nom), w = txt.length * 6.9 + 4, h = 15;
      var essais = [[p.x + p.rad + 4, p.y + 4, 'start', p.x + p.rad + 4, p.y - 11], [p.x - p.rad - 4, p.y + 4, 'end', p.x - p.rad - 4 - w, p.y - 11],
        [p.x, p.y - p.rad - 5, 'middle', p.x - w / 2, p.y - p.rad - 17], [p.x, p.y + p.rad + 14, 'middle', p.x - w / 2, p.y + p.rad + 2]];
      for (var j = 0; j < essais.length; j++) {
        var e = essais[j], bx = e[3], by = e[4];
        if (bx < pl || bx + w > pr + 2 || by < pt - 4 || by + h > pb) continue;
        if (pris.some(function (q) { return bx < q.x + q.w && bx + w > q.x && by < q.y + q.h && by + h > q.y; })) continue;
        pris.push({ x: bx, y: by, w: w, h: h });
        etiq += '<text x="' + e[0].toFixed(1) + '" y="' + e[1].toFixed(1) + '" text-anchor="' + e[2] + '" class="mp-lab">' + esc(txt) + '</text>';
        break;
      }
    }
    s += etiq;
    // libellés des seuils et du quart
    s += '<text x="' + (vGauche ? qx + 6 : qx - 6).toFixed(1) + '" y="' + (yMinLine - 8) + '" text-anchor="' + (vGauche ? 'start' : 'end') + '" class="mp-seu">' + lblV + '</text>';
    s += '<text x="' + (pl + 8) + '" y="' + (qy - 6).toFixed(1) + '" class="mp-seu">' + lblH + '</text>';
    s += '<text x="' + (pr - 10) + '" y="' + (pt + 26) + '" text-anchor="end" class="mp-quart">À vendre en priorité</text>';
    // titres d'axes
    s += '<text x="' + ((pl + pr) / 2).toFixed(0) + '" y="' + (H - 6) + '" text-anchor="middle" class="mp-axt">Boîtes vendues par mois</text>';
    s += '<text x="4" y="15" class="mp-axt">Notre marge par boîte \u2191</text>';
    s += '<g id="mp-sel"></g></svg>';
    s += '<div class="mp-tip" id="mp-tip" role="status" aria-live="polite" hidden></div>';
    host.innerHTML = s;
    host.__geo = { W: W, H: H };
    var plus = D.rows.length - tous.length;
    var note = document.getElementById('mp-chart-note');
    if (note) note.textContent = 'Pour que le graphique reste fluide, seuls les ' + entier(tous.length) + ' produits vendus à ' + entier(minB) + ' boîtes par mois ou plus sont dessinés (sur ' + entier(D.rows.length) + '). Les ' + entier(plus) + ' autres figurent dans le tableau plus bas.';
    S.epingle = null;
  }

  function trouverPoint(x, y, marge) {
    var best = null, bd = 1e9;
    for (var i = 0; i < PTS.length; i++) {
      var p = PTS[i], dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx * dx + dy * dy) - p.rad;
      if (d <= marge && (d < bd - 0.5 || (Math.abs(d - bd) <= 0.5 && best && p.rad < best.rad))) { bd = d; best = p; }
    }
    return best;
  }
  function montrerBulle(p, epingle) {
    var host = document.getElementById('mp-chart'), tip = document.getElementById('mp-tip'), sel = document.getElementById('mp-sel');
    if (!host || !tip || !sel) return;
    var K = S.K, r = p.r, W = host.__geo.W;
    sel.innerHTML = '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (p.rad + 3).toFixed(1) + '" fill="none" stroke="#10131C" stroke-width="2"/>';
    tip.innerHTML = (epingle ? '<button type="button" class="mp-tx" data-act="fermer" aria-label="Fermer">×</button>' : '') +
      '<div class="mp-tn">' + esc(r.nom) + '</div><div class="mp-tl">' + esc(r.labo) + '</div>' +
      '<div class="mp-tf">' + chipFam(r.f) + '</div>' +
      '<dl><div><dt>Boîtes par mois</dt><dd>' + boitesF(r.b) + '</dd></div>' +
      '<div><dt>Notre marge par boîte</dt><dd>' + eurBoite(r.mb[K]) + '</dd></div>' +
      '<div><dt>Taux de marge</dt><dd>' + pct(r.t[K]) + '</dd></div>' +
      '<div><dt>Notre marge par mois</dt><dd>' + eur0(r.mm[K]) + '</dd></div></dl>' +
      (r.dispo ? '' : '<div class="mp-tw">Intégral ne l’aura plus en ' + D.an1 + '</div>');
    tip.className = 'mp-tip' + (epingle ? ' fixe' : '');   // la bulle de survol laisse passer la souris ; la bulle posée par un toucher se ferme par sa croix
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.max(4, Math.min(W - w - 4, p.x - w / 2));
    var top = p.y - p.rad - h - 12; if (top < 4) top = p.y + p.rad + 12;
    tip.style.left = left.toFixed(0) + 'px'; tip.style.top = top.toFixed(0) + 'px';
  }
  function cacherBulle() {
    var tip = document.getElementById('mp-tip'), sel = document.getElementById('mp-sel');
    if (tip) tip.hidden = true; if (sel) sel.innerHTML = ''; S.epingle = null;
  }

  // ── Lignes de produits (liste à pousser, grand tableau, sans rapporter) ──
  function ligne(r, o) {
    var K = S.K, nom = '<div class="mp-n" role="cell"><b title="' + esc(r.nom) + '">' + esc(r.nom) + '</b><span>' + esc(r.labo) + (o.cip ? ' · ' + esc(r.cip) : '') + (r.dispo ? '' : ' <em class="mp-plus">Intégral ne l’aura plus</em>') + '</span></div>';
    var h = '<div class="mp-row ' + o.cls + '" role="row">';
    if (o.rang) h += '<div class="mp-rk" role="cell">' + o.rang + '</div>';
    h += nom;
    if (o.fam) h += '<div class="mp-c fam" role="cell" data-l="Famille">' + chipFam(r.f) + '</div>';
    h += '<div class="mp-c" role="cell" data-l="Boîtes par mois">' + boitesF(r.b) + '</div>';
    if (o.off) h += '<div class="mp-c" role="cell" data-l="Officines">' + entier(r.o) + '</div>';
    h += '<div class="mp-c" role="cell" data-l="Marge par boîte">' + eurBoite(r.mb[K]) + '</div>';
    h += '<div class="mp-c tx" role="cell" data-l="Taux de marge"><span class="v2-chip ' + (r.t[K] <= 0 ? 'r' : 'b') + '">' + pct(r.t[K]) + '</span></div>';
    if (o.janv) h += '<div class="mp-c jv" role="cell" data-l="' + esc(o.janvL) + '"><b>' + eur0(o.val(r)) + '</b>' + barre(o.val(r), 'var(--c-froid)', o.max) + '</div>';
    else h += '<div class="mp-c" role="cell" data-l="Marge par mois">' + eur0(r.mm[K]) + '</div>';
    return h + '</div>';
  }
  function entetesLignes(o) {
    var h = '<div class="mp-row mp-head ' + o.cls + '" role="row" aria-hidden="true">';
    if (o.rang) h += '<div>#</div>';
    h += '<div>Produit</div>';
    if (o.fam) h += '<div>Famille</div>';
    h += '<div class="c">Boîtes / mois</div>';
    if (o.off) h += '<div class="c">Officines</div>';
    h += '<div class="c">Marge / boîte</div><div class="c">Taux de marge</div><div class="c">' + (o.janv ? esc(o.janvL) : 'Marge / mois') + '</div></div>';
    return h;
  }
  function sectionPrio(C) {
    var K = C.K, seuil = D.meta.seuils_a_pousser || {};
    var o = { cls: 'prio', rang: true, fam: true, off: true, janv: true, cip: false, max: C.maxCle, val: C.cle,
      janvL: K === D.k1 ? 'Marge de janvier ' + D.an1 : 'Marge par mois en ' + anDe(K) };
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>À vendre en priorité</h2><span>' + C.prio.length + ' premiers produits qui tournent (au moins ' + entier(seuil.boites_mois_min || 0) +
      ' boîtes par mois) et rapportent (au moins ' + eurBoite(seuil.marge_boite_min || 0) + ' par boîte), classés par ' + (K === D.k1 ? 'notre marge de janvier ' + D.an1 : 'notre marge par mois') +
      '. Les produits qu’Intégral n’aura plus en ' + D.an1 + ' sont écartés.</span></div><div class="mp-card mp-tab" role="table" aria-label="Produits à vendre en priorité" id="mp-prio">' + entetesLignes(o);
    C.prio.forEach(function (r, i) { h += ligne(r, { cls: o.cls, rang: i + 1, fam: true, off: true, janv: true, janvL: o.janvL, max: o.max, val: o.val }); });
    return h + '</div></section>';
  }

  // ── Tous les produits ─────────────────────────────────────────────
  var TRIS = [['t', 'Taux de marge'], ['mb', 'Marge par boîte'], ['mm', 'Marge par mois'], ['b', 'Boîtes par mois']];
  function valTri(r) { var K = S.K; return S.tri === 'b' ? r.b : r[S.tri][K]; }
  function filtrer() {
    var q = norm(S.q).trim().split(/\s+/).filter(Boolean);
    var out = D.rows.filter(function (r) {
      if (S.fam !== '' && String(r.f) !== S.fam) return false;
      for (var i = 0; i < q.length; i++) if (r.nomN.indexOf(q[i]) < 0) return false;
      return true;
    });
    return out.sort(function (a, b) { var d = valTri(b) - valTri(a); return (S.sens < 0 ? d : -d) || (a.nom < b.nom ? -1 : 1); });
  }
  function sectionTous() {
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Tous les produits</h2><span>Cherchez un nom, un laboratoire ou un code CIP ; triez par taux de marge, par marge ou par rotation</span></div>' +
      '<div class="mp-card"><div class="mp-bar-outils">' +
      '<label class="mp-field mp-q"><span>Rechercher</span><input type="search" id="mp-q" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nom, laboratoire ou code CIP" value="' + esc(S.q) + '"></label>' +
      '<label class="mp-field"><span>Famille</span><select id="mp-fam"><option value="">Toutes les familles</option>';
    D.fams.forEach(function (f, i) { if (D.rows.some(function (r) { return r.f === i; })) h += '<option value="' + i + '"' + (S.fam === String(i) ? ' selected' : '') + '>' + esc(f.nom) + '</option>'; });
    h += '</select></label><label class="mp-field"><span>Trier par</span><select id="mp-tri">';
    TRIS.forEach(function (t) { h += '<option value="' + t[0] + '"' + (S.tri === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    h += '</select></label><button type="button" class="mp-sens" data-act="sens" id="mp-sens" aria-label="Sens du tri"></button></div>' +
      '<div class="mp-compte" id="mp-compte" aria-live="polite"></div>' +
      '<div class="mp-tab" role="table" aria-label="Tous les produits" id="mp-tous"></div>' +
      '<div class="mp-plusw"><button type="button" class="v2-btn v2-btn-ghost" data-act="plus" id="mp-plus">Voir plus</button></div></div></section>';
    return h;
  }
  function majTableau() {
    var K = S.K, res = filtrer(), o = { cls: 'tous', fam: true, off: false, janv: false, cip: true };
    var tab = document.getElementById('mp-tous'), cpt = document.getElementById('mp-compte'), plus = document.getElementById('mp-plus'), sens = document.getElementById('mp-sens');
    if (!tab) return;
    var h = entetesLignes(o), n = Math.min(S.n, res.length);
    for (var i = 0; i < n; i++) h += ligne(res[i], { cls: o.cls, fam: true, off: false, janv: false, cip: true });
    if (!res.length) h += '<div class="mp-vide">Aucun produit ne correspond à cette recherche.</div>';
    tab.innerHTML = h;
    cpt.textContent = entier(res.length) + ' produit' + (res.length > 1 ? 's' : '') + (res.length > n ? ' · ' + entier(n) + ' affichés' : '');
    plus.hidden = res.length <= n;
    plus.textContent = 'Voir plus (' + entier(res.length - n) + ' restants)';
    sens.innerHTML = (S.sens < 0 ? 'Du plus haut au plus bas' : 'Du plus bas au plus haut') + ' <span aria-hidden="true">' + (S.sens < 0 ? '↓' : '↑') + '</span>';
  }

  // ── Tournent sans rapporter ───────────────────────────────────────
  function sectionSans(C) {
    if (!C.sans.length) return '';
    var K = C.K, o = { cls: 'sans', fam: false, off: false, janv: false, cip: false };
    var liste = S.sansTout ? C.sans : C.sans.slice(0, N_SANS);
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Tournent sans rapporter</h2><span>Au moins ' + entier(SANS_RAPPORT.boites) + ' boîtes par mois et moins de ' + eurBoite(SANS_RAPPORT.marge) +
      ' de marge par boîte : ' + entier(C.sans.length) + ' produits, ' + entier(C.sansBoites) + ' boîtes par mois (' + pct(C.t.boites_mois ? C.sansBoites / C.t.boites_mois : 0, 0) + ' de toutes nos boîtes) pour ' + eur0(C.sansMarge) + ' de marge par mois</span></div>' +
      '<div class="mp-card mp-tab" role="table" aria-label="Produits qui tournent sans rapporter">' + entetesLignes(o);
    liste.forEach(function (r) { h += ligne(r, o); });
    h += '</div>';
    if (C.sans.length > N_SANS) h += '<div class="mp-plusw"><button type="button" class="v2-btn v2-btn-ghost" data-act="sanstout">' + (S.sansTout ? 'Réduire la liste' : 'Voir les ' + entier(C.sans.length) + ' produits') + '</button></div>';
    return h + '</section>';
  }

  // ── Pied ──────────────────────────────────────────────────────────
  function pied() {
    var hyp = (D.meta.hypotheses || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var plus = (D.meta.plus_chez_integral || []).length ? '<li>Produits qu’Intégral n’aura plus en ' + D.an1 + ' : ' + esc(D.meta.plus_chez_integral.join(', ')) + ' (grisés dans le graphique, écartés de la liste prioritaire).</li>' : '';
    return '<footer class="mp-pied"><h3>Hypothèses de ces chiffres</h3><ul>' + hyp + plus + '</ul>' +
      '<p>' + esc(D.meta.source || '') + '. Le taux de marge est notre marge divisée par le prix net vendu.</p>' +
      '<p class="conf">Confidentiel : réservé au groupe restreint.</p></footer>';
  }

  // ── Vue « Par officine » ──────────────────────────────────────────
  function moisNom(ym) { var m = ym % 100; return (MOIS[m - 1] || '') + ' ' + Math.floor(ym / 100); }
  // Nouvelle donnée (22/10/2026) : toutes les officines clientes de la période ; les mois sont lus dans la donnée.
  function enteteToutes(om) {
    var p = om.periode || {}, de = p.de || 0, a = p.a || 0, ma = om.mois_actifs || [], n = om.nb_plus_achat;
    var plage = 'de ' + (MOIS[de % 100 - 1] || '') + (Math.floor(de / 100) !== Math.floor(a / 100) ? ' ' + Math.floor(de / 100) : '') + ' à ' + moisNom(a);
    var t = 'Toutes les officines clientes ' + plage + ', d’au moins ' + entier(om.taille_min_ca_hors_froid) + ' € d’achats par mois hors froid.';
    if (n > 0) t += ' Dont ' + entier(n) + ' qui n’achètent plus' + (ma.length ? ' (aucun achat en ' + ma.map(function (y) { return MOIS[y % 100 - 1]; }).join(' ni en ') + ' ' + Math.floor(ma[0] / 100) + ')' : '') + '.';
    return t + ' ' + entier(om.nb_ecartees) + ' écartées : trop petites (dépannage).';
  }
  function kpisO() {
    var K = S.K, A = calcO(K), om = D.off.meta, h = '';
    var iF = trouverFam(/^froid$/i), cF = iF >= 0 ? couleurFam(iF) : 'var(--c-froid)';
    h += '<div class="mp-kpi" style="--k:var(--ip-blue)"><div class="mp-kl">Officines clientes suivies</div>' +
      '<div class="mp-kv" data-k="ofnb">' + entier(A.n) + '</div>' +
      '<div class="mp-kd">' + (typeof om.nb_plus_achat === 'number' ? enteteToutes(om) : 'Clientes actives (un achat en ' + esc(om.mois_actifs.map(function (y) { return MOIS[y % 100 - 1]; }).join(' ou ')) + ' ' + Math.floor(om.mois_actifs[0] / 100) + ') et d’au moins ' + entier(om.taille_min_ca_hors_froid) +
      ' € d’achats par mois hors froid. ' + entier(om.nb_ecartees) + ' écartées : ' + entier(om.nb_ecartees_perdues) + ' perdues, ' + entier(om.nb_ecartees_petites) + ' trop petites (dépannage).') + '</div></div>';
    h += '<div class="mp-kpi" style="--k:' + cF + '"><div class="mp-kl">Dont sans froid chez nous</div>' +
      '<div class="mp-kv" data-k="ofsans">' + entier(A.sans) + '</div>' +
      '<div class="mp-kd">Soit ' + pct(A.n ? A.sans / A.n : 0, 1) + ' des officines suivies : moins de ' + nf(om.sans_froid_boites_mois_max, 0) + ' boîte de froid par mois chez nous.</div></div>';
    h += '<div class="mp-kpi" style="--k:' + cF + '"><div class="mp-kl">Potentiel froid par mois, barème ' + anDe(K) + '</div>' +
      '<div class="mp-kv" data-k="ofpf">' + eur0(A.pf) + '</div>' +
      '<div class="mp-kd">Notre marge en plus si chaque officine achetait son froid comme la moyenne du réseau à taille égale.</div></div>';
    h += '<div class="mp-kpi" style="--k:var(--c-mint)"><div class="mp-kl">Potentiel total par mois, barème ' + anDe(K) + '</div>' +
      '<div class="mp-kv" data-k="ofpt">' + eur0(A.pt) + '</div>' +
      '<div class="mp-kd">Le froid et tous les autres produits suivis (' + entier(om.nb_produits_suivis) + ' produits, dont ' + entier(om.nb_froids_suivis) + ' de froid).</div></div>';
    return '<div class="mp-kpis">' + h + '</div>' +
      '<p class="mp-note mp-def">« Potentiel » veut dire : ce que nous gagnerions en plus chaque mois, en notre marge, si chaque officine achetait chez nous chaque produit suivi autant que les officines de même taille. On ne compte que ce qui manque : une officine qui achète déjà plus que la moyenne n’ajoute rien. C’est une estimation, pas une promesse.</p>';
  }
  var TRIS_O = [['pf', 'Potentiel froid'], ['pt', 'Potentiel total'], ['m', 'Notre marge'], ['ca', 'Achats hors froid']];
  function sectionOfficines() {
    var om = D.off.meta;
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Officines à appeler</h2><span>Classées par potentiel : les premières sont celles où il manque le plus de marge. Cliquez sur une officine pour voir les produits qui lui manquent.</span></div>' +
      '<div class="mp-card"><div class="mp-bar-outils">' +
      '<label class="mp-field mp-q"><span>Rechercher</span><input type="search" id="mp-oq" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nom, ville, code postal ou code" value="' + esc(S.oq) + '"></label>' +
      '<label class="mp-field"><span>Commercial</span><select id="mp-ocomm"><option value="">Tous les commerciaux</option>';
    om.commerciaux.forEach(function (c) { h += '<option value="' + esc(c) + '"' + (S.oComm === c ? ' selected' : '') + '>' + esc(c) + '</option>'; });
    h += '</select></label><label class="mp-field"><span>Trier par</span><select id="mp-otri">';
    TRIS_O.forEach(function (t) { h += '<option value="' + t[0] + '"' + (S.oTri === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    h += '</select></label><label class="mp-check"><input type="checkbox" id="mp-osans"' + (S.oSans ? ' checked' : '') + '><span>Seulement sans froid chez nous</span></label></div>' +
      '<div class="mp-compte" id="mp-ocompte" aria-live="polite"></div>' +
      '<div class="mp-olist" id="mp-olist"></div>' +
      '<div class="mp-plusw"><button type="button" class="v2-btn v2-btn-ghost" data-act="plusO" id="mp-oplus">Afficher plus</button></div></div></section>';
    return h;
  }
  function filtrerO() {
    var q = norm(S.oq).trim().split(/\s+/).filter(Boolean), K = S.K, tri = S.oTri, pil = D.off.pil;
    var val = tri === 'en' ? function (r) { return r.en; } : tri === 'tx' ? function (r) { return -r.tx; } : tri === 'pf' ? function (r) { return r.pf[K]; } : tri === 'pt' ? function (r) { return r.pt[K]; } : tri === 'm' ? function (r) { return r.m[K]; } : function (r) { return r.ca; };
    var out = (pil ? dansPerim() : D.off.rows).filter(function (r) {
      if (!pil && S.oComm && r.comm !== S.oComm) return false;
      if (pil && S.oCase !== null && r.cas !== S.oCase) return false;
      if (pil && S.oAl && !(S.oAl in r.al)) return false;
      if (S.oSans && !r.sans) return false;
      for (var i = 0; i < q.length; i++) if (r.nomN.indexOf(q[i]) < 0) return false;
      return true;
    });
    return out.sort(function (a, b) { return (val(b) - val(a)) || (a.nom < b.nom ? -1 : 1); });
  }
  function ligneO(r) {
    var K = S.K, om = D.off.meta, ouvert = !!S.oOuvert[r.code];
    var ref = r.ca * om.froid_reseau_pour_1000 / 1000;
    var froid = '<span class="mp-ofv">' + boitesF(r.fb) + '</span>' + (r.sans ? ' <em class="mp-sf">Sans froid chez nous</em>' : '') +
      '<small class="mp-ref">Réseau à taille égale : ' + boitesF(ref) + '</small>';
    var h = '<div class="mp-orow-w' + (ouvert ? ' ouvert' : '') + '" data-code="' + esc(r.code) + '">' +
      '<button type="button" class="mp-orow" data-act="ouv" data-c="' + esc(r.code) + '" aria-expanded="' + ouvert + '">' +
      '<span class="mp-n"><b title="' + esc(r.nom) + '">' + esc(r.nom) + '</b><span>' + esc(r.ville) + (r.cp ? ' · ' + esc(r.cp) : '') + '</span>' + (r.plus ? '<span class="mp-pa">Plus d’achat depuis ' + esc(moisNom(r.dernier)) + '</span>' : '') + '</span>' +
      '<span class="mp-c oc" data-l="Commercial">' + esc(r.comm || '—') + '</span>' +
      '<span class="mp-c" data-l="Achats par mois hors froid">' + eur0(r.ca) + '</span>' +
      '<span class="mp-c of" data-l="Froid : boîtes par mois">' + froid + '</span>' +
      '<span class="mp-c" data-l="Notre marge par mois">' + eur0(r.m[K]) + '</span>' +
      '<span class="mp-c pot f" data-l="Potentiel froid par mois">' + eur0(r.pf[K]) + '</span>' +
      '<span class="mp-c pot" data-l="Potentiel total par mois">' + eur0(r.pt[K]) + '</span>' +
      '<span class="mp-chev" aria-hidden="true"></span></button>';
    if (ouvert) h += detailO(r);
    return h + '</div>';
  }
  function manquants(r, interne) {
    var K = S.K, iF = trouverFam(/^froid$/i), liste = [], somme = 0;
    r.manq.forEach(function (m) {
      var p = D.rows[m[0]]; if (!p) return;
      var g = m[1] * p.mb[K]; somme += g;
      liste.push({ p: p, b: m[1], g: g });
    });
    liste.sort(function (a, b) { var fa = a.p.f === iF ? 0 : 1, fb = b.p.f === iF ? 0 : 1; return (fa - fb) || (b.g - a.g); });
    var h = interne ? '<p class="mp-note">Boîtes par mois en moins que la moyenne du réseau à taille égale, et ce que cela rapporterait en ' + anDe(K) + '. Le froid est en premier.</p>' :
      '<div class="mp-odet"><div class="mp-odh"><div><b>Produits qui lui manquent</b><span>Boîtes par mois en moins que la moyenne du réseau à taille égale, et ce que cela rapporterait en ' + anDe(K) + '. Le froid est en premier.</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary mp-fiche" data-act="fiche" data-c="' + esc(r.code) + '">Ouvrir la fiche</button></div>';
    if (r.plus && !interne) h += '<p class="mp-note">Plus d’achat depuis ' + esc(moisNom(r.dernier)) + '.</p>';
    if (!liste.length) h += '<div class="mp-vide">Aucun produit suivi ne lui manque.</div>';
    else {
      h += '<div class="mp-mq mp-mqh" aria-hidden="true"><span>Produit</span><span>Famille</span><span class="c">Boîtes / mois en moins</span><span class="c">Gain par mois</span></div>';
      liste.forEach(function (x) {
        h += '<div class="mp-mq"><span class="mp-n"><b>' + esc(x.p.nom) + '</b><span>' + esc(x.p.labo) + '</span></span>' +
          '<span class="mp-c fam" data-l="Famille">' + chipFam(x.p.f) + '</span>' +
          '<span class="mp-c" data-l="Boîtes par mois en moins">' + nf(x.b, 1) + '</span>' +
          '<span class="mp-c" data-l="Gain par mois"><b>' + eur0(x.g) + '</b></span></div>';
      });
      var reste = r.pt[K] - somme;
      if (reste >= 1) h += '<p class="mp-note">Les ' + entier(liste.length) + ' plus gros manques sont listés (' + eur0(somme) + '). Le reste du potentiel total, ' + eur0(reste) + ' par mois, est réparti sur des produits plus petits.</p>';
    }
    if (interne) return h;
    h += '<p class="mp-note">Dernier achat chez nous : ' + esc(moisNom(r.dernier)) + ' · ' + entier(r.nf) + ' des ' + entier(D.off.meta.nb_froids_suivis) + ' produits froid suivis achetés · code ' + esc(r.code) + '</p></div>';
    return h;
  }
  function detailO(r) { return manquants(r, false); }
  function majOfficines() {
    var res = filtrerO(), cpt = document.getElementById('mp-ocompte'), lst = document.getElementById('mp-olist'), plus = document.getElementById('mp-oplus'), pil = D.off.pil;
    if (!lst) return;
    var n = Math.min(S.oN, res.length), h = pil ?
      '<div class="mp-orow mp-ohead" aria-hidden="true"><span>Officine</span><span>Commercial</span><span class="c">Achats / mois hors froid</span><span>Froid : boîtes / mois</span><span>Notre taux</span><span class="c">Notre marge / mois</span><span class="c">Potentiel froid / mois</span><span class="c">Potentiel total / mois</span><span></span></div>' :
      '<div class="mp-orow mp-ohead" aria-hidden="true"><span>Officine</span><span>Commercial</span><span class="c">Achats / mois hors froid</span><span>Froid : boîtes / mois</span><span class="c">Notre marge / mois</span><span class="c">Potentiel froid / mois</span><span class="c">Potentiel total / mois</span><span></span></div>';
    for (var i = 0; i < n; i++) h += ligneAff(res[i]);
    if (!res.length) h += '<div class="mp-vide">Aucune officine ne correspond à ces filtres.</div>';
    lst.innerHTML = pil ? fr(h) : h;
    var pfS = 0, ptS = 0; res.forEach(function (r) { pfS += r.pf[S.K]; ptS += r.pt[S.K]; });
    var t = entier(res.length) + ' officine' + (res.length > 1 ? 's' : '') + (res.length > n ? ' · ' + entier(n) + ' affichées' : '') + ' · potentiel froid ' + eur0(pfS) + ' par mois · potentiel total ' + eur0(ptS) + ' par mois';
    cpt.textContent = pil ? fr(t) : t;
    if (pil) {
      var ac = document.getElementById('pil-actifs'), a = '';
      if (S.oCase !== null) a += '<button type="button" class="pil-actif" data-act="clr">Case : ' + CAS[S.oCase].nom + ' <span aria-hidden="true">×</span></button>';
      if (S.oAl) a += '<button type="button" class="pil-actif" data-act="clr">Alerte : ' + ALN[S.oAl].nom + ' <span aria-hidden="true">×</span></button>';
      if (ac) { ac.innerHTML = fr(a); ac.hidden = !a; }
    }
    plus.hidden = res.length <= n;
    plus.textContent = 'Afficher plus (' + entier(res.length - n) + ' restantes)';
  }
  function piedO() {
    var om = D.off.meta, seuil = D.meta.seuils_a_pousser || {}, p = om.periode || {};
    var cv = om.couverture_noms || {};
    return '<footer class="mp-pied"><h3>Comment on calcule le potentiel</h3><ul>' +
      '<li>Produits suivis : ceux de la liste « à vendre en priorité » de la vue par produit, soit les ' + entier(om.nb_produits_suivis) + ' produits que nous aurons en ' + D.an1 + ', qui rapportent au moins ' + eurBoite(seuil.marge_boite_min || 0) + ' par boîte et se vendent à ' + entier(seuil.boites_mois_min || 0) + ' boîtes par mois ou plus.</li>' +
      '<li>Taille d’une officine : ses achats chez nous par mois, hors froid (moyenne sur les mois où elle a acheté). Sont suivies ' + (typeof om.nb_plus_achat === 'number' ? 'toutes les officines clientes sur la période, même celles qui n’achètent plus, ' : 'les clientes actives ') + 'd’au moins ' + entier(om.taille_min_ca_hors_froid) + ' € par mois : ' + entier(om.nb_retenues) + ' officines.</li>' +
      '<li>Moyenne du réseau : pour chaque produit, les boîtes achetées par les officines suivies divisées par la somme de leurs achats hors froid. Le manque d’une officine est l’écart avec cette moyenne à sa taille, jamais en dessous de zéro.</li>' +
      '<li>Potentiel = boîtes qui manquent × notre marge par boîte du barème choisi, en € par mois. Le froid ne compte que les produits froid suivis ; le total compte tous les produits suivis.</li></ul>' +
      '<p>Période : ' + esc(moisNom(p.de || 0)) + ' → ' + esc(moisNom(p.a || 0)) + '. Noms et villes trouvés pour ' + pct(cv.taux || 0, 0) + ' des officines. Estimation de la direction, à confirmer par l’appel.</p>' +
      '<p class="conf">Confidentiel : réservé au groupe restreint.</p></footer>';
  }

  // ═══════════════════════════════════════════════════════════════════
  // 22/10/2026 — PILOTAGE de SES officines (clé « pilotage » du fichier protégé).
  // Will : « cibler notre groupe, nos pharmacies, nos secteurs ; voir comment les pharmacies
  // vont cranter avec les bons produits ; les alertes ; les bons et les mauvais clients ; le taux
  // global et par catégories ; les produits qui nous plombent ; combien les listings feraient progresser ».
  // « Cranter » = le TAUX de notre marge de l'officine (notre marge ÷ ses achats), toujours au barème 2027.
  // Aucun chiffre métier écrit ici : seuils, taux du réseau, médiane, listings se lisent dans le fichier.
  // ═══════════════════════════════════════════════════════════════════
  var NB = ' ';
  function fr(h) { return String(h).replace(/ ([:;%€?!»])/g, NB + '$1').replace(/« /g, '«' + NB); }
  function pts(v) { var p = Math.abs(v) * 100; return nf(p, 2) + NB + 'point' + (p >= 2 ? 's' : ''); }
  function sgn(v, d) { return (v < 0 ? '−' : '+') + pct(Math.abs(v), d); }
  function sgnE(v) { return (v < 0 ? '−' : '+') + eur0(Math.abs(v)); }
  function tx2(v) { return pct(v, 2); }
  var CAS = [
    { nom: 'Gros et rentable', court: 'Gros · rentable', c: '#1E9E6A', t: '#0F7A52' },
    { nom: 'Gros mais peu rentable', court: 'Gros · peu rentable', c: '#C7791A', t: '#9A5B12', aide: 'à travailler en premier' },
    { nom: 'Petit et rentable', court: 'Petit · rentable', c: '#3A4A9C', t: '#3A4A9C' },
    { nom: 'Petit et peu rentable', court: 'Petit · peu rentable', c: '#E0556E', t: '#C7283D' }
  ];
  var ALN = {
    b: { nom: 'Achats en baisse', court: 'Achats en baisse' },
    t: { nom: 'Taux en baisse en 2027', court: 'Taux en baisse' },
    p: { nom: 'Plombée par des produits sans marge', court: 'Produits sans marge' },
    a: { nom: 'Produit habituel arrêté', court: 'Produit arrêté' },
    x: { nom: 'Plus d’achat depuis plusieurs mois', court: 'Plus d’achat' }
  };
  var ALORDRE = ['b', 't', 'p', 'a', 'x'];
  var SEC = null;   // synthèse du périmètre courant

  // ── Lecture de la clé « pilotage » : null si absente (l'ancien écran reste alors affiché) ──
  function lirePilotage(M, rows, Dp) {
    var P = M.pilotage, i;
    if (!P || !P.lignes || !P.colonnes || !P.meta || P.lignes.length !== rows.length) return null;
    var ix = {};
    for (i = 0; i < P.colonnes.length; i++) ix[P.colonnes[i]] = i;
    for (i = 0; i < rows.length; i++) if (String(P.lignes[i][ix.code]) !== rows[i].code) return null;
    var fams = P.familles || [], ref = fams.map(function () { return [0, 0]; });
    rows.forEach(function (r, i) {
      var l = P.lignes[i], g = function (n) { return l[ix[n]]; };
      r.ach = g('achats') || 0; r.p26 = g('m26') || 0; r.p27 = g('m27') || 0;
      r.tx = r.ach > 0 ? r.p27 / r.ach : 0; r.tx26 = r.ach > 0 ? r.p26 / r.ach : 0;
      r.fam = g('fam') || []; r.mois = g('mois') || []; r.plomb = g('plombent') || [];
      r.psm = g('part_sans_marge') || 0; r.arr = g('arretes') || []; r.narr = g('nb_arretes') || 0;
      r.cas = g('case'); r.al = {};
      var a = g('alertes') || {}, k;
      for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) r.al[k] = a[k];
      if (r.plus) r.al.x = 1;
      r.perte = 0; r.arr.forEach(function (x) { r.perte += x[2]; });
      r.en = (r.pt[Dp.k1] || 0) + r.perte;
      r.nal = Object.keys(r.al).length;
      r.fam.forEach(function (f, j) { if (f) { ref[j][0] += f[0]; ref[j][1] += f[2]; } });
    });
    var m = P.meta;
    return { P: P, meta: m, prods: P.produits || [], tauxRes: m.taux_reseau_27, tauxRes26: m.taux_reseau_26, varRes: m.var_res, med: m.mediane_achats,
      seuils: m.seuils || {}, L: (M.listings && M.listings.listes) || [], mois: P.mois || [], fams: fams, pc: P.plombent_par_commercial || {},
      refFam: ref.map(function (x) { return x[0] > 0 ? x[1] / x[0] : 0; }) };
  }
  function nomProd(ref) { var p = D.off.pil.prods[ref]; return p ? p[1] : '—'; }
  function famProd(ref) { var p = D.off.pil.prods[ref]; return p ? p[2] : 8; }
  function chipFamP(j) { return '<span class="mp-fam" style="--c:' + couleurFam(j) + '"><i></i>' + esc(D.off.pil.fams[j] || '—') + '</span>'; }

  // ── Périmètre : mes officines · un collègue · toute l'équipe ──
  function monCommercial() {
    var u = V2.user, c = u && u.commercial ? String(u.commercial) : '';
    if (!c || !D.off) return '';
    var list = D.off.comm, n = norm(c).trim(), i;
    for (i = 0; i < list.length; i++) if (norm(list[i]).trim() === n) return list[i];
    var f = n.split(/\s+/)[0], hit = list.filter(function (x) { return norm(x).split(/\s+/)[0] === f; });
    return hit.length === 1 ? hit[0] : '';
  }
  function dansPerim() { return S.perim ? D.off.rows.filter(function (r) { return r.comm === S.perim; }) : D.off.rows; }
  function blocPerim() {
    var moi = monCommercial(), h = '<div class="pil-perim" role="group" aria-label="Périmètre"><span class="pil-pl">Périmètre</span>';
    if (moi) h += '<button type="button" class="pil-pb' + (S.perim === moi ? ' on' : '') + '" data-act="perim" data-v="' + esc(moi) + '" aria-pressed="' + (S.perim === moi) + '">Mes officines · ' + esc(moi) + '</button>';
    h += '<button type="button" class="pil-pb' + (S.perim === '' ? ' on' : '') + '" data-act="perim" data-v="" aria-pressed="' + (S.perim === '') + '">Toute l’équipe</button>';
    var autre = S.perim && S.perim !== moi;
    h += '<label class="pil-coll' + (autre ? ' on' : '') + '"><span>Un collègue</span><select id="pil-coll"><option value="">Choisir…</option>';
    D.off.comm.forEach(function (c) { if (c !== moi) h += '<option value="' + esc(c) + '"' + (S.perim === c ? ' selected' : '') + '>' + esc(c) + '</option>'; });
    return h + '</select></label></div>';
  }

  // ── Synthèse d'un ensemble d'officines ──
  function agr(rows) {
    var pl = D.off.pil, k1 = D.k1, j;
    var A = { n: rows.length, ach: 0, m26: 0, m27: 0, pt: 0, pf: 0, fam: [], cas: [0, 0, 0, 0], casM: [0, 0, 0, 0], al: { b: 0, t: 0, p: 0, a: 0, x: 0 }, enAlerte: 0 };
    for (j = 0; j < pl.fams.length; j++) A.fam.push([0, 0, 0]);
    rows.forEach(function (r) {
      A.ach += r.ach; A.m26 += r.p26; A.m27 += r.p27; A.pt += r.pt[k1]; A.pf += r.pf[k1];
      A.cas[r.cas]++; A.casM[r.cas] += r.p27;
      var k; for (k in r.al) if (A.al[k] !== undefined) A.al[k]++;
      if (r.nal) A.enAlerte++;
      r.fam.forEach(function (f, j2) { if (f) { A.fam[j2][0] += f[0]; A.fam[j2][1] += f[1]; A.fam[j2][2] += f[2]; } });
    });
    A.tx = A.ach > 0 ? A.m27 / A.ach : 0; A.tx26 = A.ach > 0 ? A.m26 / A.ach : 0;
    return A;
  }
  function listeChoisie() { var L = D.off.pil.L; return L[S.lst] || L[0] || null; }
  function gainListe(A, L) {
    var N = A.cas[1], g = N * L.marge, den = A.ach + N * L.ca;
    return { N: N, gain: g, t0: A.tx, t1: den > 0 ? (A.m27 + g) / den : 0 };
  }
  function txApres(r, L) { var den = r.ach + L.ca; return den > 0 ? (r.p27 + L.marge) / den : 0; }
  // Piste de taux : échelle 0 → 2 × réseau, repère du réseau au milieu
  function trk(v, couleur, big) {
    var ref = D.off.pil.tauxRes || 0.02, w = Math.max(0, Math.min(1, v / (2 * ref))) * 100;
    return '<span class="pil-trk' + (big ? ' big' : '') + '" role="img" aria-label="' + tx2(v) + ', le réseau est à ' + tx2(ref) + '"><i style="width:' + w.toFixed(1) + '%;background:' + couleur + '"></i><u></u></span>';
  }
  function couleurTx(v) { return v >= D.off.pil.tauxRes ? '#1E9E6A' : '#C7791A'; }
  function pastille(k) { var c = CAS[k]; return '<em class="pil-cas" style="--c:' + c.c + '"><i></i>' + c.court + '</em>'; }
  function puces(r, avecX) {
    var h = '';
    ALORDRE.forEach(function (k) { if (k in r.al && (k !== 'x' || avecX)) h += '<em class="pil-al ' + k + '" title="' + esc(ALN[k].nom) + '">' + ALN[k].court + '</em>'; });
    return h;
  }

  // ── Alertes en phrases ──
  function phrases(r) {
    var pl = D.off.pil, out = [], s = pl.seuils;
    if ('b' in r.al) out.push(['b', 'Ses achats baissent : ' + sgn(r.al.b, 0) + ' en juin → août face à la moyenne de janvier → mai, alors que l’ensemble des officines suivies fait ' + sgn(pl.varRes, 0) + ' sur la même période.']);
    if ('t' in r.al) out.push(['t', 'Son taux baisse avec le barème 2027 : ' + tx2(r.tx) + ' contre ' + tx2(r.tx26) + ' avec le barème 2026 (' + pts(r.tx - r.tx26) + ' en moins).']);
    if ('p' in r.al) out.push(['p', 'Elle est plombée : ' + pct(r.psm, 0) + ' de ses achats portent sur des produits qui nous rapportent moins de ' + eurBoite(s.marge_boite_sans || 0) + ' la boîte, et son taux est sous celui du réseau (' + tx2(pl.tauxRes) + ').']);
    if ('a' in r.al) {
      var m6 = pl.mois.length ? pl.mois[pl.mois.length - 2] : 0, m7 = pl.mois.length ? pl.mois[pl.mois.length - 1] : 0;
      out.push(['a', r.narr + (r.narr > 1 ? ' produits qu’elle achetait presque chaque mois' : ' produit qu’elle achetait presque chaque mois') + ' (au moins ' + (s.arret_mois_habituel_sur_6 || '') + ' mois sur 6 avant l’été) ne sont plus achetés en ' + (MOIS[m6 % 100 - 1] || '') + ' ni en ' + (MOIS[m7 % 100 - 1] || '') + ' : au moins ' + eur0(r.perte) + ' de notre marge par mois en moins.']);
    }
    if (r.plus) out.push(['x', 'Plus d’achat depuis ' + moisNom(r.dernier) + '.']);
    return out;
  }

  // ═══ Le tableau de bord : 4 cartes ═══
  function carteTaux(A) {
    var pl = D.off.pil, ecart = A.tx - pl.tauxRes;
    return '<div class="pil-card"><div class="mp-kl">Notre taux de marge</div>' +
      '<div class="mp-kv" data-k="taux">' + tx2(A.tx) + '</div>' + trk(A.tx, couleurTx(A.tx), true) +
      '<div class="mp-kd">Notre marge ÷ leurs achats, par mois (moyenne janvier → août 2026), au barème 2027. Le réseau : <b>' + tx2(pl.tauxRes) + '</b>. ' +
      (Math.abs(ecart) < 0.00005 ? 'Au niveau du réseau.' : '<b class="' + (ecart < 0 ? 'neg' : 'pos') + '">' + pts(ecart) + (ecart < 0 ? ' sous le' : ' au-dessus du') + ' réseau.</b>') +
      ' Avec le barème 2026 : ' + tx2(A.tx26) + '.</div></div>';
  }
  function carteFamilles(A) {
    var pl = D.off.pil, tot = A.ach || 1;
    var rows = A.fam.map(function (f, j) { return { j: j, ach: f[0], m27: f[2] }; }).filter(function (x) { return x.ach > 0; }).sort(function (a, b) { return b.ach - a.ach; });
    var h = '<div class="pil-card"><div class="mp-kl">Par famille de produits</div><div class="pil-fams">';
    rows.slice(0, 6).forEach(function (x) {
      var t = x.m27 / x.ach, ref = pl.refFam[x.j], egal = tx2(t) === tx2(ref), haut = t >= ref;
      h += '<div class="pil-fr"><span class="pil-fn">' + chipFamP(x.j) + '</span>' +
        '<span class="mp-bar" title="' + pct(x.ach / tot, 0) + ' de leurs achats"><i style="width:' + (x.ach / tot * 100).toFixed(1) + '%;background:' + couleurFam(x.j) + '"></i></span>' +
        '<b class="' + (egal ? '' : haut ? 'pos' : 'neg') + '" title="Même famille sur l’ensemble des officines suivies : ' + tx2(ref) + '">' + (egal ? '= ' : haut ? '▲ ' : '▼ ') + tx2(t) + '</b></div>';
    });
    if (rows.length > 6) { var r6 = 0; rows.slice(6).forEach(function (x) { r6 += x.ach; }); h += '<div class="pil-fr ot"><span class="pil-fn">Autres familles</span><span class="mp-bar"><i style="width:' + (r6 / tot * 100).toFixed(1) + '%;background:' + GRIS_FAMILLE + '"></i></span><b></b></div>'; }
    return h + '</div><div class="mp-kd">Barre : part de leurs achats. Chiffre : notre taux sur la famille. ▲ au-dessus, ▼ en dessous, = pareil que le même taux sur l’ensemble des officines suivies (mêmes mois, barème 2027).</div></div>';
  }
  function carteCases(A) {
    var h = '<div class="pil-card"><div class="mp-kl">Bons et mauvais clients</div><div class="pil-cases">';
    CAS.forEach(function (c, k) {
      h += '<button type="button" class="pil-case' + (S.oCase === k ? ' on' : '') + '" style="--c:' + c.c + '" data-act="case" data-v="' + k + '" aria-pressed="' + (S.oCase === k) + '">' +
        '<i></i><b>' + entier(A.cas[k]) + '</b><span>' + c.nom + '</span><small>' + eur0(A.casM[k]) + ' de marge par mois</small>' + (c.aide ? '<em>' + c.aide + '</em>' : '') + '</button>';
    });
    return h + '</div><div class="mp-kd">Gros ou petit : achats au-dessus ou en dessous de la médiane (' + eur0(D.off.pil.med) + ' par mois). Rentable : taux au moins égal à celui du réseau. Un clic filtre la liste.</div></div>';
  }
  function boutonsAlertes() {
    var h = '<div class="pil-als">';
    ALORDRE.forEach(function (k) {
      h += '<button type="button" class="pil-alb ' + k + (S.oAl === k ? ' on' : '') + '" data-act="al" data-v="' + k + '" aria-pressed="' + (S.oAl === k) + '"><b>' + entier(SEC.al[k]) + '</b><span>' + ALN[k].nom + '</span></button>';
    });
    return h + '</div>';
  }
  function carteAlertes() {
    return '<div class="pil-card"><div class="mp-kl">Alertes</div>' + boutonsAlertes() +
      '<div class="mp-kd">Nombre d’officines concernées. Un clic filtre la liste. ' + entier(SEC.enAlerte) + ' sur ' + entier(SEC.n) + ' ont au moins une alerte.</div></div>';
  }
  function entreeV1(A) {
    return '<section class="mp-sec pil-e1"><div class="mp-sh"><h2>Le tableau de bord</h2><span>Le taux, les familles, les bons et mauvais clients et les alertes de ' + libPerim() + ', d’un coup d’œil.</span></div>' +
      '<div class="pil-cards">' + carteTaux(A) + carteFamilles(A) + carteCases(A) + carteAlertes() + '</div></section>';
  }
  function libPerim() { return S.perim === '' ? 'toute l’équipe' : (S.perim === monCommercial() ? 'vos officines' : 'les officines de ' + esc(S.perim)); }

  // ═══ Simulateur, produits qui plombent, par commercial, liste, fiche ═══
  function tableEquipe() {
    var pl = D.off.pil, L = listeChoisie(), par = {}, ordre = [];
    D.off.rows.forEach(function (r) { var k = r.comm || '—'; if (!par[k]) { par[k] = []; ordre.push(k); } par[k].push(r); });
    var lignes = ordre.map(function (k) { var a = agr(par[k]); a.nom = k; return a; }).sort(function (a, b) { return b.ach - a.ach; });
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Par commercial</h2><span>Une ligne par commercial, tout par mois (moyenne janvier → août 2026) au barème 2027. Le taux se lit face au réseau (' + tx2(pl.tauxRes) + ', trait au milieu). Cliquez sur une ligne pour passer sur ses officines.</span></div><div class="mp-card pil-eq">' +
      '<div class="pil-er pil-eh" aria-hidden="true"><span>Commercial</span><span class="c">Officines</span><span class="c">Achats / mois</span><span class="c">Notre marge / mois</span><span>Notre taux</span><span class="c">À travailler</span><span class="c">En alerte</span><span class="c">Potentiel / mois</span><span class="c">Gain du listing' + (L ? ' de ' + eur0(L.budget) : '') + '</span></div>';
    lignes.forEach(function (a) {
      var g = L ? a.cas[1] * L.marge : 0;
      h += '<button type="button" class="pil-er" data-act="perim" data-v="' + esc(a.nom) + '">' +
        '<span class="mp-n"><b>' + esc(a.nom) + '</b></span>' +
        '<span class="mp-c" data-l="Officines">' + entier(a.n) + '</span>' +
        '<span class="mp-c" data-l="Achats par mois">' + eur0(a.ach) + '</span>' +
        '<span class="mp-c" data-l="Notre marge par mois">' + eur0(a.m27) + '</span>' +
        '<span class="mp-c pil-txc" data-l="Notre taux (face au réseau)"><b>' + tx2(a.tx) + '</b>' + trk(a.tx, couleurTx(a.tx)) + '</span>' +
        '<span class="mp-c" data-l="À travailler">' + entier(a.cas[1]) + '</span>' +
        '<span class="mp-c" data-l="Officines en alerte">' + entier(a.enAlerte) + '</span>' +
        '<span class="mp-c" data-l="Potentiel par mois">' + eur0(a.pt) + '</span>' +
        '<span class="mp-c" data-l="Gain du listing par mois"><b>' + (g ? sgnE(g) : '—') + '</b></span></button>';
    });
    return h + '</div></section>';
  }
  function sectionSim(A) {
    var pl = D.off.pil, L = listeChoisie(); if (!L) return '';
    var G = gainListe(A, L);
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Si on place le bon listing</h2><span>Ce que les listings de janvier changeraient pour les officines à travailler de ' + libPerim() + ', au barème 2027.</span></div><div class="mp-card pil-sim"><div class="pil-simt">';
    h += G.N > 0 ? 'Si vos <b>' + entier(G.N) + ' officine' + (G.N > 1 ? 's' : '') + ' à travailler</b> prenaient le listing ' : 'Aucune officine à travailler ici. Le listing, pour information : ';
    h += '<label class="pil-lstw"><span class="sr">Listing choisi</span><select id="pil-lst">';
    pl.L.forEach(function (l, i) { h += '<option value="' + i + '"' + (L === l ? ' selected' : '') + '>' + eur0(l.budget) + ' par mois</option>'; });
    h += '</select></label></div>';
    if (G.N > 0) {
      h += '<div class="pil-simr"><div><span class="pil-cl">Notre marge en plus</span><b class="pil-big pos">' + sgnE(G.gain) + '</b><small>par mois, ' + eur0(L.marge) + ' pour chacune</small></div>' +
        '<div><span class="pil-cl">Taux de ' + libPerim() + '</span><b class="pil-big">' + tx2(G.t0) + ' <em>→</em> ' + tx2(G.t1) + '</b>' +
        '<div class="pil-duo"><span>Aujourd’hui</span>' + trk(G.t0, couleurTx(G.t0)) + '<span>Avec le listing</span>' + trk(G.t1, couleurTx(G.t1)) + '</div><small>Le réseau : ' + tx2(pl.tauxRes) + ' (trait au milieu des pistes)</small></div></div>';
    }
    h += '<p class="mp-note">Ce listing : ' + entier(L.refs) + ' références, ' + entier(L.boites) + ' boîtes et ' + eur0(L.ca) + ' d’achats par mois et par officine, pour ' + eur0(L.marge) + ' de notre marge, soit un taux de ' + tx2(L.taux) + '. On suppose que chaque officine à travailler l’achète en plus de ses achats actuels, chaque mois. Estimation, pas une promesse.</p></div></section>';
    return h;
  }
  function sectionPlombent(A) {
    var pl = D.off.pil, cle = S.perim ? String(D.off.comm.indexOf(S.perim)) : 'tous', L = (pl.pc[cle] || []).slice(0, 5), s = pl.seuils;
    var h = '<section class="mp-sec"><div class="mp-sh"><h2>Les produits qui nous plombent</h2><span>Ceux qui pèsent dans les achats de ' + libPerim() + ' mais nous rapportent moins de ' + eurBoite(s.marge_boite_sans || 0) + ' par boîte (barème 2027) : par mois, moyenne janvier → août 2026. Les génériques en font partie, ils ne rapportent rien par nature.</span></div><div class="mp-card">';
    if (!L.length) return h + '<div class="mp-vide">Aucun produit à signaler.</div></div></section>';
    var max = 0; L.forEach(function (x) { if (x[2] > max) max = x[2]; });
    h += '<div class="pil-pr pil-ph2" aria-hidden="true"><span>Produit</span><span>Achats par mois</span><span class="c">Notre marge / mois</span><span class="c">Officines</span></div>';
    L.forEach(function (x) {
      h += '<div class="pil-pr"><span class="mp-n"><b>' + esc(nomProd(x[0])) + '</b><span>' + chipFamP(famProd(x[0])) + '</span></span>' +
        '<span class="mp-c pil-pa" data-l="Achats par mois"><b>' + eur0(x[2]) + '</b>' + barre(x[2], '#C7791A', max) + '<small>' + pct(A.ach ? x[2] / A.ach : 0, 1) + ' des achats</small></span>' +
        '<span class="mp-c" data-l="Notre marge par mois">' + eur0(x[3]) + '</span>' +
        '<span class="mp-c" data-l="Officines concernées">' + entier(x[4]) + '</span></div>';
    });
    return h + '</div></section>';
  }

  // ── La liste (commune) ──
  var TRIS_P = [['en', 'Enjeu en € (alertes et potentiel)'], ['tx', 'Notre taux, le plus bas d’abord'], ['pf', 'Potentiel froid'], ['pt', 'Potentiel total'], ['m', 'Notre marge'], ['ca', 'Achats hors froid']];
  function sectionListeP() {
    var h = '<section class="mp-sec" id="pil-liste"><div class="mp-sh"><h2>Les officines, une par une</h2><span>Classées par enjeu : les premières sont celles où il y a le plus à gagner ou à rattraper. Cliquez sur une officine pour voir comment elle crante, ses alertes et ses produits.</span></div>' +
      '<div class="mp-card"><div class="mp-bar-outils">' +
      '<label class="mp-field mp-q"><span>Rechercher</span><input type="search" id="mp-oq" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nom, ville, code postal ou code" value="' + esc(S.oq) + '"></label>' +
      '<label class="mp-field"><span>Trier par</span><select id="mp-otri">';
    TRIS_P.forEach(function (t) { h += '<option value="' + t[0] + '"' + (S.oTri === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    h += '</select></label><label class="mp-check"><input type="checkbox" id="mp-osans"' + (S.oSans ? ' checked' : '') + '><span>Seulement sans froid chez nous</span></label></div>' +
      '<div class="pil-actifs" id="pil-actifs"></div><div class="mp-compte" id="mp-ocompte" aria-live="polite"></div>' +
      '<div class="mp-olist" id="mp-olist"></div>' +
      '<div class="mp-plusw"><button type="button" class="v2-btn v2-btn-ghost" data-act="plusO" id="mp-oplus">Afficher plus</button></div></div></section>';
    return h;
  }
  function ligneP(r) {
    var om = D.off.meta, pl = D.off.pil, ouvert = !!S.oOuvert[r.code], ref = r.ca * om.froid_reseau_pour_1000 / 1000;
    var froid = '<span class="mp-ofv">' + boitesF(r.fb) + '</span>' + (r.sans ? ' <em class="mp-sf">Sans froid chez nous</em>' : '') + '<small class="mp-ref">Réseau à taille égale : ' + boitesF(ref) + '</small>';
    var h = '<div class="mp-orow-w' + (ouvert ? ' ouvert' : '') + '" data-code="' + esc(r.code) + '">' +
      '<button type="button" class="mp-orow" data-act="ouv" data-c="' + esc(r.code) + '" aria-expanded="' + ouvert + '">' +
      '<span class="mp-n"><b title="' + esc(r.nom) + '">' + esc(r.nom) + '</b><span>' + esc(r.ville) + (r.cp ? ' · ' + esc(r.cp) : '') + '</span>' + (r.plus ? '<span class="mp-pa">Plus d’achat depuis ' + esc(moisNom(r.dernier)) + '</span>' : '') +
      '<span class="pil-chips">' + pastille(r.cas) + puces(r, false) + '</span></span>' +
      '<span class="mp-c oc" data-l="Commercial">' + esc(r.comm || '—') + '</span>' +
      '<span class="mp-c" data-l="Achats par mois hors froid">' + eur0(r.ca) + '</span>' +
      '<span class="mp-c of" data-l="Froid : boîtes par mois">' + froid + '</span>' +
      '<span class="mp-c pil-txc" data-l="Notre taux, face au réseau"><b>' + tx2(r.tx) + '</b>' + trk(r.tx, CAS[r.cas].c) + '<small class="mp-ref">Réseau : ' + tx2(pl.tauxRes) + '</small></span>' +
      '<span class="mp-c" data-l="Notre marge par mois">' + eur0(r.m[D.k1]) + '</span>' +
      '<span class="mp-c pot f" data-l="Potentiel froid par mois">' + eur0(r.pf[D.k1]) + '</span>' +
      '<span class="mp-c pot" data-l="Potentiel total par mois">' + eur0(r.pt[D.k1]) + '</span>' +
      '<span class="mp-chev" aria-hidden="true"></span></button>';
    if (ouvert) h += detailP(r);
    return h + '</div>';
  }
  function ligneAff(r) { return D.off.pil ? ligneP(r) : ligneO(r); }

  // ── La fiche dépliée ──
  function courbe(r) {
    var pl = D.off.pil, v = r.mois, n = v.length; if (!n) return '';
    var W = 340, H = 118, pl_ = 22, pr = 22, pt = 12, pb = 24, max = Math.max.apply(null, v) * 1.12 || 1, i;
    var X = function (k) { return pl_ + k / Math.max(1, n - 1) * (W - pl_ - pr); }, Y = function (a) { return pt + (1 - a / max) * (H - pt - pb); };
    var avant = 0, na = Math.max(1, n - 3); for (i = 0; i < na; i++) avant += v[i]; avant /= na;
    var s = '<svg class="pil-courbe" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Achats de chaque mois, de ' + MOIS[pl.mois[0] % 100 - 1] + ' à ' + MOIS[pl.mois[n - 1] % 100 - 1] + '">';
    if ('b' in r.al) s += '<rect x="' + (X(n - 3) - 6).toFixed(1) + '" y="' + pt + '" width="' + (W - pr - X(n - 3) + 6).toFixed(1) + '" height="' + (H - pt - pb) + '" fill="#E0556E" fill-opacity="0.12"/>';
    s += '<line x1="' + pl_ + '" x2="' + (W - pr) + '" y1="' + Y(avant).toFixed(1) + '" y2="' + Y(avant).toFixed(1) + '" stroke="#0A6C86" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<polyline fill="none" stroke="#10131C" stroke-width="2" stroke-linejoin="round" points="' + v.map(function (a, k) { return X(k).toFixed(1) + ',' + Y(a).toFixed(1); }).join(' ') + '"/>';
    v.forEach(function (a, k) {
      var bas = k >= n - 3 && ('b' in r.al);
      s += '<circle cx="' + X(k).toFixed(1) + '" cy="' + Y(a).toFixed(1) + '" r="3.6" fill="' + (bas ? '#E0556E' : '#10131C') + '"/>' +
        '<text class="mp-ax s" x="' + X(k).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + (MOIS[pl.mois[k] % 100 - 1] || '').slice(0, 4) + '.</text>';
    });
    return s + '</svg>';
  }
  function moyN(v, a, b) { var s = 0, i; for (i = a; i < b; i++) s += v[i]; return b > a ? s / (b - a) : 0; }
  function echelle(r) {
    var pl = D.off.pil, ref = pl.tauxRes, h = '<div class="pil-ech"><div class="pil-erow now"><span>Aujourd’hui</span>' + trk(r.tx, couleurTx(r.tx)) + '<b>' + tx2(r.tx) + '</b><small>—</small></div>';
    pl.L.forEach(function (l) {
      var t = txApres(r, l);
      h += '<div class="pil-erow' + (S.lst >= 0 && listeChoisie() === l ? ' sel' : '') + '"><span>Avec le listing de ' + eur0(l.budget) + '</span>' + trk(t, couleurTx(t)) + '<b class="' + (t >= ref ? 'pos' : '') + '">' + tx2(t) + '</b><small>' + sgnE(l.marge) + ' / mois</small></div>';
    });
    return h + '</div>';
  }
  function detailP(r) {
    var pl = D.off.pil, big = (window.innerWidth || 1280) >= 1000, ouv = big ? ' open' : '', ecart = r.tx - pl.tauxRes;
    var mo = r.mois, n = mo.length, avant = moyN(mo, 0, Math.max(1, n - 3)), apres = moyN(mo, Math.max(1, n - 3), n);
    var h = '<div class="mp-odet pil-det"><div class="mp-odh"><div><b>Comment elle crante</b><span>Tout par mois, moyenne janvier → août 2026, au barème 2027.</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary mp-fiche" data-act="fiche" data-c="' + esc(r.code) + '">Ouvrir la fiche</button></div>';
    h += '<div class="pil-cols"><div class="pil-col"><div class="pil-bloc"><div class="pil-bt">Son taux et l’échelle des listings</div>' +
      '<div class="pil-txg"><b>' + tx2(r.tx) + '</b><span>' + (Math.abs(ecart) < 0.00005 ? 'au niveau du réseau' : pts(ecart) + (ecart < 0 ? ' sous le' : ' au-dessus du') + ' réseau (' + tx2(pl.tauxRes) + ')') + ' · ' + tx2(r.tx26) + ' avec le barème 2026</span></div>' + echelle(r) +
      '<p class="mp-note">Taux avec un listing = (notre marge + celle du listing) ÷ (ses achats + ceux du listing), par mois, barème 2027. Le trait au milieu de chaque piste est le réseau.</p></div>';
    h += '<div class="pil-bloc"><div class="pil-bt">Alertes</div><ul class="pil-ph pil-phd">';
    var ph = phrases(r);
    ph.forEach(function (p) { h += '<li class="' + p[0] + '">' + esc(p[1]) + '</li>'; });
    if (!ph.length) h += '<li>Aucune alerte : rien à signaler pour cette officine.</li>';
    h += '</ul></div></div><div class="pil-col"><div class="pil-bloc"><div class="pil-bt">Ses achats, mois par mois</div>' + courbe(r) +
      '<p class="mp-note">Ligne pointillée : sa moyenne de ' + MOIS[pl.mois[0] % 100 - 1] + ' à ' + MOIS[pl.mois[Math.max(0, n - 4)] % 100 - 1] + ' (' + eur0(avant) + '). ' + MOIS[pl.mois[Math.max(0, n - 3)] % 100 - 1] + ' → ' + MOIS[pl.mois[n - 1] % 100 - 1] + ' : ' + eur0(apres) + (avant ? ' (' + sgn(apres / avant - 1, 0) + ')' : '') + '. L’ensemble des officines suivies : ' + sgn(pl.varRes, 0) + '.</p></div>';
    var tot = r.ach || 1;
    h += '<details class="pil-bloc pil-dt"' + ouv + '><summary>Par famille</summary><div class="pil-fams">';
    r.fam.forEach(function (f, j) {
      if (!f) return;
      var t = f[2] / f[0], ref = pl.refFam[j], egal = tx2(t) === tx2(ref), haut = t >= ref;
      h += '<div class="pil-fr"><span class="pil-fn">' + chipFamP(j) + '</span><span class="mp-bar" title="' + pct(f[0] / tot, 0) + ' de ses achats"><i style="width:' + (f[0] / tot * 100).toFixed(1) + '%;background:' + couleurFam(j) + '"></i></span><b class="' + (egal ? '' : haut ? 'pos' : 'neg') + '" title="Même famille sur l’ensemble des officines suivies : ' + tx2(ref) + '">' + (egal ? '= ' : haut ? '▲ ' : '▼ ') + tx2(t) + '</b></div>';
    });
    h += '</div><p class="mp-note">Barre : part de ses achats. Chiffre : notre taux sur la famille. ▲ au-dessus, ▼ en dessous, = pareil que le même taux sur l’ensemble des officines suivies.</p></details></div></div>';
    // produits qui plombent, produits arrêtés
    h += '<div class="pil-cols"><details class="pil-bloc pil-dt"' + ouv + '><summary>Ce qui la plombe <small>(' + pct(r.psm, 0) + ' de ses achats sans marge)</small></summary>';
    if (!r.plomb.length) h += '<p class="mp-note">Aucun produit sans marge à signaler.</p>';
    r.plomb.forEach(function (x) {
      h += '<div class="pil-pl3"><span class="mp-n"><b>' + esc(nomProd(x[0])) + '</b><span>' + chipFamP(famProd(x[0])) + '</span></span><span class="mp-c" data-l="Achats par mois">' + eur0(x[2]) + '</span><span class="mp-c" data-l="Notre marge par mois">' + eur0(x[3]) + '</span></div>';
    });
    h += '</details><details class="pil-bloc pil-dt"' + ouv + '><summary>Produits habituels arrêtés <small>(' + entier(r.narr) + ')</small></summary>';
    if (!r.arr.length) h += '<p class="mp-note">Aucun produit habituel arrêté.</p>';
    r.arr.forEach(function (x) {
      h += '<div class="pil-pl3"><span class="mp-n"><b>' + esc(nomProd(x[0])) + '</b><span>' + nf(x[1], 1) + ' boîte' + (x[1] >= 2 ? 's' : '') + ' par mois de ' + MOIS[pl.mois[0] % 100 - 1] + ' à ' + MOIS[pl.mois[Math.max(0, n - 3)] % 100 - 1] + ' · dernier achat en ' + esc(moisNom(x[3])) + '</span></span><span class="mp-c" data-l="Marge perdue par mois">' + eur0(x[2]) + '</span></div>';
    });
    if (r.narr > r.arr.length) h += '<p class="mp-note">Les ' + r.arr.length + ' plus gros sur ' + entier(r.narr) + '.</p>';
    h += '</details></div>';
    h += '<details class="pil-bloc pil-manq"><summary>Produits qui lui manquent <small>(potentiel total ' + eur0(r.pt[D.k1]) + ' par mois)</small></summary>' + manquants(r, true) + '</details>';
    return h + '<p class="mp-note">Dernier achat chez nous : ' + esc(moisNom(r.dernier)) + ' · ' + entier(r.nf) + ' des ' + entier(D.off.meta.nb_froids_suivis) + ' produits froid suivis achetés · code ' + esc(r.code) + '</p></div>';
  }

  // ── Filtres et actions communes ──
  function majFiltres(defiler) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="case"]'), function (b) { var on = S.oCase === parseInt(b.getAttribute('data-v'), 10); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="al"]'), function (b) { var on = S.oAl === b.getAttribute('data-v'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    S.oN = N_PAGE; majOfficines();
    if (defiler) { var sec = document.getElementById('pil-liste'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' }); }
  }
  function piedP() {
    var pl = D.off.pil, s = pl.seuils;
    return '<footer class="mp-pied"><h3>Comment on lit le pilotage</h3><ul>' +
      '<li>Notre taux = notre marge ÷ les achats de l’officine, par mois (moyenne janvier → août 2026), toujours au barème 2027. Le réseau : ' + tx2(pl.tauxRes) + ' (barème 2026 : ' + tx2(pl.tauxRes26) + ').</li>' +
      '<li>Les quatre cases : gros ou petit selon que ses achats dépassent ou non la médiane (' + eur0(pl.med) + ' par mois) ; rentable si son taux est au moins celui du réseau. « Gros mais peu rentable » est la case à travailler en premier.</li>' +
      '<li>Achats en baisse : ses achats de ' + (MOIS[pl.mois[5] % 100 - 1] || '') + ' → ' + (MOIS[pl.mois[pl.mois.length - 1] % 100 - 1] || '') + ' tombent à moins de ' + pct(s.baisse || 0, 0) + ' de ce que fait l’ensemble des officines suivies par rapport à ' + (MOIS[pl.mois[0] % 100 - 1] || '') + ' → ' + (MOIS[pl.mois[4] % 100 - 1] || '') + '.</li>' +
      '<li>Taux en baisse : son taux 2027 est d’au moins ' + pts(s.taux_baisse || 0) + ' sous son taux 2026. Plombée : au moins ' + pct(s.part_sans_marge || 0, 0) + ' de ses achats sur des produits à moins de ' + eurBoite(s.marge_boite_sans || 0) + ' de marge par boîte, et un taux sous le réseau.</li>' +
      '<li>Produit habituel arrêté : acheté au moins ' + (s.arret_mois_habituel_sur_6 || '') + ' mois sur 6 avant l’été, plus du tout en juillet ni en août, rapportant au moins ' + eurBoite(s.marge_boite_arret || 0) + ' la boîte, hors produits saisonniers.</li>' +
      '<li>Enjeu d’une officine = son potentiel total + la marge perdue sur ses produits arrêtés, par mois.</li></ul></footer>';
  }
  function enteteP(C) {
    return '<div class="mp-hero"><div class="mp-hero-t"><div class="mp-eyebrow"><span class="dot"></span>Accès réservé au groupe restreint</div>' +
      '<h1 class="mp-h1">Listing produits 2027</h1>' +
      '<p class="mp-sub">Le pilotage de vos officines : où notre marge crante, lesquelles travailler en premier, et ce que le bon listing changerait. Tout est en notre marge par mois (moyenne ' + esc(periodeTexte().replace(/^ventes /, '')) + ') au barème 2027, comparée au réseau. Chiffres estimés par la direction, mis à jour le ' + esc(dateLongue(D.meta.genere_le)) + '.</p></div>' +
      '</div>' +
      (V2.listings2027 && V2.listings2027.onglets ? V2.listings2027.onglets('officine') : '');
  }
  function dessinerP(root) {
    var y = window.pageYOffset || 0, A = agr(dansPerim());
    SEC = A;
    root.innerHTML = fr(top() + '<div class="v2-wrap mp-wrap pil-wrap">' + enteteP() + blocPerim() + entreeV1(A) + (S.perim === '' ? tableEquipe() : '') + sectionSim(A) + sectionPlombent(A) + sectionListeP() + piedO() + piedP() + '</div>');
    racine = root;
    majOfficines();
    try { window.scrollTo(0, y); } catch (e) {}
  }

  // ── Écrans d’état ─────────────────────────────────────────────────
  function top() { return (V2.topbar ? V2.topbar({ back: true, nom: 'Listing produits 2027' }) : ''); }
  function message(root, titre, texte, bouton) {
    css();
    root.innerHTML = top() + '<div class="v2-wrap mp-wrap"><div class="mp-etat"><div class="mp-lock">' + ICO('euro', 26, 1.8) + '</div><h1 class="mp-et">' + esc(titre) + '</h1><p>' + esc(texte) + '</p>' + (bouton || '') + '</div></div>';
  }
  function chargement(root) {
    css();
    root.innerHTML = top() + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
  }

  // ── Dessin de l’écran ─────────────────────────────────────────────
  function dessiner(root) {
    var C = calc(S.K), y = window.pageYOffset || 0;
    if (S.vue === 'officine' && D.off && D.off.pil) { dessinerP(root); return; }
    if (S.vue === 'officine' && D.off) {
      root.innerHTML = top() + '<div class="v2-wrap mp-wrap">' + enTete(C) + kpisO() + sectionOfficines() + piedO() + '</div>';
      racine = root;
      majOfficines();
    } else {
      root.innerHTML = top() + '<div class="v2-wrap mp-wrap">' + enTete(C) + kpis(C) + sectionFamilles(C) + sectionNuage(C) + sectionPrio(C) + sectionTous() + sectionSans(C) + pied() + '</div>';
      racine = root;
      dessinerNuage();
      majTableau();
    }
    try { window.scrollTo(0, y); } catch (e) {}
  }

  function brancher() {
    if (ecouteurs) return; ecouteurs = true;
    document.addEventListener('click', function (e) {
      var r = document.querySelector('.mp-wrap'); if (!r || !D) return;
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      var host = document.getElementById('mp-chart');
      if (b && r.contains(b)) {
        var a = b.getAttribute('data-act');
        if (a === 'an') { S.K = b.getAttribute('data-k'); S.n = N_PAGE; S.oN = N_PAGE; memo = {}; memoO = {}; dessiner(racine); }
        else if (a === 'ouv') { var cd = b.getAttribute('data-c'); S.oOuvert[cd] = !S.oOuvert[cd]; var w = b.parentNode; var neuf = document.createElement('div'); neuf.innerHTML = D.off.pil ? fr(ligneAff(D.off.rows.filter(function (r) { return r.code === cd; })[0])) : ligneO(D.off.rows.filter(function (r) { return r.code === cd; })[0]); if (w && w.parentNode && neuf.firstChild) w.parentNode.replaceChild(neuf.firstChild, w); }
        else if (a === 'perim') { S.perim = b.getAttribute('data-v') || ''; S.oN = N_PAGE; S.oCase = null; S.oAl = ''; dessiner(racine); }
        else if (a === 'case') { var kc = parseInt(b.getAttribute('data-v'), 10); S.oCase = S.oCase === kc ? null : kc; majFiltres(true); }
        else if (a === 'al') { var ka = b.getAttribute('data-v'); S.oAl = S.oAl === ka ? '' : ka; majFiltres(true); }
        else if (a === 'clr') { S.oCase = null; S.oAl = ''; majFiltres(false); }
        else if (a === 'plusO') { S.oN += N_PAGE; majOfficines(); }
        else if (a === 'fiche') { var cf = b.getAttribute('data-c'); if (V2.go) V2.go('pharma', cf); }
        else if (a === 'fam') { var f = b.getAttribute('data-f'); S.masq[f] = !S.masq[f]; b.classList.toggle('off', !!S.masq[f]); b.setAttribute('aria-pressed', String(!S.masq[f])); dessinerNuage(); }
        else if (a === 'plus') { S.n += N_PAGE; majTableau(); }
        else if (a === 'sens') { S.sens = -S.sens; S.n = N_PAGE; majTableau(); }
        else if (a === 'sanstout') { S.sansTout = !S.sansTout; dessiner(racine); }
        else if (a === 'fermer') { cacherBulle(); }
        else if (a === 'reessayer') { accesEchec = false; if (etatFichier === 'refuse') etatFichier = 'attente'; V2.render(); }
        return;
      }
      if (host && e.target.closest && e.target.closest('#mp-chart') && e.target.closest('svg')) {
        if (Date.now() - dernierToucher < 800) return;   // le toucher vient d'être traité (pointerup) : pas de second passage
        var bb = host.querySelector('svg').getBoundingClientRect();
        var p = trouverPoint(e.clientX - bb.left, e.clientY - bb.top, 14);
        if (p) { S.epingle = p; montrerBulle(p, true); } else cacherBulle();
      }
    });
    // Le doigt : on traite la levée du doigt elle-même (certains moteurs n'envoient ni « pointerup » ni « click » après un toucher).
    function toucher(e, x, y) {
      var host = document.getElementById('mp-chart'); if (!host || !D || !e.target.closest || !e.target.closest('#mp-chart svg')) return;
      if (Date.now() - dernierToucher < 300) return;   // déjà traité par l'autre événement
      dernierToucher = Date.now();
      var bb = host.querySelector('svg').getBoundingClientRect();
      var p = trouverPoint(x - bb.left, y - bb.top, 14);
      if (p) { S.epingle = p; montrerBulle(p, true); } else cacherBulle();
    }
    document.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch' || e.pointerType === 'pen') toucher(e, e.clientX, e.clientY); });
    document.addEventListener('touchend', function (e) { var t = e.changedTouches && e.changedTouches[0]; if (t) toucher(e, t.clientX, t.clientY); });
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || S.epingle) return;
      var host = document.getElementById('mp-chart'); if (!host || !host.querySelector('svg')) return;
      var bb = host.querySelector('svg').getBoundingClientRect();
      var x = e.clientX - bb.left, y = e.clientY - bb.top;
      if (x < 0 || y < 0 || x > bb.width || y > bb.height) { cacherBulle(); return; }
      var p = trouverPoint(x, y, 4);
      if (p) montrerBulle(p, false); else cacherBulle();
    });
    document.addEventListener('input', function (e) {
      if (!D || !e.target) return;
      if (e.target.id === 'mp-oq') { var vo = e.target.value; clearTimeout(minuterie); minuterie = setTimeout(function () { S.oq = vo; S.oN = N_PAGE; majOfficines(); }, 120); }
      else if (e.target.id === 'mp-q') { var v = e.target.value; clearTimeout(minuterie); minuterie = setTimeout(function () { S.q = v; S.n = N_PAGE; majTableau(); }, 120); }
    });
    document.addEventListener('change', function (e) {
      if (!D || !e.target) return;
      if (e.target.id === 'mp-ocomm') { S.oComm = e.target.value; S.oN = N_PAGE; majOfficines(); }
      else if (e.target.id === 'pil-coll') { if (e.target.value) { S.perim = e.target.value; S.oN = N_PAGE; S.oCase = null; S.oAl = ''; dessiner(racine); } }
      else if (e.target.id === 'pil-lst') { S.lst = parseInt(e.target.value, 10) || 0; dessiner(racine); }
      else if (e.target.id === 'mp-otri') { S.oTriChoisi = true; S.oTri = e.target.value; S.oN = N_PAGE; majOfficines(); }
      else if (e.target.id === 'mp-osans') { S.oSans = !!e.target.checked; S.oN = N_PAGE; majOfficines(); }
      else if (e.target.id === 'mp-fam') { S.fam = e.target.value; S.n = N_PAGE; majTableau(); }
      else if (e.target.id === 'mp-tri') { S.tri = e.target.value; S.n = N_PAGE; majTableau(); }
    });
    var tmr = null;
    window.addEventListener('resize', function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () { var h = document.getElementById('mp-chart'); if (h && D && V2.route && V2.route.name === 'margeproduits') { var w = h.clientWidth; if (!h.__geo || Math.abs(h.__geo.W - w) > 2) dessinerNuage(); } }, 160);
    });
  }

  V2.pages = V2.pages || {};
  V2.pages.margeproduits = {
    needs: [],     // le fichier de chiffres n’est demandé qu’APRÈS le contrôle d’accès (voir charger)
    render: function (root, param) {
      css(); racine = root;
      S.vue = param === 'officine' ? 'officine' : 'produit';   // l'onglet vient de l'adresse
      if (acces === null) {
        if (accesEchec) {   // pas de boucle : on le DIT, avec un bouton
          message(root, 'Connexion impossible pour l’instant', 'L’écran n’a pas pu vérifier votre accès. Réessayez dans un instant.',
            '<button class="v2-btn v2-btn-primary" data-act="reessayer">Réessayer</button>');
          brancher();
          return;
        }
        chargement(root);
        verifier().then(function (ok) {
          if (acces === null) accesEchec = true;
          if (!(V2.route && V2.route.name === 'margeproduits')) return;
          V2.render();
        });
        return;
      }
      if (acces === false) {
        message(root, 'Cet écran est réservé', 'Les chiffres de marge par produit ne sont visibles que depuis un compte autorisé. Ce compte n’y a pas accès.',
          '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'home\')">Retour à l’accueil</button>');
        return;
      }
      if (etatFichier === 'attente') {
        chargement(root);
        charger().then(function () { if (V2.route && V2.route.name === 'margeproduits') V2.render(); });
        return;
      }
      if (etatFichier === 'refuse' || !window.MARGE_PRODUITS) {
        message(root, 'Ces chiffres sont réservés', 'Le fichier de marge par produit n’a pas pu être ouvert avec ce compte. Si la connexion a été coupée, réessayez dans un instant.',
          '<button class="v2-btn v2-btn-primary" data-act="reessayer">Réessayer</button>');
        brancher();
        return;
      }
      if (!D) {
        try { D = preparer(window.MARGE_PRODUITS); }
        catch (e) { console.error('[V2 margeproduits]', e); message(root, 'Ces chiffres ne se lisent pas', 'Le fichier de marge par produit est illisible. Il faut le régénérer.'); return; }
        try { D.off = preparerOfficines(window.MARGE_PRODUITS, D); } catch (e2) { console.error('[V2 margeproduits] officines', e2); D.off = null; }
        if (!S.K) S.K = D.k1;
      }
      if (D.off && D.off.pil) {   // pilotage : barème 2027 seulement ; on ouvre sur MES officines si le compte a un commercial, sinon sur toute l'équipe
        S.K = D.k1;
        if (S.perim === null) S.perim = monCommercial();
        if (S.lst < 0) S.lst = Math.min(1, D.off.pil.L.length - 1);
        if (!S.oTriChoisi) { S.oTri = 'en'; S.oTriChoisi = true; }
      }
      brancher();
      dessiner(root);
    }
  };

  // 22/10/2026 : plus de ligne de menu à part, on entre par « Listing produits 2027 » (v2-listings2027.js).
  V2.margeproduits = {
    css: css   // 21/10/2026 : « Listing produits 2027 » (v2-listings2027.js) réutilise le même habillage
  };

  // ── Habillage (variables de l’app, rien d’inventé) ────────────────
  function css() {
    if (document.getElementById('mp-css')) return;
    var s = document.createElement('style'); s.id = 'mp-css';
    s.textContent = [
      '.mp-wrap{max-width:1180px;position:relative;isolation:isolate}',
      '.mp-wrap::before{content:"";position:absolute;left:0;right:0;top:-60px;height:380px;pointer-events:none;z-index:-1;background:radial-gradient(ellipse 380px 210px at 34% 110px,color-mix(in srgb,var(--c-froid) 17%,transparent),transparent),radial-gradient(ellipse 320px 200px at 68% 120px,color-mix(in srgb,var(--ip-blue) 12%,transparent),transparent)}',
      '@keyframes mpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '.mp-hero,.mp-kpi,.mp-sec{animation:mpIn .5s var(--ease) both}',
      '.mp-kpi:nth-child(2){animation-delay:.05s}.mp-kpi:nth-child(3){animation-delay:.1s}.mp-kpi:nth-child(4){animation-delay:.15s}',
      '@media (prefers-reduced-motion:reduce){.mp-hero,.mp-kpi,.mp-sec{animation:none}}',
      /* en-tête */
      '.mp-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin:2px 0 22px}',
      '.mp-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#0A6C86;background:color-mix(in srgb,var(--c-froid) 13%,#fff);padding:5px 12px;border-radius:20px;margin-bottom:12px;box-shadow:0 0 0 1px color-mix(in srgb,var(--c-froid) 25%,transparent) inset}',
      '.mp-eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--c-froid)}',
      '.mp-h1{font-size:38px;font-weight:800;letter-spacing:-.035em;line-height:1.04;margin:0 0 10px}',
      '.mp-sub{font-size:14.5px;line-height:1.55;color:var(--muted);max-width:68ch;margin:0}',
      '.mp-hero-a{display:flex;align-items:center;gap:10px}',
      '.mp-seg-l{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
      '.mp-seg{display:inline-flex;gap:2px;padding:3px;background:var(--surf-sunken);border:1px solid var(--line);border-radius:14px}',
      '.mp-seg button{border:0;background:none;padding:0 22px;border-radius:11px;font:inherit;font-size:16px;font-weight:800;color:var(--muted);cursor:pointer;min-height:44px;font-family:var(--mono)}',
      '.mp-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-2)}',
      /* chiffres clés */
      '.mp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:8px}',
      '.mp-kpi{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:var(--r-card);padding:18px 20px 18px 22px;box-shadow:var(--sh-2);background:radial-gradient(130% 95% at 0% 0%,color-mix(in srgb,var(--k) 12%,#fff),#fff 62%)}',
      '.mp-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--k)}',
      '.mp-kl{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;line-height:1.35}',
      '.mp-kv{font-family:var(--mono);font-size:30px;font-weight:700;letter-spacing:-.03em;margin:8px 0 6px;line-height:1.1;font-variant-numeric:tabular-nums}',
      '.mp-kv small{display:block;font-family:var(--font);font-size:12px;font-weight:700;letter-spacing:0;color:var(--muted)}',
      '.mp-kv[data-k="froid"]{display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:10px;font-size:26px}',
      '.mp-kv[data-k="froid"] em{display:none}',
      '.mp-kv[data-k="froid"] span{grid-column:1}.mp-kv[data-k="froid"] small{grid-column:2}',
      '.mp-kd{font-size:13px;line-height:1.5;color:var(--muted)}',
      '.mp-kd b.neg{color:var(--c-rose-txt)}.mp-kd b.pos{color:var(--c-mint-txt)}',
      '.mp-duo2{display:grid;gap:5px;margin:2px 0 8px}',
      '.mp-duo2>div{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--muted)}',
      /* barres */
      '.mp-bar{display:block;height:10px;border-radius:6px;background:var(--surf-sunken);overflow:hidden;box-shadow:0 0 0 1px var(--line-2) inset}',
      '.mp-bar i{display:block;height:100%;min-width:2px;border-radius:6px}',
      /* sections */
      '.mp-sec{margin-top:var(--section-gap)}',
      '.mp-sh{display:flex;flex-direction:column;gap:5px;margin:0 0 14px}',
      '.mp-sh h2{font-size:22px;font-weight:800;letter-spacing:-.025em;line-height:1.1;margin:0}',
      '.mp-sh span{font-size:13.5px;line-height:1.5;color:var(--muted);max-width:90ch}',
      '.mp-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      /* familles */
      '.mp-fh,.mp-fr{display:grid;grid-template-columns:210px minmax(0,1fr) 112px 104px;gap:16px;align-items:center;padding:14px 22px}',
      '.mp-fh{background:var(--card-2);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:11px;padding-bottom:11px}',
      '.mp-fh span:nth-child(3),.mp-fh span:nth-child(4){text-align:right}',
      '.mp-fr{border-bottom:1px solid var(--line-2)}.mp-fr:last-child{border-bottom:0}',
      '.mp-fn{display:flex;flex-direction:column;gap:3px;align-items:flex-start}.mp-fn small{font-size:12px;color:var(--muted);padding-left:2px}',
      '.mp-fb{display:grid;gap:6px}',
      '.mp-fl{display:grid;grid-template-columns:84px minmax(0,1fr) 58px;align-items:center;gap:10px;font-size:12px;font-weight:700;color:var(--muted)}',
      '.mp-fl b{font-family:var(--mono);font-size:13px;color:var(--ip-ink);text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-fl.m .mp-bar{height:14px}.mp-fl.m b{font-size:14px}',
      '.mp-fv{font-family:var(--mono);font-weight:700;font-size:14px;text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-fam{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--ip-ink-2);line-height:1.3}',
      '.mp-fam i{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 22%,transparent)}',
      /* nuage */
      '.mp-nuage{padding:16px 18px 14px}',
      '.mp-legend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
      '.mp-lg{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line-strong);background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;white-space:nowrap;box-shadow:var(--sh-1)}',
      '.mp-lg i{width:11px;height:11px;border-radius:50%;background:var(--c);flex:none}',
      '.mp-lg.off{color:var(--muted);background:var(--surf-sunken);text-decoration:line-through}.mp-lg.off i{background:transparent;box-shadow:0 0 0 1.5px var(--c) inset}',
      '.mp-lg.ghost{cursor:default;border-style:dashed;box-shadow:none;background:transparent}.mp-lg.ghost i{background:#E3E6EE;box-shadow:0 0 0 1.5px #8A93A8 inset}',
      '.mp-chart{position:relative;width:100%;touch-action:manipulation}',
      '.mp-svg{display:block;max-width:100%;cursor:crosshair;overflow:visible}',
      '.mp-ax{font-size:12px;fill:#646B80;font-family:var(--mono)}.mp-ax.s{font-family:var(--font);font-size:11.5px}',
      '.mp-axt{font-size:12.5px;font-weight:700;fill:#646B80;font-family:var(--font)}',
      '.mp-seu{font-size:12px;font-weight:700;fill:#0A6C86;font-family:var(--font);paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}',
      '.mp-quart{font-size:15px;font-weight:800;fill:#0A6C86;font-family:var(--font);letter-spacing:-.01em;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}',
      '.mp-lab{font-size:12px;font-weight:700;fill:#10131C;font-family:var(--font);paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round}',
      '.mp-tip{position:absolute;z-index:5;width:262px;max-width:calc(100% - 8px);background:var(--card);border:1px solid var(--line-strong);border-radius:14px;box-shadow:var(--sh-3);padding:12px 14px 12px;pointer-events:none}',
      '.mp-tip.fixe{pointer-events:auto}',
      '.mp-tip[hidden]{display:none}',
      '.mp-tn{font-weight:800;font-size:14px;line-height:1.3;padding-right:34px}.mp-tl{font-size:12.5px;color:var(--muted);margin:2px 0 7px}.mp-tf{margin-bottom:8px}',
      '.mp-tip dl{margin:0;display:grid;gap:4px}.mp-tip dl div{display:flex;justify-content:space-between;gap:10px;font-size:13px}',
      '.mp-tip dt{color:var(--muted)}.mp-tip dd{margin:0;font-family:var(--mono);font-weight:700;font-variant-numeric:tabular-nums}',
      '.mp-tw{margin-top:8px;font-size:12.5px;font-weight:700;color:var(--c-amber-txt)}',
      '.mp-tx{position:absolute;right:2px;top:2px;width:44px;height:44px;border:0;background:none;font-size:26px;line-height:1;color:var(--muted);cursor:pointer}',
      '.mp-note{font-size:12.5px;line-height:1.55;color:var(--muted);margin:8px 2px 0;max-width:100ch}',
      /* tableaux */
      '.mp-tab{display:block}',
      '.mp-row{display:grid;align-items:center;gap:12px;padding:12px 22px;border-bottom:1px solid var(--line-2);font-size:13.5px}',
      '.mp-row:last-child{border-bottom:0}',
      '.mp-row.prio{grid-template-columns:34px minmax(0,1fr) 150px 84px 84px 96px 92px 190px}',
      '.mp-row.tous{grid-template-columns:minmax(0,1fr) 190px 92px 108px 112px 104px}',
      '.mp-row.sans{grid-template-columns:minmax(0,1fr) 100px 120px 112px 104px}',
      '.mp-head{background:var(--card-2);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:11px;padding-bottom:11px}',
      '.mp-head .c{text-align:right}',
      '.mp-row:not(.mp-head):hover{background:var(--card-2)}',
      '.mp-rk{font-family:var(--mono);font-weight:800;font-size:14px;color:var(--muted)}',
      '.mp-n{min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.mp-n b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-n span{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-plus{font-style:normal;font-weight:700;color:var(--c-amber-txt)}',
      '.mp-c{font-family:var(--mono);text-align:right;font-variant-numeric:tabular-nums;font-weight:600}',
      '.mp-c.fam{font-family:var(--font);text-align:left}',
      '.mp-c.tx .v2-chip{font-family:var(--mono);font-size:13.5px;font-weight:800;padding:4px 11px}',
      '.mp-c.jv{display:grid;gap:5px;justify-items:end}.mp-c.jv b{font-weight:800}.mp-c.jv .mp-bar{width:100%;height:8px}',
      '.mp-vide{padding:36px 22px;text-align:center;color:var(--muted)}',
      /* outils du tableau */
      '.mp-bar-outils{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;padding:16px 22px;border-bottom:1px solid var(--line)}',
      '.mp-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--muted)}',
      '.mp-field.mp-q{flex:1 1 280px}',
      '.mp-field input,.mp-field select{font:inherit;font-size:16px;font-weight:600;color:var(--ip-ink);min-height:48px;padding:0 14px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);box-shadow:var(--sh-1);width:100%}',
      '.mp-field select{min-width:200px;-webkit-appearance:none;appearance:none;padding-right:40px;background:var(--card) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23646B80%27 stroke-width=%272.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E") no-repeat right 14px center}',
      '.mp-sens{min-height:48px;padding:0 16px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);box-shadow:var(--sh-1);font:inherit;font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.mp-compte{padding:11px 22px;font-size:13px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--line-2)}',
      '.mp-plusw{display:flex;justify-content:center;padding:16px}.mp-plusw .v2-btn{min-height:48px}.mp-plusw[hidden],.mp-plusw .v2-btn[hidden]{display:none}',
      /* pied */
      '.mp-pied{margin-top:var(--section-gap);padding:20px 22px;border-radius:var(--r-card);background:var(--surf-sunken);border:1px solid var(--line)}',
      '.mp-pied h3{font-size:14px;font-weight:800;margin:0 0 8px}',
      '.mp-pied ul{margin:0 0 10px;padding-left:18px;font-size:13px;line-height:1.6;color:var(--ip-ink-2)}',
      '.mp-pied p{margin:0 0 6px;font-size:13px;line-height:1.55;color:var(--muted)}',
      '.mp-pied .conf{font-weight:800;color:var(--ip-ink-2);margin-top:10px}',
      /* états */
      '.mp-etat{max-width:520px;margin:60px auto;text-align:center;padding:36px 28px;border-radius:var(--r-card);background:radial-gradient(120% 90% at 50% 0%,color-mix(in srgb,var(--c-froid) 12%,#fff),#fff 66%);border:1px solid var(--line);box-shadow:var(--sh-2)}',
      '.mp-lock{width:56px;height:56px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;color:#0A6C86;background:color-mix(in srgb,var(--c-froid) 14%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-froid) 28%,transparent) inset}',
      '.mp-et{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0 0 8px}',
      '.mp-etat p{font-size:14.5px;line-height:1.55;color:var(--muted);margin:0 0 18px}',
      '.mp-etat .v2-btn{min-height:48px}',
      '.mp-um svg{color:var(--c-froid)}',
      /* vue par officine */
      '.mp-hero-b{display:flex;align-items:center;gap:12px 24px;flex-wrap:wrap}',
      '.mp-seg-vue button{font-family:var(--font);font-size:15px;padding:0 18px}',
      '.mp-def{margin:14px 2px 0;font-size:14px;line-height:1.6;color:var(--ip-ink-2);max-width:100ch}',
      '.mp-check{display:inline-flex;align-items:center;gap:10px;min-height:48px;font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.mp-check input{width:22px;height:22px;accent-color:#0A6C86;flex:none;margin:0}',
      '.mp-olist{display:block}',
      '.mp-orow{display:grid;grid-template-columns:minmax(0,1fr) 100px 108px 188px 100px 108px 108px 22px;align-items:center;gap:12px;padding:12px 22px;width:100%;text-align:left;font:inherit;font-size:13.5px;color:inherit;background:none;border:0;border-bottom:1px solid var(--line-2);cursor:pointer;min-height:56px}',
      '.mp-orow:hover{background:var(--card-2)}',
      '.mp-orow:focus-visible{outline:2px solid #0A6C86;outline-offset:-2px}',
      '.mp-ohead{background:var(--card-2);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:11px;padding-bottom:11px;cursor:default;min-height:0}',
      '.mp-ohead:hover{background:var(--card-2)}.mp-ohead .c{text-align:right}',
      '.mp-orow .mp-n{min-width:0}',
      '.mp-orow .mp-n>span{display:block}',
      '.mp-n span.mp-pa{white-space:normal}',
      '.mp-c.oc{font-family:var(--font);text-align:left;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-c.of{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}',
      '.mp-ofv{font-weight:800}',
      '.mp-ref{font-family:var(--font);font-size:12px;font-weight:600;color:var(--muted)}',
      '.mp-sf{font-style:normal;font-family:var(--font);font-size:12px;font-weight:800;color:var(--c-rose-txt);background:color-mix(in srgb,var(--c-rose) 12%,#fff);padding:2px 9px;border-radius:20px;box-shadow:0 0 0 1px color-mix(in srgb,var(--c-rose) 28%,transparent) inset;display:inline-block;width:fit-content}',
      '.mp-c.pot{font-weight:800}.mp-c.pot.f{color:#0A6C86}',
      '.mp-chev{width:10px;height:10px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);justify-self:end;transition:transform .15s var(--ease)}',
      '.mp-orow-w.ouvert .mp-chev{transform:rotate(-135deg)}',
      '.mp-orow-w.ouvert .mp-orow{background:var(--card-2)}',
      '.mp-odet{padding:6px 22px 18px;background:var(--card-2);border-bottom:1px solid var(--line)}',
      '.mp-odh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;padding:12px 0}',
      '.mp-odh b{display:block;font-size:15px;font-weight:800}.mp-odh span{display:block;font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:3px;max-width:70ch}',
      '.mp-fiche{min-height:48px;white-space:nowrap}',
      '.mp-mq{display:grid;grid-template-columns:minmax(0,1fr) 190px 150px 110px;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line-2);font-size:13.5px}',
      '.mp-mqh{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-top:0;padding-bottom:6px}.mp-mqh .c{text-align:right}',
      '.mp-mq .mp-c.fam{text-align:left}',
      /* petits écrans */
      '@media(max-width:1040px){.mp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.mp-orow{grid-template-columns:minmax(0,1fr) 84px 92px 160px 88px 92px 92px 18px;gap:10px;padding-left:16px;padding-right:16px}',
      '.mp-mq{grid-template-columns:minmax(0,1fr) 160px 130px 100px}',
      '.mp-row.prio{grid-template-columns:30px minmax(0,1fr) 130px 70px 74px 84px 84px 150px;gap:10px;padding-left:16px;padding-right:16px}',
      '.mp-row.tous{grid-template-columns:minmax(0,1fr) 150px 80px 92px 104px 90px}}',
      '@media(max-width:720px){',
      '.mp-h1{font-size:30px}',
      '.mp-hero{align-items:flex-start}',
      '.mp-kpis{grid-template-columns:minmax(0,1fr)}',
      '.mp-kv{font-size:28px}',
      '.mp-fh{display:none}',
      '.mp-fr{grid-template-columns:1fr 1fr;gap:12px 10px;padding:16px}',
      '.mp-fn{grid-column:1/-1;flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mp-fb{grid-column:1/-1}',
      '.mp-fl{grid-template-columns:78px minmax(0,1fr) 54px;gap:8px}',
      '.mp-fv{text-align:left;font-size:15px}.mp-fv::before{content:attr(data-l);display:block;font-family:var(--font);font-size:11.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}',
      '.mp-nuage{padding:12px 10px}',
      '.mp-legend{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;margin-left:-2px;-webkit-overflow-scrolling:touch}',
      '.mp-head{display:none}',
      '.mp-row,.mp-row.prio,.mp-row.tous,.mp-row.sans{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 10px;padding:14px 16px;position:relative;align-items:start}',
      '.mp-row.sans{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.mp-row .mp-n{order:1;grid-column:1/-1}',
      '.mp-row .mp-c.fam{order:2;grid-column:1/3;align-self:center}',
      '.mp-row .mp-c.tx{order:3;grid-column:3;justify-self:end}',
      '.mp-row.sans .mp-c.tx{order:5;grid-column:auto;justify-self:start}',
      '.mp-row .mp-c{order:4}',
      '.mp-row.sans .mp-c{order:4}',
      '.mp-row .mp-c.jv{order:6;grid-column:1/-1}',
      '.mp-row.prio .mp-rk{position:absolute;left:16px;top:15px;font-size:13px}',
      '.mp-row.prio .mp-n{padding-left:28px}',
      '.mp-n b{white-space:normal}',
      '.mp-c{text-align:left;font-size:14.5px}',
      '.mp-c::before{content:attr(data-l);display:block;font-family:var(--font);font-size:12px;font-weight:600;color:var(--muted);margin-bottom:2px;white-space:nowrap}',
      '.mp-c.fam::before{display:none}',
      '.mp-c.tx{text-align:right}.mp-row.sans .mp-c.tx{text-align:left}',
      '.mp-c.jv{justify-items:stretch;display:block}.mp-c.jv b{display:block;margin-bottom:5px}',
      '.mp-c.tx .v2-chip{font-size:14px}',
      '.mp-bar-outils{padding:14px 16px}',
      '.mp-field.mp-q{flex:1 1 100%}.mp-field{flex:1 1 100%}.mp-field select{min-width:0}',
      '.mp-sens{flex:1 1 100%}',
      '.mp-compte{padding:10px 16px}',
      '.mp-etat{margin:36px 4px;padding:28px 18px}',
      '.mp-tip{width:236px}',
      '.mp-hero-b{width:100%}',
      '.mp-hero-b .mp-seg-l{display:none}',
      '.mp-hero-b .mp-hero-a{flex:1 1 100%}',
      '.mp-seg-vue{width:100%}.mp-seg-vue button{flex:1 1 0;padding:0 8px}',
      '.mp-ohead{display:none}',
      '.mp-orow{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px;padding:14px 38px 14px 16px;position:relative;align-items:start}',
      '.mp-orow .mp-n{grid-column:1/-1}',
      '.mp-orow .mp-n b{white-space:normal}',
      '.mp-c.oc{grid-column:1/-1;order:2;white-space:normal}',
      '.mp-c.oc::before{display:inline;margin-right:6px}',
      '.mp-chev{position:absolute;right:16px;top:22px}',
      '.mp-odet{padding:4px 16px 16px}',
      '.mp-odh{flex-direction:column}',
      '.mp-fiche{width:100%}',
      '.mp-mqh{display:none}',
      '.mp-mq{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}',
      '.mp-mq .mp-n{grid-column:1/-1}',
      '.mp-mq .mp-c.fam{grid-column:1/-1}',
      '.mp-check{flex:1 1 100%}',
      '}'
    ].join('\n') + '\n' + cssPil();
    document.head.appendChild(s);
  }
  // 22/10/2026 — habillage du pilotage (variables de l'app ; aucune barre de couleur d'un seul côté, aucun opacity sur du texte)
  function cssPil() {
    return [
      '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
      '.pil-wrap .pos{color:var(--c-mint-txt)}.pil-wrap .neg{color:var(--c-rose-txt)}',
      /* périmètre */
      '.pil-perim{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin:0 0 18px}',
      '.pil-pl{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);align-self:center;margin-right:2px}',
      '.pil-pb{min-height:48px;padding:0 18px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);box-shadow:var(--sh-1);font:inherit;font-size:14.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.pil-pb.on,.pil-coll.on select{background:var(--ip-ink);color:#fff;border-color:var(--ip-ink)}',
      '.pil-coll{display:flex;flex-direction:column;gap:3px;font-size:11.5px;font-weight:700;color:var(--muted)}',
      '.pil-coll select{font:inherit;font-size:16px;font-weight:700;min-height:48px;padding:0 14px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink-2);box-shadow:var(--sh-1);min-width:180px}',
      /* pistes de taux */
      '.pil-trk{position:relative;display:block;height:9px;border-radius:6px;background:var(--surf-sunken);box-shadow:0 0 0 1px var(--line-2) inset;min-width:50px}',
      '.pil-trk i{display:block;height:100%;min-width:2px;border-radius:6px}',
      '.pil-trk u{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#0A6C86;text-decoration:none;border-radius:1px}',
      '.pil-trk.big{height:14px;margin:4px 0 10px}',
      /* cases et alertes (pastilles) */
      '.pil-chips{display:flex;flex-wrap:wrap;gap:5px 6px;margin-top:4px}',
      '.mp-orow .mp-n>span.pil-chips{display:flex;white-space:normal;overflow:visible}',
      '.pil-cas,.pil-al{font-style:normal;font-family:var(--font);font-size:11.5px;font-weight:800;line-height:1;padding:4px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
      '.pil-cas{color:var(--ip-ink-2);background:var(--card);box-shadow:0 0 0 1px var(--line-strong) inset}',
      '.pil-cas i{width:9px;height:9px;border-radius:50%;background:var(--c);flex:none}',
      '.pil-al{color:var(--c-amber-txt);background:color-mix(in srgb,var(--c-amber) 13%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-amber) 30%,transparent) inset}',
      '.pil-al.b,.pil-al.t{color:var(--c-rose-txt);background:color-mix(in srgb,var(--c-rose) 11%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-rose) 28%,transparent) inset}',
      /* entrée 1 : 4 cartes */
      '.pil-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}',
      '.pil-card{border:1px solid var(--line);border-radius:var(--r-card);padding:18px 18px 16px;box-shadow:var(--sh-2);background:radial-gradient(130% 95% at 0% 0%,color-mix(in srgb,var(--c-froid) 10%,#fff),#fff 62%);min-width:0;display:flex;flex-direction:column;gap:6px}',
      '.pil-card .mp-kv{margin:6px 0 2px}',
      '.pil-fams{display:grid;gap:9px;margin:6px 0 4px}',
      '.pil-fr{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(40px,1fr) 78px;align-items:center;gap:8px;font-size:12.5px}',
      '.pil-fr .mp-fam{font-size:12px}.pil-fr b{font-family:var(--mono);font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums}',
      '.pil-fr .mp-bar{height:9px}.pil-fn{min-width:0}',
      '.pil-cases{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}',
      '.pil-case{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"i b" "n n" "s s" "e e";column-gap:7px;align-items:center;text-align:left;font:inherit;min-height:84px;padding:10px 11px;border-radius:14px;border:1px solid var(--line-strong);background:var(--card);cursor:pointer;color:var(--ip-ink-2)}',
      '.pil-case i{grid-area:i;width:11px;height:11px;border-radius:50%;background:var(--c)}',
      '.pil-case b{grid-area:b;font-family:var(--mono);font-size:21px;font-weight:800;line-height:1.1}',
      '.pil-case span{grid-area:n;font-size:12.5px;font-weight:800;line-height:1.25;margin-top:3px}',
      '.pil-case small{grid-area:s;font-size:11.5px;color:var(--muted);line-height:1.3}',
      '.pil-case em{grid-area:e;font-style:normal;font-size:11px;font-weight:800;color:var(--c-amber-txt);margin-top:2px}',
      '.pil-case.on{background:color-mix(in srgb,var(--c) 14%,#fff);border-color:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 40%,transparent)}',
      '.pil-als{display:grid;gap:6px;margin:6px 0 4px}',
      '.pil-alb{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px;min-height:44px;padding:4px 10px;border-radius:12px;border:1px solid var(--line-strong);background:var(--card);font:inherit;cursor:pointer;text-align:left;color:var(--ip-ink-2)}',
      '.pil-alb b{font-family:var(--mono);font-size:19px;font-weight:800;text-align:right}.pil-alb span{font-size:12.5px;font-weight:700;line-height:1.25}',
      '.pil-alb.on{background:var(--ip-ink);color:#fff;border-color:var(--ip-ink)}',
      /* entrée 2 : la carte */
      /* entrée 3 : la file */
      '.pil-ph{margin:0;padding-left:18px;font-size:13.5px;line-height:1.5;color:var(--ip-ink-2);display:grid;gap:5px}',
      '.pil-cl{font-size:12px;font-weight:700;color:var(--muted)}',
      /* par commercial */
      '.pil-er{display:grid;grid-template-columns:minmax(0,1.3fr) 76px 100px 108px minmax(130px,1.1fr) 84px 76px 104px 110px;gap:10px;align-items:center;width:100%;padding:11px 20px;text-align:left;font:inherit;font-size:13.5px;color:inherit;background:none;border:0;border-bottom:1px solid var(--line-2);min-height:52px}',
      'button.pil-er{cursor:pointer}button.pil-er:hover{background:var(--card-2)}button.pil-er:focus-visible{outline:2px solid #0A6C86;outline-offset:-2px}',
      '.pil-eh{background:var(--card-2);border-bottom:1px solid var(--line);font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);min-height:0;padding-top:10px;padding-bottom:10px}.pil-eh .c{text-align:right}',
      '.pil-txc{display:flex;flex-direction:column;gap:3px;text-align:left!important}.pil-txc b{font-family:var(--mono);font-weight:800}',
      '.pil-er .pil-txc{align-items:stretch}',
      /* simulateur */
      '.pil-sim{padding:18px 22px 14px}',
      '.pil-simt{font-size:16px;line-height:1.7;color:var(--ip-ink-2)}',
      '.pil-lstw select{font:inherit;font-size:16px;font-weight:800;min-height:48px;padding:0 14px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1);vertical-align:middle;margin-left:4px}',
      /* Safari : sans « appearance:none », une liste déroulante ignore min-height (25 px au lieu de 48) */
      '.pil-coll select,.pil-lstw select{-webkit-appearance:none;appearance:none;padding-right:40px;background:var(--card) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23646B80%27 stroke-width=%272.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E") no-repeat right 14px center}',
      '.pil-coll.on select{background-color:var(--ip-ink)}',
      '.pil-simr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:24px;margin-top:14px}',
      '.pil-simr>div{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.pil-big{font-family:var(--mono);font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1.1}.pil-big em{font-style:normal;color:var(--muted)}',
      '.pil-simr small{font-size:12.5px;color:var(--muted)}',
      '.pil-duo{display:grid;grid-template-columns:96px minmax(0,1fr);align-items:center;gap:7px 10px;font-size:12px;font-weight:700;color:var(--muted);margin:2px 0}',
      /* produits qui plombent */
      '.pil-pr{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(150px,1fr) 124px 88px;gap:14px;align-items:center;padding:12px 22px;border-bottom:1px solid var(--line-2);font-size:13.5px}.pil-pr:last-child{border-bottom:0}',
      '.pil-ph2{background:var(--card-2);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:10px;padding-bottom:10px}.pil-ph2 .c{text-align:right}',
      '.pil-pa{display:flex;flex-direction:column;gap:4px;text-align:left!important}.pil-pa .mp-bar{height:8px}.pil-pa small{font-size:11.5px;font-family:var(--font);color:var(--muted)}',
      /* liste */
      '.pil-actifs{display:flex;flex-wrap:wrap;gap:8px;padding:10px 22px;border-bottom:1px solid var(--line-2)}.pil-actifs[hidden]{display:none}',
      '.pil-actif{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--ip-ink);background:var(--ip-ink);color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.pil-wrap .mp-orow{grid-template-columns:minmax(0,1fr) 80px 88px 140px 140px 84px 88px 88px 18px;gap:10px}',
      '.pil-wrap .mp-c.pil-txc small.mp-ref{font-size:11.5px}',
      /* fiche */
      '.pil-det{padding-top:10px}',
      '.pil-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:6px;align-items:start}',
      '.pil-col{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.pil-bloc{padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line);min-width:0}',
      '.pil-bt,.pil-dt>summary,.pil-manq>summary{font-size:13px;font-weight:800;color:var(--ip-ink);margin-bottom:8px}',
      '.pil-dt>summary,.pil-manq>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;margin:0;list-style:none;flex-wrap:wrap}',
      '.pil-dt>summary::-webkit-details-marker,.pil-manq>summary::-webkit-details-marker{display:none}',
      '.pil-dt>summary::before,.pil-manq>summary::before{content:"";width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);flex:none;transition:transform .15s var(--ease)}',
      '.pil-dt[open]>summary::before,.pil-manq[open]>summary::before{transform:rotate(45deg)}',
      '.pil-dt>summary small,.pil-manq>summary small{font-weight:600;color:var(--muted);font-size:12.5px}',
      '.pil-manq{margin-top:14px}',
      '.pil-txg{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}.pil-txg b{font-family:var(--mono);font-size:30px;font-weight:800;letter-spacing:-.03em}.pil-txg span{font-size:13px;color:var(--muted)}',
      '.pil-ech{display:grid;gap:7px}',
      '.pil-erow{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(60px,1fr) 62px 74px;gap:8px;align-items:center;font-size:12.5px;padding:2px 4px;border-radius:8px}',
      '.pil-erow span{color:var(--ip-ink-2);font-weight:600}.pil-erow b{font-family:var(--mono);font-size:13px;text-align:right}.pil-erow small{font-size:11.5px;color:var(--muted);text-align:right}',
      '.pil-erow.sel{background:color-mix(in srgb,var(--c-froid) 10%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-froid) 35%,transparent) inset}',
      '.pil-phd li{padding-left:2px}.pil-phd li.b,.pil-phd li.t{color:var(--c-rose-txt)}.pil-phd li.a,.pil-phd li.p{color:var(--c-amber-txt)}.pil-phd li.x{color:var(--ip-ink-2)}',
      '.pil-courbe{display:block;width:100%;max-width:440px;height:auto}',
      '.pil-pl3{display:grid;grid-template-columns:minmax(0,1fr) 96px 96px;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line-2);font-size:13px}',
      '.pil-pl3 .mp-n span{white-space:normal}',
      '.pil-manq .mp-mq{background:none}',
      /* intermédiaire */
      '@media(max-width:1180px){.pil-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.pil-simr{grid-template-columns:1fr}}',
      '@media(max-width:1040px){.pil-wrap .mp-orow{grid-template-columns:minmax(0,1fr) 88px 130px 120px 80px 88px 18px;gap:8px}',
      '.pil-wrap .mp-c.oc,.pil-wrap .mp-c.pot.f,.pil-wrap .mp-ohead span:nth-child(2),.pil-wrap .mp-ohead span:nth-child(7){display:none}',
      '.pil-cols{grid-template-columns:1fr}',
      '.pil-er{grid-template-columns:minmax(0,1.2fr) 64px 92px 96px minmax(110px,1fr) 70px 64px 96px 96px;gap:8px;padding-left:14px;padding-right:14px}',
      '.pil-pr{grid-template-columns:minmax(0,1.5fr) minmax(130px,1fr) 100px 70px;gap:10px;padding-left:16px;padding-right:16px}}',
      /* téléphone */
      '@media(max-width:720px){',
      '.pil-perim{gap:8px}.pil-pb{flex:1 1 100%}.pil-coll{flex:1 1 100%}.pil-coll select{width:100%}',
      '.pil-cards{grid-template-columns:1fr}',
      '.pil-eh{display:none}',
      '.pil-er{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px 16px;align-items:start}.pil-er .mp-n{grid-column:1/-1}',
      '.pil-er .pil-txc{grid-column:1/-1}',
      '.pil-sim{padding:16px}.pil-simt{font-size:15px}.pil-big{font-size:26px}',
      '.pil-duo{grid-template-columns:90px minmax(0,1fr)}',
      '.pil-ph2{display:none}.pil-pr{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px 16px;align-items:start}.pil-pr .mp-n{grid-column:1/-1}.pil-pr .pil-pa{grid-column:1/-1}',
      '.pil-actifs{padding:10px 16px}',
      '.pil-wrap .mp-orow{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}',
      '.pil-wrap .mp-c.oc,.pil-wrap .mp-c.pot.f{display:block}',
      '.pil-wrap .mp-c.pil-txc{grid-column:1/-1}',
      '.pil-erow{grid-template-columns:minmax(0,1.3fr) minmax(50px,1fr) 56px;}.pil-erow small{display:none}',
      '.pil-pl3{grid-template-columns:repeat(2,minmax(0,1fr))}.pil-pl3 .mp-n{grid-column:1/-1}',
      '.pil-bloc{padding:12px}',
      '}'
    ].join('\n');
  }
})();
