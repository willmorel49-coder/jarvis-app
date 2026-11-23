/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Documents commerciaux (V2.pages.doccom) — 22/11/2026
   Demande de Will : « un onglet pour les docs à dispo des commerciaux, qu'ils puissent y avoir accès rapidement et les
   prévisualiser (que des pdf), dispo aussi sur docs à partager quand on est sur une fiche officine » ; nom : « Documents commerciaux ».
   Mur de vignettes (1re page de chaque PDF) rangé en quatre familles ; un toucher = la visionneuse plein écran, page par page, sans quitter l'app.
   Tout compte connecté AJOUTE un PDF ; seul Will RETIRE (réversible : rien n'est effacé du stockage, la ligne garde retire_le).
   Stockage : espace fermé « documents-commerciaux » (pdf/<sha1>.pdf, apercus/<sha1>.jpg), lu par adresses signées ; liste = table
   documents_commerciaux ; droit de retrait = fonction documents_commerciaux_retrait_ok(). Le droit est porté par la BASE, l'écran
   ne fait que cacher le bouton. Jamais côté OPSO, Escale ni Phirst (porte filtrée dans u2Cles, écran fermé ici).
   Sur la fiche officine, la fenêtre Transmettre (v2-pharma.js) lit la même liste par V2.doccom (groupe « Documents commerciaux »).
   Source de données : V2.doccomSource si un banc d'essai local l'a posée, sinon Supabase (sourceSb ci-dessous).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};
  var BUCKET = 'documents-commerciaux', TABLE = 'documents_commerciaux';
  var MAX_OCTETS = 50 * 1048576;   // plafond d'un fichier sur le stockage du projet
  var FAMILLES = [
    { k: 'presenter', nom: 'Présenter', ph: 'Pour faire connaître Intégral Pharma' },
    { k: 'compte', nom: 'Ouvrir un compte', ph: 'Fiches, contrat et guides de démarrage' },
    { k: 'offres', nom: 'Offres et catalogues', ph: 'Ce qu’on propose, prix et gammes' },
    { k: 'fiches', nom: 'Fiches', ph: 'Mémos et affiches à laisser en officine' }
  ];
  function famDe(k) { for (var i = 0; i < FAMILLES.length; i++) if (FAMILLES[i].k === k) return FAMILLES[i]; return null; }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-'’_/]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function ferme() { return !!((window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.portes)) || (V2.user && (V2.user.opsoOnly || V2.user.role === 'opso')) || (window.V2_BRAND && window.V2_BRAND.escale)); }
  function pages(n) { n = Number(n) || 0; return n ? n + ' page' + (n > 1 ? 's' : '') : 'PDF'; }
  function nomFichier(d) { return String(d.titre || 'Document').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf'; }
  function sb() { return V2.sb && V2.sb(); }

  // ——— Feuille de style (posée une fois) ———
  (function () {
    if (document.getElementById('v2-doccom-css')) return;
    var st = document.createElement('style'); st.id = 'v2-doccom-css';
    st.textContent = [
      '.v2-wrap.dcm-wrap{max-width:1080px}',
      '.dcm-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:12px 18px;flex-wrap:wrap}',
      '.dcm-tete .v2-sous{margin-top:4px}',
      '.dcm-ajout{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-blue);font-family:var(--font);font-size:14.5px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.dcm-ajout:hover{border-color:var(--ip-blue)}',
      '.dcm-ajout:focus-within{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.dcm-ajout input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
      'svg.dcm-i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.dcm-outils{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin:18px 0 4px}',
      '.dcm-champ{flex:1 1 240px;margin:0}',
      '.dcm-champ input,.dcm-champ input:focus{font-size:16px;border:0;box-shadow:none;outline:0;background:transparent;border-radius:0;-webkit-appearance:none;appearance:none}',
      '.dcm-fams{display:flex;gap:8px;flex-wrap:wrap}',
      '.dcm-fam{min-height:40px;padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--card);font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}',
      '.dcm-fam[aria-pressed="true"]{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.dcm-fam:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.dcm-h{display:flex;align-items:baseline;gap:10px;margin:26px 2px 12px}',
      '.dcm-h h2{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.dcm-h span{font-size:13.5px;color:var(--muted);font-weight:600}',
      '.dcm-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:16px}',
      '.dcm-cw{position:relative;display:flex;min-width:0}',
      '.dcm-carte{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;padding:0;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-family:var(--font);text-align:left;color:var(--ip-ink);cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:border-color .15s,box-shadow .15s,transform .15s}',
      '.dcm-carte:hover{border-color:var(--line-strong);box-shadow:0 14px 28px -16px rgba(16,24,40,.34);transform:translateY(-1px)}',
      '.dcm-carte:active{transform:none;background:var(--card-2)}',
      '.dcm-carte:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      // la lumière : un halo clair en haut de la vignette, la page posée dessus avec son ombre
      '.dcm-ap{position:relative;display:block;aspect-ratio:3/4;background:radial-gradient(120% 85% at 50% 0%,#fff 0%,var(--surf-sunken) 100%);border-bottom:1px solid var(--line)}',
      '.dcm-ap img{position:absolute;inset:0;margin:auto;display:block;max-width:calc(100% - 26px);max-height:calc(100% - 26px);width:auto;height:auto;background:#fff;border-radius:2px;box-shadow:0 1px 2px rgba(16,24,40,.14),0 12px 26px -12px rgba(16,24,40,.36);opacity:0;transition:opacity .25s}',
      '.dcm-ap img.dcm-vu{opacity:1}',
      '.dcm-pic{position:absolute;inset:0;margin:auto;width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--halo);color:var(--ip-blue)}',
      '.dcm-ap.dcm-ok .dcm-pic{display:none}',
      '.dcm-cc{display:flex;flex-direction:column;gap:4px;padding:10px 12px 12px;min-width:0}',
      '.dcm-t{font-size:14.5px;font-weight:700;line-height:1.3;color:var(--ip-ink);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.dcm-m{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.dcm-neuf{display:inline-flex;align-items:center;height:20px;padding:0 8px;margin-left:6px;border-radius:var(--r-pill);background:var(--halo);color:var(--ip-blue-d);font-size:11.5px;font-weight:800}',
      '.dcm-rt{position:absolute;top:0;right:0;z-index:2;min-width:44px;height:44px;padding:0 6px;border:0;background:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-family:var(--font);-webkit-tap-highlight-color:transparent}',
      '.dcm-rt span{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:var(--r-pill);background:rgba(255,255,255,.95);border:1px solid var(--line-strong);box-shadow:var(--sh-1);font-size:12.5px;font-weight:700;color:var(--ip-ink-2)}',
      '.dcm-rt:hover span{color:var(--ip-blue-d);border-color:var(--ip-blue)}',
      '.dcm-rt:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-4px;border-radius:var(--r-control)}',
      // « Retirer » ne charge pas le mur : au survol ou au clavier à l'ordinateur ; au doigt, il est dans la visionneuse (même règle que Marketing › Documents partagés)
      '.dcm-rt{opacity:0;transition:opacity .15s}.dcm-cw:hover .dcm-rt,.dcm-rt:focus-visible{opacity:1}',
      '@media (hover:none){.dcm-rt{display:none}}',
      '.dcm-vide{padding:36px 20px;text-align:center;color:var(--ip-ink-2);font-size:15px}',
      '.dcm-alerte{margin:14px 0 0;padding:12px 14px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-size:14px;font-weight:600;line-height:1.4}',
      '.dcm-alerte[hidden]{display:none}',
      '.dcm-ok-msg{margin:14px 0 0;padding:12px 14px;border-radius:var(--r-md);background:#E3F5EC;color:var(--c-mint-txt);font-size:14px;font-weight:600}',
      '.dcm-ret{margin:30px 0 8px}',
      '.dcm-ret-t{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px;border:0;background:none;font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.dcm-rl{display:flex;align-items:center;gap:12px;padding:10px 14px;min-height:56px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.dcm-rl:last-child{border-bottom:0}',
      '.dcm-rl .dcm-t{flex:1}',
      // fenêtres (ajout, retrait) et visionneuse : posées sur <body> (la racine de l'app garde une transformation qui piégerait un « fixed »)
      '.dcm-fond{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;background:rgba(16,19,28,.46)}',
      '.dcm-dlg{box-sizing:border-box;width:min(480px,100%);margin:auto;padding:24px 24px 20px;border-radius:22px;font-family:var(--font);color:var(--ip-ink);background:radial-gradient(130% 75% at 0% 0%,var(--halo) 0%,rgba(233,240,255,0) 62%),var(--card);box-shadow:inset 0 1px 0 #fff,var(--sh-pop)}',
      '.dcm-dt{margin:0 0 8px;font-size:19px;line-height:1.3;font-weight:800;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dcm-ds{margin:0;font-size:15px;line-height:1.5;color:var(--ip-ink-2)}',
      '.dcm-lab{display:block;margin:16px 0 6px;font-size:13px;font-weight:800;color:var(--ip-ink-2)}',
      '.dcm-in{box-sizing:border-box;width:100%;min-height:46px;padding:0 12px;border:1px solid var(--line-strong);border-radius:var(--r-control);font-family:var(--font);font-size:16px;color:var(--ip-ink);background:var(--card)}',
      '.dcm-in:focus{outline:2px solid var(--ip-blue);outline-offset:1px}',
      '.dcm-choix{display:flex;flex-wrap:wrap;gap:8px}',
      '.dcm-dp{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}',
      '.dcm-dlg .v2-btn{min-height:44px;white-space:nowrap}',
      '.dcm-de{margin:14px 0 0;padding:12px 14px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-size:14px;font-weight:600;line-height:1.4}',
      '.dcm-de[hidden]{display:none}',
      '.dcm-vis{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:#1B1F2A;color:#fff;font-family:var(--font)}',
      '.dcm-vh{flex:none;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 18px;padding-top:max(10px,env(safe-area-inset-top));background:#11141C;border-bottom:1px solid rgba(255,255,255,.08)}',
      '.dcm-vt{flex:1;min-width:0}',
      '.dcm-vt b{display:block;font-size:16px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dcm-vt small{display:block;font-size:13px;color:rgba(255,255,255,.66);margin-top:2px}',
      '.dcm-vb{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:44px;padding:0 14px;border:1px solid rgba(255,255,255,.22);border-radius:var(--r-btn);background:transparent;color:#fff;font-family:var(--font);font-size:14.5px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.dcm-vb:hover{background:rgba(255,255,255,.08)}',
      '.dcm-vb:focus-visible{outline:2px solid #8FB2FF;outline-offset:2px}',
      '.dcm-vb.dcm-x{padding:0;width:44px;border-color:transparent}',
      '.dcm-vb[disabled]{opacity:.5;cursor:default}',
      '.dcm-vc{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:18px 12px 40px;padding-bottom:max(40px,env(safe-area-inset-bottom))}',
      '.dcm-pg{position:relative;width:min(900px,100%);margin:0 auto 14px;background:#fff;border-radius:3px;box-shadow:0 10px 30px -12px rgba(0,0,0,.6)}',
      '.dcm-pg canvas{display:block;width:100%;height:auto;border-radius:3px}',
      '.dcm-pn{position:absolute;right:8px;bottom:8px;padding:2px 8px;border-radius:var(--r-pill);background:rgba(17,20,28,.72);color:#fff;font-size:12px;font-weight:700}',
      '.dcm-vmsg{margin:18vh auto 0;max-width:420px;text-align:center;font-size:15px;line-height:1.5;color:rgba(255,255,255,.86)}',
      '@media (max-width:480px){.dcm-grille{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dcm-cc{padding:9px 10px 11px}.dcm-t{font-size:14px}',
      '.dcm-fams{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;padding:2px 0 4px;scrollbar-width:none}.dcm-fams::-webkit-scrollbar{display:none}',
      '.dcm-dlg{padding:20px 18px 16px}.dcm-dp .v2-btn{flex:1}.dcm-vh{padding-left:12px}.dcm-vb .dcm-lib{display:none}.dcm-vb{padding:0;width:44px}.dcm-vc{padding:10px 6px 30px}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  var P = {
    pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4',
    plus: 'M12 5v14M5 12h14',
    search: 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM16 16l4 4',
    x: 'M6 6l12 12M18 6L6 18',
    envoi: 'M12 15V4M8 8l4-4 4 4M5 12v7h14v-7',
    chev: 'M9 5l7 7-7 7',
    retirer: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM8 12h8'
  };
  function ic(n, cls) { return '<svg class="' + (cls || 'dcm-i') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }

  // ——— Source Supabase (en ligne) ———
  var sourceSb = {
    lister: function () {
      var c = sb(); if (!c || !c.from) return Promise.reject(new Error('hors ligne'));
      return Promise.resolve(c.from(TABLE).select('id,sha1,titre,famille,pages,taille,ordre,ajoute_le,retire_le').order('ordre', { ascending: true }).order('ajoute_le', { ascending: true }))
        .then(function (r) { if (!r || r.error || !Array.isArray(r.data)) throw new Error('liste refusée'); return r.data; });
    },
    peutRetirer: function () {
      var c = sb(); if (!c || !c.rpc) return Promise.resolve(false);
      return Promise.resolve(c.rpc('documents_commerciaux_retrait_ok')).then(function (r) { return !!(r && !r.error && r.data === true); }, function () { return false; });
    },
    apercus: function (shas) {
      var c = sb(); if (!c || !c.storage || !shas.length) return Promise.resolve({});
      return c.storage.from(BUCKET).createSignedUrls(shas.map(function (s) { return 'apercus/' + s + '.jpg'; }), 3600).then(function (r) {
        var m = {}; if (!r || r.error || !r.data) return m;
        r.data.forEach(function (x, i) { m[shas[i]] = (x && !x.error && x.signedUrl) || false; });
        return m;
      });
    },
    urlPdf: function (sha) {
      var c = sb(); if (!c || !c.storage) return Promise.reject(new Error('hors ligne'));
      return c.storage.from(BUCKET).createSignedUrl('pdf/' + sha + '.pdf', 3600).then(function (r) { var u = r && !r.error && r.data && r.data.signedUrl; if (!u) throw new Error('adresse refusée'); return u; });
    },
    ajouter: function (o) {
      var c = sb(); if (!c || !c.storage || !c.from) return Promise.reject(new Error('hors ligne'));
      var st = c.storage.from(BUCKET);
      // un fichier déjà stocké (même empreinte) n'est pas une erreur : seule la ligne de la liste compte
      function deja(r) { return r && r.error && /exist|duplicate|409/i.test(String(r.error.message || r.error.statusCode || r.error.error || '')); }
      return st.upload('pdf/' + o.sha1 + '.pdf', o.file, { contentType: 'application/pdf', upsert: false }).then(function (r) {
        if (r && r.error && !deja(r)) throw new Error('envoi du PDF refusé');
        return o.apercu ? st.upload('apercus/' + o.sha1 + '.jpg', o.apercu, { contentType: 'image/jpeg', upsert: false }) : null;
      }).then(function () {
        return c.from(TABLE).insert({ sha1: o.sha1, titre: o.titre, famille: o.famille, pages: o.pages, taille: o.file.size }).select('id,sha1,titre,famille,pages,taille,ordre,ajoute_le,retire_le');
      }).then(function (r) {
        if (r && r.error && r.error.code === '23505') { var e = new Error('doublon'); e.doublon = true; throw e; }
        if (!r || r.error || !r.data || !r.data[0]) throw new Error('liste refusée');
        return r.data[0];
      });
    },
    marquer: function (id, retire) {
      var c = sb(); if (!c || !c.from) return Promise.resolve(false);
      var v = retire ? { retire_le: new Date().toISOString(), retire_par: V2.user && V2.user.id } : { retire_le: null, retire_par: null };
      // .select() : zéro ligne rendue = la base a refusé en silence (règle d'accès)
      return Promise.resolve(c.from(TABLE).update(v).eq('id', id).select('id')).then(function (r) { return !!(r && !r.error && Array.isArray(r.data) && r.data.length); }, function () { return false; });
    }
  };
  function src() { return V2.doccomSource || sourceSb; }

  // ——— État (mémoire seule) ———
  var D = { etat: 'attente', tous: [], peut: false, lu: 0, q: '', fam: '', urls: {}, urlsLe: 0, msg: '', msgKo: false, retOuvert: false, promesse: null, blobs: {} };
  function visibles() { return D.tous.filter(function (d) { return !d.retire_le; }); }
  function retires() { return D.tous.filter(function (d) { return !!d.retire_le; }); }
  function trouver(id) { for (var i = 0; i < D.tous.length; i++) if (String(D.tous[i].id) === String(id) || D.tous[i].sha1 === id) return D.tous[i]; return null; }
  function trier() {
    var o = {}; FAMILLES.forEach(function (f, i) { o[f.k] = i; });
    D.tous.sort(function (a, b) { return (o[a.famille] - o[b.famille]) || ((a.ordre || 1000) - (b.ordre || 1000)) || String(a.ajoute_le || '').localeCompare(String(b.ajoute_le || '')); });
  }
  function charger(force) {
    if (D.promesse && !force) return D.promesse;
    if (!force && D.etat === 'pret' && Date.now() - D.lu < 10 * 60000) return Promise.resolve(visibles());
    D.etat = D.etat === 'pret' ? 'pret' : 'charge';
    D.promesse = Promise.all([src().lister(), src().peutRetirer()]).then(function (r) {
      D.tous = (r[0] || []).filter(function (d) { return d && d.sha1 && famDe(d.famille); });
      D.peut = r[1] === true; D.lu = Date.now(); D.etat = 'pret'; trier();
      return visibles();
    }, function () { if (D.etat !== 'pret') D.etat = 'echec'; return visibles(); }).then(function (l) { D.promesse = null; return l; });
    return D.promesse;
  }

  // ——— Aperçus : adresses signées de tout le mur EN UNE FOIS, gardées 45 min ———
  function signer(l) {
    if (D.urlsLe && Date.now() - D.urlsLe > 45 * 60000) { D.urls = {}; D.urlsLe = 0; }
    var need = l.map(function (d) { return d.sha1; }).filter(function (s, i, a) { return !Object.prototype.hasOwnProperty.call(D.urls, s) && a.indexOf(s) === i; });
    if (!need.length) return;
    need.forEach(function (s) { D.urls[s] = ''; });
    src().apercus(need).then(function (m) {
      if (!D.urlsLe) D.urlsLe = Date.now();
      need.forEach(function (s) { D.urls[s] = Object.prototype.hasOwnProperty.call(m, s) ? m[s] : false; });
      poser();
    }, function () { need.forEach(function (s) { if (D.urls[s] === '') delete D.urls[s]; }); });
  }
  function poser() {
    var z = document.getElementById('dcm-corps'); if (!z) return;
    [].forEach.call(z.querySelectorAll('img[data-sha]:not([src])'), function (im) {
      var u = D.urls[im.getAttribute('data-sha')];
      if (u) im.src = u; else if (u === false && im.parentNode) im.parentNode.removeChild(im);
    });
  }

  // ——— Rendu du mur ———
  function carte(d) {
    var u = D.urls[d.sha1];
    var neuf = d.ajoute_le && Date.now() - Date.parse(d.ajoute_le) < 14 * 86400000 && d.ordre >= 1000;
    return '<div class="dcm-cw"><button type="button" class="dcm-carte" data-voir="' + esc(d.sha1) + '"><span class="dcm-ap"><span class="dcm-pic">' + ic('pdf') + '</span>' +
      (u !== false ? '<img alt="" loading="lazy" decoding="async" data-sha="' + esc(d.sha1) + '"' + (u ? ' src="' + esc(u) + '"' : '') + '>' : '') + '</span>' +
      '<span class="dcm-cc"><span class="dcm-t">' + esc(d.titre) + '</span><span class="dcm-m">' + pages(d.pages) + (neuf ? '<span class="dcm-neuf">Nouveau</span>' : '') + '</span></span></button>' +
      (D.peut ? '<button type="button" class="dcm-rt" data-retirer="' + esc(d.id) + '" aria-label="Retirer « ' + esc(d.titre) + ' »"><span>Retirer</span></button>' : '') + '</div>';
  }
  function corps() {
    var el = document.getElementById('dcm-corps'); if (!el) return;
    if (D.etat === 'attente' || D.etat === 'charge') { el.innerHTML = '<div class="v2-loading" style="min-height:30vh"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
    if (D.etat === 'echec') {
      el.innerHTML = '<div class="v2-card"><div class="dcm-vide"><p style="margin:0 0 14px;font-weight:700;color:var(--ip-ink)">La liste des documents n’a pas pu être chargée.</p><button type="button" class="v2-btn v2-btn-primary" data-reessayer="1">Réessayer</button></div></div>';
      return;
    }
    var l = visibles(), q = norm(D.q), h = '';
    if (D.msg) h += '<p class="' + (D.msgKo ? 'dcm-alerte' : 'dcm-ok-msg') + '" role="status">' + esc(D.msg) + '</p>';
    var fams = FAMILLES.filter(function (f) { return !D.fam || f.k === D.fam; }), vus = [];
    fams.forEach(function (f) {
      var lf = l.filter(function (d) { return d.famille === f.k && (!q || q.split(' ').every(function (j) { return norm(d.titre).indexOf(j) >= 0; })); });
      if (!lf.length) return;
      vus = vus.concat(lf);
      h += '<section aria-labelledby="dcm-h-' + f.k + '"><div class="dcm-h"><h2 id="dcm-h-' + f.k + '">' + esc(f.nom) + '</h2><span>' + lf.length + ' document' + (lf.length > 1 ? 's' : '') + '</span></div>' +
        '<div class="dcm-grille">' + lf.map(carte).join('') + '</div></section>';
    });
    if (!vus.length) h += '<div class="v2-card" style="margin-top:18px"><div class="dcm-vide">' + (q ? 'Aucun document ne correspond à « ' + esc(D.q) + ' ».' : 'Aucun document pour l’instant. Le premier ajouté sera visible par toute l’équipe.') + '</div></div>';
    var r = D.peut ? retires() : [];
    if (r.length) {
      h += '<div class="dcm-ret"><button type="button" class="dcm-ret-t" data-ret-bascule="1" aria-expanded="' + D.retOuvert + '">' + ic('chev') + 'Retirés (' + r.length + ')</button>' +
        (D.retOuvert ? '<div class="v2-card" style="padding:0;overflow:hidden">' + r.map(function (d) { return '<div class="dcm-rl"><span class="dcm-t">' + esc(d.titre) + '</span><button type="button" class="v2-btn v2-btn-ghost" data-remettre="' + esc(d.id) + '">Remettre</button></div>'; }).join('') + '</div>' : '') + '</div>';
    }
    el.innerHTML = h;
    signer(vus);
  }

  // ——— Le PDF lui-même (gardé en mémoire le temps de la séance : la visionneuse puis l'envoi s'en servent) ———
  function blob(sha) {
    if (!D.blobs[sha]) {
      D.blobs[sha] = src().urlPdf(sha).then(function (u) { return fetch(u, { credentials: 'omit' }); })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
      D.blobs[sha].catch(function () { delete D.blobs[sha]; });
    }
    return D.blobs[sha];
  }
  function fichier(sha) {
    var d = trouver(sha);
    return blob(sha).then(function (b) { return new File([b], nomFichier(d || {}), { type: 'application/pdf' }); });
  }

  // pdf.js (Mozilla, Apache-2.0), build « legacy », la même version que Marketing › Documents partagés, chargé à la demande
  var pdfjsP = null;
  function pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsP) return pdfjsP;
    pdfjsP = new Promise(function (ok, ko) {
      var base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/';
      var s = document.createElement('script'); s.src = base + 'pdf.min.js';
      s.onload = function () { if (!window.pdfjsLib) { ko(new Error('pdf.js')); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = function () { pdfjsP = null; ko(new Error('pdf.js')); };
      document.head.appendChild(s);
    });
    return pdfjsP;
  }
  // isEvalSupported:false = la parade officielle à la faille CVE-2024-4367 de cette version (un PDF piégé exécutait du code) : tout compte peut déposer un PDF ici
  function ouvrirPdf(b) { return Promise.all([pdfjs(), b.arrayBuffer()]).then(function (r) { return r[0].getDocument({ data: new Uint8Array(r[1]), isEvalSupported: false }).promise; }); }
  function peindre(pdf, n, larg) {
    return pdf.getPage(n).then(function (pg) {
      var v1 = pg.getViewport({ scale: 1 }), sc = Math.min(larg / v1.width, 1800 / v1.width), vp = pg.getViewport({ scale: sc });   // au-delà de 1800 px, Safari refuse la toile sur iPhone
      var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { return cv; });
    });
  }

  // ——— Visionneuse plein écran ———
  var vis = null;
  function voir(sha, depuis) {
    var d = trouver(sha); if (!d || vis) return;
    var jeton = {}, ov = document.createElement('div');
    vis = { jeton: jeton, retour: depuis || document.activeElement, ov: ov, io: null };
    ov.className = 'dcm-vis'; ov.id = 'dcm-vis'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'dcm-vt');
    ov.innerHTML = '<div class="dcm-vh"><div class="dcm-vt"><b id="dcm-vt">' + esc(d.titre) + '</b><small>' + pages(d.pages) + ' · ' + esc((famDe(d.famille) || {}).nom || '') + '</small></div>' +
      (D.peut ? '<button type="button" class="dcm-vb" data-vretirer="1" aria-label="Retirer ce document">' + ic('retirer') + '<span class="dcm-lib" aria-hidden="true">Retirer</span></button>' : '') +
      '<button type="button" class="dcm-vb" data-envoyer="1" aria-label="Envoyer ce document" disabled>' + ic('envoi') + '<span class="dcm-lib" aria-hidden="true">Envoyer</span></button>' +
      '<button type="button" class="dcm-vb dcm-x" data-fermer="1" aria-label="Fermer">' + ic('x') + '</button></div>' +
      '<div class="dcm-vc" id="dcm-vc"><p class="dcm-vmsg">Ouverture du document…</p></div>';
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    ov.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      if (t.closest('[data-fermer]')) { fermerVis(); return; }
      if (t.closest('[data-vretirer]')) { fermerVis(); if (D.peut) confirmerRetrait(d); return; }
      if (t.closest('[data-envoyer]')) envoyer(d, t.closest('[data-envoyer]'));
    });
    document.addEventListener('keydown', toucheVis, true);
    window.addEventListener('hashchange', fermerVis);
    try { ov.querySelector('[data-fermer]').focus(); } catch (e) {}
    var zone = ov.querySelector('#dcm-vc');
    blob(sha).then(function (b) {
      if (!vis || vis.jeton !== jeton) return;
      vis.fichier = new File([b], nomFichier(d), { type: 'application/pdf' });
      var be = ov.querySelector('[data-envoyer]'); if (be) be.disabled = false;
      return ouvrirPdf(b).then(function (pdf) {
        if (!vis || vis.jeton !== jeton) return;
        zone.innerHTML = '';
        var larg = Math.min(900, zone.clientWidth - 12) * Math.min(window.devicePixelRatio || 1, 2);
        // les pages se peignent quand elles approchent de l'écran ; la première tout de suite
        return pdf.getPage(1).then(function (p1) {
          var v = p1.getViewport({ scale: 1 }), ratio = v.height / v.width;
          for (var i = 1; i <= pdf.numPages; i++) {
            var pg = document.createElement('div'); pg.className = 'dcm-pg'; pg.setAttribute('data-n', i);
            pg.style.aspectRatio = '1 / ' + ratio.toFixed(4);
            pg.innerHTML = '<span class="dcm-pn">' + i + ' / ' + pdf.numPages + '</span>';
            zone.appendChild(pg);
          }
          var faire = function (el) {
            if (el.getAttribute('data-p')) return; el.setAttribute('data-p', '1');
            peindre(pdf, +el.getAttribute('data-n'), larg).then(function (cv) { if (vis && vis.jeton === jeton) { el.style.aspectRatio = ''; el.insertBefore(cv, el.firstChild); } }, function () {});
          };
          if ('IntersectionObserver' in window) {
            vis.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { faire(e.target); vis.io.unobserve(e.target); } }); }, { root: zone, rootMargin: '900px 0px' });
            [].forEach.call(zone.querySelectorAll('.dcm-pg'), function (el) { vis.io.observe(el); });
          } else [].forEach.call(zone.querySelectorAll('.dcm-pg'), faire);
        });
      });
    }).catch(function () {
      if (!vis || vis.jeton !== jeton) return;
      zone.innerHTML = '<p class="dcm-vmsg">Le document n’a pas pu s’ouvrir. Vérifiez votre connexion, puis réessayez.</p>';
    });
  }
  function toucheVis(e) {
    if (!vis) return;
    if (e.key === 'Escape') { e.preventDefault(); fermerVis(); return; }
    if (e.key !== 'Tab') return;
    var f = vis.ov.querySelectorAll('button:not([disabled])'); if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  function fermerVis() {
    if (!vis) return;
    var v = vis; vis = null;
    if (v.io) v.io.disconnect();
    document.removeEventListener('keydown', toucheVis, true);
    window.removeEventListener('hashchange', fermerVis);
    document.documentElement.style.overflow = '';
    if (v.ov.parentNode) v.ov.parentNode.removeChild(v.ov);
    if (v.retour && v.retour.focus && document.contains(v.retour)) { try { v.retour.focus(); } catch (e) {} }
  }
  // « Envoyer » : le fichier est déjà en mémoire, la feuille de partage s'ouvre DANS le geste (Safari la refuse après une attente) ; sinon, téléchargement
  function envoyer(d, btn) {
    var f = vis && vis.fichier; if (!f) return;
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: d.titre }).catch(function () {});
      return;
    }
    var u = URL.createObjectURL(f), a = document.createElement('a');
    a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
    if (btn) { var l = btn.querySelector('.dcm-lib'); if (l) { l.textContent = 'Téléchargé'; setTimeout(function () { l.textContent = 'Envoyer'; }, 2500); } }
  }

  // ——— Fenêtres (ajout, retrait) ———
  function fenetre(html, brancher) {
    if (document.getElementById('dcm-fond')) return null;
    var avant = document.activeElement, fond = document.createElement('div');
    fond.className = 'dcm-fond'; fond.id = 'dcm-fond'; fond.innerHTML = html;
    var api = { occupe: false, fond: fond, fermer: function () {
      document.removeEventListener('keydown', touche, true);
      if (fond.parentNode) fond.parentNode.removeChild(fond);
      if (avant && avant.focus && document.contains(avant)) { try { avant.focus(); } catch (e) {} }
    } };
    function touche(e) {
      if (e.key === 'Escape') { e.preventDefault(); if (!api.occupe) api.fermer(); return; }
      if (e.key !== 'Tab') return;
      var f = fond.querySelectorAll('button:not([disabled]),input:not([disabled])'); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    fond.addEventListener('click', function (e) { if (!api.occupe && (e.target === fond || (e.target.closest && e.target.closest('[data-non]')))) api.fermer(); });
    document.addEventListener('keydown', touche, true);
    document.body.appendChild(fond);
    brancher(api);
    return api;
  }
  function titreDe(nom) { return String(nom || '').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function sha1De(buf) { return crypto.subtle.digest('SHA-1', buf).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  function apercuDe(pdf) {
    return peindre(pdf, 1, 400).then(function (cv) {
      var w = 400, h = Math.round(cv.height * 400 / cv.width), c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
      var x = c2.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(cv, 0, 0, w, h);
      return new Promise(function (ok) { c2.toBlob(function (b) { ok(b); }, 'image/jpeg', 0.82); });
    });
  }
  function ajouter(file) {
    if (!file) return;
    var estPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!estPdf) { message('Seuls les PDF peuvent être ajoutés ici.', true); return; }
    if (file.size > MAX_OCTETS) { message('Ce PDF dépasse 50 Mo : il faut l’alléger avant de l’ajouter.', true); return; }
    var famSel = D.fam || '';
    var api = fenetre('<div class="dcm-dlg" role="dialog" aria-modal="true" aria-labelledby="dcm-dt">' +
      '<h2 class="dcm-dt" id="dcm-dt">Ajouter un document</h2><p class="dcm-ds">Il sera visible par toute l’équipe, ici et sur les fiches officine.</p>' +
      '<label class="dcm-lab" for="dcm-titre">Titre</label><input class="dcm-in" id="dcm-titre" maxlength="120" autocomplete="off" value="' + esc(titreDe(file.name)) + '">' +
      '<span class="dcm-lab" id="dcm-fl">Famille</span><div class="dcm-choix" role="group" aria-labelledby="dcm-fl">' +
      FAMILLES.map(function (f) { return '<button type="button" class="dcm-fam" data-f="' + f.k + '" aria-pressed="' + (f.k === famSel) + '">' + esc(f.nom) + '</button>'; }).join('') + '</div>' +
      '<p class="dcm-de" id="dcm-de" role="alert" hidden></p>' +
      '<div class="dcm-dp"><button type="button" class="v2-btn v2-btn-ghost" data-non="1">Annuler</button><button type="button" class="v2-btn v2-btn-primary" data-oui="1">Ajouter</button></div></div>', function (api) {
      var f = api.fond, err = f.querySelector('#dcm-de'), oui = f.querySelector('[data-oui]'), non = f.querySelector('[data-non]');
      function dire(t) { err.textContent = t; err.hidden = false; }
      f.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-f]');
        if (b) { famSel = b.getAttribute('data-f'); [].forEach.call(f.querySelectorAll('[data-f]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return; }
        if (!(e.target.closest && e.target.closest('[data-oui]')) || api.occupe) return;
        var titre = f.querySelector('#dcm-titre').value.replace(/\s+/g, ' ').trim();
        if (!titre) { dire('Donnez un titre au document.'); return; }
        if (!famSel) { dire('Choisissez sa famille.'); return; }
        api.occupe = true; oui.disabled = true; non.disabled = true; oui.textContent = 'Ajout en cours…'; err.hidden = true;
        file.arrayBuffer().then(function (buf) {
          return Promise.all([sha1De(buf), pdfjs().then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise; })]);
        }).then(function (r) {
          var sha = r[0], pdf = r[1];
          if (D.tous.some(function (d) { return d.sha1 === sha && !d.retire_le; })) { var e = new Error('doublon'); e.doublon = true; throw e; }
          return apercuDe(pdf).catch(function () { return null; }).then(function (ap) {
            return src().ajouter({ file: file, sha1: sha, titre: titre, famille: famSel, pages: pdf.numPages, apercu: ap });
          });
        }).then(function (row) {
          api.occupe = false; api.fermer();
          D.tous = D.tous.filter(function (d) { return d.sha1 !== row.sha1; }).concat([row]); trier();
          delete D.urls[row.sha1];
          message('« ' + row.titre + ' » est ajouté dans « ' + famDe(row.famille).nom + ' ».', false);
        }, function (e) {
          api.occupe = false; oui.disabled = false; non.disabled = false; oui.textContent = 'Ajouter';
          dire(e && e.doublon ? 'Ce document est déjà dans la liste.' : 'L’ajout n’a pas pu se faire : le document n’a pas été enregistré. Vérifiez votre connexion, puis réessayez.');
        });
      });
      try { f.querySelector('#dcm-titre').focus(); } catch (e) {}
    });
    return api;
  }
  function confirmerRetrait(d) {
    fenetre('<div class="dcm-dlg" role="alertdialog" aria-modal="true" aria-labelledby="dcm-dt" aria-describedby="dcm-ds">' +
      '<h2 class="dcm-dt" id="dcm-dt">Retirer « ' + esc(d.titre) + ' » ?</h2>' +
      '<p class="dcm-ds" id="dcm-ds">Il ne s’affichera plus pour personne, ni ici ni sur les fiches. Le fichier reste gardé : vous pourrez le remettre depuis « Retirés ».</p>' +
      '<p class="dcm-de" id="dcm-de" role="alert" hidden></p>' +
      '<div class="dcm-dp"><button type="button" class="v2-btn v2-btn-ghost" data-non="1">Annuler</button><button type="button" class="v2-btn v2-btn-primary" data-oui="1">Retirer</button></div></div>', function (api) {
      var f = api.fond, oui = f.querySelector('[data-oui]'), non = f.querySelector('[data-non]'), err = f.querySelector('#dcm-de');
      f.addEventListener('click', function (e) {
        if (!(e.target.closest && e.target.closest('[data-oui]')) || api.occupe) return;
        api.occupe = true; oui.disabled = true; non.disabled = true; oui.textContent = 'Retrait en cours…';
        src().marquer(d.id, true).then(function (ok) {
          api.occupe = false;
          if (ok) { d.retire_le = new Date().toISOString(); api.fermer(); message('« ' + d.titre + ' » est retiré.', false); return; }
          oui.disabled = false; non.disabled = false; oui.textContent = 'Retirer';
          err.textContent = 'Le retrait n’a pas pu être enregistré : le document reste affiché.'; err.hidden = false;
        });
      });
      try { non.focus(); } catch (e) {}
    });
  }
  function remettre(d, b) {
    if (b) { b.disabled = true; b.textContent = 'Remise en cours…'; }
    src().marquer(d.id, false).then(function (ok) {
      if (ok) { d.retire_le = null; message('« ' + d.titre + ' » est de nouveau affiché.', false); }
      else message('La remise n’a pas pu être enregistrée : « ' + d.titre + ' » reste retiré.', true);
    });
  }
  var msgT = 0;
  function message(t, ko) { D.msg = t; D.msgKo = !!ko; corps(); clearTimeout(msgT); msgT = setTimeout(function () { D.msg = ''; if (actif()) corps(); }, 6000); }
  function actif() { return !!(V2.route && V2.route.name === 'doccom' && document.getElementById('dcm-root')); }

  // ——— Écran ———
  function gabarit() {
    return '<div class="v2-wrap v2-u dcm-wrap" id="dcm-root">' +
      '<div class="dcm-tete"><div><h1 class="v2-titre">Documents commerciaux</h1><p class="v2-sous">Les PDF à montrer ou à envoyer aux pharmacies, rangés en quatre familles.</p></div>' +
      '<label class="dcm-ajout">' + ic('plus') + 'Ajouter un PDF<input type="file" accept="application/pdf,.pdf" id="dcm-fic"></label></div>' +
      '<div class="dcm-outils"><label class="v2-champ dcm-champ">' + ic('search') +
      '<input type="text" inputmode="search" id="dcm-q" placeholder="Rechercher un document…" aria-label="Rechercher un document" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>' +
      '<div class="dcm-fams" role="group" aria-label="Familles"><button type="button" class="dcm-fam" data-filtre="" aria-pressed="' + !D.fam + '">Tout</button>' +
      FAMILLES.map(function (f) { return '<button type="button" class="dcm-fam" data-filtre="' + f.k + '" aria-pressed="' + (D.fam === f.k) + '">' + esc(f.nom) + '</button>'; }).join('') + '</div></div>' +
      '<div id="dcm-corps"></div></div>';
  }
  function brancher() {
    var z = document.getElementById('dcm-root'); if (!z) return;
    var q = document.getElementById('dcm-q'), fic = document.getElementById('dcm-fic'), tmr = 0;
    q.value = D.q;
    q.addEventListener('input', function () { D.q = q.value; clearTimeout(tmr); tmr = setTimeout(corps, 120); });
    fic.addEventListener('change', function () { var f = fic.files && fic.files[0]; fic.value = ''; ajouter(f); });
    z.addEventListener('load', function (e) { var im = e.target; if (im && im.tagName === 'IMG' && im.parentNode) { im.classList.add('dcm-vu'); im.parentNode.classList.add('dcm-ok'); } }, true);
    z.addEventListener('error', function (e) { var im = e.target; if (im && im.tagName === 'IMG' && im.parentNode) im.parentNode.removeChild(im); }, true);
    z.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null, b; if (!t) return;
      if ((b = t.closest('[data-retirer]'))) { var d = trouver(b.getAttribute('data-retirer')); if (d && D.peut) confirmerRetrait(d); return; }
      if ((b = t.closest('[data-voir]'))) { voir(b.getAttribute('data-voir'), b); return; }
      if ((b = t.closest('[data-remettre]'))) { var r = trouver(b.getAttribute('data-remettre')); if (r) remettre(r, b); return; }
      if (t.closest('[data-ret-bascule]')) { D.retOuvert = !D.retOuvert; corps(); return; }
      if ((b = t.closest('[data-filtre]'))) {
        D.fam = b.getAttribute('data-filtre') || '';
        [].forEach.call(z.querySelectorAll('[data-filtre]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        corps(); return;
      }
      if (t.closest('[data-reessayer]')) { D.etat = 'charge'; corps(); charger(true).then(function () { if (actif()) corps(); }); }
    });
  }

  V2.pages.doccom = {
    needs: [],
    render: function (root) {
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (ferme()) { root.innerHTML = top + '<div class="v2-wrap v2-u dcm-wrap" id="dcm-root"><div class="v2-card"><div class="dcm-vide">Cet espace n’est pas ouvert pour votre compte.</div></div></div>'; return; }
      root.innerHTML = top + gabarit();
      brancher();
      corps();
      charger().then(function () { if (actif()) corps(); });
    }
  };

  // ——— Pour la fiche officine (fenêtre Transmettre) ———
  V2.doccom = {
    FAMILLES: FAMILLES,
    ouvert: function () { return !ferme(); },
    charger: function () { return ferme() ? Promise.resolve([]) : charger(); },
    // null = pas encore lue ; [] = lue vide ou en échec (voir echec())
    liste: function () { return D.etat === 'pret' ? visibles() : (D.etat === 'echec' ? [] : null); },
    echec: function () { return D.etat === 'echec'; },
    titre: function (sha) { var d = trouver(sha); return d ? d.titre : ''; },
    famille: function (k) { var f = famDe(k); return f ? f.nom : ''; },
    fichier: fichier
  };
})();
