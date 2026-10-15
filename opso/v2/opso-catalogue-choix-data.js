// Choix sur « Le catalogue » OPSO — retour du 15/10/2026 sur le CSV. Lu par opso-catalogue.js (construire()).
// PUBLIC : des CIP, rien d'autre (jamais un prix).
// retirer : jamais affiché, même parmi les plus commandés (sa place n'est pas reprise par le suivant).
// ajouter : toujours affiché, à son rang par nombre de pharmacies, même au-delà des premiers du rayon.
window.OPSO_CATALOGUE_CHOIX = {
  retirer: [
    '3400930028582'   // REPATHA 140MG INJ STYLO1ML 1 (stock trop faible)
  ],
  ajouter: [
    '3400930037904',  // ENTRESTO 24MG/26MG CPR BT28
    '3400930037911',  // ENTRESTO 49MG/51MG CPR BT56
    '3400930037928',  // ENTRESTO 97MG/103MG CPR BT56
    '3400930277133',  // ENTRESTO 15MG/16MG GELU BT60
    '3400937071253',  // RHINOMAXIL 100MCG NAS PULV120D
    '3400937071024',  // RINOCLENIL 100MCG NAS PULV120D
    '3400930234976',  // UVEDOSE 50000UI CAPS MOL BT2
    '3400930234983',  // UVEDOSE 50000UI CAPS MOL BT4
    '3400933222185',  // UVEDOSE 100000UI BUV AMP2ML 1
    '3400930249680',  // CHOLECAL SUBSTIPHARM 200 000 UI AMP1 — prix de l'app retenus (décision de Will, 15/10)
    '3400930258347',  // CHOLECAL SUBSTIPHARM 50 000 UI AMP1
    '3400930258361',  // CHOLECAL SUBSTIPHARM 50 000 UI AMP4
    '3400930249673'   // CHOLECAL SUBSTIPHARM 80 000 UI AMP1
  ]
};
