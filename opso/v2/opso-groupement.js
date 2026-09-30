// ═══════════════════════════════════════════════════════════════════
// OPSO Santé — Espace groupement — bloc "maquette 5" (le cap + le mois)
// Propre à OPSO (jamais chargé côté CRM JARVIS). Styles injectés une fois,
// classes préfixées og- pour ne rien casser du socle v2.css.
// Chiffres : calculés EN DIRECT depuis V2.pharmacies / V2.sales / window.PROD_STATS,
// rien en dur (brief `_travail/BRIEF-INTEGRATION.md`, 29/09/2026).
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";
  var V2 = window.V2 || (window.V2 = {});
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var fmtEUR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var fmtPct = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  function euros(n) { return fmtEUR.format(Math.round(n || 0)) + ' €'; }
  function pct1(n) { return fmtPct.format(Math.round((n || 0) * 10) / 10) + ' %'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // CIP normalisé sans zéros de tête, comme le "norm" d'applyOpsoPerimeter (v2-boot.js).
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }

  // ═══ Mouvement et finitions communs aux écrans OPSO (30/09/2026) ═══
  // Ce module est chargé sur tous les écrans OPSO : il porte donc aussi la
  // révélation au défilement, l'entrée d'écran, les compteurs et les indices de
  // défilement horizontal. Le masquage initial n'est posé que par ce script
  // (classe opso-js sur <html>) ; un bloc déjà visible n'est jamais masqué,
  // un bloc révélé n'est jamais remasqué ; sans IntersectionObserver ou avec
  // « réduire les animations », rien n'est masqué du tout.
  var UX = V2.opsoUx = V2.opsoUx || {};
  var canObs = ('IntersectionObserver' in window) && ('MutationObserver' in window);
  if (canObs && !reduceMotion) document.documentElement.classList.add('opso-js');
  var REVEAL = '.og-block,.v2-piliers .v2-pil,.opf-stat,.opf-page .v2-kpi,.opf-page .v2-card,.opf-page .opf-pod';
  var lastRouteKey = null, revealIO = null, entreeBudget = true, compteurBudget = true;

  function startCount(el) {
    var to = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(to)) return;
    var eur = el.getAttribute('data-fmt') === 'eur';
    var orig = el.textContent, t0 = null, dur = Math.min(1200, 520 + Math.log10(Math.max(to, 10)) * 95);
    function fmt(v) { return eur ? euros(v) : fmtEUR.format(Math.round(v)); }
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      if (p < 1) { el.textContent = fmt(to * e); requestAnimationFrame(step); } else el.textContent = orig;
    }
    el.textContent = fmt(0);
    requestAnimationFrame(step);
    setTimeout(function () { if (el.textContent !== orig) el.textContent = orig; }, dur + 600); // filet : onglet en arrière-plan
  }
  function revealNow(el, delay) {
    if (delay) el.style.setProperty('--d', delay + 's');
    el.classList.remove('opso-rv');
    el.classList.add('opso-in');
  }
  function getIO() {
    if (revealIO) return revealIO;
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target; revealIO.unobserve(t);
        if (t._cntPending) { t._cntPending = 0; startCount(t); } else revealNow(t, 0);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    return revealIO;
  }
  // Exécute fn une seule fois, quand el est réellement à l'écran.
  UX.whenVisible = function (el, fn) {
    if (!canObs || reduceMotion) { fn(); return; }
    var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: 0.25 });
    o.observe(el);
  };
  function bindOverflow(el) {
    if (!el._ovBound) {
      el._ovBound = true;
      var upd = function () {
        var m = el.scrollWidth - el.clientWidth;
        el.classList.toggle('ov-r', m > 4 && el.scrollLeft < m - 4);
        el.classList.toggle('ov-l', el.scrollLeft > 4);
      };
      el.addEventListener('scroll', upd, { passive: true });
      window.addEventListener('resize', upd);
      requestAnimationFrame(upd); setTimeout(upd, 500);
    }
    if (!el._ovCentered) {
      var on = el.querySelector('[aria-pressed="true"],.on');
      if (on) {
        el._ovCentered = true;
        el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
      }
    }
  }
  function enhance(root) {
    var r = V2.route || {}, key = (r.name || '') + '|' + (r.param || ''), vh = window.innerHeight || 800, i;
    var wrap = root.querySelector('.v2-wrap');
    if (key !== lastRouteKey) {
      lastRouteKey = key; entreeBudget = true; compteurBudget = true; // nouvel écran : l'entrée se rejoue une fois

      if (!reduceMotion && wrap && r.name && r.name !== 'home') wrap.classList.add('opso-enter');
    }
    var sc = root.querySelectorAll('.og-months,.og-tabs,.v2-tabs');
    for (i = 0; i < sc.length; i++) bindOverflow(sc[i]);
    if (!canObs || reduceMotion) return;
    var list = root.querySelectorAll(REVEAL), k = 0;
    for (i = 0; i < list.length; i++) {
      var el = list[i];
      if (el._opsoSeen) continue;
      el._opsoSeen = true;
      if (el.getBoundingClientRect().top < vh * 0.96) {
        // Re-rendu du même écran (saisie dans une recherche, changement d'onglet) : aucune animation rejouée.
        if (entreeBudget) revealNow(el, Math.min(k++, 6) * 0.07);
      } else { el.classList.add('opso-rv'); getIO().observe(el); }
    }
    if (k) entreeBudget = false;
    var cn = root.querySelectorAll('[data-count]'), started = false;
    for (i = 0; i < cn.length; i++) {
      var c = cn[i];
      if (c._cnt) continue;
      c._cnt = true;
      if (c.getBoundingClientRect().top < vh) { if (compteurBudget && c.textContent.trim()) { startCount(c); started = true; } }
      else { c._cntPending = 1; getIO().observe(c); }
    }
    if (started) compteurBudget = false;
  }
  function installEnhancer() {
    var root = document.getElementById('v2-root');
    if (!root) return;
    new MutationObserver(function (muts) {
      // On ignore les mutations de texte (compteurs) et celles du dessin SVG (courbe, simulation).
      for (var a = 0; a < muts.length; a++) {
        var added = muts[a].addedNodes;
        for (var b = 0; b < added.length; b++) {
          var n = added[b];
          if (n.nodeType === 1 && !(n.closest && n.closest('svg'))) { enhance(root); return; }
        }
      }
    }).observe(root, { childList: true, subtree: true });
    enhance(root);
  }
  if (canObs) {
    if (document.getElementById('v2-root')) installEnhancer();
    else document.addEventListener('DOMContentLoaded', installEnhancer);
  }

  var MOIS_ABREV = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MOIS_PLEIN = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  var CAT_LABELS = {
    pr_low: { label: 'Princeps petits prix', bornes: '≤ 4,33 €' },
    pr_mid: { label: 'Princeps intermédiaires', bornes: '4,33 – 468 €' },
    pr_high: { label: 'Princeps chers', bornes: '468 – 3 000 €' },
    tch: { label: 'Princeps très chers', bornes: '> 3 000 €' },
    gen: { label: 'Génériques', bornes: null },
    biosim: { label: 'Biosimilaires', bornes: null },
    nr: { label: 'Non remboursables', bornes: null },
    x: { label: 'Autres références', bornes: null }
  };
  var CAT_ORDER = ['pr_low', 'pr_mid', 'pr_high', 'tch', 'gen', 'biosim', 'nr', 'x'];

  function periodeLabel(moisArr) {
    if (!moisArr.length) return '';
    var first = moisArr[0], last = moisArr[moisArr.length - 1];
    if (first.y === last.y && first.m === last.m) return MOIS_ABREV[first.m - 1] + ' ' + first.y;
    // MOIS_ABREV porte déjà son point (« janv. », pas « juin. ») : pas de point ajouté ici.
    return MOIS_ABREV[first.m - 1] + '–' + MOIS_ABREV[last.m - 1] + ' ' + last.y;
  }

  // ── Calcul des données depuis V2.pharmacies / V2.sales / window.PROD_STATS ──
  function computeData() {
    var pharmacies = V2.pharmacies || [];
    var sales = V2.sales || [];
    var adherentes = pharmacies.length;

    // Lignes injectées par applyOpsoPerimeter (repérées par l'absence de clé
    // "commercial", voir isInjected plus bas) : des
    // "stats officine" réparties à parts égales sur tous les mois pour les
    // officines absentes des ventes WML. Elles sont de vrais achats (comptées
    // dans le total, les catégories, les produits) mais leur date mensuelle
    // exacte est reconstituée — elles ne doivent pas gonfler artificiellement
    // le nombre de "pharmacies actives" d'un mois donné (une officine ainsi
    // injectée apparaîtrait active dès le premier mois suivi, uniformément).
    var injectedCount = 0, injectedAmount = 0;
    var byMonth = {}; var monthKeys = [];
    sales.forEach(function (s) {
      if (!s.year || !s.month) return;
      // Repère fiable : les lignes injectées par applyOpsoPerimeter n'ont PAS de
      // clé "commercial" (id/importId valent null aussi bien sur ces lignes que
      // sur TOUTES les ventes WML une fois décodées dans V2.loadData — id/importId
      // ne distinguent donc rien ici).
      var isInjected = (typeof s.commercial === 'undefined');
      if (isInjected) { injectedCount++; injectedAmount += (s.mntNetHt || 0); }
      var k = s.year * 12 + s.month;
      if (!byMonth[k]) { byMonth[k] = { year: s.year, month: s.month, ca: 0, lignes: 0, boites: 0, pharmaSetReel: {} }; monthKeys.push(k); }
      var mo = byMonth[k];
      mo.ca += (s.mntNetHt || 0);
      mo.lignes += 1;
      mo.boites += (s.qte || 0);
      if (!isInjected && (s.mntNetHt || 0) > 0) mo.pharmaSetReel[s.pharmacyId] = 1;
    });
    monthKeys.sort(function (a, b) { return a - b; });
    var moisArr = monthKeys.map(function (k) {
      var mo = byMonth[k];
      var nbActives = Object.keys(mo.pharmaSetReel).length;
      return {
        y: mo.year, m: mo.month, ca: mo.ca, lignes: mo.lignes, boites: Math.round(mo.boites),
        pharmaActives: nbActives,
        // moyenne calculée sur le montant total du mois (avoirs + injecté compris)
        // rapporté aux pharmacies réellement actives ce mois-là (voir note ci-dessus) :
        // approximation assumée et mesurée dans le rapport quand des lignes injectées existent.
        moyenne: nbActives ? mo.ca / nbActives : 0
      };
    });

    var total = moisArr.reduce(function (s, mo) { return s + mo.ca; }, 0);
    var lignesAvoirs = 0, montantAvoirs = 0;
    sales.forEach(function (s) { if ((s.mntNetHt || 0) < 0) { lignesAvoirs++; montantAvoirs += s.mntNetHt; } });

    var totalByPharma = {};
    sales.forEach(function (s) { totalByPharma[s.pharmacyId] = (totalByPharma[s.pharmacyId] || 0) + (s.mntNetHt || 0); });
    var pharmaClientes = Object.keys(totalByPharma).filter(function (id) { return totalByPharma[id] > 0; }).length;

    var lastKey = monthKeys.length ? monthKeys[monthKeys.length - 1] : null;
    var nextAbrev = null;
    if (lastKey != null) {
      var lastM = byMonth[lastKey].month;
      var nm = lastM === 12 ? 1 : lastM + 1;
      nextAbrev = MOIS_ABREV[nm - 1];
    }

    // ── Produits : regroupés par artCode, classés par NB DE PHARMACIES ──
    var byProduct = {};
    sales.forEach(function (s) {
      if (!s.artCode) return;
      if (!byProduct[s.artCode]) byProduct[s.artCode] = { d: s.artDesignation || '', ca: 0, boites: 0, pharmaSet: {} };
      var p = byProduct[s.artCode];
      if (s.artDesignation) p.d = s.artDesignation;
      p.ca += (s.mntNetHt || 0);
      p.boites += (s.qte || 0);
      if ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0) p.pharmaSet[s.pharmacyId] = 1;
    });

    var PS = (window.PROD_STATS && window.PROD_STATS.length) ? window.PROD_STATS : null;
    var prodIndex = null;
    if (PS) { prodIndex = {}; PS.forEach(function (r) { var c = normCip(r.c); if (c && !prodIndex[c]) prodIndex[c] = r; }); }

    var benchIndex = null;
    function nomBench(code) {
      var B = window.BENCHMARK;
      if (!B || !B.length) return '';
      if (!benchIndex) { benchIndex = {}; B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !benchIndex[c]) benchIndex[c] = r.designation || ''; }); }
      return benchIndex[normCip(code)] || '';
    }

    var byCat = {};
    CAT_ORDER.forEach(function (k) { byCat[k] = { k: k, label: CAT_LABELS[k].label, bornes: CAT_LABELS[k].bornes, ca: 0, boites: 0, refs: 0, items: [] }; });
    var allItems = [];
    Object.keys(byProduct).forEach(function (code) {
      var p = byProduct[code];
      var n = Object.keys(p.pharmaSet).length;
      if (!n) return; // aucune pharmacie active dessus (ligne à 0) : on l'ignore
      // Les ventes WML décodées n'ont que le CIP (artDesignation vide) : le nom
      // vient du catalogue (PROD_STATS, puis BENCHMARK), sinon le CIP lui-même.
      var nomInfo = prodIndex && prodIndex[normCip(code)];
      var item = { d: p.d || (nomInfo && nomInfo.d) || nomBench(code) || ('CIP ' + code), n: n, boites: Math.round(p.boites), ca: p.ca };
      allItems.push(item);
      if (prodIndex) {
        var info = prodIndex[normCip(code)];
        var cat = 'x';
        if (info && byCat[info.f]) {
          cat = info.f;
          if (cat === 'pr_high' && info.ppht > 3000) cat = 'tch';
        }
        byCat[cat].ca += p.ca; byCat[cat].boites += p.boites; byCat[cat].refs += 1;
        byCat[cat].items.push(item);
      }
    });
    allItems.sort(function (a, b) { return b.n - a.n || b.ca - a.ca; });
    var top20 = allItems.slice(0, 10);

    var categories = null;
    if (prodIndex) {
      CAT_ORDER.forEach(function (k) {
        byCat[k].items.sort(function (a, b) { return b.n - a.n || b.ca - a.ca; });
        byCat[k].top = byCat[k].items.slice(0, 10);
        delete byCat[k].items;
      });
      categories = CAT_ORDER.map(function (k) { return byCat[k]; }).filter(function (c) { return c.refs > 0; });
    }

    return {
      adherentes: adherentes, pharmaClientes: pharmaClientes, total: total,
      lignesAvoirs: lignesAvoirs, montantAvoirs: montantAvoirs,
      injectedCount: injectedCount, injectedAmount: injectedAmount,
      mois: moisArr, nextAbrev: nextAbrev,
      categories: categories, top20: top20, refsVendues: allItems.length,
      periode: periodeLabel(moisArr)
    };
  }

  // ── Styles (injectés une fois) ──
  var CSS = ""
    + ".og-wrap{margin:0 0 var(--sp-7,32px) 0}"
    + ".og-block{margin-bottom:var(--sp-4,16px)}"
    + ".og-block-title{font-family:'Varela Round',var(--font,system-ui),sans-serif;font-weight:400;font-size:1.0625rem;color:var(--ip-ink,#10131C);margin:0 0 4px}"
    + ".og-block-sub{font-size:.8125rem;color:var(--muted,#646B80);margin:0 0 12px}"
    + ".og-num{font-variant-numeric:tabular-nums}"
    // Le cap
    + ".og-hero{display:flex;flex-direction:column;gap:18px;align-items:center;text-align:center}"
    + "@media(min-width:720px){.og-hero{flex-direction:row;text-align:left;align-items:center;gap:32px}}"
    + ".og-ring-box{position:relative;width:168px;height:168px;flex:none}"
    + ".og-ring-box svg{width:100%;height:100%;display:block}"
    + ".og-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}"
    + ".og-ring-center .og-frac{font-size:1.85rem;color:var(--ip-ink,#10131C);font-family:'Varela Round',sans-serif}"
    + ".og-ring-center .og-frac small{font-size:1rem;color:var(--muted,#646B80);font-family:var(--font,system-ui),sans-serif}"
    + ".og-ring-center .og-lbl{font-size:.8125rem;color:var(--muted,#646B80);max-width:150px;margin-top:2px}"
    + ".og-hero-stats{display:flex;flex-direction:column;gap:10px;width:100%}"
    + ".og-pill{display:inline-flex;align-items:center;gap:6px;background:var(--halo,#E6F7EC);color:var(--ip-blue-d,#0d8530);border-radius:999px;padding:5px 12px;font-size:.8125rem;align-self:center}"
    + "@media(min-width:720px){.og-pill{align-self:flex-start}}"
    + ".og-pill .og-dot{width:7px;height:7px;border-radius:50%;background:var(--ip-blue,#11a63c)}"
    + ".og-cumul{background:var(--surf-sunken,#F4F6FB);border-radius:var(--r-md,14px);padding:16px 18px;display:flex;flex-direction:column;gap:2px}"
    + ".og-cumul .og-amount{font-size:1.8rem;color:var(--ip-blue-d,#0d8530);font-family:'Varela Round',sans-serif}"
    + ".og-cumul .og-period{font-size:.8125rem;color:var(--muted,#646B80)}"
    // Le mois
    + ".og-months{display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}"
    + ".og-months::-webkit-scrollbar{display:none}"
    + ".og-month-pill{flex:0 0 auto;border:none;background:var(--surf-sunken,#F4F6FB);color:var(--ip-ink-2,#2A2F3C);font:inherit;font-size:.8125rem;padding:10px 16px;border-radius:999px;cursor:pointer;min-height:44px;white-space:nowrap;transition:background .18s ease,color .18s ease}"
    + ".og-month-pill:hover{background:var(--card-2,#E9ECF4)}"
    + ".og-month-pill[aria-pressed=true]{background:var(--ip-blue,#11a63c);color:#fff}"
    + ".og-month-pill[disabled]{background:transparent;color:#AFB4C2;cursor:default}"
    + ".og-mois-inner{transition:opacity .22s ease,transform .22s ease}"
    + ".og-mois-inner.is-changing{opacity:.35;transform:translateY(6px)}"
    + ".og-mois-lead{font-size:.9375rem;color:var(--ip-ink-2,#2A2F3C);margin:12px 0 0}"
    + ".og-mois-lead b{font-weight:600;color:var(--ip-ink,#10131C)}"
    + ".og-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line,#E3E7F0);border:1px solid var(--line,#E3E7F0);border-radius:var(--r-md,14px);overflow:hidden;margin-top:10px}"
    + "@media(min-width:640px){.og-facts{grid-template-columns:repeat(4,1fr)}}"
    + ".og-fact{background:var(--card,#fff);padding:12px}"
    + ".og-fact .og-flabel{display:block;font-size:.8125rem;color:var(--muted,#646B80);margin-bottom:6px;line-height:1.3}"
    + ".og-fact .og-fnum{display:block;font-family:'Varela Round';font-size:1.1rem;color:var(--ip-ink,#10131C)}"
    + ".og-fact .og-fdelta{display:block;margin-top:4px;font-size:.8125rem;color:var(--muted,#646B80)}"
    + ".og-fact .og-fdelta.up{color:var(--ip-blue-d,#0F7A52)}"
    + ".og-provenance{font-size:.8125rem;color:var(--muted,#646B80);margin-top:10px}"
    // Produits
    + ".og-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-bottom:2px}"
    + ".og-tabs::-webkit-scrollbar{display:none}"
    + ".og-tab{flex:0 0 auto;border:none;background:var(--surf-sunken,#F4F6FB);color:var(--ip-ink-2,#2A2F3C);font:inherit;font-size:.8125rem;padding:9px 14px;border-radius:999px;cursor:pointer;min-height:44px;white-space:nowrap;transition:background .18s ease,color .18s ease}"
    + ".og-tab:hover{background:var(--card-2,#E9ECF4)}"
    + ".og-tab[aria-pressed=true]{background:var(--ip-blue,#11a63c);color:#fff}"
    + ".og-bornes{font-size:.8125rem;color:var(--muted,#646B80);margin:6px 0 10px}"
    + ".og-recap{font-size:.8125rem;color:var(--muted,#646B80);margin:2px 0 0}"
    + ".og-phead{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:baseline;background:var(--surf-sunken,#F4F6FB);border-radius:var(--r-md,14px);padding:12px 14px;margin-bottom:10px}"
    + ".og-phead .og-pamount{font-family:'Varela Round';font-size:1.15rem;color:var(--ip-blue-d,#0d8530)}"
    + ".og-phead .og-pmeta{font-size:.8125rem;color:var(--muted,#646B80)}"
    + ".og-list{list-style:none;margin:0;padding:0;transition:opacity .22s ease,transform .22s ease}"
    + ".og-list.is-changing{opacity:.35;transform:translateY(6px)}"
    + ".og-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid var(--surf-sunken,#F4F6FB)}"
    + ".og-row:first-child{border-top:none}"
    + ".og-rank{flex:0 0 20px;font-family:'Varela Round';font-size:.8125rem;color:var(--muted,#646B80);padding-top:2px}"
    + ".og-main{flex:1 1 auto;min-width:0}"
    + ".og-pname{font-size:.8125rem;color:var(--ip-ink-2,#2A2F3C);line-height:1.3}"
    + ".og-gauge-row{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}"
    + ".og-gauge{flex:0 1 130px;height:5px;background:var(--surf-sunken,#F4F6FB);border-radius:999px;overflow:hidden}"
    + ".og-gauge-fill{height:100%;background:var(--ip-blue,#11a63c);border-radius:999px}"
    + ".og-pnb{font-size:.8125rem;color:var(--muted,#646B80);white-space:nowrap}"
    + ".og-right{flex:0 0 auto;text-align:right;padding-top:1px}"
    + ".og-boites{display:block;font-size:.8125rem;color:var(--muted,#646B80);white-space:nowrap}"
    + ".og-pamount2{display:block;font-size:.875rem;color:var(--ip-ink,#10131C);font-family:'Varela Round';margin-top:2px;white-space:nowrap}"
    // Trajectoire
    + ".og-traj-wrap{width:100%;overflow:hidden}"
    + ".og-chart{width:100%;height:200px;display:block}"
    + "@media(min-width:720px){.og-chart{height:280px}}"
    + ".og-legend{display:flex;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:14px;margin-top:8px;font-size:.8125rem;color:var(--muted,#646B80)}"
    + ".og-legend::-webkit-scrollbar{display:none}"
    + ".og-legend .og-litem{display:flex;align-items:center;gap:6px;flex:0 0 auto;white-space:nowrap}"
    + ".og-legend .og-swatch{width:16px;height:3px;border-radius:2px;display:inline-block}"
    + ".og-legend .og-swatch.full{background:var(--ip-blue-d,#0d8530)}"
    + ".og-legend .og-swatch.dash{background:repeating-linear-gradient(90deg,var(--muted,#8a91a3) 0 5px,transparent 5px 9px)}"
    + ".og-legend .og-swatch.dash2{background:repeating-linear-gradient(90deg,var(--ip-blue,#11a63c) 0 5px,transparent 5px 9px)}"
    + ".og-sept{font-size:.8125rem;color:#9A5B12;margin-top:6px}"
    + ".og-sim{margin-top:14px;background:var(--surf-sunken,#F4F6FB);border-radius:var(--r-md,14px);padding:14px 16px}"
    + ".og-sim-label{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}"
    + ".og-sim-label span:first-child{font-size:.9375rem;color:var(--ip-ink-2,#2A2F3C)}"
    + ".og-sim-value{font-size:1.05rem;color:var(--ip-blue-d,#0d8530);font-family:'Varela Round',sans-serif}"
    + ".og-sim input[type=range]{width:100%;margin:14px 0 6px;accent-color:var(--ip-blue,#11a63c);height:28px}"
    + ".og-sim-hint{font-size:.8125rem;color:var(--muted,#646B80);margin:0}"
    + ".og-sim-detail{margin-top:10px}"
    + ".og-sim-detail summary{font-size:.8125rem;color:var(--muted,#646B80);cursor:pointer;min-height:44px;display:flex;align-items:center;text-decoration:underline;text-underline-offset:2px}"
    + "@media(prefers-reduced-motion:reduce){.og-wrap *{transition:none!important;animation:none!important}}"
  ;

  function injectStyle() {
    if (document.getElementById('og-style')) return;
    var st = document.createElement('style'); st.id = 'og-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ── Rendu HTML (structure statique, contenus dynamiques posés par mount()) ──
  function html() {
    injectStyle();
    return '<div class="og-wrap og-skel">'
      + '<div class="v2-card og-block og-hero-card">'
        + '<div class="og-hero">'
          + '<div class="og-ring-box">'
            + '<svg viewBox="0 0 200 200" role="img" aria-label="Adhérentes qui achètent chez Intégral Pharma" id="og-ring-svg">'
              + '<defs><linearGradient id="og-ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#43d068"/><stop offset="100%" stop-color="#0d8530"/></linearGradient></defs>'
              + '<circle cx="100" cy="100" r="93" fill="none" stroke="rgba(17,166,60,.22)" stroke-width="1.5" stroke-dasharray="1.5 6" stroke-linecap="round"/>'
              + '<circle cx="100" cy="100" r="80" fill="none" stroke="var(--surf-sunken,#EEF2EF)" stroke-width="16"/>'
              + '<circle id="og-ring-progress" cx="100" cy="100" r="80" fill="none" stroke="url(#og-ring-g)" stroke-width="16" stroke-linecap="round" transform="rotate(-90 100 100)"/>'
            + '</svg>'
            + '<div class="og-ring-center"><span class="og-frac og-num" id="og-ring-frac"></span><span class="og-lbl">adhérentes achètent chez Intégral Pharma</span></div>'
          + '</div>'
          + '<div class="og-hero-stats">'
            + '<span class="og-pill" id="og-pill-periode"><span class="og-dot"></span></span>'
            + '<div class="og-cumul"><span class="og-amount og-num" id="og-hero-amount"></span><span class="og-period">Cumul HT, achats des adhérentes chez Intégral Pharma — groupe de grossistes-répartiteurs.</span></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="v2-card og-block">'
        + '<h2 class="og-block-title">Le mois</h2>'
        + '<p class="og-block-sub">Choisissez un mois pour voir son détail.</p>'
        + '<nav class="og-months" id="og-months" aria-label="Choisir le mois"></nav>'
        + '<div class="og-mois-inner" id="og-mois-inner">'
          + '<p class="og-mois-lead" id="og-mois-lead"></p>'
          + '<div class="og-facts">'
            + '<div class="og-fact"><span class="og-flabel">Montant du mois</span><span class="og-fnum og-num" id="og-mf-montant"></span></div>'
            + '<div class="og-fact"><span class="og-flabel">Écart avec le mois précédent</span><span class="og-fnum og-num" id="og-mf-ecart"></span><span class="og-fdelta" id="og-mf-ecart-txt"></span></div>'
            + '<div class="og-fact"><span class="og-flabel">Pharmacies actives</span><span class="og-fnum og-num" id="og-mf-actives"></span></div>'
            + '<div class="og-fact"><span class="og-flabel">Montant moyen par pharmacie active</span><span class="og-fnum og-num" id="og-mf-moyenne"></span></div>'
          + '</div>'
        + '</div>'
        + '<p class="og-provenance" id="og-provenance"></p>'
      + '</div>'
      // Emplacement du bloc « suivi de la rémunération » (rendu par opso-remuneration.js) : sans style tant qu'il est vide.
      + '<div data-opso-slot="remuneration"></div>'
      + '<div class="v2-card og-block">'
        + '<h2 class="og-block-title">Ce que les adhérentes achètent</h2>'
        + '<p class="og-block-sub">Classement par nombre de pharmacies qui commandent chaque référence, en euros HT.</p>'
        + '<div class="og-tabs" id="og-tabs" role="tablist" aria-label="Choisir une catégorie de produits"></div>'
        + '<p class="og-bornes" id="og-bornes"></p>'
        + '<div class="og-phead"><span class="og-pamount og-num" id="og-ph-amount"></span><span class="og-pmeta og-num" id="og-ph-meta"></span></div>'
        + '<ul class="og-list" id="og-prod-list"></ul>'
        + '<p class="og-recap og-num" id="og-prod-recap"></p>'
      + '</div>'
      + '<div class="v2-card og-block">'
        + '<h2 class="og-block-title">La trajectoire</h2>'
        + '<p class="og-block-sub" id="og-traj-sub">Cumul mensuel des achats des adhérentes chez Intégral Pharma.</p>'
        + '<div class="og-traj-wrap"><svg class="og-chart" id="og-traj-svg" viewBox="0 0 720 340" role="img" aria-label="Courbe du cumul mensuel et prolongement hypothétique"></svg></div>'
        + '<p class="og-sept" id="og-sept-note"></p>'
        + '<div class="og-legend">'
          + '<span class="og-litem"><span class="og-swatch full"></span>Réalisé</span>'
          + '<span class="og-litem"><span class="og-swatch dash"></span>Au rythme actuel — hypothèse, pas un engagement</span>'
          + '<span class="og-litem"><span class="og-swatch dash2"></span>Simulation avec adhérentes en plus</span>'
        + '</div>'
        + '<div class="og-sim is-rest" id="og-sim">'
          + '<label for="og-sim-range"><div class="og-sim-label"><span id="og-sim-q">Simulez l\'arrivée d\'adhérentes supplémentaires chez Intégral</span><span class="og-sim-value og-num" id="og-sim-value">Déplacez le curseur</span></div></label>'
          + '<input type="range" id="og-sim-range" min="0" max="20" step="1" value="0" aria-label="Nombre d\'adhérentes supplémentaires simulées">'
          + '<div class="og-sim-presets" role="group" aria-label="Préréglages"><button type="button" data-n="0">Aucune</button><button type="button" data-n="5">+ 5</button><button type="button" data-n="10">+ 10</button><button type="button" data-n="20">+ 20</button></div>'
          + '<details class="og-sim-detail"><summary>Comment c\'est calculé ?</summary>'
            + '<p class="og-sim-hint">Simulation fondée sur la moyenne actuelle : chaque adhérente ajoutée apporte, chaque mois, le montant moyen déjà observé par cliente.</p>'
            + '<p class="og-sim-hint og-num" id="og-sim-basis"></p>'
          + '</details>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  // ── Montage : câblage JS sur le DOM inséré par html() ──
  function mount(root) {
    var scope = root || document;
    var pollTimer = null;

    function byId(id) { return scope.querySelector('#' + id); }

    function render() {
      var DATA = computeData();
      if (!DATA.mois.length) return; // ventes pas encore chargées : on attend le prochain V2.render()
      var wrapEl = scope.querySelector ? scope.querySelector('.og-wrap') : null;
      if (wrapEl) wrapEl.classList.remove('og-skel');

      // ---- Le cap ----
      var ring = byId('og-ring-progress');
      var radius = 80, circumference = 2 * Math.PI * radius;
      var fraction = DATA.adherentes ? (DATA.pharmaClientes / DATA.adherentes) : 0;
      ring.style.strokeDasharray = circumference.toFixed(2);
      byId('og-ring-svg').setAttribute('aria-label', DATA.pharmaClientes + ' adhérentes sur ' + DATA.adherentes + ' achètent chez Intégral Pharma');
      var fracEl = byId('og-ring-frac'), fracKey = DATA.pharmaClientes + '/' + DATA.adherentes;
      if (fracEl._k !== fracKey) { // pas de nouveau compteur si le même chiffre est re-rendu
        fracEl._k = fracKey;
        fracEl.innerHTML = '<span data-count="' + DATA.pharmaClientes + '">' + DATA.pharmaClientes + '</span><small>/' + DATA.adherentes + '</small>';
      }
      var amtEl = byId('og-hero-amount');
      amtEl.textContent = euros(DATA.total);
      amtEl.setAttribute('data-count', Math.round(DATA.total)); amtEl.setAttribute('data-fmt', 'eur');
      byId('og-pill-periode').innerHTML = '<span class="og-dot"></span>' + esc(cap1(DATA.periode));
      if (reduceMotion) {
        ring.style.strokeDashoffset = (circumference * (1 - fraction)).toFixed(2);
      } else {
        ring.style.strokeDashoffset = circumference.toFixed(2);
        ring.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)';
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          ring.style.strokeDashoffset = (circumference * (1 - fraction)).toFixed(2);
        }); });
      }

      // ---- Le mois ----
      var monthsNav = byId('og-months');
      monthsNav.innerHTML = '';
      var monthPills = [];
      DATA.mois.forEach(function (mo, i) {
        var b = document.createElement('button');
        b.className = 'og-month-pill'; b.type = 'button';
        b.textContent = MOIS_ABREV[mo.m - 1];
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { selectMonth(i); });
        monthsNav.appendChild(b); monthPills.push(b);
      });
      if (DATA.nextAbrev) {
        var septPill = document.createElement('button');
        septPill.className = 'og-month-pill'; septPill.type = 'button';
        septPill.textContent = DATA.nextAbrev + ' — en attente';
        septPill.disabled = true;
        monthsNav.appendChild(septPill);
      }

      var moisInner = byId('og-mois-inner'), moisLead = byId('og-mois-lead');
      var mfMontant = byId('og-mf-montant'), mfEcart = byId('og-mf-ecart'), mfEcartTxt = byId('og-mf-ecart-txt');
      var mfActives = byId('og-mf-actives'), mfMoyenne = byId('og-mf-moyenne');
      var currentMonth = null;

      function renderMonth(i) {
        var mo = DATA.mois[i];
        moisLead.innerHTML = 'En ' + MOIS_PLEIN[mo.m - 1] + ', les adhérentes ont acheté <b>' + euros(mo.ca) + '</b> chez Intégral Pharma.';
        mfMontant.textContent = euros(mo.ca);
        if (i === 0) {
          mfEcart.textContent = '—';
          mfEcartTxt.textContent = 'Premier mois du suivi';
          mfEcartTxt.className = 'og-fdelta';
        } else {
          var prev = DATA.mois[i - 1];
          var diff = mo.ca - prev.ca;
          var diffPct = prev.ca ? (diff / prev.ca) * 100 : 0;
          var sign = diff >= 0 ? '+ ' : '− ';
          mfEcart.textContent = sign + pct1(Math.abs(diffPct));
          mfEcartTxt.textContent = 'par rapport à ' + MOIS_PLEIN[prev.m - 1];
          mfEcartTxt.className = 'og-fdelta ' + (diff >= 0 ? 'up' : 'dn');
        }
        mfActives.textContent = mo.pharmaActives;
        mfMoyenne.textContent = euros(mo.moyenne);
        monthPills.forEach(function (p, k) { p.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
        currentMonth = i;
      }
      function selectMonth(i) {
        if (i === currentMonth) return;
        if (reduceMotion) { renderMonth(i); return; }
        moisInner.classList.add('is-changing');
        setTimeout(function () { renderMonth(i); moisInner.classList.remove('is-changing'); }, 200);
      }
      renderMonth(DATA.mois.length - 1);

      byId('og-provenance').textContent = 'Ventes Intégral Pharma aux ' + DATA.pharmaClientes + ' adhérentes clientes, ' + DATA.periode
        + ', avoirs déduits (' + DATA.lignesAvoirs + ' ligne' + (DATA.lignesAvoirs > 1 ? 's' : '') + ').'
        + (DATA.nextAbrev ? ' ' + cap1(DATA.nextAbrev) + ' en attente.' : '');

      // ---- Produits ----
      var tabsDef = [{ k: 'all', label: 'Tous', bornes: null, ca: DATA.total, refs: DATA.refsVendues, top: DATA.top20 }];
      if (DATA.categories) {
        DATA.categories.forEach(function (c) { tabsDef.push({ k: c.k, label: c.label, bornes: c.bornes, ca: c.ca, refs: c.refs, top: c.top }); });
      }
      var prodTabsEl = byId('og-tabs'), prodBornesEl = byId('og-bornes'), phAmountEl = byId('og-ph-amount'),
          phMetaEl = byId('og-ph-meta'), prodListEl = byId('og-prod-list'), prodRecapEl = byId('og-prod-recap');
      prodTabsEl.innerHTML = '';
      var tabButtons = [];
      tabsDef.forEach(function (t, i) {
        var b = document.createElement('button');
        b.className = 'og-tab'; b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-pressed', 'false');
        b.textContent = t.label;
        b.addEventListener('click', function () { selectTab(i); });
        prodTabsEl.appendChild(b); tabButtons.push(b);
      });
      var currentTab = null;
      function renderTab(i) {
        var t = tabsDef[i];
        prodBornesEl.textContent = t.bornes ? ('Tranche : ' + t.bornes) : '';
        phAmountEl.textContent = euros(t.ca);
        var partPct = DATA.total ? (t.ca / DATA.total) * 100 : 0;
        phMetaEl.textContent = pct1(partPct) + ' du total · ' + t.refs + ' référence' + (t.refs > 1 ? 's' : '') + ' vendue' + (t.refs > 1 ? 's' : '');
        prodListEl.innerHTML = '';
        (t.top || []).slice(0, 10).forEach(function (p, idx) {
          var li = document.createElement('li'); li.className = 'og-row';
          var gaugePct = DATA.pharmaClientes ? Math.min(100, Math.round((p.n / DATA.pharmaClientes) * 100)) : 0;
          li.innerHTML =
            '<span class="og-rank og-num">' + (idx + 1) + '</span>'
            + '<div class="og-main"><div class="og-pname">' + esc(p.d) + '</div>'
              + '<div class="og-gauge-row"><span class="og-gauge"><span class="og-gauge-fill" style="width:' + gaugePct + '%;--i:' + idx + '"></span></span>'
              + '<span class="og-pnb og-num">' + p.n + ' pharmacie' + (p.n > 1 ? 's' : '') + ' sur ' + DATA.pharmaClientes + '</span></div></div>'
            + '<div class="og-right"><span class="og-boites og-num">' + fmtEUR.format(p.boites) + ' boîtes</span><span class="og-pamount2 og-num">' + euros(p.ca) + '</span></div>';
          prodListEl.appendChild(li);
        });
        tabButtons.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
        currentTab = i;
      }
      function selectTab(i) {
        if (i === currentTab) return;
        if (reduceMotion) { renderTab(i); return; }
        prodListEl.classList.add('is-changing');
        setTimeout(function () { renderTab(i); prodListEl.classList.remove('is-changing'); }, 180);
      }
      renderTab(0);

      if (DATA.categories) {
        var sumCategories = DATA.categories.reduce(function (s, c) { return s + c.ca; }, 0);
        console.assert(Math.abs(sumCategories - DATA.total) < 1, 'OPSO groupement : somme des catégories ≠ total (écart ' + (sumCategories - DATA.total) + ' €)');
        prodRecapEl.textContent = DATA.categories.length + ' catégories · total ' + euros(DATA.total) + ' HT';
      } else {
        prodRecapEl.textContent = '';
        // PROD_STATS pas encore en mémoire : re-tente le classement par tranche
        // toutes les 700 ms (10 essais max), sans erreur ni zéro affiché entre-temps.
        var tries = 0;
        clearTimeout(pollTimer);
        (function poll() {
          if (!scope.isConnected && scope !== document) return;
          tries++;
          if (window.PROD_STATS && window.PROD_STATS.length) { render(); return; }
          if (tries < 12) pollTimer = setTimeout(poll, 700);
        })();
      }

      // ---- Trajectoire ----
      renderTrajectoire(DATA);
    }

    function cap1(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    // ── Trajectoire : cumul réalisé + prolongement calendaire + simulation ──
    var yMaxAnimated = null, chartAnimFrame = null, currentN = 0, DATA_REF = null;

    function renderTrajectoire(DATA) {
      DATA_REF = DATA;
      var mois = DATA.mois;
      var nReal = mois.length;
      if (!nReal) return;
      var firstMonthIdx = mois[0].m - 1; // 0-based
      var nSlots = 12 - firstMonthIdx;   // du premier mois suivi à décembre de la même année
      var monthly = mois.map(function (mo) { return mo.ca; });
      var cumulReal = [];
      monthly.reduce(function (acc, v, i) { var s = acc + v; cumulReal[i] = s; return s; }, 0);

      var avgMonthly = nReal ? DATA.total / nReal : 0;
      var cumulBase = cumulReal.slice();
      for (var m = nReal; m < nSlots; m++) cumulBase[m] = cumulBase[m - 1] + avgMonthly;

      var perAdherentPerMonth = (DATA.pharmaClientes && nReal) ? (DATA.total / DATA.pharmaClientes / nReal) : 0;
      var basisEl = byId('og-sim-basis');
      if (basisEl) basisEl.textContent = euros(DATA.total) + ' ÷ ' + DATA.pharmaClientes + ' ÷ ' + nReal + ' = ' + euros(perAdherentPerMonth) + ' en moyenne par adhérente cliente et par mois (calculé).';
      var sub = byId('og-traj-sub'); if (sub) sub.textContent = 'Cumul mensuel des achats des adhérentes chez Intégral Pharma, ' + DATA.periode + '.';
      var septNote = byId('og-sept-note');
      if (septNote) septNote.textContent = DATA.nextAbrev ? (cap1(DATA.nextAbrev) + ' : données en attente — non incluses dans le cumul.') : '';

      function cumulSim(n) {
        var arr = cumulBase.slice(0, nReal);
        for (var m2 = nReal; m2 < nSlots; m2++) {
          var monthsAhead = m2 - (nReal - 1);
          arr[m2] = cumulBase[m2] + n * perAdherentPerMonth * monthsAhead;
        }
        return arr;
      }

      var svgNS = 'http://www.w3.org/2000/svg';
      var chart = byId('og-traj-svg');
      function el(tag, attrs) { var e = document.createElementNS(svgNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
      // Courbe lissée sans dépassement : chaque tangente est bornée entre les deux ordonnées voisines.
      function smoothPath(pts) {
        if (pts.length < 3) return pathFromPoints(pts);
        var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
        for (var q = 0; q < pts.length - 1; q++) {
          var p0 = pts[q - 1] || pts[q], p1 = pts[q], p2 = pts[q + 1], p3 = pts[q + 2] || p2;
          var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
          var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
          var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
          c1y = Math.min(hi, Math.max(lo, c1y)); c2y = Math.min(hi, Math.max(lo, c2y));
          d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
        }
        return d;
      }
      function pathFromPoints(pts) { return pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
      function fmtK(v) { var k = Math.round(v / 1000); return String(k).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' k€'; }
      function niceStep(rough) { if (rough <= 0) return 100000; var exp = Math.floor(Math.log10(rough)); var mag = Math.pow(10, exp); var frac = rough / mag; var nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10; return nf * mag; }
      function calcTicks(n) {
        var arrBase = cumulSim(0), arrSim = cumulSim(n);
        var allVals = arrBase.slice(); if (n > 0) allVals = allVals.concat(arrSim);
        var rawMax = Math.max.apply(null, allVals.length ? allVals : [0]);
        var step = niceStep(rawMax / 3);
        var yMax = Math.ceil(rawMax / step) * step; if (yMax <= 0) yMax = step;
        var ticks = []; for (var t = 0; t <= yMax + 1; t += step) ticks.push(t);
        return { yMax: yMax, ticks: ticks };
      }

      function drawChart(n, target, yMaxForScale) {
        var rect = chart.getBoundingClientRect();
        var W = Math.max(280, Math.round(rect.width)), H = Math.round(rect.height) || 200;
        var arrBase = cumulSim(0), arrSim = cumulSim(n);
        var yTicks = target.ticks;
        var maxLabelLen = Math.max.apply(null, yTicks.map(function (t) { return fmtK(t).length; }).concat([1]));
        var padL = Math.max(52, 20 + maxLabelLen * 8), padR = 14, padT = 16, padB = 30;
        var drawW = W - padL - padR, drawH = H - padT - padB;
        var denom = Math.max(1, nSlots - 1);
        function xAt(i) { return padL + i * (drawW / denom); }
        function yAt(v) { return padT + (1 - (yMaxForScale ? v / yMaxForScale : 0)) * drawH; }
        while (chart.firstChild) chart.removeChild(chart.firstChild);
        chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        var defs = el('defs', {});
        var grad = el('linearGradient', { id: 'og-aire', x1: '0', y1: '0', x2: '0', y2: '1' });
        grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#11a63c', 'stop-opacity': '0.32' }));
        grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#11a63c', 'stop-opacity': '0' }));
        defs.appendChild(grad); chart.appendChild(defs);
        yTicks.forEach(function (t) {
          var y = yAt(t);
          chart.appendChild(el('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: '#EEF1F7', 'stroke-width': 1 }));
          var txt = el('text', { x: padL - 10, y: y + 4, 'text-anchor': 'end', 'font-size': 13, fill: '#646B80' });
          txt.textContent = fmtK(t); chart.appendChild(txt);
        });
        var slotW = drawW / denom, showEveryOther = slotW < 34;
        for (var i = 0; i < nSlots; i++) {
          if (showEveryOther && i % 2 !== 1) continue;
          var mIdx = (firstMonthIdx + i) % 12;
          var txt2 = el('text', { x: xAt(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 13, fill: '#646B80' });
          txt2.textContent = MOIS_ABREV[mIdx].replace('.', '').slice(0, 1).toUpperCase() + MOIS_ABREV[mIdx].slice(1);
          chart.appendChild(txt2);
        }
        var realPts = []; for (var ri = 0; ri < nReal; ri++) realPts.push([xAt(ri), yAt(arrBase[ri])]);
        if (realPts.length) {
          var areaD = smoothPath(realPts) + ' L' + realPts[realPts.length - 1][0].toFixed(1) + ',' + yAt(0).toFixed(1) + ' L' + realPts[0][0].toFixed(1) + ',' + yAt(0).toFixed(1) + ' Z';
          chart.appendChild(el('path', { d: areaD, fill: 'url(#og-aire)', stroke: 'none', 'class': 'og-aire' }));
          chart.appendChild(el('path', { d: smoothPath(realPts), fill: 'none', stroke: '#0d8530', 'stroke-width': 3.5, pathLength: 1, 'class': 'og-line' }));
          realPts.forEach(function (p, pi) {
            var last = pi === realPts.length - 1;
            if (last) chart.appendChild(el('circle', { cx: p[0], cy: p[1], r: 9, fill: 'rgba(17,166,60,.16)', 'class': 'og-pt' }));
            chart.appendChild(el('circle', { cx: p[0], cy: p[1], r: last ? 5 : 3.5, fill: '#fff', stroke: '#0d8530', 'stroke-width': 2.2, 'class': 'og-pt' }));
          });
        }
        if (nSlots > nReal) {
          var basePts = []; for (var bi = nReal - 1; bi < nSlots; bi++) basePts.push([xAt(bi), yAt(arrBase[bi])]);
          chart.appendChild(el('path', { d: pathFromPoints(basePts), fill: 'none', stroke: '#8a91a3', 'stroke-width': 2, 'stroke-dasharray': '5 5', 'class': 'og-pt' }));
          if (n > 0) {
            var simPts = []; for (var si = nReal - 1; si < nSlots; si++) simPts.push([xAt(si), yAt(arrSim[si])]);
            chart.appendChild(el('path', { d: pathFromPoints(simPts), fill: 'none', stroke: '#11a63c', 'stroke-width': 2.5, 'stroke-dasharray': '5 5', 'class': 'og-pt' }));
            var lastSim = simPts[simPts.length - 1];
            chart.appendChild(el('circle', { cx: lastSim[0], cy: lastSim[1], r: 3.5, fill: '#11a63c' }));
          }
          var lastBase = basePts[basePts.length - 1];
          chart.appendChild(el('circle', { cx: lastBase[0], cy: lastBase[1], r: 3.5, fill: '#8a91a3' }));
        }
      }

      function renderChart(n) {
        var target = calcTicks(n);
        if (!chart._ogDrawn) { // 1er dessin : la courbe attend d'être à l'écran, puis se trace
          chart._ogDrawn = true;
          chart.classList.add('og-pre');
          UX.whenVisible(chart, function () {
            chart.classList.remove('og-pre'); chart.classList.add('og-go');
            setTimeout(function () { chart.classList.remove('og-go'); }, 2000);
          });
        }
        if (yMaxAnimated === null || reduceMotion) { yMaxAnimated = target.yMax; drawChart(n, target, yMaxAnimated); return; }
        var start = yMaxAnimated, end = target.yMax;
        if (chartAnimFrame) { cancelAnimationFrame(chartAnimFrame); chartAnimFrame = null; }
        if (start === end) { drawChart(n, target, end); return; }
        var startTime = null, duration = 280;
        function step(ts) {
          if (startTime === null) startTime = ts;
          var p = Math.min(1, (ts - startTime) / duration);
          var eased = 1 - Math.pow(1 - p, 3);
          yMaxAnimated = start + (end - start) * eased;
          drawChart(n, target, yMaxAnimated);
          if (p < 1) chartAnimFrame = requestAnimationFrame(step); else chartAnimFrame = null;
        }
        chartAnimFrame = requestAnimationFrame(step);
      }

      var range = byId('og-sim-range'), simQ = byId('og-sim-q'), simValue = byId('og-sim-value'), simBox = byId('og-sim');
      function updateSim() {
        currentN = parseInt(range.value, 10);
        range.style.setProperty('--p', (currentN / (parseInt(range.max, 10) || 20) * 100) + '%');
        if (!currentN) {
          // Au repos : une invite, pas un « + 0 € » sans intérêt.
          simQ.textContent = 'Simulez l\'arrivée d\'adhérentes supplémentaires chez Intégral';
          simValue.textContent = 'Déplacez le curseur';
          if (simBox) simBox.classList.add('is-rest');
        } else {
          var arrBase = cumulSim(0), arrSim = cumulSim(currentN);
          var deltaEnd = arrSim[nSlots - 1] - arrBase[nSlots - 1];
          simQ.innerHTML = 'Et si <strong id="og-sim-n">' + currentN + '</strong> adhérente' + (currentN > 1 ? 's' : '') + ' de plus achetaient chez Intégral ?';
          simValue.textContent = '+ ' + fmtEUR.format(Math.round(deltaEnd)) + ' € en ' + MOIS_PLEIN[(firstMonthIdx + nSlots - 1) % 12] + ' (hypothèse)';
          if (simBox) simBox.classList.remove('is-rest');
        }
        renderChart(currentN);
      }
      if (range && !range._ogBound) {
        range._ogBound = true; range.addEventListener('input', updateSim);
        Array.prototype.forEach.call(scope.querySelectorAll('.og-sim-presets button'), function (b) {
          b.addEventListener('click', function () { range.value = b.getAttribute('data-n'); updateSim(); });
        });
      }
      yMaxAnimated = null;
      if (range) range.value = 0;
      updateSim();

      if (!chart._ogResizeBound) {
        chart._ogResizeBound = true;
        var resizeTimer = null;
        window.addEventListener('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () { if (DATA_REF) { var t = calcTicks(currentN); yMaxAnimated = t.yMax; drawChart(currentN, t, yMaxAnimated); } }, 120);
        });
      }
    }

    render();
  }

  V2.opsoGroupement = { html: html, mount: mount, computeData: computeData };
})();
