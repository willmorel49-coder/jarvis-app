/* PHIRST · écrans « Officines » (« Officines ») et « La carte » (21/11/2026), portés de la V1 (~/phirst-studio) :
   app/crm/officines/page.tsx + components/crm/OfficinesListe.tsx (maquette m1 « Les angles en grand »), app/crm/carte/page.tsx +
   components/CrmMap.tsx / OfficinesMap.tsx (choix de Will du 29/10/2026 : Cibles et épingles, seuils de zoom « Masquer et le dire »).
   Les données ne sont PAS des fichiers : elles vivent dans la table phirst_officines (chargée par le Mac, voir officines-table.sql),
   lue par recherche côté base (filtres + range + count=exact) : l'iPhone ne reçoit que 10 à 30 lignes à la fois.
   Droits : la base filtre (RLS). La téléprospectrice ne reçoit jamais une somme : les textes d'argent sont dans phirst_officines_montants,
   que seuls les membres lisent ; ici on ne les demande que si l'on n'est pas elle, et on retire par prudence tout texte d'argent restant.
   « Ajouter » = window.PHIRST_PISTE.ajouter (phirst-ligne.js) : membre = insert dans son espace, téléprospectrice = telepro_creer_piste.
   Logique pure et testée : phirst-pur.js (requeteOfficines, pisteDeLigne, fusionnerSommes, sansSommes, couchesMasquees…). */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, V2 = window.V2;
  if (!P || !V2) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var FAIT = ['Ajoutée à vos pistes.', 'Déjà dans vos pistes.'];
  var COLS = 'cle,angle,nom,nom_affiche,ville,cp,dep,lat,lon,pharmacien,telephone,email,groupements,sous,etiquettes,pourquoi,sieges,annonce,score,fab,cat,robot_modele,tt_type,tt_date,n_ehpad,ehpad_proches,cles';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }
  function appliquer(q, filtres) { filtres.forEach(function (f) { q = q[f[0]](f[1], f[2]); }); return q; }
  function manque(err) { return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(String(err.message || ''))); }
  function estTelepro() { return window.PHIRST_ROLE ? window.PHIRST_ROLE.estTelepro() : Promise.resolve(false); }

  /* ── Ce que les deux écrans partagent : les pistes du compte (anti-doublon et épingles), les sommes (membres seulement), le méta. ── */
  var C = { pour: null, pistes: null, sommes: null, meta: null };
  function oublier() { C = { pour: null, pistes: null, sommes: null, meta: null }; }
  function verifierCompte() { var id = V2.user && V2.user.id; if (C.pour !== id) { oublier(); C.pour = id; } }
  /* Membre : toutes les fiches de son espace, par tranches de 1 000 (la base plafonne chaque réponse). Elle : telepro_pistes. */
  function lirePistes(forcer) {
    verifierCompte();
    if (C.pistes && !forcer) return C.pistes;
    var b = sb(); if (!b) return Promise.resolve(null);
    var p = estTelepro().then(function (t) {
      if (t) return b.rpc('telepro_pistes').then(function (r) { return r.error || !Array.isArray(r.data) ? null : r.data; });
      var out = [];
      function page(de) {
        return b.from('crm_prospects').select('id,nom,ville,cp,lat,lon,stage,source,telephone,next_action,next_action_date').order('id').range(de, de + 999).then(function (r) {
          if (r.error) return null;
          out = out.concat(r.data || []);
          return (r.data || []).length < 1000 ? out : page(de + 1000);
        });
      }
      return page(0);
    }).then(null, function () { return null; });
    C.pistes = p; p.then(function (v) { if (v === null && C.pistes === p) C.pistes = null; });
    return p;
  }
  /* Les textes d'argent : une petite table, lue UNE fois, jamais par la téléprospectrice (la base la lui refuserait de toute façon). */
  function lireSommes() {
    verifierCompte();
    if (C.sommes) return C.sommes;
    var b = sb(); if (!b) return Promise.resolve({});
    C.sommes = estTelepro().then(function (t) {
      if (t) return null;
      return b.from('phirst_officines_montants').select('cle,champ,texte').range(0, 999).then(function (r) {
        var m = {}; if (r.error) return m;
        (r.data || []).forEach(function (x) { (m[x.cle] = m[x.cle] || {})[x.champ] = x.texte; });
        return m;
      });
    }).then(null, function () { return {}; });
    return C.sommes;
  }
  /* Une ligne de la table, prête à afficher : sommes remises (membre) ou retirées (téléprospectrice). */
  function finir(rows, sommes) {
    return (rows || []).map(function (l) { return sommes === null ? P.sansSommes(l) : P.fusionnerSommes(l, sommes[l.cle]); });
  }
  function lireMeta() {
    verifierCompte();
    if (C.meta) return C.meta;
    var b = sb(); if (!b) return Promise.resolve({});
    C.meta = b.from('phirst_officines_meta').select('cle,valeur').then(function (r) {
      var m = {}; (r.data || []).forEach(function (x) { m[x.cle] = x.valeur; }); return m;
    }).then(null, function () { return {}; });
    return C.meta;
  }
  function compter(filtres) {
    var b = sb(); if (!b) return Promise.resolve(null);
    return appliquer(b.from('phirst_officines').select('cle', { count: 'exact', head: true }), filtres).then(function (r) { return r.error ? null : r.count; }, function () { return null; });
  }
  function pastilles(l) {
    return (l.etiquettes || []).map(function (e) { return '<em class="lg-et"' + (e.ton ? ' data-ton="' + esc(e.ton) + '"' : '') + '>' + esc(e.texte) + '</em>'; }).join(' ');
  }

  /* ════════════════════════ OFFICINES ════════════════════════ */
  var S = { racine: null, jeton: 0, angle: 'toutes', france: false, q: '', dep: '', fab: '', lignes: [], total: null, erreur: '', charge: false,
    tuiles: {}, meta: {}, ix: {}, faits: {}, tel: false };

  function aide() {
    return { robots: 'Officines équipées d’un robot concurrent : de bonnes candidates pour le remplacer.',
      ehpad: 'Officines proches d’EHPAD : elles peuvent avoir besoin de la préparation des doses (PDA, Farmadosis).',
      transferts: 'Cessions et créations d’officines (annonces légales, environ 2 ans) : une pharmacie qui change de main ou qui ouvre réaménage.',
      signaux: 'Le croisement de toutes les sources : cession récente, potentiel de la zone, EHPAD autour, accessibilité PMR, automate déjà posé. Chaque ligne porte les faits qui la justifient — on n’appelle jamais sans pouvoir dire pourquoi.' }[S.angle] || '';
  }
  function chargerTuiles() {
    P.ANGLES.forEach(function (a) {
      var base = [['eq', 'angle', a.cle]];
      compter(base.concat([['eq', 'dans_secteur', true]])).then(function (n) { (S.tuiles[a.cle] = S.tuiles[a.cle] || {}).secteur = n; dessinerTuiles(); });
      compter(base).then(function (n) { (S.tuiles[a.cle] = S.tuiles[a.cle] || {}).france = n; dessinerTuiles(); });
    });
  }
  function nombre(n) { return n == null ? '…' : n.toLocaleString('fr-FR'); }
  function dessinerTuiles() {
    var z = S.racine && S.racine.querySelector('#po-tuiles'); if (!z) return;
    z.innerHTML = P.ANGLES.map(function (a) {
      var t = S.tuiles[a.cle] || {};
      return '<button type="button" class="po-tuile" data-angle="' + a.cle + '" aria-pressed="' + (S.angle === a.cle) + '"><span class="po-n">' + nombre(t.secteur) + '</span><span class="po-nom">' + esc(a.nom) +
        '</span><span class="po-sous">sur ' + nombre(t.france) + ' en France</span></button>';
    }).join('');
  }
  function dessinerReglages() {
    var z = S.racine && S.racine.querySelector('#po-reglages'); if (!z) return;
    var filtres = S.angle === 'robots' ? [{ k: '', l: 'Tous' }].concat((S.meta.fabs || []).map(function (f) { return { k: f.key, l: f.label + ' (' + f.n + ')' }; }))
      : S.angle === 'signaux' ? P.FILTRES_SIGNAUX : S.angle === 'transferts' ? P.FILTRES_TRANSFERTS : [];
    var savoir = '';
    if (S.angle === 'transferts') savoir = 'Les déménagements ARS purs ne sont pas dans BODACC.';
    else if (S.angle === 'signaux') savoir = (S.meta.signaux_calcule_le ? 'Calculé le ' + P.frDate(S.meta.signaux_calcule_le) + '. ' : '') +
      'L’accessibilité vient d’Acceslibre, service public participatif : une non-conformité déclarée il y a deux ans a pu être corrigée depuis — on appelle pour demander, jamais pour affirmer.';
    z.innerHTML = '<div class="po-secteur"><div class="pa-chips" role="group" aria-label="Périmètre">' +
      '<button type="button" class="pa-chip" data-sect="only" aria-pressed="' + (!S.france) + '">Secteur de Yann</button>' +
      '<button type="button" class="pa-chip" data-sect="france" aria-pressed="' + S.france + '">Toute la France</button></div>' +
      '<p class="po-aide">' + (S.france ? 'Votre secteur d’abord, puis le reste de la France.' : 'Grand Ouest par priorité : ' + esc(P.SECTEUR.join(' · '))) + '</p></div>' +
      (aide() ? '<p class="po-aide">' + esc(aide()) + '</p>' : '') +
      (savoir ? '<details class="po-savoir"><summary>À savoir</summary><p>' + esc(savoir) + '</p></details>' : '') +
      (filtres.length ? '<div class="pa-chips po-sf" role="group" aria-label="Affiner la liste">' + filtres.map(function (f) {
        return '<button type="button" class="pa-chip" data-fab="' + esc(f.k) + '" aria-pressed="' + (S.fab === f.k) + '">' + esc(f.l) + '</button>'; }).join('') + '</div>' : '');
  }
  function htmlLigne(l, i) {
    var ficheId = P.ficheSuivie(l, S.ix), f = S.faits[l.cle] || '';
    var pour = P.pourquoiAffiche(l);
    var action = ficheId
      ? '<span class="po-fait" role="status">✓ ' + (FAIT.indexOf(f) === 1 ? 'Déjà dans vos pistes' : 'Dans vos pistes') + '</span><button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button>'
      : '<button type="button" class="pa-b pa-ok" data-ajout="1" aria-label="Ajouter ' + esc(l.nom_affiche || l.nom) + ' à mes pistes">Ajouter à mes pistes</button>';
    return '<li class="pa-l" data-i="' + i + '"><div class="pa-ht"><div><b>' + esc(l.nom_affiche || l.nom) + '</b><small>' + esc(P.sousAffiche(l)) + '</small></div><div class="po-et">' + pastilles(l) + '</div></div>' +
      (pour.length ? '<ul class="pa-au">' + pour.map(function (r) { return '<li>→ ' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="pa-bs">' + (P.lienSur(l.annonce) ? '<a class="pa-b" href="' + esc(P.lienSur(l.annonce)) + '" target="_blank" rel="noopener">Voir l’annonce</a>' : '') + action + '</div>' +
      '<p class="pa-dit" role="status">' + (ficheId ? '' : esc(f)) + '</p></li>';
  }
  function dessinerListe() {
    var z = S.racine && S.racine.querySelector('#po-liste'); if (!z) return;
    var h = '';
    if (S.erreur) h = '<div class="pa-vide"><p>' + esc(S.erreur) + '</p><button type="button" class="lg-gros" data-reessayer="1">Réessayer</button></div>';
    else if (S.total === null) h = '<p class="pa-avis">Chargement…</p>';
    else {
      var plus = P.libelleVoirPlus(S.total, S.lignes.length);
      h = '<h2 class="po-h2">' + esc(P.nomAngle(S.angle)) + (S.total === 0 ? '' : ' · ' + P.libelleResultats(S.total)) + '</h2>' +
        (P.releveAffiche(S.meta.charge_le, P.aujourdhui()) ? '<p class="po-aide">' + esc(P.releveAffiche(S.meta.charge_le, P.aujourdhui())) + '</p>' : '') +
        (S.total === 0 ? '<div class="pa-vide"><p>' + (S.france ? 'Aucune pharmacie de France ne correspond à cette recherche. Essayez une partie du nom seulement, ou la ville.'
            : 'Aucune pharmacie du secteur de Yann ne correspond. Elle est peut-être ailleurs en France.') + '</p>' +
            (S.france ? '' : '<button type="button" class="lg-gros" data-france-q="1">Chercher dans toute la France</button> ') +
            '<button type="button" class="' + (S.france ? 'lg-gros' : 'pa-b') + '" data-effacer="1">Effacer la recherche</button></div>'
          : '<ul class="pa-liste">' + S.lignes.map(htmlLigne).join('') + '</ul>') +
        (plus ? '<button type="button" class="pa-b po-plus" data-plus="1"' + (S.charge ? ' disabled' : '') + '>' + esc(plus) + '</button>' : '');
    }
    z.innerHTML = h;
  }
  function vue() { return { angle: S.angle, france: S.france, q: S.q, dep: S.dep, fab: S.fab }; }
  /* Lit une page de la liste : la première (10) remet tout à zéro ; « Voir 30 de plus » ajoute à la suite sans rien relire. */
  function lirePage(debut) {
    var b = sb(), tok = S.jeton;
    var nb = debut === 0 ? P.N_INITIAL : P.PAS_LISTE;
    var q = appliquer(b.from('phirst_officines').select(COLS, debut === 0 ? { count: 'exact' } : undefined), P.requeteOfficines(vue())).order('tri', { ascending: true }).range(debut, debut + nb - 1);
    return Promise.all([q, lireSommes()]).then(function (r) {
      if (tok !== S.jeton) return;
      var res = r[0];
      if (res.error) { S.erreur = manque(res.error) ? 'Cette liste n’est pas encore chargée dans la base. Elle arrive avec la prochaine mise à jour.' : 'La liste ne s’est pas chargée. Vérifiez votre connexion puis réessayez.'; S.charge = false; dessinerListe(); return; }
      var nouvelles = finir(res.data, r[1]);
      if (debut === 0) { S.lignes = nouvelles; S.total = res.count == null ? nouvelles.length : res.count; } else S.lignes = S.lignes.concat(nouvelles);
      S.charge = false; S.erreur = ''; dessinerListe();
    }, function () { if (tok === S.jeton) { S.erreur = 'La liste ne s’est pas chargée. Vérifiez votre connexion puis réessayez.'; S.charge = false; dessinerListe(); } });
  }
  function recharger() { S.jeton++; S.lignes = []; S.total = null; S.erreur = ''; S.charge = false; dessinerReglages(); dessinerTuiles(); dessinerListe(); if (sb()) lirePage(0); else { S.erreur = 'Connectez-vous pour voir les officines.'; dessinerListe(); } }
  function clicOfficines(ev) {
    var t = ev.target, g;
    if ((g = t.closest('[data-vers]'))) { V2.go(g.getAttribute('data-vers')); return; }
    if ((g = t.closest('[data-angle]'))) { S.angle = g.getAttribute('data-angle'); S.fab = ''; S.q = ''; S.dep = ''; var f = S.racine.querySelector('#po-form'); if (f) { f.q.value = ''; f.dep.value = ''; } recharger(); return; }
    if ((g = t.closest('[data-sect]'))) { S.france = g.getAttribute('data-sect') === 'france'; S.fab = ''; S.q = ''; S.dep = ''; var f2 = S.racine.querySelector('#po-form'); if (f2) { f2.q.value = ''; f2.dep.value = ''; } recharger(); return; }
    if ((g = t.closest('[data-fab]'))) { S.fab = g.getAttribute('data-fab'); recharger(); return; }
    if (t.closest('[data-france-q]')) { S.france = true; recharger(); return; }
    if (t.closest('[data-effacer]')) { S.q = ''; S.dep = ''; var f3 = S.racine.querySelector('#po-form'); if (f3) { f3.q.value = ''; f3.dep.value = ''; } recharger(); return; }
    if (t.closest('[data-reessayer]')) { S.erreur = ''; S.total = null; dessinerListe(); lirePage(S.lignes.length ? S.lignes.length : 0); return; }
    if (t.closest('[data-plus]')) { if (S.charge) return; S.charge = true; dessinerListe(); lirePage(S.lignes.length); return; }
    var bt = t.closest('[data-ajout]'), li = t.closest('.pa-l');
    if (bt && li) {
      var l = S.lignes[+li.getAttribute('data-i')], dit = li.querySelector('.pa-dit');
      if (!l || !window.PHIRST_PISTE) { dit.textContent = PAS; return; }
      bt.disabled = true; dit.textContent = '';
      window.PHIRST_PISTE.ajouter(P.pisteDeLigne(l)).then(function (m) {
        S.faits[l.cle] = m;
        if (FAIT.indexOf(m) >= 0) { S.ix[P.cle(l.nom_affiche || l.nom, l.ville)] = S.ix[P.cle(l.nom_affiche || l.nom, l.ville)] || 'nouvelle'; C.pistes = null; var d = document.createElement('div'); d.innerHTML = htmlLigne(l, +li.getAttribute('data-i')); li.replaceWith(d.firstChild); } else { dit.textContent = m; bt.disabled = false; }
      });
    }
  }
  function soumettre(ev) {
    if (ev.target.id !== 'po-form') return;
    ev.preventDefault();
    S.q = ev.target.q.value; S.dep = ev.target.dep.value; recharger();
  }
  V2.pages.officines = { needs: [], render: function (root) {
    S.racine = root;
    root.innerHTML = window.PHIRST_ECRAN.cadre('<section class="pa po" aria-label="Officines"><header class="pa-tete"><h1>Officines</h1>' +
      '<p>Les pharmacies à appeler, du secteur de Yann d’abord. Celles que vous ajoutez arrivent dans vos pistes, à qualifier.</p></header>' +
      '<div class="po-grille" id="po-tuiles" role="group" aria-label="Listes d’officines"></div><div id="po-reglages"></div>' +
      '<form class="po-recherche" id="po-form" role="search"><input type="text" name="q" placeholder="Rechercher (nom, ville…)" aria-label="Rechercher" autocomplete="off" enterkeyhint="search" value="' + esc(S.q) + '">' +
      '<input type="text" name="dep" class="po-dep" placeholder="Dépt" aria-label="Filtrer par département" inputmode="numeric" autocomplete="off" maxlength="5" value="' + esc(S.dep) + '">' +
      '<button type="submit" class="pa-b pa-ok">Filtrer</button></form><div id="po-liste"></div></section>');
    if (!root.__po) { root.__po = true; root.addEventListener('click', clicOfficines); root.addEventListener('submit', soumettre); }
    S.tuiles = {}; S.faits = {};
    Promise.all([lireMeta(), lirePistes(true)]).then(function (r) {
      if (S.racine !== root) return;
      S.meta = r[0] || {}; S.ix = P.indexPistes(r[1] || []);
      dessinerReglages(); dessinerListe();
      if (S.total !== null) { /* liste déjà chargée : on la redessine avec l'anti-doublon à jour */ }
    });
    chargerTuiles(); recharger();
  } };

  /* ════════════════════════ LA CARTE ════════════════════════ */
  var COUL = { robots: '#C2410C', omnicell: '#DC2626', ehpad: '#7C3AED', transferts: '#1D4ED8', signaux: '#12A567', toutes: '#1A3A2E' };
  var NOMS_COUCHE = { toutes: 'officines', robots: 'robots', ehpad: 'EHPAD', transferts: 'transferts', signaux: 'à saisir maintenant' };
  var LIB_COUCHE = { fiches: 'Mes fiches', robots: 'Robots concurrents', transferts: 'Cessions et créations', ehpad: 'Fournisseurs EHPAD', signaux: 'À saisir maintenant', toutes: 'Toutes les officines' };
  var ORDRE = ['fiches', 'robots', 'transferts', 'ehpad', 'signaux', 'toutes'];
  var SECTEUR_BORNES = [[46.2, -5.3], [49.8, 1.2]];
  var CAP_PAGES = 4;
  var M = { racine: null, map: null, perim: 'only', on: { fiches: true, robots: true, transferts: true, ehpad: true, signaux: false, toutes: false },
    groupes: {}, lignes: {}, ix: {}, pistes: [], sommes: null, jeton: 0, minuteur: 0, totaux: {}, vus: {}, plafond: false, fab: '', meta: {} };

  function chargerLeaflet(cb) {
    function css(h) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); }
    if (window.L) { cb(true); return; }
    css('../../crm/v2/vendor/leaflet/leaflet.css');
    var s = document.createElement('script'); s.src = '../../crm/v2/vendor/leaflet/leaflet.js';
    s.onload = function () { cb(!!window.L); }; s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  function poserFond(map) {
    var L = window.L, ign = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.ign.fr">IGN</a> — Géoplateforme &middot; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    L.tileLayer(ign, { maxZoom: 7 }).addTo(map);
    [[42.2, -8.5, 51.8, 10], [41.2, 8.3, 43.2, 10], [2, -64, 19, -50], [-22, 44, -11, 56.5]].forEach(function (e) {
      L.tileLayer(ign, { minZoom: 8, maxZoom: 19, bounds: L.latLngBounds([e[0], e[1]], [e[2], e[3]]) }).addTo(map);
    });
  }
  function coordOk(la, lo) { return typeof la === 'number' && typeof lo === 'number' && la > -22 && la < 52 && lo > -64 && lo < 56; }
  function filtresCouche(a) { return P.requeteOfficines({ angle: a, france: M.perim === 'france', fab: a === 'robots' ? M.fab : '' }); }

  /* Bandeau SUR la carte (choix m1) : dit ce que la vue trop large ne dessine pas, avec un bouton pour s'en approcher ; sinon ce qui est dans la vue. */
  function dire(ton, phrase, bouton) {
    var el = M.racine && M.racine.querySelector('#po-bandeau'); if (!el) return;
    el.setAttribute('data-ton', ton);
    el.innerHTML = '<p>' + esc(phrase) + '</p>' + (bouton ? '<button type="button" class="po-bouton" data-zoomer="1">' + esc(bouton) + '</button>' : '');
    el.hidden = !phrase;
  }
  function couchesActives() { return ORDRE.filter(function (k) { return k !== 'fiches' && M.on[k]; }); }
  function totalCouche(a) {
    var cle = M.perim + '|' + a + '|' + (a === 'robots' ? M.fab : '');
    if (M.totaux[cle] !== undefined) return Promise.resolve(M.totaux[cle]);
    return compter(filtresCouche(a)).then(function (n) { if (n !== null) M.totaux[cle] = n; return n || 0; });
  }
  function vider(a) { if (M.groupes[a]) M.groupes[a].clearLayers(); }
  function popupLigne(l) {
    var pour = P.pourquoiAffiche(l);
    return '<div class="po-pop"><b>' + esc(l.nom_affiche || l.nom) + '</b><small>' + esc(P.sousAffiche(l)) + '</small>' + '<div>' + pastilles(l) + '</div>' +
      (pour.length ? '<ul>' + pour.map(function (r) { return '<li>→ ' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
      '<button type="button" class="pa-b pa-ok" data-ajout-carte="' + esc(l.cle) + '">Ajouter à mes pistes</button><p class="pa-dit" role="status"></p></div>';
  }
  function couleurLigne(l) { return l.angle === 'robots' ? (l.cat === 'omnicell' ? COUL.omnicell : COUL.robots) : COUL[l.angle] || COUL.toutes; }
  function tracerLignes(a, rows) {
    var L = window.L, g = M.groupes[a]; g.clearLayers();
    var n = 0;
    rows.forEach(function (l) {
      if (!coordOk(l.lat, l.lon) || P.ficheSuivie(l, M.ix)) return;
      M.lignes[l.cle] = l;
      var big = a === 'robots' || a === 'transferts' || a === 'signaux';
      L.circleMarker([l.lat, l.lon], { radius: a === 'toutes' ? 4 : big ? 8 : 7, weight: 2, color: '#fff', fillColor: couleurLigne(l), fillOpacity: 1 }).bindPopup(popupLigne(l), { minWidth: 220 }).addTo(g);
      n++;
    });
    return n;
  }
  /* Les lignes d'une couche, DANS LA VUE : tranches de 1 000, plafonnées (le bandeau le dit). */
  function lireCouche(a, tok, bornes) {
    var b = sb(), out = [];
    function page(i) {
      var q = appliquer(b.from('phirst_officines').select(COLS), filtresCouche(a)).gte('lat', bornes.getSouth()).lte('lat', bornes.getNorth()).gte('lon', bornes.getWest()).lte('lon', bornes.getEast())
        .order('tri', { ascending: true }).range(i * 1000, i * 1000 + 999);
      return q.then(function (r) {
        if (tok !== M.jeton || r.error) return null;
        out = out.concat(r.data || []);
        if ((r.data || []).length < 1000) return out;
        if (i + 1 >= CAP_PAGES) { M.plafond = true; return out; }
        return page(i + 1);
      });
    }
    return page(0);
  }
  function actualiser() {
    if (!M.map) return;
    var tok = ++M.jeton, zoom = M.map.getZoom(), masque = P.couchesMasquees(zoom, M.perim), actives = couchesActives();
    M.plafond = false;
    if (M.on.fiches) tracerPistes(); else if (M.groupes.fiches) M.groupes.fiches.clearLayers();
    if (masque) {
      actives.forEach(vider);
      Promise.all(actives.map(function (a) { return totalCouche(a).then(function (n) { return { nom: NOMS_COUCHE[a], n: n }; }); })).then(function (couches) {
        if (tok !== M.jeton) return;
        var ph = P.phraseCachee(couches);
        dire('alerte', ph || 'Vue trop large : zoomez pour voir les points.', P.libelleBouton(M.perim));
      });
      return;
    }
    if (!actives.length) { dire('ok', ''); return; }
    var bornes = M.map.getBounds().pad(0.1), faits = [];
    Promise.all([lireSommes()].concat(actives.map(function (a) {
      return lireCouche(a, tok, bornes).then(function (rows) { return { a: a, rows: rows }; });
    }))).then(function (r) {
      if (tok !== M.jeton) return;
      var sommes = r[0];
      r.slice(1).forEach(function (c) {
        if (!c.rows) return;
        var n = tracerLignes(c.a, finir(c.rows, sommes));
        faits.push({ nom: NOMS_COUCHE[c.a], n: n });
      });
      var ph = P.phraseVue(faits);
      dire('ok', ph ? ph + (M.plafond ? ' (affichage limité : zoomez pour tout voir)' : '') : 'Aucun point dans cette vue.');
    });
  }
  function tracerPistes() {
    var L = window.L, g = M.groupes.fiches; g.clearLayers();
    var vivantes = (M.pistes || []).filter(function (p) { return p.stage !== 'archive'; }), sans = 0;
    vivantes.forEach(function (p) {
      var la = typeof p.lat === 'string' ? parseFloat(p.lat) : p.lat, lo = typeof p.lon === 'string' ? parseFloat(p.lon) : p.lon;
      if (!coordOk(la, lo)) { sans++; return; }
      L.marker([la, lo], { icon: L.divIcon({ className: 'po-epingle', html: '<span></span>', iconSize: [44, 44], iconAnchor: [22, 40], popupAnchor: [0, -34] }) })
        .bindPopup('<div class="po-pop"><b>' + esc(p.nom) + '</b><small>' + esc([p.cp, p.ville].filter(Boolean).join(' ')) + '</small><div><em class="lg-et">' + esc(P.nomEtape(p.stage)) + '</em></div>' +
          (p.next_action ? '<p>' + esc(p.next_action) + (p.next_action_date ? ' · ' + esc(P.frDate(p.next_action_date)) : '') + '</p>' : '') +
          (p.telephone ? '<a class="pa-tel" href="tel:' + esc(String(p.telephone).replace(/\s/g, '')) + '">' + esc(P.telFr(p.telephone)) + '</a>' : '') +
          '<button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button></div>', { minWidth: 220 }).addTo(g);
    });
    var el = M.racine && M.racine.querySelector('#po-fiches');
    if (el) el.textContent = vivantes.length + ' fiche' + (vivantes.length > 1 ? 's' : '') + ' dans vos pistes' + (sans ? ', dont ' + sans + ' sans adresse (pas sur la carte)' : '') + '.';
  }
  function cadrer() {
    if (!M.map) return;
    if (M.perim === 'france') M.map.setView([46.6, 2.4], 6); else M.map.fitBounds(SECTEUR_BORNES, { padding: [20, 20], maxZoom: 9 });
  }
  function dessinerPuces() {
    var z = M.racine && M.racine.querySelector('#po-couches'); if (!z) return;
    var vivantes = (M.pistes || []).filter(function (p) { return p.stage !== 'archive'; }).length;
    function nb(k) { var n = k === 'fiches' ? vivantes : M.totaux[M.perim + '|' + k + '|' + (k === 'robots' ? M.fab : '')]; return n == null ? '' : ' <span class="po-cn">' + n.toLocaleString('fr-FR') + '</span>'; }
    z.innerHTML = '<button type="button" class="pa-chip" data-perim="only" aria-pressed="' + (M.perim === 'only') + '">Secteur de Yann</button>' +
      '<button type="button" class="pa-chip" data-perim="france" aria-pressed="' + (M.perim === 'france') + '">Toute la France</button><span class="po-sep"></span>' +
      ORDRE.map(function (k) { return '<button type="button" class="pa-chip" data-couche="' + k + '" aria-pressed="' + !!M.on[k] + '">' + esc(LIB_COUCHE[k]) + nb(k) + '</button>'; }).join('');
    var f = M.racine.querySelector('#po-parc'); if (!f) return;
    var fabs = M.meta.fabs || [];
    if (!M.on.robots || !fabs.length) { f.hidden = true; f.innerHTML = ''; return; }
    f.hidden = false;
    f.innerHTML = '<span class="po-parc-t">Parc concurrent</span>' + [{ key: '', label: 'Tous' }].concat(fabs.map(function (x) { return { key: x.key, label: x.label + ' (' + x.n + ')' }; })).map(function (x) {
      return '<button type="button" class="pa-chip" data-parc="' + esc(x.key) + '" aria-pressed="' + (M.fab === x.key) + '">' + esc(x.label) + '</button>'; }).join('');
  }
  function chargerTotaux() {
    var jeton = M.perim + '|' + M.fab;
    ORDRE.filter(function (k) { return k !== 'fiches'; }).forEach(function (k) { totalCouche(k).then(function () { if (M.racine && jeton === M.perim + '|' + M.fab) dessinerPuces(); }); });
  }
  /* « Ma tournée du jour » : les fiches dont l'action est due, dans l'ordre de visite le plus court (V1 : tournée de la carte du CRM). */
  function dessinerTournee() {
    var z = M.racine && M.racine.querySelector('#po-pipe'); if (!z) return;
    var stops = P.tourneeDuJour(M.pistes, P.aujourdhui());
    var lien = P.lienTournee(stops), km = Math.round(P.kmRoute(stops));
    var lignes = stops.map(function (p, i) {
      var d = i > 0 ? Math.round(P.kmEntre(stops[i - 1], p)) : null;
      return '<li class="po-arret"><span class="po-num">' + (i + 1) + '</span><div><b>' + esc(p.nom) + '</b><small>' + esc([p.ville, p.next_action, d ? d + ' km du précédent' : ''].filter(Boolean).join(' · ')) + '</small></div>' +
        (p.telephone ? '<a class="pa-b" href="tel:' + esc(String(p.telephone).replace(/\s/g, '')) + '" aria-label="Appeler ' + esc(p.nom) + '">Appeler</a>' : '') + '</li>';
    });
    z.innerHTML = '<h2 class="po-h2">Ma tournée du jour' + (stops.length ? ' · ' + stops.length + ' arrêt' + (stops.length > 1 ? 's' : '') + (stops.length > 1 ? ' · ' + km + ' km' : '') : '') + '</h2>' +
      (stops.length ? '<ol class="po-arrets">' + lignes.slice(0, 5).join('') + '</ol>' +
        (lignes.length > 5 ? '<details class="po-savoir"><summary>Voir les ' + (lignes.length - 5) + ' autres arrêts</summary><ol class="po-arrets">' + lignes.slice(5).join('') + '</ol></details>' : '') +
        (lien ? '<a class="pa-b pa-ok" href="' + esc(lien) + '" target="_blank" rel="noopener">Ouvrir l’itinéraire</a>' : '')
        : '<p class="pa-avis">Rien à visiter aujourd’hui. Fixez une date de relance sur une piste (écran Appels) : elle apparaît ici, rangée dans l’ordre de visite.</p>');
  }
  function clicCarte(ev) {
    var t = ev.target, g;
    if ((g = t.closest('[data-vers]'))) { V2.go(g.getAttribute('data-vers')); return; }
    if ((g = t.closest('[data-couche]'))) { var k = g.getAttribute('data-couche'); M.on[k] = !M.on[k]; if (!M.on[k]) vider(k); dessinerPuces(); actualiser(); return; }
    if ((g = t.closest('[data-parc]'))) { M.fab = g.getAttribute('data-parc'); vider('robots'); dessinerPuces(); chargerTotaux(); actualiser(); return; }
    if ((g = t.closest('[data-perim]'))) { M.perim = g.getAttribute('data-perim'); M.totaux = {}; ORDRE.forEach(vider); dessinerPuces(); chargerTotaux(); cadrer(); actualiser(); return; }
    if (t.closest('[data-zoomer]')) { if (M.perim === 'france') M.map.setZoom(Math.max(M.map.getZoom(), P.SEUIL_COUCHES.france)); else cadrer(); setTimeout(actualiser, 50); return; }
    if ((g = t.closest('[data-ajout-carte]'))) {
      var l = M.lignes[g.getAttribute('data-ajout-carte')], dit = g.parentNode.querySelector('.pa-dit');
      if (!l || !window.PHIRST_PISTE) { if (dit) dit.textContent = PAS; return; }
      g.disabled = true; if (dit) dit.textContent = '';
      window.PHIRST_PISTE.ajouter(P.pisteDeLigne(l)).then(function (m) {
        if (dit) dit.textContent = m;
        if (FAIT.indexOf(m) >= 0) lirePistes(true).then(function (p) { M.pistes = p || M.pistes; M.ix = P.indexPistes(M.pistes); dessinerPuces(); dessinerTournee(); tracerPistes(); }); else g.disabled = false;
      });
    }
  }
  V2.pages.carte = { needs: [], render: function (root) {
    if (M.map) { try { M.map.remove(); } catch (e) { /* carte déjà démontée */ } M.map = null; }
    M.racine = root; M.groupes = {}; M.lignes = {}; M.totaux = {};
    root.innerHTML = window.PHIRST_ECRAN.cadre('<section class="pa po po-large" aria-label="La carte"><header class="pa-tete"><h1>La carte</h1><p>Vos fiches en épingles, les pharmacies du secteur en points. <span id="po-fiches"></span></p></header>' +
      '<div class="pa-chips po-couches" id="po-couches" role="group" aria-label="Couches"></div><div class="pa-chips po-parc" id="po-parc" role="group" aria-label="Parc concurrent" hidden></div>' +
      '<div class="po-carte"><div id="po-map" class="po-map" role="application" aria-label="Carte des pharmacies"></div><div id="po-bandeau" class="po-bandeau" role="status" hidden></div></div><div id="po-pipe" class="po-pipe"></div></section>');
    if (!root.__pc) { root.__pc = true; root.addEventListener('click', clicCarte); }
    dessinerPuces();
    if (!sb()) { dire('alerte', 'Connectez-vous pour voir la carte.'); return; }
    chargerLeaflet(function (ok) {
      if (M.racine !== root) return;
      if (!ok) { root.querySelector('#po-map').innerHTML = '<p class="pa-avis">La carte ne s’est pas chargée. Vérifiez votre connexion puis rouvrez cet écran.</p>'; return; }
      var L = window.L;
      M.map = L.map(root.querySelector('#po-map'), { zoomControl: true, renderer: L.canvas({ tolerance: 14 }), minZoom: 4 }).setView([46.6, 2.4], 6);
      poserFond(M.map);
      ORDRE.forEach(function (k) { M.groupes[k] = L.layerGroup().addTo(M.map); });
      cadrer();
      M.map.on('moveend', function () { clearTimeout(M.minuteur); M.minuteur = setTimeout(actualiser, 300); });
      setTimeout(function () { if (M.map) M.map.invalidateSize(); }, 50);
      lireMeta().then(function (m) { M.meta = m || {}; dessinerPuces(); });
      chargerTotaux();
      lirePistes(true).then(function (p) { M.pistes = p || []; M.ix = P.indexPistes(M.pistes); dessinerPuces(); dessinerTournee(); actualiser(); });
    });
  } };
})();
