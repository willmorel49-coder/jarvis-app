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
  var COLS = 'cle,angle,nom,nom_affiche,ville,cp,dep,lat,lon,pharmacien,telephone,email,groupements,sous,etiquettes,pourquoi,sieges,annonce,score,fab,cat,robot_modele,robot_date,tt_type,tt_date,n_ehpad,ehpad_proches,f_cession,f_pmr,f_sans_robot,dans_secteur,cles';
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
      if (t) return Promise.all([b.rpc('telepro_pistes'), Promise.resolve(b.rpc('telepro_archivees')).then(null, function () { return {}; })]).then(function (r) {
        if (r[0].error || !Array.isArray(r[0].data)) return null;
        // 23/11/2026 — ses fiches archivées (nom + ville seulement), marquées « archive » : la ligne d'Officines propose « Reprendre », jamais une deuxième fiche.
        var a = r[1] && !r[1].error && Array.isArray(r[1].data) ? r[1].data.map(function (x) { return { id: x.id, nom: x.nom, ville: x.ville, stage: 'archive' }; }) : [];
        return r[0].data.concat(a);
      });
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
  function compter(filtres, joint) {
    var b = sb(); if (!b) return Promise.resolve(null);
    return appliquer(b.from('phirst_officines').select('cle' + (joint || ''), { count: 'exact', head: true }), filtres).then(function (r) { return r.error ? null : r.count; }, function () { return null; });
  }
  function pastilles(l) {
    return (l.etiquettes || []).map(function (e) { return '<em class="lg-et"' + (e.ton ? ' data-ton="' + esc(e.ton) + '"' : '') + '>' + esc(e.texte) + '</em>'; }).join(' ');
  }

  /* ════════════════════════ OFFICINES ════════════════════════ */
  var S = { racine: null, jeton: 0, angle: 'toutes', france: false, q: '', dep: '', fab: '', lignes: [], total: null, erreur: '', charge: false,
    tuiles: {}, meta: {}, ie: { vives: {}, archivees: {} }, faits: {}, tel: false };

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
      '<p class="po-aide po-une" title="' + esc(S.france ? 'Votre secteur d’abord, puis le reste de la France.' : 'Grand Ouest puis Île-de-France, par priorité : ' + P.SECTEUR.join(' · ')) + '">' + (S.france ? 'Votre secteur d’abord, puis le reste de la France.' : 'Grand Ouest puis Île-de-France, par priorité : ' + esc(P.SECTEUR.join(' · '))) + '</p></div>' +
      (aide() ? '<p class="po-aide">' + esc(aide()) + '</p>' : '') +
      (savoir ? '<details class="po-savoir"><summary>À savoir</summary><p>' + esc(savoir) + '</p></details>' : '') +
      (filtres.length ? '<div class="pa-chips po-sf" role="group" aria-label="Affiner la liste">' + filtres.map(function (f) {
        return '<button type="button" class="pa-chip" data-fab="' + esc(f.k) + '" aria-pressed="' + (S.fab === f.k) + '">' + esc(f.l) + '</button>'; }).join('') + '</div>' : '');
  }
  function htmlLigne(l, i) {
    var suivi = P.suiviOfficine(l, S.ie), ficheId = suivi.etat === 'piste' ? suivi.id : null, f = S.faits[l.cle] || '';
    var pour = P.pourquoiAffiche(l);
    var action = ficheId
      ? '<span class="po-fait" role="status">✓ ' + (FAIT.indexOf(f) === 1 ? 'Déjà dans vos pistes' : 'Dans vos pistes') + '</span><button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button>'
      : suivi.etat === 'archivee'
      ? '<span class="po-fait po-arch" role="status">Archivée</span><button type="button" class="pa-b" data-reprendre="' + esc(suivi.id) + '" aria-label="Reprendre ' + esc(l.nom_affiche || l.nom) + ' dans mes pistes">Reprendre</button>'
      : '<button type="button" class="pa-b pa-ok" data-ajout="1" aria-label="Ajouter ' + esc(l.nom_affiche || l.nom) + ' à mes pistes"><svg class="po-ic-plus" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Ajouter à mes pistes</button>';
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
    var bt = t.closest('[data-ajout]'), li = t.closest('.pa-l'), rp = t.closest('[data-reprendre]');
    // 23/11/2026 (Will) — « Reprendre » : la même fiche revient « à qualifier ». La ligne ne change qu'après la réponse qui confirme la reprise.
    if (rp && li) {
      var lr = S.lignes[+li.getAttribute('data-i')], dr = li.querySelector('.pa-dit'), idr = rp.getAttribute('data-reprendre');
      if (!lr || !window.PHIRST_PISTE || !window.PHIRST_PISTE.reprendre) { dr.textContent = PAS; return; }
      rp.disabled = true; dr.textContent = '';
      window.PHIRST_PISTE.reprendre(idr).then(function (m) {
        if (m !== window.PHIRST_PISTE.REPRISE) { dr.textContent = m; rp.disabled = false; return; }
        Object.keys(S.ie.archivees).forEach(function (k) { if (S.ie.archivees[k] === idr) { delete S.ie.archivees[k]; S.ie.vives[k] = idr; } });
        S.faits[lr.cle] = m; C.pistes = null;
        var d = document.createElement('div'); d.innerHTML = htmlLigne(lr, +li.getAttribute('data-i')); li.replaceWith(d.firstChild);
      });
      return;
    }
    if (bt && li) {
      var l = S.lignes[+li.getAttribute('data-i')], dit = li.querySelector('.pa-dit');
      if (!l || !window.PHIRST_PISTE) { dit.textContent = PAS; return; }
      bt.disabled = true; dit.textContent = '';
      window.PHIRST_PISTE.ajouter(P.pisteDeLigne(l)).then(function (m) {
        S.faits[l.cle] = m;
        if (FAIT.indexOf(m) >= 0) { S.ie.vives[P.cle(l.nom_affiche || l.nom, l.ville)] = S.ie.vives[P.cle(l.nom_affiche || l.nom, l.ville)] || 'nouvelle'; C.pistes = null; var d = document.createElement('div'); d.innerHTML = htmlLigne(l, +li.getAttribute('data-i')); li.replaceWith(d.firstChild); } else { dit.textContent = m; bt.disabled = false; }
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
      '<button type="submit" class="pa-b pa-ok" aria-label="Filtrer"><svg class="po-loupe" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><span class="po-mot">Filtrer</span></button></form><div id="po-liste"></div></section>');
    if (!root.__po) { root.__po = true; root.addEventListener('click', clicOfficines); root.addEventListener('submit', soumettre); }
    S.tuiles = {}; S.faits = {};
    Promise.all([lireMeta(), lirePistes(true)]).then(function (r) {
      if (S.racine !== root) return;
      S.meta = r[0] || {}; S.ie = P.indexParEtat(r[1] || []);
      dessinerReglages(); dessinerListe();
      if (S.total !== null) { /* liste déjà chargée : on la redessine avec l'anti-doublon à jour */ }
    });
    chargerTuiles(); recharger();
  } };

  /* ════════════════════════ LA CARTE ════════════════════════ */
  var COUL = { robots: '#C2410C', omnicell: '#DC2626', ehpad: '#7C3AED', transferts: '#1D4ED8', signaux: '#12A567', toutes: '#1A3A2E' };
  var BLEU_IP = '#0050E6';
  var NOMS_COUCHE = { toutes: 'officines', robots: 'robots', ehpad: 'EHPAD', transferts: 'cessions et créations', signaux: 'à saisir maintenant', integral: 'clientes d’Intégral' };
  var UN_COUCHE = { toutes: 'officine', robots: 'robot', ehpad: 'EHPAD', transferts: 'transfert', signaux: 'à saisir maintenant', integral: 'cliente d’Intégral' };
  function compteCouche(a, n) { return { nom: NOMS_COUCHE[a], un: UN_COUCHE[a], f: a === 'toutes' || a === 'integral', n: n }; }
  var LIB_COUCHE = { fiches: 'Mes fiches', robots: 'Robots concurrents', transferts: 'Cessions et créations', ehpad: 'Fournisseurs EHPAD', signaux: 'À saisir maintenant', toutes: 'Toutes les officines', integral: 'Clients Intégral' };
  /* 24/11/2026 — maquette « 2 · Une seule barre » choisie par Will : noms courts dans la barre (le nom complet est dans l'info-bulle,
     dans le nom lu par VoiceOver et en toutes lettres dans le tiroir du téléphone), et la pastille de chaque bouton sert de légende. */
  var COURT_COUCHE = { fiches: 'Mes fiches', robots: 'Robots', transferts: 'Cessions', ehpad: 'EHPAD', signaux: 'À saisir', toutes: 'Toutes', integral: 'Intégral' };
  var AIDE_COUCHE = { fiches: 'les officines de vos pistes, en épingle verte.', robots: 'robot concurrent, point orange (Omnicell en rouge).', transferts: 'cession, transfert ou création, point bleu.',
    ehpad: 'fournisseur d’EHPAD, point violet.', signaux: 'à saisir maintenant, point vert vif.', toutes: 'toutes les officines, petit point vert foncé.', integral: 'cliente d’Intégral, anneau bleu.' };
  /* Cadre du « Secteur de Yann » : le Grand Ouest et l'Île-de-France (27/11/2026). */
  var SECTEUR_BORNES = [[46.2, -5.3], [49.8, 3.6]];
  /* 6 tranches de 1 000 : avec l'Île-de-France, la couche « Toutes » du secteur compte 5 284 officines (2 214 avant), au-delà des 4 000 d'avant. */
  var CAP_PAGES = 6;
  /* yann : vrai quand le compte n'est pas la téléprospectrice (couche « Clients Intégral » et bloc Intégral de la fiche, jamais pour elle). */
  var M = { racine: null, map: null, perim: 'only', on: { fiches: true, robots: true, transferts: true, ehpad: true, signaux: false, toutes: false, integral: true },
    groupes: {}, lignes: {}, ix: {}, pistes: [], sommes: null, jeton: 0, minuteur: 0, totaux: {}, vus: {}, plafond: false, fab: '', meta: {},
    yann: false, pistesDessinees: false, sel: null, repere: null, ficheJeton: 0, replie: false, pts: {}, totauxP: {}, cache: {}, dessine: {}, compte: {},
    menuParc: false, tiroir: false, tourneeOuverte: false };
  function ordre() { return P.ordreCouches(M.yann); }

  /* Leaflet n'est chargé qu'UNE fois : l'écran peut être redessiné pendant le chargement (la téléprospectrice : deux dessins, deux scripts,
     « Map container is already initialized » mesuré en production le 24/11/2026). Les demandes arrivées entre-temps attendent le même script. */
  var attenteLeaflet = null;
  function chargerLeaflet(cb) {
    function css(h) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); }
    if (window.L) { cb(true); return; }
    if (attenteLeaflet) { attenteLeaflet.push(cb); return; }
    attenteLeaflet = [cb];
    function fin(ok) { var a = attenteLeaflet; attenteLeaflet = null; a.forEach(function (f) { f(ok); }); }
    css('../../crm/v2/vendor/leaflet/leaflet.css');
    var s = document.createElement('script'); s.src = '../../crm/v2/vendor/leaflet/leaflet.js';
    s.onload = function () { fin(!!window.L); }; s.onerror = function () { fin(false); };
    document.head.appendChild(s);
  }
  window.PHIRST_LEAFLET = chargerLeaflet; // l'étude de zone (phirst-etude.js) réutilise ce chargement : Leaflet n'est jamais chargé deux fois
  function poserFond(map) {
    var L = window.L, ign = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.ign.fr">IGN</a> — Géoplateforme &middot; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    L.tileLayer(ign, { maxZoom: 7 }).addTo(map);
    [[42.2, -8.5, 51.8, 10], [41.2, 8.3, 43.2, 10], [2, -64, 19, -50], [-22, 44, -11, 56.5]].forEach(function (e) {
      L.tileLayer(ign, { minZoom: 8, maxZoom: 19, bounds: L.latLngBounds([e[0], e[1]], [e[2], e[3]]) }).addTo(map);
    });
  }
  function coordOk(la, lo) { return typeof la === 'number' && typeof lo === 'number' && la > -22 && la < 52 && lo > -64 && lo < 56; }
  function filtresCouche(a) { return a === 'integral' ? P.filtresIntegral(M.perim) : P.requeteOfficines({ angle: a, france: M.perim === 'france', fab: a === 'robots' ? M.fab : '' }); }
  function jointCouche(a) { return a === 'integral' ? P.SELECT_INTEGRAL : ''; }

  /* Bandeau SUR la carte (choix m1) : dit ce que la vue trop large ne dessine pas, avec un bouton pour s'en approcher ; sinon ce qui est dans la vue. */
  function dire(ton, phrase, bouton) {
    var el = M.racine && M.racine.querySelector('#po-bandeau'); if (!el) return;
    el.setAttribute('data-ton', ton);
    el.innerHTML = '<p>' + esc(phrase) + '</p>' + (bouton ? '<button type="button" class="po-bouton" data-zoomer="1">' + esc(bouton) + '</button>' : '');
    el.hidden = !phrase;
  }
  /* Les clientes d'Intégral se dessinent EN PREMIER : leur anneau reste visible autour des points des autres couches posés par-dessus. */
  function couchesActives() { return ordre().filter(function (k) { return k !== 'fiches' && M.on[k]; }).sort(function (x, y) { return (y === 'integral') - (x === 'integral'); }); }
  function cleCouche(a) { return M.perim + '|' + a + '|' + (a === 'robots' ? M.fab : ''); }
  /* La demande EN COURS est gardée : l'ouverture appelait chargerTotaux deux fois et les 5 comptages partaient deux fois (mesuré le 24/11/2026). */
  function totalCouche(a) {
    var cle = cleCouche(a);
    if (M.totaux[cle] !== undefined) return Promise.resolve(M.totaux[cle]);
    if (M.totauxP[cle]) return M.totauxP[cle];
    var p = M.totauxP[cle] = compter(filtresCouche(a), jointCouche(a)).then(function (n) { if (n !== null) M.totaux[cle] = n; else if (M.totauxP[cle] === p) delete M.totauxP[cle]; return n || 0; });
    return p;
  }
  function vider(a) { if (M.groupes[a]) M.groupes[a].clearLayers(); M.pts[a] = []; M.compte[a] = []; M.dessine[a] = null; }
  function couleurLigne(l) { return l.angle === 'robots' ? (l.cat === 'omnicell' ? COUL.omnicell : COUL.robots) : COUL[l.angle] || COUL.toutes; }
  /* 24/11/2026 — plus de bulle Leaflet : un clic ouvre la fiche posée sur la carte, qui ne dépend d'aucune couche (le rechargement des points ne la touche plus). */
  function tracerLignes(a, rows) {
    if (a === 'integral') return tracerIntegral(rows);
    var L = window.L, g = M.groupes[a]; g.clearLayers();
    var n = 0, pts = M.pts[a] = M.compte[a] = [];
    rows.forEach(function (l) {
      if (!coordOk(l.lat, l.lon) || P.ficheSuivie(l, M.ix)) return;
      M.lignes[l.cle] = l;
      var big = a === 'robots' || a === 'transferts' || a === 'signaux';
      L.circleMarker([l.lat, l.lon], { radius: a === 'toutes' ? 4 : big ? 8 : 7, weight: 2, color: '#fff', fillColor: couleurLigne(l), fillOpacity: 1, interactive: false }).addTo(g);
      pts.push(l); n++;
    });
    return n;
  }
  /* « Clients Intégral » : un ANNEAU bleu (#0050E6) cerclé de blanc autour d'un point vert forêt — une forme, pas seulement une couleur,
     pour ne pas la confondre avec les points bleus pleins des cessions et créations (#1D4ED8). Une cliente déjà dans les pistes garde son épingle. */
  function tracerIntegral(rows) {
    var L = window.L, g = M.groupes.integral; g.clearLayers();
    var n = 0, pts = M.pts.integral = [], tous = M.compte.integral = [];
    rows.forEach(function (l) {
      if (!coordOk(l.lat, l.lon)) return;
      M.lignes[l.cle] = l; tous.push(l);
      L.circleMarker([l.lat, l.lon], { radius: 13, weight: 5, color: '#fff', fill: false, interactive: false }).addTo(g);
      L.circleMarker([l.lat, l.lon], { radius: 11, weight: 3, color: BLEU_IP, fill: false, interactive: false }).addTo(g);
      if (!P.ficheSuivie(l, M.ix)) { L.circleMarker([l.lat, l.lon], { radius: 6, weight: 2, color: '#fff', fillColor: COUL.toutes, fillOpacity: 1, interactive: false }).addTo(g); pts.push(l); }
      n++;
    });
    return n;
  }
  /* Le clic ouvre le point VISIBLE le plus proche (20 px, 28 au doigt), comme la maquette : au centre d'une ville les points se recouvrent,
     et le point du dessus n'est pas toujours celui qu'on vise. Une cliente d'Intégral passe en premier à distance égale. */
  function plusProche(pt) {
    var best = null, rmax = window.matchMedia && window.matchMedia('(pointer:coarse)').matches ? 28 : 20;
    Object.keys(M.pts).forEach(function (a) {
      if (!M.on[a] || (a === 'integral' && !M.yann)) return;
      M.pts[a].forEach(function (l) {
        var q = M.map.latLngToContainerPoint([l.lat, l.lon]), d = Math.sqrt((q.x - pt.x) * (q.x - pt.x) + (q.y - pt.y) * (q.y - pt.y)) - (a === 'integral' ? 4 : 0);
        if (d <= rmax && (!best || d < best.d)) best = { l: l, d: d };
      });
    });
    return best && best.l;
  }
  /* Les lignes d'une couche : tranches de 1 000, plafonnées (le bandeau le dit) ; dans des bornes seulement pour « Toute la France ». */
  function lireCouche(a, bornes) {
    var b = sb(), out = [];
    function page(i) {
      var q = appliquer(b.from('phirst_officines').select(COLS + jointCouche(a)), filtresCouche(a));
      if (bornes) q = q.gte('lat', bornes.getSouth()).lte('lat', bornes.getNorth()).gte('lon', bornes.getWest()).lte('lon', bornes.getEast());
      return q.order('tri', { ascending: true }).range(i * 1000, i * 1000 + 999).then(function (r) {
        if (r.error) return null;
        out = out.concat(r.data || []);
        if ((r.data || []).length < 1000) return { rows: out, plafond: false };
        if (i + 1 >= CAP_PAGES) return { rows: out, plafond: true };
        return page(i + 1);
      });
    }
    return page(0);
  }
  /* 24/11/2026 — rapidité, mesurée dans le Safari de Will : CHAQUE geste (glisser, zoomer) retéléchargeait les couches (≈ 830 Ko)
     et redessinait tous les points, 456 à 556 ms avant la mise à jour. Désormais :
     · « Secteur de Yann » : chaque couche est lue UNE fois pour tout le secteur et dessinée une fois ; un geste ne relit ni ne redessine rien,
       seule la phrase « Dans cette vue » est recomptée sur place ;
     · « Toute la France » : la couche est lue pour une zone plus large que la vue ; tant que la vue reste dedans (et que la lecture
       n'a pas été plafonnée), rien n'est relu. La demande en cours est partagée : deux gestes rapprochés n'envoient qu'une lecture. */
  function entreeCouche(a) {
    var cle = cleCouche(a), e = M.cache[cle], france = M.perim === 'france', vue = M.map.getBounds();
    if (e && (!france || (e.bornes.contains(vue) && !e.plafond))) return e;
    e = M.cache[cle] = { bornes: france ? vue.pad(0.3) : null, rows: null, plafond: false };
    function rate() { if (M.cache[cle] === e) delete M.cache[cle]; return e; }
    e.p = lireCouche(a, e.bornes).then(function (r) { if (!r) return rate(); e.rows = r.rows; e.plafond = r.plafond; return e; }, rate);
    return e;
  }
  function dansVue(a, vue) {
    var s = vue.getSouth(), n = vue.getNorth(), w = vue.getWest(), e = vue.getEast(), k = 0;
    (M.compte[a] || []).forEach(function (l) { if (l.lat >= s && l.lat <= n && l.lon >= w && l.lon <= e) k++; });
    return k;
  }
  function actualiser() {
    if (!M.map) return;
    var tok = ++M.jeton, zoom = M.map.getZoom(), masque = P.couchesMasquees(zoom, M.perim), actives = couchesActives();
    // Les épingles ne dépendent pas de la vue : dessinées une fois (et à chaque changement des pistes), plus à chaque déplacement.
    if (M.on.fiches) { if (!M.pistesDessinees) tracerPistes(); } else if (M.groupes.fiches) { M.groupes.fiches.clearLayers(); M.pistesDessinees = false; }
    if (masque) {
      actives.forEach(vider);
      Promise.all(actives.map(function (a) { return totalCouche(a).then(function (n) { return compteCouche(a, n); }); })).then(function (couches) {
        if (tok !== M.jeton) return;
        var ph = P.phraseCachee(couches);
        dire('alerte', ph || 'Vue trop large : zoomez pour voir les points.', P.libelleBouton(M.perim));
      });
      return;
    }
    if (!actives.length) { dire('ok', ''); return; }
    var entrees = actives.map(entreeCouche);
    Promise.all([lireSommes()].concat(entrees.map(function (e) { return e.p; }))).then(function (r) {
      if (tok !== M.jeton || !M.map) return;
      var sommes = r[0], vue = M.map.getBounds(), faits = [], plafond = false;
      actives.forEach(function (a, i) {
        var e = entrees[i]; if (!e.rows) return;
        if (M.dessine[a] !== e) { tracerLignes(a, finir(e.rows, sommes)); M.dessine[a] = e; }
        if (e.plafond) plafond = true;
        faits.push(compteCouche(a, dansVue(a, vue)));
      });
      var ph = P.phraseVue(faits);
      dire('ok', ph ? ph + (plafond ? ' (affichage limité : zoomez pour tout voir)' : '') : 'Aucun point dans cette vue.');
    });
  }
  function tracerPistes() {
    var L = window.L, g = M.groupes.fiches; g.clearLayers();
    M.pistesDessinees = true;
    var vivantes = (M.pistes || []).filter(function (p) { return p.stage !== 'archive'; });
    vivantes.forEach(function (p) {
      var la = typeof p.lat === 'string' ? parseFloat(p.lat) : p.lat, lo = typeof p.lon === 'string' ? parseFloat(p.lon) : p.lon;
      if (!coordOk(la, lo)) return;
      L.marker([la, lo], { icon: L.divIcon({ className: 'po-epingle', html: '<span></span>', iconSize: [44, 44], iconAnchor: [22, 40], popupAnchor: [0, -34] }) })
        .bindPopup('<div class="po-pop"><b>' + esc(p.nom) + '</b><small>' + esc([p.cp, p.ville].filter(Boolean).join(' ')) + '</small><div><em class="lg-et">' + esc(P.nomEtape(p.stage)) + '</em></div>' +
          (p.next_action ? '<p>' + esc(p.next_action) + (p.next_action_date ? ' · ' + esc(P.frDate(p.next_action_date)) : '') + '</p>' : '') +
          (p.telephone ? '<a class="pa-tel" href="tel:' + esc(String(p.telephone).replace(/\s/g, '')) + '">' + esc(P.telFr(p.telephone)) + '</a>' : '') +
          '<button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button></div>', { minWidth: 220 }).addTo(g);
    });
  }

  /* ── La fiche posée sur la carte (maquette v2 choisie par Will le 24/11/2026) ──
     Elle NAÎT du point cliqué et se pose à gauche (en bas sur un téléphone) ; repliable en bandeau ; elle reste ouverte quand on glisse,
     zoome ou recharge les points ; Échap, la croix ou un autre point la ferment ou la remplacent. Logique pure : P.memePharmacie,
     P.ficheDeLignes, P.blocIntegral. Le bloc Intégral n'est demandé que pour Yann : la téléprospectrice n'envoie AUCUNE requête à phirst_integral. */
  var IC = {
    ring: '<svg class="po-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></svg>',
    tel: '<svg class="po-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    mail: '<svg class="po-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    ok: '<svg class="po-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    haut: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    bas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  };
  function estTel() { return !!(window.matchMedia && window.matchMedia('(max-width:700px)').matches); }
  function reduit() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function lienTel(t) { return 'tel:' + String(t).replace(/[^\d+]/g, ''); }
  function dl(r) { return '<dl class="po-fdl">' + r.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>'; }
  function rubrique(titre, corps) { return '<section class="po-fsec"><h3 class="po-fh">' + titre + '</h3>' + corps + '</section>'; }
  function puces(t) { return '<ul class="po-fl">' + t.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
  function htmlIntegral(i) {
    if (!i) return '';
    return '<section class="po-fsec po-ip" aria-label="Cliente d’Intégral Pharma"><h3 class="po-ip-t">' + IC.ring + 'Cliente d’Intégral Pharma</h3>' +
      (i.commercial ? '<p class="po-ip-qui">Suivie par <b>' + esc(i.commercial) + '</b></p><ul class="po-ip-co">' +
        '<li>' + IC.tel + (i.tel ? '<a href="' + esc(i.telHref) + '">' + esc(i.tel) + '</a>' : '<span class="po-manque">Téléphone à compléter</span>') + '</li>' +
        '<li>' + IC.mail + (i.mail ? '<a href="mailto:' + esc(i.mail) + '">' + esc(i.mail) + '</a>' : '<span class="po-manque">Mail à compléter</span>') + '</li></ul>' +
        '<p class="po-ip-dit">Appelez ' + esc(i.commercial) + ' pour en savoir plus sur cette officine.</p>' : '') + '</section>';
  }
  /* Chaque rubrique se tait quand elle n'a rien à dire. */
  function htmlCorps(f, integ) {
    var h = htmlIntegral(integ), r;
    var pour = (f.pourquoi || []).filter(Boolean);
    if (pour.length) h += rubrique('Pourquoi l’appeler', puces(pour));
    r = [];
    if (f.pharmacien) r.push(['Pharmacien', esc(f.pharmacien)]);
    if (f.telephone) r.push(['Téléphone', '<a class="po-flien" href="' + esc(lienTel(f.telephone)) + '">' + IC.tel + esc(P.telFr(f.telephone)) + '</a>']);
    if (f.email) r.push(['Mail', '<a class="po-flien" href="mailto:' + esc(f.email) + '">' + IC.mail + '<span>' + esc(f.email) + '</span></a>']);
    if (f.groupements.length) r.push([f.groupements.length > 1 ? 'Groupements' : 'Groupement', esc(P.libelleGroupements(f.groupements))]);
    f.sieges.forEach(function (s) { r.push(['Siège du groupement', esc(String(s).replace(/^Siège\s+/, ''))]); });
    r.push(['Votre secteur', f.dans_secteur ? 'Oui, dans votre secteur' : 'Non, hors de votre secteur']);
    h += rubrique('Contact', dl(r));
    if (f.fab || f.robot_modele) {
      r = [];
      if (f.fab) r.push(['Fabricant', esc(f.fab)]);
      if (f.robot_modele) r.push(['Modèle', esc(f.robot_modele)]);
      if (f.robot_date) r.push(['Posé', esc(P.frDate(f.robot_date))]);
      h += rubrique('Robot concurrent', dl(r));
    }
    r = [];
    if (f.tt_type) r.push(['Type', esc(f.tt_type)]);
    if (f.tt_date) r.push(['Date', esc(P.frDate(f.tt_date))]);
    if (P.lienSur(f.annonce)) r.push(['Annonce', '<a class="po-flien" href="' + esc(P.lienSur(f.annonce)) + '" target="_blank" rel="noopener">Voir l’annonce légale</a>']);
    if (r.length) h += rubrique('Transfert ou cession', dl(r));
    var ne = f.n_ehpad || f.ehpad_proches.length;
    if (ne) h += rubrique('EHPAD proches', '<p class="po-fgros"><b>' + ne + '</b> EHPAD à proximité</p>' + (f.ehpad_proches.length ? puces(f.ehpad_proches) : ''));
    var s = [];
    if (f.f_cession) s.push('Vient de changer de main');
    if (f.f_pmr) s.push('Accessibilité PMR à reprendre');
    if (f.f_sans_robot) s.push('Sans automate');
    if (s.length) h += rubrique('Signaux', '<div class="po-fsig">' + s.map(function (x) { return '<span class="po-fsg">' + IC.ok + esc(x) + '</span>'; }).join('') + '</div>');
    return h;
  }
  function htmlAction(F) {
    var f = F.f, s = P.suiviOfficine({ cles: f.cles, nom: f.nom, ville: f.ville }, P.indexParEtat(M.pistes)), fait = FAIT.indexOf(F.dit) >= 0;
    if (fait || s.etat === 'piste') return '<div class="po-fact" role="status"><p class="po-ffait">' + IC.ok + esc(fait ? F.dit : 'Dans vos pistes') + '</p><button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button></div>';
    if (s.etat === 'archivee') return '<div class="po-fact" role="status"><p class="po-ffait">Archivée dans vos pistes</p><button type="button" class="pa-b" data-vers="appels">Voir mes pistes</button></div>';
    return '<div class="po-fact"><button type="button" class="pa-b pa-ok po-fajout" data-fiche-ajout="1"' + (F.envoi ? ' disabled' : '') + '>Ajouter aux officines à appeler</button><p class="pa-dit" role="status">' + esc(F.dit || '') + '</p></div>';
  }
  /* Le bouton « Étude de zone » : seulement si une étude existe — ou si la vérification a échoué (on ne conclut pas « pas d'étude » sur une panne). */
  function htmlEtude(F) {
    return F.etude === 'oui' || F.etude === 'erreur' ? '<button type="button" class="pa-b pe-ouvre" data-fiche-etude="1">Étude de zone</button>' : '';
  }
  function htmlFiche(F) {
    var f = F.f, rep = M.replie, past = pastilles(f) + (F.integ ? ' <em class="lg-et po-et-ip">Cliente Intégral</em>' : '');
    var sous = [f.cp, f.ville].filter(Boolean).join(' ') + (f.groupements.length ? ' · ' + P.libelleGroupements(f.groupements) : '');
    return '<article class="po-fiche" id="po-fiche" data-etat="' + (rep ? 'replie' : 'ouvert') + '" aria-label="' + esc(f.nom) + '">' +
      '<header class="po-ftete"><div><h2 class="po-fnom">' + esc(f.nom) + '</h2><p class="po-fsous">' + esc(sous) + '</p></div>' +
      '<div class="po-fbtns"><button type="button" class="po-fbt" data-fiche-replier="1" aria-label="' + (rep ? 'Déplier la fiche' : 'Replier la fiche') + '" aria-expanded="' + !rep + '">' + (rep ? IC.bas : IC.haut) + '</button>' +
      '<button type="button" class="po-fbt" data-fiche-fermer="1" aria-label="Fermer la fiche">' + IC.x + '</button></div>' +
      (past.trim() ? '<div class="po-fpast">' + past + '</div>' : '') + '</header>' +
      '<div class="po-fcorps">' + htmlCorps(f, F.integ) + '</div><div class="po-fpied">' + htmlEtude(F) + htmlAction(F) + '</div></article>';
  }
  /* Téléphone : la feuille est posée dans la PAGE (hors de l'écran), car l'écran porte une animation d'apparition (will-change: transform)
     qui ferait glisser une feuille « fixe » sous le bas de l'écran au lieu de la poser en bas de la fenêtre. */
  function hoteTel() {
    var h = document.getElementById('po-fiche-tel');
    if (!h) { h = document.createElement('div'); h.id = 'po-fiche-tel'; h.className = 'po-fiche-hote'; document.body.appendChild(h); h.addEventListener('click', clicCarte); }
    return h;
  }
  function viderTel() { var h = document.getElementById('po-fiche-tel'); if (h) h.innerHTML = ''; }
  function dessinerFiche() {
    var dans = M.racine && M.racine.querySelector('#po-fiche-hote'), carte = M.racine && M.racine.querySelector('.po-carte');
    if (!dans) { viderTel(); return; }
    var hote = estTel() ? hoteTel() : dans, autre = hote === dans ? document.getElementById('po-fiche-tel') : dans;
    if (autre && autre !== hote) autre.innerHTML = '';
    if (!M.sel) { hote.innerHTML = ''; if (carte) carte.removeAttribute('data-fiche'); M.racine.classList.remove('po-ouverte'); return; }
    var vieux = hote.querySelector('.po-fcorps'), haut = vieux ? vieux.scrollTop : 0;
    hote.innerHTML = htmlFiche(M.sel);
    var c = hote.querySelector('.po-fcorps'); if (c && haut) c.scrollTop = haut;
    if (carte) carte.setAttribute('data-fiche', M.replie ? 'replie' : 'ouvert');
    M.racine.classList.add('po-ouverte');
  }
  /* Le repère du point choisi : hors des couches, il ne s'efface pas quand les points se rechargent. */
  function marquer(l) {
    if (M.repere && M.map) M.map.removeLayer(M.repere);
    M.repere = null;
    if (!l || !M.map || !coordOk(l.lat, l.lon)) return;
    M.repere = window.L.marker([l.lat, l.lon], { interactive: false, keyboard: false, zIndexOffset: 1000,
      icon: window.L.divIcon({ className: 'po-rep', html: '<span class="po-rep-p"></span><span class="po-rep-a"></span>', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(M.map);
  }
  /* Ramène le point dans la partie libre de la carte (à droite de la fiche ; au-dessus d'elle sur un téléphone), sans animation. */
  function placerFiche() {
    if (!M.map || !M.sel || !coordOk(M.sel.l.lat, M.sel.l.lon)) return;
    var m = M.map, s = m.getSize(), ll = [M.sel.l.lat, M.sel.l.lon], el = document.getElementById('po-fiche');
    if (estTel()) {
      if (!el) return;
      var r = m.getContainer().getBoundingClientRect(); // la carte remplit l'écran sous sa barre : plus rien à faire défiler
      var libre = Math.max(120, el.getBoundingClientRect().top - r.top);
      m.panInside(ll, { paddingTopLeft: [30, 30], paddingBottomRight: [30, Math.max(0, s.y - libre) + 30], animate: false });
    } else if (!M.replie) m.panInside(ll, { paddingTopLeft: [14 + 408 + 8 + 44, 44], paddingBottomRight: [44, 44], animate: false });
  }
  function naitre() {
    var el = document.getElementById('po-fiche'); if (!el || !el.animate || reduit() || !M.map || !M.sel) return;
    var zr = M.map.getContainer().getBoundingClientRect(), er = el.getBoundingClientRect(), p = M.map.latLngToContainerPoint([M.sel.l.lat, M.sel.l.lon]);
    el.animate([{ transform: 'translate(' + (zr.left + p.x - er.left) + 'px,' + (zr.top + p.y - er.top) + 'px) scale(.04)' }, { transform: 'translate(0,0) scale(1)' }],
      { duration: 440, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  /* Toutes les lignes de la pharmacie (tous les angles), puis — Yann seulement — sa ligne dans phirst_integral. */
  function enrichirFiche(l, tok) {
    var b = sb(); if (!b) return;
    var lignes = l.cles && l.cles.length
      ? b.from('phirst_officines').select(COLS).overlaps('cles', l.cles).range(0, 49).then(function (r) { return r.error ? [] : r.data || []; }, function () { return []; })
      : Promise.resolve([]);
    Promise.all([lignes, lireSommes()]).then(function (r) {
      if (tok !== M.ficheJeton || !M.sel) return null;
      M.sel.f = P.ficheDeLignes(P.memePharmacie(l, finir(r[0], r[1])));
      dessinerFiche();
      // 25/11/2026 — « Étude de zone » : une lecture légère dit s'il y en a une pour cette pharmacie (le bouton n'apparaît qu'alors).
      if (window.PHIRST_ETUDE) window.PHIRST_ETUDE.verifier(M.sel.f.lignes).then(function (e) { if (tok === M.ficheJeton && M.sel) { M.sel.etude = e; dessinerFiche(); } });
      if (!M.yann) return null;
      return b.from('phirst_integral').select('cle,commercial,tel,mail').in('cle', M.sel.f.lignes).then(function (x) {
        if (tok !== M.ficheJeton || !M.sel || x.error) return;
        M.sel.integ = P.blocIntegral(x.data);
        if (M.sel.integ) dessinerFiche();
      });
    }).then(null, function () { /* la fiche garde ce qu'elle a déjà */ });
  }
  function ouvrirFiche(l) {
    var tok = ++M.ficheJeton;
    M.sel = { l: l, f: P.ficheDeLignes([l]), integ: null, dit: '', envoi: false };
    if (M.menuParc) { M.menuParc = false; dessinerPuces(); }
    if (M.tiroir) poserTiroir(false);
    marquer(l); dessinerFiche(); placerFiche(); naitre();
    enrichirFiche(l, tok);
  }
  function fermerFiche() { if (!M.sel) return; M.sel = null; M.ficheJeton++; marquer(null); dessinerFiche(); }
  function ajouterDepuisFiche() {
    var F = M.sel; if (!F || F.envoi) return;
    if (!window.PHIRST_PISTE || !F.f.piste) { F.dit = PAS; dessinerFiche(); return; }
    F.envoi = true; F.dit = ''; dessinerFiche();
    window.PHIRST_PISTE.ajouter(P.pisteDeLigne(F.f.piste)).then(function (m) {
      F.envoi = false; F.dit = m;
      if (FAIT.indexOf(m) >= 0) lirePistes(true).then(function (p) { M.pistes = p || M.pistes; M.ix = P.indexPistes(M.pistes); M.dessine = {}; dessinerPuces(); dessinerTournee(); if (M.on.fiches) tracerPistes(); actualiser(); if (M.sel === F) dessinerFiche(); });
      if (M.sel === F) dessinerFiche();
    });
  }
  function toucheCarte(ev) {
    if (!(ev.key === 'Escape' && M.racine && M.racine.querySelector('#po-fiche-hote'))) return;
    if (M.menuParc) { M.menuParc = false; dessinerPuces(); var c = M.racine.querySelector('[data-menu-parc]'); if (c) c.focus(); return; } // le menu d'abord, puis la fiche
    if (M.sel) fermerFiche();
  }
  /* En quittant l'écran, la fiche part avec lui (la feuille du téléphone vit dans la page). */
  function quitterCarte() { if (/^#carte\b/.test(location.hash || '')) return; M.sel = null; M.ficheJeton++; viderTel(); if (M.racine) M.racine.classList.remove('po-ouverte'); }

  function cadrer() {
    if (!M.map) return;
    if (M.perim === 'france') M.map.setView([46.6, 2.4], 6); else M.map.fitBounds(SECTEUR_BORNES, { padding: [20, 20], maxZoom: 9 });
  }
  /* La barre d'outils (maquette 2 choisie le 24/11/2026) : Secteur / France à gauche, puis une rangée de boutons compacts, pastille + nom court + nombre.
     Le bouton Robots porte une flèche qui ouvre le parc concurrent dans un menu (seulement quand les robots sont affichés).
     Au téléphone, les mêmes boutons, en toutes lettres, vivent dans le tiroir du bas. Les états (menu, tiroir) sont dans M : les nombres arrivent
     après coup et redessinent la barre, le menu ouvert le reste. */
  function glyphe(k) { return '<i class="po-g po-g-' + k + '" aria-hidden="true"></i>'; }
  function chipsParc() {
    return '<div class="po-chips" role="group" aria-label="Parc concurrent">' + [{ key: '', label: 'Tous' }].concat(M.meta.fabs || []).map(function (x) {
      var n = typeof x.n === 'number' ? x.n.toLocaleString('fr-FR') : (x.n == null ? '' : String(x.n));
      return '<button type="button" class="po-chip" data-parc="' + esc(x.key) + '" aria-pressed="' + (M.fab === x.key) + '">' + (x.key === 'omnicell' ? glyphe('omnicell') : '') +
        '<span>' + esc(x.label) + '</span>' + (n ? '<i class="po-chip-n">' + esc(n) + '</i>' : '') + '</button>';
    }).join('') + '</div>';
  }
  /* La barre est redessinée quand un nombre arrive : le bouton qui avait le focus clavier le retrouve. */
  function garderFocus(f) {
    var a = document.activeElement, zone = a && a.closest ? a.closest('#po-couches,#po-grille,#po-parc,#po-perim') : null, sel = '';
    if (zone) ['data-couche', 'data-parc', 'data-perim', 'data-menu-parc'].some(function (n) { var v = a.getAttribute(n); if (v !== null) sel = '[' + n + '="' + v + '"]'; return v !== null; });
    f();
    if (sel) { var b = zone.querySelector(sel); if (b && b !== document.activeElement) b.focus({ preventScroll: true }); }
  }
  function dessinerPuces() { garderFocus(dessinerBarre); }
  function dessinerBarre() {
    var r = M.racine, z = r && r.querySelector('#po-couches'); if (!z) return;
    var vivantes = (M.pistes || []).filter(function (p) { return p.stage !== 'archive'; });
    var sans = vivantes.filter(function (p) { return !coordOk(typeof p.lat === 'string' ? parseFloat(p.lat) : p.lat, typeof p.lon === 'string' ? parseFloat(p.lon) : p.lon); }).length;
    var fabs = M.meta.fabs || [], parc = !!M.on.robots && fabs.length > 0, libFab = '';
    fabs.forEach(function (x) { if (x.key === M.fab) libFab = x.label; });
    if (!parc) M.menuParc = false;
    function n(k) { return k === 'fiches' ? vivantes.length : M.totaux[cleCouche(k)]; }
    function bouton(k, long) {
      var x = n(k), nb = x == null ? '' : x.toLocaleString('fr-FR');
      var titre = LIB_COUCHE[k] + ' : ' + AIDE_COUCHE[k] + (k === 'fiches' && sans ? ' ' + sans + ' sans adresse, pas sur la carte.' : '');
      return '<button type="button" class="po-b" data-couche="' + k + '" aria-pressed="' + !!M.on[k] + '" title="' + esc(titre) + '" aria-label="' + esc(LIB_COUCHE[k] + (nb ? ', ' + nb : '')) + '">' +
        glyphe(k) + '<span class="po-bn">' + esc(long ? LIB_COUCHE[k] : COURT_COUCHE[k]) + '</span>' + (nb ? '<span class="po-cn">' + nb + '</span>' : '') + '</button>';
    }
    var p = r.querySelector('#po-perim');
    if (p) p.innerHTML = '<button type="button" data-perim="only" aria-pressed="' + (M.perim === 'only') + '">Secteur de Yann</button><button type="button" data-perim="france" aria-pressed="' + (M.perim === 'france') + '">Toute la France</button>';
    z.innerHTML = ordre().map(function (k) {
      if (k !== 'robots' || !parc) return bouton(k);
      return '<div class="po-split' + (M.fab ? ' po-fab' : '') + '">' + bouton(k) +
        '<button type="button" class="po-b po-ch" data-menu-parc="1" aria-haspopup="true" aria-expanded="' + M.menuParc + '" aria-controls="po-menu" aria-label="Parc concurrent : ' + esc(libFab ? libFab + ' choisi' : 'choisir le fabricant') + '">' + IC.bas + '<i class="po-pt" aria-hidden="true"></i></button>' +
        '<div class="po-menu" id="po-menu"' + (M.menuParc ? '' : ' hidden') + '><h2 class="po-menu-t">Parc concurrent</h2>' + chipsParc() + '</div></div>';
    }).join('');
    var g = r.querySelector('#po-grille'); if (g) g.innerHTML = ordre().map(function (k) { return bouton(k, true); }).join('');
    var f = r.querySelector('#po-parc');
    if (f) { f.hidden = !parc; f.innerHTML = parc ? '<h3 class="po-menu-t">Parc concurrent</h3>' + chipsParc() : ''; }
    var t = r.querySelector('#po-tlib'), act = ordre().filter(function (k) { return M.on[k]; }).length;
    if (t) t.textContent = act + ' couche' + (act > 1 ? 's' : '') + ' affichée' + (act > 1 ? 's' : '');
  }
  /* Le tiroir du téléphone (couches, parc concurrent, tournée) : fermé, il ne garde qu'une poignée au-dessus de la carte. */
  function poserTiroir(ouvert) {
    M.tiroir = ouvert;
    var r = M.racine, t = r && r.querySelector('#po-tiroir'), b = r && r.querySelector('[data-tiroir]'), i = r && r.querySelector('#po-tact');
    if (t) t.setAttribute('data-ouvert', String(ouvert));
    if (b) b.setAttribute('aria-expanded', String(ouvert));
    if (i) i.textContent = ouvert ? 'Fermer' : 'Ouvrir';
  }
  function poserTournee(ouvert) {
    M.tourneeOuverte = ouvert;
    var r = M.racine, c = r && r.querySelector('#po-pipe'), b = r && r.querySelector('[data-tournee]');
    if (c) c.hidden = !ouvert;
    if (b) b.setAttribute('aria-expanded', String(ouvert));
  }
  function chargerTotaux() {
    var jeton = M.perim + '|' + M.fab;
    ordre().filter(function (k) { return k !== 'fiches'; }).forEach(function (k) { totalCouche(k).then(function () { if (M.racine && jeton === M.perim + '|' + M.fab) dessinerPuces(); }); });
  }
  /* « Ma tournée du jour » : les fiches dont l'action est due, dans l'ordre de visite le plus court (V1 : tournée de la carte du CRM). */
  /* 24/11/2026 — maquette 2 : un bouton posé en bas à droite de la carte ouvre la tournée au-dessus de lui ; au téléphone, elle est dans le tiroir. */
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
    var tel = M.racine.querySelector('#po-pipe-tel'); if (tel) tel.innerHTML = z.innerHTML;
    var nb = M.racine.querySelector('#po-tr-n'); if (nb) nb.textContent = stops.length ? stops.length + ' arrêt' + (stops.length > 1 ? 's' : '') : 'aucun arrêt';
  }
  function clicCarte(ev) {
    var t = ev.target, g;
    if (t.closest('[data-menu-parc]')) { M.menuParc = !M.menuParc; dessinerPuces(); return; }
    if (M.menuParc && !t.closest('.po-split')) { M.menuParc = false; dessinerPuces(); } // un clic ailleurs referme le menu du parc concurrent
    if (t.closest('[data-tiroir]')) { poserTiroir(!M.tiroir); return; }
    if (t.closest('[data-tournee]')) { poserTournee(!M.tourneeOuverte); return; }
    if ((g = t.closest('[data-vers]'))) { V2.go(g.getAttribute('data-vers')); return; }
    if (t.closest('[data-fiche-fermer]')) { fermerFiche(); return; }
    if (t.closest('[data-fiche-replier]')) { M.replie = !M.replie; dessinerFiche(); if (!M.replie) placerFiche(); return; }
    if (t.closest('[data-fiche-ajout]')) { ajouterDepuisFiche(); return; }
    if (t.closest('[data-fiche-etude]')) { if (M.sel && window.PHIRST_ETUDE) window.PHIRST_ETUDE.ouvrir(M.sel.f.lignes, { nom: M.sel.f.nom, yann: M.yann }); return; }
    if ((g = t.closest('[data-couche]'))) { var k = g.getAttribute('data-couche'); M.on[k] = !M.on[k]; if (!M.on[k]) vider(k); if (k === 'fiches') M.pistesDessinees = false; dessinerPuces(); actualiser(); return; }
    if ((g = t.closest('[data-parc]'))) {
      var duMenu = !!(g.closest && g.closest('#po-menu'));
      M.fab = g.getAttribute('data-parc'); M.menuParc = false; vider('robots'); dessinerPuces(); chargerTotaux(); actualiser();
      if (duMenu) { var c = M.racine.querySelector('[data-menu-parc]'); if (c) c.focus(); } // le menu se referme : le focus revient sur sa flèche
      return;
    }
    if ((g = t.closest('[data-perim]'))) { M.perim = g.getAttribute('data-perim'); M.totaux = {}; M.totauxP = {}; ordre().forEach(vider); M.pistesDessinees = false; dessinerPuces(); chargerTotaux(); cadrer(); actualiser(); return; }
    if (t.closest('[data-zoomer]')) { if (M.perim === 'france') M.map.setZoom(Math.max(M.map.getZoom(), P.SEUIL_COUCHES.france)); else cadrer(); setTimeout(actualiser, 50); return; }
  }
  V2.pages.carte = { needs: [], render: function (root) {
    if (M.map) { try { M.map.remove(); } catch (e) { /* carte déjà démontée */ } M.map = null; }
    M.racine = root; M.groupes = {}; M.lignes = {}; M.pts = {}; M.totaux = {}; M.totauxP = {}; M.cache = {}; M.dessine = {}; M.compte = {}; M.yann = false; M.pistesDessinees = false; M.sel = null; M.repere = null; M.replie = false; M.ficheJeton++;
    M.menuParc = false; M.tiroir = false; M.tourneeOuverte = false;
    /* 24/11/2026 — maquette « 2 · Une seule barre » : la barre d'outils juste sous la barre du haut, puis la carte jusqu'en bas de la fenêtre
       (avant : titre, phrase, deux rangées de puces et le parc concurrent, la carte ne commençait qu'à 56 % de la hauteur). */
    root.innerHTML = window.PHIRST_ECRAN.cadre('<section class="pa po po-plein" aria-label="La carte"><h1 class="po-cache">La carte</h1>' +
      '<div class="po-barre" role="group" aria-label="Périmètre et couches"><div class="po-seg" id="po-perim" role="group" aria-label="Périmètre"></div><span class="po-barre-sep" aria-hidden="true"></span>' +
      '<div class="po-couches" id="po-couches" role="group" aria-label="Couches"></div></div>' +
      '<div class="po-carte"><div id="po-map" class="po-map" role="application" aria-label="Carte des pharmacies"></div><div id="po-bandeau" class="po-bandeau" role="status" hidden></div>' +
      '<div class="po-tr"><button type="button" class="po-tr-b" data-tournee="1" aria-expanded="false" aria-controls="po-pipe"><span>Ma tournée du jour</span><b id="po-tr-n"></b>' + IC.haut + '</button><div id="po-pipe" class="po-pipe" hidden></div></div>' +
      '<section class="po-tiroir" id="po-tiroir" data-ouvert="false" aria-label="Couches de la carte"><button type="button" class="po-poignee" data-tiroir="1" aria-expanded="false" aria-controls="po-tcorps"><span id="po-tlib"></span><span id="po-tact">Ouvrir</span></button>' +
      '<div class="po-tcorps" id="po-tcorps"><div class="po-grille-c" id="po-grille" role="group" aria-label="Couches"></div><div class="po-parc" id="po-parc" hidden></div><div class="po-tr-m" id="po-pipe-tel"></div></div></section>' +
      '<div id="po-fiche-hote" class="po-fiche-hote"></div></div></section>');
    if (!root.__pc) { root.__pc = true; root.addEventListener('click', clicCarte); }
    if (!document.__poEchap) { document.__poEchap = true; document.addEventListener('keydown', toucheCarte); window.addEventListener('hashchange', quitterCarte); }
    viderTel();
    dessinerPuces();
    if (!sb()) { dire('alerte', 'Connectez-vous pour voir la carte.'); return; }
    var tour = M.tour = (M.tour || 0) + 1; // seul le DERNIER dessin de l'écran crée la carte
    chargerLeaflet(function (ok) {
      if (M.racine !== root || tour !== M.tour) return;
      if (!ok) { root.querySelector('#po-map').innerHTML = '<p class="pa-avis">La carte ne s’est pas chargée. Vérifiez votre connexion puis rouvrez cet écran.</p>'; return; }
      var L = window.L;
      M.map = L.map(root.querySelector('#po-map'), { zoomControl: false, renderer: L.canvas({ tolerance: 14 }), minZoom: 4 }).setView([46.6, 2.4], 6);
      L.control.zoom({ position: 'topright' }).addTo(M.map); // la fiche se pose en haut à gauche
      /* Le premier appui donne le focus clavier à la carte ; WebKit fait alors défiler la page pour la montrer en entier (22 px mesurés le 24/11/2026,
         Leaflet n'arrive pas à la remettre) : la carte glisse sous la souris et le clic tombe à côté du point. Focus sans défilement, mêmes touches. */
      var kb = M.map.keyboard;
      if (kb) { kb.disable(); kb._onMouseDown = function () { if (!this._focused) this._map.getContainer().focus({ preventScroll: true }); }; kb.enable(); }
      M.map.on('click', function (e) { var l = plusProche(e.containerPoint); if (l) ouvrirFiche(l); });
      var survol = 0;
      M.map.on('mousemove', function (e) { if (survol) return; survol = requestAnimationFrame(function () { survol = 0; if (M.map) M.map.getContainer().style.cursor = plusProche(e.containerPoint) ? 'pointer' : ''; }); });
      poserFond(M.map);
      P.ordreCouches(true).forEach(function (k) { M.groupes[k] = L.layerGroup().addTo(M.map); });
      cadrer();
      M.map.on('moveend', function () { clearTimeout(M.minuteur); M.minuteur = setTimeout(actualiser, 150); });
      setTimeout(function () { if (M.map) M.map.invalidateSize(); }, 50);
      lireMeta().then(function (m) { M.meta = m || {}; dessinerPuces(); });
      chargerTotaux();
      // Le rôle d'abord : la couche « Clients Intégral » n'existe que pour Yann (en cas de doute, on la tait).
      Promise.all([lirePistes(true), estTelepro().then(null, function () { return true; })]).then(function (r) {
        if (M.racine !== root) return;
        M.pistes = r[0] || []; M.ix = P.indexPistes(M.pistes); M.yann = r[1] === false;
        dessinerPuces(); dessinerTournee(); if (M.yann) chargerTotaux(); actualiser();
      });
    });
  } };
  /* Arrivée directe sur la carte : le fond de carte (Leaflet) part tout de suite, en même temps que la vérification de la connexion
     (mesuré le 24/11/2026 dans le Safari de Will : il n'était demandé qu'au bout de 2,06 s, une fois la connexion et le profil relus). */
  if (/^#carte\b/.test(location.hash || '')) chargerLeaflet(function () {});
})();
