/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Espace Marketing — SOCLE ET COQUILLE (lot 1, 18/09/2026)
   Choix de Will : structure de la maquette 4 (« Verrière »).
   Ce fichier apporte, pour TOUT l'espace Marketing (routes `marketing/*`) :
   - les jetons (couleurs, échelle 34/22/16/15/13, élévations N1/N2/N3 sans
     flou, durées et courbes --mk-*), portés par `.mk-espace` seulement :
     rien ne change dans le reste du CRM ;
   - Hanken Grotesk + IBM Plex Mono servies en local (polices/, licence OFL) ;
   - le fond « Verrière » et son grain (lumière en haut à gauche) ;
   - UNE barre Marketing (Retour · 4 onglets · Rechercher · Nouveau · avatar),
     et la barre d'onglets basse sous 860 px ;
   - le menu « Nouveau » ; le petit « Enregistré » de la barre (geste 9).

   Méthode : on ENVELOPPE `V2.topbar` (même procédé que v2-bg.js, qui
   enveloppe V2.render). Les modules Marketing continuent d'appeler
   V2.topbar(...) sans rien savoir : dans l'espace Marketing ils reçoivent la
   barre Marketing, ailleurs la barre de l'app, inchangée.
   La même enveloppe pose/retire la classe `mk-dans` sur <body> : c'est elle
   qui masque le rond « + » global (.v2-fab) le temps du Marketing.
   Aucun effet refusé par le garde-fou Safari ; on n'anime que transform/opacity.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var MOD = (/Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''))) ? '⌘' : 'Ctrl';

  // Les 4 onglets. `court` = libellé de la barre basse (390 px).
  var ONGLETS = [
    { k: 'semaine', label: 'Cette semaine', court: 'Semaine' },
    { k: 'posts', label: 'Posts', court: 'Posts' },
    { k: 'fiches', label: 'Fiches', court: 'Fiches' },
    { k: 'documents', label: 'Documents', court: 'Documents' }
  ];
  // Écrans secondaires : aucun onglet n'est marqué quand on s'y trouve.
  var HORS_ONGLET = { catalogues: 1, site: 1, propositions: 1, fxbank: 1 };

  var IC = {
    retour: '<path d="M15 6l-6 6 6 6"/>',
    loupe: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    semaine: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    posts: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>',
    fiches: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
    documents: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    selection: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    catalogue: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>',
    veille: '<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>',
    strategie: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    site: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>',
    effets: '<path d="M12 3l2.2 5.6L20 9.5l-4.4 3.9L17 19l-5-3-5 3 1.4-5.6L4 9.5l5.8-.9z"/>',
    idee: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>',
    bascule: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    // lot 2 — Documents
    suivant: '<path d="M9 6l6 6-6 6"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    charger: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    corbeille: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5"/>'
  };
  function ic(n, s, w) {
    return '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.75) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ════════════════════════════════════════════
  // CSS — tout est porté par .mk-espace, sauf les 5 règles `body.mk-dans`
  // qui règlent la cohabitation avec l'app (rond « + », marges basses).
  // ════════════════════════════════════════════
  function injectCss() {
    if (document.getElementById('v2-mkt-socle-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-socle-css';
    s.textContent = [
      '@font-face{font-family:"Hanken";src:url("polices/hanken.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}',
      '@font-face{font-family:"PlexMono";src:url("polices/plexmono.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}',

      /* ── jetons ── */
      '.mk-espace{',
      '--mk-page:#FBFCFE;--mk-carte:#FFFFFF;--mk-encre:#10131C;--mk-encre2:#3A4152;--mk-attenue:#626A7C;--mk-filet:#737A8C;',
      '--mk-bleu:#0050E6;--mk-bleu-txt:#0047D6;--mk-pale:#EEF3FF;--mk-groupe:#EEF1F6;--mk-trait:rgba(16,19,28,.08);',
      '--mk-vert:#1E9E6A;--mk-ambre:#C7791A;--mk-rose:#E0556E;',
      '--mk-s1:34px;--mk-s1l:38px;--mk-s2:22px;--mk-s2l:28px;--mk-s3:16px;--mk-s3l:22px;--mk-s4:15px;--mk-s4l:22px;--mk-s5:13px;--mk-s5l:18px;',
      '--mk-r-carte:20px;--mk-r-vig:12px;--mk-r-puce:8px;',
      '--mk-t1:120ms;--mk-t2:200ms;--mk-t3:320ms;--mk-t-ind:220ms;',
      '--mk-sortie:cubic-bezier(.22,1,.36,1);--mk-glisse:cubic-bezier(.32,.72,0,1);--mk-ressort:cubic-bezier(.22,1,.36,1);',
      '--mk-n1:0 1px 0 rgba(255,255,255,.9) inset,0 1px 2px rgba(11,31,77,.05);',
      '--mk-n2:0 1px 0 #fff inset,1px 2px 2px rgba(11,31,77,.05),3px 8px 12px -4px rgba(11,31,77,.09),8px 24px 40px -16px rgba(11,31,77,.18),18px 52px 84px -36px rgba(11,31,77,.16);',
      '--mk-n3:0 1px 0 #fff inset,1px 2px 2px rgba(11,31,77,.06),4px 10px 16px -4px rgba(11,31,77,.12),10px 30px 48px -16px rgba(11,31,77,.24),24px 64px 96px -32px rgba(11,31,77,.30);',
      '--mk-arete:linear-gradient(135deg,rgba(255,255,255,1) 0%,rgba(190,204,232,.75) 38%,rgba(16,19,28,.10) 100%);',
      '--mk-barre-h:64px;',
      'font-family:"Hanken",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:var(--mk-s4);line-height:var(--mk-s4l);font-weight:450;color:var(--mk-encre);',
      'font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}',
      '@supports (transition-timing-function:linear(0,1)){.mk-espace{--mk-ressort:linear(0,.053,.176,.324,.474,.609,.723,.815,.884,.934,.969,.991,1.005,1.012,1.015,1.015,1.014,1.012,1.009,1.007,1.005,1.004,1.002,1.001,1)}}',
      '@media (prefers-reduced-motion:reduce){',
      '.mk-espace{--mk-t1:1ms;--mk-t2:1ms;--mk-t3:1ms;--mk-t-ind:1ms}',
      '.mk-espace,.mk-espace *,.mk-espace *::before,.mk-espace *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}',
      '.mk-espace *,.mk-espace *::before,.mk-espace *::after{box-sizing:border-box}',
      '.mk-espace button{font:inherit;color:inherit;background:none;border:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.mk-espace svg{display:block;flex:none}',
      '.mk-espace :focus-visible{outline:2px solid var(--mk-bleu);outline-offset:2px;border-radius:8px}',
      '.mk-espace .mk-mono{font-family:"PlexMono",ui-monospace,monospace;font-weight:400}',

      /* ── N0 : la verrière. Lumière en haut à gauche, lames de jour très pâles, fixes, sans flou ── */
      '.mk-fond{position:fixed;top:0;right:0;bottom:0;left:0;z-index:-1;pointer-events:none;overflow:hidden;background:var(--mk-page)}',
      '.mk-verriere{position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;',
      'background:radial-gradient(80% 56% at 6% -12%,rgba(0,80,230,.17),rgba(0,80,230,.05) 45%,transparent 66%),linear-gradient(180deg,#ECF1FB 0,#F6F8FD 40%,#FBFCFE 72%)}',
      '.mk-verriere::before{content:"";position:absolute;top:-10%;right:-10%;bottom:0;left:-10%;',
      'background:linear-gradient(112deg,transparent 0 17%,rgba(255,255,255,.95) 17% 25%,transparent 25% 31%,rgba(255,255,255,.7) 31% 34%,transparent 34% 58%,rgba(255,255,255,.55) 58% 70%,transparent 70%);',
      '-webkit-mask-image:linear-gradient(180deg,#000 0,rgba(0,0,0,.5) 46%,transparent 78%);mask-image:linear-gradient(180deg,#000 0,rgba(0,0,0,.5) 46%,transparent 78%)}',
      '.mk-verriere::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;',
      'background:repeating-linear-gradient(90deg,rgba(0,60,180,.055) 0 1px,transparent 1px 280px),repeating-linear-gradient(0deg,rgba(0,60,180,.045) 0 1px,transparent 1px 280px);',
      '-webkit-mask-image:radial-gradient(90% 80% at 0% 0%,#000 0,rgba(0,0,0,.35) 50%,transparent 80%);mask-image:radial-gradient(90% 80% at 0% 0%,#000 0,rgba(0,0,0,.35) 50%,transparent 80%)}',
      '.mk-grain{position:absolute;top:0;right:0;bottom:0;left:0;opacity:.035;',
      'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}',

      /* ── geste 2 — Appuyer ── */
      '.mk-press{transition:transform var(--mk-t2) var(--mk-ressort)}',
      '.mk-press:active{transform:scale(.98);transition-duration:90ms}',

      /* ── geste 1 — Lever (lot 2) : l'ombre N3 vit dans un pseudo-élément, on n'anime que son opacité ── */
      '.mk-lever{position:relative;transition:transform var(--mk-t1) var(--mk-sortie)}',
      '.mk-lever::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:inherit;pointer-events:none;box-shadow:var(--mk-n3);opacity:0;transition:opacity var(--mk-t1) var(--mk-sortie)}',
      '@media (hover:hover){.mk-lever:hover{transform:translateY(-2px)}.mk-lever:hover::after{opacity:1}}',

      /* ── geste 11 — Squelette (lot 2) : rien avant 200 ms, puis le reflet ; teinte fixe en mouvement réduit ── */
      '.mk-sq{position:relative;overflow:hidden;background:var(--mk-groupe);animation:mk-paraitre 160ms 200ms both}',
      '@keyframes mk-paraitre{from{opacity:0}to{opacity:1}}',
      '@media (prefers-reduced-motion:no-preference){.mk-sq::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;transform:translateX(-100%);',
      'background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.75),rgba(255,255,255,0));animation:mk-reflet 1.2s linear 200ms infinite}}',
      '@keyframes mk-reflet{to{transform:translateX(100%)}}',

      /* ── geste 8 — progression fine (lot 2) ── */
      '.mk-prog{display:block;height:3px;border-radius:999px;background:var(--mk-bleu);transform-origin:left;transform:scaleX(var(--p,0));transition:transform var(--mk-t2) linear}',

      /* ── état vide (lot 2) : une silhouette en filets + une phrase + un bouton ── */
      '.mk-vide{display:grid;grid-template-columns:200px minmax(0,1fr);gap:32px;align-items:center;max-width:640px;margin:32px auto;padding:16px}',
      '.mk-vide h3{margin:0;font-size:var(--mk-s3);line-height:var(--mk-s3l);font-weight:700;color:var(--mk-encre)}',
      '.mk-vide p{margin:8px 0 16px;color:var(--mk-attenue)}',
      '.mk-silhouette{display:grid;gap:8px;align-content:start;padding:12px;border:1.5px solid #C9CFDB;border-radius:3px;aspect-ratio:794/1123;opacity:.75}',
      '.mk-silhouette i{display:block;height:10px;border-radius:999px;background:#C9CFDB;opacity:.6}',
      '.mk-silhouette i:first-child{height:auto;aspect-ratio:3;border-radius:8px}',
      '@media (max-width:860px){.mk-vide{grid-template-columns:1fr;gap:16px;justify-items:start;margin:16px 0;padding:8px}.mk-silhouette{width:160px}}',

      /* ── boutons posés (N1) ── */
      '.mk-espace .mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;min-width:44px;padding:0 16px;border-radius:var(--mk-r-vig);',
      'font-size:var(--mk-s4);font-weight:600;white-space:nowrap;background:#fff;border:1px solid var(--mk-trait);box-shadow:var(--mk-n1)}',
      /* lot 2 : le bouton plein (un seul par écran) et l'action destructrice en texte */
      '.mk-espace .mk-btn.mk-plein{background:linear-gradient(180deg,#1A63F0,var(--mk-bleu));color:#fff;border-color:transparent;box-shadow:0 1px 0 rgba(255,255,255,.35) inset,1px 2px 2px rgba(0,40,140,.18),3px 8px 14px -4px rgba(0,60,190,.35)}',
      '.mk-espace .mk-btn.mk-danger{background:none;border-color:transparent;box-shadow:none;color:#B93550}',
      '.mk-espace .mk-btn[disabled]{opacity:.55;cursor:default}',

      /* ── contrôle segmenté — geste 10 ── */
      '.mk-seg{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));background:var(--mk-groupe);border-radius:var(--mk-r-vig);padding:4px;isolation:isolate;box-shadow:0 1px 2px rgba(11,31,77,.08) inset}',
      '.mk-seg-ind{position:absolute;z-index:-1;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/var(--n));transform:translateX(calc(var(--i)*100%));border-radius:8px;background:#fff;',
      'box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(11,31,77,.14),2px 4px 8px -2px rgba(11,31,77,.12);transition:transform var(--mk-t-ind) var(--mk-glisse),opacity var(--mk-t2) var(--mk-sortie)}',
      '.mk-seg[data-aucun="1"] .mk-seg-ind{opacity:0}',
      '.mk-espace .mk-seg button{min-height:44px;min-width:0;padding:0 12px;font-size:var(--mk-s4);font-weight:600;color:var(--mk-attenue);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;transition:color var(--mk-t2) var(--mk-sortie)}',
      '.mk-espace .mk-seg button[aria-current="page"],.mk-espace .mk-seg button[aria-pressed="true"]{color:var(--mk-encre)}',
      '@media (hover:hover){.mk-espace .mk-seg button:hover{color:var(--mk-encre)}}',

      /* ── la barre Marketing ── */
      '.mk-barre{position:sticky;top:0;z-index:50;height:var(--mk-barre-h);display:flex;align-items:center;gap:12px;padding:0 32px;',
      'background:linear-gradient(180deg,#fff,#FAFBFE);border-bottom:1px solid var(--mk-trait);box-shadow:0 1px 0 #fff inset}',   /* opaque : le contenu qui défile dessous ne transparaît pas */
      '.mk-barre .mk-nav{--n:4;flex:0 1 520px;min-width:0;margin-left:12px}',
      '.mk-barre .mk-pousse{flex:1 1 0;min-width:0}',
      '.mk-titre-tel{display:none}',
      '.mk-espace .mk-cherche{display:flex;align-items:center;gap:8px;width:232px;height:44px;padding:0 12px;color:var(--mk-attenue);font-weight:500;font-size:var(--mk-s4);',
      'background:#fff;border:1px solid var(--mk-trait);border-radius:var(--mk-r-vig);box-shadow:var(--mk-n1);text-align:left}',
      '.mk-cherche kbd{margin-left:auto;font:inherit;font-size:var(--mk-s5);font-weight:600;padding:2px 6px;border-radius:6px;background:var(--mk-groupe)}',
      '.mk-enreg{display:flex;align-items:center;gap:6px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-attenue);min-width:112px;justify-content:flex-end;white-space:nowrap}',
      '.mk-enreg svg{color:var(--mk-vert)}',
      '.mk-coche path{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset 200ms var(--mk-sortie) 80ms}',
      '.mk-fait .mk-coche path{stroke-dashoffset:0}',
      /* l'avatar garde la classe .v2-av (le menu utilisateur de l'app s'y réfère) : on en neutralise la peau */
      '.mk-espace .mk-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:inherit;font-weight:700;font-size:var(--mk-s5);letter-spacing:0;',
      'background:var(--mk-encre);color:#fff;border:0;box-shadow:0 0 0 2px #fff,2px 4px 8px -2px rgba(11,31,77,.3);cursor:pointer;transform:none}',
      '.mk-menu-ancre{position:relative;flex:none}',

      /* ── menu « Nouveau » (N3) ── */
      '.mk-menu{position:absolute;top:calc(100% + 8px);right:0;width:312px;max-width:calc(100vw - 16px);max-height:calc(100vh - 96px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px;z-index:60;display:none;',
      'border:1px solid transparent;border-radius:16px;background:linear-gradient(180deg,#fff 0,#FAFBFE 100%) padding-box,var(--mk-arete) border-box;box-shadow:var(--mk-n3)}',
      '.mk-menu.mk-ouvert{display:block;animation:mk-naitre var(--mk-t2) var(--mk-sortie)}',
      '@keyframes mk-naitre{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}',
      '.mk-espace .mk-menu button{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:6px 12px;border-radius:10px;font-size:var(--mk-s4);line-height:20px;font-weight:600;text-align:left;color:var(--mk-encre)}',
      '.mk-menu button svg{color:var(--mk-encre2)}',
      '.mk-menu button span{display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:500;color:var(--mk-attenue)}',
      '.mk-menu button:focus-visible{background:var(--mk-pale)}',
      '@media (hover:hover){.mk-menu button:hover{background:var(--mk-pale)}}',
      '.mk-menu-cap{margin:8px 0 0;padding:12px 12px 4px;border-top:1px solid var(--mk-trait);font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mk-attenue)}',
      '.mk-espace .mk-menu .mk-plus button{min-height:44px;font-weight:550}',

      '.mk-onglets-bas{display:none}',

      /* ── cohabitation avec l'app, le temps du Marketing ── */
      'body.mk-dans .v2-fab{display:none}',
      /* Hors .v2-wrap (écrans LinkedIn), v2-motion pose son glissé d'entrée sur #v2-root lui-même et le laisse
         figé sur une transformation : les éléments fixes de la coquille (fond, onglets bas) seraient alors
         placés par rapport à la page entière et non à l'écran. */
      'body.mk-dans #v2-root.mo-view-in{animation:none}',

      /* ── largeurs intermédiaires : la barre ne déborde jamais ── */
      '@media (max-width:1240px){.mk-barre{padding:0 24px}.mk-espace .mk-cherche{width:44px;padding:0;justify-content:center}.mk-cherche span,.mk-cherche kbd{display:none}.mk-enreg{min-width:0}}',
      '@media (max-width:1040px){.mk-barre{padding:0 16px;gap:8px}.mk-barre .mk-nav{margin-left:4px}.mk-retour span,.mk-nouveau span{display:none}.mk-espace .mk-retour,.mk-espace .mk-nouveau{width:44px;padding:0}.mk-enreg span{display:none}}',

      /* ═══ 390 px : onglets en bas ═══ */
      '@media (max-width:860px){',
      '.mk-espace{--mk-s1:28px;--mk-s1l:32px;--mk-s2:20px;--mk-s2l:26px;--mk-s4:16px;--mk-s4l:24px;--mk-barre-h:56px}',
      '.mk-barre{padding:0 8px;gap:4px}',
      '.mk-barre .mk-nav{display:none}',
      '.mk-titre-tel{display:block;font-weight:650;font-size:var(--mk-s3);line-height:var(--mk-s3l);margin-left:4px;white-space:nowrap}',
      '.mk-espace .mk-cherche{border:0;box-shadow:none;background:none}',
      '.mk-enreg{width:28px;justify-content:center}',
      '.mk-onglets-bas{display:block;position:fixed;z-index:70;left:0;right:0;bottom:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));',
      'background:#fff;border-top:1px solid var(--mk-trait);box-shadow:0 -8px 24px -12px rgba(11,31,77,.18)}',
      '.mk-onglets-bas .mk-seg{--n:4;background:none;box-shadow:none;padding:0}',
      '.mk-onglets-bas .mk-seg-ind{top:0;bottom:0;left:0;width:25%;background:var(--mk-pale);box-shadow:none;border-radius:12px}',
      '.mk-espace.mk-onglets-bas .mk-seg button{flex-direction:column;gap:2px;min-height:52px;font-size:var(--mk-s5);line-height:var(--mk-s5l);padding:0 2px}',
      '.mk-espace.mk-onglets-bas .mk-seg button[aria-current="page"]{color:var(--mk-bleu-txt)}',
      /* les anciens écrans gardent leur dernier bouton visible au-dessus des onglets bas */
      'body.mk-dans #v2-root{padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}',
      'body.mk-dans .mkt-catbar{bottom:calc(78px + env(safe-area-inset-bottom,0px))}',
      'body.mk-dans .v2-appbar{bottom:calc(84px + env(safe-area-inset-bottom,0px))}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════
  // Où est-on ?
  // ════════════════════════════════════════════
  function dansMarketing() { return !!(V2.user && V2.route && V2.route.name === 'marketing'); }
  function vueLinkedin() { return (V2.mktLinkedin && V2.mktLinkedin.vue) ? V2.mktLinkedin.vue() : 'plan'; }
  // Indice de l'onglet marqué, ou -1 (écrans secondaires).
  function ongletActif() {
    var p = (V2.route && V2.route.param) || '';
    if (!p) return 0;
    if (p === 'linkedin') return vueLinkedin() === 'veille' ? -1 : 1;
    if (p === 'docs') return 3;
    if (HORS_ONGLET[p]) return -1;
    return 2;   // `fiches`, et tout le reste = l'éditeur d'une fiche
  }

  // ════════════════════════════════════════════
  // La barre
  // ════════════════════════════════════════════
  var dernierI = -1;        // onglet marqué au rendu précédent : point de départ du glissé
  var etatEnreg = '';       // '' | 'cours' | 'ok'
  var tEnreg = null;
  var apres = [];           // actions à jouer une fois l'écran suivant rendu (ex. ouvrir l'éditeur de post)

  function segHtml(bas, actif, depart) {
    var h = '<i class="mk-seg-ind"></i>';
    for (var n = 0; n < ONGLETS.length; n++) {
      var o = ONGLETS[n];
      h += '<button type="button" class="mk-press" data-mk-onglet="' + o.k + '"' + (n === actif ? ' aria-current="page"' : '') +
        ' onclick="V2.mktSocle.aller(\'' + o.k + '\')">' + (bas ? ic(o.k, 22) : '') + '<span>' + (bas ? o.court : o.label) + '</span></button>';
    }
    return '<div class="mk-seg' + (bas ? '' : ' mk-nav') + '" data-mk-seg style="--n:4;--i:' + (depart < 0 ? 0 : depart) + '"' + (actif < 0 ? ' data-aucun="1"' : '') + '>' + h + '</div>';
  }

  function enregHtml() {
    if (etatEnreg === 'cours') return '<span>Enregistrement…</span>';
    if (etatEnreg === 'ok') return '<svg class="mk-coche" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC.coche + '</svg><span>Enregistré</span>';
    return '';
  }

  function menuHtml() {
    function item(act, icone, titre, sous) {
      return '<button type="button" role="menuitem" tabindex="-1" data-mk-nouveau="' + act + '" onclick="V2.mktSocle.nouveau(\'' + act + '\')">' + ic(icone, 22) +
        '<div>' + titre + (sous ? '<span>' + sous + '</span>' : '') + '</div></button>';
    }
    var h = item('post', 'posts', 'Nouveau post', 'Hors du plan, dans le même éditeur') +
      item('fiche', 'fiches', 'Nouvelle fiche produit', 'Un support à remettre à l’officine') +
      item('selection', 'selection', 'Nouvelle sélection', 'Une liste de produits à mettre en avant') +
      item('document', 'documents', 'Déposer un document', 'PDF ou Excel, partagé avec l’équipe');
    h += '<div class="mk-menu-cap" role="presentation">Plus</div><div class="mk-plus" role="group" aria-label="Plus">' +
      item('catalogues', 'catalogue', 'Catalogue &amp; prix') +
      item('veille', 'veille', 'Veille secteur') +
      item('strategie', 'strategie', 'Assistant stratégie') +
      item('propositions', 'site', 'Le nouveau site') +
      item('fxbank', 'effets', 'Banque d’effets');
    // Deux actions de l'ancienne barre de l'app, gardées ici pour ne rien perdre.
    if (!(window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale)) && V2.remonteeOpen) {
      h += item('idee', 'idee', 'Proposer une amélioration');
    }
    var sw = bascule();
    if (sw) h += item('bascule', 'bascule', 'Basculer vers l’espace ' + sw.label);
    return h + '</div>';
  }
  // Même condition que la bascule Intégral ↔ Escale de V2.topbar (v2-app.js).
  function bascule() {
    var mail = (V2.user && V2.user.email) || '';
    if (!/@escalepharma\.fr$/i.test(mail)) return null;
    var inEscale = !!(window.V2_BRAND && window.V2_BRAND.escale);
    if (inEscale && !(V2.user && V2.user.voitTousReel === true)) return null;
    return { to: inEscale ? 'crm' : 'escale', label: inEscale ? 'Intégral' : 'Escale' };
  }

  function barreHtml() {
    var actif = ongletActif();
    var depart = (dernierI >= 0 && actif >= 0) ? dernierI : actif;
    var nom = (V2.user && V2.user.name) || '';
    var initiales = (nom ? nom.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') : 'WM').toUpperCase();
    return '' +
      '<div class="mk-espace mk-fond" aria-hidden="true"><div class="mk-verriere"></div><div class="mk-grain"></div></div>' +
      '<header class="mk-espace mk-barre" data-mk-barre>' +
        '<button type="button" class="mk-btn mk-retour mk-press" onclick="V2.go(\'home\')" aria-label="Retour à l’accueil">' + ic('retour', 20, 2) + '<span>Retour</span></button>' +
        '<strong class="mk-titre-tel">Marketing</strong>' +
        '<nav aria-label="Espace Marketing" style="display:contents">' + segHtml(false, actif, depart) + '</nav>' +
        '<div class="mk-pousse"></div>' +
        '<div class="mk-enreg' + (etatEnreg === 'ok' ? ' mk-fait' : '') + '" id="mk-enreg" aria-live="polite">' + enregHtml() + '</div>' +
        '<button type="button" class="mk-cherche mk-press" onclick="V2.onTopSearch()" aria-label="Rechercher">' + ic('loupe', 20) + '<span>Rechercher</span><kbd>' + MOD + 'K</kbd></button>' +
        '<div class="mk-menu-ancre">' +
          '<button type="button" class="mk-btn mk-nouveau mk-press" id="mk-nouveau" aria-haspopup="menu" aria-expanded="false" aria-controls="mk-menu" aria-label="Nouveau" onclick="V2.mktSocle.menu()">' + ic('plus', 20, 2) + '<span>Nouveau</span></button>' +
          '<div class="mk-menu" id="mk-menu" role="menu" aria-labelledby="mk-nouveau">' + menuHtml() + '</div>' +
        '</div>' +
        '<button type="button" class="mk-avatar v2-av" title="' + esc(nom) + '" aria-label="Mon compte" onclick="V2.userMenu()">' + esc(initiales) + '</button>' +
      '</header>' +
      '<nav class="mk-espace mk-onglets-bas" aria-label="Espace Marketing">' + segHtml(true, actif, depart) + '</nav>';
  }

  // Après le rendu : l'indicateur glisse de l'ancien onglet vers le nouveau (geste 10),
  // puis on joue les actions en attente.
  function apresRendu() {
    var actif = ongletActif();
    var segs = document.querySelectorAll('[data-mk-seg]');
    for (var n = 0; n < segs.length; n++) if (actif >= 0) segs[n].style.setProperty('--i', actif);
    dernierI = actif;
    var file = apres; apres = [];
    for (var k = 0; k < file.length; k++) { try { file[k](); } catch (e) {} }
  }

  function synchro() {
    var dedans = dansMarketing();
    try {
      if (dedans) document.body.classList.add('mk-dans'); else document.body.classList.remove('mk-dans');
    } catch (e) {}
    if (!dedans) { dernierI = -1; etatEnreg = ''; clearTimeout(tEnreg); apres = []; }
    return dedans;
  }

  // ════════════════════════════════════════════
  // L'enveloppe de V2.topbar
  // ════════════════════════════════════════════
  function installer() {
    if (!V2.topbar || V2.topbar._mkSocle) return !!V2.topbar;
    var origine = V2.topbar;
    V2.topbar = function (opts) {
      var dedans = false;
      try { dedans = synchro(); } catch (e) {}
      if (!dedans) return origine.apply(this, arguments);
      try {
        injectCss(); ecouter();
        var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
        raf(function () { raf(apresRendu); });
        return barreHtml();
      } catch (e2) { return origine.apply(this, arguments); }   // la coquille ne doit jamais empêcher un écran de s'afficher
    };
    V2.topbar._mkSocle = true;
    return true;
  }

  // ════════════════════════════════════════════
  // Menu « Nouveau »
  // ════════════════════════════════════════════
  function menuEl() { return document.getElementById('mk-menu'); }
  function menuOuvert() { var m = menuEl(); return !!(m && m.classList.contains('mk-ouvert')); }
  function menu(ouvrir, rendreFocus) {
    var m = menuEl(), b = document.getElementById('mk-nouveau'); if (!m || !b) return;
    if (ouvrir === undefined) ouvrir = !menuOuvert();
    if (ouvrir) m.classList.add('mk-ouvert'); else m.classList.remove('mk-ouvert');
    b.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
    if (ouvrir) { var p = m.querySelector('[role="menuitem"]'); if (p) { try { p.focus(); } catch (e) {} } }
    else if (rendreFocus) { try { b.focus(); } catch (e2) {} }
  }

  var ecoute = false;
  function ecouter() {
    if (ecoute) return; ecoute = true;
    document.addEventListener('click', function (e) {
      if (!menuOuvert()) return;
      var t = e.target;
      if (t && t.closest && t.closest('.mk-menu-ancre')) return;   // le bouton et le menu gèrent leur propre clic
      menu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!menuOuvert()) return;
      if (e.key === 'Escape') { e.preventDefault(); menu(false, true); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      var its = [].slice.call(menuEl().querySelectorAll('[role="menuitem"]')); if (!its.length) return;
      var i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') i = (i + 1) % its.length;
      else if (e.key === 'ArrowUp') i = (i <= 0 ? its.length : i) - 1;
      else if (e.key === 'Home') i = 0; else i = its.length - 1;
      e.preventDefault(); try { its[i].focus(); } catch (err) {}
    });
    window.addEventListener('hashchange', function () {
      // Sortie du Marketing par le bouton « précédent » du navigateur : on retire la classe sans attendre le rendu.
      var h = (location.hash || '').replace(/^#/, '').split('/')[0];
      if (h !== 'marketing') { try { document.body.classList.remove('mk-dans'); } catch (e) {} }
    });
  }

  // ════════════════════════════════════════════
  // Navigation
  // ════════════════════════════════════════════
  function surLinkedin() { return dansMarketing() && V2.route.param === 'linkedin'; }
  // Ouvre l'écran LinkedIn sur la vue demandée (`plan` = les posts, `veille`).
  function ouvrirLinkedin(vue) {
    if (!surLinkedin()) V2.go('marketing', 'linkedin');
    if (vueLinkedin() !== vue && V2.li && V2.li.setView) V2.li.setView(vue);
  }

  function aller(k) {
    menu(false);
    if (k === 'semaine') return V2.go('marketing');
    if (k === 'posts') return ouvrirLinkedin('plan');
    if (k === 'fiches') return V2.go('marketing', 'fiches');
    if (k === 'documents') return V2.go('marketing', 'docs');
  }

  function nouveau(act) {
    menu(false);
    if (act === 'post') {
      // Même geste que « Nouveau post libre » du plan : V2.lip.nouveauLibre().
      var ouvrir = function () { if (V2.lip && V2.lip.nouveauLibre) V2.lip.nouveauLibre(); };
      if (surLinkedin() && vueLinkedin() === 'plan') return ouvrir();
      apres.push(ouvrir); return ouvrirLinkedin('plan');
    }
    if (act === 'fiche') { if (V2.mkt && V2.mkt.create) V2.mkt.create('support'); return; }
    if (act === 'selection') { if (V2.mkt && V2.mkt.create) V2.mkt.create('selection'); return; }
    if (act === 'document') return V2.go('marketing', 'docs');
    if (act === 'catalogues' || act === 'propositions' || act === 'fxbank') return V2.go('marketing', act);
    if (act === 'veille') return ouvrirLinkedin('veille');
    if (act === 'strategie') {
      var assistant = function () { if (V2.lis && V2.lis.open) V2.lis.open(); };
      if (surLinkedin()) return assistant();
      apres.push(assistant); return ouvrirLinkedin('plan');
    }
    if (act === 'idee') { if (V2.remonteeOpen) V2.remonteeOpen(); return; }
    if (act === 'bascule') { var sw = bascule(); if (sw && V2.goSpace) V2.goSpace(sw.to); return; }
  }

  // ════════════════════════════════════════════
  // Geste 9 — « Enregistré », dans la barre
  // ════════════════════════════════════════════
  function peindreEnreg() {
    var e = document.getElementById('mk-enreg'); if (!e) return;
    e.classList.remove('mk-fait');
    e.innerHTML = enregHtml();
    if (etatEnreg === 'ok') { void e.offsetWidth; e.classList.add('mk-fait'); }   // la coche se dessine
  }
  function enregistre() {
    if (!dansMarketing()) return;
    etatEnreg = 'cours'; peindreEnreg();
    clearTimeout(tEnreg);
    tEnreg = setTimeout(function () { etatEnreg = 'ok'; peindreEnreg(); }, 380);
  }

  V2.mktSocle = {
    installer: installer,
    injectCss: injectCss,
    barre: barreHtml,
    aller: aller,
    menu: menu,
    nouveau: nouveau,
    enregistre: enregistre,
    ongletActif: ongletActif,
    ic: ic
  };

  // v2-app.js est exécuté avant les modules : V2.topbar existe déjà. Le second essai couvre un ordre de chargement différent.
  if (!installer()) { try { window.addEventListener('load', installer); } catch (e) {} }
})();
