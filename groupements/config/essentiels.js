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
  // Pas d'Offilog chez Essentiels (Will, 26/11/2026 : « pas de Offilog parcontre ils ont leur propre centrale d'achat ») :
  // ni écran (v2-offilog.js n'est pas chargé par essentiels/v2/index.html), ni bloc « Offilog · adhérentes clientes » au Pilotage.
  // Absent = Offilog présent (OPSO, JARVIS).
  offilog: false,
  // Textes de la tuile « Tableau de bord » (accueil et ⌘K) : OPSO y promet « la rémunération », qui n'existe que chez lui.
  // Ici, seulement ce que l'écran montre (relevé étape 4 : le chiffre, le mois, mois par mois, ce que les adhérentes achètent, la trajectoire).
  textes: {
    bordTuile: 'Le chiffre, le mois, ce qu\'elles achètent, la trajectoire',
    bordTuileLong: 'Le chiffre du groupement, le mois, ce que les adhérentes achètent et la trajectoire de l\'année.',
    bordPalette: 'Tableau de bord · chiffre, mois, trajectoire'
  },
  // Page « Vos produits et nos prix nets » (étape 7, 26/11/2026 ; écran commun groupements/v2/groupement-produits.js).
  // Les lignes, les totaux et les dates se LISENT dans le fichier protégé `documents.dates` (produits-app.json) : rien de chiffré ici.
  // « Partager » remet le catalogue adhérents (document `partage.cle` du bloc documents) : Pascale l'envoie elle-même.
  produits: {
    titre: 'Vos produits et nos prix nets',
    tuile: 'Les produits de votre relevé d\'achats, avec le PPHT, notre prix net et l\'abandon de marge, ligne par ligne.',
    tuileCourte: 'PPHT, prix net et abandon de marge',
    palette: 'Produits · PPHT, prix net, abandon de marge',
    note: 'Prix nets hors taxes. Génériques : prix libre, sans abandon de marge. « — » : aucun achat relevé sur 12 mois, ou aucun abandon de marge.',
    partage: { cle: 'essAdhPdf', bouton: 'Partager le catalogue adhérents', titre: 'Catalogue adhérents', nomFichier: 'Catalogue adhérents - Intégral Pharma by Essentiels Pharma' }
  },
  // Écran « Documents » (étape 6, 26/11/2026 ; écran commun groupements/v2/groupement-documents.js).
  // Les fichiers vivent dans le seau privé `donnees-protegees`, dossier ci-dessous : verrou serveur
  // essentiels_deux_comptes + jarvis_acces_essentiels() (Will, Pascale, Alexandre). Ici, seulement leurs NOMS.
  // Les dates (« prix au », « valables jusqu'au », tarif relevé) se LISENT dans le fichier `dates`, jamais ici.
  documents: {
    dossier: 'essentiels/2026-11-26/',
    dates: 'produits-app.json',
    accesServeur: 'jarvis_acces_essentiels',
    tuile: 'Le fichier de vos produits avec nos prix nets, et les deux catalogues en PDF ou en version web.',
    tuileCourte: 'Prix nets et catalogues',
    palette: 'Documents · prix nets, catalogues',
    groupes: [
      { titre: 'Vos produits et nos prix nets', d: 'Le fichier Excel, à trier et filtrer à votre façon.',
        docs: [{ cle: 'essPrixExcel', fichier: 'prix-nets-integral.xlsx', type: 'fichier', format: 'Excel', bouton: 'Télécharger le fichier', titre: 'Vos produits et nos prix nets (Excel)' }] },
      { titre: 'Catalogue réseau', d: 'Les volumes du réseau, le PPHT, notre prix net et l\'abandon de marge.',
        docs: [{ cle: 'essResPdf', fichier: 'catalogue-reseau.pdf', type: 'pdf', format: 'PDF', bouton: 'Ouvrir le PDF', titre: 'Catalogue réseau (PDF)' },
               { cle: 'essResHtml', fichier: 'catalogue-reseau.html', type: 'html', format: 'Web', bouton: 'Version interactive, avec filtres', titre: 'Catalogue réseau, version interactive' }] },
      { titre: 'Catalogue adhérents', d: 'Sans volumes : le PPHT, le prix net HT et le prix net TTC, par ordre alphabétique.',
        docs: [{ cle: 'essAdhPdf', fichier: 'catalogue-adherents.pdf', type: 'pdf', format: 'PDF', bouton: 'Ouvrir le PDF', titre: 'Catalogue adhérents (PDF)' },
               { cle: 'essAdhHtml', fichier: 'catalogue-adherents.html', type: 'html', format: 'Web', bouton: 'Version interactive, avec filtres', titre: 'Catalogue adhérents, version interactive' }] }
    ]
  }
};
