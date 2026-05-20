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
| 1 | `token-bot` | ✅ pilote | Variables CSS (`--*`) — collisions, manques, doublons |
| 2 | `palette-bot` | ⏳ | Couleurs hardcodées hors tokens |
| 3 | `typo-bot` | ⏳ | Familles, tailles, poids |
| 4 | `spacing-bot` | ⏳ | Padding/margin/gap — grille 8px |
| 5 | `component-bot` | ⏳ | `.card`, `.modal`, `.kpi`, `.badge`, `.pill`, `.btn` |
| 6 | `a11y-bot` | ⏳ | ARIA, focus, skip-link, sr-only |
| 7 | `nav-bot` | ⏳ | Sidebar / bottom-nav / tabs |
| 8 | `radius-bot` | ⏳ | Échelle d'arrondis |

## Usage

```bash
# Lancer un bot
node bots/token-bot/audit.mjs

# Lancer tous les bots
node bots/run-all.mjs

# Voir le dashboard
open bots/index.html
```

Chaque bot écrit son rapport dans `bots/reports/<bot-id>.json`. Le dashboard (`bots/index.html`) charge tous les rapports et affiche un score de parité par bot.

## Principe : brand par app conservé

L'objectif n'est pas d'uniformiser les couleurs (OPSO vert, CRM bleu, Catalogue dark restent). Les bots ciblent uniquement la **structure** : tokens, composants, accessibilité, conventions.
