/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Documents, version « étagères » (remplace V2.pages.documents) — EN ESSAI : chargée par v2-documents.js pour Will, le groupe restreint et Pascale Prieto (30/10/2026).
   Quand Will l'ouvre à tous : ce fichier prend la place de v2-documents.js, et l'aiguillage disparaît avec l'ancien écran.
   Le classement des grossistes, groupements et laboratoires (tarifs, conditions, catalogues), consultable depuis l'iPhone comme
   depuis le Mac, par les seuls comptes inscrits dans la table documents_acces. Même rangement que sur le Mac : 4 dossiers racine (2 familles Grossistes / Parapharmacie depuis le 29/10/2026, puis Réserve et Antérieur à 2025), recherche partout.

   Accès : V2.documentsVerifier() (v2-app.js) interroge la fonction Supabase documents_acces_ok(). Tant que la réponse n'est pas « oui »,
   l'écran ne fait AUCUNE requête vers l'index et montre un message neutre.
   Index : objet « index/documents.json » de l'espace privé « documents-prives », lu par adresse signée, gardé en MÉMOIRE seulement
   (jamais Cache Storage, localStorage ni sessionStorage : les titres sont confidentiels).
   Ouverture : l'onglet est ouvert dans le geste du doigt (sinon Safari le bloque), puis dirigé vers l'adresse signée (V2.ouvrirDocProtege fait de même).
   Aucun prix ni condition chiffrée dans les textes de l'écran.
   Aperçus (18/10/2026) : la première page de chaque document, en vignette. Image `apercus/<sha1>.jpg` (400 px de large) dans le
   même espace fermé, fabriquée sur le Mac par apercus.py ; `ap: 1` dans l'index quand elle existe, sinon le picto du type reste.
   Adresses signées de tout ce qui est affiché EN UNE FOIS, gardées 45 min en mémoire (comme v2-discussion.js).
   Retrait (19/10/2026) : « Retirer » MASQUE un document pour tout le monde, de façon réversible (table documents_retires, clé = empreinte du
   fichier) ; rien n'est supprimé du stockage. Le droit (retirer, remettre) est porté par la BASE : colonne documents_acces.peut_retirer, fonction
   documents_retrait_ok(), règles de documents_retires. L'écran ne fait que cacher le bouton aux autres comptes ; le retrait ne s'affiche qu'une fois
   la base ayant répondu (rien d'optimiste). Seul le compte qui a le droit voit le bouton et la liste « Retirés ».
   Étagères (30/10/2026, choix de Will) : un onglet par famille, une rangée de vignettes par sous-groupe ; « Tout voir » déplie sur place, sans changer d'écran.
   Les aperçus des étagères ne sont signés qu'en arrivant à l'écran, par lots de 12 au plus (Supabase refuse les rafales) ; « EN UNE FOIS » ne vaut plus que pour la recherche.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};
  var BUCKET = 'documents-prives';
  var INDEX = 'index/documents.json';
  var MAX_RES = 100;      // résultats de recherche affichés
  var PAGE = 24;          // documents d'une étagère dépliée avant « Afficher la suite »
  var RANG = 12;          // cartes montrées dans la rangée (le reste : « Tout voir »)

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-'’_/]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }
  function $(s, r) { return (r || document).querySelector(s); }
  function cmp(a, b) { return String(a).localeCompare(String(b), 'fr'); }
  function nb(n) { try { return Number(n).toLocaleString('fr-FR'); } catch (e) { return String(n); } }

  // ——— Feuille de style (posée une fois, avec le module) ———
  (function () {
    if (document.getElementById('v2-documents-etageres-css')) return;
    var st = document.createElement('style'); st.id = 'v2-documents-etageres-css';
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
      '.dc-fil button:focus-visible,.dc-eff:focus-visible,.dc-plus:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-2px}',
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
      '.dc-nb-m{display:none;font-size:13px;color:var(--muted)}',
      // Retrait : le bouton est HORS de la carte (un bouton ne se met pas dans un bouton), posé dans son coin haut droit, zone tactile de 44 px.
      '.dc-cw{position:relative;display:flex;min-width:0}',
      '.dc-cw>.dc-carte{flex:1 1 auto;min-width:0}',
      '.dc-rt{position:absolute;top:0;right:0;z-index:2;min-width:44px;height:44px;padding:0 6px;border:0;background:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-family:var(--font);-webkit-tap-highlight-color:transparent}',
      '.dc-rt span{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:var(--r-pill);background:rgba(255,255,255,.94);border:1px solid var(--line-strong);box-shadow:var(--sh-1);font-size:12.5px;font-weight:700;color:var(--ip-ink-2)}',
      '.dc-rt:hover span{color:var(--ip-blue-d);border-color:var(--ip-blue)}',
      '.dc-rt:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-4px;border-radius:var(--r-control)}',
      '.dc-ret{margin:26px 0 8px}',
      '.dc-ret-t{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px;border:0;background:none;font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;border-radius:var(--r-control)}',
      '.dc-ret-t:focus-visible{outline:2px solid var(--ip-blue);outline-offset:-2px}',
      '.dc-ret-t .dc-chev{transition:transform .15s}',
      '.dc-ret-t[aria-expanded="true"] .dc-chev{transform:rotate(90deg)}',
      '.dc-rl{display:flex;align-items:center;gap:12px;padding:10px 14px;min-height:56px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.dc-rl:last-child{border-bottom:0}',
      '.dc-rl .v2-btn{flex:none;min-height:44px;white-space:nowrap}',
      '.dc-rl .v2-btn[disabled]{cursor:default}',
      '.dc-msg{margin:10px 2px 0;font-size:13.5px;line-height:1.45;color:var(--ip-ink-2)}',
      '.dc-msg--ko{padding:12px 14px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-weight:600}',
      '.dc-fond{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;background:rgba(16,19,28,.46)}',
      '.dc-dlg{box-sizing:border-box;width:min(460px,100%);margin:auto;padding:24px 24px 20px;border-radius:22px;font-family:var(--font);color:var(--ip-ink);background:radial-gradient(130% 75% at 0% 0%,var(--halo) 0%,rgba(233,240,255,0) 62%),var(--card);box-shadow:inset 0 1px 0 #fff,var(--sh-pop)}',
      '.dc-dt{margin:0 0 8px;font-size:19px;line-height:1.3;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dc-ds{margin:0;font-size:15px;line-height:1.5;color:var(--ip-ink-2)}',
      '.dc-de{margin:14px 0 0;padding:12px 14px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-size:14px;font-weight:600;line-height:1.4}',
      '.dc-de[hidden]{display:none}',
      '.dc-dp{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}',
      '.dc-dlg .v2-btn{min-height:44px;white-space:nowrap}',
      '@media (max-width:480px){.dc-dlg{padding:20px 18px 16px}.dc-dp .v2-btn{flex:1}.dc-rl{padding:10px 12px;gap:10px}}',
      // Les étagères (30/10/2026)
      '.dc-onglets{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 6px}',
      '.dc-og{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:64px;padding:10px 14px;border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--card);font-family:var(--font);color:var(--ip-ink);cursor:pointer;text-align:left;box-shadow:var(--sh-1);-webkit-tap-highlight-color:transparent;transition:background .15s,box-shadow .15s}',
      '.dc-og b{font-size:16px;font-weight:800;line-height:1.2}',
      '.dc-og span{font-size:13px;font-weight:700;color:var(--muted)}',
      '.dc-og[aria-selected="true"]{background:linear-gradient(150deg,var(--ip-blue),var(--ip-blue-d));border-color:transparent;color:#fff;box-shadow:0 14px 26px -16px rgba(0,80,230,.75)}',
      '.dc-og[aria-selected="true"] span{color:#DCE8FF}',
      '.dc-petits{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px;margin:0 0 4px}',
      '.dc-petits>i{font-style:normal;font-size:13px;font-weight:700;color:var(--muted)}',
      '.dc-op{min-height:44px;padding:0 12px;border:1px dashed var(--line-strong);border-radius:var(--r-pill);background:transparent;font-family:var(--font);font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.dc-op[aria-selected="true"]{border-style:solid;background:var(--halo);color:var(--ip-blue-d)}',
      '.dc-og:focus-visible,.dc-op:focus-visible,.dc-tv:focus-visible,.dc-pl:focus-visible,.dc-fin:focus-visible,.dc-rang:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.dc-et{margin:18px 0 4px}',
      '.dc-et-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 6px}',
      '.dc-et-t{min-width:0}',
      '.dc-et-t h2{margin:0;font-size:18px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dc-et-k{display:block;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}',
      '.dc-tv{flex:none;min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--card);font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-blue);cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}',
      '.dc-tv:hover{border-color:var(--ip-blue)}',
      '.dc-rang{display:flex;gap:10px;overflow-x:auto;margin:0 -14px;padding:2px 14px 14px;scroll-snap-type:x proximity;scroll-padding:0 14px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.dc-rang::-webkit-scrollbar{display:none}',
      '.dc-rang::after{content:"";flex:none;width:4px}',
      '.dc-rang>.dc-cw{flex:none;width:150px;scroll-snap-align:start}',
      '.dc-fin{flex:none;width:116px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;border:1px dashed var(--line-strong);border-radius:var(--r-md);background:radial-gradient(130% 90% at 50% 0%,var(--card) 0%,var(--surf-sunken) 100%);font-family:var(--font);font-size:14px;font-weight:800;color:var(--ip-blue);cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent}',
      '.dc-fin small{font-size:13px;font-weight:700;color:var(--muted)}',
      '.dc-et--ouv{margin:18px -6px 6px;padding:10px 12px 16px;border:1px solid var(--line);border-radius:var(--r-card);background:radial-gradient(130% 60% at 0% 0%,var(--halo) 0%,rgba(233,240,255,0) 60%),var(--card);box-shadow:var(--sh-1)}',
      '.dc-et--ouv .dc-et-h{margin:0 0 8px}',
      '.dc-ouv{animation:dcDeplie .18s ease-out}',
      '@keyframes dcDeplie{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
      '.dc-pil{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 14px}',
      '.dc-pl{min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--card);font-family:var(--font);font-size:14px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}',
      '.dc-pl[aria-pressed="true"]{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '@media (min-width:641px){.dc-rang{margin:0 -26px;padding:2px 26px 14px;scroll-padding:0 26px}.dc-rang>.dc-cw{width:176px}.dc-fin{width:132px}}',
      '@media (prefers-reduced-motion:reduce){.dc-ouv{animation:none}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ——— Pictos (trait, comme le reste de l'app) ———
  var P = {
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

  // ——— Noms lisibles des quatre dossiers racine (le numéro fixe l'ordre) — deux familles depuis le 29/10/2026 ———
  var RACINES = {
    '1': 'Grossistes', '2': 'Parapharmacie',
    '3': 'Réserve (confidentiel ou nominatif)', '4': 'Antérieur à 2025 (pièces rares)'
  };
  function numRacine(seg) { var m = /^\s*(\d+)\b/.exec(seg); return m ? m[1] : null; }
  function nomDossier(seg, niveau) {
    if (niveau === 0) { var n = numRacine(seg); if (n && RACINES[n]) return RACINES[n]; return String(seg).replace(/^\s*\d+\s*[-–.]\s*/, ''); }
    return seg;
  }
  function nomChemin(chemin) { return chemin.split('/').map(function (s, i) { return nomDossier(s, i); }).join(' › '); }

  // ——— État (en mémoire ; survit aux redessins du routeur) ———
  var D = { etat: 'attente', idx: null, docs: [], tous: [], retires: {}, retiresLu: false, peut: false, retiresOuvert: false, remisMsg: '', q: '', cheminVu: null, fam: '2', ouv: {}, vis: [], vt: 0, visKo: 0, io: null, msgT: 0, urls: {}, urlsLe: 0 };

  function preparer(j) {
    var l = (j && Array.isArray(j.documents)) ? j.documents : [];
    D.tous = l.filter(function (d) { return d && typeof d.cle === 'string' && typeof d.dossier === 'string'; }).map(function (d) {
      var t = d.titre || String(d.nom || '').replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'Document';
      return { sha: shaDe(d.cle), dossier: d.dossier.replace(/^\/+|\/+$/g, ''), nom: d.nom || '', titre: t, date: d.date || '', cle: d.cle, taille: d.taille, ext: String(d.ext || d.cle.split('.').pop() || '').toLowerCase(),
        ap: d.ap ? 'apercus/' + d.cle.split('/').pop().replace(/\.[^.]+$/, '') + '.jpg' : '',
        _t: norm(t), _d: norm(nomChemin(d.dossier.replace(/^\/+|\/+$/g, ''))) + ' ' + norm(d.dossier) };
    });
    appliquer();
  }
  // Empreinte du contenu = nom du fichier stocké (« docs/<sha1>.<ext> ») : c'est la clé de la table documents_retires.
  function shaDe(cle) { return String(cle).split('/').pop().replace(/\.[^.]+$/, ''); }
  // Ce qui est affiché (liste, recherche, compteurs) = tout l'index MOINS les retirés.
  function appliquer() { D.docs = D.tous.filter(function (d) { return !Object.prototype.hasOwnProperty.call(D.retires, d.sha); }); }
  function lireRetires(c) {
    return Promise.resolve(c.from('documents_retires').select('sha1,titre,dossier,retire_le').order('retire_le', { ascending: false })).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data)) { D.retiresLu = false; return; }
      var m = {}; r.data.forEach(function (x) { if (x && x.sha1) m[x.sha1] = { titre: x.titre || '', dossier: x.dossier || '', le: x.retire_le || '' }; });
      D.retires = m; D.retiresLu = true;
    }, function () { D.retiresLu = false; });
  }
  function lireDroit(c) {
    return Promise.resolve(c.rpc('documents_retrait_ok')).then(function (r) { D.peut = !!(r && !r.error && r.data === true); }, function () { D.peut = false; });
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
      D.idx = j; D.retires = {}; D.retiresLu = false; D.peut = false;
      return Promise.all([lireRetires(c), lireDroit(c)]).then(function () { preparer(j); D.etat = 'pret'; });
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
  function carteDoc(d, avecDossier, diff) {
    var t = typeDe(d), meta = [];
    meta.push('<span class="dc-bdg' + (t.cl ? ' dc-bdg--' + t.cl : '') + '">' + esc(t.nom) + '</span>');
    if (d.date) meta.push('<span>' + esc(d.date) + '</span>');
    var tl = taille(d.taille); if (tl) meta.push('<span>' + esc(tl) + '</span>');
    var u = d.ap ? D.urls[d.ap] : false;
    return '<div class="dc-cw"><button type="button" class="dc-carte" data-cle="' + esc(d.cle) + '"><span class="dc-ap">' +
      '<span class="dc-tuile' + (t.cl ? ' dc-tuile--' + t.cl : '') + '">' + ic(t.ico) + '</span>' +
      (u !== false ? '<img alt="" decoding="async" data-ap="' + esc(d.ap) + '"' + (diff && !u ? ' data-diff="1"' : ' loading="lazy"' + (u ? ' src="' + esc(u) + '"' : '')) + '>' : '') + '</span>' +
      '<span class="dc-cc"><span class="dc-t">' + esc(d.titre) + '</span>' +
      (avecDossier ? '<span class="dc-ou">' + esc(nomChemin(d.dossier)) + '</span>' : '') +
      '<span class="dc-m">' + meta.join('') + '</span></span></button>' +
      (D.peut && D.retiresLu ? '<button type="button" class="dc-rt" data-retirer="' + esc(d.cle) + '" aria-label="Retirer « ' + esc(d.titre) + ' »"><span>Retirer</span></button>' : '') + '</div>';
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
    Array.prototype.forEach.call(z.querySelectorAll('img[data-ap]:not([src]):not([data-diff])'), function (im) {
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

  function corps() { corpsInt(); pied(); }
  function corpsInt() {
    var el = document.getElementById('dc-corps'); if (!el) return;
    var sous = document.getElementById('dc-sous');
    if (D.etat === 'charge' || D.etat === 'attente') { el.innerHTML = '<div class="v2-loading" style="min-height:30vh"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
    if (D.etat === 'echec') {
      el.innerHTML = '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink);margin-bottom:14px">La liste des documents n’a pas pu être chargée.</div>' +
        '<button type="button" class="v2-btn v2-btn-primary" data-reessayer="1">Réessayer</button></div></div>';
      if (sous) sous.textContent = '';
      return;
    }
    if (sous) sous.textContent = nb(D.docs.length) + ' documents, rangés par sous-groupe : faites défiler une étagère, ou touchez « Tout voir ».';
    var h = '', q = D.q.trim();
    if (!D.retiresLu) h += '<div class="dc-alerte" role="status">La liste des documents retirés n’a pas pu être lue : un document déjà retiré peut encore s’afficher ici.</div>';
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
    if (ch && !n.existe && D.tous.some(function (d) { return d.dossier === ch || d.dossier.indexOf(ch + '/') === 0; })) {
      el.innerHTML = h + fil(ch) + '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Ce dossier est vide : ses documents ont été retirés.</div></div></div>';
      return;
    }
    if (ch && !n.existe) {
      el.innerHTML = fil('') + '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink);margin-bottom:14px">Ce dossier n’existe pas.</div>' +
        '<button type="button" class="v2-btn v2-btn-primary" data-dossier="">Tous les dossiers</button></div></div>';
      return;
    }
    var cible = '';
    if (D.cheminVu !== ch) { D.cheminVu = ch; cible = routeVers(ch); }
    el.innerHTML = h + '<div id="dc-tabs"></div><div id="dc-pan"></div>';
    onglets(); panneau();
    if (cible) setTimeout(function () { var b = bloc(cible); if (b) amener(b); }, 0);   // après la remontée en haut de page faite par le routeur
  }

  // ——— Les étagères : un onglet = une famille ; une étagère = un sous-groupe, en rangée qui défile ———
  function racineDe(f) {
    for (var i = 0; i < D.tous.length; i++) { var seg = D.tous[i].dossier.split('/')[0]; if (numRacine(seg) === f) return seg; }
    return '';
  }
  function etageres(f) {
    var rac = racineDe(f); if (!rac) return [];
    var pre = rac + '/', gp = pre + 'Groupements', ngp = 0, map = {}, ordre = [];
    D.docs.forEach(function (d) { if (d.dossier === gp || d.dossier.indexOf(gp + '/') === 0) ngp++; });
    var eclate = ngp >= 60;     // les groupements, nombreux, ont chacun leur étagère ; sinon une seule
    D.docs.forEach(function (d) {
      if (d.dossier !== rac && d.dossier.indexOf(pre) !== 0) return;
      var segs = d.dossier === rac ? [] : d.dossier.slice(pre.length).split('/'), key, titre, kick = '';
      if (!segs.length) { key = rac; titre = 'Autres documents'; }
      else if (eclate && segs[0] === 'Groupements') {
        if (segs.length >= 2) { key = gp + '/' + segs[1]; titre = segs[1]; kick = 'Groupement'; }
        else { key = gp; titre = 'Groupements : pièces communes'; }
      } else { key = pre + segs[0]; titre = segs[0]; }
      var e = map[key]; if (!e) { e = map[key] = { key: key, titre: titre, kick: kick, docs: [], subs: {}, direct: key === rac }; ordre.push(e); }
      var rest = e.direct ? '' : (d.dossier.length > key.length ? d.dossier.slice(key.length + 1).split('/')[0] : '');
      d._sub = rest; e.docs.push(d);
      if (rest) e.subs[rest] = (e.subs[rest] || 0) + 1;
    });
    ordre.forEach(function (e) {
      e.docs.sort(function (a, b) { return (b.ap ? 1 : 0) - (a.ap ? 1 : 0) || cmp(a.nom || a.titre, b.nom || b.titre); });
      e.noms = Object.keys(e.subs).sort(cmp);
    });
    ordre.sort(function (a, b) { return (a.direct ? 1 : 0) - (b.direct ? 1 : 0) || b.docs.length - a.docs.length || cmp(a.titre, b.titre); });
    return ordre;
  }
  function cherche(f, key) { var l = etageres(f); for (var i = 0; i < l.length; i++) if (l[i].key === key) return l[i]; return null; }
  // Adresse reçue (#documents/<chemin>) : on ouvre la bonne famille et l'étagère qui la contient, sur place.
  function routeVers(ch) {
    if (!ch) return;
    var f = numRacine(ch.split('/')[0]); if (!f || !RACINES[f]) return;
    D.fam = f;
    var l = etageres(f);
    for (var i = 0; i < l.length; i++) {
      var e = l[i];
      if (ch === e.key || ch.indexOf(e.key + '/') === 0) {
        var sub = ch === e.key ? '' : ch.slice(e.key.length + 1).split('/')[0];
        D.ouv[e.key] = { max: PAGE, sous: e.subs[sub] ? sub : '' };
        return e.key;
      }
    }
  }
  function nbFam(f) { var n = 0; D.docs.forEach(function (d) { if (numRacine(d.dossier.split('/')[0]) === f) n++; }); return n; }
  function onglets() {
    var z = document.getElementById('dc-tabs'); if (!z) return;
    function grand(f) {
      return '<button type="button" role="tab" class="dc-og" data-fam="' + f + '" aria-selected="' + (D.fam === f) + '"><b>' + RACINES[f] + '</b><span>' + nb(nbFam(f)) + ' documents</span></button>';
    }
    function petit(f) {
      return '<button type="button" role="tab" class="dc-op" data-fam="' + f + '" aria-selected="' + (D.fam === f) + '">' + (f === '3' ? 'Réserve' : 'Antérieur à 2025') + ' · ' + nb(nbFam(f)) + '</button>';
    }
    z.innerHTML = '<div class="dc-onglets" role="tablist" aria-label="Familles de documents">' + grand('1') + grand('2') + '</div>' +
      '<div class="dc-petits" role="tablist" aria-label="À part"><i>À part :</i>' + petit('3') + petit('4') + '</div>';
  }
  function panneau() {
    var z = document.getElementById('dc-pan'); if (!z) return;
    var l = etageres(D.fam);
    if (D.io) D.io.disconnect();   // tout le panneau est refait : les anciennes vignettes ne sont plus à surveiller
    if (!l.length) { z.innerHTML = '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Cette famille est vide.</div></div></div>'; return; }
    z.innerHTML = l.map(htmlEtagere).join('');
    observer();
  }
  function htmlEtagere(e) {
    var o = D.ouv[e.key], n = e.docs.length;
    var h = '<section class="dc-et' + (o ? ' dc-et--ouv' : '') + '" data-etag="' + esc(e.key) + '" aria-label="' + esc(e.titre) + '">' +
      '<div class="dc-et-h"><div class="dc-et-t">' + (e.kick ? '<span class="dc-et-k">' + esc(e.kick) + '</span>' : '') + '<h2>' + esc(e.titre) + '</h2><span class="dc-nb-m" style="display:block">' + nb(n) + ' document' + (n > 1 ? 's' : '') + '</span></div>' +
      (o ? '<button type="button" class="dc-tv" data-replier="' + esc(e.key) + '" aria-expanded="true">Replier</button>'
         : '<button type="button" class="dc-tv" data-tout="' + esc(e.key) + '" aria-expanded="false">Tout voir (' + nb(n) + ')</button>') + '</div>';
    if (!o) {
      var vus = e.docs.slice(0, RANG), reste = n - vus.length;
      h += '<div class="dc-rang" tabindex="0" role="group" aria-label="Documents de ' + esc(e.titre) + '">' + vus.map(function (d) { return carteDoc(d, false, true); }).join('');
      if (reste > 0) h += '<button type="button" class="dc-fin" data-tout="' + esc(e.key) + '">Tout voir<small>+ ' + nb(reste) + '</small></button>';
      return h + '</div></section>';
    }
    var liste = o.sous ? e.docs.filter(function (d) { return d._sub === o.sous; }) : e.docs;
    h += '<div class="dc-et-c">';
    if (e.noms.length > 1 || (e.noms.length === 1 && e.noms[0] && e.docs.length > e.subs[e.noms[0]])) {
      h += '<div class="dc-pil" role="group" aria-label="Filtrer ' + esc(e.titre) + '"><button type="button" class="dc-pl" data-sous="" data-etage="' + esc(e.key) + '" aria-pressed="' + (!o.sous) + '">Tout (' + nb(n) + ')</button>' +
        e.noms.map(function (s) { return '<button type="button" class="dc-pl" data-sous="' + esc(s) + '" data-etage="' + esc(e.key) + '" aria-pressed="' + (o.sous === s) + '">' + esc(s) + ' (' + nb(e.subs[s]) + ')</button>'; }).join('') + '</div>';
    }
    var aff = liste.slice(0, o.max);
    h += '<div class="dc-grille">' + aff.map(function (d) { return carteDoc(d, false, true); }).join('') + '</div>';
    if (liste.length > aff.length) h += '<button type="button" class="dc-plus" data-plus="' + esc(e.key) + '">Afficher la suite (' + nb(liste.length - aff.length) + ' autres)</button>';
    return h + '</div></section>';
  }
  function bloc(key) {
    var zs = document.querySelectorAll('#dc-pan [data-etag]');
    for (var i = 0; i < zs.length; i++) if (zs[i].getAttribute('data-etag') === key) return zs[i];
    return null;
  }
  // Ne reconstruit QUE l'étagère touchée ; remonte la page seulement si son titre est sorti de l'écran.
  function refaire(key, ouvre) {
    var b = bloc(key), e = cherche(D.fam, key); if (!b || !e) return;
    if (D.io) Array.prototype.forEach.call(b.querySelectorAll('img[data-obs]'), function (im) { D.io.unobserve(im); });
    var t = document.createElement('div'); t.innerHTML = htmlEtagere(e);
    var neuf = t.firstChild, cc = neuf.querySelector('.dc-et-c');
    if (ouvre && cc) cc.classList.add('dc-ouv');   // l'animation ne joue qu'au dépliage, pas à chaque filtre
    b.parentNode.replaceChild(neuf, b);
    observer();
    var r = neuf.getBoundingClientRect();
    if (ouvre !== undefined && (r.top < 56 || r.top > window.innerHeight - 80)) amener(neuf);
    if (ouvre !== undefined) poserFocus(neuf.querySelector(ouvre ? '[data-replier]' : '[data-tout]'));
  }
  function amener(b) { window.scrollTo(0, Math.max(0, window.scrollY + b.getBoundingClientRect().top - 70)); }
  function poserFocus(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (x) {} } }

  // ——— Aperçus à la demande : une vignette n'est demandée que lorsqu'elle entre à l'écran (en hauteur ET en largeur), par petits lots ———
  function observer() {
    var z = document.getElementById('dc-corps'); if (!z) return;
    var imgs = z.querySelectorAll('img[data-diff]:not([data-obs])');
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(imgs, function (im) { im.setAttribute('data-obs', '1'); D.vis.push(im); }); servir(); return; }
    if (!D.io) D.io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { D.io.unobserve(x.target); D.vis.push(x.target); } });
      if (D.vis.length) { clearTimeout(D.vt); D.vt = setTimeout(servir, 80); }
    }, { rootMargin: '60px 60px 60px 60px' });
    Array.prototype.forEach.call(imgs, function (im) { im.setAttribute('data-obs', '1'); D.io.observe(im); });
  }
  function servir() {
    var lot = D.vis.filter(function (im) { return im.isConnected && !im.getAttribute('src'); }); D.vis = [];
    if (!lot.length) return;
    var maintenant = lot.slice(0, 12), suite = lot.slice(12);
    if (suite.length) { D.vis = suite; clearTimeout(D.vt); D.vt = setTimeout(servir, 500); }
    if (D.urlsLe && Date.now() - D.urlsLe > 45 * 60000) { D.urls = {}; D.urlsLe = 0; }
    var need = [];
    maintenant.forEach(function (im) { var p = im.getAttribute('data-ap'); if (!Object.prototype.hasOwnProperty.call(D.urls, p) && need.indexOf(p) < 0) need.push(p); });
    function poser() {
      var encore = [];
      maintenant.forEach(function (im) {
        if (!im.isConnected) return;
        var u = D.urls[im.getAttribute('data-ap')];
        if (u) im.src = u; else if (u === false) { if (im.parentNode) im.parentNode.removeChild(im); } else encore.push(im);
      });
      if (encore.length) { D.vis = D.vis.concat(encore); clearTimeout(D.vt); D.vt = setTimeout(servir, 900); }
    }
    if (!need.length) { poser(); return; }
    var c = V2.sb && V2.sb();
    if (!c || !c.storage) return;
    need.forEach(function (p) { D.urls[p] = ''; });
    var echec = function () {
      need.forEach(function (p) { if (D.urls[p] === '') delete D.urls[p]; });
      if (++D.visKo > 4) return;   // panne qui dure : on arrête de solliciter Supabase, le picto reste
      D.vis = D.vis.concat(maintenant); clearTimeout(D.vt); D.vt = setTimeout(servir, 3000);
    };
    Promise.resolve(c.storage.from(BUCKET).createSignedUrls(need, 3600)).then(function (r) {
      if (!r || r.error || !r.data) { echec(); return; }
      D.visKo = 0;
      if (!D.urlsLe) D.urlsLe = Date.now();
      r.data.forEach(function (x, i) { var p = (x && x.path) || need[i]; D.urls[p] = (x && !x.error && x.signedUrl) || false; });
      poser();
    }).catch(echec);
  }

  // ——— Retrait : « Retirés (n) » en bas de l'écran (replié), fenêtre de confirmation, écritures ———
  function pied() {
    var z = document.getElementById('dc-retires'); if (!z) return;
    var cles = Object.keys(D.retires);
    if (D.etat !== 'pret' || !D.peut || !D.retiresLu || (!cles.length && !D.remisMsg)) { z.innerHTML = ''; return; }
    cles.sort(function (a, b) { return String(D.retires[b].le).localeCompare(String(D.retires[a].le)); });
    var h = '<div class="dc-ret">';
    if (cles.length) {
      h += '<button type="button" class="dc-ret-t" data-retires-bascule="1" aria-expanded="' + (D.retiresOuvert ? 'true' : 'false') + '" aria-controls="dc-ret-l">' + ic('chev', 'dc-chev') + 'Retirés (' + nb(cles.length) + ')</button>';
      if (D.retiresOuvert) {
        h += '<div class="v2-card dc-liste" id="dc-ret-l">' + cles.map(function (s) {
          var r = D.retires[s];
          return '<div class="dc-rl"><span class="dc-corps"><span class="dc-t">' + esc(r.titre || 'Document') + '</span>' + (r.dossier ? '<span class="dc-ou">' + esc(nomChemin(r.dossier)) + '</span>' : '') + '</span>' +
            '<button type="button" class="v2-btn v2-btn-ghost" data-remettre="' + esc(s) + '">Remettre</button></div>';
        }).join('') + '</div>';
      }
    }
    if (D.remisMsg) h += '<p class="dc-msg' + (D.remisKo ? ' dc-msg--ko' : '') + '" role="status" id="dc-remis-msg">' + esc(D.remisMsg) + '</p>';
    z.innerHTML = h + '</div>';
  }
  function ecrireRetrait(d) {
    var c = V2.sb && V2.sb();
    if (!c || !c.from) return Promise.resolve(false);
    return Promise.resolve(c.from('documents_retires').insert({ sha1: d.sha, titre: d.titre, dossier: d.dossier })).then(function (r) {
      // 23505 = déjà retiré (par un autre appareil) : c'est bien l'état voulu.
      if (r && r.error && r.error.code !== '23505') return false;
      D.retires[d.sha] = { titre: d.titre, dossier: d.dossier, le: new Date().toISOString() };
      appliquer();
      return true;
    }, function () { return false; });
  }
  function ecrireRemise(sha) {
    var c = V2.sb && V2.sb();
    if (!c || !c.from) return Promise.resolve(false);
    // .select() : la base répond par les lignes réellement supprimées ; zéro ligne = rien n'a été remis (règle refusée en silence).
    return Promise.resolve(c.from('documents_retires').delete().eq('sha1', sha).select('sha1')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return false;
      delete D.retires[sha];
      appliquer();
      return true;
    }, function () { return false; });
  }
  function confirmerRetrait(d) {
    if (document.getElementById('dc-fond')) return;
    var avant = document.activeElement, occupe = false;
    var fond = document.createElement('div'); fond.className = 'dc-fond'; fond.id = 'dc-fond';
    fond.innerHTML = '<div class="dc-dlg" role="alertdialog" aria-modal="true" aria-labelledby="dc-dt" aria-describedby="dc-ds">' +
      '<h2 class="dc-dt" id="dc-dt">Retirer « ' + esc(d.titre) + ' » ?</h2>' +
      '<p class="dc-ds" id="dc-ds">Il ne s’affichera plus pour personne. Vous pourrez le remettre depuis « Retirés ».</p>' +
      '<p class="dc-de" id="dc-de" role="alert" hidden></p>' +
      '<div class="dc-dp"><button type="button" class="v2-btn v2-btn-ghost" data-dc-non="1">Annuler</button><button type="button" class="v2-btn v2-btn-primary" data-dc-oui="1">Retirer</button></div></div>';
    var oui = fond.querySelector('[data-dc-oui]'), non = fond.querySelector('[data-dc-non]'), err = fond.querySelector('#dc-de');
    function fermer() {
      document.removeEventListener('keydown', touche, true);
      if (fond.parentNode) fond.parentNode.removeChild(fond);
      if (avant && avant.focus && document.contains(avant)) { try { avant.focus(); } catch (e) {} }
    }
    function touche(e) {
      if (e.key === 'Escape') { e.preventDefault(); if (!occupe) fermer(); return; }
      if (e.key !== 'Tab') return;
      var f = fond.querySelectorAll('button:not([disabled])'); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    fond.addEventListener('click', function (e) {
      if (occupe) return;
      if (e.target === fond || (e.target.closest && e.target.closest('[data-dc-non]'))) { fermer(); return; }
      if (!(e.target.closest && e.target.closest('[data-dc-oui]'))) return;
      occupe = true; oui.disabled = true; non.disabled = true; oui.textContent = 'Retrait en cours…'; err.hidden = true;
      ecrireRetrait(d).then(function (ok) {
        occupe = false;
        if (ok) { D.remisMsg = ''; D.remisKo = false; fermer(); if (actif()) corps(); return; }
        oui.disabled = false; non.disabled = false; oui.textContent = 'Retirer';
        err.textContent = 'Le retrait n’a pas pu être enregistré : le document reste affiché. Vérifiez votre connexion, puis réessayez.'; err.hidden = false;
      });
    });
    document.addEventListener('keydown', touche, true);
    document.body.appendChild(fond);   // sur <body> : la racine de l'app porte une transformation qui collerait un « fixed » à la page
    try { non.focus(); } catch (e) {}
  }
  function remettre(sha, bouton) {
    var r = D.retires[sha]; if (!r) return;
    var titre = r.titre || 'Le document';
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Remise en cours…'; }
    ecrireRemise(sha).then(function (ok) {
      if (!actif()) return;
      if (ok) {
        var revient = D.tous.some(function (d) { return d.sha === sha; });
        D.remisKo = false;
        D.remisMsg = revient ? '« ' + titre + ' » est de nouveau affiché.' : '« ' + titre + ' » est remis. Il réapparaîtra après la prochaine mise à jour de la liste depuis le Mac.';
        corps();
      } else {
        D.remisKo = true; D.remisMsg = 'La remise n’a pas pu être enregistrée : « ' + titre + ' » reste dans les retirés. Réessayez dans un instant.';
        pied();
      }
    });
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
      '<div class="dc-tete"><h1 class="v2-titre">Documents <span class="dc-seul">' + ic('lock') + 'Accès restreint</span></h1>' +
      '<p class="v2-sous" id="dc-sous"></p></div>' +
      '<label class="v2-champ dc-champ">' + ic('search') +
      '<input type="text" inputmode="search" id="dc-q" placeholder="Rechercher un document…" aria-label="Rechercher un document ou un dossier" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' +
      '<button type="button" class="dc-eff" id="dc-eff" aria-label="Effacer la recherche" hidden>' + ic('x') + '</button></label>' +
      '<div class="dc-alerte" id="dc-alerte" role="alert" hidden></div>' +
      '<div id="dc-corps"></div><div id="dc-retires"></div></div>';
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
    // 29/10/2026 — un échec de chargement n'est pas définitif. Mesuré en production : Supabase refuse par vagues de 5 à 8 s
    // (429 « too_many_connections »), un nouvel essai immédiat retombait dedans. Donc jusqu'à 3 nouveaux essais espacés
    // (2 s, 5 s, 10 s), adresse re-signée à chaque fois ; une re-signature refusée compte comme un essai raté.
    // data-reessai = nombre d'essais lancés ; le picto seulement après le dernier ; rien si l'image a quitté la page.
    var ATTENTES = [2000, 5000, 10000];
    function reessayer(im) {
      var n = +im.getAttribute('data-reessai') || 0, ap = im.getAttribute('data-ap'), c = V2.sb && V2.sb();
      if (n >= ATTENTES.length || !ap || !c || !c.storage) { if (im.parentNode) im.parentNode.removeChild(im); return; }
      im.setAttribute('data-reessai', String(n + 1));
      setTimeout(function () {
        if (!im.isConnected) return;
        Promise.resolve(c.storage.from(BUCKET).createSignedUrl(ap, 3600)).then(function (r) {
          var u = r && !r.error && r.data && r.data.signedUrl;
          if (!u) throw new Error('adresse refusée');
          D.urls[ap] = u;
          if (im.isConnected) im.src = u;
        }).catch(function () { if (im.isConnected) reessayer(im); });
      }, ATTENTES[n]);
    }
    zone.addEventListener('error', function (ev) {
      var im = ev.target; if (!im || im.tagName !== 'IMG' || !im.parentNode) return;
      reessayer(im);
    }, true);
    zone.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
      var b;
      if ((b = t.closest('[data-retirer]'))) { var dd = trouver(b.getAttribute('data-retirer')); if (dd && D.peut) confirmerRetrait(dd); return; }
      if ((b = t.closest('[data-remettre]'))) { remettre(b.getAttribute('data-remettre'), b); return; }
      if (t.closest('[data-retires-bascule]')) { D.retiresOuvert = !D.retiresOuvert; D.remisMsg = ''; pied(); return; }
      if ((b = t.closest('[data-cle]'))) { V2.documentsOuvrir(b.getAttribute('data-cle')); return; }
      if ((b = t.closest('[data-dossier]'))) {
        var ch = b.getAttribute('data-dossier') || '';
        if (D.q) { D.q = ''; q.value = ''; eff.hidden = true; }
        if (ch === chemin()) corps(); else if (ch) V2.go('documents', ch); else V2.go('documents');
        return;
      }
      if ((b = t.closest('[data-fam]'))) { var f = b.getAttribute('data-fam'); if (f !== D.fam) { D.fam = f; onglets(); panneau(); poserFocus(document.querySelector('#dc-tabs [data-fam="' + f + '"]')); } return; }
      if ((b = t.closest('[data-tout]'))) { var k = b.getAttribute('data-tout'); D.ouv[k] = { max: PAGE, sous: '' }; refaire(k, true); return; }
      if ((b = t.closest('[data-replier]'))) { var k2 = b.getAttribute('data-replier'); delete D.ouv[k2]; refaire(k2, false); return; }
      if (t.closest('[data-sous]')) { b = t.closest('[data-sous]'); var k3 = b.getAttribute('data-etage'); if (D.ouv[k3]) { D.ouv[k3].sous = b.getAttribute('data-sous'); D.ouv[k3].max = PAGE; refaire(k3, undefined); poserFocus(bloc(k3) && bloc(k3).querySelector('.dc-pl[aria-pressed="true"]')); } return; }
      if ((b = t.closest('[data-plus]'))) { var k4 = b.getAttribute('data-plus'); if (D.ouv[k4]) { var dej = D.ouv[k4].max; D.ouv[k4].max += 48; refaire(k4, undefined); poserFocus(bloc(k4) && bloc(k4).querySelectorAll('.dc-carte')[dej]); } return; }
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
