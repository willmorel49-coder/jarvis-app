/* ═══════════════════════════════════════════════════════════════════════════════
   JARVIS · accueil u2 — la colonne de droite de widgets et l'ATELIER plein écran (04/10/2026, maquette z4 « L'atelier »)
   Demande du 04/10 : une vraie personnalisation poussée. Cinq leviers : bibliothèque par rayons (avec recherche), emplacement (l'ordre),
   taille (Compact / Normal / Détaillé : le contenu change vraiment), contenu (réglages propres au widget), et TOUT GARDÉ PAR COMMERCIAL.
   Où c'est gardé : le champ `wid` de la ligne `profils` de la personne (celle des réglages d'accueil, via le pont : S.wid + garder()). Navigateur
   d'abord, base après 800 ms de calme. Champ absent ou illisible = retour aux réglages d'origine ; les anciennes cases cochées (widgets / wordre)
   sont CONVERTIES (un widget coché = un widget posé, dans le même ordre, taille Normal).
   Règle de base : AUCUNE donnée d'exemple. Chaque widget lit la donnée réelle déjà chargée par l'app ; un widget sans source n'est pas dans la bibliothèque.
   Régler un widget ne redessine que la colonne de droite : les scènes animées du centre ne repartent pas.
   Ce fichier ne connaît pas les internes de v2-app.js : il lit le pont V2.accueilPont.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fr(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function P() { return V2.accueilPont; }
  var MAX = 12;   // un accueil ne porte pas plus de douze widgets

  /* ── Les icônes propres à l'atelier (même famille que celles de l'accueil : trait 1,75, 24 × 24) ── */
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    reset: '<path d="M4 12a8 8 0 108-8H8"/><path d="M8 1.5L4.5 4.5 8 7.5"/>',
    regler: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    croix: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function ic(n, size) {
    if (IC[n]) return '<svg class="u2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '>' + IC[n] + '</svg>';
    var p = P(); return p ? p.ic(n, size) : '';
  }
  var CK2 = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
  var CKB = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';

  /* ═══ La bibliothèque : neuf widgets, chacun avec une VRAIE source (voir RAPPORT-A.md) ═══
     fam = rayon ; o = écran ouvert par le titre (page, ou page/param) ; t = tailles permises ; r = réglages de contenu ; ic = picto */
  var FAMS = [['clients', 'Mes clients'], ['journee', 'Ma journée'], ['veille', 'Veille du marché']];
  var LIB = {
    relance: { nom: 'À relancer', ds: 'Les officines à rappeler, avec leur date', ic: 'clients', fam: 'clients', o: 'rdv', t: 'SML',
      r: [{ k: 'horizon', nom: 'Afficher', ch: [['retard', 'Seulement les retards'], ['jour', 'Retards et aujourd\'hui'], ['deux', 'Jusqu\'à dans 2 jours']], d: 'deux' }] },
    groupement: { nom: 'Un groupement à la loupe', ds: 'Ses adhérents actifs, en pourcentage', ic: 'carteGrp', fam: 'clients', o: 'pharma/groupements', t: 'SM',
      r: [{ k: 'g', nom: 'Groupement suivi', dyn: 'groupes', d: '' }] },
    infos: { nom: 'Infos du matin', ds: 'Le brief du jour : nouvelles, ruptures, rappels', ic: 'infos', fam: 'journee', o: 'infos', t: 'SML', r: [] },
    todo: { nom: 'To do list', ds: 'Vos lignes à faire, les plus urgentes d\'abord', ic: 'todo', fam: 'journee', o: 'todo', t: 'SML', r: [] },
    semaine: { nom: 'Ma semaine', ds: 'Les sept jours, aujourd\'hui en avant', ic: 'rdv', fam: 'journee', o: 'rdv', t: 'ML', r: [] },
    tournee: { nom: 'Ma tournée', ds: 'Les arrêts préparés dans La carte, dans l\'ordre', ic: 'carte', fam: 'journee', o: 'carte', t: 'SML', r: [] },
    notes: { nom: 'Bloc-notes', ds: 'Vos notes, gardées pour vous', ic: 'doc', fam: 'journee', o: null, t: 'ML', r: [] },
    raccourcis: { nom: 'Mes raccourcis', ds: 'Vos outils choisis, à un clic', ic: 'grille', fam: 'journee', o: null, t: 'SM',
      r: [{ k: 'outils', nom: 'Outils affichés', multi: 'outils', d: ['rdv', 'carte', 'produits', 'pilotage'] }] },
    ruptures: { nom: 'Ruptures à surveiller', ds: 'Les ruptures et tensions du moment', ic: 'appro', fam: 'veille', o: 'infos', t: 'SML', r: [] }
  };
  var CLES = ['relance', 'groupement', 'infos', 'todo', 'semaine', 'tournee', 'notes', 'raccourcis', 'ruptures'];
  var TAILLES = { S: 'Compact', M: 'Normal', L: 'Détaillé' };
  // Les trois modèles prêts : un clic pose cinq widgets (annulable)
  var MODELES = [
    { k: 'terrain', nom: 'Terrain', ds: 'Vos relances, votre tournée, votre semaine', l: [['tournee', 'M'], ['relance', 'M'], ['semaine', 'M'], ['raccourcis', 'S'], ['ruptures', 'S']] },
    { k: 'bureau', nom: 'Bureau', ds: 'Les groupements, les ruptures, vos notes', l: [['groupement', 'M'], ['ruptures', 'M'], ['notes', 'M'], ['raccourcis', 'M'], ['semaine', 'M']] },
    { k: 'decouverte', nom: 'Découverte', ds: 'Un peu de tout, pour essayer', l: [['relance', 'M'], ['semaine', 'M'], ['groupement', 'S'], ['ruptures', 'S'], ['tournee', 'S']] }
  ];

  /* ── Les choix proposés par un réglage ([valeur, libellé]) ── */
  function outilsChoix() {
    var p = P(), cinq = (V2.accueilCinq && V2.accueilCinq.CINQ) || [];
    return (p.vis() || []).filter(function (k) { return cinq.indexOf(k) < 0; }).map(function (k) { return [k, p.outil(k).nom]; });
  }
  function groupesChoix(cur) {
    var l = (V2.accueilGroupes ? V2.accueilGroupes() : []).slice(0, 8).map(function (g) { return [g.nom, g.nom]; });
    if (cur && !l.some(function (c) { return c[0] === cur; })) l.push([cur, cur]);
    return l;
  }
  function choix(r, w) { return r.multi === 'outils' ? outilsChoix() : r.dyn === 'groupes' ? groupesChoix(w && w.o[r.k]) : (r.multi || r.ch); }
  function defautR(r) {
    if (r.multi === 'outils') { var vis = P() ? P().vis() : []; return r.d.filter(function (k) { return vis.indexOf(k) >= 0; }); }
    if (r.dyn === 'groupes') { var g = V2.accueilGroupes ? V2.accueilGroupes()[0] : null; return g ? g.nom : ''; }
    return r.multi ? r.d.slice() : r.d;
  }
  function defauts(k) { var o = {}; LIB[k].r.forEach(function (r) { o[r.k] = defautR(r); }); return o; }

  /* ═══ État : le champ `wid` des réglages de la personne ═══ */
  // Nettoyage à la lecture (appelé par u2Net) : clé inconnue écartée, taille ou réglage illisible → valeur d'origine.
  function propre(x) {
    var L = x && LIB[x.k]; if (!L) return null;
    var o = {}, src = (x.o && typeof x.o === 'object') ? x.o : {};
    L.r.forEach(function (r) {
      var v = src[r.k];
      if (r.multi) o[r.k] = Array.isArray(v) ? v.filter(function (e) { return typeof e === 'string' && e.length < 40; }).slice(0, 6) : r.multi === 'outils' ? r.d.slice() : r.d.slice();
      else if (r.dyn) o[r.k] = typeof v === 'string' ? v.slice(0, 80) : '';
      else o[r.k] = r.ch.some(function (c) { return c[0] === v; }) ? v : r.d;
    });
    return { id: typeof x.id === 'string' && /^w\d{1,4}$/.test(x.id) ? x.id : '', k: x.k, t: L.t.indexOf(x.t) >= 0 ? x.t : (L.t.indexOf('M') >= 0 ? 'M' : L.t.charAt(0)), o: o };
  }
  // Les anciennes cases cochées : { widgets: { infos, todo, relance, semaine }, wordre: [...] } → une liste de widgets posés
  function ancien(raw) {
    var B = ['infos', 'todo', 'relance', 'semaine'];
    var ordre = (raw && Array.isArray(raw.wordre) && raw.wordre.length === B.length && raw.wordre.every(function (k, i, a) { return B.indexOf(k) >= 0 && a.indexOf(k) === i; })) ? raw.wordre : B;
    var on = (raw && raw.widgets && typeof raw.widgets === 'object') ? raw.widgets : {};
    /* Infos du matin et To do list sont au centre : ils ne se répètent pas dans la colonne (ils restent dans la bibliothèque) */
    return ordre.filter(function (k) { return on[k] !== false && k !== 'infos' && k !== 'todo'; }).map(function (k) { return { k: k, t: 'M', o: {} }; });
  }
  function net(raw) {
    var w = raw && raw.wid && typeof raw.wid === 'object' && Array.isArray(raw.wid.items) ? raw.wid : null;
    var src = w ? w.items : ancien(raw), out = [], vus = {};
    src.forEach(function (x) { var p = propre(x); if (p && out.length < MAX) out.push(p); });
    out.forEach(function (p) { if (p.id && !vus[p.id]) vus[p.id] = 1; else p.id = ''; });
    var n = 0; out.forEach(function (p) { var m = /^w(\d+)$/.exec(p.id); if (m) n = Math.max(n, +m[1]); });
    out.forEach(function (p) { if (!p.id) { n++; p.id = 'w' + n; } });
    return { v: 2, items: out, notes: (w && typeof w.notes === 'string') ? w.notes.slice(0, 600) : '' };
  }
  function defaut() { return net(null); }
  function W() { var S = P().S(); if (!S.wid) S.wid = defaut(); return S.wid; }
  function nid() { var n = 0; W().items.forEach(function (w) { var m = /^w(\d+)$/.exec(w.id); if (m) n = Math.max(n, +m[1]); }); return 'w' + (n + 1); }
  function get(id) { return W().items.filter(function (w) { return w.id === id; })[0]; }
  function garde() { P().garder(); majDroite(true); }
  function ajouter(k, t, o) {
    if (W().items.length >= MAX) return null;
    var w = propre({ k: k, t: t, o: o }); if (!w) return null;
    w.id = nid(); W().items.push(w); return w;
  }
  function bouger(id, d) {
    var l = W().items, w = get(id), i = l.indexOf(w), j = i + d;
    if (!w || j < 0 || j >= l.length) return;
    l[i] = l[j]; l[j] = w;
  }

  /* ═══ Le corps d'un widget : sa taille et ses réglages changent VRAIMENT ce qu'il montre ═══
     `stat` = aperçu de l'atelier (rien de cliquable). Chaque fonction ne lit que de la donnée réelle déjà chargée. */
  function lignes(l, n) { return '<div class="aw-l">' + l.slice(0, n).map(function (r) { return '<div class="aw-r"><i></i><span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<span>' + esc(r[1]) + '</span>' : '') + '</span></div>'; }).join('') + '</div>'; }
  function chiffre(v, lib) { return '<div class="aw-n"><b>' + esc(v) + '</b><span>' + esc(lib) + '</span></div>'; }
  function jauge(p) { return '<div class="aw-j" role="img" aria-label="' + p + ' pour cent"><i style="width:' + p + '%"></i></div>'; }
  function vide(t) { return '<p class="aw-v">' + esc(t) + '</p>'; }
  function lienAct(act, href, cls, inner, stat, extra) {
    return stat ? '<div class="' + cls + '">' + inner + '</div>' : '<a class="' + cls + '" href="' + esc(href) + '" data-u2-act="' + esc(act) + '"' + (extra || '') + '>' + inner + '</a>';
  }
  function nbLignes(t, s, m, l) { return t === 'S' ? s : t === 'M' ? m : l; }

  var CORPS = {
    infos: function (w, stat) {
      var p = P(), i = p.infos();
      if (i.etat === 'charge') return vide('Chargement du brief du jour…');
      if (i.etat !== 'ok') return vide('Le brief du jour n\'est pas encore arrivé.');
      var cases = [];
      if (i.nb != null) cases.push('<div><b>' + fr(i.nb) + '</b><span>' + (i.nb > 1 ? 'nouvelles' : 'nouvelle') + '</span>' + (i.quand === 'auj' ? '' : '<small>' + esc(i.puce) + '</small>') + '</div>');
      if (i.rupt != null) cases.push('<div><b>' + fr(i.rupt) + '</b><span>' + (i.rupt > 1 ? 'ruptures en cours' : 'rupture en cours') + '</span></div>');
      if (i.rapp != null) cases.push('<div><b>' + fr(i.rapp) + '</b><span>' + (i.rapp > 1 ? 'rappels de produits' : 'rappel de produit') + '</span></div>');
      var h = cases.length ? '<div class="u2-cpt" style="--n:' + cases.length + '">' + cases.join('') + '</div>' : '';
      if (w.t !== 'S') h += '<p class="aw-p aw-tit">' + esc(i.titre) + '</p>';
      if (w.t === 'L') {
        var d = p.infosData(), it = (d && Array.isArray(d.items)) ? d.items.slice(0, 4) : [];
        var l = it.filter(function (x) { return x && x.titre; }).slice(1, 4).map(function (x) { return [String(x.titre), String(x.source || '')]; });
        if (l.length) h += lignes(l, 3);
      }
      return h || vide('Le brief du jour n\'est pas encore arrivé.');
    },
    todo: function (w, stat) {
      var l = P().todoItems();
      if (l == null) return vide('Chargement de votre liste…');
      if (!l.length) return vide('Rien à faire pour l\'instant.');
      if (w.t === 'S') return chiffre(fr(l.length), l.length > 1 ? 'lignes à faire' : 'ligne à faire');
      var n = nbLignes(w.t, 0, 3, 6);
      var h = l.slice(0, n).map(function (it) {
        var bx = '<span class="u2-bx">' + CKB + '</span><span class="u2-t">' + esc(it.lib) + '</span>';
        return stat ? '<div class="u2-chk aw-st">' + bx + '</div>' : '<button type="button" class="u2-chk" role="checkbox" aria-checked="false" data-u2-a="todo" data-v="' + esc(it.id) + '">' + bx + '</button>';
      }).join('');
      if (l.length > n) h += stat ? '<p class="aw-p">+ ' + (l.length - n) + (l.length - n > 1 ? ' autres à faire' : ' autre à faire') + '</p>' : '<a class="u2-lien" href="#todo" data-u2-act="go:todo">+ ' + (l.length - n) + (l.length - n > 1 ? ' autres à faire' : ' autre à faire') + ic('arrow') + '</a>';
      return h;
    },
    relance: function (w, stat) {
      var p = P(), r = p.relances();
      if (!r.pret) return vide('Chargement des relances…');
      var lim = { retard: -1, jour: 0, deux: 2 }[w.o.horizon];
      if (lim == null) lim = 2;
      var tous = p.relancesAll().filter(function (x) { return x.diff <= lim; });
      if (!tous.length) return vide(lim < 0 ? 'Aucune relance en retard.' : 'Aucune relance à faire.');
      if (w.t === 'S') return chiffre(fr(tous.length), tous.length > 1 ? 'officines à relancer' : 'officine à relancer');
      var n = nbLignes(w.t, 0, 3, 6);
      var h = tous.slice(0, n).map(function (x) {
        var q = p.quand(x.diff), pid = encodeURIComponent(String(x.pid));
        var inner = '<span class="u2-pt2' + (x.diff < 0 ? ' u2-tard' : x.diff === 0 ? ' u2-jour' : '') + '"></span><span class="u2-tx"><b>' + esc(x.name) + '</b><span class="' + (x.diff < 0 ? 'u2-tard-t' : '') + '">' + esc(q.t) + '</span></span>';
        return lienAct('rel:' + pid, '#pharma/' + pid, 'u2-rel', inner, stat);
      }).join('');
      if (tous.length > n) h += '<p class="u2-reste">+ ' + (tous.length - n) + (tous.length - n > 1 ? ' autres relances' : ' autre relance') + '</p>';
      return h;
    },
    semaine: function (w, stat) {
      var p = P(); p.relances();   // lance la lecture des relances si besoin (un point sous chaque jour qui en porte)
      var sem = p.semaine(), all = p.relancesAll(), pj = p.parJour(all, sem.dow);
      var h = '<div class="u2-sem-m">' + esc(sem.mois + ' ' + new Date().getFullYear()) + '</div><div class="u2-sem" role="list">';
      sem.jours.forEach(function (j, k) {
        var n = pj[k] ? pj[k].length : 0, auj = k === sem.dow;
        var lib = j.lib.charAt(0).toUpperCase() + j.lib.slice(1) + (n ? ' : ' + n + (n > 1 ? ' relances' : ' relance') : '');
        h += '<div role="listitem" class="' + (auj ? 'u2-auj' : '') + '" aria-label="' + esc(lib) + '"' + (auj ? ' aria-current="date"' : '') + '>' + j.n + '<b>' + j.j + '</b><i class="u2-pt' + (n ? ' u2-on' : '') + '"></i></div>';
      });
      h += '</div>';
      if (w.t === 'L') {
        var sem7 = all.filter(function (x) { return x.diff >= 0 && sem.dow + x.diff <= 6; });
        h += sem7.length ? lignes(sem7.slice(0, 4).map(function (x) { return [x.name, 'Relance : ' + p.quand(x.diff).t.toLowerCase()]; }), 4) : vide('Aucune relance prévue cette semaine.');
      }
      return h;
    },
    groupement: function (w, stat) {
      var gs = V2.accueilGroupes ? V2.accueilGroupes() : [];
      if (!gs.length) return vide('Aucun groupement à suivre pour le moment.');
      var g = gs.filter(function (x) { return x.nom === w.o.g; })[0] || gs[0];
      var m = P().m() || {}, ca = (!m.partiel && V2.caByPharma) ? V2.caByPharma() : null;
      var tot = g.ids.length, h = '<div class="aw-g"><b>' + esc(g.nom) + '</b></div>';
      if (!ca) return h + chiffre(fr(tot), tot > 1 ? 'officines adhérentes' : 'officine adhérente') + (w.t === 'S' ? '' : vide('Les ventes se chargent : le détail arrive.'));
      var act = g.ids.filter(function (id) { return (ca[id] || 0) > 0; }).length, pc = tot ? Math.round(act * 100 / tot) : 0;
      return h + chiffre(pc + ' %', 'des adhérents sont actifs') + jauge(pc) + (w.t === 'S' ? '' : '<p class="aw-p">' + fr(act) + (act > 1 ? ' adhérents actifs' : ' adhérent actif') + ' sur ' + fr(tot) + '.</p>');
    },
    tournee: function (w, stat) {
      var t = []; try { t = JSON.parse(localStorage.getItem('jarvis_tour_v1') || '[]'); if (!Array.isArray(t)) t = []; } catch (e) { t = []; }
      t = t.filter(function (s) { return s && s.n; });
      if (!t.length) return vide('Aucune tournée en préparation. Composez-la depuis La carte.');
      if (w.t === 'S') return chiffre(fr(t.length), t.length > 1 ? 'arrêts dans ma tournée' : 'arrêt dans ma tournée');
      var n = nbLignes(w.t, 0, 3, 5);
      var h = '<ol class="aw-t">' + t.slice(0, n).map(function (s, i) { return '<li><b>' + esc(s.rdv ? String(s.rdv) : (i + 1)) + '</b><span>' + esc(s.n) + (s.v ? ' · ' + esc(s.v) : '') + '</span></li>'; }).join('') + '</ol>';
      if (t.length > n) h += '<p class="aw-p">+ ' + (t.length - n) + (t.length - n > 1 ? ' autres arrêts' : ' autre arrêt') + '</p>';
      return h;
    },
    notes: function (w, stat) {
      var rows = w.t === 'L' ? 6 : 3, txt = W().notes || '';
      if (stat) return '<div class="aw-no aw-no-st" style="min-height:' + (rows * 24 + 24) + 'px">' + (txt ? esc(txt) : '<span class="aw-ph">Écrivez ici</span>') + '</div>';
      return '<label class="aw-no"><span class="u2-sr">Vos notes</span><textarea data-aw-notes rows="' + rows + '" maxlength="600" placeholder="Écrivez ici">' + esc(txt) + '</textarea></label>';
    },
    raccourcis: function (w, stat) {
      var p = P(), vis = p.vis(), cinq = (V2.accueilCinq && V2.accueilCinq.CINQ) || [];
      var l = (w.o.outils || []).filter(function (k) { return vis.indexOf(k) >= 0 && cinq.indexOf(k) < 0; }).slice(0, w.t === 'S' ? 2 : 6);
      if (!l.length) return vide('Choisissez vos outils dans les réglages du widget.');
      return '<div class="aw-rc">' + l.map(function (k) {
        var t = p.outil(k), inner = p.ic(k) + '<span>' + esc(t.nom) + '</span>';
        return stat ? '<div class="aw-rca">' + inner + '</div>' : '<a class="aw-rca"' + p.lien(t, k) + '>' + inner + '</a>';
      }).join('') + '</div>';
    },
    ruptures: function (w, stat) {
      var p = P(), d = p.infosData();
      if (!d) { var i = p.infos(); return vide(i.etat === 'charge' ? 'Chargement du brief du jour…' : 'Le brief du jour n\'est pas encore arrivé.'); }
      var tot = typeof d.ruptures_total === 'number' ? d.ruptures_total : null;
      var l = (Array.isArray(d.ruptures_live) ? d.ruptures_live : []).filter(function (x) { return x && x.titre; }).map(function (x) { return [String(x.titre).split(' – [')[0], String(x.statut || '')]; });
      if (tot == null && !l.length) return vide('Aucune rupture dans le brief du jour.');
      var h = tot != null ? chiffre(fr(tot), tot > 1 ? 'ruptures en cours' : 'rupture en cours') : '';
      if (w.t !== 'S' && l.length) h += lignes(l, w.t === 'L' ? 4 : 2);
      return h;
    }
  };
  function corps(w, stat) { try { return CORPS[w.k](w, stat); } catch (e) { return vide('Ce widget ne peut pas s\'afficher pour l\'instant.'); } }
  // Le texte du bloc-notes se tape : son corps ne se remplace JAMAIS tant que le widget ne change pas (le texte ne contribue pas à la signature)
  function sigCorps(w, h) { return w.k === 'notes' ? 'notes|' + w.t : h; }

  /* ═══ Sur l'accueil : la colonne de droite ═══ */
  function lienPage(o) { var p = P(); if (!o) return null; var pg = o.split('/')[0]; return p.page(pg) ? { act: 'go:' + o, href: '#' + o } : null; }
  function cadre(w, i, atelier) {
    var L = LIB[w.k], lk = lienPage(L.o), h = corps(w, atelier);
    var tt = (lk && !atelier) ? '<a class="aw-tl" href="' + esc(lk.href) + '" data-u2-act="' + esc(lk.act) + '"><span>' + esc(L.nom) + '</span>' + ic('arrow') + '</a>' : '<span class="aw-tl"><span>' + esc(L.nom) + '</span>' + (lk ? ic('arrow') : '') + '</span>';
    if (!atelier) _sigW[w.id] = sigCorps(w, h);
    return '<section class="u2-wid aw-w aw-' + w.t + (atelier ? '' : ' u2-in') + '"' + (atelier ? '' : ' style="--i:' + (i + 3) + '"') + ' data-aw-w="' + esc(w.id) + '" aria-label="' + esc(L.nom) + '">' +
      '<div class="u2-wid-h"><h2>' + tt + '</h2>' + (atelier ? '' : '<button type="button" class="aw-ib aw-rg" data-aw="regler" data-v="' + esc(w.id) + '" aria-label="Régler ' + esc(L.nom) + '" title="Régler">' + ic('regler') + '</button>') + '</div>' +
      '<div class="aw-c">' + h + '</div></section>';
  }
  var _sigW = {}, _struct = '';
  function structure() { return JSON.stringify(W().items.map(function (w) { return [w.id, w.k, w.t, w.o]; })); }
  function droiteHtml() {
    var l = W().items; _sigW = {}; _struct = structure();
    return l.map(function (w, i) { return cadre(w, i, false); }).join('') +
      '<button type="button" class="aw-plus" data-aw="atelier" aria-label="Ajouter un widget ou régler mes widgets">' + ic('plus') + '<span><b>' + (l.length ? 'Ajouter ou régler' : 'Ajouter un widget') + '</b><small>Ouvrir l\'atelier</small></span></button>';
  }
  // Met la colonne à jour EN PLACE : si la liste, les tailles ou les réglages ont changé, la colonne se redessine (elle seule) ;
  // sinon seul le corps dont la donnée a changé est remplacé. Le centre (les scènes animées) n'est jamais touché.
  function majDroite(force) {
    var dr = document.getElementById('u2-droite'); if (!dr || !P()) return;
    var focus = document.activeElement, memo = focus && dr.contains(focus) ? focus.getAttribute('data-aw') && [focus.getAttribute('data-aw'), focus.getAttribute('data-v')] : null;
    if (structure() !== _struct) {
      dr.innerHTML = droiteHtml();
      if (memo && memo[1]) { var n = dr.querySelector('[data-aw="' + memo[0] + '"][data-v="' + memo[1] + '"]'); if (n) { try { n.focus(); } catch (e) {} } }
      return;
    }
    W().items.forEach(function (w) {
      var el = dr.querySelector('[data-aw-w="' + w.id + '"] .aw-c'); if (!el) return;
      var h = corps(w, false), s = sigCorps(w, h);
      if (_sigW[w.id] === s) return;
      _sigW[w.id] = s; el.innerHTML = h;
    });
  }

  /* ═══ L'atelier : plein écran, trois parties (1 bibliothèque, 2 le widget choisi en vrai, 3 mon accueil) ═══ */
  var AT = null, UI = { ouvert: false, sel: null, q: '', et: 1, avant: null, opener: null, last: null };
  function brouillon(k) { var t = LIB[k].t; return { id: 'brouillon', k: k, t: t.indexOf('M') >= 0 ? 'M' : t.charAt(0), o: defauts(k) }; }
  function cible() { var s = UI.sel; if (!s) return null; return s.t === 'w' ? get(s.id) : s.d; }
  function sel0() { var w = W().items[0]; UI.sel = w ? { t: 'w', id: w.id } : { t: 'l', k: 'relance', d: brouillon('relance') }; }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function bibliotheque() {
    var q = norm(UI.q).trim(), cur = cible(), h = '', n = 0;
    FAMS.forEach(function (f) {
      var l = CLES.filter(function (k) { var L = LIB[k]; return L.fam === f[0] && (!q || norm(L.nom + ' ' + L.ds + ' ' + f[1]).indexOf(q) >= 0); });
      if (!l.length) return; n += l.length;
      h += '<div class="aw-ry"><h4>' + esc(f[1]) + '</h4>' + l.map(function (k) {
        var L = LIB[k], on = cur && cur.k === k, nb = W().items.filter(function (w) { return w.k === k; }).length;
        return '<button type="button" class="aw-lr' + (on ? ' on' : '') + '" data-aw="lib" data-v="' + k + '" aria-pressed="' + !!(UI.sel && UI.sel.t === 'l' && on) + '"' + (on ? ' aria-current="true"' : '') + '>' +
          '<span class="aw-lg1">' + ic(L.ic) + '</span><span class="aw-ln"><b>' + esc(L.nom) + '</b><small>' + esc(L.ds) + '</small></span>' +
          (nb ? '<span class="aw-sur">' + CK2 + '<span>' + (nb > 1 ? 'Posé ×' + nb : 'Sur mon accueil') + '</span></span>' : '') + '</button>';
      }).join('') + '</div>';
    });
    return n ? h : '<p class="aw-v">Aucun widget ne correspond à « ' + esc(UI.q) + ' ». Essayez « relance » ou « semaine ».</p>';
  }
  function reglagesW(w) {
    var L = LIB[w.k], h = '<div class="aw-rb"><h4>Taille</h4><div class="aw-seg" role="radiogroup" aria-label="Taille">' + 'SML'.split('').filter(function (t) { return L.t.indexOf(t) >= 0; }).map(function (t) {
      return '<button type="button" class="aw-sg" role="radio" aria-checked="' + (w.t === t) + '" data-aw="taille" data-v="' + t + '">' + TAILLES[t] + '</button>';
    }).join('') + '</div></div>';
    L.r.forEach(function (r) {
      var ch = choix(r, w);
      h += '<div class="aw-rb"><h4>' + esc(r.nom) + '</h4>';
      if (!ch.length) h += '<p class="aw-v">Rien à choisir pour le moment.</p>';
      else if (r.multi) h += '<div class="aw-ch" role="group" aria-label="' + esc(r.nom) + '">' + ch.map(function (c) {
        return '<button type="button" class="aw-cb" role="checkbox" aria-checked="' + (w.o[r.k].indexOf(c[0]) >= 0) + '" data-aw="multi" data-v="' + esc(r.k + '|' + c[0]) + '">' + CK2 + '<span>' + esc(c[1]) + '</span></button>';
      }).join('') + '</div>';
      else h += '<div class="aw-ch" role="radiogroup" aria-label="' + esc(r.nom) + '">' + ch.map(function (c) {
        return '<button type="button" class="aw-cb aw-rd" role="radio" aria-checked="' + (w.o[r.k] === c[0]) + '" data-aw="choix" data-v="' + esc(r.k + '|' + c[0]) + '"><i></i><span>' + esc(c[1]) + '</span></button>';
      }).join('') + '</div>';
      h += '</div>';
    });
    return h;
  }
  function scene() {
    var w = cible(); if (!w) { sel0(); w = cible(); }
    var L = LIB[w.k], posed = UI.sel.t === 'w', nb = W().items.filter(function (x) { return x.k === w.k; }).length;
    return '<div class="aw-nom"><span class="aw-lg1">' + ic(L.ic) + '</span><span class="aw-ln"><b>' + esc(L.nom) + '</b><small>' + esc(L.ds) + '</small></span></div>' +
      '<div class="aw-etat ' + (posed ? 'pose' : 'brou') + '">' + (posed ? CK2 + '<span>Ce widget est sur votre accueil : chaque réglage s\'applique tout de suite.</span>' : '<span>Aperçu : ce widget n\'est pas encore sur votre accueil.' + (nb ? ' Vous en avez déjà ' + nb + ', vous pouvez en poser un autre.' : '') + '</span>') + '</div>' +
      '<div class="aw-scene" aria-label="Aperçu du widget"><i class="aw-gh" aria-hidden="true"></i><div class="aw-cw">' + cadre(w, 0, true) + '</div><i class="aw-gh aw-gh2" aria-hidden="true"></i></div>' +
      '<div class="aw-regs">' + reglagesW(w) + '</div>' +
      '<div class="aw-go">' + (posed ? '<button type="button" class="aw-bt aw-ret" data-aw="retirer" data-v="' + esc(w.id) + '">Retirer de mon accueil</button>'
        : '<button type="button" class="v2-btn v2-btn-primary" data-aw="ajoute" data-v="' + w.k + '"' + (W().items.length >= MAX ? ' disabled' : '') + '>' + ic('plus') + 'Ajouter à mon accueil</button>' + (W().items.length >= MAX ? '<p class="aw-v">Votre accueil porte déjà ' + MAX + ' widgets : retirez-en un pour en ajouter.</p>' : '')) + '</div>';
  }
  function accueilListe() {
    var l = W().items, cur = UI.sel && UI.sel.t === 'w' ? UI.sel.id : null;
    var h = '<div class="aw-mod"><h4>Modèles prêts à poser</h4><div class="aw-mds">' + MODELES.map(function (m) {
      return '<button type="button" class="aw-md" data-aw="modele" data-v="' + m.k + '"><b>' + m.nom + '</b><small>' + esc(m.ds) + '</small></button>';
    }).join('') + '</div>' + (UI.avant ? '<button type="button" class="aw-bt aw-an" data-aw="annule">' + ic('reset') + 'Annuler le modèle, revenir à mes widgets</button>' : '<p class="aw-note">Un modèle remplace votre colonne ; vous pourrez le retoucher ou l\'annuler.</p>') + '</div>';
    h += '<h4 class="aw-lh">Ma colonne, de haut en bas <em>' + l.length + '</em></h4>';
    if (!l.length) return h + '<p class="aw-v">Aucun widget sur votre accueil. Choisissez-en un dans la bibliothèque, ou posez un modèle.</p>';
    return h + '<ol class="aw-ls">' + l.map(function (w, i) {
      var nm = LIB[w.k].nom;
      return '<li class="aw-row' + (w.id === cur ? ' on' : '') + '"><span class="aw-no1" aria-hidden="true">' + (i + 1) + '</span>' +
        '<button type="button" class="aw-rn" data-aw="w" data-v="' + w.id + '" aria-pressed="' + (w.id === cur) + '" aria-label="Régler ' + esc(nm) + ', ' + (i + 1) + 'e position"><b>' + esc(nm) + '</b><small>' + TAILLES[w.t] + '</small></button>' +
        '<span class="aw-fl"><button type="button" class="aw-ib" data-aw="monte" data-v="' + w.id + '" aria-label="Monter ' + esc(nm) + '"' + (i === 0 ? ' disabled' : '') + '>' + ic('up') + '</button>' +
        '<button type="button" class="aw-ib" data-aw="descend" data-v="' + w.id + '" aria-label="Descendre ' + esc(nm) + '"' + (i === l.length - 1 ? ' disabled' : '') + '>' + ic('down') + '</button>' +
        '<button type="button" class="aw-ib aw-x" data-aw="retire" data-v="' + w.id + '" aria-label="Retirer ' + esc(nm) + '">' + ic('croix') + '</button></span></li>';
    }).join('') + '</ol>';
  }
  function monter() {
    if (AT) return;
    AT = document.createElement('div'); AT.id = 'u2-atelier'; AT.className = 'aw-at'; AT.setAttribute('role', 'dialog'); AT.setAttribute('aria-modal', 'true'); AT.setAttribute('aria-labelledby', 'aw-ti'); AT.setAttribute('data-et', '1');
    AT.innerHTML = '<div class="aw-in"><header class="aw-hd"><div><h2 id="aw-ti">L\'atelier des widgets</h2><p>Choisissez à gauche, réglez au milieu, retrouvez le résultat à droite. <span class="aw-gard">' + CK2 + 'Gardé pour vous.</span></p></div>' +
      '<button type="button" class="v2-btn v2-btn-primary" data-aw="fin">Terminé</button></header>' +
      '<div class="aw-pas" role="group" aria-label="Les trois parties de l\'atelier"><button type="button" data-aw="etape" data-v="1"><i>1</i>Choisir</button><button type="button" data-aw="etape" data-v="2"><i>2</i>Régler</button><button type="button" data-aw="etape" data-v="3"><i>3</i>Mon accueil</button></div>' +
      '<div class="aw-bd"><section class="aw-c1 aw-pan" aria-labelledby="aw-t1"><h3 id="aw-t1"><i>1</i>Bibliothèque</h3><label class="aw-q">' + ic('search') + '<span class="u2-sr">Chercher un widget</span><input type="search" id="aw-q" placeholder="Chercher un widget" aria-label="Chercher un widget" autocomplete="off" enterkeyhint="search"></label><div class="aw-sc1" id="aw-lib"></div></section>' +
      '<section class="aw-c2 aw-pan" aria-labelledby="aw-t2"><h3 id="aw-t2"><i>2</i>Le widget choisi</h3><div class="aw-sc1" id="aw-st"></div></section>' +
      '<section class="aw-c3 aw-pan" aria-labelledby="aw-t3"><h3 id="aw-t3"><i>3</i>Mon accueil</h3><div class="aw-sc1" id="aw-ho"></div></section></div></div>';
    document.body.appendChild(AT);
    var q = AT.querySelector('#aw-q');
    q.addEventListener('input', function () { UI.q = q.value; document.getElementById('aw-lib').innerHTML = bibliotheque(); });
    AT.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); return; }
      if (e.key !== 'Tab') return;
      var f = [].slice.call(AT.querySelectorAll('button:not([disabled]),input,a[href]')).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      e.preventDefault();
      var i = f.indexOf(document.activeElement), j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      f[j].focus();
    });
  }
  function rendre(foc) {
    if (!AT) return;
    var a = document.activeElement, mem = a && AT.contains(a) ? [a.getAttribute('data-aw'), a.getAttribute('data-v')] : null;
    document.getElementById('aw-lib').innerHTML = bibliotheque();
    document.getElementById('aw-st').innerHTML = scene();
    document.getElementById('aw-ho').innerHTML = accueilListe();
    AT.setAttribute('data-et', String(UI.et));
    [].forEach.call(AT.querySelectorAll('.aw-pas button'), function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-v') === UI.et)); });
    var f = foc || mem || UI.last;
    if (f && f[0]) {
      var n = AT.querySelector('[data-aw="' + f[0] + '"][data-v="' + f[1] + '"]');
      if (n && !n.disabled) n.focus();
      else if (foc === undefined && mem && /monte|descend/.test(mem[0])) { var alt = AT.querySelector('[data-aw="' + (mem[0] === 'monte' ? 'descend' : 'monte') + '"][data-v="' + mem[1] + '"]'); if (alt && !alt.disabled) alt.focus(); }
    }
  }
  function appliquerTeinte() {
    var v = P().vars(), k;
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) AT.style.setProperty(k, v[k]);
  }
  function ouvrir(opener, id) {
    var p = P(); if (!p) return;
    monter(); appliquerTeinte();
    UI.opener = opener || document.querySelector('[data-u2-rail="widgets"]') || document.querySelector('.u2-page .tp-avb'); UI.avant = null;
    var w = id && get(id); UI.sel = w ? { t: 'w', id: w.id } : null; if (!UI.sel) sel0(); UI.q = ''; AT.querySelector('#aw-q').value = ''; UI.et = w ? 2 : 1;
    p.fermer();   // le tiroir « Mon espace » se referme s'il était ouvert
    UI.ouvert = true;
    rendre(); AT.classList.add('on');
    [document.getElementById('v2-root'), document.getElementById('u2-hors')].forEach(function (n) { if (n) n.inert = true; });
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var n = id ? AT.querySelector('.aw-row.on .aw-rn') : AT.querySelector('#aw-q'); if (n && !n.offsetParent) n = AT.querySelector('#aw-st [aria-checked="true"]'); if (n) n.focus(); }, 60);
  }
  function fermer() {
    if (!UI.ouvert) return;
    UI.ouvert = false; AT.classList.remove('on');
    [document.getElementById('v2-root'), document.getElementById('u2-hors')].forEach(function (n) { if (n) n.inert = false; });
    document.body.style.overflow = '';
    if (UI.opener && document.contains(UI.opener)) { try { UI.opener.focus(); } catch (e) {} }
  }
  function toast(m) { try { if (V2.toast) V2.toast(m); } catch (e) {} }
  function agir(a, v, el) {
    UI.last = AT && AT.contains(el) ? [a, v] : null;
    if (a === 'atelier') { ouvrir(el); return; }
    if (a === 'regler') { ouvrir(el, v); return; }
    if (a === 'fin') { fermer(); return; }
    if (a === 'etape') { UI.et = +v; rendre(); return; }
    if (a === 'lib') { UI.sel = { t: 'l', k: v, d: brouillon(v) }; UI.et = 2; rendre(); return; }
    if (a === 'w') { UI.sel = { t: 'w', id: v }; UI.et = 2; rendre(); return; }
    if (a === 'ajoute') {
      var d = UI.sel && UI.sel.d, w = d && ajouter(v, d.t, d.o);
      if (!w) return;
      UI.sel = { t: 'w', id: w.id }; UI.et = 3; UI.avant = null; toast('« ' + LIB[v].nom + ' » est ajouté à votre accueil.'); garde(); rendre(['w', w.id]); return;
    }
    if (a === 'taille') { var t = cible(); if (!t) return; if (UI.sel.t === 'w') { t.t = v; garde(); rendre(); } else { t.t = v; rendre(); } return; }
    if (a === 'choix' || a === 'multi') {
      var p = v.split('|'), c = cible(), val = p.slice(1).join('|'); if (!c) return;
      if (a === 'multi') { val = (c.o[p[0]] || []).slice(); var i = val.indexOf(p[1]); if (i >= 0) val.splice(i, 1); else if (val.length < 6) val.push(p[1]); }
      c.o[p[0]] = val;
      if (UI.sel.t === 'w') garde();
      rendre(); return;
    }
    if (a === 'monte' || a === 'descend') { bouger(v, a === 'monte' ? -1 : 1); garde(); rendre(); return; }
    if (a === 'retire' || a === 'retirer') {
      var wr = get(v); if (!wr) return;
      var nom = LIB[wr.k].nom, idx = W().items.indexOf(wr);
      W().items.splice(idx, 1);
      if (UI.sel && UI.sel.t === 'w' && UI.sel.id === v) UI.sel = null;
      if (!UI.sel) { var nx = W().items[Math.min(idx, W().items.length - 1)]; UI.sel = nx ? { t: 'w', id: nx.id } : { t: 'l', k: 'relance', d: brouillon('relance') }; }
      toast('« ' + nom + ' » est retiré de votre accueil.');
      var nf = W().items[Math.min(idx, W().items.length - 1)];
      garde(); rendre(nf ? ['w', nf.id] : ['lib', 'relance']); return;
    }
    if (a === 'modele') {
      var m = MODELES.filter(function (x) { return x.k === v; })[0]; if (!m) return;
      UI.avant = JSON.stringify(W().items); W().items.splice(0);
      m.l.forEach(function (x) { ajouter(x[0], x[1], null); });
      sel0(); toast('Modèle « ' + m.nom + ' » posé. Retouchez-le comme vous voulez.'); garde(); rendre(['modele', v]); return;
    }
    if (a === 'annule') {
      var l; try { l = JSON.parse(UI.avant); } catch (e) { l = null; }
      if (!Array.isArray(l)) return;
      W().items.splice(0); l.forEach(function (x) { var w2 = propre(x); if (w2) { w2.id = x.id || nid(); W().items.push(w2); } });
      UI.avant = null; sel0(); toast('Vos widgets d\'avant sont revenus.'); garde(); rendre(['modele', 'terrain']); return;
    }
  }
  /* un seul écouteur pour la colonne et l'atelier ; le bloc-notes garde ce qu'on tape à chaque frappe, sans nouveau rendu */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-aw]'); if (!b || !P()) return;
    if (b.disabled) return;
    agir(b.getAttribute('data-aw'), b.getAttribute('data-v'), b);
  });
  window.addEventListener('hashchange', function () { if (UI.ouvert) fermer(); });   // un changement d'écran (retour du navigateur) referme l'atelier
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('[data-aw-notes]') || !P()) return;
    W().notes = String(t.value || '').slice(0, 600); P().garder();
  });

  V2.accueilWidgets = {
    net: net, defaut: defaut, droiteHtml: droiteHtml, maj: majDroite, ouvrir: ouvrir, fermer: fermer,
    LIB: LIB, CLES: CLES, MODELES: MODELES, ouvert: function () { return UI.ouvert; }
  };
})();
