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
  // 15/10/2026 — la nouveauté du moment, lue dans G4_UNE (v2-app.js) par le pont : rien après sa date de fin, en Escale, en OPSO, ni si la personne a masqué l'outil
  // 22/10/2026 — « Listing produits 2027 » (à la place du QG) n'est pas un outil de la liste : seule la base dit qui le voit
  function une() {
    var p = P(), u = p && p.une ? p.une() : null; if (!u) return null;
    if (u.page === 'listings2027') return lsAcces() === true ? u : null;
    return p.vis().indexOf(u.page) >= 0 ? u : null;
  }
  function lsAcces() { var L = V2.listings2027; return L && L.acces ? L.acces() : false; }

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

  // 15/10/2026 — scène de Le QG : deux bulles de conversation, quelqu'un écrit, l'ampoule des remontées éclaire le tout
  function sceneQG() {
    return '<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="yq-nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ip-blue-d) 62%,#05070d)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ip-blue) 72%,var(--ip-blue-d))"/></linearGradient>' +
      '<radialGradient id="yq-lu" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF1CF" stop-opacity=".95"/><stop offset=".45" stop-color="#FFD27A" stop-opacity=".42"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="yq-am" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6DC"/><stop offset="1" stop-color="#FFC966"/></linearGradient>' +
      '</defs><rect width="240" height="150" fill="url(#yq-nuit)"/>' +
      '<g class="acq-halo"><circle cx="186" cy="44" r="58" fill="url(#yq-lu)"/></g>' +
      '<g class="acq-b1"><path d="M30 36 h92 a10 10 0 0 1 10 10 v26 a10 10 0 0 1 -10 10 h-70 l-14 11 v-11 h-8 a10 10 0 0 1 -10 -10 v-26 a10 10 0 0 1 10 -10 z" fill="#fff"/>' +
      '<rect x="36" y="48" width="70" height="6" rx="3" style="fill:var(--ip-blue)" opacity=".55"/><rect x="36" y="60" width="50" height="6" rx="3" style="fill:var(--ip-blue)" opacity=".3"/></g>' +
      '<g class="acq-b2"><path d="M98 92 h92 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-8 v10 l-13 -10 h-71 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 z" style="fill:color-mix(in srgb,var(--ip-blue) 42%,#fff)"/>' +
      '<rect x="106" y="103" width="56" height="6" rx="3" fill="#fff" opacity=".9"/><rect x="106" y="114" width="78" height="6" rx="3" fill="#fff" opacity=".55"/></g>' +
      '<g><rect x="22" y="104" width="50" height="24" rx="12" fill="#fff" opacity=".16"/>' +
      '<circle class="acq-pt" style="--k:0" cx="36" cy="116" r="3.2" fill="#fff"/><circle class="acq-pt" style="--k:1" cx="47" cy="116" r="3.2" fill="#fff"/><circle class="acq-pt" style="--k:2" cx="58" cy="116" r="3.2" fill="#fff"/></g>' +
      '<g><circle cx="186" cy="40" r="14" fill="url(#yq-am)"/><path d="M180 52 h12 v6 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 z" style="fill:color-mix(in srgb,var(--ip-blue) 30%,#fff)"/>' +
      '<path d="M181 55 h10" style="stroke:var(--ip-blue-d)" stroke-opacity=".4" stroke-width="1.4"/><path d="M182 38 q4 5 8 0" fill="none" stroke="#C7791A" stroke-width="1.6" stroke-linecap="round"/></g>' +
      '</svg>';
  }
  // 22/10/2026 — même nuit et même lumière que la scène du QG : une liste de produits, une ligne retenue, l'étiquette 2027
  function sceneListe() {
    function ligne(y, k, vu) {
      return (vu ? '<rect x="32" y="' + (y - 5) + '" width="116" height="24" rx="8" fill="#FFF1CF"/>' : '') +
        '<rect x="40" y="' + y + '" width="14" height="14" rx="4" style="fill:color-mix(in srgb,var(--ip-blue) ' + (vu ? 55 : 22) + '%,#fff)"/>' +
        '<rect x="60" y="' + (y + 4) + '" width="' + (vu ? 46 : 40) + '" height="6" rx="3" style="fill:var(--ip-blue)" opacity="' + (vu ? '.6' : '.3') + '"/>' +
        '<rect class="acq-pt" x="114" y="' + (y + 1) + '" width="28" height="12" rx="6" ' + (vu ? 'style="--k:' + k + '" fill="url(#yl-am)"' : 'style="--k:' + k + ';fill:var(--ip-blue)" opacity=".18"') + '/>';
    }
    return '<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="yl-nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ip-blue-d) 62%,#05070d)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ip-blue) 72%,var(--ip-blue-d))"/></linearGradient>' +
      '<radialGradient id="yl-lu" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF1CF" stop-opacity=".95"/><stop offset=".45" stop-color="#FFD27A" stop-opacity=".42"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="yl-am" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A8"/><stop offset="1" stop-color="#FFB940"/></linearGradient>' +
      '</defs><rect width="240" height="150" fill="url(#yl-nuit)"/>' +
      '<g class="acq-halo"><circle cx="186" cy="44" r="58" fill="url(#yl-lu)"/></g>' +
      '<g class="acq-b1"><rect x="24" y="22" width="132" height="112" rx="12" fill="#fff"/>' +
      '<rect x="40" y="34" width="58" height="7" rx="3.5" style="fill:var(--ip-blue-d)" opacity=".7"/>' +
      ligne(56, 0, false) + ligne(84, 1, true) + ligne(110, 2, false) + '</g>' +
      '<g class="acq-b2"><rect x="166" y="92" width="56" height="28" rx="9" style="fill:color-mix(in srgb,var(--ip-blue) 42%,#fff)"/>' +
      '<text x="194" y="111.5" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">2027</text></g>' +
      '<g><circle cx="186" cy="44" r="17" fill="url(#yl-am)"/>' +
      '<text x="186" y="51" text-anchor="middle" font-size="20" font-weight="800" fill="#9A5A00">€</text></g>' +
      '</svg>';
  }
  var CK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect class="bx" x="1.5" y="1.5" width="17" height="17" rx="5"/><path class="ck" pathLength="1" d="M5.2 10.4 8.7 13.8 14.8 6.6"/></svg>';


  /* ── 28/10/2026 — « Mon secteur comparé à la moyenne Intégral » (modèle : psBloc du Pilotage, rentaChiffres de la fiche officine) ──
     Côté secteur : calculé ici depuis MARGE_CLIENTS.r, comme psBloc (les lignes du commercial SEUL). Côté moyenne : LU dans MARGE_CLIENTS.pilotageMoy.f['<du>|<au>'],
     tout le réseau Intégral, précalculé par le générateur — jamais recalculé ici. Période : TOUS les mois du fichier de marges (l'accueil n'a pas de sélecteur). */
  var CMP_MODE = 'v2';
  var CMP_MF = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var CMP_MEMO = { ref: null, nom: null, d: null };
  function cEur(n) { return V2.fmtEur ? V2.fmtEur(n) : fr(n) + ' €'; }
  function cDec(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function cEnt(x) { return Math.round(x).toLocaleString('fr-FR'); }
  function cmpSecteur(MC, nom, fen) {
    var ci = MC.c.indexOf(nom); if (ci < 0) return null;
    var ok = {}; fen.forEach(function (f) { ok[f.an] = 1; });
    var cout = (MC.livraison && +MC.livraison.cout) || 0, off = {};
    MC.r.forEach(function (l) {
      if (l[0] !== ci || !ok[l[2]]) return;
      var id = MC.o[l[1]], x = off[id] || (off[id] = { ca: 0, mg: 0, j: {} });
      x.ca += l[3]; x.mg += l[4];
      if ((l[13] || 0) > (x.j[l[2]] || 0)) x.j[l[2]] = l[13] || 0;
    });
    var S = { n: 0, jm: 0, parJour: 0, renta: 0, caCl: 0, mgCl: 0 };
    Object.keys(off).forEach(function (id) {
      var x = off[id], J = 0, nm = 0;
      Object.keys(x.j).forEach(function (m) { if (x.j[m] > 0) { J += x.j[m]; nm++; } });
      if (!J) return;
      S.n++; S.jm += J / nm; S.parJour += x.mg / J; S.renta += (x.mg - J * cout) / nm; S.caCl += x.ca / nm; S.mgCl += x.mg / nm;
    });
    if (!S.n) return null;
    ['jm', 'parJour', 'renta', 'caCl', 'mgCl'].forEach(function (q) { S[q] /= S.n; });
    return S;
  }
  // null = rien à montrer (données pas là, pas de commercial, pas de ligne) : jamais un faux zéro
  function cmpDonnees() {
    var MC = window.MARGE_CLIENTS, PM = MC && MC.pilotageMoy, nom = V2.user && V2.user.commercial ? String(V2.user.commercial) : '';
    if (!MC || !MC.r || !MC.mois || !MC.mois.length || !PM || !PM.f || !nom) return null;
    if (CMP_MEMO.ref === MC && CMP_MEMO.nom === nom) return CMP_MEMO.d;
    var fen = MC.mois.map(function (m, i) { return { i: i, m: m, k: (+m.slice(0, 4)) * 12 + (+m.slice(5, 7)) - 1, an: +(m.slice(0, 4) + m.slice(5, 7)) }; });
    var M = PM.f[fen[0].m + '|' + fen[fen.length - 1].m], S = M ? cmpSecteur(MC, nom, fen) : null, d = null;
    if (M && S) {
      var a = fen[0].k, b = fen[fen.length - 1].k, cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
      var lib = a === b ? cap(CMP_MF[a % 12]) + ' ' + Math.floor(a / 12) : Math.floor(a / 12) === Math.floor(b / 12) ? cap(CMP_MF[a % 12]) + ' → ' + CMP_MF[b % 12] + ' ' + Math.floor(b / 12) : cap(CMP_MF[a % 12]) + ' ' + Math.floor(a / 12) + ' → ' + CMP_MF[b % 12] + ' ' + Math.floor(b / 12);
      var C = PM.couv || {}, inc = fen.filter(function (f) { return C[f.m]; }).map(function (f) { return CMP_MF[f.k % 12]; });
      d = { S: S, M: M, lib: lib, note: inc.length ? ' · ' + inc.join(', ') + (inc.length > 1 ? ' incomplets' : ' incomplet') : '' };
    }
    CMP_MEMO = { ref: MC, nom: nom, d: d }; return d;
  }
  // Une ligne : libellé, barre du secteur + valeur, puis DESSOUS la barre grise de la moyenne + valeur + étiquette (même échelle pour les deux).
  function cmpLigne(lib, v, f, fV, fF, libF) {
    var max = Math.max(Math.abs(v), Math.abs(f), 1e-9);
    var w = function (x) { return Math.max(2, Math.min(100, Math.abs(x) / max * 100)).toFixed(1); };
    var barre = function (x, fmt) { return '<i style="width:calc((100% - 84px) * ' + (w(x) / 100).toFixed(3) + ')"></i><b>' + fmt(x) + '</b>'; };
    return '<span class="cm-l"><span class="cm-n">' + esc(lib) + '</span>' +
      '<span class="cm-b"><span class="cm-tr">' + barre(v, fV) + '</span><span class="cm-sp"></span></span>' +
      '<span class="cm-b cm-fr"><span class="cm-tr">' + barre(f, fF) + '</span><span class="cm-lb">' + esc(libF) + '</span></span></span>';
  }
  function cmpLignes(D, cles) {
    var S = D.S, M = D.M, t = {
      n: ['Clients actifs', S.n, M.nSect, cEnt, cDec, 'Secteur moyen Intégral'],
      caCl: ['CA par client / mois', S.caCl, M.caCl, cEur, cEur, 'Moy. Intégral'],
      mgCl: ['Notre marge par client / mois', S.mgCl, M.mgCl, cEur, cEur, 'Moy. Intégral'],
      jm: ['Livraisons / mois', S.jm, M.jm, cDec, cDec, 'Moy. Intégral'],
      parJour: ['Marge par livraison', S.parJour, M.parJour, cEur, cEur, 'Moy. Intégral'],
      renta: ['Marge − livraisons / mois', S.renta, M.renta, cEur, cEur, 'Moy. Intégral']
    };
    return cles.map(function (k) { var x = t[k]; return cmpLigne(x[0], x[1], x[2], x[3], x[4], x[5]); }).join('');
  }
  // v2 seulement : sous 1100 px la colonne de droite passe SOUS le centre (hors du premier écran) ; le même modèle est alors posé juste sous Officines,
  // et seulement si le widget est posé sur l'accueil (le retirer retire aussi cette bande). Au-delà de 1100 px la bande est cachée (voir le CSS).
  function cmpMob() {
    var Wd = V2.accueilWidgets; if (!Wd || !Wd.pose || !Wd.pose('secteur')) return '';
    var D = cmpDonnees(); if (!D) return '';
    return '<span class="cm-mt">Mon secteur comparé à la moyenne Intégral</span>' + cmpWidget('M');
  }
  var CMP_HERO = ['n', 'caCl', 'mgCl'];
  function cmpHero() {
    var D = cmpDonnees(); if (!D) return '';
    return '<span class="cm-h"><b>Mon secteur comparé à la moyenne Intégral</b><span>' + esc(D.lib + D.note) + ' · par client</span></span>' +
      '<span class="cm-g">' + cmpLignes(D, CMP_HERO) + '</span>';
  }
  // Le widget : v2 = tout le modèle (2, 4 ou 6 lignes selon la taille) ; v3 = la moitié « Rentabilité » (le haut de l'accueil porte « Ventes »)
  function cmpWidget(t) {
    var D = cmpDonnees();
    if (!D) return '<p class="aw-v">' + (window.MARGE_CLIENTS && window.MARGE_CLIENTS.r ? 'Pas encore de chiffres de marge pour votre secteur.' : 'Les chiffres de marge se chargent : le détail arrive.') + '</p>';
    var v3 = CMP_MODE === 'v3', cles = v3 ? (t === 'S' ? ['parJour', 'renta'] : ['jm', 'parJour', 'renta']) : t === 'S' ? ['n', 'mgCl'] : t === 'M' ? ['n', 'caCl', 'mgCl', 'jm'] : ['n', 'caCl', 'mgCl', 'jm', 'parJour', 'renta'];
    return '<div class="aw-cmp"><span class="cm-s">' + (v3 ? 'Comparée à la moyenne Intégral · ' : '') + esc(D.lib + D.note) + (v3 ? '' : ' · par client') + '</span><span class="cm-g">' + cmpLignes(D, cles) + '</span></div>';
  }

  /* ── Le contenu vivant de chaque carte : une fonction par zone, rendue seulement quand sa donnée change ── */
  function nb(n, lib, anim) { return '<span class="ac-nb"><b' + (anim ? ' data-roule="' + n + '"' : '') + '>' + fr(n) + '</b><span>' + esc(lib) + '</span></span>'; }
  function ds(t) { return '<span class="ac-ds">' + esc(t) + '</span>'; }

  // 28/10/2026 — « N à rappeler » (v2-decrochage.js) : rien tant que ce n'est pas calculable, jamais un faux 0.
  function aRappeler() {
    var n = null; try { n = V2.decrochageUI ? V2.decrochageUI.compte() : null; } catch (e) {}
    return typeof n === 'number' && n > 0 ? '<span class="ac-sub">À rappeler : <b>' + fr(n) + '</b></span>' : '';
  }
  var C = {
    // Bandeau Officines : le nombre (ou l'avancement du chargement), puis les dernières fiches
    heroNb: function (m, t) {
      if (m.partiel) {
        var pr = V2.ventesProgres || {};
        return '<span class="ac-vente" id="v2-ventes-etat">Chargement des ventes… <b>' + (pr.n || 0) + '</b> / ' + (pr.total || '?') + '</span>';
      }
      return nb(m.nb, m.nb > 1 ? 'officines actives' : 'officine active', true) + (m.mes != null ? '<span class="ac-sub">Vos officines : <b>' + fr(m.mes) + '</b></span>' : '') + aRappeler();
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
      if (!l.length) return '<span class="ac-vide">Rien à faire pour l\'instant.</span>' + C.relN();
      return '<span class="ac-tl">' + l.slice(0, 3).map(function (x, j) { return '<span class="ac-t" style="--j:' + j + '">' + CK + '<span>' + esc(x) + '</span></span>'; }).join('') + '</span>' +
        (l.length > 3 ? '<span class="ac-reste">+ ' + (l.length - 3) + (l.length - 3 > 1 ? ' autres à faire' : ' autre à faire') + '</span>' : '') + C.relN();
    },
    // 16/10/2026 — choix de Will : un compteur discret des pharmacies à relancer (To do list › À relancer).
    // Le calcul (carte nationale + envois) part une seule fois, après l'affichage ; rien tant qu'il n'est pas fait (jamais un faux « 0 »).
    relN: function () {
      var R = V2.relances; if (!R || !R.nbARelancer) return '';
      var n; try { n = R.nbARelancer(); } catch (e) { return ''; }   // l'accueil ne doit jamais tomber pour un compteur
      if (n == null) {
        if (!_relLance) { _relLance = true; setTimeout(function () { R.calculer().then(maj, function () {}); }, 2500); }
        return '';
      }
      return n ? '<span class="ac-reste ac-rel">' + fr(n) + (n > 1 ? ' pharmacies à relancer' : ' pharmacie à relancer') + '</span>' : '';
    },
    grpScene: function () { var g = groupes().slice(0, 5).map(function (x) { return x.ids.length; }); return sceneGrp(g); },
    grp: function () {
      var n = groupes().length;
      return (n ? nb(n, n > 1 ? 'groupements' : 'groupement', true) : '') + ds(GRP.ph);
    },
    offilog: function (t) { var n = offilogN(); return (n ? nb(n, 'références', true) : '') + ds(t.ph); }
  };
  var _relLance = false;
  var SLOTS = {
    'h.phrase': function () { return phrase(); },
    'h.reprendre': function () { return reprendre(); },
    'h.pill': function () { return m1Pill(); },
    'h.nb': function (ctx) { return m1Nb(ctx.m); },
    'h.cmp': function () { return m1Cmp(); },
    'h.rel': function () { return m1Rel(); },
    'todo.bd': function () { return m1Todo(); },
    'todo.ft': function () { return m1TodoPied(); },
    'infos.pt': function () { return m1InfosPt(); },
    'infos.bd': function () { return m1Infos(); },
    'infos.ft': function () { return m1InfosPied(); },
    'grp.sc': function () { return C.grpScene(); },
    'grp.bd': function () { return m1Grp(); },
    'grp.ft': function () { return m1GrpPied(); },
    'offi.bd': function () { return m1Offi(); },
    'offi.ft': function () { return m1OffiPied(); }
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
  // Le bandeau : la nouveauté du moment, une seule zone cliquable entre Officines et les quatre cartes
  function bandeauQG(u) {
    var p = P(), t = u.href ? u : p.outil(u.page);
    return '<section class="acq-zone ac-in" style="--i:2" aria-label="Nouveauté"><a class="acq-ban"' + lien(t, u.page) + '>' +
      '<span class="ac-sc acq-sc">' + (u.page === 'listings2027' ? sceneListe() : sceneQG()) + '</span>' +
      '<span class="acq-tx"><span class="acq-l1"><span class="acq-nv">Nouveau</span><b class="acq-nm">' + esc(u.nom) + '</b></span>' +
      '<span class="acq-ph">' + esc(u.ph) + '</span></span>' +
      '<span class="acq-go" aria-hidden="true">Découvrir' + p.ic('arrow') + '</span></a></section>';
  }
  function autres(etat) {
    var p = P(), cles = [], u = une(), reg = !!(V2.accueilWidgets && V2.accueilWidgets.regle && V2.accueilWidgets.regle());
    // Mode réglage (16/10/2026) : TOUS les outils du groupe, masqués compris, chacun avec son œil ; sinon seulement ceux qu'on a laissés visibles
    ((reg ? etat.tous : etat.fams) || []).forEach(function (f) { f.cles.forEach(function (k) { if (CINQ.indexOf(k) < 0 && cles.indexOf(k) < 0 && !(u && k === u.page)) cles.push(k); }); });
    if (!reg || !cles.length) return '';
    var masques = (p.S().masques) || [];
    return '<section class="ac-au ac-in' + (reg ? ' ac-au-reg' : '') + '" style="--i:9" aria-label="Autres outils"><h2>Autres outils' + (reg ? '<small>Appuyez sur l\'œil pour afficher ou masquer un outil</small>' : '') + '</h2><div class="ac-au-l">' +
      cles.map(function (k) {
        var t = p.outil(k);
        if (reg) {
          var off = masques.indexOf(k) >= 0;
          return '<span class="ac-b ac-b-reg' + (off ? ' ac-b-off' : '') + '" data-tool="' + esc(k) + '">' + p.ic(k) + '<span class="ac-b-nm">' + esc(t.nom) + '</span>' +
            '<button type="button" class="pb-eye" data-pb="oeil" data-v="' + esc(k) + '" aria-pressed="' + !off + '" aria-label="' + (off ? 'Afficher ' : 'Masquer ') + esc(t.nom) + '" title="' + (off ? 'Afficher' : 'Masquer') + '">' + p.ic(off ? 'oeilbarre' : 'oeil') + '</button></span>';
        }
        return '<a class="ac-b"' + lien(t, k) + ' title="' + esc(t.ph) + '">' + p.ic(k) + esc(t.nom) + (t.ext ? '<span class="u2-sr">, s\'ouvre dans un nouvel onglet</span>' : '') + '</a>';
      }).join('') + '</div></section>';
  }

  /* ═══ 30/10/2026 — maquette 1 « JARVIS plus clair » (choisie par Will) : l'accueil en cinq cases, une réponse par case ═══
     Chaque chiffre vient de ce que l'app calcule déjà (aucune requête nouvelle) ; une donnée absente = la case le dit, jamais un faux zéro.
     Les cases portent aussi la classe ac-c : les habillages (v2-hab.css) les reconnaissent et posent leur matière. ═══ */
  var CATS = { 'beaute-et-soins': 'Beauté & soins', sante: 'Santé', hygiene: 'Hygiène', bebe: 'Bébé', solaires: 'Solaires', veterinaire: 'Vétérinaire' };
  function lumiere() { return document.documentElement.classList.contains('m1-lumiere'); }
  function plur(n, a, b) { return fr(n) + ' ' + (n > 1 ? b : a); }
  function court(nom) { return String(nom || '').replace(/^Pharmacie\s+(de la |de l['’]|des |du |de |d['’])?/i, '').trim() || String(nom || ''); }
  function titre(s) { s = String(s || ''); return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); }) : s; }
  function jourIso() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dateLongue() { return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/\b1 /, '1er '); }
  function chev(n) { return P().ic('chev', n || 18); }
  function top(ic, lab, extra) { return '<div class="m1-top"><span class="m1-ico">' + P().ic(ic, 20) + '</span><span class="m1-lab">' + esc(lab) + '</span>' + (extra || '') + '</div>'; }
  function pied(t, k, nom, slotK, corps) {
    return '<div class="m1-foot"><h3><a class="m1-go"' + lien(t, k) + '><span>' + esc(nom) + '</span></a></h3><p data-slot="' + slotK + '">' + corps + '</p></div>';
  }
  var _fait = {}, _aff = [];   // To do : les lignes cochées pendant cette visite restent à l'écran, rayées

  // La phrase de l'en-tête : une seule, calculée. Chaque morceau n'apparaît que si sa donnée est prête.
  function phrase() {
    var p = P(), parts = [], open = null, n = null, i;
    try { if (V2.todo && V2.todo.ouverts && p.todoItems() !== null) open = V2.todo.ouverts(); } catch (e) {}
    if (open) {
      var j = jourIso(), nj = open.filter(function (x) { return x.pour && x.pour <= j; }).length;
      parts.push(nj ? '<b>' + plur(nj, 'tâche', 'tâches') + '</b> aujourd’hui' : open.length ? '<b>' + plur(open.length, 'tâche', 'tâches') + '</b> à faire' : 'aucune tâche en attente');
    }
    try { n = V2.decrochageUI ? V2.decrochageUI.compte() : null; } catch (e) {}
    if (typeof n === 'number') parts.push(n ? '<b>' + plur(n, 'officine', 'officines') + '</b> à rappeler' : 'aucune officine à rappeler');
    i = p.infos();
    if (i.etat === 'ok' && i.nb != null && i.quand !== 'ancien') parts.push('<b>' + plur(i.nb, 'info', 'infos') + '</b> ' + (i.quand === 'hier' ? 'd’hier' : 'du jour'));
    if (!parts.length) return '';
    var s = parts.join(', ') + '.';
    return s.charAt(0) === '<' ? s : s.charAt(0).toUpperCase() + s.slice(1);
  }
  function reprendre() {
    var f = fichesLire()[0]; if (!f) return '';
    var id = encodeURIComponent(String(f.id));
    return '<a class="m1-btn" href="#pharma/' + id + '" data-u2-act="rel:' + id + '">Reprendre : ' + esc(court(f.nom)) + chev(16) + '</a>';
  }
  function entete(ctx) {
    return '<div class="u2-salut m1-hd ac-in" style="--i:0"><div class="m1-hd-t"><p class="v2-sous m1-eye">' + esc(dateLongue()) + '</p>' +
      '<h1 class="v2-titre" id="u2-salut">' + esc(P().salut()) + '</h1>' +
      '<p class="v2-sous m1-phrase" data-slot="h.phrase">' + slot('h.phrase', ctx) + '</p></div>' +
      '<span class="m1-hd-a" data-slot="h.reprendre">' + slot('h.reprendre', ctx) + '</span></div>';
  }
  function m1Une(u) {
    var p = P(), t = u.href ? u : p.outil(u.page);
    return '<a class="m1-une ac-in" style="--i:1"' + lien(t, u.page) + '><span class="m1-une-nv">Nouveau</span><span class="m1-une-tx"><b>' + esc(u.nom) + '</b><span>' + esc(u.ph) + '</span></span><span class="m1-une-go">Découvrir' + p.ic('arrow', 16) + '</span></a>';
  }

  // ── Officines : le nombre, la comparaison secteur / moyenne Intégral, les officines à rappeler ──
  function m1Pill() {
    var n = null; try { n = V2.decrochageUI ? V2.decrochageUI.compte() : null; } catch (e) {}
    return typeof n === 'number' && n > 0 ? '<span class="m1-pill m1-warn">' + fr(n) + ' à rappeler</span>' : '';
  }
  function m1Nb(m) {
    if (m.partiel) {
      var pr = V2.ventesProgres || {};
      return '<span class="m1-vente" id="v2-ventes-etat">Chargement des ventes… <b>' + (pr.n || 0) + '</b> / ' + (pr.total || '?') + '</span>';
    }
    return '<div class="m1-big"><b data-roule="' + m.nb + '">' + fr(m.nb) + '</b><small>' + (m.nb > 1 ? 'officines actives' : 'officine active') + '</small></div>' +
      (m.mes != null ? '<div class="m1-sub">Vos officines : <b>' + fr(m.mes) + '</b></div>' : '');
  }
  function m1Cmp() {
    var D = cmpDonnees();
    if (!D) return '<p class="m1-sub">' + (window.MARGE_CLIENTS && window.MARGE_CLIENTS.r ? 'Pas encore de chiffres de marge pour votre secteur.' : 'Les chiffres de marge se chargent : le détail arrive.') + '</p>';
    var v = D.S.caCl, f = D.M.caCl, mx = Math.max(Math.abs(v), Math.abs(f), 1e-9), diff = f ? (v - f) / Math.abs(f) * 100 : null;
    var w = function (x) { return Math.max(2, Math.min(100, Math.abs(x) / mx * 100)).toFixed(1); };
    var pill = diff == null ? '' : '<span class="m1-pill ' + (diff >= 0 ? 'm1-ok' : 'm1-bad') + '">' + (diff >= 0 ? '+' : '−') + cDec(Math.abs(diff)) + ' %</span>';
    return '<div class="m1-vs-h"><span>CA par client et par mois, face à la moyenne du réseau Intégral</span>' + pill + '</div>' +
      '<div class="m1-vs-r"><span>Mon secteur</span><i class="m1-trk"><i class="m1-fill" style="width:' + w(v) + '%"></i></i><b>' + esc(cEur(v)) + '</b></div>' +
      '<div class="m1-vs-r"><span>Réseau</span><i class="m1-trk"><i class="m1-fill m1-grey" style="width:' + w(f) + '%"></i></i><b>' + esc(cEur(f)) + '</b></div>' +
      '<div class="m1-per">' + esc(D.lib + D.note) + '</div>';
  }
  function m1Rel() {
    var l = null; try { l = V2.decrochageUI && V2.decrochageUI.liste ? V2.decrochageUI.liste(4) : null; } catch (e) {}
    if (!l || !l.length) return '';
    return '<span class="m1-rel-h">À rappeler</span>' + l.map(function (x) {
      var id = encodeURIComponent(x.pid);
      return '<a class="m1-chip" href="#pharma/' + id + '" data-u2-act="rel:' + id + '"><b>' + esc(court(x.nom)) + '</b><span>' + esc(x.ville) + '</span></a>';
    }).join('');
  }

  // ── To do list : trois tâches cochables pour de vrai (les lignes cochées restent là, rayées, jusqu'à la prochaine visite) ──
  function todoListe() {
    var l = P().todoItems(); if (!l) return null;
    var ids = {}; l.forEach(function (x) { ids[x.id] = x; });
    var out = [], vu = {};
    _aff.forEach(function (x) { if (ids[x.id] || _fait[x.id]) { out.push(ids[x.id] || x); vu[x.id] = 1; } });
    l.forEach(function (x) { if (!vu[x.id]) out.push(x); });
    out = out.slice(0, 3); _aff = out.slice();
    return out;
  }
  function m1Todo() {
    var l = todoListe();
    if (!l) return '<p class="m1-vide">Chargement de votre liste…</p>';
    if (!l.length) return '<p class="m1-vide">Rien à faire pour l’instant.</p>';
    return '<div class="m1-tlist">' + l.map(function (x, j) {
      var on = !!_fait[x.id];
      return '<button type="button" class="m1-trow m1-above" role="checkbox" aria-checked="' + on + '" data-u2-a="todo" data-v="' + esc(x.id) + '" style="--j:' + j + '">' +
        '<span class="m1-bx"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg></span><span class="m1-t">' + esc(x.lib) + '</span></button>';
    }).join('') + '</div>';
  }
  // 30/10/2026 — essai en production : l'ancienne case To do lançait, 2,5 s après l'affichage, le calcul des pharmacies à relancer (C.relN) ; l'écran To do list en a besoin
  // pour ses compteurs « À relancer · N » et « Prospects chauds · N » (sans ce calcul ils s'affichaient sans chiffre). La nouvelle case le lance de la même façon, sans rien afficher de plus.
  function relCalcul() {
    var R = V2.relances; if (!R || !R.nbARelancer || !R.calculer || _relLance) return;
    var n; try { n = R.nbARelancer(); } catch (e) { return; }
    if (n == null) { _relLance = true; setTimeout(function () { R.calculer().then(maj, function () {}); }, 2500); }
  }
  function m1TodoPied() {
    var p = P(), l = p.todoItems(); if (l === null) return '';
    var open = V2.todo && V2.todo.ouverts ? V2.todo.ouverts() : [];
    if (!open.length) return 'Ouvrir pour ajouter une tâche';
    var j = jourIso(), nj = open.filter(function (x) { return x.pour && x.pour <= j; }).length;
    return nj ? plur(nj, 'tâche pour aujourd’hui', 'tâches pour aujourd’hui') : plur(open.length, 'tâche à faire', 'tâches à faire');
  }

  // ── Infos du matin : deux infos, puis les trois compteurs du brief ──
  function heure(it) {
    try {
      var d = new Date(it.date); if (isNaN(d)) return '';
      return it.today ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ');
    } catch (e) { return ''; }
  }
  function m1Infos() {
    var p = P(), i = p.infos();
    if (i.etat === 'charge') return '<p class="m1-vide">Chargement du brief du jour…</p>';
    if (i.etat !== 'ok') return '<p class="m1-vide">Le brief du jour n’est pas encore arrivé.</p>';
    var d = p.infosData(), its = ((d && d.items) || []).filter(function (x) { return x && x.titre; });
    var jour = its.filter(function (x) { return x.today; }); if (jour.length) its = jour;
    its = its.slice(0, 2);
    if (!its.length) return '<p class="m1-vide">' + esc(i.titre) + '</p>';
    return '<div class="m1-ilist">' + its.map(function (x) {
      var mauvais = /rupture|rappel/i.test(x.titre) || /rupture|rappel/i.test(x.cat || '');
      return '<div class="m1-irow"><span class="m1-idot' + (mauvais ? ' m1-idot-bad' : '') + '"></span><div><b>' + esc(x.titre) + '</b><span>' + esc([x.source, heure(x)].filter(Boolean).join(' · ')) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function m1InfosPt() { var i = P().infos(); return i.etat === 'ok' && i.quand === 'auj' ? '<span class="m1-dot" title="Nouveau"></span>' : ''; }
  function m1InfosPied() {
    var i = P().infos(), c = [];
    if (i.etat !== 'ok') return '';
    if (i.nb != null) c.push(plur(i.nb, 'nouvelle', 'nouvelles'));
    if (i.rupt != null) c.push(plur(i.rupt, 'rupture en cours', 'ruptures en cours'));
    if (i.rapp != null) c.push(plur(i.rapp, 'rappel de produit', 'rappels de produits'));
    return esc(c.join(' · '));
  }

  // ── Groupements : quatre lignes, la part d'adhérents actifs (même calcul que le widget « Un groupement à la loupe ») ──
  function mesGroupes() {
    var m = P().m() || {};
    if (m.mes == null) return { l: groupes(), miens: false };
    var uc = String((V2.user && V2.user.commercial) || ''), by = {};
    (V2.pharmacies || []).forEach(function (ph) {
      if ((ph.comms || []).indexOf(uc) < 0) return;
      var g = nomG(ph); if (!g) return;
      (by[g] = by[g] || { nom: g, ids: [] }).ids.push(ph.id);
    });
    return { miens: true, l: Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.ids.length - a.ids.length || a.nom.localeCompare(b.nom, 'fr'); }) };
  }
  function m1Grp() {
    var G = mesGroupes().l; if (!G.length) return '<p class="m1-vide">Aucun groupement à suivre pour le moment.</p>';
    var m = P().m() || {}, ca = (!m.partiel && V2.caByPharma) ? V2.caByPharma() : null, rows;
    if (ca) rows = G.map(function (g) { var s = 0; g.ids.forEach(function (id) { s += ca[id] || 0; }); return { nom: g.nom, v: s, t: (V2.fmtK ? V2.fmtK(s) : fr(s)) + '\u00A0€' }; }).sort(function (a, b) { return b.v - a.v; });
    else rows = G.map(function (g) { return { nom: g.nom, v: g.ids.length, t: fr(g.ids.length) }; });
    rows = rows.slice(0, 4);
    var mx = Math.max(rows[0].v, 1e-9);
    return '<div class="m1-glist">' + rows.map(function (g, i) {
      return '<div class="m1-grow"><span title="' + esc(g.nom) + '">' + esc(g.nom) + '</span><i class="m1-trk"><i class="m1-fill" style="width:' + Math.max(2, Math.round(g.v / mx * 100)) + '%;--i:' + i + '"></i></i><b>' + esc(g.t) + '</b></div>';
    }).join('') + '</div>';
  }
  function m1GrpPied() {
    var R = mesGroupes(), n = R.l.length, m = P().m() || {};
    if (!n) return '';
    return esc(plur(n, 'groupement', 'groupements') + (R.miens ? ' dans votre secteur' : '') + ' · ' + ((!m.partiel && V2.caByPharma) ? 'chiffre d’affaires, les quatre premiers' : 'les ventes se chargent'));
  }

  // ── Offilog : les trois premiers produits de la centrale (rang, marque, produit, rayon) ──
  function m1Offi() {
    var B = window.OFFILOG_BEST; if (!B || !B.length) B = _offiTop && _offiTop.top; if (!B || !B.length) return '<p class="m1-vide">Le classement Offilog se charge.</p>';
    return '<div class="m1-plist">' + B.slice(0, 3).map(function (b, j) {
      var nm = String(b.name || ''), k = nm.indexOf(' – '), marque = k > 0 ? nm.slice(0, k) : (b.brand || ''), reste = k > 0 ? nm.slice(k + 3) : nm;
      return '<div class="m1-prow" style="--j:' + j + '"><b class="m1-rk">' + esc(b.rank) + '</b><div><b>' + esc(titre(marque)) + '</b><span>' + esc(reste) + '</span></div>' +
        (CATS[b.cat] ? '<span class="m1-pill m1-info">' + esc(CATS[b.cat]) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  // 30/10/2026 — essai en production : le classement Offilog (window.OFFILOG_BEST) ne se charge qu'à l'ouverture de l'écran Offilog, donc la case restait sur
  // « se charge » tant qu'on n'y était pas allé (le banc local, lui, l'avait préchargé). On le lit une fois, après le premier dessin, dans un cadre invisible
  // (même adresse et même jeton que v2-offilog.js : le navigateur ne le télécharge qu'une fois), on n'en garde que les trois premiers produits et le total,
  // puis on referme le cadre. ⚠️ Surtout PAS dans la page elle-même : window.OFFILOG_BEST posé d'avance ferait croire à l'écran Offilog que tout est chargé
  // et il ne demanderait plus les prix B2B (constaté en production : « prix Offilog moyen — »). Les prix ne sont jamais demandés ici.
  var MOD_DIR = (function () { try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[?#].*$/, '').replace(/[^/]+$/, ''); } catch (e) {} return ''; })();
  var _offiTente = false, _offiTop = null;
  function offiCharger() {
    if (_offiTente || window.OFFILOG_BEST) return;
    _offiTente = true;
    setTimeout(function () {
      if (window.OFFILOG_BEST) { maj(); return; }
      var f = document.createElement('iframe'), fin = function () { try { if (f.parentNode) f.parentNode.removeChild(f); } catch (e) {} };
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = ''; f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
      f.onload = function () {
        try {
          var B = f.contentWindow && f.contentWindow.OFFILOG_BEST;
          if (B && B.length) { _offiTop = { n: B.length, top: B.slice(0, 3).map(function (b) { return { rank: b.rank, name: b.name, brand: b.brand, cat: b.cat }; }) }; }
        } catch (e) {}
        fin(); if (_offiTop) maj();
      };
      f.srcdoc = '<!doctype html><script src="' + MOD_DIR + 'offilog-bestsellers-data.js?v=20261019pt"><\/script>';
      document.body.appendChild(f);
    }, 1500);
  }
  function m1OffiPied() { var n = offilogN() || (_offiTop ? _offiTop.n : 0); return n ? esc(fr(n) + ' références · la centrale parapharmacie') : ''; }

  // 30/10/2026 (v3) — les scènes animées de l'accueil d'avant reviennent, chacune dans SA case : le code des scènes est celui d'au-dessus (sceneOff, sceneInfos, sceneTodo, sceneGrp, sceneOffi), rien n'est redessiné.
  // Une scène est un bandeau SANS texte, derrière l'en-tête de la case ; la réponse de la case reste dessous. aria-hidden : c'est un décor qui porte du mouvement, pas de l'information.
  function scn(k, svg, cls) { return '<span class="ac-sc m1-scn m1-scn-' + k + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + svg + '</span>'; }
  function cOff(ctx) {
    var t = ctx.t.pharma;
    return '<section class="ac-c ac-c-pharma m1-c m1-off ac-in" style="--i:1;--ph:' + PHASE.pharma + '" aria-label="' + esc(t.nom) + '"><span class="ac-fond" aria-hidden="true"></span>' + scn('off', sceneOff(), 'ac-sc-off') +
      top('pharma', t.nom, '<span class="m1-sl" data-slot="h.pill">' + slot('h.pill', ctx) + '</span>') +
      '<div class="m1-off-b"><div data-slot="h.nb">' + slot('h.nb', ctx) + '</div><div class="m1-vs" data-slot="h.cmp">' + slot('h.cmp', ctx) + '</div></div>' +
      '<div class="m1-rel" data-slot="h.rel">' + slot('h.rel', ctx) + '</div>' +
      '<div class="m1-foot"><h3><a class="m1-go"' + lien(t, 'pharma') + '><span>Ouvrir mes officines</span></a></h3></div></section>';
  }
  function cTodo(ctx) {
    var t = ctx.t.todo;
    return '<section class="ac-c ac-c-todo m1-c m1-todo ac-in" style="--i:2;--ph:' + PHASE.todo + '" aria-label="' + esc(t.nom) + '">' + scn('todo', sceneTodo(), 'ac-sc-td') + top('todo', t.nom, '<span class="m1-arrow">' + chev() + '</span>') +
      '<div data-slot="todo.bd">' + slot('todo.bd', ctx) + '</div>' + pied(t, 'todo', t.nom, 'todo.ft', slot('todo.ft', ctx)) + '</section>';
  }
  function cInfos(ctx) {
    var t = ctx.t.infos;
    return '<section class="ac-c ac-c-infos m1-c m1-infos ac-in" style="--i:3;--ph:' + PHASE.infos + '" aria-label="' + esc(t.nom) + '">' + scn('infos', sceneInfos()) + top('infos', t.nom, '<span class="m1-sl" data-slot="infos.pt">' + slot('infos.pt', ctx) + '</span>') +
      '<div data-slot="infos.bd">' + slot('infos.bd', ctx) + '</div>' + pied(t, 'infos', t.nom, 'infos.ft', slot('infos.ft', ctx)) + '</section>';
  }
  function cGrp(ctx) {
    var t = { k: 'groupements', nom: GRP.nom, ph: GRP.ph, href: GRP.href, act: GRP.act };
    return '<section class="ac-c ac-c-groupements m1-c m1-grp ac-in" style="--i:4;--ph:' + PHASE.groupements + '" aria-label="' + esc(t.nom) + '">' + scn('grp', '<span data-slot="grp.sc" class="ac-slot-sc">' + slot('grp.sc', ctx) + '</span>', 'ac-sc-gr') + top('clients', t.nom, '<span class="m1-arrow">' + chev() + '</span>') +
      '<div data-slot="grp.bd">' + slot('grp.bd', ctx) + '</div>' + pied(t, 'groupements', t.nom, 'grp.ft', slot('grp.ft', ctx)) + '</section>';
  }
  function cOffi(ctx) {
    var t = ctx.t.offilog;
    return '<section class="ac-c ac-c-offilog m1-c m1-offi ac-in" style="--i:5;--ph:' + PHASE.offilog + '" aria-label="' + esc(t.nom) + '">' + scn('offi', sceneOffi(), 'ac-sc-of') + top('offilog', t.nom, '<span class="m1-arrow">' + chev() + '</span>') +
      '<div data-slot="offi.bd">' + slot('offi.bd', ctx) + '</div>' + pied(t, 'offilog', t.nom, 'offi.ft', slot('offi.ft', ctx)) + '</section>';
  }
  // v3 : onglet caché = toutes les boucles de la grille s'arrêtent (la case hors écran est déjà arrêtée par l'observateur plus bas : ac-hors)
  document.addEventListener('visibilitychange', function () { var r = document.getElementById('u2-cinq'); if (r) r.classList.toggle('m1-pause', document.hidden); });
  /* le halo de bordure de la maquette : deux variables CSS posées sous la souris (aucun flou, aucun masque) ; au doigt, rien */
  var _gl = { raf: 0, x: 0, y: 0, c: null };
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var c = e.target && e.target.closest && e.target.closest('.m1-c'); if (!c) return;
    _gl.x = e.clientX; _gl.y = e.clientY; _gl.c = c;
    if (_gl.raf) return;
    _gl.raf = requestAnimationFrame(function () { _gl.raf = 0; var r = _gl.c.getBoundingClientRect(); _gl.c.style.setProperty('--x', (_gl.x - r.left) + 'px'); _gl.c.style.setProperty('--y', (_gl.y - r.top) + 'px'); });
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    var c = e.target && e.target.closest && e.target.closest('.m1-c');
    if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--x'); c.style.removeProperty('--y'); }
  });

  /* ── Le centre complet (appelé une seule fois par montage de l'accueil) ── */
  function html(etat, cascade) {
    var p = P(); if (!p) return '';
    _sig = {}; _fait = {}; _aff = [];
    var ctx = contexte(), vis = etat.vis || [], cles = etat.cles || [];
    var presents = { pharma: vis.indexOf('pharma') >= 0, infos: vis.indexOf('infos') >= 0, todo: vis.indexOf('todo') >= 0, offilog: vis.indexOf('offilog') >= 0, groupements: cles.indexOf('pharma') >= 0 };
    var h = '<div class="ac-wrap m1-wrap' + (cascade ? ' ac-ent' : '') + '" id="u2-cinq">' + entete(ctx);
    var u = une(), pu = p.une ? p.une() : null;
    if (u) h += m1Une(u);
    else if (pu && pu.page === 'listings2027' && lsAcces() === null) h += '<div id="acq-att"></div>';   // la base n'a pas encore répondu : apres() le pose
    h += '<div class="m1-bento">' + (presents.pharma ? cOff(ctx) : '') + (presents.todo ? cTodo(ctx) : '') + (presents.infos ? cInfos(ctx) : '') +
      (presents.groupements ? cGrp(ctx) : '') + (presents.offilog ? cOffi(ctx) : '') + '</div></div>';
    return h;
  }
  // « Autres outils » (les yeux) : seulement en mode réglage, sous les widgets. En temps normal les outils vivent dans le rail.
  function autresBloc(etat) { _sig.autres = autres(etat); return '<div id="u2-autres">' + _sig.autres + '</div>'; }

  /* ── Mise à jour en place : seule une zone dont le texte a changé est remplacée ; les scènes ne bougent pas ── */
  var VU = null;
  function maj() {
    var p = P(), root = document.getElementById('u2-cinq'); if (!p || !root) return;
    var ctx = contexte(), etat = p.etat();
    Object.keys(SLOTS).forEach(function (k) {
      var el = root.querySelector('[data-slot="' + k + '"]'); if (!el) return;
      var h = SLOTS[k](ctx);
      if (_sig[k] === h) return;
      _sig[k] = h; el.innerHTML = h; arriver(el);
    });
    var au = document.getElementById('u2-autres');
    if (au) { var h2 = autres(etat); if (_sig.autres !== h2) { _sig.autres = h2; au.innerHTML = h2; } }
    if (p.railMaj) p.railMaj();   // le rail suit les outils masqués ou rendus
  }

  // 30/10/2026 — quand une donnée arrive après le premier dessin (les ventes, les marges), sa zone se pose avec le même mouvement que l'arrivée : barres qui se tracent, chiffre qui compte (version « lumière »)
  function arriver(el) {
    if (!el || !el.querySelector || !el.querySelector('.m1-fill,[data-roule]')) return;
    if (lumiere()) [].forEach.call(el.querySelectorAll('[data-roule]'), function (n) { var v = +n.getAttribute('data-roule'); if (v > 0) rouler(n, v, 520); });
    if (calme()) return;
    el.classList.remove('m1-arr'); void el.offsetWidth; el.classList.add('m1-arr');
    setTimeout(function () { el.classList.remove('m1-arr'); }, 900);
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
    if (root.querySelector('.m1-offi')) offiCharger();
    if (root.querySelector('.m1-todo')) relCalcul();
    if (cascade) {
      if (lumiere()) [].forEach.call(root.querySelectorAll('[data-roule]'), function (n) { var v = +n.getAttribute('data-roule'); if (v > 0) rouler(n, v, 520); });
      setTimeout(function () { var r = document.getElementById('u2-cinq'); if (r) r.classList.remove('ac-ent'); }, 2400);
    }
    if (window.IntersectionObserver) {
      if (VU) VU.disconnect();
      VU = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('ac-hors', !e.isIntersecting); }); }, { rootMargin: '80px' });
      [].forEach.call(root.querySelectorAll('.ac-c, .ac4-haut, .acq-ban'), function (c) { VU.observe(c); });
    }
    // le bandeau du listing, dès que la base a dit oui ; si elle dit non (ou ne répond pas), la place reste vide
    if (document.getElementById('acq-att') && V2.listings2027 && V2.listings2027.verifier) V2.listings2027.verifier().then(function () {
      var a = document.getElementById('acq-att'), u = une(); if (!a || !u) return;
      a.outerHTML = m1Une(u);
    });
  }
  /* la tache de lumière du bandeau suit le pointeur : un seul écouteur, posé une fois */
  document.addEventListener('pointermove', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.ac4-haut'); if (!b) return;
    var r = b.getBoundingClientRect(); b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  // 30/10/2026 — une ligne cochée sur l'accueil reste là, rayée, jusqu'à la prochaine visite ; les compteurs se remettent à jour quand l'écriture est faite
  function coche(id, fait) { if (fait) _fait[id] = true; else delete _fait[id]; setTimeout(maj, 150); setTimeout(maj, 1200); }
  V2.accueilCinq = { html: html, autresBloc: autresBloc, coche: coche, maj: maj, apres: apres, CINQ: CINQ, cmp: { widget: cmpWidget, donnees: cmpDonnees } };
})();
