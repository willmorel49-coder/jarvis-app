/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · TOURNÉES — bloc « La T10, les clientes d'Angers et les Essentiels » (V2.tourneesEssentiels) — 24/11/2026
   Maquette v1 « Carte » choisie par Will le 24/11/2026 : dans #tournees/T10, la carte de la T10 centrée sur Angers, les clientes d'Angers
   en bleu, une bascule « Aujourd'hui / En quotidien » qui ajoute les officines Essentiels Pharma, une liste à droite, les boutons
   « Toute la T10 » et « Zoom Angers ».
   Maquette v1 « Étiquettes » choisie par Will le 24/11/2026 au soir (« plus visuel » et « identifier individuellement ») : chaque Essentiels
   porte un numéro E1, E2… (E.numeroter, dans l'ordre de la tournée), le même sur la carte et dans la liste, avec son nom court écrit à côté
   sur la carte quand il y a la place ; survol et toucher relient la ligne et le numéro ; un bandeau en bas de carte donne le détail.

   - Accroche EXPLICITE : v2-tournees.js appelle monter() après avoir dessiné le tableau de bord de la T10 (pas d'observateur global).
   - DÉCISION DE WILL (24/11/2026) : les Essentiels à plus de 40 km de TOUTE tournée (3 à Paris, Boulogne-Billancourt, Pacy-sur-Eure) sont HORS
     PROJET : ni sur la carte, ni dans la liste, ni dans aucun texte de ce bloc. Elles restent Essentiels dans l'écran Groupements.
   - DONNÉES (aucune dans le dépôt) : TOURNEES_ECRAN (fichier protégé, déjà chargé par l'écran), PHARMA_FR (base nationale publique,
     V2.ensurePharmaFr), GRP_DEPART (les CIP Essentiels, groupement-alias.js), WML_OFFICINES (clientes du CRM, chargées avant tout écran).
     Une donnée manquante = « en cours de chargement », jamais un chiffre faux. AUCUN chiffre écrit en dur : tout est calculé ici (tests/tournees.test.mjs).
   - Fond de carte : V2.fondCarte (jamais CARTO). Accès : celui de l'écran Tournées (interdit() de v2-tournees.js), rien de plus.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var E = {};
  var NBSP = ' ';
  var BLEU = '#0050E6', ENCRE = '#1A2030', TURQ = '#087A70', GRIS = '#6B7A99';
  var SEUIL_LOIN = 40;      // km : au-delà de ce seuil par rapport à la tournée la plus proche, l'officine est hors projet (Will, 24/11/2026)
  E.SEUIL_LOIN = SEUIL_LOIN;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nf(x, d) { return Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).replace(/[  ]/g, NBSP); }
  function eur(x) { return nf(Math.round(x), 0) + NBSP + '€'; }
  function km(x) { return nf(x, x < 10 ? 1 : 0) + NBSP + 'km'; }
  // La base nationale écrit les noms en majuscules sans accent : on ne met que les majuscules et minuscules, rien d'autre.
  function joli(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)l (?=[a-zà-ÿ])/g, '$1l’').replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Du|Des|La|Le|Les|Et|Sur|En|Aux|Au|Sous|L)\b/g, function (m, w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); })
      .replace(/\bSt\b/g, 'Saint').replace(/\bSte\b/g, 'Sainte').replace(/\bPhie\b/g, 'Pharmacie').replace(/l’([a-zà-ÿ])/g, function (m, c) { return 'l’' + c.toUpperCase(); });
  }
  E.joli = joli;

  // ── Calcul pur : distance d'un point à un tracé (projection locale, segments) ──
  function distKm(lat, lng, tr) {
    var k = 111.195, c = Math.cos(lat * Math.PI / 180), best = 1e9;
    for (var i = 0; i < tr.length - 1; i++) {
      var ax = (tr[i][1] - lng) * c * k, ay = (tr[i][0] - lat) * k, bx = (tr[i + 1][1] - lng) * c * k, by = (tr[i + 1][0] - lat) * k, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      var t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0, px = ax + t * dx, py = ay + t * dy, d = Math.sqrt(px * px + py * py);
      if (d < best) best = d;
    }
    return best;
  }
  E.distKm = distKm;

  // Tout le calcul du bloc. T = TOURNEES_ECRAN, PF = PHARMA_FR, G = GRP_DEPART (cip -> groupement), wml = liste des clientes du CRM.
  // Rend null tant qu'une donnée manque. Les Essentiels à plus de SEUIL_LOIN km de toute tournée ne sont PAS dans le résultat.
  E.calculer = function (T, PF, G, wml, code) {
    code = code || 'T10';
    if (!T || !T.tournees || !T.tournees[code] || !PF || !PF.p || !G || !wml) return null;
    var tt = T.tournees[code], pf = {}, cli = {};
    PF.p.forEach(function (p) { pf[String(p[13])] = p; });
    wml.forEach(function (o) { cli[String(o.id)] = o; });
    var arret = {};   // cip -> { code, a } (la première tournée qui livre cette officine)
    Object.keys(T.tournees).forEach(function (c) { (T.tournees[c].arrets || []).forEach(function (a) { if (!arret[a.id]) arret[a.id] = { code: c, a: a }; }); });
    function chiffres(cip) {
      var x = arret[cip]; if (!x || !x.a.r) return null;
      var tot = { ca: 0, m: 0, cmd: 0 }; (x.a.m || []).forEach(function (mm) { if (mm) { tot.ca += mm[0]; tot.m += mm[1]; tot.cmd += mm[2]; } });
      return { code: x.code, ca: tot.ca, marge: tot.m, cmd: tot.cmd, rm: x.a.r.rm };
    }
    var ess = Object.keys(G).filter(function (cip) { return pf[cip]; }).map(function (cip) {
      var p = pf[cip], proche = 1e9, qui = '';
      Object.keys(T.tournees).forEach(function (c) { var d = distKm(p[0], p[1], T.tournees[c].trace); if (d < proche) { proche = d; qui = c; } });
      var pr = null; (tt.prospects || []).forEach(function (r) { if (String(r[0]) === cip) pr = r; });
      return { cip: cip, nom: joli(p[6]), ville: joli(p[7]), cp: p[8], lat: p[0], lng: p[1], cliente: !!cli[cip], arret: arret[cip] ? arret[cip].code : '',
        ch: chiffres(cip), d10: distKm(p[0], p[1], tt.trace), detour: pr ? pr[6] : null, proche: proche, procheCode: qui };
    }).filter(function (e) { return e.proche <= SEUIL_LOIN; })
      // 27/11/2026 : officine fermée (annuaire) non cliente → hors de la carte et de la liste (juge commun V2.pfFermee ; sans lui, rien n'est retiré)
      .filter(function (e) { return e.cliente || !(glob.V2 && glob.V2.pfFermee && glob.V2.pfFermee(pf[e.cip], PF)); })
      .sort(function (a, b) { return a.d10 - b.d10; });
    var angers = Object.keys(cli).filter(function (id) { return /^ANGERS/i.test(cli[id].ville); }).map(function (id) {
      var o = cli[id], a = arret[id];
      return { cip: id, nom: joli(o.name), ville: 'Angers', cp: o.cp, lat: a ? a.a.lat : o.lat, lng: a ? a.a.lng : o.lng, arret: a ? a.code : '', n: a ? a.a.n : null, ch: chiffres(id),
        d10: distKm(a ? a.a.lat : o.lat, a ? a.a.lng : o.lng, tt.trace) };
    }).sort(function (a, b) { return (a.n || 99) - (b.n || 99); });
    var arrets = (tt.arrets || []).map(function (a) { return { n: a.n, id: a.id, nom: joli(a.nom), ville: joli(a.ville), lat: a.lat, lng: a.lng, ch: chiffres(a.id) }; });
    return { code: code, t10: tt, ess: ess, angers: angers, arrets: arrets,
      cl: ess.filter(function (e) { return e.cliente; }), non: ess.filter(function (e) { return !e.cliente; }),
      angersLivrees: angers.filter(function (a) { return a.arret; }), angersSans: angers.filter(function (a) { return !a.arret; }) };
  };

  // Phrase d'introduction (HTML) selon la bascule. Aucun mot sur les officines hors projet.
  E.sousTitre = function (D, mode) {
    return mode === 'quot'
      ? 'Aujourd’hui : <b>' + D.arrets.length + ' arrêts</b> sur la T10, dont <b>' + D.angersLivrees.length + ' clientes à Angers</b>. En quotidien : les <b>' + D.ess.length + ' officines Essentiels</b> s’ajoutent.'
      : 'La T10 telle qu’elle est : <b>' + D.arrets.length + ' arrêts</b>, <b>' + D.angers.length + ' clientes à Angers</b> (' + D.angersLivrees.length + ' livrées, ' + D.angersSans.length + ' sans livraison sur janvier à octobre). Touchez « En quotidien » pour ajouter les Essentiels.';
  };

  // ── Lignes de la liste ──
  function ligneEss(e) {
    var dist = e.d10 < 0.05 ? 'sur la route' : km(e.d10) + ' de la route';
    var det = e.detour != null && e.detour > 0 ? ' · détour ' + nf(e.detour, 1) + NBSP + 'km' : '';
    var liv = e.cliente ? (e.arret ? 'cliente · livrée par ' + e.arret : 'cliente · sans livraison sur janvier à octobre') : 'pas encore cliente';
    return '<button type="button" class="ess-row" data-cip="' + esc(e.cip) + '"><span><b>' + esc(e.nom) + '</b><span>' + esc(e.ville) + ' · ' + liv + '</span></span><em>' + dist + '<small>' +
      (e.d10 > 5 ? (e.proche < 0.05 ? 'sur la route de ' + esc(e.procheCode) : 'plus proche : ' + esc(e.procheCode) + ' à ' + km(e.proche)) : 'T10' + det) + '</small></em></button>';
  }
  function ligneAngers(a) {
    return '<div class="ess-row" data-ang="1"><span><b>' + (a.n ? a.n + ' · ' : '') + esc(a.nom) + '</b><span>Angers ' + esc(a.cp) + ' · ' + (a.arret ? 'livrée par ' + esc(a.arret) : 'aucune livraison sur janvier à octobre') + '</span></span><em>' +
      (a.ch ? eur(a.ch.ca) + '<small>marge ' + eur(a.ch.marge) + ' · ' + a.ch.cmd + ' commandes</small>' : '—<small>pas de chiffres</small>') + '</em></div>';
  }
  E.ligneEss = ligneEss; E.ligneAngers = ligneAngers;

  // ── Numéros E1, E2… (maquette v1 « Étiquettes », choix de Will le 24/11/2026) ──
  function plat(a, b, c, d) { var k = 111.195, co = Math.cos(a * Math.PI / 180); return Math.sqrt(Math.pow((d - b) * co * k, 2) + Math.pow((c - a) * k, 2)); }
  function parCode(a, b) { return String(a).localeCompare(String(b), 'fr', { numeric: true }); }
  // Nom court écrit sur la carte : on retire « Pharmacie de… », rien n'est inventé ; un nom qui ne serait que « Pharmacie » reste entier.
  function court(nom) {
    var s = String(nom || '').replace(/^(Nouvelle |Grande )?Pharmacie\s*/, '').replace(/^(de la |de l’|des |du |de |d’)/, '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(nom || '');
  }
  E.court = court;
  // D = résultat de E.calculer. Rend des COPIES numérotées, D n'est pas modifié :
  //  1) celles dont la tournée la plus proche est celle du bloc (la T10), rangées par arrêt le plus proche (1, 2…) puis par distance à cet arrêt ;
  //  2) les autres, rangées par code de leur tournée la plus proche (T11 avant T15) puis par distance à la route de celle-ci.
  // Les officines hors projet (plus de 40 km de toute tournée) ne sont déjà plus dans D : elles n'ont pas de numéro.
  E.numeroter = function (D) {
    if (!D || !D.ess) return null;
    var ess = D.ess.map(function (e) {
      var o = {}, best = 1e9, ar = null; for (var k in e) o[k] = e[k];
      (D.arrets || []).forEach(function (a) { var x = plat(e.lat, e.lng, a.lat, a.lng); if (x < best) { best = x; ar = a; } });
      o.ap = ar; o.apD = ar ? best : null; o.surT10 = e.procheCode === D.code; o.court = court(e.nom);
      return o;
    });
    var route = ess.filter(function (e) { return e.surT10; }).sort(function (a, b) {
      return ((a.ap ? a.ap.n : 1e9) - (b.ap ? b.ap.n : 1e9)) || ((a.apD || 0) - (b.apD || 0)) || parCode(a.cip, b.cip);
    });
    var autres = ess.filter(function (e) { return !e.surT10; }).sort(function (a, b) { return parCode(a.procheCode, b.procheCode) || (a.proche - b.proche) || parCode(a.cip, b.cip); });
    var tous = route.concat(autres), par = {};
    tous.forEach(function (e, i) { e.no = i + 1; par[e.cip] = e; });
    return { tous: tous, route: route, autres: autres, par: par };
  };

  // Badge E# : plein à récupérer, cerclé déjà cliente. Le même dessin sur la carte, dans la liste, la légende et le bandeau.
  function badge(e) { return '<i class="ess-b' + (e.cliente ? ' cl' : '') + '">E' + e.no + '</i>'; }
  function ligneNum(e) { return ligneEss(e).replace('class="ess-row"', 'class="ess-row ess-nrow"').replace('<span><b>', badge(e) + '<span><b>'); }
  // Bandeau en bas de carte quand on touche une officine : aucun chiffre de vente, seulement où elle est.
  function bandeau(e) {
    var det = e.detour != null && e.detour > 0 ? ' · détour ' + nf(e.detour, 1) + NBSP + 'km' : '';
    return badge(e) + '<div><b>' + esc(e.nom) + '</b><span>' + esc(e.ville) + ' · ' + (e.cliente ? 'déjà cliente' : 'à récupérer') + ' · ' +
      (e.d10 < 0.05 ? 'sur la route' : km(e.d10) + ' de la route') + det + '</span></div>';
  }
  E.badge = badge; E.ligneNum = ligneNum; E.bandeau = bandeau;

  if (typeof module !== 'undefined' && module.exports) module.exports = E;

  // ───────────────────────── Affichage (navigateur seulement) ─────────────────────────
  var etat = { mode: 'quot' };   // la bascule survit à un redessin du tableau de bord

  function tactile() { try { return glob.matchMedia('(pointer: coarse)').matches || glob.innerWidth <= 700; } catch (e) { return false; } }

  function css() {
    if (document.getElementById('ess-css')) return;
    var s = document.createElement('style'); s.id = 'ess-css';
    s.textContent = [
      '.ess{position:relative;margin:0 0 14px;border-radius:20px;border:1px solid #DCE5F7;background:#fff;box-shadow:0 1px 2px rgba(26,32,48,.05),0 14px 34px -14px rgba(0,80,230,.22);overflow:hidden;color:' + ENCRE + ';font-variant-numeric:tabular-nums}',
      '.ess:before{content:"";position:absolute;left:-60px;top:-140px;width:560px;height:360px;background:radial-gradient(closest-side,#F0F5FF 0%,#E3ECFB 45%,rgba(243,245,249,0) 100%);pointer-events:none}',
      '.ess>*{position:relative}',
      '.ess-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:20px 22px 6px}',
      '.ess-k{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:' + BLEU + '}',
      '.ess h2{font-size:22px;font-weight:800;letter-spacing:-.025em;margin:2px 0 0}',
      '.ess-sub{font-size:13.5px;color:#4A5570;margin:4px 22px 0;line-height:1.45;max-width:78ch}',
      '.ess-seg{display:inline-flex;gap:4px;padding:4px;background:#EEF2FA;border:1px solid #DCE5F7;border-radius:999px}',
      '.ess-seg button{font:inherit;font-size:14px;font-weight:700;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:' + ENCRE + ';cursor:pointer}',
      '.ess-seg button.on{background:' + BLEU + ';color:#fff;box-shadow:0 4px 12px -4px rgba(0,80,230,.5)}',
      '.ess-sw{width:12px;height:12px;border-radius:50%;display:inline-block;flex:none}',
      '.ess-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:10px 12px;min-height:44px;border:0;border-bottom:1px solid #EAEFF9;background:transparent;font:inherit;color:inherit;cursor:default;box-sizing:border-box}',
      'button.ess-row{cursor:pointer}button.ess-row:hover{background:#F3F7FF}',
      '.ess-row b{font-size:14px;font-weight:700;display:block}.ess-row span{font-size:12.5px;color:#5A6683;display:block;line-height:1.35;min-width:0}',
      '.ess-row em{font-style:normal;font-weight:800;font-size:13px;white-space:nowrap;color:' + ENCRE + ';text-align:right}',
      '.ess-row em small{display:block;font-weight:600;font-size:11.5px;color:#5A6683}',
      '.ess-pt{width:26px;height:26px;border-radius:50%;background:' + GRIS + ';color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(26,32,48,.35);font:800 11px/22px system-ui;text-align:center}',
      '.ess-pt.ang{background:' + BLEU + ';width:34px;height:34px;line-height:30px;font-size:13px;margin:-4px;box-shadow:0 0 0 5px rgba(0,80,230,.20),0 3px 8px rgba(26,32,48,.4)}',
      // badge E1… (le même sur la carte et dans la liste), étiquette du nom sur la carte, ligne allumée, bandeau du bas de carte
      '.ess-b{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:30px;height:24px;padding:0 6px;border-radius:8px;background:' + TURQ + ';color:#fff;font:800 12px/1 -apple-system,system-ui,sans-serif;font-style:normal;letter-spacing:-.01em;border:2px solid ' + TURQ + ';box-sizing:border-box;font-variant-numeric:tabular-nums}',
      '.ess-b.cl{background:#fff;color:' + TURQ + '}',
      '.ess-ic{background:none;border:0}',
      '.ess-mk{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;cursor:pointer}',
      '.ess-mk .ess-b{box-shadow:0 0 0 2px #fff,0 3px 8px rgba(26,32,48,.35);transition:transform .15s}',
      '.ess-mk .ess-lb{position:absolute;left:0;top:0;white-space:nowrap;font:700 12px/1 -apple-system,system-ui,sans-serif;color:' + ENCRE + ';background:#fff;border:1px solid #BFE0DB;border-radius:7px;padding:5px 7px;box-shadow:0 2px 6px -2px rgba(26,32,48,.3);visibility:hidden;pointer-events:none}',
      '.ess-mk .ess-lb.vu{visibility:visible}',
      '.ess-on .ess-b{transform:scale(1.3);box-shadow:0 0 0 3px #fff,0 0 0 7px rgba(8,122,112,.35),0 6px 14px rgba(26,32,48,.4)}',
      '.ess-on .ess-lb{visibility:visible;border-color:' + TURQ + ';color:' + TURQ + '}',
      '.ess-row.ess-nrow{justify-content:flex-start}.ess-row.ess-nrow>span{flex:1}',
      '.ess-row.ess-act{background:#E9F6F4;box-shadow:inset 4px 0 0 ' + TURQ + '}',
      '.ess-band{position:absolute;left:10px;right:10px;bottom:10px;z-index:600;display:none;align-items:center;gap:10px;background:#fff;border:1px solid #BFE0DB;border-radius:14px;padding:10px 12px;box-shadow:0 10px 26px -10px rgba(26,32,48,.45)}',
      '.ess-band.on{display:flex}.ess-band b{display:block;font-size:14.5px}.ess-band span{display:block;font-size:12.5px;color:#4A5570}.ess-band .ess-b{min-width:38px;height:30px;font-size:14px}',
      '.ess1-body{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:0;margin-top:12px;border-top:1px solid #E3EAF8}',
      '.ess1-map{position:relative;height:560px;background:#EAF0FA;min-width:0}.ess1-side{height:560px;overflow:auto;border-left:1px solid #E3EAF8;background:#fff}',
      '.ess1-side h3{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5A6683;margin:0;padding:12px 12px 6px;position:sticky;top:0;background:#fff;z-index:2}',
      '.ess1-leg{display:flex;flex-wrap:wrap;gap:8px 18px;padding:12px 22px 14px;font-size:13px;color:#33405C;align-items:center}',
      '.ess1-leg span{display:inline-flex;align-items:center;gap:7px}',
      '.ess1-btns{position:absolute;right:10px;top:10px;z-index:500;display:flex;gap:6px}.ess1-btns button{font:inherit;font-weight:700;font-size:13px;min-height:44px;padding:0 14px;border:1px solid #CBD8F1;border-radius:999px;background:#fff;color:' + ENCRE + ';cursor:pointer;box-shadow:0 4px 12px -4px rgba(26,32,48,.3)}',
      '@media(max-width:900px){.ess1-body{grid-template-columns:minmax(0,1fr)}.ess1-map{height:400px}.ess1-side{height:auto;max-height:420px;border-left:0;border-top:1px solid #E3EAF8}.ess1-leg{padding:12px 14px 14px}}',
      '@media(max-width:700px){.ess-hd{padding:16px 14px 4px}.ess-sub{margin:4px 14px 0}.ess h2{font-size:19px}.ess-seg{width:100%}.ess-seg button{flex:1;padding:0 8px}}',
      '@media(prefers-reduced-motion:reduce){.ess *{transition-duration:.01ms!important;animation-duration:.01ms!important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function donnees() {
    var w = glob.WML_OFFICINES;
    if (!w) { try { w = WML_OFFICINES; } catch (e) { w = null; } }   // const global : visible sans `window.`
    return E.calculer(glob.TOURNEES_ECRAN, glob.PHARMA_FR, glob.GRP_DEPART, w, 'T10');
  }

  // Point d'entrée : appelé par v2-tournees.js juste après le dessin du détail d'une tournée, quand elle est la T10.
  // d = fichier des tournées de l'écran, leaflet = chargeur de Leaflet de l'écran (pas de second chargement).
  E.monter = function (root, ensureLeaflet) {
    var tiles = root && root.querySelector('.trn-tiles');
    if (!tiles || root.querySelector('#ess-root')) return;
    css();
    var box = document.createElement('div'); box.id = 'ess-root';
    tiles.parentNode.insertBefore(box, tiles);
    var D = donnees();
    if (!D) {
      box.innerHTML = '<section class="ess" aria-label="La T10, Angers et les Essentiels"><div class="ess-hd"><div><div class="ess-k">Calque sur la carte de la T10</div><h2>La T10, les clientes d’Angers et les Essentiels</h2></div></div>' +
        '<p class="ess-sub" id="ess-attente">Chargement des officines en cours…</p></section>';
      var fin = function () {
        if (!document.body.contains(box)) return;
        var d2 = donnees(); if (d2) { dessiner(box, d2, ensureLeaflet); return; }
        var a = document.getElementById('ess-attente'); if (a) a.textContent = 'Les officines ne sont pas disponibles pour le moment. Rien n’est affiché plutôt que des chiffres faux.';
      };
      var clientes = function () {   // la liste des clientes manque encore : on la demande, puis on redessine
        if (!glob.WML_OFFICINES && V2.loadFiles) Promise.resolve(V2.loadFiles(['wml'])).then(fin, fin); else fin();
      };
      if (V2.ensurePharmaFr && !glob.PHARMA_FR) V2.ensurePharmaFr(clientes); else clientes();
      return;
    }
    dessiner(box, D, ensureLeaflet);
  };

  function dessiner(root, D, ensureLeaflet) {
    var mode = etat.mode, P = E.numeroter(D), carte = null, L = null, line = null, marqs = {}, items = [], obst = [], sel = null;
    root.innerHTML = '<section class="ess ess1" aria-label="La T10, Angers et les Essentiels">' +
      '<div class="ess-hd"><div><div class="ess-k">Calque sur la carte de la T10</div><h2>La T10, les clientes d’Angers et les Essentiels</h2></div>' +
      '<div class="ess-seg" role="group" aria-label="Aujourd’hui ou en quotidien" id="ess-mode"><button type="button" data-m="auj" aria-pressed="false">Aujourd’hui</button><button type="button" data-m="quot" aria-pressed="false">En quotidien</button></div></div>' +
      '<p class="ess-sub" id="ess-sub1"></p>' +
      '<div class="ess1-body"><div class="ess1-map" id="ess-map"><div class="ess-band" id="ess-band" aria-live="polite"></div></div><div class="ess1-side" id="ess-side"></div></div>' +
      '<div class="ess1-leg" id="ess-leg"></div></section>';
    var side0 = document.getElementById('ess-side');
    function bascule() {
      Array.prototype.forEach.call(document.querySelectorAll('#ess-mode button'), function (x) { var on = x.getAttribute('data-m') === mode; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    function sub() { document.getElementById('ess-sub1').innerHTML = E.sousTitre(D, mode); }
    function legende() {
      // l'exemple de chaque badge porte le numéro de la première officine de sa catégorie : jamais un numéro qui dirait autre chose que la carte
      var n1 = P.tous.filter(function (e) { return !e.cliente; })[0], c1 = P.tous.filter(function (e) { return e.cliente; })[0];
      document.getElementById('ess-leg').innerHTML =
        '<span><i class="ess-sw" style="background:' + GRIS + '"></i>Arrêt actuel de la T10</span>' +
        '<span><i class="ess-sw" style="background:' + BLEU + ';box-shadow:0 0 0 4px rgba(0,80,230,.2)"></i>Cliente à Angers</span>' +
        (mode === 'quot' ? (n1 ? '<span>' + badge(n1) + 'Essentiels à récupérer (' + D.non.length + ')</span>' : '') +
          (c1 ? '<span>' + badge(c1) + 'Essentiels déjà clientes (' + D.cl.length + ')</span>' : '') : '');
    }
    function side() {
      var h = '';
      if (mode === 'quot') h += '<h3>Essentiels · ' + P.tous.length + ' officines, numérotées dans l’ordre de la tournée</h3>' + P.tous.map(ligneNum).join('');
      h += '<h3>Clientes à Angers · ' + D.angers.length + '</h3>' + D.angers.map(ligneAngers).join('');
      side0.innerHTML = h;
    }
    function band(e) {
      var b = document.getElementById('ess-band'); if (!b) return;
      if (!e) { b.classList.remove('on'); b.innerHTML = ''; return; }
      b.innerHTML = bandeau(e); b.classList.add('on');
    }
    // marqueur : badge E# + nom court (placé par placer()). Zone de toucher de 44 px au téléphone.
    function marqueur(e) {
      var bw = tactile() ? 44 : 34, bh = tactile() ? 44 : 28;
      return L.marker([e.lat, e.lng], { icon: L.divIcon({ className: 'ess-ic', iconSize: [bw, bh], iconAnchor: [bw / 2, bh / 2],
        html: '<div class="ess-mk" data-cip="' + esc(e.cip) + '">' + badge(e) + '<span class="ess-lb">' + esc(e.court) + '</span></div>' }), zIndexOffset: 800, keyboard: true, title: 'E' + e.no + ' · ' + e.nom });
    }
    // étiquettes sans chevauchement : à droite, à gauche, au-dessus, au-dessous ; E1 d'abord. Sans place, le badge reste seul.
    // Garde carte._loaded : placer avant que la carte ait une vue fait planter Leaflet (payé pendant les maquettes).
    function placer() {
      if (!carte || !carte._loaded || !items.length) return;
      var sz = carte.getSize(), pris = [], R0 = carte.getContainer().getBoundingClientRect();
      function inter(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
      function surface(a, b) { var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
      obst.forEach(function (o) { var p = carte.latLngToContainerPoint(o.ll); pris.push({ x: p.x - o.r, y: p.y - o.r, w: 2 * o.r, h: 2 * o.r }); });
      // les boutons, le zoom, le crédit du fond et le bandeau ouvert recouvrent la carte : aucun nom ne s'écrit dessous
      var ovl = [];
      Array.prototype.forEach.call(carte.getContainer().querySelectorAll('.ess1-btns, .leaflet-control-zoom, .leaflet-control-attribution, .ess-band.on'), function (x) {
        var r = x.getBoundingClientRect(); if (r.width) ovl.push({ x: r.left - R0.left - 4, y: r.top - R0.top - 4, w: r.width + 8, h: r.height + 8 });
      });
      pris = pris.concat(ovl);
      // la boîte d'un badge = sa zone de toucher (44 × 44 au téléphone, sinon 34 × 26) : un nom ne s'écrit jamais à côté d'un badge qu'un voisin intercepte au toucher
      var HB = tactile() ? 22 : 17, VB = tactile() ? 22 : 13;
      items.forEach(function (it) { var p = carte.latLngToContainerPoint(it.m.getLatLng()); it.p = p; it.b = { x: p.x - HB, y: p.y - VB, w: 2 * HB, h: 2 * VB }; pris.push(it.b); });
      // un badge recouvert par un autre (celui du dessus pour Leaflet : le plus bas à l'écran, à égalité le plus petit numéro), coupé au bord ou caché
      // sous un bouton ne porte pas son nom en permanence : le nom se lirait comme celui du badge voisin. Le survol et la liste le montrent quand même.
      items.forEach(function (it) {
        var b = it.b, aire = 0.3 * b.w * b.h;
        it.dessous = b.x < 0 || b.y < 0 || b.x + b.w > sz.x || b.y + b.h > sz.y || ovl.some(function (o) { return surface(b, o) > aire; }) || items.some(function (o) {
          if (o === it) return false;
          var yo = Math.round(o.p.y), yi = Math.round(it.p.y);
          return (yo > yi || (yo === yi && o.e.no < it.e.no)) && surface(b, o.b) > aire;
        });
      });
      items.forEach(function (it) {
        var el = it.m.getElement(); if (!el) return; var lab = el.querySelector('.ess-lb'); if (!lab) return;
        var lw = lab.offsetWidth, lh = lab.offsetHeight, p = it.p, g = 5, hb = HB, vb = VB, ox = p.x - el.offsetWidth / 2, oy = p.y - el.offsetHeight / 2;
        var c = [{ x: p.x + hb + g, y: p.y - lh / 2 }, { x: p.x - hb - g - lw, y: p.y - lh / 2 }, { x: p.x - lw / 2, y: p.y - vb - g - lh }, { x: p.x - lw / 2, y: p.y + vb + g }];
        var ok = null;
        for (var i = 0; i < c.length && !ok && !it.dessous; i++) {
          var r = { x: c[i].x, y: c[i].y, w: lw, h: lh };
          if (r.x < 4 || r.y < 4 || r.x + lw > sz.x - 4 || r.y + lh > sz.y - 4) continue;
          if (pris.some(function (q) { return inter(r, q); })) continue;
          ok = r;
        }
        if (!ok) ok = { x: c[0].x, y: c[0].y, w: lw, h: lh, cache: true }; else pris.push(ok);
        lab.style.left = Math.round(ok.x - ox) + 'px'; lab.style.top = Math.round(ok.y - oy) + 'px';
        lab.classList.toggle('vu', !ok.cache);
      });
    }
    function allumer(cip, depuisListe) {
      var m = marqs[cip]; if (m && m.getElement()) { m.getElement().classList.add('ess-on'); m.setZIndexOffset(3000); }
      var r = side0.querySelector('[data-cip="' + cip + '"]');
      if (r) { r.classList.add('ess-act'); if (!depuisListe && side0.scrollHeight > side0.clientHeight + 4) side0.scrollTop = r.offsetTop - side0.clientHeight / 2 + r.offsetHeight / 2; }
    }
    function eteindre(cip) {
      var m = marqs[cip]; if (m && m.getElement()) { m.getElement().classList.remove('ess-on'); m.setZIndexOffset(800); }
      var r = side0.querySelector('[data-cip="' + cip + '"]'); if (r) r.classList.remove('ess-act');
    }
    function choisir(cip, depuisListe) {
      if (sel && sel !== cip) eteindre(sel);
      sel = cip; allumer(cip, depuisListe); band(P.par[cip]);
      if (depuisListe && carte && marqs[cip]) {
        carte.setView(marqs[cip].getLatLng(), Math.max(carte.getZoom(), 14), { animate: false }); placer();
        if (tactile()) document.getElementById('ess-map').scrollIntoView({ block: 'nearest' });
      }
    }
    function couches() {
      if (!carte) return;
      Object.keys(marqs).forEach(function (k) { carte.removeLayer(marqs[k]); });
      marqs = {}; items = [];
      if (mode !== 'quot') return;
      P.tous.slice().reverse().forEach(function (e) {
        var m = marqueur(e).addTo(carte); marqs[e.cip] = m;
        m.on('mouseover', function () { allumer(e.cip, false); });
        m.on('mouseout', function () { if (sel !== e.cip) eteindre(e.cip); });
        m.on('click', function () { choisir(e.cip, false); });
      });
      items = P.tous.map(function (e) { return { e: e, m: marqs[e.cip] }; });
      placer();
    }
    function rendre() { legende(); side(); band(null); sel = null; couches(); }
    var vue = {
      // le tracé + les Essentiels de la T10 ou à moins de 5 km de sa route, avec une marge : rien de coupé au bord
      tout: function () {
        try {
          var b = line.getBounds();
          if (mode === 'quot') P.tous.forEach(function (e) { if (e.surT10 || e.d10 <= 5) b.extend([e.lat, e.lng]); });
          carte.invalidateSize(); carte.fitBounds(b, { paddingTopLeft: [28, 64], paddingBottomRight: [28, 70], animate: false });
        } catch (e) {}
      },
      angers: function () {
        try {
          var pts = P.tous.filter(function (e) { return /Angers/.test(e.ville); }).map(function (e) { return [e.lat, e.lng]; }).concat(D.angers.map(function (a) { return [a.lat, a.lng]; }));
          carte.invalidateSize(); carte.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 74], paddingBottomRight: [40, 70], animate: false });
        } catch (e) {}
      }
    };
    function cartePose() {
      ensureLeaflet(function (err) {
        var el = document.getElementById('ess-map'); if (err || !glob.L || !el) { if (el) el.innerHTML = '<p class="ess-sub">Carte indisponible.</p>'; return; }
        L = glob.L; var t = D.t10;
        carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile() });
        try { carte.attributionControl.setPrefix(false); } catch (e) {}
        if (V2.fondCarte) V2.fondCarte(carte);
        line = L.polyline(t.trace, { color: BLEU, weight: 4, opacity: 1 }).addTo(carte);
        var angIds = {}; D.angers.forEach(function (a) { angIds[a.cip] = 1; });
        D.arrets.forEach(function (a) {
          var ang = !!angIds[a.id], z = tactile() ? 44 : (ang ? 38 : 26), q = (z - (ang ? 34 : 26)) / 2;
          var ic = L.divIcon({ className: '', iconSize: [z, z], iconAnchor: [z / 2, z / 2], html: '<div class="ess-pt' + (ang ? ' ang' : '') + '" style="margin:' + (ang ? q + 4 : q) + 'px">' + a.n + '</div>' });
          L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: ang ? 500 : 200, title: a.nom }).addTo(carte).bindTooltip('<b>' + a.n + ' · ' + esc(a.nom) + '</b><br>' + esc(a.ville) + (a.ch ? '<br>' + eur(a.ch.ca) + ' · ' + a.ch.cmd + ' commandes' : '<br>sans commande'), { direction: 'top', offset: [0, -10] });
          obst.push({ ll: L.latLng(a.lat, a.lng), r: ang ? 19 : 13 });
        });
        D.angersSans.forEach(function (a) {
          var ic = L.divIcon({ className: '', iconSize: [38, 38], iconAnchor: [19, 19], html: '<div class="ess-pt ang" style="margin:4px;background:#fff;color:' + BLEU + ';border-color:' + BLEU + '">–</div>' });
          L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: 500 }).addTo(carte).bindTooltip('<b>' + esc(a.nom) + '</b><br>cliente, aucune livraison sur janvier à octobre', { direction: 'top' });
          obst.push({ ll: L.latLng(a.lat, a.lng), r: 19 });
        });
        var btns = document.createElement('div'); btns.className = 'ess1-btns'; btns.innerHTML = '<button type="button" data-z="tout">Toute la T10</button><button type="button" data-z="angers">Zoom Angers</button>';
        el.appendChild(btns);
        L.DomEvent.disableClickPropagation(btns);
        L.DomEvent.disableClickPropagation(document.getElementById('ess-band'));
        btns.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; if (b.getAttribute('data-z') === 'tout') vue.tout(); else vue.angers(); };
        vue.angers(); couches();
        setTimeout(function () { vue.angers(); placer(); }, 0); setTimeout(function () { vue.angers(); placer(); }, 500);
        carte.on('zoomend moveend resize', placer);
        root.__ess = { carte: carte };
      });
    }
    document.getElementById('ess-mode').onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b || b.getAttribute('data-m') === mode) return;
      mode = etat.mode = b.getAttribute('data-m');
      bascule(); sub(); rendre();
    };
    // survol d'une ligne : le badge grossit et son nom s'affiche ; toucher une ligne : la carte se centre dessus et le bandeau s'ouvre
    side0.addEventListener('mouseover', function (ev) { var r = ev.target.closest('[data-cip]'); if (r) allumer(r.getAttribute('data-cip'), true); });
    side0.addEventListener('mouseout', function (ev) { var r = ev.target.closest('[data-cip]'); if (r && r.getAttribute('data-cip') !== sel && !r.contains(ev.relatedTarget)) eteindre(r.getAttribute('data-cip')); });
    side0.addEventListener('click', function (ev) { var r = ev.target.closest('[data-cip]'); if (r) choisir(r.getAttribute('data-cip'), true); });
    bascule(); sub(); legende(); side(); cartePose();
  }

  V2.tourneesEssentiels = E;
})(typeof window !== 'undefined' ? window : globalThis);
