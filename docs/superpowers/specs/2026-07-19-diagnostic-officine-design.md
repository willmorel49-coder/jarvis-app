# Diagnostic officine + branchements open data — Design

**Date :** 2026-07-19
**Branche :** `feature/diagnostic-officine`
**Origine :** analyse de pharmapex.fr → quelles données/features gratuites reprendre dans Jarvis. 8 agents de recherche (données + API) puis 3 agents de recon du code `crm/v2`.

## Principe directeur
Ne rien recréer qui existe déjà. Greffer sur les surfaces matures (fiche officine, carte, robots). 100 % client-side / robots gratuits (règle « pas de dépendance externe payante »). Mobile-first. Assumer honnêtement les données qu'on n'a pas plutôt que bluffer.

## Constat de recon (ce qui existe déjà — à réutiliser)
- **Fiche officine** : `crm/v2/v2-pharma.js` → `renderDetail()` (~1071), `activitySection()` (~869), onglet « Audit marge » greffé (`v2-pharma.js:1234`).
- **Audit marge (reco chiffrée en € façon PharmaPex)** : `v2-audit.js` → `V2.audit.audit(pid)` / `sheetFor(pid)`. Chiffre-choc + par tranche + vs N°1.
- **Best-rotations réseau/groupement non prises par l'officine** : `grpBestRotations(pid)` (dans v2-pharma).
- **CA par génériqueur par officine** : `V2.generiqueurCard` (`generiqueurs-data.js`).
- **Ruptures ANSM indexées CIP13** : `window.RUPTURES` (`ruptures-data.js`, robot `ruptures.yml`), croisement achats déjà écrit `orderedCips(pid)` / `nbTensChez(pid)` (`v2-copilote.js`).
- **Carte + choroplèthe départements** : `v2-carte.js` (`carteZoneMetric('part'|'densite')`, `drawZones`, `pass()`/`colorFor()`, `typeFocus`), `departements-data.js`.
- **Référentiel officines** : `pharma-fr-data.js` (~19 700 officines, `seg` Client/Prospect), généré par `GROUPEMENTS/.../build_pharma_fr.py` (ingère déjà FINESS).
- **Géocodage BAN** : appelé runtime à `v2-carte.js:364` et `v2-tournee.js:63` (fonctions jumelles) + 4 scripts Python.
- **Robots** : `.github/workflows/*.yml`, pattern cron → `generate_*.py` → commit si diff. `zone.yml` tire déjà la population commune (geo.api.gouv), `ameli-avg.yml` tire déjà Medic'AM, `nouveautes.yml` tire déjà la BDPM.

**Trou réel identifié :** aucun **score/note d'officine unifié** (3 scores contextuels épars : priorité visite, insertion axe, opportunité produit).

## Périmètre validé par Will (2026-07-19) : « tout le lot d'un coup »

