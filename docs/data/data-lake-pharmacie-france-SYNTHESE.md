# Synthèse finale — Data Lake Pharmacie France (100% sources publiques)

*Consolidation des 10 rapports de recherche. Faits arrêtés au 3 juillet 2026. Distinction gratuit/payant systématique.*

---

## 1. Index consolidé des sources (top ~40 dédupliquées)

| Nom | Organisme | Gratuit/Payant | Format | API | MàJ | Géo | Q | Intég | Pot |
|---|---|---|---|---|---|---|---|---|---|
| BDPM (base médicaments) | ANSM/HAS/CNAM | Gratuit | TXT/CSV | via wrapper | Quotid. | National | 9 | 8 | 10 |
| API Médicaments FR (wrapper BDPM) | Etalab/betagouv | Gratuit | JSON | Oui | 2×/j | National | 8 | 9 | 9 |
| Open Medic | CNAM (SNDS) | Gratuit | CSV | Non | Annuel | Région | 9 | 8 | 9 |
| Medic'AM (classe ATC) | CNAM | Gratuit | ZIP/CSV | Non | Mensuel | National | 9 | 8 | 10 |
| Medic'AM (prescripteur) | CNAM | Gratuit | ZIP/CSV | Non | Mensuel | National | 9 | 8 | 7 |
| Open PHMEV | CNAM | Gratuit | CSV | Non | Annuel | Étab./Région | 8 | 7 | 8 |
| Open LPP (dispositifs médicaux) | CNAM | Gratuit | CSV | Non | Annuel | Région | 9 | 6 | 9 |
| ANSM Dispo. produits (ruptures live) | ANSM | Gratuit | Web/Excel | Non | Quotid. | National | 7 | 5 | 9 |
| ANSM listes ruptures annuelles | ANSM | Gratuit | XLSX | Non | Irrég. | National | 7 | 6 | 8 |
| ANSM Infos sécurité (rappels lots) | ANSM | Gratuit | Web/RSS | RSS | Continu | National | 8 | 6 | 8 |
| Liste MITM | ANSM | Gratuit | XLSX | Non | Régul. | National | 8 | 7 | 9 |
| data.ansm ruptures (dataviz) | ANSM/Etalab | Gratuit | Web | Non | Annuel | National | 6 | 3 | 8 |
| Répertoire génériques (CIS_GENER) | ANSM | Gratuit | CSV | via wrapper | Régul. | National | 8 | 8 | 8 |
| Grille MDL (Légifrance) | DILA | Gratuit | HTML/API | PISTE | Rare | National | 10 | 6 | 10 |
| Convention pharma / honoraires | UNCAM | Gratuit | HTML/PDF | PISTE | Avenants | National | 10 | 7 | 10 |
| Sentinelles / Sentiweb | Inserm | Gratuit | JSON/CSV | Oui REST | Hebdo | Région | 9 | 9 | 10 |
| Odissé (ex-Géodes) SPF | Santé Pub. France | Gratuit | CSV/API | Oui | Variable | IRIS/Dépt | 9 | 6 | 8 |
| SurSaUD/OSCOUR urgences | SPF | Gratuit | CSV | Partiel | Hebdo | Dépt | 8 | 5 | 8 |
| Open-Meteo | Indépendant | Gratuit* | JSON | Oui | Horaire | Lat/lon | 8 | 10 | 9 |
| API Météo-France | Météo-France | Gratuit | JSON/GRIB | Oui (clé) | 6 min | Station | 9 | 6 | 8 |
| Vigilance météo | Météo-France | Gratuit | JSON/PNG | Oui | Biquotid. | Dépt | 9 | 7 | 9 |
| Indice pollen ATMO | Atmo France | Gratuit | CSV/API | Oui | Quotid. | Commune | 8 | 7 | 9 |
| Indice ATMO qualité air | Atmo France | Gratuit | CSV/API | Oui | Quotid. | Commune | 8 | 8 | 7 |
| Geod'Air pollution | Ineris/LCSQA | Gratuit | JSON/CSV | Oui (insc.) | Horaire | Station | 9 | 6 | 7 |
| API Calendrier scolaire | Educ. Nat. | Gratuit | JSON | Oui | Annuel | Zone/acad. | 10 | 8 | 7 |
| API Jours fériés | Etalab | Gratuit | JSON/ICS | Oui | Annuel | France/DOM | 10 | 10 | 6 |
| Compl'Alim (compléments) | DGAL | Gratuit | CSV/JSON | Non | Régul. | National | 9 | 7 | 9 |
| Open Beauty Facts | Asso communauté | Gratuit | JSON/CSV | Oui REST | Continu | Mondial | 7 | 9 | 8 |
| CosIng (ingrédients cosmét.) | Comm. EU | Gratuit | Web/scrape | Non | Continu | UE | 9 | 6 | 7 |
| RappelConso V2 | DGCCRF | Gratuit | JSON/CSV | Oui | Quotid. | National | 9 | 9 | 8 |
| Safety Gate (RAPEX) | Comm. EU | Gratuit | JSON/CSV | Oui (tiers) | Hebdo | UE | 8 | 8 | 6 |
| HAS avis Transparence | HAS | Gratuit | CSV/PDF | Non | Continu | National | 8 | 6 | 7 |
| EMA EPAR | EMA | Gratuit | XLSX/JSON | Oui | Nocturne | UE | 9 | 7 | 8 |
| FINESS (établissements) | ANS/Atlasanté | Gratuit | CSV | API géo | Bimestr. | Adresse | 8 | 7 | 10 |
| RPPS / Annuaire Santé (FHIR) | ANS | Gratuit | FHIR/TXT | Oui (clé) | Quotid. | Adresse | 8 | 7 | 10 |
| INSEE BPE | INSEE | Gratuit | CSV | Indirect | Annuel | IRIS | 8 | 6 | 9 |
| INSEE Population IRIS | INSEE | Gratuit | XLSX/CSV | Partiel | Annuel | IRIS | 9 | 6 | 9 |
| FiLoSoFi (revenus) | INSEE/DGFiP | Gratuit | XLSX/CSV | Non | Annuel | IRIS/Commune | 9 | 7 | 10 |
| Contours IRIS | IGN/INSEE | Gratuit | GeoJSON/SHP | Non | Annuel | IRIS | 9 | 9 | 9 |
| Base Adresse Nationale (géocod.) | Etalab/IGN | Gratuit | JSON | Oui | Continu | Adresse | 9 | 9 | 9 |
| Sirene INSEE (SIRET/NAF) | INSEE | Gratuit | CSV/JSON | Oui (insc.) | Quotid. | Adresse | 9 | 7 | 8 |
| Wikipedia Pageviews | Wikimedia | Gratuit | JSON | Oui | Horaire | Langue | 7 | 9 | 6 |
| Google Trends | Google | Gratuit* | CSV/scrape | Fragile | Temps réel | Région | 6 | 4 | 8 |
| datagouv-mcp (serveur MCP) | data.gouv.fr | Gratuit | MCP | Oui | Continu | National | 8 | 9 | 8 |
| **GERS / IQVIA / OpenHealth** | Privés | **PAYANT** (5 chiffres/an) | — | — | — | Officine | 9 | — | — |
| **Flux Vision Tourisme** | Orange Business | **PAYANT** | Dashboards | — | Temps réel | Fine | 8 | 3 | 9 |
| **Xerfi / Statista** | Privés | **PAYANT** | PDF | — | Annuel | National | 8 | 2 | 6 |

