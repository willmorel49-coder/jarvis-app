/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Ressources concurrents » (pages.concurrents)
   UN écran hub qui rassemble tout ce qu'on sait des concurrents :
   Sagitta (3 catalogues complets), OCP Incontournables (tous paliers),
   OCP Marque Conseil, Pharmazon, et le lien vers le panorama des 93
   grossistes-répartiteurs. Chaque source s'ouvre en tableau filtrable,
   avec NOTRE net (V2.bestPrice) en face quand le code est chez nous.
   Décision Will 10/09/2026. CRM interne SEULEMENT — jamais côté OPSO.
   Données : concurrents-sagitta-data.js + concurrents-ocp-data.js
   (protégés, Supabase, generate_concurrents.py), pharmazon-data.js +
   pharmazon-prix.js (protégé). Vanilla · zéro lib · zéro emoji.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : String(n); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };

  // Conditions de TIERS : l'app OPSO ne charge pas ce module, et même chargé
  // par erreur il ne demanderait rien (même garde que Sagitta/OCP dans Offilog).
  var SANS = !!(window.V2_BRAND && window.V2_BRAND.opso);
  var MOD_BASE = (function () {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[?#].*$/, '').replace(/[^/]+$/, ''); } catch (e) {}
    return '';
  })();
  var LIMIT = 200;

  // État local : source ouverte, recherche, chip, tri, page
  var S = { src: '', q: '', chip: '', sort: '', desc: false };
  var tried = {};      // clé loadFiles → déjà demandé
  var pzLoading = false;

  // ── Les sources ─────────────────────────────────────────────────────
  // Une entrée par source : ce qu'elle charge, ses colonnes, ses chips.
  // `cols` : [clé, libellé, type] — type 'eur' | 'pct' | 'num' | '' (texte)
  var SRC = {
    sagitta: {
      nom: 'Sagitta', tag: 'Grossiste', accent: '#0E7C86', cles: ['concsagitta'],
      quoi: 'Les trois catalogues Sagitta fusionnés (général, grossiste, para-OTC) : libellé, laboratoire, gamme, tarif, remise et prix net.',
      charge: function () { return !!window.CONCURRENTS_SAGITTA; },
      maj: function () { return window.CONCURRENTS_SAGITTA && CONCURRENTS_SAGITTA.maj; },
      rows: function () { return window.CONCURRENTS_SAGITTA ? CONCURRENTS_SAGITTA.rows : []; },
      cols: function () { return window.CONCURRENTS_SAGITTA ? CONCURRENTS_SAGITTA.cols : []; },
      code: 'cip13', codeAlt: 'ean13', net: 'net',
      chipCol: 'cat', chipLabel: { general: 'Général seulement', grossiste: 'Grossiste', 'para-otc': 'Para-OTC' },
      affiche: [['cip13', 'CIP 13', ''], ['ean13', 'EAN', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['gamme', 'Gamme', ''],
        ['tarif', 'Tarif HT', 'eur'], ['remise', 'Remise', 'pct'], ['net', 'Net Sagitta', 'eur'], ['tva', 'TVA', 'pct'], ['qtemin', 'Qté min', 'num']],
      cherche: ['libelle', 'labo', 'gamme', 'cip13', 'ean13']
    },
    ocp: {
      nom: 'OCP · Les Incontournables', tag: 'Promo sept-déc 2026', accent: '#C7791A', cles: ['concocp'],
      quoi: 'Le catalogue promotionnel OCP en entier : chaque produit avec sa condition, TOUS ses paliers de prix net, sa remise et sa page du catalogue.',
      charge: function () { return !!window.CONCURRENTS_OCP; },
      maj: function () { return window.CONCURRENTS_OCP && CONCURRENTS_OCP.incontournables.maj; },
      rows: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.incontournables.rows : []; },
      cols: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.incontournables.cols : []; },
      code: 'code13', net: 'net',
      chipCol: 'section', chipLabel: { quadrimestrielle: 'Quadrimestrielle', 'annuelle sans engagement': 'Annuelle sans engagement', 'annuelle avec engagement': 'Annuelle avec engagement' },
      affiche: [['code13', 'Code 13', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['section', 'Offre', ''], ['condition', 'Condition', ''],
        ['ppht', 'PPHT', 'eur'], ['net', 'Meilleur net', 'eur'], ['remise', 'Remise', 'pct'], ['paliers', 'Paliers (net)', 'paliers'], ['page', 'Page', '']],
      cherche: ['libelle', 'labo', 'code13', 'condition']
    },
    mc: {
      nom: 'OCP · Marque Conseil', tag: 'Marque distributeur', accent: '#6D4FC4', cles: ['concocp'],
      quoi: 'La marque distributeur d\'OCP : prix public conseillé, tarif LPPR et coefficient de marge maximal par famille. Pas de prix d\'achat dans ce document.',
      charge: function () { return !!window.CONCURRENTS_OCP; },
      maj: function () { return window.CONCURRENTS_OCP && CONCURRENTS_OCP.marqueConseil.maj; },
      rows: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.marqueConseil.rows : []; },
      cols: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.marqueConseil.cols : []; },
      code: 'code13', net: '',
      chipCol: 'famille', chipLabel: {},
      affiche: [['code13', 'Code 13', ''], ['famille', 'Famille', ''], ['libelle', 'Produit', ''], ['descriptif', 'Descriptif', ''],
        ['pvc_ttc', 'PVC TTC', 'eur'], ['lppr', 'LPPR', ''], ['tarif_lppr_ttc', 'Tarif LPPR TTC', 'eur'], ['coef_marge_max', 'Coef. marge max', 'num'], ['folio', 'Page', '']],
      cherche: ['libelle', 'famille', 'descriptif', 'code13']
    },
    pharmazon: {
      nom: 'Pharmazon', tag: 'Plateforme labos', accent: '#345DA0', cles: ['pharmazonprix'],
      quoi: 'Le catalogue B2B Pharmazon (offres laboratoires) avec le prix négocié, le prix catalogue et la remise. Export du 14/05/2026, pas un relevé en direct.',
      charge: function () { return !!(window.PHARMAZON && window.PHARMAZON_PRIX); },
      maj: function () { return '2026-05-14'; },
      rows: function () {
        if (!window.PHARMAZON) return [];
        if (V2.fusionnerPrixPharmazon) { try { V2.fusionnerPrixPharmazon(); } catch (e) {} }
        return PHARMAZON.map(function (o) { return [String(o.ean || ''), o.name || '', o.labo || '', o.prix_catalogue, o.remise, o.prix_final]; });
      },
      cols: function () { return ['ean13', 'libelle', 'labo', 'tarif', 'remise', 'net']; },
      code: 'ean13', net: 'net',
      chipCol: '', chipLabel: {},
      affiche: [['ean13', 'EAN', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['tarif', 'Prix catalogue', 'eur'], ['remise', 'Remise', 'pct'], ['net', 'Net Pharmazon', 'eur']],
      cherche: ['libelle', 'labo', 'ean13']
    }
  };
  var ORDRE = ['sagitta', 'ocp', 'mc', 'pharmazon'];

  // ── Notre prix (V2.bestPrice = seule source de vérité) ───────────────
  // Index PROD_STATS par CIP13. Génériques et biosimilaires EXCLUS du verdict
  // (leurs remises passent en direct labo → pharmacie, invisibles dans notre
  // net ; en facture chez le grossiste — le face-à-face serait faux).
  var idxNous = null;
  function nous(code) {
    if (!idxNous) {
      idxNous = {};
      (window.PROD_STATS || []).forEach(function (r) { if (r && r.c) idxNous[String(r.c)] = r; });
    }
    var r = code ? idxNous[String(code)] : null;
    if (!r) return null;
    var bp = V2.bestPrice ? V2.bestPrice({ prix_ht: r.ppht, prix_ip: r.net }) : { ip: r.net > 0 ? r.net : null };
    return { ip: bp.ip, f: r.f, exclu: (r.f === 'gen' || r.f === 'biosim') };
  }
  function verdict(net, n) {
    if (!n || !(n.ip > 0) || n.exclu || !(net > 0)) return '';
    return n.ip < net ? 'win' : (net < n.ip ? 'lose' : 'egal');
  }

  // ── Chargement ───────────────────────────────────────────────────────
  function charger(src, cb) {
    if (SANS) return;
    var s = SRC[src];
    if (s.charge()) { cb(); return; }
    var k = s.cles.join('+');
    if (src === 'pharmazon' && !window.PHARMAZON && !pzLoading) {
      // Identité publique (pharmazon-data.js) + prix protégé (pharmazonprix),
      // même chemin que l'écran Offilog.
      pzLoading = true;
      var sc = document.createElement('script'); sc.src = MOD_BASE + 'pharmazon-data.js?v=20260903a';
      sc.onload = function () { pzLoading = false; cb(); };
      sc.onerror = function () { pzLoading = false; V2.protegeEchec.pharmazon = true; cb(); };
      document.head.appendChild(sc);
    }
    if (tried[k]) return;
    tried[k] = true;
    if (V2.loadFiles) { try { V2.loadFiles(s.cles).then(cb); } catch (e) { cb(); } }
  }
  function echec(src) {
    var ko = V2.donneesProtegeesKO ? V2.donneesProtegeesKO() : [];
    var cles = SRC[src].cles.concat(src === 'pharmazon' ? ['pharmazon'] : []);
    return cles.some(function (c) { return ko.indexOf(c) >= 0; });
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function dateFr(d) {
    if (!d) return '';
    var p = String(d).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(d);
  }
  function cap(s) { s = String(s || ''); return s.length > 60 ? s.slice(0, 58) + '…' : s; }
  function colIdx(s) { var m = {}; s.cols().forEach(function (c, i) { m[c] = i; }); return m; }
  function fmt(v, type) {
    if (v == null || v === '') return '<span class="cc-mute">—</span>';
    if (type === 'eur') return eur(v);
    if (type === 'pct') return (v > 0 ? String(Math.round(v * 10) / 10).replace('.', ',') + ' %' : '<span class="cc-mute">—</span>');
    if (type === 'num') return num(v);
    if (type === 'paliers') return String(v).split('|').map(function (x) { var n = parseFloat(x); return isNaN(n) ? esc(x) : eur(n); }).join(' · ');
    return esc(v);
  }
  function filtre(s) {
    var ci = colIdx(s), rows = s.rows();
    var q = S.q.trim().toLowerCase();
    var chipI = s.chipCol ? ci[s.chipCol] : -1;
    var out = rows.filter(function (r) {
      if (S.chip && chipI >= 0 && String(r[chipI] || '') !== S.chip) return false;
      if (!q) return true;
      for (var i = 0; i < s.cherche.length; i++) {
        var v = r[ci[s.cherche[i]]];
        if (v != null && String(v).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });
    if (S.sort && ci[S.sort] != null) {
      var si = ci[S.sort];
      out = out.slice().sort(function (a, b) {
        var x = a[si], y = b[si];
        if (x == null || x === '') return 1;
        if (y == null || y === '') return -1;
        var c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'fr');
        return S.desc ? -c : c;
      });
    }
    return out;
  }
  function chips(s) {
    if (!s.chipCol) return '';
    var ci = colIdx(s), i = ci[s.chipCol], cnt = {};
    s.rows().forEach(function (r) { var v = String(r[i] || ''); if (v) cnt[v] = (cnt[v] || 0) + 1; });
    var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 14);
    if (keys.length < 2) return '';
    var all = '<button type="button" class="v2-seg' + (!S.chip ? ' on' : '') + '" onclick="V2.ccChip(\'\')">Tout <span class="cnt">' + num(s.rows().length) + '</span></button>';
    return '<div class="v2-segs">' + all + keys.map(function (k) {
      var safe = k.replace(/[\\'"<>&]/g, '');
      return '<button type="button" class="v2-seg' + (S.chip === k ? ' on' : '') + '" style="--sc:' + s.accent + '" onclick="V2.ccChip(\'' + safe + '\')">' + esc(s.chipLabel[k] || k) + ' <span class="cnt">' + num(cnt[k]) + '</span></button>';
    }).join('') + '</div>';
  }

  // ── Rendu : hub ──────────────────────────────────────────────────────
  function tuile(k) {
    var s = SRC[k], ok = s.charge();
    var n = ok ? s.rows().length : null;
    var meta = ok ? num(n) + ' références · relevé ' + dateFr(s.maj()) : (echec(k) ? 'Données protégées non chargées' : 'Chargé à l\'ouverture');
    return '<button type="button" class="cc-tile" style="--accent:' + s.accent + '" onclick="V2.go(\'concurrents\',\'' + k + '\')">' +
      '<div class="cc-tile-h"><span class="cc-tile-tag">' + esc(s.tag) + '</span><span class="cc-tile-n mono">' + (ok ? num(n) : '') + '</span></div>' +
      '<div class="cc-tile-t">' + esc(s.nom) + '</div>' +
      '<div class="cc-tile-d">' + esc(s.quoi) + '</div>' +
      '<div class="cc-tile-m">' + esc(meta) + '</div>' +
      '<div class="cc-tile-go">Ouvrir le catalogue ' + ICO('chev', 14, 2.2) + '</div>' +
    '</button>';
  }
  function lien(route, tag, t, d, accent) {
    return '<button type="button" class="cc-tile cc-tile-lien" style="--accent:' + accent + '" onclick="V2.go(\'' + route + '\')">' +
      '<div class="cc-tile-h"><span class="cc-tile-tag">' + tag + '</span></div>' +
      '<div class="cc-tile-t">' + t + '</div><div class="cc-tile-d">' + d + '</div>' +
      '<div class="cc-tile-go">Ouvrir ' + ICO('chev', 14, 2.2) + '</div></button>';
  }
  function hubHtml() {
    return '<div class="v2-page-title">Ressources concurrents</div>' +
      '<div class="v2-page-sub">Tout ce qu\'on sait des grossistes et plateformes concurrents, au même endroit. Conditions de tiers : réservé à l\'interne Intégral, jamais dans un document remis à une officine.</div>' +
      '<div class="cc-grid">' +
        ORDRE.map(tuile).join('') +
        (V2.pages.grossistes ? lien('grossistes', 'Panorama', 'Les 93 grossistes-répartiteurs', 'Annuaire de la répartition française : OCP, CERP, Alliance, Sagitta et les short-liners — agences, CA, enseignes affiliées, actualité du secteur.', '#0E7C86') : '') +
        (V2.pages.offilog ? lien('offilog', 'Comparatif', 'Offilog face aux concurrents', 'Rayon par rayon, où Pharmazon, Sagitta ou OCP sont moins chers que notre centrale parapharmacie.', '#345DA0') : '') +
      '</div>';
  }

  // ── Rendu : tableau d'une source ─────────────────────────────────────
  function tableHtml(s) {
    var ci = colIdx(s), data = filtre(s), shown = data.slice(0, LIMIT);
    var codeI = ci[s.code], codeAltI = s.codeAlt ? ci[s.codeAlt] : -1, netI = s.net ? ci[s.net] : -1;
    var avecNous = netI >= 0 && (window.PROD_STATS || []).length > 0;
    var head = s.affiche.map(function (c) {
      var on = S.sort === c[0];
      return '<th class="' + (c[2] ? 'num' : '') + (on ? ' on' : '') + '" onclick="V2.ccSort(\'' + c[0] + '\')">' + esc(c[1]) + (on ? (S.desc ? ' ↓' : ' ↑') : '') + '</th>';
    }).join('') + (avecNous ? '<th class="num">Notre net</th><th>Verdict</th>' : '');
    var g = 0, l = 0, e = 0, cmp = 0;
    var body = shown.map(function (r) {
      var n = avecNous ? (nous(r[codeI]) || (codeAltI >= 0 ? nous(r[codeAltI]) : null)) : null;
      var v = n ? verdict(r[netI], n) : '';
      var tds = s.affiche.map(function (c) {
        var val = r[ci[c[0]]];
        var cls = (c[2] ? 'num mono' : '') + (c[0] === 'libelle' ? ' cc-name' : '') + (c[0] === s.code || c[0] === s.codeAlt ? ' mono cc-code' : '');
        return '<td class="' + cls + '" data-label="' + esc(c[1]) + '"' + (c[0] === 'libelle' || c[0] === 'descriptif' || c[0] === 'condition' ? ' title="' + esc(val) + '"' : '') + '>' + (c[0] === 'libelle' || c[0] === 'descriptif' || c[0] === 'condition' ? esc(cap(val)) : fmt(val, c[2])) + '</td>';
      }).join('');
      if (avecNous) {
        tds += '<td class="num mono" data-label="Notre net">' + (n && n.ip > 0 ? eur(n.ip) : '<span class="cc-mute">—</span>') + '</td>' +
          '<td data-label="Verdict">' + (v ? '<span class="cc-v ' + v + '">' + (v === 'win' ? 'Intégral moins cher' : v === 'lose' ? s.nom.split(' ·')[0] + ' moins cher' : 'Même prix') + '</span>' : (n && n.exclu ? '<span class="cc-mute" title="Générique ou biosimilaire : remises en direct labo, pas comparables">hors verdict</span>' : '')) + '</td>';
      }
      return '<tr' + (v ? ' class="cc-' + v + '"' : '') + '>' + tds + '</tr>';
    }).join('');
    // bilan sur TOUTE la sélection filtrée, pas seulement les lignes affichées
    if (avecNous) data.forEach(function (r) {
      var n = nous(r[codeI]) || (codeAltI >= 0 ? nous(r[codeAltI]) : null);
      var v = n ? verdict(r[netI], n) : '';
      if (v) { cmp++; if (v === 'win') g++; else if (v === 'lose') l++; else e++; }
    });
    if (!shown.length) body = '<tr><td colspan="' + (s.affiche.length + 2) + '" style="padding:26px;text-align:center;color:var(--muted)">Aucune référence ne correspond.</td></tr>';
    if (data.length > LIMIT) body += '<tr class="cc-more"><td colspan="' + (s.affiche.length + 2) + '">' + LIMIT + ' lignes affichées sur ' + num(data.length) + ' — affine la recherche pour voir les autres.</td></tr>';
    var bilan = avecNous && cmp ? '<div class="cc-bilan" style="--accent:' + s.accent + '"><b>' + num(cmp) + '</b> références aussi chez nous · <span class="win">' + num(g) + ' où Intégral est moins cher</span> · <span class="lose">' + num(l) + ' où ' + esc(s.nom.split(' ·')[0]) + ' est moins cher</span> · ' + num(e) + ' au même prix · hors génériques et biosimilaires</div>' : '';
    return bilan +
      '<div class="cc-count">' + num(data.length) + ' référence' + (data.length > 1 ? 's' : '') + '</div>' +
      '<div class="cc-tablewrap"><table class="v2-table cc-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function sourceHtml(k) {
    var s = SRC[k];
    var entete = '<div class="cc-head" style="--accent:' + s.accent + '">' +
      '<div><span class="cc-tile-tag">' + esc(s.tag) + '</span><div class="v2-page-title">' + esc(s.nom) + '</div>' +
      '<div class="v2-page-sub">' + esc(s.quoi) + (s.charge() ? ' Relevé du ' + dateFr(s.maj()) + '.' : '') + '</div></div></div>';
    if (!s.charge()) {
      if (echec(k)) {
        return entete + '<div class="v2-empty"><div class="v2-empty-ico">' + ICO('alert', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Données protégées non chargées</div>' +
          '<div class="v2-empty-d">Ce catalogue vit dans l\'espace protégé : il faut être connecté et en ligne. Réessaie dans un instant.</div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.ccRetry(\'' + k + '\')">' + ICO('back', 16, 2) + ' Réessayer</button></div>';
      }
      return entete + '<div class="cc-sk" aria-busy="true">' + '<div class="cc-sk-l" style="width:38%"></div><div class="cc-sk-l" style="width:92%"></div><div class="cc-sk-l" style="width:84%"></div><div class="cc-sk-l" style="width:88%"></div><div class="cc-sk-l" style="width:70%"></div>' + '</div>';
    }
    return entete +
      '<div class="cc-tools"><div class="cc-search">' + ICO('search', 15, 2) + '<input id="cc-q" type="search" placeholder="Produit, laboratoire, code…" value="' + esc(S.q) + '" oninput="V2.ccQ(this.value)" autocomplete="off"></div></div>' +
      chips(s) +
      '<div id="cc-body">' + tableHtml(s) + '</div>';
  }

  // ── Actions ──────────────────────────────────────────────────────────
  var qTimer = null;
  V2.ccQ = function (v) { S.q = v; clearTimeout(qTimer); qTimer = setTimeout(rerender, 160); };
  V2.ccChip = function (k) { S.chip = (S.chip === k) ? '' : k; V2.render(); };
  V2.ccSort = function (k) { if (S.sort === k) { if (S.desc) { S.sort = ''; S.desc = false; } else S.desc = true; } else { S.sort = k; S.desc = false; } rerender(); };
  V2.ccRetry = function (k) {
    SRC[k].cles.forEach(function (c) { delete V2.protegeEchec[c]; delete tried[c]; });
    delete tried[SRC[k].cles.join('+')]; delete V2.protegeEchec.pharmazon;
    V2.render();
  };
  function rerender() {
    var b = document.getElementById('cc-body');
    if (b && S.src && SRC[S.src]) b.innerHTML = tableHtml(SRC[S.src]); else V2.render();
  }

  // ── PAGE ─────────────────────────────────────────────────────────────
  V2.pages.concurrents = {
    render: function (root, param) {
      injectCss();
      var src = (param && SRC[param]) ? param : '';
      if (src !== S.src) { S.src = src; S.q = ''; S.chip = ''; S.sort = ''; S.desc = false; }
      var back = src ? { back: true } : { back: true, backTo: 'home', backLabel: 'Accueil' };
      root.innerHTML = V2.topbar(back) + '<div class="v2-wrap cc-wrap">' + (src ? sourceHtml(src) : hubHtml()) + '</div>';
      if (SANS) return;
      // Données absentes → on les demande, et on re-rend à l'arrivée. JAMAIS
      // quand elles sont déjà là : le rappel relancerait le rendu, qui
      // relancerait le rappel… (récursion infinie constatée au 1er test WebKit).
      // Sur le hub, rien n'est téléchargé d'office (2 Mo pour Sagitta).
      if (src && !SRC[src].charge()) {
        charger(src, function () { if (V2.route && V2.route.name === 'concurrents') V2.render(); });
      }
      var q = document.getElementById('cc-q');
      if (q && S.q) { try { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} }
    }
  };

  function injectCss() {
    if (document.getElementById('v2-concurrents-css')) return;
    var s = document.createElement('style'); s.id = 'v2-concurrents-css';
    s.textContent = [
      '.cc-wrap{max-width:1180px}',
      '.cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:8px}',
      '.cc-tile{position:relative;text-align:left;border:1px solid var(--line);border-radius:16px;background:var(--card);padding:18px 18px 16px;cursor:pointer;font:inherit;color:var(--ip-ink);display:flex;flex-direction:column;gap:8px;overflow:hidden;transition:border-color .15s,transform .12s,box-shadow .15s;box-shadow:var(--sh-1)}',
      '.cc-tile:before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 35%,#fff))}',
      '.cc-tile:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));transform:translateY(-2px);box-shadow:0 10px 26px rgba(16,19,28,.09)}',
      '.cc-tile-h{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.cc-tile-tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);padding:3px 8px;border-radius:999px}',
      '.cc-tile-n{font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--accent)}',
      '.cc-tile-t{font-size:17px;font-weight:800;letter-spacing:-.015em}',
      '.cc-tile-d{font-size:13px;color:var(--muted);line-height:1.45;flex:1}',
      '.cc-tile-m{font-size:12px;color:var(--muted-2);font-family:var(--mono)}',
      '.cc-tile-go{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;color:var(--accent);margin-top:2px}',
      '.cc-tile-lien{background:color-mix(in srgb,var(--accent) 4%,var(--card))}',
      '.cc-head{margin-bottom:14px}.cc-head .v2-page-title{margin-top:8px}.cc-head .v2-page-sub{margin-bottom:0}',
      '.cc-tools{display:flex;gap:10px;align-items:center;margin:16px 0 12px;flex-wrap:wrap}',
      '.cc-search{flex:1;min-width:240px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:var(--r-btn);background:var(--card);padding:9px 13px;color:var(--muted)}',
      '.cc-search input{flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:16px;color:var(--ip-ink)}',
      '.cc-bilan{border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 6%,var(--card));border-radius:10px;padding:10px 14px;font-size:13px;color:var(--ip-ink-2);margin-bottom:10px;line-height:1.5}',
      '.cc-bilan b{font-size:15px}.cc-bilan .win{color:var(--c-mint,#10915E);font-weight:700}.cc-bilan .lose{color:var(--c-rose,#C8385A);font-weight:700}',
      '.cc-count{font-size:12px;color:var(--muted-2);margin:0 0 6px 4px;font-family:var(--mono)}',
      '.cc-tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}',
      '.cc-table th{white-space:nowrap;cursor:pointer;user-select:none;padding:12px 12px}.cc-table th.on{color:var(--ip-blue)}',
      '.cc-table td{padding:9px 12px;border-top:1px solid var(--line);font-size:13px;vertical-align:top}',
      '.cc-table td.num{text-align:right;white-space:nowrap}',
      '.cc-name{min-width:220px;max-width:340px;font-weight:600}',
      '.cc-code{font-size:12px;color:var(--muted)}',
      '.cc-mute{color:var(--muted-2)}',
      '.cc-v{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}',
      '.cc-v.win{color:#0B6B45;background:rgba(16,145,94,.12)}.cc-v.lose{color:#9E2A46;background:rgba(200,56,90,.12)}.cc-v.egal{color:var(--ip-ink-2);background:var(--line)}',
      '.cc-more td{padding:14px;text-align:center;color:var(--muted-2);font-size:12.5px}',
      '.cc-sk{display:flex;flex-direction:column;gap:12px;margin-top:20px}',
      '.cc-sk-l{height:16px;border-radius:8px;background:linear-gradient(90deg,var(--line),color-mix(in srgb,var(--line) 40%,#fff),var(--line));background-size:200% 100%;animation:cc-sh 1.2s linear infinite}',
      '@keyframes cc-sh{to{background-position:-200% 0}}',
      '@media (max-width:700px){.cc-table thead{display:none}.cc-table tr{display:block;border-top:1px solid var(--line);padding:8px 4px}.cc-table td{display:flex;justify-content:space-between;gap:12px;border:0;padding:4px 8px;text-align:left}.cc-table td.num{text-align:right}.cc-table td:before{content:attr(data-label);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;flex:0 0 42%}.cc-name{max-width:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
