# Modèle national d'anticipation pour APPRO — conception

**Date** : 2026-08-01 · **Statut** : validé par Will (cadrage en 3 questions + 2 sections)

---

## 1. Le problème

L'anticipation d'APPRO est aujourd'hui adossée aux données d'Intégral, et hérite donc de leurs
défauts. Mesuré le 2026-08-01 :

| Constat | Chiffre |
|---|---|
| Dernier inventaire plateforme | 2026-06-01 → **61 jours** |
| Références qui se vendent mais jamais inventoriées | **801 (28 %)** |
| Dernier mois de ventes (juin) | **70 %** d'un mois plein (425 officines vs 630 en avril) |
| Saisonnalité par produit (`saison-cip.json`) | **VIDE depuis le 30/07** — voir §3 |

Conséquence : quand la donnée interne se dégrade, l'anticipation se dégrade avec elle, alors que
la demande du marché français, elle, est parfaitement connue et publique.

## 2. L'objectif retenu

**Rendre l'anticipation indépendante de la qualité des données d'Intégral.**

Le modèle national se calcule entièrement sur des sources publiques gratuites. Le stock d'Intégral
n'intervient qu'en dernière couche, pour calculer un écart. Si le stock est vieux ou incomplet,
l'anticipation reste juste — seule la ligne « vous en avez X » devient imprécise, et elle le dit.

### Non-objectifs (écartés explicitement)

- **Mode démo** pour montrer l'outil sans données Intégral → utile un jour, pas le besoin actuel.
- **Étalon commercial** (comparer Intégral au marché pour vendre) → viendra gratuitement ensuite.
- Toute source payante (GERS, IQVIA, OpenHealth). Règle absolue : gratuit, sans clé.

## 3. Préalable bloquant : réparer la saisonnalité

`saison-cip.json` est passé de **4 678 produits à 0** le 2026-07-30, une minute après la livraison
de la fonctionnalité. Journal du robot :

```
OK · produits avec saison=0 (sur 0 CIP Medic'AM, catalogue=5945)
```

Le téléchargement Medic'AM n'a rien ramené sur le serveur GitHub, et le robot a **quand même écrit
un fichier vide**. C'est pour cette raison que le carnet affiche « Pré-acheter 0 » depuis.

Le profil mensuel est la matière première du modèle national : sans lui, pas d'anticipation.
À faire d'abord :

1. Comprendre pourquoi le téléchargement échoue sur le runner et le fiabiliser.
2. Ajouter la garde anti-écrasement (§6) — cette panne ne doit plus jamais pouvoir passer.
3. Lever le filtre catalogue.

## 4. Le marché à modéliser (mesuré)

Open Medic 2025, téléchargé et compté le 2026-08-01 :

- **12 486 CIP13 distincts**
- **2 326 804 881 boîtes remboursées** en France sur l'année

Taille de fichier attendue : ~700 Ko (volume + 12 indices mensuels par référence, format compact),
donc **chargement différé obligatoire** (règle projet : > 500 Ko en lazy load), sur le modèle de
`pivot.json` (2,8 Mo) déjà en place.

## 5. Architecture — trois couches

```
Couche 1 — MODÈLE NATIONAL  (aucune donnée Intégral)
  Open Medic          → volume France par CIP13
  Medic'AM mensuel    → profil saisonnier 12 mois par CIP13
  Table pivot         → molécule, groupe générique, laboratoire, prix
  Événements datés    → ANSM (tension + date de retour), génériques BDPM,
                        EMA en approche, baisses CEPS, avis HAS, rappels de lots
        ↓
Couche 2 — CALIBRAGE  (part de marché, §7)
        ↓
Couche 3 — VOTRE RÉEL  (stock plateforme, ventes réseau)
        → écart = cible − détenu
```

L'inversion est le cœur du sujet : aujourd'hui la couche 3 pilote tout ; demain elle ne fait que
mesurer un écart.

## 6. Le robot `generate_national.py`

**Cadence** : mensuelle (les sources bougent au mois). **Sortie** : `crm/v2/national.json`.

Une entrée par CIP13 :

```json
"3400934001024": {
  "v": 1240000,                                     // volume France, boîtes/an
  "s": [92,88,95,97,101,88,76,79,104,118,126,136],  // indice mensuel, 100 = moyenne
  "d": "macrogol",                                  // molécule
  "g": 1                                            // 1 = un groupe générique existe
}
```

Les événements ne sont pas dupliqués ici : ils vivent déjà dans leurs fichiers respectifs et sont
joints côté application par CIP13 ou par molécule.

### Les trois garanties

**G1 — Indépendance.** Le robot n'ouvre jamais `prod-stats-data.js` ni `stock-data.js`.
*Vérification* : test automatisé qui exécute le robot sans ces fichiers et compare l'empreinte du
résultat — elle doit être identique.

