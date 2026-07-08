# Copilote « Cerveau de la tournée » — Carte, tournées & prospection (CRM JARVIS)

_Spec de conception — 2026-07-08_

## 1. Objectif

Transformer l'onglet **Copilote** en outil **cartographique** au service de la **prospection** et de l'**optimisation des tournées de livraison**. Objectif métier : maximiser le **rendement** des livraisons (plus d'arrêts utiles par kilomètre) en s'appuyant sur les **clients déjà ouverts** et la géographie, et repérer les **prospects** à ajouter sur les axes/tournées pour densifier.

En parallèle : **déplacer les données de marché** (marché France, tendance, momentum, ruptures, nouveautés) de l'écran Copilote vers **Pilotage**, rattachées aux officines.

## 2. Décisions actées (brainstorming)

1. **La carte est la base** de l'outil.
2. Distances **à vol d'oiseau** (haversine) — 100% hors-ligne, instantané, sans coût. Routes réelles = V2 éventuelle.
3. Prospection **ET** optimisation de tournées, à parts égales.
4. **Dépôts configurables** (les 7 établissements Intégral : CPR, HP, MSP, OPS, POS, SEP, SOP — villes à confirmer par Will ; en attendant : point de départ choisi sur la carte / recherché par ville, mémorisé).

## 3. Contraintes (non négociables)

- **100% client-side**, hors-ligne, zéro clé/serveur/coût. Vanilla JS, pas de build.
- **Leaflet local** (`vendor/leaflet/`, déjà présent). Safari-safe (pas de backdrop-filter/blur/clip-text). `prefers-reduced-motion` géré.
- Réutilise les données existantes : `PHARMA_FR` (19 568 officines : `p=[lat,lng,uga,grp,seg,client,nom,ville,cp,tel,titulaire,email]`, flag client/prospect), `ZONE` (potentiel/population par officine), `clients-data.js` (secteur commercial), `geocode_cache.json` (CP+ville → lat/lng).
- Persistance tournées & dépôts : **localStorage** en repli, Supabase quand dispo (comme le reste du CRM).

## 4. Architecture

- **`crm/v2/v2-copilote.js`** : la page devient la carte-tournée. Les **helpers de données** globaux (`V2.market`, `V2.rupture`, `V2.zone`, `V2.stock`, `V2.tendance`, `V2.momentum`, `V2.nouveaute`) **restent** (utilisés par les fiches/Pilotage) ; c'est la **surface UI marché** du Copilote qui part vers Pilotage.
- **`crm/v2/v2-tournee.js`** (nouveau) : moteur de tournée (haversine, plus proche voisin + 2-opt), état des tournées, prospection de proximité. Exposé via `V2.tournee`.
- **`crm/v2/v2-pilotage.js`** : accueille la section **Marché** (ex-Copilote), rattachée aux officines.
- Leaflet chargé comme dans `v2-carte.js` (`ensureLeaflet`).

### 4.1 Données officine (unifiées)

Source de vérité carte = `PHARMA_FR.p[i]` : `lat,lng,uga,grp,seg,client(0/1),nom,ville,cp,tel,titulaire,email`. Enrichissements : `ZONE` (population/potentiel), secteur commercial (`clients-data.js` par CIP quand match).

## 5. Vues / UX

Plein écran : **carte** (fond clair CARTO) + **panneau latéral** (rétractable) à droite.

### 5.1 Carte (base)
- Tous les officines en points (canvas, clustering léger) : **clients ouverts** = point plein couleur marque ; **prospects** = point clair/creux.
- **Filtres** (barre haute) : Clients / Prospects / Les deux ; par **UGA**, **groupement**, **segmentation**, **secteur commercial** ; recherche ville/nom.
- **Légende** couleur + compteurs (n clients, n prospects visibles).
- Clic officine → **popup** : nom, ville, CP, tél, titulaire, statut, population/potentiel, boutons **« + Tournée »** et **« Voir la fiche »**.

### 5.2 Optimiseur de tournée (panneau)
- **Composer une tournée** : ajouter des officines (clic carte, ou « ajouter tous les clients visibles / de la zone / du secteur »), retirer, vider.
- **Dépôt** : choisir un point de départ/retour (liste des dépôts configurés, clic carte, ou recherche ville) — optionnel (sinon boucle libre).
- **Optimiser** : ordre de passage minimisant les km (plus proche voisin + 2-opt, haversine). **Tracé** de la tournée sur la carte (polyline numérotée).
- **Résultats** : nb arrêts · **km total (vol d'oiseau)** · **temps estimé** (km ÷ vitesse moyenne paramétrable + temps de service/arrêt) · **km par arrêt** (indicateur de rendement).
- **Liste ordonnée** des arrêts (réordonnable manuellement ; recalcul).
- **Enregistrer / charger / dupliquer** une tournée (localStorage → Supabase).

### 5.3 Prospection / densification (panneau)
- À partir d'une tournée (ou d'un client/zone sélectionné) : **prospects à proximité** — dans un rayon (curseur km) ou le long du **corridor** de la tournée (distance à la polyline < X km).
- **Classement** par potentiel (population `ZONE`, `potentielGx`, groupement), avec distance au trajet.
- **« + Tournée »** pour densifier ; indicateur : **arrêts gagnés vs km ajoutés** (rendement marginal).

### 5.4 Rendement (bandeau)
- Synthèse : arrêts, km total, km/arrêt, part clients vs prospects, gain de densification.

## 6. Moteur (déterministe, hors-ligne)

- **Distance** : haversine (km).
- **Ordre** : plus proche voisin depuis le dépôt (ou 1er point), puis amélioration **2-opt** (borne d'itérations pour rester instantané sur ~100 arrêts).
- **Temps** : `km / vitesseMoy (déf. 45 km/h) + nbArrêts × tempsService (déf. 8 min)` — paramétrable.
- **Corridor** : distance point→segment de la polyline (projection), seuil km.

## 7. Déplacement des données de marché vers Pilotage

- La **section marché** du Copilote (marché France Medic'AM, tendance, momentum, ruptures, nouveautés croisés aux ventes) est **retirée du Copilote** et **ajoutée à Pilotage** comme bloc « Marché & officines » (vue marché **rattachée aux officines** : par officine et/ou par secteur).
- Les **helpers globaux** (`V2.market`, etc.) restent inchangés (fiches officine, Pilotage les consomment).

## 8. Dégradation & cas limites

- Sans Leaflet (hors-ligne première visite) : message clair, le reste du CRM intact.
- Grand nombre de points : rendu canvas + clustering ; 2-opt borné.
- Officine sans coordonnées : ignorée du routage (listée « non localisée »).
- `new Date()` OK (navigateur). Pas de `Math.random` requis (moteur déterministe).

## 9. Hors périmètre (V1)

- Distances/temps **routiers réels** (OSRM/GraphHopper) — V2.
- Fenêtres horaires, capacités véhicules, multi-tournées automatiques (VRP complet) — V2.
- Géocodage exact adresse par adresse (on part des coordonnées `PHARMA_FR` + centroïde CP/ville) — affinable en V2.

## 10. Critères de réussite

- La carte affiche clients ouverts et prospects, filtrables, cliquables.
- Composer une tournée, l'optimiser, voir le tracé + km + temps + ordre.
- Voir les prospects proches d'une tournée, classés par potentiel, et les ajouter (densification chiffrée).
- Les données de marché ne sont plus dans le Copilote mais dans Pilotage, rattachées aux officines.
- 100% hors-ligne, sans clé ni serveur.

## 11. Livraison (par phases)

1. Carte de base (points clients/prospects, filtres, popups) + bascule des données marché vers Pilotage.
2. Optimiseur de tournée (composition, dépôt, 2-opt, tracé, résultats, sauvegarde).
3. Prospection de proximité / corridor + rendement.
4. Réglages dépôts (villes des 7 établissements à confirmer) + affinages.

## 12. À confirmer par Will

- **Villes des dépôts** (CPR, HP, MSP, OPS, POS, SEP, SOP) — ou placement manuel sur la carte.
- « Clients ouverts » = flag `client` de `PHARMA_FR` (2 222) ou le secteur commercial `clients-data.js` (517) ? (défaut proposé : flag `PHARMA_FR`, plus complet et géolocalisé.)
