---
name: jarvis-conventions
description: Utiliser dès qu'on écrit, modifie ou relit du code du CRM JARVIS — un fichier de crm/v2/, un générateur Python, un fichier de données. Donne les conventions que le code respecte partout sans qu'aucun fichier ne les écrivait : nommage des fichiers, helpers V2.* obligatoires, échappement du HTML, format du token de cache et synchronisation du service worker, contrainte Python 3.9, chargement différé des gros fichiers.
---

# Conventions du CRM JARVIS

Reconstituées depuis le code lui-même (63 fichiers de `crm/v2/`). Elles n'étaient écrites nulle part : elles ont été données à l'oral et respectées par habitude.

## Nommage des fichiers — zéro exception

| Motif | Rôle |
|---|---|
| `v2-<domaine>.js` | un **pilier** : une page ou un module de l'app (`v2-app.js`, `v2-appro.js`, `v2-pharma.js`, `v2-mkt.js`, `v2-boot.js`, `v2-fiches.js`, `v2-molecules.js`) |
| `<sujet>-data.js` | un **jeu de données généré** (`ppht-data.js`, `stock-data.js`, `mkt-images-data.js`, `biosimilaires-data.js`) — jamais écrit à la main, toujours produit par un générateur Python |
| `<sujet>.json` | une donnée brute rapatriée d'une source externe (`ansm-dispo.json`, `has-avis.json`) |
| `_<nom>.html` | une maquette ou un outil interne, jamais servi en prod |

Un nouveau pilier prend un `v2-` ; un nouveau jeu de données prend un `-data.js`. Ne pas inventer un troisième motif.

## Le namespace `V2.*` — passer par les helpers, jamais à côté

Le code est en vanilla, sans build, sans module : tout vit sur l'objet global `V2`.

| Helper | Usage | Fréquence dans le code |
|---|---|---|
| `V2.esc(s)` | **échapper tout texte injecté dans du HTML.** Les pages construisent leur HTML par concaténation de chaînes : sans `V2.esc`, un nom de pharmacie avec une apostrophe ou un `<` casse la page | 61 |
| `V2.fmtEur(n)` / `V2.fmtNum(n)` | formatage monétaire et numérique — jamais un `toFixed(2) + " €"` à la main | 151 / 70 |
| `V2.toast(msg)` | tout retour utilisateur — jamais `alert()` | 250 |
| `V2.go(route)` / `V2.route` | navigation | 70 / 88 |
| `V2.render` / `V2.pages.X.render(root)` | rendu d'une page | 145 / 121 |
| `V2.bestPrice(b)` | **source de vérité unique du prix** → `{ip, ht, remise, offre}`. Ne jamais recalculer un net à côté (le bug historique était `prix_ip × (1 − remise)`, un double comptage) |  |
| `V2.loadFiles(...)` | chargement **différé** d'un jeu de données | |

## Cache-busting et service worker — le piège n°1

Le token de version a un format strict : `?v=AAAAMMJJ<lettre>` (exemple : `?v=20260804a`). La lettre s'incrémente pour plusieurs déploiements le même jour.

Deux endroits **doivent** rester identiques :
```bash
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u   # doit donner UNE seule valeur
grep -n "^var VER" crm/v2/sw.js                       # doit valoir la même
```
Le service worker est **cache-first par version** : tant que `VER` n'a pas bougé, le navigateur sert l'ancienne version. La page en ligne *est* à jour, mais personne ne la voit. Le sous-agent `gardien-deploiement` vérifie ce point.

## Python

- **`/usr/bin/python3` obligatoire.** Le `python3` de Homebrew (3.14) n'a plus `openpyxl` depuis le 02/08/2026.
- **Python 3.9 strict** pour les scrapers : pas de `float | None`, écrire `= None` sans annotation.
- Les générateurs produisent des `-data.js`, ils ne modifient jamais un pilier.
- Un générateur qui écrit **relit ce qu'il a écrit** avant de dire que c'est fait.

## Poids et chargement

Tout `*-data.js` de plus de **500 Ko** passe par `V2.loadFiles`, jamais dans le boot. L'app a déjà figé le Mac de Will.

## Données — pièges vérifiés

| Piège | Règle |
|---|---|
| Matching Offilog | **EAN prioritaire**, nom normalisé en fallback seulement |
| `ean` Drakkars | peut être `null` — ne jamais supposer qu'il est présent |
| Offilog Excel | feuille `"Croisement Complet"`, pas la feuille active |
| SheetJS | parser les colonnes **par nom**, jamais par index |
| Supabase anon key | format JWT `eyJ...`, pas `sb_publishable_...` |
| Prix achat vs prix public | `ca/qt` des ventes = prix **achat HT pharmacien** ; Drakkars / Cap3000 / Leclerc = prix **public TTC**. L'alerte concurrence = prix public concurrent < prix achat IP |
| `ip_app-8.html` | legacy, ne pas toucher |
| Librairies JS | ne rien ajouter sans accord explicite — zéro dépendance, zéro build, zéro npm |

## GitHub Pages

Push sur `main` = déploiement, avec 1 à 2 minutes de délai. Un push réussi ne prouve pas que la page est servie : `bash scripts/attendre-prod.sh <token>`.
