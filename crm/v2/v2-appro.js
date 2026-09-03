/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Appro Intégral (V2.pages.appro)
   Outil pour l'équipe ACHATS/APPRO d'Intégral (interne) : voir ce qui
   monte (demande réseau × marché France), anticiper (saison à venir,
   nouveautés, ruptures à sécuriser), et négocier les labos (volume +
   croissance par génériqueur = levier). 100% sur les flux déjà en place,
   aucune dépendance externe.
   Flux : PROD_STATS (réseau), TENDANCE/MOMENTUM/SAISON/NOUVEAUTES (Medic'AM
   + BDPM), AMELI_AVG (marché France), STOCK_IP, RUPTURES, GENERIQUEURS.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var fmt = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(Math.round(n || 0)); };
  var cap = function (s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function tend(c) { return V2.tendance ? V2.tendance(c) : (window.TENDANCE && window.TENDANCE.data ? window.TENDANCE.data[c] : null); }
  function mom(c) { return V2.momentum ? V2.momentum(c) : null; }
  function stock(c) { return V2.stock ? V2.stock(c) : 0; }
  function rupt(c) { return V2.rupture ? V2.rupture(c) : null; }
  function marketFr(c) { return (window.AMELI_AVG && window.AMELI_AVG.data && window.AMELI_AVG.data[String(c)]) || 0; }
  function pctHtml(v) { if (v == null || !isFinite(v)) return '<span class="ap-flat">—</span>'; var s = Math.round(v); return '<span class="' + (s > 0 ? 'ap-up' : s < 0 ? 'ap-down' : 'ap-flat') + '">' + (s > 0 ? '▲ +' : s < 0 ? '▼ ' : '') + s + ' %</span>'; }
  // Carte standard de l'appro (niveau IIFE pour être visible de prixCard/rappelsCard/render — sinon ReferenceError quand une carte hors-render l'appelle).
  function card(ico, title, sub, body, accent) {
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:' + accent + '">' + ICO(ico, 15, 2) + '</div>' +
      '<div><h3>' + title + '</h3><div class="ap-sub">' + sub + '</div></div></div>' + body + '</div>';
  }

  // ── Section 1 : ce qui MONTE (croissance marché × présence réseau) ──
  function rising() {
    var P = window.PROD_STATS || [], out = [];
    for (var i = 0; i < P.length; i++) {
      var r = P[i], g = tend(r.c);
      if (g == null || g < 15 || (r.n || 0) < 20) continue;   // rising & présent dans ≥20 officines réseau
      out.push({ c: r.c, d: r.d, g: g, m: mom(r.c), n: r.n, ca: r.ca || 0, mk: marketFr(r.c), st: stock(r.c), ru: !!rupt(r.c) });
    }
    out.sort(function (a, b) { return b.g - a.g; });
    return out.slice(0, 25);
  }

  // ── Section 2a : ruptures à sécuriser (tension ANSM × demande réseau) ──
  function ruptToSecure() {
    var P = window.PROD_STATS || [], out = [];
    for (var i = 0; i < P.length; i++) {
      var r = P[i], ru = rupt(r.c); if (!ru) continue;
      out.push({ c: r.c, d: r.d, n: r.n || 0, st: stock(r.c), dci: ru.d || '' });
    }
    out.sort(function (a, b) { return b.n - a.n; });   // les plus achetés par le réseau d'abord
    return out.slice(0, 12);
  }

  // ── Section 2b : nouveautés (AMM récente) ──
  function nouveautes() {
    var N = (window.NOUVEAUTES && window.NOUVEAUTES.data) || {}, out = [];
    Object.keys(N).forEach(function (c) { var o = N[c]; if (o && o.n) out.push({ c: c, n: o.n, labo: o.labo || '', amm: o.amm || '' }); });
    out.sort(function (a, b) { return (b.amm || '').localeCompare(a.amm || ''); });   // AMM la plus récente d'abord
    return out.slice(0, 12);
  }

  // ── Section 2c : saison qui arrive (classes ATC2 qui montent le mois prochain) ──
  function saisonNext() {
    var S = (window.SAISON && window.SAISON.data) || {};
    var now = new Date().getMonth(), next = (now + 1) % 12, out = [];
    Object.keys(S).forEach(function (k) {
      var o = S[k]; if (!o || !o.idx) return;
      var vNext = o.idx[next], vNow = o.idx[now];
      if (vNext >= 105) out.push({ code: k, l: o.l || k, now: vNow, next: vNext, delta: vNext - vNow });   // vrai pic au-dessus de la moyenne annuelle
    });
    out.sort(function (a, b) { return b.next - a.next; });
    return { rows: out.slice(0, 8), next: next };
  }

  // ── Section 3 : négo labos — VRAI volume réseau par génériqueur (WML_SALES) ──
  var _negoCache = null, _negoRef = null;
  function negoLabos() {
    var S = window.WML_SALES, G = window.GENERIQUEURS || {};
    if (!S) return [];
    if (_negoCache && _negoRef === S) return _negoCache;   // audit M1 : ne pas re-scanner 426k lignes à chaque render
    var P = window.PROD_STATS || [], ps = {};
    for (var k = 0; k < P.length; k++) ps[String(P[k].c)] = P[k];
    var by = {}, totCa = 0;
    for (var i = 0; i < S.length; i++) {
      var r = S[i], q = r[4] || 0; if (q <= 0) continue;
      var c = String(r[3]), lab = G[c]; if (!lab) continue;
      var o = by[lab] || (by[lab] = { lab: lab, ca: 0, q: 0, cips: {} });
      o.ca += (r[6] || 0); o.q += q; o.cips[c] = (o.cips[c] || 0) + q; totCa += (r[6] || 0);
    }
    var out = Object.keys(by).map(function (lab) {
      var o = by[lab], cips = Object.keys(o.cips);
      var tops = cips.map(function (c) { return { c: c, q: o.cips[c] }; })
        .sort(function (a, b) { return b.q - a.q; }).slice(0, 3)
        .map(function (t) { return ps[t.c] ? ps[t.c].d : t.c; });
      var gs = 0, gn = 0; cips.forEach(function (c) { var g = tend(c); if (g != null) { gs += g; gn++; } });
      return { lab: lab, ca: o.ca, q: o.q, nref: cips.length, g: gn ? gs / gn : null, tops: tops, pct: totCa ? Math.round(o.ca / totCa * 100) : 0 };
    }).sort(function (a, b) { return b.ca - a.ca; });
    _negoCache = out.slice(0, 12); _negoRef = S;
    return _negoCache;
  }

  // ═══ COCKPIT RÉASSORT : croise WML_SALES (vitesse réseau) × STOCK_IP (couverture) ═══
  var MINVEL = 5;      // seuil de bruit : au moins 5 bts/mois réseau pour être « mouvant »
  var CIBLE = 21, CIBLE_TENSION = 30;   // couverture cible en jours (réappro inclus) — relevée si tension/hausse
  // ═══ MÉMOIRE DES COMMANDES DÉJÀ PASSÉES ═══
  // Sans elle, l'outil repropose le lendemain les lignes exportées la veille → double commande.
  // 100 % local au navigateur (aucun serveur), oubli automatique après un cycle d'achat.
  var CMD_KEY = 'jarvis.appro.cmd', CMD_JOURS = 21;
  function cmdLire() {
    try { return JSON.parse(window.localStorage.getItem(CMD_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function marquerCommande(cips, iso) {
    var o = cmdLire();
    for (var i = 0; i < cips.length; i++) o[String(cips[i])] = iso;
    try { window.localStorage.setItem(CMD_KEY, JSON.stringify(o)); } catch (e) {}
    return o;
  }
  function commandeDe(cip, aujourdhui) {
    var d = cmdLire()[String(cip)];
    if (!d) return null;
    var j = Math.round((new Date(aujourdhui + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000);
    return (j >= 0 && j <= CMD_JOURS) ? d : null;
  }

  // Nombre de mois couverts par les exports (WML_MOIS, écrit par le générateur).
  // Les compteurs ci-dessous somment TOUTES les ventes : écrire « 6 mois » en dur
  // affichait une période fausse dès qu'un mois entrait dans la base.
  function nMoisCouverts() { return (window.WML_MOIS && window.WML_MOIS.length) || 6; }

  // ═══ MOIS COMPLETS ═══
  // Le dernier mois d'un export est souvent PARTIEL (toutes les officines n'ont pas encore
  // remonté). Le diviser comme un mois plein sous-évalue la vitesse de vente, donc SURÉVALUE
  // la couverture en jours — l'outil dit « tu as le temps » alors que non.
  // Règle : on ne rogne QUE par la fin, tant que le mois compte moins de 80 % des officines
  // actives des mois retenus. Jamais un mois du milieu (un creux réel n'est pas un trou de
  // données). Plancher à 3 mois pour garder une moyenne qui tienne debout.
  function moisRetenus(S) {
    var off = {}, m, i;
    for (i = 0; i < S.length; i++) {
      m = S[i][1];
      if (m >= 1 && m <= 12) (off[m] || (off[m] = {}))[S[i][0]] = 1;
    }
    var mois = Object.keys(off).map(Number).sort(function (a, b) { return a - b; });
    var nb = function (x) { return Object.keys(off[x]).length; };
    while (mois.length > 3) {
      var dernier = mois[mois.length - 1], reste = mois.slice(0, -1);
      var moy = 0;
      for (i = 0; i < reste.length; i++) moy += nb(reste[i]);
      moy = moy / reste.length;
      if (nb(dernier) >= 0.8 * moy) break;
      mois = reste;
    }
    // ⚠️ Le balayage ci-dessus ne regarde QUE la fin de la série : il retire le dernier
    // mois tant qu'il est partiel. Un mois troué AU MILIEU passait au travers — juin 2026
    // n'avait que 425 officines contre 580 de médiane (73 %), faute des exports de deux
    // commerciaux, et il entrait quand même dans la moyenne. Mesuré le 02/09/2026 : la
    // vitesse réseau s'en trouvait sous-estimée de 4,2 %, donc toutes les couvertures
    // gonflées et les quantités conseillées trop basses.
    // On écarte donc TOUT mois sous 80 % de la médiane, où qu'il soit dans la série —
    // et jamais au point de descendre sous 3 mois d'historique.
    if (mois.length > 3) {
      var tri = mois.map(nb).slice().sort(function (a, b) { return a - b; });
      var med = tri[Math.floor(tri.length / 2)];
      // DEUX conditions, et c'est volontaire : sous 80 % de la médiane ET sous 80 % du
      // mois précédent. Le seul critère de la médiane écartait les premiers mois d'un
      // réseau EN CROISSANCE (300 → 660 officines : janvier et février passaient pour
      // troués alors qu'ils étaient complets). Un vrai trou, lui, est un CREUX : il
      // s'effondre par rapport au mois d'avant. Le premier mois n'a pas de précédent,
      // donc rien ne permet d'y voir une anomalie : on le garde.
      var pleins = mois.filter(function (x, k) {
        if (k === 0) return true;
        return !(nb(x) < 0.8 * med && nb(x) < 0.8 * nb(mois[k - 1]));
      });
      if (pleins.length >= 3) mois = pleins;
    }
    return mois;
  }

  var _cipIdx = null, _cipIdxRef = null, _cipIdxSai = null;

  // Indice saisonnier du mois qu'on est en train de couvrir (saison-cip.json, robot mensuel).
  // Bornes volontaires : les indices bruts montent jusqu'à ×7,1 sur des produits à très
  // petit volume — sans plafond, une commande délirante partirait. Le plancher protège de
  // l'inverse : un indice à 0 (observé aussi) supprimerait tout réassort d'un produit qui
  // se vend vraiment. Un indice absent ou aberrant vaut 1 : on ne touche à rien.
  var SAIS_MIN = 0.6, SAIS_MAX = 1.8;
  function saisonMois(cip, mois0) {
    var s = (_saiCip && _saiCip.data) ? _saiCip.data[String(cip)] : null;
    if (!s || !s.i) return 1;
    var v = s.i[mois0];
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return 1;
    return Math.min(SAIS_MAX, Math.max(SAIS_MIN, v));
  }

  // Index par CIP : demande mensuelle réseau (mois complets) + stock plateforme → vitesse, couverture, qté conseillée.
  // Construit une seule fois et mis en cache (pattern salesByPid de v2-audit.js, transposé cip13).
  function cipIndex() {
    var S = window.WML_SALES;
    if (!S) return {};
    // Le cache dépend AUSSI de la saison : saison-cip.json arrive en différé, et sans
    // cette condition l'index resterait figé sur la version calculée avant son arrivée.
    if (_cipIdx && _cipIdxRef === S && _cipIdxSai === _saiCip) return _cipIdx;
    var P = window.PROD_STATS || [], ps = {};
    for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var stk = (window.STOCK_IP && window.STOCK_IP.data) || {};
    // audit 01/08 : on ne compte QUE les mois complets (le dernier mois d'export est partiel —
    // 425 officines contre 630 en avril — et diluait la vitesse, donc gonflait les couvertures).
    var moisCourant = new Date().getMonth();   // 0-11, le mois que le réassort doit couvrir
    var MR = moisRetenus(S), garde = {}, nMois = MR.length;
    for (var k = 0; k < MR.length; k++) garde[MR[k]] = 1;
    var dem = {};
    for (var j = 0; j < S.length; j++) {
      var r = S[j], q = r[4] || 0, m = r[1];
      if (q <= 0 || !garde[m]) continue;
      var c = String(r[3]), a = dem[c] || (dem[c] = {});
      a[m] = (a[m] || 0) + q;
    }
    function somme(a) { var t = 0; for (var x in a) if (a.hasOwnProperty(x)) t += a[x]; return t; }
    var idx = {};
    // Le dernier stock disponible est traité comme « courant » (Will : l'outil doit marcher comme si les
    // stocks étaient à jour ; le vrai correctif = réimporter le stock régulièrement, pas dégrader l'outil).
    // P1 (audit) : inclure aussi les fast-movers EN RUPTURE plateforme (vendus mais stock 0 = absents de STOCK_IP).
    var keys = {};
    Object.keys(stk).forEach(function (c) { keys[c] = 1; });
    Object.keys(dem).forEach(function (c) { if (somme(dem[c]) / nMois >= MINVEL) keys[c] = 1; });
    Object.keys(keys).forEach(function (c) {
      var a = dem[c], tot = a ? somme(a) : 0;
      var vM = tot / nMois, st = Math.max(0, stk[c] || 0), vD = vM / 30;   // stock borné à 0 (jamais de couverture négative)
      var cov = vD > 0 ? st / vD : (st > 0 ? 9999 : 0);
      var p = ps[c];
      var isRupt = !!rupt(c), tg = tend(c);
      var cibleJ = (isRupt || (tg != null && tg > 0)) ? CIBLE_TENSION : CIBLE;
      // La saison entre ICI, et seulement ici. La couverture `cov` ci-dessus reste sur la
      // vitesse moyenne : c'est une mesure factuelle (stock ÷ vitesse), affichée partout et
      // comparable d'un produit à l'autre. Ce qu'on saisonnalise, c'est la CIBLE : combien
      // il faut tenir pour le mois qui vient, pas combien on tient aujourd'hui.
      var sais = saisonMois(c, moisCourant);
      // Sur un produit EN TENSION ANSM, un creux saisonnier ne doit PAS réduire la
      // commande : c'est justement là qu'une rupture coûte le plus cher, et c'est la
      // raison pour laquelle la cible est passée à 30 jours. Mesuré sans ce garde-fou :
      // Izalgi (tension ANSM) tombait de 8 907 à 7 620 unités à cause d'un août à 0,91.
      // Un pic, lui, continue de faire monter.
      if (isRupt) sais = Math.max(1, sais);
      var qcmd = Math.max(0, Math.round(cibleJ * vD * sais - st));
      idx[c] = { c: c, d: p ? p.d : c, vM: vM, st: st, cov: cov, qcmd: qcmd, nMois: nMois, sais: sais,
        // audit 01/08 : absent de l'inventaire ≠ inventorié à zéro. 791 produits (28 %) sont
        // dans ce cas et passaient pour « déjà à sec » → fausses urgences + € gonflé.
        unk: (stk[c] == null) ? 1 : 0,
        ppht: p ? (p.ppht || 0) : 0, stale: p ? p.stale : 0, rupt: isRupt, f: p ? p.f : '' };
    });
    abcPareto(idx);
    _cipIdx = idx; _cipIdxRef = S; _cipIdxSai = _saiCip;
    return idx;
  }

  // ═══ CLASSEMENT ABC (Pareto) ═══
  // Trie les références par VALEUR de demande réseau (vitesse mensuelle × PPHT) et coupe en 3 :
  //   A = les réfs qui font les 80 premiers % de la valeur · B = jusqu'à 95 % · C = la traîne.
  // Sert à ne JAMAIS traiter un best-seller comme un rossignol (cf. le bug des faux « ALLÉGER »).
  function abcPareto(idx) {
    var ks = Object.keys(idx), tot = 0, i;
    for (i = 0; i < ks.length; i++) { var o = idx[ks[i]]; o._val = (o.vM || 0) * (o.ppht || 0); tot += o._val; }
    ks.sort(function (a, b) { return idx[b]._val - idx[a]._val; });
    var cum = 0;
    for (i = 0; i < ks.length; i++) {
      var x = idx[ks[i]];
      if (tot <= 0) { x.abc = 'C'; continue; }
      cum += x._val;
      var p = cum / tot;
      x.abc = p <= 0.8 ? 'A' : (p <= 0.95 ? 'B' : 'C');
    }
  }
  var ABC_POIDS = { A: 25, B: 15, C: 7 };

  // ═══ SCORE D'URGENCE 0-100 ═══
  // Une seule note, lisible, pour trancher entre deux lignes à commander. Volontairement
  // simple et explicable au téléphone — 4 composantes bornées, additionnées :
  //   • risque de sec (0-45)   : à quel point la couverture est sous la cible
  //   • poids réseau ABC (0-25): un A qui manque coûte plus cher qu'un C
  //   • tension ANSM (0-20)    : rupture déclarée = 20, médicament critique surveillé = 8
  //   • saison (0-10)          : pic saisonnier dans les 3 mois
  function urgence(o, rupt, mitm, seasonUp) {
    var cible = rupt ? CIBLE_TENSION : CIBLE;
    var manque = cible > 0 ? Math.max(0, Math.min(1, 1 - (o.cov || 0) / cible)) : 0;
    // audit 01/08 : sur une réf JAMAIS inventoriée la couverture est une supposition, pas une
    // mesure. On plafonne donc sa part de risque, sinon 801 lignes spéculatives raflaient le
    // score maximum et enterraient les vraies urgences mesurées.
    if (o.unk) manque = Math.min(manque, 0.4);
    var s = 45 * manque + (ABC_POIDS[o.abc] || 7);
    s += rupt ? 20 : (mitm ? 8 : 0);
    if (seasonUp) s += 10;
    return Math.max(0, Math.min(100, Math.round(s)));
  }
  function scoreBadge(n) {
    if (n == null) return '';
    var c = n >= 75 ? '#B02A37' : (n >= 50 ? '#C77700' : '#6B7280');
    var b = n >= 75 ? '#FDE7EA' : (n >= 50 ? '#FFF8EC' : 'var(--card-2,#F6F8FB)');
    return '<span class="ap-tag" title="score d\'urgence sur 100" style="color:' + c + ';background:' + b + ';border:1px solid var(--line)">' + n + '/100</span>';
  }

  // Santé du stock : compteurs de tête (tension / à commander / dormants / capital immobilisé).
  function stockHealth() {
    var idx = cipIndex(), t = 0, a = 0, r = 0, cap = 0, ncmd = 0;
    Object.keys(idx).forEach(function (k) {
      var o = idx[k], mov = o.vM >= MINVEL;
      if (mov && o.cov < 7) t++; else if (mov && o.cov < 21) a++;
      if (o.st > 0 && o.cov > 90) { r++; cap += o.st * o.ppht; }
      if (mov && o.qcmd > 0) ncmd++;
    });
    return { tension: t, acmd: a, ross: r, cap: cap, ncmd: ncmd };
  }

  // Réassort recommandé : produits mouvants à recommander, triés par urgence (couverture croissante).
  function reassort() {
    var idx = cipIndex(), out = [];
    Object.keys(idx).forEach(function (k) { var o = idx[k]; if (o.vM >= MINVEL && o.qcmd > 0 && o.cov <= 90) out.push(o); });
    out.sort(function (a, b) { return a.cov - b.cov; });
    return out.slice(0, 24);
  }

  // Rossignols : stock dormant (couverture > 90 j ou flag stale), trié par capital immobilisé.
  function rossignols() {
    var idx = cipIndex(), out = [];
    Object.keys(idx).forEach(function (k) { var o = idx[k]; if (o.st > 0 && o.cov > 90) { o.cap = o.st * o.ppht; out.push(o); } });
    out.sort(function (a, b) { return b.cap - a.cap; });
    return out.slice(0, 16);
  }

  function covBadge(cov) {
    if (cov >= 9999) return '<span class="ap-cov ko">jamais vendu</span>';
    var cls = cov < 7 ? 'ko' : cov < 21 ? 'wa' : 'ok';
    var lab = cov > 90 ? '90+ j' : Math.round(cov) + ' j';
    return '<span class="ap-cov ' + cls + '">' + lab + '</span>';
  }

  // ═══ RADAR D'ANTICIPATION : événements marché datés (curés + auto à venir) ═══
  var TCOL = { remb: '#0050E6', gen: '#6D5AE6', bio: '#0E7C86', prix: '#C98A1A', sais: '#1E9E6A', rup: '#D5573B', vig: '#6B7280' };
  // Événements réels 2026-2027 (sourcés HAS/ANSM/Légifrance/Le Moniteur). À terme alimentés par robots.
  var EVENTS = [
    { y: 2026, m: 6, d: 15, t: 'remb', ti: 'Wegovy · Mounjaro remboursés', sub: 'demande qui explose, contingentement labo', reco: 'stock sécurité +30 %' },
    { y: 2026, m: 7, d: 20, t: 'gen', ti: 'Apixaban générique (Eliquis)', sub: 'bascule anticoagulant, très gros volume', reco: 'basculer vers les Gx' },
    { y: 2026, m: 6, d: 28, t: 'gen', ti: 'Dapagliflozin générique (Forxiga)', sub: 'falaise SGLT2, classe en forte croissance', reco: 'référencer les Gx' },
    { y: 2026, m: 4, d: 1, t: 'bio', ti: 'Ustekinumab biosimilaire (Stelara)', sub: 'substituable officine, bascule rapide', reco: 'référencer/négocier bio' },
    { y: 2026, m: 9, d: 1, t: 'prix', ti: 'PLFSS 2026 — vague de baisses de prix', sub: '1,4 Md€ : cardio, onco, inflammatoire, neuro', reco: 'alléger le surstock avant' },
    { y: 2026, m: 10, d: 14, t: 'sais', ti: 'Campagne vaccinale grippe / Covid', sub: 'pic d’achat vaccins oct.-nov.', reco: 'pré-stock avant l’ouverture' },
    { y: 2026, m: 11, d: 1, t: 'sais', ti: 'Saison hivernale ORL / antibiotiques', sub: 'amoxicilline, antipyrétiques — plan hivernal ANSM', reco: 'constituer le stock dès octobre' },
    { y: 2027, m: 1, d: 15, t: 'sais', ti: 'Pré-achat antihistaminiques', sub: 'allergies pollen de plus en plus précoces', reco: 'anticiper dès janvier' },
    { y: 2027, m: 3, d: 31, t: 'sais', ti: 'Clôture précommandes vaccins 27-28', sub: 'deadline d’achat vaccins grippe', reco: 'précommander à temps' },
    { y: 2030, m: 2, d: 1, t: 'vig', ti: 'Vyndaqel (tafamidis) — PAS de Gx avant ~2030', sub: 'exclusivité orpheline + accords labo jusqu’en 2031', reco: 'rester sur le princeps' }
  ];
  function evDays(ev) { var now = new Date(); var t = new Date(ev.y, ev.m - 1, ev.d); return Math.round((t - now) / 86400000); }
  function evZone(ev) { if (ev.t === 'vig') return 'surv'; var dd = evDays(ev); if (dd < -30) return null; if (dd < 8) return 'now'; if (dd < 46) return 'prep'; if (dd < 200) return 'surv'; return null; }   // audit #4 : masquer le vieux passé

  function radarSection(reaTop) {
    var zones = [['now', '#D5573B', 'Agir maintenant', 'à traiter cette semaine'], ['prep', '#C98A1A', 'Préparer', 'sous 30-45 jours'], ['surv', '#1E9E6A', 'Surveiller', '30 à 90 jours']];
    var byZone = { now: [], prep: [], surv: [] };
    EVENTS.forEach(function (ev) { var z = evZone(ev); if (z) byZone[z].push(ev); });
    var nowY = new Date().getFullYear();
    var live = (reaTop || []).slice(0, 4).map(function (o) {
      return '<div class="rev"><div class="rt"><span class="dot" style="background:#D5573B"></span>' + esc(cap(o.d)) + '</div>' +
        '<div class="rs">couverture ' + Math.round(o.cov) + ' j · ' + fmt(Math.round(o.vM)) + '/mois réseau</div>' +
        '<div class="rr">→ commander ~' + fmt(o.qcmd) + '</div></div>';
    }).join('');
    // Nouveaux groupes génériques détectés (robot BDPM, diff mensuel) → événement d'anticipation
    var gn = (_generData && _generData.newGeneric) ? _generData.newGeneric : [];
    var generHtml = gn.slice(0, 5).map(function (g) {
      return '<div class="rev"><div class="rt"><span class="dot" style="background:#6D5AE6"></span>Nouveau générique — ' + esc((g.lib || '').split(',')[0]) + '</div>' +
        '<div class="rs">groupe générique ouvert · ' + esc(g.since || '') + '</div><div class="rr">→ basculer les achats vers le Gx</div></div>';
    }).join('');
    live = generHtml + live;
    return '<div class="rad">' + zones.map(function (z) {
      var evs = byZone[z[0]].map(function (ev) {
        var dd = evDays(ev), lab = dd < 0 ? 'en cours' : (ev.d + ' ' + MOIS[ev.m - 1] + (ev.y > nowY ? ' ' + ev.y : ''));
        return '<div class="rev"><div class="rt"><span class="dot" style="background:' + (TCOL[ev.t] || '#6B7280') + '"></span>' + esc(ev.ti) + '</div>' +
          '<div class="rs">' + lab + ' · ' + esc(ev.sub) + '</div><div class="rr">→ ' + esc(ev.reco) + '</div></div>';
      }).join('');
      var body = (z[0] === 'now' ? live : '') + evs;
      if (!body) body = '<div class="ap-empty">—</div>';
      return '<div class="v2-card rzone" style="--z:' + z[1] + '"><div class="rzh"><span class="ring"></span><div><h3>' + z[2] + '</h3><small>' + z[3] + '</small></div></div>' + body + '</div>';
    }).join('') + '</div>';
  }

  // Ne re-render QUE si l'utilisateur est encore sur l'écran Appro (audit robustesse) :
  // les chargeurs différés (ensure*) résolvent en asynchrone ; sans ce garde, un flux qui
  // arrive après une navigation re-rendrait inutilement une autre page (flicker, travail perdu).
  var _rerenderT = null;
  function approRerender() {
    // Debounce (audit M1) : au chargement ~11 ensure* résolvent en rafale → un seul render au lieu de 11.
    if (_rerenderT) return;
    _rerenderT = setTimeout(function () {
      _rerenderT = null;
      try { if (V2.route && V2.route.name === 'appro' && V2.render) V2.render(); } catch (e) {}
    }, 60);
  }

  // ═══ STOCK PAR ÉTABLISSEMENT (7 sites) + rééquilibrage inter-sites — ETAB_PRICES (NR) ═══
  var _etabState = 0;   // 0 pas tenté · 1 en cours · 2 fini
  function ensureEtab() {
    if (window.ETAB_PRICES) { _etabState = 2; return; }
    if (_etabState) return;
    _etabState = 1;
    var s = document.createElement('script');
    s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260803j'); s.async = false;
    s.onload = function () { _etabState = 2; approRerender(); };
    s.onerror = function () { _etabState = 2; };
    document.head.appendChild(s);
  }
  function siteStock() {
    var EP = window.ETAB_PRICES; if (!EP || !EP.etabs) return null;
    var out = EP.etabs.map(function (e) {
      var P = EP.prices[e.code] || {}, t = 0;
      for (var c in P) { if (P[c] && P[c][1] > 0) t += P[c][1]; }
      return { code: e.code, stock: t };
    });
    var tot = out.reduce(function (a, b) { return a + b.stock; }, 0);
    out.sort(function (a, b) { return b.stock - a.stock; });
    return { sites: out, total: tot };
  }
  function rebalance() {
    var EP = window.ETAB_PRICES; if (!EP || !EP.prices) return [];
    var PS = window.PROD_STATS || [], etabs = EP.etabs.map(function (e) { return e.code; }), out = [];
    for (var k = 0; k < PS.length; k++) {
      var c = String(PS[k].c), per = {}, tot = 0, nz = 0, mx = 0, mxE = null;
      for (var j = 0; j < etabs.length; j++) {
        var e = etabs[j], v = (EP.prices[e] && EP.prices[e][c]) ? Math.max(0, EP.prices[e][c][1]) : 0;
        per[e] = v; if (v > 0) { tot += v; nz++; } if (v > mx) { mx = v; mxE = e; }
      }
      if (tot < 20 || nz < 2) continue;
      var conc = mx / tot, zeros = etabs.filter(function (e) { return per[e] === 0; }).length;
      if (conc > 0.55 && zeros >= 1) out.push({ d: PS[k].d, per: per, tot: tot, mxE: mxE, conc: conc, zeros: zeros });
    }
    out.sort(function (a, b) { return b.tot - a.tot; });
    return out.slice(0, 10);
  }
  function etabSection() {
    if (!window.ETAB_PRICES) {
      return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">▤</div><div><h3>Stock par établissement</h3><div class="ap-sub">chargement des stocks des 7 sites…</div></div></div></div>';
    }
    var ss = siteStock(), reb = rebalance(), etabs = window.ETAB_PRICES.etabs.map(function (e) { return e.code; });
    var mx = 0; ss.sites.forEach(function (s) { if (s.stock > mx) mx = s.stock; });
    var strip = ss.sites.map(function (s) {
      return '<div class="site"><div class="code">' + s.code + '</div><div class="qt mono">' + fmt(s.stock) + '</div>' +
        '<div class="pct">' + (ss.total ? Math.round(s.stock / ss.total * 100) : 0) + ' %</div><div class="sbar"><i style="width:' + (mx ? Math.round(s.stock / mx * 100) : 0) + '%"></i></div></div>';
    }).join('');
    var rows = reb.map(function (p) {
      var m = 0; etabs.forEach(function (e) { if (p.per[e] > m) m = p.per[e]; });
      var bars = etabs.map(function (e) {
        var v = p.per[e], hpx = v === 0 ? 2 : Math.round(4 + v / m * 32);
        return '<div class="col"><div class="b ' + (v === 0 ? 'zero' : v === m ? 'hot' : '') + '" style="height:' + hpx + 'px"></div><small>' + e + '</small></div>';
      }).join('');
      return '<div class="imb"><div class="imn">' + esc(cap(p.d)) + '</div>' +
        '<div class="imm">' + fmt(p.tot) + ' u · <b>' + Math.round(p.conc * 100) + ' % sur ' + p.mxE + '</b> · ' + p.zeros + ' site' + (p.zeros > 1 ? 's' : '') + ' à 0</div>' +
        '<div class="imbar">' + bars + '</div>' +
        '<div class="imfix">→ équilibrer depuis ' + p.mxE + ' — <b>transférer</b> plutôt que commander</div></div>';
    }).join('') || '<div class="ap-empty">Stock équilibré sur les sites.</div>';
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">▤</div><div><h3>Stock par établissement</h3>' +
      '<div class="ap-sub">' + fmt(ss.total) + ' unités sur 7 sites (NR) — un produit concentré sur un site, à 0 ailleurs = à rééquilibrer, pas à racheter</div></div></div>' +
      '<div class="sites">' + strip + '</div>' +
      '<div class="imbhd">Rééquilibrage inter-sites <span>' + reb.length + '</span></div>' + rows + '</div>';
  }

  // ═══ VEILLE GÉNÉRIQUES (BDPM, robot mensuel) : bascules princeps→Gx + nouveaux groupes ═══
  var _generState = 0, _generData = null;
  function ensureGener() {
    if (_generData || _generState) return;
    _generState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('generiques-bdpm.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _generData = j || {}; _generState = 2; approRerender(); })
        .catch(function () { _generState = 2; });
    } catch (e) { _generState = 2; }
  }
  var _bascCache = null, _bascRef = null, _bascGenRef = null;
  function basculesGx() {
    if (!_generData || !_generData.princepsWithGeneric || !window.WML_SALES) return [];
    var S = window.WML_SALES;
    if (_bascCache && _bascRef === S && _bascGenRef === _generData) return _bascCache;   // audit M1 : cache (ventes + base génériques)
    var set = {}; _generData.princepsWithGeneric.forEach(function (c) { set[c] = 1; });
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var bought = {};
    for (var j = 0; j < S.length; j++) { var r = S[j]; if (r[4] > 0) { var c = String(r[3]); if (set[c]) bought[c] = (bought[c] || 0) + r[4]; } }
    var out = Object.keys(bought).map(function (c) { return { c: c, q: bought[c], d: ps[c] ? ps[c].d : c }; });
    out.sort(function (a, b) { return b.q - a.q; });
    // Liste COMPLÈTE : le compteur « à protéger » doit valoriser tout le stock de princeps
    // menacé. C'est aux appelants d'afficher un top N — plafonner ici sous-estimait
    // l'exposition en silence.
    _bascCache = out; _bascRef = S; _bascGenRef = _generData;
    return _bascCache;
  }
  function basculesCard() {
    if (!_generData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">G</div><div><h3>Bascules génériques</h3><div class="ap-sub">chargement de la base médicaments (BDPM)…</div></div></div></div>';
    var b = basculesGx().slice(0, 12); if (!b.length) return '';
    var rows = b.map(function (o) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + '<small>princeps acheté par le réseau — un générique existe</small></div>' +
        '<div class="ap-mini">' + fmt(o.q) + ' u/' + nMoisCouverts() + ' mois</div><div class="ap-st ok">bascule Gx</div></div>';
    }).join('');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">G</div><div><h3>Bascules génériques à faire</h3>' +
      '<div class="ap-sub">' + (_generData.meta ? _generData.meta.nAvecGenerique : '') + ' groupes avec générique (BDPM) — les princeps que TU achètes encore et qui ont un générique dispo, top 12 par volume</div></div></div>' + rows + '</div>';
  }

  // ═══ VEILLE ANSM DISPONIBILITÉS (robot quotidien) : ruptures/tensions + DATE DE RETOUR ═══
  var _ansmState = 0, _ansmData = null;
  var MOIS_L = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function ensureAnsm() {
    if (_ansmData || _ansmState) return;
    _ansmState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('ansm-dispo.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _ansmData = j || {}; _ansmState = 2; approRerender(); })
        .catch(function () { _ansmState = 2; });
    } catch (e) { _ansmState = 2; }
  }
  function retourLabel(r) {
    if (!r) return '';
    if (!r.mois) return '' + r.annee;
    if (r.approx === 'trimestre') return 'T' + (Math.floor((r.mois - 1) / 3) + 1) + ' ' + r.annee;
    var pre = (r.approx === 'début' || r.approx === 'fin' || r.approx === 'mi') ? r.approx + ' ' : '';
    return pre + MOIS_L[r.mois - 1] + ' ' + r.annee;
  }
  // « depuis quand » — journal append-only tenu par le robot ANSM (ansm-histo.json).
  // ≈ = date amorcée sur la date ANSM de dernière mise à jour ; = = changement observé par Jarvis.
  function depuisLabel(i) {
    if (!i || !i.since) return '';
    var d = daysTo(i.since);
    if (d == null) return '';
    var j = Math.max(0, -d), t;
    if (j < 1) t = 'depuis aujourd’hui';
    else if (j < 31) t = 'depuis ' + j + ' j';
    else if (j < 365) t = 'depuis ' + Math.round(j / 30) + ' mois';
    else t = 'depuis ' + (Math.round(j / 36.5) / 10).toString().replace('.', ',') + ' an' + (j >= 730 ? 's' : '');
    return (i.sinceA ? '≈ ' : '') + t;
  }
  function ansmCard() {
    if (!_ansmData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">!</div><div><h3>Ruptures &amp; retours ANSM</h3><div class="ap-sub">chargement des signalements ANSM…</div></div></div></div>';
    var items = (_ansmData.items || []).filter(function (i) { return i.retour && i.retour.iso; });
    items.sort(function (a, b) { return (a.retour.annee * 100 + (a.retour.mois || 13)) - (b.retour.annee * 100 + (b.retour.mois || 13)); });
    var rows = items.slice(0, 15).map(function (i) {
      var rup = /upture/.test(i.st);
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap((i.spec || '').toLowerCase())) +
        '<small>' + (i.dci ? esc(i.dci) : '') + (i.subst ? ' · <b style="color:var(--c-opp)">générique dispo</b>' : '') +
        (depuisLabel(i) ? ' · <b>' + depuisLabel(i) + '</b>' : '') + '</small></div>' +
        '<div class="ap-mini">' + (rup ? '<span class="ap-tag ru">rupture</span>' : '<span class="ap-tag" style="color:#a8651a;background:#FFF8EC;border:1px solid #F0DCA8">tension</span>') + '</div>' +
        '<div class="ap-st ok">retour ' + retourLabel(i.retour) + '</div></div>';
    }).join('') || '<div class="ap-empty">Aucune date de retour renseignée pour le moment.</div>';
    var m = _ansmData.meta || {}, bs = m.byStatut || {}, rupN = 0, tenN = 0;
    Object.keys(bs).forEach(function (k) { if (/upture/.test(k)) rupN += bs[k]; if (/ension/.test(k)) tenN += bs[k]; });
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">!</div><div><h3>Ruptures &amp; retours ANSM</h3>' +
      '<div class="ap-sub">' + (m.n || 0) + ' signalements actifs · ' + rupN + ' ruptures · ' + tenN + ' tensions · <b>' + (m.nDates || 0) + ' avec date de retour</b> · <b style="color:var(--c-opp)">' + (m.nSubst || 0) + ' substituables (générique)</b> — top 15 par échéance</div></div></div>' +
      rows +
      '<div class="ap-foot" style="padding:10px 16px 12px;margin:0">Date de retour = champ « remise à disposition prévue » des fiches ANSM (approximatif, ~1 réf sur 3 renseignée). <b>« depuis »</b> = journal tenu par Jarvis ; « ≈ » = amorcé sur la date ANSM de dernière mise à jour, la date devient exacte dès qu\'on observe le changement nous-mêmes. Source unique gratuite, MAJ quotidienne — personne d\'autre ne l\'agrège.</div></div>';
  }

  // ═══ SIGNAUX DE DEMANDE (Réseau Sentinelles, robot quotidien) — anticiper le comptoir ═══
  var _epiState = 0, _epiData = null;
  var EPI_MAP = {
    grippe: { fam: 'antipyrétiques · ORL · antitussifs', kw: /PARAC[EÉ]TAMOL|IBUPROF|DOLIPRANE|EFFERALGAN|DAFALGAN|TOUX|RHUME|GORGE|NASAL|S[EÉ]RUM PHY|OSCILLO|HUMEX|FERVEX|ACTIFED|RHINO|STREPSIL/i },
    gastro: { fam: 'antidiarrhéiques · réhydratation · antispasmodiques', kw: /DIARRH|SMECTA|IMODIUM|TIORFAN|LOP[EÉ]RAMIDE|R[EÉ]HYDRAT|ULTRALEVURE|SPASFON|PHLORO|ARESTAL|BIOGAIA/i },
    varicelle: { fam: 'antihistaminiques · antiseptiques cutanés', kw: /C[EÉ]TIRIZIN|LORATADIN|POLARAMINE|ANTIHIST|CHLORHEXIDINE|SEPTIVON|BISEPTINE|CICALFATE|DERMASPRAID|CALADRYL|DIPROSONE/i },
    bronchiolite: { fam: 'sérum physiologique · mouche-bébé · désobstruction nourrisson', kw: /S[EÉ]RUM PHY|PHYSIO(DOSE|MER|LOGIQUE)|STERIMAR|MOUCHE|RHINO.*B[EÉ]B|D[EÉ]SOBSTRUCT|PROSPAN|HELICIDINE|BALSAMIQUE|PRORHINEL/i }
  };
  // Odissé / SurSaUD (urgences par département, Santé publique France) — plus fin que Sentinelles
  var _odiState = 0, _odisseData = null;
  function ensureOdisse() {
    if (_odisseData || _odiState) return;
    _odiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('odisse.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _odisseData = j || {}; _odiState = 2; approRerender(); })
        .catch(function () { _odiState = 2; });
    } catch (e) { _odiState = 2; }
  }
  function ensureEpidemio() {
    if (_epiData || _epiState) return;
    _epiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('epidemio.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _epiData = j || {}; _epiState = 2; approRerender(); })
        .catch(function () { _epiState = 2; });
    } catch (e) { _epiState = 2; }
  }
  function epidemioCard() {
    if (!_epiData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-opp)">✚</div><div><h3>Signaux de demande</h3><div class="ap-sub">chargement de la veille épidémio…</div></div></div></div>';
    var inds = _epiData.indicators || []; if (!inds.length) return '';
    var P = window.PROD_STATS || [];
    var rows = inds.map(function (i) {
      var mp = EPI_MAP[i.cat] || {}, nref = 0;
      if (mp.kw) for (var k = 0; k < P.length; k++) { if ((P[k].n || 0) > 0 && mp.kw.test(P[k].d || '')) nref++; }
      var reg = (i.regions && i.regions[0]) ? i.regions[0].n : '';
      return '<div class="ap-row"><div class="ap-nm">' + esc(i.label) +
        '<small>' + (mp.fam ? 'à renforcer : ' + mp.fam : '') + (reg ? ' · plus fort en ' + esc(cap((reg || '').toLowerCase())) : '') + '</small></div>' +
        '<div class="ap-mini">' + (i.inc100 != null ? i.inc100 + '/100k' : '') + (nref ? ' · ' + nref + ' réfs' : '') + '</div>' +
        '<div class="ap-g">' + pctHtml(i.trend) + '</div></div>';
    }).join('');
    var w = String(_epiData.week || ''), wl = w.length >= 6 ? 'sem. ' + w.slice(4) + ' · ' + w.slice(0, 4) : '';
    // Bloc Odissé : où ça chauffe aux urgences, par département (SurSaUD, plus fin que Sentinelles + bronchiolite)
    var odiHtml = '';
    var odi = _odisseData && _odisseData.pathologies;
    if (odi && odi.length) {
      var ow = String(_odisseData.week || '');
      var orows = odi.map(function (p) {
        var mp = EPI_MAP[p.cat] || {}, nref = 0;
        if (mp.kw) for (var k = 0; k < P.length; k++) { if ((P[k].n || 0) > 0 && mp.kw.test(P[k].d || '')) nref++; }
        var deps = (p.hotDeps || []).slice(0, 3).map(function (d) { return esc(d.n || d.dep || ''); }).filter(Boolean).join(' · ');
        return '<div class="ap-row"><div class="ap-nm">' + esc(p.label) +
          '<small>' + (deps ? 'foyers actifs : ' + deps : '') + (mp.fam ? ' · à renforcer : ' + mp.fam : '') + '</small></div>' +
          '<div class="ap-mini">' + (p.passages != null ? p.passages + ' passages' : '') + (nref ? ' · ' + nref + ' réfs' : '') + '</div>' +
          '<div class="ap-g">' + pctHtml(p.trend) + '</div></div>';
      }).join('');
      odiHtml = '<div class="ap-foot" style="padding:11px 16px 4px;margin:0;font-weight:600;color:var(--ink)">Où ça chauffe — urgences par département' +
        (ow.length >= 6 ? ' · sem. ' + ow.slice(4) : '') + '</div>' +
        '<div class="ap-foot" style="padding:0 16px 6px;margin:0">SurSaUD (Santé publique France) — pré-positionner ces secteurs avant la vague comptoir.</div>' + orows;
    }
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-opp)">✚</div><div><h3>Signaux de demande — épidémie</h3>' +
      '<div class="ap-sub">Réseau Sentinelles ' + wl + ' · ce qui monte = à pré-stocker avant le rush comptoir (incidence France /100k + tendance hebdo)</div></div></div>' + rows + odiHtml +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Réfs = produits du catalogue réseau associés à la pathologie (mots-clés). Croiser avec le stock avant le pic.</div></div>';
  }

  // ═══ ANTICIPATION RÉGLEMENTAIRE (HAS, robot mensuel) — le prochain Wegovy 3-6 mois avant ═══
  var _hasState = 0, _hasData = null, _bought = null, _boughtRef = null;
  function boughtSet() {
    var S = window.WML_SALES; if (!S) return {};
    if (_bought && _boughtRef === S) return _bought;
    var b = {}; for (var i = 0; i < S.length; i++) { var r = S[i]; if (r[4] > 0) { var c = String(r[3]); b[c] = (b[c] || 0) + r[4]; } }
    _bought = b; _boughtRef = S; return b;
  }

  // ═══ SAISON PAR PRODUIT (Medic'AM 2 ans, robot mensuel) — pré-commander avant le pic ═══
  var _saiState = 0, _saiCip = null;
  function ensureSaisonCip() {
    if (_saiCip || _saiState) return;
    _saiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('saison-cip.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _saiCip = j || {}; _saiState = 2; approRerender(); })
        .catch(function () { _saiState = 2; });
    } catch (e) { _saiState = 2; }
  }
  function saisonCipCard() {
    if (!_saiCip) return '';   // discret : rien tant que non chargé (évite le clignotement)
    var data = _saiCip.data || {}; if (!Object.keys(data).length) return '';
    var b = boughtSet();
    var now = new Date().getMonth() + 1;
    var win = [now % 12 + 1, (now + 1) % 12 + 1, (now + 2) % 12 + 1];   // 3 prochains mois
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var cand = [];
    Object.keys(data).forEach(function (c) {
      if (!b[c]) return;
      var o = data[c]; if (!o || !o.i || o.i.length < 12) return;   // garde (audit M3) : entrée saison-cip sans indice → sinon TypeError efface le cockpit stock
      var pm = win[0], pv = o.i[win[0] - 1];
      win.forEach(function (m) { if (o.i[m - 1] > pv) { pv = o.i[m - 1]; pm = m; } });
      if (pv < (pm === 1 ? 1.5 : 1.2)) return;   // audit P2 : pic janvier = renouvellements, seuil relevé
      cand.push({ c: c, pv: pv, pm: pm, q: b[c] });
    });
    if (!cand.length) return '';
    cand.sort(function (a, b2) { return (b2.pv * b2.q) - (a.pv * a.q); });
    var rows = cand.slice(0, 12).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap(((ps[x.c] && ps[x.c].d) || x.c).toLowerCase())) +
        '<small>pic en ' + MOIS_L[x.pm - 1] + ' · +' + Math.round((x.pv - 1) * 100) + ' % vs moyenne (Medic\'AM 2 ans)</small></div>' +
        '<div class="ap-mini">' + fmt(x.q) + ' u/' + nMoisCouverts() + ' mois réseau</div>' +
        '<div class="ap-st ok">pré-commander</div></div>';
    }).join('');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">☀</div><div><h3>Pré-commander avant le pic</h3>' +
      '<div class="ap-sub">saison PAR PRODUIT (Medic\'AM 2 ans) — ce que le réseau achète et qui monte dans les 3 prochains mois, à stocker avant le pic</div></div></div>' + rows +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Indice = boîtes remboursées France du mois / moyenne annuelle, sur 2 ans. Pic à venir = constituer le stock maintenant.</div></div>';
  }
  function ensureHas() {
    if (_hasData || _hasState) return;
    _hasState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('has-avis.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _hasData = j || {}; _hasState = 2; approRerender(); })
        .catch(function () { _hasState = 2; });
    } catch (e) { _hasState = 2; }
  }
  function hasCard() {
    if (!_hasData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--ip-blue)">§</div><div><h3>Anticipation réglementaire</h3><div class="ap-sub">chargement des avis HAS…</div></div></div></div>';
    var favs = (_hasData.items || []).filter(function (i) { return i.cat === 'reimb'; });
    if (!favs.length) return '';
    var b = boughtSet();
    function dfr(iso) { var p = (iso || '').split('-'); return p.length >= 2 ? MOIS_L[+p[1] - 1] + ' ' + p[0] : iso; }
    var nOurs = favs.filter(function (i) { return (i.cips || []).some(function (c) { return b[c]; }); }).length;
    var rows = favs.slice(0, 12).map(function (i) {
      var ours = (i.cips || []).some(function (c) { return b[c]; });
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap((i.spec || '').toLowerCase())) +
        '<small>avis HAS ' + dfr(i.date) + (i.motif ? ' · ' + esc(i.motif.toLowerCase()) : '') + '</small></div>' +
        '<div class="ap-mini">ASMR ' + esc(i.asmr) + '</div>' +
        (ours ? '<div class="ap-st ok">déjà au catalogue</div>' : '<div class="ap-st ko">à référencer</div>') + '</div>';
    }).join('');
    var m = _hasData.meta || {};
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--ip-blue)">§</div><div><h3>Anticipation réglementaire — HAS</h3>' +
      '<div class="ap-sub">' + (m.nFav || 0) + ' avis favorables récents (amélioration ASMR I-IV) · <b>' + nOurs + ' déjà au catalogue réseau</b> — ce qui va monter/arriver, le signal 3-6 mois avant le remboursement</div></div></div>' + rows +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Un avis favorable de la Commission de la Transparence précède l\'inscription au remboursement de 3-6 mois. « À référencer » = ASMR élevé qu\'on ne distribue pas encore.</div></div>';
  }

  // ═══ CARNET D'ACHAT DU JOUR — fusion de tous les signaux en décisions (façon salle de marché) ═══
  // Chaque produit stocké = une position : couverture (runway), demande, signaux (rupture,
  // saison, générique) → un VERDICT + une quantité. Onglets par verdict · ticket au clic · export.
  // MITM — médicaments d'intérêt thérapeutique majeur (liste ANSM, robot mensuel) : priorité max
  var _mitmState = 0, _mitmSet = null, _mitmGen = null;
  function ensureMitm() {
    if (_mitmSet || _mitmState) return;
    _mitmState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('mitm.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var s = {}; ((j && j.cips) || []).forEach(function (c) { s[c] = 1; }); _mitmSet = s; _mitmGen = j && j.generated; _mitmState = 2; approRerender(); })
        .catch(function () { _mitmSet = {}; _mitmState = 2; });
    } catch (e) { _mitmSet = {}; _mitmState = 2; }
  }
  // ── Couche de confiance : fraîcheur des sources (recommandation stratégie : fiabiliser d'abord) ──
  function fdate(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p.length >= 3 ? p[2] + '/' + p[1] : String(iso); }
  // Les deux robots ne datent pas leur semaine pareil : Sentinelles écrit « 202630 »,
  // Odissé écrit « 2026-S30 ». Un découpage à position fixe affichait « sem. -S30 ».
  function sem(w) { var m = String(w == null ? '' : w).match(/(\d{1,2})$/); return m ? m[1] : String(w == null ? '' : w); }
  function freshnessBar() {
    var s = [];
    if (_ansmData && _ansmData.generated) s.push('Ruptures ANSM ' + fdate(_ansmData.generated));
    if (_generData && _generData.generated) s.push('Génériques ' + fdate(_generData.generated));
    if (_hasData && _hasData.generated) s.push('HAS ' + fdate(_hasData.generated));
    if (_epiData && _epiData.week) s.push('Épidémio sem. ' + sem(_epiData.week));
    if (_odisseData && _odisseData.week) s.push('Urgences sem. ' + sem(_odisseData.week));
    if (_saiCip && _saiCip.generated) s.push('Saison ' + fdate(_saiCip.generated));
    if (_mitmGen) s.push('MITM ' + fdate(_mitmGen));
    if (_prixData && _prixData.generated) s.push('Prix BDPM ' + fdate(_prixData.generated));
    if (_rapData && _rapData.generated) s.push('Rappels ' + fdate(_rapData.generated));
    if (_omData && _omData.year) s.push('Marché national ' + _omData.year);
    // audit 01/08 : ces flux (robots MENSUELS) n'étaient surveillés par personne — s'ils
    // gelaient, l'écran continuait d'afficher de vieux chiffres sans le dire.
    // ⚠️ doit rester AVANT le calcul de `parts` et de `warn` : c'est l'inversion de cet ordre
    // qui a fait tomber toute la page Appro le 01/08 (variable utilisée avant déclaration).
    var muets = [];
    [['Marché France', window.AMELI_AVG], ['Tendance', window.TENDANCE], ['Momentum', window.MOMENTUM],
     ['Nouveautés', window.NOUVEAUTES], ['Saison ATC', window.SAISON]].forEach(function (f) {
      var m = f[1] && f[1].meta;
      if (!m) return;
      if (!m.gen) { muets.push(f[0] + ' (date inconnue)'); return; }
      s.push(f[0] + ' ' + fdate(m.gen));
      var ageF = null;
      try { ageF = Math.round((new Date().getTime() - new Date(m.gen + 'T00:00:00').getTime()) / 864e5); } catch (e) {}
      if (ageF != null && ageF > 45) muets.push(f[0] + ' figé depuis ' + ageF + ' j');
    });
    // Date réelle de l'inventaire plateforme = dénominateur des couvertures (audit : talon d'Achille).
    // On l'affiche et on alerte si le stock est vieux (> 35 j) car les jours-avant-rupture s'en trouvent optimistes.
    var stk = window.STOCK_IP && window.STOCK_IP.meta, stockTxt = '<b>stock plateforme = dernier inventaire importé</b> (photographie, pas temps réel)', warn = '';
    if (stk && stk.gen) {
      stockTxt = '<b>stock plateforme arrêté au ' + fdate(stk.gen) + '</b> (photographie, pas temps réel)';
      var age = null;
      try { age = Math.round((new Date().getTime() - new Date(stk.gen + 'T00:00:00').getTime()) / 864e5); } catch (e) {}
      if (age != null && age > 35) warn = '<div class="ap-fresh-warn">🔄 Pense à réimporter le stock des établissements pour des chiffres au plus juste — dernier import il y a ' + age + ' jours.</div>';
    }
    if (muets.length) {
      warn += '<div class="ap-fresh-warn">⏸ Flux de marché à vérifier : ' + muets.join(' · ') + ' — le robot mensuel n’a peut-être pas tourné.</div>';
    }
    if (!s.length && !warn) return '';
    var parts = s.concat([stockTxt]);   // audit m8 : pas de séparateur orphelin quand aucune source datée n'est encore chargée

    // audit 01/08 : dire sur COMBIEN de mois la vitesse est calculée (un mois d'export partiel
    // est exclu) et combien de références n'ont jamais été inventoriées.
    var vit = 'Vitesse = ventes réseau.', ix = null;
    try { ix = _cipIdx; } catch (e) {}
    if (ix) {
      var k0 = Object.keys(ix)[0], nm = k0 ? ix[k0].nMois : null, nu = 0;
      Object.keys(ix).forEach(function (c) { if (ix[c].unk) nu++; });
      if (nm) vit = 'Vitesse = moyenne sur ' + nm + ' mois complets (un mois d’export partiel est écarté).';
      if (nu) vit += ' <b>' + nu + ' références jamais inventoriées</b> — leurs quantités sont des estimations.';
    }
    return '<div class="ap-fresh">🕓 Sources à jour : ' + parts.join(' · ') + '. ' + vit + '</div>' + warn;
  }
  function isMitm(c) { return !!(_mitmSet && _mitmSet[c]); }

  var _bookTab = 'all', _carnetActs = null;
  var ORDER_LEAD = 4; // délai fournisseur par défaut (jours) pour la date « commander avant »
  function dtLabel(daysAhead) {
    var d = new Date(Date.now() + Math.round(Math.max(0, daysAhead)) * 86400000);
    return d.getDate() + ' ' + MOIS_L[d.getMonth()];
  }
  function secLab(cov) { return cov < 1 ? 'déjà à sec (stock 0)' : 'à sec ~' + dtLabel(cov); }   // audit #2 : pas de « à sec ~aujourd'hui »
  // ═══ MODÈLE NATIONAL (national.json, robot mensuel) ═══
  // Volume France + profil saisonnier par CIP13, calculés SANS aucune donnée Intégral.
  // Notre réel n'intervient qu'ici, en dernière couche : calibrer la part, puis comparer.
  // Sans nos données, tout retombe au niveau 3 et l'outil continue de fonctionner en le disant.
  var _natState = 0, _natData = null, _partGlob = null, _partFam = null, _partRef = null;
  // Parc officinal : 357 octets, chargé avec le modèle national. Sans lui, la vue macro
  // perd son chiffre le plus parlant (« 1 boîte sur N chez vos propres clients »).
  var _parcData = null, _parcState = 0;
  function ensureParc() {
    if (_parcData || _parcState) return;
    _parcState = 1;
    try {
      fetch('parc-officines.json?d=' + new Date().toISOString().slice(0, 10), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _parcData = j || null; _parcState = 2; approRerender(); })
        .catch(function () { _parcState = 2; });
    } catch (e) { _parcState = 2; }
  }

  function ensureNational() {
    ensureParc();
    if (_natData || _natState) return;
    _natState = 1;
    try {
      var jour = new Date().toISOString().slice(0, 10);
      fetch('national.json?d=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _natData = j || {}; _natState = 2; _partGlob = null; approRerender(); })
        .catch(function () { _natState = 2; });
    } catch (e) { _natState = 2; }
  }

  // Part de marché globale = total annualisé réseau ÷ total France, sur les produits communs.
  // Mesurée à 0,28 % le 01/08/2026 — recalculée à chaque chargement, jamais figée en dur.
  // Calcule au passage la part par MOLÉCULE, qui sert de repli (niveau 2).
  function partGlobale() {
    var idx = cipIndex();
    if (_partGlob != null && _partRef === idx) return _partGlob;
    var d = (_natData && _natData.data) || {};
    var ip = 0, nat = 0, famIp = {}, famNat = {};
    _partFam = {};
    Object.keys(idx).forEach(function (c) {
      var n = d[c];
      if (!n || !n.v) return;
      var an = (idx[c].vM || 0) * 12;
      ip += an; nat += n.v;
      var f = n.d || '';
      if (f) { famIp[f] = (famIp[f] || 0) + an; famNat[f] = (famNat[f] || 0) + n.v; }
    });
    Object.keys(famIp).forEach(function (f) { if (famNat[f] > 0) _partFam[f] = famIp[f] / famNat[f]; });
    _partGlob = nat > 0 ? ip / nat : 0.0028;
    _partRef = idx;
    return _partGlob;
  }

  function partMarche(cip) {
    var d = (_natData && _natData.data) || {}, n = d[String(cip)];
    var glob = partGlobale();
    if (!n) return { part: glob, niveau: 3, libelle: 'estimé (moyenne)' };
    var o = cipIndex()[String(cip)];
    if (o && o.vM > 0 && n.v > 0) return { part: (o.vM * 12) / n.v, niveau: 1, libelle: 'mesuré' };
    var f = (_partFam && n.d) ? _partFam[n.d] : null;
    if (f > 0) return { part: f, niveau: 2, libelle: 'estimé (famille)' };
    return { part: glob, niveau: 3, libelle: 'estimé (moyenne)' };
  }

  // Stock cible en unités : demande France du mois × notre part, ramenée à la couverture cible.
  // mois = 1..12. Renvoie null si le produit n'est pas dans le modèle — on n'invente rien.
  function cibleNationale(cip, mois) {
    var d = (_natData && _natData.data) || {}, n = d[String(cip)];
    if (!n || !n.v) return null;
    var pm = partMarche(cip);
    var indice = (n.s && n.s[(mois - 1 + 12) % 12]) || 1;
    var demandeMois = n.v / 12 * indice * pm.part;
    var o = cipIndex()[String(cip)];
    var couv = (o && o.rupt) ? CIBLE_TENSION : CIBLE;
    return { unites: Math.round(demandeMois / 30 * couv), part: pm.part,
             niveau: pm.niveau, libelle: pm.libelle, indice: indice };
  }

  // ═══ VUE MACRO — où Intégral pèse sur le marché français, et où il ne pèse pas ═══
  // Répond à « besoins / offres » d'un coup d'œil, là où les listes A et B répondent
  // produit par produit. Tout est calculé, rien n'est écrit en dur.
  //
  // ⚠️ DEUX DÉNOMINATEURS, à ne jamais confondre :
  //   · part du MARCHÉ  = nos boîtes / boîtes France (0,26 % mesuré le 12/08/2026)
  //   · part du PARC    = nos officines clientes / officines France (2 223 / 19 671)
  // Le taux de couverture chez nos propres clients est le RAPPORT des deux — c'est lui
  // qui dit « chez un client, nous fournissons 1 boîte sur N ». Le sortir sans dire de
  // quel parc on parle donne des résultats qui varient du simple au quadruple.
  var MARCHE_MINI = 100000;   // boîtes/an en France : sous ce seuil, un % n'a pas de sens

  // La BDPM écrit une même molécule dans les deux sens : « DL-LYSINE (ACÉTYLSALICYLATE DE) »
  // et « ACÉTYLSALICYLATE DE DL-LYSINE » sont le Kardegic, et sortaient sur DEUX lignes de
  // la vue macro, chacune avec la moitié du volume. On regroupe sur les mots significatifs
  // TRIÉS : deux écritures permutées se rejoignent, deux molécules différentes non
  // (« paracétamol » et « paracétamol codéine » n'ont pas les mêmes mots).
  function cleDci(s) {
    var t = (s || '').toUpperCase().replace(/[^A-ZÀ-Ü]+/g, ' ').split(' ')
      .filter(function (m) { return m.length > 3; });
    return t.sort().join(' ');
  }

  function positionMarche() {
    if (!_natData || !_natData.data) return null;
    var idx = cipIndex(), d = _natData.data;
    var ip = 0, nat = 0, nCommun = 0, famIp = {}, famNat = {}, famN = {}, famLbl = {};
    Object.keys(idx).forEach(function (c) {
      var n = d[c];
      if (!n || !n.v) return;                       // hors modèle : on ne devine pas
      var an = (idx[c].vM || 0) * 12;
      if (an <= 0) return;
      nCommun++; ip += an; nat += n.v;
      var brut = n.d || '';
      if (!brut) return;
      var f = cleDci(brut);
      if (!f) return;
      famIp[f] = (famIp[f] || 0) + an;
      famNat[f] = (famNat[f] || 0) + n.v;
      famN[f] = (famN[f] || 0) + 1;
      if (!famLbl[f] || brut.length < famLbl[f].length) famLbl[f] = brut;  // le libellé le plus court
    });
    if (!nat) return null;

    var fams = Object.keys(famIp).filter(function (f) { return famNat[f] > 0 && famIp[f] > 0; })
      .map(function (f) {
        return { dci: famLbl[f] || f, part: famIp[f] / famNat[f], nous: famIp[f],
                 marche: famNat[f], nRef: famN[f] };
      });
    // « Fort » et « faible » se jugent par rapport à NOTRE propre moyenne, pas dans l'absolu :
    // 0,5 % du marché français d'une molécule, c'est le double de notre moyenne.
    var part = ip / nat;
    // ⚠️ Un pourcentage élevé sur un marché minuscule est du bruit : 56 % d'un marché de
    // 3 000 boîtes/an (atovaquone) n'apprend rien et chasse les vraies positions de la
    // liste. On exige donc une taille de marché minimale, et on trie par le volume qu'on
    // y fait RÉELLEMENT — c'est ça, une position forte.
    var forts = fams.filter(function (x) { return x.part >= part * 3 && x.marche >= MARCHE_MINI; })
      .sort(function (a, b) { return b.nous - a.nous; });
    // Les faibles se trient par ENJEU (volume France), pas par faiblesse : être absent
    // d'un marché minuscule n'intéresse personne.
    var faibles = fams.filter(function (x) { return x.part <= part / 3; })
      .sort(function (a, b) { return b.marche - a.marche; });

    // Le parc vient de `parc-officines.json` (357 octets), pas de PHARMA_FR : ce dernier
    // pèse 2,8 Mo et n'est chargé que par la carte. La 1re version lisait PHARMA_FR et
    // le bloc « 1 boîte sur N » disparaissait donc en silence sur cet écran — défaut vu
    // seulement à la capture, jamais par les tests.
    var parc = null;
    try {
      var P = _parcData || (window.PHARMA_FR && window.PHARMA_FR.meta) || null;
      if (P && P.n && P.clients) parc = { fr: P.n, clients: P.clients, partParc: P.clients / P.n };
    } catch (e) { parc = null; }

    return { part: part, ip: ip, nat: nat, nCommun: nCommun, nCatalogue: Object.keys(idx).length,
             forts: forts, faibles: faibles, nFam: fams.length, parc: parc };
  }

  function positionMarcheCard() {
    var p = positionMarche();
    if (!p) return '';
    var pc = function (x) { return (x * 100).toFixed(x < 0.01 ? 3 : 2).replace('.', ','); };

    var kpi = '<div class="pm-kpi">' +
      '<div class="pm-k"><b>' + fmt(Math.round(p.nat / 1e6)) + ' M</b><span>boîtes/an — le besoin France sur les produits que vous distribuez</span></div>' +
      '<div class="pm-k"><b>' + fmt(Math.round(p.ip / 1e3)) + ' k</b><span>boîtes/an — ce que vous fournissez</span></div>' +
      '<div class="pm-k"><b style="color:var(--ip-blue)">' + pc(p.part) + ' %</b><span>votre part du marché français</span></div>' +
      '</div>';

    // Le chiffre qui parle : chez nos PROPRES clients, quelle part de leurs besoins ?
    var couv = '';
    if (p.parc && p.parc.partParc > 0) {
      var taux = p.part / p.parc.partParc;           // part du marché ÷ part du parc
      var surN = taux > 0 ? Math.round(1 / taux) : 0;
      couv = '<div class="pm-hl"><b>Chez vos propres clients, vous fournissez environ 1 boîte sur ' + surN + '.</b>' +
        '<small>' + fmt(p.parc.clients) + ' officines clientes sur ' + fmt(p.parc.fr) + ' en France (' +
        pc(p.parc.partParc) + ' % du parc) captent ' + pc(p.part) + ' % du marché. ' +
        'Le gisement est donc chez les clients actuels, pas seulement dans la conquête. ' +
        '⚠️ calcul sur les clients <b>référencés</b> : tous ne commandent pas chaque mois, ' +
        'la couverture réelle des officines actives est meilleure.</small></div>';
    }

    // Le titre porte l'effectif RÉEL, pas celui de l'extrait affiché. Trois positions
    // fortes contre 330 faiblesses, c'est le vrai visage d'un short-liner : le dire
    // franchement vaut mieux qu'une liste qui laisse croire à un équilibre.
    function bloc(titre, liste, sens) {
      if (!liste.length) return '';
      titre += ' <b>(' + fmt(liste.length) + ')</b>';
      var l = liste.slice(0, 6).map(function (x) {
        return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap((x.dci || '').toLowerCase())) + '</b>' +
          '<small>' + fmt(Math.round(x.marche / 1000)) + ' k boîtes/an en France · ' +
          x.nRef + ' référence' + (x.nRef > 1 ? 's' : '') + ' chez vous</small></div>' +
          '<div class="ap-mini"><b style="color:' + (sens === 'fort' ? '#1F7A3D' : '#B02A37') + '">' +
          pc(x.part) + ' %</b></div></div>';
      }).join('');
      return '<div class="pm-sub">' + titre + '</div>' + l;
    }

    var corps = kpi + couv +
      bloc('Molécules où vous pesez — plus de 3× votre moyenne', p.forts, 'fort') +
      bloc('Gros marchés où vous êtes quasi absent — moins du tiers de votre moyenne', p.faibles, 'faible');

    return card('pilo', 'Votre position sur le marché français',
      'calculé sur ' + fmt(p.nCommun) + ' produits que vous distribuez et que le modèle national connaît, ' +
      'et ' + fmt(p.nFam) + ' molécules',
      corps, 'var(--ip-blue)') +
      '<div class="ap-foot" style="margin:0">Besoin France = Open Medic (boîtes remboursées, millésime le plus récent). ' +
      'Votre volume = vos ventes réseau ramenées à l’année. ' +
      '<b>Les deux pourcentages ne se comparent pas entre eux</b> : l’un porte sur des boîtes, l’autre sur des officines. ' +
      'Molécules non remboursées et parapharmacie sont hors modèle — elles ne comptent ni au numérateur ni au dénominateur.</div>';
  }

  // ═══ LISTE A — écart entre ce que dit le marché France et ce qu'on détient ═══
  // C'est la seule ligne où nos données entrent : le « détenu ». Tout le reste vient du
  // modèle national, donc reste juste même quand notre inventaire a 61 jours.
  function ecartNational() {
    if (!_natData || !_natData.data) return '';
    var idx = cipIndex(), mois = new Date().getMonth() + 1, out = [];
    Object.keys(idx).forEach(function (c) {
      var cb = cibleNationale(c, mois);
      if (!cb || !cb.unites) return;
      var o = idx[c];
      if (o.unk) return;                       // stock inconnu : l'ecart n'aurait aucun sens
      var ecart = cb.unites - (o.st || 0);
      if (ecart < 5) return;                   // sous 5 unites : du bruit
      out.push({ c: c, nom: o.d, cible: cb.unites, detenu: o.st, ecart: ecart,
                 niveau: cb.niveau, libelle: cb.libelle, part: cb.part, indice: cb.indice });
    });
    if (!out.length) return '';
    out.sort(function (a, b) { return b.ecart - a.ecart; });
    var lignes = out.slice(0, 8).map(function (x) {
      var sais = x.indice >= 1.15 ? ' · <b style="color:#6D5AE6">saison ×' + x.indice.toFixed(2).replace('.', ',') + '</b>' : '';
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap((x.nom || '').toLowerCase())) + '</b>' +
        '<small>cible ~' + fmt(x.cible) + ' u · détenu ' + fmt(x.detenu) +
        ' · part ' + (x.part * 100).toFixed(2).replace('.', ',') + ' % (' + x.libelle + ')' + sais + '</small></div>' +
        '<div class="ap-mini"><b style="color:#B02A37">−' + fmt(x.ecart) + '</b></div></div>';
    }).join('');
    return card('pilo', 'Écart au marché France',
      'ce que le marché national dit qu’il faudrait tenir ce mois-ci, comparé à votre stock',
      lignes + (out.length > 8 ? '<div class="ap-foot" style="margin:0;padding:7px 2px">+ ' + (out.length - 8) + ' autres</div>' : ''),
      'var(--ip-blue)') +
      '<div class="ap-foot" style="margin:0">Modèle national (Open Medic + Medic’AM), calculé <b>sans vos données</b>. ' +
      'La part de marché utilisée est indiquée ligne par ligne : <b>mesuré</b> = sur vos ventes réelles, ' +
      '<b>estimé</b> = déduit de la famille ou de votre moyenne. Seul le « détenu » vient de votre inventaire.</div>';
  }

  // ═══ LISTE B — hors catalogue : ce que nos données ne peuvent PAS voir ═══
  // Jamais dans le carnet d'achat : c'est du développement de gamme, pas du réassort.
  // ⚠️ On raisonne par MOLÉCULE, pas par code produit. Comparer code à code faisait remonter
  // « paracétamol » ou « macrogol » comme non distribués alors qu'Intégral vend Doliprane et
  // Movicol — une présentation générique manquait, c'est tout. Et la même molécule sortait
  // 3 fois. Une molécule dont on vend NE SERAIT-CE QU'UNE présentation est donc écartée.
  function horsCatalogue() {
    if (!_natData || !_natData.data) return [];
    var idx = cipIndex(), d = _natData.data, glob = partGlobale();
    var vendues = {}, agg = {};
    Object.keys(idx).forEach(function (c) {
      var n = d[c];
      if (n && n.d) vendues[n.d] = 1;
    });
    Object.keys(d).forEach(function (c) {
      var n = d[c];
      if (!n.v || !n.d) return;
      if (vendues[n.d]) return;                // molécule déjà distribuée sous une forme
      var a = agg[n.d] || (agg[n.d] = { dci: n.d, vol: 0, nRef: 0, gen: 0 });
      a.vol += n.v; a.nRef++; if (n.g) a.gen = 1;
    });
    var out = [];
    Object.keys(agg).forEach(function (m) {
      var a = agg[m];
      if (a.vol < 200000) return;              // sous 200 000 boîtes/an France : pas un enjeu
      a.potentiel = Math.round(a.vol * glob);
      out.push(a);
    });
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return out.slice(0, 10);
  }
  function horsCatalogueCard() {
    var l = horsCatalogue();
    if (!l.length) return '';
    var glob = partGlobale();
    var lignes = l.map(function (x) {
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap((x.dci || '').toLowerCase())) + '</b>' +
        '<small>' + fmt(x.vol) + ' boîtes/an en France · ' + x.nRef + ' présentation' + (x.nRef > 1 ? 's' : '') +
        (x.gen ? ' · générique existant' : '') + '</small></div>' +
        '<div class="ap-mini">~' + fmt(x.potentiel) + ' u/an</div></div>';
    }).join('');
    return card('cat', 'Hors catalogue — gros marché non référencé',
      'molécules qui pèsent en France dont vous ne distribuez <b>aucune</b> présentation — le modèle national voit ce que vos ventes ne peuvent pas voir',
      lignes, 'var(--c-amber)') +
      '<div class="ap-foot" style="margin:0">Potentiel = volume France × votre part moyenne (' +
      (glob * 100).toFixed(2).replace('.', ',') + ' %). <b>Estimation de cadrage</b>, jamais un engagement — ' +
      'et volontairement tenu hors du carnet d’achat du jour.</div>';
  }

  function carnet() {
    var idx = cipIndex();
    if (!idx || !Object.keys(idx).length) return null;
    var sai = (_saiCip && _saiCip.data) || {};
    var genSet = null;
    if (_generData && _generData.princepsWithGeneric) { genSet = {}; _generData.princepsWithGeneric.forEach(function (c) { genSet[c] = 1; }); }
    var now = new Date().getMonth() + 1, win = [now % 12 + 1, (now + 1) % 12 + 1, (now + 2) % 12 + 1];
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var acts = [], C = { buy: 0, sec: 0, pre: 0, arb: 0, red: 0, eur: 0, redEur: 0, eurInconnu: 0, nInconnu: 0, eurPre: 0 };
    Object.keys(idx).forEach(function (c) {
      var o = idx[c];
      if (o.vM < 3) return;   // audit data#1 : ne plus retenir un produit juste parce que son PPHT est à rafraîchir (stale ≠ dormant)
      var rupt = V2.rupture ? !!V2.rupture(c) : false;
      var s = sai[c], sUp = 0, sM = 0;
      if (s && s.i) win.forEach(function (m) { if (s.i[m - 1] > sUp) { sUp = s.i[m - 1]; sM = m; } });
      var seasonUp = sUp >= (sM === 1 ? 1.5 : 1.2);   // audit P2 : pic janvier = renouvellements chroniques → seuil relevé
      var isGen = genSet ? !!genSet[c] : false;
      var verdict, cls, prio, qty = 0, reason = '';
      // audit 01/08 : « stock inconnu » = on n'a jamais inventorié la réf, pas qu'elle est à zéro.
      var secTxt = o.unk ? 'stock inconnu — à vérifier avant de commander' : secLab(o.cov);
      function engager(e, kind) {
        if (o.unk) { C.eurInconnu += e; C.nInconnu++; }
        else if (kind === 'pre') C.eurPre += e;
        else C.eur += e;
      }
      if (o.cov > 90 && o.st > 0) {   // audit data#1 : ALLÉGER = vraie sur-couverture (>90 j), plus jamais sur le flag stale (tarif à rafraîchir)
        verdict = 'ALLÉGER'; cls = 'red'; prio = 1; reason = (o.cov >= 9999 ? 'invendu' : Math.round(o.cov) + ' j de stock');
        C.red++; C.redEur += o.st * (o.ppht || 0);
      } else if (o.cov < 7 && o.vM >= 5) {
        qty = o.qcmd;
        if (rupt) { verdict = 'SÉCURISER'; cls = 'sec'; reason = 'tension ANSM · ' + secTxt + ' — commander maintenant'; C.sec++; }
        else { verdict = 'ACHETER'; cls = 'buy'; reason = secTxt + ' — commander maintenant'; C.buy++; }
        prio = 5; engager(qty * (o.ppht || 0), 'buy');
        // La cible de couverture n'est pas toujours 21 jours : elle passe à 30 en cas de
        // tension ANSM ou de marché en hausse (cibleJ, cipIndex). Comparer la couverture à
        // 21 en dur écartait du carnet 143 références en manque réel — dont NIMENRIX
        // (tension ANSM, 26 j de stock, 113 unités manquantes), invisible partout, et des
        // princeps qui ressortaient « ARBITRER » avec une quantité à zéro.
        // `qcmd > 0` dit déjà « sous la cible » : c'est le seul test qui vaille.
      } else if (o.qcmd > 0) {
        verdict = 'ACHETER'; cls = 'buy'; prio = 4; qty = o.qcmd;
        reason = o.unk ? secTxt : ('à sec ~' + dtLabel(o.cov) + ' · commander avant ' + dtLabel(o.cov - ORDER_LEAD)); C.buy++; engager(qty * (o.ppht || 0), 'buy');
      } else if (seasonUp) {
        verdict = 'PRÉ-ACHETER'; cls = 'pre'; prio = 3;
        qty = Math.max(o.qcmd, Math.round(o.vM / 30 * 21 * sUp - o.st)); if (qty < 0) qty = 0;
        reason = 'pic ' + MOIS_L[sM - 1] + ' +' + Math.round((sUp - 1) * 100) + '%'; C.pre++; engager(qty * (o.ppht || 0), 'pre');
      } else if (isGen) {
        verdict = 'ARBITRER'; cls = 'arb'; prio = 2; reason = 'générique dispo → basculer'; C.arb++;
      } else return;
      var mitm = isMitm(c);
      if (mitm && (cls === 'sec' || cls === 'buy')) prio += 0.5;   // médicament critique → remonte dans le carnet
      var cmdDays = null;   // jours avant la date limite de commande (pour le calendrier). arb/red = pas de date.
      if (cls === 'buy' || cls === 'sec') cmdDays = Math.max(0, Math.round(o.cov - ORDER_LEAD));
      else if (cls === 'pre') { var nm = new Date().getMonth() + 1, ma = ((sM - nm) + 12) % 12; cmdDays = Math.max(7, ma * 30 - 42); }
      // score d'urgence : n'a de sens que pour ce qu'on doit COMMANDER (alléger/arbitrer = autre logique)
      var score = (cls === 'buy' || cls === 'sec' || cls === 'pre') ? urgence(o, rupt, mitm, seasonUp) : null;
      acts.push({ c: c, name: (ps[c] && ps[c].d) || c, o: o, v: verdict, cls: cls, prio: prio, qty: qty, reason: reason, rupt: rupt, season: seasonUp, gen: isGen, mitm: mitm, cmdDays: cmdDays, score: score });
    });
    acts.sort(function (a, b) { return (b.prio - a.prio) || ((b.score || 0) - (a.score || 0)) || (a.o.cov - b.o.cov); });
    _carnetActs = acts;
    return { acts: acts, counts: C };
  }
  function carnetRow(x) {
    var chips = scoreBadge(x.score);
    if (x.o && x.o.abc) chips += ' <span class="ap-tag" title="poids dans la valeur réseau : A = cœur de gamme, C = traîne" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">' + x.o.abc + '</span>';
    if (x.o && x.o.unk) chips += ' <span class="ap-tag" title="cette référence n\'a jamais été inventoriée : la quantité proposée est une estimation" style="color:#6B7280;background:var(--card-2,#F6F8FB);border:1px dashed var(--line)">stock inconnu</span>';
    var dejaCmd = commandeDe(x.c, new Date().toISOString().slice(0, 10));
    if (dejaCmd) chips += ' <span class="ap-tag" title="déjà exporté dans une commande — vérifie avant de recommander" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">déjà commandé ' + fdate(dejaCmd) + '</span>';
    if (x.mitm) { chips += estCritique(x) ? ' <span class="ap-tag" style="color:#B02A37;background:#FDE7EA;border:1px solid #F3B0BC">critique</span>' : ' <span class="ap-tag" style="color:#6B7280;background:var(--card-2,#F6F8FB);border:1px solid var(--line)">surveillé ANSM</span>'; }   // audit P3 : « critique » réservé au croisement avec l'état de stock — même règle partout (estCritique)
    if (x.rupt) chips += ' <span class="ap-tag ru">ANSM</span>';
    if (x.season) chips += ' <span class="ap-tag" style="color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5">saison</span>';
    if (x.gen && x.cls !== 'arb') chips += ' <span class="ap-tag" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">Gx</span>';
    return '<div class="cb-row" onclick="V2.approTicket(\'' + esc(x.c) + '\')"><span class="cb-tag cb-' + x.cls + '">' + x.v + '</span>' +
      '<div class="cb-nm">' + esc(cap((x.name || '').toLowerCase())) + '<small>' + x.reason + chips + '</small></div>' +
      '<div class="cb-cov">' + covBadge(x.o.cov) + '</div>' +
      '<div class="cb-qt">' + (x.qty > 0 ? '+' + fmt(x.qty) + '<small>u</small>' : '—') + '</div></div>';
  }
  V2.approTab = function (t) { _bookTab = t; if (V2.render) V2.render(); };

  // ═══ LA COURBE — prévision du marché France à 3 / 6 / 12 mois ═══════════════
  // Source : previsions.json (Medic'AM 2021→2026, modèle Chronos-2 d'Amazon, Apache-2.0).
  // Choisi par backtest sur 9 472 produits, futur caché : il bat la moyenne des 3 derniers
  // mois de 9 % à 3 mois et de 22 % à 12 mois, y compris sur les gros volumes.
  // ⚠️ On transporte une ÉVOLUTION, jamais un volume national : la part de marché du réseau
  // varie trop d'un produit à l'autre (0,04 % à 0,26 % entre quartiles) pour être appliquée
  // en bloc. L'évolution, elle, se lit sur la vitesse réelle du réseau.
  var _prevState = 0, _prevData = null;
  function ensurePrev() {
    if (_prevData || _prevState) return;
    _prevState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('previsions.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _prevData = j || {}; _prevState = 2; approRerender(); })
        .catch(function () { _prevState = 2; });
    } catch (e) { _prevState = 2; }
  }
  // [m3,b3,h3, m6,b6,h6, m12,b12,h12, bascule, fiable] — en % du rythme des 3 derniers mois connus
  function prev(c) {
    var d = _prevData && _prevData.data;
    return (d && d[String(c)]) || null;
  }
  function pctEvo(v) {
    var e = v - 100;
    var cls = e > 4 ? 'ap-up' : (e < -4 ? 'ap-down' : 'ap-flat');
    return '<span class="' + cls + '">' + (e > 0 ? '+' : '') + Math.round(e) + ' %</span>';
  }
  function previsionCard() {
    if (_prevState === 2 && (!_prevData || !_prevData.data)) return '';
    if (!_prevData) return card('spark', 'La courbe — ce que le marché va faire',
      'chargement de la prévision…', '<div class="ap-empty">…</div>', '#6D5AE6');
    var idx = cipIndex(), lignes = [];
    Object.keys(idx).forEach(function (c) {
      var o = idx[c], p = prev(c);
      if (!p || !p[10] || o.vM < MINVEL) return;       // p[10] = fourchette exploitable
      lignes.push({ c: c, d: o.d, vM: o.vM, m3: p[0], b3: p[1], h3: p[2], m12: p[6],
                    bascule: p[9], imp: Math.abs(p[0] - 100) / 100 * o.vM * 3 });
    });
    if (!lignes.length) return '';
    lignes.sort(function (a, b) { return b.imp - a.imp; });
    var haut = lignes.filter(function (l) { return l.m3 >= 110; }).slice(0, 7);
    var bas  = lignes.filter(function (l) { return l.m3 <= 90; }).slice(0, 7);
    function ligneHtml(l) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap((l.d || l.c).toLowerCase())) +
        '<small>' + fmt(Math.round(l.vM)) + ' /mois réseau · fourchette ' +
        (l.b3 - 100 > 0 ? '+' : '') + Math.round(l.b3 - 100) + ' à ' +
        (l.h3 - 100 > 0 ? '+' : '') + Math.round(l.h3 - 100) + ' % · à 12 mois ' +
        (l.m12 - 100 > 0 ? '+' : '') + Math.round(l.m12 - 100) + ' %</small></div>' +
        '<div class="ap-g">' + pctEvo(l.m3) + '</div></div>';
    }
    function titre(txt) {
      return '<div class="ap-foot" style="padding:11px 18px 2px;margin:0;font-weight:800;' +
        'color:var(--ip-ink);text-transform:uppercase;letter-spacing:.04em;font-size:11px">' + txt + '</div>';
    }
    // le produit dont l'écart pèse le plus en boîtes ouvre la carte, dessiné
    var vedette = lignes[0], grHtml = '';
    try {
      var pv = prev(vedette.c);
      if (pv) grHtml = '<div class="pv-hd"><b>' + esc(cap((vedette.d || vedette.c).toLowerCase())) + '</b>' +
        '<span>' + fmt(Math.round(vedette.vM)) + ' boîtes/mois réseau · ' +
        (vedette.m3 - 100 > 0 ? '+' : '') + Math.round(vedette.m3 - 100) + ' % à 3 mois, ' +
        'fourchette ' + (vedette.b3 - 100 > 0 ? '+' : '') + Math.round(vedette.b3 - 100) + ' à ' +
        (vedette.h3 - 100 > 0 ? '+' : '') + Math.round(vedette.h3 - 100) + ' %</span></div>' + courbeSvg(pv);
    } catch (e) { grHtml = ''; }

    var corps = grHtml;
    if (haut.length) corps += titre('Ça va monter') + haut.map(ligneHtml).join('');
    if (bas.length)  corps += titre('Ça va baisser') + bas.map(ligneHtml).join('');
    if (!corps) corps = '<div class="ap-empty">Marché stable sur ton périmètre : aucun mouvement marqué à 3 mois.</div>';
    var basc = lignes.filter(function (l) { return l.bascule >= 200 || l.bascule <= 50; })
                     .sort(function (a, b) { return b.vM - a.vM; }).slice(0, 5);
    if (basc.length) {
      corps += titre('Changements de régime') + basc.map(function (l) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap((l.d || l.c).toLowerCase())) +
          '<small>' + fmt(Math.round(l.vM)) + ' /mois réseau · rythme récent à ' + l.bascule +
          ' % de son année</small></div><div class="ap-st ' + (l.bascule >= 200 ? 'ok">en lancement' : 'ko">en extinction') +
          '</div></div>';
      }).join('');
    }
    var maj = esc(_prevData.dernier_mois_reel || '');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">' +
      ICO('spark', 15, 2) + '</div><div><h3>La courbe — ce que le marché va faire</h3>' +
      '<div class="ap-sub">marché France sur ton périmètre · dernier mois réel ' + maj +
      ' · l\'évolution s\'applique à ta vitesse réseau, jamais un volume national</div></div></div>' + corps +
      '<div class="ap-foot" style="padding:10px 18px 12px;margin:0">Prévision Chronos-2 (Amazon, libre) ' +
      'sur Medic\'AM — boîtes remboursées France, 2021 à ' + maj + '. ' + fmt(_prevData.n || 0) +
      ' produits couverts. Choisi par test à futur caché : il fait 9 % d\'erreur en moins qu\'une moyenne ' +
      '3 mois à 3 mois, 22 % en moins à 12 mois. ' +
      'Évolution donnée en % du rythme des 3 derniers mois connus. Les séries trop instables pour décider ' +
      'un achat ne sont pas affichées.</div></div>';
  }


  // ═══ PROFIL D'ACHAT : ce que prend UNE pharmacie, pas le réseau entier ═════
  // Un volume réseau ne dit pas comment commander : 8 000 boîtes chez 400 officines
  // (20 chacune) et 8 000 chez 20 officines (400 chacune) sont deux achats opposés.
  // Mesuré le 02/09/2026 sur les ventes réelles : la MOYENNE ment presque partout.
  // Seresta 10 mg — médiane 2 boîtes/mois par pharmacie, moyenne 13,6 (×7) ; sur les
  // 15 plus gros volumes, les 20 % de pharmacies les plus grosses font 47 à 63 % du
  // total. Commander sur la moyenne, c'est commander pour une pharmacie qui n'existe pas.
  // Tout est calculé depuis WML_SALES déjà chargé : aucun fichier à régénérer.
  var _profil = null, _profilRef = null;
  function profilIndex() {
    var S = window.WML_SALES;
    if (!S || !S.length) return {};
    if (_profil && _profilRef === S) return _profil;
    var MR = moisRetenus(S), garde = {}, k;
    for (k = 0; k < MR.length; k++) garde[MR[k]] = 1;
    var nMois = MR.length || 1;
    var parPh = {}, parCom = {};
    for (var j = 0; j < S.length; j++) {
      var r = S[j], q = r[4] || 0;
      if (q <= 0 || !garde[r[1]]) continue;
      var c = String(r[3]);
      var a = parPh[c] || (parPh[c] = {}); a[r[0]] = (a[r[0]] || 0) + q;
      var b = parCom[c] || (parCom[c] = {}); b[r[2]] = (b[r[2]] || 0) + q;
    }
    var out = {};
    Object.keys(parPh).forEach(function (c) {
      var a = parPh[c], v = [], tot = 0, p;
      for (p in a) if (a.hasOwnProperty(p)) { v.push(a[p]); tot += a[p]; }
      if (!v.length || tot <= 0) return;
      v.sort(function (x, y) { return x - y; });
      var n = v.length;
      var med = (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) / nMois;
      // concentration : part du volume faite par les 20 % de pharmacies les plus grosses
      var n20 = Math.max(1, Math.round(n * 0.2)), s20 = 0;
      for (var i = n - n20; i < n; i++) s20 += v[i];
      // le commercial qui porte le produit — un produit tenu par un seul secteur est fragile
      var bc = parCom[c] || {}, meilleur = '', vmax = 0, nCom = 0, tc = 0, x;
      for (x in bc) if (bc.hasOwnProperty(x)) { nCom++; tc += bc[x]; if (bc[x] > vmax) { vmax = bc[x]; meilleur = x; } }
      out[c] = { nph: n, med: med, moy: tot / n / nMois, conc: s20 / tot * 100,
                 nCom: nCom, com: meilleur, partCom: tc > 0 ? vmax / tc * 100 : 0 };
    });
    _profil = out; _profilRef = S;
    return out;
  }

  // ═══ LA FOURCHETTE DESSINÉE ═══════════════════════════════════════════════
  // Aucun des 12 outils d'achat professionnels examinés le 02/09/2026 (RELEX, o9, Kinaxis,
  // Netstock, Inventory Planner, Cin7, Odoo…) ne trace une vraie bande min/max : au mieux
  // des pointillés ou des scénarios. C'est le geste différenciant de l'outil.
  // Conventions reprises du métier : constaté en TRAIT PLEIN, attendu en POINTILLÉ, et une
  // aire qui s'ÉLARGIT avec l'horizon — parce que c'est vrai, donc ça se dessine.
  // ⚠️ Robinhood s'est fait critiquer pour avoir CACHÉ l'incertitude : trop simplifier une
  // fourchette, c'est mentir. On montre la borne basse ET la borne haute, toujours.

  // ═══ LE RUBAN — le seul emprunt décoratif à la salle des marchés ══════════
  // Règle que je me suis fixée en le dessinant, et qui doit tenir : il ne porte QUE ce sur
  // quoi on peut agir aujourd'hui — les urgences du carnet et les mouvements de marché les
  // plus lourds. Jamais un fil d'actualité : ça fatiguerait et ça ferait perdre à JARVIS sa
  // sobriété. Court, lent (45 s le tour), en pause au survol, et immobile si l'utilisateur
  // a demandé moins d'animations.
  function rubanHtml() {
    var idx = {}, out = [];
    try { idx = cipIndex(); } catch (e) { return ''; }
    var urg = [];
    Object.keys(idx).forEach(function (c) {
      var o = idx[c];
      if (o.unk || o.vM < MINVEL || o.qcmd <= 0 || o.cov > 3) return;
      urg.push(o);
    });
    urg.sort(function (a, b) { return a.cov - b.cov || b.vM - a.vM; });
    urg.slice(0, 4).forEach(function (o) {
      out.push('<span><b>' + esc(cap((o.d || o.c).toLowerCase()).slice(0, 26)) + '</b> ' +
        '<em class="rb-j0">' + Math.round(o.cov) + ' j</em> · +' + fmt(o.qcmd) + '</span>');
    });
    // les mouvements de marché les plus lourds en boîtes, hausses ET baisses
    var mv = [];
    Object.keys(idx).forEach(function (c) {
      var o = idx[c], pv = prev(c);
      if (!pv || !pv[10] || o.vM < MINVEL) return;
      if (pv[0] >= 112 || pv[0] <= 88) mv.push({ d: o.d || c, e: pv[0] - 100, imp: Math.abs(pv[0] - 100) * o.vM });
    });
    mv.sort(function (a, b) { return b.imp - a.imp; });
    mv.slice(0, 4).forEach(function (m) {
      var h = m.e > 0;
      out.push('<span><b>' + esc(cap(String(m.d).toLowerCase()).slice(0, 26)) + '</b> ' +
        '<em class="' + (h ? 'rb-up' : 'rb-dn') + '">' + (h ? '▲ +' : '▼ ') + Math.round(m.e) + ' %</em> 3 mois</span>');
    });
    if (_ansmData && _ansmData.meta && _ansmData.meta.byStatut) {
      var b = _ansmData.meta.byStatut;
      var nt = (b.tension || 0), nr = (b.rupture || 0);
      if (nt || nr) out.push('<span><b>ANSM</b> ' + nt + ' tensions · ' + nr + ' ruptures</span>');
    }
    if (out.length < 3) return '';
    var age = '';
    try {
      var g = window.STOCK_IP && window.STOCK_IP.meta && window.STOCK_IP.meta.gen;
      if (g) age = '<span class="rb-fl">stock plateforme arrêté au ' +
        esc(g.split('-').reverse().join('/')) + ' — photographie</span>';
    } catch (e) {}
    var suite = out.join('') + age;
    // dupliqué une fois : c'est ce qui rend le défilement continu sans saut
    return '<div class="rb"><div class="rb-in">' + suite + suite + '</div></div>';
  }

  function courbeSvg(p) {
    if (!p) return '';
    var W = 640, H = 132, y0 = 96;                 // y0 = la ligne « rythme actuel » (100 %)
    // échelle : on cadre sur l'amplitude réelle, bornée pour rester lisible
    var vals = [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]];
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    lo = Math.min(lo, 100); hi = Math.max(hi, 100);
    var amp = Math.max(30, hi - lo);
    function y(v) { return Math.round(y0 - (v - 100) / amp * 62); }
    var xs = [W * 0.42, W * 0.62, W * 0.80, W];    // aujourd'hui, 3, 6, 12 mois
    var med = [p[0], p[3], p[6]], bas = [p[1], p[4], p[7]], hau = [p[2], p[5], p[8]];
    var aire = 'M' + xs[0] + ',' + y0;
    for (var i = 0; i < 3; i++) aire += ' L' + Math.round(xs[i + 1]) + ',' + y(hau[i]);
    for (i = 2; i >= 0; i--) aire += ' L' + Math.round(xs[i + 1]) + ',' + y(bas[i]);
    aire += ' Z';
    var ligne = xs[0] + ',' + y0;
    for (i = 0; i < 3; i++) ligne += ' ' + Math.round(xs[i + 1]) + ',' + y(med[i]);
    var pts = '';
    for (i = 0; i < 3; i++) pts += '<circle cx="' + Math.round(xs[i + 1]) + '" cy="' + y(med[i]) + '" r="3.5" fill="var(--ip-blue)"/>';
    return '<div class="pv-gr"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="Prévision à 3, 6 et 12 mois avec sa fourchette basse et haute">' +
      '<defs><linearGradient id="pvA" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#0050E6" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="#0050E6" stop-opacity=".05"/></linearGradient></defs>' +
      '<line x1="0" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '" stroke="rgba(16,19,28,.12)"/>' +
      '<polyline points="0,' + y0 + ' ' + Math.round(xs[0]) + ',' + y0 + '" fill="none" stroke="#10131C" stroke-width="2"/>' +
      '<path d="' + aire + '" fill="url(#pvA)"/>' +
      '<polyline points="' + ligne + '" fill="none" stroke="var(--ip-blue)" stroke-width="2.2" stroke-dasharray="6 5"/>' + pts +
      '<line x1="' + Math.round(xs[0]) + '" y1="14" x2="' + Math.round(xs[0]) + '" y2="' + (H - 16) + '" stroke="rgba(16,19,28,.16)" stroke-dasharray="3 4"/>' +
      '</svg><div class="pv-ax"><span>aujourd’hui</span><span>3 mois</span><span>6 mois</span><span>12 mois</span></div>' +
      '<div class="pv-lg"><span><i style="background:#10131C"></i>constaté</span>' +
      '<span><i style="background:var(--ip-blue)"></i>attendu</span>' +
      '<span><i style="background:#C4D6F8"></i>fourchette basse → haute</span>' +
      '<span class="pv-note">plus l’horizon s’éloigne, plus la fourchette s’ouvre — c’est vrai, donc c’est dessiné</span></div></div>';
  }

  function profilLigne(cip) {
    var pr = profilIndex()[String(cip)];
    if (!pr || pr.nph < 3) return '';
    var dec = pr.med < 10 ? 1 : 0;
    var alerte = (pr.med > 0 && pr.moy / pr.med >= 3)
      ? '<div class="tk-warn">Quelques pharmacies font le volume — la moyenne (' +
        pr.moy.toFixed(dec) + '/mois) vaut ' + Math.round(pr.moy / pr.med) +
        ' fois la pharmacie type. Commander sur la moyenne mènerait au surstock.</div>' : '';
    var seul = (pr.nCom === 1)
      ? '<div class="tk-warn">Un seul secteur achète ce produit (' + esc(pr.com) +
        ') : le volume tient à un commercial.</div>'
      : (pr.partCom >= 60 ? '<div class="tk-warn">' + esc(pr.com) + ' fait ' +
         Math.round(pr.partCom) + ' % du volume de ce produit.</div>' : '');
    return '<div class="tk-price"><b>' + fmt(pr.nph) + ' pharmacies</b> en prennent · ' +
      'une pharmacie type : <b>' + pr.med.toFixed(dec) + ' /mois</b> · ' +
      'les 20 % les plus grosses font <b>' + Math.round(pr.conc) + ' %</b> du volume</div>' +
      alerte + seul;
  }


  // ═══ D'OÙ VIENT LA DEMANDE — par secteur commercial ═══════════════════════
  // Le volume réseau ne dit pas d'où il vient. Mesuré le 02/09/2026 : entre le
  // secteur le plus dense et le moins dense, l'écart va de 1 017 à 372 boîtes par
  // pharmacie et par mois — presque 3 fois. Un même produit acheté « pour le réseau »
  // ne se consomme donc pas du tout au même rythme selon le secteur.
  function secteursCard() {
    var S = window.WML_SALES;
    if (!S || !S.length) return '';
    var MR = moisRetenus(S), garde = {}, k;
    for (k = 0; k < MR.length; k++) garde[MR[k]] = 1;
    var nMois = MR.length || 1;
    var par = {};
    for (var j = 0; j < S.length; j++) {
      var r = S[j], q = r[4] || 0;
      if (q <= 0 || !garde[r[1]]) continue;
      var co = r[2] || '—', a = par[co] || (par[co] = { q: 0, ph: {}, ref: {}, ca: 0 });
      a.q += q; a.ph[r[0]] = 1; a.ref[String(r[3])] = 1; a.ca += (r[6] || 0);
    }
    var lst = Object.keys(par).map(function (co) {
      var a = par[co], n = Object.keys(a.ph).length;
      return { co: co, n: n, q: a.q / nMois, ref: Object.keys(a.ref).length,
               dens: a.q / nMois / (n || 1), ca: a.ca / nMois };
    }).filter(function (x) { return x.n > 0; });
    if (!lst.length) return '';
    lst.sort(function (a, b) { return b.q - a.q; });
    var dmax = Math.max.apply(null, lst.map(function (x) { return x.dens; })) || 1;
    var rows = lst.map(function (x) {
      var w = Math.max(4, Math.round(x.dens / dmax * 100));
      return '<div class="ap-row"><div class="ap-nm">' + esc(x.co) +
        '<small>' + fmt(x.n) + ' pharmacies · ' + fmt(Math.round(x.q)) + ' boîtes/mois · ' +
        fmt(x.ref) + ' références</small>' +
        '<div class="sec-bar"><i style="width:' + w + '%"></i></div></div>' +
        '<div class="ap-g">' + fmt(Math.round(x.dens)) + '<small style="display:block;font-weight:500;color:var(--muted);font-size:10.5px">par pharmacie</small></div></div>';
    }).join('');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">' +
      ICO('pilo', 15, 2) + '</div><div><h3>D\'où vient la demande — par secteur</h3>' +
      '<div class="ap-sub">boîtes par mois et par pharmacie : deux secteurs de même taille ne consomment pas pareil</div></div></div>' +
      rows +
      '<div class="ap-foot" style="padding:10px 18px 12px;margin:0">Calculé sur les ' + nMois +
      ' mois complets retenus. La barre compare la densité — ce qu\'une pharmacie du secteur prend en moyenne chaque mois. ' +
      'Un secteur dense consomme un réassort plus vite à nombre d\'officines égal.</div></div>';
  }


  // ═══ POURQUOI ÇA CASSE — les causes de rupture (ANSM, robot mensuel) ═══════
  // L'app savait QUELS produits sont en tension. Elle ne savait pas POURQUOI.
  // ⚠️ Le chiffre qui justifie cette carte : en 2024, 28 % des ruptures françaises ont
  // pour cause « Augmentation du volume de vente » (1 150 cas sur 3 809). Un quart des
  // ruptures vient donc d'une demande qui MONTE — précisément ce que « La courbe » sait
  // voir venir trois mois à l'avance. C'est le pont entre prévoir et sécuriser.
  // Source : API publique du portail Datamed de l'ANSM. Années partielles écartées côté robot.
  var _causesState = 0, _causesData = null;
  function ensureCauses() {
    if (_causesData || _causesState) return;
    _causesState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('ansm-causes.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _causesData = j || {}; _causesState = 2; approRerender(); })
        .catch(function () { _causesState = 2; });
    } catch (e) { _causesState = 2; }
  }
  function causesCard() {
    var d = _causesData;
    if (_causesState === 2 && (!d || !d.causes)) return '';
    if (!d) return '';
    var an = d.derniere_complete;
    var lst = (d.causes || {})[String(an)] || [];
    if (!lst.length) return '';
    var tot = 0;
    for (var i = 0; i < lst.length; i++) tot += (lst[i].n || 0);
    // Le nombre RÉEL de signalements vient de parAn ; `tot` n'est que la somme des causes,
    // et un signalement peut en porter plusieurs (4 172 causes pour 3 809 signalements en
    // 2024). Afficher l'une pour l'autre gonflerait le chiffre de 10 %.
    var nSig = null;
    (d.parAn || []).forEach(function (x) { if (x.a === an) nSig = x.n; });
    var vol = null;
    for (i = 0; i < lst.length; i++) {
      if (/volume de vente/i.test(lst[i].c || '')) { vol = lst[i]; break; }
    }
    var rows = lst.slice(0, 6).map(function (c) {
      var w = tot > 0 ? Math.max(2, Math.round((c.n || 0) / tot * 100)) : 0;
      var fort = /volume de vente/i.test(c.c || '');
      return '<div class="ap-row"><div class="ap-nm">' + esc(c.c || '—') +
        '<small>' + fmt(c.n) + ' signalements' +
        (fort ? ' · <b style="color:var(--c-opp)">ce que la prévision sait voir venir</b>' : '') + '</small>' +
        '<div class="sec-bar"><i style="width:' + w + '%' +
        (fort ? ';background:var(--c-opp)' : '') + '"></i></div></div>' +
        '<div class="ap-g">' + Math.round(c.p || 0) + ' %</div></div>';
    }).join('');
    var tete = vol ? '<div class="ap-foot" style="padding:11px 18px 0;margin:0;font-size:12.5px;color:var(--ip-ink)">' +
      '<b>' + Math.round(vol.p) + ' % des ruptures viennent d\'une demande qui monte</b> — ' +
      fmt(vol.n) + ' cas en ' + an + '. Ce n\'est pas une fatalité à subir : ' +
      'c\'est exactement ce que « La courbe » annonce trois mois à l\'avance.</div>' : '';
    // les classes thérapeutiques les plus touchées — où le risque se concentre
    var atc = ((d.atc || {})[String(an)] || []).slice(0, 4);
    var atcHtml = atc.length ? '<div class="ap-foot" style="padding:10px 18px 0;margin:0">' +
      '<b>Où ça casse le plus</b> — ' + atc.map(function (a) {
        return esc(cap((a.l || '').toLowerCase())) + ' (' + fmt(a.n) + ')';
      }).join(' · ') + '</div>' : '';
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">' +
      ICO('alert', 15, 2) + '</div><div><h3>Pourquoi ça casse — les causes de rupture</h3>' +
      '<div class="ap-sub">France entière, ' + an + ' · ' + (nSig ? fmt(nSig) + ' signalements ANSM' : '') +
      ' · ' + fmt(tot) + ' causes recensées (un signalement peut en porter plusieurs)</div></div></div>' +
      tete + rows + atcHtml +
      '<div class="ap-foot" style="padding:10px 18px 12px;margin:0">Source : ANSM, portail Datamed — ' +
      'la seule qui publie les causes. Historique ' + (d.annees ? d.annees[0] : '') + '→' + an +
      '. Les années encore incomplètes sont écartées : une année partielle passerait pour un ' +
      'effondrement des ruptures.</div></div>';
  }

  var _section = 'today';   // espace affiché : today / anticiper / stock / marche
  V2.approSec = function (s) { _section = s; if (V2.render) V2.render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  V2.approExport = function () {
    var buys = (_carnetActs || []).filter(function (a) { return a.qty > 0; });
    if (!buys.length) { try { alert('Aucune ligne à commander.'); } catch (e) {} return; }
    var lines = [['CIP', 'Produit', 'Action', 'Quantite', 'Couverture_jours', 'PrixNet_HT', 'Valeur_HT']];
    buys.forEach(function (a) { lines.push([a.c, a.name, a.v, a.qty, Math.round(a.o.cov), a.o.ppht || '', Math.round(a.qty * (a.o.ppht || 0))]); });
    var csv = lines.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    try {
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'carnet-achat-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
      // audit 01/08 : on retient ce qui vient de partir, sinon les mêmes lignes reviennent demain
      marquerCommande(buys.map(function (x) { return x.c; }), new Date().toISOString().slice(0, 10));
      if (V2.render) V2.render();
    } catch (e) {}
  };
  V2.approTicketClose = function () { var el = document.getElementById('appro-ticket'); if (el) el.style.display = 'none'; };
  V2.approTicket = function (cip) {
    cip = String(cip);
    var o = cipIndex()[cip]; if (!o) return;
    var P = window.PROD_STATS || [], p = null; for (var i = 0; i < P.length; i++) if (String(P[i].c) === cip) { p = P[i]; break; }
    var name = (p && p.d) || cip;
    // Demande sur TOUTE la période couverte (WML_MOIS, écrit par le générateur).
    // Bornée en dur à 6, la courbe perdait le dernier mois importé sans aucun message.
    var MOIS = (window.WML_MOIS || []).map(function (ym) { return +ym.split('-')[1]; });
    if (!MOIS.length) MOIS = [1, 2, 3, 4, 5, 6];
    var rang = {}; MOIS.forEach(function (m, k) { rang[m] = k; });
    var series = MOIS.map(function () { return 0; }), S = window.WML_SALES || [];
    for (var j = 0; j < S.length; j++) { var r = S[j]; if (String(r[3]) === cip && r[4] > 0 && rang[r[1]] !== undefined) series[rang[r[1]]] += r[4]; }
    var mx = Math.max.apply(null, series) || 1;
    var MSA = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var MS = MOIS.map(function (m) { return MSA[m - 1]; });
    var spark = '<div class="tk-spark">' + series.map(function (v, k) {
      return '<div class="tk-bar"><i style="height:' + Math.round(6 + v / mx * 66) + 'px"></i><b>' + fmt(v) + '</b><span>' + MS[k] + '</span></div>';
    }).join('') + '</div>';
    // stock par site (ETAB, NR)
    var EP = window.ETAB_PRICES, sitesHtml = '';
    if (EP && EP.prices && EP.etabs) {
      var per = EP.etabs.map(function (e) { var v = (EP.prices[e.code] && EP.prices[e.code][cip]) ? Math.max(0, EP.prices[e.code][cip][1]) : 0; return { code: e.code, v: v }; });
      var tot = per.reduce(function (a, b) { return a + b.v; }, 0);
      if (tot > 0) {
        var smx = Math.max.apply(null, per.map(function (x) { return x.v; })) || 1;
        sitesHtml = '<div class="tk-h">Stock par établissement</div><div class="tk-sites">' +
          per.map(function (x) { return '<div class="tk-site"><i style="height:' + Math.round(4 + x.v / smx * 30) + 'px"></i><span>' + x.code + '</span><b>' + fmt(x.v) + '</b></div>'; }).join('') + '</div>';
      }
    }
    // signaux
    var sig = [];
    if (isMitm(cip)) { var mc = (V2.rupture && V2.rupture(cip)) || (o && o.cov < 7); sig.push(mc ? '<span class="ap-tag" style="color:#B02A37;background:#FDE7EA;border:1px solid #F3B0BC">critique — MITM en tension</span>' : '<span class="ap-tag" style="color:#6B7280;background:var(--card-2,#F6F8FB);border:1px solid var(--line)">MITM — surveillé ANSM</span>'); }
    if (V2.rupture && V2.rupture(cip)) sig.push('<span class="ap-tag ru">tension ANSM</span>');
    var sai = _saiCip && _saiCip.data && _saiCip.data[cip];
    if (sai) { var pk = sai.p; sig.push('<span class="ap-tag" style="color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5">pic saison ' + MOIS_L[pk - 1] + '</span>'); }
    if (_generData && _generData.princepsWithGeneric && _generData.princepsWithGeneric.indexOf(cip) >= 0) sig.push('<span class="ap-tag" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">générique dispo</span>');
    var mo = V2.momentum ? V2.momentum(cip) : null;
    if (mo != null) sig.push('<span class="ap-tag" style="color:' + (mo > 0 ? 'var(--c-opp)' : '#a8651a') + ';background:var(--card-2,#F6F8FB);border:1px solid var(--line)">momentum ' + (mo > 0 ? '▲' : '▼') + '</span>');
    // ── Ce que dit le marché France, à côté de ce que disent nos ventes ──
    // Volontairement AFFICHÉ, jamais appliqué : la quantité à commander reste calculée
    // sur nos ventes. Notre part varie de 0,035 % à 73 % selon le produit (mesuré le
    // 12/08/2026) — une cible nationale posée en plancher gonflerait les commandes sur
    // les 1 567 références où nous sommes sous 0,05 %. L'acheteur voit l'écart et tranche.
    var marcheLine = '';
    try {
      var cb = cibleNationale(cip, new Date().getMonth() + 1);
      if (cb && cb.unites) {
        var ecart = cb.unites - (o.st || 0);
        var teinte = o.unk ? '#6B7280' : (ecart > 0 ? '#B02A37' : '#1F7A3D');
        var verdict = o.unk
          ? 'stock inconnu — écart non calculable'
          : (ecart > 0 ? 'il manquerait ' + fmt(ecart) + ' u' : 'vous êtes au-dessus de la cible');
        marcheLine = '<div class="tk-h">Ce que dit le marché France</div>' +
          '<div class="tk-nat"><div><b>' + fmt(cb.unites) + ' u</b><span>cible pour ce mois</span></div>' +
          '<div><b>' + fmt(o.st || 0) + ' u</b><span>votre stock</span></div>' +
          '<div><b style="color:' + teinte + '">' + verdict + '</b><span>part utilisée : ' +
          (cb.part * 100).toFixed(2).replace('.', ',') + ' % (' + esc(cb.libelle) + ')' +
          (cb.indice >= 1.15 ? ' · saison ×' + cb.indice.toFixed(2).replace('.', ',') : '') +
          '</span></div></div>' +
          '<div class="tk-natf">Calculé sans vos données, sauf le stock. <b>Indicatif</b> : la quantité ' +
          'proposée plus haut reste celle de vos ventes réelles.</div>';
      }
    } catch (e) { marcheLine = ''; }

    var net = p ? p.net : o.ppht, rpct = p ? p.rpct : 0;
    var kpis = '<div class="tk-kpis">' +
      '<div class="tk-kpi"><b>' + (o.cov >= 9999 ? 'jamais' : Math.round(o.cov) + ' j') + '</b><span>couverture</span></div>' +
      '<div class="tk-kpi"><b>' + fmt(Math.round(o.vM)) + '</b><span>ventes/mois</span></div>' +
      '<div class="tk-kpi"><b>' + fmt(o.st) + '</b><span>en stock</span></div>' +
      '<div class="tk-kpi"><b style="color:var(--c-opp)">' + (o.qcmd > 0 ? '+' + fmt(o.qcmd) : '—') + '</b><span>à commander</span></div>' +
      '</div>';
    var profilHtml = '';
    try { profilHtml = profilLigne(o.c); } catch (e) { profilHtml = ''; }
    var priceLine = '<div class="tk-price">Prix grossiste (PPHT) <b>' + (V2.fmtEur ? V2.fmtEur(o.ppht) : o.ppht) + '</b>' +
      (rpct > 0 ? ' · abandon de marge <b>' + (Math.round(rpct * 10) / 10) + ' %</b> → net <b>' + (V2.fmtEur ? V2.fmtEur(net) : net) + '</b>' : '') + '</div>';
    // projection du stock → date de rupture (le meilleur d'Aprobot, en clair)
    var proj = '', velDay = o.vM / 30;
    if (velDay > 0 && o.st > 0) {
      var W = 460, Hh = 76, npt = 24, horizon = Math.max(14, Math.min(75, Math.ceil(o.cov) + 7)), pts = [];
      for (var k = 0; k <= npt; k++) { var dd = horizon * k / npt, val = Math.max(0, o.st - velDay * dd); pts.push(Math.round(W * k / npt) + ',' + Math.round(Hh - (val / o.st) * Hh)); }
      var xr = Math.min(W, Math.round(W * o.cov / horizon)), xo = Math.min(W, Math.round(W * Math.max(0, o.cov - ORDER_LEAD) / horizon));
      proj = '<div class="tk-h">Projection du stock</div>' +
        '<div class="tk-proj"><svg viewBox="0 0 ' + W + ' ' + (Hh + 2) + '" preserveAspectRatio="none">' +
          '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0050E6" stroke-width="2.5" vector-effect="non-scaling-stroke"/>' +
          '<line x1="' + xo + '" y1="0" x2="' + xo + '" y2="' + Hh + '" stroke="#0E7C86" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
          '<line x1="' + xr + '" y1="0" x2="' + xr + '" y2="' + Hh + '" stroke="#D5573B" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
        '</svg></div>' +
        '<div class="tk-projlab"><b style="color:#0E7C86">commander avant ~' + dtLabel(o.cov - ORDER_LEAD) + '</b><b style="color:#D5573B">rupture ~' + dtLabel(o.cov) + '</b></div>';
    }
    var html = '<div class="tk-box"><button class="tk-x" onclick="V2.approTicketClose()">✕</button>' +
      '<div class="tk-title">' + esc(cap((name || '').toLowerCase())) + '</div>' +
      '<div class="tk-cip">CIP ' + esc(cip) + (p && p.f ? ' · ' + esc(p.f) : '') + '</div>' +
      (sig.length ? '<div class="tk-sig">' + sig.join(' ') + '</div>' : '') +
      kpis + priceLine + profilHtml + proj +
      '<div class="tk-h">Demande réseau (' + MOIS.length + ' mois)</div>' + spark +
      marcheLine + sitesHtml + '</div>';
    var el = document.getElementById('appro-ticket');
    if (!el) { el = document.createElement('div'); el.id = 'appro-ticket'; el.className = 'tk-ov'; el.onclick = function (e) { if (e.target === el) V2.approTicketClose(); }; document.body.appendChild(el); }
    el.innerHTML = html; el.style.display = 'flex';
  };

  // ═══ VUE CALENDRIER (synthèse experts) : calendrier d'ACTIONS groupé FOURNISSEUR ═══
  var _laboState = 0, _laboMap = null;
  function ensureLabo() {
    if (_laboMap || _laboState) return;
    _laboState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('labo-cip.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _laboMap = (j && j.data) || {}; _laboState = 2; approRerender(); })
        .catch(function () { _laboMap = {}; _laboState = 2; });
    } catch (e) { _laboMap = {}; _laboState = 2; }
  }
  function laboOf(c) { if (_laboMap && _laboMap[c]) return _laboMap[c]; var G = window.GENERIQUEURS; if (G && G[c]) return G[c]; return 'Divers'; }
  var _calSub = 'today';
  V2.approCal = function (s) { _calSub = s; if (V2.render) V2.render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  // audit UX : depuis le hero, ouvrir directement la liste filtrée sur un verdict (ex. « à sécuriser »).
  V2.approFocus = function (tab) { _section = 'today'; _calSub = 'list'; _bookTab = tab || 'all'; if (V2.render) V2.render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  var CLJ = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var CLCOL = { buy: '#0B7A4B', sec: '#C0392B', pre: '#6D5AE6' };   // audit UX : aligné sur le carnet (ACHETER vert, SÉCURISER rouge, PRÉ violet — une couleur = une action partout)
  function calDate(days) { return new Date(Date.now() + days * 86400000); }
  function calDayLab(d) { return CLJ[d.getDay()] + ' ' + d.getDate(); }
  // « critique » = médicament d'intérêt thérapeutique majeur ET réellement en danger
  // (rupture déclarée ou moins de 7 jours de couverture). Sans ce croisement, 57 % des
  // lignes à commander ressortaient « critiques » et le mot ne voulait plus rien dire.
  // La liste appliquait déjà cette règle de son côté ; le titre du jour et les pastilles
  // fournisseur, non — d'où « 562 critiques » en tête d'écran.
  function estCritique(a) { return !!(a && a.mitm && (a.rupt || (a.o && a.o.cov < 7))); }
  // Charge d'une journée, dans l'unité de tout l'écran : la COMMANDE (un fournisseur =
  // une commande). La bande des 7 jours comptait des lignes — mardi affichait 51 juste
  // au-dessus de « mar. 4 — 28 commandes », deux chiffres pour le même jour.
  function chargeJour(acts) {
    var a = acts || [];
    return { commandes: supGroup(a).length, lignes: a.length,
             critiques: a.filter(estCritique).length };
  }
  function supGroup(items) {
    var m = {}, order = [];
    items.forEach(function (a) {
      var k = laboOf(a.c), g = m[k];
      if (!g) { g = m[k] = { labo: k, lines: [], eur: 0, mitm: 0, cls: a.cls, prio: 0 }; order.push(k); }
      g.lines.push(a); g.eur += a.qty * (a.o.ppht || 0); if (estCritique(a)) g.mitm++;
      if (a.prio > g.prio) { g.prio = a.prio; g.cls = a.cls; }
    });
    return order.map(function (k) { return m[k]; }).sort(function (a, b) { return b.eur - a.eur; });
  }
  function supCardHtml(s) {
    // on montre les 3 lignes les PLUS URGENTES du fournisseur (score), pas les 3 premières venues
    var ord = s.lines.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    var lines = ord.slice(0, 3).map(function (a) {
      var sc = a.score != null ? '<i style="font-style:normal;font-size:11px;font-weight:700;color:' +
        (a.score >= 75 ? '#B02A37' : a.score >= 50 ? '#C77700' : '#6B7280') + ';margin-left:6px" title="score d\'urgence sur 100">' + a.score + '</i>' : '';
      var ab = (a.o && a.o.abc) ? '<i style="font-style:normal;font-size:10px;font-weight:700;color:#0E7C86;margin-left:5px" title="poids réseau (A = cœur de gamme)">' + a.o.abc + '</i>' : '';
      return '<button class="cl-line" onclick="event.stopPropagation();V2.approTicket(\'' + esc(a.c) + '\')">' +
        '<span>' + esc(cap((a.name || '').toLowerCase())) + sc + ab + '</span><b>' + (a.qty > 0 ? '+' + fmt(a.qty) : '—') + '</b></button>';
    }).join('');
    var more = s.lines.length > 3 ? '<div class="cl-more">+' + (s.lines.length - 3) + ' autres lignes</div>' : '';
    return '<div class="cl-sup" style="--c:' + (CLCOL[s.cls] || '#6B7280') + '"><div class="cl-suh"><b>' + esc(s.labo) + (s.mitm ? ' <span class="mitm"></span>' : '') +
      '</b><span>' + s.lines.length + ' ligne' + (s.lines.length > 1 ? 's' : '') + ' · ' + (V2.fmtEur ? V2.fmtEur(s.eur) : fmt(s.eur)) + '</span></div>' + lines + more + '</div>';
  }
  function calToggle() {
    var subs = [['today', 'Aujourd’hui'], ['week', 'Semaine'], ['month', 'Mois'], ['list', 'Toutes les lignes']];
    return '<div class="cl-tabs">' + subs.map(function (t) { return '<button class="cl-tab' + (_calSub === t[0] ? ' on' : '') + '" onclick="V2.approCal(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function calendarView(carnetHtml) {
    ensureLabo();
    var toggle = calToggle();
    if (_calSub === 'list') return toggle + (carnetHtml || '');
    var acts = (_carnetActs || []).filter(function (a) { return a.cmdDays != null; });
    if (!acts.length) return toggle + '<div class="v2-card" style="padding:22px;text-align:center;color:var(--muted)">Chargement du calendrier…</div>';
    var late = acts.filter(function (a) { return a.o.cov <= 1; });
    var byDay = {}; acts.forEach(function (a) { if (a.o.cov <= 1) return; (byDay[a.cmdDays] = byDay[a.cmdDays] || []).push(a); });
    var band = '';
    if (_calSub === 'today' || _calSub === 'week') {
      band = '<div class="cl-band">';
      for (var k = 0; k < 7; k++) { var d = calDate(k); var n = chargeJour((byDay[k] || []).concat(k === 0 ? late : [])).commandes; band += '<div class="cl-bd' + (k === 0 ? ' today' : '') + '"><div class="dn">' + CLJ[d.getDay()].replace('.', '') + '</div><div class="cn">' + (n || '·') + '</div></div>'; }
      band += '</div>';
    }
    var body = '';
    if (_calSub === 'today') {
      var t0 = late.concat(byDay[0] || []); var today = supGroup(t0);
      var nM = chargeJour(t0).critiques;
      body = '<div class="cl-today"><div class="cl-th">' + calDayLab(calDate(0)) + '</div>' +
        '<div class="cl-big">' + today.length + ' commande' + (today.length > 1 ? 's' : '') + ' à passer' + (nM ? ' · ' + nM + ' critique' + (nM > 1 ? 's' : '') : '') + '</div>' +
        (today.slice(0, 6).map(supCardHtml).join('') || '<div class="ap-empty">Rien à commander aujourd’hui ✓</div>') +
        (today.length > 6 ? '<div class="cl-more">+' + (today.length - 6) + ' autres labos</div>' : '') + '</div>';
      body += '<div class="cl-th" style="margin-top:14px">Ensuite</div>';
      for (var k2 = 1; k2 <= 6; k2++) { var d2 = calDate(k2); var sp = supGroup(byDay[k2] || []); body += '<div class="cl-nx"><span class="d">' + calDayLab(d2) + '</span><span class="i">' + (sp.length ? sp.length + ' commande' + (sp.length > 1 ? 's' : '') + ' · ' + sp.slice(0, 2).map(function (s) { return s.labo; }).join(', ') : '—') + '</span></div>'; }
    } else if (_calSub === 'week') {
      body = '<div class="cl-wk">';
      for (var k3 = 0; k3 < 7; k3++) { var d3 = calDate(k3); var sps = supGroup((byDay[k3] || []).concat(k3 === 0 ? late : [])); body += '<div class="cl-wc' + (k3 === 0 ? ' today' : '') + '"><div class="cl-wch">' + (k3 === 0 ? 'Auj.' : calDayLab(d3)) + '<b>' + (sps.length || '') + '</b></div>' + (sps.slice(0, 4).map(supCardHtml).join('') || '<div class="cl-more">—</div>') + (sps.length > 4 ? '<div class="cl-more">+' + (sps.length - 4) + ' labos</div>' : '') + '</div>'; }
      body += '</div>';
    } else if (_calSub === 'month') {
      var nowd = new Date(), y = nowd.getFullYear(), mo = nowd.getMonth(), fdow = (new Date(y, mo, 1).getDay() + 6) % 7, ndays = new Date(y, mo + 1, 0).getDate();
      var load = {}; acts.forEach(function (a) { var dd = calDate(a.o.cov <= 1 ? 0 : a.cmdDays); if (dd.getMonth() === mo) load[dd.getDate()] = (load[dd.getDate()] || 0) + 1; });
      var mx = 1; Object.keys(load).forEach(function (k) { if (load[k] > mx) mx = load[k]; });
      function shade(v) { if (!v) return 'transparent'; var t = v / mx; return t > 0.66 ? '#D93A2B' : t > 0.33 ? '#E88A2A' : '#F1C27A'; }
      body = '<div class="cl-mhead">' + cap(MOIS[mo]) + ' ' + y + '</div><div class="cl-mgrid">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (x) { return '<div class="cl-mdn">' + x + '</div>'; }).join('');
      for (var i = 0; i < fdow; i++) body += '<div></div>';
      for (var day = 1; day <= ndays; day++) { var v = load[day] || 0, isT = day === nowd.getDate(); body += '<div class="cl-mcell' + (isT ? ' today' : '') + '"><span class="dn">' + day + '</span>' + (v ? '<span class="cn" style="color:' + shade(v) + '">' + v + '</span><span class="ld" style="background:' + shade(v) + '"></span>' : '') + '</div>'; }
      body += '</div><div class="ap-foot" style="padding:8px 2px 0;margin:0">Les jours chauds = beaucoup de commandes à passer. Vue de planification — on exécute dans « Aujourd’hui » et « Semaine ».</div>';
    }
    return toggle + band + body;
  }

  // ═══ DEMANDE NATIONALE PAR PRODUIT (Open Medic) → white space réseau ═══
  var _omState = 0, _omData = null;
  function ensureOpenMedic() {
    if (_omData || _omState) return;
    _omState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('openmedic.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _omData = j || {}; _omState = 2; approRerender(); })
        .catch(function () { _omState = 2; });
    } catch (e) { _omState = 2; }
  }
  // « White space » : gros marché national (Open Medic) où le réseau vend peu = potentiel de référencement.
  var _wsCache = null, _wsRef = null, _wsOmRef = null;
  function whiteSpace() {
    if (!_omData || !_omData.data || !window.WML_SALES) return [];
    if (_wsCache && _wsRef === window.WML_SALES && _wsOmRef === _omData) return _wsCache;
    var nat = _omData.data, idx = cipIndex();
    var totNat = 0, totNet = 0;
    Object.keys(nat).forEach(function (c) { var n = nat[c]; if (!n) return; totNat += n; var o = idx[c]; if (o) totNet += o.vM * 12; });
    var S = totNat > 0 ? totNet / totNat : 0;   // part réseau moyenne du marché national (footprint grossiste)
    if (S <= 0) { _wsCache = []; _wsRef = window.WML_SALES; _wsOmRef = _omData; return _wsCache; }
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var out = [];
    Object.keys(nat).forEach(function (c) {
      var n = nat[c]; if (n < 20000) return;                 // demande nationale significative
      var o = idx[c], net = o ? o.vM * 12 : 0;
      var gap = n * S - net;                                 // manque à gagner au rythme de notre part moyenne
      if (gap <= 0) return;
      var p = ps[c];
      out.push({ c: c, d: p ? p.d : c, nat: n, net: Math.round(net), gap: Math.round(gap), sold: !!o });
    });
    out.sort(function (a, b) { return b.gap - a.gap; });
    _wsCache = out.slice(0, 12); _wsRef = window.WML_SALES; _wsOmRef = _omData;
    return _wsCache;
  }
  function whiteSpaceCard() {
    if (!_omData) return '';
    var ws = whiteSpace(); if (!ws.length) return '';
    var rows = ws.map(function (x) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.d)) +
        '<small>' + fmt(x.nat) + ' boîtes/an en France · réseau ' + (x.sold ? '~' + fmt(x.net) + '/an' : '<b>non référencé</b>') + '</small></div>' +
        '<div class="ap-mini">potentiel <b>+' + fmt(x.gap) + '</b>/an</div></div>';
    }).join('');
    return card('spark', 'Potentiel réseau — gros marché, faible présence', 'forte demande nationale (Open Medic ' + (_omData.year || '') + ') où le réseau vend peu — à référencer / pousser', rows, 'var(--ip-blue)') +
      '<div class="ap-foot" style="margin:0">Potentiel = ce que le réseau vendrait à sa part de marché moyenne. Remboursables uniquement (Open Medic). Croisé au sell-in réseau.</div>';
  }

  // ═══ BAISSES DE PRIX OFFICIELLES (BDPM prix public, robot quotidien, diff par snapshot) ═══
  var _prixState = 0, _prixData = null;
  function ensurePrix() {
    if (_prixData || _prixState) return;
    _prixState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('prix.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _prixData = j || {}; _prixState = 2; approRerender(); })
        .catch(function () { _prixState = 2; });
    } catch (e) { _prixState = 2; }
  }
  // Futures baisses de prix CEPS (avis au JO, robot quotidien) — le signal « déstocker avant que ça baisse »
  var _pfState = 0, _pfData = null;
  function ensurePrixFuturs() {
    if (_pfData || _pfState) return;
    _pfState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('prix-futurs.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _pfData = j || {}; _pfState = 2; approRerender(); })
        .catch(function () { _pfState = 2; });
    } catch (e) { _pfState = 2; }
  }
  // Génériques & biosimilaires en approche (EMA, robot quotidien) — signal 6-18 mois avant la bascule
  var _emaState = 0, _emaData = null;
  function ensureEmaGx() {
    if (_emaData || _emaState) return;
    _emaState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('ema-generiques.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _emaData = j || {}; _emaState = 2; approRerender(); })
        .catch(function () { _emaState = 2; });
    } catch (e) { _emaState = 2; }
  }
  function prixCard() {
    if (!_prixData) return '';
    var d = _prixData, drops = d.drops || [];
    if (!drops.length) {
      // amorçage ou aucune baisse depuis le dernier relevé : présence honnête, pas de carte vide
      return '<div class="ap-foot" style="margin-top:8px">💶 Surveillance des prix publics officiels active — <b>' + (d.nTracked || 0) + ' références suivies</b>. ' +
        (d.baseline ? 'Relevé de départ posé : les baisses apparaîtront ici dès la prochaine révision tarifaire (souvent le 1<sup>er</sup> du mois).' : 'Aucune baisse depuis le dernier relevé.') + '</div>';
    }
    var rows = drops.slice(0, 12).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(x.d || x.c) +
        '<small>' + (x.remb ? 'remb. ' + esc(x.remb) + ' · ' : '') + (x.n ? 'présent dans ' + x.n + ' officines' : 'hors réseau') + '</small></div>' +
        '<div class="ap-mini">' + fmtEur(x.old) + ' → <b>' + fmtEur(x.new) + '</b></div>' +
        '<div class="ap-g"><span class="ap-down">▼ −' + x.pct + ' %</span></div></div>';
    }).join('');
    return card('pilo', 'Baisses de prix officielles', 'prix public BDPM en baisse depuis le dernier relevé — un stock qui se dévalorise, à ne pas surcharger', rows, 'var(--rose,#D5573B)') +
      '<div class="ap-foot" style="margin:0">Prix public TTC officiel (BDPM). ' + (d.nDown || 0) + ' baisse' + ((d.nDown || 0) > 1 ? 's' : '') + ' · ' + (d.nUp || 0) + ' hausse' + ((d.nUp || 0) > 1 ? 's' : '') + ' sur ' + (d.nTracked || 0) + ' réfs suivies. Classé par baisse × volume réseau.</div>';
  }
  function fmtEur(v) { return (v == null ? '—' : String(v.toFixed ? v.toFixed(2) : v).replace('.', ',') + ' €'); }

  // ═══ RAPPELS DE PRODUITS (RappelConso/DGCCRF, robot hebdo) — parapharma + match catalogue ═══
  var _rapState = 0, _rapData = null;
  function ensureRappels() {
    if (_rapData || _rapState) return;
    _rapState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('rappels.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _rapData = j || {}; _rapState = 2; approRerender(); })
        .catch(function () { _rapState = 2; });
    } catch (e) { _rapState = 2; }
  }
  function rappelRow(x, strong) {
    var lien = x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" class="ap-rap-lk">fiche ▸</a>' : '';
    return '<div class="ap-row"><div class="ap-nm">' + esc(x.d || x.gtin || '') +
      '<small>' + (x.marque ? esc(x.marque) + ' · ' : '') + (x.date ? fdate(x.date) : '') + (strong && x.n ? ' · ' + x.n + ' vendus (réseau)' : '') + (x.motif ? ' — ' + esc(x.motif) : '') + '</small></div>' +
      '<div class="ap-mini">' + (x.risque ? esc(x.risque) : '') + ' ' + lien + '</div></div>';
  }
  function rappelsCard() {
    if (!_rapData) return '';
    var m = _rapData.matched || [], p = _rapData.para || [], out = '';
    if (m.length) {
      out += card('alert', 'Rappel sur une réf que le réseau distribue', 'produit rappelé (RappelConso) présent dans le catalogue réseau — stopper la distribution, prévenir le fournisseur', m.slice(0, 10).map(function (x) { return rappelRow(x, true); }).join(''), 'var(--rose,#D5573B)');
    }
    if (p.length) {
      out += card('cat', 'Rappels parapharma récents', 'cosmétiques / hygiène-beauté rappelés (DGCCRF) — à retirer du comptoir', p.slice(0, 12).map(function (x) { return rappelRow(x, false); }).join(''), 'var(--c-amber)') +
        '<div class="ap-foot" style="margin:0">RappelConso (DGCCRF) — parapharma. Rappels de médicaments : voir « Lots rappelés ». ' + (_rapData.nMatched || 0) + ' réf réseau · ' + (_rapData.nPara || 0) + ' parapharma récents.</div>';
    }
    return out;
  }

  // ═══ RAPPELS DE LOTS — MÉDICAMENTS (ANSM, robot quotidien) ═══
  // Seul flux public qui donne CIP13 + numéro de lot → se croise directement avec le stock plateforme.
  // ⚠️ HONNÊTETÉ : notre stock n'est pas suivi par lot → on dit « on détient la réf, vérifier les lots »,
  // jamais « on détient ces lots ». Le contrôle physique reste à faire.
  var _rlState = 0, _rlData = null;
  function ensureRappelsLots() {
    if (_rlData || _rlState) return;
    _rlState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('rappels-lots.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _rlData = j || {}; _rlState = 2; approRerender(); })
        .catch(function () { _rlState = 2; });
    } catch (e) { _rlState = 2; }
  }
  function lotsLabel(x) {
    var L = x.lots || [];
    if (!L.length) return 'lots non détaillés par l’ANSM';
    var head = L.slice(0, 6).map(function (l) { return l.n + (l.exp ? ' (' + l.exp + ')' : ''); }).join(' · ');
    var n = x.nl || L.length;
    return head + (n > 6 ? ' · +' + (n - 6) + ' autres' : '');
  }
  function clipMots(s, n) {   // couper sur un mot entier (sinon « …de ces lo » à l'écran)
    s = String(s || '').trim();
    if (s.length <= n) return s;
    var c = s.slice(0, n);
    var i = c.lastIndexOf(' ');
    return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[ ,;:.’'-]+$/, '') + '…';
  }
  function rappelLotRow(x, withStock) {
    var q = (x.stk || []).reduce(function (s, y) { return s + (y.q || 0); }, 0);
    var lien = x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" class="ap-rap-lk">fiche ▸</a>' : '';
    var nom = (x.cat && x.cat[0] && x.cat[0].d) ? cap(x.cat[0].d.toLowerCase()) : (x.t || '').split('–')[0].trim();
    return '<div class="ap-row"><div class="ap-nm"><b>' + esc(nom) + '</b><small>' +
      (x.d ? fdate(x.d) + ' · ' : '') + esc(lotsLabel(x)) +
      (x.motif ? ' — ' + esc(clipMots(x.motif, 78)) : '') + '</small></div>' +
      '<div class="ap-mini">' + (withStock && q ? '<b>' + fmt(q) + ' u en stock</b> ' : '') + lien + '</div></div>';
  }
  function rappelsLotsCard() {
    if (!_rlData || !_rlData.items) return '';
    var items = _rlData.items, m = _rlData.meta || {};
    var enStock = items.filter(function (x) { return x.stk && x.stk.length; });
    var auCat = items.filter(function (x) { return (!x.stk || !x.stk.length) && x.cat && x.cat.length; });
    if (!enStock.length && !auCat.length) return '';
    var out = '';
    if (enStock.length) {
      out += card('alert', 'Lots rappelés — on détient la référence',
        'rappel ANSM sur un médicament présent au stock plateforme : isoler les lots ci-dessous, ne pas les expédier',
        enStock.slice(0, 6).map(function (x) { return rappelLotRow(x, true); }).join('') +
        (enStock.length > 6 ? '<div class="ap-foot" style="margin:0;padding:7px 2px">+ ' + (enStock.length - 6) + ' autres</div>' : ''),
        'var(--rose,#D5573B)');
    }
    if (auCat.length) {
      out += card('cat', 'Lots rappelés — référence distribuée par le réseau',
        'pas de stock plateforme, mais les officines en achètent : à signaler',
        auCat.slice(0, 5).map(function (x) { return rappelLotRow(x, false); }).join('') +
        (auCat.length > 5 ? '<div class="ap-foot" style="margin:0;padding:7px 2px">+ ' + (auCat.length - 5) + ' autres</div>' : ''),
        'var(--c-amber)');
    }
    return out + '<div class="ap-foot" style="margin:0">ANSM — informations de sécurité, ' +
      (m.nItems || 0) + ' rappels de médicaments sur ' + Math.round((m.fenetreJours || 540) / 30) + ' mois, ' +
      (m.nEnStock || 0) + ' touchant le stock. <b>Le stock plateforme n’est pas suivi par numéro de lot</b> : vérifier physiquement les numéros ci-dessus avant de conclure.</div>';
  }

  // ═══ ACTU APPRO (quotidien, gratuit) : fil d'actualité filtré appro + bloc PRÉDICTIF ═══
  var _infosState = 0, _infosData = null;
  function ensureInfos() {
    if (_infosData || _infosState) return;
    _infosState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('infos-jour.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _infosData = j || {}; _infosState = 2; approRerender(); })
        .catch(function () { _infosState = 2; });
    } catch (e) { _infosState = 2; }
  }
  function actuView() {
    ensureInfos();
    // ── PRÉDICTIF : ce qui arrive, calculé sur nos robots ──
    var pred = [];
    var acts = _carnetActs || [];
    var imm = acts.filter(function (a) { return a.o && a.o.cov <= 7 && (a.cls === 'buy' || a.cls === 'sec'); });
    if (imm.length) pred.push({ ic: '⏱', c: '#D5573B', t: imm.length + ' produits à sec sous 7 jours', s: 'à commander en urgence — ' + imm.slice(0, 2).map(function (a) { return cap((a.name || '').toLowerCase()); }).join(', ') });
    if (_ansmData && _ansmData.items) { var rets = _ansmData.items.filter(function (i) { return i.retour && i.retour.iso; }).sort(function (a, b) { return (a.retour.annee * 100 + (a.retour.mois || 13)) - (b.retour.annee * 100 + (b.retour.mois || 13)); }); if (rets.length) pred.push({ ic: '📦', c: '#0E7C86', t: ((_ansmData.meta && _ansmData.meta.nDates) || rets.length) + ' retours de rupture prévus', s: cap((rets[0].spec || '').toLowerCase()).slice(0, 28) + ' → ' + retourLabel(rets[0].retour) }); }
    if (_generData && _generData.newGeneric && _generData.newGeneric.length) pred.push({ ic: 'Ⓖ', c: '#6D5AE6', t: _generData.newGeneric.length + ' nouveaux génériques', s: 'basculer les achats — ' + esc((_generData.newGeneric[0].lib || '').split(',')[0]) });
    else if (_generData && _generData.meta) pred.push({ ic: 'Ⓖ', c: '#6D5AE6', t: 'bascules génériques disponibles', s: _generData.meta.nAvecGenerique + ' groupes avec un générique — princeps à basculer' });
    if (_hasData && _hasData.items) { var f = _hasData.items.filter(function (i) { return i.cat === 'reimb'; }); if (f.length) pred.push({ ic: '§', c: '#0050E6', t: f.length + ' avis HAS favorables récents', s: 'futurs remboursements 3-6 mois avant — ' + cap((f[0].spec || '').toLowerCase()).slice(0, 26) }); }
    if (_epiData && _epiData.indicators) { var up = _epiData.indicators.filter(function (i) { return i.trend != null && i.trend > 10; }); if (up.length) pred.push({ ic: '✚', c: '#1E9E6A', t: up[0].label + ' en hausse (+' + up[0].trend + ' %)', s: (up[0].regions && up[0].regions[0] ? 'plus fort en ' + cap((up[0].regions[0].n || '').toLowerCase()) + ' · ' : '') + 'renforcer les familles avant le pic' }); }
    var predHtml = pred.map(function (p) { return '<div class="ac-pred"><div class="ac-ic" style="background:' + p.c + '">' + p.ic + '</div><div class="ac-pt"><b>' + esc(p.t) + '</b><span>' + esc(p.s) + '</span></div></div>'; }).join('') || '<div class="ap-empty">Signaux en cours de chargement…</div>';
    // ── ACTUALITÉ : RSS filtré appro ──
    var news;
    if (_infosData && _infosData.items) {
      var CATN = { ruptures: ['rupture', '#D5573B'], securite: ['sécurité', '#C77700'], reglementaire: ['réglementaire', '#0050E6'] };
      var appro = _infosData.items.filter(function (i) { return CATN[i.cat]; });
      news = appro.slice(0, 14).map(function (i) {
        var cn = CATN[i.cat];
        return '<a class="ac-news" href="' + esc(i.url) + '" target="_blank" rel="noopener"><span class="ac-cat" style="background:' + cn[1] + '">' + cn[0] + '</span>' +
          '<div class="ac-nm"><b>' + esc(i.titre) + '</b><span>' + esc(i.source) + '</span></div></a>';
      }).join('') || '<div class="ap-empty">Pas d’actu appro dans les derniers jours.</div>';
    } else news = '<div class="ap-empty">Chargement de l’actualité…</div>';
    var rapH = rappelsCard();   // audit m2 : calculer une seule fois (évite le double scan)
    var rlH = rappelsLotsCard();
    return '<div class="ap-sec">Prédictif — ce qui arrive</div>' +
      '<div class="ap-secsub">calculé chaque jour sur ta donnée réseau + les sources publiques gratuites</div>' +
      '<div class="v2-card ap-card" style="padding:6px 4px">' + predHtml + '</div>' +
      (rlH ? '<div class="ap-sec">Lots rappelés — médicaments</div>' +
        '<div class="ap-secsub">décisions de rappel de l’ANSM croisées avec le stock plateforme et le catalogue réseau</div>' + rlH : '') +
      '<div class="ap-sec">Actualité appro du jour</div>' +
      '<div class="ap-secsub">ruptures, sécurité, réglementaire — ANSM &amp; presse pro (RSS gratuit, quotidien)</div>' +
      '<div class="v2-card ap-card" style="padding:0">' + news + '</div>' +
      (rapH ? '<div class="ap-sec">Rappels de produits</div><div class="ap-secsub">RappelConso (DGCCRF) — parapharma &amp; réfs du réseau (les rappels de médicaments sont juste au-dessus)</div>' + rapH : '');
  }

  // ═══════════════════════════════════════════════════════════════════
  // COCKPIT « ANTICIPER » — frise 90 j + 4 couloirs d'action (choix Will : maquette 3 + frise)
  // Acheter avant · Basculer · Alléger avant · Écouler. Chaque ligne : produit / date / montant / verbe.
  // ═══════════════════════════════════════════════════════════════════
  function daysTo(iso) { if (!iso) return null; try { var d = new Date(iso + (iso.length <= 7 ? '-01' : '') + 'T00:00:00'); return Math.round((d.getTime() - Date.now()) / 86400000); } catch (e) { return null; } }
  function jxLab(d) { return d == null ? '' : (d <= 0 ? 'auj.' : 'J−' + d); }
  function frisePos(d) { d = Math.max(0, d); var p = d <= 7 ? 16 + d / 7 * 24 : d <= 30 ? 40 + (d - 7) / 23 * 24 : 64 + (d - 30) / 60 * 28; return Math.min(93, p); }
  function stq(c) { var s = (window.STOCK_IP && window.STOCK_IP.data) || {}; return Math.max(0, s[c] || 0); }

  // Couloir ③ : futures baisses de prix (CEPS/JO) — € d'exposition = (ancien − nouveau) × stock détenu
  function alleger() {
    if (!_pfData || !_pfData.changes) return [];
    var today = new Date().toISOString().slice(0, 10), out = [];
    _pfData.changes.forEach(function (x) {
      if (x.sens !== 'baisse') return;
      var st = stq(x.c), old = x.ancien_ttc || x.ppttc, expo = Math.max(0, (old - x.ppttc)) * st;
      out.push({ c: x.c, d: x.d, pfht: x.pfht, ppttc: x.ppttc, old: old, st: st, expo: expo,
        date: x.date_effet, dd: daysTo(x.date_effet), future: (x.date_effet || '') >= today });
    });
    out.sort(function (a, b) { return b.expo - a.expo || (a.dd || 999) - (b.dd || 999); });
    return out;
  }
  // Couloir ② : génériques qui arrivent (signal live = nouveaux groupes BDPM + princeps qu'on achète)
  function basculer() {
    var out = [], seen = {};
    if (_generData && _generData.newGeneric) _generData.newGeneric.forEach(function (g) {
      var c = String(g.cip || g.c || ''); if (seen[c]) return; seen[c] = 1;
      out.push({ d: (g.lib || g.d || '').split(',')[0], c: c, st: stq(c), val: stq(c) * (g.ppht || 0), neuf: true });
    });
    // Le stock de princeps est exactement ce qui se dévalorisera quand le générique
    // arrivera : chaque ligne porte sa valeur (stock × PPHT), affichée et comptée.
    var idxP = {}; try { idxP = cipIndex(); } catch (e) {}
    try {
      basculesGx().slice(0, 8).forEach(function (b) {
        if (seen[b.c]) return; seen[b.c] = 1;
        var st = stq(b.c), o = idxP[String(b.c)];
        out.push({ d: b.d, c: b.c, q: b.q, st: st, val: st * ((o && o.ppht) || 0) });
      });
    } catch (e) {}
    // EMA : génériques/biosimilaires autorisés/en pipeline au niveau UE (molécules de notre catalogue)
    if (_emaData && _emaData.items) _emaData.items.forEach(function (e) {
      out.push({ ema: true, d: e.inn, name: e.name, typ: e.type, pipeline: e.pipeline, amm: e.amm });
    });
    return out;
  }
  // Exposition « à protéger » côté génériques : la valeur du stock de princeps qu'on
  // achète encore alors qu'un générique existe ou arrive. Calculée sur TOUS les produits
  // concernés — le couloir n'en affiche que quelques-uns, le compteur ne doit pas hériter
  // de ce plafond d'affichage. Dédoublonnée : un produit peut être à la fois nouveau
  // groupe du mois et princeps déjà repéré.
  function exposGeneriques() {
    var idx = {}; try { idx = cipIndex(); } catch (e) {}
    var vu = {}, eur = 0, n = 0;
    function ajoute(cip, prixConnu) {
      var c = String(cip || ''); if (!c || vu[c]) return; vu[c] = 1;
      var o = idx[c], p = prixConnu || (o && o.ppht) || 0, v = stq(c) * p;
      if (v > 0) { eur += v; n++; }
    }
    if (_generData && _generData.newGeneric) _generData.newGeneric.forEach(function (g) { ajoute(g.cip || g.c, g.ppht); });
    try { basculesGx().forEach(function (b) { ajoute(b.c); }); } catch (e) {}
    return { eur: eur, n: n };
  }
  // Couloir ① : la demande qui monte (épidémie + saison fusionnées)
  function demandeUp() {
    var out = [];
    if (_epiData && _epiData.indicators) _epiData.indicators.forEach(function (i) { if (i.trend != null && i.trend > 10) out.push({ d: i.label, sub: 'épidémie · +' + i.trend + '%' + (i.regions && i.regions[0] ? ' · ' + cap((i.regions[0].n || '').toLowerCase()) : ''), fam: (EPI_MAP[i.cat] || {}).fam || '' }); });
    if (_odisseData && _odisseData.pathologies) _odisseData.pathologies.forEach(function (p) { if (p.trend != null && p.trend > 5 && !out.some(function (o) { return o.d === p.label; })) out.push({ d: p.label, sub: 'urgences · +' + p.trend + '%' + ((p.hotDeps || [])[0] ? ' · ' + (p.hotDeps[0].n || '') : ''), fam: (EPI_MAP[p.cat] || {}).fam || '' }); });
    return out;
  }
  function friseDots() {
    var dots = [], today = new Date().toISOString().slice(0, 10);
    alleger().forEach(function (x) { if (x.future && x.dd != null && x.dd <= 90) dots.push({ dd: x.dd, c: '#D5573B', l: 'Prix ▼', s: (x.d || '').slice(0, 14) }); });
    if (_ansmData && _ansmData.items) _ansmData.items.forEach(function (i) { if (i.retour && i.retour.iso) { var dd = daysTo(i.retour.iso); if (dd != null && dd >= 0 && dd <= 90) dots.push({ dd: dd, c: '#0050E6', l: 'Retour', s: cap((i.spec || '').toLowerCase()).slice(0, 14) }); } });
    try { EVENTS.forEach(function (ev) { if (!ev.y) return; var d = new Date(ev.y, (ev.m || 1) - 1, ev.d || 1), dd = Math.round((d.getTime() - Date.now()) / 86400000); if (dd >= 0 && dd <= 90) dots.push({ dd: dd, c: ev.t === 'gen' ? '#6D5AE6' : ev.t === 'sais' ? '#1E9E6A' : '#0050E6', l: ev.t === 'gen' ? 'Générique' : ev.t === 'sais' ? 'Saison' : 'Marché', s: (ev.ti || '').slice(0, 16) }); }); } catch (e) {}
    dots.sort(function (a, b) { return a.dd - b.dd; });
    return dots.slice(0, 10);
  }
  function friseHtml() {
    var dots = friseDots();
    var pts = dots.map(function (x, i) {
      var top = i % 2 ? 34 : 4;
      return '<div class="an-ev" style="left:' + frisePos(x.dd) + '%;top:' + top + 'px"><div class="an-d" style="background:' + x.c + '"></div><div class="an-jl" style="color:' + x.c + '">' + jxLab(x.dd) + '</div><div class="an-el">' + esc(x.s) + '</div></div>';
    }).join('');
    return '<div class="an-frise"><div class="an-dotrow">' +
      '<div class="an-today"><span>AUJ.</span></div><div class="an-axis"></div>' +
      '<div class="an-tick" style="left:16%">auj.</div><div class="an-tick" style="left:40%">+7j</div><div class="an-tick" style="left:64%">+30j</div><div class="an-tick" style="left:92%">+90j</div>' +
      pts + (dots.length ? '' : '<div class="an-empty">Aucune échéance datée dans les 90 jours.</div>') + '</div></div>';
  }
  function laneCard(cls, num, title, count, rows, empty) {
    return '<div class="an-lane ' + cls + '"><div class="an-lhd">' + num + ' ' + title + '<span class="an-n">' + count + '</span></div>' +
      '<div class="v2-card ap-card" style="padding:2px 14px">' + (rows || '<div class="ap-empty">' + empty + '</div>') + '</div></div>';
  }
  function anticiperCockpit() {
    // ── données des 4 couloirs ──
    var up = demandeUp(), bas = basculer(), alg = alleger(), algF = alg.filter(function (x) { return x.future; });
    var retours = (_ansmData && _ansmData.items) ? _ansmData.items.filter(function (i) { return i.retour && i.retour.iso; }).length : 0;
    // compteurs P&L
    var protectEur = 0; algF.forEach(function (x) { protectEur += x.expo; });
    var gxExpo = exposGeneriques(); protectEur += gxExpo.eur;
    var capter = up.length + retours;
    var pl = '<div class="an-pl">' +
      '<div class="lose"><b>' + (V2.fmtEur ? V2.fmtEur(protectEur) : fmt(protectEur)) + '</b><span>à protéger — baisses de prix + stock des futurs génériques</span></div>' +
      '<div class="win"><b>' + fmt(capter) + '</b><span>à capter — demande qui monte + retours de rupture</span></div></div>';

    // ① Acheter avant
    var upRows = up.slice(0, 4).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(x.d) + '</b><small>' + esc(x.sub) + (x.fam ? ' · renforcer ' + esc(x.fam) : '') + '</small></div><span class="an-verb buy">PRÉ-ACHETER</span></div>';
    }).join('') + (up.length > 4 ? '<div class="ap-foot" style="margin:0;padding:7px 2px">+ ' + (up.length - 4) + ' autres</div>' : '');
    // ② Basculer
    var basRows = bas.slice(0, 5).map(function (b) {
      if (b.ema) {
        return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap(b.d)) + '</b><small>' + esc(b.typ) + ' UE ' + (b.pipeline ? 'en pipeline (avis rendu)' : 'autorisé' + (b.amm ? ' ' + fdate(b.amm) : '')) + ' — ' + esc(b.name) + ' · préparer la bascule</small></div><span class="an-verb sw">' + (b.pipeline ? 'PRÉPARER' : 'BASCULER') + '</span></div>';
      }
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap(b.d || b.c)) + '</b><small>' + (b.st ? 'stock princeps ' + fmt(b.st) + (b.val ? ' = ' + (V2.fmtEur ? V2.fmtEur(b.val) : fmt(b.val)) : '') + ' · ' : '') + 'négocier les Gx maintenant</small></div><span class="an-verb sw">BASCULER</span></div>';
    }).join('') + (bas.length > 5 ? '<div class="ap-foot" style="margin:0;padding:7px 2px">+ ' + (bas.length - 5) + ' autres</div>' : '');
    // ③ Alléger avant
    var algRows = algF.slice(0, 4).map(function (x) {
      var tag = (x.st > 0 && x.expo > 0) ? '<b>' + (V2.fmtEur ? V2.fmtEur(x.expo) : fmt(x.expo)) + '</b> exposés' : 'pas de stock détenu';
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap(x.d)) + '</b><small>PFHT ' + fmtEur(x.pfht) + ' · ' + tag + ' · effet le ' + (x.date ? fdate(x.date) : '?') + '</small></div><span class="an-verb sell">' + jxLab(x.dd) + '</span></div>';
    }).join('');
    // ④ Écouler (péremptions — donnée interne à fournir)
    var perRows = '';   // activable quand l'export stock inclura la date de péremption

    return pl +
      laneCard('buy', '①', 'ACHETER AVANT — la demande qui monte', up.length, upRows, 'Aucun pic de demande détecté.') +
      laneCard('sw', '②', 'BASCULER — génériques qui arrivent', bas.length, basRows, 'Aucun générique en approche détecté.') +
      laneCard('cut', '③', 'ALLÉGER AVANT — futures baisses de prix', algF.length, algRows, (_pfData ? 'Aucune baisse annoncée au JO pour l\'instant.' : 'Chargement des avis de prix…')) +
      laneCard('flush', '④', 'ÉCOULER — péremptions courtes', 0, perRows,
        'Module prêt : ajoute la <b>date de péremption</b> (+ n° de lot, quantité) à ton export stock et tes lots à écouler apparaîtront ici, triés par € à risque.') +
      '<div class="ap-foot" style="padding:10px 2px 0">Futures baisses de prix = avis CEPS au Journal Officiel (4-20 j d\'avance). Génériques = nouveaux groupes BDPM + princeps que le réseau achète. Demande = épidémie + urgences.</div>';
  }

  V2.pages.appro = {
    render: function (root) {
      ensureCss();
      // Les flux marché sont-ils là ? (chargés par le socle Copilote)
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des données marché…</div></div></div>';
        if (V2.loadFiles) V2.loadFiles(['bench']).then(function () { V2.render(); });
        return;
      }

      ensureEtab();   // charge en différé le stock par établissement (gros fichier NR)
      ensureGener();  // charge la veille génériques (BDPM, robot mensuel)
      ensureAnsm();   // charge la veille ANSM disponibilités + dates de retour (robot quotidien)
      ensureEpidemio(); // charge les signaux de demande (Sentinelles, robot quotidien)
      ensureOdisse(); // charge les urgences par département (SurSaUD/Odissé, robot hebdo)
      ensureHas();    // charge l'anticipation réglementaire HAS (robot mensuel)
      ensureSaisonCip(); // charge la saison par produit (Medic'AM, robot mensuel)
      ensureMitm();   // charge la liste des médicaments critiques MITM (ANSM, robot mensuel)
      ensureInfos();  // charge l'actu quotidienne (veille RSS gratuite, filtrée appro)
      ensurePrix();   // charge les baisses de prix officielles (BDPM, robot quotidien)
      ensureRappels(); // charge les rappels de produits (RappelConso, robot hebdo)
      ensureRappelsLots(); // charge les rappels de LOTS de médicaments (ANSM, robot quotidien)
      ensureNational(); // charge le modèle national d'anticipation (robot mensuel, 1,2 Mo différé)
      ensureOpenMedic(); // charge la demande nationale par produit (Open Medic, robot annuel) → white space
      ensurePrixFuturs(); // charge les futures baisses de prix (avis CEPS/JO, robot quotidien)
      ensureEmaGx(); // charge les génériques/biosimilaires en approche (EMA, robot quotidien)
      // ── Cockpit réassort (crash-safe : ne casse jamais la page si un flux manque) ──
      var kpiBand = '', reaCard = '', rosCard = '', radarHtml = '', etabHtml = '', basculesHtml = '', ansmHtml = '', epiHtml = '', hasHtml = '', saiCipHtml = '', carnetHtml = '', carnetCounts = null;
      try {
        if (window.WML_SALES && window.STOCK_IP) {
          var cb = carnet();
          if (cb && cb.acts.length) {
            var C = cb.counts, acts = cb.acts;
            carnetCounts = C;
            var TABS = [['all', 'Tous', acts.length], ['buy', 'Acheter', C.buy], ['sec', 'Sécuriser', C.sec], ['pre', 'Pré-acheter', C.pre], ['arb', 'Arbitrer', C.arb], ['red', 'Alléger', C.red]];
            var tabBar = TABS.map(function (t) { return '<button class="cb-tab' + (_bookTab === t[0] ? ' on' : '') + '" onclick="V2.approTab(\'' + t[0] + '\')">' + t[1] + ' <b>' + t[2] + '</b></button>'; }).join('');
            var shown = _bookTab === 'all' ? acts : acts.filter(function (a) { return a.cls === _bookTab; });
            var rowsHtml = shown.slice(0, 24).map(carnetRow).join('') || '<div class="ap-empty">Rien dans cette catégorie.</div>';
            carnetHtml = '<div class="v2-card cb-card"><div class="cb-hd"><div><h3>Carnet d\'achat du jour</h3>' +
              '<div class="cb-sub">' + acts.length + ' positions — clique une ligne pour le détail, exporte la commande</div></div>' +
              '<div class="cb-tot"><b>' + (V2.fmtEur ? V2.fmtEur(C.eur) : fmt(C.eur)) + '</b><small>à engager</small></div>' +
              '<button class="cb-exp" onclick="V2.approExport()">⤓ Exporter</button></div>' +
              '<div class="cb-tabs">' + tabBar + '</div>' +
              rowsHtml +
              '<div class="ap-foot" style="padding:10px 16px 12px;margin:0">Priorisé par urgence · quantité = pour revenir à la couverture cible · <b>« à engager » = achats fermes uniquement</b> (hors pré-achats de saison et hors références jamais inventoriées).</div></div>';
          }
        }
      } catch (e) { carnetHtml = ''; }
      try {
        radarHtml = radarSection(window.WML_SALES && window.STOCK_IP ? reassort() : []);
        etabHtml = etabSection();
        basculesHtml = basculesCard();
        ansmHtml = ansmCard();
        epiHtml = epidemioCard();
        hasHtml = hasCard();
        saiCipHtml = saisonCipCard();
        if (window.WML_SALES && window.STOCK_IP) {
          var h = stockHealth();
          kpiBand = '<div class="ap-kpis">' +
            '<div class="ap-kpi ko"><div class="ap-kv">' + fmt(h.tension) + '</div><div class="ap-kl">en tension &lt; 7 j</div></div>' +
            '<div class="ap-kpi wa"><div class="ap-kv">' + fmt(h.acmd) + '</div><div class="ap-kl">à commander (7–21 j)</div></div>' +
            '<div class="ap-kpi"><div class="ap-kv">' + fmt(h.ross) + '</div><div class="ap-kl">rossignols / dormants</div></div>' +
            '<div class="ap-kpi eu"><div class="ap-kv mono">' + (V2.fmtEur ? V2.fmtEur(h.cap) : fmt(h.cap)) + '</div><div class="ap-kl">capital dormant</div></div>' +
            '</div>';

          var reaRows = reassort().map(function (o) {
            return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + (o.rupt ? ' <span class="ap-tag ru">ANSM</span>' : '') +
              '<small>' + fmt(Math.round(o.vM)) + '/mois réseau · stock ' + fmt(o.st) + '</small></div>' +
              '<div class="ap-covwrap">' + covBadge(o.cov) + '</div>' +
              '<div class="ap-cmd">commander<b>~' + fmt(o.qcmd) + '</b></div></div>';
          }).join('') || '<div class="ap-empty">Rien d\'urgent à réassortir.</div>';
          reaCard = '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">' + ICO('alert', 15, 2) + '</div>' +
            '<div><h3>À commander — réassort recommandé</h3><div class="ap-sub">couverture en jours (stock plateforme ÷ vitesse réseau) + quantité conseillée — ' + fmt(h.ncmd) + ' réfs à passer à partir de ' + MINVEL + ' boîtes/mois, top 24 par urgence</div></div></div>' +
            reaRows +
            '<div class="ap-foot" style="padding:10px 18px 12px;margin:0">Vitesse = ventes réseau/mois (WML, mois complets uniquement). Cible ' + CIBLE + ' j, portée à ' + CIBLE_TENSION + ' j si tension ANSM ou marché en hausse. Sur la base du dernier stock importé' + (window.STOCK_IP && window.STOCK_IP.meta && window.STOCK_IP.meta.gen ? ' (' + fdate(window.STOCK_IP.meta.gen) + ')' : '') + '.</div></div>';

          var rosRows = rossignols().map(function (o) {
            var cv = o.vM > 0 ? Math.round(o.cov) + ' j de stock' : 'aucune vente sur les mois complets';
            return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + (o.stale ? ' <span class="ap-tag ru">tarif à rafraîchir</span>' : '') +
              '<small>' + cv + ' · stock ' + fmt(o.st) + '</small></div>' +
              '<div class="ap-vol mono">' + (V2.fmtEur ? V2.fmtEur(o.cap) : fmt(o.cap)) + '</div>' +
              '<div class="ap-cmd" style="color:#a8651a">ne plus<b style="color:#a8651a">commander</b></div></div>';
          }).join('') || '<div class="ap-empty">Aucun stock dormant détecté.</div>';
          rosCard = '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#8A6D3B">' + ICO('cat', 15, 2) + '</div>' +
            '<div><h3>Rossignols — stock dormant</h3><div class="ap-sub">capital immobilisé à écouler, à ne plus commander — top 16 par € dormant</div></div></div>' +
            rosRows + '</div>';
        }
      } catch (e) { kpiBand = ''; reaCard = ''; rosCard = ''; }

      var ris = rising(), rup = ruptToSecure(), nouv = nouveautes(), sai = saisonNext(), neg = negoLabos();

      var RIS_SHOW = 8;   // audit UX : plafonner le mur (les 1res suffisent à décider), le reste en décompte
      var risRows = ris.length ? (ris.slice(0, RIS_SHOW).map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.d)) + (x.ru ? ' <span class="ap-tag ru">rupture</span>' : '') + '<small>' + fmt(x.n) + ' officines réseau · marché FR ~' + fmt(x.mk) + ' bts/an</small></div>' +
          '<div class="ap-g">' + pctHtml(x.g) + '</div>' +
          '<div class="ap-st ' + (x.st > 0 ? 'ok' : 'ko') + '">' + (x.st > 0 ? fmt(x.st) + ' en stock' : 'stock 0') + '</div></div>';
      }).join('') + (ris.length > RIS_SHOW ? '<div class="ap-foot" style="margin:0;padding:9px 16px">+ ' + (ris.length - RIS_SHOW) + ' autres produits en croissance dans le réseau</div>' : '')) : '<div class="ap-empty">Aucun produit en forte croissance détecté.</div>';

      var rupRows = rup.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.d)) + (x.dci ? '<small>' + esc(x.dci) + '</small>' : '') + '</div>' +
          '<div class="ap-mini">' + fmt(x.n) + ' offi.</div>' +
          '<div class="ap-st ' + (x.st > 0 ? 'ok' : 'ko') + '">' + (x.st > 0 ? fmt(x.st) + ' stock' : 'à sécuriser') + '</div></div>';
      }).join('') || '<div class="ap-empty">Aucune rupture sur les produits réseau.</div>';

      var nouvRows = nouv.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.n)) + (x.labo ? '<small>' + esc(x.labo) + '</small>' : '') + '</div>' +
          '<div class="ap-mini">AMM ' + esc(x.amm) + '</div></div>';
      }).join('') || '<div class="ap-empty">Aucune nouveauté récente.</div>';

      var saiRows = sai.rows.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.l)) + '<small>indice ' + x.next + ' en ' + MOIS[sai.next] + ' (vs ' + x.now + ' ce mois)</small></div>' +
          '<div class="ap-g">' + (x.delta > 0 ? '<span class="ap-up">▲ +' + x.delta + '</span>' : '<span class="ap-flat">' + x.next + '</span>') + '</div></div>';
      }).join('') || '<div class="ap-empty">Pas de pic saisonnier le mois prochain.</div>';

      var negRows = neg.map(function (x) {
        return '<div class="neg-row">' +
          '<div class="neg-top"><span class="neg-lab">' + esc(x.lab) + '</span>' +
            '<span class="neg-share">' + x.pct + ' % du volume Gx</span>' + pctHtml(x.g) + '</div>' +
          '<div class="neg-nums"><b>' + (V2.fmtEur ? V2.fmtEur(x.ca) : fmt(x.ca)) + '</b> · ' + fmt(x.q) + ' u/' + nMoisCouverts() + ' mois · ' + x.nref + ' réfs</div>' +
          (x.tops.length ? '<div class="neg-tops">top : ' + x.tops.map(function (d) { return esc(cap(d)); }).join(' · ') + '</div>' : '') +
          '<div class="neg-line">Levier : ' + fmt(x.q) + ' u/' + nMoisCouverts() + ' mois, ' + x.pct + ' % de notre volume générique' +
            (x.g != null && x.g > 0 ? ', en croissance de +' + Math.round(x.g) + ' %' : '') + ' → obtenir de meilleures conditions</div>' +
        '</div>';
      }).join('') || '<div class="ap-empty">Données génériqueurs indisponibles.</div>';

      // ── Vue globale (3 secondes) : les 4 chiffres qui disent où agir ──
      var loading = (carnetCounts == null);   // audit UX : ne pas afficher un faux « 0 à commander » avant le calcul
      var CC = carnetCounts || { buy: 0, sec: 0, pre: 0, arb: 0, red: 0, eur: 0, redEur: 0 };
      var nAnticip = 0;
      try { EVENTS.forEach(function (ev) { var z = evZone(ev); if (z === 'now' || z === 'prep') nAnticip++; }); if (_generData && _generData.newGeneric) nAnticip += _generData.newGeneric.length; } catch (e) {}
      function htile(onclick, big, lab, sub, col) {
        return '<button class="ap-htile" style="--hc:' + col + '" onclick="' + onclick + '">' +
          '<div class="ap-hbig">' + big + '</div><div class="ap-hlab">' + lab + '</div><div class="ap-hsub">' + sub + '</div></button>';
      }
      var eurEng = loading ? '…' : (V2.fmtEur ? V2.fmtEur(CC.eur) : fmt(CC.eur));
      var eurDorm = loading ? '…' : (V2.fmtEur ? V2.fmtEur(CC.redEur) : fmt(CC.redEur));
      var hero = '<div class="ap-hero">' +
        htile("V2.approSec('today')", loading ? '…' : fmt(CC.buy + CC.sec), 'à commander', loading ? 'calcul en cours…' : eurEng + ' à engager (ferme)', 'var(--ip-blue)') +
        htile("V2.approFocus('sec')", loading ? '…' : fmt(CC.sec), 'à sécuriser', 'ruptures critiques', '#D5573B') +
        htile("V2.approSec('anticiper')", fmt(nAnticip), 'à anticiper', 'événements à venir', '#6D5AE6') +
        htile("V2.approSec('stock')", eurDorm, 'capital dormant', (loading ? '' : fmt(CC.red) + ' réfs à alléger'), 'var(--c-amber)') +
        '</div>';

      // ── Navigation : 4 espaces clairs ──
      var NAV = [['today', 'Aujourd’hui'], ['actu', 'Actu'], ['anticiper', 'Anticiper'], ['stock', 'Stock & sites'], ['marche', 'Marché & négo']];
      var nav = '<div class="ap-nav">' + NAV.map(function (n) {
        return '<button class="ap-navb' + (_section === n[0] ? ' on' : '') + '" onclick="V2.approSec(\'' + n[0] + '\')">' + n[1] + '</button>';
      }).join('') + '</div>';

      // ── Contenu selon l'espace ──
      function secHead(t, s) { return '<div class="ap-sec">' + t + '</div>' + (s ? '<div class="ap-secsub">' + s + '</div>' : ''); }
      var content = '';
      if (_section === 'today') {
        content = calendarView(carnetHtml || '<div class="v2-card" style="padding:22px;text-align:center;color:var(--muted)">Chargement du carnet…</div>');
      } else if (_section === 'actu') {
        content = actuView();
      } else if (_section === 'anticiper') {
        ensurePrev(); ensureCauses();
        var causesH = '';
        try { causesH = causesCard(); } catch (e) { causesH = ''; }
        var prevH = '';
        try { prevH = previsionCard(); } catch (e) { prevH = ''; }
        var cockpit = '';
        try { cockpit = anticiperCockpit(); } catch (e) { cockpit = ''; }
        var ecartH = '';
        try { ecartH = ecartNational(); } catch (e) { ecartH = ''; }
        content = cockpit +
          (prevH ? secHead('Comment — combien, et quand', 'une prévision est une fourchette, jamais un chiffre nu : on pré-achète sur la borne basse, on sécurise sur la haute') + prevH : '') +
          (causesH ? secHead('Et pourquoi ça casse', 'la cause n° 1 est une demande qui monte — donc annoncée par la courbe ci-dessus') + causesH : '') +
          (ecartH ? secHead('Écart au marché France', 'calculé sur le marché national, indépendamment de la fraîcheur de vos données') + ecartH : '') +
          secHead('Veille — retours de rupture &amp; futurs remboursés', 'plus loin dans le temps, à surveiller') + ansmHtml + hasHtml;
      } else if (_section === 'stock') {
        content = kpiBand + secHead('Pour qui — qui va vraiment consommer', 'un volume réseau ne dit pas comment commander : ce que prend une pharmacie type, et la densité de chaque secteur') + reaCard + etabHtml + basculesHtml + rosCard;
      } else {
        var horsH = '';
        try { horsH = horsCatalogueCard(); } catch (e) { horsH = ''; }
        var posH = '';
        try { posH = positionMarcheCard(); } catch (e) { posH = ''; }
        content = (posH ? secHead('Besoins &amp; offre — la vue d’ensemble', 'le marché français sur votre périmètre, et la place que vous y tenez') + posH : '') +
          (horsH ? secHead('Développement de gamme', 'ce que le modèle national voit et que vos ventes ne peuvent pas voir') + horsH : '') +
          secHead('Intelligence marché') +
          card('spark', 'Ça monte', 'produits en croissance, présents dans le réseau — à renforcer au stock', risRows, 'var(--c-opp)') +
          '<div class="ap-grid2">' +
            card('alert', 'Ruptures à sécuriser', 'tension ANSM sur des produits que le réseau achète', rupRows, 'var(--c-amber)') +
            card('spark', 'La saison arrive', 'classes qui montent le mois prochain (Medic\'AM)', saiRows, '#6D5AE6') +
          '</div>' +
          card('cat', 'Nouveautés à référencer', 'AMM récentes (BDPM)', nouvRows, 'var(--ip-blue)') +
          (function () { try { return secteursCard(); } catch (e) { return ''; } })() +
          card('pilo', 'Négo labos — ton levier', 'vrai volume réseau par génériqueur', negRows, '#0E7C86') +
          whiteSpaceCard() +
          prixCard() +
          '<div class="ap-foot">Négo = vrai sell-in réseau (WML) par génériqueur. Génériques : pas d\'abandon de marge Intégral. « Ça monte » / saison = Medic\'AM / BDPM.</div>';
      }

      // audit UX : un rappel touchant une réf du réseau = l'action la plus urgente → bandeau en tête, toutes sections.
      var nMatch = (_rapData && _rapData.matched) ? _rapData.matched.length : 0;
      var recallBanner = nMatch ? '<button class="ap-recall" onclick="V2.approSec(\'actu\')">⚠️ ' + nMatch + ' rappel' + (nMatch > 1 ? 's' : '') + ' produit sur des références du réseau — stopper la distribution → voir</button>' : '';
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Appro Intégral</div>' +
          '<div class="v2-page-sub">Ta vue du jour en un coup d\'œil — clique un chiffre ou un espace pour agir.</div>' +
          recallBanner +
          (function () { try { return rubanHtml(); } catch (e) { return ''; } })() +
          hero + nav + content + freshnessBar() +
        '</div>';
    }
  };

  function ensureCss() {
    if (document.getElementById('ap-css')) return;
    var st = document.createElement('style'); st.id = 'ap-css';
    st.textContent =
      '.ap-card{padding:0;overflow:hidden;margin-bottom:14px}' +
      '.ap-hd{display:flex;align-items:center;gap:11px;padding:13px 18px;border-bottom:1px solid var(--line)}' +
      '.ap-ic{width:28px;height:28px;border-radius:8px;color:#fff;display:grid;place-items:center;flex:none}' +
      '.ap-hd h3{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ip-ink)}' +
      '.ap-sub{font-size:11.5px;color:var(--muted);font-weight:500}' +
      '.ap-row{display:flex;align-items:center;gap:10px;padding:10px 18px;border-top:1px solid var(--line)}.ap-row:first-of-type{border-top:0}' +
      '.ap-nm{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ip-ink)}.ap-nm small{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '.ap-g{flex:none;font-size:12.5px;font-weight:800;text-align:right;min-width:64px}' +
      '.ap-up{color:var(--c-opp)}.ap-down{color:#E0556E}.ap-flat{color:var(--muted)}' +
      '.ap-st{flex:none;font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap}' +
      '.ap-st.ok{color:var(--c-opp);background:#E7F5EC;border:1px solid #BFE6CF}.ap-st.ko{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.ap-mini{flex:none;font-size:11.5px;color:var(--muted);font-weight:600;font-family:var(--mono)}' +
      '.ap-vol{flex:none;font-size:13px;font-weight:800;color:var(--ip-ink);text-align:right;min-width:74px}' +
      '.ap-tag{font-size:10px;font-weight:800;border-radius:999px;padding:1px 6px}.ap-tag.ru{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.ap-empty{padding:16px 18px;font-size:12.5px;color:var(--muted)}' +
      '.ap-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
      '.ap-foot{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}' +
      '.ap-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
      '.ap-kpi{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 14px}' +
      '.ap-kpi.ko{border-color:#F3B0A0;background:#FFF1EE}.ap-kpi.wa{border-color:#F0C98A;background:#FFF8EC}' +
      '.ap-kv{font-size:24px;font-weight:800;color:var(--ip-ink);font-family:var(--mono);letter-spacing:-.02em;line-height:1}' +
      '.ap-kpi.ko .ap-kv{color:#C0561A}.ap-kpi.wa .ap-kv{color:#a8651a}' +
      '.ap-kl{font-size:11px;color:var(--muted);font-weight:600;margin-top:3px}' +
      '.ap-covwrap{flex:none;min-width:66px;text-align:right}' +
      '.ap-cov{font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap}' +
      '.ap-cov.ko{color:#C0561A;background:#FFECEC;border:1px solid #F3B0A0}.ap-cov.wa{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}.ap-cov.ok{color:var(--c-opp);background:#E7F5EC;border:1px solid #BFE6CF}' +
      '.ap-cmd{flex:none;font-size:10.5px;color:var(--muted);font-weight:600;text-align:right;min-width:78px;line-height:1.25}.ap-cmd b{display:block;font-size:15px;font-weight:800;color:var(--ip-ink);font-family:var(--mono)}' +
      /* carnet d'achat du jour (salle de marché) */
      '.cb-card{padding:0;overflow:hidden;margin-bottom:16px;border:1px solid var(--line);border-top:3px solid var(--ip-blue)}' +
      '.cb-hd{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}' +
      '.cb-hd h3{margin:0;font-size:15px;font-weight:800;color:var(--ip-ink)}' +
      '.cb-sub{font-size:12px;color:var(--muted);font-weight:500;margin-top:2px}' +
      '.cb-tot{margin-left:auto;text-align:right;flex:none}.cb-tot b{display:block;font-size:20px;font-weight:800;font-family:var(--mono);color:var(--ip-blue)}.cb-tot small{font-size:10px;color:var(--muted);font-weight:600}' +
      '.cb-kpis{display:flex;gap:7px;flex-wrap:wrap;padding:12px 16px 6px}' +
      '.cb-k{font-size:11.5px;font-weight:800;border-radius:999px;padding:4px 11px}' +
      '.cb-buy{color:#0B7A4B;background:#E7F5EC;border:1px solid #BFE6CF}' +
      '.cb-sec{color:#C0392B;background:#FDEDEA;border:1px solid #F3B0A0}' +
      '.cb-pre{color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5}' +
      '.cb-arb{color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3}' +
      '.cb-red{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.cb-exp{flex:none;font-size:12px;font-weight:800;color:var(--ip-blue);background:#EAF1FF;border:1px solid #C8DBFF;border-radius:9px;padding:8px 12px;cursor:pointer;margin-left:10px}.cb-exp:hover{background:#DCE8FF}' +
      '.cb-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:11px 16px 4px;overflow-x:auto}' +
      '.cb-tab{flex:none;font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:5px 12px;cursor:pointer}' +
      '.cb-tab b{font-family:var(--mono)}.cb-tab.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}' +
      '.cb-row{display:flex;align-items:center;gap:11px;padding:10px 16px;border-top:1px solid var(--line);cursor:pointer}.cb-row:hover{background:var(--card-2,#F6F8FB)}' +
      '.cb-tag{flex:none;width:92px;text-align:center;font-size:10.5px;font-weight:800;border-radius:7px;padding:4px 0}' +
      '.cb-nm{flex:1;min-width:0;font-size:13.5px;font-weight:700;color:var(--ip-ink)}.cb-nm small{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '.cb-cov{flex:none;min-width:56px;text-align:right}' +
      '.cb-qt{flex:none;min-width:64px;text-align:right;font-size:14px;font-weight:800;font-family:var(--mono);color:var(--ip-ink)}.cb-qt small{font-size:10px;color:var(--muted);font-weight:600;font-family:var(--font)}' +
      '@media(max-width:600px){.cb-tag{width:78px}.cb-cov{display:none}}' +
      /* ticket de position (overlay) */
      '.tk-ov{position:fixed;inset:0;z-index:9000;background:rgba(16,19,28,.45);display:none;align-items:center;justify-content:center;padding:16px}' +
      '.tk-box{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:20px 20px 22px;position:relative;box-shadow:0 18px 50px rgba(16,19,28,.28)}' +
      '.tk-x{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card-2,#F6F8FB);font-size:14px;font-weight:800;color:var(--muted);cursor:pointer}' +
      '.tk-title{font-size:17px;font-weight:800;color:var(--ip-ink);padding-right:34px;line-height:1.2}' +
      '.tk-cip{font-size:11.5px;color:var(--muted);font-weight:600;font-family:var(--mono);margin:3px 0 10px}' +
      '.tk-sig{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}' +
      '.tk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}' +
      '.tk-kpi{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:10px 8px;text-align:center}' +
      '.tk-kpi b{display:block;font-size:17px;font-weight:800;font-family:var(--mono);color:var(--ip-ink)}.tk-kpi span{font-size:10px;color:var(--muted);font-weight:600}' +
      '.tk-price{font-size:12.5px;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:10px;padding:9px 12px;margin-bottom:14px}.rb{background:var(--ip-ink);border-radius:14px;overflow:hidden;margin:0 0 16px;box-shadow:var(--sh-1)}.rb-in{display:flex;gap:30px;padding:9px 16px;white-space:nowrap;color:#EAEEF6;font-family:var(--mono);font-size:12.5px;animation:rbDef 45s linear infinite;width:max-content}.rb:hover .rb-in{animation-play-state:paused}.rb-in b{font-weight:600;color:#fff}.rb-in em{font-style:normal}.rb-up{color:#3FD69A}.rb-dn{color:#FF8DA1}.rb-j0{color:#FF8DA1;font-weight:600}.rb-fl{color:#98A2B8}@keyframes rbDef{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion:reduce){.rb-in{animation:none;flex-wrap:wrap;white-space:normal;width:auto}}.pv-hd{padding:13px 18px 0}.pv-hd b{font-size:14px;font-weight:800;display:block}.pv-hd span{font-size:11.5px;color:var(--muted);display:block;margin-top:2px}.pv-gr{padding:8px 18px 0}.pv-gr svg{width:100%;height:132px;display:block}.pv-ax{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:2px}.pv-ax span:first-child{margin-left:38%}.pv-lg{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:var(--muted);padding:9px 0 4px}.pv-lg i{display:inline-block;width:18px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px}.pv-note{flex:1;min-width:180px}@media(max-width:600px){.pv-ax span:first-child{margin-left:30%}}.sec-bar{height:5px;border-radius:99px;background:var(--line);margin-top:6px;max-width:320px}.sec-bar i{display:block;height:100%;border-radius:99px;background:#0E7C86}.tk-warn{font-size:11.5px;color:#a8651a;background:#FFF6E8;border:1px solid #F0C98A;border-radius:9px;padding:7px 11px;margin:-8px 0 14px;line-height:1.45}.tk-price b{color:var(--ip-ink);font-family:var(--mono)}' +
      '.tk-h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:6px 0 8px}' +
      '.tk-proj{border:1px solid var(--line);border-radius:10px;background:var(--card-2,#F6F8FB);padding:6px 8px;margin-bottom:4px}.tk-proj svg{width:100%;height:82px;display:block}' +
      '.tk-projlab{display:flex;justify-content:space-between;font-size:11px;font-weight:800;margin:0 2px 14px}' +
      '.tk-spark{display:flex;align-items:flex-end;gap:6px;height:96px;padding:0 2px}' +
      '.tk-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px}' +
      '.tk-bar i{width:100%;max-width:34px;background:var(--ip-blue);border-radius:4px 4px 0 0;display:block}' +
      '.tk-bar b{font-size:10px;font-weight:700;color:var(--ip-ink);font-family:var(--mono)}.tk-bar span{font-size:9.5px;color:var(--muted);font-weight:600}' +
      '.tk-sites{display:flex;align-items:flex-end;gap:8px;height:52px;margin-bottom:4px}' +
      '.tk-site{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}.tk-site i{width:100%;max-width:26px;background:#0E7C86;border-radius:3px 3px 0 0;display:block}.tk-site span{font-size:9px;font-weight:700;color:var(--muted)}.tk-site b{font-size:9.5px;font-family:var(--mono);color:var(--ip-ink)}' +
      /* vue globale (hero 4 tuiles) + navigation */
      '.ap-hero{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
      '.ap-htile{text-align:left;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--hc);border-radius:14px;padding:13px 15px;cursor:pointer;transition:.15s}' +
      '.ap-htile:hover{box-shadow:0 4px 14px rgba(16,19,28,.08);transform:translateY(-1px)}' +
      '.ap-hbig{font-size:26px;font-weight:800;font-family:var(--mono);color:var(--hc);letter-spacing:-.02em;line-height:1}' +
      '.ap-hlab{font-size:13px;font-weight:800;color:var(--ip-ink);margin-top:5px}' +
      '.ap-hsub{font-size:11px;color:var(--muted);font-weight:600;margin-top:1px}' +
      '.ap-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:0;z-index:10;background:var(--bg,#EEF1F6);padding:8px 0}' +
      // Vue macro « Besoins & offre » — fonds opaques uniquement, aucun effet de flou
      // ni de transparence calculée (règle Safari §5 : le Mac de Will fige).
      '.pm-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:2px 0 12px}' +
      '.pm-k{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px 13px}' +
      '.pm-k b{display:block;font-size:23px;font-weight:900;line-height:1.15;letter-spacing:-.4px}' +
      '.pm-k span{display:block;margin-top:4px;font-size:11.5px;color:var(--muted);line-height:1.35}' +
      '.pm-hl{background:var(--bg);border:1px solid var(--line);border-left:4px solid var(--ip-blue);' +
        'border-radius:10px;padding:12px 14px;margin:0 0 14px}' +
      // `>b` et non `b` : sinon un <b> de mise en valeur DANS le texte passe en bloc et
      // part à la ligne comme un titre (vu à la capture, invisible pour les tests).
      '.pm-hl>b{display:block;font-size:15px;line-height:1.35;margin-bottom:5px}' +
      '.pm-hl small{display:block;font-size:11.5px;color:var(--muted);line-height:1.5}' +
      '.pm-hl small b{font-weight:800;color:var(--text,#111)}' +
      '.pm-sub{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;' +
        'color:var(--muted);margin:14px 0 6px;padding-top:11px;border-top:1px solid var(--line)}' +
      '@media(max-width:640px){.pm-kpi{grid-template-columns:1fr}.pm-k b{font-size:20px}}' +
      // Avis du marché dans le ticket de commande — fonds pleins, cohérent avec .tk-*
      '.tk-nat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:2px 0 6px}' +
      '.tk-nat>div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 10px}' +
      '.tk-nat b{display:block;font-size:15px;font-weight:900;line-height:1.25}' +
      '.tk-nat span{display:block;margin-top:3px;font-size:10.5px;color:var(--muted);line-height:1.35}' +
      '.tk-natf{font-size:11px;color:var(--muted);line-height:1.45;margin:0 0 10px}' +
      '@media(max-width:640px){.tk-nat{grid-template-columns:1fr}}' +
      '.ap-navb{flex:1;min-width:120px;font-size:13.5px;font-weight:800;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:11px;padding:10px 8px;cursor:pointer;transition:.15s}' +
      '.ap-navb:hover{border-color:#C9D2E0}.ap-navb.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}' +
      '@media(max-width:640px){.ap-hero{grid-template-columns:1fr 1fr}.ap-navb{min-width:0;font-size:12.5px;padding:9px 4px}}' +
      /* vue calendrier (groupée fournisseur) */
      '.cl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}' +
      '.cl-tab{flex:1;min-width:88px;font-size:12.5px;font-weight:800;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 6px;cursor:pointer}.cl-tab.on{background:var(--ip-ink);color:#fff;border-color:var(--ip-ink)}' +
      '.cl-band{display:flex;gap:5px;margin-bottom:14px}' +
      '.cl-bd{flex:1;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:6px 2px}.cl-bd .dn{font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase}.cl-bd .cn{font-size:14px;font-weight:800;font-family:var(--mono);margin-top:2px}.cl-bd.today{background:var(--ip-blue);color:#fff}.cl-bd.today .dn{color:#fff;opacity:.85}' +
      '.cl-th{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}' +
      '.cl-big{font-size:18px;font-weight:900;margin:3px 0 12px;color:var(--ip-ink)}' +
      '.cl-today{margin-bottom:6px}' +
      '.cl-sup{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:12px;padding:11px 13px;margin-bottom:9px}' +
      '.cl-suh{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.cl-suh b{font-size:14px;font-weight:800}.cl-suh span{font-size:11.5px;color:var(--muted);font-weight:700;font-family:var(--mono);white-space:nowrap}' +
      '.cl-line{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;background:none;border:0;border-top:1px solid var(--line);padding:7px 0 0;margin-top:7px;font:inherit;cursor:pointer;text-align:left}' +
      '.cl-line span{font-size:12.5px;color:var(--ip-ink);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-line b{font-family:var(--mono);font-size:13px;color:var(--c);flex:none}' +
      '.cl-line:first-of-type{border-top:0}' +
      '.cl-more{font-size:11px;color:var(--muted);font-weight:700;text-align:center;padding:4px}' +
      '.cl-nx{display:flex;align-items:center;gap:10px;padding:9px 2px;border-top:1px solid var(--line);font-size:13px}.cl-nx .d{width:76px;font-weight:800;color:var(--ip-ink)}.cl-nx .i{flex:1;color:var(--muted);font-weight:600;font-size:12px}' +
      '.cl-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}' +
      '.cl-wc{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:7px 6px;min-height:110px}.cl-wc.today{background:#EAF1FF;border-color:#C8DBFF}' +
      '.cl-wch{font-size:10.5px;font-weight:800;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:6px}.cl-wch b{color:var(--ip-ink);font-family:var(--mono)}' +
      '.cl-wc .cl-sup{padding:7px 8px;margin-bottom:6px}.cl-wc .cl-suh b{font-size:12px}.cl-wc .cl-suh span{font-size:10px}.cl-wc .cl-line{display:none}' +
      '.cl-mhead{font-size:14px;font-weight:800;margin-bottom:8px}' +
      '.cl-mgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.cl-mdn{font-size:10px;font-weight:800;color:var(--muted);text-align:center}' +
      '.cl-mcell{aspect-ratio:1;border:1px solid var(--line);border-radius:9px;background:var(--card);position:relative}.cl-mcell.today{outline:2px solid var(--ip-blue)}' +
      '.cl-mcell .dn{position:absolute;top:4px;left:6px;font-size:10.5px;font-weight:700;color:var(--muted);font-family:var(--mono)}.cl-mcell .cn{position:absolute;top:4px;right:6px;font-size:12px;font-weight:800;font-family:var(--mono)}.cl-mcell .ld{position:absolute;left:5px;right:5px;bottom:5px;height:5px;border-radius:4px}' +
      '@media(max-width:640px){.cl-wk{grid-template-columns:1fr}.cl-wc{min-height:0}.cl-wc .cl-line{display:flex}.cl-tab{min-width:0}}' +
      '.ap-sec{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ip-ink);margin:22px 0 2px}' +
      '.ap-secsub{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5}' +
      /* actu appro + prédictif */
      '.ac-pred{display:flex;align-items:center;gap:12px;padding:11px 14px;border-top:1px solid var(--line)}.ac-pred:first-child{border-top:0}' +
      '.ac-ic{width:34px;height:34px;border-radius:10px;color:#fff;display:grid;place-items:center;font-size:15px;font-weight:800;flex:none}' +
      '.ac-pt{min-width:0}.ac-pt b{display:block;font-size:14px;font-weight:800;color:var(--ip-ink)}.ac-pt span{font-size:12px;color:var(--muted);font-weight:600}' +
      '.ac-news{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border-top:1px solid var(--line);text-decoration:none}.ac-news:first-child{border-top:0}.ac-news:hover{background:var(--card-2,#F6F8FB)}' +
      '.ac-cat{flex:none;font-size:10px;font-weight:800;color:#fff;border-radius:999px;padding:3px 9px;margin-top:1px;white-space:nowrap}' +
      '.ac-nm{min-width:0}.ac-nm b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink);line-height:1.3}.ac-nm span{font-size:11.5px;color:var(--muted);font-weight:600}' +
      '.ap-fresh{font-size:11px;color:var(--muted);line-height:1.5;margin-top:20px;padding-top:12px;border-top:1px solid var(--line)}.ap-fresh b{color:var(--ip-ink)}' +
      '.ap-fresh-warn{font-size:11.5px;line-height:1.5;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(213,87,59,.09);border:1px solid rgba(213,87,59,.28);color:var(--rose,#D5573B)}' +
      '.ap-rap-lk{color:var(--ip-blue,#0050E6);font-weight:600;text-decoration:none;white-space:nowrap}' +
      '.ap-recall{display:block;width:100%;text-align:left;margin:0 0 12px;padding:11px 14px;border-radius:11px;background:#FBE9E6;border:1px solid #E8A99C;color:#B02A1E;font-weight:700;font-size:13.5px;cursor:pointer}' +
      // ── Cockpit Anticiper ──
      '.an-pl{display:flex;gap:10px;margin:2px 0 12px}.an-pl>div{flex:1;border-radius:14px;padding:12px;color:#fff}' +
      '.an-pl .lose{background:linear-gradient(135deg,#D5573B,#B02A1E)}.an-pl .win{background:linear-gradient(135deg,#1E9E6A,#127a50)}' +
      '.an-pl b{display:block;font-family:var(--mono,monospace);font-size:21px;font-weight:800;line-height:1}.an-pl span{font-size:10.5px;opacity:.93;display:block;margin-top:5px;line-height:1.3}' +
      '.an-frise{background:#fff;border:1px solid var(--line);border-radius:14px;padding:8px 4px 4px;overflow-x:auto;margin-bottom:14px}' +
      '.an-dotrow{position:relative;height:92px;min-width:520px}' +
      '.an-today{position:absolute;left:16%;top:4px;bottom:16px;width:2px;background:#D5573B}.an-today span{position:absolute;top:-2px;left:4px;font-size:9px;color:#D5573B;font-weight:800}' +
      '.an-axis{position:absolute;left:0;right:0;bottom:12px;height:1px;background:var(--line)}' +
      '.an-tick{position:absolute;bottom:0;font-size:9px;color:var(--muted);transform:translateX(-50%)}' +
      '.an-ev{position:absolute;transform:translateX(-50%);text-align:center;width:72px}' +
      '.an-d{width:13px;height:13px;border-radius:50%;margin:0 auto;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.1)}' +
      '.an-jl{font-family:var(--mono,monospace);font-size:10px;font-weight:700;margin-top:3px}.an-el{font-size:9.5px;color:var(--muted);line-height:1.15;margin-top:1px}' +
      '.an-empty{position:absolute;top:36px;left:0;right:0;text-align:center;font-size:12px;color:var(--muted)}' +
      '.an-lane{margin-bottom:14px}.an-lhd{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;padding:9px 13px;border-radius:11px;color:#fff;margin-bottom:8px}' +
      '.an-lhd .an-n{margin-left:auto;font-family:var(--mono,monospace)}' +
      '.an-lane.buy .an-lhd{background:#1E9E6A}.an-lane.sw .an-lhd{background:#6D5AE6}.an-lane.cut .an-lhd{background:#D5573B}.an-lane.flush .an-lhd{background:#C77700}' +
      '.an-verb{font-size:11px;font-weight:800;font-family:var(--mono,monospace);white-space:nowrap}.an-verb.buy{color:#1E9E6A}.an-verb.sw{color:#6D5AE6}.an-verb.sell{color:#D5573B}' +
      '.cl-suh .mitm{display:inline-block;width:8px;height:8px;border-radius:50%;background:#B02A37;vertical-align:middle;margin-left:3px}' +
      '.rev .rt .dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}' +
      /* radar */
      '.rad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:6px}' +
      '.rzone{padding:0;overflow:hidden}' +
      '.rzh{padding:12px 15px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}' +
      '.rzh .ring{width:16px;height:16px;border-radius:50%;border:3px solid var(--z);flex:none}' +
      '.rzh h3{margin:0;font-size:12.5px;font-weight:800}.rzh small{display:block;font-size:10.5px;color:var(--muted);font-weight:600}' +
      '.rev{padding:11px 15px;border-top:1px solid var(--line)}.rev:first-of-type{border-top:0}' +
      '.rev .rt{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--ip-ink)}' +
      '.rev .rs{font-size:11.5px;color:var(--muted);margin:3px 0 0 14px;line-height:1.4}' +
      '.rev .rr{font-size:11.5px;font-weight:800;color:var(--c-opp);margin:5px 0 0 14px}' +
      /* stock par établissement */
      '.sites{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:9px;padding:14px 16px}' +
      '.site{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:9px 8px;text-align:center}' +
      '.site .code{font-size:12px;font-weight:800}.site .qt{font-size:16px;font-weight:800;margin:2px 0}.site .pct{font-size:10px;color:var(--muted);font-weight:700}' +
      '.site .sbar{height:5px;border-radius:3px;background:#E4E8EF;margin-top:7px;overflow:hidden}.site .sbar i{display:block;height:100%;background:#0E7C86;border-radius:3px}' +
      '.imbhd{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ip-ink);padding:6px 16px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}' +
      '.imbhd span{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:0 8px;font-size:11px;color:var(--muted)}' +
      '.imb{padding:12px 16px;border-top:1px solid var(--line)}' +
      '.imb .imn{font-size:13px;font-weight:800;color:var(--ip-ink)}' +
      '.imb .imm{font-size:11.5px;color:var(--muted);margin:2px 0 8px}.imb .imm b{color:var(--ip-ink)}' +
      '.imbar{display:flex;align-items:flex-end;gap:6px;height:44px}' +
      '.imbar .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}' +
      '.imbar .col .b{width:100%;max-width:32px;border-radius:3px 3px 0 0;background:#C6D0DE;min-height:2px}.imbar .col .b.hot{background:var(--c-amber)}.imbar .col .b.zero{background:#EAEDF2}' +
      '.imbar .col small{font-size:9px;color:var(--muted);font-weight:700}' +
      '.imb .imfix{font-size:11.5px;font-weight:800;color:#0E7C86;margin-top:8px}.imb .imfix b{color:var(--ip-ink)}' +
      /* négo labo chiffrée */
      '.neg-row{padding:12px 16px;border-top:1px solid var(--line)}.neg-row:first-of-type{border-top:0}' +
      '.neg-top{display:flex;align-items:center;gap:9px}' +
      '.neg-lab{font-size:14px;font-weight:800;color:var(--ip-ink)}' +
      '.neg-share{font-size:11px;font-weight:700;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:1px 8px}' +
      '.neg-top .ap-up,.neg-top .ap-down,.neg-top .ap-flat{margin-left:auto;font-size:12.5px;font-weight:800}' +
      '.neg-nums{font-size:12.5px;color:var(--ip-ink);margin-top:5px;font-family:var(--mono)}.neg-nums b{font-weight:800}' +
      '.neg-tops{font-size:11.5px;color:var(--muted);margin-top:3px}' +
      '.neg-line{font-size:11.5px;font-weight:700;color:#0E7C86;margin-top:6px;line-height:1.4}' +
      '@media(max-width:720px){.ap-grid2{grid-template-columns:1fr}.ap-kpis{grid-template-columns:1fr 1fr}.rad{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }
})();
