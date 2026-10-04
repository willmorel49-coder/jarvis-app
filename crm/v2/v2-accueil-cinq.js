/* ═══════════════════════════════════════════════════════════════════════════════
   JARVIS · accueil u2 — le centre « cinq cartes » (04/10/2026, maquette z4 « L'atelier », partie centre = y4 « Le grand Officines », version calme)
   Décisions des 03 et 04/10 : l'accueil se concentre sur CINQ outils : Officines (bandeau bas, SANS aucune boucle au repos),
   Infos du matin, To do list, Groupements, Offilog (quatre cartes animées) ; tous les autres outils restent là, discrets, sous « Autres outils ».
   Règle de base : AUCUN chiffre ni nom d'exemple. Chaque nombre vient de la donnée réelle déjà chargée par l'app pour la personne connectée ;
   une donnée absente = la carte s'affiche SANS ce chiffre (jamais un zéro qui ressemblerait à un vrai zéro). Aucune requête nouvelle.
   Ce fichier ne connaît pas les internes de v2-app.js : il lit le « pont » V2.accueilPont que v2-app.js pose (portes, liens, infos du matin, to do, réglages).
   Les scènes animées (SVG) viennent de la maquette ; elles ne repartent JAMAIS quand une donnée arrive ou qu'un widget se règle : seules les zones de texte
   (data-slot) sont remplacées, et seulement si leur contenu a changé. Safari : ni backdrop-filter, ni flou, ni dégradé dans du texte ; transform / opacity sur des formes.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fr(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function calme() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function P() { return V2.accueilPont || null; }

  // Le décalage de chaque scène dans sa boucle (les cartes ne respirent pas toutes en même temps)
  var PHASE = { pharma: '0s', infos: '-2.1s', todo: '-4.2s', groupements: '-1.3s', offilog: '-3.4s' };
  // La cinquième porte n'existe pas parmi les outils (c'est une vue de l'écran Officines) : son nom et sa phrase sont ici.
  var GRP = { nom: 'Groupements', ph: 'Ce que commandent les adhérents de chaque groupement', act: 'go:pharma/groupements', href: '#pharma/groupements' };
  var CINQ = ['pharma', 'infos', 'todo', 'groupements', 'offilog'];

  /* ── Les données réelles ── */
  // Dernières fiches ouvertes : l'app n'en gardait aucune trace. On la tient ici, sur cet appareil et pour cette personne (aucune table, aucune requête).
  function fichesCle() { var p = P(); return 'jarvis_accueil_fiches:' + (p ? p.userId() : 'local'); }
  function fichesLire() {
    try { var a = JSON.parse(localStorage.getItem(fichesCle()) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && x.id && x.nom && x.ts; }).slice(0, 5) : []; } catch (e) { return []; }
  }
  function fichesNoter() {
    try {
      var m = /^#pharma\/([^/?#]+)$/.exec(location.hash || ''); if (!m) return;
      var id = decodeURIComponent(m[1]);
      var ph = (V2.pharmacies || []).filter(function (p) { return String(p.id) === id; })[0];
      if (!ph || !ph.name) return;   // « groupements », « listes », « carte »… ne sont pas des fiches
      var l = fichesLire().filter(function (x) { return String(x.id) !== id; });
      l.unshift({ id: id, nom: String(ph.name), ts: Date.now() });
      localStorage.setItem(fichesCle(), JSON.stringify(l.slice(0, 5)));
    } catch (e) {}
  }
  window.addEventListener('hashchange', fichesNoter);
  function jourRel(ts) {
    var a = new Date(ts), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    var j = Math.round((b - a) / 86400000);
    return j <= 0 ? 'Ouverte aujourd\'hui' : j === 1 ? 'Ouverte hier' : 'Ouverte il y a ' + j + ' jours';
  }
  // Groupements : les officines rangées par groupement (nom canonique), « Sans groupement » écarté. Même règle que la liste de l'écran Officines.
  var _g = { ref: null, n: -1, l: [] };
  function nomG(p) {
    var g = String(p.groupement || '').trim(); if (!g) return '';
    var c = (V2.canonGrp ? V2.canonGrp(g) : g) || g;
    return (!c || c === '—' || /PAS un groupement/.test(c)) ? '' : String(c);
  }
  function groupes() {
    var phs = V2.pharmacies || [];
    if (_g.ref === phs && _g.n === phs.length) return _g.l;
    var by = {};
    phs.forEach(function (p) { var g = nomG(p); if (!g) return; (by[g] = by[g] || { nom: g, ids: [] }).ids.push(p.id); });
    _g = { ref: phs, n: phs.length, l: Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.ids.length - a.ids.length || a.nom.localeCompare(b.nom, 'fr'); }) };
    return _g.l;
  }
  V2.accueilGroupes = function () { return groupes(); };
  function offilogN() { try { return (typeof OFFILOG_BEST !== 'undefined' && OFFILOG_BEST && OFFILOG_BEST.length) ? OFFILOG_BEST.length : (window.OFFILOG_BEST && window.OFFILOG_BEST.length) || 0; } catch (e) { return 0; } }

  /* ── Les scènes (maquette y-scenes.js, classes préfixées ac-) ── */
  function sceneOff() {
    return [
      '<svg viewBox="0 0 300 214" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>',
      '<linearGradient id="yo-nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ip-blue-d) 62%,#05070d)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ip-blue) 70%,var(--ip-blue-d))"/></linearGradient>',
      '<radialGradient id="yo-aura" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ip-blue) 40%,#fff)" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--ip-blue)" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="yo-lu" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF1CF" stop-opacity=".95"/><stop offset=".5" stop-color="#FFD27A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="yo-h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5CF0A8" stop-opacity=".95"/><stop offset=".45" stop-color="#2FD08A" stop-opacity=".38"/><stop offset="1" stop-color="#1E9E6A" stop-opacity="0"/></radialGradient>',
      '<linearGradient id="yo-f1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:var(--il-fa)" stop-opacity=".5"/><stop offset="1" style="stop-color:var(--il-fb)" stop-opacity=".7"/></linearGradient>',
      '<linearGradient id="yo-f2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:var(--il-ga)" stop-opacity=".45"/><stop offset="1" style="stop-color:var(--il-gb)" stop-opacity=".6"/></linearGradient>',
      '<linearGradient id="yo-mur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" style="stop-color:var(--il-mur)"/></linearGradient>',
      '<linearGradient id="yo-vit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--il-va)"/><stop offset="1" style="stop-color:var(--il-vb)"/></linearGradient>',
      '<linearGradient id="yo-sto" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--il-sa)"/><stop offset="1" style="stop-color:var(--ip-blue)"/></linearGradient>',
      '<linearGradient id="yo-int" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4D8"/><stop offset="1" stop-color="#FFC966"/></linearGradient>',
      '</defs>',
      '<rect width="300" height="214" fill="url(#yo-nuit)"/>',
      '<ellipse class="ac-o-aura" cx="153" cy="124" rx="150" ry="104" fill="url(#yo-aura)"/>',
      '<path d="M232 214 C 190 150, 196 70, 274 36 C 290 110, 272 170, 232 214 Z" fill="url(#yo-f1)"/>',
      '<path d="M62 214 C 20 160, 10 100, 36 44 C 92 86, 96 160, 62 214 Z" fill="url(#yo-f2)"/>',
      '<ellipse cx="150" cy="208" rx="120" ry="6" fill="#05070d" opacity=".4"/>',
      '<rect x="78" y="78" width="150" height="128" rx="6" fill="url(#yo-mur)"/>',
      '<rect x="86" y="86" width="134" height="20" rx="4" style="fill:var(--ip-ink)"/>',
      '<ellipse class="ac-o-ens-l" cx="153" cy="96" rx="92" ry="19" fill="url(#yo-lu)"/>',
      '<g class="ac-o-ens-t"><rect x="96" y="93" width="52" height="6" rx="3" fill="#fff"/><rect x="154" y="93" width="30" height="6" rx="3" fill="#fff" opacity=".6"/></g>',
      '<path d="M80 112 H226 L222 128 H84 Z" fill="url(#yo-sto)"/>',
      '<path d="M84 128 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0" fill="none" style="stroke:var(--ip-blue)" stroke-width="2"/>',
      '<path d="M96 112 l-3 16 M120 112 l-2 16 M144 112 l-1 16 M168 112 l1 16 M192 112 l2 16 M216 112 l3 16" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>',
      '<g class="ac-o-fen"><rect x="90" y="138" width="42" height="42" rx="4" fill="url(#yo-vit)"/><rect x="174" y="138" width="42" height="42" rx="4" fill="url(#yo-vit)"/>',
      '<path d="M94 160 h34 M94 170 h34 M178 160 h34 M178 170 h34" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>',
      '<rect x="98" y="150" width="6" height="8" rx="1.5" fill="#fff" opacity=".9"/><rect x="108" y="148" width="6" height="10" rx="1.5" fill="#1E9E6A" opacity=".9"/><rect x="118" y="151" width="6" height="7" rx="1.5" fill="#fff" opacity=".9"/>',
      '<rect x="182" y="150" width="6" height="8" rx="1.5" fill="#fff" opacity=".9"/><rect x="192" y="149" width="6" height="9" rx="1.5" fill="#C7791A" opacity=".9"/><rect x="202" y="151" width="6" height="7" rx="1.5" fill="#fff" opacity=".9"/></g>',
      '<rect x="140" y="136" width="26" height="70" rx="3" fill="url(#yo-int)"/>',
      '<g class="ac-o-porte"><rect x="140" y="136" width="26" height="70" rx="3" fill="url(#yo-vit)"/><rect x="140" y="136" width="26" height="70" rx="3" fill="none" style="stroke:var(--ip-ink)" stroke-opacity=".18"/>',
      '<path d="M153 140 v62" stroke="#fff" stroke-opacity=".6"/><circle cx="149" cy="172" r="1.8" style="fill:var(--ip-ink)" opacity=".6"/></g>',
      '<rect x="134" y="203" width="38" height="4" rx="2" fill="#05070d" opacity=".3"/>',
      '<ellipse class="ac-o-lueur" cx="153" cy="207" rx="26" ry="4.5" fill="#FFD27A"/>',
      '<g class="ac-o-croix"><circle class="ac-o-croix-halo" cx="62" cy="62" r="50" fill="url(#yo-h)"/>',
      '<rect x="52" y="30" width="20" height="64" rx="4" fill="#1E9E6A"/><rect x="30" y="52" width="64" height="20" rx="4" fill="#1E9E6A"/>',
      '<g class="ac-o-croix-coeur"><rect x="56" y="34" width="12" height="56" rx="2" fill="#6DF2B0"/><rect x="34" y="56" width="56" height="12" rx="2" fill="#6DF2B0"/></g>',
      '<rect x="60" y="52" width="4" height="20" fill="#fff" opacity=".9"/><rect x="52" y="60" width="20" height="4" fill="#fff" opacity=".9"/>',
      '<path d="M62 94 v12 h12" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/></g>',
      '<path d="M246 206 h20 l-3-20 h-14 Z" fill="#C7791A"/>',
      '<path d="M256 186 c-14-10 -16-28 -6-40 c10 10 12 26 6 40 Z M256 186 c 2-16 12-26 24-28 c-2 14 -12 24 -24 28 Z M256 186 c-8-14 -22-18 -32-14 c 6 12 20 16 32 14 Z" fill="#1E9E6A"/>',
      '<path d="M256 186 v-30" stroke="#13764E" stroke-width="2" stroke-linecap="round"/>',
      '</svg>'
    ].join('');
  }

  function sceneInfos() {
    var rays = '', i;
    for (i = 0; i < 14; i++) rays += '<path d="M120 76 L' + (120 + Math.round(Math.cos(i * Math.PI / 7) * 70)) + ' ' + (76 + Math.round(Math.sin(i * Math.PI / 7) * 70)) + '"/>';
    var toits = [[0, 112, 26], [24, 104, 22], [44, 118, 30], [72, 108, 20], [90, 116, 24], [112, 100, 20], [130, 112, 28], [156, 106, 22], [176, 118, 26], [200, 104, 22], [220, 114, 24]], t = '', w = '';
    toits.forEach(function (b, j) { t += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] + 1) + '" height="' + (160 - b[1]) + '"/>'; if (j % 2 === 0) w += '<rect class="ac-i-win" style="--k:' + j + '" x="' + (b[0] + 6) + '" y="' + (b[1] + 9) + '" width="5" height="6" rx="1"/>'; });
    return [
      '<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>',
      '<linearGradient id="yi-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ip-blue-d) 66%,#05070d)"/><stop offset=".55" style="stop-color:color-mix(in srgb,var(--ip-blue) 80%,var(--ip-blue-d))"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ip-blue) 40%,#FFC27A)"/></linearGradient>',
      '<radialGradient id="yi-so" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE9B0" stop-opacity=".95"/><stop offset=".4" stop-color="#FFC966" stop-opacity=".45"/><stop offset="1" stop-color="#FFC966" stop-opacity="0"/></radialGradient>',
      '<linearGradient id="yi-di" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6DC"/><stop offset="1" stop-color="#FFC966"/></linearGradient>',
      '<linearGradient id="yi-ho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC27A" stop-opacity="0"/><stop offset="1" stop-color="#FFC27A" stop-opacity=".7"/></linearGradient>',
      '</defs><rect width="240" height="150" fill="url(#yi-ciel)"/>',
      '<rect class="ac-i-aube" y="60" width="240" height="60" fill="url(#yi-ho)"/>',
      '<g class="ac-i-sun-w"><g class="ac-i-halo"><circle cx="120" cy="76" r="62" fill="url(#yi-so)"/></g>',
      '<g class="ac-i-rays" stroke="#FFE9B0" stroke-width="1.4" stroke-linecap="round" opacity=".55">' + rays + '</g>',
      '<circle cx="120" cy="76" r="20" fill="url(#yi-di)"/></g>',
      '<g style="fill:color-mix(in srgb,var(--ip-blue-d) 70%,#05070d)">' + t + '</g>',
      '<g fill="#FFD27A">' + w + '</g></svg>'
    ].join('');
  }

  function sceneGrp(grappes) {
    var pos = [[62, 58], [160, 50], [112, 108], [204, 104], [28, 112]], tot = 0, h = '', cl;
    var mx = Math.max.apply(null, grappes.concat([1]));
    grappes.forEach(function (n, c) {
      var nb = Math.max(3, Math.round(14 * n / mx)), cx = pos[c][0], cy = pos[c][1], rm = 5.3 * Math.sqrt(nb), dots = '';
      for (var i = 0; i < nb; i++) {
        var r = 5.3 * Math.sqrt(i + .5), a = i * 2.39996, x = Math.round((cx + r * Math.cos(a)) * 10) / 10, y = Math.round((cy + r * Math.sin(a)) * 10) / 10;
        var dx = Math.round(Math.sin(i * 12.9898 + c * 78.233) * 90), dy = Math.round(Math.cos(i * 4.1414 + c * 5.5) * 60);
        dots += '<circle class="ac-gr-d" style="--dx:' + dx + 'px;--dy:' + dy + 'px;--d:' + (c * 110 + i * 14) + 'ms" cx="' + x + '" cy="' + y + '" r="3.1"/>';
        tot++;
      }
      h += '<g class="ac-gr-cl" style="transform-origin:' + cx + 'px ' + cy + 'px"><g class="ac-gr-resp" style="--k:' + c + ';transform-origin:' + cx + 'px ' + cy + 'px">' +
        '<circle class="ac-gr-ha" style="--k:' + c + '" cx="' + cx + '" cy="' + cy + '" r="' + Math.round(rm + 9) + '" fill="url(#yg-ha)"/>' +
        '<g style="fill:var(--ip-blue)">' + dots + '</g></g></g>';
    });
    return '<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="yg-ha" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--ip-blue)" stop-opacity=".2"/><stop offset=".7" style="stop-color:var(--ip-blue)" stop-opacity=".1"/><stop offset="1" style="stop-color:var(--ip-blue)" stop-opacity="0"/></radialGradient></defs>' +
      h + '</svg>';
  }

  function prod(type, x, base, s, tint, k) {
    var c1 = 'color-mix(in srgb,var(--ip-blue) ' + tint + '%,#fff)', c2 = 'var(--ip-blue-d)', body;
    if (type === 0) body = '<rect x="-9" y="-38" width="18" height="38" rx="4" style="fill:' + c1 + '"/><rect x="-5.5" y="-46" width="11" height="8" rx="2" style="fill:' + c2 + '"/><rect x="-5" y="-33" width="3" height="26" rx="1.5" fill="#fff" opacity=".55"/>';
    else if (type === 1) body = '<rect x="-12" y="-30" width="24" height="30" rx="6" style="fill:' + c1 + '"/><rect x="-4" y="-36" width="8" height="7" style="fill:' + c2 + '"/><path d="M-3 -39 h10 v4" fill="none" stroke-width="3" stroke-linecap="round" style="stroke:' + 'var(--ip-blue-d)' + '"/><rect x="-8" y="-22" width="16" height="11" rx="2.5" fill="#fff" opacity=".85"/>';
    else if (type === 2) body = '<rect x="-16" y="-20" width="32" height="20" rx="5" style="fill:' + c1 + '"/><rect x="-17" y="-27" width="34" height="8" rx="3" style="fill:' + c2 + '"/><rect x="-9" y="-14" width="18" height="7" rx="2" fill="#fff" opacity=".8"/>';
    else if (type === 3) body = '<rect x="-12" y="-42" width="24" height="42" rx="3" style="fill:' + c1 + '"/><rect x="-12" y="-27" width="24" height="11" fill="#fff" opacity=".8"/><circle cx="0" cy="-34" r="3.2" style="fill:' + c2 + '"/>';
    else body = '<rect x="-10" y="-34" width="20" height="34" rx="10" style="fill:' + c1 + '"/><rect x="-6" y="-40" width="12" height="7" rx="2.5" style="fill:' + c2 + '"/><rect x="-5.5" y="-26" width="3" height="18" rx="1.5" fill="#fff" opacity=".55"/>';
    return '<g transform="translate(' + x + ' ' + base + ') scale(' + s + ')"><g class="ac-of-p" style="--k:' + k + '">' + body + '</g></g>';
  }
  function sceneOffi() {
    function rang(base, s, xs, tints, types, k0) { var o = ''; xs.forEach(function (x, i) { o += prod(types[i], x, base, s, tints[i], k0 + i); }); return o; }
    var xb = [18, 62, 108, 152, 186], xh = [30, 70, 112, 150, 186], tb = [70, 38, 86, 24, 55], th = [34, 78, 50, 90, 28];
    var bas = rang(124, 1, xb, tb, [0, 1, 2, 3, 4], 0) + rang(124, 1, xb.map(function (x) { return x + 200; }), tb, [0, 1, 2, 3, 4], 5);
    var haut = rang(62, .66, xh, th, [3, 2, 4, 1, 0], 2) + rang(62, .66, xh.map(function (x) { return x + 200; }), th, [3, 2, 4, 1, 0], 7);
    var wall = '';
    for (var i = 1; i < 6; i++) wall += '<path d="M' + (i * 40) + ' 0 V150" />';
    return '<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<g style="stroke:var(--ip-blue)" stroke-opacity=".08" stroke-width="1">' + wall + '</g>' +
      '<g class="ac-of-def2">' + haut + '</g>' +
      '<rect x="0" y="62" width="240" height="6" style="fill:color-mix(in srgb,var(--ip-blue) 48%,#fff)"/><rect x="0" y="68" width="240" height="3" style="fill:var(--ip-blue-d)" opacity=".25"/>' +
      '<g class="ac-of-def">' + bas + '</g>' +
      '<rect x="0" y="124" width="240" height="10" style="fill:var(--ip-blue-d)"/><rect x="0" y="134" width="240" height="4" fill="#05070d" opacity=".2"/>' +
      '<path d="M14 134 v16 M226 134 v16" stroke-width="5" stroke-linecap="round" style="stroke:var(--ip-blue-d)" opacity=".5"/></svg>';
  }

  function sceneTodo() {
    var l = '', y = [52, 78, 104];
    y.forEach(function (v, j) {
      l += '<circle class="ac-td-pt" style="--j:' + j + ';fill:var(--ip-blue)" cx="160" cy="' + v + '" r="5"/><rect x="171" y="' + (v - 3) + '" width="' + (j === 1 ? 30 : 36) + '" height="6" rx="3" style="fill:var(--ip-blue)" opacity=".28"/>';
    });
    return '<svg viewBox="0 0 240 150" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">' +
      '<g transform="rotate(5 176 76)"><rect x="142" y="22" width="72" height="110" rx="10" fill="#fff" style="stroke:var(--ip-blue)" stroke-opacity=".35"/>' +
      '<rect x="161" y="14" width="34" height="14" rx="6" style="fill:var(--ip-blue-d)"/>' + l + '</g></svg>';
  }

  var CK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect class="bx" x="1.5" y="1.5" width="17" height="17" rx="5"/><path class="ck" pathLength="1" d="M5.2 10.4 8.7 13.8 14.8 6.6"/></svg>';

  /* ── Le contenu vivant de chaque carte : une fonction par zone, rendue seulement quand sa donnée change ── */
  function nb(n, lib, anim) { return '<span class="ac-nb"><b' + (anim ? ' data-roule="' + n + '"' : '') + '>' + fr(n) + '</b><span>' + esc(lib) + '</span></span>'; }
  function ds(t) { return '<span class="ac-ds">' + esc(t) + '</span>'; }

  var C = {
    // Bandeau Officines : le nombre (ou l'avancement du chargement), puis les dernières fiches
    heroNb: function (m, t) {
      if (m.partiel) {
        var pr = V2.ventesProgres || {};
        return '<span class="ac-vente" id="v2-ventes-etat">Chargement des ventes… <b>' + (pr.n || 0) + '</b> / ' + (pr.total || '?') + '</span>';
      }
      return nb(m.nb, m.nb > 1 ? 'officines actives' : 'officine active', true) + (m.mes != null ? '<span class="ac-sub">Vos officines : <b>' + fr(m.mes) + '</b></span>' : '');
    },
    heroFi: function (t) {
      var l = fichesLire().slice(0, 3);
      if (!l.length) return '<span class="ac-ph">' + esc(t.ph) + '</span>';
      return '<span class="ac-lb">Dernières fiches ouvertes</span><span class="ac-fl">' + l.map(function (f, j) {
        return '<span class="ac-f" style="--j:' + j + '"><i class="ac-fp"></i><span class="ac-ft"><b>' + esc(f.nom) + '</b><span>' + esc(jourRel(f.ts)) + '</span></span></span>';
      }).join('') + '</span>';
    },
    infos: function () {
      var i = P().infos();
      if (i.etat === 'charge') return '<span class="ac-vide">Chargement du brief du jour…</span>';
      if (i.etat !== 'ok') return '<span class="ac-vide">Le brief du jour n\'est pas encore arrivé.</span>';
      var cases = [];
      if (i.nb != null) cases.push([i.nb, i.nb > 1 ? 'nouvelles' : 'nouvelle']);
      if (i.rupt != null) cases.push([i.rupt, i.rupt > 1 ? 'ruptures en cours' : 'rupture en cours']);
      if (i.rapp != null) cases.push([i.rapp, i.rapp > 1 ? 'rappels de produits' : 'rappel de produit']);
      return '<span class="ac-tit">' + esc(i.titre) + '</span>' +
        (cases.length ? '<span class="ac-cps">' + cases.map(function (c) { return '<span class="ac-cp"><b>' + fr(c[0]) + '</b><span>' + esc(c[1]) + '</span></span>'; }).join('') + '</span>' : '');
    },
    todoN: function () {
      var l = P().todo(); if (!l) return '';
      return '<b data-roule="' + l.length + '">' + fr(l.length) + '</b><span>à faire</span>';
    },
    todo: function () {
      var l = P().todo();
      if (!l) return '<span class="ac-vide">Chargement de votre liste…</span>';
      if (!l.length) return '<span class="ac-vide">Rien à faire pour l\'instant.</span>';
      return '<span class="ac-tl">' + l.slice(0, 3).map(function (x, j) { return '<span class="ac-t" style="--j:' + j + '">' + CK + '<span>' + esc(x) + '</span></span>'; }).join('') + '</span>' +
        (l.length > 3 ? '<span class="ac-reste">+ ' + (l.length - 3) + (l.length - 3 > 1 ? ' autres à faire' : ' autre à faire') + '</span>' : '');
    },
    grpScene: function () { var g = groupes().slice(0, 5).map(function (x) { return x.ids.length; }); return sceneGrp(g); },
    grp: function () {
      var n = groupes().length;
      return (n ? nb(n, n > 1 ? 'groupements' : 'groupement', true) : '') + ds(GRP.ph);
    },
    offilog: function (t) { var n = offilogN(); return (n ? nb(n, 'références', true) : '') + ds(t.ph); }
  };
  var SLOTS = {
    'h.nb': function (ctx) { return C.heroNb(ctx.m, ctx.t.pharma); },
    'h.fi': function (ctx) { return C.heroFi(ctx.t.pharma); },
    'infos.bd': function () { return C.infos(); },
    'todo.n': function () { return C.todoN(); },
    'todo.bd': function () { return C.todo(); },
    'groupements.sc': function () { return C.grpScene(); },
    'groupements.bd': function () { return C.grp(); },
    'offilog.bd': function (ctx) { return C.offilog(ctx.t.offilog); }
  };
  var _sig = {};
  function contexte() {
    var p = P(), t = {};
    ['pharma', 'infos', 'todo', 'offilog'].forEach(function (k) { t[k] = p.outil(k); });
    return { m: p.m(), t: t };
  }
  function slot(k, ctx) { _sig[k] = SLOTS[k](ctx); return _sig[k]; }

  function lien(t, k) { return P().lien(t, k); }
  function carte(k, i, t, ctx) {
    var ic = P().ic(k === 'groupements' ? 'clients' : k);
    var sc, scCls, bdSlot = k + '.bd';
    if (k === 'infos') { sc = sceneInfos(); scCls = ''; }
    else if (k === 'todo') { sc = sceneTodo() + '<span class="ac-td-n" data-slot="todo.n">' + slot('todo.n', ctx) + '</span>'; scCls = ' ac-sc-td'; }
    else if (k === 'groupements') { sc = '<span data-slot="groupements.sc" class="ac-slot-sc">' + slot('groupements.sc', ctx) + '</span>'; scCls = ' ac-sc-gr'; }
    else { sc = sceneOffi(); scCls = ' ac-sc-of'; }
    return '<a class="ac-c ac-c-' + k + ' ac-in" style="--i:' + i + ';--ph:' + PHASE[k] + '"' + lien(t, k) + '>' +
      '<span class="ac-sc' + scCls + '">' + sc + '</span>' +
      '<span class="ac-bd"><span class="ac-top"><span class="ac-gl">' + ic + '</span><span class="ac-nm">' + esc(t.nom) + '</span></span>' +
      '<span class="ac-live" data-slot="' + bdSlot + '">' + slot(bdSlot, ctx) + '</span></span></a>';
  }
  function hero(t, ctx) {
    return '<div class="ac4-haut ac-in" style="--i:1;--ph:' + PHASE.pharma + '"><span class="ac-fond" aria-hidden="true"></span>' +
      '<a class="ac4-ban ac-c-pharma"' + lien(t, 'pharma') + '>' +
      '<span class="ac4-tx"><span class="ac-top"><span class="ac-gl">' + P().ic('pharma') + '</span><span class="ac-nm">' + esc(t.nom) + '</span></span>' +
      '<span class="ac4-nb" data-slot="h.nb">' + slot('h.nb', ctx) + '</span></span>' +
      '<span class="ac-sc ac-sc-off ac4-sc">' + sceneOff() + '</span>' +
      '<span class="ac4-fi" data-slot="h.fi">' + slot('h.fi', ctx) + '</span></a></div>';
  }
  function autres(etat) {
    var p = P(), cles = [];
    (etat.fams || []).forEach(function (f) { f.cles.forEach(function (k) { if (CINQ.indexOf(k) < 0 && cles.indexOf(k) < 0) cles.push(k); }); });
    if (!cles.length) return '';
    return '<section class="ac-au ac-in" style="--i:9" aria-label="Autres outils"><h2>Autres outils</h2><div class="ac-au-l">' +
      cles.map(function (k) {
        var t = p.outil(k);
        return '<a class="ac-b"' + lien(t, k) + ' title="' + esc(t.ph) + '">' + p.ic(k) + esc(t.nom) + (t.ext ? '<span class="u2-sr">, s\'ouvre dans un nouvel onglet</span>' : '') + '</a>';
      }).join('') + '</div></section>';
  }

  /* ── Le centre complet (appelé une seule fois par montage de l'accueil) ── */
  function html(etat, cascade) {
    var p = P(); if (!p) return '';
    _sig = {};
    var ctx = contexte(), vis = etat.vis || [], cles = etat.cles || [];
    var presents = { pharma: vis.indexOf('pharma') >= 0, infos: vis.indexOf('infos') >= 0, todo: vis.indexOf('todo') >= 0, offilog: vis.indexOf('offilog') >= 0, groupements: cles.indexOf('pharma') >= 0 };
    var h = '<div class="ac-wrap' + (cascade ? ' ac-ent' : '') + '" id="u2-cinq">';
    if (presents.pharma) h += '<section aria-label="Officines">' + hero(ctx.t.pharma, ctx) + '</section>';
    var rang = '', i = 2;
    ['infos', 'todo', 'groupements', 'offilog'].forEach(function (k) {
      if (!presents[k]) return;
      rang += carte(k, i++, k === 'groupements' ? { k: k, nom: GRP.nom, ph: GRP.ph, href: GRP.href, act: GRP.act } : ctx.t[k], ctx);
    });
    if (rang) h += '<section class="ac4-rang" aria-label="Mes quatre autres outils"><h2 class="u2-sr">Mes quatre autres outils</h2>' + rang + '</section>';
    _sig.autres = autres(etat);
    return h + '<div id="u2-autres">' + _sig.autres + '</div></div>';
  }

  /* ── Mise à jour en place : seule une zone dont le texte a changé est remplacée ; les scènes ne bougent pas ── */
  var VU = null;
  function maj() {
    var p = P(), root = document.getElementById('u2-cinq'); if (!p || !root) return;
    var ctx = contexte(), etat = p.etat();
    Object.keys(SLOTS).forEach(function (k) {
      var el = root.querySelector('[data-slot="' + k + '"]'); if (!el) return;
      var h = SLOTS[k](ctx);
      if (_sig[k] === h) return;
      _sig[k] = h; el.innerHTML = h;
    });
    var au = document.getElementById('u2-autres');
    if (au) { var h2 = autres(etat); if (_sig.autres !== h2) { _sig.autres = h2; au.innerHTML = h2; } }
  }

  // Après la pose du centre : les compteurs roulent (premier passage seulement), les scènes se mettent en pause hors écran, l'entrée s'efface de la page
  function rouler(el, to, ms) {
    var fin = fr(to), t0 = null;
    if (calme()) { el.textContent = fin; return; }
    el.textContent = '0';
    requestAnimationFrame(function pas(t) {
      if (!document.contains(el)) return;
      if (t0 === null) t0 = t;
      var x = Math.min(1, (t - t0) / ms);
      el.textContent = x < 1 ? fr(to * (1 - Math.pow(1 - x, 3))) : fin;
      if (x < 1) requestAnimationFrame(pas);
    });
  }
  function apres(cascade) {
    var root = document.getElementById('u2-cinq'); if (!root) return;
    if (cascade) {
      [].forEach.call(root.querySelectorAll('[data-roule]'), function (n) { var v = +n.getAttribute('data-roule'); if (v > 0) rouler(n, v, 700); });
      setTimeout(function () { var r = document.getElementById('u2-cinq'); if (r) r.classList.remove('ac-ent'); }, 2400);
    }
    if (window.IntersectionObserver) {
      if (VU) VU.disconnect();
      VU = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('ac-hors', !e.isIntersecting); }); }, { rootMargin: '80px' });
      [].forEach.call(root.querySelectorAll('.ac-c, .ac4-haut'), function (c) { VU.observe(c); });
    }
  }
  /* la tache de lumière du bandeau suit le pointeur : un seul écouteur, posé une fois */
  document.addEventListener('pointermove', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.ac4-haut'); if (!b) return;
    var r = b.getBoundingClientRect(); b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  V2.accueilCinq = { html: html, maj: maj, apres: apres, CINQ: CINQ };
})();
