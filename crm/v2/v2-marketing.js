/* ═══════════════════════════════════════════════════════════════════
   OPSO Santé · Pilier MARKETING — Fiches "Sélection by Intégral Pharma"
   Génère une fiche A4 (portrait) imprimable = une sélection de produits
   négociée par Intégral Pharma pour les adhérents OPSO Santé, présentée
   dans la charte graphique Normandie Pharma (vert #11a63c, pin croix,
   sourire, Varela Round, "On prend soin de vous !").
   N'est chargé QUE dans l'app opso/v2/ (mode OPSO). Export PDF via html2pdf.
   Persistance : localStorage 'v2_opso_selections'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var ICO = window.ICO || function () { return ''; };
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  // ── Couleurs charte Normandie Pharma ──
  var NP = { green: '#11a63c', greenD: '#0d8530', gray: '#64686a', anis: '#dddf4b', rose: '#e62176' };

  // ── Persistance ──
  var LS_KEY = 'v2_opso_selections';
  function getAll() {
    try { var r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; }
  }
  function writeAll(arr) { try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {} }
  function getOne(id) { return getAll().filter(function (s) { return s.id === id; })[0] || null; }
  function saveOne(sel) {
    var arr = getAll(); var i = arr.findIndex(function (s) { return s.id === sel.id; });
    if (i >= 0) arr[i] = sel; else arr.unshift(sel);
    writeAll(arr);
  }
  function deleteOne(id) { writeAll(getAll().filter(function (s) { return s.id !== id; })); }

  function moisFr() {
    try { return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }
  function createSel() {
    return {
      id: 's' + Date.now(),
      title: 'La sélection Intégral Pharma',
      subtitle: 'pour les adhérents OPSO Santé',
      month: cap(moisFr()),
      intro: 'Une sélection de produits négociée par votre groupement, aux meilleures conditions du moment.',
      theme: 'green',
      products: [],
      created: Date.now()
    };
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fileSafe(s) { return String(s || 'selection').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'selection'; }

  var editing = null; // sélection en cours d'édition (objet)

  // ════════════════════════════════════════════
  // PICTOGRAMMES line-art (style charte NP)
  // ════════════════════════════════════════════
  function pictoPath(key) {
    switch (key) {
      case 'pill':  return '<path d="M6 14 L14 6 a4 4 0 0 1 6 6 L12 20 a4 4 0 0 1-6-6Z"/><path d="M10 10 L16 16"/>';
      case 'drop':  return '<path d="M12 3 C12 3 5 11 5 15 a7 7 0 0 0 14 0 C19 11 12 3 12 3Z"/>';
      case 'heart': return '<path d="M12 20 C5 14 4 9 7 6 a3.5 3.5 0 0 1 5 .5 a3.5 3.5 0 0 1 5-.5 c3 3 2 8-5 14Z"/>';
      case 'leaf':  return '<path d="M5 19 C5 11 11 5 19 5 C19 13 13 19 5 19Z"/><path d="M5 19 L13 11"/>';
      case 'sun':   return '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>';
      case 'baby':  return '<path d="M9 4 h6 v4 a3 3 0 0 1-3 3 a3 3 0 0 1-3-3Z"/><path d="M12 11 v9"/><path d="M8 20 h8"/>';
      case 'tooth': return '<path d="M7 4 C9 3 10 5 12 5 C14 5 15 3 17 4 C19 5 19 9 18 14 C17.5 18 16 20 15 17 L13 12 C12.5 11 11.5 11 11 12 L9 17 C8 20 6.5 18 6 14 C5 9 5 5 7 4Z"/>';
      default:      return '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10" stroke-width="2.6"/>'; // croix pharmacie
    }
  }
  function pictoFor(categorie) {
    var c = (categorie || '').toLowerCase();
    if (/aroma|huile|plante|phyto|tisane/.test(c)) return 'leaf';
    if (/b[ée]b[ée]|nourrisson|enfant|maternit/.test(c)) return 'baby';
    if (/dentaire|bucco|dent/.test(c)) return 'tooth';
    if (/solaire|soleil|protect/.test(c)) return 'sun';
    if (/derm|peau|hydrat|cr[èe]me|soin/.test(c)) return 'drop';
    if (/cardio|coeur|cœur|tension|circul/.test(c)) return 'heart';
    if (/m[ée]dic|comprim|g[ée]lule|pharma|antalg/.test(c)) return 'pill';
    return 'cross';
  }
  function pinSvg(key, size) {
    size = size || 46;
    return '<span class="np-pin" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 24 24" width="' + Math.round(size * 0.52) + '" height="' + Math.round(size * 0.52) + '" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      pictoPath(key) + '</svg></span>';
  }

  // Sourire / swoosh signature de la marque
  function smileSvg(color, w) {
    w = w || 120;
    return '<svg class="np-smile" viewBox="0 0 120 30" width="' + w + '" height="' + Math.round(w * 0.25) + '" fill="none" stroke="' + (color || NP.green) + '" stroke-width="6" stroke-linecap="round">' +
      '<path d="M6 8 Q60 38 114 8"/></svg>';
  }

  // Croix pharmacie officielle OPSO (2 rectangles arrondis)
  function crossSvg(color, size) {
    size = size || 26;
    return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" fill="' + (color || '#fff') + '">' +
      '<rect x="12" y="3" width="8" height="26" rx="3"/><rect x="3" y="12" width="26" height="8" rx="3"/></svg>';
  }

  // Chemin du logo officiel OPSO Santé (fichier image, relatif à la page)
  function brandLogo() { return (window.V2_BRAND && window.V2_BRAND.logo) || 'assets/opsosante-logo.png'; }

  // Bloc logo OPSO Santé (vrai logo) + baseline
  function opsoLogo() {
    return '<div class="np-logo">' +
      '<img class="np-logo-img" src="' + brandLogo() + '" alt="Groupe OPSO Santé" crossorigin="anonymous">' +
      '<div class="np-logo-base">On prend soin de vous !</div>' +
    '</div>';
  }

  // ════════════════════════════════════════════
  // LA FICHE A4 (HTML partagé : aperçu + PDF)
  // ════════════════════════════════════════════
  function priceBlock(p) {
    var promo = (p.prixPromo != null && p.prixPromo !== '') ? V2.fmtEur(+p.prixPromo) : '';
    var barre = (p.prixPublic != null && p.prixPublic !== '' && +p.prixPublic > (+p.prixPromo || 0)) ? V2.fmtEur(+p.prixPublic) : '';
    if (!promo && !barre) return '';
    return '<div class="np-price">' +
      (barre ? '<span class="np-price-old">' + barre + '</span>' : '') +
      (promo ? '<span class="np-price-new">' + promo + '</span>' : '') +
    '</div>';
  }

  function sheetHtml(sel) {
    var theme = sel.theme === 'rose' ? NP.rose : NP.green;
    var rows = (sel.products || []).map(function (p) {
      var key = p.picto || pictoFor(p.categorie);
      var offre = (p.offre || '').trim();
      return '<div class="np-row">' +
        pinSvg(key, 46) +
        '<div class="np-row-main">' +
          '<div class="np-row-name">' + esc(p.designation || '') + '</div>' +
          (p.categorie ? '<div class="np-row-sub">' + esc(p.categorie) + (p.cip13 ? ' · CIP ' + esc(p.cip13) : '') + '</div>' : (p.cip13 ? '<div class="np-row-sub">CIP ' + esc(p.cip13) + '</div>' : '')) +
          (offre ? '<span class="np-offer">' + esc(offre) + '</span>' : '') +
        '</div>' +
        priceBlock(p) +
      '</div>';
    }).join('');

    var empty = '<div class="np-empty">Ajoute des produits à ta sélection pour les voir apparaître ici.</div>';

    return '<div class="np-sheet" style="--np-accent:' + theme + '">' +
      // ── HEADER vert ──
      '<header class="np-head">' +
        '<div class="np-head-mark"><img src="' + brandLogo() + '" alt="OPSO Santé" crossorigin="anonymous"></div>' +
        '<div class="np-head-txt">' +
          '<div class="np-eyebrow">SÉLECTION' + (sel.month ? ' · ' + esc(sel.month) : '') + '</div>' +
          '<h1>' + esc(sel.title || 'La sélection') + '</h1>' +
          (sel.subtitle ? '<div class="np-sub">' + esc(sel.subtitle) + '</div>' : '') +
        '</div>' +
        '<div class="np-byip">by<br><b>Intégral&nbsp;Pharma</b></div>' +
      '</header>' +

      // ── INTRO ──
      (sel.intro ? '<div class="np-intro">' + esc(sel.intro) + '</div>' : '') +

      // ── PRODUITS ──
      '<div class="np-rows">' + (rows || empty) + '</div>' +

      // ── FOOTER ──
      '<footer class="np-foot">' +
        opsoLogo(1) +
        '<div class="np-foot-note">' +
          'Sélection négociée par <b>Intégral Pharma</b> pour les adhérents <b>OPSO Santé</b>.<br>' +
          'Prix indicatifs HT · document réservé aux adhérents.' +
        '</div>' +
      '</footer>' +
    '</div>';
  }

  // ════════════════════════════════════════════
  // STYLES (injectés une fois)
  // ════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('mkt-styles')) return;
    var css = [
      // éditeur
      '.mkt-edit{display:grid;grid-template-columns:minmax(340px,1fr) minmax(360px,1.05fr);gap:24px;align-items:start}',
      '@media(max-width:920px){.mkt-edit{grid-template-columns:1fr}}',
      '.mkt-field{margin-bottom:14px}',
      '.mkt-field label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:6px;letter-spacing:.01em}',
      '.mkt-field input,.mkt-field textarea{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--text);font:inherit;font-size:14px}',
      '.mkt-field textarea{resize:vertical;min-height:60px}',
      '.mkt-prow{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;background:var(--card)}',
      '.mkt-prow-main{flex:1;min-width:0}',
      '.mkt-prow-name{font-weight:700;font-size:13.5px;color:var(--text);margin-bottom:8px}',
      '.mkt-prow-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.mkt-prow-fields .full{grid-column:1/-1}',
      '.mkt-prow-fields input{width:100%;background:var(--card-2);border:1px solid var(--line);border-radius:8px;padding:7px 9px;color:var(--text);font:inherit;font-size:12.5px}',
      '.mkt-prow-fields input::placeholder{color:var(--muted-2)}',
      '.mkt-rm{flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card-2);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
      '@media(max-width:640px){.mkt-rm{width:var(--tap-min,44px);height:var(--tap-min,44px)}}',
      '.mkt-rm:hover{border-color:var(--c-rose,#FF4D6D);color:var(--c-rose,#FF4D6D)}',
      '.mkt-prev-wrap{position:sticky;top:18px;background:#e9ecef;border-radius:14px;padding:18px;overflow:auto;max-height:calc(100vh - 120px)}',
      '.mkt-prev-scale{transform-origin:top center;margin:0 auto}',
      // sélecteur overlay
      '.mkt-sel-bd{position:fixed;inset:0;z-index:200;background:rgba(7,11,20,.55);backdrop-filter:blur(3px);display:none;align-items:flex-start;justify-content:center;padding:8vh 16px}',
      '.mkt-sel-bd.open{display:flex}',
      '.mkt-sel{width:min(560px,100%);background:var(--bg-2,var(--card));border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}',
      '.mkt-sel-search{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}',
      '.mkt-sel-search input{flex:1;background:none;border:none;outline:none;color:var(--text);font:inherit;font-size:15px}',
      '.mkt-sel-list{max-height:52vh;overflow:auto}',
      '.mkt-sel-item{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;border-bottom:1px solid var(--line)}',
      '.mkt-sel-item:hover{background:var(--card-2)}',
      '.mkt-sel-item.added{opacity:.45;pointer-events:none}',
      '.mkt-sel-item .nm{flex:1;min-width:0;font-size:13.5px}',
      '.mkt-sel-item .nm b{display:block;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-sel-item .nm span{font-size:11.5px;color:var(--muted-2)}',
      '.mkt-sel-item .pr{font-size:13px;font-weight:700;color:var(--ip-blue)}',
      '.mkt-sel-empty{padding:28px 16px;text-align:center;color:var(--muted);font-size:13.5px}',
      // ════ LA FICHE (charte Normandie Pharma) ════
      '.np-sheet{width:210mm;min-height:297mm;background:#fff;color:' + NP.gray + ";font-family:'Varela Round',var(--font,system-ui),sans-serif;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,.18)}",
      '.np-sheet *{box-sizing:border-box}',
      '.np-head{position:relative;background:var(--np-accent);color:#fff;padding:22mm 16mm 14mm;display:flex;align-items:flex-start;gap:6mm;overflow:hidden}',
      '.np-head-mark{flex-shrink:0;background:#fff;border-radius:4mm;padding:3mm 4mm;box-shadow:0 4px 14px rgba(0,0,0,.12)}',
      '.np-head-mark img{display:block;height:20mm;width:auto}',
      '.np-head-txt{flex:1;min-width:0}',
      '.np-eyebrow{font-size:11pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.92;margin-bottom:4mm}',
      '.np-head h1{margin:0;font-size:30pt;line-height:1.02;font-weight:700;letter-spacing:-.01em}',
      '.np-sub{margin-top:3mm;font-size:13pt;font-weight:500;opacity:.95}',
      '.np-byip{flex-shrink:0;text-align:right;font-size:9pt;line-height:1.25;opacity:.95;align-self:flex-start}',
      '.np-byip b{font-size:11pt}',
      '.np-intro{padding:9mm 16mm 0;font-size:12pt;line-height:1.5;color:' + NP.gray + '}',
      '.np-rows{flex:1;padding:8mm 16mm 6mm;display:flex;flex-direction:column;gap:4mm}',
      '.np-row{display:flex;align-items:center;gap:5mm;padding:5mm;border:1.5px solid #eef0f1;border-radius:5mm;page-break-inside:avoid}',
      '.np-pin{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--np-accent);border-radius:50% 50% 50% 6px}',
      '.np-row-main{flex:1;min-width:0}',
      '.np-row-name{font-size:14pt;font-weight:700;color:' + NP.gray + ';line-height:1.15}',
      '.np-row-sub{font-size:9.5pt;color:#9aa0a3;margin-top:1mm}',
      '.np-offer{display:inline-block;margin-top:2.5mm;background:' + NP.anis + ';color:#3a3f0f;font-size:9.5pt;font-weight:700;padding:1.5mm 3.5mm;border-radius:999px}',
      '.np-price{flex-shrink:0;text-align:right;line-height:1}',
      '.np-price-old{display:block;font-size:11pt;color:#b7bcbe;text-decoration:line-through;margin-bottom:1mm}',
      '.np-price-new{display:block;font-size:24pt;font-weight:700;color:var(--np-accent)}',
      '.np-empty{padding:14mm;text-align:center;color:#b7bcbe;font-size:12pt}',
      '.np-foot{margin-top:auto;padding:10mm 16mm 14mm;border-top:2px solid var(--np-accent);display:flex;align-items:flex-end;justify-content:space-between;gap:14px}',
      '.np-foot-note{text-align:right;font-size:8.5pt;line-height:1.45;color:#9aa0a3;max-width:90mm}',
      // logo reconstitué
      '.np-logo{position:relative;line-height:1;display:flex;align-items:center;gap:4mm}',
      '.np-logo-img{display:block;height:18mm;width:auto}',
      '.np-logo-base{font-size:15pt;font-weight:700;color:' + NP.green + ";font-family:'Caveat','Varela Round',cursive}"
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'mkt-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ════════════════════════════════════════════
  // APERÇU LIVE (mise à l'échelle pour tenir dans la colonne)
  // ════════════════════════════════════════════
  function refreshPreview() {
    var host = document.getElementById('mkt-prev'); if (!host || !editing) return;
    host.innerHTML = '<div class="mkt-prev-scale" id="mkt-prev-scale">' + sheetHtml(editing) + '</div>';
    // échelle : 210mm ≈ 793px ; on adapte à la largeur dispo
    requestAnimationFrame(function () {
      var wrap = document.getElementById('mkt-prev');
      var scaleEl = document.getElementById('mkt-prev-scale');
      if (!wrap || !scaleEl) return;
      var avail = wrap.clientWidth - 4;
      var sheetW = 794; // 210mm en px @96dpi
      var s = Math.min(1, avail / sheetW);
      scaleEl.style.transform = 'scale(' + s + ')';
      var sheet = scaleEl.querySelector('.np-sheet');
      if (sheet) wrap.style.height = (sheet.offsetHeight * s + 4) + 'px';
    });
  }

  // ════════════════════════════════════════════
  // SÉLECTEUR PRODUIT (overlay BENCHMARK)
  // ════════════════════════════════════════════
  function searchBench(q) {
    var B = window.BENCHMARK || [];
    q = (q || '').trim().toLowerCase();
    var out = [];
    if (!q) {
      out = B.slice().sort(function (a, b) { return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9); }).slice(0, 30);
    } else {
      for (var i = 0; i < B.length && out.length < 30; i++) {
        var b = B[i];
        if ((b.designation || '').toLowerCase().indexOf(q) >= 0 || String(b.cip13 || '').indexOf(q) >= 0) out.push(b);
      }
    }
    return out;
  }
  function renderSelList() {
    var box = document.getElementById('mkt-sel-list'); if (!box) return;
    var inp = document.getElementById('mkt-sel-input');
    var results = searchBench(inp ? inp.value : '');
    if (!results.length) { box.innerHTML = '<div class="mkt-sel-empty">Aucun produit trouvé</div>'; return; }
    var inSel = {}; (editing.products || []).forEach(function (p) { inSel[String(p.cip13)] = true; });
    box.innerHTML = results.map(function (b) {
      var added = inSel[String(b.cip13)];
      var price = b.prix_ip != null ? V2.fmtEur(b.prix_ip) : (b.prix_ht != null ? V2.fmtEur(b.prix_ht) : '');
      return '<div class="mkt-sel-item' + (added ? ' added' : '') + '" data-cip="' + esc(b.cip13) + '">' +
        '<span>' + ICO('pill', 18, 1.7) + '</span>' +
        '<span class="nm"><b>' + esc(b.designation) + '</b><span>CIP ' + esc(b.cip13 || '—') + (b.categorie ? ' · ' + esc(b.categorie) : '') + '</span></span>' +
        (price ? '<span class="pr">' + price + '</span>' : '') + '</div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.mkt-sel-item'), function (el) {
      el.onclick = function () { addByCip(el.dataset.cip); };
    });
  }
  function openSelector() {
    if (!window.BENCHMARK || !window.BENCHMARK.length) {
      V2.toast('Chargement du catalogue…'); V2.loadFiles(['bench']).then(openSelector); return;
    }
    var bd = document.getElementById('mkt-sel-bd'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('mkt-sel-input');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
    renderSelList();
  }
  function closeSelector() { var bd = document.getElementById('mkt-sel-bd'); if (bd) bd.classList.remove('open'); }
  function addByCip(cip) {
    var B = window.BENCHMARK || [], b = null;
    for (var i = 0; i < B.length; i++) { if (String(B[i].cip13) === String(cip)) { b = B[i]; break; } }
    if (!b || !editing) return;
    if (editing.products.some(function (p) { return String(p.cip13) === String(cip); })) return;
    var offre = b.offre_ip ? String(b.offre_ip) : (b.remise_pct ? ('-' + Math.round(b.remise_pct) + '% groupement') : '');
    editing.products.push({
      cip13: b.cip13, designation: b.designation, categorie: b.categorie || '',
      picto: pictoFor(b.categorie),
      prixPromo: b.prix_ip != null ? b.prix_ip : (b.prix_ht != null ? b.prix_ht : ''),
      prixPublic: (b.prix_ht != null && b.prix_ip != null && b.prix_ht > b.prix_ip) ? b.prix_ht : '',
      offre: offre
    });
    renderEditorBody();
    renderSelList();
    refreshPreview();
    V2.toast(b.designation + ' ajouté');
  }

  // ════════════════════════════════════════════
  // ÉDITEUR
  // ════════════════════════════════════════════
  function prowHtml(p, i) {
    return '<div class="mkt-prow">' +
      '<div class="mkt-prow-main">' +
        '<div class="mkt-prow-name">' + esc(p.designation || '') + '</div>' +
        '<div class="mkt-prow-fields">' +
          '<input type="number" step="0.01" value="' + (p.prixPromo != null ? p.prixPromo : '') + '" placeholder="Prix promo €" oninput="V2.marketing.setP(' + i + ',\'prixPromo\',this.value)">' +
          '<input type="number" step="0.01" value="' + (p.prixPublic != null ? p.prixPublic : '') + '" placeholder="Prix barré €" oninput="V2.marketing.setP(' + i + ',\'prixPublic\',this.value)">' +
          '<input class="full" value="' + esc(p.offre || '') + '" placeholder="Offre (ex : 3 achetés = 1 offert)" oninput="V2.marketing.setP(' + i + ',\'offre\',this.value)">' +
        '</div>' +
      '</div>' +
      '<button class="mkt-rm" title="Retirer" onclick="V2.marketing.removeP(' + i + ')">' + ICO('close', 15, 2) + '</button>' +
    '</div>';
  }
  function renderEditorBody() {
    var box = document.getElementById('mkt-prows'); if (!box || !editing) return;
    box.innerHTML = (editing.products || []).length
      ? editing.products.map(prowHtml).join('')
      : '<div style="padding:18px;text-align:center;color:var(--muted);font-size:13.5px;border:1px dashed var(--line);border-radius:12px">Aucun produit. Clique sur « Ajouter un produit ».</div>';
  }

  function renderEditor(root) {
    injectStyles();
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Mes sélections' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-head" style="margin-bottom:18px">' +
          '<div><div class="v2-page-title">Fiche sélection OPSO</div>' +
          '<div class="v2-page-sub">Compose ta sélection, l\'aperçu se met à jour en direct. Export en PDF A4.</div></div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.marketing.downloadPdf()">' + ICO('download', 17, 2) + 'Télécharger le PDF</button>' +
        '</div>' +
        '<div class="mkt-edit">' +
          // colonne édition
          '<div>' +
            '<div class="v2-card" style="padding:18px">' +
              '<div class="mkt-field"><label>Titre</label><input value="' + esc(editing.title) + '" oninput="V2.marketing.set(\'title\',this.value)"></div>' +
              '<div class="mkt-field"><label>Sous-titre</label><input value="' + esc(editing.subtitle) + '" oninput="V2.marketing.set(\'subtitle\',this.value)"></div>' +
              '<div class="mkt-field"><label>Période</label><input value="' + esc(editing.month) + '" oninput="V2.marketing.set(\'month\',this.value)"></div>' +
              '<div class="mkt-field"><label>Texte d\'intro</label><textarea oninput="V2.marketing.set(\'intro\',this.value)">' + esc(editing.intro) + '</textarea></div>' +
              '<div class="mkt-field"><label>Thème couleur</label>' +
                '<div style="display:flex;gap:8px">' +
                  '<button class="v2-btn ' + (editing.theme !== 'rose' ? 'v2-btn-primary' : 'v2-btn-ghost') + '" onclick="V2.marketing.setTheme(\'green\')">Vert</button>' +
                  '<button class="v2-btn ' + (editing.theme === 'rose' ? 'v2-btn-primary' : 'v2-btn-ghost') + '" onclick="V2.marketing.setTheme(\'rose\')">Rose (Octobre Rose)</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="v2-card" style="padding:18px;margin-top:16px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
                '<div style="font-weight:700;font-size:14px">Produits de la sélection</div>' +
                '<button class="v2-btn v2-btn-ghost" onclick="V2.marketing.openSelector()">' + ICO('plus', 16, 2) + 'Ajouter</button>' +
              '</div>' +
              '<div id="mkt-prows"></div>' +
            '</div>' +
          '</div>' +
          // colonne aperçu
          '<div class="mkt-prev-wrap"><div id="mkt-prev"></div></div>' +
        '</div>' +
      '</div>' +
      // overlay sélecteur
      '<div id="mkt-sel-bd" class="mkt-sel-bd">' +
        '<div class="mkt-sel" onclick="event.stopPropagation()">' +
          '<div class="mkt-sel-search">' + ICO('search', 20, 2) +
            '<input id="mkt-sel-input" placeholder="Rechercher un produit (nom ou CIP)…" autocomplete="off">' +
            '<button class="mkt-rm" onclick="V2.marketing.closeSelector()">' + ICO('close', 16, 2) + '</button>' +
          '</div>' +
          '<div id="mkt-sel-list" class="mkt-sel-list"></div>' +
        '</div>' +
      '</div>';

    renderEditorBody();
    refreshPreview();
    var bd = document.getElementById('mkt-sel-bd'); if (bd) bd.onclick = closeSelector;
    var inp = document.getElementById('mkt-sel-input');
    if (inp) inp.addEventListener('input', renderSelList);
    window.addEventListener('resize', refreshPreview);
  }

  // ════════════════════════════════════════════
  // LISTE DES SÉLECTIONS
  // ════════════════════════════════════════════
  function renderList(root) {
    injectStyles();
    var all = getAll();
    var cards = all.length ? all.map(function (s) {
      var n = (s.products || []).length;
      return '<div class="v2-card" style="padding:16px 18px;display:flex;align-items:center;gap:14px;margin-bottom:12px">' +
        '<div style="width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--ip-blue) 14%,transparent);display:flex;align-items:center;justify-content:center;color:var(--ip-blue);flex-shrink:0">' + ICO('fiche', 20, 2) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:15px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.title || 'Sélection') + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted)">' + esc(s.month || '') + ' · ' + n + ' produit' + (n > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.marketing.open(\'' + s.id + '\')">Modifier</button>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.marketing.pdfById(\'' + s.id + '\')">' + ICO('download', 15, 2) + 'PDF</button>' +
        '<button class="mkt-rm" title="Supprimer" onclick="V2.marketing.del(\'' + s.id + '\')">' + ICO('close', 15, 2) + '</button>' +
      '</div>';
    }).join('') : '';

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap narrow">' +
        '<div class="v2-page-head" style="margin-bottom:18px">' +
          '<div><div class="v2-page-title">Fiches marketing OPSO</div>' +
          '<div class="v2-page-sub">Tes sélections de produits négociées par Intégral Pharma, en charte Normandie Pharma, prêtes à imprimer (A4).</div></div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.marketing.open(\'new\')">' + ICO('plus', 17, 2) + 'Nouvelle sélection</button>' +
        '</div>' +
        (cards || '<div class="v2-empty" style="padding:40px 20px;text-align:center">' +
          '<div style="font-weight:700;font-size:16px;margin-bottom:6px">Aucune sélection pour l\'instant</div>' +
          '<div style="color:var(--muted);margin-bottom:18px">Crée ta première fiche « Sélection by Intégral Pharma » pour les adhérents OPSO Santé.</div>' +
          '<button class="v2-btn v2-btn-primary" style="margin:0 auto" onclick="V2.marketing.open(\'new\')">' + ICO('plus', 17, 2) + 'Créer ma première sélection</button>' +
        '</div>') +
      '</div>';
  }

  // ════════════════════════════════════════════
  // PDF
  // ════════════════════════════════════════════
  function generatePdf(sel) {
    injectStyles();
    V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      var node = document.createElement('div');
      node.style.cssText = 'position:fixed;left:-10000px;top:0';
      node.innerHTML = sheetHtml(sel);
      document.body.appendChild(node);
      var fname = 'Selection-OPSO-' + fileSafe(sel.title) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().set({
        margin: 0, filename: fname,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: '.np-row' }
      }).from(node.firstChild).save().then(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        V2.toast('PDF téléchargé');
      }).catch(function (e) {
        if (node.parentNode) node.parentNode.removeChild(node);
        console.error('[V2 marketing pdf]', e); V2.toast('Échec du PDF', 'error');
      });
    }).catch(function () { V2.toast('Module PDF indisponible', 'error'); });
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
    setTheme: function (t) {
      if (!editing) return;
      editing.theme = t; saveOne(editing);
      // re-render boutons + aperçu
      var p = V2.pages['marketing-edit']; if (p) p.render(document.getElementById('v2-root'));
    },
    setP: function (i, k, v) { if (editing && editing.products[i]) { editing.products[i][k] = v; saveOne(editing); refreshPreview(); } },
    removeP: function (i) { if (editing) { editing.products.splice(i, 1); saveOne(editing); renderEditorBody(); refreshPreview(); } },
    openSelector: openSelector,
    closeSelector: closeSelector,
    downloadPdf: function () { if (editing) { saveOne(editing); generatePdf(editing); } },
    pdfById: function (id) { var s = getOne(id); if (s) generatePdf(s); },
    del: function (id) { if (confirm('Supprimer cette sélection ?')) { deleteOne(id); V2.render(); } }
  };

  // ── Pages (routeur) ──
  V2.pages.marketing = { render: function (root) { renderList(root); } };
  V2.pages['marketing-edit'] = {
    render: function (root, param) {
      if (!editing || (param && editing.id !== param)) { editing = getOne(param) || createSel(); }
      renderEditor(root);
    }
  };
})();
