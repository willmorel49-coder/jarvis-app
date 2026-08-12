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

⚠️ **`V2.esc` ne suffit PAS pour une valeur placée dans un `onclick="…('ICI')"`.**
Elle traverse deux analyseurs : HTML puis JavaScript. `V2.esc` transforme `'` en
`&#39;`, que le navigateur redécode en `'` **avant** que JS ne lise la chaîne — qui
se referme alors au milieu. Neutraliser les quotes à la source :
`esc(String(v).replace(/[\\'"<>&]/g, ''))`.
Le code historique compte ~30 `onclick` dans ce cas (identifiants d'officines ou
de listes, non contrôlables par un tiers — sans danger aujourd'hui, mais à ne pas
imiter pour une valeur qui vient de l'extérieur). Vérifié le 10/08/2026.

## Cache-busting et service worker — le piège n°1

Le token de version a un format strict : `?v=AAAAMMJJ<lettre>` (exemple : `?v=20260804a`). La lettre s'incrémente pour plusieurs déploiements le même jour.

Deux endroits **doivent** rester identiques :
```bash
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u   # doit donner UNE seule valeur
grep -n "^var VER" crm/v2/sw.js                       # doit valoir la même
```
Le service worker est **cache-first par version** : tant que `VER` n'a pas bougé, le navigateur sert l'ancienne version. La page en ligne *est* à jour, mais personne ne la voit. Le sous-agent `gardien-deploiement` vérifie ce point.

**Un TROISIÈME jeton existe**, indépendant des deux autres, pour les jeux de
données chargés en différé : `var V = '?v=…'` dans `v2-boot.js` (fonction
`V2.loadFiles`). Modifier un `*-data.js` sans le monter = l'app ressert
l'ancien fichier, en silence — y compris en local.
```bash
grep -n "var V = '?v=" crm/v2/v2-boot.js
```
Vécu le 10/08/2026 : 167 accents réparés dans `clients-data.js`, invisibles
tant que ce jeton n'avait pas bougé.

⚠️ En développement local, changer un fichier **sans** changer le `?v=` laisse
le service worker servir l'ancienne version : un rechargement normal ne suffit
pas. Vider d'abord :
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(c => caches.delete(c)));
```

## Supabase — le piège des droits

Une table créée par migration n'a **aucun droit** pour `authenticated` : la policy
RLS ne remplace pas le `GRANT`. Symptôme trompeur — tout semble configuré (RLS
activée, policy présente, `anon` bien enfermé) et l'app répond
« permission denied for table X ».

```sql
grant select, insert, update, delete on public.<table> to authenticated;
```

Toujours contrôler **les deux sens**. Vérifier que `anon` ne peut pas lire ne
prouve rien sur ce que le commercial peut faire :
```sql
select has_table_privilege('authenticated','public.<table>','select') as commercial_lit,
       has_table_privilege('anon','public.<table>','select')          as anon_lit;
```

Vécu le 10/08/2026 sur les 5 tables `rdv*`.

**Et `service_role` est logé à la même enseigne — en pire.** Il contourne la RLS
mais **pas les droits de table**. Une fonction serveur qui l'utilise ne reçoit
alors **aucune erreur** : juste une liste vide. Symptôme vécu le 11/08/2026 —
la fonction `agenda` répondait « jeton inconnu » sur un jeton parfaitement
valide, pendant qu'on cherchait le bug dans le code.

```sql
grant select, insert, update, delete on public.<table> to service_role;
select has_table_privilege('service_role','public.<table>','select');
```

## Variables CSS — les noms du projet, pas ceux de la doc

Ce projet n'a **ni `--blue` ni `--bg`**. Les vrais noms :

| À écrire | Pas |
|---|---|
| `--ip-blue`, `--ip-blue-d` | `--blue` |
| `--ip-ink`, `--ip-ink-2` | `--ink` |
| `--card`, `--card-2` | `--bg` |
| `--line`, `--line-2`, `--line-strong` · `--muted`, `--muted-2` · `--r-md` | |

Une variable inconnue ne casse rien de visible à la relecture : la déclaration
est simplement ignorée, et l'écran sort **sans couleur** sans le moindre
message. Vécu le 11/08/2026 sur deux écrans neufs d'un coup. Contrôle :

```bash
grep -o 'var(--[a-z0-9-]*)' crm/v2/<fichier>.js | sed 's/.*var(//;s/)//' | sort -u \
  | while read v; do grep -q -- "$v:" crm/v2/v2.css || echo "MANQUE $v"; done
```

Éviter aussi `color-mix()` : préférer une teinte fixe (`rgba(...)`), plus sûre
partout et sans dépendance à la version du navigateur.

## Tests

`node --test tests/` cherche un **module** nommé « tests », pas un dossier :
l'étape passe en ne testant rien du tout. Écrire :
```bash
node --test tests/*.test.mjs
```
Les fichiers purs (moteurs de calcul, générateurs de format) s'exportent avec
`if (typeof module !== 'undefined' && module.exports) module.exports = M;`
et se chargent sous Node via `createRequire` — même fichier pour le navigateur
et pour les tests, zéro build, zéro npm.

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
