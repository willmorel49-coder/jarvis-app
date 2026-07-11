# Copilote refondu + pont Google Maps — spec

_Date : 2026-07-11 · CRM Jarvis / Intégral Pharma · vanilla JS_

## Problème
Le « Copilote » est un hub de stats (page `marche`, ~7 sections) qui **double** Molécules / Audit / Infos, et qui n'est PAS la carte alors que Will l'ouvre pour ça. La carte (`v2-carte.js`) fait déjà tournée + prospects + trajets, mais elle a plusieurs portes d'entrée (Copilote, Carte, Groupements, Sagitta → toutes la même carte). Résultat : confus, trop de texte, doublons.

## Objectif
Copilote **devient la carte de tournée**, épurée, avec un **pont vers Google Maps** : démarrer l'itinéraire, et exporter toute la carte (avec icônes par groupement) dans Google My Maps.

## Périmètre (3 parties)

### A. Copilote = la carte
- Router `copilote` → rend directement `V2.pages.carte` (comme le font déjà `groupements`/`sagitta`).
- **Retirer de la navigation** la page `marche` (les 7 sections de stats).
  - **Garde-fou (à faire AVANT de couper)** : vérifier que chaque section (Top opportunités, Marchés en croissance, Ça décolle, Nouveautés, À sécuriser) a un équivalent dans Molécules / Audit / Infos. Toute section unique → la relier là-bas au lieu de la perdre. Le code de `marche` est **archivé** (non supprimé) → réversible.
- **Une seule entrée carte** dans l'accueil : « Copilote ». Nettoyer les tuiles/mini-liens en double (Carte / Groupements / Sagitta).

### B. « Démarrer ma tournée dans Google Maps » (navigation)
- Bouton dans la barre de tournée de la carte, actif quand la tournée a ≥ 1 arrêt.
- Ouvre une URL Google Maps Directions construite depuis les arrêts **dans l'ordre** (départ = dépôt si défini, sinon 1er arrêt) : `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng|...`.
- **Limite Google ~10 points** : si la tournée dépasse, découper en segments (« Itinéraire 1/2 », « 2/2 ») ; chaque bouton ouvre son segment. Prévenir l'utilisateur.
- Coordonnées : lat/lng déjà présentes (géocodage BAN existant). Aucune clé, aucun coût.

### C. « Exporter toute la carte vers Google My Maps » (KML)
- Bouton « Exporter vers Google Maps (My Maps) » sur la carte.
- Génère un **fichier KML** client-side (Blob + téléchargement), sans clé ni coût :
  - Un `<Folder>` **par groupement** (+ un folder « Sans groupement ») → deviennent des **calques** stylables dans My Maps.
  - Un `<Style>` par groupement avec `<IconStyle>` (couleur + icône distincte) → **icône différente par groupement**.
  - Un `<Placemark>` par officine : `<name>` = nom, `<description>` = adresse, CP/ville, tel, CA, statut (client/prospect), groupement ; `<Point><coordinates>lng,lat,0</coordinates>`.
- Périmètre exporté : **toutes les officines** visibles (respecte le filtre commercial courant si actif) — « tout voir ».
- Import par Will : mymaps.google.com → Créer une carte → Importer → choisir le `.kml` → carte perso Google, visible dans l'app Google Maps (Enregistrés → Cartes). 2 clics.

## Ce qu'on ne fait PAS (et pourquoi)
- **Pas de sync auto dans le compte Google** : nécessiterait l'API Google (clé + coût + OAuth) — contre la règle « zéro clé/coût ». On reste sur fichier→import.
- Pas de refonte de la carte elle-même (elle marche) : on la branche et on l'épure autour.

## Contraintes techniques
Vanilla JS, zéro dépendance/build, 100 % client-side, print-safe non concerné. Respecter §11 ROBOT.md (vérif après déploiement + lien). Bump cache `?v=` + `sw.js` VER ; l'app OPSO ne charge pas le Copilote (JARVIS only).

## Succès
Un seul bouton « Copilote » = la carte de tournée claire. Bouton « Démarrer dans Google Maps » qui lance l'itinéraire. Bouton « Exporter » qui produit un KML importable dans My Maps avec une icône par groupement. Zéro stat en doublon.

---

## Itération 2 — feedback Will (2026-07-11)

