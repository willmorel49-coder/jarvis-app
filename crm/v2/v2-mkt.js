/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Marketing" (pages.marketing) — app JARVIS / Intégral
   Espace de travail Pauline + Will : fabriquer des SUPPORTS (flyers
   produits avec photos/prix/accroche) et des SÉLECTIONS À POUSSER
   (listes de produits du moment) — PARTAGÉ via Supabase (table
   marketing_items) avec repli localStorage si la table n'existe pas.
   Produits = meilleures ventes Offilog (photos). Aperçu + PDF.
   (NB : distinct du pilier OPSO v2-marketing.js, chargé seulement en opso/v2/)
   ── Satoshi · mode clair · zéro emoji (ICO) ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var LS = 'v2_marketing';
  var TYPES = {
    support:   { label: 'Support', plural: 'Supports', accent: '#E0556E', sub: 'flyer produits à présenter' },
    selection: { label: 'Sélection', plural: 'Sélections à pousser', accent: '#1E9E6A', sub: 'liste de produits du moment' }
  };
  var STATUSES = [
    { k: 'brouillon', label: 'Brouillon', color: '#9AA1B2' },
    { k: 'a_envoyer', label: 'À envoyer', color: '#C7791A' },
    { k: 'envoye',    label: 'Envoyé',    color: '#1E9E6A' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Charte / personnalisation ──
  var ACCENTS = ['#0050E6', '#0034A0', '#E0556E', '#6D4FC4', '#1E9E6A', '#C7791A', '#00B5D8', '#10131C'];
  var BGS = ['#FFFFFF', '#FFFDF7', '#F2F7FF', '#F4F6FB', '#FBF5F7', '#F3FAF6'];
  function defaultTheme(type) {
    return { accent: type === 'selection' ? '#1E9E6A' : '#0050E6', bg: '#FFFFFF', showPrice: true, showRemise: true, showImg: true };
  }
  function darken(hex, f) {
    hex = String(hex || '#0050E6').replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    var n = parseInt(hex, 16); if (isNaN(n)) return '#0034A0';
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var items = null;          // null = pas encore chargé
  var backend = 'local';     // 'supabase' | 'local'
  var editing = null;
  var pickSrc = 'mix';       // source : 'mix' (sélection grossiste) | 'gros' (catalogue méd.) | 'offilog'
  var catSrc = 'nr';   // section Catalogues grossiste : 'integral' | 'itp' | 'best'
  var catSel = [];     // panier : produits cochés (+) dans le catalogue grossiste
  var catRows = [];     // index plat des lignes affichées (pour les boutons +)
  // ── Documents PDF partagés (Supabase Storage, visibles par TOUS les comptes) ──
  var BUCKET = 'marketing-pdfs';
  var docs = null;       // null = pas chargé · [] = chargé
  var docsErr = null;    // message d'erreur (ex : bucket pas encore créé)
  var docsBusy = false;  // upload en cours

  // ════════════════════════════════════════════
  // STORE (Supabase partagé + repli local)
  // ════════════════════════════════════════════
  function sb() { return (V2.sb && V2.sb()) || null; }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  function fromRow(r) {
    return { id: r.id, type: r.type || 'support', title: r.title || '', accroche: r.accroche || '', footer: r.footer || '',
             status: r.status || 'brouillon', products: r.products || [], theme: r.theme || null, owner: r.owner || '',
             updated: r.updated_at ? new Date(r.updated_at).getTime() : Date.now() };
  }
  function toRow(it) {
    return { id: it.id, type: it.type, title: it.title, accroche: it.accroche, footer: it.footer || '', status: it.status,
             products: it.products, theme: it.theme || null, owner: it.owner || (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }
  function loadItems() {
    var c = sb();
    if (c) {
      return c.from('marketing_items').select('*').order('updated_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; items = r.data.map(fromRow); return items; }
          backend = 'local'; items = localAll(); return items;
        }).catch(function () { backend = 'local'; items = localAll(); return items; });
    }
    backend = 'local'; items = localAll();
    return Promise.resolve(items);
  }
  function saveLocal(it) {
    var a = localAll(), i = -1;
    for (var k = 0; k < a.length; k++) if (a[k].id === it.id) { i = k; break; }
    if (i >= 0) a[i] = it; else a.unshift(it);
    localWrite(a); items = a;
  }
  function saveItem(it) {
    it.updated = Date.now();
    if (!it.owner) it.owner = (V2.user && V2.user.email) || '';
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('marketing_items').upsert(toRow(it)).then(function (r) {
        if (r.error) saveLocal(it);
        return loadItems();
      }).catch(function () { saveLocal(it); return Promise.resolve(items); });
    }
    saveLocal(it); return Promise.resolve(items);
  }
  function removeItem(id) {
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('marketing_items').delete().eq('id', id).then(function () { return loadItems(); })
        .catch(function () { localWrite(localAll().filter(function (x) { return x.id !== id; })); return loadItems(); });
    }
    localWrite(localAll().filter(function (x) { return x.id !== id; }));
    items = localAll(); return Promise.resolve(items);
  }
  function newId() { return 'm' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }

  // ── Store Documents PDF (Supabase Storage) ──
  function prettyName(n) { var i = String(n || '').indexOf('__'); return i >= 0 ? n.slice(i + 2) : n; }
  function fmtSize(b) { b = +b || 0; if (b < 1024) return b + ' o'; if (b < 1048576) return Math.round(b / 1024) + ' Ko'; return (b / 1048576).toFixed(1) + ' Mo'; }
  function sanitize(n) { return String(n || 'document.pdf').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'document.pdf'; }
  function loadDocs() {
    var c = sb();
    if (!c || !c.storage) { docs = []; docsErr = 'no-sb'; return Promise.resolve(); }
    return c.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
      .then(function (r) {
        if (r.error) { docs = []; docsErr = r.error.message || 'err'; return; }
        docsErr = null;
        docs = (r.data || []).filter(function (f) { return f.name && f.name !== '.emptyFolderPlaceholder'; }).map(function (f) {
          var meta = f.metadata || {};
          return { name: f.name, size: meta.size || 0, created: f.created_at || f.updated_at || null,
                   url: c.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl };
        });
      }).catch(function (e) { docs = []; docsErr = (e && e.message) || 'err'; });
  }

  // ════════════════════════════════════════════
  // DONNÉES PRODUITS (Offilog best-sellers + images)
  // ════════════════════════════════════════════
  var bestLoading = false, imgLoading = false;
  function ensureBest(cb) {
    if (window.OFFILOG_BEST) { cb(); return; }
    if (bestLoading) { setTimeout(function () { ensureBest(cb); }, 250); return; }
    bestLoading = true;
    var s = document.createElement('script'); s.src = 'offilog-bestsellers-data.js?v=20260610v2m';
    s.onload = function () { bestLoading = false; cb(); }; s.onerror = function () { bestLoading = false; cb(); };
    document.head.appendChild(s);
  }
  function ensureImg(cb) {
    if (window.OFFILOG_IMG) { cb(); return; }
    if (imgLoading) { setTimeout(function () { ensureImg(cb); }, 250); return; }
    imgLoading = true;
    var s = document.createElement('script'); s.src = 'offilog-img-data.js?v=20260611a';
    s.onload = function () { imgLoading = false; cb(); }; s.onerror = function () { imgLoading = false; cb(); };
    document.head.appendChild(s);
  }
  function ensureBench(cb) {
    if (window.BENCHMARK) { cb(); return; }
    if (V2.loadFiles) { V2.loadFiles(['bench']).then(cb); } else cb();
  }
  // Proxy CORS pour le rendu PDF/canvas (les CDN n'envoient pas d'en-tête CORS).
  // Les images locales (pimg/) et data: passent direct (même origine = PDF-safe).
  function proxify(u) {
    if (!u) return '';
    if (!/^https?:\/\//.test(u)) return u;                 // relatif (pimg/) ou data:
    if (u.indexOf('images.weserv.nl') !== -1) return u;
    return 'https://images.weserv.nl/?url=ssl:' + u.replace(/^https?:\/\//, '') + '&w=240&output=jpg';
  }
  function prodImg(p, forPdf) {
    if (forPdf && window.OFFILOG_IMG && p.id && window.OFFILOG_IMG[p.id]) return proxify(window.OFFILOG_IMG[p.id]);
    return proxify(p.img || '');
  }
  function refPriceB(b) { var bp = V2.bestPrice(b); return (bp.ip != null) ? bp.ip : ((b.prix_ht != null && b.prix_ht > 0) ? b.prix_ht : 0); }
  function remiseB(b) { return V2.bestPrice(b).remise; }

  // ════════════════════════════════════════════
  // VUE LISTE
  // ════════════════════════════════════════════
  function badge(type) {
    var t = TYPES[type] || TYPES.support;
    return '<span class="mkt-typebadge" style="--bc:' + t.accent + '">' + esc(t.label) + '</span>';
  }
  function card(it) {
    var n = (it.products || []).length;
    var st = statusOf(it.status);
    var thumbs = (it.products || []).slice(0, 4).map(function (p) {
      return p.img ? '<span class="mkt-th" style="background-image:url(' + esc(p.img) + ')"></span>' : '<span class="mkt-th mkt-th-x"></span>';
    }).join('');
    return '<div class="mkt-card" onclick="V2.mkt.open(\'' + esc(it.id) + '\')">' +
      '<div class="mkt-card-top">' + badge(it.type) +
        '<span class="mkt-status" style="--sc:' + st.color + '">' + esc(st.label) + '</span></div>' +
      '<div class="mkt-card-t">' + (it.title ? esc(it.title) : '<span style="color:var(--muted-2)">Sans titre</span>') + '</div>' +
      '<div class="mkt-thumbs">' + (thumbs || '<span class="mkt-th mkt-th-x"></span>') + (n > 4 ? '<span class="mkt-more">+' + (n - 4) + '</span>' : '') + '</div>' +
      '<div class="mkt-card-m">' + n + ' produit' + (n > 1 ? 's' : '') + (it.owner ? ' · ' + esc((it.owner || '').split('@')[0]) : '') + '</div>' +
    '</div>';
  }
  function section(type, list) {
    var t = TYPES[type];
    var cards = list.length ? list.map(card).join('')
      : '<div class="mkt-empty">Aucun ' + esc(t.label.toLowerCase()) + ' pour le moment.</div>';
    return '<div class="mkt-section">' +
      '<div class="mkt-sec-head">' +
        '<div><div class="mkt-sec-t">' + esc(t.plural) + '</div><div class="mkt-sec-s">' + esc(t.sub) + '</div></div>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.create(\'' + type + '\')">' + ICO('plus', 16, 2) + 'Nouveau</button>' +
      '</div>' +
      '<div class="mkt-grid">' + cards + '</div>' +
    '</div>';
  }
  // ── Sélection grossiste (mix L'Intégral + ITP + meilleures ventes) ──
  // Classé par NB DE PHARMACIES qui commandent (sortie réseau) — données bakées.
  var _mixFlat = null;
  function mixFlat() {
    if (_mixFlat) return _mixFlat;
    var M = window.MKT_MIX || {}, out = [], id = 0, seen = {};
    function push(group, cat, r) {
      // dédoublonnage : par CIP sinon par nom normalisé (1ère source = NR prioritaire)
      var nk = String(r.cip || '') || (r.d || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (nk && seen[nk]) return;
      if (nk) seen[nk] = 1;
      out.push({ id: id++, group: group, cat: cat, name: r.d, cip: r.cip || '', price: r.p || 0,
        remise: r.remise || 0, sortie: r.sortie || 0, vol: r.vol || 0, total: r.total || (M.total || 0),
        ppht: r.ppht || 0, marge: r.marge || 0 });
    }
    // tri par VOLUME vendu (puis sortie)
    (M.nr || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('nr', c.cat, r); }); });
    (M.rotations || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('rota', c.cat, r); }); });
    (M.bestsellers || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('best', c.cat, r); }); });
    (M.integral || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('integral', c.cat, r); }); });
    (M.itp || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('itp', c.cat, r); }); });
    out.sort(function (a, b) { return (b.vol - a.vol) || (b.sortie - a.sortie); });   // volume vendu puis nb pharmacies
    _mixFlat = out; return out;
  }

  function renderList(root) {
    var supports = (items || []).filter(function (x) { return x.type !== 'selection'; });
    var selections = (items || []).filter(function (x) { return x.type === 'selection'; });
    var shareNote = backend === 'supabase'
      ? '<span class="mkt-share ok">' + ICO('check', 14, 2) + ' Partagé en équipe</span>'
      : '<span class="mkt-share local">' + ICO('alert', 14, 2) + ' Local — partage à activer</span>';

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:6px">' +
          '<div><div class="v2-page-title">Marketing</div>' +
          '<div class="v2-page-sub" style="margin-bottom:0">L\'espace de Pauline &amp; Will — supports et sélections produits</div></div>' +
          shareNote +
        '</div>' +
        '<a class="mkt-cat-banner" onclick="V2.go(\'marketing\',\'catalogues\')">' +
          '<span class="mkt-cat-ic">' + ICO('cat', 22) + '</span>' +
          '<span style="flex:1;min-width:0"><span class="mkt-cat-t">Catalogues grossiste — L\'Intégral &amp; ITP</span>' +
          '<span class="mkt-cat-s">Ta parapharma L\'Intégral par spécialité + les pansements/DM ITP (avec marge), classés par sorties. Consulter &amp; télécharger.</span></span>' +
          '<span class="v2-row-chev">' + ICO('chev', 18) + '</span>' +
        '</a>' +
        '<a class="mkt-cat-banner" onclick="V2.go(\'marketing\',\'site\')">' +
          '<span class="mkt-cat-ic">' + ICO('cat', 22) + '</span>' +
          '<span style="flex:1;min-width:0"><span class="mkt-cat-t">Site vitrine Intégral Pharma</span>' +
          '<span class="mkt-cat-s">Aperçu du nouveau site internet — vidéos, réseau national, Offilog. Cliquer pour ouvrir.</span></span>' +
          '<span class="v2-row-chev">' + ICO('chev', 18) + '</span>' +
        '</a>' +
        '<a class="mkt-cat-banner" onclick="V2.go(\'marketing\',\'docs\')">' +
          '<span class="mkt-cat-ic">' + ICO('cat', 22) + '</span>' +
          '<span style="flex:1;min-width:0"><span class="mkt-cat-t">Documents partagés (PDF)</span>' +
          '<span class="mkt-cat-s">Catalogues, fiches, offres en PDF — ajoute-les ici, ils restent visibles par tous les comptes. Ouvrir &amp; supprimer.</span></span>' +
          '<span class="v2-row-chev">' + ICO('chev', 18) + '</span>' +
        '</a>' +
        section('support', supports) +
        section('selection', selections) +
        (backend === 'local'
          ? '<div class="mkt-setup">' + ICO('alert', 16, 2) + '<div><b>Activer le partage entre vous</b><br>' +
            'Pour l\'instant les supports sont enregistrés sur cet appareil. Pour que Pauline et toi voyiez les mêmes, il faut créer une table dans Supabase (une seule fois). Demande-moi le script SQL, il est prêt.</div></div>'
          : '') +
      '</div>';
  }

  // ════════════════════════════════════════════
  // SITE VITRINE INTÉGRAL PHARMA (aperçu en iframe)
  // ════════════════════════════════════════════
  function renderSite(root) {
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div style="width:100%;height:calc(100vh - 66px);min-height:520px;background:#fff">' +
        '<iframe src="../../site-integral/index-typo.html?v=20260629c" title="Site vitrine Intégral Pharma" loading="lazy" style="width:100%;height:100%;border:0;display:block"></iframe>' +
      '</div>';
  }

  // ════════════════════════════════════════════
  // CATALOGUES GROSSISTE (L'Intégral + ITP + Top ventes)
  // ════════════════════════════════════════════
  function catImg(cip) {
    var M = window.MKT_IMG; if (!M || !cip) return '';
    return M[String(cip)] || '';
  }
  function updateCatBar() {
    var bar = document.getElementById('mkt-catbar'); if (!bar) return;
    var n = catSel.length;
    var lbl = document.getElementById('mkt-catbar-n');
    if (lbl) lbl.textContent = n + ' produit' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '');
    bar.classList.toggle('on', n > 0);
  }
  function renderCatalogues(root) {
    var M = window.MKT_MIX || {}, total = M.total || 0;
    var srcs = [
      { k: 'nr', label: 'Catalogue NR', data: M.nr || [], pdf: null },
      { k: 'integral', label: 'L\'Intégral', data: M.integral || [], pdf: 'catalogue-integral.pdf' },
      { k: 'itp', label: 'ITP', data: M.itp || [], pdf: 'catalogue-itp.pdf' },
      { k: 'best', label: 'Top ventes (familles)', data: M.bestsellers || [], pdf: null },
    ];
    var cur = srcs.filter(function (s) { return s.k === catSrc; })[0] || srcs[0];
    var tabs = srcs.map(function (s) { return '<button class="mkt-srcbtn' + (s.k === catSrc ? ' on' : '') + '" onclick="V2.mkt.catSrc(\'' + s.k + '\')">' + esc(s.label) + '</button>'; }).join('');
    var offre = ' <span style="font-size:8.5px;font-weight:800;color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 14%,#fff);padding:1px 5px;border-radius:5px;text-transform:uppercase">offre</span>';
    catRows = [];
    var cats = cur.data.map(function (c) {
      var trs = (c.rows || []).map(function (r, i) {
        var price = (r.p > 0) ? V2.fmtEur(r.p) : '—';
        var midCol = (cur.k === 'itp')
          ? '<td class="num" style="color:var(--c-mint);font-weight:700">' + (r.marge ? V2.fmtEur(r.marge) : '—') + '</td>'
          : '<td class="num" style="font-weight:700">' + (r.sortie > 0 ? r.sortie + '<span style="color:var(--muted-2);font-weight:500">/' + total + '</span>' : '—') + '</td>';
        var volCol = '<td class="num" style="font-weight:800;color:var(--ip-ink)">' + (r.vol > 0 ? V2.fmtNum(r.vol) : '—') + '</td>';
        var fi = catRows.length;
        var pic = catImg(r.cip);
        catRows.push({ d: r.d, cip: r.cip, p: r.p, froid: false, cat: c.cat, img: pic });
        var selKey = String(r.cip || r.d);
        var added = catSel.some(function (x) { return x.key === selKey; });
        var addBtn = '<td style="width:36px;text-align:center"><button class="mkt-catadd' + (added ? ' on' : '') + '" id="mkt-ca-' + fi + '" title="' + (added ? 'Retirer de ma sélection' : 'Ajouter à une fiche') + '" onclick="V2.mkt.catAdd(' + fi + ')">' + ICO(added ? 'check' : 'plus', 15, 2.4) + '</button></td>';
        var thumb = pic
          ? '<td style="width:46px"><span class="mkt-cat-thumb" style="background-image:url(' + esc(pic) + ')"></span></td>'
          : '<td style="width:46px"><span class="mkt-cat-thumb mkt-cat-thumb-ph">' + ICO('pill', 18, 1.5) + '</span></td>';
        return '<tr>' +
          '<td class="num" style="color:var(--muted-2);width:28px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
          thumb +
          '<td><span class="mkt-cat-prod">' + esc(r.d) + '</span>' + (r.o ? offre : '') + '</td>' +
          '<td class="mono" style="color:var(--muted);font-size:12px">' + esc(r.cip || '—') + '</td>' +
          '<td class="num" style="color:var(--ip-blue);font-weight:700">' + price + '</td>' + midCol + volCol + addBtn +
        '</tr>';
      }).join('');
      var midTh = (cur.k === 'itp') ? 'Marge/bte' : 'Sorties';
      return '<div class="v2-card" style="margin-bottom:14px;padding:16px 18px">' +
        '<div class="v2-card-t" style="margin-bottom:10px">' + esc(c.cat) + ' <span style="color:var(--muted);font-weight:500">· ' + (c.rows || []).length + '</span></div>' +
        '<div style="overflow-x:auto"><table class="v2-table"><thead><tr><th class="num">#</th><th></th><th>Produit</th><th>CIP</th><th class="num">Prix net</th><th class="num">' + midTh + '</th><th class="num">Volume vendu</th><th></th></tr></thead><tbody>' + trs + '</tbody></table></div>' +
      '</div>';
    }).join('');
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<button class="v2-back" style="margin-bottom:16px" onclick="V2.go(\'marketing\')">' + ICO('back', 16) + 'Marketing</button>' +
        '<div class="v2-page-title">Catalogues grossiste</div>' +
        '<div class="v2-page-sub">L\'Intégral (parapharma) &amp; ITP (pansements/DM) — ce qu\'on fait en tant que grossiste, classé par nombre de pharmacies qui commandent. Coche les <b>+</b> pour bâtir une fiche.</div>' +
        '<div class="mkt-pick-src" style="margin:16px 0 14px">' + tabs + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.catPdf(\'' + cur.k + '\')">' + ICO('download', 16) + 'Générer le doc marketing (PDF)</button>' +
          (cur.pdf ? '<a class="v2-btn v2-btn-ghost" href="' + cur.pdf + '" download>' + ICO('download', 16) + 'Catalogue ' + esc(cur.label) + ' d\'origine</a>' : '') +
        '</div>' +
        (cats || '<div class="v2-empty"><div class="v2-empty-d">Catalogue indisponible.</div></div>') +
        '<div class="mkt-catbar' + (catSel.length ? ' on' : '') + '" id="mkt-catbar">' +
          '<span id="mkt-catbar-n">' + catSel.length + ' produit' + (catSel.length > 1 ? 's' : '') + ' sélectionné' + (catSel.length > 1 ? 's' : '') + '</span>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.catClear()">Vider</button>' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.catBuildFiche()">' + ICO('plus', 15) + 'Créer une fiche marketing</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ════════════════════════════════════════════
  // ÉDITEUR
  // ════════════════════════════════════════════
  function renderEditor(root, id) {
    if (id === 'new-support' || id === 'new-selection') {
      var ty = id === 'new-selection' ? 'selection' : 'support';
      if (!editing || editing._new !== ty) {
        editing = { id: newId(), type: ty, title: '', accroche: '', footer: '', status: 'brouillon', products: [], theme: defaultTheme(ty), owner: (V2.user && V2.user.email) || '', _new: ty };
      }
    } else {
      var ex = (items || []).filter(function (x) { return x.id === id; })[0];
      if (!ex) { V2.toast('Support introuvable', 'error'); V2.go('marketing'); return; }
      if (!editing || editing.id !== ex.id) {
        editing = { id: ex.id, type: ex.type, title: ex.title, accroche: ex.accroche, footer: ex.footer || '', status: ex.status,
                    products: (ex.products || []).map(function (p) { return Object.assign({}, p); }),
                    theme: Object.assign(defaultTheme(ex.type), ex.theme || {}), owner: ex.owner };
      }
    }
    var t = TYPES[editing.type] || TYPES.support;
    var n = editing.products.length;
    var statusChips = STATUSES.map(function (s) {
      return '<button class="mkt-stbtn' + (editing.status === s.k ? ' on' : '') + '" style="--sc:' + s.color + '" onclick="V2.mkt.setStatus(\'' + s.k + '\',this)">' + esc(s.label) + '</button>';
    }).join('');
    var prodHtml = n ? editing.products.map(prodRow).join('') : '<div class="mkt-empty" style="border:none">Aucun produit. Ajoute des références ci-dessous.</div>';

    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div class="v2-wrap">' +
        '<div class="mkt-edit-grid"><div class="mkt-edit-col">' +
          '<div class="mkt-edit-head">' + badge(editing.type) +
            '<input class="mkt-titlefield" id="mkt-title" placeholder="Titre du ' + esc(t.label.toLowerCase()) + '…" value="' + esc(editing.title) + '" oninput="V2.mkt.setTitle(this.value)"></div>' +
          '<textarea class="mkt-accroche" id="mkt-accroche" rows="2" placeholder="Accroche / message (ex : Notre sélection solaires de l\'été)…" oninput="V2.mkt.setAccroche(this.value)">' + esc(editing.accroche || '') + '</textarea>' +
          personalizePanel() +
          '<div class="mkt-statusrow"><span class="mkt-statusl">Statut</span>' + statusChips + '</div>' +
          '<div class="v2-card">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('cart', 17, 1.8) + 'Produits</div>' +
              '<span class="v2-card-link" id="mkt-count" style="cursor:default">' + n + ' produit' + (n > 1 ? 's' : '') + '</span></div>' +
            '<div id="mkt-prodlist">' + prodHtml + '</div>' +
            catDatalist() +
          '</div>' +
          '<div class="mkt-editbar">' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.openPicker()">' + ICO('plus', 17, 2) + 'Ajouter des produits</button>' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.addCustom()">' + ICO('plus', 17, 2) + 'Produit libre</button>' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.save()">' + ICO('check', 17, 2) + 'Enregistrer</button>' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.downloadPdf()">' + ICO('download', 17, 2) + 'Télécharger le PDF</button>' +
            '<button class="mkt-del" onclick="V2.mkt.remove()" title="Supprimer">' + ICO('close', 17, 2) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-pv-col"><div class="mkt-pv-pane">' +
          '<div class="mkt-pv-bar">Aperçu en direct</div>' +
          '<div class="mkt-mscroll" id="mkt-mscroll"><div class="mkt-mholder" id="mkt-mholder"><div class="mkt-msheet" id="mkt-msheet"></div></div></div>' +
        '</div></div>' +
        '</div>' +
      '</div>' + pickerMarkup();
    wirePicker();
    refreshPreview();
    if (!V2._mktFitBound) { window.addEventListener('resize', fitSheet); V2._mktFitBound = true; }
  }
  var CAT_SUGG = ['Antalgiques & douleur', 'ORL · Nez & gorge', 'Digestif & transit', 'Dermatologie', 'Circulation veineuse', 'Compléments & vitamines', 'Diabète & autosurveillance', 'Ophtalmologie', 'Pansements & cicatrisation', 'Hygiène · Bébé · Sérum phy', 'Sommeil · Stress', 'Sevrage tabac', 'Contraception & gynéco', 'Solaire', 'Minceur', 'Vétérinaire'];
  function catDatalist() {
    var seen = {}, opts = '';
    (editing && editing.products || []).forEach(function (p) {
      var c = (p.cat || '').trim();
      if (c && !seen[c]) { seen[c] = 1; opts += '<option value="' + esc(c) + '">'; }
    });
    CAT_SUGG.forEach(function (c) { if (!seen[c]) { seen[c] = 1; opts += '<option value="' + esc(c) + '">'; } });
    return '<datalist id="mkt-cats">' + opts + '</datalist>';
  }
  function prodRow(p, i) {
    var img = p.img
      ? '<span class="mkt-prow-img" style="background-image:url(' + esc(p.img) + ')"></span>'
      : '<span class="mkt-prow-img mkt-prow-pill">' + ICO('pill', 18, 1.6) + '</span>';
    var sub = p.cip ? ('CIP ' + esc(p.cip)) : (p.brand ? esc(p.brand) : (p.src === 'custom' ? 'produit libre' : (p.ean ? 'EAN ' + esc(p.ean) : '')));
    return '<div class="mkt-prow">' + img +
      '<div class="mkt-prow-main">' +
        '<input class="mkt-prow-namei" value="' + esc(p.name || '') + '" placeholder="Nom du produit" aria-label="Nom" oninput="V2.mkt.setProd(' + i + ',\'name\',this.value)">' +
        '<div class="mkt-prow-sub2">' +
          '<input class="mkt-prow-cati" list="mkt-cats" value="' + esc(p.cat || '') + '" placeholder="Catégorie…" aria-label="Catégorie" oninput="V2.mkt.setProd(' + i + ',\'cat\',this.value)">' +
          '<span class="mkt-prow-sub">' + (sub || 'produit libre') + (p.froid ? ' · FROID' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<label class="mkt-prow-f"><span>Prix €</span><input type="number" inputmode="decimal" step="0.01" min="0" value="' + (p.price != null && p.price !== 0 ? p.price : '') + '" aria-label="Prix" oninput="V2.mkt.setProd(' + i + ',\'price\',this.value)"></label>' +
      '<label class="mkt-prow-f"><span>Remise %</span><input type="number" inputmode="decimal" step="0.1" min="0" value="' + (p.remise != null && p.remise !== 0 ? p.remise : '') + '" aria-label="Remise" oninput="V2.mkt.setProd(' + i + ',\'remise\',this.value)"></label>' +
      '<button class="mkt-prow-x" onclick="V2.mkt.removeProduct(' + i + ')" title="Retirer">' + ICO('close', 15, 2) + '</button>' +
    '</div>';
  }
  function refreshProducts() {
    var box = document.getElementById('mkt-prodlist'); if (!box) { V2.render(); return; }
    var n = editing.products.length;
    box.innerHTML = n ? editing.products.map(prodRow).join('') : '<div class="mkt-empty" style="border:none">Aucun produit. Ajoute des références ci-dessous.</div>';
    var c = document.getElementById('mkt-count'); if (c) c.textContent = n + ' produit' + (n > 1 ? 's' : '');
    refreshPreview();
  }

  // ── Sélecteur de produits (Offilog best-sellers) ──
  function pickerMarkup() {
    return '<div id="mkt-picker" class="mkt-pick-bd">' +
      '<div class="mkt-pick" onclick="event.stopPropagation()">' +
        '<div class="mkt-pick-search">' + ICO('search', 21, 2) +
          '<input id="mkt-pick-input" placeholder="Rechercher (désignation, CIP, EAN)…" autocomplete="off">' +
          '<button class="mkt-prow-x" onclick="V2.mkt.closePicker()">' + ICO('close', 16, 2) + '</button></div>' +
        '<div class="mkt-pick-src">' +
          '<button class="mkt-srcbtn' + (pickSrc === 'mix' ? ' on' : '') + '" data-src="mix" onclick="V2.mkt.setPickSrc(\'mix\')">Sélection grossiste</button>' +
          '<button class="mkt-srcbtn' + (pickSrc === 'gros' ? ' on' : '') + '" data-src="gros" onclick="V2.mkt.setPickSrc(\'gros\')">Catalogue grossiste</button>' +
          '<button class="mkt-srcbtn' + (pickSrc === 'offilog' ? ' on' : '') + '" data-src="offilog" onclick="V2.mkt.setPickSrc(\'offilog\')">Parapharma Offilog</button>' +
        '</div>' +
        '<div id="mkt-pick-list" class="mkt-pick-list"></div>' +
      '</div></div>';
  }
  function renderPickList() {
    var box = document.getElementById('mkt-pick-list'); if (!box) return;
    var inp = document.getElementById('mkt-pick-input'); var q = (inp ? inp.value : '').trim().toLowerCase();
    var have = {}; editing.products.forEach(function (p) { have[String(p.key)] = 1; });
    var html = '', i, b, added;
    if (pickSrc === 'mix') {
      var L = mixFlat(), r3 = [];
      for (i = 0; i < L.length && r3.length < 60; i++) {
        b = L[i];
        if (!q || (b.name || '').toLowerCase().indexOf(q) >= 0 || String(b.cip).indexOf(q) >= 0) r3.push(b);
      }
      html = r3.map(function (b) {
        added = have['m' + b.id];
        var tag = b.group === 'nr' ? 'NR / Para' : (b.group === 'rota' ? 'Top rotation France' : (b.group === 'best' ? 'Top ventes' : (b.group === 'itp' ? 'ITP' : 'L\'Intégral')));
        // chip à droite : VOLUME vendu en priorité, sinon marge (ITP)
        var chip = (b.vol > 0)
          ? '<span class="mkt-pick-sortie" title="volume vendu (unités)">' + V2.fmtNum(b.vol) + ' vendus</span>'
          : (b.group === 'itp' && b.marge > 0 ? '<span class="mkt-pick-sortie marge" title="marge par boîte">marge ' + V2.fmtEur(b.marge) + '</span>' : '');
        var subm = b.sortie > 0 ? ' · ' + b.sortie + '/' + b.total + ' pharm' : (b.cip ? ' · CIP ' + esc(b.cip) : ' · ' + esc(b.cat));
        return '<div class="mkt-pick-item' + (added ? ' added' : '') + '" onclick="V2.mkt.addProduct(\'mix\',\'' + b.id + '\')">' +
          '<span class="mkt-pick-ic">' + ICO('pill', 18, 1.7) + '</span>' +
          '<span class="mkt-pick-nm"><b>' + esc(b.name) + '</b><span>' + tag + subm + '</span></span>' +
          chip +
          '<span class="mkt-pick-pr mono">' + (b.price > 0 ? V2.fmtEur(b.price) : '') + '</span></div>';
      }).join('');
    } else if (pickSrc === 'offilog') {
      var O = window.OFFILOG_BEST || [], res = [];
      for (i = 0; i < O.length && res.length < 40; i++) {
        b = O[i];
        if (!q || (b.name || '').toLowerCase().indexOf(q) >= 0 || (b.brand || '').toLowerCase().indexOf(q) >= 0 || (b.ean || '').indexOf(q) >= 0) res.push(b);
      }
      html = res.map(function (b) {
        added = have['o' + b.id];
        return '<div class="mkt-pick-item' + (added ? ' added' : '') + '" onclick="V2.mkt.addProduct(\'offilog\',\'' + esc(b.id) + '\')">' +
          (b.img ? '<span class="mkt-pick-img" style="background-image:url(' + esc(b.img) + ')"></span>' : '<span class="mkt-pick-img mkt-th-x"></span>') +
          '<span class="mkt-pick-nm"><b>' + esc(b.name) + '</b><span>' + (b.brand ? esc(b.brand) : '') + '</span></span>' +
          '<span class="mkt-pick-pr mono">' + (b.price > 0 ? V2.fmtEur(b.price) : '') + '</span></div>';
      }).join('');
    } else {
      var B = window.BENCHMARK || [], r2 = [];
      for (i = 0; i < B.length && r2.length < 40; i++) {
        b = B[i];
        if (!q || (b.designation || '').toLowerCase().indexOf(q) >= 0 || String(b.cip13 || '').indexOf(q) >= 0) r2.push(b);
      }
      html = r2.map(function (b) {
        added = have['g' + b.cip13];
        var price = refPriceB(b), rem = remiseB(b);
        return '<div class="mkt-pick-item' + (added ? ' added' : '') + '" onclick="V2.mkt.addProduct(\'gros\',\'' + esc(b.cip13) + '\')">' +
          '<span class="mkt-pick-ic">' + ICO('pill', 18, 1.7) + '</span>' +
          '<span class="mkt-pick-nm"><b>' + esc(b.designation) + '</b><span>CIP ' + esc(b.cip13 || '—') + (rem > 0 ? ' · remise ' + String(rem).replace('.', ',') + '%' : '') + '</span></span>' +
          '<span class="mkt-pick-pr mono">' + (price > 0 ? V2.fmtEur(price) : '') + '</span></div>';
      }).join('');
    }
    box.innerHTML = html || '<div class="mkt-empty" style="border:none">Aucun produit trouvé.</div>';
  }
  function wirePicker() {
    var bd = document.getElementById('mkt-picker'); if (!bd) return;
    bd.onclick = function () { closePicker(); };
    var inp = document.getElementById('mkt-pick-input');
    if (inp) { inp.addEventListener('input', renderPickList); inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePicker(); }); }
  }
  function ensureSrc(cb) {
    if (pickSrc === 'mix') { cb(); return; }   // window.MKT_MIX chargé via index.html
    if (pickSrc === 'offilog') ensureBest(cb); else ensureBench(cb);
  }
  function openPicker() {
    ensureSrc(function () {
      var bd = document.getElementById('mkt-picker'); if (!bd) return;
      bd.classList.add('open');
      var inp = document.getElementById('mkt-pick-input'); if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
      renderPickList();
    });
  }
  function closePicker() { var bd = document.getElementById('mkt-picker'); if (bd) bd.classList.remove('open'); }

  // ════════════════════════════════════════════
  // APERÇU + PDF (flyer)
  // ════════════════════════════════════════════
  function buildFlyerHtml(forPdf) {
    var it = editing;
    var t = TYPES[it.type] || TYPES.support;
    var title = (it.title && it.title.trim()) ? it.title.trim() : t.plural;
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var th = it.theme || defaultTheme(it.type);
    var acc = th.accent || '#0050E6';
    var grad = 'linear-gradient(120deg,' + acc + ' 0%,' + darken(acc, 0.6) + ' 100%)';
    var bg = th.bg || '#FFFFFF';
    var showPrice = th.showPrice !== false, showRemise = th.showRemise !== false;
    var showImg = th.showImg !== false;
    var anyImg = showImg && (it.products || []).some(function (p) { return p.img; });
    var cols = (anyImg ? 1 : 0) + 3 + (showPrice ? 1 : 0) + (showRemise ? 1 : 0);
    function prodTr(p, n) {
      var img = prodImg(p, forPdf);
      var ph = '<div style="width:34px;height:34px;border-radius:6px;background:#F1F4F9;display:flex;align-items:center;justify-content:center">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B6BFCE" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L4 21"/></svg></div>';
      var thumb = anyImg
        ? '<td style="padding:6px 8px;width:40px;text-align:center">' + (img ? '<img crossorigin="anonymous" src="' + esc(img) + '" style="width:34px;height:34px;object-fit:contain;border-radius:6px;background:#FBFCFE">' : ph) + '</td>'
        : '';
      var ref = p.cip ? esc(p.cip) : (p.ean ? esc(p.ean) : '—');
      var rem = (p.remise > 0) ? String(p.remise).replace('.', ',') + ' %' : '—';
      return '<tr style="border-bottom:1px solid #ECEFF5;page-break-inside:avoid">' + thumb +
        '<td style="padding:7px 10px;text-align:center;font-size:9px;color:#9AA1B2;font-family:monospace;width:24px">' + n + '</td>' +
        '<td style="padding:7px 10px;font-size:11.5px;font-weight:600;color:#10131C">' + esc((p.name || '').slice(0, 62)) +
          (p.brand ? ' <span style="color:#9AA1B2;font-weight:500">· ' + esc(p.brand) + '</span>' : '') +
          (p.froid ? ' <span style="font-size:7.5px;color:#00B5D8;border:1px solid #b8edf7;border-radius:4px;padding:0 3px;vertical-align:middle">FROID</span>' : '') + '</td>' +
        '<td style="padding:7px 10px;font-family:monospace;font-size:10px;color:#737A8C">' + ref + '</td>' +
        (showPrice ? '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:12px;font-weight:800;color:' + acc + '">' + (p.price > 0 ? V2.fmtEur(p.price) : '—') + '</td>' : '') +
        (showRemise ? '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#1E9E6A">' + rem + '</td>' : '') +
      '</tr>';
    }
    // regroupe par catégorie (ordre d'apparition) ; sous-titres si plusieurs catégories
    var order = [], gmap = {};
    (it.products || []).forEach(function (p) {
      var c = ((p.cat || '').trim()) || '—';
      if (!gmap[c]) { gmap[c] = []; order.push(c); }
      gmap[c].push(p);
    });
    var hasCats = order.length > 1 || (order.length === 1 && order[0] !== '—');
    var rows = '', nn = 0;
    order.forEach(function (c) {
      if (hasCats) {
        rows += '<tr><td colspan="' + cols + '" style="padding:10px 10px 5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:' + acc + ';background:#F4F6FB;border-top:1px solid #E2E7F0">' +
          esc(c === '—' ? 'Autres' : c) + ' <span style="color:#9AA1B2;font-weight:600">· ' + gmap[c].length + '</span></td></tr>';
      }
      gmap[c].forEach(function (p) { nn++; rows += prodTr(p, nn); });
    });
    function thh(lbl, al) { return '<th style="padding:6px 10px;text-align:' + al + ';font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#9AA1B2">' + lbl + '</th>'; }
    var body = rows
      ? '<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden">' +
          '<thead><tr style="background:#F7F9FC;border-bottom:1.5px solid #E2E7F0">' +
            (anyImg ? '<th></th>' : '') + thh('#', 'center') + thh('Produit', 'left') + thh('Réf (CIP/EAN)', 'left') +
            (showPrice ? thh('Prix IP', 'right') : '') + (showRemise ? thh('Remise', 'right') : '') +
          '</tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div style="text-align:center;color:#9AA1B2;font-size:13px;padding:40px">Aucun produit.</div>';
    var footer = (it.footer && it.footer.trim()) ? esc(it.footer.trim()) : ('Prix nets HT indicatifs · ' + esc(dateStr));
    return '<div style="font-family:Satoshi,Inter,Arial,sans-serif;width:794px;box-sizing:border-box;padding:36px 38px;background:' + bg + ';color:#10131C">' +
        '<div style="background:' + grad + ';border-radius:18px;padding:26px 30px;color:#fff;margin-bottom:22px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.12)"></div>' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">Intégral Pharma · ' + esc(t.label) + '</div>' +
          '<div style="font-size:30px;font-weight:800;letter-spacing:-.02em;margin-top:8px;line-height:1.05">' + esc(title) + '</div>' +
          (it.accroche && it.accroche.trim() ? '<div style="font-size:13.5px;opacity:.95;margin-top:9px;max-width:560px">' + esc(it.accroche.trim()) + '</div>' : '') +
          '<div style="font-size:12px;opacity:.85;margin-top:9px">' + (it.products || []).length + ' produit' + ((it.products || []).length > 1 ? 's' : '') + ' · ' + esc(dateStr) + '</div>' +
        '</div>' + body +
        '<div style="margin-top:26px;padding-top:14px;border-top:1px solid rgba(16,19,28,.1);display:flex;justify-content:space-between;gap:14px;font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em">' +
          '<span>Intégral Pharma · ' + esc(t.plural) + '</span><span style="text-align:right">' + footer + '</span></div>' +
      '</div>';
  }
  // ── Panneau de personnalisation (charte) ──
  function personalizePanel() {
    var th = editing.theme || defaultTheme(editing.type);
    var accSw = ACCENTS.map(function (c) {
      return '<button class="mkt-sw mkt-sw-acc' + (th.accent === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" onclick="V2.mkt.setAccent(\'' + c + '\')"></button>';
    }).join('');
    var bgSw = BGS.map(function (c) {
      return '<button class="mkt-sw mkt-sw-bg' + (th.bg === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" onclick="V2.mkt.setBg(\'' + c + '\')"></button>';
    }).join('');
    return '<div class="v2-card mkt-perso">' +
      '<div class="v2-card-head"><div class="v2-card-t">' + ICO('spark', 17, 1.8) + 'Personnalisation</div>' +
        '<span class="v2-card-link" style="cursor:default;color:var(--muted)">charte graphique</span></div>' +
      '<div class="mkt-perso-body">' +
        '<div class="mkt-perso-row"><span class="mkt-perso-l">Couleur</span><div class="mkt-sws">' + accSw +
          '<label class="mkt-sw mkt-sw-pick" title="Couleur libre"><input type="color" value="' + esc(th.accent) + '" oninput="V2.mkt.setAccent(this.value)"></label></div></div>' +
        '<div class="mkt-perso-row"><span class="mkt-perso-l">Fond</span><div class="mkt-sws">' + bgSw +
          '<label class="mkt-sw mkt-sw-pick" title="Fond libre"><input type="color" value="' + esc(th.bg) + '" oninput="V2.mkt.setBg(this.value)"></label></div></div>' +
        '<div class="mkt-perso-row"><span class="mkt-perso-l">Affichage</span><div class="mkt-toggles">' +
          '<button class="mkt-tg' + (th.showPrice !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showPrice\',this)">Prix</button>' +
          '<button class="mkt-tg' + (th.showRemise !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showRemise\',this)">Remises</button>' +
          '<button class="mkt-tg' + (th.showImg !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showImg\',this)">Photos</button>' +
        '</div></div>' +
        '<div class="mkt-perso-row"><span class="mkt-perso-l">Mentions</span>' +
          '<input class="mkt-foot" id="mkt-footer" placeholder="ex : Offre valable jusqu\'au 31/07 · contact@integralpharma.fr" value="' + esc(editing.footer || '') + '" oninput="V2.mkt.setFooter(this.value)"></div>' +
      '</div></div>';
  }
  // aperçu live inline (toujours visible dans l'éditeur)
  function refreshPreview() {
    var sh = document.getElementById('mkt-msheet'); if (!sh || !editing) return;
    sh.innerHTML = buildFlyerHtml(false); // false = images via URL réseau (écran)
    fitSheet();
    waitImages(sh, 6000).then(fitSheet);
  }

  function previewMarkup() {
    return '<div id="mkt-modal" class="mkt-modal">' +
      '<div class="mkt-dialog" onclick="event.stopPropagation()">' +
        '<div class="mkt-mtop"><div class="mkt-mtt">' + ICO('grid', 17, 2) + ' Aperçu du support</div>' +
          '<button class="v2-btn v2-btn-primary" id="mkt-dl">' + ICO('download', 16, 2) + ' Télécharger le PDF</button>' +
          '<button class="mkt-mx" onclick="V2.mkt.closePreview()">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="mkt-mscroll" id="mkt-mscroll"><div class="mkt-mholder" id="mkt-mholder"><div class="mkt-msheet" id="mkt-msheet"></div></div></div>' +
      '</div></div>';
  }
  function fitSheet() {
    var sc = document.getElementById('mkt-mscroll'), ho = document.getElementById('mkt-mholder'), sh = document.getElementById('mkt-msheet');
    if (!sc || !ho || !sh) return;
    var avail = sc.clientWidth - 48; if (avail <= 0) return;
    var scale = Math.min(1, avail / 794);
    sh.style.transform = 'scale(' + scale + ')';
    var h = sh.firstChild ? sh.firstChild.offsetHeight : sh.offsetHeight;
    ho.style.width = (794 * scale) + 'px'; ho.style.height = (h * scale) + 'px';
  }
  function waitImages(node, timeout) {
    var imgs = Array.prototype.slice.call(node.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return new Promise(function (resolve) {
      var left = imgs.length, done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      var to = setTimeout(fin, timeout || 9000);
      function tick() { if (--left <= 0) { clearTimeout(to); fin(); } }
      imgs.forEach(function (im) { if (im.complete && im.naturalWidth > 0) { tick(); return; } im.addEventListener('load', tick); im.addEventListener('error', tick); });
    });
  }

  // ════════════════════════════════════════════
  // API PUBLIQUE
  // ════════════════════════════════════════════
  V2.mkt = {
    create: function (type) { editing = null; V2.go('marketing', type === 'selection' ? 'new-selection' : 'new-support'); },
    open: function (id) { editing = null; V2.go('marketing', id); },
    setProd: function (i, field, v) {
      if (!editing || !editing.products[i]) return;
      var p = editing.products[i];
      if (field === 'name') p.name = v;
      else if (field === 'price') p.price = (v === '' ? 0 : (parseFloat(String(v).replace(',', '.')) || 0));
      else if (field === 'remise') p.remise = (v === '' ? 0 : (parseFloat(String(v).replace(',', '.')) || 0));
      else if (field === 'cat') p.cat = v;
      refreshPreview();   // n'écrase pas la ligne en cours d'édition (pas de refreshProducts)
    },
    addCustom: function () {
      if (!editing) return;
      editing.products.push({ src: 'custom', key: 'c' + Date.now() + Math.round(Math.random() * 999),
        id: '', name: '', brand: '', ean: '', cip: '', price: 0, remise: 0, img: '', froid: false });
      refreshProducts();
      setTimeout(function () { var inp = document.querySelectorAll('.mkt-prow-namei'); if (inp.length) inp[inp.length - 1].focus(); }, 40);
    },
    setTitle: function (v) { if (editing) { editing.title = v; refreshPreview(); } },
    setAccroche: function (v) { if (editing) { editing.accroche = v; refreshPreview(); } },
    setFooter: function (v) { if (editing) { editing.footer = v; refreshPreview(); } },
    setAccent: function (c) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type); editing.theme.accent = c;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-sw-acc'), function (el) { el.classList.toggle('on', el.getAttribute('data-c') === c); });
      refreshPreview();
    },
    setBg: function (c) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type); editing.theme.bg = c;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-sw-bg'), function (el) { el.classList.toggle('on', el.getAttribute('data-c') === c); });
      refreshPreview();
    },
    toggle: function (key, btn) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type);
      editing.theme[key] = editing.theme[key] === false ? true : false;
      if (btn) btn.classList.toggle('on', editing.theme[key] !== false);
      refreshPreview();
    },
    setStatus: function (k, btn) {
      if (!editing) return; editing.status = k;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-stbtn'), function (b) { b.classList.remove('on'); });
      if (btn) btn.classList.add('on');
    },
    catSrc: function (s) { catSrc = s; V2.render(); },
    catAdd: function (fi) {
      var row = catRows[fi]; if (!row) return;
      var key = String(row.cip || row.d);
      var at = -1; for (var i = 0; i < catSel.length; i++) { if (catSel[i].key === key) { at = i; break; } }
      if (at >= 0) catSel.splice(at, 1);
      else catSel.push({ src: 'cat', key: key, id: '', name: row.d, brand: '', ean: '', cip: row.cip ? String(row.cip) : '', price: row.p || 0, remise: 0, img: row.img || '', froid: !!row.froid, cat: row.cat || '' });
      var on = at < 0;
      var btn = document.getElementById('mkt-ca-' + fi);
      if (btn) { btn.classList.toggle('on', on); btn.title = on ? 'Retirer de ma sélection' : 'Ajouter à une fiche'; btn.innerHTML = ICO(on ? 'check' : 'plus', 15, 2.4); }
      updateCatBar();
    },
    catClear: function () { catSel = []; V2.render(); },
    catBuildFiche: function () {
      if (!catSel.length) { V2.toast('Coche au moins un produit (+)', 'warn'); return; }
      editing = { id: newId(), type: 'selection', title: '', accroche: '', footer: '', status: 'brouillon',
                  products: catSel.map(function (p) { return Object.assign({}, p); }),
                  theme: defaultTheme('selection'), owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      catSel = [];
      V2.go('marketing', 'new-selection');
    },
    catPdf: function (srcKey) {
      if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
      var M = window.MKT_MIX || {};
      var map = { nr: ['nr', 'Catalogue NR — non remboursable & parapharmacie'], rota: ['rotations', 'Top rotations France'],
        integral: ['integral', 'Catalogue L\'Intégral'], itp: ['itp', 'Pansements & dispositifs ITP'], best: ['bestsellers', 'Top ventes par famille'] };
      var conf = map[srcKey] || map.nr;
      var data = M[conf[0]] || [];
      if (!data.length) { V2.toast('Catalogue vide', 'warn'); return; }
      var isItp = (srcKey === 'itp');
      var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      var e2 = function (v) { return (v ? (+v).toFixed(2).replace('.', ',') : '—') + (v ? ' €' : ''); };
      V2.toast('Génération du PDF…');
      var secs = data.map(function (c) {
        var trs = (c.rows || []).map(function (r, i) {
          var metric = isItp
            ? '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;color:#1E9E6A;font-weight:700">' + (r.marge ? e2(r.marge) : '—') + '</td>'
            : '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:800">' + (r.vol > 0 ? r.vol.toLocaleString('fr') : '—') + '</td>';
          return '<tr style="border-bottom:1px solid #EEF1F6">' +
            '<td style="padding:3px 6px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
            '<td style="padding:3px 6px;font-size:10px;font-weight:600;color:#10131C">' + esc((r.d || '').slice(0, 52)) + (r.o ? ' <span style="color:#C7791A;font-size:7px;font-weight:800">OFFRE</span>' : '') + '</td>' +
            '<td style="padding:3px 6px;font-family:monospace;font-size:8.5px;color:#737A8C">' + esc(r.cip || '') + '</td>' +
            '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#0050E6">' + e2(r.p) + '</td>' + metric +
            '</tr>';
        }).join('');
        return '<div style="margin-bottom:13px;page-break-inside:avoid">' +
          '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(90deg,#0050E622,transparent);border-left:4px solid #0050E6;border-radius:5px;margin-bottom:4px">' +
            '<div style="font-size:12px;font-weight:800;color:#10131C">' + esc(c.cat) + '</div>' +
            '<div style="font-size:9px;color:#737A8C">' + (c.rows || []).length + ' réf.</div></div>' +
          '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#F4F6FB">' +
            ['#', 'Produit', 'CIP', 'Prix net', (isItp ? 'Marge/bte' : 'Volume vendu')].map(function (h, k) {
              return '<th style="padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#737A8C;text-align:' + (k < 3 ? 'left' : 'right') + '">' + h + '</th>';
            }).join('') + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
      }).join('');
      var html = '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
        '<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #10131C;padding-bottom:12px;margin-bottom:14px">' +
          '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
          '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · sélection grossiste</div>' +
            '<div style="font-size:18px;font-weight:800">' + esc(conf[1]) + '</div>' +
            '<div style="font-size:10px;color:#737A8C">Classé par rayon · trié par volume vendu (5 mois) · prix net indicatif</div></div>' +
          '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + dateStr + '</div>' +
        '</div>' + secs +
        '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">Intégral Pharma · document commercial · « Volume vendu » = quantités écoulées sur 5 mois</div>' +
      '</div>';
      window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
        var wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
        wrap.innerHTML = html; document.body.appendChild(wrap);
        var fn = (conf[1].replace(/[^A-Za-z0-9]/g, '_')).slice(0, 40) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
        window.html2pdf().from(wrap.firstChild).set({ filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } })
          .save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Doc marketing téléchargé'); })
          .catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
      });
    },
    openPicker: openPicker, closePicker: closePicker,
    setPickSrc: function (s) {
      pickSrc = s;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-srcbtn'), function (b) { b.classList.toggle('on', b.getAttribute('data-src') === s); });
      ensureSrc(function () { renderPickList(); var inp = document.getElementById('mkt-pick-input'); if (inp) inp.focus(); });
    },
    addProduct: function (src, key) {
      var p = null;
      if (src === 'mix') {
        var L = mixFlat(), gm = null;
        for (var m = 0; m < L.length; m++) if (String(L[m].id) === String(key)) { gm = L[m]; break; }
        if (!gm) return;
        p = { src: 'mix', key: 'm' + gm.id, id: '', name: gm.name, brand: (gm.group === 'itp' ? 'ITP' : (gm.group === 'integral' ? 'L\'Intégral' : '')), ean: '', cip: gm.cip, price: gm.price, remise: gm.remise, img: '', froid: false, cat: gm.cat || '' };
      } else if (src === 'offilog') {
        var O = window.OFFILOG_BEST || [], b = null;
        for (var i = 0; i < O.length; i++) if (String(O[i].id) === String(key)) { b = O[i]; break; }
        if (!b) return;
        p = { src: 'offilog', key: 'o' + b.id, id: b.id, name: b.name, brand: b.brand || '', ean: b.ean || '', cip: '', price: b.price || 0, remise: 0, img: b.img || '', froid: false, cat: 'Parapharmacie' };
      } else {
        var B = window.BENCHMARK || [], g = null;
        for (var j = 0; j < B.length; j++) if (String(B[j].cip13) === String(key)) { g = B[j]; break; }
        if (!g) return;
        p = { src: 'gros', key: 'g' + g.cip13, id: '', name: g.designation, brand: '', ean: '', cip: String(g.cip13), price: refPriceB(g), remise: remiseB(g), img: '', froid: !!g.is_froid, cat: '' };
      }
      if (editing.products.some(function (x) { return String(x.key) === String(p.key); })) return;
      editing.products.push(p); refreshProducts(); renderPickList();
    },
    removeProduct: function (i) { if (editing) { editing.products.splice(i, 1); refreshProducts(); } },
    save: function () {
      if (!editing) return;
      if (!editing.title || !editing.title.trim()) { editing.title = (TYPES[editing.type] || TYPES.support).plural + ' du ' + new Date().toLocaleDateString('fr-FR'); }
      var clean = { id: editing.id, type: editing.type, title: editing.title, accroche: editing.accroche, footer: editing.footer || '',
                    status: editing.status, theme: Object.assign({}, editing.theme || defaultTheme(editing.type)),
                    products: editing.products.map(function (p) { return Object.assign({}, p); }), owner: editing.owner };
      V2.toast('Enregistrement…');
      saveItem(clean).then(function () { V2.toast('Enregistré' + (backend === 'supabase' ? ' (partagé)' : '')); var tf = document.getElementById('mkt-title'); if (tf) tf.value = editing.title; });
    },
    remove: function () {
      if (!editing) return;
      if (!confirm('Supprimer ce support ?')) return;
      removeItem(editing.id).then(function () { V2.toast('Supprimé'); editing = null; V2.go('marketing'); });
    },
    preview: function () {
      if (!editing || !editing.products.length) { V2.toast('Ajoute au moins un produit', 'warn'); return; }
      ensureImg(function () {
        var bd = document.getElementById('mkt-modal'); if (!bd) return;
        bd.querySelector('#mkt-msheet').innerHTML = buildFlyerHtml(false);
        bd.querySelector('#mkt-dl').onclick = V2.mkt.downloadPdf;
        bd.classList.add('open');
        requestAnimationFrame(function () { requestAnimationFrame(fitSheet); });
        waitImages(bd.querySelector('#mkt-msheet'), 9000).then(fitSheet);
        if (!V2._mktFitBound) { window.addEventListener('resize', fitSheet); V2._mktFitBound = true; }
      });
    },
    closePreview: function () { var bd = document.getElementById('mkt-modal'); if (bd) bd.classList.remove('open'); },
    downloadPdf: function () {
      if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
      var t = TYPES[editing.type] || TYPES.support;
      var title = (editing.title && editing.title.trim()) ? editing.title.trim() : t.plural;
      V2.toast('Génération du PDF…');
      ensureImg(function () {
        var html = buildFlyerHtml(true);
        window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
          wrap.innerHTML = html; document.body.appendChild(wrap);
          return waitImages(wrap, 12000).then(function () {
            var fn = (t.label + '-' + title).replace(/[^A-Za-z0-9-]/g, '_').slice(0, 50) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
            return window.html2pdf().from(wrap.firstChild).set({
              filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] }
            }).save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('PDF téléchargé'); });
          }).catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
        });
      });
    }
  };

  // ════════════════════════════════════════════
  // PAGE
  // ════════════════════════════════════════════
  // ════════════════════════════════════════════
  // DOCUMENTS PARTAGÉS (PDF) — Supabase Storage
  // ════════════════════════════════════════════
  function renderDocs(root) {
    if (docs === null) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Ouverture des documents…</div></div>';
      loadDocs().then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
      return;
    }
    var list = docs.length ? docs.map(function (d) {
      var nm = String(d.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return '<div class="mkt-doc">' +
        '<span class="mkt-doc-ic">' + ICO('cat', 20) + '</span>' +
        '<div class="mkt-doc-main"><div class="mkt-doc-n">' + esc(prettyName(d.name)) + '</div>' +
          '<div class="mkt-doc-m">' + fmtSize(d.size) + (d.created ? ' · ' + new Date(d.created).toLocaleDateString('fr-FR') : '') + '</div></div>' +
        '<a class="v2-btn v2-btn-ghost mkt-doc-open" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + ICO('download', 15) + 'Ouvrir</a>' +
        '<button class="mkt-doc-del" title="Supprimer pour tous" onclick="V2.mkt.docsDelete(\'' + nm + '\')">' + ICO('close', 16, 2) + '</button>' +
      '</div>';
    }).join('') : '<div class="mkt-empty">Aucun document pour le moment. Ajoute un PDF — il sera visible par tous les comptes.</div>';

    var setup = docsErr
      ? '<div class="mkt-setup">' + ICO('alert', 16, 2) + '<div><b>Stockage partagé à activer (une seule fois)</b><br>' +
        'Le dossier des PDF n\'est pas encore créé côté Supabase. Demande-moi le script, il est prêt — après ça, tout marche pour tous les comptes.</div></div>'
      : '';

    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Documents partagés</div>' +
        '<div class="v2-page-sub">Des PDF (catalogues, fiches, offres…) visibles par <b>tous les comptes</b>. Ajoute, ouvre, supprime.</div>' +
        '<div class="mkt-doc-bar">' +
          '<label class="v2-btn v2-btn-primary mkt-upl' + (docsBusy ? ' is-busy' : '') + '">' + ICO('plus', 16, 2) + (docsBusy ? 'Envoi en cours…' : 'Ajouter un PDF') +
            '<input type="file" accept="application/pdf,.pdf" multiple style="display:none"' + (docsBusy ? ' disabled' : '') + ' onchange="V2.mkt.docsUpload(this)"></label>' +
        '</div>' +
        setup +
        '<div class="mkt-doc-list">' + list + '</div>' +
      '</div>';
  }

  V2.pages.marketing = {
    render: function (root, param) {
      injectCss();
      if (items === null) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Ouverture de l\'espace Marketing…</div></div>';
        loadItems().then(function () { V2.render(); });
        return;
      }
      if (param === 'catalogues') renderCatalogues(root);
      else if (param === 'site') renderSite(root);
      else if (param === 'docs') renderDocs(root);
      else if (param) renderEditor(root, param); else renderList(root);
    }
  };
  V2.mktReload = function () { items = null; docs = null; };

  // ── Upload / suppression des PDF partagés ──
  V2.mkt = V2.mkt || {};
  V2.mkt.docsUpload = function (input) {
    var files = input && input.files ? [].slice.call(input.files) : [];
    var pdfs = files.filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!pdfs.length) { if (V2.toast) V2.toast('Choisis un fichier PDF.'); return; }
    var c = sb();
    if (!c || !c.storage) { if (V2.toast) V2.toast('Connexion requise.'); return; }
    docsBusy = true; if (V2.route && V2.route.name === 'marketing') V2.render();
    var chain = Promise.resolve(), failed = 0;
    pdfs.forEach(function (f) {
      chain = chain.then(function () {
        var key = Date.now() + '-' + Math.floor(Math.random() * 1000) + '__' + sanitize(f.name);
        return c.storage.from(BUCKET).upload(key, f, { contentType: 'application/pdf', upsert: false })
          .then(function (r) { if (r && r.error) failed++; });
      });
    });
    chain.then(function () { return loadDocs(); }).then(function () {
      docsBusy = false;
      if (V2.route && V2.route.name === 'marketing') V2.render();
      if (V2.toast) V2.toast(failed ? 'Envoi partiel (' + failed + ' échec).' : (pdfs.length > 1 ? 'PDF ajoutés.' : 'PDF ajouté.'));
    }).catch(function () {
      docsBusy = false;
      loadDocs().then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
      if (V2.toast) V2.toast('Échec de l\'envoi.');
    });
  };
  V2.mkt.docsDelete = function (name) {
    var c = sb(); if (!c || !c.storage) return;
    var disp = prettyName(name);
    var go = function () {
      c.storage.from(BUCKET).remove([name]).then(function () { return loadDocs(); })
        .then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); if (V2.toast) V2.toast('Supprimé.'); })
        .catch(function () { if (V2.toast) V2.toast('Échec de la suppression.'); });
    };
    if (window.confirm('Supprimer « ' + disp + ' » ? Il disparaîtra pour tous les comptes.')) go();
  };

  // ════════════════════════════════════════════
  // CSS
  // ════════════════════════════════════════════
  function injectCss() {
    if (document.getElementById('v2-mkt-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-css';
    s.textContent = [
      '.mkt-share{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:6px 11px;border-radius:999px}',
      '.mkt-share.ok{color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,#fff)}',
      '.mkt-share.local{color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 12%,#fff)}',
      '.mkt-section{margin-top:26px}',
      '.mkt-cat-banner{display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px 18px;background:linear-gradient(150deg,color-mix(in srgb,var(--c-cat) 8%,#fff),var(--card));border:1px solid color-mix(in srgb,var(--c-cat) 22%,var(--line));border-radius:var(--r-card);box-shadow:var(--sh-1);cursor:pointer;text-decoration:none;color:inherit;transition:.16s var(--ease)}',
      '.mkt-cat-banner:hover{box-shadow:var(--sh-2);transform:translateY(-1px)}',
      '.mkt-cat-ic{width:44px;height:44px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--c-cat),#4d35a0)}',
      '.mkt-cat-t{display:block;font-weight:800;font-size:15.5px;letter-spacing:-.01em}',
      '.mkt-cat-s{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}',
      // ── Documents PDF partagés ──
      '.mkt-doc-bar{display:flex;gap:10px;margin:18px 0 6px;flex-wrap:wrap}',
      '.mkt-upl{position:relative;cursor:pointer}',
      '.mkt-upl input{position:absolute;inset:0;opacity:0;cursor:pointer}',
      '.mkt-upl.is-busy{opacity:.6;pointer-events:none}',
      '.mkt-doc-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}',
      '.mkt-doc{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-1);padding:12px 14px}',
      '.mkt-doc-ic{width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--c-rose,#E0556E),#b1304a)}',
      '.mkt-doc-main{flex:1;min-width:0}',
      '.mkt-doc-n{font-weight:700;font-size:14.5px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mkt-doc-m{font-size:12px;color:var(--muted);margin-top:2px}',
      '.mkt-doc-open{flex-shrink:0;white-space:nowrap}',
      '.mkt-doc-del{flex-shrink:0;width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}',
      '.mkt-doc-del:hover{color:#fff;background:var(--c-rose,#E0556E);border-color:var(--c-rose,#E0556E)}',
      '.mkt-cat-prod{font-weight:600;font-size:13.5px}',
      '.mkt-sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}',
      '.mkt-sec-t{font-size:18px;font-weight:800;letter-spacing:-.02em}',
      '.mkt-sec-s{font-size:12.5px;color:var(--muted);margin-top:2px}',
      '.mkt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:15px}',
      '.mkt-card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:var(--sh-1);padding:15px 16px;cursor:pointer;transition:.18s var(--ease);display:flex;flex-direction:column;gap:9px}',
      '.mkt-card:hover{transform:translateY(-3px);box-shadow:var(--sh-3);border-color:rgba(0,80,230,.2)}',
      '.mkt-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mkt-typebadge{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--bc);background:color-mix(in srgb,var(--bc) 13%,#fff);padding:3px 8px;border-radius:7px}',
      '.mkt-status{font-size:10.5px;font-weight:700;color:var(--sc)}',
      '.mkt-card-t{font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.25}',
      '.mkt-thumbs{display:flex;gap:5px;align-items:center}',
      '.mkt-th{width:34px;height:34px;border-radius:8px;background:#F0F2F7 center/cover no-repeat;border:1px solid var(--line);flex-shrink:0}',
      '.mkt-th-x{background:var(--card-2)}',
      '.mkt-more{font-size:11px;color:var(--muted);font-weight:700}',
      '.mkt-card-m{font-size:11.5px;color:var(--muted);margin-top:auto}',
      '.mkt-empty{padding:24px 16px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:14px;grid-column:1/-1}',
      '.mkt-setup{display:flex;gap:11px;align-items:flex-start;margin-top:26px;padding:15px 17px;border-radius:14px;background:color-mix(in srgb,var(--c-amber) 8%,#fff);border:1px solid color-mix(in srgb,var(--c-amber) 28%,transparent);font-size:13px;line-height:1.5;color:var(--ip-ink-2)}',
      '.mkt-setup svg{color:var(--c-amber);flex-shrink:0;margin-top:1px}',
      '.mkt-edit-head{display:flex;align-items:center;gap:11px;margin-bottom:6px}',
      '.mkt-titlefield{flex:1;font-family:var(--font);font-size:23px;font-weight:800;letter-spacing:-.03em;color:var(--ip-ink);border:none;outline:none;background:none;padding:6px 0;border-bottom:2px solid var(--line);transition:.18s var(--ease)}',
      '.mkt-titlefield:focus{border-bottom-color:var(--ip-blue)}',
      '.mkt-accroche{width:100%;font-family:var(--font);font-size:14px;line-height:1.55;color:var(--ip-ink-2);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 15px;margin:14px 0;outline:none;resize:vertical;box-shadow:var(--sh-1)}',
      '.mkt-accroche:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-statusrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px}',
      '.mkt-statusl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-right:4px}',
      '.mkt-stbtn{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 13px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.16s var(--ease)}',
      '.mkt-stbtn.on{border-color:var(--sc);color:#fff;background:var(--sc)}',
      '.mkt-perso-body{padding:14px 18px;display:flex;flex-direction:column;gap:13px}',
      '.mkt-perso-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.mkt-perso-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;width:82px;flex-shrink:0}',
      '.mkt-sws{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.mkt-sw{width:26px;height:26px;border-radius:8px;border:2px solid var(--line);cursor:pointer;padding:0;transition:.14s var(--ease)}',
      '.mkt-sw.on{border-color:var(--ip-ink);box-shadow:0 0 0 2px #fff inset}',
      '.mkt-sw-bg{box-shadow:inset 0 0 0 1px rgba(16,19,28,.07)}',
      '.mkt-sw-pick{display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:conic-gradient(#f44,#fd0,#4d4,#0cf,#46f,#d4f,#f44)}',
      '.mkt-sw-pick input{opacity:0;width:130%;height:130%;cursor:pointer;border:none;padding:0}',
      '.mkt-toggles{display:flex;gap:8px}',
      '.mkt-tg{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 15px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.16s var(--ease)}',
      '.mkt-tg.on{border-color:var(--c-opp);color:#fff;background:var(--c-opp)}',
      '.mkt-foot{flex:1;min-width:200px;font-family:var(--font);font-size:13px;color:var(--ip-ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;outline:none;background:var(--card)}',
      '.mkt-foot:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--line-2)}',
      '.mkt-prow:last-child{border-bottom:none}',
      '.mkt-prow-img{width:42px;height:42px;border-radius:9px;background:#F0F2F7 center/cover no-repeat;border:1px solid var(--line);flex-shrink:0}',
      '.mkt-prow-main{flex:1;min-width:0}',
      '.mkt-prow-namei{width:100%;border:1px solid transparent;background:transparent;border-radius:8px;padding:5px 7px;margin:-5px -7px 0;font-family:var(--font);font-size:13.5px;font-weight:600;color:var(--ip-ink)}',
      '.mkt-prow-namei:hover{border-color:var(--line)}',
      '.mkt-prow-namei:focus{outline:none;border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow-f{display:flex;flex-direction:column;gap:2px;flex-shrink:0;width:74px}',
      '.mkt-prow-f span{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700}',
      '.mkt-prow-f input{width:100%;border:1px solid var(--line);border-radius:var(--r-control,9px);padding:6px 8px;font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--ip-ink);text-align:right;background:var(--card)}',
      '.mkt-prow-f input:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '@media(max-width:560px){.mkt-prow{flex-wrap:wrap}.mkt-prow-f{width:auto;flex:1}}',
      '.mkt-prow-name{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-prow-sub{font-size:11px;color:var(--muted);font-family:var(--mono)}',
      '.mkt-prow-sub2{display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap}',
      '.mkt-prow-cati{border:1px solid var(--line);background:var(--card);border-radius:7px;padding:3px 8px;font-family:var(--font);font-size:11px;font-weight:600;color:var(--ip-blue);max-width:200px}',
      '.mkt-prow-cati:hover{border-color:var(--ip-blue)}',
      '.mkt-prow-cati:focus{outline:none;border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow-cati::placeholder{color:var(--muted-2);font-weight:500}',
      '.mkt-prow-price{font-size:14px;font-weight:800;color:var(--ip-blue);flex-shrink:0}',
      '.mkt-prow-x{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.16s var(--ease)}',
      '.mkt-prow-x:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}',
      '.mkt-editbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}',
      // éditeur 2 colonnes + aperçu live
      '.mkt-edit-grid{display:grid;grid-template-columns:minmax(320px,1fr) minmax(360px,520px);gap:30px;align-items:start}',
      '@media(max-width:980px){.mkt-edit-grid{grid-template-columns:1fr;gap:22px}}',
      '.mkt-pv-pane{position:sticky;top:84px}',
      '@media(max-width:980px){.mkt-pv-pane{position:static}}',
      '.mkt-pv-bar{display:flex;align-items:center;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-bottom:12px}',
      '.mkt-pv-bar::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--c-opp);box-shadow:0 0 0 4px color-mix(in srgb,var(--c-opp) 18%,transparent)}',
      '.mkt-pv-pane .mkt-mscroll{flex:none;max-height:calc(100vh - 132px);border-radius:16px;border:1px solid var(--line)}',
      '.mkt-del{margin-left:auto;width:42px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.16s var(--ease)}',
      '.mkt-del:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}',
      '.mkt-pick-bd{position:fixed;inset:0;z-index:210;background:rgba(16,19,28,.34);backdrop-filter:blur(7px);display:flex;align-items:flex-start;justify-content:center;padding-top:8vh;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.mkt-pick-bd.open{opacity:1;pointer-events:auto}',
      '.mkt-pick{width:min(620px,93vw);max-height:76vh;background:var(--card);border-radius:18px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.mkt-pick-bd.open .mkt-pick{transform:scale(1)}',
      '.mkt-pick-search{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}',
      '.mkt-pick-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.mkt-pick-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.mkt-pick-src{display:flex;gap:6px;padding:10px 16px 4px}',
      '.mkt-srcbtn{flex:1;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px 10px;font-family:var(--font);font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:.16s var(--ease)}',
      '.mkt-srcbtn.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-cat-thumb{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:9px;border:1px solid var(--line);background:#fff center/contain no-repeat;background-origin:content-box;padding:3px;box-shadow:0 1px 2px rgba(8,16,40,.05);flex-shrink:0}',
      '.mkt-cat-thumb-ph{background:var(--card-2);color:var(--muted-2);box-shadow:none}',
      '.mkt-catadd{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ip-blue);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.14s var(--ease)}',
      '.mkt-catadd:hover{border-color:var(--ip-blue);background:var(--halo)}',
      '.mkt-catadd.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-catbar{position:sticky;bottom:14px;display:none;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding:12px 16px;border-radius:14px;background:var(--ip-ink);color:#fff;box-shadow:0 12px 34px rgba(8,16,40,.28)}',
      '.mkt-catbar.on{display:flex}',
      '.mkt-catbar #mkt-catbar-n{font-weight:700;font-size:13.5px}',
      '.mkt-pick-ic{width:40px;height:40px;border-radius:9px;background:var(--card-2);display:flex;align-items:center;justify-content:center;color:var(--ip-blue);flex-shrink:0}',
      '.mkt-prow-pill{display:flex;align-items:center;justify-content:center;color:var(--ip-blue);background:var(--card-2)}',
      '.mkt-pick-list{overflow-y:auto;padding:8px}',
      '.mkt-pick-item{display:flex;align-items:center;gap:12px;padding:8px 11px;border-radius:11px;cursor:pointer;transition:background .12s}',
      '.mkt-pick-item:hover{background:var(--halo)}',
      '.mkt-pick-item.added{opacity:.45;pointer-events:none}',
      '.mkt-pick-img{width:40px;height:40px;border-radius:9px;background:#fff center/contain no-repeat;border:1px solid var(--line);flex-shrink:0}',
      '.mkt-pick-nm{flex:1;min-width:0}',
      '.mkt-pick-nm b{display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-pick-nm span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
      '.mkt-pick-pr{font-size:13px;font-weight:700;color:var(--c-mint);flex-shrink:0}',
      '.mkt-pick-sortie{flex-shrink:0;font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ip-blue);background:var(--halo);border-radius:999px;padding:3px 8px;margin-right:2px;white-space:nowrap}',
      '.mkt-pick-sortie.marge{color:var(--c-mint);background:color-mix(in srgb,var(--c-mint) 12%,#fff)}',
      '.mkt-modal{position:fixed;inset:0;z-index:120;background:rgba(16,19,28,.45);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.mkt-modal.open{opacity:1;pointer-events:auto}',
      '.mkt-dialog{width:min(900px,96vw);max-height:92vh;background:var(--card);border-radius:20px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.mkt-modal.open .mkt-dialog{transform:scale(1)}',
      '.mkt-mtop{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.85)}',
      '.mkt-mtt{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;flex:1}',
      '.mkt-mtt svg{color:var(--ip-blue)}',
      '.mkt-mx{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.16s var(--ease)}',
      '.mkt-mx:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.mkt-mscroll{overflow-y:auto;overflow-x:hidden;padding:24px;background:#EBEEF4;flex:1}',
      '.mkt-mholder{margin:0 auto;overflow:hidden;border-radius:8px;box-shadow:0 14px 44px rgba(16,19,28,.2)}',
      '.mkt-msheet{width:794px;transform-origin:top left;background:#fff}',
    ].join('');
    document.head.appendChild(s);
  }
})();
