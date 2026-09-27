/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Le marché » (pages.marchefr)
   Maquette retenue par Will le 27/09/2026 : M4 « Par référence ».
   Une barre de recherche, et pour la référence trouvée : son marché
   français en euros, sa répartition région par région avec l'indice de
   chacune, ses tranches d'âge au national, et notre position dessus.

   Source : crm/v2/marche-regional.json (Open Medic bases complémentaires,
   Assurance Maladie, Licence Ouverte), croisé avec CATALOGUE_COMPLET pour
   le libellé, le laboratoire, le prix net, le stock et le nombre de nos
   officines acheteuses.

   ⚠️ AUCUN chiffre n'est écrit en dur dans ce fichier : le nombre de
   régions, l'année, les tranches d'âge, la couverture — tout se LIT dans
   le JSON. Le « 15 régions » en dur de la maquette avait déjà menti deux
   fois le 27/09 (la Corse n'a pas de code : elle est dans « 93 »).

   ⚠️ Le nom de route est `marchefr`, pas `marche` : V2.pages.marche est
   déjà pris par l'ancien Copilote (v2-copilote.js, code mort pré-existant
   atteignable seulement en repli de #copilote — signalé, pas touché).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };

  // Familles du catalogue (champ `f` de CATALOGUE_COMPLET) en français.
  // Même table que le banc de maquettes : c'est un libellé, pas un chiffre.
  var FAM_LABEL = {
    gen: 'Générique', biosim: 'Biosimilaire', pr_low: 'Princeps petit prix',
    pr_mid: 'Princeps prix moyen', pr_high: 'Princeps prix élevé',
    nr: 'Non remboursable'
  };

  // ── Découpage régional : département → code région de la SOURCE ───────────
  // Sert UNIQUEMENT à compter nos officines par région depuis leur code postal.
  // ⚠️ Deux pièges déjà payés :
  //  · la Corse n'a pas de code dans Open Medic : 2A/2B/20 vont sous « 93 »
  //    (nomenclature CNAM : « 93 = Provence-Alpes-Côte d'Azur ET Corse ») ;
  //  · les DOM sont tous sous le code « 5 » — leur donner leur code INSEE
  //    enverrait sur une colonne inexistante et afficherait « undefined ».
  var DEP_REG = {};
  (function () {
    var T = {
      '11': '75 77 78 91 92 93 94 95', '24': '18 28 36 37 41 45',
      '27': '21 25 39 58 70 71 89 90', '28': '14 27 50 61 76',
      '32': '02 59 60 62 80', '44': '08 10 51 52 54 55 57 67 68 88',
      '52': '44 49 53 72 85', '53': '22 29 35 56',
      '75': '16 17 19 23 24 33 40 47 64 79 86 87',
      '76': '09 11 12 30 31 32 34 46 48 65 66 81 82',
      '84': '01 03 07 15 26 38 42 43 63 69 73 74',
      '93': '04 05 06 13 83 84 2A 2B 20', '5': '971 972 973 974 976'
    };
    for (var r in T) T[r].split(' ').forEach(function (d) { DEP_REG[d] = r; });
  })();
  function depDeCp(cp) {
    cp = String(cp == null ? '' : cp).trim();
    if (!cp) return null;
    if (/^\d{4}$/.test(cp)) cp = '0' + cp;            // zéro initial mangé par un tableur
    if (/^(971|972|973|974|976)/.test(cp)) return cp.slice(0, 3);
    if (cp.slice(0, 2) === '20') return '20';
    return cp.slice(0, 2);
  }

  // ── Formatage (repris du socle du banc) ──────────────────────────────────
  var NBF = new Intl.NumberFormat('fr-FR');
  var EUR2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function nb(n) { return NBF.format(Math.round(n || 0)); }
  function eur(n) {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Md€';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n / 1e6 < 10 ? 1 : 0).replace('.', ',') + ' M€';
    return nb(n) + ' €';
  }
  function uni(n) {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' Md';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n / 1e6 < 10 ? 1 : 0).replace('.', ',') + ' M';
    return nb(n);
  }
  function pct(x, d) { return (x || 0).toFixed(d === undefined ? 1 : d).replace('.', ',') + ' %'; }
  function famNom(f) { return FAM_LABEL[f] || f; }
  // La 4e tranche s'appelle « inconnu » : lui coller « ans » donnerait « inconnu ans ».
  function ageNom(a) { return /inconnu/i.test(a) ? 'Âge inconnu' : a + ' ans'; }

  // ── Socle calculé, une fois, à l'arrivée des données ─────────────────────
  var MR = null;     // le JSON brut
  var S = null;      // le socle dérivé
  var _chargeEnCours = false, _echec = null;

  function socle() {
    if (S) return S;
    var cat = V2.produits && V2.produits.catalogueIndex ? V2.produits.catalogueIndex() : null;
    if (!MR || !cat) return null;

    var REG = MR.regions, NR = REG.length, AGES = MR.ages;
    var totE = [], i;
    for (i = 0; i < NR; i++) totE[i] = 0;

    var prods = [], horsCat = 0;
    Object.keys(MR.data).forEach(function (cip) {
      var c = cat[cip];
      if (!c) { horsCat++; return; }
      var v = MR.data[cip], e = v.e, b = v.b, se = 0, sb = 0;
      for (var k = 0; k < NR; k++) { totE[k] += e[k]; se += e[k]; sb += b[k]; }
      prods.push({
        cip: cip, d: c.d || '', labo: c.labo || '', fam: c.f, net: c.net,
        stock: c.stock, nbph: c.n, e: se, b: sb, re: e, a: v.a || null
      });
    });
    prods.sort(function (a, b) { return b.e - a.e; });

    var tE = totE.reduce(function (a, b) { return a + b; }, 0);
    var partReg = totE.map(function (x) { return tE ? x / tE : 0; });
    // Une région dont le marché TOTAL est nul n'a pas été mesurée : la source ne
    // la porte pas. Un 0 affiché comme un chiffre se lirait comme une vraie
    // absence de marché — c'est un trou, et l'écran doit le dire.
    var regVide = totE.map(function (x) { return !x; });

    // Nos officines par région, depuis leur code postal.
    var offReg = {}, offSans = 0, phs = V2.pharmacies || [];
    phs.forEach(function (p) {
      var r = DEP_REG[depDeCp(p.cp)];
      if (r) offReg[r] = (offReg[r] || 0) + 1; else offSans++;
    });
    var totOff = REG.reduce(function (a, r) { return a + (offReg[r.c] || 0); }, 0);

    S = {
      REG: REG, NR: NR, AGES: AGES, prods: prods, horsCat: horsCat,
      totE: totE, tE: tE, partReg: partReg, regVide: regVide,
      offReg: offReg, offSans: offSans, totOff: totOff, nOff: phs.length,
      nCat: Object.keys(cat).length
    };
    return S;
  }

  function eurReg(v, i) { return S.regVide[i] ? 'donnée absente' : eur(v); }
  // Indice de consommation : 100 = la région pèse exactement son poids national.
  function indice(serie, i) {
    if (S.regVide[i]) return null;
    var s = serie.reduce(function (a, b) { return a + b; }, 0);
    if (!s || !S.partReg[i]) return null;
    return (serie[i] / s) / S.partReg[i] * 100;
  }
  // À 0, on ne dessine PAS le remplissage : un trait résiduel se lirait comme
  // une petite valeur là où il n'y a rien.
  function jauge(part, cls) {
    var w = Math.max(0, Math.min(100, (part || 0) * 100));
    return '<div class="mfr-j' + (cls ? ' ' + cls : '') + '">' +
      (w > 0 ? '<i style="width:' + w.toFixed(2) + '%"></i>' : '') + '</div>';
  }

  // ── Styles, injectés une fois ────────────────────────────────────────────
  var _css = false;
  function ensureCss() {
    if (_css) return; _css = true;
    var s = document.createElement('style');
    s.textContent = [
      '.mfr-rech{display:grid;grid-template-columns:1fr auto;gap:var(--sp-3);margin:var(--sp-5) 0 0}',
      '@media(max-width:640px){.mfr-rech{grid-template-columns:1fr}}',
      // font-size 16px obligatoire : en dessous, iOS zoome au focus.
      '.mfr-rech input{min-height:52px;font-family:var(--font);font-size:16px;padding:0 var(--sp-4);',
      ' border:1px solid var(--line-strong);border-radius:var(--r-btn);background:var(--card);',
      ' color:var(--ip-ink);box-shadow:var(--sh-1);width:100%;box-sizing:border-box}',
      '.mfr-rech input:focus{outline:2px solid var(--ip-blue);outline-offset:1px}',
      // À 390 px la grille passe en une colonne : le bouton n'est plus étiré par
      // le champ et tombait à 42 px. Cible tactile minimale imposée ici.
      '.mfr-rech .v2-btn{min-height:var(--tap-min)}',
      '.mfr-res{list-style:none;margin:var(--sp-3) 0 0;padding:0;display:grid;gap:var(--sp-2)}',
      // ⚠️ pas de `all:unset` ici : WebKit le déplie en `backdrop-filter:unset;…`
      // (faux positif « effet interdit Safari ») ET il remet box-sizing en
      // content-box, ce qui faisait déborder la page à 390 px.
      '.mfr-res button{-webkit-appearance:none;appearance:none;margin:0;font:inherit;color:inherit;text-align:left;',
      ' box-sizing:border-box;cursor:pointer;display:grid;width:100%;grid-template-columns:1fr auto;',
      ' gap:var(--sp-3);align-items:center;min-height:var(--tap-min);padding:var(--sp-3) var(--sp-4);',
      ' background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);min-width:0}',
      '.mfr-res button:hover{background:var(--card-2)}',
      '.mfr-res li[aria-current="true"] button{border-color:var(--ip-blue);box-shadow:var(--sh-blue)}',
      '.mfr-res button>span{min-width:0}',
      // Deux <span> frères sans display:block collent leurs textes.
      '.mfr-res .d,.mfr-res .c{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mfr-res .d{font-size:14px;font-weight:650;letter-spacing:-.01em}',
      '.mfr-res .c{font-size:13px;color:var(--muted);margin-top:2px}',
      '.mfr-res .v{font-family:var(--mono);font-size:13.5px;white-space:nowrap}',
      '.mfr-cols{display:grid;grid-template-columns:1.15fr .85fr;gap:var(--gap-grid);margin-top:var(--gap-grid)}',
      '@media(max-width:920px){.mfr-cols{grid-template-columns:1fr}}',
      '.mfr-cols h2{font-size:17px;font-weight:800;letter-spacing:-.025em}',
      '.mfr-sub{font-size:13px;color:var(--muted);margin-top:var(--sp-2);line-height:1.5}',
      '.mfr-st{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}',
      '.mfr-j{height:7px;border-radius:var(--r-pill);background:var(--surf-sunken);overflow:hidden}',
      '.mfr-j i{display:block;height:100%;border-radius:var(--r-pill);background:var(--ip-blue)}',
      '.mfr-j.v i{background:var(--c-cat)}',
      '.mfr-bars{display:grid;gap:6px;margin-top:var(--sp-3)}',
      '.mfr-b{display:grid;grid-template-columns:150px 1fr 104px 54px;gap:var(--sp-3);align-items:center;font-size:13px}',
      '.mfr-b span:first-child{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mfr-b em{font-style:normal;font-family:var(--mono);text-align:right}',
      '.mfr-b i{font-style:normal;font-family:var(--mono);font-size:12.5px;text-align:right;',
      ' padding:2px 6px;border-radius:var(--r-pill)}',
      '.mfr-b i.up{background:#E6F6EF;color:var(--c-mint-txt)}',
      '.mfr-b i.dn{background:#FDECEF;color:var(--c-rose-txt)}',
      '.mfr-b i.eq{background:#EFF1F6;color:var(--muted)}',
      '.mfr-b.age{grid-template-columns:96px 1fr 104px}',
      '@media(max-width:640px){.mfr-b{grid-template-columns:92px 1fr 76px 46px;gap:var(--sp-2)}',
      ' .mfr-b.age{grid-template-columns:92px 1fr 76px}}',
      '.mfr-l{display:grid;grid-template-columns:1fr auto;gap:var(--sp-3);padding-bottom:var(--sp-3);',
      ' border-bottom:1px solid var(--line-2);font-size:14px}',
      '.mfr-lignes{display:grid;gap:var(--sp-3);margin-top:var(--sp-4)}',
      '.mfr-lignes .mfr-l:last-child{border-bottom:none;padding-bottom:0}',
      '.mfr-l span:first-child{color:var(--muted)}',
      '.mfr-l b{font-family:var(--mono);font-weight:700;letter-spacing:-.02em}',
      '.mfr-note{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);',
      ' padding:var(--sp-4);font-size:12.5px;color:var(--muted);line-height:1.65;margin-top:var(--gap-grid)}',
      '.mfr-note b{color:var(--ip-ink-2)}'
    ].join('');
    document.head.appendChild(s);
  }

  // Le nom d'une région se LIT dans la source par son code : le libellé de « 93 »
  // a changé le 27/09/2026 (« et Corse » ajouté), il ne se recopie pas ici.
  function nomRegion(code) {
    for (var i = 0; i < S.REG.length; i++) if (S.REG[i].c === code) return S.REG[i].n;
    return '';
  }

  // ── Le bandeau de provenance : tout s'y LIT, rien ne s'y écrit ───────────
  function provenance() {
    var C = MR.couverture;
    return '<div class="mfr-note"><b>D\'où viennent ces chiffres.</b><br>' +
      'Année ' + esc(MR.annee) + ' : ' + esc(MR.source) + '. ' +
      nb(S.prods.length) + ' références de notre catalogue sur ' + nb(C.catalogue_remboursable) +
      ' remboursables ont un volume régional (' +
      pct(C.couvert_remboursable / C.catalogue_remboursable * 100) + ') et ' +
      nb(C.couvert_non_remboursable) + ' sur ' + nb(C.catalogue_non_remboursable) +
      ' non remboursables.' +
      // Une phrase qui commence par « 0 codes… » se lit comme une anomalie : quand
      // il n'y a rien à signaler, on n'écrit rien.
      (S.horsCat ? ' ' + nb(S.horsCat) + (S.horsCat > 1 ? ' codes du fichier ne sont pas' : ' code du fichier n\'est pas') +
        ' à notre catalogue : ' + (S.horsCat > 1 ? 'ils ne sont' : 'il n\'est') + ' pas cherchable' +
        (S.horsCat > 1 ? 's' : '') + ' ici.' : '') + '<br>' +
      'Les ' + nb(S.NR) + ' régions sont celles de la source, pas celles de l\'INSEE : ' +
      'la Corse n\'y a pas de code — elle est comptée dans « ' + esc(nomRegion('93')) +
      ' » — et l\'outre-mer est regroupé en un seul code.<br>' +
      'Nos officines : ' + nb(S.totOff) + ' des ' + nb(S.nOff) +
      ' du fichier sont rattachées à une région par leur code postal (' +
      pct(S.nOff ? S.totOff / S.nOff * 100 : 0) + ')' +
      (S.offSans ? ' ; ' + (S.offSans > 1 ? 'les ' + nb(S.offSans) + ' autres n\'ont pas' : 'la dernière n\'a pas') +
        ' de code postal renseigné' : '') + '.' +
      (S.regVide.some(Boolean)
        ? '<br><b>Un trou dans la source.</b> ' +
          S.REG.filter(function (r, i) { return S.regVide[i]; }).map(function (r) { return esc(r.n); }).join(', ') +
          ' : aucun euro sur aucune des ' + nb(S.prods.length) + ' références du fichier, ' +
          'alors que la plus forte région en porte ' + eur(Math.max.apply(null, S.totE)) +
          '. Ce n\'est pas un marché nul, c\'est une donnée manquante — l\'écran l\'écrit au lieu d\'afficher 0 €.'
        : '') + '</div>';
  }

  // ── L'écran ──────────────────────────────────────────────────────────────
  var q = '', selCip = null;

  function trouve() {
    var t = q.trim().toUpperCase();
    var L = t ? S.prods.filter(function (p) {
      return p.d.toUpperCase().indexOf(t) >= 0 || p.labo.toUpperCase().indexOf(t) >= 0 ||
             p.cip.indexOf(t) >= 0;
    }) : S.prods;
    return L.slice(0, 8);
  }
  function selection() {
    if (selCip) { for (var i = 0; i < S.prods.length; i++) if (S.prods[i].cip === selCip) return S.prods[i]; }
    var L = trouve();
    return L.length ? L[0] : S.prods[0];
  }
  function indHtml(v) {
    if (v == null) return '<i class="eq">—</i>';
    return '<i class="' + (v >= 105 ? 'up' : v <= 95 ? 'dn' : 'eq') + '">' + nb(v) + '</i>';
  }

  function listeHtml() {
    var L = trouve(), sel = selection();
    return L.map(function (p) {
      return '<li aria-current="' + (p === sel) + '"><button type="button" data-cip="' + esc(p.cip) + '">' +
        '<span><span class="d">' + esc(p.d) + '</span><span class="c">' + esc(p.labo) + ' · ' +
        esc(p.cip) + ' · ' + esc(famNom(p.fam)) + '</span></span>' +
        '<span class="v">' + eur(p.e) + '</span></button></li>';
    }).join('') ||
      '<li><div class="mfr-note" style="margin:0">Aucune référence ne correspond, parmi les ' +
      nb(S.prods.length) + ' de notre catalogue qui ont un marché régional.</div></li>';
  }

  function ficheHtml() {
    var p = selection();
    if (!p) return '';
    var max = Math.max.apply(null, p.re);
    var amx = p.a ? Math.max.apply(null, p.a) : 1;
    // « Là où il pèse le plus / le moins » doit désigner un TERRITOIRE. Le code
    // « 99 » de la source est un fourre-tout (bénéficiaire sans région connue) :
    // il sortait en tête des « moins », ce qui n'apprend rien et se lit comme une
    // vraie région. Il reste dans la liste des barres, jamais dans un superlatif.
    var meilleure = -1, pire = -1;
    S.REG.forEach(function (r, i) {
      if (r.c === '99') return;
      var v = indice(p.re, i); if (v == null) return;
      if (meilleure < 0 || v > indice(p.re, meilleure)) meilleure = i;
      if (pire < 0 || v < indice(p.re, pire)) pire = i;
    });
    // Toutes les régions sans indice (référence à 0 € partout) : pas de superlatif.
    var kpiReg = meilleure < 0 ? '' :
      '<div class="v2-kpi k4"><div class="v2-kpi-l">Là où il pèse le plus</div>' +
      '<div class="v2-kpi-v" style="font-size:19px">' + esc(S.REG[meilleure].n) + '</div>' +
      '<div class="v2-kpi-d">indice ' + nb(indice(p.re, meilleure)) + ' · ' + eur(p.re[meilleure]) + '</div></div>' +
      '<div class="v2-kpi k3"><div class="v2-kpi-l">Là où il pèse le moins</div>' +
      '<div class="v2-kpi-v" style="font-size:19px">' + esc(S.REG[pire].n) + '</div>' +
      '<div class="v2-kpi-d">indice ' + nb(indice(p.re, pire)) + ' · ' + eur(p.re[pire]) + '</div></div>';

    return '<div class="v2-kpis" style="margin-top:var(--gap-grid)">' +
      '<div class="v2-kpi k1"><div class="v2-kpi-l">Marché France</div>' +
      '<div class="v2-kpi-v">' + eur(p.e) + '</div>' +
      '<div class="v2-kpi-d">' + uni(p.b) + ' de boîtes remboursées en ' + esc(MR.annee) + '</div></div>' +
      '<div class="v2-kpi k2"><div class="v2-kpi-l">Nos officines qui en achètent</div>' +
      '<div class="v2-kpi-v">' + nb(p.nbph) + '</div>' +
      '<div class="v2-kpi-d">sur ' + nb(S.nOff) + ' du fichier</div></div>' + kpiReg + '</div>' +

      '<div class="mfr-cols"><section class="v2-card"><h2>Les ' + nb(S.NR) + ' régions</h2>' +
      '<p class="mfr-sub">Euros remboursés, puis l\'indice : 100 = la région pèse sur cette ' +
      'référence exactement ce qu\'elle pèse sur l\'ensemble du marché.</p><div class="mfr-bars">' +
      S.REG.map(function (r, i) {
        return '<div class="mfr-b"><span>' + esc(r.n) + '</span>' + jauge(max ? p.re[i] / max : 0) +
          '<em>' + eurReg(p.re[i], i) + '</em>' + indHtml(indice(p.re, i)) + '</div>';
      }).join('') + '</div></section>' +

      '<section class="v2-card"><h2>La fiche</h2><div class="mfr-lignes">' +
      [['Code CIP', esc(p.cip)],
       ['Laboratoire', esc(p.labo) || '—'],
       ['Nature', esc(famNom(p.fam))],
       ['Prix net Intégral', EUR2.format(p.net || 0) + ' €'],
       ['Stock, tous établissements', nb(p.stock) + ' unités'],
       ['Boîtes remboursées en France', nb(p.b)],
       ['Euros par boîte', (p.b ? EUR2.format(p.e / p.b) : '0') + ' €']
      ].map(function (l) { return '<div class="mfr-l"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>'; }).join('') +
      '</div>' +
      '<p class="mfr-st" style="margin-top:var(--sp-6)">Par tranche d\'âge, au national</p>' +
      '<div class="mfr-bars">' + S.AGES.map(function (a, j) {
        var v = p.a ? p.a[j] : 0;
        return '<div class="mfr-b age"><span>' + esc(ageNom(a)) + '</span>' +
          jauge(amx ? v / amx : 0, 'v') + '<em>' + uni(v) + '</em></div>';
      }).join('') + '</div>' +
      '<div class="mfr-note">L\'âge n\'existe qu\'au national : la source ne le croise pas avec ' +
      'la région sur le fichier qui porte les euros.</div></section></div>';
  }

  function peindre(root) {
    var el = root.querySelector('#mfr-res'); if (el) el.innerHTML = listeHtml();
    var f = root.querySelector('#mfr-fiche'); if (f) f.innerHTML = ficheHtml();
  }

  function brancher(root) {
    var inp = root.querySelector('#mfr-q');
    if (inp) {
      inp.addEventListener('input', function (e) { q = e.target.value; selCip = null; peindre(root); });
      // La touche Entrée ne recharge pas la page : la liste est déjà à jour.
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    }
    var res = root.querySelector('#mfr-res');
    if (res) res.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cip]'); if (!b) return;
      selCip = b.getAttribute('data-cip');
      peindre(root);
      var f = root.querySelector('#mfr-fiche');
      if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function charger() {
    if (_chargeEnCours) return;
    _chargeEnCours = true;
    var base = (window.V2_DATA_BASE || '../') + 'v2/';
    // Le catalogue part EN PREMIER : V2.loadFiles pose `V2.versionDonnees` au
    // passage, et c'est ce jeton-là qu'il faut sur le JSON — sinon un téléphone
    // qui a l'ancien fichier en cache continuerait de le servir.
    var pCat = V2.loadFiles ? V2.loadFiles(['catcomplet']) : Promise.resolve();
    var V = V2.versionDonnees || '';
    // Jeton absent (premier chargement, ordre inattendu) : on refuse le cache
    // plutôt que de risquer une version périmée sans le savoir.
    var pJson = fetch(base + 'marche-regional.json' + V, V ? undefined : { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    Promise.all([pJson, pCat]).then(function (o) {
      MR = o[0];
      if (!MR || !MR.regions || !MR.regions.length || !MR.data) throw new Error('marche-regional.json vide ou illisible');
      // Le catalogue est indispensable : sans lui, aucune référence n'a de nom.
      // Sans cette garde, socle() rendrait null indéfiniment et le render
      // rappellerait charger() en boucle.
      if (!(V2.produits && V2.produits.catalogueIndex && V2.produits.catalogueIndex()))
        throw new Error('catalogue des références indisponible');
      _echec = null;
    }).catch(function (e) {
      // Une lecture qui échoue ne condamne pas la donnée : on le DIT, on n'affiche
      // pas un écran vide qui ressemblerait à un marché inexistant.
      _echec = String(e && e.message || e);
      console.warn('[V2 marché] ' + _echec);
    }).then(function () {
      _chargeEnCours = false;
      if (V2.route && V2.route.name === 'marchefr') V2.render();
    });
  }

  V2.pages.marchefr = {
    needs: [],
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      var tete = '<div class="v2-wrap">' +
        '<span class="v2-eyebrow"><span class="dot"></span>Le marché français, par référence</span>' +
        '<h1 class="v2-page-title">La fiche marché d\'une référence</h1>';

      if (_echec) {
        root.innerHTML = top + tete +
          '<p class="v2-page-sub">Les données du marché n\'ont pas pu être lues.</p>' +
          '<div class="mfr-note"><b>Lecture en échec : ' + esc(_echec) + '.</b><br>' +
          'C\'est le chargement qui a raté, pas la donnée. Recharge l\'écran ; ' +
          'si ça persiste, le fichier <code>v2/marche-regional.json</code> n\'est pas servi.' +
          '</div></div>';
        return;
      }
      if (!socle()) {
        root.innerHTML = top + '<div class="v2-wrap"><div class="v2-loading">' +
          '<div class="v2-spinner"></div><div>Chargement du marché français…</div></div></div>';
        charger();
        return;
      }

      root.innerHTML = top + tete +
        '<p class="v2-page-sub">Cherche une référence, et vois son marché français en euros, ' +
        'sa répartition région par région avec l\'indice de chacune, ses tranches d\'âge, et ' +
        'notre position dessus. L\'écran qu\'on ouvre avant un rendez-vous.</p>' +
        '<div class="mfr-rech">' +
        '<input id="mfr-q" type="search" placeholder="Nom, laboratoire ou code CIP" ' +
        'autocomplete="off" aria-label="Chercher une référence" value="' + esc(q) + '">' +
        '<button type="button" class="v2-btn v2-btn-primary" onclick="document.getElementById(\'mfr-q\').focus()">' +
        ICO('search', 16, 2) + ' Chercher</button></div>' +
        '<ul class="mfr-res" id="mfr-res">' + listeHtml() + '</ul>' +
        '<div id="mfr-fiche">' + ficheHtml() + '</div>' +
        provenance() + '</div>';
      brancher(root);
    }
  };
})();
