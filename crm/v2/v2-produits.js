/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Produits » (pages.produits)
   L'entrée UNIQUE des produits : pour une officine, ce que ses confrères
   du même groupement d'achat nous prennent et qu'elle ne nous prend pas,
   filtré sur le stock réel. Deux modes : Vendeur (par officine) et
   Achats (par produit).
   Le calcul vit dans v2-produits-moteur.js (module pur, 29 tests).
   Cet écran ne fait que du rendu.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  // Valeur destinée à un onclick="…('ICI')" : elle traverse HTML puis JS.
  var escAttr = function (s) { return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, '')); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : Math.round(+n || 0) + ' €'; };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(Math.round(+n || 0)); };

  var FAM = {
    pr_low:  { l: 'Princeps < 4,33 €',    c: 'var(--ip-blue)' },
    pr_mid:  { l: 'Princeps 4,33–468 €',  c: 'var(--ip-blue)' },
    pr_high: { l: 'Princeps > 468 €',     c: 'var(--ip-blue)' },
    nr:      { l: 'Non remboursable',     c: 'var(--c-amber)' },
    gen:     { l: 'Générique',            c: 'var(--c-mint)' },
    biosim:  { l: 'Biosimilaire',         c: '#6D4FC4' }
  };
  var FAM_ORDRE = ['pr_low', 'pr_mid', 'pr_high', 'nr', 'gen', 'biosim'];
  // Seules les familles princeps portent un abandon de marge. Génériques,
  // NR et biosimilaires : net = PPHT, aucun abandon (règle métier stricte).
  function porteAbandon(f) { return String(f || '').indexOf('pr_') === 0; }

  var S = {
    mode: 'vendeur', ph: null, fam: 'all', q: '', sansRupture: false, page: 0,
    grp: 'all', horsStock: false
  };
  var PAR_PAGE = 40;

  V2.produits = V2.produits || {};
  V2.produits.S = S;

  // ── Index (construit une fois, invalidé si les ventes changent) ──
  V2.produits.index = function () {
    var M = window.V2PRODUITS;
    if (!M) return null;
    var sig = (V2.sales || []).length + ':' + (V2.pharmacies || []).length;
    if (V2.produits._idx && V2.produits._sig === sig) return V2.produits._idx;
    V2.produits._idx = M.indexer(V2.pharmacies || [], V2.sales || []);
    V2.produits._sig = sig;
    return V2.produits._idx;
  };

  function fiche(cip) {
    if (!V2.produits._ps) {
      var m = {}, PS = window.PROD_STATS || [], i;
      for (i = 0; i < PS.length; i++) m[String(PS[i].c)] = PS[i];
      V2.produits._ps = m;
    }
    return V2.produits._ps[String(cip)] || null;
  }
  function enRupture(cip) {
    var R = window.RUPTURES && window.RUPTURES.data;
    return !!(R && R[String(cip)]);
  }
  function stockIP() {
    return (window.STOCK_IP && window.STOCK_IP.data) || {};
  }

  // ── Pilotage depuis le HTML ────────────────────────────────────
  V2.produits.setPh = function (id) { S.ph = id || null; S.page = 0; V2.render(); };
  V2.produits.setMode = function (m) { S.mode = m; S.page = 0; V2.render(); };
  V2.produits.setFam = function (k) { S.fam = k; S.page = 0; V2.render(); };
  V2.produits.setRupt = function () { S.sansRupture = !S.sansRupture; S.page = 0; V2.render(); };
  V2.produits.setGrp = function (g) { S.grp = g || 'all'; S.page = 0; V2.render(); };
  V2.produits.setHorsStock = function () { S.horsStock = !S.horsStock; S.page = 0; V2.render(); };
  V2.produits.plus = function () { S.page += 1; V2.render(); };
  var tq = null;
  V2.produits.setQ = function (v) {
    S.q = v || '';
    if (tq) clearTimeout(tq);
    tq = setTimeout(function () { S.page = 0; V2.render(); }, 220);
  };

  // ── Filtres d'affichage (le moteur a déjà fait le tri métier) ──
  function filtrer(lignes) {
    var q = S.q.trim().toLowerCase();
    var out = [], i;
    for (i = 0; i < lignes.length; i++) {
      var l = lignes[i], f = fiche(l.cip);
      if (S.fam !== 'all' && (!f || f.f !== S.fam)) continue;
      if (S.sansRupture && enRupture(l.cip)) continue;
      if (q) {
        var lib = (f && f.d ? f.d : '').toLowerCase();
        if (lib.indexOf(q) < 0 && String(l.cip).indexOf(q) < 0) continue;
      }
      out.push(l);
    }
    return out;
  }

  function chiffre(v, lib, cls) {
    return '<div class="' + (cls || '') + '"><span>' + v + '</span><em>' + lib + '</em></div>';
  }

  function enTeteProduit(l) {
    var f = fiche(l.cip);
    var lib = f && f.d ? f.d : ('CIP ' + l.cip);
    var fam = f && FAM[f.f] ? FAM[f.f] : null;
    return '<div class="pr-lib">' + esc(lib) +
      (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
      (enRupture(l.cip) ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
      '</div>';
  }

  // ── Rendu : une ligne, mode Vendeur ────────────────────────────
  function ligneHtml(l, libelleGroupe) {
    var f = fiche(l.cip);
    var abandon = (f && porteAbandon(f.f) && f.ppht > 0 && f.net > 0)
      ? eur(f.ppht - f.net) : '—';
    return '' +
      '<div class="pr-row">' +
        enTeteProduit(l) +
        '<div class="pr-arg">' +
          '<strong>' + Math.round(l.pctPeers * 100) + ' %</strong> de ses ' + esc(libelleGroupe) +
          ' le prennent · <strong>' + eur(l.caMoyen) + '</strong> en moyenne par confrère' +
        '</div>' +
        '<div class="pr-chiffres">' +
          chiffre(eur(l.potentiel), 'potentiel', 'pr-pot') +
          chiffre(f && f.net > 0 ? eur(f.net) : '—', 'prix net') +
          chiffre(abandon, 'abandon de marge') +
          chiffre(num(l.stock), 'en stock') +
        '</div>' +
      '</div>';
  }

  // ── Rendu : mode Vendeur ───────────────────────────────────────
  function rendreVendeur() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return vide('Moteur indisponible', 'Le fichier v2-produits-moteur.js n\'est pas chargé.');

    var phs = (V2.pharmacies || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    if (!phs.length) return vide('Aucune officine', 'Les données réseau ne sont pas chargées.');
    if (!S.ph) S.ph = String(phs[0].id);

    var opts = '', i;
    for (i = 0; i < phs.length; i++) {
      opts += '<option value="' + escAttr(phs[i].id) + '"' +
        (String(phs[i].id) === String(S.ph) ? ' selected' : '') + '>' +
        esc(phs[i].name) + '</option>';
    }

    var r = M.listingOfficine(idx, S.ph, { stock: stockIP() });
    var lignes = filtrer(r.lignes);
    var potentielTotal = 0;
    for (i = 0; i < lignes.length; i++) potentielTotal += lignes[i].potentiel;
    var libGrp = r.groupe ? r.groupe.libelle : 'confrères';

    // Honnêteté : si le seuil a dû baisser (petite officine, pairs peu
    // actifs), on le dit au lieu de laisser croire à une comparaison forte.
    var noteSeuil = (r.seuil != null && r.seuil < M.SEUIL_PEERS)
      ? '<div class="pr-note">Comparaison élargie : cette officine a peu de confrères actifs, ' +
        'le seuil est descendu à ' + Math.round(r.seuil * 100) + ' %.</div>'
      : '';

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '';
    for (i = 0; i < visibles.length; i++) corps += ligneHtml(visibles[i], libGrp);

    return '' +
      '<div class="pr-bandeau">' +
        '<select class="pr-select" aria-label="Choisir une officine" onchange="V2.produits.setPh(this.value)">' + opts + '</select>' +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-grp">' + num(r.nbConfreres) + ' ' + esc(libGrp) + '</span>' +
          '<span class="pr-ctx-pot">' + eur(potentielTotal) + ' de potentiel</span>' +
          '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
        '</div>' +
        noteSeuil +
        '<button class="v2-btn v2-btn-primary pr-pdf" onclick="V2.produits.pdf()">Sortir le PDF</button>' +
        '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' +
      filtresHtml() +
      liste(lignes, visibles, corps);
  }

  function liste(lignes, visibles, corps) {
    if (!lignes.length) {
      return vide('Aucun produit avec ces filtres', 'Élargis la recherche ou change de famille.');
    }
    return '<div class="pr-liste">' + corps + '</div>' +
      (visibles.length < lignes.length
        ? '<button class="v2-btn pr-plus" onclick="V2.produits.plus()">Voir 40 produits de plus</button>'
        : '');
  }

  function vide(t, d) {
    return '<div class="v2-empty"><div class="v2-empty-t">' + esc(t) + '</div>' +
      '<div class="v2-empty-d">' + esc(d) + '</div></div>';
  }

  function filtresHtml() {
    var chips = '<span class="pr-chip' + (S.fam === 'all' ? ' on' : '') +
      '" onclick="V2.produits.setFam(\'all\')">Toutes familles</span>', i, k;
    for (i = 0; i < FAM_ORDRE.length; i++) {
      k = FAM_ORDRE[i];
      chips += '<span class="pr-chip' + (S.fam === k ? ' on' : '') +
        '" onclick="V2.produits.setFam(\'' + k + '\')">' + esc(FAM[k].l) + '</span>';
    }
    return '' +
      '<div class="pr-filtres">' +
        '<div class="pr-search">' + ICO('search', 16, 2) +
          '<input placeholder="Produit ou CIP…" value="' + escAttr(S.q) +
          '" oninput="V2.produits.setQ(this.value)">' +
        '</div>' +
        '<div class="pr-chips">' + chips +
          '<span class="pr-chip' + (S.sansRupture ? ' on' : '') +
          '" onclick="V2.produits.setRupt()">Masquer les ruptures ANSM</span>' +
        '</div>' +
      '</div>';
  }

  // ── PDF à laisser au pharmacien ────────────────────────────────
  // Impression navigateur sur un document dédié : aucune librairie, aucun
  // coût. CONTENU AUTORISÉ : produit, prix net, disponibilité. Le barème
  // d'abandon de marge et toute autre condition chiffrée en sont exclus.
  V2.produits.pdf = function () {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx || !S.ph) { if (V2.toast) V2.toast('Choisis d\'abord une officine'); return; }

    var ph = null, phs = V2.pharmacies || [], i;
    for (i = 0; i < phs.length; i++) if (String(phs[i].id) === String(S.ph)) ph = phs[i];
    if (!ph) { if (V2.toast) V2.toast('Officine introuvable'); return; }

    var lignes = filtrer(M.listingOfficine(idx, S.ph, { stock: stockIP() }).lignes).slice(0, 30);
    if (!lignes.length) { if (V2.toast) V2.toast('Aucun produit à imprimer'); return; }

    var rows = '';
    for (i = 0; i < lignes.length; i++) {
      var f = fiche(lignes[i].cip);
      rows += '<tr>' +
        '<td>' + esc(f && f.d ? f.d : ('CIP ' + lignes[i].cip)) + '</td>' +
        '<td class="n">' + esc(String(lignes[i].cip)) + '</td>' +
        '<td class="n">' + (f && f.net > 0 ? eur(f.net) : '—') + '</td>' +
        '<td class="n">' + (lignes[i].stock > 0 ? 'Disponible' : '—') + '</td>' +
      '</tr>';
    }

    var jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>Sélection produits — ' + esc(ph.name) + '</title><style>' +
      '@page{size:A4;margin:14mm}' +
      'body{font:12px/1.45 Inter,system-ui,sans-serif;color:#10131C;margin:0}' +
      'h1{font-size:19px;margin:0 0 2px;color:#0050E6}' +
      '.sub{color:#5A6478;font-size:12px;margin-bottom:14px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6478;' +
      'border-bottom:1.5px solid #0050E6;padding:6px 4px}' +
      'td{padding:6px 4px;border-bottom:1px solid #E6E9F0}' +
      'td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.pied{margin-top:16px;font-size:10px;color:#8A93A6}' +
      '</style></head><body>' +
      '<h1>Sélection produits — ' + esc(ph.name) + '</h1>' +
      '<div class="sub">Établie le ' + esc(jour) + ' · Intégral Pharma</div>' +
      '<table><thead><tr><th>Produit</th><th class="n">CIP</th>' +
      '<th class="n">Prix net</th><th class="n">Disponibilité</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="pied">Disponibilités constatées au jour de l\'édition, sous réserve des stocks.</div>' +
      '</body></html>';

    // Blob plutôt que document.write : pas d'écriture dans un document ouvert,
    // et la fenêtre d'impression reçoit une vraie URL.
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      if (V2.toast) V2.toast('Autorise les fenêtres pour sortir le PDF');
      return;
    }
    w.focus();
    setTimeout(function () {
      try { w.print(); } catch (e) {}
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }, 400);
  };

  // ── Page ───────────────────────────────────────────────────────
  V2.pages.produits = {
    render: function (root, param) {
      if (param) S.ph = String(param);
      injectStyles();
      var onglets = '' +
        '<div class="pr-modes">' +
          '<button class="pr-mode' + (S.mode === 'vendeur' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'vendeur\')">Vendeur</button>' +
          '<button class="pr-mode' + (S.mode === 'achats' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'achats\')">Achats</button>' +
        '</div>';
      var corps = S.mode === 'vendeur'
        ? rendreVendeur()
        : vide('Vue achats en préparation', 'Elle arrive juste après.');
      root.innerHTML =
        V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap pr-wrap">' +
          '<div class="v2-page-title">Produits</div>' +
          onglets + corps + liensBas() +
        '</div>';
    }
  };

  function liensBas() {
    var l = [];
    if (V2.pages.catalogue) l.push('<a onclick="V2.go(\'catalogue\')">Catalogue complet</a>');
    if (V2.pages.molecules) l.push('<a onclick="V2.go(\'molecules\')">Prix par produit</a>');
    if (V2.pages.appro) l.push('<a onclick="V2.go(\'appro\')">Vue achats détaillée</a>');
    return l.length ? '<div class="pr-liens">' + l.join('') + '</div>' : '';
  }

  function injectStyles() {
    if (document.getElementById('pr-styles')) return;
    var s = document.createElement('style');
    s.id = 'pr-styles';
    s.textContent = [
      '.pr-wrap{padding-bottom:64px}',
      '.pr-modes{display:flex;gap:8px;margin:12px 0}',
      '.pr-mode{min-height:44px;padding:0 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 15px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-mode.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-bandeau{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}',
      '.pr-select{width:100%;min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);padding:0 10px;background:var(--paper);color:var(--ip-ink)}',
      '.pr-ctx{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font:600 14px/1.3 Inter,sans-serif}',
      '.pr-ctx-pot{color:var(--ip-blue)}',
      '.pr-ctx-n,.pr-ctx-grp{color:var(--muted)}',
      '.pr-note{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(199,121,26,.10);border:1px solid rgba(199,121,26,.30);font:500 13px/1.4 Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-pdf{margin-top:12px;width:100%;min-height:44px}',
      '.pr-source{margin-top:10px;font:400 12px/1 Inter,sans-serif;color:var(--muted)}',
      '.pr-filtres{margin-bottom:12px}',
      '.pr-search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0 12px;min-height:44px}',
      '.pr-search input{flex:1;border:0;background:transparent;font-size:16px;color:var(--ip-ink);outline:none}',
      '.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.pr-chip{min-height:36px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 13px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-chip.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px}',
      '.pr-lib{font:700 15px/1.35 Satoshi,Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-fam{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font:600 11px/1.6 Inter,sans-serif;color:var(--fc);border:1px solid var(--fc)}',
      '.pr-rupt{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--c-rose);color:#fff;font:600 11px/1.6 Inter,sans-serif}',
      '.pr-arg{margin-top:6px;font:400 14px/1.4 Inter,sans-serif;color:var(--muted)}',
      '.pr-chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}',
      '.pr-chiffres span{display:block;font:600 15px/1.2 "Geist Mono",ui-monospace,monospace;color:var(--ip-ink)}',
      '.pr-chiffres em{display:block;font:400 11px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.pr-pot span{color:var(--ip-blue)}',
      '.pr-plus{width:100%;min-height:44px;margin-top:8px}',
      '.pr-liens{display:flex;flex-wrap:wrap;gap:14px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}',
      '.pr-liens a{font:500 13px/1 Inter,sans-serif;color:var(--muted);cursor:pointer;text-decoration:underline}',
      '@media (max-width:430px){.pr-chiffres{grid-template-columns:repeat(2,1fr);gap:10px}}',
      '@media (prefers-reduced-motion: reduce){.pr-row,.pr-chip,.pr-mode{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