**G2 — Jamais d'écrasement par du vide.** Si le nouveau fichier contient **moins de 80 %** des
références du précédent, le robot **conserve l'ancien**, écrit l'anomalie dans son journal et sort
en échec visible. Règle appliquée aussi rétroactivement à `generate_medicam_saison.py`.

**G3 — Date de génération.** Chaque fichier porte `gen` (date ISO). L'écran affiche « figé depuis
N jours » au-delà de 45 jours, comme les autres flux depuis `?v=20260801g`.

## 7. Le calibrage — de la demande France à une quantité

Parts de marché mesurées le 2026-08-01 (ventes Intégral janv.-mai annualisées ÷ Open Medic 2025,
4 736 produits comparables) :

| Mesure | Valeur |
|---|---|
| Part globale du marché remboursé | **0,28 %** |
| Part médiane par produit | **0,12 %** |
| Intervalle interquartile | 0,04 % → 0,26 % |
| Officines servies | 691 / ~21 000 = **3,3 %** |

L'écart entre produits est trop large pour un curseur unique. On prend donc, pour chaque produit,
le meilleur niveau disponible — **et on affiche lequel** :

| Niveau | Condition | Étiquette à l'écran |
|---|---|---|
| 1 | Intégral vend ce produit | « mesuré » |
| 2 | Intégral vend des produits de la même molécule | « estimé (famille) » |
| 3 | aucun historique | « estimé (moyenne 0,28 %) » |

**Formule**, en deux temps (l'unité compte — une demande mensuelle n'est pas un stock cible) :

```
demande Intégral du mois M  =  volume France annuel ÷ 12 × indice[M] ÷ 100 × part
stock cible                 =  demande du mois M ÷ 30 × couverture cible en jours
```

Couverture cible = les valeurs déjà en place dans APPRO : 21 jours, portée à 30 en cas de tension
ANSM ou de marché en hausse.

Un curseur global permet de simuler une ambition (« et si on visait 2× notre part ? »).

> Note : le niveau 1 lit les ventes Intégral. C'est assumé — c'est la **couche 3**, posée sur un
> modèle qui, lui, tourne sans elles. Sans données Intégral, tout retombe au niveau 3 et l'outil
> continue de fonctionner en l'annonçant.

## 8. Ce que ça donne à l'écran

### Liste A — « Vos références » (espace *Anticiper*)

> **UVEDOSE 100 000 UI** — le marché France monte **×1,7 en octobre**
> cible ~**890 unités** · détenu **210** · **écart −680**
> *part utilisée : 0,31 % (mesurée)*

### Liste B — « Hors catalogue » (espace *Marché & négo*)

Enrichit la carte « Potentiel réseau » existante (`whiteSpace()`), pas une carte de plus.

> **XXX 50MG** — 340 000 boîtes/an en France, **non référencé chez vous**
> événement : générique attendu · potentiel ~**950 unités/an** (estimé, moyenne)

Les deux listes restent **séparées** : la liste B n'entre jamais dans le carnet d'achat du jour.

### Règles d'affichage

- Aucune quantité sans son niveau de fiabilité.
- Les totaux ne mélangent jamais mesuré et estimé (même règle que `eur` / `eurPre` / `eurInconnu`
  posée le 2026-08-01).
- Safari : aucun `backdrop-filter`, aucun `background-clip:text`, aucun flou sur grande surface.

## 9. Vérification

Tests écrits **avant** le code, hors dépôt (JARVIS reste sans outil de build), sur le modèle des
6 fichiers de tests du 2026-08-01 qui extraient les vraies fonctions du fichier livré.

| Test | Ce qu'il prouve |
|---|---|
| Indépendance | robot exécuté sans les fichiers Intégral → résultat identique |
| Anti-écrasement | source vide ou tronquée → l'ancien fichier est conservé |
| Calibrage | sur un produit vendu, la cible retombe sur le réel à ±20 % |
| Profil saisonnier | un produit d'hiver connu pique bien en déc.-janv. |
| Non-régression | les 6 tests existants restent au vert |

Puis **vérification à l'écran, ordi + mobile 390 px**, navigateur piloté avec un profil neuf
(un profil réutilisé sert une version en cache — piège rencontré le 2026-08-01).

## 10. Risques identifiés

| Risque | Parade |
|---|---|
| Medic'AM échoue sur le runner (panne du 30/07) | garde G2 + diagnostic préalable §3 |
| Fichier trop lourd sur le Mac de Will | format compact + chargement différé + mesure avant livraison |
| Part de marché mal interprétée comme une vérité | étiquette de fiabilité sur chaque ligne |
| Millésime Open Medic en retard (2025 pour 2026) | affiché explicitement ; le profil mensuel corrige la saison |
| Parapharma et non remboursé absents d'Open Medic | assumé : aucune source publique. Le modèle ne couvre que le remboursé, et le dit. |

## 11. Hors périmètre

Délais fournisseurs réels, francos, stock par lot et péremptions, stock par site pour les
remboursables : ces données n'existent que chez Intégral et restent à fournir par Will. Elles
n'empêchent pas ce modèle de fonctionner.