*Open-Meteo et Google Trends : gratuits mais licence/stabilité à surveiller pour usage commercial intensif.*

---

## 2. Feuille de route

### Les 20 datasets INDISPENSABLES (priorisés)

1. **BDPM / API Médicaments FR** — référentiel pivot CIP13/CIS, prix, remboursement. Sans lui, aucun croisement possible.
2. **Grille MDL (Légifrance)** — moteur de calcul de la marge officine. À coder en dur, change rarement.
3. **Convention/honoraires de dispensation** — complète la MDL pour la rémunération réelle par boîte.
4. **Medic'AM (classe ATC)** — SEULE base **mensuelle** CIP13 → cœur de la saisonnalité.
5. **Open Medic** — volumes réels par CIP13 × région × âge/sexe, 11 ans d'historique.
6. **Répertoire génériques (CIS_GENER)** — TFR, substitution, conseil marge.
7. **ANSM Dispo. produits (ruptures live)** — flux vivant à scraper quotidiennement (aucun historique public existant = actif propriétaire).
8. **Sentinelles/Sentiweb** — grippe/gastro/IRA hebdo, API REST propre → prédicteur n°1 des ventes OTC.
9. **Liste MITM** — feature booléenne de criticité (stock sécurité 2 mois).
10. **ANSM Infos sécurité (RSS rappels lots)** — alerte temps réel, ingestion RSS simple.
11. **Compl'Alim** — radar des nouveaux compléments alimentaires (angle mort des payants).
12. **Open LPP** — la « pépite » DM/parapharmacie remboursable (compression, orthopédie, autotests).
13. **RappelConso V2** — alerte rappel produit par GTIN, matching direct avec le stock.
14. **FINESS** — colonne vertébrale des établissements (EHPAD, MSP, labos, hôpitaux).
15. **RPPS/Annuaire Santé** — densité médecins généralistes/spécialistes à l'adresse.
16. **Base Adresse Nationale** — géocodage, brique technique indispensable.
17. **Contours IRIS (IGN)** — polygones pour relier officine ↔ démographie.
18. **FiLoSoFi** — revenu médian par IRIS, proxy n°1 pouvoir d'achat parapharma.
19. **INSEE Population IRIS** — pyramide des âges hyper-locale (vieillissement, pédiatrie).
20. **Indice pollen ATMO** — allergie communale prévisionnelle J+2/J+3 (antihistaminiques).

