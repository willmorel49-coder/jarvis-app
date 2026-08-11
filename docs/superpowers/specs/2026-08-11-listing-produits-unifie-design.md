# Listing produits unifié — « Produits »

**Date :** 2026-08-11
**Projet :** JARVIS / Intégral Pharma · CRM V2
**Statut :** spec validée par Will (brainstorming du 11/08/2026)

---

## En une phrase

Un seul écran remplace les quatre endroits où l'on cherche aujourd'hui des produits, et il répond à la seule question qui compte en rendez-vous : **« qu'est-ce que je propose à CETTE officine, aujourd'hui, parmi ce qu'on a vraiment en stock ? »**

---

## 1. Le problème

Quatre écrans montrent des produits, aucun ne les croise :

| Écran actuel | Ce qu'il montre | Ce qui lui manque |
|---|---|---|
| `pages.catalogue` (`v2-catalogue.js`) | 10 500 réf, filtres famille AFMCODE × tranche de prix | ne sait rien de l'officine en face |
| `pages.molecules` (`v2-molecules.js`) | produits du réseau classés par nb de pharmacies | vue réseau, pas vue client |
| `pages.appro` (`v2-appro.js`) | ce qui monte, ruptures, saison, nouveautés, stock | outil achats, invisible pour le commercial |
| fiche officine / `client-products.js` | ce que ce client achète déjà | ne dit pas ce qu'il **n'**achète **pas** |

Personne ne calcule le croisement **officine × son groupement d'achat × notre stock disponible**.

## 2. Le principe — un moteur, deux lectures

Un unique calcul, réutilisé dans les deux sens :

- **Lecture vendeur** — pour une officine : ce que ses **confrères du même groupement** nous achètent et qu'elle, non.
- **Lecture achats** — le même résultat transposé par produit : combien d'officines sont « en trou » dessus, et pour quel potentiel total.

C'est la raison pour laquelle il n'y a **qu'une seule feature** : les deux modes lisent la même matrice.

## 3. Données — tout existe déjà

Aucune nouvelle source, aucun scraping, aucun coût.

| Source | Fichier | Contenu utile |
|---|---|---|
| Officines | `crm/v2/wml-officines-data.js` → `WML_OFFICINES` | 691 officines, champ `groupement`, `ca`, `cp`, `comms` |
| Ventes | même fichier → `WML_SALES` | 437 848 lignes `[pharmacyId, mois, commercial, cip13, qte, puNet, mntNetHt]`, jan–juin 2026 |
| Stock | `crm/v2/stock-data.js` → `STOCK_IP.data` | 6 367 CIP → unités dispo (tous dépôts) |
| Ruptures ANSM | `crm/v2/ruptures-data.js` → `RUPTURES.data` | CIP → date de signalement |
| Prix / famille | `crm/v2/prod-stats-data.js` → `PROD_STATS` | par CIP : `d` (libellé), `f` (famille), `ppht`, `net`, `rpct`, `rota` |
| Prix par dépôt | `crm/v2/etab-prices-data.js` → `ETAB_PRICES` | CIP → `[prix, stock]` par établissement |

**Faits mesurés le 11/08/2026** (sur les fichiers de production) :

- 135 groupements distincts ; 516 officines sur 691 (**75 %**) appartiennent à un groupement d'au moins 5 officines ; 18 officines sans aucun groupement.
- 7 886 CIP distincts vendus ; 86 216 paires (groupement × CIP) ; 155 785 paires (officine × CIP).
- Indexation complète des 437 848 lignes : **259 ms**, une seule fois.

⚠️ Les lignes de ventes peuvent être **négatives** (retours : `qte: -1`). Le moteur agrège le **montant net** par (officine, CIP) et ne considère un produit comme « acheté » que si ce net est **> 0**.

## 4. Le moteur — `V2.produits.build()`

### 4.1 Groupe de comparaison

Pour une officine cible :

1. **Cas nominal (75 %)** — son groupement compte ≥ 5 officines dans `WML_OFFICINES` → les confrères sont les autres officines de ce groupement. Libellé affiché : *« 72 confrères UPP »*.
2. **Repli (25 %)** — groupement absent, inconnu, ou < 5 officines → **officines comparables** : même département (2 premiers caractères du `cp`) **et** même tranche de CA (< 10 k€ / 10–30 k€ / 30–60 k€ / > 60 k€). Libellé affiché : *« 12 officines comparables »*.
3. **Repli du repli** — si le repli donne < 5 officines, on élargit à la seule tranche de CA, toutes régions confondues. Le libellé le dit : *« 40 officines de taille comparable »*.

