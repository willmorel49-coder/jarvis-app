/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Logiciels officine (pages.lgo) — 25/09/2026, demande de Will :
   « une feature par LGO où il y a tous les process ».
   Un logiciel = son pas-à-pas d'import côté pharmacien, ses fichiers prêts
   (mode d'emploi PDF + catalogue TOP 200/300/500 en CSV et Excel, dans lgo/)
   et les pharmacies qui l'utilisent. Données : window.LGO_PROCESS
   (lgo-process-data.js, généré par ~/jarvis-catalogues-lgo/process.py depuis
   les mêmes étapes que les PDF). Le logiciel d'une officine est reconnu comme
   dans Transmettre (V2.lgoSlug de v2-pharma.js) : saisie de l'équipe (Infos
   officine, qui fait foi), puis annuaire, puis base clients.
   01/10/2026 : écran refait en deux colonnes (liste des logiciels à gauche, détail à droite en trois
   onglets, « À compléter » comme entrée de la liste) d'après la maquette m4 choisie par Will.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var S = { reseau: false, saisie: null, tab: 'ph', fait: {}, q: {}, ctx: null, vu: null, ecran: null, nb: null, nbScope: null };

  // Saisie de l'équipe (profils, scope 'client', champ lgo) : lue une fois pour toutes les
  // officines, puis tenue à jour ici quand on complète depuis la rubrique.
  function chargerSaisie() {
    if (S.saisie || S.charge || !V2.profil || !V2.profil.loadScope) return;
    S.charge = true;
    V2.profil.loadScope('client').then(function (list) {
      var m = {};
      (list || []).forEach(function (r) { var v = r && r.data && String(r.data.lgo || '').trim(); if (v) m[String(r.sid)] = v; });
      S.saisie = m;
      if (V2.route && V2.route.name === 'lgo') V2.render();
    }, function () { S.saisie = {}; });
  }

  function data() { return window.LGO_PROCESS || { lgo: [] }; }
  // Pharmacies par logiciel. Un commercial restreint ne voit que les siennes ;
  // un compte qui voit tout choisit « les miennes » ou « tout le réseau ».
  function repartition() {
    var mes = V2.mesComms ? V2.mesComms() : [];
    var restreint = V2.ventesRestreintes && V2.ventesRestreintes();
    var seulMiennes = restreint || (mes.length && !S.reseau);
    var par = {}, sans = [], autre = 0, autres = {}, total = 0, sai = S.saisie || {};
    (V2.pharmacies || []).forEach(function (p) {
      if (seulMiennes && !(V2.estMonOfficine && V2.estMonOfficine(p))) return;
      total++;
      var ri = V2.rdvInfo ? V2.rdvInfo(p.id) : null;
      var ca = ((window.CLIENTS_ACTIFS || {}).d || {})[String(p.id)];
      var v = sai[String(p.id)], s;
      if (v) {   // la saisie fait foi, même pour un logiciel sans mode d'emploi (Caduciel…)
        s = V2.lgoSlug ? V2.lgoSlug(v) : '';
        if (!s) { autre++; autres[v] = 1; return; }
      } else s = V2.lgoSlug ? (V2.lgoSlug(ri && ri.logiciel) || V2.lgoSlug(ca && ca[5])) : '';
      if (!s) { sans.push(p); return; }
      (par[s] = par[s] || []).push(p);
    });
    var tri = function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); };
    Object.keys(par).forEach(function (k) { par[k].sort(tri); });
    sans.sort(tri);
    return { par: par, sans: sans, autre: autre, autres: Object.keys(autres).sort(), total: total, miennes: !!seulMiennes, choix: !!(mes.length && !restreint) };
  }

  var nf = function (n) { return Number(n || 0).toLocaleString('fr-FR'); };
  var pl = function (n, mot) { return nf(n) + ' ' + mot + (n > 1 ? 's' : ''); };
  var reduit = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches); };
  // Villes : la source mélange « MARSEILLE » et « Valenciennes » — une seule écriture à l'écran.
  function ville(v) {
    return String(v || '').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(Sur|Sous|En|De|Du|Des|La|Le|Les|Et|Aux?)\b/g, function (m, w, i) { return i ? w.toLowerCase() : w; }).replace(/\bCedex\b.*$/i, '').trim();
  }
  var SVG = {
    loupe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    envoi: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    bas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>',
    fleche: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    retour: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    croix: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  // Une seule couleur : le bleu de la marque, du plus dense (logiciel le plus présent) au plus léger.
  var TEINTES = ['#0050E6', '#3E7DF0', '#7CA7F6', '#A9C6FA', '#CADBFC', '#DDE8FD', '#E7EEFD', '#EEF3FE'];
  var ONGLETS = ['ph', 'pas', 'fic'];

  // ── Colonne de gauche ──────────────────────────────────────────────
  // Nombres affichés à gauche : un seul calcul, pour la tête, la liste et le repérage des changements.
  function comptes(L, R) {
    var c = { connus: R.autre, ac: R.sans.length };
    L.forEach(function (l) { var n = (R.par[l.s] || []).length; c[l.s] = n; c.connus += n; });
    return c;
  }

  function tete(L, R, c, bump) {
    var parts = L.filter(function (l) { return c[l.s]; }).map(function (l, i) {
      return { nom: l.nom, n: c[l.s], c: TEINTES[Math.min(i, TEINTES.length - 1)] };
    });
    if (R.autre) parts.push({ nom: 'Autres logiciels', n: R.autre, c: '#B9C6DD' });
    if (R.sans.length) parts.push({ nom: 'Logiciel à compléter', n: R.sans.length, c: '', vide: true });
    var pct = R.total ? Math.round(c.connus * 100 / R.total) : 0;
    return '<div class="lgo-side-head"><h1>Logiciels officine</h1>' +
      '<p>Le catalogue Intégral, prêt à importer dans le logiciel de chaque pharmacie.</p>' +
      (R.choix ? '<div class="lgo-sw" role="group" aria-label="Pharmacies comptées"><button type="button" class="' + (R.miennes ? 'on' : '') + '" aria-pressed="' + R.miennes + '" onclick="V2.lgoReseau(false)">Mes pharmacies</button>' +
        '<button type="button" class="' + (R.miennes ? '' : 'on') + '" aria-pressed="' + !R.miennes + '" onclick="V2.lgoReseau(true)">Tout le réseau</button></div>' : '') +
      '<div class="lgo-resume"><b class="lgo-big' + bump('connus') + '">' + nf(c.connus) + '</b><span>pharmacie' + (c.connus > 1 ? 's' : '') + ' au logiciel connu' +
        '<small>sur ' + nf(R.total) + (R.miennes ? ' dans votre secteur' : ' dans le réseau') + ' · ' + pct + ' %</small></span></div>' +
      '<div class="lgo-barre" role="img" aria-label="Répartition des pharmacies par logiciel">' + parts.map(function (x) {
        return '<i class="' + (x.vide ? 'vide' : '') + '" style="flex-grow:' + x.n + (x.c ? ';background:' + x.c : '') + '" title="' + esc(x.nom) + ' : ' + nf(x.n) + '"></i>';
      }).join('') + '</div>' +
      (R.autre ? '<p class="lgo-autres">' + pl(R.autre, 'pharmacie') + ' sur un logiciel sans mode d\'emploi pour l\'instant (' + esc(R.autres.join(', ')) + ').</p>' : '') +
    '</div>';
  }

  // La liste : ceux qui ont des pharmacies d'abord, du plus présent au moins présent ;
  // ceux qui n'en ont pas restent accessibles ; « À compléter » ferme la liste.
  function liste(L, R, c, cur, acActif, bump) {
    var max = Math.max.apply(null, L.map(function (l) { return c[l.s]; }).concat([1]));
    var avec = L.filter(function (l) { return c[l.s]; }), sansPh = L.filter(function (l) { return !c[l.s]; });
    var go = function (s) { return ' onclick="V2.go(\'lgo\',\'' + s + '\')"'; };
    var on = function (s) { return ' aria-current="' + (!acActif && cur && cur.s === s) + '"'; };
    var h = avec.map(function (l, i) {
      var n = c[l.s];
      return '<button type="button" class="lgo-l" data-s="' + l.s + '"' + on(l.s) + go(l.s) + '>' +
        '<span class="lgo-l-n">' + esc(l.nom) + '</span><span class="lgo-l-e">' + esc(l.editeur || '') + '</span>' +
        '<span class="lgo-l-c"><b class="' + bump(l.s).trim() + '">' + nf(n) + '</b><small>pharmacie' + (n > 1 ? 's' : '') + '</small></span>' +
        '<span class="lgo-l-b"><i style="width:' + Math.max(4, Math.round(n * 100 / max)) + '%;background:' + TEINTES[Math.min(i, TEINTES.length - 1)] + '"></i></span>' +
        '<span class="lgo-chev">' + SVG.chev + '</span></button>';
    }).join('');
    if (sansPh.length) h += '<div class="lgo-grp">Sans pharmacie pour l\'instant</div>' + sansPh.map(function (l) {
      return '<button type="button" class="lgo-l zero" data-s="' + l.s + '"' + on(l.s) + go(l.s) + '>' +
        '<span class="lgo-l-n">' + esc(l.nom) + '</span><span class="lgo-l-e">' + esc(l.editeur || 'Mode d\'emploi prêt') + '</span>' +
        '<span class="lgo-l-c"><b>0</b><small>pharmacie</small></span><span class="lgo-chev">' + SVG.chev + '</span></button>';
    }).join('');
    if (!S.saisie) {
      h += '<div class="lgo-sep"></div><div class="lgo-l ac att" role="status"><span class="lgo-l-n">À compléter</span>' +
        '<span class="lgo-l-e">Lecture des logiciels saisis par l\'équipe…</span></div>';
    } else if (R.sans.length) {
      h += '<div class="lgo-sep"></div><button type="button" class="lgo-l ac" data-s="ac" aria-current="' + acActif + '"' + go('ac') + '>' +
        '<span class="lgo-l-n">À compléter</span><span class="lgo-l-e">Logiciel inconnu, à renseigner</span>' +
        '<span class="lgo-l-c"><b class="' + bump('ac').trim() + '">' + nf(R.sans.length) + '</b><small>pharmacies</small></span>' +
        '<span class="lgo-l-b"><i style="width:' + Math.max(4, Math.round(R.sans.length * 100 / max)) + '%"></i></span>' +
        '<span class="lgo-chev">' + SVG.chev + '</span></button>';
    }
    return h;
  }

  // ── Zone de droite ─────────────────────────────────────────────────
  function sousTitre(n, R) {
    return n ? pl(n, 'pharmacie') + (R.total ? ' · ' + Math.max(1, Math.round(n * 100 / R.total)) + ' % ' + (R.miennes ? 'de votre secteur' : 'du réseau') : '') : 'aucune pharmacie pour l\'instant · mode d\'emploi prêt';
  }
  var RETOUR = '<button type="button" class="lgo-backm" onclick="V2.go(\'lgo\')">' + SVG.retour + 'Logiciels</button>';

  function entete(cur, R, n) {
    if (!cur) {
      var k = R.sans.length;
      return RETOUR + '<div class="lgo-mh"><div><h2>À compléter</h2><p>' + (S.saisie ? pl(k, 'pharmacie') + ' dont le logiciel est inconnu' + (R.total ? ' · ' + Math.round(k * 100 / R.total) + ' % ' + (R.miennes ? 'de votre secteur' : 'du réseau') : '') : 'Lecture des logiciels saisis par l\'équipe…') + '</p></div></div>';
    }
    return RETOUR + '<div class="lgo-mh"><div><h2>' + esc(cur.nom) + '</h2><p>' + (cur.editeur ? 'Éditeur ' + esc(cur.editeur) + ' · ' : '') + sousTitre(n, R) + '</p></div>' +
      '<a class="v2-btn v2-btn-primary lgo-cta" href="lgo/tuto-' + cur.s + '.pdf" target="_blank" rel="noopener"><span class="lgo-pdf-ico mini" aria-hidden="true">PDF</span>Mode d\'emploi ' + esc(cur.nom) + '</a></div>';
  }
  function onglets(cur, n) {
    var nbFic = 1 + 2 * (data().tailles || [200, 300, 500]).length;
    var t = [['ph', 'Pharmacies', nf(n)], ['pas', 'Pas-à-pas', pl(cur.etapes.length, 'étape')], ['fic', 'Fichiers', String(nbFic)]];
    return '<div class="lgo-tabs-w"><div class="lgo-tabs" role="tablist" aria-label="Contenu du logiciel" style="--i:' + Math.max(0, ONGLETS.indexOf(S.tab)) + '"><i class="lgo-tabs-i" aria-hidden="true"></i>' + t.map(function (x) {
      return '<button type="button" class="lgo-tab" role="tab" data-t="' + x[0] + '" aria-selected="' + (S.tab === x[0]) + '" tabindex="' + (S.tab === x[0] ? 0 : -1) + '" onclick="V2.lgoOnglet(\'' + x[0] + '\')" onkeydown="V2.lgoOngletTouche(event)">' + x[1] + '<span class="lgo-n">' + x[2] + '</span></button>';
    }).join('') + '</div></div>';
  }

  function recherche(cible, n, quoi) {
    return n > 8 ? '<label class="lgo-rech">' + SVG.loupe + '<input type="search" placeholder="Nom, ville, code postal…" aria-label="Chercher ' + quoi + '" autocomplete="off" data-filtre="' + cible + '" oninput="V2.lgoFiltrer(this,\'' + cible + '\')">' +
      '<button type="button" class="lgo-rech-x" aria-label="Effacer la recherche" onclick="V2.lgoEffacer(this)">' + SVG.croix + '</button></label>' : '';
  }
  function lieu(p) { var v = ville(p.ville); return esc(v) + (p.cp ? (v ? ' · ' : '') + esc(p.cp) : ''); }
  function dataQ(p) { return esc((p.name + ' ' + (p.ville || '') + ' ' + (p.cp || '')).toLowerCase()); }
  function lienFiche(p) { return '<a href="#pharma/' + encodeURIComponent(p.id) + '" onclick="V2.go(\'pharma\',\'' + esc(p.id) + '\');return false"><span>' + esc(p.name) + '</span><small>' + lieu(p) + '</small></a>'; }

  function panelPh(l, R) {
    var list = R.par[l.s] || [], peutEnvoyer = !!V2.pharmaTxCatalogue;
    if (!list.length) {
      return '<div class="lgo-vide-c"><b>Aucune pharmacie ' + (R.miennes ? 'de votre secteur' : 'du réseau') + ' sur ' + esc(l.nom) + ' pour l\'instant.</b>' +
        '<p>Le mode d\'emploi et les catalogues sont prêts : dès qu\'une pharmacie est renseignée sur ' + esc(l.nom) + ' (depuis « À compléter » ou sa fiche), elle apparaît ici.</p>' +
        '<button type="button" class="v2-btn v2-btn-ghost lgo-vide-b" onclick="V2.lgoOnglet(\'fic\')">Voir les fichiers ' + esc(l.nom) + '</button></div>';
    }
    return recherche('lgo-ph', list.length, 'une pharmacie') +
      (peutEnvoyer ? '<p class="lgo-mini">« Envoyer » ouvre Transmettre avec le mode d\'emploi et le catalogue ' + esc(l.nom) + ' déjà cochés.</p>' : '') +
      '<div class="lgo-list" id="lgo-ph">' + list.map(function (p) {
        var id = esc(p.id);
        return '<div class="lgo-ph" data-q="' + dataQ(p) + '">' + lienFiche(p) +
          (peutEnvoyer ? '<button type="button" class="lgo-send" onclick="V2.lgoEnvoyer(\'' + id + '\',\'' + l.s + '\')" aria-label="Envoyer le catalogue à ' + esc(p.name) + '">' + SVG.envoi + '<span>Envoyer</span></button>' : '') +
        '</div>';
      }).join('') + '<p class="lgo-vide" hidden>Aucune pharmacie ne correspond.</p></div>';
  }

  function panelPas(l) {
    var fait = S.fait[l.s] || {}, nb = Object.keys(fait).length, tot = l.etapes.length;
    return '<div class="lgo-prog"><div class="lgo-prog-t"><b id="lgo-prog-n">' + (nb ? (nb === tot ? 'Terminé : ' + tot + ' étapes sur ' + tot : 'Étape ' + nb + ' sur ' + tot) : pl(tot, 'étape') + ', côté pharmacien') + '</b><span>Touchez une étape quand elle est faite avec le pharmacien.</span></div>' +
      '<div class="lgo-prog-b"><i id="lgo-prog-i" style="width:' + Math.round(nb * 100 / tot) + '%"></i></div></div>' +
      '<ol class="lgo-steps">' + l.etapes.map(function (e, i) {   // HTML de confiance (tutos.py)
        return '<li><button type="button" class="lgo-st" aria-pressed="' + !!fait[i] + '" onclick="V2.lgoEtape(' + i + ')"><span class="lgo-st-n"><span>' + (i + 1) + '</span>' + SVG.check + '</span><span class="lgo-st-t">' + e + '</span></button></li>';
      }).join('') + '</ol>' +
      (l.note ? '<div class="lgo-note">' + l.note + '</div>' : '') +
      (l.img && l.img.length ? '<div class="lgo-img">' + l.img.map(function (src, i) {
        return '<a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="Capture de l\'écran ' + esc(l.nom) + ', ' + (i + 1) + '" loading="lazy"><small>Capture ' + (i + 1) + ' sur ' + l.img.length + ', s\'ouvre en grand</small></a>';
      }).join('') + '</div>' : '');
  }

  function panelFic(l) {
    var tailles = data().tailles || [200, 300, 500];
    return '<a class="lgo-pdf" href="lgo/tuto-' + l.s + '.pdf" target="_blank" rel="noopener">' +
        '<span class="lgo-pdf-ico">PDF</span><span><b>Mode d\'emploi ' + esc(l.nom) + '</b><small>À joindre au mail, ou à lire avec le pharmacien</small></span>' + SVG.fleche + '</a>' +
      '<div class="lgo-fh"><span>Catalogue</span><span>À importer</span><span>À consulter</span></div>' + tailles.map(function (n) {
        var b = 'lgo/integral-top' + n + '-' + l.s;
        return '<div class="lgo-fl"><span class="lgo-topn">TOP ' + n + (n === 300 ? '<em>par défaut</em>' : '') + '</span>' +
          '<a class="csv" href="' + b + '.csv" download aria-label="TOP ' + n + ' en CSV, à importer">' + SVG.bas + 'CSV</a>' +
          '<a href="' + b + '.xlsx" download aria-label="TOP ' + n + ' en Excel, à consulter">' + SVG.bas + 'Excel</a></div>';
      }).join('') +
      '<p class="lgo-mini">Produits les plus commandés du réseau (' + esc(data().periode || '') + '), hors génériques. ' +
        'Le CSV est au format exact du logiciel (colonnes, ordre, décimales), au prix net ; l\'Excel a les mêmes colonnes avec une ligne de titre.</p>';
  }

  // Pharmacies sans logiciel connu : on le renseigne ici, et c'est enregistré dans leur fiche
  // (Infos officine › Logiciel), comme si on l'avait saisi là-bas. Rien n'est deviné.
  function panelAc(R) {
    if (!S.saisie) return '<p class="lgo-mini lgo-att-t" role="status">Lecture des logiciels saisis par l\'équipe…</p>';
    if (!R.sans.length) return '<div class="lgo-vide-c"><b>Toutes les pharmacies ont un logiciel.</b><p>Il n\'y a plus rien à compléter ' + (R.miennes ? 'dans votre secteur' : 'dans le réseau') + '.</p></div>';
    var opts = '<option value="">Choisir…</option>' + ((V2.profil && V2.profil.LGO) || []).map(function (o) {
      return '<option>' + esc(o) + '</option>';
    }).join('');
    return '<p class="lgo-mini lgo-ac-t">Le logiciel choisi s\'enregistre dans la fiche de la pharmacie (Infos officine), pour toute l\'équipe. La pharmacie rejoint aussitôt son logiciel, dans la colonne de gauche.</p>' +
      recherche('lgo-ac-l', R.sans.length, 'une pharmacie à compléter') +
      '<div class="lgo-list" id="lgo-ac-l">' + R.sans.map(function (p) {
        return '<div class="lgo-acr" data-q="' + dataQ(p) + '">' + lienFiche(p) +
          '<select aria-label="Logiciel de ' + esc(p.name) + '" data-pid="' + esc(p.id) + '" onchange="V2.lgoPoser(this)">' + opts + '</select></div>';
      }).join('') + '<p class="lgo-vide" hidden>Aucune pharmacie ne correspond.</p></div>';
  }

  function panneau() {
    var x = S.ctx; if (!x) return '';
    if (!x.cur) return panelAc(x.R);
    return S.tab === 'pas' ? panelPas(x.cur) : S.tab === 'fic' ? panelFic(x.cur) : panelPh(x.cur, x.R);
  }

  function css() {
    if (document.getElementById('v2-lgo-css')) return;
    var s = document.createElement('style'); s.id = 'v2-lgo-css';
    s.textContent = [
      /* Coque : deux colonnes, comme une messagerie. Écran fixe sur ordinateur, chaque zone défile en elle-même. */
      '.lgo-shell.v2-wrap{--lgo-top:64px;box-sizing:border-box;width:100%;max-width:1240px;height:calc(100vh - var(--lgo-top));min-height:480px;padding:18px 26px;display:grid;grid-template-columns:316px minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:16px;overflow-x:clip}',
      /* L'arrivée de l'écran (mouvement de l'application) décale la coque de quelques pixels : on rogne à la racine pour que la page ne s'élargisse jamais. */
      '.v2:has(.lgo-shell){overflow-x:clip}',
      '.lgo-side,.lgo-main{position:relative;min-height:0;display:flex;flex-direction:column;background:#fff;border:1px solid #DCE5F5;border-radius:20px;overflow:clip;box-shadow:0 1px 0 #fff inset,0 18px 40px -26px rgba(0,52,160,.35)}',
      /* colonne de gauche */
      '.lgo-side-head{position:relative;flex:none;padding:16px 18px 14px;border-bottom:1px solid #EDF1F8;background:linear-gradient(180deg,#fff,#F8FAFF)}',
      '.lgo-side-head:before{content:"";position:absolute;right:-120px;top:-170px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(76,130,245,.26),rgba(76,130,245,0) 68%);pointer-events:none}',
      '.lgo-side-head>*{position:relative}',
      '.lgo-side-head h1{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em;color:#0B1B3A}',
      '.lgo-side-head p{margin:2px 0 0;font-size:13px;color:#586377;line-height:1.4}',
      '.lgo-sw{display:flex;margin-top:10px;background:#EEF3FC;border-radius:999px;padding:3px}',
      '.lgo-sw button{flex:1 1 0;border:0;background:none;padding:0 8px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;color:#475569;cursor:pointer;min-height:44px}',
      '.lgo-sw button.on{background:#fff;color:#0034A0;box-shadow:0 1px 3px rgba(0,52,160,.18)}',
      '.lgo-resume{margin-top:12px;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}',
      '.lgo-big{display:inline-block;font-size:34px;line-height:1;font-weight:800;letter-spacing:-.03em;color:#0B1B3A;font-variant-numeric:tabular-nums}',
      '.lgo-resume span{font-size:13.5px;font-weight:600;color:#0B1B3A;line-height:1.3}',
      '.lgo-resume small{display:block;font-size:13px;font-weight:500;color:#586377;font-variant-numeric:tabular-nums}',
      '.lgo-barre{display:flex;gap:3px;height:9px;margin-top:10px}',
      '.lgo-barre i{display:block;min-width:4px;border-radius:4px;transform-origin:left center}',
      '.lgo-barre i:first-child{border-radius:5px 4px 4px 5px}.lgo-barre i:last-child{border-radius:4px 5px 5px 4px}',
      '.lgo-barre i.vide,.lgo-l.ac .lgo-l-b i{background:repeating-linear-gradient(135deg,#EDF1F8 0 5px,#DFE6F2 5px 10px)}',
      '.lgo-autres{margin:8px 0 0;font-size:13px;color:#586377}',
      '.lgo-side-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 8px 10px}',
      '.lgo-grp{padding:14px 12px 6px;font-size:13px;font-weight:700;color:#586377;letter-spacing:.02em}',
      '.lgo-l{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"n c" "e c" "b b";column-gap:10px;width:100%;text-align:left;border:1px solid transparent;background:none;border-radius:12px;padding:9px 12px 10px;font:inherit;cursor:pointer;min-height:56px;color:#0B1B3A;transition:background .15s,border-color .15s}',
      '.lgo-l+.lgo-l{margin-top:2px}',
      '.lgo-l:hover{background:#F3F7FF}',
      '.lgo-l[aria-current="true"]{background:var(--halo,#E9F0FF)}',
      '.lgo-l[aria-current="true"] .lgo-l-n{color:#0034A0}',
      '.lgo-l-n{grid-area:n;font-weight:700;font-size:14.5px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lgo-l-e{grid-area:e;font-size:13px;color:#586377;line-height:1.3;min-height:17px}',
      '.lgo-l-c{grid-area:c;align-self:start;text-align:right;line-height:1.15}',
      '.lgo-l-c b{display:block;font-size:15px;font-weight:800;letter-spacing:-.02em;color:#0034A0;font-variant-numeric:tabular-nums}',
      '.lgo-l-c small{display:block;font-size:13px;color:#586377}',
      '.lgo-l-b{grid-area:b;height:4px;border-radius:4px;background:#EEF3FC;margin-top:7px;overflow:hidden}',
      '.lgo-l-b i{display:block;height:100%;border-radius:4px;background:#0050E6}',
      '.lgo-l.zero{min-height:48px;grid-template-areas:"n c" "e c";padding:8px 12px}',
      '.lgo-l.zero .lgo-l-c b{color:#586377;font-weight:700}',
      '.lgo-l.ac{margin-top:10px;border-color:#C9D9F8;border-style:dashed;background:#fff}',
      '.lgo-l.ac:hover{background:#F3F7FF}',
      '.lgo-l.ac[aria-current="true"]{background:var(--halo,#E9F0FF);border-style:solid}',
      '.lgo-l.att{grid-template-areas:"n" "e";cursor:default;color:#586377}.lgo-l.att:hover{background:#fff}',
      '.lgo-sep{height:1px;background:#EDF1F8;margin:12px 6px 2px}',
      '.lgo-chev{display:none}',
      '@keyframes lgo-bump{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}',
      '.lgo-bump{animation:lgo-bump .5s var(--ease,ease)}',
      '.lgo-l-c b.lgo-bump{transform-origin:right center}.lgo-big.lgo-bump{transform-origin:left center}',
      /* zone de droite */
      '.lgo-main-head{flex:none;padding:16px 22px 0}',
      '.lgo-backm{display:none}',
      '.lgo-mh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 18px;flex-wrap:wrap}',
      '.lgo-mh h2{margin:0;font-size:27px;font-weight:800;letter-spacing:-.025em;color:#0B1B3A;line-height:1.1}',
      '.lgo-mh p{margin:5px 0 0;font-size:14px;color:#586377;font-variant-numeric:tabular-nums}',
      '.lgo-cta{min-height:44px;flex:none;text-decoration:none}',
      '.lgo-tabs-w{flex:none;padding:14px 22px 0;background:#fff}',
      '.lgo-tabs{--i:0;position:relative;display:flex;gap:4px;padding:4px;background:#EEF3FC;border-radius:14px}',
      '.lgo-tabs-i{position:absolute;top:4px;left:4px;height:calc(100% - 8px);width:calc((100% - 16px)/3);border-radius:10px;background:#fff;box-shadow:0 1px 3px rgba(0,52,160,.18),0 0 0 1px rgba(0,52,160,.05);transform:translateX(calc(var(--i)*(100% + 4px)));transition:transform .3s var(--ease,ease);pointer-events:none}',
      '.lgo-tab{position:relative;z-index:1;flex:1 1 0;min-width:0;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;background:none;border-radius:10px;padding:0 10px;font:inherit;font-size:14px;font-weight:600;color:#586377;cursor:pointer;white-space:nowrap;transition:color .2s}',
      '.lgo-tab:hover{color:#0B1B3A}',
      '.lgo-tab[aria-selected="true"]{color:#0034A0;font-weight:700}',
      '.lgo-n{font-size:13px;font-weight:700;color:#0034A0;background:#E1EBFF;border-radius:999px;padding:2px 8px;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.3}',
      '.lgo-tab .lgo-n{background:#fff;box-shadow:0 0 0 1px rgba(0,52,160,.08) inset}',
      '.lgo-tab[aria-selected="true"] .lgo-n{background:#E1EBFF;box-shadow:none}',
      /* marge du bas : le bouton « + » flottant de l'application ne doit pas masquer les dernières lignes */
      '.lgo-panel{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 22px 84px}',
      '@keyframes lgo-monte{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '.lgo-panel.lgo-in>*{animation:lgo-monte .3s var(--ease,ease) both}',
      '.lgo-mini{font-size:13px;color:#586377;margin:8px 0 0;line-height:1.5}',
      '.lgo-ac-t{margin:0 0 10px}',
      /* recherche */
      '.lgo-rech{display:flex;align-items:center;gap:8px;border:1px solid #C9D6EE;border-radius:12px;padding:0 12px;background:#fff;color:#586377;transition:border-color .15s,box-shadow .15s}',
      '.lgo-rech:focus-within{border-color:#0050E6;box-shadow:0 0 0 3px rgba(0,80,230,.14)}',
      '.lgo-rech>svg{flex:none;color:#0050E6}',
      '.lgo-rech input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;color:#0B1B3A;min-height:44px;-webkit-appearance:none;appearance:none}',
      '.lgo-rech input::-webkit-search-cancel-button{-webkit-appearance:none}',
      '.lgo-rech-x{display:none;width:44px;height:44px;margin-right:-12px;border:0;background:none;color:#586377;cursor:pointer;align-items:center;justify-content:center;border-radius:12px;flex:none}',
      '.lgo-rech.plein .lgo-rech-x{display:inline-flex}',
      /* pharmacies et à compléter */
      '.lgo-list{margin:6px -8px 0}',
      '.lgo-ph,.lgo-acr{display:flex;align-items:center;gap:8px;padding:2px 8px;border-radius:12px;transition:background .15s}',
      '.lgo-ph:hover{background:#F3F7FF}',
      '.lgo-ph[hidden],.lgo-acr[hidden]{display:none}',
      '.lgo-ph a,.lgo-acr a{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;cursor:pointer;font-size:14.5px;color:#0B1B3A;min-height:52px;text-decoration:none}',
      '.lgo-ph a span,.lgo-acr a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
      '.lgo-ph small,.lgo-acr small{color:#586377;font-size:13px;font-variant-numeric:tabular-nums}',
      '.lgo-send{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 13px;border-radius:10px;border:1px solid #DCE5F5;background:#fff;color:#0034A0;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s,color .15s}',
      '.lgo-send:hover{background:#0050E6;border-color:#0050E6;color:#fff}',
      '.lgo-vide{margin:16px 6px;font-size:13.5px;color:#586377}',
      '.lgo-vide-c{text-align:left;padding:22px 2px 6px}',
      '.lgo-vide-c b{display:block;font-size:16px;color:#0B1B3A;margin-bottom:4px}',
      '.lgo-vide-c p{margin:0 0 14px;font-size:14px;color:#586377;line-height:1.5;max-width:46ch}',
      '.lgo-vide-b{min-height:44px}',
      '.lgo-acr{border-bottom:1px solid #EDF1F8;transition:opacity .25s,transform .25s,background .15s}.lgo-acr:last-of-type{border-bottom:0}',
      '.lgo-acr a{min-height:44px}',
      '.lgo-acr.lgo-sort{opacity:0;transform:translateX(18px)}',
      '.lgo-acr select{flex:none;width:156px;height:44px;border:1px solid #C9D6EE;border-radius:10px;padding:6px 9px;font:inherit;font-size:16px;color:#0B1B3A;background:#fff;cursor:pointer;-webkit-appearance:none;appearance:none;padding-right:30px;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23586377%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}',
      '.lgo-acr select:focus{outline:0;border-color:#0050E6;box-shadow:0 0 0 3px rgba(0,80,230,.14)}',
      /* pas-à-pas */
      '.lgo-prog{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:12px 14px;border:1px solid #DCE5F5;border-radius:14px;background:linear-gradient(180deg,#fff,#F8FAFF)}',
      '.lgo-prog-t{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:13.5px;color:#586377}',
      '.lgo-prog-t b{font-size:14.5px;color:#0B1B3A;font-variant-numeric:tabular-nums}',
      '.lgo-prog-b{height:6px;border-radius:6px;background:#EEF3FC;overflow:hidden}',
      '.lgo-prog-b i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#2F6DF0,#0050E6);transition:width .45s var(--ease,ease)}',
      '.lgo-steps{list-style:none;margin:14px 0 0;padding:0}',
      '.lgo-st{position:relative;display:flex;align-items:flex-start;gap:14px;width:100%;text-align:left;border:0;background:none;padding:6px 8px 18px 0;font:inherit;cursor:pointer;color:#1b2430;font-size:14.5px;line-height:1.55;border-radius:12px}',
      'li:last-child>.lgo-st{padding-bottom:6px}',
      '.lgo-st-n{position:relative;z-index:1;flex:none;width:30px;height:30px;border-radius:50%;background:linear-gradient(150deg,#2F6DF0,#0050E6 55%,#0034A0);box-shadow:0 6px 12px -6px rgba(0,52,160,.7);color:#fff;font-weight:800;font-size:13.5px;display:flex;align-items:center;justify-content:center;transition:transform .2s var(--ease,ease)}',
      '.lgo-st-n svg{display:none}',
      '.lgo-st[aria-pressed="true"] .lgo-st-n{background:#E1EBFF;color:#0034A0;box-shadow:0 0 0 2px #0050E6 inset}',
      '.lgo-st[aria-pressed="true"] .lgo-st-n svg{display:block}',
      '.lgo-st[aria-pressed="true"] .lgo-st-n span{display:none}',
      '.lgo-st[aria-pressed="true"] .lgo-st-t{color:#586377}',
      '.lgo-st:active .lgo-st-n{transform:scale(.92)}',
      '.lgo-st:after{content:"";position:absolute;left:14px;top:38px;bottom:0;width:2px;border-radius:2px;background:#DCE7FB}',
      '.lgo-st[aria-pressed="true"]:after{background:#9BC0FF}',
      'li:last-child>.lgo-st:after{display:none}',
      '.lgo-st-t{flex:1;min-width:0;padding-top:4px;transition:color .2s}',
      '.lgo-st-t b{color:#0B1B3A}.lgo-st[aria-pressed="true"] .lgo-st-t b{color:#586377}',
      '.lgo-note{margin-top:12px;background:#F3F7FF;border-radius:12px;padding:11px 13px;font-size:13.5px;color:#334155;line-height:1.5}',
      '.lgo-img{display:grid;gap:10px;margin-top:14px}.lgo-img a{display:block;border-radius:12px}',
      '.lgo-img img{width:100%;border:1px solid #DCE5F5;border-radius:10px;display:block}',
      '.lgo-img small{display:block;font-size:13px;color:#586377;margin-top:6px}',
      /* fichiers */
      '.lgo-pdf{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #DCE5F5;border-radius:14px;text-decoration:none;color:#0B1B3A;transition:border-color .15s,box-shadow .2s;min-height:64px}',
      '.lgo-pdf:hover{border-color:#9BC0FF;box-shadow:0 10px 22px -18px rgba(0,52,160,.6)}',
      '.lgo-pdf>span:nth-child(2){flex:1;min-width:0}.lgo-pdf b{display:block;font-size:14.5px}.lgo-pdf small{font-size:13px;color:#586377}',
      '.lgo-pdf>svg{flex:none;color:#0050E6;transition:transform .2s}.lgo-pdf:hover>svg{transform:translateX(3px)}',
      '.lgo-pdf-ico{flex:none;width:40px;height:40px;border-radius:10px;background:#C8102E;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;letter-spacing:.02em}',
      '.lgo-pdf-ico.mini{width:36px;height:26px;border-radius:7px}',
      '.lgo-fh,.lgo-fl{display:grid;grid-template-columns:minmax(0,1fr) 96px 96px;gap:8px;align-items:center}',
      '.lgo-fh{font-size:13px;font-weight:600;color:#586377;padding:16px 0 4px}.lgo-fh span+span{text-align:center}',
      '.lgo-fl{padding:6px 0;border-top:1px solid #EDF1F8}',
      '.lgo-topn{font-weight:700;font-size:14.5px;color:#0B1B3A;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.lgo-topn em{font-style:normal;font-size:13px;font-weight:700;color:#0034A0;background:#E1EBFF;border-radius:999px;padding:1px 8px}',
      '.lgo-fl a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;background:#EEF3FC;color:#0034A0;font-weight:700;font-size:13.5px;text-decoration:none;transition:background .15s,transform .15s}',
      '.lgo-fl a:hover{background:#DCE7FF;transform:translateY(-1px)}',
      '.lgo-fl a.csv{background:#0050E6;color:#fff}.lgo-fl a.csv:hover{background:#0034A0}',
      '.lgo-shell :focus-visible{outline:2px solid #0050E6;outline-offset:2px}',
      '@keyframes lgo-pousse-barre{from{transform:scaleX(0)}to{transform:none}}',
      '.lgo-neuf .lgo-barre i{animation:lgo-pousse-barre .7s var(--ease,ease) both}',
      /* Téléphone et tablette : la colonne de gauche est l\'écran d\'entrée, le détail arrive par la droite */
      '@media (max-width:900px){',
      '.lgo-shell.v2-wrap{display:block;height:auto;min-height:0;max-width:none;padding:12px 14px 64px;overflow-x:clip}',
      '.lgo-side,.lgo-main{display:block;overflow:clip;min-height:0;border-radius:18px}',
      '.lgo-shell[data-ecran="detail"] .lgo-side{display:none}',
      '.lgo-shell[data-ecran="liste"] .lgo-main{display:none}',
      '.lgo-shell[data-ecran="liste"] .lgo-l[aria-current="true"]{background:none}.lgo-shell[data-ecran="liste"] .lgo-l[aria-current="true"] .lgo-l-n{color:#0B1B3A}',
      '.lgo-side-list{overflow:visible;padding:8px 8px 10px}',
      '.lgo-l{min-height:60px;grid-template-columns:minmax(0,1fr) auto 18px;grid-template-areas:"n c v" "e c v" "b b v"}',
      '.lgo-l.zero{grid-template-areas:"n c v" "e c v"}',
      '.lgo-l.att{grid-template-columns:minmax(0,1fr);grid-template-areas:"n" "e"}',
      '.lgo-chev{display:flex;grid-area:v;align-self:center;justify-self:end;color:#8693AD}',
      '.lgo-main-head{padding:12px 16px 0}',
      '.lgo-backm{display:inline-flex;align-items:center;gap:4px;min-height:44px;margin:0 0 2px -10px;padding:0 12px 0 6px;border:0;background:none;font:inherit;font-size:14.5px;font-weight:700;color:#0034A0;cursor:pointer;border-radius:10px}',
      '.lgo-mh h2{font-size:24px}',
      '.lgo-tabs-w{position:sticky;top:var(--lgo-stick,0px);z-index:5;padding:10px 12px 8px;border-bottom:1px solid #EDF1F8}',
      '.lgo-tab{padding:0 6px;font-size:13.5px;gap:6px}',
      '.lgo-panel{overflow:visible;padding:12px 14px 84px}',
      '@keyframes lgo-arrive{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}',
      '@keyframes lgo-revient{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}',
      '.lgo-main.lgo-arrive{animation:lgo-arrive .3s var(--ease,ease)}',
      '.lgo-side.lgo-revient{animation:lgo-revient .26s var(--ease,ease)}',
      '}',
      '@media (max-width:520px){.lgo-tab .lgo-n{display:none}}',
      '@media (max-width:420px){.lgo-fh,.lgo-fl{grid-template-columns:minmax(0,1fr) 80px 80px}.lgo-send span{display:none}.lgo-send{width:44px;padding:0;justify-content:center}.lgo-acr select{width:136px}}',
      '@media (prefers-reduced-motion:reduce){.lgo-main.lgo-arrive,.lgo-side.lgo-revient,.lgo-panel.lgo-in>*,.lgo-bump,.lgo-neuf .lgo-barre i{animation:none}.lgo-tabs-i,.lgo-prog-b i,.lgo-acr{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // La hauteur réelle de la barre du haut règle la hauteur de l'écran fixe et la position des onglets collants.
  function mesurerTop() {
    var w = document.querySelector('.lgo-shell'), t = document.querySelector('.v2-top');
    if (!w || !t) return;
    w.style.setProperty('--lgo-top', t.offsetHeight + 'px');
    // Les onglets collants se posent sous la barre seulement si elle est elle-même collante (sinon elle défile et part).
    w.style.setProperty('--lgo-stick', (getComputedStyle(t).position === 'sticky' ? t.offsetHeight : 0) + 'px');
  }
  var resizeBranche = false;

  V2.lgoReseau = function (v) { S.reseau = !!v; V2.render(); };
  V2.lgoPoser = function (el) {
    var pid = el.getAttribute('data-pid'), v = el.value;
    if (!v || !pid || !V2.profil || !V2.profil.poser) return;
    if (!V2.user) { if (V2.toast) V2.toast('Connectez-vous pour enregistrer'); el.value = ''; return; }
    el.disabled = true;
    V2.profil.poser('client', pid, 'lgo', v).then(function () {
      (S.saisie = S.saisie || {})[pid] = v;
      if (V2.toast) V2.toast('Enregistré : ' + v);
      var row = el.closest ? el.closest('.lgo-acr') : null;
      // La pharmacie quitte la liste et rejoint son logiciel ; les positions de défilement sont gardées par render.
      if (row && !reduit()) { row.classList.add('lgo-sort'); setTimeout(function () { V2.render(); }, 260); } else V2.render();
    }, function () { el.disabled = false; if (V2.toast) V2.toast('Enregistrement impossible, réessayez', 'error'); });
  };
  // Filtre sur place : rien n'est redessiné, les lignes qui ne correspondent pas sont masquées.
  V2.lgoFiltrer = function (el, cible) {
    var q = String(el.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    var box = document.getElementById(cible); if (!box) return;
    S.q[cible] = el.value;
    if (el.closest) { var lab = el.closest('.lgo-rech'); if (lab) lab.classList.toggle('plein', !!el.value); }
    var vus = 0;
    [].forEach.call(box.querySelectorAll('[data-q]'), function (r) {
      var t = r.getAttribute('data-q'), okk = q.every(function (m) { return t.indexOf(m) >= 0; });
      r.hidden = !okk; if (okk) vus++;
    });
    var v = box.querySelector('.lgo-vide'); if (v) v.hidden = vus > 0;
  };
  V2.lgoEffacer = function (b) {
    var inp = b.parentNode.querySelector('input'); if (!inp) return;
    inp.value = ''; V2.lgoFiltrer(inp, inp.getAttribute('data-filtre')); inp.focus();
  };
  // Ouvre « Choisir quoi lui transmettre » pour cette pharmacie, catalogue du logiciel déjà coché.
  V2.lgoEnvoyer = function (pid, s) { if (V2.pharmaTxCatalogue) V2.pharmaTxCatalogue(pid, s); };

  // Changer d'onglet ne redessine pas l'écran : seul le contenu change, le curseur glisse.
  V2.lgoOnglet = function (t) {
    if (ONGLETS.indexOf(t) < 0 || !S.ctx || !S.ctx.cur) return;
    var tabs = document.querySelector('.lgo-tabs'), panel = document.getElementById('lgo-panel');
    if (!tabs || !panel) return;
    if (S.tab === t && panel.getAttribute('data-t') === t) return;
    S.tab = t; S.q = {};
    tabs.style.setProperty('--i', ONGLETS.indexOf(t));
    [].forEach.call(tabs.querySelectorAll('.lgo-tab'), function (b) {
      var on = b.getAttribute('data-t') === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
    });
    panel.innerHTML = panneau(); panel.setAttribute('data-t', t); panel.scrollTop = 0;
    panel.classList.remove('lgo-in'); void panel.offsetWidth; panel.classList.add('lgo-in');
  };
  V2.lgoOngletTouche = function (ev) {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    var ts = [].slice.call(document.querySelectorAll('.lgo-tab')), i = ts.indexOf(ev.target); if (i < 0) return;
    var n = ts[(i + (ev.key === 'ArrowRight' ? 1 : ts.length - 1)) % ts.length];
    n.focus(); n.click(); ev.preventDefault();
  };
  // Étapes cochées avec le pharmacien : le temps de la séance, rien n'est enregistré.
  V2.lgoEtape = function (i) {
    var l = S.ctx && S.ctx.cur; if (!l) return;
    var fait = S.fait[l.s] = S.fait[l.s] || {};
    if (fait[i]) delete fait[i]; else fait[i] = true;
    var b = document.querySelectorAll('.lgo-st')[i]; if (b) b.setAttribute('aria-pressed', !!fait[i]);
    var nb = Object.keys(fait).length, tot = l.etapes.length;
    var t = document.getElementById('lgo-prog-n'), g = document.getElementById('lgo-prog-i');
    if (t) t.textContent = nb ? (nb === tot ? 'Terminé : ' + tot + ' étapes sur ' + tot : 'Étape ' + nb + ' sur ' + tot) : pl(tot, 'étape') + ', côté pharmacien';
    if (g) g.style.width = Math.round(nb * 100 / tot) + '%';
  };

  V2.pages.lgo = {
    needs: ['clientsactifs'],
    render: function (root, param) {
      if (window.V2_BRAND && (window.V2_BRAND.escale || window.V2_BRAND.opso)) { V2.go('home'); return; }   // rubrique Intégral seulement
      css();
      chargerSaisie();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      var L0 = data().lgo || [];
      if (!L0.length) { root.innerHTML = top + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">Données des logiciels indisponibles</div></div></div>'; return; }
      var R = repartition();
      var L = L0.slice().sort(function (a, b) { return (R.par[b.s] || []).length - (R.par[a.s] || []).length; });   // tri stable : le plus présent d'abord
      var ac = param === 'ac';
      var trouve = L.filter(function (l) { return l.s === param; })[0];
      var cur = ac ? null : (trouve || L[0]);   // sans choix : le logiciel le plus présent (ordinateur)
      var ecran = (ac || trouve) ? 'detail' : 'liste';   // téléphone : sans choix, on voit la liste
      var c = comptes(L, R), n = cur ? c[cur.s] : 0;
      // Le mouvement ne se joue que quand quelque chose change vraiment (pas à chaque redessin).
      var cle = ac ? 'ac' : cur.s, neuf = !S.vu, change = S.vu !== cle, ecranChange = S.ecran !== null && S.ecran !== undefined && S.ecran !== ecran;
      var bump = function (k) { return (S.nb && S.nbScope === R.miennes && S.nb[k] !== undefined && S.nb[k] !== c[k]) ? ' lgo-bump' : ''; };
      if (change) { S.tab = 'ph'; S.q = {}; }
      // Arrivée depuis « Voir le pas-à-pas » (Transmettre) : on ouvre l'onglet demandé, une seule fois.
      if (V2.lgoOuvrirSur) { if (cur && ONGLETS.indexOf(V2.lgoOuvrirSur) >= 0) S.tab = V2.lgoOuvrirSur; V2.lgoOuvrirSur = null; }
      // Positions de défilement : la liste de gauche reste en place ; le contenu aussi tant que l'on reste sur le même logiciel.
      var oS = root.querySelector('.lgo-side-list'), oP = root.querySelector('.lgo-panel');
      var sv = { s: oS ? oS.scrollTop : 0, p: (oP && !change) ? oP.scrollTop : 0, w: (!change && !ecranChange && oP) ? window.scrollY : null };
      S.ctx = { cur: cur, R: R };
      root.innerHTML = top + '<div class="v2-wrap lgo-shell' + (neuf ? ' lgo-neuf' : '') + '" data-ecran="' + ecran + '">' +
        '<section class="lgo-side' + (ecranChange && ecran === 'liste' ? ' lgo-revient' : '') + '" aria-label="Logiciels">' + tete(L, R, c, bump) +
          '<nav class="lgo-side-list" aria-label="Choisir un logiciel">' + liste(L, R, c, cur, ac, bump) + '</nav></section>' +
        '<section class="lgo-main' + (ecranChange && ecran === 'detail' ? ' lgo-arrive' : '') + '" aria-label="Détail">' +
          '<div class="lgo-main-head">' + entete(cur, R, n) + '</div>' + (cur ? onglets(cur, n) : '') +
          '<div class="lgo-panel' + (change ? ' lgo-in' : '') + '" id="lgo-panel" data-t="' + (cur ? S.tab : 'ac') + '"' + (cur ? ' role="tabpanel"' : '') + '>' + panneau() + '</div></section>' +
      '</div>';
      S.vu = cle; S.ecran = ecran; S.nb = c; S.nbScope = R.miennes;
      mesurerTop();
      if (!resizeBranche) { resizeBranche = true; window.addEventListener('resize', mesurerTop); }
      var nS = root.querySelector('.lgo-side-list'), nP = root.querySelector('.lgo-panel');
      if (nS) nS.scrollTop = sv.s;
      if (nP) nP.scrollTop = sv.p;
      if (sv.w !== null) window.scrollTo(0, sv.w);
      // La recherche en cours survit à un redessin (arrivée de la saisie de l'équipe, par exemple).
      [].forEach.call(root.querySelectorAll('input[data-filtre]'), function (inp) {
        var q = S.q[inp.getAttribute('data-filtre')]; if (q) { inp.value = q; V2.lgoFiltrer(inp, inp.getAttribute('data-filtre')); }
      });
    }
  };
})();
