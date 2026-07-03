# Ventes moyennes France par pharmacie (Ameli / Medic'AM) — Design

**Objectif :** afficher, à titre **indicatif**, une **moyenne de ventes par pharmacie en France** par produit (CIP13), dérivée de l'open data Ameli **Medic'AM**, dans le Catalogue, le flyer marketing et le Pilotage du CRM JARVIS.

**Non-objectif :** ce n'est PAS un chiffre officine par officine réel. C'est une moyenne nationale (boîtes remboursées France ÷ nombre de pharmacies). Toujours étiqueté « à titre indicatif ».

---

## 1. Source de données

- **Medic'AM par type de prescripteur (interrégimes)** — data.gouv.fr, dataset id
  `536999d3a3a729239d20533a`
  (slug `medicam-medicaments-rembourses-par-lassurance-maladie-par-type-de-prescripteur-donnees-interregimes`).
- Fichiers **XLS semestriels** (« 1er semestre 2025 », « 2e semestre 2025 »…), ~5,8 Mo.
- Colonnes utiles : **`code CIP`** (CIP13), **`dénombrement (nombre de boites remboursées)`**,
  `montant remboursé`, classes ATC, **type de prescripteur** (libéral / salarié / **tous**).
- Couverture : médicaments **remboursables** délivrés en pharmacie de ville, tous régimes.
- Cadence : nouveau semestre ~tous les 6 mois.
- Gratuit, open data. **Aucune clé, aucun coût.**

⚠️ Le fichier contient plusieurs lignes par CIP (une par type de prescripteur). Pour éviter
le double comptage, **ne sommer que la catégorie « tous prescripteurs »/« ensemble »**
(à vérifier sur le fichier réel : valeur exacte de la colonne prescripteur).

## 2. Robot Python (hors-ligne, comme les autres pipelines)

Fichier : `generate_ameli_avg.py` (racine JARVIS/APP, Python 3.9 strict).

Étapes :
1. Appelle l'API data.gouv.fr `GET /api/1/datasets/536999d3a3a729239d20533a/` → liste des ressources.
2. Sélectionne les **2 semestres les plus récents** (= ~12 mois glissants) par le titre/date.
   Repli : « Medic'AM annuel <N> » si les semestres manquent.
3. Télécharge ces XLS, parse avec pandas/openpyxl (gérer .xls **et** .xlsx).
4. Filtre sur « tous prescripteurs », agrège `dénombrement` **par CIP13** sur la fenêtre.
5. `moyenne_par_pharmacie_an = round(total_boites / 19000)` (constante `NB_PHARMA = 19000`,
   documentée, cohérente avec le benchmark existant).
6. Écrit `crm/v2/ameli-avg-data.js` :
   ```js
   // Ameli Medic'AM — moyenne boîtes remboursées / pharmacie / an (indicatif)
   // Source: data.gouv.fr Medic'AM (interrégimes) · base 19000 pharmacies · <période>
   window.AMELI_AVG = { meta: { periode:"2025", base:19000, source:"Medic'AM", maj:"<date>" },
     data: { "3400930000000": 128, ... } };  // CIP13 -> moyenne/an (entier)
   ```
   Fichier compact (~une valeur par CIP). Clés = CIP13 string.

Mise à jour **automatique** : workflow GitHub Actions `ameli-avg.yml` (cron mensuel) qui
relance le robot et committe `ameli-avg-data.js` s'il change (même mécanique que le robot
Infos du matin). Données réellement rafraîchies ~tous les 6 mois.

## 3. Affichage (3 emplacements)

Helper commun côté app : `V2.ameliAvg(cip)` → nombre ou `null`. Lit `window.AMELI_AVG.data`.
Chargé via une balise `<script>` dans `index.html` (bump cache). Absent → dégradation propre
(la colonne/encart affiche « — », rien ne casse).

Étiquette partout : **« Moy. France · Ameli (indicatif) »**, avec la période en info-bulle.

1. **Catalogue & prix** (`v2-molecules.js`) : nouvelle colonne **« Moy. France /an »**
   (mono, discrète) à côté de la rotation réseau. `V2.ameliAvg(r.c)` ; `—` si absent
   (NR/para non remboursés). Ne casse pas le tri/FLIP/count-up existants ; colonne intégrée
   à la vue carte mobile (data-label).
2. **Flyer marketing** (`v2-mkt.js`, `buildFlyerHtml`) : sous le prix, ligne discrète
   « France : une pharmacie moyenne en vend ~X/an (Ameli, indicatif) » quand la donnée existe.
   Présent à l'écran ET dans le PDF.
3. **Pilotage** (`v2-pilotage.js`, section « marché Ameli ») : ajouter un repère national
   « moyenne par pharmacie » cohérent avec la section pénétration existante.

## 4. Contraintes & garde-fous

- Vanilla JS, zéro dépendance navigateur, **hors-ligne** (donnée pré-calculée embarquée).
- Python 3.9 strict (pas de `X | Y`), openpyxl/pandas déjà dans la stack.
- Jamais afficher comme un chiffre réel officine : **toujours « indicatif »**.
- Remboursables uniquement ; `—` sinon. Aucune donnée inventée.
- Ne pas committer de gros fichiers XLS bruts (télécharger en `/tmp`, ne garder que le .js).
  Respecter l'hygiène git (jamais `git add -A`).
- Mode OPSO intact (la colonne/encart s'affiche pareil, données identiques).
- Safari-safe ; `prefers-reduced-motion` respecté.

## 5. Vérification

- Robot : lancer `generate_ameli_avg.py`, vérifier que `ameli-avg-data.js` contient des
  milliers d'entrées, valeurs plausibles (ex. un Doliprane > un produit de niche), et que
  la somme France ÷ 19000 donne des ordres de grandeur crédibles sur 3-4 CIP connus.
- Affichage : vérif **visuelle** (Playwright + serveur local + login) du Catalogue
  (colonne remplie pour remboursables, « — » pour NR), du flyer et du Pilotage, screenshot,
  avant déploiement.
