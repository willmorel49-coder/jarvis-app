/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Catalogue Intégral Pharma" (pages.catalogue)
   Catalogue GROSSISTE complet (10 500 réf médicaments) : filtres
   familles AFMCODE par tranches de prix, recherche, table triée par
   rang qté, pagination, inspecteur DÉTAIL PRODUIT (prix + potentiel
   marché Vol IP / Vol Ameli + ajout fiche).
   ── Concurrents (Drakkars/Cap3000/Leclerc) = pilier Offilog, PAS ici ──
   ── Validé Will 2026-06-10 (preview catalogue) ──
   ── Améliorations 2026-06-11 : tri multi-colonnes, badges rang top,
      section potentiel enrichie, état vide actionnable, debounce search,
      couleurs 100 % tokens CSS ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  // ── État ──────────────────────────────────────
  // sortCol : 'rank_qty' | 'rank_ca' | 'ip_qty' | 'ip_ca' | 'prix_ip' | 'prix_ht'
  // sortDir : 'asc' | 'desc'
  var S = { chip: 'all', q: '', page: 0, sel: null, sortCol: 'rank_qty', sortDir: 'asc' };
  var PER_PAGE = 100;

  var FAMS = [
    { k: 'all',    label: 'Tout',                   sc: '#0050E6' },
    { k: 'p_low',  label: 'Princeps · 0–4,33€',     sc: '#1E9E6A' },
    { k: 'p_mid',  label: 'Princeps · 4,33–468€',   sc: '#F5A524' },
    { k: 'p_high', label: 'Princeps · >468€',       sc: '#C7791A' },
    { k: 'froid',  label: 'Froid',                  sc: '#00B5D8' },
    { k: 'gen',    label: 'Génériques',             sc: '#737A8C' },
    { k: 'genp',   label: 'Génériques partenaires', sc: '#8A6D3B' },
    { k: 'bio',    label: 'Biosimilaires',          sc: '#6D4FC4' },
    { k: 'nr',     label: 'Non remboursés',         sc: '#E5484D' },
  ];
  var FAM_BY_KEY = {}; FAMS.forEach(function (f) { FAM_BY_KEY[f.k] = f; });
  var FAM_SHORT = {
    p_low: 'Petits prix', p_mid: 'Intermédiaire', p_high: 'Cher',
    froid: 'Froid', gen: 'Génér.', genp: 'Génér. part.', bio: 'Biosim.', nr: 'NR'
  };

  // ── Index ─────────────────────────────────────
  var idxBuilt = false, sagittaSet = null, sortedBench = null, benchByCip = null;
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function refPrice(b) {
    var bp = V2.bestPrice(b);            // prix le plus bas (offre labo incluse)
    var p = (bp.ip != null) ? bp.ip : b.prix_ht;
    return (typeof p === 'number' && isFinite(p)) ? p : 0;
  }
  function classify(b) {
    if (b.is_froid) return 'froid';
    var an = norm(b.artnature);
    if (an === 'biosimilaire') return 'bio';
    if (an === 'generique_partenaire' || an === 'generique partenaire') return 'genp';
    if (an === 'generique') return 'gen';
    if ((sagittaSet && sagittaSet.has(String(b.cip13))) || b.has_ameli === false) return 'nr';
    var p = refPrice(b);
    if (p <= 4.33) return 'p_low';
    if (p <= 468) return 'p_mid';
    return 'p_high';
  }
  function buildIndex() {
    if (idxBuilt) return;
    var B = window.BENCHMARK || [];
    sagittaSet = new Set();
    (window.SAGITTA_SHORTLIST || []).forEach(function (s) { if (s && s.cip13 != null) sagittaSet.add(String(s.cip13)); });
    benchByCip = new Map();
    sortedBench = B.slice().sort(function (a, b) { return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9); });
    B.forEach(function (b) { b._fam = classify(b); if (b.cip13 != null && String(b.cip13).trim() !== '') benchByCip.set(String(b.cip13), b); });   // ne pas indexer les CIP vides (sinon tous collident sur la clé '' → mauvais produit)
    idxBuilt = true;
  }

  // ── Seuils top-produits (rang volume) ─────────
  var TOP_TIERS = [
    { max: 10,  label: 'Top 10',  cls: 'rank-s1' },
    { max: 50,  label: 'Top 50',  cls: 'rank-s2' },
    { max: 200, label: 'Top 200', cls: 'rank-s3' },
  ];
  function rankTier(rank) {
    if (!rank || rank <= 0) return null;
    for (var i = 0; i < TOP_TIERS.length; i++) {
      if (rank <= TOP_TIERS[i].max) return TOP_TIERS[i];
    }
    return null;
  }
  function rankBadgeHtml(rank) {
    var t = rankTier(rank);
    if (!t) return '';
    return '<span class="cat-rank-badge ' + t.cls + '">' + t.label + '</span>';
  }

  // ── Tri dynamique ──────────────────────────────
  function makeSorter(col, dir) {
    var sign = dir === 'asc' ? 1 : -1;
    var MISSING = 9e9;
    return function (a, b) {
      var va, vb;
      if (col === 'rank_qty') { va = a.ip_rank_qty || MISSING; vb = b.ip_rank_qty || MISSING; }
      else if (col === 'rank_ca') { va = a.ip_rank_ca  || MISSING; vb = b.ip_rank_ca  || MISSING; }
      else if (col === 'ip_qty')  { va = a.ip_qty  || 0; vb = b.ip_qty  || 0; }
      else if (col === 'ip_ca')   { va = a.ip_ca   || 0; vb = b.ip_ca   || 0; }
      else if (col === 'prix_ip') { va = refPrice(a); vb = refPrice(b); }
      else if (col === 'prix_ht') { va = (a.prix_ht > 0) ? a.prix_ht : 0; vb = (b.prix_ht > 0) ? b.prix_ht : 0; }
      else { va = a.ip_rank_qty || MISSING; vb = b.ip_rank_qty || MISSING; }
      return (va - vb) * sign;
    };
  }

  function filteredBase() {
    var q = S.q.trim().toLowerCase();
    var arr = q
      ? sortedBench.filter(function (b) { return norm(b.designation).indexOf(q) >= 0 || norm(b.cip13).indexOf(q) >= 0; })
      : sortedBench.slice();
    if (S.sortCol !== 'rank_qty' || S.sortDir !== 'asc') {
      arr.sort(makeSorter(S.sortCol, S.sortDir));
    }
    return arr;
  }
  function counts(base) {
    var c = { all: base.length };
    FAMS.forEach(function (f) { if (f.k !== 'all') c[f.k] = 0; });
    for (var i = 0; i < base.length; i++) c[base[i]._fam]++;
    return c;
  }
  function fmtBig(n) {
    if (!n) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
    if (n >= 1e3) return Math.round(n / 1e3) + ' k';
    return V2.fmtNum(n);
  }
  function famBadge(famKey, short) {
    var f = FAM_BY_KEY[famKey] || FAM_BY_KEY.all;
    var lbl = short ? (FAM_SHORT[famKey] || f.label) : f.label;
    return '<span class="cat-badge" style="--bc:' + f.sc + '">' + esc(lbl) + '</span>';
  }

  // remboursable = a un marché Ameli ET pas NR Sagitta (marge MDL applicable)
  function isRemb(b) {
    return b.has_ameli === true && !(sagittaSet && sagittaSet.has(String(b.cip13)));
  }

  // ── Agrégats statistiques sur un périmètre (catalogue entier ou catégorie) ──
  function computeAgg(rows) {
    var a = { refs: rows.length, volIP: 0, caIP: 0, ameli: 0, mdl: 0,
              priceSum: 0, priceN: 0, remSum: 0, remN: 0, nbFroid: 0, nbOffre: 0, nbRemb: 0 };
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i];
      a.volIP += b.ip_qty || 0;
      a.caIP += b.ip_ca || 0;
      a.ameli += b.ameli_total || 0;
      var bpA = V2.bestPrice(b);
      var ip = bpA.ip || 0;
      var ht = bpA.ht || 0;
      if (ip > 0) { a.priceSum += ip; a.priceN++; }
      var rem = bpA.remise;
      if (rem > 0) { a.remSum += rem; a.remN++; }
      if (b.is_froid) a.nbFroid++;
      if (b.offre_ip != null && b.offre_ip > 0) a.nbOffre++;
      if (isRemb(b)) { a.nbRemb++; if (ip > 0) a.mdl += V2.margeMDLboite(ip) * (b.ip_qty || 0); }
    }
    a.prixMoy = a.priceN ? a.priceSum / a.priceN : 0;
    a.remMoy = a.remN ? a.remSum / a.remN : 0;
    a.part = a.ameli > 0 ? (a.volIP / a.ameli * 100) : null;
    return a;
  }
  function kpiCard(k, l, v, d) {
    return '<div class="v2-kpi ' + k + '"><div class="v2-kpi-l">' + l + '</div>' +
      '<div class="v2-kpi-v mono">' + v + '</div>' +
      (d ? '<div class="v2-kpi-d" style="color:var(--muted)">' + d + '</div>' : '') + '</div>';
  }
  function statBand(agg) {
    return '<div class="v2-kpis cat-kpis">' +
      kpiCard('k1', 'Références', V2.fmtNum(agg.refs),
        agg.nbRemb + ' remboursée' + (agg.nbRemb > 1 ? 's' : '') + (agg.nbFroid ? ' · ' + agg.nbFroid + ' froid' : '') + (agg.nbOffre ? ' · ' + agg.nbOffre + ' offre' + (agg.nbOffre > 1 ? 's' : '') : '')) +
      kpiCard('k2', 'Volume IP', fmtBig(agg.volIP) + ' btes',
        agg.part != null ? agg.part.toFixed(2).replace('.', ',') + ' % du marché Ameli' : 'hors remboursement') +
      kpiCard('k3', 'CA IP', V2.fmtEur(agg.caIP),
        agg.prixMoy > 0 ? 'prix net moyen ' + V2.fmtEur(agg.prixMoy) : '') +
      kpiCard('k4', 'Marge MDL potentielle', V2.fmtEur(agg.mdl),
        agg.remMoy > 0 ? 'remise moyenne ' + agg.remMoy.toFixed(1).replace('.', ',') + ' %' : 'sur remboursables') +
    '</div>';
  }

  // ── Inspecteur DÉTAIL PRODUIT (panneau latéral) ──
  function inspector(b) {
    var bpI = V2.bestPrice(b);           // prix le plus bas (offre labo incluse)
    var ht = bpI.ht || 0;
    var ip = bpI.ip || 0;
    var rem = bpI.remise;
    var vol = b.ip_qty || 0;
    var ameli = b.ameli_total || 0;
    var hasOffre = bpI.offre;

    // ── Section potentiel marché enrichie ───────────
    var potHtml;
    if (ameli > 0) {
      var part = Math.min(100, (vol / ameli) * 100);
      var ecartAbs = ameli - vol;
      var potNote;
      if (part < 1) {
        potNote = 'Fort potentiel — tu captes moins de 1 % du marché France.';
      } else if (part < 5) {
        potNote = 'Potentiel significatif — ' + fmtBig(ecartAbs) + ' btes restantes à conquérir.';
      } else if (part < 20) {
        potNote = 'Bonne présence — encore ' + fmtBig(ecartAbs) + ' btes de marge de croissance.';
      } else {
        potNote = 'Position dominante sur ce produit (' + part.toFixed(1) + ' % du marché).';
      }
      // Amplifier visuellement les très petites parts (<0.5%)
      var barW = part < 0.5
        ? Math.max(2, part * 80)
        : Math.max(2, Math.min(100, part));
      potHtml =
        '<div class="cat-pot">' +
          '<div class="cat-pot-head">' +
            '<div class="cat-pot-l">Potentiel marché Ameli</div>' +
            '<div class="cat-pot-pct">' + part.toFixed(2).replace('.', ',') + ' %</div>' +
          '</div>' +
          '<div class="cat-pot-bar"><div class="cat-pot-fill" style="width:' + barW + '%"></div></div>' +
          '<div class="cat-pot-row">' +
            '<div class="cat-pot-stat"><div class="cat-pot-stat-l">Vol IP</div><div class="cat-pot-stat-v">' + V2.fmtNum(vol) + ' btes</div></div>' +
            '<div class="cat-pot-sep"></div>' +
            '<div class="cat-pot-stat"><div class="cat-pot-stat-l">Marché France</div><div class="cat-pot-stat-v">' + fmtBig(ameli) + ' btes</div></div>' +
            '<div class="cat-pot-sep"></div>' +
            '<div class="cat-pot-stat"><div class="cat-pot-stat-l">Écart potentiel</div><div class="cat-pot-stat-v cat-pot-ecart">' + fmtBig(ecartAbs) + ' btes</div></div>' +
          '</div>' +
          '<div class="cat-pot-note">' + esc(potNote) + '</div>' +
        '</div>';
    } else {
      potHtml =
        '<div class="cat-pot nr">' +
          '<div class="cat-pot-l">Non remboursé</div>' +
          '<div class="cat-pot-txt">Pas de marché Ameli (hors remboursement). Marge libre pharmacien — pas de référentiel MDL applicable.</div>' +
        '</div>';
    }

    function kpi(l, v, col) {
      return '<div class="cat-kpi"><div class="cat-kpi-l">' + l + '</div><div class="cat-kpi-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</div></div>';
    }

    // ── Section performance produit (rang, CA IP, marge MDL/boîte, évol. Ameli) ──
    var rank_qty = (b.ip_rank_qty != null && b.ip_rank_qty > 0) ? b.ip_rank_qty : 0;
    var rang = rank_qty > 0 ? '#' + V2.fmtNum(rank_qty) : '—';
    var caIp = (typeof b.ip_ca === 'number' && b.ip_ca > 0) ? V2.fmtEur(b.ip_ca) : '—';
    var mdlBte = (isRemb(b) && ip > 0) ? V2.fmtEur(V2.margeMDLboite(ip)) : 'marge libre';
    var mdlTot = (isRemb(b) && ip > 0 && vol > 0) ? V2.margeMDLboite(ip) * vol : 0;
    var yoy = (typeof b.yoy_jan === 'number' && isFinite(b.yoy_jan)) ? b.yoy_jan : null;
    var yoyHtml = yoy != null
      ? '<span style="color:' + (yoy >= 0 ? 'var(--c-mint)' : 'var(--c-rose)') + '">' + (yoy >= 0 ? '+' : '') + yoy.toFixed(1).replace('.', ',') + ' %</span>'
      : '—';

    // Rang avec badge top-tier dans l’inspecteur
    var rangHtml = rang;
    if (rank_qty > 0) {
      var t = rankTier(rank_qty);
      rangHtml = rang + (t ? ' <span class="cat-rank-badge ' + t.cls + '">' + t.label + '</span>' : '');
    }

    var perfHtml =
      '<div class="cat-perf-l">Performance produit</div>' +
      '<div class="cat-kpi-grid">' +
        '<div class="cat-kpi"><div class="cat-kpi-l">Rang ventes IP</div><div class="cat-kpi-v">' + rangHtml + '</div></div>' +
        kpi('CA IP', caIp) +
        kpi('Marge MDL / boîte', mdlBte, isRemb(b) ? 'var(--c-mint)' : 'var(--c-amber)') +
        kpi('Évol. Ameli (jan.)', yoyHtml) +
      '</div>' +
      (mdlTot > 0 ? '<div class="cat-perf-note">Marge MDL générée par ton volume actuel : <b>' + V2.fmtEur(mdlTot) + '</b></div>' : '');

    return '<div class="cat-insp' + (S.sel != null ? ' open' : '') + '">' +
      '<div class="cat-insp-head">' +
        '<div style="min-width:0"><div class="cat-insp-name">' + esc(b.designation || '') + '</div>' +
          '<div class="cat-insp-cip mono">CIP ' + esc(b.cip13 || '') + '</div>' +
          '<div style="margin-top:8px">' + famBadge(b._fam) + (hasOffre ? '<span class="cat-offre">OFFRE EN COURS</span>' : '') + '</div></div>' +
        '<button class="cat-insp-x" onclick="V2.catSelect(null)" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
      '</div>' +
      '<div class="cat-insp-body">' +
        '<div class="cat-kpi-grid">' +
          kpi('Prix HT', ht > 0 ? V2.fmtEur(ht) : '—') +
          kpi('Prix net IP', ip > 0 ? V2.fmtEur(ip) : '—', 'var(--ip-blue)') +
          kpi('Remise IP', rem > 0 ? rem + '%' : '—', 'var(--c-mint)') +
          kpi('Volume IP', V2.fmtNum(vol)) +
        '</div>' +
        perfHtml +
        potHtml +
        '<div class="cat-insp-cta"><button class="v2-btn v2-btn-primary" onclick="V2.catAddToFiche(\'' + esc(b.cip13) + '\')">' + ICO('plus', 17) + ' Ajouter à une fiche commerciale</button></div>' +
      '</div>' +
    '</div>';
  }

  // ── En-têtes de colonnes triables ─────────────
  function thSort(label, col, alignRight) {
    var active = S.sortCol === col;
    var arrow = active ? (S.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    var cls = 'cat-th-sort' + (active ? ' active' : '') + (alignRight ? ' num' : '');
    return '<th class="' + cls + '" onclick="V2.catSort(\'' + col + '\')">' + label + (active ? '<span class="cat-th-arr">' + arrow + '</span>' : '') + '</th>';
  }

  // ── Table rows ────────────────────────
  function rowsHtml(rows, pageOffset) {
    return rows.map(function (b, i) {
      var bpR = V2.bestPrice(b);          // prix le plus bas (offre labo incluse)
      var ht = bpR.ht || 0;
      var ip = bpR.ip || 0;
      var rem = bpR.remise;
      var sel = (S.sel != null && String(b.cip13) === String(S.sel)) ? ' sel' : '';
      var hasOffre = bpR.offre;
      var rank_qty = b.ip_rank_qty || 0;
      var rankBadge = rankBadgeHtml(rank_qty);
      var rankDisp = rank_qty > 0 ? V2.fmtNum(rank_qty) : '—';
      return '<tr class="cat-row' + sel + '" onclick="V2.catSelect(\'' + esc(b.cip13) + '\')">' +
        '<td class="num cat-row-n">' + (pageOffset + i + 1) + '</td>' +
        '<td><span class="cat-pname">' + esc((b.designation || '').slice(0, 52)) + '</span>' +
          (hasOffre ? '<span class="cat-offre-mini">OFFRE</span>' : '') +
          (rankBadge ? ' ' + rankBadge : '') +
        '</td>' +
        '<td class="cat-cip">' + esc(b.cip13 || '') + '</td>' +
        '<td>' + famBadge(b._fam, true) + '</td>' +
        '<td class="num">' + (ht > 0 ? V2.fmtEur(ht) : '—') + '</td>' +
        '<td class="num cat-ip">' + (ip > 0 ? V2.fmtEur(ip) : '—') + '</td>' +
        '<td class="num cat-rem">' + (rem > 0 ? rem + '%' : '—') + '</td>' +
        '<td class="num">' + V2.fmtNum(b.ip_qty || 0) + '</td>' +
        '<td class="num cat-ca">' + (b.ip_ca > 0 ? fmtBig(b.ip_ca) : '—') + '</td>' +
        '<td class="num" style="color:var(--muted)">' + fmtBig(b.ameli_total || 0) + '</td>' +
        '<td class="num cat-rang-col">' + rankDisp + '</td>' +
        '</tr>';
    }).join('');
  }
  function pager(total, pages) {
    if (pages <= 1) return '';
    var from = S.page * PER_PAGE + 1, to = Math.min(total, (S.page + 1) * PER_PAGE);
    return '<div class="cat-pager">' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + (S.page <= 0 ? ' disabled' : '') + ' onclick="V2.catPage(' + (S.page - 1) + ')">' + ICO('back', 15) + ' Précédent</button>' +
      '<span class="cat-pg-info mono">' + from + '–' + to + ' sur ' + V2.fmtNum(total) + ' · page ' + (S.page + 1) + '/' + pages + '</span>' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + (S.page >= pages - 1 ? ' disabled' : '') + ' onclick="V2.catPage(' + (S.page + 1) + ')">Suivant ' + ICO('chev', 15) + '</button>' +
    '</div>';
  }

  // ── Handlers ──────────────────────
  V2.catFilter = function (k) { S.chip = k; S.page = 0; V2.render(); };

  // Debounce recherche (180 ms) — évite re-renders en cascade sur 10 k lignes
  var _searchTimer = null;
  V2.catSearch = function (val) {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function () {
      S.q = val || ''; S.page = 0; rerenderKeepFocus();
    }, 180);
  };

  V2.catPage = function (p) { S.page = p; V2.render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  V2.catSelect = function (cip) {
    if (cip != null && !benchByCip.has(String(cip))) return;   // produit sans CIP réel → non sélectionnable (avant : ouvrait le mauvais produit)
    S.sel = (cip == null || (S.sel != null && String(S.sel) === String(cip))) ? null : cip;
    V2.render();
  };

  // Tri colonne : même col = inverser direction · autre col = direction naturelle
  // Rangs (rank_qty/rank_ca) : asc par défaut (1 = meilleur en haut)
  // Volumes/CA (ip_qty/ip_ca) : desc par défaut (plus gros d’abord)
  V2.catSort = function (col) {
    if (S.sortCol === col) {
      S.sortDir = S.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      S.sortCol = col;
      S.sortDir = (col === 'ip_qty' || col === 'ip_ca') ? 'desc' : 'asc';
    }
    S.page = 0;
    V2.render();
  };

  V2.catAddToFiche = function (cip) {
    var b = benchByCip.get(String(cip));
    if (!b) return;
    if (!V2.ficheCart) { V2.toast('Module fiches indisponible', 'error'); return; }
    if (V2.ficheCart.has(b.cip13)) { V2.toast('Déjà dans la fiche en cours', 'warn'); return; }
    var bpc = V2.bestPrice(b);
    var n = V2.ficheCart.add({
      cip13: b.cip13, designation: b.designation, prix_ip: bpc.ip,
      prix_ht: bpc.ht, remise_pct: bpc.remise, is_froid: b.is_froid, src: 'cat'
    });
    V2.toast('Ajouté à la fiche en cours (' + n + ')');
  };

  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('cat-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

  // ── CSS ─────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-cat-css')) return;
    var s = document.createElement('style'); s.id = 'v2-cat-css';
    s.textContent = [
      /* Barre de recherche */
      '.cat-search{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:18px;box-shadow:var(--sh-2);transition:.2s var(--ease)}',
      '.cat-search:focus-within{border-color:rgba(0,80,230,.4);box-shadow:0 0 0 4px var(--halo),var(--sh-2)}',
      '.cat-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.cat-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.cat-search .clr{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:2px}',
      /* Stats + compteur */
      '.cat-count{font-size:12px;color:var(--muted);margin-bottom:12px}',
      '.cat-stats-l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:18px 0 12px}',
      '.cat-kpis{margin-bottom:18px}',
      /* Badges famille */
      '.cat-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10.5px;font-weight:700;white-space:nowrap;background:color-mix(in srgb,var(--bc) 13%,#fff);color:var(--bc)}',
      /* Badges rang top-produits (tokens CSS uniquement) */
      '.cat-rank-badge{display:inline-block;padding:2px 7px;border-radius:6px;font-size:9.5px;font-weight:800;letter-spacing:.03em;white-space:nowrap;vertical-align:middle}',
      '.cat-rank-badge.rank-s1{background:color-mix(in srgb,var(--c-amber) 18%,#fff);color:var(--c-amber);border:1px solid color-mix(in srgb,var(--c-amber) 30%,transparent)}',
      '.cat-rank-badge.rank-s2{background:color-mix(in srgb,var(--ip-blue) 12%,#fff);color:var(--ip-blue);border:1px solid color-mix(in srgb,var(--ip-blue) 24%,transparent)}',
      '.cat-rank-badge.rank-s3{background:color-mix(in srgb,var(--muted) 10%,#fff);color:var(--muted);border:1px solid color-mix(in srgb,var(--muted) 22%,transparent)}',
      /* Badge offre — tokens uniquement, plus de couleurs en dur */
      '.cat-offre-mini{display:inline-block;margin-left:7px;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;background:color-mix(in srgb,var(--c-amber) 15%,#fff);color:var(--c-amber)}',
      '.cat-offre{display:inline-block;margin-left:7px;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:700;background:color-mix(in srgb,var(--c-amber) 15%,#fff);color:var(--c-amber)}',
      /* Table */
      '.cat-tablewrap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      '.cat-table-scroll{overflow-x:auto}',
      '.cat-pname{font-weight:600;color:var(--ip-ink)}',
      '.cat-cip{font-family:var(--mono);font-size:11px;color:var(--muted)}',
      '.cat-ip{font-weight:700;color:var(--ip-blue)}',
      '.cat-rem{color:var(--c-mint);font-weight:700}',
      '.cat-ca{color:var(--ip-ink-2)}',
      '.cat-rang-col{color:var(--muted);font-size:11.5px}',
      '.cat-row-n{color:var(--muted-2);font-size:11px}',
      '.cat-row.sel{background:var(--halo)}',
      /* En-têtes triables */
      '.cat-th-sort{cursor:pointer;user-select:none;white-space:nowrap;transition:color .15s}',
      '.cat-th-sort:hover{color:var(--ip-blue)}',
      '.cat-th-sort.active{color:var(--ip-blue)}',
      '.cat-th-arr{font-size:11px;margin-left:3px;opacity:.85}',
      /* Pagination — disabled natif (pas d’inline style) */
      '.cat-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-top:1px solid var(--line);flex-wrap:wrap}',
      '.cat-pg{padding:8px 14px;font-size:13px}',
      '.cat-pg[disabled]{opacity:.4;pointer-events:none}',
      '.cat-pg-info{font-size:12px;color:var(--muted)}',
      /* Performance produit */
      '.cat-perf-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin:20px 0 10px}',
      '.cat-perf-note{margin-top:12px;padding:11px 14px;background:color-mix(in srgb,var(--c-mint) 8%,#fff);border:1px solid color-mix(in srgb,var(--c-mint) 24%,transparent);border-radius:11px;font-size:12.5px;color:var(--ip-ink-2);line-height:1.5}',
      '.cat-perf-note b{font-family:var(--mono);color:var(--c-mint)}',
      /* Potentiel marché enrichi */
      '.cat-pot{margin-top:18px;padding:14px 16px;background:color-mix(in srgb,var(--ip-blue) 6%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 22%,transparent);border-radius:13px}',
      '.cat-pot.nr{background:color-mix(in srgb,var(--c-amber) 8%,#fff);border-color:color-mix(in srgb,var(--c-amber) 26%,transparent)}',
      '.cat-pot-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
      '.cat-pot-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ip-blue);font-weight:700}',
      '.cat-pot.nr .cat-pot-l{color:var(--c-amber)}',
      '.cat-pot-pct{font-family:var(--mono);font-size:16px;font-weight:700;color:var(--ip-blue)}',
      '.cat-pot-bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin:0 0 10px}',
      '.cat-pot-fill{height:100%;background:linear-gradient(90deg,var(--ip-blue),color-mix(in srgb,var(--ip-blue) 60%,#3B82F6));border-radius:5px;transition:width .5s var(--ease)}',
      '.cat-pot-row{display:flex;align-items:stretch;border:1px solid color-mix(in srgb,var(--ip-blue) 18%,transparent);border-radius:9px;overflow:hidden;background:rgba(255,255,255,.6);margin-bottom:10px}',
      '.cat-pot-stat{flex:1;padding:9px 10px;text-align:center}',
      '.cat-pot-sep{width:1px;background:color-mix(in srgb,var(--ip-blue) 14%,transparent)}',
      '.cat-pot-stat-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:4px}',
      '.cat-pot-stat-v{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.cat-pot-ecart{color:var(--c-mint)}',
      '.cat-pot-note{font-size:11.5px;color:var(--ip-ink-2);line-height:1.45;padding-top:4px}',
      '.cat-pot-txt{font-size:12px;color:var(--ip-ink-2);line-height:1.5;margin-top:8px}',
      /* Inspecteur latéral */
      '.cat-insp{position:fixed;top:0;right:0;width:372px;max-width:90vw;height:100vh;background:var(--card);border-left:1px solid var(--line);box-shadow:var(--sh-3);transform:translateX(100%);transition:transform .32s var(--ease);z-index:50;overflow-y:auto;display:flex;flex-direction:column}',
      '.cat-insp.open{transform:translateX(0)}',
      '.cat-insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.97);position:sticky;top:0}',
      '.cat-insp-name{font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.2}',
      '.cat-insp-cip{font-size:12px;color:var(--muted);margin-top:4px}',
      '.cat-insp-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0;transition:.18s var(--ease)}',
      '.cat-insp-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.cat-insp-body{padding:20px}',
      '.cat-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.cat-kpi{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}',
      '.cat-kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px}',
      '.cat-kpi-v{font-family:var(--mono);font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.cat-insp-cta{margin-top:22px}',
      '.cat-insp-cta .v2-btn{width:100%}',
      '@media(max-width:1100px){.cat-insp{width:340px}}',
      '@media(max-width:640px){.cat-insp{height:100dvh;padding-bottom:env(safe-area-inset-bottom)}}',
      // Mobile : masquer #, CIP13, CA IP, Vol Ameli, Rang → garder Produit/Famille/Prix HT/Prix IP/Remise/Vol IP lisibles sans scroller loin (la ligne reste cliquable pour le détail)
      '@media(max-width:640px){.cat-table-scroll .v2-table th:nth-child(1),.cat-table-scroll .v2-table td:nth-child(1),.cat-table-scroll .v2-table th:nth-child(3),.cat-table-scroll .v2-table td:nth-child(3),.cat-table-scroll .v2-table th:nth-child(9),.cat-table-scroll .v2-table td:nth-child(9),.cat-table-scroll .v2-table th:nth-child(10),.cat-table-scroll .v2-table td:nth-child(10),.cat-table-scroll .v2-table th:nth-child(11),.cat-table-scroll .v2-table td:nth-child(11){display:none}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── État vide actionnable ─────────────────
  function emptyState(hasSearch, hasFilter) {
    var tip = '';
    if (hasSearch && hasFilter) {
      tip = '<button class="v2-btn v2-btn-ghost" style="margin:0 8px" onclick="V2.catSearch(\'\');V2.catFilter(\'all\')">Effacer recherche et filtre</button>';
    } else if (hasSearch) {
      tip = '<button class="v2-btn v2-btn-ghost" onclick="V2.catSearch(\'\')">Effacer la recherche</button>';
    } else if (hasFilter) {
      tip = '<button class="v2-btn v2-btn-ghost" onclick="V2.catFilter(\'all\')">Voir tout le catalogue</button>';
    }
    return '<div class="cat-tablewrap"><div class="v2-empty">' +
      '<div class="v2-empty-ico">' + ICO('search', 64, 1.4) + '</div>' +
      '<div class="v2-empty-t">Aucune référence trouvée</div>' +
      '<div class="v2-empty-d">Aucun produit ne correspond' + (hasSearch ? ' à « ' + esc(S.q) + ' »' : '') + (hasFilter ? ' dans la catégorie sélectionnée' : '') + '.</div>' +
      (tip ? '<div style="margin-top:16px">' + tip + '</div>' : '') +
    '</div></div>';
  }

  // ── PAGE ─────────────────────────────
  V2.pages.catalogue = {
    render: function (root, param) {
      injectCss();
      // consommer le param de deep-link UNE fois (avant : re-forçait S.sel à chaque render → inspecteur inrefermable)
      if (param != null && param !== '' && String(param) !== String(S._lastParam)) S.sel = param;
      S._lastParam = param;

      if (!window.BENCHMARK) {
        root.innerHTML = V2.topbar({ back: true }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
        V2.loadFiles(['bench', 'sagitta']).then(function () { idxBuilt = false; V2.render(); });
        return;
      }
      buildIndex();

      var base = filteredBase();
      var c = counts(base);
      var filtered = (S.chip === 'all') ? base : base.filter(function (b) { return b._fam === S.chip; });
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (S.page >= pages) S.page = pages - 1;
      if (S.page < 0) S.page = 0;
      var pageOffset = S.page * PER_PAGE;
      var pageRows = filtered.slice(pageOffset, pageOffset + PER_PAGE);
      var nbTotal = (window.BENCHMARK || []).length;

      var chips = FAMS.map(function (f) {
        var n = c[f.k] || 0;
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.catFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + V2.fmtNum(n) + '</span></button>';
      }).join('');

      // inspecteur (lazy data pas nécessaire — détail produit = données BENCHMARK déjà là)
      var insHtml = '';
      if (S.sel != null) {
        var sb = benchByCip.get(String(S.sel));
        if (sb) insHtml = inspector(sb); else S.sel = null;
      }

      var tableHtml;
      if (!total) {
        tableHtml = emptyState(S.q.trim().length > 0, S.chip !== 'all');
      } else {
        var theadHtml =
          '<thead><tr>' +
            '<th class="num">#</th>' +
            '<th>Produit</th>' +
            '<th>CIP13</th>' +
            '<th>Famille</th>' +
            thSort('Prix HT', 'prix_ht', true) +
            thSort('Prix IP', 'prix_ip', true) +
            '<th class="num">Remise</th>' +
            thSort('Vol IP', 'ip_qty', true) +
            thSort('CA IP', 'ip_ca', true) +
            '<th class="num">Vol Ameli</th>' +
            thSort('Rang', 'rank_qty', true) +
          '</tr></thead>';
        tableHtml =
          '<div class="cat-tablewrap"><div class="cat-table-scroll"><table class="v2-table">' +
          theadHtml +
          '<tbody>' + rowsHtml(pageRows, pageOffset) + '</tbody>' +
          '</table></div>' + pager(total, pages) + '</div>';
      }

      var qVal = S.q.replace(/"/g, '&quot;');
      var clrBtn = S.q ? '<button class="clr" onclick="V2.catSearch(\'\')">' + ICO('close', 16, 2) + '</button>' : '';

      // Sous-titre dynamique selon tri actif
      var sortLabel = {
        rank_qty: 'rang volume', rank_ca: 'rang CA',
        ip_qty: 'volume décr.', ip_ca: 'CA décr.',
        prix_ip: 'prix IP', prix_ht: 'prix HT'
      };
      var sortInfo = (S.sortCol !== 'rank_qty' || S.sortDir !== 'asc')
        ? ' · Trié par ' + (sortLabel[S.sortCol] || S.sortCol) + ' (' + (S.sortDir === 'asc' ? 'croissant' : 'décroissant') + ')'
        : '';

      root.innerHTML = V2.topbar({ back: true }) +
        '<div class="v2-wrap' + (S.sel != null ? ' v2-detail-shift" style="--detw:372px"' : '"') + '>' +
          (V2.priceTabs ? V2.priceTabs('catalogue') : '') +
          '<div class="v2-page-title">Catalogue Intégral Pharma</div>' +
          '<div class="v2-page-sub">' + V2.fmtNum(nbTotal) + ' références grossiste · filtre par tranches de prix et familles AFMCODE' + esc(sortInfo) + '</div>' +
          '<div class="cat-search">' + ICO('search', 19, 2) +
            '<input id="cat-search-input" autocomplete="off" placeholder="Rechercher par CIP13 ou désignation…" value="' + qVal + '" oninput="V2.catSearch(this.value)">' + clrBtn +
          '</div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          '<div class="cat-stats-l">' + (S.chip === 'all' ? (S.q ? 'Statistiques · résultats « ' + esc(S.q) + ' »' : 'Statistiques · tout le catalogue grossiste') : 'Statistiques · ' + esc(FAM_BY_KEY[S.chip].label)) + '</div>' +
          statBand(computeAgg(filtered)) +
          '<div class="cat-count"><b style="color:var(--ip-ink);font-family:var(--mono)">' + V2.fmtNum(total) + '</b> référence' + (total > 1 ? 's' : '') + (S.chip !== 'all' ? ' · ' + esc(FAM_BY_KEY[S.chip].label) : '') + '</div>' +
          tableHtml +
        '</div>' + insHtml;
    }
  };
})();
