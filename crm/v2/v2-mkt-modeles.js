/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Marketing — les 7 modèles de fiches « La lumière » (choix de Will, 20/10/2026)
   La construction des prix OPSO, en bleu Intégral : en-tête bleu lumineux à grand angle arrondi,
   panneaux blancs qui mordent sur l'en-tête, prix net en pastille éclairée.
   Dessinés et vérifiés dans l'atelier ~/jarvis-preuves/mkt-modeles-2026-10-20/atelier/ (collection c1).
   Contrat : render(it, ctx, forPdf, edit) → une racine de 794 px ; ctx = les aides de v2-mkt.js (mktCtx).
   Styles en ligne uniquement. Données : it et ctx seulement.
   ⚠️ « vitrine » est lue par les patients : aucun prix, aucun CIP, quel que soit l'interrupteur.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var V2 = window.V2 = window.V2 || {};

  var INK = '#0B1B3F', MUT = '#586890', P1 = '#EEF3FD', P2 = '#DFE9FA', P3 = '#C9DBF7', LINE = '#E3EBFA';
  var FONT = 'Satoshi,Inter,Arial,sans-serif', NUM = 'font-variant-numeric:tabular-nums;';
  var SHADOW = 'box-shadow:0 12px 32px rgba(11,27,63,.10),0 2px 6px rgba(11,27,63,.06);';
  var PAGE = 1123, LAST = 1120, BITE = 34;
  function cap1(H) { return LAST - (H - BITE) - 112; }   // place utile sous l'en-tête (pied 56 + légende 48 + marge)
  var CAPN = LAST - 86 - 112;

  function eclaircir(hex) {   // mélange avec 24 % de blanc : le bleu plus clair du dégradé
    hex = String(hex || '#0050E6').replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    var n = parseInt(hex, 16); if (isNaN(n)) return '#3F80F2';
    var m = function (c) { return Math.round(c + (255 - c) * 0.24); };
    return 'rgb(' + m((n >> 16) & 255) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }
  function env(def, it, ctx, forPdf, edit) {
    var th = it.theme || {}, acc = th.accent || def.accent;
    return { def: def, it: it, ctx: ctx, esc: ctx.esc, za: ctx.zoneAttrs, edit: !forPdf && edit === true, forPdf: !!forPdf,
      acc: acc, dark: eclaircir(acc), showPrice: th.showPrice !== false, showImg: th.showImg !== false,
      bg: th.bg || '#FFFFFF', prods: it.products || [],
      title: (it.title && it.title.trim()) ? it.title.trim() : def.label };
  }
  function cut(E, s, n) {
    s = String(s || '');
    if (E.edit || s.length <= n) return s;
    var c = s.slice(0, n), k = c.lastIndexOf(' ');
    return (k > n * 0.6 ? c.slice(0, k) : c).replace(/[\s,;:(\-]+$/, '') + '…';
  }
  function nm(E, p, n) { return E.esc(cut(E, p.name || (E.edit ? '' : 'Produit'), n || 60)); }
  function meta(E, p, withCip) {
    var a = [];
    if (p.brand) a.push(E.esc(p.brand));
    if (p.cat) a.push(E.esc(p.cat));
    if (withCip && p.cip) a.push('CIP ' + E.esc(p.cip));
    return a.join(' · ');
  }
  function eur(E, p) { return p.price > 0 ? E.ctx.fmtEur(p.price) : (E.edit ? '' : '—'); }

  /* ── prix : tarif barré discret, prix net dans une pastille éclairée ── */
  function tarif(E, p, size) {
    var px = E.ctx.prix(p);
    if (!E.showPrice || !(px.ppht > 0 && px.pct > 0)) return '';
    return '<span style="' + NUM + 'font-size:' + (size || 11) + 'px;font-weight:500;color:' + MUT + ';text-decoration:line-through;white-space:nowrap">' + E.ctx.fmtEur(px.ppht) + '</span>';
  }
  function net(E, p, i, size, padX) {
    if (!E.showPrice) return '';
    var padY = Math.round(size * 0.2);
    return '<span style="display:inline-block;' + NUM + 'font-size:' + size + 'px;font-weight:800;line-height:1.1;color:' + INK + ';padding:' + padY + 'px ' + (padX || Math.round(size * 0.55)) + 'px;border-radius:999px;' +
      'background:linear-gradient(180deg,#FFFFFF 0%,' + P2 + ' 100%);border:1px solid ' + P3 + ';box-shadow:0 3px 9px rgba(0,80,230,.16);white-space:nowrap">' +
      '<span' + E.za(E.edit, 'price', 'Prix net HT', { i: i, ph: '0,00 €' }) + '>' + eur(E, p) + '</span></span>';
  }
  function legend(E) {
    if (!E.showPrice) return '';
    var sw = function (bg, bd) { return '<span style="display:inline-block;width:26px;height:13px;border-radius:999px;background:' + bg + ';border:1px solid ' + bd + ';margin-right:10px;vertical-align:-2px"></span>'; };
    return '<div style="flex:none;display:flex;gap:34px;margin:18px 40px 0;font-size:11px;line-height:1.35;color:' + MUT + '">' +
      '<div>' + sw('#fff', P3) + '<b style="color:' + INK + ';font-weight:700">Tarif grossiste (PPHT)</b><br><span style="margin-left:36px">prix habituel, hors taxes</span></div>' +
      '<div>' + sw('linear-gradient(180deg,#fff,' + P2 + ')', P3) + '<b style="color:' + INK + ';font-weight:700">Prix net HT</b><br><span style="margin-left:36px">le prix de cette feuille, hors taxes</span></div></div>';
  }

  /* ── photo : tuile blanche à ombre douce ; sans photo, pictogramme ; photos masquées → '' ── */
  function photo(E, p, i, w, h, pad, r) {
    if (!E.showImg) return '';
    var img = E.ctx.prodImg(p, E.forPdf);
    var inner = img
      ? '<img data-imgprod' + (E.forPdf ? ' crossorigin="anonymous"' : '') + ' src="' + E.esc(img) + '" style="display:block;width:100%;height:100%;object-fit:contain">'
      : E.ctx.placeholderSvg(Math.round(Math.min(w, h) * 0.34));
    return '<div style="flex:none;box-sizing:border-box;width:' + w + 'px;height:' + h + 'px;padding:' + pad + 'px;border-radius:' + (r == null ? 18 : r) + 'px;background:#FFFFFF;border:1px solid ' + LINE + ';' +
      'box-shadow:0 14px 30px rgba(11,27,63,.12),0 2px 5px rgba(11,27,63,.06);display:flex;align-items:center;justify-content:center"' +
      E.za(E.edit, 'photo', 'Photo · cliquer pour changer', { i: i, click: true }) + '>' + inner + '</div>';
  }
  function halo(inner, style, spot) {
    return '<div style="position:relative;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(ellipse at ' + (spot || '50% 46%') + ',' + P2 + ' 0%,' + P1 + ' 46%,#FFFFFF 78%);' + (style || '') + '">' + inner + '</div>';
  }

  /* ── titre, accroche, pied ── */
  function titre(E, size, extra) {
    return '<div style="font-size:' + size + 'px;font-weight:800;letter-spacing:-.025em;line-height:1.04;color:#FFFFFF;' + (extra || '') + '"' +
      E.za(E.edit, 'title', 'Titre', { light: true, ph: E.def.label }) + '>' + E.esc(E.edit ? (E.it.title || '') : E.title) + '</div>';
  }
  function accroche(E, size, color, extra) {
    var a = (E.it.accroche || '').trim();
    if (!E.edit && !a) return '';
    return '<div style="font-size:' + size + 'px;font-weight:500;line-height:1.35;color:' + color + ';' + (extra || '') + '"' +
      E.za(E.edit, 'accroche', 'Accroche', { light: color === '#FFFFFF', ph: 'Accroche / message (facultatif)' }) + '>' + E.esc(a) + '</div>';
  }
  function tuileLogo(E, w) {
    return '<div style="display:inline-block;background:#FFFFFF;border-radius:16px;padding:9px 11px;box-shadow:0 6px 18px rgba(0,20,80,.22)">' +
      '<img src="' + E.esc(E.ctx.logo) + '"' + (E.forPdf ? ' crossorigin="anonymous"' : '') + ' alt="Intégral Pharma" style="display:block;width:' + w + 'px;height:auto"></div>';
  }
  function pillDate(E) {
    return '<span style="display:inline-block;font-size:11px;font-weight:700;color:' + INK + ';padding:5px 13px;border-radius:999px;background:linear-gradient(180deg,#FFFFFF,' + P2 + ');border:1px solid ' + P3 + ';box-shadow:0 3px 8px rgba(0,20,80,.18)">' + E.esc(E.ctx.dateStr) + '</span>';
  }
  function entete(E, o) {   // o : h (hauteur fixe), size (titre), lite (logo à gauche du titre), pills (html)
    var R = o.radius || 120;
    var anneaux = '<div style="position:absolute;right:-70px;top:-130px;width:360px;height:360px;border-radius:50%;border:1.5px solid rgba(255,255,255,.20)"></div>' +
      '<div style="position:absolute;right:-150px;top:-200px;width:520px;height:520px;border-radius:50%;border:1.5px solid rgba(255,255,255,.12)"></div>';
    var textes = '<div style="position:relative;max-width:' + (o.max || 560) + 'px;min-width:0">' + titre(E, o.size || 44) +
        accroche(E, o.accSize || 15, '#FFFFFF', 'margin-top:8px;max-width:480px') +
        (o.pills ? '<div style="margin-top:' + (o.pillsTop || 12) + 'px;display:flex;gap:10px;align-items:center">' + o.pills + '</div>' : '') + '</div>';
    var contenu = o.lite
      ? '<div style="position:relative;display:flex;align-items:center;gap:26px">' + tuileLogo(E, 96) + textes + '</div>'
      : '<div style="position:relative;display:flex;align-items:center;gap:16px;margin-bottom:14px">' + tuileLogo(E, 96) +
          '<span style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#FFFFFF">Intégral Pharma</span></div>' + textes;
    return '<div style="flex:none;position:relative;z-index:1;box-sizing:border-box;height:' + o.h + 'px;padding:' + (o.padTop || 26) + 'px 40px 0;border-radius:0 0 0 ' + R + 'px;overflow:hidden;color:#FFFFFF;' +
        'background:radial-gradient(circle at 97% -2%,rgba(255,255,255,.6) 0,rgba(255,255,255,.14) 11%,rgba(255,255,255,0) 22%),linear-gradient(125deg,' + E.acc + ' 0%,' + E.acc + ' ' + (o.lite ? 86 : 66) + '%,' + E.dark + ' 100%)">' + anneaux + contenu + '</div>';
  }
  function nbTxt(E) { var n = E.prods.length; return n + ' produit' + (n > 1 ? 's' : ''); }
  function pillsStd(E) {
    return pillDate(E) + '<span style="font-size:12px;font-weight:500;color:#FFFFFF">' + nbTxt(E) + '</span>';
  }
  function teteSuite(E, n, N) {
    return '<div style="flex:none;position:relative;z-index:1;box-sizing:border-box;height:64px;padding:0 40px;display:flex;align-items:center;justify-content:space-between;border-radius:0 0 0 44px;' +
      'background:radial-gradient(circle at 90% 0%,#FFFFFF 0,rgba(255,255,255,0) 40%),linear-gradient(135deg,' + P2 + ' 0%,' + P1 + ' 100%);margin-bottom:22px">' +
      '<span style="font-size:14px;font-weight:800;color:' + INK + '">' + E.esc(E.title) + '</span>' +
      '<span style="font-size:11px;font-weight:700;color:' + MUT + '">' + E.esc(E.ctx.dateStr) + ' · ' + n + ' / ' + N + '</span></div>';
  }
  function pied(E, n, N, forcerTexte) {
    var d = E.showPrice ? 'Prix nets HT indicatifs' : '';
    var f = (E.it.footer && E.it.footer.trim()) ? E.esc(E.it.footer.trim()) : E.esc(d);
    return '<div style="flex:none;margin:auto 40px 0;padding:14px 0 26px;border-top:1px solid ' + P2 + ';display:flex;justify-content:space-between;gap:20px;font-size:11px;color:' + MUT + '">' +
      '<span>Intégral Pharma, groupe de grossistes-répartiteurs</span>' +
      '<span style="text-align:right">' +
        ((E.edit || f) ? '<span style="display:inline-block;min-width:110px"' + E.za(E.edit, 'footer', 'Mentions', { ph: d || 'Mention en pied (facultatif)' }) + '>' + (E.edit ? E.esc((E.it.footer || '').trim()) : f) + '</span>' : '') +
        (N > 1 ? '<span style="margin-left:14px;font-weight:700;color:' + INK + '">' + n + ' / ' + N + '</span>' : '') + '</span></div>';
  }
  function pageShell(E, content, last) {
    return '<div style="position:relative;box-sizing:border-box;width:794px;height:' + LAST + 'px;display:flex;flex-direction:column;' +
      'background:radial-gradient(circle at 0% 100%,' + P1 + ' 0,rgba(238,243,253,0) 46%) ' + E.bg + ';' + (last ? '' : 'page-break-after:always;break-after:page;') + '">' + content + '</div>';
  }
  function racine(E, pages) {
    return '<div style="font-family:' + FONT + ';width:794px;box-sizing:border-box;background:' + E.bg + ';color:' + INK + ';position:relative">' + pages.join('') + '</div>';
  }
  function corps(html, bite, fill) {   // zone de contenu : mord sur l'en-tête de BITE px ; fill : prend toute la hauteur libre
    return '<div style="' + (fill ? 'flex:1 1 auto;min-height:0;display:flex;flex-direction:column;margin-bottom:14px;' : 'flex:none;') + 'position:relative;z-index:2;margin:' + (bite ? -BITE : 0) + 'px 40px 0">' + html + '</div>';
  }
  function panneau(html, style) {
    return '<div style="background:#FFFFFF;border-radius:24px;' + SHADOW + (style || '') + '">' + html + '</div>';
  }
  function vide(E) {
    return E.edit
      ? panneau('<div style="padding:64px 36px;text-align:center"><div style="font-size:20px;font-weight:800;color:' + INK + '">La feuille attend vos produits.</div><div style="font-size:14px;color:' + MUT + ';margin-top:8px">Choisissez-les dans le catalogue du groupe : ils prennent place ici, avec leur photo.</div></div>')
      : panneau('<div style="padding:50px;text-align:center;font-size:14px;color:' + MUT + '">Aucun produit.</div>');
  }

  /* ── pagination par blocs de hauteur connue ── */
  function paginer(blocks, cap1, capN, gh, gcost) {   // gh : hauteur d'un bandeau de groupe (continuation), gcost : marge de panneau
    var pages = [[]], used = 0, cap = cap1, lastG = null;
    blocks.forEach(function (b) {
      var need = b.h + (b.gstart ? gcost : 0) + (b.gstart && b.next ? b.next : 0);
      if (used + need > cap && pages[pages.length - 1].length) { pages.push([]); used = 0; cap = capN; lastG = null; }
      var pg = pages[pages.length - 1];
      if (b.row && gh && b.g !== lastG && !b.gstart && !pg.length) { pg.push({ cont: true, g: b.g, h: gh }); used += gh + gcost; }
      pg.push(b); used += b.h + (b.gstart ? gcost : 0); lastG = b.g;
    });
    return pages;
  }
  function assembler(E, paginated, tete1, bodyOf, opts) {
    opts = opts || {};
    var N = paginated.length;
    return racine(E, paginated.map(function (blocks, n) {
      var last = n === N - 1;
      var head = n === 0 ? tete1 : teteSuite(E, n + 1, N);
      var content = head + corps(bodyOf(blocks, n), n === 0) + (last && opts.legend !== false ? legend(E) : '') + pied(E, n + 1, N);
      return pageShell(E, content, last);
    }));
  }

  /* ── ligne de liste ── */
  function ligne(E, p, i, o) {
    o = o || {};
    var h = o.h || 68, t = o.thumb || 52;
    var th = E.showImg ? photo(E, p, i, t, t, 5, 12) : '';
    var num = o.num ? '<span style="flex:none;width:26px;font-size:' + (o.numSize || 14) + 'px;font-weight:800;color:' + E.acc + ';' + NUM + '">' + (((o.seq == null ? i : o.seq) < 9) ? '0' : '') + ((o.seq == null ? i : o.seq) + 1) + '</span>' : '';
    var nouveau = o.nouveau ? '<div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:' + E.acc + ';margin-bottom:4px">Nouveau</div>' : '';
    return '<div data-prod style="box-sizing:border-box;height:' + h + 'px;display:flex;align-items:center;gap:14px;padding:0 22px;' + (o.first ? '' : 'border-top:1px solid ' + LINE + ';') + 'page-break-inside:avoid;break-inside:avoid">' +
      num + th +
      '<div style="flex:1;min-width:0">' + nouveau +
        '<div style="font-size:' + (o.nameSize || 14) + 'px;font-weight:800;line-height:1.2;color:' + INK + ';max-height:' + Math.round((o.nameSize || 14) * 2.45) + 'px;overflow:hidden"' + E.za(E.edit, 'pname', 'Nom', { i: i, quiet: true }) + '>' + nm(E, p, 58) + '</div>' +
        '<div style="font-size:11px;font-weight:500;color:' + MUT + ';margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (o.nouveauMini ? '<b style="font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:' + E.acc + '">Nouveau</b> · ' : '') + meta(E, p, true) + '</div></div>' +
      (E.showPrice ? '<div style="flex:none;display:flex;align-items:center;gap:12px">' + tarif(E, p, 12) + net(E, p, i, o.priceSize || 16) + '</div>' : '') +
      '</div>';
  }
  function bandeauRayon(E, label, count, cont) {
    return '<div style="box-sizing:border-box;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;' +
      'background:linear-gradient(100deg,' + P2 + ' 0%,' + P1 + ' 60%,#FFFFFF 100%)">' +
      '<span style="font-size:14px;font-weight:800;color:' + INK + '">' + E.esc(label) + (cont ? ' <span style="font-weight:500;color:' + MUT + '">· suite</span>' : '') + '</span>' +
      (count ? '<span style="font-size:11px;font-weight:700;color:' + MUT + '">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>' : '') + '</div>';
  }
  function groupes(E) {
    var order = [], map = {};
    E.prods.forEach(function (p, i) { var c = (p.cat || '').trim() || 'Autres'; if (!map[c]) { map[c] = []; order.push(c); } map[c].push({ p: p, i: i }); });
    return order.map(function (c) { return { name: c, items: map[c] }; });
  }
  /* liste simple paginée (un seul panneau par page) */
  function listeSimple(E, o) {
    var rowH = o.h || 68;
    var blocks = E.prods.map(function (p, i) { return { row: true, h: rowH, p: p, i: i }; });
    var pages = paginer(blocks, o.cap1, CAPN);
    return assembler(E, pages, o.tete, function (blks) {
      return panneau(blks.map(function (b, k) { return ligne(E, b.p, b.i, { h: rowH, thumb: o.thumb, first: k === 0, nouveau: o.nouveau, num: o.num }); }).join(''), 'overflow:hidden;');
    });
  }

  /* ── cellule de grille (vedette « autres », rayons, vitrine) ── */
  function cellule(E, p, i, o) {   // o : tileH, nameSize, noPrice, pad
    var tile = E.showImg ? photo(E, p, i, '100%', o.tileH, 8, 14) : '';
    if (tile) tile = tile.replace('width:100%px', 'width:100%').replace('flex:none;', 'flex:none;align-self:stretch;');
    return '<div data-prod style="box-sizing:border-box;height:' + o.h + 'px;padding:' + (o.pad || 12) + 'px;display:flex;flex-direction:column;gap:' + (o.gap || 9) + 'px;page-break-inside:avoid;break-inside:avoid;min-width:0">' +
      tile +
      '<div style="flex:1;min-width:0"><div style="font-size:' + (o.nameSize || 12) + 'px;font-weight:800;line-height:1.2;color:' + INK + ';max-height:' + Math.round((o.nameSize || 12) * 2.45) + 'px;overflow:hidden"' + E.za(E.edit, 'pname', 'Nom', { i: i, quiet: true }) + '>' + nm(E, p, 50) + '</div>' +
      '<div style="font-size:10.5px;font-weight:500;color:' + MUT + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + E.esc(p.brand || '') + '</div></div>' +
      (o.noPrice || !E.showPrice ? '' : '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;height:' + (o.priceH || 30) + 'px">' + (o.noTarif ? '<span></span>' : (tarif(E, p, 10.5) || '<span></span>')) + net(E, p, i, o.priceSize || 14) + '</div>') +
      '</div>';
  }

  /* ───────────── les sept modèles ───────────── */

  function chiffrePhotoMasquee(E, p, i, size) {   // photos masquées : le nom devient l'image
    return '<div style="font-size:' + size + 'px;font-weight:800;letter-spacing:-.02em;line-height:1.08;color:' + INK + ';text-align:center;padding:0 30px"' + E.za(E.edit, 'pname', 'Nom du produit', { i: i, ph: 'Produit' }) + '>' + nm(E, p, 70) + '</div>';
  }

  /* promo */
  function promoHero(E) {
    var p = E.prods[0], i = 0, px = E.ctx.prix(p);
    var tile = photo(E, p, 0, 440, 440, 24, 28);
    var gauche = E.showImg ? tile : '';
    var nom = '<div style="font-size:' + (E.showImg ? 30 : 46) + 'px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom du produit', { i: 0, ph: 'Produit' }) + '>' + nm(E, p, 70) + '</div>';
    var info = '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:12px">' +
      (p.cat ? '<div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:' + E.acc + '">' + E.esc(p.cat) + '</div>' : '') + nom +
      '<div style="font-size:14px;font-weight:500;color:' + MUT + '">' + E.esc(p.brand || '') + '</div>' +
      (p.cip ? '<div style="font-size:11px;font-weight:500;color:' + MUT + ';' + NUM + '">CIP ' + E.esc(p.cip) + '</div>' : '') + '</div>';
    var haut = panneau(halo('<div style="display:flex;gap:34px;align-items:center;width:100%;box-sizing:border-box;min-height:' + (E.showImg ? 0 : 380) + 'px;padding:34px 30px">' + gauche + info + '</div>', 'border-radius:24px;flex:1;width:100%;', '22% 50%'), 'flex:1;display:flex;');
    var slab = E.showPrice
      ? '<div style="margin-top:18px;border-radius:30px;padding:38px 40px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(180deg,#FFFFFF 0%,' + P2 + ' 100%);border:1px solid ' + P3 + ';box-shadow:0 16px 36px rgba(0,80,230,.16)">' +
          '<div><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + MUT + '">Tarif grossiste (PPHT)</div>' +
            '<div style="margin-top:6px;">' + (tarif(E, p, 22) || '<span style="font-size:14px;color:' + MUT + '">Prix net uniquement</span>') + '</div></div>' +
          '<div style="text-align:right"><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + INK + '">Prix net HT</div>' +
            '<div style="' + NUM + 'font-size:76px;font-weight:800;letter-spacing:-.035em;line-height:1;color:' + INK + ';margin-top:2px"' + E.za(E.edit, 'price', 'Prix net HT', { i: 0, ph: '0,00 €' }) + '>' + eur(E, p) + '</div></div></div>'
      : '';
    return '<div style="flex:1;display:flex;flex-direction:column;min-height:0">' + haut + slab + '</div>';
  }
  function carteProduit(E, p, i, mode, tileS, aireH, etroit) {   // mode 'v' (verticale) ou 'h' (horizontale)
    var nom = '<div style="font-size:' + (mode === 'h' && !etroit ? 17 : 15) + 'px;font-weight:800;line-height:1.18;letter-spacing:-.01em;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom', { i: i, ph: 'Produit', quiet: true }) + '>' + nm(E, p, 52) + '</div>';
    var prix = E.showPrice ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:12px">' + (tarif(E, p, 12) || '<span></span>') + net(E, p, i, mode === 'h' ? 20 : 18) + '</div>' : '';
    var txt = '<div style="flex:1;min-width:0;display:flex;flex-direction:column;box-sizing:border-box;padding:' + (mode === 'h' ? '20px 22px 20px 0' : '4px 20px 20px') + '">' + nom +
      '<div style="font-size:11px;font-weight:500;color:' + MUT + ';margin-top:6px">' + meta(E, p, false) + '</div>' +
      (p.cip ? '<div style="font-size:11px;font-weight:500;color:' + MUT + ';margin-top:3px;' + NUM + '">CIP ' + E.esc(p.cip) + '</div>' : '') + prix + '</div>';
    if (mode === 'h') {
      var t = photo(E, p, i, tileS, tileS, 12, 20);
      return '<div data-prod style="grid-column:1/-1;background:#FFFFFF;border-radius:24px;' + SHADOW + 'display:flex;align-items:stretch;gap:22px;padding:' + (t ? '20px 0 20px 20px' : '0 0 0 22px') + ';page-break-inside:avoid;break-inside:avoid">' + t + txt + '</div>';
    }
    var t2 = E.showImg ? halo(photo(E, p, i, tileS, tileS, 12, 20), 'height:' + aireH + 'px;border-radius:24px 24px 0 0;margin-bottom:14px;') : '<div style="height:20px"></div>';
    return '<div data-prod style="background:#FFFFFF;border-radius:24px;' + SHADOW + 'display:flex;flex-direction:column;overflow:hidden;page-break-inside:avoid;break-inside:avoid">' + t2 + txt + '</div>';
  }
  function promoCartes(E) {
    var n = E.prods.length, out = '', cols;
    var tileS = n <= 2 ? 380 : 172, aire = n <= 2 ? 450 : 212;
    var cartes = E.prods.map(function (p, i) {
      if (n >= 5) return carteProduit(E, p, i, 'h', 170).replace('grid-column:1/-1;', 'grid-column:span 1;');
      if (n === 3 && i === 2) return carteProduit(E, p, i, 'h', 170);
      return carteProduit(E, p, i, 'v', tileS, aire);
    });
    if (n >= 5) {   // cartes horizontales : une seule colonne de largeur pleine serait trop haute, on garde 2 colonnes étroites
      cartes = E.prods.map(function (p, i) { return carteProduit(E, p, i, 'h', 150, 0, true).replace('grid-column:1/-1;', ''); });
    }
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch' + (n >= 5 ? ';flex:1;grid-auto-rows:1fr' : '') + '">' + cartes.join('') + '</div>';
  }
  function modPromo(E) {
    var n = E.prods.length;
    var pills = pillsStd(E);
    if (n >= 7) return listeSimple(E, { tete: entete(E, { h: 214, size: 38, pills: pills, lite: true }), cap1: cap1(214), thumb: 52 });
    var tete = entete(E, { h: 292, size: 44, pills: pills });
    var body = n === 0 ? vide(E) : n === 1 ? promoHero(E) : promoCartes(E);
    return racine(E, [pageShell(E, tete + corps(body, true, n === 1 || n >= 5) + legend(E) + pied(E, 1, 1), true)]);
  }

  /* nouveauté : marque typographique « — NOUVEAU » */
  function nouveauMarque(E) {
    return '<div style="display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:' + E.acc + '"><span style="display:inline-block;width:30px;height:2px;background:' + E.acc + '"></span>Nouveau</div>';
  }
  function nouveauGrand(E, p, i) {
    var gauche = E.showImg ? halo(photo(E, p, i, 190, 190, 14, 24), 'flex:none;width:262px;align-self:stretch;border-radius:24px 0 0 24px;', '50% 50%') : '';
    var droite = '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:18px 28px;gap:8px">' +
      nouveauMarque(E) +
      '<div style="font-size:23px;font-weight:800;letter-spacing:-.015em;line-height:1.14;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom du produit', { i: i, ph: 'Produit' }) + '>' + nm(E, p, 60) + '</div>' +
      '<div style="font-size:12px;font-weight:700;color:' + INK + '">' + E.esc(p.brand || '') + (p.cat ? ' <span style="font-weight:500;color:' + MUT + '">· ' + E.esc(p.cat) + '</span>' : '') + '</div>' +
      (p.cip ? '<div style="font-size:11px;font-weight:500;color:' + MUT + ';' + NUM + '">CIP ' + E.esc(p.cip) + '</div>' : '') +
      (E.showPrice ? '<div style="display:flex;align-items:center;gap:14px;margin-top:8px">' + net(E, p, i, 26) + tarif(E, p, 13) + '</div>' : '') + '</div>';
    var inv = i % 2 === 1;
    var h = '<div data-prod style="display:flex;align-items:stretch;min-height:226px;background:#FFFFFF;border-radius:24px;' + SHADOW + 'page-break-inside:avoid;break-inside:avoid">' +
      (inv ? droite + (gauche ? gauche.replace('border-radius:24px 0 0 24px', 'border-radius:0 24px 24px 0') : '') : gauche + droite) + '</div>';
    return h;
  }
  function modNouveaute(E) {
    var n = E.prods.length, pills = pillsStd(E);
    if (n >= 7) return listeSimple(E, { tete: entete(E, { h: 214, size: 38, pills: pills, lite: true }), cap1: cap1(214), thumb: 52, nouveauMini: true });
    var tete = entete(E, { h: 280, size: 42, pills: pills });
    var body;
    if (n === 0) body = vide(E);
    else if (n <= 3) body = '<div style="display:flex;flex-direction:column;gap:18px">' + E.prods.map(function (p, i) { return nouveauGrand(E, p, i); }).join('') + '</div>';
    else body = panneau(E.prods.map(function (p, i) { return ligne(E, p, i, { h: 122, thumb: 92, nameSize: 17, priceSize: 20, first: i === 0, nouveau: true }); }).join(''), 'overflow:hidden;');
    return racine(E, [pageShell(E, tete + corps(body, true) + legend(E) + pied(E, 1, 1), true)]);
  }

  /* sélection : liste éditée, groupée par rayon */
  function modSelection(E) {
    var G = groupes(E), pills = pillsStd(E), rowH = 72, thumbS = 54;
    var nR = E.prods.length, slack = cap1(214) - G.length * 64 - nR * 72;
    if (nR && slack > 0) { rowH = 72 + Math.min(Math.floor(slack / nR), 40); if (rowH >= 90) thumbS = 66; }
    var blocks = [];
    var seq = 0;
    G.forEach(function (g) {
      blocks.push({ gh: true, g: g.name, h: 46, gstart: true, next: rowH, count: g.items.length });
      g.items.forEach(function (it) { blocks.push({ row: true, g: g.name, h: rowH, p: it.p, i: it.i, seq: seq++ }); });
    });
    var tete = entete(E, { h: 214, size: 38, pills: pills, lite: true, radius: 140 });
    var c1 = cap1(214), capN = CAPN;
    if (!blocks.length) return racine(E, [pageShell(E, tete + corps(vide(E), true) + pied(E, 1, 1), true)]);
    var pages = paginer(blocks, c1, capN, 46, 18);
    return assembler(E, pages, tete, function (blks) {
      var out = '', cur = null, buf = '', rows = 0;
      function flush() { if (cur !== null) out += '<div style="background:#FFFFFF;border-radius:24px;' + SHADOW + 'overflow:hidden;margin-bottom:18px">' + buf + '</div>'; buf = ''; rows = 0; }
      blks.forEach(function (b) {
        if (b.gh || b.cont) { flush(); cur = b.g; buf = bandeauRayon(E, b.g, b.gh ? b.count : 0, !!b.cont); return; }
        buf += ligne(E, b.p, b.i, { h: rowH, thumb: thumbS, first: rows === 0, num: true, seq: b.seq, nameSize: 15, numSize: 16 }); rows++;
      });
      flush();
      return out;
    });
  }

  /* fiche : sobre et complète */
  function ligneSpec(E, lab, val, forte, first) {
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:17px 0;' + (first ? '' : 'border-top:1px solid ' + LINE + ';') + '">' +
      '<span style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + MUT + '">' + lab + '</span>' +
      '<span style="font-size:' + (forte ? 16 : 14) + 'px;font-weight:' + (forte ? 800 : 700) + ';color:' + INK + ';text-align:right;' + NUM + '">' + val + '</span></div>';
  }
  function modFiche(E) {
    var n = E.prods.length;
    if (n >= 2) {
      var pills = pillsStd(E);
      var blocks = E.prods.map(function (p, i) { return { row: true, h: 60, p: p, i: i }; });
      var tete2 = entete(E, { h: 200, size: 36, pills: pills, lite: true, radius: 90 });
      var pages = paginer(blocks, cap1(200), CAPN);
      return assembler(E, pages, tete2, function (blks) {
        return panneau(blks.map(function (b, k) { return ligne(E, b.p, b.i, { h: 60, thumb: 44, first: k === 0, nameSize: 13, priceSize: 14 }); }).join(''), 'overflow:hidden;');
      });
    }
    var tete = entete(E, { h: 200, size: 36, pills: pillDate(E), lite: true, radius: 90 });
    var body;
    if (n === 0) body = vide(E);
    else {
      var p = E.prods[0], px = E.ctx.prix(p);
      var visuel = E.showImg ? halo(photo(E, p, 0, 400, 400, 20, 28), 'flex:1;min-height:420px;border-radius:24px 24px 0 0;') : halo(chiffrePhotoMasquee(E, p, 0, 52), 'flex:1;min-height:300px;border-radius:24px 24px 0 0;');
      var nom = E.showImg ? '<div style="font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:' + INK + ';padding:22px 34px 8px"' + E.za(E.edit, 'pname', 'Nom du produit', { i: 0, ph: 'Produit' }) + '>' + nm(E, p, 70) + '</div>' : '<div style="height:10px"></div>';
      var specs = ligneSpec(E, 'Laboratoire', E.esc(p.brand || '—'), false, true) + ligneSpec(E, 'Rayon', E.esc(p.cat || '—'), false) + ligneSpec(E, 'Code CIP', E.esc(p.cip || p.ean || '—'), false);
      if (E.showPrice) {
        if (px.ppht > 0 && px.pct > 0) specs += ligneSpec(E, 'Tarif grossiste (PPHT)', tarif(E, p, 16), false);
        specs += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 2px;border-top:1px solid ' + LINE + '"><span style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + INK + '">Prix net HT</span>' + net(E, p, 0, 32) + '</div>';
      }
      body = '<div data-prod style="flex:1;display:flex;flex-direction:column;background:#FFFFFF;border-radius:24px;' + SHADOW + 'page-break-inside:avoid;break-inside:avoid">' + visuel + nom + '<div style="padding:0 34px 26px">' + specs + '</div></div>';
    }
    return racine(E, [pageShell(E, tete + corps(body, true, true) + pied(E, 1, 1), true)]);
  }

  /* vedette : le produit occupe plus de la moitié de la page */
  function vedetteHero(E, compact) {
    var p = E.prods[0], px = E.ctx.prix(p), S = compact === 'mid' ? 340 : compact ? 250 : 560;
    var aire = E.showImg
      ? halo(photo(E, p, 0, S, S, compact ? 16 : 28, compact ? 24 : 36), (compact === 'mid' ? 'height:410px;' : compact ? 'height:300px;' : 'flex:1;min-height:640px;') + 'border-radius:30px;', '50% 44%')
      : halo(chiffrePhotoMasquee(E, p, 0, compact ? 34 : 60), (compact === 'mid' ? 'height:360px;' : compact ? 'height:260px;' : 'flex:1;min-height:560px;') + 'border-radius:30px;');
    var carte = '<div style="position:relative;z-index:3;margin:' + (compact ? '-44px 26px 0 150px' : '-70px 24px 0 110px') + ';background:#FFFFFF;border-radius:26px;' + SHADOW + 'padding:' + (compact ? '20px 26px' : '26px 32px') + ';display:flex;align-items:center;justify-content:space-between;gap:24px">' +
      '<div style="min-width:0;flex:1">' +
        (p.cat ? '<div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:' + E.acc + ';margin-bottom:6px">' + E.esc(p.cat) + '</div>' : '') +
        (E.showImg ? '<div style="font-size:' + (compact ? 22 : 28) + 'px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom du produit', { i: 0, ph: 'Produit' }) + '>' + nm(E, p, 70) + '</div>' : '') +
        '<div style="font-size:13px;font-weight:500;color:' + MUT + ';margin-top:6px">' + E.esc(p.brand || '') + (p.cip ? ' · CIP ' + E.esc(p.cip) : '') + '</div></div>' +
      (E.showPrice ? '<div style="flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px">' + tarif(E, p, 13) + net(E, p, 0, compact ? 28 : 36) + '</div>' : '') + '</div>';
    return '<div data-prod style="' + (compact ? '' : 'flex:1;display:flex;flex-direction:column;') + 'page-break-inside:avoid;break-inside:avoid">' + panneau(aire, 'border-radius:30px;' + (compact ? '' : 'flex:1;display:flex;')) + carte + '</div>';
  }
  function modVedette(E) {
    var n = E.prods.length, pills = pillDate(E);
    var tete = entete(E, { h: 206, size: 36, pills: pills, lite: true, radius: 150 });
    if (n <= 1) return racine(E, [pageShell(E, tete + corps(n ? vedetteHero(E, false) : vide(E), true, true) + legend(E) + pied(E, 1, 1), true)]);
    var autres = E.prods.slice(1), C = autres.length <= 5 ? 5 : 4, cellH = C === 5 ? 220 : 238, tileH = C === 5 ? 104 : 112;
    var rowsA = [];
    for (var k = 0; k < autres.length; k += C) rowsA.push({ row: true, h: cellH, items: autres.slice(k, k + C), start: k + 1 });
    var mid = true, heroH = 494;
    var pages = paginer(rowsA, cap1(206) - heroH, CAPN);
    return assembler(E, pages, tete, function (blks, pn) {
      var grille = '<div style="display:grid;grid-template-columns:repeat(' + C + ',1fr);gap:14px;' + (pn === 0 ? 'margin-top:24px;' : '') + '">' +
        blks.map(function (b) { return b.items.map(function (p, q) { return '<div style="background:#FFFFFF;border-radius:22px;' + SHADOW + '">' + cellule(E, p, b.start + q, { h: cellH, tileH: tileH, nameSize: 12, noTarif: C === 5, priceSize: C === 5 ? 13 : 14 }) + '</div>'; }).join(''); }).join('') + '</div>';
      return (pn === 0 ? vedetteHero(E, 'mid') : '') + grille;
    });
  }

  /* vitrine : affiche lue par les patients, jamais de prix */
  function modVitrine(E) {
    var n = E.prods.length;
    var tete = '<div style="flex:none;position:relative;z-index:1;box-sizing:border-box;height:292px;padding:40px 44px 0;border-radius:0 0 0 150px;overflow:hidden;color:#FFFFFF;' +
      'background:radial-gradient(circle at 98% -2%,rgba(255,255,255,.6) 0,rgba(255,255,255,.14) 11%,rgba(255,255,255,0) 22%),linear-gradient(125deg,' + E.acc + ' 0%,' + E.acc + ' 90%,' + E.dark + ' 100%)">' +
      '<div style="position:absolute;right:-80px;top:-140px;width:400px;height:400px;border-radius:50%;border:1.5px solid rgba(255,255,255,.20)"></div>' +
      '<div style="position:absolute;right:-170px;top:-220px;width:580px;height:580px;border-radius:50%;border:1.5px solid rgba(255,255,255,.12)"></div>' +
      '<div style="position:relative;max-width:620px">' + titre(E, 62, 'letter-spacing:-.03em;line-height:1') + accroche(E, 18, '#FFFFFF', 'margin-top:18px;max-width:520px') + '</div></div>';
    var foot = '<div style="flex:none;margin:auto 40px 0;padding:14px 0 26px;border-top:1px solid ' + P2 + ';display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:11px;color:' + MUT + '">' +
      '<span style="display:flex;align-items:center;gap:14px"><img src="' + E.esc(E.ctx.logo) + '"' + (E.forPdf ? ' crossorigin="anonymous"' : '') + ' alt="Intégral Pharma" style="display:block;width:96px;height:auto"><span>Document fourni par Intégral Pharma</span></span>' +
      '<span' + E.za(E.edit, 'footer', 'Mentions', { ph: 'Mention en pied (facultatif)' }) + '>' + E.esc((E.it.footer || '').trim()) + '</span></div>';
    var conseil = '<div style="flex:none;margin:22px 40px 0;border-radius:999px;padding:20px 30px;text-align:center;font-size:27px;font-weight:800;letter-spacing:-.015em;color:' + INK + ';background:linear-gradient(180deg,#FFFFFF,' + P2 + ');border:1px solid ' + P3 + ';box-shadow:0 12px 28px rgba(0,80,230,.14)">Demandez conseil à votre pharmacien</div>';
    var bodyH;
    if (n === 0) bodyH = vide(E);
    else if (n === 1) {
      var p = E.prods[0];
      var aire = E.showImg ? halo(photo(E, p, 0, 470, 470, 26, 40), 'height:560px;border-radius:30px 30px 0 0;', '50% 46%') : halo(chiffrePhotoMasquee(E, p, 0, 60), 'height:500px;border-radius:30px 30px 0 0;');
      bodyH = '<div data-prod style="background:#FFFFFF;border-radius:30px;' + SHADOW + 'page-break-inside:avoid;break-inside:avoid">' + aire +
        '<div style="padding:22px 34px 26px">' +
        (E.showImg ? '<div style="font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom du produit', { i: 0, ph: 'Produit' }) + '>' + nm(E, p, 70) + '</div>' : '') +
        '<div style="font-size:15px;font-weight:500;color:' + MUT + ';margin-top:8px">' + E.esc(p.brand || '') + (p.cat ? ' · ' + E.esc(p.cat) : '') + '</div></div></div>';
    } else if (n <= 3) {
      bodyH = '<div style="display:grid;grid-template-columns:repeat(' + n + ',1fr);gap:18px">' + E.prods.map(function (p, i) {
        var t = E.showImg ? halo(photo(E, p, i, n === 2 ? 300 : 206, n === 2 ? 300 : 206, 16, 26), 'height:' + (n === 2 ? 380 : 270) + 'px;border-radius:26px 26px 0 0;') : '';
        return '<div data-prod style="background:#FFFFFF;border-radius:26px;' + SHADOW + 'page-break-inside:avoid;break-inside:avoid">' + t +
          '<div style="padding:20px 22px 24px"><div style="font-size:' + (n === 2 ? 22 : 18) + 'px;font-weight:800;line-height:1.14;letter-spacing:-.015em;color:' + INK + '"' + E.za(E.edit, 'pname', 'Nom', { i: i, ph: 'Produit' }) + '>' + nm(E, p, 60) + '</div>' +
          '<div style="font-size:12px;font-weight:500;color:' + MUT + ';margin-top:7px">' + E.esc(p.brand || '') + '</div></div></div>';
      }).join('') + '</div>';
    } else {
      var C = 3, cellH = 272, rowsA = [];
      for (var k = 0; k < n; k += C) rowsA.push({ row: true, h: cellH, items: E.prods.slice(k, k + C), start: k });
      var pages = paginer(rowsA, cap1(292) - 50, CAPN - 50);
      var N = pages.length;
      return racine(E, pages.map(function (blks, pn) {
        var grille = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">' + blks.map(function (b) { return b.items.map(function (p, q) {
          return '<div style="background:#FFFFFF;border-radius:22px;' + SHADOW + '">' + cellule(E, p, b.start + q, { h: cellH, tileH: 160, nameSize: 14, noPrice: true }) + '</div>'; }).join(''); }).join('') + '</div>';
        var last = pn === N - 1;
        return pageShell(E, (pn === 0 ? tete : teteSuite(E, pn + 1, N)) + corps(grille, pn === 0) + (last ? conseil : '') + foot, last);
      }));
    }
    return racine(E, [pageShell(E, tete + corps(bodyH, true) + conseil + foot, true)]);
  }

  /* rayons : une carte par rayon, grille de cases dessous */
  function modRayons(E) {
    var G = groupes(E), n = E.prods.length, pills = pillsStd(E);
    var C = n <= 2 ? 2 : n <= 6 ? 3 : 4;
    var gap = 14, cw = Math.floor((714 - (C - 1) * gap) / C);
    var dense = n > 12, bandH = dense ? 42 : 46;
    var tileH = C === 2 ? 250 : C === 3 ? 150 : dense ? 70 : 100, cellH = dense ? tileH + (E.showPrice ? 105 : 78) : tileH + (E.showPrice ? 110 : 80);
    // rangées : remplissage « premier qui rentre » pour ne pas laisser de trous
    var restant = G.map(function (g) { return { g: g, span: Math.min(g.items.length, C) }; }), rows = [];
    while (restant.length) {
      var row = [], libre = C, k = 0;
      while (k < restant.length && libre > 0) {
        if (restant[k].span <= libre) { row.push(restant[k]); libre -= restant[k].span; restant.splice(k, 1); } else k++;
      }
      rows.push(row);
    }
    var blocks = rows.map(function (row) {
      var maxLines = Math.max.apply(null, row.map(function (r) { return Math.ceil(r.g.items.length / r.span); }));
      return { row: true, h: bandH + maxLines * cellH + gap, cards: row, lines: maxLines };
    });
    var tete = entete(E, { h: 214, size: 36, pills: pills, lite: true, radius: 130 });
    if (!blocks.length) return racine(E, [pageShell(E, tete + corps(vide(E), true) + pied(E, 1, 1), true)]);
    var pages = paginer(blocks, cap1(214) + 48, CAPN + 48);
    var lp = pages[pages.length - 1], lu = lp.reduce(function (a, b) { return a + b.h; }, 0);   // la légende ne figure que sur la dernière page
    if (lp.length > 1 && lu > (pages.length === 1 ? cap1(214) : CAPN)) pages.push([lp.pop()]);
    return assembler(E, pages, tete, function (blks) {
      return blks.map(function (b) {
        return '<div style="display:flex;gap:' + gap + 'px;align-items:stretch;margin-bottom:' + gap + 'px">' + b.cards.map(function (r) {
          var w = r.span * cw + (r.span - 1) * gap, s = r.span;
          var cells = r.g.items.map(function (it) { return cellule(E, it.p, it.i, { h: cellH, tileH: tileH, nameSize: C === 2 ? 15 : 12, priceSize: C === 2 ? 20 : 14, pad: dense ? 10 : 12, gap: dense ? 6 : 9, priceH: dense ? 28 : 30 }); }).join('');
          return '<div style="flex:none;width:' + w + 'px;box-sizing:border-box;background:#FFFFFF;border-radius:22px;' + SHADOW + 'overflow:hidden">' +
            '<div style="box-sizing:border-box;height:' + bandH + 'px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px;background:linear-gradient(100deg,' + P2 + ' 0%,' + P1 + ' 70%,#FFFFFF 100%)">' +
              '<span style="font-size:12.5px;font-weight:800;line-height:1.15;color:' + INK + '">' + E.esc(r.g.name) + '</span>' +
              (s > 1 ? '<span style="flex:none;font-size:11px;font-weight:700;color:' + MUT + '">' + r.g.items.length + '</span>' : '') + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(' + s + ',1fr)">' + cells + '</div></div>';
        }).join('') + '</div>';
      }).join('');
    });
  }

  var DEFS = [
    { k: 'promo', label: 'Promo de la semaine', court: 'Promo', accent: '#0050E6', desc: 'Bandeau lumineux, grand prix net en pastille', f: modPromo },
    { k: 'nouveaute', label: 'Nouveauté', court: 'Nouveauté', accent: '#0050E6', desc: 'Marque « Nouveau » en lettres, lignes alternées', f: modNouveaute },
    { k: 'selection', label: 'Sélection du mois', court: 'Sélection', accent: '#0050E6', desc: 'Liste numérotée, un panneau par rayon', f: modSelection },
    { k: 'fiche', label: 'Fiche produit simple', court: 'Fiche simple', accent: '#0050E6', desc: 'Photo en haut, caractéristiques en dessous', f: modFiche },
    { k: 'vedette', label: 'Produit vedette', court: 'Vedette', accent: '#0050E6', desc: 'Le produit sur plus de la moitié de la page', f: modVedette },
    { k: 'vitrine', label: 'Affiche vitrine', court: 'Vitrine', accent: '#0050E6', desc: 'Affiche pour les patients, sans aucun prix', f: modVitrine },
    { k: 'rayons', label: 'Sélection par rayon', court: 'Par rayon', accent: '#0050E6', desc: 'Une carte par rayon, grille de cases', f: modRayons }
  ];
  V2.mktModeles = {
    id: 'c1', nom: 'c1 · La lumière',
    parti: 'La construction des prix OPSO en bleu Intégral : en-tête lumineux à grand angle arrondi, panneaux blancs qui mordent sur l\'en-tête, prix net en pastille éclairée.',
    modeles: DEFS.map(function (d) {
      return { k: d.k, label: d.label, court: d.court, accent: d.accent, desc: d.desc,
        render: function (it, ctx, forPdf, edit) { return d.f(env(d, it, ctx, forPdf, edit)); } };
    })
  };
})();
