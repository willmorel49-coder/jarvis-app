/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier Fiches commerciales — listes de produits sur-mesure
   à présenter / envoyer au pharmacien, export PDF A4.

   Nouveautés (maquette validée 2026-06-10) :
   · "Fiche en cours" — panier alimenté depuis le catalogue ET les
     opportunités pharmacie (clé localStorage 'v2_fiche_courante'),
     finalisable en vraie fiche.
   · Destinataire pharmacie (optionnel) — porté sur la fiche + le PDF.
   · Marge MDL par ligne + barre de totaux (prix net IP + marge MDL).

   Persistance fiches : localStorage 'v2_fiches'. Aucun emoji : ICO() seul.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2;
  if (!V2) return;
  var esc = V2.esc;

  var LS_KEY = 'v2_fiches';
  var CART_KEY = 'v2_fiche_courante';
  var editingFiche = null;   // fiche en cours d'édition (state module)

  // ── Persistance fiches ────────────────────────
  function getFiches() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) { try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {} }
  function getFiche(id) {
    var all = getFiches();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function createFiche() { return { id: 'f' + Date.now(), title: '', destId: null, products: [], created: Date.now() }; }
  function saveFiche(fiche) {
    var all = getFiches(), found = false;
    for (var i = 0; i < all.length; i++) { if (all[i].id === fiche.id) { all[i] = fiche; found = true; break; } }
    if (!found) all.unshift(fiche);
    writeAll(all);
  }
  function deleteFiche(id) { writeAll(getFiches().filter(function (f) { return f.id !== id; })); }

  // ── Panier "fiche en cours" (partagé catalogue + opportunités) ──
  function readCart() {
    try {
      var c = JSON.parse(localStorage.getItem(CART_KEY) || '{"products":[]}');
      if (!c || !Array.isArray(c.products)) return { products: [] };
      return c;
    } catch (e) { return { products: [] }; }
  }
  function writeCart(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {} }

  // API publique du panier — appelée par le catalogue et les opportunités.
  // (ces fichiers se chargent avant celui-ci, mais l'appel est runtime → OK)
  V2.ficheCart = {
    get: function () { return readCart(); },
    count: function () { return readCart().products.length; },
    has: function (cip) { return readCart().products.some(function (p) { return String(p.cip13) === String(cip); }); },
    add: function (p) {
      var c = readCart();
      if (c.products.some(function (x) { return String(x.cip13) === String(p.cip13); })) return c.products.length;
      c.products.push({
        cip13: p.cip13, designation: p.designation,
        prix_ip: p.prix_ip != null ? p.prix_ip : (p.prix_ht != null ? p.prix_ht : null),
        prix_ht: p.prix_ht != null ? p.prix_ht : null,
        remise_pct: p.remise_pct != null ? p.remise_pct : null,
        is_froid: !!p.is_froid,
        src: p.src || 'cat'
      });
      writeCart(c);
      return c.products.length;
    },
    remove: function (cip) {
      var c = readCart();
      c.products = c.products.filter(function (p) { return String(p.cip13) !== String(cip); });
      writeCart(c);
      return c.products.length;
    },
    clear: function () { writeCart({ products: [] }); }
  };

  // ── Marge MDL (barème officiel France, remboursables) ──
  function margeMDL(net) {
    var p = +net || 0;
    if (p <= 0) return 0;
    if (p <= 4.33) return 0.18;
    if (p <= 468) return p * 0.039;
    return 19.50;
  }
  function netPrice(p) {
    var prix = (p.prix_ip != null && p.prix_ip !== '') ? +p.prix_ip : 0;
    var rem = (p.remise_pct != null && p.remise_pct !== '') ? +p.remise_pct : 0;
    return prix * (1 - (rem / 100));
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
  function pharmaById(id) { return (V2.pharmacies || []).find(function (p) { return String(p.id) === String(id); }) || null; }
  function pharmaLabel(p) { return p ? (p.name + (p.code ? ' · ' + p.code : (p.ville ? ' · ' + p.ville : ''))) : ''; }

  // une seule rangée produit (réutilisée au render initial + refresh)
  function productRow(p, i) {
    var net = netPrice(p), mdl = margeMDL(net);
    return ''+
      '<div class="fch-prow">'+
        '<div class="fch-prow-idx mono">' + (i + 1) + '</div>'+
        '<div class="fch-prow-main">'+
          '<div class="fch-prow-name">' + esc(p.designation) +
            (p.is_froid ? '<span class="fch-tagf">FROID</span>' : '') + '</div>'+
          '<div class="fch-prow-cip">CIP ' + esc(p.cip13 || '—') + ' · net <span id="fch-net-' + i + '">' + V2.fmtEur(net) + '</span></div>'+
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
        '<div class="fch-mdl"><div class="fch-mdl-l">Marge MDL</div><div class="fch-mdl-v mono" id="fch-mdl-' + i + '">' + V2.fmtEur(mdl) + '</div></div>'+
        '<button class="fch-rmbtn" title="Retirer" onclick="V2.fiches.removeProduct(' + i + ')">' + ICO('close', 15, 2) + '</button>'+
      '</div>';
  }
  function emptyProducts() {
    return '<div class="v2-empty" style="padding:36px 20px">'+
      '<div class="v2-empty-ico" style="width:50px;height:50px">' + ICO('pill', 50, 1.4) + '</div>'+
      '<div class="v2-empty-d" style="margin-bottom:0">Aucun produit. Ajoute des références depuis le catalogue, les opportunités, ou le bouton ci-dessous.</div>'+
      '</div>';
  }

  // styles inline propres au pilier (s'appuie sur v2.css pour le reste)
  var STY = ''+
    '<style id="v2-fiches-sty">'+
    '.fch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}'+
    '.fch-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:20px;display:flex;flex-direction:column;transition:.2s var(--ease);cursor:pointer}'+
    '.fch-card:hover{transform:translateY(-3px);box-shadow:var(--sh-3);border-color:rgba(0,80,230,.22)}'+
    '.fch-card-t{font-size:16px;font-weight:800;letter-spacing:-.02em}'+
    '.fch-card-dest{font-size:12.5px;color:var(--ip-blue);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:6px}'+
    '.fch-card-dest.none{color:var(--muted-2);font-weight:500}'+
    '.fch-card-m{font-size:12px;color:var(--muted);display:flex;gap:9px;align-items:center;margin:12px 0 14px}'+
    '.fch-card-m .sep{width:3px;height:3px;border-radius:50%;background:var(--muted-2)}'+
    '.fch-card-foot{display:flex;gap:1px;background:var(--line);border-radius:12px;overflow:hidden;margin-top:auto}'+
    '.fch-kpi{flex:1;background:var(--card-2);padding:9px 12px}'+
    '.fch-kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700}'+
    '.fch-kpi .v{font-family:var(--mono);font-weight:700;font-size:14px;margin-top:2px}'+
    '.fch-card-acts{display:flex;gap:8px;margin-top:14px}'+
    '.fch-card-acts .v2-btn{flex:1;padding:9px 10px;font-size:13px}'+
    '.fch-icobtn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;flex:0 0 auto;'+
    'border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;box-shadow:var(--sh-1);transition:.16s var(--ease)}'+
    '.fch-icobtn:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}'+
    // fiche en cours
    '.fch-encours{background:linear-gradient(135deg,#fff,#F2F7FF);border:1px solid color-mix(in srgb,var(--ip-blue) 24%,var(--line));border-radius:var(--r-card);box-shadow:var(--sh-2);padding:20px 22px;margin-bottom:26px;position:relative;overflow:hidden}'+
    '.fch-encours::after{content:"";position:absolute;right:-30px;top:-30px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(0,80,230,.10),transparent 70%)}'+
    '.fch-ec-tag{display:inline-flex;align-items:center;gap:7px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--ip-blue);margin-bottom:9px}'+
    '.fch-ec-tag .dot{width:7px;height:7px;border-radius:50%;background:var(--ip-blue);box-shadow:0 0 0 4px rgba(0,80,230,.14);animation:fchPulse 2s var(--ease) infinite}'+
    '@keyframes fchPulse{50%{box-shadow:0 0 0 7px rgba(0,80,230,0)}}'+
    '.fch-ec-title{font-size:18px;font-weight:800;letter-spacing:-.02em}'+
    '.fch-ec-sub{font-size:13px;color:var(--muted);margin:3px 0 14px}'+
    '.fch-ec-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}'+
    '.fch-ec-chip{font-size:12px;font-weight:600;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:6px 10px;display:flex;align-items:center;gap:7px}'+
    '.fch-ec-chip .src{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:1px 5px;border-radius:5px}'+
    '.fch-ec-chip .src.cat{color:var(--c-cat);background:color-mix(in srgb,var(--c-cat) 12%,#fff)}'+
    '.fch-ec-chip .src.opp{color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,#fff)}'+
    '.fch-ec-acts{display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:1}'+
    // éditeur
    '.fch-titlefield{width:100%;font-family:var(--font);font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--ip-ink);'+
    'border:none;outline:none;background:none;padding:6px 0;border-bottom:2px solid var(--line);margin-bottom:18px;transition:.18s var(--ease)}'+
    '.fch-titlefield:focus{border-bottom-color:var(--ip-blue)}'+
    '.fch-titlefield::placeholder{color:var(--muted-2);font-weight:700}'+
    '.fch-dest{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:13px 16px;margin-bottom:22px;box-shadow:var(--sh-1)}'+
    '.fch-dest-ic{width:38px;height:38px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--c-opp),#13794f)}'+
    '.fch-dest-l{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}'+
    '.fch-dest-v{font-size:15px;font-weight:700;margin-top:1px}'+
    '.fch-dest-v.none{color:var(--muted-2);font-weight:500}'+
    '.fch-dest-change{margin-left:auto;font-size:12.5px;font-weight:700;color:var(--ip-blue);cursor:pointer;background:none;border:none}'+
    '.fch-prow{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid var(--line)}'+
    '.fch-prow:last-child{border-bottom:none}'+
    '.fch-prow-idx{font-size:12px;color:var(--muted-2);width:20px;text-align:right;flex-shrink:0}'+
    '.fch-prow-main{flex:1;min-width:0}'+
    '.fch-prow-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:8px}'+
    '.fch-tagf{font-size:8.5px;font-weight:800;letter-spacing:.03em;padding:1px 5px;border-radius:5px;color:var(--c-froid);background:color-mix(in srgb,var(--c-froid) 13%,#fff);flex-shrink:0}'+
    '.fch-prow-cip{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:2px}'+
    '.fch-pricewrap{display:flex;flex-direction:column;align-items:flex-end;gap:3px}'+
    '.fch-pricelab{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}'+
    '.fch-price{width:90px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--ip-ink);'+
    'border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--card-2);outline:none;transition:.16s var(--ease)}'+
    '.fch-price:focus{border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}'+
    '.fch-rem{width:60px}'+
    '.fch-mdl{text-align:right;min-width:74px}'+
    '.fch-mdl-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700}'+
    '.fch-mdl-v{font-size:14px;font-weight:700;color:var(--c-opp);margin-top:3px}'+
    '.fch-rmbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:0 0 auto;border-radius:9px;'+
    'border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;transition:.16s var(--ease)}'+
    '.fch-rmbtn:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}'+
    '.fch-editbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}'+
    // barre totaux
    '.fch-totals{position:sticky;bottom:18px;margin-top:24px;background:var(--ip-ink);color:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(16,19,28,.3);display:flex;align-items:center;gap:2px;overflow:hidden;padding:4px}'+
    '.fch-tot{flex:1;padding:13px 18px}'+
    '.fch-tot-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.55);font-weight:700}'+
    '.fch-tot-v{font-family:var(--mono);font-size:19px;font-weight:700;margin-top:3px}'+
    '.fch-tot-v.green{color:#46D399}.fch-tot-v.blue{color:#79A8FF}'+
    '.fch-tot-sep{width:1px;align-self:stretch;background:rgba(255,255,255,.12);margin:10px 0}'+
    // sélecteurs overlay
    '.fch-sel-bd{position:fixed;inset:0;z-index:210;background:rgba(16,19,28,.34);backdrop-filter:blur(7px);'+
    '-webkit-backdrop-filter:blur(7px);display:flex;align-items:flex-start;justify-content:center;padding-top:9vh;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}'+
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
  function encoursCardHtml() {
    var cart = readCart();
    var n = cart.products.length;
    if (!n) return '';
    var chips = cart.products.slice(0, 12).map(function (p) {
      var src = p.src === 'opp' ? 'opp' : 'cat';
      var lab = src === 'opp' ? 'Opp' : 'Catal.';
      var name = (p.designation || '').length > 26 ? (p.designation || '').slice(0, 24) + '…' : (p.designation || '');
      return '<span class="fch-ec-chip"><span class="src ' + src + '">' + lab + '</span>' + esc(name) + '</span>';
    }).join('');
    var more = n > 12 ? '<span class="fch-ec-chip">+ ' + (n - 12) + '</span>' : '';
    return ''+
      '<div class="fch-encours">'+
        '<div class="fch-ec-tag"><span class="dot"></span>Fiche en cours de constitution</div>'+
        '<div class="fch-ec-title">' + n + ' produit' + (n > 1 ? 's' : '') + ' en attente</div>'+
        '<div class="fch-ec-sub">Produits ajoutés depuis le catalogue et les opportunités pharmacie. Finalise-les en une fiche.</div>'+
        '<div class="fch-ec-chips">' + chips + more + '</div>'+
        '<div class="fch-ec-acts">'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.openCart()">' + ICO('chev', 16, 2) + 'Finaliser cette fiche</button>'+
          '<button class="v2-btn v2-btn-ghost" onclick="V2.fiches.clearCart()">Vider</button>'+
        '</div>'+
      '</div>';
  }

  function renderList(root) {
    var fiches = getFiches();
    var head = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    var encours = encoursCardHtml();

    var body;
    if (!fiches.length && !encours) {
      body = ''+
        '<div class="v2-empty">'+
          '<div class="v2-empty-ico">' + ICO('fiche', 64, 1.4) + '</div>'+
          '<div class="v2-empty-t">Aucune fiche pour le moment</div>'+
          '<div class="v2-empty-d">Crée une fiche produit sur-mesure à montrer ou envoyer au pharmacien, puis sors-la en PDF propre.</div>'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.open(\'new\')">' + ICO('plus', 17, 2) + 'Créer ma première fiche</button>'+
        '</div>';
    } else if (!fiches.length) {
      body = '';
    } else {
      var cards = fiches.map(function (f) {
        var prods = f.products || [];
        var title = f.title && f.title.trim() ? f.title : 'Fiche sans titre';
        var dest = f.destId ? pharmaById(f.destId) : null;
        var totNet = prods.reduce(function (s, p) { return s + netPrice(p); }, 0);
        var totMdl = prods.reduce(function (s, p) { return s + margeMDL(netPrice(p)); }, 0);
        return ''+
          '<div class="fch-card">'+
            '<div class="fch-card-t">' + esc(title) + '</div>'+
            (dest
              ? '<div class="fch-card-dest">' + ICO('pharma', 13, 2) + esc(dest.name) + '</div>'
              : '<div class="fch-card-dest none">Sans destinataire</div>') +
            '<div class="fch-card-m">'+
              '<span>' + prods.length + ' produit' + (prods.length > 1 ? 's' : '') + '</span>'+
              '<span class="sep"></span><span>' + fmtDate(f.created) + '</span>'+
            '</div>'+
            '<div class="fch-card-foot">'+
              '<div class="fch-kpi"><div class="l">Total prix net</div><div class="v">' + V2.fmtEur(totNet) + '</div></div>'+
              '<div class="fch-kpi"><div class="l">Marge MDL</div><div class="v" style="color:var(--c-opp)">' + V2.fmtEur(totMdl) + '</div></div>'+
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
            '<div class="v2-page-sub" style="margin-bottom:0">Tes listes de produits sur-mesure à présenter en rendez-vous</div>'+
          '</div>'+
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.open(\'new\')">' + ICO('plus', 17, 2) + 'Nouvelle fiche</button>'+
        '</div>' +
        encours +
        body +
      '</div>';
  }

  // ════════════════════════════════════════════
  // VUE ÉDITION
  // ════════════════════════════════════════════
  function renderEdit(root, param) {
    if (param === 'new') {
      if (!editingFiche) editingFiche = createFiche();
    } else if (param === 'cart') {
      if (!editingFiche || !editingFiche._fromCart) {
        var cart = readCart();
        editingFiche = createFiche();
        editingFiche._fromCart = true;
        editingFiche.products = cart.products.map(function (p) { return Object.assign({}, p); });
      }
    } else {
      var existing = getFiche(param);
      if (!existing) { V2.toast('Fiche introuvable', 'error'); V2.go('fiches'); return; }
      if (!editingFiche || editingFiche.id !== existing.id) {
        editingFiche = { id: existing.id, title: existing.title, destId: existing.destId || null, created: existing.created,
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
        // Destinataire
        '<div class="fch-dest">'+
          '<div class="fch-dest-ic">' + ICO('pharma', 20, 1.8) + '</div>'+
          '<div><div class="fch-dest-l">Destinataire</div>' + destValHtml() + '</div>'+
          '<button class="fch-dest-change" onclick="V2.fiches.openDest()">' + (editingFiche.destId ? 'Changer' : 'Choisir une pharmacie') + '</button>'+
        '</div>'+
        // Produits
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
          '<button class="v2-btn v2-btn-primary" onclick="V2.fiches.downloadPdf()">' + ICO('download', 17, 2) + 'Télécharger le PDF</button>'+
        '</div>'+
        // Totaux
        totalsHtml() +
      '</div>' +
      selectorMarkup() + destMarkup();

    wireSelector();
    wireDest();
  }

  function destValHtml() {
    var d = editingFiche && editingFiche.destId ? pharmaById(editingFiche.destId) : null;
    return d
      ? '<div class="fch-dest-v" id="fch-dest-v">' + esc(pharmaLabel(d)) + '</div>'
      : '<div class="fch-dest-v none" id="fch-dest-v">Aucune pharmacie</div>';
  }
  function totalsHtml() {
    var ps = editingFiche.products;
    var net = ps.reduce(function (s, p) { return s + netPrice(p); }, 0);
    var mdl = ps.reduce(function (s, p) { return s + margeMDL(netPrice(p)); }, 0);
    return ''+
      '<div class="fch-totals" id="fch-totals">'+
        '<div class="fch-tot"><div class="fch-tot-l">Produits</div><div class="fch-tot-v" id="fch-tot-n">' + ps.length + '</div></div>'+
        '<div class="fch-tot-sep"></div>'+
        '<div class="fch-tot"><div class="fch-tot-l">Total prix net IP <span style="opacity:.6">(1 boîte / réf.)</span></div><div class="fch-tot-v blue" id="fch-tot-net">' + V2.fmtEur(net) + '</div></div>'+
        '<div class="fch-tot-sep"></div>'+
        '<div class="fch-tot"><div class="fch-tot-l">Marge MDL totale</div><div class="fch-tot-v green" id="fch-tot-mdl">' + V2.fmtEur(mdl) + '</div></div>'+
      '</div>';
  }

  // re-render léger de la liste produits + totaux (préserve le champ titre)
  function refreshProducts() {
    var box = document.getElementById('fch-prodlist');
    var cnt = document.getElementById('fch-count');
    if (!box) { V2.render(); return; }
    var ps = editingFiche.products, n = ps.length;
    box.innerHTML = n ? ps.map(productRow).join('') : emptyProducts();
    if (cnt) cnt.textContent = n + ' produit' + (n > 1 ? 's' : '');
    recalcTotals();
  }

  // recalcule la barre de totaux (sans toucher aux lignes)
  function recalcTotals() {
    var ps = editingFiche.products, n = ps.length;
    var net = ps.reduce(function (s, p) { return s + netPrice(p); }, 0);
    var mdl = ps.reduce(function (s, p) { return s + margeMDL(netPrice(p)); }, 0);
    var en = document.getElementById('fch-tot-n'); if (en) en.textContent = n;
    var enet = document.getElementById('fch-tot-net'); if (enet) enet.textContent = V2.fmtEur(net);
    var emdl = document.getElementById('fch-tot-mdl'); if (emdl) emdl.textContent = V2.fmtEur(mdl);
  }

  // maj ciblée d'une ligne pendant la frappe (préserve le focus du champ)
  function recalcRow(i) {
    var p = editingFiche.products[i]; if (!p) return;
    var net = netPrice(p), mdl = margeMDL(net);
    var em = document.getElementById('fch-mdl-' + i); if (em) em.textContent = V2.fmtEur(mdl);
    var en = document.getElementById('fch-net-' + i); if (en) en.textContent = V2.fmtEur(net);
    recalcTotals();
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
    if (!B || !B.length) { V2.toast('Chargement du catalogue…'); V2.loadFiles(['bench']).then(function () { openSelector(); }); return; }
    var bd = document.getElementById('fch-sel'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('fch-sel-input');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
    renderSelectorList();
  }
  function closeSelector() { var bd = document.getElementById('fch-sel'); if (bd) bd.classList.remove('open'); }

  function addProductByCip(cip) {
    var B = window.BENCHMARK || [];
    var b = null;
    for (var i = 0; i < B.length; i++) { if (String(B[i].cip13) === String(cip)) { b = B[i]; break; } }
    if (!b) return;
    if (editingFiche.products.some(function (p) { return String(p.cip13) === String(cip); })) return;
    editingFiche.products.push({
      cip13: b.cip13, designation: b.designation,
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
  // SÉLECTEUR DESTINATAIRE (overlay pharmacies)
  // ════════════════════════════════════════════
  function destMarkup() {
    return ''+
      '<div id="fch-dest-bd" class="fch-sel-bd">'+
        '<div class="fch-sel" onclick="event.stopPropagation()">'+
          '<div class="fch-sel-search">' + ICO('search', 21, 2) +
            '<input id="fch-dest-input" placeholder="Rechercher une officine…" autocomplete="off">'+
            '<button class="fch-rmbtn" onclick="V2.fiches.closeDest()" title="Fermer">' + ICO('close', 16, 2) + '</button>'+
          '</div>'+
          '<div id="fch-dest-list" class="fch-sel-list"></div>'+
        '</div>'+
      '</div>';
  }
  function renderDestList() {
    var box = document.getElementById('fch-dest-list'); if (!box) return;
    var inp = document.getElementById('fch-dest-input');
    var q = (inp ? inp.value : '').trim().toLowerCase();
    var list = (V2.pharmacies || []).filter(function (p) {
      if (!q) return true;
      return (p.name || '').toLowerCase().indexOf(q) >= 0 || String(p.ville || '').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 60);
    if (!list.length) { box.innerHTML = '<div class="fch-sel-empty">Aucune officine trouvée</div>'; return; }
    // option "aucun destinataire"
    var none = '<div class="fch-sel-item" data-id="">'+
      '<span class="ic" style="color:var(--muted)">' + ICO('close', 16, 2) + '</span>'+
      '<span class="nm"><b>Aucun destinataire</b><span>fiche générique</span></span></div>';
    box.innerHTML = none + list.map(function (p) {
      var color = p.color || 'var(--ip-blue)';
      return '<div class="fch-sel-item" data-id="' + esc(String(p.id)) + '">'+
        '<span class="ic" style="background:' + esc(color) + ';color:#fff">' + ICO('pharma', 17, 2) + '</span>'+
        '<span class="nm"><b>' + esc(p.name) + '</b><span>' + esc(p.code || p.ville || '') + '</span></span></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.fch-sel-item'), function (el) {
      el.onclick = function () { pickDest(el.getAttribute('data-id')); };
    });
  }
  function wireDest() {
    var bd = document.getElementById('fch-dest-bd'); if (!bd) return;
    bd.onclick = function () { closeDest(); };
    var inp = document.getElementById('fch-dest-input');
    if (inp) {
      inp.addEventListener('input', renderDestList);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDest(); });
    }
  }
  function openDest() {
    if (!V2.pharmacies || !V2.pharmacies.length) { V2.toast('Aucune pharmacie chargée', 'warn'); return; }
    var bd = document.getElementById('fch-dest-bd'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('fch-dest-input');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
    renderDestList();
  }
  function closeDest() { var bd = document.getElementById('fch-dest-bd'); if (bd) bd.classList.remove('open'); }
  function pickDest(id) {
    editingFiche.destId = id ? id : null;
    // maj sans full-render : on remplace le bloc valeur + le libellé du bouton
    var v = document.getElementById('fch-dest-v');
    var d = editingFiche.destId ? pharmaById(editingFiche.destId) : null;
    if (v) {
      if (d) { v.textContent = pharmaLabel(d); v.classList.remove('none'); }
      else { v.textContent = 'Aucune pharmacie'; v.classList.add('none'); }
    }
    var btn = document.querySelector('.fch-dest-change');
    if (btn) btn.textContent = editingFiche.destId ? 'Changer' : 'Choisir une pharmacie';
    closeDest();
  }

  // ════════════════════════════════════════════
  // PDF
  // ════════════════════════════════════════════
  function buildPdfNode(fiche) {
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var title = fiche.title && fiche.title.trim() ? fiche.title : 'Fiche commerciale';
    var prods = fiche.products || [];
    var count = prods.length;
    var dest = fiche.destId ? pharmaById(fiche.destId) : null;
    var totNet = prods.reduce(function (s, p) { return s + netPrice(p); }, 0);
    var totMdl = prods.reduce(function (s, p) { return s + margeMDL(netPrice(p)); }, 0);

    function e2(v) { return num(v).toFixed(2).replace('.', ',') + ' €'; }
    var rows = prods.map(function (p, i) {
      var net = netPrice(p), mdl = margeMDL(net);
      var prix = (p.prix_ip != null && p.prix_ip !== '') ? e2(p.prix_ip) : '—';
      var rem = (p.remise_pct != null && p.remise_pct !== '' && +p.remise_pct > 0) ? String(p.remise_pct).replace('.', ',') + ' %' : '—';
      return ''+
        '<tr style="border-bottom:1px solid #ECEFF5">'+
          '<td style="padding:9px 12px;font-size:10px;color:#9AA1B2;font-family:monospace;text-align:center;width:28px">' + (i + 1) + '</td>'+
          '<td style="padding:9px 12px;font-size:12px;font-weight:600;color:#10131C">' + esc(p.designation) +
            (p.is_froid ? ' <span style="font-size:8px;color:#00B5D8;border:1px solid #b8edf7;border-radius:5px;padding:1px 4px;vertical-align:middle">FROID</span>' : '') + '</td>'+
          '<td style="padding:9px 12px;font-size:11px;color:#737A8C;font-family:monospace">' + esc(p.cip13 || '—') + '</td>'+
          '<td style="padding:9px 12px;font-size:12px;font-weight:700;color:#10131C;text-align:right;font-family:monospace">' + prix + '</td>'+
          '<td style="padding:9px 12px;font-size:12px;color:#737A8C;text-align:right;font-family:monospace">' + rem + '</td>'+
          '<td style="padding:9px 12px;font-size:12px;font-weight:700;color:#0050E6;text-align:right;font-family:monospace">' + e2(net) + '</td>'+
          '<td style="padding:9px 12px;font-size:12px;font-weight:700;color:#1E9E6A;text-align:right;font-family:monospace">' + e2(mdl) + '</td>'+
        '</tr>';
    }).join('');

    var html = ''+
      '<div style="font-family:Satoshi,Inter,Arial,sans-serif;color:#10131C;width:794px;box-sizing:border-box;padding:42px 44px;background:#fff">'+
        '<div style="display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:2px solid #10131C">'+
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
          (dest ? '<div style="text-align:right"><div style="font-size:8.5px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Destinataire</div>'+
            '<div style="font-size:13px;font-weight:800;color:#10131C">' + esc(dest.name) + '</div>'+
            (dest.ville ? '<div style="font-size:10px;color:#737A8C">' + esc(dest.ville) + '</div>' : '') + '</div>' : '') +
        '</div>'+
        '<h1 style="font-size:23px;font-weight:800;letter-spacing:-.03em;margin:16px 0 4px">' + esc(title) + '</h1>'+
        '<div style="font-size:12px;color:#737A8C;margin-bottom:20px">' + count + ' produit' + (count > 1 ? 's' : '') + ' sélectionné' + (count > 1 ? 's' : '') + '</div>'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr style="background:#F7F9FC;border-bottom:1.5px solid #E2E7F0">'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:center">#</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:left">Désignation</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:left">CIP 13</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Prix IP</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Remise</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Prix net</th>'+
            '<th style="padding:8px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9AA1B2;text-align:right">Marge MDL</th>'+
          '</tr></thead>'+
          '<tbody>' + (rows || '<tr><td colspan="7" style="padding:24px;text-align:center;color:#9AA1B2;font-size:12px">Aucun produit</td></tr>') + '</tbody>'+
          (count ? '<tfoot><tr style="border-top:2px solid #E2E7F0;background:#FAFBFE">'+
            '<td colspan="5" style="padding:11px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#10131C;text-align:right">Totaux (base 1 boîte / réf.)</td>'+
            '<td style="padding:11px 12px;font-size:13px;font-weight:800;color:#0050E6;text-align:right;font-family:monospace">' + e2(totNet) + '</td>'+
            '<td style="padding:11px 12px;font-size:13px;font-weight:800;color:#1E9E6A;text-align:right;font-family:monospace">' + e2(totMdl) + '</td>'+
          '</tr></tfoot>' : '') +
        '</table>'+
        '<div style="margin-top:34px;padding-top:14px;border-top:1px solid #ECEFF5;display:flex;justify-content:space-between;font-size:9px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">'+
          '<span>Intégral Pharma · Document commercial · Prix indicatifs HT</span>'+
          '<span>Marge MDL : 0,18€ &lt;4,33€ · 3,9% &lt;468€ · 19,50€ au-delà</span>'+
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
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      var node = buildPdfNode(fiche);
      document.body.appendChild(node);
      var fname = 'Fiche-' + fileSafe(fiche.title) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().set({
        margin: 0, filename: fname,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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
    openCart: function () { editingFiche = null; V2.go('fiches', 'cart'); },
    clearCart: function () {
      if (!V2.ficheCart.count()) return;
      if (confirm('Vider la sélection en cours ?')) { V2.ficheCart.clear(); V2.toast('Sélection vidée'); V2.render(); }
    },
    remove: function (id) {
      var f = getFiche(id);
      var label = f && f.title && f.title.trim() ? '« ' + f.title + ' »' : 'cette fiche';
      if (confirm('Supprimer ' + label + ' ?')) { deleteFiche(id); V2.toast('Fiche supprimée'); V2.render(); }
    },
    setTitle: function (v) { if (editingFiche) editingFiche.title = v; },
    setPrice: function (i, v) { if (editingFiche && editingFiche.products[i]) { editingFiche.products[i].prix_ip = v === '' ? null : num(v); recalcRow(i); } },
    setRemise: function (i, v) { if (editingFiche && editingFiche.products[i]) { editingFiche.products[i].remise_pct = v === '' ? null : num(v); recalcRow(i); } },
    removeProduct: function (i) { if (editingFiche) { editingFiche.products.splice(i, 1); refreshProducts(); } },
    openSelector: openSelector,
    closeSelector: closeSelector,
    openDest: openDest,
    closeDest: closeDest,
    save: function () {
      if (!editingFiche) return;
      if (!editingFiche.title || !editingFiche.title.trim()) { editingFiche.title = 'Fiche du ' + fmtDate(Date.now()); }
      var fromCart = !!editingFiche._fromCart;
      var clean = { id: editingFiche.id, title: editingFiche.title, destId: editingFiche.destId || null,
                    created: editingFiche.created, products: editingFiche.products.map(function (p) { return Object.assign({}, p); }) };
      saveFiche(clean);
      if (fromCart) { V2.ficheCart.clear(); editingFiche._fromCart = false; }
      editingFiche.id = clean.id;
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
