/* L'étude par produit — chargement des données, rendu des trois versions, sélecteur local. Calculs : v2-etude.js (V2.etude._calc). */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var E = V2.etude = V2.etude || {};
  var K = E._calc;
  if (!K) return;
  var fr = K.fr, pct = K.pct;
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var moisLib = function (ym) { return MOIS_L[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); };
  var AGES = ['0-19 ans', '20-59 ans', '60 ans et plus', 'âge inconnu'];
  var S = { version: 0, cip: null, region: null, regionAuto: null, tr: {}, f: {}, essais: 0, n: 0 };
  var CLE = 'jarvis.etude.version';

  // ── Version choisie : ?etude=1|2|3, sinon la dernière mémorisée sur ce poste ; 0 = rien (production inchangée) ──
  function lireVersion() {
    var m = /[?&]etude=([0-3])/.exec(location.search), v = m ? +m[1] : null;
    if (v === null) { try { v = +(localStorage.getItem(CLE) || 0); } catch (x) { v = 0; } }
    return v >= 1 && v <= 3 ? v : 0;
  }
  S.version = lireVersion();
  E.version = function (v) {
    if (arguments.length) { S.version = v >= 1 && v <= 3 ? v : 0; try { localStorage.setItem(CLE, String(S.version)); } catch (x) { /* séance seule */ } }
    return S.version;
  };

  // ── Chargement : une tranche de CIP (≤ 160 Ko) + quelques petits fichiers, jamais au démarrage ──
  function json(url) {
    if (S.f[url]) return S.f[url];
    var jour = new Date().toISOString().slice(0, 10);
    return S.f[url] = fetch(url + (url.indexOf('?') < 0 ? '?v=' + jour : ''), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function charger(cip) {
    var tr = 'etude-france/' + cip.slice(-2) + '.json';
    return Promise.all([json(tr).then(function (t) { S.tr[cip.slice(-2)] = t || false; }), json('etude-france/index.json'), json('ansm-archive.json'), json('ansm-causes.json'), json('ema-penuries.json')])
      .then(function (r) { S.idx = r[1]; S.arch = r[2]; S.causes = r[3]; S.pen = r[4]; S.charge = S.charge || {}; S.charge[cip] = 1; });
  }
  function comptoir() { return V2.comptoir || {}; }
  function ligne(cip) {
    var c = comptoir(), d = c._calc && c._calc.donnees && c._calc.donnees();
    return d && d.parCip && d.parCip[cip] ? { d: d, l: d.parCip[cip] } : null;
  }

  // ── Nos ventes sur les mêmes mois que la France ──
  function nousVsFrance(cip, d, serie) {
    var W = window.WML_SALES, mois = d.mois || [], pos = {}, q = [], i, r, k, communs = [], ym;
    if (!W || !W.length || !mois.length) return null;
    for (i = 0; i < mois.length; i++) { pos[mois[i]] = i; q.push(0); }
    for (i = 0; i < W.length; i++) { r = W[i]; if (!(r[4] > 0) || pos[r[1]] === undefined || String(r[3]) !== cip) continue; q[pos[r[1]]] += r[4]; }
    for (i = 0; i < mois.length; i++) {
      ym = V2.anneeDeMois(mois[i]) + '-' + ('0' + V2.moisDeMois(mois[i])).slice(-2);
      k = serie.mois.indexOf(ym);
      if (k >= 0) communs.push({ ym: ym, nous: q[i], france: serie.tous[k] });
    }
    return K.tendanceCommune(communs, 10);
  }
  // ── Région : l'officine ouverte, sinon la région où le réseau a le plus de clientes pour ce produit ──
  function regionAuto(cip) {
    var W = window.WML_SALES, ph = {}, cnt = {}, i, r, p, reg, best = null, bn = 0, route = V2.route;
    (V2.pharmacies || []).forEach(function (x) { ph[String(x.id)] = x; });
    if (route && route.name === 'produits' && route.param && ph[String(route.param)] && K.regionDeCp(ph[String(route.param)].cp))
      return { c: K.regionDeCp(ph[String(route.param)].cp), src: 'pharmacie ouverte' };
    if (W) {
      var vu = {};
      for (i = 0; i < W.length; i++) { r = W[i]; if (!(r[4] > 0) || String(r[3]) !== cip || vu[r[0]]) continue; vu[r[0]] = 1; p = ph[String(r[0])]; reg = p && K.regionDeCp(p.cp); if (reg) cnt[reg] = (cnt[reg] || 0) + 1; }
    }
    Object.keys(cnt).forEach(function (c) { if (cnt[c] > bn) { bn = cnt[c]; best = c; } });
    return best ? { c: best, src: 'région où le réseau compte le plus de clientes pour ce produit' } : { c: '11', src: 'repli : Île-de-France (aucune cliente pour ce produit)' };
  }

  // ── L'objet complet, ou null tant que tout n'est pas là ──
  E.donnees = function (cip) {
    var o = ligne(cip), tr, serie, s, R, reg, regs, ra, age, prev, rn;
    if (!o) return null;
    if (!S.charge || !S.charge[cip]) { if (!S.enCours || S.enCours !== cip) { S.enCours = cip; charger(cip).then(function () { S.enCours = null; E.redessiner(); }); } return null; }
    tr = S.tr[cip.slice(-2)];
    serie = tr ? K.serieDe(tr, cip) : null;
    s = comptoir().stats(o.l, o.d);
    R = comptoir()._fichier && comptoir()._fichier('regional');
    var out = { cip: cip, l: o.l, s: s, d: o.d, serie: serie, aRegional: !!R };
    if (!serie) return out;
    out.france = K.resumeFrance(serie);
    out.saison = K.saisonIndices(serie.tous, serie.mois);
    out.presc = K.partsPrescripteurs(serie);
    prev = s && s.tendance && s.tendance.previsions;
    out.prev = prev; out.niv = K.niveauxPrevision(serie.tous, prev);
    out.nous = nousVsFrance(cip, o.d, serie);
    if (R && R.data) {
      if (!S.marche) { S.marche = []; for (var i = 0; i < R.regions.length; i++) S.marche.push(0); Object.keys(R.data).forEach(function (c) { (R.data[c].b || []).forEach(function (v, j) { S.marche[j] += v || 0; }); }); }
      rn = R.data[cip];
      if (rn) { out.regions = K.partsRegions(R.regions, rn.b || [], S.marche); out.age = K.partsAge(rn.a || [], AGES); }
      if (!S.regionAuto || S.regionAuto.cip !== cip) { ra = regionAuto(cip); S.regionAuto = { cip: cip, c: ra.c, src: ra.src }; }
      out.regionChoisie = S.region && S.regionAuto.cip === cip && S.regionSel === cip ? S.region : S.regionAuto.c;
      out.regionSrc = out.regionChoisie === S.regionAuto.c ? S.regionAuto.src : 'choix manuel';
    }
    var nom = o.l.d;
    out.ruptures = K.rupturesPassees(S.arch, nom);
    out.penuries = K.penuriesEma(S.pen, cip, nom);
    out.arch = S.arch; out.causes = S.causes; out.idx = S.idx;
    return out;
  };
  E.choisirRegion = function (c) { S.region = c; S.regionSel = S.cip; E.redessiner(); };

  // ══ Rendu : petits morceaux ═══════════════════════════════
  var uid = 0;
  function courbe(D, compact) {
    var s = D.serie, n = s.n, W = 640, H = compact ? 100 : 230, pl = 44, pr = 12, pt = 12, pb = 26, plus = D.niv && D.prev.fiable ? 12 : 0, tot = n + plus, id = 'etg' + (++uid);
    var max = 0, i; for (i = 0; i < n; i++) if (s.tous[i] > max) max = s.tous[i];
    if (D.niv && D.prev.fiable && D.niv.h12 > max) max = D.niv.h12;
    max = niceMax(max * 1.1);
    var X = function (j) { return pl + j * (W - pl - pr) / (tot - 1); }, Y = function (v) { return pt + (H - pt - pb) * (1 - v / max); };
    var g = '<svg class="et-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Boîtes remboursées en France, mois par mois, de ' + moisLib(s.mois[0]) + ' à ' + moisLib(s.mois[n - 1]) + '">';
    g += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0050E6" stop-opacity=".22"/><stop offset="1" stop-color="#0050E6" stop-opacity="0"/></linearGradient></defs>';
    for (i = 0; i <= 2; i++) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(max * i / 2).toFixed(1) + '" y2="' + Y(max * i / 2).toFixed(1) + '" stroke="rgba(16,19,28,.09)"/><text x="' + (pl - 6) + '" y="' + (Y(max * i / 2) + 4).toFixed(1) + '" text-anchor="end" class="et-ax">' + abrev(max * i / 2) + '</text>';
    for (i = 0; i < n; i++) if (s.mois[i].slice(5) === '01') g += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" class="et-ax">' + s.mois[i].slice(0, 4) + '</text>';
    var pts = [], a = '';
    for (i = 0; i < n; i++) pts.push(X(i).toFixed(1) + ',' + Y(s.tous[i]).toFixed(1));
    g += '<polygon points="' + X(0).toFixed(1) + ',' + Y(0).toFixed(1) + ' ' + pts.join(' ') + ' ' + X(n - 1).toFixed(1) + ',' + Y(0).toFixed(1) + '" fill="url(#' + id + ')"/>';
    g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0050E6" stroke-width="2.2" stroke-linejoin="round"/>';
    if (plus) {
      var x0 = X(n - 1), x1 = X(tot - 1);
      g += '<rect x="' + x0.toFixed(1) + '" y="' + Y(D.niv.h12).toFixed(1) + '" width="' + (x1 - x0).toFixed(1) + '" height="' + Math.max(2, Y(D.niv.b12) - Y(D.niv.h12)).toFixed(1) + '" fill="#1E9E6A" fill-opacity=".16"/>';
      g += '<line x1="' + x0.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y1="' + Y(D.niv.m12).toFixed(1) + '" y2="' + Y(D.niv.m12).toFixed(1) + '" stroke="#0F7A52" stroke-width="2.2" stroke-dasharray="5 4"/>';
      g += '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (Y(D.niv.h12) - 6).toFixed(1) + '" text-anchor="middle" class="et-ax et-prev">prévision 12 mois</text>';
    }
    return g + '</svg>';
  }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v || 1))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function abrev(v) { return v >= 1e6 ? fr(v / 1e6, 1) + ' M' : v >= 1e3 ? fr(v / 1e3) + ' k' : fr(v); }
  function saisonSvg(ind) {
    var W = 300, H = 120, i, mx = Math.max.apply(null, ind), mn = Math.min.apply(null, ind), g = '<svg class="et-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Indice saisonnier, de janvier à décembre">', L = 'JFMAMJJASOND', bw = 18;
    g += '<line x1="0" x2="' + W + '" y1="' + (92 - 76 / mx).toFixed(1) + '" y2="' + (92 - 76 / mx).toFixed(1) + '" stroke="rgba(16,19,28,.25)" stroke-dasharray="3 3"/>';
    for (i = 0; i < 12; i++) {
      var h = Math.max(3, ind[i] / mx * 76), x = 6 + i * 24.5, cl = ind[i] === mx ? '#0050E6' : ind[i] === mn ? '#C7791A' : '#9DB8F2';
      g += '<rect x="' + x.toFixed(1) + '" y="' + (92 - h).toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="4" fill="' + cl + '"/><text x="' + (x + bw / 2).toFixed(1) + '" y="110" text-anchor="middle" class="et-ax">' + L[i] + '</text>';
    }
    return g + '</svg>';
  }
  function barrePart(segs) {
    var h = '<div class="et-stack" role="img" aria-label="' + esc(segs.map(function (x) { return x.l + ' ' + fr(x.p * 100) + ' %'; }).join(', ')) + '">';
    segs.forEach(function (x, i) { if (x.p > 0.002) h += '<i class="et-s' + (i % 4) + '" style="flex:' + (x.p * 100).toFixed(2) + ' 1 0"><b>' + (x.p >= 0.08 ? fr(x.p * 100) + ' %' : '') + '</b></i>'; });
    h += '</div><ul class="et-leg">';
    segs.forEach(function (x, i) { h += '<li><i class="et-k' + (i % 4) + '"></i>' + esc(x.l) + ' <b>' + fr(x.p * 100) + ' %</b></li>'; });
    return h + '</ul>';
  }
  function carte(cls, titre, corps, note) { return '<section class="et-c ' + cls + '"><h4>' + titre + '</h4>' + corps + (note ? '<p class="et-n">' + note + '</p>' : '') + '</section>'; }
  function mesure(lib, val, sous, ton) { return '<div class="et-m' + (ton ? ' ' + ton : '') + '"><small>' + lib + '</small><b>' + val + '</b>' + (sous ? '<span>' + sous + '</span>' : '') + '</div>'; }
  function ton(x) { return x == null ? '' : x > 0.005 ? 'up' : x < -0.005 ? 'down' : ''; }

  // ── Les cartes ──
  function cCourbe(D, compact) {
    var f = D.france, h = '<div class="et-ms">' + mesure('Boîtes remboursées par mois', fr(f.moyMois), 'moyenne des 12 derniers mois, jusqu\'en ' + moisLib(f.dernier)) +
      mesure('Évolution sur 12 mois', pct(f.evo), 'face aux 12 mois précédents', ton(f.evo)) + '</div>' + courbe(D, compact);
    if (D.prev && D.prev.fiable && !compact) {
      h += '<div class="et-pv"><span><small>3 mois</small><b>' + fr(D.prev.m3) + ' %</b><i>' + fr(D.prev.b3) + ' à ' + fr(D.prev.h3) + '</i></span><span><small>6 mois</small><b>' + fr(D.prev.m6) + ' %</b><i>' + fr(D.prev.b6) + ' à ' + fr(D.prev.h6) + '</i></span><span><small>12 mois</small><b>' + fr(D.prev.m12) + ' %</b><i>' + fr(D.prev.b12) + ' à ' + fr(D.prev.h12) + '</i></span></div>';
    }
    return carte('et-w', 'La France, mois par mois', h, 'Boîtes remboursées par l\'Assurance Maladie, ' + moisLib(D.serie.mois[0]) + ' à ' + moisLib(f.dernier) + '.' +
      (D.prev ? (D.prev.fiable ? (compact ? ' Prévision (100 = rythme des 3 derniers mois) : ' + fr(D.prev.m3) + ' % à 3 mois (' + fr(D.prev.b3) + ' à ' + fr(D.prev.h3) + '), ' + fr(D.prev.m6) + ' % à 6 mois (' + fr(D.prev.b6) + ' à ' + fr(D.prev.h6) + '), ' + fr(D.prev.m12) + ' % à 12 mois (' + fr(D.prev.b12) + ' à ' + fr(D.prev.h12) + ') ; bande verte : fourchette à 12 mois.' : ' Prévision : 100 = rythme des 3 derniers mois ; la bande verte est la fourchette à 12 mois.') : ' Prévision non affichée : la fourchette du modèle est trop large pour décider.') : ' Pas de prévision publiée pour ce produit.'));
  }
  function cSaison(D) {
    if (!D.saison) return '';
    var ind = D.saison, hi = ind.indexOf(Math.max.apply(null, ind)), lo = ind.indexOf(Math.min.apply(null, ind)), MC = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return carte('', 'Saisonnalité', '<p class="et-ph et-ha4">Mois le plus fort : <b>' + MC[hi] + '</b> (' + pct(ind[hi] - 1) + ' face à un mois moyen). Mois le plus faible : <b>' + MC[lo] + '</b> (' + pct(ind[lo] - 1) + ').</p>' + saisonSvg(ind),
      'Indices recalculés sur les cinq années complètes 2021 à 2025 (Medic\'AM), chaque mois rapporté à la moyenne de son année. Trait pointillé : un mois moyen.');
  }
  function cRegion(D, pleine) {
    if (!D.regions) return carte('', 'Sa région face à la France', '<p class="et-n">Données régionales indisponibles pour ce produit.</p>');
    var reg = D.regions, ch = null, i, sel = '<label class="et-sel">Région <select onchange="V2.etude.choisirRegion(this.value)">';
    reg.forEach(function (r) { if (r.c === D.regionChoisie) ch = r; sel += '<option value="' + r.c + '"' + (r.c === D.regionChoisie ? ' selected' : '') + '>' + esc(r.n) + '</option>'; });
    sel += '</select></label>';
    var tri = reg.slice().sort(function (a, b) { return b.produit - a.produit; }), liste = pleine ? tri : tri.slice(0, 5), mx = 0;
    if (ch && liste.indexOf(ch) < 0) liste = liste.concat([ch]);
    liste.forEach(function (r) { mx = Math.max(mx, r.produit, r.marche); });
    var h = ch ? '<p class="et-ph"><b>' + esc(ch.n) + '</b> pèse <b>' + fr(ch.produit * 100, 1) + ' %</b> des boîtes de ce produit en France, pour <b>' + fr(ch.marche * 100, 1) + ' %</b> de l\'ensemble des médicaments remboursés : ' + (Math.abs(ch.indice) < 0.03 ? 'une consommation conforme à la moyenne' : ch.indice > 0 ? 'une consommation supérieure à la moyenne (' + pct(ch.indice) + ')' : 'une consommation inférieure à la moyenne (' + pct(ch.indice) + ')') + '.</p>' : '';
    h += '<div class="et-rg">';
    liste.forEach(function (r) {
      h += '<div class="et-rr' + (ch && r.c === ch.c ? ' on' : '') + '"><span>' + esc(r.n) + '</span><div class="et-rb"><i class="p" style="width:' + (r.produit / mx * 100).toFixed(1) + '%"></i><i class="m" style="width:' + (r.marche / mx * 100).toFixed(1) + '%"></i></div><b>' + fr(r.produit * 100, 1) + ' %</b></div>';
    });
    h += '</div><p class="et-leg2"><i class="p"></i>ce produit <i class="m"></i>tous médicaments remboursés</p>';
    return carte('', 'Sa région face à la France', (pleine ? sel : '') + h, 'Open Medic 2025, boîtes remboursées. Région : ' + esc(D.regionSrc) + '. Région inconnue et outre-mer comptés à part de la métropole.'.replace('Région inconnue et outre-mer comptés à part de la métropole.', 'Les boîtes de région inconnue sont écartées.'));
  }
  function cAge(D) {
    if (!D.age) return carte('', 'Âge des patients', '<p class="et-n">Répartition par âge indisponible pour ce produit.</p>');
    var inc = D.age[3] ? D.age[3].p : 0, connus = D.age.slice(0, 3), tot = connus.reduce(function (a, x) { return a + x.p; }, 0), segs = connus.map(function (x) { return { l: x.l, p: tot ? x.p / tot : 0 }; });
    return carte('', 'Âge des patients', barrePart(segs), 'Open Medic 2025, France entière' + (inc > 0.005 ? ' ; ' + fr(inc * 100) + ' % des boîtes sans âge connu, écartées du calcul' : '') + '.');
  }
  function cPresc(D) {
    var p = D.presc; if (!p || p.ville == null) return '';
    var tend = '';
    if (p.parAn.length > 1) {
      tend = '<p class="et-ph">Part de l\'hôpital, année par année : ' + p.parAn.map(function (a) { return '<b>' + a.an + (a.mois < 12 ? '*' : '') + '</b> ' + fr(a.hop * 100) + ' %'; }).join(' · ') + '.</p>';
    }
    return carte('', 'Qui prescrit', barrePart([{ l: 'Ville (médecins libéraux)', p: p.ville }, { l: 'Hôpital (médecins salariés)', p: p.hop }]) + tend,
      '12 derniers mois, boîtes remboursées (Medic\'AM). Medic\'AM ne détaille pas la spécialité.' + (p.parAn.some(function (a) { return a.mois < 12; }) ? ' * année incomplète.' : ''));
  }
  function cNous(D, interne) {
    var t = D.nous;
    if (!t) return carte('et-nous', 'Notre réseau face à la France', '<p class="et-n">Pas assez de ventes sur les mêmes mois pour comparer.</p>');
    var per = function (r) { return r[0] === r[1] ? moisLib(r[0]) : moisLib(r[0]).replace(/ \d{4}$/, '') + ' à ' + moisLib(r[1]); };
    var h = '<div class="et-ms">' + mesure('Notre réseau', t.nous == null ? 'trop peu de ventes' : pct(t.nous), 'ventes en pourcentage', t.nous == null ? '' : ton(t.nous)) + mesure('France entière', pct(t.france), 'boîtes remboursées', ton(t.france)) + '</div>';
    h += '<p class="et-ph">' + esc(per(t.debut)) + ' face à ' + esc(per(t.fin)) + ', sur les mêmes mois des deux côtés (' + t.k + ' mois contre ' + t.k + ').</p>';
    return carte('et-nous', 'Notre réseau face à la France', h, 'Évolution en pourcentage : les ' + t.k + ' derniers mois communs face aux ' + t.k + ' premiers. La France est publiée jusqu\'en ' + moisLib(D.france.dernier) + '.');
  }
  function cFaits(D) {
    var s = D.s || {}, x = s.autres || {}, g = s.generique, h = '', i, l;
    h += '<div class="et-f"><em>Avis de la Haute Autorité de santé</em>' + (x.has ? '<b>' + (x.has.smr && x.has.smr !== 'SMR' ? 'SMR ' + esc(x.has.smr) + ' · ' : 'SMR reconnu · ') + 'ASMR ' + esc(x.has.asmr || '—') + '</b><span>avis du ' + dateJ(x.has.date) + (x.has.motif ? ' · ' + esc(x.has.motif) : '') + '</span>' : '<b>Aucun avis récent</b>') + '</div>';
    var gl = { commercialise: 'Un générique est commercialisé', nouveau: 'Nouveau groupe de génériques', repertoire: 'Groupe inscrit au répertoire des génériques', aucun: 'Aucun générique commercialisé' };
    h += '<div class="et-f"><em>Génériques et biosimilaires</em><b>' + esc(g && g.statut ? gl[g.statut] || g.statut : 'Information non disponible') + '</b>';
    var em = (g && g.ema || []).filter(function (e) { return !/refus|withdrawn/i.test(e.statut || ''); });
    if (em.length) { h += '<span>À venir (agence européenne) : ' + em.slice(0, 3).map(function (e) { return esc(e.nom) + ' (' + esc(e.type) + ', ' + esc(e.statut === 'Authorised' ? 'autorisé' : e.statut === 'Opinion' ? 'avis favorable' : e.statut) + ')'; }).join(' ; ') + (em.length > 3 ? ' et ' + (em.length - 3) + ' autres' : '') + '</span>'; }
    h += '</div>';
    var rp = D.ruptures || [], an = x.ansm;
    h += '<div class="et-f"><em>Ruptures en France (ANSM)</em>' + (an ? '<b>' + esc(an.statut) + ' en ce moment</b>' : rp.length ? '<b>' + rp.length + ' épisode' + (rp.length > 1 ? 's' : '') + ' passé' + (rp.length > 1 ? 's' : '') + '</b>' : '<b>Aucune rupture enregistrée</b>');
    rp.slice(0, 2).forEach(function (e) { h += '<span>' + esc(String(e.spec || e.k).replace(/\s*–.*$/, '')) + ' : ' + esc((e.st || '').toLowerCase()) + ' du ' + dateJ(e.d) + ' au ' + dateJ(e.f) + ' (' + fr(e.j) + ' jours)</span>'; });
    var ca = D.causes; if (ca && ca.causes && ca.derniere_complete && ca.causes[ca.derniere_complete] && ca.causes[ca.derniere_complete][0]) { var c0 = ca.causes[ca.derniere_complete][0]; h += '<span class="et-sm">Cause la plus fréquente des signalements en ' + ca.derniere_complete + ' : ' + esc(c0.c.toLowerCase()) + ' (' + fr(c0.p) + ' %).</span>'; }
    h += '<span class="et-sm">Historique ANSM conservé depuis ' + (D.arch && D.arch.episodes && D.arch.episodes.length ? moisLib(D.arch.episodes.reduce(function (m, e) { return e.d < m ? e.d : m; }, '9999').slice(0, 7)) : 'peu') + '.</span></div>';
    var pn = D.penuries || [];
    h += '<div class="et-f"><em>Pénuries européennes (agence européenne)</em>' + (pn.length ? '<b>' + pn.length + ' signalement' + (pn.length > 1 ? 's' : '') + '</b>' : '<b>Aucune pénurie signalée</b>');
    pn.slice(0, 2).forEach(function (p) { h += '<span>' + esc(p.name) + ' : pénurie signalée le ' + dateJ(p.start) + ', ' + (/resolved/i.test(p.status) ? 'aujourd\'hui résolue' + (p.resolution ? ' (le ' + dateJ(p.resolution) + ')' : '') : 'toujours en cours') + '</span>'; });
    h += '</div>';
    return carte('et-w et-faits', 'Réglementaire et approvisionnement', '<div class="et-fg">' + h + '</div>');
  }
  function dateJ(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }
  function cInterne(D) {
    var s = D.s, n = s && s.nosVentes, pc = s && s.parCommercial, h = '';
    if (n) h += '<div class="et-ms">' + mesure('Nos ventes', fr(n.boites) + ' boîtes', n.periode) + mesure('Chiffre d\'affaires', fr(Math.round(n.ca / 1000)) + ' k€', fr(n.clientes) + ' clientes') + '</div>';
    if (pc && pc.lignes) pc.lignes.slice(0, 8).forEach(function (x) { h += '<p class="et-ph"><b>' + esc(x.nom) + '</b> : ' + fr(x.boites) + ' boîtes, ' + fr(Math.round((x.ca || 0) / 1000)) + ' k€ (commercial)</p>'; });
    return '<section class="et-c et-w et-int"><h4><em>Interne</em> Chez nous · masqué en vue pharmacien</h4>' + (h || '<p class="et-n">Ventes du réseau non chargées.</p>') + '</section>';
  }

  // ── Accroche en une phrase ──
  function phrase(D) {
    var f = D.france, t = D.nous, h = '<b>' + esc(D.l.d) + '</b> : ' + fr(f.moyMois) + ' boîtes remboursées par mois en France, ' + (f.evo == null ? '' : pct(f.evo) + ' face aux 12 mois précédents') + '.';
    if (t && t.nous != null) h += ' Dans notre réseau : <b>' + pct(t.nous) + '</b>, en France : <b>' + pct(t.france) + '</b>.';
    return h;
  }
  function attente(D, c) { return '<p class="et-att" role="status">' + (D === null ? 'Chargement de l\'étude…' : 'Cette étude n\'est pas disponible : ce produit n\'est pas dans les ventes France mensuelles (Medic\'AM).') + '</p>'; }
  function toutes(D, o) {
    return cCourbe(D) + cSaison(D) + cRegion(D, o.pleine) + cAge(D) + cPresc(D) + cNous(D) + cFaits(D) + (o.interne ? cInterne(D) : '');
  }
  function css() {
    if (document.getElementById('et-css')) return;
    var st = document.createElement('style'); st.id = 'et-css';
    st.textContent = E.CSS; document.head.appendChild(st);
  }

  // ══ v1 : bloc 7 dans le panneau ══
  E.v1 = function (l, s, vp) {
    var v = S.version, D;
    if (!v) return '';
    css(); S.cip = String(l.cip);
    if (v !== 1) return '<div class="et-cta"><button class="v2-btn v2-btn-primary" onclick="V2.etude.ouvrir(\'' + esc(l.cip) + '\')">' + (v === 2 ? 'Ouvrir l\'étude en plein écran' : 'Voir la page à laisser (A4)') + '</button></div>';
    D = E.donnees(S.cip);
    return '<section class="cq-bl et-v1" aria-labelledby="et-b7"><h3 class="cq-bt" id="et-b7"><span>7</span>L\'étude du produit</h3>' +
      (D && D.serie ? '<p class="et-ph et-acc">' + phrase(D) + '</p><div class="et-g1">' + toutes(D, { pleine: false, interne: !vp }) + '</div>' : attente(D)) + '</section>';
  };

  // ══ v2 et v3 : surcouches ══
  function hote() { var h = document.getElementById('et-hote'); if (!h) { h = document.createElement('div'); h.id = 'et-hote'; document.body.appendChild(h); } return h; }
  E.ouvrir = function (cip) {
    css(); S.cip = String(cip); S.ouvert = S.version === 3 ? 3 : 2; S.region = S.region; E.redessiner(); document.documentElement.classList.add('et-ouvert');
  };
  E.fermer = function () { S.ouvert = 0; var h = document.getElementById('et-hote'); if (h) h.innerHTML = ''; document.documentElement.classList.remove('et-ouvert'); };
  E.imprimer = function () { document.documentElement.classList.add('et-imprime'); try { window.print(); } finally { setTimeout(function () { document.documentElement.classList.remove('et-imprime'); }, 500); } };
  E.basculerVue = function (b) { comptoir().vuePharma && comptoir().vuePharma(b); E.redessiner(); };
  function pageA4(D) {
    var f = D.france, nom = esc(D.l.d), t = D.nous;
    return '<article class="et-a4" id="et-a4"><header><div><small>L\'étude du produit</small><h1>' + nom + '</h1><p>' + esc([D.l.labo, D.l.mol, 'CIP ' + D.l.cip].filter(Boolean).join(' · ')) + '</p></div><div class="et-ent"><b>Intégral Pharma</b><span>groupe de grossistes-répartiteurs</span></div></header>' +
      '<p class="et-ph et-acc">' + phrase(D) + '</p><div class="et-ga4">' + cCourbe(D, true) + cNous(D) + cSaison(D) + cAge(D) + cPresc(D) + cRegion(D, false) + cFaits(D) + '</div>' +
      '<footer>Sources : Assurance Maladie (Medic\'AM, Open Medic), Haute Autorité de santé, ANSM, agence européenne des médicaments, base publique des médicaments. Données France jusqu\'en ' + moisLib(f.dernier) + '.</footer></article>';
  }
  function echelle() {
    var a = document.getElementById('et-a4'), w = document.getElementById('et-feuille'); if (!a || !w) return;
    var k = Math.min(1, (window.innerWidth - 16) / 794); a.style.transform = 'scale(' + k + ')'; w.style.height = Math.ceil(1123 * k) + 'px'; w.style.width = Math.ceil(794 * k) + 'px';
  }
  E.redessiner = function () {
    var cip = S.cip, D, h, vp, c = comptoir();
    if (S.version === 1 && c.repose) c.repose();
    if (!S.ouvert) { selecteur(); return; }
    D = E.donnees(cip); vp = c.vuePharma ? c.vuePharma() : false;
    if (S.ouvert === 3) {
      h = '<div class="et-ov et-ov3" role="dialog" aria-label="Page à laisser"><div class="et-bar"><b>La page à laisser</b><span><button onclick="V2.etude.imprimer()">Imprimer / PDF</button><button onclick="V2.etude.fermer()" aria-label="Fermer">Fermer</button></span></div><div class="et-defil"><div class="et-feuille" id="et-feuille">' + (D && D.serie ? pageA4(D) : attente(D)) + '</div></div></div>';
    } else {
      h = '<div class="et-ov et-ov2" role="dialog" aria-label="L\'étude du produit"><div class="et-bar"><b>L\'étude du produit</b><span><button class="et-vp' + (vp ? ' on' : '') + '" aria-pressed="' + vp + '" onclick="V2.etude.basculerVue(' + (!vp) + ')">Vue pharmacien</button><button onclick="V2.etude.fermer()" aria-label="Fermer">Fermer</button></span></div>' +
        '<div class="et-corps">' + (D && D.serie ? '<header class="et-hero"><small>' + esc([D.l.labo, 'CIP ' + D.l.cip].filter(Boolean).join(' · ')) + '</small><h1>' + esc(D.l.d) + '</h1><p>' + phrase(D) + '</p></header><div class="et-g2">' + toutes(D, { pleine: true, interne: !vp }) + '</div>' : attente(D)) + '</div></div>';
    }
    hote().innerHTML = h; selecteur(); if (S.ouvert === 3) echelle();
  };
  window.addEventListener('resize', function () { if (S.ouvert === 3) echelle(); });

  // ── Sélecteur local (banc seulement) ──
  function selecteur() {
    var el = document.getElementById('et-sel'), cur = S.version;
    if (!window.__LOCAL_TEST || !S.cip) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'et-sel'; document.body.appendChild(el); }
    el.innerHTML = '<span>Étude</span>' + [1, 2, 3].map(function (n) { return '<button class="' + (cur === n ? 'on' : '') + '" onclick="V2.etude.choisir(' + n + ')">' + n + '</button>'; }).join('');
  }
  E.choisir = function (n) {
    E.version(n); E.fermer();
    if (n === 1) { var c = comptoir(); if (c.ouvrir) c.ouvrir(S.cip); } else { E.ouvrir(S.cip); }
    selecteur();
  };
  E.etat = S;
  E.CSS = "#et-hote,.et-v1,#et-sel{--et-ink:#10131C;--et-ink3:#5B6272;--et-blue:#0050E6;--et-deep:#0034A0;--et-wash:#EAF1FF;--et-alt:#F7F9FC;--et-line:rgba(16,19,28,.09);--et-up:#0F7A52;--et-down:#C7283D;font-family:var(--font)}\n.et-c{min-width:0;box-sizing:border-box;padding:16px 16px 14px;border-radius:18px;border:1px solid var(--et-line);background:#fff;box-shadow:var(--sh-1);margin-top:12px}\n.et-c h4{margin:0 0 10px;font:800 13px/1.2 var(--font);text-transform:uppercase;letter-spacing:.06em;color:var(--et-deep)}\n.et-c h4 em{font-style:normal;margin-right:8px;padding:3px 9px;border-radius:999px;background:#fff;color:var(--et-deep)}\n.et-int{background:var(--et-deep);color:#fff;border-color:var(--et-deep)}.et-int h4{color:#fff}.et-int .et-m small,.et-int .et-m span{color:#D9E5FF}.et-int .et-m b{color:#fff}\n.et-int .et-ph{color:#fff}.et-int .et-n{color:#D9E5FF}\n.et-ph{margin:0 0 10px;font:400 15px/1.5 var(--font);color:var(--et-ink)}.et-ph b{font-variant-numeric:tabular-nums}\n.et-acc{padding:12px 14px;border-radius:14px;background:var(--et-wash);color:var(--et-deep)}\n.et-n{margin:10px 0 0;font:400 13px/1.45 var(--font);color:var(--et-ink3)}\n.et-att{padding:28px 16px;text-align:center;font:500 15px/1.5 var(--font);color:var(--et-ink3)}\n.et-ms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}\n.et-m{min-width:0;padding:10px 12px;border-radius:14px;background:var(--et-alt)}\n.et-m small{display:block;font:700 12px/1.3 var(--font);color:var(--et-ink3)}\n.et-m b{display:block;margin-top:2px;font:800 26px/1.15 var(--font);color:var(--et-ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}\n.et-m span{display:block;margin-top:2px;font:400 12.5px/1.35 var(--font);color:var(--et-ink3)}\n.et-m.up b{color:var(--et-up)}.et-m.down b{color:var(--et-down)}\n.et-svg{display:block;width:100%;height:auto}\n.et-ax{font:500 10.5px var(--font);fill:#5B6272}.et-prev{fill:#0F7A52;font-weight:700}\n.et-pv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}\n.et-pv span{padding:8px 10px;border-radius:12px;background:var(--et-alt)}.et-pv small{display:block;font:700 12px/1.2 var(--font);color:var(--et-ink3)}\n.et-pv b{display:block;font:800 20px/1.2 var(--font);color:var(--et-ink);font-variant-numeric:tabular-nums}.et-pv i{font:400 12px/1.3 var(--font);font-style:normal;color:var(--et-ink3)}\n.et-stack{display:flex;height:34px;border-radius:10px;overflow:hidden}.et-stack i{display:flex;align-items:center;justify-content:center;min-width:0}.et-stack b{font:800 13px/1 var(--font);color:#fff}\n.et-s0{background:#0050E6}.et-s1{background:#5C93F2}.et-s2{background:#0F7A52}.et-s3{background:#8A91A3}\n.et-leg{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px}.et-leg li{font:400 14px/1.4 var(--font);color:var(--et-ink)}\n.et-k0,.et-k1,.et-k2,.et-k3{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}.et-k0{background:#0050E6}.et-k1{background:#5C93F2}.et-k2{background:#0F7A52}.et-k3{background:#8A91A3}\n.et-rg{display:grid;gap:6px}.et-rr{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) 52px;align-items:center;gap:8px;font:400 13.5px/1.3 var(--font);color:var(--et-ink)}\n.et-rr.on{font-weight:800;color:var(--et-deep)}.et-rr b{text-align:right;font-variant-numeric:tabular-nums}\n.et-rb{display:grid;gap:3px}.et-rb i{display:block;height:7px;border-radius:99px}.et-rb .p{background:#0050E6}.et-rb .m{background:#B9C2D6}\n.et-leg2{margin:8px 0 0;font:400 12.5px/1.3 var(--font);color:var(--et-ink3)}.et-leg2 i{display:inline-block;width:10px;height:8px;border-radius:3px;margin:0 5px 0 0}.et-leg2 i+i{margin-left:12px}.et-leg2 .p{background:#0050E6}.et-leg2 .m{background:#B9C2D6}\n.et-sel{display:flex;align-items:center;gap:8px;margin-bottom:10px;font:700 13px var(--font);color:var(--et-ink3)}.et-sel select{min-height:44px;max-width:100%;padding:0 10px;border-radius:10px;border:1px solid var(--et-line);font:500 16px var(--font);background:#fff;color:var(--et-ink)}\n.et-fg{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.et-f{min-width:0;padding:12px;border-radius:14px;background:var(--et-alt)}\n.et-f em{display:block;font:700 12px/1.3 var(--font);font-style:normal;color:var(--et-ink3);text-transform:uppercase;letter-spacing:.04em}.et-f b{display:block;margin-top:3px;font:800 16px/1.3 var(--font);color:var(--et-ink)}\n.et-f span{display:block;margin-top:4px;font:400 13.5px/1.4 var(--font);color:var(--et-ink3)}.et-f .et-sm{font-size:12.5px}\n.et-g1{display:block}.et-cta{margin:12px 0}.et-cta .v2-btn{width:100%;min-height:48px}\n.et-ov{position:fixed;inset:0;z-index:950;display:flex;flex-direction:column;background:var(--paper,#FBFCFE);overflow:hidden}\n.et-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:56px;padding:6px 14px;background:#fff;border-bottom:1px solid var(--et-line);font:800 15px var(--font);color:var(--et-ink)}\n.et-bar span{display:flex;gap:8px}.et-bar button{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--et-line);background:#fff;font:700 14px var(--font);color:var(--et-ink);cursor:pointer}\n.et-bar .et-vp.on{background:var(--et-wash);border-color:var(--et-blue);color:var(--et-deep)}\n.et-corps{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px 40px}\n.et-hero{max-width:1240px;margin:0 auto}.et-hero small{font:700 14px var(--font);color:var(--et-ink3)}\n.et-hero h1{margin:4px 0 8px;font:900 clamp(26px,4.4vw,48px)/1.1 var(--font);color:var(--et-ink);letter-spacing:-.01em;overflow-wrap:anywhere}\n.et-hero p{margin:0;padding:14px 16px;border-radius:16px;background:var(--et-wash);font:500 clamp(16px,1.7vw,21px)/1.45 var(--font);color:var(--et-deep)}\n.et-g2{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:0 16px}\n@media (min-width:1000px){.et-g2{grid-template-columns:repeat(6,minmax(0,1fr))}.et-g2>.et-c{grid-column:span 2}.et-g2>.et-w{grid-column:span 4}.et-g2>.et-nous{grid-column:span 2}.et-g2>.et-faits,.et-g2>.et-int{grid-column:1/-1}\n.et-ov2 .et-fg{grid-template-columns:repeat(4,minmax(0,1fr))}.et-ov2 .et-ph{font-size:17px}.et-ov2 .et-m b{font-size:36px}.et-ov2 .et-c h4{font-size:15px}.et-ov2 .et-rr{font-size:16px}.et-ov2 .et-leg li{font-size:16px}.et-ov2 .et-n{font-size:14px}.et-ov2 .et-f b{font-size:19px}.et-ov2 .et-f span{font-size:15px}.et-ov2 .et-ax{font-size:11.5px}}\n.et-ov3{background:#D7DCE6}.et-defil{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 8px 30px;box-sizing:border-box}.et-feuille{padding:0}.et-feuille{margin:0 auto}\n.et-feuille{display:block}.et-feuille #et-a4{transform-origin:0 0}\n.et-a4{box-sizing:border-box;width:794px;height:1123px;padding:28px 40px 24px;background:#fff;box-shadow:0 10px 40px rgba(16,19,28,.25);overflow:hidden;position:relative;color:var(--et-ink)}\n.et-a4 header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid var(--et-blue)}\n.et-a4 header small{font:800 11px var(--font);text-transform:uppercase;letter-spacing:.08em;color:var(--et-deep)}.et-a4 h1{margin:2px 0;font:900 26px/1.1 var(--font)}.et-a4 header p{margin:0;font:400 12px var(--font);color:var(--et-ink3)}\n.et-ent{text-align:right}.et-ent b{display:block;font:800 14px var(--font);color:var(--et-deep)}.et-ent span{font:400 11px var(--font);color:var(--et-ink3)}\n.et-a4 .et-acc{margin:10px 0 0;padding:8px 12px;font-size:12.5px}\n.et-ga4{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0 10px}.et-ga4>.et-c{grid-column:span 2}.et-ga4>.et-w{grid-column:1/-1}.et-ga4>.et-c:nth-child(6){grid-column:span 4}.et-a4 .et-ga4>.et-w:first-child .et-ms{display:none}.et-a4 .et-ha4,.et-a4 .et-f .et-sm,.et-a4 .et-nous .et-n{display:none}.et-a4 .et-ms{gap:6px}.et-a4 .et-m b{font-size:17px}\n.et-a4 .et-c{margin-top:8px;padding:9px 12px;box-shadow:none}.et-a4 .et-c h4{margin-bottom:6px;font-size:11px}.et-a4 .et-ph{font-size:11.5px;line-height:1.4;margin-bottom:6px}.et-a4 .et-n{font-size:9.5px;margin-top:5px}\n.et-a4 .et-m b{font-size:20px}.et-a4 .et-m{padding:6px 10px}.et-a4 .et-m small,.et-a4 .et-m span{font-size:10px}.et-a4 .et-ms{margin-bottom:6px}\n.et-a4 .et-svg{max-height:none}.et-a4 .et-pv{margin-top:4px}.et-a4 .et-pv span{padding:4px 8px}.et-a4 .et-pv b{font-size:15px}.et-a4 .et-pv i,.et-a4 .et-pv small{font-size:10px}\n.et-a4 .et-stack{height:24px}.et-a4 .et-leg li{font-size:11px}.et-a4 .et-leg{margin-top:6px;gap:2px 10px}.et-a4 .et-rr{font-size:10.5px;grid-template-columns:100px minmax(0,1fr) 42px}.et-a4 .et-leg2{font-size:10px;margin-top:4px}\n.et-a4 .et-fg{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.et-a4 .et-f{padding:7px 9px}.et-a4 .et-f em{font-size:9.5px}.et-a4 .et-f b{font-size:12px}.et-a4 .et-f span{font-size:10px;margin-top:2px}\n.et-a4 footer{position:absolute;left:40px;right:40px;bottom:20px;padding-top:6px;border-top:1px solid var(--et-line);font:400 9.5px/1.4 var(--font);color:var(--et-ink3)}\n#et-sel{position:fixed;left:10px;bottom:10px;z-index:960;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:#fff;border:1px solid var(--et-line);box-shadow:var(--sh-2);font:700 12px var(--font);color:var(--et-ink3)}\n#et-sel button{width:44px;height:44px;border-radius:999px;border:1px solid var(--et-line);background:#fff;font:800 16px var(--font);color:var(--et-ink);cursor:pointer}#et-sel button.on{background:var(--et-blue);border-color:var(--et-blue);color:#fff}\n@page{size:A4;margin:0}\n@media print{html.et-imprime body>*:not(#et-hote){display:none!important}html.et-imprime,html.et-imprime body{margin:0!important;background:#fff!important;overflow:visible!important}\nhtml.et-imprime .et-ov{position:static!important;display:block!important;background:#fff!important;overflow:visible!important}html.et-imprime .et-bar{display:none!important}\nhtml.et-imprime .et-defil{padding:0!important;overflow:visible!important;display:block!important}html.et-imprime .et-feuille{width:210mm!important;height:297mm!important;padding:0!important;overflow:hidden!important;display:block!important}html.et-imprime #et-a4{transform:none!important;box-shadow:none!important;margin:0!important;width:210mm!important;height:297mm!important}\nhtml.et-imprime *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";
})();