### FAIT & déployé
- B : « Démarrer dans Google Maps » (itinéraire, dépôt inclus, découpe >10). ✅
- C : « Exporter vers Google My Maps » (KML du set FILTRÉ, 1 dossier+icône par groupement, garde-fou >9000). ✅
- A1 : route `copilote` → rend la carte. ✅ (ancien hub à `#marche`, débranché)

### RESTE À FAIRE (prochaine session, à réserve pleine)

**T1 — La synthèse « quoi pousser » → dans Infos, en VISU MENSUEL sur l'année**
- Pas une liste du jour : un **graphique 12 mois** avec **évolution + taux de variation**, découpé par **NOS segments** :
  - Froid (`is_froid`) · Petits prix (<4,33 €) · Intermédiaires (4,33–468 €) · Chers (468–1500 €) · Très chers (>1500 €) · Biosimilaires (`artnature=biosimilaire`) · Génériques (`artnature=generique*`).
  - Segmentation : familles (froid/biosim/génér.) en priorité, sinon tranche de prix (`prix_ip`/PPHT).
- Métrique par mois : CA ou volume par segment (source `ameli_months[13]` + ventes réseau), avec variation MoM et/ou YoY.
- Emplacement : page **Infos** (nouveau bloc « Marché » ou onglet). Utiliser le skill **dataviz**.
- L'ancien hub `#marche` : retiré une fois T1 en place (les sections tour/visite sont déjà sur la carte ; « À sécuriser » = déjà dans Infos).

