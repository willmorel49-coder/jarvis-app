# Data Lake Pharmacie France — Recherche brute (10 agents)

> Sources publiques/gratuites pour une IA copilote d officine. Recherche multi-agents du 2026-07-03. URLs vérifiées par les agents. Distinguer gratuit vs payant.


---

# AGENT 6 — DÉMOGRAPHIE : Sources open data pour le Data Lake Pharmacie France

Recherche menée sur INSEE, data.gouv.fr, MESRI, IGN, ANCT, Orange Business. Sources vérifiées avec URL réelles. Le gratuit est largement majoritaire ; une seule source majeure (Flux Vision Tourisme) est payante et signalée comme telle.

---

## 1. Population, âge, structure — niveau IRIS/commune

**Base infracommunale « Population » (IRIS)**
Nom | URL | Organisme | Licence | Description | Type | Format | API | MàJ | Historique | Nb lignes | Variables | Niveau géo | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---
Base Population IRIS | https://www.insee.fr/fr/statistiques/8647014 (données 2022) + doc https://www.insee.fr/fr/information/2383389 | INSEE | Licence Ouverte / Open Licence 2.0 | Population par sexe, âge quinquennal, CSP, nationalité, au niveau IRIS | Recensement | XLSX/CSV | Non (téléchargement direct ; cube dispo via API "Données locales") | Annuelle (année n publiée en limites géo de n+2) | Depuis 2004 (millésimes successifs) | ~50 000 IRIS × France | sexe, âge (tranches 5 ans), CSP, nationalité | IRIS (quartier infracommunal) | 9/10 | 6/10 (fichiers XLSX à parser, un fichier par thème/année) | 9/10

*Pourquoi/comment* : c'est LA brique de base pour la pyramide des âges hyper-locale (rayon officine). Croiser avec la base des officines (CNOP/FINESS géocodées) pour calculer, pour chaque pharmacie, la population par tranche d'âge dans son IRIS + IRIS voisins (rayon 500m-1km). Indicateur : % population 65+, % 0-14 ans, ratio dépendance.

