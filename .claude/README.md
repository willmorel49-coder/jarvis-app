# .claude/ — Config Claude Code pour Jarvis App

Ce dossier contient la config Claude Code du projet : agents personnalisés, commandes slash, skills, et exemples de config MCP.

## Fichiers

| Fichier | Rôle | Committé ? |
|---------|------|-----------|
| `agents/` | Sub-agents Claude Code spécifiques au projet | ✅ |
| `commands/` | Slash commands `/xxx` du projet | ✅ |
| `skills/` | Skills lazy-loaded (crm-structure, crm-supabase, crm-offilog, crm-design) | ✅ |
| `mcp-servers.example.json` | Template MCP à copier vers ta config perso | ✅ |
| `settings.local.json` | Config MCP perso, non partagée | ❌ (`.gitignore`) |

## Ajouter les MCP servers du projet

Les MCP servers ne sont **pas activés automatiquement** — chacun doit les installer sur sa machine. Deux méthodes.

### Méthode 1 — Une commande CLI (recommandé)

Depuis n'importe où sur ta machine :

```bash
claude mcp add --scope user --transport http albo https://mcp.albo.inc/mcp
```

Le `--scope user` = dispo pour toutes tes sessions Claude Code (VS Code, CLI, tous repos). Puis relance VS Code (`Cmd+Shift+P` → *Developer: Reload Window*).

Pour vérifier : dans le terminal Claude Code → `/mcp`.

### Méthode 2 — Copier le template

```bash
# Config perso au repo (scope projet, non commité, seulement toi)
cp .claude/mcp-servers.example.json .claude/settings.local.json

# OU config user globale (tous tes projets)
cat .claude/mcp-servers.example.json  # inspecte
# puis merge la clé mcpServers dans ~/.claude/settings.json
```

Le fichier `mcp-servers.example.json` est la source de vérité — si un nouveau MCP est ajouté au projet, il apparaît là.

## MCP servers actuels

| Nom | URL | Rôle |
|-----|-----|------|
| `albo` | `https://mcp.albo.inc/mcp` | À documenter — outils Albo pour Intégral Pharma |

## Skills disponibles

Voir `skills/` — lazy-loaded, s'invoquent à la demande selon la tâche :

- `crm-structure` — architecture `app.js`, pages, navigation, état global
- `crm-supabase` — schema SQL, RLS, Storage, Auth
- `crm-offilog` — pipeline Offilog × scrapers × matching EAN/nom
- `crm-design` — tokens CSS, composants, conventions UI
