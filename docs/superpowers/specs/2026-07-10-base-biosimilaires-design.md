# Base Biosimilaires France — Design

Date : 2026-07-10 · Projet : JARVIS / CRM Intégral Pharma

## Objectif

Construire une base de données **complète** des médicaments biosimilaires disponibles
en France, croisant :
- la **liste officielle** (ANSM / Ameli / EMA / BDPM) — tous les biosimilaires France,
- les **données internes JARVIS** (catalogue, ventes, stocks, prix Intégral),

livrée sous **deux formes** : un fichier de données (`base-biosimilaires.xlsx` + `biosimilaires-data.js`)
et une **page CRM** « Biosimilaires » (v2), avec un **angle commercial officine**.

## Décisions cadrage (validées par Will)

1. Périmètre : **tous les biosimilaires France** (liste officielle) puis enrichissement Intégral.
2. Livrable : **les deux** (fichier data + page CRM).
3. Angle page : **commercial officine** — mettre en avant les **substituables en ville**
   (les 11 groupes de l'arrêté du 10 avr. 2026) et ce qu'Intégral peut vendre ; hospitalier en second plan.
4. Hors-Intégral : **gardés**, marqués « hors périmètre » / « hôpital » quand pas de donnée de vente/stock.
5. Zéro dépendance externe / zéro clé API (règle JARVIS). Build local, sortie fichier-JS + page statique.

## Modèle de données (3 niveaux emboîtés)

### Niveau 1 — Molécule de référence (~26)
`dci`, `atc`, `aire` (rhumato/onco/diabéto/ophtalmo/hémato/os/anticoag/AMP…),
`reference` (princeps), `reference_labo`, `canal` (ville | hôpital | mixte),
`substituable` (bool), `substituable_date` (arrêté), `note`.

### Niveau 2 — Biosimilaires de la molécule (~130 marques)
`nom`, `labo`, `annee`, `statut` (commercialisé | AMM UE non confirmé FR),
+ enrichissement Intégral (niveau 3) quand rattaché à un CIP.

### Niveau 3 — Enrichissement JARVIS (par CIP13 quand dispo)
`cip13`, `prix_ppht`, `prix_ip`, `remise_pct`, `ameli_boxes_fr`, `ameli_ca`,
`ip_qty`, `ip_ca`, `stock_dispo`, `dans_catalogue`, `boites_par_pharma_an`.
Au niveau molécule : `mol_stats` (rotation, marge, remise, CA/pharmacie/an) depuis `mol-stats-data.js`.

## Sources & jointure

- Clé pivot universelle = **CIP13**. Les fichiers internes (CIP7) exposent `ean` (CIP13) comme pont.
- ATC : `benchmark-data.js` (`atc2`, issu des xlsx Medic'AM). DCI : `stock.js.mol` / `catalogue-ip.js.molecule`.
- Biosimilaires déjà tagués : `artnature = "biosimilaire"` dans `benchmark-data.js`.
- Ventes France : `ameli-boxes-data.js`, `ameli-avg-data.js`. Ventes internes : `sales-detail.js` (via CIP7).
  Stock : `stock.js` + `etab-prices-data.js`. Molécule : `mol-stats-data.js` (clé DCI MAJUSCULES).
- Matching marque→CIP : par `designation`/`nom` (substring marque) + confirmation DCI/ATC.

## Architecture de build

`generate-biosimilaires.js` (Node, module `vm` en sandbox `window={}`) :
1. Charge les fichiers de données JARVIS.
2. Contient le **référentiel officiel** figé (`biosim-referentiel.js`, éditable à la main).
3. Croise sur CIP13 (marque) + DCI (molécule).
4. Émet `crm/v2/biosimilaires-data.js` (`window.BIOSIMILAIRES`) + `biosimilaires-export.json`.

`generate_biosim_xlsx.py` : lit le JSON → écrit `base-biosimilaires.xlsx` (openpyxl),
onglets « Molécules », « Biosimilaires (détail) », « Substituables officine ».

## Page CRM

`crm/v2/biosimilaires.html` + `biosimilaires-page.js` :
- En-tête : compteurs (X molécules, Y biosimilaires, Z substituables ville, N référencés Intégral).
- Filtres : aire thérapeutique · canal (ville/hôpital) · substituable · « vendu chez Intégral ».
- Tri par défaut : **substituables ville d'abord**, puis présence Intégral, puis ventes France.
- Liste par molécule (carte) → clic = fiche détail : biosimilaires + labo + prix/ventes/stock Intégral.
- Hors-Intégral affichés avec badge « hôpital » / « non référencé Intégral ».
- Style : réutilise le design system CRM v2 existant (navy/orange, motion kit).

## Hors périmètre (YAGNI)

Pas de Supabase, pas d'API, pas de scraping temps réel (la liste officielle est figée
dans le référentiel, rafraîchie à la main quand un arrêté change). Pas de calcul de marge
réglementaire nouveau (réutilise les champs prix existants).

## Vérification

Screenshot Playwright de la page avant livraison (règle « vérifier les maquettes à l'écran »).
Cache-busting `?v=` + `sw.js` VER à bumper au déploiement.
