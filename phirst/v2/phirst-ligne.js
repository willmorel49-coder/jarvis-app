/* PHIRST · accueil « La course du soleil » (n° 6, choisie par Will le 20/11/2026), posé sous l'aube du socle JARVIS.
   Les quatre moments d'une affaire sont les heures du jour (Trouver le matin, Encaisser le soir) ; l'astre de l'aube
   glisse au-dessus du moment choisi. Téléphone (≤ 1000 px) : maquette A « le rail » (choix de Will, 20/11/2026), tout
   entière dans phirst-ligne.css.
   Données : window.PHIRST_LIGNE = [{ cle, mot, pharmacies: [{ nom, ville, etiquette: { t, ton } }], total, autres,
   chose: { titre, heure, detail, parution, bouton }, vide: { texte, bouton } }] — chaque moment qui peut être vide porte « vide ».
   Elles viennent de la base Phirst, JAMAIS d'un fichier du dépôt : table ligne_accueil, SA ligne seule, recalculée chaque
   matin par le robot du Mac (~/phirst-ligne/, choix de Will du 20/11/2026). Posées d'avance dans window.PHIRST_LIGNE
   (sondes), elles ne sont pas relues. Sans données, ligne illisible ou calculée il y a plus de 36 h (ses « J-5 » seraient
   faux), rien ne s'affiche : l'accueil sobre reste tel quel. Un moment vide dit quoi faire pour se remplir, jamais « 0 »
   ni « rien de prévu » (Will, 20/11/2026). */
