/* ═══════════════════════════════════════════════════════════════════
   COPILOTE — le cerveau du copilote pharmacien (onglet global).
   Socle : croise les FEEDS de données (chaque source = 1 feed, robot → fichier
   → app), lus de façon unifiée via V2.market / V2.zone / V2.reco.
   Page : surface unique qui incarne le projet global — aujourd'hui le MARCHÉ
   France (feed #1, Medic'AM), croisé à TES ventes réseau. Les feeds suivants
   (ruptures, potentiel de zone) viendront s'y brancher sans casser l'écran.
   100% client, hors-ligne, zéro dépendance.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};

  // ── SOCLE · axe PRODUIT · marché France (indicatif) ──
  V2.market = function (cip) {
    var A = window.AMELI_AVG;
    if (!A || !A.data) return null;
    var v = A.data[String(cip)];
    if (v == null) return null;
    return { avgYear: v, avgMonth: Math.round(v / 12 * 10) / 10, meta: A.meta };
  };
  V2.marketMeta = function () { return (window.AMELI_AVG && window.AMELI_AVG.meta) || null; };
  // ── SOCLE · feed #2 · ruptures/tensions ANSM (par CIP13) ──
  V2.rupture = function (cip) {
    var R = window.RUPTURES;
    if (!R || !R.data) return null;
    return R.data[String(cip)] || null;   // { d: DCI, dt: date signalement } ou null
  };
  // ── SOCLE · feed #3 · potentiel de zone (par officine) ──
  V2.zone = function (pid) {
    var Z = window.ZONE;
    if (!Z || !Z.data) return null;
    return Z.data[String(pid)] || null;   // { c: commune, cc, dep, pop } ou null
  };
  // ── SOCLE · stock Intégral disponible par CIP13 (tous établissements confondus) ──
  V2.stock = function (cip) { var S = window.STOCK_IP; return (S && S.data && S.data[String(cip)]) || 0; };
  // ── SOCLE · feed #5 · tendance marché (croissance YoY %) par CIP13 ──
  V2.tendance = function (cip) { var T = window.TENDANCE; if (!T || !T.data) return null; var v = T.data[String(cip)]; return v == null ? null : v; };
  // ── SOCLE · momentum/accélération (%/mois récent, pente Medic'AM) par CIP13 ──
  V2.momentum = function (cip) { var M = window.MOMENTUM; if (!M || !M.data) return null; var v = M.data[String(cip)]; return v == null ? null : v; };
  // ── SOCLE · feed #6 · nouveautés (AMM récente, BDPM) par CIP13 ──
  V2.nouveaute = function (cip) { var N = window.NOUVEAUTES; if (!N || !N.data) return null; return N.data[String(cip)] || null; };
  V2.reco = V2.reco || function () { return null; };   // feed à venir

  // ── helpers ──
  function esc(s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ICO = window.ICO || function () { return ''; };
  function num(n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); }
  function eur(n) { return V2.fmtEur ? V2.fmtEur(n) : (Math.round(n) + ' €'); }
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function PS() { return window.PROD_STATS || []; }
  // Règles Will : uniquement des PRINCEPS (pas de génériques/NR/biosim) + seulement
  // ce qu'Intégral a en stock (tous établissements confondus).
  function isPr(f) { return f === 'pr_low' || f === 'pr_mid' || f === 'pr_high'; }
  function stk(cip) { return V2.stock ? V2.stock(cip) : 0; }
  function eligible(r) { return isPr(r.f) && stk(r.c) > 0; }
  function stockCell(cip) { var s = stk(cip); return '<td class="num mono co-stk">' + (s > 0 ? num(s) : '—') + '</td>'; }
  function growthBadge(cip) {
    var g = V2.tendance ? V2.tendance(cip) : null;
    if (g == null) return '';
    if (g >= 8) return '<span class="co-grow up">↑ +' + g + '%</span>';
    if (g <= -8) return '<span class="co-grow dn">↓ ' + g + '%</span>';
    return '';
  }
  function newBadge(cip) { return (V2.nouveaute && V2.nouveaute(cip)) ? '<span class="co-new">Nouveau</span>' : ''; }

  var FAM = { pr_low: 'Petits prix', pr_mid: 'Interméd.', pr_high: 'Chers', nr: 'NR', gen: 'Génér.', biosim: 'Biosim.' };

  function totalPharma() {
    var s = {};
    (V2.sales || []).forEach(function (x) { if (x.qte > 0) s[String(x.pharmacyId)] = 1; });
    var n = Object.keys(s).length;
    return n || (V2.pharmacies || []).length || 1;
  }
  function orderedCips(pid) {
    var s = {};
    (V2.sales || []).forEach(function (x) { if (String(x.pharmacyId) === String(pid) && x.qte > 0) s[String(x.artCode)] = 1; });
    return s;
  }
  function netCell(r) {
    var showAb = r.f !== 'gen' && r.rpct > 0;
    return '<td class="num mono co-net">' + (r.net > 0 ? eur(r.net) : '—') + '</td>' +
      '<td class="num">' + (showAb ? '<span class="co-ab">−' + String(r.rpct).replace('.', ',') + '%</span>' : '<span class="co-dash">—</span>') + '</td>';
  }

  // gros marchés France sous-exploités par TON réseau (marché France élevé × faible pénétration)
  function bigMarkets(limit) {
    var tot = totalPharma(), out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      var m = V2.market(r.c); if (!m) return;
      var pen = Math.min(1, (r.n || 0) / tot);
      out.push({ r: r, fr: m.avgYear, pen: pen, opp: m.avgYear * (1 - pen) });
    });
    out.sort(function (a, b) { return b.opp - a.opp; });
    return out.slice(0, limit || 20);
  }
  // MARCHÉS EN CROISSANCE (vraie croissance YoY, hors reprises après rupture) sous-exploités
  function growingMarkets(limit) {
    var tot = totalPharma(), out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      if (V2.rupture && V2.rupture(r.c)) return;                 // exclut le bruit rupture-recovery
      var g = V2.tendance ? V2.tendance(r.c) : null;
      if (g == null || g < 12 || g > 250) return;                // vraie croissance
      var m = V2.market(r.c); if (!m || m.avgYear < 80) return;   // marché significatif
      out.push({ r: r, fr: m.avgYear, g: g });
    });
    out.sort(function (a, b) { return b.g - a.g; });
    return out.slice(0, limit || 12);
  }
  // ACCÉLÉRATIONS : produits dont les ventes France accélèrent le plus récemment (%/mois)
  function acceleratingList(limit) {
    var out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      if (V2.rupture && V2.rupture(r.c)) return;                 // exclut le bruit rupture-recovery
      var m = V2.momentum ? V2.momentum(r.c) : null;
      if (m == null || m < 12) return;                           // forte accélération récente
      // PAS de filtre sur le volume marché : les produits qui décollent sont
      // souvent encore petits par pharmacie — c'est justement ce qu'on veut attraper tôt.
      var mk = V2.market(r.c);
      out.push({ r: r, fr: mk ? mk.avgYear : 0, m: m, g: V2.tendance ? V2.tendance(r.c) : null });
    });
    out.sort(function (a, b) { return b.m - a.m; });
    return out.slice(0, limit || 12);
  }
  // NOUVEAUTÉS : produits d'AMM récente (BDPM) éligibles (princeps en stock)
  function nouveautesList(limit) {
    var out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      var n = V2.nouveaute ? V2.nouveaute(r.c) : null;
      if (!n) return;
      var m = V2.market(r.c);
      out.push({ r: r, nv: n, fr: m ? m.avgYear : 0, g: V2.tendance ? V2.tendance(r.c) : null });
    });
    // priorité aux nouveautés qui bougent déjà (volume France), puis aux plus récentes
    out.sort(function (a, b) { return (b.fr - a.fr) || (b.nv.amm || '').localeCompare(a.nv.amm || ''); });
    return out.slice(0, limit || 12);
  }
  // TOP OPPORTUNITÉS DU JOUR — score unifié qui fusionne tous les signaux par produit
  // (accélération %/mois + croissance YoY + gros marché France + tension ANSM + nouveauté),
  // parmi les princeps EN STOCK. Les produits qui cumulent le plus de signaux ressortent.
  function topOpportunities(limit) {
    var out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;                                  // princeps en stock uniquement
      var mk = V2.market(r.c), fr = mk ? mk.avgYear : 0;
      var mom = V2.momentum ? V2.momentum(r.c) : null;           // pente récente %/mois
      var ten = V2.tendance ? V2.tendance(r.c) : null;           // croissance sur un an %
      var rup = V2.rupture ? V2.rupture(r.c) : null;             // tension/rupture ANSM
      var nv = V2.nouveaute ? V2.nouveaute(r.c) : null;          // AMM récente
      var sc = 0, tags = [];
      if (mom != null && mom >= 12) { sc += Math.min(mom, 60) * 1.4; tags.push({ k: 'accel', v: mom }); }
      if (ten != null && ten >= 12 && ten <= 250) { sc += Math.min(ten, 120) * 0.6; tags.push({ k: 'grow', v: ten }); }
      if (fr > 0) sc += Math.min(fr, 400) * 0.10;                // levier = taille du marché France
      if (rup) { sc += 40; tags.push({ k: 'tension' }); }        // vente à sécuriser
      if (nv) { sc += 25; tags.push({ k: 'new', v: nv.amm }); }
      if (!tags.length || sc <= 0) return;                       // au moins un signal fort
      out.push({ r: r, fr: fr, s: stk(r.c), mom: mom, ten: ten, rup: rup, nv: nv, sc: sc, tags: tags });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return out.slice(0, limit || 8);
  }

  // par officine : gros marchés France qu'elle ne commande pas (= ce qu'elle laisse passer)
  function officineGaps(pid, limit) {
    var owned = orderedCips(pid), out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      if (owned[String(r.c)]) return;
      var m = V2.market(r.c); if (!m || m.avgYear < 12) return;
      out.push({ r: r, fr: m.avgYear });
    });
    out.sort(function (a, b) { return b.fr - a.fr; });
    return out.slice(0, limit || 25);
  }

  // ── INTELLIGENCE DE TOURNÉE (croisement produit × officine × zone) ──
  var _topCips = null;
  function topMarketCips(n) {
    if (_topCips) return _topCips;
    var arr = [];
    PS().forEach(function (r) { if (!eligible(r)) return; var m = V2.market(r.c); if (m) arr.push({ c: String(r.c), fr: m.avgYear }); });
    arr.sort(function (a, b) { return b.fr - a.fr; });
    _topCips = arr.slice(0, n || 150).map(function (x) { return x.c; });
    return _topCips;
  }
  // pour chaque officine : nb de gros marchés France non commandés (= à gagner) + zone
  function tournee(dep) {
    var top = topMarketCips(150);
    var out = [];
    (V2.pharmacies || []).forEach(function (p) {
      var z = V2.zone ? V2.zone(p.id) : null;
      if (dep && (!z || z.dep !== dep)) return;
      var owned = orderedCips(p.id);
      var miss = 0;
      for (var i = 0; i < top.length; i++) { if (!owned[top[i]]) miss++; }
      if (miss <= 0) return;
      var pop = z ? z.pop : 0;
      out.push({ p: p, miss: miss, z: z, score: miss * 1000 + Math.min(400, pop / 1000) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function tourneeDeps() {
    var d = {};
    (V2.pharmacies || []).forEach(function (p) { var z = V2.zone ? V2.zone(p.id) : null; if (z && z.dep) d[z.dep] = (d[z.dep] || 0) + 1; });
    return Object.keys(d).sort();
  }
  var selDep = '';
  V2.copiloteSelDep = function (d) { selDep = d; if (V2.render) V2.render(); };

  // produits que le réseau commande ET en tension ANSM (à anticiper / alternative molécule)
  function reseauRuptures(limit) {
    if (!window.RUPTURES) return [];
    var out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      var rp = V2.rupture(r.c);
      if (rp && (r.n || 0) > 0) out.push({ r: r, rp: rp });
    });
    out.sort(function (a, b) { return (b.r.n || 0) - (a.r.n || 0); });
    return out.slice(0, limit || 15);
  }
  var selPid = null;
  function pharmaOptions() {
    var phs = (V2.pharmacies || []).slice();
    // tri par CA décroissant (proxy activité) pour un défaut pertinent
    var caOf = {};
    (V2.sales || []).forEach(function (s) { caOf[String(s.pharmacyId)] = (caOf[String(s.pharmacyId)] || 0) + (s.mntNetHt || 0); });
    phs.sort(function (a, b) { return (caOf[String(b.id)] || 0) - (caOf[String(a.id)] || 0); });
    return phs;
  }
  V2.copiloteSelPharma = function (id) { selPid = id; if (V2.render) V2.render(); };

  // ════ EXPORT « FICHE DE VISITE » (2 destinataires × 2 formats) ════
  // mode 'client' = à laisser au pharmacien → PPHT + net remisé, JAMAIS l'abandon de marge.
  // mode 'interne' = ma prépa → tout (abandon, marge pharmacien, stock), « ne pas laisser au client ».
  function visiteName() {
    var phs = pharmaOptions();
    for (var i = 0; i < phs.length; i++) if (String(phs[i].id) === String(selPid)) return phs[i].name;
    return 'Officine';
  }
  function visiteRows() {
    if (!selPid) return [];
    return officineGaps(selPid, 20).map(function (o) {
      var r = o.r;
      return { d: r.d, cip: r.c, ppht: r.ppht || 0, net: r.net || 0, ab: (r.f !== 'gen' && r.rpct > 0) ? r.rpct : 0, fr: o.fr, stk: stk(r.c) };
    });
  }
  function visiteText(mode) {
    var rows = visiteRows(); if (!rows.length) return '';
    var isInt = mode === 'interne', L = [];
    var d = ''; try { d = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) {}
    L.push('Fiche de visite — ' + visiteName());
    L.push(d + (isInt ? ' · USAGE INTERNE — ne pas laisser au client' : ''));
    L.push('', 'Produits à proposer (marché France que l\'officine ne commande pas encore) :');
    rows.forEach(function (x) {
      var s = '- ' + cap(x.d);
      if (x.net > 0) s += ' — ' + eur(x.net).replace(/ /g, ' ') + ' net';
      if (isInt && x.ab > 0) s += ' (abandon ' + String(x.ab).replace('.', ',') + '%)';
      if (x.fr >= 10) s += ' · ~' + num(x.fr) + '/an France';
      if (isInt) s += ' · stock ' + num(x.stk);
      L.push(s);
    });
    L.push('', 'Intégral Pharma');
    return L.join('\n');
  }
  function visiteHtml(mode) {
    var rows = visiteRows(), isInt = mode === 'interne';
    var dateStr = ''; try { dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) {}
    function e2(v) { return (v ? (+v).toFixed(2).replace('.', ',') + ' €' : '—'); }
    var cols = isInt
      ? ['#', 'Produit', 'CIP', 'PPHT', 'Net remisé', 'Abandon', 'Stock', '~/an France']
      : ['#', 'Produit', 'CIP', 'PPHT', 'Net remisé', '~/an France'];
    var trs = rows.map(function (x, i) {
      var tds = '<td style="padding:6px 9px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
        '<td style="padding:6px 9px;font-size:10.5px;font-weight:600;color:#10131C">' + esc(cap(x.d)) + '</td>' +
        '<td style="padding:6px 9px;font-family:monospace;font-size:9px;color:#737A8C">' + esc(x.cip) + '</td>' +
        '<td style="padding:6px 9px;text-align:right;font-family:monospace;font-size:9.5px;color:#737A8C">' + e2(x.ppht) + '</td>' +
        '<td style="padding:6px 9px;text-align:right;font-family:monospace;font-size:11px;font-weight:800;color:#0050E6">' + e2(x.net) + '</td>' +
        (isInt ? '<td style="padding:6px 9px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:700;color:#1E9E6A">' + (x.ab > 0 ? '−' + String(x.ab).replace('.', ',') + '%' : '—') + '</td>' : '') +
        (isInt ? '<td style="padding:6px 9px;text-align:right;font-family:monospace;font-size:9.5px;color:#10131C">' + num(x.stk) + '</td>' : '') +
        '<td style="padding:6px 9px;text-align:right;font-family:monospace;font-size:9.5px;color:#10131C">~' + num(x.fr) + '</td>';
      return '<tr style="border-bottom:1px solid #EEF1F6">' + tds + '</tr>';
    }).join('');
    return '<div style="width:794px;box-sizing:border-box;padding:34px 40px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C;background:#fff">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #10131C;padding-bottom:12px;margin-bottom:6px">' +
        '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px">IP</div>' +
        '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma</div>' +
          '<div style="font-size:20px;font-weight:800;letter-spacing:-.02em">Fiche de visite — ' + esc(visiteName()) + '</div></div>' +
        '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + esc(dateStr) + '</div>' +
      '</div>' +
      (isInt ? '<div style="margin:10px 0;padding:7px 11px;background:#FFF1E8;border:1px solid #F6C9A8;border-radius:8px;font-size:10px;font-weight:800;color:#C2410C;text-transform:uppercase;letter-spacing:.04em">Usage interne — ne pas laisser au client</div>' : '') +
      '<p style="font-size:11px;color:#737A8C;margin:10px 0 12px">Produits que le marché France consomme et que cette officine ne commande pas encore — tes arguments pour la visite.</p>' +
      '<table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr style="background:#F7F9FC">' +
        cols.map(function (h, k) { return '<th style="padding:6px 9px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;text-align:' + (k === 1 || k === 2 ? 'left' : 'right') + '">' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (trs || '<tr><td colspan="' + cols.length + '" style="padding:20px;text-align:center;color:#9AA1B2">Cette officine commande déjà les gros marchés France.</td></tr>') + '</tbody></table>' +
      '<div style="margin-top:16px;padding-top:8px;border-top:1px solid #E5E9F2;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">Intégral Pharma · Marché France Ameli indicatif · princeps en stock Intégral' + (isInt ? ' · document interne' : ' · prix nets HT indicatifs') + '</div>' +
    '</div>';
  }
  V2.copiloteVisite = function (mode, fmt) {
    if (!selPid) { if (V2.toast) V2.toast('Choisis d\'abord une officine'); return; }
    if (fmt === 'copy') {
      var txt = visiteText(mode); if (!txt) { if (V2.toast) V2.toast('Rien à exporter pour cette officine'); return; }
      var ok = function () { if (V2.toast) V2.toast('Fiche copiée ✅'); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { copyFallback(txt); ok(); }); else { copyFallback(txt); ok(); } }
      catch (e) { copyFallback(txt); ok(); }
      return;
    }
    // PDF
    if (!window.ensureHtml2Pdf) { if (V2.toast) V2.toast('Module PDF indisponible'); return; }
    if (V2.toast) V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      var node = document.createElement('div');
      node.style.cssText = 'position:fixed;left:-10000px;top:0';
      node.innerHTML = visiteHtml(mode);
      document.body.appendChild(node);
      var fname = 'Fiche-visite-' + (mode === 'interne' ? 'prepa-' : '') + visiteName().replace(/[^\w-]+/g, '_').slice(0, 40) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().set({
        margin: 0, filename: fname, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
      }).from(node.firstChild).save().then(function () {
        if (node.parentNode) node.parentNode.removeChild(node); if (V2.toast) V2.toast('PDF téléchargé');
      }).catch(function () { if (node.parentNode) node.parentNode.removeChild(node); if (V2.toast) V2.toast('Échec du PDF', 'error'); });
    }).catch(function () { if (V2.toast) V2.toast('Impossible de charger le module PDF', 'error'); });
  };
  function copyFallback(txt) { try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {} }

  // ── styles (mobile-first : cartes, chips, cibles 44px) ──
  function injectCss() {
    if (document.getElementById('v2-copilote-css')) return;
    var st = document.createElement('style'); st.id = 'v2-copilote-css';
    st.textContent = [
      /* héro calme */
      '.co-maplink{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding:15px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--ip-blue) 8%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--ip-blue) 22%,var(--line));border-radius:var(--r-card);box-shadow:var(--sh-1);cursor:pointer;text-decoration:none;color:inherit;transition:transform .16s var(--ease),box-shadow .16s var(--ease)}',
      '.co-maplink:hover{transform:translateY(-2px);box-shadow:var(--sh-2)}',
      '.co-maplink-ic{width:44px;height:44px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--ip-blue),#0034A0)}',
      '.co-maplink-txt{flex:1;min-width:0}',
      '.co-maplink-t{display:block;font-weight:800;font-size:15px;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.co-maplink-s{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.4}',
      '.co-maplink-go{display:inline-flex;align-items:center;gap:3px;flex:none;font-weight:700;font-size:13px;color:var(--ip-blue)}',
      '.co-hero{position:relative;margin-bottom:20px}',
      '.co-hero h1{font-size:clamp(24px,4.6vw,34px);font-weight:800;letter-spacing:-.025em;margin:0 0 6px}',
      '.co-hero h1 .ac{color:var(--ip-blue)}',
      '.co-hero p{color:var(--muted);font-size:15px;line-height:1.5;margin:0;max-width:58ch}',
      /* capteurs actifs — bande discrète */
      '.co-feeds{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}',
      '.co-feed{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font-size:11.5px;font-weight:600;color:var(--muted-2)}',
      '.co-feed .d{width:6px;height:6px;border-radius:50%;background:var(--muted-2);flex:none}',
      '.co-feed.on{color:var(--muted)}',
      '.co-feed.on .d{background:var(--c-opp)}',
      '.co-feed.on.warn .d{background:var(--c-amber)}',
      '.co-feed.on.info .d{background:var(--ip-blue)}',
      /* sections */
      '.co-sec{margin-top:28px}',
      '.co-sec-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}',
      '.co-sec-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.co-pill{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 9%,var(--card));padding:3px 9px;border-radius:var(--r-pill)}',
      '.co-sub{color:var(--muted);font-size:13.5px;line-height:1.5;margin:0 0 14px;max-width:70ch}',
      '.co-sub b{color:var(--ip-ink)}',
      /* chips secteur (filtre département) */
      '.co-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}',
      '.co-chip{min-height:44px;padding:0 16px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1);transition:border-color .2s var(--ease-soft),color .2s var(--ease-soft)}',
      '.co-chip:hover{border-color:color-mix(in srgb,var(--ip-blue) 32%,var(--line));color:var(--ip-ink)}',
      '.co-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      /* cartes officines — la tournée */
      '.co-tour{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:var(--gap-grid,14px)}',
      '.co-pcard{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:9px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:16px;box-shadow:var(--sh-1);cursor:pointer;font:inherit;color:var(--ip-ink);min-height:44px;transition:transform .22s var(--ease),box-shadow .22s var(--ease-soft),border-color .22s var(--ease-soft)}',
      '.co-pcard:hover{transform:translateY(var(--mo-lift,-3px));box-shadow:var(--sh-2)}',
      '.co-pcard.sel{border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 13%,transparent),var(--sh-2)}',
      '.co-pcard .nm{font-weight:800;font-size:15.5px;line-height:1.3;letter-spacing:-.01em}',
      '.co-pcard .loc{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--muted);font-size:12.5px}',
      '.co-pcard .loc svg{color:var(--ip-blue);flex:none}',
      '.co-pcard .loc b{font-family:var(--mono);font-weight:700;color:var(--ip-ink-2)}',
      '.co-push{display:flex;align-items:baseline;gap:7px;margin-top:auto;padding-top:4px}',
      '.co-push b{font-family:var(--mono);font-size:26px;font-weight:800;color:var(--ip-blue);line-height:1;font-variant-numeric:tabular-nums}',
      '.co-push span{font-size:12.5px;font-weight:600;color:var(--muted)}',
      '.co-warnchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--c-amber-txt,#9A5B12);background:#FBF1E2;border:1px solid #F0E2C6;padding:3px 9px;border-radius:var(--r-pill);width:max-content;max-width:100%}',
      '.co-warnchip svg{flex:none}',
      '.co-go{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:var(--ip-blue)}',
      '.co-go svg{transition:transform .2s var(--ease)}',
      '.co-pcard:hover .co-go svg{transform:translateX(3px)}',
      /* focus officine — prépare ta visite */
      '#co-focus{scroll-margin-top:calc(var(--topbar-h,60px) + 12px)}',
      '.co-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;box-shadow:var(--sh-1)}',
      '.co-fhead{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.co-fhead .fn{min-width:0;flex:1 1 220px}',
      '.co-fhead h3{font-size:17px;font-weight:800;letter-spacing:-.015em;margin:0 0 3px}',
      '.co-fzone{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--muted);font-size:13px}',
      '.co-fzone svg{color:var(--ip-blue)}.co-fzone b{font-family:var(--mono);font-weight:800;color:var(--ip-ink-2)}',
      '.co-facts{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
      '.co-lab{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}',
      '.co-select{font:inherit;font-size:14px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-btn,12px);padding:10px 12px;min-height:44px;max-width:100%;cursor:pointer}',
      '.co-facts .v2-btn{min-height:44px}',
      // barre « Fiche de visite »
      '.co-visite{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 16px 14px;padding:12px 14px;background:var(--card-2);border:1px solid var(--line);border-radius:12px}',
      '.co-visite-l{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-right:2px}',
      '.co-visite-l svg{color:var(--ip-blue)}',
      '.co-visite-grp{display:inline-flex;align-items:center;gap:7px;padding:5px 8px;border:1px solid var(--line);border-radius:10px;background:var(--card)}',
      '.co-visite-t{font-size:12px;font-weight:700;color:var(--ip-ink)}',
      '.co-visite-t small{color:var(--muted);font-weight:600}',
      '.co-visite-int{border-color:color-mix(in srgb,#C2410C 30%,var(--line))}',
      '.co-visite-int .co-visite-t{color:#C2410C}',
      '.co-vbtn{border:1px solid var(--line-strong);background:var(--card);border-radius:8px;padding:5px 11px;font:inherit;font-size:12px;font-weight:700;color:var(--ip-ink);cursor:pointer;min-height:32px}',
      '.co-vbtn:hover{border-color:var(--ip-blue);color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 7%,var(--card))}',
      /* petites cartes argument produit */
      '.co-args{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:16px}',
      '.co-arg{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:var(--r-md,14px);background:var(--card);padding:14px;box-shadow:var(--sh-1)}',
      '.co-arg .t{font-weight:800;font-size:14.5px;line-height:1.3;color:var(--ip-ink)}',
      '.co-arg .t .psh{display:block;color:var(--muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}',
      '.co-arg .s{font-size:13px;color:var(--muted);line-height:1.55;margin:0}',
      '.co-arg .s b{font-family:var(--mono);color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.co-arg .s b.stk{color:var(--c-opp)}',
      '.co-arg .s b.up{color:#0F7A52}',
      '.co-grow{display:inline-block;font-family:var(--mono);font-weight:800;font-size:11px;padding:1px 7px;border-radius:var(--r-pill,999px);margin-left:7px;vertical-align:middle;white-space:nowrap}',
      '.co-grow.up{color:#0F7A52;background:#E3F3EB}.co-grow.dn{color:#C7283D;background:#FBECEE}.co-grow.big{font-size:12.5px}',
      '.co-arg .psh.up{color:#0F7A52}',
      '.co-grow-card{border-color:color-mix(in srgb,#0F7A52 26%,var(--line))}',
      '.co-pill-up{color:#0F7A52 !important;background:#E3F3EB !important}',
      '.co-accel{display:inline-block;font-family:var(--mono);font-weight:800;font-size:11px;padding:1px 7px;border-radius:var(--r-pill,999px);margin-left:7px;vertical-align:middle;white-space:nowrap;color:#C2410C;background:#FFEDD5}',
      '.co-accel.big{font-size:12.5px}',
      '.co-accel-card{border-color:color-mix(in srgb,#EA580C 30%,var(--line))}',
      '.co-arg .psh.ac{color:#C2410C}',
      '.co-arg b.ac{color:#C2410C}',
      // ── Top opportunités du jour ──
      '.co-arg .s b.te,.co-arg b.te{color:#E0556E}',
      '.co-top-card{border-color:color-mix(in srgb,var(--ip-blue) 30%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 5%,var(--card)),var(--card));box-shadow:0 2px 10px color-mix(in srgb,var(--ip-blue) 8%,transparent)}',
      '.co-arg .psh.top{color:var(--ip-blue)}',
      '.co-tbadges{display:flex;flex-wrap:wrap;gap:6px}',
      '.co-tb{font-size:10.5px;font-weight:800;letter-spacing:.01em;padding:3px 8px;border-radius:999px;white-space:nowrap;line-height:1.3}',
      '.co-tb.ac{background:#FFF1E8;color:#C2410C}',
      '.co-tb.up{background:#E9F8F0;color:#0F7A52}',
      '.co-tb.te{background:#FDECEF;color:#C02640}',
      '.co-tb.nw{background:#EAF0FF;color:#0050E6}',
      '.co-pill-top{background:var(--ip-blue);color:#fff}',
      '.co-spark-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}',
      '.co-spark-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-2,#9AA1B2)}',
      '.co-spark{display:block;flex:none}',
      '@media(prefers-color-scheme:dark){.co-tb.ac{background:rgba(194,65,12,.18)}.co-tb.up{background:rgba(15,122,82,.2)}.co-tb.te{background:rgba(192,38,64,.2)}.co-tb.nw{background:rgba(0,80,230,.2)}}',
      '.co-pill-accel{color:#C2410C !important;background:#FFEDD5 !important}',
      '.co-new{display:inline-block;font-family:var(--mono);font-weight:800;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#7A3E00;background:#FFE9CC;padding:1px 7px;border-radius:var(--r-pill,999px);margin-left:7px;vertical-align:middle;white-space:nowrap}',
      '.co-new-card{border-color:color-mix(in srgb,#E08A00 30%,var(--line))}',
      '.co-new-card .psh.nw{color:#B5670A}',
      '.co-pill-new{color:#B5670A !important;background:#FFE9CC !important}',
      '.co-prix{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:auto;padding-top:4px}',
      '.co-net{font-family:var(--mono);font-weight:800;font-size:15px;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
      '.co-ab{font-size:11.5px;font-weight:700;color:var(--c-mint-txt,#0F7A52);background:color-mix(in srgb,var(--c-opp) 12%,var(--card));padding:2px 8px;border-radius:var(--r-pill)}',
      '.co-arg .v2-btn{min-height:44px;justify-content:center}',
      /* alerte « à sécuriser » */
      '.co-secu{margin:0 16px 16px;border:1px solid #F0E2C6;background:#FDF7EC;border-radius:var(--r-md,14px);padding:12px 14px}',
      '.co-secu h4{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--c-amber-txt,#9A5B12);margin:0 0 4px}',
      '.co-secu h4 svg{flex:none}',
      '.co-secu-r{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 0;border-top:1px solid #F0E2C6;font-size:13px}',
      '.co-secu-r:first-of-type{border-top:none}',
      '.co-secu-r .p{font-weight:700;color:var(--ip-ink)}',
      '.co-secu-r .m{color:var(--muted);font-size:12px}',
      /* saisonnalité — bande légère */
      '.co-saison{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px}',
      '.co-sais-i{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2)}',
      '.co-sais-up{font-family:var(--mono);font-weight:800;color:var(--c-opp);font-size:12.5px}',
      '.co-sais-l{font-size:13px;font-weight:600;color:var(--ip-ink)}',
      /* vue marché — repliée, secondaire */
      '.co-det{border:1px solid var(--line);border-radius:var(--r-card);background:var(--card);box-shadow:var(--sh-1);overflow:hidden}',
      '.co-det>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:16px 18px;min-height:44px;cursor:pointer;font-weight:800;font-size:15px;color:var(--ip-ink)}',
      '.co-det>summary::-webkit-details-marker{display:none}',
      '.co-det>summary .ch{flex:none;display:inline-flex;color:var(--muted-2);transition:transform .2s var(--ease)}',
      '.co-det[open]>summary .ch{transform:rotate(90deg)}',
      '.co-det>summary .co-pill{margin-left:auto}',
      '.co-det .co-sub{padding:0 18px 4px}',
      '.co-mkt{border-top:1px solid var(--line-2);padding:12px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}',
      '.co-mkt .id{flex:1 1 200px;min-width:0}',
      '.co-mkt .id .p{font-weight:700;font-size:14px;color:var(--ip-ink)}',
      '.co-mkt .id .c{font-family:var(--mono);font-size:11.5px;color:var(--muted-2);margin-top:1px}',
      '.co-mkt .ms{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}',
      '.co-mkt .m{display:flex;flex-direction:column;gap:1px;min-width:60px}',
      '.co-mkt .m i{font-style:normal;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-2)}',
      '.co-mkt .m span{font-family:var(--mono);font-weight:700;font-size:13px;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.co-mkt .m span.blue{color:var(--ip-blue)}.co-mkt .m span.grn{color:var(--c-opp)}',
      '.co-mkt .v2-btn{min-height:44px;margin-left:auto}',
      '.co-mkth{padding:16px 18px 6px;font-size:13.5px;font-weight:800;color:var(--ip-ink);border-top:1px solid var(--line)}',
      /* chips famille / tension */
      '.co-fam{display:inline-block;font-size:10.5px;font-weight:700;color:var(--muted);background:var(--card-2);border:1px solid var(--line);padding:1px 7px;border-radius:var(--r-pill);vertical-align:middle;margin-left:6px}',
      '.co-fam-mol{color:var(--ip-blue-d,#0034A0);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));border-color:color-mix(in srgb,var(--ip-blue) 20%,var(--line))}',
      '.co-tension{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:var(--c-amber-txt,#9A5B12);background:#FBF1E2;border:1px solid #F0E2C6;padding:1px 7px;border-radius:var(--r-pill);margin-left:6px;vertical-align:middle;white-space:nowrap}',
      '.co-tension svg{flex:none}',
      /* « voir plus » — pur HTML, zéro état JS */
      '.co-more{margin-top:12px}',
      '.co-more>summary{list-style:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1)}',
      '.co-more>summary::-webkit-details-marker{display:none}',
      '.co-more>summary svg{color:var(--muted-2)}',
      '.co-more[open]>summary{margin-bottom:12px}',
      /* divers */
      '.co-foot{padding:11px 16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);background:var(--card-2);line-height:1.5}',
      '.co-empty{padding:24px;text-align:center;color:var(--muted);font-size:14px}',
      '.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}',
      '@media(max-width:560px){.co-tour{grid-template-columns:1fr}.co-args{grid-template-columns:1fr;padding:12px}.co-facts{width:100%}.co-select{flex:1 1 auto;width:auto}.co-facts .v2-btn{width:100%;justify-content:center}.co-mkt .v2-btn{margin-left:0;width:100%;justify-content:center}}'
    ].join('');
    document.head.appendChild(st);
  }

  function feedStrip(nbTension) {
    var m = V2.marketMeta();
    return '<div class="co-feeds" aria-label="Capteurs actifs">' +
      '<span class="co-feed on"><span class="d"></span>Marché France' + (m ? ' · ' + esc(m.periode) : '') + '</span>' +
      (window.RUPTURES
        ? '<span class="co-feed on warn"><span class="d"></span>Ruptures ANSM · ' + num(nbTension || 0) + ' en tension</span>'
        : '<span class="co-feed"><span class="d"></span>Ruptures ANSM · bientôt</span>') +
      (window.ZONE
        ? '<span class="co-feed on info"><span class="d"></span>Zones · ' + num((window.ZONE.meta || {}).n || 0) + ' officines</span>'
        : '<span class="co-feed"><span class="d"></span>Zones · bientôt</span>') +
      (window.SAISON ? '<span class="co-feed on"><span class="d"></span>Saisonnalité</span>' : '') +
      '</div>';
  }
  function tensionBadge(cip) {
    var rp = V2.rupture ? V2.rupture(cip) : null;
    if (!rp) return '';
    return ' <span class="co-tension" title="Signalé en rupture/risque de rupture à l\'ANSM' + (rp.dt ? ' · dernier signalement ' + esc(rp.dt) : '') + (rp.d ? ' · ' + esc(rp.d) : '') + '">' + ICO('alert', 10) + 'tension</span>';
  }
  function abChip(r) {
    return (r.f !== 'gen' && r.rpct > 0)
      ? '<span class="co-ab">abandon de marge −' + String(r.rpct).replace('.', ',') + '%</span>' : '';
  }

  // carte officine — la brique de « Ta tournée »
  function tourCard(o, nbTens) {
    var p = o.p, z = o.z;
    var sel = String(p.id) === String(selPid);
    return '<button type="button" class="co-pcard' + (sel ? ' sel' : '') + '" aria-pressed="' + (sel ? 'true' : 'false') + '" ' +
      'onclick="V2.copiloteSelPharma(\'' + esc(String(p.id)) + '\');var f=document.getElementById(\'co-focus\');if(f)f.scrollIntoView()">' +
      '<span class="nm">' + esc(p.name) + '</span>' +
      '<span class="loc">' + ICO('pharma', 13) +
        (z ? '<span>' + esc(z.c) + (z.dep ? ' (' + esc(z.dep) + ')' : '') + '</span>' + (z.pop ? '<span>· <b>' + num(z.pop) + '</b> hab.</span>' : '') : '<span>zone inconnue</span>') +
      '</span>' +
      (nbTens > 0 ? '<span class="co-warnchip">' + ICO('alert', 11) + nbTens + ' produit' + (nbTens > 1 ? 's' : '') + ' en tension chez elle</span>' : '') +
      '<span class="co-push"><b>' + o.miss + '</b><span>produits à pousser</span></span>' +
      '<span class="co-go">Préparer la visite ' + ICO('chev', 12) + '</span>' +
      '</button>';
  }

  // petite carte argument produit — le cœur du focus officine
  function argCard(o) {
    var r = o.r, s = stk(r.c), g = V2.tendance ? V2.tendance(r.c) : null;
    return '<div class="co-arg">' +
      '<div class="t"><span class="psh">À pousser</span>' + esc(cap(r.d)) + tensionBadge(r.c) + growthBadge(r.c) + newBadge(r.c) + '</div>' +
      '<p class="s">Une pharmacie moyenne en vend <b>~' + num(o.fr) + '</b>/an en France' + (g != null && g >= 8 ? ' · marché <b class="up">+' + g + '%</b> sur un an' : '') + ' · tu en as <b class="stk">' + num(s) + '</b> en stock Intégral.</p>' +
      sparkRow(r.c) +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }
  // carte « marché en croissance » (nouvelle info marché)
  function growCard(o) {
    var r = o.r, s = stk(r.c);
    return '<div class="co-arg co-grow-card">' +
      '<div class="t"><span class="psh up">Marché en croissance</span>' + esc(cap(r.d)) + '<span class="co-grow up big">↑ +' + o.g + '%</span></div>' +
      '<p class="s"><b class="up">+' + o.g + '%</b> sur un an en France · une pharmacie moyenne en vend <b>~' + num(o.fr) + '</b>/an · seulement <b>' + num(r.n || 0) + '</b> de tes officines le commandent · <b class="stk">' + num(s) + '</b> en stock.</p>' +
      sparkRow(r.c) +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }

  // carte « accélération » — produit qui décolle en ce moment (%/mois)
  function accelCard(o) {
    var r = o.r, s = stk(r.c);
    var gtxt = (o.g != null && o.g >= 8) ? ' · <b class="up">+' + o.g + '%</b> sur un an' : '';
    return '<div class="co-arg co-accel-card">' +
      '<div class="t"><span class="psh ac">Accélère en ce moment</span>' + esc(cap(r.d)) + '<span class="co-accel big">↗ +' + o.m + '%/mois</span></div>' +
      '<p class="s">Ventes France en <b class="ac">+' + o.m + '%/mois</b> ces derniers mois' + gtxt + (o.fr >= 10 ? ' · une pharmacie moyenne en vend <b>~' + num(o.fr) + '</b>/an' : ' · marché de niche qui grimpe') + ' · <b class="stk">' + num(s) + '</b> en stock.</p>' +
      sparkRow(r.c) +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }

  // index cip13 → produit benchmark (mémoïsé) pour la mini-courbe 13 mois
  var _benchMap = null;
  function benchMap() {
    if (_benchMap) return _benchMap;
    _benchMap = new Map();
    var B = window.BENCHMARK || [];
    for (var i = 0; i < B.length; i++) { var b = B[i]; if (b.cip13 != null) _benchMap.set(String(b.cip13), b); }
    return _benchMap;
  }
  // mini-courbe des ventes France sur 13 mois (Ameli) — SVG inline, aucune lib
  function sparkline(cip) {
    var b = benchMap().get(String(cip)), m = b && b.ameli_months;
    if (!m) return '';
    var vals = []; for (var i = 0; i < m.length; i++) if (typeof m[i] === 'number') vals.push(m[i]);
    if (vals.length < 4) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    var w = 78, h = 22, n = vals.length;
    var pts = vals.map(function (v, i) {
      var x = (i / (n - 1)) * (w - 2) + 1;
      var y = (h - 2) - ((v - min) / span) * (h - 4);
      return (Math.round(x * 10) / 10) + ',' + (Math.round(y * 10) / 10);
    }).join(' ');
    var up = vals[n - 1] >= vals[0], col = up ? '#0F7A52' : '#9AA1B2';
    var ly = Math.round(((h - 2) - ((vals[n - 1] - min) / span) * (h - 4)) * 10) / 10;
    return '<svg class="co-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none" aria-hidden="true">' +
      '<polyline points="' + pts + '" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + (w - 1) + '" cy="' + ly + '" r="2.1" fill="' + col + '"/></svg>';
  }
  function sparkRow(cip) {
    var sp = sparkline(cip);
    return sp ? '<div class="co-spark-row"><span class="co-spark-l">13 mois France</span>' + sp + '</div>' : '';
  }

  // carte « top opportunité » — cumule les signaux (badges) + le pourquoi en une phrase
  function topCard(o) {
    var r = o.r, s = o.s;
    var badges = o.tags.map(function (t) {
      if (t.k === 'accel') return '<span class="co-tb ac">↗ +' + t.v + '%/mois</span>';
      if (t.k === 'grow') return '<span class="co-tb up">↑ +' + t.v + '%/an</span>';
      if (t.k === 'tension') return '<span class="co-tb te">Tension ANSM</span>';
      if (t.k === 'new') return '<span class="co-tb nw">Nouveau · ' + esc(t.v) + '</span>';
      return '';
    }).join('');
    var why = [];
    if (o.mom != null && o.mom >= 12) why.push('accélère <b class="ac">+' + o.mom + '%/mois</b>');
    if (o.ten != null && o.ten >= 12) why.push('marché <b class="up">+' + o.ten + '%/an</b>');
    if (o.fr >= 10) why.push('~<b>' + num(o.fr) + '</b>/an par pharmacie');
    if (o.rup) why.push('<b class="te">en tension</b>');
    return '<div class="co-arg co-top-card">' +
      '<div class="t"><span class="psh top">Top opportunité</span>' + esc(cap(r.d)) + '</div>' +
      (badges ? '<div class="co-tbadges">' + badges + '</div>' : '') +
      '<p class="s">' + why.join(' · ') + ' · <b class="stk">' + num(s) + '</b> en stock Intégral.</p>' +
      sparkRow(r.c) +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }

  // carte « nouveauté » — produit récemment arrivé sur le marché
  function newCard(o) {
    var r = o.r, s = stk(r.c), n = o.nv;
    return '<div class="co-arg co-new-card">' +
      '<div class="t"><span class="psh nw">Nouveau · AMM ' + esc(n.amm) + '</span>' + esc(cap(r.d)) + growthBadge(r.c) + '</div>' +
      '<p class="s">' + (n.labo ? '<b>' + esc(cap(String(n.labo).toLowerCase())) + '</b> · ' : '') + (o.fr >= 20 ? 'la France en vend déjà <b>~' + num(o.fr) + '</b>/an · ' : 'marché qui démarre · ') + 'tu en as <b class="stk">' + num(s) + '</b> en stock — prends l\'avance.</p>' +
      sparkRow(r.c) +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }

  // ligne « à sécuriser » — produits qu'elle commande, en tension ANSM
  function secuRow(o) {
    var r = o.r, rp = o.rp;
    return '<div class="co-secu-r"><span class="p">' + esc(cap(r.d)) + '</span>' +
      (rp.d ? '<span class="m">DCI ' + esc(cap(String(rp.d).toLowerCase())) + '</span>' : '') +
      (rp.dt ? '<span class="m">signalé le <span class="mono">' + esc(rp.dt) + '</span></span>' : '') +
      '<span class="m">stock IP <span class="mono">' + num(stk(r.c)) + '</span></span>' +
      '</div>';
  }

  // ligne légère « vue marché » (repliée, secondaire)
  function mktLine(o) {
    var r = o.r;
    return '<div class="co-mkt"><div class="id"><div class="p">' + esc(cap(r.d)) + '<span class="co-fam">' + (FAM[r.f] || r.f) + '</span>' + tensionBadge(r.c) + growthBadge(r.c) + '</div><div class="c">' + esc(r.c) + '</div></div>' +
      '<div class="ms">' +
      '<span class="m"><i>France</i><span>~' + num(o.fr) + '/an</span></span>' +
      '<span class="m"><i>Ton réseau</i><span>' + num(r.n || 0) + ' off.</span></span>' +
      '<span class="m"><i>Net remisé</i><span class="blue">' + (r.net > 0 ? eur(r.net) : '—') + '</span></span>' +
      '<span class="m"><i>Stock IP</i><span class="grn">' + num(stk(r.c)) + '</span></span>' +
      '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></div>';
  }
  function rupLine(o) {
    var r = o.r, rp = o.rp;
    return '<div class="co-mkt"><div class="id"><div class="p">' + esc(cap(r.d)) + '<span class="co-fam co-fam-mol">' + esc(cap((rp.d || '—').toLowerCase())) + '</span></div><div class="c">' + esc(r.c) + (rp.dt ? ' · signalé le ' + esc(rp.dt) : '') + '</div></div>' +
      '<div class="ms">' +
      '<span class="m"><i>Ton réseau</i><span>' + num(r.n || 0) + ' off.</span></span>' +
      '<span class="m"><i>Net remisé</i><span class="blue">' + (r.net > 0 ? eur(r.net) : '—') + '</span></span>' +
      '<span class="m"><i>Stock IP</i><span class="grn">' + num(stk(r.c)) + '</span></span>' +
      '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></div>';
  }

  // Le Copilote devient la CARTE des tournées ; l'ancien écran marché passe en page « marche » (accessible depuis Pilotage).
  V2.pages.copilote = { render: function (root) { if (V2.pages.carte) V2.pages.carte.render(root); else root.innerHTML = ''; } };
  V2.pages.marche = {
    render: function (root) {
      injectCss();
      var hasData = !!(window.AMELI_AVG && window.PROD_STATS && (V2.sales || []).length);
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'pilotage', backLabel: 'Pilotage' }) : '';

      if (!hasData) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="co-hero"><h1>Marché &amp; opportunités</h1><p>Chargement des données réseau…</p></div></div>';
        if (V2.loadFiles) V2.loadFiles(['bench']).then(function () { V2.render(); });
        return;
      }

      var nbTension = 0;
      if (window.RUPTURES) PS().forEach(function (r) { if (V2.rupture(r.c)) nbTension++; });

      // ordre de calcul conservé : marchés → ruptures réseau → officine → tournée → saison
      var big = bigMarkets(18);
      var rupRes = reseauRuptures(15);

      // officine sélectionnée (focus)
      var phs = pharmaOptions();
      if (!selPid && phs.length) selPid = String(phs[0].id);
      var selName = '';
      var opts = phs.map(function (p) {
        var s = String(p.id) === String(selPid); if (s) selName = p.name;
        return '<option value="' + esc(String(p.id)) + '"' + (s ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      var gaps = selPid ? officineGaps(selPid, 25) : [];
      var z = selPid && V2.zone ? V2.zone(selPid) : null;

      // tournée + secteurs
      var tour = tournee(selDep);
      var deps = tourneeDeps();

      // CIP éligibles en tension (pour badges cartes + bloc « à sécuriser »)
      var tensionCips = {};
      if (window.RUPTURES) PS().forEach(function (r) { if (eligible(r) && V2.rupture(r.c)) tensionCips[String(r.c)] = 1; });
      function nbTensChez(pid) {
        var owned = orderedCips(pid), n = 0;
        for (var c in tensionCips) { if (owned[c]) n++; }
        return n;
      }

      // ── « Ta tournée » : chips secteur + cartes officines ──
      var chips = '<div class="co-chips" aria-label="Filtrer par secteur">' +
        '<button type="button" class="co-chip' + (selDep ? '' : ' on') + '" aria-pressed="' + (selDep ? 'false' : 'true') + '" onclick="V2.copiloteSelDep(\'\')">Tous secteurs</button>' +
        deps.map(function (d) {
          var on = d === selDep;
          return '<button type="button" class="co-chip' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="V2.copiloteSelDep(\'' + esc(d) + '\')">Dép. ' + esc(d) + '</button>';
        }).join('') +
        '</div>';
      var tourTop = tour.slice(0, 10), tourMore = tour.slice(10, 25);
      var tourGrid = tourTop.length
        ? '<div class="co-tour">' + tourTop.map(function (o) { return tourCard(o, nbTensChez(o.p.id)); }).join('') + '</div>' +
          (tourMore.length ? '<details class="co-more"><summary>' + ICO('chev', 12) + 'Voir ' + tourMore.length + ' officines de plus</summary><div class="co-tour">' + tourMore.map(function (o) { return tourCard(o, nbTensChez(o.p.id)); }).join('') + '</div></details>' : '')
        : '<div class="co-card"><div class="co-empty">Aucune opportunité dans ce secteur.</div></div>';
      var tourSec = '<section class="co-sec">' +
        '<div class="co-sec-h"><h2>Ta tournée</h2><span class="co-pill">' + tour.length + ' officines</span></div>' +
        '<p class="co-sub">Classées par ce que tu as à y gagner. Touche une officine pour préparer ta visite.</p>' +
        chips + tourGrid +
        '</section>';

      // ── Focus officine : « Prépare ta visite » ──
      var zoneLine = z
        ? '<span class="co-fzone">' + ICO('pharma', 13) + esc(z.c) + (z.dep ? ' (' + esc(z.dep) + ')' : '') + (z.pop ? ' · <b>' + num(z.pop) + '</b> hab. dans la commune' : '') + '</span>'
        : '<span class="co-fzone">' + ICO('pharma', 13) + 'zone inconnue</span>';
      var argsHtml;
      if (gaps.length) {
        var g1 = gaps.slice(0, 6), g2 = gaps.slice(6);
        argsHtml = '<div class="co-args">' + g1.map(argCard).join('') + '</div>' +
          (g2.length ? '<details class="co-more" style="margin:0 16px 16px"><summary>' + ICO('chev', 12) + 'Voir ' + g2.length + ' autres arguments</summary><div class="co-args" style="padding:12px 0 0">' + g2.map(argCard).join('') + '</div></details>' : '');
      } else {
        argsHtml = '<div class="co-empty">Cette officine commande déjà les plus gros marchés France.</div>';
      }
      var secu = [];
      if (selPid && window.RUPTURES) {
        var ownedSel = orderedCips(selPid);
        PS().forEach(function (r) {
          if (!eligible(r)) return;
          if (!ownedSel[String(r.c)]) return;
          var rp = V2.rupture(r.c);
          if (rp) secu.push({ r: r, rp: rp });
        });
        secu.sort(function (a, b) { return (b.r.n || 0) - (a.r.n || 0); });
        secu = secu.slice(0, 6);
      }
      var secuHtml = secu.length
        ? '<div class="co-secu"><h4>' + ICO('alert', 13) + 'À sécuriser — elle commande ces produits, signalés en tension ANSM</h4>' + secu.map(secuRow).join('') + '</div>'
        : '';
      var focusSec = '<section class="co-sec" id="co-focus">' +
        '<div class="co-sec-h"><h2>Prépare ta visite</h2>' + (gaps.length ? '<span class="co-pill">' + gaps.length + ' arguments</span>' : '') + '</div>' +
        '<p class="co-sub">Tes arguments pour <b>' + esc(selName) + '</b> : les gros marchés France qu\'elle ne commande pas encore.</p>' +
        '<div class="co-card">' +
          '<div class="co-fhead">' +
            '<div class="fn"><h3>' + esc(selName) + '</h3>' + zoneLine + '</div>' +
            '<div class="co-facts">' +
              '<label class="co-lab" for="co-selph">Officine</label>' +
              '<select id="co-selph" class="co-select" onchange="V2.copiloteSelPharma(this.value)">' + opts + '</select>' +
              (selPid ? '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'pharma\',\'' + esc(String(selPid)) + '\')">Ouvrir la fiche</button>' : '') +
            '</div>' +
          '</div>' +
          argsHtml + secuHtml +
          (gaps.length ? '<div class="co-visite">' +
            '<span class="co-visite-l">' + ICO('download', 14, 2) + 'Fiche de visite</span>' +
            '<div class="co-visite-grp"><span class="co-visite-t">Pour le pharmacien</span>' +
              '<button class="co-vbtn" onclick="V2.copiloteVisite(\'client\',\'pdf\')">PDF</button>' +
              '<button class="co-vbtn" onclick="V2.copiloteVisite(\'client\',\'copy\')">Copier</button></div>' +
            '<div class="co-visite-grp co-visite-int"><span class="co-visite-t">Ma prépa <small>(interne)</small></span>' +
              '<button class="co-vbtn" onclick="V2.copiloteVisite(\'interne\',\'pdf\')">PDF</button>' +
              '<button class="co-vbtn" onclick="V2.copiloteVisite(\'interne\',\'copy\')">Copier</button></div>' +
          '</div>' : '') +
          '<div class="co-foot">Marché France Ameli (ce qu\'une pharmacie moyenne vend, indicatif) · uniquement des princeps en stock Intégral, tous établissements confondus · zone geo.api.gouv.fr.</div>' +
        '</div></section>';

      // ── Top opportunités du jour — LA synthèse en tête (fusion de tous les signaux) ──
      var topOpp = topOpportunities(8);
      var topSec = topOpp.length
        ? '<section class="co-sec co-sec-top"><div class="co-sec-h"><h2>Top opportunités du jour</h2><span class="co-pill co-pill-top">' + topOpp.length + '</span></div>' +
          '<p class="co-sub">Les produits qui <b>cumulent le plus de signaux</b> — accélération, croissance, gros marché, tension — et que tu as <b>en stock</b>. À pousser en priorité aujourd\'hui.</p>' +
          '<div class="co-args">' + topOpp.map(topCard).join('') + '</div></section>'
        : '';

      // ── Marchés en croissance à saisir (nouvelle intelligence marché) ──
      var grow = window.TENDANCE ? growingMarkets(12) : [];
      var growSec = grow.length
        ? '<section class="co-sec"><div class="co-sec-h"><h2>Marchés en croissance à saisir</h2><span class="co-pill co-pill-up">' + grow.length + '</span></div>' +
          '<p class="co-sub">Marchés qui progressent en France sur un an (Medic\'AM) et que peu de tes officines commandent — la vague à prendre avant les autres.</p>' +
          '<div class="co-args">' + grow.map(growCard).join('') + '</div></section>'
        : '';

      // ── Ça décolle en ce moment (accélération récente, %/mois) ──
      var accel = window.MOMENTUM ? acceleratingList(12) : [];
      var accelSec = accel.length
        ? '<section class="co-sec"><div class="co-sec-h"><h2>Ça décolle en ce moment</h2><span class="co-pill co-pill-accel">' + accel.length + '</span></div>' +
          '<p class="co-sub">Produits dont les ventes France <b>accélèrent le plus ces derniers mois</b> (pente Medic\'AM) — le signal le plus précoce pour les attraper avant tout le monde. Princeps en stock Intégral.</p>' +
          '<div class="co-args">' + accel.map(accelCard).join('') + '</div></section>'
        : '';

      // ── Nouveautés à ne pas rater (produits d'AMM récente en stock) ──
      var nv = window.NOUVEAUTES ? nouveautesList(12) : [];
      var nvSec = nv.length
        ? '<section class="co-sec"><div class="co-sec-h"><h2>Nouveautés à ne pas rater</h2><span class="co-pill co-pill-new">' + nv.length + '</span></div>' +
          '<p class="co-sub">Produits récemment arrivés sur le marché (AMM des 3 dernières années, BDPM) que tu as déjà en stock — prends l\'avance avant les concurrents.</p>' +
          '<div class="co-args">' + nv.map(newCard).join('') + '</div></section>'
        : '';

      // ── Saisonnalité — bande compacte (inchangée sur le fond) ──
      var saisonSec = '';
      if (window.SAISON && window.SAISON.data) {
        var mo = (new Date()).getMonth() + 1;
        var moLabel = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][mo];
        var sarr = [];
        for (var k in window.SAISON.data) { var sd = window.SAISON.data[k]; var sv = (sd.idx && sd.idx[mo - 1]) || 100; if (sv > 105) sarr.push({ l: sd.l, v: sv }); }
        sarr.sort(function (a, b) { return b.v - a.v; });
        var stop = sarr.slice(0, 8);
        if (stop.length) {
          saisonSec = '<section class="co-sec"><div class="co-sec-h"><h2>Ce mois-ci, ça monte</h2><span class="co-pill">' + moLabel + '</span></div>' +
            '<p class="co-sub">Classes thérapeutiques au-dessus de leur moyenne annuelle en ' + moLabel + ' (Medic\'AM) — à glisser dans tes visites.</p>' +
            '<div class="co-card"><div class="co-saison">' +
            stop.map(function (s) { return '<div class="co-sais-i"><span class="co-sais-up">+' + (s.v - 100) + '%</span><span class="co-sais-l">' + esc(cap(s.l.toLowerCase())) + '</span></div>'; }).join('') +
            '</div><div class="co-foot">Indice mensuel Medic\'AM : 100 = moyenne annuelle. « +34 % » = la classe se vend 34 % au-dessus de sa moyenne ce mois-ci.</div></div></section>';
        }
      }

      // ── Vue marché — SECONDAIRE, repliée par défaut ──
      var mktSec = '<section class="co-sec"><details class="co-det">' +
        '<summary><span class="ch">' + ICO('chev', 13) + '</span>Vue marché · gros marchés France' + (rupRes.length ? ' &amp; tensions réseau' : '') + '<span class="co-pill">' + (big.length + rupRes.length) + '</span></summary>' +
        '<p class="co-sub">Les produits que la France consomme beaucoup mais que peu de tes officines commandent — pour creuser au calme, pas indispensable en visite.</p>' +
        big.map(mktLine).join('') +
        (rupRes.length
          ? '<div class="co-mkth">Produits en tension dans ton réseau (' + rupRes.length + ') — anticipe le réassort, ou propose la molécule (DCI) en alternative</div>' + rupRes.map(rupLine).join('')
          : '') +
        '<div class="co-foot">« Ton réseau » = nombre de tes officines qui commandent déjà ce produit. Marché France Ameli, à titre indicatif · signalements ANSM (rupture / risque).</div>' +
        '</details></section>';

      root.innerHTML = top +
        '<div class="v2-wrap">' +
          '<div class="co-hero">' +
            '<h1>Marché &amp; opportunités<span class="ac">.</span></h1>' +
            '<p>Quoi pousser, où décroche le réseau. On croise le <b>marché France</b> avec <b>tes ventes réseau</b> — uniquement des <b>princeps en stock Intégral</b>.</p>' +
            feedStrip(nbTension) +
          '</div>' +
          '<a class="co-maplink" onclick="V2.go(\'carte\')">' +
            '<span class="co-maplink-ic">' + ICO('pharma', 22, 1.8) + '</span>' +
            '<span class="co-maplink-txt"><span class="co-maplink-t">Carte nationale des pharmacies par UGA</span>' +
              '<span class="co-maplink-s">Les ~23 000 officines de France (hors Corse) sur la carte — couleur par UGA, groupement ou segmentation.</span></span>' +
            '<span class="co-maplink-go">Ouvrir ' + ICO('chev', 17) + '</span>' +
          '</a>' +
          topSec +
          tourSec +
          focusSec +
          growSec +
          accelSec +
          nvSec +
          saisonSec +
          mktSec +
        '</div>';

      // motion léger : cascade d'entrée des cartes (RM-safe via V2.motion)
      try {
        if (V2.motion && V2.motion.stagger) {
          V2.motion.stagger(root.querySelectorAll('.co-tour .co-pcard'), { step: 40, y: 8 });
          V2.motion.stagger(root.querySelectorAll('#co-focus .co-arg'), { step: 40, y: 8 });
        }
      } catch (e) {}
    }
  };
})();
