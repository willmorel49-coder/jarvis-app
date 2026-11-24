/* L'étude par produit (24/11/2026) — le bloc 7 « L'étude du produit » de la fiche produit (vue pharmacien comprise),
   version choisie par Will le 24/11/2026 (« La fiche enrichie »). Rendu : v2-etude-ecran.js.
   Données : Medic'AM par type de prescripteur (etude-france/NN.json, une tranche par produit), marche-regional.json,
   previsions.json, HAS, ANSM, EMA. Nos ventes ne sortent qu'en POURCENTAGE côté pharmacien.
   Les calculs purs sont exposés dans V2.etude._calc (testés dans tests/etude-tendance.test.mjs). */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var E = V2.etude = V2.etude || {};

  var MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function fr(n, dec) { return (+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).replace(/[  ]/g, ' '); }
  function pct(x, dec) { return x == null || !isFinite(x) ? '—' : (x > 0.0005 ? '+' : x < -0.0005 ? '−' : '') + fr(Math.abs(x) * 100, dec || 0) + ' %'; }
  function sansAccent(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function somme(a, i, j) { var s = 0, k; for (k = Math.max(0, i); k < j; k++) s += a[k] || 0; return s; }
  function moisLib(ym) { return MOIS_L[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }

  // ══ Calculs purs ══════════════════════════════════════════════
  function moisListe(m0, n) {
    var y = +m0.slice(0, 4), m = +m0.slice(5, 7), out = [], i;
    for (i = 0; i < n; i++) { out.push(y + '-' + ('0' + m).slice(-2)); m++; if (m === 13) { m = 1; y++; } }
    return out;
  }
  // Une série mensuelle : les retours de boîtes (négatifs) sont ramenés à 0, comme france-mois-data.js.
  function serieDe(tr, cip) {
    var l = tr && tr.d && tr.d[cip], cl = function (a) { return a.map(function (v) { return v > 0 ? v : 0; }); };
    if (!l) return null;
    return { m0: tr.m0, n: tr.n, mois: moisListe(tr.m0, tr.n), tous: cl(l[0]), ville: cl(l[1]), hop: cl(l[2]) };
  }
  function resumeFrance(s) {
    var n = s.n, l12 = somme(s.tous, n - 12, n), p12 = somme(s.tous, n - 24, n - 12);
    return { l12: l12, p12: p12, evo: p12 > 0 ? l12 / p12 - 1 : null, moyMois: l12 / 12, dernier: s.mois[n - 1], debut12: s.mois[n - 12] };
  }
  // Saisonnalité recalculée sur les années civiles COMPLÈTES (2021 à 2025) : chaque mois est rapporté à la moyenne de SON année
  // (pour ne pas confondre saison et croissance), puis on fait la moyenne des années. 1 = un mois moyen.
  function saisonIndices(tous, mois) {
    var ans = {}, i, m, y, out = [], cpt = 0, somme_ = [];
    mois.forEach(function (x, k) { (ans[x.slice(0, 4)] = ans[x.slice(0, 4)] || []).push(k); });
    for (m = 0; m < 12; m++) somme_.push(0);
    Object.keys(ans).forEach(function (a) {
      var ks = ans[a], t = 0;
      if (ks.length !== 12) return;
      ks.forEach(function (k) { t += tous[k]; });
      if (!(t > 0)) return;
      ks.forEach(function (k) { somme_[+mois[k].slice(5, 7) - 1] += tous[k] / (t / 12); });
      cpt++;
    });
    if (!cpt) return null;
    for (m = 0; m < 12; m++) out.push(somme_[m] / cpt);
    return out;
  }
  // Les années que saisonIndices garde (12 mois publiés, total non nul), et la période écrite en clair (24/11/2026 : bloc 6 = bloc 7).
  function saisonAnnees(tous, mois) {
    var ans = {}, out = [];
    mois.forEach(function (x, k) { var a = x.slice(0, 4); (ans[a] = ans[a] || { n: 0, t: 0 }).n++; ans[a].t += tous[k] || 0; });
    Object.keys(ans).sort().forEach(function (a) { if (ans[a].n === 12 && ans[a].t > 0) out.push(a); });
    return out;
  }
  function periodeAnnees(ans) {
    if (!ans || !ans.length) return null;
    if (ans.length === 1) return 'de janvier à décembre ' + ans[0];
    for (var i = 1; i < ans.length; i++) if (+ans[i] !== +ans[i - 1] + 1) return 'années ' + ans.slice(0, -1).join(', ') + ' et ' + ans[ans.length - 1];
    return 'de janvier ' + ans[0] + ' à décembre ' + ans[ans.length - 1];
  }
  function partsPrescripteurs(s) {
    var n = s.n, v = somme(s.ville, n - 12, n), h = somme(s.hop, n - 12, n), t = v + h, par = [], y, ans = {}, i;
    s.mois.forEach(function (x) { ans[x.slice(0, 4)] = 1; });
    Object.keys(ans).sort().forEach(function (a) {
      var vv = 0, hh = 0;
      for (i = 0; i < n; i++) if (s.mois[i].slice(0, 4) === a) { vv += s.ville[i]; hh += s.hop[i]; }
      if (vv + hh > 0) par.push({ an: a, hop: hh / (vv + hh), mois: s.mois.filter(function (x) { return x.slice(0, 4) === a; }).length });
    });
    return { ville: t ? v / t : null, hop: t ? h / t : null, parAn: par };
  }
  // « Notre tendance face à la France » sur les MÊMES mois des deux côtés.
  // moisCommuns : [{ ym, nous, france }] dans l'ordre. Les k premiers mois face aux k derniers (k = 3 au plus).
  function tendanceCommune(moisCommuns, plancher) {
    var n = moisCommuns.length, k = Math.min(3, Math.floor(n / 2)), a = 0, b = 0, fa = 0, fb = 0, i;
    plancher = plancher == null ? 10 : plancher;
    if (k < 1) return null;
    for (i = 0; i < k; i++) { a += moisCommuns[i].nous; fa += moisCommuns[i].france; b += moisCommuns[n - 1 - i].nous; fb += moisCommuns[n - 1 - i].france; }
    var r = { k: k, debut: [moisCommuns[0].ym, moisCommuns[k - 1].ym], fin: [moisCommuns[n - k].ym, moisCommuns[n - 1].ym], nous: null, france: null, insuffisant: false };
    if (fa > 0) r.france = fb / fa - 1;
    if (a >= plancher && b >= plancher) r.nous = b / a - 1; else r.insuffisant = true;
    return r;
  }
  var REGIONS_DEP = { '11': '75 77 78 91 92 93 94 95', '24': '18 28 36 37 41 45', '27': '21 25 39 58 70 71 89 90', '28': '14 27 50 61 76',
    '32': '02 59 60 62 80', '44': '08 10 51 52 54 55 57 67 68 88', '52': '44 49 53 72 85', '53': '22 29 35 56',
    '75': '16 17 19 23 24 33 40 47 64 79 86 87', '76': '09 11 12 30 31 32 34 46 48 65 66 81 82', '84': '01 03 07 15 26 38 42 43 63 69 73 74',
    '93': '04 05 06 13 83 84 20', '5': '97 98' };
  var DEP2REG = {};
  Object.keys(REGIONS_DEP).forEach(function (r) { REGIONS_DEP[r].split(' ').forEach(function (d) { DEP2REG[d] = r; }); });
  function regionDeCp(cp) { var d = String(cp || '').replace(/\D/g, '').slice(0, 2); return d.length === 2 ? (DEP2REG[d] || null) : null; }
  // Parts de chaque région : celle du produit, celle de tout le marché remboursé (Open Medic 2025). La région inconnue (dernière) est écartée.
  function partsRegions(regions, bProduit, bMarche) {
    var n = regions.length - 1, tp = 0, tm = 0, i, out = [];
    for (i = 0; i < n; i++) { tp += bProduit[i] || 0; tm += bMarche[i] || 0; }
    if (!(tp > 0) || !(tm > 0)) return null;
    for (i = 0; i < n; i++) out.push({ c: regions[i].c, n: regions[i].n, produit: (bProduit[i] || 0) / tp, marche: (bMarche[i] || 0) / tm,
      indice: ((bProduit[i] || 0) / tp) / (((bMarche[i] || 0) / tm) || 1) - 1 });
    return out;
  }
  function partsAge(a, libs) {
    var t = 0, i, out = [];
    for (i = 0; i < a.length; i++) t += a[i] || 0;
    if (!(t > 0)) return null;
    for (i = 0; i < a.length; i++) out.push({ l: libs[i], p: (a[i] || 0) / t });
    return out;
  }
  // Prévision : niveau mensuel moyen attendu = rythme des 3 derniers mois × pourcentage du modèle.
  function niveauxPrevision(tous, prev) {
    var n = tous.length, base = somme(tous, n - 3, n) / 3;
    return prev ? { base: base, m3: base * prev.m3 / 100, b3: base * prev.b3 / 100, h3: base * prev.h3 / 100, m6: base * prev.m6 / 100, b6: base * prev.b6 / 100, h6: base * prev.h6 / 100,
      m12: base * prev.m12 / 100, b12: base * prev.b12 / 100, h12: base * prev.h12 / 100 } : null;
  }
  function marqueDe(nom) {
    var m = sansAccent(nom).replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] || '';
    return m.length >= 4 ? m : '';
  }
  // Ruptures passées : épisodes clos de l'archive ANSM dont la spécialité commence par la marque du produit.
  function rupturesPassees(arch, nom) {
    var m = marqueDe(nom), out = [];
    if (!arch || !arch.episodes || !m) return [];
    arch.episodes.forEach(function (e) { if (sansAccent(e.spec || e.k).replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] === m) out.push(e); });
    return out;
  }
  // L'ANSM signale par nom de présentation, sans CIP : on compare le premier dosage écrit des deux côtés
  // (« XARELTO 20MG CPR » face à « Xarelto 1 mg/mL, granulés… »). true = même dosage, false = autre présentation, null = on ne sait pas.
  function dosageDe(nom) {
    var t = sansAccent(nom).replace(/[\u00a0\u202f]/g, ' ').replace(/(\d) (?=\d{3}\b)/g, '$1'), m = /(\d+(?:[.,]\d+)?)\s*(mg|µg|mcg|g|ui|ml|%)/.exec(t);
    return m ? (+m[1].replace(',', '.')) + (m[2] === 'mcg' ? 'µg' : m[2]) : null;
  }
  function memeDosage(nomProduit, spec) {
    var a = dosageDe(nomProduit), b = dosageDe(spec);
    return a && b ? a === b : null;
  }
  function penuriesEma(pen, cip, nom) {
    var m = marqueDe(nom), out = [];
    if (!pen || !pen.items) return [];
    pen.items.forEach(function (p) {
      if ((p.cips || []).indexOf(cip) >= 0 || (m && sansAccent(p.name).split(/\s+/)[0] === m)) out.push(p);
    });
    return out;
  }
  E._calc = { moisListe: moisListe, serieDe: serieDe, resumeFrance: resumeFrance, saisonIndices: saisonIndices, saisonAnnees: saisonAnnees, periodeAnnees: periodeAnnees, partsPrescripteurs: partsPrescripteurs,
    tendanceCommune: tendanceCommune, regionDeCp: regionDeCp, partsRegions: partsRegions, partsAge: partsAge, niveauxPrevision: niveauxPrevision,
    marqueDe: marqueDe, rupturesPassees: rupturesPassees, memeDosage: memeDosage, penuriesEma: penuriesEma, pct: pct, fr: fr };
})();
