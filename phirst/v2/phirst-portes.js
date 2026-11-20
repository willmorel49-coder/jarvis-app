/* PHIRST · écrans de Yann (aperçu 20/11/2026). Chaque écran s'inscrit dans V2.pages comme un module JARVIS :
   le menu et l'accueil le montrent tout seuls. Ici, des panneaux d'attente : le vrai contenu sera porté
   depuis les maquettes choisies par Will les 28 et 29/10. */
(function () {
  V2.pages = V2.pages || {};
  var E = {
    dossiers: ['Dossiers de projet', 'Chaque agencement, du premier relevé à la réception', 'Dossiers m1 + Fiche m1 (famille 4)'],
    chantiers:['Chantiers', 'Ce qui se monte cette semaine, et ce qui bloque', 'Chantiers m4 (famille 1)'],
    officines:['Officines', 'Trouver une pharmacie, sa fiche, son historique', 'Trouver m1 + Officines m1 + Fiche m1'],
    carte:    ['La carte', 'Le secteur, les signaux d’achat, les chantiers', 'Carte m1 + Carte CRM m1 (famille 3)'],
    encaisser:['Encaisser', 'Acomptes, situations et soldes', 'Encaisser m1 (famille 1)'],
    appels:   ['Appels', 'La liste du jour et les rappels', 'Appels m3 + Pipeline m2 + Piste m2 (famille 2)'],
    veille:   ['Veille', 'Reprises d’officines (BODACC) et marchés publics (BOAMP)', 'Veille m1 (famille 2)'],
    atelier:  ['Atelier 3D', 'Du plan 2D à la maquette, puis la visite', 'Atelier, Visite, Viseur, Rendu m1 (famille 4)'],
    vitrine:  ['Vitrine', 'Ce que voit un pharmacien', 'Vitrine m1 (famille 5)'],
    reglages: ['Réglages', 'Compte, accès, préférences', 'Réglages m1 (famille 5)']
  };
  /* 21/11/2026 — la téléprospectrice ne voit ni Encaisser, ni Dossiers, ni Chantiers (écrans qui porteront des sommes) :
     l'écran dit « Cet écran est réservé à Yann. », et la porte quitte le menu et l'accueil. Le socle ne garde que les portes
     dont la page existe (V2.pages[porte.page]) : pour elle, `page` de ces trois portes pointe une page absente (même mécanisme
     que `fam` de la porte « tournees » dans v2-app.js). Rôle lu dans la session (window.PHIRST_ROLE, phirst-appels.js). */
  var RESERVE = ['dossiers', 'chantiers', 'encaisser'], telepro = false;
  Object.keys(E).forEach(function (k) {
    V2.pages[k] = { needs: [], render: function (root) {
      root.innerHTML = '<section class="ph-apercu"><span class="ph-tag">Aperçu Phirst · socle JARVIS</span><h1>' + E[k][0] +
        '</h1><p>' + E[k][1] + '.</p><p>Cet écran arrive bientôt.</p></section>';
      if (RESERVE.indexOf(k) >= 0 && window.PHIRST_ROLE) window.PHIRST_ROLE.estTelepro().then(function (t) {
        if (t) root.innerHTML = '<section class="ph-apercu"><h1>' + E[k][0] + '</h1><p>Cet écran est réservé à Yann.</p></section>';
      });
    } };
  });
  var portes = window.V2_BRAND && window.V2_BRAND.portes;
  if (portes) RESERVE.forEach(function (k) {
    var d = portes[k]; if (!d) return;
    var vraie = d.page;
    Object.defineProperty(d, 'page', { enumerable: true, configurable: true, get: function () { return telepro ? 'reserve-a-yann' : vraie; } });
  });
  /* Le rôle n'est connu qu'une fois la session ouverte : on le lit dès que V2.user change, et on redessine si cela change les portes. */
  var vu = null;
  setInterval(function () {
    var id = V2.user && V2.user.id; if (id === vu) return;
    vu = id;
    if (!id) { telepro = false; return; }
    if (!window.PHIRST_ROLE) return;
    window.PHIRST_ROLE.estTelepro().then(function (t) {
      if (!V2.user || V2.user.id !== id || t === telepro) return;
      telepro = t;
      if (typeof V2.render === 'function') V2.render();
    });
  }, 150);
})();
