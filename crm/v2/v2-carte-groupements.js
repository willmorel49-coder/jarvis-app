/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Carte Groupements (pages.carteGrp)
   Filtre UN groupement → carte + liste de TES clients (vert, en avant)
   et prospects (ambre, discrets) de ce groupement. Données : PHARMA_FR.
   Module isolé : réutilise vendor/leaflet + pharma-fr-data.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var CB = '?v=20260716g';   // bumpé au déploiement (aligné index.html)

  var D = null, map = null, layer = null, markers = {}, sel = '', GIDX = null;
  // Clients : vert par segment, GROS + contour = ressortent. Prospects : ambre discret.
  var SEG_COL = { 'Client A': '#0B6E43', 'Client B': '#16A34A', 'Client C': '#4FB87E' };
  var PROSPECT_COL = '#F59E0B';

  // ── loaders (repris de v2-carte.js) ──
  function css(h) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); }
  function jsl(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function () { cb('err'); }; document.head.appendChild(s); }
  function ensureLeaflet(cb) {
    var V = 'vendor/leaflet/';
    if (window.L) { cb(); return; }
    css(V + 'leaflet.css' + CB); jsl(V + 'leaflet.js' + CB, function () {});
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.L) { clearInterval(iv); cb(); }
      else if (Date.now() - t0 > 15000) { clearInterval(iv); cb('err'); }
    }, 100);
  }
  function ensureData(cb) {
    if (window.PHARMA_FR) { cb(); return; }
    var done = false, fin = function (e) { if (!done) { done = true; cb(e); } };
    var s = document.createElement('script'); s.src = 'pharma-fr-data.js' + CB;
    s.onload = function () { fin(window.PHARMA_FR ? null : 'err'); };
    s.onerror = function () { fin('err'); };
    document.head.appendChild(s);
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.PHARMA_FR) { clearInterval(iv); fin(null); }
      else if (Date.now() - t0 > 25000) { clearInterval(iv); fin('err'); }
    }, 150);
  }

  function isClient(p) { return (D.seg[p[4]] || '').indexOf('Client') === 0; }
  function isProspect(p) { return D.seg[p[4]] === 'Prospect'; }
  function grpName(p) { return D.grp[p[3]] || ''; }
  function llOK(p) { return typeof p[0] === 'number' && typeof p[1] === 'number' && (p[0] || p[1]); }
  function commOf(p) { return p[5] ? (D.comm[p[5]] || '') : ''; }
  function segOf(p) { return D.seg[p[4]] || ''; }

  // ── RÉCONCILIATION WML (vérité client) — MÊME règle que v2-carte.js reconcileWithWml ──
  // Un client = officine dont l'id (p[13]) est dans WML_OFFICINES. Sinon → prospect.
  // Le groupement du client vient de WML (o.groupement). Sans ça, le seg brut de PHARMA_FR
  // est FAUX (ex. Pharmavie 153 au lieu de 12). Idempotent (flag D._wmlRecon).
  function reconcile() {
    if (!D || D._wmlRecon) return;
    var W = window.WML_OFFICINES; if (!W || !W.length) return;
    var segIdx = {}; for (var s = 0; s < D.seg.length; s++) segIdx[D.seg[s]] = s;
    function ensureSeg(l) { if (segIdx[l] == null) { D.seg.push(l); segIdx[l] = D.seg.length - 1; } return segIdx[l]; }
    var iA = ensureSeg('Client A'), iB = ensureSeg('Client B'), iC = ensureSeg('Client C'), iPro = ensureSeg('Prospect');
    var canon = function (x) { return String(x || '').normalize ? String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '') : String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var grpIdx = {}; for (var g = 0; g < D.grp.length; g++) grpIdx[canon(D.grp[g])] = g;
    function ensureGrp(nm) { var k = canon(nm); if (grpIdx[k] == null) { D.grp.push(nm); grpIdx[k] = D.grp.length - 1; } return grpIdx[k]; }
    var wml = {}; W.forEach(function (o) { if (o && o.id) wml[String(o.id).replace(/[^0-9]/g, '')] = o; });
    D.p.forEach(function (p) {
      var o = wml[String(p[13] || '').replace(/[^0-9]/g, '')];
      if (o) {
        var ca = p[12] || 0;
        p[4] = ca >= 40000 ? iA : (ca >= 12000 ? iB : iC);
        var gr = o.groupement && String(o.groupement).trim();
        if (gr && gr !== '—') p[3] = ensureGrp(gr);
      } else if (D.seg[p[4]] !== 'Prospect') {
        p[4] = iPro;
      }
    });
    D._wmlRecon = true;
  }

  // Index groupement -> { c: nbClients, pr: nbProspects, pts: [indices] }
  function buildIndex() {
    GIDX = {};
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i], g = grpName(p);
      if (!g || g === '—') continue;
      var e = GIDX[g] || (GIDX[g] = { c: 0, pr: 0, pts: [] });
      e.pts.push(i);
      if (isClient(p)) e.c++; else if (isProspect(p)) e.pr++;
    }
  }

  // ── Fiche détaillée groupement (contacts, dirigeants…) depuis GRP_PROSPECTS ──
  var GD = null;   // norm(nom) -> détails
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function buildGD() { GD = {}; var A = window.GRP_PROSPECTS || []; for (var i = 0; i < A.length; i++) { if (A[i] && A[i].nom) GD[norm(A[i].nom)] = A[i]; } }
  function ensureDetails(cb) {
    if (window.GRP_PROSPECTS) { buildGD(); cb(); return; }
    var s = document.createElement('script'); s.src = '../groupements-data.js' + CB;
    s.onload = function () { buildGD(); cb(); };
    s.onerror = function () { GD = {}; cb(); };
    document.head.appendChild(s);
  }
  function details(name) { return GD ? GD[norm(name)] : null; }
  function frow(k, v) { return '<div class="cg-f-row"><span class="cg-f-k">' + k + '</span><span class="cg-f-v">' + v + '</span></div>'; }
  function ficheHtml(name) {
    var e = GIDX[name] || { c: 0, pr: 0, pts: [] };
    var d = details(name);
    var tot = e.pts.length;
    var gq = encodeURIComponent(name + ' groupement pharmacie');
    var h = '<div class="cg-fiche">';
    h += '<div class="cg-f-nm">' + esc(name) + (d && d.statut ? ' <span class="cg-f-st st-' + esc(d.statut) + '">' + esc(d.statut) + '</span>' : '') + '</div>';
    h += '<div class="cg-f-stats">' +
      '<div class="cg-f-stat"><b>' + e.c + '</b><span>clients</span></div>' +
      '<div class="cg-f-stat"><b>' + e.pr + '</b><span>prospects</span></div>' +
      '<div class="cg-f-stat"><b>' + tot + '</b><span>sur la carte</span></div>' +
      (d && d.nbAdherents ? '<div class="cg-f-stat"><b>' + esc(d.nbAdherents) + '</b><span>adhérents</span></div>' : '') +
      (d && d.nbLabos ? '<div class="cg-f-stat"><b>' + esc(d.nbLabos) + '</b><span>labos</span></div>' : '') +
      '</div>';
    if (d) {
      var c = '';
      if (d.site) c += frow('Site', '<a href="' + esc(d.site) + '" target="_blank" rel="noopener">' + esc(d.site.replace(/^https?:\/\//, '').replace(/\/$/, '')) + ' ↗</a>');
      if (d.email) c += frow('Email', '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a>');
      if (d.tel) c += frow('Tél', '<a href="tel:' + esc(String(d.tel).replace(/[^0-9+]/g, '')) + '">' + esc(d.tel) + '</a>');
      if (d.adresse) c += frow('Adresse', esc(d.adresse));
      if (d.siren) c += frow('SIREN', esc(d.siren) + ' <a class="cg-f-ext" href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(d.siren) + '" target="_blank" rel="noopener">fiche ↗</a>');
      if (d.alliance) c += frow('Alliance', esc(d.alliance));
      if (d.cotisation) c += frow('Cotisation', esc(d.cotisation));
      if (c) h += '<div class="cg-f-block">' + c + '</div>';
      if (d.dirs && d.dirs.length) {
        h += '<div class="cg-f-sub">Dirigeants</div><div class="cg-f-dirs">';
        h += d.dirs.map(function (x) { return '<div class="cg-f-dir"><b>' + esc(x.nom) + '</b>' + (x.fn ? '<span>' + esc(x.fn) + '</span>' : '') + '</div>'; }).join('');
        h += '</div>';
        if (d.telDir || d.emailDir) {
          var dd = '';
          if (d.telDir) dd += '<a href="tel:' + esc(String(d.telDir).replace(/[^0-9+]/g, '')) + '">' + esc(d.telDir) + '</a>';
          if (d.emailDir) dd += (dd ? ' · ' : '') + '<a href="mailto:' + esc(d.emailDir) + '">' + esc(d.emailDir) + '</a>';
          h += '<div class="cg-f-dircontact">' + dd + '</div>';
        }
      }
    } else {
      h += '<div class="cg-f-nodata">Contacts détaillés non renseignés pour ce groupement.</div>';
    }
    h += '<div class="cg-f-links"><a href="https://www.google.com/search?q=' + gq + '" target="_blank" rel="noopener">Rechercher ↗</a></div>';
    h += '</div>';
    return h;
  }

  // ── styles ──
  function injectCss() {
    if (document.getElementById('v2-cg-css')) return;
    var st = document.createElement('style'); st.id = 'v2-cg-css';
    st.textContent =
      '.cg-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 22px;background:var(--card);border-bottom:1px solid var(--line)}' +
      '.cg-sel{font-family:var(--font);font-size:14.5px;font-weight:700;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:11px;padding:10px 13px;outline:none;cursor:pointer;min-width:min(340px,72vw)}' +
      '.cg-sel:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}' +
      '.cg-count{display:flex;gap:8px;align-items:center;font-family:var(--font);font-size:13px;font-weight:700}' +
      '.cg-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px}' +
      '.cg-pill .d{width:9px;height:9px;border-radius:50%}' +
      '.cg-pill.cl{background:rgba(11,110,67,.12);color:#0B6E43}.cg-pill.cl .d{background:#16A34A;box-shadow:0 0 0 2px #fff}' +
      '.cg-pill.pr{background:rgba(245,158,11,.14);color:#B45309}.cg-pill.pr .d{background:#F59E0B}' +
      '.cg-split{display:flex;height:calc(100vh - 172px);min-height:420px}' +
      '.cg-map{flex:1;min-width:0;background:#EAEEF3}' +
      '.cg-list{width:360px;max-width:42vw;overflow-y:auto;background:var(--paper);border-left:1px solid var(--line)}' +
      '.cg-grp{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:800;padding:12px 16px 6px;position:sticky;top:0;background:var(--paper);z-index:1}' +
      '.cg-row{display:flex;gap:10px;align-items:flex-start;padding:10px 16px;border-bottom:1px solid var(--line);cursor:pointer;transition:background .12s}' +
      '.cg-row:hover{background:var(--card)}' +
      '.cg-dot{width:11px;height:11px;border-radius:50%;margin-top:3px;flex-shrink:0}' +
      '.cg-nm{font-size:13.5px;font-weight:700;color:var(--ip-ink);line-height:1.25}' +
      '.cg-meta{font-size:11.5px;color:var(--muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap}' +
      '.cg-tag{font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px}' +
      '.cg-tag.cl{background:rgba(11,110,67,.14);color:#0B6E43}.cg-tag.pr{background:rgba(245,158,11,.16);color:#B45309}' +
      '.cg-tel{color:var(--ip-blue);font-weight:700;text-decoration:none}' +
      '.cg-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px}' +
      '.cg-load{display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:var(--muted);font-size:14px}' +
      '.cg-pop b{display:block;font-size:13px;color:#10131C}.cg-pop .a{font-size:11.5px;color:#5b6270;margin:2px 0}' +
      '.cg-pop .t{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-top:3px}' +
      // ── Fiche détaillée groupement ──
      '.cg-fiche{padding:16px 16px 14px;border-bottom:1px solid var(--line);background:var(--card)}' +
      '.cg-f-nm{font-family:var(--font);font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.cg-f-st{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px;border-radius:999px;background:var(--card-2);color:var(--muted)}' +
      '.cg-f-st.st-prospect{background:rgba(245,158,11,.14);color:#B45309}.cg-f-st.st-client{background:rgba(11,110,67,.12);color:#0B6E43}' +
      '.cg-f-stats{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}' +
      '.cg-f-stat{flex:1;min-width:64px;background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:9px 6px;text-align:center}' +
      '.cg-f-stat b{display:block;font-size:19px;font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums;line-height:1.1}' +
      '.cg-f-stat span{display:block;font-size:10.5px;color:var(--muted);margin-top:2px;font-weight:600}' +
      '.cg-f-block{margin-top:12px;display:flex;flex-direction:column;gap:0}' +
      '.cg-f-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--line-2)}' +
      '.cg-f-k{flex:none;width:78px;font-size:11.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;padding-top:1px}' +
      '.cg-f-v{flex:1;min-width:0;font-size:13px;color:var(--ip-ink);word-break:break-word}' +
      '.cg-f-v a{color:var(--ip-blue);font-weight:600;text-decoration:none}.cg-f-v a:hover{text-decoration:underline}' +
      '.cg-f-ext{font-size:11px;font-weight:600}' +
      '.cg-f-sub{margin-top:14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}' +
      '.cg-f-dirs{margin-top:6px;display:flex;flex-direction:column;gap:6px}' +
      '.cg-f-dir{background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:7px 11px}' +
      '.cg-f-dir b{display:block;font-size:13px;font-weight:700;color:var(--ip-ink)}' +
      '.cg-f-dir span{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}' +
      '.cg-f-dircontact{margin-top:6px;font-size:12.5px}.cg-f-dircontact a{color:var(--ip-blue);font-weight:600;text-decoration:none}' +
      '.cg-f-nodata{margin-top:10px;font-size:12.5px;color:var(--muted);font-style:italic}' +
      '.cg-f-links{margin-top:12px}.cg-f-links a{font-size:12px;font-weight:700;color:var(--ip-blue);text-decoration:none}' +
      '@media(max-width:820px){.cg-split{flex-direction:column;height:auto}.cg-map{height:52vh;min-height:320px}.cg-list{width:auto;max-width:none;border-left:none;border-top:1px solid var(--line);max-height:none}}';
    document.head.appendChild(st);
  }

  // ── options du sélecteur : tous les groupements, triés A→Z, avec compteurs ──
  function selectOptions() {
    var byNorm = {};
    for (var g in GIDX) byNorm[norm(g)] = g;
    if (window.GRP_PROSPECTS) {
      for (var i = 0; i < GRP_PROSPECTS.length; i++) {
        var nm = GRP_PROSPECTS[i].nom;
        if (nm && !(norm(nm) in byNorm)) byNorm[norm(nm)] = nm;
      }
    }
    var names = Object.keys(byNorm).map(function (k) { return byNorm[k]; }).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    var o = '<option value="">— Choisis un groupement —</option>';
    for (var j = 0; j < names.length; j++) {
      var g2 = names[j], e = GIDX[g2];
      var lbl = e ? (g2 + ' (' + e.c + ' client' + (e.c > 1 ? 's' : '') + ' · ' + e.pr + ' prospect' + (e.pr > 1 ? 's' : '') + ')') : (g2 + ' · fiche');
      o += '<option value="' + esc(g2) + '"' + (g2 === sel ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }
    return o;
  }

  function counts() {
    var e = sel && GIDX[sel];
    if (!e) return '';
    return '<span class="cg-pill cl"><span class="d"></span>' + e.c + ' client' + (e.c > 1 ? 's' : '') + '</span>' +
           '<span class="cg-pill pr"><span class="d"></span>' + e.pr + ' prospect' + (e.pr > 1 ? 's' : '') + '</span>';
  }

  function popupHtml(p) {
    var addr = (p[7] || '') + (p[8] ? ' · ' + p[8] : '');
    var st = segOf(p), cl = isClient(p);
    var tel = (p[9] || '').replace(/[^0-9+]/g, '');
    var q = encodeURIComponent((p[6] || '') + ' ' + (p[7] || '') + ' ' + (p[8] || ''));
    return '<div class="cg-pop">' +
      '<b>' + esc(p[6] || 'Pharmacie') + '</b>' +
      (p[10] ? '<div class="a">' + esc(p[10]) + '</div>' : '') +
      (addr ? '<div class="a">' + esc(addr) + '</div>' : '') +
      '<span class="t ' + (cl ? 'cl' : 'pr') + '" style="background:' + (cl ? 'rgba(11,110,67,.14);color:#0B6E43' : 'rgba(245,158,11,.16);color:#B45309') + '">' + esc(st) + '</span>' +
      (commOf(p) ? ' <span class="t" style="background:#EEF1F6;color:#5b6270">' + esc(commOf(p)) + '</span>' : '') +
      (tel ? '<div style="margin-top:4px"><a class="cg-tel" href="tel:' + esc(tel) + '">' + esc(p[9]) + '</a></div>' : '') +
      '<div style="margin-top:5px"><a class="cg-tel" href="https://www.google.com/maps/search/?api=1&query=' + q + '" target="_blank" rel="noopener">Google Maps ↗</a></div>' +
    '</div>';
  }

  // ── dessin de la carte pour le groupement `sel` ──
  function draw() {
    if (!map) return;
    if (layer) { layer.clearLayers(); } else { layer = window.L.layerGroup().addTo(map); }
    markers = {};
    var e = sel && GIDX[sel];
    if (!e) return;
    var pts = e.pts, bounds = [], j, i, p;
    // prospects d'abord (dessous), clients ensuite (dessus → ils ressortent)
    var pros = [], clis = [];
    for (j = 0; j < pts.length; j++) { p = D.p[pts[j]]; if (!llOK(p)) continue; (isClient(p) ? clis : pros).push(pts[j]); }
    function add(idx, big) {
      p = D.p[idx];
      var cl = isClient(p);
      var m = window.L.circleMarker([p[0], p[1]], {
        radius: big ? 8 : 5,
        fillColor: cl ? (SEG_COL[segOf(p)] || '#16A34A') : PROSPECT_COL,
        color: cl ? '#ffffff' : PROSPECT_COL,
        weight: cl ? 2 : 1,
        opacity: cl ? 1 : 0.75,
        fillOpacity: cl ? 0.98 : 0.6
      });
      m.bindPopup(popupHtml(p), { className: 'cg-pop-wrap' });
      m.addTo(layer);
      markers[idx] = m;
      bounds.push([p[0], p[1]]);
    }
    for (j = 0; j < pros.length; j++) add(pros[j], false);
    for (j = 0; j < clis.length; j++) add(clis[j], true);
    if (bounds.length) { try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 }); } catch (ex) {} }
    setTimeout(function () { try { map.invalidateSize(); } catch (ex) {} }, 60);
  }

  // ── liste latérale : clients (par CA décroissant) puis prospects (A→Z) ──
  function rowHtml(idx) {
    var p = D.p[idx], cl = isClient(p);
    var tel = (p[9] || '').replace(/[^0-9+]/g, '');
    return '<div class="cg-row" onclick="V2.cgFocus(' + idx + ')">' +
      '<span class="cg-dot" style="background:' + (cl ? (SEG_COL[segOf(p)] || '#16A34A') : PROSPECT_COL) + (cl ? ';box-shadow:0 0 0 2px #fff,0 0 0 3px ' + (SEG_COL[segOf(p)] || '#16A34A') : '') + '"></span>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="cg-nm">' + esc(p[6] || 'Pharmacie') + '</div>' +
        '<div class="cg-meta">' +
          '<span class="cg-tag ' + (cl ? 'cl' : 'pr') + '">' + esc(segOf(p)) + '</span>' +
          (p[7] ? '<span>' + esc(p[7]) + '</span>' : '') +
          (commOf(p) ? '<span>· ' + esc(commOf(p)) + '</span>' : '') +
        '</div>' +
        (tel ? '<div class="cg-meta"><a class="cg-tel" href="tel:' + esc(tel) + '" onclick="event.stopPropagation()">' + esc(p[9]) + '</a></div>' : '') +
      '</div>' +
    '</div>';
  }
  function listHtml() {
    if (!sel) return '<div class="cg-empty">Choisis un groupement dans le menu pour voir sa fiche, tes clients et prospects.</div>';
    var fiche = ficheHtml(sel);
    var e = GIDX[sel];
    if (!e) return fiche + '<div class="cg-empty">Aucune pharmacie de ce groupement dans la base (fiche informative).</div>';
    var clis = [], pros = [], j, p;
    for (j = 0; j < e.pts.length; j++) { p = D.p[e.pts[j]]; (isClient(p) ? clis : pros).push(e.pts[j]); }
    clis.sort(function (a, b) { return (D.p[b][12] || 0) - (D.p[a][12] || 0); });
    pros.sort(function (a, b) { return String(D.p[a][6] || '').localeCompare(String(D.p[b][6] || ''), 'fr'); });
    var h = '';
    if (clis.length) { h += '<div class="cg-grp">Clients · ' + clis.length + '</div>' + clis.map(rowHtml).join(''); }
    if (pros.length) { h += '<div class="cg-grp">Prospects · ' + pros.length + '</div>' + pros.map(rowHtml).join(''); }
    if (!clis.length && !pros.length) h = '<div class="cg-empty">Aucune pharmacie géolocalisée pour ce groupement.</div>';
    return fiche + h;
  }

  // ── API ──
  V2.cgSelect = function (name) {
    sel = name || '';
    var cn = document.getElementById('cg-count'); if (cn) cn.innerHTML = counts();
    var ls = document.getElementById('cg-list'); if (ls) ls.innerHTML = listHtml();
    draw();
  };
  V2.cgFocus = function (idx) {
    var p = D && D.p[idx]; if (!p || !map || !llOK(p)) return;
    map.setView([p[0], p[1]], Math.max(map.getZoom(), 14), { animate: true });
    var m = markers[idx]; if (m) m.openPopup();
  };

  V2.pages.carteGrp = {
    render: function (root, param) {
      injectCss();
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      var tabs = V2.grpSpaceTabs ? V2.grpSpaceTabs('carte') : '';
      root.innerHTML = top + tabs +
        '<div class="cg-bar">' +
          '<select class="cg-sel" id="cg-sel" onchange="V2.cgSelect(this.value)">' +
            '<option value="">Chargement des groupements…</option></select>' +
          '<span class="cg-count" id="cg-count"></span>' +
        '</div>' +
        '<div class="cg-split">' +
          '<div class="cg-map" id="cg-map"><div class="cg-load"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
          '<div class="cg-list" id="cg-list"><div class="cg-empty">Choisis un groupement dans le menu.</div></div>' +
        '</div>';
      if (param) sel = String(param);
      ensureData(function (e1) {
        if (e1) { var mp = document.getElementById('cg-map'); if (mp) mp.innerHTML = '<div class="cg-empty">Données indisponibles. Réessaie.</div>'; return; }
        D = window.PHARMA_FR; reconcile(); buildIndex();
        ensureDetails(function () {
        // défaut : le groupement avec le plus de clients (carte non vide d'emblée)
        if (!sel) {
          var best = '', bc = -1;
          for (var g in GIDX) { if (GIDX[g].c > bc) { bc = GIDX[g].c; best = g; } }
          sel = best;
        }
        var s = document.getElementById('cg-sel'); if (s) s.innerHTML = selectOptions();
        var cn = document.getElementById('cg-count'); if (cn) cn.innerHTML = counts();
        var ls = document.getElementById('cg-list'); if (ls) ls.innerHTML = listHtml();
        ensureLeaflet(function (e2) {
          var mp = document.getElementById('cg-map');
          if (e2) { if (mp) mp.innerHTML = '<div class="cg-empty">Carte indisponible.</div>'; return; }
          if (mp) mp.innerHTML = '';
          map = window.L.map('cg-map', { zoomControl: true, attributionControl: false }).setView([46.6, 2.4], 6);
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
          draw();
        });
        });
      });
    }
  };
})();
