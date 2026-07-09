/* CRM V2 · Sous-module "Rétroplanning LinkedIn" (pages.marketing?linkedin)
   100% client-side. Supabase (V2.sb) primaire, repli localStorage.
   UI CLAIRE — Direction A (File) + calendrier B + pipeline C + liste.
   Safari-safe : pas de background-clip:text, pas de backdrop-filter,
   pas de filter:blur, pas de color-mix. Reliefs = box-shadow + rgba. */
(function () {
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };

  (function injectCss() {
    if (document.getElementById('li-css')) return;
    var s = document.createElement('style'); s.id = 'li-css';
    s.textContent = [
      /* ── tokens locaux (clair) ── */
      '#v2-root .li-wrap{--li-blue:var(--ip-blue);--li-blue600:#0047d6;--li-blue050:#eef3ff;--li-blue100:#dbe6ff;',
      '--li-orange:#F39A1B;--li-ink:var(--ip-ink);--li-ink70:#3a4152;--li-ink50:#6b7280;--li-ink35:#9aa1ae;',
      '--li-bg:#F8FAFC;--li-panel:#fff;--li-line:#E6E9F0;--li-line2:#eef1f6;',
      '--li-sh-sm:0 1px 2px rgba(10,14,26,.05),0 1px 3px rgba(10,14,26,.05);',
      '--li-sh-md:0 6px 20px rgba(10,14,26,.08),0 2px 6px rgba(10,14,26,.05);',
      '--li-sh-lg:0 24px 60px rgba(10,14,26,.18),0 6px 18px rgba(10,14,26,.10);',
      '--li-ease:cubic-bezier(.22,.61,.36,1);',
      'max-width:1200px;margin:0 auto;padding:8px 22px 70px;color:var(--li-ink)}',

      /* ── toolbar ── */
      '.li-topbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:6px 0 4px}',
      '.li-title-wrap{margin-right:4px}',
      '.li-h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.li-sub{font-size:13px;color:var(--li-ink50);margin-top:2px}',
      '.li-mnav{display:flex;align-items:center;gap:4px}',
      '.li-nav{width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--li-line);background:var(--li-panel);color:var(--li-ink70);cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-nav:hover{background:var(--li-bg);color:var(--li-ink)}',
      '.li-today{height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--li-line);background:var(--li-panel);font:600 13.5px/1 inherit;color:var(--li-ink70);cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-today:hover{background:var(--li-bg);color:var(--li-ink)}',
      '.li-spacer{flex:1}',
      '.li-seg{display:inline-flex;background:var(--li-line2);border-radius:10px;padding:3px;gap:2px}',
      '.li-seg button{padding:6px 13px;border-radius:8px;border:0;background:transparent;font:600 13px/1 inherit;color:var(--li-ink50);cursor:pointer;transition:all .15s var(--li-ease);display:inline-flex;align-items:center;gap:6px}',
      '.li-seg button.on{background:var(--li-panel);color:var(--li-ink);box-shadow:var(--li-sh-sm)}',
      '.li-segbadge{background:var(--li-orange);color:#fff;font:800 10px/1 inherit;padding:2px 6px;border-radius:20px;min-width:16px;text-align:center}',

      /* ── buttons ── */
      '.li-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 15px;border-radius:10px;border:1px solid var(--li-line);background:var(--li-panel);font:600 13.5px/1 inherit;color:var(--li-ink70);cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-btn:hover{background:var(--li-bg);color:var(--li-ink)}',
      '.li-btn svg{width:16px;height:16px}',
      '.li-btn-primary{background:var(--li-blue);border-color:var(--li-blue);color:#fff;font-weight:700;box-shadow:0 4px 14px rgba(0,87,255,.26)}',
      '.li-btn-primary:hover{background:var(--li-blue600);color:#fff;box-shadow:0 6px 20px rgba(0,87,255,.34);transform:translateY(-1px)}',
      '.li-btn-strat{border-color:var(--li-blue100);color:var(--li-blue);background:var(--li-blue050)}',
      '.li-btn-strat:hover{background:var(--li-blue100);color:var(--li-blue)}',
      '.li-full{width:100%;justify-content:center}',

      /* ── filter row ── */
      '.li-toolrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 4px}',
      '.li-toolsep{width:1px;height:20px;background:var(--li-line);margin:0 3px}',
      '.li-flabel{font-size:12px;color:var(--li-ink35);font-weight:600;margin-right:2px}',
      '.li-chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:20px;border:1px solid var(--li-line);background:var(--li-panel);font:600 12.5px/1 inherit;color:var(--li-ink70);cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-chip:hover{border-color:#d3dae4}',
      '.li-chip .li-cdot{width:9px;height:9px;border-radius:50%;flex:none}',
      '.li-chip.li-off{opacity:.4}',
      '.li-statsel{height:30px;padding:0 30px 0 12px;border-radius:20px;border:1px solid var(--li-line);background:var(--li-panel);font:600 12.5px/1 inherit;color:var(--li-ink70);cursor:pointer;-webkit-appearance:none;appearance:none;',
      'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>");background-repeat:no-repeat;background-position:right 9px center}',

      /* ── status dot marker ── */
      '.li-sd{width:13px;height:13px;border-radius:50%;flex:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center}',
      '.li-sd-ok{color:#00B37A}',

      /* ── QUEUE (Direction A) ── */
      '.li-workspace{display:grid;grid-template-columns:1fr 320px;gap:22px;align-items:start;margin-top:16px}',
      '.li-qcol{min-width:0}',
      '.li-weekcard{background:var(--li-panel);border:1px solid var(--li-line);border-radius:16px;box-shadow:var(--li-sh-sm);overflow:hidden;margin-bottom:22px}',
      '.li-weekhd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--li-line2)}',
      '.li-weekhd h3{margin:0;font-size:14px;font-weight:700}',
      '.li-wrng{font-size:12.5px;color:var(--li-ink50)}',
      '.li-weekgrid{display:grid;grid-template-columns:repeat(7,1fr)}',
      '.li-wday{border-right:1px solid var(--li-line2);min-height:118px;padding:9px 8px;position:relative;transition:background .15s}',
      '.li-wday:last-child{border-right:none}',
      '.li-wday:hover{background:#fbfcfe}',
      '.li-wtoday{background:var(--li-blue050)}',
      '.li-wdtop{display:flex;align-items:baseline;gap:5px;margin-bottom:8px}',
      '.li-wdname{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--li-ink35)}',
      '.li-wtoday .li-wdname,.li-wtoday .li-wdnum{color:var(--li-blue)}',
      '.li-wdnum{font-size:14px;font-weight:700;color:var(--li-ink70)}',
      '.li-wpill{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border-radius:8px;padding:6px 8px;margin-bottom:5px;border:0;border-left:3px solid var(--pc,#ccc);background:var(--pcbg,#f2f4f8);color:var(--li-ink);font:600 11px/1.25 inherit;cursor:pointer;overflow:hidden;transition:transform .12s var(--li-ease),box-shadow .12s}',
      '.li-wpill:hover{transform:translateX(1px);box-shadow:var(--li-sh-sm)}',
      '.li-wpt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}',
      '.li-addhere{position:absolute;bottom:7px;right:7px;width:22px;height:22px;border-radius:7px;border:1px dashed #cdd5df;background:transparent;color:var(--li-ink35);display:flex;align-items:center;justify-content:center;opacity:0;cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-wday:hover .li-addhere{opacity:1}',
      '.li-addhere:hover{background:var(--li-blue);color:#fff;border-color:var(--li-blue);border-style:solid}',

      '.li-qhead{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 12px}',
      '.li-qhead h2{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.li-count{font-size:12px;font-weight:700;color:var(--li-blue);background:var(--li-blue050);padding:3px 9px;border-radius:20px;margin-left:8px}',
      '.li-linkbtn{border:0;background:transparent;font:600 12.5px/1 inherit;color:var(--li-ink50);cursor:pointer}',
      '.li-linkbtn:hover{color:var(--li-blue)}',
      '.li-qday{margin-bottom:8px}',
      '.li-qlabel{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:var(--li-ink50);text-transform:uppercase;letter-spacing:.04em;padding:16px 2px 10px}',
      '.li-qlabel svg{width:15px;height:15px}',
      '.li-qline{flex:1;height:1px;background:var(--li-line)}',
      '.li-overdue{color:var(--li-orange)}',

      '.li-pcard{display:grid;grid-template-columns:54px 1fr auto;gap:16px;background:var(--li-panel);border:1px solid var(--li-line);border-radius:14px;padding:15px 16px;margin-bottom:11px;box-shadow:var(--li-sh-sm);position:relative;overflow:hidden;cursor:pointer;transition:box-shadow .18s var(--li-ease),border-color .18s,transform .18s var(--li-ease)}',
      '.li-pcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc,#ccc)}',
      '.li-pcard:hover{box-shadow:var(--li-sh-md);border-color:#dbe2ec;transform:translateY(-1px)}',
      '.li-pc-over{border-color:#f6d9ac}',
      '.li-pc-pub{opacity:.72;background:#fcfdfe}',
      '.li-pc-time{text-align:center;padding-top:2px}',
      '.li-hm{font-size:15px;font-weight:800;letter-spacing:-.02em}',
      '.li-dd{font-size:11px;font-weight:600;color:var(--li-ink35);margin-top:1px}',
      '.li-thumb{margin:9px auto 0;width:46px;height:46px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;background-size:cover;background-position:center}',
      '.li-pc-body{min-width:0}',
      '.li-pc-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}',
      '.li-ptag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:3px 9px 3px 8px;border-radius:20px}',
      '.li-ptag .li-cdot{width:8px;height:8px;border-radius:50%}',
      '.li-stag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--li-ink50);padding:3px 9px;border-radius:20px;background:#f1f4f8}',
      '.li-pc-title{font-size:15px;font-weight:700;letter-spacing:-.01em;margin:0 0 4px;line-height:1.3}',
      '.li-pc-exc{font-size:13px;color:var(--li-ink50);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.li-pc-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px;justify-content:center;white-space:nowrap}',
      '.li-mini-primary{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:9px;border:0;background:var(--li-blue);color:#fff;font:700 13px/1 inherit;cursor:pointer;box-shadow:0 3px 10px rgba(0,87,255,.24);transition:all .14s var(--li-ease)}',
      '.li-mini-primary:hover{background:var(--li-blue600);transform:translateY(-1px)}',
      '.li-mini-primary svg{width:15px;height:15px}',
      '.li-mini-link{border:0;background:transparent;font:600 12.5px/1 inherit;color:var(--li-ink50);padding:5px 7px;border-radius:7px;cursor:pointer;transition:all .14s}',
      '.li-mini-link:hover{color:var(--li-blue);background:var(--li-blue050)}',
      '.li-done{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#00B37A}',
      '.li-done svg{width:16px;height:16px}',

      /* ── sidebar ── */
      '.li-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:16px}',
      '.li-sidecard{background:var(--li-panel);border:1px solid var(--li-line);border-radius:16px;box-shadow:var(--li-sh-sm);padding:17px}',
      '.li-sidecard h4{margin:0 0 12px;font-size:13px;font-weight:800}',
      '.li-promo{border-color:var(--li-blue100);background:linear-gradient(180deg,#fbfcff,#ffffff)}',
      '.li-spark{width:40px;height:40px;border-radius:11px;margin-bottom:11px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#0057FF,#6b9bff);box-shadow:0 6px 16px rgba(0,87,255,.28)}',
      '.li-promo h4{margin:0 0 5px;font-size:15px}',
      '.li-promo p{margin:0 0 14px;font-size:13px;color:var(--li-ink50);line-height:1.5}',
      '.li-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
      '.li-stat{background:#f7f9fc;border:1px solid var(--li-line);border-radius:12px;padding:12px 8px;text-align:center}',
      '.li-stat b{display:block;font-size:22px;font-weight:800;letter-spacing:-.03em}',
      '.li-stat span{font-size:11px;color:var(--li-ink50);font-weight:600}',
      '.li-legrow{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:12.5px;font-weight:600;color:var(--li-ink70)}',
      '.li-legrow .li-sw{width:12px;height:12px;border-radius:4px;flex:none}',
      '.li-legnote{margin-top:12px;padding-top:12px;border-top:1px solid var(--li-line2);font-size:11.5px;color:var(--li-ink50);line-height:1.5}',
      '.li-legnote b{color:var(--li-ink70)}',
      '.li-empty{background:var(--li-panel);border:1px dashed var(--li-line);border-radius:14px;padding:34px 20px;text-align:center;color:var(--li-ink50);font-size:14px}',

      /* ── CALENDRIER (Direction B) ── */
      '.li-calcard{background:var(--li-panel);border:1px solid var(--li-line);border-radius:18px;box-shadow:var(--li-sh-md);overflow:hidden;margin-top:16px}',
      '.li-weekhead{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--li-line);background:#fbfcfe}',
      '.li-weekhead div{padding:12px 14px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--li-ink35)}',
      '.li-weekhead div:not(:last-child){border-right:1px solid var(--li-line)}',
      '.li-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:minmax(126px,auto)}',
      '.li-cell{border-right:1px solid var(--li-line);border-bottom:1px solid var(--li-line);padding:9px;position:relative;display:flex;flex-direction:column;gap:5px;min-width:0;cursor:pointer;transition:background .14s var(--li-ease)}',
      '.li-cell:nth-child(7n){border-right:none}',
      '.li-cell:hover{background:#f7f9fc}',
      '.li-cell:hover .li-addhint{opacity:1}',
      '.li-cell.li-out{background:#fbfcfe;cursor:default}',
      '.li-cell.li-today2{background:#f4f8ff}',
      '.li-daynum{font-size:12.5px;font-weight:700;color:var(--li-ink70);width:26px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;flex:none}',
      '.li-today2 .li-daynum{background:var(--li-blue);color:#fff;box-shadow:0 3px 8px rgba(0,87,255,.35)}',
      '.li-addhint{position:absolute;top:9px;right:9px;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--li-ink35);background:var(--li-panel);border:1px solid var(--li-line);opacity:0;cursor:pointer;transition:all .15s var(--li-ease)}',
      '.li-addhint:hover{color:var(--li-blue);border-color:var(--li-blue)}',
      '.li-cpill{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:5px 7px;border-radius:8px;border:0;border-left:3px solid var(--pc,#ccc);background:var(--pcbg,#f2f4f8);color:var(--li-ink);font:600 11px/1.2 inherit;cursor:pointer;overflow:hidden;transition:transform .12s var(--li-ease),box-shadow .12s}',
      '.li-cpill:hover{transform:translateY(-1px);box-shadow:var(--li-sh-sm)}',
      '.li-cpt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}',
      '.li-cpill.li-cpub{opacity:.6}',
      '.li-more{border:0;background:transparent;font:600 11px/1 inherit;color:var(--li-ink50);padding:2px 4px;text-align:left;cursor:pointer}',
      '.li-more:hover{color:var(--li-blue)}',

      /* ── legende bas ── */
      '.li-legend{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;background:var(--li-panel);border:1px solid var(--li-line);border-radius:14px;box-shadow:var(--li-sh-sm)}',
      '.li-lgrp{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
      '.li-lgtitle{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--li-ink35)}',
      '.li-li{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--li-ink70)}',
      '.li-li .li-ldot{width:10px;height:10px;border-radius:50%}',
      '.li-ldiv{width:1px;height:22px;background:var(--li-line)}',

      /* ── PIPELINE (Direction C) ── */
      '.li-board{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:16px;align-items:start;margin-top:16px}',
      '.li-col{display:flex;flex-direction:column;min-width:0}',
      '.li-colhd{display:flex;align-items:center;gap:9px;padding:4px 6px 12px}',
      '.li-coldot{width:10px;height:10px;border-radius:50%}',
      '.li-coltitle{font-size:13px;font-weight:700}',
      '.li-colcount{font-size:11.5px;font-weight:700;color:var(--li-ink35);background:var(--li-panel);border:1px solid var(--li-line);border-radius:20px;min-width:20px;height:20px;padding:0 6px;display:flex;align-items:center;justify-content:center}',
      '.li-coladd{margin-left:auto;width:26px;height:26px;border-radius:8px;border:1px solid var(--li-line);background:var(--li-panel);color:var(--li-ink50);display:flex;align-items:center;justify-content:center;cursor:pointer}',
      '.li-coladd:hover{background:var(--li-blue);color:#fff;border-color:var(--li-blue)}',
      '.li-drop{background:#fbfcfe;border:1px solid var(--li-line2);border-radius:16px;padding:9px;min-height:120px;display:flex;flex-direction:column;gap:10px;transition:background .15s,border-color .15s}',
      '.li-drop.li-dragover{border-color:var(--li-blue);background:var(--li-blue050)}',
      '.li-card{position:relative;background:var(--li-panel);border:1px solid var(--li-line);border-radius:13px;padding:12px 13px 11px;box-shadow:var(--li-sh-sm);cursor:pointer;transition:box-shadow .16s,transform .12s,border-color .15s}',
      '.li-card:hover{box-shadow:var(--li-sh-md);transform:translateY(-1px);border-color:#dbe2ec}',
      '.li-card::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3.5px;border-radius:0 4px 4px 0;background:var(--pc,#ccc)}',
      '.li-card-pub{opacity:.72}',
      '.li-ctop{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.li-cpill2{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px}',
      '.li-cpdot{width:7px;height:7px;border-radius:50%}',
      '.li-ctitle{font-size:13.5px;font-weight:650;line-height:1.32;margin:0 0 9px;color:var(--li-ink)}',
      '.li-cfoot{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--li-ink50)}',
      '.li-cdate2{display:inline-flex;align-items:center;gap:5px}',
      '.li-cdate2 svg{opacity:.7}',
      '.li-pubcta{margin-top:10px;width:100%;border:1px solid var(--li-blue);color:var(--li-blue);background:var(--li-blue050);border-radius:9px;padding:7px;font:650 12px/1 inherit;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}',
      '.li-pubcta:hover{background:var(--li-blue);color:#fff}',
      '.li-colempty{border:1.5px dashed var(--li-line);border-radius:12px;padding:22px 14px;text-align:center;color:var(--li-ink35);font-size:12px}',

      /* ── LISTE ── */
      '.li-search{position:relative;margin:16px 0 12px;max-width:420px}',
      '.li-search input{width:100%;height:40px;padding:0 12px 0 38px;border-radius:10px;border:1px solid var(--li-line);background:var(--li-panel);font-family:inherit;font-size:14px;color:var(--li-ink);outline:none;transition:border-color .15s,box-shadow .15s}',
      '.li-search input:focus{border-color:var(--li-blue);box-shadow:0 0 0 3px var(--li-blue050)}',
      '.li-search svg{position:absolute;left:12px;top:11px;color:var(--li-ink35)}',
      '.li-lrow{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--li-line);background:var(--li-panel);border-radius:12px;margin-bottom:8px;box-shadow:var(--li-sh-sm);cursor:pointer;transition:box-shadow .15s,border-color .15s,transform .12s}',
      '.li-lrow:hover{border-color:#dbe2ec;box-shadow:var(--li-sh-md);transform:translateY(-1px)}',
      '.li-lrow-dot{width:10px;height:10px;border-radius:50%;flex:none}',
      '.li-lrow-d{color:var(--li-ink50);font-size:12px;width:96px;flex:none}',
      '.li-lrow-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
      '.li-lrow-s{font-size:12px;color:var(--li-ink50);display:inline-flex;align-items:center;gap:6px;flex:none}',
      '.li-lrow-e{font-size:11px;background:#f1eafe;color:#7c56e6;border-radius:999px;padding:2px 9px;flex:none}',

      /* ── DRAWER / ÉDITEUR ── */
      '.li-scrim{position:fixed;inset:0;z-index:200;background:rgba(10,14,26,.42);opacity:0;transition:opacity .28s var(--li-ease)}',
      '.li-scrim.li-open{opacity:1}',
      '.li-drawer{--li-blue:var(--ip-blue);--li-blue600:#0047d6;--li-blue050:#eef3ff;--li-blue100:#dbe6ff;--li-ink:var(--ip-ink);--li-ink70:#3a4152;--li-ink50:#6b7280;--li-ink35:#9aa1ae;--li-bg:#F8FAFC;--li-panel:#fff;--li-line:#E6E9F0;--li-line2:#eef1f6;--li-ease:cubic-bezier(.22,.61,.36,1);--li-sh-sm:0 1px 2px rgba(10,14,26,.05),0 1px 3px rgba(10,14,26,.05);--li-sh-md:0 6px 20px rgba(10,14,26,.08),0 2px 6px rgba(10,14,26,.05);',
      'position:fixed;top:0;right:0;bottom:0;z-index:210;width:480px;max-width:94vw;background:#fff;box-shadow:0 24px 60px rgba(10,14,26,.18),0 6px 18px rgba(10,14,26,.10);transform:translateX(102%);transition:transform .34s var(--li-ease);display:flex;flex-direction:column;color:#0A0E1A}',
      '.li-drawer.li-open{transform:translateX(0)}',
      '.li-dr-head{padding:18px 22px 14px;border-bottom:1px solid #E6E9F0;display:flex;align-items:flex-start;gap:12px}',
      '.li-dr-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0057FF;margin-bottom:8px}',
      '.li-dr-title{width:100%;border:none;outline:none;background:transparent;font-family:inherit;font-weight:800;font-size:21px;line-height:1.25;letter-spacing:-.02em;color:#0A0E1A;padding:2px 0}',
      '.li-dr-title::placeholder{color:#9aa1ae}',
      '.li-close{width:36px;height:36px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;color:#6b7280;border:1px solid #E6E9F0;background:#fff;cursor:pointer;transition:all .15s}',
      '.li-close:hover{background:#F8FAFC;color:#0A0E1A}',
      '.li-dr-body{flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:18px}',
      '.li-field{display:flex;flex-direction:column;gap:9px}',
      '.li-lab{font-size:12px;font-weight:700;color:#3a4152;letter-spacing:.01em}',
      '.li-lab #li-count{float:right;color:#9aa1ae;font-weight:600}',
      '.li-gen{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;border:1.5px solid #0057FF;color:#0057FF;background:#eef3ff;font:700 13px/1 inherit;cursor:pointer;transition:all .15s}',
      '.li-gen:hover{background:#dbe6ff}',
      '.li-gen svg{width:16px;height:16px}',
      '.li-ideabox{background:#F8FAFC;border:1px solid #E6E9F0;border-radius:12px;padding:13px 14px;gap:10px}',
      '.li-ideabtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.li-btn-ghost{background:#fff;border:1.5px solid #E6E9F0;color:#475569;height:36px;padding:0 14px;border-radius:10px;font:700 13px/1 inherit;cursor:pointer}',
      '.li-btn-ghost:hover{border-color:#0057FF;color:#0057FF}',
      '.li-imgidea{font-size:13px;color:#334155;line-height:1.5;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;margin-bottom:8px}',
      '.li-pillpick{display:flex;gap:8px;flex-wrap:wrap}',
      '.li-pp{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:11px;border:1.5px solid #E6E9F0;background:#fff;font:600 12.5px/1 inherit;color:#3a4152;cursor:pointer;transition:all .14s}',
      '.li-pp .li-cdot{width:11px;height:11px;border-radius:50%}',
      '.li-pp:hover{border-color:#d3dae4}',
      '.li-pp.on{border-color:var(--pc);background:var(--pcbg);color:var(--pc)}',
      '.li-segstat{display:flex;background:#eef1f6;border-radius:11px;padding:3px}',
      '.li-segstat button{flex:1;padding:8px 4px;border-radius:8px;border:0;background:transparent;font:600 12.5px/1 inherit;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}',
      '.li-segstat button.on{background:#fff;color:#0A0E1A;box-shadow:0 1px 2px rgba(10,14,26,.05)}',
      '.li-inp{width:100%;height:40px;padding:0 12px;border-radius:10px;border:1.5px solid #E6E9F0;background:#fff;font-family:inherit;font-size:14px;color:#0A0E1A;outline:none;transition:border-color .15s,box-shadow .15s}',
      '.li-inp:focus{border-color:#0057FF;box-shadow:0 0 0 3px #eef3ff}',
      '.li-ta{width:100%;min-height:170px;padding:14px 14px 34px;border-radius:12px;border:1.5px solid #E6E9F0;background:#fff;font-family:inherit;font-size:14px;line-height:1.6;color:#0A0E1A;resize:vertical;outline:none;transition:border-color .15s,box-shadow .15s}',
      '.li-ta:focus{border-color:#0057FF;box-shadow:0 0 0 3px #eef3ff}',
      '.li-ta-wrap{position:relative}',
      '.li-imgrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.li-imgprev img{max-width:180px;border-radius:10px;display:block;margin-bottom:8px}',
      '.li-dr-foot{padding:14px 22px;border-top:1px solid #E6E9F0;display:flex;align-items:center;gap:12px;background:#fff}',
      '.li-dr-foot .li-btn-primary{flex:1;justify-content:center;height:42px}',
      '.li-del{border:0;background:transparent;font:600 13px/1 inherit;color:#e0455f;padding:8px 10px;border-radius:8px;cursor:pointer}',
      '.li-del:hover{background:#fff0f2}',
      '.li-note{font-size:13px;color:#6b7280;line-height:1.5;margin:0}',

      /* ── responsive ── */
      '@media (max-width:1100px){#v2-root .li-workspace{grid-template-columns:1fr}.li-side{position:static;flex-direction:row;flex-wrap:wrap}.li-sidecard{flex:1;min-width:240px}.li-board{grid-template-columns:repeat(2,1fr)}}',
      '@media (max-width:760px){#v2-root .li-wrap{padding:8px 14px 60px}.li-board{grid-template-columns:1fr}.li-drawer{width:100%}.li-weekgrid{display:flex;overflow-x:auto}.li-wday{min-width:130px;flex:none}}',
      '@media (max-width:620px){.li-pcard{grid-template-columns:1fr;gap:10px}.li-pc-time{display:flex;align-items:center;gap:12px;text-align:left}.li-thumb{margin:0}.li-pc-actions{flex-direction:row;align-items:center;justify-content:flex-start}}',
      '@media (prefers-reduced-motion:reduce){#v2-root .li-wrap *,.li-drawer,.li-scrim{transition:none !important;animation:none !important}}'
    ].join('');
    document.head.appendChild(s);
  })();

  function sb() { return (V2.sb && V2.sb()) || null; }

  // ── État de vue ──
  var view = 'queue';               // 'queue' | 'cal' | 'pipeline' | 'list'
  var calRef = new Date();          // mois affiché (1er du mois)
  calRef.setDate(1);

  // ── Piliers éditoriaux (modifiable) ──
  var PILLARS = [
    { k: 'causes',   label: 'Grandes causes',        color: '#FF4D6D' },
    { k: 'joie',     label: 'Joie & bonne humeur',   color: '#FFB020' },
    { k: 'pharma',   label: 'Merci aux pharmaciens', color: '#0057FF' },
    { k: 'patients', label: 'Aux côtés des patients', color: '#00B37A' }
  ];
  // fonds clairs précalculés (Safari-safe, pas de color-mix)
  var PBG = { produit: '#e9f0ff', conseil: '#e6f7f0', coulisses: '#fff4e0', recrutement: '#ffe9ee', tempsfort: '#f1eafe' };
  function pillar(k) { for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].k === k) return PILLARS[i]; return PILLARS[0]; }
  function pbg(k) { return PBG[k] || '#eef1f6'; }

  // ── Statuts ──
  var STATUSES = [
    { k: 'idee',      label: 'Idée',        icon: '💡' },
    { k: 'redaction', label: 'En rédaction', icon: '✍️' },
    { k: 'pret',      label: 'Prêt',        icon: '✅' },
    { k: 'publie',    label: 'Publié',      icon: '📢' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Icônes inline (fonctions, pas d'emoji) ──
  var IMGICO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4 3 2 3-3 5 4"/></svg>';
  var SEND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>';
  var CHEVL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEVR = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

  // marqueur de statut (forme = statut)
  function statusMark(stKey, pKey) {
    var c = pillar(pKey).color, bg = pbg(pKey);
    if (stKey === 'publie') return '<span class="li-sd li-sd-ok">' + ICO('check', 10, 3) + '</span>';
    if (stKey === 'pret')   return '<span class="li-sd" style="background:' + c + '"></span>';
    if (stKey === 'redaction') return '<span class="li-sd" style="background:' + bg + ';border:1.6px solid ' + c + '"></span>';
    return '<span class="li-sd" style="border:1.6px dashed ' + c + '"></span>'; // idée
  }

  // ── Données ──
  var LS = 'jarvis_li_posts';
  var backend = 'local';
  var posts = [];

  var _idc = 0;
  function newId() { return 'li' + Date.now() + '_' + (_idc++); }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  function fromRow(r) {
    return { id: r.id, date: r.date, status: r.status || 'idee', pillar: r.pillar || 'causes',
      title: r.title || '', body: r.body || '', image_path: r.image_path || '', linkedin_url: r.linkedin_url || '',
      format: r.format || '', image_brief: r.image_brief || '', event_id: r.event_id || '', event_name: r.event_name || '', source: r.source || 'manuel',
      created_at: r.created_at || null, updated_at: r.updated_at || null };
  }
  function toRow(p) {
    return { id: p.id, date: p.date, status: p.status, pillar: p.pillar, title: p.title, body: p.body,
      image_path: p.image_path || '', linkedin_url: p.linkedin_url || '', format: p.format || '', image_brief: p.image_brief || '', event_id: p.event_id || '',
      event_name: p.event_name || '', source: p.source || 'manuel',
      owner: (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }

  function loadPosts() {
    var c = sb();
    if (c) {
      return c.from('linkedin_posts').select('*').order('date', { ascending: true })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; posts = r.data.map(fromRow); return posts; }
          backend = 'local'; posts = localAll(); return posts;
        }).catch(function () { backend = 'local'; posts = localAll(); return posts; });
    }
    backend = 'local'; posts = localAll();
    return Promise.resolve(posts);
  }

  function saveLocal(p) {
    var a = localAll(), i = -1;
    for (var k = 0; k < a.length; k++) if (a[k].id === p.id) { i = k; break; }
    if (i >= 0) a[i] = p; else a.push(p);
    localWrite(a); posts = a; return a;
  }
  function savePost(p) {
    if (!p.id) p.id = newId();
    if (!p.created_at) p.created_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').upsert(toRow(p)).then(function (r) {
        if (r.error) { saveLocal(p); return posts; } return loadPosts();
      }).catch(function () { saveLocal(p); return Promise.resolve(posts); });
    }
    return Promise.resolve(saveLocal(p));
  }
  function removePost(id) {
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').delete().eq('id', id).then(function () { return loadPosts(); })
        .catch(function () { localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll(); return posts; });
    }
    localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll();
    return Promise.resolve(posts);
  }

  function byId(id) { for (var i = 0; i < posts.length; i++) if (posts[i].id === id) return posts[i]; return null; }

  // ── Utilitaires date ──
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sameDay(iso, d) { return iso && iso.slice(0, 10) === ymd(d); }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function mondayOfWeek(d) { var x = new Date(d); var day = x.getDay(); var diff = (day === 0 ? -6 : 1 - day); x.setDate(x.getDate() + diff); x.setHours(0, 0, 0, 0); return x; }
  function timeLabel(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var MONS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  function dowShort(d) { return DOW[(d.getDay() + 6) % 7]; }
  function dateShort(iso) { if (!iso) return '—'; var d = new Date(iso); return dowShort(d) + ' ' + d.getDate() + ' ' + MONS[d.getMonth()]; }
  function dayLabel(iso) {
    var d = new Date(iso), t0 = startOfDay(new Date()), ds = startOfDay(d);
    var diff = Math.round((ds.getTime() - t0.getTime()) / 86400000);
    if (diff === 0) return 'Aujourd’hui';
    if (diff === -1) return 'Hier';
    if (diff === 1) return 'Demain';
    return dowShort(d) + ' ' + d.getDate() + ' ' + MONS[d.getMonth()];
  }
  function rangeLabel(mon) {
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var left = mon.getDate() + (mon.getMonth() !== sun.getMonth() ? ' ' + MONS[mon.getMonth()] : '');
    return left + ' → ' + sun.getDate() + ' ' + MONS[sun.getMonth()];
  }
  function postsOnDay(d) { return posts.filter(function (p) { return sameDay(p.date, d); }); }

  function duePosts() {
    var now = Date.now();
    return posts.filter(function (p) { return p.status !== 'publie' && p.date && new Date(p.date).getTime() <= now; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  }
  function dueCount() { try { return duePosts().length; } catch (e) { return 0; } }

  // ── Filtres partagés ──
  var flt = { status: '', q: '', hidden: {} };
  function visible(p) {
    if (flt.hidden[p.pillar]) return false;
    if (flt.status && p.status !== flt.status) return false;
    return true;
  }

  // ═══════════════ COMPOSANTS COMMUNS ═══════════════
  function viewSeg() {
    var due = dueCount();
    var badge = due ? '<span class="li-segbadge">' + due + '</span>' : '';
    var items = [['queue', 'File', badge], ['cal', 'Mois', ''], ['pipeline', 'Pipeline', ''], ['list', 'Liste', '']];
    return '<div class="li-seg" role="tablist">' + items.map(function (it) {
      return '<button class="' + (view === it[0] ? 'on' : '') + '" onclick="V2.li.setView(\'' + it[0] + '\')">' + it[1] + it[2] + '</button>';
    }).join('') + '</div>';
  }
  function monthNavHtml() {
    return '<div class="li-mnav">' +
      '<button class="li-nav" onclick="V2.li.prevMonth()" aria-label="Mois précédent">' + CHEVL + '</button>' +
      '<button class="li-today" onclick="V2.li.today()">Aujourd\'hui</button>' +
      '<button class="li-nav" onclick="V2.li.nextMonth()" aria-label="Mois suivant">' + CHEVR + '</button>' +
      '</div>';
  }
  function filterChips() {
    var chips = PILLARS.map(function (p) {
      var off = flt.hidden[p.k] ? ' li-off' : '';
      return '<button class="li-chip' + off + '" onclick="V2.li.togglePillar(\'' + p.k + '\')">' +
        '<span class="li-cdot" style="background:' + p.color + '"></span>' + esc(p.label) + '</button>';
    }).join('');
    var opts = '<option value="">Tous les statuts</option>' + STATUSES.map(function (s) {
      return '<option value="' + s.k + '"' + (flt.status === s.k ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    return '<span class="li-flabel">Familles</span>' + chips + '<span class="li-toolsep"></span>' +
      '<select class="li-statsel" onchange="V2.li.setStatusFilter(this.value)">' + opts + '</select>';
  }
  function toolbar(o) {
    return '<div class="li-topbar">' +
        '<div class="li-title-wrap"><h1 class="li-h1">' + esc(o.title) + '</h1>' +
          (o.sub ? '<div class="li-sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
        (o.monthNav ? monthNavHtml() : '') +
        '<div class="li-spacer"></div>' +
        viewSeg() +
        '<button class="li-btn li-btn-primary" onclick="V2.li.newAt(\'' + ymd(new Date()) + '\')">' + ICO('plus', 17, 2.2) + 'Nouveau post</button>' +
      '</div>' +
      '<div class="li-toolrow">' +
        '<button class="li-btn li-btn-strat" onclick="V2.lis&&V2.lis.open()">' + ICO('spark', 16) + 'Assistant stratégie</button>' +
        '<button class="li-btn" onclick="V2.li.newEvent()">' + ICO('cal', 16, 1.8) + 'Événement</button>' +
        '<button class="li-btn" onclick="V2.li.importOpen()">' + ICO('download', 16, 2) + 'Import</button>' +
        '<span class="li-toolsep"></span>' + filterChips() +
      '</div>';
  }
  function shell(o, body) {
    return (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap">' + toolbar(o) + body + '</div>';
  }
  function legendBar() {
    var pil = PILLARS.map(function (p) { return '<span class="li-li"><span class="li-ldot" style="background:' + p.color + '"></span>' + esc(p.label) + '</span>'; }).join('');
    return '<div class="li-legend">' +
      '<div class="li-lgrp"><span class="li-lgtitle">Familles</span>' + pil + '</div>' +
      '<div class="li-ldiv"></div>' +
      '<div class="li-lgrp"><span class="li-lgtitle">Statut</span>' +
        '<span class="li-li"><span class="li-sd" style="border:1.6px dashed #9aa1ae"></span>Idée</span>' +
        '<span class="li-li"><span class="li-sd" style="background:#dbe6ff;border:1.6px solid #6b7280"></span>Rédaction</span>' +
        '<span class="li-li"><span class="li-sd" style="background:#3a4152"></span>Prêt</span>' +
        '<span class="li-li"><span class="li-sd li-sd-ok">' + ICO('check', 11, 3) + '</span>Publié</span>' +
      '</div></div>';
  }

  // ═══════════════ VUE FILE (Direction A) ═══════════════
  function weekStrip() {
    var mon = mondayOfWeek(new Date()), todayStr = ymd(new Date()), cells = '';
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i); var iso = ymd(d);
      var pl = postsOnDay(d).filter(visible).map(function (p) {
        var pc = pillar(p.pillar);
        return '<button class="li-wpill" style="--pc:' + pc.color + ';--pcbg:' + pbg(p.pillar) + '" ' +
          'onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">' +
          '<span class="li-wpt">' + esc(p.title || p.body.slice(0, 22) || 'Post') + '</span>' + statusMark(p.status, p.pillar) + '</button>';
      }).join('');
      cells += '<div class="li-wday' + (iso === todayStr ? ' li-wtoday' : '') + '">' +
        '<div class="li-wdtop"><span class="li-wdname">' + DOW[i] + '</span><span class="li-wdnum">' + d.getDate() + '</span></div>' + pl +
        '<button class="li-addhere" title="Planifier ce jour" onclick="V2.li.newAt(\'' + iso + '\')">' + ICO('plus', 13, 2.4) + '</button></div>';
    }
    return '<div class="li-weekcard"><div class="li-weekhd"><h3>Cette semaine en un coup d’œil</h3><span class="li-wrng">' + rangeLabel(mon) + '</span></div>' +
      '<div class="li-weekgrid">' + cells + '</div></div>';
  }

  function pcard(p) {
    var pc = pillar(p.pillar), st = statusOf(p.status);
    var overdue = p.status !== 'publie' && p.date && new Date(p.date).getTime() < startOfDay(new Date()).getTime();
    var pub = p.status === 'publie';
    var d = new Date(p.date || Date.now());
    var thumb = p.image_path
      ? '<div class="li-thumb" style="background-image:url(' + esc(imgUrl(p.image_path)) + ')"></div>'
      : '<div class="li-thumb" style="background:' + pc.color + '">' + IMGICO + '</div>';
    var actions;
    if (pub) actions = '<span class="li-done">' + ICO('check', 16, 2.4) + 'Publié</span>' +
      '<button class="li-mini-link" onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">Ouvrir</button>';
    else if (p.status === 'pret' || overdue) actions = '<button class="li-mini-primary" onclick="event.stopPropagation();V2.li.publish(\'' + esc(p.id) + '\')">' + SEND + 'Publier</button>' +
      '<button class="li-mini-link" onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">Ouvrir</button>';
    else actions = '<button class="li-mini-link" onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">' + (p.status === 'redaction' ? 'Continuer' : 'Ouvrir') + '</button>';
    return '<div class="li-pcard' + (overdue ? ' li-pc-over' : '') + (pub ? ' li-pc-pub' : '') + '" style="--pc:' + pc.color + '" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">' +
        '<div class="li-pc-time"><div class="li-hm">' + timeLabel(d) + '</div><div class="li-dd">' + dayLabel(p.date || ymd(d)) + '</div>' + thumb + '</div>' +
        '<div class="li-pc-body"><div class="li-pc-meta">' +
          '<span class="li-ptag" style="color:' + pc.color + ';background:' + pbg(p.pillar) + '"><span class="li-cdot" style="background:' + pc.color + '"></span>' + esc(pc.label) + '</span>' +
          '<span class="li-stag">' + statusMark(p.status, p.pillar) + esc(st.label) + '</span></div>' +
          '<h3 class="li-pc-title">' + esc(p.title || p.body.slice(0, 60) || 'Post sans titre') + '</h3>' +
          (p.body ? '<p class="li-pc-exc">' + esc(p.body.replace(/\n+/g, ' ').slice(0, 160)) + '</p>' : '') +
        '</div>' +
        '<div class="li-pc-actions">' + actions + '</div>' +
      '</div>';
  }

  function bucketize() {
    var now = new Date(), t0 = startOfDay(now);
    var mon = mondayOfWeek(now);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
    var nextSun = new Date(sun); nextSun.setDate(sun.getDate() + 7);
    var b = { over: [], today: [], week: [], next: [], later: [] };
    posts.filter(visible).forEach(function (p) {
      if (!p.date) { b.later.push(p); return; }
      var d = new Date(p.date), ds = startOfDay(d), t = d.getTime();
      if (p.status === 'publie' && t < t0.getTime()) return; // publié + passé = archivé
      if (p.status !== 'publie' && t < t0.getTime()) { b.over.push(p); return; }
      if (ds.getTime() === t0.getTime()) { b.today.push(p); return; }
      if (t <= sun.getTime()) { b.week.push(p); return; }
      if (t <= nextSun.getTime()) { b.next.push(p); return; }
      b.later.push(p);
    });
    function asc(a, c) { return new Date(a.date || 0) - new Date(c.date || 0); }
    b.over.sort(asc); b.today.sort(asc); b.week.sort(asc); b.next.sort(asc); b.later.sort(asc);
    return [
      { label: 'En retard — à traiter', overdue: true, posts: b.over },
      { label: 'Aujourd’hui', posts: b.today },
      { label: 'Cette semaine', posts: b.week },
      { label: 'Semaine prochaine', posts: b.next },
      { label: 'Plus tard', posts: b.later }
    ];
  }

  function sideCards() {
    var m = calRef.getMonth(), y = calRef.getFullYear();
    var nbMonth = 0, nbPub = 0;
    posts.forEach(function (p) { if (!p.date) return; var d = new Date(p.date); if (d.getMonth() === m && d.getFullYear() === y) { nbMonth++; if (p.status === 'publie') nbPub++; } });
    var nbDue = dueCount();
    var promo = '<div class="li-sidecard li-promo"><div class="li-spark">' + ICO('spark', 20) + '</div>' +
      '<h4>Assistant stratégie</h4><p>Répondez à quelques questions : JARVIS génère un plan de posts daté, équilibré et prêt à suivre.</p>' +
      '<button class="li-btn li-btn-strat li-full" onclick="V2.lis&&V2.lis.open()">' + ICO('spark', 15) + 'Générer mon plan</button></div>';
    var rythme = '<div class="li-sidecard"><h4>Votre rythme</h4><div class="li-stats">' +
      '<div class="li-stat"><b>' + nbMonth + '</b><span>ce mois</span></div>' +
      '<div class="li-stat" style="color:' + (nbDue ? '#F39A1B' : '#0A0E1A') + '"><b>' + nbDue + '</b><span>à publier</span></div>' +
      '<div class="li-stat" style="color:#00B37A"><b>' + nbPub + '</b><span>publiés</span></div></div></div>';
    var leg = '<div class="li-sidecard"><h4>Familles éditoriales</h4>' +
      PILLARS.map(function (p) { return '<div class="li-legrow"><span class="li-sw" style="background:' + p.color + '"></span>' + esc(p.label) + '</div>'; }).join('') +
      '<div class="li-legnote"><b>Couleur</b> = pilier · <b>Forme</b> de la pastille = statut (contour pointillé : idée · plein clair : rédaction · plein : prêt · coche verte : publié).</div></div>';
    return '<div class="li-side">' + promo + rythme + leg + '</div>';
  }

  function renderQueue(root) {
    var buckets = bucketize();
    var total = 0; buckets.forEach(function (b) { total += b.posts.length; });
    var qhtml = '<div class="li-qhead"><h2>Votre file<span class="li-count">' + total + ' post' + (total > 1 ? 's' : '') + '</span></h2>' +
      '<button class="li-linkbtn" onclick="V2.li.setView(\'cal\')">Voir tout le mois →</button></div>';
    if (!total) qhtml += '<div class="li-empty">Aucun post pour l’instant.<br>Clique sur « + Nouveau post » ou lance l’Assistant stratégie.</div>';
    else buckets.forEach(function (b) {
      if (!b.posts.length) return;
      qhtml += '<div class="li-qday"><div class="li-qlabel' + (b.overdue ? ' li-overdue' : '') + '">' +
        (b.overdue ? ICO('alert', 15, 2) : '') + esc(b.label) + '<span class="li-qline"></span></div>' +
        b.posts.map(pcard).join('') + '</div>';
    });
    var body = '<div class="li-workspace"><div class="li-qcol">' + weekStrip() + qhtml + '</div>' + sideCards() + '</div>';
    root.innerHTML = shell({ title: 'Votre file', sub: 'Votre pipeline de publication LinkedIn', monthNav: false }, body);
  }

  // ═══════════════ VUE MOIS (Direction B) ═══════════════
  function renderCal(root) {
    var y = calRef.getFullYear(), m = calRef.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayStr = ymd(new Date());
    var nbMonth = 0; posts.forEach(function (p) { if (p.date) { var d = new Date(p.date); if (d.getMonth() === m && d.getFullYear() === y) nbMonth++; } });

    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="li-cell li-out"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(y, m, day), iso = ymd(d);
      var dayPosts = postsOnDay(d).filter(visible);
      var pl = dayPosts.slice(0, 3).map(function (p) {
        var pc = pillar(p.pillar);
        return '<button class="li-cpill' + (p.status === 'publie' ? ' li-cpub' : '') + '" style="--pc:' + pc.color + ';--pcbg:' + pbg(p.pillar) + '" ' +
          'onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">' + statusMark(p.status, p.pillar) +
          '<span class="li-cpt">' + esc(p.title || p.body.slice(0, 20) || 'Post') + '</span></button>';
      }).join('');
      if (dayPosts.length > 3) pl += '<button class="li-more" onclick="event.stopPropagation();V2.li.newAt(\'' + iso + '\')">+' + (dayPosts.length - 3) + ' de plus</button>';
      cells += '<div class="li-cell' + (iso === todayStr ? ' li-today2' : '') + '" onclick="V2.li.newAt(\'' + iso + '\')">' +
        '<span class="li-daynum">' + day + '</span>' + pl +
        '<button class="li-addhint" title="Nouveau post" onclick="event.stopPropagation();V2.li.newAt(\'' + iso + '\')">' + ICO('plus', 14, 2.4) + '</button></div>';
    }
    var head = '<div class="li-weekhead">' + DOW.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>';
    var body = '<div class="li-calcard">' + head + '<div class="li-grid">' + cells + '</div></div>' + legendBar();
    root.innerHTML = shell({ title: MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1) + ' ' + y, sub: nbMonth + ' post' + (nbMonth > 1 ? 's' : '') + ' planifié' + (nbMonth > 1 ? 's' : '') + ' ce mois-ci', monthNav: true }, body);
  }

  // ═══════════════ VUE PIPELINE (Direction C) ═══════════════
  function pipeCard(p) {
    var pc = pillar(p.pillar), ready = p.status === 'pret', pub = p.status === 'publie';
    return '<div class="li-card' + (pub ? ' li-card-pub' : '') + '" draggable="true" ondragstart="V2.li.dragStart(event,\'' + esc(p.id) + '\')" ' +
        'style="--pc:' + pc.color + '" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">' +
        '<div class="li-ctop"><span class="li-cpill2" style="color:' + pc.color + ';background:' + pbg(p.pillar) + '"><span class="li-cpdot" style="background:' + pc.color + '"></span>' + esc(pc.label) + '</span></div>' +
        '<p class="li-ctitle">' + esc(p.title || p.body.slice(0, 60) || 'Post sans titre') + '</p>' +
        '<div class="li-cfoot">' + statusMark(p.status, p.pillar) + '<span class="li-cdate2">' + ICO('cal', 13, 1.7) + dateShort(p.date) + '</span></div>' +
        (ready ? '<button class="li-pubcta" onclick="event.stopPropagation();V2.li.publish(\'' + esc(p.id) + '\')">' + SEND + 'Publier maintenant</button>' : '') +
      '</div>';
  }
  function renderPipeline(root) {
    var cols = [{ k: 'idee', dot: '#9aa1ae' }, { k: 'redaction', dot: '#0057FF' }, { k: 'pret', dot: '#0057FF' }, { k: 'publie', dot: '#00B37A' }];
    var board = cols.map(function (col) {
      var st = statusOf(col.k);
      var items = posts.filter(function (p) { return p.status === col.k && visible(p); })
        .sort(function (a, b) { return new Date(a.date || 0) - new Date(b.date || 0); });
      var cards = items.map(pipeCard).join('') ||
        '<div class="li-colempty">' + (col.k === 'idee' ? 'Aucune idée ici.<br>Cliquez + pour en ajouter.' : (col.k === 'publie' ? 'Rien de publié.' : 'Glissez une carte ici.')) + '</div>';
      return '<div class="li-col"><div class="li-colhd"><span class="li-coldot" style="background:' + col.dot + '"></span>' +
          '<span class="li-coltitle">' + esc(st.label) + '</span><span class="li-colcount">' + items.length + '</span>' +
          '<button class="li-coladd" title="Nouveau post" onclick="V2.li.newStatus(\'' + col.k + '\')">' + ICO('plus', 15, 2.2) + '</button></div>' +
        '<div class="li-drop" ondragover="V2.li.dragOver(event)" ondrop="V2.li.drop(event,\'' + col.k + '\')">' + cards + '</div></div>';
    }).join('');
    root.innerHTML = shell({ title: 'Pipeline éditorial', sub: 'Suivez chaque post de l’idée à la publication', monthNav: false }, '<div class="li-board">' + board + '</div>' + legendBar());
  }

  // ═══════════════ VUE LISTE ═══════════════
  function renderList(root) {
    var rows = posts.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).filter(function (p) {
      if (!visible(p)) return false;
      if (flt.q && (p.title + ' ' + p.body + ' ' + (p.event_name || '')).toLowerCase().indexOf(flt.q.toLowerCase()) < 0) return false;
      return true;
    });
    var list = rows.map(function (p) {
      var pc = pillar(p.pillar), st = statusOf(p.status);
      return '<div class="li-lrow" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">' +
        '<span class="li-lrow-dot" style="background:' + pc.color + '"></span>' +
        '<span class="li-lrow-d">' + dateShort(p.date) + '</span>' +
        '<span class="li-lrow-t">' + esc(p.title || p.body.slice(0, 60) || 'Post') + '</span>' +
        '<span class="li-lrow-s">' + statusMark(p.status, p.pillar) + esc(st.label) + '</span>' +
        (p.event_name ? '<span class="li-lrow-e">' + esc(p.event_name) + '</span>' : '') + '</div>';
    }).join('') || '<div class="li-empty">Aucun post ne correspond aux filtres.</div>';
    var search = '<div class="li-search">' + ICO('search', 16, 2) +
      '<input placeholder="Rechercher un post…" value="' + esc(flt.q) + '" oninput="V2.li.filter(\'q\',this.value)"></div>';
    root.innerHTML = shell({ title: 'Tous les posts', sub: rows.length + ' post' + (rows.length > 1 ? 's' : '') + ' au total', monthNav: false }, search + list);
  }

  // ── Rendu ──
  var loaded = false;
  function render(root) {
    if (!loaded) {
      loaded = true;
      loadPosts().then(function () { if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin') V2.render(); });
    }
    if (view === 'cal') return renderCal(root);
    if (view === 'pipeline') return renderPipeline(root);
    if (view === 'list') return renderList(root);
    return renderQueue(root);
  }

  // ═══════════════ ÉDITEUR (drawer clair, glisse depuis la droite) ═══════════════
  var editing = null;

  function drawerHost() {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    return host;
  }
  function mountDrawer(html) {
    var host = drawerHost(); host.innerHTML = html;
    var dr = host.querySelector('.li-drawer'), sc = host.querySelector('.li-scrim');
    void host.offsetWidth; // reflow → transition
    if (sc) sc.className += ' li-open';
    if (dr) dr.className += ' li-open';
  }
  function closeDrawer() {
    editing = null;
    var host = document.getElementById('li-editor'); if (!host) return;
    var dr = host.querySelector('.li-drawer'), sc = host.querySelector('.li-scrim');
    if (dr) dr.className = dr.className.replace(' li-open', '');
    if (sc) sc.className = sc.className.replace(' li-open', '');
    setTimeout(function () { if (!editing) host.innerHTML = ''; }, 320);
  }

  function openEditor(p) {
    editing = p ? JSON.parse(JSON.stringify(p)) : {
      id: '', date: new Date().toISOString(), status: 'idee', pillar: 'causes',
      title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel'
    };
    mountDrawer(editorHtml());
  }
  function redrawEditor() {
    var host = drawerHost();
    if (!editing) { host.innerHTML = ''; return; }
    host.innerHTML = editorHtml(true); // déjà ouvert, pas de ré-animation
  }
  function editorHtml(alreadyOpen) {
    var e = editing, dt = (e.date || '').slice(0, 16);
    var oc = alreadyOpen ? ' li-open' : '';
    var pills = PILLARS.map(function (p) {
      return '<button class="li-pp' + (e.pillar === p.k ? ' on' : '') + '" style="--pc:' + p.color + ';--pcbg:' + pbg(p.k) + '" onclick="V2.li.editField(\'pillar\',\'' + p.k + '\')">' +
        '<span class="li-cdot" style="background:' + p.color + '"></span>' + esc(p.label) + '</button>';
    }).join('');
    var stat = STATUSES.map(function (s) {
      return '<button class="' + (e.status === s.k ? 'on' : '') + '" onclick="V2.li.editField(\'status\',\'' + s.k + '\')">' + statusMark(s.k, e.pillar || 'causes') + esc(s.label) + '</button>';
    }).join('');
    var img = e.image_path
      ? '<div class="li-imgprev"><img src="' + esc(imgUrl(e.image_path)) + '" alt=""><button class="li-btn" onclick="V2.li.editField(\'image_path\',\'\')">Retirer le visuel</button></div>'
      : '<label class="li-btn">' + IMGICO.replace(/#fff/g, '#6b7280') + 'Ajouter un visuel<input type="file" accept="image/*" style="display:none" onchange="V2.li.uploadImg(this)"></label>' +
        '<input class="li-inp" placeholder="…ou coller une URL d\'image" value="" oninput="V2.li.editField(\'image_path\',this.value)">';
    return '<div class="li-scrim' + oc + '" onclick="V2.li.closeEditor()"></div>' +
      '<aside class="li-drawer' + oc + '">' +
        '<div class="li-dr-head"><div style="flex:1;min-width:0">' +
          '<div class="li-dr-eyebrow">' + (e.id ? 'Modifier le post' : 'Nouveau post') + '</div>' +
          '<input class="li-dr-title" value="' + esc(e.title) + '" oninput="V2.li.editField(\'title\',this.value)" placeholder="Titre du post…"></div>' +
          '<button class="li-close" onclick="V2.li.closeEditor()">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="li-dr-body">' +
          '<div class="li-field li-ideabox"><label class="li-lab">Votre idée en quelques mots</label>' +
            '<input class="li-inp" value="' + esc(e._brief || '') + '" oninput="V2.li.editField(\'_brief\',this.value)" placeholder="ex : lancement gamme solaire, disponible tout l\'été">' +
            '<div class="li-ideabtns">' +
              '<button class="li-gen" onclick="V2.li.writeFromIdea()">' + ICO('spark', 16) + 'Rédiger le post à partir de mon idée</button>' +
              '<button class="li-btn li-btn-ghost" onclick="V2.li.suggestIdea()">Proposer une idée</button>' +
            '</div></div>' +
          '<div class="li-field"><label class="li-lab">Texte du post <span id="li-count">' + (e.body || '').length + ' / 3000</span></label>' +
            '<div class="li-ta-wrap"><textarea class="li-ta" oninput="V2.li.editField(\'body\',this.value)" placeholder="Rédigez votre post LinkedIn…">' + esc(e.body) + '</textarea></div>' +
            '<button class="li-gen" onclick="V2.li.gentext()">' + ICO('spark', 16) + 'Générer le texte (selon le pilier)</button></div>' +
          '<div class="li-field"><label class="li-lab">Famille éditoriale</label><div class="li-pillpick">' + pills + '</div></div>' +
          '<div class="li-field"><label class="li-lab">Statut</label><div class="li-segstat">' + stat + '</div></div>' +
          '<div class="li-field"><label class="li-lab">Date & heure de publication</label>' +
            '<input class="li-inp" type="datetime-local" value="' + dt + '" oninput="V2.li.editField(\'date\',this.value)"></div>' +
          '<div class="li-field"><label class="li-lab">Idée visuelle</label>' +
            (e.image_brief ? '<div class="li-imgidea">' + esc(e.image_brief) + '</div>' : '') +
            '<button class="li-gen" onclick="V2.li.imageIdea()">' + ICO('spark', 16) + (e.image_brief ? 'Autre idée d\'image' : 'Proposer une idée d\'image') + '</button></div>' +
          '<div class="li-field"><label class="li-lab">Visuel</label><div class="li-imgrow">' + img + '</div></div>' +
          '<div class="li-field"><label class="li-lab">Lien LinkedIn (après publication)</label>' +
            '<input class="li-inp" value="' + esc(e.linkedin_url) + '" oninput="V2.li.editField(\'linkedin_url\',this.value)" placeholder="https://www.linkedin.com/posts/…"></div>' +
        '</div>' +
        '<div class="li-dr-foot">' +
          (e.id ? '<button class="li-del" onclick="V2.li.del()">Supprimer</button>' : '') +
          '<button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-primary" onclick="V2.li.save()">' + ICO('check', 17, 2.4) + 'Enregistrer</button>' +
        '</div>' +
      '</aside>';
  }
  function imgUrl(path) {
    if (!path) return '';
    if (/^https?:/.test(path)) return path;
    var c = sb(); if (c && c.storage) { try { return c.storage.from('marketing-media').getPublicUrl(path).data.publicUrl; } catch (e) {} }
    return path;
  }

  // ── API publique ──
  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf,
    loadPosts: loadPosts, savePost: savePost, removePost: removePost, _posts: function () { return posts; }, newId: newId,
    goCal: function (d) { view = 'cal'; if (d) { calRef = new Date(d); calRef.setDate(1); } V2.render(); } };
  V2.mktLinkedin.dueCount = dueCount;
  V2.li = V2.li || {};

  // ── Vue / navigation / filtres ──
  V2.li.setView = function (v) { view = v; V2.render(); };
  V2.li.prevMonth = function () { calRef.setMonth(calRef.getMonth() - 1); V2.render(); };
  V2.li.nextMonth = function () { calRef.setMonth(calRef.getMonth() + 1); V2.render(); };
  V2.li.today = function () { calRef = new Date(); calRef.setDate(1); V2.render(); };
  V2.li.togglePillar = function (k) { if (flt.hidden[k]) delete flt.hidden[k]; else flt.hidden[k] = 1; V2.render(); };
  V2.li.setStatusFilter = function (v) { flt.status = v; V2.render(); };
  V2.li.filter = function (k, v) { flt[k] = v; V2.render(); };

  // ── Création / édition ──
  V2.li.newAt = function (iso) {
    var d = new Date(); if (iso && iso.length >= 10) { d = new Date(iso + 'T09:00'); }
    openEditor({ id: '', date: d.toISOString(), status: 'idee', pillar: 'causes', title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel' });
  };
  V2.li.newStatus = function (st) {
    openEditor({ id: '', date: new Date().toISOString(), status: st || 'idee', pillar: 'causes', title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel' });
  };
  V2.li.openPost = function (id) { var p = byId(id); if (p) openEditor(p); };
  V2.li.editField = function (f, v) {
    if (!editing) return;
    if (f === 'date') { var d = new Date(v); if (!isNaN(d.getTime())) editing.date = d.toISOString(); return; }
    editing[f] = v;
    if (f === 'body') { var c = document.getElementById('li-count'); if (c) c.textContent = v.length + ' / 3000'; }
    if (f === 'pillar' || f === 'status' || f === 'image_path') redrawEditor();
  };
  V2.li.gentext = function () {
    if (!editing) return;
    if (!V2.lis || !V2.lis.genForEditor) { alert('Assistant stratégie non chargé — rechargez la page.'); return; }
    editing._genv = (editing._genv == null) ? 0 : editing._genv + 1;
    editing.body = V2.lis.genForEditor(editing.pillar || 'causes', editing.title || '', editing._genv);
    redrawEditor();
  };
  V2.li.writeFromIdea = function () {
    if (!editing) return;
    if (!V2.lis || !V2.lis.genFromBrief) { alert('Assistant stratégie non chargé — rechargez la page.'); return; }
    var brief = editing._brief || editing.title || '';
    if (!brief) { alert('Écris d’abord ton idée en quelques mots.'); return; }
    editing._genv = (editing._genv == null) ? 0 : editing._genv + 1;
    editing.body = V2.lis.genFromBrief(editing.pillar || 'causes', brief, editing._genv);
    redrawEditor();
  };
  V2.li.suggestIdea = function () {
    if (!editing || !V2.lis || !V2.lis.suggestIdea) return;
    editing._sugv = (editing._sugv == null) ? 0 : editing._sugv + 1;
    var s = V2.lis.suggestIdea(editing.pillar || 'causes', editing._sugv);
    editing.title = s.h; if (!editing._brief) editing._brief = s.core;
    redrawEditor();
  };
  V2.li.imageIdea = function () {
    if (!editing || !V2.lis || !V2.lis.genImageIdea) return;
    editing._imgv = (editing._imgv == null) ? 0 : editing._imgv + 1;
    editing.image_brief = V2.lis.genImageIdea(editing.pillar || 'causes', editing._imgv);
    redrawEditor();
  };
  V2.li.closeEditor = function () { closeDrawer(); };
  V2.li.save = function () {
    if (!editing) return;
    var p = editing; closeDrawer();
    savePost(p).then(function () { V2.render(); });
  };
  V2.li.del = function () {
    if (!editing || !editing.id) { closeDrawer(); return; }
    if (!confirm('Supprimer ce post ?')) return;
    var id = editing.id; closeDrawer();
    removePost(id).then(function () { V2.render(); });
  };
  V2.li.uploadImg = function (input) {
    var f = input.files && input.files[0]; if (!f || !editing) return;
    var c = sb();
    if (!(c && c.storage) || backend !== 'supabase') { alert('Upload d\'image indisponible hors-ligne. Collez une URL d\'image à la place.'); return; }
    var path = 'linkedin/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9._-]/g, '');
    c.storage.from('marketing-media').upload(path, f, { upsert: true }).then(function (r) {
      if (r.error) { alert('Échec de l\'upload : ' + r.error.message); return; }
      editing.image_path = path; redrawEditor();
    });
  };

  // ── Pipeline drag & drop (bonus, robuste) ──
  var dragId = null;
  V2.li.dragStart = function (e, id) { dragId = id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (x) {} } };
  V2.li.dragOver = function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; };
  V2.li.drop = function (e, status) {
    e.preventDefault();
    var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')); dragId = null;
    if (!id) return;
    var p = byId(id);
    if (p && p.status !== status) { p.status = status; savePost(p).then(function () { V2.render(); }); }
  };

  // ── Temps fort (rétroplanning) ──
  var RETRO = [
    { off: -14, title: 'Teaser',        pillar: 'causes' },
    { off: -7,  title: 'Annonce',       pillar: 'causes' },
    { off: -1,  title: 'Rappel',        pillar: 'causes' },
    { off: 0,   title: 'Jour J / live', pillar: 'causes' },
    { off: 2,   title: 'Retour / bilan',pillar: 'conseil'   }
  ];
  V2.li.newEvent = function () {
    var todayStr = ymd(new Date());
    mountDrawer(
      '<div class="li-scrim" onclick="V2.li.closeEditor()"></div>' +
      '<aside class="li-drawer">' +
        '<div class="li-dr-head"><div style="flex:1"><div class="li-dr-eyebrow">Rétroplanning</div>' +
          '<div class="li-dr-title" style="font-size:19px">Nouvel événement ou cause</div></div>' +
          '<button class="li-close" onclick="V2.li.closeEditor()">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="li-dr-body">' +
          '<p class="li-note">JARVIS créera automatiquement les posts brouillons à rebours : J-14, J-7, J-1, Jour J, J+2.</p>' +
          '<div class="li-field"><label class="li-lab">Nom du temps fort</label>' +
            '<input class="li-inp" id="li-evname" placeholder="ex : Salon Pharmagora"></div>' +
          '<div class="li-field"><label class="li-lab">Date du jour J</label>' +
            '<input class="li-inp" id="li-evdate" type="date" value="' + todayStr + '"></div>' +
        '</div>' +
        '<div class="li-dr-foot"><button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-primary" onclick="V2.li.genEvent()">Générer le rétroplanning</button></div>' +
      '</aside>');
  };
  V2.li.genEvent = function () {
    var name = (document.getElementById('li-evname') || {}).value || '';
    var dstr = (document.getElementById('li-evdate') || {}).value || '';
    if (!name.trim() || !dstr) { alert('Renseignez un nom et une date.'); return; }
    var evId = newId(), dJ = new Date(dstr + 'T09:00');
    var chain = Promise.resolve();
    RETRO.forEach(function (r) {
      var d = new Date(dJ.getTime()); d.setDate(d.getDate() + r.off);
      var p = { id: '', date: d.toISOString(), status: 'idee', pillar: r.pillar,
        title: name + ' — ' + r.title, body: '', image_path: '', linkedin_url: '',
        event_id: evId, event_name: name, source: 'retroplanning' };
      chain = chain.then(function () { return savePost(p); });
    });
    closeDrawer();
    chain.then(function () { calRef = new Date(dJ.getTime()); calRef.setDate(1); view = 'cal'; V2.render(); });
  };

  // ── Import CSV ──
  function parseCsv(text) {
    var rows = [], row = [], cur = '', i = 0, inQ = false, ch;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (; i < text.length; i++) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.length && !(r.length === 1 && r[0] === ''); });
  }
  var importRows = null, importMap = { date: -1, body: -1, url: -1 };

  V2.li.importOpen = function () {
    mountDrawer(
      '<div class="li-scrim" onclick="V2.li.closeEditor()"></div>' +
      '<aside class="li-drawer">' +
        '<div class="li-dr-head"><div style="flex:1"><div class="li-dr-eyebrow">Import</div>' +
          '<div class="li-dr-title" style="font-size:19px">Importer d\'anciens posts</div></div>' +
          '<button class="li-close" onclick="V2.li.closeEditor()">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="li-dr-body">' +
          '<p class="li-note">Déposez le fichier <b>.csv</b> de l\'export LinkedIn (Paramètres → Confidentialité → Obtenir une copie de vos données → Publications). On repère les colonnes date / texte / lien.</p>' +
          '<label class="li-btn li-btn-strat">' + ICO('download', 16, 2) + 'Choisir le fichier CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="V2.li.importFile(this)"></label>' +
          '<div id="li-impbody"></div>' +
        '</div>' +
      '</aside>');
  };
  V2.li.importFile = function (input) {
    var f = input.files && input.files[0]; if (!f) return;
    var rdr = new FileReader();
    rdr.onload = function () {
      importRows = parseCsv(String(rdr.result));
      if (!importRows.length) { document.getElementById('li-impbody').innerHTML = '<p class="li-note">Fichier vide ou illisible.</p>'; return; }
      var head = importRows[0];
      importMap = { date: -1, body: -1, url: -1 };
      head.forEach(function (h, idx) {
        var l = String(h).toLowerCase();
        if (importMap.date < 0 && /date/.test(l)) importMap.date = idx;
        if (importMap.body < 0 && /(comment|content|text|texte|message|share)/.test(l)) importMap.body = idx;
        if (importMap.url < 0 && /(link|url|lien)/.test(l)) importMap.url = idx;
      });
      var opts = function (sel) { return head.map(function (h, idx) { return '<option value="' + idx + '"' + (sel === idx ? ' selected' : '') + '>' + esc(h || ('Colonne ' + (idx + 1))) + '</option>'; }).join(''); };
      document.getElementById('li-impbody').innerHTML =
        '<p class="li-note" style="margin-top:16px">' + (importRows.length - 1) + ' ligne(s) détectée(s). Vérifiez les colonnes :</p>' +
        '<div class="li-field"><label class="li-lab">Date</label><select class="li-inp" onchange="V2.li.setMap(\'date\',this.value)">' + opts(importMap.date) + '</select></div>' +
        '<div class="li-field"><label class="li-lab">Texte</label><select class="li-inp" onchange="V2.li.setMap(\'body\',this.value)">' + opts(importMap.body) + '</select></div>' +
        '<div class="li-field"><label class="li-lab">Lien</label><select class="li-inp" onchange="V2.li.setMap(\'url\',this.value)">' + opts(importMap.url) + '</select></div>' +
        '<button class="li-btn li-btn-primary" onclick="V2.li.doImport()">Importer</button>';
    };
    rdr.readAsText(f, 'utf-8');
  };
  V2.li.setMap = function (k, v) { importMap[k] = parseInt(v, 10); };
  V2.li.doImport = function () {
    if (!importRows || importRows.length < 2) return;
    var existing = {}; posts.forEach(function (p) { existing[(p.linkedin_url || '') + '|' + (p.date || '').slice(0, 10)] = 1; });
    var chain = Promise.resolve(), added = 0;
    for (var r = 1; r < importRows.length; r++) {
      var row = importRows[r];
      var rawDate = importMap.date >= 0 ? row[importMap.date] : '';
      var body = importMap.body >= 0 ? (row[importMap.body] || '') : '';
      var url = importMap.url >= 0 ? (row[importMap.url] || '') : '';
      var d = new Date(rawDate); if (isNaN(d.getTime())) d = new Date();
      var key = (url || '') + '|' + ymd(d);
      if (existing[key]) continue; existing[key] = 1;
      (function (dd, bb, uu) {
        var p = { id: '', date: dd.toISOString(), status: 'publie', pillar: 'causes',
          title: bb.slice(0, 40), body: bb, image_path: '', linkedin_url: uu, event_id: '', event_name: '', source: 'import' };
        chain = chain.then(function () { return savePost(p); });
      })(d, body, url); added++;
    }
    importRows = null;
    closeDrawer();
    chain.then(function () { alert(added + ' ancien(s) post(s) importé(s).'); V2.render(); });
  };

  // ── Publication ──
  V2.li.publish = function (id) {
    var p = byId(id);
    if (!p) return;
    var txt = p.body || '';
    function afterCopy() {
      window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
      if (confirm('Texte copié. LinkedIn est ouvert : collez, ajoutez le visuel et publiez.\n\nMarquer ce post comme « Publié » ?')) {
        var url = prompt('Collez le lien du post publié (facultatif) :', p.linkedin_url || '');
        p.status = 'publie'; if (url) p.linkedin_url = url;
        savePost(p).then(function () { V2.render(); });
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(afterCopy, function () { window.prompt('Copiez le texte :', txt); afterCopy(); });
    } else { window.prompt('Copiez le texte :', txt); afterCopy(); }
  };
})();
