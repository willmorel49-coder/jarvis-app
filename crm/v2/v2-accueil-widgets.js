/* ═══════════════════════════════════════════════════════════════════════════════
   JARVIS · accueil u2 — la colonne de droite de widgets et le MODE RÉGLAGE SUR PLACE (16/10/2026, version 1 « Sur place »)
   Avant : un atelier plein écran à trois colonnes. Maintenant : « Personnaliser » met l'accueil LUI-MÊME en mode réglage, comme l'écran d'accueil
   d'un téléphone. Chaque widget porte une croix, trois pastilles de taille, un « ⋯ » (réglages de contenu) et se déplace en le tirant (Pointer Events :
   souris et doigt). « + Ajouter un widget » montre des aperçus RÉELS des widgets pas encore posés : un appui = posé. Une bande en haut porte les sept
   couleurs, « Revenir aux réglages d'origine » et « Terminé ». « Autres outils » : un œil par outil (v2-accueil-cinq.js).
   Où c'est gardé : INCHANGÉ — le champ `wid` de la ligne `profils` de la personne (S.wid + garder() par le pont). Rien de nouveau en base.
   Règle de base : AUCUNE donnée d'exemple. Chaque widget lit la donnée réelle déjà chargée par l'app.
   Régler un widget ne redessine que la colonne de droite : les scènes animées du centre ne repartent pas.
   Ce fichier ne connaît pas les internes de v2-app.js : il lit le pont V2.accueilPont.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  // 19/10/2026 — micro posé DANS le champ (V2.notes.champ, v2-notes.js) ; le champ reste tel quel si ce module n'est pas encore chargé ou si l'appareil n'a pas de dictée.
  function micChamp(h, t) { return (V2.notes && V2.notes.champ) ? V2.notes.champ(h, t) : h; }
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
      return '<label class="aw-no"><span class="u2-sr">Vos notes</span>' + micChamp('<textarea data-aw-notes rows="' + rows + '" maxlength="600" placeholder="Écrivez ici">' + esc(txt) + '</textarea>', 'Dicter la note à la voix') + '</label>';
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


  /* ═══ Sur l'accueil : la colonne de droite, au repos et en mode réglage ═══ */
  var PS = { on: false, tray: true, reg: null, conf: false, neuf: null, opener: null };   // l'état du mode réglage : jamais gardé (on repart au repos)
  function calme() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function lienPage(o) { var p = P(); if (!o) return null; var pg = o.split('/')[0]; return p.page(pg) ? { act: 'go:' + o, href: '#' + o } : null; }
  function tailles(w) { return 'SML'.split('').filter(function (t) { return LIB[w.k].t.indexOf(t) >= 0; }); }
  function reglagesHtml(w) {
    var L = LIB[w.k], h = '';
    L.r.forEach(function (r) {
      var ch = choix(r, w);
      h += '<div class="aw-rb"><h4>' + esc(r.nom) + '</h4>';
      if (!ch.length) h += '<p class="aw-v">Rien à choisir pour le moment.</p>';
      else if (r.multi) h += '<div class="aw-ch" role="group" aria-label="' + esc(r.nom) + '">' + ch.map(function (c) {
        return '<button type="button" class="aw-cb" role="checkbox" aria-checked="' + (w.o[r.k].indexOf(c[0]) >= 0) + '" data-pb="multi" data-v="' + esc(w.id + '|' + r.k + '|' + c[0]) + '">' + CK2 + '<span>' + esc(c[1]) + '</span></button>';
      }).join('') + '</div>';
      else h += '<div class="aw-ch" role="radiogroup" aria-label="' + esc(r.nom) + '">' + ch.map(function (c) {
        return '<button type="button" class="aw-cb aw-rd" role="radio" aria-checked="' + (w.o[r.k] === c[0]) + '" data-pb="choix" data-v="' + esc(w.id + '|' + r.k + '|' + c[0]) + '"><i></i><span>' + esc(c[1]) + '</span></button>';
      }).join('') + '</div>';
      h += '</div>';
    });
    return h;
  }
  function cadre(w, i, stat) {
    var L = LIB[w.k], lk = lienPage(L.o), h = corps(w, stat);
    var tt = (lk && !stat) ? '<a class="aw-tl" href="' + esc(lk.href) + '" data-u2-act="' + esc(lk.act) + '"><span>' + esc(L.nom) + '</span>' + ic('arrow') + '</a>' : '<span class="aw-tl"><span>' + esc(L.nom) + '</span></span>';
    _sigW[w.id] = sigCorps(w, h);
    if (!PS.on) {
      return '<section class="u2-wid aw-w aw-' + w.t + ' u2-in" style="--i:' + (i + 3) + '" data-aw-w="' + esc(w.id) + '" aria-label="' + esc(L.nom) + '">' +
        '<div class="u2-wid-h"><h2>' + tt + '</h2></div><div class="aw-c">' + h + '</div></section>';
    }
    var ouv = PS.reg === w.id && L.r.length > 0, ts = tailles(w), nm = esc(L.nom);
    return '<section class="u2-wid aw-w aw-' + w.t + ' pb-w' + (ouv ? ' pb-ouvert' : '') + (PS.neuf === w.id ? ' pb-neuf' : '') + '" data-aw-w="' + esc(w.id) + '" aria-label="' + nm + '">' +
      '<div class="u2-wid-h pb-h"><span class="pb-grip" aria-hidden="true">' + ic('grip') + '</span><h2>' + tt + '</h2>' +
      (L.r.length ? '<button type="button" class="aw-ib pb-dots" data-pb="reglages" data-v="' + esc(w.id) + '" aria-expanded="' + ouv + '" aria-label="Réglages de ' + nm + '" title="Réglages du contenu">' + ic('points') + '</button>' : '') +
      '<button type="button" class="aw-ib pb-x" data-pb="retire" data-v="' + esc(w.id) + '" aria-label="Retirer ' + nm + '" title="Retirer de mon accueil">' + ic('croix') + '</button></div>' +
      '<div class="aw-c pb-c">' + h + '</div>' +
      '<div class="pb-sizes" role="radiogroup" aria-label="Taille de ' + nm + '">' + ts.map(function (t) {
        return '<button type="button" class="pb-sz" role="radio" aria-checked="' + (w.t === t) + '" data-pb="taille" data-v="' + esc(w.id + '|' + t) + '">' + TAILLES[t] + '</button>';
      }).join('') + '</div>' +
      (ouv ? '<div class="pb-reg">' + reglagesHtml(w) + '</div>' : '') +
      '<div class="pb-kb"><span>Clavier : </span><button type="button" data-pb="monte" data-v="' + esc(w.id) + '" aria-label="Monter ' + nm + '">Monter</button>' +
      '<button type="button" data-pb="descend" data-v="' + esc(w.id) + '" aria-label="Descendre ' + nm + '">Descendre</button></div></section>';
  }
  /* « + Ajouter un widget » : des aperçus RÉELS (la vraie donnée, dans la taille qui sera posée) des widgets pas encore sur l'accueil */
  function libres() { var pose = {}; W().items.forEach(function (w) { pose[w.k] = 1; }); return CLES.filter(function (k) { return !pose[k]; }); }
  function trayHtml() {
    var lib = libres(), plein = W().items.length >= MAX;
    var h = '<section class="pb-add" aria-label="Ajouter un widget"><button type="button" class="pb-add-h" data-pb="tray" aria-expanded="' + PS.tray + '">' + ic('plus') +
      '<span><b>Ajouter un widget</b><small>' + (plein ? 'Votre accueil est plein' : lib.length ? lib.length + (lib.length > 1 ? ' à poser' : ' à poser') : 'Tout est déjà posé') + '</small></span>' + ic(PS.tray ? 'up' : 'down') + '</button>';
    if (PS.tray) {
      if (plein) h += '<p class="aw-v pb-add-m">Votre accueil porte déjà ' + MAX + ' widgets : retirez-en un pour en ajouter.</p>';
      else if (!lib.length) h += '<p class="aw-v pb-add-m">Tous les widgets sont déjà sur votre accueil.</p>';
      else h += '<div class="pb-trw"><div class="pb-tray" role="list">' + lib.map(function (k) {
        var b = brouillon(k), L = LIB[k];
        return '<div class="pb-pv" role="listitem"><div class="pb-pv-b" role="button" tabindex="0" data-pb="ajoute" data-v="' + k + '" aria-label="Ajouter ' + esc(L.nom) + ' à mon accueil">' +
          '<div class="pb-pv-c" aria-hidden="true"><section class="u2-wid aw-w aw-' + b.t + '"><div class="u2-wid-h"><h2><span class="aw-tl"><span>' + esc(L.nom) + '</span></span></h2></div><div class="aw-c">' + corps(b, true) + '</div></section></div>' +
          '<span class="pb-pv-go">' + ic('plus') + 'Ajouter ce widget</span></div></div>';
      }).join('') + '</div>' + (lib.length > 1 ? '<div class="pb-pg" aria-hidden="true">' + lib.map(function (k, i) { return '<i' + (i === 0 ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' : '') + '</div>';
    }
    return h + '</section>';
  }
  function vide0() {
    return '<div class="u2-wid"><p class="u2-vide">Aucun widget sur votre accueil.</p><button type="button" class="v2-btn v2-btn-primary pb-vide-b" data-pb="ouvrir">' + ic('plus') + 'Personnaliser</button></div>';
  }
  var _sigW = {}, _struct = '';
  function structure() { return JSON.stringify([PS.on, PS.tray, PS.reg, PS.neuf, W().items.map(function (w) { return [w.id, w.k, w.t, w.o]; })]); }
  function droiteHtml() {
    var l = W().items; _sigW = {}; _struct = structure();
    var h = l.map(function (w, i) { return cadre(w, i, PS.on); }).join('');
    if (PS.on) return h + trayHtml();
    return h || vide0();
  }
  // Met la colonne à jour EN PLACE : si la liste, les tailles ou les réglages ont changé, la colonne se redessine (elle seule) ;
  // sinon seul le corps dont la donnée a changé est remplacé. Le centre (les scènes animées) n'est jamais touché.
  function majDroite(force) {
    var dr = document.getElementById('u2-droite'); if (!dr || !P()) return;
    if (DR && DR.on) return;   // jamais en plein tirage
    var focus = document.activeElement, memo = null;
    if (focus && dr.contains(focus) && focus.getAttribute('data-pb')) memo = [focus.getAttribute('data-pb'), focus.getAttribute('data-v')];
    if (structure() !== _struct) {
      var y = window.pageYOffset;
      dr.innerHTML = droiteHtml();
      if (PS.neuf) { var nw = dr.querySelector('[data-aw-w="' + PS.neuf + '"]'); PS.neuf = null; _struct = structure(); if (nw && nw.scrollIntoView && !(nw.getBoundingClientRect().top > 0 && nw.getBoundingClientRect().bottom < window.innerHeight)) { try { nw.scrollIntoView({ block: 'center', behavior: calme() ? 'auto' : 'smooth' }); } catch (e) {} } }
      else if (Math.abs(window.pageYOffset - y) > 1) window.scrollTo(0, y);
      if (memo) {
        var n = dr.querySelector('[data-pb="' + memo[0] + '"][data-v="' + (memo[1] == null ? '' : memo[1]) + '"]');
        if (!n || n.disabled) { var alt = { monte: 'descend', descend: 'monte' }[memo[0]]; if (alt) n = dr.querySelector('[data-pb="' + alt + '"][data-v="' + memo[1] + '"]'); }
        if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} }
      }
      return;
    }
    W().items.forEach(function (w) {
      var el = dr.querySelector('[data-aw-w="' + w.id + '"] .aw-c'); if (!el) return;
      var h = corps(w, PS.on), s = sigCorps(w, h);
      if (_sigW[w.id] === s) return;
      _sigW[w.id] = s; el.innerHTML = h;
    });
  }
  function garde() { P().garder(); majDroite(true); }
  function brouillon(k) { var t = LIB[k].t; return { id: 'brouillon', k: k, t: t.indexOf('M') >= 0 ? 'M' : t.charAt(0), o: defauts(k) }; }

  /* ═══ La bande du haut : couleur, retour à l'origine, Terminé ═══ */
  function bandeHtml() {
    var p = P(), cur = p.teinte(), h = '<div class="pb-bd"><div class="pb-bd-t"><b>Personnaliser votre accueil</b><span>Tirez un widget pour le déplacer. Tout est gardé tout de suite.</span></div>';
    if (!p.escale()) {
      // 16/10/2026 — « La garde-robe » : la rangée d'aperçus vivants remplace les pastilles (montée par V2HAB.monter dans bande())
      if (window.V2HAB) h += '<div class="hab-band" data-hab-rangee="band"></div>';
      else h += '<div class="pb-col" role="radiogroup" aria-label="Couleur de votre accueil"><span class="pb-col-l">Couleur</span>' + p.teintes.map(function (t) {
        var on = t.k === cur;
        return '<button type="button" class="pb-dot" role="radio" aria-checked="' + on + '" data-pb="couleur" data-v="' + t.k + '" aria-label="' + esc(t.nom) + '" title="' + esc(t.nom) + '">' +
          '<span class="u2-pas' + (t.m ? ' u2-pas-m"' : '" style="background:' + t.c + '"') + '>' + (on ? p.ic('check') : '') + '</span></button>';
      }).join('') + '</div>';
    }
    h += '<div class="pb-bd-a">' + (PS.conf
      ? '<span class="pb-conf" role="group" aria-label="Revenir aux réglages d\'origine"><b>Tout remettre comme au départ ?</b><button type="button" class="pb-lien" data-pb="rzoui">Oui, tout remettre</button><button type="button" class="pb-lien" data-pb="rznon">Non</button></span>'
      : '<button type="button" class="pb-lien pb-rz" data-pb="rz">' + ic('reset') + '<span>Revenir aux réglages d\'origine</span></button>') +
      '<button type="button" class="v2-btn v2-btn-primary pb-fin" data-pb="fin">Terminé</button></div></div>';
    return h;
  }
  function bande() {
    var b = document.getElementById('pb-band'), page = document.querySelector('.u2-page'); if (!b) return;
    var mem = document.activeElement && b.contains(document.activeElement) ? [document.activeElement.getAttribute('data-pb'), document.activeElement.getAttribute('data-v')] : null;
    if (!PS.on) { b.hidden = true; b.innerHTML = ''; if (page) { page.classList.remove('pb-on'); page.style.removeProperty('--pb-h'); } return; }
    b.innerHTML = bandeHtml(); b.hidden = false;
    if (window.V2HAB) V2HAB.monter(b.querySelector('[data-hab-rangee]'), 'band');
    if (page) { page.classList.add('pb-on'); page.style.setProperty('--pb-h', b.offsetHeight + 'px'); }
    if (mem && mem[0]) {
      var n = b.querySelector('[data-pb="' + mem[0] + '"]' + (mem[1] ? '[data-v="' + mem[1] + '"]' : '')) || (/rz/.test(mem[0]) ? b.querySelector('[data-pb="rz"],[data-pb="rznon"]') : null);
      if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  function cinqMaj() { if (V2.accueilCinq && V2.accueilCinq.maj) V2.accueilCinq.maj(); }
  function commencer(opener) {
    var p = P(); if (!p || PS.on) return;
    PS.on = true; PS.tray = true; PS.reg = null; PS.conf = false; PS.neuf = null; PS.opener = opener || null;
    p.fermer(); p.rail(true);
    bande(); majDroite(true); cinqMaj();
    try { window.scrollTo({ top: 0, behavior: calme() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    setTimeout(function () { var f = document.querySelector('#pb-band .pb-dot[aria-checked="true"]') || document.querySelector('#pb-band .pb-fin'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} } }, 60);
  }
  function finir(silencieux) {
    if (!PS.on) return;
    if (DR) dAnnuler();
    PS.on = false; PS.reg = null; PS.conf = false; PS.neuf = null;
    var p = P(); if (p) p.rail(false);
    bande(); majDroite(true); cinqMaj();
    var o = PS.opener; PS.opener = null;
    if (!silencieux) { if (!(o && document.contains(o) && o.offsetParent)) o = document.querySelector('.pb-open') || document.querySelector('[data-u2-rail="perso"]'); if (o) { try { o.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function basculer(b) { if (PS.on) finir(); else commencer(b); }
  function toast(m) { try { if (V2.toast) V2.toast(m); } catch (e) {} }

  /* ═══ Les gestes ═══ */
  function agir(a, v, el) {
    var p = P(), x = v == null ? [] : String(v).split('|');
    if (a === 'ouvrir') { commencer(el); return; }
    if (a === 'fin') { finir(); return; }
    if (!PS.on) return;
    if (a === 'couleur') { p.couleur(v); bande(); return; }
    if (a === 'rz') { PS.conf = true; bande(); return; }
    if (a === 'rznon') { PS.conf = false; bande(); return; }
    if (a === 'rzoui') { PS.conf = false; PS.reg = null; p.reset(); bande(); majDroite(true); cinqMaj(); toast('Votre accueil est revenu aux réglages d\'origine.'); return; }
    if (a === 'oeil') { p.masquer(v); return; }
    if (a === 'tray') { PS.tray = !PS.tray; majDroite(true); return; }
    if (a === 'ajoute') {
      var d = brouillon(v), w = ajouter(v, d.t, d.o); if (!w) return;
      PS.neuf = w.id; toast('« ' + LIB[v].nom + ' » est posé sur votre accueil.'); garde(); return;
    }
    if (a === 'retire') {
      var wr = get(v); if (!wr) return;
      var nom = LIB[wr.k].nom; W().items.splice(W().items.indexOf(wr), 1);
      if (PS.reg === v) PS.reg = null;
      toast('« ' + nom + ' » est retiré. Il est dans « Ajouter un widget ».'); garde(); return;
    }
    if (a === 'taille') { var wt = get(x[0]); if (!wt || tailles(wt).indexOf(x[1]) < 0) return; wt.t = x[1]; garde(); return; }
    if (a === 'reglages') { PS.reg = PS.reg === v ? null : v; majDroite(true); return; }
    if (a === 'choix' || a === 'multi') {
      var wc = get(x[0]); if (!wc) return;
      var val = x.slice(2).join('|');
      if (a === 'multi') { val = (wc.o[x[1]] || []).slice(); var i = val.indexOf(x[2]); if (i >= 0) val.splice(i, 1); else if (val.length < 6) val.push(x[2]); }
      wc.o[x[1]] = val; garde(); return;
    }
    if (a === 'monte' || a === 'descend') { bouger(v, a === 'monte' ? -1 : 1); garde(); return; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-pb]'); if (!b || !P()) return;
    if (b.disabled || b.getAttribute('data-pb') === 'ajoute-ignore') return;
    agir(b.getAttribute('data-pb'), b.getAttribute('data-v'), b);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Escape' && PS.on && !(DR && DR.on)) { e.preventDefault(); finir(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.getAttribute('data-pb') === 'ajoute') { e.preventDefault(); agir('ajoute', t.getAttribute('data-v'), t); }
    if (DR && DR.on && e.key === 'Escape') { e.preventDefault(); dAnnuler(); }
  });
  window.addEventListener('hashchange', function () { if (PS.on) finir(true); });
  window.addEventListener('resize', function () { var b = document.getElementById('pb-band'), pg = document.querySelector('.u2-page'); if (PS.on && b && pg) pg.style.setProperty('--pb-h', b.offsetHeight + 'px'); });
  /* le bloc-notes garde ce qu'on tape à chaque frappe, sans nouveau rendu (au repos seulement : en mode réglage il est montré, pas modifiable) */
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('[data-aw-notes]') || !P()) return;
    W().notes = String(t.value || '').slice(0, 600); P().garder();
  });

  /* ═══ Tirer un widget (souris ET doigt : Pointer Events). Doigt : poignée = tout de suite ; ailleurs sur la carte = appui long court (260 ms) puis glisser.
         Les autres cartes s'écartent ; au lâcher, la carte glisse à sa place, puis l'ordre est gardé. ═══ */
  var DR = null;
  function sansSelection() { try { var s = window.getSelection(); if (s && s.rangeCount) s.removeAllRanges(); } catch (e) {} }
  function dGap() { var dr = document.getElementById('u2-droite'), g = dr ? parseFloat(getComputedStyle(dr).rowGap) : 14; return isNaN(g) ? 14 : g; }
  function dDown(e) {
    if (!PS.on || DR || !e.target.closest) return;
    var card = e.target.closest('.pb-w'); if (!card) return;
    if (e.target.closest('button, a, input, textarea, select, .pb-reg, .pb-kb')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var touch = e.pointerType !== 'mouse', grip = !!e.target.closest('.pb-grip');
    if (!touch && e.cancelable) e.preventDefault();   // à la souris, l'appui sur une carte ne commence jamais une sélection de texte (Safari surlignait toute la page)
    DR = { id: card.getAttribute('data-aw-w'), card: card, x0: e.clientX, y0: e.clientY, y: e.clientY, pid: e.pointerId, on: false, touch: touch, sc0: window.pageYOffset, t: null, raf: 0 };
    if (touch) { if (grip) dDebut(); else DR.t = setTimeout(function () { if (DR && !DR.on) dDebut(); }, 260); }
  }
  function dDebut() {
    var dr = document.getElementById('u2-droite'); if (!DR || !dr) { DR = null; return; }
    var cards = [].slice.call(dr.querySelectorAll('.pb-w'));
    DR.items = cards.map(function (c) { var r = c.getBoundingClientRect(); return { id: c.getAttribute('data-aw-w'), el: c, top: r.top + window.pageYOffset, h: r.height }; });
    DR.i0 = DR.items.map(function (x) { return x.id; }).indexOf(DR.id);
    if (DR.i0 < 0) { DR = null; return; }
    DR.idx = DR.i0; DR.gap = dGap(); DR.on = true; DR.sc0 = window.pageYOffset;
    DR.card.classList.add('pb-lift'); dr.classList.add('pb-dragging');
    try { DR.card.setPointerCapture(DR.pid); } catch (e) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    sansSelection();
    DR.raf = requestAnimationFrame(dBoucle);
  }
  function dPlace() {
    if (!DR || !DR.on) return;
    var dy = DR.y - DR.y0 + (window.pageYOffset - DR.sc0), it = DR.items, c0 = it[DR.i0], centre = c0.top + c0.h / 2 + dy, idx = 0;
    DR.card.style.transform = 'translate3d(0,' + dy + 'px,0) scale(1.02)';
    it.forEach(function (x, j) { if (j !== DR.i0 && x.top + x.h / 2 < centre) idx++; });
    DR.idx = idx;
    var pas = c0.h + DR.gap;
    it.forEach(function (x, j) {
      if (j === DR.i0) return;
      var s = (DR.i0 < j && j <= idx) ? -pas : (idx <= j && j < DR.i0) ? pas : 0;
      x.el.style.transform = s ? 'translate3d(0,' + s + 'px,0)' : '';
    });
  }
  function dBoucle() {
    if (!DR || !DR.on) return;
    var haut = 90, bas = window.innerHeight - 90, v = 0;
    if (DR.y < haut) v = -Math.min(18, (haut - DR.y) / 4 + 2); else if (DR.y > bas) v = Math.min(18, (DR.y - bas) / 4 + 2);
    if (v) window.scrollBy(0, v);
    dPlace();
    DR.raf = requestAnimationFrame(dBoucle);
  }
  function dNet() {
    if (!DR) return;
    clearTimeout(DR.t); cancelAnimationFrame(DR.raf);
    var dr = document.getElementById('u2-droite');
    if (DR.items) DR.items.forEach(function (x) { x.el.style.transform = ''; x.el.style.transition = ''; });
    if (DR.card) { DR.card.classList.remove('pb-lift'); DR.card.style.transform = ''; DR.card.style.transition = ''; try { DR.card.releasePointerCapture(DR.pid); } catch (e) {} }
    if (dr) dr.classList.remove('pb-dragging');
  }
  function dAnnuler() { dNet(); DR = null; }
  function dMove(e) {
    if (!DR || e.pointerId !== DR.pid) return;
    DR.y = e.clientY;
    if (!DR.on) {
      var d = Math.hypot(e.clientX - DR.x0, e.clientY - DR.y0);
      if (DR.touch) { if (d > 8) { clearTimeout(DR.t); DR = null; } }
      else if (d > 4) dDebut();
      return;
    }
    if (e.cancelable) e.preventDefault();
  }
  function dFin(e, annule) {
    if (!DR || e.pointerId !== DR.pid) return;
    if (!DR.on || annule) { dAnnuler(); return; }
    cancelAnimationFrame(DR.raf);
    var d = DR, it = d.items, c0 = it[d.i0], fin = 0, j;
    if (d.idx > d.i0) for (j = d.i0 + 1; j <= d.idx; j++) fin += it[j].h + d.gap;
    else if (d.idx < d.i0) for (j = d.idx; j < d.i0; j++) fin -= it[j].h + d.gap;
    d.card.style.transition = calme() ? 'none' : 'transform .2s cubic-bezier(.2,.8,.2,1)';
    d.card.style.transform = 'translate3d(0,' + fin + 'px,0)';
    DR = { on: true, fige: true, pid: -1, items: [], card: null };   // verrou le temps du glissé final
    setTimeout(function () {
      DR = null; sansSelection();
      if (d.idx !== d.i0) { var l = W().items, w = l.splice(d.i0, 1)[0]; l.splice(d.idx, 0, w); }
      d.items.forEach(function (x) { x.el.style.transition = 'none'; x.el.style.transform = ''; });
      d.card.style.transition = 'none'; d.card.style.transform = ''; d.card.classList.remove('pb-lift');
      var dr = document.getElementById('u2-droite'); if (dr) dr.classList.remove('pb-dragging');
      if (d.idx !== d.i0) garde();
    }, calme() ? 0 : 210);
  }
  document.addEventListener('pointerdown', dDown);
  document.addEventListener('pointermove', dMove, { passive: false });
  document.addEventListener('pointerup', function (e) { dFin(e, false); });
  document.addEventListener('pointercancel', function (e) { dFin(e, true); });
  document.addEventListener('touchmove', function (e) { if (DR && DR.on && e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { if (PS.on && e.target.closest && e.target.closest('.pb-w')) e.preventDefault(); });

  document.addEventListener('scroll', function (e) {
    var t = e.target; if (!t || !t.classList || !t.classList.contains('pb-tray')) return;
    var c = t.firstElementChild, pas = c ? c.getBoundingClientRect().width + 10 : 1, k = Math.min(t.children.length - 1, Math.round(t.scrollLeft / pas));
    [].forEach.call(t.parentNode.querySelectorAll('.pb-pg i'), function (d, i) { d.classList.toggle('on', i === k); });
  }, true);
  window.__atelierOuvrirPerso = function () { commencer(null); };   // le banc de l'atelier (16/10) photographie ce geste

  V2.accueilWidgets = {
    net: net, defaut: defaut, droiteHtml: droiteHtml, maj: majDroite,
    basculer: basculer, commencer: commencer, finir: finir, regle: function () { return PS.on; },
    apres: function () { if (PS.on) { bande(); var p = P(); if (p) p.rail(true); } },
    LIB: LIB, CLES: CLES
  };
})();