### Les ~50 les plus utiles (compléments)

Open PHMEV · Medic'AM prescripteur · Open Medic bénéficiaires · HAS avis Transparence · EMA EPAR · CIS avis SMR/ASMR · data.ansm ruptures · liste MITM UE (critical medicines) · DREES ER n°1335 (impact ruptures) · Odissé · SurSaUD/OSCOUR · Open-Meteo · API Météo-France · Vigilance météo · Climatologie historique MF · Indice ATMO qualité air · Geod'Air · API Calendrier scolaire · API Jours fériés · Sirene INSEE · INSEE BPE · Dossier complet INSEE · Populations légales · Naissances/natalité INSEE · Indice vieillissement/jeunesse (ANCT) · Grille densité INSEE · Effectifs étudiants MESRI · Annuaire Éducation Nationale · EHPAD (pour-les-personnes-agees) · Maternités DREES · CAF crèches · OpenRouteService (isochrones) · Open Beauty Facts · CosIng · Safety Gate · Nutrivigilance ANSES · DGCCRF bilans · Pharmacopée plantes ANSM · Wikipedia Pageviews · Google Trends · datagouv-mcp · Eurostat hlth_sha11 · OCDE HEALTH_PHMC · ECDC ESAC-Net · DREES Comptes santé · CEPS rapports · Retroced'AM · IRDES Ecosanté pharmacies · Localisation pharmacies OSM · Interfimo/Extencia observatoires officine.

### Suivants (contexte/macro, jusqu'à 100)

Omphale (projections) · Synadiet · FEBEA · Cosmetic Valley · FJP puériculture · Eurostat Prodcom · INSEE IPC hygiène-beauté · Observatoire des Territoires · AtlaSanté/C@rtoSanté · MSP jeux régionaux · PxCorpus (NLP vocal) · CNOP Panorama démographique · IAS OpenHealth (obsolète, à vérifier) · IQVIA Open Data Portal · Data ameli API prescriptions · CNEDiMTS (avis DM) · Union list critical medicines UE · étude PMC 10 ans ANSM.

---

