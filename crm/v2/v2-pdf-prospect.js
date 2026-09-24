/* ═══════════════════════════════════════════════════════════════════
   PDF remis à un PROSPECT — 5 styles au choix (Will, 23/09/2026 : « on les
   met tous, l'équipe choisit celui qu'elle préfère »). Le choix est retenu
   sur l'appareil et sert aussi à « Transmettre ».
   24/09/2026 : aussi pour un CLIENT (o.client) — récap, ce qu'elle commande,
   puis ses opportunités, chaque partie dans le style choisi.

   Pagination faite ICI, pas par html2pdf : sous Safari, ses coupures de page
   tombaient au mauvais endroit (ligne coupée en bas de page + trou). Chaque
   bloc est mesuré, les pages ont une hauteur fixe, et chaque page est
   photographiée à part (une toile par page : aussi plus sûr sur iPhone).
   Les 5 directions viennent du banc du 23/09 (sorties/pdf-prospect-beau-2026-09-23).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var BLEU = '#0050E6', ENCRE = '#0F1420', GRIS = '#5B6275', PALE = '#8A91A3', FILET = '#E6EAF1';
  // A4 à 96 ppp = 793,7 × 1122,5 px. 1121 laisse la marge d'arrondi qui évite une page de 1 px.
  var PAGE_W = 794, PAGE_H = 1121, PIED = 40;
  var STYLES = [
    { id: 1, nom: 'L\'essentiel' }, { id: 2, nom: 'La couverture' }, { id: 3, nom: 'À la JARVIS' },
    { id: 4, nom: 'Le prix d\'abord' }, { id: 5, nom: 'Par où commencer' }
  ];
  var CLE = 'jarvis.pdfProspectStyle';
  var memo = 1;   // si le stockage du navigateur est bloqué, le choix tient au moins jusqu'au rechargement
  function styleLu() { try { var v = +localStorage.getItem(CLE); if (v >= 1 && v <= 5) return v; } catch (e) {} return memo; }
  function styleEcrit(v) {
    memo = v;
    try { localStorage.setItem(CLE, String(v)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('pdfp-style', { detail: v })); } catch (e) {}
  }

  // Polices libres (OFL) servies par nous — voir fonts/LISEZ-MOI.md. Satoshi et Geist Mono : déjà chargées par l'app.
  var polices = null;
  function chargerPolices() {
    if (!document.getElementById('pdfp-fonts')) {
      var st = document.createElement('style'); st.id = 'pdfp-fonts';
      st.textContent = "@font-face{font-family:PdfArchivo;src:url('fonts/archivo.woff2') format('woff2');font-weight:100 900;font-display:block}" +
        "@font-face{font-family:PdfBricolage;src:url('fonts/bricolage.woff2') format('woff2');font-weight:200 800;font-display:block}" +
        "@font-face{font-family:PdfPlexMono;src:url('fonts/plexmono.woff2') format('woff2');font-weight:400;font-display:block}";
      document.head.appendChild(st);
    }
    if (!polices) {
      polices = Promise.all(['400 12px PdfArchivo', '700 12px PdfArchivo', '800 12px PdfArchivo', '700 12px PdfBricolage', '800 12px PdfBricolage',
        '400 12px PdfPlexMono', '400 12px Satoshi', '700 12px Satoshi', '800 12px Satoshi', '900 12px Satoshi', '400 12px "Geist Mono"', '700 12px "Geist Mono"']
        .map(function (f) { return document.fonts ? document.fonts.load(f).catch(function () {}) : null; }));
    }
    return polices.then(function () { return document.fonts ? document.fonts.ready : null; });
  }

  function eur(v) { if (v == null) return '—'; var s = v.toFixed(2).split('.'); return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + s[1] + ' €'; }
  function nb(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // « KARDEGIC 75MG PDR SACH 30 » → marque en gras, le reste en clair
  function nom(d) { var t = String(d).split(' '), i = 1; while (i < t.length && !/\d/.test(t[i]) && t[i].length > 2 && i < 3) i++; return { m: t.slice(0, i).join(' '), r: t.slice(i).join(' ') }; }
  function baisse(r) { return r.ppht != null && r.net != null && r.ppht > r.net + 0.004; }
  var FROID = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0086A3" stroke-width="2.4" stroke-linecap="round" style="vertical-align:-1px"><path d="M12 2v20M4 7l16 10M20 7L4 17"/></svg>';
  function tags(r, style) {
    var o = '';
    if (r.offre) o += ' <span style="' + style + ';color:' + BLEU + ';border-color:#BFD2FA">OFFRE</span>';
    if (r.froid) o += ' <span style="' + style + ';color:#0086A3;border-color:#B5E3EE">' + FROID + ' FROID</span>';
    return o;
  }
  function refPhrase(c) { return c.reseau ? 'les ' + nb(c.panel) + ' pharmacies du réseau Intégral Pharma' : 'les ' + nb(c.panel) + ' pharmacies ' + esc(c.ref) + ' clientes d\'Intégral Pharma'; }
  function LOGO(bg, fg) { return '<div style="width:30px;height:30px;border-radius:8px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-weight:900;color:' + fg + ';font-size:14px;letter-spacing:-.5px">IP</div>'; }
  function num2(i) { return (i < 9 ? '0' : '') + (i + 1); }

  // Données de l'app ({cat, rows:[{designation, prix_ht, prix_ip, sortie…}]}) → forme du banc
  function contexte(data, o) {
    var cats = (data.cats || []).map(function (k) {
      return { label: k.cat.label, sub: k.cat.sub || '', color: k.cat.color || BLEU, rows: k.rows.map(function (r) {
        return { d: r.designation || String(r.cip), ppht: r.prix_ht > 0 ? r.prix_ht : null, net: r.prix_ip > 0 ? r.prix_ip : null, n: r.sortie || 0, froid: !!r.froid, offre: !!r.offre };
      }) };
    }).filter(function (k) { return k.rows.length; });
    var tot = cats.reduce(function (a, k) { return a + k.rows.length; }, 0);
    return { cats: cats, panel: data.panel > 0 ? data.panel : 0, ref: o.ref || '', nom: o.nom || 'Officine', reseau: !!o.reseau, tot: tot, client: o.client || null, maxPages: o.maxPages || 0,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) };
  }
  function pct(n, c) { return Math.min(100, Math.round(n / c.panel * 100)); }

  // Chaque direction rend : fond, marges, polices, blocs (t: 'head' | 'row' | 'autre', f: n° de famille,
  // mt: espace au-dessus, keep: nb de blocs suivants à garder sur la même page, g: carte qui les regroupe),
  // et pour chaque famille un bloc « suite » posé en haut d'une page qui la continue.

  // ── Client : récap, « ce qu'elle commande », puis l'annonce de ses opportunités ──
  // T = habillage du style : num (police des chiffres), carte (encadré), sec (titre de partie), g (cartes groupées).
  function blocsClient(c, T, blocks, suite) {
    var C = c.client; if (!C) return;
    var N = 'font-family:' + T.num;
    var lab = function (t) { return '<div style="font-size:8.5px;font-weight:700;letter-spacing:.8px;color:' + PALE + ';text-transform:uppercase">' + t + '</div>'; };
    var tuile = function (l, v, col) { return '<div style="flex:1;min-width:0;' + T.carte + ';padding:11px 13px">' + lab(l) + '<div style="' + N + ';font-size:18px;font-weight:700;margin-top:4px;color:' + (col || ENCRE) + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v + '</div></div>'; };
    var maxM = C.mois.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var barres = C.mois.map(function (m) {
      var h = m.ca > 0 ? Math.max(6, Math.round(m.ca / maxM * 60)) : 0, fort = m.ca >= maxM * 0.999;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><div style="' + N + ';font-size:8px;color:' + (fort ? T.acc : GRIS) + ';font-weight:' + (fort ? 700 : 400) + '">' + esc(C.fmtK(m.ca)) + '</div>' +
        '<div style="width:100%;max-width:24px;height:' + h + 'px;border-radius:3px 3px 0 0;background:' + (fort ? T.acc : '#DCE6FB') + '"></div><div style="font-size:8px;font-weight:600;color:' + GRIS + '">' + esc(m.m) + '</div></div>';
    }).join('');
    var tr = C.tranches.map(function (r, i) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0' + (i ? ';border-top:1px solid ' + FILET : '') + ';font-size:10px"><span style="width:7px;height:7px;border-radius:2px;background:' + r.color + '"></span><span style="flex:1;min-width:0;font-weight:600">' + esc(r.label) + '</span>' +
        '<span style="' + N + ';color:' + GRIS + '">' + esc(C.fmtNum(r.refs)) + ' réf.</span><span style="' + N + ';font-weight:700;width:86px;text-align:right">' + esc(C.fmtEur(r.ca)) + '</span></div>';
    }).join('');
    blocks.push({ t: 'autre', mt: T.mt, h: T.sec('Récap de l\'officine', C.code) });
    blocks.push({ t: 'autre', mt: 10, h: '<div style="display:flex;gap:10px">' + tuile('CA cumulé', esc(C.fmtEur(C.ca))) + tuile('Marge nette générée', esc(C.fmtEur(C.marge)), '#1E9E6A') + tuile('Réf. commandées', esc(C.fmtNum(C.refs))) + tuile(C.lieu[0], esc(C.lieu[1]), T.acc) + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:10px"><div style="flex:0 0 250px;' + T.carte + ';padding:11px 13px">' + lab('CA par mois') + '<div style="display:flex;align-items:flex-end;gap:8px;height:84px;margin-top:8px">' + (barres || '—') + '</div></div>' +
      '<div style="flex:1;min-width:0;' + T.carte + ';padding:11px 13px">' + lab('Ce qu\'elle commande déjà · par tranche') + '<div style="margin-top:6px">' + (tr || '<span style="font-size:10px;color:' + PALE + '">Aucune commande identifiée.</span>') + '</div></div></div>' });
    var t = C.top;
    if (t) {
      var sous = 'ses ' + t.rows.length + ' premiers produits' + (t.caTot > 0 ? ' · ' + Math.round(t.caTop / t.caTot * 100) + ' % de son CA' : '') + ' · ' + C.fmtNum(t.nb) + ' réf. commandées';
      var cols = '<div style="display:flex;gap:10px;padding:7px ' + T.px + 'px 3px;font-size:8.5px;font-weight:700;letter-spacing:.7px;color:' + PALE + ';text-transform:uppercase"><div style="width:18px">#</div><div style="flex:1">Produit</div><div style="width:120px">Famille</div><div style="width:44px;text-align:right">Boîtes</div><div style="width:78px;text-align:right">CA HT</div><div style="width:40px;text-align:right">Part</div></div>';
      var g = T.g ? 'top' : undefined;
      blocks.push({ t: 'head', f: 'top', g: g, mt: T.mt, keep: 2, h: T.sec('Ce qu\'elle commande', sous) + cols });
      suite.top = { t: 'autre', g: g, mt: 0, h: T.sec('Ce qu\'elle commande', '', true) + cols };
      t.rows.forEach(function (r, i) {
        var n = nom(r.designation), k = r.cat;
        blocks.push({ t: 'row', f: 'top', g: g, mt: 0, h: '<div style="display:flex;align-items:center;gap:10px;padding:6px ' + T.px + 'px;border-top:1px solid ' + FILET + (T.zebre && i % 2 ? ';background:#F6F8FC' : '') + '">' +
          '<div style="width:18px;' + N + ';font-size:9px;color:' + PALE + '">' + (i + 1) + '</div>' +
          '<div style="flex:1;min-width:0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>' + esc(n.m) + '</b> <span style="color:' + GRIS + '">' + esc(n.r) + '</span></div>' +
          '<div style="width:120px;font-size:9.5px;color:' + GRIS + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:5px;background:' + (k ? k.color : '#C9CFDA') + '"></span>' + esc(k ? k.label : 'Autres') + '</div>' +
          '<div style="width:44px;text-align:right;' + N + ';font-size:10px">' + esc(C.fmtNum(r.qte)) + '</div>' +
          '<div style="width:78px;text-align:right;' + N + ';font-size:11px;font-weight:700;white-space:nowrap">' + esc(C.fmtEur(r.ca)) + '</div>' +
          '<div style="width:40px;text-align:right;' + N + ';font-size:9.5px;color:' + GRIS + '">' + (t.caTot > 0 ? (r.ca / t.caTot * 100).toFixed(1).replace('.', ',') + ' %' : '—') + '</div></div>' });
      });
    }
    blocks.push({ t: 'autre', mt: T.mt + 6, keep: 1, h: '<div style="font-size:11px;font-weight:700;letter-spacing:1.3px;color:' + T.acc + ';text-transform:uppercase">Ses opportunités d\'achat</div>' +
      '<div style="margin-top:5px;font-size:12.5px;line-height:1.45;color:' + GRIS + ';max-width:600px">' + nb(c.tot) + ' produits commandés par ' + refPhrase(c) + ' qu\'elle ne commande pas encore, famille par famille, avec leur prix net.</div>' });
  }

  // ───────── 1 · L'ESSENTIEL — blanc, air, Archivo, une seule couleur
  function v1(c) {
    var blocks = [], suite = {};
    var entete = function (k, ki, s) {
      return '<div style="display:flex;align-items:baseline;gap:12px;border-bottom:2px solid ' + ENCRE + ';padding-bottom:7px">' +
        '<span style="font-size:11px;font-weight:700;color:' + BLEU + '">' + num2(ki) + '</span>' +
        '<span style="font-size:17px;font-weight:800;letter-spacing:-.3px">' + esc(k.label) + (s ? ' <span style="font-weight:600;color:' + PALE + ';font-size:13px">(suite)</span>' : '') + '</span>' +
        '<span style="font-size:11px;color:' + GRIS + '">' + esc(k.sub) + '</span>' +
        '<span style="margin-left:auto;font-size:10px;color:' + PALE + '">' + k.rows.length + ' produits</span></div>' +
        '<div style="display:flex;gap:14px;padding:6px 0 2px;font-size:8.5px;font-weight:700;letter-spacing:.8px;color:' + PALE + ';text-transform:uppercase"><div style="flex:1">Produit</div><div style="width:112px">Part du réseau</div><div style="width:62px;text-align:right">Tarif</div><div style="width:74px;text-align:right;color:' + BLEU + '">Prix net</div></div>';
    };
    blocks.push({ t: 'autre', mt: 0, h:
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;align-items:center;gap:10px">' + LOGO(BLEU, '#fff') + '<span style="font-size:14px;font-weight:800">Intégral Pharma</span></div>' +
        '<span style="font-size:10px;color:' + GRIS + '">Édité le ' + c.date + '</span></div>' +
      '<div style="margin-top:34px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:' + BLEU + ';text-transform:uppercase">Sélection préparée pour ' + esc(c.nom) + '</div>' +
      '<div style="margin-top:8px;font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.05;max-width:600px">' + (c.client ? 'Ses achats et ses opportunités' : c.reseau ? 'Les produits qui tournent le plus dans le réseau' : 'Ce que commandent les pharmacies ' + esc(c.ref)) + '</div>' +
      '<div style="margin-top:12px;font-size:13px;line-height:1.5;color:' + GRIS + ';max-width:560px">' + (c.client ? 'Ce qu\'elle commande aujourd\'hui, puis ' + nb(c.tot) + ' produits commandés par ' + refPhrase(c) + ' qu\'elle n\'a pas encore, avec leur prix net.' : nb(c.tot) + ' références, commandées chaque mois par ' + refPhrase(c) + ', avec leur prix net.') + '</div>' +
      '<div style="display:flex;margin-top:24px;border-top:1px solid ' + FILET + ';border-bottom:1px solid ' + FILET + '">' +
        [[nb(c.tot), c.client ? 'opportunités' : 'produits'], [nb(c.panel), 'pharmacies de référence'], [String(c.cats.length), 'familles']].map(function (x, i) { return '<div style="flex:1;padding:14px 0' + (i ? ';padding-left:18px;border-left:1px solid ' + FILET : '') + '"><div style="font-size:26px;font-weight:800;letter-spacing:-.6px">' + x[0] + '</div><div style="font-size:10.5px;color:' + GRIS + ';margin-top:2px">' + x[1] + '</div></div>'; }).join('') +
      '</div>' });
    blocsClient(c, { num: 'PdfArchivo,system-ui,sans-serif', acc: BLEU, carte: 'border:1px solid ' + FILET + ';border-radius:4px', px: 0, mt: 30,
      sec: function (l, sub, su) { return '<div style="display:flex;align-items:baseline;gap:12px;border-bottom:2px solid ' + ENCRE + ';padding-bottom:7px"><span style="font-size:17px;font-weight:800;letter-spacing:-.3px">' + esc(l) + (su ? ' <span style="font-weight:600;color:' + PALE + ';font-size:13px">(suite)</span>' : '') + '</span><span style="font-size:11px;color:' + GRIS + '">' + esc(sub) + '</span></div>'; } }, blocks, suite);
    c.cats.forEach(function (k, ki) {
      blocks.push({ t: 'head', f: ki, mt: 26, keep: 2, h: entete(k, ki) });
      suite[ki] = { t: 'autre', mt: 0, h: entete(k, ki, true) };
      k.rows.forEach(function (r) {
        var n = nom(r.d), p = pct(r.n, c), b = baisse(r);
        blocks.push({ t: 'row', f: ki, mt: 0, h: '<div style="display:flex;align-items:center;gap:14px;padding:7px 0;border-bottom:1px solid ' + FILET + '">' +
          '<div style="flex:1;min-width:0;font-size:11.5px;line-height:1.3;color:' + ENCRE + '"><b style="font-weight:700">' + esc(n.m) + '</b> <span style="color:' + GRIS + '">' + esc(n.r) + '</span>' + tags(r, 'font-size:7.5px;font-weight:700;letter-spacing:.4px;border:1px solid;border-radius:4px;padding:1px 4px;margin-left:4px;vertical-align:1px') + '</div>' +
          '<div style="width:112px;display:flex;align-items:center;gap:7px"><div style="flex:1;height:4px;border-radius:2px;background:#EDF1F7"><div style="height:4px;border-radius:2px;width:' + p + '%;background:#80A7F2"></div></div><span style="font-size:10px;color:' + GRIS + ';width:30px;text-align:right">' + p + ' %</span></div>' +
          '<div style="width:62px;text-align:right;font-size:10px;color:' + PALE + ';text-decoration:line-through">' + (b ? eur(r.ppht) : '') + '</div>' +
          '<div style="width:74px;text-align:right;font-size:14px;font-weight:800;color:' + BLEU + '">' + eur(r.net) + '</div></div>' });
      });
    });
    blocks.push({ t: 'autre', mt: 26, h: '<div style="font-size:9.5px;line-height:1.5;color:' + PALE + '">Prix nets HT indicatifs au ' + c.date + '. Part du réseau : proportion des ' + refPhrase(c) + ' qui commandent le produit.<br><b style="color:' + GRIS + '">Intégral Pharma</b> · groupe de grossistes-répartiteurs</div>' });
    return { bg: '#fff', padT: 34, padX: 48, base: 'font-family:PdfArchivo,system-ui,sans-serif', blocks: blocks, suite: suite };
  }

  // ───────── 2 · LA COUVERTURE — page 1 bleu profond éclairé, intérieur clair
  function v2(c) {
    var M = "'Geist Mono',ui-monospace,monospace", blocks = [], suite = {};
    var somLigne = function (n, l, sub, v) { return '<div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14)"><span style="font-family:' + M + ';font-size:11px;color:#8FB0F5">' + n + '</span><span style="font-size:15px;font-weight:700;color:#fff">' + esc(l) + '</span><span style="font-size:11px;color:#A9C2F5">' + esc(sub) + '</span><span style="margin-left:auto;font-family:' + M + ';font-size:12px;color:#fff">' + v + '</span></div>'; };
    var som = (c.client && c.client.top ? somLigne('—', 'Ce qu\'elle commande', 'ses premiers produits', c.client.top.rows.length) : '') + c.cats.map(function (k, i) {
      return '<div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.14)"><span style="font-family:' + M + ';font-size:11px;color:#8FB0F5">' + num2(i) + '</span><span style="font-size:15px;font-weight:700;color:#fff">' + esc(k.label) + '</span><span style="font-size:11px;color:#A9C2F5">' + esc(k.sub) + '</span><span style="margin-left:auto;font-family:' + M + ';font-size:12px;color:#fff">' + k.rows.length + '</span></div>';
    }).join('');
    var cover = '<div style="position:absolute;left:22px;right:22px;top:22px;bottom:22px;border-radius:22px;overflow:hidden;background:radial-gradient(120% 80% at 85% 0%,#3B7BFF 0%,#0050E6 30%,#0A2F8F 70%,#071C57 100%);color:#fff">' +
      '<div style="position:absolute;right:-120px;top:-140px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.28),rgba(255,255,255,0) 65%)"></div>' +
      '<div style="position:relative;padding:44px 48px">' +
        '<div style="display:flex;align-items:center;gap:11px">' + LOGO('#fff', BLEU) + '<span style="font-size:15px;font-weight:800">Intégral Pharma</span><span style="margin-left:auto;font-size:11px;color:#A9C2F5">' + c.date + '</span></div>' +
        '<div style="margin-top:' + (c.cats.length > (c.client ? 8 : 9) ? 90 : 150) + 'px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#A9C2F5">Préparé pour ' + esc(c.nom) + '</div>' +
        '<div style="margin-top:12px;font-size:52px;font-weight:900;letter-spacing:-1.8px;line-height:1">' + (c.client ? 'Ses achats,<br>ses opportunités' : c.reseau ? 'Meilleures<br>rotations du réseau' : 'La sélection<br>' + esc(c.ref)) + '</div>' +
        '<div style="margin-top:18px;font-size:15px;line-height:1.5;color:#D6E2FB;max-width:520px">' + (c.client ? 'Ce qu\'elle commande, puis ' + nb(c.tot) + ' produits commandés par ' + refPhrase(c) + ' qu\'elle n\'a pas encore, avec leur prix net.' : nb(c.tot) + ' produits commandés par ' + refPhrase(c) + ', classés par famille, avec leur prix net.') + '</div>' +
        '<div style="margin-top:' + (c.cats.length > (c.client ? 8 : 9) ? 36 : 60) + 'px;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8FB0F5;margin-bottom:4px">Au sommaire</div>' + som +
      '</div></div>';
    var TH = 'padding:6px 10px;font-size:8.5px;font-weight:700;letter-spacing:.8px;color:' + GRIS;
    var entete = function (k, ki, s) {
      return '<div style="display:flex;align-items:baseline;gap:10px;padding:0 4px 8px"><span style="font-family:' + M + ';font-size:11px;color:' + BLEU + '">' + num2(ki) + '</span><span style="font-size:18px;font-weight:800;letter-spacing:-.3px">' + esc(k.label) + (s ? ' <span style="font-weight:600;color:' + PALE + ';font-size:13px">(suite)</span>' : '') + '</span><span style="font-size:11px;color:' + GRIS + '">' + esc(k.sub) + '</span></div>' +
        '<div style="display:flex;background:#EAF0FD;border-radius:10px 10px 0 0"><div style="flex:1;' + TH + '">PRODUIT</div><div style="width:92px;text-align:right;' + TH + '">PHARMACIES</div><div style="width:80px;text-align:right;' + TH + '">TARIF</div><div style="width:92px;text-align:right;' + TH + ';color:' + BLEU + '">PRIX NET</div></div>';
    };
    blocsClient(c, { num: M, acc: BLEU, carte: 'background:#F6F8FC;border-radius:12px', px: 10, mt: 22, zebre: true,
      sec: function (l, sub, su) { return '<div style="display:flex;align-items:baseline;gap:10px;padding:0 4px 8px"><span style="font-size:18px;font-weight:800;letter-spacing:-.3px">' + esc(l) + (su ? ' <span style="font-weight:600;color:' + PALE + ';font-size:13px">(suite)</span>' : '') + '</span><span style="font-size:11px;color:' + GRIS + '">' + esc(sub) + '</span></div>'; } }, blocks, suite);
    c.cats.forEach(function (k, ki) {
      blocks.push({ t: 'head', f: ki, mt: ki || c.client ? 22 : 6, keep: 2, h: entete(k, ki) });
      suite[ki] = { t: 'autre', mt: 0, h: entete(k, ki, true) };
      k.rows.forEach(function (r, i) {
        var n = nom(r.d);
        blocks.push({ t: 'row', f: ki, mt: 0, h: '<div style="display:flex;align-items:center;background:' + (i % 2 ? '#F6F8FC' : '#fff') + '"><div style="flex:1;min-width:0;padding:7px 10px;font-size:11px"><b>' + esc(n.m) + '</b> <span style="color:' + GRIS + '">' + esc(n.r) + '</span>' + tags(r, 'font-size:7.5px;font-weight:800;border:1px solid;border-radius:4px;padding:1px 4px;margin-left:4px') + '</div>' +
          '<div style="width:92px;padding:7px 10px;text-align:right;font-family:' + M + ';font-size:10px;color:' + GRIS + '">' + nb(r.n) + '</div>' +
          '<div style="width:80px;padding:7px 10px;text-align:right;font-family:' + M + ';font-size:10px;color:' + PALE + '">' + (baisse(r) ? '<span style="text-decoration:line-through">' + eur(r.ppht) + '</span>' : '') + '</div>' +
          '<div style="width:92px;padding:7px 10px;text-align:right;font-family:' + M + ';font-size:12.5px;font-weight:700;color:' + BLEU + '">' + eur(r.net) + '</div></div>' });
      });
    });
    blocks.push({ t: 'autre', mt: 22, h: '<div style="font-size:9.5px;line-height:1.5;color:' + PALE + '">Prix nets HT indicatifs au ' + c.date + ' · Pharmacies : nombre des ' + refPhrase(c) + ' qui commandent le produit. <b style="color:' + GRIS + '">Intégral Pharma</b>, groupe de grossistes-répartiteurs.</div>' });
    return { bg: '#fff', padT: 30, padX: 40, base: 'font-family:Satoshi,system-ui,sans-serif', cover: cover, blocks: blocks, suite: suite };
  }

  // ───────── 3 · À LA JARVIS — le CRM : fond gris-bleu, cartes blanches, tuiles de chiffres
  function v3(c) {
    var M = "'Geist Mono',ui-monospace,monospace", blocks = [], suite = {};
    var tile = function (l, v, s) { return '<div style="flex:1;background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,20,32,.06)"><div style="font-size:9px;font-weight:700;letter-spacing:.9px;color:' + PALE + ';text-transform:uppercase">' + l + '</div><div style="font-family:' + M + ';font-size:24px;font-weight:700;margin-top:4px;color:' + ENCRE + '">' + v + '</div><div style="font-size:10px;color:' + GRIS + ';margin-top:2px">' + s + '</div></div>'; };
    blocks.push({ t: 'autre', mt: 0, h: '<div style="background:#fff;border-radius:18px;padding:20px 22px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 2px rgba(15,20,32,.06)">' + LOGO(BLEU, '#fff') +
      '<div><div style="font-size:20px;font-weight:900;letter-spacing:-.4px">' + (c.client ? 'Ses achats · ses opportunités' : c.reseau ? 'Meilleures rotations du réseau' : 'Sélection ' + esc(c.ref)) + '</div><div style="font-size:11px;color:' + GRIS + ';margin-top:2px">Pour ' + esc(c.nom) + ' · ' + c.date + '</div></div>' +
      '<div style="margin-left:auto;font-size:10px;color:' + GRIS + ';text-align:right">Intégral Pharma<br>groupe de grossistes-répartiteurs</div></div>' });
    blocks.push({ t: 'autre', mt: 12, h: '<div style="display:flex;gap:12px">' + tile(c.client ? 'Opportunités' : 'Produits', nb(c.tot), c.client ? 'qu\'elle n\'a pas encore' : 'sélectionnés pour vous') + tile('Pharmacies', nb(c.panel), c.reseau ? 'dans le réseau' : 'du groupement ' + esc(c.ref)) + tile('Familles', c.cats.length, 'du petit prix au froid') + '</div>' });
    var entete = function (k, s) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px 9px"><span style="width:9px;height:9px;border-radius:3px;background:' + k.color + '"></span><span style="font-size:14px;font-weight:800">' + esc(k.label) + (s ? ' <span style="font-weight:600;color:' + PALE + ';font-size:11px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:' + GRIS + '">' + esc(k.sub) + '</span><span style="margin-left:auto;font-size:9px;font-weight:700;letter-spacing:.8px;color:' + PALE + '">RÉSEAU · TARIF · <span style="color:' + ENCRE + '">PRIX NET</span></span></div>';
    };
    blocsClient(c, { num: M, acc: BLEU, carte: 'background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(15,20,32,.06)', px: 14, mt: 14, g: true,
      sec: function (l, sub, su) { return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px 4px"><span style="width:9px;height:9px;border-radius:3px;background:' + BLEU + '"></span><span style="font-size:14px;font-weight:800">' + esc(l) + (su ? ' <span style="font-weight:600;color:' + PALE + ';font-size:11px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:' + GRIS + '">' + esc(sub) + '</span></div>'; } }, blocks, suite);
    c.cats.forEach(function (k, ki) {
      var g = 'k' + ki;
      blocks.push({ t: 'head', f: ki, g: g, mt: 14, keep: 2, h: entete(k) });
      suite[ki] = { t: 'autre', g: g, mt: 0, h: entete(k, true) };
      k.rows.forEach(function (r) {
        var n = nom(r.d), p = pct(r.n, c);
        blocks.push({ t: 'row', f: ki, g: g, mt: 0, h: '<div style="display:flex;align-items:center;gap:10px;padding:6px 14px;border-top:1px solid #EEF1F6">' +
          '<div style="flex:1;min-width:0;font-size:11px"><b>' + esc(n.m) + '</b> <span style="color:' + GRIS + '">' + esc(n.r) + '</span>' + tags(r, 'font-size:7.5px;font-weight:800;border:1px solid;border-radius:10px;padding:1px 5px;margin-left:4px') + '</div>' +
          '<div style="width:48px;text-align:center"><span style="display:inline-block;min-width:34px;font-family:' + M + ';font-size:9.5px;font-weight:600;color:' + (p >= 50 ? '#fff' : BLEU) + ';background:' + (p >= 50 ? BLEU : '#E9F0FF') + ';border-radius:10px;padding:2px 6px">' + p + '%</span></div>' +
          '<div style="width:70px;text-align:right;font-family:' + M + ';font-size:9.5px;color:' + PALE + '">' + (baisse(r) ? '<span style="text-decoration:line-through">' + eur(r.ppht) + '</span>' : '') + '</div>' +
          '<div style="width:80px;text-align:right;font-family:' + M + ';font-size:12px;font-weight:700;color:' + ENCRE + '">' + eur(r.net) + '</div></div>' });
      });
    });
    blocks.push({ t: 'autre', mt: 14, h: '<div style="font-size:9.5px;line-height:1.5;color:' + GRIS + '">Prix nets HT indicatifs au ' + c.date + '. Le pourcentage indique la part des ' + refPhrase(c) + ' qui commandent le produit.</div>' });
    return { bg: '#E4E9F1', padT: 26, padX: 30, base: 'font-family:Satoshi,system-ui,sans-serif', groupe: 'background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(15,20,32,.06);overflow:hidden', blocks: blocks, suite: suite };
  }

  // ───────── 4 · LE PRIX D'ABORD — tarif grossiste sur deux colonnes, compact (lecture ligne par ligne)
  function v4(c) {
    var M = 'PdfPlexMono,ui-monospace,monospace', blocks = [], suite = {};
    var item = function (r) {
      if (!r) return '';
      var n = nom(r.d), p = pct(r.n, c);
      return '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dotted #CBD2DE">' +
        '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:700;line-height:1.2">' + esc(n.m) + tags(r, 'font-size:7px;font-weight:700;border:1px solid;border-radius:3px;padding:0 3px;margin-left:3px') + '</div><div style="font-size:9.5px;color:' + GRIS + ';line-height:1.3">' + esc(n.r) + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:13px;font-weight:800;color:' + BLEU + ';white-space:nowrap">' + eur(r.net) + '</div><div style="font-family:' + M + ';font-size:8.5px;color:' + PALE + ';white-space:nowrap">' + (baisse(r) ? '<span style="text-decoration:line-through">' + eur(r.ppht) + '</span> · ' : '') + p + ' %</div></div></div>';
    };
    var barre = function (k, s) { return '<div style="background:' + ENCRE + ';color:#fff;border-radius:8px;padding:8px 12px;display:flex;align-items:baseline;gap:10px"><span style="font-size:14px;font-weight:800">' + esc(k.label) + (s ? ' <span style="font-weight:600;color:#AEB6C6;font-size:11px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:#AEB6C6">' + esc(k.sub) + '</span><span style="margin-left:auto;font-family:' + M + ';font-size:10px;color:#AEB6C6">' + k.rows.length + ' produits</span></div>'; };
    blocks.push({ t: 'autre', mt: 0, h: '<div style="display:flex;align-items:flex-end;gap:20px;border-bottom:3px solid ' + BLEU + ';padding-bottom:14px">' +
      '<div><div style="font-size:11px;font-weight:700;color:' + BLEU + ';letter-spacing:.4px">INTÉGRAL PHARMA · TARIF NET</div><div style="font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.05;margin-top:6px">' + (c.client ? 'Ses achats, ses opportunités' : c.reseau ? 'Meilleures rotations' : 'Sélection ' + esc(c.ref)) + '</div></div>' +
      '<div style="margin-left:auto;text-align:right;font-size:11px;line-height:1.45;color:' + GRIS + '"><b style="color:' + ENCRE + '">' + esc(c.nom) + '</b><br>' + nb(c.tot) + (c.client ? ' opportunités · ' : ' produits · ') + c.date + '</div></div>' });
    blocks.push({ t: 'autre', mt: 10, h: '<div style="font-size:10px;color:' + GRIS + '">En bleu, le prix net. En dessous : le tarif barré, puis la part des ' + refPhrase(c) + ' qui le commandent.</div>' });
    blocsClient(c, { num: M, acc: BLEU, carte: 'border:1px solid #CBD2DE;border-radius:8px', px: 4, mt: 20,
      sec: function (l, sub, su) { return '<div style="background:' + ENCRE + ';color:#fff;border-radius:8px;padding:8px 12px;display:flex;align-items:baseline;gap:10px"><span style="font-size:14px;font-weight:800">' + esc(l) + (su ? ' <span style="font-weight:600;color:#AEB6C6;font-size:11px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:#AEB6C6">' + esc(sub) + '</span></div>'; } }, blocks, suite);
    c.cats.forEach(function (k, ki) {
      blocks.push({ t: 'head', f: ki, mt: 20, keep: 2, h: barre(k) });
      suite[ki] = { t: 'autre', mt: 0, h: barre(k, true) };
      for (var i = 0; i < k.rows.length; i += 2) {
        blocks.push({ t: 'row', f: ki, mt: 0, h: '<div style="display:flex;gap:26px"><div style="flex:1;min-width:0">' + item(k.rows[i]) + '</div><div style="flex:1;min-width:0">' + item(k.rows[i + 1]) + '</div></div>' });
      }
    });
    blocks.push({ t: 'autre', mt: 20, h: '<div style="font-size:9.5px;color:' + PALE + '">Prix nets HT indicatifs au ' + c.date + ' · Intégral Pharma, groupe de grossistes-répartiteurs.</div>' });
    return { bg: '#fff', padT: 30, padX: 40, base: 'font-family:PdfBricolage,system-ui,sans-serif', blocks: blocks, suite: suite };
  }

  // ───────── 5 · PAR OÙ COMMENCER — les 12 incontournables en cartes, puis la liste complète
  function v5(c) {
    var blocks = [], suite = {};
    var all = []; c.cats.forEach(function (k) { k.rows.forEach(function (r) { all.push({ r: r, k: k }); }); });
    all.sort(function (a, b) { return b.r.n - a.r.n; });
    var top = all.slice(0, 12);
    var carte = function (x, i) {
      var n = nom(x.r.d), p = pct(x.r.n, c);
      return '<div style="flex:0 0 calc(33.33% - 8px);box-sizing:border-box;background:#fff;border:1px solid ' + FILET + ';border-radius:14px;padding:12px 14px;box-shadow:0 6px 16px -10px rgba(0,50,160,.25)">' +
        '<div style="display:flex;justify-content:space-between;gap:6px;font-size:9px;font-weight:700;color:' + PALE + '"><span>N° ' + (i + 1) + '</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.k.label.replace('Princeps · ', '')) + '</span></div>' +
        '<div style="margin-top:8px;font-size:14px;font-weight:800;letter-spacing:-.2px;line-height:1.1">' + esc(n.m) + '</div><div style="font-size:9.5px;color:' + GRIS + ';margin-top:2px;height:24px;overflow:hidden">' + esc(n.r) + '</div>' +
        '<div style="display:flex;align-items:baseline;gap:6px;margin-top:6px"><span style="font-size:18px;font-weight:800;color:' + BLEU + '">' + eur(x.r.net) + '</span>' + (baisse(x.r) ? '<span style="font-size:9.5px;color:' + PALE + ';text-decoration:line-through">' + eur(x.r.ppht) + '</span>' : '') + '</div>' +
        '<div style="margin-top:8px;height:4px;border-radius:2px;background:#EDF1F7"><div style="height:4px;border-radius:2px;background:' + BLEU + ';width:' + p + '%"></div></div><div style="font-size:9px;color:' + GRIS + ';margin-top:4px">commandé par ' + p + ' % des pharmacies</div></div>';
    };
    var cartes = ''; for (var i = 0; i < top.length; i += 3) cartes += '<div style="display:flex;gap:12px;margin-top:12px">' + top.slice(i, i + 3).map(function (x, j) { return carte(x, i + j); }).join('') + '</div>';
    // Bandeau d'ouverture : il déborde dans la marge du haut (-30 px) pour que sa lumière parte du bord.
    blocks.push({ t: 'autre', mt: 0, h: '<div style="margin:-30px -40px 0;padding:30px 40px 26px;background:linear-gradient(180deg,#EEF3FF 0%,#FFFFFF 100%)">' +
      '<div style="display:flex;align-items:center;gap:10px">' + LOGO(BLEU, '#fff') + '<span style="font-size:14px;font-weight:800">Intégral Pharma</span><span style="margin-left:auto;font-size:10.5px;color:' + GRIS + '">' + esc(c.nom) + ' · ' + c.date + '</span></div>' +
      '<div style="margin-top:26px;font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.05">Par où commencer</div>' +
      '<div style="margin-top:8px;font-size:12.5px;color:' + GRIS + ';max-width:560px;line-height:1.5">' + (c.client ? 'Les ' + top.length + ' produits qu\'elle n\'a pas encore et que commandent le plus ' + refPhrase(c) + '. Suivent ce qu\'elle commande aujourd\'hui, puis ses ' + nb(c.tot) + ' opportunités, famille par famille.' : 'Les ' + top.length + ' produits les plus commandés par ' + refPhrase(c) + '. La liste complète des ' + nb(c.tot) + ' produits suit, famille par famille.') + '</div>' +
      cartes + '</div>' });
    var entete = function (k, s) { return '<div style="display:flex;align-items:baseline;gap:10px;padding-bottom:6px;border-bottom:2px solid ' + ENCRE + '"><span style="font-size:15px;font-weight:800">' + esc(k.label) + (s ? ' <span style="font-weight:600;color:' + PALE + ';font-size:12px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:' + GRIS + '">' + esc(k.sub) + '</span><span style="margin-left:auto;font-size:9px;font-weight:700;letter-spacing:.7px;color:' + PALE + '">PHARMACIES · TARIF · <span style="color:' + BLEU + '">PRIX NET</span></span></div>'; };
    blocsClient(c, { num: 'PdfArchivo,system-ui,sans-serif', acc: BLEU, carte: 'background:#fff;border:1px solid ' + FILET + ';border-radius:14px;box-shadow:0 6px 16px -10px rgba(0,50,160,.25)', px: 0, mt: 24,
      sec: function (l, sub, su) { return '<div style="display:flex;align-items:baseline;gap:10px;padding-bottom:6px;border-bottom:2px solid ' + ENCRE + '"><span style="font-size:15px;font-weight:800">' + esc(l) + (su ? ' <span style="font-weight:600;color:' + PALE + ';font-size:12px">(suite)</span>' : '') + '</span><span style="font-size:10.5px;color:' + GRIS + '">' + esc(sub) + '</span></div>'; } }, blocks, suite);
    c.cats.forEach(function (k, ki) {
      blocks.push({ t: 'head', f: ki, mt: 20, keep: 2, h: entete(k) });
      suite[ki] = { t: 'autre', mt: 0, h: entete(k, true) };
      k.rows.forEach(function (r) {
        var n = nom(r.d);
        blocks.push({ t: 'row', f: ki, mt: 0, h: '<div style="display:flex;gap:12px;align-items:center;padding:5px 0;border-bottom:1px solid ' + FILET + ';font-size:10.5px"><div style="flex:1;min-width:0"><b>' + esc(n.m) + '</b> <span style="color:' + GRIS + '">' + esc(n.r) + '</span>' + tags(r, 'font-size:7px;font-weight:700;border:1px solid;border-radius:3px;padding:0 3px;margin-left:3px') + '</div><div style="width:60px;text-align:right;color:' + GRIS + '">' + nb(r.n) + '</div><div style="width:62px;text-align:right;color:' + PALE + '">' + (baisse(r) ? '<span style="text-decoration:line-through">' + eur(r.ppht) + '</span>' : '') + '</div><div style="width:72px;text-align:right;font-size:12px;font-weight:800;color:' + BLEU + '">' + eur(r.net) + '</div></div>' });
      });
    });
    blocks.push({ t: 'autre', mt: 20, h: '<div style="font-size:9.5px;line-height:1.5;color:' + PALE + '">Prix nets HT indicatifs au ' + c.date + '. Pharmacies : nombre des ' + refPhrase(c) + ' qui commandent le produit · Intégral Pharma, groupe de grossistes-répartiteurs.</div>' });
    return { bg: '#fff', padT: 30, padX: 40, base: 'font-family:PdfArchivo,system-ui,sans-serif', blocks: blocks, suite: suite };
  }
  var DIR = { 1: v1, 2: v2, 3: v3, 4: v4, 5: v5 };

  // ── Pagination maison ──
  function base(B) { return B.base + ';color:' + ENCRE + ';font-size:11px;line-height:normal;letter-spacing:normal;text-align:left'; }
  function enveloppe(b, mt) { return '<div style="display:flow-root' + (mt ? ';padding-top:' + mt + 'px' : '') + '">' + b.h + '</div>'; }
  function mesurer(B) {
    var tous = B.blocks.concat(Object.keys(B.suite).map(function (k) { return B.suite[k]; }));
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-12000px;top:0;visibility:hidden;pointer-events:none';
    host.innerHTML = '<div style="box-sizing:border-box;width:' + PAGE_W + 'px;padding:0 ' + B.padX + 'px;' + base(B) + '">' +
      tous.map(function (b) { var w = enveloppe(b, 0); return b.g ? '<div style="display:flow-root;' + B.groupe + '">' + w + '</div>' : w; }).join('') + '</div>';
    document.body.appendChild(host);
    var kids = host.firstChild.children;
    tous.forEach(function (b, i) { b._h = kids[i].getBoundingClientRect().height; });
    document.body.removeChild(host);
  }
  function paginer(B) {
    var H = PAGE_H - B.padT - PIED - 2, pages = [], cur = [], used = 0, bl = B.blocks;
    function place(b) { var mt = cur.length ? b.mt : 0; cur.push({ b: b, mt: mt }); used += mt + b._h; }
    for (var i = 0; i < bl.length; i++) {
      var b = bl[i], need = (cur.length ? b.mt : 0) + b._h;
      for (var j = 1; j <= (b.keep || 0) && i + j < bl.length; j++) need += bl[i + j].mt + bl[i + j]._h;
      if (cur.length && used + need > H) { pages.push(cur); cur = []; used = 0; }
      // une famille qui continue sur une nouvelle page reprend son titre, marqué « suite »
      if (!cur.length && b.t === 'row' && i > 0 && bl[i - 1].f === b.f && B.suite[b.f]) place(B.suite[b.f]);
      place(b);
    }
    if (cur.length) pages.push(cur);
    return pages;
  }
  function pageHtml(B, items, num, total, c) {
    var inner = '', i = 0;
    while (i < items.length) {
      var g = items[i].b.g;
      if (g) {
        var run = '', mt0 = items[i].mt, first = true;
        while (i < items.length && items[i].b.g === g) { run += enveloppe(items[i].b, first ? 0 : items[i].mt); first = false; i++; }
        inner += '<div style="display:flow-root;' + (mt0 ? 'margin-top:' + mt0 + 'px;' : '') + B.groupe + '">' + run + '</div>';
      } else { inner += enveloppe(items[i].b, items[i].mt); i++; }
    }
    return '<div style="position:relative;box-sizing:border-box;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;overflow:hidden;background:' + B.bg + ';padding:' + B.padT + 'px ' + B.padX + 'px 0;' + base(B) + '">' +
      '<div style="display:flow-root">' + inner + '</div>' +
      '<div style="position:absolute;left:0;right:0;bottom:16px;text-align:center;font:500 8px/1 Satoshi,system-ui,sans-serif;letter-spacing:.3px;color:' + PALE + '">Intégral Pharma · ' + esc(c.nom) + ' · ' + num + ' / ' + total + '</div></div>';
  }
  function mettreEnPages(c, style) {
    var B = DIR[style](c);
    mesurer(B);
    var pages = paginer(B), total = pages.length + (B.cover ? 1 : 0), out = [];
    if (B.cover) out.push('<div style="position:relative;box-sizing:border-box;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;overflow:hidden;background:#fff;' + base(B) + '">' + B.cover + '</div>');
    pages.forEach(function (p, k) { out.push(pageHtml(B, p, out.length + 1, total, c)); });
    return out;
  }
  // Ne garde que les K produits commandés par le plus de pharmacies (ordre des familles conservé)
  function garder(c, K) {
    var tous = [];
    c.cats.forEach(function (k, ki) { k.rows.forEach(function (r, ri) { tous.push({ n: r.n, ki: ki, ri: ri }); }); });
    tous.sort(function (a, b) { return b.n - a.n || a.ki - b.ki || a.ri - b.ri; });
    var pris = {}; tous.slice(0, K).forEach(function (x) { pris[x.ki + ':' + x.ri] = 1; });
    var d = {}; Object.keys(c).forEach(function (x) { d[x] = c[x]; });
    d.cats = c.cats.map(function (k, ki) {
      var e = {}; Object.keys(k).forEach(function (x) { e[x] = k[x]; });
      e.rows = k.rows.filter(function (r, ri) { return pris[ki + ':' + ri]; });
      return e;
    }).filter(function (k) { return k.rows.length; });
    d.tot = Math.min(K, c.tot);
    return d;
  }
  function construire(c, style) {
    return chargerPolices().then(function () {
      var out = mettreEnPages(c, style);
      // Plafond de pages (Will, 24/09/2026 : « 8-10 pages maximum ») : on retire les produits
      // commandés par le moins de pharmacies jusqu'à tenir dedans (recherche par dichotomie).
      if (!c.maxPages || out.length <= c.maxPages) return out;
      var lo = 1, hi = c.tot - 1, best = mettreEnPages(garder(c, 1), style);
      while (lo <= hi) {
        var mid = (lo + hi) >> 1, essai = mettreEnPages(garder(c, mid), style);
        if (essai.length <= c.maxPages) { best = essai; lo = mid + 1; } else hi = mid - 1;
      }
      return best;
    });
  }

  // ── Fabrication : une photo par page, posée sur une page A4 ──
  function fabriquer(pages, fn, mode, titre) {
    return window.ensureHtml2Pdf().then(chargerPolices).then(function () {
      try { window.scrollTo(0, 0); } catch (e) {}
      var veil = document.createElement('div');
      veil.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483600;display:flex;align-items:center;justify-content:center;font:600 14px Satoshi,system-ui,sans-serif;color:#737A8C';
      veil.textContent = 'Génération du PDF…';
      document.body.appendChild(veil);
      var els = pages.map(function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; });
      var w = window.html2pdf().set({
        filename: fn, margin: 0, image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: [] }
      }).from(els[0]).toPdf();
      els.slice(1).forEach(function (el) {
        w = w.get('pdf').then(function (pdf) { pdf.addPage(); }).from(el).toContainer().toCanvas().toPdf();
      });
      function fin() { if (veil.parentNode) veil.parentNode.removeChild(veil); }
      if (mode === 'blob') {
        return w.outputPdf('blob').then(function (blob) { fin(); return new File([blob], fn, { type: 'application/pdf' }); },
          function (e) { console.error(e); fin(); return null; });
      }
      if (mode === 'share' && V2.shareOrSaveBlob) {
        return w.outputPdf('blob').then(function (blob) { return V2.shareOrSaveBlob(blob, fn, titre); })
          .then(function () { fin(); V2.toast('PDF prêt à partager'); }, function (e) { console.error(e); fin(); V2.toast('Erreur PDF', 'error'); });
      }
      return w.save().then(function () { fin(); V2.toast('PDF téléchargé'); }, function (e) { console.error(e); fin(); V2.toast('Erreur PDF', 'error'); });
    });
  }

  // ── Aperçu : les pages telles qu'elles sortiront, et le choix du style ──
  function css() {
    if (document.getElementById('pdfp-css')) return;
    var st = document.createElement('style'); st.id = 'pdfp-css';
    st.textContent = '#pdfp-modal{z-index:130}.pdfp-styles{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card)}' +
      '.pdfp-styles .pdfp-lbl{font-size:12px;font-weight:700;color:var(--muted);margin-right:2px}' +
      '.pdfp-styles .v2-seg{padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;background:var(--card);color:var(--ip-ink)}' +
      '.pdfp-styles .v2-seg.on{background:var(--ip-blue);color:#fff;border-color:transparent}' +
      '.pdfp-page{margin:0 auto 18px;overflow:hidden;border-radius:6px;box-shadow:0 14px 44px rgba(16,19,28,.2);background:#fff}' +
      '.pdfp-page>div{transform-origin:top left}' +
      '.pdfp-wait{padding:60px 0;text-align:center;color:var(--muted);font-weight:600}';
    document.head.appendChild(st);
  }
  function ajuster() {
    var sc = document.getElementById('pdfp-scroll'); if (!sc) return;
    var s = Math.min(1, (sc.clientWidth - 32) / PAGE_W); if (!(s > 0)) return;
    sc.querySelectorAll('.pdfp-page').forEach(function (p) {
      p.style.width = (PAGE_W * s) + 'px'; p.style.height = (PAGE_H * s) + 'px';
      if (p.firstChild) p.firstChild.style.transform = 'scale(' + s + ')';
    });
  }
  function apercu(c, fn, titre) {
    css();
    var ICO = function (n, t, w) { return V2.ICO ? V2.ICO(n, t, w) : (window.ICO ? window.ICO(n, t, w) : ''); };
    var bd = document.getElementById('pdfp-modal');
    if (!bd) {
      bd = document.createElement('div'); bd.id = 'pdfp-modal'; bd.className = 'prepa-modal';
      bd.innerHTML = '<div class="prepa-dialog" onclick="event.stopPropagation()">' +
        '<div class="prepa-top">' +
          '<div class="prepa-tt">' + ICO('fiche', 17, 2) + ' Aperçu avant impression</div>' +
          '<button class="v2-btn v2-btn-primary" id="pdfp-dl">' + ICO('download', 16) + ' Télécharger</button>' +
          (V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" id="pdfp-sh">' + ICO('spark', 16) + ' Partager</button>' : '') +
          '<button class="prepa-x" id="pdfp-x" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
        '</div>' +
        '<div class="pdfp-styles" id="pdfp-styles"></div>' +
        '<div class="prepa-scroll" id="pdfp-scroll"></div>' +
      '</div>';
      bd.onclick = fermer;
      document.body.appendChild(bd);
      bd.querySelector('#pdfp-x').onclick = fermer;
      window.addEventListener('resize', ajuster);
    }
    var etat = { style: styleLu(), pages: null };
    function boutons() {
      bd.querySelector('#pdfp-styles').innerHTML = '<span class="pdfp-lbl">Style :</span>' + STYLES.map(function (s) {
        return '<button class="v2-seg' + (s.id === etat.style ? ' on' : '') + '" data-s="' + s.id + '">' + s.id + ' · ' + esc(s.nom) + '</button>';
      }).join('');
      bd.querySelectorAll('#pdfp-styles .v2-seg').forEach(function (b) {
        b.onclick = function () { var v = +b.getAttribute('data-s'); if (v === etat.style) return; etat.style = v; styleEcrit(v); rendre(); };
      });
    }
    function rendre() {
      boutons(); etat.pages = null;
      var sc = bd.querySelector('#pdfp-scroll'), demande = etat.style;
      sc.innerHTML = '<div class="pdfp-wait">Mise en page…</div>';
      construire(c, demande).then(function (pages) {
        if (demande !== etat.style) return;   // un autre style a été choisi entre-temps
        etat.pages = pages;
        sc.innerHTML = pages.map(function (h) { return '<div class="pdfp-page">' + h + '</div>'; }).join('');
        ajuster();
      }).catch(function (e) { console.error(e); sc.innerHTML = '<div class="pdfp-wait">Mise en page impossible — réessaie.</div>'; });
    }
    function lancer(mode) {
      if (!etat.pages) { V2.toast('Mise en page en cours…'); return; }
      V2.toast('Génération du PDF…');
      fabriquer(etat.pages, fn, mode, titre).catch(function (e) { console.error(e); V2.toast('Module PDF indisponible — vérifie ta connexion', 'error'); });
    }
    bd.querySelector('#pdfp-dl').onclick = function () { lancer('save'); };
    var sh = bd.querySelector('#pdfp-sh'); if (sh) sh.onclick = function () { lancer('share'); };
    bd.classList.add('open');
    rendre();
  }
  function fermer() { var b = document.getElementById('pdfp-modal'); if (b) b.classList.remove('open'); }

  // data = {cats:[{cat, rows}], panel} (comme achatsPdf) · o = {nom, ref, reseau, client?, fichier?, maxPages?} · mode : 'blob' | 'share' | aperçu
  V2.prospectPdf = function (data, o, mode) {
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    var c = contexte(data, o);
    if (!c.tot || !c.panel) { V2.toast('Aucun produit à proposer pour cette liste', 'warn'); return; }
    var lib = o.fichier || c.ref;
    var fn = 'Liste-' + String(lib).replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    var titre = 'Liste d\'achats · ' + lib;
    if (mode === 'blob' || mode === 'share') {
      V2.toast('Génération du PDF…');
      return construire(c, styleLu()).then(function (pages) { return fabriquer(pages, fn, mode, titre); });
    }
    apercu(c, fn, titre);
  };
  V2.prospectPdfStyles = STYLES;
  V2.prospectPdfStyle = function (v) { if (v >= 1 && v <= 5) styleEcrit(v); return styleLu(); };
  V2.prospectPdfClose = fermer;
})();