(function () {
  'use strict';
  var R = document.documentElement, D = null, cle = null, pour = null, AGE_MAX = 36 * 3600 * 1000;
  function poser(d) {
    if (!Array.isArray(d) || !d.length) return false;
    D = d; cle = D[0].cle;
    /* crochets de la galerie du 20/11/2026, gardés tels quels : la feuille reste celle qui a été prouvée */
    R.setAttribute('data-ligne', '6'); R.setAttribute('data-donnees', 'reelles'); R.setAttribute('data-tel', 'a');
    return true;
  }
  var DAVANCE = poser(window.PHIRST_LIGNE);
  /* une fois par compte connecté : SA ligne (la règle de la base ne rend que celle-là) */
  function charger() {
    var V2 = window.V2, u = V2 && V2.user;
    if (DAVANCE || !u || pour === u.id || typeof V2.sb !== 'function') return;
    var sb = V2.sb(); if (!sb) return;
    if (pour) { D = null; var vieux = document.getElementById('lg-ligne'); if (vieux) vieux.remove(); }
    pour = u.id;
    /* Téléprospectrice (21/11/2026) : pas de ligne_accueil (la base la lui rend vide) ; le SEUL moment « Trouver » est fabriqué
       avec telepro_ligne (phirst-pur.js, momentDeTelepro) : jamais Préparer, Chantier, Encaisser ni somme. */
    var RL = window.PHIRST_ROLE, P = window.PHIRST_PUR;
    (RL && P && P.momentDeTelepro ? RL.estTelepro() : Promise.resolve(false)).then(function (t) {
      if (t) return sb.rpc('telepro_ligne').then(function (r) {
        var m = r && !r.error ? P.momentDeTelepro(P.ligneDeTelepro(r.data, Date.now())) : null;
        if (m && window.V2.user && window.V2.user.id === u.id && poser(m)) monter();
      });
      return sb.from('ligne_accueil').select('donnees,calcule_le').eq('user_id', u.id).maybeSingle().then(function (r) {
        var x = r && !r.error && r.data;
        if (!x || !(Date.now() - Date.parse(x.calcule_le) <= AGE_MAX)) return;
        if (window.V2.user && window.V2.user.id === u.id && poser(x.donnees)) monter();
      });
    }).then(null, function () {});
  }
  /* « aujourd'hui », « hier » ou « le 17 novembre » (même format que dateCourte de la V1), à l'heure de Paris */
  function depuis(iso) {
    var p = {}, j0 = String(iso).slice(0, 10);
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var j = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - Date.parse(j0)) / 864e5);
    return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : 'le ' + new Date(j0).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }) + (j0.slice(0, 4) === p.year ? '' : ' ' + j0.slice(0, 4));   // 22/11/2026 : l'année quand ce n'est pas celle du jour
  }
  /* nombre de pharmacies d'un moment : « total » quand la liste n'en montre qu'une partie (veille), sinon la liste */
  function nb(s) { return s.total != null ? s.total : s.pharmacies.length; }
  function avenir(s) { return nb(s) === 0 && !!s.vide; }
  /* pastille : l'initiale du nom parlant (« Pharmacie des Tilleuls » → T), sur un disque vert, sans appel réseau */
  var MOTS_VIDES = /^(pharmacie|pharmacies|phie|grande|nouvelle|de|du|des|la|le|les|l|d|et|en)$/i;
  function initiale(nom) {
    var m = String(nom || '').split(/[\s'’-]+/).filter(function (w) { return w && !MOTS_VIDES.test(w); })[0] || String(nom || '?');
    return m.charAt(0).toUpperCase();
  }
  var FL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/'/g, '’'); }   // 25/11 : apostrophe courbe (textes venus du robot)
  /* où mène chaque bouton (pages de phirst-portes.js), 20/11/2026. Les textes viennent du robot (~/phirst-ligne/ligne-vers-base.mjs,
     VIDE et GESTE ; boutons de chosesDuJour de la V1) : changer un texte là-bas = revoir sa page ici.
     Consigne d'un moment vide : « Ouvrir la Veille », « Ouvrir un dossier », « Voir mes dossiers », « Voir mes chantiers ».
     Chose n° 1 : le geste du moment (« Voir la fiche et appeler », « Ouvrir le dossier », « Voir le chantier », « Noter un paiement »).
     « L'ajouter à mes pistes » (chose de la veille) n'ouvre aucune page : il crée la fiche (ajouter, plus bas ; décision de
     Will du 20/11/2026). Une page absente du menu = pas de lien. */
  var VIDE_VERS = { trouver: 'veille', preparer: 'dossiers', chantier: 'dossiers', encaisser: 'chantiers' };
  var GESTE_VERS = { trouver: 'appels', preparer: 'dossiers', chantier: 'chantiers', encaisser: 'encaisser' };
  function vers(p) { return p && window.V2 && V2.pages && V2.pages[p] ? ' data-vers="' + esc(p) + '"' : ''; }
  function pastille(p, n) { return '<span class="lg-ini" aria-hidden="true" style="width:' + n + 'px;height:' + n + 'px">' + esc(initiale(p.nom)) + '</span>'; }
  function station(s) {
    var n = nb(s), av = avenir(s);
    return '<li><button type="button" class="lg-st" data-k="' + esc(s.cle) + '" aria-pressed="' + (s.cle === cle) + '" aria-label="' + esc(s.mot) + ' : ' + (av ? 'à venir' : n + ' pharmacie' + (n > 1 ? 's' : '')) + '">' +
      '<span class="lg-n' + (av ? ' lg-avenir' : '') + '">' + (av ? '—' : n) + '</span><span class="lg-m">' + esc(s.mot) + '</span></button></li>';
  }
  /* 25/11/2026 — la pharmacie de la grande carte « La chose n° 1 » n'est pas redite dans la liste du dessous (son titre commence par son nom). */
  function estLaChose(c, p) {
    var t = norm(c && c.titre), n = norm(p && p.nom);
    return !!n && t.indexOf(n) === 0 && (t.length === n.length || /^(,| ·| —| -|\s—|\s-)/.test(t.slice(n.length)));
  }
  /* 25/11/2026 — au téléphone la liste ne montre que 5 pharmacies (les suivantes sont cachées par la feuille de style, jamais retirées) ;
     le lien « Voir les N autres » compte ce qui reste : le total du moment, moins la pharmacie de la grande carte, moins les 5 montrées. */
  var MONTRES_TEL = 5;
  function lignes(liste) {
    return liste.map(function (p, i) { return '<li' + (i >= MONTRES_TEL ? ' class="lg-apres"' : '') + '>' + pastille(p, 48) + '<span><b>' + esc(p.nom) + '</b><small>' + esc(p.ville) + '</small><em class="lg-et"' + (p.etiquette.ton ? ' data-ton="' + esc(p.etiquette.ton) + '"' : '') + '>' + esc(p.etiquette.t) + '</em></span></li>'; }).join('');
  }
  function panneau() {
    var s = D.filter(function (x) { return x.cle === cle; })[0]; if (!s) return '';
    var c = s.chose, n = nb(s), h = '<div class="lg-pan" aria-live="polite"><div class="lg-une">';
    if (!c && avenir(s)) /* moment vide : ce qu'il faut faire pour qu'il se remplisse, et le bouton pour le faire */
      return h + '<p class="lg-sur"><i></i>' + esc(s.mot) + ' · à venir</p><p class="lg-consigne">' + esc(s.vide.texte) + '</p>' +
        '<button type="button" class="lg-gros"' + vers(VIDE_VERS[s.cle]) + '>' + esc(s.vide.bouton) + FL + '</button></div></div>';
    h += '<p class="lg-sur"><i></i>' + (c ? 'La chose n° 1 · ' : '') + esc(s.mot) + '</p>';
    var det = c && (c.parution ? 'Paru au BODACC ' + depuis(c.parution) + '.' : (window.PHIRST_PUR && c.detail ? window.PHIRST_PUR.datesLisibles(c.detail, window.PHIRST_PUR.aujourdhui()) : c.detail));
    if (c) h += '<p class="lg-titre">' + esc(c.titre) + '</p><p class="lg-det">' + esc(c.heure) + (det ? ' · ' + esc(det) : '') + '</p><button type="button" class="lg-gros"' + (c.type === 'veille' ? (c.piste ? ' data-piste="1"' : '') : vers(GESTE_VERS[s.cle])) + '>' + esc(c.bouton) + FL + '</button>' +
      (c.type === 'veille' ? '<p class="lg-dit" role="status"></p>' : '');
    var sortie = c ? s.pharmacies.filter(function (p) { return estLaChose(c, p); }).length : 0;   // la pharmacie de la grande carte, déjà comptée dans n
    var reste = Math.max(n - sortie, s.pharmacies.length - sortie) - MONTRES_TEL;
    var ou = s.source === 'appels' ? 'appels' : s.source === 'veille' || s.cle === 'trouver' ? 'veille' : VIDE_VERS[s.cle];
    var suite = reste > 0 ? '<button type="button" class="lg-suite"' + vers(ou) + '>Voir ' + (reste > 1 ? 'les ' + reste + ' autres' : '1 autre') + (ou === 'veille' ? ' dans la Veille' : ou === 'appels' ? ' dans Appels' : '') + FL + '</button>' : '';
    h += '</div><div class="lg-liste"><p class="lg-lt">' + n + ' pharmacie' + (n > 1 ? 's' : '') + ' à ce moment</p><ul>' + lignes(c ? s.pharmacies.filter(function (p) { return !estLaChose(c, p); }) : s.pharmacies);
    return h + '</ul>' + suite + (s.autres ? '<button type="button" class="lg-autres"' + vers(s.source === 'appels' ? 'appels' : s.source === 'veille' || s.cle === 'trouver' ? 'veille' : VIDE_VERS[s.cle]) + '>' + esc(s.autres) + FL + '</button>' : '') + '</div></div>';
  }
  /* « L'ajouter à mes pistes » : crée la fiche comme ajouterAuPipeline de la V1 (~/phirst-studio/app/crm/actions.ts l. 56-114) —
     dans SON espace, pas de doublon par nom + ville (toute étape, archivées comprises), étape « à qualifier », source « transfert »,
     la note de la veille dans crm_activities. Champs fournis par le robot (chose.piste). Le bouton dit ce qui s'est passé. */
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  /* La création elle-même, partagée avec l'écran Veille (window.PHIRST_PISTE.ajouter) : rend une promesse du message à dire.
     p = { nom, ville, cp, departement, lat, lon, note } ; l'écran Officines ajoute { source, pharmacien, telephone, email, groupement } (21/11/2026 ; sans eux : « transfert », comme avant). */
  function ajouterPiste(p) {
    var V2 = window.V2, u = V2 && V2.user, sb = u && typeof V2.sb === 'function' ? V2.sb() : null;
    if (!p || !sb) return Promise.resolve(PAS);
    var R = window.PHIRST_ROLE;
    return (R ? R.estTelepro() : Promise.resolve(false)).then(function (t) { return t ? ajouterParTelepro(p, sb) : ajouterParMembre(p, u, sb); }, function () { return PAS; });
  }
  /* Téléprospectrice (21/11/2026) : pas membre de l'espace ; ses pistes par telepro_pistes, la création par telepro_creer_piste
     (source « transfert »), la note de la veille par telepro_ecrire. Même comparaison nom + ville, mêmes messages. */
  function ajouterParTelepro(p, sb) {
    return sb.rpc('telepro_pistes').then(function (f) {
      if (f.error || !Array.isArray(f.data)) return PAS;
      var k = norm(p.nom) + '|' + norm(p.ville);
      if (f.data.some(function (x) { var c = norm(x.nom) + '|' + norm(x.ville); return c === k || (p.cles || []).indexOf(c) >= 0; })) return 'Déjà dans vos pistes.';
      // 23/11/2026 — ses fiches archivées (telepro_archivees) : telepro_creer_piste ne les voit pas et en créerait une deuxième. Fonction absente = comme avant.
      return Promise.resolve(sb.rpc('telepro_archivees')).then(null, function () { return {}; }).then(function (a) {
        if (a && !a.error && Array.isArray(a.data) && a.data.some(function (x) { var c = norm(x.nom) + '|' + norm(x.ville); return c === k || (p.cles || []).indexOf(c) >= 0; })) return ARCH;
        return creerParTelepro(p, sb);
      });
    }).then(null, function () { return PAS; });
  }
  function creerParTelepro(p, sb) {
      return sb.rpc('telepro_creer_piste', { p_nom: p.nom, p_ville: p.ville || null, p_cp: p.cp || null, p_departement: p.departement || null, p_telephone: p.telephone || null, p_email: p.email || null,
        p_pharmacien: p.pharmacien || null, p_lat: p.lat == null ? null : p.lat, p_lon: p.lon == null ? null : p.lon, p_source: p.source || 'transfert' }).then(function (n) {
        if (n.error || !n.data) return PAS;
        function fin() { return 'Ajoutée à vos pistes.'; }
        if (!p.note) return fin();
        return sb.rpc('telepro_ecrire', { p_prospect: n.data, p_type: 'note', p_body: p.note }).then(fin, fin);
      });
  }
  function ajouterParMembre(p, u, sb) {
    return sb.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle().then(function (m) {
      var ws = m && !m.error && m.data && m.data.workspace_id;
      if (!ws) return PAS;
      return sb.from('crm_prospects').select('id,nom,ville').eq('workspace_id', ws).then(function (f) {
        if (f.error) return PAS;
        var k = norm(p.nom) + '|' + norm(p.ville);
        if ((f.data || []).some(function (x) { var c = norm(x.nom) + '|' + norm(x.ville); return c === k || (p.cles || []).indexOf(c) >= 0; })) return 'Déjà dans vos pistes.';
        return sb.from('crm_prospects').insert({ workspace_id: ws, nom: p.nom, ville: p.ville, cp: p.cp, departement: p.departement,
          stage: 'a_qualifier', source: p.source || 'transfert', lat: p.lat, lon: p.lon,
          pharmacien: p.pharmacien || null, telephone: p.telephone || null, email: p.email || null, groupement: p.groupement || null }).select('id').single().then(function (n) {
          if (n.error || !n.data) return PAS;
          function fin() { return 'Ajoutée à vos pistes.'; }
          if (!p.note) return fin();
          return sb.from('crm_activities').insert({ prospect_id: n.data.id, type: 'note', body: p.note }).then(fin, fin);
        });
      });
    }).then(null, function () { return PAS; });
  }
  /* 23/11/2026 (Will) — « Reprendre » une fiche archivée : la même fiche revient « à qualifier », son historique reste. Membre : mise à jour gardée sur
     l'étape d'origine (une seule ligne, relue) ; téléprospectrice : telepro_reprendre_piste (son espace, archivées seulement). */
  var REPRISE = 'Reprise dans vos pistes.', ARCH = 'Sa fiche est archivée : reprenez-la depuis l’écran Officines.';
  function reprendrePiste(id) {
    var V2 = window.V2, u = V2 && V2.user, sb = u && typeof V2.sb === 'function' ? V2.sb() : null;
    if (!id || !sb) return Promise.resolve(PAS);
    var R = window.PHIRST_ROLE;
    return (R ? R.estTelepro() : Promise.resolve(false)).then(function (t) {
      if (t) return sb.rpc('telepro_reprendre_piste', { p_prospect: id }).then(function (r) { return r.error || r.data !== true ? PAS : REPRISE; });
      return sb.from('crm_prospects').update({ stage: 'a_qualifier' }).eq('id', id).eq('stage', 'archive').select('id').then(function (r) {
        return r.error || !Array.isArray(r.data) || r.data.length !== 1 ? PAS : REPRISE;
      });
    }, function () { return PAS; }).then(null, function () { return PAS; });
  }
  window.PHIRST_PISTE = { ajouter: ajouterPiste, reprendre: reprendrePiste, norm: norm, REPRISE: REPRISE };
  function ajouter(btn) {
    var s = D && D.filter(function (x) { return x.cle === cle; })[0], p = s && s.chose && s.chose.piste;
    var dit = btn.parentNode.querySelector('.lg-dit');
    function dire(t) { if (dit) dit.textContent = t; btn.disabled = false; }
    if (!p) return dire(PAS);
    btn.disabled = true; if (dit) dit.textContent = '';
    ajouterPiste(p).then(dire);
  }
  /* l'astre (et son halo, ses anneaux, son reflet) glisse au-dessus du moment choisi */
  function soleil() {
    var a = document.getElementById('aube-acc'), c = document.getElementById('aube-champ'), b = document.querySelector('#lg-ligne [aria-pressed="true"]');
    if (!a || !c || !b) return;
    var cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
    a.style.setProperty('--lg-dx', Math.round(br.left + br.width / 2 - (cr.left + cr.width / 2)) + 'px');
  }
  function dessiner(el) {
    el.innerHTML = '<ol class="lg-rail" aria-label="Les quatre moments">' + D.map(station).join('') + '</ol>' + panneau();
    soleil();
  }
  function monter() {
    charger();
    if (!D) return;
    var champ = document.getElementById('aube-champ');
    if (!champ || !document.getElementById('aube-acc') || document.getElementById('lg-ligne')) return;
    var el = document.createElement('section'); el.id = 'lg-ligne'; el.className = 'lg lg-v6' + (D.length === 1 ? ' lg-seul' : '');   /* un seul moment (téléprospectrice) : station centrée */ el.setAttribute('aria-label', 'Vos pharmacies en route');
    champ.parentNode.insertBefore(el, champ.nextSibling);
    el.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-vers]');
      if (g) { if (window.V2 && typeof V2.go === 'function') V2.go(g.getAttribute('data-vers')); return; }
      var a = ev.target.closest('[data-piste]'); if (a) { ajouter(a); return; }
      var b = ev.target.closest('[data-k]'); if (!b) return;
      cle = b.getAttribute('data-k'); dessiner(el);
    });
    dessiner(el);
    setTimeout(soleil, 400); setTimeout(soleil, 1500);
  }
  window.addEventListener('resize', soleil);
  new MutationObserver(monter).observe(document.documentElement, { childList: true, subtree: true });
  monter();
})();