## 3. APIs à connecter EN PRIORITÉ

- **API Médicaments FR** (JSON, endpoint `/export` masse + delta) — référentiel prix/remboursement.
- **Sentiweb REST** (`getIncidence`) — épidémio hebdo, la plus actionnable.
- **RappelConso V2 API** (GTIN) — alerte rappel automatique.
- **Base Adresse Nationale** (géocodage) — 50 req/s, illimité.
- **RPPS FHIR** (clé gratuite) — densité prescripteurs.
- **Open-Meteo** (sans clé) — météo/pollen prototype rapide.
- **Indice pollen ATMO v2** — allergie communale.
- **API Jours fériés + Calendrier scolaire** — variables déterministes, zéro incertitude.
- **datagouv-mcp** — accès IA natif à tout data.gouv.fr (le plus rentable pour éviter les scrapers).

---

## 4. Datasets à mettre à jour automatiquement (cadence réaliste)

| Cadence | Sources |
|---|---|
| **Quotidien** | ANSM Dispo. ruptures (scraping — **priorité, aucun historique public**), RappelConso, ANSM RSS rappels, BDPM (delta 2×/j), Wikipedia Pageviews |
| **Hebdomadaire** | Sentinelles, SurSaUD/OSCOUR, Safety Gate, Google Trends, pollen ATMO (agrégat) |
| **Mensuel** | Medic'AM (ATC + prescripteur), Compl'Alim, MITM, HAS avis, EMA EPAR |
| **Bimestriel** | FINESS |
| **Annuel** | Open Medic, Open PHMEV, Open LPP, FiLoSoFi, INSEE Population/BPE, natalité |
| **Événementiel** | Grille MDL / honoraires (surveillance PISTE Légifrance), CIS_GENER (décisions ANSM) |

Le scraper quotidien ANSM ruptures est **l'action technique la plus rentable** : il constitue un historique unique impossible à racheter.

---

## 5. Tableaux de bord constructibles pour le pharmacien

