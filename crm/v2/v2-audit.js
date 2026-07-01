/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Audit Marge" (pages.audit)
   Calcule, par pharmacie (ou moyenne réseau), l'abandon de marge Intégral
   sur le PRINCEPS DE MARQUE (hors génériques), à partir des vraies ventes
   WML_SALES [pharmacyId,mois,commercial,cip13,qte,puNet,mntNetHt] + PROD_STATS
   (famille + libellé par CIP pour isoler le princeps de marque).
   Abandon = 60% de la marge grossiste (plancher 0,30€ / 6,93% / plafond 32,50€).
   100% client-side, zéro dépendance. PDF via V2.pdfPreview.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  function fmt(n) { n = Math.round(n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function pc1(x) { return (Math.round(x * 10) / 10).toString().replace('.', ',') + ' %'; }

  var MOIS = 5;                       // période couverte : janv → mai 2026
  // labos génériqueurs (mots entiers dans le libellé) -> exclus
  var GEN = /\b(ZTL|ZYD|ZEN|EG|BGR|BGA|MYL|SDZ|TEVA|ARW|KRKA|CRST|CRISTERS|ALM|ALMUS|ACCORD|ACC|VIATRIS|EVOLUGEN|EVG|QUALIMED|QLM|RPG|RANBAXY|BLUEFISH|BLF|SUN|AUROBINDO|AUR|BIOGARAN|SANDOZ|ZENTIVA|ZYDUS|MYLAN|ARROW|WINTHROP|WTP|ALTER|RATIOPHARM|RTP|GNR|GERDA|ISO|REF)\b/;
  var _M = null;
  function cipMap() {
    if (_M) return _M;
    _M = {}; var P = window.PROD_STATS || [];
    for (var i = 0; i < P.length; i++) {
      var p = P[i], f = p.f;
      _M[p.c] = { p: (f === 'p_low' || f === 'p_mid' || f === 'p_high'), g: GEN.test((p.d || '').toUpperCase()) };
    }
    return _M;
  }
  function pfFromNet(pu) { pu = Math.abs(pu || 0); return pu <= 4.63 ? Math.max(0.01, pu - 0.30) : (pu <= 501.5 ? pu / 1.0693 : pu - 32.50); }
  function abPF(pf) { return 0.60 * Math.max(0.30, Math.min(0.0693 * pf, 32.50)); }

  // Index ventes brutes par pharmacie (1×) + cache résultat — évite d'itérer 325k lignes à chaque render
  var _sbp = null, _ac = {};
  function salesByPid() {
    if (_sbp) return _sbp;
    _sbp = {}; var S = window.WML_SALES || [];
    for (var i = 0; i < S.length; i++) { var k = String(S[i][0]); (_sbp[k] || (_sbp[k] = [])).push(S[i]); }
    return _sbp;
  }
  // Calcule l'audit pour une pharmacie (pid) ou la moyenne réseau (pid falsy).
  function audit(pid) {
    var ck = String(pid || '_reseau'); if (_ac[ck]) return _ac[ck];
    var M = cipMap();
    var S = pid ? (salesByPid()[String(pid)] || []) : (window.WML_SALES || []);
    var t3 = { petits: { n: 0, a: 0 }, coeur: { n: 0, a: 0 }, chers: { n: 0, a: 0 } };
    var t5 = [{ n: 0, a: 0 }, { n: 0, a: 0 }, { n: 0, a: 0 }, { n: 0, a: 0 }, { n: 0, a: 0 }];
    var ph = {}, net = 0, ab = 0;
    for (var i = 0; i < S.length; i++) {
      var r = S[i];
      var q = r[4], nh = r[6];
      if (!(q > 0) || !(nh > 0)) continue;
      var m = M[r[3]]; if (!m || !m.p || m.g) continue;     // princeps remboursable, hors génériques
      var pf = pfFromNet(r[5]), a = abPF(pf) * q;
      ph[r[0]] = 1; net += nh; ab += a;
      var k = pf < 4.33 ? 'petits' : (pf <= 468.97 ? 'coeur' : 'chers'); t3[k].n += nh; t3[k].a += a;
      var bi = pf <= 1.91 ? 0 : (pf <= 22.90 ? 1 : (pf <= 150 ? 2 : (pf <= 1930 ? 3 : 4))); t5[bi].n += nh; t5[bi].a += a;
    }
    var nph = pid ? 1 : Math.max(1, Object.keys(ph).length);
    var div = nph * MOIS / 12;                              // total -> €/an par pharmacie
    var out = { net: net, ab: ab, t3: t3, t5: t5, nph: nph, annNet: net / div, annAb: ab / div, div: div, rate: net ? ab / net * 100 : 0 };
    _ac[ck] = out; return out;
  }

  function aLabels() {
    return [
      { lo: 'Petits prix', sub: '&lt; 4,33 €' },
      { lo: 'Cœur de gamme', sub: '4,33 € – 468 €' },
      { lo: 'Produits chers', sub: '&gt; 468 €' }
    ];
  }
  var T5 = ['0 – 1,91 €', '1,92 – 22,90 €', '22,91 – 150 €', '150 – 1 930 €', '> 1 930 €'];
  var N1 = ['≤ 2,5 %', '≤ 2,5 %', '2,5 % (plafond)', '2,5 % → 0 %', '0 % (T4 exclu)'];

  // Construit le "sheet" (HTML) — width: variable (écran responsive / 794px en PDF).
  function buildSheet(pid, name) {
    var d = audit(pid);
    if (!d.net) {
      return '<div class="aud-sheet"><div class="aud-band"><div><div class="aud-logo">Intégral Pharma</div><h1>Audit Marge</h1>'
        + '<div class="aud-ph">' + esc(name) + '</div></div></div>'
        + '<div class="aud-empty">Aucune vente de princeps de marque sur la période (janv.–mai 2026) pour cette pharmacie.</div></div>';
    }
    var t3 = d.t3, A = 12 / d.div;  // facteur total->an/pharma
    function row3(k, L) {
      var x = t3[k]; var an = x.n / d.div, ra = x.a / d.div;
      return '<tr><td><div class="aud-prod">' + L.lo + '</div><div class="aud-cip">' + L.sub + '</div></td>'
        + '<td data-l="Achats/an" class="aud-mono">' + fmt(an) + ' €</td>'
        + '<td data-l="Rendu/an" class="aud-gain aud-mono">+' + fmt(ra) + ' €</td>'
        + '<td data-l="%" class="aud-gain aud-mono">' + pc1(x.n ? x.a / x.n * 100 : 0) + '</td></tr>';
    }
    var L = aLabels();
    var rows3 = row3('petits', L[0]) + row3('coeur', L[1]) + row3('chers', L[2]);
    var rows5 = '';
    for (var i = 0; i < 5; i++) {
      var x = d.t5[i], p = x.n ? x.a / x.n * 100 : 0;
      rows5 += '<tr><td><div class="aud-prod">' + T5[i] + '</div></td>'
        + '<td data-l="Intégral" class="aud-gain aud-mono">' + (x.n ? pc1(p) : '—') + '</td>'
        + '<td data-l="Votre N°1" class="aud-mono" style="color:#9AA1B2">' + N1[i] + '</td></tr>';
    }
    var ann = d.annNet ? d.annAb / d.annNet * 100 : 0;
    return '<div class="aud-sheet">'
      + '<div class="aud-band"><div><div class="aud-logo">Intégral Pharma</div><h1>Audit Marge</h1>'
      + '<div class="aud-ph">' + esc(name) + ' · princeps de marque · janv.–mai 2026</div></div>'
      + '<div class="aud-gift">🎁 Audit offert</div></div>'

      + '<div class="aud-hero"><div class="aud-lbl">Ce qu\'Intégral vous rend sur le princeps</div>'
      + '<div class="aud-big aud-mono">≈ ' + fmt(d.annAb) + ' €<span class="aud-yr"> / an</span></div>'
      + '<div class="aud-sub">via l\'abandon de marge — soit ' + fmt(d.annAb / 12) + ' €/mois net sur facture, cumulable, sans engagement ni franco</div>'
      + '<div class="aud-minis">'
      + '<div class="aud-mini"><div class="aud-n aud-mono">' + fmt(d.annNet) + ' €<span class="aud-u">/an</span></div><div class="aud-t">Vos achats princeps</div></div>'
      + '<div class="aud-mini"><div class="aud-n aud-mono">' + fmt(d.annAb / 12) + ' €<span class="aud-u">/mois</span></div><div class="aud-t">Marge rendue</div></div>'
      + '<div class="aud-mini"><div class="aud-n aud-mono">' + pc1(ann) + '</div><div class="aud-t">de vos achats rendus</div></div>'
      + '</div></div>'

      + '<div class="aud-sec"><div class="aud-sh"><div class="aud-ic">€</div><div><h2>Le détail par tranche de prix</h2>'
      + '<div class="aud-desc">Abandon de marge Intégral : 60 % de notre marge de grossiste — net sur facture, cumulable (art. L.138-9)</div></div>'
      + '<div class="aud-tot aud-mono">+' + fmt(d.annAb) + ' € / an</div></div>'
      + '<table><thead><tr><th>Tranche</th><th>Achats/an</th><th>Rendu/an</th><th>%</th></tr></thead><tbody>' + rows3
      + '<tr class="aud-foot-row"><td>Total</td><td class="aud-mono">' + fmt(d.annNet) + ' €</td><td class="aud-gain aud-mono">+' + fmt(d.annAb) + ' €</td><td class="aud-gain aud-mono">' + pc1(ann) + '</td></tr>'
      + '</tbody></table></div>'

      + '<div class="aud-sec"><div class="aud-sh"><div class="aud-ic">⚖</div><div><h2>Comparatif par tranche — vs votre grossiste</h2>'
      + '<div class="aud-desc">Dans vos 5 tranches de prix · % sur vos achats réels</div></div></div>'
      + '<div class="aud-intro">Votre N°1 est <b>plafonné à 2,5 %</b> sur le remboursable et <b>0 % au-delà de ~450 €</b>. Intégral n\'est pas plafonné : l\'abandon <b>s\'empile par-dessus</b>.</div>'
      + '<table><thead><tr><th>Tranche (PFHT)</th><th>Intégral</th><th>Votre N°1</th></tr></thead><tbody>' + rows5 + '</tbody></table></div>'

      + '<div class="aud-verif"><div class="aud-vic">🔍</div><div><h3>Vérificateur de remise</h3>'
      + '<p>Vous doutez de ce que votre grossiste vous fait vraiment ? On calcule, sur votre facture, la remise que le barème officiel permet — net à net.</p></div></div>'

      + '<div class="aud-fo">Calculé sur le barème officiel de marge grossiste et l\'abandon Intégral (art. L.138-9), à partir de vos achats réels. '
      + 'Princeps de marque, hors génériques. Document de travail.<br><b>Intégral Pharma</b> · le grossiste qui vous rend de la marge.</div>'
      + '</div>';
  }

  function selectorHtml(pid) {
    var O = (window.WML_OFFICINES || []).slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    var opt = '<option value="">★ Moyenne réseau (toutes les pharmacies)</option>';
    for (var i = 0; i < O.length; i++) {
      var o = O[i], sel = (String(pid) === String(o.id)) ? ' selected' : '';
      opt += '<option value="' + esc(o.id) + '"' + sel + '>' + esc(o.name) + (o.ville ? ' — ' + esc(o.ville) : '') + '</option>';
    }
    return '<div class="aud-pick"><label>Pour quelle pharmacie&nbsp;?</label><select onchange="V2.go(\'audit\', this.value)">' + opt + '</select></div>';
  }

  V2.auditPdf = function () {
    var pid = (V2.route && V2.route.param) || '';
    var name = pidName(pid);
    if (typeof V2.pdfPreview !== 'function') { if (V2.toast) V2.toast('Module PDF indisponible', 'error'); return; }
    var html = '<div id="aud" style="width:794px"><style>' + CSS + '</style>' + buildSheet(pid || null, name) + '</div>';
    var fn = 'Audit-Marge-' + (name || 'reseau').replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    V2.pdfPreview(html, fn, 'Audit Marge · ' + name);
  };

  function pidName(pid) {
    if (!pid) return 'Pharmacie moyenne du réseau';
    var O = window.WML_OFFICINES || [];
    for (var i = 0; i < O.length; i++) if (String(O[i].id) === String(pid)) return O[i].name + (O[i].ville ? ' — ' + O[i].ville : '');
    return 'Pharmacie';
  }

  V2.pages.audit = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      if (!window.WML_SALES || !window.PROD_STATS) {
        root.innerHTML = top + '<div class="v2-wrap"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des ventes…</div></div></div>';
        if (V2.loadFiles) V2.loadFiles(['wml', 'prod']).then(function () { if (V2.route && V2.route.name === 'audit') V2.render(); });
        return;
      }
      ensureCss();
      var pid = (V2.route && V2.route.param) || '';
      var name = pidName(pid);
      var d = audit(pid || null);
      var intro = '<div class="aud-top">'
        + '<div class="aud-top-head"><div class="aud-eyebrow">Audit offert · à montrer au pharmacien</div>'
        + '<h1 class="aud-title">Ce qu\'Intégral rend à cette pharmacie</h1>'
        + '<p class="aud-lede">L\'abandon de marge Intégral, calculé sur ses vrais achats de princeps de marque (janv.–mai 2026). Choisissez la pharmacie, puis générez le PDF prêt à présenter.</p></div>'
        + selectorHtml(pid)
        + (d.net ? '<button class="v2-btn v2-btn-primary aud-cta" onclick="V2.auditPdf()">' + ICO('fiche', 18) + ' Générer le PDF à présenter</button>' : '')
        + '</div>';
      root.innerHTML = top + '<div class="v2-wrap"><div id="aud">' + intro
        + '<div class="aud-preview-lbl">Aperçu du document</div>'
        + buildSheet(pid || null, name) + importSection() + '</div></div>';
    }
  };

  // API publique : permet à la fiche officine (v2-pharma) d'afficher l'audit d'une pharmacie.
  V2.audit = {
    sheetFor: function (pid) { ensureCss(); return buildSheet(pid || null, pidName(pid)); },
    importSection: importSection,
    ensureCss: ensureCss
  };

  function importSection() {
    return '<div class="aud-imp">'
      + '<div class="aud-imp-head"><span class="aud-vic2">🔍</span><div><b>Vérificateur de remise</b><div class="aud-imp-d">Importez une facture (Excel/CSV) d\'un autre grossiste — je calcule, ligne par ligne, <b>ce qu\'Intégral vous aurait rendu</b> dessus. Vos vrais chiffres, pas des promesses.</div></div></div>'
      + '<label class="v2-btn v2-btn-primary aud-imp-btn">Choisir un fichier Excel/CSV<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="V2.auditImport(this)"></label>'
      + '<div id="aud-imp-res"></div></div>';
  }

  function ensureXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  function pickCol(keys, re) { for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) return keys[i]; return null; }
  function num(v) { if (typeof v === 'number') return v; v = String(v == null ? '' : v).replace(/\s/g, '').replace(/€/g, '').replace(',', '.'); var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  V2.auditImport = function (input) {
    var f = input.files && input.files[0]; if (!f) return;
    var res = document.getElementById('aud-imp-res');
    res.innerHTML = '<div class="aud-imp-load">Lecture du fichier…</div>';
    ensureXLSX().then(function () {
      var rd = new FileReader();
      rd.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          renderImport(rows, res, f.name);
        } catch (err) { res.innerHTML = '<div class="aud-imp-err">Impossible de lire ce fichier. Exporte tes achats en Excel (.xlsx) ou CSV depuis ton logiciel.</div>'; }
      };
      rd.readAsArrayBuffer(f);
    }).catch(function () { res.innerHTML = '<div class="aud-imp-err">Module Excel indisponible (connexion ?).</div>'; });
  };

  function renderImport(rows, res, fname) {
    if (!rows || !rows.length) { res.innerHTML = '<div class="aud-imp-err">Fichier vide.</div>'; return; }
    var keys = Object.keys(rows[0]);
    var cQte = pickCol(keys, /qte|quant/i);
    var cPu = pickCol(keys, /punet|prix.?net|pu.?ht|prix.?unit|p\.?u/i);
    var cMnt = pickCol(keys, /mnt.?net|montant|total.?ht|^net$/i);
    var cCip = pickCol(keys, /cip|artcode|code.?barre|^ean|^code$/i);
    if (!cQte || (!cPu && !cMnt)) {
      res.innerHTML = '<div class="aud-imp-err">Colonnes non reconnues. Il me faut au moins une <b>quantité</b> et un <b>prix unitaire</b> (ou un montant). Colonnes vues : ' + esc(keys.slice(0, 8).join(', ')) + '</div>';
      return;
    }
    var M = cipMap();
    var net = 0, ab = 0, n = 0, skipped = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var qte = num(r[cQte]); if (qte <= 0) continue;
      var pu = cPu ? num(r[cPu]) : (num(r[cMnt]) / qte);
      var mnt = cMnt ? num(r[cMnt]) : pu * qte;
      if (pu <= 0 || mnt <= 0) continue;
      if (cCip) { var m = M[String(r[cCip]).replace(/\D/g, '')]; if (m && !m.p && !m.g) { skipped++; continue; } } // NR connu -> pas d'abandon
      var pf = pfFromNet(pu); net += mnt; ab += abPF(pf) * qte; n++;
    }
    if (!n) { res.innerHTML = '<div class="aud-imp-err">Aucune ligne exploitable trouvée.</div>'; return; }
    var rate = net ? ab / net * 100 : 0;
    res.innerHTML = '<div class="aud-imp-out">'
      + '<div class="aud-imp-file">📄 ' + esc(fname) + ' · ' + n + ' lignes · ' + fmt(net) + ' € d\'achats</div>'
      + '<div class="aud-imp-big">Intégral vous aurait rendu <b class="aud-gain">≈ ' + fmt(ab) + ' €</b> sur cette facture</div>'
      + '<div class="aud-imp-rate">soit <b>' + pc1(rate) + '</b> de vos achats — net sur facture, cumulable, en plus de votre remise actuelle.</div>'
      + (skipped ? '<div class="aud-imp-note">(' + skipped + ' lignes non remboursables ignorées — marge libre.)</div>' : '')
      + '</div>';
  }

  function ensureCss() {
    if (document.getElementById('aud-css')) return;
    var st = document.createElement('style'); st.id = 'aud-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  var CSS =
    '#aud{--ip:#0050E6;--ip-d:#0034A0;--ink:#10131C;--muted:#737A8C;--muted2:#8A91A4;--line:rgba(16,19,28,.07);--line2:rgba(16,19,28,.12);--green:#1E9E6A;--green-tx:#0F7A52;--green-bg:rgba(30,158,106,.08);--paper:#F7F9FC;--r:20px;--r-md:14px;--sh:0 1px 2px rgba(16,19,28,.05),0 4px 10px rgba(16,19,28,.05),0 12px 24px rgba(16,19,28,.05);max-width:840px;margin:0 auto;font-family:"Inter",system-ui,sans-serif;color:var(--ink)}'
    + '#aud *{box-sizing:border-box}'
    + '#aud .aud-mono{font-family:"Geist Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;letter-spacing:-.02em}'

    // ── Écran : intro calme, façon Launcher (hors PDF) ──
    + '#aud .aud-top{text-align:center;padding:6px 0 4px}'
    + '#aud .aud-eyebrow{display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.04em;color:var(--green-tx);background:var(--green-bg);padding:5px 12px;border-radius:999px;margin-bottom:14px}'
    + '#aud .aud-title{font-size:clamp(24px,4vw,32px);font-weight:700;letter-spacing:-.02em;margin:0 0 10px;line-height:1.12}'
    + '#aud .aud-lede{max-width:560px;margin:0 auto 22px;font-size:15px;line-height:1.5;color:var(--muted)}'
    + '#aud .aud-pick{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:560px;margin:0 auto 16px}'
    + '#aud .aud-pick label{font-size:13px;font-weight:600;color:var(--muted)}'
    + '#aud .aud-pick select{flex:1;min-width:220px;padding:12px 14px;border:1px solid var(--line2);border-radius:var(--r-md);background:#fff;font-size:14px;font-weight:600;color:var(--ink);box-shadow:var(--sh)}'
    + '#aud .aud-cta{display:inline-flex;align-items:center;gap:9px;font-size:15px;padding:13px 24px;border-radius:var(--r-md)}'
    + '#aud .aud-cta svg{width:18px;height:18px}'
    + '#aud .aud-preview-lbl{text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);margin:34px 0 14px;position:relative}'
    + '#aud .aud-preview-lbl::before,#aud .aud-preview-lbl::after{content:"";position:absolute;top:50%;width:64px;height:1px;background:var(--line2)}'
    + '#aud .aud-preview-lbl::before{right:calc(50% + 90px)}#aud .aud-preview-lbl::after{left:calc(50% + 90px)}'

    // ── Le document (aperçu écran + PDF) : calme, aéré, premium ──
    + '#aud .aud-sheet{background:transparent;display:flex;flex-direction:column;gap:16px}'
    + '#aud .aud-band{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px 26px;box-shadow:var(--sh);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;border-top:3px solid var(--ip)}'
    + '#aud .aud-logo{font-weight:800;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ip)}'
    + '#aud .aud-band h1{font-size:21px;font-weight:800;letter-spacing:-.01em;margin:6px 0 0;color:var(--ink)}'
    + '#aud .aud-ph{font-size:13px;color:var(--muted);margin-top:6px}'
    + '#aud .aud-gift{background:var(--green-bg);color:var(--green-tx);border:1px solid rgba(30,158,106,.25);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:700;white-space:nowrap}'
    + '#aud .aud-hero{background:linear-gradient(180deg,#fff,var(--card-2,#F7F9FC));border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:30px 24px;text-align:center;position:relative;overflow:hidden}'
    + '#aud .aud-hero::before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:var(--green)}'
    + '#aud .aud-lbl{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}'
    + '#aud .aud-big{font-size:clamp(40px,8vw,54px);font-weight:800;letter-spacing:-.03em;color:var(--green-tx);margin:8px 0 4px;line-height:1}'
    + '#aud .aud-yr{font-size:22px;color:var(--muted2);font-weight:700}'
    + '#aud .aud-sub{font-size:13.5px;color:var(--muted);max-width:440px;margin:0 auto;line-height:1.45}'
    + '#aud .aud-minis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}'
    + '#aud .aud-mini{background:#fff;border:1px solid var(--line);border-radius:var(--r-md);padding:15px 14px;text-align:center}'
    + '#aud .aud-n{font-size:19px;font-weight:800;letter-spacing:-.01em}'
    + '#aud .aud-u{font-size:12px;color:var(--muted2);font-weight:600}'
    + '#aud .aud-t{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:4px;line-height:1.3}'
    + '#aud .aud-sec{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);overflow:hidden}'
    + '#aud .aud-sh{display:flex;align-items:center;gap:12px;padding:17px 22px;border-bottom:1px solid var(--line)}'
    + '#aud .aud-ic{width:32px;height:32px;border-radius:10px;background:var(--green-bg);color:var(--green-tx);display:grid;place-items:center;font-weight:800;font-size:15px;flex:none}'
    + '#aud .aud-sh h2{font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--ink);margin:0}'
    + '#aud .aud-desc{font-size:12px;color:var(--muted);font-weight:450;margin-top:2px;line-height:1.35}'
    + '#aud .aud-tot{margin-left:auto;font-size:14px;font-weight:800;color:var(--green-tx);background:var(--green-bg);border:1px solid rgba(30,158,106,.22);padding:6px 13px;border-radius:999px;white-space:nowrap}'
    + '#aud .aud-intro{padding:15px 22px 4px;font-size:13px;line-height:1.5;color:#3a4150}'
    + '#aud table{width:100%;border-collapse:collapse;font-size:13.5px}'
    + '#aud thead th{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted2);font-weight:700;text-align:right;padding:13px 22px 8px}'
    + '#aud thead th:first-child{text-align:left}'
    + '#aud tbody td{padding:13px 22px;border-top:1px solid var(--line);text-align:right}'
    + '#aud tbody td:first-child{text-align:left}'
    + '#aud .aud-prod{font-weight:700;letter-spacing:-.01em}'
    + '#aud .aud-cip{font-size:11.5px;color:var(--muted2);font-weight:500;margin-top:1px}'
    + '#aud .aud-gain{font-weight:800;color:var(--green-tx)}'
    + '#aud .aud-foot-row td{border-top:2px solid var(--line2);font-weight:800;background:var(--paper)}'
    + '#aud .aud-verif{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:20px 22px;display:flex;gap:15px;align-items:center}'
    + '#aud .aud-vic{width:40px;height:40px;border-radius:11px;background:rgba(0,80,230,.09);color:var(--ip);display:grid;place-items:center;font-size:19px;flex:none}'
    + '#aud .aud-verif h3{margin:0 0 3px;font-size:15px;font-weight:800;color:var(--ink)}'
    + '#aud .aud-verif p{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}'
    + '#aud .aud-fo{margin-top:6px;text-align:center;color:var(--muted2);font-size:11.5px;line-height:1.6;padding-bottom:10px}'
    + '#aud .aud-fo b{color:var(--ip)}'
    + '#aud .aud-empty{padding:34px;text-align:center;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:var(--r)}'
    + '#aud .aud-imp{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);margin-top:16px;padding:22px}'
    + '#aud .aud-imp-head{display:flex;gap:14px;align-items:flex-start}'
    + '#aud .aud-vic2{width:38px;height:38px;border-radius:11px;background:rgba(0,80,230,.09);color:var(--ip);display:grid;place-items:center;font-size:18px;flex:none}'
    + '#aud .aud-imp-head b{font-size:15px}'
    + '#aud .aud-imp-d{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.5}'
    + '#aud .aud-imp-btn{margin-top:16px;display:inline-block;cursor:pointer}'
    + '#aud .aud-imp-load{margin-top:14px;font-size:13px;color:var(--muted)}'
    + '#aud .aud-imp-err{margin-top:14px;font-size:13px;color:#C7283D;background:rgba(224,85,110,.08);border:1px solid rgba(224,85,110,.22);border-radius:12px;padding:12px 14px}'
    + '#aud .aud-imp-out{margin-top:16px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-md);padding:18px}'
    + '#aud .aud-imp-file{font-size:12px;color:var(--muted2);font-weight:600;margin-bottom:8px}'
    + '#aud .aud-imp-big{font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.35}'
    + '#aud .aud-imp-big .aud-gain{font-size:22px}'
    + '#aud .aud-imp-rate{font-size:13.5px;color:#3a4150;margin-top:6px}'
    + '#aud .aud-imp-note{font-size:11.5px;color:var(--muted2);margin-top:8px}'
    + '@media(max-width:600px){#aud .aud-minis{grid-template-columns:1fr}'
    + '#aud .aud-preview-lbl::before,#aud .aud-preview-lbl::after{display:none}'
    + '#aud thead{display:none}#aud tbody td{display:block;text-align:left;padding:3px 18px;border:none}'
    + '#aud tbody tr{display:block;border-top:1px solid var(--line);padding:11px 0}'
    + '#aud td[data-l]::before{content:attr(data-l);display:inline-block;min-width:120px;color:var(--muted2);font-size:11px;font-weight:700;text-transform:uppercase}}';
})();
