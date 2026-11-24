/* PHIRST · écrans de Yann (aperçu 20/11/2026). Chaque écran s'inscrit dans V2.pages comme un module JARVIS :
   le menu et l'accueil le montrent tout seuls. Ici, des panneaux d'attente : le vrai contenu sera porté
   depuis les maquettes choisies par Will les 28 et 29/10. */
(function () {
  V2.pages = V2.pages || {};
  /* 22/11/2026 — écrans pas encore construits : plus de notes internes. Chacun dit en une phrase où en est la chose, et propose le geste utile
     d'aujourd'hui. [titre, phrase sous le titre, explication, [[écran, bouton], …]]. */
  /* 23/11/2026 — « Chantiers » a son vrai écran (phirst-chantiers.js) : il quitte cette table, et reste réservé à Yann (RESERVE). */
  /* 24/11/2026 — « Vitrine » a son vrai écran (phirst-vitrine.js) : il quitte cette table, et reste réservé à Yann (RESERVE ; l'écran se garde lui-même).
  */
  /* 23/11/2026 (soir) — « Réglages » a son vrai écran (phirst-reglages.js, ouvert à Yann et à la téléprospectrice) : il quitte cette table. */
  /* 24/11/2026 — « Encaisser » a son vrai écran (phirst-encaisser.js) : il quitte cette table (vide), et reste réservé à Yann (RESERVE ; l'écran se garde lui-même). */
  var E = {};
  /* L'Atelier 3D reste dans l'ancienne version de Phirst (décision de Will, 22/11/2026) : l'adresse se lit dans le réglage de la marque. */
  var ADRESSE_3D = (window.V2_BRAND && window.V2_BRAND.ancienne3d) || '';
  function ecran(root, titre, phrase, expl, boutons, lien3d) {
    var X = window.PHIRST_ECRAN;
    root.innerHTML = X.cadre('<section class="pa pa-attente" aria-label="' + X.esc(titre) + '">' + X.tete(titre, phrase) +
      '<div class="pa-vide"><p>' + X.esc(expl) + '</p><div class="pa-bs">' +
      (lien3d ? '<a class="lg-gros" href="' + X.esc(lien3d) + '" target="_blank" rel="noopener noreferrer">Ouvrir la 3D<span class="u2-sr"> (s’ouvre dans un nouvel onglet)</span></a>' : '') +
      boutons.map(function (b, i) { return '<button type="button" class="' + (i === 0 && !lien3d ? 'lg-gros' : 'pa-b') + '" data-vers="' + X.esc(b[0]) + '">' + X.esc(b[1]) + '</button>'; }).join('') +
      '</div></div></section>');
    if (!root.__pw) { root.__pw = true; root.addEventListener('click', function (ev) { var g = ev.target.closest('[data-vers]'); if (g) V2.go(g.getAttribute('data-vers')); }); }
  }
  Object.keys(E).forEach(function (k) {
    V2.pages[k] = { needs: [], render: function (root) {
      ecran(root, E[k][0], E[k][1], E[k][2], E[k][3]);
      if (RESERVE.indexOf(k) >= 0 && window.PHIRST_ROLE) window.PHIRST_ROLE.estTelepro().then(function (t) {
        if (t && V2.route && V2.route.name === k) ecran(root, E[k][0], E[k][1], 'Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.', [['appels', 'Ouvrir mes Appels'], ['agenda', 'Ouvrir l’Agenda']]);
      });
    } };
  });
  V2.pages.atelier = { needs: [], render: function (root) {
    ecran(root, 'Atelier 3D', 'Du plan 2D à la visite en 3D.', 'La 3D se fait dans la version précédente de Phirst : vos plans, vos rendus et vos visites s’y trouvent toujours, avec les mêmes identifiants. Elle s’ouvre dans un nouvel onglet.', [], ADRESSE_3D);
    // 23/11/2026 — choix de Will : l'Atelier 3D est réservé à Yann, comme Dossiers, Chantiers et Encaisser (la téléprospectrice ne fait pas de 3D).
    if (window.PHIRST_ROLE) window.PHIRST_ROLE.estTelepro().then(function (t) {
      if (t && V2.route && V2.route.name === 'atelier') ecran(root, 'Atelier 3D', 'Du plan 2D à la visite en 3D.', 'Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.', [['appels', 'Ouvrir mes Appels'], ['agenda', 'Ouvrir l’Agenda']]);
    });
  } };
  /* 21/11/2026 — la téléprospectrice ne voit ni Encaisser, ni Dossiers, ni Chantiers (écrans qui porteront des sommes) ;
     23/11/2026 — ni l'Atelier 3D (choix de Will : elle ne fait pas de 3D, et ce bouton l'envoyait vers l'ancienne version) :
     l'écran dit « Cet écran est réservé à Yann. », et la porte quitte le menu et l'accueil. Le socle ne garde que les portes
     dont la page existe (V2.pages[porte.page]) : pour elle, `page` de ces portes pointe une page absente (même mécanisme
     que `fam` de la porte « tournees » dans v2-app.js). Rôle lu dans la session (window.PHIRST_ROLE, phirst-appels.js). */
  var RESERVE = ['dossiers', 'chantiers', 'encaisser', 'atelier', 'vitrine'], telepro = false;
  var portes = window.V2_BRAND && window.V2_BRAND.portes;
  if (portes) RESERVE.forEach(function (k) {
    var d = portes[k]; if (!d) return;
    var vraie = d.page;
    Object.defineProperty(d, 'page', { enumerable: true, configurable: true, get: function () { return telepro ? 'reserve-a-yann' : vraie; } });
  });
  /* Le rôle n'est connu qu'une fois la session ouverte : on le lit dès que V2.user change, et on redessine si cela change les portes. */
  /* La barre du haut de l'accueil est dessinée avant que son rôle soit connu, et V2.render() ne la redessine pas (mesuré en ligne
     le 21/11/2026 : « Dossiers de projet » et « Chantiers » y restaient). Pour elle, on retire aussi les liens déjà affichés vers
     ces écrans, et ceux de chaque rendu suivant. */
  function retirer() {
    if (!telepro) return;
    RESERVE.forEach(function (k) {
      document.querySelectorAll('[data-tp-act="go:' + k + '"], a[href="#' + k + '"]').forEach(function (a) { a.remove(); });
    });
  }
  new MutationObserver(retirer).observe(document.documentElement, { childList: true, subtree: true });
  var vu = null;
  setInterval(function () {
    var id = V2.user && V2.user.id; if (id === vu) return;
    vu = id;
    if (!id) { telepro = false; return; }
    if (!window.PHIRST_ROLE) return;
    window.PHIRST_ROLE.estTelepro().then(function (t) {
      if (!V2.user || V2.user.id !== id || t === telepro) return;
      telepro = t;
      retirer();
      if (typeof V2.render === 'function') V2.render();
    });
  }, 150);
})();
