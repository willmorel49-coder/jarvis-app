/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier 4 — PILOTAGE (tableau de bord commercial)
   À partir de V2.sales : CA net HT, marge MDL, familles, top pharma.
   Graphes en CSS/SVG pur — aucune dépendance externe. Zéro emoji.
   Mode OPSO : section groupement (taux activation, périmètres, top produits).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};

  // ── State période (local module) ──────────────
  var PERIOD = 'current';            // 'current' | '3m' | 'year'
  var OUVERTS = {};                  // blocs dépliables laissés ouverts par Will

  // ── Couleurs familles → tokens de séries (spec signature) ─────
  // froid->cyan · biosim->violet cat · nr->ambre · princeps->bleu fiche · génériques->muted
  var FAM = [
    { key: 'froid',      label: 'Froid',         color: 'var(--c-froid)' },
    { key: 'generiques', label: 'Génériques',    color: 'var(--muted)' },
    { key: 'biosim',     label: 'Biosimilaires', color: 'var(--c-cat)' },
    { key: 'nr',         label: 'NR',            color: 'var(--c-amber)' },
    { key: 'princeps',   label: 'Princeps',      color: 'var(--c-fiche)' },
  ];

  // ── Tranches de prix (prix net grossiste / achat unitaire) ────
  // petits->ok · intermédiaires->info · chers->ambre · très chers->bad-d (critique)
  var TIERS = [
    { label: '0 – 4,33 €',     sub: 'petits prix',     color: 'var(--ok)' },
    { label: '4,33 – 468 €',   sub: 'intermédiaires',  color: 'var(--info)' },
    { label: '468 – 2 000 €',  sub: 'chers',           color: 'var(--c-amber)' },
    { label: '> 2 000 €',      sub: 'très chers',      color: 'var(--bad-d)' },
  ];
  function priceTier(pu) {
    pu = +pu || 0;
    if (pu < 4.33) return 0;
    if (pu < 468) return 1;
    if (pu < 2000) return 2;
    return 3;
  }

  // ── Index produit cip13 → {has_ameli, is_froid, artnature, isNR} ──
  var _idx = null, _idxStamp = null;
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, ''); }
  function productIndex() {
    var B = window.BENCHMARK || [];
    var S = window.SAGITTA_SHORTLIST || [];
    var stamp = B.length + 'x' + S.length;
    if (_idx && _idxStamp === stamp) return _idx;
    var m = {};
    B.forEach(function (b) {
      var c = normCip(b.cip13); if (!c) return;
      m[c] = {
        has_ameli: !!b.has_ameli,
        is_froid: !!b.is_froid,
        artnature: b.artnature || '',
      };
    });
    // SAGITTA = short list NR (non remboursable) : marque isNR=true
    S.forEach(function (s) {
      var c = normCip(s.cip13); if (!c) return;
      if (!m[c]) m[c] = { has_ameli: false, is_froid: false, artnature: '' };
      m[c].isNR = true;
    });
    _idx = m; _idxStamp = stamp; return m;
  }

  // famille d'une vente (priorité : froid > biosim > génériques > NR > princeps)
  function familyOf(sale, idx) {
    var info = idx[normCip(sale.artCode)] || null;
    if (info) {
      if (info.is_froid) return 'froid';
      if (info.artnature === 'biosimilaire') return 'biosim';
      if (info.artnature === 'generique' || info.artnature === 'generique_partenaire') return 'generiques';
      if (info.isNR) return 'nr';
    }
    // fallback sur artFamille texte des ventes
    var f = (sale.artFamille || '').toLowerCase();
    if (f) {
      if (/froid|frigo|réfri|refri/.test(f)) return 'froid';
      if (/biosim/.test(f)) return 'biosim';
      if (/génér|gener|\bgx\b/.test(f)) return 'generiques';
      if (/\bnr\b|non.?rembours/.test(f)) return 'nr';
    }
    return 'princeps';
  }

  // remboursable = has_ameli ET pas NR Sagitta
  function isRemboursable(sale, idx) {
    var info = idx[normCip(sale.artCode)];
    if (!info) return false;
    return info.has_ameli && !info.isNR;
  }

  // marge MDL d'une ligne de vente (0 si non remboursable)
  function mdlOf(sale, idx) {
    if (!isRemboursable(sale, idx)) return 0;
    return V2.margeMDLboite(sale.puNet) * (sale.qte || 0);
  }

  // ── Périodes ──────────────────────────────────
  // clé mois absolue (pour tri/comparaison)
  function mkey(year, month) { return year * 12 + (month - 1); }

  // détecte la liste des (year,month) présents, triés croissant
  function availableMonths(sales) {
    var seen = {};
    sales.forEach(function (s) {
      if (s.month && s.year) seen[mkey(s.year, s.month)] = { year: s.year, month: s.month };
    });
    return Object.keys(seen).map(function (k) { return seen[k]; })
      .sort(function (a, b) { return mkey(a.year, a.month) - mkey(b.year, b.month); });
  }

  var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function nomMois(k) { return MN[((k % 12) + 12) % 12] + ' ' + Math.floor(k / 12); }

  // ── QUELS MOIS SONT VRAIMENT COMPARABLES ? ──────────────────────
  // ⚠️ Mesuré le 24/08/2026 sur l'intégralité des ventes : les fichiers ne
  // s'arrêtent PAS au même mois selon le commercial. À cette date, deux
  // secteurs s'arrêtaient deux mois avant les autres, quatre un mois avant,
  // et deux allaient jusqu'au bout.
  //
  // Le total réseau s'effondre donc sur les derniers mois — non pas parce que
  // le réseau perd des ventes, mais parce que la plupart des secteurs ne sont
  // plus dans le fichier. La vue « Tous » annonçait ainsi une chute de près de
  // 40 % sur 3 mois à un réseau qui n'avait rien perdu. Un signal faux est
  // pire qu'un signal absent, parce qu'on le croit.
  //
  // ⚠️ ET LA PARADE ÉVIDENTE — « écarter le dernier mois » — EST FAUSSE AUSSI.
  // Ce dernier mois est PLEIN pour les secteurs dont le fichier va jusqu'au
  // bout : c'était même le meilleur mois de l'un d'eux. L'écarter d'office
  // leur cachait leur mois le plus récent. Un garde-fou qui supprime de la
  // vraie donnée ne vaut pas mieux que le défaut qu'il corrige.
  //
  // La règle qui marche dans les deux cas : un mois de queue n'est retenu que
  // si TOUS les secteurs du périmètre regardé y figurent. Sur un seul
  // commercial, il n'y a qu'un secteur : rien n'est écarté, il voit tout son
  // fichier. Sur le réseau, les mois amputés sortent d'eux-mêmes.
  // Un second filet, la médiane, attrape le cas restant : un fichier arrêté en
  // PLEIN mois, où le secteur est présent mais avec une poignée de lignes.
  function ancreComplete(ventes) {
    var parMois = {}, i;
    for (i = 0; i < ventes.length; i++) {
      var s = ventes[i];
      if (!s.month || !s.year) continue;
      var k = mkey(s.year, s.month);
      var o = parMois[k] || (parMois[k] = { ca: 0, sect: {} });
      o.ca += (s.mntNetHt || 0);
      o.sect[s.commercial || '—'] = 1;
    }
    var cles = Object.keys(parMois).map(Number).sort(function (a, b) { return a - b; });
    if (!cles.length) return null;

    var nbSect = {}, maxSect = 0;
    cles.forEach(function (k) {
      nbSect[k] = Object.keys(parMois[k].sect).length;
      if (nbSect[k] > maxSect) maxSect = nbSect[k];
    });

    var complets = cles.slice(), ecartes = [], raison = '';
    // 1. mois de queue auxquels il manque des secteurs
    while (complets.length > 1 && nbSect[complets[complets.length - 1]] < maxSect) {
      ecartes.push(complets.pop());
      raison = 'secteurs';
    }
    // 2. mois de queue manifestement arrêté en cours de route
    var tri = complets.map(function (k) { return parMois[k].ca; }).sort(function (a, b) { return a - b; });
    var med = tri[Math.floor(tri.length / 2)];
    while (complets.length > 1 && parMois[complets[complets.length - 1]].ca < med * 0.6) {
      ecartes.push(complets.pop());
      raison = raison || 'partiel';
    }

    var dispo = {};
    complets.forEach(function (k) { dispo[k] = 1; });
    return {
      ancre: complets[complets.length - 1],
      dispo: dispo,
      maxSect: maxSect,
      raison: raison,
      ecartes: ecartes.sort(function (a, b) { return a - b; }).map(nomMois)
    };
  }

  // La phrase qui dit ce qui a été écarté, et POURQUOI. Un mois retiré en
  // silence, c'est un écran qui a l'air de couvrir une période qu'il ne couvre pas.
  function phraseEcart(anc) {
    if (!anc || !anc.ecartes.length) return '';
    var pluriel = anc.ecartes.length > 1;
    return anc.ecartes.join(', ') + (pluriel ? ' sont écartés : ' : ' est écarté : ') +
      (anc.raison === 'secteurs'
        ? 'les ventes de tous les secteurs n\'y sont pas encore.'
        : 'le fichier de ventes s\'arrête en cours de mois.');
  }

  // renvoie {label, prevLabel, inPeriod(sale), inPrev(sale), prevComplet}
  function periodFilter(sales, mode, anc) {
    var months = availableMonths(sales);
    if (!months.length) return null;
    var lastK = anc && anc.ancre != null
      ? anc.ancre
      : mkey(months[months.length - 1].year, months[months.length - 1].month);
    var dispo = (anc && anc.dispo) || null;
    function couvert(a, b) {
      if (!dispo) return true;
      for (var k = a; k <= b; k++) { if (!dispo[k]) return false; }
      return true;
    }

    if (mode === 'current') {
      // Le dernier mois retenu du périmètre regardé.
      var idx = months.length - 1;
      while (idx > 0 && mkey(months[idx].year, months[idx].month) > lastK) idx--;
      var cur = months[idx], curK = mkey(cur.year, cur.month);
      return {
        label: cap(MN[cur.month - 1]) + ' ' + cur.year,
        prevLabel: 'mois précédent',
        prevComplet: couvert(curK - 1, curK - 1),
        inPeriod: function (s) { return mkey(s.year, s.month) === curK; },
        inPrev: function (s) { return mkey(s.year, s.month) === curK - 1; },
      };
    }
    if (mode === '3m') {
      var startK = lastK - 2, pStart = lastK - 5, pEnd = lastK - 3;
      return {
        label: '3 derniers mois',
        prevLabel: '3 mois précédents',
        // ⚠️ Le fichier ne remonte qu'à janvier : la fenêtre précédente peut
        // n'en contenir que deux. Comparer 3 mois à 2 fabrique un +50 % sorti
        // de nulle part. On le DIT plutôt que de l'afficher.
        prevComplet: couvert(pStart, pEnd),
        inPeriod: function (s) { var k = mkey(s.year, s.month); return k >= startK && k <= lastK; },
        inPrev: function (s) { var k = mkey(s.year, s.month); return k >= pStart && k <= pEnd; },
      };
    }
    // year = année du dernier mois retenu, arrêtée à ce mois-là
    var y = Math.floor(lastK / 12);
    return {
      label: 'Année ' + y,
      prevLabel: 'année ' + (y - 1),
      prevComplet: false,
      inPeriod: function (s) { return s.year === y && mkey(s.year, s.month) <= lastK; },
      inPrev: function (s) { return s.year === y - 1; },
    };
  }

  // ── helpers ───────────────────────────────────
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var esc = V2.esc || function (s) { return String(s == null ? '' : s); };

  function pharmaName(id) {
    var p = (V2.pharmacies || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.name : 'Pharmacie ' + id;
  }
  function pharmaColor(id, fallback) {
    var p = (V2.pharmacies || []).filter(function (x) { return x.id === id; })[0];
    return (p && p.color) || fallback;
  }

  // ⚠️ `complet` : la période de comparaison est-elle vraiment couverte par le
  // fichier ? Sinon on ne calcule RIEN. Comparer trois mois à deux fabrique un
  // écart qui n'existe pas, et personne ne peut le deviner à l'écran.
  // Optionnel et vrai par défaut : la fiche officine (v2-pharma.js) appelle
  // cette fonction avec trois arguments.
  function deltaHtml(cur, prev, prevLabel, complet) {
    if (complet === false) {
      return '<div class="v2-kpi-d" style="color:var(--muted)">pas de comparaison : ' +
        esc(prevLabel || 'la période précédente') + ' — le fichier de ventes ne remonte pas jusque-là</div>';
    }
    if (!isFinite(prev) || prev === 0) {
      if (cur > 0) return '<div class="v2-kpi-d up">Nouvelle période</div>';
      return '<div class="v2-kpi-d" style="color:var(--muted)">—</div>';
    }
    var d = (cur - prev) / Math.abs(prev) * 100;
    var up = d >= 0;
    var arrow = up ? '▲' : '▼';
    return '<div class="v2-kpi-d ' + (up ? 'up' : 'dn') + '">' + arrow + ' ' +
      (up ? '+' : '') + d.toFixed(1).replace('.', ',') + ' % vs ' + esc(prevLabel || 'préc.') + '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // « MOI vs LE RÉSEAU » — repère de répartition
  // Une seule barre : la mienne remplie, et un trait là où se tient le
  // réseau entier. Deux barres empilées, ce serait deux fois plus d'encre
  // pour la même information.
  // ═══════════════════════════════════════════════════════════════
  function legendeReseau(actif, label) {
    if (!actif) return '';
    return '<div class="pilo-legende">Le trait sur chaque barre, c\'est le réseau' +
      (label ? ' — ' + esc(label) : '') + '. ' +
      'L\'euro indiqué, c\'est ce que la ligne pèserait en plus ou en moins si tu étais réparti comme lui, ' +
      'à chiffre d\'affaires identique.</div>';
  }

  function barreComparee(pct, ref, color) {
    var bar = '<div class="pilo-bar' + (ref == null ? '' : ' cmp') + '">' +
      '<span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + color + '"></span>';
    if (ref != null) {
      bar += '<span class="pilo-ref" style="left:' + Math.min(100, Math.max(0, ref)).toFixed(1) + '%" ' +
        'title="Réseau : ' + ref.toFixed(1).replace('.', ',') + ' %"></span>';
    }
    return bar + '</div>';
  }

  // « réseau 12,9 % · −4,2 pts · N € sous le réseau »
  // Le montant est une différence de RÉPARTITION à CA total identique, pas une
  // prévision : c'est ce que la ligne pèserait si mon mélange était celui du
  // réseau. Le dire, sinon on le lit comme un manque à gagner promis.
  function ecartLigne(pct, ref, monTotal, suffixe) {
    if (ref == null) return suffixe ? '<div class="pilo-tier-meta mono">' + suffixe + '</div>' : '';
    var pts = pct - ref;
    var euros = monTotal * ref / 100 - monTotal * pct / 100;   // = monTotal * (ref - pct) / 100
    var sens = pts >= 0 ? 'au-dessus du réseau' : 'sous le réseau';
    var cls = Math.abs(pts) < 1 ? 'eq' : (pts >= 0 ? 'up' : 'dn');
    return '<div class="pilo-tier-meta mono">' +
      '<span class="pilo-ecart ' + cls + '">' + (pts >= 0 ? '+' : '−') + Math.abs(pts).toFixed(1).replace('.', ',') + ' pts</span>' +
      ' réseau ' + ref.toFixed(1).replace('.', ',') + ' %' +
      (Math.abs(euros) >= 1 ? ' · ' + V2.fmtNum(Math.abs(euros)) + ' € ' + sens : '') +
      (suffixe ? ' · ' + suffixe : '') +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // LE MARCHÉ FRANCE — ce que le pays achète de plus, et de moins
  //
  // Source : Medic'AM (boîtes remboursées en ville, tous régimes, toutes
  // officines). ⚠️ Ce bloc ne parle PAS du réseau Intégral : c'est le marché
  // français. Les deux repères de cette page sont volontairement séparés et
  // étiquetés — les confondre, c'est annoncer une tendance nationale sur un
  // chiffre maison.
  //
  // Trois filtres, et leur raison :
  //  · PRINCEPS uniquement. Sur un générique, un −95 % ou un +300 % est
  //    presque toujours un TRANSFERT entre génériqueurs : la molécule ne
  //    bouge pas, c'est le laboratoire qui change de main. L'afficher comme
  //    une tendance du marché serait faux. Même règle que le Copilote.
  //  · POIDS : au moins POIDS_MINI boîtes par pharmacie et par an en France.
  //    Demande de Will — « vraiment des produits qui ont du poids, pas des
  //    petits trucs sans utilité ». Sans ce plancher, la liste se remplit de
  //    références à +300 % qui pèsent 34 boîtes par an.
  //  · MOUVEMENT : au moins MOUVEMENT_MINI % d'écart sur un an.
  // Classement par POIDS × AMPLEUR, pas par pourcentage : sinon un produit
  // minuscule qui double passe devant le Doliprane qui recule de 7 %.
  //
  // ⚠️ Les valeurs de TENDANCE sont BORNÉES par leur générateur à +300 et
  // −95 (generate_tendance.py). On ne les affiche donc jamais comme des
  // mesures exactes : « ≥ +300 % » et « ≤ −95 % ».
  // ═══════════════════════════════════════════════════════════════
  var POIDS_MINI = 150;        // boîtes / pharmacie / an, marché France
  var MOUVEMENT_MINI = 5;      // % sur un an
  var BORNE_HAUT = 300, BORNE_BAS = -95;   // bornes du générateur

  function estPrinceps(f) { return f === 'pr_low' || f === 'pr_mid' || f === 'pr_high'; }
  function tendanceFr(cip) {
    var T = window.TENDANCE;
    if (!T || !T.data) return null;
    var v = T.data[String(cip)];
    return v == null ? null : v;
  }
  function poidsFr(cip) {
    var A = window.AMELI_AVG;
    if (!A || !A.data) return null;
    var v = A.data[String(cip)];
    return v == null ? null : v;
  }
  function stockIp(cip) {
    var S = window.STOCK_IP;
    return (S && S.data && S.data[String(cip)]) || 0;
  }

  // « 01/02/03/04 » → « janv., févr., mars, avr. » — LU dans la donnée,
  // jamais écrit en dur : le jour où le générateur ajoute un mois, la phrase
  // à l'écran doit bouger toute seule.
  function moisLisibles(txt) {
    if (!txt) return '';
    return String(txt).split('/').map(function (m) {
      var i = parseInt(m, 10);
      return (i >= 1 && i <= 12) ? MN[i - 1] : m;
    }).join(' ');
  }

  function buildMarcheFranceCard(cur) {
    var PS = window.PROD_STATS;
    if (!PS || !PS.length || !window.TENDANCE || !window.AMELI_AVG) return '';

    // Mes ventes de la période, par produit
    var monCa = {}, mesOff = {}, monTotal = 0;
    cur.forEach(function (s) {
      var c = normCip(s.artCode); if (!c) return;
      monCa[c] = (monCa[c] || 0) + (s.mntNetHt || 0);
      (mesOff[c] || (mesOff[c] = {}))[s.pharmacyId] = 1;
      monTotal += (s.mntNetHt || 0);
    });

    var lignes = [];
    for (var i = 0; i < PS.length; i++) {
      var r = PS[i];
      if (!r || !estPrinceps(r.f)) continue;
      var c = normCip(r.c); if (!c) continue;
      var g = tendanceFr(c); if (g == null || Math.abs(g) < MOUVEMENT_MINI) continue;
      var poids = poidsFr(c); if (!(poids >= POIDS_MINI)) continue;
      lignes.push({
        cip: c, nom: r.d || c, g: g, poids: poids,
        score: poids * Math.abs(g),
        stock: stockIp(c),
        ca: monCa[c] || 0,
        nbOff: Object.keys(mesOff[c] || {}).length
      });
    }
    if (!lignes.length) return '';

    // Mon exposition : la part de mon CA posée sur ces marchés-là.
    var expoUp = 0, expoDn = 0;
    lignes.forEach(function (l) { if (l.g > 0) expoUp += l.ca; else expoDn += l.ca; });

    var hausse = lignes.filter(function (l) { return l.g > 0; }).sort(function (a, b) { return b.score - a.score; });
    var baisse = lignes.filter(function (l) { return l.g < 0; }).sort(function (a, b) { return b.score - a.score; });

    function pctTxt(g) {
      if (g >= BORNE_HAUT) return '≥ +' + BORNE_HAUT + ' %';
      if (g <= BORNE_BAS) return '≤ ' + String(BORNE_BAS).replace('-', '−') + ' %';
      return (g > 0 ? '+' : '−') + Math.abs(g) + ' %';
    }
    function ligne(l) {
      var up = l.g > 0;
      return '<div class="pilo-mf-row">' +
        '<span class="pilo-mf-pct ' + (up ? 'up' : 'dn') + ' mono">' + (up ? '▲' : '▼') + ' ' + pctTxt(l.g) + '</span>' +
        '<span class="pilo-mf-main">' +
          '<span class="pilo-mf-nom">' + esc(l.nom) + '</span>' +
          '<span class="pilo-mf-meta mono">' + V2.fmtNum(l.poids) + ' boîtes/pharmacie/an en France' +
            // La pastille stock ne s'affiche QUE sur les hausses : là elle veut
            // dire « proposable dès demain ». Sur une baisse elle n'apprend rien
            // à un commercial, et répétée seize fois elle ne fait que du bruit.
            (up && l.stock > 0 ? '<span class="pilo-mf-stk">en stock Intégral</span>' : '') +
          '</span>' +
        '</span>' +
        '<span class="pilo-mf-moi mono">' +
          (l.ca > 0
            ? '<b>' + V2.fmtNum(l.ca) + ' €</b><small>' + l.nbOff + ' officine' + (l.nbOff > 1 ? 's' : '') + '</small>'
            : '<b class="zero">tu n\'en vends pas</b><small>&nbsp;</small>') +
        '</span>' +
      '</div>';
    }
    function colonne(titre, sousTitre, arr, cls) {
      if (!arr.length) return '<div class="pilo-mf-col"><div class="pilo-mf-h ' + cls + '">' + esc(titre) + '</div>' +
        '<div class="v2-empty"><div class="v2-empty-d">Aucun mouvement marqué sur la période.</div></div></div>';
      var vus = arr.slice(0, 8), reste = arr.slice(8, 25);
      return '<div class="pilo-mf-col">' +
        '<div class="pilo-mf-h ' + cls + '"><span>' + esc(titre) + '<small>' + esc(sousTitre) + '</small></span>' +
          '<span class="pilo-mf-h-moi">toi<small>sur la période</small></span></div>' +
        vus.map(ligne).join('') +
        (reste.length
          ? '<details class="pilo-mf-more"><summary>Voir ' + reste.length + ' produit' + (reste.length > 1 ? 's' : '') + ' de plus</summary>' +
            reste.map(ligne).join('') + '</details>'
          : '') +
      '</div>';
    }

    var mT = (window.TENDANCE.meta) || {}, mA = (window.AMELI_AVG.meta) || {};
    var fenetre = moisLisibles(mT.mois);
    var expoTxt = monTotal > 0
      ? '<div class="pilo-mf-expo">' +
          '<span><b class="up">' + (expoUp / monTotal * 100).toFixed(1).replace('.', ',') + ' %</b> de ton chiffre d\'affaires ' +
            'est sur des produits que la France achète de plus en plus</span>' +
          '<span><b class="dn">' + (expoDn / monTotal * 100).toFixed(1).replace('.', ',') + ' %</b> sur des produits en recul</span>' +
        '</div>'
      : '';

    return '<div class="v2-card pilo-mf">' +
      '<div class="pilo-mf-src">' + ICO('spark', 15) + 'Medic\'AM' + (fenetre ? ' · ' + esc(fenetre) + ' 2026 vs 2025' : '') + '</div>' +
      expoTxt +
      '<div class="pilo-mf-grid">' +
        colonne('Ce que la France achète de plus', 'les plus gros mouvements à la hausse', hausse, 'up') +
        colonne('Ce que la France achète de moins', 'les plus gros mouvements à la baisse', baisse, 'dn') +
      '</div>' +
      '<div class="pilo-mf-note">Boîtes remboursées en ville sur toute la France' +
        (fenetre ? ', ' + esc(fenetre) + ' 2026 comparés aux mêmes mois de 2025' : '') + '. ' +
        'Le poids est une moyenne par officine' + (mA.periode ? ' sur ' + esc(String(mA.periode).replace('→', ' → ')) : '') + '. ' +
        'Princeps uniquement : sur un générique, une variation de cette ampleur est presque toujours un changement de génériqueur, ' +
        'pas un mouvement du marché. Classement par poids du marché multiplié par l\'ampleur du mouvement — ' +
        'seuls les produits au-dessus de ' + POIDS_MINI + ' boîtes par pharmacie et par an y figurent.</div>' +
    '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // MES PRODUITS — mon secteur, les collègues, la France
  //
  // Le Pilotage ne montrait aucun produit : on savait combien on vendait,
  // jamais quoi. Ce bloc répond aux deux questions ensemble.
  //
  // ⚠️ REFONTE DU 24/08/2026 (demande de Will, mot pour mot) : « comparatif
  // entre mon secteur, secteur des collègues commerciaux au global et aussi
  // France avec les stats Ameli ». La première version croisait les
  // DÉPARTEMENTS et les catégories de prix — un découpage géographique, pas
  // un comparatif. Trois lignes de référence remplacent la grille :
  //
  //   · Mon secteur
  //   · Les autres secteurs réunis   ← jamais un collègue nommé
  //   · La France                    ← marché remboursable, Medic'AM
  //
  // On touche une catégorie de prix, la liste dessous ne garde que ces
  // produits. Les LIGNES ne sont pas cliquables : filtrer sur « les autres
  // secteurs » afficherait le détail produit des collègues, et cet écran ne
  // montre jamais le portefeuille de quelqu'un d'autre.
  //
  // ⚠️ LES DEUX CÔTÉS DOIVENT MESURER LA MÊME CHOSE.
  // Medic'AM ne connaît que le REMBOURSABLE. Comparer tout mon chiffre
  // d'affaires — NR et parapharmacie comprises — à un marché qui les ignore
  // donnerait un écart entièrement fabriqué par la différence de périmètre.
  // Par défaut, les trois lignes portent donc sur le seul univers Medic'AM,
  // et l'écran DIT quelle part du chiffre d'affaires cela représente.
  // Le bouton « Tout mon chiffre » rend la vue complète — et retire alors la
  // ligne France, parce qu'elle ne serait plus comparable.
  // ═══════════════════════════════════════════════════════════════
  var BASE = 'ameli';               // 'ameli' (comparable France) | 'tout'
  var CELL = { t: null };           // catégorie de prix retenue (null = toutes)
  var PROD_MAX = 25;                // produits montrés avant dépliage

  // Désignation d'un produit. PROD_STATS couvre 98,6 % du chiffre d'affaires,
  // BENCHMARK complète. ⚠️ Le reste n'a de nom NULLE PART : on affiche alors
  // le code CIP tel quel plutôt qu'un libellé inventé ou une ligne masquée —
  // une de ces références pesait à elle seule 65 k€ sur un mois.
  var _nomIdx = null, _nomStamp = '';
  function prodNoms() {
    var PS = window.PROD_STATS || [], B = window.BENCHMARK || [];
    var stamp = PS.length + 'x' + B.length;
    if (_nomIdx && _nomStamp === stamp) return _nomIdx;
    var m = {}, i;
    for (i = 0; i < B.length; i++) {
      var b = B[i], cb = normCip(b.cip13);
      if (cb && b.designation) m[cb] = { nom: b.designation, fam: null };
    }
    for (i = 0; i < PS.length; i++) {
      var r = PS[i], c = normCip(r.c);
      if (!c) continue;
      m[c] = { nom: r.d || (m[c] && m[c].nom) || '', fam: r.f || null };
    }
    _nomIdx = m; _nomStamp = stamp; return m;
  }

  function famLabel(key) {
    for (var i = 0; i < FAM.length; i++) { if (FAM[i].key === key) return FAM[i]; }
    return null;
  }

  // Un produit est-il suivi par Medic'AM ? C'est la définition de l'univers
  // comparable : même liste de produits des deux côtés, pas une approximation.
  function suiviAmeli(cip) {
    var A = window.AMELI_AVG;
    return !!(A && A.data && A.data[String(cip)] > 0);
  }

  // ── LA FRANCE, par catégorie de prix ────────────────────────────
  // Medic'AM donne des BOÎTES remboursées par pharmacie et par an ; le
  // Pilotage raisonne en euros. On valorise donc chaque produit à son tarif
  // grossiste officiel (window.PPHT) et on range le résultat dans la même
  // catégorie de prix que les ventes. 96,5 % des produits Medic'AM ont un
  // tarif ; les autres sortent du calcul, ils ne sont pas devinés.
  //
  // ⚠️ Le total obtenu (~36 Md€ par an) est un ORDRE DE GRANDEUR du marché
  // officine remboursable valorisé au tarif grossiste, pas un chiffre
  // officiel. On ne l'affiche pas : seules les PARTS servent ici.
  var _frCache = null;
  function franceParTranche() {
    if (_frCache) return _frCache;
    var A = window.AMELI_AVG, P = window.PPHT;
    if (!A || !A.data || !P) return null;
    var base = (A.meta && A.meta.base) || 20000;
    var t = [0, 0, 0, 0], n = 0, sansPrix = 0;
    for (var c in A.data) {
      var pp = P[c];
      if (!(pp > 0)) { sansPrix++; continue; }
      t[priceTier(pp)] += A.data[c] * base * pp;
      n++;
    }
    var tot = t[0] + t[1] + t[2] + t[3];
    if (!(tot > 0)) return null;
    _frCache = { t: t, tot: tot, n: n, sansPrix: sansPrix, meta: A.meta || {} };
    return _frCache;
  }

  function buildProduitsCard(cur, monSecteur, periodeLabel) {
    if (!cur.length) return '';
    var noms = prodNoms();
    var fr = franceParTranche();
    var comparable = BASE === 'ameli' && !!fr;

    // ── Les trois répartitions, en une seule passe ──────────────
    // `retenu` = la ligne entre-t-elle dans l'univers mesuré ? Une seule
    // définition, appliquée aux trois lignes ET à la liste de produits :
    // c'est ce qui garantit que les pourcentages affichés et les produits
    // affichés parlent du même ensemble.
    function retenu(s) { return BASE !== 'ameli' || suiviAmeli(normCip(s.artCode)); }

    var moiT = [0, 0, 0, 0], autresT = [0, 0, 0, 0], i;
    var nAutres = {}, caRetenu = 0, caTotal = 0;
    for (i = 0; i < cur.length; i++) {
      var v = cur[i], m = (v.mntNetHt || 0);
      caTotal += m;
      if (!retenu(v)) continue;
      caRetenu += m;
      var t = priceTier(v.puNet);
      if (monSecteur && v.commercial !== monSecteur) {
        autresT[t] += m;
        if (v.commercial) nAutres[v.commercial] = 1;
      } else {
        moiT[t] += m;
      }
    }
    var moiTot = moiT[0] + moiT[1] + moiT[2] + moiT[3];
    var autresTot = autresT[0] + autresT[1] + autresT[2] + autresT[3];
    if (!(moiTot > 0)) return '';

    var lignes = [];
    lignes.push({
      cle: 'moi',
      nom: monSecteur ? 'Mon secteur' : 'Le réseau Intégral',
      sous: monSecteur ? esc(monSecteur) : (V2.commercials ? V2.commercials().length + ' secteurs' : ''),
      t: moiT, tot: moiTot, fort: true
    });
    if (monSecteur && autresTot > 0) {
      var nb = Object.keys(nAutres).length;
      lignes.push({
        cle: 'autres',
        nom: 'Les autres secteurs',
        sous: nb + (nb > 1 ? ' commerciaux réunis' : ' commercial'),
        t: autresT, tot: autresTot
      });
    }
    if (comparable) {
      lignes.push({
        cle: 'france',
        nom: 'La France',
        sous: 'marché remboursable · Medic\'AM',
        t: fr.t, tot: fr.tot, france: true
      });
    }

    // ── Le tableau ──────────────────────────────────────────────
    function caseHtml(l, ti) {
      var part = l.tot > 0 ? l.t[ti] / l.tot : 0;
      var pct = part * 100;
      // Écart en points face à la référence France : c'est LUI qui se lit,
      // pas le pourcentage brut.
      var ecart = (comparable && !l.france && fr.tot > 0)
        ? pct - (fr.t[ti] / fr.tot * 100) : null;
      var alpha = Math.round(6 + part * 62);
      var pale = (CELL.t != null && CELL.t !== ti);
      return '<div class="pilo-cmp-c' + (pale ? ' pale' : '') + (l.fort ? ' fort' : '') + '"' +
        ' style="background:color-mix(in srgb,' + TIERS[ti].color + ' ' + alpha + '%,var(--card))"' +
        ' title="' + esc(l.nom + ' · ' + TIERS[ti].label + ' · ' + pct.toFixed(1).replace('.', ',') + ' %' +
          (l.france ? '' : ' · ' + V2.fmtEur(l.t[ti]))) + '">' +
        '<span class="pilo-cmp-p mono">' + pct.toFixed(1).replace('.', ',') + ' %</span>' +
        (ecart != null && Math.abs(ecart) >= 0.1
          ? '<span class="pilo-cmp-e mono ' + (ecart >= 0 ? 'up' : 'dn') + '">' +
            (ecart >= 0 ? '+' : '−') + Math.abs(ecart).toFixed(1).replace('.', ',') + ' pts</span>'
          : '') +
      '</div>';
    }

    var enTete =
      '<div class="pilo-cmp-r pilo-cmp-head">' +
        '<span class="pilo-cmp-h"></span>' +
        TIERS.map(function (t, ti) {
          return '<button type="button" class="pilo-cmp-ch' + (CELL.t === ti ? ' vise' : '') + '" data-t="' + ti + '">' +
            '<span class="pilo-mx-dot" style="background:' + t.color + '"></span>' +
            '<span class="pilo-mx-cl">' + t.label + '</span>' +
            '<span class="pilo-mx-cs">' + t.sub + '</span></button>';
        }).join('') +
      '</div>';

    var corps = lignes.map(function (l) {
      return '<div class="pilo-cmp-r' + (l.france ? ' fr' : '') + '">' +
        '<span class="pilo-cmp-h"><span class="pilo-cmp-hn">' + esc(l.nom) + '</span>' +
          (l.sous ? '<span class="pilo-cmp-hs">' + l.sous + '</span>' : '') +
          (l.france ? '' : '<span class="pilo-cmp-hv mono">' + V2.fmtK(l.tot) + ' €</span>') +
        '</span>' +
        TIERS.map(function (t, ti) { return caseHtml(l, ti); }).join('') +
      '</div>';
    }).join('');

    var tableau = '<div class="pilo-cmp-wrap"><div class="pilo-cmp" style="--cols:' + TIERS.length + '">' +
      enTete + corps + '</div></div>';

    // ── La liste des produits de la case retenue ────────────────
    // ⚠️ MÊME UNIVERS que les trois lignes du dessus (`retenu`), et MON
    // secteur uniquement : la liste ne montre jamais le détail produit d'un
    // collègue, seulement l'agrégat de la ligne « Les autres secteurs ».
    var agg = {}, nLignes = 0, caSel = 0;
    for (i = 0; i < cur.length; i++) {
      var w = cur[i];
      if (monSecteur && w.commercial !== monSecteur) continue;
      if (!retenu(w)) continue;
      var tw = priceTier(w.puNet);
      if (CELL.t != null && tw !== CELL.t) continue;
      var c = normCip(w.artCode); if (!c) continue;
      var o = agg[c] || (agg[c] = { c: c, ca: 0, qte: 0, off: {}, caT: [0, 0, 0, 0] });
      o.ca += (w.mntNetHt || 0); o.qte += (w.qte || 0); o.off[w.pharmacyId] = 1;
      // ⚠️ La tranche d'un produit se décide sur le POIDS, pas sur la dernière
      // ligne rencontrée : un même produit peut se vendre à des prix nets
      // différents selon l'officine et changer de catégorie en route.
      o.caT[tw] += (w.mntNetHt || 0);
      caSel += (w.mntNetHt || 0); nLignes++;
    }
    var prods = Object.keys(agg).map(function (k) {
      var o = agg[k], meilleur = 0;
      for (var z = 1; z < 4; z++) { if (o.caT[z] > o.caT[meilleur]) meilleur = z; }
      o.tier = meilleur;
      // Prix net moyen PONDÉRÉ par les quantités, pas le prix de la dernière ligne.
      o.pu = o.qte > 0 ? o.ca / o.qte : 0;
      return o;
    }).sort(function (a, b) { return b.ca - a.ca; });
    var maxProd = prods.length ? prods[0].ca : 1;

    function prodRow(o, rang) {
      var info = noms[o.c] || null;
      var nom = (info && info.nom) || '';
      var f = info && info.fam ? famKeyDeProdStats(info.fam) : null;
      var fl = f ? famLabel(f) : null;
      var t = TIERS[o.tier];
      var g = tendanceFr(o.c);
      var pct = maxProd > 0 ? Math.max(2, o.ca / maxProd * 100) : 0;
      var nOff = Object.keys(o.off).length;
      return '<div class="pilo-pr">' +
        '<span class="mono pilo-rank">' + rang + '</span>' +
        '<div class="pilo-pr-main">' +
          '<div class="pilo-pr-n">' + (nom ? esc(nom) : '<span class="pilo-pr-anon mono">' + esc(o.c) + '</span>') +
            (nom ? '' : '<small>référence non répertoriée</small>') + '</div>' +
          '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + t.color + '"></span></div>' +
          '<div class="pilo-pr-meta mono">' +
            '<span class="pilo-pr-tag" style="color:' + t.color + '"><span class="pilo-tier-dot" style="background:' + t.color + '"></span>' + t.label + '</span>' +
            (fl ? '<span class="pilo-pr-tag">' + esc(fl.label) + '</span>' : '') +
            '<span>' + V2.fmtNum(o.qte) + ' boîte' + (Math.abs(o.qte) > 1 ? 's' : '') + '</span>' +
            '<span>' + nOff + ' officine' + (nOff > 1 ? 's' : '') + '</span>' +
            (o.pu > 0 ? '<span>' + V2.fmtEur(o.pu) + '/boîte</span>' : '') +
            (g != null ? '<span class="pilo-pr-fr ' + (g > 0 ? 'up' : g < 0 ? 'dn' : '') + '"' +
              ' title="Marché France (Medic\'AM) : boîtes remboursées en ville sur un an, hors réseau Intégral">France ' +
              (g >= 300 ? '≥ +300 %' : g <= -95 ? '≤ −95 %' : (g > 0 ? '+' : '−') + Math.abs(g) + ' %') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="pilo-vals"><div class="v2-row-val mono">' + V2.fmtEur(o.ca) + '</div>' +
          '<div class="v2-row-meta mono">' + (caSel > 0 ? (o.ca / caSel * 100).toFixed(1).replace('.', ',') + ' %' : '—') + '</div></div>' +
      '</div>';
    }

    // ⚠️ ON NE DESSINE PAS 5 000 LIGNES — mais on DIT ce qu'on ne dessine pas.
    // Un « voir 175 de plus » sur 5 002 références se lit comme une liste
    // complète : c'est une troncature déguisée en exhaustivité.
    var PLAFOND = 200;
    var hauts = prods.slice(0, PROD_MAX), bas = prods.slice(PROD_MAX, PLAFOND);
    var horsListe = Math.max(0, prods.length - PLAFOND);
    var caListe = 0;
    for (i = 0; i < prods.length && i < PLAFOND; i++) { caListe += prods[i].ca; }
    var listeHtml = prods.length
      ? hauts.map(function (o, ix) { return prodRow(o, ix + 1); }).join('') +
        (bas.length
          ? '<details class="pilo-mf-more"><summary>Voir ' + bas.length + ' produit' + (bas.length > 1 ? 's' : '') + ' de plus</summary>' +
            bas.map(function (o, ix) { return prodRow(o, PROD_MAX + ix + 1); }).join('') + '</details>'
          : '') +
        (horsListe
          ? '<div class="pilo-prod-reste">' + V2.fmtNum(horsListe) + ' autres références ne sont pas listées — ' +
            'les ' + PLAFOND + ' premières font déjà ' +
            (caSel > 0 ? (caListe / caSel * 100).toFixed(1).replace('.', ',') : '0') + ' % du chiffre d\'affaires de cette sélection.</div>'
          : '')
      : '<div class="v2-empty"><div class="v2-empty-d">Aucun produit sur cette sélection.</div></div>';

    var aMoi = monSecteur ? 'Mes produits' : 'Les produits du réseau';
    var titreListe = CELL.t != null ? aMoi + ' · ' + TIERS[CELL.t].label : aMoi;

    var baseBtns = fr
      ? '<div class="pilo-seg pilo-axeseg">' +
          '<button type="button" class="pilo-segbtn pilo-basebtn' + (BASE === 'ameli' ? ' on' : '') + '" data-base="ameli">' +
            'Comparable à la France</button>' +
          '<button type="button" class="pilo-segbtn pilo-basebtn' + (BASE === 'tout' ? ' on' : '') + '" data-base="tout">' +
            (monSecteur ? 'Tout mon chiffre' : 'Tout le chiffre') + '</button>' +
        '</div>'
      : '';

    // La note dit sur quoi on compte, et ce qu'on a laissé dehors. Un
    // pourcentage sans son périmètre ne veut rien dire.
    var partRetenue = caTotal > 0 ? caRetenu / caTotal * 100 : 0;
    var leCa = monSecteur ? 'ton chiffre d\'affaires' : 'le chiffre d\'affaires du réseau';
    var nbLignes = lignes.length === 3 ? 'Les trois lignes' : (lignes.length === 2 ? 'Les deux lignes' : 'Les lignes');
    var note = comparable
      ? nbLignes + ' comptent les <b>mêmes produits</b> : ceux que Medic\'AM suit, ' +
        'c\'est-à-dire les remboursables — <b>' + partRetenue.toFixed(1).replace('.', ',') + ' %</b> ' +
        'de ' + leCa + ' sur cette fenêtre. Les NR et la parapharmacie n\'y sont pas : ' +
        'la France ne les connaît pas, les compter d\'un seul côté fabriquerait un écart qui n\'existe pas. ' +
        'Côté France, chaque boîte remboursée est valorisée à son tarif grossiste' +
        (fr.meta && fr.meta.periode ? ' (' + esc(String(fr.meta.periode).replace('→', ' → ')) + ')' : '') + '.'
      : 'Vue complète : ' + leCa + ' en entier, NR et parapharmacie comprises. ' +
        (franceParTranche()
          ? 'La ligne France disparaît — Medic\'AM ne connaît que le remboursable, elle ne serait plus comparable.'
          : 'La référence France n\'est pas disponible : les données Medic\'AM ne sont pas chargées.');

    return '<div class="v2-card pilo-prod">' +
      '<div class="pilo-prod-h">' +
        '<div class="pilo-prod-t">' + ICO('grid', 16) +
          (monSecteur ? 'Mon secteur, les collègues, la France' : 'Le réseau et la France') + '</div>' + baseBtns +
      '</div>' +
      '<div class="pilo-legende">Comment se répartit le chiffre d\'affaires entre les quatre catégories ' +
        'de prix' + (comparable ? (monSecteur ? ', chez moi, chez les autres, et en France' : ', dans le réseau et en France') : '') + '. ' +
        (comparable ? 'Le petit chiffre sous chaque part est l\'écart avec la France, en points. ' : '') +
        'Touche une catégorie pour ne garder que ces produits dans la liste dessous.' +
        (periodeLabel ? '<br><b>Mesuré sur ' + esc(periodeLabel) + '</b> — pas sur la période choisie en haut : ' +
          'sur les derniers mois, tous les secteurs ne sont pas encore dans le fichier de ventes.' : '') +
      '</div>' +
      tableau +
      '<div class="pilo-cmp-note">' + note + '</div>' +
      '<div class="pilo-prod-sep"><span class="pilo-prod-lt">' + esc(titreListe) + '</span>' +
        '<span class="pilo-prod-lc mono">' + V2.fmtNum(prods.length) + ' référence' + (prods.length > 1 ? 's' : '') +
          ' · ' + V2.fmtEur(caSel) + '</span>' +
        (CELL.t != null ? '<button type="button" class="pilo-prod-raz" data-raz="1">Toutes les catégories</button>' : '') +
      '</div>' +
      listeHtml +
    '</div>';
  }

  // PROD_STATS classe en pr_low / pr_mid / pr_high / gen / nr / biosim ;
  // le Pilotage raisonne en familles FAM. On traduit, sans inventer : une
  // valeur inconnue ne donne pas d'étiquette du tout.
  function famKeyDeProdStats(f) {
    if (f === 'gen') return 'generiques';
    if (f === 'nr') return 'nr';
    if (f === 'biosim') return 'biosim';
    if (f === 'pr_low' || f === 'pr_mid' || f === 'pr_high') return 'princeps';
    return null;
  }

  // ── Détection mode OPSO ───────────────────────
  function isOpso() {
    return !!(window.V2_BRAND && window.V2_BRAND.opso);
  }

  // ── Mini sparkline SVG (tendance sur N points) ──────────────
  // Ligne + aire douce, dernier point marqué. Couleur passée en paramètre.
  function sparkline(vals, color, w, h) {
    w = w || 132; h = h || 34;
    var n = vals.length;
    if (n < 2) return '';
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var span = (max - min) || 1;
    var pad = 3;
    var iw = w - pad * 2, ih = h - pad * 2;
    var pts = vals.map(function (v, i) {
      var x = pad + (n === 1 ? 0 : i / (n - 1) * iw);
      var y = pad + ih - ((v - min) / span) * ih;
      return [x, y];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[n - 1][0].toFixed(1) + ' ' + (h - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - pad) + ' Z';
    var last = pts[n - 1];
    var gid = 'spk' + Math.random().toString(36).slice(2, 7);
    return '<svg class="pilo-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + color + '" stop-opacity=".22"/>' +
        '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path class="pilo-spark-line" d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + color + '"/>' +
    '</svg>';
  }

  // Série CA mensuelle (N derniers mois présents), pour sparklines KPI
  function monthlyCaSeries(sales, n) {
    var months = availableMonths(sales);
    if (!months.length) return [];
    var last = months[months.length - 1], lastK = mkey(last.year, last.month);
    var byK = {};
    sales.forEach(function (s) { if (s.month && s.year) { var k = mkey(s.year, s.month); byK[k] = (byK[k] || 0) + (s.mntNetHt || 0); } });
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(byK[lastK - i] || 0);
    return out;
  }

  // ── Top produits par CA (période courante) ────
  // Agrège par artDesignation (label produit), renvoie top N
  function buildTopProducts(salesArr, n) {
    var byProd = {};
    salesArr.forEach(function (s) {
      var key = (s.artDesignation || s.artCode || 'Inconnu').trim();
      if (!byProd[key]) byProd[key] = { label: key, ca: 0, qte: 0 };
      byProd[key].ca += (s.mntNetHt || 0);
      byProd[key].qte += (s.qte || 0);
    });
    return Object.keys(byProd).map(function (k) { return byProd[k]; })
      .sort(function (a, b) { return b.ca - a.ca; })
      .slice(0, n || 10);
  }

  // ════════════════════════════════════════════
  // SECTION OPSO — groupement
  // ════════════════════════════════════════════
  function buildOpsoSection(salesCur, salesPrev, pf) {
    var pharmacies = V2.pharmacies || [];
    var total = pharmacies.length;

    // Taux d'activation : officines inDb (commandent déjà)
    var clientes = pharmacies.filter(function (p) { return p.inDb; }).length;
    var prospects = total - clientes;
    var tauxPct = total > 0 ? (clientes / total * 100) : 0;

    // CA groupement (période)
    var caGrp = V2.sumCA(salesCur);
    var caGrpPrev = V2.sumCA(salesPrev);

    // Officines avec CA > 0 sur la période
    var caByPh = {};
    salesCur.forEach(function (s) {
      caByPh[s.pharmacyId] = (caByPh[s.pharmacyId] || 0) + (s.mntNetHt || 0);
    });
    var nbActif = Object.keys(caByPh).filter(function (id) { return caByPh[id] > 0; }).length;

    // Répartition par périmètre (NP / BP / OPSO / autre)
    var perims = {};
    pharmacies.forEach(function (p) {
      var per = (p.perimetre || '').trim() || 'Autre';
      if (!perims[per]) perims[per] = { label: per, total: 0, actives: 0, ca: 0 };
      perims[per].total++;
      if (p.inDb) perims[per].actives++;
    });
    // rattacher le CA par périmètre
    salesCur.forEach(function (s) {
      var ph = pharmacies.filter(function (x) { return x.id === s.pharmacyId; })[0];
      if (!ph) return;
      var per = (ph.perimetre || '').trim() || 'Autre';
      if (perims[per]) perims[per].ca += (s.mntNetHt || 0);
    });
    var perimList = Object.keys(perims).map(function (k) { return perims[k]; })
      .sort(function (a, b) { return b.ca - a.ca; });

    // Couleurs périmètre — tokens de séries (sépare les périmètres sans clinquant)
    var PERIM_COLORS = { 'NP': 'var(--c-fiche)', 'BP': 'var(--c-cat)', 'OPSO': 'var(--c-amber)' };
    function perimColor(lbl) { return PERIM_COLORS[lbl] || 'var(--muted-2)'; }

    // Top 8 produits groupement
    var topProds = buildTopProducts(salesCur, 8);
    var maxProd = topProds.length ? topProds[0].ca : 1;

    // ── HTML ───────────────────────────────────

    // KPI taux d'activation
    var tauxBar = Math.round(tauxPct);
    var kpiActivation =
      '<div class="v2-card opso-act-card" style="margin-bottom:14px;padding:20px 22px">' +
        '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('pharma', 17) + 'Taux d\'activation groupement</div>' +
        '<div class="opso-act-body">' +
          '<div class="opso-act-gauge">' +
            '<div class="opso-gauge-track">' +
              '<div class="opso-gauge-fill" data-w="' + tauxBar + '" style="width:0"></div>' +
            '</div>' +
            '<div class="opso-gauge-labels">' +
              '<span class="mono" style="font-size:13px;font-weight:700;color:' + V2.tint(tauxBar, 30, 60) + '">' + tauxBar + ' %</span>' +
              '<span style="font-size:12px;color:var(--muted)">' + total + ' officines au listing</span>' +
            '</div>' +
          '</div>' +
          '<div class="opso-act-chips">' +
            '<div class="opso-chip-stat active">' +
              '<div class="opso-chip-n mono">' + clientes + '</div>' +
              '<div class="opso-chip-l">Clientes</div>' +
            '</div>' +
            '<div class="opso-chip-stat prospect">' +
              '<div class="opso-chip-n mono">' + prospects + '</div>' +
              '<div class="opso-chip-l">Prospects</div>' +
            '</div>' +
            '<div class="opso-chip-stat actif">' +
              '<div class="opso-chip-n mono">' + nbActif + '</div>' +
              '<div class="opso-chip-l">Actives / période</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // KPIs groupement CA
    var kpiGrp =
      '<div class="v2-kpis opso-kpi-grp" style="margin-bottom:14px">' +
        '<div class="v2-kpi k1">' +
          '<div class="v2-kpi-l">CA groupement</div>' +
          '<div class="v2-kpi-v mono">' + V2.fmtEur(caGrp) + '</div>' +
          deltaHtml(caGrp, caGrpPrev, pf && pf.prevLabel, !pf || pf.prevComplet !== false) +
        '</div>' +
        '<div class="v2-kpi k4">' +
          '<div class="v2-kpi-l">Panier moyen clientes actives</div>' +
          '<div class="v2-kpi-v mono">' + V2.fmtEur(nbActif > 0 ? caGrp / nbActif : 0) + '</div>' +
          '<div class="v2-kpi-d" style="color:var(--muted)">par officine active</div>' +
        '</div>' +
      '</div>';

    // Répartition périmètre
    var hasPerim = perimList.length > 0 && perimList.some(function (p) { return p.label !== 'Autre'; });
    var perimCard = '';
    if (hasPerim) {
      var maxPerimTotal = perimList.reduce(function (a, p) { return Math.max(a, p.total); }, 1);
      var perimRows = perimList.map(function (p) {
        var actPct = p.total > 0 ? Math.round(p.actives / p.total * 100) : 0;
        var barW = Math.max(2, p.total / maxPerimTotal * 100);
        var col = perimColor(p.label);
        return '<div class="opso-perim-row">' +
          '<div class="opso-perim-top">' +
            '<span class="opso-perim-badge" style="background:color-mix(in srgb,' + col + ' 14%,#fff);color:' + col + '">' + esc(p.label) + '</span>' +
            '<div class="opso-perim-nums">' +
              '<span class="mono" style="font-weight:700;font-size:13.5px">' + p.actives + '<span style="color:var(--muted);font-weight:500">/' + p.total + '</span></span>' +
              '<span class="v2-chip ' + (actPct >= 50 ? 'g' : 'a') + '" style="margin-left:8px">' + actPct + ' %</span>' +
              (p.ca > 0 ? '<span class="mono" style="font-size:12px;color:var(--muted);margin-left:12px">' + V2.fmtEur(p.ca) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="pilo-bar" style="margin-top:8px"><span class="pilo-bar-fill" data-w="' + barW.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
        '</div>';
      }).join('');
      perimCard =
        '<div class="v2-card" style="padding:18px 22px;margin-bottom:14px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('grid', 17) + 'Répartition par périmètre</div>' +
          perimRows +
        '</div>';
    }

    // Top produits groupement
    var topProdHtml = topProds.length ?
      topProds.map(function (r, i) {
        var pct = maxProd > 0 ? Math.max(2, r.ca / maxProd * 100) : 0;
        return '<div class="v2-row" style="cursor:default">' +
          '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="v2-row-name">' + esc(r.label) + '</div>' +
            '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--ip-blue)"></span></div>' +
          '</div>' +
          '<div class="pilo-vals">' +
            '<div class="v2-row-val mono">' + V2.fmtEur(r.ca) + '</div>' +
            '<div class="v2-row-meta mono">' + V2.fmtNum(r.qte) + ' unités</div>' +
          '</div>' +
        '</div>';
      }).join('')
      : '<div class="v2-empty"><div class="v2-empty-d">Aucune vente sur la période.</div></div>';

    var topProdCard =
      '<div class="v2-card" style="margin-bottom:14px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pilo', 17) + 'Top produits groupement</div>' +
          '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + (pf ? esc(pf.label) : '') + '</span></div>' +
        topProdHtml +
      '</div>';

    // ── Détail par officine cliente (classé par CA sur la période) ──
    var refsByPh = {};
    salesCur.forEach(function (s) {
      var k = String(s.artCode || s.artDesignation || '');
      (refsByPh[s.pharmacyId] = refsByPh[s.pharmacyId] || {})[k] = 1;
    });
    var officines = pharmacies.filter(function (p) { return p.inDb; })
      .map(function (p) {
        return { p: p, ca: caByPh[p.id] || 0, refs: refsByPh[p.id] ? Object.keys(refsByPh[p.id]).length : 0 };
      })
      .sort(function (a, b) { return b.ca - a.ca; });
    var maxOffCa = officines.length ? Math.max(officines[0].ca, 1) : 1;
    var SHOWN = 20;
    var offRows = officines.slice(0, SHOWN).map(function (o) {
      var col = perimColor((o.p.perimetre || '').trim());
      var w = Math.max(2, o.ca / maxOffCa * 100);
      var goId = o.p.id;
      return '<div class="v2-row" onclick="V2.go(\'pharma\',\'' + goId + '\')" style="cursor:pointer">' +
        '<span class="opso-perim-badge" style="background:color-mix(in srgb,' + col + ' 14%,#fff);color:' + col + ';flex-shrink:0">' + esc((o.p.perimetre || '–').trim() || '–') + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="v2-row-name">' + esc(o.p.name) + (o.p.hasStats ? ' <span class="opso-new-tag">nouv.</span>' : '') + '</div>' +
          '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + w.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
        '</div>' +
        '<div class="pilo-vals">' +
          '<div class="v2-row-val mono">' + V2.fmtEur(o.ca) + '</div>' +
          '<div class="v2-row-meta mono">' + o.refs + ' réf.' + (o.p.ville ? ' · ' + esc(o.p.ville) : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var officinesCard = officines.length ?
      '<div class="v2-card" style="margin-bottom:14px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Officines clientes — détail</div>' +
          '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + officines.length + ' clientes' +
          (officines.length > SHOWN ? ' · top ' + SHOWN : '') + '</span></div>' +
        offRows +
      '</div>' : '';

    return {
      html: '<div class="opso-section">' +
              '<div class="opso-section-head">' + ICO('pharma', 16) + 'Groupement OPSO Santé</div>' +
              kpiActivation +
              kpiGrp +
              (perimCard || '') +
              officinesCard +
              topProdCard +
            '</div>',
    };
  }

  // ════════════════════════════════════════════
  // Composants réutilisés par la fiche officine (homogénéisation stats + évolutions).
  V2.deltaHtml = deltaHtml;
  V2.build13MonthChart = build13MonthChart;
  V2.monthlyCaSeries = monthlyCaSeries;
  V2.miniSparkline = sparkline;

  // PAGE
  // ════════════════════════════════════════════
  V2.pages.pilotage = {
    render: function (root) {
      // ── Confidentialité inter-commerciaux (Pilotage uniquement) ──
      // Un utilisateur relié à un commercial ne voit que SON périmètre ou le global national,
      // jamais le tableau de bord d'un collègue. Super-admin (commercial vide) = accès total.
      // `voit_tous_commerciaux` (profil Supabase) lève la restriction pour la direction, sans
      // vider son `commercial` — qui reste son repère dans les campagnes et le planning RDV.
      var myComm = (V2.user && V2.user.commercial) ? String(V2.user.commercial) : '';
      var voitTous = !!(V2.user && V2.user.voitTous);
      if (myComm && !voitTous) {
        if (!V2._piloScopedInit) { V2.commFilter = myComm; V2._piloScopedInit = true; }   // atterrit sur « Moi »
        if (V2.commFilter !== '' && V2.commFilter !== myComm) V2.commFilter = myComm;       // jamais un collègue
      }
      var sales = V2.commSales ? V2.commSales() : (V2.sales || []);
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      injectStyles();

      var opso = isOpso();

      // ── Empty state ──
      if (!sales.length) {
        root.innerHTML = top +
          '<div class="v2-wrap">' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub">' + (opso ? 'Tableau de bord groupement OPSO Santé.' : 'Ton chiffre d\'affaires, ta marge MDL et tes familles produits.') + '</div>' +
            '<div class="v2-card"><div class="v2-empty">' +
              '<div class="v2-empty-ico">' + ICO('pilo', 64, 1.4) + '</div>' +
              '<div class="v2-empty-t">Tes ventes ne sont pas encore disponibles</div>' +
              '<div class="v2-empty-d">Tes données de ventes ne sont pas encore chargées sur ton périmètre. Contacte ton administrateur pour les activer.</div>' +
            '</div></div>' +
          '</div>';
        return;
      }

      var idx = productIndex();
      // Index officines : sert au groupement ET au découpage par département.
      var phById = {}; (V2.pharmacies || []).forEach(function (p) { phById[p.id] = p; });
      var anc = ancreComplete(sales);
      var pf = periodFilter(sales, PERIOD, anc);
      var inP = pf ? pf.inPeriod : function () { return true; };
      var inPrev = pf ? pf.inPrev : function () { return false; };

      var cur = sales.filter(inP);
      var prev = sales.filter(inPrev);

      // ── Le RÉSEAU sur la MÊME période, pour se situer ────────────────
      // « Réseau » = les huit secteurs réunis. C'est la seule base qui partage
      // les tranches de prix et l'abandon de marge Intégral. Le marché FRANCE,
      // lui, a son propre bloc plus bas et vient de Medic'AM : les deux ne se
      // mélangent jamais dans un même chiffre.
      // ── Le repère réseau ────────────────────────────────────────────
      // Rien à comparer quand on regarde déjà le réseau entier.
      //
      // ⚠️ ET LE REPÈRE NE SE PREND PAS SUR LA PÉRIODE AFFICHÉE. Les fichiers
      // de ventes s'arrêtent à des mois différents selon le commercial : sur le
      // dernier mois, deux secteurs seulement ont des lignes. Un « repère
      // réseau » calculé là-dessus, ce serait se comparer à soi-même en
      // l'appelant le réseau.
      // On prend donc TOUS les mois où le réseau est au complet. C'est une répartition,
      // pas un niveau : elle bouge peu d'un mois sur l'autre, et une base de
      // cinq mois est plus solide qu'un mois isolé. L'écran DIT sur quoi elle
      // porte, sinon « le réseau » ne veut rien dire.
      var ancRes = ancreComplete(V2.sales || []);
      var sectTotal = (V2.commercials ? V2.commercials().length : 0);
      var reseauComplet = null, repereLabel = '';
      if (sectTotal > 1 && ancRes) {
        reseauComplet = (V2.sales || []).filter(function (s) { return ancRes.dispo[mkey(s.year, s.month)]; });
        var bornes = Object.keys(ancRes.dispo).map(Number).sort(function (a, b) { return a - b; });
        repereLabel = 'les ' + ancRes.maxSect + ' secteurs réunis, ' +
          (bornes.length > 1 ? 'de ' + nomMois(bornes[0]) + ' à ' + nomMois(bornes[bornes.length - 1])
                             : 'sur ' + nomMois(bornes[0]));
      }
      var reseauCur = V2.commFilter ? reseauComplet : null;
      var compare = !!(reseauCur && reseauCur.length);
      if (!compare) reseauCur = null;

      // ── KPI 1 : CA net HT ──
      var caCur = V2.sumCA(cur), caPrev = V2.sumCA(prev);

      // ── KPI 2 : Marge MDL générée (remboursables) ──
      var mdlCur = 0;
      cur.forEach(function (s) { mdlCur += mdlOf(s, idx); });
      var mdlPct = caCur > 0 ? (mdlCur / caCur * 100) : 0;

      // ── KPI 3 : Pharmacies actives (CA > 0) ──
      var caByPh = {};
      cur.forEach(function (s) { caByPh[s.pharmacyId] = (caByPh[s.pharmacyId] || 0) + (s.mntNetHt || 0); });
      var activePh = Object.keys(caByPh).filter(function (id) { return caByPh[id] > 0; });
      var nbActive = activePh.length;

      // ── KPI 4 : Panier moyen ──
      var panier = nbActive ? caCur / nbActive : 0;

      // Séries pour les mini-tendances (12 derniers mois)
      var caSeries = monthlyCaSeries(sales, 12);
      var caTrend = caSeries.length >= 2 ? sparkline(caSeries, 'var(--ip-blue)', 150, 44) : '';
      var activeRatio = (V2.pharmacies || []).length ? Math.round(nbActive / (V2.pharmacies || []).length * 100) : 0;

      // ── HERO : CA net HT (le KPI qui prime) ──
      var heroKpi =
        '<div class="pilo-hero" data-reveal>' +
          '<div class="pilo-hero-main">' +
            '<div class="pilo-hero-l">CA net HT · ' + (pf ? esc(pf.label) : '') + '</div>' +
            '<div class="pilo-hero-v mono" data-count>' + V2.fmtEur(caCur) + '</div>' +
            '<div class="pilo-hero-delta">' + deltaHtml(caCur, caPrev, pf && pf.prevLabel, !pf || pf.prevComplet !== false) + '</div>' +
          '</div>' +
          (caTrend ? '<div class="pilo-hero-trend"><div class="pilo-hero-trend-t">12 derniers mois</div>' + caTrend + '</div>' : '') +
        '</div>';

      // ── KPIs secondaires (marge / actives / panier) ──
      var kpis = heroKpi +
        '<div class="v2-kpis pilo-kpis3" data-reveal>' +
          '<div class="v2-kpi k2"><div class="v2-kpi-l">Marge MDL générée</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(mdlCur) + '</div>' +
            '<div class="pilo-kpi-meter"><span class="pilo-kpi-meter-fill" data-w="' + Math.min(100, mdlPct).toFixed(1) + '" style="width:0;background:var(--c-mint)"></span></div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">' + mdlPct.toFixed(1).replace('.', ',') + ' % du CA net</div></div>' +
          '<div class="v2-kpi k3"><div class="v2-kpi-l">Pharmacies actives</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtNum(nbActive) + '</div>' +
            '<div class="pilo-kpi-meter"><span class="pilo-kpi-meter-fill" data-w="' + activeRatio + '" style="width:0;background:var(--c-cat)"></span></div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">' + activeRatio + ' % des ' + V2.fmtNum((V2.pharmacies || []).length) + ' officines</div></div>' +
          '<div class="v2-kpi k4"><div class="v2-kpi-l">Panier moyen</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(panier) + '</div>' +
            '<div class="v2-kpi-d" style="color:var(--muted);margin-top:auto">par officine active</div></div>' +
        '</div>';

      // ── Chart 13 mois ──
      var chart = build13MonthChart(sales, anc);

      // ── Top pharmacies par CA (période) + marge MDL par pharma ──
      // ⚠️ Une SEULE passe. Cette ligne faisait un `cur.filter()` complet POUR
      // CHAQUE officine active : 625 officines × 73 000 lignes = 45 millions de
      // comparaisons, 454 ms des 685 ms de rendu de l'écran — sur un Mac.
      // Le résultat est identique, le coût est divisé par le nombre d'officines.
      var mdlByPh = {};
      cur.forEach(function (s) { mdlByPh[s.pharmacyId] = (mdlByPh[s.pharmacyId] || 0) + mdlOf(s, idx); });
      var phRows = activePh.map(function (id) {
        return { id: id, ca: caByPh[id], mdl: mdlByPh[id] || 0 };
      });

      // Top 10 par CA
      var topCa = phRows.slice().sort(function (a, b) { return b.ca - a.ca; }).slice(0, 10);
      var maxCa = topCa.length ? topCa[0].ca : 1;
      var topCaHtml = topCa.map(function (r, i) {
        var pct = maxCa > 0 ? Math.max(2, r.ca / maxCa * 100) : 0;
        var col = pharmaColor(r.id, 'var(--c-fiche)');
        return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(r.id) + '\')">' +
          '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
          '<span class="v2-row-dot" style="background:' + col + '"></span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="v2-row-name">' + esc(pharmaName(r.id)) + '</div>' +
            '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
          '</div>' +
          '<div class="pilo-vals">' +
            '<div class="v2-row-val mono">' + V2.fmtEur(r.ca) + '</div>' +
            '<div class="v2-row-meta mono">MDL ' + V2.fmtEur(r.mdl) + '</div>' +
          '</div>' +
          '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
        '</a>';
      }).join('');
      var topCaCard =
        '<div class="v2-card">' +
          '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Top 10 pharmacies par CA</div>' +
            '<span class="v2-card-link" onclick="V2.go(\'pharma\')">Toutes</span></div>' +
          (topCaHtml || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie active sur la période.</div></div>') +
        '</div>';

      // ── Répartition par famille (+ repère réseau) ──
      var famTotals = {}; FAM.forEach(function (f) { famTotals[f.key] = 0; });
      cur.forEach(function (s) { famTotals[familyOf(s, idx)] += (s.mntNetHt || 0); });
      var famTotal = FAM.reduce(function (a, f) { return a + famTotals[f.key]; }, 0) || 1;
      var famRes = null, famResTotal = 1;
      if (compare) {
        famRes = {}; FAM.forEach(function (f) { famRes[f.key] = 0; });
        reseauCur.forEach(function (s) { famRes[familyOf(s, idx)] += (s.mntNetHt || 0); });
        famResTotal = FAM.reduce(function (a, f) { return a + famRes[f.key]; }, 0) || 1;
      }
      var famSorted = FAM.slice().sort(function (a, b) { return famTotals[b.key] - famTotals[a.key]; });
      var famHtml = famSorted.map(function (f) {
        var v = famTotals[f.key];
        var pct = v / famTotal * 100;
        var icon = f.key === 'froid' ? 'froid' : 'pill';
        return '<div class="pilo-fam">' +
          '<div class="pilo-fam-top">' +
            '<span class="pilo-fam-l"><span class="pilo-fam-ico" style="color:' + f.color + '">' + ICO(icon, 15) + '</span>' + f.label + '</span>' +
            '<span class="pilo-fam-v"><span class="mono" style="font-weight:700">' + V2.fmtEur(v) + '</span>' +
              '<span class="mono pilo-fam-pct">' + pct.toFixed(1).replace('.', ',') + ' %</span></span>' +
          '</div>' +
          barreComparee(pct, famRes ? famRes[f.key] / famResTotal * 100 : null, f.color) +
          ecartLigne(pct, famRes ? famRes[f.key] / famResTotal * 100 : null, famTotal) +
        '</div>';
      }).join('');
      var famCard =
        '<div class="v2-card" style="padding:18px 20px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('cat', 17) + 'Répartition par famille de produits</div>' +
          famHtml +
        '</div>';

      // ── Répartition par tranche de prix (prix net unitaire) ──
      var tierCA = [0, 0, 0, 0], tierRefs = [{}, {}, {}, {}];
      cur.forEach(function (s) {
        var t = priceTier(s.puNet);
        tierCA[t] += (s.mntNetHt || 0);
        tierRefs[t][normCip(s.artCode)] = 1;
      });
      var tierTotal = tierCA.reduce(function (a, b) { return a + b; }, 0) || 1;
      // Le même découpage sur le réseau entier : c'est le repère.
      var tierRes = null, tierResTotal = 1;
      if (compare) {
        tierRes = [0, 0, 0, 0];
        reseauCur.forEach(function (s) { tierRes[priceTier(s.puNet)] += (s.mntNetHt || 0); });
        tierResTotal = tierRes.reduce(function (a, b) { return a + b; }, 0) || 1;
      }
      var tierHtml = TIERS.map(function (t, i) {
        var v = tierCA[i], pct = v / tierTotal * 100, nref = Object.keys(tierRefs[i]).length;
        var ref = tierRes ? tierRes[i] / tierResTotal * 100 : null;
        return '<div class="pilo-fam">' +
          '<div class="pilo-fam-top">' +
            // La borne de tranche ne se coupe jamais en deux (« 4,33 – / 468 € ») :
            // c'est un seul repère chiffré. Le qualificatif, lui, peut passer à la ligne.
            '<span class="pilo-fam-l"><span class="pilo-tier-dot" style="background:' + t.color + '"></span>' +
              '<span class="pilo-tier-lbl">' + t.label + '</span>' +
              '<span class="pilo-tier-sub">· ' + t.sub + '</span></span>' +
            '<span class="pilo-fam-v"><span class="mono" style="font-weight:700">' + V2.fmtEur(v) + '</span>' +
              '<span class="mono pilo-fam-pct">' + pct.toFixed(1).replace('.', ',') + ' %</span></span>' +
          '</div>' +
          barreComparee(pct, ref, t.color) +
          (ref == null
            ? '<div class="pilo-tier-meta mono">' + nref + ' référence' + (nref > 1 ? 's' : '') + '</div>'
            : ecartLigne(pct, ref, tierTotal, nref + ' référence' + (nref > 1 ? 's' : ''))) +
        '</div>';
      }).join('');
      var tierCard =
        '<div class="v2-card" style="padding:18px 20px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('cat', 17) + 'Répartition par tranche de prix</div>' +
          tierHtml +
        '</div>';

      // ── CA & marge par groupement ──
      function grpKey(ph) { return (ph && (ph.groupement || '').trim()) || 'Indépendants'; }
      var grpAgg = {};
      cur.forEach(function (s) {
        var ph = phById[s.pharmacyId]; if (!ph) return;
        var g = grpKey(ph);
        var o = grpAgg[g] || (grpAgg[g] = { name: g, ca: 0, mdl: 0, prev: 0, ph: {} });
        o.ca += (s.mntNetHt || 0); o.mdl += mdlOf(s, idx); o.ph[s.pharmacyId] = 1;
      });
      prev.forEach(function (s) {
        var ph = phById[s.pharmacyId]; if (!ph) return;
        var o = grpAgg[grpKey(ph)]; if (o) o.prev += (s.mntNetHt || 0);
      });
      var grpList = Object.keys(grpAgg).map(function (k) { return grpAgg[k]; })
        .sort(function (a, b) { return b.ca - a.ca; });
      var grpCard = '';
      if (grpList.length >= 2 && !opso) {
        var topG = grpList.slice(0, 10);
        var maxG = Math.max(topG[0].ca, 1);
        var grpHtml = topG.map(function (g, i) {
          var pct = Math.max(2, g.ca / maxG * 100);
          var nb = Object.keys(g.ph).length;
          return '<div class="v2-row" style="cursor:default">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(g.name) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--ip-blue)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono">' + V2.fmtEur(g.ca) + '</div>' +
              '<div class="v2-row-meta mono">' + nb + ' off. · MDL ' + V2.fmtEur(g.mdl) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
        grpCard =
          '<div class="v2-card">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('grid', 17) + 'CA &amp; marge par groupement</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + grpList.length + ' groupements</span></div>' +
            grpHtml +
          '</div>';
      }

      // ── Pénétration du marché Ameli (couverture de gamme + marchés non couverts) ──
      var B = window.BENCHMARK || [];
      var ameliMkt = {};
      B.forEach(function (b) {
        if (!b.has_ameli) return;
        var c = normCip(b.cip13); if (!c) return;
        ameliMkt[c] = { desc: (b.designation || c), market: +b.ameli_total || 0 };
      });
      var ameliCips = Object.keys(ameliMkt);
      var ameliCard = '';
      if (ameliCips.length) {
        var myQ = {}; cur.forEach(function (s) { var c = normCip(s.artCode); if (c) myQ[c] = (myQ[c] || 0) + (s.qte || 0); });
        var coveredN = 0; ameliCips.forEach(function (c) { if (myQ[c] > 0) coveredN++; });
        var totalN = ameliCips.length;
        var covBar = Math.round(totalN ? coveredN / totalN * 100 : 0);
        var gaps = ameliCips.filter(function (c) { return !myQ[c] && ameliMkt[c].market > 0; })
          .map(function (c) { return ameliMkt[c]; })
          .sort(function (a, b) { return b.market - a.market; }).slice(0, 10);
        var maxGap = gaps.length ? Math.max(gaps[0].market, 1) : 1;
        var gapHtml = gaps.length ? gaps.map(function (r, i) {
          var pct = Math.max(3, r.market / maxGap * 100);
          return '<div class="v2-row" style="cursor:default">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(r.desc) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--c-amber)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono">' + V2.fmtNum(r.market) + '</div>' +
              '<div class="v2-row-meta mono" style="color:var(--c-amber)">non commandé</div>' +
            '</div>' +
          '</div>';
        }).join('') : '<div class="v2-empty"><div class="v2-empty-d">Tu couvres tous les marchés Ameli disponibles.</div></div>';
        ameliCard =
          '<div class="v2-card" style="margin-bottom:14px">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pilo', 17) + 'Pénétration du marché Ameli</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">couverture de gamme</span></div>' +
            '<div class="opso-gauge-track" style="margin-top:2px"><div class="opso-gauge-fill" data-w="' + covBar + '" style="width:0"></div></div>' +
            '<div class="opso-gauge-labels" style="margin-bottom:18px">' +
              '<span class="mono" style="font-size:13px;font-weight:700;color:' + V2.tint(covBar, 30, 60) + '">' + covBar + ' %</span>' +
              '<span style="font-size:12px;color:var(--muted)">' + V2.fmtNum(coveredN) + ' / ' + V2.fmtNum(totalN) + ' produits Ameli commandés</span>' +
            '</div>' +
            '<div class="pilo-ameli-sub">Plus gros marchés Ameli que tu ne commandes pas <span style="color:var(--muted-2)">— volume national</span></div>' +
            gapHtml +
          '</div>';
      }

      // ── Alerte : Top 10 pharmacies en BAISSE (CA décline sur les mois) ──
      // Compare la 2e moitié des mois disponibles à la 1re (moyenne mensuelle).
      var allMonths = availableMonths(sales);
      var mdlCard;
      if (allMonths.length >= 2) {
        var nM = allMonths.length, cut = Math.ceil(nM / 2);
        var earlyK = {}, lateK = {};
        allMonths.forEach(function (m, i) { (i < cut ? earlyK : lateK)[mkey(m.year, m.month)] = 1; });
        var nEarly = cut, nLate = nM - cut;
        var eByPh = {}, lByPh = {};
        sales.forEach(function (s) {
          var k = mkey(s.year, s.month), v = s.mntNetHt || 0;
          if (earlyK[k]) eByPh[s.pharmacyId] = (eByPh[s.pharmacyId] || 0) + v;
          else if (lateK[k]) lByPh[s.pharmacyId] = (lByPh[s.pharmacyId] || 0) + v;
        });
        var decl = Object.keys(eByPh).map(function (id) {
          var em = (eByPh[id] || 0) / nEarly, lm = (lByPh[id] || 0) / nLate;
          return { id: id, em: em, lm: lm, drop: lm - em, pct: em > 0 ? (lm - em) / em * 100 : 0 };
        }).filter(function (r) { return r.em > 0 && r.drop < 0; })
          .sort(function (a, b) { return a.drop - b.drop; }).slice(0, 10);
        var maxDrop = decl.length ? Math.abs(decl[0].drop) : 1;
        var declHtml = decl.map(function (r, i) {
          var pct = maxDrop > 0 ? Math.max(3, Math.abs(r.drop) / maxDrop * 100) : 0;
          return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(r.id) + '\')">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<span class="v2-row-dot" style="background:var(--c-rose)"></span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(pharmaName(r.id)) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--c-rose)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono" style="color:var(--c-rose)">▼ ' + V2.fmtEur(Math.abs(r.drop)) + '/mois</div>' +
              '<div class="v2-row-meta mono">' + r.pct.toFixed(0).replace('-', '−') + ' %</div>' +
            '</div>' +
            '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
          '</a>';
        }).join('');
        mdlCard =
          '<div class="v2-card">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('alert', 17) + 'Pharmacies en baisse · à relancer</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">2nde moitié vs 1ère</span></div>' +
            (declHtml || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie en recul sur la période.</div></div>') +
          '</div>';
      } else {
        mdlCard = '';
      }

      // ── Section OPSO groupement (conditionnelle) ──
      var opsoSect = opso ? buildOpsoSection(cur, prev, pf) : null;

      // ── Segmented period ──
      function seg(mode, lbl) {
        return '<button class="pilo-segbtn' + (PERIOD === mode ? ' on' : '') + '" data-p="' + mode + '">' + lbl + '</button>';
      }
      // sélecteur commercial
      var comms = V2.commercials ? V2.commercials() : [];
      var commSeg = '';
      var cb = function (val, lbl) { return '<button class="pilo-segbtn pilo-commbtn' + ((V2.commFilter || '') === val ? ' on' : '') + '" data-c="' + esc(val) + '">' + esc(lbl) + '</button>'; };
      if (opso) {
        // Mode OPSO (Normandie Pharma) : pas de découpage par commercial Intégral
        commSeg = '';
      } else if (myComm && !voitTous) {
        // Restreint : uniquement son périmètre ou le global national (jamais un collègue nommé)
        commSeg = '<div class="pilo-seg" style="margin-right:8px">' + cb(myComm, 'Moi') + cb('', 'Global national') + '</div>';
      } else if (comms.length > 1) {
        // Super-admin : Tous + chaque commercial
        commSeg = '<div class="pilo-seg" style="margin-right:8px">' + cb('', 'Tous') + comms.map(function (cm) { return cb(cm, cm); }).join('') + '</div>';
      }
      var header =
        '<div class="pilo-head">' +
          '<div>' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub" style="margin-bottom:0">' + (pf ? esc(pf.label) : '') + (V2.commFilter ? ' · ' + esc(V2.commFilter) : (opso ? ' · Groupement OPSO Santé' : ' · ton tableau de bord commercial')) + '</div>' +
            // Un mois écarté doit se DIRE : sinon l'écran a l'air de couvrir
            // une période qu'il ne couvre pas.
            (anc && anc.ecartes.length
              ? '<div class="pilo-ecarte">' + ICO('alert', 13) + esc(phraseEcart(anc)) + '</div>'
              : '') +
          '</div>' +
          '<div style="display:flex;gap:0;flex-wrap:wrap;align-items:center">' + commSeg +
            '<div class="pilo-seg">' + seg('current', 'Dernier mois') + seg('3m', '3 mois') + seg('year', 'Année') + '</div>' +
          '</div>' +
        '</div>';

      // ── Mise en page « épurée » : l'essentiel ouvert, le détail replié ──
      // Bloc dépliable (progressive disclosure) : la page s'ouvre calme,
      // Will déplie seulement ce qu'il veut voir. Natif <details> = zéro JS,
      // respecte prefers-reduced-motion, pas de dépendance.
      function disc(title, hint, body, open) {
        if (!body) return '';
        // ⚠️ L'état ouvert/fermé SURVIT au rendu. Sans ça, changer de période —
        // ou toucher une case de la matrice produits — refermait tous les
        // blocs et renvoyait Will en haut de page. « Ça fait revenir en
        // arrière, c'est chiant. »
        if (OUVERTS[title] != null) open = OUVERTS[title];
        return '<details class="pilo-disc" data-disc="' + esc(title) + '"' + (open ? ' open' : '') + '>' +
            '<summary class="pilo-disc-sum">' +
              '<span class="pilo-disc-t">' + esc(title) + '</span>' +
              (hint ? '<span class="pilo-disc-hint">' + esc(hint) + '</span>' : '') +
              '<span class="pilo-disc-chev">' + ICO('chev', 16) + '</span>' +
            '</summary>' +
            '<div class="pilo-disc-body">' + body + '</div>' +
          '</details>';
      }

      // Détail : répartition du CA (familles + tranches de prix + génériqueurs)
      // `sales` = V2.commSales() → respecte le périmètre commercial (confidentialité).
      var gnqCard = V2.generiqueurCard ? V2.generiqueurCard(sales, { title: 'CA par génériqueur', max: 15 }) : '';
      var repartition = legendeReseau(compare, repereLabel) +
        '<div class="pilo-grid2" data-reveal>' + famCard + tierCard + '</div>' +
        (gnqCard ? '<div data-reveal style="margin-top:14px">' + gnqCard + '</div>' : '');
      // Détail : classements (top pharmacies + groupements)
      var classements = grpCard ? ('<div class="pilo-grid2" data-reveal>' + topCaCard + grpCard + '</div>') : ('<div data-reveal>' + topCaCard + '</div>');
      // Détail : marché Ameli & pharmacies à relancer
      var marche = (ameliCard && mdlCard) ? ('<div class="pilo-grid2" data-reveal>' + ameliCard + mdlCard + '</div>')
        : (ameliCard || mdlCard ? '<div data-reveal>' + (ameliCard || mdlCard) + '</div>' : '');

      // Repères pour les intitulés dépliables (aide à la lecture, pas des objectifs)
      var nbGrp = grpList.length;

      // Le marché France (Medic'AM) — hors OPSO, qui a son propre tableau de bord.
      var marcheFr = opso ? '' : buildMarcheFranceCard(cur);

      // ── Mes produits : matrice secteur × catégorie de prix ──────────
      // « Par secteur » (commercial) n'est proposé qu'en vue réseau : un
      // commercial restreint n'a pas à voir le découpage de ses collègues,
      // même agrégé. Le découpage par département, lui, reste toujours
      // disponible — c'est sa propre géographie.
      // Mode OPSO : pas ce bloc.
      // « Mon secteur » = le commercial actuellement regardé. En vue réseau
      // (« Tous »), il n'y a pas de « moi » : le bloc compare alors le réseau
      // entier à la France, sans ligne « les autres ».
      // ⚠️ CE BLOC NE SUIT PAS LE SÉLECTEUR DE PÉRIODE, et c'est voulu.
      // « Les autres secteurs » n'existe que si les autres secteurs ont des
      // ventes : sur le dernier mois du fichier, deux commerciaux sur huit
      // seulement en ont, la ligne comparerait à une poignée de gens.
      // Le bloc travaille donc sur la fenêtre où le réseau est AU COMPLET —
      // la même que le repère des tranches — et il l'écrit en toutes lettres.
      // C'est une comparaison de STRUCTURE, pas un indicateur de période.
      var monSecteur = V2.commFilter ? String(V2.commFilter) : '';
      var produitsCard = (opso || !reseauComplet || !reseauComplet.length)
        ? '' : buildProduitsCard(reseauComplet, monSecteur, repereLabel);

      var marcheLink = (V2.pages && V2.pages.marche && !opso)
        ? '<a class="pilo-marche" onclick="V2.go(\'marche\')">' + ICO('spark', 17) +
            '<span><b>Marché &amp; opportunités</b><small>Marché France × tes ventes réseau : où pousser quoi, princeps en stock Intégral.</small></span>' +
            '<span class="pilo-marche-go">Ouvrir ' + ICO('chev', 16) + '</span></a>'
        : '';
      root.innerHTML = top +
        '<div class="v2-wrap">' +
          header +
          marcheLink +
          (opsoSect ? opsoSect.html : '') +
          // ── ESSENTIEL, toujours visible : où j'en suis en un coup d'œil ──
          kpis +
          chart.html +
          // ── DÉTAIL, replié par défaut : Will déplie au besoin ──
          disc('Répartition de mon chiffre d\'affaires',
               compare ? 'tranches de prix et familles, avec le repère du réseau' : 'familles de produits et tranches de prix',
               repartition, false) +
          (produitsCard ? disc('Mes produits',
               'quels produits, dans quel secteur, dans quelle catégorie de prix',
               '<div data-reveal id="pilo-prod-host">' + produitsCard + '</div>', false) : '') +
          (marcheFr ? disc('Le marché France', 'ce que le pays achète de plus, et de moins', '<div data-reveal>' + marcheFr + '</div>', false) : '') +
          disc('Mes pharmacies', (nbActive ? nbActive + ' active' + (nbActive > 1 ? 's' : '') + ' sur la période' : '') + (nbGrp >= 2 && !opso ? ' · ' + nbGrp + ' groupements' : ''), classements, false) +
          (marche ? disc('Marché Ameli & pharmacies à relancer', 'ce que je ne commande pas encore, et qui décroche', marche, false) : '') +
        '</div>';

      // ── Bind segmented ──
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-segbtn'), function (b) {
        b.onclick = function () {
          if (b.classList.contains('pilo-basebtn')) return;   // géré sans rerendre la page
          if (b.classList.contains('pilo-commbtn')) { V2.commFilter = b.dataset.c || ''; CELL = { t: null }; }
          else { PERIOD = b.dataset.p; }
          V2.render();
        };
      });

      // ── Blocs dépliables : on retient ce que Will laisse ouvert ─────
      Array.prototype.forEach.call(root.querySelectorAll('details.pilo-disc'), function (d) {
        d.addEventListener('toggle', function () { OUVERTS[d.dataset.disc] = d.open; });
      });

      // ── Matrice produits : case, ligne, colonne, remise à zéro ──────
      // ⚠️ ON NE RERENDRE PAS LA PAGE. Un V2.render() complet refermerait les
      // blocs, remonterait en haut, et coûterait un rendu entier pour changer
      // une liste. Seule la carte produits se refait, à sa place.
      // Un deuxième appui sur la même case la relâche : sinon on se retrouve
      // enfermé dans une sélection sans savoir comment en sortir.
      var hote = root.querySelector('#pilo-prod-host');
      function brancherProduits() {
        if (!hote) return;
        Array.prototype.forEach.call(hote.querySelectorAll('button.pilo-cmp-ch'), function (b) {
          b.onclick = function () {
            var nt = +b.dataset.t;
            CELL = { t: (CELL.t === nt ? null : nt) };   // deuxième appui = on relâche
            refaireProduits();
          };
        });
        Array.prototype.forEach.call(hote.querySelectorAll('.pilo-basebtn'), function (b) {
          b.onclick = function () { BASE = b.dataset.base; refaireProduits(); };
        });
        var raz = hote.querySelector('.pilo-prod-raz');
        if (raz) raz.onclick = function () { CELL = { t: null }; refaireProduits(); };
      }
      function refaireProduits() {
        if (!hote) return;
        hote.innerHTML = buildProduitsCard(reseauComplet, monSecteur, repereLabel);
        brancherProduits();
        Array.prototype.forEach.call(hote.querySelectorAll('.pilo-bar-fill'), function (el) {
          el.style.width = (el.dataset.w || 0) + '%';
        });
      }
      brancherProduits();

      // ── Animate bars at mount ──
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          Array.prototype.forEach.call(root.querySelectorAll('.pilo-bar-fill'), function (el) {
            el.style.width = (el.dataset.w || 0) + '%';
          });
          // jauges (activation OPSO + meters KPI + couverture Ameli)
          Array.prototype.forEach.call(root.querySelectorAll('.opso-gauge-fill,.pilo-kpi-meter-fill'), function (el) {
            el.style.width = (el.dataset.w || 0) + '%';
          });
        });
      });

      // ── Reveal au scroll (respecte prefers-reduced-motion) ──
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      var revs = root.querySelectorAll('[data-reveal]');
      if (reduce || !('IntersectionObserver' in window)) {
        Array.prototype.forEach.call(revs, function (el) { el.classList.add('in'); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        Array.prototype.forEach.call(revs, function (el) { io.observe(el); });
      }

      // ── Dépliage : révéler + (re)jouer les barres du contenu à l'ouverture ──
      // Le contenu d'un <details> replié est masqué : l'observer ne le voit pas
      // et les barres ne s'animent pas. On force le rendu propre à la 1ʳᵉ ouverture.
      var _mo = V2.motion;
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-disc'), function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          Array.prototype.forEach.call(d.querySelectorAll('[data-reveal]'), function (el) { el.classList.add('in'); });
          // Révélation douce du contenu à l'ouverture (fondu + léger glissé),
          // sans toucher au <details> ni aux barres animées ci-dessous.
          var body = d.querySelector('.pilo-disc-body');
          if (body && _mo && _mo.enter) _mo.enter(body, { y: 6, duration: 260 });
          requestAnimationFrame(function () {
            Array.prototype.forEach.call(d.querySelectorAll('.pilo-bar-fill'), function (el) { el.style.width = (el.dataset.w || 0) + '%'; });
            Array.prototype.forEach.call(d.querySelectorAll('.opso-gauge-fill,.pilo-kpi-meter-fill'), function (el) { el.style.width = (el.dataset.w || 0) + '%'; });
          });
        });
      });

      // ── Count-up des chiffres clés, déclenché à leur arrivée à l'écran ──
      // L'ENTRÉE (fondu + glissé) des blocs est déjà pilotée par l'observer
      // local du pilotage (classe .in, plus haut). On n'ajoute donc AUCUNE 2ᵉ
      // animation d'entrée ici — sinon double mouvement saccadé. Uniquement le
      // count-up (idempotent via data-mo-counted) : grand CA hero + les 3 KPI.
      if (_mo && _mo.inView && _mo.countUp) {
        var heroV = root.querySelector('.pilo-hero-v[data-count]');
        if (heroV) _mo.inView(heroV, function (el) { _mo.countUp(el); });
        var kpis3 = root.querySelector('.pilo-kpis3');
        if (kpis3) _mo.inView(kpis3, function (el) {
          Array.prototype.forEach.call(el.querySelectorAll('.v2-kpi-v.mono'), function (n) { _mo.countUp(n); });
        });
      }

      // ── Graphe 13 mois : les barres POUSSENT depuis la base, en cascade ──
      // Même grammaire que la fiche officine (applyPharmaMotion) : scaleY(0→1)
      // uniquement (transform, jamais height), transform-origin base, une seule
      // passe WAAPI, RM-safe (V2.motion pose l'état final sans animation).
      // On anime les BARRES, pas la carte : son entrée reste gérée par le
      // reveal .in de l'observer local — aucune double animation d'entrée.
      // La pousse des barres est désormais dans chart.bind() → homogène Pilotage ↔ fiche officine.
      if (_mo && _mo.stagger) {
        _mo.stagger(root.querySelectorAll('.pilo-chart .pilo-cbar-v'), { step: 45, y: 4, duration: 260, delay: 220 });
        _mo.stagger(root.querySelectorAll('.pilo-kfs .pilo-kf'), { step: 60, y: 6, duration: 280, delay: 340 });
      }

      // ── Bind chart (sélection de mois + pousse + tooltip) ──
      chart.bind(root);
    }
  };

  // ── Mini bar chart CSS 13 mois ────────────────
  // `anc` (optionnel) = résultat d'ancreComplete() sur le même périmètre. Les
  // mois qu'il a écartés restent DESSINÉS — on ne supprime pas de la donnée —
  // mais en gris, sans variation, et hors de la moyenne, du mois record et du
  // compte des mois actifs. Sinon le graphe affiche « −24 % » juste sous un
  // bandeau qui explique que ce mois-là n'est pas comparable.
  // ⚠️ Sans ce 2ᵉ argument, le comportement est celui d'avant : la fiche
  // officine (v2-pharma.js) appelle cette fonction avec un seul argument.
  function build13MonthChart(sales, anc) {
    injectStyles();   // garantit les styles du chart même hors page Pilotage (ex : fiche officine)
    var months = availableMonths(sales);
    if (!months.length) return { html: '', bind: function () {} };
    var last = months[months.length - 1];
    var lastK = mkey(last.year, last.month);
    var MN = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    var MNfull = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    // 13 derniers mois (incl. courant), même sans vente
    var bars = [];
    for (var i = 12; i >= 0; i--) {
      var k = lastK - i;
      var y = Math.floor(k / 12), mo = (k % 12);
      bars.push({ year: y, month: mo + 1, mlabel: MN[mo], full: MNfull[mo], ca: 0 });
    }
    var byK = {};
    bars.forEach(function (b, ix) { byK[mkey(b.year, b.month)] = ix; });
    sales.forEach(function (s) {
      if (!s.month || !s.year) return;
      var ix = byK[mkey(s.year, s.month)];
      if (ix != null) bars[ix].ca += (s.mntNetHt || 0);
    });
    // Retire les mois VIDES en tête (avant le 1er mois avec des ventes) : pas de colonnes fantômes.
    var _f = 0; while (_f < bars.length - 1 && bars[_f].ca <= 0) _f++;
    if (_f > 0) bars = bars.slice(_f);
    // Marque les mois que l'ancre a écartés : présents, mais pas comparables.
    var partiel = 0;
    bars.forEach(function (b) {
      b.partiel = !!(anc && anc.dispo && b.ca > 0 && !anc.dispo[mkey(b.year, b.month)]);
      if (b.partiel) partiel++;
    });
    var maxCa = bars.reduce(function (a, b) { return Math.max(a, b.ca); }, 0) || 1;

    // Repères dérivés des vraies ventes : moyenne (mois actifs), mois record
    var nonEmpty = bars.filter(function (b) { return b.ca > 0 && !b.partiel; });
    var avg = nonEmpty.length ? nonEmpty.reduce(function (a, b) { return a + b.ca; }, 0) / nonEmpty.length : 0;
    var best = null;
    bars.forEach(function (b) { if (b.ca > 0 && !b.partiel && (!best || b.ca > best.ca)) best = b; });

    // Grammaire fiche officine : valeur k€ au-dessus, barre qui pousse depuis
    // la base, mois en dessous. Mois record = seul accent fort ; dernier mois marqué.
    var barsHtml = bars.map(function (b, i) {
      var h = b.ca > 0 ? Math.max(4, b.ca / maxCa * 100) : 0;
      var isLast = (i === bars.length - 1);
      var hot = best && b.year === best.year && b.month === best.month;
      // évolution vs mois précédent (si les deux mois ont des ventes)
      var pc = i > 0 ? bars[i - 1].ca : 0, dchip = '', dtip = '';
      if (b.partiel) {
        dchip = '<span class="pilo-cbar-d part">incomplet</span>';
        dtip = ' · mois incomplet, non comparable';
      } else if (b.ca > 0 && pc > 0 && !bars[i - 1].partiel) {
        var dd = (b.ca - pc) / pc * 100, up = dd >= 0;
        dchip = '<span class="pilo-cbar-d ' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + Math.round(dd) + '%</span>';
        dtip = ' · ' + (up ? '▲ +' : '▼ ') + Math.round(dd) + '% vs mois préc.';
      }
      return '<div class="pilo-cbar' + (hot ? ' pilo-cbar-hot' : '') + (b.partiel ? ' pilo-cbar-part' : '') + (isLast ? ' pilo-cbar-cur' : '') + '" data-i="' + i + '" data-tip="' + esc(cap(b.full) + ' ' + b.year + ' · ' + V2.fmtEur(b.ca) + dtip) + '">' +
        '<span class="pilo-cbar-v mono">' + V2.fmtK(b.ca) + '</span>' + dchip +
        '<div class="pilo-cbar-track">' +
          '<span class="pilo-cbar-fill' + (isLast ? ' cur' : '') + '" style="height:' + h.toFixed(1) + '%"></span>' +
        '</div>' +
        '<span class="pilo-cbar-lbl' + (isLast ? ' on' : '') + '">' + b.mlabel + '</span>' +
      '</div>';
    }).join('');

    // Repères chiffrés sous le graphe (moyenne · meilleur mois · mois actifs),
    // même présentation que le tableau de bord de la fiche officine.
    function kf(l, v) {
      return '<div class="pilo-kf"><span class="pilo-kf-l">' + l + '</span><span class="pilo-kf-v mono">' + v + '</span></div>';
    }
    var kfs =
      '<div class="pilo-kfs">' +
        (avg > 0 ? kf('Moyenne', V2.fmtEur(avg) + '<small>/mois</small>') : '') +
        (best ? kf('Meilleur mois', esc(cap(best.full)) + ' · ' + V2.fmtEur(best.ca)) : '') +
        kf('Mois complets', V2.fmtNum(nonEmpty.length) + '<small>/' + bars.length + '</small>') +
      '</div>';

    var range = cap(bars[0].full) + ' ' + bars[0].year + ' → ' + cap(bars[bars.length - 1].full) + ' ' + bars[bars.length - 1].year;
    var html =
      '<div class="v2-card pilo-chart-card" data-reveal>' +
        '<div class="pilo-chart-head">' +
          '<div class="v2-card-t">' + ICO('pilo', 17) + 'Évolution du CA · ' + bars.length + ' mois</div>' +
          '<span class="pilo-chart-period mono">' + esc(range) + '</span>' +
        '</div>' +
        '<div class="pilo-readout" id="pilo-readout"></div>' +
        '<div class="pilo-hint">Touche un mois pour voir son évolution</div>' +
        '<div class="pilo-chart" id="pilo-chart">' + barsHtml +
          '<div class="pilo-tip" id="pilo-tip"></div>' +
        '</div>' +
        kfs +
      '</div>';

    function bind(root) {
      // révèle le chart même hors page Pilotage (la fiche n'a pas d'observer data-reveal)
      var card = root.querySelector('.pilo-chart-card'); if (card) card.classList.add('in');
      var tip = root.querySelector('#pilo-tip');
      var chartEl = root.querySelector('#pilo-chart');
      var readout = root.querySelector('#pilo-readout');
      var barEls = root.querySelectorAll('.pilo-cbar');
      if (!chartEl) return;

      // ── Barres qui POUSSENT (homogène Pilotage ↔ fiche officine) ──
      var mo = V2.motion || null;
      if (mo && mo.animate) {
        var fills = root.querySelectorAll('.pilo-chart .pilo-cbar-fill');
        for (var cf = 0; cf < fills.length; cf++) {
          mo.animate(fills[cf], [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
            { duration: 460, delay: 120 + Math.min(cf, 12) * 42, easing: mo.ease && mo.ease.out, to: { transform: 'scaleY(1)' } });
        }
      }

      // ── Choisir un mois → encart d'évolution ──
      function selectMonth(i) {
        var b = bars[i]; if (!b) return;
        Array.prototype.forEach.call(barEls, function (el) { el.classList.toggle('sel', (+el.dataset.i) === i); });
        if (!readout) return;
        var prev = i > 0 ? bars[i - 1].ca : 0;
        var evHtml;
        // Un mois incomplet ne se compare à rien : ni au mois d'avant, ni à la
        // moyenne. Afficher « −24 % » sur un mois amputé, c'est inventer une
        // baisse — et l'encart est l'endroit le plus lu du graphe.
        if (b.partiel) {
          evHtml = '<span class="pilo-ro-d mut">mois incomplet · pas de comparaison</span>';
        } else if (b.ca > 0 && prev > 0 && !bars[i - 1].partiel) {
          var up = b.ca >= prev, pct = Math.round(Math.abs((b.ca - prev) / prev * 100));
          evHtml = '<span class="pilo-ro-d ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ +' : '▼ ') + pct + ' % vs mois préc.</span>';
        } else { evHtml = '<span class="pilo-ro-d mut">' + (b.ca > 0 ? 'premier mois' : 'pas de vente') + '</span>'; }
        var avgHtml = (b.ca > 0 && avg > 0 && !b.partiel)
          ? '<span class="pilo-ro-a mono">' + (b.ca >= avg ? '+' : '−') + Math.round(Math.abs((b.ca - avg) / avg * 100)) + ' % vs moyenne</span>' : '';
        readout.innerHTML = '<span class="pilo-ro-m">' + esc(cap(b.full) + ' ' + b.year) + '</span>' +
          '<span class="pilo-ro-v mono">' + V2.fmtEur(b.ca) + '</span>' + evHtml + avgHtml;
      }
      Array.prototype.forEach.call(barEls, function (el) {
        el.addEventListener('click', function () { selectMonth(+el.dataset.i); });
      });
      // Défaut = dernier mois COMPLET. À l'ouverture, l'encart doit porter un
      // chiffre comparable ; les mois incomplets restent cliquables.
      var defI = bars.length - 1;
      while (defI > 0 && bars[defI].partiel) defI--;
      if (defI > 0 && bars[defI].ca > 0 && bars[defI - 1].ca > 0 && bars[defI].ca < bars[defI - 1].ca * 0.4) defI = defI - 1;
      selectMonth(defI);

      // ── Tooltip au survol (conservé) ──
      if (tip) {
        Array.prototype.forEach.call(barEls, function (el) {
          var show = function () {
            tip.textContent = el.dataset.tip; tip.classList.add('show');
            var cr = chartEl.getBoundingClientRect(), er = el.getBoundingClientRect();
            var x = er.left - cr.left + er.width / 2;
            tip.style.left = Math.min(Math.max(x, 70), cr.width - 70) + 'px';
          };
          el.addEventListener('mouseenter', show);
          el.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
        });
        chartEl.addEventListener('pointerleave', function () { tip.classList.remove('show'); });
      }
    }
    return { html: html, bind: bind };
  }

  // ── Styles spécifiques pilotage (one-time) ────
  function injectStyles() {
    if (document.getElementById('pilo-styles')) return;
    var css =
      // ── Voix data (signature n°1) : tout chiffre mono, tabular, aligné ──
      '.pilo-vals .mono,.pilo-fam-v .mono,.pilo-rank,.pilo-cbar-lbl,.pilo-cbar-v,.pilo-kf-v,.pilo-chart-period,.pilo-tier-meta,.pilo-tip,.opso-chip-n,.opso-perim-nums .mono,.opso-gauge-labels .mono{font-feature-settings:"tnum" 1,"lnum" 1;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.02em}' +
      '.pilo-vals .v2-row-val,.pilo-vals .v2-row-meta{font-variant-numeric:tabular-nums lining-nums}' +
      '.pilo-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}' +
      '.pilo-seg{display:inline-flex;flex-wrap:wrap;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:4px;box-shadow:var(--sh-1)}' +'@media(max-width:560px){.pilo-head>div:last-child{width:100%}.pilo-seg{width:100%;justify-content:flex-start}}' +
      '.pilo-segbtn{border:none;background:transparent;border-radius:9px;padding:8px 15px;font-family:var(--font);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:.18s var(--ease);white-space:nowrap}' +
      '.pilo-segbtn:hover{color:var(--ip-ink)}' +
      '.pilo-segbtn.on{background:var(--ip-blue);color:#fff;box-shadow:0 2px 8px rgba(0,80,230,.28)}' +
      '.pilo-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}' +
      '@media(max-width:820px){.pilo-grid2{grid-template-columns:1fr}}' +
      // ── HERO KPI (CA net = héros) ─────────────────
      '.pilo-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;' +
        'background:linear-gradient(120deg,color-mix(in srgb,var(--ip-blue) 6%,var(--card)),var(--card) 62%);' +
        'border:1px solid color-mix(in srgb,var(--ip-blue) 20%,var(--line));border-radius:var(--r-card);' +
        'padding:24px 26px;margin-bottom:14px;box-shadow:var(--sh-2);overflow:hidden}' +
      '.pilo-hero::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;' +
        'background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d))}' +
      '.pilo-hero-main{min-width:0}' +
      '.pilo-hero-l{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700}' +
      '.pilo-hero-v{font-family:var(--mono);font-size:clamp(34px,6vw,46px);font-weight:700;letter-spacing:-.035em;line-height:1.02;margin-top:8px;color:var(--ip-ink)}' +
      '.pilo-hero-delta{margin-top:8px}.pilo-hero-delta .v2-kpi-d{font-size:13px}' +
      '.pilo-hero-trend{flex-shrink:0;text-align:right}' +
      '.pilo-hero-trend-t{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);font-weight:700;margin-bottom:6px}' +
      '@media(max-width:560px){.pilo-hero{padding:20px 20px}.pilo-hero-trend{text-align:left}.pilo-hero .pilo-spark{width:100%}}' +
      // sparklines
      '.pilo-spark{display:block;overflow:visible}' +
      '.pilo-spark-line{stroke-dasharray:520;stroke-dashoffset:520;animation:pilo-draw 1s var(--mo-ease-in) forwards}' +
      '@keyframes pilo-draw{to{stroke-dashoffset:0}}' +
      // KPI secondaires : 3 colonnes + mini-jauge
      '.pilo-kpis3{grid-template-columns:repeat(3,1fr)}' +
      '@media(max-width:720px){.pilo-kpis3{grid-template-columns:1fr}}' +
      '.pilo-kpis3 .v2-kpi{display:flex;flex-direction:column}' +
      '.pilo-kpi-meter{height:5px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;margin-top:10px;box-shadow:inset 0 1px 1px rgba(16,19,28,.05)}' +
      '.pilo-kpi-meter-fill{display:block;height:100%;border-radius:999px;transition:width var(--mo-dur) var(--mo-ease-in)}' +
      // reveal au scroll
      '[data-reveal]{opacity:0;transform:translateY(14px);transition:opacity .5s var(--mo-ease-in),transform .5s var(--mo-ease-in)}' +
      '[data-reveal].in{opacity:1;transform:none}' +
      '@media(prefers-reduced-motion:reduce){[data-reveal]{opacity:1;transform:none;transition:none}.pilo-spark-line{animation:none;stroke-dashoffset:0}}' +
      '.pilo-rank{color:var(--muted-2);font-size:12px;width:18px;flex-shrink:0;text-align:center}' +
      '.pilo-vals{text-align:right;flex-shrink:0}' +
      // progress bars (horizontales) — track creux, signature de profondeur par ton
      '.pilo-bar{margin-top:6px;height:5px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;box-shadow:inset 0 1px 1px rgba(16,19,28,.05)}' +
      '.pilo-bar-fill{display:block;height:100%;border-radius:999px;transition:width var(--mo-dur) var(--mo-ease-in)}' +
      // familles
      '.pilo-fam{margin-bottom:15px}.pilo-fam:last-child{margin-bottom:2px}' +
      '.pilo-fam-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;font-size:13.5px}' +
      '.pilo-fam-l{display:flex;align-items:center;gap:8px;font-weight:600;min-width:0;flex:1}' +
      '.pilo-fam-ico{display:inline-flex;align-items:center}' +
      // `flex:none` + `nowrap` : sans eux, « 4,33 – 468 € · intermédiaires »
      // poussait le « € » de sa valeur à la ligne suivante sur iPhone.
      '.pilo-fam-v{display:flex;align-items:baseline;gap:9px;flex:none;white-space:nowrap}' +
      '.pilo-fam-pct{font-size:11.5px;color:var(--muted)}' +
      // ── Repère réseau sur la barre + ligne d'écart ─────────────
      '.pilo-legende{font-size:11.5px;line-height:1.45;color:var(--muted);margin:0 0 14px;max-width:52ch}' +
      '.pilo-legende-vide{color:var(--c-amber-txt,#9A5B12);font-weight:600}' +
      '.pilo-bar{position:relative}' +
      '.pilo-bar.cmp{height:8px}' +
      // Le trait « réseau ». Pas de backdrop-filter, pas de mix-blend : il doit
      // rester visible sur la barre pleine comme sur le fond creux, sous Safari.
      '.pilo-ref{position:absolute;top:0;bottom:0;width:2px;border-radius:2px;background:var(--ip-ink);opacity:.55;transform:translateX(-1px);pointer-events:none}' +
      '.pilo-ecart{font-weight:700;letter-spacing:-.01em}' +
      '.pilo-ecart.up{color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-ecart.dn{color:var(--c-rose-txt,#C7283D)}' +
      '.pilo-ecart.eq{color:var(--muted)}' +
      // ── Mois écarté (fichier de ventes arrêté en cours de mois) ─
      '.pilo-ecarte{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;font-weight:600;color:var(--c-amber-txt,#9A5B12)}' +
      '.pilo-ecarte svg{flex-shrink:0}' +
      // ── Le marché France ───────────────────────────────────────
      '.pilo-mf{padding:18px 20px}' +
      '.pilo-mf-expo{display:flex;flex-wrap:wrap;gap:6px 22px;margin:2px 0 18px;font-size:13px;color:var(--ip-ink-2);line-height:1.5}' +
      '.pilo-mf-expo b{font-variant-numeric:tabular-nums lining-nums;font-weight:800}' +
      '.pilo-mf-expo b.up{color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-mf-expo b.dn{color:var(--c-rose-txt,#C7283D)}' +
      '.pilo-mf-src{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:12px}' +
      // ⚠️ `min-width:0` sur les colonnes : sans lui, une désignation produit
      // sans espace (« EFFERALGANMED 1000MG C.EFFV T8 ») pousse la colonne
      // au-delà de sa part et la valeur de droite sort de la carte.
      '.pilo-mf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 26px}' +
      '.pilo-mf-col{min-width:0}' +
      '@media(max-width:900px){.pilo-mf-grid{grid-template-columns:1fr;gap:22px}}' +
      '.pilo-mf-h{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;font-size:13px;font-weight:800;letter-spacing:-.01em;padding-bottom:9px;margin-bottom:4px;border-bottom:2px solid var(--line-strong)}' +
      '.pilo-mf-h-moi{flex:none;font-size:11px;font-weight:700;color:var(--muted);text-align:right;letter-spacing:0}' +
      '.pilo-mf-h-moi small{display:block;font-size:10px;font-weight:500;color:var(--muted-2);margin-top:1px}' +
      '.pilo-mf-h small{display:block;font-size:11px;font-weight:500;color:var(--muted);margin-top:2px;letter-spacing:0}' +
      '.pilo-mf-h.up{border-bottom-color:color-mix(in srgb,#0F7A52 45%,transparent);color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-mf-h.dn{border-bottom-color:color-mix(in srgb,#C7283D 45%,transparent);color:var(--c-rose-txt,#C7283D)}' +
      '.pilo-mf-row{display:flex;align-items:flex-start;gap:11px;padding:10px 0;border-bottom:1px solid var(--line-2)}' +
      '.pilo-mf-row:last-child{border-bottom:none}' +
      '.pilo-mf-pct{flex:none;width:74px;font-size:12.5px;font-weight:800;padding-top:1px;letter-spacing:-.02em}' +
      '.pilo-mf-pct.up{color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-mf-pct.dn{color:var(--c-rose-txt,#C7283D)}' +
      '.pilo-mf-main{flex:1;min-width:0}' +
      '.pilo-mf-nom{display:block;font-size:13px;font-weight:600;color:var(--ip-ink);line-height:1.3;overflow-wrap:anywhere}' +
      '.pilo-mf-meta{display:block;font-size:10.5px;color:var(--muted-2);margin-top:3px}' +
      '.pilo-mf-stk{display:inline-block;margin-left:7px;padding:1px 6px;border-radius:999px;background:color-mix(in srgb,var(--ip-blue) 9%,transparent);color:var(--ip-blue);font-weight:700;letter-spacing:0}' +
      '.pilo-mf-moi{flex:none;text-align:right;min-width:92px}' +
      '.pilo-mf-moi b{display:block;font-size:13px;font-weight:700;color:var(--ip-ink);letter-spacing:-.02em}' +
      '.pilo-mf-moi b.zero{font-size:11.5px;font-weight:600;color:var(--c-amber-txt,#9A5B12)}' +
      '.pilo-mf-moi small{display:block;font-size:10.5px;color:var(--muted-2);margin-top:2px}' +
      '.pilo-mf-more{margin-top:6px}' +
      '.pilo-mf-more>summary{display:flex;align-items:center;min-height:44px;cursor:pointer;list-style:none;font-size:12.5px;font-weight:700;color:var(--ip-blue)}' +
      '.pilo-mf-more>summary::-webkit-details-marker{display:none}' +
      '.pilo-mf-note{margin-top:16px;padding-top:13px;border-top:1px solid var(--line);font-size:11px;line-height:1.55;color:var(--muted-2)}' +
      '@media(max-width:480px){.pilo-mf-pct{width:64px;font-size:11.5px}.pilo-mf-moi{min-width:76px}}' +
      // ── Comparatif « mon secteur / les autres / la France » ────
      '.pilo-prod{padding:18px 20px}' +
      '.pilo-prod-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}' +
      '.pilo-prod-t{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)}' +
      '.pilo-axeseg{box-shadow:none}' +
      '.pilo-axebtn,.pilo-basebtn{padding:6px 12px;font-size:12.5px}' +
      // Le tableau défile DANS son cadre : la page, elle, ne défile jamais
      // latéralement — c'est la règle iPhone.
      '.pilo-cmp-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}' +
      '.pilo-cmp{min-width:520px}' +
      '.pilo-cmp-r{display:grid;grid-template-columns:150px repeat(var(--cols),1fr);gap:5px;align-items:stretch;margin-bottom:5px}' +
      '.pilo-cmp-head{margin-bottom:7px}' +
      '.pilo-cmp-h{display:flex;flex-direction:column;justify-content:center;gap:1px;padding:6px 9px 6px 0;min-width:0}' +
      '.pilo-cmp-hn{font-size:13px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.pilo-cmp-hs{font-size:10.5px;color:var(--muted-2)}' +
      '.pilo-cmp-hv{font-size:10.5px;color:var(--muted);font-weight:700;margin-top:2px}' +
      '.pilo-cmp-ch{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;border:1px solid transparent;border-radius:9px;background:transparent;font-family:var(--font);cursor:pointer;text-align:left;min-height:44px;justify-content:center;transition:background .15s var(--ease),border-color .15s var(--ease)}' +
      '.pilo-cmp-ch:hover{background:var(--card-2);border-color:var(--line)}' +
      '.pilo-cmp-ch.vise{background:var(--halo);border-color:color-mix(in srgb,var(--ip-blue) 26%,transparent)}' +
      '.pilo-mx-dot{width:8px;height:8px;border-radius:3px;flex-shrink:0}' +
      '.pilo-mx-cl{font-size:11.5px;font-weight:700;color:var(--ip-ink);white-space:nowrap}' +
      '.pilo-mx-cs{font-size:10px;color:var(--muted-2);white-space:nowrap}' +
      '.pilo-cmp-c{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:52px;padding:6px;border:1px solid var(--line);border-radius:10px;transition:opacity .15s var(--ease)}' +
      '.pilo-cmp-c.pale{opacity:.34}' +
      '.pilo-cmp-c.fort{border-color:color-mix(in srgb,var(--ip-blue) 26%,var(--line))}' +
      '.pilo-cmp-p{font-size:14px;font-weight:800;color:var(--ip-ink);letter-spacing:-.02em}' +
      '.pilo-cmp-e{font-size:10px;font-weight:700}' +
      '.pilo-cmp-e.up{color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-cmp-e.dn{color:var(--c-rose-txt,#C7283D)}' +
      // La ligne France est la référence : trait plein au-dessus, jamais un accent de couleur.
      '.pilo-cmp-r.fr{margin-top:9px;padding-top:9px;border-top:1px solid var(--line-strong)}' +
      '.pilo-cmp-r.fr .pilo-cmp-p{color:var(--muted)}' +
      '.pilo-cmp-note{margin-top:14px;font-size:11.5px;line-height:1.55;color:var(--muted-2);max-width:78ch}' +
      '.pilo-cmp-note b{color:var(--muted);font-weight:700}' +
      // séparateur + liste produits
      '.pilo-prod-sep{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:20px 0 4px;padding-top:15px;border-top:1px solid var(--line)}' +
      '.pilo-prod-lt{font-size:13.5px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.pilo-prod-lc{font-size:11.5px;color:var(--muted);flex:1}' +
      '.pilo-prod-raz{border:1px solid var(--line);background:var(--card);border-radius:9px;padding:6px 11px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--ip-blue);cursor:pointer;min-height:32px}' +
      '.pilo-prod-raz:hover{border-color:var(--ip-blue)}' +
      '.pilo-pr{display:flex;align-items:flex-start;gap:11px;padding:11px 0;border-bottom:1px solid var(--line-2)}' +
      '.pilo-pr:last-child{border-bottom:none}' +
      '.pilo-pr-main{flex:1;min-width:0}' +
      '.pilo-pr-n{font-size:13.5px;font-weight:600;color:var(--ip-ink);line-height:1.3;overflow-wrap:anywhere}' +
      '.pilo-pr-n small{display:block;font-size:10.5px;font-weight:500;color:var(--c-amber-txt,#9A5B12);margin-top:1px}' +
      '.pilo-pr-anon{font-weight:700;color:var(--muted)}' +
      '.pilo-pr-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:6px;font-size:10.5px;color:var(--muted-2)}' +
      '.pilo-pr-tag{display:inline-flex;align-items:center;gap:5px;font-weight:700}' +
      '.pilo-pr-fr{font-weight:700;cursor:help}' +
      '.pilo-prod-reste{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;line-height:1.5;color:var(--muted-2)}' +
      '.pilo-pr-fr.up{color:var(--c-mint-txt,#0F7A52)}' +
      '.pilo-pr-fr.dn{color:var(--c-rose-txt,#C7283D)}' +
      '@media(max-width:560px){.pilo-prod{padding:16px 14px}.pilo-cmp-r{grid-template-columns:118px repeat(var(--cols),1fr)}}' +
      // tranches de prix
      // Mois incomplet : dessiné, mais visiblement mis de côté (gris, hachuré).
      '.pilo-cbar-part .pilo-cbar-fill{background:var(--line-strong)!important;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)}' +
      '.pilo-cbar-part .pilo-cbar-v,.pilo-cbar-part .pilo-cbar-lbl{color:var(--muted-2)}' +
      '.pilo-cbar-d.part{color:var(--muted-2);background:var(--card-2);font-weight:600}' +
      '.pilo-tier-dot{display:inline-block;width:9px;height:9px;border-radius:3px;flex-shrink:0}' +
      '.pilo-fam-l{flex-wrap:wrap;gap:4px 8px}' +
      '.pilo-tier-lbl{white-space:nowrap}' +
      '.pilo-tier-sub{color:var(--muted);font-weight:500;font-size:11.5px;white-space:nowrap}' +
      '.pilo-tier-meta{font-size:10.5px;color:var(--muted-2);margin-top:4px}' +
      '.pilo-ameli-sub{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px;letter-spacing:.005em}' +
      // ── Blocs dépliables (progressive disclosure) : le détail reste calme et rangé ──
      '.pilo-marche{display:flex;align-items:center;gap:12px;margin-top:var(--sp-4,16px);padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-card,14px);background:var(--card);box-shadow:var(--sh-1);cursor:pointer;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}' +
      '.pilo-marche:hover{border-color:var(--ip-blue,#0057FF);transform:translateY(-1px)}' +
      '.pilo-marche>svg:first-child{color:var(--ip-blue,#0057FF);flex-shrink:0}' +
      '.pilo-marche span:nth-child(2){flex:1;min-width:0}' +
      '.pilo-marche b{display:block;font-size:14.5px;font-weight:700}' +
      '.pilo-marche small{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4}' +
      '.pilo-marche-go{display:inline-flex;align-items:center;gap:3px;font-size:13px;font-weight:700;color:var(--ip-blue,#0057FF);white-space:nowrap}' +
      '.pilo-disc{margin-top:var(--sp-4);border:1px solid var(--line);border-radius:var(--r-card);background:var(--card);box-shadow:var(--sh-1);overflow:hidden}' +
      '.pilo-disc[open]{box-shadow:var(--sh-2)}' +
      '.pilo-disc-sum{display:flex;align-items:center;gap:12px;padding:17px 20px;cursor:pointer;list-style:none;user-select:none;transition:background .16s var(--ease)}' +
      '.pilo-disc-sum::-webkit-details-marker{display:none}' +
      '.pilo-disc-sum:hover{background:var(--card-2)}' +
      '.pilo-disc-t{font-size:15px;font-weight:700;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.pilo-disc-hint{font-size:12.5px;color:var(--muted);font-weight:500;flex:1;min-width:0}' +
      '.pilo-disc-chev{margin-left:auto;color:var(--muted-2);display:inline-flex;flex-shrink:0;transition:transform .2s var(--mo-ease-soft)}' +
      '.pilo-disc[open] .pilo-disc-chev{transform:rotate(90deg)}' +
      '.pilo-disc-body{padding:2px 20px 20px}' +
      '@media(max-width:560px){.pilo-disc-hint{flex:0 0 100%;order:3}.pilo-disc-sum{flex-wrap:wrap;gap:4px 10px}.pilo-disc-body{padding:2px 14px 16px}}' +
      '@media(prefers-reduced-motion:reduce){.pilo-disc-chev{transition:none}}' +
      // ── Chart 13 mois : la pièce maîtresse (grammaire fiche officine) ──
      '.pilo-chart-card{padding:20px 22px 18px;margin-bottom:14px}' +
      '@media(max-width:640px){.pilo-chart-card{padding:16px 14px}}' +
      '.pilo-chart-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}' +
      '.pilo-chart-period{font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}' +
      // ── Encart d\'évolution du mois choisi (sélection sur le graphe) ──
      '.pilo-readout{display:flex;align-items:center;flex-wrap:wrap;gap:8px 13px;margin:14px 0 4px;padding:11px 15px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}' +
      '.pilo-ro-m{font-size:13.5px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em;text-transform:capitalize}' +
      '.pilo-ro-v{font-size:16px;font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums}' +
      '.pilo-ro-d{font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px}' +
      '.pilo-ro-d.up{color:var(--c-mint-txt,#0F7A52);background:color-mix(in srgb,#0F7A52 12%,transparent)}' +
      '.pilo-ro-d.dn{color:var(--c-rose-txt,#C7283D);background:color-mix(in srgb,#C7283D 12%,transparent)}' +
      '.pilo-ro-d.mut{color:var(--muted);background:var(--card)}' +
      '.pilo-ro-a{margin-left:auto;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}' +
      '.pilo-hint{font-size:10.5px;color:var(--muted-2,#9AA1B2);font-weight:600;margin:0 0 8px 2px}' +
      '.pilo-cbar{cursor:pointer;transition:transform .15s var(--ease)}' +
      '.pilo-cbar:hover{transform:translateY(-2px)}' +
      '.pilo-cbar.sel .pilo-cbar-track{box-shadow:0 0 0 2px var(--ip-blue),0 0 0 5px color-mix(in srgb,var(--ip-blue) 16%,transparent)}' +
      '.pilo-cbar.sel .pilo-cbar-lbl{color:var(--ip-blue);font-weight:800}' +
      '.pilo-cbar.sel .pilo-cbar-v{color:var(--ip-blue)}' +
      '.pilo-chart{position:relative;display:flex;align-items:flex-end;gap:8px;height:196px}' +
      '@media(max-width:640px){.pilo-chart{gap:5px;height:168px}}' +
      '.pilo-cbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;cursor:default;min-width:0}' +
      '.pilo-cbar-v{font-size:10.5px;font-weight:700;color:var(--muted);white-space:nowrap}' +
      '.pilo-cbar-d{font-size:9px;font-weight:800;line-height:1;white-space:nowrap;margin-top:1px}' +
      '.pilo-cbar-d.up{color:#0F7A52}.pilo-cbar-d.dn{color:#E0556E}' +
      '@media(max-width:640px){.pilo-cbar-d{display:none}}' +
      '@media(max-width:640px){.pilo-cbar-v{visibility:hidden}.pilo-cbar-hot .pilo-cbar-v,.pilo-cbar-cur .pilo-cbar-v{visibility:visible}}' +
      '.pilo-cbar-track{flex:1;width:100%;max-width:40px;display:flex;align-items:flex-end;background:var(--line-2);border-radius:8px 8px 3px 3px;overflow:hidden}' +
      '.pilo-cbar-fill{display:block;width:100%;border-radius:8px 8px 3px 3px;transform-origin:50% 100%;' +
        'background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 46%,#fff),color-mix(in srgb,var(--ip-blue) 78%,#fff));transition:background .18s var(--ease)}' +
      '.pilo-cbar:hover .pilo-cbar-fill{background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 62%,#fff),var(--ip-blue))}' +
      /* dernier mois : accent soutenu + libellé bleu */
      '.pilo-cbar-fill.cur{background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 80%,#fff),var(--ip-blue))}' +
      /* mois record : SEUL accent fort du graphe (hiérarchie calme) */
      '.pilo-cbar-hot .pilo-cbar-fill,.pilo-cbar-hot:hover .pilo-cbar-fill{background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d));box-shadow:0 2px 8px color-mix(in srgb,var(--ip-blue) 32%,transparent)}' +
      '.pilo-cbar-hot .pilo-cbar-v{color:var(--ip-blue);font-weight:800}' +
      '.pilo-cbar-hot .pilo-cbar-lbl{color:var(--ip-ink);font-weight:700}' +
      '@media(prefers-reduced-motion:reduce){.pilo-bar-fill,.opso-gauge-fill,.pilo-kpi-meter-fill{transition:none}}' +
      '.pilo-cbar-lbl{font-size:10.5px;color:var(--muted);font-weight:600;font-family:var(--mono)}' +
      '.pilo-cbar-lbl.on{color:var(--ip-blue);font-weight:700}' +
      /* repères dérivés sous le graphe (moyenne · meilleur mois · mois actifs) */
      '.pilo-kfs{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}' +
      '.pilo-kf{flex:1;min-width:110px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:9px 12px}' +
      '.pilo-kf-l{display:block;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);white-space:nowrap}' +
      '.pilo-kf-v{display:block;font-size:14.5px;font-weight:800;letter-spacing:-.01em;margin-top:3px;color:var(--ip-ink)}' +
      '.pilo-kf-v small{font-size:10.5px;color:var(--muted);font-weight:600}' +
      '.pilo-tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--ip-ink);color:#fff;font-size:12px;font-weight:600;' +
        'padding:7px 11px;border-radius:9px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:var(--sh-pop);z-index:5;font-family:var(--mono)}' +
      '.pilo-tip.show{opacity:1}' +
      // ── OPSO section ──────────────────────────────
      '.opso-section{margin-bottom:10px}' +
      '.opso-section-head{display:flex;align-items:center;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;' +
        'font-weight:700;color:var(--ip-blue);margin-bottom:14px;padding:0 2px}' +
      '.opso-act-body{display:flex;flex-direction:column;gap:18px}' +
      '.opso-gauge-track{height:10px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;margin-bottom:8px;box-shadow:inset 0 1px 2px rgba(16,19,28,.06)}' +
      '.opso-gauge-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--ip-blue),var(--ip-blue-d));transition:width var(--mo-dur) var(--mo-ease-in)}' +
      '.opso-gauge-labels{display:flex;align-items:center;justify-content:space-between}' +
      '.opso-act-chips{display:flex;gap:12px;flex-wrap:wrap}' +
      '.opso-chip-stat{flex:1;min-width:80px;background:var(--card-2);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-align:center}' +
      '.opso-chip-stat.active{border-color:color-mix(in srgb,var(--ip-blue) 30%,var(--line));background:color-mix(in srgb,var(--ip-blue) 5%,var(--card))}' +
      '.opso-chip-stat.prospect{border-color:color-mix(in srgb,var(--c-amber) 30%,var(--line));background:color-mix(in srgb,var(--c-amber) 5%,var(--card))}' +
      '.opso-chip-n{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--ip-ink)}' +
      '.opso-chip-l{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:3px}' +
      '.opso-chip-stat.active .opso-chip-n{color:var(--ip-blue)}' +
      '.opso-chip-stat.prospect .opso-chip-n{color:var(--c-amber)}' +
      '.opso-kpi-grp{grid-template-columns:repeat(2,1fr) !important}' +
      '@media(max-width:600px){.opso-kpi-grp{grid-template-columns:1fr !important}}' +
      '.opso-perim-row{margin-bottom:16px}.opso-perim-row:last-child{margin-bottom:4px}' +
      '.opso-perim-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}' +
      '.opso-perim-badge{display:inline-flex;align-items:center;padding:4px 11px;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:.01em}' +
      '.opso-perim-nums{display:flex;align-items:center;flex-wrap:wrap}' +
      '.opso-new-tag{display:inline-block;margin-left:6px;vertical-align:middle;font-size:9.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent);border:1px solid color-mix(in srgb,var(--ok) 30%,transparent);border-radius:999px;padding:1px 7px;font-family:var(--mono)}';

    var st = document.createElement('style');
    st.id = 'pilo-styles'; st.textContent = css;
    document.head.appendChild(st);
  }
})();
