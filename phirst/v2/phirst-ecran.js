/* PHIRST · le cadre commun des écrans (22/11/2026) : même haut partout, comme les écrans de JARVIS (To do, Bloc-notes).
   Une barre en haut (retour, accueil, rubriques, recherche, compte : V2.topbar, la même que celle de JARVIS), puis un titre de la même
   taille à chaque largeur (phirst-finitions.css), une phrase, et le contenu dans la même largeur. Aucune logique ici : de l'habillage. */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.PHIRST_ECRAN = {
    /* La barre du haut + la section de l'écran. `section` = le HTML de l'écran (un <section class="pa …">). */
    cadre: function (section) {
      return (typeof V2.topbar === 'function' ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '') + section;
    },
    /* Le titre et sa phrase. `maj` (facultatif) = « Mise à jour ce matin à 7 h 05 », déjà prêt à afficher. */
    tete: function (titre, phrase, maj) {
      return '<header class="pa-tete"><h1>' + esc(titre) + '</h1>' + (phrase ? '<p>' + esc(phrase) + '</p>' : '') +
        (maj ? '<p class="pa-maj">' + esc(maj) + '</p>' : '') + '</header>';
    },
    /* Un écran qui n'a rien à montrer dit quoi faire : une phrase, un bouton (data-vers = l'écran où il mène). */
    vide: function (titre, consigne, bouton, vers) {
      return '<div class="pa-vide"><p>' + esc(titre) + '</p>' + (consigne ? '<p>' + esc(consigne) + '</p>' : '') +
        (bouton ? '<button type="button" class="lg-gros" data-vers="' + esc(vers) + '">' + esc(bouton) + '</button>' : '') + '</div>';
    },
    esc: esc
  };
})();
