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
1. Télécharge les **2 derniers ZIP semestriels directement sur Ameli** (PAS l'API data.gouv,
   miroir périmé/mal libellé) : URL type
   `https://www.assurance-maladie.ameli.fr/sites/default/files/AAAA-01-a-06_medic-am-par-type-de-prescripteur_serie-mensuelle.zip`
   et `.../AAAA-07-a-12_...zip`. Le semestre en cours s'allonge chaque mois (ex. `2026-01-a-04`,
   dernier mois réel **avril 2026**). Sonder les URLs pour trouver les 2 fichiers couvrant les 12 derniers mois.
2. Chaque ZIP = **UN seul `.xls` binaire** (~16 Mo) → lire avec **xlrd** (openpyxl NE l'ouvre PAS).
3. Prendre l'onglet **`MedicAM_*mois_tous_presc`** (= total). ⚠️ Vérifié : `tous = ville + hôpital`
   → NE JAMAIS additionner les onglets. Exclure l'onglet `lisez-moi`.
4. Format **large** : colonnes d'identité A→I (`CIP13`, `NOM COURT`, `PRODUIT`, `Code EphMRA`,
   `Classe EphMRA`, `Code ATC`=ATC5, `Classe ATC`, `Code ATC 2`, `Libellé ATC 2`), puis par mois
   3 colonnes `Base / Nombre de boites remboursées YYYY-MM / Montant`. En-têtes en ligne 1, data dès ligne 2.
   → Ne sommer QUE les colonnes **« Nombre de boites remboursées YYYY-MM »** des 12 derniers mois.
5. Agréger par **CIP13** (⚠️ stocké en flottant `3400...0` → `int` puis `str` 13 chiffres).
   Sommer tous les CIP + les 12 mois → `total_boites` par CIP.
6. `moyenne_par_pharmacie_an = round(total_boites / NB_OFFICINES)` avec
   **`NB_OFFICINES = 20000`** (paramètre ; chiffre officiel CNOP 1er janv. 2025 = **20 242**,
   France entière ; en baisse ~1 %/an → à réactualiser). *(Will avait dit 19 000 ; on retient
   ~20 000, plus juste et documenté — à confirmer.)*
7. **Garde-fou crédibilité** : le n°1 France (paracétamol) = ~430 M boîtes/an ÷ 20 242 ≈
   **21 000 boîtes/officine/an**. Donc tout produit qui dépasse ~21 000 = **suspect** → à logger/écarter.

Pièges de parsing (vérifiés sur fichier réel) : CIP13 flottant→str13 ; format large (prendre la
bonne colonne « Nombre de boites » du bon mois, pas Base ni Montant) ; en-têtes avec `\n` internes
à normaliser ; accents corrompus dans les libellés (`¿`) → se fier aux **codes** ATC/EphMRA, pas aux libellés ;
« remboursé ≠ vendu » (sous-estime l'automédication non remboursée) → étiqueter « boîtes remboursées, indicatif ».
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
