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
