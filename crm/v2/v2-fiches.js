/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier Fiches commerciales — création de fiches produits PDF
   à montrer / envoyer au pharmacien. Persistance localStorage ('v2_fiches').
   Aucun emoji rendu : iconographie ICO() uniquement.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2;
  if (!V2) return;
  var esc = V2.esc;

  var LS_KEY = 'v2_fiches';
  var editingFiche = null;   // fiche en cours d'édition (state module)

  // ── Persistance ───────────────────────────────
  function getFiches() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function getFiche(id) {
    var all = getFiches();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function createFiche() {
    return { id: 'f' + Date.now(), title: '', products: [], created: Date.now() };
  }
  function saveFiche(fiche) {
    var all = getFiches();
    var found = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === fiche.id) { all[i] = fiche; found = true; break; }
    }
    if (!found) all.unshift(fiche);
    writeAll(all);
  }
  function deleteFiche(id) {
    writeAll(getFiches().filter(function (f) { return f.id !== id; }));
  }

  // ── Helpers ───────────────────────────────────
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch (e) { return ''; }
  }
  function fileSafe(s) {
    return String(s || 'fiche').trim().replace(/[^\wÀ-ſ-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'fiche';
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // une seule rangée produit (réutilisée au render initial + refresh)
  function productRow(p, i) {
    return ''+
      '<div class="fch-prow">'+
        '<div class="fch-prow-main">'+
          '<div class="fch-prow-name">' + esc(p.designation) + '</div>'+
          '<div class="fch-prow-cip">CIP ' + esc(p.cip13 || '—') + '</div>'+
        '</div>'+
        '<div class="fch-pricewrap">'+
          '<span class="fch-pricelab">Prix IP €</span>'+
          '<input class="fch-price" type="number" step="0.01" min="0" value="' + (p.prix_ip != null ? p.prix_ip : '') + '" '+
            'oninput="V2.fiches.setPrice(' + i + ',this.value)">'+
        '</div>'+
        '<div class="fch-pricewrap">'+
          '<span class="fch-pricelab">Remise %</span>'+
          '<input class="fch-price fch-rem" type="number" step="0.1" min="0" value="' + (p.remise_pct != null ? p.remise_pct : '') + '" '+
            'oninput="V2.fiches.setRemise(' + i + ',this.value)">'+
        '</div>'+
        '<button class="fch-rmbtn" title="Retirer" onclick="V2.fiches.removeProduct(' + i + ')">' + ICO('close', 15, 2) + '</button>'+
      '</div>';
  }
  function emptyProducts() {
    return '<div class="v2-empty" style="padding:36px 20px">'+
      '<div class="v2-empty-ico" style="width:50px;height:50px">' + ICO('pill', 50, 1.4) + '</div>'+
      '<div class="v2-empty-d" style="margin-bottom:0">Aucun produit. Ajoute des références depuis le catalogue.</div>'+
      '</div>';
  }

  // styles inline propres au pilier (s'appuie sur v2.css pour le reste)
  var STY = ''+
    '<style id="v2-fiches-sty">'+
    '.fch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}'+
    '.fch-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:20px;display:flex;flex-direction:column;gap:4px;transition:.2s var(--ease)}'+
    '.fch-card:hover{transform:translateY(-3px);box-shadow:var(--sh-3);border-color:rgba(0,80,230,.22)}'+
    '.fch-card-t{font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:2px}'+
    '.fch-card-m{font-size:12.5px;color:var(--muted);display:flex;gap:9px;align-items:center;margin-bottom:14px}'+
    '.fch-card-m .sep{width:3px;height:3px;border-radius:50%;background:var(--muted-2)}'+
    '.fch-card-acts{display:flex;gap:8px;margin-top:auto}'+
    '.fch-card-acts .v2-btn{flex:1;padding:9px 10px;font-size:13px}'+
    '.fch-icobtn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;flex:0 0 auto;'+
    'border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;box-shadow:var(--sh-1);transition:.16s var(--ease)}'+
    '.fch-icobtn:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}'+
    '.fch-titlefield{width:100%;font-family:var(--font);font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--ip-ink);'+
    'border:none;outline:none;background:none;padding:6px 0;border-bottom:2px solid var(--line);margin-bottom:22px;transition:.18s var(--ease)}'+
    '.fch-titlefield:focus{border-bottom-color:var(--ip-blue)}'+
    '.fch-titlefield::placeholder{color:var(--muted-2);font-weight:700}'+
    '.fch-prow{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid var(--line)}'+
    '.fch-prow:last-child{border-bottom:none}'+
    '.fch-prow-main{flex:1;min-width:0}'+
    '.fch-prow-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.fch-prow-cip{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:2px}'+
    '.fch-pricewrap{display:flex;flex-direction:column;align-items:flex-end;gap:3px}'+
    '.fch-pricelab{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}'+
    '.fch-price{width:96px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--ip-ink);'+
    'border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--card-2);outline:none;transition:.16s var(--ease)}'+
    '.fch-price:focus{border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}'+
    '.fch-rem{width:62px}'+
    '.fch-rmbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:0 0 auto;border-radius:9px;'+
    'border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;transition:.16s var(--ease)}'+
    '.fch-rmbtn:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}'+
    '.fch-editbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}'+
    '.fch-sel-bd{position:fixed;inset:0;z-index:210;background:rgba(16,19,28,.34);backdrop-filter:blur(7px);'+
    '-webkit-backdrop-filter:blur(7px);display:flex;align-items:flex-start;justify-content:center;padding-top:9vh;opacity:0;pointer-events:none;transition:opacity .2s var(--ease-soft)}'+
    '.fch-sel-bd.open{opacity:1;pointer-events:auto}'+
    '.fch-sel{width:min(620px,93vw);max-height:74vh;background:var(--card);border-radius:18px;box-shadow:var(--sh-pop);'+
    'display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);opacity:0;transition:transform .24s var(--ease),opacity .18s}'+
    '.fch-sel-bd.open .fch-sel{transform:scale(1);opacity:1}'+
    '.fch-sel-search{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line)}'+
    '.fch-sel-search svg{color:var(--ip-blue);flex-shrink:0}'+
    '.fch-sel-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}'+
    '.fch-sel-list{overflow-y:auto;padding:8px}'+
    '.fch-sel-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;cursor:pointer;transition:background .12s}'+
    '.fch-sel-item:hover{background:var(--halo)}'+
    '.fch-sel-item .ic{width:34px;height:34px;border-radius:9px;background:var(--card-2);display:flex;align-items:center;justify-content:center;color:var(--ip-blue);flex-shrink:0}'+
    '.fch-sel-item .nm{flex:1;min-width:0}'+
    '.fch-sel-item .nm b{display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.fch-sel-item .nm span{font-family:var(--mono);font-size:11px;color:var(--muted)}'+
    '.fch-sel-item .pr{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--c-mint);flex-shrink:0}'+
    '.fch-sel-item.added{opacity:.45;pointer-events:none}'+
    '.fch-sel-empty{padding:34px 20px;text-align:center;color:var(--muted);font-size:13.5px}'+
    '</style>';

  // ════════════════════════════════════════════
  // VUE LISTE
  // ════════════════════════════════════════════
  function renderList(root) {
    var fiches = getFiches();
    var head = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });

    var body;
    if (!fiches.length) {
      body = ''+
        '<div class="v2-empty">'+
          '<div class="v2-empty-ico">' + ICO('fiche', 64, 1.4) + '</div>'+
          '<div class="v2-empty-t">Aucune fiche pour le moment</div>'+
          '<div class="v2-empty-d">Crée une fiche produit sur-mesure à montrer ou envoyer au pharmacien, puis sors-la en PDF propre.</div>'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.open(\'new\')">' + ICO('plus', 17, 2) + 'Créer ma première fiche</button>'+
        '</div>';
    } else {
      var cards = fiches.map(function (f) {
        var n = (f.products || []).length;
        var title = f.title && f.title.trim() ? f.title : 'Fiche sans titre';
        return ''+
          '<div class="fch-card">'+
            '<div class="fch-card-t">' + esc(title) + '</div>'+
            '<div class="fch-card-m">'+
              '<span>' + n + ' produit' + (n > 1 ? 's' : '') + '</span>'+
              '<span class="sep"></span>'+
              '<span>' + fmtDate(f.created) + '</span>'+
            '</div>'+
            '<div class="fch-card-acts">'+
              '<button class="v2-btn v2-btn-ghost" onclick="V2.fiches.open(\'' + f.id + '\')">Ouvrir</button>'+
              '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.pdfById(\'' + f.id + '\')">' + ICO('download', 15, 2) + 'PDF</button>'+
              '<button class="fch-icobtn" title="Supprimer" onclick="V2.fiches.remove(\'' + f.id + '\')">' + ICO('close', 16, 2) + '</button>'+
            '</div>'+
          '</div>';
      }).join('');
      body = '<div class="fch-grid">' + cards + '</div>';
    }

    root.innerHTML = head + STY +
      '<div class="v2-wrap">'+
        '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px">'+
          '<div>'+
            '<div class="v2-page-title">Fiches commerciales</div>'+
            '<div class="v2-page-sub" style="margin-bottom:0">Tes fiches produits à présenter en rendez-vous</div>'+
          '</div>'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.open(\'new\')">' + ICO('plus', 17, 2) + 'Nouvelle fiche</button>'+
        '</div>' +
        body +
      '</div>';
  }

  // ════════════════════════════════════════════
  // VUE ÉDITION
  // ════════════════════════════════════════════
  function renderEdit(root, param) {
    // initialise / récupère l'état d'édition
    if (param === 'new') {
      if (!editingFiche) editingFiche = createFiche();
    } else {
      var existing = getFiche(param);
      if (!existing) { V2.toast('Fiche introuvable', 'error'); V2.go('fiches'); return; }
      if (!editingFiche || editingFiche.id !== existing.id) {
        editingFiche = { id: existing.id, title: existing.title, created: existing.created,
                         products: (existing.products || []).map(function (p) { return Object.assign({}, p); }) };
      }
    }

    var head = V2.topbar({ back: true, backTo: 'fiches', backLabel: 'Fiches' });
    var n = editingFiche.products.length;
    var prodHtml = n ? editingFiche.products.map(productRow).join('') : emptyProducts();

    root.innerHTML = head + STY +
      '<div class="v2-wrap narrow">'+
        '<input class="fch-titlefield" id="fch-title" placeholder="Titre de la fiche…" value="' + esc(editingFiche.title) + '" '+
          'oninput="V2.fiches.setTitle(this.value)">'+
        '<div class="v2-card">'+
          '<div class="v2-card-head">'+
            '<div class="v2-card-t">' + ICO('cart', 17, 1.8) + 'Produits de la fiche</div>'+
            '<span class="v2-card-link" id="fch-count" style="cursor:default">' + n + ' produit' + (n > 1 ? 's' : '') + '</span>'+
          '</div>'+
          '<div id="fch-prodlist">' + prodHtml + '</div>'+
        '</div>'+
        '<div class="fch-editbar">'+
          '<button class="v2-btn v2-btn-ghost" onclick="V2.fiches.openSelector()">' + ICO('plus', 17, 2) + 'Ajouter un produit</button>'+
          '<button class="v2-btn v2-btn-ghost" onclick="V2.fiches.save()">' + ICO('check', 17, 2) + 'Enregistrer</button>'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.downloadPdf()">' + ICO('download', 17, 2) + 'Télécharger PDF</button>'+
        '</div>'+
      '</div>' +
      selectorMarkup();

    wireSelector();
  }

  // re-render léger de la liste produits (préserve le champ titre)
  function refreshProducts() {
    var box = document.getElementById('fch-prodlist');
    var cnt = document.getElementById('fch-count');
    if (!box) { V2.render(); return; }
    var n = editingFiche.products.length;
    box.innerHTML = n ? editingFiche.products.map(productRow).join('') : emptyProducts();
    if (cnt) cnt.textContent = n + ' produit' + (n > 1 ? 's' : '');
  }

  // ════════════════════════════════════════════
  // SÉLECTEUR PRODUIT (overlay BENCHMARK)
  // ════════════════════════════════════════════
  function selectorMarkup() {
    return ''+
      '<div id="fch-sel" class="fch-sel-bd">'+
        '<div class="fch-sel" onclick="event.stopPropagation()">'+
          '<div class="fch-sel-search">' + ICO('search', 21, 2) +
            '<input id="fch-sel-input" placeholder="Rechercher un produit (désignation ou CIP)…" autocomplete="off">'+
            '<button class="fch-rmbtn" onclick="V2.fiches.closeSelector()" title="Fermer">' + ICO('close', 16, 2) + '</button>'+
          '</div>'+
          '<div id="fch-sel-list" class="fch-sel-list"></div>'+
        '</div>'+
      '</div>';
  }

  function searchBenchmark(q) {
    var B = window.BENCHMARK || [];
    q = (q || '').trim().toLowerCase();
    var out = [];
    if (!q) {
      out = B.slice().sort(function (a, b) { return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9); }).slice(0, 30);
    } else {
      for (var i = 0; i < B.length && out.length < 30; i++) {
        var b = B[i];
        var d = (b.designation || '').toLowerCase();
        var c = String(b.cip13 || '');
        if (d.indexOf(q) >= 0 || c.indexOf(q) >= 0) out.push(b);
      }
    }
    return out;
  }

  function renderSelectorList() {
    var box = document.getElementById('fch-sel-list'); if (!box) return;
    var inp = document.getElementById('fch-sel-input');
    var q = inp ? inp.value : '';
    var results = searchBenchmark(q);
    if (!results.length) {
      box.innerHTML = '<div class="fch-sel-empty">Aucun produit trouvé pour « ' + esc(q) + ' »</div>';
      return;
    }
    var inFiche = {};
    (editingFiche.products || []).forEach(function (p) { inFiche[String(p.cip13)] = true; });
    box.innerHTML = results.map(function (b) {
      var added = inFiche[String(b.cip13)];
      var price = b.prix_ip != null ? V2.fmtEur(b.prix_ip) : (b.prix_ht != null ? V2.fmtEur(b.prix_ht) : '');
      return ''+
        '<div class="fch-sel-item' + (added ? ' added' : '') + '" data-cip="' + esc(b.cip13) + '">'+
          '<span class="ic">' + ICO('pill', 18, 1.7) + '</span>'+
          '<span class="nm"><b>' + esc(b.designation) + '</b><span>CIP ' + esc(b.cip13 || '—') + '</span></span>'+
          (price ? '<span class="pr">' + price + '</span>' : '') +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.fch-sel-item'), function (el) {
      el.onclick = function () { addProductByCip(el.dataset.cip); };
    });
  }

  function wireSelector() {
    var bd = document.getElementById('fch-sel'); if (!bd) return;
    bd.onclick = function () { closeSelector(); };
    var inp = document.getElementById('fch-sel-input');
    if (inp) {
      inp.addEventListener('input', renderSelectorList);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSelector(); });
    }
  }

  function openSelector() {
    var B = window.BENCHMARK;
    if (!B || !B.length) {
      V2.toast('Chargement du catalogue…');
      V2.loadFiles(['bench']).then(function () { openSelector(); });
      return;
    }
    var bd = document.getElementById('fch-sel'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('fch-sel-input');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
    renderSelectorList();
  }
  function closeSelector() {
    var bd = document.getElementById('fch-sel'); if (bd) bd.classList.remove('open');
  }

  function addProductByCip(cip) {
    var B = window.BENCHMARK || [];
    var b = null;
    for (var i = 0; i < B.length; i++) { if (String(B[i].cip13) === String(cip)) { b = B[i]; break; } }
    if (!b) return;
    if (editingFiche.products.some(function (p) { return String(p.cip13) === String(cip); })) return;
    editingFiche.products.push({
      cip13: b.cip13,
      designation: b.designation,
      prix_ip: b.prix_ip != null ? b.prix_ip : (b.prix_ht != null ? b.prix_ht : null),
      prix_ht: b.prix_ht != null ? b.prix_ht : null,
      remise_pct: b.remise_pct != null ? b.remise_pct : null,
      is_froid: !!b.is_froid
    });
    refreshProducts();
    renderSelectorList();
    V2.toast(b.designation + ' ajouté');
  }

  // ════════════════════════════════════════════
  // PDF
  // ════════════════════════════════════════════
  function buildPdfNode(fiche) {
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var title = fiche.title && fiche.title.trim() ? fiche.title : 'Fiche commerciale';
    var count = (fiche.products || []).length;
    var rows = (fiche.products || []).map(function (p, i) {
      var prix = (p.prix_ip != null && p.prix_ip !== '') ? num(p.prix_ip).toFixed(2).replace('.', ',') + ' €' : '—';
      var rem = (p.remise_pct != null && p.remise_pct !== '') ? String(p.remise_pct).replace('.', ',') + ' %' : '—';
      return ''+
        '<tr style="border-bottom:1px solid #ECEFF5">'+
          '<td style="padding:11px 14px;font-size:11px;color:#9AA1B2;font-family:monospace;text-align:center;width:34px">' + (i + 1) + '</td>'+
          '<td style="padding:11px 14px;font-size:12.5px;font-weight:600;color:#10131C">' + esc(p.designation) +
            (p.is_froid ? ' <span style="font-size:9px;color:#0050E6;border:1px solid #cdddff;border-radius:6px;padding:1px 5px;vertical-align:middle">FROID</span>' : '') + '</td>'+
          '<td style="padding:11px 14px;font-size:11.5px;color:#737A8C;font-family:monospace">' + esc(p.cip13 || '—') + '</td>'+
          '<td style="padding:11px 14px;font-size:12.5px;font-weight:700;color:#10131C;text-align:right;font-family:monospace">' + prix + '</td>'+
          '<td style="padding:11px 14px;font-size:12.5px;color:#1E9E6A;font-weight:700;text-align:right;font-family:monospace">' + rem + '</td>'+
        '</tr>';
    }).join('');

    var html = ''+
      '<div style="font-family:Inter,Arial,sans-serif;color:#10131C;width:794px;box-sizing:border-box;padding:42px 46px;background:#fff">'+
        // En-tête : logo IP (carré bleu + croix), nom, titre, date
        '<div style="display:flex;align-items:center;gap:14px;padding-bottom:22px;border-bottom:2px solid #10131C">'+
          '<div style="width:44px;height:44px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);position:relative;flex-shrink:0">'+
            '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:20px">'+
              '<div style="position:absolute;left:50%;top:0;width:2.6px;height:100%;background:#fff;transform:translateX(-50%);border-radius:2px"></div>'+
              '<div style="position:absolute;top:50%;left:0;height:2.6px;width:100%;background:#fff;transform:translateY(-50%);border-radius:2px"></div>'+
            '</div>'+
          '</div>'+
          '<div style="flex:1">'+
            '<div style="font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1">Intégral Pharma</div>'+
            '<div style="font-size:11px;color:#737A8C;margin-top:3px">Fiche commerciale · ' + esc(dateStr) + '</div>'+
          '</div>'+
        '</div>'+
        '<h1 style="font-size:24px;font-weight:800;letter-spacing:-.03em;margin:18px 0 4px">' + esc(title) + '</h1>'+
        '<div style="font-size:12px;color:#737A8C;margin-bottom:22px">' + count + ' produit' + (count > 1 ? 's' : '') + ' sélectionné' + (count > 1 ? 's' : '') + '</div>'+
        // Tableau produits
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr style="background:#F7F9FC;border-bottom:1.5px solid #E2E7F0">'+
            '<th style="padding:9px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:center">#</th>'+
            '<th style="padding:9px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:left">Désignation</th>'+
            '<th style="padding:9px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:left">CIP 13</th>'+
            '<th style="padding:9px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Prix IP</th>'+
            '<th style="padding:9px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Remise</th>'+
          '</tr></thead>'+
          '<tbody>' + (rows || '<tr><td colspan="5" style="padding:24px;text-align:center;color:#9AA1B2;font-size:12px">Aucun produit</td></tr>') + '</tbody>'+
        '</table>'+
        // Footer discret
        '<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ECEFF5;display:flex;justify-content:space-between;font-size:10px;color:#9AA1B2">'+
          '<span>Intégral Pharma · Document commercial</span>'+
          '<span>Prix indicatifs HT · ' + esc(dateStr) + '</span>'+
        '</div>'+
      '</div>';

    var node = document.createElement('div');
    node.style.cssText = 'position:fixed;left:-10000px;top:0';
    node.innerHTML = html;
    return node;
  }

  function generatePdf(fiche) {
    V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      var node = buildPdfNode(fiche);
      document.body.appendChild(node);
      var fname = 'Fiche-' + fileSafe(fiche.title) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().set({
        margin: 0,
        filename: fname,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(node.firstChild).save().then(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        V2.toast('PDF téléchargé');
      }).catch(function (e) {
        if (node.parentNode) node.parentNode.removeChild(node);
        console.error('[V2 fiches pdf]', e);
        V2.toast('Échec du PDF', 'error');
      });
    }).catch(function () { V2.toast('Impossible de charger le module PDF', 'error'); });
  }

  // ════════════════════════════════════════════
  // API PUBLIQUE (handlers onclick)
  // ════════════════════════════════════════════
  V2.fiches = {
    open: function (id) { editingFiche = null; V2.go('fiches', id); },
    remove: function (id) {
      var f = getFiche(id);
      var label = f && f.title && f.title.trim() ? '« ' + f.title + ' »' : 'cette fiche';
      if (confirm('Supprimer ' + label + ' ?')) { deleteFiche(id); V2.toast('Fiche supprimée'); V2.render(); }
    },
    setTitle: function (v) { if (editingFiche) editingFiche.title = v; },
    setPrice: function (i, v) { if (editingFiche && editingFiche.products[i]) editingFiche.products[i].prix_ip = v === '' ? null : num(v); },
    setRemise: function (i, v) { if (editingFiche && editingFiche.products[i]) editingFiche.products[i].remise_pct = v === '' ? null : num(v); },
    removeProduct: function (i) { if (editingFiche) { editingFiche.products.splice(i, 1); refreshProducts(); } },
    openSelector: openSelector,
    closeSelector: closeSelector,
    save: function () {
      if (!editingFiche) return;
      if (!editingFiche.title || !editingFiche.title.trim()) { editingFiche.title = 'Fiche du ' + fmtDate(Date.now()); }
      saveFiche(editingFiche);
      V2.toast('Fiche enregistrée');
      var tf = document.getElementById('fch-title'); if (tf) tf.value = editingFiche.title;
    },
    downloadPdf: function () {
      if (!editingFiche) return;
      if (!editingFiche.products.length) { V2.toast('Ajoute au moins un produit', 'warn'); return; }
      generatePdf(editingFiche);
    },
    pdfById: function (id) {
      var f = getFiche(id);
      if (!f) { V2.toast('Fiche introuvable', 'error'); return; }
      if (!(f.products || []).length) { V2.toast('Cette fiche n\'a aucun produit', 'warn'); return; }
      generatePdf(f);
    }
  };

  // ════════════════════════════════════════════
  // ENREGISTREMENT PAGE
  // ════════════════════════════════════════════
  V2.pages.fiches = {
    render: function (root, param) {
      if (param) { renderEdit(root, param); }
      else { renderList(root); }
    }
  };
})();
