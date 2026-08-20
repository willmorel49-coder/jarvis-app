/* ═══════════════════════════════════════════════════════════════════
   v2-mkt-li-plan.js — Rétro-planning LinkedIn 12 mois + validation direction
   + Veille secteur (benchmark 442 posts / 5 pages / 12 mois).
   100 % client-side. Supabase (V2.sb) primaire, repli localStorage ASSUMÉ
   (toast explicite : un repli silencieux ferait croire que c'est partagé).
   Safari-safe : pas de background-clip:text, pas de backdrop-filter,
   pas de filter:blur, pas de color-mix. Reliefs = box-shadow + rgba.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  function sb() { return (V2.sb && V2.sb()) || null; }
  function toast(m, v) { if (V2.toast) V2.toast(m, v); }

  /* ─────────────────────── CSS ─────────────────────── */
  (function injectCss() {
    if (document.getElementById('lip-css')) return;
    var s = document.createElement('style'); s.id = 'lip-css';
    s.textContent = [
      /* ⚠️ Les jetons vivent sur :root, PAS sur .lip — le tiroir est monté dans
         <body>, hors de #v2-root : scopés au wrapper, tous les var() du tiroir
         seraient invalides (bouton blanc sur blanc, bordures invisibles). */
      ':root{--lip-ink:#141a24;--lip-ink70:#3a4152;--lip-ink50:#6b7280;--lip-ink35:#5A6270;',
      '--lip-bg:#F8FAFC;--lip-panel:#fff;--lip-line:#E6E9F0;--lip-line2:#eef1f6;--lip-blue:#0057FF;--lip-blue050:#eef3ff;',
      '--lip-sh:0 1px 2px rgba(10,14,26,.05),0 1px 3px rgba(10,14,26,.05);',
      '--lip-sh-md:0 6px 20px rgba(10,14,26,.08),0 2px 6px rgba(10,14,26,.05);',
      '--lip-ease:cubic-bezier(.22,.61,.36,1)}',
      '#v2-root .lip{max-width:1180px;margin:0 auto;padding:8px 22px 90px;color:var(--lip-ink)}',

      /* en-tête */
      '.lip-head{margin:6px 0 2px}',
      '.lip-h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.lip-sub{font-size:13px;color:var(--lip-ink50);margin-top:3px;line-height:1.5}',

      /* jauge d\'avancement */
      '.lip-prog{background:var(--lip-panel);border:1px solid var(--lip-line);border-radius:14px;padding:16px 18px;margin:16px 0 4px;box-shadow:var(--lip-sh)}',
      '.lip-progtop{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:11px}',
      '.lip-progn{font-size:19px;font-weight:800;letter-spacing:-.02em}',
      '.lip-progl{font-size:13px;color:var(--lip-ink50)}',
      '.lip-bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--lip-line2)}',
      '.lip-bar span{display:block;height:100%}',
      '.lip-keys{display:flex;gap:16px;flex-wrap:wrap;margin-top:11px}',
      '.lip-key{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--lip-ink70);font-weight:600}',
      '.lip-kd{width:10px;height:10px;border-radius:3px;flex:none}',

      /* barre outils */
      '.lip-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 6px}',
      '.lip-lab{font-size:12px;color:var(--lip-ink35);font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
      '.lip-sel,.lip-inp{height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--lip-line);background:var(--lip-panel);font:600 13.5px/1 inherit;color:var(--lip-ink70)}',
      '.lip-inp{min-width:190px;font-weight:500}',
      '.lip-inp:focus,.lip-sel:focus{outline:2px solid var(--lip-blue);outline-offset:1px}',
      '.lip-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:20px;border:1px solid var(--lip-line);background:var(--lip-panel);font:600 12.5px/1 inherit;color:var(--lip-ink70);cursor:pointer;transition:all .15s var(--lip-ease)}',
      '.lip-chip .lip-cd{width:9px;height:9px;border-radius:50%;flex:none}',
      '.lip-chip.off{opacity:.38}',
      '.lip-chip:hover{border-color:#d3dae4}',
      '.lip-btn{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:9px;border:1px solid var(--lip-line);background:var(--lip-panel);font:600 13.5px/1 inherit;color:var(--lip-ink70);cursor:pointer;transition:all .15s var(--lip-ease)}',
      '.lip-btn:hover{background:var(--lip-bg);color:var(--lip-ink)}',
      '.lip-btn-p{background:var(--lip-blue);border-color:var(--lip-blue);color:#fff;font-weight:700;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lip-btn-p:hover{background:#0047d6;color:#fff;transform:translateY(-1px)}',
      '.lip-spacer{flex:1}',

      /* groupe mois */
      '.lip-mois{display:flex;align-items:center;gap:12px;margin:30px 2px 12px}',
      '.lip-mois h2{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;text-transform:capitalize}',
      '.lip-mline{flex:1;height:1px;background:var(--lip-line)}',
      '.lip-mcount{font-size:12px;font-weight:700;color:var(--lip-ink35)}',

      /* carte post */
      '.lip-card{display:grid;grid-template-columns:62px 1fr auto;gap:16px;align-items:start;background:var(--lip-panel);border:1px solid var(--lip-line);border-radius:14px;padding:15px 17px;margin-bottom:10px;box-shadow:var(--lip-sh);cursor:pointer;position:relative;overflow:hidden;transition:box-shadow .18s var(--lip-ease),border-color .18s,transform .18s var(--lip-ease)}',
      '.lip-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc,#ccc)}',
      '.lip-card:hover{box-shadow:var(--lip-sh-md);border-color:#dbe2ec;transform:translateY(-1px)}',
      '.lip-card:focus-visible{outline:2px solid var(--lip-blue);outline-offset:2px}',
      '.lip-when{text-align:center;padding-top:1px}',
      '.lip-dnum{font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1}',
      '.lip-ddow{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--lip-ink35);margin-top:3px}',
      '.lip-dh{font-size:11.5px;font-weight:600;color:var(--lip-ink50);margin-top:4px}',
      '.lip-body{min-width:0}',
      '.lip-meta{display:flex;align-items:center;gap:7px;margin-bottom:6px;flex-wrap:wrap}',
      '.lip-tag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:3px 9px 3px 8px;border-radius:20px}',
      '.lip-tag .lip-cd{width:8px;height:8px;border-radius:50%}',
      '.lip-fmt{font-size:11.5px;font-weight:600;color:var(--lip-ink35);padding:3px 9px;border-radius:20px;background:#f1f4f8}',
      '.lip-num{font-size:11.5px;font-weight:700;color:var(--lip-ink35)}',
      '.lip-titre{font-size:15px;font-weight:700;letter-spacing:-.01em;margin:0 0 4px;line-height:1.32}',
      '.lip-angle{font-size:12.5px;color:var(--lip-ink50);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.lip-right{display:flex;flex-direction:column;align-items:flex-end;gap:7px;white-space:nowrap}',
      '.lip-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 11px;border-radius:20px}',
      '.lip-pick{font-size:11.5px;color:var(--lip-ink35);font-weight:600}',

      /* drawer */
      '#lip-drawer .lip-scrim{position:fixed;inset:0;background:rgba(12,17,28,.42);opacity:0;transition:opacity .3s var(--lip-ease);z-index:900}',
      '#lip-drawer .lip-scrim.open{opacity:1}',
      '#lip-drawer .lip-dr{position:fixed;top:0;right:0;bottom:0;width:min(660px,100vw);background:#fff;box-shadow:-20px 0 60px rgba(10,14,26,.20);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .34s var(--lip-ease);z-index:901}',
      '#lip-drawer .lip-dr.open{transform:translateX(0)}',
      '.lip-drh{display:flex;align-items:flex-start;gap:12px;padding:20px 22px 16px;border-bottom:1px solid var(--lip-line2)}',
      '.lip-drh h2{margin:2px 0 0;font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.28}',
      '.lip-eyebrow{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--lip-ink35)}',
      '.lip-close{width:38px;height:38px;flex:none;border-radius:10px;border:1px solid var(--lip-line);background:#fff;color:var(--lip-ink70);cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.lip-close:hover{background:var(--lip-bg)}',
      '.lip-drb{flex:1;overflow-y:auto;padding:20px 22px 30px;-webkit-overflow-scrolling:touch}',
      '.lip-drf{display:flex;gap:9px;align-items:center;padding:14px 22px;border-top:1px solid var(--lip-line2);background:#fcfdfe;flex-wrap:wrap}',
      '.lip-field{margin-bottom:24px}',
      '.lip-flab{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--lip-ink35);margin-bottom:9px}',
      '.lip-note{font-size:13px;line-height:1.6;color:var(--lip-ink70);background:var(--lip-blue050);border-left:3px solid var(--lip-blue);border-radius:0 9px 9px 0;padding:11px 14px}',

      /* statuts */
      '.lip-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
      '.lip-stbtn{display:flex;align-items:center;gap:9px;min-height:46px;padding:0 14px;border-radius:10px;border:1.5px solid var(--lip-line);background:#fff;font:700 13.5px/1.25 inherit;color:var(--lip-ink70);cursor:pointer;text-align:left;transition:all .15s var(--lip-ease)}',
      '.lip-stbtn .lip-kd{width:11px;height:11px;border-radius:50%}',
      '.lip-stbtn:hover{background:var(--lip-bg)}',
      '.lip-stbtn.on{color:#fff;border-color:transparent}',

      /* variantes */
      '.lip-var{border:1.5px solid var(--lip-line);border-radius:12px;padding:14px 15px;margin-bottom:10px;cursor:pointer;background:#fff;transition:all .15s var(--lip-ease);position:relative}',
      '.lip-var:hover{border-color:#c9d3e2;background:#fcfdff}',
      '.lip-var.on{border-color:var(--lip-blue);background:var(--lip-blue050);box-shadow:0 0 0 3px rgba(0,87,255,.09)}',
      '.lip-vtop{display:flex;align-items:center;gap:9px;margin-bottom:9px}',
      '.lip-radio{width:19px;height:19px;border-radius:50%;border:2px solid #c3ccdb;flex:none;display:flex;align-items:center;justify-content:center;background:#fff}',
      '.lip-var.on .lip-radio{border-color:var(--lip-blue)}',
      '.lip-var.on .lip-radio::after{content:"";width:9px;height:9px;border-radius:50%;background:var(--lip-blue)}',
      '.lip-vton{font-size:13px;font-weight:800;letter-spacing:-.01em}',
      '.lip-vlen{font-size:11.5px;color:var(--lip-ink35);font-weight:600;margin-left:auto}',
      '.lip-vtxt{font-size:13.5px;line-height:1.62;color:var(--lip-ink70);white-space:pre-wrap;word-break:break-word}',
      '.lip-vaide{font-size:11.5px;color:var(--lip-ink35);margin-top:7px;font-style:italic}',

      '.lip-ta{width:100%;min-height:96px;padding:12px 14px;border-radius:10px;border:1.5px solid var(--lip-line);font:400 16px/1.55 inherit;color:var(--lip-ink);resize:vertical;background:#fff;box-sizing:border-box}',
      '.lip-ta:focus{outline:none;border-color:var(--lip-blue);box-shadow:0 0 0 3px rgba(0,87,255,.09)}',
      '.lip-hint{font-size:12px;color:var(--lip-ink35);margin-top:7px;line-height:1.5}',
      '.lip-tags{font-size:12.5px;color:var(--lip-ink50);font-weight:600;margin-top:8px}',
      '.lip-empty{text-align:center;padding:60px 20px;color:var(--lip-ink35);font-size:14px}',

      /* ── veille ── */
      '.lip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:14px;margin:16px 0 8px}',
      '.lip-scard{background:var(--lip-panel);border:1px solid var(--lip-line);border-radius:14px;padding:16px 17px;box-shadow:var(--lip-sh)}',
      '.lip-scard.nous{border-color:var(--lip-blue);box-shadow:0 0 0 3px rgba(0,87,255,.08),var(--lip-sh)}',
      '.lip-snom{font-size:14.5px;font-weight:800;letter-spacing:-.01em;margin-bottom:2px;line-height:1.3}',
      '.lip-sab{font-size:12px;color:var(--lip-ink35);font-weight:600;margin-bottom:12px}',
      '.lip-srow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid var(--lip-line2);font-size:12.5px}',
      '.lip-srow:last-child{border-bottom:none}',
      '.lip-sk{color:var(--lip-ink50)}',
      '.lip-sv{font-weight:800;letter-spacing:-.01em}',
      '.lip-sect{margin:34px 0 0}',
      '.lip-sect h2{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}',
      '.lip-sect p.lip-sd{font-size:13px;color:var(--lip-ink50);margin:0 0 14px;line-height:1.55;max-width:760px}',
      '.lip-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--lip-line);border-radius:12px;background:#fff;box-shadow:var(--lip-sh)}',
      '.lip-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}',
      '.lip-tbl th{text-align:left;padding:11px 14px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--lip-ink35);border-bottom:1px solid var(--lip-line);white-space:nowrap}',
      '.lip-tbl td{padding:10px 14px;border-bottom:1px solid var(--lip-line2);vertical-align:middle}',
      '.lip-tbl tr:last-child td{border-bottom:none}',
      '.lip-tbl td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}',
      '.lip-gap{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:800}',
      '.lip-gap.plus{background:#ffe9ee;color:#c2183c}',
      '.lip-gap.moins{background:#e6f7f0;color:#00734f}',
      '.lip-mini{height:8px;border-radius:4px;background:var(--lip-blue);display:inline-block;vertical-align:middle;min-width:2px}',
      '.lip-post{background:#fff;border:1px solid var(--lip-line);border-radius:12px;padding:14px 16px;margin-bottom:9px;box-shadow:var(--lip-sh)}',
      '.lip-pmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px;font-size:11.5px}',
      '.lip-psrc{font-weight:800;padding:3px 9px;border-radius:20px;background:var(--lip-blue050);color:var(--lip-blue)}',
      '.lip-pdate{color:var(--lip-ink35);font-weight:600}',
      '.lip-peng{margin-left:auto;font-weight:700;color:var(--lip-ink70);white-space:nowrap}',
      '.lip-ptxt{font-size:13.5px;line-height:1.6;color:var(--lip-ink70);white-space:pre-wrap;word-break:break-word}',
      '.lip-ptxt.clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}',
      '.lip-plus{border:0;background:transparent;color:var(--lip-blue);font:700 12.5px/1 inherit;cursor:pointer;padding:8px 0 0}',
      '.lip-load{text-align:center;padding:50px 20px;color:var(--lip-ink35);font-size:14px}',

      /* mobile */
      '@media(max-width:760px){',
      '#v2-root .lip{padding:6px 14px 90px}',
      '.lip-card{grid-template-columns:52px 1fr;gap:12px;padding:13px 14px}',
      '.lip-right{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:flex-start;gap:10px;flex-wrap:wrap}',
      '.lip-stats{grid-template-columns:1fr}',
      /* flex:1 laissait 28 px au champ de recherche derrière les deux listes
         déroulantes : sur mobile il prend sa propre ligne, en entier. */
      '.lip-inp{flex:1 1 100%;min-width:0;width:100%}',
      '.lip-sel{flex:1 1 44%;min-width:0}',
      '.lip-drh,.lip-drb,.lip-drf{padding-left:16px;padding-right:16px}',
      '.lip-btn,.lip-stbtn,.lip-close{min-height:44px}',
      /* 44 px partout au doigt, champs de saisie compris : à 36 px on rate la cible */
      '.lip-chip{height:44px}',
      '.lip-sel,.lip-inp{height:44px}',
      '}'
    ].join('');
    document.head.appendChild(s);
  })();

  /* ─────────────────── constantes ─────────────────── */
  // color = pastille et jauge (non-texte, le vif est permis).
  // txt   = libellé sur fond clair.  on = fond du bouton sélectionné, texte blanc.
  // Les trois sont distincts : mesuré sur le rendu, le vif sur fond clair
  // tombait à 2,4:1 — illisible. Voir [[feedback_mesurer_le_rendu_pas_le_code]].
  var STATUTS = [
    { k: 'attente',      label: 'En attente',     color: '#9aa1ae', bg: '#f1f4f8', txt: '#5A6270', on: '#5A6270' },
    { k: 'valide',       label: 'Validé',         color: '#00B37A', bg: '#e6f7f0', txt: '#00734F', on: '#00734F' },
    { k: 'retravailler', label: 'À retravailler', color: '#F39A1B', bg: '#fff4e0', txt: '#8A5200', on: '#A05E00' },
    { k: 'refuse',       label: 'Refusé',         color: '#FF4D6D', bg: '#ffe9ee', txt: '#C2183C', on: '#C2183C' }
  ];
  function statut(k) { for (var i = 0; i < STATUTS.length; i++) if (STATUTS[i].k === k) return STATUTS[i]; return STATUTS[0]; }
  var MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DOW = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  // mars, mai, juin, août ne s'abrègent pas : « mars. » est une faute
  var MOIS_CT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

  function plan() { return window.LI_PLAN || null; }
  function piliers() { return window.LI_PLAN_PILIERS || []; }
  function pilier(k) { var a = piliers(); for (var i = 0; i < a.length; i++) if (a[i].k === k) return a[i]; return { k: k, label: k, color: '#ccc', bg: '#eee' }; }
  function meta() { return window.LI_PLAN_META || {}; }

  /* ────────── chargement paresseux des données ────────── */
  // Le jeton de cache est repris du <script src> de CE fichier : il suit donc
  // automatiquement le bump global de index.html. Sans jeton, le navigateur
  // resservirait éternellement une vieille version des données.
  // Chemin ET jeton sont déduits du <script src> de CE fichier : les données se
  // chargent donc à côté du module, quel que soit l'emplacement de la page qui
  // l'inclut, et le jeton suit automatiquement le bump global de index.html.
  var _src = null;
  function monSrc() {
    if (_src !== null) return _src;
    _src = { base: '', jeton: '' };
    try {
      var sc = document.querySelectorAll('script[src*="v2-mkt-li-plan.js"]');
      if (sc.length) {
        var u = sc[sc.length - 1].getAttribute('src') || '';
        var q = u.indexOf('?');
        if (q >= 0) { _src.jeton = u.slice(q); u = u.slice(0, q); }
        _src.base = u.replace(/v2-mkt-li-plan\.js$/, '');
      }
    } catch (e) {}
    return _src;
  }

  var chargement = {};
  function charger(fichier, test) {
    if (test()) return Promise.resolve(true);
    if (chargement[fichier]) return chargement[fichier];
    chargement[fichier] = new Promise(function (ok) {
      var sc = document.createElement('script');
      var m = monSrc();
      sc.src = m.base + fichier + m.jeton;
      sc.onload = function () { ok(test()); };
      sc.onerror = function () { ok(false); };
      document.head.appendChild(sc);
    });
    return chargement[fichier];
  }

  /* ─────────────── état de validation ─────────────── */
  var LS = 'jarvis_li_plan_valid';
  var backend = 'local';
  var etats = {};          // plan_id -> {statut, variante, visuel, commentaire}
  var charge = false;

  function vide() { return { statut: 'attente', variante: null, visuel: null, commentaire: '' }; }
  function etat(n) { return etats[n] || vide(); }
  function localTout() { try { var o = JSON.parse(localStorage.getItem(LS) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
  function localEcrire(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }

  function chargerEtats() {
    var c = sb();
    if (!c) { backend = 'local'; etats = localTout(); return Promise.resolve(etats); }
    return c.from('linkedin_plan_valid').select('*').then(function (r) {
      if (r.error || !r.data) { backend = 'local'; etats = localTout(); return etats; }
      backend = 'supabase'; etats = {};
      r.data.forEach(function (x) {
        etats[x.plan_id] = { statut: x.statut || 'attente', variante: (x.variante === null || x.variante === undefined) ? null : x.variante,
          visuel: (x.visuel === null || x.visuel === undefined) ? null : x.visuel, commentaire: x.commentaire || '',
          qui: x.qui || '', updated_at: x.updated_at || null };
      });
      remonterLocal();
      return etats;
    }).catch(function () { backend = 'local'; etats = localTout(); return etats; });
  }

  // Un repli local antérieur ne doit pas rester orphelin : on le remonte une fois.
  function remonterLocal() {
    var c = sb(); if (!c) return;
    var loc = localTout(); var ids = Object.keys(loc); if (!ids.length) return;
    var manquants = ids.filter(function (id) { return !etats[id]; });
    if (!manquants.length) { localEcrire({}); return; }
    var rows = manquants.map(function (id) { return ligne(parseInt(id, 10), loc[id]); });
    c.from('linkedin_plan_valid').upsert(rows).then(function (r) {
      if (r.error) return;                       // on garde le repli, rien n'est perdu
      manquants.forEach(function (id) { etats[id] = loc[id]; });
      localEcrire({});
      toast(manquants.length + ' validation(s) de cet ordinateur partagée(s) avec l\'équipe');
    }).catch(function () {});
  }

  function ligne(n, e) {
    return { plan_id: n, statut: e.statut, variante: e.variante, visuel: e.visuel,
      commentaire: e.commentaire || '', qui: (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }

  function enregistrer(n, e) {
    etats[n] = e;
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_plan_valid').upsert(ligne(n, e)).then(function (r) {
        if (r.error) {
          var loc = localTout(); loc[n] = e; localEcrire(loc);
          toast('Enregistré sur cet ordinateur seulement — pas partagé avec l\'équipe', 'error');
          try { console.warn('[li-plan]', r.error.message); } catch (x) {}
        }
        return etats;
      }).catch(function () {
        var loc = localTout(); loc[n] = e; localEcrire(loc);
        toast('Enregistré sur cet ordinateur seulement — pas partagé avec l\'équipe', 'error');
        return etats;
      });
    }
    var loc = localTout(); loc[n] = e; localEcrire(loc);
    return Promise.resolve(etats);
  }

  /* ───────────────── filtres ───────────────── */
  var flt = { mois: '', statut: '', cache: {}, q: '' };

  function visible(p) {
    if (flt.cache[p.p]) return false;
    if (flt.mois && p.d.slice(0, 7) !== flt.mois) return false;
    if (flt.statut && etat(p.n).statut !== flt.statut) return false;
    if (flt.q) {
      var q = flt.q.toLowerCase();
      var foin = (p.titre + ' ' + p.angle + ' ' + p.tags + ' ' + p.t.map(function (t) { return t.txt; }).join(' ')).toLowerCase();
      if (foin.indexOf(q) < 0) return false;
    }
    return true;
  }

  /* ───────────────── rendu : rétro-planning ───────────────── */
  function moisLabel(ym) {
    var a = ym.split('-'); return MOIS[parseInt(a[1], 10) - 1] + ' ' + a[0];
  }

  function jauge() {
    var P = plan(), c = { attente: 0, valide: 0, retravailler: 0, refuse: 0 };
    P.forEach(function (p) { c[etat(p.n).statut] = (c[etat(p.n).statut] || 0) + 1; });
    var tot = P.length;
    var segs = STATUTS.map(function (s) {
      return c[s.k] ? '<span style="width:' + (100 * c[s.k] / tot) + '%;background:' + s.color + '" title="' + esc(s.label) + ' : ' + c[s.k] + '"></span>' : '';
    }).join('');
    var keys = STATUTS.map(function (s) {
      return '<span class="lip-key"><span class="lip-kd" style="background:' + s.color + '"></span>' + esc(s.label) + ' · ' + (c[s.k] || 0) + '</span>';
    }).join('');
    var traites = tot - (c.attente || 0);
    return '<div class="lip-prog">' +
      '<div class="lip-progtop"><span class="lip-progn">' + traites + ' / ' + tot + '</span>' +
        '<span class="lip-progl">posts passés en revue par la direction' +
        (backend === 'local' ? ' — ⚠️ décisions gardées sur cet ordinateur, pas partagées' : '') + '</span></div>' +
      '<div class="lip-bar">' + segs + '</div>' +
      '<div class="lip-keys">' + keys + '</div></div>';
  }

  function outils() {
    var P = plan();
    var moisDispo = []; var vus = {};
    P.forEach(function (p) { var m = p.d.slice(0, 7); if (!vus[m]) { vus[m] = 1; moisDispo.push(m); } });
    var optMois = '<option value="">Tous les mois</option>' + moisDispo.map(function (m) {
      return '<option value="' + m + '"' + (flt.mois === m ? ' selected' : '') + '>' + esc(moisLabel(m)) + '</option>';
    }).join('');
    var optSt = '<option value="">Tous les statuts</option>' + STATUTS.map(function (s) {
      return '<option value="' + s.k + '"' + (flt.statut === s.k ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    var chips = piliers().map(function (pl) {
      return '<button class="lip-chip' + (flt.cache[pl.k] ? ' off' : '') + '" onclick="V2.lip.togglePilier(\'' + pl.k + '\')" title="' + esc(pl.note) + '">' +
        '<span class="lip-cd" style="background:' + pl.color + '"></span>' + esc(pl.label) + '</button>';
    }).join('');
    return '<div class="lip-tools">' +
        '<select class="lip-sel" onchange="V2.lip.setMois(this.value)">' + optMois + '</select>' +
        '<select class="lip-sel" onchange="V2.lip.setStatut(this.value)">' + optSt + '</select>' +
        '<input class="lip-inp" type="search" placeholder="Rechercher un sujet…" value="' + esc(flt.q) + '" oninput="V2.lip.setQ(this.value)">' +
        '<span class="lip-spacer"></span>' +
        '<button class="lip-btn" onclick="V2.lip.exportCsv()">' + ICO('download', 16, 2) + 'Export CSV</button>' +
      '</div>' +
      '<div class="lip-tools" style="margin-top:2px"><span class="lip-lab">Piliers</span>' + chips + '</div>';
  }

  function carte(p) {
    var e = etat(p.n), st = statut(e.statut), pl = pilier(p.p);
    var d = new Date(p.d + 'T12:00:00');
    var choix = [];
    if (e.variante !== null && p.t[e.variante]) choix.push('Texte ' + (e.variante + 1));
    if (e.visuel !== null) choix.push('Visuel ' + (e.visuel + 1));
    if (e.commentaire) choix.push('commentaire');
    return '<div class="lip-card" style="--pc:' + pl.color + '" tabindex="0" role="button" ' +
      'onclick="V2.lip.ouvrir(' + p.n + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();V2.lip.ouvrir(' + p.n + ')}">' +
      '<div class="lip-when"><div class="lip-dnum">' + d.getDate() + '</div>' +
        '<div class="lip-ddow">' + DOW[d.getDay()] + '</div><div class="lip-dh">' + esc(p.h) + '</div></div>' +
      '<div class="lip-body">' +
        '<div class="lip-meta">' +
          '<span class="lip-num">#' + p.n + '</span>' +
          '<span class="lip-tag" style="background:' + pl.bg + ';color:' + (pl.txt || pl.color) + '"><span class="lip-cd" style="background:' + pl.color + '"></span>' + esc(pl.label) + '</span>' +
          '<span class="lip-fmt">' + esc(p.f) + '</span>' +
        '</div>' +
        '<h3 class="lip-titre">' + esc(p.titre) + '</h3>' +
        '<div class="lip-angle">' + esc(p.angle) + '</div>' +
      '</div>' +
      '<div class="lip-right">' +
        '<span class="lip-st" style="background:' + st.bg + ';color:' + st.txt + '">' + esc(st.label) + '</span>' +
        (choix.length ? '<span class="lip-pick">' + esc(choix.join(' · ')) + '</span>' : '') +
      '</div></div>';
  }

  function renderPlan(root) {
    if (!plan()) {
      root.innerHTML = coquille('<div class="lip-load">Chargement du rétro-planning…</div>');
      charger('mkt-li-plan-data.js', plan).then(function (ok) {
        if (!ok) { root.innerHTML = coquille('<div class="lip-empty">Le fichier du rétro-planning n\'a pas pu être chargé.</div>'); return; }
        redessine();
      });
      return;
    }
    if (!charge) {
      charge = true;
      chargerEtats().then(function () { redessine(); });
    }
    var P = plan().filter(visible);
    var corps = '';
    if (!P.length) corps = '<div class="lip-empty">Aucun post ne correspond à ces filtres.</div>';
    else {
      var courant = '';
      P.forEach(function (p) {
        var m = p.d.slice(0, 7);
        if (m !== courant) {
          courant = m;
          var n = P.filter(function (x) { return x.d.slice(0, 7) === m; }).length;
          corps += '<div class="lip-mois"><h2>' + esc(moisLabel(m)) + '</h2><div class="lip-mline"></div><span class="lip-mcount">' + n + ' post' + (n > 1 ? 's' : '') + '</span></div>';
        }
        corps += carte(p);
      });
    }
    root.innerHTML = coquille(jauge() + outils() + corps);
  }

  function coquille(corps) {
    var m = meta();
    var seg = (V2.mktLinkedin && V2.mktLinkedin.viewSeg) ? V2.mktLinkedin.viewSeg() : '';
    var titre = vue === 'veille' ? 'Veille secteur — 12 mois' : 'Rétro-planning LinkedIn — 12 mois';
    var sous = vue === 'veille'
      ? 'Ce que publient CERP, OCP, Sagitta Pharma et nous. ' + ((V() && V().nbPosts) || '—') + ' posts relevés, réactions et commentaires compris.'
      : (m.nb || 0) + ' posts · ' + esc(m.cadence || '') + ' · ' + esc(m.fenetre || '');
    return (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="lip">' +
        '<div class="lip-head" style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:220px"><h1 class="lip-h1">' + esc(titre) + '</h1>' +
          '<div class="lip-sub">' + esc(sous) + '</div></div>' + seg +
        '</div>' + corps +
      '</div>';
  }

  /* ───────────────── drawer de validation ───────────────── */
  var ouvert = null;   // {n, e}

  function hote() {
    var h = document.getElementById('lip-drawer');
    if (!h) { h = document.createElement('div'); h.id = 'lip-drawer'; document.body.appendChild(h); }
    return h;
  }
  function monter(html, deja) {
    var h = hote(); h.innerHTML = html;
    if (deja) { var d0 = h.querySelector('.lip-dr'), s0 = h.querySelector('.lip-scrim');
      if (d0) d0.className += ' open'; if (s0) s0.className += ' open'; return; }
    void h.offsetWidth;
    var d = h.querySelector('.lip-dr'), s = h.querySelector('.lip-scrim');
    if (s) s.className += ' open'; if (d) d.className += ' open';
  }
  function fermer() {
    ouvert = null;
    var h = document.getElementById('lip-drawer'); if (!h) return;
    var d = h.querySelector('.lip-dr'), s = h.querySelector('.lip-scrim');
    if (d) d.className = d.className.replace(' open', '');
    if (s) s.className = s.className.replace(' open', '');
    setTimeout(function () { if (!ouvert) h.innerHTML = ''; }, 340);
  }

  function drawerHtml() {
    var p = ouvert.p, e = ouvert.e, pl = pilier(p.p);
    var d = new Date(p.d + 'T12:00:00');
    var quand = JOURS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear() + ' à ' + p.h.replace(':', 'h');

    var stats = STATUTS.map(function (s) {
      var on = e.statut === s.k;
      return '<button class="lip-stbtn' + (on ? ' on' : '') + '"' + (on ? ' style="background:' + s.on + '"' : '') +
        ' onclick="V2.lip.setChamp(\'statut\',\'' + s.k + '\')">' +
        '<span class="lip-kd" style="background:' + (on ? '#fff' : s.color) + '"></span>' + esc(s.label) + '</button>';
    }).join('');

    var tons = (meta().tons || []);
    function tonMeta(k) { for (var i = 0; i < tons.length; i++) if (tons[i].k === k) return tons[i]; return { label: k, aide: '' }; }
    var vars = p.t.map(function (t, i) {
      var tm = tonMeta(t.ton);
      return '<div class="lip-var' + (e.variante === i ? ' on' : '') + '" onclick="V2.lip.setChamp(\'variante\',' + i + ')">' +
        '<div class="lip-vtop"><span class="lip-radio"></span><span class="lip-vton">Texte ' + (i + 1) + ' — ' + esc(tm.label) + '</span>' +
        '<span class="lip-vlen">' + t.txt.length + ' caractères</span></div>' +
        '<div class="lip-vtxt">' + esc(t.txt) + '</div>' +
        (tm.aide ? '<div class="lip-vaide">' + esc(tm.aide) + '</div>' : '') +
        '</div>';
    }).join('');

    var vis = p.v.map(function (v, i) {
      return '<div class="lip-var' + (e.visuel === i ? ' on' : '') + '" onclick="V2.lip.setChamp(\'visuel\',' + i + ')">' +
        '<div class="lip-vtop"><span class="lip-radio"></span><span class="lip-vton">Visuel ' + (i + 1) + '</span></div>' +
        '<div class="lip-vtxt">' + esc(v) + '</div></div>';
    }).join('');

    return '<div class="lip-scrim" onclick="V2.lip.fermer()"></div>' +
      '<aside class="lip-dr" role="dialog" aria-modal="true" aria-label="Validation du post ' + p.n + '">' +
        '<div class="lip-drh"><div style="flex:1;min-width:0">' +
          '<div class="lip-eyebrow">Post #' + p.n + ' · ' + esc(quand) + '</div>' +
          '<h2>' + esc(p.titre) + '</h2>' +
          '<div class="lip-meta" style="margin-top:9px">' +
            '<span class="lip-tag" style="background:' + pl.bg + ';color:' + (pl.txt || pl.color) + '"><span class="lip-cd" style="background:' + pl.color + '"></span>' + esc(pl.label) + '</span>' +
            '<span class="lip-fmt">' + esc(p.f) + '</span></div>' +
        '</div><button class="lip-close" onclick="V2.lip.fermer()" aria-label="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="lip-drb">' +
          '<div class="lip-field"><span class="lip-flab">Angle éditorial</span><div class="lip-note">' + esc(p.angle) + '</div></div>' +
          '<div class="lip-field"><span class="lip-flab">Décision de la direction</span><div class="lip-stats">' + stats + '</div></div>' +
          '<div class="lip-field"><span class="lip-flab">Choix du texte — 3 propositions</span>' + vars + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Choix du visuel — 2 propositions</span>' + vis + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Commentaire</span>' +
            '<textarea class="lip-ta" placeholder="Ce qu\'il faut changer, préciser, éviter…" oninput="V2.lip.setChamp(\'commentaire\',this.value)">' + esc(e.commentaire || '') + '</textarea>' +
            '<div class="lip-hint">Visible par toute l\'équipe. Utile surtout pour « à retravailler ».</div>' +
            '<div class="lip-tags">Hashtags prévus : ' + esc(p.tags) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="lip-drf">' +
          '<button class="lip-btn" onclick="V2.lip.copier()">' + ICO('fiche', 16, 1.8) + 'Copier le texte choisi</button>' +
          '<button class="lip-btn" onclick="V2.lip.versCalendrier()">' + ICO('cal', 16, 1.8) + 'Envoyer au calendrier</button>' +
          '<span class="lip-spacer"></span>' +
          '<button class="lip-btn lip-btn-p" onclick="V2.lip.enregistrer()">' + ICO('check', 17, 2.4) + 'Enregistrer</button>' +
        '</div>' +
      '</aside>';
  }

  /* ───────────────── rendu : veille ───────────────── */
  var veilleVue = { onglet: 'synthese', src: '', q: '', limite: 30, ouverts: {} };
  function V() { return window.LI_VEILLE || null; }

  // Les 442 posts de confreres ne sont PAS dans le depot (public) : ils vivent
  // dans la table `linkedin_veille`, lecture reservee aux comptes connectes.
  // On les charge une fois, et on DIT quand ça rate — un tableau vide affiche
  // sans explication ferait croire que les confreres ne publient rien.
  var vPosts = null, vEtat = 'vierge', vErreur = '';
  function chargerVeillePosts() {
    if (vEtat === 'encours' || vEtat === 'ok') return;
    var c = sb();
    if (!c) { vEtat = 'ko'; vErreur = 'Vous n\'êtes pas connecté à la base. Les posts des confrères ne sont lisibles qu\'avec une session ouverte.'; redessine(); return; }
    vEtat = 'encours';
    c.from('linkedin_veille').select('*').order('publie_le', { ascending: false })
      .then(function (r) {
        if (r.error || !r.data) { vEtat = 'ko'; vErreur = 'Lecture impossible : ' + ((r.error && r.error.message) || 'réponse vide') + '.'; redessine(); return; }
        vPosts = r.data.map(function (x) {
          var dt = new Date(x.publie_le);
          return { s: x.source, nom: x.source_nom, id: x.id, dt: dt,
            d: dt.toISOString().slice(0, 10), h: x.heure, j: x.jour,
            ty: x.type, nb: x.nb_medias, li: x.reactions, co: x.commentaires, sh: x.partages,
            th: x.themes || [], tags: x.hashtags || [], t: x.texte || '' };
        });
        vEtat = 'ok'; redessine();
      })
      .catch(function (e) { vEtat = 'ko'; vErreur = 'Lecture impossible : ' + String(e).slice(0, 120) + '.'; redessine(); });
  }

  function srcNom(k) { var v = V(); for (var i = 0; i < v.sources.length; i++) if (v.sources[i].k === k) return v.sources[i].nom; return k; }

  function cartesSources() {
    var v = V();
    return '<div class="lip-grid">' + v.sources.map(function (s) {
      return '<div class="lip-scard' + (s.nous ? ' nous' : '') + '">' +
        '<div class="lip-snom">' + esc(s.nom) + '</div>' +
        '<div class="lip-sab">' + s.abonnes.toLocaleString('fr-FR') + ' abonnés</div>' +
        '<div class="lip-srow"><span class="lip-sk">Posts sur 12 mois</span><span class="lip-sv">' + s.n + '</span></div>' +
        '<div class="lip-srow"><span class="lip-sk">Par semaine</span><span class="lip-sv">' + s.parSemaine.toFixed(2).replace('.', ',') + '</span></div>' +
        '<div class="lip-srow"><span class="lip-sk">Réactions (médiane)</span><span class="lip-sv">' + s.reactMed + '</span></div>' +
        '<div class="lip-srow"><span class="lip-sk">Partages (médiane)</span><span class="lip-sv">' + s.partMed + '</span></div>' +
        '<div class="lip-srow"><span class="lip-sk">Engagement /1000 ab.</span><span class="lip-sv">' + String(s.engPour1000).replace('.', ',') + '</span></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function tableauEcarts() {
    var v = V();
    var lignes = v.ecarts.map(function (e) {
      var cls = e.ecart > 0 ? 'plus' : 'moins';
      var signe = e.ecart > 0 ? '+' : '';
      return '<tr><td>' + esc(e.th) + '</td>' +
        '<td class="num">' + e.nous + ' %</td>' +
        '<td class="num">' + e.conc + ' %</td>' +
        '<td class="num">' + (Math.abs(e.ecart) >= 3 ? '<span class="lip-gap ' + cls + '">' + signe + e.ecart + ' pts</span>' : '<span style="color:#9aa1ae">—</span>') + '</td></tr>';
    }).join('');
    return '<div class="lip-tblwrap"><table class="lip-tbl">' +
      '<thead><tr><th>Thème</th><th style="text-align:right">Nous</th><th style="text-align:right">Confrères</th><th style="text-align:right">Écart</th></tr></thead>' +
      '<tbody>' + lignes + '</tbody></table></div>';
  }

  function tableauMed(titre, obj, libelle, tri) {
    var cles = Object.keys(obj);
    cles.sort(function (a, b) { return obj[b][1] - obj[a][1]; });
    var max = Math.max.apply(null, cles.map(function (k) { return obj[k][1]; }));
    var lignes = cles.map(function (k) {
      var n = obj[k][0], m = obj[k][1];
      return '<tr><td>' + esc(libelle(k)) + '</td><td class="num">' + n + '</td><td class="num">' + String(m).replace('.', ',') + '</td>' +
        '<td style="width:130px"><span class="lip-mini" style="width:' + Math.round(100 * m / max) + '%"></span></td></tr>';
    }).join('');
    return '<div class="lip-tblwrap"><table class="lip-tbl">' +
      '<thead><tr><th>' + esc(titre) + '</th><th style="text-align:right">Posts</th><th style="text-align:right">Engag. /1000 ab.</th><th></th></tr></thead>' +
      '<tbody>' + lignes + '</tbody></table></div>';
  }

  function renderVeilleSynthese() {
    var v = V(), a = v.agregats;
    var nous = null; v.sources.forEach(function (s) { if (s.nous) nous = s; });
    var meilleurJour = Object.keys(a.jourConc).sort(function (x, y) { return a.jourConc[y][1] - a.jourConc[x][1]; })[0];
    var meilleureHeure = Object.keys(a.heureConc).sort(function (x, y) { return a.heureConc[y][1] - a.heureConc[x][1]; })[0];
    return cartesSources() +
      // Sans cet avertissement, « 53,7 contre 2,5 » se lit comme une victoire.
      // C'est un artefact : sur 564 abonnés dont une part de collègues, le taux
      // monte mécaniquement. Un chiffre qu'on ne sait pas lire vaut mieux écrit.
      '<p class="lip-sd" style="margin:10px 0 0">⚠️ L\'engagement pour 1000 abonnés n\'est pas un classement. ' +
      'Sur une petite base — 564 abonnés, dont une partie de collègues et de partenaires — ce taux monte ' +
      'mécaniquement. Il sert à comparer des <b>thèmes</b> et des <b>formats</b> entre eux, pas des pages entre elles.</p>' +
      '<div class="lip-sect"><h2>Ce que les confrères couvrent et pas nous</h2>' +
      '<p class="lip-sd">Part des posts qui abordent chaque thème. « Confrères » = moyenne de CERP, CERP Bretagne Atlantique, OCP Répartition et Sagitta Pharma. Un écart positif est un angle qu\'ils occupent et que nous laissons vide.<br>' +
      '<b>Comment c\'est calculé :</b> par mots-clés dans le texte des posts. Un post peut compter dans plusieurs thèmes, et le classement reste approximatif — ' +
      'à lire comme un ordre de grandeur, pas comme un décompte exact. Les écarts de plus de 20 points sont robustes ; ceux de 3 à 7 points ne le sont pas.</p>' +
      tableauEcarts() + '</div>' +
      '<div class="lip-sect"><h2>Quel thème fait réagir</h2>' +
      '<p class="lip-sd">Engagement médian rapporté à 1000 abonnés, chez les confrères uniquement (notre page est trop petite pour être comparée brut). Les coulisses logistiques arrivent en tête — et c\'est justement notre plus gros angle mort.</p>' +
      tableauMed('Thème', a.themeConc, function (k) { return k; }) + '</div>' +
      '<div class="lip-sect"><h2>Quel format fait réagir</h2>' +
      tableauMed('Format', a.formatConc, function (k) { return k; }) + '</div>' +
      '<div class="lip-sect"><h2>Quand publier</h2>' +
      '<p class="lip-sd">Le meilleur jour mesuré est le <b>' + esc(JOURS[parseInt(meilleurJour, 10)].toLowerCase()) + '</b> et le meilleur créneau <b>' + meilleureHeure + 'h–' + (parseInt(meilleureHeure, 10) + 1) + 'h</b>. C\'est exactement sur ces créneaux qu\'est calé le rétro-planning : mardi 11h et jeudi 9h30.</p>' +
      tableauMed('Jour', a.jourConc, function (k) { return JOURS[parseInt(k, 10)]; }) +
      '<div style="height:14px"></div>' +
      tableauMed('Créneau', a.heureConc, function (k) { return k + 'h – ' + (parseInt(k, 10) + 1) + 'h'; }) + '</div>';
  }

  function renderVeillePosts() {
    var v = V();
    if (vEtat !== 'ok') {
      chargerVeillePosts();
      if (vEtat === 'ko') {
        return '<div class="lip-empty" style="max-width:620px;margin:0 auto">' +
          '<p style="font-size:15px;color:var(--lip-ink70);line-height:1.6"><b>Les posts des confrères ne s\'affichent pas.</b><br>' + esc(vErreur) + '</p>' +
          '<p style="margin-top:14px">Les statistiques de l\'onglet « Synthèse » restent lisibles : elles sont calculées et stockées dans l\'app.</p></div>';
      }
      return '<div class="lip-load">Lecture des ' + ((v && v.nbPosts) || '') + ' posts…</div>';
    }
    var liste = vPosts.filter(function (p) {
      if (veilleVue.src && p.s !== veilleVue.src) return false;
      if (veilleVue.q) {
        var q = veilleVue.q.toLowerCase();
        if ((p.t || '').toLowerCase().indexOf(q) < 0 && (p.tags || []).join(' ').toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    if (veilleVue.onglet === 'top') liste = liste.slice().sort(function (x, y) {
      return ((y.li || 0) + (y.co || 0) + (y.sh || 0)) - ((x.li || 0) + (x.co || 0) + (x.sh || 0));
    });
    var tot = liste.length;
    liste = liste.slice(0, veilleVue.limite);
    var optSrc = '<option value="">Toutes les pages</option>' + v.sources.map(function (s) {
      return '<option value="' + s.k + '"' + (veilleVue.src === s.k ? ' selected' : '') + '>' + esc(s.nom) + '</option>';
    }).join('');
    var corps = liste.map(function (p) {
      var d = p.dt;
      var ouvert2 = veilleVue.ouverts[p.id];
      var court = (p.t || '').length > 420;
      return '<div class="lip-post">' +
        '<div class="lip-pmeta">' +
          '<span class="lip-psrc">' + esc(p.nom || srcNom(p.s)) + '</span>' +
          '<span class="lip-pdate">' + DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_CT[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + esc(p.h) + '</span>' +
          '<span class="lip-fmt">' + esc(p.ty) + (p.nb ? ' ×' + p.nb : '') + '</span>' +
          '<span class="lip-peng">' + (p.li || 0) + ' réact. · ' + (p.co || 0) + ' comm. · ' + (p.sh || 0) + ' part.</span>' +
        '</div>' +
        '<div class="lip-ptxt' + (court && !ouvert2 ? ' clamp' : '') + '">' + esc(p.t || '(pas de texte)') + '</div>' +
        (court ? '<button class="lip-plus" onclick="V2.lip.togglePost(\'' + p.id + '\')">' + (ouvert2 ? 'Réduire' : 'Voir tout le texte') + '</button>' : '') +
        ((p.tags && p.tags.length) ? '<div class="lip-tags">' + esc(p.tags.join(' ')) + '</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="lip-tools">' +
        '<select class="lip-sel" onchange="V2.lip.setVSrc(this.value)">' + optSrc + '</select>' +
        '<input class="lip-inp" type="search" placeholder="Rechercher dans les ' + (v.nbPosts || 0) + ' posts…" value="' + esc(veilleVue.q) + '" oninput="V2.lip.setVQ(this.value)">' +
        '<span class="lip-spacer"></span><span class="lip-lab">' + tot + ' post' + (tot > 1 ? 's' : '') + '</span>' +
      '</div>' + (corps || '<div class="lip-empty">Aucun post ne correspond.</div>') +
      (tot > veilleVue.limite ? '<div style="text-align:center;margin-top:16px"><button class="lip-btn" onclick="V2.lip.plusPosts()">Afficher 30 de plus</button></div>' : '');
  }

  function renderVeille(root) {
    if (!V()) {
      root.innerHTML = coquille('<div class="lip-load">Chargement de la veille…</div>');
      charger('mkt-li-veille-data.js', V).then(function (ok) {
        if (!ok) { root.innerHTML = coquille('<div class="lip-empty">Le fichier de veille n\'a pas pu être chargé.</div>'); return; }
        redessine();
      });
      return;
    }
    var v = V();
    var onglets = [['synthese', 'Synthèse'], ['top', 'Top engagement'], ['tous', 'Tous les posts']];
    var nav = '<div class="lip-tools" style="margin-top:14px">' + onglets.map(function (o) {
      return '<button class="lip-btn' + (veilleVue.onglet === o[0] ? ' lip-btn-p' : '') + '" onclick="V2.lip.setOnglet(\'' + o[0] + '\')">' + esc(o[1]) + '</button>';
    }).join('') + '<span class="lip-spacer"></span>' +
      '<span class="lip-lab">Relevé le ' + esc(v.captureUTC.slice(8, 10) + '/' + v.captureUTC.slice(5, 7) + '/' + v.captureUTC.slice(0, 4)) + '</span></div>';
    var corps = veilleVue.onglet === 'synthese' ? renderVeilleSynthese() : renderVeillePosts();
    root.innerHTML = coquille(nav + corps);
  }

  /* ───────────────── routage interne ───────────────── */
  var vue = 'plan';
  function redessine() { if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin') V2.render(); }

  function render(root, quelle) {
    vue = quelle || 'plan';
    if (vue === 'veille') return renderVeille(root);
    return renderPlan(root);
  }

  /* ───────────────── API publique ───────────────── */
  V2.liPlan = { render: function (r) { return render(r, 'plan'); } };
  V2.liVeille = { render: function (r) { return render(r, 'veille'); } };
  V2.lip = V2.lip || {};

  V2.lip.setMois = function (v) { flt.mois = v; redessine(); };
  V2.lip.setStatut = function (v) { flt.statut = v; redessine(); };
  V2.lip.setQ = function (v) { flt.q = v; clearTimeout(V2.lip._t); V2.lip._t = setTimeout(redessine, 260); };
  V2.lip.togglePilier = function (k) { flt.cache[k] = !flt.cache[k]; redessine(); };

  V2.lip.ouvrir = function (n) {
    var P = plan(); if (!P) return;
    var p = null; for (var i = 0; i < P.length; i++) if (P[i].n === n) { p = P[i]; break; }
    if (!p) return;
    var e = etat(n);
    ouvert = { n: n, p: p, e: { statut: e.statut, variante: e.variante, visuel: e.visuel, commentaire: e.commentaire || '' } };
    monter(drawerHtml());
  };
  V2.lip.fermer = fermer;
  V2.lip.setChamp = function (champ, val) {
    if (!ouvert) return;
    ouvert.e[champ] = val;
    if (champ === 'commentaire') return;          // ne pas redessiner sous les doigts
    // Redessiner remet le tiroir en haut : sur un post long, l'utilisateur qui
    // clique « Visuel 2 » se retrouvait propulsé au titre. On garde la position.
    var corps = document.querySelector('#lip-drawer .lip-drb');
    var y = corps ? corps.scrollTop : 0;
    monter(drawerHtml(), true);
    var corps2 = document.querySelector('#lip-drawer .lip-drb');
    if (corps2) corps2.scrollTop = y;
  };
  V2.lip.enregistrer = function () {
    if (!ouvert) return;
    var n = ouvert.n, e = ouvert.e;
    enregistrer(n, e).then(function () {
      if (backend === 'supabase') toast('Décision enregistrée et partagée avec l\'équipe');
      fermer(); redessine();
    });
  };
  V2.lip.copier = function () {
    if (!ouvert) return;
    var i = ouvert.e.variante;
    if (i === null || !ouvert.p.t[i]) { toast('Choisissez d\'abord une des trois propositions de texte', 'error'); return; }
    var txt = ouvert.p.t[i].txt;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('Texte copié'); }, function () { window.prompt('Copiez le texte :', txt); });
    } else window.prompt('Copiez le texte :', txt);
  };
  V2.lip.versCalendrier = function () {
    if (!ouvert) return;
    var LI = V2.mktLinkedin;
    if (!LI || !LI.savePost) { toast('Le calendrier LinkedIn n\'est pas chargé', 'error'); return; }
    var i = ouvert.e.variante;
    if (i === null) { toast('Choisissez d\'abord une des trois propositions de texte', 'error'); return; }
    var p = ouvert.p, e = ouvert.e;
    if (e.statut !== 'valide') { if (!confirm('Ce post n\'est pas encore validé. L\'envoyer quand même au calendrier ?')) return; }
    var visuel = (e.visuel !== null && p.v[e.visuel]) ? p.v[e.visuel] : (p.v[0] || '');
    LI.savePost({
      id: '', date: new Date(p.d + 'T' + p.h + ':00').toISOString(), status: 'pret', pillar: 'causes',
      title: p.titre, body: p.t[i].txt, image_path: '', linkedin_url: '',
      format: p.f, image_brief: visuel, event_id: 'plan12m', event_name: 'Rétro-planning 12 mois',
      source: 'retroplanning'
    }).then(function () {
      toast('Post #' + p.n + ' envoyé dans le calendrier LinkedIn');
      fermer(); redessine();
    });
  };

  V2.lip.setOnglet = function (o) { veilleVue.onglet = o; veilleVue.limite = 30; redessine(); };
  V2.lip.setVSrc = function (v) { veilleVue.src = v; veilleVue.limite = 30; redessine(); };
  V2.lip.setVQ = function (v) { veilleVue.q = v; veilleVue.limite = 30; clearTimeout(V2.lip._t2); V2.lip._t2 = setTimeout(redessine, 260); };
  V2.lip.plusPosts = function () { veilleVue.limite += 30; redessine(); };
  V2.lip.togglePost = function (id) { veilleVue.ouverts[id] = !veilleVue.ouverts[id]; redessine(); };

  V2.lip.exportCsv = function () {
    var P = plan(); if (!P) return;
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var l = [['N','Date','Heure','Pilier','Format','Titre','Angle','Statut','Texte choisi','Visuel choisi','Commentaire','Hashtags','Texte 1','Texte 2','Texte 3','Visuel 1','Visuel 2'].map(q).join(';')];
    P.forEach(function (p) {
      var e = etat(p.n);
      l.push([p.n, p.d, p.h, pilier(p.p).label, p.f, p.titre, p.angle, statut(e.statut).label,
        e.variante === null ? '' : 'Texte ' + (e.variante + 1),
        e.visuel === null ? '' : 'Visuel ' + (e.visuel + 1),
        e.commentaire || '', p.tags,
        p.t[0] ? p.t[0].txt : '', p.t[1] ? p.t[1].txt : '', p.t[2] ? p.t[2].txt : '',
        p.v[0] || '', p.v[1] || ''].map(q).join(';'));
    });
    var blob = new Blob(['﻿' + l.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'retroplanning-linkedin-12-mois.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
