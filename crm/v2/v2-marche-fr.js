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
      '.mfr-note b{color:var(--ip-ink-2)}',
      // ── Second bloc « Au-delà du médicament » ─────────────────────────
      '.mfr-h2{font-size:19px;font-weight:800;letter-spacing:-.025em;margin:var(--sp-8) 0 0;',
      ' padding-top:var(--sp-6);border-top:1px solid var(--line-2)}',
      // Un libellé LPP fait jusqu'à 70 caractères : c'est lui qui prend la
      // place, pas une colonne fixe de 150 px qui le couperait au tiers.
      '.mfr-b.lpp{grid-template-columns:minmax(0,1fr) 72px 104px}',
      '@media(max-width:640px){.mfr-b.lpp{grid-template-columns:minmax(0,1fr) 48px 76px}}',
      // Un libellé LPP coupé au tiers n'apprend rien : il passe à la ligne.
      '.mfr-b.lpp span:first-child{white-space:normal;text-overflow:clip;line-height:1.35}',
      // « 13,8 % » ne tient pas dans les 54 px de la pastille d'indice : elle
      // se coupait en deux lignes et doublait la hauteur de chaque ligne.
      // 5e colonne : nos officines. Étroite et en chiffres, elle ne vole pas
      // la place du nom de région — c'est la jauge qui absorbe la différence.
      // Le nom de région garde ses 150 px : à 132, « Bourgogne-Franche-Comté »
      // et « Auvergne-Rhône-Alpes » se coupaient. C'est la jauge qui cède.
      '.mfr-b.dmr{grid-template-columns:150px 1fr 92px 58px 38px}',
      '.mfr-b.dmr i{white-space:nowrap}',
      '.mfr-b.dmr u{text-decoration:none;font-family:var(--mono);font-size:12.5px;',
      ' text-align:right;font-weight:700;color:var(--ip-blue)}',
      // Région sans aucune de nos officines : présente, lisible, mais en
      // retrait. On ne la SUPPRIME pas — « Outre-mer » reste du marché réel.
      // ⚠️ Le retrait ne touche QUE la jauge et la pastille, jamais le texte :
      // un `opacity:.55` sur la ligne entière faisait tomber le nom de région
      // à 2,23:1 (mesuré sous WebKit le 28/09 — le piège d'`opacity` du 15/08,
      // repris tel quel). Le texte garde son contraste, la couleur dit le reste.
      '.mfr-b.dmr.hors .mfr-j{opacity:.4}',
      '.mfr-b.dmr.hors .mfr-j i{background:var(--muted)}',
      '.mfr-b.dmr.hors i.eq{background:transparent;padding-left:0;padding-right:0}',
      '.mfr-b.dmr.hors u{color:var(--muted);font-weight:400}',
      // À 390 px la jauge de cette ligne ne sert plus à rien : 5 colonnes ne
      // tiennent pas. Elle disparaît, les 4 chiffres restent.
      '@media(max-width:640px){.mfr-b.dmr{grid-template-columns:1fr 78px 54px 34px;gap:var(--sp-2)}',
      ' .mfr-b.dmr .mfr-j{display:none}}',
      '.mfr-leg{font-size:12px;color:var(--muted);line-height:1.5;margin-top:var(--sp-3)}',
      '.mfr-leg b{color:var(--ip-ink-2);font-weight:700}',
      // Le filtre des codes LPP. font-size 16px : en dessous, iOS zoome au focus.
      '.mfr-lppq{margin-top:var(--sp-5)}',
      '.mfr-lppq input{min-height:var(--tap-min);width:100%;box-sizing:border-box;',
      ' font-family:var(--font);font-size:16px;padding:0 var(--sp-3);color:var(--ip-ink);',
      ' border:1px solid var(--line-strong);border-radius:var(--r-btn);background:var(--card)}',
      '.mfr-lppq input:focus{outline:2px solid var(--ip-blue);outline-offset:1px}',
      // ⚠️ pas de `all:unset` : WebKit le déplie en backdrop-filter (faux
      // positif « effet interdit Safari ») et casse box-sizing.
      '.mfr-plusbtn{-webkit-appearance:none;appearance:none;margin:var(--sp-3) 0 0;',
      ' font:inherit;font-size:13px;font-weight:650;cursor:pointer;width:100%;',
      ' box-sizing:border-box;min-height:var(--tap-min);padding:0 var(--sp-4);',
      ' background:var(--card-2);color:var(--ip-blue);border:1px solid var(--line);',
      ' border-radius:var(--r-btn)}',
      '.mfr-plusbtn:hover{background:var(--surf-sunken)}',
      '.mfr-plusbtn:focus-visible{outline:2px solid var(--ip-blue);outline-offset:1px}',
      '.mfr-plusbtn span{color:var(--muted);font-weight:400}',
      '.mfr-sigs{display:grid;gap:var(--sp-3);margin-top:var(--sp-4)}',
      '.mfr-sig{padding:var(--sp-3) 0;border-bottom:1px solid var(--line-2)}',
      '.mfr-sigs .mfr-sig:last-child{border-bottom:none;padding-bottom:0}',
      '.mfr-sig-t{display:grid;grid-template-columns:1fr auto;gap:var(--sp-3);align-items:center}',
      '.mfr-sig-t b{font-size:14.5px;font-weight:700;letter-spacing:-.01em}',
      '.mfr-sig-t i{font-style:normal;font-family:var(--mono);font-size:12.5px;',
      ' padding:2px 7px;border-radius:var(--r-pill);white-space:nowrap}',
      '.mfr-sig-t i.up{background:#E6F6EF;color:var(--c-mint-txt)}',
      '.mfr-sig-t i.dn{background:#FDECEF;color:var(--c-rose-txt)}',
      '.mfr-sig-t i.eq{background:#EFF1F6;color:var(--muted)}',
      '.mfr-sig-d{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.5}',
      '.mfr-sig-r{font-size:12.5px;color:var(--ip-blue);font-weight:650;margin-top:3px}'
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


  // ══════════════════════════════════════════════════════════════════════
  // SECOND BLOC · « Au-delà du médicament »
  // Choix de Will le 28/09/2026 : les dispositifs médicaux et les signaux
  // des urgences n'ont AUCUNE entrée par référence — les DM portent un code
  // LPP que nos produits n'ont pas, les signaux sont des pathologies. Ils
  // vivent donc SOUS la fiche, dans un bloc à part, jamais dans la barre de
  // recherche : y chercher un CIP ne rendrait jamais rien.
  // Les deux lectures sont indépendantes et facultatives : si l'une échoue,
  // l'autre s'affiche quand même, et l'écran du haut n'est jamais touché.
  // ══════════════════════════════════════════════════════════════════════
  var DM = null, ODI = null, DMS = null;
  var _plusEnCours = false, _plusFini = false, _echecDm = null, _echecOdi = null;
  // Exploration des codes LPP : la carte en montre un premier paquet, et on
  // en déplie un de plus à chaque clic. `qLpp` filtre sur le libellé.
  // ⚠️ Ce filtre vit DANS la carte : la recherche du haut reste interdite aux
  // dispositifs médicaux (décision de Will du 28/09 — nos références ne
  // portent pas de code LPP, elles ne peuvent donc pas y mener).
  var LPP_PAS = 8;
  var qLpp = '', lppN = LPP_PAS;

  // La Corse est éclatée en 2A/2B dans les fichiers par département, et en
  // « 20 » dans le nôtre : sans ce repli, ses officines ne seraient comptées
  // sur aucun signal.
  function depNorm(d) {
    d = String(d == null ? '' : d).trim().toUpperCase();
    if (d === '2A' || d === '2B') return '20';
    if (/^\d$/.test(d)) return '0' + d;
    return d;
  }
  // Nos officines par département, calculé une fois.
  var _offDep = null;
  function offParDep() {
    if (_offDep) return _offDep;
    _offDep = {};
    (V2.pharmacies || []).forEach(function (p) {
      var d = depDeCp(p.cp); if (d) _offDep[d] = (_offDep[d] || 0) + 1;
    });
    return _offDep;
  }

  function socleDm() {
    if (DMS || !DM) return DMS;
    var REG = DM.regions, NR = REG.length, AG = DM.ages || [], i;
    var totE = [], totQ = [], totA = [];
    for (i = 0; i < NR; i++) { totE[i] = 0; totQ[i] = 0; }
    for (i = 0; i < AG.length; i++) totA[i] = 0;

    var codes = [];
    Object.keys(DM.data).forEach(function (code) {
      var v = DM.data[code], e = v.e || [], qq = v.q || [], se = 0, sq = 0;
      for (var k = 0; k < NR; k++) {
        totE[k] += e[k] || 0; totQ[k] += qq[k] || 0;
        se += e[k] || 0; sq += qq[k] || 0;
      }
      if (v.a) for (var j = 0; j < AG.length; j++) totA[j] += v.a[j] || 0;
      codes.push({ code: code, l: v.l || '', e: se, q: sq });
    });
    codes.sort(function (a, b) { return b.e - a.e; });

    var tE = 0, tQ = 0;
    for (i = 0; i < NR; i++) { tE += totE[i]; tQ += totQ[i]; }

    // ── Nos officines, région par région ─────────────────────────────────
    // Le seul pont honnête entre ce marché national et nous. Les codes de
    // région du fichier LPP sont ceux de la CNAM, exactement ceux que DEP_REG
    // rend : le rapprochement se fait par code, jamais par nom (le libellé de
    // « 93 » a déjà changé le 27/09 quand « et Corse » a été ajouté).
    var phs = V2.pharmacies || [], offReg = {}, offHors = 0;
    phs.forEach(function (ph) {
      var r = DEP_REG[depDeCp(ph.cp)];
      if (r) offReg[r] = (offReg[r] || 0) + 1; else offHors++;
    });

    DMS = { REG: REG, NR: NR, AG: AG, codes: codes, totE: totE, totQ: totQ, totA: totA,
      tE: tE, tQ: tQ, offReg: offReg, offHors: offHors, nOff: phs.length };
    return DMS;
  }

  // ── Les codes LPP : filtrer et déplier ───────────────────────────────
  // Les 2 000 codes sont TOUS déjà en mémoire : n'en montrer que 8 revenait à
  // charger 515 Ko pour en afficher 0,4 %. On ne recharge rien, on déplie.
  function lppRetenus() {
    var D = socleDm(); if (!D) return [];
    var f = qLpp.trim().toLowerCase();
    if (!f) return D.codes;
    return D.codes.filter(function (c) {
      return (c.l || '').toLowerCase().indexOf(f) >= 0 ||
             String(c.code).toLowerCase().indexOf(f) >= 0;
    });
  }

  function lppZoneHtml() {
    var D = socleDm(); if (!D) return '';
    var L = lppRetenus();
    var vus = L.slice(0, lppN);
    // L'échelle suit ce qu'on REGARDE : rapportée au plus gros code de la
    // sélection, sinon un filtre sur de petits codes rendrait 14 traits vides.
    var maxV = vus.length ? vus[0].e : 0;
    var reste = L.length - vus.length;

    var titre = qLpp.trim()
      ? (L.length ? nb(L.length) + (L.length > 1 ? ' codes LPP trouvés' : ' code LPP trouvé') +
          (reste > 0 ? ', les ' + nb(vus.length) + ' plus gros' : '')
        : 'Aucun code LPP ne porte ces mots')
      : 'Les ' + nb(vus.length) + ' plus gros codes LPP' +
        (reste > 0 ? ', sur ' + nb(L.length) : '');

    return '<p class="mfr-st" style="margin-top:var(--sp-6)">' + esc(titre) + '</p>' +
      '<div class="mfr-bars" id="mfr-lppbars">' +
      vus.map(function (c) {
        return '<div class="mfr-b lpp"><span title="' + esc(c.code + ' · ' + c.l) + '">' +
          esc(c.l) + '</span>' + jauge(maxV ? c.e / maxV : 0) +
          '<em>' + eur(c.e) + '</em></div>';
      }).join('') + '</div>' +
      (reste > 0
        ? '<button type="button" class="mfr-plusbtn" data-lpp-plus="1">' +
          'Voir ' + nb(Math.min(reste, LPP_PAS)) + ' code' +
          (Math.min(reste, LPP_PAS) > 1 ? 's' : '') + ' de plus' +
          ' <span>(' + nb(reste) + ' restant' + (reste > 1 ? 's' : '') + ')</span></button>'
        : (lppN > LPP_PAS
          ? '<button type="button" class="mfr-plusbtn" data-lpp-plus="0">Replier la liste</button>'
          : ''));
  }

  // ── La carte des dispositifs médicaux ────────────────────────────────
  function carteDm() {
    if (_echecDm) {
      return '<section class="v2-card"><h2>Les dispositifs médicaux</h2>' +
        '<div class="mfr-note" style="margin-top:var(--sp-4)"><b>Lecture en échec : ' +
        esc(_echecDm) + '.</b><br>C\'est le chargement qui a raté, pas la donnée. ' +
        'Recharge l\'écran.</div></section>';
    }
    var D = socleDm();
    if (!D) return '<section class="v2-card"><h2>Les dispositifs médicaux</h2>' +
      '<p class="mfr-sub">Chargement du marché LPP…</p></section>';

    var C = DM.couverture || {};
    var maxR = Math.max.apply(null, D.totE);
    var HAUT = D.codes.slice(0, LPP_PAS);
    var partHaut = D.tE ? HAUT.reduce(function (a, c) { return a + c.e; }, 0) / D.tE : 0;
    var maxA = D.totA.length ? Math.max.apply(null, D.totA) : 0;

    return '<section class="v2-card"><h2>Les dispositifs médicaux</h2>' +
      '<p class="mfr-sub">' + esc(DM.source) + ', année ' + esc(DM.annee) + '. ' +
      'Le marché se voit par <b>code LPP</b> : nos références n\'en portent pas, ' +
      'la barre de recherche du haut ne peut donc pas y mener.</p>' +

      '<div class="mfr-lignes">' +
      [['Marché remboursé', eur(D.tE)],
       ['Quantités remboursées', uni(D.tQ)],
       ['Codes LPP retenus', nb(C.codes_retenus || D.codes.length) +
         (C.codes_total ? ' sur ' + nb(C.codes_total) : '')],
       ['Part des euros couverte', C.part_euros != null ? pct(C.part_euros) : '—'],
       ['Poids des ' + nb(HAUT.length) + ' premiers codes', pct(partHaut * 100)]
      ].map(function (l) { return '<div class="mfr-l"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>'; }).join('') +
      '</div>' +

      '<div class="mfr-lppq"><input id="mfr-lppq" type="search" ' +
      'placeholder="Filtrer les ' + nb(D.codes.length) + ' codes LPP (pansement, orthèse, perfusion…)" ' +
      'autocomplete="off" aria-label="Filtrer les codes LPP" value="' + esc(qLpp) + '"></div>' +
      '<div id="mfr-lppzone">' + lppZoneHtml() + '</div>' +

      '<p class="mfr-st" style="margin-top:var(--sp-6)">Les ' + nb(D.NR) +
      ' régions, en euros remboursés</p><div class="mfr-bars">' +
      D.REG.map(function (r, i) {
        var n = D.offReg[r.c] || 0;
        // Une région où nous n'avons AUCUNE officine passe en retrait : ce
        // n'est pas notre terrain. La règle se lit dans nos données, elle
        // n'est écrite en dur pour aucune région — le jour où une officine
        // ouvre en Outre-mer, la ligne se rallume toute seule.
        return '<div class="mfr-b dmr' + (n ? '' : ' hors') + '"><span>' + esc(r.n) + '</span>' +
          jauge(maxR ? D.totE[i] / maxR : 0) + '<em>' + eur(D.totE[i]) + '</em>' +
          '<i class="eq">' + pct(D.tE ? D.totE[i] / D.tE * 100 : 0, 1) + '</i>' +
          '<u title="Nos officines dans cette région">' + (n ? nb(n) : '—') + '</u></div>';
      }).join('') + '</div>' +
      // Ce que la colonne de droite compte, dit en clair sous les barres :
      // un nombre sans légende se lit comme n'importe quoi.
      (D.nOff ? '<p class="mfr-leg">La colonne de droite compte <b>nos ' + nb(D.nOff) +
        ' officines</b> dans chaque région. Les régions où nous n\'en avons aucune ' +
        'sont en retrait.' + (D.offHors ? ' ' + nb(D.offHors) + ' officine' +
        (D.offHors > 1 ? 's ont un code postal qui ne tombe dans aucune région' :
        ' a un code postal qui ne tombe dans aucune région') + '.' : '') + '</p>' : '') +

      (maxA ? '<p class="mfr-st" style="margin-top:var(--sp-6)">Par tranche d\'âge, ' +
        'au national</p><div class="mfr-bars">' +
        D.AG.map(function (a, j) {
          return '<div class="mfr-b age"><span>' + esc(ageNom(a)) + '</span>' +
            jauge(D.totA[j] / maxA, 'v') + '<em>' + uni(D.totA[j]) + '</em></div>';
        }).join('') + '</div>' : '') +

      // L'avertissement et la licence se LISENT dans le fichier : ce sont eux
      // qui disent ce que ce total n'est pas. Les réécrire ici, c'est se
      // condamner à mentir le jour où la source change.
      '<div class="mfr-note"><b>Ce que ce total n\'est pas.</b><br>' +
      esc(DM.avertissement) +
      (DM.licence ? '<br><b>Licence.</b> ' + esc(DM.licence) : '') +
      '</div></section>';
  }

  // ── La carte des signaux des urgences ────────────────────────────────
  function carteOdisse() {
    if (_echecOdi) {
      return '<section class="v2-card"><h2>Les signaux du terrain</h2>' +
        '<div class="mfr-note" style="margin-top:var(--sp-4)"><b>Lecture en échec : ' +
        esc(_echecOdi) + '.</b><br>C\'est le chargement qui a raté, pas la donnée. ' +
        'Recharge l\'écran.</div></section>';
    }
    var P = ODI && ODI.pathologies;
    if (!P) return '<section class="v2-card"><h2>Les signaux du terrain</h2>' +
      '<p class="mfr-sub">Chargement de la veille des urgences…</p></section>';

    var OD = offParDep();
    // Trié par tendance décroissante : ce qui monte le plus se lit en premier.
    var L = P.slice().sort(function (a, b) { return (b.trend || 0) - (a.trend || 0); });
    var sem = String(ODI.week || '').replace(/^(\d{4})-S(\d+)$/, 'semaine $2 de $1');

    return '<section class="v2-card"><h2>Les signaux du terrain</h2>' +
      '<p class="mfr-sub">' + esc(ODI.source) + (sem ? ', ' + esc(sem) : '') + '. ' +
      'Ce sont des <b>pathologies</b>, pas des références : elles disent quel rayon ' +
      'va bouger, jamais quelle boîte.</p>' +

      '<div class="mfr-sigs">' + L.map(function (p) {
        var t = p.trend, cls = t == null ? 'eq' : t >= 5 ? 'up' : t <= -5 ? 'dn' : 'eq';
        var badge = t == null ? '—' : (t > 0 ? '+' : '') + nb(t) + ' %';
        var hot = (p.hotDeps || []).slice(0, 3);
        // Nos officines dans les départements les plus touchés : c'est le seul
        // pont honnête entre ce signal et nous.
        var nOff = 0, dedup = {};
        (p.hotDeps || []).forEach(function (h) {
          var d = depNorm(h.dep);
          if (dedup[d]) return; dedup[d] = 1; nOff += OD[d] || 0;
        });
        return '<div class="mfr-sig"><div class="mfr-sig-t">' +
          '<b>' + esc(p.label) + '</b><i class="' + cls + '">' + badge + '</i></div>' +
          '<div class="mfr-sig-d">' +
          (p.moyennePct != null ? pct(p.moyennePct) + ' des passages aux urgences' : '') +
          (p.age ? ' · ' + esc(p.age) : '') + '</div>' +
          (hot.length ? '<div class="mfr-sig-d">Le plus fort : ' +
            hot.map(function (h) { return esc(h.n) + ' (' + pct(h.pct) + ')'; }).join(', ') +
            '</div>' : '') +
          (p.rayons ? '<div class="mfr-sig-r">' + esc(p.rayons) + '</div>' : '') +
          // Zéro officine concernée s'écrit en clair : c'est une information,
          // pas un vide. Mais on ne l'écrit que si on sait compter.
          (S.nOff ? '<div class="mfr-sig-d">' + (nOff
            ? nb(nOff) + (nOff > 1 ? ' de nos officines sont' : ' de nos officines est') +
              ' dans ces départements'
            : 'Aucune de nos officines dans ces départements') + '</div>' : '') +
          '</div>';
      }).join('') + '</div>' +

      (ODI.note ? '<div class="mfr-note"><b>Comment lire ces taux.</b><br>' +
        esc(ODI.note) + '</div>' : '') +
      ((ODI.manquantes && ODI.manquantes.length)
        ? '<div class="mfr-note"><b>Départements sans relevé cette semaine.</b><br>' +
          esc(ODI.manquantes.join(', ')) + '</div>' : '') +
      '</section>';
  }

  function blocPlusHtml() {
    return '<h2 class="mfr-h2">Au-delà du médicament</h2>' +
      '<p class="mfr-sub" style="margin-bottom:0">Deux marchés que la fiche du haut ne ' +
      'peut pas montrer, parce qu\'ils n\'ont pas d\'entrée par référence. Ils sont ici, ' +
      'sous la fiche, et se lisent seuls.</p>' +
      '<div class="mfr-cols">' + carteDm() + carteOdisse() + '</div>';
  }

  function chargerPlus() {
    if (_plusEnCours || _plusFini) return;
    _plusEnCours = true;
    var base = (window.V2_DATA_BASE || '../') + 'v2/';
    var V = V2.versionDonnees || '';
    // marche-dm.json suit le déploiement : il prend le jeton de cache.
    var pDm = fetch(base + 'marche-dm.json' + V, V ? undefined : { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.regions || !j.regions.length || !j.data) throw new Error('marche-dm.json vide ou illisible');
        DM = j; DMS = null;
      })
      .catch(function (e) { _echecDm = String(e && e.message || e); console.warn('[V2 marché · DM] ' + _echecDm); });
    // odisse.json est réécrit chaque jour par un robot : il se datte au jour,
    // comme partout ailleurs dans l'app, sinon on servirait la semaine passée.
    var pOdi = fetch(base + 'odisse.json?d=' + new Date().toISOString().slice(0, 10), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.pathologies || !j.pathologies.length) throw new Error('odisse.json sans pathologie');
        ODI = j;
      })
      .catch(function (e) { _echecOdi = String(e && e.message || e); console.warn('[V2 marché · signaux] ' + _echecOdi); });

    Promise.all([pDm, pOdi]).then(function () {
      _plusEnCours = false; _plusFini = true;
      var el = document.getElementById('mfr-plus');
      // Repeindre le seul bloc : un V2.render() complet remettrait la recherche
      // à zéro et perdrait la référence que Will venait de choisir.
      if (el) {
        el.innerHTML = blocPlusHtml();
        // Les cartes fabriquées APRÈS le rendu de la page n'ont jamais vu la
        // passe d'apparition : sans ce rappel, elles arrivent d'un coup, et
        // surtout leur sort dépend d'une course avec la passe précédente.
        if (V2.motion && V2.motion.pass) try { V2.motion.pass(); } catch (e) {}
      }
    });
  }

  // On ne repeint QUE la liste des codes : refaire toute la carte rendrait le
  // champ de filtre au navigateur, qui lui reprendrait le curseur au premier
  // caractère tapé.
  function repeindreLpp() {
    var z = document.getElementById('mfr-lppzone');
    if (z) z.innerHTML = lppZoneHtml();
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
    // Le second bloc est repeint APRÈS coup par chargerPlus() : on écoute sur
    // #mfr-plus, qui lui SURVIT (seul son contenu est remplacé). Brancher sur
    // le champ lui-même le perdrait au premier repeint.
    var plus = root.querySelector('#mfr-plus');
    if (plus) {
      plus.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'mfr-lppq') return;
        qLpp = e.target.value; lppN = LPP_PAS;
        repeindreLpp();
      });
      plus.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-lpp-plus]') : null;
        if (!b) return;
        lppN = b.getAttribute('data-lpp-plus') === '0' ? LPP_PAS : lppN + LPP_PAS;
        repeindreLpp();
      });
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
        '<div id="mfr-plus">' + blocPlusHtml() + '</div>' +
        provenance() + '</div>';
      brancher(root);
      // Le second bloc se charge APRÈS coup : l'écran du haut ne l'attend pas,
      // et un échec de sa lecture ne l'empêche pas de s'afficher.
      chargerPlus();
    }
  };
})();