### Lot A — Bloc « Diagnostic officine » (fiche officine)
Nouvelle fonction de rendu en tête de `renderDetail()`, avant les onglets. 4 étages :
1. **Score /100 vs réseau + chiffre-choc.** Score composite, calculé client-side depuis les agrégats déjà montés (`cipStats()`, `_netTotal`, `grpBestRotations`, `V2.audit.audit(pid).rate`). Axes honnêtes et mesurables par officine :
   - CA/mois Intégral vs distribution réseau (décile).
   - Couverture des best-rotations réseau (part des best qu'elle prend déjà).
   - Taux d'abandon de marge capté (`V2.audit`).
   - Part générique vs 92,5 % national (seul repère national mesurable par officine, via génériqueurs).
   Le score **synthétise** ces signaux en un chiffre ; il ne réaffiche pas les listes détaillées.
2. **Plan d'action chiffré en €, trié par impact décroissant.** Agrégateur pur (zéro recalcul) : empile abandon rendu €/an (`V2.audit`), manque à gagner best-rotations (rotation × abandon), leviers génériqueurs. Chaque ligne cliquable → section détaillée existante.
3. **Bandeau ruptures.** `RUPTURES ∩ orderedCips(pid)` → « N produits qu'elle achète sont en tension ANSM ». Réutilise la logique `nbTensChez`.
4. **Chips repères nationaux (contexte).** Petit fichier statique `reperes-nationaux.js` (CA médian 2,1 M€, marge 28-29 %, EBE ~11 %, panier ~41 €, substitution 92,5 % — sources Interfimo/Fiducial 2025). **Contexte/crédibilisation uniquement, jamais un axe de note** (Intégral ne voit que sa part du sell-out, pas le CA/marge/EBE réels de l'officine).

### Lot B — Badge « reprise récente » (prospection)
Dans le robot `build_pharma_fr.py` : **diff du nom de titulaire** entre l'extrait FINESS courant et le précédent → flag `reprise: true` (+ date) sur l'officine. Rendu = badge sur la carte (`colorFor()`/popup) et sur la fiche. Remplace le « signal succession » (âge titulaire + CA<1M€ **infaisables** : absents de tout open data gratuit).

### Lot C — Métrique « zone sous-dotée » (carte départements)
3ᵉ métrique `tension` = population INSEE / nombre total d'officines FINESS, dans `carteZoneMetric` + `drawZones`. Data : enrichir `departements-data.js` (population par dépt + compte officines FINESS, pas seulement le réseau). Maille département assumée comme premier cut (commune = plus tard).

### Lot D — Réparation géocodage (plomberie prioritaire)
BAN `api-adresse.data.gouv.fr` **décommissionné (~janv. 2026)** → casse le géocodage runtime de la carte et de la tournée.
- **JS** : fusionner les 2 fonctions jumelles (`v2-carte.js:364`, `v2-tournee.js:63`) en un `V2.geocode` unique pointant sur `https://data.geopf.fr/geocodage/search` (gratuit, sans clé, même forme de réponse à adapter).
- **Python** : basculer l'URL de base dans les 4 scripts (`build_pharma_fr.py`, `geocode_pharmacies.py`, `generate_zone.py`, `generate_wml_v2.py`).
- Bonus futur (hors ce lot) : FINESS → FINESS+ (nouveau flux ANS, dispo 20/07/2026).

## Ce qu'on n'implémente PAS (décidé, honnêteté)
- Score positionnant l'officine contre « 2,1 M€ » de CA total : impossible (on ne voit que le sell-out IP). Macro = contexte seulement.
- « Officine fragile CA<1M€ » et « âge titulaire » : pas de source gratuite → abandonnés au profit du badge reprise.
- RappelConso croisé aux achats : items sans EAN/CIP fiable → laissés en flux global (déjà dans Infos du matin).
- Aucune nouvelle page ; aucun nouveau robot lourd (on réutilise ruptures/ameli/zone existants).

## Ordre d'exécution proposé
D (géocodage, débloque le reste) → A (Diagnostic, le money-shot) → C (tension carte) → B (badge reprise, dépend d'un 2ᵉ extrait FINESS donc effet différé).

## Vérification
- Lots A/C : ouvrir la page en local (http.server + Playwright, pas file://), screenshot fiche + carte, vérifier visuellement AVANT déploiement (règle maquettes).
- Lot D : tester le géocodage sur quelques adresses réelles (réponse geopf → lat/lon corrects) avant de committer.
- Respect Safari : pas de background-clip:text sur gros texte ; lazy-load ; bump `?v=` + sw.js VER au déploiement.
- `ci.yml` (syntaxe JS + smoke Playwright) doit rester vert.

## Fichiers touchés (prévision)
`crm/v2/v2-pharma.js` (bloc Diagnostic + score + plan d'action), nouveau `crm/v2/reperes-nationaux.js`, `crm/v2/v2-carte.js` (métrique tension + `V2.geocode` + badge reprise), `crm/v2/v2-tournee.js` (utilise `V2.geocode`), `crm/v2/departements-data.js` (regénéré), robots Python `build_pharma_fr.py` / `geocode_pharmacies.py` / `generate_zone.py` / `generate_wml_v2.py` (URL geopf) + diff titulaire dans `build_pharma_fr.py`.
