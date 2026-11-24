/* L'étude par produit — chargement des données et rendu du bloc 7 de la fiche produit (version choisie par Will le 24/11/2026). Calculs : v2-etude.js (V2.etude._calc). */
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
  var S = { cip: null, region: null, regionAuto: null, tr: {}, f: {} };

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
  // ── Région : celle choisie dans la liste (l'officine en face), sinon la région où le réseau a le plus de clientes pour ce produit.
  // La fiche ne connaît pas l'officine : l'adresse #produits/<officine> ouvre la vue Client, qui ferme la fiche (vérifié le 24/11/2026). ──
  function regionAuto(cip) {
    var W = window.WML_SALES, ph = {}, cnt = {}, i, r, p, reg, best = null, bn = 0;
    (V2.pharmacies || []).forEach(function (x) { ph[String(x.id)] = x; });
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
    out.saisonPeriode = K.periodeAnnees(K.saisonAnnees(serie.tous, serie.mois));
    out.presc = K.partsPrescripteurs(serie);
    prev = s && s.tendance && s.tendance.previsions;
    out.prev = prev; out.niv = K.niveauxPrevision(serie.tous, prev);
    out.nous = nousVsFrance(cip, o.d, serie);
    if (R && R.data) {
      if (!S.marche) { S.marche = []; for (var i = 0; i < R.regions.length; i++) S.marche.push(0); Object.keys(R.data).forEach(function (c) { (R.data[c].b || []).forEach(function (v, j) { S.marche[j] += v || 0; }); }); }
      rn = R.data[cip];
      if (rn) { out.regions = K.partsRegions(R.regions, rn.b || [], S.marche); out.age = K.partsAge(rn.a || [], AGES); }
      if (!S.regionAuto || S.regionAuto.cip !== cip) { ra = regionAuto(cip); S.regionAuto = { cip: cip, c: ra.c, src: ra.src }; }
      out.regionChoisie = S.region || S.regionAuto.c;   // le choix tient d'un produit à l'autre pendant la séance : c'est la région de l'officine en face
      out.regionSrc = S.region ? 'choisie dans la liste' : S.regionAuto.src;
    }
    var nom = o.l.d;
    out.ruptures = K.rupturesPassees(S.arch, nom);
    out.penuries = K.penuriesEma(S.pen, cip, nom);
    out.arch = S.arch; out.causes = S.causes; out.idx = S.idx;
    return out;
  };
  E.choisirRegion = function (c) { S.region = c || null; E.redessiner(); };
  // Tendance France sur 12 mois, pour le bloc 4 : undefined = pas encore chargée, null = pas de série France pour ce produit.
  E.franceEvo = function (cip) {
    cip = String(cip);
    if (!S.charge || !S.charge[cip]) return undefined;
    var tr = S.tr[cip.slice(-2)], serie = tr ? K.serieDe(tr, cip) : null, f = serie && serie.n >= 24 ? K.resumeFrance(serie) : null;
    return f && f.evo != null ? { evo: f.evo, periode: moisLib(f.debut12) + ' à ' + moisLib(f.dernier) + ' face aux 12 mois précédents' } : null;
  };

  // Saisonnalité France pour le bloc 6 (24/11/2026, choix cliqué de Will : « Celle de l'étude ») : même série et même calcul que la carte du bloc 7.
  // undefined = pas encore chargée, null = pas de série France pour ce produit.
  E.franceSaison = function (cip) {
    cip = String(cip);
    if (!S.charge || !S.charge[cip]) return undefined;
    var tr = S.tr[cip.slice(-2)], serie = tr ? K.serieDe(tr, cip) : null, ind = serie ? K.saisonIndices(serie.tous, serie.mois) : null;
    if (!ind) return null;
    return { moisFort: ind.indexOf(Math.max.apply(null, ind)) + 1, moisFaible: ind.indexOf(Math.min.apply(null, ind)) + 1, indices: ind,
             periode: K.periodeAnnees(K.saisonAnnees(serie.tous, serie.mois)) };
  };

  // ══ Rendu : petits morceaux ═══════════════════════════════
  var uid = 0;
  function courbe(D) {
    var s = D.serie, n = s.n, W = 640, H = 230, pl = 44, pr = 12, pt = 12, pb = 26, plus = D.niv && D.prev.fiable ? 12 : 0, tot = n + plus, id = 'etg' + (++uid);
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
  function cCourbe(D) {
    var f = D.france, h = '<div class="et-ms">' + mesure('Boîtes remboursées par mois', fr(f.moyMois), 'moyenne des 12 derniers mois, jusqu\'en ' + moisLib(f.dernier)) +
      mesure('Évolution sur 12 mois', pct(f.evo), 'face aux 12 mois précédents', ton(f.evo)) + '</div>' + courbe(D);
    if (D.prev && D.prev.fiable) {
      h += '<div class="et-pv"><span><small>3 mois</small><b>' + fr(D.prev.m3) + ' %</b><i>' + fr(D.prev.b3) + ' à ' + fr(D.prev.h3) + '</i></span><span><small>6 mois</small><b>' + fr(D.prev.m6) + ' %</b><i>' + fr(D.prev.b6) + ' à ' + fr(D.prev.h6) + '</i></span><span><small>12 mois</small><b>' + fr(D.prev.m12) + ' %</b><i>' + fr(D.prev.b12) + ' à ' + fr(D.prev.h12) + '</i></span></div>';
    }
    return carte('et-w', 'La France, mois par mois', h, 'Boîtes remboursées par l\'Assurance Maladie, ' + moisLib(D.serie.mois[0]) + ' à ' + moisLib(f.dernier) + '.' +
      (D.prev ? (D.prev.fiable ? ' Prévision : 100 = rythme des 3 derniers mois ; la bande verte est la fourchette à 12 mois.' : ' Prévision non affichée : la fourchette du modèle est trop large pour décider.') : ' Pas de prévision publiée pour ce produit.'));
  }
  function cSaison(D) {
    if (!D.saison) return '';
    var ind = D.saison, hi = ind.indexOf(Math.max.apply(null, ind)), lo = ind.indexOf(Math.min.apply(null, ind)), MC = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return carte('', 'Saisonnalité', '<p class="et-ph">Mois le plus fort : <b>' + MC[hi] + '</b> (' + pct(ind[hi] - 1) + ' face à un mois moyen). Mois le plus faible : <b>' + MC[lo] + '</b> (' + pct(ind[lo] - 1) + ').</p>' + saisonSvg(ind),
      'Indices recalculés sur les années complètes, ' + esc(D.saisonPeriode) + ' (Medic\'AM), chaque mois rapporté à la moyenne de son année. Trait pointillé : un mois moyen.');
  }
  function cRegion(D) {
    if (!D.regions) return carte('', 'Sa région face à la France', '<p class="et-n">Données régionales indisponibles pour ce produit.</p>');
    var reg = D.regions, ch = null, i, sel = '<label class="et-sel">Région <select onchange="V2.etude.choisirRegion(this.value)">';
    reg.forEach(function (r) { if (r.c === D.regionChoisie) ch = r; sel += '<option value="' + r.c + '"' + (r.c === D.regionChoisie ? ' selected' : '') + '>' + esc(r.n) + '</option>'; });
    sel += '</select></label>';
    var tri = reg.slice().sort(function (a, b) { return b.produit - a.produit; }), liste = tri.slice(0, 5), mx = 0;
    if (ch && liste.indexOf(ch) < 0) liste = liste.concat([ch]);
    liste.forEach(function (r) { mx = Math.max(mx, r.produit, r.marche); });
    var h = ch ? '<p class="et-ph"><b>' + esc(ch.n) + '</b> pèse <b>' + fr(ch.produit * 100, 1) + ' %</b> des boîtes de ce produit en France, pour <b>' + fr(ch.marche * 100, 1) + ' %</b> de l\'ensemble des médicaments remboursés : ' + (Math.abs(ch.indice) < 0.03 ? 'une consommation conforme à la moyenne' : ch.indice > 0 ? 'une consommation supérieure à la moyenne (' + pct(ch.indice) + ')' : 'une consommation inférieure à la moyenne (' + pct(ch.indice) + ')') + '.</p>' : '';
    h += '<div class="et-rg">';
    liste.forEach(function (r) {
      h += '<div class="et-rr' + (ch && r.c === ch.c ? ' on' : '') + '"><span>' + esc(r.n) + '</span><div class="et-rb"><i class="p" style="width:' + (r.produit / mx * 100).toFixed(1) + '%"></i><i class="m" style="width:' + (r.marche / mx * 100).toFixed(1) + '%"></i></div><b>' + fr(r.produit * 100, 1) + ' %</b></div>';
    });
    h += '</div><p class="et-leg2"><i class="p"></i>ce produit <i class="m"></i>tous médicaments remboursés</p>';
    return carte('et-region', 'Sa région face à la France', sel + h, 'Open Medic 2025, boîtes remboursées. Région : ' + esc(D.regionSrc) + '. Les boîtes de région inconnue sont écartées.');
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
    // L'archive ANSM est rattachée par la MARQUE (pas de CIP) : un épisode d'un autre dosage est dit « autre présentation », jamais compté comme une rupture de celle-ci.
    var an = x.ansm, rp = (D.ruptures || []).map(function (e) { return { e: e, z: K.memeDosage(D.l.d, e.spec || e.k) }; }).sort(function (a, b) { return (a.z === false) - (b.z === false); }),
      ici = rp.filter(function (r) { return r.z !== false; }), flou = ici.some(function (r) { return r.z === null; }), pl = ici.length > 1 ? 's' : '';
    h += '<div class="et-f"><em>Ruptures en France (ANSM)</em>' + (an ? '<b>' + esc(an.statut) + ' en ce moment</b>' : ici.length ? '<b>' + ici.length + ' épisode' + pl + ' passé' + pl + (flou ? ' sur la marque' : '') + '</b>' : rp.length ? '<b>Aucune rupture de ce dosage enregistrée</b>' : '<b>Aucune rupture enregistrée</b>');
    rp.slice(0, 2).forEach(function (r) { var e = r.e; h += '<span>' + (r.z === false ? 'Autre présentation de la marque (' + esc(String(e.spec || e.k).replace(/\s*–.*$/, '')) + ')' : esc(String(e.spec || e.k).replace(/\s*–.*$/, ''))) + ' : ' + esc((e.st || '').toLowerCase()) + ' du ' + dateJ(e.d) + ' au ' + dateJ(e.f) + ' (' + fr(e.j) + ' jours)</span>'; });
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
  function toutes(D, interne) {
    return cCourbe(D) + cNous(D) + cSaison(D) + cAge(D) + cPresc(D) + cRegion(D) + cFaits(D) + (interne ? cInterne(D) : '');
  }
  function css() {
    if (document.getElementById('et-css')) return;
    var st = document.createElement('style'); st.id = 'et-css';
    st.textContent = E.CSS; document.head.appendChild(st);
  }

  // ══ Le bloc 7 dans la fiche produit ══
  E.bloc = function (l, s, vp) {
    var D;
    css(); S.cip = String(l.cip);
    D = E.donnees(S.cip);
    return '<section class="cq-bl et-v1" aria-labelledby="et-b7"><h3 class="cq-bt" id="et-b7"><span>7</span>L\'étude du produit</h3>' +
      (D && D.serie ? '<p class="et-ph et-acc">' + phrase(D) + '</p><div class="et-g1">' + toutes(D, !vp) + '</div>' : attente(D)) + '</section>';
  };
  // Les données arrivent après le premier rendu : la fiche se redessine en place (sans remonter en haut).
  E.redessiner = function () { var c = comptoir(); if (c.repose) c.repose(); };
  E.etat = S;
  E.CSS = ".et-v1{--et-ink:#10131C;--et-ink3:#5B6272;--et-blue:#0050E6;--et-deep:#0034A0;--et-wash:#EAF1FF;--et-alt:#F7F9FC;--et-line:rgba(16,19,28,.09);--et-up:#0F7A52;--et-down:#C7283D;font-family:var(--font)}\n.et-c{min-width:0;box-sizing:border-box;padding:16px 16px 14px;border-radius:18px;border:1px solid var(--et-line);background:#fff;box-shadow:var(--sh-1);margin-top:12px}\n.et-c h4{margin:0 0 10px;font:800 13px/1.2 var(--font);text-transform:uppercase;letter-spacing:.06em;color:var(--et-deep)}\n.et-c h4 em{font-style:normal;margin-right:8px;padding:3px 9px;border-radius:999px;background:#fff;color:var(--et-deep)}\n.et-int{background:var(--et-deep);color:#fff;border-color:var(--et-deep)}.et-int h4{color:#fff}.et-int .et-m small,.et-int .et-m span{color:#D9E5FF}.et-int .et-m b{color:#fff}\n.et-int .et-ph{color:#fff}.et-int .et-n{color:#D9E5FF}\n.et-ph{margin:0 0 10px;font:400 15px/1.5 var(--font);color:var(--et-ink)}.et-ph b{font-variant-numeric:tabular-nums}\n.et-acc{padding:12px 14px;border-radius:14px;background:var(--et-wash);color:var(--et-deep)}\n.et-n{margin:10px 0 0;font:400 13px/1.45 var(--font);color:var(--et-ink3)}\n.et-att{padding:28px 16px;text-align:center;font:500 15px/1.5 var(--font);color:var(--et-ink3)}\n.et-ms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}\n.et-m{min-width:0;padding:10px 12px;border-radius:14px;background:var(--et-alt)}\n.et-m small{display:block;font:700 12px/1.3 var(--font);color:var(--et-ink3)}\n.et-m b{display:block;margin-top:2px;font:800 26px/1.15 var(--font);color:var(--et-ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}\n.et-m span{display:block;margin-top:2px;font:400 12.5px/1.35 var(--font);color:var(--et-ink3)}\n.et-m.up b{color:var(--et-up)}.et-m.down b{color:var(--et-down)}\n.et-svg{display:block;width:100%;height:auto}\n.et-ax{font:500 10.5px var(--font);fill:#5B6272}.et-prev{fill:#0F7A52;font-weight:700}\n.et-pv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}\n.et-pv span{padding:8px 10px;border-radius:12px;background:var(--et-alt)}.et-pv small{display:block;font:700 12px/1.2 var(--font);color:var(--et-ink3)}\n.et-pv b{display:block;font:800 20px/1.2 var(--font);color:var(--et-ink);font-variant-numeric:tabular-nums}.et-pv i{font:400 12px/1.3 var(--font);font-style:normal;color:var(--et-ink3)}\n.et-stack{display:flex;height:34px;border-radius:10px;overflow:hidden}.et-stack i{display:flex;align-items:center;justify-content:center;min-width:0}.et-stack b{font:800 13px/1 var(--font);color:#fff}\n.et-s0{background:#0050E6}.et-s1{background:#5C93F2}.et-s2{background:#0F7A52}.et-s3{background:#8A91A3}\n.et-leg{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px}.et-leg li{font:400 14px/1.4 var(--font);color:var(--et-ink)}\n.et-k0,.et-k1,.et-k2,.et-k3{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}.et-k0{background:#0050E6}.et-k1{background:#5C93F2}.et-k2{background:#0F7A52}.et-k3{background:#8A91A3}\n.et-rg{display:grid;gap:6px}.et-rr{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) 52px;align-items:center;gap:8px;font:400 13.5px/1.3 var(--font);color:var(--et-ink)}\n.et-rr.on{font-weight:800;color:var(--et-deep)}.et-rr b{text-align:right;font-variant-numeric:tabular-nums}\n.et-rb{display:grid;gap:3px}.et-rb i{display:block;height:7px;border-radius:99px}.et-rb .p{background:#0050E6}.et-rb .m{background:#B9C2D6}\n.et-leg2{margin:8px 0 0;font:400 12.5px/1.3 var(--font);color:var(--et-ink3)}.et-leg2 i{display:inline-block;width:10px;height:8px;border-radius:3px;margin:0 5px 0 0}.et-leg2 i+i{margin-left:12px}.et-leg2 .p{background:#0050E6}.et-leg2 .m{background:#B9C2D6}\n.et-sel{display:flex;align-items:center;gap:8px;margin-bottom:10px;font:700 13px var(--font);color:var(--et-ink3)}.et-sel select{flex:1 1 auto;min-width:0;min-height:44px;max-width:100%;padding:0 10px;border-radius:10px;border:1px solid var(--et-line);font:500 16px var(--font);background:#fff;color:var(--et-ink)}\n.et-fg{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.et-f{min-width:0;padding:12px;border-radius:14px;background:var(--et-alt)}\n.et-f em{display:block;font:700 12px/1.3 var(--font);font-style:normal;color:var(--et-ink3);text-transform:uppercase;letter-spacing:.04em}.et-f b{display:block;margin-top:3px;font:800 16px/1.3 var(--font);color:var(--et-ink)}\n.et-f span{display:block;margin-top:4px;font:400 13.5px/1.4 var(--font);color:var(--et-ink3)}.et-f .et-sm{font-size:12.5px}\n.et-g1{display:block}";
})();
