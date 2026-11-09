/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Concurrents · dossier « D2P Pharma »
   #concurrents/d2p          : le face-à-face du réseau (écran INTERNE)
   #concurrents/d2p/<code>   : la vue d'une pharmacie, à montrer en rendez-vous
   Tous les chiffres viennent de window.D2P_DATA (fichier protégé, Supabase) : ce module ne contient AUCUNE condition chiffrée.
   Jamais côté OPSO ni Escale. Aucun export : les conditions se montrent à l'écran, elles ne s'impriment pas.
   Vanilla · zéro lib · zéro emoji.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : (window.ICO ? window.ICO(n, s, w) : ''); };
  var SANS = !!(window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale));
  var essaye = false;

  // libellés des délais de paiement : lus dans les données (conditions d'un tiers)
  function J() { return (window.D2P_DATA && window.D2P_DATA.escompte) || { lib10: '', lib20: '' }; }
  function fr(n, d) { if (typeof n !== 'number' || !isFinite(n)) return '—'; return n.toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function eur(n, d) { return fr(n, d == null ? 2 : d) + ' €'; }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ── Le calcul (pur, testable) ────────────────────────────────────────
  // lignes : [{ cip, q, mois }] (une par ligne de vente). Même règles que le classeur de référence :
  // une ligne à quantité <= 0 est ignorée ; le barème ne s'applique qu'aux produits de D.produits ;
  // les achats face au seuil comptent tous les remboursables connus, au prix grossiste.
  V2.d2pCalcul = function (lignes, D) {
    var P = D.produits || {}, A = D.ppht_autres || {}, par = {}, mois = {};
    var T = { boites: 0, ca: 0, ip: 0, d2p: 0, esc10: 0, esc20: 0 };
    lignes.forEach(function (l) {
      var q = +l.q; if (!(q > 0)) return;
      var c = String(l.cip), p = P[c], pp = p ? p[0] : A[c];
      if (pp > 0) mois[l.mois] = (mois[l.mois] || 0) + q * pp;
      if (!p) return;
      var o = par[c] || (par[c] = { cip: c, q: 0 });
      o.q += q;
    });
    var prods = Object.keys(par).map(function (c) {
      var p = P[c], o = par[c];
      var x = { cip: c, nom: (D.noms || {})[c] || c, q: o.q, ppht: p[0], ip: p[1], d2p: p[2], esc10: p[3], esc20: p[4] };
      x.totIp = x.q * x.ip; x.totD2p = x.q * x.d2p; x.totEsc10 = x.q * x.esc10; x.totEsc20 = x.q * x.esc20;
      x.gain = x.totIp - x.totD2p;                              // ce qu'Intégral rend de plus, sans escompte
      x.ecart10 = x.totD2p + x.totEsc10 - x.totIp;              // > 0 : D2P rend plus avec le paiement rapide
      x.ecart20 = x.totD2p + x.totEsc20 - x.totIp;
      x.devant10 = x.d2p + x.esc10 > x.ip + 1e-9;
      x.devant20 = x.d2p + x.esc20 > x.ip + 1e-9;
      T.boites += x.q; T.ca += x.q * x.ppht; T.ip += x.totIp; T.d2p += x.totD2p; T.esc10 += x.totEsc10; T.esc20 += x.totEsc20;
      return x;
    });
    var ks = Object.keys(mois), somme = 0; ks.forEach(function (k) { somme += mois[k]; });
    return { T: T, prods: prods, mois: mois, nbMois: ks.length, moyenneMensuelle: ks.length ? somme / ks.length : 0 };
  };

  // Les ventes d'une pharmacie, telles que la fiche les lit (déjà bornées au secteur du commercial connecté).
  function ventesDe(pid) {
    var b = V2.pharmaVentesDe ? V2.pharmaVentesDe(pid) : [];
    if (V2.commFilter) b = b.filter(function (s) { return s.commercial === V2.commFilter; });
    var esc_ = V2.ESCALE_COMMS || [];
    return b.filter(function (s) { return esc_.indexOf(s.commercial) < 0; }).map(function (s) {
      return { cip: s.artCode, q: s.qte, mois: (+s.year || 0) * 12 + (s.month || 0) };
    });
  }
  function periodeDe(lignes) {
    var ks = {}; lignes.forEach(function (l) { ks[l.mois] = 1; });
    var a = Object.keys(ks).map(Number).sort(function (x, y) { return x - y; });
    if (!a.length) return '';
    function lib(k) { return MOIS[(k - 1) % 12] + ' ' + Math.floor((k - 1) / 12); }
    return a.length === 1 ? lib(a[0]) : lib(a[0]) + ' → ' + lib(a[a.length - 1]);
  }

  // ── Style ────────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-d2p-css')) return;
    var s = document.createElement('style'); s.id = 'v2-d2p-css';
    s.textContent = [
      '.d2p-sec{margin:26px 0 8px}.d2p-sec h2{font-size:20px;font-weight:800;letter-spacing:-.025em;color:var(--titre,#0B1F4D);margin:0 0 4px}.d2p-sec p{font-size:13.5px;color:var(--muted);margin:0 0 10px;line-height:1.5;max-width:820px}',
      '.d2p-note{font-size:13px;color:var(--muted);line-height:1.5;margin:8px 4px 0}',
      '.d2p-alerte{border:1px solid rgba(199,121,26,.35);background:#FFF7EA;border-radius:12px;padding:10px 14px;font-size:13px;color:#7A4A0B;margin:0 0 14px;line-height:1.5}',
      '.d2p-choix{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 18px}.d2p-choix label{font-size:13px;font-weight:700;color:var(--ip-ink-2)}',
      '.d2p-choix select{min-height:48px;min-width:0;max-width:100%;flex:1 1 260px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:0 12px;font:inherit;font-size:16px;color:var(--ip-ink)}',
      '.d2p-ligne{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 14px;align-items:baseline;padding:10px 0;border-top:1px solid var(--line);font-size:14px}.d2p-ligne:first-of-type{border-top:0}.d2p-ligne b{font-size:16px;font-weight:800;white-space:nowrap}.d2p-ligne small{grid-column:1/-1;color:var(--muted);font-size:13px}',
      '.d2p-jauge{height:10px;border-radius:6px;background:#EEF0F4;overflow:hidden;margin:10px 0 6px}.d2p-jauge i{display:block;height:100%;background:var(--ip-blue);border-radius:6px}',
      '.d2p-tot td{font-weight:800;background:#F4F7FD}',
      '.d2p-win{color:#10915E;font-weight:700}.d2p-lose{color:#C8385A;font-weight:700}',
      '.d2p-cart2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 8px}',
      '@media (max-width:700px){.d2p-cart2{grid-template-columns:1fr 1fr;gap:10px}.d2p-ligne{grid-template-columns:1fr}.d2p-sec h2{font-size:18px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Pièces d'écran ───────────────────────────────────────────────────
  function cart(l, v, s, cls) { return '<div class="cc-c' + (cls ? ' ' + cls : '') + '"><div class="l">' + l + '</div><div class="v num">' + v + '</div><div class="s">' + s + '</div></div>'; }
  // `txt` : indices des colonnes de TEXTE (alignées à gauche, qui passent à la ligne) ; les autres sont des chiffres (à droite).
  function table(cols, lignes, tot, txt) {
    txt = txt || [0];
    var cl = function (i) { return txt.indexOf(i) < 0 ? ' class="num"' : ''; };
    var h = cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('');
    var row = function (r, c) { return '<tr' + (c ? ' class="' + c + '"' : '') + '>' + r.map(function (v, i) { return '<td data-label="' + esc(cols[i]) + '"' + cl(i) + '>' + v + '</td>'; }).join('') + '</tr>'; };
    var b = lignes.map(function (r) { return row(r); }).join('') + (tot ? row(tot, 'd2p-tot') : '');
    return '<div class="cc-tablewrap"><table class="v2-table cc-table"><thead><tr>' + h + '</tr></thead><tbody>' + b + '</tbody></table></div>';
  }
  function etat(titre, texte, bouton) {
    return '<div class="v2-empty"><div class="v2-empty-ico">' + ICO('alert', 64, 1.4) + '</div><div class="v2-empty-t">' + esc(titre) + '</div><div class="v2-empty-d">' + esc(texte) + '</div>' + (bouton || '') + '</div>';
  }
  function pharmaciesAvecVentes() {
    var vus = {};
    (V2.pharmacies || []).forEach(function (p) { if (V2.voitVentesDe && !V2.voitVentesDe(p.id)) return; vus[String(p.id)] = p; });
    return Object.keys(vus).map(function (k) { return vus[k]; }).filter(function (p) { return V2.pharmaVentesDe && V2.pharmaVentesDe(p.id).length; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
  }
  function selecteur(code) {
    var l = pharmaciesAvecVentes();
    return '<div class="d2p-choix"><label for="d2p-sel">Pharmacie</label><select id="d2p-sel" onchange="V2.d2pChoisir(this.value)"><option value="">Choisir une pharmacie…</option>' +
      l.map(function (p) { return '<option value="' + esc(p.id) + '"' + (String(p.id) === String(code) ? ' selected' : '') + '>' + esc(p.name) + (p.ville ? ' · ' + esc(p.ville) : '') + '</option>'; }).join('') + '</select></div>';
  }
  V2.d2pChoisir = function (id) { if (id) V2.go('concurrents', 'd2p/' + id); else V2.go('concurrents', 'd2p'); };

  // ── Écran réseau (interne) ───────────────────────────────────────────
  function reseauHtml(D) {
    var R = D.reseau, per = D.periode.libelle;
    var h = '<section class="cc-fiche"><div class="cc-head"><div><span class="cc-eyebrow"><i class="dot"></i>Grossiste concurrent</span><h1 class="v2-page-title">D2P Pharma face à Intégral</h1>' +
      '<p class="v2-page-sub">Sur les princeps remboursables : ce que la pharmacie récupère sur chaque boîte, chez D2P et chez nous. Chiffres de nos ventes de ' + esc(per) + '.</p></div>' +
      '<div class="cc-meta"><span>Relevé du <b class="num">' + esc(D.maj.split('-').reverse().join('/')) + '</b></span><span><b class="num">' + fr(R.nb_officines) + '</b> pharmacies</span></div></div>' +
      '<div class="d2p-alerte">Écran interne. Les conditions de D2P sont celles d\'un tiers : elles ne se remettent à aucune pharmacie, ne s\'impriment pas et ne se recopient sur aucun support.</div>';
    h += selecteur('');
    h += '<div class="cc-cart four">' +
      cart('Rendu par Intégral', eur(R.ip, 0), fr(R.q) + ' boîtes en ' + D.periode.nb_mois + ' mois', 'ok') +
      cart('D2P, sans escompte', eur(R.d2p, 0), 'paiement au-delà de ' + J().lib20 + '') +
      cart('D2P, paiement à ' + J().lib20 + '', eur(R.d2p + R.esc20, 0), 'escompte de ' + esc(D.escompte.txt20) + ' : ' + eur(R.esc20, 0)) +
      cart('D2P, paiement à ' + J().lib10 + '', eur(R.d2p + R.esc10, 0), 'escompte de ' + esc(D.escompte.txt10) + ' : ' + eur(R.esc10, 0)) + '</div>';
    h += '<p class="d2p-note">Intégral n\'a aucun escompte : nos montants ne changent pas avec le délai de paiement. Sans escompte, Intégral rend plus que D2P à tous les prix.</p>';

    h += '<div class="d2p-sec"><h2>Tranche par tranche</h2><p>Ce que la pharmacie récupère sur une boîte, selon son prix fabricant (PFHT).</p></div>' +
      table(['Prix fabricant', 'D2P rend', 'Intégral rend', 'Exemple : boîte à', 'D2P sur l\'exemple', 'Intégral sur l\'exemple'],
        D.grille.map(function (g) { return [esc(g.lib), esc(g.d2p), esc(g.ip), eur(g.ex), eur(g.ex_d2p, 3), '<span class="d2p-win">' + eur(g.ex_ip, 3) + '</span>']; }), null, [0, 1, 2]);

    var tot = { q: 0, ip: 0, d2p: 0, esc: 0 };
    var lignes = R.bandes_escompte.map(function (b) {
      tot.q += b.q; tot.ip += b.ip; tot.d2p += b.d2p; tot.esc += b.esc;
      return [esc(b.lib === 'devant' ? 'Boîtes à plus de ' + fr(D.bascule.j10) + ' € de prix grossiste (D2P passe devant à ' + J().lib10 + ')' : b.lib), fr(b.q), eur(b.ip, 0), eur(b.d2p, 0), eur(b.esc, 0), eur(b.d2p + b.esc, 0)];
    });
    h += '<div class="d2p-sec"><h2>Sur nos ventes, par tranche de prix</h2><p>Paiement à ' + J().lib10 + ' chez D2P. L\'escompte ne pèse vraiment que sur les produits très chers.</p></div>' +
      table(['Prix fabricant', 'Boîtes', 'Rendu par Intégral', 'D2P sans escompte', 'Escompte à ' + J().lib10 + '', 'D2P avec escompte'], lignes,
        ['Total', fr(tot.q), eur(tot.ip, 0), eur(tot.d2p, 0), eur(tot.esc, 0), eur(tot.d2p + tot.esc, 0)]);

    h += '<div class="d2p-sec"><h2>Les ' + R.devant10.n + ' produits où D2P passe devant</h2><p>Seulement avec le paiement à ' + J().lib10 + ' : ' + fr(R.devant10.q) + ' boîtes, ' + eur(R.devant10.ecart, 0) + ' d\'écart en faveur de D2P sur ' + D.periode.nb_mois + ' mois. À ' + J().lib20 + ' : ' +
      (R.devant20.n ? R.devant20.n + ' produit, ' + eur(R.devant20.ecart, 0) + '.' : 'aucun produit.') + '</p></div>' +
      table(['Produit', 'Prix grossiste', 'Boîtes', 'Intégral / boîte', 'D2P sans escompte', 'D2P à ' + J().lib20 + '', 'D2P à ' + J().lib10 + '', 'Écart pour D2P'],
        R.produits_devant.map(function (p) { return [esc(p.nom), eur(p.ppht), fr(p.q), eur(p.ip, 2), eur(p.d2p, 2), eur(p.d2p20, 2), eur(p.d2p10, 2), '<span class="d2p-lose">' + eur(p.ecart10, 0) + '</span>']; }),
        ['Total', '', fr(R.devant10.q), '', '', '', '', eur(R.devant10.ecart, 0)]);

    var A = D.apres2027;
    h += '<div class="d2p-sec"><h2>Après le 20 janvier 2027</h2><p>Plancher de marge grossiste à ' + esc(A.plancher) + '. Hypothèse : ' + esc(A.hyp) + '. Intégral rendrait ' + eur(A.ip, 0) + ' sur la même période.</p></div>' +
      table(['Paiement chez D2P', 'Où D2P passe devant (prix fabricant)', 'Boîtes concernées', 'Écart pour D2P'],
        A.cas.map(function (c) { return [esc(c.lib), esc(c.zones), fr(c.q), eur(c.ecart, 0)]; }), null, [0, 1]);

    h += '<div class="d2p-sec"><h2>Les autres conditions</h2><p>Seuil : ' + fr(R.nb_officines - R.nb_seuil) + ' de nos ' + fr(R.nb_officines) + ' pharmacies achètent en moyenne moins de ' + fr(D.seuil_mensuel) + ' € de remboursables par mois chez nous.</p></div>' +
      table(['', 'D2P Pharma', 'Intégral'], D.conditions.map(function (c) { return ['<b>' + esc(c[0]) + '</b>', esc(c[1]), esc(c[2])]; }), null, [0, 1, 2]);
    h += '<p class="d2p-note">' + esc(D.source) + '.</p></section>';
    return h;
  }

  // ── Vue d'une pharmacie (à montrer en rendez-vous) ───────────────────
  function officineHtml(D, code) {
    var ph = (V2.pharmacies || []).filter(function (p) { return String(p.id) === String(code); })[0];
    var nom = ph ? ph.name : 'Pharmacie ' + code;
    var voit = !V2.voitVentesDe || V2.voitVentesDe(code);
    var lignes = voit ? ventesDe(code) : [];
    var h = '<section class="cc-fiche"><div class="cc-head"><div><span class="cc-eyebrow"><i class="dot"></i>Face à D2P Pharma</span><h1 class="v2-page-title">' + esc(nom) + '</h1>' +
      '<p class="v2-page-sub">Ce que vos achats de princeps vous ont rendu chez Intégral, et ce qu\'un autre grossiste vous aurait rendu sur les mêmes boîtes.</p></div></div>';
    h += selecteur(code);
    if (!voit || !lignes.length) return h + etat('Aucune vente à montrer', voit ? 'Aucun achat n\'est chargé pour cette pharmacie.' : 'Cette pharmacie n\'est pas dans votre secteur.') + '</section>';
    var C = V2.d2pCalcul(lignes, D), T = C.T, per = periodeDe(lignes);
    var mens = C.moyenneMensuelle, seuil = D.seuil_mensuel, pct = Math.max(0, Math.min(100, Math.round(mens / seuil * 100)));
    h += '<p class="d2p-note" style="margin:0 0 14px">Période : <b>' + esc(per) + '</b> (' + C.nbMois + ' mois) · ' + fr(T.boites) + ' boîtes de princeps remboursables.</p>';
    h += '<div class="cc-cart four">' +
      cart('Rendu par Intégral', eur(T.ip), 'sur vos achats de la période', 'ok') +
      cart('D2P, sans escompte', eur(T.d2p), 'paiement au-delà de ' + J().lib20 + '') +
      cart('D2P, paiement à ' + J().lib20 + '', eur(T.d2p + T.esc20), 'escompte de ' + esc(D.escompte.txt20) + ' compris') +
      cart('D2P, paiement à ' + J().lib10 + '', eur(T.d2p + T.esc10), 'escompte de ' + esc(D.escompte.txt10) + ' compris') + '</div>';
    h += '<p class="d2p-note">Intégral n\'a aucun escompte : le montant ne dépend pas du délai de paiement.</p>';

    h += '<div class="d2p-sec"><h2>Vos achats chaque mois</h2></div><div class="cc-card"><div class="d2p-ligne"><span>Achats de remboursables chez Intégral, en moyenne par mois</span><b class="num">' + eur(mens, 0) + '</b></div>' +
      '<div class="d2p-jauge" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<div class="d2p-note" style="margin:0">Seuil demandé par D2P pour sa grille : <b>' + eur(seuil, 0) + '</b> par mois. ' +
      (mens >= seuil ? 'Vous seriez au-dessus du seuil.' : 'Vous seriez en dessous du seuil avec ce volume.') + '</div></div>';

    var avec = C.prods.filter(function (x) { return !x.devant10; }).sort(function (a, b) { return b.gain - a.gain; });
    var avecD2p = C.prods.filter(function (x) { return x.devant10; }).sort(function (a, b) { return b.ecart10 - a.ecart10; });
    h += '<div class="d2p-sec"><h2>À faire avec Intégral (' + fr(avec.length) + ' produits)</h2><p>Chez Intégral, ces produits vous rendent plus qu\'ailleurs, quel que soit le délai de paiement. Classés par gain.</p></div>' +
      table(['Produit', 'Prix grossiste', 'Intégral / boîte', 'D2P / boîte', 'Boîtes', 'Rendu par Intégral', 'Rendu par D2P', 'Gain avec Intégral'],
        avec.slice(0, 40).map(function (x) { return [esc(x.nom), eur(x.ppht), eur(x.ip), eur(x.d2p), fr(x.q), eur(x.totIp), eur(x.totD2p), '<span class="d2p-win">' + eur(x.gain) + '</span>']; }),
        avec.length > 40 ? ['Total des ' + fr(avec.length) + ' produits', '', '', '', fr(avec.reduce(function (a, x) { return a + x.q; }, 0)),eur(avec.reduce(function (a, x) { return a + x.totIp; }, 0)), eur(avec.reduce(function (a, x) { return a + x.totD2p; }, 0)), eur(avec.reduce(function (a, x) { return a + x.gain; }, 0))] : null);
    if (avec.length > 40) h += '<p class="d2p-note">40 premiers produits sur ' + fr(avec.length) + '.</p>';

    h += '<div class="d2p-sec"><h2>Là où D2P rend plus</h2><p>' + (avecD2p.length ? 'Uniquement si vous payez D2P à ' + J().lib10 + '. À ' + J().lib20 + ' ou plus tard, Intégral reste devant sur ces produits ou ils y sont à égalité.' : 'Aucun de vos produits : sur vos achats, Intégral rend plus quel que soit le délai de paiement chez D2P.') + '</p></div>';
    if (avecD2p.length) h += table(['Produit', 'Prix grossiste', 'Intégral / boîte', 'D2P à ' + J().lib10 + ' / boîte', 'Boîtes', 'Rendu par Intégral', 'Rendu par D2P à ' + J().lib10 + '', 'Écart pour D2P', 'Condition'],
      avecD2p.map(function (x) { return [esc(x.nom), eur(x.ppht), eur(x.ip), eur(x.d2p + x.esc10), fr(x.q), eur(x.totIp), eur(x.totD2p + x.totEsc10), '<span class="d2p-lose">' + eur(x.ecart10) + '</span>', 'paiement à ' + J().lib10 + '' + (x.devant20 ? ' ou ' + J().lib20 + '' : '')]; }), null, [0, 8]);
    return h + '</section>';
  }

  // ── Point d'entrée, appelé par v2-concurrents.js ─────────────────────
  // Rend la page dans `root`. `nav` = barre d'onglets Concurrents (écran interne seulement).
  V2.d2pRender = function (root, param, nav) {
    injectCss();
    var code = String(param || '').replace(/^d2p\/?/, '');
    var corps;
    if (SANS) corps = etat('Indisponible', 'Ce dossier n\'existe pas dans cet espace.');
    else if (!window.D2P_DATA) {
      var ko = V2.donneesProtegeesKO && V2.donneesProtegeesKO().indexOf('concd2p') >= 0;
      if (!essaye && V2.loadFiles) { essaye = true; try { V2.loadFiles(['concd2p']).then(function () { if (V2.route && V2.route.name === 'concurrents') V2.render(); }); } catch (e) {} }
      corps = ko ? etat('Données protégées non chargées', 'Il faut être connecté et en ligne. Réessayez dans un instant.', '<button class="v2-btn v2-btn-primary" onclick="V2.d2pRetry()">Réessayer</button>')
        : '<div class="cc-sk" aria-busy="true"><div class="cc-sk-l" style="width:38%"></div><div class="cc-sk-l" style="width:92%"></div><div class="cc-sk-l" style="width:84%"></div></div>';
    } else corps = code ? officineHtml(window.D2P_DATA, code) : reseauHtml(window.D2P_DATA);
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Retour' }) +
      '<div class="v2-wrap v2-u cc-wrap' + (code ? '' : '') + '">' + (code ? '' : (nav || '')) + corps + '</div>';
  };
  V2.d2pRetry = function () { essaye = false; if (V2.protegeEchec) delete V2.protegeEchec.concd2p; V2.render(); };
  V2.d2pDisponible = function () { return !SANS; };
})();