Le libellé du groupe de comparaison est **toujours visible sur la ligne** : le commercial doit pouvoir dire d'où sort le chiffre.

### 4.2 Calcul du trou

Pour chaque CIP acheté par au moins un confrère :

```
peers      = nb de confrères dont le net sur ce CIP est > 0
pctPeers   = peers / (taille du groupe - 1)
caMoyen    = somme des nets confrères sur ce CIP / peers
```

Un CIP entre dans la liste de l'officine si :

- l'officine ne l'achète pas (`net <= 0` ou absent), **et**
- `pctPeers >= 0.30`, **et**
- `STOCK_IP.data[cip] > 0`.

**Le seuil de 30 % est un arbitrage mesuré**, pas un réglage arbitraire :

| Seuil | Produits/officine | Officines sous 5 produits |
|---|---|---|
| 50 % | 20 | 101 |
| **30 %** | **87** | **0** |
| 20 % | 188 | 0 |
| 10 % | 503 | 0 |

Le seuil est exposé en constante `SEUIL_PEERS = 0.30` en tête de module, modifiable sans toucher au reste.

### 4.3 Tri

Tri par **potentiel décroissant** : `potentiel = caMoyen × pctPeers`. C'est le tri par défaut et le seul chiffre mis en avant. Tris secondaires disponibles : % de confrères, rotation (`PROD_STATS.rota`), stock.

### 4.4 Coût et cache

Un seul passage sur `V2.sales` construit trois index :
`netParOfficine[phId][cip]`, `netParGroupe[grp][cip] = {peers, somme}`, `tailleGroupe[grp]`.

Résultat mémorisé sur `V2.produits._index`, invalidé si `V2.sales` change. Construction **lazy** : rien ne tourne tant qu'on n'ouvre pas l'écran. Aucun nouveau fichier de données, aucune étape Python : le listing suit automatiquement le prochain `refresh-stats-commercial`.

## 5. L'écran « Produits » — `V2.pages.produits`

Nouveau fichier `crm/v2/v2-produits.js`, chargé comme les autres modules. Style : tokens CSS existants du thème clair (`--ip-blue #0050E6`, `--c-mint`, `--c-rose`, `--c-amber`), Satoshi + Inter + Geist Mono pour les chiffres. Aucun `backdrop-filter`, aucun `background-clip:text`, aucun `filter:blur` sur grande surface (règle Safari).

### 5.1 Mode Vendeur (par défaut)

- **Sélecteur d'officine** en haut, pré-rempli si on arrive depuis une fiche officine (`V2.go('produits', {ph: id})`).
- **Bandeau de contexte** : nom de l'officine, groupe de comparaison et sa taille, CA de l'officine chez nous, potentiel total de la liste en €.
- **Liste** — une ligne par produit :
  - libellé (`PROD_STATS.d`) + badge famille (princeps / NR / générique / biosimilaire)
  - *« 61 % de ses confrères Giphar le prennent »*
  - *« 148 € en moyenne par confrère »* (sur jan–juin 2026)
  - prix net proposé (voir §7) et **stock réel**
  - pastille rouge **rupture ANSM** si présent dans `RUPTURES.data` (le produit reste affiché, mais signalé)
- **Filtres** : famille, tranche de prix, « en rupture ANSM » exclu/inclus, recherche libre.
- **Cible mobile** : lecture confortable à 390 px, cibles tactiles ≥ 44 px, tableau replié en cartes.

### 5.2 Mode Achats

Bascule par onglet, même moteur, agrégation par produit sur **toutes** les officines :

- nb d'officines en trou sur ce CIP · potentiel cumulé € · stock actuel · couverture (stock ÷ demande réseau mensuelle) · alerte rupture ANSM · génériqueur (via `GENERIQUEURS`).
- Filtre « uniquement les produits hors stock » : ce qu'il faudrait rentrer.
- Filtre par groupement : *« sur quoi Giphar est-il en retard chez nous ? »*

## 6. Ce qu'on en fait — 2 lots

### Lot 1 (livrable d'abord)

