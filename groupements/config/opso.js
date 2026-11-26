/* ════════════════════════════════════════════════════════════════
   Réglage du groupement OPSO Santé — couche « groupement » commune (option B, 26/11/2026)
   Will : OPSO et Essentiels Pharma = le MÊME code JARVIS, seule la charte change.
   Chargé par opso/v2/index.html AVANT v2-boot.js, qui le lit (V2.groupement,
   V2.enGroupement(), V2.conditionsCachees(), V2.accesGroupement()).
   Rien de chiffré ni de nominatif ici : ce fichier est public.
   ════════════════════════════════════════════════════════════════ */
window.V2_GROUPEMENT = {
  id: 'opso',
  nom: 'OPSO Santé',
  // Forme courte, pour les phrases (« adhérentes OPSO », colonne « dont OPSO »).
  court: 'OPSO',
  // Clé de la liste des comptes admis dans crm/v2/v2-comptes.js (garde d'écran) ;
  // le vrai verrou reste côté Supabase (jarvis_acces_opso).
  acces: 'opso',
  // Dossier du jeu de ventes d'un commercial restreint dans cet espace (ventes/<empreinte>/).
  jeuVentes: 'OPSO',
  // OPSO = mode « consultation » : aucun fichier de conditions (marges, abandons, clients actifs…).
  conditionsVisibles: false,
  // Carte « Nos tournées et les adhérentes » (étape 8b, 26/11/2026 ; écran commun groupements/v2/groupement-tournees.js).
  // Les tournées, les positions et les détours se LISENT dans les fichiers (tournées protégées, base nationale) : rien de chiffré ici.
  // Absente pour le rôle opso (ni tuile, ni ⌘K, ni écran). `lettre` = devant le numéro de chaque adhérente sur la carte.
  tournees: {
    titre: 'Nos tournées et les adhérentes',
    lettre: 'O',
    tuile: 'Nos tournées de livraison sur la carte, les adhérentes déjà livrées et, pour les autres, la tournée qui les livrerait avec le détour estimé.',
    tuileCourte: 'La tournée qui les livrerait, le détour',
    palette: 'Nos tournées · adhérentes, tournée qui les livrerait, détour'
  }
};
