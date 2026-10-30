# Potentiel d'un secteur : refabriquer `crm/v2/potentiel-secteur-data.js`

Données publiques uniquement (Licence Ouverte 2.0). Aucun fichier de ventes, aucun fichier protégé n'est lu.
Le fichier change seulement quand une source change : avancer alors `QV` dans `crm/v2/v2-carte.js`.

| Donnée | Source |
|---|---|
| Population par quartier | INSEE, recensement 2023 par IRIS (Melodi) : `https://api.insee.fr/melodi/file/DS_RP_POPULATION_PRINC_IRIS/DS_RP_POPULATION_PRINC_IRIS_2023_CSV_FR`, à extraire dans `$BRUT/insee-iris/ex/`. `www.insee.fr` interdit *.csv/*.zip aux robots : ne rien y télécharger. |
| Contours | IGN, WFS `data.geopf.fr` : `telecharger-ign.sh`, 8 fichiers dans `$BRUT/ign-iris/`. |
| Dépense par âge | Assurance maladie, Open Medic 2024 base complète, colonne BSE, à extraire dans `$BRUT/ameli-openmedic/ex/` ; lien proposé par `https://open-data-assurance-maladie.ameli.fr/medicaments/download.php?Dir_Rep=Open_MEDIC_Base_Complete&Annee=2024`. |

```
export BRUT=<dossier de travail hors du dépôt>
bash scripts/potentiel-secteur/telecharger-ign.sh
/usr/bin/python3 -I scripts/potentiel-secteur/calibrer-depense.py   # écrit depense-par-age.json
/usr/bin/python3 -I scripts/potentiel-secteur/preparer.py           # écrit crm/v2/potentiel-secteur-data.js
node --test tests/potentiel-secteur.test.mjs
```

Blain (44) : l'IGN la découpe en 4 quartiers, l'INSEE 2023 la traite en une seule commune (440150000, 10 376 habitants). `preparer.py` fusionne les 4 contours en une zone `440150000` qui porte la ligne INSEE (3 676 quartiers) ; aucune population n'est répartie entre ex-quartiers.