1. Moteur `V2.produits` + écran, 2 modes, filtres, mobile.
2. **PDF à laisser au pharmacien** : réutilise le générateur PDF déjà en place (`v2-mkt.js` / catalogues marketing). Contenu : **produit, prix net, disponibilité** — *pas* le barème d'abandon de marge. Une page, charte bleu `#0050E6`.
3. Bascule du menu (§8).

### Lot 2

4. **Sélection de lignes → proposition** : cases à cocher + quantités, export vers la fiche officine ou mail pré-rédigé (réutilise `v2-rdv-modeles.js` / `mails-complement-data.js`).
5. **Mémoire dans la fiche officine** : la liste est enregistrée « proposée le JJ/MM » (Supabase, table notes/actions existante) pour mesurer à la visite suivante ce qui a été suivi d'effet.

## 7. Règles métier à respecter (non négociables)

- Vocabulaire imposé : **« abandon de marge »**. Le synonyme commercial courant est proscrit partout dans l'écran, les libellés et le PDF.
- Prix net d'un **princeps** = PPHT − barème par tranche : 0,18 € (≤ 4,33 €) · 3,89 % (≤ 468 €) · 19,50 € (> 468 €). Utiliser `V2.applyPPHT` / le barème déjà en place dans `v2-boot.js`, ne pas le réécrire.
- **Génériques et NR : net = PPHT, aucun abandon de marge.** Afficher « — » et les exclure de toute moyenne. (Rappel du bug de juin 2026 : 2 413 génériques porteurs d'un abandon fictif servis aux commerciaux.)
- Intégral Pharma est un **groupe de grossistes-répartiteurs**. Dans cet écran, le mot « groupement » désigne uniquement le groupement d'achat du pharmacien (Giphar, UPP…).
- Aucune condition commerciale chiffrée sur un support destiné à sortir de chez nous au-delà du prix net proposé.

## 8. Navigation

`Produits` devient la **seule entrée produits visible** dans le menu principal et la home (`v2-app.js`, tableau `PAGES` + tuiles home).

`catalogue`, `molecules` et `appro` :
- **restent enregistrées et fonctionnelles** — aucune suppression de fichier, aucune route cassée ;
- sortent du menu principal et des tuiles de la home ;
- sont atteignables par trois liens discrets en bas de l'écran Produits : *« Catalogue complet »*, *« Prix par produit »*, *« Vue achats détaillée »*.

Réversible en une ligne si Will veut revenir en arrière.

## 9. Fraîcheur des données

Les ventes couvrent **janvier–juin 2026**. Conformément à la règle « APPRO doit marcher comme si les données étaient à jour » : le dernier état connu est traité comme la situation courante, **une seule mention discrète** en pied de bandeau (*« ventes réseau jan.–juin 2026 »*), aucun avertissement anxiogène, aucune correction d'ancienneté qui gonflerait artificiellement le potentiel.

## 10. Vérification avant livraison

- Contrôle à l'écran à **390 px** et en desktop, capture à l'appui (règle `livraison-preuve`).
- Test sur trois officines représentatives : une grosse en groupement (PHARMACIE CARRÉ, Giphar), une moyenne (PHARMACIE BONNET, UPP), une **sans groupement** (chemin de repli).
- Vérifier qu'aucune officine ne tombe à zéro produit.
- Vérifier qu'aucun générique n'affiche d'abandon de marge.
- Vérifier que 100 % des produits listés ont `STOCK_IP > 0`.
- Sous-agent `gardien-deploiement` : verdict GO obligatoire avant `git push`. Fichiers ajoutés **un par un**. Cache-busting `?v=` + `sw.js VER` synchronisés.

## 11. Hors périmètre (assumé)

- Pas de commande réelle transmise à l'ERP : le lot 2 s'arrête à la proposition.
- Pas de comparaison aux prix concurrents (Offilog / Drakkars / Leclerc) : ça reste le pilier Offilog.
- Pas de prévision de vente : le potentiel affiché est un **constat** sur les confrères, pas une projection.

---

## Exemple réel (calculé le 11/08/2026)

**PHARMACIE CARRÉ** — Giphar, 69 135 € de CA chez nous.
79 références que ses confrères Giphar nous prennent et qu'elle ne nous prend pas, **toutes en stock**.
Top 20 = **2 592 € sur le semestre**.
