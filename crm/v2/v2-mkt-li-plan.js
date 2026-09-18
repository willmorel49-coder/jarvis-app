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
      '.lip-btn{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:9px;border:1px solid var(--lip-line);background:var(--lip-panel);font-family:inherit;font-size:13.5px;font-weight:600;line-height:1;color:var(--lip-ink70);cursor:pointer;transition:all .15s var(--lip-ease)}',
      '.lip-btn:hover{background:var(--lip-bg);color:var(--lip-ink)}',
      '.lip-btn-p{background:var(--lip-blue);border-color:var(--lip-blue);color:#fff;font-weight:700;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lip-btn-p:hover{background:#0047d6;color:#fff;transform:translateY(-1px)}',
      '.lip-spacer{flex:1}',

      /* groupe mois */
      '.lip-mois{display:flex;align-items:center;gap:12px;margin:30px 2px 12px}',
      '.lip-mois h2{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;text-transform:capitalize}',
      '.lip-mline{flex:1;height:1px;background:var(--lip-line)}',
      '.lip-mcount{font-size:12px;font-weight:700;color:var(--lip-ink35)}',

      /* vue « À deux » (choix de Will, 18/09/2026) : trois colonnes, une carte compacte par post.
         Un seul accent, le bleu ; la couleur d'une famille ne sert qu'à une pastille ronde. */
      '.lid-who{display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin:18px 0 0}',
      '.lid-people{display:flex;align-items:center;gap:14px}',
      '.lid-wbtn{background:none;border:0;padding:0;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;font:inherit;border-radius:16px}',
      '.lid-wav{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;background:#fff;border:1.5px solid rgba(16,19,28,.12);color:var(--lip-ink70);box-shadow:var(--lip-sh);transition:transform .2s var(--lip-ease),background .2s var(--lip-ease),color .2s var(--lip-ease)}',
      '.lid-wbtn:hover .lid-wav{transform:translateY(-1px)}',
      '.lid-wbtn[aria-pressed="true"] .lid-wav{background:var(--lip-blue);border-color:transparent;color:#fff;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lid-wlab{font-size:13px;font-weight:600;color:var(--lip-ink50)}',
      '.lid-wbtn[aria-pressed="true"] .lid-wlab{color:var(--lip-ink)}',
      '.lid-both{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid rgba(16,19,28,.12);background:#fff;font-family:inherit;font-size:13.5px;font-weight:600;line-height:1;color:var(--lip-ink50);box-shadow:var(--lip-sh);cursor:pointer;transition:all .2s var(--lip-ease)}',
      '.lid-both[aria-pressed="true"]{background:var(--lip-blue050);border-color:var(--lip-blue);color:#0034A0}',
      '.lid-wbtn:focus-visible,.lid-both:focus-visible,.lid-card:focus-visible,.lid-tab:focus-visible{outline:3px solid rgba(0,87,255,.45);outline-offset:2px}',
      '.lid-resume{margin:18px 0 0;font-size:26px;font-weight:700;letter-spacing:-.01em;line-height:1.2}',
      '.lid-resume b{color:var(--lip-blue);font-weight:700;font-variant-numeric:tabular-nums}',
      '.lid-rsub{margin:4px 0 0;font-size:13px;color:var(--lip-ink50)}',
      '.lid-tabs{display:none;gap:8px;margin:18px 0 14px}',
      '.lid-tab{flex:1;min-height:44px;border-radius:12px;border:1px solid rgba(16,19,28,.12);background:#fff;font-family:inherit;font-size:13px;font-weight:600;line-height:1;color:var(--lip-ink50);box-shadow:var(--lip-sh);padding:0 6px;cursor:pointer}',
      '.lid-tab[aria-selected="true"]{background:var(--lip-blue);border-color:transparent;color:#fff;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lid-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:22px}',
      '.lid-col{display:flex;flex-direction:column;min-width:0}',
      '.lid-colh{display:flex;align-items:baseline;gap:10px;padding:0 4px 12px}',
      '.lid-cnt{font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}',
      '.lid-col.publie .lid-cnt{color:#0F7A52}',
      '.lid-colt{font-size:13.5px;font-weight:600;color:var(--lip-ink50)}',
      '.lid-list{display:flex;flex-direction:column;gap:10px;min-height:60px}',
      '.lid-empty{border:1.5px dashed rgba(16,19,28,.14);border-radius:20px;padding:18px 14px;text-align:center;font-size:13px;color:var(--lip-ink50);line-height:1.4;margin:0}',
      '.lid-card{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(16,19,28,.05),0 4px 10px rgba(16,19,28,.05),0 12px 24px rgba(16,19,28,.05);transition:transform .2s var(--lip-ease),box-shadow .2s var(--lip-ease)}',
      '.lid-card:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(16,19,28,.06),0 14px 26px rgba(16,19,28,.09)}',
      '.lid-card.ecarte{background:#f6f7f9;box-shadow:none}',
      '.lid-card.ecarte .lid-title{text-decoration:line-through;color:var(--lip-ink50)}',
      '.lid-main{flex:1;min-width:0}',
      '.lid-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.lid-date{font-size:13.5px;font-weight:700;flex:none}',
      '.lid-col.publie .lid-date{color:#0F7A52}',
      '.lid-pil{display:block;font-size:12.5px;color:var(--lip-ink50);min-width:0;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lid-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}',
      '.lid-title{margin:4px 0 0;font-size:13.5px;line-height:1.35;color:var(--lip-ink70);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.lid-foot{display:flex;align-items:center;gap:6px;flex:none}',
      '.lid-av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex:none;background:var(--lip-blue);color:#fff}',
      '.lid-claim{min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid var(--lip-blue);background:#fff;color:var(--lip-blue);font-family:inherit;font-size:13px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer}',
      '.lid-claim:hover{background:var(--lip-blue050)}',
      '.lid-pick{width:36px;height:36px;border-radius:50%;border:1.5px solid rgba(16,19,28,.14);background:#fff;color:var(--lip-ink50);font-family:inherit;font-size:13px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}',
      '.lid-pick:hover{border-color:var(--lip-blue);color:var(--lip-blue)}',
      '.lid-more{display:block;width:100%;min-height:44px;margin:22px 0 0;background:none;border:0;font-family:inherit;font-size:13px;font-weight:500;line-height:1;color:var(--lip-ink50);cursor:pointer}',
      '.lid-more:hover{color:var(--lip-blue)}',

      /* fiche d\'un post : sujet, version du texte, qui, actions */
      '.lid-tuiles{display:flex;gap:8px}',
      '.lid-tuile{flex:1;min-width:0;min-height:64px;border-radius:14px;border:1.5px solid rgba(16,19,28,.12);background:#fff;padding:9px 10px;text-align:left;box-shadow:var(--lip-sh);cursor:pointer;font:inherit;transition:all .2s var(--lip-ease)}',
      '.lid-tl{display:block;font-size:12px;font-weight:800;color:var(--lip-ink50);letter-spacing:.02em}',
      '.lid-tt{margin-top:4px;font-size:13px;line-height:1.3;color:var(--lip-ink70);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.lid-tuile[aria-pressed="true"]{border-color:var(--lip-blue);background:var(--lip-blue050)}',
      '.lid-tuile[aria-pressed="true"] .lid-tl{color:#0034A0}',
      '.lid-angle{margin:10px 0 0;font-size:13px;color:var(--lip-ink50);line-height:1.45}',
      '.lid-seg{display:flex;gap:6px;margin-top:16px;background:var(--lip-line2);padding:4px;border-radius:999px}',
      '.lid-segb{flex:1;min-height:44px;border-radius:999px;border:0;background:none;font-family:inherit;font-size:13px;font-weight:600;line-height:1;color:var(--lip-ink50);cursor:pointer}',
      '.lid-segb[aria-pressed="true"]{background:#fff;color:var(--lip-ink);box-shadow:var(--lip-sh)}',
      '.lid-txt{margin-top:14px;font-size:14px;line-height:1.55;white-space:pre-line;word-break:break-word;background:#F7F9FC;border-radius:14px;padding:14px 15px;max-height:260px;overflow-y:auto;-webkit-overflow-scrolling:touch;color:var(--lip-ink)}',
      '.lid-h{display:block;font-size:12.5px;font-weight:700;color:var(--lip-ink50);margin:18px 0 7px}',
      '.lid-vis{margin:0;font-size:13px;line-height:1.5;color:var(--lip-ink70)}',
      '.lid-pills{display:flex;gap:8px}',
      '.lid-pill{flex:1;min-height:44px;border-radius:12px;border:1.5px solid rgba(16,19,28,.12);background:#fff;font-family:inherit;font-size:13.5px;font-weight:600;line-height:1;color:var(--lip-ink);box-shadow:var(--lip-sh);cursor:pointer}',
      '.lid-pill[aria-pressed="true"]{background:var(--lip-blue);border-color:transparent;color:#fff;box-shadow:0 4px 14px rgba(0,87,255,.24)}',
      '.lid-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}',
      '.lid-actions .lip-btn{min-height:44px;justify-content:center}',
      '.lid-row2{display:flex;gap:10px}',
      '.lid-row2 .lip-btn{flex:1}',
      '.lid-ok{background:#1E9E6A;border-color:#1E9E6A;color:#fff;font-weight:700}',
      '.lid-ok:hover{background:#178556;color:#fff}',
      '.lid-skip{min-height:44px;background:none;border:0;color:var(--lip-ink50);font-family:inherit;font-size:13px;font-weight:500;line-height:1;text-decoration:underline;cursor:pointer}',
      '.lid-plus{margin-top:14px;border-top:1px solid var(--lip-line2);padding-top:6px}',
      '.lid-plus>summary{min-height:44px;display:flex;align-items:center;font-size:13.5px;font-weight:700;color:var(--lip-ink70);cursor:pointer}',
      '.lid-plus[open]>summary{margin-bottom:10px}',

      '.lip-fmt{font-size:11.5px;font-weight:600;color:var(--lip-ink35);padding:3px 9px;border-radius:20px;background:#f1f4f8}',
      '.lip-apercu img{max-width:100%;max-height:300px;border-radius:11px;display:block;margin-bottom:10px;cursor:zoom-in;box-shadow:0 2px 12px rgba(10,14,26,.12)}',
      '.lip-imgacts{display:flex;gap:8px;flex-wrap:wrap}',
      '.lip-swatch{display:flex;gap:12px;align-items:flex-start;margin-bottom:11px;font-size:12.5px;line-height:1.5;color:var(--lip-ink70)}',
      '.lip-swatch span{width:42px;height:42px;border-radius:9px;flex:none;border:1px solid rgba(10,14,26,.14)}',
      '.lip-swatch code{font-size:11.5px;color:var(--lip-ink35)}',
      '.lip-aptabs{display:flex;gap:6px;background:var(--lip-line2);border-radius:10px;padding:4px;margin-bottom:9px;flex-wrap:wrap}',
      '.lip-apbtn{flex:1;min-width:104px;min-height:38px;padding:0 12px;border-radius:8px;border:0;background:transparent;font:700 12.5px/1.25 inherit;color:var(--lip-ink50);cursor:pointer;transition:all .15s var(--lip-ease)}',
      '.lip-apbtn.on{background:var(--lip-panel);color:var(--lip-ink);box-shadow:var(--lip-sh)}',
      '.lip-apaide{font-size:12.5px;line-height:1.55;color:var(--lip-ink35);margin-bottom:10px}',
      '.lip-prompt{background:#12122e;color:#e7e9f5;border-radius:11px;padding:13px 15px;font:400 12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;max-height:210px;overflow:auto;-webkit-overflow-scrolling:touch}',

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
      '.lid-resume{font-size:21px}',
      '.lid-tabs{display:flex}',
      '.lid-board{display:block;margin-top:4px}',
      '.lid-col{display:none}',
      '.lid-col.active{display:flex}',
      '.lid-colh{display:none}',
      '.lid-pick{width:44px}',
      /* flex:1 laissait 28 px au champ de recherche derrière les deux listes
         déroulantes : sur mobile il prend sa propre ligne, en entier. */
      '.lip-inp{flex:1 1 100%;min-width:0;width:100%}',
      '.lip-sel{flex:1 1 44%;min-width:0}',
      '.lip-drh,.lip-drb,.lip-drf{padding-left:16px;padding-right:16px}',
      '.lip-btn,.lip-close,.lip-apbtn,.lid-pick{min-height:44px}',
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
  function meta() { return window.LI_PLAN_META || {}; }

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

  function vide() { return { sujet: 0, statut: 'attente', variante: null, visuel: null, commentaire: '', image_path: '', resp: '', publie: false }; }
  function copieEtat(e) { return { sujet: e.sujet || 0, statut: e.statut || 'attente', variante: e.variante, visuel: e.visuel,
    commentaire: e.commentaire || '', image_path: e.image_path || '', resp: e.resp || '', publie: !!e.publie }; }
  // « Qui s'en occupe » n'a pas de colonne : il voyage en tête du commentaire
  // (« @pauline| … ») et en est retiré à la lecture. Aucun changement de table.
  var RX_RESP = /^@(pauline|will)\|\s?/;
  // « Publié » non plus : il suit, sous la forme « #publie| ». Une ancienne version
  // de l'écran le laisse intact dans le commentaire au lieu de le perdre.
  var RX_PUB = /^#publie\|\s?/;
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
          commentaire: String(x.commentaire || '').replace(RX_RESP, '').replace(RX_PUB, ''), resp: lireResp(x.commentaire),
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
      if (!(V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin')) { charge = false; return; }
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
      commentaire: (e.resp ? '@' + e.resp + '| ' : '') + (e.publie ? '#publie| ' : '') + (e.commentaire || ''), image_path: e.image_path || '',
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
    var a = approcheDe(apprCourante());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        function () { toast('Prompt « ' + a.label + ' » copié'); },
        function () { window.prompt('Copiez le prompt :', txt); });
    } else window.prompt('Copiez le prompt :', txt);
  };
  V2.lip.voirDA = function () {
    var d = da();
    if (!d) { chargerDA(); toast('Chargement de la direction artistique…'); return; }
    monter(daHtml());
  };
  function chargerDA() { charger('mkt-li-da-data.js', da).then(function (ok) { if (ok) monter(daHtml()); }); }

  function daHtml() {
    var d = da();
    var pastilles = d.palette.map(function (c) {
      return '<div class="lip-swatch"><span style="background:' + c.hex + '"></span>' +
        '<div><b>' + esc(c.nom) + '</b> <code>' + esc(c.hex) + '</code><br>' + esc(c.role) + '</div></div>';
    }).join('');
    var mesures = d.constat.map(function (c) {
      return '<div class="lip-srow" style="align-items:flex-start"><span class="lip-sk" style="min-width:92px">' + esc(c.k) + '</span>' +
        '<span style="flex:1;text-align:right"><b>' + esc(c.v) + '</b><br><span style="color:var(--lip-ink35);font-size:12px">' + esc(c.d) + '</span></span></div>';
    }).join('');
    var fam = d.approches.map(function (f) {
      return '<div class="lip-var" style="cursor:default"><div class="lip-vtop"><span class="lip-vton">' + esc(f.label) + '</span></div>' +
        '<div class="lip-vaide" style="font-style:normal;color:var(--lip-ink70);margin:0 0 9px">' + esc(f.aide) + '</div>' +
        '<div class="lip-prompt" style="max-height:240px">' + esc(f.tpl.replace('{SUJET}', '(le sujet du post s’insère ici)')) + '</div></div>';
    }).join('');
    var liste = function (a) { return '<ul style="margin:0;padding-left:19px;font-size:13.5px;line-height:1.65;color:var(--lip-ink70)">' +
      a.map(function (x) { return '<li style="margin-bottom:6px">' + esc(x) + '</li>'; }).join('') + '</ul>'; };
    return '<div class="lip-scrim" onclick="V2.lip.fermer()"></div>' +
      '<aside class="lip-dr" role="dialog" aria-modal="true" aria-label="Direction artistique image">' +
        '<div class="lip-drh"><div style="flex:1;min-width:0">' +
          '<div class="lip-eyebrow">Direction artistique · image</div>' +
          '<h2>Ce à quoi ressemblent nos visuels</h2>' +
          '<div class="lip-sub" style="margin-top:6px">Relevé sur ' + esc(d.corpus) + '.</div>' +
        '</div><button class="lip-close" onclick="V2.lip.fermer()" aria-label="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="lip-drb">' +
          '<div class="lip-field"><span class="lip-flab">Ce qui a été mesuré</span>' +
            '<div class="lip-scard" style="box-shadow:none">' + mesures + '</div></div>' +
          '<div class="lip-field"><span class="lip-flab">La palette</span>' + pastilles + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Trois approches</span>' + fam + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Les règles</span>' + liste(d.regles) + '</div>' +
          '<div class="lip-field"><span class="lip-flab">Ce qu’on évite</span>' + liste(d.aEviter) + '</div>' +
        '</div>' +
        '<div class="lip-drf"><span class="lip-spacer"></span>' +
          '<button class="lip-btn lip-btn-p" onclick="V2.lip.fermer()">Fermer</button></div>' +
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
  var MAX_IMG = 25 * 1024 * 1024;
  V2.lip.envoyerImage = function (input) {
    var f = input.files && input.files[0]; if (!f || !ouvert) return;
    var c = sb();
    if (!(c && c.storage)) { alert('Envoi impossible : vous n’êtes pas connecté à la base.\n\nReconnectez-vous, ou collez l’adresse d’une image déjà en ligne.'); input.value = ''; return; }
    if (!/^image\//.test(f.type)) { alert('Ce fichier n’est pas une image (' + (f.type || 'type inconnu') + ').\nFormats acceptés : JPEG, PNG, WebP, GIF, AVIF.'); input.value = ''; return; }
    if (f.size > MAX_IMG) { alert('Image trop lourde : ' + (f.size / 1048576).toFixed(1) + ' Mo.\nLa limite est de 25 Mo.'); input.value = ''; return; }
    ouvert.envoi = 'Envoi de « ' + f.name + ' » en cours…';
    redessineTiroir();
    var ext = (f.name.match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase();
    var base = f.name.replace(/\.[a-zA-Z0-9]+$/, '');
    if (base.normalize) base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    base = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'visuel';
    var chemin = 'linkedin/plan' + ouvert.n + '_' + Date.now() + '_' + base + ext;
    c.storage.from('marketing-media').upload(chemin, f, { upsert: true, contentType: f.type })
      .then(function (r) {
        ouvert.envoi = '';
        if (r && r.error) {
          var m = r.error.message || 'raison inconnue';
          if (/bucket/i.test(m)) m = 'l’espace de stockage est introuvable côté serveur';
          else if (/policy|permission|unauthor|403/i.test(m)) m = 'votre compte n’a pas le droit d’écrire ici';
          else if (/size|large|413/i.test(m)) m = 'le fichier est trop lourd pour le serveur';
          alert('L’image n’a pas été envoyée : ' + m + '.'); redessineTiroir(); return;
        }
        ouvert.e.image_path = chemin;
        redessineTiroir();
        toast('Visuel ajouté — pensez à enregistrer');
      })
      .catch(function (err) {
        ouvert.envoi = '';
        alert('L’image n’a pas été envoyée : ' + String(err.message || err).slice(0, 140) + '.');
        redessineTiroir();
      });
  };
  V2.lip.retirerImage = function () { if (ouvert) { ouvert.e.image_path = ''; redessineTiroir(); } };
  V2.lip.zoomTiroir = function () {
    if (ouvert && ouvert.e.image_path && V2.li && V2.li.zoom) V2.li.zoom(urlImage(ouvert.e.image_path), ouvert.p.titre);
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
    var id = esc(String(x.id));
    return '<article class="lid-card" tabindex="0" role="button" aria-label="Ouvrir le post libre du ' + esc(dateCourte(new Date(x.date))) + '" ' +
      'onclick="V2.lip.ouvrirLibre(\'' + id + '\')" ' +
      'onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();V2.lip.ouvrirLibre(\'' + id + '\')}">' +
      '<div class="lid-main"><div class="lid-top"><span class="lid-date">' + esc(dateCourte(new Date(x.date))) + '</span>' +
        '<span class="lid-pil">Hors plan</span></div>' +
        '<p class="lid-title">' + esc(x.title || '(sans titre)') + '</p></div></article>';
  }
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

  function carte(p) {
    var e = etat(p.n), pl = pilier(p.p);
    var S = sujetsDe(p), cur = S[sujetEff(p, e)] || S[0];
    var quand = dateCourte(new Date(p.d + 'T12:00:00'));
    var pied;
    if (e.resp) pied = '<span class="lid-av" title="' + esc(quiLabel(e.resp)) + '">' + esc(quiLabel(e.resp).charAt(0)) + '</span>';
    else if (moi !== 'both') pied = '<button class="lid-claim" onclick="event.stopPropagation();V2.lip.quiFait(' + p.n + ',\'' + moi + '\')">Je m’en occupe</button>';
    else pied = QUI.map(function (q) {
      return '<button class="lid-pick" aria-label="' + esc(q.label) + ' s’en occupe" onclick="event.stopPropagation();V2.lip.quiFait(' + p.n + ',\'' + q.k + '\')">' + esc(q.label.charAt(0)) + '</button>';
    }).join('');
    return '<article class="lid-card' + (e.statut === 'refuse' ? ' ecarte' : '') + '" tabindex="0" role="button" data-n="' + p.n + '" aria-label="Ouvrir le post du ' + esc(quand) + '" ' +
      'onclick="V2.lip.ouvrir(' + p.n + ')" onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();V2.lip.ouvrir(' + p.n + ')}">' +
      '<div class="lid-main"><div class="lid-top"><span class="lid-date">' + esc(quand) + '</span>' +
        '<span class="lid-pil"><span class="lid-dot" style="background:' + pl.color + '"></span>' + esc(pl.label) + '</span></div>' +
        '<p class="lid-title">' + esc(cur.titre) + '</p></div>' +
      '<div class="lid-foot">' + pied + '</div></article>';
  }

  function renderPlan(root) {
    if (!plan()) {
      root.innerHTML = coquille('<div class="lip-load">Chargement du rétro-planning…</div>');
      charger('mkt-li-plan-data.js', plan).then(function (ok) {
        if (V2.route && V2.route.name !== 'marketing') return;   // 11/09/2026 : l'écran a pu changer pendant l'attente
        if (!ok) { root.innerHTML = coquille('<div class="lip-empty">Le fichier du rétro-planning n\'a pas pu être chargé.</div>'); return; }
        redessine();
      });
      return;
    }
    if (!charge) {
      charge = true;
      chargerEtats().then(function () { redessine(); });
      // la DA alimente l'encart « prompt » de chaque fiche : on la charge d'emblée
      charger('mkt-li-da-data.js', da).then(function (ok) { if (ok) redessine(); });
      // les 2 sujets supplémentaires par créneau : fichier lourd, chargé à côté,
      // sans bloquer l'affichage. Tant qu'il n'est pas là, un seul sujet.
      charger('mkt-li-plan-alt-data.js', alts).then(function (ok) {
        if (ok) { redessine(); if (ouvert) redessineTiroir(); }
      });
    }
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
    var nomMoi = quiLabel(moi);
    var parts = [];
    if (col.choisir.length) parts.push('<b>' + col.choisir.length + '</b> post' + (col.choisir.length > 1 ? 's' : '') + ' à préparer');
    if (col.pret.length) parts.push('<b>' + col.pret.length + '</b> à publier');
    var tete = '<div class="lid-who"><div class="lid-people" role="group" aria-label="Choisir qui vous êtes">' +
      QUI.map(function (q) {
        return '<button type="button" class="lid-wbtn" aria-pressed="' + (moi === q.k) + '" onclick="V2.lip.setMoi(\'' + q.k + '\')">' +
          '<span class="lid-wav">' + esc(q.label.charAt(0)) + '</span><span class="lid-wlab">' + esc(q.label) + '</span></button>';
      }).join('') + '</div>' +
      '<button type="button" class="lid-both" aria-pressed="' + (moi === 'both') + '" onclick="V2.lip.setMoi(\'both\')">Nous deux</button></div>' +
      '<p class="lid-resume">' + (parts.length ? parts.join(', ') : (nomMoi ? 'Rien n’attend ' + esc(nomMoi) + ' pour l’instant' : 'Rien à faire pour l’instant')) + '</p>' +
      '<p class="lid-rsub">' + (nomMoi ? 'Ce que ' + esc(nomMoi) + ' a à faire sur les ' + nbSem + ' prochaines semaines' : 'Ce que vous avez à faire, à deux, sur les ' + nbSem + ' prochaines semaines') +
        (backend === 'local' ? ' · ⚠️ choix gardés sur cet ordinateur, pas partagés' : '') + '</p>';
    var onglets = '<div class="lid-tabs" role="tablist" aria-label="Étape">' + ETAPES.map(function (s) {
      return '<button class="lid-tab" role="tab" aria-selected="' + (etape === s.k) + '" onclick="V2.lip.setEtape(\'' + s.k + '\')">' + esc(s.court) + ' ' + col[s.k].length + '</button>';
    }).join('') + '</div>';
    var tableau = '<div class="lid-board">' + ETAPES.map(function (s) {
      var L = col[s.k].sort(function (a, b) { return a.cle < b.cle ? -1 : (a.cle > b.cle ? 1 : 0); });
      return '<section class="lid-col ' + s.k + (etape === s.k ? ' active' : '') + '" data-etape="' + s.k + '">' +
        '<div class="lid-colh"><span class="lid-cnt">' + L.length + '</span><span class="lid-colt">' + esc(s.label) + '</span></div>' +
        '<div class="lid-list">' + (L.length ? L.map(function (x) { return x.html; }).join('') : '<p class="lid-empty">' + esc(s.vide) + '</p>') + '</div></section>';
    }).join('') + '</div>';
    var suite = fin < dernier ? '<button type="button" class="lid-more" onclick="V2.lip.plusSemaines()">Voir les semaines suivantes</button>' : '';
    var regle = '<div class="lip-note" style="margin:30px 0 4px"><b>Notre ligne : un acteur de santé bienveillant.</b><br>' +
      '<b>Oui</b> — ' + esc(REGLE_OUI) + '<br><b>Non</b> — ' + esc(REGLE_NON) + '</div>';
    var pied = '<div class="lip-tools" style="margin-top:14px">' +
      (passes ? '<button class="lip-btn" onclick="V2.lip.togglePasse()">' + (voirPasse ? 'Masquer les semaines passées' : 'Voir les semaines passées') + '</button>' : '') +
      (ecartes ? '<button class="lip-btn" onclick="V2.lip.toggleEcartes()">' + (voirEcartes ? 'Masquer les posts écartés' : 'Revoir ' + (ecartes > 1 ? 'les ' + ecartes + ' posts écartés' : 'le post écarté')) + '</button>' : '') +
      '<span class="lip-spacer"></span>' +
      '<button class="lip-btn" onclick="V2.lip.nouveauLibre()">' + ICO('plus', 16, 2.2) + 'Nouveau post libre</button>' +
      '<button class="lip-btn" onclick="V2.lip.voirDA()">' + ICO('spark', 16) + 'Notre DA image</button>' +
      '<button class="lip-btn" onclick="V2.lip.exportCsv()">' + ICO('download', 16, 2) + 'Export CSV</button></div>';
    root.innerHTML = coquille(tete + onglets + tableau + suite + regle + pied);
  }

  function coquille(corps) {
    var m = meta();
    var seg = (V2.mktLinkedin && V2.mktLinkedin.viewSeg) ? V2.mktLinkedin.viewSeg() : '';
    var titre = vue === 'veille' ? 'Veille secteur — 12 mois' : 'Posts LinkedIn — à deux';
    var sous = vue === 'veille'
      ? 'Ce que publient CERP, OCP, Sagitta Pharma et nous. ' + ((V() && V().nbPosts) || '—') + ' posts relevés, réactions et commentaires compris.'
      : '1 à ' + MAX_SEM + ' posts par semaine, pas plus · ' + (m.fenetre || '');
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

  function redessineTiroir() {
    if (!ouvert) return;
    var corps = document.querySelector('#lip-drawer .lip-drb');
    var y = corps ? corps.scrollTop : 0;
    monter(drawerHtml(), true);
    var c2 = document.querySelector('#lip-drawer .lip-drb');
    if (c2) c2.scrollTop = y;
  }

  // La version du texte affichée : celle choisie, sinon « Humain », sinon la première.
  var TONS = [['humain', 'Humain'], ['peda', 'Pédagogique'], ['court', 'Court']];
  function varEff(cur, e) {
    if (e.variante !== null && e.variante !== undefined && cur.t[e.variante]) return e.variante;
    for (var i = 0; i < cur.t.length; i++) if (cur.t[i].ton === 'humain') return i;
    return 0;
  }

  function drawerHtml() {
    var p = ouvert.p, e = ouvert.e, pl = pilier(p.p);
    // Le créneau donne la date et le pilier ; le sujet retenu donne tout le reste.
    var S = sujetsDe(p), si = sujetEff(p, e), cur = S[si] || S[0];
    var d = new Date(p.d + 'T12:00:00');
    var quand = JOURS[(d.getDay() + 6) % 7] + ' ' + jj(d.getDate()) + ' ' + MOIS[d.getMonth()] + ' · ' + p.h.replace(':', ' h ');
    var vi = varEff(cur, e), garde = etat(ouvert.n);
    var dejaRetenu = garde.statut === 'valide' && (garde.sujet || 0) === si && garde.variante === vi;

    var tuiles = S.map(function (c, i) {
      if (!sujetPermis(p, i)) return '';   // trop « métier » : voir SUJETS_METIER
      return '<button type="button" class="lid-tuile" aria-pressed="' + (si === i) + '" onclick="V2.lip.setChamp(\'sujet\',' + i + ')">' +
        '<span class="lid-tl">' + String.fromCharCode(65 + i) + '</span><span class="lid-tt">' + esc(c.titre) + '</span></button>';
    }).join('');

    var seg = TONS.map(function (t) {
      for (var i = 0; i < cur.t.length; i++) if (cur.t[i].ton === t[0]) {
        return '<button type="button" class="lid-segb" aria-pressed="' + (vi === i) + '" onclick="V2.lip.setChamp(\'variante\',' + i + ')">' + t[1] + '</button>';
      }
      return '';
    }).join('');

    var vis = cur.v.map(function (v, i) {
      return '<div class="lip-var' + (e.visuel === i ? ' on' : '') + '" onclick="V2.lip.setChamp(\'visuel\',' + i + ')">' +
        '<div class="lip-vtop"><span class="lip-radio"></span><span class="lip-vton">Visuel ' + (i + 1) + '</span></div>' +
        '<div class="lip-vtxt">' + esc(v) + '</div></div>';
    }).join('');

    return '<div class="lip-scrim" onclick="V2.lip.fermer()"></div>' +
      '<aside class="lip-dr" role="dialog" aria-modal="true" aria-label="Post du ' + esc(quand) + '">' +
        '<div class="lip-drh"><div style="flex:1;min-width:0">' +
          '<div class="lid-pil" style="max-width:none;font-weight:600"><span class="lid-dot" style="background:' + pl.color + '"></span>' + esc(pl.label) + '</div>' +
          '<h2>' + esc(quand) + '</h2>' +
        '</div><button class="lip-close" onclick="V2.lip.fermer()" aria-label="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="lip-drb">' +
          '<div class="lid-tuiles">' + tuiles + '</div>' +
          (alts() ? '' : '<div class="lip-hint">Chargement des autres sujets proposés pour cette date…</div>') +
          '<p class="lid-angle">' + esc(cur.angle) + '</p>' +
          '<div class="lid-seg" role="group" aria-label="Version du texte">' + seg + '</div>' +
          '<div class="lid-txt">' + esc(cur.t[vi] ? cur.t[vi].txt : '') + '</div>' +
          '<span class="lid-h">Idée de visuel</span><p class="lid-vis">' + esc(cur.v[e.visuel === null ? 0 : e.visuel] || cur.v[0] || '') + '</p>' +
          '<span class="lid-h">Qui s’en occupe ?</span><div class="lid-pills">' +
            QUI.map(function (q) {
              return '<button type="button" class="lid-pill" aria-pressed="' + (e.resp === q.k) + '" onclick="V2.lip.quiTiroir(\'' + q.k + '\')">' + esc(q.label) + '</button>';
            }).join('') + '</div>' +
          '<div class="lid-actions">' +
            (e.publie ? '' : '<button type="button" class="lip-btn lip-btn-p" onclick="V2.lip.retenir()">' + (dejaRetenu ? 'Texte retenu' : (garde.statut === 'valide' ? 'Texte retenu — mettre à jour' : 'Retenir ce texte')) + '</button>') +
            '<div class="lid-row2"><button type="button" class="lip-btn" onclick="V2.lip.copier()">' + ICO('fiche', 16, 1.8) + 'Copier le texte</button>' +
              (e.publie
                ? '<button type="button" class="lip-btn" onclick="V2.lip.marquerPublie(false)">Annuler « publié »</button>'
                : '<button type="button" class="lip-btn lid-ok" onclick="V2.lip.marquerPublie(true)">' + ICO('check', 17, 2.4) + 'Marquer comme publié</button>') + '</div>' +
            (e.publie ? '' : (garde.statut === 'refuse'
              ? '<button type="button" class="lid-skip" onclick="V2.lip.ecarter(false)">Remettre ce post dans la liste</button>'
              : '<button type="button" class="lid-skip" onclick="V2.lip.ecarter(true)">Pas cette semaine</button>')) +
          '</div>' +
          '<details class="lid-plus"' + (ouvert.plus ? ' open' : '') + ' ontoggle="V2.lip.plusOuvert(this.open)"><summary>Visuel, image et commentaire</summary>' +
          '<div class="lip-field"><span class="lip-flab">Choix du visuel — ' + cur.v.length + ' propositions</span>' + vis + '</div>' +
          (function () {
            var d = da();
            if (!d) return '<div class="lip-field"><span class="lip-flab">Prompt pour le générateur d’images</span>' +
                            '<div class="lip-hint">Chargement de la direction artistique…</div></div>';
            var iv = (e.visuel === null) ? 0 : e.visuel;
            var k = apprCourante();
            var a = approcheDe(k);
            var pv = cur.v;
            var onglets = d.approches.map(function (x) {
              return '<button class="lip-apbtn' + (x.k === k ? ' on' : '') + '" onclick="V2.lip.setApproche(\'' + x.k + '\')">' + esc(x.label) + '</button>';
            }).join('');
            var mots = motsAPoser((pv && pv[iv]) || '');
            return '<div class="lip-field"><span class="lip-flab">Prompt pour le générateur d’images — 3 approches</span>' +
              '<div class="lip-aptabs">' + onglets + '</div>' +
              '<div class="lip-apaide">' + esc(a.aide) + '</div>' +
              '<div class="lip-prompt">' + esc(promptPour(cur, iv, k)) + '</div>' +
              '<div class="lip-imgacts" style="margin-top:9px">' +
                '<button class="lip-btn lip-btn-p" onclick="V2.lip.copierPrompt()">Copier ce prompt</button>' +
                '<button class="lip-btn" onclick="V2.lip.voirDA()">Voir notre DA</button></div>' +
              (mots.length ? '<div class="lip-note" style="margin-top:9px"><b>Texte à poser ensuite</b>, dans Canva ou équivalent — il n’est volontairement dans aucun des trois prompts :<br>' +
                mots.map(function (x) { return '« ' + esc(x) + ' »'; }).join('<br>') + '</div>' : '') +
              '<div class="lip-hint">Les trois restent dans notre direction artistique : même fond crème, mêmes couleurs, même format. ' +
                'Aucun ne fait écrire de texte par le générateur — les accents français sont ratés, la phrase se pose après.</div>' +
            '</div>';
          })() +
          '<div class="lip-field"><span class="lip-flab">Visuel du post</span>' +
            (ouvert.envoi
              ? '<div class="lip-note">' + esc(ouvert.envoi) + '</div>'
              : e.image_path
                ? '<div class="lip-apercu"><img src="' + esc(urlImage(e.image_path)) + '" alt="Visuel du post" title="Cliquez pour voir en grand" onclick="V2.lip.zoomTiroir()">' +
                  '<div class="lip-imgacts"><button class="lip-btn" onclick="V2.lip.zoomTiroir()">Voir en grand</button>' +
                  '<button class="lip-btn" onclick="V2.lip.retirerImage()">Retirer le visuel</button></div></div>'
                : '<label class="lip-btn">Envoyer une image' +
                  '<input type="file" accept="image/*" style="display:none" onchange="V2.lip.envoyerImage(this)"></label>' +
                  '<div class="lip-hint">JPEG, PNG, WebP, GIF ou AVIF — 25 Mo maximum. L’image est partagée avec l’équipe.</div>') +
          '</div>' +
          '<div class="lip-field"><span class="lip-flab">Commentaire</span>' +
            '<textarea class="lip-ta" placeholder="Ce qu\'il faut changer, préciser, éviter…" oninput="V2.lip.setChamp(\'commentaire\',this.value)">' + esc(e.commentaire || '') + '</textarea>' +
            '<div class="lip-hint">Visible par toute l\'équipe.</div>' +
            '<div class="lip-tags">Hashtags prévus : ' + esc(cur.tags) + '</div>' +
          '</div>' +
          '<div class="lip-imgacts"><button class="lip-btn" onclick="V2.lip.publier()">' + ICO('spark', 16) + 'Ouvrir LinkedIn</button>' +
            '<button class="lip-btn lip-btn-p" onclick="V2.lip.enregistrer()">' + ICO('check', 17, 2.4) + 'Enregistrer</button></div>' +
          '</details>' +
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
        if (V2.route && V2.route.name !== 'marketing') return;   // 11/09/2026 : l'écran a pu changer pendant l'attente
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
  V2.lip.plusOuvert = function (o) { if (ouvert) ouvert.plus = !!o; };
  // « Qui s'en occupe » depuis la fiche : partagé tout de suite, sans emporter
  // le sujet ou le texte encore à l'essai dans la fiche.
  V2.lip.quiTiroir = function (k) {
    if (!ouvert) return;
    var v = (ouvert.e.resp === k) ? '' : k, s = copieEtat(etat(ouvert.n));
    ouvert.e.resp = v; s.resp = v; s.sujet = sujetEff(ouvert.p, s);
    enregistrer(ouvert.n, s).then(function () { redessineTiroir(); redessine(); if (v) toast(quiLabel(v) + ' s’en occupe'); });
  };
  function tropCetteSemaine() {
    return etat(ouvert.n).statut !== 'valide' && retenusSemaine(lundiDe(ouvert.p.d)) >= MAX_SEM;
  }
  function figerChoix() {
    var e = ouvert.e, cur = sujetOuvert();
    e.sujet = sujetEff(ouvert.p, e); e.variante = varEff(cur, e); e.statut = 'valide';
    return e;
  }
  V2.lip.retenir = function () {
    if (!ouvert) return;
    if (tropCetteSemaine()) { toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); return; }
    enregistrer(ouvert.n, copieEtat(figerChoix())).then(function () { toast('Texte retenu'); redessineTiroir(); redessine(); });
  };
  V2.lip.marquerPublie = function (oui) {
    if (!ouvert) return;
    if (oui && tropCetteSemaine()) { toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); return; }
    var e = oui ? figerChoix() : ouvert.e;
    e.publie = !!oui;
    enregistrer(ouvert.n, copieEtat(e)).then(function () { toast(oui ? 'Marqué comme publié' : 'Remis dans « Prêt à publier »'); fermer(); redessine(); });
  };
  V2.lip.ecarter = function (oui) {
    if (!ouvert) return;
    var s = copieEtat(etat(ouvert.n));
    s.statut = oui ? 'refuse' : 'attente'; s.sujet = sujetEff(ouvert.p, s);
    enregistrer(ouvert.n, s).then(function () { toast(oui ? 'Post écarté pour cette semaine' : 'Post remis dans la liste'); fermer(); redessine(); });
  };

  V2.lip.ouvrir = function (n) {
    var P = plan(); if (!P) return;
    var p = null; for (var i = 0; i < P.length; i++) if (P[i].n === n) { p = P[i]; break; }
    if (!p) return;
    var e = etat(n);
    apprVue = null;
    ouvert = { n: n, p: p, envoi: '', e: copieEtat(e) };
    ouvert.e.sujet = sujetEff(p, e);
    monter(drawerHtml());
  };
  V2.lip.fermer = fermer;
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
    redessineTiroir();   // conserve la position de défilement
  };
  V2.lip.enregistrer = function () {
    if (!ouvert) return;
    var n = ouvert.n, e = ouvert.e;
    if (e.statut === 'valide' && etat(n).statut !== 'valide' && retenusSemaine(lundiDe(ouvert.p.d)) >= MAX_SEM) {
      toast('Déjà ' + MAX_SEM + ' posts retenus cette semaine — retirez-en un d’abord', 'error'); return;
    }
    enregistrer(n, e).then(function () {
      if (backend === 'supabase') toast('Décision enregistrée et partagée avec l\'équipe');
      fermer(); redessine();
    });
  };
  V2.lip.copier = function () {
    if (!ouvert) return;
    var cur = sujetOuvert(), i = varEff(cur, ouvert.e);
    if (!cur.t[i]) return;
    var txt = cur.t[i].txt;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('Texte copié'); }, function () { window.prompt('Copiez le texte :', txt); });
    } else window.prompt('Copiez le texte :', txt);
  };
  V2.lip.publier = function () {
    if (!ouvert) return;
    var cur = sujetOuvert(), i = varEff(cur, ouvert.e);
    if (!cur.t[i]) return;
    if (ouvert.e.statut !== 'valide' && !confirm('Ce post n’est pas encore retenu.\n\nL’ouvrir quand même dans LinkedIn ?')) return;
    var txt = cur.t[i].txt;
    var suite = function () {
      window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
      if (ouvert && ouvert.e.image_path) {
        // LinkedIn ne peut pas recevoir l'image automatiquement : on l'ouvre à côté
        // pour qu'elle soit sous la main au moment de la glisser dans le post.
        window.open(urlImage(ouvert.e.image_path), '_blank');
      }
      toast('Texte copié. Collez-le dans LinkedIn, puis ajoutez le visuel.');
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
    var l = [['N','Date','Heure','Pilier','Sujet retenu','Format','Titre','Angle','Statut','Qui','Texte choisi','Visuel choisi','Commentaire','Hashtags','Texte 1','Texte 2','Texte 3','Visuel 1','Visuel 2','Autres sujets proposés'].map(q).join(';')];
    P.filter(visible).forEach(function (p) {
      var e = etat(p.n), S = sujetsDe(p), si = sujetEff(p, e), c = S[si] || S[0];
      var autres = S.filter(function (x, i) { return i !== si && sujetPermis(p, i); })
        .map(function (x, i) { return x.titre; }).join(' | ');
      l.push([p.n, p.d, p.h, pilier(p.p).label, 'Sujet ' + String.fromCharCode(65 + si), c.f, c.titre, c.angle, e.publie ? 'Publié' : statut(e.statut).label, quiLabel(e.resp),
        e.variante === null ? '' : 'Texte ' + (e.variante + 1),
        e.visuel === null ? '' : 'Visuel ' + (e.visuel + 1),
        e.commentaire || '', c.tags,
        c.t[0] ? c.t[0].txt : '', c.t[1] ? c.t[1].txt : '', c.t[2] ? c.t[2].txt : '',
        c.v[0] || '', c.v[1] || '', autres].map(q).join(';'));
    });
    var blob = new Blob(['﻿' + l.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'retroplanning-linkedin-12-mois.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
