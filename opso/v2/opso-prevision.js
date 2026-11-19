// ═══════════════════════════════════════════════════════════════════
// OPSO Santé — écran « Prévision du contrat » : la table de négociation (curseurs, simulations, d'où viennent
// les chiffres) et le suivi réel mois par mois. Propre à OPSO. Classes et styles préfixés opv-.
//
// ⚠️ AUCUN CHIFFRE DU PLAN ICI (dépôt public). Le plan vit dans `window.OPSO_PREVISION` (fichier protégé
// opso-prevision-2027-data.js, clé `opsoprevision` de PROTEGES dans v2-boot.js), chargé à l'ouverture de
// l'écran pour les seuls comptes de V2.PLAN_OPSO_ACCES (le verrou réel est côté serveur :
// jarvis_acces_plan_opso()). Le moteur est dans opso-prevision-moteur.js.
// Le suivi réel lit les ventes de l'app (V2.opsoRemuneration.moisComplets) : mois complets seulement.
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";
  var V2 = window.V2 || (window.V2 = {});
  V2.pages = V2.pages || {};
  var ROUTE = 'opsoprevision';

  function acces() {
    var e = String((V2.user && V2.user.email) || '').toLowerCase();
    return !!(V2.PLAN_OPSO_ACCES && V2.PLAN_OPSO_ACCES.indexOf(e) >= 0);
  }
  V2.opsoPrevisionOk = acces;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById('opv-' + id); }

  // ── Styles (injectés une fois), tous préfixés opv- ──
  var CSS = ''
    + '.opv{--opv-vert:#4e9f70;--opv-vert-d:#3e7f59;--opv-vert-dd:#2c5f42;--opv-vert-cl:#e6f1ea;--opv-vert-cl2:#f2f8f4;--opv-encre:#10131C;--opv-muted:#5b6275;--opv-ligne:rgba(33,57,43,.10);--opv-ligne-2:rgba(33,57,43,.16);--opv-rose:#b4233a;--opv-ambre:#8a5a00;--opv-ambre-cl:#fbf3e2;--opv-fond:#f4f7f5;--opv-carte:#fff;--opv-cran-1:#d9e9df;--opv-cran-5:#3e7f59;--opv-lift:0 1px 0 rgba(255,255,255,.95) inset,0 1px 2px rgba(25,38,31,.05),0 10px 28px -14px rgba(33,57,43,.20);--opv-r:20px;--opv-r-md:14px;--opv-pill:999px;--opv-ease:cubic-bezier(.22,.61,.36,1);--opv-ease-out:cubic-bezier(.16,1,.3,1);color:var(--opv-encre);font-size:15px;line-height:1.45;min-width:0}'
    + '.opv *{box-sizing:border-box}.opv [hidden]{display:none!important}'
    + '.opv h1,.opv h2,.opv h3{font-family:ui-rounded,"SF Pro Rounded",-apple-system,system-ui,sans-serif;font-weight:700;letter-spacing:-.01em;margin:0}'
    + '.opv button{font:inherit;color:inherit}.opv-num{font-variant-numeric:tabular-nums;letter-spacing:-.01em}.opv-petit{font-size:13px;color:var(--opv-muted)}'
    + '.opv-verrou{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--opv-vert-dd);background:var(--opv-vert-cl);border-radius:var(--opv-pill);padding:6px 10px;margin:0 0 6px}'
    + '.opv-titre{margin:6px 0 2px;font-size:26px}.opv-sous{margin:0 0 10px;color:var(--opv-muted);font-size:14px}'
    + '.opv-onglets{display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--opv-ligne-2)}'
    + '.opv-onglets button{border:0;background:transparent;min-height:48px;padding:0 14px;font-size:15px;font-weight:600;color:var(--opv-muted);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}'
    + '.opv-onglets button[aria-selected="true"]{color:var(--opv-encre);border-color:var(--opv-vert-d)}'
    + '.opv-haut{position:sticky;top:0;z-index:10;margin:0 -16px 14px;padding:10px 16px;background:rgba(247,250,248,.97);border-bottom:1px solid var(--opv-ligne);display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
    // sous 640 px, .v2-wrap n'a plus que 14 px de marge : la marge négative doit valoir EXACTEMENT 14 px, sinon la page défile de côté (sonde prod 19/11 : 392 px pour 390)
    + '@media(max-width:640px){.opv-haut{margin:0 -14px 14px;padding:10px 14px}}'
    + '.opv-haut b{display:block;font-family:ui-rounded,"SF Pro Rounded",-apple-system,system-ui,sans-serif;font-size:19px}.opv-haut span{font-size:13px;color:var(--opv-muted)}'
    + '.opv-haut .opv-d{font-size:13px;font-weight:600}.opv-d.opv-p{color:var(--opv-vert-dd)}.opv-d.opv-m{color:var(--opv-rose)}'
    + '.opv-cols{display:grid;gap:14px}.opv-cols>*,.opv-grid>*{min-width:0}@media(min-width:960px){.opv-cols{grid-template-columns:400px minmax(0,1fr);align-items:start}.opv-cols>:last-child{position:sticky;top:90px}}'
    + '.opv-grid{display:grid;gap:14px}'
    + '.opv-carte{background:var(--opv-carte);border-radius:var(--opv-r);box-shadow:var(--opv-lift);border:1px solid var(--opv-ligne)}'
    + '.opv-bloc{padding:14px 16px}.opv-bloc h2{font-size:16px;margin-bottom:4px}'
    + '.opv-effet{margin:2px 0 6px;font-size:13px;color:var(--opv-muted);min-height:18px}.opv-effet b{color:var(--opv-encre)}'
    + '.opv-bareme{width:100%;border-collapse:collapse;font-size:14px}.opv-bareme th{text-align:left;font-size:13px;color:var(--opv-muted);font-weight:600;padding:6px 4px}'
    + '.opv-bareme td{padding:2px 4px;border-top:1px solid var(--opv-ligne);vertical-align:middle}.opv-bareme td:first-child{width:34px;font-weight:700;color:var(--opv-vert-dd)}'
    + '.opv-bareme .opv-regl label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.opv-bareme .opv-regl-l{justify-content:flex-end}'
    + '.opv-seg{display:inline-flex;background:rgba(16,19,28,.05);border-radius:var(--opv-pill);padding:3px}'
    + '.opv-seg button{border:0;background:transparent;border-radius:var(--opv-pill);padding:0 14px;min-height:44px;font-size:13px;color:var(--opv-muted);cursor:pointer}'
    + '.opv-seg button[aria-pressed="true"]{background:#fff;color:var(--opv-encre);font-weight:600;box-shadow:0 1px 2px rgba(16,19,28,.08),0 4px 12px -6px rgba(16,19,28,.18)}'
    + '.opv-qsel{display:flex;width:100%;margin:4px 0 6px}.opv-qsel button{flex:1 1 0;padding:0 4px}'
    + '.opv-montee{margin:8px 0 0;padding:10px 12px;border-radius:var(--opv-r-md);background:var(--opv-fond);font-size:13px;color:var(--opv-muted);line-height:1.6;font-variant-numeric:tabular-nums}.opv-montee b{color:var(--opv-encre);font-weight:600}'
    + '.opv-regl{display:grid;gap:4px}.opv-regl-l{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.opv-regl-l label{font-size:14px}'
    + '.opv-regl-l output{font-weight:700;font-variant-numeric:tabular-nums;color:var(--opv-vert-dd);white-space:nowrap}.opv-regl-l output.opv-bouge{color:var(--opv-ambre)}'
    + '.opv input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:44px;background:transparent;margin:0;cursor:pointer}'
    + '.opv input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(90deg,var(--opv-vert) 0 var(--p,50%),#dfe6e2 var(--p,50%) 100%)}'
    + '.opv input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-11px;border-radius:50%;background:#fff;border:2px solid var(--opv-vert-d);box-shadow:0 2px 6px rgba(16,19,28,.18)}'
    + '.opv input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:#dfe6e2}.opv input[type=range]::-moz-range-progress{height:6px;border-radius:6px;background:var(--opv-vert)}'
    + '.opv input[type=range]::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:#fff;border:2px solid var(--opv-vert-d)}'
    + '.opv input[type=range]:focus-visible{outline:2px solid var(--opv-vert);outline-offset:2px;border-radius:8px}'
    + '.opv-puces{display:flex;gap:6px;flex-wrap:wrap}.opv-puce{border:1px solid var(--opv-ligne-2);background:#fff;border-radius:var(--opv-pill);min-height:44px;min-width:44px;padding:0 12px;font-size:13px;cursor:pointer}'
    + '.opv-puce[aria-pressed="true"]{background:var(--opv-vert-d);border-color:var(--opv-vert-d);color:#fff;font-weight:600}'
    + '.opv-btn{border:0;border-radius:12px;min-height:44px;padding:0 16px;font-size:14px;font-weight:600;cursor:pointer}'
    + '.opv-btn-vert{background:var(--opv-vert-d);color:#fff;box-shadow:0 4px 12px rgba(78,159,112,.26),0 1px 0 rgba(255,255,255,.2) inset}.opv-btn-doux{background:var(--opv-vert-cl);color:var(--opv-vert-dd)}'
    + '.opv-sims{margin-top:4px}.opv-sims .opv-t{display:none}'
    + '.opv-sim{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;width:100%;margin:0;padding:11px 10px;border:0;border-top:1px solid var(--opv-ligne);background:transparent;color:inherit;font:inherit;text-align:left}'
    + 'button.opv-sim{cursor:pointer;min-height:44px}button.opv-sim:hover{background:var(--opv-fond)}'
    + '.opv-sim.opv-moi{background:var(--opv-vert-cl2);border-radius:var(--opv-r-md);border-top-color:transparent}.opv-sim.opv-moi .opv-n b{color:var(--opv-vert-dd)}'
    + '.opv-sim.opv-b{background:#f6f3ea;border-radius:var(--opv-r-md);border-top-color:transparent}.opv-sim.opv-b .opv-n b{color:var(--opv-ambre)}'
    + '.opv-sim .opv-n{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;gap:4px 8px;flex-wrap:wrap}.opv-sim .opv-n b{font-size:15px}.opv-sim .opv-n span{font-size:13px;color:var(--opv-muted)}'
    + '.opv-sim .opv-c{min-width:0}.opv-sim .opv-c .opv-l{display:block;font-size:13px;color:var(--opv-muted)}.opv-sim .opv-c b{font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap}'
    + '.opv-sim .opv-c .opv-d{display:block;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}'
    + '@media(min-width:960px){.opv-sims .opv-t,.opv-sim{grid-template-columns:minmax(0,1.5fr) repeat(4,minmax(0,1fr));align-items:baseline}.opv-sims .opv-t{display:grid;gap:6px 12px;padding:0 10px 6px;font-size:13px;font-weight:600;color:var(--opv-muted)}.opv-sims .opv-t span{text-align:right}'
    + '.opv-sim .opv-n{grid-column:auto;display:block}.opv-sim .opv-n span{display:block}.opv-sim .opv-c{text-align:right}.opv-sim .opv-c .opv-l{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}'
    + '.opv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}'
    + '.opv-suivi .opv-lg{display:flex;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--opv-ligne);font-size:14px}.opv-suivi .opv-lg:first-of-type{border-top:0}.opv-suivi .opv-lg b{font-variant-numeric:tabular-nums;text-align:right}'
    + '.opv-note{font-size:13px;color:var(--opv-muted);margin:4px 0 14px}.opv-note b{color:var(--opv-encre);font-weight:600}'
    + '.opv-calc{margin-top:14px;padding:16px}.opv-calc h2{font-size:18px}.opv-calc h3{font-size:16px;margin:22px 0 4px}'
    + '.opv-lien{border:0;background:none;padding:0;min-height:44px;color:var(--opv-vert-dd);font-weight:600;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'
    + '.opv-casc{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}'
    + '.opv-casc li{display:grid;grid-template-columns:34px minmax(0,1fr);gap:4px 10px;align-items:center;padding:10px 12px;border-radius:var(--opv-r-md);background:var(--opv-fond)}'
    + '.opv-casc li.opv-fort{background:var(--opv-vert-cl2);box-shadow:inset 0 0 0 1px var(--opv-ligne-2)}'
    + '.opv-casc .opv-op{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--opv-vert-dd);font-weight:800;font-size:16px;box-shadow:0 1px 2px rgba(16,19,28,.08)}'
    + '.opv-casc .opv-q b{display:block;font-size:14px}.opv-casc .opv-q span{font-size:13px;color:var(--opv-muted)}'
    + '.opv-casc .opv-v{grid-column:2;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-family:ui-rounded,"SF Pro Rounded",-apple-system,system-ui,sans-serif;font-weight:700;font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}'
    + '.opv-casc .opv-v small{font-family:-apple-system,system-ui,sans-serif;font-size:13px;font-weight:500;color:var(--opv-muted)}'
    + '.opv-casc .opv-det{grid-column:2/-1;font-size:13px;color:var(--opv-muted);font-variant-numeric:tabular-nums}.opv-casc .opv-det b{color:var(--opv-encre);font-weight:600}'
    + '.opv-alerte{margin:8px 0 0;padding:10px 12px;border-radius:var(--opv-r-md);background:var(--opv-ambre-cl);color:#5a3d00;font-size:13px}'
    + '.opv-regle{margin:10px 0 4px;padding:12px;border-radius:var(--opv-r-md);background:var(--opv-fond)}'
    + '.opv-piste{position:relative;height:6px;margin:18px 8px 8px;border-radius:6px;background:linear-gradient(90deg,var(--opv-cran-1),var(--opv-cran-5))}'
    + '.opv-cr{position:absolute;top:-5px;width:2px;height:16px;background:#fff;transform:translateX(-1px)}'
    + '.opv-pt{position:absolute;top:-9px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#fff;border:3px solid var(--opv-vert-dd);box-shadow:0 2px 6px rgba(16,19,28,.2);transition:left .35s var(--opv-ease-out)}'
    + '.opv-bouts{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--opv-muted)}.opv-bouts b{color:var(--opv-encre)}'
    + '.opv-outils{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 6px}'
    + '.opv-outils input[type=search]{flex:1 1 200px;min-height:44px;border:1px solid var(--opv-ligne-2);border-radius:12px;padding:0 12px;font-size:16px;background:#fff;color:var(--opv-encre)}'
    + '.opv-prods{border-top:1px solid var(--opv-ligne)}'
    + '.opv-pr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:10px 0;border-bottom:1px solid var(--opv-ligne)}.opv-pr .opv-nom{font-weight:600;font-size:14px;overflow-wrap:anywhere}'
    + '.opv-pr .opv-ca{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.opv-pr .opv-f{font-size:13px;font-variant-numeric:tabular-nums}'
    + '.opv-pr .opv-mg{text-align:right;font-size:13px;color:var(--opv-vert-dd);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.opv-pr .opv-src{grid-column:1/-1;font-size:13px;color:var(--opv-muted)}'
    + '.opv-hors{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:var(--opv-pill);background:var(--opv-ambre-cl);color:var(--opv-ambre);font-size:13px;font-weight:600;white-space:nowrap}'
    + '.opv-ptot{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:12px 0 4px;font-weight:700;font-variant-numeric:tabular-nums}.opv-ptot .opv-r{text-align:right}.opv-ptot .opv-s{grid-column:1/-1;font-weight:500;font-size:13px;color:var(--opv-muted)}'
    + '@media(min-width:960px){.opv-calc{padding:20px 24px}.opv-casc li{grid-template-columns:34px minmax(0,1fr) 220px}.opv-casc .opv-v{grid-column:3;grid-row:1/3;display:block;text-align:right}.opv-casc .opv-v small{display:block}.opv-casc .opv-det{grid-column:2/3}'
    + '.opv-pr{grid-template-columns:minmax(0,1fr) 300px 110px 110px;align-items:baseline}.opv-pr .opv-src{grid-column:1/2}.opv-pr .opv-f{grid-row:1;grid-column:2}}'
    + '.opv-msg{padding:28px 16px;text-align:center;color:var(--opv-muted)}';
  function injectStyle() {
    if (document.getElementById('opv-style')) return;
    var st = document.createElement('style'); st.id = 'opv-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  // ── État de l'écran ──
  var E = { o: null, B: null, tab: 'neg', qCh: 0, tri: 'ca', tout: false, q: '', M: null, charge: false, echec: false, suiviEssais: 0, contratAsk: false };
  var calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function roule(el, val, fmt) {
    if (!el) return;
    var de = parseFloat(el.dataset.v || 'NaN'); el.dataset.v = val;
    if (calme || isNaN(de) || de === val) { el.textContent = fmt(val); return; }
    var t0 = performance.now(), d = 420;
    cancelAnimationFrame(el._raf);
    (function pas(t) {
      var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(de + (val - de) * e);
      if (p < 1) el._raf = requestAnimationFrame(pas);
    })(t0);
  }

  function entete(inner) {
    return V2.topbar({ back: true }) + '<div class="v2-wrap opv">' + inner + '</div>';
  }

  // ── Suivi réel : mois complets de l'année lus dans les ventes de l'app ──
  function suivi() {
    var R = V2.opsoRemuneration;
    if (!R || !R.moisComplets) return { etat: 'attente' };
    // Le calcul parcourt toutes les ventes : refait seulement quand elles (ou le réglage) changent, pas à chaque mouvement de curseur.
    var cle = [(V2.sales || []).length, window.OPSO_CONTRAT ? 1 : 0, window.PROD_STATS ? window.PROD_STATS.length : 0].join('|');
    if (E.suiviCle === cle && E.suiviVal) return E.suiviVal;
    var r = null;
    try { r = R.moisComplets(E.M.D.annee); } catch (e) { r = null; }
    var v = r ? { etat: 'ok', r: r } : { etat: 'attente' };
    if (r) { E.suiviCle = cle; E.suiviVal = v; }
    return v;
  }
  // Le réglage du contrat (exclusions du CA compté) n'est demandé que par l'accueil : on le demande ici aussi, une fois.
  function demanderContrat() {
    if (E.contratAsk || !V2.loadFiles || window.OPSO_CONTRAT) return;
    E.contratAsk = true;
    function fin() {
      try { delete V2.protegeEchec.opsocontrat; delete V2.protegeEchec['opso-contrat-data.js']; } catch (e) {}
      majSuivi();
    }
    try { V2.loadFiles(['opsocontrat']).then(fin, fin); } catch (e) { fin(); }
  }

  // ── Rendu principal ──
  function render(root) {
    if (!acces()) { root.innerHTML = ''; setTimeout(function () { V2.go('home'); }, 0); return; }
    injectStyle();
    if (!window.OPSO_PREVISION_MOTEUR) { root.innerHTML = entete('<div class="opv-msg">Écran indisponible.</div>'); return; }
    if (!window.OPSO_PREVISION) {
      if (E.echec) {
        root.innerHTML = entete('<div class="opv-msg"><b>Les chiffres de la prévision n\'ont pas pu être chargés.</b><br>Vérifiez que votre session est ouverte, puis rouvrez cet écran.<br><button type="button" class="opv-btn opv-btn-doux" id="opv-reessai" style="margin-top:12px">Réessayer</button></div>');
        var rb = document.getElementById('opv-reessai');
        if (rb) rb.onclick = function () { E.echec = false; render(root); };
        return;
      }
      root.innerHTML = entete('<div class="opv-msg">Chargement de la prévision…</div>');
      if (!E.charge && V2.loadFiles) {
        E.charge = true;
        var fin = function () {
          E.charge = false;
          try { delete V2.protegeEchec.opsoprevision; delete V2.protegeEchec['opso-prevision-2027-data.js']; } catch (e) {}
          if (!window.OPSO_PREVISION) E.echec = true;
          if (V2.route && V2.route.name === ROUTE) V2.render();
        };
        try { V2.loadFiles(['opsoprevision']).then(fin, fin); } catch (e) { fin(); }
      }
      return;
    }
    if (!E.M) { E.M = window.OPSO_PREVISION_MOTEUR(window.OPSO_PREVISION); E.o = E.M.defauts(); }
    var M = E.M, P = M.P, D = M.D, U = D.ui;

    var qNoms = P.quads.map(function (q) { return q.nom.replace(' ' + D.annee, ''); });
    var html = ''
      + '<span class="opv-verrou"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>Will · Pascale · Alexandre</span>'
      + '<h1 class="opv-titre">Prévision du contrat ' + D.annee + '</h1>'
      + '<p class="opv-sous">La table de négociation : les curseurs d\'abord, le suivi réel dans le second onglet.</p>'
      + '<div class="opv-onglets" role="tablist"><button type="button" role="tab" aria-selected="' + (E.tab === 'neg') + '" data-t="neg">Négocier</button><button type="button" role="tab" aria-selected="' + (E.tab === 'sui') + '" data-t="sui">Où on en est</button></div>'
      + '<div class="opv-haut">'
      + '<div><span>Versé à OPSO</span><b class="opv-num" id="opv-h-rfa"></b><span class="opv-d" id="opv-h-rfa-d"></span></div>'
      + '<div><span>CA ' + D.annee + ' compté</span><b class="opv-num" id="opv-h-ca"></b><span class="opv-d" id="opv-h-ca-d"></span></div>'
      + '<div><span>Il nous reste</span><b class="opv-num" id="opv-h-reste"></b><span class="opv-d" id="opv-h-reste-d"></span></div></div>'
      + '<div id="opv-neg"><div class="opv-cols"><div class="opv-grid">'
      + '<section class="opv-carte opv-bloc"><h2>Combien de pharmacies</h2><p class="opv-effet" id="opv-e-n"></p><div id="opv-z-n"></div></section>'
      + '<section class="opv-carte opv-bloc"><h2>Combien achète chacune</h2><p class="opv-effet" id="opv-e-b"></p><div id="opv-z-b"></div></section>'
      + '<section class="opv-carte opv-bloc"><h2>Le barème : seuils et taux</h2><p class="opv-effet">Les seuils montent à chaque quadrimestre. Seuil par mois, multiplié par le nombre de mois du quadrimestre ; chaque taux ne porte que sur la part au-dessus.</p>'
      + '<div class="opv-seg opv-qsel" role="group" aria-label="Quadrimestre des seuils" id="opv-qsel"></div>'
      + '<table class="opv-bareme"><thead><tr><th>Cran</th><th>Seuil / mois</th><th>Taux</th></tr></thead><tbody id="opv-bar"></tbody></table>'
      + '<p class="opv-montee" id="opv-montee"></p></section></div>'
      + '<section class="opv-carte opv-bloc"><h2>Les simulations</h2><p class="opv-effet" id="opv-e-sims"></p><div class="opv-sims" id="opv-sims"></div>'
      + '<div class="opv-actions"><button type="button" class="opv-btn opv-btn-vert" id="opv-garde">Garder ce réglage comme proposition B</button><button type="button" class="opv-btn opv-btn-doux" id="opv-remet">Revenir au plan</button>'
      + '<button type="button" class="opv-btn opv-btn-doux" id="opv-pdf">Ouvrir le document du plan (PDF)</button></div>'
      + '<button type="button" class="opv-lien" id="opv-vers-calc">D\'où viennent ces chiffres ↓</button></section></div>'
      + '<section id="opv-calc" class="opv-carte opv-calc" aria-labelledby="opv-calc-t"><h2 id="opv-calc-t">D\'où viennent ces chiffres</h2>'
      + '<p class="opv-effet">Le panier d\'une pharmacie se construit produit par produit : le catalogue OPSO, à la rotation du palier, plus ce qu\'elle achète déjà ailleurs. Puis l\'année : le panier × les pharmacies, le barème, notre marge.</p>'
      + '<div id="opv-calc-puces"></div><ol class="opv-casc" id="opv-casc"></ol><p class="opv-alerte" id="opv-calc-alerte" hidden></p>'
      + '<h3>Le catalogue OPSO, produit par produit</h3><p class="opv-petit" id="opv-rot-note"></p>'
      + '<div class="opv-regle" aria-hidden="true"><div class="opv-piste" id="opv-piste"></div><div class="opv-bouts"><span><b>Palier 1</b> · rythme moyen du réseau</span><span><b>Palier ' + P.BUD.length + '</b> · rythme des pharmacies qui le commandent</span></div></div>'
      + '<div class="opv-outils"><input type="search" id="opv-q" placeholder="Chercher un produit" aria-label="Chercher un produit du catalogue">'
      + '<div class="opv-seg" role="group" aria-label="Trier les produits" id="opv-tri"><button type="button" data-k="ca" aria-pressed="true">Par CA</button><button type="button" data-k="marge" aria-pressed="false">Par notre marge</button></div></div>'
      + '<div class="opv-prods" id="opv-prods"></div><div class="opv-ptot" id="opv-ptot"></div><button type="button" class="opv-btn opv-btn-doux" id="opv-tout"></button>'
      + '<h3>Leurs autres achats</h3><p class="opv-petit" id="opv-autres-note"></p></section></div>'
      + '<div id="opv-sui" hidden><div class="opv-note" id="opv-sui-note"></div><section class="opv-carte opv-bloc opv-suivi"><h2 id="opv-s-t"></h2><div id="opv-s-l"></div></section></div>';
    root.innerHTML = entete(html);

    // ── curseurs ──
    var ecoutes = [];
    function curseur(def) {
      var id = 'opv-c-' + def.cle + (def.q == null ? '' : '-q' + def.q) + (def.i == null ? '' : '-' + def.i);
      var w = document.createElement('div'); w.className = 'opv-regl';
      w.innerHTML = '<div class="opv-regl-l"><label for="' + id + '">' + def.label + '</label><output for="' + id + '"></output></div>' +
        '<input type="range" id="' + id + '" min="' + def.min + '" max="' + def.max + '" step="' + def.pas + '">';
      var inp = w.querySelector('input'), out = w.querySelector('output');
      function tab(o) { return def.q == null ? o[def.cle] : o[def.cle][def.q]; }
      function lire() { return def.i == null ? E.o[def.cle] : tab(E.o)[def.i]; }
      function ref() { var d = M.defauts(); return def.i == null ? d[def.cle] : tab(d)[def.i]; }
      function peint() {
        var v = lire(); inp.value = v; out.textContent = def.fmt(v);
        out.classList.toggle('opv-bouge', Math.abs(v - ref()) > 1e-9);
        inp.style.setProperty('--p', ((v - def.min) / (def.max - def.min) * 100) + '%');
      }
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (def.i == null) E.o[def.cle] = v; else tab(E.o)[def.i] = v;
        if (def.cle === 'b') E.o.palier = -1;
        peint(); change();
      });
      ecoutes.push(peint); peint();
      return w;
    }
    function puces() {
      var w = document.createElement('div'); w.className = 'opv-puces'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', 'Panier d\'un palier du plan');
      P.BUD.forEach(function (b, k) {
        var x = document.createElement('button'); x.type = 'button'; x.className = 'opv-puce'; x.setAttribute('data-k', k); x.textContent = 'Palier ' + (k + 1);
        x.onclick = function () { E.o.b = b; E.o.palier = k; change(); };
        w.appendChild(x);
      });
      ecoutes.push(function () { w.querySelectorAll('.opv-puce').forEach(function (x) { x.setAttribute('aria-pressed', +x.getAttribute('data-k') === E.o.palier); }); });
      return w;
    }
    $('z-n').appendChild(curseur({ cle: 'n', min: 0, max: U.nMax, pas: 1, label: 'Nouvelles pharmacies par mois', fmt: function (v) { return M.nb(v) + ' / mois'; } }));
    $('z-b').appendChild(curseur({ cle: 'b', min: U.bMin, max: U.bMax, pas: U.bPas, label: 'Panier compté pour la RFA, par pharmacie', fmt: function (v) { return M.eur(v) + ' / mois'; } }));
    $('z-b').appendChild(puces());
    for (var i = 0; i < P.TAUX.length; i++) {
      var tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td'), t = document.createElement('td');
      a.textContent = i + 1;
      if (i) P.quads.forEach(function (qd, q) {
        var w = curseur({ cle: 'seuils', q: q, i: i, min: U.sMin, max: U.sMax, pas: U.sPas, label: 'Seuil du cran ' + (i + 1) + ', ' + qNoms[q] + ' (par mois)', fmt: M.keur });
        w.setAttribute('data-q', q); w.hidden = q !== E.qCh; b.appendChild(w);
      }); else b.innerHTML = '<span class="opv-petit">dès le 1er euro</span>';
      t.appendChild(curseur({ cle: 'taux', i: i, min: U.tMin, max: U.tMax, pas: U.tPas, label: 'Taux du cran ' + (i + 1), fmt: M.pct }));
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(t); $('bar').appendChild(tr);
    }
    P.quads.forEach(function (qd, q) {
      var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = qNoms[q]; bt.setAttribute('aria-pressed', q === E.qCh);
      bt.onclick = function () {
        E.qCh = q; $('qsel').querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', y === bt); });
        $('bar').querySelectorAll('.opv-regl[data-q]').forEach(function (w) { w.hidden = +w.getAttribute('data-q') !== q; });
      };
      $('qsel').appendChild(bt);
    });

    // ── onglets, boutons ──
    function montrerOnglet() {
      $('neg').hidden = E.tab !== 'neg'; $('calc').hidden = E.tab !== 'neg'; $('sui').hidden = E.tab !== 'sui';
      root.querySelectorAll('.opv-onglets button').forEach(function (y) { y.setAttribute('aria-selected', y.getAttribute('data-t') === E.tab); });
    }
    root.querySelector('.opv-onglets').onclick = function (e) {
      var x = e.target.closest('[data-t]'); if (!x) return; E.tab = x.getAttribute('data-t'); montrerOnglet(); if (E.tab === 'sui') majSuivi();
    };
    montrerOnglet();
    $('vers-calc').onclick = function () { $('calc').scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' }); };
    $('pdf').onclick = function () { V2.ouvrirDocProtege('planOpso2027'); };
    $('remet').onclick = function () { E.o = M.defauts(); change(); };
    $('garde').onclick = function () { E.B = { tot: JSON.parse(JSON.stringify(calcule().plan.tot)), o: JSON.parse(JSON.stringify(E.o)) }; change(); };
    $('sims').onclick = function (e) { var x = e.target.closest('[data-k]'); if (!x) return; E.o.b = P.BUD[+x.getAttribute('data-k')]; E.o.palier = +x.getAttribute('data-k'); change(); };
    $('tri').onclick = function (e) { var x = e.target.closest('[data-k]'); if (!x) return; E.tri = x.getAttribute('data-k'); this.querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', y === x); }); change(); };
    $('q').value = E.q; $('q').oninput = function () { E.q = this.value.trim().toLowerCase(); change(); };
    $('tout').onclick = function () { E.tout = !E.tout; change(); };

    // ── d'où viennent les chiffres : parties fixes ──
    var X = D.detail;
    $('calc-puces').appendChild(puces());
    P.BUD.forEach(function (b, k) { var c = document.createElement('i'); c.className = 'opv-cr'; c.style.left = (k / (P.BUD.length - 1) * 100) + '%'; $('piste').appendChild(c); });
    var pt = document.createElement('i'); pt.className = 'opv-pt'; $('piste').appendChild(pt);
    var nbHors = X.lignes.filter(function (x) { return !x.rfa; }).length;
    var b0 = D.base2026.mois, periode = 'de ' + M.MOIS_L[b0[0].m - 1] + ' à ' + M.MOIS_L[b0[b0.length - 1].m - 1] + ' ' + D.base2026.annee;   // période mesurée, lue dans les données
    $('rot-note').innerHTML = 'Rotation = boîtes vendues ' + periode + ' dans le réseau Intégral (' + M.nb(X.reseau.pharmacies) + ' pharmacies), divisées par leurs mois d\'activité. ' +
      '<b>Rythme moyen</b> : toutes les pharmacies, même celles qui ne commandent pas le produit. <b>Qui le commandent</b> : seulement celles qui l\'ont commandé au moins une fois. ' + esc(D.textes.paliersRot);
    $('autres-note').innerHTML = M.nb(X.autres.produits) + ' produits hors catalogue, mesurés chez les pharmacies OPSO ' + periode + ' (' + M.nb(X.phMois2026) + ' mois de pharmacie, achats comptés dès le mois d\'adhésion) : <b>' + M.eur(X.autres.ca) +
      '</b> par pharmacie et par mois, dont ' + M.eur(X.autres.retenu) + ' comptés pour la RFA, notre marge <b>' + M.e2(X.autres.marge) + '</b> (règle ' + D.annee + ', boîte par boîte). Le plan les garde tels quels à tous les paliers : seul le catalogue monte.';

    // ── calculs et rafraîchissement ──
    var D0 = M.defauts();
    var refs = P.BUD.map(function (b, k) { return M.annee(Object.assign(M.defauts(), { b: b, palier: k }), []).tot; });
    function suiviMois() { var s = suivi(); return s.etat === 'ok' ? s.r.mois : []; }
    function calcule() {
      var plan = M.annee(E.o, []), mois = suiviMois(), cs = M.constate(mois), proj = plan;
      if (cs) proj = M.annee(Object.assign({}, E.o, { n: cs.rythme, b: cs.panier }), cs.reel);
      return { plan: plan, proj: proj, k: mois.length, o: E.o };
    }
    function ecart(x, fmt) { var s = fmt(Math.abs(x)); return Math.abs(x) < 0.5 || /^0 /.test(s) ? '' : (x > 0 ? '+' : '−') + s; }
    function dl(el, v, r, nom, fmt) { var s = ecart(v - r, fmt); el.className = 'opv-d ' + (!s ? '' : v > r ? 'opv-p' : 'opv-m'); el.textContent = s ? s + ' / ' + nom : 'comme le ' + nom; }
    var COLS = [['CA ' + D.annee + ' compté', 'ca', M.kE], ['Décembre', 'dec', M.kE], ['RFA versée à OPSO', 'rfa', M.eur], ['Il nous reste', 'reste', M.eur]];
    function ligne(tag, cls, attrs, nom, sous, t, r) {
      return '<' + tag + ' class="opv-sim ' + cls + '"' + attrs + '><span class="opv-n"><b>' + nom + '</b><span>' + sous + '</span></span>' + COLS.map(function (k) {
        var s = r ? ecart(t[k[1]] - r[k[1]], k[2]) : '';
        return '<span class="opv-c"><span class="opv-l">' + k[0] + '</span><b>' + k[2](t[k[1]]) + '</b>' + (s ? '<span class="opv-d ' + (t[k[1]] > r[k[1]] ? 'opv-p' : 'opv-m') + '">' + s + ' / plan</span>' : '') + '</span>';
      }).join('') + '</' + tag + '>';
    }

    function change() { var c = calcule(); ecoutes.forEach(function (f) { f(c); }); peintre(c); }

    function peintre(c) {
      var o = c.o, T = c.plan.tot, Qd = c.plan.quads, Z = M.detail(o), C = Z.cat, A = Z.autres, Pn = Z.panier;
      pt.style.left = (Z.a * 100) + '%';
      var nomP = o.palier >= 0 ? 'Palier ' + (o.palier + 1) : 'Votre panier';
      var nNeuf = Math.round(T.primes / P.PRIME);
      var r = refs[o.palier >= 0 ? o.palier : 0], nom = o.palier >= 0 ? 'plan' : 'palier 1';
      roule($('h-rfa'), T.rfa, M.eur); roule($('h-ca'), T.ca, M.kE); roule($('h-reste'), T.reste, M.eur);
      dl($('h-rfa-d'), T.rfa, r.rfa, nom, M.eur); dl($('h-ca-d'), T.ca, r.ca, nom, M.kE); dl($('h-reste-d'), T.reste, r.reste, nom, M.eur);
      // les simulations
      var bouge = o.n !== D0.n || o.seuils.some(function (sq, q) { return sq.some(function (s, i) { return Math.abs(s - D0.seuils[q][i]) > 1e-9; }); }) || o.taux.some(function (s, i) { return Math.abs(s - D0.taux[i]) > 1e-9; });
      $('e-sims').innerHTML = M.nb(P.P0) + ' pharmacies en janvier, + ' + M.nb(o.n) + ' par mois, ' + M.nb(T.finDec) + ' fin décembre · seuils par mois, du cran 2 au cran ' + o.taux.length + ' : ' +
        o.seuils.map(function (sq) { return M.keur(sq[1]) + ' à ' + M.keur(sq[sq.length - 1]); }).join(' · ') + ' (' + qNoms.join(' · ').toLowerCase() + '). ' +
        (bouge ? '<b>Rythme ou barème modifié</b> : sous chaque chiffre, l\'écart avec le plan.' : 'Ce sont les chiffres du plan.') + ' Choisissez une ligne pour régler les curseurs sur ce palier.';
      var rows = P.BUD.map(function (b, k) {
        var t = o.palier === k ? T : M.annee(Object.assign({}, o, { b: b, palier: k }), []).tot;
        return { b: b, h: ligne('button', o.palier === k ? 'opv-moi' : '', ' type="button" data-k="' + k + '" aria-pressed="' + (o.palier === k) + '"', 'Palier ' + (k + 1), M.eur(b) + ' comptés / pharmacie / mois', t, refs[k]) };
      });
      if (o.palier < 0) rows.push({ b: o.b, h: ligne('div', 'opv-moi', '', 'Votre panier', M.eur(o.b) + ' comptés / pharmacie / mois', T, null) });
      rows.sort(function (x, y) { return x.b - y.b; });
      $('sims').innerHTML = '<div class="opv-t" aria-hidden="true"><span></span>' + COLS.map(function (k) { return '<span>' + k[0] + '</span>'; }).join('') + '</div>' +
        rows.map(function (x) { return x.h; }).join('') +
        (E.B ? ligne('div', 'opv-b', '', 'Proposition B', M.eur(E.B.o.b) + ' comptés · + ' + M.nb(E.B.o.n) + ' pharmacies / mois', E.B.tot, null) : '');
      $('montee').innerHTML = '<b>La montée, par mois</b><br>' + o.seuils[0].map(function (x, k) { return k; }).slice(1).map(function (k) {
        return 'cran ' + (k + 1) + ' : ' + o.seuils.map(function (sq) { return M.nb(sq[k] / 1000); }).join(' → ') + ' k€';
      }).join('<br>');
      // effet de chaque curseur, mesuré en direct
      var A1 = M.annee(Object.assign({}, o, { n: o.n + 1 }), []).tot, A2 = M.annee(Object.assign({}, o, { b: o.b + U.bStep }), []).tot;
      $('e-n').innerHTML = 'Une pharmacie de plus par mois : <b>' + M.signe(A1.rfa - T.rfa) + '</b> pour OPSO, <b>' + M.signe(A1.reste - T.reste) + '</b> pour nous.';
      $('e-b').innerHTML = M.eur(U.bStep) + ' de plus par pharmacie et par mois : <b>' + M.signe(A2.rfa - T.rfa) + '</b> pour OPSO, <b>' + M.signe(A2.reste - T.reste) + '</b> pour nous.';
      // d'où viennent les chiffres
      var L = [
        ['', 'Catalogue OPSO', M.nb(X.lignes.length) + ' produits × leur rotation par pharmacie', M.eur(C.ca), 'par pharmacie et par mois',
          'dont <b>' + M.eur(C.retenu) + '</b> comptés pour la RFA · notre marge <b>' + M.e2(C.marge) + '</b> · ' + M.nb(C.boites) + ' boîtes · aujourd\'hui elles en prennent ' + M.eur(X.cat2026.ca)],
        ['+', 'Leurs autres achats', 'hors catalogue, mesurés en ' + D.base2026.annee, M.eur(A.ca), 'par pharmacie et par mois', 'dont <b>' + M.eur(A.retenu) + '</b> comptés · notre marge <b>' + M.e2(A.marge) + '</b>'],
        ['=', 'Le panier d\'une pharmacie', nomP, M.eur(Pn.ca), 'par mois', '<b>' + M.eur(Pn.retenu) + '</b> comptés pour la RFA · notre marge <b>' + M.e2(Pn.marge) + '</b> (' + M.pct(Pn.marge / Pn.ca) + ' du panier)', true],
        ['×', M.nb(T.moisPh) + ' mois de pharmacie en ' + D.annee, P.P0 + ' en janvier, + ' + M.nb(o.n) + ' par mois, ' + M.nb(T.finDec) + ' fin décembre', M.eur(T.ca), 'comptés pour la RFA',
          M.eur(o.b) + ' × ' + M.nb(T.moisPh) + ' · notre marge <b>' + M.eur(T.marge) + '</b>'],
        ['→', 'Le barème, au quadrimestre', 'chaque taux sur la seule part au-dessus du seuil', M.eur(T.rfa), 'versés à OPSO',
          Qd.map(function (x, qi) { return qNoms[qi] + ' <b>' + M.eur(x.rfa) + '</b> (cran ' + (x.cran + 1) + ')'; }).join(' · ')],
        ['=', 'Il nous reste', 'notre marge, moins ce qu\'on paie', M.eur(T.reste), 'sur ' + D.annee,
          M.eur(T.marge) + ' − RFA ' + M.eur(T.rfa) + ' − livraisons ' + M.eur(T.livr) + ' (' + M.nb(T.moisPh) + ' × ' + new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(P.LIV) + ' × ' + M.eur(P.COUT) + ') − primes ' + M.eur(T.primes) + ' (' + nNeuf + ' × ' + M.eur(P.PRIME) + ')', true]];
      $('casc').innerHTML = L.map(function (l) {
        return '<li class="' + (l[6] ? 'opv-fort' : '') + '"><span class="opv-op" aria-hidden="true">' + (l[0] || '·') + '</span><div class="opv-q"><b>' + l[1] + '</b><span>' + l[2] + '</span></div>' +
          '<div class="opv-v">' + l[3] + '<small>' + l[4] + '</small></div><div class="opv-det">' + l[5] + '</div></li>';
      }).join('');
      var al = $('calc-alerte'); al.hidden = !Z.horsBornes;
      if (Z.horsBornes) al.textContent = 'Votre panier (' + M.eur(o.b) + ' comptés) sort des paliers : le catalogue l\'explique jusqu\'à ' + M.eur(Z.a ? P.BUD[P.BUD.length - 1] : P.BUD[0]) +
        '. Au-delà, les chiffres du haut prolongent la même droite (même marge par euro) : c\'est une hypothèse, pas un détail produit.';
      var q = E.q, Ls = Z.lignes.filter(function (l) { return !q || l.x.p.toLowerCase().indexOf(q) >= 0 || l.x.r.toLowerCase().indexOf(q) >= 0; })
        .sort(function (x, y) { return y[E.tri] - x[E.tri]; });
      var vus = (E.tout || q) ? Ls : Ls.slice(0, 12);
      $('prods').innerHTML = vus.map(function (l) {
        var x = l.x;
        return '<div class="opv-pr"><div class="opv-nom">' + esc(x.p) + (x.rfa ? '' : '<span class="opv-hors">hors RFA · ' + esc(x.hors) + '</span>') + '</div>' +
          '<div class="opv-ca">' + M.e2(l.ca) + '</div>' +
          '<div class="opv-f">' + M.e2(x.n) + ' × <b>' + M.rot(l.rot) + '</b> boîte / mois <span class="opv-petit">(moyenne ' + M.rot(x.rm) + ' · qui le commandent ' + M.rot(x.ra) + ')</span></div>' +
          '<div class="opv-mg">marge ' + M.e2(l.marge) + '</div>' +
          '<div class="opv-src">' + esc(x.r) + ' · ' + M.nb(x.na) + ' pharmacies sur ' + M.nb(X.reseau.pharmacies) + ' le commandent · notre marge ' + M.e2(x.mb) + ' la boîte (' + esc(x['case']) + ')</div></div>';
      }).join('') || '<p class="opv-petit">Aucun produit ne correspond.</p>';
      $('ptot').innerHTML = '<span>' + M.nb(X.lignes.length) + ' produits, par pharmacie et par mois</span><span class="opv-r">' + M.e2(C.ca) + '</span>' +
        '<span class="opv-s">dont ' + M.e2(C.retenu) + ' comptés pour la RFA (' + nbHors + ' produits hors RFA : ' + esc(D.textes.horsRfa) + ', ' + M.e2(C.ca - C.retenu) + ')</span><span class="opv-r" style="color:var(--opv-vert-dd)">marge ' + M.e2(C.marge) + '</span>';
      var bt = $('tout'); bt.hidden = !!q || Ls.length <= 12; bt.textContent = E.tout ? 'Ne garder que les 12 premiers' : 'Voir les ' + M.nb(Ls.length) + ' produits';
      majSuivi(c);
    }

    // ── onglet « Où on en est » : mois complets réels ──
    function majSuivi(c) {
      if (!E.M || !$('sui')) return;
      c = c || calcule();
      var s = suivi();
      if (s.etat !== 'ok') {
        demanderContrat();
        $('sui-note').innerHTML = 'Lecture des ventes en cours…';
        $('s-t').textContent = 'Suivi du contrat ' + D.annee; $('s-l').innerHTML = '';
        if (E.suiviEssais < 12) { E.suiviEssais++; setTimeout(function () { if (V2.route && V2.route.name === ROUTE && E.M) { majSuivi(); } }, 800); }
        return;
      }
      var k = c.k, A = c.proj, qi = k === 0 ? 0 : Math.min(P.quads.length - 1, P.quads.findIndex(function (qq) { return k >= qq.de && k <= qq.a; })), q = A.quads[qi];
      var auj = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
      var m0 = D.base2026.mois, mFin = m0[m0.length - 1].m;
      $('sui-note').innerHTML = k === 0
        ? '<b>Aujourd\'hui, ' + esc(auj) + ' :</b> aucun mois complet de ' + D.annee + ' encore. L\'écran montre le plan et, comme point de départ, les ventes réelles de janvier à ' + M.MOIS_L[mFin - 1] + ' ' + D.base2026.annee + '. Un mois s\'ajoute dès qu\'il est complet dans les ventes (le mois en cours n\'est jamais compté).'
        : '<b>Mois complets de ' + D.annee + ' :</b> janvier à ' + M.MOIS_L[k - 1] + '. Le mois en cours n\'est compté que lorsqu\'il est terminé ; la suite de l\'année est projetée au rythme constaté.';
      $('s-t').textContent = k ? 'Fin ' + M.MOIS_L[k - 1] + ' ' + D.annee : 'Avant ' + M.MOIS_L[0] + ' ' + D.annee;
      var Lg = k ? [
        ['Pharmacies qui achètent', M.nb(A.mois[k - 1].fin) + ' · plan ' + M.nb(c.plan.mois[k - 1].fin)],
        ['CA compté du mois', M.eur(A.mois[k - 1].ca) + ' · plan ' + M.eur(c.plan.mois[k - 1].ca)],
        ['Quadrimestre ' + qNoms[qi].toLowerCase(), 'cran ' + (q.cran + 1) + ' · ' + M.pct(q.taux)],
        ['RFA de ce quadrimestre', M.eur(q.rfa) + ' le ' + esc(q.echeance)],
        ['Il manque pour le cran suivant', q.seuilSuivant !== null ? M.eur(q.manque) : 'dernier cran'],
        ['Décembre, au rythme constaté', M.eur(A.tot.dec) + ' (' + M.nb(A.tot.finDec) + ' pharmacies)'],
        ['RFA ' + D.annee + ', au rythme constaté', M.eur(A.tot.rfa)]] : [
        ['Pharmacies au départ', P.P0 + ' (plan fin janvier : ' + M.nb(c.plan.mois[0].fin) + ')'],
        ['Panier ' + D.base2026.annee + ' par pharmacie', M.eur(D.base2026.parPharma) + ' / mois (palier 1 : ' + M.eur(P.BUD[0]) + ')'],
        [M.MOIS_L[mFin - 1].charAt(0).toUpperCase() + M.MOIS_L[mFin - 1].slice(1) + ' ' + D.base2026.annee + ', dernier mois réel', M.eur(m0[m0.length - 1].retenu)],
        ['Plan ' + M.MOIS_L[0] + ' ' + D.annee, M.eur(c.plan.mois[0].ca)],
        ['Premier quadrimestre au plan', 'cran ' + (c.plan.quads[0].cran + 1) + ' · ' + M.eur(c.plan.quads[0].rfa) + ' le ' + esc(c.plan.quads[0].echeance)]];
      $('s-l').innerHTML = Lg.map(function (x) { return '<div class="opv-lg"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    }
    // exposé pour la reprise après chargement des ventes
    E.majSuivi = majSuivi;
    change();
  }

  function majSuivi() { if (E.majSuivi) E.majSuivi(); }

  // Hors accès ou hors écran : on repart de zéro à la déconnexion (autre compte sur le même navigateur)
  V2.pages[ROUTE] = { needs: [], render: render };
  V2.opsoPrevision = { etat: E };
})();
