/* ════════════════════════════════════════════════════════════════
   Réglage du groupement Essentiels Pharma — couche « groupement » commune (option B, 26/11/2026)
   Will : OPSO et Essentiels Pharma = le MÊME code JARVIS, seule la charte change.
   Chargé par essentiels/v2/index.html AVANT v2-boot.js, qui le lit (V2.groupement,
   V2.enGroupement(), V2.conditionsCachees(), V2.accesGroupement()).
   Modèle : groupements/config/opso.js.
   Ce fichier est public : aucun prix, aucun volume, aucun total. Seules les mentions publiques du groupement (bloc `fiche`, déjà dans l'ancienne app) y sont écrites.
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
  // Fiche « Le groupement » (étape 8, 26/11/2026 ; écran commun groupements/v2/groupement-fiche.js).
  // Contenu recopié de la fiche publique de l'ancienne app (déjà dans ce dépôt), SANS leur centrale d'achat (choix de Will : elle n'apparaît pas dans l'app)
  // et SANS cotisation. Le nombre d'officines n'est pas écrit ici : il est CALCULÉ sur le périmètre réel de l'app.
  // Les trois chiffres du groupement sont donnés « tels qu'annoncés », avec leur mention de source.
  fiche: {
    titre: 'Le groupement',
    tuile: 'La fiche d\'Essentiels Pharma : qui ils sont, leurs dirigeants, leurs activités et les officines que vous suivez, département par département.',
    tuileCourte: 'Qui ils sont et leurs officines',
    palette: 'Le groupement · fiche, dirigeants, officines',
    ancien: 'ex-Le Gall Santé Services, fondé le 27/01/1997 par Christophe Le Gall',
    baseline: 'Le réflexe santé',
    site: 'essentiels-pharma.fr',
    siege: 'Beaucouzé (49)',
    dirigeants: [
      { nom: 'François Tesson', fn: 'Président' },
      { nom: 'Christophe Le Gall', fn: 'Fondateur / ex-Président' },
      { nom: 'Oana Dantec', fn: 'Directrice générale' }
    ],
    contact: { tel: '06.24.82.33.48', email: 'c.boultareau@essentiels-pharma.fr' },
    annonces: {
      titre: 'Chiffres annoncés par le groupement',
      mention: 'Selon Essentiels Pharma, relevé de juillet 2026',
      lignes: [
        { l: 'Pharmaciens', v: '47' },
        { l: 'Salariés', v: '181' },
        { l: 'Chiffre d\'affaires du réseau', v: '45 M€ par an' }
      ]
    },
    activitesTitre: 'Les activités',
    activites: [
      { t: 'Enseignes fédérées', d: 'Prestige · Premium · Premium+ · Optimum' },
      { t: 'Indépendants groupés', d: 'Formule Découverte, sans enseigne ni engagement' },
      { t: 'Prestataire laboratoires', d: 'Services à valeur ajoutée' }
    ],
    departements: { '27': 'Eure', '44': 'Loire-Atlantique', '49': 'Maine-et-Loire', '53': 'Mayenne', '72': 'Sarthe', '75': 'Paris', '79': 'Deux-Sèvres', '92': 'Hauts-de-Seine' }
  },
  // Carte « Nos tournées et les adhérentes » (étape 8b, 26/11/2026 ; écran commun groupements/v2/groupement-tournees.js).
  // Les tournées, les positions et les détours se LISENT dans les fichiers (tournées protégées, base nationale) : rien de chiffré ici.
  // Absente pour le rôle opso (ni tuile, ni ⌘K, ni écran). `lettre` = devant le numéro de chaque adhérente sur la carte.
  tournees: {
    titre: 'Nos tournées et les adhérentes',
    lettre: 'E',
    tuile: 'Nos tournées de livraison sur la carte, les adhérentes déjà livrées et, pour les autres, la tournée qui les livrerait avec le détour estimé.',
    tuileCourte: 'La tournée qui les livrerait, le détour',
    palette: 'Nos tournées · adhérentes, tournée qui les livrerait, détour'
  },
  // Page « Reco produits » (étape 8 ; écran commun groupements/v2/groupement-reco.js). Les listes, les prix et les dates se LISENT dans le
  // fichier privé `fichier` (même dossier du seau que les documents, même accès serveur) : rien de chiffré ici.
  reco: {
    titre: 'Reco produits',
    sousTitre: 'Ce que les pharmacies Intégral Pharma commandent déjà, classé par nombre de pharmacies, à nos prix nets.',
    fichier: 'reco-produits.json',
    tuile: 'Les produits que les pharmacies Intégral Pharma commandent déjà, classés par nombre de pharmacies, à nos prix nets.',
    tuileCourte: 'Classés par nombre de pharmacies',
    palette: 'Reco produits · classés par nombre de pharmacies',
    note: 'Prix nets hors taxes. « Pharmacies » : nombre d\'officines Intégral Pharma qui commandent déjà le produit. Génériques et non remboursés : prix net seul.'
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
