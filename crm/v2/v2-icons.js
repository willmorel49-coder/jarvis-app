/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Iconographie sur-mesure — dessinée à la main, zéro emoji.
   Style cohérent : stroke 1.7, bouts arrondis, parti-pris géométrique
   propre à Intégral Pharma. Usage : ICO('opp', 26)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // chaque entrée = contenu interne du <svg viewBox="0 0 24 24">
  var P = {
    // monogramme croix pharma (logo)
    'logo': '<path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".95"/><circle cx="12" cy="12" r="3.1" fill="#fff" opacity=".22" stroke="none"/>',
    // pilier 1 — Opportunités : viseur/radar avec rayon
    'opp': '<circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.4"/><circle cx="11" cy="13" r=".5" fill="currentColor" stroke="none"/><path d="M11 13 17.5 6.5"/><path d="M15 5.4h3.1v3.1"/>',
    // pilier 2 — Fiches : document coin plié + lignes
    'fiche': '<path d="M6.5 3.5h7L19 9v10.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M13.2 3.6V9H18.6"/><path d="M8.6 13h6.8M8.6 16.4h4.4"/>',
    // pilier 3 — Catalogue : tiroirs d'apothicaire
    'cat': '<rect x="3.5" y="4" width="17" height="6.2" rx="1.6"/><rect x="3.5" y="13.8" width="17" height="6.2" rx="1.6"/><path d="M9.6 7.1h4.8M9.6 16.9h4.8"/>',
    // pilier 4 — Pilotage : axes + courbe + barres
    'pilo': '<path d="M4 4v14.5a1.5 1.5 0 0 0 1.5 1.5H20"/><path d="M7.5 16.5 11.5 12l3 2.2L20 7.5"/><path d="M16.5 7.5H20v3.4"/>',
    // recherche
    'search': '<circle cx="10.5" cy="10.5" r="7"/><path d="m20 20-4.2-4.2"/>',
    // retour
    'back': '<path d="M15 5l-7 7 7 7"/>',
    // chevron droite
    'chev': '<path d="M9 6l6 6-6 6"/>',
    // plus
    'plus': '<path d="M12 5v14M5 12h14"/>',
    // pharmacie (officine : façade + croix)
    'pharma': '<path d="M4 9.5 12 4l8 5.5"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9"/><path d="M12 11.5v4M10 13.5h4"/>',
    // froid (flocon simplifié)
    'froid': '<path d="M12 3v18M5 7l14 10M19 7 5 17M9 5l3 2 3-2M9 19l3-2 3 2"/>',
    // pilule (générique/produit)
    'pill': '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M8.8 7.2 14 16.4"/>',
    // euro / marge
    'euro': '<path d="M16.5 5.5a6.5 6.5 0 1 0 0 13M5 9.5h7M5 13.5h6"/>',
    // download / pdf
    'download': '<path d="M12 3v11M8 10.5l4 4 4-4"/><path d="M5 18.5h14"/>',
    // alerte
    'alert': '<path d="M12 4 3 19.5h18z"/><path d="M12 10v4M12 17h.01"/>',
    // check
    'check': '<path d="M5 12.5 10 17.5 19 6.5"/>',
    // panier
    'cart': '<path d="M3 4h2.4l2 11.5a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2"/><circle cx="9.5" cy="20" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.5" cy="20" r="1.1" fill="currentColor" stroke="none"/>',
    // calendrier / visite
    'cal': '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    // étincelle / nouveau
    'spark': '<path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z"/>',
    // utilisateur
    'user': '<circle cx="12" cy="8" r="4"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
    // déconnexion
    'logout': '<path d="M14 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8"/><path d="M17 8l4 4-4 4M21 12H10"/>',
    // grille (vue)
    'grid': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    // liste (vue)
    'list': '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    // croix close
    'close': '<path d="M6 6l12 12M18 6 6 18"/>',
  };

  function ICO(name, size, strokeW) {
    var inner = P[name] || P['chev'];
    var s = size || 24;
    var sw = strokeW || 1.7;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  window.ICO = ICO;
  window.V2_ICONS = P;
})();
