# Bots experts — Parité UX/UI

Bots d'audit qui scannent les 3 surfaces UI de Jarvis App (CRM, Catalogue, OPSO) et reportent les divergences à corriger.

## Périmètre des surfaces

| App | Fichiers scannés |
|-----|------------------|
| CRM | `crm/style.css`, `crm/app.js`, `crm/index.html` |
| Catalogue | `crm/catalogue.css`, `crm/catalogue.js` |
| OPSO | `opso/style.css`, `opso/app.js`, `opso/index.html` |

## Bots

| # | Bot | Statut | Périmètre |
|---|-----|--------|-----------|
| 1 | `token-bot`     | ✅ | Variables CSS (`--*`) — collisions, manques, doublons |
| 2 | `palette-bot`   | ✅ | Couleurs hardcodées hors tokens |
| 3 | `typo-bot`      | ✅ | Familles, tailles, poids |
| 4 | `spacing-bot`   | ✅ | Padding/margin/gap — grille 4px |
| 5 | `component-bot` | ✅ | `.card`, `.modal`, `.kpi`, `.badge`, `.pill`, `.btn` |
| 6 | `a11y-bot`      | ✅ | ARIA, focus, skip-link, sr-only |
| 7 | `nav-bot`       | ✅ | Sidebar / bottom-nav / tabs |
| 8 | `radius-bot`    | ✅ | Échelle d'arrondis |

## Usage

```bash
# Lancer un bot
node bots/token-bot/audit.mjs

# Lancer tous les bots
node bots/run-all.mjs

# Voir le dashboard
open bots/index.html

# Prévisualiser les correctifs proposés (dry-run)
node bots/apply-fixes.mjs

# Appliquer les correctifs safe (références cassées uniquement)
node bots/apply-fixes.mjs --apply

# Filtrer par bot
node bots/apply-fixes.mjs --bot=token-bot
```

Chaque bot écrit son rapport dans `bots/reports/<bot-id>.json`. Le dashboard (`bots/index.html`) charge tous les rapports et affiche un score de parité par bot.

## Mode auto-fix

Chaque rapport peut contenir une section `proposals` avec 3 niveaux de sécurité :

- **`safe`** : remplacement textuel sans ambiguïté (ex: `var(--bg1)` → `var(--bg)` quand `--bg1` n'est défini nulle part). Appliqué par `apply-fixes.mjs --apply`.
- **`manual`** : décision humaine requise (ex: collision de valeurs `--blue`, renommage de tokens). Listé mais non appliqué.
- **`info`** : suggestion non bloquante (ex: déf jamais utilisée → suppression).

Token Bot et A11y Bot émettent des proposals. Les autres bots fournissent du diagnostic uniquement (le contexte est trop riche pour de l'auto-fix).

## Principe : brand par app conservé

L'objectif n'est pas d'uniformiser les couleurs (OPSO vert, CRM bleu, Catalogue dark restent). Les bots ciblent uniquement la **structure** : tokens, composants, accessibilité, conventions.
