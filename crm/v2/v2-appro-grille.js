/* ═══════════════════════════════════════════════════════════════════════════
   APPRO · « LA GRILLE ET LA FICHE » — l'écran d'arbitrage de STOCK & SITES
   Maquette de référence : ~/jarvis-preuves/appro-maquettes-jarvis/M5-la-grille-et-la-fiche.html
   Arbitrage du 27/09/2026 (Will : « mix 3 et 4 », puis « go ») :

   Cet écran ABSORBE les deux directions précédentes, il ne s'ajoute pas à elles :
     · N2 « Les sept sites »  → la grille référence × 7 établissements + les transferts internes
     · N4 « Le front »        → les vues ANSM / MITM / chaîne du froid, devenues des onglets

   Règle de fonctionnement, différente du reste de l'app : ON NE PASSE PAS PAR V2.render().
   Un seul écouteur délégué posé sur le document (donc increvable au re-rendu), et l'on ne
   réécrit que la fiche, la note et l'attribut aria-selected des lignes. L'état vit en
   variable de module, relue au rendu — même motif que _frontVue / _bookTab.

   Les formules viennent de V2.approM (v2-appro-moteur.js). Les données de l'app viennent de
   V2.approCtx, exposé par v2-appro.js. Zéro calcul dupliqué ici : uniquement de l'affichage.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var _vue = 'casse';      // onglet courant
  var _cip = null;         // référence dont la fiche est ouverte
  var _n = 22;             // lignes affichées dans la grille
  var _pose = 0;           // l'écouteur délégué n'est posé qu'une fois
  var _hist = [];          // pile de la séance : permet de REVENIR sur un arbitrage (correctif 2)

  /* ── Mémoire des arbitrages ───────────────────────────────────────────────
     Les commandes fermes s'écrivent dans le carnet EXISTANT (CMD_KEY, 21 jours) : rien
     de nouveau, et le reste de l'app affiche « déjà commandé le … » comme avant.
     Les transferts et les lignes classées sans commande ont besoin d'un second registre :
     le carnet CMD_KEY ne stocke qu'une DATE par CIP et `commandeDe()` fait de l'arithmétique
     dessus. Y écrire « transfert » casserait la fonction, et marquer un transfert comme une
     commande ferait afficher « déjà commandé » sur une ligne qui n'a jamais été commandée.
     Même durée d'oubli, même principe, 100 % local au navigateur. */
  var ARB_KEY = 'jarvis.appro.arb', ARB_JOURS = 21;
  function jour() { return new Date().toISOString().slice(0, 10); }
  function arbLire() {
    try { return JSON.parse(window.localStorage.getItem(ARB_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function arbEcrire(o) {
    try { window.localStorage.setItem(ARB_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function arbDe(cip) {
    var o = arbLire()[String(cip)];
    if (!o || !o.d) return null;
    var j = Math.round((new Date(jour() + 'T00:00:00') - new Date(o.d + 'T00:00:00')) / 86400000);
    return (j >= 0 && j <= ARB_JOURS) ? o : null;
  }
  function arbTous() {
    var o = arbLire(), out = {};
    Object.keys(o).forEach(function (c) { var a = arbDe(c); if (a) out[c] = a; });
    return out;
  }

  var ACTES = {
    cmd: { v: 'commandée', c: 'var(--ip-blue)' },
    tr: { v: 'réglée par transfert', c: '#0F7A52' },
    x: { v: 'classée sans commande', c: 'var(--muted)' }
  };

  /* ── Les onglets : l'union des 5 vues de N4 et des 3 vues de grille de N2/M3 ── */
  function vues() {
    var M = V2.approM;
    return [
      { k: 'casse', on: 'Ce qui casse en premier',
        t: 'Sous le plancher légal des deux semaines',
        s: 'Moins de ' + M.PLANCHER + ' jours de couverture réseau, toutes causes confondues (article R.5124-59 du code de la santé publique). La plus courte en tête.' },
      { k: 'front', on: 'Le front',
        t: 'Tension déclarée chez le laboratoire ET couverture trop courte',
        s: 'Croisement du statut ANSM et de notre couverture. Une tension déclarée signifie que la commande de réassort ne sera pas servie en entier : il faut arbitrer entre officines, pas espérer.' },
      { k: 'rupt', on: 'Ruptures ANSM',
        t: 'Ruptures de stock déclarées à l’ANSM',
        s: 'Statut « rupture » publié par l’ANSM sur des références que le réseau vend. Le stock des sept sites est ce qui reste avant l’arrêt.' },
      { k: 'mitm', on: 'MITM courts',
        t: 'Médicaments d’intérêt thérapeutique majeur déjà courts',
        s: 'Aucun signalement ANSM pour l’instant, mais ce sont des MITM et nous tenons moins de deux semaines. C’est la décision d’anticipation.' },
      { k: 'desequilibre', on: 'Déséquilibres entre sites',
        t: 'Un site dort pendant qu’un autre est sous le plancher',
        s: 'Le transfert interne règle la ligne sans sortir un euro de marchandise. On le propose AVANT toute commande au laboratoire.' },
      { k: 'concentre', on: 'Stock sur un seul site',
        t: 'Tout le stock réseau posé sur un seul établissement',
        s: 'Au moins 90 % du stock est sur un site : les six autres ne peuvent pas servir, même si la couverture du groupe paraît confortable.' },
      { k: 'froid', on: 'Chaîne du froid',
        t: 'Produits 2-8 °C sous la cible',
        s: 'Ils ne se rattrapent pas par un stock tampon : la capacité frigorifique des sept sites est limitée et un transfert y coûte plus cher.' }
    ];
  }

  function cibleDe(o) {
    var C = V2.approCtx, M = V2.approM;
    return (o.rupt || C.enTension(o.c)) ? M.CIBLE_TENSION : M.CIBLE;
  }

  var _L = null, _lIdx = null, _lAnsm = null, _lMitm = null, _lEp = null;
  function listes() {
    var C = V2.approCtx, M = V2.approM, idx = C.idx(), EP = window.ETAB_PRICES;
    if (_L && _lIdx === idx && _lAnsm === C.ansmRef() && _lMitm === C.mitmRef() && _lEp === EP) return _L;
    var L = { casse: [], front: [], rupt: [], mitm: [], desequilibre: [], concentre: [], froid: [] };
    Object.keys(idx).forEach(function (k) {
      var o = idx[k];
      if (o.vM < C.MINVEL) return;              // même seuil de bruit que le reste de l'écran
      var st = C.ansmStatut(o.c), t = /Rupture|Tension/.test(st), m = C.isMitm(o.c);
      if (/Rupture/.test(st)) L.rupt.push(o);
      if (o.unk) return;                        // jamais inventorié : aucune couverture mesurée
      if (o.cov < M.PLANCHER) L.casse.push(o);
      if (t && o.cov < M.PLANCHER) L.front.push(o);
      if (m && !t && o.cov < M.PLANCHER) L.mitm.push(o);
      if (C.froid(o.c) && o.cov < cibleDe(o)) L.froid.push(o);
      if (EP) {
        if (M.transferts(o.c, o.vM).length) L.desequilibre.push(o);
        if (M.concentre(o.c, o.vM)) L.concentre.push(o);
      }
    });
    function parCouverture(a, b) { return a.cov - b.cov || (b.vM * b.ppht) - (a.vM * a.ppht); }
    function parValeur(a, b) { return (b.vM * b.ppht) - (a.vM * a.ppht); }
    ['casse', 'front', 'rupt', 'mitm', 'froid'].forEach(function (k) { L[k].sort(parCouverture); });
    ['desequilibre', 'concentre'].forEach(function (k) { L[k].sort(parValeur); });
    _L = L; _lIdx = idx; _lAnsm = C.ansmRef(); _lMitm = C.mitmRef(); _lEp = EP;
    return L;
  }

  /* ── Zone d'une CELLULE de site (pas de la référence) ──
     Un site sans ligne pour ce produit est « non communiqué », pas à zéro. */
  function zoneCell(x) {
    var M = V2.approM;
    if (x.st == null) return 'nc';
    if (x.st <= 0) return 'vide';
    if (x.cov >= 9999 || x.cov > M.DORMANT) return 'dormant';
    if (x.cov < 1) return 'sec';
    if (x.cov < M.PLANCHER) return 'hors';
    if (x.cov < M.CIBLE) return 'sous';
    return 'ok';
  }
  function jSite(x) {
    var M = V2.approM;
    if (x.st == null) return 'n.c.';   // « — » est déjà affiché au-dessus : deux tirets empilés ne disent rien
    if (x.st <= 0) return 'à sec';
    if (x.cov >= 9999) return 'dort';
    return (M.estime ? '≈ ' : '') + (x.cov >= 400 ? Math.round(x.cov / 30) + ' m' : Math.round(x.cov) + ' j');
  }

  function eur(v) { return V2.fmtEur ? V2.fmtEur(v) : String(Math.round(v || 0)); }

  /* ═══ LA GRILLE ═══════════════════════════════════════════════════════════ */
  function corpsHtml() {
    var C = V2.approCtx, M = V2.approM, L = listes()[_vue] || [], arb = arbTous();
    var EP = window.ETAB_PRICES;
    if (!L.length) {
      return '<tr><td class="g5-empty" colspan="9">Aucune référence dans cette vue. Ce n’est pas un écran vide : ' +
        'rien ne relève de cette décision aujourd’hui.</td></tr>';
    }
    return L.slice(0, _n).map(function (o) {
      var p = EP ? M.parSite(o.c, o.vM) : null;
      var mv = EP ? M.transferts(o.c, o.vM) : [];
      var a = arb[o.c];
      var cells = p ? p.sites.map(function (x) {
        var z = zoneCell(x);
        return '<td><span class="g5-cell z-' + z + '"><b>' + (x.st == null ? '—' : C.fmt(x.st)) + '</b>' +
          '<span' + (M.estime && x.st > 0 && x.cov < 9999 ? ' class="est" title="couverture estimée : la demande est supposée répartie à parts égales entre les sept sites"' : '') +
          '>' + jSite(x) + '</span></span></td>';
      }).join('') : '<td colspan="7" class="g5-wait">chargement du stock des sept sites…</td>';
      var mvh = mv.length ? '<div class="g5-mv">' + mv.slice(0, 2).map(function (m) {
        return '<i>' + m.de + ' → ' + m.vers + ' · ' + C.fmt(m.q) + ' u</i>';
      }).join('') + (mv.length > 2 ? '<i class="plus">+' + (mv.length - 2) + '</i>' : '') + '</div>' : '';
      // libellé court sur la LIGNE (la colonne est étroite, la mention y était tronquée) ;
      // la fiche, elle, écrit la phrase entière et dit ce que ça empêche de faire.
      var lab = C.laboConnu(o.c) ? C.esc(C.labo(o.c)) : '<u class="g5-nolab">sans laboratoire</u>';
      return '<tr role="button" tabindex="0" data-cip="' + C.esc(o.c) + '" aria-selected="' + (o.c === _cip) + '">' +
        '<td class="ref" title="' + C.esc(C.cap(o.d)) + '"><div class="d">' +
          (a ? '<span class="fait" style="color:' + ACTES[a.a].c + '" title="' + ACTES[a.a].v + ' le ' + C.fdate(a.d) + '">✓</span>' : '') +
          C.esc(C.cap(o.d)) + '</div>' +
        '<div class="c">CIP ' + C.esc(o.c) + ' · ' + lab + '</div>' + mvh + '</td>' + cells +
        '<td class="res"><b>' + C.fmt(o.st) + '</b><span>' + M.jours(o.cov) + '</span></td></tr>';
    }).join('');
  }

  function noteHtml() {
    var C = V2.approCtx, M = V2.approM;
    var v = vues().filter(function (x) { return x.k === _vue; })[0], L = listes()[_vue] || [];
    var EP = window.ETAB_PRICES;
    var dates = '';
    if (EP && EP.etabs) {
      var SD = EP.siteDates || {}, parDate = {}, ordre = [];
      EP.etabs.forEach(function (e) { var d = SD[e.code]; if (!d) return; if (!parDate[d]) { parDate[d] = []; ordre.push(d); } parDate[d].push(e.code); });
      ordre.sort();
      if (ordre.length) dates = ' Stock relevé ' + ordre.map(function (d) { return 'le ' + C.fdate(d) + ' (' + parDate[d].join(', ') + ')'; }).join(' · ') + '.';
    }
    return '<b>' + C.esc(v.t) + '.</b> ' + v.s + ' — ' + C.fmt(L.length) + ' référence' + (L.length > 1 ? 's' : '') +
      ' concernée' + (L.length > 1 ? 's' : '') + ', les ' + Math.min(_n, L.length) + ' premières affichées.' +
      '<br><br><b>Ce que veut dire « ≈ » dans la grille.</b> Nous n’avons pas les ventes par établissement. ' +
      'La demande est donc supposée répartie à parts égales entre les sept sites, et la couverture par site ' +
      'en découle : c’est un ordre de grandeur, pas une mesure. Le stock, lui, est mesuré. C’est la donnée ' +
      'n° 1 à brancher : elle rendrait cet écran exact.' +
      '<br><br>Le stock par site vient de <code>etab-prices-data.js</code>, la vitesse de vente est celle du ' +
      'réseau entier sur les mois complets.' + dates +
      ' Un site sans ligne pour un produit est <b>non communiqué</b>, pas à zéro : il n’est ni donneur ni receveur. ' +
      'Seules les références vendues au moins ' + C.MINVEL + ' unités par mois sont comptées.';
  }

  /* ═══ LA FICHE ════════════════════════════════════════════════════════════ */
  function ficheHtml() {
    var C = V2.approCtx, M = V2.approM;
    if (!_cip) {
      return '<div class="g5-vide">Cliquez une ligne de la grille : sa fiche s’ouvre ici, sans rechargement.</div>';
    }
    var o = C.idx()[String(_cip)];
    if (!o) return '<div class="g5-vide">Référence introuvable dans l’index du jour.</div>';
    var EP = window.ETAB_PRICES;
    var z = M.zone(o), V = M.VERDICT[z] || M.VERDICT.ok;
    var q = o.qcmd, cible = cibleDe(o), vj = o.vM / 30;
    var p = EP ? M.parSite(o.c, o.vM) : null, mv = EP ? M.transferts(o.c, o.vM) : [];
    var conc = EP ? M.concentre(o.c, o.vM) : null;
    var labOk = C.laboConnu(o.c), a = arbDe(o.c);
    var acc = { sec: '#C0561A', hors: '#9A5B12', sous: 'var(--ip-blue)', ok: '#0F7A52', dormant: '#523A9E', inconnu: 'var(--muted)' }[z] || 'var(--ip-blue)';
    var stAnsm = C.ansmStatut(o.c), it = C.ansmItem(o.c);

    var tags = '<span class="g5-b z-' + z + '">' + M.LIB[z] + '</span>' +
      (stAnsm ? '<span class="g5-b r">ANSM · ' + C.esc(stAnsm) + '</span>' : '') +
      (C.isMitm(o.c) ? '<span class="g5-b a">MITM</span>' : '') +
      (C.froid(o.c) ? '<span class="g5-b f">chaîne du froid 2-8 °C</span>' : '') +
      '<span class="g5-b">classe ' + (o.abc || 'C') + '</span>';

    /* ── Où est le stock : les sept sites, avec la marque d'estimation ── */
    var repart = p ? p.sites.map(function (x) {
      var w = (x.st != null && p.tot > 0) ? Math.max(2, x.st / p.tot * 100) : 0;
      var z2 = zoneCell(x);
      var nv = (x.st === 0 && C.aVendu(o.c, x.site) === false) ? '<u>jamais vendu ici</u>' : '';
      return '<div class="l"><span class="s">' + x.site + '</span>' +
        '<span class="j z-' + z2 + '"><i style="width:' + w.toFixed(1) + '%"></i></span>' +
        '<span class="n">' + (x.st == null ? '—' : C.fmt(x.st)) +
        '<em class="' + (M.estime && x.st > 0 && x.cov < 9999 ? 'est' : '') + '">' +
        (x.st == null ? 'non communiqué' : jSite(x)) + '</em>' + nv + '</span></div>';
    }).join('') : '<div class="g5-wait">chargement du stock des sept sites…</div>';

    /* ── Les ventes du réseau, mois par mois ── */
    var MOIS = (window.WML_MOIS || []).map(function (ym) { return +String(ym).split('-')[1]; });
    if (!MOIS.length) MOIS = [1, 2, 3, 4, 5, 6];
    var MSA = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var dpm = C.dpm()[String(o.c)] || {};
    var serie = MOIS.map(function (m) { return dpm[m] || 0; });
    var mx = Math.max.apply(null, serie.concat([1]));
    var courbe = '<div class="g5-courbe">' + serie.map(function (v, k) {
      return '<div title="' + C.fmt(v) + ' unités en ' + MSA[MOIS[k] - 1] + '"><i style="height:' +
        Math.max(2, Math.round(v / mx * 88)) + 'px' + (k === serie.length - 1 ? ';background:var(--c-amber,#C98A1A)' : '') + '"></i></div>';
    }).join('') + '</div><div class="g5-moislab">' + MOIS.map(function (m) { return '<span>' + MSA[m - 1] + '</span>'; }).join('') + '</div>';

    /* ── D'où sort la quantité : le calcul écrit en toutes lettres ── */
    function ligne(t, n, e) {
      return '<div class="l calc"><span>' + t + '</span><span class="n">' + n + '<em>' + e + '</em></span></div>';
    }
    var un = function (x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); };
    var calc = ligne('Cible de couverture', cible + ' j',
        cible === M.CIBLE_TENSION ? 'relevée : tension déclarée' : 'réglage interne') +
      ligne('Demande journalière réseau', un(vj) + ' u/j', C.fmt(Math.round(o.vM)) + ' par mois ÷ 30') +
      (o.sais && Math.abs(o.sais - 1) > 0.01
        ? ligne('Coefficient de saison', '× ' + un(o.sais), 'indice du mois qui vient (Medic’AM)') : '') +
      ligne('Stock cible', C.fmt(Math.round(cible * vj * (o.sais || 1))) + ' u',
        cible + ' j × ' + un(vj) + ' u/j' + (o.sais && Math.abs(o.sais - 1) > 0.01 ? ' × ' + un(o.sais) : '')) +
      ligne('Stock détenu', '− ' + C.fmt(o.st) + ' u', 'dernier inventaire des sept sites') +
      '<div class="l calc tot"><span>À commander</span><span class="n">' + C.fmt(q) + ' u' +
        '<em>' + eur(q * (o.ppht || 0)) + ' au prix de ' + eur(o.ppht || 0) + '</em></span></div>';

    /* ── Les gestes ── */
    var gestes;
    if (a) {
      gestes = '<div class="g5-deja" style="--c:' + ACTES[a.a].c + '">Ligne <b>' + ACTES[a.a].v + '</b> le ' + C.fdate(a.d) +
        '.<button class="g5-btn" data-act="undo" data-cip="' + C.esc(o.c) + '">Revenir sur cet arbitrage</button></div>';
    } else {
      gestes = '<div class="g5-gestes">' +
        (mv.length ? '<button class="g5-btn" data-act="tr" data-cip="' + C.esc(o.c) + '">Transférer ' + C.fmt(mv[0].q) + ' u · ' + mv[0].de + ' → ' + mv[0].vers + '</button>' : '') +
        (q > 0 && labOk ? '<button class="g5-btn pri" data-act="cmd" data-cip="' + C.esc(o.c) + '">Commander ' + C.fmt(q) + ' u · ' + eur(q * (o.ppht || 0)) + '</button>' : '') +
        '<button class="g5-btn" data-act="x" data-cip="' + C.esc(o.c) + '">Classer sans commande</button></div>' +
        (q > 0 && !labOk ? '<div class="g5-alerte"><b>Commander est impossible depuis cet écran : le laboratoire de cette référence n’est pas identifié.</b> ' +
          'Un grossiste commande par fournisseur, pas par produit. ' + C.fmt(q) + ' unités seraient à commander (' + eur(q * (o.ppht || 0)) +
          '), mais il n’y a personne à qui les commander tant que <code>labo-cip.json</code> ne couvre pas ce CIP. ' +
          '264 références du catalogue (7,6 %) sont dans ce cas.</div>' : '');
    }

    return '<p class="g5-labo">' + (labOk ? C.esc(C.labo(o.c)) : '<u class="g5-nolab">laboratoire non identifié</u>') +
        ' · CIP ' + C.esc(o.c) + '</p>' +
      '<h4 class="g5-nom">' + C.esc(C.cap(o.d)) + '</h4>' +
      '<div class="g5-tags">' + tags + '</div>' +
      '<p class="g5-geste" style="color:' + acc + '">' + V.g + '</p><p class="g5-pour">' + V.p + '</p>' +
      '<div class="g5-chif">' +
        '<div><b>' + M.jours(o.cov) + '</b><span>couverture réseau</span></div>' +
        '<div><b>' + C.fmt(o.st) + '</b><span>unités en stock</span></div>' +
        '<div><b>' + C.fmt(Math.round(o.vM)) + '</b><span>vendues par mois</span></div>' +
        '<div><b>' + eur(q * (o.ppht || 0)) + '</b><span>montant à engager</span></div>' +
      '</div>' + gestes +
      '<div class="g5-bloc"><p class="g5-t">Où est le stock</p><div class="g5-repart">' + repart + '</div>' +
        (mv.length
          ? '<p class="g5-ok">Transferts internes possibles : ' + mv.map(function (m) { return m.de + ' → ' + m.vers + ' (' + C.fmt(m.q) + ' u)'; }).join(' · ') +
            '. Déplacer ne sort pas un euro de marchandise.</p>'
          : '<p class="g5-sub">Aucun transfert interne ne réglerait la ligne : aucun site ne dort au-dessus de ' + M.DORMANT + ' jours pendant qu’un autre passe sous les ' + M.PLANCHER + ' jours légaux.</p>') +
        (conc ? '<p class="g5-sub"><b>' + Math.round(conc.part * 100) + ' % du stock réseau est sur ' + conc.site + '</b> : les six autres sites ne peuvent pas servir.</p>' : '') +
      '</div>' +
      '<div class="g5-bloc"><p class="g5-t">Ce que le réseau a vendu</p>' + courbe +
        '<p class="g5-sub">Le dernier mois est en ambre : il est souvent partiel, toutes les officines ' +
        'n’ayant pas encore remonté leurs ventes. Ce n’est pas une chute.</p></div>' +
      '<div class="g5-bloc"><p class="g5-t">D’où sort la quantité</p><div class="g5-repart">' + calc + '</div>' +
        '<p class="g5-sub">Le résultat n’est pas arrondi au conditionnement du laboratoire : le PCB/SPCB n’est pas encore branché.' +
        (it && it.retour && it.retour.iso ? ' Retour annoncé par le laboratoire : ' + C.fdate(it.retour.iso) + '.' : '') + '</p></div>';
  }

  /* ═══ LA BARRE DU BAS : ce qui a été arbitré ══════════════════════════════ */
  function barreHtml() {
    var C = V2.approCtx, idx = C.idx(), arb = arbTous(), ks = Object.keys(arb);
    if (!ks.length) {
      return '<span class="t">Aucune ligne arbitrée sur les ' + ARB_JOURS + ' derniers jours. ' +
        'Cliquez une ligne de la grille : sa fiche s’ouvre aussitôt, et rien ne se recharge.</span>';
    }
    var e = 0, nt = 0, nc = 0, nx = 0;
    ks.forEach(function (c) {
      var a = arb[c];
      if (a.a === 'tr') nt++; else if (a.a === 'cmd') { nc++; e += a.e || 0; } else nx++;
    });
    return '<span class="t"><b>' + C.fmt(ks.length) + '</b> ligne' + (ks.length > 1 ? 's' : '') + ' arbitrée' + (ks.length > 1 ? 's' : '') +
      ' · <b>' + C.fmt(nc) + '</b> commande' + (nc > 1 ? 's' : '') + ' pour <b>' + eur(e) + '</b> à engager' +
      ' · <b>' + C.fmt(nt) + '</b> réglée' + (nt > 1 ? 's' : '') + ' par transfert interne, sans commande' +
      (nx ? ' · ' + C.fmt(nx) + ' classée' + (nx > 1 ? 's' : '') + ' sans commande' : '') + '</span>' +
      (_hist.length ? '<button class="g5-btn" data-act="undolast">Annuler le dernier arbitrage</button>' : '');
  }

  /* ═══ RENDU PARTIEL — c'est tout l'intérêt de l'écran : rien ne se recharge ═══ */
  function q1(id) { return document.getElementById(id); }
  function peindreFiche() {
    var f = q1('g5-fiche'); if (f) f.innerHTML = ficheHtml();
    var corps = q1('g5-corps');
    if (corps) {
      var trs = corps.querySelectorAll('tr[data-cip]');
      for (var i = 0; i < trs.length; i++) trs[i].setAttribute('aria-selected', trs[i].getAttribute('data-cip') === String(_cip) ? 'true' : 'false');
    }
  }
  function peindreGrille() {
    var c = q1('g5-corps'); if (c) c.innerHTML = corpsHtml();
    var n = q1('g5-note'); if (n) n.innerHTML = noteHtml();
    var b = q1('g5-plus');
    if (b) {
      var L = listes()[_vue] || [];
      b.innerHTML = L.length > _n ? '<button class="g5-more" data-act="plus">Voir ' + Math.min(22, L.length - _n) +
        ' de plus (' + V2.approCtx.fmt(L.length - _n) + ' restantes)</button>' : '';
    }
    var s = q1('g5-seg');
    if (s) {
      var bs = s.querySelectorAll('button[data-k]');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i].getAttribute('data-k') === _vue ? 'true' : 'false');
    }
  }
  function peindreBarre() { var b = q1('g5-barre'); if (b) b.innerHTML = barreHtml(); }

  function choisir(cip) {
    if (!cip) return;
    _cip = String(cip);
    peindreFiche();
    /* Sous 1060 px la fiche passe SOUS la grille : sans ça, cliquer la 18ᵉ ligne ouvre une
       fiche qu'on ne voit pas. Sur deux colonnes, on ne bouge rien. */
    try {
      if (window.matchMedia('(max-width:1060px)').matches) {
        var doux = !window.matchMedia('(prefers-reduced-motion:reduce)').matches;
        var f = q1('g5-fiche'); if (f) f.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
      }
    } catch (e) {}
  }

  function acter(cip, act) {
    var C = V2.approCtx, o = C.idx()[String(cip)]; if (!o) return;
    var reg = arbLire(), d = jour();
    if (act === 'undo') {
      delete reg[String(cip)];
      arbEcrire(reg);
      if (C.oublierCommande) C.oublierCommande([cip]);
      _hist = _hist.filter(function (x) { return x !== String(cip); });
    } else {
      reg[String(cip)] = { a: act, d: d, e: act === 'cmd' ? o.qcmd * (o.ppht || 0) : 0 };
      arbEcrire(reg);
      /* Une commande ferme s'inscrit AUSSI dans le carnet existant : c'est lui que lit le
         reste de l'app pour ne pas reproposer la ligne demain. */
      if (act === 'cmd' && C.marquerCommande) C.marquerCommande([cip], d);
      _hist = _hist.filter(function (x) { return x !== String(cip); });
      _hist.push(String(cip));
    }
    /* On ne réécrit que ce qui change : la coche de la ligne, la fiche, la barre. */
    var tr = document.querySelector('#g5-corps tr[data-cip="' + String(cip).replace(/"/g, '') + '"]');
    if (tr) {
      var d1 = tr.querySelector('.ref .d'), vieux = d1 && d1.querySelector('.fait');
      if (vieux) d1.removeChild(vieux);
      var a = arbDe(cip);
      if (a && d1) d1.insertAdjacentHTML('afterbegin', '<span class="fait" style="color:' + ACTES[a.a].c +
        '" title="' + ACTES[a.a].v + ' le ' + C.fdate(a.d) + '">✓</span>');
    }
    peindreFiche();
    peindreBarre();
  }

  /* Écouteur délégué posé UNE fois sur le document : il survit à tous les V2.render()
     du reste de l'app, alors qu'un écouteur posé sur le conteneur serait effacé. */
  function poser() {
    if (_pose) return; _pose = 1;
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act],[data-k],#g5-corps tr[data-cip]') : null;
      if (!b || !document.getElementById('g5-corps')) return;
      var act = b.getAttribute('data-act');
      if (act === 'plus') { _n += 22; peindreGrille(); peindreFiche(); return; }
      if (act === 'undolast') { var last = _hist[_hist.length - 1]; if (last) { _cip = last; acter(last, 'undo'); } return; }
      if (act) { acter(b.getAttribute('data-cip'), act); return; }
      var k = b.getAttribute('data-k');
      if (k) { _vue = k; _n = 22; var L = listes()[k] || []; _cip = L.length ? L[0].c : null; peindreGrille(); peindreFiche(); return; }
      if (b.tagName === 'TR') choisir(b.getAttribute('data-cip'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!document.getElementById('g5-corps')) return;
      var tr = e.target && e.target.closest ? e.target.closest('#g5-corps tr[data-cip]') : null;
      if (!tr) return;
      e.preventDefault(); choisir(tr.getAttribute('data-cip'));
    });
  }

  /* ═══ LA CARTE ENTIÈRE, rendue par v2-appro.js dans STOCK & SITES ═════════ */
  function card() {
    var C = V2.approCtx, M = V2.approM;
    if (!C || !M) return '';
    ensureCss(); C.ensureLabo(); poser();
    var EP = window.ETAB_PRICES;
    var head = '<div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">▤</div><div>' +
      '<h3>La grille et la fiche — arbitrer une référence sans quitter la ligne</h3>' +
      '<div class="ap-sub">le stock des sept sites en face de chaque référence ; on clique, on tranche, rien ne se recharge</div></div></div>';
    if (!window.WML_SALES || !window.STOCK_IP) {
      return '<div class="v2-card ap-card g5-card">' + head +
        '<div class="g5-body"><div class="g5-wait">chargement des ventes réseau et du stock…</div></div></div>';
    }
    var L = listes();
    if (!_cip || !C.idx()[String(_cip)]) { var d = L[_vue] || []; _cip = d.length ? d[0].c : null; }
    var seg = '<div class="g5-seg" id="g5-seg" role="tablist">' + vues().map(function (v) {
      return '<button role="tab" data-k="' + v.k + '" aria-selected="' + (v.k === _vue) + '">' + v.on +
        ' <span>' + C.fmt((L[v.k] || []).length) + '</span></button>';
    }).join('') + '</div>';
    var ths = EP && EP.etabs ? EP.etabs.map(function (e) { return '<th>' + e.code + '</th>'; }).join('')
      : '<th colspan="7">sept sites</th>';
    var Lv = L[_vue] || [];
    return '<div class="v2-card ap-card g5-card">' + head + '<div class="g5-body">' +
      /* correctif 3 : le lede tient sur une ligne — le détail est dans la note, sous la grille. */
      '<p class="g5-lede">Une ligne = une référence, sept colonnes = les sept sites. On clique, la fiche ' +
        'de la ligne s’ouvre aussitôt — et rien ne se recharge.</p>' + seg +
      '<div class="g5-duo">' +
        '<div class="g5-gwrap"><table class="g5-grille"><thead><tr><th class="ref">Référence</th>' + ths +
          '<th class="res">Réseau</th></tr></thead><tbody id="g5-corps">' + corpsHtml() + '</tbody></table></div>' +
        '<div class="g5-fiche" id="g5-fiche">' + ficheHtml() + '</div>' +
      '</div>' +
      '<div id="g5-plus">' + (Lv.length > _n ? '<button class="g5-more" data-act="plus">Voir ' +
        Math.min(22, Lv.length - _n) + ' de plus (' + C.fmt(Lv.length - _n) + ' restantes)</button>' : '') + '</div>' +
      '<div class="g5-barre" id="g5-barre">' + barreHtml() + '</div>' +
      '<div class="ap-foot" id="g5-note" style="margin-top:14px">' + noteHtml() + '</div>' +
      '</div></div>';
  }

  var _css = 0;
  function ensureCss() {
    if (_css || document.getElementById('g5-css')) return; _css = 1;
    var st = document.createElement('style'); st.id = 'g5-css';
    st.textContent =
      '.g5-body{padding:13px 18px 18px}' +
      '.g5-lede{margin:0 0 10px;font-size:13px;color:var(--muted);line-height:1.5;max-width:96ch;font-weight:500}' +
      /* onglets */
      '.g5-seg{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 10px}' +
      '.g5-seg button{min-height:36px;padding:0 13px;border-radius:9px;border:1px solid var(--line);' +
        'background:var(--card);font-size:12.5px;font-weight:800;color:var(--muted);cursor:pointer}' +
      '.g5-seg button span{font-family:var(--mono);opacity:.75;margin-left:3px}' +
      '.g5-seg button[aria-selected="true"]{border-color:#A8D4E0;color:#0E6F80;background:#EDF8FB}' +
      /* deux colonnes */
      '.g5-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,344px);gap:12px;align-items:start}' +
      '.g5-gwrap{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--card)}' +
      /* `table-layout:fixed` répartissait 8 colonnes de 48,6 px arrondies à 49 : 3 px de trop,
         et la colonne « Réseau » sortait du cadre. En `auto`, les largeurs mini suffisent. */
      '.g5-grille{width:100%;border-collapse:collapse;min-width:540px}' +
      /* ⚠️ un th sticky dans un conteneur overflow-x FLOTTE sous WebKit : on le laisse statique */
      '.g5-grille th{position:static;background:var(--card-2,#F6F8FB);font-family:var(--mono);font-size:12px;' +
        'letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:center;' +
        'padding:10px 3px;border-bottom:1px solid var(--line)}' +
      '.g5-grille th.ref{text-align:left;width:42%;min-width:150px;padding-left:12px}' +
      '.g5-grille th.res{text-align:right;padding-right:12px}' +
      '.g5-grille td{padding:9px 3px;border-bottom:1px solid var(--line);font-size:13px;vertical-align:middle}' +
      '.g5-grille tbody tr{cursor:pointer}' +
      '.g5-grille tbody tr:hover{background:var(--card-2,#F6F8FB)}' +
      '.g5-grille tbody tr[aria-selected="true"]{background:#EDF4FD}' +
      '.g5-grille tbody tr[aria-selected="true"] td:first-child{box-shadow:inset 3px 0 0 var(--ip-blue,#0050E6)}' +
      '.g5-grille td.ref{padding-left:12px;width:42%;min-width:150px}' +
      /* ⚠️ `display:block` ÉCRASE `-webkit-line-clamp` : le clamp exige `-webkit-box`.
         Le nom entier reste lisible dans la fiche et dans l'infobulle de la ligne. */
      '.g5-grille td.ref .d{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;'  +
        'overflow:hidden;font-size:13.5px;font-weight:800;line-height:1.3;color:var(--ip-ink)}' +
      '.g5-grille td.ref .c{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;' +
        'overflow:hidden;font-family:var(--mono);font-size:12px;color:var(--muted);margin-top:2px}' +
      '.g5-grille td.ref .fait{display:inline-block;margin-right:5px;font-weight:800}' +
      '.g5-nolab{text-decoration:none;color:#9A5B12;font-weight:700}' +
      '.g5-grille td.res{text-align:right;padding-right:12px;font-family:var(--mono)}' +
      '.g5-grille td.res b{font-size:13px;font-weight:800}' +
      '.g5-grille td.res span{display:block;font-size:12px;color:var(--muted);font-weight:500}' +
      '.g5-empty,.g5-wait{padding:18px 14px;color:var(--muted);font-size:13px;font-weight:500;line-height:1.5}' +
      /* cellule de site */
      '.g5-cell{display:block;border-radius:8px;padding:6px 2px 5px;text-align:center;min-width:40px;border:1px solid var(--line)}' +
      '.g5-cell b{display:block;font-family:var(--mono);font-size:12.5px;font-weight:800;line-height:1}' +
      /* sans `nowrap`, « à sec » et « ≈ 0 j » repassaient à la ligne dans une cellule étroite
         et la hauteur des lignes doublait : vu à l'œil le 27/09/2026. */
      '.g5-cell span{display:block;margin-top:2px;font-family:var(--mono);font-size:11.5px;white-space:nowrap}' +
      '.g5-cell span.est{opacity:.85}' +
      '.z-sec{background:#FDECEF;border-color:#F6C9D2;color:#B02A37}' +
      '.z-hors{background:#FDF1E3;border-color:#F3DCBC;color:#9A5B12}' +
      '.z-sous{background:#EDF4FD;border-color:#CBDCFB;color:#0043BF}' +
      '.z-ok{background:#E6F6EF;border-color:#BFE6D5;color:#0F7A52}' +
      '.z-dormant{background:#F1EDFB;border-color:#D9CEF3;color:#523A9E}' +
      '.z-vide{background:var(--card-2,#F6F8FB);color:var(--muted)}' +
      '.z-nc{background:repeating-linear-gradient(45deg,#E4E8EF,#E4E8EF 3px,#F2F5F9 3px,#F2F5F9 6px);color:var(--muted)}' +
      '.z-inconnu{background:var(--card-2,#F6F8FB);border-color:var(--line);color:var(--muted)}' +
      '.g5-mv{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}' +
      '.g5-mv i{font-style:normal;padding:2px 8px;border-radius:999px;background:#E6F6EF;color:#0F7A52;' +
        'font-size:12px;font-weight:700;font-family:var(--mono)}' +
      '.g5-mv i.plus{background:var(--card-2,#F6F8FB);color:var(--muted)}' +
      /* fiche */
      '.g5-fiche{border:1px solid var(--line);border-left:4px solid var(--ip-blue,#0050E6);border-radius:13px;' +
        'background:var(--card);padding:16px 17px}' +
      '.g5-vide{color:var(--muted);font-size:13px;font-weight:500;line-height:1.55}' +
      '.g5-labo{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:800}' +
      '.g5-nom{margin:5px 0 0;font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);line-height:1.25}' +
      '.g5-tags{margin-top:8px}' +
      '.g5-b{display:inline-block;margin:5px 5px 0 0;padding:2px 8px;border-radius:6px;font-family:var(--mono);' +
        'font-size:12px;font-weight:700;border:1px solid var(--line);color:var(--muted);background:var(--card-2,#F6F8FB)}' +
      '.g5-b.r{border-color:#F3B0A0;color:#C0561A;background:#FFF1EE}' +
      '.g5-b.a{border-color:#F0C98A;color:#9A5B12;background:#FFF8EC}' +
      '.g5-b.f{border-color:#A8D4E0;color:#0E6F80;background:#EDF8FB}' +
      '.g5-geste{margin:12px 0 0;font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.15}' +
      '.g5-pour{margin:6px 0 0;font-size:12.5px;color:var(--muted);line-height:1.5;font-weight:500}' +
      '.g5-chif{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;padding-top:13px;border-top:1px solid var(--line)}' +
      '.g5-chif b{display:block;font-family:var(--mono);font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--ip-ink)}' +
      '.g5-chif span{display:block;margin-top:3px;font-size:12px;color:var(--muted);font-weight:500}' +
      '.g5-gestes{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}' +
      '.g5-btn{min-height:44px;padding:0 15px;border-radius:10px;border:1px solid var(--line);background:var(--card);' +
        'font-size:13px;font-weight:800;color:var(--ip-ink);cursor:pointer;flex:1 1 auto}' +
      '.g5-btn:hover{background:var(--card-2,#F6F8FB)}' +
      '.g5-btn.pri{border-color:#CBDCFB;background:linear-gradient(180deg,#EDF4FD,#DCE9FC);color:#0043BF}' +
      '.g5-deja{margin-top:14px;padding:13px 15px;border:1px solid var(--line);border-left:3px solid var(--c);' +
        'border-radius:11px;background:var(--card-2,#F6F8FB);font-size:13px;color:var(--muted);font-weight:500;line-height:1.5}' +
      '.g5-deja b{color:var(--c);font-weight:800}' +
      '.g5-deja .g5-btn{margin-top:10px;width:100%}' +
      '.g5-alerte{margin-top:10px;padding:12px 14px;border:1px solid #F0C98A;border-radius:11px;background:#FFFAF1;' +
        'font-size:12.5px;color:#7A4708;line-height:1.5;font-weight:500}' +
      '.g5-alerte b{font-weight:800}' +
      '.g5-bloc{margin-top:16px;padding-top:13px;border-top:1px solid var(--line)}' +
      '.g5-t{margin:0 0 9px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:800}' +
      '.g5-sub{margin:9px 0 0;font-size:12px;color:var(--muted);line-height:1.5;font-weight:500}' +
      '.g5-ok{margin:9px 0 0;font-size:12px;color:#0F7A52;line-height:1.5;font-weight:700}' +
      '.g5-repart .l{display:grid;grid-template-columns:40px minmax(0,1fr) 92px;gap:10px;align-items:center;' +
        'padding:6px 0;border-bottom:1px solid var(--line)}' +
      '.g5-repart .l:last-child{border-bottom:0}' +
      '.g5-repart .l.calc{grid-template-columns:minmax(0,1fr) auto}' +
      '.g5-repart .l.tot{border-top:1px solid var(--line);border-bottom:0;padding-top:9px;font-weight:800}' +
      '.g5-repart .s{font-family:var(--mono);font-size:12px;font-weight:800;color:#0E6F80;letter-spacing:.06em}' +
      '.g5-repart .j{display:block;height:7px;border-radius:4px;background:#E9EDF3;overflow:hidden}' +
      '.g5-repart .j i{display:block;height:100%;border-radius:4px;background:#0E7C86}' +
      '.g5-repart .j.z-sec i,.g5-repart .j.z-hors i{background:#D5573B}' +
      '.g5-repart .j.z-dormant i{background:#1E9E6A}' +
      '.g5-repart .j.z-vide i,.g5-repart .j.z-nc i{background:#C9D2DE}' +
      '.g5-repart .n{text-align:right;font-family:var(--mono);font-size:12.5px;font-weight:800;color:var(--ip-ink)}' +
      '.g5-repart .n em{display:block;font-style:normal;font-size:12px;color:var(--muted);font-weight:500}' +
      '.g5-repart .n em.est::before{content:"";}' +
      '.g5-repart .n u{display:block;text-decoration:none;font-size:12px;color:#9A5B12;font-weight:700}' +
      '.g5-courbe{display:flex;align-items:flex-end;gap:4px;height:88px}' +
      '.g5-courbe div{flex:1;min-width:0;background:var(--card-2,#F6F8FB);border-radius:4px 4px 0 0;position:relative}' +
      '.g5-courbe div i{position:absolute;left:0;right:0;bottom:0;display:block;border-radius:4px 4px 0 0;background:var(--ip-blue,#0050E6)}' +
      '.g5-moislab{display:flex;gap:4px;margin-top:5px}' +
      '.g5-moislab span{flex:1;text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)}' +
      /* barre du bas + « voir plus » */
      '.g5-more{display:block;width:100%;margin-top:12px;min-height:44px;padding:12px;border:1px solid var(--line);' +
        'border-radius:10px;background:var(--card-2,#F6F8FB);font-size:13px;font-weight:800;color:var(--ip-ink);cursor:pointer}' +
      '.g5-barre{margin-top:12px;padding:12px 15px;border:1px solid var(--line);border-radius:11px;' +
        'background:var(--card-2,#F6F8FB);display:flex;align-items:center;gap:12px;flex-wrap:wrap}' +
      '.g5-barre .t{font-size:12.5px;color:var(--muted);line-height:1.45;font-weight:500;flex:1 1 320px}' +
      '.g5-barre .t b{color:var(--ip-ink);font-family:var(--mono);font-weight:800}' +
      '.g5-barre .g5-btn{flex:0 0 auto}' +
      /* les requêtes média viennent APRÈS les règles qu'elles corrigent : à spécificité
         égale, la dernière gagne — piège payé le 27/09/2026 */
      '@media(max-width:1060px){.g5-duo{grid-template-columns:minmax(0,1fr)}}' +
      '@media(max-width:860px){.g5-chif{grid-template-columns:1fr}.g5-btn{flex:1 1 100%}}';
    document.head.appendChild(st);
  }

  V2.approGrille = { card: card, vue: function (k) { if (k) _vue = k; return _vue; },
                     cip: function (c) { if (c) { _cip = String(c); } return _cip; } };
})();