**T2 — Carte plus INTUITIVE (trop d'infos aujourd'hui)**
- Barre latérale = **essentiel seulement** : Voir · Couleur · Filtrer · Recherche · Légende.
- **Sortir de la carte** les liens vers d'autres pages (« Listes d'achats groupements », « Prix concurrents ») → les mettre dans **« Autres outils »** de l'accueil.
- **« Ma tournée »** : reste sur la carte (composition par clic), mais **bouton clair + phrase d'explication** (« Clique tes officines → compose ta tournée → démarre dans Google Maps »).
- **Export My Maps** = **un simple bouton discret** dans le panneau tournée (plus dans la barre d'outils principale).

**⚠️ T2 est un VRAI chantier design UX/UI (exigence Will), pas juste du rangement.**
- La lisibilité de la carte elle-même est à revoir : marqueurs, modes couleur (trop nombreux ?), clustering, légende, ce qu'on comprend en 1 coup d'œil.
- Méthode obligatoire : **variantes HTML numérotées** (Will choisit par n°), après avoir récupéré **2-3 références visuelles** de Will (cartes/apps qu'il trouve claires et belles) — règle anti-refonte-à-l'aveugle [[feedback_neya_visual_refs]].
- Viser sobre et évident (moins de modes, hiérarchie claire), cf. [[feedback_neya_simplify]].

**Référence maîtresse (Will) : « La Loupe » de La Longue Vue (géomarketing pharma, Atlas Articque).**
Leçons à appliquer à notre carte :
1. **Choropleth / aplats de couleur par territoire** à l'échelle large (densité, évolution) au lieu des ~19 000 marqueurs individuels — cause n°1 du « trop d'infos ». Agréger quand on est loin, détailler au zoom.
2. **Un seul indicateur à la fois + légende évidente** (la couleur = une seule chose).
3. **Niveaux géographiques** : national (zones) → département → commune → officines individuelles au zoom.
4. Idées bonus de La Loupe : densité /100k hab., évolution du parc, zones de chalandise (temps d'accès), filtre par groupement/environnement.
Site : la-longue-vue.fr · outil « La Loupe ».

### ✅ DIRECTION CHOISIE PAR WILL (2026-07-11) — après les 10 maquettes
- **Base esthétique = Design 7 (minimaliste éditorial)** appliqué partout : sobre, beaucoup de blanc, typo soignée, carte qui respire, contrôles secondaires dans des tiroirs/pop-overs.
- **Workflow = Design 6 (focus tournée)** : « Ma tournée » au centre (liste d'arrêts qui se remplit au clic, itinéraire tracé, gros « Démarrer dans Google Maps », « Prospects proches », export My Maps discret).
- **Carte = Design 9 (densité/zones, logique La Loupe)** : zones colorées à l'échelle large → clusters chiffrés au zoom → officines individuelles.
- Maquettes de réf : `crm/v2/_maq/carte-design-7.html`, `-6.html`, `-9.html`. Galerie : `carte-redesign.html`.

### Plan de build (par phases, à exécuter à réserve pleine)
1. **Reskin éditorial + declutter (Design 7)** — refondre le chrome de `v2-carte.js` : sidebar épurée, moins de modes visibles, tiroirs, typo. Sortir les liens « Listes d'achats » / « Prix concurrents » vers « Autres outils » de l'accueil. **Sûr, pas de nouvelle donnée.**
2. **Workflow tournée (Design 6)** — « Ma tournée » repensé (bouton clair + phrase d'explication), boutons Google Maps bien placés, export My Maps discret. **S'appuie sur l'existant (déjà codé).**
3. **Zones / choropleth (Design 9)** — ⚠️ **LE plus gros morceau + une VRAIE nouvelle capacité** : colorer des territoires nécessite des **polygones GeoJSON** (départements/régions/UGA) + agrégation des données officines par zone + rendu Leaflet. À sourcer (GeoJSON France gratuit, simplifié). Drill-down zones→clusters→points.

> ⚠️ Honnêteté : phases 1-2 = reshape de l'existant (raisonnable). Phase 3 (zones) = **nouvelle feature** (données polygones + agrégation), la plus longue. À faire proprement, pas à la va-vite sur une feature qui marche.

### FAIT (phase 1) — 2026-07-11
- Copilote → carte ✅. Section « Ma tournée » rangée (CTA clair + phrase + export discret, 2 liens sortis) ✅. Modes couleur : 5 boutons → menu « Colorer par » ✅.

### FAIT (données) — 2026-07-11 · enrichissement groupements PHARMA_FR
Will : « on avait un mapping des groupements, la donnée existe ». Vrai — elle était juste
non branchée. `Base France Décembre 2024.xlsx` n'avait que **31 %** de groupements ;
`JARVIS/GROUPEMENTS/data/output/pharmacies_par_groupement.xlsx` (~100 groupements /
17 500 officines) les a. Branché dans `build_pharma_fr.py` :
- remplissage groupement manquant par match **(CP + nom normalisé)**, match unique seul
  (356 clés ambigües ignorées) → **31 % → 63 %** (+6 300 officines, 114 groupements).
- fusion des libellés (APOTHERA == Apothera…), zéro doublon de casse.
- écarté : 21 grossistes véto (ids `CAV` : ALCYON/CENTRAVET) + garde-fou géocodage
  (CP métro hors bbox France = St-Barth-d'Anjou aux Caraïbes → supprimé).
- Déployé 20260711a. `reconcileWithWml` (clients/segments depuis WML) reste par-dessus.
- **Reste data** : segmentation prospects (Base France = 17 534 prospects, non re-segmentés
  au source ; corrigés côté client pour les 607 clients WML). Fiches groupement manquantes
  (groupements-data.js à compléter avec les 114 groupements réels).

### T4 — Aperçu + édition de la fiche officine DEPUIS la carte (demande Will)
Au clic / à la recherche d'une officine sur la carte : ouvrir un **panneau** (réutiliser le pattern cn-listpanel/tourpanel) avec :
- **Aperçu** : nom, adresse, ville, tél, commercial, groupement, CA.
- **Infos officine ÉDITABLES** : réutiliser `V2.profil.section('client', <id>)` (grossistes/génériqueurs/logiciel/robot) + `V2.notes.section('client', <id>)` — puis `V2.profil.hydrate()` / `V2.notes.hydrate()`. Sauvegarde Supabase `profils`/`notes` comme dans l'onglet Pharmacies.
- Lien « Ouvrir la fiche complète » → `V2.go('pharma', <id>)`.
- **⚠️ DÉCISION À TRANCHER (data) : l'`<id>` doit être le MÊME que celui de l'onglet Pharmacies**, sinon deux fiches séparées pour la même officine.
  - À vérifier : les officines de la carte (`PHARMA_FR`, national) portent-elles le `cip`/`code` des officines WML (`V2.pharmacies`, 630) ? Si oui → matcher par cip et utiliser l'`id` WML.
  - Scoper : l'édition ne concerne probablement que **les officines de Will** (ses 630), pas les 19 000 nationales → filtrer/limiter l'édition à celles qui ont une fiche WML.
