# BRIEF V2 — Améliorer la direction 10 pour des RESPONSABLES DE GROUPEMENTS

Lis d'abord `BRIEF.md` (contenu obligatoire, contacts Pascale, marque, règles Safari). Ce fichier-ci AJOUTE des exigences.

## CIBLE & OBJECTIF (change tout le ton)
Le destinataire est un **responsable / président de groupement de pharmacies** — un DÉCIDEUR (achats, direction).
Objectif : lui donner envie d'**appeler Pascale** et de **découvrir ce qu'Intégral peut proposer à son groupement**.
Angle central = **LA MARGE**. Intégral = « grossiste-répartiteur de **première intention** », dont le métier est d'**optimiser la marge** des officines, **dès la première boîte**, avec **transparence**.
Ton : premium, assuré, B2B haut de gamme, jamais racoleur. On donne envie, on ne déballe pas.

## ⚠️ RÈGLE BOSS ABSOLUE (rappel)
JAMAIS de chiffre commercial : pas de %, pas de taux, pas de « franco / sans engagement » présenté comme condition, pas de montant.
La marge est le THÈME, pas un chiffre. Formules autorisées : « votre marge, notre métier », « optimisée dès la première boîte », « des conditions claires, sur facture », « on vous le chiffre en rendez-vous ». Chiffres publics OK : +20 ans, 9 établissements, 72h.

## LE GROS CHANTIER : UNE CARTE 3D SPECTACULAIRE (le point n°1 de Will)
La carte actuelle est jugée **fade, déjà-vue, points minuscules**. À REMPLACER par une **vraie scène 3D WebGL (Three.js r128)**, motion design, niveau pro / Awwwards :
- Les établissements doivent être **GROS et spectaculaires** : faisceaux/piliers de lumière verticaux, balises 3D, halos, anneaux pulsants — impossibles à rater. PAS des petits points plats.
- **Siège Hyères** = le plus imposant (orange), les autres en bleu, **Pharmest (Metz)** = partenaire (marqueur distinct, ex. pointillé).
- **Arcs logistiques animés** convergeant vers Hyères (le siège = cœur du réseau).
- Mouvement vivant : légère orbite caméra + parallax à la souris, apparition au scroll. Étiquettes lisibles (noms des agences).
- Fond premium (nuit / relief), pas de France bleu pâle plate.
- **Safari-safe** : Three.js r128 cdnjs (global THREE, pas de modules), 0 background-clip:text, 0 backdrop-filter/blur CSS. Fallback poster/image si WebGL indispo ou prefers-reduced-motion. Pause du rAF hors-écran. Mobile : version allégée mais toujours 3D si possible, sinon fallback propre.
- Tu peux **réutiliser la silhouette exacte de France** : le `<path>` SVG de la carte est dans `../map-component.html` (viewBox 1000×960) — tu peux l'extruder en 3D. Les ancres 2D `ax/ay` des établissements y sont aussi (utile pour projeter précisément).

### Données des 9 établissements (nom · sigle · ville · dépt · lat · lon · type)
1. Hyères Pharma · HP · Hyères · 83 · 43.1206 · 6.1286 · SIÈGE
2. Ouest Pharma Services · OPS · St-Étienne-de-Montluc · 44 · 47.2789 · -1.7806 · site
3. Escale Pharma · EP · Chilly-Mazarin · 91 · 48.7028 · 2.3119 · site
4. Comptoir Pharmaceutique du Rhône · CPR · Saint-Maurice-l'Exil · 38 · 45.3936 · 4.7806 · site
5. Sud Ouest Pharma · SOP · Montayral · 47 · 44.4783 · 0.9389 · site
6. Pharm'Occitanie Services · POS · Villeneuve-lès-Béziers · 34 · 43.3206 · 3.2542 · site
7. Sud Est Pharma · SEP · Le Cannet-des-Maures · 83 · 43.3925 · 6.3406 · site
8. Mistral Santé Pharma · MSP · Flassans-sur-Issole · 83 · 43.3614 · 6.1828 · site
9. Pharmest · PH · Metz · 57 · 49.1193 · 6.1757 · PARTENAIRE
(Les 3 du Var — HP, SEP, MSP — sont proches : gère le chevauchement avec des décalages d'étiquettes / hauteurs de faisceaux différentes, et garde l'annuaire pour la lisibilité.)

## LE RESTE (ameliorer l'ensemble)
- Garde la colonne vertébrale de la direction 10 (faisceau « lamp » qui révèle le titre + récit vertical par chapitres) — Will l'a validée.
- Réécris TOUTE la copie pour le décideur groupement, angle marge (voir plus haut).
- Ajoute une section courte « la promesse marge » (sans chiffres) qui donne envie de creuser : première intention, marge optimisée dès la 1ère boîte, transparence sur facture, indépendance, réseau national. Termine par l'envie de « découvrir » en RDV.
- Garde l'**annuaire des 9 établissements** (lisible) en complément de la carte 3D.
- Polish UX/UI PRO : hiérarchie typo, espacements généreux, boutons soignés (état hover), micro-interactions, cohérence, accessibilité, mobile-first impeccable.
- CTA final vers **Pascale Prieto** (mail + tel) — donne envie : « Découvrez ce que nous pouvons proposer à votre groupement. »

Livrable : un fichier HTML complet et autonome à l'emplacement exact indiqué. Rendu PROFESSIONNEL, motion 3D bluffant, Safari-safe.