**Bases sœurs (mêmes IRIS, mêmes modalités d'accès)** :
- Activité des résidents (CSP actifs, emplois/chômage) — https://www.insee.fr/fr/statistiques/8647006
- Couples-Familles-Ménages (taille ménages, familles monoparentales, CSP) — https://www.insee.fr/fr/statistiques/8647008
- Diplômes-Formation (niveau d'études) — mêmes pages, thème FOR
- Logement (résidences principales/secondaires, statut d'occupation) — utile proxy pouvoir d'achat/type d'habitat
Toutes : Licence Ouverte, XLSX/CSV, gratuit, mise à jour annuelle, niveau IRIS. Qualité 9/10, intégration 6/10, business 8/10 chacune.

**Populations légales millésimées (commune)**
Nom | URL | Organisme | Licence | Format | MàJ | Niveau | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---
Populations légales millésimées | https://www.data.gouv.fr/datasets/populations-legales-communes-et-arrondissements-municipaux-millesime-france + https://www.insee.fr/fr/statistiques/8681011 | INSEE | Licence Ouverte | XLSX/CSV | Annuelle (décret fin d'année, ex. décret n°2025-1362 pour populations 2023, effectif 1er janv. 2026) | Commune, arrondissement | 9/10 | 9/10 (fichier plat simple) | 7/10

*Pourquoi* : population officielle référence pour tout ratio "pharmacie / habitants" et pour pondérer les autres indicateurs à l'échelle commune quand l'IRIS n'existe pas (communes <5-10k hab non découpées en IRIS — cas fréquent en zone rurale, précisément la zone où la pharmacie est souvent le seul commerce de santé).

**Dossier complet INSEE (agrégateur commune/EPCI/département)**
Nom | URL | Organisme | Licence | Format | MàJ | Niveau | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---
Dossier complet | https://www.insee.fr/fr/statistiques/zones/2011101 | INSEE | Licence Ouverte | XLSX/CSV (un fichier par commune/EPCI) | Annuelle | Commune, EPCI, département, région | 9/10 | 8/10 | 8/10

*Pourquoi* : combine dans un seul fichier population, âge, ménages, logement, emploi, CSP, revenus — parfait comme table pivot "commune" pour join rapide avec la base officines sans avoir à agréger 5 bases IRIS séparées. Bon compromis vitesse d'implémentation/richesse pour un MVP.

---

## 2. Revenus des ménages — FiLoSoFi

Nom | URL | Organisme | Licence | Format | MàJ | Historique | Niveau | Variables | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---|---|---
FiLoSoFi (revenus localisés sociaux et fiscaux) | https://www.data.gouv.fr/datasets/revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-revenus-localises-sociaux-et-fiscaux + métadonnées https://www.insee.fr/fr/metadonnees/source/serie/s1172 + ex. millésime https://www.insee.fr/fr/statistiques/8229323 | INSEE (croisement DGFiP + CNAF/CNAV/CCMSA) | Licence Ouverte | XLSX/CSV | Mise à jour continue (dernier point 2021, Filosofi 2 remplace le système à partir du millésime 2023) | 2012 à aujourd'hui | IRIS des communes ≥5 000 hab (10 000 hab avant 2019) ; commune pour le reste | revenu médian, déciles D1/D9, taux de pauvreté, part des revenus d'activité vs sociaux | 9/10 | 7/10 | 10/10

*Pourquoi/comment* : LE proxy n°1 du pouvoir d'achat pharmaceutique local — revenu médian par IRIS. Croiser avec Open Medic (CNAM, montants remboursés) pour calculer un "reste à charge estimé" par zone, et avec le catalogue produits (OTC/parapharmacie prix libre) pour prioriser l'offre premium vs générique/prix bas selon la zone. Limite : pas dispo pour IRIS de communes <5 000 hab → repli sur le niveau commune.

---

## 3. CSP (catégories socio-professionnelles)

Couvertes par les bases infracommunales IRIS ci-dessus (« Activité des résidents » et « Population »), pas de source CSP dédiée séparée. Complément utile au niveau national/régional pour calibrage :

Nom | URL | Organisme | Licence | Format | Niveau | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---
Structure de la population active par CSP | https://www.insee.fr/fr/statistiques/2012721 | INSEE | Licence Ouverte | XLSX | Commune/IRIS (via bases ACT) | 8/10 | 7/10 | 6/10

*Pourquoi* : CSP+ (cadres) = pouvoir d'achat élevé, forte appétence parapharmacie/dermocosmétique/compléments premium. CSP ouvriers/employés = volumes génériques, tiers payant, marché plus captif prix.

---

## 4. Natalité, état civil, projections

Nom | URL | Organisme | Licence | Format | MàJ | Historique | Niveau | Variables | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---|---|---
Naissances et taux de natalité | https://www.insee.fr/fr/statistiques/2381380 et https://www.insee.fr/fr/statistiques/1893255 (2008-2024) | INSEE (état civil) | Licence Ouverte | XLSX/CSV | Annuelle | Depuis 2008 (séries plus longues au niveau agrégé) | Commune (domicile de la mère) | nombre de naissances, taux de natalité | 8/10 | 8/10 | 7/10
Ensemble état civil (data.gouv.fr) | https://www.data.gouv.fr/datasets/ensemble-de-jeux-de-donnees-detat-civil | INSEE | Licence Ouverte | CSV | Annuelle | Variable selon fichier | Commune | naissances, décès, mariages | 8/10 | 7/10 | 6/10
Omphale (projections de population) | https://www.insee.fr/fr/information/3683517 et https://www.insee.fr/fr/statistiques/2859843 | INSEE | Licence Ouverte | XLSX + outil de modélisation | Ponctuelle (dernier cycle Omphale 2022, horizon 2018-2070) | Projection à 50 ans | Zones ≥50 000 habitants (départements, régions, grandes agglos) — PAS la commune fine | scénarios central/haut/bas fécondité, mortalité, migrations | 8/10 | 4/10 (nécessite paramétrage du modèle, pas un simple fichier plat) | 7/10

*Pourquoi/comment* : la natalité par commune alimente directement le potentiel "pédiatrie/pharmacie bébé" (laits infantiles, parapharmacie nourrisson) — croiser avec Open Medic (prescriptions pédiatriques) et le calendrier vaccinal. Omphale permet d'anticiper à 5-10 ans le vieillissement d'une zone de chalandise pour orienter une stratégie d'investissement officine (rachat de patientèle, extension LAD/EHPAD) — mais son usage est limité aux grandes mailles, donc utile en aide à la décision stratégique plus qu'en scoring fin par pharmacie.

---

## 5. Vieillissement / jeunesse — indices dérivés

Nom | URL | Organisme | Licence | Format | Niveau | Variables | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---
Indice de vieillissement | https://www.observatoire-des-territoires.gouv.fr/indice-de-vieillissement | ANCT / Observatoire des Territoires (source : INSEE RP) | Licence Ouverte | XLSX/CSV téléchargeable, cartographie interactive | Commune, EPCI, département, région, bassin de vie (25+ échelons) | ratio pop 65+/pop <20 ans | 8/10 | 8/10 | 8/10
Indice de jeunesse | https://www.observatoire-des-territoires.gouv.fr/indice-de-jeunesse | ANCT | Licence Ouverte | idem | idem | ratio pop <20 ans/pop 60+ | 8/10 | 8/10 | 8/10
Grille de densité 2025 | https://www.insee.fr/fr/information/8571524 | INSEE | Licence Ouverte | XLSX (2 Mo) | Commune (agrégeable EPCI/département/bassin de vie) | classement densément peuplé / intermédiaire / rural (grille 1km² sous-jacente) | 9/10 | 9/10 | 8/10

*Pourquoi/comment* : ces deux indices, déjà calculés et prêts à l'emploi, évitent de recalculer soi-même le ratio à partir des pyramides d'âge — gain de temps direct pour un score "chronicité/polymédication attendue" (indice de vieillissement élevé → forte proportion ALD, davantage d'ordonnances chroniques, opportunité MAD/matériel médical, orthopédie, TROD). La grille de densité sert de filtre pour adapter le rayon de la zone de chalandise (500m en zone dense vs 10-15 min de voiture en rural).

---

## 6. Tourisme

Nom | URL | Organisme | Licence | Coût | Format | MàJ | Niveau | Variables | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---|---|---
**Flux Vision Tourisme** | https://www.orange-business.com/fr/solutions/data-intelligence-iot/flux-vision | Orange Business (co-construit avec ADT/CDT régionaux) | Commerciale, propriétaire | **PAYANT** — aucun tarif public affiché, contrat sur devis avec Orange Business ; anonymisation validée CNIL | Dashboards + exports | Temps réel/quasi temps réel | Zone fine (infra-communale possible) | présence par jour/nuit/tranche 2h, nationalité visiteurs, flux OD | 8/10 (très fin) | 3/10 (contrat requis, pas d'API ouverte documentée) | 9/10 si budget dispo
Capacité des communes en hébergement touristique | https://www.insee.fr/fr/statistiques/2021703 | INSEE | Licence Ouverte | **GRATUIT** | CSV | Annuelle | Commune (hôtels >5 chambres, campings >10 empl.) | nb hôtels, nb chambres, nb campings, nb emplacements | 8/10 | 8/10 | 7/10
Établissements d'hébergements touristiques | https://www.insee.fr/fr/statistiques/2012688 | INSEE | Licence Ouverte | Gratuit | CSV | Annuelle | Commune | typologie, capacité | 8/10 | 8/10 | 6/10
Enquête fréquentation hôtellerie/camping | https://www.insee.fr/fr/metadonnees/source/serie/s1039 (hôtels) + s1243 (plein air) + parc/fréquentation campings https://www.insee.fr/fr/statistiques/2015437 | INSEE | Licence Ouverte | Gratuit | CSV | Mensuelle/trimestrielle | Régional à infra-régional (rarement commune) | taux d'occupation, nuitées, origine clientèle | 7/10 | 6/10 | 7/10

*Pourquoi/comment* : Flux Vision est la seule donnée vraiment fine et dynamique (compte les touristes réellement présents jour/nuit) mais payante et sans accès self-service — à réserver à une V2 si budget, ou à contourner via la donnée gratuite INSEE (capacité d'hébergement = proxy structurel du potentiel touristique d'une commune, corrélé au volume réel). Croiser capacité hôtelière + saisonnalité météo (déjà couvert par Météo-France dans un autre agent) pour un indice touristique saisonnier : pic estival = solaire/répulsifs/premiers secours/mal des transports, pic hivernal montagne = engelures/lèvres gercées/entorses.

---

## 7. Population étudiante

Nom | URL | Organisme | Licence | Format | API | MàJ | Historique | Niveau | Variables | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---|---|---|---
Effectifs d'étudiants inscrits (agrégeable) | https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-atlas_regional-effectifs-d-etudiants-inscrits_agregeables/ + https://www.data.gouv.fr/datasets/effectifs-detudiants-inscrits-dans-les-etablissements-et-les-formations-de-lenseignement-superieur | MESRI | Licence Ouverte / Open Licence 2.0 | CSV (~88 Mo), JSON | Oui — plateforme OpenDataSoft (endpoint /explore/…/api ou /exports/csv) | Annuelle (dernier point mai 2026) | Plusieurs années (rentrées universitaires successives) | **Commune** (+ unité urbaine, département, académie, région) | effectifs par établissement/filière/niveau, apprentis STS | 8/10 | 8/10 (API OpenDataSoft standard) | 6/10
Effectifs détail par établissement | https://www.data.gouv.fr/datasets/effectifs-detudiants-inscrits-dans-les-etablissements-et-les-formations-de-lenseignement-superieur-detail-par-etablissements | MESRI | Licence Ouverte | CSV | Oui (OpenDataSoft) | Annuelle | Commune de l'établissement | idem, par établissement | 8/10 | 8/10 | 6/10

*Pourquoi/comment* : essentiel pour les officines en zone de campus/centre-ville étudiant — proxy contraception d'urgence, pilule, tests de grossesse, parapharmacie "petit budget" (formats économiques), vaccination méningocoque (obligatoire en internats/résidences universitaires depuis 2024), produits anti-stress/sommeil en périodes d'examens. Croiser avec le calendrier universitaire (rentrée sept/janvier) pour de la saisonnalité fine.

---

## 8. Contours géographiques (brique technique indispensable)

Nom | URL | Organisme | Licence | Format | MàJ | Niveau | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---
Contours IRIS® | https://geoservices.ign.fr/contoursiris + https://www.data.gouv.fr/datasets/contours-iris-r-2 | IGN + INSEE (coédition) | Licence Ouverte / Etalab | Shapefile, GeoJSON, GPKG | Annuelle | IRIS (~50 000 mailles) | 9/10 | 9/10 (formats SIG standards) | 9/10 (indispensable, pas optionnel)

*Pourquoi* : sans ces polygones, impossible d'associer géographiquement une pharmacie (point GPS) à son IRIS/commune pour interroger les bases démographiques ci-dessus. Brique fondatrice du data lake, à charger en tout premier.

---

## 9. Agrégateur transverse

Nom | URL | Organisme | Licence | Format | API | Niveau | Qualité | Intégration | Business
---|---|---|---|---|---|---|---|---|---
Observatoire des Territoires (données ouvertes) | https://www.observatoire-des-territoires.gouv.fr/donnees_ouvertes | ANCT | Licence Ouverte | XLSX/CSV + cartographie interactive Géoclip | API Géoclip (recherche géo, métadonnées, export) | 600+ indicateurs, 25+ échelons (commune à Europe) | 8/10 | 6/10 (portail large, moins standardisé qu'un flat file INSEE brut) | 8/10

*Pourquoi* : bon point d'entrée pour prototyper rapidement (comparer plusieurs indicateurs déjà calculés — vieillissement, revenu, densité — sans réimplémenter les formules), mais pour un pipeline de production robuste mieux vaut charger les sources INSEE brutes en direct.

---

## 10. Outils transverses indispensables (pas démographiques mais nécessaires au calcul de zone de chalandise)

Nom | URL | Organisme | Licence | Coût | Usage
---|---|---|---|---|---
Base Adresse Nationale / API Adresse (géocodage) | https://adresse.data.gouv.fr (endpoint actuel https://data.geopf.fr/geocodage/search/) | Etalab/IGN | Licence Ouverte | Gratuit | Géocoder l'adresse de chaque officine (CNOP/FINESS) en lat/lon pour la placer dans son IRIS
OpenRouteService (isochrones) | https://openrouteservice.org/ | Heidelberg University (sur données OSM) | Open source, gratuit avec quota (self-hostable sans limite) | Gratuit | Calculer la vraie zone de chalandise en temps de trajet (5-10-15 min à pied/voiture) plutôt qu'un simple rayon à vol d'oiseau — bien plus pertinent en zone rurale (relief, réseau routier) qu'un cercle
FINESS + géocodage Atlasanté | https://www.data.gouv.fr/datasets/finess-extraction-du-fichier-des-etablissements + doc SNDS https://documentation-snds.health-data-hub.fr/snds/open_data/finess | ANS / Atlasanté | Licence Ouverte | Gratuit | Fichier `t_finess` déjà géocodé (lat/lon EPSG:4326) tous les 2 mois — évite de géocoder soi-même
Annuaire Santé (API FHIR pharmaciens/officines) | via esante.gouv.fr | ANS | Licence Ouverte | Gratuit | RPPS/FINESS, profession, coordonnées — complète/croise la base CNOP

---

## Synthèse — Indicateurs de POTENTIEL COMMERCIAL d'une officine

Pour chaque officine géocodée (FINESS/CNOP → lat/lon → IRIS via contours IGN), calculer sur sa zone de chalandise (rayon ou isochrone selon densité — grille de densité INSEE pour choisir le rayon) :

1. **Indice de pouvoir d'achat pharmaceutique local (IPAL)** = revenu médian FiLoSoFi de l'IRIS × pondération CSP+ (part cadres/professions libérales, base ACT). Sert à calibrer l'offre parapharmacie premium/dermocosmétique vs générique/prix serré.

2. **Indice de vieillissement/chronicité (IVC)** = indice de vieillissement (Observatoire des Territoires) + % 75 ans et + (base Population IRIS). Proxy polymédication, ALD, matériel médical/orthopédie, portage de médicaments, EHPAD à proximité (à croiser avec FINESS établissements médico-sociaux).

3. **Indice jeunesse/pédiatrie (IJP)** = % population 0-14 ans (base Population IRIS) + taux de natalité communal (état civil INSEE). Proxy laits infantiles, parapharmacie bébé, vaccination pédiatrique.

4. **Indice étudiant (IE)** = effectifs étudiants MESRI de la commune / population totale de la commune. Proxy contraception, tests grossesse, formats économiques, vaccination méningocoque.

5. **Indice touristique saisonnier (ITS)** = capacité d'hébergement touristique INSEE (nb lits hôtels+campings) / population résidente, pondéré par saisonnalité (été montagne/littoral vs hiver ski) — Flux Vision (payant) en V2 pour affiner en temps réel. Proxy solaire, premiers secours, mal des transports, pharmacie de garde à forte affluence.

6. **Indice de densité/accessibité (IDA)** = grille de densité INSEE (dense/intermédiaire/rural) → détermine le rayon de calcul (500 m urbain dense / isochrone 10-15 min rural) et le niveau de concurrence attendu (nb officines FINESS dans le même isochrone).

7. **Score de potentiel global pondéré (SPG)** = combinaison pondérable des 6 indices ci-dessus, pondération ajustable selon la stratégie de l'officine (ex. officine de centre-ville étudiant → poids fort sur IE ; officine littorale → poids fort sur ITS ; officine rurale vieillissante → poids fort sur IVC).

**Croisements les plus porteurs avec les autres agents du data lake** : IVC × Open Medic (CNAM, volumes ALD/chronique réels) pour valider le potentiel théorique par la consommation réelle ; ITS × météo/pollen (RNSA, Météo-France) pour la saisonnalité fine ; IPAL × ANSM ruptures de stock pour prioriser le réassort dans les zones à fort pouvoir d'achat où le client ne tolère pas la rupture ; IDA × base officines CNOP pour calculer un indice de concurrence locale (nb pharmacies concurrentes dans l'isochrone) — le vrai "potentiel net" est le potentiel brut divisé par la concurrence.

---

**Limites à noter honnêtement** : FiLoSoFi n'existe qu'à l'IRIS pour les communes ≥5 000 habitants (repli commune sinon) ; Omphale ne descend pas sous ~50 000 habitants (utile en macro, pas en micro-ciblage par officine) ; Flux Vision est la seule donnée vraiment temps réel sur le tourisme mais est payante sans tarif public — le proxy gratuit INSEE (capacités d'hébergement) est un bon substitut structurel à défaut de dynamique fine.

---

# Rapport — AGENT 2 : Données exogènes pour la prévision des ventes en officine (France)

*Recherche complémentaire au Data Lake Pharmacie France 100% open data. Toutes les URLs ont été vérifiées par fetch direct ou recoupement de recherche. Faits datés au 3 juillet 2026 — deux changements structurels récents sont à noter d'emblée.*

## ⚠️ Deux ruptures structurelles à connaître avant tout pipeline

1. **RNSA liquidé (mars 2025)** — Le Réseau National de Surveillance Aérobiologique (pollens.fr), référence historique depuis ~30 ans, est en liquidation judiciaire depuis mars 2025. La surveillance pollinique a été **reprise par Atmo France** (fédération des AASQA), qui publie désormais un indice pollen quotidien à la commune. Ne pas construire de pipeline sur l'ancienne API RNSA — elle est morte.
2. **Géodes → Odissé (été 2025)** — Le portail cartographique Géodes de Santé publique France (geodes.santepubliquefrance.fr) a été remplacé par **Odissé** (odisse.santepubliquefrance.fr). Géodes redirige automatiquement vers Odissé. Toute intégration doit cibler Odissé.

---

## 1. MÉTÉO / CLIMAT

### 1.1 Portail des API Météo-France (temps réel + prévision)
- **URL** : https://portail-api.meteofrance.fr/web/fr/
- **Organisme** : Météo-France (EPIC, tutelle État)
- **Licence** : Licence Ouverte / Open Licence 2.0
- **Description** : Depuis le 1er janvier 2024, toutes les données publiques Météo-France sont accessibles gratuitement via API après création de compte + génération de clé (« Api Key »). Inclut observations réseau (>2000 stations, fréquence 6 min), données radar (5 min), modèles de prévision numérique (AROME, ARPEGE, jusqu'à J+4/J+114h), vigilance.
- **Type de données** : température, précipitations, vent, UV, humidité, pression, prévisions modélisées
- **Format** : JSON, GRIB2 (modèles)
- **API** : Oui — https://portail-api.meteofrance.fr (clé API gratuite requise, quotas par API)
- **Mise à jour** : temps réel (6 min pour observations, plusieurs cycles/jour pour modèles)
- **Historique** : observations en temps réel ; historique long via le dataset séparé « données climatologiques » (voir 1.3)
- **Volumétrie** : des dizaines de millions de points/an
- **Variables** : T°, précipitations, vent, rayonnement, UV, humidité
- **Niveau géo** : station ponctuelle (~2000 points), interpolable à la commune
- **Qualité** : 9/10 | **Facilité d'intégration** : 6/10 (inscription + clé + quotas par produit, doc technique dense) | **Potentiel business** : 8/10

### 1.2 API Bulletin Vigilance (canicule, grand froid, orages, etc.)
- **URL** : https://www.data.gouv.fr/dataservices/api-bulletin-vigilance (endpoint réel : `https://portail-api.meteofrance.fr/web/fr/api/DonneesPubliquesVigilance`)
- **Organisme** : Météo-France
- **Licence** : Open Licence 2.0
- **Description** : Niveau de danger (vert/jaune/orange/rouge) par département, produit « bulletin » (texte) et « carte » (chronologie du risque J et J+1), + vignettes PNG des cartes nationales.
- **Format** : JSON + PNG
- **API** : Oui, gratuite après inscription — 60 requêtes/min, disponibilité annoncée 99,9%
- **Mise à jour** : au minimum biquotidienne (6h/16h), plus en cas d'évolution
- **Historique** : flux temps réel ; pas d'archive profonde documentée via cette API (à défaut, archives via data.gouv.fr ou Vigimeteo)
- **Niveau géo** : départemental + zonal + national
- **Qualité** : 9/10 | **Facilité** : 7/10 | **Potentiel business** : 9/10 — la vigilance canicule/grand froid est un des meilleurs prédicteurs directs de pics de vente (solaire, hydratation, ORL, ventilateurs vs anti-grippe, chauffage).

### 1.3 Données climatologiques de base — quotidiennes / horaires / mensuelles (historique long)
- **URL** : https://www.data.gouv.fr/datasets/donnees-climatologiques-de-base-quotidiennes (+ variantes horaires/mensuelles) ; portail dédié https://meteo.data.gouv.fr/
- **Organisme** : Météo-France
- **Licence** : Licence Ouverte 2.0
- **Description** : Historique complet par station (toutes stations métropole + outre-mer depuis leur ouverture), tous paramètres contrôlés climatologiquement. Fichiers CSV compressés par département/période. Mise à jour : annuelle (avant 1950), mensuelle (1950 à année-2), **quotidienne pour les 2 dernières années**.
- **Format** : CSV (zip)
- **API** : accès fichiers statiques, pas d'API paramétrée classique (téléchargement direct)
- **Historique** : depuis l'ouverture de chaque station — souvent >100 ans pour stations historiques
- **Niveau géo** : station météo ponctuelle
- **Qualité** : 10/10 | **Facilité** : 6/10 (fichiers volumineux à parser, pas de granularité commune directe) | **Potentiel business** : 7/10 — essentiel pour entraîner un modèle sur plusieurs années (saisonnalité pluriannuelle grippe/allergies/canicule).

### 1.4 Open-Meteo (alternative gratuite, sans clé, très facile à intégrer)
- **URL** : https://open-meteo.com/ (doc : https://open-meteo.com/en/docs)
- **Organisme** : projet open-source indépendant, réutilise Météo-France/DWD/NOAA/ECMWF
- **Licence** : CC BY 4.0 (attribution requise), usage commercial autorisé
- **Description** : API météo sans clé ni inscription, gratuite jusqu'à 10 000 appels/jour en usage non-commercial (plans payants au-delà pour usage commercial intensif). Prévisions jusqu'à 16 jours, **archive historique jusqu'à 80 ans** (modèles NOAA GFS, ECMWF IFS, DWD ICON), et « Previous Runs API » pour reconstituer les prévisions telles qu'émises à l'époque (utile en backtesting ML pour éviter le data leakage).
- **Format** : JSON via simple GET (coordonnées lat/lon)
- **API** : Oui — `https://api.open-meteo.com/v1/forecast` (prévision), archive séparée
- **Mise à jour** : plusieurs fois par jour
- **Historique** : jusqu'à 80 ans (réanalyses) / archive prévision depuis 2021
- **Niveau géo** : point géographique libre (lat/lon), donc adaptable à toute pharmacie géolocalisée
- **Qualité** : 8/10 | **Facilité d'intégration** : 10/10 (aucune clé, JSON simple, doc excellente) | **Potentiel business** : 9/10 — **meilleur rapport simplicité/valeur** pour un premier prototype de scoring météo, avant de basculer sur l'API officielle Météo-France si besoin de finesse réglementaire.

*Croisement/indicateur dérivé* : un « indice choc thermique » (delta de température jour/veille), un « indice UV cumulé 7 jours » (prédicteur de ventes solaires/dermato), un « indice vigilance pondéré » (jours oranges/rouges à J+7) sont directement calculables et alignables avec l'historique de ventes.

---

## 2. POLLEN

### 2.1 Indice pollen ATMO (successeur du RNSA)
- **URL portail** : https://www.atmo-france.org/article/indice-pollen — **API technique** : https://admindata.atmo-france.org/api/doc/v2
- **Organisme** : Atmo France (fédération des 18 AASQA régionales), a repris la mission du RNSA liquidé
- **Licence** : Licence Ouverte 2.0 (par défaut sur data.gouv.fr ; producteur local parfois non précisé)
- **Description** : Indice pollinique quotidien, prévisionnel à 3 jours (J, J+1, J+2), à l'échelle **communale**, pour 6 taxons : aulne, bouleau, olivier, armoise, graminées, ambroisie. Modélisé par IA à partir de comptages, prévisions météo et données Copernicus.
- **Type de données** : risque allergique par pollen, par commune
- **Format** : Shapefile, GeoJSON, CSV (exports directs sur data.gouv.fr) + API v2 thématique
- **API** : Oui (admindata.atmo-france.org/api/doc/v2) — détails d'authentification à vérifier au cas par cas selon AASQA régionale
- **Mise à jour** : quotidienne (publication ~13h)
- **Historique** : dataset dédié « Indice pollen ATMO – Historique » disponible sur data.gouv.fr (profondeur exacte à vérifier, alimenté depuis janvier 2026 sur la version consultée)
- **Niveau géo** : commune (échelle la plus fine du panel météo/environnement)
- **Qualité** : 8/10 | **Facilité** : 7/10 | **Potentiel business** : 9/10 — directement corrélé aux ventes d'antihistaminiques, sprays nasaux, collyres. Le fait que ce soit prédictif à J+2/J+3 (et non seulement observé) en fait un signal exploitable pour la prévision à très court terme, à combiner avec la météo (le pollen "pousse" avec le vent sec + T°).

### 2.2 IAS® Manifestations Allergiques (indicateur dérivé des ventes pharmacie elles-mêmes)
- **URL** : https://www.data.gouv.fr/datasets/indicateur-avance-sanitaire-ias-r-manifestations-allergiques/ (méthodo : ias.openhealth.fr)
- **Organisme** : OpenHealth Company (via panel de pharmacies CELTIPHARM)
- **Licence** : ODbL
- **Description** : Indicateur construit à partir des ventes réelles de médicaments anti-allergiques en pharmacie, complémentaire à la surveillance pollinique — donc littéralement un proxy des ventes du secteur qu'on cherche à prédire.
- **Format** : CSV + images
- **API** : non documentée, export fichier seulement
- **Mise à jour** : ⚠️ prévue quotidienne mais **rythme non respecté** — dernière mise à jour constatée 2016. Source à considérer comme **probablement à l'arrêt/obsolète** — à vérifier avant toute dépendance, mais intéressante comme preuve de concept que l'outillage existe (OpenHealth est justement un concurrent payant à contourner).
- **Niveau géo** : national (à vérifier granularité infra)
- **Qualité** : 4/10 (fraîcheur douteuse) | **Facilité** : 8/10 | **Potentiel business** : 5/10 (valeur conceptuelle plus qu'opérationnelle immédiate)

---

## 3. QUALITÉ DE L'AIR / POLLUTION

### 3.1 Geod'Air — plateforme nationale qualité de l'air
- **URL** : https://www.geodair.fr/ | API : https://www.geodair.fr/donnees/api
- **Organisme** : Ineris, pour le compte du LCSQA (Laboratoire Central de Surveillance de la Qualité de l'Air), fédère les données des AASQA
- **Licence** : Licence Ouverte 2.0 (via data.gouv.fr)
- **Description** : Centralise depuis 2015 les concentrations de polluants réglementés (PM10, PM2.5, NO2, O3, SO2) mesurées par ~600 stations, ~17 millions de nouvelles données/an. API pour utilisateurs avancés (inscription via formulaire), bonnes pratiques anti-surcharge (1 requête/date/heure/polluant/station recommandée).
- **Type de données** : moyennes horaires, quotidiennes, max horaire/jour, moyennes annuelles
- **Format** : API structurée (JSON/CSV selon endpoint) + export data.gouv.fr
- **API** : Oui, gratuite après inscription — https://www.geodair.fr/donnees/api
- **Mise à jour** : horaire
- **Historique** : depuis 2015 (systématisé), certaines séries plus anciennes selon station
- **Niveau géo** : station de mesure ponctuelle (~600 points, réglementaires en agglomération >100k hab.)
- **Qualité** : 9/10 | **Facilité** : 6/10 | **Potentiel business** : 7/10

### 3.2 Indice ATMO (indice de qualité de l'air quotidien par commune)
- **URL** : https://www.data.gouv.fr/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/ (et variante « indice-qualite-de-lair-atmo »)
- **Organisme** : Atmo France / AASQA
- **Licence** : Licence Ouverte 2.0
- **Description** : Indice qualité de l'air simplifié à 6 classes (bon/moyen/dégradé/mauvais/très mauvais/extrêmement mauvais), calculé pour toutes les communes (obligatoire >100k hab., indice simplifié IQA en dessous).
- **Format** : CSV/API
- **API** : oui via data.gouv.fr / plateformes régionales (ex. Paris Data pour Île-de-France)
- **Mise à jour** : quotidienne
- **Historique** : dataset avec historique disponible (à date précise selon région)
- **Niveau géo** : commune — le plus fin pour la pollution
- **Qualité** : 8/10 | **Facilité** : 8/10 | **Potentiel business** : 7/10 — pics de pollution corrélés aux ventes respiratoires (bronchodilatateurs, masques, sprays), utile en croisement avec épidémiologie ORL/asthme.

*Croisement/indicateur dérivé* : un « indice respiratoire composite » = f(pollution ATMO, pollen, T°, épidémie grippale Sentinelles) pourrait mieux prédire les ventes ORL/allergo/asthme qu'aucune variable seule.

---

## 4. ÉPIDÉMIES / SURVEILLANCE SANITAIRE

### 4.1 Réseau Sentinelles (Sentiweb) — grippe, gastro-entérite, varicelle, IRA/COVID
- **URL** : https://www.sentiweb.fr/?page=api | endpoint REST : `https://www.sentiweb.fr/api/data/rest/getIncidence`
- **Organisme** : INSERM/Sorbonne Université (Institut Pierre Louis, UMR S 1136), réseau de 1314 médecins généralistes + 116 pédiatres volontaires
- **Licence** : usage ouvert (à vérifier mention exacte sur le site, données publiques de santé publique)
- **Description** : Estimation d'incidence hebdomadaire par indicateur (grippe/syndrome grippal, gastro-entérite aiguë, varicelle, IRA/COVID) et par zone géographique, alimentée par télétransmission en temps réel des médecins Sentinelles.
- **Type de données** : incidence (nombre de cas et taux pour 100 000 hab.)
- **Format** : JSON ou XML selon en-tête Accept HTTP, également CSV
- **API** : Oui — GET `/getIncidence?indicator=X&geo=Y&span=YYYYWW-YYYYWW`, endpoint metadata `/indicators` listant tous les indicateurs et dimensions disponibles. Existe aussi une passerelle OData (https://odata.sentiweb.fr/)
- **Mise à jour** : hebdomadaire (bulletin chaque mardi), consolidation possible jusqu'à 3 semaines après (les toutes dernières semaines sont donc révisées a posteriori — à anticiper dans le pipeline)
- **Historique** : données annuelles depuis longtemps, hebdomadaires pour plusieurs indicateurs depuis 2014
- **Niveau géo** : national et régional (13 régions)
- **Qualité** : 9/10 | **Facilité** : 8/10 (API REST simple, bien documentée) | **Potentiel business** : 10/10 — **probablement la source la plus directement actionnable** pour prédire les ventes anti-grippe, antipyrétiques, solutions de réhydratation, anti-diarrhéiques.

### 4.2 Odissé (ex-Géodes) — Santé publique France, portail open data
- **URL** : https://odisse.santepubliquefrance.fr/ (l'ancien https://geodes.santepubliquefrance.fr/ redirige automatiquement)
- **Organisme** : Santé publique France
- **Licence** : Licence Ouverte (gouvernementale, à confirmer page par page)
- **Description** : Portail successeur de Géodes (été 2025), donnant accès à des indicateurs de santé publique couvrant ~90 pathologies/déterminants de santé, issus de ~70 systèmes de surveillance (dont SurSaUD, Sentinelles, enquêtes population). Une API est annoncée (documentation via « Vos outils »).
- **Type de données** : indicateurs épidémiologiques multiples (dont respiratoires, viroses hivernales, COVID)
- **Format** : export CSV/graphiques, API mentionnée mais doc non entièrement vérifiée dans cette recherche
- **API** : Oui (existence confirmée), endpoint exact à valider en接ntégration directe
- **Mise à jour** : variable selon indicateur — annuelle, mensuelle, hebdomadaire, **quotidienne pour COVID**
- **Historique** : variable selon indicateur, certains remontent à plusieurs années
- **Niveau géo** : national, régional, départemental, et **IRIS** pour certains indicateurs COVID (granularité infra-communale, rare en open data santé)
- **Qualité** : 9/10 | **Facilité** : 6/10 (portail encore jeune, à revalider techniquement) | **Potentiel business** : 8/10

### 4.3 SurSaUD® / réseau OSCOUR® — passages aux urgences
- **URL** : dataset historique COVID : https://www.data.gouv.fr/datasets/donnees-des-urgences-hospitalieres-et-de-sos-medecins-relatives-a-lepidemie-de-covid-19 ; description réseau : https://www.santepubliquefrance.fr/surveillance-syndromique-sursaud-R/reseau-oscour-R-organisation-de-la-surveillance-coordonnee-des-urgences ; fil de discussion demandant une API historique horaire : https://forum.data.gouv.fr/t/creation-dune-api-publique-historique-des-flux-horaires-aux-urgences-donnees-rpu/899
- **Organisme** : Santé publique France (via ~700 structures d'urgence participantes, 96% des passages nationaux couverts en 2024)
- **Licence** : Licence Ouverte
- **Description** : Résumés de passages aux urgences (RPU) avec données démographiques (sexe, âge), administratives (dates/heures, FINESS, code postal résidence) et médicales (diagnostic CIM-10). Coexiste avec les données SOS Médecins (actes médicaux) dans les mêmes jeux de données COVID historiques.
- **Type de données** : syndromique (grippe, gastro, bronchiolite, intoxications, canicule, etc. selon diagnostics CIM-10 regroupés)
- **Format** : CSV (datasets historiques par thème, notamment COVID mars 2020–août 2022)
- **API** : ⚠️ Pas d'API publique généraliste identifiée avec certitude pour un flux courant temps réel — accès principal par jeux de données ponctuels (thématiques COVID) sur data.gouv.fr et via Odissé. Une demande de la communauté pour une API horaire historique est documentée mais son aboutissement n'est pas confirmé.
- **Mise à jour** : quotidienne pendant les périodes de surveillance active (COVID), sinon publication par vagues/thématiques
- **Historique** : dataset COVID couvre mars 2020–août 2022 ; séries plus larges via Odissé selon indicateur
- **Niveau géo** : départemental (code postal patient disponible dans le détail RPU, mais agrégats publics souvent départementaux)
- **Qualité** : 8/10 | **Facilité** : 5/10 (fragmenté par jeux de données thématiques, pas d'API stable unique) | **Potentiel business** : 8/10 — signal précoce (les urgences précèdent souvent le pic officine de quelques jours) pour bronchiolite, gastro, canicule, intoxications alimentaires.

### 4.4 Annuaire Santé / Data Ameli — Observatoire de l'accès aux soins (repère contextuel)
- **URL** : https://www.assurance-maladie.ameli.fr/presse/2025-09-25-cp-lancement-observatoire-acces-soins ; portail data Ameli : https://data.ameli.fr/
- **Organisme** : CNAM/Assurance Maladie
- **Licence** : Licence Ouverte
- **Description** : Nouvel observatoire (lancé sept. 2025) en open data sur l'accès aux soins — utile en complément pour contextualiser la densité médicale par zone (proxy de la charge de patientèle potentielle d'une pharmacie), pas directement une variable exogène temporelle mais un facteur structurel.
- **Format** : visualisation data.ameli.fr, exports à vérifier
- **API** : à vérifier
- **Niveau géo** : à préciser (probablement département/région)
- **Qualité** : 7/10 | **Facilité** : 5/10 | **Potentiel business** : 5/10 (structurel plus que prévisionnel court terme)

---

## 5. CALENDRIER

### 5.1 API Calendrier scolaire (vacances scolaires)
- **URL** : https://www.data.gouv.fr/dataservices/api-calendrier-scolaire — endpoint réel : `https://data.education.gouv.fr/api/explore/v2.0/...` (Explore API v2, Opendatasoft)
- **Organisme** : Ministère de l'Éducation nationale / data.education.gouv.fr, référencé par etalab
- **Licence** : Open Licence 2.0
- **Description** : Dates de début/fin de vacances scolaires par zone (A, B, C) et académie, pour métropole + 11 territoires d'outre-mer (Réunion, Mayotte, Guadeloupe, Martinique, Guyane, Nouvelle-Calédonie, Polynésie, Saint-Barthélemy, Saint-Martin, Saint-Pierre-et-Miquelon, Wallis-et-Futuna).
- **Type de données** : type de vacances, population (élèves/enseignants), dates, académie, zone, année scolaire
- **Format** : JSON (API Explore Opendatasoft), Swagger disponible
- **API** : Oui — https://data.education.gouv.fr/api/explore/v2.0 (gratuite, ouverte)
- **Mise à jour** : annuelle (calendrier officiel publié à l'avance, donc **connu plusieurs années en amont** — feature exogène rare car sans incertitude de prévision)
- **Historique** : archivé, calendrier disponible plusieurs années en arrière et en avance
- **Niveau géo** : zone scolaire (A/B/C) + académie
- **Qualité** : 10/10 | **Facilité** : 8/10 | **Potentiel business** : 7/10 — rentrée scolaire = pic antipoux/vitamines/parapharmacie, vacances = creux de fréquentation urbaine / pic zones touristiques.

### 5.2 API Jours fériés
- **URL** : https://www.data.gouv.fr/dataservices/jours-feries — endpoint : `https://calendrier.api.gouv.fr/jours-feries/` (GitHub source : https://github.com/etalab/jours-feries-france-data)
- **Organisme** : DINUM / Etalab
- **Licence** : Open Licence 2.0
- **Description** : Liste des jours fériés légaux (Code du travail) par zone (métropole + DOM, incluant particularités locales type Mi-Carême), exports CSV/JSON/ICS + lib Python `jours-feries-france`.
- **Format** : JSON (API), CSV, ICS
- **API** : Oui — accès ouvert, gratuit
- **Mise à jour** : annuelle (jours fixes + mobiles calculés)
- **Historique** : calculable sur toute période (règle déterministe)
- **Niveau géo** : zones France + DOM (hors conventions collectives spécifiques, ex. Saint-Éloi/Sainte-Barbe exclues)
- **Qualité** : 10/10 | **Facilité** : 10/10 | **Potentiel business** : 6/10 — fermetures/horaires réduits, pics d'achat anticipé la veille de fériés (comportement de stockage patient).

---

## Tableau de synthèse rapide

| Source | Gratuit | API temps réel | Granularité géo la + fine | Granularité temporelle | Potentiel business |
|---|---|---|---|---|---|
| Météo-France (portail API) | Oui | Oui | Station (~2000 pts) | 6 min | 8/10 |
| Vigilance météo | Oui | Oui | Département | biquotidien+ | 9/10 |
| Climatologie historique | Oui | Non (fichiers) | Station | quotidien/mensuel | 7/10 |
| Open-Meteo | Oui (non-commercial) | Oui | Point lat/lon | horaire | 9/10 |
| Indice pollen Atmo | Oui | Oui (v2) | Commune | quotidien, prévision J+2 | 9/10 |
| IAS allergies (OpenHealth) | Oui | Non (fichier, ⚠️ obsolète) | National | quotidien (théorique) | 5/10 |
| Geod'Air | Oui | Oui | Station (~600 pts) | horaire | 7/10 |
| Indice ATMO qualité air | Oui | Oui | Commune | quotidien | 7/10 |
| Sentiweb (grippe/gastro/varicelle) | Oui | Oui | Région | hebdomadaire | 10/10 |
| Odissé (ex-Géodes) | Oui | Oui (à valider) | IRIS (COVID) / département | variable | 8/10 |
| SurSaUD/OSCOUR urgences | Oui | Partiel (datasets) | Département | quotidien (périodes actives) | 8/10 |
| Vacances scolaires | Oui | Oui | Zone/académie | connu à l'avance | 7/10 |
| Jours fériés | Oui | Oui | Zone France/DOM | connu à l'avance | 6/10 |

---

## Architecture de features de prévision (J+7 / J+15 / J+30)

**Principe clé** : plus l'horizon s'allonge, plus il faut remplacer les variables *observées* (météo J-1, urgences J-1) — disponibles seulement en J+0 à J+3 — par des variables *connues à l'avance* (calendrier) ou des *tendances lissées* (moyennes mobiles épidémiologiques), car aucune prévision météo fiable n'existe au-delà de J+14 et les indicateurs Sentinelles ne sont fiables qu'à J-7/J-14 avec révision.

### Horizon J+7 (court terme — pic de précision possible)
- Météo : prévision Météo-France/Open-Meteo réelle à J+7 (T°, pluie, UV) — fiabilité correcte
- Vigilance : bulletin vigilance J+1 déjà connu, extrapolation tendance sur le reste
- Pollen : indice Atmo prévisionnel jusqu'à J+2 seulement → au-delà, utiliser la moyenne saisonnière + météo (vent sec/T° comme proxy)
- Épidémiologie : dernière incidence Sentinelles connue (J-7 à J-21, à cause du délai de consolidation) + tendance de pente sur 3 dernières semaines
- Calendrier : jours fériés/vacances connus avec certitude
- **Lag recommandé** : météo à J-0 (nowcast + forecast J+7), épidémiologie en `incidence(t-14)` et sa dérivée, pollen en moyenne climatologique saisonnière + ajustement météo

### Horizon J+15
- Météo : prévision peu fiable au-delà de J+10 → basculer sur **normales saisonnières + anomalie court terme** (écart à la normale des 7 derniers jours comme proxy de persistance)
- Épidémiologie : utiliser le **modèle de pente d'incidence** (Sentinelles) plutôt que la valeur brute, + comparaison à la même semaine les années précédentes (saisonnalité grippale très régulière en calendrier ISO-semaine)
- Qualité de l'air/pollen : uniquement climatologie historique par commune/mois
- Calendrier : vacances scolaires et fériés toujours déterministes → poids relatif plus important à cet horizon car c'est une des rares variables *sans incertitude*

### Horizon J+30
- Météo : climatologie mensuelle seule (normales de saison), pas de prévision météo utile
- Épidémiologie : modèle de saisonnalité pure (courbes historiques Sentinelles par semaine ISO, moyennées sur 5-10 ans) + ajustement sur la précocité/l'intensité de la saison en cours si déjà détectable
- Calendrier scolaire/fériés : facteur dominant à cet horizon (rentrées, ponts, vacances d'été)
- Recommandation : à cet horizon, le modèle doit s'appuyer majoritairement sur les **variables déterministes (calendrier)** et la **saisonnalité historique**, la météo/pollen/pollution n'apportant quasiment plus d'information incrémentale fiable.

### Croisements à haute valeur ajoutée
1. **Indice grippe pondéré thermique** = `incidence_Sentinelles(région, semaine) × f(anomalie_température)` — un froid brutal accélère la diffusion virale, donc pondérer l'incidence constatée par le choc thermique récent améliore le signal à J+7.
2. **Indice respiratoire composite** = combinaison pollen (commune) + qualité de l'air ATMO (commune) + météo (vent/humidité) → pour prédire ventes ORL/allergo/asthme mieux qu'aucune variable seule.
3. **Indice canicule santé** = vigilance météo (orange/rouge) × historique de sur-fréquentation urgences en période de canicule (SurSaUD) → pic prévisible d'hydratation, dermocosmétique, anti-diarrhéiques (intoxications alimentaires estivales).
4. **Effet rentrée/vacances x épidémiologie** = croiser calendrier scolaire avec la remontée de gastro-entérite/poux/varicelle observée classiquement 2-3 semaines après chaque rentrée (crèches/écoles = vecteurs).
5. **Score de persistance météo** = moyenne mobile 7 jours de l'anomalie de température, meilleur prédicteur à J+15/J+30 qu'une prévision ponctuelle non fiable à cet horizon.

### Points de vigilance techniques
- **Délai de consolidation Sentinelles (jusqu'à 3 semaines)** : ne pas utiliser l'incidence "brute" de la semaine la plus récente comme si elle était définitive — utiliser des versions révisées ou modéliser l'incertitude de révision.
- **RNSA mort / migrer vers Atmo France** pour tout pipeline pollen — vérifier l'authentification exacte de l'API v2 Atmo France avant mise en prod.
- **Géodes → Odissé** : mettre à jour tous les liens/scrapers vers odisse.santepubliquefrance.fr.
- **Open-Meteo vs Météo-France officiel** : Open-Meteo est idéal pour prototyper vite (zéro friction), mais sa licence CC BY 4.0 est gratuite seulement en "non-commercial" à haut volume — si le produit final est commercialisé à grande échelle, basculer vers l'API officielle Météo-France (gratuite aussi, mais nécessite gestion de clé/quotas).

---

## Sources citées

- [Données Publiques de Météo-France](https://donneespubliques.meteofrance.fr/)
- [Portail API Météo-France](https://portail-api.meteofrance.fr/web/fr/)
- [meteo.data.gouv.fr](https://meteo.data.gouv.fr/)
- [API Bulletin Vigilance – data.gouv.fr](https://www.data.gouv.fr/dataservices/api-bulletin-vigilance)
- [Données climatologiques de base – quotidiennes](https://www.data.gouv.fr/datasets/donnees-climatologiques-de-base-quotidiennes)
- [Open-Meteo.com](https://open-meteo.com/) / [Docs](https://open-meteo.com/en/docs) / [Pricing](https://open-meteo.com/en/pricing)
- [Indice pollinique – Atmo France](https://www.atmo-france.org/article/lindice-pollinique)
- [Indice pollen – Atmo France](https://www.atmo-france.org/article/indice-pollen)
- [API Atmo France v2](https://admindata.atmo-france.org/api/doc/v2)
- [Indice pollen ATMO – Indice pollen communal (data.gouv.fr)](https://www.data.gouv.fr/datasets/indice-pollen-atmo-indice-pollen-communal)
- [Indice pollen ATMO – Historique (data.gouv.fr)](https://www.data.gouv.fr/datasets/indice-pollen-atmo-historique)
- [IAS® Manifestations Allergiques (data.gouv.fr)](https://www.data.gouv.fr/datasets/indicateur-avance-sanitaire-ias-r-manifestations-allergiques/)
- [Geod'Air – Accueil](https://www.geodair.fr/) / [API Geod'Air](https://www.geodair.fr/donnees/api)
- [Indice de qualité de l'air quotidien par commune (data.gouv.fr)](https://www.data.gouv.fr/en/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/)
- [Réseau Sentinelles – API](https://www.sentiweb.fr/?page=api)
- [Sentiweb Data Service](https://www.sentiweb.fr/api/data/rest)
- [OData Sentiweb](https://odata.sentiweb.fr/)
- [Estimation d'incidence des syndromes grippaux (data.gouv.fr)](https://www.data.gouv.fr/datasets/estimation-dincidence-des-syndromes-grippaux)
- [Géodes – Santé publique France (redirige vers Odissé)](https://geodes.santepubliquefrance.fr/)
- [Odissé – nouveau portail open data Santé publique France](https://www.santepubliquefrance.fr/les-actualites/2025/odisse-le-nouveau-portail-open-data-de-sante-publique-france-au-service-de-tous)
- [Odissé – Accueil](https://odisse.santepubliquefrance.fr/page/accueil/)
- [Réseau OSCOUR® – Santé publique France](https://www.santepubliquefrance.fr/surveillance-syndromique-sursaud-R/reseau-oscour-R-organisation-de-la-surveillance-coordonnee-des-urgences)
- [Données urgences hospitalières et SOS Médecins COVID-19 (data.gouv.fr)](https://www.data.gouv.fr/datasets/donnees-des-urgences-hospitalieres-et-de-sos-medecins-relatives-a-lepidemie-de-covid-19)
- [Forum data.gouv.fr – demande API historique urgences RPU](https://forum.data.gouv.fr/t/creation-dune-api-publique-historique-des-flux-horaires-aux-urgences-donnees-rpu/899)
- [Lancement Observatoire accès aux soins – Assurance Maladie](https://www.assurance-maladie.ameli.fr/presse/2025-09-25-cp-lancement-observatoire-acces-soins)
- [API Calendrier scolaire (data.gouv.fr)](https://www.data.gouv.fr/dataservices/api-calendrier-scolaire)
- [API Jours fériés (data.gouv.fr)](https://www.data.gouv.fr/dataservices/jours-feries)
- [GitHub etalab/jours-feries-france-data](https://github.com/etalab/jours-feries-france-data)

---

**Note de méthode** : cette recherche a été conduite directement par l'agent (recherches web + fetch de pages officielles), sans sous-agents parallèles dédiés (outil d'orchestration multi-agents non disponible dans cet environnement d'exécution). Les mentions "à valider"/"non confirmé" signalent les points où la documentation publique était incomplète ou ambiguë au moment de la recherche — à re-vérifier avant intégration en production, notamment l'authentification exacte de l'API Atmo France v2 et l'existence d'une API horaire stable pour OSCOUR/SurSaUD hors périodes COVID.

---

# AGENT 3 — Ventes de médicaments en France : sources publiques (rapport)

Recherche menée sur data.ameli.fr / data.gouv.fr / DREES / Eurostat / OCDE / ECDC / ANSM / EMA. Chaque fiche a été vérifiée par récupération directe de la page source (pas de contenu inventé). Point critique demandé explicitement : **aucune de ces bases n'a la maille "officine" (point de vente)** — elles sont toutes construites au niveau prescription/remboursement (SNDS), agrégées ensuite par région/département/prescripteur/produit, jamais par pharmacie individuelle.

---

## 1. Open Medic — base complète sur les dépenses de médicaments

Nom | Open Medic (base complète, interrégimes)
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-medic-base-complete-depenses-medicaments et miroir https://www.data.gouv.fr/datasets/open-medic-base-complete-sur-les-depenses-de-medicaments-interregimes
Organisme | CNAM (Caisse nationale de l'Assurance Maladie), extraction du SNDS
Licence | Licence Ouverte / Open Licence
Description | Remboursements de médicaments délivrés en pharmacie de ville, tous régimes confondus, avec ventilation bénéficiaire (âge, sexe, région) et prescripteur (spécialité)
Type de données | Remboursements/dépenses de médicaments en ville
Format | CSV zippés (78 fichiers 2014-2024 sur data.gouv.fr) + dictionnaire des variables en XLSX
API | Non directement (fichiers statiques téléchargeables) ; exploration interactive possible via l'application "Open SNDS"
Mise à jour | Annuelle (dernier point 2024, mise à jour constatée le 03/07/2026 sur data.gouv.fr)
Historique | 2014 à 2024 (11 ans)
Nb de lignes | Plusieurs millions de lignes par année (croisement CIP13 × région × âge × sexe × prescripteur) — fichiers agrégés donc taille fichier modeste (1,5-3,1 Mo par fichier) mais lignes nombreuses après dézippage
Variables principales | Code CIP13, classification ATC, montant remboursé (REM), base de remboursement (BSE), nombre de boîtes, âge, sexe, région du bénéficiaire, spécialité du prescripteur, régime
Niveau géographique | Région (nomenclature INSEE en vigueur) — pas de département, pas d'officine
Qualité /10 | 9
Facilité d'intégration /10 | 8
Potentiel business /10 | 9

**Intérêt** : c'est LA colonne vertébrale du data lake — seule base publique croisant CIP13 précis × géographie × profil patient × prescripteur sur 11 ans. Permet de construire un indicateur "potentiel de vente théorique par région et par produit", à ventiler ensuite au prorata du nombre d'officines (via FINESS/Ordre) pour estimer le potentiel par pharmacie. Secret statistique : valeurs masquées si moins de 10 bénéficiaires.

⚠️ Anomalie signalée sur les données 2025 (région bénéficiaire) en cours de correction (juin 2026).

---

## 2. Open Medic — bases complémentaires (bénéficiaires)

Nom | Open Medic : bases complémentaires sur les dépenses de médicaments
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-medic-depenses-beneficiaires-medicaments
Organisme | CNAM
Licence | Licence Ouverte
Description | Complète Open Medic avec le nombre de bénéficiaires distincts par médicament/territoire (permet de calculer un "nombre de patients traités" et pas seulement un volume de boîtes)
Type de données | Nombre de bénéficiaires ayant eu au moins une délivrance
Format | CSV zippé
API | Non
Mise à jour | Annuelle
Historique | 2014-2024
Nb de lignes | Du même ordre qu'Open Medic
Variables principales | Nombre de bénéficiaires distincts, CIP13/ATC, région, âge, sexe
Niveau géographique | Région
Qualité /10 | 8
Facilité d'intégration /10 | 8
Potentiel business /10 | 7

**Intérêt** : permet de distinguer "beaucoup de boîtes vendues à peu de patients" (chroniques) vs "peu de boîtes à beaucoup de patients" (ponctuel) — utile pour cibler les messages d'observance/renouvellement du pharmacien.

---

## 3. Medic'AM — par classe ATC (mensuel)

Nom | Médicaments délivrés par les pharmacies de ville par classe ATC — Medic'AM
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-classe-atc-medicam
Organisme | CNAM
Licence | Licence Ouverte (série labellisée par l'Autorité de la statistique publique jusqu'en juillet 2025)
Description | Médicaments délivrés en pharmacie de ville et remboursés, par classe ATC (ATC1 à ATC5) et par code CIP13
Type de données | Remboursements/boîtes délivrées, granularité produit ET classe
Format | ZIP contenant CSV, fichiers semestriels mis à jour mensuellement + fichier annuel cumulé
API | Non identifiée directement sur cette page (fichiers statiques)
Mise à jour | Mensuelle
Historique | Janvier 2012 à aujourd'hui (2026)
Nb de lignes | Élevé : chaque mois × chaque CIP13/classe ATC × taux de remboursement
Variables principales | Base de remboursement, montant remboursé, nombre de boîtes remboursées, classes EphMRA/ATC5/ATC2, taux de remboursement (100% vs autre)
Niveau géographique | France entière uniquement (pas de région ni département)
Qualité /10 | 9
Facilité d'intégration /10 | 8
Potentiel business /10 | 8

**Intérêt** : seule base **mensuelle** (donc utilisable pour la saisonnalité fine — grippe, allergies, gastro) au niveau national, avec la maille CIP13 réelle. Très complémentaire d'Open Medic (annuel, régional) : Medic'AM donne la dynamique temporelle fine, Open Medic donne la granularité géographique. Croisement possible avec RNSA (pollen) et Sentinelles (épidémiologie) pour anticiper les pics de demande produit par produit.

---

## 4. Medic'AM — par type de prescripteur (mensuel)

Nom | Médicaments délivrés par les pharmacies de ville par type de prescripteur — Medic'AM
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-type-prescripteur-medicam (+ série annuelle 2001-2014 : medicaments-type-prescripteur-medicam-annuel-2001-2014)
Organisme | CNAM
Licence | Licence Ouverte
Description | Mêmes données que ci-dessus mais ventilées par statut du prescripteur : libéral / salarié (essentiellement hospitalier) / tous prescripteurs
Type de données | Remboursements par CIP13 et type de prescripteur
Format | ZIP/CSV, semestriel mis à jour mensuellement
API | Non identifiée
Mise à jour | Mensuelle
Historique | Janvier 2015 à 2026 (mensuel) + série annuelle 2001-2014
Nb de lignes | Élevé
Variables principales | CIP13, EphMRA/ATC5/ATC2, base de remboursement, montant remboursé, nombre de boîtes, type prescripteur
Niveau géographique | France entière (national)
Qualité /10 | 9
Facilité d'intégration /10 | 8
Potentiel business /10 | 7

**Intérêt** : permet d'estimer la part de marché "ville vs prescription hospitalière relayée" produit par produit — utile pour anticiper l'arrivée en pharmacie de traitements initiés à l'hôpital (lien direct avec Open PHMEV ci-dessous).

---

## 5. Open PHMEV — base complète (prescriptions hospitalières exécutées en ville)

Nom | Open PHMEV : base complète
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-phmev-base-complete (+ data.gouv.fr : https://www.data.gouv.fr/datasets/open-phmev-bases-sur-les-prescriptions-hospitalieres-de-medicaments-delivrees-en-ville)
Organisme | CNAM
Licence | Licence Ouverte
Description | Médicaments prescrits par un établissement de santé (hôpital public/ESPIC) mais délivrés en pharmacie de ville
Type de données | Dépenses et boîtes délivrées, par établissement prescripteur
Format | CSV zippé
API | Non
Mise à jour | Annuelle
Historique | 2014-2025 (12 ans)
Nb de lignes | Important (croisement établissement × classe ATC × âge/sexe bénéficiaire)
Variables principales | Montants remboursés (REM/BSE), nombre de boîtes, âge/sexe bénéficiaire, n° FINESS de l'établissement prescripteur, catégorie juridique, géolocalisation de l'établissement
Niveau géographique | Granularité **ATC** (pas CIP13) ; géographie = établissement prescripteur (donc "point" géolocalisé, pas région du patient)
Qualité /10 | 8
Facilité d'intégration /10 | 7
Potentiel business /10 | 8

**Intérêt** : ces prescriptions représentent ~10% des boîtes délivrées en ville mais ~30% des montants remboursés (médicaments innovants/pathologies lourdes) — signal précoce pour anticiper la demande de produits chers/spécialisés en officine, en croisant avec la carte des établissements (FINESS) à proximité de chaque pharmacie.

⚠️ Granularité produit = **ATC uniquement**, pas de CIP13 — moins fin qu'Open Medic/Medic'AM sur ce plan.

---

## 6. Open PHMEV — base régionale

Nom | Open PHMEV : base régionale
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-phmev-base-regionale
Organisme | CNAM
Licence | Licence Ouverte
Description | Version agrégée d'Open PHMEV par région d'implantation de l'établissement prescripteur (plutôt que par établissement individuel)
Type de données | Idem base complète mais agrégée
Format | CSV zippé
API | Non
Mise à jour | Annuelle
Historique | 2014-2025
Nb de lignes | Moyen (agrégé)
Variables principales | Mêmes que base complète, agrégées par région + catégorie juridique de l'établissement
Niveau géographique | Région
Qualité /10 | 8
Facilité d'intégration /10 | 8
Potentiel business /10 | 6

**Intérêt** : simplifie les analyses macro régionales sans manipuler la base établissement par établissement — bon point d'entrée avant d'aller chercher le détail dans la base complète.

---

## 7. Open LPP — dispositifs médicaux (hors médicaments stricts mais périphérique)

Nom | Open LPP : base complète sur les dépenses de dispositifs médicaux
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-lpp-base-complete-depenses-dispositifs-medicaux
Organisme | CNAM
Licence | Licence Ouverte
Description | Dispositifs médicaux inscrits à la LPP (pansements, orthèses, matériel, etc.) délivrés en ville et remboursés
Type de données | Remboursements de dispositifs médicaux (pas des médicaments au sens strict)
Format | CSV zippé
API | Non
Mise à jour | Annuelle (correction du 17/04/2025 sur les bases 2014-2019)
Historique | 2014-2024
Nb de lignes | Important
Variables principales | REM, BSE, quantité (QTE), âge/sexe/région bénéficiaire, spécialité prescripteur, code LPP / titre / sous-chapitres SC1-SC2
Niveau géographique | Région
Qualité /10 | 8
Facilité d'intégration /10 | 8
Potentiel business /10 | 6

**Intérêt** : utile pour le rayon parapharmacie/matériel médical de l'officine (hors périmètre strict "médicament" mais fort potentiel de vente additionnelle — pansements, compression, autotests).

---

## 8. Retroced'AM — rétrocession hospitalière

Nom | Retroced'AM
---|---
URL | https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-retrocession-hospitaliere-retrocedam
Organisme | CNAM
Licence | Licence Ouverte
Description | Médicaments remboursés dans le cadre de la rétrocession hospitalière (délivrance par pharmacie hospitalière à des patients non hospitalisés, liste fixée par arrêté)
Type de données | Remboursements par code UCD
Format | Tableaux Excel pluriannuels
API | Non
Mise à jour | Annuelle
Historique | 2010-2025
Nb de lignes | Faible/moyen (liste restreinte de produits rétrocédables)
Variables principales | Base de remboursement, marge de rétrocession, montant remboursé, nombre d'unités remboursées, code UCD
Niveau géographique | National
Qualité /10 | 7
Facilité d'intégration /10 | 7
Potentiel business /10 | 4

**Intérêt** : périmètre étroit (produits hors-officine par construction, canal hôpital) mais utile pour comprendre les produits qui échappent totalement au circuit officinal — négatif utile pour ne pas surestimer le marché officine sur certaines molécules.

---

## 9. Data ameli (portail OpenDataSoft) — dataset "prescriptions" par territoire

Nom | Professionnels de santé libéraux : montants des prescriptions par poste et par territoire
---|---
URL | https://data.ameli.fr/explore/dataset/prescriptions/ (API : /api/ ; console API globale : https://data.ameli.fr/api/explore/v2.1/console)
Organisme | CNAM
Licence | Licence Ouverte (portail OpenDataSoft)
Description | Montants de prescriptions (tous postes de dépense, pas seulement médicament) par département/région
Type de données | Dépenses agrégées par "poste" (médicaments = un poste parmi d'autres : actes, transports, etc.), pas par produit
Format | CSV/JSON/GeoJSON via API OpenDataSoft standard
API | **Oui** — API REST v2.1 documentée avec console interactive (rare sur ce périmètre — la plupart des autres bases CNAM sont en fichiers statiques)
Mise à jour | Non précisée clairement (portail actif, mises à jour périodiques)
Historique | Non précisé sur la fiche consultée
Nb de lignes | Moyen (département × poste × année)
Variables principales | Montant de prescription par poste, département, région
Niveau géographique | Département ET région (plus fin que les bases Open Medic/PHMEV qui sont régionales)
Qualité /10 | 6
Facilité d'intégration /10 | 9 (vraie API REST)
Potentiel business /10 | 5

**Intérêt technique** : c'est la **seule base de cette liste dotée d'une vraie API REST interrogeable en direct** (pas de téléchargement de ZIP) — donc idéale comme brique technique de démonstration pour un pipeline automatisé, même si son contenu médicament est agrégé ("poste") et moins riche que les fichiers CSV Open Medic/Medic'AM. Le même portail héberge aussi "démographie des professionnels de santé" et "patientèle par territoire" (utile pour croiser avec la densité de patientèle par pharmacie/zone).

---

## 10. DREES — Comptes de la santé (CSBM) / Panorama des dépenses de santé

Nom | Les comptes de la santé (CNS) — Consommation de soins et de biens médicaux
---|---
URL | https://drees.solidarites-sante.gouv.fr/publications-communique-de-presse-infographie-documents-de-reference/250930-Panorama-d%C3%A9penses-de-sant%C3%A9 (données : https://data.drees.solidarites-sante.gouv.fr/explore/dataset/306_les-comptes-de-la-sante/ et https://data.drees.solidarites-sante.gouv.fr/explore/dataset/cns_ed2023_ods_2023/)
Organisme | DREES (Ministère de la Santé), méthodologie INSEE (comptes nationaux, satellite des comptes de la Nation)
Licence | Licence Ouverte (data.drees, portail OpenDataSoft)
Description | Agrégats macro-économiques : dépense pharmaceutique totale en France, décomposition volume/prix, part de l'Assurance Maladie/État/complémentaires/ménages, comparaisons internationales via SHA (System of Health Accounts)
Type de données | Agrégats macro annuels, pas de détail produit
Format | CSV via portail OpenDataSoft + rapports PDF ("Panorama de la DREES")
API | Oui (portail OpenDataSoft data.drees, API standard type /api/records)
Mise à jour | Annuelle (dernière édition connue : "Les dépenses de santé en 2024", parue 30/09/2025)
Historique | Longue série (comptes de la santé publiés depuis les années 1990, séries récentes bien structurées)
Nb de lignes | Faible (agrégats), quelques centaines de lignes par édition
Variables principales | CSBM (consommation de soins et biens médicaux), dépense de médicaments en valeur, décomposition volume-prix, financeur, reste à charge des ménages
Niveau géographique | National uniquement
Qualité /10 | 9
Facilité d'intégration /10 | 7
Potentiel business /10 | 6

**Intérêt** : sert de **cadrage macro de référence** (total du marché officine en France, poids des médicaments dans la dépense de santé, part générique) pour calibrer/valider les résultats obtenus en sommant Open Medic + Medic'AM + estimation OTC. La fiche DREES dédiée "La structure des ventes de médicaments en officine" (https://drees.solidarites-sante.gouv.fr/sites/default/files/2024-11/CNS24%20-%20Fiche%2013%20-%20La%20structure%20des%20ventes%20de%20m%C3%A9dicaments%20aux%20officines.pdf) donne des repères qualitatifs précieux (part générique/princeps, remboursable/non remboursable) à intégrer en dur dans le modèle si le PDF n'a pas de CSV associé.

---

## 11. Eurostat — Dépenses de santé par fonction (SHA 2011), poste pharmaceutique

Nom | Health care expenditure by function / financing scheme (hlth_sha11 et sous-tables, ex. hlth_sha11_hchf)
---|---
URL | https://ec.europa.eu/eurostat/databrowser/view/hlth_sha11_hf/default/table (métadonnées : https://ec.europa.eu/eurostat/cache/metadata/en/hlth_sha11_esms.htm) — API : https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started
Organisme | Eurostat (Commission européenne), sur base des déclarations nationales (DREES pour la France) selon méthodologie SHA
Licence | Réutilisation libre (licence standard Eurostat, gratuite)
Description | Dépenses de santé par fonction (dont "médicaments et autres biens médicaux non durables"), par financeur, comparables entre pays européens
Type de données | Agrégats macro annuels par pays
Format | SDMX-ML (XML), SDMX-CSV, JSON-stat, TSV
API | **Oui** — API SDMX 2.1 complète, RESTful, formats multiples
Mise à jour | Annuelle, diffusée 2×/an (première diffusion visée novembre t+2)
Historique | Série remontant selon les pays à ~2000-2010 selon les tables, régulièrement mise à jour
Nb de lignes | Faible à moyen (pays × année × fonction × financeur)
Variables principales | Dépense en médicaments (HC511/HC512 dans la nomenclature ICHA), par pays, par financeur
Niveau géographique | Pays (comparaison France vs UE), pas de région infranationale
Qualité /10 | 9
Facilité d'intégration /10 | 9 (API SDMX propre, bien documentée)
Potentiel business /10 | 5

**Intérêt** : permet de positionner la France par rapport à ses voisins européens (dépense pharmaceutique par habitant, part des génériques, etc.) — utile pour un argumentaire commercial/stratégique ("la France est sous/sur la moyenne UE sur telle classe") plutôt que pour un usage opérationnel quotidien du pharmacien.

---

## 12. OCDE — Pharmaceutical spending (dépense pharmaceutique)

Nom | Pharmaceutical spending (indicateur OCDE)
---|---
URL | https://www.oecd.org/en/data/indicators/pharmaceutical-spending.html — Data Explorer : https://data-explorer.oecd.org/
Organisme | OCDE
Licence | Gratuit sous conditions d'utilisation OCDE (API libre, "Terms and Conditions" à accepter, pas de paiement)
Description | Dépense pharmaceutique totale (prescription + automédication/OTC) en % du PIB, en % de la dépense de santé totale, en USD PPA par habitant, par pays OCDE
Type de données | Agrégats macro-pays
Format | CSV, JSON, XML via API SDMX
API | Oui — API SDMX standard OCDE (RESTful), icône "Developer API" sur chaque vue du Data Explorer
Mise à jour | Annuelle
Historique | Longue série disponible par pays (variable selon pays, souvent 1990s/2000s à aujourd'hui)
Nb de lignes | Faible (pays × année)
Variables principales | Dépense pharmaceutique totale, % PIB, % dépense santé, USD PPA/habitant
Niveau géographique | Pays uniquement
Qualité /10 | 9
Facilité d'intégration /10 | 8
Potentiel business /10 | 4

**Intérêt** : indicateur de contexte macro international, faible valeur opérationnelle directe pour le pharmacien mais utile pour un dashboard "vision marché" du copilote (tendances longues, comparaison internationale).

---

## 13. OCDE — Pharmaceutical consumption par classe ATC (HEALTH_PHMC, DDD)

Nom | Pharmaceutical consumption (HEALTH_PHMC @ DF_PHMC_CONSUM)
---|---
URL | https://data-explorer.oecd.org/vis?lc=en&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=HEALTH_PHMC@DF_PHMC_CONSUM&df%5Bag%5D=OECD.ELS.HD
Organisme | OCDE, méthodologie WHO Collaborating Centre for Drug Statistics Methodology (ATC/DDD)
Licence | Gratuit, API SDMX OCDE
Description | Consommation pharmaceutique par classe ATC (ex. antibiotiques J01, antidiabétiques A10, antidépresseurs N06A, etc.) exprimée en DDD (dose définie journalière) pour 1000 habitants/jour, par pays OCDE
Type de données | Volumes de consommation normalisés (pas des montants), granularité **classe ATC** (pas CIP13, pas laboratoire)
Format | CSV/JSON/XML via API SDMX, visualisation via Data Explorer
API | Oui — même API SDMX que les autres jeux OCDE
Mise à jour | Annuelle
Historique | Selon les classes, données disponibles souvent depuis 2010-2020 selon pays
Nb de lignes | Moyen (pays × classe ATC × année)
Variables principales | DDD/1000 habitants/jour par classe thérapeutique et par pays
Niveau géographique | Pays uniquement
Qualité /10 | 8
Facilité d'intégration /10 | 8
Potentiel business /10 | 6

**Intérêt** : c'est la seule base internationale donnant un **volume de consommation normalisé par classe thérapeutique** (indépendant des prix, donc comparable dans le temps et entre pays) — utile pour détecter des tendances de fond (hausse structurelle des antidiabétiques, baisse des antibiotiques post-Covid, etc.) à croiser avec les tendances Medic'AM françaises pour valider ou anticiper une inflexion du marché national.

---

## 14. ECDC — ESAC-Net (consommation d'antibiotiques en Europe)

Nom | European Surveillance of Antimicrobial Consumption Network (ESAC-Net)
---|---
URL | https://www.ecdc.europa.eu/en/antimicrobial-consumption/surveillance-and-disease-data/database (dashboard interactif) + https://www.ecdc.europa.eu/en/antimicrobial-consumption/database/data-source-overview
Organisme | ECDC (Centre européen de prévention et de contrôle des maladies), données transmises via TESSy
Licence | Accès public gratuit (dashboard + données téléchargeables)
Description | Consommation d'antibiotiques (classe ATC J01) en ville et à l'hôpital, par pays européen dont la France, sur longue série
Type de données | Volumes de consommation en DDD, granularité **classe ATC J01 uniquement** (antibiotiques)
Format | Dashboard interactif ECDC, export CSV possible
API | Non identifiée clairement (dashboard interactif, pas d'API REST publique documentée trouvée)
Mise à jour | Annuelle (rapport épidémiologique annuel, ex. rapport 2024)
Historique | Série longue, plusieurs années disponibles (ESAC existe depuis les années 2000, ESAC-Net depuis 2011)
Nb de lignes | Faible/moyen (28 pays × année × secteur ville/hôpital)
Variables principales | DDD/1000 habitants/jour, secteur (ville vs hôpital), pays
Niveau géographique | Pays (France agrégée), pas de région
Qualité /10 | 8
Facilité d'intégration /10 | 6
Potentiel business /10 | 3

**Intérêt** : périmètre très étroit (antibiotiques uniquement) mais donne un signal européen précoce sur les tendances de résistance/consommation antibiotique, thème sensible pour la politique de dispensation en officine (mésusage, alternatives).

---

## 15. ANSM — Analyse des ventes de médicaments en France (rapport historique)

Nom | Analyse des ventes de médicaments en France (rapport annuel ANSM)
---|---
URL | Archive : https://archive.ansm.sante.fr/var/ansm_site/storage/original/application/bf1436c1cc9ffd8e8d8771ab85c410dc.pdf (exemple 2013 : https://uspo.fr/wp-content/uploads/2014/06/ANSM_Analyse-Ventes-Medicaments_2013.pdf)
Organisme | ANSM (Agence nationale de sécurité du médicament et des produits de santé)
Licence | Document public PDF (pas de licence de réutilisation de données structurées, pas de fichier CSV associé identifié)
Description | Analyse exhaustive des ventes déclarées par les laboratoires (officine + hôpital), y compris médicaments non remboursables/OTC — historiquement le rapport le plus complet car basé sur les déclarations industrielles obligatoires, pas seulement les remboursements
Type de données | Ventes totales par classe thérapeutique, part générique/princeps, chiffres de cadrage
Format | PDF uniquement (pas de CSV/API identifié)
API | Non
Mise à jour | **Irrégulière/interrompue** : les rapports identifiés les plus détaillés et récents datent de 2012-2013 ; les rapports d'activité 2023/2024 de l'ANSM ne reprennent plus cette analyse exhaustive sous la même forme
Historique | ~2010-2013 en détail ; au-delà, seulement des rapports d'activité généralistes
Nb de lignes | Non applicable (rapport PDF, pas de base de données tabulaire)
Variables principales | Ventes en valeur et en unités par classe ATC, part de marché génériques
Niveau géographique | National
Qualité /10 | 5 (fiable mais ancien et non structuré)
Facilité d'intégration /10 | 2 (PDF non tabulaire, pas d'API)
Potentiel business /10 | 5

**Intérêt** : c'est la seule source qui couvrait **aussi les ventes non remboursables/OTC** (hors du champ SNDS/CNAM) — donc complémentaire sur le papier pour les produits de conseil officinal, mais son irrégularité récente et son format PDF non structuré en limitent fortement l'usage pour un pipeline automatisé. À surveiller si l'ANSM relance une publication structurée (les déclarations de ventes annuelles industrielles existent toujours obligatoirement — https://ansm.sante.fr/vos-demarches/industriel/declarer-les-ventes-annuelles — mais ne sont pas rendues publiques sous forme de jeu de données).

---

## 16. EMA (European Medicines Agency) — pas de source de ventes/consommation publique directe pour la France

Constat de vérification (important pour éviter une fausse piste) : l'EMA ne publie **aucun jeu de données public de ventes ou de consommation de médicaments en France**. Ce que la recherche a permis de vérifier :
- L'EMA utilise les données du SNDS français dans le cadre du réseau **DARWIN EU** (études réglementaires de pharmacovigilance/efficacité), mais cet accès est réservé aux études réglementaires encadrées, **pas un jeu de données ouvert au public** (cf. note de protection des données EMA sur l'usage du SNDS : https://www.ema.europa.eu/en/documents/other/european-medicines-agencys-data-protection-notice-use-snds-data-performance-darwin-eur-studies-incidence-prevalence-pathologies-use-drugs-french-population_en.pdf).
- L'EMA gère en revanche **ESVAC** (European Surveillance of Veterinary Antimicrobial Consumption) — mais ce périmètre est **vétérinaire**, hors sujet officine humaine.
- Conclusion : pour les ventes humaines par pays, ce sont Eurostat/OCDE/ECDC (fiches 11-14 ci-dessus) qui font référence au niveau européen, pas l'EMA directement.

Qualité de cette vérification /10 | 9 (confirmé par la documentation officielle EMA elle-même)

---

## 17. CEPS — rapports d'activité (contexte prix/génériques, pas de données brutes)

Nom | Rapports d'activité du CEPS (Comité Économique des Produits de Santé)
---|---
URL | https://sante.gouv.fr/ministere/acteurs/instances-rattachees/comite-economique-des-produits-de-sante-ceps/article/rapports-d-activite-du-ceps
Organisme | CEPS (Ministère de la Santé)
Licence | Document public PDF
Description | Bilan annuel de la régulation des prix (conventions prix/laboratoires), chiffres clés sur le marché des génériques (ex : génériques = 42,0% des boîtes vendues en 2023, CA de 7,41 Md€), mécanismes de fixation des prix
Type de données | Chiffres agrégés de cadrage, pas de base de données brute
Format | PDF
API | Non
Mise à jour | Annuelle
Historique | Rapports disponibles sur plusieurs années
Nb de lignes | Non applicable
Variables principales | Part de marché générique/princeps, règles de fixation de prix (ex. prix générique = -60% du princeps de référence), chiffres de régulation
Niveau géographique | National
Qualité /10 | 8
Facilité d'intégration /10 | 3 (PDF, pas de données tabulaires)
Potentiel business /10 | 5

**Intérêt** : source qualitative de référence pour coder en dur les règles métier du "moteur de marge générique" (ex. -60% prix fabricant générique vs princeps, -20% sur le princeps de référence après le générique) — complète utilement le module PPHT/NR déjà en place dans le projet (cf. mémoire `project_ppht_nr_pricing.md`).

---

## Tableau de synthèse récapitulatif

| # | Source | Fréquence | Granularité produit | Maille officine ? | Gratuit/Payant | Qualité | Intégration | Potentiel business |
|---|--------|-----------|---------------------|--------------------|-----------------|---------|--------------|---------------------|
| 1 | Open Medic (base complète) | Annuelle | CIP13 | Non (région) | Gratuit | 9 | 8 | **9** |
| 3 | Medic'AM par classe ATC | **Mensuelle** | CIP13 | Non (national) | Gratuit | 9 | 8 | 8 |
| 4 | Medic'AM par prescripteur | Mensuelle | CIP13 | Non (national) | Gratuit | 9 | 8 | 7 |
| 5 | Open PHMEV base complète | Annuelle | ATC (pas CIP13) | Non (établissement) | Gratuit | 8 | 7 | 8 |
| 2 | Open Medic bénéficiaires | Annuelle | CIP13 | Non (région) | Gratuit | 8 | 8 | 7 |
| 6 | Open PHMEV régionale | Annuelle | ATC | Non (région) | Gratuit | 8 | 8 | 6 |
| 10 | DREES Comptes de la santé | Annuelle | Agrégat national | Non | Gratuit | 9 | 7 | 6 |
| 13 | OCDE HEALTH_PHMC (DDD/ATC) | Annuelle | ATC | Non (pays) | Gratuit | 8 | 8 | 6 |
| 7 | Open LPP | Annuelle | Code LPP | Non (région) | Gratuit | 8 | 8 | 6 |
| 9 | Data ameli API "prescriptions" | Non précisée | Poste agrégé | Non (dépt/région) | Gratuit | 6 | **9** | 5 |
| 11 | Eurostat hlth_sha11 | Annuelle | Agrégat pays | Non | Gratuit | 9 | 9 | 5 |
| 12 | OCDE Pharmaceutical spending | Annuelle | Agrégat pays | Non | Gratuit | 9 | 8 | 4 |
| 15 | ANSM Analyse des ventes | Irrégulière | Classe ATC | Non (national) | Gratuit | 5 | 2 | 5 |
| 17 | CEPS rapports | Annuelle | Qualitatif | Non | Gratuit | 8 | 3 | 5 |
| 8 | Retroced'AM | Annuelle | Code UCD | Non (national) | Gratuit | 7 | 7 | 4 |
| 14 | ECDC ESAC-Net | Annuelle | ATC J01 seul | Non (pays) | Gratuit | 8 | 6 | 3 |
| 16 | EMA | — | — | — | N/A | — | — | **Pas de source exploitable** (accès SNDS réglementaire fermé) |

**Priorité d'intégration recommandée** : Open Medic (base complète) + Medic'AM (classe ATC + prescripteur) forment le socle indispensable — ce sont les seules bases combinant maille CIP13 précise avec une fréquence exploitable (mensuelle pour Medic'AM) et une profondeur historique de plus de 10 ans, 100% gratuites, en Licence Ouverte, déjà disponibles en CSV. Open PHMEV vient ensuite pour capter le signal "prescription hospitalière → ville". Les bases Eurostat/OCDE/DREES/CEPS servent de calibrage macro et de contexte international, pas de moteur opérationnel quotidien. Aucune base ne descend à la maille officine : ce niveau ne pourra être **estimé** (jamais mesuré directement en open data) qu'en pondérant Open Medic/Medic'AM par un référentiel d'implantation officinale (FINESS/Ordre des pharmaciens, déjà exploré dans `project_groupements_pharma_db.md`) croisé à la démographie/patientèle locale.

---

# AGENT 1 — STOCK : Ruptures, Pénuries, Contingentements, Rappels de Lots

*Recherche approfondie de sources publiques/gratuites — France, UE, international. Toutes les URLs ont été vérifiées par fetch direct début juillet 2026.*

---

## 1. ANSM — Nombre et nature des déclarations de ruptures de stock (data.ansm)

- **Nom** : data.ansm — module "Ruptures"
- **URL** : https://data.ansm.sante.fr/ruptures (portail global : https://data.ansm.sante.fr/)
- **Organisme** : ANSM, développé avec le programme "Entrepreneurs d'intérêt général" d'Etalab, en partenariat avec le Health Data Hub
- **Licence** : Open Licence (Licence Ouverte) 2.0
- **Description** : Tableau de bord public agrégeant les déclarations de ruptures/risques de rupture de stock faites par les industriels sur la plateforme Trustmed, pour les médicaments d'intérêt thérapeutique majeur (MITM). Pour 2024 : 3 809 déclarations reçues (1 076 ruptures confirmées, 2 733 risques), avec répartition par classe thérapeutique, causes déclarées (volume de vente accru, capacité de production insuffisante, défaut d'approvisionnement matières premières) et mesures correctives (contingentement, importation, flexibilité réglementaire).
- **Type de données** : statistiques agrégées + historique de séries
- **Format** : interface web (dataviz), pas de fichier téléchargeable structuré identifié sur cette page précise
- **API dispo** : **Non** — la page data.gouv.fr associée précise explicitement "Il n'y a pas encore d'API associée"
- **Mise à jour** : dernière mise à jour identifiée juin 2025 (annuelle globalement, données N-1)
- **Historique** : 2014-2024, mais avertissement officiel : "les données antérieures à mai 2021 n'étant pas regroupées sous forme de base de données, elles ne sont pas toutes exploitables" — donc historique réellement exploitable ≈ 2021-2024
- **Nb de lignes (ordre de grandeur)** : ~3 800 déclarations/an récentes, dizaines de milliers cumulées depuis 2014
- **Variables principales** : classe thérapeutique, cause de rupture, type de mesure de gestion, statut (rupture confirmée / risque)
- **Niveau géographique** : national
- **Qualité** : 6/10 (source officielle mais agrégée, pas de granularité produit exportable ici)
- **Facilité d'intégration** : 3/10 (pas d'API, données affichées en dataviz, nécessite scraping)
- **Potentiel business** : 8/10

Intérêt : seule source officielle donnant les *causes déclarées* des ruptures (capacité de production, hausse de la demande, rupture matière première) — ce sont des features prédictives directes. À croiser avec les ventes officine (Open Medic) pour transformer "cause déclarée" en signal précoce par classe ATC.

---

## 2. ANSM — Liste des médicaments en rupture ou risque de rupture (fichiers annuels)

- **Nom** : Médicaments ayant fait l'objet d'un signalement de rupture ou de risque de rupture de stock
- **URL** : https://ansm.sante.fr/page/medicaments-ayant-fait-lobjet-dun-signalement-de-rupture-ou-de-risque-de-rupture-de-stock
- **Organisme** : ANSM
- **Licence** : Open Licence 2.0 (mention générale ANSM)
- **Description** : Fichiers Excel téléchargeables listant, année par année, tous les médicaments ayant fait l'objet d'un signalement de rupture/risque de rupture. Années disponibles : 2025, 2024, 2021-2022-2023 (fichier combiné), 2020, 2019. Un même médicament peut apparaître plusieurs fois dans l'année (plusieurs signalements).
- **Type de données** : liste nominative de spécialités
- **Format** : Excel (.xlsx)
- **API dispo** : Non
- **Mise à jour** : irrégulière — dernières mises à jour avril 2026 (années 2024-2025) et octobre 2025 (2021-2023)
- **Historique** : 2019 à 2025 (fichiers distincts, pas de série continue unique)
- **Nb de lignes** : quelques centaines à ~1 000+ lignes par fichier annuel
- **Variables principales** : nom de spécialité (colonnes précises non documentées publiquement sur la page, mais généralement : nom, DCI, laboratoire, date de signalement selon les versions précédentes des fichiers ANSM)
- **Niveau géographique** : national
- **Qualité** : 7/10
- **Facilité d'intégration** : 6/10 (fichier statique à parser, pas d'API, mais structure exploitable directement)
- **Potentiel business** : 8/10

C'est la matière première la plus directement exploitable pour construire un **historique labellisé** (molécule → a été en rupture / année) permettant d'entraîner un modèle de prédiction par DCI/classe ATC en croisant avec la saisonnalité.

---

## 3. ANSM — Disponibilités des produits de santé (tableau temps réel, exportable)

- **Nom** : Disponibilités des produits de santé — Médicaments
- **URL** : https://ansm.sante.fr/disponibilites-des-produits-de-sante/medicaments (variante dispositifs médicaux : .../dispositifs-medicaux)
- **Organisme** : ANSM
- **Licence** : Open Licence 2.0
- **Description** : Tableau consultable en ligne, temps réel, des MITM actuellement en rupture, tension d'approvisionnement, ou récemment remis à disposition (~350-400 produits actuellement listés). Recherche par mot-clé (min. 3 caractères), export **Excel** disponible via bouton "Exporter".
- **Type de données** : instantané (snapshot) — PAS d'historique, écrase l'état précédent
- **Format** : tableau web + export Excel
- **API dispo** : Non identifiée publiquement
- **Mise à jour** : quotidienne/continue (dès qu'un laboratoire déclare/lève une rupture)
- **Historique** : **aucun** — seul l'état courant est visible (c'est LE point faible majeur signalé par toute la littérature : il faut scraper quotidiennement pour se constituer un historique)
- **Nb de lignes** : ~350-400 lignes en continu
- **Variables principales** : Statut (rupture / tension / remise à disposition), date de mise à jour, spécialité (dénomination + composition), date estimée de remise à disposition, domaines médicaux
- **Niveau géographique** : national
- **Qualité** : 7/10 (fiable, officiel) mais **pas d'historique natif** = -3
- **Facilité d'intégration** : 5/10 (export manuel, pas d'API — nécessite un scraper/cron quotidien pour bâtir une série temporelle)
- **Potentiel business** : 9/10

**C'est la source la plus stratégique pour un moteur de prédiction**, car c'est le flux "vivant". Il faut absolument bâtir un scraper quotidien (aucun archiveur public identifié ne le fait actuellement, cf. point 9) : sans historisation continue, impossible de calculer durée de rupture, récidive, saisonnalité par molécule.

---

## 4. ANSM — Trustmed (plateforme de déclaration réglementaire)

- **Nom** : Trustmed (plateforme e-déclaration ANSM)
- **URL** : https://ansm.sante.fr/vos-demarches/industriel/declarer-une-rupture-de-stock-mitm
- **Organisme** : ANSM
- **Licence** : N/A (outil réglementaire, pas un jeu de données public en tant que tel)
- **Description** : Plateforme sur laquelle les laboratoires titulaires d'AMM sont légalement tenus de déclarer toute rupture/risque de rupture pour les MITM (obligation issue du Code de la santé publique, art. R. 5124-49-1 et s.). C'est la **source primaire** qui alimente ensuite data.ansm et les listes publiques.
- **Type de données** : déclarations réglementaires individuelles (non publiques en tant que microdonnées brutes)
- **Format** : N/A (accès industriel uniquement)
- **API dispo** : Non pour le public (usage interne ANSM)
- **Mise à jour** : temps réel côté déclarant
- **Historique** : depuis 2012 (base de notification), mais **non accessible au public en microdonnées** — seuls des agrégats (points 1-3) sont publiés
- **Nb de lignes** : ~3 800 déclarations/an (2024)
- **Variables principales** : identité du produit, motif, mesures de gestion (contingentement, import), dates
- **Niveau géographique** : national
- **Qualité** : 9/10 (donnée source)
- **Facilité d'intégration** : 1/10 (non accessible publiquement)
- **Potentiel business** : 6/10 (utile à connaître comme "vérité terrain" même sans accès direct — permet de comprendre la fraîcheur/latence des autres sources qui en dérivent)

À mentionner pour la roadmap : si un partenariat data était un jour possible avec ANSM/HDH (hors périmètre "gratuit pur"), ce serait la source en clair la plus riche. Pour l'instant : gratuit uniquement via ses dérivés agrégés (points 1-3).

---

## 5. ANSM — Liste des Médicaments d'Intérêt Thérapeutique Majeur (MITM)

- **Nom** : Liste des médicaments d'intérêt thérapeutique majeur (MITM)
- **URL** : https://ansm.sante.fr/documents/reference/medicaments-dinteret-therapeutique-majeur-mitm (actualité de publication : https://ansm.sante.fr/actualites/nous-publions-la-liste-des-medicaments-dinteret-therapeutique-majeur-mitm)
- **Organisme** : ANSM
- **Licence** : Open Licence 2.0
- **Description** : Liste officielle de 8 107 médicaments qualifiés MITM par les laboratoires (obligation légale depuis 2024), première publication décembre 2024, mise à jour 13 mars 2026. Les MITM sont soumis à une obligation de **stock de sécurité de 2 mois** — variable prédictive clé (un médicament MITM avec obligation de stock renforcée a un profil de risque de rupture différent d'un non-MITM).
- **Type de données** : référentiel de spécialités qualifiées
- **Format** : document/tableau (Excel probable, à confirmer au téléchargement)
- **API dispo** : non identifiée
- **Mise à jour** : régulière (dernière : mars 2026), en fonction des nouvelles commercialisations/retraits
- **Historique** : première liste = décembre 2024, pas d'historique antérieur (nouveauté réglementaire issue de la loi de 2023)
- **Nb de lignes** : 8 107 spécialités
- **Variables principales** : nom de spécialité, statut MITM, éventuellement classe thérapeutique
- **Niveau géographique** : national
- **Qualité** : 8/10
- **Facilité d'intégration** : 7/10
- **Potentiel business** : 9/10 (feature booléenne "MITM = oui/non" + "stock de sécurité obligatoire" est un prédicteur direct de criticité)

Croisement clé : MITM × classe ATC × historique de rupture = score de criticité produit. Une IA copilote peut alerter le pharmacien "ce produit MITM a un stock de sécurité réglementaire de 2 mois, tension déjà signalée 3x en 2024" pour anticiper ses commandes.

---

## 6. Base de Données Publique des Médicaments (BDPM) — référentiel + API REST

- **Nom** : Base de données publique des médicaments (base officielle)
- **URL** : https://base-donnees-publique.medicaments.gouv.fr/ | jeu data.gouv.fr : https://www.data.gouv.fr/datasets/base-de-donnees-publique-des-medicaments-base-officielle | réutilisation API REST : https://www.data.gouv.fr/reuses/api-rest-base-de-donnees-publique-des-medicaments
- **Organisme** : ANSM (avec CEPS, UNCAM, HAS)
- **Licence** : Licence Ouverte 2.0
- **Description** : Référentiel exhaustif de toutes les spécialités pharmaceutiques françaises (CIS), leurs présentations, compositions, substances actives, avis SMR/ASMR, groupes génériques, indications de disponibilité.
- **Type de données** : référentiel produit
- **Format** : fichiers plats téléchargeables (.txt délimité) + une **API REST tierce** existe en réutilisation communautaire (non officielle ANSM mais référencée sur data.gouv.fr)
- **API dispo** : Oui (via réutilisation tierce documentée sur data.gouv.fr ; pas d'API officielle native de l'ANSM elle-même pour la BDPM)
- **Mise à jour** : quotidienne à hebdomadaire
- **Historique** : snapshot courant, pas de versionning historique natif (nécessite de dater ses propres extractions)
- **Nb de lignes** : ~15 000-20 000 CIS, ~40 000+ présentations
- **Variables principales** : code CIS/CIP, dénomination, DCI, forme, dosage, laboratoire exploitant, statut de commercialisation, SMR/ASMR, groupe générique
- **Niveau géographique** : national
- **Qualité** : 9/10
- **Facilité d'intégration** : 9/10
- **Potentiel business** : 9/10

C'est le **référentiel pivot** indispensable pour relier n'importe quelle donnée de rupture (nom de spécialité en texte libre) à un code CIS/CIP stable, condition sine qua non pour tout croisement avec Open Medic, GERS-like, ou les ventes officine.

---

## 7. RappelConso (V2) — rappels produits grand public (**hors médicaments**)

- **Nom** : RappelConso
- **URL** : https://rappel.conso.gouv.fr/ | data.gouv.fr : https://www.data.gouv.fr/datasets/rappelconso-v2 | doc open data : https://rappel.conso.gouv.fr/support/open-data | API catalogue api.gouv.fr : https://api.gouv.fr/les-api/api-rappel-conso
- **Organisme** : DGCCRF, DGAL, DGEC, DGPR (interministériel)
- **Licence** : Licence Ouverte / Open Licence 2.0
- **Description** : Rappels de produits de consommation dangereux/défectueux (alimentaire, jouets, cosmétiques, bricolage, etc.). **⚠️ Point important vérifié : les rappels de médicaments et dispositifs médicaux sont explicitement EXCLUS du périmètre RappelConso — ils continuent d'être publiés uniquement par l'ANSM** (cf. point 8).
- **Type de données** : fiches de rappel produit
- **Format** : CSV (22,8 Mo) et JSON (42,1 Mo)
- **API dispo** : Oui — mise à jour horaire, référencée sur data.economie.gouv.fr et data.gouv.fr
- **Mise à jour** : horaire
- **Historique** : depuis le lancement (2021) à aujourd'hui, mise à jour continue
- **Nb de lignes** : dizaines de milliers de fiches cumulées (tous secteurs)
- **Variables principales** : nom produit, marque, n° de lot, distributeur, zone géographique, risque encouru, conduite à tenir, date de publication
- **Niveau géographique** : national, avec zone de distribution
- **Qualité** : 8/10 (excellente pour son périmètre, mais **hors sujet médicament**)
- **Facilité d'intégration** : 9/10
- **Potentiel business** : 3/10 pour le volet strictement "médicament pharmacie", **mais 7/10** si on élargit à la parapharmacie/cosmétique/DM grand public vendus en officine (produits d'hygiène, compléments alimentaires, dispositifs médicaux grand public type autotests, tire-lait, etc. — souvent RappelConso couvre bien ces catégories-là même si les vrais "médicaments" en sont exclus).

À bien noter dans le pipeline : ne pas confondre avec les rappels de lots médicaments (ANSM). RappelConso reste utile pour la partie parapharmacie du rayon officine.

---

## 8. ANSM — Informations de sécurité (rappels de lots médicaments, DM, alertes qualité)

- **Nom** : Informations de sécurité — ANSM (portail des rappels/alertes produits de santé)
- **URL** : https://ansm.sante.fr/informations-de-securite/ | flux RSS configurables : https://ansm.sante.fr/page/flux-rss (ex. https://ansm.sante.fr/rss/informations_securite)
- **Organisme** : ANSM
- **Licence** : Open Licence 2.0
- **Description** : Base consultable de toutes les alertes de sécurité produits de santé : "Défaut qualité", "Information aux utilisateurs", "Rappel de produit", "Risques médicamenteux". Filtres par type de produit (médicaments, DM, vaccins, cosmétiques), par date (semaine/mois/6 mois/1 an). Pagination visible jusqu'à ~388 pages ⇒ **milliers d'alertes historisées**.
- **Type de données** : alertes/rappels individuels
- **Format** : liste web + export ("Exporter", format exact non confirmé — probablement PDF/Excel par fiche) + **flux RSS** confirmé et personnalisable par domaine médical
- **API dispo** : Pas d'API REST structurée identifiée, mais **flux RSS exploitable en continu** (équivalent fonctionnel simple à parser)
- **Mise à jour** : continue, au fil des publications d'alertes
- **Historique** : plusieurs années, accessible via filtres et pagination profonde (~388 pages)
- **Nb de lignes** : plusieurs milliers d'alertes cumulées
- **Variables principales** : nom produit/fabricant, type d'alerte, date de publication, numéro de référence, destinataires ; le numéro de lot précis n'apparaît pas toujours en synthèse (souvent dans le corps du communiqué)
- **Niveau géographique** : national
- **Qualité** : 8/10
- **Facilité d'intégration** : 6/10 (RSS exploitable facilement pour le flux temps réel ; l'historique profond nécessite un scraping paginé)
- **Potentiel business** : 8/10

C'est **la vraie source des "rappels de lots"** demandés dans le brief (RappelConso ne les couvre pas). Le flux RSS permet une ingestion quasi temps réel très simple côté IA (déclenchement d'alerte pharmacien dès publication). Croisement : un rappel de lot récent sur une DCI est un signal précurseur de tension d'approvisionnement à court terme (retrait de lots = réduction d'offre disponible).

---

## 9. Absence confirmée d'archive publique historisée (GitHub/Kaggle/Zenodo)

Recherche ciblée effectuée (GitHub, Kaggle, Zenodo) : **aucun dépôt public actif identifié** qui archive quotidiennement l'état du tableau "Disponibilités des produits de santé" de l'ANSM (le point 3 n'ayant pas d'historique natif, cela représente un vrai angle mort de l'open data français actuel). Aucun repo GitHub "ansm-scraper" ou dataset Kaggle/Zenodo dédié aux ruptures françaises n'a été trouvé lors de cette recherche.

- **Conséquence stratégique / opportunité pour le projet** : construire soi-même ce scraper quotidien de https://ansm.sante.fr/disponibilites-des-produits-de-sante/medicaments serait un **actif propriétaire différenciant** (avantage compétitif réel face à IQVIA/OpenHealth qui achètent des données GERS — ici on peut se constituer un historique unique, gratuit, à partir du jour où le scraper tourne).
- **Potentiel business** : 10/10 si construit en interne — c'est probablement LA feature technique la plus rentable à développer en premier pour ce Data Lake.

---

## 10. Étude scientifique — 10 ans de gestion des pénuries par l'ANSM (PMC, en accès libre)

- **Nom** : Prevention and management of health products shortages by the French national agency (ANSM), 10 years of experience
- **URL** : https://pmc.ncbi.nlm.nih.gov/articles/PMC10690943/
- **Organisme** : publication académique (PMC/NIH, libre accès)
- **Licence** : accès libre (article scientifique, citer la source)
- **Description** : Analyse rétrospective des signalements ANSM. Signalements passés de 404 (2013) à 3 761 (2022). ~50% concentrés sur 3 classes ATC : système nerveux/cardiovasculaire + anti-infectieux. Causes 2022 : capacité de production insuffisante (27,1%), hausse du volume des ventes (21,5%), rupture d'approvisionnement matières premières/emballage (13,6%). Pour les DM : défaut d'approvisionnement (48,2%), arrêt commercial (14,9%), hausse des ventes (13,2%), raisons réglementaires (9,6%).
- **Type de données** : statistiques agrégées + analyse de tendance (issues de la base Trustmed 2012-2022)
- **Format** : article PDF/HTML
- **API dispo** : Non (c'est un article, pas un jeu de données)
- **Mise à jour** : ponctuelle (publication figée)
- **Historique** : 2013-2022, la série la plus longue et la mieux documentée trouvée sur le sujet
- **Nb de lignes** : n/a (agrégats annuels)
- **Variables principales** : nb signalements/an, répartition par cause, répartition par classe ATC
- **Niveau géographique** : national
- **Qualité** : 9/10 (peer-reviewed)
- **Facilité d'intégration** : 5/10 (données à ressaisir manuellement depuis les tableaux/graphiques de l'article, pas de fichier brut)
- **Potentiel business** : 7/10

Excellente source pour calibrer/valider un modèle prédictif (taux de base historique par classe ATC et par cause), à défaut de microdonnées brutes.

---

## 11. DREES — Étude "Tensions et ruptures de stock de médicaments" (mars 2025)

- **Nom** : Tensions et ruptures de stock de médicaments déclarées par les industriels : quelle ampleur, quelles conséquences sur les ventes aux officines
- **URL** : https://drees.solidarites-sante.gouv.fr/publications-communique-de-presse/etudes-et-resultats/250327_ER_ruptures-de-stock-medicaments-declarees-par-les-industriels-ampleur-et-consequences (PDF direct : https://www.drees.solidarites-sante.gouv.fr/sites/default/files/2025-03/ER%201335%20Rupture%20de%20stock%20de%20m%C3%A9dicaments_MEL.pdf)
- **Organisme** : DREES (ministère de la Santé), en collaboration avec ANSM
- **Licence** : publication publique DREES (réutilisation libre, mentionner la source)
- **Description** : Étude "Études et Résultats" n°1335. Chiffres clés : ~400 présentations en rupture fin 2024 (contre un pic à ~800 hiver 2022-2023). 3 classes = 50-60% des ruptures (cardiovasculaire, système nerveux dont paracétamol, anti-infectieux/antibiotiques). Estime aussi **l'impact des ruptures sur les volumes de ventes aux officines**.
- **Type de données** : étude statistique + tableaux de données sous-jacents (souvent DREES publie les fichiers de données associés aux Études et Résultats sur data.drees)
- **Format** : PDF (+ possible fichier de données associé sur data.drees, à vérifier séparément)
- **API dispo** : Non identifiée directement
- **Mise à jour** : ponctuelle, mais DREES publie ce type d'étude à intervalles réguliers (annuel/biennal)
- **Historique** : rétrospective 2021-2024
- **Nb de lignes** : agrégats
- **Variables principales** : nb présentations en rupture par période, impact sur ventes en volume par classe thérapeutique
- **Niveau géographique** : national
- **Qualité** : 9/10 (source officielle statistique publique, méthodologie rigoureuse)
- **Facilité d'intégration** : 5/10 (PDF à dépouiller, vérifier existence de fichier de données brutes sur data.drees.solidarites-sante.gouv.fr)
- **Potentiel business** : 8/10

C'est la source qui **quantifie directement le lien rupture → perte de ventes en officine** : exploitable pour construire un indicateur de "manque à gagner estimé" par classe thérapeutique, argument business fort pour le pitch pharmacien.

---

## 12. EMA — European Shortages Monitoring Platform (ESMP) + catalogue des pénuries

- **Nom** : European Shortages Monitoring Platform (ESMP) & EMA shortages catalogue
- **URL** : portail public https://esmp.ema.europa.eu/ | présentation https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/medicine-shortages-availability-issues/european-shortages-monitoring-platform-esmp | doc API (accès restreint MAH/NCA) : https://www.ema.europa.eu/en/documents/other/european-shortages-monitoring-platform-esmp-api-instructions-request-access-national-competent-authorities-ncas-marketing-authorisation-holders-mahs_en.pdf
- **Organisme** : EMA (Agence européenne des médicaments)
- **Licence** : réutilisation EMA standard (contenus publics UE, citer la source)
- **Description** : Plateforme européenne consolidant les pénuries de médicaments à autorisation centralisée (CAP) + liens vers les registres nationaux de pénuries (dont potentiellement l'ANSM France). Catalogue public "pénuries en cours" et "pénuries résolues".
- **Type de données** : catalogue de pénuries par substance/produit
- **Format** : consultation web ; **API existe mais réservée** aux National Competent Authorities (NCA) et Marketing Authorisation Holders (MAH) authentifiés — **pas d'accès public ouvert à l'API**, spécifications JSON/YAML publiées mais l'accès aux données nécessite un compte autorisé
- **API dispo** : Oui pour les acteurs autorisés (NCA/MAH), **Non pour le grand public/tiers**
- **Mise à jour** : continue par les MAH
- **Historique** : plateforme récente (pleinement opérationnelle depuis 2025), profondeur historique encore limitée
- **Nb de lignes** : n/a (catalogue vivant, ordre de grandeur : centaines de substances à autorisation centralisée)
- **Variables principales** : substance active, statut de pénurie, dates, pays concernés
- **Niveau géographique** : Union européenne / EEE
- **Qualité** : 7/10 (source institutionnelle fiable, mais accès grand public limité au catalogue web, pas aux données brutes)
- **Facilité d'intégration** : 3/10 (pas d'API ouverte pour un tiers non-NCA/non-MAH — scraping web nécessaire pour le catalogue public en lecture seule)
- **Potentiel business** : 6/10

Utile en complément pour détecter les tensions **paneuropéennes précoces** (une pénurie déclarée en Allemagne/Espagne avant la France est un signal avant-coureur pour la France, vu les chaînes d'approvisionnement partagées) — mais l'intégration technique directe est limitée sans accès autorisé.

---

## 13. EMA/HMA/Commission — Union list of critical medicines

- **Nom** : Union list of critical medicines
- **URL** : https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/medicine-shortages-availability-issues/availability-medicines-during-crises/union-list-critical-medicines
- **Organisme** : Commission européenne, HMA (Heads of Medicines Agencies), EMA
- **Licence** : document public UE
- **Description** : Liste de +200 substances actives jugées critiques pour la continuité des soins en UE (1ère version décembre 2023, issue d'un pool de 600 substances des listes nationales), mise à jour le 16 décembre 2024. Critère de criticité = gravité de la pathologie ciblée × disponibilité d'alternatives thérapeutiques. **Attention** : être sur la liste ne signifie pas "à risque imminent de pénurie" mais "pénurie = impact grave si elle survient".
- **Type de données** : référentiel de substances critiques
- **Format** : document PDF/liste publiée
- **API dispo** : Non
- **Mise à jour** : annuelle
- **Historique** : depuis décembre 2023
- **Nb de lignes** : ~200-250 substances actives
- **Variables principales** : substance active, indication de criticité
- **Niveau géographique** : Union européenne
- **Qualité** : 8/10
- **Facilité d'intégration** : 7/10
- **Potentiel business** : 7/10

Feature booléenne complémentaire au MITM français ("substance sur liste critique UE") pour pondérer le score de criticité d'une molécule dans le modèle prédictif — signal de vulnérabilité structurelle de la chaîne d'approvisionnement, indépendant du signalement conjoncturel.

---

## 14. Ordre National des Pharmaciens (CNOP) — DP-Ruptures

- **Nom** : DP-Ruptures (Dossier Pharmaceutique — module ruptures)
- **URL** : https://www.ordre.pharmacien.fr/les-communications/focus-sur/les-actualites/le-dp-ruptures-un-outil-fondamental-pour-ameliorer-la-gestion-des-ruptures-d-approvisionnement-des-medicaments | analyse : https://www.ordre.pharmacien.fr/mediatheque/fichiers/les-autres-publications/reprise-ancien-site/analyse-et-reflexions-de-l-ordre-national-des-pharmaciens-ruptures-d-approvisionnement
- **Organisme** : Ordre National des Pharmaciens (CNOP)
- **Licence** : outil professionnel, **accès restreint aux pharmaciens/PUI inscrits**, pas open data
- **Description** : Outil d'échange d'information entre fabricants, grossistes-répartiteurs et pharmaciens dispensateurs sur la disponibilité des spécialités. Connecte 99% des officines aux fabricants représentant 84%+ des médicaments. ~1 000 PUI hospitalières abonnées peuvent consulter un moteur de recherche même sans avoir déclaré elles-mêmes une rupture.
- **Type de données** : disponibilité produit en temps réel, déclarations croisées officine/labo
- **Format** : plateforme propriétaire (Dossier Pharmaceutique)
- **API dispo** : Non public (réservé aux professionnels via le DP)
- **Mise à jour** : temps réel
- **Historique** : non documenté publiquement
- **Nb de lignes** : n/a
- **Variables principales** : disponibilité produit par officine/grossiste
- **Niveau géographique** : national, granularité officine
- **Qualité** : 8/10 (donnée terrain très fraîche)
- **Facilité d'intégration** : 1/10 (**non accessible en gratuit/ouvert à un tiers** — réservé aux pharmaciens/PUI via leur propre compte DP)
- **Potentiel business** : 9/10 *si* l'utilisateur final pharmacien peut lui-même se connecter et que l'app copilote whitelabel ce flux via le compte du pharmacien (à étudier juridiquement — ce n'est pas de l'open data réutilisable pour un tiers, mais un pharmacien peut consulter SES propres données)

Point important pour le projet JARVIS : le pharmacien client de l'app a probablement déjà accès à DP-Ruptures via son identifiant professionnel. Cela ouvre une piste (hors open data pur) d'intégration "avec le compte du pharmacien" plutôt que comme source data-lake générique.

---

## 15. Filière OSCAR — Pénuries et substitutions

- **Nom** : OSCAR — Ruptures médicamenteuses et substitutions
- **URL** : https://www.filiere-oscar.fr/23578-ruptures-medicamenteuses-substitutions.htm
- **Organisme** : Filière OSCAR (association professionnelle officine)
- **Licence** : non précisée, contenu éditorial professionnel
- **Description** : Page de ressources/actualités et outils d'aide à la substitution en cas de rupture, à destination des pharmaciens. Plutôt un agrégateur/vulgarisateur qu'une base de données brute.
- **Type de données** : contenu éditorial + liens vers ressources officielles
- **Format** : page web
- **API dispo** : Non
- **Mise à jour** : selon actualité
- **Historique** : n/a
- **Nb de lignes** : n/a
- **Variables principales** : n/a
- **Niveau géographique** : national
- **Qualité** : 5/10
- **Facilité d'intégration** : 2/10
- **Potentiel business** : 3/10

Intérêt secondaire : identifier les logiques métier de "substitution en cas de rupture" à intégrer comme règles métier dans le copilote (pas une source de données à proprement parler).

---

## Synthèse — Variables prédictives disponibles pour anticiper une rupture

D'après l'ensemble des sources vérifiées, voici les **features publiquement exploitables** pour un modèle prédictif à horizon de plusieurs semaines :

| Variable | Source | Nature |
|---|---|---|
| Historique de rupture par DCI/spécialité (2019-2025) | ANSM listes annuelles (#2) + ANSM disponibilités (#3, scrapé) | Série temporelle labellisée |
| Statut MITM + obligation stock de sécurité 2 mois | ANSM MITM (#5) | Feature booléenne de criticité réglementaire |
| Classe ATC / classe thérapeutique | BDPM (#6) croisé avec études ANSM/DREES (#10, #11) | Taux de base de risque par classe (cardio, SNC, anti-infectieux = 50-60% du risque) |
| Cause déclarée de rupture (capacité prod., hausse demande, rupture matière première) | data.ansm (#1), étude PMC (#10) | Feature catégorielle de cause |
| Rappel de lot récent sur la DCI | ANSM Informations de sécurité (#8, flux RSS) | Signal précurseur (retrait = réduction d'offre) |
| Statut "critique" au niveau UE | Union list of critical medicines (#13) | Feature de vulnérabilité structurelle de la chaîne |
| Tension déclarée dans un autre pays UE | ESMP (#12, accès limité) | Signal avant-coureur transfrontalier |
| Saisonnalité | à construire (croisement avec Sentinelles/SOS Médecins pour anti-infectieux/grippe — hors périmètre Agent 1) | Feature temporelle |
| Impact estimé sur ventes officine | DREES (#11) | Variable de calibration/validation du modèle |

**Le chaînon manquant le plus critique** : il n'existe **aucun historique quotidien public de l'état des ruptures** (le tableau ANSM #3 n'est qu'un instantané, sans archive). Construire ce scraper quotidien soi-même (point 9) est l'action technique la plus rentable pour transformer ces sources statiques en un vrai flux d'entraînement de modèle prédictif.

---

## Notes méthodologiques

- Toutes les sources ci-dessus sont **gratuites**. Aucune source payante equivalente n'a été identifiée comme nécessaire dans ce périmètre (contrairement à IQVIA/GERS qui vendent des données de ventes officine, le périmètre "ruptures/rappels" est déjà largement public en France/UE).
- Deux angles morts confirmés : (1) pas d'API publique ouverte pour data.ansm ni pour l'ESMP côté tiers non autorisé ; (2) pas d'historisation quotidienne publique du tableau de disponibilité ANSM — à combler par du scraping propriétaire.
- Fichiers PDF DREES/RappelConso non totalement dépouillés en texte brut par l'outil de fetch (limitation technique de l'outil, pas de la source) — recommandé de les télécharger et parser directement pour extraire les tableaux de données chiffrées complets.

Chemins de travail suggérés : `/private/tmp/claude-501/-Users-williammorel/d330fed3-43d2-440f-b96c-47798e656912/scratchpad/` (aucun fichier n'a été écrit sur disque dans cette recherche — tout est restitué directement ci-dessus).

---

# AGENT 5 — SAISONNALITÉ PHARMACIE : Base "par mois" pour piloter les commandes

## 1. Sources trouvées (gratuit/payant précisé)

### 1.1 Medic'AM — médicaments délivrés en ville par classe ATC
**Nom** : Medic'AM | **URL** : https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-classe-atc-medicam | **Organisme** : CNAM / Assurance Maladie | **Licence** : gratuit, réutilisation encadrée par les CGU Ameli (proche Licence Ouverte, non explicitée sur la page) | **Description** : montants remboursés, base de remboursement et nombre de boîtes délivrées en pharmacie de ville, par classe ATC (1 à 5) et par code CIP13, pour tous régimes | **Type de données** : remboursements médicaments | **Format** : fichiers ZIP (tableurs) | **API** : non documentée | **Mise à jour** : **mensuelle** (diffusion semestrielle + cumul annuel) | **Historique** : janvier 2012 → février 2026 (13+ ans) | **Nb de lignes** : ordre de grandeur dizaines de milliers de lignes/mois (croisement ATC5 × CIP13 × taux remboursement) | **Variables principales** : ATC1-5, CIP13, taux de remboursement, base remboursement, montant remboursé, nb de boîtes | **Niveau géographique** : national uniquement | **Qualité** : 9/10 | **Facilité d'intégration** : 6/10 (ZIP/tableurs à parser, pas d'API) | **Potentiel business** : 10/10.
→ **C'est la pierre angulaire de l'agent saisonnalité** : seule base publique qui donne une vraie courbe **mensuelle** et **nationale** de la consommation officinale par classe ATC depuis 2012. Permet de calculer, pour chaque classe (ex. R06A antihistaminiques, J01 antibiotiques, A11 vitamines), l'indice de saisonnalité mois par mois (moyenne mobile 12 mois vs valeur du mois). Se croise avec Sentinelles (grippe/gastro) et pollens (allergie) pour expliquer les pics.

### 1.2 Open Medic — base complète dépenses médicaments (démographie/région)
**Nom** : Open Medic | **URL** : https://www.data.gouv.fr/datasets/open-medic-base-complete-sur-les-depenses-de-medicaments-interregimes | **Organisme** : CNAM (SNDS) | **Licence** : **Licence Ouverte / Open Licence 2.0** | **Description** : dépenses de médicaments (montants remboursés/remboursables, nb de boîtes) ventilées par âge, sexe, région du bénéficiaire, et spécialité du prescripteur | **Format** : CSV + documentation XLSX (77 ressources) | **API** : oui, via API data.gouv.fr (16 réutilisations/API référencées) | **Mise à jour** : **annuelle** (pas mensuelle) | **Historique** : 2014 → 2024 (2025 en cours de correction, anomalies signalées) | **Nb de lignes** : plusieurs millions de lignes cumulées (croisement ATC × âge × sexe × région) | **Variables principales** : ATC, CIP13, âge, sexe, région, montants, nb boîtes | **Niveau géographique** : national + régional | **Qualité** : 8/10 | **Facilité d'intégration** : 7/10 | **Potentiel business** : 8/10.
→ Complète Medic'AM en ajoutant la dimension démographique/régionale, utile pour affiner "quel profil de patient consomme quoi" — mais **pas exploitable pour la saisonnalité mensuelle** (granularité annuelle seulement) : à réserver pour du profilage régional/âge, pas pour le calendrier mensuel.

### 1.3 Estimation d'incidence des syndromes grippaux (réseau Sentinelles)
**Nom** : Estimation d'incidence des syndromes grippaux | **URL** : https://www.data.gouv.fr/datasets/estimation-dincidence-des-syndromes-grippaux (+ API native : https://www.sentiweb.fr/?page=api, endpoint REST `https://www.sentiweb.fr/api/data/rest/getIncidence`, aussi OData sur https://odata.sentiweb.fr/) | **Organisme** : Réseau Sentinelles (Inserm/Sorbonne Université) | **Licence** : ouverte, gratuite | **Description** : incidence hebdomadaire estimée des syndromes grippaux, définis depuis 1984 (fièvre >39°C brutale + myalgies + signes respiratoires), à partir des médecins généralistes du réseau | **Format** : XML, JSON, CSV | **API** : **oui** — GET `/getIncidence` (paramètres indicateur, zone géo, période) | **Mise à jour** : **hebdomadaire** | **Historique** : depuis 1984 | **Nb de lignes** : ~2 000+ points hebdo cumulés/indicateur | **Variables principales** : incidence, taux d'incidence, zone (13 régions + national) | **Niveau géographique** : national + 13 régions | **Qualité** : 9/10 | **Facilité d'intégration** : 9/10 (vraie API REST) | **Potentiel business** : 9/10.
→ Le réseau Sentinelles suit aussi via la même API : **IRA/infections respiratoires aiguës** (grippe, COVID, VRS, rhinovirus), **diarrhée aiguë** (gastro-entérite), **varicelle**, oreillons, zona, Lyme, coqueluche. C'est la meilleure source gratuite et **hebdomadaire** (donc agrégeable au mois) pour caler les pics épidémiques et donc les pics de vente d'antipyrétiques, antitussifs, solutions de réhydratation orale, pastilles pour la gorge, anti-diarrhéiques.

### 1.4 Bulletins SURSAUD® (SOS Médecins, OSCOUR, mortalité)
**Nom** : SURSAUD® | **URL** : https://www.santepubliquefrance.fr/surveillance-syndromique-sursaudr/bulletins-sursaudr-sos-medecins-oscour-mortalite (données réutilisables via Odissé : https://odisse.santepubliquefrance.fr/) | **Organisme** : Santé publique France | **Licence** : ouverte (Odissé, API disponible) | **Description** : passages aux urgences (réseau OSCOUR®, ~700 structures, 95% des passages nationaux) et actes SOS Médecins (95% de l'activité), par pathologie (bronchiolite, grippe, gastro-entérite, COVID, canicule) | **Format** : bulletins PDF + données Odissé (CSV/API) | **API** : oui via Odissé | **Mise à jour** : **hebdomadaire** | **Historique** : variable selon indicateur (COVID depuis 2020, autres plus anciens) | **Nb de lignes** : hebdomadaire × 16 cellules régionales × pathologies | **Variables principales** : passages urgences, actes SOS Médecins, tranche d'âge (<2 ans, 75+), pathologie | **Niveau géographique** : national + régional (16 cellules) | **Qualité** : 8/10 | **Facilité d'intégration** : 7/10 | **Potentiel business** : 8/10.
→ Complémentaire de Sentinelles : SOS Médecins/OSCOUR captent mieux les **passages pédiatriques bronchiolite** (nourrissons <2 ans) et les pics de canicule (déshydratation) — utile pour anticiper solutions de réhydratation, produits bébé hiver, et produits "coup de chaleur" été.

### 1.5 Géodes / Odissé — portail indicateurs Santé publique France
**Nom** : Géodes (remplacé progressivement par Odissé) | **URL** : https://geodes.santepubliquefrance.fr/ et https://odisse.santepubliquefrance.fr/ | **Organisme** : Santé publique France | **Licence** : ouverte, réutilisable, API disponible (Odissé) | **Description** : 300 à 800+ indicateurs de santé (grippe, bronchiolite, gastro-entérite, vaccination, tabac...), cartographiés et chronologiques | **Format** : interface web + export + API | **API** : oui (Odissé) | **Mise à jour** : variable selon indicateur (hebdo à annuel) | **Historique** : variable, certains depuis les années 2000 | **Nb de lignes** : très hétérogène selon indicateur | **Variables principales** : incidence, taux, pathologie, zone, âge | **Niveau géographique** : national/régional/départemental | **Qualité** : 8/10 | **Facilité d'intégration** : 6/10 (portail à explorer, Odissé récent — décembre 2025 — encore en stabilisation) | **Potentiel business** : 7/10.
→ Portail fédérateur pratique pour retrouver en un point d'accès tous les indicateurs épidémiologiques utiles à la prévision de la demande officinale (grippe, bronchiolite, gastro, canicule) — Odissé, lancé fin 2025, vise justement à unifier l'accès programmatique (API) à ces 70 systèmes de surveillance.

### 1.6 Indice pollen ATMO (remplace le RNSA, liquidé en 2025)
**Nom** : Indice pollen / Indice pollen ATMO – historique / Indice pollen communal | **URL** : https://www.data.gouv.fr/datasets/indice-pollen ; https://www.data.gouv.fr/datasets/indice-pollen-atmo-historique ; https://www.data.gouv.fr/datasets/indice-pollen-atmo-indice-pollen-communal | **Organisme** : Atmo France (fédération des AASQA) | **Licence** : **ODbL** (Atmo Data, plateforme nationale open data) | **Description** : indice pollinique quotidien par commune avec prévision à J+3, pour 6 taxons (bouleau, graminées, ambroisie, aulne, olivier, armoise), basé sur IA + modèles météo + Copernicus | **Format** : CSV/API (Atmo Data) | **API** : **oui**, plateforme Atmo Data | **Mise à jour** : **quotidienne** (publication 13h) | **Historique** : dataset "historique" disponible, profondeur à vérifier (RNSA a fermé mars 2025, service Atmo lancé 2 avril 2025 — donc historique long réel encore limité, mais base RNSA rachetée en partie) | **Nb de lignes** : ~35 000 communes × 6 taxons × 365 jours | **Variables principales** : commune, taxon pollinique, niveau de risque (0-5), date | **Niveau géographique** : **communal** (très fin) | **Qualité** : 8/10 (nouveau système, à fiabiliser) | **Facilité d'intégration** : 8/10 (vrai open data structuré, ODbL) | **Potentiel business** : 9/10.
→ **Remplace le RNSA** (liquidé judiciairement le 26 mars 2025, faute de subventions publiques — 85% de son budget). C'est la donnée clé pour prédire, **au niveau de chaque commune/officine**, le pic d'antihistaminiques/décongestionnants/collyres allergiques selon le taxon pollinique dominant localement — un niveau de granularité qu'aucune base médicament seule ne permet.

### 1.7 Google Trends (indicatif, gratuit, non officiel)
**Nom** : Google Trends | **URL** : https://trends.google.fr/ | **Organisme** : Google | **Licence** : gratuit, CGU Google (pas de licence open data formelle) | **Description** : indice relatif de volume de recherche par mot-clé, région, période | **Format** : export CSV depuis l'interface, ou API non officielle (pytrends) | **API** : non officielle (pytrends scrape l'interface — fragile, risque de blocage) | **Mise à jour** : quasi temps réel | **Historique** : depuis 2004 | **Nb de lignes** : indice relatif (0-100), pas de volumes bruts | **Variables principales** : intérêt de recherche par mot-clé/région/semaine | **Niveau géographique** : national, régional, ville | **Qualité** : 6/10 (donnée relative, pas absolue, pas de vente réelle) | **Facilité d'intégration** : 5/10 (pas d'API stable officielle) | **Potentiel business** : 7/10.
→ Utile en **signal précoce** ("anti-poux" grimpe dès juillet, "crème solaire" dès avril, "gel hydroalcoolique" lors d'alertes) mais ne remplace pas une vraie donnée de vente — à utiliser en complément pondéré, jamais en source unique, et avec un scraper maison (pas d'API officielle garantie dans la durée).

### 1.8 Publications ANSM / EPI-PHARE / DREES (rapports, pas open data brute)
**Nom** : Plan hivernal ANSM, rapports EPI-PHARE, études DREES | **URL** : https://ansm.sante.fr/actualites/plan-hivernal-2025-2026-une-annee-marquee-par-labsence-de-tensions-sur-les-produits-de-sante-suivis ; https://www.epi-phare.fr/ ; https://drees.solidarites-sante.gouv.fr/publications/etudes-et-resultats/la-consommation-de-medicaments-non-prescrits | **Organisme** : ANSM, EPI-PHARE (ANSM+CNAM), DREES | **Licence** : gratuit, publications publiques (pas toujours de données brutes attachées) | **Description** : ANSM suit 14 "molécules sentinelles" (amoxicilline, amoxicilline/ac. clavulanique, azithromycine, clarithromycine, paracétamol, prednisolone, fluticasone, salbutamol) avec point mensuel sur les tensions d'approvisionnement hivernales | **Format** : PDF/HTML | **API** : non | **Mise à jour** : rapports ponctuels (saisonniers, "point hivernal") | **Historique** : plan hivernal reconduit chaque année depuis plusieurs saisons | **Nb de lignes** : n/a (rapports qualitatifs + graphiques) | **Variables principales** : molécule, tension oui/non, ventes vs années précédentes | **Niveau géographique** : national | **Qualité** : 7/10 | **Facilité d'intégration** : 4/10 (texte à parser manuellement, pas de dataset) | **Potentiel business** : 6/10.
→ Confirme et calibre les pics observés dans Medic'AM : ventes d'amoxicilline/ac. clavulanique en hausse dès **septembre** deux saisons de suite, pic d'infections respiratoires aiguës en semaine 53 (fin décembre) en 2025.

### 1.9 Presse professionnelle pharma (Le Moniteur des Pharmacies, Revue Pharma) — chiffres de marché
**Nom** : Le Moniteur des Pharmacies / Revue Pharma — études de marché | **URL** : https://www.lemoniteurdespharmacies.fr/business/marches/les-ventes-dantirhumes-senfievrent ; https://www.lemoniteurdespharmacies.fr/business/marches/des-produits-pour-toutes-les-tetes ; https://www.revuepharma.fr/2025/05/le-marche-des-solaires-cartonne/ | **Organisme** : presse professionnelle officine (souvent basée sur panels IQVIA/GERS — donc **payant à la source**, mais chiffres redistribués gratuitement dans l'article) | **Licence** : articles gratuits en lecture, données sous-jacentes (panel IQVIA) payantes | **Description** : chiffres de marché par catégorie (anti-poux, antirhume, solaires) avec % de croissance mensuelle/saisonnière | **Format** : articles web | **API** : non | **Mise à jour** : ponctuelle (articles au fil de l'eau) | **Historique** : archives depuis ~2010 | **Nb de lignes** : n/a | **Variables principales** : % croissance CA/volume par mois, part de marché marques | **Niveau géographique** : national | **Qualité** : 7/10 (chiffres agrégés fiables mais non bruts) | **Facilité d'intégration** : 3/10 (texte libre à extraire manuellement) | **Potentiel business** : 8/10 (excellent pour calibrer/valider les seuils de saisonnalité déduits de Medic'AM).
→ Exemple concret extrait : anti-poux → **40% des ventes annuelles réalisées entre juillet et octobre** (pic rentrée scolaire) ; solaires → +66,5% en avril, +22% en mai, +43,8% en juin puis chute (-39,2% juillet, -22,4% août, -26,8% septembre, année de référence citée) ; antirhume → +18% en valeur sur l'automne-hiver, pic Fervex/Oscillococcinum en décembre.

---

## 2. Calendrier mensuel de commande — pharmacie française

Construit par croisement **Medic'AM (courbe ATC mensuelle)** × **Sentinelles/SURSAUD (épidémiologie hebdo)** × **Indice pollen ATMO (allergie communale)** × **données de marché presse pro (calibrage)**. Ce calendrier donne, mois par mois, les catégories dont la **demande officinale monte** — à utiliser comme règles de base d'un moteur de réassort saisonnier.

### JANVIER
- **Médicaments OTC** : antitussifs, antipyrétiques/antalgiques (paracétamol), sprays de gorge, décongestionnants — pic épidémique hivernal (grippe + IRA, Sentinelles/SURSAUD signalent souvent un pic autour de la semaine 52-53 selon les années, ex. dernière semaine 2025).
- **Immunité/compléments** : vitamine D, vitamine C, zinc, probiotiques "défenses immunitaires" (segment vitalité/immunité officine : 261 M€, +18,9%).
- **Phytothérapie/bien-être** : détox, minceur, arrêt tabac (thème "bonnes résolutions" classique du merchandising officinal de janvier).
- **Bébé** : solutions de lavage nasal, mouche-bébé (pic bronchiolite hivernale, passages SOS Médecins/OSCOUR nourrissons <2 ans).

### FÉVRIER
- Prolongation du pic hiver : **antibiotiques** amoxicilline/ac. clavulanique (ANSM signale des ventes élevées dès septembre qui se prolongent tout l'hiver), corticoïdes inhalés, bronchodilatateurs (salbutamol) — toujours sous surveillance du plan hivernal ANSM.
- **Gastro-entérite** : solutions de réhydratation orale, anti-diarrhéiques, antiémétiques (pic hivernal classique remonté par Sentinelles "diarrhée aiguë").
- Premiers pollens précoces (noisetier, aulne, cyprès) dans le sud → premiers antihistaminiques en région méditerranéenne.

### MARS
- **Allergie** : début de la saison pollinique majeure — **bouleau** (pic mars-avril, nord de la France) selon l'indice pollen ATMO/ex-RNSA → antihistaminiques oraux, collyres antiallergiques, sprays nasaux corticoïdes.
- Fin de saison grippale, encore antitussifs/antipyrétiques en décroissance.
- **Minceur/détox** : reprise avant l'été (préparation "opération bikini").

### AVRIL
- **Solaires** : démarrage très fort — +66,5% de croissance en valeur observée sur ce mois selon Revue Pharma/Moniteur (année de référence citée), premiers indices UV.
- **Allergie** : pic bouleau se termine, début plane/chêne selon régions.
- **Anti-moustiques** : début de la période de vente (mi-avril à mi-septembre selon Le Petit Journal de ma pharmacie), +26% de CA observé sur la saison.

### MAI
- **Allergie graminées** : pic majeur de la saison pollinique — mai-juin est décrit comme "la période la plus redoutée de l'année" pour les graminées (touche le plus de Français) → antihistaminiques, sprays, collyres au plus haut.
- **Solaires** : poursuite de la montée (+22% en mai selon données citées).
- **Jambes lourdes/circulation** : début de la demande liée aux premières chaleurs (veinotoniques, bas de contention légers) — la vasodilatation estivale aggrave les jambes lourdes.

### JUIN
- **Solaires** : pic de la période de montée (+43,8% en juin selon les données citées), avant la bascule en cœur de saison.
- **Anti-moustiques** : montée en puissance.
- **Allergie graminées** : fin du pic (juin), transition.
- **Circulation/orthopédie légère** : bas de contention "spécial été" (matières respirantes), crèmes jambes lourdes.

### JUILLET
- **Anti-poux** : début du pic saisonnier majeur — **40% des ventes annuelles se concentrent entre juillet et octobre** selon Le Moniteur des Pharmacies.
- **Solaires** : cœur de saison mais la croissance en % ralentit voire se contracte en glissement annuel une fois le stock déjà écoulé en amont (-39,2% en juillet selon les données citées, effet base).
- **Anti-moustiques/après-soleil/hydratation cutanée** : pic estival.
- Premiers pollens d'ambroisie dans le sud-est (précoce certaines années).

### AOÛT
- **Anti-poux** : poursuite du pic (avant-rentrée).
- **Ambroisie** : montée de l'allergie dans la vallée du Rhône/Sud-Est (pic annoncé pour septembre).
- **Solaires** : fin de saison (-22,4% en août selon les données citées), premières promotions de fin de stock.
- **Digestion/tourisme** : anti-diarrhéiques "turista", produits de premiers secours voyage.

### SEPTEMBRE
- **Anti-poux** : pic maximal, rentrée scolaire (fin de la fenêtre juillet-octobre).
- **Ambroisie** : pic de l'allergie dans le Sud-Est/vallée du Rhône (le plus fort de l'année localement selon indice pollen).
- **Antibiotiques amoxicilline/ac. clavulanique** : reprise des ventes dès septembre, confirmée 2 années de suite par l'ANSM (plan hivernal).
- **Immunité rentrée** : probiotiques, vitamine C, produits "reprise" (sommeil/stress rentrée scolaire — segment sommeil/stress officine : 310 M€, +7%).
- **Poux + hygiène scolaire + sommeil enfant** : thème merchandising rentrée classique.

### OCTOBRE
- **Épidémies hivernales** : démarrage officiel de la période officine "1re ligne" (octobre à mars) — grippe, bronchiolite, gastro-entérite (SPF/SURSAUD).
- **Vitamine D/immunité** : début de la remontée (moins d'exposition solaire).
- **Anti-poux** : fin du pic (fin de la fenêtre juillet-octobre).
- **Phytothérapie sommeil/stress** : changement d'heure, rentrée d'automne.

### NOVEMBRE
- **Rhume/grippe** : montée forte des antitussifs, antipyrétiques, sprays de gorge, Fervex/Oscillococcinum (progression "+18% en valeur" observée sur la période automne-hiver selon Le Moniteur).
- **Bronchiolite nourrisson** : hausse des passages SOS Médecins/OSCOUR chez les <2 ans → lavage nasal, mouche-bébé, solutions isotoniques.
- **Vitamine D/immunité** : plein régime.
- **Gastro-entérite** : début de la remontée hivernale (Sentinelles "diarrhée aiguë").

### DÉCEMBRE
- **Pic antirhume/antigrippe** : pic historique observé en décembre pour les marques leaders (Fervex, Oscillococcinum — 60% des ventes d'Oscillococcinum réalisées sur la période automne-hiver selon Le Moniteur), période de plus forte activité au comptoir avec les fêtes.
- **Antibiotiques/corticoïdes/bronchodilatateurs** : suivi renforcé plan hivernal ANSM, pic d'IRA observé certaines années en toute fin décembre (ex. semaine 53/2025).
- **Gastro-entérite** : épidémie hivernale en cours.
- **Cadeaux bien-être/parapharmacie** : coffrets, calendriers de l'Avent parapharmacie (dimension commerciale, hors épidémiologie).

---

## 3. Comment industrialiser ça dans l'IA copilote

1. **Moteur de base** : télécharger Medic'AM (mensuel, 2012→aujourd'hui) par classe ATC, calculer pour chaque classe un **indice de saisonnalité** (valeur du mois / moyenne mobile 12 mois) → détecte automatiquement "quelle classe ATC monte ce mois-ci" de façon statistique et actualisable chaque mois, sans dépendre d'hypothèses manuelles.
2. **Signal avancé épidémique** : brancher l'API Sentiweb (`getIncidence`, hebdomadaire) sur grippe/IRA/diarrhée aiguë comme **variable prédictive à J+15/J+30** de la classe ATC correspondante (antitussifs, réhydratation) — permet une alerte précoce avant même que Medic'AM (délai de publication) ne le confirme.
3. **Granularité locale** : croiser l'indice pollen ATMO (communal, quotidien, ODbL) avec la localisation de l'officine pour personnaliser le déclenchement antihistaminique par pharmacie (une officine en vallée du Rhône n'a pas le même calendrier ambroisie qu'une officine en Bretagne).
4. **Calibrage/vérification** : utiliser les chiffres de marché de la presse professionnelle (Moniteur, Revue Pharma) comme **jeu de vérité terrain** pour valider que les indices calculés depuis Medic'AM correspondent bien aux ordres de grandeur réels (ex. vérifier que le modèle retrouve bien le pic anti-poux juillet-octobre = 40% des ventes annuelles).
5. **Indicateurs dérivables concrets** : "indice de tension épidémique régional" (SURSAUD + Sentinelles), "indice allergique communal J+3" (ATMO), "score de réassort ATC mensuel" (Medic'AM), "alerte rupture molécule sentinelle" (ANSM plan hivernal, 14 molécules suivies) — combinables en un tableau de bord unique de recommandation de commande par officine et par semaine.

**Limite factuelle importante à noter** : le RNSA, référence historique du calendrier pollinique français, a été liquidé judiciairement le 26 mars 2025 (fin des subventions publiques, ~85% de son budget) ; Atmo France a repris le pilotage national début avril 2025 avec un nouvel indice pollen IA/communal en ODbL — la profondeur d'historique de cette nouvelle base est donc encore limitée (moins d'un an et demi de recul au 3 juillet 2026), à surveiller pour la robustesse du modèle sur plusieurs années.

---

## Sources citées (URLs réelles)

- https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-classe-atc-medicam
- https://www.data.gouv.fr/datasets/open-medic-base-complete-sur-les-depenses-de-medicaments-interregimes
- https://www.data.gouv.fr/datasets/estimation-dincidence-des-syndromes-grippaux
- https://www.sentiweb.fr/ ; https://www.sentiweb.fr/?page=api ; https://odata.sentiweb.fr/
- https://www.santepubliquefrance.fr/surveillance-syndromique-sursaudr/bulletins-sursaudr-sos-medecins-oscour-mortalite
- https://geodes.santepubliquefrance.fr/ ; https://odisse.santepubliquefrance.fr/
- https://www.data.gouv.fr/datasets/indice-pollen ; https://www.data.gouv.fr/datasets/indice-pollen-atmo-historique ; https://www.data.gouv.fr/datasets/indice-pollen-atmo-indice-pollen-communal
- https://www.atmo-france.org/actualite/surveillance-des-pollens-atmo-france-prete-assumer-le-pilotage-national
- https://ansm.sante.fr/actualites/plan-hivernal-2025-2026-une-annee-marquee-par-labsence-de-tensions-sur-les-produits-de-sante-suivis
- https://www.epi-phare.fr/ ; https://drees.solidarites-sante.gouv.fr/publications/etudes-et-resultats/la-consommation-de-medicaments-non-prescrits
- https://www.lemoniteurdespharmacies.fr/business/marches/les-ventes-dantirhumes-senfievrent
- https://www.lemoniteurdespharmacies.fr/business/marches/des-produits-pour-toutes-les-tetes
- https://www.revuepharma.fr/2025/05/le-marche-des-solaires-cartonne/
- https://lepetitjournaldemapharmacie.fr/index.php/2023/04/26/le-marche-des-anti-moustiques/
- https://trends.google.fr/

---

# AGENT 4 — MARGE & PRIX : sources publiques pour reconstituer marge et prix officine

## 0. Ce qu'il faut comprendre avant tout (sinon le modèle de marge sera faux)

Il existe **deux prix distincts** dans le système français, et un seul est public :

- **Prix facial / prix public** (PFHT fabricant, prix grossiste, PPTTC) : fixé par convention CEPS-laboratoire ou décision CEPS, publié au JO, **et intégralement disponible dans la BDPM**. C'est sur cette base que se calcule la marge de l'officine (MDL) — donc **la marge du pharmacien EST reconstituable à 100% avec des données publiques**.
- **Prix net industriel** (après remises confidentielles LEEM/CEPS, clause de sauvegarde) : connu seulement du CEPS et du labo. **Jamais public.** Il sert à calculer la dépense réelle de l'Assurance Maladie, pas la marge du pharmacien.

Conclusion opérationnelle : pour un copilote IA "marge officine", on peut reconstituer avec une fiabilité quasi-parfaite **PFHT → grille MDL → prix public → marge officine par boîte**, à partir de sources 100% publiques. On ne peut PAS reconstituer les remises confidentielles labo↔CEPS (mais ce n'est pas nécessaire pour la marge du pharmacien).

---

## 1. BDPM — Base de Données Publique des Médicaments

**Nom** | Base de Données Publique des Médicaments (BDPM)
**URL** | https://base-donnees-publique.medicaments.gouv.fr/ (accueil), https://base-donnees-publique.medicaments.gouv.fr/telechargement (fichiers)
**Organisme** | ANSM + CNAM + HAS (co-produit), sous tutelle Ministère de la Santé
**Licence** | Licence ouverte Etalab 2.0 (réutilisation libre, citer la source + date de mise à jour, loi CADA 1978)
**Description** | Référentiel officiel de tous les médicaments commercialisés en France : identifiants CIS/CIP7/CIP13, prix, taux de remboursement, composition, statut de commercialisation, avis SMR/ASMR HAS
**Type de données** | Référentiel produit + prix + remboursement
**Format** | Fichiers texte plats (.txt, séparateur `\t`), 11 fichiers distincts
**API dispo** | Oui — indirecte via data.gouv.fr (voir source 1bis) ; pas d'API officielle native sur le site gouv lui-même, mais téléchargement direct des fichiers plats
**Mise à jour** | Mensuelle (le fichier "informations importantes" est généré à la demande, plus fréquent)
**Historique** | Version courante uniquement en téléchargement direct (pas de séries historiques nativement — voir contournement ci-dessous)
**Nb de lignes** | ~15 800 médicaments (CIS), ~30-35 000 présentations commerciales (CIP)
**Variables principales** | `CodeCIS`, `CodeCIP7`/`CodeCIP13`, libellé présentation, statut administratif, état de commercialisation, date de commercialisation, agrément collectivités (O/N), **taux de remboursement** (%), **prix en euros** (prix public TTC), texte d'indication si taux multiples ; fichiers séparés pour spécialités (CIS_bdpm), présentations (CIS_CIP_bdpm), compositions, génériques (CIS_GENER_bdpm), avis SMR/ASMR HAS, conditions de prescription
**Niveau géographique** | National (pas de déclinaison régionale)
**Qualité** | 9/10
**Facilité d'intégration** | 8/10 (fichiers plats simples, mais pas de vraie API REST officielle native)
**Potentiel business** | 10/10 — c'est LA colonne vertébrale prix/remboursement de tout le data lake

**Pourquoi/comment/croisements** : Fichier pivot pour tout calcul de marge. À croiser avec CIP13 dans Open Medic/Open PHMEV (quantités et montants remboursés) pour obtenir volume × marge unitaire = marge totale par produit/molécule. Croiser avec CIS_GENER_bdpm (génériques) pour appliquer le TFR sur les groupes concernés. Indicateur clé : `marge_unitaire_officine = f(PFHT, grille MDL) + honoraires_dispensation`, puis `marge_produit_annuelle = marge_unitaire × nb_boîtes (Open Medic)`.

---

## 1bis. API Médicaments FR (wrapper data.gouv.fr de la BDPM)

**Nom** | API Médicaments FR
**URL** | https://www.data.gouv.fr/dataservices/api-medicaments-fr — dépôt code : https://github.com/betagouv/api-medicaments
**Organisme** | Communauté data.gouv.fr / Etalab (service tiers basé sur données officielles ANSM)
**Licence** | Etalab 2.0 (source BDPM)
**Description** | Wrapper REST/JSON de la BDPM permettant recherche par CIS, CIP, nom, génériques
**Type de données** | Référentiel produit + prix + remboursement (identique BDPM)
**Format** | JSON
**API dispo** | Oui : `/v1/medicaments?search=`, `/v1/medicaments/{cis}`, `/v1/medicaments?cip=`, `/v1/generiques?libelle=`, `/v1/generiques/{groupID}`, `/v1/presentations/{cip}`, `/v1/medicaments/export` (base complète ~20 Mo), `/v1/diagnostics`
**Mise à jour** | Automatique 2×/jour (6h et 18h)
**Historique** | Snapshot courant uniquement
**Nb de lignes** | 15 800+ médicaments
**Variables principales** | CIP7/CIP13, prix, taux de remboursement, composition, groupes génériques
**Niveau géographique** | National
**Qualité** | 8/10
**Facilité d'intégration** | 9/10 (JSON propre, endpoint d'export en masse, gratuit et ouvert)
**Potentiel business** | 9/10

**Pourquoi/comment** : bien plus simple à intégrer dans un pipeline (JSON vs fichiers plats à parser). Rate-limit léger (1000 tokens/IP, recharge 3/s) — largement suffisant pour un usage batch quotidien. Utiliser `/v1/medicaments/export` pour un import initial complet puis rafraîchir en delta.

---

## 2. CEPS — Comité Économique des Produits de Santé (rapports + textes)

**Nom** | CEPS — Rapports d'activité annuels + Accord-cadre CEPS-LEEM
**URL** | https://sante.gouv.fr/ministere/acteurs/instances-rattachees/comite-economique-des-produits-de-sante-ceps/article/rapports-d-activite-du-ceps ; rapport 2024 signalé sous `ceps_ra2024_version_definitive_decembre_2025.pdf` (hébergé sur portail sante.gouv.fr, à récupérer via le lien officiel, le lien direct testé a un souci de certificat SSL sur un sous-domaine)
**Organisme** | CEPS (interministériel : Santé, Sécurité sociale, Économie)
**Licence** | Document public librement diffusable (rapport administratif), pas de licence de réutilisation de données structurées (c'est du texte/PDF, pas un jeu de données)
**Description** | Bilan annuel : nombre de nouveaux dossiers, montant des remises conventionnelles globales, montant des baisses de prix négociées, priorités de régulation
**Type de données** | Rapport narratif + tableaux agrégés (PAS de fichier CIP-par-CIP)
**Format** | PDF
**API dispo** | Non
**Mise à jour** | Annuelle (rapport 2024 publié en décembre 2025)
**Historique** | Rapports disponibles sur plusieurs années sur la page listée
**Nb de lignes** | N/A (rapport narratif, pas un dataset)
**Variables principales** | Chiffres agrégés : ex. rapport 2024 = 368 nouveaux dossiers d'inscription traités, ~8 Md€ de remises conventionnelles générées, 856 M€ d'économies via baisses de prix, chiffre d'affaires médicaments remboursables ~37 Md€ (+6,7%)
**Niveau géographique** | National
**Qualité** | 7/10 (fiable mais agrégé, pas granulaire produit-par-produit)
**Facilité d'intégration** | 3/10 (PDF non structuré, à parser manuellement, pas de tableau exploitable en masse)
**Potentiel business** | 6/10 (utile pour contextualiser/benchmarker, pas pour calculer une marge produit précise)

**Pourquoi/comment** : sert à calibrer des ordres de grandeur macro (ex. "les remises captées par la collectivité représentent X% du CA médicament") pour un tableau de bord sectoriel, PAS pour la marge officine produit par produit (qui elle vient de la BDPM + grille MDL). Attention : les rapports CEPS ne contiennent jamais les prix nets par produit — ce sont ceux-là qui restent confidentiels.

---

## 3. Légifrance / JORF — textes fixant la marge officine (MDL) et les honoraires

**Nom** | Arrêté du 4 août 1987 modifié (texte de base) relatif aux prix et marges des médicaments remboursables — version consolidée
**URL** | https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006057619
**Organisme** | Légifrance / DILA (Direction de l'information légale et administrative)
**Licence** | Licence ouverte Etalab (contenus juridiques librement réutilisables)
**Description** | Texte réglementaire qui fixe **la grille officielle de marge dégressive lissée (MDL)** des pharmaciens d'officine ET des grossistes-répartiteurs
**Type de données** | Texte réglementaire (barème chiffré dans les annexes)
**Format** | HTML/texte, avec API Légifrance disponible (PISTE/DILA) pour requêtage programmatique
**API dispo** | Oui — API Légifrance via la plateforme PISTE (piste.gouv.fr), gratuite avec inscription, pour interroger les textes en masse
**Mise à jour** | À chaque arrêté modificatif (dernier en date : arrêté du 5 juillet 2024)
**Historique** | Toutes les versions successives consolidées disponibles depuis 1987
**Nb de lignes** | N/A (texte réglementaire, quelques dizaines de lignes de barème)
**Variables principales** | **Grille MDL officine (Annexe I-2, en vigueur depuis le 01/01/2020), vérifiée** :

| Tranche de PFHT | Taux de marge officine |
|---|---|
| 0 à 1,91 € | 10 % |
| 1,92 à 22,90 € | 7 % |
| 22,91 à 150,00 € | 5,5 % |
| 150,01 à 1 930,00 € | 5 % |
| Au-delà de 1 930,00 € | 0 % |

Et séparément, **grille grossistes-répartiteurs (Annexe I-1, en vigueur depuis le 01/02/2021)** — à ne pas confondre avec celle des pharmaciens :

| Tranche de PFHT | Coefficient |
|---|---|
| 0 à 468,97 € | 6,93 % (plancher 0,30 €, plafond 32,50 €) |
| Au-delà de 468,97 € | 0 % |
| Spécialités à conserver au froid | + 0,63 €/conditionnement (forfait grossiste) |

⚠️ **Point de vigilance pour la mémoire projet** : ta note interne "Barème MDL pharmacie" (0,18€ fixe ≤4,33€ / 3,9% jusqu'à 468€ / 19,50€ fixe au-delà) **ne correspond pas** à la grille officine actuellement en vigueur trouvée ci-dessus (10%/7%/5,5%/5%/0%), ni à la grille grossiste (6,93% avec plancher/plafond). Les seuils 4,33€/468€ ressemblent structurellement aux tranches PPHT que tu utilises côté "Tranches prix IP" (NR/produits non remboursés) — il serait utile de vérifier si ta note MDL mélange deux référentiels différents (marge PLM/NR vs MDL remboursables réglementaire) avant de l'utiliser en prod.

**Niveau géographique** | National, avec majorations DROM spécifiques (coefficients : Réunion ×1,264, Martinique/Guadeloupe ×1,323, etc., trouvés dans le texte de la convention)
**Qualité** | 10/10 (texte de loi, source primaire absolue)
**Facilité d'intégration** | 6/10 (texte juridique à parser une fois, mais très stable — se maj rarement)
**Potentiel business** | 10/10 — **c'est le moteur de calcul de la marge officine**, la pièce manquante que ni IQVIA ni GERS ne publient à ce niveau réglementaire brut

**Pourquoi/comment** : coder cette grille en dur (elle change rarement, ~1 fois tous les 2-4 ans) et l'appliquer au PFHT de chaque CIP13 issu de la BDPM → calcul exact de la marge brute réglementaire par boîte vendue. Croiser avec Open Medic (nb de boîtes vendues par CIP/molécule/région) pour obtenir une marge totale théorique par pharmacie/secteur. C'est l'indicateur le plus différenciant du projet : **aucun outil gratuit existant ne propose un simulateur MDL automatisé branché sur la BDPM en temps réel** (Break-Pharma, audit-remise etc. se concentrent sur les remises fournisseurs, pas sur la marge réglementaire CNAM).

---

## 4. Convention nationale des pharmaciens + avenants (honoraires de dispensation)

**Nom** | Convention nationale organisant les rapports entre les pharmaciens titulaires d'officine et l'assurance maladie (et ses avenants)
**URL** | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045538155 (arrêté du 31 mars 2022, approuvant la convention du 9 mars 2022) ; avenant n°1 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049892219 (arrêté du 5 juillet 2024) ; page de synthèse ameli : https://www.ameli.fr/pharmacien/textes-reference/textes-conventionnels/convention-nationale-pharmaciens-avenants
**Organisme** | Assurance Maladie (Uncam) + syndicats pharmaciens (FSPF, USPO)
**Licence** | Texte réglementaire public, librement réutilisable
**Description** | Fixe les **honoraires de dispensation** (part de rémunération fixe, indépendante du prix du médicament) qui s'ajoutent à la marge MDL
**Type de données** | Texte réglementaire (grille d'honoraires chiffrée)
**Format** | HTML/PDF
**API dispo** | Non directement, mais via API Légifrance/PISTE
**Mise à jour** | Par avenants successifs (dernier en vigueur : avenant n°1, entré en application le 8 janvier 2025)
**Historique** | Conventions 2012, 2017 (avenants), 2022, avenant 1 (2024/2025)
**Nb de lignes** | N/A
**Variables principales — grille d'honoraires vérifiée (2022, mise à jour 2025)** :

| Honoraire | Montant 2022 | Montant depuis le 8/01/2025 |
|---|---|---|
| Dispensation à l'ordonnance | 0,51 € TTC | 0,61 € TTC (+20%) |
| Ordonnance complexe (≥5 lignes) | 0,31 € TTC | — |
| Dispensation par âge (<3 ans, >70 ans) | 1,58 € TTC | revalorisé (âge évoluera encore en 2026) |
| Dispensation particulière (médicaments spécifiques) | 3,57 € TTC | — |
| Grand conditionnement trimestriel | 2,76 € TTC | — |
| Conditionnement standard (avant 2016 : historique) | 1,02 € TTC | — |
| Entretien opioïdes palier II (1er renouvellement) | — | 5 € TTC |
| Majorations DROM | ×1,264 (Réunion), ×1,323 (Martinique/Guadeloupe), etc. | idem |

**Niveau géographique** | National + majorations DROM
**Qualité** | 10/10
**Facilité d'intégration** | 7/10
**Potentiel business** | 10/10 — complète la marge MDL pour obtenir la **marge totale réelle par ordonnance/boîte** (marge produit + honoraire fixe), non capturée par les outils concurrents axés uniquement sur les remises fournisseurs

**Pourquoi/comment** : additionner `marge_MDL(PFHT) + honoraires_dispensation(profil patient, type ordonnance)` = rémunération totale de la dispensation. Croiser avec Open Medic (âge des bénéficiaires disponible) pour estimer la part d'honoraires majorés (jeunes/personnes âgées) dans le chiffre d'affaires d'une officine type.

---

## 5. Open Medic — CNAM (dépenses/volumes de médicaments remboursés)

**Nom** | Open Medic : base complète sur les dépenses de médicaments interrégimes
**URL** | https://www.data.gouv.fr/datasets/open-medic-base-complete-sur-les-depenses-de-medicaments-interregimes ; miroir Assurance Maladie : https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-medic-base-complete-depenses-medicaments
**Organisme** | CNAM (Caisse Nationale de l'Assurance Maladie), source SNDS
**Licence** | Licence Ouverte / Open Licence
**Description** | Dépenses annuelles de médicaments délivrés en ville, par CIP, par profil bénéficiaire, prescripteur, région
**Type de données** | Statistiques de remboursement (montants + volumes), PAS de fichier de prix en tant que tel (mais permet de déduire un prix moyen = montant/nb boîtes)
**Format** | CSV / XLSX
**API dispo** | Non (téléchargement direct de fichiers annuels)
**Mise à jour** | Annuelle
**Historique** | 2014 à 2024 (2025 en cours de correction suite à une anomalie signalée)
**Nb de lignes** | Plusieurs millions de lignes (croisement CIP × âge × sexe × région × spécialité prescripteur)
**Variables principales** | Montant remboursé (REM), montant remboursable (base — BSE, hors honoraires de dispensation depuis 2015), nombre de boîtes délivrées, tranche d'âge, sexe, région, spécialité du prescripteur, classification ATC
**Niveau géographique** | Régional (nomenclature INSEE)
**Qualité** | 9/10
**Facilité d'intégration** | 8/10 (CSV standard, gros volumes mais gérable)
**Potentiel business** | 9/10

**Pourquoi/comment/croisements** : donne les **volumes réels de boîtes vendues par CIP/molécule/région** — la variable manquante pour transformer une marge unitaire (calculée via BDPM + MDL) en marge totale de marché par produit/territoire. Croisement clé : `CIP13 (Open Medic) ⋈ CIP13 (BDPM)` → volume × marge unitaire = **marge de marché théorique par produit et par région**, un indicateur qu'aucun concurrent gratuit ne propose à ce niveau de granularité territoriale. Attention : BSE exclut les honoraires de dispensation depuis 2015, il faut les rajouter séparément (source 4).

---

## 6. Open PHMEV — CNAM (prescriptions hospitalières exécutées en ville)

**Nom** | Open PHMEV : bases sur les prescriptions hospitalières de médicaments délivrées en ville
**URL** | https://www.data.gouv.fr/datasets/open-phmev-bases-sur-les-prescriptions-hospitalieres-de-medicaments-delivrees-en-ville ; miroir ameli : https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-phmev-base-complete
**Organisme** | CNAM, source Sniiram/SNDS
**Licence** | Licence Ouverte
**Description** | Complète Open Medic pour la part des prescriptions faites à l'hôpital mais exécutées en pharmacie de ville
**Type de données** | Statistiques de remboursement (montants + volumes) par établissement prescripteur
**Format** | CSV (préfixe `OPEN_PHMEV` + année)
**API dispo** | Non
**Mise à jour** | Annuelle
**Historique** | 2014 à 2024
**Nb de lignes** | Plusieurs millions
**Variables principales** | Montants remboursés/remboursables, nb de boîtes, âge, sexe bénéficiaire, établissement prescripteur (numéro FINESS, catégorie juridique, géolocalisation), classification ATC
**Niveau géographique** | Établissement + région
**Qualité** | 9/10
**Facilité d'intégration** | 8/10
**Potentiel business** | 7/10 — complète Open Medic pour la vision "sortie d'hôpital → pharmacie de ville", utile pour anticiper des pics de demande sur certaines molécules après sortie hospitalière

**Pourquoi/comment** : à sommer avec Open Medic pour obtenir la dépense totale ville, ou à isoler pour analyser spécifiquement le flux hôpital→ville (primo-prescriptions à fort enjeu de stock/marge pour l'officine, ex. anticancéreux oraux, biothérapies).

---

## 7. ANSM — Répertoire des groupes génériques (pour le TFR)

**Nom** | Répertoire des groupes génériques (CIS_GENER_bdpm)
**URL** | Fichier sur data.gouv.fr (rattaché au jeu de données BDPM) ; PDF de référence ANSM : https://ansm.sante.fr/uploads/2024/01/23/20240123-generiques-repertoire-complet.pdf ; actualités de mise à jour : https://ansm.sante.fr (ex. décision du 13/01/2026)
**Organisme** | ANSM
**Licence** | Etalab 2.0
**Description** | Liste les groupes génériques (princeps + génériques associés), permet d'identifier les produits soumis au TFR (Tarif Forfaitaire de Responsabilité)
**Type de données** | Référentiel produit
**Format** | CSV (`CIS_GENER_bdpm.csv`)
**API dispo** | Non natif, mais inclus dans l'export API Médicaments FR (source 1bis, endpoint `/v1/generiques`)
**Mise à jour** | Ponctuelle, à chaque décision ANSM (plusieurs fois par an)
**Historique** | Non archivé nativement en séries — juste la version courante (les décisions successives sont publiées comme actualités séparées)
**Nb de lignes** | ~1 600 groupes génériques, ~8 250 spécialités concernées (chiffre mars 2025 pour le RUIM)
**Variables principales** | Identifiant de groupe, libellé, type (princeps/générique/générique par complémentarité), CIS associés
**Niveau géographique** | National
**Qualité** | 8/10
**Facilité d'intégration** | 8/10
**Potentiel business** | 8/10

**Pourquoi/comment** : le **TFR** aligne le remboursement du princeps non substitué sur le prix du générique le moins cher du groupe — cela change radicalement la marge nette du patient ET peut influencer la politique de substitution du pharmacien (marge officine identique générique/princeps sous TFR, mais reste-à-charge patient différent). Croiser groupe générique (ANSM) × prix de chaque membre du groupe (BDPM) × volumes (Open Medic) pour calculer, par groupe TFR, l'écart princeps/générique et orienter un conseil de substitution optimisé marge+observance.

---

## 8. Sources écartées ou complémentaires (contexte, pas prioritaires)

- **CEPS — Accord-cadre CEPS-LEEM** (prolongé le 4 mars 2025 jusqu'au 5 mars 2026) : texte de cadrage des négociations de prix, utile pour comprendre les règles du jeu mais sans données chiffrées produit par produit exploitables. https://www.leem.org/presse/prix-du-medicament-le-leem-et-le-comite-economique-des-produits-de-sante-signent-la
- **GERS / OpenHealth / IQVIA (Pharmastat/FSPF)** : PAYANT, panels privés de vente officine (sell-in/sell-out), c'est le concurrent direct qu'on cherche à contourner — à ne pas utiliser comme source mais à citer comme benchmark de ce que le data lake public doit remplacer. https://www.gie-gers.fr/ , https://www.openhealth.fr/fr/sources/openhealth-pharma
- **API Légifrance (PISTE, piste.gouv.fr)** : gratuite avec inscription, permet d'interroger tous les arrêtés de prix/marge en masse plutôt qu'un par un — à activer si le projet a besoin d'automatiser la veille réglementaire (changement de grille MDL, nouveaux honoraires).

---

## Synthèse actionnable pour l'IA copilote pharmacien

1. **Pipeline minimal viable (100% gratuit)** : BDPM/API Médicaments FR (prix + taux remboursement par CIP) → grille MDL Légifrance (codée en dur) → grille honoraires convention/avenant (codée en dur) → Open Medic (volumes réels) → CIS_GENER (statut générique/TFR). Ce pipeline suffit à produire, par CIP13, une **marge officine réglementaire complète et vérifiable** (marge produit + honoraire), et à l'agréger par molécule/classe/région.
2. **Indicateur phare différenciant** : simulateur "Combien je gagne vraiment sur cette boîte ?" = MDL(PFHT) + honoraire(profil patient/ordonnance), ce qu'aucun outil gratuit actuel (Break-Pharma, audit-remise) ne propose puisqu'ils se concentrent sur les remises grossistes/fournisseurs, pas sur la marge réglementaire CNAM elle-même.
3. **Limite structurelle à documenter clairement pour l'utilisateur final** : ce pipeline calcule la marge *officine* (100% publique et fiable), pas le prix net industriel confidentiel (labo↔CEPS) — ne jamais promettre de reconstituer les remises fournisseur/CEPS confidentielles, qui restent hors de portée de toute source publique.
4. **Point à vérifier en interne avant mise en prod** : réconcilier la note mémoire "Barème MDL pharmacie" (0,18€/3,9%/19,50€) avec la grille officielle vérifiée ci-dessus (10%/7%/5,5%/5%/0%) — il semble y avoir une confusion entre deux référentiels différents dans les notes du projet.

**Fichiers temporaires** : aucun fichier de travail persistant n'a été créé pour cette recherche (uniquement des fetchs web transitoires).

---

# AGENT 8 — Signaux de tendances produits pharmacie : rapport de recherche

## Avertissement honnête en préambule

Sur les 6 zones investiguées, la réalité 2026 est brutale : **la quasi-totalité des réseaux sociaux (TikTok, Instagram/Meta, Reddit) ont verrouillé ou payanté leur accès API commercial depuis 2023**. Ce qui reste réellement gratuit et exploitable pour un data lake pharmacie sans budget, ce sont : les données publiques françaises/européennes de santé (ANSM, HAS, EMA, DGAL, Santé Publique France, Sentiweb, Atmo France), Wikipedia Pageviews (souvent oublié, gratuit et sans clé), et Google Trends en mode "gratuit mais fragile" (interface web / scraping non-officiel, l'API officielle étant encore fermée en alpha restreinte). Le scraping de sites marchands (1001pharmacies, Amazon, Google Shopping) est techniquement possible mais dans une zone grise de CGU — à traiter avec prudence, pas comme un pilier du produit.

---

## 1. Google Trends — le proxy de recherche le plus utile, mais fragile

**Google Trends (interface web / export CSV manuel)**
URL : https://trends.google.fr/trends | Organisme : Google | Licence : conditions d'utilisation Google, pas de licence open data | Gratuit : oui | Type : volume de recherche relatif (indice 0-100) | Format : web UI + export CSV/PNG | API : pas d'API publique stable pour ce canal (voir ci-dessous) | Historique : depuis 2004 | Géographie : mondial → région → département possible en France | Qualité 7/10 (donnée relative, pas de volume absolu) | Facilité d'intégration 4/10 (pas d'API robuste) | Potentiel business 9/10.

**pytrends (bibliothèque non-officielle)**
URL : https://github.com/GeneralMills/pytrends | Organisme : communauté open source | Licence : MIT | Gratuit : oui | **Statut critique : le repo a été archivé (lecture seule) le 17 avril 2025** — plus de maintenance, casse à chaque changement d'endpoint Google, risque de blocage IP en cas d'usage intensif | API : scraping du endpoint interne de Google Trends | Format : JSON/DataFrame | Qualité 5/10 | Facilité d'intégration 6/10 (marche encore mais fragile, à forker) | Potentiel business 7/10.

**Google Trends API (alpha, officielle)**
URL annonce : https://developers.google.com/search/blog/2025/07/trends-api | Organisme : Google | Lancée le 24 juillet 2025, encore en alpha très restreinte sur liste d'attente | Gratuit : quota alpha ~1 500 requêtes/jour (quota extensible via Google Cloud Console, tarification volume non publiée) | Données : interest over time, top trends, related queries, historique jusqu'à 1800 jours (5 ans), granularité jour/semaine/mois/an, filtre géographique région/sous-région | Qualité 8/10 (données propres, alignées Trends officiel) | Facilité d'intégration 3/10 aujourd'hui (accès non garanti, liste d'attente) | Potentiel business 9/10 **si accès obtenu** — à surveiller et candidater dès maintenant.

**Google Health Trends API (legacy, restreinte recherche)**
URL : https://cmu-delphi.github.io/delphi-epidata/api/ght.html (endpoint listé **inactif**) ; repo CDC : https://github.com/CDCgov/gtrendshealth | Organisme : Google (partenariat recherche épidémiologique historique, ex-Google Flu Trends) | Accès : restreint aux projets de recherche autorisés (revue de sécurité/vie privée Google) | Statut : ce endpoint spécifique apparaît **inactif** dans Delphi Epidata — ne pas confondre avec le "Google Health API" 2025 (celui-ci concerne Health Connect / données fitness Android, sans lien avec les tendances de recherche) | Qualité n/a (fermé) | Facilité d'intégration 1/10 | Potentiel business 4/10 (accès très improbable pour un acteur privé).

**Croisement/indicateur proposé** : "delta de recherche J-30" = variation % du volume Trends sur un mot-clé produit/molécule/marque vs sa moyenne mobile 90 jours, croisé avec le calendrier épidémique (GEODES/Sentiweb) et les nouvelles AMM — sert de cloche d'alerte précoce avant l'explosion des ventes OTC/para.

---

## 2. Réseaux sociaux — portes largement fermées côté gratuit/commercial

**TikTok Research API**
URL : https://developers.tiktok.com/products/research-api/ | Gratuit : oui, aucun tarif publié | **Mais réservé aux chercheurs universitaires à but non lucratif** (US/Europe), 4 semaines d'approbation, plafond 1 000 requêtes/jour et 100 000 enregistrements/jour, **usage commercial explicitement interdit** | Un nouveau canal européen (délégué DSA, entré en vigueur le 29 octobre 2025) ouvre l'accès aux "chercheurs vérifiés" — toujours non-commercial | Qualité 7/10 (données réelles) | Facilité d'intégration 1/10 pour un usage business | Potentiel business 3/10 (inaccessible sauf partenariat académique type thèse CIFRE avec une université).

**Meta Content Library (Instagram/Facebook)**
URL : https://developers.facebook.com (Content Library) | Gratuit : oui pour chercheurs académiques | Accès via environnement sécurisé (Virtual Data Enclave), plafond 1 000 requêtes/semaine glissante | Limite documentée : couverture partielle (~50% des posts visibles réellement accessibles, exclusion des comptes <25 000 abonnés historiquement) | Qualité 5/10 (biaisée, incomplète) | Facilité d'intégration 1/10 | Potentiel business 2/10 pour un acteur commercial.

**Reddit API**
URL : https://www.reddit.com/dev/api | Changement majeur : passage au payant le 1er juillet 2023 (0,24 $/1000 appels au-delà du quota gratuit) | Palier gratuit : 100 requêtes/min authentifié, réservé usage personnel/recherche non-commerciale | Un produit commercial (copilote pharmacien vendu) tombe hors du tarif gratuit | Sous-communautés françaises santé (r/france, r/AskFrance) existent mais faible volume santé/pharma spécifique vs marché US (r/SkincareAddiction équivalent français quasi inexistant en volume) | Qualité 4/10 (volume France faible) | Facilité d'intégration 3/10 | Potentiel business 3/10.

**Forums santé français (Doctissimo, Vulgaris, forums pharmaciens)**
Pas d'API officielle. Extraction uniquement par scraping, en zone grise CGU (Doctissimo interdit explicitement le scraping automatisé dans ses CGU). Potentiel de signal qualitatif réel (les forums grand public captent les questions "produit X ça marche ?" avant les réseaux) mais coût juridique/technique élevé pour un rendement incertain. Qualité 5/10, Facilité 2/10, Potentiel business 4/10 — **à éviter en V1**, robot d'exploration = risque juridique disproportionné.

**Conclusion réseaux sociaux** : aucune voie gratuite légale ne permet un usage commercial systématique en 2026. La seule option réaliste et honnête : **veille manuelle/qualitative** sur une liste restreinte de comptes pharmaciens influenceurs français identifiés (ex. Léa Pateras-Pescara ~140k abonnés Instagram, Jérémie Kneubuhl/Dr JFK ~500k cumulés, communauté #FrenchPharmacy sur TikTok, compte étudiant @pharma_anepf), suivis à l'œil via les apps publiques (pas d'API), mise à jour hebdomadaire manuelle dans le data lake comme simple tag qualitatif "produit mentionné par influenceur X le [date]".

---

## 3. Nouveautés labos — le vrai signal avancé, 100% gratuit et officiel

**Base de données publique des médicaments (BDPM)**
URL : https://base-donnees-publique.medicaments.gouv.fr + API REST communautaire https://github.com/betagouv/api-medicaments + jeu data.gouv.fr https://www.data.gouv.fr/datasets/base-de-donnees-publique-des-medicaments-base-officielle | Organisme : ANSM/HAS/UNCAM | Licence : Licence Ouverte (Etalab) | Gratuit : oui | Format : CSV officiel + API REST/GraphQL communautaires (mise à jour automatique 2x/jour, 6h/18h) | Historique : médicaments commercialisés + 2 ans après arrêt | Volume : ~10-15k spécialités | Variables : CIS, CIP, dénomination, forme, ATC, laboratoire, statut AMM, SMR/ASMR liés | Géographie : nationale | Qualité 9/10 | Facilité d'intégration 8/10 | Potentiel business 8/10.

**HAS — avis Commission de la Transparence**
URL : https://www.has-sante.fr (rubrique open data) | Organisme : HAS | Licence : ouverte | Gratuit : oui | Volume : 500 à 800 avis/an, dont ~200 concernant nouveaux médicaments/indications | Contenu : SMR (Service Médical Rendu), ASMR (Amélioration), fichier de liens croisé avec BDPM | Fréquence : mise à jour régulière | Qualité 8/10 | Facilité d'intégration 6/10 (format moins structuré qu'une API REST) | Potentiel business 7/10 — **signal clé pour anticiper l'arrivée de nouveaux produits remboursés avant leur disponibilité en rayon**.

**EMA — EPAR (European Public Assessment Reports)**
URL : https://www.ema.europa.eu/en/medicines/download-medicine-data + portail data.europa.eu https://data.europa.eu/data/datasets/epar-human-medicines | Organisme : European Medicines Agency | Licence : réutilisation ouverte UE | Gratuit : oui | Format : tables Excel + API JSON (site entier interrogeable en JSON), mise à jour automatique nocturne | Contenu : autorisations centralisées UE, orphelins, génériques, biosimilaires, procédures post-AMM | Géographie : Union Européenne (donc devance de plusieurs mois l'arrivée nationale française via ANSM) | Qualité 9/10 | Facilité d'intégration 7/10 | Potentiel business 8/10 — **excellent signal avancé, une autorisation EMA précède souvent de plusieurs mois la mise sur le marché française**.

**DGAL/Compl'Alim (ex-DGCCRF Téléicare) — déclarations de compléments alimentaires**
URL : https://www.data.gouv.fr/datasets/declarations-de-complements-alimentaires | Organisme : Ministère de l'Agriculture (DGAL), historiquement DGCCRF | Licence : Licence Ouverte 2.0 | Gratuit : oui | Format : CSV (42,9 Mo), JSON (336 Ko), doc Markdown, service de réutilisation référencé | Mise à jour : régulière (dernière observée 3 juillet 2026) | Historique : consolidation TeleIcare (2016-sept. 2025) + Compl'Alim (depuis sept. 2025) | Contenu : chaque complément alimentaire déclaré, composition, présentation, conditions d'usage | Qualité 8/10 | Facilité d'intégration 8/10 | Potentiel business 9/10 — **c'est LE radar gratuit de nouveaux compléments alimentaires arrivant sur le marché français avant qu'ils ne soient vendus, un des angles morts des concurrents payants**.

**ANSM — ruptures de stock / tensions d'approvisionnement**
URL : https://data.ansm.sante.fr/ruptures (+ dashboard https://ansm.sante.fr/disponibilites-des-produits-de-sante/medicaments) | Organisme : ANSM, partenariat Etalab/DINUM/Health Data Hub | Gratuit : oui, open data | Historique : depuis 2014 (données pré-mai 2021 partiellement exploitables) | Variables : type de déclaration (rupture/risque), classe thérapeutique, causes, mesures palliatives | Contexte chiffré (DREES) : pic hiver 2022-2023 ~800 présentations en rupture simultanée, ~400 fin 2024, impact -11% livraisons en rupture / -7% en risque, jusqu'à 8M de boîtes MITM manquantes/mois au pic | Qualité 8/10 | Facilité d'intégration 6/10 (pas d'API REST formalisée constatée, à confirmer avec Etalab) | Potentiel business 8/10 — **signal inverse utile : anticiper la demande de substituts/génériques quand une rupture est déclarée**.

---

## 4. Proxys épidémiologiques et comportementaux — gratuits, sous-exploités

**Wikipedia Pageviews API**
URL : https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia.org/... (doc https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/) | Organisme : Wikimedia Foundation | Licence : CC0/ouverte | Gratuit : oui, **sans clé API, sans authentification** | Format : JSON REST | Granularité : horaire à mensuelle, historique depuis 2015 | Géographie : par langue de wiki (fr.wikipedia.org proxy France/francophonie, pas de découpage régional) | Qualité 7/10 (bruit possible, biais démographique wiki) | Facilité d'intégration 9/10 (le plus simple de tout ce rapport) | Potentiel business 6/10 — **source la plus sous-utilisée** : suivre les pics de consultation des pages "grippe", "gastro-entérite", noms de molécules/marques, nouvelles pathologies médiatisées, en signal précoce gratuit et fiable.

**Santé Publique France — GEODES**
URL : https://geodes.santepubliquefrance.fr | Organisme : Santé Publique France | Licence : ouverte | Gratuit : oui | Contenu : 900+ indicateurs (grippe, bronchiolite, gastro-entérite, diabète, mortalité, urgences SOS Médecins) issus de 70 systèmes de surveillance | API : interrogation possible, export CSV/visualisation | Historique : depuis 2019 (lancement plateforme), séries historiques plus anciennes selon indicateur | Géographie : national → régional → départemental | Qualité 9/10 | Facilité d'intégration 7/10 | Potentiel business 8/10.

**Réseau Sentinelles / Sentiweb**
URL API : `https://www.sentiweb.fr/api/v1/datasets/rest/incidence?indicator=3&geo=PAY&span=short&$format=csv` (doc partielle sur sentiweb.fr, endpoint fonctionnel confirmé) | Organisme : Inserm/Sorbonne Université | Gratuit : oui | Format : CSV/JSON, semaine ISO 8601 | Fréquence : hebdomadaire (bulletin chaque mardi), consolidation possible jusqu'à 3 semaines | Historique : plusieurs décennies pour la grippe | Réseau : 1 314 médecins généralistes + 116 pédiatres | Géographie : national/régional | Qualité 8/10 | Facilité d'intégration 7/10 | Potentiel business 8/10 — **couplé à GEODES et au pollen, permet de construire un calendrier prédictif OTC (antigrippaux, antipyrétiques, SRO, antihistaminiques) avec 1 à 3 semaines d'avance**.

**Atmo France — indice pollen** (remplace le RNSA, en liquidation judiciaire depuis le 26 mars 2025)
URL : https://www.data.gouv.fr/datasets/indice-pollen + https://www.atmo-france.org/article/indice-pollen | Organisme : Atmo France / AASQA (mandat officiel par arrêté du 2 mars 2026) | Licence : ODbL | Gratuit : oui, API + WFS | Fréquence annoncée : quotidienne 13h (irrégularités constatées dans les métadonnées) | Variables : 6 taxons (ambroisie, armoise, aulne, bouleau, graminées, olivier), concentration grains/m³, indice à J/J+1/J+2, modèle IA + Copernicus | Géographie : commune, France métropolitaine + Corse | Qualité 7/10 (système encore jeune, transition RNSA→Atmo, fiabilité à confirmer sur plusieurs saisons) | Facilité d'intégration 7/10 | Potentiel business 7/10 — **signal direct pour anticiper la demande d'antihistaminiques et sprays nasaux par bassin pollinique**.

---

## 5. E-commerce santé et marketplaces — pas d'API, scraping en zone grise

**1001pharmacies, Shop Pharmacie, Pharma GDD (classements "meilleures ventes" publics)** : aucune API publique documentée trouvée. Les pages "meilleures ventes"/"top" sont publiques et visibles à l'œil nu, techniquement scrapables, mais sans API officielle ni CGU l'autorisant explicitement — statut juridique incertain pour un usage automatisé et commercial. Qualité (si scrapé) 6/10, Facilité 3/10, Potentiel business 6/10 — **prudence : à ne pas construire en pilier du produit sans validation juridique préalable, contrairement aux sources ci-dessus qui sont 100% open data officielles**.

**Amazon Best Sellers santé** : même situation — pas d'API produit gratuite officielle pour cet usage, scraping en zone grise, CGU Amazon interdisant explicitement le scraping automatisé à but commercial concurrent.

**Google Shopping "Best Sellers report"** : existe officiellement via Content API for Shopping, mais **réservé aux marchands ayant un compte Merchant Center actif** (accès à leurs propres données de vente, pas un radar marché général gratuit). Pas exploitable comme source de tendance marché externe gratuite.

---

## 6. Datasets tout faits (Kaggle/Zenodo/GitHub)

Recherche infructueuse sur un dataset combinant Google Trends + santé + France prêt à l'emploi. Seuls des datasets génériques existent (Google Trends mondial multi-thèmes sur Kaggle, liste des datasets Zenodo les plus téléchargés) — aucun n'est directement exploitable pour la pharmacie française sans retraitement lourd. Potentiel business 2/10 en l'état — à ignorer, mieux vaut construire son propre pipeline sur les sources officielles ci-dessus.

---

## Synthèse actionnable — 3 indicateurs métier concrets à construire en V1

1. **Radar réglementaire précoce** (le plus fiable et 100% gratuit) : croiser EMA EPAR (signal Europe, T0) → HAS avis Transparence (signal remboursement France, T0+quelques mois) → BDPM (signal commercialisation effective) → Compl'Alim (signal complément alimentaire nouveau). Donne un délai d'anticipation de plusieurs mois avant l'arrivée effective en rayon, exploitable pour pré-référencer/anticiper le stock.

2. **Score épidémio-saisonnier** : GEODES (grippe/gastro/bronchiolite) + Sentiweb (incidence hebdo) + Atmo France (pollen) → génère un calendrier régional de pics de demande OTC (antalgiques, antitussifs, SRO, antihistaminiques, sprays nasaux) avec 1 à 3 semaines d'avance sur le pic réel de vente.

3. **Delta de recherche J-30** : Wikipedia Pageviews (fiable, gratuit, sans clé) + Google Trends web/scraping (fragile mais riche) sur un panier de mots-clés molécules/marques/pathologies → score d'alerte quand une hausse anormale de recherche précède historiquement un pic de vente (ex. anniversaire d'un scandale sanitaire, viralité TikTok détectée indirectement via le rebond de recherche qu'elle génère, même sans accès direct à TikTok).

**Ce qu'il ne faut pas promettre au pharmacien** : une détection en temps réel des viralités TikTok/Instagram comme le ferait un service payant de social listening (Brandwatch, Meltwater) — ces accès sont fermés ou hors budget. Le positionnement honnête est : "on ne voit pas la vague sur les réseaux sociaux directement, mais on voit son sillage dans les recherches Google/Wikipedia et dans les nouvelles déclarations produits, souvent 1 à 4 semaines avant que ça n'arrive en rayon."

---

**Chemins de fichiers** : aucun fichier n'a été créé pour cette tâche de recherche ; toutes les sources sont référencées par URL ci-dessus.

---

# AGENT 7 — Environnement de l'officine : établissements et professionnels de santé à proximité

Recherche complétée sur les registres nationaux (FINESS, RPPS, INSEE BPE), les annuaires sectoriels (éducation, petite enfance, personnes âgées), les infrastructures géographiques (BAN, API Géo) et les alternatives crowdsourcées (OpenStreetMap). Toutes les sources ci-dessous sont vérifiées par URL réelle au 03/07/2026. Les incertitudes (nombre exact de lignes, licence non confirmée) sont signalées explicitement plutôt qu'inventées.

---

## 1. FINESS — Fichier National des Établissements Sanitaires et Sociaux

**Nom** : FINESS – Extraction du fichier des établissements
**URL** : https://www.data.gouv.fr/datasets/finess-extraction-du-fichier-des-etablissements (version géolocalisée enrichie par Atlasanté : jeu de données `t_finess` sur data.gouv.fr)
**Organisme** : Agence du Numérique en Santé (ANS) / Ministère de la Santé, enrichissement géo par Atlasanté
**Licence** : Licence Ouverte / Open Licence
**Description** : Recense >101 000 établissements sanitaires, sociaux et médico-sociaux (hôpitaux, cliniques, EHPAD, laboratoires, centres de santé, MSP…) avec identifiant unique FINESS
**Type de données** : Établissements géolocalisés, tous types confondus
**Format** : CSV, ZIP
**API** : Oui — successeur du système annoncé pour l'été 2026 via l'ANS ; en attendant, extraction en fichiers plats + API géographique Atlasanté
**Mise à jour** : Bimestrielle (dernière connue : 12/05/2026)
**Historique** : Non versionné dans le temps (photo à date), pas d'archives officielles faciles d'accès
**Nb de lignes** : ordre de grandeur >100 000 établissements (chiffre exact non confirmé dans la documentation consultée — signalé incertain)
**Variables principales** : n° FINESS, raison sociale, catégorie d'établissement (code + libellé), adresse, coordonnées GPS (WGS84 + Mercator), précision du géocodage, n° FINESS juridique/géographique
**Niveau géographique** : Adresse précise (via géocodage BAN/BD-ADRESSE/IGN ADMIN-EXPRESS selon la qualité de l'adresse source)
**Qualité** : 8/10 — **Facilité d'intégration** : 7/10 — **Potentiel business** : 10/10

*Pourquoi c'est intéressant* : c'est LA colonne vertébrale de l'environnement sanitaire — un seul fichier couvre hôpitaux, cliniques, EHPAD, MSP, laboratoires, centres de santé via le code catégorie FINESS. *Intégration IA* : jointure spatiale (rayon 500m/1km/5km autour de chaque officine) pour créer des variables de densité par type d'établissement. *Croisements* : FINESS × RPPS (pour lier établissement et professionnels qui y exercent) × localisation officine (Ordre des pharmaciens/OSM). *Indicateurs* : nb d'EHPAD à moins de 2km, présence hôpital/clinique à moins de 5km, nb de laboratoires à proximité (proxy prescriptions d'analyses → parapharmacie/DM).

---

## 2. RPPS / Annuaire Santé — professionnels de santé (FHIR API)

**Nom** : Annuaire Santé — Extractions RPPS en libre accès
**URL** : https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps ; portail API : https://esante.gouv.fr/produits-services/repertoire-rpps ; API FHIR : https://annuaire.esante.gouv.fr/
**Organisme** : Agence du Numérique en Santé (ANS)
**Licence** : Licence Ouverte / Open Licence v2.0
**Description** : Identité professionnelle, spécialités, diplômes, mode d'exercice (libéral/salarié) et lieux d'exercice de tous les professionnels de santé RPPS (médecins, pharmaciens, dentistes, sages-femmes, pédicures-podologues + progressivement infirmiers)
**Type de données** : Annuaire professionnel géolocalisé (lié à FINESS pour les structures)
**Format** : Fichiers texte (3 fichiers, ~1,08 Go total) ; API REST FHIR R4 (ressources Practitioner, PractitionerRole, Organization, Location)
**API** : **Oui**, gratuite après inscription sur le portail OpenFHIR (clé API dans header `GRAVITEE-API-KEY`), sans frais d'abonnement ni de volume
**Mise à jour** : Quotidienne (dernier fichier vu : 03/07/2026)
**Historique** : Photo courante uniquement, pas d'archive
**Nb de lignes** : médecins 242 200 actifs (dont 101 000 généralistes, 141 200 spécialistes) au 01/01/2026 ; pharmaciens 75 300 ; chirurgiens-dentistes 48 700 ; pédicures-podologues 14 600 (source DREES démographie professionnels de santé — chiffres nationaux, pas encore ventilés par ligne du fichier RPPS lui-même)
**Variables principales** : identifiant RPPS, civilité, nom, catégorie/profession, spécialité, mode d'exercice, diplômes, lieu(x) d'exercice (lien FINESS)
**Niveau géographique** : Adresse du lieu d'exercice
**Qualité** : 8/10 — **Facilité d'intégration** : 7/10 (API FHIR nécessite un peu d'ingénierie) — **Potentiel business** : 10/10

*Pourquoi c'est intéressant* : c'est la seule source qui donne la **densité de médecins généralistes et spécialistes à l'adresse près**, variable la plus corrélée aux volumes de prescriptions d'une officine. *Intégration IA* : géocoder chaque lieu d'exercice, calculer un rayon de chalandise autour de chaque pharmacie, compter généralistes/spécialistes par spécialité (cardiologue, pédiatre, gynécologue = proxy typologie de patientèle). *Croisements* : RPPS × FINESS (praticien exerçant en clinique/MSP) × Open Medic CNAM (déjà connu du projet, prescriptions par médecin) pour affiner le potentiel de captation d'ordonnances. *Indicateurs* : nb généralistes/1km, ratio spécialistes/généralistes, présence pédiatre/gynéco (proxy patientèle familiale/maternité).

---

## 3. INSEE — Base Permanente des Équipements (BPE)

**Nom** : Base permanente des équipements
**URL** : https://www.data.gouv.fr/datasets/base-permanente-des-equipements-1 (et variante https://www.data.gouv.fr/datasets/base-permanente-des-equipements)
**Organisme** : INSEE
**Licence** : Licence Ouverte / Open Licence
**Description** : Recense chaque année (1er janvier) 188 types d'équipements/services répartis en 7 domaines : services aux particuliers, commerce, enseignement, santé-social, transports, sports-loisirs-culture, tourisme
**Type de données** : Équipements et services géolocalisés (incluant écoles, médecins, pharmacies, EHPAD, crèches en tant qu'items du domaine santé-social/éducation)
**Format** : CSV (fichiers par domaine et par niveau géo)
**API** : Oui indirectement — 43 réutilisations/API référencées sur data.gouv.fr, portail guides.data.gouv.fr
**Mise à jour** : Annuelle, publication par vagues quinquennales depuis 2018 pour l'historique long
**Historique** : Bon — remonte à plusieurs années, permet des séries temporelles
**Nb de lignes** : ordre de grandeur plusieurs millions d'enregistrements toutes catégories (non confirmé précisément)
**Variables principales** : type d'équipement (code BPE), commune, IRIS, coordonnées X/Y
**Niveau géographique** : Commune ET IRIS (infra-communal) — **le plus fin niveau statistique officiel disponible**
**Qualité** : 8/10 — **Facilité d'intégration** : 6/10 (fichiers volumineux par domaine, format à retravailler) — **Potentiel business** : 9/10

*Pourquoi c'est intéressant* : complète FINESS/RPPS avec une vision **par IRIS** (maille infra-communale) qui permet de croiser densité d'équipements et données socio-démographiques INSEE (revenus, âge, CSP) au même niveau géographique — impossible avec FINESS seul. *Intégration IA* : agréger par IRIS autour de chaque officine (rayon ou IRIS d'appartenance) le nombre d'équipements santé/éducation/social. *Croisements* : BPE × Filosofi (revenus par IRIS, déjà utile pour typologie clientèle) × FINESS (vérification croisée). *Indicateurs* : score de densité d'équipements normalisé par IRIS, comparaison officine urbaine/rurale.

---

## 4. Annuaire de l'Éducation Nationale (écoles, collèges, lycées, crèches scolaires)

**Nom** : API Annuaire de l'Éducation Nationale
**URL** : https://data.education.gouv.fr/api/v2 (dataset : https://www.data.gouv.fr/datasets/annuaire-de-leducation ; fiche API : https://www.data.gouv.fr/dataservices/672cf99047934b1400769eb6)
**Organisme** : Ministère de l'Éducation nationale
**Licence** : Licence Ouverte / Open Licence 2.0
**Description** : Caractéristiques et coordonnées de tous les établissements scolaires publics et privés (écoles maternelles/élémentaires, collèges, lycées, CIO)
**Type de données** : Établissements scolaires géolocalisés
**Format** : JSON via API REST
**API** : **Oui**, gratuite, sans authentification, endpoint `https://data.education.gouv.fr/api/v2`
**Mise à jour** : Quotidienne
**Historique** : Photo courante
**Nb de lignes** : >66 000 établissements
**Variables principales** : nom, type, public/privé, adresse complète, filières, effectifs, SIREN/SIRET, REP/REP+, code commune/postal/département
**Niveau géographique** : Adresse précise
**Qualité** : 9/10 — **Facilité d'intégration** : 9/10 (API simple, JSON, sans clé) — **Potentiel business** : 6/10

*Pourquoi c'est intéressant* : proxy direct de la **patientèle pédiatrique et familiale** autour d'une officine (poux, vaccins scolaires, pharmacie de quartier familial). *Intégration IA* : compter écoles maternelles/élémentaires dans un rayon de 500m-1km. *Croisements* : Annuaire éducation × BPE (crèches) × CAF (petite enfance) pour un score "famille avec enfants". *Indicateurs* : nb écoles primaires <500m, présence collège/lycée (ados = comportement d'achat différent), score "zone familiale".

---

## 5. Établissements d'accueil du jeune enfant (crèches) — CAF / data.caf.fr

**Nom** : Cafdata — Accueil du jeune enfant / Etablissements d'accueil de la Petite Enfance
**URL** : https://data.caf.fr/explore/ ; dataset national : https://www.data.gouv.fr/datasets/prestation-de-service-unique-donnees-des-eaje-accueil-du-jeune-enfant/
**Organisme** : CNAF (Caisse Nationale des Allocations Familiales)
**Licence** : Non confirmée précisément dans les pages consultées (probable Licence Ouverte, à vérifier sur data.caf.fr)
**Description** : Indicateurs d'activité des établissements d'accueil du jeune enfant (EAJE) financés par les CAF — crèches collectives, micro-crèches, haltes-garderies. Adresses disponibles via un dataset séparé de géolocalisation des EAJE.
**Type de données** : Structures petite enfance + taux de couverture par commune/département
**Format** : CSV, texte, cartes
**API** : Portail Opendatasoft (data.caf.fr) avec API standard Opendatasoft
**Mise à jour** : Annuelle (données à partir de 2016)
**Historique** : Depuis 2016
**Nb de lignes** : ordre de grandeur ~210 jeux de données au total sur le portail ; nb de crèches individuelles non confirmé
**Variables principales** : type de mode de garde, nb de places, taux de couverture, commune, département
**Niveau géographique** : Commune / département (adresse précise disponible sur un jeu séparé de géolocalisation EAJE — à vérifier au cas par cas, certains jeux locaux type "Crèches" sur data.gouv.fr ne sont que municipaux, ex. Ville d'Agen, qualité 33%)
**Qualité** : 6/10 (hétérogène, certains jeux locaux incomplets) — **Facilité d'intégration** : 6/10 — **Potentiel business** : 5/10

*Pourquoi c'est intéressant* : complète le signal "famille avec jeunes enfants" en amont des écoles (0-3 ans), pertinent pour les ventes de produits bébé/puériculture en pharmacie. *Intégration IA* : croiser avec Annuaire éducation pour un score petite-enfance complet. *Croisements* : CAF × BPE (petite enfance) × INSEE Filosofi (revenu des familles). *Indicateurs* : nb places crèche/1000 hab dans la zone, taux de couverture petite enfance local.

---

## 6. EHPAD, maisons de retraite, résidences autonomie

**Nom** : Etablissements pour personnes âgées (EHPAD, ESLD, résidences autonomie, accueils de jour)
**URL** : https://www.data.gouv.fr/datasets/etablissements-ehpad-esld-residences-autonomie-accueils-de-jour ; portail source : https://www.pour-les-personnes-agees.gouv.fr/annuaire-ehpad-et-maisons-de-retraite ; tarifs : https://www.data.gouv.fr/datasets/prix-hebergement-et-tarifs-dependance-des-ehpad
**Organisme** : CNSA / Ministère (portail pour-les-personnes-agees.gouv.fr), dérivé de FINESS
**Licence** : Licence Ouverte / Open Licence v2.0
**Description** : Liste, coordonnées et caractéristiques de tous les établissements pour personnes âgées (EHPAD médicalisés, ESLD, résidences autonomie, accueil de jour) avec statut juridique, capacité, tarifs
**Type de données** : Établissements géolocalisés + tarifs
**Format** : XLSX (3,7 Mo), CSV (9,1 Mo)
**API** : Oui — 4 réutilisations/API référencées, exploration possible via resultats-annuaire du portail
**Mise à jour** : Mise à jour signalée non conforme sur le jeu data.gouv.fr consulté (dernier connu : 11/11/2020) — **⚠️ à vérifier, source officielle pour-les-personnes-agees.gouv.fr semble plus à jour** (tarifs mis à jour au moins 1x/an avant le 30 juin via l'appli Prix-ESMS, répercutés en 48h)
**Historique** : Photo courante uniquement sur data.gouv.fr
**Nb de lignes** : non confirmé précisément (ordre de grandeur : ~7 500 EHPAD en France selon connaissance générale du secteur — **à vérifier**, pas confirmé par les sources consultées)
**Variables principales** : type (EHPAD/ESLD/RA/accueil jour), statut public/privé/associatif, capacité, tarifs hébergement/dépendance, unités Alzheimer, coordonnées
**Niveau géographique** : Adresse précise
**Qualité** : 7/10 — **Facilité d'intégration** : 7/10 — **Potentiel business** : 9/10

*Pourquoi c'est intéressant* : les EHPAD sont un **canal de vente direct majeur** pour une officine (marché captif de préparation de doses/médicaments, DM, orthopédie). *Intégration IA* : géolocaliser chaque EHPAD, croiser avec la capacité (nb de lits = volume potentiel) pour prioriser le démarchage commercial de l'officine. *Croisements* : EHPAD × FINESS (vérification doublon) × RPPS (médecins coordonnateurs). *Indicateurs* : nb de lits EHPAD dans un rayon de 3-5km, score "marché captif personnes âgées".

---

## 7. Maisons de santé pluriprofessionnelles (MSP)

**Nom** : Maisons de santé pluriprofessionnelles
**URL** : https://www.data.gouv.fr/datasets/maisons-de-sante-pluriprofessionnelles (jeu national agrégé, producteurs variés) ; exemples régionaux : Hauts-de-France (https://www.data.gouv.fr/datasets/maisons-de-sante-pluriprofessionnelles-en-hauts-de-france-2021-2023-2025), Isère (jeu consulté, opendata@isere.fr)
**Organisme** : Fragmenté — Conseils départementaux, ARS régionales, DGOS (Observatoire des recompositions de l'offre de soins) au niveau national
**Licence** : Licence Ouverte / Open Licence v2.0 (majorité des jeux régionaux)
**Description** : Localisation des structures d'exercice coordonné pluriprofessionnel (MSP), centres de santé, pôles de santé
**Type de données** : Structures géolocalisées, type de structure, entité gestionnaire
**Format** : CSV, JSON, ZIP (selon producteur)
**API** : Variable selon le jeu régional — pas d'API nationale unifiée identifiée avec certitude ; **⚠️ pas de dataset national FINESS-like unique confirmé** — la donnée est éclatée entre data.gouv.fr régional et ARS (ex. cartographies PAPS régionales : hauts-de-france.paps.sante.fr)
**Mise à jour** : Variable (Hauts-de-France : 2021-2023-2025, triennal)
**Historique** : Variable selon région
**Nb de lignes** : national ~2 251 MSP fin 2022 (source DGOS/Observatoire, citée dans la littérature) ; annuaire privé ma-msp.com annonce 3 029 MSP (non officiel, à vérifier)
**Variables principales** : localisation, type de structure, gestionnaire, professions présentes
**Niveau géographique** : Adresse précise (par jeu régional)
**Qualité** : 5/10 (données fragmentées, pas de source nationale unique fiable identifiée) — **Facilité d'intégration** : 4/10 — **Potentiel business** : 8/10

*Pourquoi c'est intéressant* : une MSP à proximité signale une offre de soins de premier recours structurée et souvent une patientèle stable, avec potentiel de coordination pharmacien-MSP (bilans partagés de médication, télémédecine). *Intégration IA* : à défaut de source nationale fiable, **agréger les jeux régionaux data.gouv.fr + FINESS** (les MSP ont aussi une catégorie FINESS) pour reconstituer une couverture nationale — **FINESS reste probablement la meilleure source unique pour les MSP** (catégorie établissement dédiée) plutôt que les jeux régionaux épars. *Croisements* : MSP × RPPS (professionnels y exerçant) × FINESS. *Indicateurs* : présence MSP <1km, nb de professions différentes dans la MSP la plus proche.

---

## 8. Liste des maternités de France (depuis 2000)

**Nom** : Liste des maternités de France
**URL** : https://data.drees.solidarites-sante.gouv.fr/explore/dataset/fichier_maternites_112021/ (mise à jour 2023 : https://drees.solidarites-sante.gouv.fr/communique-de-presse-jeux-de-donnees/241219_Data_liste-des-maternites-de-france)
**Organisme** : DREES (Ministère de la Santé), source SAE (Statistique Annuelle des Établissements de santé)
**Licence** : Non explicitement confirmée sur la page (portail DREES, généralement Licence Ouverte)
**Description** : Toutes les maternités de France au 31 décembre, pour 2000 et 2008-2024, avec adresse, nb de lits, nb d'accouchements, type (1/2a/2b/3 selon plateau technique néonat/réa)
**Type de données** : Établissements + activité
**Format** : Non précisé (probable CSV/Excel via portail DREES OpendataSoft)
**API** : Oui, mentionnée en pied de page du portail data.drees (`/api/`)
**Mise à jour** : Annuelle (dernier point : 31/12/2024)
**Historique** : **Excellent** — série 2000, 2008-2024 (16+ ans), rare pour ce type de donnée
**Nb de lignes** : ordre de grandeur ~400-450 maternités actives en France (nombre en baisse continue depuis 2000, non confirmé précisément dans les sources)
**Variables principales** : type (1/2a/2b/3), nb lits, nb d'accouchements/an, adresse
**Niveau géographique** : Adresse précise
**Qualité** : 9/10 (série longue et fiable, DREES) — **Facilité d'intégration** : 7/10 — **Potentiel business** : 7/10

*Pourquoi c'est intéressant* : présence d'une maternité à proximité = **signal fort de patientèle jeunes parents/nourrissons** (lait infantile, DM bébé, produits maternité). *Intégration IA* : distance à la maternité la plus proche + son volume d'accouchements/an comme proxy du bassin de naissances. *Croisements* : Maternités × Annuaire éducation (écoles maternelles) × CAF (crèches) pour un score "cycle de vie familial" complet.

---

## 9. Laboratoires de biologie médicale

**Nom** : Laboratoires de biologie médicale
**URL** : https://www.data.gouv.fr/datasets/laboratoires-de-biologie-medicale-idf (Île-de-France, source FINESS 2013 — ancien) ; https://www.data.gouv.fr/datasets/laboratoires-de-biologie-medicale/ ; cartographie nationale : AtlaSanté "Offre de biologie médicale" (https://www.atlasante.fr/accueil/nos_cartes/653_576/loffre_de_biologie_medicale)
**Organisme** : FINESS (extraction), régions variées, AtlaSanté pour la cartographie
**Licence** : Licence Ouverte (héritée de FINESS)
**Description** : Localisation des laboratoires d'analyses médicales, extraits de FINESS
**Type de données** : Établissements géolocalisés
**Format** : CSV
**API** : Non confirmée en direct — passe par extraction FINESS générale (catégorie établissement dédiée)
**Mise à jour** : Jeux régionaux souvent obsolètes (IDF : 2013) ; **⚠️ recommandation : utiliser l'extraction FINESS nationale directement plutôt que ces jeux régionaux figés**, en filtrant sur la catégorie FINESS "laboratoire de biologie médicale"
**Historique** : Faible sur les jeux dédiés, meilleur via FINESS brut
**Nb de lignes** : non confirmé (ordre de grandeur quelques milliers de sites en France)
**Variables principales** : n° FINESS, adresse, statut
**Niveau géographique** : Adresse précise
**Qualité** : 5/10 (jeux dédiés souvent anciens) — **Facilité d'intégration** : 6/10 (mieux vaut repartir de FINESS) — **Potentiel business** : 6/10

*Pourquoi c'est intéressant* : un laboratoire à proximité génère un flux d'ordonnances de contrôle biologique et de patients récurrents. *Intégration IA* : ne pas utiliser les jeux régionaux obsolètes — filtrer FINESS national sur la catégorie labo. *Croisements* : Labos × RPPS (biologistes médicaux) × FINESS.

---

## 10. Sirene INSEE (établissements par code NAF — cabinets infirmiers, kinés, dentistes, etc.)

**Nom** : Base Sirene des entreprises et de leurs établissements (SIREN/SIRET) + API Sirene / Annuaire des entreprises
**URL** : https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret ; API : https://api.insee.fr (catalogue https://portail-api.insee.fr) ; interface simplifiée : https://annuaire-entreprises.data.gouv.fr/
**Organisme** : INSEE
**Licence** : Licence Ouverte / Open Licence
**Description** : Répertoire exhaustif des entreprises et établissements français (25M entreprises, 36M établissements), avec code NAF/APE permettant d'isoler cabinets infirmiers (NAF 86.90A/F), cabinets dentaires, kinésithérapeutes, etc. — comble les trous de FINESS pour le libéral hors FINESS
**Type de données** : Établissements géolocalisés (via géocodage BAN) avec activité économique
**Format** : CSV volumineux (stock complet) + API JSON
**API** : **Oui**, gratuite après inscription sur le portail INSEE, mise à jour quotidienne, endpoint recherche géolocalisée "500 établissements les plus proches par SIRET"
**Mise à jour** : Quotidienne
**Historique** : Historique des SIRET disponible (création, cessation)
**Nb de lignes** : ~36 millions d'établissements (dont un sous-ensemble santé/social à filtrer par NAF)
**Variables principales** : SIREN/SIRET, dénomination, code NAF/APE, adresse, coordonnées, date de création, effectif (tranche)
**Niveau géographique** : Adresse précise
**Qualité** : 9/10 — **Facilité d'intégration** : 7/10 (gros volume, filtrage NAF nécessaire) — **Potentiel business** : 8/10

*Pourquoi c'est intéressant* : **seule source qui capture les cabinets infirmiers libéraux exhaustivement** (FINESS et RPPS ont des lacunes documentées sur les infirmiers). Permet aussi de détecter kinés, dentistes, sages-femmes libérales via NAF. *Intégration IA* : filtrer les codes NAF de la santé (section Q, divisions 86-88) autour de chaque officine. *Croisements* : Sirene × RPPS (croisement pour fiabiliser la présence de professionnels de santé) × FINESS. *Indicateurs* : densité de cabinets infirmiers/1km (proxy soins à domicile → forte activité pharmacie), densité kinés/dentistes.

---

## 11. Infrastructures géographiques transverses (indispensables mais pas des "établissements")

**a) Base Adresse Nationale (BAN) — géocodage**
URL : https://adresse.data.gouv.fr/ (API historique décommissionnée fin janvier 2026, migration vers IGN : https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage). Gratuit, illimité, licence ouverte, 50 req/s/IP. Indispensable pour géocoder toutes les adresses d'officines et d'établissements avant tout calcul de distance.

**b) API Découpage administratif (API Géo)**
URL : https://geo.api.gouv.fr/decoupage-administratif — Gratuit, JSON/GeoJSON, sans clé, permet de résoudre commune/EPCI/département/région à partir de coordonnées — utile pour agréger les indicateurs par maille administrative en plus du rayon métrique.

**c) OpenStreetMap / Overpass API — alternative crowdsourcée**
- Overpass API : https://wiki.openstreetmap.org/wiki/Overpass_API — requêtes libres sur tags `amenity=pharmacy/doctors/hospital/clinic/dentist/nursing_home`, gratuit, licence ODbL (attribution requise)
- Dataset prêt à l'emploi (mis à jour hebdomadairement) : "Établissements de santé - France" par Opendatasoft — https://public.opendatasoft.com/explore/dataset/osm-france-healthcare/
- **Localisation des pharmacies dans OpenStreetMap** : https://www.data.gouv.fr/datasets/localisation-des-pharmacies-dans-openstreetmap — extraction quotidienne des pharmacies de métropole depuis OSM, publiée sur data.gouv.fr — **directement utile pour géolocaliser le référentiel des officines elles-mêmes et leurs concurrentes**, en complément/vérification de FINESS
Qualité 6/10 (complétude variable selon zones), Facilité d'intégration 8/10 (API simple), Potentiel business 6/10 — utile en **fallback/vérification croisée** de FINESS plutôt que source primaire (FINESS et RPPS restent plus fiables et exhaustifs pour le sanitaire officiel).

---

## 12. AtlaSanté / C@rtoSanté — cartographie ARS

**Nom** : C@rtoSanté (portail AtlaSanté)
**URL** : https://www.atlasante.fr/accueil ; observatoire des professionnels : C@rtoSanté
**Organisme** : Consortium des ARS (Agences Régionales de Santé)
**Licence** : Variable selon couche (certaines cartes à accès restreint réservé aux ARS — ex. Cart'eaux)
**Description** : Portail géographique centralisant les données de santé des ARS, cartographie de la démographie des professionnels de santé libéraux (généralistes, kinés, dentistes, infirmiers, orthophonistes) par territoire
**Type de données** : Cartes/indicateurs agrégés, pas toujours des données brutes exportables
**Format** : Cartes interactives (WMS/WFS potentiel), export limité pour le grand public
**API** : Non systématiquement documentée pour usage grand public — plutôt un portail de consultation
**Qualité** : 6/10 — **Facilité d'intégration** : 4/10 (beaucoup de couches à accès restreint ARS) — **Potentiel business** : 5/10

*Pourquoi c'est intéressant* : utile pour **valider/enrichir visuellement** les indicateurs calculés à partir de FINESS/RPPS, mais moins exploitable en pipeline automatisé que les données brutes → à traiter comme source de vérification, pas source primaire d'ingestion.

---

## Synthèse — quelles sources combiner en priorité et quels indicateurs composites créer

### Priorité d'intégration (du plus au moins critique)
1. **FINESS** (colonne vertébrale établissements — hôpitaux, cliniques, EHPAD, MSP, labos, centres de santé en un seul référentiel)
2. **RPPS/Annuaire Santé** (API FHIR gratuite — densité médecins généralistes/spécialistes, lien établissement-praticien)
3. **BAN** (géocodage — brique technique indispensable pour tout calcul de distance)
4. **Sirene INSEE** (comble les trous de FINESS/RPPS sur le libéral hors nomenclature RPPS stricte : infirmiers, kinés)
5. **INSEE BPE** (maille IRIS — permet de croiser avec les données socio-démographiques déjà présentes dans le projet)
6. **Annuaire Éducation + CAF petite enfance + Maternités DREES** (proxy typologie familiale/pédiatrique)
7. **EHPAD (pour-les-personnes-agees.gouv.fr)** (marché captif personnes âgées, fort ROI commercial)
8. OSM/Overpass en vérification croisée et fallback si FINESS incomplet localement

### Indicateurs composites à créer pour le copilote IA
- **Score de densité médicale** : nb généralistes / nb spécialistes par spécialité dans un rayon de 500m/1km/3km (pondéré par distance)
- **Score "marché captif seniors"** : nb de lits EHPAD/ESLD à proximité, pondéré par distance et capacité
- **Score "cycle de vie familial"** : combinaison maternités (distance + volume accouchements) + crèches + écoles maternelles/primaires dans la zone
- **Score de coordination des soins** : présence MSP/centre de santé à proximité (patientèle structurée, opportunités bilan partagé de médication)
- **Score infirmier/soins à domicile** : densité cabinets infirmiers (Sirene NAF) — proxy fort de la patientèle âgée/dépendante non-EHPAD, très corrélé aux ventes de matériel médical et pansements
- **Typologie de zone** (urbain dense / MSP rurale / zone EHPAD / zone familiale) obtenue par clustering des indicateurs ci-dessus, pour prédire un **profil de patientèle attendu** et orienter les recommandations d'achat/stock du pharmacien (ex. zone EHPAD → stock incontinence/perfusion ; zone maternité/écoles → stock pédiatrique/puériculture ; forte densité généralistes → volume d'ordonnances élevé mais marge concurrentielle).

**Limite méthodologique à documenter dans le pipeline** : les MSP et labos n'ont pas de source nationale unique et à jour fiable identifiée hors FINESS lui-même — traiter FINESS comme référentiel maître pour ces deux catégories plutôt que les jeux régionaux dispersés trouvés sur data.gouv.fr, qui sont souvent obsolètes (ex. labos IDF datés de 2013) ou incomplets par construction (couverture départementale seulement).

---

# AGENT 9 — Data Lake Pharmacie France : PARAPHARMACIE (cosmétique, bébé, nutrition/compléments, sport, micronutrition, phytothérapie, huiles essentielles, dispositifs médicaux)

**Constat de méthode avant les sources** : contrairement au médicament remboursable (Open Medic très riche), il n'existe **aucune base publique de sell-out parapharmacie en France** (pas d'équivalent gratuit à GERS/IQVIA/OpenHealth qui, eux, sont **100% payants et sous licence commerciale**, prix sur devis, plusieurs dizaines de k€/an). Le gratuit se trouve donc en **périphérie** : régulation/vigilance, déclarations obligatoires, douanes/production, budgets des ménages, et rapports sectoriels publiés par syndicats professionnels. Ce sont des **proxys**, pas du sell-out officine granulaire — mais croisés intelligemment ils permettent de reconstruire des tendances et des priorités catégorielles.

---

## A. DISPOSITIFS MÉDICAUX (la vraie pépite gratuite du secteur — orthopédie, maintien, pansements, optique, compression, autotests...)

**1. Open LPP** | https://www.data.gouv.fr/datasets/open-lpp-base-complete-sur-les-depenses-de-dispositifs-medicaux-inscrits-a-la-liste-de-produits-et-prestations-lpp-interregimes | CAISSE NATIONALE DE L'ASSURANCE MALADIE (CNAM) | Licence Ouverte / Etalab | Base complète des dépenses de dispositifs médicaux inscrits à la LPP (Liste des Produits et Prestations), extraite du SNDS | Remboursements + quantités | CSV | Non (téléchargement fichiers, pas d'API REST) | Annuelle | 2014-2024 | Millions de lignes agrégées | Code LPP fin, montant remboursé, montant remboursable, nb bénéficiaires, âge, sexe, région, spécialité du prescripteur | National + régional | 9/10 | 6/10 (nomenclature LPP complexe à mapper) | 9/10
*C'est LA base gratuite la plus proche d'un sell-out parapharma : compression veineuse, pansements, orthèses, autotests glycémie/diagnostics, matériel de maintien à domicile — tout ce qui est remboursable en LPP passe par le pharmacien. Permet de calculer des indices de demande par région/âge, de croiser avec la démographie (vieillissement = orthopédie/incontinence) et de détecter les catégories en forte croissance à stocker prioritairement.*

**2. Évaluation des dispositifs médicaux (avis CNEDiMTS)** | https://www.data.gouv.fr/datasets/evaluation-des-dispositifs-medicaux et https://www.has-sante.fr/jcms/c_419486/fr/commission-nationale-d-evaluation-des-dispositifs-medicaux-et-des-technologies-de-sante | Haute Autorité de Santé (HAS) | Licence Ouverte | Avis d'évaluation clinique et de remboursement des DM (Service Attendu, ASA) | Avis PDF + métadonnées | CSV/PDF | Non | Continue | Historique complet depuis création CNEDiMTS | Milliers d'avis | Nom DM, fabricant, indication, SA/ASA, date avis | National | 8/10 | 5/10 | 6/10
*Utile pour anticiper l'arrivée de nouveaux DM remboursables (donc futurs produits à référencer) et pour argumenter scientifiquement le conseil pharmacien sur un DM.*

**3. data.ansm (plateforme ruptures & pharmacovigilance)** | https://data.ansm.sante.fr/ | ANSM | Licence Ouverte | Historique des ruptures de stock, pharmacovigilance, erreurs médicamenteuses (médicament essentiellement, DM connexes marginaux) | Données agrégées | Interface web + export | Partiel | Continue depuis 2014 | 10+ ans | Milliers d'événements | Molécule, motif rupture, dates | National | 7/10 | 6/10 | 5/10 (surtout utile en médicament, pas cœur parapharma)

---

## B. COMPLÉMENTS ALIMENTAIRES / MICRONUTRITION / NUTRITION SPORTIVE

**4. Déclarations de compléments alimentaires (Compl'Alim, ex-Téléicare)** | https://www.data.gouv.fr/datasets/declarations-de-complements-alimentaires | DGAL (ex-DGCCRF) — Ministère de l'Économie/Agriculture | Licence Ouverte | Liste exhaustive de tous les compléments alimentaires ayant obtenu une attestation de déclaration de mise sur le marché en France | Fichier structuré | CSV | Non documentée publiquement (export périodique) | Mensuelle/trimestrielle | Depuis 2016 (2016-2025 Téléicare, puis Compl'Alim depuis sept. 2025) | Centaines de milliers de déclarations | Nom produit, fabricant/distributeur, composition (nutriments/plantes/substances), forme galénique, allégations, date déclaration | National | 9/10 | 7/10 | 9/10
*C'est LA base gratuite reine pour cartographier tout le marché des compléments alimentaires vendus légalement en France (marque, composition, dosages). Croisée avec les tendances de recherche et les rapports Synadiet, elle permet de construire un moteur de recommandation de gamme et de repérage de niches (probiotiques, mélatonine, magnésium, collagène) avant qu'elles saturent.*

**5. Nutrivigilance — rapports d'activité** | https://www.anses.fr/system/files/Anses-RA2024-Nutrivigilance.pdf (et RA2022, RA2020-21) | ANSES | Publication libre (pas de dataset brut téléchargeable identifié) | Signalements d'effets indésirables liés aux compléments alimentaires, alicaments, novel foods | Rapports PDF avec tableaux chiffrés | PDF | Non | Annuelle | Depuis 2009 (~1000 signalements/an, 5000+ cumulés) | Milliers de cas | Type de complément, ingrédient en cause, gravité, plante/substance | National | 7/10 | 3/10 (PDF non structuré, à parser) | 7/10
*Permet d'identifier les ingrédients/plantes à risque (ex : substances à base de plantes stimulantes, mélatonine à forte dose) — utile pour un module d'alerte/conseil sécurité dans le copilote IA, et pour anticiper des retraits réglementaires avant qu'ils arrivent (levier achat/stock).*

**6. DGCCRF — Bilans de contrôle des compléments alimentaires** | https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-enquetes-et-les-controles/complements-alimentaires-des-anomalies-encore-trop-nombreuses | DGCCRF | Publication libre | Résultats d'enquêtes sectorielles (2023 : 270 établissements contrôlés, 71 injonctions) | Rapport PDF/web | HTML/PDF | Non | Ponctuelle (par vague d'enquête) | Séries d'enquêtes 2015-2025 | N/A (agrégé) | Taux de non-conformité, allégations santé interdites, type d'anomalie | National | 6/10 | 3/10 | 6/10

**7. Synadiet — Observatoire du marché des compléments alimentaires** | https://www.synadiet.org/observatoire-2024-et-chiffres-du-marche-2023-des-complements-alimentaires/ et https://www.synadiet.org/les-complements-alimentaires/leur-consommation/ | SYNADIET (syndicat professionnel) | Publication libre (partie), étude complète parfois réservée adhérents | Baromètre annuel de consommation (Toluna/Harris Interactive) + chiffres de marché (CA global, répartition par canal, par indication) | Communiqués + infographies chiffrées | HTML/PDF | Non | Annuelle | Historique depuis ~2018 | N/A (agrégé) | CA marché (2,9-3 Md€ en 2024-25), part pharmacie 55%, top indications (sommeil 382,6M€, vitalité/immunité 263,8M€, digestion 262,6M€) | National | 8/10 | 4/10 (chiffres agrégés, pas microdonnées) | 9/10
*Chiffres directement exploitables pour prioriser les indications à mettre en avant en officine (le trio sommeil/vitalité/digestion pèse 60% du marché pharmacie) — excellent complément qualitatif à la base brute Compl'Alim.*

**8. Xerfi — Le marché de la nutrition sportive** | https://www.xerfi.com/presentationetude/le-marche-de-la-nutrition-sportive_IAA60 | Xerfi | **PAYANT** (étude sectorielle, prix sur devis, généralement 1500-3000€/étude) | Analyse marché nutrition sportive France (whey, protéines, endurance) | Rapport PDF | PDF | Non | Annuelle | N/A | N/A | CA marché (~1 Md€ France), segmentation musculation/endurance (70/30) | National | 8/10 | 2/10 (payant, non réutilisable en base) | 6/10 (utile en veille ponctuelle, pas en pipeline data)

---

## C. COSMÉTIQUE / DERMOCOSMÉTIQUE (la plus grosse famille en valeur)

**9. Open Beauty Facts** | https://www.data.gouv.fr/datasets/open-beauty-facts | Open Food Facts (association, communauté mondiale) | Open Database License (ODbL) + CC-BY-SA pour images | Base collaborative mondiale de produits cosmétiques : ingrédients (INCI), labels (bio, vegan, cruelty-free), catégories, codes-barres | Export complet + fiches produit | JSONL/CSV/Parquet/MongoDB dump | **Oui** — API REST v2 (`/api/v2/product/[code].json`, `/api/v2/search`), SDK JS/Python/PHP/Ruby/Rust/Swift/Kotlin/Java | Continue (mises à jour communautaires quotidiennes) | Depuis 2016 | Centaines de milliers de produits (mondial), dizaines de milliers France | Code-barres, nom, marque, catégorie, liste INCI, labels, origine, photo packaging | Mondial (filtrable France) | 7/10 (couverture francophone bonne mais incomplète vs Open Food Facts) | 9/10 (API prête à l'emploi, gratuite, sans clé) | 8/10
*Le seul "catalogue produit" cosmétique gratuit et structuré au monde — parfait pour enrichir automatiquement une fiche produit parapharmacie (ingrédients, allergènes, labels) sans ressaisie manuelle, et pour scorer la "clean beauty" d'un référencement.*

**10. CosIng (Cosmetic Ingredients Database)** | https://ec.europa.eu/growth/tools-databases/cosing/ (miroir structuré : https://github.com/biobricks-ai/cosing-kg) | Commission Européenne (DG GROW) | Réutilisation libre (données publiques UE) | Glossaire officiel de ~15 000 ingrédients cosmétiques (noms INCI, CAS/EINECS, statut réglementaire, restrictions, interdictions) | Base consultable en ligne + extraction possible | HTML/scraping (export GitHub tiers en base structurée) | Non (pas d'API officielle, scraping toléré) | Continue | Depuis 1976 (historique complet actif/inactif) | ~15 000 ingrédients | Nom INCI, CAS, fonction, restriction (annexe II/III/IV/V/VI), statut | Union Européenne | 9/10 (référentiel officiel) | 6/10 (pas d'API native, nécessite scraping ou dataset tiers GitHub) | 7/10
*Permet de construire un moteur de vérification de conformité/sécurité ingrédients (utile pour un module "cette crème contient-elle un perturbateur suspecté ?" dans le copilote), et de croiser avec Open Beauty Facts pour enrichir chaque produit.*

**11. Safety Gate (ex-RAPEX) — Alertes produits dangereux UE** | https://ec.europa.eu/safety-gate-alerts/ (miroir opendatasoft : https://public.opendatasoft.com/explore/dataset/healthref-europe-rapex-fr/) | Commission Européenne (DG Justice & Consommateurs) | Réutilisation libre | Alertes de sécurité sur produits non-alimentaires dangereux (cosmétiques, jouets, puériculture...) notifiées par 31 pays | Fiches d'alerte | JSON/CSV via API tierce | Oui (API opendatasoft) | Hebdomadaire | Depuis 1984 (rebaptisé 2018) | Dizaines de milliers d'alertes cumulées | Produit, marque, pays notifiant, risque, mesure prise, catégorie | Union Européenne (filtrable France) | 8/10 | 8/10 | 6/10
*Système d'alerte précoce européen — permet un module de veille automatique "produit dangereux détecté en Europe" avant même le relais RappelConso français, utile pour la puériculture et les cosmétiques importés.*

**12. RappelConso V2** | https://www.data.gouv.fr/datasets/rappelconso-v2-rappels-de-produits + API : https://data.economie.gouv.fr/explore/dataset/rappelconso-v2-gtin-trie/api/ | DGCCRF | Licence Ouverte | Tous les rappels de produits en France (cosmétiques, compléments alimentaires, DM, puériculture — hors médicaments/DM stricts qui restent à l'ANSM) | Fiches rappel structurées | JSON/CSV | **Oui**, API sans clé, GTIN/EAN-13 obligatoire depuis 2026 | Quotidienne | Depuis 2021 | Milliers de rappels | Nom produit, GTIN, catégorie, motif, risque, date, distributeurs, zone géographique de vente | National | 9/10 | 9/10 (API propre, GTIN = clé de jointure avec catalogues produits) | 8/10
*Excellent pour un module d'alerte automatique côté officine ("un produit que vous vendez vient d'être rappelé") — le GTIN permet un matching direct avec le stock du pharmacien, cas d'usage concret et immédiatement vendable.*

**13. FEBEA — Chiffres clés du marché cosmétique** | https://www.febea.fr/le-secteur-cosmetique/chiffres-cles-du-marche-cosmetique | Fédération des Entreprises de la Beauté | Publication libre | CA sectoriel France (35,6 Md€ en 2024), export (22,4 Md€), emploi (300 000), balance commerciale | Communiqués + infographies | HTML/PDF | Non | Annuelle/semestrielle | Historique remontant à plusieurs années | N/A (agrégé) | CA, export, emploi, structure des adhérents (PME/ETI/GE) | National | 8/10 | 4/10 | 8/10

**14. Cosmetic Valley — Chiffres clés** | https://www.cosmetic-valley.com/en/basic-page/key-figures | Pôle de compétitivité Cosmetic Valley | Publication libre | Filière cosmétique française : 6 300 établissements, 226 000 emplois, 71 Md€ de CA, 500 projets R&D | Rapport/infographie | PDF/HTML | Non | Annuelle | Depuis 1994 (30 ans d'historique) | N/A | CA, emploi, export, R&D | National + régional (Centre-Val de Loire, Normandie, Bretagne) | 7/10 | 4/10 | 6/10

**15. Eurostat Prodcom (production manufacturée)** | https://ec.europa.eu/eurostat/fr/web/prodcom/database | Eurostat | Licence Eurostat (réutilisation libre avec attribution) | Statistiques de production industrielle par code produit (NACE/CPA), incluant parfums, cosmétiques, savons | Base statistique | CSV/API SDMX | **Oui** — API Eurostat officielle | Annuelle (publication juillet N+1) | Longue série historique (10-20 ans) | Milliers de lignes (code produit × pays × année) | Valeur production, volume, code CPA, pays | UE + national | 8/10 | 7/10 (API standard SDMX bien documentée) | 7/10
*Permet de suivre la production française de cosmétiques/parfums dans le temps (poids économique du secteur, spécialisation régionale) — utile en tableau de bord macro pour situer le marché officine dans le contexte industriel national.*

**16. INSEE — Consommation des ménages / apparence physique / indices de prix hygiène-beauté** | https://www.insee.fr/fr/statistiques/2892821 (parfums) ; https://www.insee.fr/fr/statistiques/2550287 (dépenses apparence physique) ; https://www.insee.fr/fr/statistiques/serie/001763803 (IPC hygiène/beauté COICOP 12.1.3.2) ; https://www.insee.fr/fr/statistiques/8210847 (consommation ménages 2023) | INSEE | Licence Ouverte Etalab | Poids budgétaire des ménages en hygiène/beauté/parapharmacie, indices de prix mensuels | Séries statistiques | CSV/API | **Oui** — API INSEE (BDM/Melodi) | Mensuelle (IPC) / annuelle (comptes) | Longues séries (parfois depuis 1960) | Séries temporelles (centaines de points) | Indice prix, poste COICOP, dépense par ménage | National | 9/10 (source officielle fiable) | 8/10 (API stable et documentée) | 7/10
*Permet de construire un indicateur macro de pouvoir d'achat parapharmacie des ménages français et de corréler avec les cycles d'achat en officine (inflation vs volumes) — utile pour du pricing dynamique conseillé par l'IA.*

**17. DGCCRF — Bilan des contrôles cosmétiques (Congrès Cosmed 2026)** | https://www.cnep-france.fr/UPB/wp-content/uploads/2025/03/BILAN-DES-CONTROLES-DE-LA-DGCCRF-2024.pdf et page officielle https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-enquetes/controle-des-produits-cosmetiques | DGCCRF | Publication libre | Résultats détaillés des contrôles cosmétiques 2024-2025 : 1 674 visites, 1 332 établissements, 5 600 produits contrôlés ; anomalies étiquetage (25%), DIP incomplet (22%), non-notification CPNP, allégations non conformes (46%) | Rapport PDF chiffré | PDF | Non | Annuelle | Séries d'enquêtes pluriannuelles | N/A (agrégé) | Taux d'anomalies par thème (nanomatériaux 23%, solaires 24%) | National | 7/10 | 3/10 | 6/10

**18. Statista — Cosmetics market Europe** | https://www.statista.com/topics/7382/cosmetics-market-in-europe/ | Statista | **Freemium/PAYANT** (quelques chiffres gratuits, rapports complets payants ~) | Taille de marché, segmentation, prévisions Europe/France | Infographies + rapports | HTML/PDF | Non | Annuelle | Séries 2012-2023+ | N/A | CA marché par pays/segment | Europe | 6/10 (chiffres non vérifiables en source primaire) | 3/10 | 5/10

**19. Xerfi — Le marché de la parapharmacie** | https://www.xerfi.com/presentationetude/le-marche-de-la-parapharmacie_DIS19 | Xerfi | **PAYANT** (étude sectorielle sur devis) | Analyse structurelle du marché parapharmacie France : ~7 Md€, répartition pharmacies (69%)/parapharmacies (19%)/GSA (12%), croissance +5%/an, recul du nombre de parapharmacies physiques (-15% depuis 2020) | Rapport PDF | PDF | Non | Annuelle | N/A | N/A | CA, canaux de distribution, croissance | National | 8/10 | 2/10 | 7/10 (chiffres qualitatifs très utiles en pitch/stratégie même sans microdonnées)

---

## D. PHYTOTHÉRAPIE / HUILES ESSENTIELLES

**20. ANSM — Pharmacopée française : listes A et B des plantes médicinales** | https://ansm.sante.fr/qui-sommes-nous/notre-perimetre/les-medicaments/p/medicaments-a-base-de-plantes-et-huiles-essentielles | ANSM | Publication réglementaire libre | Liste officielle des 454 plantes médicinales (dont 148 en vente libre hors monopole pharmaceutique), monographies | Listes PDF/texte réglementaire | PDF | Non | Mise à jour réglementaire ponctuelle (dernière évolution majeure 2013, comité 2026) | Historique réglementaire complet | 454 plantes | Nom plante, statut monopole/hors-monopole, usage traditionnel (européen/chinois/ayurvédique) | National | 8/10 (référentiel officiel) | 4/10 (texte réglementaire à structurer soi-même) | 6/10
*Base de vérité réglementaire indispensable pour qu'un copilote IA sache quelles plantes/huiles essentielles un pharmacien peut vendre librement vs réserver au monopole — sécurité juridique du conseil.*

---

## E. BÉBÉ / PUÉRICULTURE (proxy démographique)

**21. INSEE — Naissances et taux de natalité** | https://www.insee.fr/fr/statistiques/2381380 | INSEE | Licence Ouverte Etalab | Naissances mensuelles/annuelles, taux de natalité, âge moyen des mères | Séries statistiques | CSV/API | Oui (API INSEE) | Mensuelle | Longue série (depuis 1982+) | Séries temporelles | Nb naissances, taux natalité, région | National + départemental | 9/10 | 8/10 | 7/10
*Proxy direct et gratuit de la taille du marché de la puériculture/parapharmacie bébé — la chute des naissances en France explique mécaniquement le recul du marché bébé (FJP/Xerfi), donc un indicateur avancé fiable pour dimensionner le stock lait infantile/soins bébé par bassin de vie.*

**22. FJP — Chiffres clés du marché de la puériculture** | https://www.fjp.fr/les-secteurs-de-la-puericulture-et-du-jouet/le-secteur-de-la-puericulture/chiffres-cles-du-marche-de-la-puericulture/ | Fédération Française des Industries Jouet-Puériculture (FJP) | Publication libre | CA marché puériculture France, évolution volume/valeur | Rapport/infographie | HTML/PDF | Non | Annuelle | Plusieurs années | N/A | CA marché (2,6 Md€), évolution -5 à -7% récente | National | 7/10 | 3/10 | 6/10

---

## F. INDICATEURS ÉCONOMIQUES OFFICINE (part de la parapharmacie dans le CA pharmacie)

**23. Interfimo / Extencia / Fiducial — Observatoires économiques de l'officine** | https://www.interfimo.fr/etudes/prix-pharmacien,15 ; https://www.extencia.fr/pharmacie-chiffres-cles-ratios-gestion-2026 ; https://www.fiducial.fr/Pharmacie/Comptabilite-et-gestion-de-votre-pharmacie/L-Observatoire-FIDUCIAL-des-pharmaciens | Cabinets d'expertise-comptable spécialisés pharmacie | Publication libre (articles), études complètes parfois payantes | Ratios de gestion officine : CA moyen (2,655 M€ en 2025), marge brute (27,57%), EBE (10,06%), écart de marge entre officine "parapharmacie" (>30%) et officine "médicaments chers" (<25%) | Articles/rapports chiffrés | HTML/PDF | Non | Annuelle | Séries pluriannuelles | N/A (agrégé, panels d'expertise-comptable) | CA, marge, EBE par typologie d'officine | National (parfois régional) | 7/10 | 3/10 | 8/10
*Donnée clé pour le pitch business : elle prouve chiffres à l'appui que la parapharmacie est le principal levier de marge du pharmacien (>30% vs <25%) — argument central pour vendre une fonctionnalité IA d'optimisation de l'assortiment parapharma.*

---

## Ce qui N'EXISTE PAS en gratuit (confirmé après recherche approfondie)

- **Sell-out parapharmacie par référence/officine** : uniquement GERS (panel officinal, payant, coût élevé à 5 chiffres/an), IQVIA et OpenHealth (mêmes ordres de grandeur tarifaires, abonnement B2B). Aucun équivalent public.
- **Cosmétovigilance structurée en open data** : la mission est passée à l'ANSES au 1er janvier 2024 mais aucun dataset public agrégé n'a été identifié (contrairement à la pharmacovigilance médicament) — c'est un vrai angle mort, à signaler comme opportunité de plaidoyer pour publication future.
- **CPNP (notifications cosmétiques UE)** : base interne, non publique — seul CosIng (référentiel ingrédients) est réutilisable.
- **Panels de consommation type Kantar/NielsenIQ parapharmacie** : entièrement payants, aucun extrait gratuit exploitable trouvé au-delà des communiqués de presse.

---

## Synthèse stratégique pour le copilote IA

**Familles les plus rentables (croisement Synadiet/Interfimo/FEBEA)** : dermocosmétique (marge la plus élevée, poids FEBEA 35,6 Md€ au niveau national industrie), compléments alimentaires sommeil/vitalité/digestion (60% du CA compléments en pharmacie), dispositifs médicaux de confort/maintien (LPP, marge libre hors convention).

**Architecture data recommandée** :
1. **Compl'Alim** (composition/dosages) + **Open Beauty Facts** (ingrédients INCI) + **CosIng** (statut réglementaire ingrédient) → moteur de catalogue enrichi automatique par code-barres/EAN, sans ressaisie.
2. **RappelConso** (GTIN) + **Safety Gate** → module d'alerte stock en temps réel ("ce produit référencé est rappelé").
3. **Open LPP** croisé avec **INSEE naissances/pyramide des âges** par région → priorisation du réassort DM/orthopédie/incontinence par bassin de vie.
4. **Synadiet + Interfimo/Extencia** → benchmarks de marge et d'indication pour arbitrer les linéaires (argument business chiffré pour le pharmacien).
5. **Nutrivigilance + Pharmacopée ANSM** → couche de sécurité/conformité du conseil (ne jamais recommander une plante/dose à risque signalé).

Indicateurs synthétiques calculables : **Indice de tension parapharma régional** (naissances INSEE + LPP par région), **Score de conformité produit** (Open Beauty Facts + CosIng + RappelConso), **Indice de marge potentielle par catégorie** (Synadiet/Interfimo), **Alerte réglementaire précoce** (Nutrivigilance + DGCCRF bilans + Safety Gate).

---

**Chemin de travail** : aucun fichier créé (recherche pure). Toutes les URLs listées ci-dessus ont été vérifiées via recherche web du jour (3 juillet 2026).

---

# AGENT 10 — Sources cachées : rapport livré

Rapport complet publié : **https://claude.ai/code/artifact/75bf168c-dda2-4984-ba92-d2b0893bdf4d**

Fichier source : `/private/tmp/claude-501/-Users-williammorel/d330fed3-43d2-440f-b96c-47798e656912/scratchpad/agent10-sources-cachees.md`

## Résumé des 22 sources cachées identifiées et vérifiées

**Pépites "signal de vente officine" (rares, peu connues)**
1. IAS® Indicateur Avancé Sanitaire allergies (OpenHealth/CELTIPHARM) — indice construit à partir de ventes réelles en pharmacie
2. IQVIA Open Data Portal (iqvia.opendatasoft.com) — seule fenêtre gratuite sur le panel payant IQVIA (14 000 officines)

**Ruptures de stock / pharmacovigilance**
3. data.ansm.sante.fr (5 bases dont Trustmed) — 4. Étude DREES ER n°1335 sur l'impact business des ruptures — 5. EMA ESMP + flux JSON global peu connu — 6. ECDC ESAC-Net antibiotiques

**GitHub (wrappers d'API et outils, pas données brutes nouvelles)**
7. axel-op/api-bdpm-graphql — 8. bdpmgf.vedielaute.fr — 9. betagouv/api-medicaments (archivé 2019, à ne pas utiliser) — 10. **datagouv/datagouv-mcp** (serveur MCP officiel, gratuit, la pépite la plus directement exploitable) — 11. opencovid19-fr/data (pattern méthodologique)

**Officines / cartographie**
12. IRDES/Ecosante.fr "Les pharmacies"/"Les pharmaciens" — 13. FINESS + géocodage Atlasanté — 14. Localisation pharmacies OpenStreetMap (magOSM)

**NLP / scientifique**
15. PxCorpus (Zenodo, CC BY 4.0) — corpus vocal de prescriptions en français — 16. French Pharmacoepidemiology Initiative (URL à re-vérifier, 404 rencontré)

**Europe/international**
17. Eurostat hlth_sha11 — 18. OMS European Health Information Gateway

**Environnement**
19. Geod'air API qualité de l'air — 20. RNSA/pollens.fr (**mort depuis mars 2025**, remplacé par Atmo France)

**Démographie officinale**
21. INSEE Sirene API (code APE 4773Z, signal ouverture/fermeture le plus frais) — 22. CNOP Panorama démographique annuel

## Points de vigilance factuels à retenir
- RNSA/pollens.fr a cessé d'exister (liquidation 26 mars 2025) — toute recommandation antérieure le citant comme source vivante est obsolète.
- betagouv/api-medicaments est archivé depuis novembre 2019, à ne pas utiliser en production.
- L'URL de la charte French Pharmacoepidemiology Initiative a renvoyé une 404 lors de la vérification — à retester avant citation officielle.
- Plusieurs jeux de données (IAS allergie, OSM pharmacies) affichent eux-mêmes des métadonnées signalant une fréquence de mise à jour non respectée — toujours vérifier la fraîcheur réelle avant de bâtir une feature dessus.

La priorité d'intégration recommandée est le serveur MCP officiel `datagouv-mcp` (accès natif IA à tout data.gouv.fr sans développer de scraper) combiné à l'API Sirene de l'INSEE pour les signaux d'ouverture/fermeture d'officines en temps quasi réel.