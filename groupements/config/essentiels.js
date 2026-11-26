/* ════════════════════════════════════════════════════════════════
   Réglage du groupement Essentiels Pharma — couche « groupement » commune (option B, 26/11/2026)
   Will : OPSO et Essentiels Pharma = le MÊME code JARVIS, seule la charte change.
   Chargé par essentiels/v2/index.html AVANT v2-boot.js, qui le lit (V2.groupement,
   V2.enGroupement(), V2.conditionsCachees(), V2.accesGroupement()).
   Modèle : groupements/config/opso.js.
   Rien de chiffré ni de nominatif ici : ce fichier est public.
   ════════════════════════════════════════════════════════════════ */
window.V2_GROUPEMENT = {
  id: 'essentiels',
  nom: 'Essentiels Pharma',
  // Forme courte, pour les phrases (« adhérentes Essentiels », colonne « dont Essentiels »).
  court: 'Essentiels',
  // Nom du groupement tel qu'écrit sur chaque ligne du périmètre (champ `groupement` des officines).
  libelle: 'ESSENTIELS PHARMA',
  // Clé de la liste des comptes admis dans crm/v2/v2-comptes.js (garde d'écran) ;
  // le vrai verrou serveur est jarvis_acces_essentiels(), qui garde les documents `essentiels/…`.
  acces: 'essentiels',
  // Aucun jeu de ventes « Essentiels » à fabriquer : les trois comptes admis sont admin avec
  // voit_tous_commerciaux (mesuré le 26/11/2026), ils chargent donc les fichiers de ventes complets.
  // Le périmètre est ensuite borné côté écran par V2.appliquerPerimetreGroupement.
  jeuVentes: null,
  // Contrairement à OPSO (mode « consultation »), les comptes Essentiels lisent déjà ces fichiers
  // dans JARVIS : prix nets, marges et abandons de marge restent visibles.
  conditionsVisibles: true,
  // Périmètre = les officines que la table de départ de groupement-alias.js (GRP_DEPART, publique)
  // range sous ce nom de groupement ; nom/ville des non clientes lus dans la base nationale publique.
  perimetre: { source: 'alias', valeur: 'Essentiels Pharma' },
  // Pas de ligne « Suivi des groupements » dans le menu du compte : elle cite OPSO (Will, 26/11 : zéro « OPSO » dans l'app Essentiels). Absent = ligne posée (OPSO, JARVIS).
  menuGroupements: false,
  // Textes de la tuile « Tableau de bord » (accueil et ⌘K) : OPSO y promet « la rémunération », qui n'existe que chez lui.
  // Ici, seulement ce que l'écran montre (relevé étape 4 : le chiffre, le mois, mois par mois, ce que les adhérentes achètent, la trajectoire).
  textes: {
    bordTuile: 'Le chiffre, le mois, ce qu\'elles achètent, la trajectoire',
    bordTuileLong: 'Le chiffre du groupement, le mois, ce que les adhérentes achètent et la trajectoire de l\'année.',
    bordPalette: 'Tableau de bord · chiffre, mois, trajectoire'
  }
};
