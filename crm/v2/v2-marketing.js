/* ═══════════════════════════════════════════════════════════════════
   OPSO Santé · Pilier MARKETING — Fiche « Le catalogue du mois »
   (Intégral Pharma by OPSO Santé), destinée au PHARMACIEN.
   Une fiche A4 : jusqu'à 12 produits rangés par univers, avec « Votre prix »
   = le tarif HT de la plateforme Offilog (jamais une condition Intégral :
   ni prix barré, ni pourcentage, ni offre).
   N'est chargé QUE dans l'app opso/v2/ (mode OPSO).
   Produits : OFFILOG_LIVE (public) · Prix : OFFILOG_LIVE_PRIX (protégé,
   chargé après connexion) — voir buildIndex() de v2-offilog.js.
   Sortie : impression navigateur A4 (voir la décision plus bas : offilog.fr
   n'envoie pas d'en-tête CORS, donc html2canvas ne rendrait aucune photo).
   Persistance : localStorage 'v2_opso_selections'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var ICO = window.ICO || function () { return ''; };
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };

  var MAX = 12;

  // ── Univers de la fiche (4, dans cet ordre) ──
  // Table de correspondance : rayon Offilog en clair (`cat` de OFFILOG_LIVE, mêmes
  // valeurs que LIVE_CAT_MAP de v2-offilog.js) → univers de la fiche.
  // Choix : Bébé → Hygiène (change, toilette) · Vétérinaire → Santé ·
  // Coffrets & Cadeaux et Soins du visage → Beauté & soins.
  var UNIVERS = [
    { k: 'sante', label: 'Santé' },
    { k: 'hygiene', label: 'Hygiène' },
    { k: 'beaute', label: 'Beauté & soins' },
    { k: 'solaires', label: 'Solaires' }
  ];
  var CAT_UNIVERS = {
    'sante': 'sante', 'veterinaire': 'sante',
    'hygiene': 'hygiene', 'bebe': 'hygiene',
    'beaute & soins': 'beaute', 'soins du visage': 'beaute', 'coffrets & cadeaux': 'beaute',
    'solaire': 'solaires', 'solaires': 'solaires'
  };
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function universDe(p) { return CAT_UNIVERS[norm(p && p.cat)] || 'sante'; }

  // ── Persistance ──
  var LS_KEY = 'v2_opso_selections';
  function getAll() {
    try { var r = localStorage.getItem(LS_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a.map(normSel) : []; } catch (e) { return []; }
  }
  function writeAll(arr) { try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {} }
  function getOne(id) { return getAll().filter(function (s) { return s.id === id; })[0] || null; }
  function saveOne(sel) {
    var arr = getAll(); var i = arr.findIndex(function (s) { return s.id === sel.id; });
    if (i >= 0) arr[i] = sel; else arr.unshift(sel);
    writeAll(arr);
  }
  function deleteOne(id) { writeAll(getAll().filter(function (s) { return s.id !== id; })); }

  // ── Dates : jamais en dur, toujours calculées ──
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function moisAnnee(d) { try { return cap(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })); } catch (e) { return ''; } }
  // Période par défaut : le mois courant ; à partir du 21, le mois suivant
  // (le catalogue « du mois » sert déjà au mois d'après). Modifiable dans l'éditeur.
  function periodeDefaut() {
    var d = new Date();
    if (d.getDate() > 20) d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return moisAnnee(d);
  }
  function isoJour(d) {
    var m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }
  function jourLong(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }
  var SOUS_TITRE = 'Une sélection de produits pour votre comptoir, à retrouver sur Offilog.';

  // ── Sélection : modèle + reprise des anciennes (avant la fiche « catalogue du mois ») ──
  function normProd(p) {
    p = p || {};
    // Ancien format : cip13 / designation / prixPromo (prix issu des conditions Intégral,
    // volontairement PAS repris). Le produit est retrouvé par son code dans le catalogue Offilog.
    var prix = (p.prix === '' || p.prix == null) ? '' : +p.prix;
    return {
      id: p.id != null ? String(p.id) : '',
      ean: String(p.ean || p.cip13 || ''),
      nom: String(p.nom || p.designation || p.name || ''),
      marque: String(p.marque || ''),
      img: String(p.img || ''),
      cat: String(p.cat || ''),
      prix: (prix !== '' && isFinite(prix) && prix > 0) ? prix : '',
      manual: !!p.manual
    };
  }
  function normSel(s) {
    s = s || {};
    var neuf = s.v === 2;
    return {
      v: 2,
      id: s.id || ('s' + Date.now()),
      title: s.title || 'Le catalogue du mois',
      subtitle: neuf ? (s.subtitle || '') : SOUS_TITRE,
      period: s.period || s.month || periodeDefaut(),
      priceDate: s.priceDate || isoJour(new Date()),
      products: (s.products || []).map(normProd),
      created: s.created || Date.now()
    };
  }
  function createSel() {
    return normSel({ id: 's' + Date.now(), v: 2, title: 'Le catalogue du mois', subtitle: SOUS_TITRE, products: [] });
  }
  function fileSafe(s) { return String(s || 'selection').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'selection'; }

  var editing = null; // sélection en cours d'édition

  // ════════════════════════════════════════════
  // DONNÉES : catalogue Offilog (public) + prix Offilog (protégé)
  // ════════════════════════════════════════════
  var idx = null, idxN = -1;
  function live() { return window.OFFILOG_LIVE || null; }
  function prixLive(id) {
    var P = window.OFFILOG_LIVE_PRIX; if (!P || id == null || id === '') return '';
    var v = P[String(id).replace(/^live-/, '')];
    return (typeof v === 'number' && isFinite(v) && v > 0) ? v : '';
  }
  function buildIdx() {
    var L = live(); if (!L) return null;
    if (idx && idxN === L.length) return idx;
    idx = { byId: {}, byEan: {}, all: [] };
    for (var i = 0; i < L.length; i++) {
      var p = L[i];
      idx.byId[String(p.id)] = p;
      if (p.ean) idx.byEan[String(p.ean)] = p;
      idx.all.push({ p: p, h: norm(p.nom + ' ' + (p.marque || '') + ' ' + (p.ean || '')) });
    }
    idxN = L.length;
    return idx;
  }
  var chargement = null;
  function chargerDonnees() {
    if (chargement) return chargement;
    var fait = function () { chargement = null; };
    try {
      chargement = V2.loadFiles(['offiloglive', 'offiloglivprix']).then(function () { fait(); return true; }, function () { fait(); return false; });
    } catch (e) { chargement = Promise.resolve(false); fait(); }
    return chargement;
  }
  // Nom court : « Marque – produit, format » → marque + produit
  function nomCourt(p) {
    var nom = String(p.nom || ''), marque = String(p.marque || '');
    var parts = nom.split(/\s[–—-]\s/);
    var m = marque, t = nom;
    if (parts.length > 1) {
      var head = parts[0], rest = parts.slice(1).join(' – ');
      var h = norm(head), mm = norm(marque);
      if (!marque || h.indexOf(mm) >= 0 || mm.indexOf(h) >= 0) { t = rest; if (!marque) m = head; }
    }
    return { marque: m, nom: cap(t) };
  }
  function prodDepuisLive(p) {
    var c = nomCourt(p);
    var prix = prixLive(p.id);
    return { id: String(p.id), ean: String(p.ean || ''), nom: c.nom, marque: c.marque, img: p.img || '', cat: p.cat || '', prix: prix, manual: false };
  }
  // Complète une sélection quand les données arrivent : produits d'anciennes
  // sélections retrouvés par leur code, prix Offilog remplis quand la personne n'a rien saisi.
  function completer(sel) {
    var I = buildIdx(), change = false;
    if (!sel) return false;
    sel.products.forEach(function (p) {
      if (I && !p.id) {
        var f = p.ean ? I.byEan[p.ean] : null;
        if (f) { var d = prodDepuisLive(f); p.id = d.id; p.img = p.img || d.img; p.cat = p.cat || d.cat; p.marque = p.marque || d.marque; p.nom = p.nom || d.nom; change = true; }
      }
      if (p.id && p.prix === '' && !p.manual) {
        var v = prixLive(p.id);
        if (v !== '') { p.prix = v; change = true; }
      }
    });
    return change;
  }

  // ════════════════════════════════════════════
  // LA FICHE A4 (HTML partagé : aperçu + impression)
  // ════════════════════════════════════════════
  var sheetN = 0;
  function brandLogo() { return (window.V2_BRAND && window.V2_BRAND.logoWhite) || 'assets/opsosante-logo-blanc.png'; }
  var LOGO_IP = 'assets/logo-integral-serre.png';

  function groupes(sel) {
    var out = [];
    UNIVERS.forEach(function (u) {
      var items = sel.products.filter(function (p) { return universDe(p) === u.k; });
      if (items.length) out.push({ u: u, items: items });
    });
    return out;
  }
  // Hauteur d'une carte : 53 mm tant que ça tient, réduite si un seul univers en porte beaucoup.
  function hauteurCarte(gs) {
    var lignes = 0, lc = 0, R = 0, cur = 0;
    gs.forEach(function (g) {
      var s = Math.min(4, g.items.length), r = Math.ceil(g.items.length / s);
      if (!lignes || lc + s > 4) { R += cur; lignes++; lc = 0; cur = 0; }
      lc += s; cur = Math.max(cur, r);
    });
    R += cur;
    if (!R) return 53;
    var h = (193 - lignes * 7 - (R - lignes) * 3 - Math.max(0, lignes - 1) * 3.5) / R;
    return Math.max(30, Math.min(53, h));
  }

  function carteHtml(p) {
    var prix = (p.prix !== '' && +p.prix > 0) ? '<p class="mf-prix">' + V2.fmtEur(+p.prix) + ' <small>HT</small></p>' : '<p class="mf-prix"></p>';
    var img = p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(p.nom) + '" onerror="this.style.visibility=\'hidden\'">' : '';
    return '<article class="mf-cell"><div class="mf-plateau">' + img + '</div>' +
      '<div class="mf-txt"><p class="mf-marque">' + esc(p.marque) + '</p><h3>' + esc(p.nom) + '</h3>' + prix + '</div></article>';
  }

  function sheetHtml(sel) {
    var gid = 'mfa' + (++sheetN);
    var gs = groupes(sel), ch = hauteurCarte(gs), pl = Math.max(14, Math.min(22, ch - 31));
    var blocs = gs.map(function (g, i) {
      var s = Math.min(4, g.items.length);
      return '<section class="mf-univ u' + i + '" style="grid-column:span ' + s + '">' +
        '<h2><span class="mf-pin"></span><span>' + esc(g.u.label) + '</span></h2>' +
        '<div class="mf-cells" style="grid-template-columns:repeat(' + s + ',1fr)">' + g.items.map(carteHtml).join('') + '</div></section>';
    }).join('');
    var anneaux = '';
    for (var i = 0; i < 9; i++) anneaux += '<circle cx="55" cy="55" r="' + ((i + 1) * 55 / 9).toFixed(1) + '" fill="none" stroke="url(#' + gid + ')" stroke-width="1.1"/>';
    var jour = jourLong(sel.priceDate);
    var titre = String(sel.title || '');
    return '<div class="mf-fiche' + (ch < 40 ? ' mf-dense' : '') + '" style="--ch:' + ch.toFixed(2) + 'mm;--pl:' + pl.toFixed(2) + 'mm">' +
      '<header class="mf-bandeau">' +
        '<svg class="mf-lumiere" viewBox="0 0 110 110" aria-hidden="true"><defs><radialGradient id="' + gid + '" cx="55" cy="55" r="55" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' + anneaux + '</svg>' +
        '<div class="mf-haut"><div class="mf-lockup"><img class="l-ip" src="' + LOGO_IP + '" alt="Intégral Pharma"><span class="by">by</span><img class="l-opso" src="' + esc(brandLogo()) + '" alt="OPSO Santé"></div>' +
        (sel.period ? '<p class="mf-periode">' + esc(sel.period) + '</p>' : '') + '</div>' +
        '<h1' + (titre.length > 26 ? ' class="long"' : '') + '>' + esc(titre) + '</h1>' +
        (sel.subtitle ? '<p class="mf-sous">' + esc(sel.subtitle) + '</p>' : '') +
        '<svg class="mf-sourire" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H400 V14 C 300 44, 100 44, 0 14 Z" fill="#0d8530"/></svg>' +
      '</header>' +
      '<div class="mf-catalogue" style="grid-template-rows:none">' + blocs + '</div>' +
      '<footer class="mf-pied"><p class="mf-sig">On prend soin de vous !</p><div class="mf-pied-d">' +
        '<p class="mf-pied-t">Sélection proposée par Intégral Pharma, groupe de grossistes-répartiteurs, pour les pharmacies adhérentes du groupe OPSO Santé.</p>' +
        '<p class="mf-mention"><b>Votre prix : prix HT Offilog' + (jour ? ' au ' + esc(jour) : '') + '</b></p></div></footer>' +
    '</div>';
  }

  // ════════════════════════════════════════════
  // STYLES
  // ════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('mkt-styles')) return;
    var css = [
      // éditeur
      '.mkt-edit{display:grid;grid-template-columns:minmax(340px,1fr) minmax(360px,1.05fr);gap:24px;align-items:start}',
      '.mkt-edit>*{min-width:0}',
      '@media(max-width:920px){.mkt-edit{grid-template-columns:1fr}}',
      '.mkt-field{margin-bottom:14px}',
      '.mkt-field label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:6px;letter-spacing:.01em}',
      '.mkt-field input,.mkt-field textarea{width:100%;min-height:44px;background:var(--card);border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;color:var(--ip-ink);font:inherit;font-size:16px}',
      '.mkt-prow{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;background:var(--card);flex-wrap:wrap}',
      '.mkt-thumb{width:52px;height:52px;flex:none;border-radius:50%;background:#fff;border:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '.mkt-thumb img{width:100%;height:100%;object-fit:contain}',
      '.mkt-prow-main{flex:1 1 180px;min-width:0}',
      '.mkt-prow-univ{font-size:12px;color:var(--muted);margin-bottom:4px}',
      '.mkt-prow-bas{flex:1 1 100%;display:flex;align-items:center;gap:8px}',
      '.mkt-prow .mkt-prow-bas input.mkt-prix{width:120px}',
      '.mkt-prow-bas .mkt-prow-actions{margin-left:auto}',
      '.mkt-prow input.mkt-nom,.mkt-prow input.mkt-prix{width:100%;min-height:44px;background:var(--card-2);border:1px solid var(--line-strong);border-radius:8px;padding:7px 9px;color:var(--ip-ink);font:inherit;font-size:16px}',
      '.mkt-prow input::placeholder{color:var(--muted-2)}',
      '.mkt-prow input.sans-prix{border-color:var(--c-amber)}',
      '.mkt-nom{width:100%}',
      '.mkt-prow-actions{display:flex;gap:6px;flex:none}',
      '.mkt-rm{flex-shrink:0;width:44px;height:44px;border-radius:10px;border:1px solid var(--line-strong);background:var(--card-2);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:18px}',
      '.mkt-rm:hover{border-color:var(--c-rose);color:var(--c-rose)}',
      '.mkt-note{white-space:normal;font-size:13px;color:var(--muted);line-height:1.45}',
      '.mkt-warn{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(199,121,26,.12);border:1px solid rgba(199,121,26,.35);color:var(--ip-ink-2);font-size:13px;line-height:1.4}',
      '.mkt-prev-wrap{background:#e9ecef;border-radius:14px;padding:14px;overflow:hidden}',
      '@media(min-width:921px){.mkt-prev-wrap{position:sticky;top:18px;max-height:calc(100vh - 40px);overflow:auto}}',
      // sélecteur (overlay)
      '.mkt-sel-bd{position:fixed;inset:0;z-index:200;background:rgba(7,11,20,.55);display:none;align-items:flex-start;justify-content:center;padding:8vh 16px}',
      '.mkt-sel-bd.open{display:flex}',
      '.mkt-sel{width:min(560px,100%);background:var(--card);border:1px solid var(--line-strong);border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}',
      '.mkt-sel-search{display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-bottom:1px solid var(--line)}',
      '.mkt-sel-search input{flex:1;min-width:0;min-height:44px;background:none;border:none;outline:none;color:var(--ip-ink);font:inherit;font-size:16px}',
      '.mkt-sel-list{max-height:56vh;overflow:auto}',
      '.mkt-sel-item{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:60px;cursor:pointer;border-bottom:1px solid var(--line)}',
      '.mkt-sel-item:hover{background:var(--card-2)}',
      '.mkt-sel-item.added{opacity:.45;pointer-events:none}',
      '.mkt-sel-item .nm{flex:1;min-width:0;font-size:13.5px}',
      '.mkt-sel-item .nm b{display:block;color:var(--ip-ink);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-sel-item .nm span{font-size:12px;color:var(--muted-2)}',
      '.mkt-sel-item .pr{font-size:13px;font-weight:700;color:var(--ip-blue)}',
      '.mkt-sel-empty{padding:28px 16px;text-align:center;color:var(--muted);font-size:13.5px}',
      // impression : le conteneur n'existe qu'à l'impression
      '#mf-print{display:none}',
      // ════ LA FICHE (charte Normandie Pharma) ════
      '.mf-cadre{position:relative;margin:0 auto;width:calc(210mm * var(--s,1));height:calc(297mm * var(--s,1));overflow:hidden;border-radius:3px;box-shadow:0 20px 40px -24px rgba(42,45,47,.5),0 2px 6px rgba(42,45,47,.12)}',
      '.mf-cadre .mf-fiche{transform:scale(var(--s,1));transform-origin:0 0}',
      FICHE_CSS()
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'mkt-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function FICHE_CSS() {
    return [
      '.mf-fiche{--vert:#11a63c;--vert-f:#0d8530;--anthra:#2a2d2f;--gris:#64686a;--lime:#dddf4b;--lime-p:#f3f4c4;',
      ' width:210mm;height:297mm;position:relative;overflow:hidden;font-family:"Varela Round",system-ui,-apple-system,sans-serif;color:var(--anthra);font-size:11pt;line-height:1.25;text-align:left;',
      ' -webkit-print-color-adjust:exact;print-color-adjust:exact;',
      ' background:radial-gradient(ellipse 90% 35% at 50% 100%, rgba(17,166,60,.12) 0%, rgba(17,166,60,0) 70%),radial-gradient(ellipse 60% 40% at 100% 45%, rgba(221,223,75,.16) 0%, rgba(221,223,75,0) 70%),#fff}',
      '.mf-fiche *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ':where(.mf-fiche) :where(h1,h2,h3,p,header,footer,section,article){margin:0;padding:0;font-family:inherit;font-weight:400;letter-spacing:normal;text-transform:none;color:inherit}',
      '.mf-fiche img{display:block;max-width:none}',
      '.mf-bandeau{position:relative;height:63mm;padding:9mm 12mm 0;color:#fff;overflow:visible;',
      ' background:radial-gradient(ellipse 55% 90% at 88% 10%, rgba(221,223,75,.55) 0%, rgba(221,223,75,0) 60%),radial-gradient(circle at 20% 120%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 50%),linear-gradient(160deg,#16b848 0%,#11a63c 45%,#0d8530 100%)}',
      '.mf-lumiere{position:absolute;right:-20mm;top:-30mm;width:110mm;height:110mm}',
      '.mf-haut{position:relative;display:flex;justify-content:space-between;align-items:center}',
      '.mf-lockup{display:flex;align-items:center;gap:3mm}',
      '.mf-lockup .l-ip{height:11mm;width:auto;background:#fff;border-radius:2.5mm;padding:1.2mm 2mm}',
      '.mf-lockup .by{font-family:"Caveat",cursive;font-size:17pt;color:rgba(255,255,255,.9);line-height:1}',
      '.mf-lockup .l-opso{height:15mm;width:auto}',
      '.mf-periode{font-size:11pt;color:var(--anthra);background:var(--lime);padding:1.2mm 4mm;border-radius:4mm 4mm 4mm 0}',
      '.mf-bandeau h1{position:relative;font-size:30pt;line-height:1;margin-top:6mm;color:#fff;max-height:22mm;overflow:hidden}',
      '.mf-bandeau h1.long{font-size:22pt;line-height:1.05}',
      '.mf-sous{position:relative;font-size:11.5pt;margin-top:2mm;color:rgba(255,255,255,.95);max-width:150mm}',
      '.mf-sourire{position:absolute;left:0;right:0;bottom:-9mm;width:100%;height:10mm}',
      '.mf-catalogue{position:absolute;left:9mm;right:9mm;top:77mm;display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm 3mm;align-content:start}',
      '.mf-univ h2{font-size:12.5pt;color:var(--anthra);display:flex;align-items:center;gap:2mm;margin:0 0 1.8mm 1mm;height:5mm}',
      '.mf-pin{display:inline-block;position:relative;flex:none;width:5mm;height:5mm;border-radius:50% 50% 50% 0;background:var(--vert)}',
      '.mf-pin::before,.mf-pin::after{content:"";position:absolute;background:#fff;border-radius:1px;left:50%;top:50%;transform:translate(-50%,-50%)}',
      '.mf-pin::before{width:44%;height:14%}.mf-pin::after{width:14%;height:44%}',
      '.mf-univ.u1 .mf-pin{background:#0d8530}',
      '.mf-univ.u2 .mf-pin{background:var(--lime)}.mf-univ.u2 .mf-pin::before,.mf-univ.u2 .mf-pin::after{background:var(--vert-f)}',
      '.mf-univ.u3 .mf-pin{background:var(--anthra)}',
      '.mf-cells{display:grid;gap:3mm}',
      '.mf-cell{height:var(--ch,53mm);border-radius:4mm;padding:2.5mm 3mm 3mm;display:flex;flex-direction:column;overflow:hidden;',
      ' clip-path:polygon(8mm 0,100% 0,100% 100%,0 100%,0 8mm);',
      ' background:radial-gradient(ellipse 90% 75% at 50% 22%, #ffffff 0%, #f3faf2 55%, #e4f2e6 100%)}',
      '.mf-univ.u2 .mf-cell{background:radial-gradient(ellipse 90% 75% at 50% 22%, #ffffff 0%, #fafae6 55%, #f0f1c9 100%)}',
      '.mf-plateau{position:relative;flex:none;width:var(--pl,22mm);height:var(--pl,22mm);margin:0 auto 1.5mm;border-radius:50%;overflow:hidden;',
      ' background:radial-gradient(circle at 42% 32%, #ffffff 0%, #ffffff 38%, #eef8e6 72%, #d9efd9 100%)}',
      '.mf-plateau img{position:absolute;left:9%;top:9%;width:82%;height:82%;object-fit:contain;background:#fff}',
      '.mf-txt{display:flex;flex-direction:column;flex:1;min-height:0}',
      '.mf-marque{font-size:10pt;line-height:1.2;color:var(--vert-f);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mf-cell h3{font-size:10.5pt;line-height:1.15;margin-top:.4mm;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}',
      '.mf-dense .mf-cell{flex-direction:row;gap:2mm;align-items:center}',
      '.mf-dense .mf-plateau{margin:0;width:14mm;height:14mm}',
      '.mf-dense .mf-txt{height:100%;min-width:0}',
      '.mf-dense .mf-marque{font-size:9pt}',
      '.mf-dense .mf-cell h3{font-size:10pt;-webkit-line-clamp:2}',
      '.mf-prix{margin-top:auto;font-size:15pt;color:var(--vert-f);line-height:1;min-height:5mm}',
      '.mf-prix small{font-size:10pt;color:var(--gris)}',
      '.mf-pied{position:absolute;left:12mm;right:12mm;bottom:7mm;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7mm;border-top:.3mm solid rgba(42,45,47,.12);padding-top:3mm}',
      '.mf-sig{font-family:"Caveat",cursive;font-size:19pt;color:var(--vert-f);line-height:1}',
      '.mf-pied-t{font-size:10pt;color:var(--gris)}',
      '.mf-mention{font-size:10pt;color:var(--gris);margin-top:1.2mm}',
      '.mf-mention b{font-weight:400;color:var(--anthra);background:var(--lime-p);padding:.2mm 1.6mm;border-radius:2mm}'
    ].join('\n');
  }

  // ════════════════════════════════════════════
  // APERÇU LIVE (mise à l'échelle pour tenir dans la colonne)
  // ════════════════════════════════════════════
  var MM = 96 / 25.4, resizeBound = false;
  function refreshPreview() {
    var host = document.getElementById('mkt-prev'); if (!host || !editing) return;
    var wrap = host.parentNode;
    var avail = wrap.clientWidth - 28;
    var s = Math.max(0.2, Math.min(1, avail / (210 * MM)));
    host.style.setProperty('--s', s.toFixed(4));
    host.innerHTML = '<div class="mf-cadre">' + sheetHtml(editing) + '</div>';
    majAvertissement();
  }
  function majAvertissement() {
    var el = document.getElementById('mkt-warn'); if (!el || !editing) return;
    var sans = editing.products.filter(function (p) { return p.prix === ''; }).length;
    var msg = '';
    if (!editing.products.length) msg = '';
    else if (sans && !window.OFFILOG_LIVE_PRIX) msg = 'Les prix Offilog ne sont pas chargés : saisissez chaque prix à la main (rien ne s\'affiche sur la fiche tant qu\'un prix est vide).';
    else if (sans) msg = sans + ' produit' + (sans > 1 ? 's' : '') + ' sans prix : saisissez le prix dans la liste. La fiche n\'affiche aucun prix pour ' + (sans > 1 ? 'eux' : 'lui') + ' tant qu\'il est vide.';
    if (!msg && editing.products.length && hauteurCarte(groupes(editing)) < 40) msg = 'Beaucoup de produits dans un même univers : les cartes sont resserrées. Répartissez les produits entre univers pour une fiche plus aérée.';
    el.style.display = msg ? '' : 'none';
    el.textContent = msg;
  }

  // ════════════════════════════════════════════
  // SÉLECTEUR PRODUIT (overlay, catalogue Offilog complet)
  // ════════════════════════════════════════════
  function chercher(q) {
    var I = buildIdx(); if (!I) return null;
    q = norm(q).trim();
    if (q.length < 2) return [];
    var toks = q.split(/\s+/), out = [], all = I.all;
    for (var i = 0; i < all.length && out.length < 40; i++) {
      var h = all[i].h, ok = true;
      for (var t = 0; t < toks.length; t++) { if (h.indexOf(toks[t]) < 0) { ok = false; break; } }
      if (ok) out.push(all[i].p);
    }
    return out;
  }
  function renderSelList() {
    var box = document.getElementById('mkt-sel-list'); if (!box || !editing) return;
    var q = (document.getElementById('mkt-sel-input') || {}).value || '';
    var res = chercher(q);
    if (res === null) { box.innerHTML = '<div class="mkt-sel-empty">Chargement du catalogue Offilog…</div>'; return; }
    if (!res.length) { box.innerHTML = '<div class="mkt-sel-empty">' + (norm(q).trim().length < 2 ? 'Tapez au moins 2 lettres : nom, marque ou code EAN.' : 'Aucun produit trouvé.') + '</div>'; return; }
    var deja = {}; editing.products.forEach(function (p) { deja[p.id] = true; });
    box.innerHTML = res.map(function (p) {
      var c = nomCourt(p), pr = prixLive(p.id);
      return '<div class="mkt-sel-item' + (deja[String(p.id)] ? ' added' : '') + '" data-id="' + esc(String(p.id)) + '">' +
        '<span class="mkt-thumb">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '') + '</span>' +
        '<div class="nm"><b>' + esc(c.nom) + '</b><span>' + esc(c.marque || '') + (p.ean ? ' · ' + esc(p.ean) : '') + '</span></div>' +
        (pr !== '' ? '<div class="pr">' + V2.fmtEur(pr) + '</div>' : '') + '</div>';
    }).join('');
  }
  function openSelector() {
    if (editing && editing.products.length >= MAX) { V2.toast('Maximum ' + MAX + ' produits sur la fiche', 'warn'); return; }
    var bd = document.getElementById('mkt-sel-bd'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('mkt-sel-input');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
    renderSelList();
    if (!live()) chargerDonnees().then(function () { if (completer(editing)) saveOne(editing); renderSelList(); renderEditorBody(); refreshPreview(); });
  }
  function closeSelector() { var bd = document.getElementById('mkt-sel-bd'); if (bd) bd.classList.remove('open'); }
  function addById(id) {
    var I = buildIdx(); if (!I || !editing) return;
    var p = I.byId[String(id)]; if (!p) return;
    if (editing.products.some(function (x) { return x.id === String(p.id); })) return;
    if (editing.products.length >= MAX) { V2.toast('Maximum ' + MAX + ' produits sur la fiche', 'warn'); return; }
    var np = prodDepuisLive(p);
    editing.products.push(np);
    if (np.prix !== '') editing.priceDate = isoJour(new Date());
    saveOne(editing);
    renderEditorBody(); renderSelList(); refreshPreview();
    V2.toast(esc(np.nom) + ' ajouté');
  }

  // ════════════════════════════════════════════
  // ÉDITEUR
  // ════════════════════════════════════════════
  function labelUnivers(p) { var k = universDe(p); return UNIVERS.filter(function (u) { return u.k === k; })[0].label; }
  function prowHtml(p, i) {
    var n = editing.products.length;
    return '<div class="mkt-prow">' +
      '<span class="mkt-thumb">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '') + '</span>' +
      '<div class="mkt-prow-main">' +
        '<div class="mkt-prow-univ">' + esc(labelUnivers(p)) + (p.marque ? ' · ' + esc(p.marque) : '') + '</div>' +
        '<input class="mkt-nom" value="' + esc(p.nom) + '" aria-label="Nom affiché" oninput="V2.marketing.setP(' + i + ',\'nom\',this.value)">' +
      '</div>' +
      '<div class="mkt-prow-bas">' +
        '<input type="number" inputmode="decimal" step="0.01" min="0" value="' + (p.prix !== '' ? p.prix : '') + '" placeholder="prix à saisir" aria-label="Votre prix HT en euros" class="mkt-prix' + (p.prix === '' ? ' sans-prix' : '') + '" oninput="V2.marketing.setP(' + i + ',\'prix\',this.value);this.classList.toggle(\'sans-prix\',this.value===\'\')">' +
        '<span class="mkt-note" style="white-space:nowrap">€ HT</span>' +
        '<div class="mkt-prow-actions">' +
          '<button class="mkt-rm" aria-label="Monter" title="Monter"' + (i === 0 ? ' disabled style="opacity:.35"' : '') + ' onclick="V2.marketing.moveP(' + i + ',-1)">↑</button>' +
          '<button class="mkt-rm" aria-label="Descendre" title="Descendre"' + (i === n - 1 ? ' disabled style="opacity:.35"' : '') + ' onclick="V2.marketing.moveP(' + i + ',1)">↓</button>' +
          '<button class="mkt-rm" aria-label="Retirer" title="Retirer" onclick="V2.marketing.removeP(' + i + ')">' + ICO('close', 15, 2) + '</button>' +
        '</div>' +
      '</div>' +
      '</div></div>';
  }
  function renderEditorBody() {
    var box = document.getElementById('mkt-prows'); if (!box || !editing) return;
    var cnt = document.getElementById('mkt-count'); if (cnt) cnt.textContent = editing.products.length + ' / ' + MAX;
    box.innerHTML = editing.products.length
      ? editing.products.map(prowHtml).join('')
      : '<div style="padding:18px;text-align:center;color:var(--muted);font-size:13.5px;border:1px dashed var(--line-strong);border-radius:12px">Aucun produit. Touchez « Ajouter un produit ».</div>';
    majAvertissement();
  }

  function renderEditor(root) {
    injectStyles();
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Mes sélections' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-head" style="margin-bottom:18px">' +
          '<div><div class="v2-page-title">Le catalogue du mois</div>' +
          '<div class="v2-page-sub">Composez la fiche : l\'aperçu se met à jour en direct. Impression A4, avec les photos.</div></div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.marketing.print()">' + ICO('download', 17, 2) + 'Imprimer / PDF</button>' +
        '</div>' +
        '<div class="mkt-edit">' +
          '<div>' +
            '<div class="v2-card" style="padding:18px">' +
              '<div class="mkt-field"><label for="mkt-f-title">Titre</label><input id="mkt-f-title" value="' + esc(editing.title) + '" oninput="V2.marketing.set(\'title\',this.value)"></div>' +
              '<div class="mkt-field"><label for="mkt-f-sub">Sous-titre</label><input id="mkt-f-sub" value="' + esc(editing.subtitle) + '" oninput="V2.marketing.set(\'subtitle\',this.value)"></div>' +
              '<div class="mkt-field"><label for="mkt-f-period">Période</label><input id="mkt-f-period" value="' + esc(editing.period) + '" oninput="V2.marketing.set(\'period\',this.value)"></div>' +
              '<div class="mkt-field" style="margin-bottom:0"><label for="mkt-f-date">Date des prix</label><input id="mkt-f-date" type="date" value="' + esc(editing.priceDate) + '" oninput="V2.marketing.set(\'priceDate\',this.value)">' +
              '<p class="mkt-note" style="margin-top:6px">La fiche indique « Votre prix : prix HT Offilog au … » avec cette date. Elle se met à jour quand un prix Offilog est repris.</p></div>' +
            '</div>' +
            '<div class="v2-card" style="padding:18px;margin-top:16px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">' +
                '<div style="font-weight:700;font-size:14px">Produits de la fiche <span id="mkt-count" class="mkt-note"></span></div>' +
                '<button class="v2-btn v2-btn-ghost" style="min-height:44px" onclick="V2.marketing.openSelector()">' + ICO('plus', 16, 2) + 'Ajouter un produit</button>' +
              '</div>' +
              '<p class="mkt-note" style="margin:0 0 12px">Les produits se rangent tout seuls par univers (Santé, Hygiène, Beauté &amp; soins, Solaires). Le prix vient du tarif Offilog ; vous pouvez le corriger.</p>' +
              '<div id="mkt-warn" class="mkt-warn" style="display:none"></div>' +
              '<div id="mkt-prows"></div>' +
            '</div>' +
          '</div>' +
          '<div class="mkt-prev-wrap"><div id="mkt-prev"></div></div>' +
        '</div>' +
      '</div>' +
      '<div id="mkt-sel-bd" class="mkt-sel-bd">' +
        '<div class="mkt-sel" onclick="event.stopPropagation()">' +
          '<div class="mkt-sel-search">' + ICO('search', 20, 2) +
            '<input id="mkt-sel-input" placeholder="Nom, marque ou code EAN…" autocomplete="off" aria-label="Rechercher un produit">' +
            '<button class="mkt-rm" aria-label="Fermer" onclick="V2.marketing.closeSelector()">' + ICO('close', 16, 2) + '</button>' +
          '</div>' +
          '<div id="mkt-sel-list" class="mkt-sel-list"></div>' +
        '</div>' +
      '</div>';

    renderEditorBody();
    refreshPreview();
    var bd = document.getElementById('mkt-sel-bd'); if (bd) bd.onclick = closeSelector;
    var inp = document.getElementById('mkt-sel-input');
    if (inp) inp.addEventListener('input', renderSelList);
    var lst = document.getElementById('mkt-sel-list');
    if (lst) lst.addEventListener('click', function (e) { var it = e.target.closest ? e.target.closest('.mkt-sel-item') : null; if (it) addById(it.getAttribute('data-id')); });
    if (!resizeBound) { resizeBound = true; window.addEventListener('resize', function () { refreshPreview(); }); }
    // Données : catalogue + prix. On complète la sélection quand elles arrivent.
    var sel = editing;
    chargerDonnees().then(function () {
      if (editing !== sel) return;
      if (completer(sel)) saveOne(sel);
      renderEditorBody(); refreshPreview();
    });
  }

  // ════════════════════════════════════════════
  // LISTE DES SÉLECTIONS
  // ════════════════════════════════════════════
  function renderList(root) {
    injectStyles();
    nettoyerImpression();
    var all = getAll();
    var cards = all.length ? all.map(function (s) {
      var n = s.products.length, id = String(s.id).replace(/[^\w]/g, '');
      return '<div class="v2-card" style="padding:16px 18px;display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div style="width:42px;height:42px;border-radius:12px;background:rgba(17,166,60,.14);display:flex;align-items:center;justify-content:center;color:var(--ip-blue);flex-shrink:0">' + ICO('fiche', 20, 2) + '</div>' +
        '<div style="flex:1 1 160px;min-width:0">' +
          '<div style="font-weight:700;font-size:15px;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.title || 'Sélection') + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted)">' + esc(s.period || '') + ' · ' + n + ' produit' + (n > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<button class="v2-btn v2-btn-ghost" style="min-height:44px" onclick="V2.marketing.open(\'' + id + '\')">Modifier</button>' +
        '<button class="v2-btn v2-btn-primary" style="min-height:44px" onclick="V2.marketing.printById(\'' + id + '\')">' + ICO('download', 15, 2) + 'Imprimer / PDF</button>' +
        '<button class="mkt-rm" title="Supprimer" aria-label="Supprimer" onclick="V2.marketing.del(\'' + id + '\')">' + ICO('close', 15, 2) + '</button>' +
      '</div>';
    }).join('') : '';

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap narrow">' +
        '<div class="v2-page-head" style="margin-bottom:18px">' +
          '<div><div class="v2-page-title">Fiches marketing OPSO</div>' +
          '<div class="v2-page-sub">Le catalogue du mois : une fiche A4 pour les pharmaciens, avec leur prix Offilog, prête à imprimer.</div></div>' +
          '<button class="v2-btn v2-btn-primary" style="min-height:44px" onclick="V2.marketing.open(\'new\')">' + ICO('plus', 17, 2) + 'Nouvelle fiche</button>' +
        '</div>' +
        (cards || '<div class="v2-empty" style="padding:40px 20px;text-align:center">' +
          '<div style="font-weight:700;font-size:16px;margin-bottom:6px">Aucune fiche pour l\'instant</div>' +
          '<div style="color:var(--muted);margin-bottom:18px">Créez la première fiche « Le catalogue du mois » pour les pharmacies adhérentes.</div>' +
          '<button class="v2-btn v2-btn-primary" style="margin:0 auto;min-height:44px" onclick="V2.marketing.open(\'new\')">' + ICO('plus', 17, 2) + 'Créer ma première fiche</button>' +
        '</div>') +
      '</div>';
  }

  // ════════════════════════════════════════════
  // IMPRESSION — décision (30/09/2026)
  // Les photos viennent d'offilog.fr, qui n'envoie AUCUN en-tête
  // Access-Control-Allow-Origin (mesuré : curl -sI). html2canvas (useCORS) ne
  // peut donc pas les dessiner, et l'ancien export PDF sortirait une fiche sans
  // photos. On imprime donc la vraie page (window.print) : le navigateur affiche
  // les images sans contrainte CORS. @page A4, marge 0, couleurs exactes.
  // ════════════════════════════════════════════
  var STYLE_IMPR = '@page{size:A4;margin:0}' +
    '@media print{html,body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}' +
    'body>*:not(#mf-print){display:none!important}' +
    '#mf-print{display:block!important;width:210mm;height:296mm;overflow:hidden;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '#mf-print .mf-fiche{transform:none!important;height:296mm}}';
  function nettoyerImpression() {
    var a = document.getElementById('mf-print'); if (a && a.parentNode) a.parentNode.removeChild(a);
    var b = document.getElementById('mf-print-style'); if (b && b.parentNode) b.parentNode.removeChild(b);
  }
  var printBound = false;
  function preparerImpression(sel) {
    injectStyles();
    nettoyerImpression();
    var st = document.createElement('style'); st.id = 'mf-print-style'; st.textContent = STYLE_IMPR; document.head.appendChild(st);
    var box = document.createElement('div'); box.id = 'mf-print'; box.innerHTML = sheetHtml(sel);
    document.body.appendChild(box);
    if (!printBound) {
      printBound = true;
      window.addEventListener('afterprint', nettoyerImpression);
    }
    var imgs = Array.prototype.slice.call(box.querySelectorAll('img'));
    var attentes = imgs.map(function (im) {
      return new Promise(function (ok) {
        if (im.complete) return ok();
        im.addEventListener('load', ok); im.addEventListener('error', ok);
      });
    });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var delai = new Promise(function (ok) { setTimeout(ok, 6000); });
    return Promise.race([Promise.all(attentes.concat([fonts])), delai]).then(function () { return box; });
  }
  function imprimer(sel) {
    if (!sel.products.length) { V2.toast('Ajoutez au moins un produit avant d\'imprimer', 'warn'); return; }
    var sans = sel.products.filter(function (p) { return p.prix === ''; }).length;
    if (sans) V2.toast(sans + ' produit' + (sans > 1 ? 's' : '') + ' sans prix : rien ne sera affiché à leur place', 'warn');
    V2.toast('Préparation de la fiche… choisissez « Enregistrer en PDF » ou votre imprimante');
    var titreAvant = document.title;
    document.title = 'Catalogue-' + fileSafe(sel.title) + '-' + isoJour(new Date());
    preparerImpression(sel).then(function () {
      try { window.print(); } catch (e) { V2.toast('Impression impossible', 'error'); }
      setTimeout(function () { document.title = titreAvant; }, 1500);
    });
  }

  // ════════════════════════════════════════════
  // API publique
  // ════════════════════════════════════════════
  V2.marketing = {
    open: function (id) {
      editing = (id && id !== 'new') ? getOne(id) : null;
      if (!editing) { editing = createSel(); }
      saveOne(editing);
      V2.go('marketing-edit', editing.id);
    },
    set: function (k, v) { if (editing) { editing[k] = v; saveOne(editing); refreshPreview(); } },
    setP: function (i, k, v) {
      var p = editing && editing.products[i]; if (!p) return;
      if (k === 'prix') {
        var n = parseFloat(String(v).replace(',', '.'));
        p.prix = (isFinite(n) && n > 0) ? n : ''; p.manual = true;
      } else p[k] = v;
      saveOne(editing); refreshPreview();
    },
    moveP: function (i, d) {
      if (!editing) return; var j = i + d, a = editing.products;
      if (j < 0 || j >= a.length) return;
      var t = a[i]; a[i] = a[j]; a[j] = t;
      saveOne(editing); renderEditorBody(); refreshPreview();
    },
    removeP: function (i) { if (editing) { editing.products.splice(i, 1); saveOne(editing); renderEditorBody(); refreshPreview(); } },
    openSelector: openSelector,
    closeSelector: closeSelector,
    print: function () { if (editing) { saveOne(editing); imprimer(editing); } },
    printById: function (id) {
      var s = getOne(id); if (!s) return;
      chargerDonnees().then(function () { if (completer(s)) saveOne(s); imprimer(s); });
    },
    prepPrint: function () { return editing ? preparerImpression(editing) : Promise.resolve(null); },
    del: function (id) { if (confirm('Supprimer cette fiche ?')) { deleteOne(id); V2.render(); } }
  };

  // ── Pages (routeur) ──
  V2.pages.marketing = { render: function (root) { renderList(root); } };
  V2.pages['marketing-edit'] = {
    render: function (root, param) {
      nettoyerImpression();
      if (!editing || (param && editing.id !== param)) { editing = getOne(param) || createSel(); }
      renderEditor(root);
    }
  };
})();
