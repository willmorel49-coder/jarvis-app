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
  var CB = '?v=20260717i';   // bumpé au déploiement (aligné index.html)

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
    s.onload = function () { if (V2.loadFiles) V2.loadFiles(['pharmafrca']); fin(window.PHARMA_FR ? null : 'err'); };
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
      var p = D.p[i], g = canonGrp(grpName(p));   // nom canonique → fusionne les doublons
      if (!g || g === '—') continue;
      var e = GIDX[g] || (GIDX[g] = { c: 0, pr: 0, pts: [] });
      e.pts.push(i);
      if (isClient(p)) e.c++; else if (isProspect(p)) e.pr++;
    }
  }

  // ── Fiche détaillée groupement (contacts, dirigeants…) depuis GRP_PROSPECTS ──
  var GD = null;   // canon(nom) -> détails
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  // Nom canonique d'un groupement : fusionne les variantes (Essentiel/Essentiels, casse, ponctuation…)
  // via une table d'alias (window.GRP_ALIAS produite par les agents) + un seed minimal.
  var GRP_ALIAS_SEED = { 'essentielspharma': 'Essentiel Pharma', 'essentielpharma': 'Essentiel Pharma' };
  function canonGrp(name) { var k = norm(name); var A = window.GRP_ALIAS || {}; return A[k] || GRP_ALIAS_SEED[k] || name; }
  function buildGD() { GD = {}; var A = window.GRP_PROSPECTS || []; for (var i = 0; i < A.length; i++) { if (A[i] && A[i].nom) GD[norm(canonGrp(A[i].nom))] = A[i]; } }
  function ensureDetails(cb) {
    if (window.GRP_PROSPECTS) { buildGD(); cb(); return; }
    var s = document.createElement('script'); s.src = '../groupements-data.js' + CB;
    s.onload = function () { buildGD(); cb(); };
    s.onerror = function () { GD = {}; cb(); };
    document.head.appendChild(s);
  }
  function details(name) { return GD ? GD[norm(canonGrp(name))] : null; }
  function infoOf(name) { var I = window.GRP_INFO; return I ? I[norm(canonGrp(name))] : null; }   // description + contacts + actus (scrapés)
  function frow(k, v) { return '<div class="cg-f-row"><span class="cg-f-k">' + k + '</span><span class="cg-f-v">' + v + '</span></div>'; }
  function eur(v) { return (v || 0) >= 1000 ? Math.round(v / 1000) + ' k€' : Math.round(v || 0) + ' €'; }
  // stats clients précises d'un groupement (depuis données réconciliées) : CA, tiers, commerciaux
  function grpClientStats(pts) {
    var ca = 0, tiers = { 'Client A': 0, 'Client B': 0, 'Client C': 0 }, byComm = {}, n = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = D.p[pts[i]]; if (!isClient(p)) continue;
      n++; ca += p[12] || 0;
      var t = segOf(p); if (tiers[t] != null) tiers[t]++;
      var cm = commOf(p); if (cm) byComm[cm] = (byComm[cm] || 0) + 1;
    }
    return { n: n, ca: ca, tiers: tiers, byComm: byComm };
  }
  function ficheHtml(name) {
    var e = GIDX[name] || { c: 0, pr: 0, pts: [] };
    var d = details(name);
    var tot = e.pts.length;
    var cs = grpClientStats(e.pts);
    var pen = tot > 0 ? Math.round(e.c / tot * 100) : 0;
    var gq = encodeURIComponent(name + ' groupement pharmacie');
    var caMoy = cs.n > 0 ? cs.ca / cs.n : 0;
    var h = '<div class="cg-fiche">';
    h += '<a class="cg-f-back" onclick="V2.cgSelect(\'\')">← Tous les groupements</a>';
    h += '<div class="cg-f-nm">' + esc(name) + (d && d.statut ? ' <span class="cg-f-st st-' + esc(d.statut) + '">' + esc(d.statut) + '</span>' : '') + '</div>';
    h += '<div class="cg-f-stats">' +
      '<div class="cg-f-stat"><b>' + e.c + '</b><span>clients</span></div>' +
      '<div class="cg-f-stat"><b>' + e.pr + '</b><span>prospects</span></div>' +
      '<div class="cg-f-stat"><b>' + tot + '</b><span>sur la carte</span></div>' +
      (cs.ca > 0 ? '<div class="cg-f-stat"><b>' + eur(cs.ca) + '</b><span>CA clients</span></div>' : '') +
      (caMoy > 0 ? '<div class="cg-f-stat"><b>' + eur(caMoy) + '</b><span>CA moyen/client</span></div>' : '') +
      '<div class="cg-f-stat"><b>' + pen + '%</b><span>pénétration</span></div>' +
      (d && d.nbAdherents ? '<div class="cg-f-stat"><b>' + esc(d.nbAdherents) + '</b><span>adhérents</span></div>' : '') +
      (d && d.nbLabos ? '<div class="cg-f-stat"><b>' + esc(d.nbLabos) + '</b><span>labos</span></div>' : '') +
      '</div>';
    // Répartition clients : tiers A/B/C + par commercial
    if (cs.n > 0) {
      var tchips = '';
      if (cs.tiers['Client A']) tchips += '<span class="cg-f-tier ta">A · ' + cs.tiers['Client A'] + '</span>';
      if (cs.tiers['Client B']) tchips += '<span class="cg-f-tier tb">B · ' + cs.tiers['Client B'] + '</span>';
      if (cs.tiers['Client C']) tchips += '<span class="cg-f-tier tc">C · ' + cs.tiers['Client C'] + '</span>';
      var comms = Object.keys(cs.byComm).sort(function (a, b) { return cs.byComm[b] - cs.byComm[a]; });
      var cchips = comms.map(function (cm) { return '<span class="cg-f-comm">' + esc(cm) + ' · ' + cs.byComm[cm] + '</span>'; }).join('');
      h += '<div class="cg-f-reps">' +
        (tchips ? '<div class="cg-f-rep"><span class="cg-f-rl">Tiers</span><span class="cg-f-rc">' + tchips + '</span></div>' : '') +
        (cchips ? '<div class="cg-f-rep"><span class="cg-f-rl">Commercial</span><span class="cg-f-rc">' + cchips + '</span></div>' : '') +
        '</div>';
    }
    var inf = infoOf(name);
    // Description (scrapée)
    if (inf && inf.description) h += '<div class="cg-f-desc">' + esc(inf.description) + (inf.type ? ' <span class="cg-f-type">' + esc(inf.type) + '</span>' : '') + '</div>';
    // Contacts : info web d'abord, sinon GRP_PROSPECTS
    var g = function (k) { return (inf && inf[k]) || (d && d[k]) || ''; };
    var site = g('site'), email = g('email'), tel = g('tel'), adresse = g('adresse');
    var region = (inf && inf.region) || '', nbAdh = (inf && inf.nbAdherents) || (d && d.nbAdherents) || '';
    var c = '';
    if (site) c += frow('Site', '<a href="' + esc(/^https?:/.test(site) ? site : 'https://' + site) + '" target="_blank" rel="noopener">' + esc(String(site).replace(/^https?:\/\//, '').replace(/\/$/, '')) + ' ↗</a>');
    if (email) c += frow('Email', '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>');
    if (tel) c += frow('Tél', '<a href="tel:' + esc(String(tel).replace(/[^0-9+]/g, '')) + '">' + esc(tel) + '</a>');
    if (adresse) c += frow('Adresse', esc(adresse));
    if (region) c += frow('Région', esc(region));
    if (nbAdh) c += frow('Adhérents', esc(nbAdh));
    if (d && d.siren) c += frow('SIREN', esc(d.siren) + ' <a class="cg-f-ext" href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(d.siren) + '" target="_blank" rel="noopener">fiche ↗</a>');
    if (d && d.alliance) c += frow('Alliance', esc(d.alliance));
    if (d && d.cotisation) c += frow('Cotisation', esc(d.cotisation));
    if (c) h += '<div class="cg-f-block">' + c + '</div>';
    var dirs = (inf && inf.dirigeants && inf.dirigeants.length) ? inf.dirigeants : ((d && d.dirs) || []);
    if (dirs.length) {
      h += '<div class="cg-f-sub">Dirigeants</div><div class="cg-f-dirs">';
      h += dirs.map(function (x) { return '<div class="cg-f-dir"><b>' + esc(x.nom) + '</b>' + (x.fn ? '<span>' + esc(x.fn) + '</span>' : '') + '</div>'; }).join('');
      h += '</div>';
      if (d && (d.telDir || d.emailDir)) {
        var dd = '';
        if (d.telDir) dd += '<a href="tel:' + esc(String(d.telDir).replace(/[^0-9+]/g, '')) + '">' + esc(d.telDir) + '</a>';
        if (d.emailDir) dd += (dd ? ' · ' : '') + '<a href="mailto:' + esc(d.emailDir) + '">' + esc(d.emailDir) + '</a>';
        h += '<div class="cg-f-dircontact">' + dd + '</div>';
      }
    }
    if (!c && !dirs.length && !(inf && inf.description)) h += '<div class="cg-f-nodata">Contacts détaillés non renseignés pour ce groupement.</div>';
    // Actualités (scrapées)
    if (inf && inf.actualites && inf.actualites.length) {
      h += '<div class="cg-f-sub">Actualités</div><div class="cg-f-actus">';
      h += inf.actualites.slice(0, 6).map(function (a) {
        return '<div class="cg-f-actu"><div class="cg-f-actt">' + esc(a.titre) + '</div><div class="cg-f-acts">' + (a.date ? esc(a.date) + ' · ' : '') + esc(a.source || '') + '</div></div>';
      }).join('') + '</div>';
    }
    // Top clients du groupement (par CA)
    if (cs.n > 0) {
      var cli = e.pts.filter(function (idx) { return isClient(D.p[idx]); })
        .sort(function (a, b) { return (D.p[b][12] || 0) - (D.p[a][12] || 0); }).slice(0, 6);
      h += '<div class="cg-f-sub">Top clients (CA)</div><div class="cg-f-top">';
      h += cli.map(function (idx) {
        var p = D.p[idx], t = segOf(p).replace('Client ', ''), cm = commOf(p);
        return '<div class="cg-f-tc" onclick="V2.cgFocus(' + idx + ')">' +
          '<div class="cg-f-tcm"><b>' + esc(p[6] || 'Pharmacie') + '</b><span>' + esc(p[7] || '') + (cm ? ' · ' + esc(cm) : '') + '</span></div>' +
          '<div class="cg-f-tcr"><span class="cg-f-tt t' + t.toLowerCase() + '">' + esc(t) + '</span><b>' + eur(p[12] || 0) + '</b></div></div>';
      }).join('') + '</div>';
    }
    h += '<div class="cg-f-links"><a href="https://www.google.com/search?q=' + gq + '" target="_blank" rel="noopener">Rechercher le groupement ↗</a></div>';
    // Notes partagées par groupement (Supabase, scope 'groupement')
    if (V2.notes && V2.notes.section) h += '<div class="cg-f-notes">' + V2.notes.section('groupement', name) + '</div>';
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
      '.cg-row{position:relative}.cg-rebtn{flex:none;align-self:center;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted);font-size:15px;cursor:pointer;opacity:.55;transition:opacity .15s,border-color .15s}' +
      '.cg-row:hover .cg-rebtn{opacity:1}.cg-rebtn:hover{border-color:var(--ip-blue);color:var(--ip-blue)}' +
      '.cg-reov{position:fixed;inset:0;z-index:4000;display:none}.cg-reov.on{display:block}' +
      '.cg-reov-bd{position:absolute;inset:0;background:rgba(16,19,28,.42);display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.cg-reov-card{background:var(--card);border-radius:16px;padding:20px;width:min(420px,94vw);box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
      '.cg-reov-t{font-family:var(--font);font-size:16px;font-weight:800;color:var(--ip-ink)}' +
      '.cg-reov-p{font-size:13px;color:var(--ip-ink);font-weight:600;margin-top:6px}.cg-reov-cur{font-size:12.5px;color:var(--muted);margin-top:2px}.cg-reov-cur b{color:var(--ip-ink)}' +
      '.cg-reov-in{width:100%;margin-top:14px;font-family:var(--font);font-size:15px;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:11px;padding:11px 13px;outline:none}' +
      '.cg-reov-in:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}' +
      '.cg-reov-act{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}' +
      '.cg-reov-x{border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:10px;padding:9px 16px;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer}' +
      '.cg-reov-ok{border:none;background:var(--ip-blue);color:#fff;border-radius:10px;padding:9px 18px;font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer}' +
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
      '.cg-f-reps{margin-top:10px;display:flex;flex-direction:column;gap:7px}' +
      '.cg-f-rep{display:flex;gap:8px;align-items:flex-start}' +
      '.cg-f-rl{flex:none;width:78px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;padding-top:3px}' +
      '.cg-f-rc{flex:1;display:flex;flex-wrap:wrap;gap:5px}' +
      '.cg-f-tier{display:inline-flex;align-items:center;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:999px}' +
      '.cg-f-tier.ta{background:rgba(11,110,67,.14);color:#0B6E43}.cg-f-tier.tb{background:rgba(22,163,74,.13);color:#15803D}.cg-f-tier.tc{background:rgba(79,184,126,.16);color:#3f9e6a}' +
      '.cg-f-comm{display:inline-flex;align-items:center;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--card-2);border:1px solid var(--line);color:var(--ip-ink)}' +
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
      '.cg-f-back{display:inline-block;font-size:12px;font-weight:700;color:var(--muted);text-decoration:none;cursor:pointer;margin-bottom:10px}.cg-f-back:hover{color:var(--ip-blue)}' +
      // Top clients
      '.cg-f-top{margin-top:6px;display:flex;flex-direction:column;gap:5px}' +
      '.cg-f-tc{display:flex;align-items:center;gap:8px;justify-content:space-between;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:7px 11px;cursor:pointer;transition:border-color .15s}' +
      '.cg-f-tc:hover{border-color:var(--ip-blue)}' +
      '.cg-f-tcm{min-width:0;flex:1}.cg-f-tcm b{display:block;font-size:12.5px;font-weight:700;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cg-f-tcm span{font-size:11px;color:var(--muted)}' +
      '.cg-f-tcr{display:flex;align-items:center;gap:8px;flex-shrink:0}.cg-f-tcr b{font-size:12.5px;font-weight:800;color:var(--ip-ink);font-variant-numeric:tabular-nums}' +
      '.cg-f-tt{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:var(--card);border:1px solid var(--line);color:var(--muted)}' +
      '.cg-f-tt.ta{background:rgba(11,110,67,.14);color:#0B6E43;border-color:transparent}.cg-f-tt.tb{background:rgba(22,163,74,.13);color:#15803D;border-color:transparent}.cg-f-tt.tc{background:rgba(79,184,126,.16);color:#3f9e6a;border-color:transparent}' +
      '.cg-f-notes{margin-top:16px}' +
      '.cg-f-desc{margin-top:12px;font-size:13px;line-height:1.5;color:var(--ip-ink)}' +
      '.cg-f-type{display:inline-block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);background:var(--card-2);border:1px solid var(--line);border-radius:6px;padding:1px 7px;vertical-align:middle;margin-left:4px}' +
      '.cg-f-actus{margin-top:6px;display:flex;flex-direction:column;gap:6px}' +
      '.cg-f-actu{background:var(--card-2);border:1px solid var(--line);border-left:3px solid var(--ip-blue);border-radius:9px;padding:8px 11px}' +
      '.cg-f-actt{font-size:12.5px;font-weight:700;color:var(--ip-ink);line-height:1.35}' +
      '.cg-f-acts{font-size:11px;color:var(--muted);margin-top:2px}' +
      // Classement (vue d'ensemble)
      '.cg-rk{padding:0}' +
      '.cg-rk-head{position:sticky;top:0;z-index:2;background:var(--paper);padding:14px 16px 10px;border-bottom:1px solid var(--line)}' +
      '.cg-rk-t{font-family:var(--font);font-size:15px;font-weight:800;color:var(--ip-ink)}' +
      '.cg-rk-sum{font-size:12px;color:var(--muted);margin-top:2px;font-weight:600}' +
      '.cg-rk-sorts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}.cg-rk-sorts>span{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin-right:2px}' +
      '.cg-rk-sb{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s}' +
      '.cg-rk-sb:hover{color:var(--ip-ink)}.cg-rk-sb.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}' +
      '.cg-rk-exp{flex:none;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:7px 12px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--ip-blue);cursor:pointer;white-space:nowrap}.cg-rk-exp:hover{border-color:var(--ip-blue);background:var(--halo)}' +
      '.cg-rk-list{padding:6px 0}' +
      '.cg-rk-row{display:flex;align-items:center;gap:11px;padding:9px 16px;border-bottom:1px solid var(--line-2);cursor:pointer;transition:background .12s}' +
      '.cg-rk-row:hover{background:var(--card-2)}' +
      '.cg-rk-n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--card-2);border:1px solid var(--line);color:var(--muted);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}' +
      '.cg-rk-main{flex:1;min-width:0}.cg-rk-nm{font-size:13.5px;font-weight:700;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.cg-rk-meta{font-size:11.5px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cg-rk-meta b{color:var(--ip-ink);font-weight:800}' +
      '.cg-rk-pen{flex:none;font-size:13px;font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums;min-width:38px;text-align:right}' +
      '@media(max-width:820px){.cg-split{flex-direction:column;height:auto}.cg-map{height:52vh;min-height:320px}.cg-list{width:auto;max-width:none;border-left:none;border-top:1px solid var(--line);max-height:none}}';
    document.head.appendChild(st);
  }

  // ── options du sélecteur : tous les groupements, triés A→Z, avec compteurs ──
  function selectOptions() {
    var byNorm = {};
    for (var g in GIDX) byNorm[norm(g)] = g;
    if (window.GRP_PROSPECTS) {
      for (var i = 0; i < GRP_PROSPECTS.length; i++) {
        var nm = GRP_PROSPECTS[i].nom; if (!nm) continue;
        var cn = canonGrp(nm);
        if (!(norm(cn) in byNorm)) byNorm[norm(cn)] = cn;
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
    var bounds = [], j, p;
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
    var e = sel && GIDX[sel];
    if (e) {
      // groupement sélectionné : ses clients (dessus) + prospects (dessous)
      var pts = e.pts, pros = [], clis = [];
      for (j = 0; j < pts.length; j++) { p = D.p[pts[j]]; if (!llOK(p)) continue; (isClient(p) ? clis : pros).push(pts[j]); }
      for (j = 0; j < pros.length; j++) add(pros[j], false);
      for (j = 0; j < clis.length; j++) add(clis[j], true);
      if (bounds.length) { try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 }); } catch (ex) {} }
    } else {
      // vue d'ensemble : TOUS tes clients (verts) sur la France — la carte n'est jamais vide
      for (j = 0; j < D.p.length; j++) { p = D.p[j]; if (llOK(p) && isClient(p)) add(j, true); }
      try { map.setView([46.6, 2.4], 6); } catch (ex) {}
    }
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
      '<button class="cg-rebtn" title="Changer de groupement" onclick="event.stopPropagation();V2.cgReassign(' + idx + ')">⇄</button>' +
    '</div>';
  }
  // ── Classement : tous les groupements, triable ──
  var rankSort = 'c';
  function rankRows() {
    var out = [];
    for (var g in GIDX) {
      var e = GIDX[g], cs = grpClientStats(e.pts), tot = e.pts.length;
      var comms = Object.keys(cs.byComm).sort(function (a, b) { return cs.byComm[b] - cs.byComm[a]; });
      out.push({ name: g, c: e.c, pr: e.pr, tot: tot, ca: cs.ca, pen: tot ? Math.round(e.c / tot * 100) : 0, topComm: comms[0] || '' });
    }
    var key = rankSort === 'ca' ? 'ca' : rankSort === 'pr' ? 'pr' : rankSort === 'pen' ? 'pen' : 'c';
    out.sort(function (a, b) { return (b[key] - a[key]) || (b.c - a.c); });
    return out;
  }
  function rankingHtml() {
    var rows = rankRows(), totC = 0, totCa = 0, totPr = 0;
    rows.forEach(function (r) { totC += r.c; totCa += r.ca; totPr += r.pr; });
    var sb = function (k, lbl) { return '<button class="cg-rk-sb' + (rankSort === k ? ' on' : '') + '" onclick="V2.cgRankSort(\'' + k + '\')">' + lbl + '</button>'; };
    var head = '<div class="cg-rk-head"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div><div class="cg-rk-t">Tous les groupements · ' + rows.length + '</div>' +
      '<div class="cg-rk-sum">' + totC + ' clients · ' + eur(totCa) + ' · ' + totPr + ' prospects</div></div>' +
      '<button class="cg-rk-exp" onclick="V2.cgExport()" title="Exporter en CSV (Excel)">⬇ Export</button></div>' +
      '<div class="cg-rk-sorts"><span>Trier</span>' + sb('c', 'Clients') + sb('ca', 'CA') + sb('pr', 'Prospects') + sb('pen', 'Pénétr.') + '</div></div>';
    var body = rows.map(function (r, i) {
      return '<div class="cg-rk-row" data-g="' + esc(r.name) + '" onclick="V2.cgSelect(this.dataset.g)">' +
        '<span class="cg-rk-n">' + (i + 1) + '</span>' +
        '<div class="cg-rk-main"><div class="cg-rk-nm">' + esc(r.name) + '</div>' +
          '<div class="cg-rk-meta"><b>' + r.c + '</b> clients · ' + r.pr + ' prospects' + (r.ca > 0 ? ' · ' + eur(r.ca) : '') + (r.topComm ? ' · ' + esc(r.topComm) : '') + '</div></div>' +
        '<span class="cg-rk-pen" title="Pénétration = clients / pharmacies">' + r.pen + '%</span></div>';
    }).join('') || '<div class="cg-empty">Aucun groupement.</div>';
    return '<div class="cg-rk">' + head + '<div class="cg-rk-list">' + body + '</div></div>';
  }
  V2.cgRankSort = function (k) { rankSort = k; var ls = document.getElementById('cg-list'); if (ls) ls.innerHTML = listHtml(); };
  function csvCell(s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  V2.cgExport = function () {
    var rows = rankRows();
    var head = ['Groupement', 'Clients', 'Prospects', 'Pharmacies', 'CA clients EUR', 'Penetration %', 'Top commercial'];
    var lines = [head.join(';')];
    rows.forEach(function (r) {
      var tot = (GIDX[r.name] && GIDX[r.name].pts.length) || 0;
      lines.push([csvCell(r.name), r.c, r.pr, tot, Math.round(r.ca), r.pen, csvCell(r.topComm)].join(';'));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'groupements_integral.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  function listHtml() {
    if (!sel) return rankingHtml();
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
    var s = document.getElementById('cg-sel'); if (s && s.value !== sel) s.value = sel;
    var cn = document.getElementById('cg-count'); if (cn) cn.innerHTML = counts();
    var ls = document.getElementById('cg-list'); if (ls) { ls.innerHTML = listHtml(); ls.scrollTop = 0; }
    if (sel && V2.notes && V2.notes.hydrate) V2.notes.hydrate();
    draw();
  };
  V2.cgFocus = function (idx) {
    var p = D && D.p[idx]; if (!p || !map || !llOK(p)) return;
    map.setView([p[0], p[1]], Math.max(map.getZoom(), 14), { animate: true });
    var m = markers[idx]; if (m) m.openPopup();
  };

  // ── Corrections manuelles : changer une pharmacie de groupement (persisté Supabase, propagé) ──
  function grpIndexOf(name) {
    var cc = function (x) { return String(x || '').normalize ? String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '') : String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var k = cc(name); for (var i = 0; i < D.grp.length; i++) if (cc(D.grp[i]) === k) return i;
    D.grp.push(name); return D.grp.length - 1;
  }
  function applyOvr() { var OV = window.GRP_OVR; if (!OV || !D) return; D.p.forEach(function (p) { var g = OV[String(p[13] || '').replace(/[^0-9]/g, '')]; if (g) p[3] = grpIndexOf(g); }); }
  function ensureOverrides(cb) {
    window.GRP_OVR = window.GRP_OVR || {};
    if (!V2.profil || !V2.profil.loadScope) { applyOvr(); cb(); return; }
    V2.profil.loadScope('override').then(function (list) {
      (list || []).forEach(function (o) { if (o && o.data && o.data.groupement) window.GRP_OVR[String(o.sid).replace(/[^0-9]/g, '')] = o.data.groupement; });
      applyOvr(); cb();
    }).catch(function () { applyOvr(); cb(); });
  }
  function allGroupNames() {
    var set = {}; for (var g in GIDX) set[g] = 1;
    if (window.GRP_PROSPECTS) window.GRP_PROSPECTS.forEach(function (x) { if (x.nom) set[canonGrp(x.nom)] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }
  V2.cgReassign = function (idx) {
    var p = D && D.p[idx]; if (!p) return;
    var cur = canonGrp(grpName(p));
    var ov = document.getElementById('cg-reov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'cg-reov'; document.body.appendChild(ov); }
    var dl = allGroupNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    ov.innerHTML = '<div class="cg-reov-bd" onclick="V2.cgReassignClose(event)"><div class="cg-reov-card" onclick="event.stopPropagation()">' +
      '<div class="cg-reov-t">Changer le groupement</div>' +
      '<div class="cg-reov-p">' + esc(p[6] || 'Pharmacie') + (p[7] ? ' · ' + esc(p[7]) : '') + '</div>' +
      '<div class="cg-reov-cur">Actuel : <b>' + esc(cur || '—') + '</b></div>' +
      '<input id="cg-reov-in" class="cg-reov-in" list="cg-reov-dl" placeholder="Nouveau groupement…" value="' + esc(cur || '') + '" autocomplete="off">' +
      '<datalist id="cg-reov-dl">' + dl + '</datalist>' +
      '<div class="cg-reov-act"><button class="cg-reov-x" onclick="V2.cgReassignClose(event)">Annuler</button>' +
      '<button class="cg-reov-ok" onclick="V2.cgReassignSave(' + idx + ')">Enregistrer</button></div>' +
    '</div></div>';
    ov.className = 'cg-reov on';
    setTimeout(function () { var i = document.getElementById('cg-reov-in'); if (i) { i.focus(); i.select(); } }, 30);
  };
  V2.cgReassignClose = function (e) { if (e) e.stopPropagation(); var ov = document.getElementById('cg-reov'); if (ov) ov.className = 'cg-reov'; };
  V2.cgReassignSave = function (idx) {
    var p = D && D.p[idx]; if (!p) return;
    var inp = document.getElementById('cg-reov-in'); var val = inp ? inp.value.trim() : '';
    if (!val) { V2.cgReassignClose(); return; }
    window.GRP_OVR = window.GRP_OVR || {}; window.GRP_OVR[String(p[13] || '').replace(/[^0-9]/g, '')] = val;
    p[3] = grpIndexOf(val);
    if (V2.profil && V2.profil.saveOverride) V2.profil.saveOverride(String(p[13]), { groupement: val });
    V2.cgReassignClose();
    buildIndex();
    var s = document.getElementById('cg-sel'); if (s) s.innerHTML = selectOptions();
    var ls = document.getElementById('cg-list'); if (ls) ls.innerHTML = listHtml();
    if (sel && V2.notes && V2.notes.hydrate) V2.notes.hydrate();
    draw();
    if (V2.toast) V2.toast('Groupement mis à jour · ' + val);
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
        D = window.PHARMA_FR; reconcile();
        ensureOverrides(function () {
        buildIndex();
        ensureDetails(function () {
        // défaut : classement de tous les groupements (vue d'ensemble) ; drill-down au clic
        var s = document.getElementById('cg-sel'); if (s) { s.innerHTML = selectOptions(); s.value = sel; }
        var cn = document.getElementById('cg-count'); if (cn) cn.innerHTML = counts();
        var ls = document.getElementById('cg-list'); if (ls) ls.innerHTML = listHtml();
        if (sel && V2.notes && V2.notes.hydrate) V2.notes.hydrate();
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
      });
    }
  };
})();
