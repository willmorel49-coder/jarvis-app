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
      '.lip-sel,.lip-inp{height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--lip-line);background:var(--lip-panel);font-family:inherit;font-size:13.5px;font-weight:600;line-height:1;color:var(--lip-ink70)}',
      '.lip-inp{min-width:190px;font-weight:500}',
      '.lip-inp:focus,.lip-sel:focus{outline:2px solid var(--lip-blue);outline-offset:1px}',
      '.lip-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:20px;border:1px solid var(--lip-line);background:var(--lip-panel);font-family:inherit;font-size:12.5px;font-weight:600;line-height:1;color:var(--lip-ink70);cursor:pointer;transition:background-color .15s var(--lip-ease),border-color .15s var(--lip-ease),color .15s var(--lip-ease)}',
      '.lip-chip .lip-cd{width:9px;height:9px;border-radius:50%;flex:none}',
      '.lip-chip.off{opacity:.38}',
      '.lip-chip:hover{border-color:#d3dae4}',
      '.lip-btn{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:9px;border:1px solid var(--lip-line);background:var(--lip-panel);font-family:inherit;font-size:13.5px;font-weight:600;line-height:1;color:var(--lip-ink70);cursor:pointer;transition:background-color .15s var(--lip-ease),border-color .15s var(--lip-ease),color .15s var(--lip-ease),transform .15s var(--lip-ease)}',
      '.lip-btn:hover{background:var(--lip-bg);color:var(--lip-ink)}',
      '.lip-btn-p{background:var(--lip-blue);border-color:var(--lip-blue);color:#fff;font-weight:700;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lip-btn-p:hover{background:#0047d6;color:#fff;transform:translateY(-1px)}',
      '.lip-spacer{flex:1}',

      /* groupe mois */
      '.lip-mois{display:flex;align-items:center;gap:12px;margin:30px 2px 12px}',
      '.lip-mois h2{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;text-transform:capitalize}',
      '.lip-mline{flex:1;height:1px;background:var(--lip-line)}',
      '.lip-mcount{font-size:12px;font-weight:700;color:var(--lip-ink35)}',

      /* ═══ LOT 3 (18/09/2026) — Posts : cartes à couverture, trois colonnes sans boîte, la carte devient le volet.
         Jetons, élévations et gestes : v2-mkt-socle.js (.mk-espace). Un seul accent, le bleu ; la couleur d'une
         famille ne sert qu'à une pastille de 8 px. On n'anime que transform et opacity. */
      '#v2-root .lip.lpo{max-width:1320px;padding:32px 32px 64px}',
      '.lpo-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}',
      '.lpo-h1{margin:0;font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em}',
      '.lpo-phrase{margin:4px 0 0;color:var(--mk-attenue)}',
      '.lpo-phrase b{color:var(--mk-encre);font-weight:700}',
      '.lpo-local{display:flex;align-items:center;gap:8px;margin:8px 0 0;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:#8A5200}',
      '.lpo-moi{--n:3;min-width:320px;flex:none}',
      /* .lpo devant : la feuille du socle arrive après celle-ci et son .mk-seg (grid, relative) l'emporterait à égalité */
      '.lpo .lpo-etapes{--n:3;display:none}',
      '.mk-espace .lpo-etapes button[aria-selected="true"]{color:var(--mk-encre)}',
      '.lpo-etapes b{font-weight:700}',
      '.lpo-flash{animation:lpo-flash 520ms var(--mk-sortie)}',
      '@keyframes lpo-flash{0%{opacity:1}30%{opacity:.35}100%{opacity:1}}',

      /* colonnes : pas de boîte autour ; une colonne vide se rétracte */
      '.lpo-board{display:grid;gap:32px;align-items:start}',
      '.lpo-col{min-width:0}',
      '.lpo-colt{display:flex;align-items:baseline;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--mk-trait)}',
      '.lpo-colt b{font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700}',
      '.lpo-cap{font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mk-attenue)}',
      '.lpo-pile{display:grid;gap:24px;grid-template-columns:repeat(auto-fill,minmax(248px,1fr))}',
      '.lpo-vide{padding:16px;border-radius:var(--mk-r-carte);background:rgba(238,241,246,.6);color:var(--mk-attenue);font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:500}',
      '.lpo-vide strong{display:block;margin-bottom:4px;color:var(--mk-encre);font-size:var(--mk-s5);font-weight:650}',
      '.lpo-silh{width:72px;border-radius:10px;border:1.5px solid #C9CFDB;padding:6px;margin-bottom:12px}',
      '.lpo-silh i{display:block;height:6px;border-radius:3px;background:#D5DAE5;margin-top:6px}',
      '.lpo-silh i:first-child{height:30px;margin-top:0;border-radius:6px}',

      /* la carte d'un post */
      '.lpo-carte{display:block;min-width:0;padding:8px;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}',
      '.mk-espace .lpo-carte:focus-visible{border-radius:var(--mk-r-carte)}',
      '.lpo-carte.ecarte .mk-couv{opacity:.5}',
      '.lpo-carte.ecarte .lpo-titre{text-decoration:line-through;color:var(--mk-attenue)}',
      '.lpo-vig{display:block}',
      '.lpo-corps{display:block;padding:12px 8px 0}',
      '.lpo-haut{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:18px}',
      '.lpo-date{font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:550;color:var(--mk-attenue);white-space:nowrap}',
      '.lpo-stat{display:inline-flex;align-items:center;gap:6px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-encre2);white-space:nowrap}',
      '.lpo-stat svg{color:var(--mk-vert)}',
      '.lpo-titre{margin:6px 0 4px;font-size:var(--mk-s3);line-height:var(--mk-s3l);font-weight:650;color:var(--mk-encre);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:44px}',
      '.lpo-pied{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:44px;padding-left:8px}',
      '.lpo-fam{flex:1;min-width:0;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:550;color:var(--mk-attenue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lpo-fam i,.lpo-famv i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}',
      '.lpo-pied .mk-qui{margin-right:8px}',
      '.mk-espace .lpo-claim{flex:none;min-height:44px;padding:0 8px;border-radius:12px;font-size:var(--mk-s5);font-weight:600;color:var(--mk-bleu-txt);white-space:nowrap}',
      '.lpo-picks{display:flex;gap:8px;flex:none}',
      '.mk-espace .lpo-pick{width:44px;height:44px;display:grid;place-items:center;border-radius:50%}',
      '.lpo-pick span{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:var(--mk-s5);font-weight:650;line-height:1;color:var(--mk-attenue);border:1.5px dashed #8C95A8}',
      '@media (hover:hover){.mk-espace .lpo-claim:hover{background:var(--mk-pale)}.lpo-pick:hover span{border-color:var(--mk-bleu);color:var(--mk-bleu-txt)}}',

      /* bas d'écran : la suite, puis la ligne éditoriale */
      '.lpo-suite{display:flex;gap:8px;flex-wrap:wrap;margin-top:32px;padding-top:16px;border-top:1px solid var(--mk-trait)}',
      '.lpo-regle{margin-top:24px}',
      '.lpo-regle-g{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}',
      '.lpo-pose{padding:16px 20px;background:#fff;border:1px solid var(--mk-trait);border-radius:var(--mk-r-vig);box-shadow:var(--mk-n1);color:var(--mk-encre2)}',
      '.lpo-pose b{font-weight:700;color:var(--mk-encre)}',

      /* ═══ le voile et le volet (gestes 4 et 5) ═══ */
      '.lpo-voile{position:fixed;top:0;right:0;bottom:0;left:0;z-index:900;opacity:0;transition:opacity var(--mk-t2) var(--mk-sortie);background:linear-gradient(90deg,rgba(11,31,77,.16),rgba(11,31,77,.36))}',
      '.lpo-voile.la{opacity:1}',
      '.lpo-volet{position:fixed;z-index:901;top:12px;right:12px;bottom:12px;width:min(920px,calc(100vw - 24px));display:flex;flex-direction:column;overflow:hidden;transform-origin:0 0;',
      'border-radius:var(--mk-r-carte);border:1px solid transparent;background:linear-gradient(180deg,#fff,#FAFBFE) padding-box,var(--mk-arete) border-box;box-shadow:var(--mk-n3)}',
      '.lpo-dedans{display:flex;flex-direction:column;flex:1;min-height:0}',
      '.lpo-poignee{display:none}',
      '.lpo-vt{display:flex;align-items:center;gap:16px;padding:16px 16px 16px 24px;border-bottom:1px solid var(--mk-trait)}',
      '.lpo-vt h2{margin:0;font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;letter-spacing:-.01em}',
      '.lpo-meta{display:flex;gap:4px 12px;flex-wrap:wrap;margin-bottom:2px}',
      '.lpo-famv,.lpo-etat{display:inline-flex;align-items:center;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-encre2)}',
      '.lpo-famv{color:var(--mk-attenue);font-weight:550}',
      '.lpo-etat i{width:8px;height:8px;border-radius:50%;background:#C9CFDB;margin-right:6px}',
      '.lpo-etat.pret i{background:var(--mk-bleu)}.lpo-etat.publie i{background:var(--mk-vert)}',
      '.mk-espace .lpo-x{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;flex:none}',
      '.lpo-vc{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,384px);min-height:0}',
      '.lpo-scene{position:relative;overflow:auto;-webkit-overflow-scrolling:touch;padding:24px;background:linear-gradient(135deg,#F6F8FD 0,#EDF1FA 100%);border-right:1px solid var(--mk-trait)}',
      '.lpo-cible{position:absolute;top:12px;right:12px;bottom:12px;left:12px;z-index:3;border-radius:16px;border:2px solid var(--mk-bleu);background:rgba(238,243,255,.92);display:grid;place-items:center;padding:16px;text-align:center;font-weight:650;color:var(--mk-bleu-txt);opacity:0;pointer-events:none;transition:opacity var(--mk-t1) var(--mk-sortie)}',
      '.lpo-scene.survol .lpo-cible{opacity:1}',

      /* l'aperçu du post, comme sur LinkedIn */
      '.lpo-li{overflow:hidden;max-width:480px;margin:0 auto}',
      '.lpo-lt{display:flex;gap:12px;align-items:center;padding:16px 16px 12px}',
      '.lpo-logo{width:48px;height:48px;border-radius:10px;flex:none;display:grid;place-items:center;color:#fff;font-weight:800;font-size:var(--mk-s3);letter-spacing:-.02em;background:linear-gradient(135deg,#2F7DFF 0,#0050E6 45%,#002A8F 100%);box-shadow:0 1px 0 rgba(255,255,255,.4) inset}',
      '.lpo-lt strong{display:block;font-size:var(--mk-s3);font-weight:650;line-height:20px}',
      '.lpo-lt div span{display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-attenue);font-weight:500}',
      '.lpo-ltxt{display:block;width:100%;margin:0;padding:4px 16px 12px;border:0;border-radius:8px;background:none;resize:none;outline:none;overflow:hidden;font-family:inherit;font-weight:inherit;font-size:16px;line-height:24px;color:var(--mk-encre);transition:box-shadow var(--mk-t1) var(--mk-sortie)}',
      '.lpo-ltxt.plie{max-height:148px}',
      /* lot 4 — le même texte, en lecture (accueil « Cette semaine ») : quatre lignes, puis « … voir plus » */
      'p.lpo-lecture{position:relative;max-height:100px;padding-bottom:0;margin-bottom:12px;border-radius:0;white-space:pre-wrap;overflow-wrap:anywhere}',
      'p.lpo-lecture::after{content:"… voir plus";position:absolute;right:0;bottom:0;padding:0 16px 0 48px;line-height:24px;font-weight:500;color:var(--mk-attenue);background:linear-gradient(90deg,rgba(253,253,254,0),#FDFDFE 36px)}',
      '.lpo-ltxt:focus{box-shadow:0 0 0 2px var(--mk-bleu) inset;background:#FDFEFF}',
      '.mk-espace .lpo-deplier{display:flex;align-items:center;justify-content:flex-end;width:100%;min-height:44px;padding:0 16px;color:var(--mk-attenue);font-weight:600}',
      '.lpo-vis{position:relative;display:block;background:#0A2A7A}',
      '.lpo-vis .mk-couv{border-radius:0}',
      '.mk-espace .lpo-vzoom{display:block;width:100%;padding:0;cursor:zoom-in;border-radius:0}',
      '.lpo-vimg{display:block;width:100%;height:auto;max-height:520px;object-fit:cover;background:#fff}',
      '.lpo-vis video{display:block;width:100%;max-height:520px;background:#000}',
      '.lpo-envoi{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:8px 16px 12px;background:rgba(8,20,60,.78);color:#fff;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600}',
      '.lpo-envoi .mk-prog{margin-top:8px;background:#fff}',
      '.lpo-envoi-fond{display:block;height:3px;margin-top:-3px;border-radius:999px;background:rgba(255,255,255,.25)}',
      '.lpo-lact{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--mk-trait);padding:0 8px}',
      '.lpo-lact span{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;font-size:var(--mk-s5);font-weight:600;color:var(--mk-attenue)}',
      '.lpo-aide{max-width:480px;margin:12px auto 0;display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:44px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:500;color:var(--mk-attenue)}',
      '.lpo-erreur{display:flex;gap:8px;align-items:flex-start;margin:8px 0 0;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:#A32D47}',

      /* les réglages, à droite */
      '.lpo-regl{overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 24px 24px}',
      '.lpo-regl section{padding:16px 0;border-bottom:1px solid var(--mk-trait)}',
      '.lpo-regl section:last-child{border-bottom:0}',
      '.lpo-regl .lpo-cap{display:block;margin-bottom:8px}',
      '.mk-espace .lpo-sujet{display:grid;grid-template-columns:28px 1fr;gap:12px;align-items:start;width:100%;text-align:left;padding:10px 12px;border-radius:var(--mk-r-vig);min-height:48px;border:1px solid transparent}',
      '.lpo-sujet+.lpo-sujet{margin-top:4px}',
      '.lpo-sujet i{font-style:normal;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:var(--mk-s5);font-weight:700;background:var(--mk-groupe);color:var(--mk-encre2)}',
      '.lpo-sujet strong{font-weight:600;font-size:var(--mk-s4);line-height:22px}',
      '.lpo-sujet.lpo-idee strong{font-weight:500;font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-encre2)}',
      '.mk-espace .lpo-sujet[aria-pressed="true"]{background:var(--mk-pale);border-color:rgba(0,80,230,.22)}',
      '.lpo-sujet[aria-pressed="true"] i{background:var(--mk-bleu);color:#fff}',
      '.lpo-sujet[aria-pressed="true"] strong{color:var(--mk-encre)}',
      '.lpo-t5{margin:8px 0 0;font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-attenue);font-weight:500}',
      '.lpo-media{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center}',
      '.lpo-mv{position:relative;width:64px;height:64px;border-radius:var(--mk-r-vig);overflow:hidden;background:#0A2A7A}',
      '.lpo-mv .mk-couv{aspect-ratio:auto;height:100%;border-radius:0}',
      '.lpo-mv .mk-couv-puce,.lpo-mv .mk-couv-rond{display:none}',
      '.lpo-ok{position:absolute;right:4px;bottom:4px;width:20px;height:20px;border-radius:50%;background:var(--mk-vert);color:#fff;display:grid;place-items:center}',
      '.lpo-media strong{display:block;font-size:var(--mk-s4);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lpo-media span{display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-attenue);font-weight:500}',
      '.lpo-mact{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 0 -12px}',
      '.mk-espace .mk-btn.lpo-rose{color:#B93550}',
      '.lpo-bloc{width:100%}',
      '.lpo-fichier{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
      '.lpo-champ{display:block;width:100%;min-height:72px;padding:12px;font-family:inherit;font-size:16px;line-height:24px;color:var(--mk-encre);border-radius:var(--mk-r-vig);border:1px solid var(--mk-trait);background:#fff;box-shadow:0 1px 2px rgba(11,31,77,.06) inset;resize:vertical;outline:none}',
      '.lpo-champ:focus{border-color:var(--mk-bleu);box-shadow:0 0 0 3px rgba(0,80,230,.16)}',
      'details.lpo-repli>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;cursor:pointer;font-weight:600}',
      'details.lpo-repli>summary::-webkit-details-marker{display:none}',
      'details.lpo-repli[open]>summary svg{transform:rotate(180deg)}',
      'details.lpo-repli[open]>summary{margin-bottom:8px}',
      '.lpo-appr{--n:3;margin-bottom:8px}',
      '.mk-espace .lpo-appr button{font-size:var(--mk-s5);padding:0 4px;white-space:normal;line-height:16px}',
      '.lpo-prompt{background:var(--mk-groupe);color:var(--mk-encre2);border-radius:var(--mk-r-vig);padding:12px;font-family:"PlexMono",ui-monospace,Menlo,monospace;font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;-webkit-overflow-scrolling:touch}',
      '.lpo-rang{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
      '.lpo-note{margin-top:8px;padding:12px;border-radius:var(--mk-r-vig);background:var(--mk-pale);font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-encre2)}',
      '.lpo-autres{display:none;gap:8px;flex-wrap:wrap}',

      /* le pied du volet : un seul bouton plein */
      '.lpo-vp{display:flex;align-items:center;gap:8px;padding:12px 24px;border-top:1px solid var(--mk-trait);background:linear-gradient(180deg,#fff,#F8FAFE)}',
      '.lpo-pousse{flex:1}',
      '.lpo-publie{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;font-size:var(--mk-s3);font-weight:650;color:var(--mk-encre)}',
      '.lpo-publie svg{color:var(--mk-vert)}',

      /* ═══ 390 px : les trois étapes en contrôle segmenté, le volet en feuille plein écran ═══ */
      '@media (max-width:860px){',
      '#v2-root .lip.lpo{padding:16px 16px 32px}',
      '.lpo-tete{flex-direction:column;align-items:stretch;gap:16px;margin-bottom:16px}',
      '.lpo-nb{display:none}',
      '.lpo-moi{min-width:0;width:100%}',
      '.lpo .lpo-etapes{display:grid;position:sticky;top:calc(var(--mk-barre-h) + 8px);z-index:20;margin-bottom:16px;box-shadow:0 1px 2px rgba(11,31,77,.08) inset,0 8px 16px -8px rgba(11,31,77,.18)}',
      '.mk-espace .lpo-etapes button{padding:0 4px;gap:6px}',
      '.lpo-board{display:block}',
      '.lpo-col{display:none}',
      '.lpo-col.active{display:block}',
      '.lpo-col.arrive{animation:lpo-vue 160ms var(--mk-sortie) both}',
      '.lpo-colt{display:none}',
      '.lpo-pile{grid-template-columns:minmax(0,1fr);gap:16px}',
      '.lpo-carte{display:grid;grid-template-columns:128px minmax(0,1fr);column-gap:4px;align-items:center}',
      '.lpo-corps{padding:4px 8px;min-width:0}',
      '.lpo-titre{margin:2px 0 0;min-height:0}',
      '.lpo-pied{grid-column:1/-1;padding-left:4px}',
      '.lpo-carte .mk-couv-puce{display:none}',
      '.lpo-regle-g{grid-template-columns:minmax(0,1fr);gap:12px}',
      '.lpo-suite .mk-btn{flex:1 1 auto}',
      '.lpo-volet{top:auto;left:0;right:0;bottom:0;width:100%;height:calc(100% - 12px);border-radius:var(--mk-r-carte) var(--mk-r-carte) 0 0;border-bottom:0}',
      '.lpo-poignee{display:block;flex:none;width:40px;height:4px;border-radius:2px;background:#C9CFDB;margin:8px auto -4px}',
      '.lpo-vt{padding:8px 8px 8px 16px}',
      '.lpo-vc{display:block;overflow:auto;-webkit-overflow-scrolling:touch}',
      '.lpo-scene{overflow:visible;padding:16px;border-right:0;border-bottom:1px solid var(--mk-trait)}',
      '.lpo-regl{overflow:visible;padding:0 16px 16px}',
      '.lpo-vp{flex-wrap:wrap;padding:8px 16px calc(8px + env(safe-area-inset-bottom,0px))}',
      '.lpo-vp .mk-plein,.lpo-vp .lpo-publie{order:-1;width:100%}',
      '.lpo-pousse{display:none}',
      '.mk-espace .lpo-vp .mk-texte{flex:1;padding:0 4px}',
      '.mk-espace .lpo-vp .lpo-sec2{display:none}',
      '.lpo-autres{display:flex}',
      '}',
      '@keyframes lpo-vue{from{opacity:0;transform:translateX(calc(var(--sens,1)*8px))}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.lpo-col.arrive,.lpo-flash{animation:none}}',

      '.lip-fmt{font-size:12px;font-weight:600;color:var(--lip-ink35);padding:3px 9px;border-radius:20px;background:#f1f4f8}',
      '.lip-swatch{display:flex;gap:12px;align-items:flex-start;margin-bottom:11px;font-size:12.5px;line-height:1.5;color:var(--lip-ink70)}',
      '.lip-swatch span{width:42px;height:42px;border-radius:9px;flex:none;border:1px solid rgba(10,14,26,.14)}',
      '.lip-swatch code{font-size:12px;color:var(--lip-ink35)}',
      '.lip-prompt{background:#12122e;color:#e7e9f5;border-radius:11px;padding:13px 15px;font:400 12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;max-height:210px;overflow:auto;-webkit-overflow-scrolling:touch}',

      /* drawer */
      '#lip-da .lip-scrim{position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(12,17,28,.42);opacity:0;transition:opacity .3s var(--lip-ease);z-index:910}',
      '#lip-da .lip-scrim.open{opacity:1}',
      '#lip-da .lip-dr{position:fixed;top:0;right:0;bottom:0;width:min(660px,100vw);background:#fff;box-shadow:-20px 0 60px rgba(10,14,26,.20);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .34s var(--lip-ease);z-index:911}',
      '#lip-da .lip-dr.open{transform:translateX(0)}',
      /* lot 3 : dans ce panneau, aucun texte sous 13 px */
      '#lip-da .lip-eyebrow,#lip-da .lip-flab,#lip-da .lip-swatch,#lip-da .lip-swatch code,#lip-da .lip-srow,#lip-da .lip-srow span,#lip-da .lip-vaide{font-size:13px}',
      '#lip-da .lip-prompt{font-size:13px;background:#0E1630}',
      '.lip-drh{display:flex;align-items:flex-start;gap:12px;padding:20px 22px 16px;border-bottom:1px solid var(--lip-line2)}',
      '.lip-drh h2{margin:2px 0 0;font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.28}',
      '.lip-eyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--lip-ink35)}',
      '.lip-close{width:38px;height:38px;flex:none;border-radius:10px;border:1px solid var(--lip-line);background:#fff;color:var(--lip-ink70);cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.lip-close:hover{background:var(--lip-bg)}',
      '.lip-drb{flex:1;overflow-y:auto;padding:20px 22px 30px;-webkit-overflow-scrolling:touch}',
      '.lip-drf{display:flex;gap:9px;align-items:center;padding:14px 22px;border-top:1px solid var(--lip-line2);background:#fcfdfe;flex-wrap:wrap}',
      '.lip-field{margin-bottom:24px}',
      '.lip-flab{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--lip-ink35);margin-bottom:9px}',


      /* variantes */
      '.lip-var{border:1.5px solid var(--lip-line);border-radius:12px;padding:14px 15px;margin-bottom:10px;cursor:pointer;background:#fff;transition:border-color .15s var(--lip-ease),background-color .15s var(--lip-ease);position:relative}',
      '.lip-var:hover{border-color:#c9d3e2;background:#fcfdff}',
      '.lip-var.on{border-color:var(--lip-blue);background:var(--lip-blue050);box-shadow:0 0 0 3px rgba(0,87,255,.09)}',
      '.lip-vtop{display:flex;align-items:center;gap:9px;margin-bottom:9px}',
      '.lip-vton{font-size:13px;font-weight:800;letter-spacing:-.01em}',
      '.lip-vaide{font-size:12px;color:var(--lip-ink35);margin-top:7px;font-style:italic}',


      '.lip-tags{font-size:12.5px;color:var(--lip-ink50);font-weight:600;margin-top:8px}',
      '.lip-empty{text-align:center;padding:60px 20px;color:var(--lip-ink35);font-size:14px}',

      /* ── veille ── */
      '.lip-scard{background:var(--lip-panel);border:1px solid var(--lip-line);border-radius:14px;padding:16px 17px;box-shadow:var(--lip-sh)}',
      '.lip-srow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid var(--lip-line2);font-size:12.5px}',
      '.lip-srow:last-child{border-bottom:none}',
      '.lip-sk{color:var(--lip-ink50)}',
      '.lip-sv{font-weight:800;letter-spacing:-.01em}',
      '.lip-sect{margin:34px 0 0}',
      '.lip-sect h2{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}',
      '.lip-sect p.lip-sd{font-size:13px;color:var(--lip-ink50);margin:0 0 14px;line-height:1.55;max-width:760px}',
      '.lip-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--lip-line);border-radius:12px;background:#fff;box-shadow:var(--lip-sh)}',
      '.lip-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}',
      '.lip-tbl th{text-align:left;padding:11px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--lip-ink35);border-bottom:1px solid var(--lip-line);white-space:nowrap}',
      '.lip-tbl td{padding:10px 14px;border-bottom:1px solid var(--lip-line2);vertical-align:middle}',
      '.lip-tbl tr:last-child td{border-bottom:none}',
      '.lip-tbl td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}',
      '.lip-gap{display:inline-block;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:800}',
      '.lip-gap.plus{background:#ffe9ee;color:#c2183c}',
      '.lip-gap.moins{background:#e6f7f0;color:#00734f}',
      '.lip-mini{height:8px;border-radius:4px;background:var(--lip-blue);display:inline-block;vertical-align:middle;min-width:2px}',
      '.lip-post{background:#fff;border:1px solid var(--lip-line);border-radius:12px;padding:14px 16px;margin-bottom:9px;box-shadow:var(--lip-sh)}',
      '.lip-pmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px;font-size:12px}',
      '.lip-psrc{font-weight:800;padding:3px 9px;border-radius:20px;background:var(--lip-blue050);color:var(--lip-blue)}',
      '.lip-pdate{color:var(--lip-ink35);font-weight:600}',
      '.lip-peng{margin-left:auto;font-weight:700;color:var(--lip-ink70);white-space:nowrap}',
      '.lip-ptxt{font-size:13.5px;line-height:1.6;color:var(--lip-ink70);white-space:pre-wrap;word-break:break-word}',
      '.lip-ptxt.clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}',
      '.lip-plus{border:0;background:transparent;color:var(--lip-blue);font-family:inherit;font-size:12.5px;font-weight:700;line-height:1;cursor:pointer;padding:8px 0 0}',
      '.lip-load{text-align:center;padding:50px 20px;color:var(--lip-ink35);font-size:14px}',
      /* ═══ LOT 6 (19/09/2026) — la veille dans les jetons de l'espace Marketing (.lpv). Les règles .lip-* ci-dessus restent la base ;
         ici : l'échelle 34/22/16/15/13, les élévations du socle, aucun texte sous 13 px, aucune cible sous 44 px. ═══ */
      '#v2-root .lip.lpv{max-width:1320px;padding:32px 32px 96px;color:var(--mk-encre)}',
      '.lpv-entete{margin-bottom:24px}',
      '.lpv-entete h1{margin:0;font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em}',
      '.lpv-entete p{margin:8px 0 0;max-width:80ch;color:var(--mk-attenue)}',
      '.lpv .lpv-onglets{max-width:520px;margin:0 0 32px}',
      '.lpv h2{margin:0;font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;letter-spacing:-.015em;color:var(--mk-encre)}',
      '.lpv .lip-sect{margin:48px 0 0}',
      '.lpv .lip-sect h2{font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;margin:0}',
      '.lpv-sd{margin:8px 0 0;max-width:88ch;color:var(--mk-attenue);font-size:var(--mk-s4);line-height:var(--mk-s4l)}',
      '.lpv-sd b{color:var(--mk-encre);font-weight:650}',
      '.lpv-focal{padding:28px 32px 12px}',
      '.lpv-tete3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:24px 0 8px}',
      '.lpv-ecart{display:grid;gap:2px;padding:0 24px;border-left:1px solid var(--mk-trait)}',
      '.lpv-ecart:first-child{padding-left:0;border-left:0}',
      '.lpv-ecart b{font-size:48px;line-height:52px;font-weight:700;letter-spacing:-.03em;color:var(--mk-bleu)}',
      '.lpv-ecart b small{font-size:var(--mk-s3);font-weight:600;letter-spacing:0;color:var(--mk-attenue)}',
      '.lpv-ecart span{font-size:var(--mk-s3);line-height:var(--mk-s3l);font-weight:650;color:var(--mk-encre)}',
      '.lpv-ecart em{font-style:normal;font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-attenue)}',
      '.lpv-plus{margin:4px 0 12px}',
      '.lpv-plus summary{display:inline-flex;align-items:center;min-height:44px;font-size:var(--mk-s5);font-weight:600;color:var(--mk-bleu-txt);cursor:pointer;list-style:none}',
      '.lpv-plus summary::-webkit-details-marker{display:none}',
      '.lpv-plus[open] summary{color:var(--mk-attenue)}',
      '.lpv-plus p{margin:0 0 8px;max-width:88ch;font-size:var(--mk-s5);line-height:20px;color:var(--mk-encre2)}',
      '.lpv-avis{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px;margin-top:12px;color:var(--mk-encre2)}',
      '.lpv-avis>svg{flex:none;color:var(--mk-ambre)}',
      '.lpv-avis>p{margin:0;flex:1 1 0;min-width:0;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:550}',
      '.lpv-avis .lpv-plus{flex:1 1 100%;margin:0;padding-left:26px}',
      '.lpv-carte{margin-top:16px;padding:8px 24px;overflow:hidden}',
      '.lpv-pages{width:100%;border-collapse:collapse}',
      '.lpv-pages th,.lpv-pages td{padding:12px;border-bottom:1px solid var(--mk-trait);text-align:left;vertical-align:middle}',
      '.lpv-pages thead th{padding:8px 12px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-attenue);white-space:nowrap}',
      '.lpv-pages .num{text-align:right}',
      '.lpv-pages tbody th{font-size:var(--mk-s4);font-weight:650;color:var(--mk-encre)}',
      '.lpv-pages tbody td{font-size:var(--mk-s3);font-weight:600;color:var(--mk-encre)}',
      '.lpv-pages tbody tr:last-child th,.lpv-pages tbody tr:last-child td{border-bottom:0}',
      '.lpv-pages tr.nous th,.lpv-pages tr.nous td{background:var(--mk-pale);color:var(--mk-bleu-txt)}',
      '.lpv-pages tr.nous th{border-radius:10px 0 0 10px}.lpv-pages tr.nous td:last-child{border-radius:0 10px 10px 0}',
      '.lpv-pages th:first-child{padding-left:12px}',
      '.lpv-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 32px;align-items:start}',
      '.lpv-duo-serre{margin-top:16px}',
      '.lpv .lip-tblwrap{margin-top:16px;overflow:hidden;border:1px solid var(--mk-trait);border-radius:16px;box-shadow:var(--mk-n1)}',
      '.lpv-focal .lip-tblwrap{margin:0 -12px;border:0;box-shadow:none;background:none;border-radius:0}',
      '.lpv .lip-tbl{min-width:0;font-size:var(--mk-s4)}',
      '.lpv .lip-tbl th{padding:10px 12px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:0;text-transform:none;color:var(--mk-attenue);border-bottom-color:var(--mk-trait)}',
      '.lpv .lip-tbl td{padding:10px 12px;border-bottom-color:var(--mk-trait)}',
      '.lpv .lip-tbl td.num{font-weight:600;white-space:nowrap}',
      '.lpv .lip-tbl td:last-child:not(.num){width:30%}',
      '.lpv .lip-gap{padding:2px 10px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:650}',
      '.lpv .lip-gap.plus{background:var(--mk-pale);color:var(--mk-bleu-txt)}',
      '.lpv .lip-gap.moins{background:var(--mk-groupe);color:var(--mk-encre2)}',
      '.lpv .lip-mini{background:var(--mk-bleu)}',
      '.lpv .lip-tools{margin:0 0 16px;gap:8px}',
      '.lpv .lip-sel,.lpv .lip-inp{height:44px;border-radius:var(--mk-r-vig);border:1px solid var(--mk-trait);box-shadow:var(--mk-n1);font-size:16px;color:var(--mk-encre)}',
      '.lpv .lip-inp{flex:1 1 280px;max-width:480px}',
      '.lpv .lip-lab{font-size:var(--mk-s5);letter-spacing:0;text-transform:none;font-weight:600;color:var(--mk-attenue)}',
      '.lpv .lip-post{padding:16px 20px;margin-bottom:12px;border:1px solid var(--mk-trait);border-radius:16px;box-shadow:var(--mk-n1)}',
      '.lpv .lip-pmeta{font-size:var(--mk-s5);line-height:var(--mk-s5l);gap:4px 12px}',
      '.lpv .lip-psrc{padding:2px 10px;background:var(--mk-pale);color:var(--mk-bleu-txt);font-weight:650}',
      '.lpv .lip-pdate,.lpv .lip-fmt{color:var(--mk-attenue);font-weight:500;font-size:var(--mk-s5)}',
      '.lpv .lip-peng{color:var(--mk-encre);font-weight:650}',
      '.lpv .lip-ptxt{font-size:var(--mk-s4);line-height:var(--mk-s4l);color:var(--mk-encre2)}',
      '.lpv .lip-tags{font-size:var(--mk-s5);color:var(--mk-attenue)}',
      '.mk-espace.lpv .lip-plus{min-height:44px;padding:0;font-size:var(--mk-s5);font-weight:600;color:var(--mk-bleu-txt)}',
      '.lpv .lip-empty,.lpv .lip-load{font-size:var(--mk-s4);color:var(--mk-attenue)}',
      '@media (max-width:860px){',
      '#v2-root .lip.lpv{padding:20px 16px 48px}',
      '.lpv .lpv-onglets{max-width:none;margin-bottom:24px}',
      '.mk-espace.lpv .lpv-onglets button{padding:0 4px;font-size:var(--mk-s5)}',
      '.lpv-focal{padding:20px 16px 8px}',
      '.lpv-tete3{grid-template-columns:1fr;gap:16px;margin:16px 0 8px}',
      '.lpv-ecart{grid-template-columns:104px minmax(0,1fr);gap:0 12px;padding:0;border-left:0;align-items:center}',
      '.lpv-ecart b{grid-row:1/3;font-size:34px;line-height:38px}',
      '.lpv-focal .lip-tblwrap{margin:0 -6px}',
      '.lpv .lip-tbl th,.lpv .lip-tbl td{padding:10px 6px}',
      '.lpv .lip-tbl td:last-child:not(.num){width:56px!important}.lpv .lip-tbl th{white-space:normal}',
      '.lpv .lip-tbl .lip-gap{white-space:nowrap}',
      '.lpv-duo{grid-template-columns:minmax(0,1fr)}',
      '.lpv-carte{padding:4px 16px}',
      '.lpv-pages,.lpv-pages tbody{display:block}.lpv-pages thead{display:none}',
      '.lpv-pages tbody tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:16px 0;border-bottom:1px solid var(--mk-trait)}',
      '.lpv-pages tbody tr:last-child{border-bottom:0}',
      '.lpv-pages tbody th,.lpv-pages tbody td,.lpv-pages tbody td.num{display:block;padding:0;border:0;text-align:left}',
      '.lpv-pages tbody th{grid-column:1/4}',
      '.lpv-pages td[data-l]::before{content:attr(data-l);display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:450;color:var(--mk-attenue)}',
      '.lpv-pages tr.nous{margin:0 -8px;padding:16px 8px;border-radius:12px;background:var(--mk-pale)}',
      '.lpv-pages tr.nous th,.lpv-pages tr.nous td{background:none;border-radius:0}',
      '.lpv .lip-inp{max-width:none}',
      '}',

      /* mobile */
      '@media(max-width:760px){',
      '#v2-root .lip{padding:6px 14px 90px}',
      /* flex:1 laissait 28 px au champ de recherche derrière les deux listes
         déroulantes : sur mobile il prend sa propre ligne, en entier. */
      '.lip-inp{flex:1 1 100%;min-width:0;width:100%}',
      '.lip-sel{flex:1 1 44%;min-width:0}',
      '.lip-drh,.lip-drb,.lip-drf{padding-left:16px;padding-right:16px}',
      '.lip-btn,.lip-close{min-height:44px}',
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
    { k: 'valide',       label: 'Retenu',         color: '#00B37A', bg: '#e6f7f0', txt: '#00734F', on: '#00734F' },
    { k: 'retravailler', label: 'À retravailler', color: '#F39A1B', bg: '#fff4e0', txt: '#8A5200', on: '#A05E00' },
    { k: 'refuse',       label: 'Écarté',         color: '#FF4D6D', bg: '#ffe9ee', txt: '#C2183C', on: '#C2183C' }
  ];
  function statut(k) { for (var i = 0; i < STATUTS.length; i++) if (STATUTS[i].k === k) return STATUTS[i]; return STATUTS[0]; }
  var MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DOW = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  // mars, mai, juin, août ne s'abrègent pas : « mars. » est une faute
  var MOIS_CT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

  /* ────────── ligne éditoriale du 18/09/2026 ──────────
     Will : « on n'a pas le droit de parler trop de notre métier en profondeur,
     la chaîne du froid c'est exclu ; on a un rôle d'acteur de la santé
     bienveillant — journées internationales et sensibilisation, oui ».
     Les 48 créneaux des trois piliers « métier » restent dans les données mais
     ne sont plus proposés. SUJETS_METIER retire en plus, dans les piliers gardés,
     les sujets qui racontent l'entrepôt ou le froid (créneau -> n° de sujet). */
  var PILIERS_OK = { sante: 1, depistage: 1, vaccin: 1, rse: 1, pharmaciens: 1 };
  var SUJETS_METIER = { 7: [0], 14: [2], 17: [1], 31: [2], 42: [0], 52: [1], 66: [0, 1, 2], 101: [0, 1] };
  var MAX_SEM = 2;
  var QUI = [{ k: 'pauline', label: 'Pauline' }, { k: 'will', label: 'Will' }];
  var REGLE_OUI = 'journées et mois de sensibilisation, prévention, dépistage, vaccination, solidarité, soutien aux pharmaciens et aux patients.';
  var REGLE_NON = 'le détail de notre métier (chaîne du froid, logistique, entrepôt, tournées), les prix, les réformes, les confrères.';
  function quiLabel(k) { for (var i = 0; i < QUI.length; i++) if (QUI[i].k === k) return QUI[i].label; return ''; }
  function sujetPermis(p, i) { if (p.rempl) return true; var x = SUJETS_METIER[p.n]; return !(x && x.indexOf(i) >= 0); }   // un créneau remplacé (66) ne porte plus les sujets retirés
  // Le sujet affiché : celui choisi s'il est permis, sinon le premier permis.
  function sujetEff(p, e) {
    var i = e.sujet || 0;
    if (sujetPermis(p, i)) return i;
    for (var j = 0; j < 3; j++) if (sujetPermis(p, j)) return j;
    return 0;
  }

  /* Semaines qui restaient sans proposition : LI_PLAN_REMPL (bas de
     mkt-li-plan-data.js) donne à un créneau « métier » un pilier gardé et trois
     sujets de sensibilisation. Le créneau d'origine reste intact dans LI_PLAN. */
  var planVu = null;
  function plan() {
    var P = window.LI_PLAN || null, R = window.LI_PLAN_REMPL;
    if (!P || !R) return P;
    if (!planVu) planVu = P.map(function (p) {
      var r = R[p.n], s = r && r.sujets && r.sujets[0];
      if (!s) return p;
      return { n: p.n, d: p.d, h: p.h, p: r.p, f: s.f || p.f, titre: s.titre, angle: s.angle,
        t: s.t, v: s.v, tags: s.tags || [], rempl: true };
    });
    return planVu;
  }
  function piliers() { return window.LI_PLAN_PILIERS || []; }
  function pilier(k) { var a = piliers(); for (var i = 0; i < a.length; i++) if (a[i].k === k) return a[i]; return { k: k, label: k, color: '#ccc', bg: '#eee' }; }

  /* ────────── les 3 sujets d'un même créneau ──────────
     LI_PLAN porte le sujet d'origine ; mkt-li-plan-alt-data.js porte les deux
     autres, rangés par numéro de créneau. Le fichier est lourd (206 sujets) :
     il se charge à côté, sans bloquer l'affichage de la chronologie.
     La date, l'heure et le pilier appartiennent au CRÉNEAU, pas au sujet :
     changer de sujet ne déplace jamais un post ni ne déséquilibre le plan. */
  function alts() { return window.LI_PLAN_ALT || null; }
  function sujetsDe(p) {
    var A = alts(), out = [p];
    if (p.rempl) A = {}, A[p.n] = window.LI_PLAN_REMPL[p.n].sujets.slice(1);
    if (A && A[p.n]) {
      for (var i = 0; i < A[p.n].length; i++) {
        var a = A[p.n][i];
        out.push({ n: p.n, d: p.d, h: p.h, p: p.p, f: a.f || p.f, titre: a.titre,
          angle: a.angle, t: a.t, v: a.v, tags: a.tags || p.tags, alt: true });
      }
    }
    return out;
  }
  function sujetDe(p, i) { var S = sujetsDe(p); return S[i] || S[0]; }
  function sujetOuvert() { return ouvert ? sujetDe(ouvert.p, ouvert.e.sujet || 0) : null; }

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
  var etats = {};          // plan_id -> {sujet, statut, variante, visuel, commentaire}
  var charge = false;

  function vide() { return { sujet: 0, statut: 'attente', variante: null, visuel: null, commentaire: '', image_path: '', resp: '', publie: false, texte: '', texteCle: '' }; }
  function copieEtat(e) { return { sujet: e.sujet || 0, statut: e.statut || 'attente', variante: e.variante, visuel: e.visuel,
    commentaire: e.commentaire || '', image_path: e.image_path || '', resp: e.resp || '', publie: !!e.publie,
    texte: e.texte || '', texteCle: e.texteCle || '' }; }
  // « Qui s'en occupe » n'a pas de colonne : il voyage en tête du commentaire
  // (« @pauline| … ») et en est retiré à la lecture. Aucun changement de table.
  var RX_RESP = /^@(pauline|will)\|\s?/;
  // « Publié » non plus : il suit, sous la forme « #publie| ». Une ancienne version
  // de l'écran le laisse intact dans le commentaire au lieu de le perdre.
  var RX_PUB = /^#publie\|\s?/;
  // Le texte retouché à la main non plus : il voyage en QUEUE du commentaire, sous
  // « #texte|sujet.version| », et ne vaut que pour ce sujet et cette version-là.
  var RX_TXT = /(?:^|\n)#texte\|(\d+\.\d+)\|\n([\s\S]*)$/;
  function lireTexte(c) { var m = RX_TXT.exec(String(c || '')); return m ? { cle: m[1], txt: m[2] } : { cle: '', txt: '' }; }
  function lireResp(c) { var m = RX_RESP.exec(String(c || '')); return m ? m[1] : ''; }
  function etat(n) { return etats[n] || vide(); }
  function localTout() { try { var o = JSON.parse(localStorage.getItem(LS) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
  function localEcrire(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }

  function chargerEtats() {
    var c = sb();
    if (!c) { backend = 'local'; etats = localTout(); reessayer(); return Promise.resolve(etats); }
    return c.from('linkedin_plan_valid').select('*').then(function (r) {
      if (r.error || !r.data) { backend = 'local'; etats = localTout(); reessayer(); return etats; }
      backend = 'supabase'; etats = {};
      r.data.forEach(function (x) {
        etats[x.plan_id] = { sujet: x.sujet || 0, statut: x.statut || 'attente', variante: (x.variante === null || x.variante === undefined) ? null : x.variante,
          visuel: (x.visuel === null || x.visuel === undefined) ? null : x.visuel,
          commentaire: String(x.commentaire || '').replace(RX_TXT, '').replace(RX_RESP, '').replace(RX_PUB, ''), resp: lireResp(x.commentaire),
          texte: lireTexte(x.commentaire).txt, texteCle: lireTexte(x.commentaire).cle,
          publie: RX_PUB.test(String(x.commentaire || '').replace(RX_RESP, '')),
          image_path: x.image_path || '',
          qui: x.qui || '', updated_at: x.updated_at || null };
      });
      remonterLocal();
      return etats;
    }).catch(function () { backend = 'local'; etats = localTout(); reessayer(); return etats; });
  }

  // 18/09/2026 — une lecture ratée à l'ouverture (coupure de quelques secondes)
  // laissait TOUTE la session en repli local : les choix de l'un restaient
  // invisibles pour l'autre jusqu'à la visite suivante. On réessaie toutes les
  // 20 s tant qu'on est sur l'écran ; ailleurs, on relira à la prochaine ouverture.
  var relance = null;
  function reessayer() {
    if (relance) return;
    relance = setTimeout(function () {
      relance = null;
      if (!surEcran()) { charge = false; return; }
      chargerEtats().then(function () { if (backend === 'supabase') redessine(); });
    }, 20000);
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
      redessine();
      toast(manquants.length + ' validation(s) de cet ordinateur partagée(s) avec l\'équipe');
    }).catch(function () {});
  }

  function ligne(n, e) {
    return { plan_id: n, sujet: e.sujet || 0, statut: e.statut, variante: e.variante, visuel: e.visuel,
      commentaire: (e.resp ? '@' + e.resp + '| ' : '') + (e.publie ? '#publie| ' : '') + (e.commentaire || '') +
        (e.texte ? '\n#texte|' + e.texteCle + '|\n' + e.texte : ''), image_path: e.image_path || '',
      qui: (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
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

  // ⚠️ V2.lip est peuplé plus bas (section « API publique ») : les fonctions
  // définies ici sont plus haut dans le fichier, il faut donc créer l'objet.
  V2.lip = V2.lip || {};

  /* ────────── prompts pour le générateur d'images ──────────
     La DA est décrite dans mkt-li-da-data.js, à partir de nos 39 visuels publiés.
     Le prompt se construit à la volée depuis l'idée de visuel RETENUE : il suit
     donc le choix de la direction au lieu d'être figé dans les données. */
  function da() { return window.LI_DA || null; }
  function approcheDe(k) {
    var d = da(); if (!d) return null;
    for (var i = 0; i < d.approches.length; i++) if (d.approches[i].k === k) return d.approches[i];
    return d.approches[0];
  }
  // L'approche pré-sélectionnée suit la nature de l'idée de visuel : inutile de
  // proposer « Le concret » en premier quand l'idée dit « visuel typographique ».
  function approcheSuggeree(idee) {
    var t = String(idee || '').toLowerCase();
    // ⚠️ limites de mot obligatoires : « afficheur de sonde » contient « affiche »
    // et basculait à tort sur l'approche typographique.
    if (/typographique|\baffiche\b|\bcitation\b|phrase en (tr[eè]s )?grand|lettrage/.test(t)) return 'idee';
    if (/photo|macro|contre-jour|vid[ée]o|time-?lapse|clich[ée]|reportage|portrait/.test(t)) return 'concret';
    return 'gabarit';
  }
  // La phrase entre guillemets d'un visuel typographique ne doit PAS partir dans
  // le prompt : toutes les approches interdisent le texte dans l'image. On la
  // sort pour l'afficher à côté, à poser ensuite dans l'outil de mise en page.
  // Tout ce qui est entre guillemets dans une idée de visuel est du TEXTE : une
  // phrase à composer, ou l'étiquette d'un schéma. Aucun des trois prompts ne
  // fait écrire de texte — on sort donc tout, et on le liste à côté.
  function motsAPoser(idee) {
    var out = [], rx = /«\s*([^»]{2,220}?)\s*»/g, m;
    while ((m = rx.exec(String(idee || '')))) out.push(m[1].trim());
    return out;
  }
  // Une idée de visuel contient deux choses : ce qu'on veut VOIR, et des
  // consignes de tournage qui s'adressent à nous (durée, son, sous-titres,
  // autorisations). Seule la première part au générateur.
  var PARASITES = [
    /[^.]*sous-titres[^.]*\.?/gi,
    /[^.]*(accord|autorisation)s? [ée]crite?s?[^.]*\.?/gi,
    /[^.]*lisible en petit[^.]*\.?/gi,
    /[^.]*pens[ée] pour [êe]tre[^.]*\.?/gi,
    /[^.]*[àa] (imprimer|enregistrer|afficher en officine)[^.]*\.?/gi,
    /[^.]*(son d.ambiance|musique|voix off|bande[- ]son)[^.]*\.?/gi,
    /[^.]*(gif l[ée]ger|animation possible)[^.]*\.?/gi
  ];
  function sujetPropre(idee, appr) {
    var t = String(idee || '');
    PARASITES.forEach(function (rx) { t = t.replace(rx, ''); });
    t = t.replace(/\bVid[ée]os?\b(\s+(verticale|courte))?\s*\d*\s*[-–]?\s*\d*\s*s?\b/gi, 'Scène');
    // Aucune approche n'écrit de texte. Une étiquette courte devient un
    // emplacement — « deux flèches légendées « gel » et « perte » » doit rester
    // « deux flèches légendées (étiquette) et (étiquette) », pas « légendées et ».
    t = t.replace(/«\s*[^»]{2,220}?\s*»/g, function (x) {
      return x.length > 34 ? '' : '(étiquette)';
    }).replace(/\s*en (tr[eè]s )?grand/gi, '');
    if (appr === 'idee') t = t.replace(/[^.]*mention de la journ[ée]e[^.]*\.?/gi, '');
    t = t.replace(/\s*:\s*[,;.]+/g, ' :')
         .replace(/\s*,\s*(?=[,;.])/g, '')
         .replace(/\s+([,;.!?])/g, '$1')
         .replace(/([,;:])\s*\1+/g, '$1')
         .replace(/\s{2,}/g, ' ')
         .replace(/^[\s,;:.\-—]+/, '')
         .replace(/[\s,;:]+$/, '')
         .trim();
    if (t && !/[.!?]$/.test(t)) t += '.';
    return t;
  }
  function promptPour(p, idxVisuel, appr) {
    var d = da(); if (!d || !p) return '';
    var idee = (p.v && p.v[idxVisuel]) ? p.v[idxVisuel] : (p.v && p.v[0]) || '';
    var a = approcheDe(appr);
    // Le thème n'est PAS mis entre guillemets : un générateur prend volontiers
    // une chaîne citée pour du texte à écrire dans l'image.
    var sujet = 'Contexte : post LinkedIn d’un grossiste-répartiteur pharmaceutique. Thème du post : ' +
      String(p.titre || '').replace(/[«»]/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim() +
      '. ' + sujetPropre(idee, appr);
    return a.tpl.replace('{SUJET}', sujet);
  }
  // Quelle approche est affichée dans la fiche ouverte
  var apprVue = null;
  V2.lip.setApproche = function (k) { apprVue = k; redessineTiroir(); };
  function apprCourante() {
    if (!ouvert) return 'gabarit';
    if (apprVue) return apprVue;
    var i = (ouvert.e.visuel === null) ? 0 : ouvert.e.visuel;
    var c = sujetOuvert();
    return approcheSuggeree((c && c.v && c.v[i]) || '');
  }
  V2.lip.copierPrompt = function () {
    if (!ouvert) return;
    var i = (ouvert.e.visuel === null) ? 0 : ouvert.e.visuel;
    var txt = promptPour(sujetOuvert(), i, apprCourante());
    if (!txt) { toast('La fiche de direction artistique n’est pas chargée', 'error'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        function () { var S = V2.mktSocle; if (S && S.confirmer) S.confirmer(document.getElementById('lpo-copier-prompt')); },
        function () { window.prompt('Copiez le prompt :', txt); });
    } else window.prompt('Copiez le prompt :', txt);
  };
  V2.lip.voirDA = function () {
    var d = da();
    if (!d) { chargerDA(); toast('Chargement de la direction artistique…'); return; }
    monterDA(daHtml());
  };
  function chargerDA() { charger('mkt-li-da-data.js', da).then(function (ok) { if (ok) monterDA(daHtml()); }); }

  function daHtml() {
    var d = da();
    var pastilles = d.palette.map(function (c) {
      return '<div class="lip-swatch"><span style="background:' + c.hex + '"></span>' +
        '<div><b>' + esc(c.nom) + '</b> <code>' + esc(c.hex) + '</code><br>' + esc(c.role) + '</div></div>';
    }).join('');
    var mesures = d.constat.map(function (c) {
      return '<div class="lip-srow" style="align-items:flex-start"><span class="lip-sk" style="min-width:92px">' + esc(c.k) + '</span>' +
        '<span style="flex:1;text-align:right"><b>' + esc(c.v) + '</b><br><span style="color:var(--lip-ink35);font-size:13px">' + esc(c.d) + '</span></span></div>';
    }).join('');
    var fam = d.approches.map(function (f) {
      return '<div class="lip-var" style="cursor:default"><div class="lip-vtop"><span class="lip-vton">' + esc(f.label) + '</span></div>' +
        '<div class="lip-vaide" style="font-style:normal;color:var(--lip-ink70);margin:0 0 9px">' + esc(f.aide) + '</div>' +
        '<div class="lip-prompt" style="max-height:240px">' + esc(f.tpl.replace('{SUJET}', '(le sujet du post s’insère ici)')) + '</div></div>';
    }).join('');
    var liste = function (a) { return '<ul style="margin:0;padding-left:19px;font-size:13.5px;line-height:1.65;color:var(--lip-ink70)">' +
      a.map(function (x) { return '<li style="margin-bottom:6px">' + esc(x) + '</li>'; }).join('') + '</ul>'; };
    return '<div class="lip-scrim" onclick="V2.lip.fermerDA()"></div>' +
      '<aside class="lip-dr" role="dialog" aria-modal="true" aria-label="Direction artistique image">' +
        '<div class="lip-drh"><div style="flex:1;min-width:0">' +
          '<div class="lip-eyebrow">Direction artistique · image</div>' +
          '<h2>Ce à quoi ressemblent nos visuels</h2>' +
          '<div class="lip-sub" style="margin-top:6px">Relevé sur ' + esc(d.corpus) + '.</div>' +
        '</div><button class="lip-close" onclick="V2.lip.fermerDA()" aria-label="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="lip-drb">' +
          '<div class="lip-field"><span class="lip-flab">Ce qui a été mesuré</span>' +
            '<div class="lip-scard" style="box-shadow:none">' + mesures + '</div></div>' +
          '<div class="lip-field"><span class="lip-flab">La palette</span>' + pastilles + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Trois approches</span>' + fam + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Les règles</span>' + liste(d.regles) + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Ce qu’on évite</span>' + liste(d.aEviter) + '</div>' +
        '</div>' +
        '<div class="lip-drf"><span class="lip-spacer"></span>' +
          '<button class="lip-btn" onclick="V2.lip.fermerDA()">Fermer</button></div>' +
      '</aside>';
  }

  /* ────────── visuel réellement attaché au post du plan ────────── */
  // L'adresse publique est calculée par le module LinkedIn : une seule
  // implémentation, un seul endroit à corriger si l'espace de stockage change.
  function urlImage(chemin) {
    if (!chemin) return '';
    if (/^https?:/.test(chemin)) return chemin;
    if (V2.li && V2.li.imgUrl) return V2.li.imgUrl(chemin);
    var c = sb();
    if (c && c.storage) { try { return c.storage.from('marketing-media').getPublicUrl(chemin).data.publicUrl; } catch (e) {} }
    return chemin;
  }
  var MAX_IMG = 25 * 1024 * 1024, MAX_AUTRE = 50 * 1024 * 1024;
  var ACCEPTE = 'image/*,video/mp4,video/quicktime,video/webm,application/pdf';
  function genreFichier(chemin) {
    var x = String(chemin || '').split('?')[0].toLowerCase();
    if (/\.(mp4|mov|m4v|webm)$/.test(x)) return 'video';
    if (/\.pdf$/.test(x)) return 'doc';
    return 'image';
  }
  // Le fichier du post se partage tout de suite, comme « Qui s'en occupe » : sans
  // emporter le sujet ou le texte encore à l'essai dans la fiche.
  function partagerFichier(n, chemin) {
    var p = postDe(n); if (!p) return;
    var s = copieEtat(etat(n));
    s.image_path = chemin; s.sujet = sujetEff(p, s);
    if (ouvert && ouvert.n === n) ouvert.e.image_path = chemin;
    enregistrer(n, s).then(function () { signalerEnregistre(); redessineTiroir(); redessine(); });
  }
  // Lot 3 — geste 8 : le refus s'écrit DANS la zone du média (mêmes limites, mêmes phrases qu'avant), plus dans une boîte du navigateur.
  function refuserFichier(msg) { if (!ouvert) return; ouvert.erreurMedia = msg; redessineTiroir(); }
  function envoyerFichier(f) {
    if (!f || !ouvert || ouvert.envoi) return;
    ouvert.erreurMedia = ''; ouvert.note = '';
    var c = sb();
    if (!(c && c.storage)) return refuserFichier('Envoi impossible : vous n’êtes pas connecté à la base. Reconnectez-vous, puis recommencez.');
    var estImage = /^image\//.test(f.type), genre = estImage ? 'image' : genreFichier(f.name);
    if (!estImage && genre === 'image') return refuserFichier('Ce type de fichier n’est pas accepté (' + (f.type || 'type inconnu') + '). Formats acceptés : image, vidéo MP4 ou MOV, document PDF.');
    var max = estImage ? MAX_IMG : MAX_AUTRE;
    if (f.size > max) return refuserFichier('Fichier trop lourd : ' + (f.size / 1048576).toFixed(1) + ' Mo. La limite est de ' + (max / 1048576) + ' Mo.');
    var n = ouvert.n, local = '';
    if (genre !== 'doc') { try { local = URL.createObjectURL(f); } catch (e) {} }
    var env = ouvert.envoi = { nom: f.name, genre: genre, url: local, p: .12 };
    redessineTiroir();
    /* Le service d'envoi ne donne pas l'avancement en octets : la barre AVANCE vers 90 % tant que l'envoi dure,
       et ne se remplit qu'à la vraie fin. Elle dit « ça travaille », elle ne ment pas sur « c'est fini ». */
    var minuteur = setInterval(function () {
      env.p += (.9 - env.p) * .08;
      var b = document.getElementById('lpo-prog'); if (b) b.style.setProperty('--p', env.p.toFixed(3));
    }, 200);
    var finir = function (msg, chemin) {
      clearInterval(minuteur);
      var ici = ouvert && ouvert.n === n && ouvert.envoi === env;
      var solder = function () {
        if (local) { try { URL.revokeObjectURL(local); } catch (e) {} }
        if (ici) { ouvert.envoi = null; ouvert.erreurMedia = msg || ''; }
        if (msg) { redessineTiroir(); return; }
        partagerFichier(n, chemin);
      };
      if (msg || !ici) return solder();
      var b = document.getElementById('lpo-prog'); if (b) b.style.setProperty('--p', 1);   // plein, puis la barre s'efface avec la zone
      setTimeout(solder, calme() ? 0 : 240);
    };
    var ext = (f.name.match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase();
    var base = f.name.replace(/\.[a-zA-Z0-9]+$/, '');
    if (base.normalize) base = base.normalize('NFD').replace(/[̀-ͯ]/g, '');
    base = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'visuel';
    var chemin = 'linkedin/plan' + n + '_' + Date.now() + '_' + base + ext;
    c.storage.from('marketing-media').upload(chemin, f, { upsert: true, contentType: f.type || undefined })
      .then(function (r) {
        if (r && r.error) {
          var m = r.error.message || 'raison inconnue';
          if (/bucket/i.test(m)) m = 'l’espace de stockage est introuvable côté serveur';
          else if (/policy|permission|unauthor|403/i.test(m)) m = 'votre compte n’a pas le droit d’écrire ici';
          else if (/size|large|413/i.test(m)) m = 'le fichier est trop lourd pour le serveur';
          return finir('Le fichier n’a pas été envoyé : ' + m + '.');
        }
        finir('', chemin);
      })
      .catch(function (err) { finir('Le fichier n’a pas été envoyé : ' + String(err.message || err).slice(0, 140) + '.'); });
  }
  V2.lip.envoyerImage = function (input) {
    var f = input && input.files && input.files[0];
    if (input) input.value = '';
    envoyerFichier(f);
  };
  V2.lip.choisirFichier = function () { var i = document.getElementById('lpo-fichier'); if (i) i.click(); };
  V2.lip.retirerImage = function () { if (ouvert) { ouvert.erreurMedia = ''; partagerFichier(ouvert.n, ''); } };
  V2.lip.zoomTiroir = function () {
    if (ouvert && ouvert.e.image_path && genreFichier(ouvert.e.image_path) === 'image' && V2.li && V2.li.zoom) V2.li.zoom(urlImage(ouvert.e.image_path), ouvert.p.titre);
  };

  /* ───────────────── ce qui est proposé ───────────────── */
  function visible(p) {
    if (!PILIERS_OK[p.p]) return false;
    for (var j = 0; j < 3; j++) if (sujetPermis(p, j)) return true;
    return false;   // les trois sujets du créneau sont « métier »
  }

  /* ────────── posts libres (hors plan) ──────────
     Depuis le 20/08 le module n'a plus que deux onglets : tout se passe ici.
     Les posts créés à la main — et les 13 déjà en base — doivent donc apparaître
     dans la même liste que le plan, sinon ils deviennent invisibles. */
  var libresCharges = false;
  function libres() {
    var LI = V2.mktLinkedin;
    if (!LI || !LI._posts) return [];
    return LI._posts().filter(function (x) { return x && x.date; });
  }
  function chargerLibres() {
    var LI = V2.mktLinkedin;
    if (libresCharges || !LI || !LI.loadPosts) return;
    libresCharges = true;
    LI.loadPosts().then(function () { redessine(); });
  }
  function dateCourte(d) { return DOW[d.getDay()].toLowerCase() + '. ' + jj(d.getDate()) + ' ' + MOIS_CT[d.getMonth()]; }
  // Un post libre suit son propre statut : idée et rédaction = à choisir.
  function etapeLibre(x) { return x.status === 'publie' ? 'publie' : (x.status === 'pret' ? 'pret' : 'choisir'); }
  function carteLibre(x) {
    var id = esc(String(x.id)), d = new Date(x.date), quand = dateCourte(d);
    var S = V2.mktSocle, titre = x.title || '(sans titre)';
    var couv = (S && S.couverture) ? S.couverture({ titre: titre, surtitre: 'Hors plan', famille: 'Post libre', motif: 'cercles', pale: true,
      media: x.image_path ? urlImage(x.image_path) : '', genre: genreFichier(x.image_path), alt: 'Visuel du post libre : ' + titre }) : '';
    return '<article class="lpo-carte mk-souleve mk-lever" tabindex="0" role="button" data-mk-id="L' + id + '" aria-label="Ouvrir le post libre du ' + esc(quand) + '" ' +
      'onclick="V2.lip.ouvrirLibre(\'' + id + '\')" ' +
      'onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();V2.lip.ouvrirLibre(\'' + id + '\')}">' +
      '<span class="lpo-vig">' + couv + '</span>' +
      '<div class="lpo-corps"><div class="lpo-haut"><span class="lpo-date">' + esc(quand + ' · ' + pad2(d.getHours()) + ' h ' + pad2(d.getMinutes())) + '</span>' +
        (x.status === 'publie' ? '<span class="lpo-stat" title="Publié">' + icS('coche', 16, 2.5) + '</span>' : '') + '</div>' +
        '<p class="lpo-titre">' + esc(titre) + '</p></div>' +
      '<div class="lpo-pied"><span class="lpo-fam"><i style="background:#8C95A8"></i>Hors plan</span></div></article>';
  }
  // Icône du jeu de l'espace Marketing (v2-mkt-socle.js) ; à défaut, rien.
  function icS(n, s, w) { return (V2.mktSocle && V2.mktSocle.ic) ? V2.mktSocle.ic(n, s, w) : ''; }
  function pad2(n) { return ('0' + n).slice(-2); }
  /* ───────────────── rendu : rétro-planning ───────────────── */
  function moisLabel(ym) {
    var a = ym.split('-'); return MOIS[parseInt(a[1], 10) - 1] + ' ' + a[0];
  }

  function isoJour(x) { return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); }
  function lundiDe(iso) {
    var x = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return isoJour(x);
  }
  function jj(n) { return n === 1 ? '1er' : String(n); }
  function semLabel(l) {
    var a = new Date(l + 'T12:00:00'), b = new Date(l + 'T12:00:00'); b.setDate(b.getDate() + 6);
    return 'Semaine du ' + jj(a.getDate()) + (a.getMonth() !== b.getMonth() ? ' ' + MOIS[a.getMonth()] : '') +
      ' au ' + jj(b.getDate()) + ' ' + MOIS[b.getMonth()] + ' ' + b.getFullYear();
  }
  function postDe(n) { var P = plan(); for (var i = 0; P && i < P.length; i++) if (P[i].n === n) return P[i]; return null; }
  // Posts retenus dans une semaine : ceux du plan marqués « Retenu » + les posts libres.
  function retenusSemaine(l) {
    var c = 0;
    plan().forEach(function (p) { if (visible(p) && lundiDe(p.d) === l && etat(p.n).statut === 'valide') c++; });
    libres().forEach(function (x) { if (lundiDe(x.date) === l) c++; });
    return c;
  }
  var voirPasse = false;

  /* Vue « À deux » : ce que chacun regarde (préférence de cet ordinateur,
     pas une donnée partagée), le nombre de semaines affichées, l'onglet mobile. */
  var LSV = 'jarvis_li_plan_vue';
  var moi = (function () { try { var w = JSON.parse(localStorage.getItem(LSV) || '{}').who; return (w === 'pauline' || w === 'will') ? w : 'both'; } catch (e) { return 'both'; } })();
  var nbSem = 4, etape = 'choisir', voirEcartes = false;
  var ETAPES = [
    { k: 'choisir', label: 'À choisir', court: 'À choisir', vide: 'Rien à choisir pour l’instant' },
    { k: 'pret', label: 'Prêt à publier', court: 'Prêt', vide: 'Les posts arrivent ici quand un texte est retenu' },
    { k: 'publie', label: 'Publié', court: 'Publié', vide: 'Les posts publiés arrivent ici' }
  ];
  function etapeDe(e) { return e.publie ? 'publie' : (e.statut === 'valide' ? 'pret' : 'choisir'); }

  /* ────────── la couverture d'un post (lot 3) ──────────
     Le visuel importé s'il existe ; sinon une couverture TYPOGRAPHIQUE fabriquée depuis l'idée de visuel
     (la phrase entre guillemets d'un « visuel typographique ») ou, à défaut, depuis le titre.
     Le dessin lui-même vit dans le socle (V2.mktSocle.couverture) : « Cette semaine » le réutilisera. */
  var MOTIF_FAM = { sante: 'bouclier', depistage: 'oeil', vaccin: 'anneau', rse: 'cercles', pharmaciens: 'croix' };
  var MOTIF_MOT = [[/octobre rose|cancer du sein|ruban/i, 'ruban'], [/lavage des mains|hydrat|canicule|don du sang/i, 'gouttes'],
    [/\bvue\b|vision|\byeux\b/i, 'oeil'], [/c(œ|oe)ur|\bavc\b|tension|cardia/i, 'onde'], [/s[ée]curit[ée]/i, 'bouclier'],
    [/vaccin|grippe/i, 'anneau'], [/pharmacien|merci/i, 'croix']];
  var FORMATS = { carrousel: ['Carrousel', 'pile'], video: ['Vidéo', 'lecture'], 'multi-images': ['Plusieurs images', 'pile'] };
  function nomFichier(chemin) { return String(chemin || '').split('?')[0].replace(/^.*\/plan\d+_\d+_/, '').replace(/^.*\//, ''); }
  function infoCouv(p, e) {
    var cur = sujetDe(p, sujetEff(p, e)), pl = pilier(p.p), titre = String(cur.titre || '');
    var idee = (cur.v && cur.v[(e.visuel === null || e.visuel === undefined) ? 0 : e.visuel]) || (cur.v && cur.v[0]) || '';
    var m = /^(\d{1,2}(?:er)?\s+[^\s—]+)\s+—\s+(.+)$/.exec(titre);
    var mots = /typographique|citation/i.test(idee) ? motsAPoser(idee) : [], phrase = '';
    for (var i = 0; i < mots.length; i++) if (mots[i].length >= 4 && mots[i].length <= 84) { phrase = mots[i]; break; }
    var texte = phrase || (m ? m[2] : titre), motif = MOTIF_FAM[p.p] || 'anneau';
    for (var k = 0; k < MOTIF_MOT.length; k++) if (MOTIF_MOT[k][0].test(titre)) { motif = MOTIF_MOT[k][1]; break; }
    var fmt = FORMATS[cur.f];
    return { lignes: V2.mktSocle.plier(texte, texte.length > 60 ? 24 : 20), surtitre: m ? m[1] : pl.label, famille: m ? pl.label : '',
      motif: motif, pale: p.n % 3 === 0, graine: p.n, alt: 'Visuel du post : ' + titre,
      media: e.image_path ? urlImage(e.image_path) : '', genre: genreFichier(e.image_path), fichier: nomFichier(e.image_path),
      etiquette: fmt ? fmt[0] : '', etiquetteIc: fmt ? fmt[1] : '' };
  }
  function couvDe(p, e, sansMedia) {
    if (!(V2.mktSocle && V2.mktSocle.couverture)) return '';
    var o = infoCouv(p, e);
    if (sansMedia) { o.media = ''; o.etiquette = ''; }
    return V2.mktSocle.couverture(o);
  }
  function personneHtml(k) {
    return '<span class="mk-qui" role="img" aria-label="' + esc(quiLabel(k)) + ' s’en occupe" title="' + esc(quiLabel(k)) + '">' +
      '<span class="mk-pp mk-pp-' + (k === 'pauline' ? 'p' : 'w') + '">' + esc(quiLabel(k).charAt(0)) + '</span></span>';
  }
  // La pastille de personne ne s'affiche que si le post est attribué ; sinon « Je m'en occupe » reste à portée, comme avant.
  function quiHtml(p, e) {
    if (e.resp) return personneHtml(e.resp);
    if (moi !== 'both') return '<button type="button" class="lpo-claim mk-press" onclick="event.stopPropagation();V2.lip.quiFait(' + p.n + ',\'' + moi + '\')">Je m’en occupe</button>';
    return '<span class="lpo-picks">' + QUI.map(function (q) {
      return '<button type="button" class="lpo-pick mk-press" aria-label="' + esc(q.label) + ' s’en occupe" title="' + esc(q.label) + ' s’en occupe" onclick="event.stopPropagation();V2.lip.quiFait(' + p.n + ',\'' + q.k + '\')"><span>' + esc(q.label.charAt(0)) + '</span></button>';
    }).join('') + '</span>';
  }
  function heureFr(h) { return String(h || '').replace(':', ' h '); }

  function carte(p) {
    var e = etat(p.n), pl = pilier(p.p);
    var S = sujetsDe(p), cur = S[sujetEff(p, e)] || S[0];
    var quand = dateCourte(new Date(p.d + 'T12:00:00'));
    var pied = quiHtml(p, e);
    var stat = e.publie ? '<span class="lpo-stat" title="Publié">' + icS('coche', 16, 2.5) + '</span>'
      : ((e.statut === 'refuse' || e.statut === 'retravailler') ? '<span class="lpo-stat">' + esc(statut(e.statut).label) + '</span>' : '');
    var ici = ouvert && ouvert.n === p.n;   // la carte d'origine reste marquée tant que son volet est ouvert
    return '<article class="lpo-carte mk-souleve mk-lever' + (e.statut === 'refuse' && !e.publie ? ' ecarte' : '') + (ici ? ' mk-marque' : '') + '" tabindex="0" role="button" data-n="' + p.n + '" data-mk-id="P' + p.n + '" aria-label="Ouvrir le post du ' + esc(quand) + '" ' +
      'onclick="V2.lip.ouvrir(' + p.n + ')" onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();V2.lip.ouvrir(' + p.n + ')}">' +
      '<span class="lpo-vig">' + couvDe(p, e) + '</span>' +
      '<div class="lpo-corps"><div class="lpo-haut"><span class="lpo-date">' + esc(quand + ' · ' + heureFr(p.h)) + '</span>' + stat + '</div>' +
        '<p class="lpo-titre">' + esc(cur.titre) + '</p></div>' +
      '<div class="lpo-pied"><span class="lpo-fam" title="' + esc(pl.label) + '"><i style="background:' + pl.color + '"></i>' + esc(pl.label) + '</span>' + pied + '</div>' +
      (ici ? '<i class="mk-anneau"></i>' : '') + '</article>';
  }

  // Attente du fichier du plan : la forme des cartes à venir (geste 11), pas une phrase seule.
  function attenteHtml() {
    var sq = '<div class="mk-souleve" style="padding:8px"><div class="mk-sq" style="aspect-ratio:1200/628;border-radius:12px"></div>' +
      '<div class="mk-sq" style="height:14px;width:45%;border-radius:7px;margin:16px 8px 8px"></div><div class="mk-sq" style="height:18px;width:85%;border-radius:9px;margin:0 8px 16px"></div></div>';
    return '<div class="lpo-tete"><div><h1 class="lpo-h1">Posts LinkedIn</h1><p class="lpo-phrase">Chargement du rétro-planning…</p></div></div>' +
      '<div class="lpo-board lpo-attente" style="grid-template-columns:repeat(auto-fill,minmax(248px,1fr))" aria-hidden="true">' + sq + sq + sq + '</div>';
  }

  // États, DA et sujets B / C : lancés une fois, par l'écran des posts comme par l'accueil « Cette semaine » (lot 4).
  var etatsLus = false;
  function lancerChargements() {
    if (charge) return;
    charge = true;
    chargerEtats().then(function () { etatsLus = true; redessine(); });
    // la DA alimente l'encart « prompt » de chaque fiche : on la charge d'emblée
    charger('mkt-li-da-data.js', da).then(function (ok) { if (ok) redessine(); });
    // les 2 sujets supplémentaires par créneau : fichier lourd, chargé à côté,
    // sans bloquer l'affichage. Tant qu'il n'est pas là, un seul sujet.
    charger('mkt-li-plan-alt-data.js', alts).then(function (ok) {
      if (ok) { redessine(); if (ouvert) redessineTiroir(); }
    });
  }

  var dernMoi = -1, dernEtape = '';   // points de départ des indicateurs qui glissent (geste 10)
  function renderPlan(root) {
    if (!plan()) {
      root.innerHTML = coquille(attenteHtml());
      charger('mkt-li-plan-data.js', plan).then(function (ok) {
        if (V2.route && V2.route.name !== 'marketing') return;   // 11/09/2026 : l'écran a pu changer pendant l'attente
        if (!ok) { root.innerHTML = coquille('<div class="lip-empty">Le fichier du rétro-planning n\'a pas pu être chargé.</div>'); return; }
        redessine();
      });
      return;
    }
    lancerChargements();
    // Les posts du plan et les posts libres dans les mêmes colonnes, triés par
    // date. Un post reste un post, quelle que soit son origine.
    chargerLibres();
    var P = plan(), cette = lundiDe(isoJour(new Date()));
    var finD = new Date(cette + 'T12:00:00'); finD.setDate(finD.getDate() + nbSem * 7 - 1);
    var fin = isoJour(finD), dernier = P[P.length - 1].d;
    function dansFenetre(iso) { iso = String(iso).slice(0, 10); return (voirPasse || iso >= cette) && iso <= fin; }
    var col = { choisir: [], pret: [], publie: [] }, ecartes = 0, passes = 0;
    P.filter(visible).forEach(function (p) {
      if (p.d < cette) passes++;
      if (!dansFenetre(p.d)) return;
      var e = etat(p.n), s = etapeDe(e);
      if (e.statut === 'refuse' && !e.publie) { ecartes++; if (!voirEcartes) return; }
      if (moi !== 'both' && s !== 'publie' && e.resp && e.resp !== moi) return;
      col[s].push({ cle: p.d + 'T' + p.h, html: carte(p) });
    });
    libres().forEach(function (x) {
      if (dansFenetre(x.date)) col[etapeLibre(x)].push({ cle: String(x.date).slice(0, 16), html: carteLibre(x) });
    });
    var dejaLa = !!root.querySelector('.lpo-board:not(.lpo-attente)');   // re-rendu du même écran : pas de cascade
    var nomMoi = quiLabel(moi);
    var parts = [];
    if (col.choisir.length) parts.push('<b>' + col.choisir.length + '</b> post' + (col.choisir.length > 1 ? 's' : '') + ' à préparer');
    if (col.pret.length) parts.push('<b>' + col.pret.length + '</b> à publier');
    // La phrase-compteur : une ligne discrète. Au téléphone les chiffres sont déjà dans les trois étapes, juste dessous.
    var phrase = '<span class="lpo-nb">' + (parts.length ? parts.join(', ') + '. ' : (nomMoi ? 'Rien n’attend ' + esc(nomMoi) + ' pour l’instant. ' : 'Rien à faire pour l’instant. ')) + '</span>' +
      'Les ' + nbSem + ' prochaines semaines' + (nomMoi ? ', pour ' + esc(nomMoi) : ', à deux') + ' · 1 à ' + MAX_SEM + ' posts par semaine, pas plus.';
    var MOI = [['pauline', 'Pauline'], ['will', 'Will'], ['both', 'Nous deux']];
    var im = moi === 'pauline' ? 0 : (moi === 'will' ? 1 : 2), ie = 0;
    for (var z = 0; z < ETAPES.length; z++) if (ETAPES[z].k === etape) ie = z;
    var ieAvant = ie; for (z = 0; z < ETAPES.length; z++) if (ETAPES[z].k === dernEtape) ieAvant = z;
    var tete = '<div class="lpo-tete"><div><h1 class="lpo-h1">Posts LinkedIn</h1><p class="lpo-phrase">' + phrase + '</p>' +
      (backend === 'local' ? '<p class="lpo-local">' + ICO('alert', 16, 2) + '<span>Vos choix sont gardés sur cet appareil ; ils ne sont pas encore partagés avec l’équipe.</span></p>' : '') + '</div>' +
      '<div class="mk-seg lpo-moi" role="group" aria-label="Choisir qui vous êtes" data-lpo-seg="' + im + '" style="--n:3;--i:' + (dernMoi < 0 ? im : dernMoi) + '"><i class="mk-seg-ind"></i>' +
      MOI.map(function (q) {
        return '<button type="button" class="mk-press" aria-pressed="' + (moi === q[0]) + '" onclick="V2.lip.setMoi(\'' + q[0] + '\')">' + esc(q[1]) + '</button>';
      }).join('') + '</div></div>';
    var onglets = '<div class="mk-seg lpo-etapes" role="tablist" aria-label="Étape" data-lpo-seg="' + ie + '" style="--n:3;--i:' + ieAvant + '"><i class="mk-seg-ind"></i>' + ETAPES.map(function (s) {
      return '<button type="button" class="mk-press" role="tab" data-etape="' + s.k + '" aria-selected="' + (etape === s.k) + '" onclick="V2.lip.setEtape(\'' + s.k + '\')"><span>' + esc(s.court) + '</span><b>' + col[s.k].length + '</b></button>';
    }).join('') + '</div>';
    // Une colonne vide se rétracte : elle ne garde pas un tiers de l'écran.
    var plein = ETAPES.filter(function (s) { return col[s.k].length; }).length;
    var gabarit = ETAPES.map(function (s) {
      if (!plein) return 'minmax(0,1fr)';
      return col[s.k].length ? (s.k === 'choisir' ? 'minmax(0,2fr)' : 'minmax(0,1fr)') : '168px';
    }).join(' ');
    var tableau = '<div class="lpo-board" style="grid-template-columns:' + gabarit + '">' + ETAPES.map(function (s) {
      var L = col[s.k].sort(function (a, b) { return a.cle < b.cle ? -1 : (a.cle > b.cle ? 1 : 0); });
      if (s.k === 'publie') L.reverse();   // le plus récent en tête
      var arrive = (etape === s.k && dernEtape && dernEtape !== etape) ? ' arrive' : '';
      return '<section class="lpo-col ' + s.k + (etape === s.k ? ' active' : '') + arrive + '" data-etape="' + s.k + '" aria-label="' + esc(s.label) + '" style="--sens:' + (ie >= ieAvant ? 1 : -1) + '">' +
        '<div class="lpo-colt"><b>' + L.length + '</b><span class="lpo-cap">' + esc(s.label) + '</span></div>' +
        (L.length ? '<div class="lpo-pile">' + L.map(function (x) { return x.html; }).join('') + '</div>'
          : '<div class="lpo-vide"><div class="lpo-silh" aria-hidden="true"><i></i><i></i><i style="width:60%"></i></div>' + esc(s.vide) + '</div>') + '</section>';
    }).join('') + '</div>';
    var bouton = function (act, txt, icone) { return '<button type="button" class="mk-btn mk-press" onclick="' + act + '">' + (icone || '') + txt + '</button>'; };
    var suite = '<div class="lpo-suite">' +
      (fin < dernier ? bouton('V2.lip.plusSemaines()', 'Voir les semaines suivantes') : '') +
      (passes ? bouton('V2.lip.togglePasse()', voirPasse ? 'Masquer les semaines passées' : 'Voir les semaines passées') : '') +
      (ecartes ? bouton('V2.lip.toggleEcartes()', voirEcartes ? 'Masquer les posts écartés' : 'Revoir ' + (ecartes > 1 ? 'les ' + ecartes + ' posts écartés' : 'le post écarté')) : '') +
      bouton('V2.lip.nouveauLibre()', 'Nouveau post libre', icS('plus', 18, 2)) +
      bouton('V2.lip.voirDA()', 'Notre DA image') +
      bouton('V2.lip.exportCsv()', 'Export CSV', icS('charger', 18)) +
      bouton('V2.li.setView(\'veille\')', 'Veille secteur', icS('veille', 18)) + '</div>';
    var regle = '<div class="lpo-regle"><span class="lpo-cap">Notre ligne : un acteur de santé bienveillant</span><div class="lpo-regle-g">' +
      '<div class="lpo-pose"><b>Oui —</b> ' + esc(REGLE_OUI) + '</div><div class="lpo-pose"><b>Non —</b> ' + esc(REGLE_NON) + '</div></div></div>';
    root.innerHTML = coquille(tete + onglets + tableau + suite + regle);
    dernMoi = im; dernEtape = etape;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () {   // les indicateurs glissent de leur ancienne place vers la nouvelle
      var segs = root.querySelectorAll('[data-lpo-seg]');
      for (var i = 0; i < segs.length; i++) segs[i].style.setProperty('--i', segs[i].getAttribute('data-lpo-seg'));
    });
    if (!dejaLa && V2.mktSocle && V2.mktSocle.cascade) V2.mktSocle.cascade(root.querySelectorAll('.lpo-carte'));
  }


  function coquille(corps) {
    var barre = V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '';
    // Lot 3 : l'écran des posts porte son propre en-tête, dans les jetons de l'espace Marketing. La veille garde le sien.
    if (vue !== 'veille') return barre + '<div class="lip lpo mk-espace">' + corps + '</div>';
    // Lot 6 : la veille entre dans les jetons de l'espace. Le retour aux posts = l'onglet « Posts » de la barre, toujours visible.
    var v = V();
    var releve = v ? ' Relevé le ' + v.captureUTC.slice(8, 10) + '/' + v.captureUTC.slice(5, 7) + '/' + v.captureUTC.slice(0, 4) + '.' : '';
    return barre +
      '<div class="lip lpv mk-espace">' +
        '<header class="lpv-entete"><h1>Veille secteur</h1>' +
        '<p>' + esc('Ce que publient CERP, OCP, Sagitta Pharma et nous : ' + ((v && v.nbPosts) || '—') + ' posts sur 12 mois, réactions et commentaires compris.' + releve) + '</p></header>' +
        corps +
      '</div>';
  }

  /* ───────────────── le volet d'un post (lot 3) ─────────────────
     La carte devient le volet : trajet animé en transform / opacity depuis la place de la carte
     (pas de transition de vue : image double sous WebKit, prouvé au lot 2). Deux panneaux à 1280 —
     l'aperçu du post comme sur LinkedIn, puis les réglages ; à 390, une feuille plein écran. */
  var ouvert = null;   // {n, p, e, envoi, erreurMedia, note, deplie, replis}
  var partis = {};     // posts dont le texte est parti vers LinkedIn pendant cette session : le bouton plein passe à « Marquer comme publié »
  var tour = 0;        // une fermeture en cours ne vide pas un volet rouvert entre-temps
  function socle() { return V2.mktSocle || {}; }
  function calme() { var S = socle(); return S.calme ? S.calme() : true; }
  function signalerEnregistre() { var S = socle(); if (S.enregistre) S.enregistre(); }

  function hote() {
    var h = document.getElementById('lip-drawer');
    if (!h) { h = document.createElement('div'); h.id = 'lip-drawer'; document.body.appendChild(h); }
    return h;
  }
  // « Notre DA image » : son propre hôte, au-dessus du volet, pour ne plus le remplacer.
  function monterDA(html) {
    var h = document.getElementById('lip-da');
    if (!h) { h = document.createElement('div'); h.id = 'lip-da'; document.body.appendChild(h); }
    h.innerHTML = html;
    void h.offsetWidth;
    var d = h.querySelector('.lip-dr'), s = h.querySelector('.lip-scrim');
    if (s) s.className += ' open'; if (d) d.className += ' open';
  }
  function daOuverte() { var h = document.getElementById('lip-da'); return !!(h && h.firstChild); }
  function fermerDA() {
    var h = document.getElementById('lip-da'); if (!h) return;
    var d = h.querySelector('.lip-dr'), s = h.querySelector('.lip-scrim');
    if (d) d.className = d.className.replace(' open', '');
    if (s) s.className = s.className.replace(' open', '');
    setTimeout(function () { h.innerHTML = ''; }, 340);
  }

  function carteDe(n) { return document.querySelector('#v2-root .lpo-carte[data-n="' + n + '"]') || document.querySelector('#v2-root [data-lpo-n="' + n + '"]'); }
  // Le bouton plein : celui du volet s'il est ouvert, sinon celui de l'accueil « Cette semaine ».
  function principal() { return document.querySelector('#lip-drawer #lpo-principal') || document.getElementById('mks-principal'); }
  function visibleAEcran(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function figerFond(oui) {
    try {
      document.body.style.overflow = oui ? 'hidden' : '';
      var r = document.getElementById('v2-root'); if (r) { if (oui) r.setAttribute('inert', ''); else r.removeAttribute('inert'); }
    } catch (e) {}
  }

  function peindreVolet() {
    var h = hote(), v = h.querySelector('.lpo-volet'), neuf = !v;
    if (neuf) {
      h.innerHTML = '<div class="mk-espace"><div class="lpo-voile" onclick="V2.lip.fermer()"></div>' +
        '<aside class="lpo-volet" role="dialog" aria-modal="true" tabindex="-1"></aside></div>';
      v = h.querySelector('.lpo-volet');
    }
    v.setAttribute('aria-label', 'Post du ' + quandLong(ouvert.p));
    v.innerHTML = voletHtml();
    ajusterTexte();
    return neuf;
  }
  // Geste 4 — le volet part de la place de la carte et grandit ; son contenu arrive en fondu ; le voile en 200 ms.
  function ouvrirVolet(source) {
    tour++;
    peindreVolet();
    ecouterVolet();
    figerFond(true);
    var h = hote(), v = h.querySelector('.lpo-volet'), voile = h.querySelector('.lpo-voile'), S = socle();
    void h.offsetWidth;
    if (voile) voile.classList.add('la');
    if (source && S.marquer) S.marquer(source, 0);
    if (!calme() && S.animer && visibleAEcran(source)) {
      var a = source.getBoundingClientRect(), b = v.getBoundingClientRect();
      // la coque est opaque dès le premier quart du trajet (une carte blanche qui grandit, pas un voile) ; son contenu n'arrive qu'ensuite
      S.animer(v, [{ transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ',' + (a.height / b.height) + ')', opacity: 0 },
        { opacity: 1, offset: .25 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)' });
      S.animer(v.querySelector('.lpo-dedans'), [{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 320, easing: 'linear' });
    }
    var x = v.querySelector('.lpo-x'); if (x) { try { x.focus({ preventScroll: true }); } catch (e) { try { x.focus(); } catch (e2) {} } }
  }
  // Geste 5 — même chemin à l'envers, 220 ms ; à l'arrivée l'anneau de la carte s'éteint en 400 ms.
  // `apres` : le post change d'étape — le volet s'efface sur place, et c'est la carte qui voyage ensuite.
  function fermer(apres) {
    if (typeof apres !== 'function') apres = null;
    var n = ouvert ? ouvert.n : null, moment = ++tour;
    if (ouvert && ouvert.envoi && ouvert.envoi.url) { try { URL.revokeObjectURL(ouvert.envoi.url); } catch (e) {} }
    ouvert = null;
    figerFond(false);
    var h = document.getElementById('lip-drawer'), v = h && h.querySelector('.lpo-volet'), voile = h && h.querySelector('.lpo-voile');
    var carte = n === null ? null : carteDe(n), fini = false;
    var fin = function () {
      if (fini) return; fini = true;
      if (moment === tour && h) h.innerHTML = '';
      var M = document.querySelectorAll('#v2-root .lpo-carte.mk-marque');
      for (var i = 0; i < M.length; i++) M[i].classList.remove('mk-marque');
      if (carte && !apres) { try { carte.focus({ preventScroll: true }); } catch (e) {} }
      if (apres) apres();
    };
    if (!v) { fin(); return; }
    if (voile) voile.classList.remove('la');
    var S = socle();
    if (calme() || !S.animer) { fin(); return; }
    var images;
    if (!apres && visibleAEcran(carte)) {
      var a = carte.getBoundingClientRect(), b = v.getBoundingClientRect();
      images = [{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .55 },
        { transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ',' + (a.height / b.height) + ')', opacity: 0 }];
      S.animer(v.querySelector('.lpo-dedans'), [{ opacity: 1 }, { opacity: 0, offset: .4 }, { opacity: 0 }], { duration: 220, easing: 'linear', fill: 'forwards' });
    } else {
      images = [{ transform: 'none', opacity: 1 }, { transform: S.tel && S.tel() ? 'translateY(48px)' : 'translateX(32px)', opacity: 0 }];
    }
    var an = S.animer(v, images, { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });   // départ doux : on VOIT le volet rentrer dans sa carte
    if (an) an.onfinish = fin;
    setTimeout(fin, 300);
  }

  // Lot 4 — contexte « muet » : l'accueil « Cette semaine » joue les actions du volet (V2.lip.agir) sans l'ouvrir.
  // Ce contexte n'a pas d'écran : ni Échap ni glisser de fichiers ne le concernent, et il se relâche dès l'action finie.
  function voletLa() { return !!(ouvert && !ouvert.muet); }
  function lacher() { if (ouvert && ouvert.muet) ouvert = null; }

  var ecoute = false;
  function ecouterVolet() {
    if (ecoute) return; ecoute = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !voletLa()) return;
      var z = document.getElementById('li-zoom');
      if (z && z.firstChild) return;                 // le visuel agrandi se referme d'abord, par son propre écouteur
      if (daOuverte()) { fermerDA(); return; }
      fermer();
    });
    // Geste 8 — pendant un glisser de fichiers, toute la scène devient la cible.
    var fichiers = function (e) {
      var t = e.dataTransfer && e.dataTransfer.types; if (!t) return false;
      for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
      return false;
    };
    var scene = function () { return document.querySelector('#lip-drawer .lpo-scene'); };
    document.addEventListener('dragover', function (e) { if (!voletLa() || !fichiers(e)) return; e.preventDefault(); var s = scene(); if (s) s.classList.add('survol'); });
    document.addEventListener('dragleave', function (e) { if (!voletLa() || e.relatedTarget) return; var s = scene(); if (s) s.classList.remove('survol'); });
    document.addEventListener('drop', function (e) {
      if (!voletLa() || !fichiers(e)) return;
      e.preventDefault();
      var s = scene(); if (s) s.classList.remove('survol');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) envoyerFichier(f);
    });
    window.addEventListener('hashchange', function () {
      if (ouvert && !surEcran()) { fermerDA(); fermer(); }
    });
  }

  function redessineTiroir() {
    if (!ouvert) return;
    var sel = ['.lpo-scene', '.lpo-regl', '.lpo-vc'], y = [], i, el;
    for (i = 0; i < sel.length; i++) { el = document.querySelector('#lip-drawer ' + sel[i]); y.push(el ? el.scrollTop : 0); }
    var actif = document.activeElement, surTexte = actif && actif.id === 'lpo-texte', pos = surTexte ? actif.selectionStart : 0;
    peindreVolet();
    for (i = 0; i < sel.length; i++) { el = document.querySelector('#lip-drawer ' + sel[i]); if (el) el.scrollTop = y[i]; }
    if (surTexte) { var t = document.getElementById('lpo-texte'); if (t) { try { t.focus({ preventScroll: true }); t.setSelectionRange(pos, pos); } catch (e) {} } }
  }

  // La version du texte affichée : celle choisie, sinon « Humain », sinon la première.
  var TONS = [['humain', 'Humain'], ['peda', 'Pédagogique'], ['court', 'Court']];
  function varEff(cur, e) {
    if (e.variante !== null && e.variante !== undefined && cur.t[e.variante]) return e.variante;
    for (var i = 0; i < cur.t.length; i++) if (cur.t[i].ton === 'humain') return i;
    return 0;
  }

  // Le texte du post : celui retouché à la main s'il porte sur ce sujet et cette
  // version, sinon la proposition d'origine.
  function texteDe(p, e) {
    var cur = sujetDe(p, sujetEff(p, e)), vi = varEff(cur, e);
    if (e.texte && e.texteCle === sujetEff(p, e) + '.' + vi) return e.texte;
    return cur.t[vi] ? cur.t[vi].txt : '';
  }
  function quandLong(p) {
    var d = new Date(p.d + 'T12:00:00');
    return JOURS[(d.getDay() + 6) % 7] + ' ' + jj(d.getDate()) + ' ' + MOIS[d.getMonth()] + ' · ' + heureFr(p.h);
  }
  function ajusterTexte() {
    var t = document.getElementById('lpo-texte'); if (!t) return;
    t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px';
  }

  /* Où en est ce post, pour choisir LE bouton plein du volet :
     retenir → (mettre à jour) → copier et ouvrir LinkedIn → marquer comme publié → publié. */
  function etapeVolet() {
    var e = ouvert.e, garde = etat(ouvert.n);
    if (garde.publie) return 'publie';
    var si = sujetEff(ouvert.p, e), vi = varEff(sujetOuvert(), e);
    var deja = garde.statut === 'valide' && (garde.sujet || 0) === si && garde.variante === vi && texteDe(ouvert.p, garde) === texteDe(ouvert.p, e);
    if (!deja) return garde.statut === 'valide' ? 'maj' : 'retenir';
    return partis[ouvert.n] ? 'marquer' : 'linkedin';
  }
  function piedHtml() {
    var S = socle(), et = etapeVolet(), garde = etat(ouvert.n);
    var save = function (a, b) { return S.saveHtml ? S.saveHtml(a, b) : a; };
    var plein = function (act, avant, apres) {
      return '<button type="button" class="mk-btn mk-plein mk-grand mk-press mk-save" id="lpo-principal" onclick="' + act + '">' + save(avant, apres) + '</button>';
    };
    var principal = et === 'publie' ? '<span class="lpo-publie">' + icS('coche', 20, 2.5) + 'Publié</span>'
      : et === 'linkedin' ? plein('V2.lip.publier()', icS('ext', 18) + 'Copier et ouvrir LinkedIn', 'Texte copié')
      : et === 'marquer' ? plein('V2.lip.marquerPublie(true)', 'Marquer comme publié', 'C’est publié')
      : plein('V2.lip.retenir()', et === 'maj' ? 'Mettre à jour le texte retenu' : 'Retenir ce texte', 'C’est retenu');
    var texte = function (act, html, plus) { return '<button type="button" class="mk-btn mk-texte mk-press' + (plus || '') + '" onclick="' + act + '">' + html + '</button>'; };
    return (et === 'publie' ? texte('V2.lip.marquerPublie(false)', 'Annuler « publié »')
        : (garde.statut === 'refuse' ? texte('V2.lip.ecarter(false)', 'Remettre dans la liste') : texte('V2.lip.ecarter(true)', 'Pas cette semaine'))) +
      '<button type="button" class="mk-btn mk-texte mk-press mk-save" data-lpo-copier onclick="V2.lip.copier()">' + save(icS('copie', 18) + 'Copier le texte', 'Copié') + '</button>' +
      (et !== 'linkedin' ? texte('V2.lip.publier()', icS('ext', 18) + 'Ouvrir LinkedIn', ' lpo-sec2') : '') +
      (et !== 'marquer' && et !== 'publie' ? texte('V2.lip.marquerPublie(true)', 'Marquer comme publié', ' lpo-sec2') : '') +
      '<span class="lpo-pousse"></span>' + principal;
  }
  // À 390, le pied ne garde que deux actions à côté du bouton plein : les autres restent visibles ici, dans le corps du volet.
  function autresHtml() {
    var et = etapeVolet(), h = '';
    if (et !== 'linkedin') h += '<button type="button" class="mk-btn mk-press" onclick="V2.lip.publier()">' + icS('ext', 18) + 'Ouvrir LinkedIn</button>';
    if (et !== 'marquer' && et !== 'publie') h += '<button type="button" class="mk-btn mk-press" onclick="V2.lip.marquerPublie(true)">Marquer comme publié</button>';
    return h;
  }
  function peindrePied() {
    var a = document.querySelector('#lip-drawer .lpo-vp'), b = document.querySelector('#lip-drawer .lpo-autres');
    if (a) a.innerHTML = piedHtml();
    if (b) b.innerHTML = autresHtml();
  }
  function aideHtml() {
    var p = ouvert.p, e = ouvert.e, cur = sujetOuvert(), vi = varEff(cur, e);
    var retouche = texteDe(p, e) !== (cur.t[vi] ? cur.t[vi].txt : '');
    if (ouvert.erreurMedia) return '<span class="lpo-erreur" style="margin:0" aria-hidden="true">' + ICO('alert', 16, 2) + '<span>' + esc(ouvert.erreurMedia) + '</span></span>';
    return '<span>' + esc(ouvert.note || (retouche ? 'Texte modifié, gardé quand vous le retenez.' : 'Écrivez directement dans le post.')) + '</span>' +
      (retouche ? '<button type="button" class="mk-btn mk-texte mk-press" onclick="V2.lip.texteOrigine()">Revenir au texte proposé</button>' : '');
  }

  // Le visuel dans l'aperçu : le fichier importé, celui en cours d'envoi (avec sa progression), sinon la couverture typographique.
  function visuelHtml() {
    var p = ouvert.p, e = ouvert.e, env = ouvert.envoi;
    if (env) {
      var corps = env.url && env.genre === 'image' ? '<img class="lpo-vimg mk-naissance" src="' + esc(env.url) + '" alt="">'
        : env.url && env.genre === 'video' ? '<video class="mk-naissance" src="' + esc(env.url) + '" muted playsinline preload="metadata"></video>'
        : '<div class="mk-naissance">' + couvDe(p, e, true) + '</div>';
      return corps + '<div class="lpo-envoi" role="status"><span>Envoi de « ' + esc(env.nom) + ' » en cours…</span>' +
        '<i class="mk-prog" id="lpo-prog" style="--p:' + env.p + '"></i><i class="lpo-envoi-fond"></i></div>';
    }
    if (!e.image_path) return couvDe(p, e, true);
    var u = esc(urlImage(e.image_path)), g = genreFichier(e.image_path);
    if (g === 'video') return '<video src="' + u + '" controls playsinline preload="metadata"></video>';
    if (g === 'doc') return couvDe(p, e);
    // Si l'image ne se charge pas, la couverture typographique, posée dessous, reprend la place.
    return '<div style="position:relative">' + couvDe(p, e, true) +
      '<button type="button" class="lpo-vzoom" style="position:absolute;top:0;left:0;height:100%" aria-label="Voir le visuel en grand" onclick="V2.lip.zoomTiroir()">' +
      '<img class="lpo-vimg" style="height:100%" src="' + u + '" alt="Visuel du post" onerror="this.parentNode.remove()"></button></div>';
  }
  function mediaHtml() {
    var e = ouvert.e, env = ouvert.envoi;
    var err = ouvert.erreurMedia ? '<p class="lpo-erreur" role="alert">' + ICO('alert', 16, 2) + '<span>' + esc(ouvert.erreurMedia) + '</span></p>' : '';
    var champ = '<input type="file" class="lpo-fichier" id="lpo-fichier" tabindex="-1" aria-hidden="true" accept="' + ACCEPTE + '" onchange="V2.lip.envoyerImage(this)">';
    if (env) return '<div class="lpo-media"><div class="lpo-mv">' + couvDe(ouvert.p, e, true) + '</div><div><strong>' + esc(env.nom) + '</strong><span>Envoi en cours…</span></div></div>';
    if (!e.image_path) return champ + '<button type="button" class="mk-btn mk-press lpo-bloc" onclick="V2.lip.choisirFichier()">' + icS('importer', 18) + 'Importer un fichier</button>' +
      '<p class="lpo-t5">Image (25 Mo), vidéo MP4 ou MOV, document PDF (50 Mo). Le fichier est partagé avec l’équipe dès l’envoi. Vous pouvez aussi le glisser sur l’aperçu.</p>' + err;
    var g = genreFichier(e.image_path), u = esc(urlImage(e.image_path));
    return champ + '<div class="lpo-media"><div class="lpo-mv">' + couvDe(ouvert.p, e) + '<span class="lpo-ok">' + icS('coche', 12, 3) + '</span></div>' +
      '<div><strong>' + esc(nomFichier(e.image_path)) + '</strong><span>' + (g === 'video' ? 'Vidéo' : g === 'doc' ? 'Document PDF' : 'Image') + ' · partagé avec l’équipe</span></div></div>' +
      '<div class="lpo-mact"><button type="button" class="mk-btn mk-texte mk-press" onclick="V2.lip.choisirFichier()">Changer</button>' +
      (g === 'image' ? '<button type="button" class="mk-btn mk-texte mk-press" onclick="V2.lip.zoomTiroir()">Voir en grand</button>'
        : '<a class="mk-btn mk-texte mk-press" href="' + u + '" target="_blank" rel="noopener">Ouvrir</a>') +
      '<button type="button" class="mk-btn mk-texte mk-press lpo-rose" onclick="V2.lip.retirerImage()">Retirer</button></div>' + err;
  }
  // L'aperçu du post, comme sur LinkedIn. Un seul composant : le volet y met le texte modifiable et le visuel
  // en cours ; l'accueil « Cette semaine » (lot 4) y met le texte en lecture et la couverture.
  function apercuHtml(p, texteH, visuelH, attrs) {
    return '<div class="lpo-li mk-souleve"' + (attrs || '') + '>' +
      '<div class="lpo-lt"><span class="lpo-logo" aria-hidden="true">IP</span><div><strong>Intégral Pharma</strong><span>Groupe de grossistes-répartiteurs</span>' +
        '<span>' + esc(dateCourte(new Date(p.d + 'T12:00:00')) + ' · ' + heureFr(p.h)) + '</span></div></div>' +
      texteH + visuelH +
      '<div class="lpo-lact" aria-hidden="true"><span>' + icS('aime', 18) + 'J’aime</span><span>' + icS('commente', 18) + '</span><span>' + icS('republie', 18) + '</span><span>' + icS('envoie', 18) + '</span></div>' +
    '</div>';
  }
  function repliHtml(cle, titre, corps) {
    return '<section><details class="lpo-repli"' + (ouvert.replis[cle] ? ' open' : '') + ' ontoggle="V2.lip.plusOuvert(this.open,\'' + cle + '\')"><summary>' + titre + icS('bas', 20, 2) + '</summary>' + corps + '</details></section>';
  }

  function voletHtml() {
    var p = ouvert.p, e = ouvert.e, pl = pilier(p.p), S0 = socle();
    // Le créneau donne la date et le pilier ; le sujet retenu donne tout le reste.
    var S = sujetsDe(p), si = sujetEff(p, e), cur = S[si] || S[0];
    var vi = varEff(cur, e), garde = etat(ouvert.n), et = etapeDe(garde);
    var nomEtape = ''; ETAPES.forEach(function (x) { if (x.k === et) nomEtape = x.label; });
    if (garde.statut === 'refuse' && !garde.publie) nomEtape = 'Écarté';

    var sujets = S.map(function (c, i) {
      if (!sujetPermis(p, i)) return '';   // trop « métier » : voir SUJETS_METIER
      return '<button type="button" class="lpo-sujet mk-press" aria-pressed="' + (si === i) + '" onclick="V2.lip.setChamp(\'sujet\',' + i + ')">' +
        '<i>' + String.fromCharCode(65 + i) + '</i><strong>' + esc(c.titre) + '</strong></button>';
    }).join('');

    var tons = [], it = 0;
    TONS.forEach(function (t) {
      for (var i = 0; i < cur.t.length; i++) if (cur.t[i].ton === t[0]) { if (vi === i) it = tons.length; tons.push('<button type="button" class="mk-press" aria-pressed="' + (vi === i) + '" onclick="V2.lip.setChamp(\'variante\',' + i + ')">' + t[1] + '</button>'); break; }
    });
    var iq = e.resp === 'pauline' ? 0 : (e.resp === 'will' ? 1 : -1);

    var iv = (e.visuel === null || e.visuel === undefined) ? 0 : e.visuel;
    var idees = cur.v.map(function (v, i) {
      return '<button type="button" class="lpo-sujet lpo-idee mk-press" aria-pressed="' + (e.visuel === i) + '" onclick="V2.lip.setChamp(\'visuel\',' + i + ')"><i>' + (i + 1) + '</i><strong>' + esc(v) + '</strong></button>';
    }).join('');
    var prompt = (function () {
      var d = da();
      if (!d) return '<p class="lpo-t5">Chargement de la direction artistique…</p>';
      var k = apprCourante(), a = approcheDe(k), ia = 0;
      var onglets = d.approches.map(function (x, i) {
        if (x.k === k) ia = i;
        return '<button type="button" class="mk-press" aria-pressed="' + (x.k === k) + '" onclick="V2.lip.setApproche(\'' + x.k + '\')">' + esc(x.label) + '</button>';
      }).join('');
      var mots = motsAPoser((cur.v && cur.v[iv]) || '');
      return '<div class="mk-seg lpo-appr" role="group" aria-label="Approche" style="--n:' + d.approches.length + ';--i:' + ia + '"><i class="mk-seg-ind"></i>' + onglets + '</div>' +
        '<p class="lpo-t5" style="margin:0 0 8px">' + esc(a.aide) + '</p>' +
        '<div class="lpo-prompt" tabindex="0">' + esc(promptPour(cur, iv, k)) + '</div>' +
        '<div class="lpo-rang"><button type="button" class="mk-btn mk-press mk-save" id="lpo-copier-prompt" onclick="V2.lip.copierPrompt()">' +
          (S0.saveHtml ? S0.saveHtml(icS('copie', 18) + 'Copier ce prompt', 'Copié') : 'Copier ce prompt') + '</button>' +
          '<button type="button" class="mk-btn mk-press" onclick="V2.lip.voirDA()">Notre DA image</button></div>' +
        (mots.length ? '<div class="lpo-note"><b>Texte à poser ensuite</b>, dans Canva ou équivalent — il n’est volontairement dans aucun des trois prompts :<br>' +
          mots.map(function (x) { return '« ' + esc(x) + ' »'; }).join('<br>') + '</div>' : '') +
        '<p class="lpo-t5">Les trois restent dans notre direction artistique : même fond crème, mêmes couleurs, même format. ' +
          'Aucun ne fait écrire de texte par le générateur — les accents français sont ratés, la phrase se pose après.</p>';
    })();

    return '<div class="lpo-dedans"><i class="lpo-poignee" aria-hidden="true"></i>' +
      '<div class="lpo-vt"><div style="flex:1;min-width:0"><div class="lpo-meta">' +
          '<span class="lpo-famv"><i style="background:' + pl.color + '"></i>' + esc(pl.label) + '</span>' +
          '<span class="lpo-etat ' + (garde.statut === 'refuse' && !garde.publie ? '' : et) + '"><i></i>' + esc(nomEtape) + '</span></div>' +
        '<h2>' + esc(quandLong(p)) + '</h2></div>' +
        '<button type="button" class="lpo-x mk-press" onclick="V2.lip.fermer()" aria-label="Fermer">' + icS('fermer', 22, 2) + '</button></div>' +
      '<div class="lpo-vc">' +
        '<div class="lpo-scene"><div class="lpo-cible">Déposez l’image, la vidéo ou le PDF ici</div>' +
          apercuHtml(p, '<textarea class="lpo-ltxt' + (ouvert.deplie ? '' : ' plie') + '" id="lpo-texte" rows="4" spellcheck="true" aria-label="Texte du post, modifiable" ' +
              'onfocus="V2.lip.deplier()" oninput="V2.lip.setTexte(this.value)">' + esc(texteDe(p, e)) + '</textarea>' +
            (ouvert.deplie ? '' : '<button type="button" class="lpo-deplier" id="lpo-deplier" onclick="V2.lip.deplier(true)">… voir plus</button>'),
            '<div class="lpo-vis" id="lpo-vis">' + visuelHtml() + '</div>') +
          '<div class="lpo-aide" id="lpo-aide">' + aideHtml() + '</div>' +
        '</div>' +
        '<div class="lpo-regl">' +
          '<section><span class="lpo-cap">Sujet</span>' + sujets +
            (alts() ? '' : '<p class="lpo-t5">Chargement des autres sujets proposés pour cette date…</p>') +
            '<p class="lpo-t5">' + esc(cur.angle) + '</p></section>' +
          '<section><span class="lpo-cap">Ton</span><div class="mk-seg" role="group" aria-label="Version du texte" style="--n:' + (tons.length || 1) + ';--i:' + it + '"><i class="mk-seg-ind"></i>' + tons.join('') + '</div></section>' +
          '<section><span class="lpo-cap">Image, vidéo ou document</span><div id="lpo-media">' + mediaHtml() + '</div>' +
            '<p class="lpo-t5"><b>Idée de visuel</b> — ' + esc(cur.v[iv] || cur.v[0] || '') + '</p></section>' +
          '<section><span class="lpo-cap">Qui s’en occupe ?</span><div class="mk-seg" role="group" aria-label="Qui s’en occupe ?"' + (iq < 0 ? ' data-aucun="1"' : '') + ' style="--n:' + QUI.length + ';--i:' + Math.max(iq, 0) + '"><i class="mk-seg-ind"></i>' +
            QUI.map(function (q) {
              return '<button type="button" class="mk-press" aria-pressed="' + (e.resp === q.k) + '" onclick="V2.lip.quiTiroir(\'' + q.k + '\')">' + esc(q.label) + '</button>';
            }).join('') + '</div></section>' +
          '<section><label class="lpo-cap" for="lpo-com">Commentaire pour l’équipe</label>' +
            '<textarea class="lpo-champ" id="lpo-com" rows="2" placeholder="Ce qu’il faut changer, préciser, éviter…" oninput="V2.lip.setChamp(\'commentaire\',this.value)">' + esc(e.commentaire || '') + '</textarea>' +
            '<p class="lpo-t5">Visible par toute l’équipe. Gardé quand vous retenez le texte ou quand vous enregistrez.</p></section>' +
          repliHtml('visuel', 'Idées de visuel — ' + cur.v.length + ' proposition' + (cur.v.length > 1 ? 's' : ''), idees) +
          repliHtml('prompt', 'Prompt d’image — 3 approches', prompt) +
          repliHtml('ligne', 'Hashtags et ligne éditoriale',
            '<p class="lpo-t5" style="margin-top:0"><b>Hashtags prévus</b> — ' + esc(cur.tags) + '</p>' +
            '<p class="lpo-t5"><b>Oui</b> — ' + esc(REGLE_OUI) + '</p><p class="lpo-t5"><b>Non</b> — ' + esc(REGLE_NON) + '</p>') +
          '<section><div class="lpo-rang" style="margin-top:0"><button type="button" class="mk-btn mk-press" onclick="V2.lip.enregistrer()">Enregistrer sans retenir</button>' +
            '<span class="lpo-autres">' + autresHtml() + '</span></div>' +
            '<p class="lpo-t5">Garde le sujet, le ton, le texte et le commentaire tels qu’ils sont ici, sans faire avancer le post.</p></section>' +
        '</div>' +
      '</div>' +
      '<div class="lpo-vp">' + piedHtml() + '</div></div>';
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

  // 19/09/2026 (lot 6) — les cinq pages côte à côte, en un tableau dense (plus de carte orpheline sur un second rang).
  function tableauPages() {
    var v = V();
    var cols = [['Abonnés', function (s) { return s.abonnes.toLocaleString('fr-FR'); }],
      ['Posts sur 12 mois', function (s) { return s.n; }],
      ['Par semaine', function (s) { return s.parSemaine.toFixed(2).replace('.', ','); }],
      ['Réactions (médiane)', function (s) { return s.reactMed; }],
      ['Partages (médiane)', function (s) { return s.partMed; }],
      ['Engagement /1000 ab.', function (s) { return String(s.engPour1000).replace('.', ','); }]];
    return '<div class="lpv-carte mk-souleve"><table class="lpv-pages"><thead><tr><th>Page</th>' +
      cols.map(function (c) { return '<th class="num">' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      v.sources.map(function (s) {
        return '<tr' + (s.nous ? ' class="nous"' : '') + '><th scope="row">' + esc(s.nom) + '</th>' +
          cols.map(function (c) { return '<td class="num" data-l="' + esc(c[0]) + '">' + c[1](s) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Les trois plus grands écarts, en tête d'écran : la réponse à « et donc ? ». Rien d'inventé : lu dans v.ecarts.
  function ecartsEnTete() {
    var v = V();
    var l = v.ecarts.filter(function (e) { return e.ecart > 0; }).sort(function (a, b) { return b.ecart - a.ecart; }).slice(0, 3);
    if (!l.length) return '';
    return '<div class="lpv-tete3">' + l.map(function (e) {
      return '<div class="lpv-ecart"><b>+' + e.ecart + '<small> pts</small></b><span>' + esc(e.th) + '</span>' +
        '<em>nous ' + e.nous + ' % · confrères ' + e.conc + ' %</em></div>';
    }).join('') + '</div>';
  }
  function plus(texte) { return '<details class="lpv-plus"><summary>En savoir plus</summary><p>' + texte + '</p></details>'; }

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
    var meilleurJour = Object.keys(a.jourConc).sort(function (x, y) { return a.jourConc[y][1] - a.jourConc[x][1]; })[0];
    var meilleureHeure = Object.keys(a.heureConc).sort(function (x, y) { return a.heureConc[y][1] - a.heureConc[x][1]; })[0];
    var nous = null; v.sources.forEach(function (s) { if (s.nous) nous = s; });
    return '<section class="lpv-focal mk-souleve"><h2>Ce que les confrères couvrent et pas nous</h2>' +
      '<p class="lpv-sd">Les trois plus grands écarts, en points de part des posts. Un écart positif est un angle qu\'ils occupent et que nous laissons vide ; ' +
      'ce n\'est pas une consigne : à confronter à notre ligne éditoriale.</p>' +
      ecartsEnTete() +
      plus('Part des posts qui abordent chaque thème. « Confrères » = moyenne de CERP, CERP Bretagne Atlantique, OCP Répartition et Sagitta Pharma. ' +
        '<b>Comment c\'est calculé :</b> par mots-clés dans le texte des posts. Un post peut compter dans plusieurs thèmes, et le classement reste approximatif — ' +
        'à lire comme un ordre de grandeur, pas comme un décompte exact. Les écarts de plus de 20 points sont robustes ; ceux de 3 à 7 points ne le sont pas.') +
      tableauEcarts() + '</section>' +
      '<section class="lip-sect"><h2>Les cinq pages, côte à côte</h2>' +
      tableauPages() +
      // Sans cet avertissement, « 53,7 contre 2,5 » se lit comme une victoire.
      // C'est un artefact : sur 564 abonnés dont une part de collègues, le taux
      // monte mécaniquement. Un chiffre qu'on ne sait pas lire vaut mieux écrit.
      '<div class="lpv-avis">' + ICO('alert', 18, 2) + '<p>L\'engagement pour 1000 abonnés n\'est pas un classement : sur une petite base, il monte mécaniquement.</p>' +
      plus('Sur une petite base — ' + (nous ? nous.abonnes.toLocaleString('fr-FR') : '') + ' abonnés, dont une partie de collègues et de partenaires — ce taux monte ' +
        'mécaniquement. Il sert à comparer des <b>thèmes</b> et des <b>formats</b> entre eux, pas des pages entre elles.') + '</div></section>' +
      '<div class="lpv-duo">' +
      '<section class="lip-sect"><h2>Quel thème fait réagir</h2>' +
      '<p class="lpv-sd">Engagement médian pour 1000 abonnés, chez les confrères uniquement. Les coulisses logistiques arrivent en tête — notre plus gros angle mort.</p>' +
      plus('Notre page est trop petite pour être comparée brut : seuls les confrères entrent dans ce calcul.') +
      tableauMed('Thème', a.themeConc, function (k) { return k; }) + '</section>' +
      '<section class="lip-sect"><h2>Quel format fait réagir</h2>' +
      '<p class="lpv-sd">Même mesure, par format de post.</p>' +
      tableauMed('Format', a.formatConc, function (k) { return k; }) + '</section>' +
      '</div>' +
      '<section class="lip-sect"><h2>Quand publier</h2>' +
      '<p class="lpv-sd">Le meilleur jour mesuré est le <b>' + esc(JOURS[parseInt(meilleurJour, 10)].toLowerCase()) + '</b> et le meilleur créneau <b>' + meilleureHeure + 'h–' + (parseInt(meilleureHeure, 10) + 1) + 'h</b>. Le rétro-planning est calé sur ces créneaux : mardi 11h et jeudi 9h30.</p>' +
      '<div class="lpv-duo lpv-duo-serre">' +
      tableauMed('Jour', a.jourConc, function (k) { return JOURS[parseInt(k, 10)]; }) +
      tableauMed('Créneau', a.heureConc, function (k) { return k + 'h – ' + (parseInt(k, 10) + 1) + 'h'; }) + '</div></section>';
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
      (tot > veilleVue.limite ? '<div style="text-align:center;margin-top:16px"><button type="button" class="mk-btn" onclick="V2.lip.plusPosts()">Afficher 30 de plus</button></div>' : '');
  }

  function renderVeille(root) {
    if (!V()) {
      root.innerHTML = coquille('<div class="lip-load">Chargement de la veille…</div>');
      charger('mkt-li-veille-data.js', V).then(function (ok) {
        if (V2.route && V2.route.name !== 'marketing') return;   // 11/09/2026 : l'écran a pu changer pendant l'attente
        if (!ok) { root.innerHTML = coquille('<div class="lip-empty">Le fichier de veille n\'a pas pu être chargé.</div>'); return; }
        redessine();
      });
      return;
    }
    var v = V();
    var onglets = [['synthese', 'Synthèse'], ['top', 'Top engagement'], ['tous', 'Tous les posts']];
    var rang = 0; onglets.forEach(function (o, k) { if (o[0] === veilleVue.onglet) rang = k; });
    var nav = '<div class="mk-seg lpv-onglets" role="group" aria-label="Vues de la veille" style="--n:3;--i:' + rang + '"><span class="mk-seg-ind" aria-hidden="true"></span>' + onglets.map(function (o) {
      return '<button type="button" aria-pressed="' + (veilleVue.onglet === o[0] ? 'true' : 'false') + '" onclick="V2.lip.setOnglet(\'' + o[0] + '\')">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
    var corps = veilleVue.onglet === 'synthese' ? renderVeilleSynthese() : renderVeillePosts();
    root.innerHTML = coquille(nav + corps);
  }

  /* ───────────────── routage interne ───────────────── */
  var vue = 'plan';
  // Lot 4 : l'accueil « Cette semaine » (#marketing, sans paramètre) montre les mêmes posts et suit les mêmes changements.
  function surEcran() { return !!(V2.route && V2.route.name === 'marketing' && (V2.route.param === 'linkedin' || !V2.route.param)); }
  function redessine() { if (surEcran()) V2.render(); }

  function render(root, quelle) {
    vue = quelle || 'plan';
    if (vue === 'veille') return renderVeille(root);
    return renderPlan(root);
  }

  /* ───────────────── API publique ───────────────── */
  V2.liPlan = { render: function (r) { return render(r, 'plan'); } };
  V2.liVeille = { render: function (r) { return render(r, 'veille'); } };
  V2.lip = V2.lip || {};

  V2.lip.nouveauLibre = function (jour) {
    if (V2.li && V2.li.newAt) V2.li.newAt(jour || new Date().toISOString().slice(0, 10));
    else toast('L’éditeur de post n’est pas chargé', 'error');
  };
  V2.lip.ouvrirLibre = function (id) { if (V2.li && V2.li.openPost) V2.li.openPost(id); };
  V2.lip.zoomLibre = function (id) {
    var l = libres(); for (var i = 0; i < l.length; i++) {
      if (String(l[i].id) === String(id) && l[i].image_path && V2.li && V2.li.zoom) {
        V2.li.zoom(urlImage(l[i].image_path), l[i].title || ''); return;
      }
    }
  };
  V2.lip.togglePasse = function () { voirPasse = !voirPasse; redessine(); };
  // Attribution en un clic, depuis la carte : enregistré tout de suite.
  V2.lip.quiFait = function (n, k) {
    var p = postDe(n); if (!p) return;
    var e = copieEtat(etat(n));
    e.resp = (e.resp === k) ? '' : k; e.sujet = sujetEff(p, e);
    enregistrer(n, e).then(redessine);
  };

  V2.lip.setMoi = function (k) {
    moi = (moi === k) ? 'both' : k;
    try { localStorage.setItem(LSV, JSON.stringify({ who: moi })); } catch (e) {}
    redessine();
  };
  V2.lip.setEtape = function (k) { etape = k; redessine(); };
  V2.lip.plusSemaines = function () { nbSem += 4; redessine(); };
  V2.lip.toggleEcartes = function () { voirEcartes = !voirEcartes; redessine(); };
  V2.lip.plusOuvert = function (o, cle) { if (ouvert) ouvert.replis[cle || 'visuel'] = !!o; };
  // « Qui s'en occupe » depuis la fiche : partagé tout de suite, sans emporter
  // le sujet ou le texte encore à l'essai dans la fiche.
  V2.lip.quiTiroir = function (k) {
    if (!ouvert) return;
    var v = (ouvert.e.resp === k) ? '' : k, s = copieEtat(etat(ouvert.n));
    ouvert.e.resp = v; s.resp = v; s.sujet = sujetEff(ouvert.p, s);
    enregistrer(ouvert.n, s).then(function () { signalerEnregistre(); redessineTiroir(); redessine(); });
  };
  function tropCetteSemaine() {
    return etat(ouvert.n).statut !== 'valide' && retenusSemaine(lundiDe(ouvert.p.d)) >= MAX_SEM;
  }
  function figerChoix() {
    var e = ouvert.e, cur = sujetOuvert();
    e.sujet = sujetEff(ouvert.p, e); e.variante = varEff(cur, e); e.statut = 'valide';
    return e;
  }
  function marquerCarte(n, ms) { var S = socle(); if (S.marquer) S.marquer(carteDe(n), ms || 1400); }

  /* Geste 6 — Voyager : le post change d'étape. À 1280 la carte traverse vers sa colonne et les voisines se
     resserrent ; à 390 elle s'envole vers le segment de destination, qui prend le relais. Sans `vers`, seules
     les voisines bougent (post écarté ou remis). Mouvement réduit : re-rendu sec + anneau sur la carte arrivée. */
  function voyagerPost(n, vers) {
    var S = socle(), racine = document.getElementById('v2-root'), id = 'P' + n;
    if (!S.voyager || !racine) { redessine(); return; }
    if (!vers || !S.tel()) { S.voyager(racine, redessine, vers ? id : null); return; }
    var carte = racine.querySelector('.lpo-carte[data-mk-id="' + id + '"]'), onglet = racine.querySelector('.lpo-etapes [data-etape="' + vers + '"]');
    if (!visibleAEcran(carte) || !onglet || S.calme()) { etape = vers; redessine(); marquerCarte(n); return; }
    var r = carte.getBoundingClientRect(), o = onglet.getBoundingClientRect();
    var enveloppe = document.createElement('div'), f = carte.cloneNode(true);
    enveloppe.className = 'mk-espace'; enveloppe.setAttribute('aria-hidden', 'true');
    f.removeAttribute('data-mk-id'); f.removeAttribute('data-n'); f.removeAttribute('tabindex'); f.removeAttribute('onclick'); f.removeAttribute('onkeydown');
    f.classList.add('mk-en-voyage');
    f.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;margin:0;z-index:75;pointer-events:none;transform-origin:0 0';
    enveloppe.appendChild(f); document.body.appendChild(enveloppe);
    S.voyager(racine, redessine, null);   // la carte a quitté sa colonne : les voisines se resserrent
    var k = .34, dx = o.left + o.width / 2 - r.width * k / 2 - r.left, dy = o.top + o.height / 2 - r.height * k / 2 - r.top;
    var fini = false, fin = function () {
      if (fini) return; fini = true;
      if (enveloppe.parentNode) enveloppe.parentNode.removeChild(enveloppe);
      var og = document.querySelector('#v2-root .lpo-etapes [data-etape="' + vers + '"]');
      if (og) { og.classList.add('lpo-flash'); }
      setTimeout(function () {
        etape = vers; redessine();
        var c = carteDe(n);
        if (c) { marquerCarte(n, 1600); S.animer(c, [{ opacity: 0, transform: 'translateY(-24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: S.ressort() }); }
      }, 140);
    };
    var an = S.animer(f, [{ transform: 'none', opacity: 1, easing: 'cubic-bezier(.22,1,.36,1)' },
      { transform: 'translateY(-6px) scale(1.03)', opacity: 1, offset: .18, easing: 'cubic-bezier(.5,0,.15,1)' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', opacity: 1, offset: .88 },
      { transform: 'translate(' + dx + 'px,' + (dy + 4) + 'px) scale(' + (k * .86) + ')', opacity: 0 }], { duration: 400, easing: 'linear', fill: 'forwards' });
    if (an) an.onfinish = fin;
    setTimeout(fin, 520);
  }
  // La confirmation se lit sur le bouton (geste 9) ; le volet se referme ensuite et la carte voyage.
  function puisVoyager(n, vers) {
    var S = socle();
    if (S.confirmer) S.confirmer(principal(), 900);
    signalerEnregistre();
    setTimeout(function () {
      if (ouvert && ouvert.n === n) fermer(function () { voyagerPost(n, vers); });
      else voyagerPost(n, vers);
    }, calme() ? 0 : 560);
  }

  V2.lip.retenir = function () {
    if (!ouvert) return;
    if (tropCetteSemaine()) { toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); return; }
    var n = ouvert.n, deja = etat(n).statut === 'valide' && !etat(n).publie;
    enregistrer(n, copieEtat(figerChoix())).then(function () {
      if (!deja) return puisVoyager(n, 'pret');
      // Le post était déjà « Prêt » : il ne change pas de colonne. Le bouton confirme, puis propose l'étape suivante.
      var S = socle(); if (S.confirmer) S.confirmer(principal(), 900);
      signalerEnregistre();
      setTimeout(function () { redessineTiroir(); redessine(); marquerCarte(n); }, calme() ? 0 : 900);
    });
  };
  V2.lip.marquerPublie = function (oui) {
    if (!ouvert) return;
    if (oui && tropCetteSemaine()) { toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); lacher(); return; }
    var n = ouvert.n, e = oui ? figerChoix() : ouvert.e;
    e.publie = !!oui;
    enregistrer(n, copieEtat(e)).then(function () {
      if (oui) { delete partis[n]; return puisVoyager(n, 'publie'); }
      signalerEnregistre();
      fermer(function () { voyagerPost(n, etapeDe(etat(n))); });
    });
  };
  V2.lip.ecarter = function (oui) {
    if (!ouvert) return;
    var n = ouvert.n, s = copieEtat(etat(n));
    s.statut = oui ? 'refuse' : 'attente'; s.sujet = sujetEff(ouvert.p, s);
    // Message flottant gardé ici : c'est une action sur laquelle on peut revenir (« Revoir les posts écartés »).
    enregistrer(n, s).then(function () { toast(oui ? 'Post écarté pour cette semaine' : 'Post remis dans la liste'); fermer(function () { voyagerPost(n, ''); }); });
  };

  V2.lip.ouvrir = function (n) {
    var P = plan(); if (!P) return;
    var p = null; for (var i = 0; i < P.length; i++) if (P[i].n === n) { p = P[i]; break; }
    if (!p) return;
    var e = etat(n);
    apprVue = null;
    ouvert = { n: n, p: p, envoi: null, erreurMedia: '', note: '', deplie: false, replis: {}, e: copieEtat(e) };
    ouvert.e.sujet = sujetEff(p, e);
    ouvrirVolet(carteDe(n));
  };
  V2.lip.fermer = function () { fermer(); };

  /* ────────── Lot 4 — ce que l'accueil « Cette semaine » (v2-mkt-semaine.js) lit et déclenche ──────────
     Aucun second chemin d'écriture : l'accueil ouvre le volet (V2.lip.ouvrir) ou rejoue, par V2.lip.agir,
     les fonctions mêmes du volet (publier, marquerPublie) dans un contexte sans écran. */
  // false tant que le fichier du plan n'est pas là (il se charge, puis l'écran se redessine) ; 'rate' s'il n'a pas pu l'être.
  var planRate = false;
  V2.lip.pret = function () {
    if (!plan()) {
      if (planRate) return 'rate';
      charger('mkt-li-plan-data.js', plan).then(function (ok) { if (!ok) planRate = true; redessine(); });
      return false;
    }
    lancerChargements(); chargerLibres();
    return etatsLus;
  };
  // Les posts proposés, du plus proche au plus lointain, avec ce que l'écran des posts en sait.
  V2.lip.lecture = function () {
    var P = plan(), out = [];
    (P || []).filter(visible).forEach(function (p) {
      var e = etat(p.n), cur = sujetDe(p, sujetEff(p, e)), pl = pilier(p.p), vi = varEff(cur, e);
      out.push({ n: p.n, d: p.d, h: p.h, lundi: lundiDe(p.d), etape: etapeDe(e), ecarte: e.statut === 'refuse' && !e.publie, resp: e.resp || '',
        qui: quiLabel(e.resp), titre: cur.titre, quand: quandLong(p), famille: pl.label, couleur: pl.color, parti: !!partis[p.n],
        sujet: String.fromCharCode(65 + sujetEff(p, e)), ton: (function () { for (var i = 0; i < TONS.length; i++) if (cur.t[vi] && TONS[i][0] === cur.t[vi].ton) return TONS[i][1]; return ''; })(),
        media: e.image_path ? genreFichier(e.image_path) : '' });
    });
    out.sort(function (a, b) { return (a.d + a.h) < (b.d + b.h) ? -1 : 1; });
    return { posts: out, cette: lundiDe(isoJour(new Date())), moi: moi, nbSem: nbSem, max: MAX_SEM, local: backend === 'local',
      libres: libres().map(function (x) { return { id: x.id, d: String(x.date).slice(0, 10), lundi: lundiDe(x.date), etape: etapeLibre(x), html: carteLibre(x) }; }) };
  };
  V2.lip.semLabel = semLabel;
  // L'aperçu LinkedIn d'un post, en lecture : le même composant que dans le volet.
  V2.lip.apercu = function (n, attrs) {
    var p = postDe(n); if (!p) return '';
    var e = etat(n);
    return apercuHtml(p, '<p class="lpo-ltxt lpo-lecture">' + esc(texteDe(p, e)) + '</p>', '<div class="lpo-vis">' + couvDe(p, e) + '</div>', attrs);
  };
  V2.lip.carteHtml = function (n) { var p = postDe(n); return p ? carte(p) : ''; };
  V2.lip.quiHtml = function (n) { var p = postDe(n); return p ? quiHtml(p, etat(n)) : ''; };
  V2.lip.agir = function (n, quoi) {
    if (voletLa()) return;
    var p = postDe(n); if (!p) return;
    ouvert = { n: n, p: p, envoi: null, erreurMedia: '', note: '', deplie: false, replis: {}, e: copieEtat(etat(n)), muet: true };
    ouvert.e.sujet = sujetEff(p, etat(n));
    if (quoi === 'publier') V2.lip.publier();
    else if (quoi === 'marquer') V2.lip.marquerPublie(true);
    else lacher();
  };
  V2.lip.fermerDA = fermerDA;
  // La couverture d'un post du plan, pour un autre écran de l'espace Marketing (« Cette semaine », lot 4).
  V2.lip.couverture = function (n) { var p = postDe(n); return p ? couvDe(p, etat(n)) : ''; };
  V2.lip.deplier = function (puisEcrire) {
    if (!ouvert) return;
    var t = document.getElementById('lpo-texte'), b = document.getElementById('lpo-deplier');
    if (!ouvert.deplie) { ouvert.deplie = true; if (t) t.classList.remove('plie'); if (b && b.parentNode) b.parentNode.removeChild(b); ajusterTexte(); }
    if (puisEcrire && t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  V2.lip.setChamp = function (champ, val) {
    if (!ouvert) return;
    if (champ === 'resp' && ouvert.e.resp === val) val = '';   // second clic : on retire
    ouvert.e[champ] = val;
    if (champ === 'sujet') {
      // Texte 2 du sujet A n'a rien à voir avec Texte 2 du sujet B : garder
      // l'ancien numéro ferait valider un texte que personne n'a lu.
      ouvert.e.variante = null; ouvert.e.visuel = null; apprVue = null;
      if (ouvert.e.statut === 'valide' && !ouvert.e.publie) ouvert.e.statut = 'attente';   // nouveau sujet : à retenir de nouveau
    }
    if (champ === 'visuel') apprVue = null;   // l'approche suggérée suit le visuel choisi
    if (champ === 'commentaire') return;          // ne pas redessiner sous les doigts
    if (champ === 'sujet' || champ === 'variante') ouvert.note = '';
    redessineTiroir();   // conserve la position de défilement
    if (champ === 'sujet' || champ === 'variante') {   // le nouvel aperçu arrive en fondu
      var li = document.querySelector('#lip-drawer .lpo-li'); if (li) li.classList.add('mk-fondu');
    }
  };
  V2.lip.setTexte = function (v) {
    if (!ouvert) return;
    var e = ouvert.e, cur = sujetOuvert(), vi = varEff(cur, e), prop = cur.t[vi] ? cur.t[vi].txt : '';
    if (v === prop || !String(v).trim()) { e.texte = ''; e.texteCle = ''; }
    else { e.texte = v; e.texteCle = sujetEff(ouvert.p, e) + '.' + vi; }
    ouvert.note = '';
    // pas de redessin sous les doigts : seuls le pied du volet et la ligne d'aide suivent
    ajusterTexte(); peindrePied();
    var a = document.getElementById('lpo-aide'); if (a) a.innerHTML = aideHtml();
  };
  V2.lip.texteOrigine = function () { if (ouvert) { ouvert.e.texte = ''; ouvert.e.texteCle = ''; redessineTiroir(); } };
  V2.lip.enregistrer = function () {
    if (!ouvert) return;
    var n = ouvert.n, e = ouvert.e;
    if (e.statut === 'valide' && etat(n).statut !== 'valide' && retenusSemaine(lundiDe(ouvert.p.d)) >= MAX_SEM) {
      toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); return;
    }
    var avant = etapeDe(etat(n));
    enregistrer(n, e).then(function () {
      signalerEnregistre();
      var apres = etapeDe(etat(n));
      fermer(function () { if (apres !== avant) voyagerPost(n, apres); else { redessine(); marquerCarte(n); } });
    });
  };
  V2.lip.copier = function () {
    if (!ouvert) return;
    var cur = sujetOuvert(), i = varEff(cur, ouvert.e);
    if (!cur.t[i]) return;
    var txt = texteDe(ouvert.p, ouvert.e);
    var fait = function () { var S = socle(), B = document.querySelectorAll('#lip-drawer [data-lpo-copier]'); for (var k = 0; k < B.length; k++) if (S.confirmer) S.confirmer(B[k]); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(fait, function () { window.prompt('Copiez le texte :', txt); });
    } else window.prompt('Copiez le texte :', txt);
  };
  V2.lip.publier = function () {
    if (!ouvert) return;
    var cur = sujetOuvert(), i = varEff(cur, ouvert.e);
    if (!cur.t[i]) { lacher(); return; }
    if (ouvert.e.statut !== 'valide' && !confirm('Ce post n’est pas encore retenu.\n\nL’ouvrir quand même dans LinkedIn ?')) { lacher(); return; }
    var txt = texteDe(ouvert.p, ouvert.e), n = ouvert.n;
    var suite = function () {
      window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
      if (ouvert && ouvert.e.image_path) {
        // LinkedIn ne peut pas recevoir l'image automatiquement : on l'ouvre à côté
        // pour qu'elle soit sous la main au moment de la glisser dans le post.
        window.open(urlImage(ouvert.e.image_path), '_blank');
      }
      if (!ouvert || ouvert.n !== n) return;
      // La consigne reste sous l'aperçu (plus de message flottant), et le bouton plein passe à l'étape suivante.
      ouvert.note = 'Texte copié. Collez-le dans LinkedIn, puis ajoutez le fichier.';
      var S = socle(), b = principal();
      if (etapeVolet() === 'linkedin' && S.confirmer) S.confirmer(b, 900);
      setTimeout(function () {
        if (!ouvert || ouvert.n !== n) return;
        if (etat(n).statut === 'valide') partis[n] = 1;
        if (ouvert.muet) { ouvert = null; redessine(); return; }   // parti depuis l'accueil : son bouton passe à « Marquer comme publié »
        peindrePied();
        var a = document.getElementById('lpo-aide'); if (a) a.innerHTML = aideHtml();
      }, calme() ? 0 : 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(suite, function () { window.prompt('Copiez le texte :', txt); suite(); });
    } else { window.prompt('Copiez le texte :', txt); suite(); }
  };

  V2.lip.setOnglet = function (o) { veilleVue.onglet = o; veilleVue.limite = 30; redessine(); };
  V2.lip.setVSrc = function (v) { veilleVue.src = v; veilleVue.limite = 30; redessine(); };
  V2.lip.setVQ = function (v) { veilleVue.q = v; veilleVue.limite = 30; clearTimeout(V2.lip._t2); V2.lip._t2 = setTimeout(redessine, 260); };
  V2.lip.plusPosts = function () { veilleVue.limite += 30; redessine(); };
  V2.lip.togglePost = function (id) { veilleVue.ouverts[id] = !veilleVue.ouverts[id]; redessine(); };

  V2.lip.exportCsv = function () {
    var P = plan(); if (!P) return;
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var l = [['N','Date','Heure','Pilier','Sujet retenu','Format','Titre','Angle','Statut','Qui','Texte choisi','Visuel choisi','Commentaire','Hashtags','Texte 1','Texte 2','Texte 3','Visuel 1','Visuel 2','Autres sujets proposés','Texte modifié'].map(q).join(';')];
    P.filter(visible).forEach(function (p) {
      var e = etat(p.n), S = sujetsDe(p), si = sujetEff(p, e), c = S[si] || S[0];
      var autres = S.filter(function (x, i) { return i !== si && sujetPermis(p, i); })
        .map(function (x, i) { return x.titre; }).join(' | ');
      l.push([p.n, p.d, p.h, pilier(p.p).label, 'Sujet ' + String.fromCharCode(65 + si), c.f, c.titre, c.angle, e.publie ? 'Publié' : statut(e.statut).label, quiLabel(e.resp),
        e.variante === null ? '' : 'Texte ' + (e.variante + 1),
        e.visuel === null ? '' : 'Visuel ' + (e.visuel + 1),
        e.commentaire || '', c.tags,
        c.t[0] ? c.t[0].txt : '', c.t[1] ? c.t[1].txt : '', c.t[2] ? c.t[2].txt : '',
        c.v[0] || '', c.v[1] || '', autres, texteDe(p, e) !== ((c.t[varEff(c, e)] || {}).txt || '') ? texteDe(p, e) : ''].map(q).join(';'));
    });
    var blob = new Blob(['﻿' + l.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'retroplanning-linkedin-12-mois.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
