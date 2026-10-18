/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Documents (V2.pages.documents) — 16/10/2026
   Le classement des grossistes, groupements et laboratoires (tarifs, conditions, catalogues), consultable depuis l'iPhone comme
   depuis le Mac, par le compte de Will SEUL. Même rangement que sur le Mac : 5 dossiers racine, jusqu'à 3 niveaux, recherche partout.

   Accès : V2.documentsVerifier() (v2-app.js) interroge la fonction Supabase documents_acces_ok(). Tant que la réponse n'est pas « oui »,
   l'écran ne fait AUCUNE requête vers l'index et montre un message neutre.
   Index : objet « index/documents.json » de l'espace privé « documents-prives », lu par adresse signée, gardé en MÉMOIRE seulement
   (jamais Cache Storage, localStorage ni sessionStorage : les titres sont confidentiels).
   Ouverture : l'onglet est ouvert dans le geste du doigt (sinon Safari le bloque), puis dirigé vers l'adresse signée (V2.ouvrirDocProtege fait de même).
   Aucun prix ni condition chiffrée dans les textes de l'écran.
   Aperçus (18/10/2026) : la première page de chaque document, en vignette. Image `apercus/<sha1>.jpg` (400 px de large) dans le
   même espace fermé, fabriquée sur le Mac par apercus.py ; `ap: 1` dans l'index quand elle existe, sinon le picto du type reste.
   Adresses signées de tout ce qui est affiché EN UNE FOIS, gardées 45 min en mémoire (comme v2-discussion.js).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};
  var BUCKET = 'documents-prives';
  var INDEX = 'index/documents.json';
  var MAX_RES = 100;      // résultats de recherche affichés
  var PAGE = 150;         // documents affichés par dossier avant « Afficher la suite »

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-'’_/]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }
  function $(s, r) { return (r || document).querySelector(s); }
  function cmp(a, b) { return String(a).localeCompare(String(b), 'fr'); }
  function nb(n) { try { return Number(n).toLocaleString('fr-FR'); } catch (e) { return String(n); } }

  // ——— Feuille de style (posée une fois, avec le module) ———
  (function () {
    if (document.getElementById('v2-documents-css')) return;
    var st = document.createElement('style'); st.id = 'v2-documents-css';
    st.textContent = [
      '.v2-wrap.dc-wrap{max-width:860px}',
      '.dc-tete h1{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px}',
      '.dc-seul{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:var(--r-pill);font-size:13px;font-weight:700;background:var(--halo);color:var(--ip-blue-d);white-space:nowrap;letter-spacing:0}',
      '.dc-seul svg{width:14px;height:14px}',
      'svg.dc-i{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}',
      '.dc-champ{margin:18px 0 6px}',
      '.dc-champ input,.dc-champ input:focus{font-size:16px;border:0;box-shadow:none;outline:0;background:transparent;border-radius:0;-webkit-appearance:none;appearance:none}',
      '.dc-eff{flex:none;width:44px;height:44px;margin-right:-12px;border:0;background:none;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--r-control)}',
      '.dc-eff[hidden]{display:none}',
      '.dc-eff svg{width:18px;height:18px}',
      '.dc-fil{display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;margin:8px 0 10px;font-size:14px;font-weight:600}',
      '.dc-fil button{display:inline-flex;align-items:center;min-height:44px;padding:0 6px;border:0;background:none;font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-blue);cursor:pointer;border-radius:var(--r-control);text-align:left;overflow-wrap:anywhere;max-width:100%}',
      '.dc-fil button:hover{color:var(--ip-blue-d)}',
      '.dc-fil .dc-ici{color:var(--ip-ink);cursor:default}',
      '.dc-seg{display:inline-flex;align-items:center;max-width:100%}',
      '.dc-fil .dc-sep{width:14px;height:14px;flex:none;fill:none;stroke:var(--muted-2);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.dc-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:18px 2px 8px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.dc-h span{letter-spacing:0;text-transform:none;font-weight:700}',
      '.v2-card.dc-liste{padding:0;overflow:hidden}',
      '.dc-lg{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 14px;border:0;border-bottom:1px solid var(--line);background:var(--card);font-family:var(--font);text-align:left;color:var(--ip-ink);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.dc-lg:last-child{border-bottom:0}',
      '.dc-lg:hover{background:var(--card-2)}',
      '.dc-lg:active{background:var(--surf-sunken)}',
      '.dc-lg:focus-visible,.dc-fil button:focus-visible,.dc-eff:focus-visible,.dc-plus:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-2px}',
      '.dc-tuile{flex:none;width:40px;height:40px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:var(--halo);color:var(--ip-blue)}',
      '.dc-tuile--xls{background:#E3F5EC;color:var(--c-mint-txt)}',
      '.dc-tuile--img{background:#F1ECFB;color:#5B3FB0}',
      '.dc-tuile--txt,.dc-tuile--web{background:var(--surf-sunken);color:var(--ip-ink-2)}',
      '.dc-corps{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.dc-t{font-size:15px;font-weight:700;line-height:1.3;color:var(--ip-ink);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.dc-m{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:13px;color:var(--muted);line-height:1.35;font-variant-numeric:tabular-nums}',
      '.dc-ou{font-size:13px;color:var(--muted);line-height:1.35;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.dc-bdg{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:var(--r-pill);font-size:11.5px;font-weight:800;letter-spacing:.02em;background:var(--halo);color:var(--ip-blue-d)}',
      '.dc-bdg--xls{background:#E3F5EC;color:var(--c-mint-txt)}',
      '.dc-bdg--img{background:#F1ECFB;color:#5B3FB0}',
      '.dc-bdg--txt,.dc-bdg--web{background:var(--surf-sunken);color:var(--ip-ink-2)}',
      '.dc-nb{flex:none;font-size:13px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dc-chev{flex:none;width:18px;height:18px;fill:none;stroke:var(--muted-2);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.dc-plus{display:flex;margin:14px auto 0;min-height:44px;padding:0 18px;border:1px solid var(--line-strong);border-radius:var(--r-btn);background:var(--card);font-family:var(--font);font-size:14.5px;font-weight:700;color:var(--ip-blue);cursor:pointer;align-items:center}',
      '.dc-note{margin:12px 2px 0;font-size:13.5px;line-height:1.45;color:var(--ip-ink-2)}',
      '.dc-alerte{margin:12px 0 0;padding:12px 14px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-size:14px;font-weight:600;line-height:1.4}',
      '.dc-alerte[hidden]{display:none}',
      '.dc-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:14px}',
      '.dc-carte{display:flex;flex-direction:column;min-width:0;padding:0;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-family:var(--font);text-align:left;color:var(--ip-ink);cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:border-color .15s,box-shadow .15s}',
      '.dc-carte:hover{border-color:var(--line-strong);box-shadow:0 10px 24px -14px rgba(16,24,40,.3)}',
      '.dc-carte:active{background:var(--card-2)}',
      '.dc-carte:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.dc-ap{position:relative;display:block;aspect-ratio:3/4;background:radial-gradient(130% 90% at 50% 0%,var(--card) 0%,var(--surf-sunken) 100%);border-bottom:1px solid var(--line)}',
      '.dc-ap .dc-tuile{position:absolute;inset:0;margin:auto;width:52px;height:52px;border-radius:14px}',
      '.dc-ap .dc-tuile svg{width:26px;height:26px}',
      '.dc-ap img{position:absolute;inset:0;margin:auto;display:block;width:auto;height:auto;max-width:calc(100% - 28px);max-height:calc(100% - 28px);background:#fff;border-radius:2px;box-shadow:0 1px 2px rgba(16,24,40,.14),0 10px 24px -10px rgba(16,24,40,.32);opacity:0;transition:opacity .25s}',
      '.dc-ap img.dc-vu{opacity:1}',
      '.dc-ap.dc-ok .dc-tuile{display:none}',
      '.dc-cc{display:flex;flex-direction:column;gap:5px;min-width:0;padding:10px 12px 12px}',
      '.dc-carte .dc-t{font-size:14.5px}',
      '@media (max-width:480px){.dc-grille{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dc-cc{padding:9px 10px 11px}.dc-carte .dc-t{font-size:14px}}',
      '@media (max-width:480px){.dc-lg{padding:10px 12px;gap:10px}.dc-nb{display:none}.dc-lg .dc-nb-m{display:block}}',
      '.dc-nb-m{display:none;font-size:13px;color:var(--muted)}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ——— Pictos (trait, comme le reste de l'app) ———
  var P = {
    dossier: 'M3.5 7.5V19h17V9H11L9.2 6.5H3.5zM3.5 11h17',
    pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4',
    xls: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12l4 5M13 12l-4 5',
    img: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16M15.5 9.2h.01',
    txt: 'M6 3h8l4 4v14H6zM14 3v4h4M9 11h6M9 14h6M9 17h4',
    web: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5S9.6 5.9 12 3.5z',
    chev: 'M9 5l7 7-7 7',
    search: 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM16 16l4 4',
    x: 'M6 6l12 12M18 6L6 18',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3'
  };
  function ic(n, cls) { return '<svg class="' + (cls || 'dc-i') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }

  // ——— Types de fichiers ———
  var TYPES = {
    pdf: { nom: 'PDF', ico: 'pdf', cl: '' },
    xlsx: { nom: 'Excel', ico: 'xls', cl: 'xls' }, xls: { nom: 'Excel', ico: 'xls', cl: 'xls' },
    csv: { nom: 'Tableau CSV', ico: 'xls', cl: 'xls' },
    jpg: { nom: 'Image', ico: 'img', cl: 'img' }, jpeg: { nom: 'Image', ico: 'img', cl: 'img' }, png: { nom: 'Image', ico: 'img', cl: 'img' },
    txt: { nom: 'Texte', ico: 'txt', cl: 'txt' },
    html: { nom: 'Page web', ico: 'web', cl: 'web' }
  };
  function typeDe(d) { return TYPES[String(d.ext || '').toLowerCase()] || { nom: String(d.ext || 'Fichier').toUpperCase(), ico: 'txt', cl: 'txt' }; }
  var NBSP = ' ';
  function taille(n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return '';
    if (n < 1024) return n + NBSP + 'o';
    if (n < 1048576) return Math.round(n / 1024) + NBSP + 'Ko';
    if (n < 1073741824) return (n / 1048576).toFixed(1).replace('.', ',') + NBSP + 'Mo';
    return (n / 1073741824).toFixed(1).replace('.', ',') + NBSP + 'Go';
  }

  // ——— Noms lisibles des cinq dossiers racine (le numéro fixe l'ordre) ———
  var RACINES = {
    '1': 'Grossistes', '2': 'Groupements', '3': 'Laboratoires, parapharmacie et plateformes',
    '4': 'Réserve (confidentiel ou nominatif)', '5': 'Antérieur à 2025 (pièces rares sur les short-liners)'
  };
  function numRacine(seg) { var m = /^\s*(\d+)\b/.exec(seg); return m ? m[1] : null; }
  function nomDossier(seg, niveau) {
    if (niveau === 0) { var n = numRacine(seg); if (n && RACINES[n]) return RACINES[n]; return String(seg).replace(/^\s*\d+\s*[-–.]\s*/, ''); }
    return seg;
  }
  function nomChemin(chemin) { return chemin.split('/').map(function (s, i) { return nomDossier(s, i); }).join(' › '); }

  // ——— État (en mémoire ; survit aux redessins du routeur) ———
  var D = { etat: 'attente', idx: null, docs: [], q: '', max: PAGE, cheminVu: null, msgT: 0, urls: {}, urlsLe: 0 };

  function preparer(j) {
    var l = (j && Array.isArray(j.documents)) ? j.documents : [];
    D.docs = l.filter(function (d) { return d && typeof d.cle === 'string' && typeof d.dossier === 'string'; }).map(function (d) {
      var t = d.titre || String(d.nom || '').replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'Document';
      return { dossier: d.dossier.replace(/^\/+|\/+$/g, ''), nom: d.nom || '', titre: t, date: d.date || '', cle: d.cle, taille: d.taille, ext: String(d.ext || d.cle.split('.').pop() || '').toLowerCase(),
        ap: d.ap ? 'apercus/' + d.cle.split('/').pop().replace(/\.[^.]+$/, '') + '.jpg' : '',
        _t: norm(t), _d: norm(nomChemin(d.dossier.replace(/^\/+|\/+$/g, ''))) + ' ' + norm(d.dossier) };
    });
  }
  function trouver(cle) { for (var i = 0; i < D.docs.length; i++) if (D.docs[i].cle === cle) return D.docs[i]; return null; }

  function charger(root) {
    D.etat = 'charge'; D.erreur = '';
    var c = V2.sb && V2.sb();
    if (!c || !c.storage) { D.etat = 'echec'; D.idx = null; corps(); return; }
    var ref = (D.essai = (D.essai || 0) + 1);
    c.storage.from(BUCKET).createSignedUrl(INDEX, 600).then(function (r) {
      var u = r && r.data && r.data.signedUrl;
      if (!u) throw new Error('adresse refusée');
      return fetch(u, { cache: 'no-store', credentials: 'omit' });
    }).then(function (rep) {
      if (!rep.ok) throw new Error('HTTP ' + rep.status);
      return rep.json();
    }).then(function (j) {
      if (!j || !Array.isArray(j.documents) || !j.documents.length) throw new Error('index vide');
      D.idx = j; preparer(j); D.etat = 'pret';
    }).catch(function () { D.etat = 'echec'; D.idx = null; D.docs = []; }).then(function () {
      if (ref === D.essai && actif()) corps();
    });
  }

  function actif() { return !!(V2.route && V2.route.name === 'documents' && document.getElementById('doc-root')); }
  function chemin() { var p = V2.route && V2.route.param; return p ? String(p).replace(/^\/+|\/+$/g, '') : ''; }

  // ——— Lecture de l'arbre à un niveau ———
  function niveau(ch) {
    var pre = ch ? ch + '/' : '', dirs = {}, directs = [];
    D.docs.forEach(function (d) {
      if (ch) { if (d.dossier === ch) { directs.push(d); return; } if (d.dossier.indexOf(pre) !== 0) return; }
      else if (!d.dossier) { directs.push(d); return; }
      var reste = d.dossier.slice(pre.length), seg = reste.split('/')[0];
      dirs[seg] = (dirs[seg] || 0) + 1;
    });
    var noms = Object.keys(dirs);
    var prof = ch ? ch.split('/').length : 0;
    noms.sort(prof === 0 ? function (a, b) { return (Number(numRacine(a)) || 99) - (Number(numRacine(b)) || 99) || cmp(a, b); } : cmp);
    directs.sort(function (a, b) { return cmp(a.nom || a.titre, b.nom || b.titre); });
    return { dirs: noms.map(function (n) { return { seg: n, chemin: pre + n, n: dirs[n] }; }), docs: directs, existe: noms.length > 0 || directs.length > 0 };
  }

  // ——— Rendu ———
  function ligneDossier(d, prof) {
    return '<button type="button" class="dc-lg" data-dossier="' + esc(d.chemin) + '"><span class="dc-tuile">' + ic('dossier') + '</span>' +
      '<span class="dc-corps"><span class="dc-t">' + esc(nomDossier(d.seg, prof)) + '</span><span class="dc-nb-m">' + nb(d.n) + ' document' + (d.n > 1 ? 's' : '') + '</span></span>' +
      '<span class="dc-nb">' + nb(d.n) + ' document' + (d.n > 1 ? 's' : '') + '</span>' + ic('chev', 'dc-chev') + '</button>';
  }
  function carteDoc(d, avecDossier) {
    var t = typeDe(d), meta = [];
    meta.push('<span class="dc-bdg' + (t.cl ? ' dc-bdg--' + t.cl : '') + '">' + esc(t.nom) + '</span>');
    if (d.date) meta.push('<span>' + esc(d.date) + '</span>');
    var tl = taille(d.taille); if (tl) meta.push('<span>' + esc(tl) + '</span>');
    var u = d.ap ? D.urls[d.ap] : false;
    return '<button type="button" class="dc-carte" data-cle="' + esc(d.cle) + '"><span class="dc-ap">' +
      '<span class="dc-tuile' + (t.cl ? ' dc-tuile--' + t.cl : '') + '">' + ic(t.ico) + '</span>' +
      (u !== false ? '<img alt="" loading="lazy" decoding="async" data-ap="' + esc(d.ap) + '"' + (u ? ' src="' + esc(u) + '"' : '') + '>' : '') + '</span>' +
      '<span class="dc-cc"><span class="dc-t">' + esc(d.titre) + '</span>' +
      (avecDossier ? '<span class="dc-ou">' + esc(nomChemin(d.dossier)) + '</span>' : '') +
      '<span class="dc-m">' + meta.join('') + '</span></span></button>';
  }

  // ——— Aperçus : adresses signées de ce qui est affiché, EN UNE FOIS ; gardées 45 min puis relues ———
  // D.urls[chemin] : '' = demandée, false = pas d'aperçu (le picto reste), sinon l'adresse.
  function signerAp(docs) {
    if (D.urlsLe && Date.now() - D.urlsLe > 45 * 60000) { D.urls = {}; D.urlsLe = 0; }
    var need = [];
    docs.forEach(function (d) { if (d.ap && !Object.prototype.hasOwnProperty.call(D.urls, d.ap) && need.indexOf(d.ap) < 0) need.push(d.ap); });
    var c = V2.sb && V2.sb();
    if (!need.length || !c || !c.storage) return;
    need.forEach(function (p) { D.urls[p] = ''; });
    var oublier = function () { need.forEach(function (p) { if (D.urls[p] === '') delete D.urls[p]; }); };
    c.storage.from(BUCKET).createSignedUrls(need, 3600).then(function (s) {
      if (!s || s.error || !s.data) { oublier(); return; }
      if (!D.urlsLe) D.urlsLe = Date.now();
      s.data.forEach(function (x, i) { var p = (x && x.path) || need[i]; D.urls[p] = (x && !x.error && x.signedUrl) || false; });
      poserAp();
    }).catch(oublier);
  }
  function poserAp() {
    var z = document.getElementById('dc-corps'); if (!z) return;
    Array.prototype.forEach.call(z.querySelectorAll('img[data-ap]:not([src])'), function (im) {
      var u = D.urls[im.getAttribute('data-ap')];
      if (u) im.src = u; else if (u === false && im.parentNode) im.parentNode.removeChild(im);
    });
  }
  function fil(ch) {
    var segs = ch ? ch.split('/') : [], h = '<nav class="dc-fil" aria-label="Fil d’Ariane">';
    var sep = '<svg class="dc-sep" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
    if (!segs.length) return h + '<span class="dc-ici" style="padding:0 6px;min-height:44px;display:inline-flex;align-items:center;font-weight:800">Tous les dossiers</span></nav>';
    h += '<span class="dc-seg"><button type="button" data-dossier="">Tous les dossiers</button>' + sep + '</span>';
    segs.forEach(function (s, i) {
      var p = segs.slice(0, i + 1).join('/');
      h += (i === segs.length - 1
        ? '<span class="dc-ici" style="padding:0 6px;min-height:44px;display:inline-flex;align-items:center;font-weight:800;overflow-wrap:anywhere" aria-current="page">' + esc(nomDossier(s, i)) + '</span>'
        : '<span class="dc-seg"><button type="button" data-dossier="' + esc(p) + '">' + esc(nomDossier(s, i)) + '</button>' + sep + '</span>');
    });
    return h + '</nav>';
  }
  function resultats() {
    var jetons = norm(D.q).split(' ').filter(Boolean), r = [];
    D.docs.forEach(function (d) {
      var ok = jetons.every(function (j) { return d._t.indexOf(j) >= 0 || d._d.indexOf(j) >= 0; });
      if (ok) r.push({ d: d, s: jetons.every(function (j) { return d._t.indexOf(j) >= 0; }) ? 0 : 1 });
    });
    r.sort(function (a, b) { return a.s - b.s || cmp(a.d.dossier, b.d.dossier) || cmp(a.d.nom || a.d.titre, b.d.nom || b.d.titre); });
    return r.map(function (x) { return x.d; });
  }

  function corps() {
    var el = document.getElementById('dc-corps'); if (!el) return;
    var sous = document.getElementById('dc-sous');
    if (D.etat === 'charge' || D.etat === 'attente') { el.innerHTML = '<div class="v2-loading" style="min-height:30vh"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
    if (D.etat === 'echec') {
      el.innerHTML = '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink);margin-bottom:14px">La liste des documents n’a pas pu être chargée.</div>' +
        '<button type="button" class="v2-btn v2-btn-primary" data-reessayer="1">Réessayer</button></div></div>';
      if (sous) sous.textContent = '';
      return;
    }
    if (sous) sous.textContent = nb(D.docs.length) + ' documents classés par dossier : grossistes, groupements, laboratoires.';
    var h = '', q = D.q.trim();
    if (q) {
      var res = resultats(), aff = res.slice(0, MAX_RES);
      h += '<div class="dc-h">Résultats <span>' + (res.length ? nb(res.length) + ' trouvé' + (res.length > 1 ? 's' : '') : '') + '</span></div>';
      if (!res.length) h += '<div class="v2-card"><div class="v2-empty" style="padding:36px 20px"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink)">Aucun document ne correspond à « ' + esc(q) + ' ».</div><p style="margin-top:6px;font-size:14px">Essayez un mot plus court, ou le nom d’un dossier.</p></div></div>';
      else {
        h += '<div class="dc-grille">' + aff.map(function (d) { return carteDoc(d, true); }).join('') + '</div>';
        if (res.length > aff.length) h += '<p class="dc-note">Les ' + MAX_RES + ' premiers résultats sur ' + nb(res.length) + ' : affinez la recherche pour voir les autres.</p>';
      }
      el.innerHTML = h; signerAp(aff || []); return;
    }
    var ch = chemin(), n = niveau(ch);
    if (ch && !n.existe) {
      el.innerHTML = fil('') + '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink);margin-bottom:14px">Ce dossier n’existe pas.</div>' +
        '<button type="button" class="v2-btn v2-btn-primary" data-dossier="">Tous les dossiers</button></div></div>';
      return;
    }
    if (D.cheminVu !== ch) { D.cheminVu = ch; D.max = PAGE; }
    var prof = ch ? ch.split('/').length : 0;
    h += fil(ch);
    if (n.dirs.length) {
      h += '<div class="dc-h">Dossiers <span>' + nb(n.dirs.length) + '</span></div><div class="v2-card dc-liste">' + n.dirs.map(function (d) { return ligneDossier(d, prof); }).join('') + '</div>';
    }
    if (n.docs.length) {
      var vus = n.docs.slice(0, D.max);
      h += '<div class="dc-h">Documents <span>' + nb(n.docs.length) + '</span></div><div class="dc-grille">' + vus.map(function (d) { return carteDoc(d, false); }).join('') + '</div>';
      if (n.docs.length > vus.length) h += '<button type="button" class="dc-plus" data-plus="1">Afficher la suite (' + nb(n.docs.length - vus.length) + ' autres)</button>';
    }
    if (!n.dirs.length && !n.docs.length) h += '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Ce dossier est vide.</div></div></div>';
    el.innerHTML = h;
    signerAp(n.docs.slice(0, D.max));
  }

  // ——— Message d'échec d'ouverture (sans fenêtre native) ———
  function alerte(t) {
    var a = document.getElementById('dc-alerte');
    if (!a) { try { window.alert(t); } catch (e) {} return; }
    a.textContent = t; a.hidden = false;
    clearTimeout(D.msgT); D.msgT = setTimeout(function () { a.hidden = true; }, 7000);
  }

  // ——— Ouverture d'un document ———
  // À appeler DANS le geste de l'utilisateur : window.open est SYNCHRONE (après une promesse, Safari bloque la fenêtre).
  V2.documentsOuvrir = function (cle) {
    if (!cle) return;
    var d = trouver(cle), ext = String(d ? d.ext : (String(cle).split('.').pop() || '')).toLowerCase();
    var telecharge = ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'html';
    var nom = (d && d.nom) || ('document.' + ext);
    var onglet = null;
    try { onglet = window.open('', '_blank'); } catch (e) { onglet = null; }
    if (onglet && onglet.document && onglet.document.body) {
      try {
        onglet.document.title = (d && d.titre) || 'Document';
        var att = onglet.document.createElement('p');
        att.textContent = 'Ouverture du document…';
        att.setAttribute('style', 'margin:0;font:15px system-ui;color:#414E63;text-align:center;padding-top:40vh');
        onglet.document.body.setAttribute('style', 'margin:0;background:#F4F6FA');
        onglet.document.body.appendChild(att);
      } catch (e) {}
    }
    var c = V2.sb && V2.sb();
    var echec = function () {
      try { if (onglet) onglet.close(); } catch (e) {}
      alerte('Document indisponible. Vérifiez que votre session est ouverte.');
    };
    if (!c || !c.storage) { echec(); return; }
    // .xlsx, .csv et .html partent en téléchargement sous leur vrai nom : la page .html n'est JAMAIS rendue ici.
    var p = telecharge ? c.storage.from(BUCKET).createSignedUrl(cle, 3600, { download: nom }) : c.storage.from(BUCKET).createSignedUrl(cle, 3600);
    Promise.resolve(p).then(function (r) {
      var url = r && r.data && r.data.signedUrl;
      if (!url || (r && r.error)) throw new Error('adresse refusée');
      if (onglet) onglet.location.replace(url); else window.location.href = url;
    }).catch(echec);
  };

  // ——— Écran ———
  function gabarit() {
    return '<div class="v2-wrap v2-u dc-wrap" id="doc-root">' +
      '<div class="dc-tete"><h1 class="v2-titre">Documents <span class="dc-seul">' + ic('lock') + 'Visible par vous seul</span></h1>' +
      '<p class="v2-sous" id="dc-sous"></p></div>' +
      '<label class="v2-champ dc-champ">' + ic('search') +
      '<input type="text" inputmode="search" id="dc-q" placeholder="Rechercher un document…" aria-label="Rechercher un document ou un dossier" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' +
      '<button type="button" class="dc-eff" id="dc-eff" aria-label="Effacer la recherche" hidden>' + ic('x') + '</button></label>' +
      '<div class="dc-alerte" id="dc-alerte" role="alert" hidden></div>' +
      '<div id="dc-corps"></div></div>';
  }

  function brancher(root) {
    var zone = document.getElementById('doc-root'); if (!zone) return;
    var q = document.getElementById('dc-q'), eff = document.getElementById('dc-eff');
    q.value = D.q; eff.hidden = !D.q;
    var tmr = 0;
    q.addEventListener('input', function () {
      D.q = q.value; eff.hidden = !D.q;
      clearTimeout(tmr); tmr = setTimeout(function () { if (D.etat === 'pret') corps(); }, 120);
    });
    eff.addEventListener('click', function () { D.q = ''; q.value = ''; eff.hidden = true; corps(); q.focus(); });
    // Aperçu chargé : il remplace le picto ; aperçu illisible (adresse expirée, image absente) : le picto reste.
    zone.addEventListener('load', function (ev) { var im = ev.target; if (im && im.tagName === 'IMG' && im.parentNode) { im.classList.add('dc-vu'); im.parentNode.classList.add('dc-ok'); } }, true);
    zone.addEventListener('error', function (ev) { var im = ev.target; if (im && im.tagName === 'IMG' && im.parentNode) im.parentNode.removeChild(im); }, true);
    zone.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
      var b;
      if ((b = t.closest('[data-cle]'))) { V2.documentsOuvrir(b.getAttribute('data-cle')); return; }
      if ((b = t.closest('[data-dossier]'))) {
        var ch = b.getAttribute('data-dossier') || '';
        if (D.q) { D.q = ''; q.value = ''; eff.hidden = true; }
        if (ch === chemin()) corps(); else if (ch) V2.go('documents', ch); else V2.go('documents');
        return;
      }
      if (t.closest('[data-plus]')) { D.max += PAGE; corps(); return; }
      if (t.closest('[data-reessayer]')) { charger(); corps(); }
    });
  }

  function messageFerme(root, top, titre, avecBouton) {
    root.innerHTML = top + '<div class="v2-wrap v2-u dc-wrap" id="doc-root"><div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink)">' + esc(titre) + '</div>' +
      (avecBouton ? '<button type="button" class="v2-btn v2-btn-primary" id="dc-rev" style="margin-top:14px">Réessayer</button>' : '') + '</div></div></div>';
    var b = document.getElementById('dc-rev');
    if (b) b.addEventListener('click', function () { V2.render(); });
  }

  V2.pages.documents = {
    needs: [],
    render: function (root) {
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (isOpso()) { messageFerme(root, top, 'Cet espace n’est pas ouvert pour votre compte.'); return; }
      var ouvrir = function () {
        root.innerHTML = top + gabarit();
        brancher(root);
        if (D.etat === 'pret') corps();
        else { D.etat = 'charge'; corps(); charger(root); }
      };
      if (V2.documentsAcces && V2.documentsAcces()) { ouvrir(); return; }
      // Pas encore su : on demande, sans toucher à l'index. Aucune requête vers l'index tant que la réponse n'est pas « oui ».
      root.innerHTML = top + '<div class="v2-wrap v2-u dc-wrap" id="doc-root"><div class="v2-loading" style="min-height:40vh"><div class="v2-spinner"></div><div>Chargement…</div></div></div>';
      var verif = V2.documentsVerifier ? V2.documentsVerifier() : Promise.resolve(false);
      verif.then(function (ok) {
        if (!(V2.route && V2.route.name === 'documents')) return;
        if (ok === true) { if (V2.documentsAcces && V2.documentsAcces()) ouvrir(); }
        else if (ok === null) messageFerme(root, top, 'La vérification de votre accès n’a pas pu se faire.', true);
        else messageFerme(root, top, 'Cet espace n’est pas ouvert pour votre compte.');
      });
    }
  };

})();
