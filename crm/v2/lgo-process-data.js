// Généré par ~/jarvis-catalogues-lgo/process.py — ne pas modifier à la main.
window.LGO_PROCESS = {
 "periode": "janvier à août 2026",
 "nbPharmacies": 1933,
 "tailles": [
  200,
  300,
  500
 ],
 "lgo": [
  {
   "s": "leo",
   "nom": "LEO",
   "editeur": "Isipharm",
   "etapes": [
    "Avec LEO, un catalogue fournisseur ne s'importe pas depuis l'officine : <b>Isipharm l'intègre depuis son siège</b>, puis le met à votre disposition.",
    "Votre commercial Intégral Pharma transmet le fichier <b>integral-top…-leo.csv</b> au format LEO (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) à Isipharm, avec votre code CIP.",
    "Comptez au maximum <b>10 jours ouvrés</b> entre la réception par Isipharm et la mise à disposition dans votre LEO.",
    "Le catalogue apparaît ensuite dans la fiche du fournisseur Intégral Pharma, gamme « INTEGRAL TOP … »."
   ],
   "note": "Format : point-virgule, une ligne de titre, prix HT sans symbole avec la virgule décimale — conforme au cahier des charges Isipharm.",
   "img": []
  },
  {
   "s": "lgpi",
   "nom": "LGPI",
   "editeur": "Pharmagest",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-lgpi.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur.",
    "Menu <b>Données › Fournisseurs</b> : ouvrez la fiche du fournisseur Intégral Pharma, onglet <b>Catalogue 1</b>.",
    "Cliquez dans le champ « Produit » de la première ligne, puis sur <b>[F9 Recherche]</b>.",
    "Appuyez sur <b>[F8 Import]</b> › « A - Import à partir d'un fichier », choisissez le fichier et cliquez sur [Ouvrir].",
    "Cochez « Rapprocher les produits à l'aide de BCB » et renseignez : Libellé du format <b>ean 13</b> · Position Code 1 <b>1</b> · Taille <b>13</b>. Validez [FIN].",
    "Le bilan de l'importation s'affiche : vérifiez le nombre de produits rapprochés, puis validez [FIN] deux fois.",
    "Le fichier contient trois colonnes, sans ligne de titre : 1 = code à 13 chiffres · 2 = libellé · 3 = <b>prix net HT</b>. Le réglage ci-dessus rapproche les produits à partir du code ; votre commercial Intégral Pharma vous confirme la reprise des prix nets dans votre LGPI."
   ],
   "note": "Sur les écrans ci-après, le fichier s'appelle « import intégral.csv » et ne compte que quelques produits : c'est un exemple. Le vôtre s'appelle <b>integral-top…-lgpi.csv</b>. Si le bilan indique des produits non rapprochés, signalez-le à votre commercial.",
   "img": [
    "lgo/img/lgpi-2.png",
    "lgo/img/lgpi-4.png",
    "lgo/img/lgpi-5.png"
   ]
  },
  {
   "s": "pharmaland",
   "nom": "Pharmaland",
   "editeur": "LSI",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-pharmaland.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur. Si vous le modifiez dans Excel, enregistrez-le de nouveau au format <b>CSV (séparateur point-virgule)</b>, une seule feuille.",
    "Menu <b>Stock › Gestion des fournisseurs</b> : appelez le fournisseur Intégral Pharma et faites <b>F2-Modifie</b>.",
    "Onglet <b>Catalogue</b> : bouton <b>Télécharger</b>, puis « Recharger le catalogue téléchargé », et sélectionnez le fichier.",
    "Indiquez les positions : colonne 1 = code produit à 7 chiffres · 2 = <b>code à 13 chiffres</b> · 3 = gamme · 7 = libellé · 8 = <b>prix net HT</b> · 9 = TVA · 10 = pourcentage. Ne saisissez aucun pourcentage en plus : la colonne 10 est à 0, le prix de la colonne 8 est déjà le prix net.",
    "Validez avec <b>F1</b> (trois fois)."
   ],
   "note": "Pour que les prix soient conservés, le laboratoire doit être affecté au fournisseur (onglet Achat de la fiche produit, ou onglet Catalogue de la fiche fournisseur), et ce fabricant associé au fournisseur Intégral Pharma (menu Fichier › Menu produit).",
   "img": []
  },
  {
   "s": "pharmony",
   "nom": "Pharmony",
   "editeur": "",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-pharmony.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur.",
    "Menu <b>Produit › Gestion des catalogues fournisseurs</b> : choisissez le fournisseur Intégral Pharma.",
    "Cliquez sur « Importer les informations depuis un fichier ».",
    "Renseignez les positions : <b>CIP/ACL : 1</b> · <b>Prix Achat U : 3</b> (prix net HT) · séparateur <b>;</b> — ne cochez pas la case « ligne de titre » : le fichier n'en contient pas. La colonne 4 est à 0 : le prix de la colonne 3 est déjà le prix net.",
    "Choisissez le fichier, puis cliquez sur <b>Valider</b>."
   ],
   "note": "Les écrans ci-après montrent où se trouvent ces boutons ; les valeurs à saisir sont celles des étapes ci-dessus.",
   "img": [
    "lgo/img/pharmony.png"
   ]
  },
  {
   "s": "smartrx",
   "nom": "Smart RX",
   "editeur": "",
   "etapes": [
    "Avec Smart RX, l'intégration d'un catalogue fournisseur est <b>lancée par l'assistance Smart RX</b> (téléphone ou chat).",
    "Menu <b>Communication › Liste des accords laboratoires</b> : choisissez la structure et rattachez-la à la fiche fournisseur Intégral Pharma (Entrée, puis O).",
    "Ouvrez le dernier message de la messagerie, puis contactez l'assistance Smart RX en lui transmettant le fichier <b>integral-top…-smartrx.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter). Il est déjà au format catalogue Smart RX, sans ligne de titre : colonne 1 = code produit à 7 chiffres · 2 = code à 13 chiffres · 3 = gamme · 7 = libellé · 8 = prix net HT · 9 = TVA.",
    "Passez ensuite une commande périodique dans <b>Achats</b> : le catalogue se crée et les produits apparaissent dans « accords laboratoires » (et non dans « services catalogues fournisseurs »)."
   ],
   "note": "",
   "img": []
  },
  {
   "s": "winpharma",
   "nom": "Winpharma",
   "editeur": "",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-winpharma.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur.",
    "Menu <b>Commandes › Catalogues</b>, bouton <b>Générer / importer un catalogue</b>, puis choisissez le fichier.",
    "Sélectionnez le fournisseur Intégral Pharma (créez-le au préalable s'il n'existe pas). Le fichier est déjà au format catalogue Winpharma (29 colonnes, ligne de titre comprise) : code à 13 chiffres, libellé, TVA et prix net HT sont à leur place, aucune colonne à régler.",
    "Si des produits sont inconnus de votre base, cliquez sur <b>Ajouter les produits</b>.",
    "Cliquez sur <b>Unir</b> pour compléter votre catalogue Intégral Pharma actuel (prix mis à jour) — « Remplacer » effacerait les autres produits de ce fournisseur. Validez par OK."
   ],
   "note": "",
   "img": []
  },
  {
   "s": "pharmavitale",
   "nom": "Pharmavitale",
   "editeur": "",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-pharmavitale.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur.",
    "Colonnes du fichier : colonne 1 = code CIP 13 · 2 = libellé · 3 = tarif grossiste HT · 4 = prix net HT · 5 = catégorie.",
    "Importez-le dans le catalogue de la fiche fournisseur Intégral Pharma, ou confiez-le à l'assistance Pharmavitale, qui l'intègre à partir de ce fichier.",
    "Votre commercial Intégral Pharma vous accompagne pour le paramétrage PharmaML de la fiche fournisseur."
   ],
   "note": "",
   "img": []
  },
  {
   "s": "visiopharm",
   "nom": "VisioPharm",
   "editeur": "",
   "etapes": [
    "Enregistrez le fichier <b>integral-top…-visiopharm.csv</b> reçu par mail (le fichier Excel joint contient les mêmes colonnes avec une ligne de titre, pour le consulter) sur l'ordinateur.",
    "Colonnes du fichier : colonne 1 = code CIP 13 · 2 = libellé · 3 = tarif grossiste HT · 4 = prix net HT · 5 = catégorie.",
    "Importez-le dans le catalogue de la fiche fournisseur Intégral Pharma (menu Fournisseurs), ou confiez-le à l'assistance VisioPharm, qui l'intègre à partir de ce fichier.",
    "Votre commercial Intégral Pharma vous accompagne pour le paramétrage PharmaML (onglet Pharma-ML de la fiche fournisseur)."
   ],
   "note": "",
   "img": []
  }
 ]
};