- **Marge réelle par boîte** : « Combien je gagne vraiment ? » = MDL(PFHT) + honoraire selon profil patient. Différenciant absolu, aucun outil gratuit ne le fait.
- **Radar ruptures & substitution** : produits en tension/rupture (ANSM live + MITM) avec alternatives génériques du groupe (CIS_GENER).
- **Calendrier saisonnier de réassort** : indice de saisonnalité mensuel par classe ATC (Medic'AM) + signal épidémio avancé (Sentinelles) + pollen local.
- **Alerte rappel stock** : croisement GTIN RappelConso/Safety Gate ↔ référencement officine.
- **Potentiel de zone de chalandise** : indices IPAL (revenu), IVC (vieillissement/chronicité), IJP (pédiatrie), IE (étudiants), densité médicale (RPPS), marché captif EHPAD (FINESS).
- **Radar nouveautés** : EMA → HAS → BDPM → Compl'Alim, pipeline d'anticipation à plusieurs mois.
- **Veille macro** : parts de marché génériques, positionnement France vs UE (Eurostat/OCDE).

---

## 6. Modèles prédictifs envisageables

| Modèle | Données d'entrée | Type de modèle |
|---|---|---|
| **Prédiction ruptures** | Historique rupture par DCI (ANSM listes + scraping live), statut MITM, classe ATC (BDPM), cause déclarée (data.ansm), rappel de lot récent (RSS), criticité UE, saisonnalité | Classification (gradient boosting / logistic) — score de criticité par produit à horizon semaines |
| **Saisonnalité par classe** | Medic'AM mensuel 2012→, indice = valeur/moyenne mobile 12 mois | Décomposition saisonnière (STL) + calibrage presse pro |
| **Prévision ventes J+7** | Prévision météo/vigilance réelle, pollen J+2, incidence Sentinelles(t-14) + pente, calendrier | Régression (XGBoost/LightGBM) avec lags, exogènes observées |
| **Prévision ventes J+15** | Normales saisonnières + anomalie court terme, pente incidence, calendrier (poids fort) | Modèle hybride tendance + saisonnalité, variables déterministes dominantes |
| **Prévision ventes J+30** | Climatologie mensuelle, saisonnalité historique Sentinelles (semaine ISO, 5-10 ans), calendrier scolaire/fériés | Modèle de saisonnalité pure + facteurs calendaires |
| **Optimisation des commandes** | Prévision demande + délai réassort + criticité rupture (MITM) + stock sécurité | Optimisation newsvendor / point de commande dynamique |
| **Recommandation d'achat** | Catalogue enrichi (Compl'Alim + Open Beauty Facts + CosIng), profil zone (FiLoSoFi/IRIS), marges Synadiet/Interfimo | Filtrage + règles métier + scoring de marge |
| **Alerte surstock** | Prévision demande décroissante (Medic'AM) + rotation faible + date péremption | Détection d'anomalie / seuils |
| **Opportunités commerciales** | PHMEV (hôpital→ville) + FINESS établissements proches + démographie zone | Scoring géo-marketing (règles + clustering de zones) |

---

## 7. Quick wins pour le CRM Intégral Pharma (100% gratuit, hors-ligne, robot Python → fichier → app vanilla)

Le CRM a déjà Medic'AM, catalogue, Offilog concurrents, veille ANSM. Ajouts à faible coût, tous compatibles avec l'architecture existante (GitHub Actions → JSON → app vanilla, comme `infos-jour.json`) :

1. **Radar ruptures ANSM quotidien** → scraper `disponibilites-des-produits-de-sante` + RSS `informations_securite`, croisé au catalogue par CIP/DCI. Fichier `ruptures-jour.json`. Alerte « produit catalogue en rupture + alternative ». Réutilise le robot veille déjà en place.
2. **Simulateur de marge MDL + honoraires** → grille Légifrance codée en dur (10%/7%/5,5%/5%/0%) + honoraires convention, appliquée au PFHT BDPM. Feature « Combien je gagne sur cette boîte ? » 100% client-side.
   ⚠️ **Corriger la note mémoire `project_mdl_barème_pharma.md`** : le barème 0,18€/3,9%/19,50€ ne correspond PAS à la grille MDL réglementaire actuelle (confusion avec les tranches PPHT/NR). À réconcilier avant prod.
3. **Indice saisonnier mensuel par classe ATC** → sur Medic'AM déjà présent, calcul valeur/moyenne mobile 12 mois → `saisonnalite-atc.json`. « Ce mois-ci, ces classes montent. »
4. **Signal épidémio hebdo Sentinelles** → robot Python API `getIncidence` (grippe/gastro/IRA) → `epidemio-semaine.json`. Alerte OTC anticipée J+15.
5. **Pollen communal ATMO** → API par commune de l'officine → `pollen-jour.json`. Alerte antihistaminiques localisée.
6. **Alerte rappel produit (RappelConso GTIN)** → API quotidienne, matching EAN catalogue → `rappels-jour.json`.
7. **Radar nouveautés Compl'Alim** → export CSV mensuel, diff vs veille → nouveaux compléments à référencer avant les concurrents.
8. **Enrichissement fiches produit** → Open Beauty Facts (API EAN) pour ingrédients INCI/labels sans ressaisie sur le rayon parapharmacie.

Tous ces flux suivent le pattern éprouvé « robot GitHub Actions → JSON versionné → app vanilla hors-ligne », sans clé API payante, sans serveur, sans coût récurrent — conforme à la contrainte `feedback_jarvis_no_external_deps.md`. Priorité : #1 et #2 (différenciants immédiats, réutilisent l'existant).

---

*Limite structurelle à documenter pour l'utilisateur : aucune source publique ne descend à la maille officine (point de vente) ni ne donne les prix nets industriels confidentiels. Tout se calcule sur le prix facial (marge officine reconstituable à ~100%) et s'estime au niveau officine par pondération région × démographie. Le sell-out réel reste l'apanage des panels payants GERS/IQVIA/OpenHealth — que ce data lake vise précisément à contourner par la donnée publique croisée.*